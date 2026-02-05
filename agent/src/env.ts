import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  INTERNAL_API_SECRET: z.string().min(1),

  AGENT_HOST: z.string().default("0.0.0.0"),
  AGENT_PORT: z.coerce.number().int().positive().default(3001),

  OPENAI_API_KEY: z.string().min(1),
  OPENAI_CONTENT_MODEL: z.string().min(1).default("gpt-4.1"),
  OPENAI_REALTIME_MODEL: z.string().min(1).default("gpt-4o-realtime-preview-2024-12-17"),

  OPENAI_VAD_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  OPENAI_VAD_PREFIX_PADDING_MS: z.coerce.number().int().nonnegative().default(300),
  OPENAI_VAD_SILENCE_DURATION_MS: z.coerce.number().int().positive().default(1200),
  OPENAI_VAD_CREATE_RESPONSE: z
    .string()
    .transform((v) => v === "true" || v === "1")
    .pipe(z.boolean())
    .default("false"),

  LIVEAVATAR_API_KEY: z.string().min(1),
  LIVEAVATAR_AVATAR_ID: z.string().min(1),
  LIVEAVATAR_VOICE_ID: z.string().min(1).optional(),
  LIVEAVATAR_CONTEXT_ID: z.string().min(1).optional()
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid env:\n${message}`);
  }
  return parsed.data;
}

