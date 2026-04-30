import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import {
  ArrowLeft, Send, Mic, Square, Trash2, Play, Pause,
  Plus, Image as ImageIcon, Video as VideoIcon, FileIcon, X, Download, Phone,
  Gift as GiftIcon,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { useCall } from "@/contexts/CallContext";
import { GiftSheet } from "@/components/chat/GiftSheet";
import { GiftFX } from "@/components/chat/GiftFX";
import { decodeGiftMessage, encodeGiftMessage, type Gift } from "@/components/chat/gifts";

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
};

const MAX_RECORDING_SECONDS = 120;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const VIDEO_WARN_BYTES = 100 * 1024 * 1024;

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

function VoicePlayer({ url, duration, mine }: { url: string; duration: number | null; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => { setPlaying(false); setProgress(0); };
    const onTime = () => setProgress(a.currentTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("timeupdate", onTime);
    return () => {
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("timeupdate", onTime);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
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
      <audio ref={audioRef} src={url} preload="metadata" />
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

  // Load messages + subscribe realtime
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
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [myId, contactId]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

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

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !myId || sending) return;
    setSending(true);
    setText("");
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
      const { data: pub } = supabase.storage.from("voice-messages").getPublicUrl(path);
      const audioUrl = pub.publicUrl;

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
      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
      const url = pub.publicUrl;

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
      <header className="flex items-center gap-3">
        <Link
          to="/contacts"
          aria-label="Back"
          className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar url={contact?.avatar_url ?? null} name={contact?.display_name ?? "?"} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{contact?.display_name ?? "…"}</p>
          <p className="truncate text-xs text-muted-foreground">@{contact?.username ?? "…"}</p>
        </div>
        <button
          type="button"
          onClick={() => { if (contact) void startCall(contactId); }}
          disabled={!contact || inCall}
          aria-label="Audio call"
          className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 text-primary disabled:opacity-40"
          style={{ boxShadow: contact && !inCall ? "var(--shadow-glow)" : undefined }}
        >
          <Phone className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => { if (contact) void startVideoCall(contactId); }}
          disabled={!contact || inCall}
          aria-label="Video call"
          className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 text-primary disabled:opacity-40"
          style={{ boxShadow: contact && !inCall ? "var(--shadow-glow)" : undefined }}
        >
          <VideoIcon className="h-5 w-5" />
        </button>
      </header>

      <div
        ref={scrollRef}
        className="my-4 flex-1 space-y-2 overflow-y-auto pr-1"
        style={{ maxHeight: "calc(100vh - 14rem)" }}
      >
        {grouped.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground">No messages yet — say hello 👋</p>
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
            return (
              <div key={m.id} className={`msg-in flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] ${isMedia ? "p-1" : "px-3.5 py-2"} rounded-3xl text-sm backdrop-blur-xl ${
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
                  <p
                    className={`${isMedia ? "px-2 pb-1 pt-1" : "mt-1"} text-[10px] ${
                      mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {fmtTime(m.created_at)}
                    {mine ? " · Delivered" : ""}
                  </p>
                </div>
              </div>
            );
          })
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
              onChange={(e) => setText(e.target.value)}
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
    </div>
  );
}
