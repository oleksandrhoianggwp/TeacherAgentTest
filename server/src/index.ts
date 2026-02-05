import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, migrate, waitForDb } from "./db.js";
import { getEnv } from "./env.js";
import { registerDemoRoutes } from "./demo/routes.js";
import { createRedis, rateLimitOrThrow } from "./redis.js";

const env = getEnv();
const db = createDb(env);
const redis = createRedis(env);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDist = path.resolve(__dirname, "../../web/dist");

const app = Fastify({
  logger: true,
  bodyLimit: 2 * 1024 * 1024
});

await app.register(cors, {
  origin: true,
  credentials: false
});

await app.register(websocket);

app.addHook("preHandler", async (req, reply) => {
  if (!String(req.url).startsWith("/api/demo/")) return;
  const ip = String(req.ip ?? "unknown");
  try {
    await rateLimitOrThrow({
      redis,
      key: ip,
      limit: 120,
      windowSeconds: 60
    });
  } catch (e: any) {
    if (String(e?.message) === "rate_limited") {
      return reply.code(429).send({ error: "rate_limited" });
    }
    // ignore redis errors to avoid breaking demo
  }
});

app.get("/api/health", async () => ({ ok: true }));

await waitForDb(db, { timeoutMs: 60_000 });
await migrate(db);
await registerDemoRoutes(app, { db, env });

// Serve the built frontend when it exists (Docker/prod).
if (process.env.NODE_ENV === "production" && fs.existsSync(path.join(webDist, "index.html"))) {
  await app.register(fastifyStatic, { root: webDist, prefix: "/" });
  app.get("/*", async (_req, reply) => reply.sendFile("index.html"));
}

const address = await app.listen({ host: env.HOST, port: env.PORT });
app.log.info(`server listening on ${address}`);
