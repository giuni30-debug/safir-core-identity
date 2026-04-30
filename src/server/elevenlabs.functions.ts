import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchConversationToken } from "./elevenlabs.server";

// agentId is optional — when omitted we fall back to ELEVENLABS_AGENT_ID secret.
const TokenInput = z.object({
  agentId: z
    .string()
    .min(8)
    .max(128)
    .regex(/^[a-zA-Z0-9_\-]+$/, "Invalid agent id")
    .optional()
    .nullable(),
});

/**
 * Returns a short-lived WebRTC token for the given ElevenLabs agent.
 * If no agentId is supplied by the client, falls back to the
 * ELEVENLABS_AGENT_ID environment secret.
 */
export const getElevenLabsAgentToken = createServerFn({ method: "POST" })
  .inputValidator((input) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const agentId = data.agentId?.trim() || process.env.ELEVENLABS_AGENT_ID;
      if (!agentId) {
        return {
          token: null as string | null,
          error: "No Agent ID configured (set in Settings or ELEVENLABS_AGENT_ID secret).",
        };
      }
      const token = await fetchConversationToken(agentId);
      return { token, error: null as string | null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("getElevenLabsAgentToken failed", msg);
      return { token: null as string | null, error: msg };
    }
  });
