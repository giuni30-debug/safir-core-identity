import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, User, Palette, Languages, Bell, LogOut, Trash2, Download, CheckCircle2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { onInstallPromptChange, triggerInstall, isStandalone, isIOS } from "@/lib/pwa";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — Safir Private Life" },
      { name: "description", content: "Manage your Safir Private Life account." },
    ],
  }),
});

function SettingsPage() {
  const { t, signOut } = useApp();
  const navigate = useNavigate();

  const onLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const onDelete = async () => {
    if (!confirm(t("confirmDelete"))) return;
    // Delete profile (cascades). User row would require server-side admin.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").delete().eq("id", user.id);
    }
    await supabase.auth.signOut();
    toast.success("Account removed.");
    navigate({ to: "/login" });
  };

  return (
    <div className="animate-[fade-in_0.4s_ease-out]">
      <header className="flex items-center gap-3">
        <Link to="/home" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t("settings")}</h1>
      </header>

      <div className="mt-6 space-y-3">
        <Row to="/profile" icon={User} label={t("profile")} />
        <Row to="/appearance" icon={Palette} label={t("appearance")} />
        <Row to="/language" icon={Languages} label={t("language")} />
        <Row to="/notifications" icon={Bell} label={t("notifications")} />
      </div>

      <InstallRow />

      <div className="mt-8 space-y-3">
        <button
          onClick={onLogout}
          className="glass-card flex w-full items-center gap-3 p-4 text-left transition hover:border-primary"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">{t("logout")}</span>
        </button>
        <button
          onClick={onDelete}
          className="glass-card flex w-full items-center gap-3 p-4 text-left text-destructive transition hover:border-destructive"
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-sm font-medium">{t("deleteAccount")}</span>
        </button>
      </div>
    </div>
  );
}

function Row({
  to, icon: Icon, label,
}: {
  to: "/profile" | "/appearance" | "/language" | "/notifications";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link to={to} className="glass-card glass-card-hover flex items-center gap-3 p-4">
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
        toast.message(isIOS()
          ? "On iPhone: tap Share → Add to Home Screen."
          : "Open this site in your browser to install.");
      }
    } else {
      toast.message(isIOS()
        ? "On iPhone: tap Share → Add to Home Screen."
        : "Install option will appear when your browser is ready.");
    }
  };

  return (
    <button
      onClick={onInstall}
      className="mt-6 glass-card glass-card-hover flex w-full items-center gap-3 p-4 text-left"
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
      <span className="flex-1 text-sm font-medium">Install App</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
