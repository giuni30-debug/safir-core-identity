import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "Profile — Safir Private Life" },
      { name: "description", content: "Manage your @username, display name and avatar." },
    ],
  }),
});

function ProfilePage() {
  const { t, profile, refreshProfile, user } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name);
    setUsername(profile.username);
    setAvatar(profile.avatar_url ?? "");
  }, [profile]);

  const onSave = async () => {
    if (!user) return;
    if (!/^[a-zA-Z0-9_]{4,30}$/.test(username)) {
      return toast.error(t("usernameInvalid"));
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name,
        username: username.toLowerCase(),
        avatar_url: avatar || null,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      if (error.code === "23505") return toast.error(t("usernameTaken"));
      return toast.error(error.message);
    }
    await refreshProfile();
    toast.success(t("saved"));
  };

  return (
    <div className="animate-[fade-in_0.4s_ease-out]">
      <header className="flex items-center gap-3">
        <Link to="/settings" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t("profile")}</h1>
      </header>

      <div className="mt-8 flex flex-col items-center gap-4">
        <Avatar url={avatar || profile?.avatar_url} name={name || "U"} size={96} />
      </div>

      <div className="mt-8 space-y-4">
        <Field label={t("avatarUrl")} value={avatar} onChange={setAvatar} placeholder="https://…" />
        <Field label={t("displayName")} value={name} onChange={setName} />
        <Field label={`@${t("username")}`} value={username} onChange={setUsername} prefix="@" />
        <p className="text-xs text-muted-foreground">
          {t("usernameRules")}
        </p>

        <button
          onClick={onSave}
          disabled={busy}
          className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          {busy ? "…" : t("save")}
        </button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center rounded-2xl border border-input bg-card/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
        {prefix && <span className="pl-4 text-muted-foreground">{prefix}</span>}
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-4 py-3 text-sm outline-none"
        />
      </div>
    </label>
  );
}
