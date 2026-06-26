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

export interface CloudMasterMigrationCheck {
  id: string;
  domain_id: string;
  title: string;
  status: CloudMasterGateStatus;
  cloud_evidence_required: string;
  local_evidence_required: string;
  pending_queue_rule: string;
  rebuild_proof_required: string;
  duplicate_risk: string;
  missing_risk: string;
  stale_cache_risk: string;
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
    migration_checks: number;
    migration_checks_blocked: number;
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
  migration_checks: CloudMasterMigrationCheck[];
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
      status: "partial",
      detail:
        "默认缓存最近 30 天、当前月份每日纪要、当前月份会议日历和最近数据库视图；预热只生成 metadata/route 目标，不读取正文或数据库行值。",
    },
    {
      id: "user-selected-cache",
      title: "用户手动选择常驻本地",
      status: "partial",
      detail:
        "已允许收藏页面和重点公司、当前项目、当前月份会议日历、当前月份每日纪要、打开过的数据库视图和指定数据库常驻本地；这些选择保存为 workspace_settings.hot_cache_preferences，只上传 setting metadata，不上传本地缓存。",
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
        "页面、数据库、hot_cache_preferences 和常用 workspace_settings 已有重建入口；文件、评论、版本以及剩余 account/module settings 还需要纳入同一策略。",
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

  const migrationChecks: CloudMasterMigrationCheck[] = [
    {
      id: "check-pages",
      domain_id: "pages",
      title: "页面和笔记正文 dry-run",
      status: input.pageSyncEnabled ? "partial" : "blocked",
      cloud_evidence_required:
        "云端 page manifest：page id、parent id、updated_at、tombstone、body checksum，不返回正文。",
      local_evidence_required:
        "本地 page manifest：active/deleted 数量、层级边、updated_at watermark 和 body checksum，不读取正文。",
      pending_queue_rule:
        "开始迁移 dry-run 前，页面 pending 队列必须先补传或明确冻结；普通同步仍只能上传 pending page ids。",
      rebuild_proof_required:
        "清空本地页面缓存后，从云端 manifest 重建标题、层级、属性和回收站状态，并确认数量一致。",
      duplicate_risk:
        "重复风险：同一 Notion 导入页可能被本地旧 id 和云端新 id 同时保留，需要 stable source key 去重。",
      missing_risk:
        "遗漏风险：软删除页面、子页面和封面 metadata 容易漏计，必须单独列 tombstone 和 parent edge。",
      stale_cache_risk:
        "旧缓存覆盖风险：本地旧页面只能作为待上传候选，不能绕过 pending 队列直接覆盖云端。",
      next_action:
        "先做页面 manifest 对账和 disposable workspace dry-run，再开放真实迁移按钮。",
    },
    {
      id: "check-daily-notes",
      domain_id: "daily-notes",
      title: "每日纪要日期索引 dry-run",
      status: input.pageSyncEnabled ? "partial" : "blocked",
      cloud_evidence_required:
        "云端 daily index：日期、page id、title、updated_at、checksum，只返回 metadata。",
      local_evidence_required:
        "本地 daily index：按日期聚合的页面数量、无日期页面、重复日期页面和待上传 page ids。",
      pending_queue_rule:
        "新建或改期纪要必须先进入页面 pending 队列；迁移不能扫描本地缓存全量上传。",
      rebuild_proof_required:
        "从云端 daily index 重建月历，刷新后当前月和历史月数量一致。",
      duplicate_risk:
        "重复风险：同一天多个 Notion 导入纪要要保留多条，不能被日期唯一键误合并。",
      missing_risk:
        "遗漏风险：标题含日期但属性缺日期的纪要会掉出月历，需要列入待确认清单。",
      stale_cache_risk:
        "旧缓存覆盖风险：本地旧日期索引不能覆盖云端较新的日期属性。",
      next_action:
        "在对账页加入按日期的云端/本地数量差异，再做只读 dry-run 报告。",
    },
    {
      id: "check-meetings",
      domain_id: "meetings",
      title: "会议和 ZhiHui 日历 dry-run",
      status: input.pageSyncEnabled ? "partial" : "blocked",
      cloud_evidence_required:
        "云端 meeting manifest：date、time、platform、organizer、page id、updated_at，不返回会议正文、链接、会议号或密码。",
      local_evidence_required:
        "本地 meeting manifest：按日期聚合的会议 metadata、导入来源和 pending ids。",
      pending_queue_rule:
        "会议导入先写本地页面和 pending 记录；会议链接、会议号、密码不得进入导出的对账报告。",
      rebuild_proof_required:
        "从云端 meeting manifest 重建当前月会议日历，点击详情再按需拉正文。",
      duplicate_risk:
        "重复风险：同一邀请多次导入可能产生多个页面，需要 source hash 去重但保留人工拆分。",
      missing_risk:
        "遗漏风险：无时间、跨时区或标题识别失败的会议会落到错误日期，需要人工确认桶。",
      stale_cache_risk:
        "旧缓存覆盖风险：本地旧会议 metadata 不能覆盖云端较新的手工修正。",
      next_action:
        "补会议 manifest 的只读差异清单，再把失败重试状态纳入对账。",
    },
    {
      id: "check-databases",
      domain_id: "databases",
      title: "数据库字段/视图/行值 dry-run",
      status: input.databaseSyncEnabled ? "partial" : "blocked",
      cloud_evidence_required:
        "云端 database manifest：database id、field count、view count、row count、schema checksum，不返回 row values。",
      local_evidence_required:
        "本地 database manifest：数据库、字段、视图、行数量和 schema checksum，不读取单元格内容。",
      pending_queue_rule:
        "只上传 pending database keys；迁移不能把本地 IndexedDB 的数据库缓存整库提升为云端。",
      rebuild_proof_required:
        "清空本地数据库缓存后，从云端重建 schema/view metadata，打开数据库再按需加载行。",
      duplicate_risk:
        "重复风险：同名数据库或复制出来的数据库不能靠 title 去重，必须用 id/source key。",
      missing_risk:
        "遗漏风险：隐藏视图、公式字段、rollup/relation metadata 和删除 tombstone 必须纳入 manifest。",
      stale_cache_risk:
        "旧缓存覆盖风险：本地旧 schema 不能覆盖云端较新的字段重命名或视图规则。",
      next_action:
        "先完成 metadata-only schema manifest，对 row values 单独做 owner-gated 迁移。",
    },
    {
      id: "check-files",
      domain_id: "files",
      title: "文件和附件 dry-run",
      status: input.uploadedFiles > 0 ? "blocked" : "planned",
      cloud_evidence_required:
        "云端 file manifest：object id、page id、filename、size、mime、checksum、created_at，不返回文件字节。",
      local_evidence_required:
        "本地 file manifest：IndexedDB 文件记录数量、size、mime、checksum readiness，不读取文件内容。",
      pending_queue_rule:
        "文件字节必须走独立私有上传确认，不能混入普通 sync_log 或对账导出。",
      rebuild_proof_required:
        "从云端 file manifest 重建页面附件引用，只有用户打开时才取 signed URL。",
      duplicate_risk:
        "重复风险：同名文件多次导入要用 checksum + page id 区分，不能只按文件名去重。",
      missing_risk:
        "遗漏风险：HTML 报告、PDF、Excel、Word、PPT 和归档文件的 preview receipt 要逐类计数。",
      stale_cache_risk:
        "旧缓存覆盖风险：本地旧文件 receipt 不能覆盖云端对象存储中的新 checksum。",
      next_action:
        "先补 metadata-only file manifest 和 checksum readiness，再设计 owner-gated 上传。",
    },
    {
      id: "check-comments-versions",
      domain_id: "comments",
      title: "评论和版本历史 dry-run",
      status:
        totalComments > 0 || input.pageVersions > 0 ? "blocked" : "planned",
      cloud_evidence_required:
        "云端 comment/version manifest：page id、anchor id、version number、updated_at、checksum，不返回评论正文或版本正文。",
      local_evidence_required:
        "本地 comment/version manifest：评论数量、block anchor 数量、版本数量和 append-only watermark。",
      pending_queue_rule:
        "评论编辑和版本追加必须有独立 pending 队列；不能依附页面正文覆盖。",
      rebuild_proof_required:
        "打开页面时从云端按需恢复评论和版本索引，长期正文快照不进列表预取。",
      duplicate_risk:
        "重复风险：版本历史只能 append-only，重跑迁移要按 page id + version number 幂等。",
      missing_risk:
        "遗漏风险：已 resolved 评论、block-level 评论和旧版本摘要不能只按页面计数推断。",
      stale_cache_risk:
        "旧缓存覆盖风险：本地旧评论状态不能覆盖云端较新的 resolved/open 状态。",
      next_action:
        "新增评论/版本 manifest 合同，再做 append-only dry-run。",
    },
    {
      id: "check-settings-permissions",
      domain_id: "module-config",
      title: "设置、权限和审计 dry-run",
      status: "partial",
      cloud_evidence_required:
        "云端 settings/permission manifest：setting key、owner、updated_at、role count、audit watermark，不返回 token 或隐私值。",
      local_evidence_required:
        "本地 settings manifest：workspace/account/module setting key 数量、pending rows 和允许白名单。",
      pending_queue_rule:
        "设置只上传白名单 key；权限和审计不能由本地离线队列静默补写。",
      rebuild_proof_required:
        "登出/清缓存后，从云端恢复侧边栏、热缓存偏好、模块 pin/layout 和账号显示名。",
      duplicate_risk:
        "重复风险：同一个设置 key 在 workspace/account/module 三层要按 scope 区分。",
      missing_risk:
        "遗漏风险：侧边栏顺序、图标、名称、用户偏好、分享名单和审计收据都要逐项覆盖。",
      stale_cache_risk:
        "旧缓存覆盖风险：本地旧 UI 设置不能覆盖云端较新的多端设置。",
      next_action:
        "补 account/module settings 的云端确认状态，再把 permission proof 纳入上线 gate。",
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
      migration_checks: migrationChecks.length,
      migration_checks_blocked: migrationChecks.filter(
        (check) => check.status === "blocked"
      ).length,
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
    migration_checks: migrationChecks,
  };
}
