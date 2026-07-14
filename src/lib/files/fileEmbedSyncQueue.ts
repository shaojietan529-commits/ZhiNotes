"use client";

import {
  getStoredPageFile,
  type StoredPageFile,
} from "@/lib/files/localStore";
import { fetchFileEmbedSyncWithTimeout } from "@/lib/files/fileEmbedSyncClient";

export const FILE_EMBED_SYNC_QUEUE_STORAGE_KEY =
  "zhinote.fileembed.sync.queue.v1";
export const FILE_EMBED_SYNC_QUEUE_EVENT = "zhinote:fileembed-sync-queue";
export const FILE_EMBED_SYNC_AUTH_RETRY_STORAGE_KEY =
  "zhinote.fileembed.sync.auth-retry.v1";
const FILE_EMBED_MANUAL_REVIEW_FAILURE_THRESHOLD = 3;
const FILE_EMBED_AUTH_RETRY_BACKOFF_MS = 2 * 60 * 1000;

export type FileEmbedSyncQueueEntryStatus =
  | "pending"
  | "failed"
  | "manual_review";
export type FileEmbedSyncAuthRetryStatus =
  | "unauthenticated"
  | "unconfigured"
  | "unconfirmed";

export interface FileEmbedSyncQueueEntry {
  fileId: string;
  fileName: string;
  mimeType: string;
  kind: string;
  size: number;
  queuedAt: string;
  status: FileEmbedSyncQueueEntryStatus;
  failureCount: number;
  retryable: boolean;
  lastAttemptAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
}

export interface PendingFileEmbedSyncStatus {
  enabled: true;
  pending: number;
  failed: number;
  manualReviewCount: number;
  failureCountTotal: number;
  maxFailureCount: number;
  manualReviewFailureThreshold: number;
  oldestPendingQueuedAt: string | null;
  lastAttemptAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  pendingSampleIds: string[];
  failedSampleIds: string[];
  manualReviewSampleIds: string[];
  authRetryStatus: FileEmbedSyncAuthRetryStatus | null;
  authRetryUntil: string | null;
  storesFileBytes: false;
}

export interface DrainFileEmbedSyncQueueResult {
  attempted: number;
  synced: number;
  failed: number;
  manualReview: number;
  missingLocalFiles: number;
  authDeferred: number;
  message?: string;
}

export function markFileEmbedCloudSyncAttempt(file: StoredPageFile): void {
  const entries = readFileEmbedSyncQueue();
  const previous = entries[file.id];
  entries[file.id] = {
    ...entryFromStoredFile(file, previous),
    status:
      previous?.status === "manual_review" ? "manual_review" : "pending",
    lastAttemptAt: new Date().toISOString(),
  };
  writeFileEmbedSyncQueue(entries);
}

export function markFileEmbedCloudSyncSuccess(fileId: string): void {
  const entries = readFileEmbedSyncQueue();
  if (!entries[fileId]) return;
  delete entries[fileId];
  writeFileEmbedSyncQueue(entries);
}

export function markFileEmbedCloudSyncFailure(
  file: StoredPageFile,
  message: string,
  options: { retryable?: boolean } = {}
): void {
  const entries = readFileEmbedSyncQueue();
  const previous = entries[file.id];
  const failureCount = (previous?.failureCount ?? 0) + 1;
  const retryable = options.retryable ?? true;
  const status: FileEmbedSyncQueueEntryStatus =
    !retryable || failureCount >= FILE_EMBED_MANUAL_REVIEW_FAILURE_THRESHOLD
      ? "manual_review"
      : "failed";
  entries[file.id] = {
    ...entryFromStoredFile(file, previous),
    status,
    failureCount,
    retryable,
    lastFailureAt: new Date().toISOString(),
    lastFailureMessage: message,
  };
  writeFileEmbedSyncQueue(entries);
}

export function markFileEmbedCloudSyncDeferred(
  file: StoredPageFile,
  message: string,
  status: FileEmbedSyncAuthRetryStatus
): void {
  const entries = readFileEmbedSyncQueue();
  const previous = entries[file.id];
  entries[file.id] = {
    ...entryFromStoredFile(file, previous),
    status: "pending",
    retryable: true,
    lastFailureAt: new Date().toISOString(),
    lastFailureMessage: message,
  };
  rememberFileEmbedAuthRetryStatus(status);
  writeFileEmbedSyncQueue(entries);
}

export function getPendingFileEmbedSyncStatus(): PendingFileEmbedSyncStatus {
  const entries = Object.values(readFileEmbedSyncQueue());
  const pending = entries.filter((entry) => entry.status === "pending");
  const failed = entries.filter((entry) => entry.status === "failed");
  const manualReview = entries.filter(
    (entry) => entry.status === "manual_review"
  );
  const authRetry = getFileEmbedAuthRetrySnapshot();
  return {
    enabled: true,
    pending: pending.length,
    failed: failed.length,
    manualReviewCount: manualReview.length,
    failureCountTotal: entries.reduce(
      (sum, entry) => sum + entry.failureCount,
      0
    ),
    maxFailureCount: entries.reduce(
      (max, entry) => Math.max(max, entry.failureCount),
      0
    ),
    manualReviewFailureThreshold: FILE_EMBED_MANUAL_REVIEW_FAILURE_THRESHOLD,
    oldestPendingQueuedAt: oldestDate(pending.map((entry) => entry.queuedAt)),
    lastAttemptAt: newestDate(
      entries.map((entry) => entry.lastAttemptAt).filter(Boolean)
    ),
    lastFailureAt: newestDate(
      entries.map((entry) => entry.lastFailureAt).filter(Boolean)
    ),
    lastFailureMessage:
      entries
        .filter((entry) => entry.lastFailureMessage)
        .sort((a, b) =>
          (b.lastFailureAt ?? "").localeCompare(a.lastFailureAt ?? "")
        )[0]?.lastFailureMessage ?? null,
    pendingSampleIds: pending.slice(0, 5).map((entry) => entry.fileId),
    failedSampleIds: failed.slice(0, 5).map((entry) => entry.fileId),
    manualReviewSampleIds: manualReview
      .slice(0, 5)
      .map((entry) => entry.fileId),
    authRetryStatus: authRetry.status,
    authRetryUntil: authRetry.until,
    storesFileBytes: false,
  };
}

export function classifyFileEmbedCloudSyncAuthDeferral(
  responseStatus: number,
  payload: { error?: string; reason?: string; retryable?: boolean } = {}
): FileEmbedSyncAuthRetryStatus | null {
  if (responseStatus === 401 || payload.error === "auth-required") {
    return "unauthenticated";
  }
  if (responseStatus === 501 || payload.error === "account-not-configured") {
    return "unconfigured";
  }
  if (
    responseStatus === 503 &&
    (payload.reason === "session-unconfirmed" ||
      payload.retryable === true)
  ) {
    return "unconfirmed";
  }
  return null;
}

export async function drainPendingFileEmbedSyncQueue(
  options: { includeManualReview?: boolean; limit?: number } = {}
): Promise<DrainFileEmbedSyncQueueResult> {
  const entries = Object.values(readFileEmbedSyncQueue()).filter((entry) => {
    if (entry.status === "pending" || entry.status === "failed") return true;
    return options.includeManualReview === true;
  });
  const limit = Math.max(1, Math.min(options.limit ?? 5, 10));
  let attempted = 0;
  let synced = 0;
  let failed = 0;
  let manualReview = 0;
  let missingLocalFiles = 0;
  let authDeferred = 0;

  for (const entry of entries.slice(0, limit)) {
    const stored = await getStoredPageFile(entry.fileId);
    if (!stored) {
      missingLocalFiles += 1;
      markMissingLocalFile(entry);
      manualReview += 1;
      continue;
    }
    attempted += 1;
    markFileEmbedCloudSyncAttempt(stored);
    try {
      const res = await fetchFileEmbedSyncWithTimeout({
        action: "push",
        fileId: stored.id,
        fileName: stored.name,
        mimeType: stored.mimeType,
        kind: stored.kind,
        size: stored.size,
        dataUrl: stored.dataUrl,
        textContent: stored.textContent ?? null,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
          reason?: string;
          retryable?: boolean;
        };
        const message =
          data.message ??
          data.error ??
          "文件云同步失败；文件仍保存在本地。";
        const authDeferral = classifyFileEmbedCloudSyncAuthDeferral(
          res.status,
          data
        );
        if (authDeferral) {
          markFileEmbedCloudSyncDeferred(stored, message, authDeferral);
          authDeferred += 1;
          continue;
        }
        markFileEmbedCloudSyncFailure(stored, message, {
          retryable: res.status !== 413,
        });
        failed += 1;
        continue;
      }
      markFileEmbedCloudSyncSuccess(stored.id);
      rememberFileEmbedAuthRetryStatus(null);
      synced += 1;
    } catch (error) {
      markFileEmbedCloudSyncFailure(stored, fileEmbedSyncErrorMessage(error));
      failed += 1;
    }
  }

  return {
    attempted,
    synced,
    failed,
    manualReview,
    missingLocalFiles,
    authDeferred,
  };
}

function entryFromStoredFile(
  file: StoredPageFile,
  previous?: FileEmbedSyncQueueEntry
): FileEmbedSyncQueueEntry {
  return {
    fileId: file.id,
    fileName: file.name,
    mimeType: file.mimeType,
    kind: file.kind,
    size: file.size,
    queuedAt: previous?.queuedAt ?? new Date().toISOString(),
    status: previous?.status ?? "pending",
    failureCount: previous?.failureCount ?? 0,
    retryable: previous?.retryable ?? true,
    lastAttemptAt: previous?.lastAttemptAt ?? null,
    lastFailureAt: previous?.lastFailureAt ?? null,
    lastFailureMessage: previous?.lastFailureMessage ?? null,
  };
}

function markMissingLocalFile(entry: FileEmbedSyncQueueEntry): void {
  const entries = readFileEmbedSyncQueue();
  entries[entry.fileId] = {
    ...entry,
    status: "manual_review",
    retryable: false,
    failureCount: Math.max(
      entry.failureCount + 1,
      FILE_EMBED_MANUAL_REVIEW_FAILURE_THRESHOLD
    ),
    lastFailureAt: new Date().toISOString(),
    lastFailureMessage:
      "本地文件副本不可用；不会自动重建或上传，请确认原文件后手动处理。",
  };
  writeFileEmbedSyncQueue(entries);
}

function fileEmbedSyncErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "文件云同步失败；文件仍保存在本地。";
}

function readFileEmbedSyncQueue(): Record<string, FileEmbedSyncQueueEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FILE_EMBED_SYNC_QUEUE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FileEmbedSyncQueueEntry>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeFileEmbedSyncQueue(
  entries: Record<string, FileEmbedSyncQueueEntry>
): void {
  if (typeof window === "undefined") return;
  try {
    const values = Object.values(entries);
    if (values.length === 0) {
      window.localStorage.removeItem(FILE_EMBED_SYNC_QUEUE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        FILE_EMBED_SYNC_QUEUE_STORAGE_KEY,
        JSON.stringify(
          Object.fromEntries(values.map((entry) => [entry.fileId, entry]))
        )
      );
    }
    window.dispatchEvent(
      new CustomEvent(FILE_EMBED_SYNC_QUEUE_EVENT, {
        detail: getPendingFileEmbedSyncStatus(),
      })
    );
  } catch {
    // Queue visibility is best-effort; the IndexedDB file copy remains intact.
  }
}

function rememberFileEmbedAuthRetryStatus(
  status: FileEmbedSyncAuthRetryStatus | null
): void {
  if (typeof window === "undefined") return;
  try {
    if (status) {
      window.localStorage.setItem(
        FILE_EMBED_SYNC_AUTH_RETRY_STORAGE_KEY,
        JSON.stringify({
          status,
          until: Date.now() + FILE_EMBED_AUTH_RETRY_BACKOFF_MS,
        })
      );
    } else {
      window.localStorage.removeItem(FILE_EMBED_SYNC_AUTH_RETRY_STORAGE_KEY);
    }
  } catch {
    // Auth retry visibility is best-effort; the pending file queue remains intact.
  }
  window.dispatchEvent(
    new CustomEvent(FILE_EMBED_SYNC_QUEUE_EVENT, {
      detail: getPendingFileEmbedSyncStatus(),
    })
  );
}

function getFileEmbedAuthRetrySnapshot(): {
  status: FileEmbedSyncAuthRetryStatus | null;
  until: string | null;
} {
  if (typeof window === "undefined") return { status: null, until: null };
  try {
    const raw = window.localStorage.getItem(
      FILE_EMBED_SYNC_AUTH_RETRY_STORAGE_KEY
    );
    if (!raw) return { status: null, until: null };
    const parsed = JSON.parse(raw) as {
      status?: unknown;
      until?: unknown;
    };
    if (typeof parsed.until !== "number" || parsed.until <= Date.now()) {
      window.localStorage.removeItem(FILE_EMBED_SYNC_AUTH_RETRY_STORAGE_KEY);
      return { status: null, until: null };
    }
    if (
      parsed.status !== "unauthenticated" &&
      parsed.status !== "unconfigured" &&
      parsed.status !== "unconfirmed"
    ) {
      window.localStorage.removeItem(FILE_EMBED_SYNC_AUTH_RETRY_STORAGE_KEY);
      return { status: null, until: null };
    }
    return {
      status: parsed.status,
      until: new Date(parsed.until).toISOString(),
    };
  } catch {
    try {
      window.localStorage.removeItem(FILE_EMBED_SYNC_AUTH_RETRY_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
    return { status: null, until: null };
  }
}

function oldestDate(values: Array<string | null>): string | null {
  const filtered = values.filter((value): value is string => Boolean(value));
  return filtered.sort()[0] ?? null;
}

function newestDate(values: Array<string | null>): string | null {
  const filtered = values.filter((value): value is string => Boolean(value));
  return filtered.sort().at(-1) ?? null;
}
