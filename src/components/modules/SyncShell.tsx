"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import { usePages } from "@/hooks/usePages";
import {
  getAllDatabases,
  getDeletedPages,
  getPendingSyncLogEntries,
  getSyncLogSummary,
  type SyncLogEntry,
  type SyncLogSummary,
} from "@/lib/db/local/queries";
import {
  exportWorkspaceBackup,
  exportWorkspaceMarkdown,
  exportWorkspaceZip,
} from "@/lib/export/workspaceBackup";
import {
  analyzeWorkspaceBackupJson,
  type WorkspaceRestorePreview,
} from "@/lib/export/workspaceRestore";
import {
  listStoredPageFiles,
  type StoredPageFile,
} from "@/lib/files/localStore";
import {
  PERMISSION_ROLES,
  buildPermissionPolicySnapshot,
  getRolePermissionMatrix,
  type PermissionRoleId,
} from "@/lib/security/permissionPolicy";
import {
  buildAuditTrailPolicy,
  type AuditTrailPolicy,
  type AuditTrailStatus,
} from "@/lib/security/auditTrailPolicy";
import {
  buildPermissionDecisionReport,
  type PermissionDecisionReport,
  type PermissionDecisionStatus,
} from "@/lib/security/permissionDecision";
import {
  buildHighRiskActionRegistryReport,
  getHighRiskRequiredPhrase,
  type HighRiskActionCoverage,
  type HighRiskActionRegistryReport,
} from "@/lib/security/highRiskActionRegistry";
import { buildHighRiskConfirmationReceipt } from "@/lib/security/typedConfirmation";
import {
  buildAccountSessionBoundary,
  type AccountSessionBoundary,
  type AccountSessionBoundaryStatus,
} from "@/lib/security/accountSessionBoundary";
import {
  AUTH_CONTRACT_ITEMS,
  CLOUD_SCHEMA_TABLES,
  CONFLICT_POLICIES,
  DEPLOYMENT_GATES,
  SYNC_API_CONTRACTS,
  buildWebBetaContractSnapshot,
  type WebBetaContractStatus,
} from "@/lib/sync/webBetaContract";
import {
  buildWebBetaReadinessReport,
  type WebBetaReadinessGate,
  type WebBetaReadinessStatus,
} from "@/lib/sync/webBetaReadiness";
import {
  buildCloudSchemaMigrationPlan,
  type CloudMigrationSensitivity,
  type CloudMigrationStepStatus,
  type CloudSchemaMigrationPlan,
} from "@/lib/sync/cloudSchemaMigrationPlan";
import {
  buildCloudMigrationSqlDraft,
  type CloudMigrationSqlDraft,
  type CloudMigrationSqlStatus,
} from "@/lib/sync/cloudMigrationSqlDraft";
import {
  buildWebBetaLaunchChecklist,
  type WebBetaLaunchChecklist,
  type WebBetaLaunchStatus,
} from "@/lib/sync/webBetaLaunchChecklist";
import {
  buildWebBetaNextActionPlan,
  type WebBetaNextActionPlan,
  type WebBetaNextActionPriority,
  type WebBetaNextActionStatus,
} from "@/lib/sync/webBetaNextActions";
import {
  buildWebBetaRoutePreflightReport,
  type WebBetaRoutePreflightReport,
  type WebBetaRoutePreflightStatus,
} from "@/lib/sync/webBetaRoutePreflight";
import type {
  WebBetaEnvironmentCheckStatus,
  WebBetaEnvironmentPreflight,
} from "@/lib/sync/webBetaEnvironmentPreflight";
import {
  WEB_BETA_API_STUBS,
  type WebBetaApiStub,
} from "@/lib/sync/webBetaApiStubs";
import {
  clearCloudSession,
  isCloudSessionExpired,
  readCloudSession,
  writeCloudSession,
  type ZhiNotesCloudSession,
} from "@/lib/cloud/clientSession";
import {
  buildSyncPayloadPreview,
  type SyncPayloadPreview,
  type SyncPayloadRisk,
} from "@/lib/sync/syncPayloadPreview";
import {
  buildSyncConflictReviewReport,
  type SyncConflictReviewReport,
  type SyncConflictReviewStatus,
  type SyncConflictSeverity,
} from "@/lib/sync/syncConflictReview";
import {
  buildSyncOptInGateReport,
  type SyncOptInGateReport,
  type SyncOptInGateStatus,
} from "@/lib/sync/syncOptInGate";
import {
  buildSyncReplayTestPlan,
  type SyncReplayTestPlan,
  type SyncReplayTestStatus,
} from "@/lib/sync/syncReplayTestPlan";
import {
  buildRestoreRollbackPlan,
  type RestoreRollbackPlan,
  type RestoreRollbackRisk,
  type RestoreRollbackStepStatus,
} from "@/lib/sync/restoreRollbackPlan";
import {
  buildRestoreWritebackContract,
  type RestoreWritebackContract,
  type RestoreWritebackStatus,
} from "@/lib/sync/restoreWritebackContract";
import {
  buildLocalWorkspaceIdentitySnapshot,
  getOrCreateLocalWorkspaceIdentity,
  linkLocalWorkspaceToCloud,
  readLocalWorkspaceIdentity,
  unlinkLocalWorkspaceFromCloud,
  type LocalWorkspaceIdentity,
} from "@/lib/sync/workspaceIdentity";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

type ExportAction = "backup" | "zip" | "markdown";
type SyncQueueAction =
  | "queue"
  | "payload-preview"
  | "conflict-review"
  | "opt-in-gate"
  | "sync-confirmation"
  | "rollback-plan"
  | "restore-writeback"
  | "restore-confirmation"
  | "replay-test-plan";
type PermissionPolicyAction = "policy";
type CloudAlphaAction =
  | "login"
  | "session"
  | "list-workspaces"
  | "workspace"
  | "bootstrap"
  | "link-workspace"
  | "unlink-workspace"
  | "clear";
type WebBetaContractAction =
  | "contract"
  | "readiness"
  | "identity"
  | "cloud-schema-plan"
  | "launch-checklist"
  | "environment-preflight"
  | "audit-policy"
  | "permission-decisions"
  | "account-session"
  | "high-risk-registry"
  | "migration-sql"
  | "next-actions"
  | "route-preflight";
type ReadinessStatus = "Ready" | "Partial" | "Missing" | "Needs confirmation";

type CloudAlphaMessageTone = "info" | "success" | "warning" | "error";

interface CloudAlphaMessage {
  tone: CloudAlphaMessageTone;
  title: string;
  detail: string;
}

interface CloudAlphaWorkspace {
  id: string;
  name: string;
  beta_status: string;
  role?: "owner" | "researcher" | "viewer";
  membership_created_at?: string;
  created_at?: string;
  updated_at?: string;
}

const READINESS_ITEMS: Array<{
  title: string;
  status: ReadinessStatus;
  detail: string;
}> = [
  {
    title: "Local data foundation",
    status: "Ready",
    detail:
      "Pages, databases, relation fields, comments, versions, and uploaded files already run locally in the browser.",
  },
  {
    title: "Local backup exports",
    status: "Ready",
    detail:
      "JSON backup, workspace ZIP, and Markdown export are available as browser downloads.",
  },
  {
    title: "Sync queue table",
    status: "Partial",
    detail:
      "Core local page, database, comment, relation, and version changes now enter sync_log, but remote replay is not finished.",
  },
  {
    title: "Restore flow",
    status: "Needs confirmation",
    detail:
      "Restore would write data back into the workspace, so it should be built only after the restore contract is confirmed.",
  },
  {
    title: "Login and cloud database",
    status: "Missing",
    detail:
      "User accounts, server database, workspace identity, and remote storage have not been implemented yet.",
  },
  {
    title: "Permissions and sharing",
    status: "Missing",
    detail:
      "Private workspace boundaries, role checks, and sharing controls still need a dedicated model.",
  },
  {
    title: "Conflict handling",
    status: "Missing",
    detail:
      "Multi-device edit conflicts need deterministic merge rules before web beta can be treated as safe.",
  },
];

const PRIVACY_BOUNDARIES = [
  "This module reads local counts only and does not upload notes, files, backups, or databases.",
  "Cloud sync, AI analysis, external report assets, and shared links still require explicit confirmation before implementation.",
  "Restore, bulk import, and destructive cleanup remain separate high-risk actions and should not run silently.",
];

const WEB_BETA_STACK = [
  {
    title: "1. Account layer",
    detail: "Login, workspace identity, session handling, and private workspace ownership.",
  },
  {
    title: "2. Cloud data layer",
    detail: "Server database schema for pages, databases, files, comments, versions, and relations.",
  },
  {
    title: "3. Sync layer",
    detail: "Pending queue, pull/push API, retry behavior, conflict detection, and device snapshots.",
  },
  {
    title: "4. Recovery layer",
    detail: "Backup restore, import validation, rollback snapshots, and error recovery.",
  },
  {
    title: "5. Permission layer",
    detail: "Workspace roles, sharing policy, module-level access, and audit history.",
  },
];

export default function SyncShell() {
  return (
    <DatabaseProvider>
      <SyncContent />
    </DatabaseProvider>
  );
}

function SyncContent() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <SyncDashboard />
      </main>
    </div>
  );
}

function SyncDashboard() {
  const router = useRouter();
  const { pages } = usePages();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [deletedPages, setDeletedPages] = useState<Page[]>([]);
  const [storedFiles, setStoredFiles] = useState<StoredPageFile[]>([]);
  const [syncSummary, setSyncSummary] = useState<SyncLogSummary | null>(null);
  const [syncEntries, setSyncEntries] = useState<SyncLogEntry[]>([]);
  const [busyAction, setBusyAction] = useState<ExportAction | null>(null);
  const [busyQueueAction, setBusyQueueAction] = useState<SyncQueueAction | null>(
    null
  );
  const [busyPermissionAction, setBusyPermissionAction] =
    useState<PermissionPolicyAction | null>(null);
  const [busyContractAction, setBusyContractAction] =
    useState<WebBetaContractAction | null>(null);
  const [selectedPermissionRole, setSelectedPermissionRole] =
    useState<PermissionRoleId>("owner");
  const [workspaceIdentity, setWorkspaceIdentity] =
    useState<LocalWorkspaceIdentity | null>(null);
  const [environmentPreflight, setEnvironmentPreflight] =
    useState<WebBetaEnvironmentPreflight | null>(null);
  const [environmentPreflightError, setEnvironmentPreflightError] = useState<
    string | null
  >(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] =
    useState<WorkspaceRestorePreview | null>(null);
  const [restorePreviewError, setRestorePreviewError] = useState<string | null>(
    null
  );
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudWorkspaceName, setCloudWorkspaceName] = useState(
    "ZhiNotes Research Workspace"
  );
  const [cloudSession, setCloudSession] =
    useState<ZhiNotesCloudSession | null>(null);
  const [cloudWorkspace, setCloudWorkspace] =
    useState<CloudAlphaWorkspace | null>(null);
  const [cloudWorkspaces, setCloudWorkspaces] = useState<
    CloudAlphaWorkspace[]
  >([]);
  const [selectedCloudWorkspaceId, setSelectedCloudWorkspaceId] = useState("");
  const [busyCloudAction, setBusyCloudAction] =
    useState<CloudAlphaAction | null>(null);
  const [cloudMessage, setCloudMessage] =
    useState<CloudAlphaMessage | null>(null);
  const [syncConfirmationPhrase, setSyncConfirmationPhrase] = useState("");
  const [restoreConfirmationPhrase, setRestoreConfirmationPhrase] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function loadReadinessData() {
      try {
        const loadedIdentity = getOrCreateLocalWorkspaceIdentity();
        const [
          loadedDatabases,
          loadedDeletedPages,
          loadedFiles,
          loadedSync,
          loadedSyncEntries,
          loadedEnvironmentPreflight,
        ] = await Promise.all([
            getAllDatabases(),
            getDeletedPages(),
            listStoredPageFiles().catch(() => [] as StoredPageFile[]),
            getSyncLogSummary(),
            getPendingSyncLogEntries(25),
            fetch("/api/web-beta/environment-preflight")
              .then((response) => {
                if (!response.ok) {
                  throw new Error("Environment preflight failed.");
                }
                return response.json() as Promise<WebBetaEnvironmentPreflight>;
              })
              .catch((err) => {
                console.error(
                  "[Zhinote] Failed to load environment preflight:",
                  err
                );
                return null;
              }),
          ]);
        if (!mounted) return;
        setWorkspaceIdentity(loadedIdentity);
        setDatabases(loadedDatabases);
        setDeletedPages(loadedDeletedPages);
        setStoredFiles(loadedFiles);
        setSyncSummary(loadedSync);
        setSyncEntries(loadedSyncEntries);
        setEnvironmentPreflight(loadedEnvironmentPreflight);
        setEnvironmentPreflightError(
          loadedEnvironmentPreflight
            ? null
            : "Environment preflight is not available from the local API."
        );
      } catch (err) {
        console.error("[Zhinote] Failed to load sync readiness data:", err);
        if (mounted) {
          setLoadError("Could not load all local readiness data.");
        }
      }
    }

    void loadReadinessData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const session = readCloudSession();
    setCloudSession(session);
    const identity = readLocalWorkspaceIdentity();
    if (identity?.cloud_workspace_id) {
      setSelectedCloudWorkspaceId(identity.cloud_workspace_id);
      setCloudWorkspace({
        id: identity.cloud_workspace_id,
        name: identity.cloud_workspace_name ?? "Linked cloud workspace",
        beta_status: "private-alpha",
        role: identity.cloud_role,
        created_at: identity.cloud_linked_at,
      });
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("cloud") === "connected" && session) {
      setCloudMessage({
        tone: "success",
        title: "云端登录已连接",
        detail:
          "本地云 session 已保存。下一步可以检查 session 或创建一个空的云 workspace。",
      });
      window.history.replaceState(null, "", "/modules/sync");
    }
  }, []);

  const fileSummary = useMemo(() => summarizeFiles(storedFiles), [storedFiles]);
  const syncPayloadPreview = useMemo(
    () =>
      buildSyncPayloadPreview({
        workspaceIdentity,
        syncSummary,
        entries: syncEntries,
      }),
    [syncEntries, syncSummary, workspaceIdentity]
  );
  const syncConflictReview = useMemo(
    () =>
      buildSyncConflictReviewReport({
        workspaceIdentity,
        syncPayloadPreview,
      }),
    [syncPayloadPreview, workspaceIdentity]
  );
  const syncOptInGate = useMemo(
    () =>
      buildSyncOptInGateReport({
        workspaceIdentity,
        syncPayloadPreview,
        conflictReview: syncConflictReview,
        pushApiPath: "/api/sync/push",
        currentUiCollectsPhrase: true,
      }),
    [syncConflictReview, syncPayloadPreview, workspaceIdentity]
  );
  const syncConfirmationReceipt = useMemo(
    () =>
      buildHighRiskConfirmationReceipt({
        actionId: "cloud-sync-first-push",
        requiredPhrase: syncOptInGate.confirmation.required_phrase,
        typedPhrase: syncConfirmationPhrase,
        actorLabel:
          cloudSession?.user?.email ?? cloudSession?.user?.id ?? null,
        localWorkspaceId: workspaceIdentity?.workspace_id ?? null,
        cloudWorkspaceId: workspaceIdentity?.cloud_workspace_id ?? null,
        scopeSummary: `${syncOptInGate.payload_scope.pending_count} pending sync rows; ${syncOptInGate.payload_scope.high_risk_tables} high-risk table groups; page text included: no; file bytes included: no.`,
        riskSummary:
          "First cloud sync can transmit private research metadata and later workspace content after explicit enablement.",
        destinationSummary: workspaceIdentity?.cloud_workspace_id
          ? `Supabase workspace ${workspaceIdentity.cloud_workspace_id}`
          : "No cloud workspace linked.",
      }),
    [
      cloudSession,
      syncConfirmationPhrase,
      syncOptInGate,
      workspaceIdentity,
    ]
  );
  const auditTrailPolicy = useMemo(
    () =>
      buildAuditTrailPolicy({
        workspaceIdentity,
        syncSummary,
        disabledApiStubs: WEB_BETA_API_STUBS.length,
      }),
    [syncSummary, workspaceIdentity]
  );
  const permissionDecisionReport = useMemo(
    () =>
      buildPermissionDecisionReport({
        auditTrailPolicy,
      }),
    [auditTrailPolicy]
  );
  const highRiskActionRegistry = useMemo(
    () => buildHighRiskActionRegistryReport(),
    []
  );
  const syncReplayTestPlan = useMemo(
    () =>
      buildSyncReplayTestPlan({
        workspaceIdentity,
        syncPayloadPreview,
        conflictReview: syncConflictReview,
        permissionDecisionReport,
        auditTrailPolicy,
      }),
    [
      auditTrailPolicy,
      permissionDecisionReport,
      syncConflictReview,
      syncPayloadPreview,
      workspaceIdentity,
    ]
  );
  const accountSessionBoundary = useMemo(
    () =>
      buildAccountSessionBoundary({
        workspaceIdentity,
        authApiStubs: WEB_BETA_API_STUBS.filter(
          (stub) =>
            stub.id === "auth-session" ||
            stub.id === "auth-login-start" ||
            stub.id === "auth-logout" ||
            stub.id === "workspace-list" ||
            stub.id === "workspace-create" ||
            stub.id === "workspace-bootstrap"
        ),
      }),
    [workspaceIdentity]
  );
  const restoreRollbackPlan = useMemo(
    () =>
      buildRestoreRollbackPlan({
        workspaceIdentity,
        restorePreview,
        syncSummary,
        localScope: {
          activePages: pages.length,
          deletedPages: deletedPages.length,
          databases: databases.length,
          uploadedFiles: storedFiles.length,
          pendingSyncRows: syncSummary?.pending ?? 0,
        },
      }),
    [
      databases.length,
      deletedPages.length,
      pages.length,
      restorePreview,
      storedFiles.length,
      syncSummary,
      workspaceIdentity,
    ]
  );
  const restoreWritebackContract = useMemo(
    () =>
      buildRestoreWritebackContract({
        workspaceIdentity,
        restorePreview,
        restoreRollbackPlan,
        syncReplayTestPlan,
        permissionDecisionReport,
        auditTrailPolicy,
      }),
    [
      auditTrailPolicy,
      permissionDecisionReport,
      restorePreview,
      restoreRollbackPlan,
      syncReplayTestPlan,
      workspaceIdentity,
    ]
  );
  const restoreConfirmationReceipt = useMemo(
    () =>
      buildHighRiskConfirmationReceipt({
        actionId: "restore-writeback",
        requiredPhrase: getHighRiskRequiredPhrase("restore-writeback"),
        typedPhrase: restoreConfirmationPhrase,
        actorLabel:
          cloudSession?.user?.email ?? cloudSession?.user?.id ?? null,
        localWorkspaceId: workspaceIdentity?.workspace_id ?? null,
        scopeSummary: restorePreview
          ? `${restorePreview.counts.activePages} active pages; ${restorePreview.counts.deletedPages} trash pages; ${restorePreview.counts.databases} databases; ${restorePreview.counts.databaseRows} database rows; ${restorePreview.counts.uploadedFiles} uploaded file records.`
          : "No restore backup preview loaded.",
        riskSummary:
          "A future restore write-back can overwrite or add local workspace pages, databases, comments, versions, files, favorites, and locks after explicit enablement.",
        destinationSummary: workspaceIdentity
          ? `Local browser workspace ${workspaceIdentity.workspace_id}`
          : "No local workspace identity available.",
      }),
    [
      cloudSession,
      restoreConfirmationPhrase,
      restorePreview,
      workspaceIdentity,
    ]
  );
  const cloudSchemaMigrationPlan = useMemo(
    () =>
      buildCloudSchemaMigrationPlan({
        activePages: pages.length,
        deletedPages: deletedPages.length,
        databases: databases.length,
        uploadedFiles: storedFiles.length,
        syncRows: syncSummary?.total ?? 0,
        pendingSyncRows: syncSummary?.pending ?? 0,
        tableContracts: CLOUD_SCHEMA_TABLES,
      }),
    [
      databases.length,
      deletedPages.length,
      pages.length,
      storedFiles.length,
      syncSummary,
    ]
  );
  const cloudMigrationSqlDraft = useMemo(
    () =>
      buildCloudMigrationSqlDraft({
        cloudSchemaMigrationPlan,
        accountSessionBoundary,
        permissionDecisionReport,
        auditTrailPolicy,
      }),
    [
      accountSessionBoundary,
      auditTrailPolicy,
      cloudSchemaMigrationPlan,
      permissionDecisionReport,
    ]
  );
  const webBetaLaunchChecklist = useMemo(
    () =>
      buildWebBetaLaunchChecklist({
        activePages: pages.length,
        databases: databases.length,
        uploadedFiles: storedFiles.length,
        syncRows: syncSummary?.total ?? 0,
        pendingSyncRows: syncSummary?.pending ?? 0,
        disabledApiStubs: WEB_BETA_API_STUBS.length,
        deploymentGates: DEPLOYMENT_GATES,
        cloudSchemaMigrationPlan,
        restoreRollbackPlan,
        restoreWritebackContract,
        syncPayloadPreview,
        conflictReview: syncConflictReview,
        environmentPreflight,
        auditTrailPolicy,
        permissionDecisionReport,
        accountSessionBoundary,
        cloudMigrationSqlDraft,
        syncReplayTestPlan,
      }),
    [
      accountSessionBoundary,
      auditTrailPolicy,
      cloudMigrationSqlDraft,
      cloudSchemaMigrationPlan,
      databases.length,
      pages.length,
      restoreRollbackPlan,
      restoreWritebackContract,
      storedFiles.length,
      environmentPreflight,
      permissionDecisionReport,
      syncConflictReview,
      syncPayloadPreview,
      syncReplayTestPlan,
      syncSummary,
    ]
  );
  const webBetaReadinessReport = useMemo(
    () =>
      buildWebBetaReadinessReport({
        activePages: pages.length,
        deletedPages: deletedPages.length,
        databases: databases.length,
        uploadedFiles: storedFiles.length,
        fileKinds: fileSummary.kinds,
        syncSummary,
        restorePreviewLoaded: Boolean(restorePreview),
        workspaceIdentity,
        syncPayloadPreview,
        conflictReview: syncConflictReview,
        restoreRollbackPlan,
        restoreWritebackContract,
        cloudSchemaMigrationPlan,
        webBetaLaunchChecklist,
        environmentPreflight,
        auditTrailPolicy,
        permissionDecisionReport,
        accountSessionBoundary,
        cloudMigrationSqlDraft,
        syncReplayTestPlan,
      }),
    [
      accountSessionBoundary,
      auditTrailPolicy,
      cloudMigrationSqlDraft,
      cloudSchemaMigrationPlan,
      databases.length,
      deletedPages.length,
      fileSummary.kinds,
      pages.length,
      restorePreview,
      restoreRollbackPlan,
      restoreWritebackContract,
      storedFiles.length,
      syncSummary,
      syncConflictReview,
      syncPayloadPreview,
      syncReplayTestPlan,
      webBetaLaunchChecklist,
      environmentPreflight,
      permissionDecisionReport,
      workspaceIdentity,
    ]
  );
  const webBetaRoutePreflight = useMemo(
    () => buildWebBetaRoutePreflightReport(webBetaLaunchChecklist),
    [webBetaLaunchChecklist]
  );
  const webBetaNextActionPlan = useMemo(
    () =>
      buildWebBetaNextActionPlan({
        readinessReport: webBetaReadinessReport,
        launchChecklist: webBetaLaunchChecklist,
        environmentPreflight,
        deploymentGates: DEPLOYMENT_GATES,
      }),
    [environmentPreflight, webBetaLaunchChecklist, webBetaReadinessReport]
  );
  const backupScope = useMemo(
    () => [
      {
        label: "Active pages",
        value: pages.length,
        detail: "Current notes and research pages",
      },
      {
        label: "Trash pages",
        value: deletedPages.length,
        detail: "Soft-deleted pages still kept locally",
      },
      {
        label: "Databases",
        value: databases.length,
        detail: "Local trackers and research tables",
      },
      {
        label: "Uploaded files",
        value: storedFiles.length,
        detail: fileSummary.totalSize,
      },
      {
        label: "Pending sync rows",
        value: syncSummary?.pending ?? 0,
        detail:
          syncSummary && syncSummary.total > 0
            ? `${syncSummary.total} local sync log rows`
            : "No queued rows recorded yet",
      },
    ],
    [
      databases.length,
      deletedPages.length,
      fileSummary.totalSize,
      pages.length,
      storedFiles.length,
      syncSummary,
    ]
  );
  const cloudSessionExpired = cloudSession
    ? isCloudSessionExpired(cloudSession)
    : false;
  const selectedCloudWorkspace = useMemo(() => {
    const selected = cloudWorkspaces.find(
      (workspace) => workspace.id === selectedCloudWorkspaceId
    );
    if (selected) return selected;
    if (cloudWorkspace?.id === selectedCloudWorkspaceId) return cloudWorkspace;
    return null;
  }, [cloudWorkspace, cloudWorkspaces, selectedCloudWorkspaceId]);

  const handleSelectedCloudWorkspaceChange = (workspaceId: string) => {
    setSelectedCloudWorkspaceId(workspaceId);
    const selected =
      cloudWorkspaces.find((workspace) => workspace.id === workspaceId) ??
      (cloudWorkspace?.id === workspaceId ? cloudWorkspace : null);
    if (selected) setCloudWorkspace(selected);
  };

  const handleCloudLoginStart = async () => {
    const email = cloudEmail.trim();
    if (!isValidCloudEmail(email)) {
      setCloudMessage({
        tone: "warning",
        title: "邮箱格式不正确",
        detail: "请输入一个可接收 magic link 的邮箱。",
      });
      return;
    }

    setBusyCloudAction("login");
    setCloudMessage(null);
    try {
      const response = await fetch("/api/auth/login/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/auth/callback`,
        }),
      });
      const body = await readCloudApiBody(response);

      if (!response.ok) {
        setCloudMessage({
          tone: response.status === 501 ? "warning" : "error",
          title:
            response.status === 501 ? "云端登录尚未开启" : "登录链接没有发送",
          detail: getCloudApiDetail(body, response),
        });
        return;
      }

      setCloudMessage({
        tone: "success",
        title: "登录链接已发送",
        detail:
          getRecordString(body, "email_hint") ||
          "请在同一个浏览器打开邮件里的 ZhiNotes 登录链接。",
      });
    } catch (err) {
      console.error("[Zhinote] Cloud login start failed:", err);
      setCloudMessage({
        tone: "error",
        title: "登录请求失败",
        detail: err instanceof Error ? err.message : "Unknown cloud error",
      });
    } finally {
      setBusyCloudAction(null);
    }
  };

  const handleCloudSessionCheck = async () => {
    if (!cloudSession || cloudSessionExpired) {
      clearCloudSession();
      setCloudSession(null);
      setCloudMessage({
        tone: "warning",
        title: "没有可用的云 session",
        detail: "请先发送登录链接，并从邮件完成一次 magic link 登录。",
      });
      return;
    }

    setBusyCloudAction("session");
    setCloudMessage(null);
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cloudSession.accessToken}`,
        },
      });
      const body = await readCloudApiBody(response);

      if (!response.ok) {
        setCloudMessage({
          tone: response.status === 501 ? "warning" : "error",
          title:
            response.status === 501 ? "云端 session 尚未开启" : "Session 检查失败",
          detail: getCloudApiDetail(body, response),
        });
        return;
      }

      if (!getRecordBoolean(body, "authenticated")) {
        setCloudMessage({
          tone: "warning",
          title: "Session 未认证",
          detail: "当前本地 token 没有通过云端认证，请重新登录。",
        });
        return;
      }

      const user = getCloudSessionUser(body);
      const nextSession = {
        ...cloudSession,
        user,
      };
      writeCloudSession(nextSession);
      setCloudSession(nextSession);
      setCloudMessage({
        tone: "success",
        title: "Session 检查通过",
        detail: user?.email
          ? `已连接到 ${user.email}。`
          : "云端已确认当前 Supabase user。",
      });
    } catch (err) {
      console.error("[Zhinote] Cloud session check failed:", err);
      setCloudMessage({
        tone: "error",
        title: "Session 检查失败",
        detail: err instanceof Error ? err.message : "Unknown cloud error",
      });
    } finally {
      setBusyCloudAction(null);
    }
  };

  const handleCloudWorkspaceList = async () => {
    if (!cloudSession || cloudSessionExpired) {
      clearCloudSession();
      setCloudSession(null);
      setCloudMessage({
        tone: "warning",
        title: "需要先登录",
        detail: "列出云 workspace 需要一个有效的本地云 session。",
      });
      return;
    }

    setBusyCloudAction("list-workspaces");
    setCloudMessage(null);
    try {
      const response = await fetch("/api/workspaces", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cloudSession.accessToken}`,
        },
      });
      const body = await readCloudApiBody(response);

      if (!response.ok) {
        setCloudMessage({
          tone: response.status === 501 ? "warning" : "error",
          title:
            response.status === 501
              ? "云 workspace 列表尚未开启"
              : "Workspace 列表读取失败",
          detail: getCloudApiDetail(body, response),
        });
        return;
      }

      const workspaces = getCloudWorkspaces(body);
      setCloudWorkspaces(workspaces);
      if (!selectedCloudWorkspaceId && workspaces[0]) {
        setSelectedCloudWorkspaceId(workspaces[0].id);
        setCloudWorkspace(workspaces[0]);
      }
      setCloudMessage({
        tone: workspaces.length > 0 ? "success" : "info",
        title: "云 workspace 列表已读取",
        detail:
          workspaces.length > 0
            ? `找到 ${workspaces.length} 个可访问 workspace。本地内容仍未上传。`
            : "当前账号还没有可访问的云 workspace，可以先创建一个空 workspace。",
      });
    } catch (err) {
      console.error("[Zhinote] Cloud workspace list failed:", err);
      setCloudMessage({
        tone: "error",
        title: "Workspace 列表读取失败",
        detail: err instanceof Error ? err.message : "Unknown cloud error",
      });
    } finally {
      setBusyCloudAction(null);
    }
  };

  const handleCloudWorkspaceCreate = async () => {
    if (!cloudSession || cloudSessionExpired) {
      clearCloudSession();
      setCloudSession(null);
      setCloudMessage({
        tone: "warning",
        title: "需要先登录",
        detail: "创建云 workspace 需要一个有效的本地云 session。",
      });
      return;
    }

    setBusyCloudAction("workspace");
    setCloudMessage(null);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cloudSession.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cloudWorkspaceName.trim(),
        }),
      });
      const body = await readCloudApiBody(response);

      if (!response.ok) {
        setCloudMessage({
          tone: response.status === 501 ? "warning" : "error",
          title:
            response.status === 501
              ? "云端 workspace 创建尚未开启"
              : "Workspace 创建失败",
          detail: getCloudApiDetail(body, response),
        });
        return;
      }

      const workspace = getCloudWorkspace(body);
      setCloudWorkspace(workspace);
      if (workspace) {
        setCloudWorkspaces((current) => upsertCloudWorkspace(current, workspace));
        setSelectedCloudWorkspaceId(workspace.id);
      }
      setCloudMessage({
        tone: "success",
        title: "云 workspace 已创建",
        detail: workspace
          ? `${workspace.name} 已创建为空 workspace。本地笔记仍未上传。`
          : "空 workspace 已创建。本地笔记仍未上传。",
      });
    } catch (err) {
      console.error("[Zhinote] Cloud workspace create failed:", err);
      setCloudMessage({
        tone: "error",
        title: "Workspace 创建失败",
        detail: err instanceof Error ? err.message : "Unknown cloud error",
      });
    } finally {
      setBusyCloudAction(null);
    }
  };

  const handleCloudWorkspaceBootstrap = async () => {
    if (!cloudSession || cloudSessionExpired) {
      clearCloudSession();
      setCloudSession(null);
      setCloudMessage({
        tone: "warning",
        title: "需要先登录",
        detail: "Bootstrap 检查需要一个有效的本地云 session。",
      });
      return;
    }

    const workspaceId =
      selectedCloudWorkspaceId || workspaceIdentity?.cloud_workspace_id || "";
    if (!workspaceId) {
      setCloudMessage({
        tone: "warning",
        title: "请选择云 workspace",
        detail: "请先读取或创建一个云 workspace，然后再做 bootstrap 检查。",
      });
      return;
    }

    setBusyCloudAction("bootstrap");
    setCloudMessage(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/bootstrap`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cloudSession.accessToken}`,
        },
      });
      const body = await readCloudApiBody(response);

      if (!response.ok) {
        setCloudMessage({
          tone: response.status === 501 ? "warning" : "error",
          title:
            response.status === 501
              ? "云 workspace bootstrap 尚未开启"
              : "Bootstrap 检查失败",
          detail: getCloudApiDetail(body, response),
        });
        return;
      }

      const workspace = getCloudWorkspace(body);
      const membership = getCloudMembership(body);
      if (workspace) {
        const nextWorkspace = {
          ...workspace,
          role: membership?.role ?? selectedCloudWorkspace?.role,
        };
        setCloudWorkspace(nextWorkspace);
        setCloudWorkspaces((current) =>
          upsertCloudWorkspace(current, nextWorkspace)
        );
        setSelectedCloudWorkspaceId(nextWorkspace.id);
      }

      setCloudMessage({
        tone: "success",
        title: "Bootstrap 检查通过",
        detail:
          "云端已确认当前用户可以访问该 workspace。仍未拉取页面正文、文件或数据库 rows。",
      });
    } catch (err) {
      console.error("[Zhinote] Cloud workspace bootstrap failed:", err);
      setCloudMessage({
        tone: "error",
        title: "Bootstrap 检查失败",
        detail: err instanceof Error ? err.message : "Unknown cloud error",
      });
    } finally {
      setBusyCloudAction(null);
    }
  };

  const handleLinkCloudWorkspace = () => {
    if (!cloudSession?.user?.id) {
      setCloudMessage({
        tone: "warning",
        title: "需要先检查 session",
        detail: "请先完成登录并点击检查 session，让本地知道当前 Supabase user。",
      });
      return;
    }
    if (!selectedCloudWorkspace) {
      setCloudMessage({
        tone: "warning",
        title: "请选择云 workspace",
        detail: "请先读取或创建一个云 workspace。",
      });
      return;
    }

    setBusyCloudAction("link-workspace");
    const nextIdentity = linkLocalWorkspaceToCloud({
      workspace: {
        id: selectedCloudWorkspace.id,
        name: selectedCloudWorkspace.name,
      },
      user: {
        id: cloudSession.user.id,
      },
      role: selectedCloudWorkspace.role ?? "owner",
    });
    setWorkspaceIdentity(nextIdentity);
    setCloudWorkspace(selectedCloudWorkspace);
    setSelectedCloudWorkspaceId(selectedCloudWorkspace.id);
    setCloudMessage({
      tone: "success",
      title: "本地 workspace 已连接",
      detail:
        "已在浏览器本地记录 cloud workspace id。这个动作没有上传笔记、文件或数据库。",
    });
    setBusyCloudAction(null);
  };

  const handleUnlinkCloudWorkspace = () => {
    setBusyCloudAction("unlink-workspace");
    const nextIdentity = unlinkLocalWorkspaceFromCloud();
    setWorkspaceIdentity(nextIdentity);
    setSelectedCloudWorkspaceId("");
    setCloudWorkspace(null);
    setCloudMessage({
      tone: "success",
      title: "本地 workspace 已取消云连接",
      detail:
        "这只清除浏览器本地的 cloud workspace 链接，不删除云端 workspace 或本地笔记。",
    });
    setBusyCloudAction(null);
  };

  const handleClearCloudSession = () => {
    setBusyCloudAction("clear");
    clearCloudSession();
    setCloudSession(null);
    setCloudWorkspace(null);
    setCloudWorkspaces([]);
    setSelectedCloudWorkspaceId("");
    setCloudMessage({
      tone: "success",
      title: "本地云 session 已清除",
      detail: "这只清除当前浏览器保存的 token，不删除云端 workspace 或本地笔记。",
    });
    setBusyCloudAction(null);
  };

  const runExport = async (action: ExportAction) => {
    setBusyAction(action);
    try {
      if (action === "backup") {
        await exportWorkspaceBackup();
      } else if (action === "zip") {
        await exportWorkspaceZip();
      } else {
        await exportWorkspaceMarkdown();
      }
    } catch (err) {
      console.error("[Zhinote] Failed to run sync export action:", err);
      window.alert("Export failed. Please check the console for details.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportSyncQueueSnapshot = async () => {
    setBusyQueueAction("queue");
    try {
      const entries = await getPendingSyncLogEntries(500);
      downloadJsonFile(`zhinote-sync-queue-${fileSafeTimestamp()}.json`, {
        format: "zhinote-sync-queue-snapshot",
        format_version: 1,
        exported_at: new Date().toISOString(),
        privacy_note:
          "Generated locally. Contains sync metadata only: table names, row ids, operations, changed fields, and timestamps.",
        pending_count: syncSummary?.pending ?? entries.length,
        included_count: entries.length,
        truncated: (syncSummary?.pending ?? entries.length) > entries.length,
        workspace_identity: workspaceIdentity,
        entries,
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export sync queue snapshot:", err);
      window.alert("Sync queue export failed. Please check the console.");
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportSyncPayloadPreview = async () => {
    setBusyQueueAction("payload-preview");
    try {
      const entries = await getPendingSyncLogEntries(500);
      downloadJsonFile(
        `zhinote-sync-payload-preview-${fileSafeTimestamp()}.json`,
        {
          ...buildSyncPayloadPreview({
            workspaceIdentity,
            syncSummary,
            entries,
          }),
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export sync payload preview:", err);
      window.alert("Sync payload preview failed. Please check the console.");
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportSyncConflictReview = () => {
    setBusyQueueAction("conflict-review");
    try {
      downloadJsonFile(
        `zhinote-sync-conflict-review-${fileSafeTimestamp()}.json`,
        {
          ...syncConflictReview,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export sync conflict review:", err);
      window.alert("Sync conflict review failed. Please check the console.");
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportSyncOptInGate = () => {
    setBusyQueueAction("opt-in-gate");
    try {
      downloadJsonFile(`zhinote-sync-opt-in-gate-${fileSafeTimestamp()}.json`, {
        ...syncOptInGate,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export sync opt-in gate:", err);
      window.alert("Sync opt-in gate export failed. Please check the console.");
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportSyncConfirmationReceipt = () => {
    setBusyQueueAction("sync-confirmation");
    try {
      downloadJsonFile(
        `zhinote-high-risk-confirmation-${fileSafeTimestamp()}.json`,
        {
          ...syncConfirmationReceipt,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export sync confirmation receipt:",
        err
      );
      window.alert(
        "Sync confirmation receipt export failed. Please check the console."
      );
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportSyncReplayTestPlan = () => {
    setBusyQueueAction("replay-test-plan");
    try {
      downloadJsonFile(
        `zhinote-sync-replay-test-plan-${fileSafeTimestamp()}.json`,
        {
          ...syncReplayTestPlan,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export sync replay test plan:", err);
      window.alert("Sync replay test plan failed. Please check the console.");
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportRestoreRollbackPlan = () => {
    setBusyQueueAction("rollback-plan");
    try {
      downloadJsonFile(
        `zhinote-restore-rollback-plan-${fileSafeTimestamp()}.json`,
        {
          ...restoreRollbackPlan,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export restore rollback plan:", err);
      window.alert("Restore rollback plan failed. Please check the console.");
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportRestoreWritebackContract = () => {
    setBusyQueueAction("restore-writeback");
    try {
      downloadJsonFile(
        `zhinote-restore-writeback-contract-${fileSafeTimestamp()}.json`,
        {
          ...restoreWritebackContract,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export restore write-back contract:",
        err
      );
      window.alert(
        "Restore write-back contract failed. Please check the console."
      );
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportRestoreConfirmationReceipt = () => {
    setBusyQueueAction("restore-confirmation");
    try {
      downloadJsonFile(
        `zhinote-restore-confirmation-receipt-${fileSafeTimestamp()}.json`,
        {
          ...restoreConfirmationReceipt,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export restore confirmation receipt:",
        err
      );
      window.alert(
        "Restore confirmation receipt failed. Please check the console."
      );
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportPermissionPolicy = () => {
    setBusyPermissionAction("policy");
    try {
      downloadJsonFile(`zhinote-permissions-${fileSafeTimestamp()}.json`, {
        ...buildPermissionPolicySnapshot(),
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export permission policy:", err);
      window.alert("Permission policy export failed. Please check the console.");
    } finally {
      setBusyPermissionAction(null);
    }
  };

  const handleExportHighRiskActionRegistry = () => {
    setBusyContractAction("high-risk-registry");
    try {
      downloadJsonFile(
        `zhinote-high-risk-action-registry-${fileSafeTimestamp()}.json`,
        {
          ...highRiskActionRegistry,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export high-risk action registry:",
        err
      );
      window.alert(
        "High-risk action registry export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportWebBetaContract = () => {
    setBusyContractAction("contract");
    try {
      downloadJsonFile(`zhinote-web-beta-contract-${fileSafeTimestamp()}.json`, {
        ...buildWebBetaContractSnapshot({
          cloudSchemaMigrationPlan,
          webBetaLaunchChecklist,
          webBetaEnvironmentPreflight: environmentPreflight,
        }),
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export web beta contract:", err);
      window.alert("Web beta contract export failed. Please check the console.");
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportEnvironmentPreflight = () => {
    if (!environmentPreflight) return;
    setBusyContractAction("environment-preflight");
    try {
      downloadJsonFile(
        `zhinote-web-beta-environment-preflight-${fileSafeTimestamp()}.json`,
        {
          ...environmentPreflight,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export environment preflight:",
        err
      );
      window.alert(
        "Environment preflight export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportWebBetaLaunchChecklist = () => {
    setBusyContractAction("launch-checklist");
    try {
      downloadJsonFile(
        `zhinote-web-beta-launch-checklist-${fileSafeTimestamp()}.json`,
        {
          ...webBetaLaunchChecklist,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export web beta launch checklist:",
        err
      );
      window.alert(
        "Web beta launch checklist export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportWebBetaRoutePreflight = () => {
    setBusyContractAction("route-preflight");
    try {
      downloadJsonFile(
        `zhinote-web-beta-route-preflight-${fileSafeTimestamp()}.json`,
        {
          ...webBetaRoutePreflight,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export web beta route preflight:",
        err
      );
      window.alert(
        "Web beta route preflight export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportCloudSchemaMigrationPlan = () => {
    setBusyContractAction("cloud-schema-plan");
    try {
      downloadJsonFile(
        `zhinote-cloud-schema-migration-plan-${fileSafeTimestamp()}.json`,
        {
          ...cloudSchemaMigrationPlan,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export cloud schema migration plan:",
        err
      );
      window.alert(
        "Cloud schema migration plan export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportCloudMigrationSqlDraft = () => {
    setBusyContractAction("migration-sql");
    try {
      downloadJsonFile(
        `zhinote-cloud-migration-sql-draft-${fileSafeTimestamp()}.json`,
        {
          ...cloudMigrationSqlDraft,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export migration SQL draft:", err);
      window.alert(
        "Cloud migration SQL draft export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportWebBetaReadiness = () => {
    setBusyContractAction("readiness");
    try {
      downloadJsonFile(`zhinote-web-beta-readiness-${fileSafeTimestamp()}.json`, {
        ...webBetaReadinessReport,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export web beta readiness:", err);
      window.alert("Web beta readiness export failed. Please check the console.");
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportWebBetaNextActionPlan = () => {
    setBusyContractAction("next-actions");
    try {
      downloadJsonFile(
        `zhinote-web-beta-next-actions-${fileSafeTimestamp()}.json`,
        {
          ...webBetaNextActionPlan,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export web beta next action plan:",
        err
      );
      window.alert(
        "Web beta next action plan export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportAuditTrailPolicy = () => {
    setBusyContractAction("audit-policy");
    try {
      downloadJsonFile(`zhinote-audit-policy-${fileSafeTimestamp()}.json`, {
        ...auditTrailPolicy,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export audit policy:", err);
      window.alert("Audit policy export failed. Please check the console.");
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportPermissionDecisionReport = () => {
    setBusyContractAction("permission-decisions");
    try {
      downloadJsonFile(
        `zhinote-permission-decisions-${fileSafeTimestamp()}.json`,
        {
          ...permissionDecisionReport,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export permission decisions:", err);
      window.alert(
        "Permission decision export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportAccountSessionBoundary = () => {
    setBusyContractAction("account-session");
    try {
      downloadJsonFile(
        `zhinote-account-session-boundary-${fileSafeTimestamp()}.json`,
        {
          ...accountSessionBoundary,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export account boundary:", err);
      window.alert("Account boundary export failed. Please check the console.");
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportWorkspaceIdentity = () => {
    if (!workspaceIdentity) return;
    setBusyContractAction("identity");
    try {
      downloadJsonFile(
        `zhinote-workspace-identity-${fileSafeTimestamp()}.json`,
        buildLocalWorkspaceIdentitySnapshot(workspaceIdentity)
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export workspace identity:", err);
      window.alert("Workspace identity export failed. Please check the console.");
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleRestorePreviewFile = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    setRestoreFileName(file?.name ?? null);
    setRestorePreview(null);
    setRestorePreviewError(null);

    if (!file) return;

    try {
      const text = await file.text();
      setRestorePreview(analyzeWorkspaceBackupJson(text));
    } catch (err) {
      console.error("[Zhinote] Failed to preview backup restore:", err);
      setRestorePreviewError("Could not read this local backup file.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="w-full px-6 py-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Web beta readiness
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                Web Sync and Permissions
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Prepare ZhiNotes for a private web beta by checking local data,
                backup coverage, sync queue visibility, restore planning,
                permissions, and privacy boundaries.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/modules")}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              All modules
            </button>
          </div>
        </header>

        {loadError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {loadError}
          </div>
        )}

        <CloudAlphaPanel
          email={cloudEmail}
          workspaceName={cloudWorkspaceName}
          session={cloudSession}
          sessionExpired={cloudSessionExpired}
          workspace={cloudWorkspace}
          workspaces={cloudWorkspaces}
          selectedWorkspaceId={selectedCloudWorkspaceId}
          localIdentity={workspaceIdentity}
          busyAction={busyCloudAction}
          message={cloudMessage}
          onEmailChange={setCloudEmail}
          onWorkspaceNameChange={setCloudWorkspaceName}
          onSelectedWorkspaceChange={handleSelectedCloudWorkspaceChange}
          onLoginStart={() => void handleCloudLoginStart()}
          onSessionCheck={() => void handleCloudSessionCheck()}
          onWorkspaceList={() => void handleCloudWorkspaceList()}
          onWorkspaceCreate={() => void handleCloudWorkspaceCreate()}
          onWorkspaceBootstrap={() => void handleCloudWorkspaceBootstrap()}
          onLinkWorkspace={handleLinkCloudWorkspace}
          onUnlinkWorkspace={handleUnlinkCloudWorkspace}
          onClearSession={handleClearCloudSession}
        />

        <section className="grid gap-3 md:grid-cols-5">
          {backupScope.map((metric) => (
            <Metric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
            />
          ))}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Cloud sync opt-in gate
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local safety gate before any future cloud push can enter an
                owner confirmation flow. It checks cloud workspace link,
                payload preview, sensitivity, conflict baseline, disabled push
                API, and explicit opt-in wording without uploading data.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportSyncOptInGate}
              disabled={busyQueueAction === "opt-in-gate"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyQueueAction === "opt-in-gate"
                ? "Exporting..."
                : "Export opt-in gate"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <SyncOptInSummaryCard
              label="Verdict"
              value="Blocked"
              detail="Push API remains disabled"
              status="blocked"
            />
            <SyncOptInSummaryCard
              label="Ready"
              value={syncOptInGate.summary.ready}
              detail="Satisfied gates"
              status="ready"
            />
            <SyncOptInSummaryCard
              label="Confirm"
              value={syncOptInGate.summary.manual_confirmation}
              detail="Needs owner review"
              status="manual-confirmation"
            />
            <SyncOptInSummaryCard
              label="Blocked"
              value={syncOptInGate.summary.blocked}
              detail="Must be resolved first"
              status="blocked"
            />
            <SyncOptInSummaryCard
              label="Phrase"
              value={syncOptInGate.confirmation.required_phrase}
              detail="Collected locally"
              status="manual-confirmation"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="grid gap-2 md:grid-cols-2">
              {syncOptInGate.gates.map((gate) => (
                <SyncOptInGateRow key={gate.id} gate={gate} />
              ))}
            </div>
            <ContractPanel title="Opt-in boundary">
              <div className="grid gap-2 md:grid-cols-2">
                <IdentityMetric
                  label="Cloud workspace"
                  value={
                    syncOptInGate.workspace_identity.cloud_workspace_id ??
                    "Not linked"
                  }
                  detail={
                    syncOptInGate.workspace_identity.cloud_role ??
                    "No cloud role"
                  }
                />
                <IdentityMetric
                  label="Pending rows"
                  value={String(syncOptInGate.payload_scope.pending_count)}
                  detail={`${syncOptInGate.payload_scope.high_risk_tables} high-risk table groups`}
                />
                <IdentityMetric
                  label="Uploads"
                  value="Disabled"
                  detail="No notes, files, or rows uploaded"
                />
                <IdentityMetric
                  label="Push route"
                  value="/api/sync/push"
                  detail="Disabled local stub"
                />
              </div>
              <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <label
                  htmlFor="sync-confirmation-phrase"
                  className="text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  输入确认短语
                </label>
                <div className="mt-2 flex flex-col gap-2 lg:flex-row">
                  <input
                    id="sync-confirmation-phrase"
                    value={syncConfirmationPhrase}
                    onChange={(event) =>
                      setSyncConfirmationPhrase(event.target.value)
                    }
                    placeholder={syncOptInGate.confirmation.required_phrase}
                    className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={handleExportSyncConfirmationReceipt}
                    disabled={busyQueueAction === "sync-confirmation"}
                    className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {busyQueueAction === "sync-confirmation"
                      ? "Exporting..."
                      : "Export confirmation receipt"}
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">
                  即使短语匹配，当前仍不会上传；push API disabled. 收据只记录本地确认状态，不包含页面正文、文件内容、token 或 secret。
                </p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <IdentityMetric
                    label="Phrase match"
                    value={
                      syncConfirmationReceipt.typed_phrase_matches
                        ? "Yes"
                        : "No"
                    }
                    detail={syncConfirmationReceipt.status}
                  />
                  <IdentityMetric
                    label="Receipt boundary"
                    value="Local only"
                    detail="No upload, write, delete, or AI call"
                  />
                  <IdentityMetric
                    label="Destination"
                    value={syncConfirmationReceipt.destination_summary}
                    detail="Reviewed before future upload"
                  />
                </div>
              </div>
            </ContractPanel>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Sync replay test plan
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local test plan for future push, pull, acknowledgement, retry,
                conflict, high-risk gate, and rollback behavior. It does not
                read remote data, upload notes, write workspace data, or
                acknowledge sync rows.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportSyncReplayTestPlan}
              disabled={busyQueueAction === "replay-test-plan"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyQueueAction === "replay-test-plan"
                ? "Exporting..."
                : "Export replay plan"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <ReplaySummaryCard
              label="Scenarios"
              value={syncReplayTestPlan.summary.scenarios}
              detail="Replay cases"
              tone="planned"
            />
            <ReplaySummaryCard
              label="Confirm"
              value={syncReplayTestPlan.summary.manual_confirmation}
              detail="Needs user gate"
              tone="manual-confirmation"
            />
            <ReplaySummaryCard
              label="Blocked"
              value={syncReplayTestPlan.summary.blocked}
              detail="Server gaps"
              tone="blocked"
            />
            <ReplaySummaryCard
              label="Endpoint"
              value="/api/sync/replay-test"
              detail="Disabled local stub"
              tone="blocked"
            />
            <ReplaySummaryCard
              label="Boundary"
              value="No replay"
              detail="No cloud calls"
              tone="planned"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-2 md:grid-cols-2">
              {syncReplayTestPlan.scenarios.map((scenario) => (
                <ReplayScenarioRow key={scenario.id} scenario={scenario} />
              ))}
            </div>
            <div className="space-y-2">
              {syncReplayTestPlan.gates.map((gate) => (
                <ReplayGateRow key={gate.id} gate={gate} />
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Local workspace identity
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Anonymous browser-local workspace and device id for future sync
                metadata. This is not an account, does not connect to cloud
                services, and does not include note text or file content.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportWorkspaceIdentity}
              disabled={!workspaceIdentity || busyContractAction === "identity"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "identity"
                ? "Exporting..."
                : "Export identity"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <IdentityMetric
              label="Workspace"
              value={workspaceIdentity?.workspace_id ?? "Loading"}
              detail={workspaceIdentity?.workspace_name ?? "Local identity"}
            />
            <IdentityMetric
              label="Device"
              value={workspaceIdentity?.device_id ?? "Loading"}
              detail="Browser-local device id"
            />
            <IdentityMetric
              label="Cloud status"
              value={workspaceIdentity?.cloud_status ?? "local-only"}
              detail="No account or cloud sync"
            />
            <IdentityMetric
              label="Created"
              value={
                workspaceIdentity
                  ? formatDate(workspaceIdentity.created_at)
                  : "Loading"
              }
              detail="Generated locally"
            />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Account session boundary
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local contract for future Web Beta login. It maps login start,
                session read, workspace bootstrap, logout/revoke, and
                local-to-cloud link rules without creating accounts, reading
                emails, passwords, tokens, cookies, or connecting auth
                providers.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportAccountSessionBoundary}
              disabled={busyContractAction === "account-session"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "account-session"
                ? "Exporting..."
                : "Export account boundary"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <AccountBoundarySummaryCard
              label="Phases"
              value={accountSessionBoundary.summary.phases}
              detail="Login lifecycle steps"
              status="planned"
            />
            <AccountBoundarySummaryCard
              label="Blocked"
              value={accountSessionBoundary.summary.blocked}
              detail="Provider/session gaps"
              status="blocked"
            />
            <AccountBoundarySummaryCard
              label="Confirm"
              value={accountSessionBoundary.summary.manual_confirmation}
              detail="Local-to-cloud link"
              status="manual-confirmation"
            />
            <AccountBoundarySummaryCard
              label="Auth routes"
              value={accountSessionBoundary.local_evidence.auth_disabled_routes}
              detail="Disabled local stubs"
              status="blocked"
            />
            <AccountBoundarySummaryCard
              label="Forbidden"
              value={accountSessionBoundary.summary.forbidden_fields}
              detail="Credential fields"
              status="manual-confirmation"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <ContractPanel title="Account lifecycle phases">
              <div className="space-y-2">
                {accountSessionBoundary.phases.map((phase) => (
                  <AccountPhaseRow key={phase.id} phase={phase} />
                ))}
              </div>
            </ContractPanel>
            <ContractPanel title="Account enablement gates">
              <div className="space-y-2">
                {accountSessionBoundary.gates.map((gate) => (
                  <AccountGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </ContractPanel>
          </div>
          <ContractPanel title="Auth/session field policy" className="mt-4">
            <div className="grid gap-2 md:grid-cols-2">
              {accountSessionBoundary.fields.map((field) => (
                <AccountFieldRow key={field.field} field={field} />
              ))}
            </div>
          </ContractPanel>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Sync payload preview
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Metadata-only preview for a future cloud push. It summarizes
                pending tables, operations, changed fields, and privacy
                boundaries without page text, file bytes, account creation, or
                cloud upload.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleExportSyncPayloadPreview()}
              disabled={busyQueueAction === "payload-preview"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyQueueAction === "payload-preview"
                ? "Exporting..."
                : "Export preview"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <PayloadSummaryCard
              label="Pending"
              value={syncPayloadPreview.summary.pending_count}
              detail="Rows waiting in sync_log"
              tone="medium"
            />
            <PayloadSummaryCard
              label="Included"
              value={syncPayloadPreview.summary.included_count}
              detail={
                syncPayloadPreview.summary.truncated
                  ? "Preview is capped"
                  : "Preview covers loaded rows"
              }
              tone="low"
            />
            <PayloadSummaryCard
              label="High risk"
              value={syncPayloadPreview.summary.high_risk_tables}
              detail="Content-sensitive tables"
              tone="high"
            />
            <PayloadSummaryCard
              label="Medium risk"
              value={syncPayloadPreview.summary.medium_risk_tables}
              detail="Structure or relation metadata"
              tone="medium"
            />
            <PayloadSummaryCard
              label="Boundary"
              value="Metadata"
              detail="No page text or file bytes"
              tone="low"
            />
          </div>
          {syncPayloadPreview.tables.length > 0 ? (
            <div className="mt-4 grid gap-2 lg:grid-cols-2">
              {syncPayloadPreview.tables.map((table) => (
                <PayloadTableRow key={table.table_name} table={table} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              No pending sync rows are currently available for preview. This
              preview will populate as local page, database, comment, relation,
              or version changes enter sync_log.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Conflict review scaffold
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local policy scaffold for future multi-device conflicts. It
                maps conflict surfaces to review actions without reading remote
                data, merging changes, writing workspace data, or uploading
                anything.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportSyncConflictReview}
              disabled={busyQueueAction === "conflict-review"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyQueueAction === "conflict-review"
                ? "Exporting..."
                : "Export conflicts"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <ConflictSummaryCard
              label="Surfaces"
              value={syncConflictReview.summary.surfaces}
              detail="Policies covered"
              tone="medium"
            />
            <ConflictSummaryCard
              label="Policy ready"
              value={syncConflictReview.summary.policy_ready}
              detail="No local pending rows"
              tone="low"
            />
            <ConflictSummaryCard
              label="Needs baseline"
              value={syncConflictReview.summary.needs_remote_baseline}
              detail="Requires remote latest"
              tone="medium"
            />
            <ConflictSummaryCard
              label="Manual only"
              value={syncConflictReview.summary.manual_only}
              detail="Never auto-merge"
              tone="high"
            />
            <ConflictSummaryCard
              label="Boundary"
              value="No merge"
              detail="No writes or uploads"
              tone="low"
            />
          </div>
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {syncConflictReview.surfaces.map((surface) => (
              <ConflictSurfaceRow key={surface.id} surface={surface} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Private beta launch gates
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local readiness report for the web launch path. It summarizes
                local evidence, manual confirmation points, and blocked gates
                without creating accounts, connecting cloud services, uploading
                notes, or syncing files.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportWebBetaReadiness}
              disabled={busyContractAction === "readiness"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "readiness"
                ? "Exporting..."
                : "Export readiness"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <BetaSummaryCard
              label="Launch verdict"
              value="Not ready"
              detail="Cloud and conflict gates still block beta."
              tone="blocked"
            />
            <BetaSummaryCard
              label="Ready"
              value={webBetaReadinessReport.summary.ready}
              detail="Local escape hatch and data visibility."
              tone="ready"
            />
            <BetaSummaryCard
              label="Partial"
              value={webBetaReadinessReport.summary.partial}
              detail="Drafted locally, not enforced remotely."
              tone="partial"
            />
            <BetaSummaryCard
              label="Confirm"
              value={webBetaReadinessReport.summary.manual_confirmation}
              detail="Needs explicit user gate."
              tone="manual-confirmation"
            />
            <BetaSummaryCard
              label="Blocked"
              value={webBetaReadinessReport.summary.blocked}
              detail="Must be implemented before web beta."
              tone="blocked"
            />
          </div>
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {webBetaReadinessReport.gates.map((gate) => (
              <BetaGateRow key={gate.id} gate={gate} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Audit trail policy
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local policy for future server-side audit logs. It defines
                which auth, sync, restore, AI, file, export, permission, and
                admin actions must be recorded, while keeping page text, prompt
                text, file bytes, and secret values out of audit rows.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportAuditTrailPolicy}
              disabled={busyContractAction === "audit-policy"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "audit-policy"
                ? "Exporting..."
                : "Export audit policy"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <AuditSummaryCard
              label="Events"
              value={auditTrailPolicy.summary.events}
              detail="Action types covered"
              tone="planned"
            />
            <AuditSummaryCard
              label="Blocked"
              value={auditTrailPolicy.summary.blocked}
              detail="Needs server auth/logs"
              tone="blocked"
            />
            <AuditSummaryCard
              label="Confirm"
              value={auditTrailPolicy.summary.manual_confirmation}
              detail="Retention and redaction"
              tone="manual-confirmation"
            />
            <AuditSummaryCard
              label="Endpoint"
              value="/api/audit/events"
              detail="Disabled local stub"
              tone="blocked"
            />
            <AuditSummaryCard
              label="Forbidden"
              value={
                auditTrailPolicy.fields.filter(
                  (field) => field.status === "forbidden"
                ).length
              }
              detail="Sensitive field types"
              tone="manual-confirmation"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <ContractPanel title="Audit event coverage">
              <div className="space-y-2">
                {auditTrailPolicy.events.map((event) => (
                  <AuditEventRow key={event.id} event={event} />
                ))}
              </div>
            </ContractPanel>
            <ContractPanel title="Audit enablement gates">
              <div className="space-y-2">
                {auditTrailPolicy.gates.map((gate) => (
                  <AuditGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </ContractPanel>
          </div>
          <ContractPanel title="Audit payload policy" className="mt-4">
            <div className="grid gap-2 md:grid-cols-2">
              {auditTrailPolicy.fields.map((field) => (
                <AuditFieldRow key={field.field} field={field} />
              ))}
            </div>
          </ContractPanel>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Local backup actions
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                These downloads are generated in the browser. They do not upload
                workspace data or connect to a server.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ExportButton
                label="Backup JSON"
                busy={busyAction === "backup"}
                onClick={() => void runExport("backup")}
              />
              <ExportButton
                label="Workspace ZIP"
                busy={busyAction === "zip"}
                onClick={() => void runExport("zip")}
              />
              <ExportButton
                label="Markdown"
                busy={busyAction === "markdown"}
                onClick={() => void runExport("markdown")}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Restore dry-run preview
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Choose a local ZhiNotes backup JSON to validate its format and
                preview restore scope. This reads the file locally only and does
                not write anything back into the workspace.
              </p>
            </div>
            <label className="w-fit cursor-pointer rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
              Choose backup JSON
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => void handleRestorePreviewFile(event)}
              />
            </label>
          </div>
          {restorePreviewError && (
            <p className="mt-3 text-xs leading-5 text-red-600 dark:text-red-300">
              {restorePreviewError}
            </p>
          )}
          {restorePreview && (
            <RestorePreviewPanel
              fileName={restoreFileName}
              preview={restorePreview}
            />
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Restore rollback plan
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Dry-run rollback plan for backup restore. It requires a fresh
                rollback backup, scope review, pending sync review, and second
                confirmation before any restore write-back can exist.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportRestoreRollbackPlan}
              disabled={busyQueueAction === "rollback-plan"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyQueueAction === "rollback-plan"
                ? "Exporting..."
                : "Export rollback plan"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <RollbackSummaryCard
              label="Plan"
              value={restoreRollbackPlan.plan_status}
              detail="Restore write-back disabled"
              tone="medium"
            />
            <RollbackSummaryCard
              label="Ready"
              value={restoreRollbackPlan.summary.ready}
              detail="Steps already satisfied"
              tone="low"
            />
            <RollbackSummaryCard
              label="Confirm"
              value={restoreRollbackPlan.summary.manual_confirmation}
              detail="Needs explicit user gate"
              tone="medium"
            />
            <RollbackSummaryCard
              label="Blocked"
              value={restoreRollbackPlan.summary.blocked}
              detail="Write-back still disabled"
              tone="high"
            />
            <RollbackSummaryCard
              label="Boundary"
              value="Dry run"
              detail="No writes, deletes, or uploads"
              tone="low"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              {restoreRollbackPlan.steps.map((step) => (
                <RollbackStepRow key={step.id} step={step} />
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {restoreRollbackPlan.scopes.map((scope) => (
                <RollbackScopeRow key={scope.id} scope={scope} />
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Restore write-back contract
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local contract for the high-risk restore apply step. It maps
                backup validation, rollback snapshot, scope review, pending
                sync clearance, permission check, audit event, second
                confirmation, disabled write-back endpoint, and failed-restore
                recovery proof before any restore writes can exist.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportRestoreWritebackContract}
              disabled={busyQueueAction === "restore-writeback"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyQueueAction === "restore-writeback"
                ? "Exporting..."
                : "Export write-back"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <RestoreWritebackSummaryCard
              label="Stages"
              value={restoreWritebackContract.summary.stages}
              detail="Write-back flow"
              status="planned"
            />
            <RestoreWritebackSummaryCard
              label="Confirm"
              value={restoreWritebackContract.summary.manual_confirmation}
              detail="Manual gates"
              status="manual-confirmation"
            />
            <RestoreWritebackSummaryCard
              label="Blocked"
              value={restoreWritebackContract.summary.blocked}
              detail="Apply not enabled"
              status="blocked"
            />
            <RestoreWritebackSummaryCard
              label="Endpoint"
              value="/api/backup/restore-apply"
              detail="Disabled local stub"
              status="blocked"
            />
            <RestoreWritebackSummaryCard
              label="Boundary"
              value="No write"
              detail="No restore or delete"
              status="planned"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-2 md:grid-cols-2">
              {restoreWritebackContract.stages.map((stage) => (
                <RestoreWritebackStageRow key={stage.id} stage={stage} />
              ))}
            </div>
            <div className="space-y-2">
              {restoreWritebackContract.gates.map((gate) => (
                <RestoreWritebackGateRow key={gate.id} gate={gate} />
              ))}
            </div>
          </div>
          <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <label
              htmlFor="restore-confirmation-phrase"
              className="text-xs font-semibold text-zinc-900 dark:text-zinc-100"
            >
              输入恢复写入确认短语
            </label>
            <div className="mt-2 flex flex-col gap-2 lg:flex-row">
              <input
                id="restore-confirmation-phrase"
                value={restoreConfirmationPhrase}
                onChange={(event) =>
                  setRestoreConfirmationPhrase(event.target.value)
                }
                placeholder={restoreConfirmationReceipt.required_phrase}
                className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
              />
              <button
                type="button"
                onClick={handleExportRestoreConfirmationReceipt}
                disabled={busyQueueAction === "restore-confirmation"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyQueueAction === "restore-confirmation"
                  ? "Exporting..."
                  : "Export restore receipt"}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">
              即使短语匹配，当前仍不会恢复、覆盖或删除任何数据；/api/backup/restore-apply disabled. 收据只记录本地确认状态和范围摘要。
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <IdentityMetric
                label="Phrase match"
                value={
                  restoreConfirmationReceipt.typed_phrase_matches
                    ? "Yes"
                    : "No"
                }
                detail={restoreConfirmationReceipt.status}
              />
              <IdentityMetric
                label="Receipt boundary"
                value="Local only"
                detail="No restore, write, delete, or upload"
              />
              <IdentityMetric
                label="Destination"
                value={restoreConfirmationReceipt.destination_summary}
                detail="Current browser workspace"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Readiness checklist
              </h2>
              <span className="text-xs text-zinc-400">
                Local first, cloud pending
              </span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {READINESS_ITEMS.map((item) => (
                <ReadinessCard key={item.title} {...item} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Privacy boundary
            </h2>
            <div className="mt-3 space-y-3">
              {PRIVACY_BOUNDARIES.map((boundary) => (
                <p
                  key={boundary}
                  className="text-xs leading-5 text-zinc-500 dark:text-zinc-400"
                >
                  {boundary}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Web beta contract
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local draft for the private beta launch boundary: account
                login, cloud tables, sync APIs, conflict handling, deployment
                gates, and privacy confirmations. Exporting it does not create
                accounts, connect cloud services, upload files, or share notes.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportWebBetaContract}
              disabled={busyContractAction === "contract"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "contract"
                ? "Exporting..."
                : "Export contract"}
            </button>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <ContractPanel title="Account and privacy gates">
              <div className="space-y-2">
                {AUTH_CONTRACT_ITEMS.map((item) => (
                  <ContractTextRow
                    key={item.id}
                    title={item.title}
                    status={item.status}
                    detail={item.detail}
                    meta={item.acceptance}
                  />
                ))}
              </div>
            </ContractPanel>

            <ContractPanel title="Cloud schema contract">
              <div className="grid gap-2 md:grid-cols-2">
                {CLOUD_SCHEMA_TABLES.map((table) => (
                  <ContractTextRow
                    key={table.tableName}
                    title={table.tableName}
                    status={table.status}
                    detail={table.cloudPurpose}
                    meta={`Local source: ${table.localSource}. ${table.privacyBoundary}`}
                  />
                ))}
              </div>
            </ContractPanel>
          </div>

          <ContractPanel title="Cloud schema migration plan" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local plan for turning the cloud schema contract into versioned
                migrations. It keeps migration order, rollback requirements,
                privacy boundaries, and local evidence visible before any cloud
                database is connected.
              </p>
              <button
                type="button"
                onClick={handleExportCloudSchemaMigrationPlan}
                disabled={busyContractAction === "cloud-schema-plan"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "cloud-schema-plan"
                  ? "Exporting..."
                  : "Export migration plan"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <MigrationSummaryCard
                label="Tables"
                value={cloudSchemaMigrationPlan.summary.contracted_tables}
                detail="Contracted cloud tables"
                tone="medium"
              />
              <MigrationSummaryCard
                label="Required"
                value={cloudSchemaMigrationPlan.summary.required_tables}
                detail="Needed before beta sync"
                tone="high"
              />
              <MigrationSummaryCard
                label="High risk"
                value={cloudSchemaMigrationPlan.summary.high_sensitivity_tables}
                detail="Content or file-sensitive"
                tone="high"
              />
              <MigrationSummaryCard
                label="Blocked"
                value={cloudSchemaMigrationPlan.summary.blocked_steps}
                detail="Needs cloud decisions"
                tone="high"
              />
              <MigrationSummaryCard
                label="Boundary"
                value="Local"
                detail="No DB connection"
                tone="low"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-2">
                {cloudSchemaMigrationPlan.steps.map((step) => (
                  <MigrationStepRow key={step.id} step={step} />
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {cloudSchemaMigrationPlan.tables.map((table) => (
                  <MigrationTableRow key={table.table_name} table={table} />
                ))}
              </div>
            </div>
          </ContractPanel>

          <ContractPanel title="Cloud migration SQL draft" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local Postgres DDL draft for the contracted cloud schema. It
                generates reviewable SQL up/down statements, but does not
                connect a database, apply SQL, create migrations, write server
                data, or upload workspace content.
              </p>
              <button
                type="button"
                onClick={handleExportCloudMigrationSqlDraft}
                disabled={busyContractAction === "migration-sql"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "migration-sql"
                  ? "Exporting..."
                  : "Export SQL draft"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <MigrationSqlSummaryCard
                label="Statements"
                value={cloudMigrationSqlDraft.summary.statements}
                detail="DDL drafts"
                tone="drafted"
              />
              <MigrationSqlSummaryCard
                label="Required"
                value={cloudMigrationSqlDraft.summary.required_tables}
                detail="Before beta sync"
                tone="manual-confirmation"
              />
              <MigrationSqlSummaryCard
                label="Blocked"
                value={cloudMigrationSqlDraft.summary.blocked}
                detail="Apply gates"
                tone="blocked"
              />
              <MigrationSqlSummaryCard
                label="Endpoint"
                value="/api/cloud/migrations/apply"
                detail="Disabled local stub"
                tone="blocked"
              />
              <MigrationSqlSummaryCard
                label="Boundary"
                value="No apply"
                detail="No DB connection"
                tone="drafted"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-2 md:grid-cols-2">
                {cloudMigrationSqlDraft.statements.map((statement) => (
                  <MigrationSqlStatementRow
                    key={statement.id}
                    statement={statement}
                  />
                ))}
              </div>
              <div className="space-y-2">
                {cloudMigrationSqlDraft.gates.map((gate) => (
                  <MigrationSqlGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </div>
          </ContractPanel>

          <ContractPanel title="Environment preflight" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local server check for Web Beta environment settings. It only
                returns whether expected variables are present or missing; it
                never returns secret values, tokens, connection strings, or
                storage credentials.
              </p>
              <button
                type="button"
                onClick={handleExportEnvironmentPreflight}
                disabled={
                  !environmentPreflight ||
                  busyContractAction === "environment-preflight"
                }
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "environment-preflight"
                  ? "Exporting..."
                  : "Export preflight"}
              </button>
            </div>
            {environmentPreflightError && (
              <p className="mt-3 text-xs leading-5 text-amber-600 dark:text-amber-300">
                {environmentPreflightError}
              </p>
            )}
            {environmentPreflight ? (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  <PreflightSummaryCard
                    label="Required"
                    value={environmentPreflight.summary.required}
                    detail="Required env settings"
                    tone="missing"
                  />
                  <PreflightSummaryCard
                    label="Present"
                    value={environmentPreflight.summary.present_required}
                    detail="Required settings found"
                    tone="present"
                  />
                  <PreflightSummaryCard
                    label="Missing"
                    value={environmentPreflight.summary.missing_required}
                    detail="Required before beta"
                    tone={
                      environmentPreflight.summary.missing_required > 0
                        ? "missing"
                        : "present"
                    }
                  />
                  <PreflightSummaryCard
                    label="Optional"
                    value={environmentPreflight.summary.optional}
                    detail="Optional settings tracked"
                    tone="optional-missing"
                  />
                  <PreflightSummaryCard
                    label="Boundary"
                    value="No secrets"
                    detail="Presence only"
                    tone="present"
                  />
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
                    {environmentPreflight.groups.map((group) => (
                      <PreflightGroupRow key={group.group} group={group} />
                    ))}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {environmentPreflight.checks.map((check) => (
                      <PreflightCheckRow key={check.key} check={check} />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Environment preflight has not loaded yet.
              </p>
            )}
          </ContractPanel>

          <ContractPanel title="Web Beta launch checklist" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local launch checklist for private beta. It connects product,
                auth, cloud schema, file storage, sync replay, conflict review,
                restore rollback, payload confirmation, deployment gates, and
                observability into one preflight view.
              </p>
              <button
                type="button"
                onClick={handleExportWebBetaLaunchChecklist}
                disabled={busyContractAction === "launch-checklist"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "launch-checklist"
                  ? "Exporting..."
                  : "Export launch checklist"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <LaunchSummaryCard
                label="Tracks"
                value={webBetaLaunchChecklist.summary.tracks}
                detail="Launch workstreams"
                tone="partial"
              />
              <LaunchSummaryCard
                label="Partial"
                value={webBetaLaunchChecklist.summary.partial}
                detail="Local scaffolds ready"
                tone="partial"
              />
              <LaunchSummaryCard
                label="Blocked"
                value={webBetaLaunchChecklist.summary.blocked}
                detail="Cloud work required"
                tone="blocked"
              />
              <LaunchSummaryCard
                label="Routes"
                value={webBetaLaunchChecklist.summary.local_routes}
                detail="Local pages to verify"
                tone="ready"
              />
              <LaunchSummaryCard
                label="Boundary"
                value="No deploy"
                detail="Local checklist only"
                tone="manual-confirmation"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
              <div className="space-y-2">
                {webBetaLaunchChecklist.tracks.map((track) => (
                  <LaunchTrackRow key={track.id} track={track} />
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {webBetaLaunchChecklist.routes.map((routeCheck) => (
                  <LaunchRouteRow
                    key={`${routeCheck.method}:${routeCheck.route}`}
                    routeCheck={routeCheck}
                  />
                ))}
              </div>
            </div>
          </ContractPanel>

          <ContractPanel title="Route and API preflight" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local route-contract check for workspace pages, module pages,
                disabled API stubs, Cloud Alpha metadata routes, and the
                environment preflight endpoint. It does not send requests,
                connect cloud services, upload data, or read private content.
              </p>
              <button
                type="button"
                onClick={handleExportWebBetaRoutePreflight}
                disabled={busyContractAction === "route-preflight"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "route-preflight"
                  ? "Exporting..."
                  : "Export route preflight"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <RoutePreflightSummaryCard
                label="Expected"
                value={webBetaRoutePreflight.summary.expected_routes}
                detail="Route contracts"
                status="covered"
              />
              <RoutePreflightSummaryCard
                label="Covered"
                value={webBetaRoutePreflight.summary.covered}
                detail="In launch checklist"
                status="covered"
              />
              <RoutePreflightSummaryCard
                label="Mismatch"
                value={webBetaRoutePreflight.summary.status_mismatch}
                detail="Status differs"
                status={
                  webBetaRoutePreflight.summary.status_mismatch > 0
                    ? "status-mismatch"
                    : "covered"
                }
              />
              <RoutePreflightSummaryCard
                label="Missing"
                value={webBetaRoutePreflight.summary.missing}
                detail="Not listed"
                status={
                  webBetaRoutePreflight.summary.missing > 0
                    ? "missing"
                    : "covered"
                }
              />
              <RoutePreflightSummaryCard
                label="Cloud Alpha"
                value={webBetaRoutePreflight.summary.cloud_alpha_gated}
                detail="Metadata only"
                status="covered"
              />
            </div>
            <div className="mt-4 grid gap-2 xl:grid-cols-2">
              {webBetaRoutePreflight.checks.map((check) => (
                <RoutePreflightRow key={check.id} check={check} />
              ))}
            </div>
          </ContractPanel>

          <ContractPanel title="Web Beta next actions" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local action plan that turns readiness and launch blockers into
                ordered build work. It does not deploy, connect cloud services,
                create accounts, upload workspace data, or read private content.
              </p>
              <button
                type="button"
                onClick={handleExportWebBetaNextActionPlan}
                disabled={busyContractAction === "next-actions"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "next-actions"
                  ? "Exporting..."
                  : "Export next actions"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <NextActionSummaryCard
                label="Actions"
                value={webBetaNextActionPlan.summary.actions}
                detail="Ordered work items"
                status="ready-to-build"
              />
              <NextActionSummaryCard
                label="P0"
                value={webBetaNextActionPlan.summary.p0}
                detail="Must finish first"
                priority="p0"
              />
              <NextActionSummaryCard
                label="Ready"
                value={webBetaNextActionPlan.summary.ready_to_build}
                detail="Can start locally"
                status="ready-to-build"
              />
              <NextActionSummaryCard
                label="Decision"
                value={webBetaNextActionPlan.summary.needs_owner_decision}
                detail="Needs owner choice"
                status="needs-owner-decision"
              />
              <NextActionSummaryCard
                label="Missing env"
                value={webBetaNextActionPlan.summary.missing_environment_required}
                detail="Required settings"
                status="blocked-by-missing-cloud"
              />
            </div>
            <div className="mt-4 grid gap-2 xl:grid-cols-2">
              {webBetaNextActionPlan.actions.map((action) => (
                <NextActionRow key={action.id} action={action} />
              ))}
            </div>
          </ContractPanel>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <ContractPanel title="Web Beta API contract">
              <div className="space-y-2">
                {SYNC_API_CONTRACTS.map((api) => (
                  <ContractApiRow key={api.id} api={api} />
                ))}
              </div>
              <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Local disabled API stubs
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  These routes exist locally, but they return disabled responses
                  and do not read request bodies, create sessions, store server
                  data, restore backups, upload files, or sync notes.
                </p>
                <div className="mt-3 space-y-2">
                  {WEB_BETA_API_STUBS.map((stub) => (
                    <ApiStubRow key={stub.id} stub={stub} />
                  ))}
                </div>
              </div>
            </ContractPanel>

            <ContractPanel title="Conflict policies">
              <div className="space-y-2">
                {CONFLICT_POLICIES.map((policy) => (
                  <ContractTextRow
                    key={policy.id}
                    title={policy.surface}
                    status={policy.status}
                    detail={policy.strategy}
                    meta={policy.userGate}
                  />
                ))}
              </div>
            </ContractPanel>
          </div>

          <ContractPanel title="Deployment gates" className="mt-4">
            <div className="grid gap-2 md:grid-cols-2">
              {DEPLOYMENT_GATES.map((gate) => (
                <ContractTextRow
                  key={gate.id}
                  title={gate.title}
                  status={gate.status}
                  detail={gate.evidence}
                  meta={gate.failureMode}
                />
              ))}
            </div>
          </ContractPanel>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Permission decision preview
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Local evaluator for Owner, Researcher, and Viewer role
                decisions. It previews allow, deny, and confirmation outcomes
                for resource actions, but it does not create users, grant
                access, revoke access, upload data, or enforce server
                permissions.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPermissionDecisionReport}
              disabled={busyContractAction === "permission-decisions"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "permission-decisions"
                ? "Exporting..."
                : "Export decisions"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <PermissionDecisionSummaryCard
              label="Matrix"
              value={permissionDecisionReport.summary.matrix_decisions}
              detail="Role/resource/action checks"
              status="local-allowed"
            />
            <PermissionDecisionSummaryCard
              label="Scenarios"
              value={permissionDecisionReport.summary.high_risk_scenarios}
              detail="High-risk samples"
              status="needs-confirmation"
            />
            <PermissionDecisionSummaryCard
              label="Confirm"
              value={permissionDecisionReport.summary.needs_confirmation}
              detail="Allowed but gated"
              status="needs-confirmation"
            />
            <PermissionDecisionSummaryCard
              label="Denied"
              value={permissionDecisionReport.summary.local_denied}
              detail="Blocked by local role"
              status="local-denied"
            />
            <PermissionDecisionSummaryCard
              label="Endpoint"
              value="/api/permissions/check"
              detail="Disabled local stub"
              status="server-blocked"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <ContractPanel title="High-risk decisions">
              <div className="space-y-2">
                {permissionDecisionReport.high_risk_scenarios.map(
                  (scenario) => (
                    <PermissionDecisionScenarioRow
                      key={scenario.id}
                      scenario={scenario}
                    />
                  )
                )}
              </div>
            </ContractPanel>
            <ContractPanel title="Permission enablement gates">
              <div className="space-y-2">
                {permissionDecisionReport.gates.map((gate) => (
                  <PermissionDecisionGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </ContractPanel>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Permission matrix
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Local draft only. This does not create users, enforce access,
                  or share workspace data.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportPermissionPolicy}
                disabled={busyPermissionAction === "policy"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyPermissionAction === "policy"
                  ? "Exporting..."
                  : "Export policy"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PERMISSION_ROLES.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedPermissionRole(role.id)}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    role.id === selectedPermissionRole
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                      : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }`}
                >
                  {role.title}
                </button>
              ))}
            </div>
            <PermissionMatrix roleId={selectedPermissionRole} />
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  High-risk action registry
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Local registry for typed confirmations across sync, restore,
                  AI, file preview, database import, sharing, and delete
                  workflows. Exporting it does not enable any action.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportHighRiskActionRegistry}
                disabled={busyContractAction === "high-risk-registry"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "high-risk-registry"
                  ? "Exporting..."
                  : "Export registry"}
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <HighRiskRegistrySummaryCard
                label="Actions"
                value={highRiskActionRegistry.summary.actions}
                detail="Registered gates"
              />
              <HighRiskRegistrySummaryCard
                label="Receipts"
                value={highRiskActionRegistry.summary.local_receipt_available}
                detail="Local receipt ready"
              />
              <HighRiskRegistrySummaryCard
                label="Planned"
                value={highRiskActionRegistry.summary.planned}
                detail="Reserved gates"
              />
            </div>
            <div className="mt-3 space-y-2">
              {highRiskActionRegistry.actions.map((action) => (
                <HighRiskActionRegistryRow
                  key={action.action_id}
                  action={action}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Sync log visibility
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Local queue metadata only. No page text or file content is
                  exported here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleExportSyncQueueSnapshot()}
                disabled={busyQueueAction === "queue"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyQueueAction === "queue" ? "Exporting..." : "Export queue"}
              </button>
            </div>
            {syncSummary && syncSummary.tables.length > 0 ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  {syncSummary.tables.map((table) => (
                    <div
                      key={table.tableName}
                      className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-2 text-xs last:border-b-0 last:pb-0 dark:border-zinc-800"
                    >
                      <div>
                        <div className="font-medium text-zinc-800 dark:text-zinc-200">
                          {table.tableName}
                        </div>
                        <div className="mt-1 text-zinc-400">
                          {table.lastChangeAt
                            ? `Last change ${formatDate(table.lastChangeAt)}`
                            : "No timestamp"}
                        </div>
                      </div>
                      <div className="text-right text-zinc-500 dark:text-zinc-400">
                        <div>{table.pending} pending</div>
                        <div>{table.total} total</div>
                      </div>
                    </div>
                  ))}
                </div>
                {syncEntries.length > 0 && (
                  <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Recent pending changes
                    </h3>
                    <div className="mt-2 space-y-2">
                      {syncEntries.slice(0, 8).map((entry) => (
                        <SyncEntryRow key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                No sync log rows are currently recorded. New local page,
                database, comment, relation, and version changes will be added
                to this queue while cloud push/pull remains disabled.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              File coverage
            </h2>
            {fileSummary.kinds.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {fileSummary.kinds.map((item) => (
                  <span
                    key={item.kind}
                    className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {item.kind}: {item.count}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                No uploaded files are stored in the local file database yet.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Web beta build order
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-5">
            {WEB_BETA_STACK.map((step) => (
              <div
                key={step.title}
                className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800"
              >
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {step.title}
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function CloudAlphaPanel({
  email,
  workspaceName,
  session,
  sessionExpired,
  workspace,
  workspaces,
  selectedWorkspaceId,
  localIdentity,
  busyAction,
  message,
  onEmailChange,
  onWorkspaceNameChange,
  onSelectedWorkspaceChange,
  onLoginStart,
  onSessionCheck,
  onWorkspaceList,
  onWorkspaceCreate,
  onWorkspaceBootstrap,
  onLinkWorkspace,
  onUnlinkWorkspace,
  onClearSession,
}: {
  email: string;
  workspaceName: string;
  session: ZhiNotesCloudSession | null;
  sessionExpired: boolean;
  workspace: CloudAlphaWorkspace | null;
  workspaces: CloudAlphaWorkspace[];
  selectedWorkspaceId: string;
  localIdentity: LocalWorkspaceIdentity | null;
  busyAction: CloudAlphaAction | null;
  message: CloudAlphaMessage | null;
  onEmailChange: (value: string) => void;
  onWorkspaceNameChange: (value: string) => void;
  onSelectedWorkspaceChange: (value: string) => void;
  onLoginStart: () => void;
  onSessionCheck: () => void;
  onWorkspaceList: () => void;
  onWorkspaceCreate: () => void;
  onWorkspaceBootstrap: () => void;
  onLinkWorkspace: () => void;
  onUnlinkWorkspace: () => void;
  onClearSession: () => void;
}) {
  const hasUsableSession = Boolean(session && !sessionExpired);
  const workspaceOptions = workspaces.length > 0
    ? workspaces
    : workspace
      ? [workspace]
      : [];
  const linkedWorkspaceId = localIdentity?.cloud_workspace_id ?? "";

  return (
    <section className="rounded-lg border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Cloud Alpha
            </h2>
            <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Account + workspace only
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Connect Supabase Auth and create an empty cloud workspace. Local
            pages, files, databases, backups, and sync queue rows stay in this
            browser until a separate sync push is explicitly enabled.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CloudAlphaButton
            label="检查 session"
            busy={busyAction === "session"}
            disabled={!hasUsableSession || Boolean(busyAction)}
            onClick={onSessionCheck}
          />
          <CloudAlphaButton
            label="清除本地 session"
            busy={busyAction === "clear"}
            disabled={!session || Boolean(busyAction)}
            onClick={onClearSession}
            variant="secondary"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <CloudAlphaMetric
          label="Cloud config"
          value="Gated"
          detail="Disabled until env vars are enabled"
          tone="warning"
        />
        <CloudAlphaMetric
          label="Local session"
          value={
            sessionExpired
              ? "Expired"
              : session?.user?.email || (session ? "Token stored" : "None")
          }
          detail={
            session?.expiresAt
              ? `Expires ${formatDate(new Date(session.expiresAt).toISOString())}`
              : "No cloud token in this browser"
          }
          tone={hasUsableSession ? "success" : "warning"}
        />
        <CloudAlphaMetric
          label="Workspace"
          value={workspace?.name ?? "Not created"}
          detail={workspace?.id ?? "Create after login"}
          tone={workspace ? "success" : "info"}
        />
        <CloudAlphaMetric
          label="Local link"
          value={
            localIdentity?.cloud_status === "linked-alpha"
              ? "Linked"
              : "Local only"
          }
          detail={
            linkedWorkspaceId ||
            "No cloud workspace id stored in local identity"
          }
          tone={
            localIdentity?.cloud_status === "linked-alpha"
              ? "success"
              : "info"
          }
        />
        <CloudAlphaMetric
          label="Sync status"
          value="Off"
          detail="No note/file/database upload"
          tone="info"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            登录邮箱
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="you@example.com"
              type="email"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
            />
            <CloudAlphaButton
              label="发送登录链接"
              busy={busyAction === "login"}
              disabled={Boolean(busyAction)}
              onClick={onLoginStart}
            />
          </div>
          <p className="mt-2 text-[11px] leading-4 text-zinc-400">
            默认环境下会返回 disabled，不会发送邮箱到 Supabase。
          </p>
        </div>

        <div className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            云 workspace 名称
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={workspaceName}
              onChange={(event) => onWorkspaceNameChange(event.target.value)}
              placeholder="ZhiNotes Research Workspace"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
            />
            <CloudAlphaButton
              label="创建 workspace"
              busy={busyAction === "workspace"}
              disabled={!hasUsableSession || Boolean(busyAction)}
              onClick={onWorkspaceCreate}
            />
          </div>
          <p className="mt-2 text-[11px] leading-4 text-zinc-400">
            只创建空 workspace 和 owner membership，不上传本地内容。
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              云 workspace 连接
            </div>
            <p className="mt-1 max-w-3xl text-[11px] leading-4 text-zinc-400">
              这里只做账号和 workspace 元数据检查。连接本地 workspace
              只是把 cloud workspace id 记在浏览器本地，不会上传任何页面内容。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CloudAlphaButton
              label="列出 workspace"
              busy={busyAction === "list-workspaces"}
              disabled={!hasUsableSession || Boolean(busyAction)}
              onClick={onWorkspaceList}
              variant="secondary"
            />
            <CloudAlphaButton
              label="Bootstrap 检查"
              busy={busyAction === "bootstrap"}
              disabled={
                !hasUsableSession ||
                !selectedWorkspaceId ||
                Boolean(busyAction)
              }
              onClick={onWorkspaceBootstrap}
              variant="secondary"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              选择云 workspace
            </label>
            <select
              value={selectedWorkspaceId}
              onChange={(event) => onSelectedWorkspaceChange(event.target.value)}
              disabled={workspaceOptions.length === 0 || Boolean(busyAction)}
              className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">未选择</option>
              {workspaceOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.role ?? "role unknown"} · {item.id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <CloudAlphaButton
              label="连接本地 workspace"
              busy={busyAction === "link-workspace"}
              disabled={
                !hasUsableSession ||
                !session?.user?.id ||
                !selectedWorkspaceId ||
                Boolean(busyAction)
              }
              onClick={onLinkWorkspace}
            />
            <CloudAlphaButton
              label="取消本地连接"
              busy={busyAction === "unlink-workspace"}
              disabled={!linkedWorkspaceId || Boolean(busyAction)}
              onClick={onUnlinkWorkspace}
              variant="secondary"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <CloudAlphaSmallRow
            label="Selected cloud workspace"
            value={selectedWorkspaceId || "None"}
          />
          <CloudAlphaSmallRow
            label="Linked local workspace"
            value={
              localIdentity?.cloud_workspace_name ||
              localIdentity?.cloud_workspace_id ||
              "Local only"
            }
          />
        </div>
      </div>

      {message && <CloudAlphaMessageBox message={message} />}
    </section>
  );
}

function CloudAlphaButton({
  label,
  busy,
  disabled,
  onClick,
  variant = "primary",
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
      : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-fit rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {busy ? "处理中..." : label}
    </button>
  );
}

function CloudAlphaMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: CloudAlphaMessageTone;
}) {
  return (
    <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <CloudAlphaTonePill tone={tone} />
      </div>
      <div className="mt-2 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 break-all text-[11px] leading-4 text-zinc-400">
        {detail}
      </div>
    </div>
  );
}

function CloudAlphaMessageBox({
  message,
}: {
  message: CloudAlphaMessage;
}) {
  const className =
    message.tone === "success"
      ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
      : message.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        : message.tone === "error"
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200";

  return (
    <div className={`mt-4 rounded-md border px-3 py-2 text-xs ${className}`}>
      <div className="font-semibold">{message.title}</div>
      <p className="mt-1 leading-5">{message.detail}</p>
    </div>
  );
}

function CloudAlphaSmallRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
      <div className="text-[11px] text-zinc-400">{label}</div>
      <div className="mt-1 break-all font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
        {value}
      </div>
    </div>
  );
}

function CloudAlphaTonePill({ tone }: { tone: CloudAlphaMessageTone }) {
  const labels: Record<CloudAlphaMessageTone, string> = {
    info: "Info",
    success: "Ready",
    warning: "Gated",
    error: "Error",
  };
  const className =
    tone === "success"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : tone === "error"
          ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[tone]}
    </span>
  );
}

function SyncOptInSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: SyncOptInGateStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <SyncOptInStatusPill status={status} />
      </div>
      <div className="mt-2 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function SyncOptInGateRow({
  gate,
}: {
  gate: SyncOptInGateReport["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {gate.title}
        </div>
        <SyncOptInStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function SyncOptInStatusPill({
  status,
}: {
  status: SyncOptInGateStatus;
}) {
  const labels: Record<SyncOptInGateStatus, string> = {
    ready: "Ready",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
  };

  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function BetaSummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: WebBetaReadinessStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <BetaStatusPill status={tone} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function IdentityMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 break-all font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function AccountBoundarySummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: AccountSessionBoundaryStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <AccountStatusPill status={status} />
      </div>
      <div className="mt-2 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function AccountPhaseRow({
  phase,
}: {
  phase: AccountSessionBoundary["phases"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {phase.title}
          </div>
          <div className="mt-1 break-all font-mono text-[11px] text-zinc-400">
            {phase.disabled_route ?? "local-only"}
          </div>
        </div>
        <AccountStatusPill status={phase.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {phase.current_boundary}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {phase.required_before_enablement}
      </p>
    </article>
  );
}

function AccountGateRow({
  gate,
}: {
  gate: AccountSessionBoundary["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {gate.title}
        </div>
        <AccountStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function AccountFieldRow({
  field,
}: {
  field: AccountSessionBoundary["fields"][number];
}) {
  const allowed = field.status === "allowed";

  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          {field.field}
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${
            allowed
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {allowed ? "Allowed" : "Forbidden"}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {field.purpose}
      </p>
    </article>
  );
}

function AccountStatusPill({
  status,
}: {
  status: AccountSessionBoundaryStatus;
}) {
  const labels: Record<AccountSessionBoundaryStatus, string> = {
    planned: "Planned",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
  };

  const className =
    status === "planned"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function AuditSummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: AuditTrailStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <AuditStatusPill status={tone} />
      </div>
      <div className="mt-2 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function AuditEventRow({
  event,
}: {
  event: AuditTrailPolicy["events"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {event.title}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-zinc-400">
            {event.category}
          </div>
        </div>
        <AuditStatusPill status={event.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {event.trigger}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {event.payload_policy}
      </p>
    </article>
  );
}

function AuditGateRow({
  gate,
}: {
  gate: AuditTrailPolicy["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {gate.title}
        </div>
        <AuditStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function AuditFieldRow({
  field,
}: {
  field: AuditTrailPolicy["fields"][number];
}) {
  const allowed = field.status === "allowed";

  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          {field.field}
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${
            allowed
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {allowed ? "Allowed" : "Forbidden"}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {field.purpose}
      </p>
    </article>
  );
}

function AuditStatusPill({ status }: { status: AuditTrailStatus }) {
  const labels: Record<AuditTrailStatus, string> = {
    planned: "Planned",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
  };

  const className =
    status === "planned"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function PermissionDecisionSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: PermissionDecisionStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <PermissionDecisionStatusPill status={status} />
      </div>
      <div className="mt-2 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function PermissionDecisionScenarioRow({
  scenario,
}: {
  scenario: PermissionDecisionReport["high_risk_scenarios"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {scenario.title}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            {scenario.roleId} · {scenario.resourceId} · {scenario.actionId}
          </div>
        </div>
        <PermissionDecisionStatusPill
          status={scenario.decision.decision_status}
        />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {scenario.decision.reason}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {scenario.decision.privacy_boundary}
      </p>
    </article>
  );
}

function PermissionDecisionGateRow({
  gate,
}: {
  gate: PermissionDecisionReport["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {gate.title}
        </div>
        <AuditStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function PermissionDecisionStatusPill({
  status,
}: {
  status: PermissionDecisionStatus;
}) {
  const labels: Record<PermissionDecisionStatus, string> = {
    "local-allowed": "Allowed",
    "local-denied": "Denied",
    "needs-confirmation": "Confirm",
    "server-blocked": "Server blocked",
  };

  const className =
    status === "local-allowed"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "needs-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function HighRiskRegistrySummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function HighRiskActionRegistryRow({
  action,
}: {
  action: HighRiskActionRegistryReport["actions"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {action.title}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {action.category}
            </span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {action.module_surface}
            </span>
          </div>
        </div>
        <HighRiskCoveragePill coverage={action.coverage} />
      </div>
      <div className="mt-2 rounded-md bg-zinc-50 px-2 py-1 font-mono text-[11px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {action.required_phrase}
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {action.current_boundary}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {action.can_execute_today
          ? "Can execute today only after typed confirmation and visible local review."
          : "Reserved or blocked until missing server, audit, rollback, or permission controls exist."}
      </p>
    </article>
  );
}

function HighRiskCoveragePill({
  coverage,
}: {
  coverage: HighRiskActionCoverage;
}) {
  const labels: Record<HighRiskActionCoverage, string> = {
    "local-receipt-available": "Receipt",
    planned: "Planned",
    blocked: "Blocked",
  };

  const className =
    coverage === "local-receipt-available"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : coverage === "planned"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[coverage]}
    </span>
  );
}

function PayloadSummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: SyncPayloadRisk;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <PayloadRiskPill risk={tone} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function PayloadTableRow({
  table,
}: {
  table: SyncPayloadPreview["tables"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {table.table_name}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            {table.included_count} included / {table.pending_count} pending
          </div>
        </div>
        <PayloadRiskPill risk={table.sensitivity} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {table.operations.map((operation) => (
          <span
            key={operation.operation}
            className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {operation.operation}: {operation.count}
          </span>
        ))}
      </div>
      {table.changed_fields.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {table.changed_fields.slice(0, 8).map((field) => (
            <span
              key={field}
              className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800"
            >
              {field}
            </span>
          ))}
          {table.changed_fields.length > 8 && (
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800">
              +{table.changed_fields.length - 8}
            </span>
          )}
        </div>
      )}
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {table.privacy_boundary}
      </p>
    </article>
  );
}

function PayloadRiskPill({ risk }: { risk: SyncPayloadRisk }) {
  const className =
    risk === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : risk === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {risk}
    </span>
  );
}

function ReplaySummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: SyncReplayTestStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <ReplayStatusPill status={tone} />
      </div>
      <div className="mt-2 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function ReplayScenarioRow({
  scenario,
}: {
  scenario: SyncReplayTestPlan["scenarios"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {scenario.title}
          </div>
          <div className="mt-1 break-all font-mono text-[11px] text-zinc-400">
            {scenario.endpoint}
          </div>
        </div>
        <ReplayStatusPill status={scenario.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {scenario.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {scenario.privacy_boundary}
      </p>
    </article>
  );
}

function ReplayGateRow({
  gate,
}: {
  gate: SyncReplayTestPlan["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {gate.title}
        </div>
        <ReplayStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function ReplayStatusPill({ status }: { status: SyncReplayTestStatus }) {
  const labels: Record<SyncReplayTestStatus, string> = {
    planned: "Planned",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
  };

  const className =
    status === "planned"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function RollbackSummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: RestoreRollbackRisk;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <RollbackRiskPill risk={tone} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function RollbackStepRow({
  step,
}: {
  step: RestoreRollbackPlan["steps"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {step.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {step.evidence}
          </p>
        </div>
        <RollbackStatusPill status={step.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {step.required_action}
      </p>
    </article>
  );
}

function RollbackScopeRow({
  scope,
}: {
  scope: RestoreRollbackPlan["scopes"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {scope.label}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            Current {scope.current_count} / Restore{" "}
            {scope.restore_count ?? "not previewed"}
          </div>
        </div>
        <RollbackRiskPill risk={scope.risk} />
      </div>
      <div className="mt-2 border-t border-zinc-100 pt-2 text-[11px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
        Write status: {scope.write_status}
      </div>
    </article>
  );
}

function RollbackStatusPill({
  status,
}: {
  status: RestoreRollbackStepStatus;
}) {
  const labels: Record<RestoreRollbackStepStatus, string> = {
    ready: "Ready",
    pending: "Pending",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
  };

  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "pending"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : status === "manual-confirmation"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function RollbackRiskPill({ risk }: { risk: RestoreRollbackRisk }) {
  const className =
    risk === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : risk === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {risk}
    </span>
  );
}

function RestoreWritebackSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: RestoreWritebackStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <RestoreWritebackStatusPill status={status} />
      </div>
      <div className="mt-2 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function RestoreWritebackStageRow({
  stage,
}: {
  stage: RestoreWritebackContract["stages"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {stage.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {stage.evidence}
          </p>
        </div>
        <RestoreWritebackStatusPill status={stage.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {stage.privacy_boundary}
      </p>
    </article>
  );
}

function RestoreWritebackGateRow({
  gate,
}: {
  gate: RestoreWritebackContract["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {gate.title}
        </div>
        <RestoreWritebackStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function RestoreWritebackStatusPill({
  status,
}: {
  status: RestoreWritebackStatus;
}) {
  const labels: Record<RestoreWritebackStatus, string> = {
    planned: "Planned",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
  };

  const className =
    status === "planned"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function MigrationSummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: CloudMigrationSensitivity;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <MigrationSensitivityPill sensitivity={tone} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function MigrationStepRow({
  step,
}: {
  step: CloudSchemaMigrationPlan["steps"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {step.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {step.evidence}
          </p>
        </div>
        <MigrationStatusPill status={step.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {step.required_action}
      </p>
    </article>
  );
}

function MigrationTableRow({
  table,
}: {
  table: CloudSchemaMigrationPlan["tables"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              #{table.migration_order}
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {table.table_name}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            Source: {table.local_source}
          </div>
        </div>
        <MigrationSensitivityPill sensitivity={table.sensitivity} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {table.local_evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {table.required_before_beta}
      </p>
    </article>
  );
}

function MigrationStatusPill({
  status,
}: {
  status: CloudMigrationStepStatus;
}) {
  const labels: Record<CloudMigrationStepStatus, string> = {
    planned: "Planned",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
  };

  const className =
    status === "planned"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function MigrationSensitivityPill({
  sensitivity,
}: {
  sensitivity: CloudMigrationSensitivity;
}) {
  const className =
    sensitivity === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : sensitivity === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {sensitivity}
    </span>
  );
}

function MigrationSqlSummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: CloudMigrationSqlStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <MigrationSqlStatusPill status={tone} />
      </div>
      <div className="mt-2 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function MigrationSqlStatementRow({
  statement,
}: {
  statement: CloudMigrationSqlDraft["statements"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              #{statement.order}
            </span>
            <span className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
              {statement.table_name}
            </span>
          </div>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap font-mono text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">
            {statement.sql_up}
          </p>
        </div>
        <MigrationSqlStatusPill status={statement.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {statement.privacy_boundary}
      </p>
    </article>
  );
}

function MigrationSqlGateRow({
  gate,
}: {
  gate: CloudMigrationSqlDraft["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {gate.title}
        </div>
        <MigrationSqlStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function MigrationSqlStatusPill({
  status,
}: {
  status: CloudMigrationSqlStatus;
}) {
  const labels: Record<CloudMigrationSqlStatus, string> = {
    drafted: "Drafted",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
  };

  const className =
    status === "drafted"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function PreflightSummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: WebBetaEnvironmentCheckStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <PreflightStatusPill status={tone} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function PreflightGroupRow({
  group,
}: {
  group: WebBetaEnvironmentPreflight["groups"][number];
}) {
  const complete = group.missing === 0;

  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold capitalize text-zinc-900 dark:text-zinc-100">
            {group.group}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            {group.present}/{group.required} required present
          </div>
        </div>
        <PreflightStatusPill status={complete ? "present" : "missing"} />
      </div>
    </article>
  );
}

function PreflightCheckRow({
  check,
}: {
  check: WebBetaEnvironmentPreflight["checks"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {check.key}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            {check.label} · {check.group}
          </div>
        </div>
        <PreflightStatusPill status={check.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {check.purpose}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {check.privacy_boundary}
      </p>
    </article>
  );
}

function PreflightStatusPill({
  status,
}: {
  status: WebBetaEnvironmentCheckStatus;
}) {
  const labels: Record<WebBetaEnvironmentCheckStatus, string> = {
    present: "Present",
    missing: "Missing",
    "optional-missing": "Optional",
  };

  const className =
    status === "present"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "missing"
        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
        : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function LaunchSummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: WebBetaLaunchStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <LaunchStatusPill status={tone} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function LaunchTrackRow({
  track,
}: {
  track: WebBetaLaunchChecklist["tracks"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {track.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {track.evidence}
          </p>
        </div>
        <LaunchStatusPill status={track.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {track.required_action}
      </p>
    </article>
  );
}

function LaunchRouteRow({
  routeCheck,
}: {
  routeCheck: WebBetaLaunchChecklist["routes"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {routeCheck.method}
            </span>
            <span className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
              {routeCheck.route}
            </span>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-zinc-400">
            {routeCheck.surface}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${
            routeCheck.status === "local-route"
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : routeCheck.status === "disabled-stub"
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                : routeCheck.status === "cloud-alpha-gated"
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {routeCheck.status}
        </span>
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {routeCheck.required_action}
      </p>
    </article>
  );
}

function RoutePreflightSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: WebBetaRoutePreflightStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <RoutePreflightStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function RoutePreflightRow({
  check,
}: {
  check: WebBetaRoutePreflightReport["checks"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {check.method}
            </span>
            <span className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
              {check.route}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {check.surface}
            </span>
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800">
              expected: {check.expected_status}
            </span>
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800">
              actual: {check.actual_status ?? "missing"}
            </span>
          </div>
        </div>
        <RoutePreflightStatusPill status={check.preflight_status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {check.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {check.privacy_boundary}
      </p>
    </article>
  );
}

function RoutePreflightStatusPill({
  status,
}: {
  status: WebBetaRoutePreflightStatus;
}) {
  const labels: Record<WebBetaRoutePreflightStatus, string> = {
    covered: "Covered",
    "status-mismatch": "Mismatch",
    missing: "Missing",
  };

  const className =
    status === "covered"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "status-mismatch"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function NextActionSummaryCard({
  label,
  value,
  detail,
  priority,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  priority?: WebBetaNextActionPriority;
  status?: WebBetaNextActionStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        {priority ? (
          <NextActionPriorityPill priority={priority} />
        ) : status ? (
          <NextActionStatusPill status={status} />
        ) : null}
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function NextActionRow({
  action,
}: {
  action: WebBetaNextActionPlan["actions"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {action.title}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <NextActionPriorityPill priority={action.priority} />
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {action.phase}
            </span>
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800">
              {action.source}
            </span>
          </div>
        </div>
        <NextActionStatusPill status={action.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {action.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {action.required_action}
      </p>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        Unlocks: {action.unlocks}
      </p>
    </article>
  );
}

function NextActionPriorityPill({
  priority,
}: {
  priority: WebBetaNextActionPriority;
}) {
  const className =
    priority === "p0"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : priority === "p1"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {priority.toUpperCase()}
    </span>
  );
}

function NextActionStatusPill({
  status,
}: {
  status: WebBetaNextActionStatus;
}) {
  const labels: Record<WebBetaNextActionStatus, string> = {
    "ready-to-build": "Ready",
    "needs-owner-decision": "Decision",
    "blocked-by-missing-cloud": "Blocked",
  };

  const className =
    status === "ready-to-build"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "needs-owner-decision"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function LaunchStatusPill({ status }: { status: WebBetaLaunchStatus }) {
  const labels: Record<WebBetaLaunchStatus, string> = {
    ready: "Ready",
    partial: "Partial",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
  };

  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "partial"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : status === "manual-confirmation"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function ConflictSummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: SyncConflictSeverity;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <ConflictSeverityPill severity={tone} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function ConflictSurfaceRow({
  surface,
}: {
  surface: SyncConflictReviewReport["surfaces"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {surface.surface}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <ConflictStatusPill status={surface.status} />
            <ConflictSeverityPill severity={surface.severity} />
          </div>
        </div>
        <div className="shrink-0 text-right text-[11px] text-zinc-400">
          {surface.active_local_tables.length} active tables
        </div>
      </div>
      {surface.active_local_tables.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {surface.active_local_tables.map((table) => (
            <span
              key={table}
              className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {table}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {surface.detection_rule}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {surface.review_action}
      </p>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        {surface.privacy_boundary}
      </p>
    </article>
  );
}

function ConflictStatusPill({
  status,
}: {
  status: SyncConflictReviewStatus;
}) {
  const labels: Record<SyncConflictReviewStatus, string> = {
    "policy-ready": "Policy ready",
    "needs-remote-baseline": "Needs baseline",
    "manual-only": "Manual only",
  };

  const className =
    status === "policy-ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "needs-remote-baseline"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function ConflictSeverityPill({
  severity,
}: {
  severity: SyncConflictSeverity;
}) {
  const className =
    severity === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : severity === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
      {severity}
    </span>
  );
}

function BetaGateRow({ gate }: { gate: WebBetaReadinessGate }) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-zinc-400">
            {gate.category}
          </div>
        </div>
        <BetaStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.nextAction}
      </p>
    </article>
  );
}

function BetaStatusPill({ status }: { status: WebBetaReadinessStatus }) {
  const labels: Record<WebBetaReadinessStatus, string> = {
    ready: "Ready",
    partial: "Partial",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
  };

  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "partial"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : status === "manual-confirmation"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function ContractPanel({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-md border border-zinc-100 p-3 dark:border-zinc-800 ${className}`}
    >
      <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ContractTextRow({
  title,
  status,
  detail,
  meta,
}: {
  title: string;
  status: WebBetaContractStatus;
  detail: string;
  meta: string;
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-800 dark:text-zinc-200">
          {title}
        </div>
        <ContractStatusPill status={status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {detail}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {meta}
      </p>
    </article>
  );
}

function ContractApiRow({
  api,
}: {
  api: (typeof SYNC_API_CONTRACTS)[number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {api.method}
            </span>
            <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200">
              {api.path}
            </span>
          </div>
        </div>
        <ContractStatusPill status={api.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {api.purpose}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {api.payloadBoundary}
      </p>
    </article>
  );
}

function ApiStubRow({ stub }: { stub: WebBetaApiStub }) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {stub.method}
            </span>
            <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200">
              {stub.path}
            </span>
          </div>
        </div>
        <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          Disabled stub
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {stub.purpose}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {stub.privacy_boundary}
      </p>
    </article>
  );
}

function ContractStatusPill({
  status,
}: {
  status: WebBetaContractStatus;
}) {
  const labels: Record<WebBetaContractStatus, string> = {
    "local-draft": "Local draft",
    planned: "Planned",
    required: "Required",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
  };

  const className =
    status === "required"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : status === "local-draft"
        ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        : status === "manual-confirmation"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : status === "blocked"
            ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            : "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function SyncEntryRow({ entry }: { entry: SyncLogEntry }) {
  return (
    <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${getOperationTone(
                entry.operation
              )}`}
            >
              {entry.operation}
            </span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {entry.tableName}
            </span>
          </div>
          <div className="mt-1 truncate text-zinc-400">{entry.rowId}</div>
          {entry.changedCols.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.changedCols.slice(0, 5).map((column) => (
                <span
                  key={column}
                  className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {column}
                </span>
              ))}
              {entry.changedCols.length > 5 && (
                <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800">
                  +{entry.changedCols.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right text-[11px] leading-4 text-zinc-400">
          {formatDate(entry.timestamp)}
        </div>
      </div>
    </div>
  );
}

function PermissionMatrix({ roleId }: { roleId: PermissionRoleId }) {
  const role = PERMISSION_ROLES.find((item) => item.id === roleId);
  const matrix = getRolePermissionMatrix(roleId);

  return (
    <div className="mt-4">
      {role && (
        <p className="mb-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          {role.detail}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="border-b border-zinc-200 pb-2 pr-3 text-left font-semibold text-zinc-500 dark:border-zinc-800">
                Resource
              </th>
              {matrix[0]?.actions.map(({ action }) => (
                <th
                  key={action.id}
                  className="border-b border-zinc-200 px-2 pb-2 text-center font-semibold text-zinc-500 dark:border-zinc-800"
                >
                  {action.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.resource.id}>
                <td className="border-b border-zinc-100 py-2 pr-3 align-top dark:border-zinc-800">
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">
                    {row.resource.title}
                  </div>
                  <div className="mt-1 max-w-48 text-[11px] leading-4 text-zinc-400">
                    {row.resource.detail}
                  </div>
                </td>
                {row.actions.map(({ action, allowed }) => (
                  <td
                    key={action.id}
                    className="border-b border-zinc-100 px-2 py-2 text-center align-top dark:border-zinc-800"
                  >
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded text-[11px] font-semibold ${
                        allowed
                          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                          : "bg-zinc-100 text-zinc-300 dark:bg-zinc-900 dark:text-zinc-700"
                      }`}
                    >
                      {allowed ? "Y" : "-"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getOperationTone(operation: string) {
  switch (operation) {
    case "insert":
      return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";
    case "update":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    case "delete":
      return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
    case "restore":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
    default:
      return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

function RestorePreviewPanel({
  fileName,
  preview,
}: {
  fileName: string | null;
  preview: WorkspaceRestorePreview;
}) {
  const countRows = [
    { label: "Active pages", value: preview.counts.activePages },
    { label: "Trash pages", value: preview.counts.deletedPages },
    { label: "Page versions", value: preview.counts.pageVersions },
    { label: "Page comments", value: preview.counts.pageComments },
    { label: "Block comments", value: preview.counts.blockComments },
    { label: "Databases", value: preview.counts.databases },
    { label: "Database fields", value: preview.counts.databaseFields },
    { label: "Database rows", value: preview.counts.databaseRows },
    { label: "Database views", value: preview.counts.databaseViews },
    { label: "Uploaded files", value: preview.counts.uploadedFiles },
    { label: "Favorites", value: preview.counts.favoritePages },
    { label: "Locked pages", value: preview.counts.lockedPages },
  ];

  return (
    <div className="mt-4 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {fileName || "Selected backup"}
          </div>
          <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Format {preview.format || "unknown"} · Version{" "}
            {preview.formatVersion ?? "unknown"} · Exported{" "}
            {preview.exportedAt ? formatDate(preview.exportedAt) : "unknown"}
          </div>
        </div>
        <span
          className={`w-fit rounded-md px-2 py-1 text-[10px] ${
            preview.valid
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {preview.valid ? "Valid backup" : "Needs attention"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {countRows.map((row) => (
          <div
            key={row.label}
            className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900"
          >
            <div className="text-[11px] text-zinc-400">{row.label}</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {row.value}
            </div>
          </div>
        ))}
      </div>

      {(preview.issues.length > 0 || preview.warnings.length > 0) && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {preview.issues.length > 0 && (
            <RestoreMessageList
              title="Issues"
              tone="issue"
              items={preview.issues}
            />
          )}
          {preview.warnings.length > 0 && (
            <RestoreMessageList
              title="Warnings"
              tone="warning"
              items={preview.warnings}
            />
          )}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          Restore write-back is intentionally disabled until the restore contract
          is confirmed.
        </p>
        <button
          type="button"
          disabled
          className="w-fit cursor-not-allowed rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-400 dark:border-zinc-800"
        >
          Restore disabled
        </button>
      </div>
    </div>
  );
}

function RestoreMessageList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "issue" | "warning";
  items: string[];
}) {
  const toneClass =
    tone === "issue"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200";

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="text-xs font-semibold">{title}</div>
      <ul className="mt-1 space-y-1 text-xs leading-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function ExportButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
    >
      {busy ? "Exporting..." : label}
    </button>
  );
}

function ReadinessCard({
  title,
  status,
  detail,
}: {
  title: string;
  status: ReadinessStatus;
  detail: string;
}) {
  return (
    <article className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <StatusPill status={status} />
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {detail}
      </p>
    </article>
  );
}

function StatusPill({ status }: { status: ReadinessStatus }) {
  const className =
    status === "Ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "Partial"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : status === "Needs confirmation"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {status}
    </span>
  );
}

function summarizeFiles(files: StoredPageFile[]) {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const kindCounts = files.reduce<Partial<Record<StoredPageFile["kind"], number>>>(
    (counts, file) => {
    counts[file.kind] = (counts[file.kind] ?? 0) + 1;
    return counts;
    },
    {}
  );

  return {
    totalSize: formatBytes(totalBytes),
    kinds: Object.entries(kindCounts)
      .map(([kind, count]) => ({
        kind: kind as StoredPageFile["kind"],
        count: Number(count ?? 0),
      }))
      .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind)),
  };
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${
    units[unitIndex]
  }`;
}

async function readCloudApiBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      message: text,
    };
  }
}

function getCloudApiDetail(
  body: Record<string, unknown> | null,
  response: Response
) {
  const message = getRecordString(body, "message");
  if (message) return message;

  const error = getRecordString(body, "error");
  const configStatus = getRecordString(body, "cloud_config_status");
  const missing = getStringArray(body?.missing_env);
  if (configStatus && missing.length > 0) {
    return `${configStatus}: ${missing.join(", ")}`;
  }

  const purpose = getRecordString(body, "purpose");
  if (purpose) return purpose;

  if (error) return error;
  return `HTTP ${response.status}`;
}

function getCloudSessionUser(body: Record<string, unknown> | null) {
  const user = getRecordValue(body, "user");
  if (!user) return null;
  const id = getRecordString(user, "id");
  const emailValue = user.email;
  if (!id) return null;

  return {
    id,
    email: typeof emailValue === "string" ? emailValue : null,
  };
}

function getCloudWorkspace(body: Record<string, unknown> | null) {
  const workspace = getRecordValue(body, "workspace");
  if (!workspace) return null;
  const id = getRecordString(workspace, "id");
  const name = getRecordString(workspace, "name");
  const betaStatus = getRecordString(workspace, "beta_status");
  if (!id || !name) return null;

  return {
    id,
    name,
    beta_status: betaStatus || "private-alpha",
    created_at: getRecordString(workspace, "created_at") || undefined,
    updated_at: getRecordString(workspace, "updated_at") || undefined,
  } satisfies CloudAlphaWorkspace;
}

function getCloudWorkspaces(body: Record<string, unknown> | null) {
  const value = body?.workspaces;
  if (!Array.isArray(value)) return [];

  const workspaces: CloudAlphaWorkspace[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = getRecordString(record, "id");
    const name = getRecordString(record, "name");
    if (!id || !name) continue;

    workspaces.push({
      id,
      name,
      beta_status: getRecordString(record, "beta_status") || "private-alpha",
      role: getCloudRole(record.role),
      membership_created_at:
        getRecordString(record, "membership_created_at") || undefined,
      created_at: getRecordString(record, "created_at") || undefined,
      updated_at: getRecordString(record, "updated_at") || undefined,
    });
  }

  return workspaces;
}

function getCloudMembership(body: Record<string, unknown> | null) {
  const membership = getRecordValue(body, "membership");
  if (!membership) return null;

  return {
    user_id: getRecordString(membership, "user_id"),
    role: getCloudRole(membership.role),
  };
}

function upsertCloudWorkspace(
  current: CloudAlphaWorkspace[],
  workspace: CloudAlphaWorkspace
) {
  const index = current.findIndex((item) => item.id === workspace.id);
  if (index === -1) return [workspace, ...current];
  return current.map((item) => (item.id === workspace.id ? workspace : item));
}

function getCloudRole(
  value: unknown
): "owner" | "researcher" | "viewer" | undefined {
  return value === "owner" || value === "researcher" || value === "viewer"
    ? value
    : undefined;
}

function getRecordString(
  record: Record<string, unknown> | null,
  key: string
) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function getRecordBoolean(
  record: Record<string, unknown> | null,
  key: string
) {
  const value = record?.[key];
  return typeof value === "boolean" ? value : false;
}

function getRecordValue(
  record: Record<string, unknown> | null,
  key: string
) {
  const value = record?.[key];
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isValidCloudEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function downloadJsonFile(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileSafeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
