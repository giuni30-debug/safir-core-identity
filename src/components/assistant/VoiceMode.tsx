import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { Mic, MicOff, X, Loader2, Settings as SettingsIcon, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { AssistantOrb, type OrbState } from "./AssistantOrb";
import { getElevenLabsAgentToken } from "@/server/elevenlabs.functions";
import { feedback, playSound } from "@/lib/sound";
import { useApp } from "@/contexts/AppContext";
import { appendMessage, createConversation, type AiConversation } from "@/hooks/useAiMemory";
import { supabase } from "@/integrations/supabase/client";
import type { AssistantPersonality } from "@/hooks/useAssistantPrefs";

type Props = {
  open: boolean;
  onClose: () => void;
  agentId: string | null;
  voiceId: string;
  personality: AssistantPersonality;
  autoMode: boolean;
  onOpenSettings: () => void;
  /** Optional existing voice conversation id to append into */
  voiceConversationId?: string | null;
  onConversationCreated?: (id: string) => void;
};

const personalityPrompts: Record<AssistantPersonality, string> = {
  calm: "You are All Assist AI. Speak calmly, warmly, and concisely. Use short natural sentences with light pauses. Be empathetic.",
  friendly:
    "You are All Assist AI. Be playful, upbeat, and friendly. Light humor is welcome. Keep replies short and natural.",
  professional:
    "You are All Assist AI. Be formal, efficient, and to the point. No jokes. Use professional vocabulary.",
};

export function VoiceMode({
  open,
  onClose,
  agentId,
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
  const [pttHeld, setPttHeld] = useState(false);

  const convoIdRef = useRef<string | null>(voiceConversationId ?? null);
  const lastUserRef = useRef<string>("");
  const rafRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      setOrbState("idle");
      playSound("notification");
    },
    onDisconnect: () => {
      setOrbState("idle");
      setInputLevel(0);
      setOutputLevel(0);
      setPttHeld(false);
    },
    onError: (e) => {
      console.error("ElevenLabs convo error:", e);
      setOrbState("error");
      playSound("error");
      toast.error("Voice not connected. Retrying...");
      setTimeout(() => setOrbState("idle"), 1200);
    },
    onMessage: async (msg: any) => {
      // Surface user transcript & agent response
      const type = msg?.type ?? msg?.event_type;
      if (type === "user_transcript") {
        const text = msg?.user_transcription_event?.user_transcript ?? "";
        if (text) {
          lastUserRef.current = text;
          setTranscript((prev) => [...prev, { role: "user", text, id: cryptoId() }]);
          setPartial("");
          setOrbState("thinking");
          // persist
          if (user?.id) {
            const cid = await ensureConversation(user.id);
            if (cid) await appendMessage(user.id, cid, "user", text);
          }
        }
      } else if (type === "agent_response") {
        const text = msg?.agent_response_event?.agent_response ?? "";
        if (text) {
          setTranscript((prev) => [...prev, { role: "assistant", text, id: cryptoId() }]);
          if (user?.id) {
            const cid = await ensureConversation(user.id);
            if (cid) await appendMessage(user.id, cid, "assistant", text);
          }
        }
      } else if (type === "agent_response_correction") {
        const text = msg?.agent_response_correction_event?.corrected_agent_response ?? "";
        if (text) {
          setTranscript((prev) => {
            const next = [...prev];
            // replace last assistant
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].role === "assistant") {
                next[i] = { ...next[i], text };
                break;
              }
            }
            return next;
          });
        }
      }
    },
  });

  // Ensure ai_conversations row for transcript persistence
  const ensureConversation = useCallback(
    async (uid: string): Promise<string | null> => {
      if (convoIdRef.current) return convoIdRef.current;
      const id = await createConversation(uid, "🎙️ Voice — " + new Date().toLocaleString());
      if (id) {
        // mark as voice
        await supabase.from("ai_conversations").update({ is_voice: true }).eq("id", id);
        convoIdRef.current = id;
        onConversationCreated?.(id);
      }
      return id;
    },
    [onConversationCreated],
  );

  // Update orb state from conversation status
  useEffect(() => {
    if (conversation.status !== "connected") return;
    if (conversation.isSpeaking) setOrbState("speaking");
    else if (pttHeld || autoMode) setOrbState("listening");
    else setOrbState("idle");
  }, [conversation.status, conversation.isSpeaking, pttHeld, autoMode]);

  // Audio level sampling at 60fps
  useEffect(() => {
    if (conversation.status !== "connected") return;
    const tick = () => {
      try {
        // SDK exposes getInputVolume / getOutputVolume returning 0..1
        const inV = (conversation as any).getInputVolume?.() ?? 0;
        const outV = (conversation as any).getOutputVolume?.() ?? 0;
        setInputLevel(typeof inV === "number" ? inV : 0);
        setOutputLevel(typeof outV === "number" ? outV : 0);
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

  const unlockAudioPlayback = useCallback(async () => {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  }, []);

  const requestMicStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone is not available in this browser.");
    }
    if (navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (status.state === "denied") {
          throw new Error("Microphone permission is blocked. Enable it in browser settings.");
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("Microphone permission")) throw err;
      }
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    stream.getTracks().forEach((track) => track.stop());
  }, []);

  const startElevenLabsSession = useCallback(
    async (withOverrides: boolean) => {
      const res = await getElevenLabsAgentToken({ data: { agentId: undefined } });
      if (!res.token) throw new Error(res.error || "No token returned from server");

      const baseOpts = {
        conversationToken: res.token,
        connectionType: "webrtc" as const,
      };
      const language = lang === "ro" ? "ro" : lang === "tr" ? "tr" : lang === "de" ? "de" : "en";

      if (!withOverrides) {
        await conversation.startSession(baseOpts as any);
        return;
      }

      await conversation.startSession({
        ...baseOpts,
        overrides: {
          agent: {
            prompt: { prompt: personalityPrompts[personality] },
            language,
          },
          tts: { voiceId },
        },
      } as any);
    },
    [conversation, lang, personality, voiceId],
  );

  const connectWithFallbackRetry = useCallback(async () => {
    try {
      await startElevenLabsSession(true);
    } catch (overrideErr) {
      console.warn(
        "ElevenLabs startSession failed with overrides — retrying without. " +
          "Enable 'Security → Overrides' in your agent dashboard to customize voice/prompt.",
        overrideErr,
      );
      await startElevenLabsSession(false);
    }
  }, [startElevenLabsSession]);

  // Start session
  const start = useCallback(async () => {
    console.log("Connecting to ElevenLabs...");
    console.log("Agent ID used: (masked)");
    setConnecting(true);
    setOrbState("listening");
    feedback("tap", "tap");
    try {
      await unlockAudioPlayback();
      await requestMicStream();
      try {
        await connectWithFallbackRetry();
      } catch (firstErr) {
        console.warn("ElevenLabs first connection attempt failed; retrying once.", firstErr);
        toast.error("Voice not connected. Retrying...");
        await connectWithFallbackRetry();
      }
      console.log("Connection success");
      setPttHeld(true);
      playSound("voice-start");
    } catch (e) {
      console.log("Connection fail");
      console.error("start voice failed", e);
      toast.error("Voice not connected. Retrying...");
      setOrbState("error");
      setPttHeld(false);
      setTimeout(() => setOrbState("idle"), 1200);
    } finally {
      setConnecting(false);
    }
  }, [connectWithFallbackRetry, requestMicStream, unlockAudioPlayback]);

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
    setPttHeld(false);
    setOrbState("idle");
  }, [conversation]);

  // Push-to-talk
  const onPttDown = useCallback(() => {
    if (conversation.status !== "connected") return;
    setPttHeld(true);
    feedback("tap", "tap");
  }, [conversation.status]);
  const onPttUp = useCallback(() => {
    setPttHeld(false);
  }, []);

  // Suggestion chips after assistant response
  const lastAssistant = useMemo(
    () => [...transcript].reverse().find((t) => t.role === "assistant")?.text ?? "",
    [transcript],
  );

  const sendChip = useCallback(
    (label: string) => {
      try {
        (conversation as any).sendUserMessage?.(label);
        setTranscript((p) => [...p, { role: "user", text: label, id: cryptoId() }]);
        setOrbState("thinking");
      } catch (e) {
        console.error("chip send failed", e);
      }
    },
    [conversation],
  );

  // Cleanup on close
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

  if (!open) return null;

  const isConnected = conversation.status === "connected";
  const statusLabel =
    orbState === "thinking"
      ? "Thinking…"
      : orbState === "listening"
        ? "Listening…"
        : orbState === "speaking"
          ? "Speaking"
          : isConnected
            ? autoMode
              ? "Auto · ready"
              : "Hold mic to talk"
            : "Tap to start";

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-gradient-to-b from-[#05060c] via-[#0a0e22] to-[#05060c] text-foreground">
      {/* Background ambient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 35%, rgba(99,102,241,0.18), transparent 70%), radial-gradient(40% 40% at 50% 70%, rgba(34,211,238,0.12), transparent 70%)",
        }}
      />
      {/* Top bar */}
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

      {/* Orb */}
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

      {/* Transcript panel */}
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

        {/* Suggestion chips */}
        {lastAssistant && (
          <div className="mt-3 flex flex-wrap gap-2">
            {["Explain more", "Translate", "Summarize", "Create image of this"].map((c) => (
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

      {/* Bottom controls */}
      <footer className="relative z-10 flex items-center justify-between gap-3 px-6 pb-8 pt-2">
        <button
          onClick={stop}
          disabled={!isConnected}
          className="grid h-12 w-12 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
          aria-label="End"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Mic — push to talk OR start/stop */}
        <button
          onPointerDown={isConnected && !autoMode ? onPttDown : undefined}
          onPointerUp={isConnected && !autoMode ? onPttUp : undefined}
          onPointerLeave={isConnected && !autoMode ? onPttUp : undefined}
          onClick={!isConnected ? start : autoMode ? stop : undefined}
          disabled={connecting}
          className={`relative grid h-20 w-20 place-items-center rounded-full transition-transform active:scale-[0.97] ${
            conversation.isSpeaking
              ? "animate-bounce bg-gradient-to-br from-cyan-300 to-sky-500 shadow-[0_0_70px_rgba(34,211,238,0.75)]"
              : pttHeld || (isConnected && autoMode)
                ? "animate-pulse bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-[0_0_65px_rgba(45,212,191,0.65)]"
                : isConnected
                  ? "bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-[0_0_60px_rgba(99,102,241,0.6)]"
                  : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_50px_rgba(124,58,237,0.55)]"
          }`}
          aria-label="Microphone"
        >
          {connecting ? (
            <Loader2 className="h-7 w-7 animate-spin text-white" />
          ) : isConnected ? (
            pttHeld || autoMode ? (
              <Mic className="h-8 w-8 text-white" />
            ) : (
              <MicOff className="h-8 w-8 text-white/90" />
            )
          ) : (
            <Mic className="h-8 w-8 text-white" />
          )}
          {conversation.isSpeaking && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
              <span className="absolute inset-[-10px] animate-pulse rounded-full border border-cyan-200/40" />
            </>
          )}
          {!conversation.isSpeaking && (pttHeld || (isConnected && autoMode)) && (
            <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
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

function cryptoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}
