import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/contexts/AppContext";
import { Avatar } from "@/components/Avatar";
import { Settings, Users, MessagesSquare, Calendar, NotebookPen, Wallet, ShoppingBag, Search } from "lucide-react";
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

  const tiles = [
    { to: "/connect" as const, icon: Search, label: t("connect") },
    { to: "/contacts" as const, icon: Users, label: t("contacts") },
    { to: "/contacts" as const, icon: MessagesSquare, label: t("chat") },
    { to: "/coming-soon" as const, icon: Calendar, label: t("calendar") },
    { to: "/coming-soon" as const, icon: NotebookPen, label: t("notes") },
    { to: "/coming-soon" as const, icon: Wallet, label: t("expenses") },
    { to: "/coming-soon" as const, icon: ShoppingBag, label: t("shopping") },
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

      {/* Tiles — vertically centered */}
      <div className="flex flex-1 items-center">
        <div className="grid w-full grid-cols-2 gap-3">
          {tiles.map(({ to, icon: Icon, label }, i) => (
            <Link
              key={i}
              to={to}
              className="glass-card glass-card-hover flex aspect-square flex-col items-start justify-between gap-4 p-4"
            >
              <div
                className="grid h-10 w-10 place-items-center rounded-xl"
                style={{
                  background: "color-mix(in oklab, var(--theme-accent) 15%, transparent)",
                  color: "var(--theme-accent)",
                }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
