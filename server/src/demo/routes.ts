import type { FastifyInstance } from "fastify";
import { z } from "zod";
import WebSocket from "ws";
import type { Db } from "../db.js";
import type { Env } from "../env.js";
import { renderOpeningText } from "./content.js";
import {
  agentListContexts,
  agentListVoices,
  agentLiveAvatarStart,
  agentLiveAvatarStartWithPersona,
  agentLiveAvatarStop
} from "../agentAvatarClient.js";
import { getAvatarByKey } from "../avatars.js";
import {
  chatTurn,
  createDemoSession,
  createDemoTrainer,
  getDemoSession,
  getDemoTrainer
} from "./service.js";
import { buildTeacherSystemPrompt, buildRealtimeVoicePrompt } from "./prompt.js";
import { AudioRouter } from "../audioRouter.js";

export async function registerDemoRoutes(app: FastifyInstance, deps: { db: Db; env: Env }) {
  const requestSchema = z.object({
    companyName: z.string().trim().min(1).max(200).optional(),
    contactName: z.string().trim().min(1).max(200).optional()
  });

  app.post("/api/demo/request", async (req, reply) => {
    const parsed = requestSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });
    const created = await createDemoTrainer(deps.db, deps.env, parsed.data);
    return reply.send({ token: created.token });
  });

  app.get("/api/demo/:token", async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const trainer = await getDemoTrainer(deps.db, token);
    if (!trainer) return reply.code(404).send({ error: "not_found" });
    return reply.send({
      token: trainer.token,
      title: trainer.title,
      trainingLanguage: trainer.trainingLanguage,
      avatarKey: trainer.avatarKey,
      openingText: trainer.openingTextTemplate,
      criteria: trainer.criteria
    });
  });

  // Debug: show the exact system prompt used by the agent.
  app.get("/api/demo/:token/prompt", async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const trainer = await getDemoTrainer(deps.db, token);
    if (!trainer) return reply.code(404).send({ error: "not_found" });
    const userName = String((req.query as any)?.userName ?? "Олег");
    return reply.send({
      userName,
      prompt: buildTeacherSystemPrompt(trainer, userName),
      criteria: trainer.criteria,
      avatarKey: trainer.avatarKey
    });
  });

  const sessionCreateSchema = z.object({
    userName: z.string().trim().min(1).max(80).default("Олег"),
    voiceId: z.string().trim().min(1).optional(),
    contextId: z.string().trim().min(1).optional()
  });

  app.post("/api/demo/:token/session", async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const trainer = await getDemoTrainer(deps.db, token);
    if (!trainer) return reply.code(404).send({ error: "not_found" });

    const parsed = sessionCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });

    const session = await createDemoSession(deps.db, token, parsed.data.userName);
    const openingText = renderOpeningText(trainer.openingTextTemplate, parsed.data.userName);
    return reply.send({
      sessionId: session.id,
      openingText,
      firstQuestion: "Почни урок"
    });
  });

  // Starts a LiveAvatar session (LiveKit URL + token) and creates a demo session in DB.
  app.post("/api/demo/:token/liveavatar/start", async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const trainer = await getDemoTrainer(deps.db, token);
    if (!trainer) return reply.code(404).send({ error: "not_found" });

    const parsed = sessionCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });

    const demoSession = await createDemoSession(deps.db, token, parsed.data.userName);
    const openingText = renderOpeningText(trainer.openingTextTemplate, parsed.data.userName);

    const avatar = getAvatarByKey(trainer.avatarKey);
    const resolvedAvatarId = deps.env.LIVEAVATAR_AVATAR_ID || avatar.avatarId;
    const requestedVoiceId = parsed.data.voiceId || avatar.voiceId;
    const requestedContextId = parsed.data.contextId || avatar.contextId;

    const { sessionId, sessionToken, livekitUrl, livekitToken, wsUrl } =
      requestedVoiceId && requestedContextId
        ? await agentLiveAvatarStartWithPersona(deps.env, {
            avatarId: resolvedAvatarId,
            voiceId: requestedVoiceId,
            contextId: requestedContextId,
            language: "uk"
          })
        : await agentLiveAvatarStart(deps.env, { avatarId: resolvedAvatarId });

    // Store wsUrl for audio routing to LiveAvatar for lip-sync
    await deps.db.pool.query(
      `update demo_sessions set state = jsonb_set(state, '{liveAvatar}', $2::jsonb, true) where id = $1`,
      [
        demoSession.id,
        JSON.stringify({
          sessionId,
          sessionToken,
          livekitUrl,
          livekitToken,
          wsUrl
        })
      ]
    );

    return reply.send({
      demoSessionId: demoSession.id,
      liveAvatarSessionId: sessionId,
      livekitUrl,
      livekitToken,
      wsUrl, // Pass to frontend for AudioRouter
      openingText,
      // Trigger AI to say greeting first
      firstQuestion: "Почни урок"
    });
  });

  // Helps configure LiveAvatar persona (voice_id + context_id).
  app.get("/api/demo/liveavatar/options", async (_req, reply) => {
    const [voices, contexts] = await Promise.all([
      agentListVoices(deps.env),
      agentListContexts(deps.env)
    ]);
    return reply.send({ voices, contexts });
  });

  // Stops a LiveAvatar session by demoSessionId (uses stored session token).
  app.post("/api/demo/:token/liveavatar/stop", async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const parsed = z
      .object({ demoSessionId: z.string().min(1) })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });

    const session = await getDemoSession(deps.db, parsed.data.demoSessionId);
    if (!session || session.demoToken !== token) return reply.code(404).send({ error: "session_not_found" });

    const liveAvatarToken = session.state.liveAvatar?.sessionToken;
    if (liveAvatarToken) {
      await agentLiveAvatarStop(deps.env, liveAvatarToken);
      await deps.db.pool.query(
        `update demo_sessions set state = state - 'liveAvatar' where id = $1`,
        [session.id]
      );
    }

    return reply.send({ ok: true });
  });

  const chatSchema = z.object({
    sessionId: z.string().min(1),
    message: z.string().trim().min(1).max(4000)
  });

  app.post("/api/demo/:token/chat", async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const trainer = await getDemoTrainer(deps.db, token);
    if (!trainer) return reply.code(404).send({ error: "not_found" });

    const parsed = chatSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });

    const session = await getDemoSession(deps.db, parsed.data.sessionId);
    if (!session || session.demoToken !== token) {
      return reply.code(404).send({ error: "session_not_found" });
    }

    const out = await chatTurn({
      db: deps.db,
      env: deps.env,
      trainer,
      session,
      userMessage: parsed.data.message
    });
    return reply.send(out);
  });

  // Store active AudioRouter sessions for lip-sync
  const audioRouters = new Map<string, AudioRouter>();

  // WebSocket endpoint with AudioRouter for OpenAI Realtime + LiveAvatar lip-sync
  app.get("/api/realtime/:demoSessionId", { websocket: true }, async (clientWs: any, req: any) => {
    const demoSessionId = req.params.demoSessionId as string;

    app.log.info(`[Realtime] Client connected for demo session ${demoSessionId}`);

    // Get session from DB to get LiveAvatar wsUrl
    const session = await getDemoSession(deps.db, demoSessionId);
    if (!session) {
      app.log.error(`[Realtime] Session not found: ${demoSessionId}`);
      clientWs.close(1008, "Session not found");
      return;
    }

    const liveAvatarState = session.state.liveAvatar;
    const wsUrl = liveAvatarState?.wsUrl || null;

    app.log.info(`[Realtime] LiveAvatar wsUrl: ${wsUrl || "none"}`);

    // Get trainer for system prompt (use voice-specific prompt for Realtime)
    const trainer = await getDemoTrainer(deps.db, session.demoToken);
    const systemPrompt = trainer
      ? buildRealtimeVoicePrompt(trainer, session.userName)
      : "Ти Марія, віртуальна викладачка. Говори українською, дружньо та коротко.";

    // Create AudioRouter for this session
    const router = new AudioRouter({
      sessionId: demoSessionId,
      sessionToken: liveAvatarState?.sessionToken || "",
      livekitWsUrl: wsUrl,
      systemPrompt,
      env: deps.env,
      onTranscript: (role, text) => {
        app.log.info(`[Realtime] Transcript (${role}): ${text}`);
      }
    });

    audioRouters.set(demoSessionId, router);

    // Connect router to OpenAI and LiveAvatar
    try {
      await router.connect(clientWs);
      app.log.info(`[Realtime] AudioRouter connected for ${demoSessionId}`);
    } catch (err: any) {
      app.log.error(`[Realtime] AudioRouter connect error: ${err.message}`);
      clientWs.close(1011, "Connection error");
      return;
    }

    // Handle client messages
    clientWs.on("message", (data: WebSocket.RawData) => {
      try {
        const dataStr = typeof data === "string" ? data : data.toString();
        router.handleClientMessage(dataStr);
      } catch (err) {
        app.log.error(`[Realtime] Error handling client message: ${err}`);
      }
    });

    clientWs.on("error", (err: Error) => {
      app.log.error(`[Realtime] Client WebSocket error: ${err}`);
      router.disconnect();
      audioRouters.delete(demoSessionId);
    });

    clientWs.on("close", (code: number, reason: Buffer) => {
      app.log.info(`[Realtime] Client WebSocket closed: ${code} ${reason.toString()}`);
      router.disconnect();
      audioRouters.delete(demoSessionId);
    });
  });
}
