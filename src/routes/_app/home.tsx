import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/contexts/AppContext";
import { Avatar } from "@/components/Avatar";
import { Settings, ArrowRight, Shield, Sparkles, Languages, MessageCircle, Phone, Video } from "lucide-react";
import { HomeInstallBanner } from "@/components/HomeInstallBanner";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCall } from "@/contexts/CallContext";

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

      {/* Centerpiece: Logo + tagline (compact to make room for module cards) */}
      <div className="relative z-10 flex flex-col items-center gap-5 pt-2">
        {/* Sapphire S logo */}
        <div className="relative grid place-items-center" aria-hidden>
          <div
            className="absolute h-[220px] w-[220px] rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, oklch(0.70 0.18 250 / 38%), transparent 70%)",
              filter: "blur(30px)",
              animation: "logo-breath 4.5s ease-in-out infinite",
            }}
          />
          <div
            className="relative grid h-32 w-32 place-items-center rounded-full"
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
                fontSize: 72,
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
        <div className="flex flex-col items-center gap-1 text-center">
          <h1
            className="text-xl font-light tracking-[0.04em] text-white"
            style={{ textShadow: "0 0 18px oklch(0.70 0.18 250 / 55%)" }}
          >
            {t("homeTagline")}
          </h1>
          <p className="text-[10px] font-light tracking-[0.3em] text-white/50 uppercase">
            {t("homeSubline")}
          </p>
        </div>
      </div>

      {/* Module selection cards */}
      <div className="relative z-10 mt-6 flex flex-col gap-3">
        <p className="text-soft text-center text-[10px] font-semibold uppercase tracking-[0.3em]">
          {t("homeChooseModule")}
        </p>
        <ModuleCard
          icon={<Shield className="h-7 w-7" />}
          title={t("modPrivateLife")}
          desc={t("modPrivateLifeDesc")}
          accent="oklch(0.70 0.18 250)"
          onClick={() => navigate({ to: "/dashboard" })}
        />
        <ModuleCard
          icon={<Sparkles className="h-7 w-7" />}
          title={t("modAllAssist")}
          desc={t("modAllAssistDesc")}
          accent="oklch(0.78 0.18 320)"
          onClick={() => navigate({ to: "/assistant" })}
        />
        <ModuleCard
          icon={<Languages className="h-7 w-7" />}
          title={t("modTranslator")}
          desc={t("modTranslatorDesc")}
          accent="oklch(0.78 0.16 165)"
          onClick={() => navigate({ to: "/translator" })}
        />
      </div>

      {/* Bottom CTA */}
      <div className="relative z-10 mt-5 flex flex-col items-center gap-2 pb-2">
        <p className="text-[10px] font-light tracking-[0.25em] text-white/40 uppercase">
          {t("orSwipeLeft")}
        </p>
      </div>
    </div>
  );
}

function ModuleCard({
  icon, title, desc, accent, onClick,
}: { icon: React.ReactNode; title: string; desc: string; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="press-glow group relative flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-transform"
      style={{
        background:
          "linear-gradient(135deg, oklch(1 0 0 / 8%) 0%, oklch(1 0 0 / 3%) 100%)",
        border: `1.5px solid ${accent}`,
        backdropFilter: "blur(28px) saturate(160%)",
        WebkitBackdropFilter: "blur(28px) saturate(160%)",
        boxShadow: `0 0 22px color-mix(in oklab, ${accent} 35%, transparent), 0 10px 32px oklch(0 0 0 / 50%), inset 0 1px 0 oklch(1 0 0 / 10%)`,
      }}
    >
      <div
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white"
        style={{
          background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 50%, #000))`,
          boxShadow: `0 0 18px ${accent}, inset 0 1px 0 oklch(1 0 0 / 25%)`,
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-base font-bold tracking-wide text-white"
          style={{ textShadow: `0 0 12px color-mix(in oklab, ${accent} 60%, transparent)` }}
        >
          {title}
        </p>
        <p className="text-soft mt-0.5 text-xs">{desc}</p>
      </div>
      <ArrowRight
        className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1"
        style={{ color: accent }}
      />
    </button>
  );
}
