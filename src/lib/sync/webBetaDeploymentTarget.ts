import type { WebBetaContractStatus } from "@/lib/sync/webBetaContract";

export type WebBetaDeploymentRole =
  | "primary-app-host"
  | "cloud-data-plane"
  | "edge-security-layer"
  | "future-runtime-option";

export interface WebBetaDeploymentProvider {
  id:
    | "vercel-nextjs"
    | "supabase-cloud"
    | "cloudflare-dns-cdn-waf"
    | "cloudflare-pages"
    | "cloudflare-workers";
  role: WebBetaDeploymentRole;
  status: WebBetaContractStatus;
  purpose: string;
  acceptance: string;
  blocker: string;
}

export interface WebBetaDeploymentTrack {
  id: string;
  title: string;
  status: WebBetaContractStatus;
  evidence: string;
  required_action: string;
}

export interface WebBetaDeploymentTarget {
  format: "zhinote-web-beta-deployment-target";
  format_version: 1;
  target_status: "local-target-contract-only";
  deployment_verdict: "not-ready";
  privacy_note: string;
  selected_strategy: {
    first_web_alpha: "vercel-nextjs";
    cloud_backend: "supabase-cloud";
    edge_layer: "cloudflare-dns-cdn-waf";
    future_edge_runtime_review: "cloudflare-workers";
    rationale: string;
  };
  boundary: {
    local_contract_only: true;
    deploys_app: false;
    creates_cloud_resources: false;
    connects_cloud_services: false;
    reads_secret_values: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    requires_owner_confirmation_before_deploy: true;
  };
  summary: {
    providers: number;
    tracks: number;
    local_draft: number;
    planned: number;
    required: number;
    manual_confirmation: number;
    blocked: number;
  };
  providers: WebBetaDeploymentProvider[];
  tracks: WebBetaDeploymentTrack[];
}

export function buildWebBetaDeploymentTarget(): WebBetaDeploymentTarget {
  const providers = buildDeploymentProviders();
  const tracks = buildDeploymentTracks();

  return {
    format: "zhinote-web-beta-deployment-target",
    format_version: 1,
    target_status: "local-target-contract-only",
    deployment_verdict: "not-ready",
    privacy_note:
      "Generated locally. This target contract does not deploy the app, create cloud projects, connect cloud services, read secret values, write server data, upload workspace data, or share notes.",
    selected_strategy: {
      first_web_alpha: "vercel-nextjs",
      cloud_backend: "supabase-cloud",
      edge_layer: "cloudflare-dns-cdn-waf",
      future_edge_runtime_review: "cloudflare-workers",
      rationale:
        "Use Vercel first because the current app is a Next.js app with server routes. Use Supabase for Auth, Postgres, and private storage. Keep Cloudflare as DNS/CDN/WAF first, then review Workers only after API runtime compatibility is proven.",
    },
    boundary: {
      local_contract_only: true,
      deploys_app: false,
      creates_cloud_resources: false,
      connects_cloud_services: false,
      reads_secret_values: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      requires_owner_confirmation_before_deploy: true,
    },
    summary: summarizeDeploymentTracks(providers, tracks),
    providers,
    tracks,
  };
}

function buildDeploymentProviders(): WebBetaDeploymentProvider[] {
  return [
    {
      id: "vercel-nextjs",
      role: "primary-app-host",
      status: "planned",
      purpose:
        "Host the first private Web Alpha for the existing Next.js frontend and server route structure.",
      acceptance:
        "Preview and production deployments pass lint, build, verify:web-beta, guarded cloud route checks, and owner approval.",
      blocker:
        "Do not deploy until environment variables, Supabase project, callback URL, rollback plan, and beta write gates are reviewed.",
    },
    {
      id: "supabase-cloud",
      role: "cloud-data-plane",
      status: "planned",
      purpose:
        "Provide Auth, Postgres, row-level security, and private storage for future account and workspace data.",
      acceptance:
        "A disposable Supabase project replays migrations, RLS, Auth callback, workspace bootstrap, and private bucket checks.",
      blocker:
        "Do not sync notes, files, databases, or queue rows until payload preview, permissions, conflict review, and rollback proof exist.",
    },
    {
      id: "cloudflare-dns-cdn-waf",
      role: "edge-security-layer",
      status: "manual-confirmation",
      purpose:
        "Add Cloudflare later for domain routing, CDN, WAF, rate limits, and security headers without changing the first app runtime.",
      acceptance:
        "DNS, TLS, cache rules, WAF rules, redirect behavior, and auth callback origins are tested on a staging domain.",
      blocker:
        "Do not put Cloudflare in front of auth callbacks until redirect origins, cache bypass rules, and incident rollback are tested.",
    },
    {
      id: "cloudflare-pages",
      role: "future-runtime-option",
      status: "blocked",
      purpose:
        "Keep Cloudflare Pages as a future hosting option if the app route/runtime model is made compatible.",
      acceptance:
        "A separate compatibility proof shows Next.js routes, auth callback, API stubs, and environment handling work without weakening privacy gates.",
      blocker:
        "Current Web Alpha should not assume Cloudflare Pages can replace the existing Next.js server route deployment path.",
    },
    {
      id: "cloudflare-workers",
      role: "future-runtime-option",
      status: "blocked",
      purpose:
        "Review Workers later for edge API execution, rate limiting, and lightweight authenticated endpoints.",
      acceptance:
        "Worker runtime tests prove Supabase calls, request body limits, signed URL generation, audit events, and rollback paths.",
      blocker:
        "Do not move protected APIs to Workers until runtime compatibility, secrets handling, and observability are proven.",
    },
  ];
}

function buildDeploymentTracks(): WebBetaDeploymentTrack[] {
  return [
    {
      id: "frontend-hosting",
      title: "Frontend hosting",
      status: "planned",
      evidence:
        "The first Web Alpha target is Vercel because the app already uses Next.js pages and server routes.",
      required_action:
        "Create a private preview deployment only after lint, build, verify:web-beta, and owner confirmation pass.",
    },
    {
      id: "api-runtime",
      title: "API runtime",
      status: "required",
      evidence:
        "Auth, workspace metadata, environment preflight, and disabled Web Beta stubs are implemented as Next.js route handlers.",
      required_action:
        "Keep protected routes guarded by cloud enable flags and prove disabled routes cannot read payloads or write server data.",
    },
    {
      id: "cloudflare-edge-layer",
      title: "Cloudflare edge layer",
      status: "manual-confirmation",
      evidence:
        "Cloudflare is useful as DNS, CDN, and WAF after the first deployment target is stable.",
      required_action:
        "Test cache bypass, auth callback redirects, WAF rules, rate limits, and rollback on a staging domain before production DNS cutover.",
    },
    {
      id: "supabase-auth-postgres",
      title: "Supabase Auth and Postgres",
      status: "planned",
      evidence:
        "Cloud schema, RLS migration draft, Auth callback, and workspace bootstrap contracts exist locally.",
      required_action:
        "Run migrations on a disposable project, confirm RLS, test magic-link login, and export the bootstrap link receipt.",
    },
    {
      id: "private-object-storage",
      title: "Private object storage",
      status: "blocked",
      evidence:
        "HTML reports, Markdown attachments, PDFs, Excel, Word, and other files need private buckets, checksums, signed URLs, and size limits.",
      required_action:
        "Keep file sync disabled until private storage policy, signed URL expiry, upload size limits, and audit events are implemented.",
    },
    {
      id: "environment-and-secrets",
      title: "Environment and secrets",
      status: "blocked",
      evidence:
        "Environment preflight can check required key presence, but real production secrets are not configured in this local workspace.",
      required_action:
        "Configure app URL, Supabase keys, storage bucket, auth origins, audit retention, and monitoring in the deployment provider without exposing values.",
    },
    {
      id: "preview-deployments",
      title: "Preview deployments",
      status: "blocked",
      evidence:
        "No hosted preview URL is recorded in the local Web Beta contract yet.",
      required_action:
        "Add a preview deployment, smoke-test /modules/sync and /auth/callback, then keep cloud writes disabled for the first review.",
    },
    {
      id: "release-rollback",
      title: "Release rollback",
      status: "blocked",
      evidence:
        "Restore rollback is modeled locally, but deployment rollback and database rollback have not been proven together.",
      required_action:
        "Document provider rollback, Supabase migration rollback, incident owner, and user-visible recovery steps before launch.",
    },
    {
      id: "observability",
      title: "Observability",
      status: "blocked",
      evidence:
        "Audit policy exists locally, but error monitoring, uptime checks, and privacy-safe event sampling are not live.",
      required_action:
        "Enable privacy-safe error monitoring, health checks, audit event writes, and incident review before private beta.",
    },
  ];
}

function summarizeDeploymentTracks(
  providers: WebBetaDeploymentProvider[],
  tracks: WebBetaDeploymentTrack[]
) {
  const rows = [...providers, ...tracks];

  return rows.reduce(
    (summary, row) => {
      if (row.status === "local-draft") summary.local_draft += 1;
      if (row.status === "planned") summary.planned += 1;
      if (row.status === "required") summary.required += 1;
      if (row.status === "manual-confirmation") {
        summary.manual_confirmation += 1;
      }
      if (row.status === "blocked") summary.blocked += 1;
      return summary;
    },
    {
      providers: providers.length,
      tracks: tracks.length,
      local_draft: 0,
      planned: 0,
      required: 0,
      manual_confirmation: 0,
      blocked: 0,
    }
  );
}
