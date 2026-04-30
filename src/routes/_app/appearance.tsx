import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useApp, type ThemeColor, type BgKind, type AnimKind, type NeonColor } from "@/contexts/AppContext";

export const Route = createFileRoute("/_app/appearance")({
  component: AppearancePage,
  head: () => ({
    meta: [
      { title: "Appearance — Safir Private Life" },
      { name: "description", content: "Customize theme color, background and animations." },
    ],
  }),
});

const COLORS: { id: ThemeColor; hex: string; label: string }[] = [
  { id: "cyan", hex: "#22d3ee", label: "Cyan" },
  { id: "blue", hex: "#3b82f6", label: "Blue" },
  { id: "purple", hex: "#a855f7", label: "Purple" },
  { id: "gold", hex: "#eab308", label: "Gold" },
  { id: "emerald", hex: "#10b981", label: "Emerald" },
  { id: "red", hex: "#ef4444", label: "Red" },
];

const BGS: { id: BgKind; label: string }[] = [
  { id: "gradient", label: "Gradient" },
  { id: "image", label: "Image" },
  { id: "neon", label: "Neon" },
];

const ANIMS: { id: AnimKind; label: string }[] = [
  { id: "none", label: "None" },
  { id: "stars", label: "Stars" },
  { id: "glow", label: "Glow" },
  { id: "particles", label: "Particles" },
];

const NEONS: { id: NeonColor; hex: string; label: string }[] = [
  { id: "blue", hex: "#3b82f6", label: "Neon Blue" },
  { id: "purple", hex: "#a855f7", label: "Neon Purple" },
  { id: "pink", hex: "#ec4899", label: "Neon Pink" },
  { id: "green", hex: "#22c55e", label: "Neon Green" },
  { id: "orange", hex: "#f97316", label: "Neon Orange" },
  { id: "red", hex: "#ef4444", label: "Neon Red" },
];

function AppearancePage() {
  const { t, theme, setTheme, bg, setBg, anim, setAnim, neon, setNeon, neonAnim, setNeonAnim } = useApp();

  return (
    <div className="animate-[fade-in_0.4s_ease-out]">
      <header className="flex items-center gap-3">
        <Link to="/settings" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t("appearance")}</h1>
      </header>

      <Section title={t("themeColor")}>
        <div className="grid grid-cols-6 gap-3">
          {COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setTheme(c.id)}
              aria-label={c.label}
              className={`aspect-square rounded-2xl transition ${theme === c.id ? "ring-2 ring-offset-2 ring-offset-background" : "opacity-80 hover:opacity-100"}`}
              style={{
                background: c.hex,
                boxShadow: theme === c.id ? `0 0 20px ${c.hex}80` : undefined,
                ["--tw-ring-color" as never]: c.hex,
              }}
            />
          ))}
        </div>
      </Section>

      <Section title={t("background")}>
        <Pills options={BGS} value={bg} onChange={setBg} />
      </Section>

      {bg === "neon" && (
        <Section title={t("neonBackground")}>
          <div className="grid grid-cols-6 gap-3">
            {NEONS.map((n) => {
              const active = neon === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setNeon(n.id)}
                  aria-label={n.label}
                  className={`aspect-square rounded-full transition ${active ? "ring-2 ring-offset-2 ring-offset-background scale-110" : "opacity-85 hover:opacity-100"}`}
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${n.hex}, ${n.hex}99 60%, ${n.hex}55)`,
                    boxShadow: active
                      ? `0 0 24px ${n.hex}, 0 0 48px ${n.hex}80`
                      : `0 0 12px ${n.hex}60`,
                    ["--tw-ring-color" as never]: n.hex,
                  }}
                />
              );
            })}
          </div>

          <label className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/30 px-4 py-3">
            <span className="text-sm font-medium">{t("neonAnimation")}</span>
            <input
              type="checkbox"
              checked={neonAnim}
              onChange={(e) => setNeonAnim(e.target.checked)}
              className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-muted transition checked:bg-primary relative
                before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition
                checked:before:translate-x-4"
            />
          </label>
        </Section>
      )}

      <Section title={t("animations")}>
        <Pills options={ANIMS} value={anim} onChange={setAnim} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="glass-card p-4">{children}</div>
    </div>
  );
}

function Pills<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
            value === o.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-primary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
