import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, X, MapPin, Clock, Check, Trash2, Pencil, CalendarClock } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/appointments")({
  component: Appointments,
  head: () => ({
    meta: [
      { title: "Appointments — Safir Private Life" },
      { name: "description", content: "Manage your appointments." },
    ],
  }),
});

type Appt = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location?: string;
  done: boolean;
};

const LS = "spl_appointments_v1";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Appointments() {
  const { t, lang } = useApp();
  const [items, setItems] = useState<Appt[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appt | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LS);
      setItems(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS, JSON.stringify(items));
  }, [items]);

  const today = ymd(new Date());

  const { todays, upcoming, past } = useMemo(() => {
    const sorted = [...items].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return {
      todays: sorted.filter((a) => a.date === today),
      upcoming: sorted.filter((a) => a.date > today),
      past: sorted.filter((a) => a.date < today),
    };
  }, [items, today]);

  function save(a: Appt) {
    setItems((p) => {
      const idx = p.findIndex((x) => x.id === a.id);
      if (idx === -1) return [...p, a];
      const next = [...p];
      next[idx] = a;
      return next;
    });
  }
  function toggle(id: string) {
    setItems((p) => p.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  }
  function remove(id: string) {
    setItems((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="flex min-h-full flex-col animate-[fade-in_0.4s_ease-out] pb-24">
      <header className="flex items-center gap-3 py-1">
        <Link to="/home" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">{t("appointments")}</h1>
      </header>

      <Section title={t("today")} lang={lang} t={t} items={todays} expanded={expanded} setExpanded={setExpanded} onToggle={toggle} onDelete={remove} onEdit={(a) => { setEditing(a); setOpen(true); }} />
      <Section title={t("upcoming")} lang={lang} t={t} items={upcoming} expanded={expanded} setExpanded={setExpanded} onToggle={toggle} onDelete={remove} onEdit={(a) => { setEditing(a); setOpen(true); }} />
      {past.length > 0 && (
        <Section title={t("past")} lang={lang} t={t} items={past} expanded={expanded} setExpanded={setExpanded} onToggle={toggle} onDelete={remove} onEdit={(a) => { setEditing(a); setOpen(true); }} />
      )}
      {items.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title="No appointments scheduled"
          subtitle="Plan meetings, reminders and personal events — all in one place."
          ctaLabel="Add appointment"
          onCta={() => { setEditing(null); setOpen(true); }}
        />
      )}

      <button
        onClick={() => { setEditing(null); setOpen(true); }}
        aria-label="Add appointment"
        className="neon-circle press-glow fixed bottom-20 right-5 z-30 grid h-14 w-14 place-items-center rounded-full text-white"
      >
        <Plus className="h-6 w-6" />
      </button>

      {open && (
        <ApptModal
          initial={editing}
          t={t}
          onClose={() => { setOpen(false); setEditing(null); }}
          onSave={(a) => { save(a); setOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function Section({
  title, lang, t, items, expanded, setExpanded, onToggle, onDelete, onEdit,
}: {
  title: string;
  lang: string;
  t: (k: any) => string;
  items: Appt[];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (a: Appt) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-2">
        {items.map((a, i) => {
          const isOpen = expanded === a.id;
          return (
            <div
              key={a.id}
              className="glass-card overflow-hidden p-3 transition-all"
              style={{
                borderRadius: 18,
                animation: `fade-in 0.3s ease-out ${i * 50}ms both`,
                opacity: a.done ? 0.6 : 1,
              }}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : a.id)}
                className="flex w-full items-center gap-3 text-left"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle(a.id); }}
                  aria-label="Toggle complete"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border-2"
                  style={
                    a.done
                      ? { borderColor: "oklch(0.78 0.18 145)", background: "color-mix(in oklab, oklch(0.78 0.18 145) 18%, transparent)", color: "oklch(0.78 0.18 145)" }
                      : { borderColor: "color-mix(in oklab, var(--theme-accent) 60%, transparent)", color: "var(--theme-accent)" }
                  }
                >
                  {a.done ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${a.done ? "line-through" : ""}`}>{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.date).toLocaleDateString(lang, { weekday: "short", month: "short", day: "numeric" })} · {a.time}
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  style={
                    a.done
                      ? { background: "color-mix(in oklab, oklch(0.78 0.18 145) 18%, transparent)", color: "oklch(0.78 0.18 145)" }
                      : { background: "color-mix(in oklab, var(--theme-accent) 18%, transparent)", color: "var(--theme-accent)" }
                  }
                >
                  {a.done ? t("done") : t("active")}
                </span>
              </button>

              <div
                className="grid transition-all duration-300"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-3">
                    {a.location && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {a.location}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEdit(a)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card/40 py-2 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" /> {t("edit")}
                      </button>
                      <button
                        onClick={() => onDelete(a.id)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs"
                        style={{ borderColor: "oklch(0.7 0.2 25)", color: "oklch(0.7 0.2 25)" }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t("delete")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApptModal({ initial, t, onClose, onSave }: { initial: Appt | null; t: (k: any) => string; onClose: () => void; onSave: (a: Appt) => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? ymd(new Date()));
  const [time, setTime] = useState(initial?.time ?? "12:00");
  const [location, setLocation] = useState(initial?.location ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      date,
      time,
      location: location.trim() || undefined,
      done: initial?.done ?? false,
    });
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
          <h2 className="text-lg font-semibold">{initial ? t("editAppointment") : t("newAppointment")}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-card/60"><X className="h-4 w-4" /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("title")} autoFocus className="mb-2 w-full rounded-xl border border-border bg-card/40 px-3 py-2 text-sm outline-none" />
        <div className="mb-2 grid grid-cols-2 gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-border bg-card/40 px-3 py-2 text-sm outline-none" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-xl border border-border bg-card/40 px-3 py-2 text-sm outline-none" />
        </div>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={`${t("location")} (${t("optional")})`} className="mb-4 w-full rounded-xl border border-border bg-card/40 px-3 py-2 text-sm outline-none" />
        <button type="submit" className="neon-circle w-full rounded-2xl py-3 text-sm font-semibold text-white">{t("save")}</button>
      </form>
    </div>
  );
}
