export const PAGE_BODY_HYDRATION_STATUS_EVENT =
  "zhinote:page-body-hydration-status";

const MAX_PAGE_BODY_HYDRATION_STATUS_ENTRIES = 120;

export type PageBodyHydrationSurface =
  | "full-page"
  | "peek"
  | "database-preview"
  | "compare"
  | "unknown";

export type PageBodyHydrationPhase =
  | "metadata-ready"
  | "local-body-requested"
  | "local-body-ready"
  | "cloud-body-requested"
  | "cloud-body-ready"
  | "empty-ready"
  | "unavailable";

export interface PageBodyHydrationStatusBoundary {
  local_browser_memory_only: true;
  stores_page_body_text: false;
  stores_page_title: false;
  stores_database_values: false;
  stores_file_bytes: false;
  uploads_workspace_data: false;
  mutates_workspace_data: false;
}

export interface PageBodyHydrationStatus {
  format: "zhinote-page-body-hydration-status";
  format_version: 1;
  page_id: string;
  phase: PageBodyHydrationPhase;
  surface: PageBodyHydrationSurface;
  metadata_only: boolean;
  updated_at: string;
  boundary: PageBodyHydrationStatusBoundary;
}

export interface PageBodyHydrationStatusInput {
  pageId: string;
  phase: PageBodyHydrationPhase;
  surface?: PageBodyHydrationSurface;
  metadataOnly?: boolean;
}

const PAGE_BODY_HYDRATION_STATUS_BOUNDARY: PageBodyHydrationStatusBoundary = {
  local_browser_memory_only: true,
  stores_page_body_text: false,
  stores_page_title: false,
  stores_database_values: false,
  stores_file_bytes: false,
  uploads_workspace_data: false,
  mutates_workspace_data: false,
};

const pageBodyHydrationStatuses = new Map<
  string,
  PageBodyHydrationStatus
>();

export function publishPageBodyHydrationStatus(
  input: PageBodyHydrationStatusInput
): PageBodyHydrationStatus {
  const status: PageBodyHydrationStatus = {
    format: "zhinote-page-body-hydration-status",
    format_version: 1,
    page_id: input.pageId,
    phase: input.phase,
    surface: input.surface ?? "unknown",
    metadata_only: input.metadataOnly ?? true,
    updated_at: new Date().toISOString(),
    boundary: PAGE_BODY_HYDRATION_STATUS_BOUNDARY,
  };
  pageBodyHydrationStatuses.set(input.pageId, status);
  trimPageBodyHydrationStatuses();

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<PageBodyHydrationStatus>(
        PAGE_BODY_HYDRATION_STATUS_EVENT,
        { detail: status }
      )
    );
  }

  return status;
}

export function getPageBodyHydrationStatus(
  pageId: string | null
): PageBodyHydrationStatus | null {
  if (!pageId) return null;
  return pageBodyHydrationStatuses.get(pageId) ?? null;
}

export function subscribePageBodyHydrationStatus(
  pageId: string | null,
  handler: (status: PageBodyHydrationStatus | null) => void
): () => void {
  if (typeof window === "undefined" || !pageId) return () => undefined;
  const listener = (event: Event) => {
    const status = (event as CustomEvent<PageBodyHydrationStatus>).detail;
    if (status?.page_id !== pageId) return;
    handler(status);
  };
  window.addEventListener(PAGE_BODY_HYDRATION_STATUS_EVENT, listener);
  return () =>
    window.removeEventListener(PAGE_BODY_HYDRATION_STATUS_EVENT, listener);
}

export function describePageBodyHydrationStatus(
  status: PageBodyHydrationStatus | null
): string | null {
  if (!status) return null;
  switch (status.phase) {
    case "metadata-ready":
      return "标题和属性已显示，正在准备补齐正文…";
    case "local-body-requested":
      return "标题和属性已显示，正在从本地缓存补齐正文…";
    case "local-body-ready":
      return "本地正文已补齐，正在准备编辑器…";
    case "cloud-body-requested":
      return "本地正文未命中，正在后台检查云端正文…";
    case "cloud-body-ready":
      return "云端正文已补齐，正在准备编辑器…";
    case "empty-ready":
      return "正文为空，可以直接编辑。";
    case "unavailable":
      return "正文暂时没有补齐，可以先编辑当前页面。";
    default:
      return null;
  }
}

function trimPageBodyHydrationStatuses(): void {
  if (
    pageBodyHydrationStatuses.size <=
    MAX_PAGE_BODY_HYDRATION_STATUS_ENTRIES
  ) {
    return;
  }
  const overflow =
    pageBodyHydrationStatuses.size -
    MAX_PAGE_BODY_HYDRATION_STATUS_ENTRIES;
  const keys = pageBodyHydrationStatuses.keys();
  for (let index = 0; index < overflow; index += 1) {
    const next = keys.next();
    if (next.done) return;
    pageBodyHydrationStatuses.delete(next.value);
  }
}
