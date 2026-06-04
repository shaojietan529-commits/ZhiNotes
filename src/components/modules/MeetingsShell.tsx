"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import ResearchConnectionsPanel from "@/components/modules/ResearchConnectionsPanel";
import ResearchWorkflowSchemaPanel from "@/components/modules/ResearchWorkflowSchemaPanel";
import { usePages } from "@/hooks/usePages";
import {
  addRow,
  getAllDatabases,
  getFields,
  getRows,
} from "@/lib/db/local/queries";
import {
  buildMeetingFollowUpReport,
  getMeetingFollowUpStageLabel,
  type MeetingFollowUpPriority,
  type MeetingFollowUpReport,
  type MeetingFollowUpStage,
} from "@/lib/meetings/meetingFollowUp";
import {
  buildMeetingDecisionLedgerReport,
  getMeetingDecisionSignalLabel,
  type MeetingDecisionLedgerReport,
  type MeetingDecisionPriority,
  type MeetingDecisionStatus,
} from "@/lib/meetings/meetingDecisionLedger";
import {
  buildMeetingResearchPlaybook,
  type MeetingResearchPlaybook,
  type MeetingResearchPlaybookStatus,
} from "@/lib/meetings/meetingResearchPlaybook";
import {
  buildMeetingResearchQueue,
  getMeetingResearchQueueRiskLabel,
  getMeetingResearchQueueStatusLabel,
  getMeetingResearchQueueWorkstreamLabel,
  type MeetingResearchQueueReport,
  type MeetingResearchQueueRisk,
  type MeetingResearchQueueStatus,
  type MeetingResearchQueueWorkstream,
} from "@/lib/meetings/meetingResearchQueue";
import {
  buildMeetingTrackerIntakeDraft,
  findExistingMeetingTrackerRow,
  type MeetingTrackerFollowUpItem,
} from "@/lib/meetings/meetingTrackerIntake";
import {
  buildMeetingWorkbenchPacket,
  type MeetingWorkbenchPacket,
  type MeetingWorkbenchPriority,
  type MeetingWorkbenchStatus,
} from "@/lib/meetings/meetingWorkbench";
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
  {
    type: "page",
    label: "新建转录稿",
    title: "未命名会议转录稿",
    templateTitle: "会议转录稿",
    icon: "TRN",
  },
  {
    type: "page",
    label: "新建行动项",
    title: "未命名会议行动项",
    templateTitle: "会议行动项",
    icon: "ACT",
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
  const [exportingDecisionLedger, setExportingDecisionLedger] = useState(false);
  const [exportingResearchQueue, setExportingResearchQueue] = useState(false);
  const [exportingPlaybook, setExportingPlaybook] = useState(false);
  const [exportingWorkbench, setExportingWorkbench] = useState(false);
  const [trackerIntakeBusyId, setTrackerIntakeBusyId] = useState<string | null>(
    null
  );
  const [trackerIntakeMessage, setTrackerIntakeMessage] = useState<string | null>(
    null
  );

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
  const meetingDecisionLedger = useMemo(
    () => buildMeetingDecisionLedgerReport(pages, databases),
    [databases, pages]
  );
  const meetingResearchQueue = useMemo(
    () =>
      buildMeetingResearchQueue({
        followUp: meetingFollowUp,
        decisionLedger: meetingDecisionLedger,
      }),
    [meetingDecisionLedger, meetingFollowUp]
  );
  const meetingPlaybook = useMemo(
    () => buildMeetingResearchPlaybook(meetingFollowUp),
    [meetingFollowUp]
  );
  const meetingWorkbench = useMemo(
    () =>
      buildMeetingWorkbenchPacket({
        followUp: meetingFollowUp,
        decisionLedger: meetingDecisionLedger,
        researchQueue: meetingResearchQueue,
        playbook: meetingPlaybook,
        trackerIntakeItems: meetingFollowUp.items,
      }),
    [meetingDecisionLedger, meetingFollowUp, meetingPlaybook, meetingResearchQueue]
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

  const handleExportDecisionLedger = () => {
    setExportingDecisionLedger(true);
    try {
      downloadJsonFile(
        `zhinote-meeting-decision-ledger-${fileSafeTimestamp()}.json`,
        {
          ...meetingDecisionLedger,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export meeting decision ledger:", err);
      window.alert("会议投研闭环导出失败，请查看控制台。");
    } finally {
      setExportingDecisionLedger(false);
    }
  };

  const handleExportResearchQueue = () => {
    setExportingResearchQueue(true);
    try {
      downloadJsonFile(
        `zhinote-meeting-research-queue-${fileSafeTimestamp()}.json`,
        {
          ...meetingResearchQueue,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export meeting research queue:", err);
      window.alert("会议研究任务队列导出失败，请查看控制台。");
    } finally {
      setExportingResearchQueue(false);
    }
  };

  const handleExportPlaybook = () => {
    setExportingPlaybook(true);
    try {
      downloadJsonFile(
        `zhinote-meeting-research-playbook-${fileSafeTimestamp()}.json`,
        {
          ...meetingPlaybook,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export meeting playbook:", err);
      window.alert("会议研究 Playbook 导出失败，请查看控制台。");
    } finally {
      setExportingPlaybook(false);
    }
  };

  const handleExportWorkbench = () => {
    setExportingWorkbench(true);
    try {
      downloadJsonFile(
        `zhinote-meeting-workbench-${fileSafeTimestamp()}.json`,
        {
          ...meetingWorkbench,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export meeting workbench:", err);
      window.alert("会议工作台导出失败，请查看控制台。");
    } finally {
      setExportingWorkbench(false);
    }
  };

  const handleCreateTrackerRow = async (item: MeetingTrackerFollowUpItem) => {
    const tracker = meetingTrackers[0];
    if (!tracker) {
      window.alert("请先创建会议跟踪表，再把会议入库。");
      return;
    }

    setTrackerIntakeBusyId(item.id);
    setTrackerIntakeMessage(null);
    try {
      const [trackerFields, trackerRows] = await Promise.all([
        getFields(tracker.id),
        getRows(tracker.id),
      ]);
      const existingRow = findExistingMeetingTrackerRow(
        trackerRows,
        trackerFields,
        item.page_id
      );
      if (existingRow) {
        setTrackerIntakeMessage(
          `已存在 tracker row：${existingRow.row_title}。已打开跟踪表继续补 relation。`
        );
        router.push(
          `/database/${tracker.id}?q=${encodeURIComponent(
            item.page_title
          )}&focus=${item.page_id}`
        );
        return;
      }

      const draft = buildMeetingTrackerIntakeDraft(item, trackerFields);
      const hasMeetingNoteRelation = draft.mapped_fields.some(
        (field) => field.mapped_value === "meeting-note-relation"
      );
      if (!hasMeetingNoteRelation) {
        window.alert(
          "当前会议跟踪表缺少 Meeting note relation 字段，请先补字段后再入库。"
        );
        return;
      }

      await addRow(tracker.id, {
        title: draft.row_title,
        fieldValues: draft.field_values,
        contentText: draft.row_page_content,
      });
      setTrackerIntakeMessage(
        `已创建 tracker row：${draft.row_title}。已打开跟踪表继续补 relation。`
      );
      router.push(
        `/database/${tracker.id}?q=${encodeURIComponent(
          draft.row_title
        )}&focus=${item.page_id}`
      );
    } catch (err) {
      console.error("[Zhinote] Failed to create meeting tracker row:", err);
      window.alert("会议入库失败，请查看控制台。");
    } finally {
      setTrackerIntakeBusyId(null);
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
                会议工作台
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把 follow-up、投研闭环、研究任务队列、Playbook 和会议入库台合并成
                一个本地 action packet：先建会议记录，再处理 transcript、会议结论、
                研究任务、tracker intake、公司/报告关联和隐私边界。导出不包含会议标题、
                页面正文、transcript text、录音 bytes、参会人详情、meeting passcodes、
                数据库 row values、持仓或交易计划。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportWorkbench}
              disabled={exportingWorkbench}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingWorkbench ? "导出中..." : "导出会议工作台"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <MeetingWorkbenchMetric
              label="会议页"
              value={meetingWorkbench.summary.meeting_pages}
            />
            <MeetingWorkbenchMetric
              label="转录页"
              value={meetingWorkbench.summary.transcript_pages}
            />
            <MeetingWorkbenchMetric
              label="Follow-up"
              value={meetingWorkbench.summary.follow_up_items}
            />
            <MeetingWorkbenchMetric
              label="闭环待补"
              value={meetingWorkbench.summary.decision_ledger_items}
            />
            <MeetingWorkbenchMetric
              label="任务队列"
              value={meetingWorkbench.summary.research_queue_items}
            />
            <MeetingWorkbenchMetric
              label="入库候选"
              value={meetingWorkbench.summary.tracker_intake_candidates}
            />
            <MeetingWorkbenchMetric
              label="高优先级"
              value={meetingWorkbench.summary.high_priority_actions}
            />
            <MeetingWorkbenchMetric
              label="边界阻止"
              value={meetingWorkbench.summary.blocked_actions}
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                工作台 lanes
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {meetingWorkbench.lanes.map((lane) => (
                  <MeetingWorkbenchLaneCard key={lane.id} lane={lane} />
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                优先动作
              </div>
              <div className="mt-2 space-y-2">
                {meetingWorkbench.actions.slice(0, 6).map((action) => (
                  <MeetingWorkbenchActionCard
                    key={action.id}
                    action={action}
                    onNavigate={(route) => router.push(route)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {meetingWorkbench.review_sequence.map((step) => (
              <div
                key={step.id}
                className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800"
              >
                <div className="text-[11px] text-zinc-400">Step {step.order}</div>
                <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
                  {step.title}
                </div>
                <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
                  {step.reason}
                </p>
                <p className="mt-2 leading-5 text-zinc-400">
                  完成信号：{step.completion_signal}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                会议研究任务队列
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把 follow-up 队列和投研闭环合并成可执行的本地任务：
                Transcript 复盘、会议结论、模型更新、风险/催化剂、开放问题、
                relation 和 tracker 入库。导出只包含结构状态，不包含会议正文、
                transcript text、录音 bytes、参会人详情、meeting passcodes、
                数据库 row values、持仓或交易计划。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportResearchQueue}
              disabled={exportingResearchQueue}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingResearchQueue ? "导出中..." : "导出任务队列"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-9">
            <MeetingResearchQueueMetric
              label="任务"
              value={meetingResearchQueue.summary.queue_items}
              detail="Research queue"
              status={queueMetricStatus(
                meetingResearchQueue.summary.queue_items
              )}
            />
            <MeetingResearchQueueMetric
              label="待复核"
              value={meetingResearchQueue.summary.review_needed_items}
              detail="Needs review"
              status={queueMetricStatus(
                meetingResearchQueue.summary.review_needed_items
              )}
            />
            <MeetingResearchQueueMetric
              label="Blocked"
              value={meetingResearchQueue.summary.blocked_items}
              detail="Setup first"
              status={
                meetingResearchQueue.summary.blocked_items > 0
                  ? "blocked"
                  : "ready"
              }
            />
            <MeetingResearchQueueMetric
              label="High"
              value={meetingResearchQueue.summary.high_priority_items}
              detail="Priority"
              status={
                meetingResearchQueue.summary.high_priority_items > 0
                  ? "review-needed"
                  : "ready"
              }
            />
            <MeetingResearchQueueMetric
              label="Transcript"
              value={meetingResearchQueue.summary.transcript_review_items}
              detail="复盘"
              status={queueMetricStatus(
                meetingResearchQueue.summary.transcript_review_items
              )}
            />
            <MeetingResearchQueueMetric
              label="结论"
              value={meetingResearchQueue.summary.decision_capture_items}
              detail="Decision"
              status={queueMetricStatus(
                meetingResearchQueue.summary.decision_capture_items
              )}
            />
            <MeetingResearchQueueMetric
              label="模型"
              value={meetingResearchQueue.summary.model_update_items}
              detail="Model"
              status={queueMetricStatus(
                meetingResearchQueue.summary.model_update_items
              )}
            />
            <MeetingResearchQueueMetric
              label="风险/催化"
              value={meetingResearchQueue.summary.risk_catalyst_items}
              detail="Risk"
              status={queueMetricStatus(
                meetingResearchQueue.summary.risk_catalyst_items
              )}
            />
            <MeetingResearchQueueMetric
              label="关系/入库"
              value={
                meetingResearchQueue.summary.relation_linking_items +
                meetingResearchQueue.summary.tracker_intake_items
              }
              detail="Relation"
              status={queueMetricStatus(
                meetingResearchQueue.summary.relation_linking_items +
                  meetingResearchQueue.summary.tracker_intake_items
              )}
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Research queue gates
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
                {meetingResearchQueue.gates.map((gate) => (
                  <MeetingResearchQueueGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Top research tasks
              </div>
              {meetingResearchQueue.items.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {meetingResearchQueue.items.slice(0, 8).map((item) => (
                    <MeetingResearchQueueItemCard
                      key={item.id}
                      item={item}
                      onOpen={() => router.push(item.route)}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                  当前没有会议研究任务。下一步可以维护 relation 值、复盘节奏和最新结论。
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                会议入库台
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把单个会议页创建成会议跟踪表 row，并自动填入 Meeting note relation、
                Status、Follow-up needed 和 Action items。点击后只做本地单条写入，
                不会自动入会、录音、发布、同步、上传或调用 AI。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`rounded-md px-2 py-1 ${
                  meetingTrackers.length > 0
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {meetingTrackers.length > 0 ? "Tracker ready" : "缺会议跟踪表"}
              </span>
              <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                本地单条写入
              </span>
            </div>
          </div>
          {trackerIntakeMessage && (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs leading-5 text-green-700 dark:bg-green-950 dark:text-green-300">
              {trackerIntakeMessage}
            </p>
          )}
          {meetingFollowUp.items.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {meetingFollowUp.items.slice(0, 6).map((item) => (
                <MeetingTrackerIntakeCard
                  key={item.id}
                  item={item}
                  trackerReady={meetingTrackers.length > 0}
                  busy={trackerIntakeBusyId === item.id}
                  onCreate={() => void handleCreateTrackerRow(item)}
                  onOpen={() => router.push(item.route)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
              还没有可入库的会议页。先新建会议纪要，再把它创建成会议跟踪表 row。
            </p>
          )}
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

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                会议投研闭环
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                本地检查会议是否已经沉淀为会议结论、Thesis 影响、模型影响、
                风险监控、催化剂跟进和开放问题。导出只包含结构状态，
                不包含会议正文、transcript text、录音 bytes、参会人详情、
                meeting passcodes、持仓或交易计划。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportDecisionLedger}
              disabled={exportingDecisionLedger}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingDecisionLedger ? "导出中..." : "导出闭环"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-8">
            <MeetingDecisionMetric
              label="信号面"
              value={meetingDecisionLedger.summary.decision_signals}
              detail="Decision checks"
              status="partial"
            />
            <MeetingDecisionMetric
              label="Ready"
              value={meetingDecisionLedger.summary.ready_signals}
              detail="全会议覆盖"
              status="ready"
            />
            <MeetingDecisionMetric
              label="Missing"
              value={meetingDecisionLedger.summary.missing_signals}
              detail="完全缺失"
              status={
                meetingDecisionLedger.summary.missing_signals > 0
                  ? "missing"
                  : "ready"
              }
            />
            <MeetingDecisionMetric
              label="会议结论"
              value={meetingDecisionLedger.summary.meetings_with_decision_summary}
              detail="Decision"
              status={decisionMetricStatus(
                meetingDecisionLedger.summary.meetings_with_decision_summary,
                meetingDecisionLedger.summary.meeting_pages
              )}
            />
            <MeetingDecisionMetric
              label="Thesis"
              value={meetingDecisionLedger.summary.meetings_with_thesis_impact}
              detail="假设影响"
              status={decisionMetricStatus(
                meetingDecisionLedger.summary.meetings_with_thesis_impact,
                meetingDecisionLedger.summary.meeting_pages
              )}
            />
            <MeetingDecisionMetric
              label="模型影响"
              value={meetingDecisionLedger.summary.meetings_with_model_impact}
              detail="Model"
              status={decisionMetricStatus(
                meetingDecisionLedger.summary.meetings_with_model_impact,
                meetingDecisionLedger.summary.meeting_pages
              )}
            />
            <MeetingDecisionMetric
              label="风险/催化"
              value={
                meetingDecisionLedger.summary.meetings_with_risk_watch +
                meetingDecisionLedger.summary.meetings_with_catalyst_follow_up
              }
              detail="Risk + catalyst"
              status={compoundDecisionMetricStatus(
                meetingDecisionLedger.summary.meetings_with_risk_watch,
                meetingDecisionLedger.summary.meetings_with_catalyst_follow_up,
                meetingDecisionLedger.summary.meeting_pages
              )}
            />
            <MeetingDecisionMetric
              label="待补会议"
              value={meetingDecisionLedger.summary.ledger_items}
              detail="Needs ledger"
              status={
                meetingDecisionLedger.summary.ledger_items > 0
                  ? "missing"
                  : "ready"
              }
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                结构信号
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
                {meetingDecisionLedger.signals.map((signal) => (
                  <MeetingDecisionSignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                待沉淀会议
              </div>
              {meetingDecisionLedger.items.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {meetingDecisionLedger.items.slice(0, 6).map((item) => (
                    <MeetingDecisionItemCard
                      key={item.id}
                      item={item}
                      onOpen={() => router.push(item.route)}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                  当前会议页已经覆盖基础投研闭环结构，下一步可以补 relation 值和最新结论。
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                会议研究 Playbook
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把 follow-up 队列转成本地行动队列：补会议背景、Transcript 页面、
                action items、公司/报告 relation、会议跟踪表和复盘节奏。导出只包含结构状态，
                不包含会议正文、transcript text、录音 bytes、参会人详情或 meeting passcodes。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPlaybook}
              disabled={exportingPlaybook}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingPlaybook ? "导出中..." : "导出 Playbook"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-9">
            <MeetingPlaybookMetric
              label="步骤"
              value={meetingPlaybook.summary.workflow_steps}
              detail="Workflow"
              status="partial"
            />
            <MeetingPlaybookMetric
              label="Ready"
              value={meetingPlaybook.summary.ready_steps}
              detail="已覆盖"
              status="ready"
            />
            <MeetingPlaybookMetric
              label="Missing"
              value={meetingPlaybook.summary.missing_steps}
              detail="待补齐"
              status={
                meetingPlaybook.summary.missing_steps > 0 ? "missing" : "ready"
              }
            />
            <MeetingPlaybookMetric
              label="需确认"
              value={meetingPlaybook.summary.manual_confirmation_steps}
              detail="人工复核"
              status="manual-confirmation"
            />
            <MeetingPlaybookMetric
              label="行动队列"
              value={meetingPlaybook.summary.action_queue_items}
              detail="Next actions"
              status={
                meetingPlaybook.summary.action_queue_items > 0
                  ? "missing"
                  : "ready"
              }
            />
            <MeetingPlaybookMetric
              label="候选会议"
              value={meetingPlaybook.summary.candidate_meetings}
              detail="Needs work"
              status={
                meetingPlaybook.summary.candidate_meetings > 0
                  ? "missing"
                  : "ready"
              }
            />
            <MeetingPlaybookMetric
              label="Transcript"
              value={meetingPlaybook.summary.transcript_gaps}
              detail="待连接"
              status={
                meetingPlaybook.summary.transcript_gaps > 0
                  ? "missing"
                  : "ready"
              }
            />
            <MeetingPlaybookMetric
              label="Action items"
              value={meetingPlaybook.summary.action_item_gaps}
              detail="待提取"
              status={
                meetingPlaybook.summary.action_item_gaps > 0
                  ? "missing"
                  : "ready"
              }
            />
            <MeetingPlaybookMetric
              label="关系门"
              value={meetingPlaybook.summary.relation_gates}
              detail="Company/report"
              status={
                meetingPlaybook.summary.relation_gates > 0
                  ? "missing"
                  : "ready"
              }
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                行动队列
              </div>
              {meetingPlaybook.action_queue.length > 0 ? (
                meetingPlaybook.action_queue.map((item) => (
                  <MeetingPlaybookActionCard key={item.id} item={item} />
                ))
              ) : (
                <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                  当前没有结构性会议缺口。下一步可以维护 relation 值、复盘节奏和最新结论。
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                研究步骤
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {meetingPlaybook.steps.map((step) => (
                  <MeetingPlaybookStepCard key={step.id} step={step} />
                ))}
              </div>
            </div>
          </div>
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

function MeetingWorkbenchMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function MeetingWorkbenchLaneCard({
  lane,
}: {
  lane: MeetingWorkbenchPacket["lanes"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {lane.title}
        </div>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          {lane.action_count} 动作
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {lane.description}
      </p>
      <div className="mt-2 flex flex-wrap gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          高优先级 {lane.high_priority_count}
        </span>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          {lane.route}
        </span>
      </div>
    </article>
  );
}

function MeetingWorkbenchActionCard({
  action,
  onNavigate,
}: {
  action: MeetingWorkbenchPacket["actions"][number];
  onNavigate: (route: string) => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <MeetingWorkbenchPriorityPill priority={action.priority} />
        <MeetingWorkbenchStatusPill status={action.status} />
        {action.requires_manual_confirmation && (
          <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            需确认
          </span>
        )}
      </div>
      <div className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">
        {action.title}
      </div>
      <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
        {action.next_action}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
        {action.privacy_boundary}
      </p>
      <button
        type="button"
        onClick={() => onNavigate(action.action_route)}
        className="mt-3 rounded-md border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {action.route_label}
      </button>
    </article>
  );
}

function MeetingWorkbenchPriorityPill({
  priority,
}: {
  priority: MeetingWorkbenchPriority;
}) {
  const labels: Record<MeetingWorkbenchPriority, string> = {
    high: "高优先级",
    medium: "中优先级",
    low: "低优先级",
  };
  const className =
    priority === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : priority === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[priority]}
    </span>
  );
}

function MeetingWorkbenchStatusPill({
  status,
}: {
  status: MeetingWorkbenchStatus;
}) {
  const labels: Record<MeetingWorkbenchStatus, string> = {
    ready: "Ready",
    "review-needed": "需复核",
    missing: "Missing",
    "blocked-boundary": "边界阻止",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "review-needed"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : status === "blocked-boundary"
          ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
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

function MeetingTrackerIntakeCard({
  item,
  trackerReady,
  busy,
  onCreate,
  onOpen,
}: {
  item: MeetingTrackerFollowUpItem;
  trackerReady: boolean;
  busy: boolean;
  onCreate: () => void;
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
        <FollowUpPriorityPill priority={item.priority} />
      </div>
      <div className="mt-3 grid gap-1 sm:grid-cols-2">
        <FollowUpFlag label="Transcript" ready={item.has_transcript} />
        <FollowUpFlag label="Action items" ready={item.has_action_items} />
        <FollowUpFlag label="Company" ready={item.has_company_link} />
        <FollowUpFlag label="Report" ready={item.has_report_link} />
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        将创建一条本地 tracker row，写入 Meeting note relation、状态、
        follow-up 标记和下一步动作。
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
        本地单条写入；不导出 transcript text、录音 bytes、参会人详情或 meeting passcodes。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={!trackerReady || busy}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        >
          {busy ? "创建中..." : "创建 tracker row"}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          打开会议页
        </button>
      </div>
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

function MeetingDecisionMetric({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: MeetingDecisionStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <MeetingDecisionStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function MeetingDecisionSignalCard({
  signal,
}: {
  signal: MeetingDecisionLedgerReport["signals"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {signal.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {signal.evidence}
          </p>
        </div>
        <MeetingDecisionStatusPill status={signal.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {signal.next_action}
      </p>
      <p className="mt-2 leading-5 text-zinc-400">
        {signal.privacy_boundary}
      </p>
    </article>
  );
}

function MeetingDecisionItemCard({
  item,
  onOpen,
}: {
  item: MeetingDecisionLedgerReport["items"][number];
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
            {item.ready_signals.length} 个信号已覆盖
          </div>
        </div>
        <MeetingDecisionPriorityPill priority={item.priority} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {item.missing_signals.slice(0, 6).map((signalId) => (
          <span
            key={signalId}
            className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          >
            缺 {getMeetingDecisionSignalLabel(signalId)}
          </span>
        ))}
      </div>
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

function MeetingDecisionStatusPill({
  status,
}: {
  status: MeetingDecisionStatus;
}) {
  const labels: Record<MeetingDecisionStatus, string> = {
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

function MeetingDecisionPriorityPill({
  priority,
}: {
  priority: MeetingDecisionPriority;
}) {
  const labels: Record<MeetingDecisionPriority, string> = {
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

function MeetingResearchQueueMetric({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: MeetingResearchQueueStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <MeetingResearchQueueStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function MeetingResearchQueueGateRow({
  gate,
}: {
  gate: MeetingResearchQueueReport["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {gate.evidence}
          </p>
        </div>
        <MeetingResearchQueueStatusPill status={gate.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {gate.next_action}
      </p>
      <p className="mt-2 leading-5 text-zinc-400">
        {gate.privacy_boundary}
      </p>
    </article>
  );
}

function MeetingResearchQueueItemCard({
  item,
  onOpen,
}: {
  item: MeetingResearchQueueReport["items"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {item.page_title}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <MeetingResearchQueueWorkstreamPill workstream={item.workstream} />
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {item.source}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <FollowUpPriorityPill priority={item.priority} />
          <MeetingResearchQueueRiskPill risk={item.risk} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <MeetingResearchQueueStatusPill status={item.status} />
        {item.missing_structures.slice(0, 4).map((structure) => (
          <span
            key={structure}
            className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          >
            缺 {structure}
          </span>
        ))}
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {item.trigger}
      </p>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
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

function MeetingResearchQueueStatusPill({
  status,
}: {
  status: MeetingResearchQueueStatus;
}) {
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "review-needed"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {getMeetingResearchQueueStatusLabel(status)}
    </span>
  );
}

function MeetingResearchQueueRiskPill({
  risk,
}: {
  risk: MeetingResearchQueueRisk;
}) {
  const className =
    risk === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : risk === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {getMeetingResearchQueueRiskLabel(risk)}
    </span>
  );
}

function MeetingResearchQueueWorkstreamPill({
  workstream,
}: {
  workstream: MeetingResearchQueueWorkstream;
}) {
  return (
    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      {getMeetingResearchQueueWorkstreamLabel(workstream)}
    </span>
  );
}

function MeetingPlaybookMetric({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: MeetingResearchPlaybookStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <MeetingPlaybookStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function MeetingPlaybookActionCard({
  item,
}: {
  item: MeetingResearchPlaybook["action_queue"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {item.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {item.reason}
          </p>
        </div>
        <MeetingPlaybookStatusPill status={item.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        {item.applies_to.map((stepId) => (
          <span
            key={stepId}
            className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400"
          >
            {getMeetingPlaybookStepLabel(stepId)}
          </span>
        ))}
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          去：{item.suggested_destination}
        </span>
      </div>
    </article>
  );
}

function MeetingPlaybookStepCard({
  step,
}: {
  step: MeetingResearchPlaybook["steps"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            {step.title}
          </h3>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {step.evidence}
          </p>
        </div>
        <MeetingPlaybookStatusPill status={step.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {getMeetingSurfaceLabel(step.surface)}
        </span>
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {step.next_action}
      </p>
      <p className="mt-2 leading-5 text-zinc-400">
        {step.privacy_boundary}
      </p>
    </article>
  );
}

function MeetingPlaybookStatusPill({
  status,
}: {
  status: MeetingResearchPlaybookStatus;
}) {
  const labels: Record<MeetingResearchPlaybookStatus, string> = {
    ready: "Ready",
    partial: "Partial",
    missing: "Missing",
    "manual-confirmation": "需确认",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "partial"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : status === "manual-confirmation"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function getMeetingPlaybookStepLabel(
  stepId: MeetingResearchPlaybook["steps"][number]["id"]
) {
  const labels: Record<
    MeetingResearchPlaybook["steps"][number]["id"],
    string
  > = {
    "meeting-context": "会议背景",
    "transcript-review": "转录复盘",
    "action-items": "行动项",
    "company-linking": "公司关联",
    "report-linking": "报告关联",
    "meeting-tracker": "会议跟踪表",
    "follow-up-cadence": "复盘节奏",
  };

  return labels[stepId];
}

function getMeetingSurfaceLabel(
  surface: MeetingResearchPlaybook["steps"][number]["surface"]
) {
  const labels: Record<
    MeetingResearchPlaybook["steps"][number]["surface"],
    string
  > = {
    page: "页面",
    database: "数据库",
    file: "文件",
    relation: "Relation",
    review: "复盘节奏",
  };

  return labels[surface];
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

function decisionMetricStatus(
  count: number,
  total: number
): MeetingDecisionStatus {
  if (total === 0 || count === 0) return "missing";
  if (count === total) return "ready";
  return "partial";
}

function compoundDecisionMetricStatus(
  firstCount: number,
  secondCount: number,
  total: number
): MeetingDecisionStatus {
  if (total === 0 || firstCount === 0 || secondCount === 0) return "missing";
  if (firstCount === total && secondCount === total) return "ready";
  return "partial";
}

function queueMetricStatus(count: number): MeetingResearchQueueStatus {
  return count > 0 ? "review-needed" : "ready";
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
