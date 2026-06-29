export const LOCAL_PERFORMANCE_EVENT = "zhinote:local-performance";
export const LOCAL_PERFORMANCE_STORAGE_KEY =
  "zhinote.localPerformance.snapshots.v1";

const MAX_LOCAL_PERFORMANCE_SNAPSHOTS = 24;

export type LocalPerformanceKind =
  | "daily-calendar"
  | "meeting-calendar"
  | "database-row-open"
  | "page-open"
  | "page-body-hydration"
  | "page-peek";

export interface LocalPerformanceBoundary {
  reads_page_body_text: false;
  reads_database_row_values: false;
  reads_comment_bodies: false;
  reads_file_bytes: false;
  uploads_workspace_data: false;
  mutates_workspace_data: false;
  includes_raw_page_id: false;
  includes_page_title: false;
}

export interface LocalPerformanceSnapshot {
  format: "zhinote-local-performance-snapshot";
  format_version: 1;
  id: string;
  kind: LocalPerformanceKind;
  label: string;
  route: string;
  status: string;
  started_at: string;
  recorded_at: string;
  duration_ms: number;
  local_first_ms: number | null;
  background_ms: number | null;
  counts: Record<string, number>;
  boundary: LocalPerformanceBoundary;
}

export interface LocalPerformanceSnapshotInput {
  kind: LocalPerformanceKind;
  label: string;
  route: string;
  status: string;
  startedAt?: string;
  durationMs: number;
  localFirstMs?: number | null;
  backgroundMs?: number | null;
  counts?: Record<string, number | null | undefined>;
}

const LOCAL_PERFORMANCE_BOUNDARY: LocalPerformanceBoundary = {
  reads_page_body_text: false,
  reads_database_row_values: false,
  reads_comment_bodies: false,
  reads_file_bytes: false,
  uploads_workspace_data: false,
  mutates_workspace_data: false,
  includes_raw_page_id: false,
  includes_page_title: false,
};

export function getLocalPerformanceNow(): number {
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now();
  }
  return Date.now();
}

export function readLocalPerformanceSnapshots(): LocalPerformanceSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_PERFORMANCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLocalPerformanceSnapshot).slice(
      0,
      MAX_LOCAL_PERFORMANCE_SNAPSHOTS
    );
  } catch {
    return [];
  }
}

export function recordLocalPerformanceSnapshot(
  input: LocalPerformanceSnapshotInput
): LocalPerformanceSnapshot | null {
  if (typeof window === "undefined") return null;
  const snapshot: LocalPerformanceSnapshot = {
    format: "zhinote-local-performance-snapshot",
    format_version: 1,
    id: `perf_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    kind: input.kind,
    label: input.label,
    route: input.route,
    status: input.status,
    started_at: input.startedAt ?? new Date().toISOString(),
    recorded_at: new Date().toISOString(),
    duration_ms: roundMs(input.durationMs) ?? 0,
    local_first_ms: roundMs(input.localFirstMs),
    background_ms: roundMs(input.backgroundMs),
    counts: normalizeCounts(input.counts),
    boundary: LOCAL_PERFORMANCE_BOUNDARY,
  };

  try {
    const snapshots = [snapshot, ...readLocalPerformanceSnapshots()].slice(
      0,
      MAX_LOCAL_PERFORMANCE_SNAPSHOTS
    );
    window.localStorage.setItem(
      LOCAL_PERFORMANCE_STORAGE_KEY,
      JSON.stringify(snapshots)
    );
    window.dispatchEvent(
      new CustomEvent<LocalPerformanceSnapshot>(LOCAL_PERFORMANCE_EVENT, {
        detail: snapshot,
      })
    );
    return snapshot;
  } catch {
    return null;
  }
}

export function clearLocalPerformanceSnapshots(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_PERFORMANCE_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(LOCAL_PERFORMANCE_EVENT));
  } catch {
    // Performance snapshots are local diagnostics only; failing to clear them
    // must never affect workspace data.
  }
}

function normalizeCounts(
  counts?: Record<string, number | null | undefined>
): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(counts ?? {})) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    normalized[key] = Math.max(0, Math.round(value));
  }
  return normalized;
}

function roundMs(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

function isLocalPerformanceSnapshot(
  value: unknown
): value is LocalPerformanceSnapshot {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<LocalPerformanceSnapshot>;
  return (
    record.format === "zhinote-local-performance-snapshot" &&
    record.format_version === 1 &&
    (record.kind === "daily-calendar" ||
      record.kind === "meeting-calendar" ||
      record.kind === "database-row-open" ||
      record.kind === "page-open" ||
      record.kind === "page-body-hydration" ||
      record.kind === "page-peek") &&
    typeof record.label === "string" &&
    typeof record.route === "string" &&
    typeof record.status === "string" &&
    typeof record.started_at === "string" &&
    typeof record.recorded_at === "string" &&
    typeof record.duration_ms === "number" &&
    Boolean(record.counts) &&
    typeof record.counts === "object" &&
    !Array.isArray(record.counts) &&
    record.boundary?.reads_page_body_text === false &&
    record.boundary?.reads_database_row_values === false &&
    record.boundary?.reads_file_bytes === false &&
    record.boundary?.uploads_workspace_data === false &&
    record.boundary?.includes_raw_page_id === false &&
    record.boundary?.includes_page_title === false
  );
}
