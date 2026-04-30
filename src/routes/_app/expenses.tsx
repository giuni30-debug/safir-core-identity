import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, X, TrendingUp, TrendingDown, Coffee, ShoppingBag, Car, Home, Utensils, Wallet } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

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
};

const LS = "spl_expenses_v1";
const CATS = [
  { key: "Food", icon: Utensils },
  { key: "Coffee", icon: Coffee },
  { key: "Shopping", icon: ShoppingBag },
  { key: "Transport", icon: Car },
  { key: "Home", icon: Home },
  { key: "Income", icon: Wallet },
] as const;

function iconFor(cat: string) {
  return (CATS.find((c) => c.key === cat)?.icon ?? Wallet);
}

function useCount(target: number, ms = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const ease = 1 - Math.pow(1 - p, 3);
      setV(from + (target - from) * ease);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Expenses() {
  const { t, lang } = useApp();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [filter, setFilter] = useState<"today" | "week" | "month">("month");
  const [open, setOpen] = useState(false);

  const catLabel = (k: string) =>
    ({ Food: t("catFood"), Coffee: t("catCoffee"), Shopping: t("catShopping"), Transport: t("catTransport"), Home: t("catHome"), Income: t("catIncome") } as Record<string, string>)[k] ?? k;
  const filterLabel = (f: string) =>
    ({ today: t("filterToday"), week: t("filterWeek"), month: t("filterMonth") } as Record<string, string>)[f] ?? f;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LS);
      setTxs(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS, JSON.stringify(txs));
  }, [txs]);

  const filtered = useMemo(() => {
    const now = new Date();
    return txs.filter((t) => {
      const d = new Date(t.date);
      const diff = (now.getTime() - d.getTime()) / 86400000;
      if (filter === "today") return d.toDateString() === now.toDateString();
      if (filter === "week") return diff <= 7;
      return diff <= 31;
    });
  }, [txs, filter]);

  const total = useMemo(() => filtered.reduce((s, t) => s + t.amount, 0), [filtered]);
  const animTotal = useCount(total);

  // 7-day bar chart data
  const chart = useMemo(() => {
    const days: { label: string; v: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const v = txs
        .filter((t) => new Date(t.date).toDateString() === d.toDateString() && t.amount < 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      days.push({ label: d.toLocaleDateString(lang, { weekday: "short" }).slice(0, 2), v });
    }
    return days;
  }, [txs]);
  const maxV = Math.max(1, ...chart.map((c) => c.v));

  function add(tx: Omit<Tx, "id" | "date">) {
    setTxs((p) => [{ ...tx, id: crypto.randomUUID(), date: new Date().toISOString() }, ...p]);
  }

  return (
    <div className="flex min-h-full flex-col animate-[fade-in_0.4s_ease-out] pb-24">
      <header className="flex items-center gap-3 py-1">
        <Link to="/home" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">{t("expenses")}</h1>
      </header>

      {/* Total */}
      <div className="mt-4 flex flex-col items-center text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("totalBalance")}</p>
        <p
          className="mt-2 text-5xl font-bold tabular-nums"
          style={{
            color: total >= 0 ? "var(--theme-accent)" : "oklch(0.7 0.2 25)",
            textShadow: "0 0 28px color-mix(in oklab, var(--theme-accent) 45%, transparent)",
          }}
        >
          {animTotal < 0 ? "-" : ""}${Math.abs(animTotal).toFixed(2)}
        </p>
      </div>

      {/* Chart */}
      <div className="glass-card mt-6 p-4" style={{ borderRadius: 20 }}>
        <p className="mb-3 text-xs text-muted-foreground">{t("last7days")}</p>
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

      {/* Filters */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {(["today", "week", "month"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-2xl border px-3 py-2 text-sm transition-all"
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

      {/* Transactions */}
      <div className="mt-5 flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("noTransactions")}</p>
        )}
        {filtered.map((t, i) => {
          const Icon = iconFor(t.category);
          const income = t.amount >= 0;
          return (
            <div
              key={t.id}
              className="glass-card flex items-center gap-3 p-3"
              style={{ borderRadius: 16, animation: `fade-in 0.3s ease-out ${i * 40}ms both` }}
            >
              <div
                className="grid h-11 w-11 place-items-center rounded-2xl"
                style={{
                  background: "color-mix(in oklab, var(--theme-accent) 14%, transparent)",
                  color: "var(--theme-accent)",
                }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.date).toLocaleDateString(lang)} · {catLabel(t.category)}
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
                  {income ? "+" : "-"}${Math.abs(t.amount).toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Add expense"
        className="neon-circle press-glow fixed bottom-20 right-5 z-30 grid h-14 w-14 place-items-center rounded-full text-white"
      >
        <Plus className="h-6 w-6" />
      </button>

      {open && <AddModal t={t} catLabel={catLabel} onClose={() => setOpen(false)} onAdd={add} />}
    </div>
  );
}

function AddModal({ t, catLabel, onClose, onAdd }: { t: (k: any) => string; catLabel: (k: string) => string; onClose: () => void; onAdd: (t: Omit<Tx, "id" | "date">) => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("Food");
  const [income, setIncome] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!name.trim() || isNaN(n) || n <= 0) return;
    onAdd({ name: name.trim(), amount: income ? n : -n, category: income ? "Income" : category });
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
          <h2 className="text-lg font-semibold">{t("addTransaction")}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-card/60">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setIncome(false)} className="rounded-xl border py-2 text-sm" style={!income ? { borderColor: "var(--theme-accent)", color: "var(--theme-accent)" } : {}}>{t("expense")}</button>
          <button type="button" onClick={() => setIncome(true)} className="rounded-xl border py-2 text-sm" style={income ? { borderColor: "oklch(0.78 0.18 145)", color: "oklch(0.78 0.18 145)" } : {}}>{t("income")}</button>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name")} className="mb-2 w-full rounded-xl border border-border bg-card/40 px-3 py-2 text-sm outline-none" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("amount")} inputMode="decimal" className="mb-3 w-full rounded-xl border border-border bg-card/40 px-3 py-2 text-sm outline-none" />
        {!income && (
          <div className="mb-4 grid grid-cols-3 gap-2">
            {CATS.filter((c) => c.key !== "Income").map((c) => (
              <button key={c.key} type="button" onClick={() => setCategory(c.key)} className="rounded-xl border px-2 py-2 text-xs" style={category === c.key ? { borderColor: "var(--theme-accent)", color: "var(--theme-accent)" } : {}}>{catLabel(c.key)}</button>
            ))}
          </div>
        )}
        <button type="submit" className="neon-circle w-full rounded-2xl py-3 text-sm font-semibold text-white">{t("save")}</button>
      </form>
    </div>
  );
}
