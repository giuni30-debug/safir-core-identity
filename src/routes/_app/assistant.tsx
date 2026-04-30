import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/contexts/AppContext";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Send, Mic, Paperclip, Image as ImageIcon, Sparkles,
  Loader2, Plus,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/assistant")({
  component: AssistantPage,
  head: () => ({
    meta: [
      { title: "All Assist AI — Safir" },
      { name: "description", content: "Premium AI assistant — chat, voice, documents." },
    ],
  }),
});

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function AssistantPage() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const recogRef = useRef<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function streamReply(history: Msg[]) {
    setLoading(true);
    let acc = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(SUPA_KEY ? { Authorization: `Bearer ${SUPA_KEY}` } : {}),
        },
        body: JSON.stringify({ messages: history }),
      });
      if (resp.status === 503) {
        toast.error(t("aiNotConnected"));
        setLoading(false);
        return;
      }
      if (resp.status === 429) { toast.error("Rate limit exceeded"); setLoading(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted"); setLoading(false); return; }
      if (!resp.ok || !resp.body) { toast.error(t("aiError")); setLoading(false); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      // Insert empty assistant placeholder
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
    } catch (e) {
      console.error(e);
      toast.error(t("aiError"));
    } finally {
      setLoading(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    streamReply(next);
  }

  function startVoice() {
    const Win = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
    const SR = Win.SpeechRecognition || Win.webkitSpeechRecognition;
    if (!SR) { toast.error("Voice not supported on this browser"); return; }
    const rec = new (SR as new () => {
      lang: string; interimResults: boolean; continuous: boolean;
      onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
      onend: () => void; onerror: () => void;
      start: () => void; stop: () => void;
    })();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setInput((p) => (p ? p + " " : "") + text);
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => { setRecording(false); toast.error("Voice error"); };
    recogRef.current = rec;
    setRecording(true);
    rec.start();
  }
  function stopVoice() {
    const r = recogRef.current as { stop: () => void } | null;
    r?.stop();
    setRecording(false);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>, kind: "file" | "image") {
    const file = e.target.files?.[0];
    if (!file) return;
    const note = kind === "image"
      ? `[${file.name}] (image attached — image understanding coming soon)`
      : `[${file.name}] (file attached — please summarize / explain its contents)`;
    setInput((p) => (p ? p + "\n" : "") + note);
    e.target.value = "";
    toast.success(file.name);
  }

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
          onClick={() => setMessages([])}
          className="press-glow grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-card/40"
          aria-label={t("aiNewChat")}
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="relative mb-5">
              <div
                className="absolute inset-0 -z-10 rounded-full blur-3xl"
                style={{ background: "color-mix(in oklab, var(--theme-accent) 60%, transparent)" }}
              />
              <div
                className="grid h-24 w-24 place-items-center rounded-full"
                style={{
                  background: "linear-gradient(135deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 50%, #000))",
                  boxShadow: "0 0 50px color-mix(in oklab, var(--theme-accent) 70%, transparent), inset 0 1px 0 oklch(1 0 0 / 30%)",
                  animation: "logo-breath 4.5s ease-in-out infinite",
                }}
              >
                <Sparkles className="h-10 w-10 text-white" />
              </div>
            </div>
            <h2 className="text-neon-title text-lg">{t("aiWelcome")}</h2>
            <p className="text-soft mt-1 max-w-xs text-xs">{t("aiSubtitle")}</p>
          </div>
        )}

        <ul className="space-y-3">
          {messages.map((m, i) => (
            <li key={i} className={`msg-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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
                      }
                }
              >
                {m.content || (loading && i === messages.length - 1 ? <span className="text-soft">{t("aiThinking")}</span> : "")}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Composer */}
      <div className="relative z-10 border-t border-border/40 bg-background/40 px-3 py-3 backdrop-blur-xl">
        <div className="input-pill flex items-end gap-1.5 px-2 py-1.5">
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

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={t("aiPlaceholder")}
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none max-h-32"
          />

          <button
            onClick={recording ? stopVoice : startVoice}
            className={`press-glow grid h-9 w-9 place-items-center rounded-full ${recording ? "mic-pulse" : ""}`}
            style={{
              background: recording ? "var(--theme-accent)" : "transparent",
              color: recording ? "#fff" : "var(--theme-accent)",
            }}
            aria-label={t("aiVoice")}
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="neon-circle press-glow grid h-10 w-10 place-items-center rounded-full disabled:opacity-50"
            aria-label="send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
