-- Issue #3: Novel persistence for the create/list flow.
CREATE TABLE IF NOT EXISTS novels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  source_language TEXT NOT NULL CHECK (source_language IN ('ko', 'zh')),
  total_chapters INTEGER NOT NULL CHECK (total_chapters > 0),
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_novels_created_at ON novels (created_at DESC);
