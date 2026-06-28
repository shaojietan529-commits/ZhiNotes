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
import type { Page } from "@/lib/utils/types";

type CreatePageOptions = Parameters<typeof createLocalPage>[0];
type UpdatePageOptions = Parameters<typeof updateLocalPage>[1];

const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync");

export async function createPageWithCloud(
  opts?: CreatePageOptions
): Promise<Page> {
  const page = await createLocalPage(opts);
  void queuePageCloudPush(page).catch(() => undefined);
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
