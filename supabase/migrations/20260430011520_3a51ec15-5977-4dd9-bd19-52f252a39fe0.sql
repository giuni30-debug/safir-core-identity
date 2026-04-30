CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_user_id UUID NOT NULL,
  receiver_user_id UUID NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_pair ON public.messages (sender_user_id, receiver_user_id, created_at);
CREATE INDEX idx_messages_receiver ON public.messages (receiver_user_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_user_id OR auth.uid() = receiver_user_id);

CREATE POLICY "Users can send messages as themselves"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_user_id);

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;