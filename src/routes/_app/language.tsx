import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Search, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { LANG_CATALOG, NATIVE_LANGS, getCachedTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/_app/language")({
  component: LanguagePage,
  head: () => ({
    meta: [
      { title: "Language — Safir Private Life" },
      { name: "description", content: "Choose your preferred language — 130+ supported globally." },
    ],
  }),
});

function LanguagePage() {
  const { t, lang, setLang } = useApp();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return LANG_CATALOG;
    return LANG_CATALOG.filter(
      (l) =>
        l.code.toLowerCase().includes(term) ||
        l.name.toLowerCase().includes(term) ||
        l.native.toLowerCase().includes(term),
    );
  }, [q]);

  const native = filtered.filter((l) => (NATIVE_LANGS as string[]).includes(l.code));
  const ai = filtered.filter((l) => !(NATIVE_LANGS as string[]).includes(l.code));

  return (
    <div className="animate-[fade-in_0.4s_ease-out] pb-10">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-3 border-b border-border/40 bg-background/60 px-4 py-3 backdrop-blur-xl">
        <Link
          to="/settings"
          aria-label="Back"
          className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{t("language")}</h1>
          <p className="text-[11px] text-muted-foreground">130+ languages · global</p>
        </div>
      </header>

      {/* Search */}
      <div className="mt-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search languages…"
          className="w-full rounded-2xl border border-border bg-card/40 py-3 pl-10 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {native.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Fully native
          </h2>
          <div className="space-y-2">
            {native.map((l) => (
              <LangRow
                key={l.code}
                info={l}
                active={lang === l.code}
                onClick={() => setLang(l.code)}
              />
            ))}
          </div>
        </section>
      )}

      {ai.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3 w-3" /> AI-translated
          </h2>
          <div className="space-y-2">
            {ai.map((l) => (
              <LangRow
                key={l.code}
                info={l}
                active={lang === l.code}
                onClick={() => setLang(l.code)}
                isAi
              />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">No languages match "{q}"</p>
      )}
    </div>
  );
}

function LangRow({
  info,
  active,
  onClick,
  isAi,
}: {
  info: (typeof LANG_CATALOG)[number];
  active: boolean;
  onClick: () => void;
  isAi?: boolean;
}) {
  // For AI langs, "loading" if we picked it but cache isn't filled yet
  const loading =
    active && isAi && !getCachedTranslation(info.code, "appName");
  return (
    <button
      onClick={onClick}
      className="glass-card glass-card-hover flex w-full items-center gap-3 p-4 text-left transition"
      style={
        active
          ? {
              borderColor: "var(--theme-accent)",
              boxShadow: "0 0 14px color-mix(in oklab, var(--theme-accent) 40%, transparent)",
            }
          : undefined
      }
    >
      <span className="text-2xl leading-none">{info.flag}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{info.native}</div>
        <div className="text-[11px] text-muted-foreground truncate">{info.name}</div>
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--theme-accent)" }} />
      ) : active ? (
        <Check className="h-5 w-5" style={{ color: "var(--theme-accent)" }} />
      ) : isAi ? (
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
      ) : null}
    </button>
  );
}
