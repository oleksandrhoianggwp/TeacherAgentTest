-- Таблиця для зберігання транскриптів розмови
CREATE TABLE IF NOT EXISTS transcript_segments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Тип сегменту
  type TEXT NOT NULL CHECK (type IN ('user', 'assistant')),

  -- Текст транскрипту
  text TEXT NOT NULL,

  -- Метадані
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Аудіо дані (опціонально)
  audio_url TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS transcript_segments_session_id_idx
  ON transcript_segments(session_id);

CREATE INDEX IF NOT EXISTS transcript_segments_created_at_idx
  ON transcript_segments(created_at);

-- Додаємо поле для Realtime session info в demo_sessions.state
-- Це вже зберігається в state.liveAvatar, додамо state.realtime
COMMENT ON COLUMN demo_sessions.state IS
  'JSONB: {liveAvatar: {...}, realtime: {sessionId, connected, transcriptCount}}';
