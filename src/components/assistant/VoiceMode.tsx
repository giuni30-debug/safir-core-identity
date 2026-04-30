import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Mic, X, Loader2, Settings as SettingsIcon, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { AssistantOrb, type OrbState } from "./AssistantOrb";
import {
  getElevenLabsAgentSignedUrl,
  getElevenLabsAgentToken,
} from "@/server/elevenlabs.functions";
import { feedback, playSound } from "@/lib/sound";
import { useApp } from "@/contexts/AppContext";
import { appendMessage, createConversation } from "@/hooks/useAiMemory";
import { supabase } from "@/integrations/supabase/client";
import type { AssistantPersonality } from "@/hooks/useAssistantPrefs";

type ConversationExtras = {
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
  sendUserMessage?: (message: string) => void;
};

type WebkitAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

function getString(value: unknown, path: string[]): string | undefined {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

function cryptoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

type Props = {
  open: boolean;
  onClose: () => void;
  voiceId: string;
  personality: AssistantPersonality;
  autoMode: boolean;
  onOpenSettings: () => void;
  voiceConversationId?: string | null;
  onConversationCreated?: (id: string) => void;
};

const personalityPrompts: Record<AssistantPersonality, string> = {
  calm: "You are All Assist AI. Speak calmly, warmly, and concisely.",
  friendly: "You are All Assist AI. Be playful, upbeat, and friendly.",
  professional: "You are All Assist AI. Be formal, efficient, and to the point.",
};

export function VoiceMode(props: Props) {
  return (
    <ConversationProvider>
      <VoiceModeInner {...props} />
    </ConversationProvider>
  );
}

function VoiceModeInner({
  open,
  onClose,
  voiceId,
  personality,
  autoMode,
  onOpenSettings,
  voiceConversationId,
  onConversationCreated,
}: Props) {
  const { user, lang } = useApp();
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [transcript, setTranscript] = useState<
    { role: "user" | "assistant"; text: string; id: string }[]
  >([]);
  const [partial, setPartial] = useState("");
  const [connecting, setConnecting] = useState(false);

  const convoIdRef = useRef<string | null>(voiceConversationId ?? null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log("[voice] connected");
      setOrbState("listening");
      playSound("notification");
    },
    onDisconnect: () => {
      console.log("[voice] disconnected");
      setOrbState("idle");
      setInputLevel(0);
      setOutputLevel(0);
    },
    onError: (e) => console.error("[voice] sdk error:", e),
    onMessage: async (msg: unknown) => {
      const type = getString(msg, ["type"]) ?? getString(msg, ["event_type"]);
      if (type === "user_transcript") {
        const text = getString(msg, ["user_transcription_event", "user_transcript"]) ?? "";
        if (text) {
          setTranscript((p) => [...p, { role: "user", text, id: cryptoId() }]);
          setPartial("");
          setOrbState("thinking");
          if (user?.id) {
            const cid = await ensureConversation(user.id);
            if (cid) await appendMessage(user.id, cid, "user", text);
          }
        }
      } else if (type === "agent_response") {
        const text = getString(msg, ["agent_response_event", "agent_response"]) ?? "";
        if (text) {
          setTranscript((p) => [...p, { role: "assistant", text, id: cryptoId() }]);
          if (user?.id) {
            const cid = await ensureConversation(user.id);
            if (cid) await appendMessage(user.id, cid, "assistant", text);
          }
        }
      }
    },
  });

  const ensureConversation = useCallback(
    async (uid: string): Promise<string | null> => {
      if (convoIdRef.current) return convoIdRef.current;
      const id = await createConversation(uid, "🎙️ Voice — " + new Date().toLocaleString());
      if (id) {
        await supabase.from("ai_conversations").update({ is_voice: true }).eq("id", id);
        convoIdRef.current = id;
        onConversationCreated?.(id);
      }
      return id;
    },
    [onConversationCreated],
  );

  // Orb state from conversation
  useEffect(() => {
    if (conversation.status !== "connected") return;
    if (conversation.isSpeaking) setOrbState("speaking");
    else setOrbState("listening");
  }, [conversation.status, conversation.isSpeaking]);

  // Audio levels
  useEffect(() => {
    if (conversation.status !== "connected") return;
    const tick = () => {
      try {
        const ext = conversation as ConversationExtras;
        setInputLevel(ext.getInputVolume?.() ?? 0);
        setOutputLevel(ext.getOutputVolume?.() ?? 0);
      } catch {
        /* ignore */
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [conversation, conversation.status]);

  /** Unlock the AudioContext synchronously, inside the user gesture. */
  const unlockAudio = useCallback(() => {
    const Ctor = window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
    if (!Ctor) return;
    let ctx = audioCtxRef.current;
    if (!ctx) {
      ctx = new Ctor();
      audioCtxRef.current = ctx;
    }
    if (ctx.state === "suspended") void ctx.resume();
    try {
      // Route output through the media element category so it uses the
      // media volume channel, not the call/in-ear channel.
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      /* ignore */
    }
  }, []);

  /** Force audio playback to the loudspeaker (not earpiece/headset routing). */
  const routeAudioToSpeaker = useCallback(() => {
    try {
      type SinkAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      const els = document.querySelectorAll("audio");
      els.forEach((raw) => {
        const el = raw as SinkAudio;
        el.setAttribute("playsinline", "false");
        el.setAttribute("autoplay", "true");
        if (typeof el.setSinkId === "function") {
          el.setSinkId("speaker").catch((err) =>
            console.warn("[voice] setSinkId(speaker) failed:", err),
          );
        }
      });
    } catch (err) {
      console.warn("[voice] routeAudioToSpeaker failed:", err);
    }
  }, []);

  /** Request mic permission. MUST be the first await after the user tap. */
  const requestMic = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone is not available in this browser.");
    }
    // Proactive permission check (Safari may not support this — ignore failures)
    try {
      const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
      if (perms?.query) {
        const status = await perms.query({ name: "microphone" as PermissionName });
        if (status.state === "denied") {
          console.error("[voice] mic permission: denied (browser settings)");
          throw new Error("Microphone blocked. Enable it in browser settings.");
        }
      }
    } catch (err) {
      // ignore — feature not supported on Safari/iOS
      if (err instanceof Error && err.message.startsWith("Microphone blocked")) throw err;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      // Resume AudioContext immediately after mic is granted
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        await ctx.resume().catch((e) => console.warn("[voice] AudioContext resume failed:", e));
      }
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      console.error("[voice] mic permission error:", name || err);
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new Error("Microphone permission denied. Enable it in browser settings.");
      }
      if (name === "NotFoundError") {
        throw new Error("No microphone detected on this device.");
      }
      if (name === "NotReadableError") {
        throw new Error("Microphone in use by another app.");
      }
      throw err instanceof Error ? err : new Error("Could not access microphone.");
    }
  }, []);

  const overrides = useMemo(() => {
    const language = (lang === "ro" ? "ro" : lang === "tr" ? "tr" : lang === "de" ? "de" : "en") as
      "ro" | "tr" | "de" | "en";
    return {
      agent: { prompt: { prompt: personalityPrompts[personality] }, language },
      tts: { voiceId },
    } as const;
  }, [lang, personality, voiceId]);

  /**
   * Start the ElevenLabs session — STRICTLY one WebRTC attempt.
   * On any failure: end the session, fallback to WebSocket once, then stop.
   */
  const start = useCallback(async () => {
    if (connecting || conversation.status === "connected") return;
    feedback("tap", "tap");

    // STEP 1 — synchronous unlock inside the user gesture (no awaits before)
    unlockAudio();
    setConnecting(true);
    setOrbState("listening"); // "connecting" visual state

    try {
      // STEP 2 — first await: mic permission
      await requestMic();

      // STEP 3 — fetch WebRTC token (separate try so we log "token error" distinctly)
      let token: string | null = null;
      try {
        const res = await getElevenLabsAgentToken({ data: {} });
        if (!res.token) throw new Error(res.error || "No token returned from server");
        token = res.token;
      } catch (tokenErr) {
        console.error("[voice] token error:", tokenErr);
        throw tokenErr;
      }

      // STEP 4 — single WebRTC attempt; on failure, fall back to WebSocket ONCE
      try {
        await conversation.startSession({
          conversationToken: token,
          connectionType: "webrtc",
          overrides,
        });
      } catch (webrtcErr) {
        console.error("[voice] WebRTC fail:", webrtcErr);
        try {
          await conversation.endSession();
        } catch {
          /* ignore */
        }
        const signed = await getElevenLabsAgentSignedUrl({ data: {} });
        if (!signed.signedUrl) {
          console.error("[voice] signed-url error:", signed.error);
          throw new Error(signed.error || "No signed URL returned from server");
        }
        await conversation.startSession({
          signedUrl: signed.signedUrl,
          connectionType: "websocket",
          overrides,
        });
      }

      // Connected — route audio to speaker now that elements exist
      routeAudioToSpeaker();
      // Re-route after the SDK injects its <audio> element on the next tick
      window.setTimeout(routeAudioToSpeaker, 250);
      playSound("voice-start");
    } catch (e) {
      console.error("[voice] connection failed:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.length < 140 ? msg : "Voice failed. Try again.");
      setOrbState("error");
      playSound("error");
      setTimeout(() => setOrbState("idle"), 1200);
      try {
        await conversation.endSession();
      } catch {
        /* ignore */
      }
    } finally {
      setConnecting(false);
    }
  }, [connecting, conversation, overrides, requestMic, routeAudioToSpeaker, unlockAudio]);

  const stop = useCallback(async () => {
    feedback("tap", "tap");
    playSound("voice-stop");
    try {
      await conversation.endSession();
    } catch {
      /* ignore */
    }
    setTranscript([]);
    setPartial("");
    convoIdRef.current = null;
    setOrbState("idle");
  }, [conversation]);

  // Cleanup on close — does NOT auto-start
  useEffect(() => {
    if (!open) {
      try {
        conversation.endSession();
      } catch {
        /* ignore */
      }
      setTranscript([]);
      convoIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sendChip = useCallback(
    (label: string) => {
      try {
        (conversation as ConversationExtras).sendUserMessage?.(label);
        setTranscript((p) => [...p, { role: "user", text: label, id: cryptoId() }]);
        setOrbState("thinking");
      } catch (e) {
        console.error("chip send failed", e);
      }
    },
    [conversation],
  );

  const lastAssistant = useMemo(
    () => [...transcript].reverse().find((t) => t.role === "assistant")?.text ?? "",
    [transcript],
  );

  if (!open) return null;

  const isConnected = conversation.status === "connected";
  const statusLabel = connecting
    ? "Connecting…"
    : orbState === "thinking"
      ? "Thinking…"
      : orbState === "speaking"
        ? "Speaking"
        : isConnected
          ? "Listening…"
          : "Tap the mic to begin";

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-gradient-to-b from-[#05060c] via-[#0a0e22] to-[#05060c] text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 35%, rgba(99,102,241,0.18), transparent 70%), radial-gradient(40% 40% at 50% 70%, rgba(34,211,238,0.12), transparent 70%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-4 pt-5 pb-3">
        <button
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/5 backdrop-blur ring-1 ring-white/10 hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">All Assist AI</div>
          <div className="text-sm font-medium text-white/90">{statusLabel}</div>
        </div>
        <button
          onClick={onOpenSettings}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/5 backdrop-blur ring-1 ring-white/10 hover:bg-white/10"
          aria-label="Settings"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4">
        <AssistantOrb
          state={orbState}
          inputLevel={inputLevel}
          outputLevel={outputLevel}
          size={Math.min(
            320,
            Math.floor((typeof window !== "undefined" ? window.innerWidth : 320) * 0.78),
          )}
        />
      </div>

      <div className="relative z-10 mx-3 mb-3 max-h-[28vh] overflow-y-auto rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10 backdrop-blur">
        {transcript.length === 0 && !partial && (
          <p className="text-center text-sm text-white/50">
            {isConnected ? "Say hi — I'm listening." : "Tap the mic to begin."}
          </p>
        )}
        <div className="space-y-2">
          {transcript.slice(-8).map((t) => (
            <div
              key={t.id}
              className={`text-sm leading-snug ${
                t.role === "user" ? "text-white/95" : "text-cyan-200/95"
              }`}
            >
              <span className="mr-2 text-[10px] uppercase tracking-wider text-white/40">
                {t.role === "user" ? "You" : "AI"}
              </span>
              {t.text}
            </div>
          ))}
          {partial && <div className="text-sm italic text-white/60">{partial}…</div>}
        </div>

        {lastAssistant && (
          <div className="mt-3 flex flex-wrap gap-2">
            {["Explain more", "Translate", "Summarize"].map((c) => (
              <button
                key={c}
                onClick={() => sendChip(c)}
                className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/80 ring-1 ring-white/10 hover:bg-white/15"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="relative z-10 flex items-center justify-between gap-3 px-6 pb-8 pt-2">
        <button
          onClick={stop}
          disabled={!isConnected}
          className="grid h-12 w-12 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
          aria-label="End"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Mic — single tap to start; tap again to stop */}
        <button
          onClick={isConnected ? stop : start}
          disabled={connecting}
          className={`relative grid h-20 w-20 place-items-center rounded-full transition-transform active:scale-[0.97] ${
            conversation.isSpeaking
              ? "animate-pulse bg-gradient-to-br from-cyan-300 to-sky-500 shadow-[0_0_70px_rgba(34,211,238,0.75)]"
              : isConnected
                ? "bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-[0_0_60px_rgba(45,212,191,0.6)]"
                : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_50px_rgba(124,58,237,0.55)]"
          }`}
          aria-label="Microphone"
        >
          {connecting ? (
            <Loader2 className="h-7 w-7 animate-spin text-white" />
          ) : (
            <Mic className="h-8 w-8 text-white" />
          )}
        </button>

        <button
          onClick={() => playSound("notification")}
          className="grid h-12 w-12 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
          aria-label="Test sound"
        >
          <Volume2 className="h-5 w-5" />
        </button>
      </footer>
    </div>
  );
}
