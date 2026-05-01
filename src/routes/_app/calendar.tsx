import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X, Clock } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTrackScreen } from "@/hooks/useTrackScreen";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
  head: () => ({
    meta: [
      { title: "Calendar — Safir Private Life" },
      { name: "description", content: "Plan your days in style." },
    ],
  }),
});

type Event = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  notes: string;
};

const LS = "spl_events_v1";

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function CalendarPage() {
  const { t, lang } = useApp();
  const today = new Date();
  useTrackScreen("calendar_opened");
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(ymd(today));
  const [events, setEvents] = useState<Event[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LS);
      setEvents(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS, JSON.stringify(events));
  }, [events]);

  const grid = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startDay = first.getDay(); // 0=Sun
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  const todayStr = ymd(today);
  const dayEvents = useMemo(() => events.filter((e) => e.date === selected).sort((a, b) => a.time.localeCompare(b.time)), [events, selected]);
  const eventDays = useMemo(() => new Set(events.map((e) => e.date)), [events]);

  function shift(delta: number) {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }
  function add(e: Omit<Event, "id">) {
    setEvents((p) => [...p, { ...e, id: crypto.randomUUID() }]);
  }
  function remove(id: string) {
    setEvents((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="flex min-h-full flex-col animate-[fade-in_0.4s_ease-out] pb-24">
      <header className="flex items-center gap-3 py-1">
        <Link to="/home" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">{t("calendar")}</h1>
      </header>

      {/* Month header */}
      <div className="mt-4 flex items-center justify-between">
        <button onClick={() => shift(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-card/40 border border-border" aria-label={t("prev")}><ChevronLeft className="h-5 w-5" /></button>
        <div key={view.toISOString()} className="text-center animate-[fade-in_0.3s_ease-out]">
          <p className="text-2xl font-bold">{view.toLocaleString(lang, { month: "long" })}</p>
          <p className="text-xs text-muted-foreground">{view.getFullYear()}</p>
        </div>
        <button onClick={() => shift(1)} className="grid h-10 w-10 place-items-center rounded-full bg-card/40 border border-border" aria-label={t("next")}><ChevronRight className="h-5 w-5" /></button>
      </div>

      {/* Grid */}
      <div className="glass-card mt-5 p-3" style={{ borderRadius: 20 }}>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div key={view.toISOString()} className="grid grid-cols-7 gap-1 animate-[fade-in_0.3s_ease-out]">
          {grid.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square" />;
            const ds = ymd(d);
            const isToday = ds === todayStr;
            const isSel = ds === selected;
            const has = eventDays.has(ds);
            return (
              <button
                key={i}
                onClick={() => setSelected(ds)}
                className="relative grid aspect-square place-items-center rounded-xl text-sm transition-all"
                style={{
                  border: isSel ? "1.5px solid var(--theme-accent)" : "1px solid transparent",
                  background: isToday
                    ? "color-mix(in oklab, var(--theme-accent) 22%, transparent)"
                    : isSel
                      ? "color-mix(in oklab, var(--theme-accent) 10%, transparent)"
                      : "transparent",
                  boxShadow: isToday
                    ? "0 0 16px color-mix(in oklab, var(--theme-accent) 45%, transparent)"
                    : isSel
                      ? "0 0 12px color-mix(in oklab, var(--theme-accent) 30%, transparent)"
                      : "none",
                  color: isToday ? "var(--theme-accent)" : undefined,
                  fontWeight: isToday ? 700 : 500,
                }}
              >
                {d.getDate()}
                {has && (
                  <span
                    className="absolute bottom-1 h-1 w-1 rounded-full"
                    style={{ background: "var(--theme-accent)", boxShadow: "0 0 6px var(--theme-accent)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Events */}
      <div className="mt-5">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          {new Date(selected).toLocaleDateString(lang, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <div className="flex flex-col gap-2">
          {dayEvents.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("noEvents")}</p>}
          {dayEvents.map((e, i) => (
            <div
              key={e.id}
              className="glass-card flex items-center gap-3 p-3"
              style={{ borderRadius: 16, animation: `fade-in 0.3s ease-out ${i * 40}ms both` }}
            >
              <div className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: "color-mix(in oklab, var(--theme-accent) 16%, transparent)", color: "var(--theme-accent)" }}>
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{e.title}</p>
                <p className="text-xs text-muted-foreground">{e.time}{e.notes ? ` · ${e.notes}` : ""}</p>
              </div>
              <button onClick={() => remove(e.id)} aria-label="Delete" className="grid h-9 w-9 place-items-center rounded-full bg-card/40">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setOpen(true)}
        aria-label="Add event"
        className="neon-circle press-glow fixed bottom-20 right-5 z-30 grid h-14 w-14 place-items-center rounded-full text-white"
      >
        <Plus className="h-6 w-6" />
      </button>

      {open && <AddEvent date={selected} t={t} onClose={() => setOpen(false)} onAdd={add} />}
    </div>
  );
}

function AddEvent({ date, t, onClose, onAdd }: { date: string; t: (k: any) => string; onClose: () => void; onAdd: (e: Omit<Event, "id">) => void }) {
  const [title, setTitle] = useState("");
  const [d, setD] = useState(date);
  const [time, setTime] = useState("12:00");
  const [notes, setNotes] = useState("");

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!title.trim()) return;
    onAdd({ title: title.trim(), date: d, time, notes: notes.trim() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="glass-card w-full max-w-md p-5 animate-[scale-in_0.25s_ease-out]"
        style={{ borderRadius: "24px 24px 0 0" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("newEvent")}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-card/60"><X className="h-4 w-4" /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("title")} autoFocus className="mb-2 w-full rounded-xl border border-border bg-card/40 px-3 py-2 text-sm outline-none" />
        <div className="mb-2 grid grid-cols-2 gap-2">
          <input type="date" value={d} onChange={(e) => setD(e.target.value)} className="rounded-xl border border-border bg-card/40 px-3 py-2 text-sm outline-none" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-xl border border-border bg-card/40 px-3 py-2 text-sm outline-none" />
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notes_field")} rows={3} className="mb-4 w-full resize-none rounded-xl border border-border bg-card/40 px-3 py-2 text-sm outline-none" />
        <button type="submit" className="neon-circle w-full rounded-2xl py-3 text-sm font-semibold text-white">{t("save")}</button>
      </form>
    </div>
  );
}
