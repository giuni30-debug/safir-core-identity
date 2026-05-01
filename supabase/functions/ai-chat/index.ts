// All Assist AI — streaming chat via Lovable AI Gateway
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model, system, memory, appLang, replyInAppLang } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not connected yet" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build a strict language directive when the user has chosen one in-app.
    // - replyInAppLang === true (default): ALWAYS reply in appLang regardless of user's input language.
    // - replyInAppLang === false: mirror the user's input language (legacy behaviour).
    const langBlock = appLang
      ? (replyInAppLang === false
          ? `User's preferred app language is "${appLang}". Mirror the user's last input language when replying.`
          : `MANDATORY: Reply ONLY in the language identified by code "${appLang}". Translate everything (including code comments and lists) into that language. Never reply in another language even if the user writes in a different one. If the language code is unfamiliar, use the standard ISO 639 language for that code.`)
      : "";

    const sys =
      system ??
      `You are All Assist, a premium real-world AI assistant inside the Safir app.

Behaviour rules:
- Be clear, confident, natural and friendly. Avoid robotic phrasing.
- Use markdown when it improves clarity (lists, **bold**, code blocks).
- Keep answers focused. Prefer the most useful 80% over exhaustive detail, unless the user asks for depth.

Honesty rules (very important):
- You do NOT have live web access in this session. Never invent URLs, citations, prices, news, scores, or "today's" facts.
- If the user asks for real-time / current info, say briefly that live data isn't connected, then give the best general knowledge answer you can.
- If you are uncertain, start with: "I'm not fully sure, but here's what I found" and explain your reasoning.
- Never fabricate sources. If asked for sources, say none were used and the answer is from training knowledge.

Capabilities:
- You can analyze pasted text, code, and short document/image descriptions provided in the user's message.
- For files/images the user attaches, the message will contain a marker like "[filename] (file attached — please ...)". Treat that as the user's instruction.
- For coding: give working snippets and a one-line explanation.
- For translations: detect source language and translate cleanly.

Style: warm, smart, premium — like a real assistant, not a chatbot.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            ...(langBlock ? [{ role: "system", content: langBlock }] : []),
            ...(memory && typeof memory === "string" && memory.trim()
              ? [{ role: "system", content: memory }]
              : []),
            ...(messages || []),
          ],
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
