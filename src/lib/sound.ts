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

// ---------------- Spatial audio (WebAudio) ----------------
// We route HTMLAudio through a MediaElementSource → Panner → Gain → destination.
// This gives us cheap stereo panning + a "depth" gain so callers can imply
// distance (incoming call sweeping from far → near, UI element pan L/R, etc.).

type SpatialNodes = {
  source: MediaElementAudioSourceNode;
  panner: StereoPannerNode;
  gain: GainNode;
};

let audioCtx: AudioContext | null = null;
const spatialNodes: Partial<Record<SoundId, SpatialNodes>> = {};
const ringtoneSpatial: { panner: StereoPannerNode; gain: GainNode } | null = null as any;
let ringtoneNodes: { panner: StereoPannerNode; gain: GainNode } | null = null;

function ensureAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctor: typeof AudioContext | undefined =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

function getSpatial(id: SoundId): SpatialNodes | null {
  const ctx = ensureAudioCtx();
  const el = buffers[id];
  if (!ctx || !el) return null;
  if (spatialNodes[id]) return spatialNodes[id]!;
  try {
    const source = ctx.createMediaElementSource(el);
    const panner = ctx.createStereoPanner();
    const gain = ctx.createGain();
    gain.gain.value = 1;
    panner.pan.value = 0;
    source.connect(panner);
    panner.connect(gain);
    gain.connect(ctx.destination);
    spatialNodes[id] = { source, panner, gain };
    return spatialNodes[id]!;
  } catch {
    return null;
  }
}

/**
 * Spatial options for any one-shot playback.
 * - `pan`: -1 (full left) … 0 (center) … 1 (full right).
 *   Pass a screen X ratio (clientX / window.innerWidth) for "click here" cues.
 * - `depth`: 0 (far) … 1 (near). Scales gain to feel closer/further.
 */
export type SpatialOpts = { pan?: number; depth?: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Convert a viewport X coordinate to a stereo pan value in [-0.85, 0.85]. */
export function panFromClientX(clientX: number): number {
  if (typeof window === "undefined") return 0;
  const w = window.innerWidth || 1;
  const norm = clientX / w; // 0..1
  return clamp((norm - 0.5) * 1.7, -0.85, 0.85);
}

/** Convert any HTMLElement to a pan value based on its on-screen center. */
export function panFromElement(el: Element | null): number {
  if (!el) return 0;
  const r = (el as HTMLElement).getBoundingClientRect?.();
  if (!r) return 0;
  return panFromClientX(r.left + r.width / 2);
}

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
