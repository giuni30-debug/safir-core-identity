import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/coming-soon")({
  component: ComingSoon,
  head: () => ({
    meta: [
      { title: "Coming soon — Safir Private Life" },
      { name: "description", content: "This module is on the way." },
    ],
  }),
});

function ComingSoon() {
  return (
    <div className="animate-[fade-in_0.4s_ease-out]">
      <header className="flex items-center gap-3">
        <Link to="/home" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </header>
      <div className="mt-20 flex flex-col items-center gap-4 text-center">
        <div
          className="grid h-20 w-20 place-items-center rounded-3xl"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          <Sparkles className="h-9 w-9 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-semibold">Coming soon</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          This module is being crafted. We're building Safir step by step.
        </p>
      </div>
    </div>
  );
}
