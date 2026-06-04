import {
  MODULE_EXTENSION_SLOTS,
  PLATFORM_MODULES,
  type ModuleCategory,
  type ModuleStatus,
  type PlatformModule,
} from "@/lib/modules/registry";

export type ModuleStarterPackStatus =
  | "ready"
  | "manual-confirmation"
  | "blocked";

export type ModuleStarterPackItemType =
  | "registry"
  | "route"
  | "shell"
  | "starter"
  | "extension-slot"
  | "data-surface"
  | "privacy"
  | "verification"
  | "documentation";

export interface ModuleStarterPackFile {
  path_template: string;
  item_type: ModuleStarterPackItemType;
  required_for: string;
  status: ModuleStarterPackStatus;
  privacy_boundary: string;
}

export interface ModuleStarterPackChecklistItem {
  id: string;
  item_type: ModuleStarterPackItemType;
  status: ModuleStarterPackStatus;
  title: string;
  evidence: string;
  required_action: string;
  privacy_boundary: string;
}

export interface ModuleStarterPackExtensionSlot {
  slot_id: (typeof MODULE_EXTENSION_SLOTS)[number]["id"];
  title: string;
  required_decision: string;
  current_module_ids: string[];
}

export interface ModuleStarterPackRiskGate {
  id: string;
  status: ModuleStarterPackStatus;
  title: string;
  trigger: string;
  required_before_enablement: string;
}

export interface ModuleStarterPackContract {
  format: "zhinote-module-starter-pack";
  format_version: 1;
  contract_status: "local-new-module-starter-contract";
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    creates_files_now: false;
    creates_modules_now: false;
    writes_workspace_data: false;
    reads_page_text: false;
    reads_database_rows: false;
    reads_file_bytes: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
    enables_external_assets: false;
  };
  new_module_template: {
    id_template: string;
    route_template: string;
    shell_component_template: string;
    allowed_categories: ModuleCategory[];
    allowed_statuses: ModuleStatus[];
    required_registry_fields: Array<keyof PlatformModule>;
    allowed_starter_types: Array<NonNullable<PlatformModule["starter"]>["type"]>;
  };
  summary: {
    registered_modules: number;
    starter_modules: number;
    extension_slots: number;
    files: number;
    checklist_items: number;
    risk_gates: number;
    ready: number;
    manual_confirmation: number;
    blocked: number;
  };
  required_files: ModuleStarterPackFile[];
  extension_slots: ModuleStarterPackExtensionSlot[];
  checklist: ModuleStarterPackChecklistItem[];
  risk_gates: ModuleStarterPackRiskGate[];
  verification_commands: string[];
}

const REQUIRED_REGISTRY_FIELDS: Array<keyof PlatformModule> = [
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
];

const ALLOWED_STARTER_TYPES: Array<
  NonNullable<PlatformModule["starter"]>["type"]
> = ["route", "page", "database", "workspace"];

export function buildModuleStarterPackContract(): ModuleStarterPackContract {
  const requiredFiles = buildRequiredFiles();
  const checklist = buildChecklist();
  const riskGates = buildRiskGates();
  const statuses = [
    ...requiredFiles.map((item) => item.status),
    ...checklist.map((item) => item.status),
    ...riskGates.map((item) => item.status),
  ];

  return {
    format: "zhinote-module-starter-pack",
    format_version: 1,
    contract_status: "local-new-module-starter-contract",
    privacy_note:
      "Generated locally from module registry metadata. This starter pack defines the files, registry fields, extension slots, data boundaries, privacy gates, and verification commands required before adding a new module. It does not create files, create modules, write workspace data, read page text, read database rows, read file bytes, connect cloud services, upload data, enable AI, or enable external assets.",
    boundary: {
      local_contract_only: true,
      creates_files_now: false,
      creates_modules_now: false,
      writes_workspace_data: false,
      reads_page_text: false,
      reads_database_rows: false,
      reads_file_bytes: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
      enables_external_assets: false,
    },
    new_module_template: {
      id_template: "lowercase-kebab-case-module-id",
      route_template: "/modules/<module-id>",
      shell_component_template: "src/components/modules/<ModuleName>Shell.tsx",
      allowed_categories: ["Workspace", "Research", "Data", "Automation"],
      allowed_statuses: ["active", "beta", "planned"],
      required_registry_fields: REQUIRED_REGISTRY_FIELDS,
      allowed_starter_types: ALLOWED_STARTER_TYPES,
    },
    summary: {
      registered_modules: PLATFORM_MODULES.length,
      starter_modules: PLATFORM_MODULES.filter((module) => module.starter)
        .length,
      extension_slots: MODULE_EXTENSION_SLOTS.length,
      files: requiredFiles.length,
      checklist_items: checklist.length,
      risk_gates: riskGates.length,
      ready: statuses.filter((status) => status === "ready").length,
      manual_confirmation: statuses.filter(
        (status) => status === "manual-confirmation"
      ).length,
      blocked: statuses.filter((status) => status === "blocked").length,
    },
    required_files: requiredFiles,
    extension_slots: buildExtensionSlots(),
    checklist,
    risk_gates: riskGates,
    verification_commands: [
      "npm run verify:modules",
      "npm run verify:research-workflow",
      "npm run verify:web-beta",
      "npm run lint",
      "npm run build",
    ],
  };
}

function buildRequiredFiles(): ModuleStarterPackFile[] {
  return [
    file(
      "src/lib/modules/registry.ts",
      "registry",
      "Add the PlatformModule entry before exposing navigation or commands.",
      "ready",
      "Registry metadata must not include private notes, row values, file bytes, holdings, tokens, or credentials."
    ),
    file(
      "src/app/(workspace)/modules/<module-id>/page.tsx",
      "route",
      "Create a routable local module page when the module is user-facing.",
      "manual-confirmation",
      "New routes must stay local-first and must not call cloud services or AI by default."
    ),
    file(
      "src/components/modules/<ModuleName>Shell.tsx",
      "shell",
      "Render the module surface behind DatabaseProvider and Sidebar if it needs workspace context.",
      "manual-confirmation",
      "Shell components may render local metadata and user-controlled local content only."
    ),
    file(
      "src/lib/<domain>/<moduleContract>.ts",
      "data-surface",
      "Define local contracts, readiness reports, or playbooks for the module domain.",
      "manual-confirmation",
      "Domain contracts should summarize schema and workflow metadata, not embed private research payloads."
    ),
    file(
      "src/lib/modules/actions.ts",
      "starter",
      "Wire a starter only when it creates safe local pages, databases, or preset trackers.",
      "manual-confirmation",
      "Starter actions must not upload data, delete data, call AI, restore backups, connect brokers, or send messages without typed confirmation."
    ),
    file(
      "scripts/verify-module-contract.mjs",
      "verification",
      "Add source checks for the new module id, route file, extension slots, and privacy boundaries.",
      "ready",
      "Verification reads source files only and must not inspect private workspace content."
    ),
    file(
      "README.md",
      "documentation",
      "Document the module purpose, route, starter behavior, data surfaces, privacy boundary, and verification command.",
      "ready",
      "Documentation should use generic examples and avoid private user research facts."
    ),
  ];
}

function buildExtensionSlots(): ModuleStarterPackExtensionSlot[] {
  return MODULE_EXTENSION_SLOTS.map((slot) => ({
    slot_id: slot.id,
    title: slot.title,
    required_decision:
      "Choose this slot only if the module needs that integration surface; otherwise leave it out of extensionSlots.",
    current_module_ids: PLATFORM_MODULES.filter((module) =>
      module.extensionSlots.includes(slot.id)
    ).map((module) => module.id),
  }));
}

function buildChecklist(): ModuleStarterPackChecklistItem[] {
  return [
    item(
      "define-module-identity",
      "registry",
      "ready",
      "Define stable module identity",
      `${PLATFORM_MODULES.length} modules already use stable registry metadata.`,
      "Choose id, title, shortTitle, category, status, icon, route, capabilities, data surfaces, extension slots, and starter.",
      "The module identity must describe product behavior only and must not include private workspace examples."
    ),
    item(
      "declare-data-surfaces",
      "data-surface",
      "ready",
      "Declare data surfaces",
      "Current modules declare pages, databases, files, comments, relations, sync_log, reports, meetings, and workspace backup surfaces.",
      "List every table, file class, relation, queue, or external input the module can touch before implementation.",
      "Data surface names are allowed metadata; raw row values, note bodies, file bytes, and prompts are forbidden."
    ),
    item(
      "choose-extension-slots",
      "extension-slot",
      "ready",
      `${MODULE_EXTENSION_SLOTS.length} extension slots available`,
      "Sidebar, quick search, page block, database view, and file renderer slots are registered.",
      "Attach the module only to declared slots and add a new slot contract before inventing a new integration surface.",
      "Slots describe UI integration points only and must not execute commands or read workspace data by themselves."
    ),
    item(
      "add-local-route-shell",
      "route",
      "manual-confirmation",
      "Add local route and shell",
      "Routable modules use /modules/<module-id> and a matching shell component.",
      "Keep the first route useful without cloud writes, AI calls, broker connections, or external assets.",
      "Routes must display local state and explicit disabled/gated status for high-risk actions."
    ),
    item(
      "wire-safe-starter",
      "starter",
      "manual-confirmation",
      "Wire safe starter",
      `${PLATFORM_MODULES.filter((module) => module.starter).length} current modules have starter actions.`,
      "Only add route, page, database, or workspace starters that create local artifacts and navigate to them.",
      "Starters require typed confirmation before any destructive action, cloud sync, AI execution, external import, or bulk operation."
    ),
    item(
      "document-user-workflow",
      "documentation",
      "ready",
      "Document user workflow",
      "README and Module Hub already describe platform modules, onboarding, health, and verification.",
      "Document what the module is for, where it appears, what it creates, what it reads, and which risks remain blocked.",
      "Use generic workflow descriptions instead of private user research examples."
    ),
    item(
      "extend-verification",
      "verification",
      "ready",
      "Extend verification",
      "verify:modules checks registry fields, routes, starters, slots, dashboard wiring, docs, and local-only boundaries.",
      "Add verifier assertions for the new module id, route, starter, slots, boundary, and documentation.",
      "Verification must remain source-only and must not query local workspace rows or files."
    ),
    item(
      "gate-high-risk-actions",
      "privacy",
      "blocked",
      "Gate high-risk actions",
      "Cloud sync, AI, external assets, broker import, restore write-back, sharing, bulk import, and bulk delete are not automatic module capabilities.",
      "Connect high-risk actions to payload preview, typed confirmation, permission checks, and audit events before enabling them.",
      "The user must see exactly what data leaves the browser or changes before the action can run."
    ),
  ];
}

function buildRiskGates(): ModuleStarterPackRiskGate[] {
  return [
    risk(
      "cloud-sync",
      "blocked",
      "Cloud sync gate",
      "A module wants to push local pages, database rows, files, or queue state to a server.",
      "Require sync payload preview, workspace membership, permission check, audit event, conflict handling, rollback proof, and explicit user confirmation."
    ),
    risk(
      "ai-execution",
      "blocked",
      "AI execution gate",
      "A module wants to send notes, files, database values, or prompts to an AI provider.",
      "Require final payload preview, provider selection, retention decision, audit event, permission check, and explicit user confirmation."
    ),
    risk(
      "external-assets",
      "blocked",
      "External asset gate",
      "A module wants to load remote HTML, report, image, script, spreadsheet, or notebook assets.",
      "Require origin allowlist, visible confirmation, sandboxed rendering, and a no-secret/no-token payload boundary."
    ),
    risk(
      "bulk-or-destructive-action",
      "blocked",
      "Bulk or destructive action gate",
      "A module wants to bulk import, bulk update, delete, restore, overwrite, or share workspace data.",
      "Require rollback snapshot, scope preview, typed confirmation phrase, permission decision, audit event, and failed-action recovery plan."
    ),
  ];
}

function file(
  pathTemplate: string,
  itemType: ModuleStarterPackItemType,
  requiredFor: string,
  status: ModuleStarterPackStatus,
  privacyBoundary: string
): ModuleStarterPackFile {
  return {
    path_template: pathTemplate,
    item_type: itemType,
    required_for: requiredFor,
    status,
    privacy_boundary: privacyBoundary,
  };
}

function item(
  id: string,
  itemType: ModuleStarterPackItemType,
  status: ModuleStarterPackStatus,
  title: string,
  evidence: string,
  requiredAction: string,
  privacyBoundary: string
): ModuleStarterPackChecklistItem {
  return {
    id,
    item_type: itemType,
    status,
    title,
    evidence,
    required_action: requiredAction,
    privacy_boundary: privacyBoundary,
  };
}

function risk(
  id: string,
  status: ModuleStarterPackStatus,
  title: string,
  trigger: string,
  requiredBeforeEnablement: string
): ModuleStarterPackRiskGate {
  return {
    id,
    status,
    title,
    trigger,
    required_before_enablement: requiredBeforeEnablement,
  };
}
