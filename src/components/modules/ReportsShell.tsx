"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import ResearchConnectionsPanel from "@/components/modules/ResearchConnectionsPanel";
import ResearchWorkflowSchemaPanel from "@/components/modules/ResearchWorkflowSchemaPanel";
import { usePages } from "@/hooks/usePages";
import {
  createPage,
  getAllDatabases,
  updatePage,
} from "@/lib/db/local/queries";
import { FILE_PREVIEW_ACCEPT } from "@/components/editor/filePreviewUpload";
import {
  FILE_PREVIEW_CAPABILITIES,
  type FilePreviewCapability,
  type FilePreviewSupportLevel,
} from "@/lib/files/filePreviewCapabilities";
import { createFilePreviewBlockHtml } from "@/lib/files/filePreviewBlock";
import { savePageFile, type StoredPageFile } from "@/lib/files/localStore";
import { executeModuleStarter } from "@/lib/modules/actions";
import { PLATFORM_MODULES, type ModuleStarter } from "@/lib/modules/registry";
import {
  buildReportIntakeReport,
  type ReportIntakeItem,
  type ReportIntakePriority,
  type ReportIntakeStage,
} from "@/lib/reports/reportIntake";
import {
  buildReportFormatPlaybook,
  type ReportFormatAction,
  type ReportFormatConfirmationStatus,
  type ReportFormatPlaybook,
} from "@/lib/reports/reportFormatPlaybook";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

const REPORT_FILE_ACTION_LABEL = "上传报告文件";

const REPORT_TEMPLATE_STARTERS: ModuleStarter[] = [
  {
    type: "page",
    label: "新建报告笔记",
    title: "未命名研究报告",
    templateTitle: "研究报告",
    icon: "RPT",
  },
];

const WORKFLOW_STEPS = [
  {
    title: "收集报告",
    detail:
      "用报告页承载本地文件预览块、报告元数据和第一遍阅读笔记。",
  },
  {
    title: "复盘与总结",
    detail:
      "跟踪核心结论、对投资假设的影响、对模型的影响、待回答问题和后续动作。",
  },
  {
    title: "关联研究",
    detail:
      "用 relation 字段把报告关联到公司、会议、备忘录和业绩复盘。",
  },
  {
    title: "本地留存",
    detail:
      "在明确启用同步或 AI 前，HTML、Markdown、PDF、Office、notebook 和压缩包预览都留在本地。",
  },
];

export default function ReportsShell() {
  return (
    <DatabaseProvider>
      <ReportsContent />
    </DatabaseProvider>
  );
}

function ReportsContent() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <ReportsDashboard />
      </main>
    </div>
  );
}

function ReportsDashboard() {
  const router = useRouter();
  const { pages, refresh } = usePages();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportingIntake, setExportingIntake] = useState(false);
  const [exportingFormatPlaybook, setExportingFormatPlaybook] = useState(false);
  const reportFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void getAllDatabases()
      .then(setDatabases)
      .catch((err) => {
        console.error("[Zhinote] Failed to load report databases:", err);
      });
  }, []);

  const reportPages = useMemo(() => getReportPages(pages), [pages]);
  const filePreviewPages = useMemo(() => getFilePreviewPages(pages), [pages]);
  const htmlReportPages = useMemo(() => getHtmlReportPages(pages), [pages]);
  const reportTrackers = useMemo(
    () => databases.filter(isReportTrackerDatabase),
    [databases]
  );
  const reportIntake = useMemo(() => buildReportIntakeReport(pages), [pages]);
  const reportFormatPlaybook = useMemo(
    () => buildReportFormatPlaybook(reportIntake),
    [reportIntake]
  );

  const reportsModule = PLATFORM_MODULES.find((module) => module.id === "reports");
  const trackerStarter = reportsModule?.starter ?? null;

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
      console.error("[Zhinote] Failed to run report starter:", err);
      window.alert("报告库动作失败，请查看控制台。");
    } finally {
      setBusyAction(null);
    }
  };

  const handleChooseReportFile = () => {
    reportFileInputRef.current?.click();
  };

  const handleReportFileSelected = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setBusyAction(REPORT_FILE_ACTION_LABEL);
    try {
      const storedFile = await savePageFile(file);
      const page = await createPage({
        title: reportPageTitleFromFile(storedFile.name),
        icon: "RPT",
      });
      await updatePage(page.id, {
        content_text: createReportPageContent(storedFile),
      });
      await refresh();
      router.push(`/page/${page.id}`);
    } catch (err) {
      console.error("[Zhinote] Failed to create report page from file:", err);
      window.alert(
        "无法从这个本地文件创建报告页。文件没有上传；请检查浏览器是否允许本地存储。"
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportIntake = () => {
    setExportingIntake(true);
    try {
      downloadJsonFile(`zhinote-report-intake-${fileSafeTimestamp()}.json`, {
        ...reportIntake,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export report intake:", err);
      window.alert("Report intake export failed. Please check the console.");
    } finally {
      setExportingIntake(false);
    }
  };

  const handleExportFormatPlaybook = () => {
    setExportingFormatPlaybook(true);
    try {
      downloadJsonFile(
        `zhinote-report-format-playbook-${fileSafeTimestamp()}.json`,
        {
          ...reportFormatPlaybook,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export report format playbook:", err);
      window.alert("报告格式 Playbook 导出失败，请查看控制台。");
    } finally {
      setExportingFormatPlaybook(false);
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
                报告库
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                管理本地 HTML 报告、Markdown 笔记、PDF、Office 文件、notebook、
                压缩包、核心结论，以及与公司或会议的关联。
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
          <Metric label="报告页面" value={reportPages.length} />
          <Metric label="文件预览页面" value={filePreviewPages.length} />
          <Metric label="HTML 报告" value={htmlReportPages.length} />
          <Metric label="跟踪表" value={reportTrackers.length} />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                创建报告资产
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                这些动作只会创建本地页面或数据库，不会上传报告、不会调用 AI、不会同步文件，也不会加载外部资源。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={reportFileInputRef}
                type="file"
                accept={FILE_PREVIEW_ACCEPT}
                className="hidden"
                onChange={(event) => void handleReportFileSelected(event)}
              />
              <StarterButton
                label={REPORT_FILE_ACTION_LABEL}
                busy={busyAction === REPORT_FILE_ACTION_LABEL}
                emphasis
                onClick={handleChooseReportFile}
              />
              {REPORT_TEMPLATE_STARTERS.map((starter) => (
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
                报告 intake 队列
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                从本地 page 的 file-preview block 元数据生成待处理报告队列，
                用来判断格式、优先级、下一步动作和关联缺口。这个报告不读取文件 bytes、
                不调用 AI、不连接云服务。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportIntake}
              disabled={exportingIntake}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingIntake ? "Exporting..." : "Export intake"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            <IntakeMetric
              label="待处理"
              value={reportIntake.summary.intake_items}
              detail="File blocks"
            />
            <IntakeMetric
              label="高优先级"
              value={reportIntake.summary.high_priority}
              detail="Review first"
            />
            <IntakeMetric
              label="格式类型"
              value={reportIntake.summary.unique_file_kinds}
              detail="Kinds"
            />
            <IntakeMetric
              label="HTML"
              value={reportIntake.summary.html_reports}
              detail="Reports"
            />
            <IntakeMetric
              label="表格候选"
              value={reportIntake.summary.spreadsheet_candidates}
              detail="DB import"
            />
            <IntakeMetric
              label="页面扫描"
              value={reportIntake.summary.pages_scanned}
              detail="Local only"
            />
            <IntakeMetric
              label="队列阶段"
              value={reportIntake.lanes.length}
              detail="Workflow"
            />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {reportIntake.lanes.map((lane) => (
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
          {reportIntake.items.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {reportIntake.items.slice(0, 8).map((item) => (
                <ReportIntakeItemCard
                  key={item.id}
                  item={item}
                  onOpen={() => router.push(`/page/${item.page_id}`)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
              还没有待处理报告文件。点击“上传报告文件”后，新页面会自动进入这个本地 intake 队列。
            </p>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                格式处理 Playbook
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把 intake 队列里的格式拆成处理路线：HTML 报告优先原生预览，
                Markdown 笔记优先可编辑导入，表格走数据库候选，其它文件保留本地原件和复核步骤。
                这个 Playbook 不读取文件 bytes、文件文本或页面正文。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportFormatPlaybook}
              disabled={exportingFormatPlaybook}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingFormatPlaybook ? "导出中..." : "导出 Playbook"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <IntakeMetric
              label="路线"
              value={reportFormatPlaybook.summary.format_routes}
              detail="Format kinds"
            />
            <IntakeMetric
              label="原生预览"
              value={reportFormatPlaybook.summary.native_preview_routes}
              detail="HTML/PDF/media"
            />
            <IntakeMetric
              label="可编辑导入"
              value={reportFormatPlaybook.summary.editable_import_routes}
              detail="Markdown/docs"
            />
            <IntakeMetric
              label="数据库候选"
              value={reportFormatPlaybook.summary.database_import_routes}
              detail="Spreadsheet"
            />
            <IntakeMetric
              label="元数据复核"
              value={reportFormatPlaybook.summary.metadata_review_routes}
              detail="Archive/unknown"
            />
            <IntakeMetric
              label="确认项"
              value={reportFormatPlaybook.summary.confirmation_queue_items}
              detail="Before risky actions"
            />
            <IntakeMetric
              label="HTML"
              value={reportFormatPlaybook.summary.html_reports}
              detail="Native target"
            />
            <IntakeMetric
              label="Markdown"
              value={reportFormatPlaybook.summary.markdown_notes}
              detail="Editable target"
            />
          </div>
          <div className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              原生格式策略：
            </span>{" "}
            ZhiNotes page 是统一容器；HTML 作为 AI 可视化报告的首选原生预览格式，
            Markdown 作为自己写笔记的首选可编辑源格式，Excel/CSV/ODS 在确认后进入本地数据库，
            原始文件继续保留在本地附件里。
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                确认队列
              </div>
              {reportFormatPlaybook.confirmation_queue.length > 0 ? (
                reportFormatPlaybook.confirmation_queue.map((confirmation) => (
                  <FormatConfirmationRow
                    key={confirmation.id}
                    confirmation={confirmation}
                  />
                ))
              ) : (
                <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                  当前没有需要确认的格式动作。上传 HTML、表格或可转换文件后会自动生成确认队列。
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                格式路线
              </div>
              {reportFormatPlaybook.routes.length > 0 ? (
                reportFormatPlaybook.routes.map((route) => (
                  <FormatRouteCard key={route.id} route={route} />
                ))
              ) : (
                <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                  还没有格式路线。上传报告文件后，这里会按文件类型生成处理 Playbook。
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              报告工作流
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {WORKFLOW_STEPS.map((step) => (
                <WorkflowCard key={step.title} {...step} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              本地文件模型
            </h2>
            <div className="mt-3 space-y-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              <p>
                报告文件会以文件预览块的形式挂在本地页面上。预览层支持 HTML、Markdown、
                PDF、Office 文档、表格、演示文稿、notebook、EPUB、压缩包、媒体和文本/代码文件。
              </p>
              <p>
                HTML 报告预览默认阻止外部资源。未来如果要启用 AI 总结或 Web 同步，
                必须先经过明确确认。
              </p>
            </div>
          </div>
        </section>

        <ResearchWorkflowSchemaPanel kind="report" />

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                格式支持矩阵
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                这里是报告库当前承诺的本地预览能力。所有转换都在浏览器本地完成；
                外部资源、批量导入、AI 外发和云同步仍走单独确认边界。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
              <SupportSummaryCard
                label="原生"
                count={countCapabilities("native")}
              />
              <SupportSummaryCard
                label="转换"
                count={countCapabilities("converted")}
              />
              <SupportSummaryCard
                label="元数据"
                count={countCapabilities("metadata")}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {FILE_PREVIEW_CAPABILITIES.map((capability) => (
              <FormatCapabilityCard
                key={capability.id}
                capability={capability}
              />
            ))}
          </div>
        </section>

        <ResearchConnectionsPanel
          pages={pages}
          databases={databases}
          focusKind="report"
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <ResourceList
            title="最近报告页面"
            emptyText="还没有报告页面。"
            items={reportPages.slice(0, 6).map((page) => ({
              id: page.id,
              label: page.title || "未命名研究报告",
              meta: formatUpdated(page.updated_at),
              onOpen: () => router.push(`/page/${page.id}`),
            }))}
          />
          <ResourceList
            title="报告跟踪表"
            emptyText="还没有报告跟踪数据库。"
            items={reportTrackers.map((database) => ({
              id: database.id,
              label: database.title || "报告库跟踪表",
              meta: database.description ?? "本地报告数据库",
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

function IntakeMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function ReportIntakeItemCard({
  item,
  onOpen,
}: {
  item: ReportIntakeItem;
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {item.file_name}
          </div>
          <div className="mt-1 truncate text-zinc-400">
            {item.page_title} · {item.file_size_label}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <IntakePriorityPill priority={item.priority} />
          <IntakeStagePill stage={item.stage} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {item.file_kind}
        </span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {item.preview_support}
        </span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          gaps: {item.relation_gaps.join(", ")}
        </span>
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
        打开报告页
      </button>
    </article>
  );
}

function FormatConfirmationRow({
  confirmation,
}: {
  confirmation: ReportFormatPlaybook["confirmation_queue"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {confirmation.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {confirmation.reason}
          </p>
        </div>
        <ConfirmationPill status={confirmation.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        {confirmation.applies_to_kinds.map((kind) => (
          <span
            key={kind}
            className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500"
          >
            {kind}
          </span>
        ))}
      </div>
    </article>
  );
}

function FormatRouteCard({
  route,
}: {
  route: ReportFormatPlaybook["routes"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {route.label}
        </h3>
        <ActionPill action={route.recommended_action} />
        <ConfirmationPill status={route.confirmation_status} />
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {route.item_count} files
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {route.page_handling}
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <RouteDetail label="预览" value={route.native_preview} />
        <RouteDetail label="可编辑" value={route.editable_import} />
        <RouteDetail label="数据库" value={route.database_import} />
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
        {route.confirmation_reason}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {route.relation_target.map((target) => (
          <span
            key={target}
            className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            关联：{target}
          </span>
        ))}
        {route.sample_file_names.map((fileName) => (
          <span
            key={fileName}
            className="max-w-full truncate rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {fileName}
          </span>
        ))}
      </div>
    </article>
  );
}

function RouteDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-zinc-50 px-2 py-2 dark:bg-zinc-900">
      <div className="text-[10px] font-semibold text-zinc-400">{label}</div>
      <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">{value}</p>
    </div>
  );
}

function IntakePriorityPill({
  priority,
}: {
  priority: ReportIntakePriority;
}) {
  const labels: Record<ReportIntakePriority, string> = {
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

function ActionPill({ action }: { action: ReportFormatAction }) {
  const labels: Record<ReportFormatAction, string> = {
    "native-preview": "原生预览",
    "editable-import": "可编辑导入",
    "database-import": "数据库导入",
    "metadata-review": "元数据复核",
    "download-retain": "保留下载",
  };
  const className =
    action === "native-preview"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : action === "editable-import"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : action === "database-import"
          ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
          : action === "metadata-review"
            ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[action]}
    </span>
  );
}

function ConfirmationPill({
  status,
}: {
  status: ReportFormatConfirmationStatus;
}) {
  const labels: Record<ReportFormatConfirmationStatus, string> = {
    required: "必须确认",
    recommended: "建议复核",
    "not-needed": "无需确认",
  };
  const className =
    status === "required"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : status === "recommended"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[status]}
    </span>
  );
}

function IntakeStagePill({ stage }: { stage: ReportIntakeStage }) {
  const labels: Record<ReportIntakeStage, string> = {
    captured: "Captured",
    "source-triage": "Triage",
    "reading-review": "Review",
    "database-review": "Database",
    linking: "Linking",
  };

  return (
    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      {labels[stage]}
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

function SupportSummaryCard({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
        {count}
      </div>
      <div>{label}</div>
    </div>
  );
}

function FormatCapabilityCard({
  capability,
}: {
  capability: FilePreviewCapability;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {capability.label}
        </h3>
        <SupportPill level={capability.support_level} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {capability.extensions.map((extension) => (
          <span
            key={extension}
            className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {extension}
          </span>
        ))}
      </div>
      <div className="mt-3 space-y-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        <p>{capability.preview}</p>
        <p>导入：{capability.editable_import}</p>
        <p>数据库：{capability.database_import}</p>
        <p>边界：{capability.privacy_boundary}</p>
        {capability.limitation && (
          <p className="text-amber-600 dark:text-amber-300">
            限制：{capability.limitation}
          </p>
        )}
      </div>
    </article>
  );
}

function SupportPill({ level }: { level: FilePreviewSupportLevel }) {
  const labels: Record<FilePreviewSupportLevel, string> = {
    native: "原生预览",
    converted: "本地转换",
    metadata: "元数据",
    "download-only": "仅下载",
  };
  const className =
    level === "native"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : level === "converted"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : level === "metadata"
          ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[level]}
    </span>
  );
}

function countCapabilities(level: FilePreviewSupportLevel) {
  return FILE_PREVIEW_CAPABILITIES.filter(
    (capability) => capability.support_level === level
  ).length;
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

function getReportPages(pages: Page[]) {
  return pages.filter((page) =>
    pageMatches(page, [
      "research report",
      "研究报告",
      "report review",
      "报告复盘",
      "key takeaways",
      "核心结论",
      "source report",
      "file preview",
    ])
  );
}

function getFilePreviewPages(pages: Page[]) {
  return pages.filter((page) =>
    (page.content_text ?? "").includes('data-type="file-preview"')
  );
}

function getHtmlReportPages(pages: Page[]) {
  return pages.filter((page) => {
    const content = (page.content_text ?? "").toLowerCase();
    return (
      content.includes('data-kind="html"') ||
      content.includes("html report") ||
      content.includes(".html")
    );
  });
}

function pageMatches(page: Page, terms: string[]) {
  const searchable = `${page.title ?? ""} ${page.content_text ?? ""}`.toLowerCase();
  return terms.some((term) => searchable.includes(term));
}

function isReportTrackerDatabase(database: Database) {
  const searchable = `${database.title ?? ""} ${
    database.description ?? ""
  }`.toLowerCase();
  return (
    searchable.includes("report library") ||
    searchable.includes("report tracker") ||
    searchable.includes("报告库") ||
    searchable.includes("报告跟踪")
  );
}

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近更新";
  return `更新于 ${date.toLocaleDateString()}`;
}

function reportPageTitleFromFile(fileName: string) {
  const baseName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return baseName ? `${baseName} 报告` : "未命名研究报告";
}

function createReportPageContent(file: StoredPageFile) {
  return `
    <h1>研究报告</h1>
    <h2>源报告</h2>
    <ul>
      <li>文件名：${escapeHtml(file.name)}</li>
      <li>格式：${escapeHtml(getReportFileKindLabel(file))}</li>
      <li>本地文件预览：</li>
    </ul>
    ${createFilePreviewBlockHtml(file)}
    <h2>关联研究</h2>
    <ul>
      <li>公司页面：</li>
      <li>相关会议：</li>
      <li>相关 memo：</li>
      <li>相关业绩复盘：</li>
    </ul>
    <h2>核心结论</h2>
    <ul>
      <li></li>
    </ul>
    <h2>投资假设影响</h2>
    <p></p>
    <h2>模型影响</h2>
    <p></p>
    <h2>待解决问题</h2>
    <ul data-type="taskList">
      <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
    </ul>
    <h2>后续行动</h2>
    <ul data-type="taskList">
      <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
    </ul>
  `;
}

function getReportFileKindLabel(file: StoredPageFile) {
  if (file.kind === "html") return "HTML 报告";
  if (file.kind === "markdown") return "Markdown 笔记";
  if (file.kind === "pdf") return "PDF";
  if (file.kind === "spreadsheet") return "表格文件";
  if (file.kind === "word") return "Word 文档";
  if (file.kind === "presentation") return "PPT 演示文稿";
  if (file.kind === "notebook") return "Notebook";
  if (file.kind === "archive") return "压缩包";
  if (file.kind === "epub") return "EPUB";
  return file.mimeType || "未知格式";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
