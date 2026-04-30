import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/contexts/AppContext";
import { Field } from "./login";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPage,
  head: () => ({
    meta: [
      { title: "Set new password — Safir Private Life" },
      { name: "description", content: "Choose a new password." },
    ],
  }),
});

function ResetPage() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // On recovery link, supabase auto-creates a session. Just wait for it.
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setReady(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated.");
    navigate({ to: "/home" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-md p-8 sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">Set new password</h1>
        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">Verifying reset link…</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label={t("password")} type="password" value={password} onChange={setPassword} required />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              {busy ? "…" : t("save")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
