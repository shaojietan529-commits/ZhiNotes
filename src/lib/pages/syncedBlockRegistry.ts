import type { Page } from "@/lib/utils/types";

export type SyncedBlockRegistryStatus =
  | "single-instance"
  | "same-page-duplicates"
  | "cross-page";

export interface SyncedBlockRegistryInstance {
  sync_id: string;
  page_id: string;
  page_title: string;
  block_ref: string;
  page_updated_at: string;
}

export interface SyncedBlockRegistryGroup {
  sync_id: string;
  status: SyncedBlockRegistryStatus;
  instances: number;
  pages: number;
  page_titles: string[];
  last_seen_at: string;
  next_action: string;
  refs: SyncedBlockRegistryInstance[];
}

export interface SyncedBlockRegistryReport {
  format: "zhinote-synced-block-registry";
  format_version: 1;
  report_status: "local-metadata-only";
  privacy_note: string;
  boundary: {
    reads_page_html_for_sync_ids: true;
    reads_page_titles: true;
    reads_synced_block_content: false;
    writes_workspace_data: false;
    uploads_data: false;
    connects_cloud_services: false;
    enables_ai: false;
    performs_cross_page_sync: false;
  };
  summary: {
    pages_scanned: number;
    pages_with_synced_blocks: number;
    synced_groups: number;
    synced_instances: number;
    cross_page_groups: number;
    same_page_duplicate_groups: number;
    single_instance_groups: number;
  };
  groups: SyncedBlockRegistryGroup[];
  next_steps: string[];
}

export function buildSyncedBlockRegistryReport(
  pages: Page[]
): SyncedBlockRegistryReport {
  const instances = pages.flatMap(extractSyncedBlockInstances);
  const pageIdsWithSyncedBlocks = new Set(
    instances.map((instance) => instance.page_id)
  );
  const groups = buildSyncedBlockGroups(instances);

  return {
    format: "zhinote-synced-block-registry",
    format_version: 1,
    report_status: "local-metadata-only",
    privacy_note:
      "这份同步块 registry 只在本地读取页面 HTML 中的 data-sync-id 和页面标题，用来列出同步块实例关系。它不读取同步块正文，不跨页面改写内容，不上传、不调用 AI、不连接云服务。",
    boundary: {
      reads_page_html_for_sync_ids: true,
      reads_page_titles: true,
      reads_synced_block_content: false,
      writes_workspace_data: false,
      uploads_data: false,
      connects_cloud_services: false,
      enables_ai: false,
      performs_cross_page_sync: false,
    },
    summary: {
      pages_scanned: pages.length,
      pages_with_synced_blocks: pageIdsWithSyncedBlocks.size,
      synced_groups: groups.length,
      synced_instances: instances.length,
      cross_page_groups: groups.filter((group) => group.status === "cross-page")
        .length,
      same_page_duplicate_groups: groups.filter(
        (group) => group.status === "same-page-duplicates"
      ).length,
      single_instance_groups: groups.filter(
        (group) => group.status === "single-instance"
      ).length,
    },
    groups,
    next_steps: [
      "先用 registry 确认哪些 sync id 已经跨页面复用，避免误把私人页面内容同步到不该出现的位置。",
      "本地-first 阶段只展示实例关系，不自动跨页面同步正文。",
      "云同步上线前需要定义原始块、实例列表、解除同步、删除语义、权限边界和冲突处理。",
    ],
  };
}

function extractSyncedBlockInstances(page: Page): SyncedBlockRegistryInstance[] {
  const html = page.content_text ?? "";
  if (!html.includes("synced-block") || !html.includes("data-sync-id")) {
    return [];
  }

  const syncIds = readSyncedBlockIds(html);
  return syncIds.map((syncId, index) => ({
    sync_id: syncId,
    page_id: page.id,
    page_title: page.title.trim() || "未命名页面",
    block_ref: `synced-block-${index + 1}`,
    page_updated_at: page.updated_at,
  }));
}

function readSyncedBlockIds(html: string) {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return Array.from(
      doc.body.querySelectorAll('[data-type="synced-block"][data-sync-id]')
    )
      .map((element) => element.getAttribute("data-sync-id")?.trim() ?? "")
      .filter(Boolean);
  }

  return Array.from(html.matchAll(/data-sync-id="([^"]+)"/g))
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean);
}

function buildSyncedBlockGroups(instances: SyncedBlockRegistryInstance[]) {
  const groups = new Map<string, SyncedBlockRegistryInstance[]>();
  for (const instance of instances) {
    const current = groups.get(instance.sync_id) ?? [];
    current.push(instance);
    groups.set(instance.sync_id, current);
  }

  return Array.from(groups.entries())
    .map(([syncId, groupInstances]) => {
      const pageTitles = unique(groupInstances.map((instance) => instance.page_title));
      const pageIds = unique(groupInstances.map((instance) => instance.page_id));
      const status = getGroupStatus(groupInstances, pageIds.length);

      return {
        sync_id: syncId,
        status,
        instances: groupInstances.length,
        pages: pageIds.length,
        page_titles: pageTitles,
        last_seen_at: groupInstances
          .map((instance) => instance.page_updated_at)
          .sort()
          .at(-1) ?? "",
        next_action: getGroupNextAction(status),
        refs: groupInstances,
      };
    })
    .sort((left, right) => {
      if (left.status !== right.status) {
        return getStatusSort(left.status) - getStatusSort(right.status);
      }
      return right.instances - left.instances;
    });
}

function getGroupStatus(
  instances: SyncedBlockRegistryInstance[],
  pages: number
): SyncedBlockRegistryStatus {
  if (pages > 1) return "cross-page";
  if (instances.length > 1) return "same-page-duplicates";
  return "single-instance";
}

function getGroupNextAction(status: SyncedBlockRegistryStatus) {
  if (status === "cross-page") {
    return "跨页面复用前先确认这些页面的权限和上下文是否一致；当前 registry 不同步正文。";
  }
  if (status === "same-page-duplicates") {
    return "同一页面内已复用，可继续用本地编辑器同步同一 sync id 的内容。";
  }
  return "单实例同步块暂时只是可复用候选；需要复制到其他位置后才形成真正复用关系。";
}

function getStatusSort(status: SyncedBlockRegistryStatus) {
  if (status === "cross-page") return 0;
  if (status === "same-page-duplicates") return 1;
  return 2;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
