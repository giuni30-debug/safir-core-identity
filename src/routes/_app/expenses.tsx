import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Plus, X, TrendingUp, TrendingDown, Coffee, ShoppingBag, Car, Home,
  Utensils, Wallet, Receipt, Sparkles, Trash2, Copy, Filter, Zap, FileText,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { EmptyState } from "@/components/EmptyState";
import { NeonFab } from "@/components/NeonFab";
import { useWallet, useAnimatedNumber } from "@/hooks/useWallet";
import { toast } from "sonner";
import { useTrackScreen } from "@/hooks/useTrackScreen";

export const Route = createFileRoute("/_app/expenses")({
  component: Expenses,
  head: () => ({
    meta: [
      { title: "Expenses — Safir Private Life" },
      { name: "description", content: "Track your spending in style." },
    ],
  }),
});

type Tx = {
  id: string;
  name: string;
  amount: number; // positive=income, negative=expense
  category: string;
  date: string; // ISO
  note?: string;
};

const LS = "spl_expenses_v1";

// ---- Categories with neon color glow ----
const CATS = [
  { key: "Food",      icon: Utensils,   color: "oklch(0.78 0.18 145)" }, // green
  { key: "Coffee",    icon: Coffee,     color: "oklch(0.72 0.16 60)"  }, // amber
  { key: "Shopping",  icon: ShoppingBag,color: "oklch(0.7 0.22 320)"  }, // pink
  { key: "Transport", icon: Car,        color: "oklch(0.75 0.18 230)" }, // blue
  { key: "Bills",     icon: FileText,   color: "oklch(0.72 0.18 30)"  }, // orange
  { key: "Home",      icon: Home,       color: "oklch(0.74 0.16 280)" }, // violet
  { key: "Income",    icon: Wallet,     color: "oklch(0.78 0.18 145)" },
] as const;

function catMeta(cat: string) {
  return CATS.find((c) => c.key === cat) ?? CATS[CATS.length - 1];
}

// ---- Auto category detection ----
const AUTO: Record<string, string[]> = {
  Food: ["food","grocery","groceries","milk","bread","egg","cheese","fruit","vegetable","restaurant","lunch","dinner","breakfast","pizza","burger","sushi","kebab","mancare","alimente","piata"],
  Coffee: ["coffee","espresso","latte","cappuccino","starbucks","cafea"],
  Transport: ["fuel","gas","gasoline","petrol","diesel","taxi","uber","bolt","metro","bus","train","parking","toll","benzina","motorina"],
  Bills: ["rent","internet","wifi","electric","electricity","power","water","gas bill","subscription","netflix","spotify","phone","mobile","chirie","factura","abonament"],
  Shopping: ["clothes","shoes","shirt","pants","jacket","dress","amazon","emag","zalando","haine","incaltaminte"],
  Home: ["furniture","ikea","cleaner","cleaning","detergent","dish","mop","casa","mobila"],
};
function autoDetectCategory(name: string): string {
  const n = name.toLowerCase();
  let best = "Shopping";
  let bestScore = 0;
  Object.entries(AUTO).forEach(([cat, kws]) => {
    const s = kws.reduce((acc, k) => acc + (n.includes(k) ? k.length : 0), 0);
    if (s > bestScore) { bestScore = s; best = cat; }
  });
  return bestScore > 0 ? best : "Shopping";
}

function formatDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Expenses() {
  const { t, lang } = useApp();
  const { balance } = useWallet();
  useTrackScreen("expenses_opened");
  const [txs, setTxs] = useState<Tx[]>([]);
  const [filter, setFilter] = useState<"today" | "week" | "month">("month");
  const [catFilter, setCatFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);

  const catLabel = (k: string) =>
    ({ Food: t("catFood"), Coffee: t("catCoffee"), Shopping: t("catShopping"), Transport: t("catTransport"), Home: t("catHome"), Income: t("catIncome"), Bills: "Bills" } as Record<string, string>)[k] ?? k;
  const filterLabel = (f: string) =>
    ({ today: t("filterToday"), week: t("filterWeek"), month: t("filterMonth") } as Record<string, string>)[f] ?? f;

  // Load + listen for cross-screen updates (e.g. Shopping marks an item as bought)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const load = () => {
      try {
        const raw = localStorage.getItem(LS);
        setTxs(raw ? JSON.parse(raw) : []);
      } catch {}
    };
    load();
    const onStorage = (e: StorageEvent) => { if (e.key === LS) load(); };
    const onCustom = () => load();
    window.addEventListener("storage", onStorage);
    window.addEventListener("spl-expenses-changed", onCustom as EventListener);
    // Poll once per second as a safety net for same-tab writes from other modules
    const id = setInterval(load, 1500);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("spl-expenses-changed", onCustom as EventListener);
      clearInterval(id);
    };
  }, []);

  const persist = (next: Tx[]) => {
    setTxs(next);
    localStorage.setItem(LS, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("spl-expenses-changed"));
  };

  // ---- Period sums (stable, regardless of selected filter) ----
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = now.getTime() - 7 * 86400000;
  const monthAgo = now.getTime() - 31 * 86400000;
  const sumExp = (sinceMs: number) =>
    txs.filter((tx) => tx.amount < 0 && new Date(tx.date).getTime() >= sinceMs)
       .reduce((s, tx) => s + Math.abs(tx.amount), 0);
  const todaySpent = sumExp(startOfDay);
  const weekSpent = sumExp(weekAgo);
  const monthSpent = sumExp(monthAgo);

  // ---- Real-time balance = wallet - month expenses ----
  const realBalance = balance - monthSpent;
  const animBalance = useAnimatedNumber(realBalance);
  const animToday = useAnimatedNumber(todaySpent);
  const animWeek = useAnimatedNumber(weekSpent);
  const animMonth = useAnimatedNumber(monthSpent);

  // ---- Filtering ----
  const filtered = useMemo(() => {
    return txs
      .filter((tx) => {
        const d = new Date(tx.date);
        if (filter === "today") return d.toDateString() === now.toDateString();
        if (filter === "week") return d.getTime() >= weekAgo;
        return d.getTime() >= monthAgo;
      })
      .filter((tx) => catFilter === "All" || tx.category === catFilter)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, filter, catFilter]);

  // ---- 7-day chart ----
  const chart = useMemo(() => {
    const days: { label: string; v: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const v = txs
        .filter((tx) => new Date(tx.date).toDateString() === d.toDateString() && tx.amount < 0)
        .reduce((s, tx) => s + Math.abs(tx.amount), 0);
      days.push({ label: d.toLocaleDateString(lang, { weekday: "short" }).slice(0, 2), v });
    }
    return days;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, lang]);
  const maxV = Math.max(1, ...chart.map((c) => c.v));

  // ---- Top category (this month) ----
  const topCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    txs.filter((tx) => tx.amount < 0 && new Date(tx.date).getTime() >= monthAgo)
      .forEach((tx) => { totals[tx.category] = (totals[tx.category] ?? 0) + Math.abs(tx.amount); });
    let best: string | null = null; let bestVal = 0;
    Object.entries(totals).forEach(([c, v]) => { if (v > bestVal) { bestVal = v; best = c; } });
    return best ? { cat: best, value: bestVal, share: monthSpent > 0 ? bestVal / monthSpent : 0 } : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs]);

  // ---- AI-style insights (heuristic, no network) ----
  const insights = useMemo(() => {
    const out: string[] = [];
    if (txs.length === 0) return out;
    // 1) week vs prior week
    const prevWeekSpent = txs
      .filter((tx) => tx.amount < 0 && new Date(tx.date).getTime() < weekAgo && new Date(tx.date).getTime() >= weekAgo - 7 * 86400000)
      .reduce((s, tx) => s + Math.abs(tx.amount), 0);
    if (prevWeekSpent > 0 && weekSpent > prevWeekSpent * 1.2) {
      const diff = weekSpent - prevWeekSpent;
      out.push(`You spent €${diff.toFixed(2)} more this week than last.`);
    } else if (prevWeekSpent > 0 && weekSpent < prevWeekSpent * 0.8) {
      out.push(`Nice — you spent €${(prevWeekSpent - weekSpent).toFixed(2)} less than last week.`);
    }
    // 2) top category dominance
    if (topCategory && topCategory.share >= 0.4) {
      out.push(`Most of your money goes to ${catLabel(topCategory.cat)} (${Math.round(topCategory.share * 100)}%).`);
    }
    // 3) suggestion to reduce
    if (monthSpent > 100 && topCategory) {
      const target = Math.round(topCategory.value * 0.15 / 5) * 5;
      if (target >= 5) out.push(`Try trimming ${catLabel(topCategory.cat)} by €${target} next month.`);
    }
    // 4) low-balance warning
    if (realBalance < 0) out.push(`You're €${Math.abs(realBalance).toFixed(2)} over your wallet for this month.`);
    return out.slice(0, 3);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, weekSpent, monthSpent, topCategory, realBalance]);

  // ---- Mutations ----
  function addTx(payload: Omit<Tx, "id">) {
    persist([{ ...payload, id: crypto.randomUUID() }, ...txs]);
    toast.success("Expense added");
  }
  function updateTx(id: string, patch: Partial<Tx>) {
    persist(txs.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)));
  }
  function deleteTx(id: string) {
    persist(txs.filter((tx) => tx.id !== id));
    toast.success("Deleted");
  }
  function duplicateTx(id: string) {
    const src = txs.find((tx) => tx.id === id);
    if (!src) return;
    addTx({ ...src, date: new Date().toISOString() });
  }

  const cats = useMemo(() => Array.from(new Set(["All", ...txs.map((tx) => tx.category)])), [txs]);

  return (
    <div className="flex min-h-full flex-col animate-[fade-in_0.4s_ease-out] pb-28">
      <header className="flex items-center gap-3 py-1">
        <Link to="/home" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 press-glow">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">{t("expenses")}</h1>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="ml-auto grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 press-glow"
          aria-label="Filters"
        >
          <Filter className="h-5 w-5" style={{ color: showFilters ? "var(--theme-accent)" : undefined }} />
        </button>
      </header>

      {/* Balance — wallet minus month spend */}
      <div className="mt-4 flex flex-col items-center text-center">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Balance</p>
        <p
          className="mt-2 text-5xl font-bold tabular-nums"
          style={{
            color: realBalance >= 0 ? "var(--theme-accent)" : "oklch(0.7 0.2 25)",
            textShadow: "0 0 28px color-mix(in oklab, var(--theme-accent) 45%, transparent)",
          }}
        >
          {animBalance < 0 ? "-" : ""}€{Math.abs(animBalance).toFixed(2)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Wallet €{balance.toFixed(2)} − Spent this month €{monthSpent.toFixed(2)}
        </p>
      </div>

      {/* Quick stats */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <QuickStat label="Today" value={`€${animToday.toFixed(2)}`} />
        <QuickStat label="Week" value={`€${animWeek.toFixed(2)}`} accent />
        <QuickStat label="Month" value={`€${animMonth.toFixed(2)}`} />
      </div>

      {/* Chart */}
      <div className="glass-card mt-5 p-4" style={{ borderRadius: 20 }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Last 7 days</p>
          {topCategory && (
            <p className="text-[11px] text-muted-foreground">
              Top: <span style={{ color: catMeta(topCategory.cat).color }}>{catLabel(topCategory.cat)}</span>
            </p>
          )}
        </div>
        <div className="flex h-32 items-end gap-2">
          {chart.map((c, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-lg"
                style={{
                  height: `${(c.v / maxV) * 100}%`,
                  minHeight: 4,
                  background: "linear-gradient(to top, color-mix(in oklab, var(--theme-accent) 70%, transparent), var(--theme-accent))",
                  boxShadow: "0 0 14px color-mix(in oklab, var(--theme-accent) 40%, transparent)",
                  animation: `fade-in 0.5s ease-out ${i * 60}ms both`,
                }}
              />
              <span className="text-[10px] text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI insights */}
      {insights.length > 0 && (
        <div
          className="glass-card mt-5 p-4"
          style={{
            borderRadius: 20,
            boxShadow: "0 0 18px color-mix(in oklab, var(--theme-accent) 18%, transparent)",
          }}
        >
          <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--theme-accent)" }} />
            Smart insights
          </p>
          <ul className="space-y-1.5">
            {insights.map((line, i) => (
              <li key={i} className="text-sm leading-snug" style={{ animation: `fade-in 0.4s ease-out ${i * 80}ms both` }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Period filters */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {(["today", "week", "month"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-2xl border px-3 py-2 text-sm transition-all press-glow"
            style={
              filter === f
                ? {
                    borderColor: "var(--theme-accent)",
                    background: "color-mix(in oklab, var(--theme-accent) 18%, transparent)",
                    boxShadow: "0 0 18px color-mix(in oklab, var(--theme-accent) 30%, transparent)",
                    color: "var(--theme-accent)",
                  }
                : { borderColor: "hsl(var(--border))", background: "transparent" }
            }
          >
            {filterLabel(f)}
          </button>
        ))}
      </div>

      {/* Category filters */}
      {showFilters && cats.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cats.map((c) => {
            const active = catFilter === c;
            const meta = c === "All" ? null : catMeta(c);
            return (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className="rounded-full border px-3 py-1.5 text-xs press-glow"
                style={
                  active
                    ? {
                        borderColor: meta?.color ?? "var(--theme-accent)",
                        color: meta?.color ?? "var(--theme-accent)",
                        background: `color-mix(in oklab, ${meta?.color ?? "var(--theme-accent)"} 14%, transparent)`,
                        boxShadow: `0 0 12px color-mix(in oklab, ${meta?.color ?? "var(--theme-accent)"} 45%, transparent)`,
                      }
                    : { borderColor: "hsl(var(--border))" }
                }
              >
                {c === "All" ? "All" : catLabel(c)}
              </button>
            );
          })}
        </div>
      )}

      {/* Transactions */}
      <div className="mt-5 flex flex-col gap-2">
        {filtered.length === 0 && (
          <EmptyState
            icon={Receipt}
            title="Start tracking your money"
            subtitle="Every expense counts."
            ctaLabel="Add expense"
            onCta={() => setOpen(true)}
          />
        )}
        {filtered.map((tx, i) => (
          <TxRow
            key={tx.id}
            tx={tx}
            label={catLabel(tx.category)}
            lang={lang}
            indexDelay={i * 40}
            onEdit={() => setEditing(tx)}
            onDelete={() => deleteTx(tx.id)}
            onDuplicate={() => duplicateTx(tx.id)}
          />
        ))}
      </div>

      <NeonFab onClick={() => setOpen(true)} ariaLabel="Add expense" />

      {(open || editing) && (
        <AddModal
          t={t}
          catLabel={catLabel}
          initial={editing}
          onClose={() => { setOpen(false); setEditing(null); }}
          onSubmit={(payload) => {
            if (editing) updateTx(editing.id, payload);
            else addTx(payload);
            setOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function QuickStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="rounded-2xl border bg-card/30 p-3 backdrop-blur-xl"
      style={{
        borderColor: accent
          ? "color-mix(in oklab, var(--theme-accent) 50%, transparent)"
          : "color-mix(in oklab, var(--theme-accent) 22%, transparent)",
        boxShadow: accent ? "0 0 18px color-mix(in oklab, var(--theme-accent) 30%, transparent)" : undefined,
      }}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        key={value}
        className="mt-1 text-base font-bold tabular-nums animate-[scale-in_0.25s_ease-out]"
        style={{
          color: accent ? "var(--theme-accent)" : "#fff",
          textShadow: accent ? "0 0 14px color-mix(in oklab, var(--theme-accent) 70%, transparent)" : undefined,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function TxRow({
  tx, label, lang, indexDelay, onEdit, onDelete, onDuplicate,
}: {
  tx: Tx; label: string; lang: string; indexDelay: number;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const meta = catMeta(tx.category);
  const Icon = meta.icon;
  const income = tx.amount >= 0;

  // Swipe + hold gestures
  const [dx, setDx] = useState(0);
  const startX = useRef(0);
  const startT = useRef(0);
  const tracking = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const consumedRef = useRef(false);

  function clearHold() {
    if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
  }
  function onPointerDown(e: React.PointerEvent) {
    tracking.current = true;
    consumedRef.current = false;
    startX.current = e.clientX;
    startT.current = Date.now();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    holdTimer.current = window.setTimeout(() => {
      if (Math.abs(dx) < 8 && tracking.current) {
        consumedRef.current = true;
        onDuplicate();
        toast.success("Duplicated");
      }
    }, 550);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!tracking.current) return;
    const d = e.clientX - startX.current;
    if (Math.abs(d) > 6) clearHold();
    setDx(Math.max(-140, Math.min(40, d)));
  }
  function onPointerUp() {
    tracking.current = false;
    clearHold();
    if (dx < -90) {
      setDx(0);
      onDelete();
    } else {
      // Tap = edit (only if not held/swiped)
      if (Math.abs(dx) < 6 && Date.now() - startT.current < 500 && !consumedRef.current) {
        onEdit();
      }
      setDx(0);
    }
  }

  return (
    <div className="relative" style={{ animation: `fade-in 0.3s ease-out ${indexDelay}ms both` }}>
      {dx < -20 && (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <Trash2 className="h-6 w-6" style={{ color: "oklch(0.75 0.22 25)", filter: "drop-shadow(0 0 8px oklch(0.7 0.22 25))" }} />
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { tracking.current = false; clearHold(); setDx(0); }}
        className="glass-card flex items-center gap-3 p-3"
        style={{
          borderRadius: 16,
          transform: `translateX(${dx}px)`,
          transition: tracking.current ? "none" : "transform 0.25s cubic-bezier(0.22,1,0.36,1)",
          touchAction: "pan-y",
        }}
      >
        <div
          className="grid h-11 w-11 place-items-center rounded-2xl"
          style={{
            background: `color-mix(in oklab, ${meta.color} 16%, transparent)`,
            color: meta.color,
            boxShadow: `0 0 14px color-mix(in oklab, ${meta.color} 35%, transparent)`,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{tx.name}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(tx.date).toLocaleDateString(lang)} · <span style={{ color: meta.color }}>{label}</span>
            {tx.note ? ` · ${tx.note}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 text-right">
          {income ? (
            <TrendingUp className="h-4 w-4" style={{ color: "oklch(0.78 0.18 145)" }} />
          ) : (
            <TrendingDown className="h-4 w-4" style={{ color: "oklch(0.7 0.2 25)" }} />
          )}
          <span
            className="font-semibold tabular-nums"
            style={{ color: income ? "oklch(0.78 0.18 145)" : "oklch(0.7 0.2 25)" }}
          >
            {income ? "+" : "-"}€{Math.abs(tx.amount).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function AddModal({
  t, catLabel, initial, onClose, onSubmit,
}: {
  t: (k: any) => string;
  catLabel: (k: string) => string;
  initial: Tx | null;
  onClose: () => void;
  onSubmit: (p: Omit<Tx, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(Math.abs(initial.amount)) : "");
  const [category, setCategory] = useState<string>(initial?.category ?? "Food");
  const [catTouched, setCatTouched] = useState(!!initial);
  const [income, setIncome] = useState(!!(initial && initial.amount > 0));
  const [date, setDate] = useState<string>(formatDateInput(initial ? new Date(initial.date) : new Date()));
  const [note, setNote] = useState(initial?.note ?? "");

  // Auto-detect category when typing the title
  useEffect(() => {
    if (catTouched || income || !name.trim()) return;
    setCategory(autoDetectCategory(name));
  }, [name, catTouched, income]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!name.trim() || isNaN(n) || n <= 0) return;
    const iso = new Date(`${date}T${new Date().toTimeString().slice(0, 8)}`).toISOString();
    onSubmit({
      name: name.trim(),
      amount: income ? n : -n,
      category: income ? "Income" : category,
      date: iso,
      note: note.trim() || undefined,
    });
  }

  const visibleCats = CATS.filter((c) => c.key !== "Income");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="glass-card w-full max-w-md p-5 animate-[scale-in_0.25s_ease-out]"
        style={{ borderRadius: "24px 24px 0 0" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? "Edit expense" : t("addTransaction")}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-card/60 press-glow">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setIncome(false)} className="rounded-xl border py-2 text-sm press-glow"
            style={!income ? { borderColor: "var(--theme-accent)", color: "var(--theme-accent)" } : { borderColor: "hsl(var(--border))" }}>
            {t("expense")}
          </button>
          <button type="button" onClick={() => setIncome(true)} className="rounded-xl border py-2 text-sm press-glow"
            style={income ? { borderColor: "oklch(0.78 0.18 145)", color: "oklch(0.78 0.18 145)" } : { borderColor: "hsl(var(--border))" }}>
            {t("income")}
          </button>
        </div>

        <input
          autoFocus value={name} onChange={(e) => setName(e.target.value)}
          placeholder={t("name") + " (required)"}
          className="mb-2 w-full rounded-xl border border-border bg-card/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-accent)]"
        />
        <div className="mb-2 grid grid-cols-2 gap-2">
          <input
            value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
            placeholder="€ Amount"
            className="rounded-xl border border-border bg-card/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-accent)]"
          />
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-border bg-card/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-accent)]"
          />
        </div>

        {!income && (
          <>
            <p className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground">
              <Zap className="h-3 w-3" style={{ color: "var(--theme-accent)" }} /> Category {catTouched ? "" : "(auto)"}
            </p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {visibleCats.map((c) => {
                const active = category === c.key;
                return (
                  <button
                    key={c.key} type="button"
                    onClick={() => { setCategory(c.key); setCatTouched(true); }}
                    className="rounded-full border px-3 py-1.5 text-xs press-glow"
                    style={active
                      ? {
                          borderColor: c.color, color: c.color,
                          background: `color-mix(in oklab, ${c.color} 14%, transparent)`,
                          boxShadow: `0 0 12px color-mix(in oklab, ${c.color} 50%, transparent)`,
                        }
                      : { borderColor: "hsl(var(--border))" }
                    }
                  >
                    {catLabel(c.key)}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <input
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="mb-4 w-full rounded-xl border border-border bg-card/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-accent)]"
        />

        <button type="submit" className="neon-circle press-glow w-full rounded-2xl py-3 text-sm font-semibold text-white"
          style={{ background: "var(--theme-accent)" }}>
          {t("save")}
        </button>
      </form>
    </div>
  );
}
