import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  ArrowLeft, ChevronRight, User, Languages, Bell, LogOut, Trash2,
  Download, CheckCircle2, Palette, Image as ImageIcon, Sparkles, Sun, Zap, CircleOff, Brain,
  Volume2, VolumeX, Vibrate, Play, ShieldCheck, FileText, Database, LifeBuoy, Info, Crown,
} from "lucide-react";
import { useApp, type ThemeColor, type BgKind, type AnimKind } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { onInstallPromptChange, triggerInstall, isStandalone, isIOS } from "@/lib/pwa";
import { toast } from "sonner";
import { useSoundPrefs } from "@/hooks/useSoundPrefs";
import { playSound, vibrate } from "@/lib/sound";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import { fadeUp, stagger } from "@/lib/motion";

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
  useTrackScreen("settings_opened");

  const onLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const onDelete = async () => {
    if (!confirm(t("confirmDelete"))) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
    toast.success(t("accountRemoved"));
    navigate({ to: "/login" });
  };

  return (
    <div>
      <motion.header
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex items-center gap-3"
      >
        <Link
          to="/home"
          aria-label="Back"
          className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gradient">{t("settings")}</h1>
          <p className="text-xs text-muted-foreground">{t("premiumPanel")}</p>
        </div>
      </motion.header>

      {/* ===== Account ===== */}
      <p className="mt-8 mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("account")}
      </p>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        <motion.div variants={fadeUp}><Row to="/profile"       icon={User}      label={t("profile")} /></motion.div>
        <motion.div variants={fadeUp}><Row to="/language"      icon={Languages} label={t("language")} /></motion.div>
        <motion.div variants={fadeUp}><Row to="/notifications" icon={Bell}      label={t("notifications")} /></motion.div>
        <motion.div variants={fadeUp}><Row to="/ai-memory"     icon={Brain}     label={t("aiMemoryTitle")} /></motion.div>
      </motion.div>

      {/* ===== Appearance ===== */}
      <p className="mt-8 mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Appearance
      </p>
      <Section
        title={t("themeColor")}
        subtitle={t("themeColorSubtitle")}
        icon={Palette}
      >
        <div className="grid grid-cols-6 gap-3">
          {THEME_COLORS.map((c) => {
            const active = theme === c.id;
            return (
              <button
                key={c.id}
                onClick={() => { setTheme(c.id); toast.success(t("themeApplied").replace("{name}", c.label)); }}
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
        title={t("background")}
        subtitle={t("backgroundSubtitle")}
        icon={ImageIcon}
      >
        <OptionGrid
          options={BG_OPTIONS.map(o => ({ ...o, label: t(o.id === "gradient" ? "gradient" : o.id === "image" ? "image" : "neonBackground") }))}
          value={bg}
          onChange={(v) => { setBg(v); toast.success(t("bgApplied").replace("{name}", v)); }}
        />
      </Section>

      <Section
        title={t("animations")}
        subtitle={t("animationsSubtitle")}
        icon={Sparkles}
      >
        <OptionGrid
          options={ANIM_OPTIONS.map(o => ({ ...o, label: t(o.id === "none" ? "none" : o.id === "glow" ? "glow" : o.id === "particles" ? "particles" : "stars") }))}
          value={anim}
          onChange={(v) => { setAnim(v); toast.success(t("animApplied").replace("{name}", v)); }}
        />
      </Section>

      {/* ===== Sound & Haptics ===== */}
      <p className="mt-8 mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Sound & Haptics
      </p>
      <Section
        title={t("soundsTitle")}
        subtitle={t("soundsSubtitle")}
        icon={Volume2}
      >
        <SoundSettingsPanel />
      </Section>

      {/* ===== Premium ===== */}
      <p className="mt-8 mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Subscription
      </p>
      <div className="space-y-3">
        <Row to="/premium" icon={Crown} label="Safir Premium" />
      </div>

      {/* ===== Privacy & Security ===== */}
      <p className="mt-8 mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Privacy & Security
      </p>
      <div className="space-y-3">
        <Row to="/privacy"       icon={ShieldCheck} label="Privacy Policy" />
        <Row to="/terms"         icon={FileText}    label="Terms & Conditions" />
        <Row to="/data-deletion" icon={Database}    label="Data & Account Deletion" />
      </div>

      {/* ===== Support ===== */}
      <p className="mt-8 mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Support
      </p>
      <div className="space-y-3">
        <Row to="/help"  icon={LifeBuoy} label="Help Center" />
        <Row to="/about" icon={Info}     label="About App" />
        <Row to="/admin" icon={Database} label="Analytics" />
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
  to: "/profile" | "/language" | "/notifications" | "/ai-memory" | "/privacy" | "/terms" | "/data-deletion" | "/help" | "/about" | "/premium" | "/admin";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link to={to} className="press-glow glass-premium flex items-center gap-3 p-4">
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
  const { t } = useApp();
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
        <span className="flex-1 text-sm font-medium">{t("appInstalled")}</span>
      </div>
    );
  }

  const onInstall = async () => {
    const msg = isIOS() ? t("installIOS") : t("installAndroid");
    if (available) {
      const outcome = await triggerInstall();
      if (outcome === "unavailable") toast.message(msg);
    } else {
      toast.message(msg);
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
      <span className="flex-1 text-sm font-medium">{t("installApp")}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function SoundSettingsPanel() {
  const { t } = useApp();
  const { prefs, setPrefs } = useSoundPrefs();
  return (
    <div className="space-y-4">
      {/* Sounds toggle */}
      <label className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[var(--theme-accent)]">
          {prefs.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </span>
        <span className="flex-1 text-sm font-medium">{t("soundEnabled")}</span>
        <input
          type="checkbox"
          checked={prefs.soundEnabled}
          onChange={(e) => setPrefs({ soundEnabled: e.target.checked })}
          className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-white/10 transition-all checked:bg-[var(--theme-accent)] relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
        />
      </label>

      {/* Volume slider */}
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[var(--theme-accent)]">
          <Volume2 className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium">{t("volume")}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(prefs.volume * 100)}
          onChange={(e) => setPrefs({ volume: Number(e.target.value) / 100 })}
          disabled={!prefs.soundEnabled}
          className="flex-1 accent-[var(--theme-accent)] disabled:opacity-40"
        />
        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
          {Math.round(prefs.volume * 100)}
        </span>
        <button
          type="button"
          onClick={() => playSound("notification")}
          disabled={!prefs.soundEnabled}
          aria-label={t("testSound")}
          className="press-glow grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[var(--theme-accent)] disabled:opacity-40"
        >
          <Play className="h-4 w-4" />
        </button>
      </div>

      {/* Haptics toggle */}
      <label className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[var(--theme-accent)]">
          <Vibrate className="h-4 w-4" />
        </span>
        <span className="flex-1 text-sm font-medium">{t("hapticsEnabled")}</span>
        <input
          type="checkbox"
          checked={prefs.hapticsEnabled}
          onChange={(e) => {
            setPrefs({ hapticsEnabled: e.target.checked });
            if (e.target.checked) vibrate("medium");
          }}
          className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-white/10 transition-all checked:bg-[var(--theme-accent)] relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
        />
      </label>
    </div>
  );
}
