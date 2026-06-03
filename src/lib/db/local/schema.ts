// SQL statements to create all local SQLite tables.
// These run on first app load and are idempotent (IF NOT EXISTS).

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT,
    avatar_url    TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    deleted_at    TEXT,
    sync_version  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS pages (
    id            TEXT PRIMARY KEY,
    owner_id      TEXT NOT NULL REFERENCES users(id),
    parent_id     TEXT REFERENCES pages(id),
    database_id   TEXT,
    title         TEXT NOT NULL DEFAULT '',
    icon          TEXT,
    cover_url     TEXT,
    content_yjs   BLOB,
    content_text  TEXT,
    position      REAL NOT NULL DEFAULT 0,
    depth         INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    deleted_at    TEXT,
    sync_version  INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id);
  CREATE INDEX IF NOT EXISTS idx_pages_updated ON pages(updated_at DESC);

  CREATE TABLE IF NOT EXISTS page_versions (
    id            TEXT PRIMARY KEY,
    page_id       TEXT NOT NULL REFERENCES pages(id),
    owner_id      TEXT NOT NULL REFERENCES users(id),
    version_num   INTEGER NOT NULL,
    title         TEXT NOT NULL,
    content_yjs   BLOB,
    content_text  TEXT,
    summary       TEXT,
    created_at    TEXT NOT NULL,
    sync_version  INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_versions_page ON page_versions(page_id, version_num DESC);

  CREATE TABLE IF NOT EXISTS databases (
    id            TEXT PRIMARY KEY,
    owner_id      TEXT NOT NULL REFERENCES users(id),
    parent_page_id TEXT REFERENCES pages(id),
    title         TEXT NOT NULL DEFAULT '',
    icon          TEXT,
    description   TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    deleted_at    TEXT,
    sync_version  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS database_fields (
    id            TEXT PRIMARY KEY,
    database_id   TEXT NOT NULL REFERENCES databases(id),
    owner_id      TEXT NOT NULL REFERENCES users(id),
    name          TEXT NOT NULL,
    field_type    TEXT NOT NULL,
    config        TEXT,
    position      REAL NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    deleted_at    TEXT,
    sync_version  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS database_rows (
    id            TEXT PRIMARY KEY,
    database_id   TEXT NOT NULL REFERENCES databases(id),
    page_id       TEXT NOT NULL REFERENCES pages(id),
    owner_id      TEXT NOT NULL REFERENCES users(id),
    field_values  TEXT NOT NULL DEFAULT '{}',
    position      REAL NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    deleted_at    TEXT,
    sync_version  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS database_views (
    id            TEXT PRIMARY KEY,
    database_id   TEXT NOT NULL REFERENCES databases(id),
    owner_id      TEXT NOT NULL REFERENCES users(id),
    name          TEXT NOT NULL,
    view_type     TEXT NOT NULL,
    config        TEXT NOT NULL DEFAULT '{}',
    position      REAL NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    deleted_at    TEXT,
    sync_version  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS wiki_links (
    id            TEXT PRIMARY KEY,
    source_page_id TEXT NOT NULL REFERENCES pages(id),
    target_page_id TEXT NOT NULL REFERENCES pages(id),
    owner_id      TEXT NOT NULL REFERENCES users(id),
    created_at    TEXT NOT NULL,
    deleted_at    TEXT,
    sync_version  INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_links_source ON wiki_links(source_page_id);
  CREATE INDEX IF NOT EXISTS idx_links_target ON wiki_links(target_page_id);

  CREATE TABLE IF NOT EXISTS page_comments (
    id            TEXT PRIMARY KEY,
    page_id       TEXT NOT NULL REFERENCES pages(id),
    owner_id      TEXT NOT NULL REFERENCES users(id),
    body          TEXT NOT NULL,
    resolved      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    deleted_at    TEXT,
    sync_version  INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_comments_page ON page_comments(page_id, resolved, created_at);

  CREATE TABLE IF NOT EXISTS block_comments (
    id            TEXT PRIMARY KEY,
    page_id       TEXT NOT NULL REFERENCES pages(id),
    block_ref     TEXT NOT NULL,
    anchor_text   TEXT NOT NULL,
    owner_id      TEXT NOT NULL REFERENCES users(id),
    body          TEXT NOT NULL,
    resolved      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    deleted_at    TEXT,
    sync_version  INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_block_comments_page ON block_comments(page_id, resolved, created_at);

  CREATE TABLE IF NOT EXISTS sync_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name    TEXT NOT NULL,
    row_id        TEXT NOT NULL,
    operation     TEXT NOT NULL,
    changed_cols  TEXT,
    timestamp     TEXT NOT NULL,
    synced        INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_synclog_pending ON sync_log(synced, timestamp);
`;
