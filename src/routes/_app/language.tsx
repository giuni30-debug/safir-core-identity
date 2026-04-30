import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import type { Lang } from "@/lib/i18n";

export const Route = createFileRoute("/_app/language")({
  component: LanguagePage,
  head: () => ({
    meta: [
      { title: "Language — Safir Private Life" },
      { name: "description", content: "Choose your preferred language." },
    ],
  }),
});

const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "ro", label: "Română", flag: "🇷🇴" },
  { id: "tr", label: "Türkçe", flag: "🇹🇷" },
  { id: "de", label: "Deutsch", flag: "🇩🇪" },
];

function LanguagePage() {
  const { t, lang, setLang } = useApp();
  return (
    <div className="animate-[fade-in_0.4s_ease-out]">
      <header className="flex items-center gap-3">
        <Link to="/settings" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t("language")}</h1>
      </header>

      <div className="mt-6 space-y-3">
        {LANGS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLang(l.id)}
            className="glass-card glass-card-hover flex w-full items-center gap-3 p-4 text-left"
          >
            <span className="text-2xl">{l.flag}</span>
            <span className="flex-1 text-sm font-medium">{l.label}</span>
            {lang === l.id && <Check className="h-5 w-5 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}
