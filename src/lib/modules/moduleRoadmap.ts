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
    lanes,
    items,
    gaps,
    required_before_new_module:
      input.onboarding.steps.map((step) => step.id),
    required_verification_commands:
      input.starterPack.verification_commands,
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
