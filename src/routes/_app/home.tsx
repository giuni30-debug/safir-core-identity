import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/contexts/AppContext";
import { Avatar } from "@/components/Avatar";
import { Settings, Users, MessagesSquare, Calendar, NotebookPen, Wallet, ShoppingBag, Search, CalendarClock } from "lucide-react";
import { HomeInstallBanner } from "@/components/HomeInstallBanner";

export const Route = createFileRoute("/_app/home")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Home — Safir Private Life" },
      { name: "description", content: "Your private life dashboard." },
    ],
  }),
});

function Home() {
  const { profile, t } = useApp();
  const navigate = useNavigate();

  // Per-module neon color (oklch for premium glow)
  const tiles = [
    { to: "/connect" as const, icon: Search, label: t("connect"), color: "oklch(0.82 0.16 200)" }, // cyan
    { to: "/contacts" as const, icon: Users, label: t("contacts"), color: "oklch(0.70 0.18 250)" }, // blue
    { to: "/contacts" as const, icon: MessagesSquare, label: t("chat"), color: "oklch(0.70 0.20 300)" }, // purple
    { to: "/calendar" as const, icon: Calendar, label: t("calendar"), color: "oklch(0.88 0.17 95)" }, // yellow
    { to: "/notes" as const, icon: NotebookPen, label: t("notes"), color: "oklch(0.78 0.18 150)" }, // green
    { to: "/expenses" as const, icon: Wallet, label: t("expenses"), color: "oklch(0.70 0.22 25)" }, // red
    { to: "/appointments" as const, icon: CalendarClock, label: "Appointments", color: "oklch(0.82 0.16 200)" },
    { to: "/coming-soon" as const, icon: ShoppingBag, label: t("shopping"), color: "oklch(0.78 0.18 55)" }, // orange
  ];

  return (
    <div className="flex min-h-full flex-col animate-[fade-in_0.4s_ease-out]">
      {/* Top bar */}
      <header className="flex items-center gap-3 py-1">
        <button onClick={() => navigate({ to: "/profile" })}>
          <Avatar url={profile?.avatar_url} name={profile?.display_name ?? "U"} size={44} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-tight">
            {profile?.display_name ?? "—"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            @{profile?.username ?? "…"}
          </p>
        </div>
        <Link
          to="/settings"
          aria-label="Settings"
          className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card/40 transition hover:border-primary"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </header>

      <HomeInstallBanner />

      {/* Tiles — vertically centered */}
      <div className="flex flex-1 items-center">
        <div className="grid w-full grid-cols-2 gap-3">
          {tiles.map(({ to, icon: Icon, label }, i) => (
            <Link
              key={i}
              to={to}
              className="glass-card glass-card-hover tile-press flex aspect-square flex-col items-start justify-between gap-4 p-4"
              style={{
                borderRadius: "20px",
                borderColor: "color-mix(in oklab, var(--theme-accent) 22%, transparent)",
                boxShadow:
                  "0 8px 28px oklch(0 0 0 / 45%), 0 0 18px color-mix(in oklab, var(--theme-accent) 12%, transparent)",
              }}
            >
              <div
                className="grid h-11 w-11 place-items-center rounded-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, var(--theme-accent) 22%, transparent), color-mix(in oklab, var(--theme-accent) 8%, transparent))",
                  color: "var(--theme-accent)",
                  boxShadow:
                    "0 0 14px color-mix(in oklab, var(--theme-accent) 35%, transparent)",
                }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold tracking-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
