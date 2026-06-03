import type {
  CloudSchemaTableContract,
  WebBetaContractStatus,
} from "@/lib/sync/webBetaContract";

export type CloudMigrationStepStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export type CloudMigrationSensitivity = "low" | "medium" | "high";

export interface CloudSchemaMigrationPlanInput {
  activePages: number;
  deletedPages: number;
  databases: number;
  uploadedFiles: number;
  syncRows: number;
  pendingSyncRows: number;
  tableContracts: CloudSchemaTableContract[];
}

export interface CloudMigrationTableRow {
  table_name: string;
  contract_status: WebBetaContractStatus;
  migration_order: number;
  local_source: string;
  local_evidence: string;
  sensitivity: CloudMigrationSensitivity;
  privacy_boundary: string;
  required_before_beta: string;
}

export interface CloudMigrationStep {
  id: string;
  title: string;
  status: CloudMigrationStepStatus;
  evidence: string;
  required_action: string;
}

export interface CloudSchemaMigrationPlan {
  format: "zhinote-cloud-schema-migration-plan";
  format_version: 1;
  plan_status: "local-plan-only";
  privacy_note: string;
  boundary: {
    local_plan_only: true;
    creates_database_migrations: false;
    connects_cloud_database: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    requires_user_confirmation_before_cloud: true;
  };
  local_scope: {
    active_pages: number;
    deleted_pages: number;
    databases: number;
    uploaded_files: number;
    sync_log_rows: number;
    pending_sync_rows: number;
  };
  summary: {
    contracted_tables: number;
    required_tables: number;
    high_sensitivity_tables: number;
    blocked_steps: number;
    manual_confirmation_steps: number;
  };
  tables: CloudMigrationTableRow[];
  steps: CloudMigrationStep[];
}

export function buildCloudSchemaMigrationPlan(
  input: CloudSchemaMigrationPlanInput
): CloudSchemaMigrationPlan {
  const tables = input.tableContracts.map((table, index) =>
    buildTableRow(table, index + 1, input)
  );
  const steps = buildSteps(input);

  return {
    format: "zhinote-cloud-schema-migration-plan",
    format_version: 1,
    plan_status: "local-plan-only",
    privacy_note:
      "Generated locally. This plan does not create migrations, connect a cloud database, write server data, upload workspace data, or share notes.",
    boundary: {
      local_plan_only: true,
      creates_database_migrations: false,
      connects_cloud_database: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      requires_user_confirmation_before_cloud: true,
    },
    local_scope: {
      active_pages: input.activePages,
      deleted_pages: input.deletedPages,
      databases: input.databases,
      uploaded_files: input.uploadedFiles,
      sync_log_rows: input.syncRows,
      pending_sync_rows: input.pendingSyncRows,
    },
    summary: {
      contracted_tables: tables.length,
      required_tables: tables.filter((table) => table.contract_status === "required")
        .length,
      high_sensitivity_tables: tables.filter(
        (table) => table.sensitivity === "high"
      ).length,
      blocked_steps: steps.filter((step) => step.status === "blocked").length,
      manual_confirmation_steps: steps.filter(
        (step) => step.status === "manual-confirmation"
      ).length,
    },
    tables,
    steps,
  };
}

function buildTableRow(
  table: CloudSchemaTableContract,
  migrationOrder: number,
  input: CloudSchemaMigrationPlanInput
): CloudMigrationTableRow {
  return {
    table_name: table.tableName,
    contract_status: table.status,
    migration_order: migrationOrder,
    local_source: table.localSource,
    local_evidence: getLocalEvidence(table.tableName, input),
    sensitivity: getTableSensitivity(table.tableName),
    privacy_boundary: table.privacyBoundary,
    required_before_beta: getRequiredAction(table),
  };
}

function buildSteps(input: CloudSchemaMigrationPlanInput): CloudMigrationStep[] {
  return [
    {
      id: "auth-foundation",
      title: "Create auth and workspace foundation",
      status: "blocked",
      evidence:
        "Auth routes are disabled local stubs and no account provider is selected.",
      required_action:
        "Choose auth provider, session model, workspace ownership, and membership roles before migrations are enabled.",
    },
    {
      id: "content-schema",
      title: "Version content tables",
      status: "manual-confirmation",
      evidence: `${input.activePages} active pages, ${input.deletedPages} trash pages, and ${input.databases} databases exist locally.`,
      required_action:
        "Create versioned migrations for pages, versions, comments, database definitions, rows, views, and relation fields.",
    },
    {
      id: "private-file-storage",
      title: "Add private file storage",
      status: "blocked",
      evidence: `${input.uploadedFiles} uploaded files are stored locally and need private buckets before sync.`,
      required_action:
        "Define private storage buckets, signed URLs, checksums, retention policy, file size limits, and blocked public listing.",
    },
    {
      id: "sync-and-audit",
      title: "Create sync and audit tables",
      status: "manual-confirmation",
      evidence: `${input.syncRows} local sync_log rows exist; ${input.pendingSyncRows} are pending.`,
      required_action:
        "Add sync batch state, retry state, remote acknowledgements, cursors, and audit events for login/export/restore/sync/AI actions.",
    },
    {
      id: "migration-rollback",
      title: "Prove migration rollback",
      status: "blocked",
      evidence:
        "No cloud migrations exist yet, so rollback has not been tested.",
      required_action:
        "Require reversible migration scripts, seed validation, backup restore, and manual launch checklist before private beta.",
    },
  ];
}

function getLocalEvidence(
  tableName: string,
  input: CloudSchemaMigrationPlanInput
) {
  switch (tableName) {
    case "pages":
      return `${input.activePages} active pages and ${input.deletedPages} trash pages are currently visible locally.`;
    case "databases":
      return `${input.databases} local databases are currently visible.`;
    case "files":
      return `${input.uploadedFiles} local uploaded files are currently indexed.`;
    case "sync_log":
      return `${input.syncRows} sync_log rows exist locally; ${input.pendingSyncRows} rows are pending.`;
    case "users":
    case "audit_events":
      return "No local table exists yet; this must be created server-side.";
    default:
      return "Local source is contracted, but migration code is not implemented.";
  }
}

function getTableSensitivity(tableName: string): CloudMigrationSensitivity {
  if (
    [
      "pages",
      "page_versions",
      "comments",
      "databases",
      "files",
      "sync_log",
    ].includes(tableName)
  ) {
    return "high";
  }

  if (["workspace_members", "audit_events"].includes(tableName)) {
    return "medium";
  }

  return "low";
}

function getRequiredAction(table: CloudSchemaTableContract) {
  if (table.status === "required") {
    return "Required before private beta cloud sync can be enabled.";
  }

  if (table.status === "planned") {
    return "Planned before public launch or broader beta expansion.";
  }

  if (table.status === "local-draft") {
    return "Local draft must be converted into a server-backed migration.";
  }

  if (table.status === "manual-confirmation") {
    return "Needs explicit user confirmation before any cloud write path uses it.";
  }

  return "Blocked until its prerequisite launch gate is resolved.";
}
