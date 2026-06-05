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
  buildAuditEventEnvelopeContract,
  type AuditEventEnvelopeContract,
  type AuditEventEnvelopeStatus,
} from "@/lib/security/auditEventEnvelope";
import {
  buildAuditEventsApiDisabledResponse,
  type AuditEventsApiDisabledResponse,
  type AuditEventsApiFieldStatus,
  type AuditEventsApiValidationStatus,
} from "@/lib/security/auditEventsApiStub";
import {
  buildPermissionDecisionReport,
  type PermissionDecisionReport,
  type PermissionDecisionStatus,
} from "@/lib/security/permissionDecision";
import {
  buildPermissionCheckEnvelopeContract,
  type PermissionCheckEnvelopeContract,
  type PermissionCheckEnvelopeStatus,
} from "@/lib/security/permissionCheckEnvelope";
import {
  buildPermissionCheckValidatorReport,
  type PermissionCheckRequestValidationStatus,
  type PermissionCheckValidatorReport,
} from "@/lib/security/permissionCheckRequestValidator";
import {
  buildPermissionServerTestMatrix,
  type PermissionServerExpectedDecision,
  type PermissionServerMatrixCaseStatus,
  type PermissionServerTestMatrix,
} from "@/lib/security/permissionServerTestMatrix";
import {
  buildPermissionServerReadinessReport,
  type PermissionServerReadinessReport,
  type PermissionServerReadinessStatus,
} from "@/lib/security/permissionServerReadiness";
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
  buildPrivateFileStoragePolicyReport,
  type PrivateFileStoragePolicyReport,
  type PrivateFileStoragePolicyStatus,
} from "@/lib/sync/privateFileStoragePolicy";
import {
  buildFilePresignApiDisabledResponse,
  type FilePresignApiDisabledResponse,
  type FilePresignFieldStatus,
  type FilePresignValidationStatus,
} from "@/lib/sync/filePresignApiStub";
import {
  buildWebBetaNextActionPlan,
  type WebBetaNextActionCloudDependency,
  type WebBetaNextActionExecutionPath,
  type WebBetaNextActionOwner,
  type WebBetaNextActionPlan,
  type WebBetaNextActionPriority,
  type WebBetaNextActionStatus,
} from "@/lib/sync/webBetaNextActions";
import {
  buildWebLaunchWorkbenchPacket,
  type WebLaunchWorkbenchPacket,
} from "@/lib/sync/webLaunchWorkbench";
import {
  buildWebBetaOwnerReviewPacket,
  type WebBetaOwnerReviewPacket,
  type WebBetaOwnerReviewStatus,
} from "@/lib/sync/webBetaOwnerReviewPacket";
import {
  buildWebBetaStageGateReport,
  type WebBetaStageGate,
} from "@/lib/sync/webBetaStageGate";
import {
  buildWebBetaRoutePreflightReport,
  type WebBetaRoutePreflightReport,
  type WebBetaRoutePreflightStatus,
} from "@/lib/sync/webBetaRoutePreflight";
import {
  buildWebBetaDeploymentTarget,
  type WebBetaDeploymentTarget,
} from "@/lib/sync/webBetaDeploymentTarget";
import {
  buildWebBetaSmokeTestPlan,
  type WebBetaSmokeTestPlan,
  type WebBetaSmokeTestStatus,
} from "@/lib/sync/webBetaSmokeTestPlan";
import {
  buildWebAlphaHandoffBundle,
  type WebAlphaHandoffBundle,
  type WebAlphaHandoffStatus,
} from "@/lib/sync/webAlphaHandoffBundle";
import {
  buildWebAlphaLaunchDecisionReceipt,
  type WebAlphaLaunchDecisionReceipt,
  type WebAlphaLaunchDecisionStatus,
} from "@/lib/sync/webAlphaLaunchDecisionReceipt";
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
  buildSyncConflictResolutionContract,
  type SyncConflictResolutionContract,
  type SyncConflictResolutionStatus,
} from "@/lib/sync/syncConflictResolution";
import {
  buildRemoteBaselineRequestContract,
  type RemoteBaselineRequestContract,
  type RemoteBaselineRequestStatus,
} from "@/lib/sync/remoteBaselineRequest";
import {
  buildRemoteBaselineStagingContract,
  type RemoteBaselineStagingContract,
  type RemoteBaselineStagingStatus,
} from "@/lib/sync/remoteBaselineStaging";
import {
  buildRemoteBaselineStageSchemaContract,
  type RemoteBaselineStageSchemaContract,
  type RemoteBaselineStageSchemaStatus,
} from "@/lib/sync/remoteBaselineStageSchema";
import {
  buildRemoteBaselineStageReplayContract,
  type RemoteBaselineStageReplayContract,
  type RemoteBaselineStageReplayStatus,
} from "@/lib/sync/remoteBaselineStageReplay";
import {
  buildRemoteBaselineReplayFixturePackage,
  type RemoteBaselineReplayFixturePackage,
  type RemoteBaselineReplayFixtureStatus,
} from "@/lib/sync/remoteBaselineReplayFixture";
import {
  buildRemoteBaselineReplayHarnessPreflight,
  type RemoteBaselineReplayHarnessPreflight,
  type RemoteBaselineReplayHarnessStatus,
} from "@/lib/sync/remoteBaselineReplayHarness";
import {
  buildRemoteBaselineReplayRunnerSkeleton,
  type RemoteBaselineReplayRunnerSkeleton,
  type RemoteBaselineReplayRunnerStatus,
} from "@/lib/sync/remoteBaselineReplayRunner";
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
  buildCloudWorkspaceBootstrapProof,
  buildLocalWorkspaceCloudLinkReceipt,
  buildLocalWorkspaceIdentitySnapshot,
  getOrCreateLocalWorkspaceIdentity,
  linkLocalWorkspaceToCloud,
  readLocalWorkspaceIdentity,
  unlinkLocalWorkspaceFromCloud,
  type CloudWorkspaceBootstrapProof,
  type LocalWorkspaceIdentity,
} from "@/lib/sync/workspaceIdentity";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

type ExportAction = "backup" | "zip" | "markdown";
type SyncQueueAction =
  | "queue"
  | "payload-preview"
  | "conflict-review"
  | "conflict-resolution"
  | "conflict-review-ui"
  | "remote-baseline"
  | "remote-baseline-staging"
  | "remote-baseline-stage-schema"
  | "remote-baseline-stage-replay"
  | "remote-baseline-replay-confirmation"
  | "remote-baseline-replay-fixture"
  | "remote-baseline-replay-harness"
  | "remote-baseline-replay-runner"
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
  | "link-receipt"
  | "clear";
type WebBetaContractAction =
  | "contract"
  | "readiness"
  | "identity"
  | "cloud-schema-plan"
  | "launch-checklist"
  | "private-file-storage-policy"
  | "file-presign-api-guard"
  | "environment-preflight"
  | "audit-policy"
  | "audit-envelope"
  | "audit-events-api-guard"
  | "permission-decisions"
  | "permission-check-envelope"
  | "account-session"
  | "high-risk-registry"
  | "migration-sql"
  | "next-actions"
  | "stage-gate"
  | "deployment-target"
  | "smoke-test-plan"
  | "web-launch-workbench"
  | "web-alpha-handoff"
  | "web-alpha-launch-decision"
  | "web-beta-owner-review"
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
    title: "本地数据基础",
    status: "Ready",
    detail:
      "页面、数据库、关系字段、评论、版本和上传文件已经可以在浏览器本地运行。",
  },
  {
    title: "本地备份导出",
    status: "Ready",
    detail:
      "JSON 备份、工作区 ZIP 和 Markdown 导出已经可以通过浏览器下载。",
  },
  {
    title: "同步队列表",
    status: "Partial",
    detail:
      "核心页面、数据库、评论、关系和版本变更已经进入 sync_log，但远端回放还未完成。",
  },
  {
    title: "恢复流程",
    status: "Needs confirmation",
    detail:
      "恢复会把数据写回工作区，所以必须先确认恢复合同后再继续实现。",
  },
  {
    title: "登录和云数据库",
    status: "Missing",
    detail:
      "用户账号、服务端数据库、工作区身份和远端存储还没有正式实现。",
  },
  {
    title: "权限和分享",
    status: "Missing",
    detail:
      "私有工作区边界、角色检查和分享控制还需要独立模型。",
  },
  {
    title: "冲突处理",
    status: "Missing",
    detail:
      "多设备编辑冲突需要确定性的合并规则，才能把 Web Beta 视为安全。",
  },
];

const PRIVACY_BOUNDARIES = [
  "这个模块只读取本地数量统计，不上传笔记、文件、备份或数据库。",
  "云同步、AI 分析、外部报告资源和分享链接仍然需要明确确认后才能实现。",
  "恢复、批量导入和破坏性清理都属于独立高风险动作，不能静默执行。",
];

const WEB_BETA_STACK = [
  {
    title: "1. 账号层",
    detail: "登录、工作区身份、会话处理和私有工作区所有权。",
  },
  {
    title: "2. 云数据层",
    detail: "页面、数据库、文件、评论、版本和关系的服务端数据库结构。",
  },
  {
    title: "3. 同步层",
    detail: "待处理队列、拉取/推送 API、重试行为、冲突检测和设备快照。",
  },
  {
    title: "4. 恢复层",
    detail: "备份恢复、导入校验、回滚快照和错误恢复。",
  },
  {
    title: "5. 权限层",
    detail: "工作区角色、分享策略、模块级访问和审计历史。",
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
  const [cloudBootstrapProof, setCloudBootstrapProof] =
    useState<CloudWorkspaceBootstrapProof | null>(null);
  const [busyCloudAction, setBusyCloudAction] =
    useState<CloudAlphaAction | null>(null);
  const [cloudMessage, setCloudMessage] =
    useState<CloudAlphaMessage | null>(null);
  const [syncConfirmationPhrase, setSyncConfirmationPhrase] = useState("");
  const [
    remoteBaselineReplayConfirmationPhrase,
    setRemoteBaselineReplayConfirmationPhrase,
  ] = useState("");
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
            : "本地 API 暂时无法提供环境预检。"
        );
      } catch (err) {
        console.error("[Zhinote] Failed to load sync readiness data:", err);
        if (mounted) {
          setLoadError("无法加载全部本地准备度数据。");
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
        name: identity.cloud_workspace_name ?? "已连接云工作区",
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
        scopeSummary: `${syncOptInGate.payload_scope.pending_count} 条待同步记录；${syncOptInGate.payload_scope.high_risk_tables} 组高风险表；不包含页面正文；不包含文件字节。`,
        riskSummary:
          "第一次云同步在明确启用后可能传输私人研究元数据，并在后续传输工作区内容。",
        destinationSummary: workspaceIdentity?.cloud_workspace_id
          ? `Supabase workspace ${workspaceIdentity.cloud_workspace_id}`
          : "尚未连接云工作区。",
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
  const auditEventEnvelopeContract = useMemo(
    () =>
      buildAuditEventEnvelopeContract({
        workspaceIdentity,
        auditTrailPolicy,
        permissionDecisionReport,
        syncSummary,
      }),
    [auditTrailPolicy, permissionDecisionReport, syncSummary, workspaceIdentity]
  );
  const auditEventsApiGuard = useMemo(
    () => buildAuditEventsApiDisabledResponse(),
    []
  );
  const permissionCheckEnvelopeContract = useMemo(
    () =>
      buildPermissionCheckEnvelopeContract({
        workspaceIdentity,
        permissionDecisionReport,
        auditEventEnvelope: auditEventEnvelopeContract,
      }),
    [auditEventEnvelopeContract, permissionDecisionReport, workspaceIdentity]
  );
  const permissionCheckValidatorReport = useMemo(
    () => buildPermissionCheckValidatorReport(),
    []
  );
  const permissionServerTestMatrix = useMemo(
    () => buildPermissionServerTestMatrix(),
    []
  );
  const permissionServerReadinessReport = useMemo(
    () =>
      buildPermissionServerReadinessReport({
        validatorReport: permissionCheckValidatorReport,
        serverTestMatrix: permissionServerTestMatrix,
      }),
    [permissionCheckValidatorReport, permissionServerTestMatrix]
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
  const syncConflictResolution = useMemo(
    () =>
      buildSyncConflictResolutionContract({
        workspaceIdentity,
        conflictReview: syncConflictReview,
        replayTestPlan: syncReplayTestPlan,
        permissionDecisionReport,
        auditTrailPolicy,
      }),
    [
      auditTrailPolicy,
      permissionDecisionReport,
      syncConflictReview,
      syncReplayTestPlan,
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
  const remoteBaselineRequest = useMemo(
    () =>
      buildRemoteBaselineRequestContract({
        workspaceIdentity,
        conflictReview: syncConflictReview,
        conflictResolution: syncConflictResolution,
        replayTestPlan: syncReplayTestPlan,
        accountSessionBoundary,
        permissionDecisionReport,
        auditTrailPolicy,
      }),
    [
      accountSessionBoundary,
      auditTrailPolicy,
      permissionDecisionReport,
      syncConflictResolution,
      syncConflictReview,
      syncReplayTestPlan,
      workspaceIdentity,
    ]
  );
  const remoteBaselineStaging = useMemo(
    () =>
      buildRemoteBaselineStagingContract({
        workspaceIdentity,
        baselineRequest: remoteBaselineRequest,
        conflictResolution: syncConflictResolution,
        replayTestPlan: syncReplayTestPlan,
        permissionDecisionReport,
        auditTrailPolicy,
      }),
    [
      auditTrailPolicy,
      permissionDecisionReport,
      remoteBaselineRequest,
      syncConflictResolution,
      syncReplayTestPlan,
      workspaceIdentity,
    ]
  );
  const remoteBaselineStageSchema = useMemo(
    () =>
      buildRemoteBaselineStageSchemaContract({
        workspaceIdentity,
        baselineStaging: remoteBaselineStaging,
        permissionDecisionReport,
        auditTrailPolicy,
      }),
    [
      auditTrailPolicy,
      permissionDecisionReport,
      remoteBaselineStaging,
      workspaceIdentity,
    ]
  );
  const remoteBaselineStageReplay = useMemo(
    () =>
      buildRemoteBaselineStageReplayContract({
        workspaceIdentity,
        stageSchema: remoteBaselineStageSchema,
        permissionDecisionReport,
        auditTrailPolicy,
      }),
    [
      auditTrailPolicy,
      permissionDecisionReport,
      remoteBaselineStageSchema,
      workspaceIdentity,
    ]
  );
  const remoteBaselineReplayConfirmationReceipt = useMemo(
    () =>
      buildHighRiskConfirmationReceipt({
        actionId: "remote-baseline-stage-replay",
        requiredPhrase: getHighRiskRequiredPhrase(
          "remote-baseline-stage-replay"
        ),
        typedPhrase: remoteBaselineReplayConfirmationPhrase,
        actorLabel:
          cloudSession?.user?.email ?? cloudSession?.user?.id ?? null,
        localWorkspaceId: workspaceIdentity?.workspace_id ?? null,
        cloudWorkspaceId: workspaceIdentity?.cloud_workspace_id ?? null,
        scopeSummary: `${remoteBaselineStageReplay.summary.scenarios} disposable replay scenarios; ${remoteBaselineStageReplay.summary.rls_proofs} RLS proofs; ${remoteBaselineStageReplay.summary.rollback_proofs} rollback proofs; ${remoteBaselineStageReplay.summary.blocked} blocked replay gates; page text included: no; file bytes included: no.`,
        riskSummary:
          "A future disposable replay can connect to an empty disposable database to prove schema replay, RLS isolation, cursor monotonicity, idempotency, and rollback before any remote baseline apply path exists.",
        destinationSummary:
          "Disabled /api/sync/replay-test; empty disposable workspace fixtures only; no production workspace, private page text, file bytes, or database row values.",
      }),
    [
      cloudSession,
      remoteBaselineReplayConfirmationPhrase,
      remoteBaselineStageReplay,
      workspaceIdentity,
    ]
  );
  const remoteBaselineReplayFixturePackage = useMemo(
    () =>
      buildRemoteBaselineReplayFixturePackage({
        workspaceIdentity,
        stageSchema: remoteBaselineStageSchema,
        stageReplay: remoteBaselineStageReplay,
        replayConfirmationReceipt: remoteBaselineReplayConfirmationReceipt,
      }),
    [
      remoteBaselineReplayConfirmationReceipt,
      remoteBaselineStageReplay,
      remoteBaselineStageSchema,
      workspaceIdentity,
    ]
  );
  const remoteBaselineReplayHarnessPreflight = useMemo(
    () =>
      buildRemoteBaselineReplayHarnessPreflight({
        workspaceIdentity,
        stageSchema: remoteBaselineStageSchema,
        stageReplay: remoteBaselineStageReplay,
        fixturePackage: remoteBaselineReplayFixturePackage,
        permissionDecisionReport,
        auditTrailPolicy,
      }),
    [
      auditTrailPolicy,
      permissionDecisionReport,
      remoteBaselineReplayFixturePackage,
      remoteBaselineStageReplay,
      remoteBaselineStageSchema,
      workspaceIdentity,
    ]
  );
  const remoteBaselineReplayRunnerSkeleton = useMemo(
    () =>
      buildRemoteBaselineReplayRunnerSkeleton({
        workspaceIdentity,
        harnessPreflight: remoteBaselineReplayHarnessPreflight,
        fixturePackage: remoteBaselineReplayFixturePackage,
        stageReplay: remoteBaselineStageReplay,
        permissionDecisionReport,
        auditTrailPolicy,
      }),
    [
      auditTrailPolicy,
      permissionDecisionReport,
      remoteBaselineReplayFixturePackage,
      remoteBaselineReplayHarnessPreflight,
      remoteBaselineStageReplay,
      workspaceIdentity,
    ]
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
          ? `${restorePreview.counts.activePages} 个活跃页面；${restorePreview.counts.deletedPages} 个回收站页面；${restorePreview.counts.databases} 个数据库；${restorePreview.counts.databaseRows} 条数据库行；${restorePreview.counts.uploadedFiles} 条上传文件记录。`
          : "尚未加载恢复备份预览。",
        riskSummary:
          "未来恢复写回在明确启用后，可能覆盖或新增本地工作区页面、数据库、评论、版本、文件、收藏和锁定状态。",
        destinationSummary: workspaceIdentity
          ? `Local browser workspace ${workspaceIdentity.workspace_id}`
          : "没有可用的本地工作区身份。",
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
  const webBetaDeploymentTarget = useMemo(
    () => buildWebBetaDeploymentTarget(),
    []
  );
  const privateFileStoragePolicy = useMemo(
    () =>
      buildPrivateFileStoragePolicyReport({
        uploadedFiles: storedFiles.length,
        fileKinds: fileSummary.kinds,
        environmentPreflight,
      }),
    [environmentPreflight, fileSummary.kinds, storedFiles.length]
  );
  const filePresignApiGuard = useMemo(
    () => buildFilePresignApiDisabledResponse(),
    []
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
        privateFileStoragePolicy,
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
      privateFileStoragePolicy,
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
        deploymentTarget: webBetaDeploymentTarget,
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
      webBetaDeploymentTarget,
      environmentPreflight,
      permissionDecisionReport,
      workspaceIdentity,
    ]
  );
  const webBetaRoutePreflight = useMemo(
    () => buildWebBetaRoutePreflightReport(webBetaLaunchChecklist),
    [webBetaLaunchChecklist]
  );
  const webBetaStageGate = useMemo(
    () =>
      buildWebBetaStageGateReport({
        readinessReport: webBetaReadinessReport,
        launchChecklist: webBetaLaunchChecklist,
        deploymentTarget: webBetaDeploymentTarget,
        routePreflight: webBetaRoutePreflight,
        environmentPreflight,
        syncOptInGate,
      }),
    [
      environmentPreflight,
      syncOptInGate,
      webBetaDeploymentTarget,
      webBetaLaunchChecklist,
      webBetaReadinessReport,
      webBetaRoutePreflight,
    ]
  );
  const webBetaSmokeTestPlan = useMemo(
    () =>
      buildWebBetaSmokeTestPlan({
        deploymentTarget: webBetaDeploymentTarget,
        routePreflight: webBetaRoutePreflight,
        readinessReport: webBetaReadinessReport,
        environmentPreflight,
      }),
    [
      environmentPreflight,
      webBetaDeploymentTarget,
      webBetaReadinessReport,
      webBetaRoutePreflight,
    ]
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
  const webAlphaHandoffBundle = useMemo(
    () =>
      buildWebAlphaHandoffBundle({
        deploymentTarget: webBetaDeploymentTarget,
        launchChecklist: webBetaLaunchChecklist,
        routePreflight: webBetaRoutePreflight,
        stageGate: webBetaStageGate,
        smokeTestPlan: webBetaSmokeTestPlan,
        nextActionPlan: webBetaNextActionPlan,
        environmentPreflight,
      }),
    [
      environmentPreflight,
      webBetaDeploymentTarget,
      webBetaLaunchChecklist,
      webBetaNextActionPlan,
      webBetaRoutePreflight,
      webBetaSmokeTestPlan,
      webBetaStageGate,
    ]
  );
  const webAlphaLaunchDecisionReceipt = useMemo(
    () =>
      buildWebAlphaLaunchDecisionReceipt({
        handoffBundle: webAlphaHandoffBundle,
        stageGate: webBetaStageGate,
        nextActionPlan: webBetaNextActionPlan,
        environmentPreflight,
      }),
    [
      environmentPreflight,
      webAlphaHandoffBundle,
      webBetaNextActionPlan,
      webBetaStageGate,
    ]
  );
  const webBetaOwnerReviewPacket = useMemo(
    () =>
      buildWebBetaOwnerReviewPacket({
        stageGate: webBetaStageGate,
        nextActionPlan: webBetaNextActionPlan,
        smokeTestPlan: webBetaSmokeTestPlan,
        environmentPreflight,
      }),
    [
      environmentPreflight,
      webBetaNextActionPlan,
      webBetaSmokeTestPlan,
      webBetaStageGate,
    ]
  );
  const webLaunchWorkbenchPacket = useMemo(
    () =>
      buildWebLaunchWorkbenchPacket({
        stageGate: webBetaStageGate,
        nextActionPlan: webBetaNextActionPlan,
        ownerReviewPacket: webBetaOwnerReviewPacket,
        launchChecklist: webBetaLaunchChecklist,
        routePreflight: webBetaRoutePreflight,
        environmentPreflight,
        deploymentTarget: webBetaDeploymentTarget,
        syncOptInGate,
      }),
    [
      environmentPreflight,
      syncOptInGate,
      webBetaDeploymentTarget,
      webBetaLaunchChecklist,
      webBetaNextActionPlan,
      webBetaOwnerReviewPacket,
      webBetaRoutePreflight,
      webBetaStageGate,
    ]
  );
  const backupScope = useMemo(
    () => [
      {
        label: "活跃页面",
        value: pages.length,
        detail: "当前笔记和研究页面",
      },
      {
        label: "回收站页面",
        value: deletedPages.length,
        detail: "本地保留的软删除页面",
      },
      {
        label: "数据库",
        value: databases.length,
        detail: "本地 tracker 和研究表",
      },
      {
        label: "上传文件",
        value: storedFiles.length,
        detail: fileSummary.totalSize,
      },
      {
        label: "待同步记录",
        value: syncSummary?.pending ?? 0,
        detail:
          syncSummary && syncSummary.total > 0
            ? `${syncSummary.total} 条本地同步日志`
            : "还没有记录队列行",
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
    setCloudBootstrapProof((current) =>
      current?.workspace_id === workspaceId ? current : null
    );
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
        detail: err instanceof Error ? err.message : "未知云端错误",
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
        detail: err instanceof Error ? err.message : "未知云端错误",
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
              : "工作区列表读取失败",
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
      setCloudBootstrapProof((current) =>
        current && workspaces.some((workspace) => workspace.id === current.workspace_id)
          ? current
          : null
      );
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
        title: "工作区列表读取失败",
        detail: err instanceof Error ? err.message : "未知云端错误",
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
              : "工作区创建失败",
          detail: getCloudApiDetail(body, response),
        });
        return;
      }

      const workspace = getCloudWorkspace(body);
      setCloudWorkspace(workspace);
      if (workspace) {
        setCloudWorkspaces((current) => upsertCloudWorkspace(current, workspace));
        setSelectedCloudWorkspaceId(workspace.id);
        setCloudBootstrapProof(null);
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
        title: "工作区创建失败",
        detail: err instanceof Error ? err.message : "未知云端错误",
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
        detail: "启动检查需要一个有效的本地云会话。",
      });
      return;
    }

    const workspaceId =
      selectedCloudWorkspaceId || workspaceIdentity?.cloud_workspace_id || "";
    if (!workspaceId) {
      setCloudMessage({
        tone: "warning",
        title: "请选择云工作区",
        detail: "请先读取或创建一个云工作区，然后再做启动检查。",
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
              ? "云工作区启动检查尚未开启"
              : "启动检查失败",
          detail: getCloudApiDetail(body, response),
        });
        return;
      }

      const workspace = getCloudWorkspace(body);
      const membership = getCloudMembership(body);
      const moduleCount = getCloudModuleCount(body);
      const syncState = getCloudSyncState(body);
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

      if (workspace && membership?.user_id && membership.role) {
        const proof = buildCloudWorkspaceBootstrapProof({
          workspace: {
            id: workspace.id,
            name: workspace.name,
          },
          user: {
            id: membership.user_id,
          },
          role: membership.role,
          moduleCount,
          syncPushEnabled: syncState.push_enabled,
          syncPullEnabled: syncState.pull_enabled,
        });
        setCloudBootstrapProof(proof);
      }

      setCloudMessage({
        tone: "success",
        title: "启动检查通过",
        detail:
          `云端已确认当前用户可以访问该 workspace，并记录本地 bootstrap 证明。模块 ${moduleCount} 个，push/pull 仍关闭。`,
      });
    } catch (err) {
      console.error("[Zhinote] Cloud workspace bootstrap failed:", err);
      setCloudMessage({
        tone: "error",
        title: "启动检查失败",
        detail: err instanceof Error ? err.message : "未知云端错误",
      });
    } finally {
      setBusyCloudAction(null);
    }
  };

  const handleLinkCloudWorkspace = () => {
    if (!cloudSession?.user?.id) {
      setCloudMessage({
        tone: "warning",
        title: "需要先检查会话",
        detail: "请先完成登录并点击检查会话，让本地知道当前 Supabase 用户。",
      });
      return;
    }
    if (!selectedCloudWorkspace) {
      setCloudMessage({
        tone: "warning",
        title: "请选择云工作区",
        detail: "请先读取或创建一个云工作区。",
      });
      return;
    }
    const selectedRole = selectedCloudWorkspace.role ?? "owner";
    if (
      !cloudBootstrapProof ||
      cloudBootstrapProof.workspace_id !== selectedCloudWorkspace.id ||
      cloudBootstrapProof.cloud_user_id !== cloudSession.user.id ||
      cloudBootstrapProof.cloud_role !== selectedRole
    ) {
      setCloudMessage({
        tone: "warning",
        title: "需要先通过启动检查",
        detail:
          "连接本地工作区前，必须先用当前会话对选中的云工作区完成成员关系启动检查。",
      });
      return;
    }

    setBusyCloudAction("link-workspace");
    try {
      const nextIdentity = linkLocalWorkspaceToCloud({
        workspace: {
          id: selectedCloudWorkspace.id,
          name: selectedCloudWorkspace.name,
        },
        user: {
          id: cloudSession.user.id,
        },
        role: selectedRole,
        bootstrapProof: cloudBootstrapProof,
      });
      setWorkspaceIdentity(nextIdentity);
      setCloudWorkspace(selectedCloudWorkspace);
      setSelectedCloudWorkspaceId(selectedCloudWorkspace.id);
      setCloudMessage({
        tone: "success",
        title: "本地工作区已连接",
        detail:
          "已在浏览器本地记录云工作区 id 和启动检查证明。这个动作没有上传笔记、文件或数据库。",
      });
    } catch (err) {
      console.error("[Zhinote] Cloud workspace link failed:", err);
      setCloudMessage({
        tone: "error",
        title: "本地工作区连接失败",
        detail: err instanceof Error ? err.message : "未知云端错误",
      });
    } finally {
      setBusyCloudAction(null);
    }
  };

  const handleUnlinkCloudWorkspace = () => {
    setBusyCloudAction("unlink-workspace");
    const previousIdentity = workspaceIdentity;
    const nextIdentity = unlinkLocalWorkspaceFromCloud();
    setWorkspaceIdentity(nextIdentity);
    if (previousIdentity) {
      downloadJsonFile(
        `zhinote-cloud-link-unlink-receipt-${fileSafeTimestamp()}.json`,
        buildLocalWorkspaceCloudLinkReceipt({
          action: "unlink",
          identity: previousIdentity,
        })
      );
    }
    setSelectedCloudWorkspaceId("");
    setCloudWorkspace(null);
    setCloudBootstrapProof(null);
    setCloudMessage({
      tone: "success",
      title: "本地工作区已取消云连接",
      detail:
        "这只清除浏览器本地的云工作区链接，不删除云端工作区或本地笔记。",
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
    setCloudBootstrapProof(null);
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
      window.alert("导出失败。请打开控制台查看详情。");
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

  const handleExportSyncConflictResolution = () => {
    setBusyQueueAction("conflict-resolution");
    try {
      downloadJsonFile(
        `zhinote-sync-conflict-resolution-${fileSafeTimestamp()}.json`,
        {
          ...syncConflictResolution,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export sync conflict resolution:",
        err
      );
      window.alert(
        "Sync conflict resolution export failed. Please check the console."
      );
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportSyncConflictReviewUi = () => {
    setBusyQueueAction("conflict-review-ui");
    try {
      downloadJsonFile(
        `zhinote-sync-conflict-review-ui-${fileSafeTimestamp()}.json`,
        {
          ...syncConflictResolution.review_ui,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export sync review UI:", err);
      window.alert("Sync review UI export failed. Please check the console.");
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportRemoteBaselineRequest = () => {
    setBusyQueueAction("remote-baseline");
    try {
      downloadJsonFile(
        `zhinote-remote-baseline-request-${fileSafeTimestamp()}.json`,
        {
          ...remoteBaselineRequest,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export remote baseline request:", err);
      window.alert(
        "Remote baseline request export failed. Please check the console."
      );
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportRemoteBaselineStaging = () => {
    setBusyQueueAction("remote-baseline-staging");
    try {
      downloadJsonFile(
        `zhinote-remote-baseline-staging-${fileSafeTimestamp()}.json`,
        {
          ...remoteBaselineStaging,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export remote baseline staging:", err);
      window.alert(
        "Remote baseline staging export failed. Please check the console."
      );
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportRemoteBaselineStageSchema = () => {
    setBusyQueueAction("remote-baseline-stage-schema");
    try {
      downloadJsonFile(
        `zhinote-remote-baseline-stage-schema-${fileSafeTimestamp()}.json`,
        {
          ...remoteBaselineStageSchema,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export remote baseline stage schema:",
        err
      );
      window.alert(
        "Remote baseline stage schema export failed. Please check the console."
      );
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportRemoteBaselineStageReplay = () => {
    setBusyQueueAction("remote-baseline-stage-replay");
    try {
      downloadJsonFile(
        `zhinote-remote-baseline-stage-replay-${fileSafeTimestamp()}.json`,
        {
          ...remoteBaselineStageReplay,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export remote baseline stage replay:",
        err
      );
      window.alert(
        "Remote baseline stage replay export failed. Please check the console."
      );
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportRemoteBaselineReplayConfirmationReceipt = () => {
    setBusyQueueAction("remote-baseline-replay-confirmation");
    try {
      downloadJsonFile(
        `zhinote-remote-baseline-replay-confirmation-${fileSafeTimestamp()}.json`,
        {
          ...remoteBaselineReplayConfirmationReceipt,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export remote baseline replay confirmation receipt:",
        err
      );
      window.alert(
        "Remote baseline replay confirmation receipt failed. Please check the console."
      );
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportRemoteBaselineReplayFixturePackage = () => {
    setBusyQueueAction("remote-baseline-replay-fixture");
    try {
      downloadJsonFile(
        `zhinote-remote-baseline-replay-fixture-${fileSafeTimestamp()}.json`,
        {
          ...remoteBaselineReplayFixturePackage,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export remote baseline replay fixture package:",
        err
      );
      window.alert(
        "Remote baseline replay fixture export failed. Please check the console."
      );
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportRemoteBaselineReplayHarnessPreflight = () => {
    setBusyQueueAction("remote-baseline-replay-harness");
    try {
      downloadJsonFile(
        `zhinote-remote-baseline-replay-harness-${fileSafeTimestamp()}.json`,
        {
          ...remoteBaselineReplayHarnessPreflight,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export remote baseline replay harness preflight:",
        err
      );
      window.alert(
        "Remote baseline replay harness export failed. Please check the console."
      );
    } finally {
      setBusyQueueAction(null);
    }
  };

  const handleExportRemoteBaselineReplayRunnerSkeleton = () => {
    setBusyQueueAction("remote-baseline-replay-runner");
    try {
      downloadJsonFile(
        `zhinote-remote-baseline-replay-runner-${fileSafeTimestamp()}.json`,
        {
          ...remoteBaselineReplayRunnerSkeleton,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export remote baseline replay runner skeleton:",
        err
      );
      window.alert(
        "Remote baseline replay runner skeleton export failed. Please check the console."
      );
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
      window.alert("恢复回滚计划导出失败，请查看控制台。");
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
        "恢复写入合同导出失败，请查看控制台。"
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
        "恢复确认 receipt 导出失败，请查看控制台。"
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
          webBetaDeploymentTarget,
          webBetaSmokeTestPlan,
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

  const handleExportPrivateFileStoragePolicy = () => {
    setBusyContractAction("private-file-storage-policy");
    try {
      downloadJsonFile(
        `zhinote-private-file-storage-policy-${fileSafeTimestamp()}.json`,
        {
          ...privateFileStoragePolicy,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export private file storage policy:",
        err
      );
      window.alert(
        "Private file storage policy export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportFilePresignApiGuard = () => {
    setBusyContractAction("file-presign-api-guard");
    try {
      downloadJsonFile(
        `zhinote-file-presign-api-disabled-${fileSafeTimestamp()}.json`,
        {
          ...filePresignApiGuard,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export file presign guard:", err);
      window.alert(
        "File presign API guard export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportWebBetaDeploymentTarget = () => {
    setBusyContractAction("deployment-target");
    try {
      downloadJsonFile(
        `zhinote-web-beta-deployment-target-${fileSafeTimestamp()}.json`,
        {
          ...webBetaDeploymentTarget,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export web beta deployment target:",
        err
      );
      window.alert(
        "Web beta deployment target export failed. Please check the console."
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

  const handleExportWebBetaStageGate = () => {
    setBusyContractAction("stage-gate");
    try {
      downloadJsonFile(
        `zhinote-web-beta-stage-gate-${fileSafeTimestamp()}.json`,
        {
          ...webBetaStageGate,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export web beta stage gate:",
        err
      );
      window.alert(
        "Web beta stage gate export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportWebBetaSmokeTestPlan = () => {
    setBusyContractAction("smoke-test-plan");
    try {
      downloadJsonFile(
        `zhinote-web-beta-smoke-test-plan-${fileSafeTimestamp()}.json`,
        {
          ...webBetaSmokeTestPlan,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export web beta smoke test plan:",
        err
      );
      window.alert(
        "Web beta smoke test plan export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportWebAlphaHandoffBundle = () => {
    setBusyContractAction("web-alpha-handoff");
    try {
      downloadJsonFile(
        `zhinote-web-alpha-handoff-bundle-${fileSafeTimestamp()}.json`,
        {
          ...webAlphaHandoffBundle,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export web alpha handoff bundle:",
        err
      );
      window.alert(
        "Web Alpha handoff bundle export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportWebAlphaLaunchDecisionReceipt = () => {
    setBusyContractAction("web-alpha-launch-decision");
    try {
      downloadJsonFile(
        `zhinote-web-alpha-launch-decision-${fileSafeTimestamp()}.json`,
        {
          ...webAlphaLaunchDecisionReceipt,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export web alpha launch decision:",
        err
      );
      window.alert(
        "Web Alpha launch decision export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportWebBetaOwnerReviewPacket = () => {
    setBusyContractAction("web-beta-owner-review");
    try {
      downloadJsonFile(
        `zhinote-web-beta-owner-review-${fileSafeTimestamp()}.json`,
        {
          ...webBetaOwnerReviewPacket,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export web beta owner review packet:",
        err
      );
      window.alert(
        "Web Beta owner review packet export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportWebLaunchWorkbench = () => {
    setBusyContractAction("web-launch-workbench");
    try {
      downloadJsonFile(
        `zhinote-web-launch-workbench-${fileSafeTimestamp()}.json`,
        {
          ...webLaunchWorkbenchPacket,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export web launch workbench packet:",
        err
      );
      window.alert(
        "Web launch workbench export failed. Please check the console."
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
      window.alert("Web Beta 准备度导出失败，请查看控制台。");
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

  const handleWebLaunchStepOpen = (
    step: WebLaunchWorkbenchPacket["launch_sequence"][number]
  ) => {
    if (step.route === "/modules/sync") {
      document
        .getElementById(step.target_section_id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    router.push(step.route);
  };

  const handleWebLaunchSectionOpen = (sectionId: string) => {
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const handleExportAuditEventEnvelope = () => {
    setBusyContractAction("audit-envelope");
    try {
      downloadJsonFile(
        `zhinote-audit-event-envelope-${fileSafeTimestamp()}.json`,
        {
          ...auditEventEnvelopeContract,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export audit event envelope:", err);
      window.alert(
        "Audit event envelope export failed. Please check the console."
      );
    } finally {
      setBusyContractAction(null);
    }
  };

  const handleExportAuditEventsApiGuard = () => {
    setBusyContractAction("audit-events-api-guard");
    try {
      downloadJsonFile(
        `zhinote-audit-events-api-disabled-${fileSafeTimestamp()}.json`,
        {
          ...auditEventsApiGuard,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export audit events API guard:", err);
      window.alert(
        "Audit events API guard export failed. Please check the console."
      );
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

  const handleExportPermissionCheckEnvelope = () => {
    setBusyContractAction("permission-check-envelope");
    try {
      downloadJsonFile(
        `zhinote-permission-check-envelope-${fileSafeTimestamp()}.json`,
        {
          ...permissionCheckEnvelopeContract,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export permission check envelope:",
        err
      );
      window.alert(
        "Permission check envelope export failed. Please check the console."
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

  const handleExportCloudWorkspaceLinkReceipt = () => {
    if (!workspaceIdentity || workspaceIdentity.cloud_status !== "linked-alpha") {
      setCloudMessage({
        tone: "info",
        title: "没有已连接的云 workspace",
        detail: "本地 workspace 仍是 local-only，暂时没有连接收据可导出。",
      });
      return;
    }
    setBusyCloudAction("link-receipt");
    try {
      downloadJsonFile(
        `zhinote-cloud-link-receipt-${fileSafeTimestamp()}.json`,
        buildLocalWorkspaceCloudLinkReceipt({
          action: "link",
          identity: workspaceIdentity,
        })
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export cloud link receipt:", err);
      window.alert("云连接收据导出失败，请查看控制台。");
    } finally {
      setBusyCloudAction(null);
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
      setRestorePreviewError("无法读取这个本地备份文件。");
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
              <p className="text-xs font-medium tracking-wider text-zinc-400">
                Web Beta 准备度
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                云同步与权限
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                为 ZhiNotes 的私有 Web Beta 做准备：检查本地数据、备份覆盖、
                同步队列、恢复规划、权限和隐私边界。
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/modules")}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              所有模块
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
          bootstrapProof={cloudBootstrapProof}
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
          onExportLinkReceipt={handleExportCloudWorkspaceLinkReceipt}
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

        <WebLaunchDecisionSummaryPanel
          workbench={webLaunchWorkbenchPacket}
          alphaDecision={webAlphaLaunchDecisionReceipt}
          ownerReview={webBetaOwnerReviewPacket}
          busyAction={busyContractAction}
          onOpenSection={handleWebLaunchSectionOpen}
          onExportAlphaDecision={handleExportWebAlphaLaunchDecisionReceipt}
          onExportOwnerReview={handleExportWebBetaOwnerReviewPacket}
        />

        <section
          id="web-launch-workbench"
          className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Web 上线工作台总控
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把 Web Beta 阶段门禁、后续动作、用户复核、上线清单、
                路由预检、环境检查、部署目标和同步选择加入合并成一个本地上线
                动作包。当前结论：本地可继续，Web Beta 和云同步仍不可启动。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportWebLaunchWorkbench}
              disabled={busyContractAction === "web-launch-workbench"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "web-launch-workbench"
                ? "导出中..."
                : "导出 Web 上线工作台"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <BetaSummaryCard
              label="本地"
              value={
                webLaunchWorkbenchPacket.local_app_can_continue_now
                  ? "可继续"
                  : "不可继续"
              }
              detail="本地继续"
              tone="ready"
            />
            <BetaSummaryCard
              label="Web Beta"
              value={
                webLaunchWorkbenchPacket.web_beta_can_launch_now
                  ? "可上线"
                  : "不可上线"
              }
              detail="仍不可上线"
              tone="blocked"
            />
            <BetaSummaryCard
              label="云同步"
              value={
                webLaunchWorkbenchPacket.cloud_sync_can_start_now
                  ? "可启动"
                  : "不可启动"
              }
              detail="上传关闭"
              tone="blocked"
            />
            <BetaSummaryCard
              label="P0 动作"
              value={webLaunchWorkbenchPacket.summary.p0_actions}
              detail="优先处理"
              tone={
                webLaunchWorkbenchPacket.summary.p0_actions > 0
                  ? "blocked"
                  : "ready"
              }
            />
            <BetaSummaryCard
              label="阻塞"
              value={webLaunchWorkbenchPacket.summary.blocked_stages}
              detail="阶段门禁"
              tone={
                webLaunchWorkbenchPacket.summary.blocked_stages > 0
                  ? "blocked"
                  : "ready"
              }
            />
            <BetaSummaryCard
              label="本地优先"
              value={webLaunchWorkbenchPacket.summary.local_first_actions}
              detail="可本地先做"
              tone="partial"
            />
            <BetaSummaryCard
              label="用户"
              value={webLaunchWorkbenchPacket.summary.owner_decisions}
              detail="待决策"
              tone={
                webLaunchWorkbenchPacket.summary.owner_decisions > 0
                  ? "manual-confirmation"
                  : "ready"
              }
            />
            <BetaSummaryCard
              label="路由"
              value={webLaunchWorkbenchPacket.summary.route_mismatch_or_missing}
              detail="缺失/错配"
              tone={
                webLaunchWorkbenchPacket.summary.route_mismatch_or_missing > 0
                  ? "blocked"
                  : "ready"
              }
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                上线分组
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {webLaunchWorkbenchPacket.lanes.map((lane) => (
                  <WebLaunchLaneCard key={lane.id} lane={lane} />
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                P0 / 优先动作
              </div>
              <div className="mt-2 space-y-2">
                {webLaunchWorkbenchPacket.actions.slice(0, 8).map((action) => (
                  <WebLaunchActionCard key={action.id} action={action} />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              上线顺序
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {webLaunchWorkbenchPacket.launch_sequence.map((step) => (
                <WebLaunchSequenceCard
                  key={step.order}
                  step={step}
                  onOpen={handleWebLaunchStepOpen}
                />
              ))}
            </div>
          </div>
          <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            导出动作包不包含页面正文、数据库行数据、文件名、文件字节、
            密钥值、token、cookie、持仓或交易计划；也不会部署、连云、创建账号、
            上传数据、启用同步或启用 AI。
          </p>
        </section>

        <section
          id="web-beta-stage-gate"
          className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                云同步选择加入门槛
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                这是未来云端推送进入用户确认流程前的本地安全门槛。它检查云工作区连接、
                发送内容预览、敏感度、冲突基线、关闭状态的推送 API 和明确确认短语；
                当前不会上传数据。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportSyncOptInGate}
              disabled={busyQueueAction === "opt-in-gate"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyQueueAction === "opt-in-gate"
                ? "导出中..."
                : "导出同步确认门槛"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <SyncOptInSummaryCard
              label="结论"
              value="阻塞"
              detail="推送 API 仍关闭"
              status="blocked"
            />
            <SyncOptInSummaryCard
              label="就绪"
              value={syncOptInGate.summary.ready}
              detail="已满足门槛"
              status="ready"
            />
            <SyncOptInSummaryCard
              label="确认"
              value={syncOptInGate.summary.manual_confirmation}
              detail="需要用户复核"
              status="manual-confirmation"
            />
            <SyncOptInSummaryCard
              label="阻塞"
              value={syncOptInGate.summary.blocked}
              detail="必须先解决"
              status="blocked"
            />
            <SyncOptInSummaryCard
              label="短语"
              value={syncOptInGate.confirmation.required_phrase}
              detail="仅本地收集"
              status="manual-confirmation"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="grid gap-2 md:grid-cols-2">
              {syncOptInGate.gates.map((gate) => (
                <SyncOptInGateRow key={gate.id} gate={gate} />
              ))}
            </div>
            <ContractPanel title="选择加入边界">
              <div className="grid gap-2 md:grid-cols-2">
                <IdentityMetric
                  label="云工作区"
                  value={
                    syncOptInGate.workspace_identity.cloud_workspace_id ??
                    "未连接"
                  }
                  detail={
                    syncOptInGate.workspace_identity.cloud_role ??
                    "没有云端角色"
                  }
                />
                <IdentityMetric
                  label="待同步行"
                  value={String(syncOptInGate.payload_scope.pending_count)}
                  detail={`${syncOptInGate.payload_scope.high_risk_tables} 组高风险表`}
                />
                <IdentityMetric
                  label="启动证明"
                  value={
                    syncOptInGate.workspace_identity.bootstrap_checked_at
                      ? "已存在"
                      : "缺失"
                  }
                  detail={
                    syncOptInGate.workspace_identity.bootstrap_checked_at
                      ? `${formatDate(
                          syncOptInGate.workspace_identity
                            .bootstrap_checked_at
                        )}; ${syncOptInGate.workspace_identity.bootstrap_module_count ?? 0} modules`
                      : "连接前先做工作区启动检查"
                  }
                />
                <IdentityMetric
                  label="同步开关"
                  value={`push ${
                    syncOptInGate.workspace_identity.sync_push_enabled
                      ? "开"
                      : "关"
                  } / pull ${
                    syncOptInGate.workspace_identity.sync_pull_enabled
                      ? "开"
                      : "关"
                  }`}
                  detail="首次同步前必须保持关闭"
                />
                <IdentityMetric
                  label="上传"
                  value="已关闭"
                  detail="不上传笔记、文件或行"
                />
                <IdentityMetric
                  label="推送路由"
                  value="/api/sync/push"
                  detail="已关闭的本地桩接口"
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
                      ? "导出中..."
                      : "导出确认收据"}
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">
                  即使短语匹配，当前仍不会上传；推送 API 仍是关闭状态。收据只记录本地确认状态，不包含页面正文、文件内容、token 或 secret。
                </p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <IdentityMetric
                    label="短语匹配"
                    value={
                      syncConfirmationReceipt.typed_phrase_matches
                        ? "是"
                        : "否"
                    }
                    detail={syncConfirmationReceipt.status}
                  />
                  <IdentityMetric
                    label="收据边界"
                    value="仅本地"
                    detail="不上传、不写入、不删除、不调用 AI"
                  />
                  <IdentityMetric
                    label="目标"
                    value={syncConfirmationReceipt.destination_summary}
                    detail="未来上传前复核"
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
                同步回放测试计划
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                用于未来推送、拉取、确认、重试、冲突、高风险门槛和回滚行为的本地测试计划。
                它不会读取远端数据、上传笔记、写入工作区数据或确认同步行。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportSyncReplayTestPlan}
              disabled={busyQueueAction === "replay-test-plan"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyQueueAction === "replay-test-plan"
                ? "导出中..."
                : "导出回放计划"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <ReplaySummaryCard
              label="场景"
              value={syncReplayTestPlan.summary.scenarios}
              detail="回放案例"
              tone="planned"
            />
            <ReplaySummaryCard
              label="确认"
              value={syncReplayTestPlan.summary.manual_confirmation}
              detail="需要用户门槛"
              tone="manual-confirmation"
            />
            <ReplaySummaryCard
              label="阻塞"
              value={syncReplayTestPlan.summary.blocked}
              detail="服务端缺口"
              tone="blocked"
            />
            <ReplaySummaryCard
              label="端点"
              value="/api/sync/replay-test"
              detail="已关闭的本地桩接口"
              tone="blocked"
            />
            <ReplaySummaryCard
              label="边界"
              value="不回放"
              detail="不调用云端"
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
                本地工作区身份
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                用于未来同步元数据的匿名浏览器本地工作区和设备 id。
                这不是账号，不连接云服务，也不包含笔记正文或文件内容。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportWorkspaceIdentity}
              disabled={!workspaceIdentity || busyContractAction === "identity"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "identity"
                ? "导出中..."
                : "导出身份"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <IdentityMetric
              label="工作区"
              value={workspaceIdentity?.workspace_id ?? "加载中"}
              detail={workspaceIdentity?.workspace_name ?? "本地身份"}
            />
            <IdentityMetric
              label="设备"
              value={workspaceIdentity?.device_id ?? "加载中"}
              detail="浏览器本地设备 id"
            />
            <IdentityMetric
              label="云状态"
              value={workspaceIdentity?.cloud_status ?? "local-only"}
              detail="没有账号或云同步"
            />
            <IdentityMetric
              label="创建时间"
              value={
                workspaceIdentity
                  ? formatDate(workspaceIdentity.created_at)
                  : "加载中"
              }
              detail="本地生成"
            />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                账号会话边界
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                这是未来 Web Beta 登录的本地合同。它描述登录启动、会话读取、工作区启动、
                登出/撤销、本地到云端连接规则；不会创建账号、读取邮箱/密码/token/cookie，
                也不会连接认证服务。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportAccountSessionBoundary}
              disabled={busyContractAction === "account-session"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "account-session"
                ? "导出中..."
                : "导出账号边界"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <AccountBoundarySummaryCard
              label="阶段"
              value={accountSessionBoundary.summary.phases}
              detail="登录生命周期步骤"
              status="planned"
            />
            <AccountBoundarySummaryCard
              label="阻塞"
              value={accountSessionBoundary.summary.blocked}
              detail="服务商/会话缺口"
              status="blocked"
            />
            <AccountBoundarySummaryCard
              label="确认"
              value={accountSessionBoundary.summary.manual_confirmation}
              detail="本地连接云端"
              status="manual-confirmation"
            />
            <AccountBoundarySummaryCard
              label="认证路由"
              value={accountSessionBoundary.local_evidence.auth_disabled_routes}
              detail="已关闭的本地桩接口"
              status="blocked"
            />
            <AccountBoundarySummaryCard
              label="禁止字段"
              value={accountSessionBoundary.summary.forbidden_fields}
              detail="凭证字段"
              status="manual-confirmation"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <ContractPanel title="账号生命周期阶段">
              <div className="space-y-2">
                {accountSessionBoundary.phases.map((phase) => (
                  <AccountPhaseRow key={phase.id} phase={phase} />
                ))}
              </div>
            </ContractPanel>
            <ContractPanel title="账号启用门槛">
              <div className="space-y-2">
                {accountSessionBoundary.gates.map((gate) => (
                  <AccountGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </ContractPanel>
          </div>
          <ContractPanel title="认证 / 会话字段策略" className="mt-4">
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
                同步发送内容预览
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                面向未来云端推送的“仅元数据”预览。它汇总待同步表、操作、变更字段和隐私边界；
                不包含页面正文、文件字节，不创建账号，也不上传云端。
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleExportSyncPayloadPreview()}
              disabled={busyQueueAction === "payload-preview"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyQueueAction === "payload-preview"
                ? "导出中..."
                : "导出预览"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <PayloadSummaryCard
              label="待同步"
              value={syncPayloadPreview.summary.pending_count}
              detail="sync_log 中等待的行"
              tone="medium"
            />
            <PayloadSummaryCard
              label="已纳入"
              value={syncPayloadPreview.summary.included_count}
              detail={
                syncPayloadPreview.summary.truncated
                  ? "预览有上限"
                  : "预览覆盖已加载行"
              }
              tone="low"
            />
            <PayloadSummaryCard
              label="高风险"
              value={syncPayloadPreview.summary.high_risk_tables}
              detail="内容敏感表"
              tone="high"
            />
            <PayloadSummaryCard
              label="中风险"
              value={syncPayloadPreview.summary.medium_risk_tables}
              detail="结构或关系元数据"
              tone="medium"
            />
            <PayloadSummaryCard
              label="边界"
              value="仅元数据"
              detail="没有页面正文或文件字节"
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
              当前没有可预览的待同步行。等本地页面、数据库、评论、关系或版本变更进入
              sync_log 后，这里会自动出现预览。
            </p>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                冲突复核框架
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                面向未来多设备冲突的本地策略框架。它把冲突类型映射到复核动作；
                不读取远端数据、不合并变更、不写入工作区，也不上传任何内容。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportSyncConflictReview}
              disabled={busyQueueAction === "conflict-review"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyQueueAction === "conflict-review"
                ? "导出中..."
                : "导出冲突复核"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <ConflictSummaryCard
              label="冲突面"
              value={syncConflictReview.summary.surfaces}
              detail="已覆盖策略"
              tone="medium"
            />
            <ConflictSummaryCard
              label="策略就绪"
              value={syncConflictReview.summary.policy_ready}
              detail="没有本地待同步行"
              tone="low"
            />
            <ConflictSummaryCard
              label="需要基线"
              value={syncConflictReview.summary.needs_remote_baseline}
              detail="需要远端最新版本"
              tone="medium"
            />
            <ConflictSummaryCard
              label="仅手动"
              value={syncConflictReview.summary.manual_only}
              detail="绝不自动合并"
              tone="high"
            />
            <ConflictSummaryCard
              label="边界"
              value="不合并"
              detail="不写入、不上传"
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
                冲突解决合同
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                面向未来冲突决策的本地合同。它把每类冲突映射到允许的手动动作，
                例如保留本地、接受远端、手动合并、只追加、两者保留或跳过并标记。
                它不读取远端数据、不合并变更、不写工作区、不更新权限、不执行恢复，
                也不确认远端行。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportSyncConflictResolution}
                disabled={busyQueueAction === "conflict-resolution"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyQueueAction === "conflict-resolution"
                  ? "导出中..."
                  : "导出解决合同"}
              </button>
              <button
                type="button"
                onClick={handleExportSyncConflictReviewUi}
                disabled={busyQueueAction === "conflict-review-ui"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyQueueAction === "conflict-review-ui"
                  ? "导出中..."
                  : "导出复核界面"}
              </button>
              <button
                type="button"
                onClick={handleExportRemoteBaselineRequest}
                disabled={busyQueueAction === "remote-baseline"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyQueueAction === "remote-baseline"
                  ? "导出中..."
                  : "导出基线请求"}
              </button>
              <button
                type="button"
                onClick={handleExportRemoteBaselineStaging}
                disabled={busyQueueAction === "remote-baseline-staging"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyQueueAction === "remote-baseline-staging"
                  ? "导出中..."
                  : "导出基线暂存"}
              </button>
              <button
                type="button"
                onClick={handleExportRemoteBaselineStageSchema}
                disabled={busyQueueAction === "remote-baseline-stage-schema"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyQueueAction === "remote-baseline-stage-schema"
                  ? "导出中..."
                  : "导出阶段结构"}
              </button>
              <button
                type="button"
                onClick={handleExportRemoteBaselineStageReplay}
                disabled={busyQueueAction === "remote-baseline-stage-replay"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyQueueAction === "remote-baseline-stage-replay"
                  ? "导出中..."
                  : "导出阶段回放"}
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <ResolutionSummaryCard
              label="冲突面"
              value={syncConflictResolution.summary.surfaces}
              detail="解决方案"
              status="manual-confirmation"
            />
            <ResolutionSummaryCard
              label="复核界面"
              value={syncConflictResolution.summary.side_by_side_surfaces}
              detail="并排预览"
              status="planned"
            />
            <ResolutionSummaryCard
              label="选项"
              value={syncConflictResolution.summary.options}
              detail="手动动作"
              status="planned"
            />
            <ResolutionSummaryCard
              label="应用"
              value="已关闭"
              detail="/api/sync/pull"
              status="blocked"
            />
            <ResolutionSummaryCard
              label="阻塞"
              value={syncConflictResolution.summary.blocked_gates}
              detail="必须先构建"
              status="blocked"
            />
            <ResolutionSummaryCard
              label="确认"
              value={syncConflictResolution.summary.manual_confirmation_gates}
              detail="用户复核"
              status="manual-confirmation"
            />
            <ResolutionSummaryCard
              label="边界"
              value="不合并"
              detail="不写入/不上传"
              status="planned"
            />
          </div>
          <ContractPanel title="并排冲突复核" className="mt-4">
            <div className="flex flex-col gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400 md:flex-row md:items-start md:justify-between">
              <p className="max-w-3xl">
                base、本地和远端证据分栏的本地预览。当前只使用占位内容，
                所有动作保持关闭，不联系云服务，也不加载私人内容。
              </p>
              <span className="w-fit rounded-md bg-blue-50 px-2 py-1 text-[10px] text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {syncConflictResolution.review_ui.status}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {syncConflictResolution.review_ui.surface_reviews.map(
                (review) => (
                  <ResolutionReviewSurfaceRow
                    key={review.surface_id}
                    review={review}
                  />
                )
              )}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {syncConflictResolution.review_ui.checklist.map((item) => (
                <div
                  key={item}
                  className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
                >
                  {item}
                </div>
              ))}
            </div>
          </ContractPanel>
          <ContractPanel title="远端基线请求合同" className="mt-4">
            <div className="flex flex-col gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl">
                未来拉取远端基线前的本地合同。它定义“仅元数据”的拉取范围，
                先于任何云数据进入 Base / Local / Remote 复核分栏。端点仍关闭，
                不会发起网络请求。
              </p>
              <span className="w-fit rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">
                {remoteBaselineRequest.request_status}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <ResolutionSummaryCard
                label="端点"
                value={remoteBaselineRequest.request_scope.endpoint}
                detail={remoteBaselineRequest.method}
                status="blocked"
              />
              <ResolutionSummaryCard
                label="冲突面"
                value={remoteBaselineRequest.summary.surface_requests}
                detail="元数据计划"
                status="manual-confirmation"
              />
              <ResolutionSummaryCard
                label="需要基线"
                value={
                  remoteBaselineRequest.local_evidence.surfaces_needing_baseline
                }
                detail="冲突面"
                status="manual-confirmation"
              />
              <ResolutionSummaryCard
                label="阻塞门槛"
                value={remoteBaselineRequest.summary.blocked}
                detail="必须保持关闭"
                status="blocked"
              />
              <ResolutionSummaryCard
                label="允许字段"
                value={remoteBaselineRequest.summary.allowed_fields}
                detail="仅元数据"
                status="planned"
              />
              <ResolutionSummaryCard
                label="禁止字段"
                value={remoteBaselineRequest.summary.forbidden_fields}
                detail="私人载荷"
                status="blocked"
              />
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
                <div className="text-[10px] text-zinc-400">查询模式</div>
                <div className="mt-1 font-mono text-[11px] text-zinc-700 dark:text-zinc-200">
                  {remoteBaselineRequest.request_scope.query_mode}
                </div>
              </div>
              <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
                <div className="text-[10px] text-zinc-400">游标来源</div>
                <div className="mt-1 font-mono text-[11px] text-zinc-700 dark:text-zinc-200">
                  {remoteBaselineRequest.request_scope.cursor_source}
                </div>
              </div>
              <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
                <div className="text-[10px] text-zinc-400">响应处理</div>
                <div className="mt-1 font-mono text-[11px] text-zinc-700 dark:text-zinc-200">
                  {remoteBaselineRequest.request_scope.response_handling}
                </div>
              </div>
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                <div className="text-[10px]">网络</div>
                <div className="mt-1 font-medium">
                  不会发起网络请求
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <ContractPanel title="基线冲突面请求">
                <div className="space-y-2">
                  {remoteBaselineRequest.surface_requests.map((request) => (
                    <RemoteBaselineSurfaceRow
                      key={request.surface_id}
                      request={request}
                    />
                  ))}
                </div>
              </ContractPanel>
              <ContractPanel title="基线门槛">
                <div className="space-y-2">
                  {remoteBaselineRequest.gates.map((gate) => (
                    <RemoteBaselineGateRow key={gate.id} gate={gate} />
                  ))}
                </div>
              </ContractPanel>
            </div>
            <ContractPanel title="基线字段边界" className="mt-4">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {remoteBaselineRequest.fields.map((field) => (
                  <RemoteBaselineFieldRow key={field.field} field={field} />
                ))}
              </div>
            </ContractPanel>
          </ContractPanel>
          <ContractPanel
            title="远端基线暂存合同"
            className="mt-4"
          >
            <div className="flex flex-col gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl">
                面向未来“仅元数据拉取”和并排复核界面之间暂存步骤的本地合同。
                它定义计划中的 remote_baseline_stage 存储，并且只把暂存元数据映射到
                Remote 分栏。暂存、持久化、确认、应用、写入和上传仍保持关闭。
              </p>
              <span className="w-fit rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">
                {remoteBaselineStaging.staging_status}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <ResolutionSummaryCard
                label="暂存表"
                value={remoteBaselineStaging.disabled_stage_table}
                detail={remoteBaselineStaging.stage_store.write_status}
                status="blocked"
              />
              <ResolutionSummaryCard
                label="冲突面"
                value={remoteBaselineStaging.summary.stage_surfaces}
                detail="远端分栏映射"
                status="manual-confirmation"
              />
              <ResolutionSummaryCard
                label="阻塞"
                value={remoteBaselineStaging.summary.blocked}
                detail="必须保持关闭"
                status="blocked"
              />
              <ResolutionSummaryCard
                label="允许字段"
                value={remoteBaselineStaging.summary.allowed_fields}
                detail="仅元数据"
                status="planned"
              />
              <ResolutionSummaryCard
                label="禁止字段"
                value={remoteBaselineStaging.summary.forbidden_fields}
                detail="载荷正文"
                status="blocked"
              />
              <ResolutionSummaryCard
                label="持久化"
                value="已关闭"
                detail="不写暂存"
                status="blocked"
              />
              <ResolutionSummaryCard
                label="应用"
                value="已关闭"
                detail="仅复核"
                status="blocked"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <ContractPanel title="暂存表边界">
                <RemoteBaselineStageStoreCard
                  store={remoteBaselineStaging.stage_store}
                />
              </ContractPanel>
              <ContractPanel title="暂存门槛">
                <div className="space-y-2">
                  {remoteBaselineStaging.gates.map((gate) => (
                    <RemoteBaselineStageGateRow key={gate.id} gate={gate} />
                  ))}
                </div>
              </ContractPanel>
            </div>
            <ContractPanel title="远端分栏冲突面暂存" className="mt-4">
              <div className="grid gap-2 xl:grid-cols-2">
                {remoteBaselineStaging.surface_stages.map((surface) => (
                  <RemoteBaselineStageSurfaceRow
                    key={surface.surface_id}
                    surface={surface}
                  />
                ))}
              </div>
            </ContractPanel>
            <ContractPanel title="暂存字段边界" className="mt-4">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {remoteBaselineStaging.fields.map((field) => (
                  <RemoteBaselineStageFieldRow key={field.field} field={field} />
                ))}
              </div>
            </ContractPanel>
          </ContractPanel>
          <ContractPanel
            title="远端基线暂存结构和游标证明"
            className="mt-4"
          >
            <div className="flex flex-col gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl">
                remote_baseline_stage 的本地结构和游标证明草案。它定义仅元数据字段、
                禁止载荷字段、游标单调性规则、幂等规则和 SQL 复核语句。
                SQL 应用、游标持久化、暂存写入和远端应用仍保持关闭。
              </p>
              <span className="w-fit rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">
                {remoteBaselineStageSchema.schema_status}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <ResolutionSummaryCard
                label="暂存表"
                value={remoteBaselineStageSchema.stage_table.table_name}
                detail={remoteBaselineStageSchema.stage_table.create_status}
                status="blocked"
              />
              <ResolutionSummaryCard
                label="游标证明"
                value={remoteBaselineStageSchema.cursor_proof.table_name}
                detail={remoteBaselineStageSchema.cursor_proof.persist_status}
                status="blocked"
              />
              <ResolutionSummaryCard
                label="允许列"
                value={remoteBaselineStageSchema.summary.allowed_columns}
                detail="仅元数据"
                status="planned"
              />
              <ResolutionSummaryCard
                label="禁止列"
                value={remoteBaselineStageSchema.summary.forbidden_columns}
                detail="载荷列"
                status="blocked"
              />
              <ResolutionSummaryCard
                label="SQL draft"
                value={remoteBaselineStageSchema.summary.sql_statements}
                detail="应用关闭"
                status="blocked"
              />
              <ResolutionSummaryCard
                label="门槛"
                value={remoteBaselineStageSchema.summary.gates}
                detail="结构证明"
                status="manual-confirmation"
              />
              <ResolutionSummaryCard
                label="阻塞"
                value={remoteBaselineStageSchema.summary.blocked}
                detail="必须先证明"
                status="blocked"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <ContractPanel title="暂存结构草案">
                <RemoteBaselineStageSchemaTableCard
                  table={remoteBaselineStageSchema.stage_table}
                />
              </ContractPanel>
              <ContractPanel title="游标证明草案">
                <RemoteBaselineCursorProofCard
                  proof={remoteBaselineStageSchema.cursor_proof}
                />
              </ContractPanel>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <ContractPanel title="结构证明门槛">
                <div className="space-y-2">
                  {remoteBaselineStageSchema.gates.map((gate) => (
                    <RemoteBaselineStageSchemaGateRow
                      key={gate.id}
                      gate={gate}
                    />
                  ))}
                </div>
              </ContractPanel>
              <ContractPanel title="SQL 草案">
                <div className="space-y-2">
                  {remoteBaselineStageSchema.sql_draft.map((statement) => (
                    <RemoteBaselineStageSchemaSqlRow
                      key={statement.id}
                      statement={statement}
                    />
                  ))}
                </div>
              </ContractPanel>
            </div>
            <ContractPanel title="最终结构启用条件" className="mt-4">
              <div className="grid gap-2 md:grid-cols-2">
                {remoteBaselineStageSchema.final_enablement_conditions.map(
                  (condition) => (
                    <div
                      key={condition}
                      className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
                    >
                      {condition}
                    </div>
                  )
                )}
              </div>
            </ContractPanel>
          </ContractPanel>
          <ContractPanel
            title="远端基线一次性回放和 RLS 证明"
            className="mt-4"
          >
            <div className="flex flex-col gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl">
                用一次性数据证明暂存结构的本地回放合同。它覆盖 up/down SQL 回放、
                载荷拒绝名单、RLS 工作区隔离、游标单调性、幂等和回滚。
                回放、数据库连接、SQL 应用、写入和暂存仍保持关闭。
              </p>
              <span className="w-fit rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">
                {remoteBaselineStageReplay.replay_status}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <ResolutionSummaryCard
                label="场景"
                value={remoteBaselineStageReplay.summary.scenarios}
                detail="仅一次性数据"
                status="manual-confirmation"
              />
              <ResolutionSummaryCard
                label="RLS 证明"
                value={remoteBaselineStageReplay.summary.rls_proofs}
                detail="工作区隔离"
                status="blocked"
              />
              <ResolutionSummaryCard
                label="回滚"
                value={remoteBaselineStageReplay.summary.rollback_proofs}
                detail="反向路径"
                status="blocked"
              />
              <ResolutionSummaryCard
                label="门槛"
                value={remoteBaselineStageReplay.summary.gates}
                detail="回放门槛"
                status="manual-confirmation"
              />
              <ResolutionSummaryCard
                label="阻塞"
                value={remoteBaselineStageReplay.summary.blocked}
                detail="必须先证明"
                status="blocked"
              />
              <ResolutionSummaryCard
                label="应用"
                value="已关闭"
                detail="/api/cloud/migrations/apply"
                status="blocked"
              />
              <ResolutionSummaryCard
                label="回放"
                value="已关闭"
                detail="/api/sync/replay-test"
                status="blocked"
              />
            </div>
            <ContractPanel
              title="一次性回放用户确认收据"
              className="mt-4"
            >
              <div className="flex flex-col gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400 lg:flex-row lg:items-start lg:justify-between">
                <p className="max-w-3xl">
                  只有在确认回放会使用空的一次性工作区 fixture 后，才输入完全一致的短语。
                  导出这个收据不会运行回放、连接数据库、应用 SQL、暂存远端行、上传数据，
                  也不会启用 /api/sync/replay-test。
                </p>
                <span className="w-fit rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {remoteBaselineReplayConfirmationReceipt.status}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-2 lg:flex-row">
                <input
                  id="remote-baseline-replay-confirmation-phrase"
                  aria-label="Remote baseline replay confirmation phrase"
                  value={remoteBaselineReplayConfirmationPhrase}
                  onChange={(event) =>
                    setRemoteBaselineReplayConfirmationPhrase(
                      event.target.value
                    )
                  }
                  placeholder={
                    remoteBaselineReplayConfirmationReceipt.required_phrase
                  }
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
                />
                <button
                  type="button"
                  onClick={handleExportRemoteBaselineReplayConfirmationReceipt}
                  disabled={
                    busyQueueAction === "remote-baseline-replay-confirmation"
                  }
                  className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {busyQueueAction === "remote-baseline-replay-confirmation"
                    ? "导出中..."
                    : "导出回放收据"}
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <IdentityMetric
                  label="必需短语"
                  value={remoteBaselineReplayConfirmationReceipt.required_phrase}
                  detail="区分大小写"
                />
                <IdentityMetric
                  label="短语匹配"
                  value={
                    remoteBaselineReplayConfirmationReceipt.typed_phrase_matches
                      ? "是"
                      : "否"
                  }
                  detail={remoteBaselineReplayConfirmationReceipt.status}
                />
                <IdentityMetric
                  label="收据边界"
                  value="仅本地"
                  detail="没有页面正文或文件字节"
                />
                <IdentityMetric
                  label="回放路由"
                  value="/api/sync/replay-test"
                  detail="仍然关闭"
                />
              </div>
            </ContractPanel>
            <ContractPanel title="空 fixture 回放包" className="mt-4">
              <div className="flex flex-col gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400 lg:flex-row lg:items-start lg:justify-between">
                <p className="max-w-3xl">
                  下一步一次性回放的本地包。它包含空工作区 fixture、匿名 fixture 用户、
                  0 条暂存行、0 条游标行和载荷拒绝名单。导出它不会连接数据库、
                  运行回放、应用 SQL、写服务端数据或上传工作区数据。
                </p>
                <button
                  type="button"
                  onClick={handleExportRemoteBaselineReplayFixturePackage}
                  disabled={busyQueueAction === "remote-baseline-replay-fixture"}
                  className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {busyQueueAction === "remote-baseline-replay-fixture"
                    ? "导出中..."
                    : "导出空 fixture"}
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <IdentityMetric
                  label="Fixture 工作区"
                  value={`${remoteBaselineReplayFixturePackage.summary.fixture_workspaces}`}
                  detail="仅空数据"
                />
                <IdentityMetric
                  label="暂存行"
                  value={`${remoteBaselineReplayFixturePackage.summary.stage_seed_rows}`}
                  detail="没有远端行"
                />
                <IdentityMetric
                  label="游标行"
                  value={`${remoteBaselineReplayFixturePackage.summary.cursor_proof_seed_rows}`}
                  detail="没有确认位移"
                />
                <IdentityMetric
                  label="拒绝字段"
                  value={`${remoteBaselineReplayFixturePackage.summary.forbidden_payload_columns}`}
                  detail="载荷已阻止"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {remoteBaselineReplayFixturePackage.payload_column_denylist
                  .slice(0, 12)
                  .map((field) => (
                    <span
                      key={field}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {field}
                    </span>
                  ))}
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {remoteBaselineReplayFixturePackage.validation_checks.map(
                  (check) => (
                    <RemoteBaselineReplayFixtureValidationRow
                      key={check.id}
                      check={check}
                    />
                  )
                )}
              </div>
            </ContractPanel>
            <ContractPanel
              title="一次性回放脚手架预检"
              className="mt-4"
            >
              <div className="flex flex-col gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400 lg:flex-row lg:items-start lg:justify-between">
                <p className="max-w-3xl">
                  本地 dry-run 清单，用来连接确认收据、空 fixture 包、暂存结构和
                  回放/RLS 证明合同。它不会运行脚手架、连接数据库、应用 SQL、
                  写服务端数据、暂存远端行或上传工作区数据。
                </p>
                <button
                  type="button"
                  onClick={handleExportRemoteBaselineReplayHarnessPreflight}
                  disabled={busyQueueAction === "remote-baseline-replay-harness"}
                  className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {busyQueueAction === "remote-baseline-replay-harness"
                    ? "导出中..."
                    : "导出脚手架预检"}
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <IdentityMetric
                  label="步骤"
                  value={`${remoteBaselineReplayHarnessPreflight.summary.steps}`}
                  detail="仅 dry-run"
                />
                <IdentityMetric
                  label="断言"
                  value={`${remoteBaselineReplayHarnessPreflight.summary.assertions}`}
                  detail="本地检查"
                />
                <IdentityMetric
                  label="就绪检查"
                  value={`${remoteBaselineReplayHarnessPreflight.summary.ready}`}
                  detail="当前可检查"
                />
                <IdentityMetric
                  label="阻塞"
                  value={`${remoteBaselineReplayHarnessPreflight.summary.blocked}`}
                  detail="还没有 runner"
                />
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <ContractPanel title="脚手架 dry-run 步骤">
                  <div className="space-y-2">
                    {remoteBaselineReplayHarnessPreflight.steps.map((step) => (
                      <RemoteBaselineReplayHarnessStepRow
                        key={step.id}
                        step={step}
                      />
                    ))}
                  </div>
                </ContractPanel>
                <ContractPanel title="脚手架断言">
                  <div className="space-y-2">
                    {remoteBaselineReplayHarnessPreflight.assertions.map(
                      (assertion) => (
                        <RemoteBaselineReplayHarnessAssertionRow
                          key={assertion.id}
                          assertion={assertion}
                        />
                      )
                    )}
                  </div>
                </ContractPanel>
              </div>
              <ContractPanel title="脚手架门槛" className="mt-4">
                <div className="grid gap-2 md:grid-cols-2">
                  {remoteBaselineReplayHarnessPreflight.gates.map((gate) => (
                    <RemoteBaselineReplayHarnessGateRow
                      key={gate.id}
                      gate={gate}
                    />
                  ))}
                </div>
              </ContractPanel>
            </ContractPanel>
            <ContractPanel
              title="已关闭的回放 runner 骨架"
              className="mt-4"
            >
              <div className="flex flex-col gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400 lg:flex-row lg:items-start lg:justify-between">
                <p className="max-w-3xl">
                  未来一次性回放测试的本地 runner 地图。导出内容只列出入口、阶段和拒绝原因；
                  runner 默认关闭，不能连接数据库、发起网络请求、应用 SQL、写服务端数据、
                  暂存远端行、确认游标或上传工作区数据。
                </p>
                <button
                  type="button"
                  onClick={handleExportRemoteBaselineReplayRunnerSkeleton}
                  disabled={busyQueueAction === "remote-baseline-replay-runner"}
                  className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {busyQueueAction === "remote-baseline-replay-runner"
                    ? "导出中..."
                    : "导出 runner 骨架"}
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <IdentityMetric
                  label="入口"
                  value={`${remoteBaselineReplayRunnerSkeleton.summary.entrypoints}`}
                  detail="仅导出"
                />
                <IdentityMetric
                  label="阶段"
                  value={`${remoteBaselineReplayRunnerSkeleton.summary.phases}`}
                  detail="Runner 已关闭"
                />
                <IdentityMetric
                  label="拒绝项"
                  value={`${remoteBaselineReplayRunnerSkeleton.summary.refusal_reasons}`}
                  detail="运行已阻止"
                />
                <IdentityMetric
                  label="阻塞"
                  value={`${remoteBaselineReplayRunnerSkeleton.summary.blocked}`}
                  detail="没有实时回放"
                />
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <ContractPanel title="Runner 入口">
                  <div className="space-y-2">
                    {remoteBaselineReplayRunnerSkeleton.entrypoints.map(
                      (entrypoint) => (
                        <RemoteBaselineReplayRunnerEntryPointRow
                          key={entrypoint.id}
                          entrypoint={entrypoint}
                        />
                      )
                    )}
                  </div>
                </ContractPanel>
                <ContractPanel title="Runner 阶段">
                  <div className="space-y-2">
                    {remoteBaselineReplayRunnerSkeleton.phases.map((phase) => (
                      <RemoteBaselineReplayRunnerPhaseRow
                        key={phase.id}
                        phase={phase}
                      />
                    ))}
                  </div>
                </ContractPanel>
              </div>
              <ContractPanel title="Runner 拒绝原因" className="mt-4">
                <div className="grid gap-2 md:grid-cols-2">
                  {remoteBaselineReplayRunnerSkeleton.refusal_reasons.map(
                    (reason) => (
                      <RemoteBaselineReplayRunnerRefusalRow
                        key={reason.id}
                        reason={reason}
                      />
                    )
                  )}
                </div>
              </ContractPanel>
            </ContractPanel>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <ContractPanel title="一次性回放场景">
                <div className="space-y-2">
                  {remoteBaselineStageReplay.scenarios.map((scenario) => (
                    <RemoteBaselineStageReplayScenarioRow
                      key={scenario.id}
                      scenario={scenario}
                    />
                  ))}
                </div>
              </ContractPanel>
              <ContractPanel title="回放门槛">
                <div className="space-y-2">
                  {remoteBaselineStageReplay.gates.map((gate) => (
                    <RemoteBaselineStageReplayGateRow
                      key={gate.id}
                      gate={gate}
                    />
                  ))}
                </div>
              </ContractPanel>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <ContractPanel title="RLS 证明矩阵">
                <div className="space-y-2">
                  {remoteBaselineStageReplay.rls_proofs.map((proof) => (
                    <RemoteBaselineRlsProofRow key={proof.id} proof={proof} />
                  ))}
                </div>
              </ContractPanel>
              <ContractPanel title="回滚证明计划">
                <div className="space-y-2">
                  {remoteBaselineStageReplay.rollback_proofs.map((proof) => (
                    <RemoteBaselineRollbackProofRow
                      key={proof.id}
                      proof={proof}
                    />
                  ))}
                </div>
              </ContractPanel>
            </div>
            <ContractPanel title="最终回放启用条件" className="mt-4">
              <div className="grid gap-2 md:grid-cols-2">
                {remoteBaselineStageReplay.final_enablement_conditions.map(
                  (condition) => (
                    <div
                      key={condition}
                      className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
                    >
                      {condition}
                    </div>
                  )
                )}
              </div>
            </ContractPanel>
          </ContractPanel>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <ContractPanel title="冲突面解决计划">
              <div className="space-y-2">
                {syncConflictResolution.surface_plans.map((surface) => (
                  <ResolutionSurfacePlanRow
                    key={surface.surface_id}
                    surface={surface}
                  />
                ))}
              </div>
            </ContractPanel>
            <ContractPanel title="解决门槛">
              <div className="space-y-2">
                {syncConflictResolution.gates.map((gate) => (
                  <ResolutionGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </ContractPanel>
          </div>
          <ContractPanel title="手动解决选项" className="mt-4">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {syncConflictResolution.options.map((option) => (
                <ResolutionOptionRow key={option.id} option={option} />
              ))}
            </div>
          </ContractPanel>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Web Beta 阶段门禁
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                这是判断 ZhiNotes 是否能从本地工作台进入私有 Web Beta 的本地上线门禁。
                它汇总账号、云数据库、私有文件存储、同步、权限、恢复和部署阻塞项；
                不连接云服务、不上传数据，也不启用同步。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportWebBetaStageGate}
              disabled={busyContractAction === "stage-gate"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "stage-gate"
                ? "导出中..."
                : "导出阶段门禁"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <BetaSummaryCard
              label="本地应用"
              value={webBetaStageGate.local_app_can_continue_now ? "是" : "否"}
              detail="继续本地构建"
              tone="ready"
            />
            <BetaSummaryCard
              label="Web Beta"
              value={webBetaStageGate.web_beta_can_launch_now ? "就绪" : "否"}
              detail="上线仍阻塞"
              tone="blocked"
            />
            <BetaSummaryCard
              label="云同步"
              value={webBetaStageGate.cloud_sync_can_start_now ? "就绪" : "否"}
              detail="上传已关闭"
              tone="blocked"
            />
            <BetaSummaryCard
              label="P0 阻塞"
              value={webBetaStageGate.summary.p0_blockers}
              detail="必须先清除"
              tone={
                webBetaStageGate.summary.p0_blockers > 0 ? "blocked" : "ready"
              }
            />
            <BetaSummaryCard
              label="缺失环境"
              value={webBetaStageGate.summary.required_environment_missing}
              detail="必需设置"
              tone={
                webBetaStageGate.summary.required_environment_missing > 0
                  ? "blocked"
                  : "ready"
              }
            />
            <BetaSummaryCard
              label="阶段阻塞"
              value={webBetaStageGate.summary.blocked}
              detail="整体门槛"
              tone={
                webBetaStageGate.summary.blocked > 0 ? "blocked" : "ready"
              }
            />
          </div>
          <div className="mt-4 grid gap-2 xl:grid-cols-3">
            {webBetaStageGate.gates.map((gate) => (
              <StageGateRow key={gate.id} gate={gate} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                私有文件存储政策
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Web Beta 前的本地存储政策。它列清未来 HTML 报告、PDF、Office、
                notebook、压缩包和媒体文件上云前必须满足的私有 bucket、签名 URL、
                checksum、大小限制、权限和审计门槛；当前不创建 bucket、不生成 URL、
                不上传文件。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPrivateFileStoragePolicy}
              disabled={busyContractAction === "private-file-storage-policy"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "private-file-storage-policy"
                ? "导出中..."
                : "导出存储政策"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <PrivateFileStorageSummaryCard
              label="本地文件"
              value={privateFileStoragePolicy.local_evidence.uploaded_files}
              detail="仅数量"
              status="planned"
            />
            <PrivateFileStorageSummaryCard
              label="Buckets"
              value={privateFileStoragePolicy.summary.buckets}
              detail="仅私有"
              status="planned"
            />
            <PrivateFileStorageSummaryCard
              label="阻塞"
              value={privateFileStoragePolicy.summary.blocked}
              detail="文件同步前"
              status="blocked"
            />
            <PrivateFileStorageSummaryCard
              label="签名 URL"
              value={`${privateFileStoragePolicy.summary.signed_url_ttl_minutes}m`}
              detail="未来最大 TTL"
              status="manual-confirmation"
            />
            <PrivateFileStorageSummaryCard
              label="最大大小"
              value={`${privateFileStoragePolicy.summary.max_upload_size_mb}MB`}
              detail="默认限制"
              status="manual-confirmation"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <ContractPanel title="存储门槛">
              <div className="space-y-2">
                {privateFileStoragePolicy.gates.map((gate) => (
                  <PrivateFileStorageGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </ContractPanel>
            <ContractPanel title="Bucket 和路由政策">
              <div className="grid gap-2 md:grid-cols-2">
                {privateFileStoragePolicy.buckets.map((bucket) => (
                  <PrivateFileStorageBucketRow
                    key={bucket.id}
                    bucket={bucket}
                  />
                ))}
                {privateFileStoragePolicy.routes.map((route) => (
                  <PrivateFileStorageRouteRow key={route.id} route={route} />
                ))}
              </div>
            </ContractPanel>
          </div>
          <ContractPanel title="文件类型策略" className="mt-4">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {privateFileStoragePolicy.file_classes.map((fileClass) => (
                <PrivateFileStorageClassRow
                  key={fileClass.id}
                  fileClass={fileClass}
                />
              ))}
            </div>
          </ContractPanel>
          <ContractPanel title="文件签名 API 防护" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                `/api/files/presign` 的专用关闭响应。它展示未来“仅元数据”请求、
                不返回 URL 的响应结构、fixture 检查和启用门槛；路由当前仍拒绝读取请求体、
                创建签名 URL、上传文件或暴露公开链接。
              </p>
              <button
                type="button"
                onClick={handleExportFilePresignApiGuard}
                disabled={busyContractAction === "file-presign-api-guard"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "file-presign-api-guard"
                  ? "导出中..."
                  : "导出文件签名防护"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <FilePresignSummaryCard
                label="HTTP"
                value={filePresignApiGuard.disabled_response_contract.http_status}
                detail="关闭状态"
                status="rejected"
              />
              <FilePresignSummaryCard
                label="请求体"
                value={filePresignApiGuard.can_read_request_body_now ? "是" : "否"}
                detail="不读取正文"
                status="rejected"
              />
              <FilePresignSummaryCard
                label="签名 URL"
                value={filePresignApiGuard.can_create_signed_urls_now ? "是" : "否"}
                detail="不创建 URL"
                status="rejected"
              />
              <FilePresignSummaryCard
                label="允许字段"
                value={filePresignApiGuard.request_schema.allowed_fields.length}
                detail="未来元数据"
                status="accepted"
              />
              <FilePresignSummaryCard
                label="禁止字段"
                value={filePresignApiGuard.request_schema.forbidden_fields.length}
                detail="载荷已阻止"
                status="rejected"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
              <ContractPanel title="Request schema">
                <div className="space-y-2">
                  {filePresignApiGuard.request_schema.allowed_fields
                    .slice(0, 6)
                    .map((field) => (
                      <FilePresignFieldRow key={field.field} field={field} />
                    ))}
                  {filePresignApiGuard.request_schema.forbidden_fields
                    .slice(0, 6)
                    .map((field) => (
                      <FilePresignFieldRow key={field.field} field={field} />
                    ))}
                </div>
              </ContractPanel>
              <ContractPanel title="Fixture checks">
                <div className="space-y-2">
                  {filePresignApiGuard.local_validator_report.fixtures.map(
                    (fixture) => (
                      <FilePresignFixtureRow
                        key={fixture.id}
                        fixture={fixture}
                      />
                    )
                  )}
                </div>
              </ContractPanel>
            </div>
            <ContractPanel title="启用门槛" className="mt-4">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {filePresignApiGuard.enablement_gates.map((gate) => (
                  <FilePresignGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </ContractPanel>
          </ContractPanel>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                私有 Beta 上线门槛
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Web 上线路径的本地准备度报告。它汇总本地证据、人工确认点和阻塞门槛；
                不创建账号、不连接云服务、不上传笔记，也不同步文件。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportWebBetaReadiness}
              disabled={busyContractAction === "readiness"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "readiness"
                ? "导出中..."
                : "导出准备度"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <BetaSummaryCard
              label="上线结论"
              value="未就绪"
              detail="云端和冲突门槛仍阻塞 Beta。"
              tone="blocked"
            />
            <BetaSummaryCard
              label="就绪"
              value={webBetaReadinessReport.summary.ready}
              detail="本地兜底和数据可见性。"
              tone="ready"
            />
            <BetaSummaryCard
              label="部分"
              value={webBetaReadinessReport.summary.partial}
              detail="本地已起草，远端未强制。"
              tone="partial"
            />
            <BetaSummaryCard
              label="确认"
              value={webBetaReadinessReport.summary.manual_confirmation}
              detail="需要明确用户门槛。"
              tone="manual-confirmation"
            />
            <BetaSummaryCard
              label="阻塞"
              value={webBetaReadinessReport.summary.blocked}
              detail="Web Beta 前必须实现。"
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
                审计轨迹政策
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                面向未来服务端审计日志的本地政策。它定义哪些认证、同步、恢复、AI、
                文件、导出、权限和管理动作必须记录，同时把页面正文、prompt 文本、
                文件字节和密钥值排除在审计行之外。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportAuditTrailPolicy}
              disabled={busyContractAction === "audit-policy"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "audit-policy"
                ? "导出中..."
                : "导出审计政策"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <AuditSummaryCard
              label="事件"
              value={auditTrailPolicy.summary.events}
              detail="已覆盖动作类型"
              tone="planned"
            />
            <AuditSummaryCard
              label="阻塞"
              value={auditTrailPolicy.summary.blocked}
              detail="需要服务端认证/日志"
              tone="blocked"
            />
            <AuditSummaryCard
              label="确认"
              value={auditTrailPolicy.summary.manual_confirmation}
              detail="留存和脱敏"
              tone="manual-confirmation"
            />
            <AuditSummaryCard
              label="端点"
              value="/api/audit/events"
              detail="已关闭的本地桩接口"
              tone="blocked"
            />
            <AuditSummaryCard
              label="禁止字段"
              value={
                auditTrailPolicy.fields.filter(
                  (field) => field.status === "forbidden"
                ).length
              }
              detail="敏感字段类型"
              tone="manual-confirmation"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <ContractPanel title="审计事件覆盖">
              <div className="space-y-2">
                {auditTrailPolicy.events.map((event) => (
                  <AuditEventRow key={event.id} event={event} />
                ))}
              </div>
            </ContractPanel>
            <ContractPanel title="审计启用门槛">
              <div className="space-y-2">
                {auditTrailPolicy.gates.map((gate) => (
                  <AuditGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </ContractPanel>
          </div>
          <ContractPanel title="审计事件信封" className="mt-4">
            <div className="flex flex-col gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl">
                未来审计写入前的本地脱敏合同。它定义“仅元数据”的事件结构，
                先于 `/api/audit/events` 读取请求体或写入服务端审计行。页面正文、
                数据库值、评论正文、文件字节、prompts、模型原始输出、tokens、cookies、
                签名 URL 和环境值仍然禁止。
              </p>
              <button
                type="button"
                onClick={handleExportAuditEventEnvelope}
                disabled={busyContractAction === "audit-envelope"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "audit-envelope"
                  ? "导出中..."
                  : "导出审计信封"}
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
                <IdentityMetric
                label="允许字段"
                value={`${auditEventEnvelopeContract.summary.allowed_fields}`}
                detail="仅元数据"
              />
              <IdentityMetric
                label="禁止字段"
                value={`${auditEventEnvelopeContract.summary.forbidden_fields}`}
                detail="载荷已阻止"
              />
              <IdentityMetric
                label="脱敏检查"
                value={`${auditEventEnvelopeContract.summary.redaction_checks}`}
                detail="写入前"
              />
              <IdentityMetric
                label="阻塞"
                value={`${auditEventEnvelopeContract.summary.blocked}`}
                detail="端点已关闭"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
              <ContractPanel title="信封模板">
                <div className="space-y-2">
                  {auditEventEnvelopeContract.templates.map((template) => (
                    <AuditEnvelopeTemplateRow
                      key={template.id}
                      template={template}
                    />
                  ))}
                </div>
              </ContractPanel>
              <ContractPanel title="脱敏检查">
                <div className="space-y-2">
                  {auditEventEnvelopeContract.redaction_checks.map((check) => (
                    <AuditEnvelopeRedactionCheckRow
                      key={check.id}
                      check={check}
                    />
                  ))}
                </div>
              </ContractPanel>
            </div>
            <ContractPanel title="信封门槛" className="mt-4">
              <div className="grid gap-2 md:grid-cols-2">
                {auditEventEnvelopeContract.gates.map((gate) => (
                  <AuditEnvelopeGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </ContractPanel>
          </ContractPanel>
          <ContractPanel title="审计事件 API 防护" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                `/api/audit/events` 的专用关闭响应。它展示未来“仅元数据”审计请求、
                仅收据响应结构、本地 fixture 检查和必需门槛；路由当前仍拒绝读取请求体、
                接收事件载荷、写审计行或暴露敏感载荷。
              </p>
              <button
                type="button"
                onClick={handleExportAuditEventsApiGuard}
                disabled={busyContractAction === "audit-events-api-guard"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "audit-events-api-guard"
                  ? "导出中..."
                  : "导出审计 API 防护"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <AuditEventsApiSummaryCard
                label="HTTP"
                value={auditEventsApiGuard.disabled_response_contract.http_status}
                detail="关闭状态"
                status="rejected"
              />
              <AuditEventsApiSummaryCard
                label="请求体"
                value={auditEventsApiGuard.can_read_request_body_now ? "是" : "否"}
                detail="不读取正文"
                status="rejected"
              />
              <AuditEventsApiSummaryCard
                label="审计写入"
                value={
                  auditEventsApiGuard.can_write_audit_events_table_now
                    ? "是"
                    : "否"
                }
                detail="不写服务端"
                status="rejected"
              />
              <AuditEventsApiSummaryCard
                label="允许字段"
                value={auditEventsApiGuard.request_schema.allowed_fields.length}
                detail="未来元数据"
                status="accepted"
              />
              <AuditEventsApiSummaryCard
                label="禁止字段"
                value={auditEventsApiGuard.request_schema.forbidden_fields.length}
                detail="载荷已阻止"
                status="rejected"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
              <ContractPanel title="请求结构">
                <div className="space-y-2">
                  {auditEventsApiGuard.request_schema.allowed_fields
                    .slice(0, 6)
                    .map((field) => (
                      <AuditEventsApiFieldRow
                        key={field.field}
                        field={field}
                      />
                    ))}
                  {auditEventsApiGuard.request_schema.forbidden_fields
                    .slice(0, 6)
                    .map((field) => (
                      <AuditEventsApiFieldRow
                        key={field.field}
                        field={field}
                      />
                    ))}
                </div>
              </ContractPanel>
              <ContractPanel title="Fixture 检查">
                <div className="space-y-2">
                  {auditEventsApiGuard.local_validator_report.fixtures.map(
                    (fixture) => (
                      <AuditEventsApiFixtureRow
                        key={fixture.id}
                        fixture={fixture}
                      />
                    )
                  )}
                </div>
              </ContractPanel>
            </div>
            <ContractPanel title="启用门槛" className="mt-4">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {auditEventsApiGuard.enablement_gates.map((gate) => (
                  <AuditEventsApiGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </ContractPanel>
          </ContractPanel>
          <ContractPanel title="审计载荷政策" className="mt-4">
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
                本地备份动作
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                这些下载都在浏览器里生成，不上传工作区数据，也不连接服务器。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ExportButton
                label="备份 JSON"
                busy={busyAction === "backup"}
                onClick={() => void runExport("backup")}
              />
              <ExportButton
                label="工作区 ZIP"
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
                恢复干跑预览
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                选择一个本地 ZhiNotes 备份 JSON，先验证格式并预览恢复范围。这个步骤只在本地读取文件，不会把任何内容写回工作区。
              </p>
            </div>
            <label className="w-fit cursor-pointer rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
              选择备份 JSON
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
                恢复回滚计划
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                备份恢复的干跑回滚计划。任何恢复写入出现之前，都必须先有新的回滚备份、范围审阅、待同步审阅和第二次确认。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportRestoreRollbackPlan}
              disabled={busyQueueAction === "rollback-plan"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyQueueAction === "rollback-plan"
                ? "导出中..."
                : "导出回滚计划"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <RollbackSummaryCard
              label="计划"
              value={restoreRollbackPlan.plan_status}
              detail="恢复写入已禁用"
              tone="medium"
            />
            <RollbackSummaryCard
              label="就绪"
              value={restoreRollbackPlan.summary.ready}
              detail="已满足步骤"
              tone="low"
            />
            <RollbackSummaryCard
              label="待确认"
              value={restoreRollbackPlan.summary.manual_confirmation}
              detail="需要明确用户 gate"
              tone="medium"
            />
            <RollbackSummaryCard
              label="阻塞"
              value={restoreRollbackPlan.summary.blocked}
              detail="写入仍禁用"
              tone="high"
            />
            <RollbackSummaryCard
              label="边界"
              value="干跑"
              detail="不写入、不删除、不上传"
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
                恢复写入合同
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                高风险恢复应用步骤的本地合同。任何恢复写入出现之前，必须先覆盖备份验证、回滚快照、范围审阅、待同步清理、权限检查、审计事件、第二次确认、禁用的写入端点和失败恢复证明。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportRestoreWritebackContract}
              disabled={busyQueueAction === "restore-writeback"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyQueueAction === "restore-writeback"
                ? "导出中..."
                : "导出写入合同"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <RestoreWritebackSummaryCard
              label="阶段"
              value={restoreWritebackContract.summary.stages}
              detail="写入流程"
              status="planned"
            />
            <RestoreWritebackSummaryCard
              label="待确认"
              value={restoreWritebackContract.summary.manual_confirmation}
              detail="人工 gate"
              status="manual-confirmation"
            />
            <RestoreWritebackSummaryCard
              label="阻塞"
              value={restoreWritebackContract.summary.blocked}
              detail="应用未启用"
              status="blocked"
            />
            <RestoreWritebackSummaryCard
              label="端点"
              value="/api/backup/restore-apply"
              detail="禁用的本地 stub"
              status="blocked"
            />
            <RestoreWritebackSummaryCard
              label="边界"
              value="不写入"
              detail="不恢复、不删除"
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
                  ? "导出中..."
                  : "导出恢复收据"}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">
              即使短语匹配，当前仍不会恢复、覆盖或删除任何数据；/api/backup/restore-apply 仍关闭。收据只记录本地确认状态和范围摘要。
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <IdentityMetric
                label="短语匹配"
                value={
                  restoreConfirmationReceipt.typed_phrase_matches
                    ? "是"
                    : "否"
                }
                detail={restoreConfirmationReceipt.status}
              />
              <IdentityMetric
                label="收据边界"
                value="仅本地"
                detail="不恢复、不写入、不删除、不上传"
              />
              <IdentityMetric
                label="目标"
                value={restoreConfirmationReceipt.destination_summary}
                detail="当前浏览器工作区"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                准备度清单
              </h2>
              <span className="text-xs text-zinc-400">
                本地优先，云端待完成
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
              隐私边界
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
                Web Beta 合同
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                私有 Beta 上线边界的本地草案：账号登录、云端表、同步 API、冲突处理、
                部署门槛和隐私确认。导出它不会创建账号、连接云服务、上传文件或分享笔记。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportWebBetaContract}
              disabled={busyContractAction === "contract"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "contract"
                ? "导出中..."
                : "导出合同"}
            </button>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <ContractPanel title="账号和隐私门槛">
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

            <ContractPanel title="云结构合同">
              <div className="grid gap-2 md:grid-cols-2">
                {CLOUD_SCHEMA_TABLES.map((table) => (
                  <ContractTextRow
                    key={table.tableName}
                    title={table.tableName}
                    status={table.status}
                    detail={table.cloudPurpose}
                    meta={`本地来源：${table.localSource}。${table.privacyBoundary}`}
                  />
                ))}
              </div>
            </ContractPanel>
          </div>

          <ContractPanel title="云结构迁移计划" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把云结构合同变成版本化迁移的本地计划。在连接任何云数据库之前，
                它会保留迁移顺序、回滚要求、隐私边界和本地证据。
              </p>
              <button
                type="button"
                onClick={handleExportCloudSchemaMigrationPlan}
                disabled={busyContractAction === "cloud-schema-plan"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "cloud-schema-plan"
                  ? "导出中..."
                  : "导出迁移计划"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <MigrationSummaryCard
                label="表"
                value={cloudSchemaMigrationPlan.summary.contracted_tables}
                detail="已定义云端表"
                tone="medium"
              />
              <MigrationSummaryCard
                label="必需"
                value={cloudSchemaMigrationPlan.summary.required_tables}
                detail="Beta 同步前需要"
                tone="high"
              />
              <MigrationSummaryCard
                label="高风险"
                value={cloudSchemaMigrationPlan.summary.high_sensitivity_tables}
                detail="内容或文件敏感"
                tone="high"
              />
              <MigrationSummaryCard
                label="阻塞"
                value={cloudSchemaMigrationPlan.summary.blocked_steps}
                detail="需要云端决策"
                tone="high"
              />
              <MigrationSummaryCard
                label="边界"
                value="本地"
                detail="不连接数据库"
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

          <ContractPanel title="云迁移 SQL 草案" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                已定义云结构的本地 Postgres DDL 草案。它生成可复核的 SQL up/down 语句，
                但不连接数据库、不应用 SQL、不创建迁移、不写服务端数据，也不上传工作区内容。
              </p>
              <button
                type="button"
                onClick={handleExportCloudMigrationSqlDraft}
                disabled={busyContractAction === "migration-sql"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "migration-sql"
                  ? "导出中..."
                  : "导出 SQL 草案"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <MigrationSqlSummaryCard
                label="语句"
                value={cloudMigrationSqlDraft.summary.statements}
                detail="DDL 草案"
                tone="drafted"
              />
              <MigrationSqlSummaryCard
                label="必需"
                value={cloudMigrationSqlDraft.summary.required_tables}
                detail="Beta 同步前"
                tone="manual-confirmation"
              />
              <MigrationSqlSummaryCard
                label="阻塞"
                value={cloudMigrationSqlDraft.summary.blocked}
                detail="应用门槛"
                tone="blocked"
              />
              <MigrationSqlSummaryCard
                label="端点"
                value="/api/cloud/migrations/apply"
                detail="已关闭的本地桩接口"
                tone="blocked"
              />
              <MigrationSqlSummaryCard
                label="边界"
                value="不应用"
                detail="不连接数据库"
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

          <ContractPanel title="环境预检" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Web Beta 环境设置的本地服务端检查。它只返回预期变量是否存在或缺失；
                永远不返回密钥值、tokens、连接字符串或存储凭证。
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
                  ? "导出中..."
                  : "导出预检"}
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
                    label="必需"
                    value={environmentPreflight.summary.required}
                    detail="必需环境设置"
                    tone="missing"
                  />
                  <PreflightSummaryCard
                    label="已存在"
                    value={environmentPreflight.summary.present_required}
                    detail="已找到必需设置"
                    tone="present"
                  />
                  <PreflightSummaryCard
                    label="缺失"
                    value={environmentPreflight.summary.missing_required}
                    detail="Beta 前必需"
                    tone={
                      environmentPreflight.summary.missing_required > 0
                        ? "missing"
                        : "present"
                    }
                  />
                  <PreflightSummaryCard
                    label="可选"
                    value={environmentPreflight.summary.optional}
                    detail="跟踪可选设置"
                    tone="optional-missing"
                  />
                  <PreflightSummaryCard
                    label="边界"
                    value="不含密钥"
                    detail="只检查是否存在"
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
                环境预检尚未加载。
              </p>
            )}
          </ContractPanel>

          <ContractPanel
            id="web-beta-deployment-target"
            title="部署目标"
            className="mt-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                首个 Web Alpha 的本地部署目标。当前建议保持 Vercel 作为 Next.js 应用宿主、
                Supabase 作为云数据平面、Cloudflare 作为 DNS/CDN/WAF；未来再单独复核
                Worker runtime。
              </p>
              <button
                type="button"
                onClick={handleExportWebBetaDeploymentTarget}
                disabled={busyContractAction === "deployment-target"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "deployment-target"
                  ? "导出中..."
                  : "导出部署目标"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <DeploymentTargetSummaryCard
                label="应用宿主"
                value={webBetaDeploymentTarget.selected_strategy.first_web_alpha}
                detail="首个 Web Alpha"
                status="planned"
              />
              <DeploymentTargetSummaryCard
                label="后端"
                value={webBetaDeploymentTarget.selected_strategy.cloud_backend}
                detail="认证、Postgres、存储"
                status="planned"
              />
              <DeploymentTargetSummaryCard
                label="边缘层"
                value={webBetaDeploymentTarget.selected_strategy.edge_layer}
                detail="DNS, CDN, WAF"
                status="manual-confirmation"
              />
              <DeploymentTargetSummaryCard
                label="阻塞"
                value={webBetaDeploymentTarget.summary.blocked}
                detail="Beta 前必须清除"
                status="blocked"
              />
              <DeploymentTargetSummaryCard
                label="边界"
                value="不部署"
                detail="仅导出合同"
                status="local-draft"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-2">
                {webBetaDeploymentTarget.providers.map((provider) => (
                  <DeploymentProviderRow
                    key={provider.id}
                    provider={provider}
                  />
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {webBetaDeploymentTarget.tracks.map((track) => (
                  <DeploymentTrackRow key={track.id} track={track} />
                ))}
              </div>
            </div>
          </ContractPanel>

          <ContractPanel title="Web Beta 上线清单" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                私有 Beta 的本地上线清单。它把产品、认证、云结构、文件存储、同步回放、
                冲突复核、恢复回滚、发送内容确认、部署门槛和可观测性合并到一个预检视图。
              </p>
              <button
                type="button"
                onClick={handleExportWebBetaLaunchChecklist}
                disabled={busyContractAction === "launch-checklist"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "launch-checklist"
                  ? "导出中..."
                  : "导出上线清单"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <LaunchSummaryCard
                label="工作流"
                value={webBetaLaunchChecklist.summary.tracks}
                detail="上线工作流"
                tone="partial"
              />
              <LaunchSummaryCard
                label="部分"
                value={webBetaLaunchChecklist.summary.partial}
                detail="本地脚手架就绪"
                tone="partial"
              />
              <LaunchSummaryCard
                label="阻塞"
                value={webBetaLaunchChecklist.summary.blocked}
                detail="需要云端工作"
                tone="blocked"
              />
              <LaunchSummaryCard
                label="路由"
                value={webBetaLaunchChecklist.summary.local_routes}
                detail="待验证本地页面"
                tone="ready"
              />
              <LaunchSummaryCard
                label="边界"
                value="不部署"
                detail="仅本地清单"
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

          <ContractPanel title="路由和 API 预检" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                工作区页面、模块页面、已关闭 API 桩、Cloud Alpha 元数据路由和环境预检端点的
                本地路由合同检查。它不发送请求、不连接云服务、不上传数据，也不读取私人内容。
              </p>
              <button
                type="button"
                onClick={handleExportWebBetaRoutePreflight}
                disabled={busyContractAction === "route-preflight"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "route-preflight"
                  ? "导出中..."
                  : "导出路由预检"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <RoutePreflightSummaryCard
                label="预期"
                value={webBetaRoutePreflight.summary.expected_routes}
                detail="路由合同"
                status="covered"
              />
              <RoutePreflightSummaryCard
                label="已覆盖"
                value={webBetaRoutePreflight.summary.covered}
                detail="已进入上线清单"
                status="covered"
              />
              <RoutePreflightSummaryCard
                label="错配"
                value={webBetaRoutePreflight.summary.status_mismatch}
                detail="状态不同"
                status={
                  webBetaRoutePreflight.summary.status_mismatch > 0
                    ? "status-mismatch"
                    : "covered"
                }
              />
              <RoutePreflightSummaryCard
                label="缺失"
                value={webBetaRoutePreflight.summary.missing}
                detail="未列入"
                status={
                  webBetaRoutePreflight.summary.missing > 0
                    ? "missing"
                    : "covered"
                }
              />
              <RoutePreflightSummaryCard
                label="Cloud Alpha"
                value={webBetaRoutePreflight.summary.cloud_alpha_gated}
                detail="仅元数据"
                status="covered"
              />
            </div>
            <div className="mt-4 grid gap-2 xl:grid-cols-2">
              {webBetaRoutePreflight.checks.map((check) => (
                <RoutePreflightRow key={check.id} check={check} />
              ))}
            </div>
          </ContractPanel>

          <ContractPanel title="冒烟测试计划" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                未来预览部署的本地冒烟测试计划。它定义部署前检查、预览路由检查、
                认证 callback 检查、默认关闭的云端开关、私有存储边界、回滚、可观测性
                和窄屏布局复核；不会运行测试或发送网络请求。
              </p>
              <button
                type="button"
                onClick={handleExportWebBetaSmokeTestPlan}
                disabled={busyContractAction === "smoke-test-plan"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "smoke-test-plan"
                  ? "导出中..."
                  : "导出冒烟测试计划"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <SmokeTestSummaryCard
                label="案例"
                value={webBetaSmokeTestPlan.summary.cases}
                detail="预览检查"
                status="ready-to-run"
              />
              <SmokeTestSummaryCard
                label="自动"
                value={webBetaSmokeTestPlan.summary.automated}
                detail="命令可检查"
                status="ready-to-run"
              />
              <SmokeTestSummaryCard
                label="手动"
                value={webBetaSmokeTestPlan.summary.manual}
                detail="用户复核"
                status="manual-confirmation"
              />
              <SmokeTestSummaryCard
                label="阻塞"
                value={webBetaSmokeTestPlan.summary.blocked}
                detail="云端/设置缺口"
                status="blocked"
              />
              <SmokeTestSummaryCard
                label="边界"
                value="不运行"
                detail="仅导出计划"
                status="manual-confirmation"
              />
            </div>
            <div className="mt-4 grid gap-2 xl:grid-cols-2">
              {webBetaSmokeTestPlan.cases.map((testCase) => (
                <SmokeTestCaseRow key={testCase.id} testCase={testCase} />
              ))}
            </div>
          </ContractPanel>

          <ContractPanel title="Web Alpha 交接包" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                未来私有 Web Alpha 复核用的本地交接包。它把上线合同、阶段门禁、
                路由预检、冒烟测试、后续动作、用户决策和命令检查汇总到一个导出中；
                不部署、不连接云服务、不上传工作区数据，也不暴露密钥。
              </p>
              <button
                type="button"
                onClick={handleExportWebAlphaHandoffBundle}
                disabled={busyContractAction === "web-alpha-handoff"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "web-alpha-handoff"
                  ? "导出中..."
                  : "导出交接包"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <HandoffSummaryCard
                label="来源"
                value={webAlphaHandoffBundle.summary.source_reports}
                detail="已包含报告"
                status="partial"
              />
              <HandoffSummaryCard
                label="命令"
                value={webAlphaHandoffBundle.summary.commands}
                detail="必须通过"
                status="ready"
              />
              <HandoffSummaryCard
                label="阻塞"
                value={webAlphaHandoffBundle.summary.blocked}
                detail="不能上线"
                status={
                  webAlphaHandoffBundle.summary.blocked > 0
                    ? "blocked"
                    : "ready"
                }
              />
              <HandoffSummaryCard
                label="P0"
                value={webAlphaHandoffBundle.summary.p0_actions}
                detail="构建阻塞"
                status={
                  webAlphaHandoffBundle.summary.p0_actions > 0
                    ? "blocked"
                    : "ready"
                }
              />
              <HandoffSummaryCard
                label="云同步"
                value={
                  webAlphaHandoffBundle.cloud_sync_can_start_now
                    ? "就绪"
                    : "否"
                }
                detail="需要单独批准"
                status="blocked"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
              <div className="space-y-2">
                {webAlphaHandoffBundle.handoff_items.map((item) => (
                  <HandoffItemRow key={item.id} item={item} />
                ))}
              </div>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <HandoffCommandRow
                    command={webAlphaHandoffBundle.verification_receipt_runner}
                  />
                  {webAlphaHandoffBundle.command_bundle.map((command) => (
                    <HandoffCommandRow key={command.id} command={command} />
                  ))}
                </div>
                <div className="grid gap-2">
                  {webAlphaHandoffBundle.owner_decisions.map((decision) => (
                    <HandoffDecisionRow
                      key={decision.id}
                      decision={decision}
                    />
                  ))}
                </div>
              </div>
            </div>
          </ContractPanel>

          <ContractPanel
            title="Web Alpha 上线决策收据"
            className="mt-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                判断 ZhiNotes 是否能从本地开发进入可分享 Web Alpha 预览的本地 go/no-go 收据。
                它汇总阻塞项和用户决策；不部署、不连接云服务、不上传工作区数据、
                不启用同步，也不读取私人内容。
              </p>
              <button
                type="button"
                onClick={handleExportWebAlphaLaunchDecisionReceipt}
                disabled={busyContractAction === "web-alpha-launch-decision"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "web-alpha-launch-decision"
                  ? "导出中..."
                  : "导出上线决策"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <LaunchDecisionSummaryCard
                label="结论"
                value={webAlphaLaunchDecisionReceipt.release_verdict}
                detail="暂不开放预览"
                status="no-go-preview"
              />
              <LaunchDecisionSummaryCard
                label="本地工作"
                value={
                  webAlphaLaunchDecisionReceipt.local_app_can_continue_now
                    ? "是"
                    : "否"
                }
                detail="继续构建"
                status="go-local-only"
              />
              <LaunchDecisionSummaryCard
                label="预览"
                value={
                  webAlphaLaunchDecisionReceipt.web_alpha_preview_can_be_shared_now
                    ? "是"
                    : "否"
                }
                detail="用户门槛"
                status="no-go-preview"
              />
              <LaunchDecisionSummaryCard
                label="云同步"
                value={
                  webAlphaLaunchDecisionReceipt.cloud_sync_can_start_now
                    ? "是"
                    : "否"
                }
                detail="仍然关闭"
                status="no-go-cloud"
              />
              <LaunchDecisionSummaryCard
                label="P0"
                value={webAlphaLaunchDecisionReceipt.summary.p0_actions}
                detail="预览前"
                status="no-go-preview"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-2">
                {webAlphaLaunchDecisionReceipt.decision_questions.map(
                  (question) => (
                    <LaunchDecisionQuestionRow
                      key={question.id}
                      question={question}
                    />
                  )
                )}
              </div>
              <div className="space-y-2">
                {webAlphaLaunchDecisionReceipt.top_blockers.map((blocker) => (
                  <LaunchDecisionBlockerRow
                    key={`${blocker.source}-${blocker.id}`}
                    blocker={blocker}
                  />
                ))}
              </div>
            </div>
          </ContractPanel>

          <ContractPanel
            id="web-beta-owner-review"
            title="Web Beta 用户复核包"
            className="mt-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                私有 Web Beta 决策的本地用户复核演练。它把阶段门禁、后续动作、
                冒烟测试和环境存在情况转成复核问题与证据；不部署、不连接云服务、
                不上传工作区数据、不启用同步，也不读取私人内容。
              </p>
              <button
                type="button"
                onClick={handleExportWebBetaOwnerReviewPacket}
                disabled={busyContractAction === "web-beta-owner-review"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "web-beta-owner-review"
                  ? "导出中..."
                  : "导出用户复核"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-6">
              <OwnerReviewSummaryCard
                label="结论"
                value={webBetaOwnerReviewPacket.launch_verdict}
                detail="不启动 Beta"
                status="blocked"
              />
              <OwnerReviewSummaryCard
                label="本地工作"
                value={
                  webBetaOwnerReviewPacket.local_app_can_continue_now
                    ? "是"
                    : "否"
                }
                detail="继续构建"
                status="local-only"
              />
              <OwnerReviewSummaryCard
                label="P0"
                value={webBetaOwnerReviewPacket.summary.p0_blockers}
                detail="用户阻塞项"
                status="blocked"
              />
              <OwnerReviewSummaryCard
                label="决策"
                value={webBetaOwnerReviewPacket.summary.owner_decisions}
                detail="用户选择"
                status="owner-review"
              />
              <OwnerReviewSummaryCard
                label="本地优先"
                value={webBetaOwnerReviewPacket.summary.local_first_ready}
                detail="可安全开始"
                status="local-only"
              />
              <OwnerReviewSummaryCard
                label="缺失环境"
                value={
                  webBetaOwnerReviewPacket.summary
                    .missing_required_environment ?? "未知"
                }
                detail="仅检查是否存在"
                status={
                  webBetaOwnerReviewPacket.summary
                    .missing_required_environment === 0
                    ? "owner-review"
                    : "blocked"
                }
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-2">
                {webBetaOwnerReviewPacket.review_questions.map((question) => (
                  <OwnerReviewQuestionRow
                    key={question.id}
                    question={question}
                  />
                ))}
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  {webBetaOwnerReviewPacket.p0_blockers.map((blocker) => (
                    <OwnerReviewBlockerRow
                      key={blocker.id}
                      blocker={blocker}
                    />
                  ))}
                </div>
                <div className="grid gap-2">
                  {webBetaOwnerReviewPacket.local_first_work.map((item) => (
                    <OwnerReviewLocalWorkRow key={item.id} item={item} />
                  ))}
                </div>
              </div>
            </div>
          </ContractPanel>

          <ContractPanel title="Web Beta 后续动作" className="mt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把准备度和上线阻塞项转成有顺序构建工作的本地行动计划。
                它不部署、不连接云服务、不创建账号、不上传工作区数据，也不读取私人内容。
              </p>
              <button
                type="button"
                onClick={handleExportWebBetaNextActionPlan}
                disabled={busyContractAction === "next-actions"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "next-actions"
                  ? "导出中..."
                  : "导出后续动作"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-6">
              <NextActionSummaryCard
                label="动作"
                value={webBetaNextActionPlan.summary.actions}
                detail="有序工作项"
                status="ready-to-build"
              />
              <NextActionSummaryCard
                label="P0"
                value={webBetaNextActionPlan.summary.p0}
                detail="必须先完成"
                priority="p0"
              />
              <NextActionSummaryCard
                label="就绪"
                value={webBetaNextActionPlan.summary.ready_to_build}
                detail="可本地开始"
                status="ready-to-build"
              />
              <NextActionSummaryCard
                label="本地优先"
                value={webBetaNextActionPlan.summary.local_first}
                detail="不需要云写入"
                executionPath="local-first"
              />
              <NextActionSummaryCard
                label="决策"
                value={webBetaNextActionPlan.summary.needs_owner_decision}
                detail="需要用户选择"
                status="needs-owner-decision"
              />
              <NextActionSummaryCard
                label="缺失环境"
                value={webBetaNextActionPlan.summary.missing_environment_required}
                detail="必需设置"
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
            <ContractPanel title="Web Beta API 合同">
              <div className="space-y-2">
                {SYNC_API_CONTRACTS.map((api) => (
                  <ContractApiRow key={api.id} api={api} />
                ))}
              </div>
              <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  本地禁用 API 桩
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  这些路由在本地存在，但只返回禁用响应；不会读取请求体、创建会话、
                  存储服务端数据、恢复备份、上传文件或同步笔记。
                </p>
                <div className="mt-3 space-y-2">
                  {WEB_BETA_API_STUBS.map((stub) => (
                    <ApiStubRow key={stub.id} stub={stub} />
                  ))}
                </div>
              </div>
            </ContractPanel>

            <ContractPanel title="冲突政策">
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

          <ContractPanel title="部署门槛" className="mt-4">
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
                权限决策预览
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Owner、Researcher、Viewer 角色决策的本地评估器。它预览资源动作的允许、
                拒绝和确认结果；但不创建用户、不授予访问、不撤销访问、不上传数据，
                也不执行服务端权限。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPermissionDecisionReport}
              disabled={busyContractAction === "permission-decisions"}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busyContractAction === "permission-decisions"
                ? "导出中..."
                : "导出权限决策"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <PermissionDecisionSummaryCard
              label="矩阵"
              value={permissionDecisionReport.summary.matrix_decisions}
              detail="角色/资源/动作检查"
              status="local-allowed"
            />
            <PermissionDecisionSummaryCard
              label="场景"
              value={permissionDecisionReport.summary.high_risk_scenarios}
              detail="高风险样本"
              status="needs-confirmation"
            />
            <PermissionDecisionSummaryCard
              label="确认"
              value={permissionDecisionReport.summary.needs_confirmation}
              detail="允许但需门槛"
              status="needs-confirmation"
            />
            <PermissionDecisionSummaryCard
              label="拒绝"
              value={permissionDecisionReport.summary.local_denied}
              detail="被本地角色阻止"
              status="local-denied"
            />
            <PermissionDecisionSummaryCard
              label="端点"
              value="/api/permissions/check"
              detail="已关闭的本地桩接口"
              status="server-blocked"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <ContractPanel title="高风险决策">
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
            <ContractPanel title="权限启用门槛">
              <div className="space-y-2">
                {permissionDecisionReport.gates.map((gate) => (
                  <PermissionDecisionGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </ContractPanel>
          </div>
          <ContractPanel title="权限检查信封" className="mt-4">
            <div className="flex flex-col gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-3xl">
                未来服务端权限检查的本地合同。它定义“仅元数据”的请求和响应字段，
                先于 `/api/permissions/check` 读取请求体或执行角色权限。页面正文、
                数据库值、评论、文件、prompts、tokens、cookies、签名 URL 和环境值仍禁止。
              </p>
              <button
                type="button"
                onClick={handleExportPermissionCheckEnvelope}
                disabled={busyContractAction === "permission-check-envelope"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "permission-check-envelope"
                  ? "导出中..."
                  : "导出权限信封"}
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              <IdentityMetric
                label="请求字段"
                value={`${permissionCheckEnvelopeContract.summary.request_allowed_fields}`}
                detail="仅元数据"
              />
              <IdentityMetric
                label="响应字段"
                value={`${permissionCheckEnvelopeContract.summary.response_allowed_fields}`}
                detail="仅决策"
              />
              <IdentityMetric
                label="禁止字段"
                value={`${permissionCheckEnvelopeContract.summary.forbidden_fields}`}
                detail="载荷已阻止"
              />
              <IdentityMetric
                label="阻塞"
                value={`${permissionCheckEnvelopeContract.summary.blocked}`}
                detail="端点已关闭"
              />
              <IdentityMetric
                label="校验案例"
                value={`${permissionCheckValidatorReport.summary.passed}/${permissionCheckValidatorReport.summary.fixtures}`}
                detail="本地 fixtures"
              />
              <IdentityMetric
                label="服务端案例"
                value={`${permissionServerTestMatrix.summary.cases}`}
                detail="未来测试"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
              <ContractPanel title="权限检查场景">
                <div className="space-y-2">
                  {permissionCheckEnvelopeContract.scenarios.map((scenario) => (
                    <PermissionCheckScenarioRow
                      key={scenario.id}
                      scenario={scenario}
                    />
                  ))}
                </div>
              </ContractPanel>
              <ContractPanel title="权限检查门槛">
                <div className="space-y-2">
                  {permissionCheckEnvelopeContract.gates.map((gate) => (
                    <PermissionCheckGateRow key={gate.id} gate={gate} />
                  ))}
                </div>
              </ContractPanel>
            </div>
            <ContractPanel title="权限请求字段" className="mt-4">
              <div className="grid gap-2 md:grid-cols-2">
                {permissionCheckEnvelopeContract.request_fields.map((field) => (
                  <PermissionCheckFieldRow key={field.field} field={field} />
                ))}
              </div>
            </ContractPanel>
            <ContractPanel
              title="权限请求校验器"
              className="mt-4"
            >
              <div className="grid gap-2 md:grid-cols-3">
                <IdentityMetric
                  label="已接受"
                  value={`${permissionCheckValidatorReport.summary.accepted}`}
                  detail="仅元数据"
                />
                <IdentityMetric
                  label="禁止字段"
                  value={`${permissionCheckValidatorReport.summary.rejected_forbidden_payload}`}
                  detail="私人载荷"
                />
                <IdentityMetric
                  label="其他拒绝"
                  value={`${
                    permissionCheckValidatorReport.summary
                      .rejected_unknown_field +
                    permissionCheckValidatorReport.summary
                      .rejected_invalid_shape
                  }`}
                  detail="结构防护"
                />
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {permissionCheckValidatorReport.fixture_results.map(
                  (fixture) => (
                    <PermissionCheckValidatorFixtureRow
                      key={fixture.id}
                      fixture={fixture}
                    />
                  )
                )}
              </div>
            </ContractPanel>
            <ContractPanel title="服务端权限测试矩阵" className="mt-4">
              <div className="grid gap-2 md:grid-cols-4">
                <IdentityMetric
                  label="允许"
                  value={`${
                    permissionServerTestMatrix.summary.allow_read_only +
                    permissionServerTestMatrix.summary.allow_after_confirmation
                  }`}
                  detail="带门槛"
                />
                <IdentityMetric
                  label="拒绝"
                  value={`${permissionServerTestMatrix.summary.denied}`}
                  detail="403 案例"
                />
                <IdentityMetric
                  label="驳回"
                  value={`${permissionServerTestMatrix.summary.rejected_request}`}
                  detail="422 载荷"
                />
                <IdentityMetric
                  label="确认"
                  value={`${permissionServerTestMatrix.summary.manual_confirmation}`}
                  detail="高风险"
                />
              </div>
              <div className="mt-3 grid gap-2 xl:grid-cols-3">
                {permissionServerTestMatrix.cases.map((testCase) => (
                  <PermissionServerMatrixCaseRow
                    key={testCase.id}
                    testCase={testCase}
                  />
                ))}
              </div>
            </ContractPanel>
            <ContractPanel title="服务端权限准备度" className="mt-4">
              <div className="grid gap-2 md:grid-cols-4">
                <IdentityMetric
                  label="结论"
                  value={permissionServerReadinessReport.readiness_verdict}
                  detail="端点已关闭"
                />
                <IdentityMetric
                  label="就绪门槛"
                  value={`${permissionServerReadinessReport.summary.ready}`}
                  detail={`共 ${permissionServerReadinessReport.summary.gates} 个`}
                />
                <IdentityMetric
                  label="阻塞门槛"
                  value={`${permissionServerReadinessReport.summary.blocked}`}
                  detail="Beta 前"
                />
                <IdentityMetric
                  label="确认门槛"
                  value={`${permissionServerReadinessReport.summary.manual_confirmation}`}
                  detail="高风险"
                />
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {permissionServerReadinessReport.gates.map((gate) => (
                  <PermissionServerReadinessGateRow
                    key={gate.id}
                    gate={gate}
                  />
                ))}
              </div>
            </ContractPanel>
          </ContractPanel>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  权限矩阵
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  仅本地草案。它不创建用户、不执行访问控制，也不分享工作区数据。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportPermissionPolicy}
                disabled={busyPermissionAction === "policy"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyPermissionAction === "policy"
                  ? "导出中..."
                  : "导出政策"}
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
                  高风险动作注册表
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  同步、恢复、AI、文件预览、数据库导入、分享和删除流程的本地输入确认注册表。
                  导出它不会启用任何动作。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportHighRiskActionRegistry}
                disabled={busyContractAction === "high-risk-registry"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyContractAction === "high-risk-registry"
                  ? "导出中..."
                  : "导出注册表"}
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <HighRiskRegistrySummaryCard
                label="动作"
                value={highRiskActionRegistry.summary.actions}
                detail="已注册门槛"
              />
              <HighRiskRegistrySummaryCard
                label="收据"
                value={highRiskActionRegistry.summary.local_receipt_available}
                detail="本地收据就绪"
              />
              <HighRiskRegistrySummaryCard
                label="计划中"
                value={highRiskActionRegistry.summary.planned}
                detail="预留门槛"
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
                  同步日志可见性
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  这里只显示本地队列元数据，不导出页面正文或文件内容。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleExportSyncQueueSnapshot()}
                disabled={busyQueueAction === "queue"}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {busyQueueAction === "queue" ? "导出中..." : "导出队列"}
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
                            ? `最近变更 ${formatDate(table.lastChangeAt)}`
                            : "没有时间戳"}
                        </div>
                      </div>
                      <div className="text-right text-zinc-500 dark:text-zinc-400">
                        <div>{table.pending} 待处理</div>
                        <div>{table.total} 总计</div>
                      </div>
                    </div>
                  ))}
                </div>
                {syncEntries.length > 0 && (
                  <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      最近待处理变更
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
                当前还没有同步日志行。新的本地页面、数据库、评论、关系和版本变更会进入这个队列；
                云端 push/pull 仍保持关闭。
              </p>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              文件覆盖
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
                本地文件数据库里还没有上传文件。
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Web Beta 构建顺序
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
  bootstrapProof,
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
  onExportLinkReceipt,
  onClearSession,
}: {
  email: string;
  workspaceName: string;
  session: ZhiNotesCloudSession | null;
  sessionExpired: boolean;
  workspace: CloudAlphaWorkspace | null;
  workspaces: CloudAlphaWorkspace[];
  selectedWorkspaceId: string;
  bootstrapProof: CloudWorkspaceBootstrapProof | null;
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
  onExportLinkReceipt: () => void;
  onClearSession: () => void;
}) {
  const hasUsableSession = Boolean(session && !sessionExpired);
  const workspaceOptions = workspaces.length > 0
    ? workspaces
    : workspace
      ? [workspace]
      : [];
  const linkedWorkspaceId = localIdentity?.cloud_workspace_id ?? "";
  const bootstrapProofMatchesSelection = Boolean(
    bootstrapProof &&
      bootstrapProof.workspace_id === selectedWorkspaceId &&
      bootstrapProof.cloud_user_id === session?.user?.id
  );
  const linkedHasBootstrapProof = Boolean(
    localIdentity?.cloud_status === "linked-alpha" &&
      localIdentity.cloud_bootstrap_checked_at
  );

  return (
    <section className="rounded-lg border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              云端 Alpha
            </h2>
            <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              仅账号 + 工作区
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            连接 Supabase 登录并创建空云工作区。本地页面、文件、数据库、
            备份和同步队列仍保留在这个浏览器里；只有单独启用同步推送后才会外发。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CloudAlphaButton
            label="检查会话"
            busy={busyAction === "session"}
            disabled={!hasUsableSession || Boolean(busyAction)}
            onClick={onSessionCheck}
          />
          <CloudAlphaButton
            label="清除本地会话"
            busy={busyAction === "clear"}
            disabled={!session || Boolean(busyAction)}
            onClick={onClearSession}
            variant="secondary"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <CloudAlphaMetric
          label="云配置"
          value="受限"
          detail="环境变量启用前保持禁用"
          tone="warning"
        />
        <CloudAlphaMetric
          label="本地会话"
          value={
            sessionExpired
              ? "已过期"
              : session?.user?.email || (session ? "已保存 token" : "无")
          }
          detail={
            session?.expiresAt
              ? `过期时间 ${formatDate(new Date(session.expiresAt).toISOString())}`
              : "这个浏览器没有云端 token"
          }
          tone={hasUsableSession ? "success" : "warning"}
        />
        <CloudAlphaMetric
          label="云工作区"
          value={workspace?.name ?? "未创建"}
          detail={workspace?.id ?? "登录后创建"}
          tone={workspace ? "success" : "info"}
        />
        <CloudAlphaMetric
          label="本地连接"
          value={
            localIdentity?.cloud_status === "linked-alpha"
              ? "已连接"
              : "仅本地"
          }
          detail={
            linkedWorkspaceId ||
            "本地身份里没有云工作区 id"
          }
          tone={
            localIdentity?.cloud_status === "linked-alpha"
              ? "success"
              : "info"
          }
        />
        <CloudAlphaMetric
          label="同步状态"
          value="关闭"
          detail="不上传笔记、文件或数据库"
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
            默认环境下接口禁用，不会把邮箱发送到 Supabase。
          </p>
        </div>

        <div className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            云工作区名称
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={workspaceName}
              onChange={(event) => onWorkspaceNameChange(event.target.value)}
              placeholder="ZhiNotes Research Workspace"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
            />
            <CloudAlphaButton
              label="创建工作区"
              busy={busyAction === "workspace"}
              disabled={!hasUsableSession || Boolean(busyAction)}
              onClick={onWorkspaceCreate}
            />
          </div>
          <p className="mt-2 text-[11px] leading-4 text-zinc-400">
            只创建空工作区和用户成员关系，不上传本地内容。
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              云工作区连接
            </div>
            <p className="mt-1 max-w-3xl text-[11px] leading-4 text-zinc-400">
              这里只做账号和工作区元数据检查。连接本地工作区
              只是把云工作区 id 记在浏览器本地，不会上传任何页面内容。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CloudAlphaButton
              label="列出工作区"
              busy={busyAction === "list-workspaces"}
              disabled={!hasUsableSession || Boolean(busyAction)}
              onClick={onWorkspaceList}
              variant="secondary"
            />
            <CloudAlphaButton
              label="启动检查"
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
              选择云工作区
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
                  {item.name} · {formatCloudRole(item.role)} · {item.id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <CloudAlphaButton
              label="连接本地工作区"
              busy={busyAction === "link-workspace"}
              disabled={
                !hasUsableSession ||
                !session?.user?.id ||
                !selectedWorkspaceId ||
                !bootstrapProofMatchesSelection ||
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
            <CloudAlphaButton
              label="导出连接收据"
              busy={busyAction === "link-receipt"}
              disabled={
                localIdentity?.cloud_status !== "linked-alpha" ||
                Boolean(busyAction)
              }
              onClick={onExportLinkReceipt}
              variant="secondary"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <CloudAlphaSmallRow
            label="已选云工作区"
            value={selectedWorkspaceId || "未选择"}
          />
          <CloudAlphaSmallRow
            label="启动检查证明"
            value={
              bootstrapProofMatchesSelection
                ? `已检查 ${formatDate(bootstrapProof?.checked_at ?? "")}`
                : linkedHasBootstrapProof
                  ? `已连接证明 ${formatDate(
                      localIdentity?.cloud_bootstrap_checked_at ?? ""
                    )}`
                  : "连接前先做启动检查"
            }
          />
          <CloudAlphaSmallRow
            label="本地工作区连接"
            value={
              localIdentity?.cloud_workspace_name ||
              localIdentity?.cloud_workspace_id ||
              "仅本地"
            }
          />
          <CloudAlphaSmallRow
            label="云同步开关"
            value={
              localIdentity?.cloud_status === "linked-alpha"
                ? `推送${localIdentity.cloud_sync_push_enabled ? "开" : "关"} / 拉取${
                    localIdentity.cloud_sync_pull_enabled ? "开" : "关"
                  }`
                : "推送关 / 拉取关"
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

function formatCloudRole(role: CloudAlphaWorkspace["role"]) {
  const labels: Record<NonNullable<CloudAlphaWorkspace["role"]>, string> = {
    owner: "拥有者",
    researcher: "研究员",
    viewer: "查看者",
  };

  return role ? labels[role] : "角色未知";
}

function CloudAlphaTonePill({ tone }: { tone: CloudAlphaMessageTone }) {
  const labels: Record<CloudAlphaMessageTone, string> = {
    info: "信息",
    success: "就绪",
    warning: "受限",
    error: "错误",
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
    ready: "就绪",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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

function WebLaunchDecisionSummaryPanel({
  workbench,
  alphaDecision,
  ownerReview,
  busyAction,
  onOpenSection,
  onExportAlphaDecision,
  onExportOwnerReview,
}: {
  workbench: WebLaunchWorkbenchPacket;
  alphaDecision: WebAlphaLaunchDecisionReceipt;
  ownerReview: WebBetaOwnerReviewPacket;
  busyAction: WebBetaContractAction | null;
  onOpenSection: (sectionId: string) => void;
  onExportAlphaDecision: () => void;
  onExportOwnerReview: () => void;
}) {
  const topBlockers = ownerReview.p0_blockers.slice(0, 3);
  const localWork = ownerReview.local_first_work.slice(0, 3);

  return (
    <section
      id="web-launch-decision-summary"
      className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            上线决策
          </p>
          <h2 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Web 上线决策摘要
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            面向用户的上线/不上线总览：本地开发可以继续，Web Alpha/Beta
            预览、云同步、公开部署和 AI 仍保持关闭。这里仅整合本地
            阶段门禁、用户复核和上线工作台元数据，不连接云服务。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenSection("web-launch-workbench")}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            打开上线工作台
          </button>
          <button
            type="button"
            onClick={() => onOpenSection("web-beta-owner-review")}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            打开用户复核
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <LaunchDecisionMetric
          label="本地构建"
          value={workbench.local_app_can_continue_now ? "可继续" : "不可继续"}
          detail="继续本地迭代"
          tone="ready"
        />
        <LaunchDecisionMetric
          label="Alpha 预览"
          value={
            alphaDecision.web_alpha_preview_can_be_shared_now
              ? "可分享"
              : "不可分享"
          }
          detail="不可分享预览"
          tone="blocked"
        />
        <LaunchDecisionMetric
          label="Web Beta"
          value={workbench.web_beta_can_launch_now ? "可上线" : "不可上线"}
          detail="不可上线"
          tone="blocked"
        />
        <LaunchDecisionMetric
          label="云同步"
          value={workbench.cloud_sync_can_start_now ? "可启动" : "不可启动"}
          detail="上传关闭"
          tone="blocked"
        />
        <LaunchDecisionMetric
          label="P0 阻塞"
          value={ownerReview.summary.p0_blockers}
          detail="先清理"
          tone={ownerReview.summary.p0_blockers > 0 ? "blocked" : "ready"}
        />
        <LaunchDecisionMetric
          label="用户决策"
          value={ownerReview.summary.owner_decisions}
          detail="待确认"
          tone={
            ownerReview.summary.owner_decisions > 0
              ? "manual-confirmation"
              : "ready"
          }
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-md border border-zinc-100 p-3 text-xs dark:border-zinc-800">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            当前结论
          </h3>
          <div className="mt-2 grid gap-2">
            <LaunchDecisionFact
              label="Web Alpha"
              value={formatLaunchDecisionValue(alphaDecision.decision)}
              detail={`${alphaDecision.summary.p0_actions} 个 P0 动作，${alphaDecision.summary.owner_decisions} 个用户决策。`}
            />
            <LaunchDecisionFact
              label="Web Beta"
              value={formatLaunchDecisionValue(ownerReview.decision)}
              detail={`${ownerReview.summary.blocked_stage_gates} 个阶段门禁阻塞，${ownerReview.summary.blocked_smoke_cases} 个冒烟用例阻塞。`}
            />
            <LaunchDecisionFact
              label="云就绪度"
              value={formatLaunchDecisionValue(
                ownerReview.summary.missing_required_environment === 0
                  ? "env-present-but-still-owner-gated"
                  : "missing-required-environment"
              )}
              detail={`缺失环境项：${ownerReview.summary.missing_required_environment ?? "未知"}。云同步仍不可启动。`}
            />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              先处理的阻塞项
            </div>
            <div className="mt-2 grid gap-2">
              {topBlockers.length > 0 ? (
                topBlockers.map((blocker) => (
                  <LaunchDecisionWorkItem
                    key={blocker.id}
                    title={localizeSyncDecisionText(blocker.title)}
                    detail={localizeSyncDecisionText(blocker.required_action)}
                    badge={blocker.priority.toUpperCase()}
                  />
                ))
              ) : (
                <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                  暂无 P0 阻塞项，继续检查用户决策和冒烟测试证据。
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              可以继续的本地工作
            </div>
            <div className="mt-2 grid gap-2">
              {localWork.length > 0 ? (
                localWork.map((item) => (
                  <LaunchDecisionWorkItem
                    key={item.id}
                    title={localizeSyncDecisionText(item.title)}
                    detail={
                      localizeSyncDecisionText(
                        item.completion_evidence[0] ??
                          "需要补齐本地完成证据。"
                      )
                    }
                    badge="本地"
                  />
                ))
              ) : (
                <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                  暂无可独立推进的本地工作，优先完成门禁和用户复核。
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-3xl text-xs leading-5 text-zinc-400">
          本摘要不读页面正文、数据库行数据、文件名、文件字节、密钥值、
          token、cookie、持仓或交易计划；也不会部署、连云、上传、启用同步或 AI。
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportAlphaDecision}
            disabled={busyAction === "web-alpha-launch-decision"}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {busyAction === "web-alpha-launch-decision"
              ? "导出中..."
              : "导出 Alpha 决策"}
          </button>
          <button
            type="button"
            onClick={onExportOwnerReview}
            disabled={busyAction === "web-beta-owner-review"}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {busyAction === "web-beta-owner-review"
              ? "导出中..."
              : "导出 Beta 用户复核"}
          </button>
        </div>
      </div>
    </section>
  );
}

function LaunchDecisionMetric({
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

function LaunchDecisionFact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
      <div className="text-[10px] tracking-wide text-zinc-400">
        {label}
      </div>
      <div className="mt-1 break-words font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
      <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
        {detail}
      </p>
    </article>
  );
}

function LaunchDecisionWorkItem({
  title,
  detail,
  badge,
}: {
  title: string;
  detail: string;
  badge: string;
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </div>
        <span className="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          {badge}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {detail}
      </p>
    </article>
  );
}

function formatLaunchDecisionValue(value: string) {
  const labels: Record<string, string> = {
    "continue-local-build-no-preview": "继续本地构建，暂不开放预览",
    "continue-local-build-no-beta": "继续本地构建，暂不上线 Beta",
    "env-present-but-still-owner-gated": "环境项齐备，但仍需用户确认",
    "missing-required-environment": "缺少必需环境项",
  };

  return labels[value] ?? value;
}

function localizeSyncDecisionText(value: string) {
  const exact: Record<string, string> = {
    "Cloud database schema": "云数据库结构",
    "Permission policy draft": "权限策略草案",
    "Account session boundary": "账号会话边界",
    "Audit trail policy": "审计轨迹策略",
    "Cloud schema contract exists locally, but no applied migration is proven.":
      "云端数据结构合同已在本地存在，但还没有迁移应用证明。",
    "Create versioned migrations for users, workspaces, pages, databases, files, sync_log, permissions, and audit events.":
      "为用户、工作区、页面、数据库、文件、同步日志、权限和审计事件创建版本化迁移。",
    "Permission request validator rejects forbidden payload classes.":
      "权限请求验证器已经拒绝禁止外发的内容类型。",
    "Audit envelope validation rejects forbidden payloads.":
      "审计信封验证已经拒绝禁止外发的内容。",
    "Auth provider and session model are selected.":
      "身份服务和会话模型已选择。",
    "Local completion evidence required.": "需要补齐本地完成证据。",
    "需要补齐本地完成证据。": "需要补齐本地完成证据。",
    "Deployment, route preflight, and rollback": "部署、路由预检和回滚",
    "Run local verification command bundle": "运行本地验证命令包",
  };

  let next = exact[value] ?? value;
  next = next
    .replaceAll("Move role checks to authenticated server endpoints only after the dedicated permission route runs validator-backed forbidden payload rejection, high-risk confirmations, audit envelope linkage, server permission matrix tests, and readiness gates before private beta.", "在专用权限接口通过禁止内容验证、高风险确认、审计信封关联、服务端权限矩阵测试和就绪门禁后，再把角色检查迁移到已认证的服务端接口。")
    .replaceAll("Private beta cannot start until account login, session storage, workspace membership, and local-to-cloud linking are specified.", "账号登录、会话存储、工作区成员关系和本地到云端连接规则明确前，不能启动私有 Beta。")
    .replaceAll("Choose auth provider, session cookie design, device revoke behavior, workspace membership rules, and owner confirmation for local-to-cloud linking.", "选择身份服务、会话 cookie 设计、设备撤销行为、工作区成员规则，以及本地连接云端前的用户确认。")
    .replaceAll("Versioned migrations exist for the contracted cloud tables.", "约定云表已有版本化迁移。")
    .replaceAll("Deployment target selects vercel-nextjs for the first Web Alpha, supabase-cloud for cloud data, and", "部署目标为首个 Web Alpha 选择 vercel-nextjs，为云端数据选择 supabase-cloud，并且仍有")
    .replaceAll("blocked deployment items remain.", "个部署阻塞项。")
    .replaceAll("Use the target contract to decide provider setup, preview deployment, secrets, rollback, and owner confirmation before going live.", "上线前，用目标合同确认服务商配置、预览部署、密钥、回滚和用户确认。")
    .replaceAll("Run deployment gates as repeatable checks before any private preview is shared.", "分享任何私有预览前，把部署门槛作为可重复检查来执行。")
    .replaceAll("Implement authenticated audit_events writes only after envelope redaction, retention, owner-only audit export, and incident review are proven before private beta.", "只有在私有 Beta 前证明信封脱敏、保留策略、仅用户审计导出和事故复核都可行后，才实现已认证的 audit_events 写入。")
    .replaceAll("Route preflight has", "路由预检有")
    .replaceAll("missing or mismatched route contracts.", "个缺失或不匹配的路由合同。")
    .replaceAll("Baseline request contract", "基线请求合同")
    .replaceAll("Remote baseline request contract exists and keeps request, stage, and apply disabled.", "远端基线请求合同已存在，并保持请求、暂存和应用全部关闭。")
    .replaceAll("Enable metadata-only remote request only after auth, cursor, permissions, audit, and review staging are proven.", "只有在认证、游标、权限、审计和复核暂存都被证明可行后，才能启用仅元数据的远端请求。")
    .replaceAll("Stage store schema", "暂存表结构")
    .replaceAll("remote_baseline_stage is a planned table only; no persistence schema exists yet.", "remote_baseline_stage 目前只是计划中的表，还没有持久化结构。")
    .replaceAll("Add a schema migration before any remote metadata can be staged for review.", "任何远端元数据进入复核暂存前，先补齐结构迁移。")
    .replaceAll("Smoke test plan requires lint, verify:web-beta, verify:replay-harness, and production build before preview review.", "预览复核前，冒烟测试计划要求 lint、verify:web-beta、verify:replay-harness 和生产构建全部通过。")
    .replaceAll("All command bundle checks pass on the deployment branch.", "部署分支上的命令包检查全部通过。")
    .replaceAll("Review command output before sharing a preview URL or changing launch status.", "分享预览 URL 或更改上线状态前，先复核命令输出。")
    .replaceAll("Review command output before sharing a preview URL or changing cloud flags.", "分享预览 URL 或改动云端开关前，先复核命令输出。")
    .replaceAll("Deployment target", "部署目标")
    .replaceAll("Deployment", "部署")
    .replaceAll("deployment", "部署")
    .replaceAll("Contract", "合同")
    .replaceAll("contract", "合同")
    .replaceAll("Gates", "门槛")
    .replaceAll("gates", "门槛")
    .replaceAll("Gate", "门槛")
    .replaceAll("gate", "门槛")
    .replaceAll("Remote baseline", "远端基线")
    .replaceAll("remote baseline", "远端基线")
    .replaceAll("Smoke test plan", "冒烟测试计划")
    .replaceAll("smoke test plan", "冒烟测试计划")
    .replaceAll("preview review", "预览复核")
    .replaceAll("Owner", "用户")
    .replaceAll("owner", "用户")
    .replaceAll("cloud sync", "云同步")
    .replaceAll("Cloud sync", "云同步")
    .replaceAll("cloud", "云端")
    .replaceAll("Cloud", "云端")
    .replaceAll("payload", "外发内容")
    .replaceAll("Payload", "外发内容")
    .replaceAll("stage gate", "阶段门禁")
    .replaceAll("smoke", "冒烟测试")
    .replaceAll("completion evidence", "完成证据")
    .replaceAll("server endpoints", "服务端接口")
    .replaceAll("permission", "权限")
    .replaceAll("audit", "审计")
    .replaceAll("workspace", "工作区")
    .replaceAll("sync_log", "同步日志")
    .replaceAll("AI", "AI");

  return next;
}

function WebLaunchLaneCard({
  lane,
}: {
  lane: WebLaunchWorkbenchPacket["lanes"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {lane.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {lane.description}
          </p>
        </div>
        <span className="shrink-0 rounded bg-white px-2 py-1 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          {lane.action_count} actions
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <span className="rounded-md bg-white px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
          stages {lane.stage_count}
        </span>
        <span className="rounded-md bg-white px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
          P0 {lane.p0_count}
        </span>
        <span className="rounded-md bg-white px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
          blocked {lane.blocked_count}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        {lane.privacy_boundary}
      </p>
    </article>
  );
}

function WebLaunchActionCard({
  action,
}: {
  action: WebLaunchWorkbenchPacket["actions"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <NextActionPriorityPill priority={action.priority} />
            <NextActionOwnerPill owner={action.owner} />
            <NextActionExecutionPathPill path={action.execution_path} />
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {action.title}
            </span>
          </div>
          <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
            {action.evidence}
          </p>
        </div>
        <NextActionStatusPill status={action.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {action.next_action}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-md bg-zinc-50 px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
          {action.can_start_locally ? "可本地先做" : "需要云环境"}
        </span>
        <span className="rounded-md bg-zinc-50 px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
          {action.requires_owner_decision ? "owner 决策" : "工程任务"}
        </span>
        <span className="rounded-md bg-zinc-50 px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
          {action.cloud_dependency}
        </span>
      </div>
    </article>
  );
}

function WebLaunchSequenceCard({
  step,
  onOpen,
}: {
  step: WebLaunchWorkbenchPacket["launch_sequence"][number];
  onOpen: (step: WebLaunchWorkbenchPacket["launch_sequence"][number]) => void;
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase text-zinc-400">
            Step {step.order}
          </div>
          <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
            {step.title}
          </div>
        </div>
        <BetaStatusPill status={step.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {step.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {step.completion_signal}
      </p>
      <button
        type="button"
        onClick={() => onOpen(step)}
        className="mt-3 rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-600 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-950"
      >
        打开步骤
      </button>
    </article>
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
          {allowed ? "允许" : "禁止"}
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
    planned: "计划中",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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

function AuditEnvelopeTemplateRow({
  template,
}: {
  template: AuditEventEnvelopeContract["templates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {template.title}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-zinc-400">
            {template.category} · {template.endpoint_status}
          </div>
        </div>
        <AuditEnvelopeStatusPill status={template.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {template.trigger}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {template.allowed_metadata.slice(0, 6).map((field) => (
          <span
            key={field}
            className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {field}
          </span>
        ))}
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        禁止载荷类型：{template.forbidden_payloads.length}
      </p>
    </article>
  );
}

function AuditEnvelopeRedactionCheckRow({
  check,
}: {
  check: AuditEventEnvelopeContract["redaction_checks"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {check.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {check.id}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {check.evidence}
          </p>
        </div>
        <AuditEnvelopeStatusPill status={check.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {check.failure_condition}
      </p>
    </article>
  );
}

function AuditEnvelopeGateRow({
  gate,
}: {
  gate: AuditEventEnvelopeContract["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {localizeSyncDecisionText(gate.title)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {gate.evidence}
          </p>
        </div>
        <AuditEnvelopeStatusPill status={gate.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function AuditEventsApiSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: AuditEventsApiValidationStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <AuditEventsApiValidationPill status={status} />
      </div>
      <div className="mt-2 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function AuditEventsApiFieldRow({
  field,
}: {
  field: AuditEventsApiDisabledResponse["request_schema"]["allowed_fields"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          {field.field}
        </div>
        <AuditEventsApiFieldStatusPill status={field.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {field.reason}
      </p>
    </article>
  );
}

function AuditEventsApiFixtureRow({
  fixture,
}: {
  fixture: AuditEventsApiDisabledResponse["local_validator_report"]["fixtures"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {fixture.id}
          </div>
          <div className="mt-1 text-[10px] text-zinc-400">
            预期 {fixture.expected_status}
          </div>
        </div>
        <AuditEventsApiValidationPill status={fixture.actual_status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {fixture.reason}
      </p>
    </article>
  );
}

function AuditEventsApiGateRow({
  gate,
}: {
  gate: AuditEventsApiDisabledResponse["enablement_gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
        {gate.title}
      </div>
      <div className="mt-1 font-mono text-[10px] text-zinc-400">
        {gate.id}
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {gate.required_before_enablement}
      </p>
    </article>
  );
}

function AuditEventsApiFieldStatusPill({
  status,
}: {
  status: AuditEventsApiFieldStatus;
}) {
  const className =
    status === "allowed"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {status === "allowed" ? "允许" : "禁止"}
    </span>
  );
}

function AuditEventsApiValidationPill({
  status,
}: {
  status: AuditEventsApiValidationStatus;
}) {
  const className =
    status === "accepted"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {status === "accepted" ? "已接受" : "已拒绝"}
    </span>
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
          {allowed ? "允许" : "禁止"}
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
    planned: "计划中",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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

function AuditEnvelopeStatusPill({
  status,
}: {
  status: AuditEventEnvelopeStatus;
}) {
  const labels: Record<AuditEventEnvelopeStatus, string> = {
    planned: "计划中",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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

function PermissionCheckScenarioRow({
  scenario,
}: {
  scenario: PermissionCheckEnvelopeContract["scenarios"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {scenario.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {scenario.role_id} · {scenario.resource_id} · {scenario.action_id}
          </div>
        </div>
        <PermissionCheckStatusPill status={scenario.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        预期：{scenario.expected_decision}。确认：{" "}
        {scenario.required_confirmation ? "必需" : "不需要"}。
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {scenario.required_evidence}
      </p>
    </article>
  );
}

function PermissionCheckGateRow({
  gate,
}: {
  gate: PermissionCheckEnvelopeContract["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {gate.evidence}
          </p>
        </div>
        <PermissionCheckStatusPill status={gate.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function PermissionCheckFieldRow({
  field,
}: {
  field: PermissionCheckEnvelopeContract["request_fields"][number];
}) {
  const allowed = field.status === "allowed";

  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {field.field}
          </div>
          <div className="mt-1 text-[10px] text-zinc-400">
            {field.value_shape}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${
            allowed
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {allowed ? "允许" : "禁止"}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {field.purpose}
      </p>
    </article>
  );
}

function PermissionCheckValidatorFixtureRow({
  fixture,
}: {
  fixture: PermissionCheckValidatorReport["fixture_results"][number];
}) {
  const detailItems = [
    ...fixture.forbidden_field_paths.map((item) => `禁止：${item}`),
    ...fixture.unknown_field_names.map((item) => `未知：${item}`),
    ...fixture.missing_required_fields.map((item) => `缺失：${item}`),
    ...fixture.invalid_field_names.map((item) => `无效：${item}`),
  ];

  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {fixture.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {fixture.id}
          </div>
        </div>
        <PermissionCheckValidationStatusPill status={fixture.actual_status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        预期 {fixture.expected_status}；{" "}
        {fixture.passed ? "fixture 通过" : "fixture 失败"}。
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {detailItems.length > 0 ? detailItems.join(" · ") : "未检测到私人字段。"}
      </p>
    </article>
  );
}

function PermissionServerMatrixCaseRow({
  testCase,
}: {
  testCase: PermissionServerTestMatrix["cases"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {localizeSyncDecisionText(testCase.title)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {testCase.role_id} · {testCase.resource_id} ·{" "}
            {testCase.action_id}
          </div>
        </div>
        <PermissionServerDecisionPill
          decision={testCase.expected_server_decision}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <PermissionServerCaseStatusPill status={testCase.case_status} />
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          HTTP {testCase.expected_http_status_after_enablement}
        </span>
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {testCase.request_validation_status}
        </span>
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {testCase.acceptance_criteria[0]}
      </p>
    </article>
  );
}

function PermissionServerReadinessGateRow({
  gate,
}: {
  gate: PermissionServerReadinessReport["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
        </div>
        <PermissionServerReadinessStatusPill status={gate.status} />
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
    "local-allowed": "允许",
    "local-denied": "拒绝",
    "needs-confirmation": "确认",
    "server-blocked": "服务端阻塞",
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

function PermissionServerReadinessStatusPill({
  status,
}: {
  status: PermissionServerReadinessStatus;
}) {
  const labels: Record<PermissionServerReadinessStatus, string> = {
    ready: "就绪",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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

function PermissionServerDecisionPill({
  decision,
}: {
  decision: PermissionServerExpectedDecision;
}) {
  const labels: Record<PermissionServerExpectedDecision, string> = {
    "allow-read-only": "允许",
    "allow-after-confirmation": "确认",
    deny: "拒绝",
    "reject-request": "驳回",
  };

  const className =
    decision === "allow-read-only"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : decision === "allow-after-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[decision]}
    </span>
  );
}

function PermissionServerCaseStatusPill({
  status,
}: {
  status: PermissionServerMatrixCaseStatus;
}) {
  const labels: Record<PermissionServerMatrixCaseStatus, string> = {
    planned: "计划中",
    "manual-confirmation": "确认",
    blocked: "阻塞",
  };

  const className =
    status === "planned"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function PermissionCheckValidationStatusPill({
  status,
}: {
  status: PermissionCheckRequestValidationStatus;
}) {
  const labels: Record<PermissionCheckRequestValidationStatus, string> = {
    "metadata-only-accepted": "已接受",
    "rejected-forbidden-payload": "载荷阻止",
    "rejected-unknown-field": "未知字段阻止",
    "rejected-invalid-shape": "无效结构阻止",
  };

  const className =
    status === "metadata-only-accepted"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "rejected-forbidden-payload"
        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
        : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function PermissionCheckStatusPill({
  status,
}: {
  status: PermissionCheckEnvelopeStatus;
}) {
  const labels: Record<PermissionCheckEnvelopeStatus, string> = {
    planned: "计划中",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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
            {localizeSyncDecisionText(action.title)}
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
          ? "今天可以执行，但必须先输入确认短语并完成可见本地复核。"
          : "在缺失的服务端、审计、回滚或权限控制补齐前保持预留或阻塞。"}
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
    "local-receipt-available": "收据",
    planned: "计划中",
    blocked: "阻塞",
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
            {table.included_count} 已纳入 / {table.pending_count} 待处理
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
    planned: "计划中",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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
            当前 {scope.current_count} / 恢复{" "}
            {scope.restore_count ?? "未预览"}
          </div>
        </div>
        <RollbackRiskPill risk={scope.risk} />
      </div>
      <div className="mt-2 border-t border-zinc-100 pt-2 text-[11px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
        写入状态：{scope.write_status}
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
    ready: "就绪",
    pending: "待处理",
    "manual-confirmation": "待确认",
    blocked: "阻塞",
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
  const labels: Record<RestoreRollbackRisk, string> = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
  };
  const className =
    risk === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : risk === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[risk]}
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
    planned: "计划中",
    "manual-confirmation": "待确认",
    blocked: "阻塞",
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
            来源：{table.local_source}
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
    planned: "计划中",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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
    drafted: "已起草",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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
            {group.present}/{group.required} 个必需项已存在
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
    present: "已存在",
    missing: "缺失",
    "optional-missing": "可选",
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

function PrivateFileStorageSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: PrivateFileStoragePolicyStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <PrivateFileStorageStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function PrivateFileStorageGateRow({
  gate,
}: {
  gate: PrivateFileStoragePolicyReport["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
        </div>
        <PrivateFileStorageStatusPill status={gate.status} />
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

function PrivateFileStorageBucketRow({
  bucket,
}: {
  bucket: PrivateFileStoragePolicyReport["buckets"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {bucket.id}
          </div>
          <div className="mt-1 text-[10px] text-zinc-400">
            {bucket.bucket_name_env} · 公开访问 {bucket.public_access}
          </div>
        </div>
        <PrivateFileStorageStatusPill status={bucket.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {bucket.purpose}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {bucket.required_controls.slice(0, 5).map((control) => (
          <span
            key={control}
            className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {control}
          </span>
        ))}
      </div>
    </article>
  );
}

function PrivateFileStorageRouteRow({
  route,
}: {
  route: PrivateFileStoragePolicyReport["routes"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {route.method}
            </span>
            <span className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
              {route.route}
            </span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">
            {route.id} · {route.route_status}
          </div>
        </div>
        <PrivateFileStorageStatusPill status="blocked" />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {route.purpose}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        禁止字段：{route.forbidden_payload_fields.slice(0, 6).join(", ")}
      </p>
    </article>
  );
}

function PrivateFileStorageClassRow({
  fileClass,
}: {
  fileClass: PrivateFileStoragePolicyReport["file_classes"][number];
}) {
  const status: PrivateFileStoragePolicyStatus =
    fileClass.sync_strategy === "blocked-until-review"
      ? "blocked"
      : "planned";

  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {fileClass.label}
          </div>
          <div className="mt-1 text-[10px] text-zinc-400">
            {fileClass.default_max_size_mb} MB · {fileClass.sync_strategy}
          </div>
        </div>
        <PrivateFileStorageStatusPill status={status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {fileClass.file_kinds.map((kind) => (
          <span
            key={kind}
            className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {kind}
          </span>
        ))}
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {fileClass.required_controls[0]}
      </p>
    </article>
  );
}

function PrivateFileStorageStatusPill({
  status,
}: {
  status: PrivateFileStoragePolicyStatus;
}) {
  const labels: Record<PrivateFileStoragePolicyStatus, string> = {
    planned: "计划中",
    "manual-confirmation": "确认",
    blocked: "阻塞",
  };
  const className =
    status === "blocked"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function FilePresignSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: FilePresignValidationStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <FilePresignValidationPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function FilePresignFieldRow({
  field,
}: {
  field: FilePresignApiDisabledResponse["request_schema"]["allowed_fields"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          {field.field}
        </div>
        <FilePresignFieldStatusPill status={field.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {field.reason}
      </p>
    </article>
  );
}

function FilePresignFixtureRow({
  fixture,
}: {
  fixture: FilePresignApiDisabledResponse["local_validator_report"]["fixtures"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {fixture.id}
          </div>
          <div className="mt-1 text-[10px] text-zinc-400">
            预期 {fixture.expected_status}
          </div>
        </div>
        <FilePresignValidationPill status={fixture.actual_status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {fixture.reason}
      </p>
    </article>
  );
}

function FilePresignGateRow({
  gate,
}: {
  gate: FilePresignApiDisabledResponse["enablement_gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
        {gate.title}
      </div>
      <div className="mt-1 font-mono text-[10px] text-zinc-400">
        {gate.id}
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {gate.required_before_enablement}
      </p>
    </article>
  );
}

function FilePresignFieldStatusPill({
  status,
}: {
  status: FilePresignFieldStatus;
}) {
  const className =
    status === "allowed"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {status === "allowed" ? "允许" : "禁止"}
    </span>
  );
}

function FilePresignValidationPill({
  status,
}: {
  status: FilePresignValidationStatus;
}) {
  const className =
    status === "accepted"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {status === "accepted" ? "已接受" : "已拒绝"}
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

function DeploymentTargetSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: WebBetaContractStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <ContractStatusPill status={status} />
      </div>
      <div className="mt-2 break-words text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function DeploymentProviderRow({
  provider,
}: {
  provider: WebBetaDeploymentTarget["providers"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {provider.id}
          </div>
          <div className="mt-1 text-[11px] uppercase text-zinc-400">
            {provider.role}
          </div>
        </div>
        <ContractStatusPill status={provider.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {provider.purpose}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {provider.blocker}
      </p>
    </article>
  );
}

function DeploymentTrackRow({
  track,
}: {
  track: WebBetaDeploymentTarget["tracks"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {track.title}
        </div>
        <ContractStatusPill status={track.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {track.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {track.required_action}
      </p>
    </article>
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
          {formatRouteStatus(routeCheck.status)}
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
              预期：{formatRouteStatus(check.expected_status)}
            </span>
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800">
              实际：
              {check.actual_status
                ? formatRouteStatus(check.actual_status)
                : "缺失"}
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
    covered: "已覆盖",
    "status-mismatch": "状态不一致",
    missing: "缺失",
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

function formatRouteStatus(status: string) {
  const labels: Record<string, string> = {
    "local-route": "本地路由",
    "disabled-stub": "已禁用桩接口",
    "cloud-alpha-gated": "云 Alpha 门禁",
    missing: "缺失",
  };

  return labels[status] ?? status;
}

function SmokeTestSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: WebBetaSmokeTestStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <SmokeTestStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function SmokeTestCaseRow({
  testCase,
}: {
  testCase: WebBetaSmokeTestPlan["cases"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {localizeSyncDecisionText(testCase.title)}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {testCase.phase}
            </span>
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800">
              {testCase.mode}
            </span>
          </div>
        </div>
        <SmokeTestStatusPill status={testCase.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {localizeSyncDecisionText(testCase.evidence)}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {localizeSyncDecisionText(testCase.pass_condition)}
      </p>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        {localizeSyncDecisionText(testCase.failure_response)}
      </p>
    </article>
  );
}

function SmokeTestStatusPill({
  status,
}: {
  status: WebBetaSmokeTestStatus;
}) {
  const labels: Record<WebBetaSmokeTestStatus, string> = {
    "ready-to-run": "就绪",
    "manual-confirmation": "确认",
    blocked: "阻塞",
  };

  const className =
    status === "ready-to-run"
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

function HandoffSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: WebAlphaHandoffStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <HandoffStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function HandoffItemRow({
  item,
}: {
  item: WebAlphaHandoffBundle["handoff_items"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {localizeSyncDecisionText(item.title)}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">{item.source}</div>
        </div>
        <HandoffStatusPill status={item.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {localizeSyncDecisionText(item.evidence)}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {localizeSyncDecisionText(item.required_before_preview)}
      </p>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        {localizeSyncDecisionText(item.owner_review)}
      </p>
    </article>
  );
}

function HandoffCommandRow({
  command,
}: {
  command: WebAlphaHandoffBundle["command_bundle"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {command.command}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {command.purpose}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-green-50 px-2 py-1 text-[10px] text-green-700 dark:bg-green-950 dark:text-green-300">
          必需
        </span>
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {command.privacy_boundary}
      </p>
    </article>
  );
}

function HandoffDecisionRow({
  decision,
}: {
  decision: WebAlphaHandoffBundle["owner_decisions"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {decision.question}
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${
            decision.default_answer === "yes"
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          默认 {decision.default_answer === "yes" ? "是" : "否"}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {decision.rationale}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        必需前置条件：{decision.required_before}
      </p>
    </article>
  );
}

function HandoffStatusPill({
  status,
}: {
  status: WebAlphaHandoffStatus;
}) {
  const labels: Record<WebAlphaHandoffStatus, string> = {
    ready: "就绪",
    partial: "部分",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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

function LaunchDecisionSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: WebAlphaLaunchDecisionStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <LaunchDecisionStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function LaunchDecisionQuestionRow({
  question,
}: {
  question: WebAlphaLaunchDecisionReceipt["decision_questions"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {question.question}
        </div>
        <LaunchDecisionStatusPill status={question.status} />
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-wide text-zinc-400">
        答案：{question.answer}
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {question.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {question.required_before_yes}
      </p>
    </article>
  );
}

function LaunchDecisionBlockerRow({
  blocker,
}: {
  blocker: WebAlphaLaunchDecisionReceipt["top_blockers"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {localizeSyncDecisionText(blocker.title)}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            {blocker.source}
          </div>
        </div>
        <span className="shrink-0 rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">
          {blocker.priority}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {localizeSyncDecisionText(blocker.evidence)}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {localizeSyncDecisionText(blocker.required_action)}
      </p>
    </article>
  );
}

function LaunchDecisionStatusPill({
  status,
}: {
  status: WebAlphaLaunchDecisionStatus;
}) {
  const labels: Record<WebAlphaLaunchDecisionStatus, string> = {
    "go-local-only": "仅本地",
    "no-go-preview": "无预览",
    "no-go-cloud": "不上云",
  };

  const className =
    status === "go-local-only"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "no-go-preview"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function OwnerReviewSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: WebBetaOwnerReviewStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <OwnerReviewStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function OwnerReviewQuestionRow({
  question,
}: {
  question: WebBetaOwnerReviewPacket["review_questions"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {question.question}
        </div>
        <OwnerReviewStatusPill status={question.status} />
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-wide text-zinc-400">
        答案：{question.answer}
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {question.evidence}
      </p>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {question.owner_prompt}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {question.required_before_go}
      </p>
    </article>
  );
}

function OwnerReviewBlockerRow({
  blocker,
}: {
  blocker: WebBetaOwnerReviewPacket["p0_blockers"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {blocker.title}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            {blocker.source}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <NextActionPriorityPill priority={blocker.priority} />
          <NextActionStatusPill status={blocker.status} />
        </div>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {blocker.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {blocker.required_action}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {blocker.verification_commands.map((command) => (
          <span
            key={command}
            className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {command}
          </span>
        ))}
      </div>
    </article>
  );
}

function OwnerReviewLocalWorkRow({
  item,
}: {
  item: WebBetaOwnerReviewPacket["local_first_work"][number];
}) {
  return (
    <article className="rounded-md bg-green-50 px-3 py-2 text-xs dark:bg-green-950/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {localizeSyncDecisionText(item.title)}
          </div>
          <div className="mt-1 text-[11px] text-green-700 dark:text-green-300">
            {item.phase}
          </div>
        </div>
        <NextActionPriorityPill priority={item.priority} />
      </div>
      <p className="mt-2 leading-5 text-green-700 dark:text-green-300">
        {localizeSyncDecisionText(
          item.completion_evidence[0] ?? "需要本地完成证据。"
        )}
      </p>
    </article>
  );
}

function OwnerReviewStatusPill({
  status,
}: {
  status: WebBetaOwnerReviewStatus;
}) {
  const labels: Record<WebBetaOwnerReviewStatus, string> = {
    "local-only": "仅本地",
    blocked: "阻塞",
    "owner-review": "用户",
  };

  const className =
    status === "local-only"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "owner-review"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
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
  executionPath,
  priority,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  executionPath?: WebBetaNextActionExecutionPath;
  priority?: WebBetaNextActionPriority;
  status?: WebBetaNextActionStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        {priority ? (
          <NextActionPriorityPill priority={priority} />
        ) : executionPath ? (
          <NextActionExecutionPathPill path={executionPath} />
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
            <NextActionOwnerPill owner={action.owner} />
            <NextActionExecutionPathPill path={action.execution_path} />
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {action.phase}
            </span>
            <NextActionCloudDependencyPill dependency={action.cloud_dependency} />
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800">
              {action.source}
            </span>
          </div>
        </div>
        <NextActionStatusPill status={action.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {localizeSyncDecisionText(action.evidence)}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {localizeSyncDecisionText(action.required_action)}
      </p>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        解锁：{localizeSyncDecisionText(action.unlocks)}
      </p>
      <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-300">
          验证
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {action.verification_commands.map((command) => (
            <code
              key={command}
              className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {command}
            </code>
          ))}
        </div>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>
          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-300">
            完成证据
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
            {action.completion_evidence.slice(0, 3).map((item) => (
              <li key={item}>{localizeSyncDecisionText(item)}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-300">
            确认前禁止
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
            {action.forbidden_until_confirmed.slice(0, 3).map((item) => (
              <li key={item}>{localizeSyncDecisionText(item)}</li>
            ))}
          </ul>
        </div>
      </div>
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

function NextActionOwnerPill({ owner }: { owner: WebBetaNextActionOwner }) {
  const labels: Record<WebBetaNextActionOwner, string> = {
    owner: "用户",
    developer: "开发",
    "cloud-admin": "云端",
  };
  const className =
    owner === "owner"
      ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
      : owner === "cloud-admin"
        ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[owner]}
    </span>
  );
}

function NextActionExecutionPathPill({
  path,
}: {
  path: WebBetaNextActionExecutionPath;
}) {
  const labels: Record<WebBetaNextActionExecutionPath, string> = {
    "local-first": "本地优先",
    "cloud-required": "需要云端",
    "owner-decision": "待决策",
  };
  const className =
    path === "local-first"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : path === "owner-decision"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[path]}
    </span>
  );
}

function NextActionCloudDependencyPill({
  dependency,
}: {
  dependency: WebBetaNextActionCloudDependency;
}) {
  const labels: Record<WebBetaNextActionCloudDependency, string> = {
    none: "云：无",
    "auth-provider": "云：认证",
    supabase: "云：Supabase",
    "private-storage": "云：存储",
    "deployment-env": "云：环境",
  };
  const className =
    dependency === "none"
      ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      : "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[dependency]}
    </span>
  );
}

function NextActionStatusPill({
  status,
}: {
  status: WebBetaNextActionStatus;
}) {
  const labels: Record<WebBetaNextActionStatus, string> = {
    "ready-to-build": "就绪",
    "needs-owner-decision": "待决策",
    "blocked-by-missing-cloud": "阻塞",
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
    ready: "就绪",
    partial: "部分",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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
          {surface.active_local_tables.length} 个活跃表
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
    "policy-ready": "政策就绪",
    "needs-remote-baseline": "需要基线",
    "manual-only": "仅人工",
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
  const labels: Record<SyncConflictSeverity, string> = {
    high: "高",
    medium: "中",
    low: "低",
  };

  const className =
    severity === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : severity === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[severity]}
    </span>
  );
}

function ResolutionSummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: SyncConflictResolutionStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <ResolutionStatusPill status={status} />
      </div>
      <div className="mt-2 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function ResolutionSurfacePlanRow({
  surface,
}: {
  surface: SyncConflictResolutionContract["surface_plans"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {surface.surface}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <ResolutionStatusPill status={surface.status} />
            <ConflictSeverityPill severity={surface.severity} />
          </div>
        </div>
        <span className="rounded-md bg-white px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
          {surface.apply_status}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        默认动作：{surface.default_action}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {surface.allowed_actions.map((action) => (
          <span
            key={action}
            className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {action}
          </span>
        ))}
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {surface.review_contract}
      </p>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        {surface.privacy_boundary}
      </p>
    </article>
  );
}

function ResolutionGateRow({
  gate,
}: {
  gate: SyncConflictResolutionContract["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {localizeSyncDecisionText(gate.title)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {localizeSyncDecisionText(gate.evidence)}
          </p>
        </div>
        <ResolutionStatusPill status={gate.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {localizeSyncDecisionText(gate.required_action)}
      </p>
    </article>
  );
}

function ResolutionOptionRow({
  option,
}: {
  option: SyncConflictResolutionContract["options"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {option.label}
          </div>
          <div className="mt-1 font-mono text-[11px] text-zinc-400">
            {option.id}
          </div>
        </div>
        <ResolutionStatusPill status={option.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {option.applies_to.map((surfaceId) => (
          <span
            key={surfaceId}
            className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {surfaceId}
          </span>
        ))}
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {option.required_evidence}
      </p>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        {option.risk_note} 写入状态：{option.write_status}。
      </p>
    </article>
  );
}

function ResolutionReviewSurfaceRow({
  review,
}: {
  review: SyncConflictResolutionContract["review_ui"]["surface_reviews"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-3 text-xs dark:bg-zinc-900">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {review.surface}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <ResolutionStatusPill status={review.status} />
            <ConflictSeverityPill severity={review.severity} />
          </div>
        </div>
        <span className="w-fit rounded-md bg-white px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
          应用已禁用
        </span>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        {review.lanes.map((lane) => (
          <ResolutionReviewLaneCard key={lane.id} lane={lane} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {review.action_buttons.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled
            title={action.disabled_reason}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-left text-[10px] text-zinc-400 opacity-70 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500"
          >
            <span className="font-medium">{action.label}</span>
            <span className="ml-1 font-mono">{action.id}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {review.apply_disabled_reason}
      </p>
    </article>
  );
}

function ResolutionReviewLaneCard({
  lane,
}: {
  lane: SyncConflictResolutionContract["review_ui"]["surface_reviews"][number]["lanes"][number];
}) {
  return (
    <div className="rounded-md border border-zinc-100 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {lane.title}
          </div>
          <div className="mt-1 text-[10px] text-zinc-400">
            {lane.source}
          </div>
        </div>
        <ResolutionStatusPill status={lane.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {lane.evidence_placeholder}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {lane.privacy_boundary}
      </p>
    </div>
  );
}

function RemoteBaselineSurfaceRow({
  request,
}: {
  request: RemoteBaselineRequestContract["surface_requests"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {request.surface}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <RemoteBaselineStatusPill status={request.status} />
            <span className="rounded-md bg-white px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
              {request.query_mode}
            </span>
          </div>
        </div>
        <span className="w-fit rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">
          {request.request_status}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {request.staging_target}
      </p>
      <div className="mt-2">
        <div className="text-[10px] font-semibold text-zinc-400">
          允许的远端元数据
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {request.required_remote_metadata.map((field) => (
            <span
              key={field}
              className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {field}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2">
        <div className="text-[10px] font-semibold text-zinc-400">
          禁止载荷
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {request.forbidden_remote_payload.map((field) => (
            <span
              key={field}
              className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {field}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {request.privacy_boundary}
      </p>
    </article>
  );
}

function RemoteBaselineGateRow({
  gate,
}: {
  gate: RemoteBaselineRequestContract["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {localizeSyncDecisionText(gate.title)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {localizeSyncDecisionText(gate.evidence)}
          </p>
        </div>
        <RemoteBaselineStatusPill status={gate.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {localizeSyncDecisionText(gate.required_action)}
      </p>
    </article>
  );
}

function RemoteBaselineFieldRow({
  field,
}: {
  field: RemoteBaselineRequestContract["fields"][number];
}) {
  const className =
    field.status === "allowed"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  const label = field.status === "allowed" ? "允许" : "禁止";

  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
          {field.field}
        </div>
        <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
          {label}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {field.reason}
      </p>
    </article>
  );
}

function RemoteBaselineStageStoreCard({
  store,
}: {
  store: RemoteBaselineStagingContract["stage_store"];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {store.table_name}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            保留策略：{store.retention}
          </p>
        </div>
        <RemoteBaselineStageStatusPill status={store.status} />
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>
          <div className="text-[10px] font-semibold text-zinc-400">
            允许字段
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {store.allowed_columns.map((field) => (
              <span
                key={field}
                className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-zinc-400">
            禁止字段
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {store.forbidden_columns.map((field) => (
              <span
                key={field}
                className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <div className="text-[10px] font-semibold text-zinc-400">
          必需索引
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {store.required_indexes.map((field) => (
            <span
              key={field}
              className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {field}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function RemoteBaselineStageSurfaceRow({
  surface,
}: {
  surface: RemoteBaselineStagingContract["surface_stages"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {surface.surface}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <RemoteBaselineStageStatusPill status={surface.status} />
            <span className="rounded-md bg-white px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
              {surface.target_review_lane} 复核列
            </span>
          </div>
        </div>
        <span className="w-fit rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">
          {surface.stage_status}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        目标复核面：{surface.target_review_surface}。来源：
        {` ${surface.source_contract}`}.
      </p>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>
          <div className="text-[10px] font-semibold text-zinc-400">
            元数据字段
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {surface.allowed_metadata_fields.map((field) => (
              <span
                key={field}
                className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-zinc-400">
            拒绝载荷
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {surface.forbidden_payload_fields.map((field) => (
              <span
                key={field}
                className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <div className="text-[10px] font-semibold text-zinc-400">
          验证步骤
        </div>
        <ul className="mt-1 space-y-1 leading-5 text-zinc-500 dark:text-zinc-400">
          {surface.validation_steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </div>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        {surface.privacy_boundary}
      </p>
    </article>
  );
}

function RemoteBaselineStageGateRow({
  gate,
}: {
  gate: RemoteBaselineStagingContract["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {localizeSyncDecisionText(gate.title)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {localizeSyncDecisionText(gate.evidence)}
          </p>
        </div>
        <RemoteBaselineStageStatusPill status={gate.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {localizeSyncDecisionText(gate.required_action)}
      </p>
    </article>
  );
}

function RemoteBaselineStageFieldRow({
  field,
}: {
  field: RemoteBaselineStagingContract["fields"][number];
}) {
  const className =
    field.status === "allowed"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  const label = field.status === "allowed" ? "允许" : "禁止";

  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
            {field.field}
          </div>
          <div className="mt-1 text-[10px] text-zinc-400">
            {field.target}
          </div>
        </div>
        <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
          {label}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {field.reason}
      </p>
    </article>
  );
}

function RemoteBaselineStageSchemaTableCard({
  table,
}: {
  table: RemoteBaselineStageSchemaContract["stage_table"];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {table.table_name}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            保留策略：{table.retention}。创建状态：{table.create_status}。
          </p>
        </div>
        <RemoteBaselineStageSchemaStatusPill status={table.status} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <RemoteBaselineSchemaColumnGroup
          title="允许字段"
          columns={table.allowed_columns}
        />
        <RemoteBaselineSchemaColumnGroup
          title="禁止字段"
          columns={table.forbidden_columns}
        />
      </div>
      <div className="mt-3 grid gap-2">
        {table.indexes.map((index) => (
          <div
            key={index.name}
            className="rounded-md bg-white px-3 py-2 dark:bg-zinc-950"
          >
            <div className="font-mono text-[10px] text-zinc-700 dark:text-zinc-200">
              {index.name}
            </div>
            <div className="mt-1 text-[10px] text-zinc-400">
              {index.columns.join(", ")}
            </div>
            <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
              {index.purpose}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        {table.constraints.map((constraint) => (
          <div
            key={constraint.name}
            className="rounded-md bg-white px-3 py-2 dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-mono text-[10px] text-zinc-700 dark:text-zinc-200">
                {constraint.name}
              </div>
              <RemoteBaselineStageSchemaStatusPill
                status={constraint.status}
              />
            </div>
            <div className="mt-1 font-mono text-[10px] text-zinc-400">
              {constraint.expression}
            </div>
            <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
              {constraint.purpose}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function RemoteBaselineSchemaColumnGroup({
  title,
  columns,
}: {
  title: string;
  columns: RemoteBaselineStageSchemaContract["stage_table"]["allowed_columns"];
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-zinc-400">{title}</div>
      <div className="mt-1 space-y-1">
        {columns.map((column) => (
          <div
            key={column.name}
            className={`rounded px-2 py-1 ${
              column.status === "forbidden"
                ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "bg-white text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            <div className="font-mono text-[10px]">
              {column.name} · {column.sql_type}
            </div>
            <div className="mt-1 text-[10px] leading-4">{column.purpose}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RemoteBaselineCursorProofCard({
  proof,
}: {
  proof: RemoteBaselineStageSchemaContract["cursor_proof"];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {proof.table_name}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            持久化状态：{proof.persist_status}
          </p>
        </div>
        <RemoteBaselineStageSchemaStatusPill status={proof.status} />
      </div>
      <RemoteBaselineSchemaColumnGroup
        title="必需游标字段"
        columns={proof.required_columns}
      />
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div>
          <div className="text-[10px] font-semibold text-zinc-400">
            单调递增规则
          </div>
          <ul className="mt-1 space-y-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {proof.monotonic_rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-zinc-400">
            幂等规则
          </div>
          <ul className="mt-1 space-y-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {proof.idempotency_rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

function RemoteBaselineStageSchemaGateRow({
  gate,
}: {
  gate: RemoteBaselineStageSchemaContract["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {localizeSyncDecisionText(gate.title)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {localizeSyncDecisionText(gate.evidence)}
          </p>
        </div>
        <RemoteBaselineStageSchemaStatusPill status={gate.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {localizeSyncDecisionText(gate.required_action)}
      </p>
    </article>
  );
}

function RemoteBaselineStageSchemaSqlRow({
  statement,
}: {
  statement: RemoteBaselineStageSchemaContract["sql_draft"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {statement.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {statement.id}
          </div>
        </div>
        <RemoteBaselineStageSchemaStatusPill status={statement.status} />
      </div>
      <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-white p-2 font-mono text-[10px] leading-4 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
        {statement.sql}
      </pre>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        应用状态：{statement.apply_status}。{statement.privacy_boundary}
      </p>
    </article>
  );
}

function RemoteBaselineStageSchemaStatusPill({
  status,
}: {
  status: RemoteBaselineStageSchemaStatus;
}) {
  const labels: Record<RemoteBaselineStageSchemaStatus, string> = {
    drafted: "已起草",
    "manual-confirmation": "确认",
    blocked: "阻塞",
  };

  const className =
    status === "blocked"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function RemoteBaselineStageReplayScenarioRow({
  scenario,
}: {
  scenario: RemoteBaselineStageReplayContract["scenarios"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {scenario.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {scenario.id}
          </div>
        </div>
        <RemoteBaselineStageReplayStatusPill status={scenario.status} />
      </div>
      <div className="mt-2 rounded-md bg-white px-2 py-1 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-300">
        测试夹具：{scenario.fixture_scope}
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        预期结果：{scenario.expected_result}
      </p>
      <p className="mt-2 leading-5 text-red-700 dark:text-red-300">
        禁止结果：{scenario.forbidden_result}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {scenario.evidence}
      </p>
    </article>
  );
}

function RemoteBaselineStageReplayGateRow({
  gate,
}: {
  gate: RemoteBaselineStageReplayContract["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {localizeSyncDecisionText(gate.title)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {gate.evidence}
          </p>
        </div>
        <RemoteBaselineStageReplayStatusPill status={gate.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function RemoteBaselineReplayFixtureValidationRow({
  check,
}: {
  check: RemoteBaselineReplayFixturePackage["validation_checks"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {check.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {check.id}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {check.evidence}
          </p>
        </div>
        <RemoteBaselineReplayFixtureStatusPill status={check.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {check.failure_condition}
      </p>
    </article>
  );
}

function RemoteBaselineReplayHarnessStepRow({
  step,
}: {
  step: RemoteBaselineReplayHarnessPreflight["steps"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {step.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {step.id} · {step.runner_status}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {step.expected_evidence}
          </p>
        </div>
        <RemoteBaselineReplayHarnessStatusPill status={step.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        输入：{step.input_source}。解除阻塞条件：{step.blocked_until}
      </p>
    </article>
  );
}

function RemoteBaselineReplayHarnessAssertionRow({
  assertion,
}: {
  assertion: RemoteBaselineReplayHarnessPreflight["assertions"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {assertion.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {assertion.id}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {assertion.assertion}
          </p>
        </div>
        <RemoteBaselineReplayHarnessStatusPill status={assertion.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {assertion.evidence}
      </p>
    </article>
  );
}

function RemoteBaselineReplayHarnessGateRow({
  gate,
}: {
  gate: RemoteBaselineReplayHarnessPreflight["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {gate.evidence}
          </p>
        </div>
        <RemoteBaselineReplayHarnessStatusPill status={gate.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function RemoteBaselineReplayRunnerEntryPointRow({
  entrypoint,
}: {
  entrypoint: RemoteBaselineReplayRunnerSkeleton["entrypoints"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {entrypoint.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {entrypoint.id} · {entrypoint.entry_kind}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {entrypoint.evidence}
          </p>
        </div>
        <RemoteBaselineReplayRunnerStatusPill status={entrypoint.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        目标：{entrypoint.target}。当前允许：
        {entrypoint.allowed_now ? "是" : "否"}。
      </p>
    </article>
  );
}

function RemoteBaselineReplayRunnerPhaseRow({
  phase,
}: {
  phase: RemoteBaselineReplayRunnerSkeleton["phases"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {phase.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {phase.id} · {phase.runner_stage}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {phase.expected_evidence}
          </p>
        </div>
        <RemoteBaselineReplayRunnerStatusPill status={phase.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        输入：{phase.input_source}。解除阻塞条件：{phase.blocked_until}
      </p>
    </article>
  );
}

function RemoteBaselineReplayRunnerRefusalRow({
  reason,
}: {
  reason: RemoteBaselineReplayRunnerSkeleton["refusal_reasons"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {reason.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {reason.id} · 拒绝 {reason.refused_action}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {reason.evidence}
          </p>
        </div>
        <RemoteBaselineReplayRunnerStatusPill status={reason.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {reason.required_before_enablement}
      </p>
    </article>
  );
}

function RemoteBaselineRlsProofRow({
  proof,
}: {
  proof: RemoteBaselineStageReplayContract["rls_proofs"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {proof.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {proof.id} · {proof.policy_target}
          </div>
        </div>
        <RemoteBaselineStageReplayStatusPill status={proof.status} />
      </div>
      <p className="mt-2 leading-5 text-green-700 dark:text-green-300">
        允许：{proof.allow_rule}
      </p>
      <p className="mt-2 leading-5 text-red-700 dark:text-red-300">
        拒绝：{proof.deny_rule}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {proof.proof_method}
      </p>
    </article>
  );
}

function RemoteBaselineRollbackProofRow({
  proof,
}: {
  proof: RemoteBaselineStageReplayContract["rollback_proofs"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {proof.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {proof.id}
          </div>
        </div>
        <RemoteBaselineStageReplayStatusPill status={proof.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        范围：{proof.rollback_scope}
      </p>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        恢复预期：{proof.expected_recovery}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        解除阻塞条件：{proof.blocked_until}
      </p>
    </article>
  );
}

function RemoteBaselineStageReplayStatusPill({
  status,
}: {
  status: RemoteBaselineStageReplayStatus;
}) {
  const labels: Record<RemoteBaselineStageReplayStatus, string> = {
    planned: "计划中",
    "manual-confirmation": "确认",
    blocked: "阻塞",
  };

  const className =
    status === "blocked"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function RemoteBaselineReplayFixtureStatusPill({
  status,
}: {
  status: RemoteBaselineReplayFixtureStatus;
}) {
  const labels: Record<RemoteBaselineReplayFixtureStatus, string> = {
    ready: "就绪",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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

function RemoteBaselineReplayHarnessStatusPill({
  status,
}: {
  status: RemoteBaselineReplayHarnessStatus;
}) {
  const labels: Record<RemoteBaselineReplayHarnessStatus, string> = {
    ready: "就绪",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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

function RemoteBaselineReplayRunnerStatusPill({
  status,
}: {
  status: RemoteBaselineReplayRunnerStatus;
}) {
  const labels: Record<RemoteBaselineReplayRunnerStatus, string> = {
    ready: "就绪",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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

function RemoteBaselineStageStatusPill({
  status,
}: {
  status: RemoteBaselineStagingStatus;
}) {
  const labels: Record<RemoteBaselineStagingStatus, string> = {
    planned: "计划中",
    "manual-confirmation": "确认",
    blocked: "阻塞",
  };

  const className =
    status === "blocked"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function RemoteBaselineStatusPill({
  status,
}: {
  status: RemoteBaselineRequestStatus;
}) {
  const labels: Record<RemoteBaselineRequestStatus, string> = {
    planned: "计划中",
    "manual-confirmation": "确认",
    blocked: "阻塞",
  };

  const className =
    status === "blocked"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function StageGateRow({ gate }: { gate: WebBetaStageGate }) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-zinc-400">
            {gate.stage_type} · {gate.source}
          </div>
        </div>
        <BetaStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {localizeSyncDecisionText(gate.current_state)}
      </p>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        Web Beta 前缺口：{localizeSyncDecisionText(gate.missing_before_web_beta)}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {localizeSyncDecisionText(gate.next_action)}
      </p>
    </article>
  );
}

function ResolutionStatusPill({
  status,
}: {
  status: SyncConflictResolutionStatus;
}) {
  const labels: Record<SyncConflictResolutionStatus, string> = {
    planned: "计划中",
    "manual-confirmation": "确认",
    blocked: "阻塞",
  };

  const className =
    status === "blocked"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function BetaGateRow({ gate }: { gate: WebBetaReadinessGate }) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {localizeSyncDecisionText(gate.title)}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-zinc-400">
            {gate.category}
          </div>
        </div>
        <BetaStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {localizeSyncDecisionText(gate.evidence)}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {localizeSyncDecisionText(gate.nextAction)}
      </p>
    </article>
  );
}

function BetaStatusPill({ status }: { status: WebBetaReadinessStatus }) {
  const labels: Record<WebBetaReadinessStatus, string> = {
    ready: "就绪",
    partial: "部分",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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
  id,
  title,
  className = "",
  children,
}: {
  id?: string;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
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
          已禁用桩接口
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
    "local-draft": "本地草案",
    planned: "计划中",
    required: "必需",
    "manual-confirmation": "确认",
    blocked: "阻塞",
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
                资源
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
                      {allowed ? "是" : "-"}
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
    { label: "活跃页面", value: preview.counts.activePages },
    { label: "回收站页面", value: preview.counts.deletedPages },
    { label: "页面版本", value: preview.counts.pageVersions },
    { label: "页面评论", value: preview.counts.pageComments },
    { label: "块评论", value: preview.counts.blockComments },
    { label: "数据库", value: preview.counts.databases },
    { label: "数据库字段", value: preview.counts.databaseFields },
    { label: "数据库行", value: preview.counts.databaseRows },
    { label: "数据库视图", value: preview.counts.databaseViews },
    { label: "上传文件", value: preview.counts.uploadedFiles },
    { label: "收藏页面", value: preview.counts.favoritePages },
    { label: "锁定页面", value: preview.counts.lockedPages },
  ];

  return (
    <div className="mt-4 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {fileName || "已选择备份"}
          </div>
          <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            格式 {preview.format || "未知"} · 版本{" "}
            {preview.formatVersion ?? "未知"} · 导出于{" "}
            {preview.exportedAt ? formatDate(preview.exportedAt) : "未知"}
          </div>
        </div>
        <span
          className={`w-fit rounded-md px-2 py-1 text-[10px] ${
            preview.valid
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {preview.valid ? "备份有效" : "需要检查"}
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
              title="问题"
              tone="issue"
              items={preview.issues}
            />
          )}
          {preview.warnings.length > 0 && (
            <RestoreMessageList
              title="警告"
              tone="warning"
              items={preview.warnings}
            />
          )}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          恢复写入会保持禁用，直到恢复合同被明确确认。
        </p>
        <button
          type="button"
          disabled
          className="w-fit cursor-not-allowed rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-400 dark:border-zinc-800"
        >
          恢复已禁用
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
      {busy ? "导出中..." : label}
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
  const labels: Record<ReadinessStatus, string> = {
    Ready: "就绪",
    Partial: "部分",
    Missing: "缺失",
    "Needs confirmation": "需确认",
  };

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
      {labels[status]}
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

function getCloudModuleCount(body: Record<string, unknown> | null) {
  const modules = body?.modules;
  return Array.isArray(modules) ? modules.length : 0;
}

function getCloudSyncState(body: Record<string, unknown> | null) {
  const sync = getRecordValue(body, "sync");
  return {
    push_enabled: getRecordBoolean(sync, "push_enabled"),
    pull_enabled: getRecordBoolean(sync, "pull_enabled"),
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
