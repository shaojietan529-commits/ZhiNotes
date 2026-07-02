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
  cacheRebuildBlocked: boolean;
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

const LOCAL_USE_READINESS_BOUNDARY: AccountLocalUseReadiness["boundary"] = {
  reads_page_body_text: false,
  reads_database_row_values: false,
  reads_file_bytes: false,
  uploads_workspace_data: false,
  mutates_workspace_data: false,
};

export function buildAccountLocalUseReadiness(input: {
  state: AccountCloudSyncReadinessState;
  pendingTotal: number;
  failedTotal: number;
  manualReviewTotal: number;
  retryableFailedTotal: number;
  enabledDomainCount: number;
}): AccountLocalUseReadiness {
  const base = {
    localInputCanContinue: true,
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
      cacheRebuildBlocked: true,
      label: "可继续写作，先处理同步队列",
      detail: detail || "同步队列需要处理；本地输入仍保留。",
      nextAction:
        "打开同步中心处理 failed / manual review，清零前不要重建本地缓存或做云端交接。",
    };
  }

  if (input.pendingTotal > 0) {
    return {
      ...base,
      status: "pending-upload",
      cloudHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，等待上传",
      detail: `${input.pendingTotal} 项本地变更已保留，正在等待后台上传或手动同步。`,
      nextAction:
        "继续写作可以；重建本地缓存或切换云端主库前，先让 pending 队列清零。",
    };
  }

  if (input.state === "signed-out") {
    return {
      ...base,
      status: "signed-out",
      cloudHandoffReady: false,
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
      cacheRebuildBlocked: true,
      label: "可继续写作，云端暂不可确认",
      detail: "账号或网络暂时不可确认；本地输入已保留，稍后重试。",
      nextAction: "先继续本地使用；等云端状态恢复后再做同步交接或缓存重建。",
    };
  }

  if (input.state === "checking") {
    return {
      ...base,
      status: "checking",
      cloudHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，正在检查同步状态",
      detail: "同步域已开启但仍在检查；不要在检查完成前重建本地缓存。",
      nextAction: "等待检查完成，或打开同步中心查看详情。",
    };
  }

  if (input.state === "syncing") {
    return {
      ...base,
      status: "syncing",
      cloudHandoffReady: false,
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
      cacheRebuildBlocked: false,
      label: "可本地使用，云同步未开启",
      detail: "当前内容按本地优先方式使用；云端不会自动接管。",
      nextAction: "需要多端同步时，先在账号页开启对应同步域。",
    };
  }

  return {
    ...base,
    status: "ready",
    cloudHandoffReady: true,
    cacheRebuildBlocked: false,
    label: "可继续写作，云端交接已就绪",
    detail: "当前没有 pending、failed 或 manual review 队列。",
    nextAction: "可以继续本地使用；如需重建缓存，仍按账号页确认流程执行。",
  };
}
