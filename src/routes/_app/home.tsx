import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/contexts/AppContext";
import { ArrowRight, Shield, Sparkles, Languages, MessageCircle, Phone, Video } from "lucide-react";
import { HomeInstallBanner } from "@/components/HomeInstallBanner";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCall } from "@/contexts/CallContext";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import { track } from "@/lib/analytics";

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
  const { profile, t, user } = useApp();
  const navigate = useNavigate();
  const { startCall, startVideoCall } = useCall();
  useTrackScreen("home_opened");

  // Recent quick contacts (top 3)
  const [quickContacts, setQuickContacts] = useState<
    { id: string; display_name: string; avatar_url: string | null }[]
  >([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conns } = await supabase
        .from("connections")
        .select("contact_id")
        .eq("owner_id", user.id)
        .limit(3);
      const ids = (conns ?? []).map((c) => c.contact_id);
      if (!ids.length) return;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      setQuickContacts(profs ?? []);
    })();
  }, [user]);


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

      <HomeInstallBanner />

      {/* Communication Hero panel */}
      <section
        className="relative z-10 mt-3 animate-[fade-in_0.5s_ease-out] rounded-3xl p-4"
        style={{
          background:
            "linear-gradient(135deg, oklch(1 0 0 / 8%) 0%, oklch(0.70 0.18 250 / 10%) 50%, oklch(1 0 0 / 4%) 100%)",
          border: "1.5px solid oklch(0.70 0.18 250 / 45%)",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          boxShadow:
            "0 0 32px oklch(0.70 0.18 250 / 28%), 0 12px 40px oklch(0 0 0 / 50%), inset 0 1px 0 oklch(1 0 0 / 12%)",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p
            className="text-sm font-semibold tracking-wide text-white"
            style={{ textShadow: "0 0 14px oklch(0.70 0.18 250 / 60%)" }}
          >
            {t("commTitle")}
          </p>
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
              style={{
                boxShadow: "0 0 8px #34d399, 0 0 14px #34d399",
                animation: "logo-breath 1.6s ease-in-out infinite",
              }}
            />
            {t("commOnlineNow")}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <CommButton
            accent="oklch(0.78 0.18 200)"
            label={t("commChat")}
            desc={t("commChatDesc")}
            icon={<MessageCircle className="h-6 w-6" />}
            badge={<TypingDots />}
            onClick={() => navigate({ to: "/contacts" })}
          />
          <CommButton
            accent="oklch(0.78 0.18 145)"
            label={t("commCall")}
            desc={t("commCallDesc")}
            icon={<Phone className="h-6 w-6" />}
            badge={<PulseRing color="oklch(0.78 0.18 145)" />}
            onClick={() => {
              track("call_button_tapped", { from: "home" });
              if (quickContacts[0]) void startCall(quickContacts[0].id);
              else navigate({ to: "/contacts" });
            }}
          />
          <CommButton
            accent="oklch(0.78 0.18 320)"
            label={t("commVideo")}
            desc={t("commVideoDesc")}
            icon={<Video className="h-6 w-6" />}
            badge={<GlowFlicker color="oklch(0.78 0.18 320)" />}
            onClick={() => {
              track("video_button_tapped", { from: "home" });
              if (quickContacts[0]) void startVideoCall(quickContacts[0].id);
              else navigate({ to: "/contacts" });
            }}
          />
        </div>

        {/* Quick contacts */}
        <div className="mt-3 flex items-center gap-2">
          <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
            {t("commQuickContacts")}
          </p>
          <div className="flex-1 overflow-x-auto">
            <div className="flex items-center gap-2">
              {quickContacts.length === 0 && (
                <Link
                  to="/connect"
                  className="press-glow shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70"
                >
                  {t("commNoContactsYet")} →
                </Link>
              )}
              {quickContacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate({ to: "/chat/$id", params: { id: c.id } })}
                  className="press-glow relative shrink-0"
                  aria-label={c.display_name}
                  title={c.display_name}
                >
                  <Avatar url={c.avatar_url} name={c.display_name} size={36} />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400"
                    style={{ boxShadow: "0 0 6px #34d399" }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

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

function CommButton({
  icon, label, desc, accent, badge, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  accent: string;
  badge?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="press-glow group relative flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center transition-transform active:scale-95"
      style={{
        background:
          "linear-gradient(160deg, oklch(1 0 0 / 10%) 0%, oklch(1 0 0 / 3%) 100%)",
        border: `1.5px solid ${accent}`,
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        boxShadow: `0 0 18px color-mix(in oklab, ${accent} 45%, transparent), inset 0 1px 0 oklch(1 0 0 / 12%)`,
      }}
    >
      <div
        className="relative grid h-12 w-12 place-items-center rounded-2xl text-white"
        style={{
          background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 45%, #000))`,
          boxShadow: `0 0 16px ${accent}, inset 0 1px 0 oklch(1 0 0 / 25%)`,
          animation: "logo-breath 2.6s ease-in-out infinite",
        }}
      >
        {icon}
        {badge && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            {badge}
          </span>
        )}
      </div>
      <p
        className="text-[12px] font-bold tracking-wide text-white"
        style={{ textShadow: `0 0 10px color-mix(in oklab, ${accent} 70%, transparent)` }}
      >
        {label}
      </p>
      <p className="text-[9.5px] leading-tight text-white/60">{desc}</p>
    </button>
  );
}

function TypingDots() {
  return (
    <span className="absolute -bottom-0.5 right-0.5 flex gap-[2px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 rounded-full bg-white"
          style={{
            animation: `home-float 1.1s ease-in-out ${i * 0.15}s infinite`,
            boxShadow: "0 0 4px #fff",
          }}
        />
      ))}
    </span>
  );
}

function PulseRing({ color }: { color: string }) {
  return (
    <span
      className="absolute inset-0 rounded-2xl"
      style={{
        border: `2px solid ${color}`,
        animation: "logo-breath 1.8s ease-out infinite",
        opacity: 0.55,
      }}
    />
  );
}

function GlowFlicker({ color }: { color: string }) {
  return (
    <span
      className="absolute inset-0 rounded-2xl"
      style={{
        background: `radial-gradient(closest-side, ${color}40, transparent 70%)`,
        animation: "neon-drift 2.4s ease-in-out infinite",
      }}
    />
  );
}
