import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, UserPlus, Search, X, Users } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

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

type SearchResult = Contact & { alreadyConnected: boolean };

function ContactsPage() {
  const { t, user } = useApp();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline "Add contact" sheet (was the /connect page)
  const [addOpen, setAddOpen] = useState(false);

  const loadContacts = async () => {
    if (!user) return;
    setLoading(true);
    const { data: conns } = await supabase
      .from("connections")
      .select("contact_id")
      .eq("owner_id", user.id);
    const ids = (conns ?? []).map((c) => c.contact_id);
    if (!ids.length) {
      setContacts([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids);
    setContacts(profs ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="animate-[fade-in_0.4s_ease-out] pb-24">
      <header className="flex items-center gap-3">
        <Link
          to="/home"
          aria-label="Back"
          className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-xl font-semibold">{t("contacts")}</h1>
        <button
          onClick={() => setAddOpen(true)}
          aria-label="Add contact"
          className="press-glow grid h-11 w-11 place-items-center rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 50%, #000))",
            color: "white",
            boxShadow: "0 0 18px color-mix(in oklab, var(--theme-accent) 55%, transparent)",
          }}
        >
          <UserPlus className="h-5 w-5" />
        </button>
      </header>

      <div className="mt-6 space-y-3">
        {loading && <p className="text-center text-xs text-muted-foreground">…</p>}

        {!loading && contacts.length === 0 && (
          <EmptyState
            icon={Users}
            title="No contacts yet"
            subtitle="Find people by their @username and start chatting securely."
            ctaLabel="Add contact"
            onCta={() => setAddOpen(true)}
          />
        )}

        {contacts.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate({ to: "/chat/$id", params: { id: c.id } })}
            className="press-glow glass-card glass-card-hover flex w-full items-center gap-3 p-3 text-left"
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

      {addOpen && (
        <AddContactSheet
          onClose={() => setAddOpen(false)}
          onConnected={() => {
            void loadContacts();
          }}
        />
      )}
    </div>
  );
}

function AddContactSheet({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected: () => void;
}) {
  const { t, user } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
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
      (profiles ?? []).map((p) => ({ ...p, alreadyConnected: connectedSet.has(p.id) })),
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
    setResults((r) => r.map((p) => (p.id === contactId ? { ...p, alreadyConnected: true } : p)));
    onConnected();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card w-full max-w-md p-5 animate-[scale-in_0.25s_ease-out]"
        style={{ borderRadius: "24px 24px 0 0" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add contact</h2>
          <button
            type="button"
            onClick={onClose}
            className="press-glow grid h-9 w-9 place-items-center rounded-full bg-card/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-input bg-card/50 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder={t("searchUsername")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
          {busy && <p className="text-center text-xs text-muted-foreground">…</p>}
          {!busy && q && results.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">{t("noMatches")}</p>
          )}
          {results.map((p) => (
            <div
              key={p.id}
              className="glass-card flex items-center gap-3 p-3 animate-[scale-in_0.2s_ease-out]"
            >
              <Avatar url={p.avatar_url} name={p.display_name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
              </div>
              {p.alreadyConnected ? (
                <button
                  onClick={() => {
                    onClose();
                    navigate({ to: "/chat/$id", params: { id: p.id } });
                  }}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
                >
                  Open chat
                </button>
              ) : (
                <button
                  onClick={() => connect(p.id)}
                  className="press-glow rounded-full px-4 py-1.5 text-xs font-semibold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 50%, #000))",
                    boxShadow: "0 0 14px color-mix(in oklab, var(--theme-accent) 50%, transparent)",
                  }}
                >
                  {t("connectBtn")}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
