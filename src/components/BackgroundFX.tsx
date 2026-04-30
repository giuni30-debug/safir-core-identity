import { useApp, type NeonColor } from "@/contexts/AppContext";
import { useEffect, useState } from "react";

type Star = { id: number; top: string; left: string; size: number; delay: string };

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

  // Neon background takes over when selected
  if (bg === "neon") {
    const color = NEON_HEX[neon];
    return (
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={{ background: "#05060a" }}
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
            neonAnim ? "animate-[neon-pulse_8s_ease-in-out_infinite]" : ""
          }`}
          style={{ background: color }}
        />
      </div>
    );
  }

  if (anim === "none") return null;

  if (anim === "glow") {
    return (
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full blur-3xl opacity-40"
          style={{ background: "var(--theme-accent)" }}
        />
        <div
          className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full blur-3xl opacity-20"
          style={{ background: "var(--theme-accent)" }}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {stars.map((s) => (
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
    </div>
  );
}
