
-- Calls table for tracking call sessions and history
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL,
  callee_id UUID NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'audio',
  status TEXT NOT NULL DEFAULT 'ringing',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  CONSTRAINT calls_status_check CHECK (status = ANY (ARRAY['ringing','accepted','declined','ended','missed','failed']))
);

CREATE INDEX idx_calls_callee ON public.calls(callee_id, started_at DESC);
CREATE INDEX idx_calls_caller ON public.calls(caller_id, started_at DESC);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view calls"
ON public.calls FOR SELECT TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Caller can create calls"
ON public.calls FOR INSERT TO authenticated
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Participants can update calls"
ON public.calls FOR UPDATE TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Signaling table (offers, answers, ICE candidates, hangups)
CREATE TABLE public.call_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  signal_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT call_signals_type_check CHECK (signal_type = ANY (ARRAY['offer','answer','ice','hangup','accept','decline']))
);

CREATE INDEX idx_call_signals_to ON public.call_signals(to_user_id, created_at);
CREATE INDEX idx_call_signals_call ON public.call_signals(call_id, created_at);

ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view signals"
ON public.call_signals FOR SELECT TO authenticated
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can send signals as themselves"
ON public.call_signals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = from_user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.call_signals REPLICA IDENTITY FULL;
