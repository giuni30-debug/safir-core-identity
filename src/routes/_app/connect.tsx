import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/connect")({
  component: ConnectPage,
  head: () => ({
    meta: [
      { title: "Connect — Safir Private Life" },
      { name: "description", content: "Find people by their @username and connect." },
    ],
  }),
});

type Result = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  alreadyConnected: boolean;
};

function ConnectPage() {
  const { t, user } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);

  const search = async (val: string) => {
    setQ(val);
    const term = val.replace(/^@/, "").trim();
    if (term.length < 2 || !user) {
      setResults([]);
      return;
    }
    setBusy(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .ilike("username", `%${term}%`)
      .neq("id", user.id)
      .limit(15);

    const ids = (profiles ?? []).map((p) => p.id);
    let connectedSet = new Set<string>();
    if (ids.length) {
      const { data: conns } = await supabase
        .from("connections")
        .select("contact_id")
        .eq("owner_id", user.id)
        .in("contact_id", ids);
      connectedSet = new Set((conns ?? []).map((c) => c.contact_id));
    }
    setResults(
      (profiles ?? []).map((p) => ({ ...p, alreadyConnected: connectedSet.has(p.id) }))
    );
    setBusy(false);
  };

  const connect = async (contactId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("connections")
      .insert({ owner_id: user.id, contact_id: contactId });
    if (error) return toast.error(error.message);
    toast.success(t("connected"));
    setResults((r) =>
      r.map((p) => (p.id === contactId ? { ...p, alreadyConnected: true } : p))
    );
  };

  return (
    <div className="animate-[fade-in_0.4s_ease-out]">
      <header className="flex items-center gap-3">
        <Link
          to="/home"
          aria-label="Back"
          className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t("connect")}</h1>
      </header>

      <input
        autoFocus
        value={q}
        onChange={(e) => search(e.target.value)}
        placeholder={t("searchUsername")}
        className="mt-6 w-full rounded-2xl border border-input bg-card/50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
      />

      <div className="mt-4 space-y-3">
        {busy && <p className="text-center text-xs text-muted-foreground">…</p>}
        {!busy && q && results.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">{t("noMatches")}</p>
        )}
        {results.map((p) => (
          <div
            key={p.id}
            className="glass-card flex items-center gap-3 p-3 animate-[scale-in_0.2s_ease-out]"
          >
            <Avatar url={p.avatar_url} name={p.display_name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.display_name}</p>
              <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
            </div>
            {p.alreadyConnected ? (
              <button
                onClick={() => navigate({ to: "/chat/$id", params: { id: p.id } })}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                {t("connected")}
              </button>
            ) : (
              <button
                onClick={() => connect(p.id)}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
              >
                {t("connectBtn")}
              </button>
            )}
          </div>
        ))}

        {results.some((r) => r.alreadyConnected) && (
          <Link
            to="/contacts"
            className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/30 py-3 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
          >
            <Users className="h-4 w-4" />
            {t("contacts")}
          </Link>
        )}
      </div>
    </div>
  );
}
