import { useEffect, useMemo } from "react";
import type { Gift } from "./gifts";

type Props = {
  gift: Gift;
  onDone: () => void;
};

/**
 * Cinematic full-screen gift animation.
 * - Backdrop blur + slight darken (focus on gift)
 * - Big emoji zoom 0 → 1.3 → 1
 * - Per-gift particle effect
 * - Auto-dismisses ~2.6s
 */
export function GiftFX({ gift, onDone }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(t);
  }, [onDone]);

  // Pre-compute particle positions once
  const particles = useMemo(() => {
    const count =
      gift.tier === "premium" ? 28 : gift.tier === "mid" ? 18 : 12;
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.6}s`,
      dur: `${1.6 + Math.random() * 1.2}s`,
      size: 10 + Math.random() * 18,
      drift: `${(Math.random() - 0.5) * 80}px`,
    }));
  }, [gift.id]);

  // Per-gift particle emoji
  const particleEmoji =
    gift.fx === "petals" ? "🌸"
    : gift.fx === "hearts" ? "❤️"
    : gift.fx === "smile" ? "✨"
    : gift.fx === "crown" ? "✨"
    : gift.fx === "ring" ? "✨"
    : gift.fx === "rocket" ? "🔥"
    : gift.fx === "sapphire" ? "💎"
    : gift.fx === "ruby" ? "✨"
    : "💠";

  const isPremium = gift.tier === "premium";

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at center, oklch(0 0 0 / 35%) 0%, oklch(0 0 0 / 70%) 80%)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        animation: "gift-fade 0.35s ease-out both",
      }}
    >
      {/* Aura */}
      <div
        className="pointer-events-none absolute h-[520px] w-[520px] rounded-full"
        style={{
          background: `radial-gradient(closest-side, ${gift.color}, transparent 70%)`,
          filter: "blur(40px)",
          opacity: 0.55,
          animation: "gift-aura 2.6s ease-out both",
        }}
      />

      {/* Light streaks */}
      {isPremium && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, ${gift.color} 8deg, transparent 16deg, transparent 90deg, ${gift.color} 98deg, transparent 106deg, transparent 180deg, ${gift.color} 188deg, transparent 196deg, transparent 270deg, ${gift.color} 278deg, transparent 286deg, transparent 360deg)`,
            mixBlendMode: "screen",
            opacity: 0.18,
            animation: "gift-rays 2.6s ease-out both",
          }}
        />
      )}

      {/* Particles */}
      <div className="pointer-events-none absolute inset-0">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute -top-10"
            style={{
              left: p.left,
              fontSize: `${p.size}px`,
              animation: `gift-fall ${p.dur} linear ${p.delay} both`,
              ["--drift" as any]: p.drift,
              filter: `drop-shadow(0 0 6px ${gift.color})`,
            }}
          >
            {particleEmoji}
          </span>
        ))}
      </div>

      {/* Main gift */}
      <div
        className="relative grid place-items-center"
        style={{ animation: "gift-shake 2.6s ease-out both" }}
      >
        <div
          className="grid place-items-center rounded-full"
          style={{
            width: 220,
            height: 220,
            background: `radial-gradient(closest-side, color-mix(in oklab, ${gift.color} 35%, transparent), transparent 70%)`,
            boxShadow: `0 0 80px ${gift.color}, inset 0 0 40px color-mix(in oklab, ${gift.color} 30%, transparent)`,
            animation: "gift-pop 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) both",
          }}
        >
          <span
            style={{
              fontSize: 128,
              filter: `drop-shadow(0 0 20px ${gift.color})`,
              animation:
                gift.fx === "hearts"
                  ? "gift-heartbeat 0.9s ease-in-out infinite"
                  : gift.fx === "rocket"
                  ? "gift-rocket 2.6s ease-in both"
                  : "none",
            }}
          >
            {gift.emoji}
          </span>
        </div>
        <div
          className="mt-6 rounded-full px-5 py-1.5 text-sm font-semibold tracking-wide"
          style={{
            background: "oklch(1 0 0 / 8%)",
            color: gift.color,
            border: `1px solid ${gift.color}`,
            boxShadow: `0 0 20px color-mix(in oklab, ${gift.color} 50%, transparent)`,
            backdropFilter: "blur(8px)",
            animation: "gift-fade 0.6s ease-out 0.4s both",
          }}
        >
          {gift.name} · €{gift.price.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
