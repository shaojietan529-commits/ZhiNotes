export type WebBetaEnvironmentGroup =
  | "auth"
  | "database"
  | "storage"
  | "deployment"
  | "security"
  | "observability";

export type WebBetaEnvironmentCheckStatus =
  | "present"
  | "missing"
  | "optional-missing";

export interface WebBetaEnvironmentRequirement {
  key: string;
  label: string;
  group: WebBetaEnvironmentGroup;
  required: boolean;
  purpose: string;
  privacy_boundary: string;
}

export interface WebBetaEnvironmentCheck
  extends WebBetaEnvironmentRequirement {
  status: WebBetaEnvironmentCheckStatus;
  present: boolean;
}

export interface WebBetaEnvironmentGroupSummary {
  group: WebBetaEnvironmentGroup;
  required: number;
  present: number;
  missing: number;
}

export interface WebBetaEnvironmentPreflight {
  format: "zhinote-web-beta-environment-preflight";
  format_version: 1;
  preflight_status: "local-preflight-only";
  launch_verdict: "not-ready";
  privacy_note: string;
  boundary: {
    checks_presence_only: true;
    exposes_secret_values: false;
    connects_cloud_services: false;
    creates_accounts: false;
    writes_server_data: false;
    uploads_workspace_data: false;
  };
  summary: {
    total: number;
    required: number;
    present_required: number;
    missing_required: number;
    optional: number;
    present_optional: number;
  };
  groups: WebBetaEnvironmentGroupSummary[];
  checks: WebBetaEnvironmentCheck[];
}

export const WEB_BETA_ENVIRONMENT_REQUIREMENTS: WebBetaEnvironmentRequirement[] =
  [
    {
      key: "ZHINOTE_AUTH_PROVIDER",
      label: "Auth provider",
      group: "auth",
      required: true,
      purpose: "Provider identifier for private beta login.",
      privacy_boundary:
        "Provider name only; no user email, password, token, or cookie value should be exposed.",
    },
    {
      key: "ZHINOTE_SESSION_SECRET",
      label: "Session secret",
      group: "auth",
      required: true,
      purpose: "Server-side secret for signing encrypted beta sessions.",
      privacy_boundary:
        "Presence check only; the secret value must never be returned to the browser.",
    },
    {
      key: "ZHINOTE_DATABASE_URL",
      label: "Cloud database URL",
      group: "database",
      required: true,
      purpose: "Primary cloud database connection string for beta workspaces.",
      privacy_boundary:
        "Presence check only; connection strings and credentials must never be exposed.",
    },
    {
      key: "ZHINOTE_DATABASE_MIGRATION_URL",
      label: "Migration database URL",
      group: "database",
      required: false,
      purpose: "Optional isolated migration connection for deployment pipelines.",
      privacy_boundary:
        "Presence check only; migration credentials must stay server-side.",
    },
    {
      key: "ZHINOTE_FILE_STORAGE_PROVIDER",
      label: "File storage provider",
      group: "storage",
      required: true,
      purpose: "Private storage provider for reports, PDFs, Office files, archives, and notebooks.",
      privacy_boundary:
        "Provider name only; no storage keys or private bucket credentials should be exposed.",
    },
    {
      key: "ZHINOTE_FILE_STORAGE_BUCKET",
      label: "Private file bucket",
      group: "storage",
      required: true,
      purpose: "Private bucket/container for synced file metadata and file bytes.",
      privacy_boundary:
        "Presence check only; bucket policy and credentials must stay private.",
    },
    {
      key: "ZHINOTE_APP_BASE_URL",
      label: "App base URL",
      group: "deployment",
      required: true,
      purpose: "Canonical web beta URL for redirects, email links, and deployment checks.",
      privacy_boundary:
        "Presence check only; no user-specific link or token should be exposed.",
    },
    {
      key: "ZHINOTE_ALLOWED_ORIGIN",
      label: "Allowed browser origin",
      group: "security",
      required: true,
      purpose: "Allowed origin for web beta requests and future CSRF/CORS checks.",
      privacy_boundary:
        "Presence check only; do not expose request tokens or session cookies.",
    },
    {
      key: "ZHINOTE_AUDIT_RETENTION_DAYS",
      label: "Audit retention days",
      group: "observability",
      required: true,
      purpose: "Retention window for login, sync, export, restore, sharing, permission, and AI audit events.",
      privacy_boundary:
        "Presence check only; audit events should avoid full research payloads.",
    },
    {
      key: "ZHINOTE_ERROR_MONITORING_DSN",
      label: "Error monitoring DSN",
      group: "observability",
      required: false,
      purpose: "Optional error monitoring endpoint for private beta incidents.",
      privacy_boundary:
        "Presence check only; monitoring DSN and sampled payloads must not be returned.",
    },
  ];

export function buildWebBetaEnvironmentPreflight(
  readEnv: (key: string) => string | undefined
): WebBetaEnvironmentPreflight {
  const checks: WebBetaEnvironmentCheck[] =
    WEB_BETA_ENVIRONMENT_REQUIREMENTS.map((requirement) => {
      const value = readEnv(requirement.key);
      const present = typeof value === "string" && value.trim().length > 0;
      const status: WebBetaEnvironmentCheckStatus = present
        ? "present"
        : requirement.required
          ? "missing"
          : "optional-missing";

      return {
        ...requirement,
        present,
        status,
      };
    });

  const groups = summarizeEnvironmentGroups(checks);
  const required = checks.filter((check) => check.required);
  const optional = checks.filter((check) => !check.required);

  return {
    format: "zhinote-web-beta-environment-preflight",
    format_version: 1,
    preflight_status: "local-preflight-only",
    launch_verdict: "not-ready",
    privacy_note:
      "Generated locally. This preflight checks only whether expected environment variables are present. It does not expose secret values, connect cloud services, create accounts, write server data, upload workspace data, or share notes.",
    boundary: {
      checks_presence_only: true,
      exposes_secret_values: false,
      connects_cloud_services: false,
      creates_accounts: false,
      writes_server_data: false,
      uploads_workspace_data: false,
    },
    summary: {
      total: checks.length,
      required: required.length,
      present_required: required.filter((check) => check.present).length,
      missing_required: required.filter((check) => !check.present).length,
      optional: optional.length,
      present_optional: optional.filter((check) => check.present).length,
    },
    groups,
    checks,
  };
}

function summarizeEnvironmentGroups(
  checks: WebBetaEnvironmentCheck[]
): WebBetaEnvironmentGroupSummary[] {
  const groups: WebBetaEnvironmentGroup[] = [
    "auth",
    "database",
    "storage",
    "deployment",
    "security",
    "observability",
  ];

  return groups.map((group) => {
    const groupChecks = checks.filter((check) => check.group === group);
    const required = groupChecks.filter((check) => check.required);
    return {
      group,
      required: required.length,
      present: required.filter((check) => check.present).length,
      missing: required.filter((check) => !check.present).length,
    };
  });
}
