import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks the current user's online/last-seen state in user_presence.
 * Heartbeats every 25s while the tab is visible. Marks offline on
 * pagehide/visibilitychange-hidden.
 */
export function usePresenceHeartbeat(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    let alive = true;

    const upsert = async (online: boolean) => {
      if (!alive) return;
      await supabase.from("user_presence").upsert(
        { user_id: userId, is_online: online, last_seen: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    };

    void upsert(true);
    const iv = window.setInterval(() => void upsert(true), 25_000);

    const onVis = () => {
      if (document.visibilityState === "hidden") void upsert(false);
      else void upsert(true);
    };
    const onHide = () => void upsert(false);

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);

    return () => {
      alive = false;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      void supabase.from("user_presence").upsert(
        { user_id: userId, is_online: false, last_seen: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    };
  }, [userId]);
}

export type PresenceState = {
  isOnline: boolean;
  lastSeen: Date | null;
};

/**
 * Subscribes to a peer's presence row in real time.
 * Considers user "online" only if is_online=true AND last_seen within 60s.
 */
export function usePeerPresence(peerId: string | null): PresenceState {
  const [state, setState] = useState<PresenceState>({ isOnline: false, lastSeen: null });

  useEffect(() => {
    if (!peerId) return;
    let alive = true;

    const apply = (row: { is_online: boolean; last_seen: string } | null) => {
      if (!alive) return;
      if (!row) {
        setState({ isOnline: false, lastSeen: null });
        return;
      }
      const last = new Date(row.last_seen);
      const fresh = Date.now() - last.getTime() < 60_000;
      setState({ isOnline: row.is_online && fresh, lastSeen: last });
    };

    (async () => {
      const { data } = await supabase
        .from("user_presence")
        .select("is_online, last_seen")
        .eq("user_id", peerId)
        .maybeSingle();
      apply(data ?? null);
    })();

    const ch = supabase
      .channel(`presence:${peerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence", filter: `user_id=eq.${peerId}` },
        (payload) => {
          const row = (payload.new as any) ?? null;
          apply(row);
        }
      )
      .subscribe();

    // Refresh staleness every 15s so "online" flips to "last seen" without DB events
    const tick = window.setInterval(() => {
      setState((s) => {
        if (!s.lastSeen) return s;
        const fresh = Date.now() - s.lastSeen.getTime() < 60_000;
        return s.isOnline === fresh ? s : { ...s, isOnline: fresh && s.isOnline };
      });
    }, 15_000);

    return () => {
      alive = false;
      window.clearInterval(tick);
      supabase.removeChannel(ch);
    };
  }, [peerId]);

  return state;
}

export function formatLastSeen(date: Date | null, t: (k: any) => string): string {
  if (!date) return t("offline");
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return t("lastSeenJustNow");
  if (mins < 60) return `${t("lastSeenPrefix")} ${mins} ${t("minutesAgo")}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${t("lastSeenPrefix")} ${hours} ${t("hoursAgo")}`;
  const days = Math.floor(hours / 24);
  return `${t("lastSeenPrefix")} ${days} ${t("daysAgo")}`;
}
