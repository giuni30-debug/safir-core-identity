import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useApp } from "@/contexts/AppContext";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Send, Paperclip, Image as ImageIcon, Sparkles,
  Plus, Wand2, Square, Search, Brain,
  History, Trash2, Settings as SettingsIcon, MessageSquare,
  Mic, Volume2, VolumeX, Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAiMemory, detectMemoryCandidates,
  createConversation, appendMessage,
  listConversations, loadMessages, deleteConversation,
  type AiConversation,
} from "@/hooks/useAiMemory";

export const Route = createFileRoute("/_app/assistant")({
  component: AssistantPage,
  head: () => ({
    meta: [
      { title: "All Assist AI — Safir" },
      { name: "description", content: "Premium AI assistant — chat, documents, images." },
    ],
  }),
});

type Msg = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  intent?: "chat" | "doc" | "image" | "translate" | "code";
  showSources?: boolean;
};

function detectIntent(text: string): Msg["intent"] {
  const t = text.toLowerCase();
  if (/\[.+\]\s*\(file attached/i.test(text)) return "doc";
  if (/\[.+\]\s*\(image attached/i.test(text)) return "image";
  if (/\b(translate|traduce|çevir|übersetze|traducere)\b/.test(t)) return "translate";
  if (/```|function |const |class |def |import |sql|=>/.test(text)) return "code";
  return "chat";
}

const CHAT_URL  = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const IMAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-image`;
const TTS_URL   = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
const STT_URL   = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-stt`;
const SUPA_KEY  = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const AUTOSPEAK_KEY = "safir.assistant.autospeak.v1";
const REPLY_IN_APPLANG_KEY = "safir.assistant.replyInAppLang.v1";

function AssistantPage() {
  const { t, user, lang } = useApp();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Voice: push-to-talk (browser STT) + auto-speak reply (ElevenLabs TTS)
  const [recording, setRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return true;
    const v = localStorage.getItem(AUTOSPEAK_KEY);
    return v === null ? true : v === "1";
  });
  // Per-chat override: when true (default), AI ALWAYS replies in selected app language.
  // When false, AI mirrors the user's input language.
  const [replyInAppLang, setReplyInAppLang] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return true;
    const v = localStorage.getItem(REPLY_IN_APPLANG_KEY);
    return v === null ? true : v === "1";
  });
  const [speaking, setSpeaking] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(AUTOSPEAK_KEY, autoSpeak ? "1" : "0");
    }
  }, [autoSpeak]);
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(REPLY_IN_APPLANG_KEY, replyInAppLang ? "1" : "0");
    }
  }, [replyInAppLang]);

  const memory = useAiMemory();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);


  async function streamReply(history: Msg[]) {
    setLoading(true);
    let acc = "";
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          ...(SUPA_KEY ? { Authorization: `Bearer ${SUPA_KEY}` } : {}),
        },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          memory: memory.memoryPromptBlock(),
          appLang: lang,
          replyInAppLang,
        }),
      });
      if (resp.status === 503) { toast.error(t("aiNotConnected")); setLoading(false); return; }
      if (resp.status === 429) { toast.error("Rate limit exceeded"); setLoading(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted"); setLoading(false); return; }
      if (!resp.ok || !resp.body) { toast.error(t("aiError")); setLoading(false); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: rd } = await reader.read();
        if (rd) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(j);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              acc += delta;
              setMessages((p) => {
                const copy = [...p];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
      
      // Persist assistant reply (best effort, don't await)
      if (user && activeConvId && acc) {
        void appendMessage(user.id, activeConvId, "assistant", acc);
      }
      // Auto-speak final reply via ElevenLabs TTS (only if enabled & we got text)
      if (autoSpeak && acc.trim()) {
        void speakText(acc);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error(e);
        toast.error(t("aiError"));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  // ---------------- Voice: TTS (ElevenLabs) ----------------
  function stopSpeaking() {
    try { ttsAbortRef.current?.abort(); } catch { /* ignore */ }
    ttsAbortRef.current = null;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
      } catch { /* ignore */ }
      audioRef.current = null;
    }
    setSpeaking(false);
  }

  async function speakText(text: string) {
    // Strip markdown-ish noise so TTS sounds natural
    const clean = text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*_~>#]+/g, " ")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return;
    stopSpeaking();
    const ctrl = new AbortController();
    ttsAbortRef.current = ctrl;
    setSpeaking(true);
    try {
      const resp = await fetch(TTS_URL, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          ...(SUPA_KEY ? { Authorization: `Bearer ${SUPA_KEY}` } : {}),
        },
        body: JSON.stringify({ text: clean }),
      });
      if (!resp.ok) {
        console.error("[tts] failed", resp.status, await resp.text().catch(() => ""));
        setSpeaking(false);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
      };
      audio.onerror = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      await audio.play().catch((err) => {
        console.warn("[tts] play blocked", err);
        setSpeaking(false);
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error("[tts] error", e);
      }
      setSpeaking(false);
    }
  }

  // ---------------- Voice: STT (ElevenLabs Scribe via MediaRecorder) ----------------
  // Tap once to start recording, tap again to stop & auto-send transcribed text.
  const cancelRecRef = useRef(false);

  function pickMime(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    for (const m of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) return m;
    }
    return "";
  }

  async function transcribeBlob(blob: Blob) {
    setTranscribing(true);
    try {
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      fd.append("file", blob, `audio.${ext}`);
      // Auto-detect language (works great for Romanian, English, etc.)
      const resp = await fetch(STT_URL, {
        method: "POST",
        headers: { ...(SUPA_KEY ? { Authorization: `Bearer ${SUPA_KEY}` } : {}) },
        body: fd,
      });
      if (!resp.ok) {
        console.error("[stt] failed", resp.status, await resp.text().catch(() => ""));
        toast.error("Voice transcription failed");
        return;
      }
      const data = await resp.json();
      const text = (data?.text || "").trim();
      if (!text) {
        toast.message("Didn't catch that — try again");
        return;
      }
      setInput("");
      send(text);
    } catch (e) {
      console.error("[stt] exception", e);
      toast.error("Voice transcription failed");
    } finally {
      setTranscribing(false);
    }
  }

  async function startRecording() {
    if (loading || transcribing) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone not supported on this device");
      return;
    }
    stopSpeaking();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = stream;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      cancelRecRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const tracks = mediaStreamRef.current?.getTracks() || [];
        tracks.forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecRef.current = null;
        setRecording(false);
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (cancelRecRef.current) return;
        if (!chunks.length) return;
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1000) {
          toast.message("Recording too short — try again");
          return;
        }
        void transcribeBlob(blob);
      };
      mediaRecRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e: any) {
      console.error("[stt] mic start failed", e);
      if (e?.name === "NotAllowedError") toast.error("Microphone permission denied");
      else toast.error("Could not access microphone");
      setRecording(false);
    }
  }

  function stopRecording() {
    const rec = mediaRecRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch { /* ignore */ }
    }
  }

  function cancelRecording() {
    cancelRecRef.current = true;
    stopRecording();
  }

  function toggleRecording() {
    if (recording) stopRecording();      // stop + auto-send
    else if (transcribing) return;
    else startRecording();
  }

  // Long-press cancels (without sending)
  function onMicContextMenu(e: React.MouseEvent) {
    if (recording) { e.preventDefault(); cancelRecording(); }
  }


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      const rec = mediaRecRef.current;
      if (rec && rec.state !== "inactive") { try { rec.stop(); } catch { /* ignore */ } }
      const tracks = mediaStreamRef.current?.getTracks() || [];
      tracks.forEach((t) => t.stop());
    };
  }, []);


  async function generateImage(prompt: string) {
    setLoading(true);
    setMessages((p) => [...p, { role: "assistant", content: t("aiGenerating") }]);
    try {
      const resp = await fetch(IMAGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(SUPA_KEY ? { Authorization: `Bearer ${SUPA_KEY}` } : {}),
        },
        body: JSON.stringify({ prompt }),
      });
      if (resp.status === 503) { toast.error(t("aiNotConnected")); return; }
      if (resp.status === 429) { toast.error("Rate limit exceeded"); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted"); return; }
      if (!resp.ok) { toast.error(t("aiError")); return; }
      const data = await resp.json();
      setMessages((p) => {
        const copy = [...p];
        copy[copy.length - 1] = {
          role: "assistant",
          content: data.text || "✨",
          imageUrl: data.imageUrl,
        };
        return copy;
      });
    } catch {
      toast.error(t("aiError"));
    } finally {
      setLoading(false);
    }
  }

  async function ensureConversation(firstUserText: string): Promise<string | null> {
    if (!user) return null;
    if (activeConvId) return activeConvId;
    const title = firstUserText.slice(0, 50).replace(/\s+/g, " ").trim() || "New chat";
    const id = await createConversation(user.id, title);
    if (id) setActiveConvId(id);
    return id;
  }

  async function autoSaveMemory(text: string) {
    if (!memory.enabled || !user) return;
    const cands = detectMemoryCandidates(text);
    for (const c of cands) {
      const saved = await memory.addMemory(c.category, c.content);
      if (saved) toast.success(t("aiMemorySaved"), { description: c.content });
    }
  }

  function send(prefill?: string) {
    const text = (prefill ?? input).trim();
    if (!text || loading) return;
    if (!prefill) setInput("");
    if (imageMode) {
      const next: Msg[] = [...messages, { role: "user", content: text, intent: "image" }];
      setMessages(next);
      setImageMode(false);
      generateImage(text);
      // persist user msg
      void (async () => {
        const cid = await ensureConversation(text);
        if (cid && user) await appendMessage(user.id, cid, "user", text);
      })();
      return;
    }
    const intent = detectIntent(text);
    const next: Msg[] = [...messages, { role: "user", content: text, intent }];
    setMessages(next);
    // persist + memory side-effects (don't block UI)
    void (async () => {
      const cid = await ensureConversation(text);
      if (cid && user) await appendMessage(user.id, cid, "user", text);
      void autoSaveMemory(text);
    })();
    streamReply(next);
  }

  function followUp(kind: "simpler" | "details" | "translate" | "summarize", anchor: string) {
    const map = {
      simpler:   `Explain the previous answer in simpler words. Original topic: """${anchor.slice(0, 400)}"""`,
      details:   `Give more in-depth details and concrete examples about your previous answer. Topic: """${anchor.slice(0, 400)}"""`,
      translate: `Translate your previous answer. If it was in English, translate to Romanian; otherwise translate to English. Original: """${anchor.slice(0, 600)}"""`,
      summarize: `Summarize your previous answer in 5 short bullet points. Original: """${anchor.slice(0, 600)}"""`,
    } as const;
    send(map[kind]);
  }

  function searchDeeper() {
    toast.message(t("aiLiveUnavailable"));
  }

  function toggleSources(idx: number) {
    setMessages((p) => p.map((m, i) => (i === idx ? { ...m, showSources: !m.showSources } : m)));
  }

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }


  function onPickFile(e: React.ChangeEvent<HTMLInputElement>, kind: "file" | "image") {
    const file = e.target.files?.[0];
    if (!file) return;
    const note = kind === "image"
      ? `[${file.name}] (image attached — please describe what's in it)`
      : `[${file.name}] (file attached — please summarize / explain its contents)`;
    setInput((p) => (p ? p + "\n" : "") + note);
    e.target.value = "";
    toast.success(file.name);
  }

  const suggestions: { key: string; label: string; prompt: string }[] = [
    { key: "explain",   label: t("aiSugExplain"),   prompt: "Explain this clearly: " },
    { key: "summarize", label: t("aiSugSummarize"), prompt: "Summarize this in 5 bullet points: " },
    { key: "translate", label: t("aiSugTranslate"), prompt: "Translate the following: " },
    { key: "plan",      label: t("aiSugPlan"),      prompt: "Make a step-by-step plan for: " },
  ];

  return (
    <div className="page-enter relative flex h-[100dvh] flex-col">
      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 border-b border-border/40 bg-background/40 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => navigate({ to: "/home" })}
          className="press-glow grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-neon-title text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "var(--theme-accent)" }} />
            {t("aiTitle")}
          </h1>
          <p className="text-soft text-[11px]">{t("aiSubtitle")}</p>
        </div>
        <button
          onClick={async () => {
            if (!user) return;
            setHistoryOpen(true);
            const list = await listConversations(user.id);
            setConversations(list);
          }}
          className="press-glow grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-card/40"
          aria-label={t("aiHistoryTitle")}
          title={t("aiHistoryTitle")}
        >
          <History className="h-5 w-5" />
        </button>
        <button
          onClick={() => {
            setMessages([]); setImageMode(false); setActiveConvId(null);
          }}
          className="press-glow grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-card/40"
          aria-label={t("aiNewChat")}
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {/* History drawer */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setHistoryOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative ml-auto h-full w-[86%] max-w-sm overflow-y-auto bg-background/90 p-4 backdrop-blur-xl"
            style={{ borderLeft: "1px solid color-mix(in oklab, var(--theme-accent) 30%, transparent)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-neon-title text-base flex items-center gap-2">
                <History className="h-4 w-4" style={{ color: "var(--theme-accent)" }} />
                {t("aiHistoryTitle")}
              </h2>
              <Link
                to="/settings"
                onClick={() => setHistoryOpen(false)}
                className="press-glow inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-white"
                title={t("aiMemoryTitle")}
              >
                <SettingsIcon className="h-3 w-3" /> {t("aiMemoryTitle")}
              </Link>
            </div>
            {conversations.length === 0 ? (
              <p className="text-soft text-xs">{t("aiHistoryEmpty")}</p>
            ) : (
              <ul className="space-y-2">
                {conversations.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (!user) return;
                        const msgs = await loadMessages(user.id, c.id);
                        setMessages(msgs.map((m) => ({
                          role: m.role, content: m.content,
                          imageUrl: m.image_url ?? undefined,
                        })));
                        setActiveConvId(c.id);
                        setHistoryOpen(false);
                      }}
                      className="press-glow flex-1 rounded-xl px-3 py-2 text-left glass-card"
                      style={{ border: "1px solid color-mix(in oklab, var(--theme-accent) 22%, transparent)" }}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <MessageSquare className="h-3.5 w-3.5" style={{ color: "var(--theme-accent)" }} />
                        <span className="truncate">{c.title}</span>
                      </div>
                      <div className="text-soft mt-0.5 text-[10px]">
                        {new Date(c.updated_at).toLocaleString()}
                      </div>
                    </button>
                    <button
                      onClick={async () => {
                        if (!user) return;
                        await deleteConversation(user.id, c.id);
                        setConversations((p) => p.filter((x) => x.id !== c.id));
                        if (activeConvId === c.id) { setActiveConvId(null); setMessages([]); }
                      }}
                      className="press-glow grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-card/40 text-red-400"
                      aria-label="delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="mt-10 flex flex-col items-center text-center ai-fade-up">
            {/* Animated AI orb */}
            <div className="relative mb-6 h-32 w-32">
              <div
                className="absolute inset-0 rounded-full opacity-70 orb-rays"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent, color-mix(in oklab, var(--theme-accent) 60%, transparent), transparent 70%)",
                  filter: "blur(14px)",
                }}
              />
              <div
                className="absolute inset-3 rounded-full orb-pulse grid place-items-center"
                style={{
                  background:
                    "radial-gradient(circle at 35% 30%, oklch(1 0 0 / 70%), color-mix(in oklab, var(--theme-accent) 80%, #000) 55%, #000 100%)",
                }}
              >
                <Sparkles className="h-9 w-9 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
              </div>
            </div>
            <h2 className="text-neon-title text-lg">{t("aiWelcome")}</h2>
            <p className="text-soft mt-1 max-w-xs text-xs">{t("aiSubtitle")}</p>

            {/* Suggestion chips */}
            <div className="mt-6 grid grid-cols-2 gap-2 w-full max-w-sm">
              {suggestions.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setInput(s.prompt)}
                  className="press-glow rounded-2xl px-3 py-3 text-xs font-semibold text-left glass-card"
                  style={{
                    border: "1px solid color-mix(in oklab, var(--theme-accent) 30%, transparent)",
                  }}
                >
                  <Wand2 className="h-3.5 w-3.5 mb-1" style={{ color: "var(--theme-accent)" }} />
                  <div className="text-white">{s.label}</div>
                </button>
              ))}
            </div>

            {/* Advanced placeholders */}
            <div className="mt-4 flex gap-2 text-[10px] text-soft">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1">
                <Search className="h-3 w-3" /> {t("aiAdvancedSoon")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1">
                <Brain className="h-3 w-3" /> {t("aiAdvancedSoon")}
              </span>
            </div>
          </div>
        )}

        <ul className="space-y-3">
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            const isStreamingAssistant = m.role === "assistant" && loading && isLast;
            const intentLabel =
              m.intent === "doc" ? t("aiIntentAnalyzeDoc")
              : m.intent === "image" ? t("aiIntentAnalyzeImage")
              : m.intent === "translate" ? t("aiIntentTranslate")
              : m.intent === "code" ? t("aiIntentCode")
              : null;
            return (
              <li key={i} className={`msg-in flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                {m.role === "user" && intentLabel && intentLabel !== t("aiIntentChat") && (
                  <span
                    className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      border: "1px solid color-mix(in oklab, var(--theme-accent) 40%, transparent)",
                      color: "var(--theme-accent)",
                      background: "color-mix(in oklab, var(--theme-accent) 10%, transparent)",
                    }}
                  >
                    <Brain className="h-3 w-3" /> {intentLabel}
                  </span>
                )}
                <div
                  className="max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                  style={
                    m.role === "user"
                      ? {
                          background: "linear-gradient(135deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 60%, #000))",
                          color: "#fff",
                          boxShadow: "0 0 18px color-mix(in oklab, var(--theme-accent) 45%, transparent)",
                        }
                      : {
                          background: "linear-gradient(135deg, oklch(1 0 0 / 6%), oklch(1 0 0 / 2%))",
                          border: "1px solid color-mix(in oklab, var(--theme-accent) 22%, transparent)",
                          backdropFilter: "blur(20px) saturate(160%)",
                          color: "#fff",
                          textShadow: isStreamingAssistant && m.content
                            ? "0 0 8px color-mix(in oklab, var(--theme-accent) 40%, transparent)" : undefined,
                        }
                  }
                >
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt="generated"
                      className="mb-2 w-full rounded-xl"
                      style={{ boxShadow: "0 0 22px color-mix(in oklab, var(--theme-accent) 35%, transparent)" }}
                    />
                  )}
                  {m.content || (isStreamingAssistant ? (
                    <span className="inline-flex items-center gap-2 py-0.5 text-xs" style={{ color: "var(--theme-accent)" }}>
                      <span className="inline-flex gap-1">
                        <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--theme-accent)" }} />
                        <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--theme-accent)" }} />
                        <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--theme-accent)" }} />
                      </span>
                      <span className="font-semibold">{t("aiThinking")}</span>
                    </span>
                  ) : "")}
                </div>

                {/* Assistant: follow-ups + sources */}
                {m.role === "assistant" && m.content && !isStreamingAssistant && (
                  <div className="mt-2 flex w-full max-w-[82%] flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        ["simpler", t("aiFollowExplainSimpler")],
                        ["details", t("aiFollowMoreDetails")],
                        ["summarize", t("aiFollowSummarize")],
                        ["translate", t("aiFollowTranslate")],
                      ] as const).map(([k, label]) => (
                        <button
                          key={k}
                          onClick={() => followUp(k, m.content)}
                          className="press-glow rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-white"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => toggleSources(i)}
                        className="press-glow inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-white"
                      >
                        <Brain className="h-3 w-3" /> {t("aiSources")}
                      </button>
                      <button
                        onClick={searchDeeper}
                        className="press-glow inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                        style={{
                          border: "1px solid color-mix(in oklab, var(--theme-accent) 45%, transparent)",
                          color: "var(--theme-accent)",
                          background: "color-mix(in oklab, var(--theme-accent) 10%, transparent)",
                        }}
                      >
                        <Search className="h-3 w-3" /> {t("aiSearchDeeper")}
                      </button>
                    </div>
                    {m.showSources && (
                      <div
                        className="rounded-xl px-3 py-2 text-[11px]"
                        style={{
                          border: "1px solid color-mix(in oklab, var(--theme-accent) 25%, transparent)",
                          background: "oklch(1 0 0 / 4%)",
                          color: "#fff",
                        }}
                      >
                        {t("aiNoSources")}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Composer */}
      <div className="relative z-10 border-t border-border/40 bg-background/40 px-3 pb-3 pt-2 backdrop-blur-xl">
        {/* Action row */}
        <div className="mb-2 flex items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setImageMode((v) => !v)}
            className="press-glow shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
            style={imageMode ? {
              borderColor: "var(--theme-accent)",
              color: "var(--theme-accent)",
              background: "color-mix(in oklab, var(--theme-accent) 14%, transparent)",
              boxShadow: "0 0 14px color-mix(in oklab, var(--theme-accent) 50%, transparent)",
            } : { borderColor: "var(--border)", color: "#fff" }}
          >
            <Wand2 className="h-3.5 w-3.5" /> {t("aiCreateImage")}
          </button>
          <button
            onClick={() => {
              if (speaking) stopSpeaking();
              setAutoSpeak((v) => !v);
            }}
            className="press-glow shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
            style={autoSpeak ? {
              borderColor: "var(--theme-accent)",
              color: "var(--theme-accent)",
              background: "color-mix(in oklab, var(--theme-accent) 14%, transparent)",
            } : { borderColor: "var(--border)", color: "#fff" }}
            aria-label="Toggle voice reply"
            title={autoSpeak ? "Voice reply: ON" : "Voice reply: OFF"}
          >
            {autoSpeak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {speaking ? "Speaking…" : autoSpeak ? "Voice on" : "Voice off"}
          </button>
          {messages.length > 0 && suggestions.slice(0, 2).map((s) => (
            <button
              key={s.key}
              onClick={() => setInput(s.prompt)}
              className="press-glow shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div
          className="input-pill flex items-end gap-1.5 px-2 py-1.5"
          style={imageMode ? {
            borderColor: "color-mix(in oklab, var(--theme-accent) 70%, transparent)",
            boxShadow: "0 0 18px color-mix(in oklab, var(--theme-accent) 35%, transparent)",
          } : undefined}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            className="press-glow grid h-9 w-9 place-items-center rounded-full text-soft"
            aria-label={t("aiAttachFile")}
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            onClick={() => imgInputRef.current?.click()}
            className="press-glow grid h-9 w-9 place-items-center rounded-full text-soft"
            aria-label={t("aiAttachImage")}
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <input ref={fileInputRef} type="file" hidden onChange={(e) => onPickFile(e, "file")} />
          <input ref={imgInputRef} type="file" accept="image/*" hidden onChange={(e) => onPickFile(e, "image")} />

          {/* Tap-to-talk microphone: tap → record; tap again → stop & send. Right-click/long-press to cancel. */}
          <button
            type="button"
            onClick={toggleRecording}
            onContextMenu={onMicContextMenu}
            disabled={transcribing}
            className="press-glow grid h-9 w-9 place-items-center rounded-full select-none disabled:opacity-60"
            style={recording ? {
              background: "color-mix(in oklab, var(--theme-accent) 30%, transparent)",
              color: "var(--theme-accent)",
              boxShadow: "0 0 16px color-mix(in oklab, var(--theme-accent) 60%, transparent)",
            } : { color: "var(--theme-accent)" }}
            aria-label={recording ? "Recording — tap to stop & send" : transcribing ? "Transcribing…" : "Tap to talk"}
            title={recording ? "Listening… tap to stop & send" : transcribing ? "Transcribing…" : "Tap to talk"}
          >
            <Mic className={`h-4 w-4 ${recording || transcribing ? "animate-pulse" : ""}`} />
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={imageMode ? t("aiImagePrompt") : t("aiPlaceholder")}
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none max-h-32"
          />

          {loading ? (
            <button
              onClick={stop}
              className="neon-circle press-glow grid h-10 w-10 place-items-center rounded-full"
              aria-label={t("aiStop")}
              style={{ background: "oklch(0.7 0.22 25)" }}
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => send()}
              disabled={!input.trim()}
              className="neon-circle press-glow grid h-10 w-10 place-items-center rounded-full disabled:opacity-50"
              aria-label="send"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
