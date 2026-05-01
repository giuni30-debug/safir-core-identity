import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Plus, ArrowDownToLine, Wallet as WalletIcon,
  ArrowUpRight, ArrowDownLeft, Gift as GiftIcon, X, Send, Lock, Check, Loader2, Sparkles,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useWallet, useAnimatedNumber, type WalletTx } from "@/hooks/useWallet";
import { SendMoneySheet } from "@/components/wallet/SendMoneySheet";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/wallet")({
  component: WalletPage,
  head: () => ({
    meta: [
      { title: "Wallet — Safir Private Life" },
      { name: "description", content: "Premium wallet with balance, top-ups, send & gift history." },
    ],
  }),
});

function WalletPage() {
  const { t } = useApp();
  const navigate = useNavigate();
  const { balance, tx, topUp, withdraw } = useWallet();
  const animatedBalance = useAnimatedNumber(balance);

  const [showTop, setShowTop] = useState(false);
  const [showWith, setShowWith] = useState(false);
  const [showSend, setShowSend] = useState(false);

  const stats = useMemo(() => {
    const sent = tx.filter(x => x.type === "spend").reduce((s, x) => s + x.amount, 0);
    const received = tx.filter(x => x.type === "received" || x.type === "topup").reduce((s, x) => s + x.amount, 0);
    return { sent, received };
  }, [tx]);

  const onWithdraw = (amount: number) => {
    const ok = withdraw(amount);
    if (!ok) {
      toast.error("Insufficient balance");
      return false;
    }
    toast.success(`Withdrew €${amount.toFixed(2)}`);
    return true;
  };

  const onTopUp = (amount: number) => {
    topUp(amount);
    toast.success(`Added €${amount.toFixed(2)}`);
    return true;
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/dashboard" })}
          aria-label={t("back")}
          className="press-glow grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-neon-title flex-1 text-center text-base">Wallet</h1>
        <span className="w-10" />
      </header>

      {/* Balance card */}
      <div
        className="glass-card relative mx-auto w-full overflow-hidden p-6"
        style={{ borderRadius: 28 }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full"
          style={{
            background: "var(--theme-accent)",
            filter: "blur(60px)",
            opacity: 0.35,
          }}
        />

        <div className="flex items-center gap-2">
          <span
            className="grid h-10 w-10 place-items-center rounded-2xl"
            style={{
              background: "color-mix(in oklab, var(--theme-accent) 22%, transparent)",
              color: "var(--theme-accent)",
              boxShadow: "0 0 14px color-mix(in oklab, var(--theme-accent) 50%, transparent)",
            }}
          >
            <WalletIcon className="h-5 w-5 icon-float" />
          </span>
          <div>
            <p className="text-soft text-[10px] uppercase tracking-[0.25em]">Available balance</p>
            <p className="text-premium text-xs">EUR · €</p>
          </div>
        </div>

        <div
          className="mt-5 text-center text-5xl font-bold tabular-nums tracking-tight"
          style={{
            color: "#fff",
            textShadow:
              "0 0 18px var(--theme-accent), 0 0 38px color-mix(in oklab, var(--theme-accent) 55%, transparent), 0 4px 18px oklch(0 0 0 / 55%)",
          }}
        >
          €{animatedBalance.toFixed(2)}
        </div>

        <p className="text-soft mt-2 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest">
          <Lock className="h-3 w-3" /> Secure transaction
        </p>

        {/* Actions: Top-up · Withdraw · Send */}
        <div className="mt-6 grid grid-cols-3 gap-2.5">
          <button
            onClick={() => setShowTop(true)}
            className="press-glow flex flex-col items-center justify-center gap-1 rounded-2xl py-3 text-xs font-bold"
            style={{
              background: "linear-gradient(135deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 55%, #000))",
              color: "var(--primary-foreground)",
              boxShadow: "0 0 22px color-mix(in oklab, var(--theme-accent) 60%, transparent)",
            }}
          >
            <Plus className="h-4 w-4" /> Top-up
          </button>
          <button
            onClick={() => setShowWith(true)}
            className="press-glow flex flex-col items-center justify-center gap-1 rounded-2xl py-3 text-xs font-bold"
            style={{
              border: "2px solid color-mix(in oklab, var(--theme-accent) 55%, transparent)",
              background: "color-mix(in oklab, var(--theme-accent) 8%, transparent)",
              color: "#fff",
              boxShadow: "0 0 14px color-mix(in oklab, var(--theme-accent) 35%, transparent)",
            }}
          >
            <ArrowDownToLine className="h-4 w-4" /> Withdraw
          </button>
          <button
            onClick={() => setShowSend(true)}
            className="press-glow flex flex-col items-center justify-center gap-1 rounded-2xl py-3 text-xs font-bold"
            style={{
              background: "linear-gradient(135deg, oklch(0.78 0.18 160), oklch(0.55 0.16 160))",
              color: "#04140b",
              boxShadow: "0 0 22px color-mix(in oklab, oklch(0.78 0.18 160) 60%, transparent)",
            }}
          >
            <Send className="h-4 w-4" /> Send
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCard label="Spent" value={stats.sent} icon={<ArrowUpRight className="h-4 w-4" />} negative />
        <StatCard label="Received" value={stats.received} icon={<ArrowDownLeft className="h-4 w-4" />} />
      </div>

      {/* History */}
      <div className="mt-5 flex-1">
        <h3 className="text-soft mb-2 px-1 text-[11px] font-bold uppercase tracking-widest">
          Transactions
        </h3>
        {tx.length === 0 ? (
          <div className="glass-card grid place-items-center p-8 text-center" style={{ borderRadius: 22 }}>
            <div
              className="mb-3 grid h-14 w-14 place-items-center rounded-2xl"
              style={{
                background: "color-mix(in oklab, var(--theme-accent) 22%, transparent)",
                color: "var(--theme-accent)",
                boxShadow: "0 0 18px color-mix(in oklab, var(--theme-accent) 55%, transparent)",
                animation: "logo-breath 3.6s ease-in-out infinite",
              }}
            >
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-premium text-sm font-semibold">Your wallet is ready</p>
            <p className="text-soft mt-1 text-xs">Start sending or receiving</p>
          </div>
        ) : (
          <div className="space-y-2 pb-6">
            {tx.map((t) => <TxRow key={t.id} t={t} />)}
          </div>
        )}
      </div>

      {showTop && (
        <AmountModal
          title="Top-up balance"
          actionLabel="Add funds"
          processingLabel="Processing top-up…"
          presets={[5, 10, 25, 50, 100]}
          onClose={() => setShowTop(false)}
          onConfirm={onTopUp}
        />
      )}
      {showWith && (
        <AmountModal
          title="Withdraw"
          actionLabel="Withdraw"
          processingLabel="Processing withdrawal…"
          presets={[5, 10, 25, 50]}
          max={balance}
          onClose={() => setShowWith(false)}
          onConfirm={onWithdraw}
        />
      )}

      <SendMoneySheet open={showSend} onClose={() => setShowSend(false)} />
    </div>
  );
}

function StatCard({ label, value, icon, negative }: {
  label: string; value: number; icon: React.ReactNode; negative?: boolean;
}) {
  return (
    <div className="glass-card p-3" style={{ borderRadius: 18 }}>
      <div className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 place-items-center rounded-xl"
          style={{
            background: negative
              ? "color-mix(in oklab, oklch(0.70 0.22 25) 18%, transparent)"
              : "color-mix(in oklab, oklch(0.75 0.18 160) 18%, transparent)",
            color: negative ? "#ff8f8f" : "#86efac",
          }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-soft text-[10px] uppercase tracking-widest">{label}</p>
          <p className="text-premium text-sm font-bold tabular-nums">€{value.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}

function TxRow({ t }: { t: WalletTx }) {
  const isOut = t.type === "spend" || t.type === "withdraw";
  const sign = isOut ? "-" : "+";
  const tint = isOut ? "oklch(0.70 0.22 25)" : "oklch(0.75 0.18 160)";
  const dt = new Date(t.at);
  const date = dt.toLocaleDateString([], { month: "short", day: "numeric" });
  const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const isGift = !!t.giftId;
  const hasEmoji = !!t.giftEmoji;

  return (
    <div
      className="glass-card flex items-center gap-3 px-3 py-2.5"
      style={{
        borderRadius: 16,
        animation: "fade-in 0.32s ease-out",
      }}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
        style={{
          background: hasEmoji
            ? `color-mix(in oklab, ${t.giftColor ?? tint} 22%, transparent)`
            : `color-mix(in oklab, ${tint} 18%, transparent)`,
          color: hasEmoji ? (t.giftColor ?? tint) : tint,
          boxShadow: `0 0 12px color-mix(in oklab, ${hasEmoji ? (t.giftColor ?? tint) : tint} 50%, transparent)`,
        }}
      >
        {hasEmoji ? (
          <span style={{ filter: `drop-shadow(0 0 6px ${t.giftColor ?? tint})` }}>{t.giftEmoji}</span>
        ) : t.type === "topup" ? <Plus className="h-4 w-4" />
          : t.type === "withdraw" ? <ArrowDownToLine className="h-4 w-4" />
          : t.type === "received" ? <GiftIcon className="h-4 w-4" />
          : <ArrowUpRight className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-premium truncate text-sm font-semibold">{t.label}</p>
        <p className="text-soft text-[11px]">
          {isGift ? "Gift · " : ""}{date} · {time}
        </p>
      </div>
      <span
        className="shrink-0 text-sm font-bold tabular-nums"
        style={{
          color: isOut ? "#ff9b9b" : "#86efac",
          textShadow: `0 0 8px color-mix(in oklab, ${isOut ? "#ff5e5e" : "#22c55e"} 55%, transparent)`,
        }}
      >
        {sign}€{t.amount.toFixed(2)}
      </span>
    </div>
  );
}

function AmountModal({
  title, actionLabel, processingLabel, presets, max, onClose, onConfirm,
}: {
  title: string;
  actionLabel: string;
  processingLabel: string;
  presets: number[];
  max?: number;
  onClose: () => void;
  onConfirm: (n: number) => boolean;
}) {
  const [val, setVal] = useState<number>(presets[1] ?? presets[0]);
  const [custom, setCustom] = useState("");
  const [phase, setPhase] = useState<"input" | "processing" | "done">("input");

  const finalValue = (() => {
    const n = Number(custom);
    if (custom && Number.isFinite(n) && n > 0) return n;
    return val;
  })();
  const tooMuch = max != null && finalValue > max;

  const handleConfirm = () => {
    setPhase("processing");
    window.setTimeout(() => {
      const ok = onConfirm(finalValue);
      if (!ok) {
        setPhase("input");
        return;
      }
      setPhase("done");
      window.setTimeout(onClose, 850);
    }, 1100);
  };

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center p-6"
      style={{
        background: "oklch(0 0 0 / 65%)",
        backdropFilter: "blur(12px)",
        animation: "gift-fade 0.2s ease-out both",
      }}
      onClick={phase === "input" ? onClose : undefined}
    >
      <div
        className="glass-card relative w-full max-w-sm p-5"
        style={{
          borderRadius: 24,
          animation: "scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {phase === "input" && (
          <>
            <button
              onClick={onClose}
              aria-label="close"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-border bg-card/40"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-neon-title mb-1 text-lg">{title}</h3>
            <p className="text-soft mb-3 flex items-center gap-1.5 text-[11px]">
              <Lock className="h-3 w-3" /> Secure transaction
            </p>

            <div className="mb-3 grid grid-cols-3 gap-2">
              {presets.map((p) => {
                const active = !custom && p === val;
                return (
                  <button
                    key={p}
                    onClick={() => { setCustom(""); setVal(p); }}
                    className="rounded-xl border py-2.5 text-sm font-bold tabular-nums"
                    style={{
                      borderColor: active ? "var(--theme-accent)" : "var(--glass-border)",
                      background: active
                        ? "color-mix(in oklab, var(--theme-accent) 18%, transparent)"
                        : "oklch(1 0 0 / 4%)",
                      color: "#fff",
                      boxShadow: active
                        ? "0 0 14px color-mix(in oklab, var(--theme-accent) 50%, transparent)"
                        : "none",
                      textShadow: active ? "0 0 8px var(--theme-accent)" : "none",
                    }}
                  >
                    €{p}
                  </button>
                );
              })}
            </div>

            <input
              type="number"
              inputMode="decimal"
              placeholder="Custom amount"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="mb-3 w-full rounded-xl border border-border bg-card/40 px-3 py-2.5 text-sm"
            />

            {tooMuch && (
              <p className="mb-3 text-xs" style={{ color: "#ff9b9b" }}>
                Amount exceeds balance (€{max?.toFixed(2)}).
              </p>
            )}

            <button
              onClick={handleConfirm}
              disabled={finalValue <= 0 || tooMuch}
              className="press-glow flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 55%, #000))",
                color: "var(--primary-foreground)",
                boxShadow: "0 0 20px color-mix(in oklab, var(--theme-accent) 55%, transparent)",
              }}
            >
              {actionLabel} · €{finalValue.toFixed(2)}
            </button>
          </>
        )}

        {phase === "processing" && (
          <div className="grid place-items-center py-8">
            <Loader2
              className="h-12 w-12"
              style={{
                color: "var(--theme-accent)",
                animation: "processing-spin 1s linear infinite",
                filter: "drop-shadow(0 0 12px var(--theme-accent))",
              }}
            />
            <p className="text-neon-title mt-4 text-sm">{processingLabel}</p>
            <p className="text-soft mt-1 flex items-center gap-1.5 text-[11px]">
              <Lock className="h-3 w-3" /> Encrypted · €{finalValue.toFixed(2)}
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="grid place-items-center py-8">
            <div
              className="grid h-16 w-16 place-items-center rounded-full"
              style={{
                background: "color-mix(in oklab, oklch(0.75 0.18 160) 25%, transparent)",
                color: "#86efac",
                boxShadow: "0 0 26px color-mix(in oklab, oklch(0.75 0.18 160) 70%, transparent)",
                animation: "gift-pop 0.5s ease-out",
              }}
            >
              <Check className="h-8 w-8" />
            </div>
            <p className="text-neon-title mt-3 text-base">Success!</p>
            <p className="text-soft mt-1 text-xs">€{finalValue.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
