"use client";

import {
  createPage as createLocalPage,
  deletePage as deleteLocalPage,
  duplicatePageDeep as duplicateLocalPageDeep,
  getAllPagesForSync,
  getPage,
  movePage as moveLocalPage,
  updatePage as updateLocalPage,
} from "@/lib/db/local/queries";
import {
  clearPendingPageDraft,
  rememberPendingPageDraft,
} from "@/lib/pages/pendingPageDrafts";
import { emitPageSnapshotsUpdated } from "@/lib/pages/pageUpdateBus";
import { writePageListHotCacheSnapshot } from "@/lib/sync/pageListHotCacheSnapshot";
import { DEFAULT_OWNER_ID, generateId } from "@/lib/utils/id";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Page } from "@/lib/utils/types";

type CreatePageOptions = Parameters<typeof createLocalPage>[0];
type UpdatePageOptions = Parameters<typeof updateLocalPage>[1];

const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync");

export async function createPageWithCloud(
  opts?: CreatePageOptions
): Promise<Page> {
  let page: Page;
  try {
    page = await createLocalPage(opts);
  } catch (error) {
    console.warn("Local page create failed; using cloud draft fallback", error);
    page = createCloudDraftFallbackPage(opts);
    rememberPendingPageDraft(page);
  }
  void queuePageCloudPush(page).catch(() => undefined);
  return page;
}

export function createOptimisticPageWithCloud(
  opts?: CreatePageOptions
): Page {
  const page = createCloudDraftFallbackPage(opts);
  rememberPendingPageDraft(page);
  publishCreatedPageSnapshot(page, "optimistic-local");
  void persistOptimisticCreatedPage(page, opts);
  return page;
}

export async function updatePageWithCloud(
  id: string,
  updates: UpdatePageOptions
): Promise<Page | null> {
  const page = await updateLocalPage(id, updates);
  if (page) void queuePageCloudPush(page).catch(() => undefined);
  return page;
}

export async function movePageWithCloud(
  id: string,
  newParentId: string | null,
  newPosition: number
): Promise<Page | null> {
  const page = await moveLocalPage(id, newParentId, newPosition);
  if (page) await queuePageSubtreePush(page.id);
  return page;
}

export async function duplicatePageDeepWithCloud(
  sourceId: string,
  targetParentId: string | null
): Promise<Page | null> {
  const page = await duplicateLocalPageDeep(sourceId, targetParentId);
  if (page) await queuePageSubtreePush(page.id);
  return page;
}

export async function deletePageWithCloud(id: string): Promise<void> {
  let snapshot: Page | null = null;
  try {
    snapshot = await getPage(id);
  } catch {
    snapshot = null;
  }
  const deletedAt = new Date().toISOString();
  try {
    await deleteLocalPage(id);
  } finally {
    if (snapshot) {
      void queuePageCloudDelete(snapshot, deletedAt).catch(() => undefined);
    }
  }
}

async function queuePageCloudPush(page: Page): Promise<void> {
  const { queueCloudPagePush } = await loadPageAccountSyncModule();
  queueCloudPagePush(page);
}

async function queuePageCloudDelete(
  page: Page,
  deletedAt: string
): Promise<void> {
  const { queueCloudPageDelete } = await loadPageAccountSyncModule();
  queueCloudPageDelete(page, deletedAt);
}

async function queuePageSubtreePush(rootId: string): Promise<void> {
  const all = (await getAllPagesForSync()).filter((page) => !page.deleted_at);
  const byParent = new Map<string | null, Page[]>();
  for (const page of all) {
    const siblings = byParent.get(page.parent_id) ?? [];
    siblings.push(page);
    byParent.set(page.parent_id, siblings);
  }

  const root = all.find((page) => page.id === rootId);
  if (!root) return;
  const { queueCloudPagePush } = await loadPageAccountSyncModule();

  const stack = [root];
  while (stack.length > 0) {
    const page = stack.pop();
    if (!page) continue;
    queueCloudPagePush(page);
    stack.push(...(byParent.get(page.id) ?? []));
  }
}

async function persistOptimisticCreatedPage(
  seed: Page,
  opts?: CreatePageOptions
): Promise<void> {
  try {
    const page = await createLocalPage({
      ...opts,
      id: seed.id,
    });
    publishCreatedPageSnapshot(page, "local-metadata");
    clearPendingPageDraft(seed.id);
    void queuePageCloudPush(page).catch(() => undefined);
  } catch (error) {
    const existing = await getExistingOptimisticPage(seed.id);
    if (existing) {
      publishCreatedPageSnapshot(existing, "local-metadata");
      clearPendingPageDraft(seed.id);
      void queuePageCloudPush(existing).catch(() => undefined);
      return;
    }
    console.warn("Optimistic page local create failed; keeping draft fallback", error);
    rememberPendingPageDraft(seed);
    void queuePageCloudPush(seed).catch(() => undefined);
  }
}

async function getExistingOptimisticPage(pageId: string): Promise<Page | null> {
  try {
    return await getPage(pageId);
  } catch {
    return null;
  }
}

function publishCreatedPageSnapshot(
  page: Page,
  source: "optimistic-local" | "local-metadata"
): void {
  const store = useWorkspaceStore.getState();
  store.upsertPages([page]);
  writePageListHotCacheSnapshot({
    pages: useWorkspaceStore.getState().pages,
    source,
  });
  emitPageSnapshotsUpdated("cloud-push", [page]);
}

function createCloudDraftFallbackPage(opts?: CreatePageOptions): Page {
  const now = new Date().toISOString();
  const parent = opts?.parentId
    ? useWorkspaceStore.getState().getPageById(opts.parentId)
    : null;
  return {
    id: opts?.id ?? generateId(),
    owner_id: DEFAULT_OWNER_ID,
    parent_id: opts?.parentId ?? null,
    database_id: null,
    title: opts?.title ?? "",
    icon: opts?.icon ?? null,
    cover_url: null,
    content_yjs: null,
    content_text: "",
    properties: null,
    position: Date.now(),
    depth: parent ? parent.depth + 1 : opts?.parentId ? 1 : 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sync_version: 0,
  };
}
