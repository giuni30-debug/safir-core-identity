import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/_app/chat/$id")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "Chat — Safir Private Life" },
      { name: "description", content: "Private conversation." },
    ],
  }),
});

type Message = {
  id: string;
  sender_user_id: string;
  receiver_user_id: string;
  message_text: string;
  created_at: string;
};

function ChatPage() {
  const { t, user } = useApp();
  const { id: contactId } = Route.useParams();
  const myId = user?.id ?? null;

  const [contact, setContact] = useState<{
    display_name: string; username: string; avatar_url: string | null;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load contact profile
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("id", contactId)
        .maybeSingle();
      setContact(data ?? null);
    })();
  }, [contactId]);

  // Load messages + subscribe realtime
  useEffect(() => {
    if (!myId || !contactId) return;
    let active = true;

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_user_id.eq.${myId},receiver_user_id.eq.${contactId}),and(sender_user_id.eq.${contactId},receiver_user_id.eq.${myId})`
        )
        .order("created_at", { ascending: true });
      if (active && data) setMessages(data as Message[]);
    })();

    const channel = supabase
      .channel(`chat:${[myId, contactId].sort().join(":")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const inThread =
            (m.sender_user_id === myId && m.receiver_user_id === contactId) ||
            (m.sender_user_id === contactId && m.receiver_user_id === myId);
          if (!inThread) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [myId, contactId]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !myId || sending) return;
    setSending(true);
    setText("");
    const { error } = await supabase
      .from("messages")
      .insert({ sender_user_id: myId, receiver_user_id: contactId, message_text: body });
    if (error) {
      console.error("send error", error);
      setText(body);
    }
    setSending(false);
  };

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const grouped = useMemo(() => messages, [messages]);

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col animate-[fade-in_0.4s_ease-out]">
      <header className="flex items-center gap-3">
        <Link
          to="/contacts"
          aria-label="Back"
          className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar url={contact?.avatar_url ?? null} name={contact?.display_name ?? "?"} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{contact?.display_name ?? "…"}</p>
          <p className="truncate text-xs text-muted-foreground">@{contact?.username ?? "…"}</p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="my-4 flex-1 space-y-2 overflow-y-auto pr-1"
        style={{ maxHeight: "calc(100vh - 14rem)" }}
      >
        {grouped.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground">No messages yet — say hello 👋</p>
          </div>
        ) : (
          grouped.map((m) => {
            const mine = m.sender_user_id === myId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow ${
                    mine
                      ? "bg-primary/90 text-primary-foreground rounded-br-sm"
                      : "bg-card/60 border border-border rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.message_text}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {fmtTime(m.created_at)}
                    {mine ? " · Delivered" : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={onSend} className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("typeMessage")}
          className="flex-1 rounded-2xl border border-input bg-card/30 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label={t("send")}
          className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
