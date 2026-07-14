import type { AccountLocalUseReadiness } from "@/lib/sync/accountLocalUseReadiness";

export type DevelopmentStabilitySurfaceStatus =
  | "stable-use"
  | "guarded"
  | "experimental";

export interface DevelopmentStabilitySurface {
  id: string;
  title: string;
  route: string;
  status: DevelopmentStabilitySurfaceStatus;
  reason: string;
  guarantees: string[];
  next_action: string;
  route_smoke_protected: boolean;
}

export interface DevelopmentStabilityOperatingMode {
  status: "stable-use-active";
  label: "稳定使用模式";
  user_can_continue_work: true;
  active_development_can_continue: true;
  production_interruptions_should_be_batched: true;
  experimental_changes_go_to_staging_first: true;
  local_input_remains_available: true;
  local_pending_queue_preserved_during_development: true;
  account_session_must_not_be_cleared_by_sync_failures: true;
  sync_failures_show_retry_state_not_sign_out: true;
  upload_blocks_do_not_block_local_writing: true;
  safe_to_use_routes: string[];
  blocked_without_owner_gate: string[];
  next_action: string;
}

export interface DevelopmentStabilityPlan {
  format: "zhinote-development-stability-plan";
  format_version: 1;
  report_status: "metadata-only-development-guardrail";
  development_channel: "private-alpha-stable-use";
  local_app_can_continue_now: true;
  stable_version_policy: string;
  privacy_note: string;
  boundary: {
    local_plan_only: true;
    reads_sync_queue_counts: true;
    reads_route_catalog: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    sends_network_requests: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    clears_local_cache: false;
    enables_sync: false;
    enables_ai: false;
  };
  summary: {
    stable_use_entrypoints: number;
    guarded_entrypoints: number;
    experimental_surfaces: number;
    route_smoke_protected_entrypoints: number;
    stable_use_guarantees: number;
    high_risk_actions_gated: number;
    pending_total: number;
    failed_total: number;
    manual_review_total: number;
    cache_rebuild_blocked: boolean;
    stable_use_routes: number;
    owner_gated_actions: number;
  };
  stable_use_operating_mode: DevelopmentStabilityOperatingMode;
  stable_use_entrypoints: DevelopmentStabilitySurface[];
  guarded_entrypoints: DevelopmentStabilitySurface[];
  experimental_surfaces: DevelopmentStabilitySurface[];
  high_risk_actions_gated: string[];
  next_action: string;
}

const DEVELOPMENT_STABILITY_BOUNDARY: DevelopmentStabilityPlan["boundary"] = {
  local_plan_only: true,
  reads_sync_queue_counts: true,
  reads_route_catalog: true,
  reads_page_body_text: false,
  reads_database_row_values: false,
  reads_file_names: false,
  reads_file_bytes: false,
  reads_secret_values: false,
  sends_network_requests: false,
  writes_workspace_data: false,
  uploads_workspace_data: false,
  clears_local_cache: false,
  enables_sync: false,
  enables_ai: false,
};

const STABLE_USE_ENTRYPOINTS: DevelopmentStabilitySurface[] = [
  stableSurface(
    "daily",
    "每日纪要",
    "/daily",
    "日历壳、热缓存、metadata-first 和 + 新建路径已进入 P0 route smoke。",
    ["本地热缓存先显示", "+ 新建先本地落盘", "云端目录后台补齐"]
  ),
  stableSurface(
    "schedule",
    "ZhiHui 会议日历",
    "/schedule",
    "会议导入、日历壳和 metadata-first 路径已进入 P0 route smoke。",
    ["会议导入后即时进入日历", "+ 新建先本地落盘", "打开会议页走本地 seed"]
  ),
  stableSurface(
    "modules",
    "模块中心",
    "/modules",
    "模块 registry、稳定使用状态和项目进度入口已进入快检。",
    ["模块入口来自 registry", "稳定/实验状态可见", "新增模块不重构主入口"]
  ),
  stableSurface(
    "notes",
    "笔记与 Page",
    "/modules/notes",
    "笔记模块入口已进入 P0 route smoke，页面正文仍走本地优先和按需加载。",
    ["页面入口可快速打开", "本地草稿优先保存", "云失败不阻止写作"]
  ),
  stableSurface(
    "databases",
    "数据库模块",
    "/modules/databases",
    "数据库 workbench 和本地优先入口已进入 P0 route smoke。",
    ["本地编辑优先", "云失败进入 pending", "缓存重建受队列 gate 保护"]
  ),
  stableSurface(
    "reports",
    "报告库",
    "/modules/reports",
    "报告库 shell 已进入 P0 route smoke；文件上传、AI 解读和外部资源加载继续 gated。",
    ["报告入口先可打开", "本地报告 metadata 可见", "上传和 AI 仍需确认"]
  ),
  stableSurface(
    "files",
    "文件库",
    "/modules/files",
    "文件库 shell 已进入 P0 route smoke；真实文件 bytes 不参与稳定性计划读取。",
    ["文件 metadata 先可见", "文件内容不自动外传", "云文件同步仍需 owner gate"]
  ),
  stableSurface(
    "company-research",
    "公司研究",
    "/modules/company-research",
    "公司研究 shell 已进入 P0 route smoke；公司页关系补全继续按模块化流程推进。",
    ["公司研究入口稳定", "公司 page 关系可继续补齐", "自动写关系前先复核"]
  ),
  stableSurface(
    "meetings-module",
    "会议模块",
    "/modules/meetings",
    "会议模块 shell 已进入 P0 route smoke；录音、转写上传和自动关系写回继续 gated。",
    ["会议入口先可打开", "会议 tracker 本地优先", "录音和转写上传需确认"]
  ),
  stableSurface(
    "portfolio-module",
    "组合模块",
    "/modules/portfolio",
    "组合模块 shell 已进入 P0 route smoke；真实持仓外部连接继续 gated。",
    ["组合模块入口稳定", "本地 tracker 优先", "券商/邮件连接不自动开启"]
  ),
  stableSurface(
    "projects",
    "投研项目",
    "/modules/projects",
    "投研项目 shell 已进入 P0 route smoke；跨模块自动写关系继续 owner-gated。",
    ["项目入口先可打开", "项目页本地优先创建", "跨模块写入先预览"]
  ),
  stableSurface(
    "research-graph",
    "研究图谱",
    "/modules/research-graph",
    "研究图谱 shell 已进入 P0 route smoke；批量补链和云端图谱同步继续 gated。",
    ["图谱入口稳定", "关系覆盖率 metadata 可见", "批量补链先预览"]
  ),
  stableSurface(
    "knowledge-base",
    "知识库",
    "/knowledge-base",
    "知识库页面壳已进入 P0 route smoke，正文仍按需加载。",
    ["页面 metadata 先可见", "正文按需补齐", "公司页关系继续模块化接入"]
  ),
  stableSurface(
    "industry-chain",
    "产业链研究",
    "/industry-chain",
    "产业链研究入口已进入 P0 route smoke，relation 补全仍按模块流程推进。",
    ["层级入口稳定", "公司 page 可作为关系目标", "关系补全走模块流程"]
  ),
  stableSurface(
    "portfolio",
    "组合管理",
    "/portfolio",
    "组合入口已进入 P0 route smoke，云同步仍保持 gated。",
    ["本地组合数据不因同步失败删除", "共享写入受账号 gate 保护", "云同步失败可重试"]
  ),
  stableSurface(
    "sync-center",
    "同步中心",
    "/modules/sync",
    "同步队列、缓存重建预检和本地可继续使用状态已进入 P0 gate。",
    ["pending / failed / manual review 可见", "缓存重建前检查队列", "高风险动作 owner-gated"]
  ),
  stableSurface(
    "account",
    "账号页",
    "/account",
    "账号状态、缓存重建入口和登录兜底已进入 P0 route smoke。",
    ["接口临时失败不等于登出", "保留最近用户名兜底", "同步失败只进入重试状态"]
  ),
  stableSurface(
    "page-shell",
    "Page 页面壳",
    "/page/[pageId]",
    "页面打开走本地优先 handoff，正文在打开后按需补齐。",
    ["页面壳先显示本地 handoff", "正文后台补齐", "当前页同步状态可见"]
  ),
];

const EXPERIMENTAL_SURFACES: DevelopmentStabilitySurface[] = [
  experimentalSurface(
    "web-beta-launch",
    "Web Beta 上线",
    "/modules/sync#web-beta-owner-review",
    "需要用户确认、环境预检、权限和回滚证明，不能在稳定使用区自动开启。"
  ),
  experimentalSurface(
    "cloud-master-enable",
    "云端主库切换",
    "/modules/sync#cloud-master-reconcile",
    "需要 pending / failed / manual review 清零和 owner gate。"
  ),
  experimentalSurface(
    "ai-execution",
    "AI 执行",
    "/modules/ai",
    "AI 涉及外部推理和隐私确认，只能在明确确认后启用。"
  ),
];

const HIGH_RISK_ACTIONS_GATED = [
  "enable_sync_push",
  "enable_sync_pull",
  "cache_rebuild_from_cloud",
  "bulk_import_apply",
  "restore_writeback",
  "file_upload_to_cloud",
  "ai_execution",
];

export function getDevelopmentStableUseRoutes(): string[] {
  return STABLE_USE_ENTRYPOINTS.map((entry) => entry.route);
}

export function getDevelopmentExperimentalRoutes(): string[] {
  return EXPERIMENTAL_SURFACES.map((surface) => surface.route);
}

export function getDevelopmentOwnerGatedActions(): string[] {
  return [...HIGH_RISK_ACTIONS_GATED];
}

export function buildDevelopmentStabilityPlan(input: {
  localUseReadiness: AccountLocalUseReadiness;
  pendingTotal: number;
  failedTotal: number;
  manualReviewTotal: number;
}): DevelopmentStabilityPlan {
  const guardedEntryPoints = buildGuardedEntryPoints(input.localUseReadiness);
  const operatingMode = buildStableUseOperatingMode(input.localUseReadiness);
  const routeSmokeProtectedEntryPoints = STABLE_USE_ENTRYPOINTS.filter(
    (entry) => entry.route_smoke_protected
  ).length;
  const stableUseGuarantees = STABLE_USE_ENTRYPOINTS.reduce(
    (total, entry) => total + entry.guarantees.length,
    0
  );

  return {
    format: "zhinote-development-stability-plan",
    format_version: 1,
    report_status: "metadata-only-development-guardrail",
    development_channel: "private-alpha-stable-use",
    local_app_can_continue_now: true,
    stable_version_policy:
      "把高频写作、每日纪要、会议、数据库、报告、文件、公司研究、投研项目、研究图谱、知识库、产业链、账号和同步中心保留在稳定使用区；开发期间可以继续使用，账号或同步临时失败只能进入可见重试状态，不能清登录状态或阻断本地输入；Web Beta、真实云同步、AI、批量写回和缓存重建继续放在 owner-gated 实验区。",
    privacy_note:
      "This plan is generated locally from route catalog metadata and sync queue counts only. It does not read page body text, database row values, file names, file bytes, secrets, tokens, cookies, holdings, trading plans, or cloud payload bodies; it does not send network requests, upload workspace data, clear cache, enable sync, or enable AI.",
    boundary: DEVELOPMENT_STABILITY_BOUNDARY,
    summary: {
      stable_use_entrypoints: STABLE_USE_ENTRYPOINTS.length,
      guarded_entrypoints: guardedEntryPoints.length,
      experimental_surfaces: EXPERIMENTAL_SURFACES.length,
      route_smoke_protected_entrypoints: routeSmokeProtectedEntryPoints,
      stable_use_guarantees: stableUseGuarantees,
      high_risk_actions_gated: HIGH_RISK_ACTIONS_GATED.length,
      pending_total: Math.max(0, input.pendingTotal),
      failed_total: Math.max(0, input.failedTotal),
      manual_review_total: Math.max(0, input.manualReviewTotal),
      cache_rebuild_blocked: input.localUseReadiness.cacheRebuildBlocked,
      stable_use_routes: operatingMode.safe_to_use_routes.length,
      owner_gated_actions: operatingMode.blocked_without_owner_gate.length,
    },
    stable_use_operating_mode: operatingMode,
    stable_use_entrypoints: STABLE_USE_ENTRYPOINTS,
    guarded_entrypoints: guardedEntryPoints,
    experimental_surfaces: EXPERIMENTAL_SURFACES,
    high_risk_actions_gated: HIGH_RISK_ACTIONS_GATED,
    next_action: buildNextAction(input.localUseReadiness),
  };
}

function stableSurface(
  id: string,
  title: string,
  route: string,
  reason: string,
  guarantees: string[]
): DevelopmentStabilitySurface {
  return {
    id,
    title,
    route,
    status: "stable-use",
    reason,
    guarantees,
    next_action: "继续作为日常使用入口；开发改动必须先过 P0 smoke gate。",
    route_smoke_protected: true,
  };
}

function experimentalSurface(
  id: string,
  title: string,
  route: string,
  reason: string
): DevelopmentStabilitySurface {
  return {
    id,
    title,
    route,
    status: "experimental",
    reason,
    guarantees: [],
    next_action: "等待 owner gate、预检收据和明确确认后再进入稳定版本。",
    route_smoke_protected: false,
  };
}

function buildStableUseOperatingMode(
  readiness: AccountLocalUseReadiness
): DevelopmentStabilityOperatingMode {
  return {
    status: "stable-use-active",
    label: "稳定使用模式",
    user_can_continue_work: true,
    active_development_can_continue: true,
    production_interruptions_should_be_batched: true,
    experimental_changes_go_to_staging_first: true,
    local_input_remains_available: true,
    local_pending_queue_preserved_during_development: true,
    account_session_must_not_be_cleared_by_sync_failures: true,
    sync_failures_show_retry_state_not_sign_out: true,
    upload_blocks_do_not_block_local_writing: true,
    safe_to_use_routes: STABLE_USE_ENTRYPOINTS.map((entry) => entry.route),
    blocked_without_owner_gate: HIGH_RISK_ACTIONS_GATED,
    next_action: readiness.localInputCanContinue
      ? "继续使用稳定入口；实验功能先在本地或 staging 验证，线上变更成批进入；同步失败只显示重试状态，不自动登出或影响本地输入。"
      : "先处理失败或人工复核队列，再恢复稳定使用入口。",
  };
}

function buildGuardedEntryPoints(
  readiness: AccountLocalUseReadiness
): DevelopmentStabilitySurface[] {
  const guarded: DevelopmentStabilitySurface[] = [];
  if (!readiness.cloudHandoffReady) {
    guarded.push({
      id: "cloud-handoff",
      title: "云端交接",
      route: "/modules/sync#sync-handoff-readiness-summary",
      status: "guarded",
      reason: readiness.detail,
      guarantees: [],
      next_action: readiness.nextAction,
      route_smoke_protected: false,
    });
  }
  if (readiness.cacheRebuildBlocked) {
    guarded.push({
      id: "cache-rebuild",
      title: "本地缓存重建",
      route: "/account",
      status: "guarded",
      reason: "pending、failed 或 manual review 未清零前，缓存重建可能覆盖未上传输入。",
      guarantees: [],
      next_action: "先处理同步队列，再从账号页执行带确认的重建流程。",
      route_smoke_protected: false,
    });
  }
  return guarded;
}

function buildNextAction(readiness: AccountLocalUseReadiness) {
  if (readiness.cacheRebuildBlocked) {
    return "继续使用稳定入口写作；先处理 pending / failed / manual review，再考虑缓存重建或云端交接。";
  }
  if (!readiness.cloudHandoffReady) {
    return "继续使用稳定入口；云端交接仍需同步域和 owner gate。";
  }
  return "稳定入口可以继续使用；新的实验功能继续先在本地或 staging 验证。";
}
