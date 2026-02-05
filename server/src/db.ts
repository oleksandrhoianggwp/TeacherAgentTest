import { Pool } from "pg";
import type { Env } from "./env.js";

export type Db = {
  pool: Pool;
};

export function createDb(env: Env): Db {
  const pool = new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    max: 10
  });
  return { pool };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitForDb(db: Db, opts?: { timeoutMs?: number }): Promise<void> {
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const startedAt = Date.now();
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      await db.pool.query("select 1 as ok");
      return;
    } catch (e) {
      const elapsed = Date.now() - startedAt;
      if (elapsed > timeoutMs) {
        throw new Error(`DB not ready after ${attempt} attempts / ${timeoutMs}ms: ${String((e as any)?.message ?? e)}`);
      }
      const delay = Math.min(2000, 200 + attempt * 200);
      await sleep(delay);
    }
  }
}

export async function migrate(db: Db): Promise<void> {
  await db.pool.query(`
    create table if not exists demo_trainers (
      token text primary key,
      created_at timestamptz not null default now(),
      company_name text,
      contact_name text,
      avatar_key text not null default 'female_friendly',
      training_language text not null default 'uk',
      opening_text text not null,
      criteria jsonb not null,
      model text not null
    );
  `);

  await db.pool.query(`
    create table if not exists demo_sessions (
      id text primary key,
      demo_token text not null references demo_trainers(token) on delete cascade,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      user_name text,
      state jsonb not null default '{}'::jsonb,
      messages jsonb not null default '[]'::jsonb
    );
  `);

  await db.pool.query(
    `create index if not exists demo_sessions_demo_token_idx on demo_sessions(demo_token);`
  );

  await db.pool.query(`
    create table if not exists transcript_segments (
      id text primary key,
      session_id text not null references demo_sessions(id) on delete cascade,
      created_at timestamptz not null default now(),
      type text not null check (type in ('user', 'assistant')),
      text text not null,
      metadata jsonb default '{}'::jsonb,
      audio_url text,
      duration_ms integer
    );
  `);

  await db.pool.query(
    `create index if not exists transcript_segments_session_id_idx on transcript_segments(session_id);`
  );

  await db.pool.query(
    `create index if not exists transcript_segments_created_at_idx on transcript_segments(created_at);`
  );
}
