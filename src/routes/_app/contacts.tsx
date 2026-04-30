import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/_app/contacts")({
  component: ContactsPage,
  head: () => ({
    meta: [
      { title: "Contacts — Safir Private Life" },
      { name: "description", content: "Your connected contacts." },
    ],
  }),
});

type Contact = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

function ContactsPage() {
  const { t, user } = useApp();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conns } = await supabase
        .from("connections")
        .select("contact_id")
        .eq("owner_id", user.id);
      const ids = (conns ?? []).map((c) => c.contact_id);
      if (!ids.length) { setContacts([]); setLoading(false); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);
      setContacts(profs ?? []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="animate-[fade-in_0.4s_ease-out]">
      <header className="flex items-center gap-3">
        <Link to="/home" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t("contacts")}</h1>
      </header>

      <div className="mt-6 space-y-3">
        {loading && <p className="text-center text-xs text-muted-foreground">…</p>}
        {!loading && contacts.length === 0 && (
          <div className="glass-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
            <Link to="/connect" className="mt-3 inline-block text-sm font-semibold text-primary">
              {t("connect")} →
            </Link>
          </div>
        )}
        {contacts.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate({ to: "/chat/$id", params: { id: c.id } })}
            className="glass-card glass-card-hover flex w-full items-center gap-3 p-3 text-left"
          >
            <Avatar url={c.avatar_url} name={c.display_name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{c.display_name}</p>
              <p className="truncate text-xs text-muted-foreground">@{c.username}</p>
            </div>
            <span className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("connected")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
