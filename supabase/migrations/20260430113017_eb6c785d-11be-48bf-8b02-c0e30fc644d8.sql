-- =========================================================
-- 1. user_presence
-- =========================================================
CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY,
  is_online boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presence_select_all_authed"
  ON public.user_presence FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "presence_insert_own"
  ON public.user_presence FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "presence_update_own"
  ON public.user_presence FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_presence_updated_at
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 2. typing_indicators
-- =========================================================
CREATE TABLE public.typing_indicators (
  user_id uuid NOT NULL,
  peer_id uuid NOT NULL,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, peer_id)
);

ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "typing_select_participants"
  ON public.typing_indicators FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = peer_id);

CREATE POLICY "typing_insert_own"
  ON public.typing_indicators FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "typing_update_own"
  ON public.typing_indicators FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "typing_delete_own"
  ON public.typing_indicators FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_typing_updated_at
  BEFORE UPDATE ON public.typing_indicators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 3. messages: add delivered_at + read_at
-- =========================================================
ALTER TABLE public.messages
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN read_at timestamptz;

-- Allow receivers to update delivery/read status on their incoming messages
CREATE POLICY "messages_receiver_can_update_status"
  ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_user_id)
  WITH CHECK (auth.uid() = receiver_user_id);

-- =========================================================
-- 4. message_reactions
-- =========================================================
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_message_reactions_message_id ON public.message_reactions(message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- A reaction is visible if the user is a participant of the underlying message
CREATE POLICY "reactions_select_participants"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reactions.message_id
        AND (auth.uid() = m.sender_user_id OR auth.uid() = m.receiver_user_id)
    )
  );

CREATE POLICY "reactions_insert_own_on_visible"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reactions.message_id
        AND (auth.uid() = m.sender_user_id OR auth.uid() = m.receiver_user_id)
    )
  );

CREATE POLICY "reactions_delete_own"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 5. Enable Realtime
-- =========================================================
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;
ALTER TABLE public.typing_indicators REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
-- public.messages is likely already in the publication; add only if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
END$$;