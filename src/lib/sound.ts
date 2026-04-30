// Premium audio + haptics engine for Safir.
// - Preloads all sounds at app start (HTMLAudioElement instances).
// - Honors user prefs (sound on/off, haptics on/off, master volume).
// - No-overlap policy per sound id (rapid taps don't pile up).
// - Looping ringtone with start/stop, respecting global mute.
// - Vibration with simple patterns (graceful no-op on unsupported devices).

import sendUrl from "@/assets/sounds/send.mp3";
import receiveUrl from "@/assets/sounds/receive.mp3";
import voiceStartUrl from "@/assets/sounds/voice-start.mp3";
import voiceStopUrl from "@/assets/sounds/voice-stop.mp3";
import notificationUrl from "@/assets/sounds/notification.mp3";
import ringtoneUrl from "@/assets/sounds/ringtone.mp3";
import callAcceptUrl from "@/assets/sounds/call-accept.mp3";
import callEndUrl from "@/assets/sounds/call-end.mp3";
import tapUrl from "@/assets/sounds/tap.mp3";
import errorUrl from "@/assets/sounds/error.mp3";

export type SoundId =
  | "send"
  | "receive"
  | "voice-start"
  | "voice-stop"
  | "notification"
  | "ringtone"
  | "call-accept"
  | "call-end"
  | "tap"
  | "error";

const SOURCES: Record<SoundId, string> = {
  send: sendUrl,
  receive: receiveUrl,
  "voice-start": voiceStartUrl,
  "voice-stop": voiceStopUrl,
  notification: notificationUrl,
  ringtone: ringtoneUrl,
  "call-accept": callAcceptUrl,
  "call-end": callEndUrl,
  tap: tapUrl,
  error: errorUrl,
};

// Per-sound base volume so the mix feels balanced regardless of master volume.
const BASE_VOLUME: Record<SoundId, number> = {
  send: 0.55,
  receive: 0.55,
  "voice-start": 0.55,
  "voice-stop": 0.55,
  notification: 0.7,
  ringtone: 0.85,
  "call-accept": 0.7,
  "call-end": 0.55,
  tap: 0.35,
  error: 0.5,
};

// Throttle the same sound id from re-firing within this many ms.
const THROTTLE_MS: Partial<Record<SoundId, number>> = {
  tap: 60,
  send: 120,
  receive: 200,
  notification: 400,
};

// ---------------- Settings ----------------

const STORAGE_KEY = "safir.sound.prefs.v1";

export type SoundPrefs = {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  volume: number; // 0..1
};

const DEFAULT_PREFS: SoundPrefs = {
  soundEnabled: true,
  hapticsEnabled: true,
  volume: 0.8,
};

let prefs: SoundPrefs = { ...DEFAULT_PREFS };
const listeners = new Set<(p: SoundPrefs) => void>();

function loadPrefs(): SoundPrefs {
  if (typeof localStorage === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<SoundPrefs>;
    return {
      soundEnabled: parsed.soundEnabled ?? DEFAULT_PREFS.soundEnabled,
      hapticsEnabled: parsed.hapticsEnabled ?? DEFAULT_PREFS.hapticsEnabled,
      volume:
        typeof parsed.volume === "number"
          ? Math.max(0, Math.min(1, parsed.volume))
          : DEFAULT_PREFS.volume,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function getSoundPrefs(): SoundPrefs {
  return { ...prefs };
}

export function setSoundPrefs(patch: Partial<SoundPrefs>) {
  prefs = { ...prefs, ...patch };
  savePrefs();
  // Apply to currently loaded buffers
  for (const id of Object.keys(buffers) as SoundId[]) {
    const buf = buffers[id];
    if (buf) buf.volume = effectiveVolume(id);
  }
  // Stop ringtone immediately if sound got disabled
  if (!prefs.soundEnabled) stopRingtone();
  for (const fn of listeners) fn({ ...prefs });
}

export function subscribeSoundPrefs(fn: (p: SoundPrefs) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function effectiveVolume(id: SoundId): number {
  return Math.max(0, Math.min(1, BASE_VOLUME[id] * prefs.volume));
}

// ---------------- Audio buffers ----------------

const buffers: Partial<Record<SoundId, HTMLAudioElement>> = {};
const lastPlayedAt: Partial<Record<SoundId, number>> = {};
let unlocked = false;
let initialized = false;
let ringtoneEl: HTMLAudioElement | null = null;
let vibrationLoopId: number | null = null;

/**
 * Preload all sounds. Call once at app start.
 * Audio element instances are lazy-created and kept warm.
 * The first user gesture will "unlock" autoplay on iOS via tryUnlock().
 */
export function initSoundEngine() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  prefs = loadPrefs();
  for (const id of Object.keys(SOURCES) as SoundId[]) {
    const a = new Audio(SOURCES[id]);
    a.preload = "auto";
    a.volume = effectiveVolume(id);
    a.crossOrigin = "anonymous";
    buffers[id] = a;
  }
  // Attempt unlock on first user gesture
  const tryUnlock = () => {
    unlocked = true;
    // Touch each buffer with .load() to warm decode on iOS
    for (const id of Object.keys(buffers) as SoundId[]) {
      try {
        buffers[id]?.load();
      } catch {
        /* ignore */
      }
    }
    window.removeEventListener("pointerdown", tryUnlock);
    window.removeEventListener("keydown", tryUnlock);
    window.removeEventListener("touchstart", tryUnlock);
  };
  window.addEventListener("pointerdown", tryUnlock, { once: true });
  window.addEventListener("keydown", tryUnlock, { once: true });
  window.addEventListener("touchstart", tryUnlock, { once: true });
}

/**
 * Play a sound. Returns a cancel function.
 * Respects user prefs and per-sound throttling. Never overlaps the same id.
 */
export function playSound(id: SoundId): void {
  if (!prefs.soundEnabled) return;
  const buf = buffers[id];
  if (!buf) return;

  const now = performance.now();
  const minGap = THROTTLE_MS[id];
  if (minGap != null) {
    const last = lastPlayedAt[id] ?? 0;
    if (now - last < minGap) return;
  }
  lastPlayedAt[id] = now;

  try {
    buf.pause();
    buf.currentTime = 0;
    buf.volume = effectiveVolume(id);
    const p = buf.play();
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  } catch {
    /* ignore */
  }
}

// ---------------- Ringtone (looping) ----------------

export function startRingtone() {
  if (!prefs.soundEnabled) return;
  stopRingtone();
  const a = new Audio(SOURCES.ringtone);
  a.loop = true;
  a.volume = effectiveVolume("ringtone");
  ringtoneEl = a;
  const p = a.play();
  if (p && typeof p.catch === "function") p.catch(() => undefined);

  // Repeating vibration pattern: pulse-pulse-pause
  if (prefs.hapticsEnabled && "vibrate" in navigator) {
    const pulse = () => {
      try {
        navigator.vibrate([400, 200, 400, 1200]);
      } catch {
        /* ignore */
      }
    };
    pulse();
    vibrationLoopId = window.setInterval(pulse, 2200);
  }
}

export function stopRingtone() {
  if (ringtoneEl) {
    try {
      ringtoneEl.pause();
      ringtoneEl.currentTime = 0;
    } catch {
      /* ignore */
    }
    ringtoneEl = null;
  }
  if (vibrationLoopId != null) {
    window.clearInterval(vibrationLoopId);
    vibrationLoopId = null;
    try {
      navigator.vibrate?.(0);
    } catch {
      /* ignore */
    }
  }
}

// ---------------- Haptics ----------------

export type HapticPattern = "tap" | "light" | "medium" | "success" | "error";

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 8,
  light: 12,
  medium: 24,
  success: [12, 60, 18],
  error: [40, 50, 40],
};

export function vibrate(pattern: HapticPattern = "tap") {
  if (!prefs.hapticsEnabled) return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(HAPTIC_PATTERNS[pattern]);
  } catch {
    /* ignore */
  }
}

// Convenience: sound + haptic in one call.
export function feedback(id: SoundId, hap: HapticPattern | null = "tap") {
  playSound(id);
  if (hap) vibrate(hap);
}

// Mark unlocked (read-only)
export function isAudioUnlocked() {
  return unlocked;
}
