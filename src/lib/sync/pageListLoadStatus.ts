export type PageListLoadPhase =
  | "booting"
  | "hot-cache"
  | "local-hot-cache"
  | "local-index"
  | "cloud-checking"
  | "cloud-ready"
  | "local-only"
  | "cloud-error"
  | "optimistic-local";

export type PageListLoadTone =
  | "neutral"
  | "working"
  | "success"
  | "warning";

export type PageListFirstPaintState =
  | "empty-loading"
  | "visible-background"
  | "visible-stable"
  | "empty-stable";

export interface PageListLoadStatusState {
  phase: PageListLoadPhase;
  visiblePages: number;
  visibleRootPages: number;
  cloudLoading: boolean;
  backgroundActive: boolean;
  staleCache: boolean;
  message: string | null;
  updatedAt: string;
}

export interface PageListLoadStatusView {
  phase: PageListLoadPhase;
  label: string;
  detail: string;
  tone: PageListLoadTone;
  visiblePages: number;
  visibleRootPages: number;
  cloudLoading: boolean;
  backgroundActive: boolean;
  staleCache: boolean;
  firstPaintState: PageListFirstPaintState;
  firstPaintLabel: string;
  ariaLabel: string;
  chips: Array<{ label: string; value: string }>;
  privacyBoundary: string;
}

const PAGE_LIST_LOAD_PRIVACY_BOUNDARY =
  "Page list load status is metadata-only. It uses phase names, visible page counts, root page counts, cache/source labels, cloud-loading flags, stale-cache flags, and timestamps only. It does not read page body text, editor state, page properties, database row values, comment bodies, file bytes, tokens, cookies, credentials, or cloud payload bodies; it does not send network requests, write server data, upload data, acknowledge sync rows, mark rows synced, or clear cache.";

export function createPageListLoadStatus(
  input: Partial<PageListLoadStatusState> & {
    phase: PageListLoadPhase;
  }
): PageListLoadStatusState {
  return {
    phase: input.phase,
    visiblePages: Math.max(0, input.visiblePages ?? 0),
    visibleRootPages: Math.max(0, input.visibleRootPages ?? 0),
    cloudLoading: Boolean(input.cloudLoading),
    backgroundActive: Boolean(input.backgroundActive),
    staleCache: Boolean(input.staleCache),
    message: input.message ?? null,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

export function buildPageListLoadStatusView(
  state: PageListLoadStatusState
): PageListLoadStatusView {
  const phaseMeta = pageListLoadPhaseMeta(state);
  const firstPaintState = getPageListFirstPaintState(state);
  const firstPaintLabel = getPageListFirstPaintLabel(firstPaintState);
  const chips = [
    { label: "首屏", value: firstPaintLabel },
    { label: "来源", value: phaseMeta.source },
    { label: "可见页面", value: String(state.visiblePages) },
    { label: "顶层", value: String(state.visibleRootPages) },
    {
      label: "后台",
      value:
        state.cloudLoading || state.backgroundActive ? "校正中" : "已稳定",
    },
  ];
  if (state.staleCache) {
    chips.push({ label: "热缓存", value: "较早" });
  }

  return {
    phase: state.phase,
    label: phaseMeta.label,
    detail: state.message ?? phaseMeta.detail,
    tone: phaseMeta.tone,
    visiblePages: state.visiblePages,
    visibleRootPages: state.visibleRootPages,
    cloudLoading: state.cloudLoading,
    backgroundActive: state.backgroundActive,
    staleCache: state.staleCache,
    firstPaintState,
    firstPaintLabel,
    ariaLabel: [
      phaseMeta.label,
      `首屏${firstPaintLabel}`,
      state.message ?? phaseMeta.detail,
      `可见页面 ${state.visiblePages}`,
      `顶层页面 ${state.visibleRootPages}`,
      state.cloudLoading || state.backgroundActive ? "后台校正中" : "后台已稳定",
      state.staleCache ? "热缓存较早" : "",
    ]
      .filter(Boolean)
      .join("，"),
    chips,
    privacyBoundary: PAGE_LIST_LOAD_PRIVACY_BOUNDARY,
  };
}

function getPageListFirstPaintState(
  state: PageListLoadStatusState
): PageListFirstPaintState {
  const hasVisibleMetadata = state.visiblePages > 0 || state.visibleRootPages > 0;
  const backgroundWorking = state.cloudLoading || state.backgroundActive;
  if (!hasVisibleMetadata && backgroundWorking) return "empty-loading";
  if (hasVisibleMetadata && backgroundWorking) return "visible-background";
  if (hasVisibleMetadata) return "visible-stable";
  return "empty-stable";
}

function getPageListFirstPaintLabel(state: PageListFirstPaintState) {
  switch (state) {
    case "empty-loading":
      return "等待 metadata";
    case "visible-background":
      return "已先显示";
    case "visible-stable":
      return "已稳定";
    case "empty-stable":
    default:
      return "暂无页面";
  }
}

function pageListLoadPhaseMeta(state: PageListLoadStatusState): {
  label: string;
  detail: string;
  source: string;
  tone: PageListLoadTone;
} {
  switch (state.phase) {
    case "booting":
      return {
        label: "正在启动页面列表",
        detail: "先启动侧边栏壳，再读取浏览器热缓存、本地索引和云端目录。",
        source: "启动",
        tone: "working",
      };
    case "hot-cache":
      return {
        label: "页面热缓存已显示",
        detail: "已先用浏览器本地 metadata 显示页面列表，后台继续校正。",
        source: "热缓存",
        tone: "working",
      };
    case "local-hot-cache":
      return {
        label: "常用页面已显示",
        detail: "已先显示用户选择范围内的常用页面 metadata，完整列表后台补齐。",
        source: "本地热索引",
        tone: "working",
      };
    case "local-index":
      return {
        label: "本地页面索引已显示",
        detail: "页面目录来自本地 metadata 索引，正文仍按打开时加载。",
        source: "本地索引",
        tone: state.cloudLoading || state.backgroundActive ? "working" : "success",
      };
    case "cloud-checking":
      return {
        label: "页面云端校正中",
        detail: "本地页面列表已可用，正在读取云端 metadata 对齐。",
        source: "云端校正",
        tone: "working",
      };
    case "cloud-ready":
      return {
        label: "页面云端已校正",
        detail: "当前页面列表已和云端 metadata 对齐。",
        source: "云端",
        tone: "success",
      };
    case "local-only":
      return {
        label: "页面列表本地模式",
        detail: "云端暂不可用，当前页面列表继续使用本地 metadata。",
        source: "本地",
        tone: "neutral",
      };
    case "cloud-error":
      return {
        label: "页面云端校正失败",
        detail: "本地页面列表仍可用，云端 metadata 本轮未能校正。",
        source: "本地",
        tone: "warning",
      };
    case "optimistic-local":
      return {
        label: "页面已本地更新",
        detail: "新页面或移动已先写入本地列表，后台继续保存并排队同步。",
        source: "本地输入",
        tone: "working",
      };
  }
}
