import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useApp } from "@/contexts/AppContext";
import { GoogleIcon, AppleIcon } from "@/components/icons/BrandIcons";
import { Field, Divider, OAuthButton } from "./login";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Create account — Safir Private Life" },
      { name: "description", content: "Create your Safir Private Life account." },
    ],
  }),
});

function SignupPage() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/home`,
        data: { full_name: name },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    track("signup", { email });
    toast.success("Check your email to confirm your account.");
    navigate({ to: "/login" });
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
          <p className="mt-6 text-base text-muted-foreground">{t("createAccount")}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label={t("displayName")} type="text" value={name} onChange={setName} required />
          <Field label={t("email")} type="email" value={email} onChange={setEmail} required autoComplete="email" />
          <Field label={t("password")} type="password" value={password} onChange={setPassword} required autoComplete="new-password" />

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            {busy ? "…" : t("signUp")}
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
          {t("haveAccount")}{" "}
          <Link to="/login" className="font-semibold text-primary hover:opacity-80">
            {t("signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
