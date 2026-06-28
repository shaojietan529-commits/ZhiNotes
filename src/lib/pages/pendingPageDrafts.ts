import type { Page } from "@/lib/utils/types";

const PENDING_PAGE_DRAFT_PREFIX = "zhinote.page.pendingDraft.";
const PENDING_PAGE_DRAFT_TTL_MS = 2 * 60 * 1000;
const PENDING_PAGE_DRAFT_MAX_ITEMS = 12;
const PENDING_PAGE_DRAFT_MAX_CHARS = 900 * 1024;
const PENDING_PAGE_DRAFT_DEBOUNCE_CHARS = 32 * 1024;
const PENDING_PAGE_DRAFT_STORAGE_WRITE_DELAY_MS = 360;

const pendingPageDrafts = new Map<
  string,
  { page: Page; expiresAt: number }
>();
const pendingPageDraftSessionWrites = new Map<
  string,
  { page: Page; expiresAt: number }
>();
let pendingPageDraftSessionWriteTimer: number | null = null;
let pendingPageDraftFlushListenersAttached = false;

type PendingPageDraftRecordPage = Omit<Page, "content_yjs"> & {
  content_yjs: null;
};

interface PendingPageDraftRecord {
  format: "zhinote-pending-page-draft";
  format_version: 1;
  cached_at: string;
  expires_at: string;
  privacy_boundary: string;
  boundary: {
    session_storage_only: true;
    stores_page_body_html: true;
    stores_page_yjs: false;
    uploads_workspace_data: false;
    writes_server_data: false;
    enters_sync_log: false;
    stores_source_of_truth: false;
  };
  page: PendingPageDraftRecordPage;
}

export function rememberPendingPageDraft(page: Page): void {
  prunePendingPageDrafts();
  const expiresAt = Date.now() + PENDING_PAGE_DRAFT_TTL_MS;
  pendingPageDrafts.set(page.id, {
    page,
    expiresAt,
  });
  rememberPendingPageDraftInSessionStorageSoon(page, expiresAt);
}

export function readPendingPageDraft(pageId: string): Page | null {
  const draft = pendingPageDrafts.get(pageId);
  if (draft) {
    if (draft.expiresAt < Date.now()) {
      clearPendingPageDraft(pageId);
      return null;
    }
    return draft.page;
  }

  const recovered = readPendingPageDraftFromSessionStorage(pageId);
  if (!recovered) return null;
  pendingPageDrafts.set(pageId, recovered);
  return recovered.page;
}

export function clearPendingPageDraft(pageId: string): void {
  pendingPageDrafts.delete(pageId);
  pendingPageDraftSessionWrites.delete(pageId);
  clearPendingPageDraftFromSessionStorage(pageId);
}

function prunePendingPageDrafts(): void {
  const now = Date.now();
  for (const [pageId, draft] of pendingPageDrafts) {
    if (draft.expiresAt < now) pendingPageDrafts.delete(pageId);
  }
  prunePendingPageDraftSessionStorage(now);
}

function rememberPendingPageDraftInSessionStorageSoon(
  page: Page,
  expiresAt: number
): void {
  if (typeof window === "undefined") return;
  if (!shouldDebouncePendingPageDraftStorageWrite(page)) {
    pendingPageDraftSessionWrites.delete(page.id);
    rememberPendingPageDraftInSessionStorage(page, expiresAt);
    return;
  }

  pendingPageDraftSessionWrites.set(page.id, { page, expiresAt });
  ensurePendingPageDraftFlushListeners();
  if (pendingPageDraftSessionWriteTimer !== null) {
    window.clearTimeout(pendingPageDraftSessionWriteTimer);
  }
  pendingPageDraftSessionWriteTimer = window.setTimeout(() => {
    pendingPageDraftSessionWriteTimer = null;
    flushPendingPageDraftSessionStorageWrites();
  }, PENDING_PAGE_DRAFT_STORAGE_WRITE_DELAY_MS);
}

function shouldDebouncePendingPageDraftStorageWrite(page: Page): boolean {
  return (page.content_text?.length ?? 0) > PENDING_PAGE_DRAFT_DEBOUNCE_CHARS;
}

function ensurePendingPageDraftFlushListeners(): void {
  if (typeof window === "undefined" || pendingPageDraftFlushListenersAttached) {
    return;
  }
  pendingPageDraftFlushListenersAttached = true;
  window.addEventListener("pagehide", flushPendingPageDraftSessionStorageWrites);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushPendingPageDraftSessionStorageWrites();
    }
  });
}

function flushPendingPageDraftSessionStorageWrites(): void {
  if (typeof window === "undefined" || pendingPageDraftSessionWrites.size === 0) {
    return;
  }
  if (pendingPageDraftSessionWriteTimer !== null) {
    window.clearTimeout(pendingPageDraftSessionWriteTimer);
    pendingPageDraftSessionWriteTimer = null;
  }
  const writes = [...pendingPageDraftSessionWrites.values()];
  pendingPageDraftSessionWrites.clear();
  for (const write of writes) {
    rememberPendingPageDraftInSessionStorage(write.page, write.expiresAt);
  }
}

function rememberPendingPageDraftInSessionStorage(
  page: Page,
  expiresAt: number
): void {
  if (typeof window === "undefined") return;
  const record: PendingPageDraftRecord = {
    format: "zhinote-pending-page-draft",
    format_version: 1,
    cached_at: new Date().toISOString(),
    expires_at: new Date(expiresAt).toISOString(),
    privacy_boundary:
      "Short-lived same-tab recovery draft. This may store page body HTML only in sessionStorage so a refresh can recover an unsaved optimistic edit. It never uploads, never writes server data, never enters sync_log, never stores Yjs, and is cleared after the local cache confirms the page write.",
    boundary: {
      session_storage_only: true,
      stores_page_body_html: true,
      stores_page_yjs: false,
      uploads_workspace_data: false,
      writes_server_data: false,
      enters_sync_log: false,
      stores_source_of_truth: false,
    },
    page: {
      ...page,
      content_yjs: null,
    },
  };

  try {
    const serialized = JSON.stringify(record);
    if (serialized.length > PENDING_PAGE_DRAFT_MAX_CHARS) return;
    prunePendingPageDraftSessionStorage(Date.now());
    window.sessionStorage.setItem(pendingPageDraftKey(page.id), serialized);
  } catch {
    // The in-memory draft still covers route transitions. Session storage is a
    // best-effort refresh recovery layer and must never block editing.
  }
}

function readPendingPageDraftFromSessionStorage(
  pageId: string
): { page: Page; expiresAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(pendingPageDraftKey(pageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPageDraftRecord>;
    if (!isValidPendingPageDraftRecord(parsed, pageId)) {
      window.sessionStorage.removeItem(pendingPageDraftKey(pageId));
      return null;
    }
    const expiresAt = Date.parse(parsed.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      window.sessionStorage.removeItem(pendingPageDraftKey(pageId));
      return null;
    }
    return {
      page: {
        ...parsed.page,
        content_yjs: null,
      },
      expiresAt,
    };
  } catch {
    return null;
  }
}

function clearPendingPageDraftFromSessionStorage(pageId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(pendingPageDraftKey(pageId));
  } catch {
    // Best-effort local recovery cleanup.
  }
}

function prunePendingPageDraftSessionStorage(now: number): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.sessionStorage;
    const entries: Array<{ key: string; expiresAt: number }> = [];
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(PENDING_PAGE_DRAFT_PREFIX)) continue;
      keys.push(key);
    }

    for (const key of keys) {
      try {
        const value = JSON.parse(storage.getItem(key) || "{}") as {
          expires_at?: string;
        };
        const expiresAt = Date.parse(value.expires_at || "");
        if (!Number.isFinite(expiresAt) || expiresAt < now) {
          storage.removeItem(key);
        } else {
          entries.push({ key, expiresAt });
        }
      } catch {
        storage.removeItem(key);
      }
    }

    entries
      .sort((a, b) => a.expiresAt - b.expiresAt)
      .slice(0, Math.max(0, entries.length - PENDING_PAGE_DRAFT_MAX_ITEMS))
      .forEach((entry) => storage.removeItem(entry.key));
  } catch {
    // Session storage is optional. The memory draft remains available.
  }
}

function isValidPendingPageDraftRecord(
  value: Partial<PendingPageDraftRecord>,
  pageId: string
): value is PendingPageDraftRecord {
  return (
    value.format === "zhinote-pending-page-draft" &&
    value.format_version === 1 &&
    value.page?.id === pageId &&
    typeof value.expires_at === "string" &&
    typeof value.page.title === "string" &&
    typeof value.page.created_at === "string" &&
    typeof value.page.updated_at === "string"
  );
}

function pendingPageDraftKey(pageId: string): string {
  return `${PENDING_PAGE_DRAFT_PREFIX}${pageId}:v1`;
}
