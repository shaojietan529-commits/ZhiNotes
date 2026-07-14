import type { PendingCloudDatabaseSyncStatus } from "@/lib/database/accountDatabaseSync";
import type { SyncLogSummary } from "@/lib/db/local/queries";
import type { PendingFileEmbedSyncStatus } from "@/lib/files/fileEmbedSyncQueue";
import type { PendingCloudPageSyncStatus } from "@/lib/pages/accountPageSync";

export type PendingDomainId =
  | "pages"
  | "databases"
  | "comments"
  | "versions"
  | "files"
  | "settings"
  | "permissions"
  | "audit"
  | "other";

export type PendingDomainRow = {
  id: PendingDomainId;
  label: string;
  detail: string;
  nextAction: string;
  pending: number;
  failed: number;
  inFlight: number;
  manualReview: number;
  total: number;
  lastChangeAt: string | null;
  tableNames: string[];
};

export type PendingDomainDefinition = {
  id: Exclude<PendingDomainId, "other">;
  label: string;
  detail: string;
  tableNames: string[];
  tablePrefixes?: string[];
};

export const PENDING_DOMAIN_DEFINITIONS: PendingDomainDefinition[] = [
  {
    id: "pages",
    label: "页面 / 每日纪要 / 会议页",
    detail: "页面树、每日纪要、会议页和页面关系的待上传变更。",
    tableNames: ["pages", "deleted_pages", "wiki_links", "page_links"],
    tablePrefixes: ["page_relation", "daily_", "meeting_page"],
  },
  {
    id: "databases",
    label: "数据库",
    detail: "数据库、字段、行、视图和关系字段的待上传变更。",
    tableNames: [
      "databases",
      "database_fields",
      "database_rows",
      "database_views",
      "database_relations",
    ],
    tablePrefixes: ["database_"],
  },
  {
    id: "comments",
    label: "评论",
    detail: "Page comment、block comment 和批注元数据的待上传变更。",
    tableNames: ["page_comments", "block_comments", "comments"],
    tablePrefixes: ["comment_"],
  },
  {
    id: "versions",
    label: "版本历史",
    detail: "页面版本、历史快照和回滚元数据的待上传变更。",
    tableNames: ["page_versions", "versions"],
    tablePrefixes: ["version_"],
  },
  {
    id: "files",
    label: "文件 / 报告",
    detail: "文件索引、报告附件和私有对象存储元数据的待上传变更。",
    tableNames: ["files", "uploaded_files", "page_files", "stored_files"],
    tablePrefixes: ["file_", "files_", "report_file"],
  },
  {
    id: "settings",
    label: "模块 / 侧边栏 / 偏好",
    detail: "模块顺序、侧边栏配置、热缓存选择和用户偏好的待上传变更。",
    tableNames: [
      "workspace_settings",
      "module_settings",
      "sidebar_settings",
      "sidebar_items",
      "user_preferences",
      "module_roots",
    ],
    tablePrefixes: ["setting_", "settings_", "module_", "sidebar_"],
  },
  {
    id: "permissions",
    label: "权限 / 共享",
    detail: "成员、角色、分享白名单和权限配置的待上传变更。",
    tableNames: [
      "permissions",
      "permission_roles",
      "shares",
      "workspace_members",
      "users",
      "accounts",
    ],
    tablePrefixes: ["permission_", "share_", "member_"],
  },
  {
    id: "audit",
    label: "审计 / 对账",
    detail: "同步审计、迁移对账和高风险动作收据的待上传变更。",
    tableNames: ["audit_events", "sync_audit", "migration_receipts"],
    tablePrefixes: ["audit_", "receipt_", "migration_"],
  },
];

export function buildPendingDomainRows(
  syncSummary: SyncLogSummary | null,
  pageStatus: PendingCloudPageSyncStatus,
  databaseStatus: PendingCloudDatabaseSyncStatus,
  fileStatus: PendingFileEmbedSyncStatus
): PendingDomainRow[] {
  const tableRows = syncSummary?.tables ?? [];
  const matchedTables = new Set<string>();

  const rows: PendingDomainRow[] = PENDING_DOMAIN_DEFINITIONS.map(
    (definition) => {
      const matchingTables = tableRows.filter((table) =>
        isPendingDomainTable(table.tableName, definition)
      );
      matchingTables.forEach((table) => matchedTables.add(table.tableName));

      return {
        id: definition.id,
        label: definition.label,
        detail: definition.detail,
        nextAction: "",
        pending: sumPendingTables(matchingTables, "pending"),
        failed: sumPendingTables(matchingTables, "failed"),
        inFlight: sumPendingTables(matchingTables, "inFlight"),
        manualReview: sumPendingTables(matchingTables, "manualReview"),
        total: sumPendingTables(matchingTables, "total"),
        lastChangeAt: latestPendingDomainChange(matchingTables),
        tableNames: matchingTables.map((table) => table.tableName),
      };
    }
  );

  const unmatchedTables = tableRows.filter(
    (table) => !matchedTables.has(table.tableName)
  );
  if (unmatchedTables.length > 0) {
    rows.push({
      id: "other",
      label: "其他本地表",
      detail: "尚未归入固定数据域的 pending 变更，用来发现新的上云范围。",
      nextAction: "",
      pending: sumPendingTables(unmatchedTables, "pending"),
      failed: sumPendingTables(unmatchedTables, "failed"),
      inFlight: sumPendingTables(unmatchedTables, "inFlight"),
      manualReview: sumPendingTables(unmatchedTables, "manualReview"),
      total: sumPendingTables(unmatchedTables, "total"),
      lastChangeAt: latestPendingDomainChange(unmatchedTables),
      tableNames: unmatchedTables.map((table) => table.tableName),
    });
  }

  return mergeCorePendingDomainRows(rows, pageStatus, databaseStatus, fileStatus)
    .map(withPendingDomainNextAction)
    .sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      if (b.total !== a.total) return b.total - a.total;
      return getPendingDomainDefinitionOrder(a.id) -
        getPendingDomainDefinitionOrder(b.id);
    });
}

export function summarizeSyncSummaryTables(
  syncSummary: SyncLogSummary | null,
  tableNames: string[]
) {
  const tableNameSet = new Set(tableNames);
  const matchingTables =
    syncSummary?.tables.filter((table) => tableNameSet.has(table.tableName)) ??
    [];
  return {
    pending: sumPendingTables(matchingTables, "pending"),
    failed: sumPendingTables(matchingTables, "failed"),
    inFlight: sumPendingTables(matchingTables, "inFlight"),
    manualReview: sumPendingTables(matchingTables, "manualReview"),
    total: sumPendingTables(matchingTables, "total"),
    lastChangeAt: latestPendingDomainChange(matchingTables),
  };
}

function mergeCorePendingDomainRows(
  rows: PendingDomainRow[],
  pageStatus: PendingCloudPageSyncStatus,
  databaseStatus: PendingCloudDatabaseSyncStatus,
  fileStatus: PendingFileEmbedSyncStatus
): PendingDomainRow[] {
  return rows.map((row) => {
    if (row.id === "pages") {
      return mergePendingDomainRowWithCoreStatus(row, {
        pending: pageStatus.pending + pageStatus.queued,
        failed: pageStatus.failed,
        manualReview: pageStatus.manualReviewCount,
        lastChangeAt:
          pageStatus.lastFailureAt ??
          pageStatus.oldestPendingQueuedAt ??
          pageStatus.lastAttemptAt ??
          pageStatus.lastSyncAt,
        tableNames: ["pending_page_cloud_push", "pages"],
      });
    }
    if (row.id === "databases") {
      return mergePendingDomainRowWithCoreStatus(row, {
        pending:
          databaseStatus.pending +
          databaseStatus.queued +
          databaseStatus.syncLogPending,
        failed: databaseStatus.failed,
        manualReview: databaseStatus.manualReviewCount,
        lastChangeAt:
          databaseStatus.lastFailureAt ??
          databaseStatus.oldestPendingQueuedAt ??
          databaseStatus.lastAttemptAt ??
          databaseStatus.lastSyncAt,
        tableNames: ["pending_database_cloud_push", "database_sync_log"],
      });
    }
    if (row.id === "files") {
      return mergePendingDomainRowWithCoreStatus(row, {
        pending: fileStatus.pending,
        failed: fileStatus.failed,
        manualReview: fileStatus.manualReviewCount,
        lastChangeAt:
          fileStatus.lastFailureAt ??
          fileStatus.oldestPendingQueuedAt ??
          fileStatus.lastAttemptAt,
        tableNames: ["file_embed_sync_queue"],
      });
    }
    return row;
  });
}

function mergePendingDomainRowWithCoreStatus(
  row: PendingDomainRow,
  status: {
    pending: number;
    failed: number;
    manualReview: number;
    lastChangeAt: string | null;
    tableNames: string[];
  }
): PendingDomainRow {
  const pending = Math.max(row.pending, status.pending);
  const failed = Math.max(row.failed, status.failed);
  const manualReview = Math.max(row.manualReview, status.manualReview);
  return {
    ...row,
    pending,
    failed,
    manualReview,
    total: Math.max(row.total, pending + failed + manualReview + row.inFlight),
    lastChangeAt: latestNullableDate(row.lastChangeAt, status.lastChangeAt),
    tableNames: [...new Set([...row.tableNames, ...status.tableNames])],
  };
}

function withPendingDomainNextAction(row: PendingDomainRow): PendingDomainRow {
  return {
    ...row,
    nextAction: getPendingDomainNextAction(row),
  };
}

function getPendingDomainNextAction(row: PendingDomainRow): string {
  if (row.manualReview > 0) {
    return "先导出人工复核包，确认样本 id/key 和最近失败原因。";
  }
  if (row.failed > 0) {
    return "先点击补传待上传；如果继续失败，再查看详细队列。";
  }
  if (row.inFlight > 0) {
    return "正在上传，先保持页面打开，等待 ACK 回写。";
  }
  if (row.pending > 0) {
    return row.id === "pages"
      ? "先补传页面输入；本地写作可以继续。"
      : row.id === "databases"
        ? "先补传数据库变更；本地编辑可以继续。"
        : "等待后台补传；不要在队列清零前重建缓存。";
  }
  return "当前无需处理。";
}

function isPendingDomainTable(
  tableName: string,
  definition: PendingDomainDefinition
) {
  const normalized = tableName.toLowerCase();
  return (
    definition.tableNames.includes(normalized) ||
    (definition.tablePrefixes ?? []).some((prefix) =>
      normalized.startsWith(prefix)
    )
  );
}

function sumPendingTables(
  tables: SyncLogSummary["tables"],
  key: "pending" | "failed" | "inFlight" | "manualReview" | "total"
) {
  return tables.reduce((total, table) => total + table[key], 0);
}

function latestPendingDomainChange(tables: SyncLogSummary["tables"]) {
  return tables.reduce<string | null>((latest, table) => {
    if (!table.lastChangeAt) return latest;
    if (!latest) return table.lastChangeAt;
    return table.lastChangeAt > latest ? table.lastChangeAt : latest;
  }, null);
}

function latestNullableDate(
  first: string | null,
  second: string | null
): string | null {
  if (!first) return second;
  if (!second) return first;
  return first > second ? first : second;
}

function getPendingDomainDefinitionOrder(id: PendingDomainId) {
  const index = PENDING_DOMAIN_DEFINITIONS.findIndex((item) => item.id === id);
  return index === -1 ? PENDING_DOMAIN_DEFINITIONS.length : index;
}
