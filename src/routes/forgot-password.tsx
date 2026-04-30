import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/contexts/AppContext";
import { Field } from "./login";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
  head: () => ({
    meta: [
      { title: "Reset password — Safir Private Life" },
      { name: "description", content: "Reset your Safir Private Life password." },
    ],
  }),
});

function ForgotPage() {
  const { t } = useApp();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check your inbox for the reset link.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-md p-8 sm:p-10 animate-[scale-in_0.4s_ease-out]">
        <h1 className="text-2xl font-semibold tracking-tight">{t("forgot")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll send you a secure link to reset your password.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label={t("email")} type="email" value={email} onChange={setEmail} required />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            {busy ? "…" : t("resetEmail")}
          </button>
        </form>

        <Link to="/login" className="mt-6 block text-center text-sm text-muted-foreground hover:text-primary">
          ← {t("backToLogin")}
        </Link>
      </div>
    </div>
  );
}
