
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Chat media is publicly readable" ON storage.objects;
CREATE POLICY "Chat media is publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Users can upload own chat media" ON storage.objects;
CREATE POLICY "Users can upload own chat media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own chat media" ON storage.objects;
CREATE POLICY "Users can update own chat media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own chat media" ON storage.objects;
CREATE POLICY "Users can delete own chat media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
