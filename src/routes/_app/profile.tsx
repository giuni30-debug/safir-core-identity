import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Upload } from "lucide-react";
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      return toast.error("Please select an image file");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error("Image must be under 5MB");
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      setAvatar(url);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);
      if (updErr) throw updErr;
      await refreshProfile();
      toast.success(t("saved"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative rounded-full transition active:scale-95 disabled:opacity-60"
          style={{ boxShadow: "var(--shadow-glow)" }}
          aria-label="Change avatar"
        >
          <Avatar url={avatar || profile?.avatar_url} name={name || "U"} size={96} />
          <span
            className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            <Camera className="h-4 w-4" />
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleAvatarFile(f);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleAvatarFile(f);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-2xl border border-border bg-card/40 px-4 py-2 text-xs font-medium transition hover:bg-card/60 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "…" : "Upload from device"}
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-2xl border border-border bg-card/40 px-4 py-2 text-xs font-medium transition hover:bg-card/60 disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
            Camera
          </button>
        </div>
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
