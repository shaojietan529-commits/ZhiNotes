export type PermissionRoleId = "owner" | "researcher" | "viewer";
export type PermissionResourceId =
  | "pages"
  | "databases"
  | "files"
  | "reports"
  | "portfolio"
  | "ai"
  | "sync";
export type PermissionActionId =
  | "view"
  | "edit"
  | "export"
  | "sync"
  | "ai"
  | "share"
  | "admin";

export interface PermissionRole {
  id: PermissionRoleId;
  title: string;
  detail: string;
}

export interface PermissionResource {
  id: PermissionResourceId;
  title: string;
  detail: string;
}

export interface PermissionAction {
  id: PermissionActionId;
  title: string;
}

export interface PermissionRule {
  roleId: PermissionRoleId;
  resourceId: PermissionResourceId;
  actions: PermissionActionId[];
}

export const PERMISSION_ROLES: PermissionRole[] = [
  {
    id: "owner",
    title: "Owner",
    detail: "Full workspace control, including future sync, restore, and sharing decisions.",
  },
  {
    id: "researcher",
    title: "Researcher",
    detail: "Can create and edit research, but cannot change sync, sharing, or admin policy.",
  },
  {
    id: "viewer",
    title: "Viewer",
    detail: "Read-only access for future shared workspaces or review-only workflows.",
  },
];

export const PERMISSION_RESOURCES: PermissionResource[] = [
  {
    id: "pages",
    title: "Pages",
    detail: "Notes, memos, comments, versions, backlinks, and page metadata.",
  },
  {
    id: "databases",
    title: "Databases",
    detail: "Research trackers, rows, fields, views, relation fields, and CSV flows.",
  },
  {
    id: "files",
    title: "Files",
    detail: "Uploaded local previews, HTML reports, PDFs, Office files, archives, and notebooks.",
  },
  {
    id: "reports",
    title: "Reports",
    detail: "Report Library pages, report tracker rows, takeaways, and linked research.",
  },
  {
    id: "portfolio",
    title: "Portfolio",
    detail: "Watchlist, positions, sizing, thesis, catalysts, and linked research.",
  },
  {
    id: "ai",
    title: "AI",
    detail: "AI request staging, selected context, payload preview, and provider execution.",
  },
  {
    id: "sync",
    title: "Sync",
    detail: "Backup restore, cloud sync, sharing, permission policy, and audit exports.",
  },
];

export const PERMISSION_ACTIONS: PermissionAction[] = [
  { id: "view", title: "View" },
  { id: "edit", title: "Edit" },
  { id: "export", title: "Export" },
  { id: "sync", title: "Sync" },
  { id: "ai", title: "AI" },
  { id: "share", title: "Share" },
  { id: "admin", title: "Admin" },
];

export const DEFAULT_PERMISSION_RULES: PermissionRule[] = [
  {
    roleId: "owner",
    resourceId: "pages",
    actions: ["view", "edit", "export", "sync", "ai", "share", "admin"],
  },
  {
    roleId: "owner",
    resourceId: "databases",
    actions: ["view", "edit", "export", "sync", "ai", "share", "admin"],
  },
  {
    roleId: "owner",
    resourceId: "files",
    actions: ["view", "edit", "export", "sync", "ai", "share", "admin"],
  },
  {
    roleId: "owner",
    resourceId: "reports",
    actions: ["view", "edit", "export", "sync", "ai", "share", "admin"],
  },
  {
    roleId: "owner",
    resourceId: "portfolio",
    actions: ["view", "edit", "export", "sync", "ai", "share", "admin"],
  },
  {
    roleId: "owner",
    resourceId: "ai",
    actions: ["view", "edit", "export", "ai", "admin"],
  },
  {
    roleId: "owner",
    resourceId: "sync",
    actions: ["view", "edit", "export", "sync", "share", "admin"],
  },
  {
    roleId: "researcher",
    resourceId: "pages",
    actions: ["view", "edit", "export", "ai"],
  },
  {
    roleId: "researcher",
    resourceId: "databases",
    actions: ["view", "edit", "export", "ai"],
  },
  {
    roleId: "researcher",
    resourceId: "files",
    actions: ["view", "edit", "export"],
  },
  {
    roleId: "researcher",
    resourceId: "reports",
    actions: ["view", "edit", "export", "ai"],
  },
  {
    roleId: "researcher",
    resourceId: "portfolio",
    actions: ["view", "edit", "export"],
  },
  {
    roleId: "researcher",
    resourceId: "ai",
    actions: ["view", "edit", "export", "ai"],
  },
  {
    roleId: "researcher",
    resourceId: "sync",
    actions: ["view", "export"],
  },
  {
    roleId: "viewer",
    resourceId: "pages",
    actions: ["view", "export"],
  },
  {
    roleId: "viewer",
    resourceId: "databases",
    actions: ["view", "export"],
  },
  {
    roleId: "viewer",
    resourceId: "files",
    actions: ["view"],
  },
  {
    roleId: "viewer",
    resourceId: "reports",
    actions: ["view", "export"],
  },
  {
    roleId: "viewer",
    resourceId: "portfolio",
    actions: ["view"],
  },
  {
    roleId: "viewer",
    resourceId: "ai",
    actions: ["view"],
  },
  {
    roleId: "viewer",
    resourceId: "sync",
    actions: ["view"],
  },
];

export const RISKY_PERMISSION_ACTIONS = [
  {
    id: "cloud-sync",
    title: "Cloud sync",
    detail: "Uploads local workspace data to a server and must show a payload preview first.",
  },
  {
    id: "backup-restore",
    title: "Backup restore",
    detail: "Writes imported data back into the workspace and must require explicit confirmation.",
  },
  {
    id: "ai-execution",
    title: "AI execution",
    detail: "Sends selected context to an external model and must confirm provider and retention policy.",
  },
  {
    id: "external-assets",
    title: "External assets",
    detail: "Loads remote images, scripts, iframes, or report dependencies from private pages.",
  },
  {
    id: "sharing",
    title: "Sharing",
    detail: "Exposes pages, databases, files, reports, or portfolio data to another user or workspace.",
  },
  {
    id: "bulk-delete",
    title: "Bulk delete",
    detail: "Removes many pages, rows, files, comments, or module records at once.",
  },
  {
    id: "broker-import",
    title: "Broker import",
    detail: "Imports holdings, transactions, or account identifiers into the portfolio module.",
  },
];

export function getRolePermissionMatrix(roleId: PermissionRoleId) {
  return PERMISSION_RESOURCES.map((resource) => {
    const rule = DEFAULT_PERMISSION_RULES.find(
      (item) => item.roleId === roleId && item.resourceId === resource.id
    );

    return {
      resource,
      actions: PERMISSION_ACTIONS.map((action) => ({
        action,
        allowed: Boolean(rule?.actions.includes(action.id)),
      })),
    };
  });
}

export function buildPermissionPolicySnapshot() {
  return {
    format: "zhinote-permission-policy-draft",
    format_version: 1,
    policy_status: "local-draft",
    privacy_note:
      "Generated locally. This is a draft permission policy and does not grant, revoke, upload, or share workspace access.",
    roles: PERMISSION_ROLES,
    resources: PERMISSION_RESOURCES,
    actions: PERMISSION_ACTIONS,
    rules: DEFAULT_PERMISSION_RULES,
    high_risk_actions: RISKY_PERMISSION_ACTIONS,
  };
}
