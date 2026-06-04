import { getDb, type SqliteDb } from "./client";
import { generateId, DEFAULT_OWNER_ID } from "@/lib/utils/id";
import { nowISO } from "@/lib/utils/dates";
import type { BlockComment, Page, PageComment, PageVersion } from "@/lib/utils/types";

export interface SyncLogSummary {
  total: number;
  pending: number;
  lastChangeAt: string | null;
  tables: Array<{
    tableName: string;
    total: number;
    pending: number;
    lastChangeAt: string | null;
  }>;
}

export interface SyncLogEntry {
  id: number;
  tableName: string;
  rowId: string;
  operation: string;
  changedCols: string[];
  timestamp: string;
  synced: number;
}

type SyncOperation = "insert" | "update" | "delete" | "restore";

export interface PageModuleCounts {
  pageId: string;
  versions: number;
  pageComments: number;
  unresolvedPageComments: number;
  blockComments: number;
  unresolvedBlockComments: number;
  outgoingLinks: number;
  backlinks: number;
}

function recordSyncChange(
  db: SqliteDb,
  tableName: string,
  rowId: string,
  operation: SyncOperation,
  changedCols: string[],
  timestamp: string = nowISO()
) {
  db.run(
    `INSERT INTO sync_log (table_name, row_id, operation, changed_cols, timestamp, synced)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [tableName, rowId, operation, JSON.stringify(changedCols), timestamp]
  );
}

// ─── Pages ───────────────────────────────────────────────────

export async function listPages(parentId: string | null = null): Promise<Page[]> {
  const db = await getDb();
  if (parentId === null) {
    return db.query(
      "SELECT * FROM pages WHERE parent_id IS NULL AND deleted_at IS NULL ORDER BY updated_at DESC"
    ) as unknown as Page[];
  }
  return db.query(
    "SELECT * FROM pages WHERE parent_id = ? AND deleted_at IS NULL ORDER BY position ASC, updated_at DESC",
    [parentId]
  ) as unknown as Page[];
}

export async function getAllPages(): Promise<Page[]> {
  const db = await getDb();
  return db.query(
    "SELECT * FROM pages WHERE deleted_at IS NULL ORDER BY updated_at DESC"
  ) as unknown as Page[];
}

export async function getDeletedPages(): Promise<Page[]> {
  const db = await getDb();
  return db.query(
    "SELECT * FROM pages WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"
  ) as unknown as Page[];
}

export async function getPageModuleCounts(): Promise<
  Record<string, PageModuleCounts>
> {
  const db = await getDb();
  const activePages = db.query(
    "SELECT id FROM pages WHERE deleted_at IS NULL"
  ) as unknown as { id: string }[];
  const counts = Object.fromEntries(
    activePages.map((page) => [
      page.id,
      {
        pageId: page.id,
        versions: 0,
        pageComments: 0,
        unresolvedPageComments: 0,
        blockComments: 0,
        unresolvedBlockComments: 0,
        outgoingLinks: 0,
        backlinks: 0,
      } satisfies PageModuleCounts,
    ])
  );

  applyCountRows(
    counts,
    db.query(
      "SELECT page_id as pageId, COUNT(*) as count FROM page_versions GROUP BY page_id"
    ) as unknown as CountRow[],
    "versions"
  );
  applyCountRows(
    counts,
    db.query(
      `SELECT page_id as pageId,
              COUNT(*) as count,
              SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as unresolved
       FROM page_comments
       WHERE deleted_at IS NULL
       GROUP BY page_id`
    ) as unknown as CountRow[],
    "pageComments",
    "unresolvedPageComments"
  );
  applyCountRows(
    counts,
    db.query(
      `SELECT page_id as pageId,
              COUNT(*) as count,
              SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as unresolved
       FROM block_comments
       WHERE deleted_at IS NULL
       GROUP BY page_id`
    ) as unknown as CountRow[],
    "blockComments",
    "unresolvedBlockComments"
  );
  applyCountRows(
    counts,
    db.query(
      `SELECT source_page_id as pageId, COUNT(*) as count
       FROM wiki_links
       WHERE deleted_at IS NULL
       GROUP BY source_page_id`
    ) as unknown as CountRow[],
    "outgoingLinks"
  );
  applyCountRows(
    counts,
    db.query(
      `SELECT target_page_id as pageId, COUNT(*) as count
       FROM wiki_links
       WHERE deleted_at IS NULL
       GROUP BY target_page_id`
    ) as unknown as CountRow[],
    "backlinks"
  );

  return counts;
}

export async function getPage(id: string): Promise<Page | null> {
  const db = await getDb();
  const rows = db.query(
    "SELECT * FROM pages WHERE id = ? AND deleted_at IS NULL",
    [id]
  ) as unknown as Page[];
  return rows[0] || null;
}

export async function createPage(opts?: {
  title?: string;
  parentId?: string | null;
  icon?: string;
}): Promise<Page> {
  const db = await getDb();
  const now = nowISO();
  const id = generateId();
  const title = opts?.title ?? "未命名页面";
  const parentId = opts?.parentId ?? null;
  const icon = opts?.icon ?? null;

  // Compute position: place after last sibling
  let position = 0;
  if (parentId) {
    const siblings = db.query(
      "SELECT MAX(position) as max_pos FROM pages WHERE parent_id = ? AND deleted_at IS NULL",
      [parentId]
    );
    position = ((siblings[0]?.max_pos as number) || 0) + 1;
  } else {
    const siblings = db.query(
      "SELECT MAX(position) as max_pos FROM pages WHERE parent_id IS NULL AND deleted_at IS NULL"
    );
    position = ((siblings[0]?.max_pos as number) || 0) + 1;
  }

  // Compute depth
  let depth = 0;
  if (parentId) {
    const parent = db.query(
      "SELECT depth FROM pages WHERE id = ?",
      [parentId]
    );
    depth = ((parent[0]?.depth as number) || 0) + 1;
  }

  // SQLite WASM doesn't handle JS null in bind params well,
  // so we build the SQL dynamically for nullable columns
  if (parentId && icon) {
    db.run(
      `INSERT INTO pages (id, owner_id, parent_id, title, icon, position, depth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, DEFAULT_OWNER_ID, parentId, title, icon, position, depth, now, now]
    );
  } else if (parentId) {
    db.run(
      `INSERT INTO pages (id, owner_id, parent_id, title, position, depth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, DEFAULT_OWNER_ID, parentId, title, position, depth, now, now]
    );
  } else if (icon) {
    db.run(
      `INSERT INTO pages (id, owner_id, title, icon, position, depth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, DEFAULT_OWNER_ID, title, icon, position, depth, now, now]
    );
  } else {
    db.run(
      `INSERT INTO pages (id, owner_id, title, position, depth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, DEFAULT_OWNER_ID, title, position, depth, now, now]
    );
  }

  recordSyncChange(
    db,
    "pages",
    id,
    "insert",
    ["owner_id", "parent_id", "title", "icon", "position", "depth"],
    now
  );
  return (await getPage(id))!;
}

export async function updatePage(
  id: string,
  updates: Partial<Pick<Page, "title" | "icon" | "cover_url" | "content_text" | "parent_id" | "position">> & {
    content_yjs?: Uint8Array;
  }
): Promise<Page | null> {
  const db = await getDb();
  const now = nowISO();

  const setClauses: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];
  const changedCols: string[] = [];

  if (updates.title !== undefined) {
    setClauses.push("title = ?");
    values.push(updates.title);
    changedCols.push("title");
  }
  if (updates.icon !== undefined) {
    setClauses.push("icon = ?");
    values.push(updates.icon);
    changedCols.push("icon");
  }
  if (updates.cover_url !== undefined) {
    setClauses.push("cover_url = ?");
    values.push(updates.cover_url);
    changedCols.push("cover_url");
  }
  if (updates.content_text !== undefined) {
    setClauses.push("content_text = ?");
    values.push(updates.content_text);
    changedCols.push("content_text");
  }
  if (updates.content_yjs !== undefined) {
    setClauses.push("content_yjs = ?");
    values.push(updates.content_yjs);
    changedCols.push("content_yjs");
  }
  if (updates.parent_id !== undefined) {
    setClauses.push("parent_id = ?");
    values.push(updates.parent_id);
    changedCols.push("parent_id");
  }
  if (updates.position !== undefined) {
    setClauses.push("position = ?");
    values.push(updates.position);
    changedCols.push("position");
  }

  if (changedCols.length === 0) {
    return getPage(id);
  }

  values.push(id);
  db.run(
    `UPDATE pages SET ${setClauses.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
    values
  );

  recordSyncChange(db, "pages", id, "update", [...changedCols, "updated_at"], now);
  return getPage(id);
}

export async function deletePage(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  db.run(
    "UPDATE pages SET deleted_at = ?, updated_at = ? WHERE id = ?",
    [now, now, id]
  );
  recordSyncChange(db, "pages", id, "delete", ["deleted_at", "updated_at"], now);
}

export async function restorePage(id: string): Promise<Page | null> {
  const db = await getDb();
  const now = nowISO();
  const rows = db.query("SELECT parent_id FROM pages WHERE id = ?", [
    id,
  ]) as unknown as { parent_id: string | null }[];
  const parentId = rows[0]?.parent_id ?? null;

  let restoreAsRoot = false;
  if (parentId) {
    const parentRows = db.query(
      "SELECT deleted_at FROM pages WHERE id = ?",
      [parentId]
    ) as unknown as { deleted_at: string | null }[];
    restoreAsRoot = Boolean(parentRows[0]?.deleted_at);
  }

  if (restoreAsRoot) {
    db.run(
      "UPDATE pages SET deleted_at = NULL, parent_id = NULL, depth = 0, updated_at = ? WHERE id = ?",
      [now, id]
    );
    recordSyncChange(
      db,
      "pages",
      id,
      "restore",
      ["deleted_at", "parent_id", "depth", "updated_at"],
      now
    );
  } else {
    db.run(
      "UPDATE pages SET deleted_at = NULL, updated_at = ? WHERE id = ?",
      [now, id]
    );
    recordSyncChange(
      db,
      "pages",
      id,
      "restore",
      ["deleted_at", "updated_at"],
      now
    );
  }

  return getPage(id);
}

export async function searchPages(query: string): Promise<Page[]> {
  const db = await getDb();
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const pages = db.query(
    "SELECT * FROM pages WHERE deleted_at IS NULL"
  ) as unknown as Page[];
  const tokens = getSearchTokens(normalizedQuery);

  return pages
    .map((page) => ({
      page,
      score: scorePageSearch(page, normalizedQuery, tokens),
    }))
    .filter((result) => Number.isFinite(result.score))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return (
        new Date(b.page.updated_at).getTime() -
        new Date(a.page.updated_at).getTime()
      );
    })
    .slice(0, 20)
    .map((result) => result.page);
}

function scorePageSearch(page: Page, query: string, tokens: string[]) {
  const title = normalizeSearchText(page.title || "未命名页面");
  const content = normalizeSearchText(stripSearchHtml(page.content_text ?? ""));

  if (title === query) return 0;
  if (title.startsWith(query)) return 10 + title.length / 1000;
  if (title.includes(query)) return 20 + title.indexOf(query) / 1000;
  if (tokens.every((token) => title.includes(token))) {
    return 30 + getTokenSpreadScore(title, tokens);
  }
  if (content.includes(query)) return 50 + content.indexOf(query) / 10000;
  if (tokens.every((token) => content.includes(token))) {
    return 70 + getTokenSpreadScore(content, tokens) / 10;
  }

  return Number.POSITIVE_INFINITY;
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchTokens(value: string) {
  return Array.from(new Set(value.split(" ").filter(Boolean))).slice(0, 8);
}

function getTokenSpreadScore(source: string, tokens: string[]) {
  const positions = tokens
    .map((token) => source.indexOf(token))
    .filter((position) => position >= 0);
  if (positions.length === 0) return 0;
  return (Math.max(...positions) - Math.min(...positions)) / 1000;
}

function stripSearchHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

type CountRow = {
  pageId: string;
  count: number;
  unresolved?: number | null;
};

function applyCountRows(
  counts: Record<string, PageModuleCounts>,
  rows: CountRow[],
  countKey: keyof Omit<
    PageModuleCounts,
    "pageId" | "unresolvedPageComments" | "unresolvedBlockComments"
  >,
  unresolvedKey?: "unresolvedPageComments" | "unresolvedBlockComments"
) {
  for (const row of rows) {
    const target = counts[row.pageId];
    if (!target) continue;
    target[countKey] = Number(row.count ?? 0);
    if (unresolvedKey) {
      target[unresolvedKey] = Number(row.unresolved ?? 0);
    }
  }
}

// ─── Wiki Links ──────────────────────────────────────────────

export async function updateWikiLinks(
  sourcePageId: string,
  targetPageIds: string[]
): Promise<void> {
  const db = await getDb();
  const now = nowISO();

  // Get existing links for this source page
  const existing = db.query(
    "SELECT id, target_page_id FROM wiki_links WHERE source_page_id = ? AND deleted_at IS NULL",
    [sourcePageId]
  ) as unknown as { id: string; target_page_id: string }[];

  const existingTargets = new Set(existing.map((l) => l.target_page_id));
  const newTargets = new Set(targetPageIds);

  // Soft-delete links that were removed
  for (const link of existing) {
    if (!newTargets.has(link.target_page_id)) {
      db.run(
        "UPDATE wiki_links SET deleted_at = ? WHERE id = ?",
        [now, link.id]
      );
      recordSyncChange(
        db,
        "wiki_links",
        link.id,
        "delete",
        ["deleted_at"],
        now
      );
    }
  }

  // Insert new links
  for (const targetId of targetPageIds) {
    if (!existingTargets.has(targetId)) {
      const id = generateId();
      db.run(
        "INSERT INTO wiki_links (id, source_page_id, target_page_id, owner_id, created_at) VALUES (?, ?, ?, ?, ?)",
        [id, sourcePageId, targetId, DEFAULT_OWNER_ID, now]
      );
      recordSyncChange(
        db,
        "wiki_links",
        id,
        "insert",
        ["source_page_id", "target_page_id", "owner_id"],
        now
      );
    }
  }
}

export async function getBacklinks(
  pageId: string
): Promise<Page[]> {
  const db = await getDb();
  return db.query(
    `SELECT p.* FROM pages p
     INNER JOIN wiki_links wl ON wl.source_page_id = p.id
     WHERE wl.target_page_id = ?
       AND wl.deleted_at IS NULL
       AND p.deleted_at IS NULL
     ORDER BY p.updated_at DESC`,
    [pageId]
  ) as unknown as Page[];
}

// ─── Page Comments ───────────────────────────────────────────

export async function getPageComments(pageId: string): Promise<PageComment[]> {
  const db = await getDb();
  return db.query(
    `SELECT * FROM page_comments
     WHERE page_id = ? AND deleted_at IS NULL
     ORDER BY resolved ASC, created_at DESC`,
    [pageId]
  ) as unknown as PageComment[];
}

export async function addPageComment(
  pageId: string,
  body: string
): Promise<PageComment> {
  const db = await getDb();
  const id = generateId();
  const now = nowISO();
  db.run(
    `INSERT INTO page_comments (id, page_id, owner_id, body, resolved, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [id, pageId, DEFAULT_OWNER_ID, body, now, now]
  );
  recordSyncChange(
    db,
    "page_comments",
    id,
    "insert",
    ["page_id", "owner_id", "body", "resolved"],
    now
  );

  const rows = db.query("SELECT * FROM page_comments WHERE id = ?", [
    id,
  ]) as unknown as PageComment[];
  return rows[0];
}

export async function updatePageComment(
  id: string,
  updates: Partial<Pick<PageComment, "body" | "resolved">>
): Promise<PageComment | null> {
  const db = await getDb();
  const now = nowISO();
  const setClauses: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];
  const changedCols: string[] = [];

  if (updates.body !== undefined) {
    setClauses.push("body = ?");
    values.push(updates.body);
    changedCols.push("body");
  }
  if (updates.resolved !== undefined) {
    setClauses.push("resolved = ?");
    values.push(updates.resolved);
    changedCols.push("resolved");
  }

  if (changedCols.length === 0) {
    const rows = db.query(
      "SELECT * FROM page_comments WHERE id = ? AND deleted_at IS NULL",
      [id]
    ) as unknown as PageComment[];
    return rows[0] || null;
  }

  values.push(id);
  db.run(
    `UPDATE page_comments SET ${setClauses.join(", ")}
     WHERE id = ? AND deleted_at IS NULL`,
    values
  );
  recordSyncChange(
    db,
    "page_comments",
    id,
    "update",
    [...changedCols, "updated_at"],
    now
  );

  const rows = db.query(
    "SELECT * FROM page_comments WHERE id = ? AND deleted_at IS NULL",
    [id]
  ) as unknown as PageComment[];
  return rows[0] || null;
}

export async function deletePageComment(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  db.run("UPDATE page_comments SET deleted_at = ?, updated_at = ? WHERE id = ?", [
    now,
    now,
    id,
  ]);
  recordSyncChange(
    db,
    "page_comments",
    id,
    "delete",
    ["deleted_at", "updated_at"],
    now
  );
}

// ─── Block Comments ──────────────────────────────────────────

export async function getBlockComments(pageId: string): Promise<BlockComment[]> {
  const db = await getDb();
  return db.query(
    `SELECT * FROM block_comments
     WHERE page_id = ? AND deleted_at IS NULL
     ORDER BY resolved ASC, created_at DESC`,
    [pageId]
  ) as unknown as BlockComment[];
}

export async function addBlockComment(opts: {
  pageId: string;
  blockRef: string;
  anchorText: string;
  body: string;
}): Promise<BlockComment> {
  const db = await getDb();
  const id = generateId();
  const now = nowISO();
  db.run(
    `INSERT INTO block_comments (id, page_id, block_ref, anchor_text, owner_id, body, resolved, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      opts.pageId,
      opts.blockRef,
      opts.anchorText,
      DEFAULT_OWNER_ID,
      opts.body,
      now,
      now,
    ]
  );
  recordSyncChange(
    db,
    "block_comments",
    id,
    "insert",
    ["page_id", "block_ref", "anchor_text", "owner_id", "body", "resolved"],
    now
  );

  const rows = db.query("SELECT * FROM block_comments WHERE id = ?", [
    id,
  ]) as unknown as BlockComment[];
  return rows[0];
}

export async function updateBlockComment(
  id: string,
  updates: Partial<Pick<BlockComment, "body" | "resolved">>
): Promise<BlockComment | null> {
  const db = await getDb();
  const now = nowISO();
  const setClauses: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];
  const changedCols: string[] = [];

  if (updates.body !== undefined) {
    setClauses.push("body = ?");
    values.push(updates.body);
    changedCols.push("body");
  }
  if (updates.resolved !== undefined) {
    setClauses.push("resolved = ?");
    values.push(updates.resolved);
    changedCols.push("resolved");
  }

  if (changedCols.length === 0) {
    const rows = db.query(
      "SELECT * FROM block_comments WHERE id = ? AND deleted_at IS NULL",
      [id]
    ) as unknown as BlockComment[];
    return rows[0] || null;
  }

  values.push(id);
  db.run(
    `UPDATE block_comments SET ${setClauses.join(", ")}
     WHERE id = ? AND deleted_at IS NULL`,
    values
  );
  recordSyncChange(
    db,
    "block_comments",
    id,
    "update",
    [...changedCols, "updated_at"],
    now
  );

  const rows = db.query(
    "SELECT * FROM block_comments WHERE id = ? AND deleted_at IS NULL",
    [id]
  ) as unknown as BlockComment[];
  return rows[0] || null;
}

export async function deleteBlockComment(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  db.run("UPDATE block_comments SET deleted_at = ?, updated_at = ? WHERE id = ?", [
    now,
    now,
    id,
  ]);
  recordSyncChange(
    db,
    "block_comments",
    id,
    "delete",
    ["deleted_at", "updated_at"],
    now
  );
}

// ─── Databases ───────────────────────────────────────────────

import type {
  Database,
  DatabaseField,
  DatabaseRow,
  DatabaseView,
} from "@/lib/utils/types";

export async function createDatabase(opts: {
  title: string;
  parentPageId?: string;
  icon?: string;
}): Promise<Database> {
  const db = await getDb();
  const now = nowISO();
  const id = generateId();

  if (opts.parentPageId) {
    db.run(
      `INSERT INTO databases (id, owner_id, parent_page_id, title, icon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, DEFAULT_OWNER_ID, opts.parentPageId, opts.title, opts.icon ?? "🗄️", now, now]
    );
  } else {
    db.run(
      `INSERT INTO databases (id, owner_id, title, icon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, DEFAULT_OWNER_ID, opts.title, opts.icon ?? "🗄️", now, now]
    );
  }

  // Create a default table view.
  const viewId = generateId();
  db.run(
    `INSERT INTO database_views (id, database_id, owner_id, name, view_type, config, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [viewId, id, DEFAULT_OWNER_ID, "表格", "table", "{}", 0, now, now]
  );

  // Create a default title field.
  const fieldId = generateId();
  db.run(
    `INSERT INTO database_fields (id, database_id, owner_id, name, field_type, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [fieldId, id, DEFAULT_OWNER_ID, "名称", "text", 0, now, now]
  );

  recordSyncChange(
    db,
    "databases",
    id,
    "insert",
    ["owner_id", "parent_page_id", "title", "icon"],
    now
  );
  recordSyncChange(
    db,
    "database_views",
    viewId,
    "insert",
    ["database_id", "owner_id", "name", "view_type", "config", "position"],
    now
  );
  recordSyncChange(
    db,
    "database_fields",
    fieldId,
    "insert",
    ["database_id", "owner_id", "name", "field_type", "position"],
    now
  );
  return getDatabase(id) as Promise<Database>;
}

export async function getDatabase(id: string): Promise<Database | null> {
  const db = await getDb();
  const rows = db.query(
    "SELECT * FROM databases WHERE id = ? AND deleted_at IS NULL",
    [id]
  ) as unknown as Database[];
  return rows[0] || null;
}

export async function getAllDatabases(): Promise<Database[]> {
  const db = await getDb();
  return db.query(
    "SELECT * FROM databases WHERE deleted_at IS NULL ORDER BY updated_at DESC"
  ) as unknown as Database[];
}

export async function updateDatabase(
  id: string,
  updates: Partial<Pick<Database, "title" | "icon" | "description">>
): Promise<Database | null> {
  const db = await getDb();
  const now = nowISO();
  const setClauses: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];
  const changedCols: string[] = [];

  if (updates.title !== undefined) {
    setClauses.push("title = ?");
    values.push(updates.title);
    changedCols.push("title");
  }
  if (updates.icon !== undefined) {
    setClauses.push("icon = ?");
    values.push(updates.icon);
    changedCols.push("icon");
  }
  if (updates.description !== undefined) {
    setClauses.push("description = ?");
    values.push(updates.description);
    changedCols.push("description");
  }

  if (changedCols.length === 0) {
    return getDatabase(id);
  }

  values.push(id);
  db.run(`UPDATE databases SET ${setClauses.join(", ")} WHERE id = ?`, values);
  recordSyncChange(
    db,
    "databases",
    id,
    "update",
    [...changedCols, "updated_at"],
    now
  );
  return getDatabase(id);
}

export async function deleteDatabase(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  db.run("UPDATE databases SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
  recordSyncChange(
    db,
    "databases",
    id,
    "delete",
    ["deleted_at", "updated_at"],
    now
  );
}

// ─── Database Fields ─────────────────────────────────────────

export async function getFields(databaseId: string): Promise<DatabaseField[]> {
  const db = await getDb();
  return db.query(
    "SELECT * FROM database_fields WHERE database_id = ? AND deleted_at IS NULL ORDER BY position ASC",
    [databaseId]
  ) as unknown as DatabaseField[];
}

export async function addField(databaseId: string, opts: {
  name: string;
  fieldType: string;
  config?: string;
}): Promise<DatabaseField> {
  const db = await getDb();
  const now = nowISO();
  const id = generateId();

  // Position after last field
  const existing = db.query(
    "SELECT MAX(position) as max_pos FROM database_fields WHERE database_id = ? AND deleted_at IS NULL",
    [databaseId]
  );
  const position = ((existing[0]?.max_pos as number) || 0) + 1;

  db.run(
    `INSERT INTO database_fields (id, database_id, owner_id, name, field_type, config, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, databaseId, DEFAULT_OWNER_ID, opts.name, opts.fieldType, opts.config ?? null, position, now, now]
  );
  recordSyncChange(
    db,
    "database_fields",
    id,
    "insert",
    ["database_id", "owner_id", "name", "field_type", "config", "position"],
    now
  );

  const rows = db.query("SELECT * FROM database_fields WHERE id = ?", [id]) as unknown as DatabaseField[];
  return rows[0];
}

export async function updateField(
  id: string,
  updates: Partial<Pick<DatabaseField, "name" | "field_type" | "config" | "position">>
): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  const setClauses: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];
  const changedCols: string[] = [];

  if (updates.name !== undefined) {
    setClauses.push("name = ?");
    values.push(updates.name);
    changedCols.push("name");
  }
  if (updates.field_type !== undefined) {
    setClauses.push("field_type = ?");
    values.push(updates.field_type);
    changedCols.push("field_type");
  }
  if (updates.config !== undefined) {
    setClauses.push("config = ?");
    values.push(updates.config);
    changedCols.push("config");
  }
  if (updates.position !== undefined) {
    setClauses.push("position = ?");
    values.push(updates.position);
    changedCols.push("position");
  }

  if (changedCols.length === 0) {
    return;
  }

  values.push(id);
  db.run(`UPDATE database_fields SET ${setClauses.join(", ")} WHERE id = ?`, values);
  recordSyncChange(
    db,
    "database_fields",
    id,
    "update",
    [...changedCols, "updated_at"],
    now
  );
}

export async function deleteField(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  db.run("UPDATE database_fields SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
  recordSyncChange(
    db,
    "database_fields",
    id,
    "delete",
    ["deleted_at", "updated_at"],
    now
  );
}

// ─── Database Rows ───────────────────────────────────────────

export async function getRows(databaseId: string): Promise<(DatabaseRow & { page: Page })[]> {
  const db = await getDb();
  const rows = db.query(
    `SELECT dr.*, p.title as page_title, p.icon as page_icon, p.cover_url as page_cover_url, p.content_text as page_content_text, p.created_at as page_created_at, p.updated_at as page_updated_at
     FROM database_rows dr
     INNER JOIN pages p ON p.id = dr.page_id
     WHERE dr.database_id = ? AND dr.deleted_at IS NULL AND p.deleted_at IS NULL
     ORDER BY dr.position ASC`,
    [databaseId]
  ) as unknown as (DatabaseRow & { page_title: string; page_icon: string; page_cover_url: string | null; page_content_text: string | null; page_created_at: string; page_updated_at: string })[];

  return rows.map((r) => ({
    ...r,
    page: {
      id: r.page_id,
      title: r.page_title,
      icon: r.page_icon,
      cover_url: r.page_cover_url,
      content_text: r.page_content_text,
      created_at: r.page_created_at,
      updated_at: r.page_updated_at,
    } as Page,
  }));
}

export async function getDatabaseRowCount(databaseId: string): Promise<number> {
  const db = await getDb();
  const rows = db.query(
    "SELECT COUNT(*) as count FROM database_rows WHERE database_id = ? AND deleted_at IS NULL",
    [databaseId]
  ) as unknown as { count: number }[];

  return Number(rows[0]?.count ?? 0);
}

export async function addRow(databaseId: string, opts?: {
  title?: string;
  fieldValues?: Record<string, unknown>;
  contentText?: string;
}): Promise<DatabaseRow> {
  const db = await getDb();
  const now = nowISO();

  // Create a page for this row
  const page = await createPage({ title: opts?.title ?? "未命名页面" });
  if (opts?.contentText) {
    await updatePage(page.id, { content_text: opts.contentText });
  }

  // Position after last row
  const existing = db.query(
    "SELECT MAX(position) as max_pos FROM database_rows WHERE database_id = ? AND deleted_at IS NULL",
    [databaseId]
  );
  const position = ((existing[0]?.max_pos as number) || 0) + 1;

  const id = generateId();
  const fieldValues = JSON.stringify(opts?.fieldValues ?? {});

  db.run(
    `INSERT INTO database_rows (id, database_id, page_id, owner_id, field_values, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, databaseId, page.id, DEFAULT_OWNER_ID, fieldValues, position, now, now]
  );
  recordSyncChange(
    db,
    "database_rows",
    id,
    "insert",
    ["database_id", "page_id", "owner_id", "field_values", "position"],
    now
  );

  const rows = db.query("SELECT * FROM database_rows WHERE id = ?", [id]) as unknown as DatabaseRow[];
  return rows[0];
}

export async function updateRow(
  id: string,
  updates: { fieldValues?: Record<string, unknown>; position?: number }
): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  const setClauses: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];
  const changedCols: string[] = [];

  if (updates.fieldValues !== undefined) {
    setClauses.push("field_values = ?");
    values.push(JSON.stringify(updates.fieldValues));
    changedCols.push("field_values");
  }
  if (updates.position !== undefined) {
    setClauses.push("position = ?");
    values.push(updates.position);
    changedCols.push("position");
  }

  if (changedCols.length === 0) {
    return;
  }

  values.push(id);
  db.run(`UPDATE database_rows SET ${setClauses.join(", ")} WHERE id = ?`, values);
  recordSyncChange(
    db,
    "database_rows",
    id,
    "update",
    [...changedCols, "updated_at"],
    now
  );
}

export async function deleteRow(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  // Get the page_id to soft-delete the page too
  const rows = db.query("SELECT page_id FROM database_rows WHERE id = ?", [id]) as unknown as { page_id: string }[];
  if (rows[0]) {
    db.run("UPDATE pages SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, rows[0].page_id]);
    recordSyncChange(
      db,
      "pages",
      rows[0].page_id,
      "delete",
      ["deleted_at", "updated_at"],
      now
    );
  }
  db.run("UPDATE database_rows SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
  recordSyncChange(
    db,
    "database_rows",
    id,
    "delete",
    ["deleted_at", "updated_at"],
    now
  );
}

// ─── Database Views ──────────────────────────────────────────

export async function getViews(databaseId: string): Promise<DatabaseView[]> {
  const db = await getDb();
  return db.query(
    "SELECT * FROM database_views WHERE database_id = ? AND deleted_at IS NULL ORDER BY position ASC",
    [databaseId]
  ) as unknown as DatabaseView[];
}

export async function addView(databaseId: string, opts: {
  name: string;
  viewType: DatabaseView["view_type"];
}): Promise<DatabaseView> {
  const db = await getDb();
  const now = nowISO();
  const id = generateId();

  const existing = db.query(
    "SELECT MAX(position) as max_pos FROM database_views WHERE database_id = ? AND deleted_at IS NULL",
    [databaseId]
  );
  const position = ((existing[0]?.max_pos as number) || 0) + 1;

  db.run(
    `INSERT INTO database_views (id, database_id, owner_id, name, view_type, config, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, databaseId, DEFAULT_OWNER_ID, opts.name, opts.viewType, "{}", position, now, now]
  );
  recordSyncChange(
    db,
    "database_views",
    id,
    "insert",
    ["database_id", "owner_id", "name", "view_type", "config", "position"],
    now
  );

  const rows = db.query("SELECT * FROM database_views WHERE id = ?", [id]) as unknown as DatabaseView[];
  return rows[0];
}

export async function updateView(
  id: string,
  updates: Partial<Pick<DatabaseView, "name" | "config">>
): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  const setClauses: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];
  const changedCols: string[] = [];

  if (updates.name !== undefined) {
    setClauses.push("name = ?");
    values.push(updates.name);
    changedCols.push("name");
  }
  if (updates.config !== undefined) {
    setClauses.push("config = ?");
    values.push(updates.config);
    changedCols.push("config");
  }

  if (changedCols.length === 0) {
    return;
  }

  values.push(id);
  db.run(`UPDATE database_views SET ${setClauses.join(", ")} WHERE id = ?`, values);
  recordSyncChange(
    db,
    "database_views",
    id,
    "update",
    [...changedCols, "updated_at"],
    now
  );
}

export async function deleteView(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  db.run("UPDATE database_views SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
  recordSyncChange(
    db,
    "database_views",
    id,
    "delete",
    ["deleted_at", "updated_at"],
    now
  );
}

// ─── Sync Readiness ───────────────────────────────────────────

export async function getSyncLogSummary(): Promise<SyncLogSummary> {
  const db = await getDb();
  const summaryRows = db.query(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) as pending,
       MAX(timestamp) as lastChangeAt
     FROM sync_log`
  ) as unknown as Array<{
    total: number | null;
    pending: number | null;
    lastChangeAt: string | null;
  }>;
  const tableRows = db.query(
    `SELECT
       table_name as tableName,
       COUNT(*) as total,
       SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) as pending,
       MAX(timestamp) as lastChangeAt
     FROM sync_log
     GROUP BY table_name
     ORDER BY pending DESC, lastChangeAt DESC
     LIMIT 8`
  ) as unknown as Array<{
    tableName: string;
    total: number | null;
    pending: number | null;
    lastChangeAt: string | null;
  }>;
  const summary = summaryRows[0];

  return {
    total: Number(summary?.total ?? 0),
    pending: Number(summary?.pending ?? 0),
    lastChangeAt: summary?.lastChangeAt ?? null,
    tables: tableRows.map((row) => ({
      tableName: row.tableName,
      total: Number(row.total ?? 0),
      pending: Number(row.pending ?? 0),
      lastChangeAt: row.lastChangeAt ?? null,
    })),
  };
}

export async function getPendingSyncLogEntries(
  limit: number = 25
): Promise<SyncLogEntry[]> {
  const db = await getDb();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 500);
  const rows = db.query(
    `SELECT
       id,
       table_name as tableName,
       row_id as rowId,
       operation,
       changed_cols as changedCols,
       timestamp,
       synced
     FROM sync_log
     WHERE synced = 0
     ORDER BY timestamp DESC, id DESC
     LIMIT ?`,
    [safeLimit]
  ) as unknown as Array<{
    id: number;
    tableName: string;
    rowId: string;
    operation: string;
    changedCols: string | null;
    timestamp: string;
    synced: number;
  }>;

  return rows.map((row) => ({
    id: Number(row.id),
    tableName: row.tableName,
    rowId: row.rowId,
    operation: row.operation,
    changedCols: parseChangedCols(row.changedCols),
    timestamp: row.timestamp,
    synced: Number(row.synced),
  }));
}

function parseChangedCols(value: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

// ─── Page Versions ───────────────────────────────────────────

export async function getVersions(pageId: string): Promise<PageVersion[]> {
  const db = await getDb();
  return db.query(
    "SELECT * FROM page_versions WHERE page_id = ? ORDER BY version_num DESC",
    [pageId]
  ) as unknown as PageVersion[];
}

export async function getVersion(id: string): Promise<PageVersion | null> {
  const db = await getDb();
  const rows = db.query(
    "SELECT * FROM page_versions WHERE id = ?",
    [id]
  ) as unknown as PageVersion[];
  return rows[0] || null;
}

export async function getLatestVersion(
  pageId: string
): Promise<PageVersion | null> {
  const db = await getDb();
  const rows = db.query(
    "SELECT * FROM page_versions WHERE page_id = ? ORDER BY version_num DESC LIMIT 1",
    [pageId]
  ) as unknown as PageVersion[];
  return rows[0] || null;
}

export async function createVersion(
  pageId: string,
  opts: { title: string; contentHtml: string; summary: string }
): Promise<PageVersion> {
  const db = await getDb();
  const now = nowISO();
  const id = generateId();

  // Next version number = current max + 1
  const maxRows = db.query(
    "SELECT MAX(version_num) as max_num FROM page_versions WHERE page_id = ?",
    [pageId]
  );
  const versionNum = ((maxRows[0]?.max_num as number) || 0) + 1;

  // Store empty strings instead of NULL to avoid SQLite WASM null-bind issues
  db.run(
    `INSERT INTO page_versions (id, page_id, owner_id, version_num, title, content_text, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      pageId,
      DEFAULT_OWNER_ID,
      versionNum,
      opts.title || "未命名页面",
      opts.contentHtml || "",
      opts.summary || "",
      now,
    ]
  );
  recordSyncChange(
    db,
    "page_versions",
    id,
    "insert",
    ["page_id", "owner_id", "version_num", "title", "content_text", "summary"],
    now
  );

  return (await getVersion(id))!;
}

export async function deleteVersion(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM page_versions WHERE id = ?", [id]);
  recordSyncChange(
    db,
    "page_versions",
    id,
    "delete",
    ["id"],
    nowISO()
  );
}
