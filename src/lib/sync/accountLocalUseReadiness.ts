export type AccountCloudSyncReadinessState =
  | "disabled"
  | "checking"
  | "syncing"
  | "synced"
  | "queued"
  | "attention"
  | "signed-out"
  | "error";

export type AccountLocalUseReadinessStatus =
  | "ready"
  | "local-only"
  | "checking"
  | "syncing"
  | "pending-upload"
  | "needs-review"
  | "signed-out"
  | "cloud-uncertain";

export interface AccountLocalUseReadiness {
  status: AccountLocalUseReadinessStatus;
  localInputCanContinue: true;
  cloudHandoffReady: boolean;
  deviceHandoffReady: boolean;
  cacheRebuildBlocked: boolean;
  queueBreakdown: AccountLocalUseQueueBreakdown;
  requiredCloudDomains: AccountLocalUseRequiredCloudDomain[];
  handoffBlockers: string[];
  label: string;
  detail: string;
  nextAction: string;
  boundary: {
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    uploads_workspace_data: false;
    mutates_workspace_data: false;
  };
}

export interface AccountLocalUseQueueBreakdown {
  pagePendingTotal: number;
  databasePendingTotal: number;
  filePendingTotal: number;
  settingsPendingTotal: number;
  knowledgePendingTotal: number;
  portfolioPendingTotal: number;
  portfolioFailedTotal: number;
  portfolioManualReviewTotal: number;
  portfolioQueueTotal: number;
  portfolioQueueBlocksCloudHandoff: boolean;
  otherPendingTotal: number;
  otherFailedTotal: number;
  otherManualReviewTotal: number;
  fileFailedTotal: number;
  fileManualReviewTotal: number;
  fileQueueTotal: number;
  fileQueueBlocksCloudHandoff: boolean;
}

export interface AccountLocalUseRequiredCloudDomain {
  id: "pages" | "databases";
  label: string;
  enabled: boolean;
  scope: string;
}

const LOCAL_USE_READINESS_BOUNDARY: AccountLocalUseReadiness["boundary"] = {
  reads_page_body_text: false,
  reads_database_row_values: false,
  reads_file_bytes: false,
  uploads_workspace_data: false,
  mutates_workspace_data: false,
};

interface AccountLocalUseReadinessInput {
  state: AccountCloudSyncReadinessState;
  pendingTotal: number;
  failedTotal: number;
  manualReviewTotal: number;
  retryableFailedTotal: number;
  enabledDomainCount: number;
  pagePendingTotal?: number;
  databasePendingTotal?: number;
  filePendingTotal?: number;
  settingsPendingTotal?: number;
  knowledgePendingTotal?: number;
  otherPendingTotal?: number;
  otherFailedTotal?: number;
  otherManualReviewTotal?: number;
  fileFailedTotal?: number;
  fileManualReviewTotal?: number;
  portfolioPendingTotal?: number;
  portfolioFailedTotal?: number;
  portfolioManualReviewTotal?: number;
  pageSyncEnabled?: boolean;
  databaseSyncEnabled?: boolean;
  authRetryDomainLabel?: string;
  authRetryUnconfiguredDomainLabel?: string;
  authRetryUnconfirmedDomainLabel?: string;
  authRetryUntilLabel?: string | null;
}

function safeCount(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value ?? 0));
}

function buildAccountLocalUseQueueBreakdown(
  input: AccountLocalUseReadinessInput
): AccountLocalUseQueueBreakdown {
  const pagePendingTotal = safeCount(input.pagePendingTotal);
  const databasePendingTotal = safeCount(input.databasePendingTotal);
  const filePendingTotal = safeCount(input.filePendingTotal);
  const settingsPendingTotal = safeCount(input.settingsPendingTotal);
  const knowledgePendingTotal = safeCount(input.knowledgePendingTotal);
  const portfolioPendingTotal = safeCount(input.portfolioPendingTotal);
  const providedOtherPendingTotal = safeCount(input.otherPendingTotal);
  const classifiedPendingTotal =
    pagePendingTotal +
    databasePendingTotal +
    filePendingTotal +
    settingsPendingTotal +
    knowledgePendingTotal +
    portfolioPendingTotal +
    providedOtherPendingTotal;
  const otherPendingTotal =
    providedOtherPendingTotal +
    Math.max(safeCount(input.pendingTotal) - classifiedPendingTotal, 0);
  const fileFailedTotal = safeCount(input.fileFailedTotal);
  const fileManualReviewTotal = safeCount(input.fileManualReviewTotal);
  const portfolioFailedTotal = safeCount(input.portfolioFailedTotal);
  const portfolioManualReviewTotal = safeCount(
    input.portfolioManualReviewTotal
  );
  const otherFailedTotal = safeCount(input.otherFailedTotal);
  const otherManualReviewTotal = safeCount(input.otherManualReviewTotal);
  const fileQueueTotal =
    filePendingTotal + fileFailedTotal + fileManualReviewTotal;
  const portfolioQueueTotal =
    portfolioPendingTotal + portfolioFailedTotal + portfolioManualReviewTotal;

  return {
    pagePendingTotal,
    databasePendingTotal,
    filePendingTotal,
    settingsPendingTotal,
    knowledgePendingTotal,
    portfolioPendingTotal,
    portfolioFailedTotal,
    portfolioManualReviewTotal,
    portfolioQueueTotal,
    portfolioQueueBlocksCloudHandoff: portfolioQueueTotal > 0,
    otherPendingTotal,
    otherFailedTotal,
    otherManualReviewTotal,
    fileFailedTotal,
    fileManualReviewTotal,
    fileQueueTotal,
    fileQueueBlocksCloudHandoff: fileQueueTotal > 0,
  };
}

function formatQueueBreakdown(breakdown: AccountLocalUseQueueBreakdown) {
  const pendingParts = [
    breakdown.pagePendingTotal > 0
      ? `页面 ${breakdown.pagePendingTotal}`
      : null,
    breakdown.databasePendingTotal > 0
      ? `数据库 ${breakdown.databasePendingTotal}`
      : null,
    breakdown.filePendingTotal > 0
      ? `文件 ${breakdown.filePendingTotal}`
      : null,
    breakdown.settingsPendingTotal > 0
      ? `设置 ${breakdown.settingsPendingTotal}`
      : null,
    breakdown.knowledgePendingTotal > 0
      ? `知识库 ${breakdown.knowledgePendingTotal}`
      : null,
    breakdown.portfolioPendingTotal > 0
      ? `组合 ${breakdown.portfolioPendingTotal}`
      : null,
    breakdown.otherPendingTotal > 0 ? `其他 ${breakdown.otherPendingTotal}` : null,
  ].filter(Boolean);
  const fileAttentionParts = [
    breakdown.fileFailedTotal > 0
      ? `文件失败 ${breakdown.fileFailedTotal}`
      : null,
    breakdown.fileManualReviewTotal > 0
      ? `文件需确认 ${breakdown.fileManualReviewTotal}`
      : null,
  ].filter(Boolean);
  const portfolioAttentionParts = [
    breakdown.portfolioFailedTotal > 0
      ? `组合失败 ${breakdown.portfolioFailedTotal}`
      : null,
    breakdown.portfolioManualReviewTotal > 0
      ? `组合需确认 ${breakdown.portfolioManualReviewTotal}`
      : null,
  ].filter(Boolean);
  const otherAttentionParts = [
    breakdown.otherFailedTotal > 0
      ? `其他失败 ${breakdown.otherFailedTotal}`
      : null,
    breakdown.otherManualReviewTotal > 0
      ? `其他需确认 ${breakdown.otherManualReviewTotal}`
      : null,
  ].filter(Boolean);
  const parts = [
    pendingParts.length > 0 ? `队列分布：${pendingParts.join(" / ")}` : null,
    fileAttentionParts.length > 0
      ? `文件队列：${fileAttentionParts.join(" / ")}`
      : null,
    portfolioAttentionParts.length > 0
      ? `组合队列：${portfolioAttentionParts.join(" / ")}`
      : null,
    otherAttentionParts.length > 0
      ? `其他队列：${otherAttentionParts.join(" / ")}`
      : null,
  ].filter(Boolean);
  return parts.join("；");
}

function formatAuthRetryDetail(input: AccountLocalUseReadinessInput) {
  const domainLabel = input.authRetryDomainLabel?.trim();
  if (!domainLabel) return "";
  const unconfiguredDomainLabel =
    input.authRetryUnconfiguredDomainLabel?.trim();
  if (unconfiguredDomainLabel) {
    return `云端未配置：${unconfiguredDomainLabel}；这不是登出，本地输入已保留，配置完成后再补传${
      input.authRetryUntilLabel ? `，下次检查 ${input.authRetryUntilLabel}` : ""
    }`;
  }
  const unconfirmedDomainLabel = input.authRetryUnconfirmedDomainLabel?.trim();
  if (unconfirmedDomainLabel) {
    return `账号临时不可确认：${unconfirmedDomainLabel}；本地输入已保留，不会因此自动登出${
      input.authRetryUntilLabel ? `，下次重试 ${input.authRetryUntilLabel}` : ""
    }`;
  }
  return `账号重试：${domainLabel}${
    input.authRetryUntilLabel ? `，下次 ${input.authRetryUntilLabel}` : ""
  }`;
}

function buildRequiredCloudDomains(
  input: AccountLocalUseReadinessInput
): AccountLocalUseRequiredCloudDomain[] {
  return [
    {
      id: "pages",
      label: "页面 / 每日纪要 / ZhiHui",
      enabled: Boolean(input.pageSyncEnabled),
      scope: "标题、正文、层级、属性、每日纪要和会议页 metadata",
    },
    {
      id: "databases",
      label: "数据库",
      enabled: Boolean(input.databaseSyncEnabled),
      scope: "数据库结构、字段、视图和行值",
    },
  ];
}

function buildDeviceHandoffBlockers(input: {
  source: AccountLocalUseReadinessInput;
  requiredCloudDomains: AccountLocalUseRequiredCloudDomain[];
}): string[] {
  const blockers: string[] = [];
  const missingRequiredDomains = input.requiredCloudDomains
    .filter((domain) => !domain.enabled)
    .map((domain) => domain.label);
  if (missingRequiredDomains.length > 0) {
    blockers.push(`核心云同步域未就绪：${missingRequiredDomains.join("、")}`);
  }
  if (input.source.pendingTotal > 0) {
    blockers.push(`还有 ${input.source.pendingTotal} 项本地变更等待云端 ACK`);
  }
  if (input.source.failedTotal > 0) {
    blockers.push(`还有 ${input.source.failedTotal} 项同步失败`);
  }
  if (input.source.manualReviewTotal > 0) {
    blockers.push(`还有 ${input.source.manualReviewTotal} 项需要人工确认`);
  }
  const authRetryDomainLabel = input.source.authRetryDomainLabel?.trim();
  if (authRetryDomainLabel) {
    blockers.push(`账号或云端暂时不可确认：${authRetryDomainLabel}`);
  }
  if (input.source.state === "signed-out") {
    blockers.push("当前账号未确认登录");
  }
  if (input.source.state === "error") {
    blockers.push("云端状态暂不可确认");
  }
  if (input.source.state === "checking") {
    blockers.push("同步状态仍在检查");
  }
  if (input.source.state === "syncing") {
    blockers.push("后台同步仍在进行");
  }
  if (input.source.enabledDomainCount === 0 || input.source.state === "disabled") {
    blockers.push("云同步未开启");
  }
  return Array.from(new Set(blockers));
}

export function buildAccountLocalUseReadiness(
  input: AccountLocalUseReadinessInput
): AccountLocalUseReadiness {
  const queueBreakdown = buildAccountLocalUseQueueBreakdown(input);
  const requiredCloudDomains = buildRequiredCloudDomains(input);
  const requiredCloudDomainsReady = requiredCloudDomains.every(
    (domain) => domain.enabled
  );
  const handoffBlockers = buildDeviceHandoffBlockers({
    source: input,
    requiredCloudDomains,
  });
  const queueDetail = formatQueueBreakdown(queueBreakdown);
  const authRetryDetail = formatAuthRetryDetail(input);
  const withQueueDetail = (detail: string) =>
    [detail, authRetryDetail, queueDetail].filter(Boolean).join("；");
  const base = {
    localInputCanContinue: true,
    queueBreakdown,
    requiredCloudDomains,
    handoffBlockers,
    deviceHandoffReady: false,
    boundary: LOCAL_USE_READINESS_BOUNDARY,
  } as const;

  if (input.failedTotal > 0 || input.manualReviewTotal > 0) {
    const failedPart =
      input.retryableFailedTotal > 0
        ? `${input.retryableFailedTotal} 项可重试失败`
        : null;
    const manualPart =
      input.manualReviewTotal > 0
        ? `${input.manualReviewTotal} 项需要人工确认`
        : null;
    const detail = [failedPart, manualPart].filter(Boolean).join("，");
    return {
      ...base,
      status: "needs-review",
      cloudHandoffReady: false,
      deviceHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，先处理同步队列",
      detail: withQueueDetail(detail || "同步队列需要处理；本地输入仍保留。"),
      nextAction:
        "打开同步中心处理 failed / manual review，清零前不要重建本地缓存或做云端交接。",
    };
  }

  if (input.pendingTotal > 0) {
    return {
      ...base,
      status: "pending-upload",
      cloudHandoffReady: false,
      deviceHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，等待上传",
      detail: withQueueDetail(
        `${input.pendingTotal} 项本地变更已保留，正在等待后台上传或手动同步。`
      ),
      nextAction:
        "继续写作可以；重建本地缓存或切换云端主库前，先让 pending 队列清零。",
    };
  }

  if (input.state === "signed-out") {
    return {
      ...base,
      status: "signed-out",
      cloudHandoffReady: false,
      deviceHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续本地写作，登录后同步",
      detail: "当前无法确认账号；本地输入不会因此被清空。",
      nextAction: "登录后再上传本地队列或执行云端缓存重建。",
    };
  }

  if (input.state === "error") {
    return {
      ...base,
      status: "cloud-uncertain",
      cloudHandoffReady: false,
      deviceHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，云端暂不可确认",
      detail: withQueueDetail(
        "账号或网络暂时不可确认；本地输入已保留，后台会低频重试。"
      ),
      nextAction: "先继续本地使用；等云端低频检查恢复后再做同步交接或缓存重建。",
    };
  }

  if (input.state === "checking") {
    return {
      ...base,
      status: "checking",
      cloudHandoffReady: false,
      deviceHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，正在检查同步状态",
      detail: withQueueDetail(
        "同步域已开启但仍在检查；不要在检查完成前重建本地缓存。"
      ),
      nextAction: "等待检查完成，或打开同步中心查看详情。",
    };
  }

  if (input.state === "syncing") {
    return {
      ...base,
      status: "syncing",
      cloudHandoffReady: false,
      deviceHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，正在同步",
      detail: "后台正在补传本地队列；输入仍然本地优先保存。",
      nextAction: "等待同步完成后再做缓存重建或云端交接。",
    };
  }

  if (input.enabledDomainCount === 0 || input.state === "disabled") {
    return {
      ...base,
      status: "local-only",
      cloudHandoffReady: false,
      deviceHandoffReady: false,
      cacheRebuildBlocked: false,
      label: "可本地使用，云同步未开启",
      detail: "当前内容按本地优先方式使用；云端不会自动接管。",
      nextAction: "需要多端同步时，先在账号页开启对应同步域。",
    };
  }

  if (!requiredCloudDomainsReady) {
    const missingRequiredDomains = requiredCloudDomains
      .filter((domain) => !domain.enabled)
      .map((domain) => domain.label)
      .join("、");
    return {
      ...base,
      status: "local-only",
      cloudHandoffReady: false,
      deviceHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，先补齐核心云同步",
      detail: withQueueDetail(
        `核心同步域未全部就绪：${missingRequiredDomains}。本机仍可写，但不能把另一台设备当作最新版本。`
      ),
      nextAction:
        "先确认账号页页面和数据库云同步已开启，并处理账号/KV/邮件环境与 pending 队列；等队列清零后，再做跨设备接力或缓存重建。",
    };
  }

  return {
    ...base,
    status: "ready",
    cloudHandoffReady: handoffBlockers.length === 0,
    deviceHandoffReady: handoffBlockers.length === 0,
    cacheRebuildBlocked: false,
    label: "可继续写作，云端交接已就绪",
    detail: "当前没有 pending、failed 或 manual review 队列。",
    nextAction: "可以继续本地使用；如需重建缓存，仍按账号页确认流程执行。",
  };
}
