-- 1. Make both buckets private (no anonymous public access, no public listing)
UPDATE storage.buckets SET public = false WHERE id IN ('voice-messages', 'chat-media');

-- 2. Helper: returns true iff the current user participates in a message
--    whose audio_url or media_url references the given (bucket, object) pair.
CREATE OR REPLACE FUNCTION public.user_can_access_chat_object(
  _bucket text,
  _name   text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE (auth.uid() = m.sender_user_id OR auth.uid() = m.receiver_user_id)
      AND (
        (_bucket = 'voice-messages' AND m.audio_url LIKE '%/voice-messages/' || _name)
        OR
        (_bucket = 'chat-media'     AND m.media_url LIKE '%/chat-media/'     || _name)
      )
  );
$$;

-- 3. Drop any prior policies we may have installed on these buckets (idempotent)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN (
        'chat_media_select_participants',
        'chat_media_insert_own_folder',
        'chat_media_update_own_folder',
        'chat_media_delete_own_folder',
        'voice_msg_select_participants',
        'voice_msg_insert_own_folder',
        'voice_msg_update_own_folder',
        'voice_msg_delete_own_folder'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 4. chat-media policies
-- SELECT: sender (folder owner) OR a participant in a message that references this object
CREATE POLICY "chat_media_select_participants"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.user_can_access_chat_object('chat-media', name)
    )
  );

-- INSERT: only into your own user-id folder
CREATE POLICY "chat_media_insert_own_folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- UPDATE: only your own files (e.g. metadata changes)
CREATE POLICY "chat_media_update_own_folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'chat-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- DELETE: only your own files
CREATE POLICY "chat_media_delete_own_folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 5. voice-messages policies (mirror of chat-media)
CREATE POLICY "voice_msg_select_participants"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.user_can_access_chat_object('voice-messages', name)
    )
  );

CREATE POLICY "voice_msg_insert_own_folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'voice-messages'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "voice_msg_update_own_folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'voice-messages'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "voice_msg_delete_own_folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );