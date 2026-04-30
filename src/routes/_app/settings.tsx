import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, ChevronRight, User, Languages, Bell, LogOut, Trash2,
  Download, CheckCircle2, Palette, Image as ImageIcon, Sparkles, Sun, Zap, CircleOff,
} from "lucide-react";
import { useApp, type ThemeColor, type BgKind, type AnimKind } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { onInstallPromptChange, triggerInstall, isStandalone, isIOS } from "@/lib/pwa";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — Safir Private Life" },
      { name: "description", content: "Premium control panel: customize colors, background and animations." },
    ],
  }),
});

const THEME_COLORS: { id: ThemeColor; hex: string; label: string }[] = [
  { id: "cyan",    hex: "#22d3ee", label: "Cyan" },
  { id: "blue",    hex: "#3b82f6", label: "Blue" },
  { id: "purple",  hex: "#a855f7", label: "Purple" },
  { id: "gold",    hex: "#eab308", label: "Yellow" },
  { id: "emerald", hex: "#10b981", label: "Green" },
  { id: "red",     hex: "#ef4444", label: "Red" },
];

const BG_OPTIONS: { id: BgKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "gradient", label: "Gradient", icon: Sun },
  { id: "image",    label: "Image",    icon: ImageIcon },
  { id: "neon",     label: "Neon",     icon: Sparkles },
];

const ANIM_OPTIONS: { id: AnimKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "none",      label: "None",      icon: CircleOff },
  { id: "glow",      label: "Glow",      icon: Zap },
  { id: "particles", label: "Particles", icon: Sparkles },
  { id: "stars",     label: "Stars",     icon: Sparkles },
];

function SettingsPage() {
  const { t, signOut, theme, setTheme, bg, setBg, anim, setAnim } = useApp();
  const navigate = useNavigate();

  const onLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const onDelete = async () => {
    if (!confirm(t("confirmDelete"))) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
    toast.success("Account removed.");
    navigate({ to: "/login" });
  };

  return (
    <div>
      <header className="flex items-center gap-3">
        <Link
          to="/home"
          aria-label="Back"
          className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{t("settings")}</h1>
          <p className="text-xs text-muted-foreground">Premium control panel</p>
        </div>
      </header>

      {/* ===== Customization ===== */}
      <Section
        title="Theme color"
        subtitle="Pick a neon accent — applied instantly across the app"
        icon={Palette}
      >
        <div className="grid grid-cols-6 gap-3">
          {THEME_COLORS.map((c) => {
            const active = theme === c.id;
            return (
              <button
                key={c.id}
                onClick={() => { setTheme(c.id); toast.success(`${c.label} theme`); }}
                aria-label={c.label}
                aria-pressed={active}
                className={`press-glow relative aspect-square rounded-2xl transition-transform duration-300 ${
                  active ? "scale-110 sel-glow" : "opacity-80 hover:opacity-100 hover:scale-105"
                }`}
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${c.hex}, ${c.hex}cc 55%, ${c.hex}77)`,
                  ["--sel-color" as never]: c.hex,
                  boxShadow: active ? undefined : `0 0 10px ${c.hex}55`,
                }}
              >
                {active && (
                  <CheckCircle2
                    className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow"
                    strokeWidth={3}
                  />
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="Background"
        subtitle="Live preview — switches as you tap"
        icon={ImageIcon}
      >
        <OptionGrid
          options={BG_OPTIONS}
          value={bg}
          onChange={(v) => { setBg(v); toast.success(`Background: ${v}`); }}
        />
      </Section>

      <Section
        title="Animations"
        subtitle="Choose the level of background motion"
        icon={Sparkles}
      >
        <OptionGrid
          options={ANIM_OPTIONS}
          value={anim}
          onChange={(v) => { setAnim(v); toast.success(`Animation: ${v}`); }}
        />
      </Section>

      {/* ===== Account ===== */}
      <p className="mt-8 mb-3 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Account
      </p>
      <div className="space-y-3">
        <Row to="/profile"       icon={User}      label={t("profile")} />
        <Row to="/language"      icon={Languages} label={t("language")} />
        <Row to="/notifications" icon={Bell}      label={t("notifications")} />
      </div>

      <InstallRow />

      <div className="mt-8 space-y-3">
        <button
          onClick={onLogout}
          className="press-glow glass-card glass-card-hover flex w-full items-center gap-3 p-4 text-left"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5">
            <LogOut className="h-4 w-4" />
          </div>
          <span className="flex-1 text-sm font-medium">{t("logout")}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          onClick={onDelete}
          className="press-glow glass-card flex w-full items-center gap-3 p-4 text-left text-destructive transition hover:border-destructive"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/10 text-destructive">
            <Trash2 className="h-4 w-4" />
          </div>
          <span className="flex-1 text-sm font-medium">{t("deleteAccount")}</span>
        </button>
      </div>

      <div className="h-6" />
    </div>
  );
}

function Section({
  title, subtitle, icon: Icon, children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-[var(--theme-accent)]" />
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/90">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="glass-card p-4">{children}</div>
    </div>
  );
}

function OptionGrid<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string; icon: React.ComponentType<{ className?: string }> }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {options.map((o) => {
        const active = value === o.id;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={`press-glow relative flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-xs font-medium transition-all duration-300 ${
              active
                ? "border-transparent bg-[color-mix(in_oklab,var(--theme-accent)_18%,transparent)] text-foreground sel-glow"
                : "border-border bg-white/[0.03] text-muted-foreground hover:border-[var(--theme-accent)] hover:text-foreground"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "text-[var(--theme-accent)]" : ""}`} />
            <span>{o.label}</span>
            {active && (
              <span className="absolute right-2 top-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Row({
  to, icon: Icon, label,
}: {
  to: "/profile" | "/language" | "/notifications";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link to={to} className="press-glow glass-card glass-card-hover flex items-center gap-3 p-4">
      <div
        className="grid h-9 w-9 place-items-center rounded-xl"
        style={{
          background: "color-mix(in oklab, var(--theme-accent) 15%, transparent)",
          color: "var(--theme-accent)",
        }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function InstallRow() {
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    return onInstallPromptChange(setAvailable);
  }, []);

  if (installed) {
    return (
      <div className="mt-6 glass-card flex items-center gap-3 p-4">
        <div
          className="grid h-9 w-9 place-items-center rounded-xl"
          style={{
            background: "color-mix(in oklab, var(--theme-accent) 15%, transparent)",
            color: "var(--theme-accent)",
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <span className="flex-1 text-sm font-medium">App installed</span>
      </div>
    );
  }

  const onInstall = async () => {
    if (available) {
      const outcome = await triggerInstall();
      if (outcome === "unavailable") {
        toast.message(
          isIOS()
            ? "On iPhone: tap Share → Add to Home Screen."
            : "Open this app in Chrome, tap ⋮, then tap Add to Home screen.",
        );
      }
    } else {
      toast.message(
        isIOS()
          ? "On iPhone: tap Share → Add to Home Screen."
          : "Open this app in Chrome, tap ⋮, then tap Add to Home screen.",
      );
    }
  };

  return (
    <button
      onClick={onInstall}
      className="press-glow mt-6 glass-card glass-card-hover flex w-full items-center gap-3 p-4 text-left"
    >
      <div
        className="grid h-9 w-9 place-items-center rounded-xl"
        style={{
          background: "var(--gradient-primary)",
          color: "var(--primary-foreground)",
          boxShadow: "var(--shadow-glow)",
        }}
      >
        <Download className="h-4 w-4" />
      </div>
      <span className="flex-1 text-sm font-medium">Install / Add to Home Screen</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
