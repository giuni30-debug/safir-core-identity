import { useEffect, useRef } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

type Props = {
  state: OrbState;
  /** 0..1 input level (mic). Used in listening state */
  inputLevel?: number;
  /** 0..1 output level (AI voice). Used in speaking state */
  outputLevel?: number;
  /** CSS pixel size of the orb (square). */
  size?: number;
  /** Hex/oklch color string. */
  hue?: string;
};

/**
 * Cinematic AI orb — pure 2D canvas, runs at native refresh rate.
 * - idle: slow breathing glow + drifting particles
 * - listening: expands, pulsing waveform ring reactive to mic input
 * - thinking: rotating shimmer ring, subtle warp
 * - speaking: outer waveform synced to AI voice level
 * - error: red flicker + shake
 */
export function AssistantOrb({
  state,
  inputLevel = 0,
  outputLevel = 0,
  size = 260,
  hue,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<OrbState>(state);
  const inRef = useRef(0);
  const outRef = useRef(0);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { inRef.current = inputLevel; }, [inputLevel]);
  useEffect(() => { outRef.current = outputLevel; }, [outputLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const baseR = size * 0.28;

    // particles around
    const particles = Array.from({ length: 28 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: baseR * (1.4 + Math.random() * 0.9),
      s: 0.0008 + Math.random() * 0.0014,
      o: 0.2 + Math.random() * 0.5,
      sz: 0.6 + Math.random() * 1.6,
    }));

    let raf = 0;
    let t0 = performance.now();
    let smoothIn = 0;
    let smoothOut = 0;
    let shake = 0;

    const tick = (now: number) => {
      const dt = Math.min(now - t0, 60);
      t0 = now;
      const time = now * 0.001;
      const s = stateRef.current;

      // smooth audio levels
      smoothIn += (inRef.current - smoothIn) * 0.18;
      smoothOut += (outRef.current - smoothOut) * 0.22;

      // background colors per state
      const palette = (() => {
        if (s === "error") return { c1: "#ff4d6d", c2: "#a30021", glow: "255,77,109" };
        if (hue) return { c1: hue, c2: hue, glow: "120,180,255" };
        switch (s) {
          case "listening": return { c1: "#6ee7ff", c2: "#3b82f6", glow: "110,231,255" };
          case "thinking":  return { c1: "#c084fc", c2: "#7c3aed", glow: "192,132,252" };
          case "speaking":  return { c1: "#7dd3fc", c2: "#22d3ee", glow: "125,211,252" };
          default:          return { c1: "#a5b4fc", c2: "#6366f1", glow: "165,180,252" };
        }
      })();

      ctx.clearRect(0, 0, size, size);

      // shake on error
      let ox = 0, oy = 0;
      if (s === "error") {
        shake = Math.min(1, shake + dt * 0.005);
        ox = (Math.random() - 0.5) * 6 * shake;
        oy = (Math.random() - 0.5) * 6 * shake;
      } else {
        shake *= 0.9;
      }

      // breathing / level scale
      const breathe = (Math.sin(time * (s === "idle" ? 1.1 : 1.6)) + 1) * 0.5;
      const audioBoost = s === "listening" ? smoothIn * 0.6 : s === "speaking" ? smoothOut * 0.7 : 0;
      const scale = 1 + breathe * (s === "idle" ? 0.04 : 0.08) + audioBoost * 0.5;
      const r = baseR * scale;

      // outer glow
      const glowR = r * 2.6;
      const glow = ctx.createRadialGradient(cx + ox, cy + oy, r * 0.2, cx + ox, cy + oy, glowR);
      glow.addColorStop(0, `rgba(${palette.glow}, ${0.55 + audioBoost * 0.35})`);
      glow.addColorStop(0.5, `rgba(${palette.glow}, 0.18)`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // particles
      ctx.save();
      for (const p of particles) {
        p.a += p.s * dt * (s === "thinking" ? 4 : 1);
        const px = cx + Math.cos(p.a) * p.r + ox;
        const py = cy + Math.sin(p.a) * p.r + oy;
        ctx.fillStyle = `rgba(${palette.glow}, ${p.o})`;
        ctx.beginPath();
        ctx.arc(px, py, p.sz, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // thinking ring (rotating arc)
      if (s === "thinking") {
        ctx.save();
        ctx.translate(cx + ox, cy + oy);
        ctx.rotate(time * 1.6);
        ctx.strokeStyle = `rgba(${palette.glow}, 0.85)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.55, 0, Math.PI * 0.6);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${palette.glow}, 0.35)`;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.55, Math.PI, Math.PI * 1.4);
        ctx.stroke();
        ctx.restore();
      }

      // waveform ring (listening / speaking)
      if (s === "listening" || s === "speaking") {
        const lvl = s === "listening" ? smoothIn : smoothOut;
        ctx.save();
        ctx.translate(cx + ox, cy + oy);
        ctx.strokeStyle = `rgba(${palette.glow}, ${0.5 + lvl * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const segs = 64;
        for (let i = 0; i <= segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          const noise = Math.sin(a * 6 + time * 6) * 0.5 + Math.sin(a * 11 + time * 4) * 0.5;
          const rr = r * 1.3 + lvl * 18 + noise * lvl * 8;
          const x = Math.cos(a) * rr;
          const y = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // orb body
      const body = ctx.createRadialGradient(
        cx + ox - r * 0.3, cy + oy - r * 0.4, r * 0.05,
        cx + ox, cy + oy, r
      );
      body.addColorStop(0, "rgba(255,255,255,0.95)");
      body.addColorStop(0.35, palette.c1);
      body.addColorStop(1, palette.c2);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
      ctx.fill();

      // glass highlight
      ctx.save();
      ctx.globalAlpha = 0.5;
      const hl = ctx.createRadialGradient(
        cx + ox - r * 0.45, cy + oy - r * 0.55, 0,
        cx + ox - r * 0.45, cy + oy - r * 0.55, r * 0.7
      );
      hl.addColorStop(0, "rgba(255,255,255,0.7)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hl;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, hue]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ display: "block", filter: "saturate(1.15)" }}
    />
  );
}
