import { useApp, type NeonColor } from "@/contexts/AppContext";
import { useEffect, useRef, useState } from "react";

type Star = { id: number; top: string; left: string; size: number; delay: string };
type Ripple = { id: number; x: number; y: number; color: string };

const NEON_HEX: Record<NeonColor, string> = {
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
};

export function BackgroundFX() {
  const { anim, bg, neon, neonAnim } = useApp();
  const [stars, setStars] = useState<Star[]>([]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [parallax, setParallax] = useState(0);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (anim !== "stars" && anim !== "particles") return;
    const count = anim === "particles" ? 60 : 80;
    const arr: Star[] = Array.from({ length: count }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: anim === "particles" ? Math.random() * 3 + 1 : Math.random() * 2 + 0.5,
      delay: `${Math.random() * 3}s`,
    }));
    setStars(arr);
  }, [anim]);

  // Parallax on scroll (very subtle, mobile-safe via passive listener)
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        setParallax(y * 0.06); // gentle factor
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // Also listen on inner scroll containers (best effort)
    document.querySelectorAll(".overflow-y-auto, .app-frame").forEach((el) => {
      el.addEventListener("scroll", onScroll, { passive: true } as any);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Tap ripple — listens globally on pointerdown
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      // Skip ripple inside text inputs to avoid distraction
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      const id = Date.now() + Math.random();
      const color =
        bg === "neon"
          ? NEON_HEX[neon]
          : "var(--theme-accent)";
      setRipples((r) => [...r, { id, x: e.clientX, y: e.clientY, color }]);
      window.setTimeout(() => {
        setRipples((r) => r.filter((x) => x.id !== id));
      }, 700);
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onDown);
  }, [bg, neon]);

  const accentColor =
    bg === "neon" ? NEON_HEX[neon] : "var(--theme-accent)";

  // Common decorative overlays (light rays + drifting wave + ripples)
  const Overlays = (
    <>
      {/* Soft rotating light rays */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "180vmax",
          height: "180vmax",
          background: `conic-gradient(from 0deg,
            transparent 0deg,
            color-mix(in oklab, ${accentColor} 18%, transparent) 25deg,
            transparent 80deg,
            transparent 180deg,
            color-mix(in oklab, ${accentColor} 12%, transparent) 220deg,
            transparent 280deg,
            transparent 360deg)`,
          filter: "blur(40px)",
          opacity: 0.35,
          animation: "rays-spin 60s linear infinite",
          willChange: "transform",
        }}
      />
      {/* Drifting light wave overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[-10%]"
        style={{
          background: `radial-gradient(60% 50% at 30% 20%, color-mix(in oklab, ${accentColor} 16%, transparent), transparent 65%),
                       radial-gradient(50% 40% at 75% 80%, color-mix(in oklab, ${accentColor} 14%, transparent), transparent 65%)`,
          filter: "blur(50px)",
          animation: "wave-drift 14s ease-in-out infinite",
          willChange: "transform",
        }}
      />
      {/* Tap ripples */}
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden
          className="pointer-events-none fixed"
          style={{
            left: r.x,
            top: r.y,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: `radial-gradient(closest-side, color-mix(in oklab, ${r.color} 45%, transparent), transparent 70%)`,
            transform: "translate(-50%, -50%) scale(0)",
            animation: "bg-ripple 0.7s ease-out forwards",
            mixBlendMode: "screen",
          }}
        />
      ))}
    </>
  );

  // ── NEON BG MODE ──
  if (bg === "neon") {
    const color = NEON_HEX[neon];
    return (
      <div
        ref={layerRef}
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={{
          background: "#05060a",
          transform: `translate3d(0, ${-parallax}px, 0)`,
          willChange: "transform",
        }}
      >
        <div
          className={`absolute -top-40 left-[10%] h-[520px] w-[520px] rounded-full blur-[120px] opacity-50 ${
            neonAnim ? "animate-[neon-drift_18s_ease-in-out_infinite]" : ""
          }`}
          style={{ background: color }}
        />
        <div
          className={`absolute bottom-[-160px] right-[5%] h-[460px] w-[460px] rounded-full blur-[120px] opacity-40 ${
            neonAnim ? "animate-[neon-drift-2_22s_ease-in-out_infinite]" : ""
          }`}
          style={{ background: color }}
        />
        <div
          className={`absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] opacity-25 ${
            neonAnim ? "animate-[neon-bg-pulse_8s_ease-in-out_infinite]" : ""
          }`}
          style={{ background: color }}
        />
        {Overlays}
      </div>
    );
  }

  // ── DEFAULT BG (gradient/image) — premium mesh + aurora blobs ──
  return (
    <div
      ref={layerRef}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        transform: `translate3d(0, ${-parallax}px, 0)`,
        willChange: "transform",
      }}
    >
      {/* Animated gradient mesh — Linear/Vercel style */}
      <div className="mesh-bg" aria-hidden />

      {/* Slow-drifting aurora blobs — violet, cyan, pink */}
      <div
        className="aurora-blob violet"
        aria-hidden
        style={{ top: "-15%", left: "-10%", width: "55vmax", height: "55vmax" }}
      />
      <div
        className="aurora-blob cyan"
        aria-hidden
        style={{ top: "20%", right: "-15%", width: "50vmax", height: "50vmax" }}
      />
      <div
        className="aurora-blob pink"
        aria-hidden
        style={{ bottom: "-20%", left: "20%", width: "45vmax", height: "45vmax" }}
      />

      {/* Glow overlay (kept when anim === 'glow') */}
      {anim === "glow" && (
        <>
          <div
            className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full blur-3xl opacity-40"
            style={{ background: "var(--theme-accent)" }}
          />
          <div
            className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full blur-3xl opacity-20"
            style={{ background: "var(--theme-accent)" }}
          />
        </>
      )}

      {/* Stars / particles */}
      {(anim === "stars" || anim === "particles") &&
        stars.map((s) => (
          <span
            key={s.id}
            className="star"
            style={{
              top: s.top,
              left: s.left,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: s.delay,
              background: anim === "particles" ? "var(--theme-accent)" : "white",
              boxShadow:
                anim === "particles" ? `0 0 6px var(--theme-accent)` : "none",
            }}
          />
        ))}

      {/* Cinematic overlays — light rays + wave + ripples (always on, even when anim === 'none') */}
      {Overlays}
    </div>
  );
}
