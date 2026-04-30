import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import {
  ArrowLeft, Send, Mic, Square, Trash2, Play, Pause,
  Plus, Image as ImageIcon, Video as VideoIcon, FileIcon, X, Download,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";

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
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

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
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{contact?.display_name ?? "…"}</p>
          <p className="truncate text-xs text-muted-foreground">@{contact?.username ?? "…"}</p>
        </div>
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
            const isVoice = m.message_type === "voice" && m.audio_url;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow ${
                    mine
                      ? "bg-primary/90 text-primary-foreground rounded-br-sm"
                      : "bg-card/60 border border-border rounded-bl-sm"
                  }`}
                >
                  {isVoice ? (
                    <VoicePlayer url={m.audio_url!} duration={m.duration_seconds} mine={mine} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.message_text}</p>
                  )}
                  <p
                    className={`mt-1 text-[10px] ${
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
            className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground"
            aria-label="Stop recording"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={onSend} className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("typeMessage")}
            disabled={!!voicePreview}
            className="flex-1 rounded-2xl border border-input bg-card/30 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          {text.trim() ? (
            <button
              type="submit"
              disabled={!text.trim() || sending}
              aria-label={t("send")}
              className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={!!voicePreview}
              aria-label="Record voice message"
              className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </form>
      )}
    </div>
  );
}
