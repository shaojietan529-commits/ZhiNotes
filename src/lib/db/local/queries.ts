import { getDb } from "./client";
import { generateId, DEFAULT_OWNER_ID } from "@/lib/utils/id";
import { nowISO } from "@/lib/utils/dates";
import type { Page, PageVersion } from "@/lib/utils/types";

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
  const title = opts?.title ?? "Untitled";
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

  if (updates.title !== undefined) {
    setClauses.push("title = ?");
    values.push(updates.title);
  }
  if (updates.icon !== undefined) {
    setClauses.push("icon = ?");
    values.push(updates.icon);
  }
  if (updates.cover_url !== undefined) {
    setClauses.push("cover_url = ?");
    values.push(updates.cover_url);
  }
  if (updates.content_text !== undefined) {
    setClauses.push("content_text = ?");
    values.push(updates.content_text);
  }
  if (updates.content_yjs !== undefined) {
    setClauses.push("content_yjs = ?");
    values.push(updates.content_yjs);
  }
  if (updates.parent_id !== undefined) {
    setClauses.push("parent_id = ?");
    values.push(updates.parent_id);
  }
  if (updates.position !== undefined) {
    setClauses.push("position = ?");
    values.push(updates.position);
  }

  values.push(id);
  db.run(
    `UPDATE pages SET ${setClauses.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
    values
  );

  return getPage(id);
}

export async function deletePage(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  db.run(
    "UPDATE pages SET deleted_at = ?, updated_at = ? WHERE id = ?",
    [now, now, id]
  );
}

export async function searchPages(query: string): Promise<Page[]> {
  const db = await getDb();
  const pattern = `%${query}%`;
  return db.query(
    `SELECT * FROM pages
     WHERE deleted_at IS NULL
       AND (title LIKE ? OR content_text LIKE ?)
     ORDER BY updated_at DESC
     LIMIT 20`,
    [pattern, pattern]
  ) as unknown as Page[];
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

  // Create a default table view
  const viewId = generateId();
  db.run(
    `INSERT INTO database_views (id, database_id, owner_id, name, view_type, config, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [viewId, id, DEFAULT_OWNER_ID, "Table", "table", "{}", 0, now, now]
  );

  // Create a default "Name" field
  const fieldId = generateId();
  db.run(
    `INSERT INTO database_fields (id, database_id, owner_id, name, field_type, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [fieldId, id, DEFAULT_OWNER_ID, "Name", "text", 0, now, now]
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

  if (updates.title !== undefined) { setClauses.push("title = ?"); values.push(updates.title); }
  if (updates.icon !== undefined) { setClauses.push("icon = ?"); values.push(updates.icon); }
  if (updates.description !== undefined) { setClauses.push("description = ?"); values.push(updates.description); }

  values.push(id);
  db.run(`UPDATE databases SET ${setClauses.join(", ")} WHERE id = ?`, values);
  return getDatabase(id);
}

export async function deleteDatabase(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  db.run("UPDATE databases SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
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

  if (updates.name !== undefined) { setClauses.push("name = ?"); values.push(updates.name); }
  if (updates.field_type !== undefined) { setClauses.push("field_type = ?"); values.push(updates.field_type); }
  if (updates.config !== undefined) { setClauses.push("config = ?"); values.push(updates.config); }
  if (updates.position !== undefined) { setClauses.push("position = ?"); values.push(updates.position); }

  values.push(id);
  db.run(`UPDATE database_fields SET ${setClauses.join(", ")} WHERE id = ?`, values);
}

export async function deleteField(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  db.run("UPDATE database_fields SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
}

// ─── Database Rows ───────────────────────────────────────────

export async function getRows(databaseId: string): Promise<(DatabaseRow & { page: Page })[]> {
  const db = await getDb();
  const rows = db.query(
    `SELECT dr.*, p.title as page_title, p.icon as page_icon, p.created_at as page_created_at, p.updated_at as page_updated_at
     FROM database_rows dr
     INNER JOIN pages p ON p.id = dr.page_id
     WHERE dr.database_id = ? AND dr.deleted_at IS NULL AND p.deleted_at IS NULL
     ORDER BY dr.position ASC`,
    [databaseId]
  ) as unknown as (DatabaseRow & { page_title: string; page_icon: string; page_created_at: string; page_updated_at: string })[];

  return rows.map((r) => ({
    ...r,
    page: {
      id: r.page_id,
      title: r.page_title,
      icon: r.page_icon,
      created_at: r.page_created_at,
      updated_at: r.page_updated_at,
    } as Page,
  }));
}

export async function addRow(databaseId: string, opts?: {
  title?: string;
  fieldValues?: Record<string, unknown>;
}): Promise<DatabaseRow> {
  const db = await getDb();
  const now = nowISO();

  // Create a page for this row
  const page = await createPage({ title: opts?.title ?? "Untitled" });

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

  if (updates.fieldValues !== undefined) {
    setClauses.push("field_values = ?");
    values.push(JSON.stringify(updates.fieldValues));
  }
  if (updates.position !== undefined) {
    setClauses.push("position = ?");
    values.push(updates.position);
  }

  values.push(id);
  db.run(`UPDATE database_rows SET ${setClauses.join(", ")} WHERE id = ?`, values);
}

export async function deleteRow(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  // Get the page_id to soft-delete the page too
  const rows = db.query("SELECT page_id FROM database_rows WHERE id = ?", [id]) as unknown as { page_id: string }[];
  if (rows[0]) {
    db.run("UPDATE pages SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, rows[0].page_id]);
  }
  db.run("UPDATE database_rows SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
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

  if (updates.name !== undefined) { setClauses.push("name = ?"); values.push(updates.name); }
  if (updates.config !== undefined) { setClauses.push("config = ?"); values.push(updates.config); }

  values.push(id);
  db.run(`UPDATE database_views SET ${setClauses.join(", ")} WHERE id = ?`, values);
}

export async function deleteView(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  db.run("UPDATE database_views SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
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
      opts.title || "Untitled",
      opts.contentHtml || "",
      opts.summary || "",
      now,
    ]
  );

  return (await getVersion(id))!;
}

export async function deleteVersion(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM page_versions WHERE id = ?", [id]);
}
