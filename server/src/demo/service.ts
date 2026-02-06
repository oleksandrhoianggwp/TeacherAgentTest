import crypto from "node:crypto";
import type { Db } from "../db.js";
import type { Env } from "../env.js";
import { agentChat, type ChatMessage } from "../agentAvatarClient.js";
import { AI_SCHOOLS_UK, type TrainingCriterion } from "./content.js";
import { buildTeacherSystemPrompt, tryParseModelJson } from "./prompt.js";

export type DemoTrainer = {
  token: string;
  title: string;
  trainingLanguage: string;
  avatarKey: string;
  openingTextTemplate: string;
  criteria: TrainingCriterion[];
  model: string;
};

export type DemoSession = {
  id: string;
  demoToken: string;
  userName: string;
  state: {
    turn: number;
    liveAvatar?: {
      sessionId?: string;
      sessionToken?: string;
      livekitUrl?: string;
      livekitToken?: string;
      wsUrl?: string | null;
    };
  };
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export function generateToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}

export async function createDemoTrainer(db: Db, env: Env, input?: {
  companyName?: string;
  contactName?: string;
}): Promise<{ token: string }> {
  const token = generateToken();
  const content = AI_SCHOOLS_UK;

  await db.pool.query(
    `
      insert into demo_trainers
        (token, company_name, contact_name, avatar_key, training_language, opening_text, criteria, model)
      values
        ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
    `,
    [
      token,
      input?.companyName ?? null,
      input?.contactName ?? null,
      content.avatarKey,
      content.trainingLanguage,
      content.openingTextTemplate,
      JSON.stringify({ title: content.title, criteria: content.criteria }),
      "gpt-4.1"
    ]
  );

  return { token };
}

export async function getDemoTrainer(db: Db, token: string): Promise<DemoTrainer | null> {
  const res = await db.pool.query(
    `select token, avatar_key, training_language, opening_text, criteria, model from demo_trainers where token = $1`,
    [token]
  );
  const row = res.rows[0] as
    | {
        token: string;
        avatar_key: string;
        training_language: string;
        opening_text: string;
        criteria: { title: string; criteria: TrainingCriterion[] };
        model: string;
      }
    | undefined;
  if (!row) return null;
  return {
    token: row.token,
    title: row.criteria?.title ?? AI_SCHOOLS_UK.title,
    trainingLanguage: row.training_language,
    avatarKey: row.avatar_key,
    openingTextTemplate: row.opening_text,
    criteria: row.criteria?.criteria ?? AI_SCHOOLS_UK.criteria,
    model: row.model
  };
}

export async function createDemoSession(
  db: Db,
  token: string,
  userName: string
): Promise<DemoSession> {
  const id = crypto.randomUUID();
  const state = { turn: 0 };
  const messages: DemoSession["messages"] = [];

  await db.pool.query(
    `
      insert into demo_sessions (id, demo_token, user_name, state, messages)
      values ($1, $2, $3, $4::jsonb, $5::jsonb)
    `,
    [id, token, userName, JSON.stringify(state), JSON.stringify(messages)]
  );

  return { id, demoToken: token, userName, state, messages };
}

export async function getDemoSession(db: Db, sessionId: string): Promise<DemoSession | null> {
  const res = await db.pool.query(
    `select id, demo_token, user_name, state, messages from demo_sessions where id = $1`,
    [sessionId]
  );
  const row = res.rows[0] as
    | {
        id: string;
        demo_token: string;
        user_name: string;
        state: {
          turn?: number;
          liveAvatar?: {
            sessionId?: string;
            sessionToken?: string;
            livekitUrl?: string;
            livekitToken?: string;
            wsUrl?: string | null;
          };
        };
        messages: Array<{ role: "user" | "assistant"; content: string }>;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    demoToken: row.demo_token,
    userName: row.user_name ?? "Олег",
    state: {
      turn: row.state?.turn ?? 0,
      liveAvatar: row.state?.liveAvatar
    },
    messages: Array.isArray(row.messages) ? row.messages : []
  };
}

export async function appendTurn(
  db: Db,
  sessionId: string,
  update: {
    state: DemoSession["state"];
    messages: DemoSession["messages"];
  }
): Promise<void> {
  await db.pool.query(
    `
      update demo_sessions
      set updated_at = now(), state = $2::jsonb, messages = $3::jsonb
      where id = $1
    `,
    [sessionId, JSON.stringify(update.state), JSON.stringify(update.messages)]
  );
}

type ModelJson = {
  assistantText: string;
  nextQuestion: string;
  done?: boolean;
};

// Keep for backwards compat of local type usage.
type _ModelJson = ModelJson;

export async function chatTurn(params: {
  db: Db;
  env: Env;
  trainer: DemoTrainer;
  session: DemoSession;
  userMessage: string;
}): Promise<{ assistantText: string; nextQuestion: string; done: boolean }> {
  const { db, env, trainer, session, userMessage } = params;

  const newMessages = [...session.messages, { role: "user" as const, content: userMessage }];
  const history = newMessages.slice(-12);

  const messages: ChatMessage[] = [
    { role: "system", content: buildTeacherSystemPrompt(trainer, session.userName) },
    ...history.map((m) => ({ role: m.role, content: m.content }))
  ];

  const raw = await agentChat(env, messages);
  const parsed = tryParseModelJson(raw);
  const assistantText = parsed?.assistantText ?? raw.trim();
  const nextQuestion =
    parsed?.nextQuestion ??
    "Супер. Скажи, будь ласка, що для тебе найважливіше в цьому пілоті: час вчителя, якість навчання чи безпека?";
  const done = Boolean(parsed?.done);

  const updatedMessages: DemoSession["messages"] = [
    ...newMessages,
    { role: "assistant", content: `${assistantText}\n\n${nextQuestion}`.trim() }
  ];
  const updatedState = { turn: (session.state.turn ?? 0) + 1 };
  await appendTurn(db, session.id, { state: updatedState, messages: updatedMessages });

  return { assistantText, nextQuestion, done };
}
