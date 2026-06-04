import type { WebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";

export type PrivateFileStoragePolicyStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export interface PrivateFileStorageKindCount {
  kind: string;
  count: number;
}

export interface PrivateFileStoragePolicyInput {
  uploadedFiles: number;
  fileKinds: PrivateFileStorageKindCount[];
  environmentPreflight: WebBetaEnvironmentPreflight | null;
}

export interface PrivateFileStorageBucketPolicy {
  id: string;
  bucket_name_env: string;
  purpose: string;
  object_key_pattern: string;
  public_access: "forbidden";
  required_controls: string[];
  status: PrivateFileStoragePolicyStatus;
}

export interface PrivateFileStorageRoutePolicy {
  id: string;
  method: "GET" | "POST";
  route: string;
  route_status: "disabled-stub" | "planned";
  purpose: string;
  allowed_request_metadata: string[];
  forbidden_payload_fields: string[];
  required_before_enablement: string[];
}

export interface PrivateFileStorageFileClass {
  id: string;
  label: string;
  file_kinds: string[];
  default_max_size_mb: number;
  sync_strategy: "private-object" | "metadata-only" | "blocked-until-review";
  required_controls: string[];
}

export interface PrivateFileStorageGate {
  id: string;
  title: string;
  status: PrivateFileStoragePolicyStatus;
  evidence: string;
  required_action: string;
}

export interface PrivateFileStoragePolicyReport {
  format: "zhinote-private-file-storage-policy";
  format_version: 1;
  policy_status: "local-policy-only";
  launch_verdict: "not-ready";
  file_sync_can_start_now: false;
  privacy_note: string;
  boundary: {
    local_policy_only: true;
    reads_file_metadata_counts: true;
    reads_file_kind_summary: true;
    reads_environment_presence: true;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_page_body_text: false;
    creates_storage_buckets: false;
    creates_signed_urls: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_files: false;
    exposes_secret_values: false;
    enables_file_sync: false;
    requires_owner_confirmation_before_file_sync: true;
  };
  local_evidence: {
    uploaded_files: number;
    file_kinds: PrivateFileStorageKindCount[];
    storage_bucket_env_present: boolean;
    storage_bucket_env_key: "SUPABASE_STORAGE_BUCKET";
  };
  summary: {
    buckets: number;
    routes: number;
    file_classes: number;
    gates: number;
    planned: number;
    manual_confirmation: number;
    blocked: number;
    public_access_forbidden: true;
    signed_url_ttl_minutes: number;
    max_upload_size_mb: number;
  };
  buckets: PrivateFileStorageBucketPolicy[];
  routes: PrivateFileStorageRoutePolicy[];
  file_classes: PrivateFileStorageFileClass[];
  gates: PrivateFileStorageGate[];
  forbidden_fields: string[];
}

const SIGNED_URL_TTL_MINUTES = 10;
const MAX_UPLOAD_SIZE_MB = 100;

const FORBIDDEN_FILE_STORAGE_FIELDS = [
  "file_bytes",
  "data_url",
  "base64",
  "signed_download_url",
  "signed_upload_url",
  "public_url",
  "file_text",
  "page_body_text",
  "database_cell_values",
  "prompt_text",
  "token",
  "cookie",
  "secret",
];

export function buildPrivateFileStoragePolicyReport(
  input: PrivateFileStoragePolicyInput
): PrivateFileStoragePolicyReport {
  const storageBucketEnvPresent = Boolean(
    input.environmentPreflight?.checks.find(
      (check) => check.key === "SUPABASE_STORAGE_BUCKET"
    )?.present
  );
  const buckets = buildBucketPolicies(storageBucketEnvPresent);
  const routes = buildRoutePolicies();
  const fileClasses = buildFileClasses();
  const gates = buildStorageGates(input, storageBucketEnvPresent);

  return {
    format: "zhinote-private-file-storage-policy",
    format_version: 1,
    policy_status: "local-policy-only",
    launch_verdict: "not-ready",
    file_sync_can_start_now: false,
    privacy_note:
      "Generated locally from file counts, file kind summaries, and environment-variable presence only. It does not read file names, file bytes, page body text, signed URLs, tokens, secrets, cloud data, or private research content.",
    boundary: {
      local_policy_only: true,
      reads_file_metadata_counts: true,
      reads_file_kind_summary: true,
      reads_environment_presence: true,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_page_body_text: false,
      creates_storage_buckets: false,
      creates_signed_urls: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_files: false,
      exposes_secret_values: false,
      enables_file_sync: false,
      requires_owner_confirmation_before_file_sync: true,
    },
    local_evidence: {
      uploaded_files: input.uploadedFiles,
      file_kinds: input.fileKinds,
      storage_bucket_env_present: storageBucketEnvPresent,
      storage_bucket_env_key: "SUPABASE_STORAGE_BUCKET",
    },
    summary: summarizeStoragePolicy(buckets, routes, fileClasses, gates),
    buckets,
    routes,
    file_classes: fileClasses,
    gates,
    forbidden_fields: FORBIDDEN_FILE_STORAGE_FIELDS,
  };
}

function buildBucketPolicies(
  storageBucketEnvPresent: boolean
): PrivateFileStorageBucketPolicy[] {
  return [
    {
      id: "private-source-files",
      bucket_name_env: "SUPABASE_STORAGE_BUCKET",
      purpose:
        "Original local reports, PDFs, Office files, archives, notebooks, media, and audit-retained attachments.",
      object_key_pattern:
        "workspaces/{workspace_id}/files/{file_id}/{sha256}.{extension}",
      public_access: "forbidden",
      required_controls: [
        "private bucket",
        "workspace-scoped object paths",
        "owner/researcher read policies",
        "checksum required before upload",
        "public listing blocked",
        "delete requires audit event",
      ],
      status: storageBucketEnvPresent ? "manual-confirmation" : "blocked",
    },
    {
      id: "private-preview-artifacts",
      bucket_name_env: "SUPABASE_STORAGE_BUCKET",
      purpose:
        "Future locally generated preview artifacts such as normalized HTML, thumbnails, or converted document previews.",
      object_key_pattern:
        "workspaces/{workspace_id}/previews/{file_id}/{render_id}.{extension}",
      public_access: "forbidden",
      required_controls: [
        "derived-from source file id",
        "render checksum",
        "no external resource URLs in preview metadata",
        "short-lived signed reads",
        "preview regeneration before stale reuse",
      ],
      status: "planned",
    },
  ];
}

function buildRoutePolicies(): PrivateFileStorageRoutePolicy[] {
  return [
    {
      id: "file-presign-upload",
      method: "POST",
      route: "/api/files/presign",
      route_status: "disabled-stub",
      purpose:
        "Future metadata-only request for a short-lived private upload URL.",
      allowed_request_metadata: [
        "workspace_id",
        "file_id",
        "file_kind",
        "mime_type",
        "size_bytes",
        "sha256",
        "operation",
        "confirmation_receipt_id",
      ],
      forbidden_payload_fields: FORBIDDEN_FILE_STORAGE_FIELDS,
      required_before_enablement: [
        "authenticated workspace membership",
        "server permission check",
        "audit event envelope",
        "checksum validation",
        "upload size limit",
        "owner confirmation for first file sync",
      ],
    },
    {
      id: "file-presign-download",
      method: "POST",
      route: "/api/files/presign",
      route_status: "disabled-stub",
      purpose:
        "Future metadata-only request for a short-lived private download URL.",
      allowed_request_metadata: [
        "workspace_id",
        "file_id",
        "storage_key",
        "operation",
        "permission_decision_id",
      ],
      forbidden_payload_fields: FORBIDDEN_FILE_STORAGE_FIELDS,
      required_before_enablement: [
        "authenticated workspace membership",
        "resource-level read permission",
        "signed URL expiry",
        "blocked public links",
        "audit event without signed URL value",
      ],
    },
  ];
}

function buildFileClasses(): PrivateFileStorageFileClass[] {
  return [
    fileClass(
      "editable-text",
      "Editable text sources",
      ["html", "markdown", "opml", "rtf", "text", "notebook"],
      25,
      "private-object",
      [
        "store source object privately",
        "keep editable page content separate from file bytes",
        "block external HTML resources by default",
      ]
    ),
    fileClass(
      "research-documents",
      "Research documents",
      ["pdf", "word", "presentation", "epub"],
      100,
      "private-object",
      [
        "signed read URL only",
        "no public document links",
        "preview conversion remains explicit",
      ]
    ),
    fileClass(
      "spreadsheets",
      "Spreadsheet files",
      ["spreadsheet"],
      100,
      "private-object",
      [
        "database import stays separately confirmed",
        "cell values must not enter sync metadata",
        "original workbook stays private",
      ]
    ),
    fileClass(
      "archives-and-media",
      "Archives and media",
      ["archive", "image", "audio", "video", "unknown"],
      100,
      "blocked-until-review",
      [
        "manual review before upload",
        "malware scan policy required",
        "large media retention policy required",
      ]
    ),
  ];
}

function buildStorageGates(
  input: PrivateFileStoragePolicyInput,
  storageBucketEnvPresent: boolean
): PrivateFileStorageGate[] {
  return [
    {
      id: "storage-env-present",
      title: "Storage environment",
      status: storageBucketEnvPresent ? "manual-confirmation" : "blocked",
      evidence: storageBucketEnvPresent
        ? "SUPABASE_STORAGE_BUCKET is present according to the environment preflight."
        : "SUPABASE_STORAGE_BUCKET is missing or the environment preflight is unavailable.",
      required_action:
        "Configure the private bucket name in the deployment environment without exposing its value in browser exports.",
    },
    {
      id: "private-bucket-policy",
      title: "Private bucket policy",
      status: "blocked",
      evidence:
        "No applied Supabase Storage bucket policy or public-listing denial proof exists yet.",
      required_action:
        "Create a private bucket, block public listing, and prove workspace-scoped RLS before file sync.",
    },
    {
      id: "signed-url-expiry",
      title: "Signed URL expiry",
      status: "planned",
      evidence: `Future signed URLs are limited to ${SIGNED_URL_TTL_MINUTES} minutes in this policy.`,
      required_action:
        "Implement short-lived upload/download signing and keep signed URL values out of audit, permission, and sync exports.",
    },
    {
      id: "checksum-and-size",
      title: "Checksum and size limits",
      status: "blocked",
      evidence: `${input.uploadedFiles} local files would require sha256 checksums and a ${MAX_UPLOAD_SIZE_MB} MB default upload limit before cloud storage.`,
      required_action:
        "Calculate checksums locally or server-side, reject oversized uploads, and store checksums as metadata only.",
    },
    {
      id: "permission-and-audit",
      title: "Permission and audit linkage",
      status: "blocked",
      evidence:
        "File presign still depends on disabled permission and audit endpoints.",
      required_action:
        "Enable file presign only after server permission checks and metadata-only audit envelopes are proven.",
    },
    {
      id: "owner-file-sync-confirmation",
      title: "Owner file sync confirmation",
      status: "manual-confirmation",
      evidence:
        "First file sync remains a high-risk action because report and document files may contain private research content.",
      required_action:
        "Require an owner confirmation receipt before any local file leaves the browser workspace.",
    },
  ];
}

function fileClass(
  id: string,
  label: string,
  fileKinds: string[],
  defaultMaxSizeMb: number,
  syncStrategy: PrivateFileStorageFileClass["sync_strategy"],
  requiredControls: string[]
): PrivateFileStorageFileClass {
  return {
    id,
    label,
    file_kinds: fileKinds,
    default_max_size_mb: defaultMaxSizeMb,
    sync_strategy: syncStrategy,
    required_controls: requiredControls,
  };
}

function summarizeStoragePolicy(
  buckets: PrivateFileStorageBucketPolicy[],
  routes: PrivateFileStorageRoutePolicy[],
  fileClasses: PrivateFileStorageFileClass[],
  gates: PrivateFileStorageGate[]
): PrivateFileStoragePolicyReport["summary"] {
  return {
    buckets: buckets.length,
    routes: routes.length,
    file_classes: fileClasses.length,
    gates: gates.length,
    planned: gates.filter((gate) => gate.status === "planned").length,
    manual_confirmation: gates.filter(
      (gate) => gate.status === "manual-confirmation"
    ).length,
    blocked: gates.filter((gate) => gate.status === "blocked").length,
    public_access_forbidden: true,
    signed_url_ttl_minutes: SIGNED_URL_TTL_MINUTES,
    max_upload_size_mb: MAX_UPLOAD_SIZE_MB,
  };
}
