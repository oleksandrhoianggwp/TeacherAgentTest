# Database Schema

## Поточні таблиці

### demo_trainers
Токени для демо уроків.

```sql
CREATE TABLE demo_trainers (
  token TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_name TEXT,
  contact_name TEXT,
  avatar_key TEXT NOT NULL DEFAULT 'female_friendly',
  training_language TEXT NOT NULL DEFAULT 'uk',
  opening_text TEXT NOT NULL,
  criteria JSONB NOT NULL,
  model TEXT NOT NULL
);
```

### demo_sessions
Сесії користувачів з чатом.

```sql
CREATE TABLE demo_sessions (
  id TEXT PRIMARY KEY,
  demo_token TEXT NOT NULL REFERENCES demo_trainers(token) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_name TEXT,
  state JSONB NOT NULL DEFAULT '{}'::JSONB,
  messages JSONB NOT NULL DEFAULT '[]'::JSONB
);

CREATE INDEX demo_sessions_demo_token_idx ON demo_sessions(demo_token);
```

**state структура:**
```json
{
  "turn": 0,
  "liveAvatar": {
    "sessionId": "...",
    "sessionToken": "...",
    "livekitUrl": "...",
    "livekitToken": "..."
  },
  "realtime": {
    "sessionId": "...",
    "connected": true,
    "transcriptCount": 0
  }
}
```

**messages структура:**
```json
[
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."}
]
```

### transcript_segments (НОВА)
Транскрипти голосової розмови.

```sql
CREATE TABLE IF NOT EXISTS transcript_segments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('user', 'assistant')),
  text TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  audio_url TEXT,
  duration_ms INTEGER
);

CREATE INDEX transcript_segments_session_id_idx ON transcript_segments(session_id);
CREATE INDEX transcript_segments_created_at_idx ON transcript_segments(created_at);
```

## Застосувати міграції

### Через код:
```typescript
// server/src/db.ts - додати в migrate()
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

await db.pool.query(`
  create index if not exists transcript_segments_session_id_idx
    on transcript_segments(session_id);
`);
```

### Через Docker:
```bash
# Підключитись до контейнера з БД
docker exec -it teacheragenttest-db-1 psql -U DemoAvatar -d DemoAvatar

# Виконати SQL з файлу
\i server/migrations/001_add_transcripts.sql
```

### Прямо через SQL:
```bash
docker exec -i teacheragenttest-db-1 psql -U DemoAvatar -d DemoAvatar < server/migrations/001_add_transcripts.sql
```

## API для роботи з транскриптами

### Додати в server/src/demo/service.ts:

```typescript
export async function saveTranscript(
  db: Db,
  params: {
    sessionId: string;
    type: 'user' | 'assistant';
    text: string;
    metadata?: any;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  await db.pool.query(
    `INSERT INTO transcript_segments (id, session_id, type, text, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [id, params.sessionId, params.type, params.text, JSON.stringify(params.metadata || {})]
  );
}

export async function getTranscripts(
  db: Db,
  sessionId: string
): Promise<Array<{
  id: string;
  type: 'user' | 'assistant';
  text: string;
  createdAt: Date;
}>> {
  const res = await db.pool.query(
    `SELECT id, type, text, created_at as "createdAt"
     FROM transcript_segments
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId]
  );
  return res.rows;
}
```

## Queries для перевірки

```sql
-- Переглянути всі сесії
SELECT id, user_name, created_at, state->'liveAvatar'->>'sessionId' as avatar_session
FROM demo_sessions
ORDER BY created_at DESC
LIMIT 10;

-- Переглянути транскрипти для сесії
SELECT type, text, created_at
FROM transcript_segments
WHERE session_id = 'SESSION_ID'
ORDER BY created_at;

-- Статистика по транскриптам
SELECT
  session_id,
  COUNT(*) as total_segments,
  SUM(CASE WHEN type = 'user' THEN 1 ELSE 0 END) as user_segments,
  SUM(CASE WHEN type = 'assistant' THEN 1 ELSE 0 END) as assistant_segments
FROM transcript_segments
GROUP BY session_id;
```
