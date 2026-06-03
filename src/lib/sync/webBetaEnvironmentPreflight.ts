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
      key: "ZHINOTES_CLOUD_ENABLED",
      label: "Cloud route enable flag",
      group: "deployment",
      required: true,
      purpose: "Explicit switch for allowing guarded cloud routes to talk to Supabase.",
      privacy_boundary:
        "Boolean flag only; it must not include user, token, or workspace content.",
    },
    {
      key: "ZHINOTES_ALLOW_CLOUD_WRITES",
      label: "Cloud write enable flag",
      group: "security",
      required: true,
      purpose: "Separate write gate for login start, logout, workspace create, and future write APIs.",
      privacy_boundary:
        "Boolean flag only; keeping it false prevents cloud writes even when read config is present.",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Supabase project URL",
      group: "database",
      required: true,
      purpose: "Supabase project URL for Auth and PostgREST calls.",
      privacy_boundary:
        "Presence check only; do not return project-specific values in exported reports.",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "Supabase anon key",
      group: "auth",
      required: true,
      purpose: "Public Supabase anon key used with user Bearer tokens for Auth and workspace metadata.",
      privacy_boundary:
        "Presence check only; key values must never be included in browser-visible preflight exports.",
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Supabase service role key",
      group: "database",
      required: true,
      purpose: "Server-only key reserved for migrations, bootstrap checks, and future privileged maintenance.",
      privacy_boundary:
        "Presence check only; the service role key must never be returned to the browser or committed.",
    },
    {
      key: "SUPABASE_STORAGE_BUCKET",
      label: "Private storage bucket",
      group: "storage",
      required: true,
      purpose: "Private Supabase Storage bucket for future synced report and document files.",
      privacy_boundary:
        "Presence check only; bucket policy and credentials must stay private.",
    },
    {
      key: "NEXT_PUBLIC_APP_URL",
      label: "App base URL",
      group: "deployment",
      required: true,
      purpose: "Canonical web beta URL for redirects, email links, and deployment checks.",
      privacy_boundary:
        "Presence check only; no user-specific link or token should be exposed.",
    },
    {
      key: "ZHINOTES_AUTH_REDIRECT_ORIGINS",
      label: "Auth redirect allowlist",
      group: "security",
      required: true,
      purpose: "Allowed browser origins for Supabase magic-link redirects and future CSRF/CORS checks.",
      privacy_boundary:
        "Presence check only; do not expose request tokens or session cookies.",
    },
    {
      key: "ZHINOTES_AUDIT_RETENTION_DAYS",
      label: "Audit retention days",
      group: "observability",
      required: true,
      purpose: "Retention window for login, sync, export, restore, sharing, permission, and AI audit events.",
      privacy_boundary:
        "Presence check only; audit events should avoid full research payloads.",
    },
    {
      key: "ZHINOTES_ERROR_MONITORING_DSN",
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
