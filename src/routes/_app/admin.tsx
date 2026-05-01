import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Activity, Users, BarChart3, AlertTriangle, Clock, Trash2 } from "lucide-react";
import {
  getStats, getEvents, clearEvents, subscribe,
  type AnalyticsStats, type AnalyticsEvent,
} from "@/lib/analytics";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Analytics — Safir" },
      { name: "description", content: "Simple in-app analytics and monitoring." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminPage() {
  const [stats, setStats] = useState<AnalyticsStats>(() => getStats());
  const [recent, setRecent] = useState<AnalyticsEvent[]>(() => getEvents().slice(0, 30));

  useEffect(() => {
    const refresh = () => {
      setStats(getStats());
      setRecent(getEvents().slice(0, 30));
    };
    refresh();
    return subscribe(refresh);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/settings" className="rounded-full p-2 hover:bg-white/5" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">Analytics</h1>
          <button
            type="button"
            onClick={() => { if (confirm("Clear all analytics data?")) clearEvents(); }}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Activity className="h-4 w-4" />} label="App opens" value={stats.totalAppOpens} />
          <StatCard icon={<BarChart3 className="h-4 w-4" />} label="Events" value={stats.totalEvents} />
          <StatCard icon={<Users className="h-4 w-4" />} label="Users (24h)" value={stats.activeUsers24h} />
          <StatCard icon={<Users className="h-4 w-4" />} label="Users (all)" value={stats.activeUsers} />
        </section>

        <Card title="Most used modules" icon={<BarChart3 className="h-4 w-4" />}>
          {stats.moduleCounts.length === 0 ? (
            <Empty text="No module activity yet." />
          ) : (
            <ul className="space-y-2">
              {stats.moduleCounts.map((m) => {
                const max = stats.moduleCounts[0]?.count || 1;
                const pct = Math.round((m.count / max) * 100);
                return (
                  <li key={m.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{m.name}</span>
                      <span className="text-white/60">{m.count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                      <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Errors" icon={<AlertTriangle className="h-4 w-4 text-red-400" />}>
          {stats.errors.length === 0 ? (
            <Empty text="No errors recorded." />
          ) : (
            <ul className="divide-y divide-white/5">
              {stats.errors.map((e) => (
                <li key={e.id} className="py-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="truncate text-red-300">
                      {String((e.meta as { message?: string })?.message ?? "Error")}
                    </span>
                    <time className="shrink-0 text-xs text-white/50">{fmtTime(e.ts)}</time>
                  </div>
                  <p className="text-xs text-white/50">
                    {String((e.meta as { source?: string })?.source ?? "")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent activity" icon={<Clock className="h-4 w-4" />}>
          {!stats.lastActivity ? (
            <Empty text="No activity yet." />
          ) : (
            <ul className="divide-y divide-white/5">
              {recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">{e.name}</span>
                  <time className="shrink-0 text-xs text-white/50">{fmtTime(e.ts)}</time>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="px-1 pt-2 text-center text-xs text-white/40">
          Local-only analytics. Stored on this device.
        </p>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-xs text-white/60">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
        {icon}{title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-center text-sm text-white/50">{text}</p>;
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  const now = Date.now();
  const diff = Math.floor((now - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleString();
}
