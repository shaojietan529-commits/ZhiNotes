import type { ModuleHealthReport } from "@/lib/modules/moduleHealth";
import type { ModuleManifestReport } from "@/lib/modules/moduleManifest";
import type { ModuleRoadmapReport } from "@/lib/modules/moduleRoadmap";

export type ProjectProgressStatus =
  | "ready-local"
  | "beta-hardening"
  | "owner-gated"
  | "blocked";

export interface ProjectProgressSnapshotInput {
  page_count: number;
  database_count: number;
  manifest: ModuleManifestReport;
  health: ModuleHealthReport;
  roadmap: ModuleRoadmapReport;
}

export interface ProjectProgressPhase {
  id: "phase-1" | "phase-2" | "phase-3" | "phase-4" | "phase-5";
  title: string;
  status: ProjectProgressStatus;
  area_count: number;
  module_ids: string[];
  evidence: string;
  next_action: string;
}

export interface ProjectProgressTrialRoute {
  module_id: string;
  title: string;
  route: string;
  status: "active" | "beta" | "planned";
  readiness: ProjectProgressStatus;
  recommended_test: string;
}

export interface ProjectProgressBlocker {
  id: string;
  title: string;
  status: ProjectProgressStatus;
  evidence: string;
  next_action: string;
}

export interface ProjectStableUseStatus {
  status: "can-use-now" | "use-with-care" | "blocked";
  label: string;
  detail: string;
  user_can_keep_working: boolean;
  local_input_priority: "local-first";
  web_beta_can_launch_now: false;
  cloud_sync_can_start_now: false;
  protected_boundaries: string[];
  stable_entrypoints: string[];
  next_safe_action: string;
}

export interface ProjectProgressSnapshot {
  format: "zhinote-project-progress-snapshot";
  format_version: 1;
  snapshot_status: "local-owner-progress-review";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_registry_metadata_only: true;
    reads_health_metadata: true;
    reads_roadmap_metadata: true;
    reads_page_count_only: true;
    reads_database_count_only: true;
    reads_page_text: false;
    reads_database_rows: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    pages: number;
    databases: number;
    modules: number;
    active_modules: number;
    beta_modules: number;
    planned_modules: number;
    routable_modules: number;
    ready_areas: number;
    partial_areas: number;
    blocked_areas: number;
    web_launch_blockers: number;
    owner_gated_decisions: number;
  };
  current_stage: string;
  current_conclusion: string;
  stable_use_status: ProjectStableUseStatus;
  completed_foundation: string[];
  in_progress_hardening: string[];
  owner_gated_work: string[];
  recommended_sleep_run_work: string[];
  phases: ProjectProgressPhase[];
  trial_routes: ProjectProgressTrialRoute[];
  owner_gate_routes: ProjectProgressTrialRoute[];
  blockers: ProjectProgressBlocker[];
  required_verification_commands: string[];
}

const PHASE_TITLES: Record<ProjectProgressPhase["id"], string> = {
  "phase-1": "阶段 1：本地笔记和文件体验",
  "phase-2": "阶段 2：模块化平台底座",
  "phase-3": "阶段 3：投研核心模块",
  "phase-4": "阶段 4：Web Beta 准备",
  "phase-5": "阶段 5：正式 Web 和 AI 能力",
};

export function buildProjectProgressSnapshot(
  input: ProjectProgressSnapshotInput
): ProjectProgressSnapshot {
  const phases = buildPhases(input.health);
  const trialRoutes = buildTrialRoutes(input);
  const ownerGateRoutes = buildOwnerGateRoutes(input);
  const blockers = buildBlockers(input);
  const ownerGatedDecisions =
    input.roadmap.decision_summary.decisions.filter(
      (decision) => decision.requires_owner_confirmation
    ).length;

  return {
    format: "zhinote-project-progress-snapshot",
    format_version: 1,
    snapshot_status: "local-owner-progress-review",
    privacy_note:
      "Generated locally from module registry, module health, roadmap metadata, page count, and database count. This progress snapshot is for owner review only. It does not read page text, database rows, database row values, file bytes, secret values, prompts, tokens, credentials, cloud data, or private research content.",
    boundary: {
      local_report_only: true,
      reads_registry_metadata_only: true,
      reads_health_metadata: true,
      reads_roadmap_metadata: true,
      reads_page_count_only: true,
      reads_database_count_only: true,
      reads_page_text: false,
      reads_database_rows: false,
      reads_database_row_values: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      pages: input.page_count,
      databases: input.database_count,
      modules: input.manifest.summary.modules,
      active_modules: input.manifest.summary.active,
      beta_modules: input.manifest.summary.beta,
      planned_modules: input.manifest.summary.planned,
      routable_modules: input.manifest.summary.routable,
      ready_areas: input.health.summary.ready,
      partial_areas: input.health.summary.partial,
      blocked_areas: input.health.summary.blocked,
      web_launch_blockers: input.roadmap.summary.web_launch_blockers,
      owner_gated_decisions: ownerGatedDecisions,
    },
    current_stage: getCurrentStage(phases, blockers.length),
    current_conclusion: getCurrentConclusion(input, blockers.length),
    stable_use_status: buildStableUseStatus(input, blockers.length),
    completed_foundation: buildCompletedFoundation(input.health),
    in_progress_hardening: buildInProgressHardening(input.health),
    owner_gated_work: buildOwnerGatedWork(input.roadmap),
    recommended_sleep_run_work: [
      "继续做本地 UI、数据结构、验证脚本、README 和浏览器试用，不触碰云服务、GitHub 凭证、AI 外发或批量删除。",
      "优先强化 beta 模块：文件预览路由、报告、公司研究、会议、组合、研究图谱之间的入口、关系和试用闭环。",
      "每个阶段完成后保留本地 commit 和截图，GitHub push 等 owner 醒来后处理 SSH key 或凭证。",
    ],
    phases,
    trial_routes: trialRoutes,
    owner_gate_routes: ownerGateRoutes,
    blockers,
    required_verification_commands: [
      "npm run verify:modules",
      "npm run verify:research-workflow",
      "npm run verify:file-preview",
      "npm run verify:web-beta",
      "npm run lint",
      "npm run build",
    ],
  };
}

function buildStableUseStatus(
  input: ProjectProgressSnapshotInput,
  blockerCount: number
): ProjectStableUseStatus {
  const hasStableCore =
    input.manifest.summary.active >= 2 && input.health.summary.ready >= 2;
  const status =
    hasStableCore && input.manifest.summary.routable > 0
      ? "can-use-now"
      : blockerCount > 0
        ? "use-with-care"
        : "blocked";
  const stableEntryPoints = [
    "/daily",
    "/schedule",
    "/modules",
    "/modules/sync",
    "/modules/notes",
    "/modules/databases",
  ].filter((route) =>
    route === "/daily" ||
    route === "/schedule" ||
    route === "/modules" ||
    route === "/modules/sync" ||
    input.manifest.modules.some((module) => module.route === route)
  );

  return {
    status,
    label:
      status === "can-use-now"
        ? "当前版本可继续稳定使用"
        : status === "use-with-care"
          ? "当前版本可用，但上线能力仍需确认"
          : "当前版本不建议作为主工作区",
    detail:
      status === "can-use-now"
        ? "本地输入优先保存；Web Beta、云同步、AI 和高风险写回仍保持 owner-gated，不会自动启用。"
        : status === "use-with-care"
          ? "本地模块可以继续试用，但请先处理 owner gate、权限、云同步和恢复证明，再作为正式 Web 版本使用。"
          : "缺少稳定核心模块或可打开入口前，不应承载真实投研工作。",
    user_can_keep_working: status !== "blocked",
    local_input_priority: "local-first",
    web_beta_can_launch_now: false,
    cloud_sync_can_start_now: false,
    protected_boundaries: [
      "本地输入先保存到本地缓存和 pending queue",
      "Web Beta 发布需要 owner review",
      "云同步启用需要明确确认",
      "AI、外部资产、批量恢复和写回默认禁用",
    ],
    stable_entrypoints: stableEntryPoints,
    next_safe_action:
      status === "can-use-now"
        ? "继续做小步本地改进；每次改动后运行 Private Alpha 或 Web Beta 验证、commit 并 push。"
        : "先修复 owner gate 和阻塞项，再扩大使用范围。",
  };
}

function buildPhases(health: ModuleHealthReport): ProjectProgressPhase[] {
  return (Object.keys(PHASE_TITLES) as ProjectProgressPhase["id"][]).map(
    (phaseId) => {
      const areas = health.areas.filter((area) => area.phase === phaseId);
      const areaStatuses = areas.map((area) => area.status);
      const status = areaStatuses.includes("blocked")
        ? "blocked"
        : areaStatuses.includes("partial")
          ? phaseId === "phase-4" || phaseId === "phase-5"
            ? "owner-gated"
            : "beta-hardening"
          : "ready-local";

      return {
        id: phaseId,
        title: PHASE_TITLES[phaseId],
        status,
        area_count: areas.length,
        module_ids: unique(areas.flatMap((area) => area.module_ids)),
        evidence:
          areas.length > 0
            ? areas.map((area) => `${area.title}: ${area.status}`).join("；")
            : "这个阶段还没有映射到具体模块。",
        next_action:
          areas.length > 0
            ? areas.map((area) => area.next_action).join(" ")
            : "先把阶段目标映射到 registry-backed module。",
      };
    }
  );
}

function buildTrialRoutes(
  input: ProjectProgressSnapshotInput
): ProjectProgressTrialRoute[] {
  return input.manifest.modules
    .filter((module) => module.route && module.status !== "planned")
    .map((module) => ({
      module_id: module.id,
      title: module.title,
      route: getTrialRoute(module.id, module.route as string),
      status: module.status,
      readiness: module.status === "active" ? "ready-local" : "beta-hardening",
      recommended_test: getRecommendedTest(module.id),
    }));
}

function buildOwnerGateRoutes(
  input: ProjectProgressSnapshotInput
): ProjectProgressTrialRoute[] {
  return input.manifest.modules
    .filter((module) => module.route && module.status === "planned")
    .map((module) => ({
      module_id: module.id,
      title: module.title,
      route: getTrialRoute(module.id, module.route as string),
      status: module.status,
      readiness: "owner-gated",
      recommended_test: getRecommendedTest(module.id),
    }));
}

function buildBlockers(
  input: ProjectProgressSnapshotInput
): ProjectProgressBlocker[] {
  const roadmapBlockers = input.roadmap.gaps
    .filter((gap) => gap.severity === "p0")
    .map((gap) => ({
      id: gap.id,
      title: gap.title,
      status: "blocked" as const,
      evidence: gap.evidence,
      next_action: gap.required_action,
    }));
  const healthBlockers = input.health.areas
    .filter((area) => area.status === "blocked")
    .map((area) => ({
      id: area.id,
      title: area.title,
      status: "owner-gated" as const,
      evidence: area.evidence,
      next_action: area.next_action,
    }));

  return [...roadmapBlockers, ...healthBlockers];
}

function getCurrentStage(
  phases: ProjectProgressPhase[],
  blockerCount: number
) {
  const hasPhase3Hardening = phases.some(
    (phase) => phase.id === "phase-3" && phase.status === "beta-hardening"
  );
  if (hasPhase3Hardening) {
    return "阶段 3：投研核心模块 beta hardening";
  }
  if (blockerCount > 0) {
    return "阶段 4：Web Beta owner-gated readiness";
  }
  return "阶段 2-3：本地模块化平台扩展";
}

function getCurrentConclusion(
  input: ProjectProgressSnapshotInput,
  blockerCount: number
) {
  if (blockerCount > 0) {
    return `本地平台已经可以继续试用和迭代：${input.manifest.summary.active} 个 active 模块、${input.manifest.summary.beta} 个 beta 模块、${input.manifest.summary.routable} 个可打开模块；正式 Web 上线仍被 owner gate、权限、云同步和回滚证明阻塞。`;
  }

  return `本地平台已具备 ${input.manifest.summary.routable} 个可打开模块；下一步可以进入更完整的 Web Beta 演练，但仍需 owner 确认云、AI、外部资产和写回边界。`;
}

function buildCompletedFoundation(health: ModuleHealthReport) {
  return health.areas
    .filter((area) => area.status === "ready")
    .map((area) => `${area.title}: ${area.evidence}`);
}

function buildInProgressHardening(health: ModuleHealthReport) {
  return health.areas
    .filter((area) => area.status === "partial")
    .map((area) => `${area.title}: ${area.next_action}`);
}

function buildOwnerGatedWork(roadmap: ModuleRoadmapReport) {
  return roadmap.decision_summary.decisions
    .filter((decision) => decision.requires_owner_confirmation)
    .map((decision) => `${decision.title}: ${decision.next_action}`);
}

function getRecommendedTest(moduleId: string) {
  const tests: Record<string, string> = {
    notes: "直达笔记工作台，检查页面结构、slash command、backlinks、版本痕迹和优先行动。",
    databases: "打开数据库模块，检查 table/list/kanban/calendar/gallery/timeline/form/feed 入口。",
    reports: "上传或打开一个本地 HTML/Markdown/PDF 报告，确认 native preview 和路由提示。",
    files: "直达文件预览路由总控，检查 HTML、Markdown、PDF、Excel、Word、PPT 如何进入 page、导入或入库。",
    "company-research": "直达公司研究 dossier，检查 memo、估值、报告、会议关系和覆盖缺口。",
    projects:
      "直达项目 launcher，创建项目跟踪表，再用“创建项目页并入库”检查项目页、tracker row 和项目 handoff。",
    portfolio: "直达组合工作台，检查 memo、watchlist、sizing、catalyst、risk 和 relation 入口。",
    meetings: "直达会议研究队列，检查 transcript、action items、follow-up 和 relation 入口。",
    "research-graph": "直达研究图谱工作台，查看 relation handoff、schema gap 和 unlinked asset 队列。",
    "ai-workbench": "直达 AI payload review，只审阅发送内容预览、确认短语和 provider 边界，不启用 AI。",
    sync: "直达 Web Beta owner review，只审阅登录、云同步、恢复、权限和部署 gate，不连接云服务。",
  };

  return tests[moduleId] ?? "打开模块页面，确认入口、边界说明和导出动作都可用。";
}

function getTrialRoute(moduleId: string, route: string) {
  const deepLinks: Record<string, string> = {
    notes: "/modules/notes#notes-workbench",
    "company-research": "/modules/company-research#company-dossier",
    files: "/modules/files#files-preview-routing",
    meetings: "/modules/meetings#meeting-research-queue",
    portfolio: "/modules/portfolio#portfolio-workbench",
    projects: "/modules/projects#project-launcher",
    reports: "/modules/reports#reports-preview-routing",
    databases: "/modules/databases#databases-import-export-readiness",
    "research-graph": "/modules/research-graph#research-graph-workbench",
    "ai-workbench": "/modules/ai#ai-payload-review",
    sync: "/modules/sync#web-beta-owner-review",
  };

  return deepLinks[moduleId] ?? route;
}

function unique(values: string[]) {
  return [...new Set(values)];
}
