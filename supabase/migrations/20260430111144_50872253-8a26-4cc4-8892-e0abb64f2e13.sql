-- AI Memory toggle on profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_memory_enabled boolean NOT NULL DEFAULT true;

-- Long-term memories
CREATE TABLE IF NOT EXISTS public.ai_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_memories_user ON public.ai_memories(user_id, created_at DESC);
ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memories_select_own" ON public.ai_memories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "memories_insert_own" ON public.ai_memories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memories_update_own" ON public.ai_memories FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "memories_delete_own" ON public.ai_memories FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER ai_memories_set_updated_at
  BEFORE UPDATE ON public.ai_memories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON public.ai_conversations(user_id, updated_at DESC);
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_select_own" ON public.ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "conv_insert_own" ON public.ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conv_update_own" ON public.ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "conv_delete_own" ON public.ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER ai_conversations_set_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Messages
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON public.ai_messages(conversation_id, created_at);
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msg_select_own" ON public.ai_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "msg_insert_own" ON public.ai_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "msg_delete_own" ON public.ai_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);