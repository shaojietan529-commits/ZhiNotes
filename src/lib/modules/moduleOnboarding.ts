import {
  MODULE_EXTENSION_SLOTS,
  PLATFORM_MODULES,
  type ModuleStarter,
} from "@/lib/modules/registry";

export type ModuleOnboardingPhase =
  | "registry"
  | "route"
  | "starter"
  | "extension-slots"
  | "data-boundary"
  | "privacy"
  | "documentation"
  | "verification";

export type ModuleOnboardingStatus =
  | "ready"
  | "manual-confirmation"
  | "blocked";

export interface ModuleOnboardingStep {
  id: string;
  phase: ModuleOnboardingPhase;
  status: ModuleOnboardingStatus;
  title: string;
  evidence: string;
  required_action: string;
  privacy_boundary: string;
}

export interface ModuleOnboardingContract {
  format: "zhinote-module-onboarding-contract";
  format_version: 1;
  contract_status: "local-onboarding-contract";
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    creates_modules: false;
    writes_workspace_data: false;
    reads_page_text: false;
    reads_database_rows: false;
    reads_file_bytes: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  current_registry: {
    modules: number;
    routable_modules: number;
    starter_modules: number;
    extension_slots: number;
    starter_types: string[];
    data_surfaces: string[];
  };
  required_new_module_fields: string[];
  required_extension_slots: Array<(typeof MODULE_EXTENSION_SLOTS)[number]["id"]>;
  summary: {
    steps: number;
    ready: number;
    manual_confirmation: number;
    blocked: number;
  };
  steps: ModuleOnboardingStep[];
}

export function buildModuleOnboardingContract(): ModuleOnboardingContract {
  const steps = buildOnboardingSteps();

  return {
    format: "zhinote-module-onboarding-contract",
    format_version: 1,
    contract_status: "local-onboarding-contract",
    privacy_note:
      "Generated locally from the module registry. This onboarding contract describes how future modules should register ids, routes, starters, extension slots, data boundaries, documentation, and verification. It does not create modules, write workspace data, read page text, read database rows, read file bytes, connect cloud services, upload data, or enable AI.",
    boundary: {
      local_contract_only: true,
      creates_modules: false,
      writes_workspace_data: false,
      reads_page_text: false,
      reads_database_rows: false,
      reads_file_bytes: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    current_registry: {
      modules: PLATFORM_MODULES.length,
      routable_modules: PLATFORM_MODULES.filter((module) => module.route)
        .length,
      starter_modules: PLATFORM_MODULES.filter((module) => module.starter)
        .length,
      extension_slots: MODULE_EXTENSION_SLOTS.length,
      starter_types: getStarterTypes(),
      data_surfaces: getDataSurfaces(),
    },
    required_new_module_fields: [
      "id",
      "title",
      "shortTitle",
      "description",
      "category",
      "status",
      "route",
      "icon",
      "capabilities",
      "dataSurfaces",
      "extensionSlots",
      "starter",
    ],
    required_extension_slots: MODULE_EXTENSION_SLOTS.map((slot) => slot.id),
    summary: summarizeSteps(steps),
    steps,
  };
}

function buildOnboardingSteps(): ModuleOnboardingStep[] {
  const slotIds = MODULE_EXTENSION_SLOTS.map((slot) => slot.id).join(", ");
  const starterTypes = getStarterTypes().join(", ");

  return [
    {
      id: "stable-registry-entry",
      phase: "registry",
      status: "ready",
      title: "Stable registry entry",
      evidence: `${PLATFORM_MODULES.length} modules are registered through PLATFORM_MODULES with stable ids, categories, statuses, capabilities, data surfaces, extension slots, and starters.`,
      required_action:
        "Add every future module to src/lib/modules/registry.ts before creating a visible page or command.",
      privacy_boundary:
        "Registry entries describe module metadata only and must not include page text, database row values, file bytes, tokens, or user-specific holdings.",
    },
    {
      id: "route-before-first-class-module",
      phase: "route",
      status: "manual-confirmation",
      title: "Routable module page",
      evidence: `${PLATFORM_MODULES.filter((module) => module.route).length} modules currently expose a route.`,
      required_action:
        "If a module is user-facing, create a route under /modules/<module-id> and keep the page local-first until cloud boundaries are proven.",
      privacy_boundary:
        "Routes may render local metadata and user-controlled local content, but new modules must not call cloud services or AI by default.",
    },
    {
      id: "starter-safety",
      phase: "starter",
      status: "manual-confirmation",
      title: "Starter action safety",
      evidence: `${PLATFORM_MODULES.filter((module) => module.starter).length} modules expose local starter actions across ${starterTypes}.`,
      required_action:
        "Only add a starter when it creates local pages, local databases, or preset local trackers with no cloud writes and no destructive side effects.",
      privacy_boundary:
        "Starters must never upload workspace data, call AI, send emails, connect brokers, restore backups, or delete user content without a typed confirmation gate.",
    },
    {
      id: "extension-slot-selection",
      phase: "extension-slots",
      status: "ready",
      title: "Extension slot selection",
      evidence: `${MODULE_EXTENSION_SLOTS.length} extension slots are available: ${slotIds}.`,
      required_action:
        "Attach new modules only to declared slots; add a new slot first when a module needs a new integration surface.",
      privacy_boundary:
        "Slot declarations describe integration surfaces only and do not execute commands or read workspace data.",
    },
    {
      id: "data-surface-boundary",
      phase: "data-boundary",
      status: "ready",
      title: "Data surface boundary",
      evidence: `${getDataSurfaces().length} current data surfaces are declared across modules.`,
      required_action:
        "Declare every data surface a module touches, such as pages, files, databases, sync_log, comments, reports, meetings, or relations.",
      privacy_boundary:
        "Data surface names are metadata; module contracts must not embed page bodies, database values, report content, or file bytes.",
    },
    {
      id: "high-risk-action-gates",
      phase: "privacy",
      status: "blocked",
      title: "High-risk action gates",
      evidence:
        "Cloud sync, AI execution, external asset loading, restore write-back, broker import, bulk delete, and sharing require explicit confirmation contracts.",
      required_action:
        "Before a module triggers any high-risk action, connect it to the existing typed confirmation and payload preview contracts.",
      privacy_boundary:
        "High-risk actions must show what data would leave the browser or be changed before the action can run.",
    },
    {
      id: "module-docs",
      phase: "documentation",
      status: "manual-confirmation",
      title: "Module documentation",
      evidence:
        "README documents the current module architecture, preset workspace starters, module manifest, and research workflow schema.",
      required_action:
        "Document every new module's purpose, route, starter behavior, data surfaces, privacy boundary, and verification command.",
      privacy_boundary:
        "Documentation should describe behavior and boundaries, not private examples from the user's workspace.",
    },
    {
      id: "module-verification",
      phase: "verification",
      status: "ready",
      title: "Module verification",
      evidence:
        "A module verifier can check registry fields, route files, extension slots, starter safety, sidebar/quick-search wiring, and local-only boundaries.",
      required_action:
        "Run npm run verify:modules before treating a new module as part of the platform.",
      privacy_boundary:
        "Verification checks source contracts and route files only; it must not inspect private page bodies, database rows, file bytes, tokens, or credentials.",
    },
  ];
}

function getStarterTypes() {
  return [
    ...new Set(
      PLATFORM_MODULES.map((module) => module.starter?.type).filter(
        (type): type is NonNullable<ModuleStarter>["type"] => Boolean(type)
      )
    ),
  ].sort();
}

function getDataSurfaces() {
  return [
    ...new Set(PLATFORM_MODULES.flatMap((module) => module.dataSurfaces)),
  ].sort();
}

function summarizeSteps(steps: ModuleOnboardingStep[]) {
  return {
    steps: steps.length,
    ready: steps.filter((step) => step.status === "ready").length,
    manual_confirmation: steps.filter(
      (step) => step.status === "manual-confirmation"
    ).length,
    blocked: steps.filter((step) => step.status === "blocked").length,
  };
}
