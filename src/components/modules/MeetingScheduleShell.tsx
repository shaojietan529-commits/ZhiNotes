"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";
import { createPage, listPages, updatePage } from "@/lib/db/local/queries";
import { getModuleRootId, toDateKey } from "@/lib/pages/moduleWorkspaces";
import {
  createPageProperty,
  parsePageProperties,
  stringifyPageProperties,
  type PageProperty,
} from "@/lib/pages/pageProperties";
import PageContextMenu from "@/components/page/PageContextMenu";
import type { Page } from "@/lib/utils/types";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_LABELS = [
  "1 月", "2 月", "3 月", "4 月", "5 月", "6 月",
  "7 月", "8 月", "9 月", "10 月", "11 月", "12 月",
];

const PLATFORMS = [
  "腾讯会议",
  "Zoom",
  "Webex",
  "进门财经",
  "Teams",
  "Google Meet",
  "其他",
];

interface MeetingEntry {
  page: Page;
  topic: string;
  organizer: string;
  platform: string;
  time: string;
  dateKey: string;
}

interface MeetingFormState {
  topic: string;
  organizer: string;
  date: string;
  time: string;
  platform: string;
}

interface IntakeMeeting {
  topic: string;
  organizer: string;
  platform: string;
  date: string;
  time: string;
  endTime: string;
  durationMinutes: number | null;
  hasJoinUrl: boolean;
  joinUrlHost: string;
  source: "pasted_text" | "linked_page" | "mixed";
  confidence: "high" | "medium" | "low";
  warnings: string[];
}

interface IntakeResponse {
  meeting?: IntakeMeeting;
  fetched?: boolean;
  error?: string;
}

interface CreateMeetingOptions {
  importSource?: string;
  hasJoinUrl?: boolean;
  joinUrlHost?: string;
  timeLabel?: string;
  confidence?: IntakeMeeting["confidence"];
}

export default function MeetingScheduleShell() {
  const router = useRouter();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const { refresh } = usePages();
  const [rootId, setRootId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Page[]>([]);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(toDateKey(new Date())));
  const [intakeText, setIntakeText] = useState("");
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeMessage, setIntakeMessage] = useState("");
  const [intakeError, setIntakeError] = useState("");
  const [intakePreview, setIntakePreview] = useState<IntakeMeeting | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    x: number;
    y: number;
  } | null>(null);

  const load = useCallback(async () => {
    const id = await getModuleRootId("meeting-schedule");
    setRootId(id);
    setMeetings(await listPages(id));
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    queueMicrotask(() => {
      void load();
    });
  }, [dbReady, load]);

  const entries = useMemo<MeetingEntry[]>(
    () => meetings.map(toMeetingEntry),
    [meetings]
  );

  const entriesByDate = useMemo(() => {
    const map = new Map<string, MeetingEntry[]>();
    for (const entry of entries) {
      if (!entry.dateKey) continue;
      const list = map.get(entry.dateKey) ?? [];
      list.push(entry);
      map.set(entry.dateKey, list);
    }
    return map;
  }, [entries]);

  const upcoming = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return entries
      .filter((entry) => entry.dateKey && entry.dateKey >= todayKey)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .slice(0, 8);
  }, [entries]);

  const openForm = (dateKey: string) => {
    setForm(emptyForm(dateKey));
    setFormOpen(true);
  };

  const createMeetingPage = useCallback(
    async (draft: MeetingFormState, options: CreateMeetingOptions = {}) => {
      if (!rootId) return null;
      const topic = draft.topic.trim() || "未命名会议";
      const organizer = draft.organizer.trim();
      const title = [topic, organizer, draft.date].filter(Boolean).join("-");
      const page = await createPage({ parentId: rootId, title, icon: "🗓️" });
      const timeLabel = options.timeLabel ?? draft.time.trim();

      const props: PageProperty[] = [
        { ...createPageProperty("date", "日期"), value: draft.date },
        { ...createPageProperty("text", "时间"), value: timeLabel },
        {
          ...createPageProperty("select", "平台"),
          value: normalizePlatform(draft.platform),
          options: PLATFORMS,
        },
        { ...createPageProperty("text", "组织者"), value: organizer },
        createPageProperty("tags", "相关公司"),
        createPageProperty("tags", "相关行业"),
      ];

      if (options.importSource) {
        props.push({
          ...createPageProperty("select", "导入来源"),
          value: options.importSource,
          options: ["手动创建", "会议信息输入", "邮件导入"],
        });
      }
      if (typeof options.hasJoinUrl === "boolean") {
        props.push({
          ...createPageProperty("select", "入会链接状态"),
          value: options.hasJoinUrl ? "已读取" : "未提供",
          options: ["已读取", "未提供"],
        });
      }
      if (options.joinUrlHost) {
        props.push({
          ...createPageProperty("text", "链接域名"),
          value: options.joinUrlHost,
        });
      }
      if (options.confidence) {
        props.push({
          ...createPageProperty("select", "解析置信度"),
          value: confidenceLabel(options.confidence),
          options: ["高", "中", "低"],
        });
      }

      await updatePage(page.id, {
        properties: stringifyPageProperties(props),
      });

      await refresh();
      await load();
      return page;
    },
    [rootId, refresh, load]
  );

  const handleCreate = useCallback(async () => {
    await createMeetingPage(form);
    setFormOpen(false);
  }, [createMeetingPage, form]);

  const handleImportInvite = useCallback(async () => {
    const input = intakeText.trim();
    if (!input || intakeLoading) return;

    setIntakeLoading(true);
    setIntakeError("");
    setIntakeMessage("");
    setIntakePreview(null);

    try {
      const res = await fetch("/api/meetings/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = (await res.json()) as IntakeResponse;
      if (!res.ok || !data.meeting) {
        throw new Error(data.error || "读取会议信息失败。");
      }

      const meeting = data.meeting;
      setIntakePreview(meeting);
      const draft: MeetingFormState = {
        topic: meeting.topic,
        organizer: meeting.organizer,
        date: meeting.date || form.date || toDateKey(new Date()),
        time: meeting.time,
        platform: normalizePlatform(meeting.platform),
      };

      if (!meeting.date || !meeting.time) {
        setForm(draft);
        setFormOpen(true);
        setIntakeError("没有读到明确会议日期和开始时间，已把可识别内容填入手动表单。");
        return;
      }

      await createMeetingPage(draft, {
        importSource: "会议信息输入",
        hasJoinUrl: meeting.hasJoinUrl,
        joinUrlHost: meeting.joinUrlHost,
        confidence: meeting.confidence,
        timeLabel: formatMeetingTime(meeting.time, meeting.endTime),
      });
      setIntakeText("");
      setIntakeMessage("已导入会议日历。原始链接、会议号和密码没有写入页面。");
    } catch (error) {
      setIntakeError(error instanceof Error ? error.message : "读取会议信息失败。");
    } finally {
      setIntakeLoading(false);
    }
  }, [createMeetingPage, form.date, intakeLoading, intakeText]);

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const todayKey = toDateKey(new Date());

  const goPrev = () =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNext = () =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-10">
          <div className="mb-2 flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                <span>🗓️</span> 会议日程
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                一目了然地看到已安排的会议。手动添加会议；自动录制/转写将由会议助手
                Agent 接入（暂为占位）。
              </p>
            </div>
            <button
              type="button"
              onClick={() => openForm(toDateKey(new Date()))}
              className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              + 新建会议
            </button>
          </div>

          <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            安全边界：会议链接/会议号/密码不会写入页面或日志；不会自动开麦克风/摄像头；
            录制需先确认同意。这些将在会议助手 Agent 接入时按权限逐步开启。
          </div>

          <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  会议信息输入
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  粘贴完整会议邀请或单个入会链接。ZhiHui 会读取平台、主题、组织者、时间和链接域名，再加入会议日历。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleImportInvite()}
                disabled={intakeLoading || !intakeText.trim()}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
              >
                {intakeLoading ? "读取中..." : "导入会议日历"}
              </button>
            </div>
            <textarea
              value={intakeText}
              onChange={(e) => {
                setIntakeText(e.target.value);
                setIntakeError("");
                setIntakeMessage("");
              }}
              rows={5}
              placeholder="例如：粘贴腾讯会议、Zoom、Webex、进门财经邀请；也可以只粘贴 https://meeting.tencent.com/... 这样的链接"
              className={`${inputClass} min-h-32 resize-y leading-6`}
            />
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                原始链接不入库
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                密码不入库
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                支持只贴链接
              </span>
            </div>
            {intakeMessage && (
              <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                {intakeMessage}
              </p>
            )}
            {intakeError && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {intakeError}
              </p>
            )}
            {intakePreview && (
              <div className="mt-3 grid gap-2 rounded-md border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 sm:grid-cols-2">
                <PreviewItem label="平台" value={intakePreview.platform} />
                <PreviewItem label="会议主题" value={intakePreview.topic} />
                <PreviewItem label="组织者" value={intakePreview.organizer || "未读取"} />
                <PreviewItem
                  label="时间"
                  value={
                    intakePreview.date && intakePreview.time
                      ? `${intakePreview.date} ${formatMeetingTime(
                          intakePreview.time,
                          intakePreview.endTime
                        )}`
                      : "需要补充"
                  }
                />
                <PreviewItem
                  label="链接域名"
                  value={intakePreview.joinUrlHost || "未提供"}
                />
                <PreviewItem
                  label="解析置信度"
                  value={confidenceLabel(intakePreview.confidence)}
                />
              </div>
            )}
            {intakePreview?.warnings.length ? (
              <ul className="mt-2 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                {intakePreview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* New meeting form */}
          {formOpen && (
            <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="会议主题">
                  <input
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    placeholder="例如：中国巨石专家交流"
                    className={inputClass}
                  />
                </Field>
                <Field label="组织者">
                  <input
                    value={form.organizer}
                    onChange={(e) =>
                      setForm({ ...form, organizer: e.target.value })
                    }
                    placeholder="例如：XX 证券"
                    className={inputClass}
                  />
                </Field>
                <Field label="日期">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="时间">
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="平台">
                  <select
                    value={form.platform}
                    onChange={(e) =>
                      setForm({ ...form, platform: e.target.value })
                    }
                    className={inputClass}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  创建会议
                </button>
              </div>
            </div>
          )}

          {/* Calendar controls */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
              {viewMonth.getFullYear()} 年 {MONTH_LABELS[viewMonth.getMonth()]}
            </h2>
            <div className="flex items-center gap-1">
              <CalNavButton label="‹" onClick={goPrev} title="上个月" />
              <button
                type="button"
                onClick={goToday}
                className="rounded-md px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                回到今天
              </button>
              <CalNavButton label="›" onClick={goNext} title="下个月" />
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-1.5 text-center text-xs font-medium text-zinc-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((cell) => {
              const key = toDateKey(cell.date);
              const dayMeetings = entriesByDate.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={`group flex h-24 flex-col border-b border-r border-zinc-100 p-1 dark:border-zinc-800/70 ${
                    cell.inMonth ? "" : "bg-zinc-50/50 dark:bg-zinc-900/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        isToday
                          ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : cell.inMonth
                            ? "text-zinc-600 dark:text-zinc-300"
                            : "text-zinc-300 dark:text-zinc-600"
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                    <button
                      type="button"
                      onClick={() => openForm(key)}
                      className="text-zinc-300 opacity-0 transition-opacity hover:text-zinc-600 group-hover:opacity-100 dark:hover:text-zinc-200"
                      title="在这天加会议"
                    >
                      +
                    </button>
                  </div>
                  <div className="mt-0.5 flex flex-col gap-0.5 overflow-hidden">
                    {dayMeetings.slice(0, 3).map((entry) => (
                      <button
                        key={entry.page.id}
                        type="button"
                        onClick={() => router.push(`/page/${entry.page.id}`)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            pageId: entry.page.id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                        className="truncate rounded bg-blue-50 px-1 py-0.5 text-left text-[10px] text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                        title={`${entry.time ? entry.time + " " : ""}${entry.topic}`}
                      >
                        {entry.time ? `${entry.time} ` : ""}
                        {entry.topic}
                      </button>
                    ))}
                    {dayMeetings.length > 3 && (
                      <span className="px-1 text-[10px] text-zinc-400">
                        +{dayMeetings.length - 3} 更多
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {upcoming.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                即将到来的会议
              </h3>
              <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {upcoming.map((entry) => (
                  <li key={entry.page.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/page/${entry.page.id}`)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          pageId: entry.page.id,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <span className="w-24 shrink-0 text-xs text-zinc-400">
                        {entry.dateKey}
                        {entry.time ? ` ${entry.time}` : ""}
                      </span>
                      <span className="truncate text-zinc-700 dark:text-zinc-200">
                        {entry.topic}
                      </span>
                      {entry.platform && (
                        <span className="ml-auto shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                          {entry.platform}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>

      {contextMenu && (
        <PageContextMenu
          pageId={contextMenu.pageId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={(id) => router.push(`/page/${id}`)}
          onOpenFull={(id) => router.push(`/page/${id}`)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

function emptyForm(dateKey: string): MeetingFormState {
  return {
    topic: "",
    organizer: "",
    date: dateKey,
    time: "",
    platform: PLATFORMS[0],
  };
}

function toMeetingEntry(page: Page): MeetingEntry {
  const props = parsePageProperties(page.properties);
  const read = (name: string) =>
    props.find((p) => p.name === name)?.value ?? "";
  return {
    page,
    topic: page.title || "未命名会议",
    organizer: read("组织者"),
    platform: read("平台"),
    time: read("时间"),
    dateKey: read("日期"),
  };
}

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function normalizePlatform(platform: string) {
  return PLATFORMS.includes(platform) ? platform : "其他";
}

function formatMeetingTime(startTime: string, endTime: string) {
  if (!startTime) return "";
  return endTime ? `${startTime}-${endTime}` : startTime;
}

function confidenceLabel(confidence: IntakeMeeting["confidence"]) {
  if (confidence === "high") return "高";
  if (confidence === "medium") return "中";
  return "低";
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-zinc-400">{label}</div>
      <div className="mt-0.5 truncate text-zinc-700 dark:text-zinc-200">
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function CalNavButton({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {label}
    </button>
  );
}

interface MonthCell {
  date: Date;
  inMonth: boolean;
}

function buildMonthGrid(monthStart: Date): MonthCell[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - offset);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i
    );
    cells.push({ date, inMonth: date.getMonth() === month });
  }
  return cells;
}
