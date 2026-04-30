import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

/**
 * Subscribes to message_reactions for a given conversation thread.
 * messageIds is the list of message ids currently rendered.
 */
export function useReactions(myId: string | null, peerId: string | null) {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  // Initial load: all reactions on messages between me and peer
  useEffect(() => {
    if (!myId || !peerId) return;
    let alive = true;

    (async () => {
      // Pull message ids in this thread first
      const { data: msgs } = await supabase
        .from("messages")
        .select("id")
        .or(
          `and(sender_user_id.eq.${myId},receiver_user_id.eq.${peerId}),and(sender_user_id.eq.${peerId},receiver_user_id.eq.${myId})`
        );
      const ids = (msgs ?? []).map((m: any) => m.id);
      if (ids.length === 0) {
        if (alive) setReactions([]);
        return;
      }
      const { data } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", ids);
      if (alive) setReactions((data as Reaction[]) ?? []);
    })();

    const ch = supabase
      .channel(`reactions:${[myId, peerId].sort().join(":")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions" },
        (payload) => {
          const r = payload.new as Reaction;
          setReactions((prev) =>
            prev.some((x) => x.id === r.id) ? prev : [...prev, r]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions" },
        (payload) => {
          const r = payload.old as Reaction;
          setReactions((prev) => prev.filter((x) => x.id !== r.id));
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [myId, peerId]);

  const byMessage = useMemo(() => {
    const map = new Map<string, Reaction[]>();
    for (const r of reactions) {
      const arr = map.get(r.message_id) ?? [];
      arr.push(r);
      map.set(r.message_id, arr);
    }
    return map;
  }, [reactions]);

  const toggle = useCallback(
    async (messageId: string, emoji: string) => {
      if (!myId) return;
      const existing = reactions.find(
        (r) => r.message_id === messageId && r.user_id === myId && r.emoji === emoji
      );
      if (existing) {
        // Optimistic remove
        setReactions((prev) => prev.filter((r) => r.id !== existing.id));
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("id", existing.id);
        if (error) {
          // Roll back
          setReactions((prev) => [...prev, existing]);
        }
      } else {
        const tempId = `temp-${crypto.randomUUID()}`;
        const optimistic: Reaction = {
          id: tempId,
          message_id: messageId,
          user_id: myId,
          emoji,
          created_at: new Date().toISOString(),
        };
        setReactions((prev) => [...prev, optimistic]);
        const { data, error } = await supabase
          .from("message_reactions")
          .insert({ message_id: messageId, user_id: myId, emoji })
          .select()
          .single();
        if (error) {
          setReactions((prev) => prev.filter((r) => r.id !== tempId));
        } else if (data) {
          setReactions((prev) =>
            prev.map((r) => (r.id === tempId ? (data as Reaction) : r))
          );
        }
      }
    },
    [myId, reactions]
  );

  return { byMessage, toggle };
}
