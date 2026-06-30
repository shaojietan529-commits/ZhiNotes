import type { SyncLogSummary } from "@/lib/db/local/queries";
import type { StoredPageFile } from "@/lib/files/localStore";
import type { HotCachePolicyPlan } from "@/lib/sync/hotCachePolicyPlan";
import type { LocalFirstCloudInputPlan } from "@/lib/sync/localFirstCloudInputPlan";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";
import type { Database, Page } from "@/lib/utils/types";

export type CloudSourceOfTruthDomainStatus =
  | "cloud-master-ready"
  | "local-buffer-ready"
  | "needs-cloud-runtime"
  | "blocked";

export interface CloudSourceOfTruthPlanInput {
  pages: Page[];
  deletedPages: Page[];
  databases: Database[];
  files: StoredPageFile[];
  pageVersions: number;
  pageComments: number;
  blockComments: number;
  wikiLinks: number;
  workspaceSettings: number;
  accountSettings: number;
  moduleSettings: number;
  syncSummary: SyncLogSummary | null;
  workspaceIdentity: LocalWorkspaceIdentity | null;
  hotCachePolicyPlan: HotCachePolicyPlan;
  localFirstCloudInputPlan: LocalFirstCloudInputPlan;
  generatedAt?: string;
}

export interface CloudSourceOfTruthDomain {
  id: string;
  title: string;
  status: CloudSourceOfTruthDomainStatus;
  cloud_master: string;
  local_copy_policy: string;
  user_selectable_local_copy: boolean;
  local_evidence_count: number;
  cloud_ready_evidence: string;
  blocked_by: string[];
  next_action: string;
  excluded_from_local_copy: string[];
}

export interface CloudSourceOfTruthPlan {
  format: "zhinote-cloud-source-of-truth-plan";
  format_version: 1;
  plan_status: "metadata-only-cloud-master-map";
  architecture_target: "cloud-master-user-selected-local-copy";
  generated_at: string;
  privacy_boundary: string;
  boundary: {
    local_plan_only: true;
    reads_metadata_counts: true;
    reads_sync_queue_status: true;
    reads_workspace_link_metadata: true;
    reads_hot_cache_policy_metadata: true;
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    sends_network_requests: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_cache: false;
    clears_local_cache: false;
    enables_sync: false;
    enables_ai: false;
  };
  summary: {
    domains: number;
    cloud_master_ready: number;
    local_buffer_ready: number;
    needs_cloud_runtime: number;
    blocked: number;
    user_selectable_local_copy_domains: number;
    local_evidence_records: number;
    pending_sync_rows: number;
    hot_cache_user_selectable_policies: number;
    cloud_workspace_linked: boolean;
    can_switch_to_cloud_master_now: false;
    can_clear_local_cache_now: false;
  };
  domains: CloudSourceOfTruthDomain[];
  next_action: string;
}

export function buildCloudSourceOfTruthPlan(
  input: CloudSourceOfTruthPlanInput
): CloudSourceOfTruthPlan {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const cloudWorkspaceLinked =
    input.workspaceIdentity?.cloud_status === "linked-alpha";
  const pendingRows = input.syncSummary?.pending ?? 0;
  const hotCacheUserSelectablePolicies =
    input.hotCachePolicyPlan.summary.user_selectable;
  const inputPlanReady =
    input.localFirstCloudInputPlan.can_queue_background_upload;
  const inputPlanConfirmed =
    input.localFirstCloudInputPlan.can_claim_cloud_confirmed_now;

  const domains: CloudSourceOfTruthDomain[] = [
    domain({
      id: "pages",
      title: "笔记/Page",
      status: inputPlanReady ? "local-buffer-ready" : "needs-cloud-runtime",
      cloudMaster:
        "cloud.pages + cloud.page_properties + per-device ack cursor",
      localCopyPolicy:
        "最近 30/90 天、收藏、当前打开页面保留 metadata 和按需正文热副本；pending 编辑永不自动清理。",
      userSelectableLocalCopy: true,
      localEvidenceCount: input.pages.length + input.deletedPages.length,
      cloudReadyEvidence: inputPlanReady
        ? "页面队列可后台补传，本地输入可以先确认。"
        : "页面云队列尚未完整开启，当前仍只能作为本地缓冲。",
      blockedBy: compact([
        cloudWorkspaceLinked ? "" : "cloud workspace 未绑定",
        inputPlanReady ? "" : "页面同步/后台补传门禁未全通过",
      ]),
      nextAction:
        "保持编辑先本地确认；云端 ACK、冲突基线和恢复证明完成前不要清本地缓存。",
      excludedFromLocalCopy: [
        "raw editor dump in BroadcastChannel",
        "unacknowledged delete without tombstone",
        "tokens",
      ],
    }),
    domain({
      id: "databases",
      title: "数据库/Tracker",
      status: inputPlanReady ? "local-buffer-ready" : "needs-cloud-runtime",
      cloudMaster:
        "cloud.databases + cloud.database_fields + cloud.database_views + cloud.database_rows",
      localCopyPolicy:
        "schema、视图和最近打开行 metadata 可热缓存；行值分页按需读取；用户固定的数据库优先保留。",
      userSelectableLocalCopy: true,
      localEvidenceCount: input.databases.length,
      cloudReadyEvidence: inputPlanReady
        ? "数据库队列可后台补传，本地表格编辑可以先进入本地队列。"
        : "数据库同步尚未全域可用，不能宣称云端已确认。",
      blockedBy: compact([
        cloudWorkspaceLinked ? "" : "cloud workspace 未绑定",
        inputPlanReady ? "" : "数据库同步/统一 push API 未全通过",
      ]),
      nextAction:
        "继续用本地分页和 idle hydration 保证表格流畅；云端确认后再允许跨设备切换提示。",
      excludedFromLocalCopy: [
        "bulk row values without user opening",
        "private view filters in export",
        "failed pending rows",
      ],
    }),
    domain({
      id: "files",
      title: "文件/报告附件",
      status: "needs-cloud-runtime",
      cloudMaster:
        "private storage manifest + signed URL metadata + file checksum",
      localCopyPolicy:
        "默认只保留类型、大小、预览状态和用户选择的本地副本；大文件不自动常驻。",
      userSelectableLocalCopy: true,
      localEvidenceCount: input.files.length,
      cloudReadyEvidence:
        "私有文件存储策略和 presign guard 已定义，但真实文件同步仍关闭。",
      blockedBy: [
        "private bucket/RLS/signature TTL 未启用",
        "文件权限、审计和 owner confirmation 未完成",
      ],
      nextAction:
        "先完成私有文件 manifest、presign 审计和大文件成本策略，再允许文件上云。",
      excludedFromLocalCopy: [
        "file bytes unless user keeps local copy",
        "signed URLs",
        "raw extracted text",
      ],
    }),
    domain({
      id: "meetings-daily",
      title: "每日纪要/ZhiHui 日历",
      status: inputPlanReady ? "local-buffer-ready" : "needs-cloud-runtime",
      cloudMaster:
        "cloud.pages filtered by daily/meeting metadata indexes",
      localCopyPolicy:
        "当前月日历 metadata 默认热缓存；正文、会议链接、会议号、密码和转写按打开时读取。",
      userSelectableLocalCopy: true,
      localEvidenceCount: input.pages.length,
      cloudReadyEvidence:
        "当前已有本地热缓存和 optimistic local-first 创建流程；云端仍依赖 page ACK。",
      blockedBy: compact([
        inputPlanReady ? "" : "页面云队列未完全可用",
        pendingRows === 0 ? "" : "仍有待确认队列",
      ]),
      nextAction:
        "继续将日历首屏保持 metadata-first，并把跨设备日历一致性绑定到页面 ACK。",
      excludedFromLocalCopy: [
        "meeting join_url",
        "meeting id",
        "meeting passcode",
        "transcript body",
      ],
    }),
    domain({
      id: "comments-versions",
      title: "评论/版本历史",
      status:
        input.pageComments + input.blockComments + input.pageVersions > 0
          ? "needs-cloud-runtime"
          : "local-buffer-ready",
      cloudMaster: "cloud.comments + cloud.page_versions + replay ACK ledger",
      localCopyPolicy:
        "打开页面才加载相关评论和版本 metadata；正文/版本内容不做全局热缓存。",
      userSelectableLocalCopy: false,
      localEvidenceCount:
        input.pageComments + input.blockComments + input.pageVersions,
      cloudReadyEvidence:
        "已有评论/版本专用 replay contract，但 apply/replay route 仍关闭。",
      blockedBy: [
        "comment-version replay route 仍是 disabled guard",
        "权限、审计、retention 和 ACK ledger 未全量启用",
      ],
      nextAction:
        "先完成 row-id-only replay、权限检查和审计事件，再允许评论/版本跨设备同步。",
      excludedFromLocalCopy: [
        "comment body in list views",
        "full version snapshot unless page is open",
        "author private info",
      ],
    }),
    domain({
      id: "settings-preferences",
      title: "设置/模块偏好",
      status: cloudWorkspaceLinked ? "cloud-master-ready" : "local-buffer-ready",
      cloudMaster:
        "workspaces.settings + account_settings + module_settings metadata",
      localCopyPolicy:
        "侧边栏、热缓存选择、日历视图、页面视图偏好等设置可从云端主库重建本地缓存。",
      userSelectableLocalCopy: false,
      localEvidenceCount:
        input.workspaceSettings + input.accountSettings + input.moduleSettings,
      cloudReadyEvidence: cloudWorkspaceLinked
        ? "本机已绑定 cloud workspace，可保存/拉取部分 settings metadata。"
        : "本机还未绑定 cloud workspace，设置只能先留在本地。",
      blockedBy: compact([
        cloudWorkspaceLinked ? "" : "cloud workspace 未绑定",
      ]),
      nextAction:
        "继续把低风险 UI 偏好先纳入云端 settings，禁止上传页面正文或行值。",
      excludedFromLocalCopy: [
        "raw local cache dumps",
        "free-form note bodies",
        "tokens",
      ],
    }),
    domain({
      id: "sync-ledger",
      title: "同步账本/ACK",
      status:
        pendingRows === 0 && inputPlanConfirmed
          ? "cloud-master-ready"
          : "local-buffer-ready",
      cloudMaster: "cloud.sync_batches + cloud.sync_row_acks + device cursor",
      localCopyPolicy:
        "pending、failed、manual review 行在云端确认前永不自动清理；只保留状态、时间和失败原因。",
      userSelectableLocalCopy: false,
      localEvidenceCount: pendingRows,
      cloudReadyEvidence: inputPlanConfirmed
        ? "等待/失败/人工处理队列为 0，可以提示云端已确认。"
        : "仍需等待 durable ACK，不能提示云端已确认或清缓存。",
      blockedBy: compact([
        pendingRows === 0 ? "" : "sync_log 仍有 pending",
        inputPlanConfirmed ? "" : "durable cloud ACK 未证明",
      ]),
      nextAction:
        "优先完成统一 ACK ledger、幂等 replay 和失败重试，再扩大真实 push 覆盖。",
      excludedFromLocalCopy: [
        "raw payload bodies",
        "request body dumps",
        "secret values",
      ],
    }),
    domain({
      id: "permissions-audit-ai",
      title: "权限/审计/AI 输出",
      status: "blocked",
      cloudMaster:
        "cloud.permissions + cloud.audit_events + AI output retention table",
      localCopyPolicy:
        "只允许 metadata、确认回执和脱敏审计摘要进入本地；AI 输出保留策略需单独确认。",
      userSelectableLocalCopy: false,
      localEvidenceCount: input.wikiLinks,
      cloudReadyEvidence:
        "权限、审计和 AI 边界已有本地 contract，但 server enforcement 和 AI 执行仍关闭。",
      blockedBy: [
        "server-side permission enforcement 未启用",
        "audit event write/retention 未启用",
        "AI provider/payload/retention 需要 owner confirmation",
      ],
      nextAction:
        "先实现权限验证、审计事件写入和高风险确认，再讨论 AI 输出进入云端主库。",
      excludedFromLocalCopy: [
        "prompt text",
        "raw AI output without retention decision",
        "audit raw request bodies",
      ],
    }),
  ];

  const summary = summarize(domains, {
    pendingRows,
    hotCacheUserSelectablePolicies,
    cloudWorkspaceLinked,
  });

  return {
    format: "zhinote-cloud-source-of-truth-plan",
    format_version: 1,
    plan_status: "metadata-only-cloud-master-map",
    architecture_target: "cloud-master-user-selected-local-copy",
    generated_at: generatedAt,
    privacy_boundary:
      "Generated locally from metadata counts, sync queue status, workspace link metadata, hot-cache policy metadata, and local/cloud acknowledgement gates. It does not read page bodies, editor Yjs state, database row values, comment bodies, file names, file bytes, secrets, tokens, cookies, remote data, or AI payloads; it does not send network requests, write server data, upload workspace data, mutate local cache, clear cache, enable sync, or enable AI.",
    boundary: {
      local_plan_only: true,
      reads_metadata_counts: true,
      reads_sync_queue_status: true,
      reads_workspace_link_metadata: true,
      reads_hot_cache_policy_metadata: true,
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      sends_network_requests: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_cache: false,
      clears_local_cache: false,
      enables_sync: false,
      enables_ai: false,
    },
    summary,
    domains,
    next_action: getNextAction(summary),
  };
}

function domain(input: {
  id: string;
  title: string;
  status: CloudSourceOfTruthDomainStatus;
  cloudMaster: string;
  localCopyPolicy: string;
  userSelectableLocalCopy: boolean;
  localEvidenceCount: number;
  cloudReadyEvidence: string;
  blockedBy: string[];
  nextAction: string;
  excludedFromLocalCopy: string[];
}): CloudSourceOfTruthDomain {
  return {
    id: input.id,
    title: input.title,
    status: input.status,
    cloud_master: input.cloudMaster,
    local_copy_policy: input.localCopyPolicy,
    user_selectable_local_copy: input.userSelectableLocalCopy,
    local_evidence_count: input.localEvidenceCount,
    cloud_ready_evidence: input.cloudReadyEvidence,
    blocked_by: input.blockedBy,
    next_action: input.nextAction,
    excluded_from_local_copy: input.excludedFromLocalCopy,
  };
}

function summarize(
  domains: CloudSourceOfTruthDomain[],
  input: {
    pendingRows: number;
    hotCacheUserSelectablePolicies: number;
    cloudWorkspaceLinked: boolean;
  }
): CloudSourceOfTruthPlan["summary"] {
  return {
    domains: domains.length,
    cloud_master_ready: countByStatus(domains, "cloud-master-ready"),
    local_buffer_ready: countByStatus(domains, "local-buffer-ready"),
    needs_cloud_runtime: countByStatus(domains, "needs-cloud-runtime"),
    blocked: countByStatus(domains, "blocked"),
    user_selectable_local_copy_domains: domains.filter(
      (domain) => domain.user_selectable_local_copy
    ).length,
    local_evidence_records: domains.reduce(
      (total, domain) => total + domain.local_evidence_count,
      0
    ),
    pending_sync_rows: input.pendingRows,
    hot_cache_user_selectable_policies: input.hotCacheUserSelectablePolicies,
    cloud_workspace_linked: input.cloudWorkspaceLinked,
    can_switch_to_cloud_master_now: false,
    can_clear_local_cache_now: false,
  };
}

function countByStatus(
  domains: CloudSourceOfTruthDomain[],
  status: CloudSourceOfTruthDomainStatus
) {
  return domains.filter((domain) => domain.status === status).length;
}

function getNextAction(summary: CloudSourceOfTruthPlan["summary"]) {
  if (!summary.cloud_workspace_linked) {
    return "先完成 cloud workspace 绑定和 bootstrap proof；绑定前本地仍是缓冲层，不能宣称全域云端主库。";
  }
  if (summary.blocked > 0) {
    return "先处理权限、审计、AI 和文件存储这些 blocked 域；它们决定正式 Web 版能否安全上线。";
  }
  if (summary.pending_sync_rows > 0) {
    return "继续补传 pending queue，等待 durable ACK；ACK 前不要清理本地副本或提示可切换设备。";
  }
  return "继续推进统一 push/pull、冲突回放和 cache rebuild，使云端主库可以逐步替代本地主库。";
}

function compact(values: string[]) {
  return values.filter(Boolean);
}
