import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Avatar } from "@/components/Avatar";
import { Settings, Users, MessagesSquare, Calendar, NotebookPen, Wallet, ShoppingBag, Search } from "lucide-react";

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
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(time.getHours()).padStart(2, "0");
  const mm = String(time.getMinutes()).padStart(2, "0");

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
    <div className="animate-[fade-in_0.4s_ease-out]">
      {/* Top bar */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate({ to: "/profile" })}>
          <Avatar url={profile?.avatar_url} name={profile?.display_name ?? "U"} size={48} />
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
          className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 transition hover:border-primary"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </header>

      {/* Clock */}
      <div className="mt-10 text-center">
        <div className="text-7xl font-extralight tracking-tighter tabular-nums sm:text-8xl">
          <span className="neon-text">{hh}</span>
          <span className="opacity-50">:</span>
          <span>{mm}</span>
        </div>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {time.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Tiles */}
      <div className="mt-8 grid grid-cols-2 gap-3">
        {tiles.map(({ to, icon: Icon, label }, i) => (
          <Link
            key={i}
            to={to}
            className="glass-card glass-card-hover flex flex-col items-start justify-between gap-4 p-4 aspect-square"
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
  );
}
