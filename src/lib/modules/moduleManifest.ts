import {
  MODULE_EXTENSION_SLOTS,
  PLATFORM_MODULES,
  type ModuleCategory,
  type ModuleStatus,
  type PlatformModule,
} from "@/lib/modules/registry";

export type ModuleManifestGateStatus = "ready" | "partial" | "blocked";

export interface ModuleManifestModule {
  id: string;
  title: string;
  category: ModuleCategory;
  status: ModuleStatus;
  route: string | null;
  routable: boolean;
  has_starter: boolean;
  starter_type: PlatformModule["starter"] extends null
    ? null
    : NonNullable<PlatformModule["starter"]>["type"] | null;
  capabilities: string[];
  data_surfaces: string[];
  extension_slots: string[];
}

export interface ModuleManifestGate {
  id: string;
  title: string;
  status: ModuleManifestGateStatus;
  evidence: string;
  required_action: string;
}

export interface ModuleManifestSlotCoverage {
  slot_id: string;
  title: string;
  module_count: number;
  module_ids: string[];
}

export interface ModuleManifestReport {
  format: "zhinote-module-manifest";
  format_version: 1;
  manifest_status: "local-registry-contract";
  privacy_note: string;
  boundary: {
    reads_page_text: false;
    reads_database_rows: false;
    reads_file_bytes: false;
    uploads_data: false;
    writes_workspace_data: false;
    enables_modules: false;
  };
  summary: {
    modules: number;
    active: number;
    beta: number;
    planned: number;
    routable: number;
    starters: number;
    extension_slots: number;
    unique_data_surfaces: number;
    gates: number;
    ready: number;
    partial: number;
    blocked: number;
  };
  modules: ModuleManifestModule[];
  extension_slots: typeof MODULE_EXTENSION_SLOTS;
  slot_coverage: ModuleManifestSlotCoverage[];
  gates: ModuleManifestGate[];
}

export function buildModuleManifestReport(): ModuleManifestReport {
  const modules = PLATFORM_MODULES.map(toManifestModule);
  const slotCoverage = MODULE_EXTENSION_SLOTS.map((slot) => {
    const moduleIds = PLATFORM_MODULES.filter((module) =>
      module.extensionSlots.includes(slot.id)
    ).map((module) => module.id);

    return {
      slot_id: slot.id,
      title: slot.title,
      module_count: moduleIds.length,
      module_ids: moduleIds,
    };
  });
  const gates = buildManifestGates(modules, slotCoverage);

  return {
    format: "zhinote-module-manifest",
    format_version: 1,
    manifest_status: "local-registry-contract",
    privacy_note:
      "Generated locally from the module registry. This manifest describes module ids, routes, starter types, data surfaces, and extension slots only. It does not read page text, database rows, uploaded file bytes, report content, prompts, tokens, or credentials.",
    boundary: {
      reads_page_text: false,
      reads_database_rows: false,
      reads_file_bytes: false,
      uploads_data: false,
      writes_workspace_data: false,
      enables_modules: false,
    },
    summary: {
      modules: modules.length,
      active: modules.filter((module) => module.status === "active").length,
      beta: modules.filter((module) => module.status === "beta").length,
      planned: modules.filter((module) => module.status === "planned").length,
      routable: modules.filter((module) => module.routable).length,
      starters: modules.filter((module) => module.has_starter).length,
      extension_slots: MODULE_EXTENSION_SLOTS.length,
      unique_data_surfaces: countUniqueDataSurfaces(modules),
      gates: gates.length,
      ready: gates.filter((gate) => gate.status === "ready").length,
      partial: gates.filter((gate) => gate.status === "partial").length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
    },
    modules,
    extension_slots: MODULE_EXTENSION_SLOTS,
    slot_coverage: slotCoverage,
    gates,
  };
}

function toManifestModule(module: PlatformModule): ModuleManifestModule {
  return {
    id: module.id,
    title: module.title,
    category: module.category,
    status: module.status,
    route: module.route,
    routable: Boolean(module.route),
    has_starter: Boolean(module.starter),
    starter_type: module.starter?.type ?? null,
    capabilities: module.capabilities,
    data_surfaces: module.dataSurfaces,
    extension_slots: module.extensionSlots,
  };
}

function buildManifestGates(
  modules: ModuleManifestModule[],
  slotCoverage: ModuleManifestSlotCoverage[]
): ModuleManifestGate[] {
  const moduleIds = modules.map((module) => module.id);
  const duplicateIds = moduleIds.filter(
    (id, index) => moduleIds.indexOf(id) !== index
  );
  const invalidSlotReferences = modules.flatMap((module) =>
    module.extension_slots.filter(
      (slotId) =>
        !MODULE_EXTENSION_SLOTS.some((slot) => slot.id === slotId)
    )
  );
  const routableBetaModules = modules.filter(
    (module) => module.status === "beta" && module.routable
  ).length;
  const plannedWithRoute = modules.filter(
    (module) => module.status === "planned" && module.routable
  ).length;
  const starterCoverage = modules.filter((module) => module.has_starter).length;
  const uncoveredSlots = slotCoverage.filter((slot) => slot.module_count === 0);

  return [
    {
      id: "unique-module-ids",
      title: "Unique module ids",
      status: duplicateIds.length === 0 ? "ready" : "blocked",
      evidence:
        duplicateIds.length === 0
          ? `${modules.length} modules have unique ids.`
          : `Duplicate module ids: ${duplicateIds.join(", ")}.`,
      required_action:
        "Keep every module id stable and unique so future module settings, routes, and sync metadata can reference it safely.",
    },
    {
      id: "extension-slot-contract",
      title: "Extension slot contract",
      status: invalidSlotReferences.length === 0 ? "ready" : "blocked",
      evidence:
        invalidSlotReferences.length === 0
          ? `${MODULE_EXTENSION_SLOTS.length} extension slots are declared and referenced consistently.`
          : `Unknown slot references: ${invalidSlotReferences.join(", ")}.`,
      required_action:
        "Register new extension slot ids before modules reference them.",
    },
    {
      id: "slot-coverage",
      title: "Slot coverage",
      status: uncoveredSlots.length === 0 ? "ready" : "partial",
      evidence:
        uncoveredSlots.length === 0
          ? "Every declared extension slot is used by at least one module."
          : `${uncoveredSlots.length} slots have no module coverage yet.`,
      required_action:
        "Keep unused slots visible in the manifest so future modules can attach without changing old module definitions.",
    },
    {
      id: "beta-module-routes",
      title: "Beta module routes",
      status: routableBetaModules > 0 ? "ready" : "partial",
      evidence: `${routableBetaModules} beta modules expose routable module pages.`,
      required_action:
        "Give every investable workflow a routable page before treating it as a first-class platform module.",
    },
    {
      id: "planned-module-boundaries",
      title: "Planned module boundaries",
      status: plannedWithRoute > 0 ? "partial" : "ready",
      evidence: `${plannedWithRoute} planned modules already expose local planning routes.`,
      required_action:
        "Keep planned routes local-only until privacy, permission, storage, and audit boundaries are explicit.",
    },
    {
      id: "starter-coverage",
      title: "Starter coverage",
      status: starterCoverage >= 4 ? "ready" : "partial",
      evidence: `${starterCoverage} modules provide starter actions or preset workspaces.`,
      required_action:
        "Add starter contracts for future modules only when they create local pages, databases, or preset trackers safely.",
    },
  ];
}

function countUniqueDataSurfaces(modules: ModuleManifestModule[]) {
  return new Set(modules.flatMap((module) => module.data_surfaces)).size;
}
