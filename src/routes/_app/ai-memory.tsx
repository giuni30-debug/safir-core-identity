import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Brain, Trash2, Sparkles } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useAiMemory } from "@/hooks/useAiMemory";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ai-memory")({
  component: AiMemoryPage,
  head: () => ({
    meta: [
      { title: "AI Memory — Safir" },
      { name: "description", content: "Manage what All Assist AI remembers about you." },
    ],
  }),
});

function AiMemoryPage() {
  const { t } = useApp();
  const navigate = useNavigate();
  const m = useAiMemory();

  return (
    <div className="page-enter relative flex h-[100dvh] flex-col">
      <header className="relative z-10 flex items-center gap-3 border-b border-border/40 bg-background/40 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => navigate({ to: "/settings" })}
          className="press-glow grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-neon-title text-base flex items-center gap-2">
            <Brain className="h-4 w-4" style={{ color: "var(--theme-accent)" }} />
            {t("aiMemoryTitle")}
          </h1>
          <p className="text-soft text-[11px]">{t("aiMemoryDesc")}</p>
        </div>
      </header>

      <div className="relative flex-1 overflow-y-auto px-4 py-4">
        {/* Toggle */}
        <div
          className="mb-4 flex items-center justify-between rounded-2xl px-4 py-3 glass-card"
          style={{ border: "1px solid color-mix(in oklab, var(--theme-accent) 30%, transparent)" }}
        >
          <div>
            <p className="text-sm font-bold text-white">{t("aiMemoryEnabled")}</p>
            <p className="text-soft text-[11px]">{t("aiMemoryDesc")}</p>
          </div>
          <button
            onClick={() => m.setMemoryEnabled(!m.enabled)}
            className="press-glow relative h-7 w-12 rounded-full transition"
            style={{
              background: m.enabled
                ? "var(--theme-accent)"
                : "oklch(1 0 0 / 12%)",
              boxShadow: m.enabled
                ? "0 0 14px color-mix(in oklab, var(--theme-accent) 60%, transparent)"
                : undefined,
            }}
            aria-pressed={m.enabled}
          >
            <span
              className="absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all"
              style={{ left: m.enabled ? "calc(100% - 26px)" : "2px" }}
            />
          </button>
        </div>

        {/* Clear all */}
        {m.memories.length > 0 && (
          <button
            onClick={() => {
              if (confirm(t("aiMemoryConfirmClear"))) {
                void m.clearAll();
                toast.success(t("aiMemoryClearAll"));
              }
            }}
            className="press-glow mb-3 inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t("aiMemoryClearAll")}
          </button>
        )}

        {/* List */}
        {m.memories.length === 0 ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <div
              className="mb-4 grid h-20 w-20 place-items-center rounded-full"
              style={{
                background: "color-mix(in oklab, var(--theme-accent) 14%, transparent)",
                border: "1px solid color-mix(in oklab, var(--theme-accent) 35%, transparent)",
              }}
            >
              <Sparkles className="h-8 w-8" style={{ color: "var(--theme-accent)" }} />
            </div>
            <p className="text-soft max-w-xs text-xs">{t("aiMemoryEmpty")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {m.memories.map((mem) => (
              <li
                key={mem.id}
                className="flex items-start gap-2 rounded-2xl px-3 py-2.5 glass-card"
                style={{ border: "1px solid color-mix(in oklab, var(--theme-accent) 22%, transparent)" }}
              >
                <span
                  className="mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  style={{
                    color: "var(--theme-accent)",
                    background: "color-mix(in oklab, var(--theme-accent) 14%, transparent)",
                    border: "1px solid color-mix(in oklab, var(--theme-accent) 30%, transparent)",
                  }}
                >
                  {mem.category}
                </span>
                <p className="flex-1 text-sm text-white">{mem.content}</p>
                <button
                  onClick={() => void m.deleteMemory(mem.id)}
                  className="press-glow grid h-8 w-8 place-items-center rounded-full border border-border/60 bg-card/40 text-red-400"
                  aria-label="delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
