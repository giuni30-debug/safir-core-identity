import { useApp } from "@/contexts/AppContext";
import { useEffect, useState } from "react";

type Star = { id: number; top: string; left: string; size: number; delay: string };

export function BackgroundFX() {
  const { anim } = useApp();
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
