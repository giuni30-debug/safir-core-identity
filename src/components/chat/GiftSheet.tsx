import { useState } from "react";
import { X, Wallet, Plus } from "lucide-react";
import { GIFTS, type Gift, type GiftTier } from "./gifts";
import { useWallet } from "@/hooks/useWallet";

type Props = {
  open: boolean;
  onClose: () => void;
  onSend: (g: Gift) => void;
};

const TIER_LABEL: Record<GiftTier, string> = {
  low: "Low Tier",
  mid: "Mid Tier",
  premium: "Premium",
};

export function GiftSheet({ open, onClose, onSend }: Props) {
  const { balance, topUp, spend } = useWallet();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const grouped: Record<GiftTier, Gift[]> = { low: [], mid: [], premium: [] };
  GIFTS.forEach((g) => grouped[g.tier].push(g));

  const handleSend = (g: Gift) => {
    setError(null);
    if (balance < g.price) {
      setError(`Need €${(g.price - balance).toFixed(2)} more. Top up to send.`);
      return;
    }
    const ok = spend(g.price, `Gift: ${g.name}`);
    if (!ok) {
      setError("Insufficient balance.");
      return;
    }
    onSend(g);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end justify-center sm:items-center"
      style={{
        background: "oklch(0 0 0 / 55%)",
        backdropFilter: "blur(8px)",
        animation: "gift-fade 0.25s ease-out both",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card relative w-full max-w-md p-5"
        style={{
          borderRadius: "28px 28px 0 0",
          maxHeight: "85vh",
          overflowY: "auto",
          animation: "sheet-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Send a Gift</h2>
            <p className="text-xs text-muted-foreground">Surprise them with something special</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Wallet bar */}
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl border p-3"
          style={{
            borderColor: "color-mix(in oklab, var(--theme-accent) 40%, transparent)",
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--theme-accent) 10%, transparent), transparent)",
          }}
        >
          <span
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{
              background: "color-mix(in oklab, var(--theme-accent) 18%, transparent)",
              color: "var(--theme-accent)",
            }}
          >
            <Wallet className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Wallet balance</p>
            <p className="text-lg font-bold tabular-nums">€{balance.toFixed(2)}</p>
          </div>
          <button
            type="button"
            onClick={() => { topUp(10); setError(null); }}
            className="press-glow flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold"
            style={{
              background: "var(--theme-accent)",
              color: "var(--primary-foreground)",
              boxShadow: "0 0 16px color-mix(in oklab, var(--theme-accent) 50%, transparent)",
            }}
          >
            <Plus className="h-3.5 w-3.5" /> €10
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Tiers */}
        {(Object.keys(grouped) as GiftTier[]).map((tier) => (
          <section key={tier} className="mb-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {TIER_LABEL[tier]}
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              {grouped[tier].map((g) => {
                const affordable = balance >= g.price;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSend(g)}
                    className="press-glow flex flex-col items-center gap-1 rounded-2xl border p-3 transition active:scale-95"
                    style={{
                      borderColor: `color-mix(in oklab, ${g.color} 55%, transparent)`,
                      background: `linear-gradient(135deg, color-mix(in oklab, ${g.color} 10%, transparent), oklch(1 0 0 / 3%))`,
                      boxShadow: `0 0 14px color-mix(in oklab, ${g.color} 25%, transparent), inset 0 0 8px color-mix(in oklab, ${g.color} 12%, transparent)`,
                      opacity: affordable ? 1 : 0.55,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 30,
                        filter: `drop-shadow(0 0 6px ${g.color})`,
                      }}
                    >
                      {g.emoji}
                    </span>
                    <span className="text-[11px] font-semibold">{g.name}</span>
                    <span
                      className="text-[10px] font-bold tabular-nums"
                      style={{ color: g.color }}
                    >
                      €{g.price.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
