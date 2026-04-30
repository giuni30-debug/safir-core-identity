import { useState } from "react";
import { X, Wallet, Plus, Send } from "lucide-react";
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
  const [selected, setSelected] = useState<Gift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  const grouped: Record<GiftTier, Gift[]> = { low: [], mid: [], premium: [] };
  GIFTS.forEach((g) => grouped[g.tier].push(g));

  const handleSelect = (g: Gift) => {
    setError(null);
    setSelected(g);
  };

  const handleSend = () => {
    if (!selected) return;
    setError(null);
    if (balance < selected.price) {
      setError(`Need €${(selected.price - balance).toFixed(2)} more. Top up to send.`);
      return;
    }
    setConfirming(true);
    // small confirmation animation before commit
    window.setTimeout(() => {
      const ok = spend(selected.price, `Gift: ${selected.name}`, {
        giftId: selected.id,
        giftEmoji: selected.emoji,
        giftColor: selected.color,
      });
      if (!ok) {
        setError("Insufficient balance.");
        setConfirming(false);
        return;
      }
      onSend(selected);
      setConfirming(false);
      setSelected(null);
      onClose();
    }, 320);
  };

  const handleClose = () => {
    setSelected(null);
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end justify-center sm:items-center"
      style={{
        background: "oklch(0 0 0 / 55%)",
        backdropFilter: "blur(10px)",
        animation: "gift-fade 0.25s ease-out both",
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card relative w-full max-w-md p-5"
        style={{
          borderRadius: "28px 28px 0 0",
          maxHeight: "88vh",
          overflowY: "auto",
          animation: "sheet-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-neon-title text-lg">Send a Gift</h2>
            <p className="text-soft text-xs">Surprise them with something special</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
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
            borderColor: "color-mix(in oklab, var(--theme-accent) 50%, transparent)",
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--theme-accent) 12%, transparent), transparent)",
            boxShadow: "0 0 14px color-mix(in oklab, var(--theme-accent) 25%, transparent)",
          }}
        >
          <span
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{
              background: "color-mix(in oklab, var(--theme-accent) 22%, transparent)",
              color: "var(--theme-accent)",
              boxShadow: "0 0 12px color-mix(in oklab, var(--theme-accent) 45%, transparent)",
            }}
          >
            <Wallet className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-soft text-[11px] uppercase tracking-widest">Wallet</p>
            <p className="text-neon-title text-lg tabular-nums">€{balance.toFixed(2)}</p>
          </div>
          <button
            type="button"
            onClick={() => { topUp(10); setError(null); }}
            className="press-glow no-ripple flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold"
            style={{
              background: "var(--theme-accent)",
              color: "var(--primary-foreground)",
              boxShadow: "0 0 16px color-mix(in oklab, var(--theme-accent) 55%, transparent)",
            }}
          >
            <Plus className="h-3.5 w-3.5" /> €10
          </button>
        </div>

        {error && (
          <div
            className="mb-3 rounded-xl border px-3 py-2 text-xs"
            style={{
              borderColor: "color-mix(in oklab, oklch(0.65 0.22 25) 55%, transparent)",
              background: "color-mix(in oklab, oklch(0.65 0.22 25) 14%, transparent)",
              color: "#ffb4b4",
            }}
          >
            {error}
          </div>
        )}

        {/* Tiers grid */}
        {(Object.keys(grouped) as GiftTier[]).map((tier) => (
          <section key={tier} className="mb-4">
            <h3 className="text-soft mb-2 text-[11px] font-bold uppercase tracking-widest">
              {TIER_LABEL[tier]}
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              {grouped[tier].map((g) => {
                const affordable = balance >= g.price;
                const isSelected = selected?.id === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelect(g)}
                    className="relative flex flex-col items-center gap-1 rounded-2xl border p-3 transition-transform"
                    style={{
                      borderColor: isSelected
                        ? g.color
                        : `color-mix(in oklab, ${g.color} 45%, transparent)`,
                      background: isSelected
                        ? `linear-gradient(135deg, color-mix(in oklab, ${g.color} 28%, transparent), color-mix(in oklab, ${g.color} 10%, transparent))`
                        : `linear-gradient(135deg, color-mix(in oklab, ${g.color} 10%, transparent), oklch(1 0 0 / 3%))`,
                      boxShadow: isSelected
                        ? `0 0 22px color-mix(in oklab, ${g.color} 70%, transparent), inset 0 0 16px color-mix(in oklab, ${g.color} 30%, transparent)`
                        : `0 0 14px color-mix(in oklab, ${g.color} 25%, transparent), inset 0 0 8px color-mix(in oklab, ${g.color} 12%, transparent)`,
                      opacity: affordable ? 1 : 0.55,
                      transform: isSelected ? "scale(1.06)" : "scale(1)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 32,
                        filter: `drop-shadow(0 0 8px ${g.color})`,
                        animation: isSelected ? "gift-pop 0.45s ease-out" : undefined,
                        display: "inline-block",
                      }}
                    >
                      {g.emoji}
                    </span>
                    <span className="text-[11px] font-semibold text-white">{g.name}</span>
                    <span
                      className="text-[10px] font-bold tabular-nums"
                      style={{
                        color: g.color,
                        textShadow: `0 0 8px ${g.color}`,
                      }}
                    >
                      €{g.price.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {/* Sticky send bar */}
        <div
          className="sticky bottom-0 -mx-5 -mb-5 mt-4 px-5 pb-4 pt-3"
          style={{
            background:
              "linear-gradient(to top, oklch(0.12 0.01 240) 60%, transparent)",
          }}
        >
          <button
            type="button"
            onClick={handleSend}
            disabled={!selected || confirming}
            className="no-ripple flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold tracking-wide disabled:opacity-40"
            style={{
              background: selected
                ? `linear-gradient(135deg, ${selected.color}, color-mix(in oklab, ${selected.color} 55%, #000))`
                : "oklch(1 0 0 / 6%)",
              color: selected ? "#fff" : "color-mix(in oklab, var(--theme-accent) 30%, #fff)",
              boxShadow: selected
                ? `0 0 24px color-mix(in oklab, ${selected.color} 65%, transparent), inset 0 1px 0 oklch(1 0 0 / 25%)`
                : "none",
              animation: selected && !confirming ? "gift-aura 1.6s ease-in-out infinite" : undefined,
              transform: confirming ? "scale(0.96)" : "scale(1)",
              transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {confirming ? (
              <>
                <span style={{ fontSize: 18 }}>{selected?.emoji}</span>
                Sending…
              </>
            ) : selected ? (
              <>
                <Send className="h-4 w-4" />
                Send {selected.name} · €{selected.price.toFixed(2)}
              </>
            ) : (
              <>Pick a gift</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
