import type {
  HotCacheWarmupJob,
  HotCacheWarmupPlan,
} from "@/lib/sync/hotCacheWarmupPlan";

export type HotCacheWarmupReceiptJobStatus =
  | "prefetched"
  | "preference-off"
  | "planned"
  | "blocked"
  | "no-routes";

export interface HotCacheWarmupReceiptInput {
  plan: HotCacheWarmupPlan;
  attemptedRouteTargets: string[];
  failedRouteTargets?: string[];
  startedAt: string;
  finishedAt: string;
}

export interface HotCacheWarmupReceiptJob {
  job_id: string;
  title: string;
  status: HotCacheWarmupReceiptJobStatus;
  source_status: HotCacheWarmupJob["status"];
  route_targets: string[];
  attempted_routes: number;
  failed_routes: number;
  estimated_metadata_records: number;
  reason: string;
}

export interface HotCacheWarmupReceipt {
  format: "zhinote-hot-cache-warmup-receipt";
  format_version: 1;
  receipt_status: "route-prefetch-receipt";
  architecture_target: "cloud-master-local-hot-cache";
  plan_hash: string;
  started_at: string;
  finished_at: string;
  privacy_boundary: string;
  boundary: {
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_file_text: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_cache_records: false;
    stores_receipt_as_source_of_truth: false;
    records_metadata_only: true;
    prefetches_routes_only: true;
  };
  summary: {
    jobs: number;
    prefetched_jobs: number;
    skipped_jobs: number;
    attempted_routes: number;
    failed_routes: number;
    estimated_metadata_records: number;
    pending_rows_protected: number;
  };
  attempted_route_targets: string[];
  failed_route_targets: string[];
  jobs: HotCacheWarmupReceiptJob[];
}

export function buildHotCacheWarmupReceipt(
  input: HotCacheWarmupReceiptInput
): HotCacheWarmupReceipt {
  const attemptedRouteTargetSet = new Set(input.attemptedRouteTargets);
  const failedRouteTargetSet = new Set(input.failedRouteTargets ?? []);
  const jobs = input.plan.jobs.map((job) =>
    buildReceiptJob(job, attemptedRouteTargetSet, failedRouteTargetSet)
  );
  const prefetchedJobs = jobs.filter((job) => job.status === "prefetched");
  const skippedJobs = jobs.length - prefetchedJobs.length;

  return {
    format: "zhinote-hot-cache-warmup-receipt",
    format_version: 1,
    receipt_status: "route-prefetch-receipt",
    architecture_target: "cloud-master-local-hot-cache",
    plan_hash: input.plan.summary.plan_hash,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    privacy_boundary:
      "This receipt records route targets, job statuses, metadata counts, and failed route counts only. It does not read or store page bodies, database values, comment bodies, file bytes, file text, tokens, or raw cache dumps. It is not a cloud source of truth.",
    boundary: {
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_file_text: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_cache_records: false,
      stores_receipt_as_source_of_truth: false,
      records_metadata_only: true,
      prefetches_routes_only: true,
    },
    summary: {
      jobs: jobs.length,
      prefetched_jobs: prefetchedJobs.length,
      skipped_jobs: skippedJobs,
      attempted_routes: attemptedRouteTargetSet.size,
      failed_routes: failedRouteTargetSet.size,
      estimated_metadata_records: prefetchedJobs.reduce(
        (total, job) => total + job.estimated_metadata_records,
        0
      ),
      pending_rows_protected: input.plan.summary.pending_rows_protected,
    },
    attempted_route_targets: [...attemptedRouteTargetSet],
    failed_route_targets: [...failedRouteTargetSet],
    jobs,
  };
}

function buildReceiptJob(
  job: HotCacheWarmupJob,
  attemptedRouteTargetSet: Set<string>,
  failedRouteTargetSet: Set<string>
): HotCacheWarmupReceiptJob {
  const attemptedRoutes = job.route_targets.filter((routeTarget) =>
    attemptedRouteTargetSet.has(routeTarget)
  );
  const failedRoutes = job.route_targets.filter((routeTarget) =>
    failedRouteTargetSet.has(routeTarget)
  );
  const status = getReceiptJobStatus(job, attemptedRoutes.length);

  return {
    job_id: job.id,
    title: job.title,
    status,
    source_status: job.status,
    route_targets: job.route_targets,
    attempted_routes: attemptedRoutes.length,
    failed_routes: failedRoutes.length,
    estimated_metadata_records:
      status === "prefetched" ? job.estimated_metadata_records : 0,
    reason: getReceiptJobReason(job, status),
  };
}

function getReceiptJobStatus(
  job: HotCacheWarmupJob,
  attemptedRoutes: number
): HotCacheWarmupReceiptJobStatus {
  if (job.status === "ready" && attemptedRoutes > 0) return "prefetched";
  if (job.status === "ready") return "no-routes";
  return job.status;
}

function getReceiptJobReason(
  job: HotCacheWarmupJob,
  status: HotCacheWarmupReceiptJobStatus
): string {
  if (status === "prefetched") {
    return "已提交 route prefetch；正文、文件和数据库行值仍按打开时加载。";
  }
  if (status === "no-routes") {
    return "该 job 已 ready，但当前没有可预热 route。";
  }
  return job.blocked_reason ?? job.reason;
}
