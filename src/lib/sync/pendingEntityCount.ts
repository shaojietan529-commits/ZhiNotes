type PendingEntityStatus = {
  pending: number;
  queued: number;
  syncLogPending?: number;
  uniquePending?: number;
};

// Queue entries and durable log rows describe the same edits. Keep raw
// counters for diagnostics, but show the union of entity IDs to the user.
export function pendingEntityCount(status: PendingEntityStatus): number {
  return status.uniquePending ??
    (Math.max(status.pending, status.queued) + (status.syncLogPending ?? 0));
}
