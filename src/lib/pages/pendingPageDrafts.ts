import type { Page } from "@/lib/utils/types";

const PENDING_PAGE_DRAFT_TTL_MS = 30 * 1000;

const pendingPageDrafts = new Map<
  string,
  { page: Page; expiresAt: number }
>();

export function rememberPendingPageDraft(page: Page): void {
  prunePendingPageDrafts();
  pendingPageDrafts.set(page.id, {
    page,
    expiresAt: Date.now() + PENDING_PAGE_DRAFT_TTL_MS,
  });
}

export function readPendingPageDraft(pageId: string): Page | null {
  const draft = pendingPageDrafts.get(pageId);
  if (!draft) return null;
  if (draft.expiresAt < Date.now()) {
    pendingPageDrafts.delete(pageId);
    return null;
  }
  return draft.page;
}

export function clearPendingPageDraft(pageId: string): void {
  pendingPageDrafts.delete(pageId);
}

function prunePendingPageDrafts(): void {
  const now = Date.now();
  for (const [pageId, draft] of pendingPageDrafts) {
    if (draft.expiresAt < now) pendingPageDrafts.delete(pageId);
  }
}
