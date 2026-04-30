-- Add assistant preferences to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS elevenlabs_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS assistant_voice_id TEXT NOT NULL DEFAULT 'EXAVITQu4vr4xnSDxMaL',
  ADD COLUMN IF NOT EXISTS assistant_personality TEXT NOT NULL DEFAULT 'calm',
  ADD COLUMN IF NOT EXISTS assistant_auto_mode BOOLEAN NOT NULL DEFAULT false;

-- Mark ai_conversations that came from voice mode
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS is_voice BOOLEAN NOT NULL DEFAULT false;