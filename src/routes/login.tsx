import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useApp } from "@/contexts/AppContext";
import { GoogleIcon, AppleIcon } from "@/components/icons/BrandIcons";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in — Safir Private Life" },
      { name: "description", content: "Sign in to your Safir Private Life account." },
    ],
  }),
});

function LoginPage() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/home" });
  };

  const oauth = async (provider: "google" | "apple") => {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) return toast.error(result.error.message ?? "Sign-in failed");
    if (result.redirected) return;
    navigate({ to: "/home" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-md p-8 sm:p-10 animate-[scale-in_0.4s_ease-out]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Safir</h1>
          <p className="mt-1 text-sm neon-text font-medium tracking-widest uppercase">
            Private Life
          </p>
          <p className="mt-6 text-base text-muted-foreground">{t("welcome")}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label={t("email")}
            type="email"
            value={email}
            onChange={setEmail}
            required
            autoComplete="email"
          />
          <Field
            label={t("password")}
            type="password"
            value={password}
            onChange={setPassword}
            required
            autoComplete="current-password"
          />

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary transition"
            >
              {t("forgot")}
            </Link>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            {busy ? "…" : t("signIn")}
          </button>
        </form>

        <Divider label={t("or")} />

        <div className="space-y-3">
          <OAuthButton onClick={() => oauth("google")} icon={<GoogleIcon />}>
            {t("continueGoogle")}
          </OAuthButton>
          <OAuthButton onClick={() => oauth("apple")} icon={<AppleIcon />}>
            {t("continueApple")}
          </OAuthButton>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link to="/signup" className="font-semibold text-primary hover:opacity-80">
            {t("signUp")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label, type, value, onChange, required, autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-input bg-card/50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function OAuthButton({
  onClick, icon, children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card/40 py-3 text-sm font-medium transition hover:border-primary hover:bg-card/60"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export { Field, Divider, OAuthButton };
