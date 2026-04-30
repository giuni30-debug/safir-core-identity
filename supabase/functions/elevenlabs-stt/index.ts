// Edge function: ElevenLabs Speech-to-Text (Scribe v2)
// Accepts multipart/form-data with field "file" (audio blob) and optional "language_code".
// Returns JSON { text }.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inForm = await req.formData();
    const file = inForm.get("file");
    const language = (inForm.get("language_code") as string) || "";
    if (!file || !(file instanceof File || file instanceof Blob)) {
      return new Response(JSON.stringify({ error: "Missing audio file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiForm = new FormData();
    apiForm.append("file", file, "audio.webm");
    apiForm.append("model_id", "scribe_v2");
    if (language) apiForm.append("language_code", language);

    const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: apiForm,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[elevenlabs-stt] error", resp.status, errText);
      return new Response(JSON.stringify({ error: "STT failed", status: resp.status }), {
        status: resp.status === 401 ? 500 : resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    return new Response(JSON.stringify({ text: data.text || "", language: data.language_code }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[elevenlabs-stt] exception", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
