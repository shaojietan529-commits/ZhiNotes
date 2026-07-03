export type DailyCalendarLoadPhase =
  | "booting"
  | "hot-cache"
  | "cached-cloud"
  | "local-index"
  | "local-fallback"
  | "index-backfill"
  | "cloud-checking"
  | "cloud-ready"
  | "local-only"
  | "cloud-error"
  | "optimistic-draft";

export type DailyCalendarLoadTone =
  | "neutral"
  | "working"
  | "success"
  | "warning";

export type DailyCalendarFirstPaintState =
  | "empty-loading"
  | "visible-background"
  | "visible-stable"
  | "empty-stable";

export interface DailyCalendarLoadStatusState {
  phase: DailyCalendarLoadPhase;
  visibleNotes: number;
  visibleDays: number;
  cloudLoading: boolean;
  backgroundActive: boolean;
  staleCloud: boolean;
  message: string | null;
  updatedAt: string;
}

export interface DailyCalendarLoadStatusView {
  phase: DailyCalendarLoadPhase;
  label: string;
  detail: string;
  tone: DailyCalendarLoadTone;
  visibleNotes: number;
  visibleDays: number;
  cloudLoading: boolean;
  backgroundActive: boolean;
  staleCloud: boolean;
  firstPaintState: DailyCalendarFirstPaintState;
  firstPaintLabel: string;
  ariaLabel: string;
  chips: Array<{ label: string; value: string }>;
  steps: Array<{
    id: "hot-cache" | "local-index" | "cloud-check" | "background-fill";
    label: string;
    state: "done" | "active" | "pending" | "warning";
  }>;
  privacyBoundary: string;
}

const DAILY_CALENDAR_LOAD_PRIVACY_BOUNDARY =
  "Daily calendar load status is metadata-only. It uses phase names, visible item counts, visible day counts, cache/source labels, cloud-loading flags, stale-cache flags, and timestamps only. It does not read page body text, editor state, database row values, comment bodies, file bytes, tokens, cookies, credentials, or cloud payload bodies; it does not send network requests, it does not write server data, it does not upload data, acknowledge sync rows, mark rows synced, or clear cache.";

export function createDailyCalendarLoadStatus(
  input: Partial<DailyCalendarLoadStatusState> & {
    phase: DailyCalendarLoadPhase;
  }
): DailyCalendarLoadStatusState {
  return {
    phase: input.phase,
    visibleNotes: Math.max(0, input.visibleNotes ?? 0),
    visibleDays: Math.max(0, input.visibleDays ?? 0),
    cloudLoading: Boolean(input.cloudLoading),
    backgroundActive: Boolean(input.backgroundActive),
    staleCloud: Boolean(input.staleCloud),
    message: input.message ?? null,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

export function buildDailyCalendarLoadStatusView(
  state: DailyCalendarLoadStatusState
): DailyCalendarLoadStatusView {
  const phaseMeta = dailyCalendarLoadPhaseMeta(state);
  const firstPaintState = getDailyCalendarFirstPaintState(state);
  const firstPaintLabel = getDailyCalendarFirstPaintLabel(firstPaintState);
  const chips = [
    { label: "首屏", value: firstPaintLabel },
    { label: "来源", value: phaseMeta.source },
    { label: "可见纪要", value: String(state.visibleNotes) },
    { label: "有内容日期", value: String(state.visibleDays) },
    {
      label: "后台",
      value:
        state.cloudLoading || state.backgroundActive ? "校正中" : "已稳定",
    },
  ];
  if (state.staleCloud) {
    chips.push({ label: "云缓存", value: "较早" });
  }

  return {
    phase: state.phase,
    label: phaseMeta.label,
    detail: state.message ?? phaseMeta.detail,
    tone: phaseMeta.tone,
    visibleNotes: state.visibleNotes,
    visibleDays: state.visibleDays,
    cloudLoading: state.cloudLoading,
    backgroundActive: state.backgroundActive,
    staleCloud: state.staleCloud,
    firstPaintState,
    firstPaintLabel,
    ariaLabel: [
      phaseMeta.label,
      `首屏${firstPaintLabel}`,
      state.message ?? phaseMeta.detail,
      `可见纪要 ${state.visibleNotes}`,
      `有内容日期 ${state.visibleDays}`,
      state.cloudLoading || state.backgroundActive ? "后台校正中" : "后台已稳定",
      state.staleCloud ? "云缓存较早" : "",
    ]
      .filter(Boolean)
      .join("，"),
    chips,
    steps: buildDailyCalendarLoadSteps(state),
    privacyBoundary: DAILY_CALENDAR_LOAD_PRIVACY_BOUNDARY,
  };
}

function getDailyCalendarFirstPaintState(
  state: DailyCalendarLoadStatusState
): DailyCalendarFirstPaintState {
  const hasVisibleMetadata = state.visibleNotes > 0 || state.visibleDays > 0;
  const backgroundWorking = state.cloudLoading || state.backgroundActive;
  if (!hasVisibleMetadata && backgroundWorking) return "empty-loading";
  if (hasVisibleMetadata && backgroundWorking) return "visible-background";
  if (hasVisibleMetadata) return "visible-stable";
  return "empty-stable";
}

function getDailyCalendarFirstPaintLabel(
  state: DailyCalendarFirstPaintState
) {
  switch (state) {
    case "empty-loading":
      return "日历壳已显示";
    case "visible-background":
      return "已先显示";
    case "visible-stable":
      return "已稳定";
    case "empty-stable":
    default:
      return "暂无条目";
  }
}

function dailyCalendarLoadPhaseMeta(state: DailyCalendarLoadStatusState): {
  label: string;
  detail: string;
  source: string;
  tone: DailyCalendarLoadTone;
} {
  switch (state.phase) {
    case "booting":
      return {
        label: "正在启动日历",
        detail: "先启动本地壳，再读取热缓存、本地索引和云端索引。",
        source: "启动",
        tone: "working",
      };
    case "hot-cache":
      return {
        label: "热缓存已显示",
        detail: "已先用浏览器本地 metadata 显示日历，后台继续校正。",
        source: "热缓存",
        tone: "working",
      };
    case "cached-cloud":
      return {
        label: state.staleCloud ? "较早云缓存已显示" : "云缓存已显示",
        detail: "已先显示浏览器缓存的云端目录，后台刷新到最新。",
        source: "云缓存",
        tone: state.staleCloud ? "warning" : "working",
      };
    case "local-index":
      return {
        label: "本地索引已显示",
        detail: "当前月目录来自本地日期索引，正文仍按打开时加载。",
        source: "本地索引",
        tone: state.cloudLoading || state.backgroundActive ? "working" : "success",
      };
    case "local-fallback":
      return {
        label: "本地补齐中",
        detail: "后台正在补齐未索引的旧导入纪要。",
        source: "本地补齐",
        tone: "working",
      };
    case "index-backfill":
      return {
        label: "日期索引校正中",
        detail: "后台分批重建日期索引，避免一次性扫描拖慢页面。",
        source: "索引校正",
        tone: "working",
      };
    case "cloud-checking":
      return {
        label: "云端校正中",
        detail: "本地目录已可用，正在读取云端 metadata 对齐。",
        source: "云端校正",
        tone: "working",
      };
    case "cloud-ready":
      return {
        label: "云端已校正",
        detail: "当前日历目录已和云端 metadata 对齐。",
        source: "云端",
        tone: "success",
      };
    case "local-only":
      return {
        label: "本地模式",
        detail: "云端暂不可用，当前只显示本机每日纪要。",
        source: "本地",
        tone: "neutral",
      };
    case "cloud-error":
      return {
        label: "云端校正失败",
        detail: "本地目录仍可用，云端 metadata 本轮未能校正。",
        source: "本地",
        tone: "warning",
      };
    case "optimistic-draft":
      return {
        label: "新纪要已本地创建",
        detail: "已先打开本地草稿，后台继续保存并排队同步。",
        source: "本地草稿",
        tone: "working",
      };
  }
}

function buildDailyCalendarLoadSteps(
  state: DailyCalendarLoadStatusState
): DailyCalendarLoadStatusView["steps"] {
  const order: DailyCalendarLoadPhase[] = [
    "hot-cache",
    "cached-cloud",
    "local-index",
    "local-fallback",
    "index-backfill",
    "cloud-checking",
    "cloud-ready",
  ];
  const phaseIndex = order.indexOf(state.phase);
  const doneThrough = phaseIndex < 0 ? -1 : phaseIndex;

  const stepState = (
    step: "hot-cache" | "local-index" | "cloud-check" | "background-fill",
    activePhases: DailyCalendarLoadPhase[]
  ): "done" | "active" | "pending" | "warning" => {
    if (state.phase === "cloud-error") {
      return step === "cloud-check" ? "warning" : "done";
    }
    if (state.phase === "local-only") {
      return step === "cloud-check" ? "warning" : "done";
    }
    if (activePhases.includes(state.phase)) return "active";
    const stepDoneIndex = {
      "hot-cache": 1,
      "local-index": 2,
      "background-fill": 4,
      "cloud-check": 6,
    }[step];
    return doneThrough >= stepDoneIndex ? "done" : "pending";
  };

  return [
    {
      id: "hot-cache",
      label: "热缓存",
      state: stepState("hot-cache", ["hot-cache", "cached-cloud"]),
    },
    {
      id: "local-index",
      label: "本地索引",
      state: stepState("local-index", ["local-index"]),
    },
    {
      id: "background-fill",
      label: "后台补齐",
      state: stepState("background-fill", ["local-fallback", "index-backfill"]),
    },
    {
      id: "cloud-check",
      label: "云端校正",
      state: stepState("cloud-check", ["cloud-checking"]),
    },
  ];
}
