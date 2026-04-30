import { useEffect, useState, useCallback } from "react";

const KEY = "spl_wallet_v1";
const TX_KEY = "spl_wallet_tx_v1";
const DEFAULT_BALANCE = 25; // €25 starter

export type WalletTx = {
  id: string;
  type: "topup" | "spend";
  amount: number;
  label: string;
  at: number;
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

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setBalance(read());
      if (e.key === TX_KEY) setTx(readTx());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = (next: number, entry: WalletTx) => {
    localStorage.setItem(KEY, String(next));
    const nextTx = [entry, ...readTx()].slice(0, 50);
    localStorage.setItem(TX_KEY, JSON.stringify(nextTx));
    setBalance(next);
    setTx(nextTx);
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

  const spend = useCallback(
    (amount: number, label: string): boolean => {
      if (balance < amount) return false;
      const next = balance - amount;
      persist(next, {
        id: crypto.randomUUID(),
        type: "spend",
        amount,
        label,
        at: Date.now(),
      });
      return true;
    },
    [balance],
  );

  return { balance, tx, topUp, spend };
}
