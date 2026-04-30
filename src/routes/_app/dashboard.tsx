import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/contexts/AppContext";
import {
  ArrowLeft, Settings, Users, MessagesSquare, Calendar,
  NotebookPen, Wallet, ShoppingBag, Search, CalendarClock,
} from "lucide-react";
import { useSwipeNav } from "@/hooks/useSwipeNav";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — Safir Private Life" },
      { name: "description", content: "All your Safir modules in one place." },
    ],
  }),
});

function Dashboard() {
  const { t } = useApp();
  const navigate = useNavigate();

  // Swipe right → back to Home
  const { dx, isSwiping } = useSwipeNav({ onSwipeRight: "/home" });

  const tiles = [
    { to: "/connect" as const,      icon: Search,         label: t("connect"),    color: "oklch(0.82 0.16 200)" },
    { to: "/contacts" as const,     icon: Users,          label: t("contacts"),   color: "oklch(0.70 0.18 250)" },
    { to: "/contacts" as const,     icon: MessagesSquare, label: t("chat"),       color: "oklch(0.70 0.20 300)" },
    { to: "/calendar" as const,     icon: Calendar,       label: t("calendar"),   color: "oklch(0.88 0.17 95)"  },
    { to: "/notes" as const,        icon: NotebookPen,    label: t("notes"),      color: "oklch(0.78 0.18 150)" },
    { to: "/expenses" as const,     icon: Wallet,         label: t("expenses"),   color: "oklch(0.70 0.22 25)"  },
    { to: "/appointments" as const, icon: CalendarClock,  label: t("appointments"),  color: "oklch(0.82 0.16 200)" },
    { to: "/coming-soon" as const,  icon: ShoppingBag,    label: t("shopping"),   color: "oklch(0.78 0.18 55)"  },
  ];

  // Translate the whole view as the user swipes right
  const translate = Math.max(0, dx);
  const progress = Math.min(1, translate / 240);

  return (
    <div
      className="flex min-h-full flex-col"
      style={{
        transform: `translateX(${translate}px) scale(${1 - progress * 0.04})`,
        filter: `blur(${progress * 2}px)`,
        transition: isSwiping ? "none" : "transform 0.3s ease-out, filter 0.3s ease-out",
        willChange: "transform, filter",
      }}
    >
      {/* Header */}
      <header className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/home" })}
          aria-label="Back to Home"
          className="press-glow grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold tracking-wide">
          {t("dashboard")}
        </h1>
        <Link
          to="/settings"
          aria-label="Settings"
          className="press-glow grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card/40"
          style={{
            color: "var(--theme-accent)",
            boxShadow: "0 0 12px color-mix(in oklab, var(--theme-accent) 35%, transparent)",
          }}
        >
          <Settings className="h-5 w-5" />
        </Link>
      </header>

      {/* Swipe hint */}
      <p className="mb-3 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {t("swipeRightHome")}
      </p>

      {/* Tiles */}
      <div className="flex flex-1 items-center">
        <div className="grid w-full grid-cols-2 gap-3">
          {tiles.map(({ to, icon: Icon, label, color }, i) => (
            <Link
              key={i}
              to={to}
              className="glass-card glass-card-hover tile-press flex aspect-square flex-col items-start justify-between gap-4 p-4"
              style={{
                ["--theme-accent" as any]: color,
                ["--theme-glow" as any]: color,
                borderRadius: "20px",
              }}
            >
              <div
                className="grid h-11 w-11 place-items-center rounded-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, var(--theme-accent) 28%, transparent), color-mix(in oklab, var(--theme-accent) 8%, transparent))",
                  color: "var(--theme-accent)",
                  boxShadow:
                    "0 0 18px color-mix(in oklab, var(--theme-accent) 45%, transparent), inset 0 0 8px color-mix(in oklab, var(--theme-accent) 20%, transparent)",
                }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ filter: "drop-shadow(0 0 6px color-mix(in oklab, var(--theme-accent) 60%, transparent))" }}
                />
              </div>
              <span className="text-sm font-semibold tracking-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
