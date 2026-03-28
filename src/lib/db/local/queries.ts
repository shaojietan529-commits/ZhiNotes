import { getDb } from "./client";
import { generateId, DEFAULT_OWNER_ID } from "@/lib/utils/id";
import { nowISO } from "@/lib/utils/dates";
import type { Page } from "@/lib/utils/types";

// ─── Pages ───────────────────────────────────────────────────

export async function listPages(parentId: string | null = null): Promise<Page[]> {
  const db = await getDb();
  if (parentId === null) {
    return db.selectObjects(
      "SELECT * FROM pages WHERE parent_id IS NULL AND deleted_at IS NULL ORDER BY updated_at DESC"
    ) as unknown as Page[];
  }
  return db.selectObjects(
    "SELECT * FROM pages WHERE parent_id = ? AND deleted_at IS NULL ORDER BY position ASC, updated_at DESC",
    [parentId]
  ) as unknown as Page[];
}

export async function getAllPages(): Promise<Page[]> {
  const db = await getDb();
  return db.selectObjects(
    "SELECT * FROM pages WHERE deleted_at IS NULL ORDER BY updated_at DESC"
  ) as unknown as Page[];
}

export async function getPage(id: string): Promise<Page | null> {
  const db = await getDb();
  const rows = db.selectObjects(
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

  // Compute position: place after last sibling
  const parentId = opts?.parentId ?? null;
  let position = 0;
  if (parentId) {
    const siblings = db.selectObjects(
      "SELECT MAX(position) as max_pos FROM pages WHERE parent_id = ? AND deleted_at IS NULL",
      [parentId]
    );
    position = ((siblings[0]?.max_pos as number) || 0) + 1;
  } else {
    const siblings = db.selectObjects(
      "SELECT MAX(position) as max_pos FROM pages WHERE parent_id IS NULL AND deleted_at IS NULL"
    );
    position = ((siblings[0]?.max_pos as number) || 0) + 1;
  }

  // Compute depth
  let depth = 0;
  if (parentId) {
    const parent = db.selectObjects(
      "SELECT depth FROM pages WHERE id = ?",
      [parentId]
    );
    depth = ((parent[0]?.depth as number) || 0) + 1;
  }

  db.exec(
    `INSERT INTO pages (id, owner_id, parent_id, title, icon, position, depth, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      DEFAULT_OWNER_ID,
      parentId,
      opts?.title ?? "Untitled",
      opts?.icon ?? null,
      position,
      depth,
      now,
      now,
    ]
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
  db.exec(
    `UPDATE pages SET ${setClauses.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
    values
  );

  return getPage(id);
}

export async function deletePage(id: string): Promise<void> {
  const db = await getDb();
  const now = nowISO();
  db.exec(
    "UPDATE pages SET deleted_at = ?, updated_at = ? WHERE id = ?",
    [now, now, id]
  );
}

export async function searchPages(query: string): Promise<Page[]> {
  const db = await getDb();
  const pattern = `%${query}%`;
  return db.selectObjects(
    `SELECT * FROM pages
     WHERE deleted_at IS NULL
       AND (title LIKE ? OR content_text LIKE ?)
     ORDER BY updated_at DESC
     LIMIT 20`,
    [pattern, pattern]
  ) as unknown as Page[];
}
