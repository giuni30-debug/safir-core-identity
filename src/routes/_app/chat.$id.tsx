import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import {
  ArrowLeft, Send, Mic, Square, Trash2, Play, Pause,
  Plus, Image as ImageIcon, Video as VideoIcon, FileIcon, X, Download, Phone,
  Gift as GiftIcon, Check, CheckCheck, SmilePlus,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { useCall } from "@/contexts/CallContext";
import { GiftSheet } from "@/components/chat/GiftSheet";
import { GiftFX } from "@/components/chat/GiftFX";
import { decodeGiftMessage, encodeGiftMessage, type Gift } from "@/components/chat/gifts";
import { usePeerPresence, formatLastSeen } from "@/hooks/usePresence";
import { useTypingIndicator } from "@/hooks/useTyping";
import { useReactions } from "@/hooks/useReactions";
import { playSound, vibrate } from "@/lib/sound";

export const Route = createFileRoute("/_app/chat/$id")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "Chat — Safir Private Life" },
      { name: "description", content: "Private conversation." },
    ],
  }),
});

type Message = {
  id: string;
  sender_user_id: string;
  receiver_user_id: string;
  message_text: string | null;
  message_type: string;
  audio_url: string | null;
  duration_seconds: number | null;
  media_url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
};

const MAX_RECORDING_SECONDS = 120;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const VIDEO_WARN_BYTES = 100 * 1024 * 1024;
const VOICE_BUCKET = "voice-messages";

type WebkitAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function extractVoiceObjectPath(value: string) {
  if (!value) return null;
  const marker = `/${VOICE_BUCKET}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) {
    const rawPath = value.slice(markerIndex + marker.length).split("?")[0];
    try {
      return decodeURIComponent(rawPath);
    } catch {
      return rawPath;
    }
  }
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return value.replace(/^\/+/, "");
  }
  return null;
}

async function createPlayableVoiceUrl(storedUrl: string) {
  const path = extractVoiceObjectPath(storedUrl);
  if (!path) return storedUrl;
  const { data, error } = await supabase.storage
    .from(VOICE_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (error || !data?.signedUrl) {
    console.error("voice signed url error", error);
    return storedUrl;
  }
  return data.signedUrl;
}

function VoicePlayer({ url, duration, mine }: { url: string; duration: number | null; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playableUrl, setPlayableUrl] = useState(url);

  useEffect(() => {
    let cancelled = false;
    setPlayableUrl(url);
    void createPlayableVoiceUrl(url).then((nextUrl) => {
      if (!cancelled) setPlayableUrl(nextUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => { setPlaying(false); setProgress(0); };
    const onTime = () => setProgress(a.currentTime);
    const onError = () => {
      setPlaying(false);
      void createPlayableVoiceUrl(url).then((nextUrl) => setPlayableUrl(nextUrl));
    };
    a.addEventListener("ended", onEnd);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("error", onError);
    };
  }, [url]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else {
      try {
        await a.play();
        setPlaying(true);
      } catch (err) {
        console.error("voice play error", err);
        const nextUrl = await createPlayableVoiceUrl(url);
        setPlayableUrl(nextUrl);
        window.setTimeout(() => {
          audioRef.current?.play().then(() => setPlaying(true)).catch((e) => {
            console.error("voice retry play error", e);
            setPlaying(false);
          });
        }, 50);
      }
    }
  };

  const total = duration ?? 0;
  const pct = total > 0 ? Math.min(100, (progress / total) * 100) : 0;

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <button
        type="button"
        onClick={toggle}
        className={`grid h-8 w-8 place-items-center rounded-full ${
          mine ? "bg-primary-foreground/20" : "bg-primary/80 text-primary-foreground"
        }`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex-1">
        <div className={`h-1 rounded-full ${mine ? "bg-primary-foreground/30" : "bg-muted"}`}>
          <div
            className={`h-full rounded-full ${mine ? "bg-primary-foreground" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="text-[10px] tabular-nums opacity-80">
        {formatDuration(playing ? progress : total)}
      </span>
      <audio ref={audioRef} src={playableUrl} preload="metadata" playsInline />
    </div>
  );
}

function ChatPage() {
  const { t, user } = useApp();
  const { id: contactId } = Route.useParams();
  const myId = user?.id ?? null;
  const { startCall, startVideoCall, inCall } = useCall();

  const [contact, setContact] = useState<{
    display_name: string; username: string; avatar_url: string | null;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voicePreview, setVoicePreview] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);
  const cancelRecordRef = useRef<boolean>(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Attachment state
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<
    | { kind: "image" | "video"; file: File; url: string }
    | { kind: "file"; file: File }
    | null
  >(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Gift state
  const [giftOpen, setGiftOpen] = useState(false);
  const [activeGift, setActiveGift] = useState<Gift | null>(null);
  const lastSeenGiftId = useRef<string | null>(null);

  // Reaction picker state
  const [reactionFor, setReactionFor] = useState<string | null>(null);

  // Real-time presence + typing + reactions
  const presence = usePeerPresence(contactId);
  const { peerTyping, notifyTyping, stopTyping } = useTypingIndicator(myId, contactId);
  const { byMessage: reactionsByMsg, toggle: toggleReaction } = useReactions(myId, contactId);

  // Load contact profile
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("id", contactId)
        .maybeSingle();
      setContact(data ?? null);
    })();
  }, [contactId]);

  // Load messages + subscribe realtime (INSERT + UPDATE for read receipts)
  useEffect(() => {
    if (!myId || !contactId) return;
    let active = true;

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_user_id.eq.${myId},receiver_user_id.eq.${contactId}),and(sender_user_id.eq.${contactId},receiver_user_id.eq.${myId})`
        )
        .order("created_at", { ascending: true });
      if (active && data) setMessages(data as Message[]);
    })();

    const channel = supabase
      .channel(`chat:${[myId, contactId].sort().join(":")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const inThread =
            (m.sender_user_id === myId && m.receiver_user_id === contactId) ||
            (m.sender_user_id === contactId && m.receiver_user_id === myId);
          if (!inThread) return;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            // Play receive sound only for incoming messages from peer
            if (m.sender_user_id === contactId) {
              playSound("receive");
              vibrate("light");
            }
            return [...prev, m];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const inThread =
            (m.sender_user_id === myId && m.receiver_user_id === contactId) ||
            (m.sender_user_id === contactId && m.receiver_user_id === myId);
          if (!inThread) return;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [myId, contactId]);

  // Mark incoming messages as delivered + read whenever the chat is open
  useEffect(() => {
    if (!myId || !contactId || messages.length === 0) return;
    if (document.visibilityState === "hidden") return;
    const now = new Date().toISOString();
    const toMark = messages.filter(
      (m) => m.receiver_user_id === myId && m.sender_user_id === contactId && !m.read_at
    );
    if (toMark.length === 0) return;
    const ids = toMark.map((m) => m.id);
    // Optimistic local update
    setMessages((prev) =>
      prev.map((m) =>
        ids.includes(m.id) ? { ...m, delivered_at: m.delivered_at ?? now, read_at: now } : m
      )
    );
    void supabase
      .from("messages")
      .update({ delivered_at: now, read_at: now })
      .in("id", ids);
  }, [messages, myId, contactId]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Auto-play cinematic FX when a new gift message arrives (incoming or my own)
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (lastSeenGiftId.current === last.id) return;
    lastSeenGiftId.current = last.id;
    const g = decodeGiftMessage(last.message_text);
    if (g) setActiveGift(g);
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMediaStream();
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      if (voicePreview?.url) URL.revokeObjectURL(voicePreview.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const unlockAudioPlayback = async () => {
    const AudioContextCtor =
      window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  };

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !myId || sending) return;
    setSending(true);
    setText("");
    stopTyping();
    playSound("send");
    vibrate("light");
    const { error } = await supabase
      .from("messages")
      .insert({
        sender_user_id: myId,
        receiver_user_id: contactId,
        message_text: body,
        message_type: "text",
      });
    if (error) {
      console.error("send error", error);
      setText(body);
    }
    setSending(false);
  };

  const sendGift = async (g: Gift) => {
    if (!myId || sending) return;
    setSending(true);
    // Optimistic local FX so sender sees it immediately
    setActiveGift(g);
    const { error } = await supabase.from("messages").insert({
      sender_user_id: myId,
      receiver_user_id: contactId,
      message_text: encodeGiftMessage(g),
      message_type: "text",
    });
    if (error) console.error("gift send error", error);
    setSending(false);
  };

  // ---- Voice recording ----
  const startRecording = async () => {
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      recordedChunksRef.current = [];
      cancelRecordRef.current = false;

      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        const duration = Math.min(
          MAX_RECORDING_SECONDS,
          Math.round((Date.now() - recordStartRef.current) / 1000)
        );
        stopMediaStream();
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        if (cancelRecordRef.current) {
          recordedChunksRef.current = [];
          setRecording(false);
          setRecordSeconds(0);
          return;
        }
        const blob = new Blob(recordedChunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setVoicePreview({ blob, url, duration: Math.max(1, duration) });
        setRecording(false);
        setRecordSeconds(0);
      };

      recordStartRef.current = Date.now();
      mr.start();
      setRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = window.setInterval(() => {
        const elapsed = Math.round((Date.now() - recordStartRef.current) / 1000);
        setRecordSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS) stopRecording(false);
      }, 250);
    } catch (err) {
      console.error("mic error", err);
      setPermissionError("Microphone permission is required");
      stopMediaStream();
    }
  };

  const stopRecording = (cancel: boolean) => {
    cancelRecordRef.current = cancel;
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    else {
      stopMediaStream();
      setRecording(false);
      setRecordSeconds(0);
    }
  };

  const discardPreview = () => {
    if (voicePreview?.url) URL.revokeObjectURL(voicePreview.url);
    setVoicePreview(null);
    setPreviewPlaying(false);
  };

  const togglePreviewPlay = () => {
    const a = previewAudioRef.current;
    if (!a) return;
    if (previewPlaying) { a.pause(); setPreviewPlaying(false); }
    else { a.play(); setPreviewPlaying(true); }
  };

  const sendVoice = async () => {
    if (!voicePreview || !myId || sending) return;
    setSending(true);
    try {
      const ext = voicePreview.blob.type.includes("mp4") ? "m4a" : "webm";
      const path = `${myId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("voice-messages")
        .upload(path, voicePreview.blob, {
          contentType: voicePreview.blob.type || "audio/webm",
          upsert: false,
        });
      if (upErr) throw upErr;
      // Bucket is private — sign a long-lived URL (10 years).
      const { data: signed, error: signErr } = await supabase.storage
        .from("voice-messages")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed) throw signErr ?? new Error("sign failed");
      const audioUrl = signed.signedUrl;

      const { error: insErr } = await supabase.from("messages").insert({
        sender_user_id: myId,
        receiver_user_id: contactId,
        message_type: "voice",
        audio_url: audioUrl,
        duration_seconds: voicePreview.duration,
        message_text: null,
      });
      if (insErr) throw insErr;
      discardPreview();
    } catch (err) {
      console.error("voice send error", err);
    } finally {
      setSending(false);
    }
  };

  // ---- Attachments ----
  const pickAttachment = (kind: "image" | "video" | "file") => {
    setAttachError(null);
    setAttachMenuOpen(false);
    if (kind === "image") imageInputRef.current?.click();
    else if (kind === "video") videoInputRef.current?.click();
    else fileInputRef.current?.click();
  };

  const onAttachChange = (
    kind: "image" | "video" | "file",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const limit =
      kind === "image" ? MAX_IMAGE_BYTES : kind === "video" ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;
    if (file.size > limit) {
      if (kind === "video") {
        setAttachError("Video is too large. Maximum size is 300MB.");
      } else if (kind === "image") {
        setAttachError("Image is too large. Maximum size is 25MB.");
      } else {
        setAttachError("File is too large. Maximum size is 100MB.");
      }
      return;
    }
    if (kind === "video" && file.size > VIDEO_WARN_BYTES) {
      setAttachError("Large video. Upload may take longer.");
    } else {
      setAttachError(null);
    }
    if (attachment && "url" in attachment) URL.revokeObjectURL(attachment.url);
    if (kind === "file") {
      setAttachment({ kind: "file", file });
    } else {
      setAttachment({ kind, file, url: URL.createObjectURL(file) });
    }
  };

  const discardAttachment = () => {
    if (attachment && "url" in attachment) URL.revokeObjectURL(attachment.url);
    setAttachment(null);
    setAttachError(null);
  };

  const sendAttachment = async () => {
    if (!attachment || !myId || sending) return;
    setSending(true);
    try {
      const file = attachment.file;
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${myId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("chat-media")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from("chat-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed) throw signErr ?? new Error("sign failed");
      const url = signed.signedUrl;

      const { error: insErr } = await supabase.from("messages").insert({
        sender_user_id: myId,
        receiver_user_id: contactId,
        message_type: attachment.kind,
        media_url: url,
        file_name: file.name,
        file_size: file.size,
        message_text: null,
      });
      if (insErr) throw insErr;
      discardAttachment();
    } catch (err) {
      console.error("attachment send error", err);
      setAttachError("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const grouped = useMemo(() => messages, [messages]);

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col animate-[fade-in_0.4s_ease-out]">
      <header
        className="relative flex items-center gap-2.5 rounded-3xl border px-3 py-2.5"
        style={{
          borderColor: "color-mix(in oklab, var(--theme-accent) 30%, transparent)",
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--theme-accent) 10%, transparent), oklch(1 0 0 / 3%))",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          boxShadow:
            "0 0 18px color-mix(in oklab, var(--theme-accent) 22%, transparent), inset 0 1px 0 oklch(1 0 0 / 8%), 0 8px 28px oklch(0 0 0 / 45%)",
        }}
      >
        {/* Soft moving glass reflection across the header */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
          style={{
            background:
              "linear-gradient(120deg, transparent 30%, oklch(1 0 0 / 10%) 50%, transparent 70%)",
            backgroundSize: "200% 100%",
            animation: "wave-drift 6s linear infinite",
            mixBlendMode: "screen",
          }}
        />

        <Link
          to="/contacts"
          aria-label="Back"
          className="press-glow relative grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        {/* Avatar with animated neon ring + online dot */}
        <div className="relative shrink-0">
          <span
            aria-hidden
            className="absolute inset-[-3px] rounded-full"
            style={{
              background:
                "conic-gradient(from var(--neon-angle, 0deg), var(--theme-accent), color-mix(in oklab, var(--theme-accent) 30%, transparent), var(--theme-accent))",
              animation: "neon-rotate 6s linear infinite",
              padding: 2,
              WebkitMask:
                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              maskComposite: "exclude",
              filter: "drop-shadow(0 0 6px var(--theme-accent))",
            }}
          />
          <Avatar url={contact?.avatar_url ?? null} name={contact?.display_name ?? "?"} size={40} />
          {/* Online dot driven by real presence */}
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2"
            style={{
              background: presence.isOnline ? "#22c55e" : "#6b7280",
              boxShadow: presence.isOnline ? "0 0 8px #22c55e" : "none",
              ["--tw-ring-color" as any]: "var(--background)",
              animation: presence.isOnline ? "neon-pulse 2.4s ease-in-out infinite" : undefined,
            }}
          />
        </div>

        <div className="relative min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            style={{
              color: "#fff",
              textShadow: "0 0 10px color-mix(in oklab, var(--theme-accent) 45%, transparent)",
            }}
          >
            {contact?.display_name ?? "…"}
          </p>
          <p className="text-soft flex items-center gap-1 truncate text-xs">
            {peerTyping ? (
              <span className="flex items-center gap-1" style={{ color: "var(--theme-accent)" }}>
                <span>{t("typing")}</span>
                <TypingDots />
              </span>
            ) : presence.isOnline ? (
              <span style={{ color: "#22c55e" }}>● {t("online")}</span>
            ) : (
              <span>{formatLastSeen(presence.lastSeen, t)}</span>
            )}
          </p>
        </div>

        <FloatingHeaderButton
          onClick={() => { if (contact) void startCall(contactId); }}
          disabled={!contact || inCall}
          ariaLabel="Audio call"
        >
          <Phone className="h-5 w-5" />
        </FloatingHeaderButton>
        <FloatingHeaderButton
          onClick={() => { if (contact) void startVideoCall(contactId); }}
          disabled={!contact || inCall}
          ariaLabel="Video call"
        >
          <VideoIcon className="h-5 w-5" />
        </FloatingHeaderButton>
        <FloatingHeaderButton
          onClick={() => setGiftOpen(true)}
          disabled={!contact}
          ariaLabel="Send gift"
          intense
        >
          <GiftIcon className="h-5 w-5" />
        </FloatingHeaderButton>
      </header>

      <div
        ref={scrollRef}
        className="my-4 flex-1 space-y-2 overflow-y-auto pr-1"
        style={{ maxHeight: "calc(100vh - 14rem)" }}
      >
        {grouped.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground">{t("noMessages")}</p>
          </div>
        ) : (
          grouped.map((m) => {
            const mine = m.sender_user_id === myId;
            const type = m.message_type;
            const isVoice = type === "voice" && m.audio_url;
            const isImage = type === "image" && m.media_url;
            const isVideo = type === "video" && m.media_url;
            const isFile = type === "file" && m.media_url;
            const isMedia = isImage || isVideo;
            const giftMsg = decodeGiftMessage(m.message_text);
            if (giftMsg) {
              return (
                <div key={m.id} className={`msg-in flex ${mine ? "justify-end" : "justify-start"}`}>
                  <button
                    type="button"
                    onClick={() => setActiveGift(giftMsg)}
                    className="flex items-center gap-2.5 rounded-3xl px-3.5 py-2 text-sm transition active:scale-95"
                    style={{
                      background: `linear-gradient(135deg, color-mix(in oklab, ${giftMsg.color} 22%, transparent), color-mix(in oklab, ${giftMsg.color} 6%, transparent))`,
                      border: `2px solid ${giftMsg.color}`,
                      boxShadow: `0 0 18px color-mix(in oklab, ${giftMsg.color} 55%, transparent), 0 6px 18px oklch(0 0 0 / 45%)`,
                      color: giftMsg.color,
                    }}
                  >
                    <span style={{ fontSize: 28, filter: `drop-shadow(0 0 6px ${giftMsg.color})` }}>
                      {giftMsg.emoji}
                    </span>
                    <span className="flex flex-col items-start leading-tight">
                      <span className="font-semibold">{mine ? "You sent" : "Received"} {giftMsg.name}</span>
                      <span className="text-[10px] opacity-80 tabular-nums">€{giftMsg.price.toFixed(2)} · tap to replay</span>
                    </span>
                  </button>
                </div>
              );
            }
            const msgReactions = reactionsByMsg.get(m.id) ?? [];
            // group reactions by emoji
            const grouped: Record<string, { count: number; mine: boolean }> = {};
            for (const r of msgReactions) {
              if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
              grouped[r.emoji].count += 1;
              if (r.user_id === myId) grouped[r.emoji].mine = true;
            }
            const isPickerOpen = reactionFor === m.id;
            return (
              <div key={m.id} className={`msg-in flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="group relative max-w-[78%]">
                  <button
                    type="button"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setReactionFor(isPickerOpen ? null : m.id);
                    }}
                    onDoubleClick={() => setReactionFor(isPickerOpen ? null : m.id)}
                    className="block w-full cursor-default text-left"
                    aria-label="Message"
                  >
                    <div
                      className={`${isMedia ? "p-1" : "px-3.5 py-2"} rounded-3xl text-sm backdrop-blur-xl ${
                        mine ? "rounded-br-md" : "rounded-bl-md bg-white/5"
                      }`}
                      style={
                        mine
                          ? {
                              background:
                                "linear-gradient(135deg, oklch(0.86 0.17 90), color-mix(in oklab, oklch(0.86 0.17 90) 65%, #000))",
                              border: "2px solid oklch(0.86 0.17 90)",
                              boxShadow:
                                "0 0 14px color-mix(in oklab, oklch(0.86 0.17 90) 55%, transparent), 0 6px 18px oklch(0 0 0 / 45%)",
                              color: "#1a1500",
                            }
                          : {
                              border: "2px solid color-mix(in oklab, oklch(0.82 0.16 200) 70%, transparent)",
                              boxShadow:
                                "0 0 14px color-mix(in oklab, oklch(0.82 0.16 200) 45%, transparent), 0 4px 14px oklch(0 0 0 / 40%)",
                            }
                      }
                    >
                      {isVoice ? (
                        <VoicePlayer url={m.audio_url!} duration={m.duration_seconds} mine={mine} />
                      ) : isImage ? (
                        <a href={m.media_url!} target="_blank" rel="noreferrer" className="block">
                          <img
                            src={m.media_url!}
                            alt={m.file_name ?? "image"}
                            className="max-h-72 w-auto rounded-xl object-cover"
                            loading="lazy"
                          />
                        </a>
                      ) : isVideo ? (
                        <video
                          src={m.media_url!}
                          controls
                          preload="metadata"
                          className="max-h-72 w-full rounded-xl"
                        />
                      ) : isFile ? (
                        <a
                          href={m.media_url!}
                          target="_blank"
                          rel="noreferrer"
                          download={m.file_name ?? undefined}
                          className={`flex items-center gap-2 rounded-xl px-2 py-1 ${
                            mine ? "bg-primary-foreground/15" : "bg-muted/40"
                          }`}
                        >
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                              mine ? "bg-primary-foreground/20" : "bg-primary/80 text-primary-foreground"
                            }`}
                          >
                            <FileIcon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">
                              {m.file_name ?? "File"}
                            </span>
                            <span className="block text-[10px] opacity-70">
                              {m.file_size != null ? formatBytes(m.file_size) : ""}
                            </span>
                          </span>
                          <Download className="h-4 w-4 opacity-80" />
                        </a>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.message_text}</p>
                      )}
                      <div
                        className={`${isMedia ? "px-2 pb-1 pt-1" : "mt-1"} flex items-center justify-end gap-1 text-[10px] ${
                          mine ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                        style={mine ? { color: "oklch(0.18 0.05 90 / 75%)" } : undefined}
                      >
                        <span>{fmtTime(m.created_at)}</span>
                        {mine && <MessageStatus message={m} />}
                      </div>
                    </div>
                  </button>

                  {/* Add-reaction trigger */}
                  <button
                    type="button"
                    aria-label="Add reaction"
                    onClick={() => setReactionFor(isPickerOpen ? null : m.id)}
                    className={`absolute -top-2 ${mine ? "-left-2" : "-right-2"} grid h-6 w-6 place-items-center rounded-full border border-glass-border bg-card/80 opacity-0 backdrop-blur-md transition group-hover:opacity-100 hover:opacity-100`}
                  >
                    <SmilePlus className="h-3 w-3" />
                  </button>

                  {/* Reaction chips */}
                  {Object.keys(grouped).length > 0 && (
                    <div
                      className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}
                    >
                      {Object.entries(grouped).map(([emoji, info]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => void toggleReaction(m.id, emoji)}
                          className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] backdrop-blur-md transition active:scale-95 ${
                            info.mine
                              ? "border-primary/60 bg-primary/15"
                              : "border-glass-border bg-card/40"
                          }`}
                          style={
                            info.mine
                              ? {
                                  boxShadow:
                                    "0 0 8px color-mix(in oklab, var(--theme-accent) 40%, transparent)",
                                }
                              : undefined
                          }
                        >
                          <span>{emoji}</span>
                          {info.count > 1 && (
                            <span className="tabular-nums opacity-80">{info.count}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Reaction picker popover */}
                  {isPickerOpen && (
                    <>
                      <button
                        type="button"
                        aria-hidden
                        onClick={() => setReactionFor(null)}
                        className="fixed inset-0 z-10 cursor-default bg-transparent"
                      />
                      <div
                        className={`absolute z-20 ${mine ? "right-0" : "left-0"} -top-12 flex items-center gap-1 rounded-full border border-glass-border bg-card/90 px-2 py-1 backdrop-blur-xl animate-[scale-in_0.15s_ease-out]`}
                        style={{
                          boxShadow:
                            "0 0 18px color-mix(in oklab, var(--theme-accent) 40%, transparent), 0 6px 18px oklch(0 0 0 / 45%)",
                        }}
                      >
                        {["❤️", "👍", "🔥", "😂", "😮", "😢"].map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => {
                              void toggleReaction(m.id, e);
                              setReactionFor(null);
                            }}
                            className="grid h-8 w-8 place-items-center rounded-full text-base transition hover:scale-125 active:scale-95"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        {peerTyping && (
          <div className="msg-in flex justify-start">
            <div
              className="flex items-center gap-1 rounded-3xl rounded-bl-md bg-white/5 px-3.5 py-2 backdrop-blur-xl"
              style={{
                border: "2px solid color-mix(in oklab, oklch(0.82 0.16 200) 70%, transparent)",
                boxShadow:
                  "0 0 14px color-mix(in oklab, oklch(0.82 0.16 200) 35%, transparent)",
              }}
            >
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      {permissionError && (
        <div className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {permissionError}
        </div>
      )}

      {voicePreview && (
        <div className="mb-2 flex items-center gap-2 rounded-2xl border border-border bg-card/40 px-3 py-2">
          <button
            type="button"
            onClick={togglePreviewPlay}
            className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"
            aria-label={previewPlaying ? "Pause" : "Play"}
          >
            {previewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <span className="flex-1 text-xs tabular-nums">
            Voice · {formatDuration(voicePreview.duration)}
          </span>
          <button
            type="button"
            onClick={discardPreview}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card/40 text-destructive"
            aria-label="Delete recording"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={sendVoice}
            disabled={sending}
            className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Send voice"
          >
            <Send className="h-4 w-4" />
          </button>
          <audio
            ref={previewAudioRef}
            src={voicePreview.url}
            onEnded={() => setPreviewPlaying(false)}
            preload="metadata"
          />
        </div>
      )}

      {attachError && (
        <div className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {attachError}
        </div>
      )}

      {attachment && (
        <div className="mb-2 rounded-2xl border border-border bg-card/40 p-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 overflow-hidden">
              {attachment.kind === "image" ? (
                <img
                  src={attachment.url}
                  alt={attachment.file.name}
                  className="max-h-48 w-auto rounded-xl object-cover"
                />
              ) : attachment.kind === "video" ? (
                <video
                  src={attachment.url}
                  controls
                  preload="metadata"
                  className="max-h-48 w-full rounded-xl"
                />
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-2">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/80 text-primary-foreground">
                    <FileIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{attachment.file.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatBytes(attachment.file.size)}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={discardAttachment}
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card/40 text-destructive"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={sendAttachment}
                disabled={sending}
                className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {recording ? (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-3">
          <span className="grid h-3 w-3 place-items-center">
            <span className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
          </span>
          <span className="flex-1 text-sm tabular-nums">
            Recording · {formatDuration(recordSeconds)} / {formatDuration(MAX_RECORDING_SECONDS)}
          </span>
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card/40"
            aria-label="Cancel recording"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="neon-circle mic-pulse grid h-10 w-10 place-items-center rounded-full"
            aria-label="Stop recording"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={onSend} className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setAttachMenuOpen((v) => !v)}
              disabled={!!voicePreview || !!attachment}
              aria-label="Attach"
              className="grid h-12 w-12 place-items-center rounded-full border border-glass-border bg-white/5 backdrop-blur-xl disabled:opacity-40"
            >
              <Plus className={`h-5 w-5 transition-transform ${attachMenuOpen ? "rotate-45" : ""}`} />
            </button>
            {attachMenuOpen && (
              <>
                <button
                  type="button"
                  aria-hidden
                  onClick={() => setAttachMenuOpen(false)}
                  className="fixed inset-0 z-10 cursor-default bg-transparent"
                />
                <div className="absolute bottom-14 left-0 z-20 w-44 overflow-hidden rounded-2xl border border-border bg-card/95 shadow-xl backdrop-blur">
                  <button
                    type="button"
                    onClick={() => pickAttachment("image")}
                    className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <ImageIcon className="h-4 w-4 text-primary" /> Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => pickAttachment("video")}
                    className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <VideoIcon className="h-4 w-4 text-primary" /> Video
                  </button>
                  <button
                    type="button"
                    onClick={() => pickAttachment("file")}
                    className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <FileIcon className="h-4 w-4 text-primary" /> File
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="input-pill flex flex-1 items-center px-4">
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value.length > 0) notifyTyping();
                else stopTyping();
              }}
              onBlur={() => stopTyping()}
              placeholder={t("typeMessage")}
              disabled={!!voicePreview || !!attachment}
              className="flex-1 bg-transparent py-3 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
          </div>
          {text.trim() ? (
            <button
              type="submit"
              disabled={!text.trim() || sending}
              aria-label={t("send")}
              className="neon-circle grid h-12 w-12 place-items-center rounded-full disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={!!voicePreview || !!attachment}
              aria-label="Record voice message"
              className="neon-circle grid h-12 w-12 place-items-center rounded-full disabled:opacity-40"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </form>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onAttachChange("image", e)}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => onAttachChange("video", e)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.zip,.rar,.7z,.xls,.xlsx,.ppt,.pptx,.csv,.json,application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="hidden"
        onChange={(e) => onAttachChange("file", e)}
      />

      <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} onSend={(g) => void sendGift(g)} />
      {activeGift && <GiftFX gift={activeGift} onDone={() => setActiveGift(null)} />}
    </div>
  );
}

function FloatingHeaderButton({
  children, onClick, disabled, ariaLabel, intense,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  intense?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="press-glow relative grid h-10 w-10 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
      style={{
        background: intense
          ? "linear-gradient(135deg, color-mix(in oklab, var(--theme-accent) 35%, transparent), color-mix(in oklab, var(--theme-accent) 8%, transparent))"
          : "linear-gradient(135deg, oklch(1 0 0 / 8%), oklch(1 0 0 / 3%))",
        border: `1.5px solid color-mix(in oklab, var(--theme-accent) ${intense ? 75 : 50}%, transparent)`,
        color: "var(--theme-accent)",
        boxShadow: intense
          ? "0 0 18px color-mix(in oklab, var(--theme-accent) 60%, transparent), inset 0 0 10px color-mix(in oklab, var(--theme-accent) 25%, transparent)"
          : "0 0 12px color-mix(in oklab, var(--theme-accent) 35%, transparent), inset 0 1px 0 oklch(1 0 0 / 12%)",
      }}
    >
      {children}
    </button>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.5">
      <span className="h-1 w-1 rounded-full bg-current animate-[neon-pulse_1.2s_ease-in-out_infinite]" style={{ animationDelay: "0ms" }} />
      <span className="h-1 w-1 rounded-full bg-current animate-[neon-pulse_1.2s_ease-in-out_infinite]" style={{ animationDelay: "180ms" }} />
      <span className="h-1 w-1 rounded-full bg-current animate-[neon-pulse_1.2s_ease-in-out_infinite]" style={{ animationDelay: "360ms" }} />
    </span>
  );
}

function MessageStatus({ message }: { message: Message }) {
  // 1 check = sent, 2 checks = delivered, 2 blue checks = seen
  const seen = !!message.read_at;
  const delivered = !!message.delivered_at || seen;
  if (seen) {
    return (
      <CheckCheck
        className="h-3 w-3"
        style={{ color: "oklch(0.65 0.2 230)", filter: "drop-shadow(0 0 4px oklch(0.65 0.2 230 / 70%))" }}
        aria-label="Seen"
      />
    );
  }
  if (delivered) return <CheckCheck className="h-3 w-3 opacity-80" aria-label="Delivered" />;
  return <Check className="h-3 w-3 opacity-70" aria-label="Sent" />;
}

