import { useEffect, useMemo, useState } from "react";
import { X, Search, Send, Wallet, Lock, Check } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";

export type ContactLite = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** If provided, skip contact-picker step and send directly to this contact. */
  presetContact?: ContactLite | null;
  /** Called after successful "send" with the chosen contact + amount. */
  onSent?: (contact: ContactLite, amount: number) => void;
};

const PRESETS = [1, 5, 10, 25, 50];

export function SendMoneySheet({ open, onClose, presetContact, onSent }: Props) {
  const { user } = useApp();
  const { balance, spend } = useWallet();
  const [step, setStep] = useState<"pick" | "amount" | "flying" | "done">(
    presetContact ? "amount" : "pick",
  );
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ContactLite | null>(presetContact ?? null);
  const [amount, setAmount] = useState<number>(5);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStep(presetContact ? "amount" : "pick");
    setPicked(presetContact ?? null);
    setQuery("");
    setAmount(5);
    setCustom("");
    setError(null);
  }, [open, presetContact]);

  // Load contacts when picker is shown
  useEffect(() => {
    if (!open || step !== "pick" || !user) return;
    let cancelled = false;
    (async () => {
      const { data: conns } = await supabase
        .from("connections")
        .select("contact_id")
        .eq("owner_id", user.id);
      const ids = (conns ?? []).map((c) => c.contact_id);
      if (!ids.length) {
        if (!cancelled) setContacts([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);
      if (!cancelled) setContacts((profs ?? []) as ContactLite[]);
    })();
    return () => { cancelled = true; };
  }, [open, step, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.display_name.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q),
    );
  }, [contacts, query]);

  const finalAmount = (() => {
    const n = Number(custom);
    if (custom && Number.isFinite(n) && n > 0) return n;
    return amount;
  })();
  const tooMuch = finalAmount > balance;

  if (!open) return null;

  const handleConfirm = () => {
    setError(null);
    if (!picked) return;
    if (finalAmount <= 0) { setError("Enter an amount"); return; }
    if (tooMuch) { setError(`Need €${(finalAmount - balance).toFixed(2)} more`); return; }

    setStep("flying");
    // Simulate transfer animation, then commit
    window.setTimeout(() => {
      const ok = spend(finalAmount, `Sent to ${picked.display_name}`, {
        // reuse gift meta slots to color the row
        giftEmoji: "💸",
        giftColor: "oklch(0.78 0.18 160)",
      });
      if (!ok) {
        setError("Insufficient balance");
        setStep("amount");
        return;
      }
      setStep("done");
      window.setTimeout(() => {
        onSent?.(picked, finalAmount);
        onClose();
      }, 900);
    }, 1100);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      style={{
        background: "oklch(0 0 0 / 60%)",
        backdropFilter: "blur(10px)",
        animation: "gift-fade 0.22s ease-out both",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card relative w-full max-w-md p-5"
        style={{
          borderRadius: "28px 28px 0 0",
          maxHeight: "90vh",
          overflow: "hidden",
          animation: "sheet-up 0.32s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-neon-title text-lg">Send money</h2>
            <p className="text-soft flex items-center gap-1.5 text-[11px]">
              <Lock className="h-3 w-3" /> Secure transaction · end-to-end
            </p>
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
            <p className="text-soft text-[11px] uppercase tracking-widest">Balance</p>
            <p className="text-neon-title text-lg tabular-nums">€{balance.toFixed(2)}</p>
          </div>
        </div>

        {/* STEP: Pick contact */}
        {step === "pick" && (
          <div>
            <div className="relative mb-3">
              <Search className="text-soft absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contact"
                className="w-full rounded-xl border border-border bg-card/40 py-2.5 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: "44vh" }}>
              {filtered.length === 0 ? (
                <div className="glass-card grid place-items-center p-6 text-center" style={{ borderRadius: 18 }}>
                  <p className="text-soft text-sm">No contacts found</p>
                  <p className="text-soft text-[11px]">Add a contact to start sending money</p>
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setPicked(c); setStep("amount"); }}
                    className="press-glow flex w-full items-center gap-3 rounded-2xl border border-border bg-card/30 p-2.5 text-left"
                  >
                    <Avatar url={c.avatar_url} name={c.display_name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="text-premium truncate text-sm font-semibold">{c.display_name}</p>
                      <p className="text-soft truncate text-[11px]">@{c.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP: Amount */}
        {step === "amount" && picked && (
          <div>
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card/30 p-3">
              <Avatar url={picked.avatar_url} name={picked.display_name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-soft text-[11px] uppercase tracking-widest">Sending to</p>
                <p className="text-premium truncate text-sm font-semibold">{picked.display_name}</p>
              </div>
              {!presetContact && (
                <button
                  type="button"
                  onClick={() => setStep("pick")}
                  className="text-soft text-[11px] underline"
                >
                  Change
                </button>
              )}
            </div>

            <div className="mb-3 grid grid-cols-5 gap-2">
              {PRESETS.map((p) => {
                const active = !custom && p === amount;
                return (
                  <button
                    key={p}
                    onClick={() => { setCustom(""); setAmount(p); }}
                    className="rounded-xl border py-2 text-xs font-bold tabular-nums"
                    style={{
                      borderColor: active ? "var(--theme-accent)" : "var(--glass-border)",
                      background: active
                        ? "color-mix(in oklab, var(--theme-accent) 18%, transparent)"
                        : "oklch(1 0 0 / 4%)",
                      color: "#fff",
                      boxShadow: active
                        ? "0 0 12px color-mix(in oklab, var(--theme-accent) 50%, transparent)"
                        : "none",
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

            {error && (
              <p className="mb-3 text-xs" style={{ color: "#ff9b9b" }}>{error}</p>
            )}

            <button
              onClick={handleConfirm}
              disabled={finalAmount <= 0 || tooMuch}
              className="press-glow flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 55%, #000))",
                color: "var(--primary-foreground)",
                boxShadow: "0 0 22px color-mix(in oklab, var(--theme-accent) 60%, transparent)",
              }}
            >
              <Send className="h-4 w-4" />
              Send €{finalAmount.toFixed(2)}
            </button>
            <p className="text-soft mt-2 flex items-center justify-center gap-1.5 text-[10px]">
              <Lock className="h-3 w-3" /> Encrypted · Instant transfer
            </p>
          </div>
        )}

        {/* STEP: Flying animation */}
        {step === "flying" && picked && (
          <div className="grid place-items-center py-10">
            <div className="relative h-24 w-full overflow-hidden">
              <div
                className="absolute top-1/2 -translate-y-1/2 text-4xl"
                style={{
                  left: 0,
                  animation: "money-fly 1.05s cubic-bezier(0.5, 0, 0.2, 1) forwards",
                  filter: "drop-shadow(0 0 14px var(--theme-accent))",
                }}
              >
                💸
              </div>
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2"
                style={{ animation: "recv-pulse 1.1s ease-out" }}
              >
                <Avatar url={picked.avatar_url} name={picked.display_name} size={56} />
              </div>
            </div>
            <p className="text-neon-title mt-2 text-sm">Sending €{finalAmount.toFixed(2)}…</p>
            <p className="text-soft mt-1 flex items-center gap-1.5 text-[11px]">
              <Lock className="h-3 w-3" /> Secure transaction
            </p>
          </div>
        )}

        {/* STEP: Done */}
        {step === "done" && picked && (
          <div className="grid place-items-center py-10">
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
            <p className="text-neon-title mt-3 text-base">Sent!</p>
            <p className="text-soft mt-1 text-xs">€{finalAmount.toFixed(2)} → {picked.display_name}</p>
          </div>
        )}
      </div>
    </div>
  );
}
