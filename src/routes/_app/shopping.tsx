import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/contexts/AppContext";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Plus, Check, Trash2, X, Wallet as WalletIcon,
  ShoppingBasket, Pencil, Minus, Sparkles, AlertTriangle, Mic, Zap,
  TrendingUp, History, Flame,
} from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_app/shopping")({
  component: ShoppingPage,
  head: () => ({
    meta: [
      { title: "Shopping List — Safir Private Life" },
      { name: "description", content: "Plan your shopping and track spending." },
    ],
  }),
});

type Category = "groceries" | "household" | "pharmacy" | "baby" | "pets" | "other";

type Item = {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  category: Category;
  note?: string;
  bought: boolean;
  createdAt: number;
};

const ITEMS_KEY = "spl_shop_list_v1";
const BUDGET_KEY = "spl_shop_budget_v1";

const CAT_EMOJI: Record<Category, string> = {
  groceries: "🛒",
  household: "🏠",
  pharmacy: "💊",
  baby: "🍼",
  pets: "🐾",
  other: "✨",
};

// ---- Smart category auto-detection ----
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  groceries: ["milk","bread","egg","cheese","butter","yogurt","apple","banana","tomato","potato","rice","pasta","chicken","beef","fish","coffee","tea","sugar","salt","oil","water","juice","wine","beer","chocolate","cookie","cereal","flour","onion","garlic","lapte","paine","oua","branza","cafea","apa","carne","ulei","faina"],
  household: ["paper","towel","light","bulb","battery","candle","trash","bag","foil","plate","cup","fork","spoon","hartie","servete","bec","baterie"],
  pharmacy: ["soap","shampoo","toothpaste","brush","detergent","bleach","cleaner","sponge","mask","vitamin","pill","sapun","sampon","clor","masca","vitamina"],
  baby: ["diaper","wipes","baby","formula","pacifier","scutece","biberon"],
  pets: ["dog","cat","pet","litter","kibble","caine","pisica"],
  other: [],
};
function autoDetectCategory(name: string): Category {
  const n = name.toLowerCase();
  let best: Category = "other";
  let bestScore = 0;
  (Object.keys(CATEGORY_KEYWORDS) as Category[]).forEach((cat) => {
    const score = CATEGORY_KEYWORDS[cat].reduce((s, kw) => s + (n.includes(kw) ? kw.length : 0), 0);
    if (score > bestScore) { bestScore = score; best = cat; }
  });
  return best;
}

// ---- Sync to Expenses ----
const EXPENSES_KEY = "spl_expenses_v1";
const SHOP_CAT_TO_EXPENSE: Record<Category, string> = {
  groceries: "Food", household: "Home", pharmacy: "Shopping",
  baby: "Shopping", pets: "Shopping", other: "Shopping",
};
function syncBoughtToExpenses(item: Item) {
  if (item.unitPrice <= 0) return;
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
      id: `shop-${item.id}`,
      name: item.qty > 1 ? `${item.name} ×${item.qty}` : item.name,
      amount: -(item.qty * item.unitPrice),
      category: SHOP_CAT_TO_EXPENSE[item.category],
      date: new Date().toISOString(),
    });
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(list));
    try { window.dispatchEvent(new CustomEvent("spl-expenses-changed")); } catch {}
  } catch {}
}
function unsyncBoughtFromExpenses(itemId: string) {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    if (!raw) return;
    const list = JSON.parse(raw).filter((t: any) => t.id !== `shop-${itemId}`);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(list));
    try { window.dispatchEvent(new CustomEvent("spl-expenses-changed")); } catch {}
  } catch {}
}

// Examples: "milk 2€" → { name:"milk", price:2 }, "3 bread 1.5" → { name:"bread", qty:3, price:1.5 }
export function parseQuickAdd(input: string): { name: string; qty?: number; price?: number } {
  const raw = input.trim().replace(/\s+/g, " ");
  if (!raw) return { name: "" };
  const tokens = raw.split(" ");
  let qty: number | undefined;
  let price: number | undefined;
  const nameParts: string[] = [];
  for (const tok of tokens) {
    // price: ends with €/$ or has decimal separator, or "€2", "2eur"
    const priceMatch = tok.match(/^€?\$?(\d+(?:[.,]\d+)?)(?:€|\$|eur|ron|lei)?$/i);
    if (priceMatch && (tok.includes("€") || tok.includes("$") || /[.,]/.test(tok) || /eur|ron|lei/i.test(tok))) {
      price = parseFloat(priceMatch[1].replace(",", "."));
      continue;
    }
    // bare integer at start = qty
    if (qty === undefined && nameParts.length === 0 && /^\d+$/.test(tok)) {
      qty = parseInt(tok, 10);
      continue;
    }
    // bare integer/decimal anywhere else with no name yet decided as price → only if price not set
    if (price === undefined && /^\d+(?:[.,]\d+)?$/.test(tok) && nameParts.length > 0) {
      price = parseFloat(tok.replace(",", "."));
      continue;
    }
    nameParts.push(tok);
  }
  return { name: nameParts.join(" ").trim(), qty, price };
}


function loadItems(): Item[] {
  try { return JSON.parse(localStorage.getItem(ITEMS_KEY) || "[]"); } catch { return []; }
}
function saveItems(items: Item[]) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

// Smooth count-up hook
function useAnimatedNumber(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(target);
  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}

function ShoppingPage() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [budget, setBudget] = useState<number>(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [showBudget, setShowBudget] = useState(false);
  const [burstId, setBurstId] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadItems());
    const b = parseFloat(localStorage.getItem(BUDGET_KEY) || "0");
    setBudget(isNaN(b) ? 0 : b);
  }, []);

  const update = (next: Item[]) => { setItems(next); saveItems(next); };

  const toBuy = useMemo(() => items.filter((i) => !i.bought), [items]);
  const bought = useMemo(() => items.filter((i) => i.bought), [items]);
  const estimated = useMemo(() => toBuy.reduce((s, i) => s + i.qty * i.unitPrice, 0), [toBuy]);
  const spent = useMemo(() => bought.reduce((s, i) => s + i.qty * i.unitPrice, 0), [bought]);

  const animEstimated = useAnimatedNumber(estimated);
  const animSpent = useAnimatedNumber(spent);
  const animBudget = useAnimatedNumber(budget);

  const overBudget = budget > 0 && spent > budget;

  const catLabel = (c: Category) => ({
    groceries: t("catGroceries"), household: t("catHousehold"),
    pharmacy: t("catPharmacy"), baby: t("catBaby"),
    pets: t("catPets"), other: t("catOther"),
  } as Record<Category, string>)[c];

  function recordPurchase(item: Item) {
    try {
      const KEY = "spl_shop_history_v1";
      const raw = localStorage.getItem(KEY);
      const map: Record<string, { name: string; category: Category; unitPrice: number; count: number; lastAt: number }> =
        raw ? JSON.parse(raw) : {};
      const k = item.name.trim().toLowerCase();
      const prev = map[k];
      map[k] = {
        name: item.name,
        category: item.category,
        unitPrice: item.unitPrice || prev?.unitPrice || 0,
        count: (prev?.count ?? 0) + 1,
        lastAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(map));
    } catch {}
  }

  function toggleBought(id: string) {
    const item = items.find((i) => i.id === id);
    if (item && !item.bought) {
      setBurstId(id);
      setTimeout(() => setBurstId(null), 700);
      const updated = { ...item, bought: true };
      syncBoughtToExpenses(updated);
      recordPurchase(updated);
    } else if (item && item.bought) {
      unsyncBoughtFromExpenses(item.id);
    }
    update(items.map((i) => (i.id === id ? { ...i, bought: !i.bought } : i)));
  }
  function deleteItem(id: string) {
    unsyncBoughtFromExpenses(id);
    update(items.filter((i) => i.id !== id));
    toast.success(t("shopItemDeleted"));
  }
  function clearBought() {
    bought.forEach((b) => unsyncBoughtFromExpenses(b.id));
    update(items.filter((i) => !i.bought));
  }
  function changeQty(id: string, delta: number) {
    update(items.map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  }
  function addItem(payload: { name: string; qty: number; unitPrice: number; category: Category; note?: string }) {
    const newItem: Item = {
      id: crypto.randomUUID(), bought: false, createdAt: Date.now(), ...payload,
    };
    update([newItem, ...items]);
    setNewId(newItem.id);
    setTimeout(() => setNewId(null), 600);
    toast.success(t("shopItemAdded"));
  }
  function addFromSuggestion(s: { name: string; category: Category; unitPrice: number }) {
    addItem({ name: s.name, qty: 1, unitPrice: s.unitPrice, category: s.category });
  }

  // ---- Smart suggestions from real history ----
  const [historyTick, setHistoryTick] = useState(0);
  useEffect(() => { setHistoryTick((x) => x + 1); }, [items]);
  const history = useMemo(() => {
    try {
      const raw = localStorage.getItem("spl_shop_history_v1");
      const map = raw ? JSON.parse(raw) : {};
      return Object.entries(map).map(([k, v]: any) => ({ key: k, ...v })) as Array<{
        key: string; name: string; category: Category; unitPrice: number; count: number; lastAt: number;
      }>;
    } catch { return []; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyTick]);
  const activeNames = useMemo(() => new Set(items.map((i) => i.name.trim().toLowerCase())), [items]);
  const recentSuggestions = useMemo(
    () => history.filter((h) => !activeNames.has(h.key)).sort((a, b) => b.lastAt - a.lastAt).slice(0, 6),
    [history, activeNames],
  );
  const frequentSuggestions = useMemo(
    () => history.filter((h) => h.count >= 2 && !activeNames.has(h.key)).sort((a, b) => b.count - a.count).slice(0, 6),
    [history, activeNames],
  );

  // ---- Mini analytics: this week + top category ----
  const weekAnalytics = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const weekItems = history.filter((h) => h.lastAt >= weekAgo);
    const total = weekItems.reduce((s, h) => s + h.unitPrice * h.count, 0);
    const catTotals: Record<string, number> = {};
    weekItems.forEach((h) => { catTotals[h.category] = (catTotals[h.category] ?? 0) + h.unitPrice * h.count; });
    let topCat: Category | null = null; let topVal = 0;
    Object.entries(catTotals).forEach(([c, v]) => { if (v > topVal) { topVal = v; topCat = c as Category; } });
    return { total, topCat, count: weekItems.length };
  }, [history]);

  return (
    <div className="page-enter relative min-h-screen pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/40 bg-background/40 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-card/40 press-glow"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-neon-title text-lg">{t("shopListTitle")}</h1>
          <p className="text-soft text-[11px]">{t("shopListSubtitle")}</p>
        </div>
        <button
          onClick={() => setShowBudget(true)}
          className="grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-card/40 press-glow"
          aria-label={t("shopBudget")}
        >
          <WalletIcon className="h-5 w-5" style={{ color: "var(--theme-accent)" }} />
        </button>
      </div>

      {/* Stats — animated counters */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
        <StatCard label={t("shopEstimated")} value={`€${animEstimated.toFixed(2)}`} />
        <StatCard label={t("shopSpent")} value={`€${animSpent.toFixed(2)}`} accent />
        <StatCard
          label={t("shopBudget")}
          value={budget > 0 ? `€${animBudget.toFixed(0)}` : "—"}
          danger={overBudget}
        />
      </div>

      {/* Budget bar */}
      {budget > 0 && (
        <div className="mx-4 mt-3">
          <div
            className={`h-2 overflow-hidden rounded-full bg-card/60 border border-border/40 ${
              overBudget ? "danger-glow" : ""
            }`}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (spent / budget) * 100)}%`,
                background: overBudget
                  ? "linear-gradient(90deg, oklch(0.7 0.2 25), oklch(0.75 0.22 15))"
                  : "linear-gradient(90deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 60%, white))",
                boxShadow: "0 0 12px color-mix(in oklab, var(--theme-accent) 60%, transparent)",
              }}
            />
          </div>
          {overBudget && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold" style={{ color: "oklch(0.78 0.2 25)" }}>
              <AlertTriangle className="h-3 w-3" /> {t("shopBudgetExceeded")}
            </p>
          )}
        </div>
      )}

      {/* To-buy section */}
      <Section title={`🛍️ ${t("shopToBuy")}`} count={toBuy.length}>
        {toBuy.length === 0 ? (
          <EmptyHero
            title="Start building your smart shopping list"
            hint="Add products in seconds — type, paste, or speak them."
            onAdd={() => setShowAdd(true)}
          />
        ) : (
          <ul className="space-y-2.5">
            {toBuy.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                catLabel={catLabel(item.category)}
                bursting={burstId === item.id}
                fresh={newId === item.id}
                onToggle={() => toggleBought(item.id)}
                onDelete={() => deleteItem(item.id)}
                onEdit={() => setEditing(item)}
                onInc={() => changeQty(item.id, +1)}
                onDec={() => changeQty(item.id, -1)}
              />
            ))}
          </ul>
        )}
      </Section>

      {/* Bought section */}
      {bought.length > 0 && (
        <Section
          title={`✅ ${t("shopBought")}`}
          count={bought.length}
          action={
            <button onClick={clearBought} className="text-soft text-[11px] uppercase tracking-widest text-alive">
              {t("shopClearBought")}
            </button>
          }
        >
          <ul className="space-y-2.5">
            {bought.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                catLabel={catLabel(item.category)}
                onToggle={() => toggleBought(item.id)}
                onDelete={() => deleteItem(item.id)}
                onEdit={() => setEditing(item)}
                onInc={() => changeQty(item.id, +1)}
                onDec={() => changeQty(item.id, -1)}
              />
            ))}
          </ul>
        </Section>
      )}

      {/* Smart suggestions — only when real history exists */}
      {(frequentSuggestions.length > 0 || recentSuggestions.length > 0) && (
        <section className="mx-4 mt-6">
          {frequentSuggestions.length > 0 && (
            <>
              <h2 className="text-premium mb-2 flex items-center gap-1.5 text-xs uppercase tracking-widest">
                <Flame className="h-3.5 w-3.5" style={{ color: "var(--theme-accent)" }} />
                Frequently used
              </h2>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {frequentSuggestions.map((s) => (
                  <SuggestionChip key={s.key} name={s.name} emoji={CAT_EMOJI[s.category]} onAdd={() => addFromSuggestion(s)} />
                ))}
              </div>
            </>
          )}
          {recentSuggestions.length > 0 && (
            <>
              <h2 className="text-premium mb-2 flex items-center gap-1.5 text-xs uppercase tracking-widest">
                <History className="h-3.5 w-3.5" style={{ color: "var(--theme-accent)" }} />
                Recently bought
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {recentSuggestions.map((s) => (
                  <SuggestionChip key={s.key} name={s.name} emoji={CAT_EMOJI[s.category]} onAdd={() => addFromSuggestion(s)} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Mini analytics */}
      {weekAnalytics.count > 0 && (
        <section className="mx-4 mt-6">
          <h2 className="text-premium mb-2 flex items-center gap-1.5 text-xs uppercase tracking-widest">
            <TrendingUp className="h-3.5 w-3.5" style={{ color: "var(--theme-accent)" }} />
            This week
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Spending" value={`€${weekAnalytics.total.toFixed(2)}`} accent />
            <StatCard
              label="Top category"
              value={weekAnalytics.topCat ? `${CAT_EMOJI[weekAnalytics.topCat]} ${catLabel(weekAnalytics.topCat)}` : "—"}
            />
          </div>
        </section>
      )}


      {/* Floating add button */}
      <button
        onClick={() => setShowAdd(true)}
        className="neon-circle press-glow fixed bottom-6 right-6 z-30 grid h-16 w-16 place-items-center rounded-full text-white shadow-2xl"
        style={{
          background: "var(--theme-accent)",
          boxShadow:
            "0 0 0 4px color-mix(in oklab, var(--theme-accent) 18%, transparent), 0 0 30px color-mix(in oklab, var(--theme-accent) 60%, transparent), 0 12px 40px oklch(0 0 0 / 55%)",
          animation: "glow-pulse 3s ease-in-out infinite",
        }}
        aria-label={t("shopAddItem")}
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Add / Edit modal */}
      {(showAdd || editing) && (
        <ItemModal
          initial={editing ?? undefined}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSave={(payload) => {
            if (editing) {
              update(items.map((i) => (i.id === editing.id ? { ...i, ...payload } : i)));
            } else {
              addItem(payload);
            }
            setShowAdd(false);
            setEditing(null);
          }}
        />
      )}

      {/* Budget modal */}
      {showBudget && (
        <BudgetModal
          initial={budget}
          onClose={() => setShowBudget(false)}
          onSave={(b) => {
            setBudget(b);
            localStorage.setItem(BUDGET_KEY, String(b));
            setShowBudget(false);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div
      className={`relative rounded-2xl border bg-card/30 p-3 backdrop-blur-xl ${
        danger ? "danger-glow" : ""
      }`}
      style={{
        borderColor: danger
          ? "oklch(0.7 0.22 25 / 70%)"
          : accent
          ? "color-mix(in oklab, var(--theme-accent) 50%, transparent)"
          : "color-mix(in oklab, var(--theme-accent) 22%, transparent)",
        boxShadow: accent && !danger
          ? "0 0 18px color-mix(in oklab, var(--theme-accent) 30%, transparent)"
          : undefined,
      }}
    >
      <p className="text-soft text-[10px] uppercase tracking-widest">{label}</p>
      <p
        key={value}
        className="animate-count-pop mt-1 text-base font-bold"
        style={{
          color: danger ? "oklch(0.82 0.22 25)" : accent ? "var(--theme-accent)" : "#fff",
          textShadow: accent
            ? "0 0 14px color-mix(in oklab, var(--theme-accent) 70%, transparent)"
            : "0 1px 0 oklch(1 0 0 / 14%)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function Section({ title, count, children, action }: { title: string; count: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mx-4 mt-6">
      <div className="mb-2 flex items-end justify-between">
        <h2 className="text-premium text-xs uppercase tracking-widest">
          {title} <span className="ml-1 opacity-70">({count})</span>
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SuggestionChip({ name, emoji, onAdd }: { name: string; emoji: string; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="press-glow inline-flex items-center gap-1.5 rounded-full border bg-card/40 px-3 py-1.5 text-xs font-medium text-white transition-all hover:scale-[1.03]"
      style={{
        borderColor: "color-mix(in oklab, var(--theme-accent) 35%, transparent)",
        boxShadow: "0 0 10px color-mix(in oklab, var(--theme-accent) 20%, transparent)",
      }}
    >
      <span>{emoji}</span>
      <span className="truncate max-w-[140px]">{name}</span>
      <Plus className="h-3 w-3" style={{ color: "var(--theme-accent)" }} />
    </button>
  );
}

function EmptyHero({ title, hint, onAdd }: { title: string; hint: string; onAdd?: () => void }) {
  return (
    <div className="glass-card grid place-items-center p-10 text-center">
      <div className="relative mb-4">
        <div
          className="absolute inset-0 -z-10 rounded-full blur-2xl"
          style={{ background: "color-mix(in oklab, var(--theme-accent) 40%, transparent)" }}
        />
        <ShoppingBasket
          className="h-14 w-14 icon-float"
          style={{ color: "var(--theme-accent)", filter: "drop-shadow(0 0 12px var(--theme-accent))" }}
        />
        <Sparkles
          className="absolute -right-3 -top-2 h-5 w-5"
          style={{ color: "var(--theme-accent)", animation: "twinkle 2.4s ease-in-out infinite" }}
        />
      </div>
      <p className="text-neon-title text-base">{title}</p>
      <p className="text-soft mt-1 text-xs">{hint}</p>
      {onAdd && (
        <button
          onClick={onAdd}
          className="press-glow mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white"
          style={{
            background: "var(--theme-accent)",
            boxShadow: "0 0 22px color-mix(in oklab, var(--theme-accent) 55%, transparent)",
          }}
        >
          <Plus className="h-4 w-4" /> Add your first product
        </button>
      )}
    </div>
  );
}

function ItemCard({
  item, catLabel, onToggle, onDelete, onEdit, onInc, onDec, bursting, fresh,
}: {
  item: Item; catLabel: string;
  onToggle: () => void; onDelete: () => void; onEdit: () => void;
  onInc: () => void; onDec: () => void;
  bursting?: boolean; fresh?: boolean;
}) {
  // Swipe gesture
  const [dx, setDx] = useState(0);
  const startX = useRef(0);
  const tracking = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    tracking.current = true;
    startX.current = e.clientX;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!tracking.current) return;
    const d = e.clientX - startX.current;
    setDx(Math.max(-120, Math.min(120, d)));
  }
  function onPointerUp() {
    tracking.current = false;
    if (dx > 80) {
      setDx(0);
      onToggle();
    } else if (dx < -80) {
      setDx(0);
      onDelete();
    } else {
      setDx(0);
    }
  }

  const total = item.qty * item.unitPrice;
  const swipeBg =
    dx > 10
      ? "linear-gradient(90deg, color-mix(in oklab, var(--theme-accent) 35%, transparent), transparent 60%)"
      : dx < -10
      ? "linear-gradient(270deg, oklch(0.65 0.22 25 / 35%), transparent 60%)"
      : "transparent";

  return (
    <li className={`relative ${fresh ? "animate-item-drop" : ""}`}>
      {/* Swipe action backdrop */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: swipeBg, transition: "background 0.15s ease" }}
      />
      {/* Left/right action hints */}
      {dx > 30 && (
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          <Check className="h-6 w-6" style={{ color: "var(--theme-accent)", filter: "drop-shadow(0 0 8px var(--theme-accent))" }} />
        </div>
      )}
      {dx < -30 && (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <Trash2 className="h-6 w-6" style={{ color: "oklch(0.75 0.22 25)", filter: "drop-shadow(0 0 8px oklch(0.7 0.22 25))" }} />
        </div>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { tracking.current = false; setDx(0); }}
        className="glass-card glass-card-hover relative flex items-center gap-3 p-3"
        style={{
          transform: `translateX(${dx}px)`,
          transition: tracking.current ? "none" : "transform 0.25s cubic-bezier(0.22,1,0.36,1)",
          opacity: item.bought ? 0.62 : 1,
          touchAction: "pan-y",
        }}
      >
        {/* Completion burst */}
        {bursting && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute left-6 top-1/2 -z-0 h-6 w-6 rounded-full"
              style={{
                background: "radial-gradient(circle, color-mix(in oklab, var(--theme-accent) 80%, transparent), transparent 70%)",
                animation: "complete-burst 0.7s ease-out both",
              }}
            />
            {[0, 1, 2, 3, 4].map((i) => {
              const angle = (i / 5) * Math.PI * 2;
              const dxs = Math.cos(angle) * 36;
              const dys = Math.sin(angle) * 36;
              return (
                <span
                  key={i}
                  aria-hidden
                  className="pointer-events-none absolute left-7 top-1/2 h-1.5 w-1.5 rounded-full"
                  style={{
                    background: "var(--theme-accent)",
                    boxShadow: "0 0 8px var(--theme-accent)",
                    ["--dx" as never]: `${dxs}px`,
                    ["--dy" as never]: `${dys}px`,
                    animation: "spark-fly 0.65s ease-out both",
                  }}
                />
              );
            })}
          </>
        )}

        {/* Check button */}
        <button
          onClick={onToggle}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition-all press-glow"
          style={
            item.bought
              ? {
                  background: "var(--theme-accent)",
                  borderColor: "var(--theme-accent)",
                  boxShadow: "0 0 16px color-mix(in oklab, var(--theme-accent) 70%, transparent)",
                }
              : { borderColor: "color-mix(in oklab, var(--theme-accent) 55%, transparent)" }
          }
          aria-label="toggle"
        >
          {item.bought && <Check className="h-5 w-5 text-white" />}
        </button>

        {/* Product image / icon */}
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--theme-accent) 18%, transparent), oklch(1 0 0 / 4%))",
            boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--theme-accent) 30%, transparent)",
          }}
        >
          {CAT_EMOJI[item.category]}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-bold ${item.bought ? "line-through" : ""}`}
            style={{
              color: "#fff",
              textShadow: item.bought
                ? undefined
                : "0 0 10px color-mix(in oklab, var(--theme-accent) 30%, transparent)",
            }}
          >
            {item.name}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            {/* Qty selector */}
            <div className="flex items-center gap-1 rounded-full border border-border/50 bg-background/40 px-1 py-0.5">
              <button
                onClick={onDec}
                className="grid h-5 w-5 place-items-center rounded-full text-soft press-glow"
                aria-label="dec"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[1.2rem] text-center text-[11px] font-semibold text-white">{item.qty}</span>
              <button
                onClick={onInc}
                className="grid h-5 w-5 place-items-center rounded-full press-glow"
                style={{ color: "var(--theme-accent)" }}
                aria-label="inc"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {/* Category tag */}
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: "color-mix(in oklab, var(--theme-accent) 14%, transparent)",
                color: "var(--theme-accent)",
                border: "1px solid color-mix(in oklab, var(--theme-accent) 35%, transparent)",
              }}
            >
              {catLabel}
            </span>
          </div>
        </div>

        {/* Right side: price + actions */}
        <div className="text-right">
          <p
            className="text-sm font-bold"
            style={{
              color: "var(--theme-accent)",
              textShadow: "0 0 12px color-mix(in oklab, var(--theme-accent) 70%, transparent)",
            }}
          >
            €{total.toFixed(2)}
          </p>
          <div className="mt-1 flex items-center justify-end gap-1">
            <button onClick={onEdit} className="text-soft text-alive grid h-7 w-7 place-items-center rounded-lg press-glow" aria-label="edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="grid h-7 w-7 place-items-center rounded-lg text-soft press-glow hover:text-red-400" aria-label="delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function ItemModal({
  initial, onClose, onSave,
}: {
  initial?: Item;
  onClose: () => void;
  onSave: (p: { name: string; qty: number; unitPrice: number; category: Category; note?: string }) => void;
}) {
  const { t } = useApp();
  const [name, setName] = useState(initial?.name ?? "");
  const [qty, setQty] = useState(String(initial?.qty ?? 1));
  const [price, setPrice] = useState(String(initial?.unitPrice ?? ""));
  const [category, setCategory] = useState<Category>(initial?.category ?? "groceries");
  const [catTouched, setCatTouched] = useState(!!initial);
  const [note, setNote] = useState(initial?.note ?? "");
  const [quick, setQuick] = useState("");
  const [listening, setListening] = useState(false);

  // Auto-detect category from name when user hasn't manually picked
  useEffect(() => {
    if (catTouched || !name.trim()) return;
    const detected = autoDetectCategory(name);
    if (detected !== "other") setCategory(detected);
  }, [name, catTouched]);

  const cats: Category[] = ["groceries", "household", "pharmacy", "baby", "pets", "other"];
  const catLabel = (c: Category) => ({
    groceries: t("catGroceries"), household: t("catHousehold"),
    pharmacy: t("catPharmacy"), baby: t("catBaby"),
    pets: t("catPets"), other: t("catOther"),
  } as Record<Category, string>)[c];

  function applyQuick(text: string) {
    const parsed = parseQuickAdd(text);
    if (parsed.name) setName(parsed.name);
    if (parsed.qty !== undefined) setQty(String(parsed.qty));
    if (parsed.price !== undefined) setPrice(String(parsed.price));
  }

  function startVoice() {
    const SR =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;
    if (!SR) {
      toast.error("Voice input not supported on this device");
      return;
    }
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setQuick(transcript);
        applyQuick(transcript);
        toast.success("Heard: " + transcript);
      }
    };
    rec.onerror = () => { setListening(false); toast.error("Couldn't hear you"); };
    rec.onend = () => setListening(false);
    try { rec.start(); } catch { setListening(false); }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let finalName = name.trim();
    let finalQty = qty;
    let finalPrice = price;
    // If user only typed in Quick Add, parse it on submit too
    if (!finalName && quick.trim()) {
      const parsed = parseQuickAdd(quick);
      finalName = parsed.name;
      if (parsed.qty !== undefined) finalQty = String(parsed.qty);
      if (parsed.price !== undefined) finalPrice = String(parsed.price);
    }
    if (!finalName) return;
    const q = Math.max(1, parseInt(finalQty) || 1);
    const p = Math.max(0, parseFloat(finalPrice) || 0);
    onSave({ name: finalName, qty: q, unitPrice: p, category, note: note.trim() || undefined });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-md sm:place-items-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up glass-card w-full max-w-md rounded-t-3xl p-5 sm:rounded-3xl"
        style={{ boxShadow: "0 -10px 60px color-mix(in oklab, var(--theme-accent) 35%, transparent)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-neon-title text-base">{initial ? t("shopEditItem") : t("shopAddItem")}</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-background/40 press-glow">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Add — only when creating new */}
        {!initial && (
          <div className="mb-3">
            <p className="text-soft mb-1 flex items-center gap-1 text-[11px] uppercase tracking-widest">
              <Zap className="h-3 w-3" style={{ color: "var(--theme-accent)" }} /> Quick Add
            </p>
            <div className="flex items-center gap-2">
              <input
                value={quick}
                onChange={(e) => { setQuick(e.target.value); applyQuick(e.target.value); }}
                placeholder='Try "milk 2€" or "3 bread 1.5"'
                className="flex-1 rounded-xl border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-accent)]"
                style={{ borderColor: "color-mix(in oklab, var(--theme-accent) 35%, transparent)" }}
              />
              <button
                type="button"
                onClick={startVoice}
                aria-label="Voice input"
                className="press-glow grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                style={{
                  background: listening
                    ? "var(--theme-accent)"
                    : "color-mix(in oklab, var(--theme-accent) 14%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--theme-accent) 45%, transparent)",
                  boxShadow: listening
                    ? "0 0 24px color-mix(in oklab, var(--theme-accent) 70%, transparent)"
                    : undefined,
                  animation: listening ? "glow-pulse 1.2s ease-in-out infinite" : undefined,
                }}
              >
                <Mic className="h-4 w-4" style={{ color: listening ? "#fff" : "var(--theme-accent)" }} />
              </button>
            </div>
          </div>
        )}

        <input
          autoFocus={!!initial} value={name} onChange={(e) => setName(e.target.value)}
          placeholder={t("shopItemName")}
          className="mb-2 w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-accent)]"
        />

        <div className="mb-2 grid grid-cols-2 gap-2">
          <input
            value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric"
            placeholder={t("shopQty")}
            className="rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-accent)]"
          />
          <input
            value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal"
            placeholder={`${t("shopUnitPrice")} (€)`}
            className="rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-accent)]"
          />
        </div>

        <p className="text-soft mb-1 text-[11px] uppercase tracking-widest">{t("shopCategory")}</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {cats.map((c) => {
            const active = category === c;
            return (
              <button
                key={c} type="button" onClick={() => { setCategory(c); setCatTouched(true); }}
                className="rounded-full border px-3 py-1.5 text-xs transition-all press-glow"
                style={active
                  ? {
                      borderColor: "var(--theme-accent)",
                      color: "var(--theme-accent)",
                      background: "color-mix(in oklab, var(--theme-accent) 14%, transparent)",
                      boxShadow: "0 0 14px color-mix(in oklab, var(--theme-accent) 50%, transparent)",
                    }
                  : { borderColor: "var(--border)" }
                }
              >
                {CAT_EMOJI[c]} {catLabel(c)}
              </button>
            );
          })}
        </div>

        <input
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={t("shopNote")}
          className="mb-4 w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-accent)]"
        />

        <button
          type="submit"
          className="neon-circle press-glow w-full rounded-2xl py-3 text-sm font-bold text-white"
          style={{ background: "var(--theme-accent)" }}
        >
          {t("save")}
        </button>
      </form>
    </div>
  );
}

function BudgetModal({ initial, onClose, onSave }: { initial: number; onClose: () => void; onSave: (b: number) => void }) {
  const { t } = useApp();
  const [val, setVal] = useState(String(initial || ""));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-md" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-card animate-sheet-up w-[90%] max-w-sm rounded-3xl p-5">
        <h2 className="text-neon-title mb-3 text-base">{t("shopSetBudget")}</h2>
        <input
          autoFocus value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal"
          placeholder="€ 0.00"
          className="mb-4 w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-accent)]"
        />
        <button
          onClick={() => onSave(Math.max(0, parseFloat(val) || 0))}
          className="neon-circle press-glow w-full rounded-2xl py-3 text-sm font-bold text-white"
          style={{ background: "var(--theme-accent)" }}
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}
