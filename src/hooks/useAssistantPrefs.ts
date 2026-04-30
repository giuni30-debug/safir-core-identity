import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AssistantPersonality = "calm" | "friendly" | "professional";

export type AssistantPrefs = {
  agentId: string | null;
  voiceId: string;
  personality: AssistantPersonality;
  autoMode: boolean;
};

const DEFAULT: AssistantPrefs = {
  agentId: null,
  voiceId: "EXAVITQu4vr4xnSDxMaL",
  personality: "calm",
  autoMode: false,
};

export function useAssistantPrefs(userId: string | null | undefined) {
  const [prefs, setPrefs] = useState<AssistantPrefs>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) { setPrefs(DEFAULT); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("elevenlabs_agent_id, assistant_voice_id, assistant_personality, assistant_auto_mode")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      setPrefs({
        agentId: data.elevenlabs_agent_id ?? null,
        voiceId: data.assistant_voice_id ?? DEFAULT.voiceId,
        personality: (data.assistant_personality as AssistantPersonality) ?? "calm",
        autoMode: !!data.assistant_auto_mode,
      });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const update = useCallback(
    async (patch: Partial<AssistantPrefs>) => {
      if (!userId) return;
      const next = { ...prefs, ...patch };
      setPrefs(next);
      await supabase
        .from("profiles")
        .update({
          elevenlabs_agent_id: next.agentId,
          assistant_voice_id: next.voiceId,
          assistant_personality: next.personality,
          assistant_auto_mode: next.autoMode,
        })
        .eq("id", userId);
    },
    [userId, prefs],
  );

  return { prefs, loading, update, refresh };
}
