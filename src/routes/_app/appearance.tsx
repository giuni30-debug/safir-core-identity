import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useApp, type ThemeColor, type BgKind, type AnimKind } from "@/contexts/AppContext";

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
];

const ANIMS: { id: AnimKind; label: string }[] = [
  { id: "none", label: "None" },
  { id: "stars", label: "Stars" },
  { id: "glow", label: "Glow" },
  { id: "particles", label: "Particles" },
];

function AppearancePage() {
  const { t, theme, setTheme, bg, setBg, anim, setAnim } = useApp();

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
