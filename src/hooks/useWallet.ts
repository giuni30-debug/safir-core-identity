import { useEffect, useState, useCallback } from "react";

const KEY = "spl_wallet_v1";
const TX_KEY = "spl_wallet_tx_v1";
const DEFAULT_BALANCE = 25; // €25 starter

export type WalletTx = {
  id: string;
  type: "topup" | "spend" | "withdraw" | "received";
  amount: number;
  label: string;
  at: number;
  // Optional gift metadata (so wallet history can render gift icons)
  giftId?: string;
  giftEmoji?: string;
  giftColor?: string;
};

function read(): number {
  if (typeof window === "undefined") return DEFAULT_BALANCE;
  const raw = localStorage.getItem(KEY);
  if (raw == null) {
    localStorage.setItem(KEY, String(DEFAULT_BALANCE));
    return DEFAULT_BALANCE;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : DEFAULT_BALANCE;
}

function readTx(): WalletTx[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(TX_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useWallet() {
  const [balance, setBalance] = useState<number>(() => read());
  const [tx, setTx] = useState<WalletTx[]>(() => readTx());

  // Sync across tabs/components in real time
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setBalance(read());
      if (e.key === TX_KEY) setTx(readTx());
    };
    const onCustom = () => {
      setBalance(read());
      setTx(readTx());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("spl-wallet-changed", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("spl-wallet-changed", onCustom as EventListener);
    };
  }, []);

  const persist = (next: number, entry: WalletTx) => {
    localStorage.setItem(KEY, String(next));
    const nextTx = [entry, ...readTx()].slice(0, 100);
    localStorage.setItem(TX_KEY, JSON.stringify(nextTx));
    setBalance(next);
    setTx(nextTx);
    // Notify other live useWallet() subscribers in the same tab
    window.dispatchEvent(new CustomEvent("spl-wallet-changed"));
  };

  const topUp = useCallback((amount: number) => {
    const next = Math.max(0, balance + amount);
    persist(next, {
      id: crypto.randomUUID(),
      type: "topup",
      amount,
      label: `Top-up €${amount.toFixed(2)}`,
      at: Date.now(),
    });
  }, [balance]);

  const withdraw = useCallback((amount: number): boolean => {
    if (balance < amount) return false;
    const next = balance - amount;
    persist(next, {
      id: crypto.randomUUID(),
      type: "withdraw",
      amount,
      label: `Withdraw €${amount.toFixed(2)}`,
      at: Date.now(),
    });
    return true;
  }, [balance]);

  const spend = useCallback(
    (amount: number, label: string, meta?: { giftId?: string; giftEmoji?: string; giftColor?: string }): boolean => {
      if (balance < amount) return false;
      const next = balance - amount;
      persist(next, {
        id: crypto.randomUUID(),
        type: "spend",
        amount,
        label,
        at: Date.now(),
        ...meta,
      });
      return true;
    },
    [balance],
  );

  return { balance, tx, topUp, withdraw, spend };
}

/** Smooth count-up/down animation for a numeric value. ~600ms. */
export function useAnimatedNumber(value: number, durationMs = 700) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const start = display;
    const delta = value - start;
    if (delta === 0) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(start + delta * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return display;
}
