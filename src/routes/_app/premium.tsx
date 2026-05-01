import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, X, Crown, Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/premium")({
  component: PremiumPage,
  head: () => ({
    meta: [
      { title: "Premium — Safir Home Chat" },
      { name: "description", content: "Unlock Safir Premium features." },
    ],
  }),
});

const PERKS = [
  "Unlimited AI Assist conversations",
  "HD video calls & priority routing",
  "Advanced translator (50+ languages)",
  "Custom themes & exclusive neon packs",
  "Priority support",
];

function PremiumPage() {
  return (
    <div className="animate-[fade-in_0.4s_ease-out] pb-10">
      <header className="flex items-center gap-3">
        <Link
          to="/settings"
          aria-label="Back"
          className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Premium</h1>
          <p className="text-xs text-muted-foreground">Subscription & benefits</p>
        </div>
        <Link
          to="/home"
          aria-label="Close"
          className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40"
        >
          <X className="h-5 w-5" />
        </Link>
      </header>

      {/* Hero card */}
      <section
        className="mt-6 rounded-3xl p-6 text-center"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.70 0.18 250 / 14%), oklch(0.78 0.18 320 / 10%))",
          border: "1.5px solid oklch(0.78 0.18 320 / 50%)",
          backdropFilter: "blur(28px) saturate(160%)",
          boxShadow:
            "0 0 32px oklch(0.78 0.18 320 / 30%), 0 12px 40px oklch(0 0 0 / 50%), inset 0 1px 0 oklch(1 0 0 / 12%)",
        }}
      >
        <div
          className="mx-auto grid h-20 w-20 place-items-center rounded-3xl"
          style={{
            background: "linear-gradient(135deg, oklch(0.85 0.16 90), oklch(0.78 0.18 320))",
            boxShadow: "0 0 30px oklch(0.85 0.16 90 / 60%), inset 0 1px 0 oklch(1 0 0 / 30%)",
            animation: "logo-breath 3s ease-in-out infinite",
          }}
        >
          <Crown className="h-10 w-10 text-white" />
        </div>
        <h2
          className="mt-4 text-2xl font-bold tracking-wide text-white"
          style={{ textShadow: "0 0 18px oklch(0.85 0.16 90 / 60%)" }}
        >
          Safir Premium
        </h2>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-white/60">Coming soon</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Premium plans are launching shortly. Get notified when they go live.
        </p>

        <button
          disabled
          className="mt-5 w-full rounded-2xl py-3 text-sm font-semibold text-white opacity-70"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.85 0.16 90), oklch(0.78 0.18 320))",
            boxShadow: "0 0 22px oklch(0.78 0.18 320 / 50%)",
          }}
        >
          <Sparkles className="mr-2 inline h-4 w-4" />
          Notify me at launch
        </button>
      </section>

      {/* Perks */}
      <section className="mt-6">
        <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          What you'll get
        </p>
        <div className="space-y-2">
          {PERKS.map((p, i) => (
            <div
              key={i}
              className="glass-card flex items-center gap-3 p-3"
              style={{ animation: `fade-in 0.3s ease-out ${i * 60}ms both` }}
            >
              <div
                className="grid h-9 w-9 place-items-center rounded-xl"
                style={{
                  background: "color-mix(in oklab, var(--theme-accent) 18%, transparent)",
                  color: "var(--theme-accent)",
                }}
              >
                <Check className="h-4 w-4" />
              </div>
              <span className="flex-1 text-sm">{p}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
