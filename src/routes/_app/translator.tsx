import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/contexts/AppContext";
import { useRef, useState } from "react";
import {
  ArrowLeft, Languages, ArrowLeftRight, Mic, Camera, FileText,
  Copy, Volume2, Loader2, Type, MessagesSquare,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/translator")({
  component: TranslatorPage,
  head: () => ({
    meta: [
      { title: "Translator Pro — Safir" },
      { name: "description", content: "Professional translation for text, voice, photos, documents." },
    ],
  }),
});

const TR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-translate`;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const LANGS = [
  { code: "ro", label: "Română",   flag: "🇷🇴" },
  { code: "en", label: "English",  flag: "🇬🇧" },
  { code: "tr", label: "Türkçe",   flag: "🇹🇷" },
  { code: "de", label: "Deutsch",  flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español",  flag: "🇪🇸" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "ru", label: "Русский",  flag: "🇷🇺" },
  { code: "ar", label: "العربية",  flag: "🇸🇦" },
  { code: "zh", label: "中文",      flag: "🇨🇳" },
];

type Mode = "text" | "voice" | "photo" | "document" | "conversation";

function TranslatorPage() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("text");
  const [from, setFrom] = useState("auto");
  const [to, setTo] = useState("ro");
  const [src, setSrc] = useState("");
  const [dst, setDst] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const recogRef = useRef<unknown>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const labelOf = (code: string) =>
    code === "auto" ? t("trDetect") : LANGS.find((l) => l.code === code)?.label ?? code;

  function swap() {
    if (from === "auto") { toast.info(t("trDetect")); return; }
    setFrom(to); setTo(from);
    setSrc(dst); setDst(src);
  }

  async function translate() {
    const text = src.trim();
    if (!text) return;
    setLoading(true);
    setDst("");
    try {
      const resp = await fetch(TR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(SUPA_KEY ? { Authorization: `Bearer ${SUPA_KEY}` } : {}),
        },
        body: JSON.stringify({ text, from: labelOf(from), to: labelOf(to) }),
      });
      if (resp.status === 503) { toast.error(t("aiNotConnected")); return; }
      if (resp.status === 429) { toast.error("Rate limit exceeded"); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted"); return; }
      if (!resp.ok) { toast.error(t("aiError")); return; }
      const data = await resp.json();
      setDst(data.translation || "");
    } catch {
      toast.error(t("aiError"));
    } finally {
      setLoading(false);
    }
  }

  function startVoice() {
    const Win = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
    const SR = Win.SpeechRecognition || Win.webkitSpeechRecognition;
    if (!SR) { toast.error("Voice not supported"); return; }
    const rec = new (SR as new () => {
      lang: string; interimResults: boolean; continuous: boolean;
      onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
      onend: () => void; onerror: () => void;
      start: () => void; stop: () => void;
    })();
    rec.lang = from === "auto" ? navigator.language : from;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setSrc((p) => (p ? p + " " : "") + text);
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

  function speak(text: string, lang: string) {
    if (!text || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "auto" ? navigator.language : lang;
    window.speechSynthesis.speak(u);
  }

  function copy(text: string) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => toast.success(t("trCopied")));
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setSrc(`[${f.name}] — Photo OCR translation coming soon.`);
    toast.info("Photo OCR — coming soon");
  }
  function onPickDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setSrc(`[${f.name}] — Document translation coming soon.`);
    toast.info("Document translation — coming soon");
  }

  const modes: { id: Mode; label: string; icon: typeof Type }[] = [
    { id: "text",         label: t("trText"),         icon: Type },
    { id: "voice",        label: t("trVoice"),        icon: Mic },
    { id: "photo",        label: t("trPhoto"),        icon: Camera },
    { id: "document",     label: t("trDocument"),     icon: FileText },
    { id: "conversation", label: t("trConversation"), icon: MessagesSquare },
  ];

  return (
    <div className="page-enter relative min-h-screen pb-8">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/40 bg-background/40 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => navigate({ to: "/home" })}
          className="press-glow grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-neon-title text-base flex items-center gap-2">
            <Languages className="h-4 w-4" style={{ color: "var(--theme-accent)" }} />
            {t("trTitle")}
          </h1>
          <p className="text-soft text-[11px]">{t("trSubtitle")}</p>
        </div>
      </header>

      {/* Mode tabs */}
      <div className="mx-4 mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {modes.map((m) => {
          const active = mode === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className="press-glow shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={active
                ? {
                    borderColor: "var(--theme-accent)",
                    color: "var(--theme-accent)",
                    background: "color-mix(in oklab, var(--theme-accent) 14%, transparent)",
                    boxShadow: "0 0 14px color-mix(in oklab, var(--theme-accent) 50%, transparent)",
                  }
                : { borderColor: "var(--border)", color: "#fff" }}
            >
              <Icon className="h-3.5 w-3.5" /> {m.label}
            </button>
          );
        })}
      </div>

      {/* Language selector */}
      <div className="mx-4 mt-3 flex items-center gap-2">
        <LangSelect value={from} onChange={setFrom} includeAuto label={t("trFrom")} />
        <button
          onClick={swap}
          className="press-glow grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border/60 bg-card/40"
          aria-label={t("trSwap")}
        >
          <ArrowLeftRight className="h-4 w-4" style={{ color: "var(--theme-accent)" }} />
        </button>
        <LangSelect value={to} onChange={setTo} label={t("trTo")} />
      </div>

      {/* Source card */}
      <section className="mx-4 mt-4">
        <div className="glass-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-soft text-[10px] uppercase tracking-widest">{labelOf(from)}</span>
            <div className="flex gap-1">
              {(mode === "voice" || mode === "text" || mode === "conversation") && (
                <button
                  onClick={recording ? stopVoice : startVoice}
                  className={`press-glow grid h-8 w-8 place-items-center rounded-full ${recording ? "mic-pulse" : ""}`}
                  style={{
                    background: recording ? "var(--theme-accent)" : "transparent",
                    color: recording ? "#fff" : "var(--theme-accent)",
                    border: "1px solid color-mix(in oklab, var(--theme-accent) 40%, transparent)",
                  }}
                  aria-label={t("trSpeak")}
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
              {mode === "photo" && (
                <button
                  onClick={() => photoRef.current?.click()}
                  className="press-glow grid h-8 w-8 place-items-center rounded-full border border-border/60"
                  aria-label={t("trUploadPhoto")}
                >
                  <Camera className="h-4 w-4" style={{ color: "var(--theme-accent)" }} />
                </button>
              )}
              {mode === "document" && (
                <button
                  onClick={() => docRef.current?.click()}
                  className="press-glow grid h-8 w-8 place-items-center rounded-full border border-border/60"
                  aria-label={t("trUploadDocument")}
                >
                  <FileText className="h-4 w-4" style={{ color: "var(--theme-accent)" }} />
                </button>
              )}
            </div>
            <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
            <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.txt" hidden onChange={onPickDoc} />
          </div>
          <textarea
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            placeholder={t("trEnter")}
            rows={4}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:opacity-60"
          />
        </div>

        <button
          onClick={translate}
          disabled={loading || !src.trim()}
          className="neon-circle press-glow mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold disabled:opacity-50"
          style={{ background: "var(--theme-accent)" }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
          {loading ? t("trTranslating") : t("trTranslate")}
        </button>
      </section>

      {/* Destination card */}
      <section className="mx-4 mt-4">
        <div
          className="glass-card p-4"
          style={{ borderColor: "color-mix(in oklab, var(--theme-accent) 70%, transparent)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-soft text-[10px] uppercase tracking-widest">{labelOf(to)}</span>
            <div className="flex gap-1">
              <button
                onClick={() => speak(dst, to)}
                disabled={!dst}
                className="press-glow grid h-8 w-8 place-items-center rounded-full border border-border/60 disabled:opacity-40"
                aria-label={t("trListen")}
              >
                <Volume2 className="h-4 w-4" style={{ color: "var(--theme-accent)" }} />
              </button>
              <button
                onClick={() => copy(dst)}
                disabled={!dst}
                className="press-glow grid h-8 w-8 place-items-center rounded-full border border-border/60 disabled:opacity-40"
                aria-label={t("trCopy")}
              >
                <Copy className="h-4 w-4" style={{ color: "var(--theme-accent)" }} />
              </button>
            </div>
          </div>
          <p
            className="min-h-[6rem] whitespace-pre-wrap text-sm leading-relaxed"
            style={{
              color: "#fff",
              textShadow: dst ? "0 0 12px color-mix(in oklab, var(--theme-accent) 40%, transparent)" : undefined,
            }}
          >
            {dst || <span className="text-soft opacity-60">…</span>}
          </p>
        </div>
      </section>
    </div>
  );
}

function LangSelect({
  value, onChange, includeAuto, label,
}: { value: string; onChange: (v: string) => void; includeAuto?: boolean; label: string }) {
  return (
    <label className="glass-card flex-1 px-3 py-2">
      <span className="text-soft block text-[9px] uppercase tracking-widest">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm font-semibold outline-none"
        style={{ color: "#fff" }}
      >
        {includeAuto && <option value="auto" className="bg-background">🌐 Auto</option>}
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} className="bg-background">
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
