import type { SyncLogSummary } from "@/lib/db/local/queries";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type CloudMasterDomainStatus =
  | "cloud-primary-ready"
  | "cloud-primary-partial"
  | "migration-needed"
  | "local-only"
  | "not-covered";

export type CloudMasterGateStatus =
  | "ready"
  | "partial"
  | "blocked"
  | "planned";

export interface CloudMasterReconcileInput {
  activePages: number;
  deletedPages: number;
  databases: number;
  uploadedFiles: number;
  pageVersions: number;
  pageComments: number;
  blockComments: number;
  wikiLinks: number;
  workspaceSettings: number;
  accountSettings: number;
  moduleSettings: number;
  syncSummary: SyncLogSummary | null;
  workspaceIdentity: LocalWorkspaceIdentity | null;
  pageSyncEnabled: boolean;
  databaseSyncEnabled: boolean;
}

export interface CloudMasterDomain {
  id: string;
  title: string;
  count: number | null;
  status: CloudMasterDomainStatus;
  cloud_scope: string;
  local_cache_scope: string;
  pending_rule: string;
  current_gap: string;
  next_action: string;
}

export interface CloudMasterCachePolicy {
  id: string;
  title: string;
  status: CloudMasterGateStatus;
  detail: string;
}

export interface CloudMasterMigrationGate {
  id: string;
  title: string;
  status: CloudMasterGateStatus;
  evidence: string;
  next_action: string;
}

export interface CloudMasterReconcileReport {
  format: "zhinote-cloud-master-reconcile-report";
  format_version: 1;
  architecture_target: "cloud-master-local-hot-cache";
  report_status: "local-audit-only";
  privacy_boundary: string;
  verdict: "not-ready";
  summary: {
    domains: number;
    cloud_primary_ready: number;
    cloud_primary_partial: number;
    migration_needed: number;
    local_only: number;
    not_covered: number;
    pending_sync_rows: number;
    local_cache_records: number;
    page_sync_enabled: boolean;
    database_sync_enabled: boolean;
    cloud_workspace_linked: boolean;
  };
  sync_rules: {
    cloud_is_master: true;
    local_is_hot_cache: true;
    ordinary_sync_pending_only: true;
    local_cache_can_be_rebuilt: true;
    local_writes_first_hit_cache_then_pending_queue: true;
    cloud_wins_by_default_except_unuploaded_pending_edits: true;
  };
  domains: CloudMasterDomain[];
  cache_policies: CloudMasterCachePolicy[];
  migration_gates: CloudMasterMigrationGate[];
}

function countByStatus(
  domains: CloudMasterDomain[],
  status: CloudMasterDomainStatus
): number {
  return domains.filter((domain) => domain.status === status).length;
}

export function buildCloudMasterReconcileReport(
  input: CloudMasterReconcileInput
): CloudMasterReconcileReport {
  const totalComments = input.pageComments + input.blockComments;
  const localCacheRecords =
    input.activePages +
    input.deletedPages +
    input.databases +
    input.uploadedFiles +
    input.pageVersions +
    totalComments +
    input.wikiLinks;

  const pageStatus: CloudMasterDomainStatus = input.pageSyncEnabled
    ? "cloud-primary-partial"
    : "migration-needed";
  const databaseStatus: CloudMasterDomainStatus = input.databaseSyncEnabled
    ? "cloud-primary-ready"
    : "migration-needed";

  const domains: CloudMasterDomain[] = [
    {
      id: "pages",
      title: "页面和笔记正文",
      count: input.activePages + input.deletedPages,
      status: pageStatus,
      cloud_scope: "标题、正文 HTML、层级、属性、图标、封面、回收站标记",
      local_cache_scope: "最近打开和本机编辑中的页面缓存，可按云端重建",
      pending_rule: "普通同步只上传 pending page ids，不全量提升本地缓存",
      current_gap: input.pageSyncEnabled
        ? "页面主数据已按云端主库推进；评论、版本和文件仍在独立域处理"
        : "页面云同步当前关闭或未登录，仍需要迁移前对账",
      next_action:
        "用云端 manifest 对账本地页面数，迁移后从云端重建一次本机缓存",
    },
    {
      id: "daily-notes",
      title: "每日纪要",
      count: input.activePages,
      status: pageStatus,
      cloud_scope: "每日纪要作为页面的一种视图，跟随页面主库同步",
      local_cache_scope: "最近月份和用户指定月份常驻本地，日历格子读轻量 metadata",
      pending_rule: "新纪要先写本地页面缓存和 pending 队列，再后台上传",
      current_gap:
        "需要把 Notion 导入后的每日纪要做日期索引对账，确认每一天都映射到正确页面",
      next_action:
        "在迁移页列出按日期聚合的云端/本地数量和缺失日期，不直接上传正文",
    },
    {
      id: "meetings",
      title: "会议和 ZhiHui 日历",
      count: input.activePages,
      status: pageStatus,
      cloud_scope: "会议记录、日历 metadata 和页面正文最终进入页面主库",
      local_cache_scope: "当前月份和最近会议常驻本地，打开详情再拉正文",
      pending_rule: "导入会议先产生本地页面和 pending 记录，后台确认云端写入",
      current_gap:
        "会议导入已能进入页面/日历，但还需要云端 manifest 对账和失败重试证明",
      next_action: "把会议日历缓存纳入迁移对账的日期窗口检查",
    },
    {
      id: "databases",
      title: "数据库、字段、视图和行值",
      count: input.databases,
      status: databaseStatus,
      cloud_scope: "database / field / view / row records",
      local_cache_scope: "打开过的数据库和视图配置缓存在本机，可按云端重建",
      pending_rule: "只上传 pending database keys，按 key 精确读取，不扫全库",
      current_gap: input.databaseSyncEnabled
        ? "数据库主数据已按云端主库推进"
        : "数据库同步当前关闭或未登录，仍需要迁移前对账",
      next_action:
        "迁移页需要显示每个数据库的字段/视图/行数和云端确认数",
    },
    {
      id: "files",
      title: "文件和附件",
      count: input.uploadedFiles,
      status: input.uploadedFiles > 0 ? "local-only" : "not-covered",
      cloud_scope: "未来应进入私有对象存储，页面只保存引用、checksum 和权限",
      local_cache_scope: "大文件默认只缓存预览和最近打开的原件",
      pending_rule: "文件字节不能混入通用同步队列，必须走私有文件上传确认",
      current_gap: "私有文件存储和 signed URL 仍未正式启用",
      next_action: "先做文件 manifest、checksum、大小和 MIME 类型对账，再启用上传",
    },
    {
      id: "comments",
      title: "页面评论和 block comments",
      count: totalComments,
      status: totalComments > 0 ? "local-only" : "not-covered",
      cloud_scope: "评论正文、锚点、resolved 状态和更新时间",
      local_cache_scope: "打开页面时缓存相关评论，列表页不预拉正文",
      pending_rule: "评论编辑应进入独立 pending 队列，不能依附页面正文覆盖",
      current_gap: "页面同步明确排除了评论，需要新增云端评论表和回放规则",
      next_action: "把 page_comments 和 block_comments 加入云端主库合同",
    },
    {
      id: "versions",
      title: "版本历史",
      count: input.pageVersions,
      status: input.pageVersions > 0 ? "local-only" : "not-covered",
      cloud_scope: "版本标题、摘要、正文快照、版本号和创建时间",
      local_cache_scope: "最近版本可缓存，长期版本从云端按需拉取",
      pending_rule: "版本只追加，不应被普通页面更新覆盖",
      current_gap: "页面同步明确排除了版本历史，需要只追加云端表",
      next_action: "建立 append-only version migration 和回滚检查",
    },
    {
      id: "wiki-links",
      title: "知识链接和 backlinks",
      count: input.wikiLinks,
      status: input.wikiLinks > 0 ? "migration-needed" : "not-covered",
      cloud_scope: "wiki_links、source/target page id 和软删除状态",
      local_cache_scope: "当前页面 backlinks 可缓存，跨库图谱按需拉取",
      pending_rule: "链接更新只上传 link records，不重写目标页面",
      current_gap: "链接关系存在本地 sync_log，但未纳入 account page sync",
      next_action: "把 wiki_links 纳入云端关系表和图谱索引对账",
    },
    {
      id: "module-config",
      title: "模块、侧边栏和用户偏好",
      count:
        input.workspaceSettings + input.accountSettings + input.moduleSettings,
      status: "cloud-primary-partial",
      cloud_scope:
        "workspace_settings、account_settings、module_settings：侧边栏顺序、图标/名称自定义、收藏、页面视图偏好、搜索、日历、ZhiHui 状态、热缓存选择、账号偏好和模块 pin/layout",
      local_cache_scope:
        "UI 配置本机即时生效，workspace/account/module 三类 setting 都可按云端重建",
      pending_rule:
        "配置变更走 settings pending queue；只上传白名单 setting key，不上传缓存快照",
      current_gap:
        "workspace_settings 已接入云端读写；account_settings 和 module_settings 已有本地账本与 pending-only 合同，但真实云端 API 仍需启用",
      next_action:
        "把账号级偏好和模块运行态逐项接入云端 settings API，并在对账页显示每个 setting key 的云端确认状态",
    },
    {
      id: "permissions",
      title: "权限、分享和审计",
      count: null,
      status: "migration-needed",
      cloud_scope: "workspace membership、角色、分享名单、审计事件和高风险确认收据",
      local_cache_scope: "权限结果可短缓存，但必须由服务端判定",
      pending_rule: "权限和审计不能由本地离线队列静默补写",
      current_gap: "权限合同和禁用 API 已存在，服务端强制仍未启用",
      next_action: "上线前完成 server-side permission check、audit event 和 RLS proof",
    },
  ];

  const cachePolicies: CloudMasterCachePolicy[] = [
    {
      id: "recent-hot-cache",
      title: "最近内容热缓存",
      status: "planned",
      detail: "默认缓存最近 30 天、最近打开页面、当前月份日历和最近数据库视图。",
    },
    {
      id: "user-selected-cache",
      title: "用户手动选择常驻本地",
      status: "planned",
      detail: "后续允许选择重点公司、收藏页面、当前项目和指定数据库常驻本地。",
    },
    {
      id: "pending-queue",
      title: "本地输入待上传队列",
      status: input.syncSummary?.pending ? "partial" : "ready",
      detail: `${input.syncSummary?.pending ?? 0} 条 pending sync_log；本地输入先落缓存再后台上传。`,
    },
    {
      id: "rebuildable-cache",
      title: "本地缓存可重建",
      status: "partial",
      detail:
        "页面、数据库和常用 workspace_settings 已有重建入口；文件、评论、版本以及剩余 account/module settings 还需要纳入同一策略。",
    },
  ];

  const migrationGates: CloudMasterMigrationGate[] = [
    {
      id: "cloud-workspace-linked",
      title: "云工作区连接",
      status: input.workspaceIdentity?.cloud_workspace_id ? "partial" : "blocked",
      evidence: input.workspaceIdentity?.cloud_workspace_id
        ? `已记录云工作区 ${input.workspaceIdentity.cloud_workspace_id}`
        : "尚未连接云工作区，不能开始真实迁移",
      next_action: "先完成账号登录、workspace bootstrap 和本地连接收据",
    },
    {
      id: "pending-only-sync",
      title: "普通同步 pending-only",
      status: "ready",
      evidence:
        "页面和数据库普通同步已收紧为只上传显式 pending 变更，本地旧缓存不能自动覆盖云端",
      next_action: "保持这条规则作为迁移前后验证项",
    },
    {
      id: "cloud-manifest-compare",
      title: "云端 manifest 对账",
      status: "blocked",
      evidence: "还没有按数据域生成云端 manifest 并和本地数量逐项比较",
      next_action: "新增只读 manifest API，返回各域 counts、watermark 和缺失 id",
    },
    {
      id: "dry-run-migration",
      title: "迁移 dry-run",
      status: "blocked",
      evidence: "真实迁移前还不能证明幂等、断点续传、重试和回滚",
      next_action: "先在 disposable workspace 跑 dry-run，只写空测试数据",
    },
    {
      id: "post-migration-cache-rebuild",
      title: "迁移后重建本机缓存",
      status: "planned",
      evidence: "页面和数据库已有重建入口，但全域数据还未覆盖",
      next_action: "迁移完成后清本机缓存并从云端重建，作为验收证明",
    },
  ];

  return {
    format: "zhinote-cloud-master-reconcile-report",
    format_version: 1,
    architecture_target: "cloud-master-local-hot-cache",
    report_status: "local-audit-only",
    privacy_boundary:
      "This report reads local metadata counts and sync state only. It does not read page body text, comment bodies, file bytes, token values, or upload data.",
    verdict: "not-ready",
    summary: {
      domains: domains.length,
      cloud_primary_ready: countByStatus(domains, "cloud-primary-ready"),
      cloud_primary_partial: countByStatus(domains, "cloud-primary-partial"),
      migration_needed: countByStatus(domains, "migration-needed"),
      local_only: countByStatus(domains, "local-only"),
      not_covered: countByStatus(domains, "not-covered"),
      pending_sync_rows: input.syncSummary?.pending ?? 0,
      local_cache_records: localCacheRecords,
      page_sync_enabled: input.pageSyncEnabled,
      database_sync_enabled: input.databaseSyncEnabled,
      cloud_workspace_linked: Boolean(input.workspaceIdentity?.cloud_workspace_id),
    },
    sync_rules: {
      cloud_is_master: true,
      local_is_hot_cache: true,
      ordinary_sync_pending_only: true,
      local_cache_can_be_rebuilt: true,
      local_writes_first_hit_cache_then_pending_queue: true,
      cloud_wins_by_default_except_unuploaded_pending_edits: true,
    },
    domains,
    cache_policies: cachePolicies,
    migration_gates: migrationGates,
  };
}
