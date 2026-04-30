import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchConversationToken } from "./elevenlabs.server";

const TokenInput = z.object({
  agentId: z.string().min(8).max(128).regex(/^[a-zA-Z0-9_\-]+$/, "Invalid agent id"),
});

/**
 * Returns a short-lived WebRTC token for the given ElevenLabs agent.
 * Public (no auth middleware): the user-supplied agentId is the only
 * routing input, and the token is single-use & expires automatically.
 */
export const getElevenLabsAgentToken = createServerFn({ method: "POST" })
  .inputValidator((input) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const token = await fetchConversationToken(data.agentId);
      return { token, error: null as string | null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("getElevenLabsAgentToken failed", msg);
      return { token: null as string | null, error: msg };
    }
  });
