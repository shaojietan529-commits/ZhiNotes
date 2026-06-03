"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import ResearchConnectionsPanel from "@/components/modules/ResearchConnectionsPanel";
import ResearchWorkflowSchemaPanel from "@/components/modules/ResearchWorkflowSchemaPanel";
import { usePages } from "@/hooks/usePages";
import { getAllDatabases } from "@/lib/db/local/queries";
import {
  buildMeetingFollowUpReport,
  getMeetingFollowUpStageLabel,
  type MeetingFollowUpPriority,
  type MeetingFollowUpReport,
  type MeetingFollowUpStage,
} from "@/lib/meetings/meetingFollowUp";
import { executeModuleStarter } from "@/lib/modules/actions";
import { PLATFORM_MODULES, type ModuleStarter } from "@/lib/modules/registry";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

const MEETING_TEMPLATE_STARTERS: ModuleStarter[] = [
  {
    type: "page",
    label: "新建会议纪要",
    title: "未命名会议纪要",
    templateTitle: "会议纪要",
    icon: "MTG",
  },
];

const WORKFLOW_STEPS = [
  {
    title: "日程与背景",
    detail:
      "在会议前记录会议平台、组织者、公司、议程和核心研究问题。",
  },
  {
    title: "转录稿与纪要",
    detail:
      "把转录稿链接、原始笔记、管理层表述和专家电话会观察放在一个本地会议页里。",
  },
  {
    title: "行动项",
    detail:
      "通过待办列表和跟踪状态管理 follow-up、开放问题、模型调整和负责人。",
  },
  {
    title: "研究关联",
    detail:
      "用 relation 字段把会议关联回公司页面、报告、备忘录和业绩复盘。",
  },
];

export default function MeetingsShell() {
  return (
    <DatabaseProvider>
      <MeetingsContent />
    </DatabaseProvider>
  );
}

function MeetingsContent() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <MeetingsDashboard />
      </main>
    </div>
  );
}

function MeetingsDashboard() {
  const router = useRouter();
  const { pages, refresh } = usePages();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportingFollowUp, setExportingFollowUp] = useState(false);

  useEffect(() => {
    void getAllDatabases()
      .then(setDatabases)
      .catch((err) => {
        console.error("[Zhinote] Failed to load meeting databases:", err);
      });
  }, []);

  const meetingPages = useMemo(() => getMeetingPages(pages), [pages]);
  const transcriptPages = useMemo(() => getTranscriptPages(pages), [pages]);
  const actionPages = useMemo(() => getActionItemPages(pages), [pages]);
  const meetingTrackers = useMemo(
    () => databases.filter(isMeetingTrackerDatabase),
    [databases]
  );
  const meetingFollowUp = useMemo(
    () => buildMeetingFollowUpReport(pages, databases),
    [databases, pages]
  );

  const meetingsModule = PLATFORM_MODULES.find((module) => module.id === "meetings");
  const trackerStarter = meetingsModule?.starter ?? null;

  const runStarter = async (starter: ModuleStarter) => {
    setBusyAction(starter.label);
    try {
      const result = await executeModuleStarter(starter);
      await refresh();
      if (result.database) {
        setDatabases(await getAllDatabases());
      }
      router.push(result.route);
    } catch (err) {
      console.error("[Zhinote] Failed to run meeting starter:", err);
      window.alert("会议动作失败，请查看控制台。");
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportFollowUp = () => {
    setExportingFollowUp(true);
    try {
      downloadJsonFile(`zhinote-meeting-follow-up-${fileSafeTimestamp()}.json`, {
        ...meetingFollowUp,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export meeting follow-up:", err);
      window.alert("Meeting follow-up export failed. Please check the console.");
    } finally {
      setExportingFollowUp(false);
    }
  };

  return (
    <div className="w-full px-6 py-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                投研模块
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                会议与电话会
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                记录管理层电话会、专家电话会、转录稿、决策、行动项，以及与公司或报告的关联。
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/modules")}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              所有模块
            </button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="会议纪要" value={meetingPages.length} />
          <Metric label="转录稿页面" value={transcriptPages.length} />
          <Metric label="行动项页面" value={actionPages.length} />
          <Metric label="跟踪表" value={meetingTrackers.length} />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                创建会议资产
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                这些动作只会创建本地页面或数据库，不会自动入会、录音、发布、同步或调用外部服务。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {MEETING_TEMPLATE_STARTERS.map((starter) => (
                <StarterButton
                  key={starter.label}
                  label={starter.label}
                  busy={busyAction === starter.label}
                  onClick={() => void runStarter(starter)}
                />
              ))}
              {trackerStarter && (
                <StarterButton
                  label={trackerStarter.label}
                  busy={busyAction === trackerStarter.label}
                  emphasis
                  onClick={() => void runStarter(trackerStarter)}
                />
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                会议 follow-up 队列
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                本地扫描会议纪要页面和会议跟踪表元数据，检查转录稿、行动项、
                公司关联和报告关联是否齐备。导出不会包含会议正文、转录稿、
                录音、参会人详情或会议密码。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportFollowUp}
              disabled={exportingFollowUp}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingFollowUp ? "Exporting..." : "Export follow-up"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            <FollowUpMetric
              label="会议页"
              value={meetingFollowUp.summary.meeting_pages}
              detail="Local notes"
              status={meetingFollowUp.summary.meeting_pages > 0 ? "ready" : "missing"}
            />
            <FollowUpMetric
              label="待处理"
              value={meetingFollowUp.summary.follow_up_items}
              detail="Queue items"
              status={
                meetingFollowUp.summary.follow_up_items > 0 ? "partial" : "ready"
              }
            />
            <FollowUpMetric
              label="高优先级"
              value={meetingFollowUp.summary.high_priority}
              detail="Needs review"
              status={
                meetingFollowUp.summary.high_priority > 0 ? "missing" : "ready"
              }
            />
            <FollowUpMetric
              label="缺转录"
              value={meetingFollowUp.summary.missing_transcripts}
              detail="Transcript"
              status={
                meetingFollowUp.summary.missing_transcripts > 0
                  ? "missing"
                  : "ready"
              }
            />
            <FollowUpMetric
              label="缺行动项"
              value={meetingFollowUp.summary.missing_action_items}
              detail="Action items"
              status={
                meetingFollowUp.summary.missing_action_items > 0
                  ? "missing"
                  : "ready"
              }
            />
            <FollowUpMetric
              label="缺公司"
              value={meetingFollowUp.summary.missing_company_links}
              detail="Relations"
              status={
                meetingFollowUp.summary.missing_company_links > 0
                  ? "missing"
                  : "ready"
              }
            />
            <FollowUpMetric
              label="缺报告"
              value={meetingFollowUp.summary.missing_report_links}
              detail="Relations"
              status={
                meetingFollowUp.summary.missing_report_links > 0
                  ? "missing"
                  : "ready"
              }
            />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {meetingFollowUp.lanes.map((lane) => (
              <article
                key={lane.id}
                className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900"
              >
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {lane.title}
                </div>
                <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
                  {lane.description}
                </p>
              </article>
            ))}
          </div>
          {meetingFollowUp.items.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {meetingFollowUp.items.slice(0, 8).map((item) => (
                <MeetingFollowUpItemCard
                  key={item.id}
                  item={item}
                  onOpen={() => router.push(item.route)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
              还没有会议 follow-up 项。新建会议纪要后，这里会提示缺少的转录稿、行动项、
              公司关联或报告关联。
            </p>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              会议工作流
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {WORKFLOW_STEPS.map((step) => (
                <WorkflowCard key={step.title} {...step} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              本地集成模型
            </h2>
            <div className="mt-3 space-y-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              <p>
                会议会保存为本地页面和跟踪表行。relation 字段会把它们连接到公司、报告、备忘录和
                转录稿页面。
              </p>
              <p>
                未来接入 meeting agent 时，应先写入这个本地结构，再考虑开启云同步或 AI 处理。
              </p>
            </div>
          </div>
        </section>

        <ResearchWorkflowSchemaPanel kind="meeting" />

        <ResearchConnectionsPanel
          pages={pages}
          databases={databases}
          focusKind="meeting"
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <ResourceList
            title="最近会议纪要"
            emptyText="还没有会议纪要。"
            items={meetingPages.slice(0, 6).map((page) => ({
              id: page.id,
              label: page.title || "未命名会议纪要",
              meta: formatUpdated(page.updated_at),
              onOpen: () => router.push(`/page/${page.id}`),
            }))}
          />
          <ResourceList
            title="会议跟踪表"
            emptyText="还没有会议跟踪数据库。"
            items={meetingTrackers.map((database) => ({
              id: database.id,
              label: database.title || "会议跟踪表",
              meta: database.description ?? "本地会议数据库",
              onOpen: () => router.push(`/database/${database.id}`),
            }))}
          />
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function FollowUpMetric({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: "ready" | "partial" | "missing";
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <FollowUpStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function MeetingFollowUpItemCard({
  item,
  onOpen,
}: {
  item: MeetingFollowUpReport["items"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {item.page_title}
          </div>
          <div className="mt-1 text-zinc-400">
            {getMeetingFollowUpStageLabel(item.stage)}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <FollowUpPriorityPill priority={item.priority} />
          <FollowUpStagePill stage={item.stage} />
        </div>
      </div>
      <div className="mt-3 grid gap-1 sm:grid-cols-2">
        <FollowUpFlag label="转录稿" ready={item.has_transcript} />
        <FollowUpFlag label="行动项" ready={item.has_action_items} />
        <FollowUpFlag label="公司关联" ready={item.has_company_link} />
        <FollowUpFlag label="报告关联" ready={item.has_report_link} />
      </div>
      {item.missing_steps.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {item.missing_steps.map((stage) => (
            <span
              key={stage}
              className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            >
              缺 {getMeetingFollowUpStageLabel(stage)}
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {item.next_action}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
        {item.privacy_boundary}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        打开会议页
      </button>
    </article>
  );
}

function FollowUpFlag({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded bg-zinc-50 px-2 py-1 dark:bg-zinc-900">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span
        className={
          ready
            ? "text-green-600 dark:text-green-300"
            : "text-amber-600 dark:text-amber-300"
        }
      >
        {ready ? "有" : "缺"}
      </span>
    </div>
  );
}

function FollowUpPriorityPill({
  priority,
}: {
  priority: MeetingFollowUpPriority;
}) {
  const labels: Record<MeetingFollowUpPriority, string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
  };
  const className =
    priority === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : priority === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[priority]}
    </span>
  );
}

function FollowUpStagePill({ stage }: { stage: MeetingFollowUpStage }) {
  return (
    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      {getMeetingFollowUpStageLabel(stage)}
    </span>
  );
}

function FollowUpStatusPill({
  status,
}: {
  status: "ready" | "partial" | "missing";
}) {
  const labels = {
    ready: "Ready",
    partial: "Partial",
    missing: "Missing",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "partial"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function StarterButton({
  label,
  busy,
  emphasis,
  onClick,
}: {
  label: string;
  busy: boolean;
  emphasis?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${
        emphasis
          ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      {busy ? "创建中..." : label}
    </button>
  );
}

function WorkflowCard({ title, detail }: { title: string; detail: string }) {
  return (
    <article className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {detail}
      </p>
    </article>
  );
}

function ResourceList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: Array<{
    id: string;
    label: string;
    meta: string;
    onOpen: () => void;
  }>;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-400">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {item.label}
                </div>
                <div className="truncate text-xs text-zinc-400">{item.meta}</div>
              </div>
              <button
                type="button"
                onClick={item.onOpen}
                className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                打开
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function getMeetingPages(pages: Page[]) {
  return pages.filter((page) =>
    pageMatches(page, [
      "meeting notes",
      "会议纪要",
      "management call",
      "expert call",
      "电话会",
      "participants",
      "discussion",
      "decisions",
    ])
  );
}

function getTranscriptPages(pages: Page[]) {
  return pages.filter((page) =>
    pageMatches(page, ["transcript", "raw transcript", "recording", "录音"])
  );
}

function getActionItemPages(pages: Page[]) {
  return pages.filter((page) =>
    pageMatches(page, [
      "action items",
      "follow-up",
      "follow up",
      "open questions",
      "行动项",
      "开放问题",
    ])
  );
}

function pageMatches(page: Page, terms: string[]) {
  const searchable = `${page.title ?? ""} ${page.content_text ?? ""}`.toLowerCase();
  return terms.some((term) => searchable.includes(term));
}

function isMeetingTrackerDatabase(database: Database) {
  const searchable = `${database.title ?? ""} ${
    database.description ?? ""
  }`.toLowerCase();
  return (
    searchable.includes("meeting") ||
    searchable.includes("call tracker") ||
    searchable.includes("会议")
  );
}

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近更新";
  return `更新于 ${date.toLocaleDateString()}`;
}

function downloadJsonFile(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileSafeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
