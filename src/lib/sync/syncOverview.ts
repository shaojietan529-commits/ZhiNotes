export type SyncOverviewState =
  | "checking" | "idle" | "synced" | "queued" | "syncing"
  | "offline" | "signed-out" | "attention" | "disabled";

export interface SyncOverviewDomain {
  id: string;
  label: string;
  pending: number;
  failed: number;
  manualReview: number;
  enabled: boolean;
  known: boolean;
  syncing?: boolean;
  readError?: boolean;
  auth?: string | null;
  lastConfirmedAt?: string | null;
  oldestPendingAt?: string | null;
  failureMessage?: string | null;
}

function failureDetail(message: string | null | undefined) {
  // Match categories only; never display raw service messages or user content.
  if (/403|forbidden|permission|denied|权限/i.test(message ?? "")) {
    return "云端拒绝了这次写入，需检查账号归属或权限；重试不会扩大权限。";
  }
  if (/413|too large|payload.*size|过大|超出.*大小/i.test(message ?? "")) {
    return "内容超过当前上传大小限制，需在详情中检查对应记录。";
  }
  if (/timeout|network|fetch|timed out|网络|超时/i.test(message ?? "")) {
    return "网络请求未成功，后台会重试；未收到云端确认前保留本地记录。";
  }
  if (/ack|确认回执|未确认/i.test(message ?? "")) {
    return "尚未收到有效的云端确认，因此保留待上传记录。";
  }
  return "最近上传未成功；普通重试不会处理需要人工确认的记录。";
}

export function describeSyncDomain(domain: SyncOverviewDomain, online: boolean) {
  const { failureMessage, ...metadata } = domain;
  const result = (state: SyncOverviewState, label: string, detail: string) => ({
    ...metadata, state, statusLabel: label, detail,
  });
  if (domain.readError) {
    return result("attention", "状态读取失败", "本地记录未改动，暂时不能确认待上传数量。");
  }
  if (domain.manualReview > 0) {
    return result("attention", "需要确认", "存在内容冲突或多次失败的记录，自动同步不会覆盖它们。");
  }
  if (!domain.known) return result("checking", "检查中", "正在核对本地待上传记录。");
  if (!domain.enabled) {
    return result(domain.pending ? "attention" : "disabled", "未开启",
      domain.pending ? "仍有本地记录等待上传，需先检查该项同步设置。" : "此项未开启云同步。");
  }
  if (domain.auth === "unauthenticated") {
    return result("signed-out", "需要登录", "登录同一账号后继续，本地待上传记录不会被清除。");
  }
  if (domain.auth === "unconfigured") {
    return result("attention", "服务未就绪", "此项云端服务配置未就绪，不是页面编辑权限问题。");
  }
  if (!online) return result("offline", "离线", "等待网络恢复后继续同步。");
  if (domain.auth === "unconfirmed") {
    return result("checking", "账号确认中", "暂时无法确认登录状态，后台会重试。");
  }
  if (domain.failed > 0) {
    return result("attention", "上传未成功", failureDetail(failureMessage));
  }
  if (domain.syncing) return result("syncing", "同步中", "正在与云端核对，本地记录保留至云端确认。");
  if (domain.pending > 0) return result("queued", "待上传", "本地改动正在等待云端确认，不代表发生故障。");
  if (domain.lastConfirmedAt) return result("synced", "无待上传", "当前本地队列为空，已有云端成功记录。");
  return result("idle", "无待上传", "当前本地队列为空；尚无可用的云端成功时间。");
}

export function buildSyncOverview(domains: SyncOverviewDomain[], online: boolean) {
  const rows = domains.map((domain) => describeSyncDomain(domain, online));
  const priority: SyncOverviewState[] = [
    "attention", "signed-out", "offline", "checking", "syncing", "queued",
  ];
  const state = priority.find((value) => rows.some((row) => row.state === value))
    ?? (rows.every((row) => row.state === "disabled") ? "disabled" : "idle");
  const labels: Record<SyncOverviewState, string> = {
    attention: "有项目需要处理", "signed-out": "需要登录后继续",
    offline: "当前离线", checking: "正在确认同步状态", syncing: "正在同步",
    queued: "有本地改动待上传", disabled: "云同步未开启",
    idle: "当前没有待上传记录", synced: "当前没有待上传记录",
  };
  return {
    rows, state, label: labels[state],
    pending: rows.reduce((sum, row) => sum + row.pending, 0),
    countsKnown: rows.every((row) => row.known && !row.readError),
  };
}
