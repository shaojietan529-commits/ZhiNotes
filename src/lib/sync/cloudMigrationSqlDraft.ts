import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type { AccountSessionBoundary } from "@/lib/security/accountSessionBoundary";
import type { CloudSchemaMigrationPlan } from "@/lib/sync/cloudSchemaMigrationPlan";

export type CloudMigrationSqlStatus =
  | "drafted"
  | "manual-confirmation"
  | "blocked";

export interface CloudMigrationSqlDraftInput {
  cloudSchemaMigrationPlan: CloudSchemaMigrationPlan | null;
  accountSessionBoundary: AccountSessionBoundary | null;
  permissionDecisionReport: PermissionDecisionReport | null;
  auditTrailPolicy: AuditTrailPolicy | null;
}

export interface CloudMigrationSqlStatement {
  id: string;
  table_name: string;
  status: CloudMigrationSqlStatus;
  order: number;
  purpose: string;
  privacy_boundary: string;
  sql_up: string;
  sql_down: string;
}

export interface CloudMigrationSqlGate {
  id: string;
  title: string;
  status: CloudMigrationSqlStatus;
  evidence: string;
  required_action: string;
}

export interface CloudMigrationSqlDraft {
  format: "zhinote-cloud-migration-sql-draft";
  format_version: 1;
  draft_status: "local-sql-draft-only";
  can_apply_migrations: false;
  disabled_endpoint: "/api/cloud/migrations/apply";
  privacy_note: string;
  boundary: {
    local_sql_draft_only: true;
    connects_cloud_database: false;
    creates_database_migrations: false;
    applies_sql: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
    requires_owner_confirmation_before_apply: true;
  };
  summary: {
    statements: number;
    drafted: number;
    manual_confirmation: number;
    blocked: number;
    required_tables: number;
    high_sensitivity_tables: number;
  };
  required_extensions: string[];
  statements: CloudMigrationSqlStatement[];
  gates: CloudMigrationSqlGate[];
}

export function buildCloudMigrationSqlDraft(
  input: CloudMigrationSqlDraftInput
): CloudMigrationSqlDraft {
  const statements = buildStatements(input.cloudSchemaMigrationPlan);
  const gates = buildGates(input);
  const requiredTables =
    input.cloudSchemaMigrationPlan?.summary.required_tables ?? 0;
  const highSensitivityTables =
    input.cloudSchemaMigrationPlan?.summary.high_sensitivity_tables ?? 0;

  return {
    format: "zhinote-cloud-migration-sql-draft",
    format_version: 1,
    draft_status: "local-sql-draft-only",
    can_apply_migrations: false,
    disabled_endpoint: "/api/cloud/migrations/apply",
    privacy_note:
      "Generated locally. This SQL draft does not connect a cloud database, create migrations, apply SQL, write server data, upload workspace data, read page text, or read file bytes.",
    boundary: {
      local_sql_draft_only: true,
      connects_cloud_database: false,
      creates_database_migrations: false,
      applies_sql: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      reads_page_body_text: false,
      reads_file_bytes: false,
      requires_owner_confirmation_before_apply: true,
    },
    summary: {
      statements: statements.length,
      drafted: statements.filter((statement) => statement.status === "drafted")
        .length,
      manual_confirmation: statements.filter(
        (statement) => statement.status === "manual-confirmation"
      ).length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
      required_tables: requiredTables,
      high_sensitivity_tables: highSensitivityTables,
    },
    required_extensions: ["pgcrypto"],
    statements,
    gates,
  };
}

function buildStatements(
  plan: CloudSchemaMigrationPlan | null
): CloudMigrationSqlStatement[] {
  if (!plan) return [];

  return plan.tables.map((table, index) => {
    const status =
      table.contract_status === "required"
        ? "manual-confirmation"
        : ("drafted" as CloudMigrationSqlStatus);

    return {
      id: `create-${table.table_name}`,
      table_name: table.table_name,
      status,
      order: index + 1,
      purpose: table.local_evidence,
      privacy_boundary: table.privacy_boundary,
      sql_up: getCreateTableSql(table.table_name),
      sql_down: `drop table if exists ${table.table_name} cascade;`,
    };
  });
}

function buildGates(input: CloudMigrationSqlDraftInput): CloudMigrationSqlGate[] {
  return [
    {
      id: "account-session",
      title: "Account and session boundary",
      status: input.accountSessionBoundary ? "manual-confirmation" : "blocked",
      evidence: input.accountSessionBoundary
        ? `Account/session boundary covers ${input.accountSessionBoundary.summary.phases} phases, but auth routes remain disabled.`
        : "No account/session boundary is attached to the SQL draft.",
      required_action:
        "Choose auth provider, secure session storage, workspace membership checks, and local-to-cloud confirmation before applying user/workspace tables.",
    },
    {
      id: "permission-enforcement",
      title: "Permission enforcement",
      status: input.permissionDecisionReport
        ? "manual-confirmation"
        : "blocked",
      evidence: input.permissionDecisionReport
        ? `Permission decisions cover ${input.permissionDecisionReport.summary.matrix_decisions} role/resource/action combinations, but server enforcement is disabled.`
        : "No permission decision report is attached to the SQL draft.",
      required_action:
        "Implement /api/permissions/check before any cloud route trusts workspace membership or role rows.",
    },
    {
      id: "audit-retention",
      title: "Audit retention",
      status: input.auditTrailPolicy ? "manual-confirmation" : "blocked",
      evidence: input.auditTrailPolicy
        ? `Audit policy covers ${input.auditTrailPolicy.summary.events} event types, but audit writes remain disabled.`
        : "No audit policy is attached to the SQL draft.",
      required_action:
        "Choose audit retention, redaction, owner-only audit export, and incident review rules before creating audit_events.",
    },
    {
      id: "migration-rollback",
      title: "Migration rollback proof",
      status: "blocked",
      evidence:
        "SQL down statements are drafted locally, but no clean database replay or rollback test has run.",
      required_action:
        "Run migrations on a disposable beta database, validate seed data, then prove rollback before private beta.",
    },
  ];
}

function getCreateTableSql(tableName: string) {
  switch (tableName) {
    case "users":
      return [
        "create table if not exists users (",
        "  id uuid primary key default gen_random_uuid(),",
        "  email_normalized text unique,",
        "  display_name text,",
        "  status text not null default 'active',",
        "  created_at timestamptz not null default now(),",
        "  updated_at timestamptz not null default now()",
        ");",
      ].join("\n");
    case "workspaces":
      return [
        "create table if not exists workspaces (",
        "  id uuid primary key default gen_random_uuid(),",
        "  owner_user_id uuid references users(id) on delete restrict,",
        "  name text not null,",
        "  beta_status text not null default 'private-beta',",
        "  settings jsonb not null default '{}'::jsonb,",
        "  created_at timestamptz not null default now(),",
        "  updated_at timestamptz not null default now()",
        ");",
      ].join("\n");
    case "workspace_members":
      return [
        "create table if not exists workspace_members (",
        "  workspace_id uuid not null references workspaces(id) on delete cascade,",
        "  user_id uuid not null references users(id) on delete cascade,",
        "  role_id text not null check (role_id in ('owner', 'researcher', 'viewer')),",
        "  status text not null default 'active',",
        "  created_at timestamptz not null default now(),",
        "  updated_at timestamptz not null default now(),",
        "  primary key (workspace_id, user_id)",
        ");",
      ].join("\n");
    case "pages":
      return [
        "create table if not exists pages (",
        "  id uuid primary key default gen_random_uuid(),",
        "  workspace_id uuid not null references workspaces(id) on delete cascade,",
        "  parent_id uuid references pages(id) on delete set null,",
        "  title text not null,",
        "  icon text,",
        "  cover jsonb,",
        "  body jsonb not null default '{}'::jsonb,",
        "  sort_order integer not null default 0,",
        "  locked boolean not null default false,",
        "  deleted_at timestamptz,",
        "  created_at timestamptz not null default now(),",
        "  updated_at timestamptz not null default now()",
        ");",
      ].join("\n");
    case "page_versions":
      return [
        "create table if not exists page_versions (",
        "  id uuid primary key default gen_random_uuid(),",
        "  workspace_id uuid not null references workspaces(id) on delete cascade,",
        "  page_id uuid not null references pages(id) on delete cascade,",
        "  version_number integer not null,",
        "  snapshot jsonb not null,",
        "  created_by uuid references users(id) on delete set null,",
        "  created_at timestamptz not null default now(),",
        "  unique (page_id, version_number)",
        ");",
      ].join("\n");
    case "comments":
      return [
        "create table if not exists comments (",
        "  id uuid primary key default gen_random_uuid(),",
        "  workspace_id uuid not null references workspaces(id) on delete cascade,",
        "  page_id uuid references pages(id) on delete cascade,",
        "  block_id text,",
        "  author_user_id uuid references users(id) on delete set null,",
        "  body jsonb not null,",
        "  resolved_at timestamptz,",
        "  deleted_at timestamptz,",
        "  created_at timestamptz not null default now(),",
        "  updated_at timestamptz not null default now()",
        ");",
      ].join("\n");
    case "databases":
      return [
        "create table if not exists databases (",
        "  id uuid primary key default gen_random_uuid(),",
        "  workspace_id uuid not null references workspaces(id) on delete cascade,",
        "  page_id uuid references pages(id) on delete set null,",
        "  title text not null,",
        "  schema jsonb not null default '{}'::jsonb,",
        "  rows jsonb not null default '[]'::jsonb,",
        "  views jsonb not null default '[]'::jsonb,",
        "  created_at timestamptz not null default now(),",
        "  updated_at timestamptz not null default now()",
        ");",
      ].join("\n");
    case "files":
      return [
        "create table if not exists files (",
        "  id uuid primary key default gen_random_uuid(),",
        "  workspace_id uuid not null references workspaces(id) on delete cascade,",
        "  page_id uuid references pages(id) on delete set null,",
        "  file_name text not null,",
        "  mime_type text,",
        "  size_bytes bigint not null default 0,",
        "  checksum text,",
        "  storage_key text not null,",
        "  preview_kind text,",
        "  render_status text not null default 'pending',",
        "  created_at timestamptz not null default now(),",
        "  updated_at timestamptz not null default now()",
        ");",
      ].join("\n");
    case "sync_log":
      return [
        "create table if not exists sync_log (",
        "  id uuid primary key default gen_random_uuid(),",
        "  workspace_id uuid not null references workspaces(id) on delete cascade,",
        "  device_id text not null,",
        "  table_name text not null,",
        "  row_id text not null,",
        "  operation text not null check (operation in ('insert', 'update', 'delete', 'restore')),",
        "  changed_fields text[] not null default '{}',",
        "  status text not null default 'pending',",
        "  retry_count integer not null default 0,",
        "  remote_ack_at timestamptz,",
        "  created_at timestamptz not null default now()",
        ");",
      ].join("\n");
    case "audit_events":
      return [
        "create table if not exists audit_events (",
        "  id uuid primary key default gen_random_uuid(),",
        "  workspace_id uuid not null references workspaces(id) on delete cascade,",
        "  actor_user_id uuid references users(id) on delete set null,",
        "  device_id text,",
        "  event_type text not null,",
        "  resource_type text,",
        "  resource_id text,",
        "  metadata jsonb not null default '{}'::jsonb,",
        "  created_at timestamptz not null default now()",
        ");",
      ].join("\n");
    default:
      return [
        `create table if not exists ${tableName} (`,
        "  id uuid primary key default gen_random_uuid(),",
        "  workspace_id uuid not null references workspaces(id) on delete cascade,",
        "  metadata jsonb not null default '{}'::jsonb,",
        "  created_at timestamptz not null default now(),",
        "  updated_at timestamptz not null default now()",
        ");",
      ].join("\n");
  }
}
