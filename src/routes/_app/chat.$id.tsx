import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

function ChatPage() {
  const { t } = useApp();
  const { id } = Route.useParams();
  const [contact, setContact] = useState<{
    display_name: string; username: string; avatar_url: string | null;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("id", id)
        .maybeSingle();
      setContact(data ?? null);
    })();
  }, [id]);

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col animate-[fade-in_0.4s_ease-out]">
      <header className="flex items-center gap-3">
        <Link to="/contacts" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar url={contact?.avatar_url ?? null} name={contact?.display_name ?? "?"} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{contact?.display_name ?? "…"}</p>
          <p className="truncate text-xs text-muted-foreground">@{contact?.username ?? "…"}</p>
        </div>
      </header>

      <div className="my-6 flex flex-1 items-center justify-center">
        <div className="glass-card max-w-xs p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Chat is coming soon — your messages will live here, end-to-end private.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          disabled
          placeholder={t("typeMessage")}
          className="flex-1 rounded-2xl border border-input bg-card/30 px-4 py-3 text-sm text-muted-foreground"
        />
        <button
          disabled
          aria-label={t("send")}
          className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/40 text-primary-foreground"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
