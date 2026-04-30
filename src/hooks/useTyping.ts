import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Manages "user is typing" indicator for a 1:1 conversation.
 * - notifyTyping(): call on each keystroke. Debounced upsert + auto-clear after 4s of silence.
 * - peerTyping: realtime boolean for the OTHER side.
 */
export function useTypingIndicator(myId: string | null, peerId: string | null) {
  const [peerTyping, setPeerTyping] = useState(false);
  const lastSentRef = useRef<number>(0);
  const clearTimerRef = useRef<number | null>(null);
  const peerTimerRef = useRef<number | null>(null);

  // Subscribe to peer's typing row (peer typing TO me)
  useEffect(() => {
    if (!myId || !peerId) return;
    let alive = true;

    const apply = (row: { is_typing: boolean; updated_at: string } | null) => {
      if (!alive) return;
      if (!row) {
        setPeerTyping(false);
        return;
      }
      const fresh = Date.now() - new Date(row.updated_at).getTime() < 6_000;
      const typing = !!row.is_typing && fresh;
      setPeerTyping(typing);
      if (typing) {
        if (peerTimerRef.current) window.clearTimeout(peerTimerRef.current);
        peerTimerRef.current = window.setTimeout(() => setPeerTyping(false), 5_000);
      }
    };

    (async () => {
      const { data } = await supabase
        .from("typing_indicators")
        .select("is_typing, updated_at")
        .eq("user_id", peerId)
        .eq("peer_id", myId)
        .maybeSingle();
      apply(data ?? null);
    })();

    const ch = supabase
      .channel(`typing:${peerId}->${myId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `user_id=eq.${peerId}`,
        },
        (payload) => {
          const row = (payload.new as any) ?? null;
          if (!row || row.peer_id !== myId) return;
          apply(row);
        }
      )
      .subscribe();

    return () => {
      alive = false;
      if (peerTimerRef.current) window.clearTimeout(peerTimerRef.current);
      supabase.removeChannel(ch);
    };
  }, [myId, peerId]);

  // Push my typing status (me typing TO peer)
  const sendTyping = useCallback(
    async (typing: boolean) => {
      if (!myId || !peerId) return;
      await supabase.from("typing_indicators").upsert(
        {
          user_id: myId,
          peer_id: peerId,
          is_typing: typing,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,peer_id" }
      );
    },
    [myId, peerId]
  );

  const notifyTyping = useCallback(() => {
    if (!myId || !peerId) return;
    const now = Date.now();
    // Throttle network to once per 2s while typing
    if (now - lastSentRef.current > 2_000) {
      lastSentRef.current = now;
      void sendTyping(true);
    }
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      lastSentRef.current = 0;
      void sendTyping(false);
    }, 4_000);
  }, [myId, peerId, sendTyping]);

  const stopTyping = useCallback(() => {
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    lastSentRef.current = 0;
    void sendTyping(false);
  }, [sendTyping]);

  // Cleanup on unmount: clear my typing
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      if (myId && peerId) {
        void supabase.from("typing_indicators").upsert(
          {
            user_id: myId,
            peer_id: peerId,
            is_typing: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,peer_id" }
        );
      }
    };
  }, [myId, peerId]);

  return { peerTyping, notifyTyping, stopTyping };
}
