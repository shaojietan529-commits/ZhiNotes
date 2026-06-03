import { CONFLICT_POLICIES } from "@/lib/sync/webBetaContract";
import type { SyncPayloadPreview } from "@/lib/sync/syncPayloadPreview";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type SyncConflictSeverity = "low" | "medium" | "high";
export type SyncConflictReviewStatus =
  | "policy-ready"
  | "needs-remote-baseline"
  | "manual-only";

export interface SyncConflictReviewInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  syncPayloadPreview: SyncPayloadPreview;
}

export interface SyncConflictSurface {
  id: string;
  surface: string;
  status: SyncConflictReviewStatus;
  severity: SyncConflictSeverity;
  active_local_tables: string[];
  detection_rule: string;
  review_action: string;
  privacy_boundary: string;
}

export interface SyncConflictReviewReport {
  format: "zhinote-sync-conflict-review";
  format_version: 1;
  review_status: "local-policy-only";
  privacy_note: string;
  workspace_identity: {
    workspace_id: string | null;
    device_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
  };
  boundary: {
    reads_remote_data: false;
    merges_changes: false;
    writes_workspace_data: false;
    uploads_data: false;
  };
  summary: {
    surfaces: number;
    policy_ready: number;
    needs_remote_baseline: number;
    manual_only: number;
    high_severity: number;
    active_local_surfaces: number;
  };
  surfaces: SyncConflictSurface[];
}

const SURFACE_TABLES: Record<string, string[]> = {
  "page-body": ["pages", "page_versions"],
  "database-row": ["database_rows", "database_fields", "database_views"],
  "file-object": ["files"],
  comments: ["page_comments", "block_comments"],
  permissions: [],
  restore: [],
};

export function buildSyncConflictReviewReport(
  input: SyncConflictReviewInput
): SyncConflictReviewReport {
  const payloadTables = new Set(
    input.syncPayloadPreview.tables.map((table) => table.table_name)
  );
  const surfaces = CONFLICT_POLICIES.map((policy) => {
    const activeTables = (SURFACE_TABLES[policy.id] ?? []).filter((table) =>
      payloadTables.has(table)
    );
    return buildConflictSurface(policy.id, policy.surface, activeTables);
  });
  const summary = summarizeSurfaces(surfaces);

  return {
    format: "zhinote-sync-conflict-review",
    format_version: 1,
    review_status: "local-policy-only",
    privacy_note:
      "Generated locally. This is a conflict review scaffold only. It does not read remote data, merge changes, write workspace data, upload notes, sync files, or share workspace data.",
    workspace_identity: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      device_id: input.workspaceIdentity?.device_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
    },
    boundary: {
      reads_remote_data: false,
      merges_changes: false,
      writes_workspace_data: false,
      uploads_data: false,
    },
    summary,
    surfaces,
  };
}

function buildConflictSurface(
  id: string,
  surface: string,
  activeLocalTables: string[]
): SyncConflictSurface {
  const hasLocalActivity = activeLocalTables.length > 0;

  if (id === "permissions" || id === "restore") {
    return {
      id,
      surface,
      status: "manual-only",
      severity: "high",
      active_local_tables: activeLocalTables,
      detection_rule:
        "Never auto-merge this surface; require an owner confirmation even after server-side detection exists.",
      review_action:
        id === "permissions"
          ? "Show role/share changes side by side and require owner approval."
          : "Show restore scope, create rollback snapshot, then require a second confirmation.",
      privacy_boundary:
        "Preview uses policy metadata only and does not inspect private page text or file bytes.",
    };
  }

  return {
    id,
    surface,
    status: hasLocalActivity ? "needs-remote-baseline" : "policy-ready",
    severity: id === "page-body" || id === "database-row" ? "high" : "medium",
    active_local_tables: activeLocalTables,
    detection_rule:
      "Compare local base version, local pending change, and remote latest change before applying cloud pull/push.",
    review_action: getReviewAction(id),
    privacy_boundary: getPrivacyBoundary(id),
  };
}

function getReviewAction(id: string) {
  switch (id) {
    case "page-body":
      return "Open side-by-side page diff and let the user choose local, remote, or manual merge.";
    case "database-row":
      return "Show conflicted fields, preserve non-overlapping field changes, and require manual choice for same-field conflicts.";
    case "file-object":
      return "Show old and new file metadata; keep file bytes immutable and require replacement confirmation.";
    case "comments":
      return "Append new comments by timestamp and keep deleted or edited comments recoverable during beta.";
    default:
      return "Show local and remote metadata before applying any server change.";
  }
}

function getPrivacyBoundary(id: string) {
  switch (id) {
    case "page-body":
      return "Conflict scaffold can route to the existing page diff UI, but this report does not include page text.";
    case "database-row":
      return "Report names the table surface only and does not include row values, thesis text, ratings, or position sizing.";
    case "file-object":
      return "Report names file conflict policy only and does not include file bytes.";
    case "comments":
      return "Report names comment conflict policy only and does not include comment bodies.";
    default:
      return "Report includes policy metadata only.";
  }
}

function summarizeSurfaces(surfaces: SyncConflictSurface[]) {
  return surfaces.reduce(
    (summary, surface) => {
      summary.surfaces += 1;
      if (surface.status === "policy-ready") summary.policy_ready += 1;
      if (surface.status === "needs-remote-baseline") {
        summary.needs_remote_baseline += 1;
      }
      if (surface.status === "manual-only") summary.manual_only += 1;
      if (surface.severity === "high") summary.high_severity += 1;
      if (surface.active_local_tables.length > 0) {
        summary.active_local_surfaces += 1;
      }
      return summary;
    },
    {
      surfaces: 0,
      policy_ready: 0,
      needs_remote_baseline: 0,
      manual_only: 0,
      high_severity: 0,
      active_local_surfaces: 0,
    }
  );
}
