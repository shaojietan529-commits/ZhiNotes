export type MeetingCalendarLoadPhase =
  | "booting"
  | "hot-cache"
  | "cached-cloud"
  | "local-index"
  | "cloud-checking"
  | "cloud-ready"
  | "local-only"
  | "cloud-error"
  | "optimistic-draft";

export type MeetingCalendarLoadTone =
  | "neutral"
  | "working"
  | "success"
  | "warning";

export interface MeetingCalendarLoadStatusState {
  phase: MeetingCalendarLoadPhase;
  visibleMeetings: number;
  visibleDays: number;
  cloudLoading: boolean;
  backgroundActive: boolean;
  staleCloud: boolean;
  message: string | null;
  updatedAt: string;
}

export interface MeetingCalendarLoadStatusView {
  phase: MeetingCalendarLoadPhase;
  label: string;
  detail: string;
  tone: MeetingCalendarLoadTone;
  ariaLabel: string;
  chips: Array<{ label: string; value: string }>;
  steps: Array<{
    id: "hot-cache" | "local-index" | "cloud-check" | "background-fill";
    label: string;
    state: "done" | "active" | "pending" | "warning";
  }>;
  privacyBoundary: string;
}

const MEETING_CALENDAR_LOAD_PRIVACY_BOUNDARY =
  "Meeting calendar load status is metadata-only. It uses phase names, visible meeting counts, visible day counts, cache/source labels, cloud-loading flags, stale-cache flags, and timestamps only. It does not read meeting body text, transcripts, editor state, join URLs, meeting ids, passcodes, database row values, comment bodies, file bytes, tokens, cookies, credentials, or cloud payload bodies; it does not send network requests, it does not write server data, it does not upload data, acknowledge sync rows, mark rows synced, or clear cache.";

export function createMeetingCalendarLoadStatus(
  input: Partial<MeetingCalendarLoadStatusState> & {
    phase: MeetingCalendarLoadPhase;
  }
): MeetingCalendarLoadStatusState {
  return {
    phase: input.phase,
    visibleMeetings: Math.max(0, input.visibleMeetings ?? 0),
    visibleDays: Math.max(0, input.visibleDays ?? 0),
    cloudLoading: Boolean(input.cloudLoading),
    backgroundActive: Boolean(input.backgroundActive),
    staleCloud: Boolean(input.staleCloud),
    message: input.message ?? null,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

export function buildMeetingCalendarLoadStatusView(
  state: MeetingCalendarLoadStatusState
): MeetingCalendarLoadStatusView {
  const phaseMeta = meetingCalendarLoadPhaseMeta(state);
  const chips = [
    { label: "来源", value: phaseMeta.source },
    { label: "可见会议", value: String(state.visibleMeetings) },
    { label: "有会议日期", value: String(state.visibleDays) },
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
    ariaLabel: [
      phaseMeta.label,
      state.message ?? phaseMeta.detail,
      `可见会议 ${state.visibleMeetings}`,
      `有会议日期 ${state.visibleDays}`,
      state.cloudLoading || state.backgroundActive ? "后台校正中" : "后台已稳定",
      state.staleCloud ? "云缓存较早" : "",
    ]
      .filter(Boolean)
      .join("，"),
    chips,
    steps: buildMeetingCalendarLoadSteps(state),
    privacyBoundary: MEETING_CALENDAR_LOAD_PRIVACY_BOUNDARY,
  };
}

function meetingCalendarLoadPhaseMeta(
  state: MeetingCalendarLoadStatusState
): {
  label: string;
  detail: string;
  source: string;
  tone: MeetingCalendarLoadTone;
} {
  switch (state.phase) {
    case "booting":
      return {
        label: "正在启动会议日历",
        detail: "先启动 ZhiHui 日历壳，再读取热缓存、本地索引和云端目录。",
        source: "启动",
        tone: "working",
      };
    case "hot-cache":
      return {
        label: "热缓存已显示",
        detail: "已先用浏览器本地 metadata 显示会议日历，后台继续校正。",
        source: "热缓存",
        tone: "working",
      };
    case "cached-cloud":
      return {
        label: state.staleCloud ? "较早云缓存已显示" : "云缓存已显示",
        detail: "已先显示浏览器缓存的云端会议目录，后台刷新到最新。",
        source: "云缓存",
        tone: state.staleCloud ? "warning" : "working",
      };
    case "local-index":
      return {
        label: "本地索引已显示",
        detail: "当前月会议目录来自本地日期索引，详情正文仍按打开时加载。",
        source: "本地索引",
        tone: state.cloudLoading || state.backgroundActive ? "working" : "success",
      };
    case "cloud-checking":
      return {
        label: "云端校正中",
        detail: "本地会议目录已可用，正在读取云端 metadata 对齐。",
        source: "云端校正",
        tone: "working",
      };
    case "cloud-ready":
      return {
        label: "云端已校正",
        detail: "当前会议日历目录已和云端 metadata 对齐。",
        source: "云端",
        tone: "success",
      };
    case "local-only":
      return {
        label: "本地模式",
        detail: "云端暂不可用，当前只显示本机会议日历。",
        source: "本地",
        tone: "neutral",
      };
    case "cloud-error":
      return {
        label: "云端校正失败",
        detail: "本地会议目录仍可用，云端 metadata 本轮未能校正。",
        source: "本地",
        tone: "warning",
      };
    case "optimistic-draft":
      return {
        label: "新会议已本地创建",
        detail: "已先打开本地会议草稿，后台继续保存并排队同步。",
        source: "本地草稿",
        tone: "working",
      };
  }
}

function buildMeetingCalendarLoadSteps(
  state: MeetingCalendarLoadStatusState
): MeetingCalendarLoadStatusView["steps"] {
  const order: MeetingCalendarLoadPhase[] = [
    "hot-cache",
    "cached-cloud",
    "local-index",
    "cloud-checking",
    "cloud-ready",
  ];
  const phaseIndex = order.indexOf(state.phase);
  const doneThrough = phaseIndex < 0 ? -1 : phaseIndex;

  const stepState = (
    step: "hot-cache" | "local-index" | "cloud-check" | "background-fill",
    activePhases: MeetingCalendarLoadPhase[]
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
      "background-fill": 2,
      "cloud-check": 4,
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
      state: stepState("background-fill", ["local-index", "cloud-checking"]),
    },
    {
      id: "cloud-check",
      label: "云端校正",
      state: stepState("cloud-check", ["cloud-checking"]),
    },
  ];
}
