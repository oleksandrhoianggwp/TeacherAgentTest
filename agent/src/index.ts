import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { getEnv } from "./env.js";
import { createChatCompletion, type ChatMessage } from "./openai.js";
import {
  createSessionToken,
  createSessionTokenWithPersonaAndAvatar,
  listContexts,
  listVoices,
  startSession,
  stopSession
} from "./liveavatar.js";
import { RealtimeSession } from "./realtime.js";

const env = getEnv();

const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });
await app.register(cors, { origin: true });

function requireInternalSecret(req: any): boolean {
  const header = String(req.headers["x-internal-secret"] ?? "");
  return header === env.INTERNAL_API_SECRET;
}

app.addHook("preHandler", async (req, reply) => {
  if (!String(req.url).startsWith("/internal/")) return;
  if (requireInternalSecret(req)) return;
  return reply.code(401).send({ error: "unauthorized" });
});

app.get("/health", async () => ({ ok: true }));

app.post("/internal/openai/chat", async (req, reply) => {
  const parsed = z
    .object({
      messages: z.array(
        z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string().min(1)
        })
      )
    })
    .safeParse(req.body ?? {});
  if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });

  const text = await createChatCompletion(env, parsed.data.messages as ChatMessage[]);
  return reply.send({ text });
});

app.post("/internal/liveavatar/start", async (_req, reply) => {
  const parsed = z
    .object({
      avatarId: z.string().min(1).optional(),
      voiceId: z.string().min(1).optional(),
      contextId: z.string().min(1).optional(),
      language: z.string().min(2).optional()
    })
    .safeParse((_req as any).body ?? {});

  const avatarId = parsed.success ? parsed.data.avatarId : undefined;
  const voiceId = parsed.success ? parsed.data.voiceId : undefined;
  const contextId = parsed.success ? parsed.data.contextId : undefined;
  const language = parsed.success ? parsed.data.language : undefined;

  const { sessionId, sessionToken } =
    voiceId && contextId
      ? await createSessionTokenWithPersonaAndAvatar(env, avatarId ?? env.LIVEAVATAR_AVATAR_ID, {
          voiceId,
          contextId,
          language
        })
      : await createSessionToken(env, { avatarId });
  const { livekitUrl, livekitToken } = await startSession(sessionToken);
  return reply.send({ sessionId, sessionToken, livekitUrl, livekitToken });
});

app.post("/internal/liveavatar/stop", async (req, reply) => {
  const parsed = z.object({ sessionToken: z.string().min(1) }).safeParse(req.body ?? {});
  if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });
  await stopSession(parsed.data.sessionToken);
  return reply.send({ ok: true });
});

app.get("/internal/liveavatar/voices", async (_req, reply) => {
  const voices = await listVoices(env);
  return reply.send(voices);
});

app.get("/internal/liveavatar/contexts", async (_req, reply) => {
  const contexts = await listContexts(env);
  return reply.send(contexts);
});

// Store active Realtime sessions
const realtimeSessions = new Map<string, RealtimeSession>();

app.post("/internal/realtime/connect", async (req, reply) => {
  const parsed = z
    .object({
      sessionId: z.string().min(1),
      livekitUrl: z.string().min(1),
      livekitToken: z.string().min(1),
      systemPrompt: z.string().min(1)
    })
    .safeParse(req.body ?? {});

  if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });

  const { sessionId, livekitUrl, livekitToken, systemPrompt } = parsed.data;

  try {
    const session = new RealtimeSession(env, systemPrompt);
    await session.connect(livekitUrl, livekitToken);
    realtimeSessions.set(sessionId, session);

    return reply.send({ ok: true, sessionId });
  } catch (err: any) {
    app.log.error(err, "Failed to connect Realtime session");
    return reply.code(500).send({ error: err.message || "failed_to_connect" });
  }
});

app.post("/internal/realtime/disconnect", async (req, reply) => {
  const parsed = z.object({ sessionId: z.string().min(1) }).safeParse(req.body ?? {});
  if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });

  const session = realtimeSessions.get(parsed.data.sessionId);
  if (!session) return reply.code(404).send({ error: "session_not_found" });

  try {
    await session.disconnect();
    realtimeSessions.delete(parsed.data.sessionId);
    return reply.send({ ok: true });
  } catch (err: any) {
    app.log.error(err, "Failed to disconnect Realtime session");
    return reply.code(500).send({ error: err.message || "failed_to_disconnect" });
  }
});

const address = await app.listen({ host: env.AGENT_HOST, port: env.AGENT_PORT });
app.log.info(`agent-avatar listening on ${address}`);
