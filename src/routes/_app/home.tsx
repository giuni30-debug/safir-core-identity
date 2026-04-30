import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/contexts/AppContext";
import { Avatar } from "@/components/Avatar";
import { Settings, ArrowRight } from "lucide-react";
import { HomeInstallBanner } from "@/components/HomeInstallBanner";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { useMemo } from "react";

export const Route = createFileRoute("/_app/home")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Home — Safir Private Life" },
      { name: "description", content: "Your private Safir home." },
    ],
  }),
});

function Home() {
  const { profile, t } = useApp();
  const navigate = useNavigate();

  // Swipe left → open Dashboard
  const { dx, isSwiping } = useSwipeNav({ onSwipeLeft: "/dashboard" });
  const translate = Math.min(0, dx); // only negative
  const progress = Math.min(1, Math.abs(translate) / 240);

  // Pre-compute particle positions
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: 1 + Math.random() * 2.5,
        delay: `${Math.random() * 6}s`,
        dur: `${10 + Math.random() * 12}s`,
      })),
    [],
  );

  return (
    <div
      className="relative flex min-h-full flex-col"
      style={{
        transform: `translateX(${translate}px) scale(${1 - progress * 0.04})`,
        filter: `blur(${progress * 2}px)`,
        transition: isSwiping ? "none" : "transform 0.3s ease-out, filter 0.3s ease-out",
        willChange: "transform, filter",
      }}
    >
      {/* Background neon waves + particles */}
      <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div
          className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full"
          style={{
            background: "radial-gradient(closest-side, oklch(0.70 0.18 250 / 35%), transparent 70%)",
            filter: "blur(60px)",
            animation: "neon-drift 16s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-[-100px] right-[-60px] h-[360px] w-[360px] rounded-full"
          style={{
            background: "radial-gradient(closest-side, oklch(0.82 0.16 200 / 28%), transparent 70%)",
            filter: "blur(60px)",
            animation: "neon-drift-2 22s ease-in-out infinite",
          }}
        />
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full bg-white/70"
            style={{
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              boxShadow: "0 0 6px oklch(0.82 0.16 200 / 60%)",
              animation: `home-float ${p.dur} ease-in-out ${p.delay} infinite`,
              opacity: 0.55,
            }}
          />
        ))}
      </div>

      {/* Top bar (kept minimal — profile + settings still accessible) */}
      <header className="relative z-10 flex items-center gap-3 py-1">
        <button onClick={() => navigate({ to: "/profile" })} aria-label="Profile">
          <Avatar url={profile?.avatar_url} name={profile?.display_name ?? "U"} size={40} />
        </button>
        <div className="min-w-0 flex-1" />
        <Link
          to="/settings"
          aria-label="Settings"
          className="press-glow grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card/40"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </header>

      <HomeInstallBanner />

      {/* Centerpiece: Logo + tagline */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8">
        {/* Sapphire S logo */}
        <div className="relative grid place-items-center" aria-hidden>
          {/* Outer halo */}
          <div
            className="absolute h-[280px] w-[280px] rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, oklch(0.70 0.18 250 / 38%), transparent 70%)",
              filter: "blur(30px)",
              animation: "logo-breath 4.5s ease-in-out infinite",
            }}
          />
          {/* Glass disc */}
          <div
            className="relative grid h-44 w-44 place-items-center rounded-full"
            style={{
              background:
                "linear-gradient(160deg, oklch(1 0 0 / 12%), oklch(0.70 0.18 250 / 18%) 60%, oklch(0 0 0 / 25%))",
              border: "1.5px solid oklch(0.70 0.18 250 / 55%)",
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
              boxShadow:
                "0 0 60px oklch(0.70 0.18 250 / 55%), inset 0 1px 0 oklch(1 0 0 / 25%), inset 0 -20px 40px oklch(0 0 0 / 35%)",
              animation: "logo-breath 4.5s ease-in-out infinite",
            }}
          >
            <span
              style={{
                fontSize: 96,
                fontWeight: 200,
                lineHeight: 1,
                letterSpacing: "-0.05em",
                background:
                  "linear-gradient(180deg, #ffffff 0%, oklch(0.85 0.14 240) 60%, oklch(0.70 0.18 250) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 2px 12px oklch(0.70 0.18 250 / 80%))",
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
              }}
            >
              S
            </span>
          </div>
        </div>

        {/* Tagline */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1
            className="text-2xl font-light tracking-[0.04em] text-white"
            style={{ textShadow: "0 0 18px oklch(0.70 0.18 250 / 55%)" }}
          >
            {t("homeTagline")}
          </h1>
          <p className="text-xs font-light tracking-[0.3em] text-white/50 uppercase">
            {t("homeSubline")}
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="relative z-10 mt-6 flex flex-col items-center gap-3 pb-2">
        <button
          type="button"
          onClick={() => navigate({ to: "/dashboard" })}
          className="press-glow group flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold tracking-wide"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.70 0.18 250), oklch(0.55 0.18 260))",
            color: "white",
            border: "1px solid oklch(0.85 0.14 240 / 60%)",
            boxShadow:
              "0 0 24px oklch(0.70 0.18 250 / 65%), inset 0 1px 0 oklch(1 0 0 / 25%)",
          }}
        >
          {t("enterApp")}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
        <p className="text-[10px] font-light tracking-[0.25em] text-white/40 uppercase">
          {t("orSwipeLeft")}
        </p>
      </div>
    </div>
  );
}
