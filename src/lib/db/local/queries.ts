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

export interface LocalPageSyncSummary {
  count: number;
  deleted: number;
  maxUpdatedAt: string;
  maxUpdatedId: string;
  watermark: string;
  cursor: string;
}

type SyncOperation = "insert" | "update" | "delete" | "restore";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAILY_DATE_INDEX_BACKFILL_DEFAULT_LIMIT = 240;
const DAILY_CALENDAR_FALLBACK_SCAN_LIMIT = 240;
const DAILY_RECENT_CANDIDATE_MULTIPLIER = 6;
const DAILY_PARENT_LOOKUP_GUARD = 32;

function parseStoredProperties(
  raw: string | null
): Array<{ name: string; value: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object"
      )
      .map((item) => ({
        name: typeof item.name === "string" ? item.name : "",
        value: typeof item.value === "string" ? item.value : "",
      }));
  } catch {
    return [];
  }
}

function formatInferredDate(
  yearText: string,
  monthText: string,
  dayText: string
): string | null {
  let year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  if (yearText.length === 2) year += year >= 70 ? 1900 : 2000;
  if (
    year < 2000 ||
    year > 2099 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferDateFromTitle(title: string): string | null {
  if (DATE_KEY_PATTERN.test(title)) return title;
  const compact = title.match(
    /(?:^|[^0-9])([0-9]{2})([01][0-9])([0-3][0-9])(?:[^0-9]|$)/
  );
  if (compact) return formatInferredDate(compact[1], compact[2], compact[3]);

  const shortSeparated = title.match(
    /(?:^|[^0-9])([0-9]{2})[-/.年]([0-9]{1,2})[-/.月]([0-9]{1,2})(?:日)?(?:[^0-9]|$)/
  );
  if (shortSeparated) {
    return formatInferredDate(
      shortSeparated[1],
      shortSeparated[2],
      shortSeparated[3]
    );
  }

  const separated = title.match(
    /(?:^|[^0-9])([0-9]{4})[-/.年]([0-9]{1,2})[-/.月]([0-9]{1,2})(?:日)?(?:[^0-9]|$)/
  );
  if (separated) {
    return formatInferredDate(separated[1], separated[2], separated[3]);
  }
  return null;
}

function inferDailyDateKey(title: string, properties: string | null): string | null {
  const existing = parseStoredProperties(properties).find(
    (property) => property.name === "日期" && DATE_KEY_PATTERN.test(property.value)
  );
  return existing?.value ?? inferDateFromTitle((title || "").trim());
}

function pageMetadataSelect(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}id, ${prefix}owner_id, ${prefix}parent_id, ${prefix}database_id, ${prefix}title, ${prefix}icon, ${prefix}cover_url,
            NULL AS content_yjs, NULL AS content_text, ${prefix}properties,
            ${prefix}position, ${prefix}depth, ${prefix}created_at, ${prefix}updated_at, ${prefix}deleted_at, ${prefix}sync_version`;
}

const PAGE_METADATA_SELECT = pageMetadataSelect();

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

export async function listPageMetadata(
  parentId: string | null = null
): Promise<Page[]> {
  const db = await getDb();
  if (parentId === null) {
    return db.query(
      `SELECT ${PAGE_METADATA_SELECT}
       FROM pages
       WHERE parent_id IS NULL AND deleted_at IS NULL
       ORDER BY updated_at DESC`
    ) as unknown as Page[];
  }
  return db.query(
    `SELECT ${PAGE_METADATA_SELECT}
     FROM pages
     WHERE parent_id = ? AND deleted_at IS NULL
     ORDER BY position ASC, updated_at DESC`,
    [parentId]
  ) as unknown as Page[];
}

export async function getPageMetadata(id: string): Promise<Page | null> {
  const db = await getDb();
  const rows = db.query(
    `SELECT ${PAGE_METADATA_SELECT}
     FROM pages
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  ) as unknown as Page[];
  return rows[0] || null;
}

export async function getAllPages(): Promise<Page[]> {
  const db = await getDb();
  return db.query(
    "SELECT * FROM pages WHERE deleted_at IS NULL ORDER BY updated_at DESC"
  ) as unknown as Page[];
}

export async function getAllPageMetadata(): Promise<Page[]> {
  const db = await getDb();
  return db.query(
    `SELECT ${PAGE_METADATA_SELECT}
     FROM pages
     WHERE deleted_at IS NULL
     ORDER BY updated_at DESC`
  ) as unknown as Page[];
}

export async function listRecentPageMetadata(limit = 8): Promise<Page[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  return db.query(
    `SELECT ${PAGE_METADATA_SELECT}
     FROM pages
     WHERE deleted_at IS NULL
     ORDER BY updated_at DESC
     LIMIT ?`,
    [safeLimit]
  ) as unknown as Page[];
}

export async function findDescendantPageMetadataByTitle(
  rootId: string,
  title: string
): Promise<Page | null> {
  const db = await getDb();
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return null;
  const cte = `WITH RECURSIVE descendants AS (
      SELECT ${PAGE_METADATA_SELECT}
      FROM pages
      WHERE parent_id = ? AND deleted_at IS NULL
      UNION ALL
      SELECT ${pageMetadataSelect("p")}
      FROM pages p
      JOIN descendants d ON p.parent_id = d.id
      WHERE p.deleted_at IS NULL
    )`;

  const exactRows = db.query(
    `${cte}
     SELECT *
     FROM descendants
     WHERE title = ?
     ORDER BY id ASC
     LIMIT 1`,
    [rootId, normalizedTitle]
  ) as unknown as Page[];
  if (exactRows[0]) return exactRows[0];

  const partialRows = db.query(
    `${cte}
     SELECT *
     FROM descendants
     WHERE title != '' AND (instr(title, ?) > 0 OR instr(?, title) > 0)
     ORDER BY length(title) ASC, updated_at DESC
     LIMIT 1`,
    [rootId, normalizedTitle, normalizedTitle]
  ) as unknown as Page[];
  return partialRows[0] ?? null;
}

export async function listMoveTargetPageMetadata({
  pageId,
  query = "",
  limit = 30,
}: {
  pageId: string;
  query?: string;
  limit?: number;
}): Promise<Page[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(80, Math.floor(limit)));
  const normalizedQuery = query.trim();
  const queryFilter = normalizedQuery
    ? "AND instr(lower(title), lower(?)) > 0"
    : "";
  const orderClause = normalizedQuery
    ? `ORDER BY
        CASE
          WHEN lower(title) = lower(?) THEN 0
          WHEN instr(lower(title), lower(?)) = 1 THEN 1
          ELSE 2
        END,
        updated_at DESC`
    : "ORDER BY updated_at DESC";
  const params = normalizedQuery
    ? [pageId, normalizedQuery, normalizedQuery, normalizedQuery, safeLimit]
    : [pageId, safeLimit];

  return db.query(
    `WITH RECURSIVE excluded(id) AS (
       SELECT ?
       UNION ALL
       SELECT pages.id
       FROM pages
       JOIN excluded ON pages.parent_id = excluded.id
       WHERE pages.deleted_at IS NULL
     )
     SELECT ${PAGE_METADATA_SELECT}
     FROM pages
     WHERE deleted_at IS NULL
       AND id NOT IN (SELECT id FROM excluded)
       ${queryFilter}
     ${orderClause}
     LIMIT ?`,
    params
  ) as unknown as Page[];
}

function dailyDateCandidateWhere(alias = "pages"): string {
  const prefix = alias ? `${alias}.` : "";
  return `(
    ${prefix}properties LIKE '%日期%' OR
    ${prefix}properties LIKE '%notion-daily-import%' OR
    ${prefix}title GLOB '*[0-9][0-9][0-9][0-9]*' OR
    ${prefix}title GLOB '*[0-9][0-9][0-9][0-9][0-9][0-9]*'
  )`;
}

export async function rebuildPageDateKeyIndex(
  options: { limit?: number; includeRemaining?: boolean } = {}
): Promise<{
  scanned: number;
  updated: number;
  remaining: number;
}> {
  const db = await getDb();
  const limit = Number.isFinite(options.limit)
    ? Math.max(0, Math.floor(options.limit ?? 0))
    : DAILY_DATE_INDEX_BACKFILL_DEFAULT_LIMIT;
  const limitClause = limit > 0 ? ` LIMIT ${limit}` : "";
  const rows = db.query(
    `SELECT id, title, properties, daily_date_key
     FROM pages
     WHERE deleted_at IS NULL
       AND daily_date_key IS NULL
       AND ${dailyDateCandidateWhere("pages")}
     ORDER BY updated_at DESC${limitClause}`
  ) as unknown as Array<{
    id: string;
    title: string;
    properties: string | null;
    daily_date_key: string | null;
  }>;
  let updated = 0;
  for (const row of rows) {
    const nextDateKey = inferDailyDateKey(row.title, row.properties) ?? "";
    if (row.daily_date_key === nextDateKey) continue;
    db.run("UPDATE pages SET daily_date_key = ? WHERE id = ?", [
      nextDateKey,
      row.id,
    ]);
    updated += 1;
  }
  let remaining = rows.length < limit ? 0 : -1;
  if (options.includeRemaining !== false) {
    const remainingRows = db.query(
      `SELECT COUNT(*) as count
       FROM pages
       WHERE deleted_at IS NULL
         AND daily_date_key IS NULL
         AND ${dailyDateCandidateWhere("pages")}`
    ) as unknown as Array<{ count: number }>;
    remaining = Number(remainingRows[0]?.count ?? 0);
  }
  return {
    scanned: rows.length,
    updated,
    remaining,
  };
}

export async function listDailyPageMetadataForCalendar({
  rootId,
  startDate,
  endDate,
  recentLimit = 8,
}: {
  rootId: string;
  startDate: string;
  endDate: string;
  recentLimit?: number;
}): Promise<Page[]> {
  const db = await getDb();
  const byId = new Map<string, Page>();
  const readRows = (sql: string, bind: unknown[]) =>
    db.query(sql, bind) as unknown as Page[];
  const parentIdCache = new Map<string, string | null>();
  const isDailyScopePage = (page: Page): boolean => {
    if (page.id === rootId) return false;
    if ((page.properties ?? "").includes("notion-daily-import")) return true;

    let parentId = page.parent_id;
    for (let i = 0; parentId && i < DAILY_PARENT_LOOKUP_GUARD; i += 1) {
      if (parentId === rootId) return true;
      let cachedParentId = parentIdCache.get(parentId);
      if (cachedParentId === undefined) {
        const rows = db.query(
          "SELECT parent_id FROM pages WHERE id = ? AND deleted_at IS NULL",
          [parentId]
        ) as unknown as Array<{ parent_id: string | null }>;
        cachedParentId = rows[0]?.parent_id ?? null;
        parentIdCache.set(parentId, cachedParentId);
      }
      parentId = cachedParentId;
    }
    return false;
  };
  const addIfDailyScope = (row: Page) => {
    if (isDailyScopePage(row)) byId.set(row.id, row);
  };

  const rangeRows = readRows(
    `SELECT ${PAGE_METADATA_SELECT}
     FROM pages p
     WHERE p.deleted_at IS NULL
       AND p.daily_date_key >= ?
       AND p.daily_date_key <= ?
     ORDER BY p.daily_date_key ASC, p.updated_at DESC`,
    [startDate, endDate]
  );
  for (const row of rangeRows) addIfDailyScope(row);

  if (recentLimit > 0) {
    const recentCandidateLimit = Math.max(
      recentLimit,
      recentLimit * DAILY_RECENT_CANDIDATE_MULTIPLIER
    );
    const recentRows = readRows(
      `SELECT ${PAGE_METADATA_SELECT}
       FROM pages p
       WHERE p.deleted_at IS NULL
         AND p.daily_date_key IS NOT NULL
       ORDER BY p.daily_date_key DESC, p.updated_at DESC
       LIMIT ?`,
      [recentCandidateLimit]
    );
    let recentDailyAdded = 0;
    for (const row of recentRows) {
      const beforeSize = byId.size;
      addIfDailyScope(row);
      if (byId.size > beforeSize) recentDailyAdded += 1;
      if (recentDailyAdded >= recentLimit) break;
    }
  }

  const fallbackRows = readRows(
    `SELECT ${PAGE_METADATA_SELECT}
     FROM pages p
     WHERE p.deleted_at IS NULL
       AND p.daily_date_key IS NULL
       AND ${dailyDateCandidateWhere("p")}
     ORDER BY p.updated_at DESC
     LIMIT ?`,
    [DAILY_CALENDAR_FALLBACK_SCAN_LIMIT]
  );
  for (const row of fallbackRows) {
    if (!isDailyScopePage(row)) continue;
    const dateKey = inferDailyDateKey(row.title, row.properties);
    if (!dateKey || dateKey < startDate || dateKey > endDate) continue;
    byId.set(row.id, row);
  }

  return Array.from(byId.values());
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
  // Notion-style: new pages start untitled; UIs render a "新页面" ghost
  // placeholder instead of storing a throwaway name the user must delete.
  const title = opts?.title ?? "";
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
  updates: Partial<Pick<Page, "title" | "icon" | "cover_url" | "content_text" | "properties" | "parent_id" | "position">> & {
    content_yjs?: Uint8Array;
  }
): Promise<Page | null> {
  const db = await getDb();
  const now = nowISO();

  const setClauses: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];
  const changedCols: string[] = [];
  let nextDailyDateKey: string | null | undefined;

  if (updates.title !== undefined || updates.properties !== undefined) {
    const existing = db.query(
      "SELECT title, properties FROM pages WHERE id = ? AND deleted_at IS NULL",
      [id]
    ) as unknown as Array<{ title: string; properties: string | null }>;
    if (existing[0]) {
      nextDailyDateKey = inferDailyDateKey(
        updates.title ?? existing[0].title,
        updates.properties === undefined
          ? existing[0].properties
          : updates.properties
      );
    }
  }

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
  if (updates.properties !== undefined) {
    setClauses.push("properties = ?");
    values.push(updates.properties);
    changedCols.push("properties");
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
  if (nextDailyDateKey !== undefined) {
    setClauses.push("daily_date_key = ?");
    values.push(nextDailyDateKey);
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

export async function movePage(
  id: string,
  newParentId: string | null,
  newPosition: number
): Promise<Page | null> {
  const db = await getDb();
  const now = nowISO();

  let depth = 0;
  if (newParentId) {
    const parentRows = db.query("SELECT depth FROM pages WHERE id = ?", [
      newParentId,
    ]) as unknown as { depth: number }[];
    depth = (parentRows[0]?.depth ?? 0) + 1;
  }

  const setClauses = [
    "parent_id = ?",
    "position = ?",
    "depth = ?",
    "updated_at = ?",
  ];
  const values: unknown[] = [newParentId, newPosition, depth, now, id];

  db.run(
    `UPDATE pages SET ${setClauses.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
    values
  );

  // Recursively update depth of descendants
  const updateChildDepths = (parentId: string, parentDepth: number) => {
    const children = db.query(
      "SELECT id FROM pages WHERE parent_id = ? AND deleted_at IS NULL",
      [parentId]
    ) as unknown as { id: string }[];
    for (const child of children) {
      db.run("UPDATE pages SET depth = ? WHERE id = ?", [
        parentDepth + 1,
        child.id,
      ]);
      updateChildDepths(child.id, parentDepth + 1);
    }
  };
  updateChildDepths(id, depth);

  recordSyncChange(
    db,
    "pages",
    id,
    "update",
    ["parent_id", "position", "depth", "updated_at"],
    now
  );
  return getPage(id);
}

export async function getNextPosition(
  parentId: string | null
): Promise<number> {
  const db = await getDb();
  if (parentId) {
    const rows = db.query(
      "SELECT MAX(position) as max_pos FROM pages WHERE parent_id = ? AND deleted_at IS NULL",
      [parentId]
    ) as unknown as { max_pos: number | null }[];
    return ((rows[0]?.max_pos as number) || 0) + 1;
  }
  const rows = db.query(
    "SELECT MAX(position) as max_pos FROM pages WHERE parent_id IS NULL AND deleted_at IS NULL"
  ) as unknown as { max_pos: number | null }[];
  return ((rows[0]?.max_pos as number) || 0) + 1;
}

export async function duplicatePageDeep(
  sourceId: string,
  targetParentId: string | null
): Promise<Page | null> {
  const source = await getPage(sourceId);
  if (!source) return null;

  const position = await getNextPosition(targetParentId);
  const copy = await createPage({
    title: `${source.title || "未命名页面"} 副本`,
    parentId: targetParentId,
    icon: source.icon ?? undefined,
  });
  await updatePage(copy.id, {
    content_text: source.content_text ?? "",
    properties: source.properties ?? undefined,
  });

  // Copy content_yjs if present
  const db = await getDb();
  const yjsRows = db.query("SELECT content_yjs FROM pages WHERE id = ?", [
    sourceId,
  ]) as unknown as { content_yjs: Uint8Array | null }[];
  if (yjsRows[0]?.content_yjs) {
    await updatePage(copy.id, {
      content_yjs: yjsRows[0].content_yjs,
    });
  }

  // Update position
  await updatePage(copy.id, { position });

  // Recursively duplicate children
  const children = db.query(
    "SELECT id FROM pages WHERE parent_id = ? AND deleted_at IS NULL ORDER BY position ASC",
    [sourceId]
  ) as unknown as { id: string }[];
  for (const child of children) {
    await duplicatePageDeep(child.id, copy.id);
  }

  return copy;
}

// ─── Account page cloud sync helpers ─────────────────────────

// All pages including soft-deleted ones, so sync can propagate tombstones.
// content_yjs is excluded: the editor loads/saves HTML via content_text.
export async function getAllPagesForSync(): Promise<Page[]> {
  const db = await getDb();
  return db.query(
    `SELECT id, owner_id, parent_id, database_id, title, icon, cover_url,
            content_text, properties, position, depth,
            created_at, updated_at, deleted_at, sync_version
     FROM pages`
  ) as unknown as Page[];
}

export async function getPagesForSyncByIds(ids: string[]): Promise<Page[]> {
  const db = await getDb();
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return [];
  const placeholders = uniqueIds.map(() => "?").join(",");
  return db.query(
    `SELECT id, owner_id, parent_id, database_id, title, icon, cover_url,
            content_text, properties, position, depth,
            created_at, updated_at, deleted_at, sync_version
     FROM pages
     WHERE id IN (${placeholders})`,
    uniqueIds
  ) as unknown as Page[];
}

export async function getLocalPageSyncSummary(): Promise<LocalPageSyncSummary> {
  const db = await getDb();
  const rows = db.query(
    `SELECT id, updated_at, deleted_at
     FROM pages
     WHERE sync_version != -1`
  ) as unknown as Array<{
    id: string;
    updated_at: string;
    deleted_at: string | null;
  }>;

  let deleted = 0;
  let maxUpdatedAt = "";
  let maxUpdatedId = "";
  for (const row of rows) {
    if (row.deleted_at) deleted += 1;
    if (
      row.updated_at > maxUpdatedAt ||
      (row.updated_at === maxUpdatedAt && row.id > maxUpdatedId)
    ) {
      maxUpdatedAt = row.updated_at;
      maxUpdatedId = row.id;
    }
  }

  return {
    count: rows.length,
    deleted,
    maxUpdatedAt,
    maxUpdatedId,
    watermark: `${rows.length}:${deleted}:${maxUpdatedAt}`,
    cursor: maxUpdatedAt
      ? JSON.stringify({ updatedAt: maxUpdatedAt, id: maxUpdatedId })
      : "",
  };
}

export async function clearLocalPageCacheForIds(ids: string[]): Promise<number> {
  const db = await getDb();
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return 0;

  let cleared = 0;
  const now = nowISO();
  const chunkSize = 80;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    const existing = db.query(
      `SELECT COUNT(*) as count FROM pages WHERE id IN (${placeholders})`,
      chunk
    ) as unknown as { count: number }[];
    cleared += Number(existing[0]?.count ?? 0);
    db.run(
      `UPDATE pages
       SET parent_id = NULL,
           title = '',
           icon = NULL,
           cover_url = NULL,
           content_yjs = NULL,
           content_text = NULL,
           properties = NULL,
           position = 0,
           depth = 0,
           updated_at = ?,
           deleted_at = ?
       WHERE id IN (${placeholders})`,
      [now, now, ...chunk]
    );
  }
  return cleared;
}

export interface LocalPageCachePruneResult {
  cleared: number;
  preservedLocalPrivate: number;
}

export async function clearLocalPageCacheExceptIds(
  keepIds: string[]
): Promise<LocalPageCachePruneResult> {
  const db = await getDb();
  const keep = new Set(keepIds.filter(Boolean));
  const protectedLocalIds = getLocalPrivatePageIds(db);
  const rows = db.query(
    "SELECT id FROM pages"
  ) as unknown as { id: string }[];
  const toClear = rows
    .map((row) => row.id)
    .filter((id) => !keep.has(id) && !protectedLocalIds.has(id));
  const preservedLocalPrivate = rows
    .map((row) => row.id)
    .filter((id) => !keep.has(id) && protectedLocalIds.has(id)).length;

  if (toClear.length === 0) {
    return { cleared: 0, preservedLocalPrivate };
  }

  const chunkSize = 80;
  const evictedAt = "1970-01-01T00:00:00.000Z";
  for (let i = 0; i < toClear.length; i += chunkSize) {
    const chunk = toClear.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    db.run(
      `UPDATE pages
       SET parent_id = NULL,
           title = '',
           icon = NULL,
           cover_url = NULL,
           content_yjs = NULL,
           content_text = NULL,
           properties = NULL,
           position = 0,
           depth = 0,
           updated_at = ?,
           deleted_at = ?,
           sync_version = -1
       WHERE id IN (${placeholders})`,
      [evictedAt, evictedAt, ...chunk]
    );
  }

  return { cleared: toClear.length, preservedLocalPrivate };
}

function getLocalPrivatePageIds(db: SqliteDb): Set<string> {
  const ids = new Set<string>();
  try {
    const databaseParents = db.query(
      `SELECT parent_page_id as id
       FROM databases
       WHERE parent_page_id IS NOT NULL AND deleted_at IS NULL`
    ) as unknown as { id: string | null }[];
    for (const row of databaseParents) {
      if (row.id) ids.add(row.id);
    }
  } catch {
    // Older local caches may not have every table yet.
  }
  try {
    const databaseRowPages = db.query(
      `SELECT page_id as id
       FROM database_rows
       WHERE deleted_at IS NULL`
    ) as unknown as { id: string | null }[];
    for (const row of databaseRowPages) {
      if (row.id) ids.add(row.id);
    }
  } catch {
    // Local database rows are private cache state and should not be broken.
  }
  return ids;
}

export interface RemotePageRecord {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  content_text: string | null;
  properties: string | null;
  position: number;
  depth: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// Upsert pages pulled from the account cloud copy, preserving the remote
// timestamps exactly (so a re-compare sees local == remote and does not
// echo the same page back up). Intentionally does NOT write sync_log.
export async function applyRemotePages(
  records: RemotePageRecord[]
): Promise<void> {
  const db = await getDb();
  const validRecords = records.filter((record) => record.id);
  const incomingIds = new Set(validRecords.map((record) => record.id));

  for (const record of validRecords) {
    const existing = db.query("SELECT id FROM pages WHERE id = ?", [
      record.id,
    ]) as unknown as { id: string }[];

    if (existing.length === 0) {
      // Insert all incoming records before assigning parent_id. This avoids a
      // foreign-key failure when a child appears before its parent in the same
      // cloud pull batch.
      db.run(
        `INSERT INTO pages (id, owner_id, title, position, depth, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          DEFAULT_OWNER_ID,
          record.title,
          record.position,
          record.depth,
          record.created_at,
          record.updated_at,
        ]
      );
    }
  }

  for (const record of records) {
    if (!record.id) continue;
    let parentId = record.parent_id;
    if (parentId && !incomingIds.has(parentId)) {
      const parent = db.query("SELECT id FROM pages WHERE id = ?", [
        parentId,
      ]) as unknown as { id: string }[];
      if (parent.length === 0) parentId = null;
    }

    db.run(
      `UPDATE pages SET parent_id = ?, title = ?, icon = ?, cover_url = ?,
              content_text = ?, properties = ?, daily_date_key = ?,
              position = ?, depth = ?,
              created_at = ?, updated_at = ?, deleted_at = ?, sync_version = 1
       WHERE id = ?`,
      [
        parentId,
        record.title,
        record.icon,
        record.cover_url,
        record.content_text,
        record.properties,
        inferDailyDateKey(record.title, record.properties),
        record.position,
        record.depth,
        record.created_at,
        record.updated_at,
        record.deleted_at,
        record.id,
      ]
    );
  }
}

export async function applyRemotePageMetadata(
  records: RemotePageRecord[]
): Promise<void> {
  const db = await getDb();
  const validRecords = records.filter((record) => record.id);
  const incomingIds = new Set(validRecords.map((record) => record.id));

  for (const record of validRecords) {
    const existing = db.query("SELECT id FROM pages WHERE id = ?", [
      record.id,
    ]) as unknown as { id: string }[];

    if (existing.length === 0) {
      db.run(
        `INSERT INTO pages (id, owner_id, title, position, depth, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          DEFAULT_OWNER_ID,
          record.title,
          record.position,
          record.depth,
          record.created_at,
          record.updated_at,
        ]
      );
    }
  }

  for (const record of validRecords) {
    let parentId = record.parent_id;
    if (parentId && !incomingIds.has(parentId)) {
      const parent = db.query("SELECT id FROM pages WHERE id = ?", [
        parentId,
      ]) as unknown as { id: string }[];
      if (parent.length === 0) parentId = null;
    }

    db.run(
      `UPDATE pages SET parent_id = ?, title = ?, icon = ?,
              properties = ?, daily_date_key = ?, position = ?, depth = ?,
              created_at = ?, updated_at = ?, deleted_at = ?, sync_version = 1
       WHERE id = ?`,
      [
        parentId,
        record.title,
        record.icon,
        record.properties,
        inferDailyDateKey(record.title, record.properties),
        record.position,
        record.depth,
        record.created_at,
        record.updated_at,
        record.deleted_at,
        record.id,
      ]
    );
  }
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
    `SELECT p.id, p.owner_id, p.parent_id, p.database_id, p.title, p.icon, p.cover_url,
            NULL AS content_yjs, NULL AS content_text, p.properties,
            p.position, p.depth, p.created_at, p.updated_at, p.deleted_at, p.sync_version
     FROM pages p
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
  updates: Partial<Pick<DatabaseView, "name" | "config" | "position">>
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
  if (updates.position !== undefined) {
    setClauses.push("position = ?");
    values.push(updates.position);
    changedCols.push("position");
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

// ─── Account database cloud sync helpers ─────────────────────

export type RemoteDatabaseRecordType = "database" | "field" | "row" | "view";

export interface RemoteDatabaseRecord {
  type: RemoteDatabaseRecordType;
  id: string;
  database_id: string | null;
  parent_page_id: string | null;
  page_id: string | null;
  owner_id: string;
  title: string | null;
  icon: string | null;
  description: string | null;
  name: string | null;
  field_type: string | null;
  view_type: string | null;
  config: string | null;
  field_values: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LocalDatabaseCachePruneResult {
  cleared: number;
}

export interface PendingDatabaseSyncRecords {
  entries: Array<{
    logId: number;
    key: string;
  }>;
  records: RemoteDatabaseRecord[];
}

export interface LocalDatabaseSyncSummary {
  count: number;
  deleted: number;
  maxUpdatedAt: string;
  maxUpdatedKey: string;
  watermark: string;
  cursor: string;
}

const DATABASE_SYNC_TABLE_TYPES: Record<string, RemoteDatabaseRecordType> = {
  databases: "database",
  database_fields: "field",
  database_rows: "row",
  database_views: "view",
};

export function getRemoteDatabaseRecordKey(
  record: Pick<RemoteDatabaseRecord, "type" | "id">
): string {
  return `${record.type}:${record.id}`;
}

export async function getLocalDatabaseSyncSummary(): Promise<LocalDatabaseSyncSummary> {
  const db = await getDb();
  const rows = db.query(
    `SELECT 'database' as type, id, updated_at, deleted_at
       FROM databases
      WHERE sync_version != -1
     UNION ALL
     SELECT 'field' as type, id, updated_at, deleted_at
       FROM database_fields
      WHERE sync_version != -1
     UNION ALL
     SELECT 'view' as type, id, updated_at, deleted_at
       FROM database_views
      WHERE sync_version != -1
     UNION ALL
     SELECT 'row' as type, id, updated_at, deleted_at
       FROM database_rows
      WHERE sync_version != -1`
  ) as unknown as Array<{
    type: RemoteDatabaseRecordType;
    id: string;
    updated_at: string;
    deleted_at: string | null;
  }>;

  let deleted = 0;
  let maxUpdatedAt = "";
  let maxUpdatedKey = "";
  for (const row of rows) {
    const key = `${row.type}:${row.id}`;
    if (row.deleted_at) deleted += 1;
    if (
      row.updated_at > maxUpdatedAt ||
      (row.updated_at === maxUpdatedAt && key > maxUpdatedKey)
    ) {
      maxUpdatedAt = row.updated_at;
      maxUpdatedKey = key;
    }
  }

  return {
    count: rows.length,
    deleted,
    maxUpdatedAt,
    maxUpdatedKey,
    watermark: `${rows.length}:${deleted}:${maxUpdatedAt}`,
    cursor: maxUpdatedAt
      ? JSON.stringify({ updatedAt: maxUpdatedAt, key: maxUpdatedKey })
      : "",
  };
}

function isRemoteDatabaseRecordType(
  value: string
): value is RemoteDatabaseRecordType {
  return ["database", "field", "row", "view"].includes(value);
}

function isRemoteDatabaseRecordKey(value: string): boolean {
  const [type, id, extra] = value.split(":");
  return (
    !extra &&
    Boolean(type) &&
    Boolean(id) &&
    isRemoteDatabaseRecordType(type) &&
    /^[A-Za-z0-9_-]+$/.test(id) &&
    id.length <= 64
  );
}

export async function getAllDatabaseRecordsForSync(): Promise<
  RemoteDatabaseRecord[]
> {
  const db = await getDb();
  const databases = db.query("SELECT * FROM databases") as unknown as Database[];
  const fields = db.query("SELECT * FROM database_fields") as unknown as DatabaseField[];
  const rows = db.query("SELECT * FROM database_rows") as unknown as DatabaseRow[];
  const views = db.query("SELECT * FROM database_views") as unknown as DatabaseView[];

  return [
    ...databases.map(
      (database): RemoteDatabaseRecord => ({
        type: "database",
        id: database.id,
        database_id: database.id,
        parent_page_id: database.parent_page_id,
        page_id: null,
        owner_id: database.owner_id,
        title: database.title,
        icon: database.icon,
        description: database.description,
        name: null,
        field_type: null,
        view_type: null,
        config: null,
        field_values: null,
        position: 0,
        created_at: database.created_at,
        updated_at: database.updated_at,
        deleted_at: database.deleted_at,
      })
    ),
    ...fields.map(
      (field): RemoteDatabaseRecord => ({
        type: "field",
        id: field.id,
        database_id: field.database_id,
        parent_page_id: null,
        page_id: null,
        owner_id: field.owner_id,
        title: null,
        icon: null,
        description: null,
        name: field.name,
        field_type: field.field_type,
        view_type: null,
        config: field.config,
        field_values: null,
        position: field.position,
        created_at: field.created_at,
        updated_at: field.updated_at,
        deleted_at: field.deleted_at,
      })
    ),
    ...views.map(
      (view): RemoteDatabaseRecord => ({
        type: "view",
        id: view.id,
        database_id: view.database_id,
        parent_page_id: null,
        page_id: null,
        owner_id: view.owner_id,
        title: null,
        icon: null,
        description: null,
        name: view.name,
        field_type: null,
        view_type: view.view_type,
        config: view.config,
        field_values: null,
        position: view.position,
        created_at: view.created_at,
        updated_at: view.updated_at,
        deleted_at: view.deleted_at,
      })
    ),
    ...rows.map(
      (row): RemoteDatabaseRecord => ({
        type: "row",
        id: row.id,
        database_id: row.database_id,
        parent_page_id: null,
        page_id: row.page_id,
        owner_id: row.owner_id,
        title: null,
        icon: null,
        description: null,
        name: null,
        field_type: null,
        view_type: null,
        config: null,
        field_values: row.field_values,
        position: row.position,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
      })
    ),
  ];
}

export async function getDatabaseRecordsForSyncByKeys(
  keys: string[]
): Promise<RemoteDatabaseRecord[]> {
  const wanted = new Set(keys.filter(isRemoteDatabaseRecordKey));
  if (wanted.size === 0) return [];
  const records = await getAllDatabaseRecordsForSync();
  return records.filter((record) =>
    wanted.has(getRemoteDatabaseRecordKey(record))
  );
}

export async function getPendingDatabaseSyncRecords(
  limit: number = 200
): Promise<PendingDatabaseSyncRecords> {
  const db = await getDb();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 1000);
  const rows = db.query(
    `SELECT id, table_name as tableName, row_id as rowId
     FROM sync_log
     WHERE synced = 0
       AND table_name IN ('databases', 'database_fields', 'database_rows', 'database_views')
     ORDER BY timestamp ASC, id ASC
     LIMIT ?`,
    [safeLimit]
  ) as unknown as Array<{
    id: number;
    tableName: string;
    rowId: string;
  }>;
  const entries = rows
    .map((row) => {
      const type = DATABASE_SYNC_TABLE_TYPES[row.tableName];
      if (!type || !row.rowId) return null;
      return {
        logId: Number(row.id),
        key: `${type}:${row.rowId}`,
      };
    })
    .filter((entry): entry is { logId: number; key: string } => Boolean(entry));
  const records = await getDatabaseRecordsForSyncByKeys(
    entries.map((entry) => entry.key)
  );
  return { entries, records };
}

export async function markDatabaseSyncLogEntriesSynced(
  ids: number[]
): Promise<number> {
  const db = await getDb();
  const uniqueIds = Array.from(
    new Set(
      ids
        .map((id) => Math.floor(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
  if (uniqueIds.length === 0) return 0;
  let marked = 0;
  const chunkSize = 200;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    db.run(
      `UPDATE sync_log
       SET synced = 1
       WHERE id IN (${placeholders})`,
      chunk
    );
    marked += chunk.length;
  }
  return marked;
}

export async function clearLocalDatabaseCacheExceptKeys(
  keepKeys: string[]
): Promise<LocalDatabaseCachePruneResult> {
  const db = await getDb();
  const keep = new Set(keepKeys.filter(isRemoteDatabaseRecordKey));
  const tableSpecs: Array<{
    tableName: string;
    type: RemoteDatabaseRecordType;
  }> = [
    { tableName: "database_rows", type: "row" },
    { tableName: "database_fields", type: "field" },
    { tableName: "database_views", type: "view" },
    { tableName: "databases", type: "database" },
  ];

  let cleared = 0;
  const evictedAt = "1970-01-01T00:00:00.000Z";
  const chunkSize = 80;

  for (const spec of tableSpecs) {
    const rows = db.query(
      `SELECT id FROM ${spec.tableName}`
    ) as unknown as { id: string }[];
    const toClear = rows
      .map((row) => row.id)
      .filter((id) => !keep.has(`${spec.type}:${id}`));
    cleared += toClear.length;
    for (let i = 0; i < toClear.length; i += chunkSize) {
      const chunk = toClear.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "?").join(", ");
      db.run(
        `UPDATE ${spec.tableName}
         SET updated_at = ?, deleted_at = ?, sync_version = -1
         WHERE id IN (${placeholders})`,
        [evictedAt, evictedAt, ...chunk]
      );
    }
  }

  return { cleared };
}

export async function applyRemoteDatabaseRecords(
  records: RemoteDatabaseRecord[]
): Promise<void> {
  const db = await getDb();
  const validRecords = records.filter(
    (record) => record.id && isRemoteDatabaseRecordType(record.type)
  );
  const order: Record<RemoteDatabaseRecordType, number> = {
    database: 0,
    field: 1,
    view: 2,
    row: 3,
  };
  const sorted = [...validRecords].sort(
    (a, b) => order[a.type] - order[b.type]
  );

  for (const record of sorted) {
    if (record.type === "database") {
      upsertRemoteDatabase(db, record);
    } else if (record.type === "field") {
      upsertRemoteDatabaseField(db, record);
    } else if (record.type === "view") {
      upsertRemoteDatabaseView(db, record);
    } else if (record.type === "row") {
      upsertRemoteDatabaseRow(db, record);
    }
  }
}

function hasPage(db: SqliteDb, id: string | null): boolean {
  if (!id) return false;
  const rows = db.query("SELECT id FROM pages WHERE id = ?", [
    id,
  ]) as unknown as { id: string }[];
  return rows.length > 0;
}

function ensureDatabasePlaceholder(
  db: SqliteDb,
  databaseId: string | null,
  timestamp: string
) {
  if (!databaseId) return;
  const existing = db.query("SELECT id FROM databases WHERE id = ?", [
    databaseId,
  ]) as unknown as { id: string }[];
  if (existing.length > 0) return;
  db.run(
    `INSERT INTO databases (id, owner_id, title, icon, created_at, updated_at, sync_version)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [databaseId, DEFAULT_OWNER_ID, "未命名数据库", "🗄️", timestamp, timestamp]
  );
}

function ensureDatabaseRowPage(
  db: SqliteDb,
  pageId: string | null,
  databaseId: string | null,
  createdAt: string,
  updatedAt: string
) {
  if (!pageId) return;
  const existing = db.query("SELECT id FROM pages WHERE id = ?", [
    pageId,
  ]) as unknown as { id: string }[];
  if (existing.length > 0) return;
  db.run(
    `INSERT INTO pages (id, owner_id, database_id, title, icon, position, depth, created_at, updated_at, sync_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      pageId,
      DEFAULT_OWNER_ID,
      databaseId,
      "未命名页面",
      "📄",
      0,
      0,
      createdAt,
      updatedAt,
    ]
  );
}

function upsertRemoteDatabase(db: SqliteDb, record: RemoteDatabaseRecord) {
  const parentPageId = hasPage(db, record.parent_page_id)
    ? record.parent_page_id
    : null;
  const existing = db.query("SELECT id FROM databases WHERE id = ?", [
    record.id,
  ]) as unknown as { id: string }[];
  if (existing.length === 0) {
    db.run(
      `INSERT INTO databases
         (id, owner_id, parent_page_id, title, icon, description, created_at, updated_at, deleted_at, sync_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        record.id,
        DEFAULT_OWNER_ID,
        parentPageId,
        record.title ?? "",
        record.icon,
        record.description,
        record.created_at,
        record.updated_at,
        record.deleted_at,
      ]
    );
    return;
  }
  db.run(
    `UPDATE databases
     SET parent_page_id = ?, title = ?, icon = ?, description = ?,
         created_at = ?, updated_at = ?, deleted_at = ?, sync_version = 1
     WHERE id = ?`,
    [
      parentPageId,
      record.title ?? "",
      record.icon,
      record.description,
      record.created_at,
      record.updated_at,
      record.deleted_at,
      record.id,
    ]
  );
}

function upsertRemoteDatabaseField(db: SqliteDb, record: RemoteDatabaseRecord) {
  ensureDatabasePlaceholder(db, record.database_id, record.updated_at);
  if (!record.database_id) return;
  const existing = db.query("SELECT id FROM database_fields WHERE id = ?", [
    record.id,
  ]) as unknown as { id: string }[];
  if (existing.length === 0) {
    db.run(
      `INSERT INTO database_fields
         (id, database_id, owner_id, name, field_type, config, position, created_at, updated_at, deleted_at, sync_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        record.id,
        record.database_id,
        DEFAULT_OWNER_ID,
        record.name ?? "属性",
        record.field_type ?? "text",
        record.config,
        record.position,
        record.created_at,
        record.updated_at,
        record.deleted_at,
      ]
    );
    return;
  }
  db.run(
    `UPDATE database_fields
     SET database_id = ?, name = ?, field_type = ?, config = ?, position = ?,
         created_at = ?, updated_at = ?, deleted_at = ?, sync_version = 1
     WHERE id = ?`,
    [
      record.database_id,
      record.name ?? "属性",
      record.field_type ?? "text",
      record.config,
      record.position,
      record.created_at,
      record.updated_at,
      record.deleted_at,
      record.id,
    ]
  );
}

function upsertRemoteDatabaseView(db: SqliteDb, record: RemoteDatabaseRecord) {
  ensureDatabasePlaceholder(db, record.database_id, record.updated_at);
  if (!record.database_id) return;
  const existing = db.query("SELECT id FROM database_views WHERE id = ?", [
    record.id,
  ]) as unknown as { id: string }[];
  const viewType = record.view_type ?? "table";
  if (existing.length === 0) {
    db.run(
      `INSERT INTO database_views
         (id, database_id, owner_id, name, view_type, config, position, created_at, updated_at, deleted_at, sync_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        record.id,
        record.database_id,
        DEFAULT_OWNER_ID,
        record.name ?? "表格",
        viewType,
        record.config ?? "{}",
        record.position,
        record.created_at,
        record.updated_at,
        record.deleted_at,
      ]
    );
    return;
  }
  db.run(
    `UPDATE database_views
     SET database_id = ?, name = ?, view_type = ?, config = ?, position = ?,
         created_at = ?, updated_at = ?, deleted_at = ?, sync_version = 1
     WHERE id = ?`,
    [
      record.database_id,
      record.name ?? "表格",
      viewType,
      record.config ?? "{}",
      record.position,
      record.created_at,
      record.updated_at,
      record.deleted_at,
      record.id,
    ]
  );
}

function upsertRemoteDatabaseRow(db: SqliteDb, record: RemoteDatabaseRecord) {
  ensureDatabasePlaceholder(db, record.database_id, record.updated_at);
  ensureDatabaseRowPage(
    db,
    record.page_id,
    record.database_id,
    record.created_at,
    record.updated_at
  );
  if (!record.database_id || !record.page_id) return;
  const existing = db.query("SELECT id FROM database_rows WHERE id = ?", [
    record.id,
  ]) as unknown as { id: string }[];
  if (existing.length === 0) {
    db.run(
      `INSERT INTO database_rows
         (id, database_id, page_id, owner_id, field_values, position, created_at, updated_at, deleted_at, sync_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        record.id,
        record.database_id,
        record.page_id,
        DEFAULT_OWNER_ID,
        record.field_values ?? "{}",
        record.position,
        record.created_at,
        record.updated_at,
        record.deleted_at,
      ]
    );
    return;
  }
  db.run(
    `UPDATE database_rows
     SET database_id = ?, page_id = ?, field_values = ?, position = ?,
         created_at = ?, updated_at = ?, deleted_at = ?, sync_version = 1
     WHERE id = ?`,
    [
      record.database_id,
      record.page_id,
      record.field_values ?? "{}",
      record.position,
      record.created_at,
      record.updated_at,
      record.deleted_at,
      record.id,
    ]
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
