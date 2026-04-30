import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/contexts/AppContext";

export type AiMemory = {
  id: string;
  category: string;
  content: string;
  created_at: string;
};

export type AiConversation = {
  id: string;
  title: string;
  updated_at: string;
};

export type AiStoredMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  created_at: string;
};

/** Heuristic: detect if a USER message looks like something worth remembering. */
export function detectMemoryCandidates(text: string): { category: string; content: string }[] {
  const out: { category: string; content: string }[] = [];
  const t = text.trim();
  if (t.length < 4 || t.length > 400) return out;

  // name: "ma numesc / numele meu / my name is / I'm / ich heiße / benim adım"
  const nameRe =
    /(?:my name is|i am called|i'm|ich hei(?:ß|ss)e|mein name ist|m[ăa] numesc|numele meu (?:e|este)|benim ad[ıi]m|ad[ıi]m)\s+([\p{L}\p{M}'\- ]{2,40})/iu;
  const nm = t.match(nameRe);
  if (nm) out.push({ category: "name", content: `User's name is ${nm[1].trim()}` });

  // language preference
  const langRe = /(?:reply|answer|talk|vorbe[şs]te|raspunde|răspunde|antworte|cevap ver)[^.]{0,40}\b(in|în|auf|de|en)\s+(english|romanian|romana|română|german|deutsch|turkish|t[üu]rk[çc]e)/i;
  const lm = t.match(langRe);
  if (lm) out.push({ category: "language", content: `Preferred reply language: ${lm[2]}` });

  // project mention
  const projRe = /\b(my (?:project|app|startup|business)|proiectul meu|aplicatia mea|aplicația mea|projem|mein projekt)\s+(?:is\s+|este\s+|este numit\s+|se nume[şs]te\s+|hei(?:ß|ss)t\s+|named\s+|called\s+)?["']?([A-Za-z0-9 _\-]{2,40})["']?/i;
  const pm = t.match(projRe);
  if (pm) out.push({ category: "project", content: `User project: ${pm[2].trim()}` });

  // explicit "remember that ..." instruction
  const remRe = /\b(?:remember(?: that)?|tine minte|ține minte|merk dir|hat[ıi]rla)\b[:,]?\s+(.{4,200})/i;
  const rm = t.match(remRe);
  if (rm) out.push({ category: "note", content: rm[1].trim() });

  return out;
}

export function useAiMemory() {
  const { user, profile, refreshProfile } = useApp();
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    // Sync enabled from profile if available
    const profileAny = profile as unknown as { ai_memory_enabled?: boolean } | null;
    if (profileAny && typeof profileAny.ai_memory_enabled === "boolean") {
      setEnabled(profileAny.ai_memory_enabled);
    }
  }, [profile]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_memories")
      .select("id, category, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error && data) setMemories(data as AiMemory[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setMemoryEnabled = useCallback(
    async (next: boolean) => {
      setEnabled(next);
      if (!userId) return;
      await supabase.from("profiles").update({ ai_memory_enabled: next } as never).eq("id", userId);
      await refreshProfile();
    },
    [userId, refreshProfile],
  );

  const addMemory = useCallback(
    async (category: string, content: string): Promise<AiMemory | null> => {
      if (!userId || !enabled) return null;
      // dedupe by content
      if (memories.some((m) => m.content.toLowerCase() === content.toLowerCase())) return null;
      const { data, error } = await supabase
        .from("ai_memories")
        .insert({ user_id: userId, category, content })
        .select("id, category, content, created_at")
        .single();
      if (error || !data) return null;
      const row = data as AiMemory;
      setMemories((p) => [row, ...p]);
      return row;
    },
    [userId, enabled, memories],
  );

  const deleteMemory = useCallback(
    async (id: string) => {
      if (!userId) return;
      await supabase.from("ai_memories").delete().eq("id", id).eq("user_id", userId);
      setMemories((p) => p.filter((m) => m.id !== id));
    },
    [userId],
  );

  const clearAll = useCallback(async () => {
    if (!userId) return;
    await supabase.from("ai_memories").delete().eq("user_id", userId);
    setMemories([]);
  }, [userId]);

  /** Build a compact system prompt block from memories, for the AI. */
  const memoryPromptBlock = useCallback((): string => {
    if (!enabled || memories.length === 0) return "";
    const top = memories.slice(0, 25).map((m) => `- [${m.category}] ${m.content}`);
    return `Known facts about the user (use naturally, do NOT recite them):\n${top.join("\n")}`;
  }, [enabled, memories]);

  return {
    enabled,
    setMemoryEnabled,
    memories,
    loading,
    refresh,
    addMemory,
    deleteMemory,
    clearAll,
    memoryPromptBlock,
  };
}

/* ---------- Conversation persistence ---------- */

export async function createConversation(userId: string, title = "New chat"): Promise<string | null> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, title })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id;
}

export async function renameConversation(userId: string, id: string, title: string) {
  await supabase
    .from("ai_conversations")
    .update({ title })
    .eq("id", id)
    .eq("user_id", userId);
}

export async function appendMessage(
  userId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  imageUrl?: string,
) {
  await supabase.from("ai_messages").insert({
    user_id: userId,
    conversation_id: conversationId,
    role,
    content,
    image_url: imageUrl ?? null,
  });
  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);
}

export async function listConversations(userId: string): Promise<AiConversation[]> {
  const { data } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(40);
  return (data as AiConversation[]) ?? [];
}

export async function loadMessages(userId: string, conversationId: string): Promise<AiStoredMessage[]> {
  const { data } = await supabase
    .from("ai_messages")
    .select("id, conversation_id, role, content, image_url, created_at")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data as AiStoredMessage[]) ?? [];
}

export async function deleteConversation(userId: string, id: string) {
  await supabase.from("ai_conversations").delete().eq("id", id).eq("user_id", userId);
}
