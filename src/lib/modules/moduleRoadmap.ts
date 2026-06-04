import type { ModuleHealthReport } from "@/lib/modules/moduleHealth";
import type { ModuleManifestReport } from "@/lib/modules/moduleManifest";
import type { ModuleOnboardingContract } from "@/lib/modules/moduleOnboarding";
import type { ModuleStarterPackContract } from "@/lib/modules/moduleStarterPack";
import {
  MODULE_EXTENSION_SLOTS,
  PLATFORM_MODULES,
  type ModuleStatus,
  type PlatformModule,
} from "@/lib/modules/registry";

export type ModuleRoadmapLaneId =
  | "active-now"
  | "beta-hardening"
  | "planned-contracts"
  | "web-launch-blockers";

export type ModuleRoadmapReadiness =
  | "ready-local"
  | "needs-hardening"
  | "contract-only"
  | "blocked-by-launch-gates";

export type ModuleRoadmapDecisionStatus =
  | "available-local"
  | "requires-owner-confirmation"
  | "blocked";

export interface ModuleRoadmapInput {
  manifest: ModuleManifestReport;
  onboarding: ModuleOnboardingContract;
  starterPack: ModuleStarterPackContract;
  health: ModuleHealthReport;
}

export interface ModuleRoadmapItem {
  module_id: string;
  title: string;
  status: ModuleStatus;
  lane_id: ModuleRoadmapLaneId;
  readiness: ModuleRoadmapReadiness;
  route: string | null;
  starter_type: NonNullable<PlatformModule["starter"]>["type"] | null;
  extension_slots: string[];
  data_surfaces: string[];
  evidence: string;
  next_action: string;
  acceptance_gates: string[];
  privacy_boundary: string;
}

export interface ModuleRoadmapLane {
  id: ModuleRoadmapLaneId;
  title: string;
  readiness: ModuleRoadmapReadiness;
  module_count: number;
  module_ids: string[];
  owner_decision_required: boolean;
  next_action: string;
}

export interface ModuleRoadmapGap {
  id: string;
  title: string;
  severity: "p0" | "p1" | "p2";
  evidence: string;
  required_action: string;
}

export interface ModuleRoadmapDecision {
  id:
    | "new-module-design"
    | "route-shell-scaffold"
    | "safe-starter"
    | "high-risk-actions"
    | "web-cloud-ai-boundary";
  title: string;
  status: ModuleRoadmapDecisionStatus;
  answer: string;
  evidence: string;
  next_action: string;
  route: "/modules";
  target_section_id: string;
  allowed_now: boolean;
  requires_owner_confirmation: boolean;
  blocks_web_launch: boolean;
  creates_modules_now: false;
  writes_workspace_data: false;
  connects_cloud_services: false;
  uploads_data: false;
  enables_ai: false;
}

export interface ModuleRoadmapDecisionSummary {
  current_state: "local-module-design-only";
  current_conclusion: string;
  can_design_new_module_now: true;
  can_add_registry_contract_now: true;
  can_add_safe_local_route_now: true;
  can_enable_high_risk_actions_now: false;
  can_connect_cloud_or_ai_now: false;
  can_launch_web_module_now: false;
  safe_local_work: string[];
  blocked_work: string[];
  required_owner_decisions: string[];
  decisions: ModuleRoadmapDecision[];
}

export interface ModuleRoadmapReport {
  format: "zhinote-module-roadmap";
  format_version: 1;
  roadmap_status: "local-module-roadmap-only";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_registry_metadata_only: true;
    reads_manifest_metadata: true;
    reads_onboarding_contract: true;
    reads_starter_pack_contract: true;
    reads_health_report: true;
    reads_page_text: false;
    reads_database_rows: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    writes_workspace_data: false;
    creates_modules_now: false;
    changes_routes_now: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    modules: number;
    active_now: number;
    beta_hardening: number;
    planned_contracts: number;
    web_launch_blockers: number;
    routable: number;
    starters: number;
    extension_slots: number;
    gaps: number;
    p0_gaps: number;
  };
  decision_summary: ModuleRoadmapDecisionSummary;
  lanes: ModuleRoadmapLane[];
  items: ModuleRoadmapItem[];
  gaps: ModuleRoadmapGap[];
  required_before_new_module: string[];
  required_verification_commands: string[];
}

export function buildModuleRoadmapReport(
  input: ModuleRoadmapInput
): ModuleRoadmapReport {
  const items = PLATFORM_MODULES.map((module) => toRoadmapItem(module, input));
  const lanes = buildRoadmapLanes(items);
  const gaps = buildRoadmapGaps(input, items);

  return {
    format: "zhinote-module-roadmap",
    format_version: 1,
    roadmap_status: "local-module-roadmap-only",
    privacy_note:
      "Generated locally from module registry, manifest, onboarding, starter pack, and module health metadata. This roadmap organizes module build queues only. It does not read page text, database rows, file bytes, secret values, prompts, tokens, credentials, cloud data, or private research content; it does not create modules, change routes, write workspace data, connect cloud services, upload data, or enable AI.",
    boundary: {
      local_report_only: true,
      reads_registry_metadata_only: true,
      reads_manifest_metadata: true,
      reads_onboarding_contract: true,
      reads_starter_pack_contract: true,
      reads_health_report: true,
      reads_page_text: false,
      reads_database_rows: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      writes_workspace_data: false,
      creates_modules_now: false,
      changes_routes_now: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      modules: items.length,
      active_now: countLane(items, "active-now"),
      beta_hardening: countLane(items, "beta-hardening"),
      planned_contracts: countLane(items, "planned-contracts"),
      web_launch_blockers: countLane(items, "web-launch-blockers"),
      routable: items.filter((item) => Boolean(item.route)).length,
      starters: items.filter((item) => Boolean(item.starter_type)).length,
      extension_slots: MODULE_EXTENSION_SLOTS.length,
      gaps: gaps.length,
      p0_gaps: gaps.filter((gap) => gap.severity === "p0").length,
    },
    decision_summary: buildModuleRoadmapDecisionSummary(input, gaps),
    lanes,
    items,
    gaps,
    required_before_new_module:
      input.onboarding.steps.map((step) => step.id),
    required_verification_commands:
      input.starterPack.verification_commands,
  };
}

function buildModuleRoadmapDecisionSummary(
  input: ModuleRoadmapInput,
  gaps: ModuleRoadmapGap[]
): ModuleRoadmapDecisionSummary {
  const p0Gaps = gaps.filter((gap) => gap.severity === "p0");

  return {
    current_state: "local-module-design-only",
    current_conclusion:
      "可以继续本地设计新模块、补 registry contract、加本地 route/shell 和安全 starter；高风险动作、云服务、AI、外部资产、批量/破坏性操作和 Web launch 仍然需要 owner gate。",
    can_design_new_module_now: true,
    can_add_registry_contract_now: true,
    can_add_safe_local_route_now: true,
    can_enable_high_risk_actions_now: false,
    can_connect_cloud_or_ai_now: false,
    can_launch_web_module_now: false,
    safe_local_work: [
      "定义新模块 id、标题、category、route、capabilities、data surfaces 和 extension slots。",
      "创建本地 route/shell，只渲染本地 metadata 和用户可见内容。",
      "添加安全 starter，只创建本地页面、数据库或 tracker。",
      "更新 README 和 npm run verify:modules 断言。",
    ],
    blocked_work: [
      "不能默认启用云同步、分享、外部 asset 加载或 Web launch。",
      "不能默认启用 AI provider、broker import、批量删除、restore write-back 或覆盖写入。",
      "不能让新模块读取页面正文、数据库 rows 或文件 bytes 后直接外发。",
      "不能绕过 payload preview、typed confirmation、permission check 和 audit event。",
    ],
    required_owner_decisions: [
      "确认新模块属于 Workspace、Research、Data 还是 Automation。",
      "确认新模块需要哪些 extension slots，以及是否需要 starter。",
      "确认模块触碰的数据面：pages、databases、files、relations、sync_log 或 reports。",
      "确认任何高风险动作在启用前都走独立 owner gate。",
    ],
    decisions: [
      {
        id: "new-module-design",
        title: "新模块本地设计",
        status: "available-local",
        answer: "可以继续",
        evidence: `${input.manifest.summary.modules} 个模块已在 registry 中管理，${input.manifest.summary.extension_slots} 个 extension slots 可复用。`,
        next_action:
          "先写 registry entry 和 data surface 边界，再决定是否做 route、starter 和 verifier。",
        route: "/modules",
        target_section_id: "module-manifest",
        allowed_now: true,
        requires_owner_confirmation: false,
        blocks_web_launch: false,
        creates_modules_now: false,
        writes_workspace_data: false,
        connects_cloud_services: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "route-shell-scaffold",
        title: "Route / Shell scaffold",
        status: "available-local",
        answer: "可以本地加",
        evidence: `${input.starterPack.summary.files} 个 starter file templates 已定义，route 和 shell 都保持 local-first。`,
        next_action:
          "创建 /modules/<module-id> 和 shell 时，只展示本地状态、disabled gates 和 owner review 信息。",
        route: "/modules",
        target_section_id: "module-starter-pack",
        allowed_now: true,
        requires_owner_confirmation: false,
        blocks_web_launch: false,
        creates_modules_now: false,
        writes_workspace_data: false,
        connects_cloud_services: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "safe-starter",
        title: "安全 starter",
        status: "requires-owner-confirmation",
        answer: "逐项确认",
        evidence: `${input.onboarding.current_registry.starter_modules} 个现有模块已有 starter；starter 只能创建本地 artifact。`,
        next_action:
          "只有在 starter 不上传、不删除、不调用 AI、不连接 broker、不恢复覆盖时，才接入模块动作。",
        route: "/modules",
        target_section_id: "module-onboarding",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_web_launch: false,
        creates_modules_now: false,
        writes_workspace_data: false,
        connects_cloud_services: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "high-risk-actions",
        title: "高风险动作",
        status: "blocked",
        answer: "保持阻塞",
        evidence: `${input.starterPack.summary.risk_gates} 个 risk gates 已定义，包含 cloud sync、AI、external assets 和 bulk/destructive actions。`,
        next_action:
          "先接 payload preview、typed confirmation、permission decision、audit event 和 rollback/scope review。",
        route: "/modules",
        target_section_id: "module-starter-pack",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_web_launch: true,
        creates_modules_now: false,
        writes_workspace_data: false,
        connects_cloud_services: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "web-cloud-ai-boundary",
        title: "Web / Cloud / AI 模块",
        status: "blocked",
        answer: "保持关闭",
        evidence:
          p0Gaps.length > 0
            ? `${p0Gaps.length} 个 P0 gap 仍阻塞 Web launch。`
            : "Web launch 仍需要 owner review、permission、audit、storage 和 sync proof。",
        next_action:
          "上线或连接云/AI 前，先完成 Sync 模块中的 Web Beta owner review、环境 preflight、权限和审计门禁。",
        route: "/modules",
        target_section_id: "module-roadmap",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_web_launch: true,
        creates_modules_now: false,
        writes_workspace_data: false,
        connects_cloud_services: false,
        uploads_data: false,
        enables_ai: false,
      },
    ],
  };
}

function toRoadmapItem(
  module: PlatformModule,
  input: ModuleRoadmapInput
): ModuleRoadmapItem {
  const laneId = getLaneId(module);
  const readiness = getReadiness(laneId);
  const manifestModule = input.manifest.modules.find(
    (item) => item.id === module.id
  );
  const healthArea = input.health.areas.find((area) =>
    area.module_ids.includes(module.id)
  );

  return {
    module_id: module.id,
    title: module.title,
    status: module.status,
    lane_id: laneId,
    readiness,
    route: module.route,
    starter_type: module.starter?.type ?? null,
    extension_slots: module.extensionSlots,
    data_surfaces: module.dataSurfaces,
    evidence:
      healthArea?.evidence ??
      `${module.title} is registered with ${module.capabilities.length} capabilities, ${module.extensionSlots.length} extension slots, and ${module.dataSurfaces.length} data surfaces.`,
    next_action:
      healthArea?.next_action ??
      getFallbackNextAction(module, manifestModule?.has_starter ?? false),
    acceptance_gates: getAcceptanceGates(module, input),
    privacy_boundary:
      healthArea?.privacy_boundary ??
      "Module roadmap reads registry metadata only and must not inspect private workspace content.",
  };
}

function getLaneId(module: PlatformModule): ModuleRoadmapLaneId {
  if (module.id === "sync") return "web-launch-blockers";
  if (module.status === "active") return "active-now";
  if (module.status === "beta") return "beta-hardening";
  return "planned-contracts";
}

function getReadiness(
  laneId: ModuleRoadmapLaneId
): ModuleRoadmapReadiness {
  if (laneId === "active-now") return "ready-local";
  if (laneId === "beta-hardening") return "needs-hardening";
  if (laneId === "planned-contracts") return "contract-only";
  return "blocked-by-launch-gates";
}

function getFallbackNextAction(
  module: PlatformModule,
  hasStarter: boolean
) {
  if (!module.route) {
    return "Add a routable module page before treating this module as a first-class workflow.";
  }
  if (!hasStarter && module.status !== "planned") {
    return "Add a safe local starter only when it can create local pages or databases without external calls.";
  }
  if (module.status === "planned") {
    return "Keep this module contract-only until privacy, permission, audit, and write-back gates are explicit.";
  }
  return "Keep hardening workflow-specific templates, reports, relation coverage, and verification checks.";
}

function getAcceptanceGates(
  module: PlatformModule,
  input: ModuleRoadmapInput
) {
  const gates = [
    "registry-entry",
    module.route ? "route-page" : "route-required",
    module.extensionSlots.length > 0
      ? "extension-slots"
      : "extension-slot-required",
    module.dataSurfaces.length > 0
      ? "data-surface-boundary"
      : "data-surface-required",
    "privacy-boundary",
    "verify-modules",
  ];

  if (module.starter) {
    gates.push("safe-starter");
  }
  if (module.status !== "active") {
    gates.push("owner-review-before-beta");
  }
  if (input.starterPack.risk_gates.length > 0) {
    gates.push("high-risk-gates");
  }

  return gates;
}

function buildRoadmapLanes(
  items: ModuleRoadmapItem[]
): ModuleRoadmapLane[] {
  return [
    lane(
      "active-now",
      "本地可用",
      "ready-local",
      items,
      false,
      "Keep active modules stable while adding focused workflow improvements."
    ),
    lane(
      "beta-hardening",
      "Beta 强化",
      "needs-hardening",
      items,
      false,
      "Harden beta modules with dashboards, relation cleanup, import receipts, and browser verification."
    ),
    lane(
      "planned-contracts",
      "规划合同",
      "contract-only",
      items,
      true,
      "Keep planned modules disabled until payload, permission, audit, and write-back boundaries are explicit."
    ),
    lane(
      "web-launch-blockers",
      "上线阻塞",
      "blocked-by-launch-gates",
      items,
      true,
      "Clear auth, cloud, permission, audit, storage, sync, and rollback gates before Web Alpha sharing."
    ),
  ];
}

function lane(
  id: ModuleRoadmapLaneId,
  title: string,
  readiness: ModuleRoadmapReadiness,
  items: ModuleRoadmapItem[],
  ownerDecisionRequired: boolean,
  nextAction: string
): ModuleRoadmapLane {
  const laneItems = items.filter((item) => item.lane_id === id);

  return {
    id,
    title,
    readiness,
    module_count: laneItems.length,
    module_ids: laneItems.map((item) => item.module_id),
    owner_decision_required: ownerDecisionRequired,
    next_action: nextAction,
  };
}

function buildRoadmapGaps(
  input: ModuleRoadmapInput,
  items: ModuleRoadmapItem[]
): ModuleRoadmapGap[] {
  const gaps: ModuleRoadmapGap[] = [];

  if (input.manifest.summary.blocked > 0) {
    gaps.push({
      id: "manifest-blockers",
      title: "Module manifest blockers",
      severity: "p0",
      evidence: `${input.manifest.summary.blocked} manifest gates are blocked.`,
      required_action:
        "Fix registry ids, routes, starters, extension slots, or data surfaces before accepting new modules.",
    });
  }
  if (input.health.summary.blocked > 0) {
    gaps.push({
      id: "goal-health-blockers",
      title: "Product goal health blockers",
      severity: "p0",
      evidence: `${input.health.summary.blocked} product goal areas are blocked.`,
      required_action:
        "Resolve blocked goal areas before calling the platform ready for Web Alpha.",
    });
  }
  if (items.some((item) => item.readiness === "contract-only")) {
    gaps.push({
      id: "planned-module-writeback",
      title: "Planned modules are contract-only",
      severity: "p1",
      evidence:
        "At least one planned module is visible only as a local contract and cannot execute live workflows.",
      required_action:
        "Add provider selection, payload preview, permission checks, audit events, retention policy, and owner confirmation before enabling planned module execution.",
    });
  }
  if (items.some((item) => item.lane_id === "web-launch-blockers")) {
    gaps.push({
      id: "web-launch-gates",
      title: "Web launch gates remain blocked",
      severity: "p0",
      evidence:
        "Sync/Web Beta remains a launch-blocker lane rather than an active production module.",
      required_action:
        "Clear auth, cloud database, private file storage, sync replay, permissions, audit, restore rollback, and owner launch decision gates.",
    });
  }
  if (input.starterPack.summary.blocked > 0) {
    gaps.push({
      id: "starter-pack-risk-gates",
      title: "Starter pack risk gates",
      severity: "p1",
      evidence: `${input.starterPack.summary.blocked} starter-pack gates are blocked by design.`,
      required_action:
        "Keep cloud sync, AI execution, external assets, and bulk/destructive actions disabled until explicit confirmation gates exist.",
    });
  }

  return gaps;
}

function countLane(items: ModuleRoadmapItem[], laneId: ModuleRoadmapLaneId) {
  return items.filter((item) => item.lane_id === laneId).length;
}
