-- Extend messages table for voice support
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

ALTER TABLE public.messages
  ALTER COLUMN message_text DROP NOT NULL;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_type_check CHECK (message_type IN ('text', 'voice'));

-- Create storage bucket for voice messages (public so audio URLs play directly)
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-messages', 'voice-messages', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users upload/delete in their own folder, anyone authenticated reads
CREATE POLICY "Voice messages are readable by authenticated users"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'voice-messages');

CREATE POLICY "Users can upload their own voice messages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-messages'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own voice messages"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-messages'
  AND auth.uid()::text = (storage.foldername(name))[1]
);