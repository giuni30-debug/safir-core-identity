import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/contexts/AppContext";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Plus, Check, Trash2, X, Wallet as WalletIcon,
  ShoppingBasket, Pencil,
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

function loadItems(): Item[] {
  try { return JSON.parse(localStorage.getItem(ITEMS_KEY) || "[]"); } catch { return []; }
}
function saveItems(items: Item[]) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

function ShoppingPage() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [budget, setBudget] = useState<number>(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [showBudget, setShowBudget] = useState(false);

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

  const catLabel = (c: Category) => ({
    groceries: t("catGroceries"), household: t("catHousehold"),
    pharmacy: t("catPharmacy"), baby: t("catBaby"),
    pets: t("catPets"), other: t("catOther"),
  } as Record<Category, string>)[c];

  function toggleBought(id: string) {
    update(items.map((i) => (i.id === id ? { ...i, bought: !i.bought } : i)));
  }
  function deleteItem(id: string) {
    update(items.filter((i) => i.id !== id));
    toast.success(t("shopItemDeleted"));
  }
  function clearBought() {
    update(items.filter((i) => !i.bought));
  }

  return (
    <div className="page-enter relative min-h-screen pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/40 bg-background/40 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => navigate({ to: "/dashboard" })} className="grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-neon-title text-lg">{t("shopListTitle")}</h1>
          <p className="text-[11px] text-muted-foreground">{t("shopListSubtitle")}</p>
        </div>
        <button onClick={() => setShowBudget(true)} className="grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-card/40" aria-label={t("shopBudget")}>
          <WalletIcon className="h-5 w-5" style={{ color: "var(--theme-accent)" }} />
        </button>
      </div>

      {/* Stats */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
        <StatCard label={t("shopEstimated")} value={`€${estimated.toFixed(2)}`} />
        <StatCard label={t("shopSpent")} value={`€${spent.toFixed(2)}`} accent />
        <StatCard label={t("shopBudget")} value={budget > 0 ? `€${budget.toFixed(0)}` : "—"} />
      </div>

      {/* Budget bar */}
      {budget > 0 && (
        <div className="mx-4 mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-card/60 border border-border/40">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (spent / budget) * 100)}%`,
                background: spent > budget
                  ? "linear-gradient(90deg, oklch(0.7 0.2 25), oklch(0.75 0.22 15))"
                  : "linear-gradient(90deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 60%, white))",
                boxShadow: "0 0 12px color-mix(in oklab, var(--theme-accent) 60%, transparent)",
              }}
            />
          </div>
        </div>
      )}

      {/* To-buy list */}
      <Section title={t("shopToBuy")} count={toBuy.length}>
        {toBuy.length === 0 ? (
          <EmptyState text={t("shopEmptyList")} />
        ) : (
          <ul className="space-y-2">
            {toBuy.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                catLabel={catLabel(item.category)}
                onToggle={() => toggleBought(item.id)}
                onDelete={() => deleteItem(item.id)}
                onEdit={() => setEditing(item)}
              />
            ))}
          </ul>
        )}
      </Section>

      {/* Bought list */}
      {bought.length > 0 && (
        <Section
          title={t("shopBought")}
          count={bought.length}
          action={
            <button onClick={clearBought} className="text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
              {t("shopClearBought")}
            </button>
          }
        >
          <ul className="space-y-2">
            {bought.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                catLabel={catLabel(item.category)}
                onToggle={() => toggleBought(item.id)}
                onDelete={() => deleteItem(item.id)}
                onEdit={() => setEditing(item)}
              />
            ))}
          </ul>
        </Section>
      )}

      {/* Floating add button */}
      <button
        onClick={() => setShowAdd(true)}
        className="neon-circle fixed bottom-6 right-6 z-30 grid h-14 w-14 place-items-center rounded-full text-white shadow-2xl"
        style={{ background: "var(--theme-accent)" }}
        aria-label={t("shopAddItem")}
      >
        <Plus className="h-6 w-6" />
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
              const newItem: Item = {
                id: crypto.randomUUID(), bought: false, createdAt: Date.now(), ...payload,
              };
              update([newItem, ...items]);
              toast.success(t("shopItemAdded"));
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

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="rounded-2xl border border-border/40 bg-card/30 p-3 backdrop-blur-xl"
      style={accent ? { boxShadow: "0 0 18px color-mix(in oklab, var(--theme-accent) 25%, transparent)" } : {}}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold" style={accent ? { color: "var(--theme-accent)" } : {}}>{value}</p>
    </div>
  );
}

function Section({ title, count, children, action }: { title: string; count: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mx-4 mt-5">
      <div className="mb-2 flex items-end justify-between">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          {title} <span className="ml-1 text-foreground/70">({count})</span>
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border/50 bg-card/20 p-8 text-center">
      <ShoppingBasket className="mb-2 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ItemRow({
  item, catLabel, onToggle, onDelete, onEdit,
}: {
  item: Item; catLabel: string;
  onToggle: () => void; onDelete: () => void; onEdit: () => void;
}) {
  const total = item.qty * item.unitPrice;
  return (
    <li
      className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/30 p-3 backdrop-blur-xl transition-all"
      style={item.bought ? { opacity: 0.55 } : {}}
    >
      <button
        onClick={onToggle}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-all"
        style={
          item.bought
            ? { background: "var(--theme-accent)", borderColor: "var(--theme-accent)", boxShadow: "0 0 14px color-mix(in oklab, var(--theme-accent) 60%, transparent)" }
            : { borderColor: "color-mix(in oklab, var(--theme-accent) 50%, transparent)" }
        }
        aria-label="toggle"
      >
        {item.bought && <Check className="h-5 w-5 text-white" />}
      </button>

      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background/40 text-xl">
        {CAT_EMOJI[item.category]}
      </div>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold ${item.bought ? "line-through" : ""}`}>{item.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {item.qty} × €{item.unitPrice.toFixed(2)} · {catLabel}
          {item.note ? ` · ${item.note}` : ""}
        </p>
      </div>

      <div className="text-right">
        <p className="text-sm font-semibold" style={{ color: "var(--theme-accent)" }}>€{total.toFixed(2)}</p>
        <div className="mt-1 flex items-center justify-end gap-1">
          <button onClick={onEdit} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:text-foreground" aria-label="edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:text-red-400" aria-label="delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
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
  const [note, setNote] = useState(initial?.note ?? "");

  const cats: Category[] = ["groceries", "household", "pharmacy", "baby", "pets", "other"];
  const catLabel = (c: Category) => ({
    groceries: t("catGroceries"), household: t("catHousehold"),
    pharmacy: t("catPharmacy"), baby: t("catBaby"),
    pets: t("catPets"), other: t("catOther"),
  } as Record<Category, string>)[c];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const q = Math.max(1, parseInt(qty) || 1);
    const p = Math.max(0, parseFloat(price) || 0);
    onSave({ name: name.trim(), qty: q, unitPrice: p, category, note: note.trim() || undefined });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border border-border/50 bg-card/90 p-5 backdrop-blur-2xl sm:rounded-3xl"
        style={{ boxShadow: "0 -10px 60px color-mix(in oklab, var(--theme-accent) 30%, transparent)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-neon-title text-base">{initial ? t("shopAddItem") : t("shopAddItem")}</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-background/40">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          autoFocus value={name} onChange={(e) => setName(e.target.value)}
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

        <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">{t("shopCategory")}</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {cats.map((c) => {
            const active = category === c;
            return (
              <button
                key={c} type="button" onClick={() => setCategory(c)}
                className="rounded-full border px-3 py-1.5 text-xs transition-all"
                style={active
                  ? { borderColor: "var(--theme-accent)", color: "var(--theme-accent)", background: "color-mix(in oklab, var(--theme-accent) 12%, transparent)" }
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

        <button type="submit" className="neon-circle w-full rounded-2xl py-3 text-sm font-semibold text-white" style={{ background: "var(--theme-accent)" }}>
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[90%] max-w-sm rounded-3xl border border-border/50 bg-card/90 p-5 backdrop-blur-2xl">
        <h2 className="text-neon-title mb-3 text-base">{t("shopSetBudget")}</h2>
        <input
          autoFocus value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal"
          placeholder="€ 0.00"
          className="mb-4 w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-accent)]"
        />
        <button
          onClick={() => onSave(Math.max(0, parseFloat(val) || 0))}
          className="neon-circle w-full rounded-2xl py-3 text-sm font-semibold text-white"
          style={{ background: "var(--theme-accent)" }}
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}
