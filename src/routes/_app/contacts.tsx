import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, UserPlus, Search, X, Users, Image as ImageIcon, Mic, Video, Paperclip } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { usePeerPresence } from "@/hooks/usePresence";
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

type MessageType = "text" | "voice" | "image" | "video" | "file";

type LastMessage = {
  text: string;
  type: MessageType;
  at: string;
  fromMe: boolean;
};

type ContactRow = Contact & {
  last?: LastMessage;
};

type SearchResult = Contact & { alreadyConnected: boolean };

function ContactsPage() {
  const { t, user } = useApp();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
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

    // Fetch last message per peer (single query, then group client-side)
    const { data: msgs } = await supabase
      .from("messages")
      .select("sender_user_id, receiver_user_id, message_text, message_type, created_at")
      .or(`sender_user_id.in.(${ids.join(",")}),receiver_user_id.in.(${ids.join(",")})`)
      .order("created_at", { ascending: false })
      .limit(200);

    const lastByPeer = new Map<string, ContactRow["last"]>();
    (msgs ?? []).forEach((m) => {
      const peer = m.sender_user_id === user.id ? m.receiver_user_id : m.sender_user_id;
      if (!ids.includes(peer)) return;
      if (lastByPeer.has(peer)) return;
      lastByPeer.set(peer, {
        text: m.message_text ?? "",
        type: (m.message_type as ContactRow["last"]["type"]) ?? "text",
        at: m.created_at,
        fromMe: m.sender_user_id === user.id,
      });
    });

    const rows: ContactRow[] = (profs ?? []).map((p) => ({
      ...p,
      last: lastByPeer.get(p.id),
    }));
    // Sort: most recent message first, then alphabetical
    rows.sort((a, b) => {
      if (a.last && b.last) return b.last.at.localeCompare(a.last.at);
      if (a.last) return -1;
      if (b.last) return 1;
      return a.display_name.localeCompare(b.display_name);
    });

    setContacts(rows);
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

      <div className="mt-6 space-y-2.5">
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

        {contacts.map((c, i) => (
          <ContactRow key={c.id} contact={c} index={i} onOpen={() => navigate({ to: "/chat/$id", params: { id: c.id } })} />
        ))}
      </div>

      {addOpen && (
        <AddContactSheet
          onClose={() => setAddOpen(false)}
          onConnected={() => void loadContacts()}
        />
      )}
    </div>
  );
}

function ContactRow({
  contact,
  index,
  onOpen,
}: {
  contact: ContactRow;
  index: number;
  onOpen: () => void;
}) {
  const presence = usePeerPresence(contact.id);

  let preview: React.ReactNode = (
    <span className="text-muted-foreground/70 italic">Tap to start chatting</span>
  );
  if (contact.last) {
    const prefix = contact.last.fromMe ? "You: " : "";
    if (contact.last.type === "voice") {
      preview = (
        <span className="inline-flex items-center gap-1">
          <Mic className="h-3 w-3" /> {prefix}Voice message
        </span>
      );
    } else if (contact.last.type === "image") {
      preview = (
        <span className="inline-flex items-center gap-1">
          <ImageIcon className="h-3 w-3" /> {prefix}Photo
        </span>
      );
    } else if (contact.last.type === "video") {
      preview = (
        <span className="inline-flex items-center gap-1">
          <Video className="h-3 w-3" /> {prefix}Video
        </span>
      );
    } else if (contact.last.type === "file") {
      preview = (
        <span className="inline-flex items-center gap-1">
          <Paperclip className="h-3 w-3" /> {prefix}File
        </span>
      );
    } else {
      preview = (
        <span>
          {prefix}
          {contact.last.text}
        </span>
      );
    }
  }

  const time = contact.last
    ? new Date(contact.last.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <button
      onClick={onOpen}
      className="press-glow glass-card glass-card-hover flex w-full items-center gap-3 p-3 text-left"
      style={{ animation: `fade-in 0.3s ease-out ${index * 40}ms both` }}
    >
      <div className="relative shrink-0">
        <Avatar url={contact.avatar_url} name={contact.display_name} size={48} />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background"
          style={{
            background: presence.isOnline ? "#34d399" : "#6b7280",
            boxShadow: presence.isOnline ? "0 0 8px #34d399" : "none",
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{contact.display_name}</p>
          {time && <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span>}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{preview}</p>
      </div>
    </button>
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
