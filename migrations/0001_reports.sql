CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  status        TEXT NOT NULL DEFAULT 'open',      -- open | fixed | wontfix | spam
  collection    TEXT NOT NULL,
  hadith_number TEXT NOT NULL,
  book_number   TEXT,
  error_type    TEXT NOT NULL,
  severity      TEXT NOT NULL,
  note          TEXT,
  page_url      TEXT,
  audio_url     TEXT,
  timing_url    TEXT,
  playback_time REAL,
  token_id      TEXT,
  token_text    TEXT,
  token_start   REAL,
  token_end     REAL,
  context       TEXT,                              -- JSON
  user_agent    TEXT,
  country       TEXT,
  ip_hash       TEXT
);
CREATE INDEX IF NOT EXISTS reports_status_created ON reports(status, created_at);
CREATE INDEX IF NOT EXISTS reports_ip_created ON reports(ip_hash, created_at);
