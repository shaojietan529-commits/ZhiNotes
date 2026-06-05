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
  addRow,
  createPage,
  getAllDatabases,
  getFields,
  getRows,
  updatePage,
} from "@/lib/db/local/queries";
import {
  FILE_PREVIEW_CAPABILITIES,
  type FilePreviewCapability,
  type FilePreviewSupportLevel,
} from "@/lib/files/filePreviewCapabilities";
import {
  buildFilePreviewReadinessReport,
  type FilePreviewReadinessReport,
  type FilePreviewReadinessStatus,
} from "@/lib/files/filePreviewReadiness";
import {
  buildFilePreviewRoutingPacket,
  type FilePreviewRoutingPacket,
  type FilePreviewRoutingStatus,
} from "@/lib/files/filePreviewRouting";
import {
  buildFileUploadPreflightReport,
  type FileUploadPreflightAction,
  type FileUploadPreflightGateStatus,
  type FileUploadPreflightReport,
  type FileUploadPreflightRisk,
} from "@/lib/files/fileUploadPreflight";
import {
  FILE_PREVIEW_ACTION_RECEIPT_EVENT,
  appendFilePreviewActionReceipt,
  buildFilePreviewActionReceipt,
  listFilePreviewActionReceipts,
  type FilePreviewActionKind,
  type FilePreviewActionReceipt,
} from "@/lib/files/filePreviewActionReceipts";
import { createFilePreviewBlockHtml } from "@/lib/files/filePreviewBlock";
import { savePageFile, type StoredPageFile } from "@/lib/files/localStore";
import { markdownToHtml } from "@/lib/markdown/markdownToHtml";
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
import {
  buildReportFormatCoverageReport,
  type ReportFormatCoverageReport,
  type ReportFormatCoverageStatus,
} from "@/lib/reports/reportFormatCoverage";
import {
  buildReportConversionReviewReport,
  type ReportConversionReviewReport,
  type ReportConversionReviewStatus,
  type ReportConversionRisk,
} from "@/lib/reports/reportConversionReview";
import {
  buildReportReviewQueue,
  type ReportReviewQueueReport,
  type ReportReviewQueueRisk,
  type ReportReviewQueueStatus,
  type ReportReviewQueueWorkstream,
} from "@/lib/reports/reportReviewQueue";
import {
  buildReportDecisionSummary,
  type ReportDecisionSummary,
  type ReportDecisionSummaryStatus,
} from "@/lib/reports/reportDecisionSummary";
import {
  buildReportTrackerIntakeDraft,
  findExistingReportTrackerRow,
} from "@/lib/reports/reportTrackerIntake";
import {
  buildReportConnectionPlan,
  type ReportConnectionActionStatus,
  type ReportConnectionPlan,
} from "@/lib/reports/reportConnectionPlan";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

const REPORT_FILE_ACTION_LABEL = "上传报告文件";
const MARKDOWN_EDITABLE_IMPORT_LABEL = "导入 Markdown 笔记";
const MARKDOWN_EDITABLE_IMPORT_ACCEPT =
  ".md,.markdown,.mdx,text/markdown,text/x-markdown,text/plain";

interface ReportFileBatchMessage {
  created: number;
  failed: number;
  total: number;
}

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
  const [exportingConnectionPlan, setExportingConnectionPlan] = useState(false);
  const [exportingFormatPlaybook, setExportingFormatPlaybook] = useState(false);
  const [exportingPreviewReadiness, setExportingPreviewReadiness] =
    useState(false);
  const [exportingPreviewRouting, setExportingPreviewRouting] = useState(false);
  const [exportingUploadPreflight, setExportingUploadPreflight] =
    useState(false);
  const [exportingFormatCoverage, setExportingFormatCoverage] =
    useState(false);
  const [exportingConversionReview, setExportingConversionReview] =
    useState(false);
  const [exportingReviewQueue, setExportingReviewQueue] = useState(false);
  const [exportingDecisionSummary, setExportingDecisionSummary] =
    useState(false);
  const [exportingFileActionReceipts, setExportingFileActionReceipts] =
    useState(false);
  const [fileActionReceipts, setFileActionReceipts] = useState<
    FilePreviewActionReceipt[]
  >([]);
  const [trackerIntakeBusyId, setTrackerIntakeBusyId] = useState<string | null>(
    null
  );
  const [trackerIntakeMessage, setTrackerIntakeMessage] = useState<string | null>(
    null
  );
  const [reportFileBatchMessage, setReportFileBatchMessage] =
    useState<ReportFileBatchMessage | null>(null);
  const reportFileInputRef = useRef<HTMLInputElement | null>(null);
  const markdownImportInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void getAllDatabases()
      .then(setDatabases)
      .catch((err) => {
        console.error("[Zhinote] Failed to load report databases:", err);
      });
  }, []);

  useEffect(() => {
    const refreshReceipts = () => {
      setFileActionReceipts(listFilePreviewActionReceipts());
    };

    refreshReceipts();
    window.addEventListener(FILE_PREVIEW_ACTION_RECEIPT_EVENT, refreshReceipts);
    return () => {
      window.removeEventListener(
        FILE_PREVIEW_ACTION_RECEIPT_EVENT,
        refreshReceipts
      );
    };
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
  const filePreviewReadiness = useMemo(
    () => buildFilePreviewReadinessReport(),
    []
  );
  const fileUploadPreflight = useMemo(
    () => buildFileUploadPreflightReport(),
    []
  );
  const reportFormatCoverage = useMemo(
    () =>
      buildReportFormatCoverageReport({
        intake: reportIntake,
        readiness: filePreviewReadiness,
      }),
    [filePreviewReadiness, reportIntake]
  );
  const reportConversionReview = useMemo(
    () => buildReportConversionReviewReport(reportIntake),
    [reportIntake]
  );
  const reportReviewQueue = useMemo(
    () => buildReportReviewQueue(reportIntake),
    [reportIntake]
  );
  const filePreviewRouting = useMemo(
    () =>
      buildFilePreviewRoutingPacket({
        readiness: filePreviewReadiness,
        coverage: reportFormatCoverage,
        reviewQueue: reportReviewQueue,
      }),
    [filePreviewReadiness, reportFormatCoverage, reportReviewQueue]
  );
  const reportConnectionPlan = useMemo(
    () => buildReportConnectionPlan({ intake: reportIntake, databases }),
    [databases, reportIntake]
  );
  const reportDecisionSummary = useMemo(
    () =>
      buildReportDecisionSummary({
        intake: reportIntake,
        formatPlaybook: reportFormatPlaybook,
        formatCoverage: reportFormatCoverage,
        conversionReview: reportConversionReview,
        reviewQueue: reportReviewQueue,
        connectionPlan: reportConnectionPlan,
      }),
    [
      reportConnectionPlan,
      reportConversionReview,
      reportFormatCoverage,
      reportFormatPlaybook,
      reportIntake,
      reportReviewQueue,
    ]
  );
  const fileActionReceiptSummary = useMemo(
    () => summarizeFileActionReceipts(fileActionReceipts),
    [fileActionReceipts]
  );

  const reportsModule = PLATFORM_MODULES.find((module) => module.id === "reports");
  const trackerStarter = reportsModule?.starter ?? null;

  const handlePreviewRoutingStepNavigate = (
    step: FilePreviewRoutingPacket["review_sequence"][number]
  ) => {
    if (step.route === "/modules/reports") {
      document
        .getElementById(step.target_section_id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    router.push(step.route);
  };

  const handleDecisionOpen = (
    decision: ReportDecisionSummary["decisions"][number]
  ) => {
    if (decision.route === "/modules/reports") {
      document
        .getElementById(decision.target_section_id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    router.push(`${decision.route}#${decision.target_section_id}`);
  };

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

  const handleChooseMarkdownImport = () => {
    markdownImportInputRef.current?.click();
  };

  const handleReportFileSelected = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;

    setBusyAction(REPORT_FILE_ACTION_LABEL);
    setReportFileBatchMessage(null);
    try {
      const createdPages: Page[] = [];
      let failed = 0;

      for (const file of selectedFiles) {
        try {
          const storedFile = await savePageFile(file);
          const page = await createReportPageFromStoredFile(storedFile);
          createdPages.push(page);
        } catch (err) {
          failed += 1;
          console.error("[Zhinote] Failed to create report page from file:", err);
        }
      }

      await refresh();
      if (selectedFiles.length === 1 && createdPages[0]) {
        router.push(`/page/${createdPages[0].id}`);
        return;
      }

      setReportFileBatchMessage({
        created: createdPages.length,
        failed,
        total: selectedFiles.length,
      });

      if (createdPages.length === 0) {
        window.alert(
          "没有成功创建报告页。文件没有上传；请检查浏览器是否允许本地存储。"
        );
      }
    } catch (err) {
      console.error("[Zhinote] Failed to create report page from file:", err);
      window.alert(
        "无法从这个本地文件创建报告页。文件没有上传；请检查浏览器是否允许本地存储。"
      );
    } finally {
      setBusyAction(null);
    }
  };

  const createReportPageFromStoredFile = async (storedFile: StoredPageFile) => {
    const page = await createPage({
      title: reportPageTitleFromFile(storedFile.name),
      icon: "RPT",
    });
    await updatePage(page.id, {
      content_text: createReportPageContent(storedFile),
    });
    appendFilePreviewActionReceipt(
      buildFilePreviewActionReceipt({
        file: storedFile,
        action_kind: getReportFileReceiptActionKind(storedFile),
        source_surface: "reports-module",
        writes_page_content: true,
        confirmation_required: false,
        confirmation_matched: true,
        note:
          storedFile.kind === "archive"
            ? "报告文件已从报告库模块本地留存，并提供下载入口。"
            : "报告文件已从报告库模块创建为本地页面预览。",
      })
    );
    return page;
  };

  const handleMarkdownFileSelected = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setBusyAction(MARKDOWN_EDITABLE_IMPORT_LABEL);
    try {
      const storedFile = await savePageFile(file);
      if (storedFile.kind !== "markdown") {
        window.alert("请选择 .md、.markdown 或 .mdx 文件。");
        return;
      }

      const page = await createPage({
        title: markdownPageTitleFromFile(storedFile.name),
        icon: "MD",
      });
      await updatePage(page.id, {
        content_text: createMarkdownImportedPageContent(storedFile),
      });
      appendFilePreviewActionReceipt(
        buildFilePreviewActionReceipt({
          file: storedFile,
          action_kind: "editable-import",
          source_surface: "reports-module",
          writes_page_content: true,
          confirmation_required: false,
          confirmation_matched: true,
          note: "Markdown 已从报告库模块导入为本地可编辑页面。",
        })
      );
      await refresh();
      router.push(`/page/${page.id}`);
    } catch (err) {
      console.error("[Zhinote] Failed to import markdown note:", err);
      window.alert(
        "Markdown 笔记导入失败。文件没有上传；请检查浏览器是否允许本地存储。"
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
      window.alert("报告入库队列导出失败，请查看控制台。");
    } finally {
      setExportingIntake(false);
    }
  };

  const handleExportConnectionPlan = () => {
    setExportingConnectionPlan(true);
    try {
      downloadJsonFile(
        `zhinote-report-connection-plan-${fileSafeTimestamp()}.json`,
        {
          ...reportConnectionPlan,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export report connection plan:", err);
      window.alert("报告关联计划导出失败，请查看控制台。");
    } finally {
      setExportingConnectionPlan(false);
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

  const handleExportPreviewReadiness = () => {
    setExportingPreviewReadiness(true);
    try {
      downloadJsonFile(
        `zhinote-file-preview-readiness-${fileSafeTimestamp()}.json`,
        {
          ...filePreviewReadiness,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export file preview readiness:", err);
      window.alert("文件预览 readiness 导出失败，请查看控制台。");
    } finally {
      setExportingPreviewReadiness(false);
    }
  };

  const handleExportPreviewRouting = () => {
    setExportingPreviewRouting(true);
    try {
      downloadJsonFile(
        `zhinote-file-preview-routing-${fileSafeTimestamp()}.json`,
        {
          ...filePreviewRouting,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export preview routing:", err);
      window.alert("文件预览路由包导出失败，请查看控制台。");
    } finally {
      setExportingPreviewRouting(false);
    }
  };

  const handleExportUploadPreflight = () => {
    setExportingUploadPreflight(true);
    try {
      downloadJsonFile(
        `zhinote-file-upload-preflight-${fileSafeTimestamp()}.json`,
        {
          ...fileUploadPreflight,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export upload preflight:", err);
      window.alert("上传预检导出失败，请查看控制台。");
    } finally {
      setExportingUploadPreflight(false);
    }
  };

  const handleExportFormatCoverage = () => {
    setExportingFormatCoverage(true);
    try {
      downloadJsonFile(
        `zhinote-report-format-coverage-${fileSafeTimestamp()}.json`,
        {
          ...reportFormatCoverage,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export report format coverage:", err);
      window.alert("格式覆盖缺口报告导出失败，请查看控制台。");
    } finally {
      setExportingFormatCoverage(false);
    }
  };

  const handleExportConversionReview = () => {
    setExportingConversionReview(true);
    try {
      downloadJsonFile(
        `zhinote-report-conversion-review-${fileSafeTimestamp()}.json`,
        {
          ...reportConversionReview,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export conversion review:", err);
      window.alert("转换质量复核导出失败，请查看控制台。");
    } finally {
      setExportingConversionReview(false);
    }
  };

  const handleExportReviewQueue = () => {
    setExportingReviewQueue(true);
    try {
      downloadJsonFile(
        `zhinote-report-review-queue-${fileSafeTimestamp()}.json`,
        {
          ...reportReviewQueue,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export report review queue:", err);
      window.alert("下一步复核队列导出失败，请查看控制台。");
    } finally {
      setExportingReviewQueue(false);
    }
  };

  const handleExportDecisionSummary = () => {
    setExportingDecisionSummary(true);
    try {
      downloadJsonFile(
        `zhinote-report-decision-summary-${fileSafeTimestamp()}.json`,
        {
          ...reportDecisionSummary,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export report decision summary:", err);
      window.alert("报告决策摘要导出失败，请查看控制台。");
    } finally {
      setExportingDecisionSummary(false);
    }
  };

  const handleExportFileActionReceipts = () => {
    setExportingFileActionReceipts(true);
    try {
      downloadJsonFile(
        `zhinote-file-preview-action-receipts-${fileSafeTimestamp()}.json`,
        {
          format: "zhinote-file-preview-action-receipt-history",
          format_version: 1,
          exported_at: new Date().toISOString(),
          history_status: "local-metadata-only",
          privacy_note:
            "从浏览器本地动作收据历史导出。动作收据不包含文件名、文件字节、文件文本、页面正文、表格单元格值、token、凭证、prompt、云端数据或 AI 输出。",
          receipts: fileActionReceipts,
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export file action receipts:", err);
      window.alert("文件动作收据导出失败，请查看控制台。");
    } finally {
      setExportingFileActionReceipts(false);
    }
  };

  const handleCreateTrackerRow = async (item: ReportIntakeItem) => {
    const tracker = reportTrackers[0];
    if (!tracker) {
      window.alert("请先创建报告跟踪表，再把报告入库。");
      return;
    }

    setTrackerIntakeBusyId(item.id);
    setTrackerIntakeMessage(null);
    try {
      const [trackerFields, trackerRows] = await Promise.all([
        getFields(tracker.id),
        getRows(tracker.id),
      ]);
      const existingRow = findExistingReportTrackerRow(
        trackerRows,
        trackerFields,
        item.page_id
      );
      if (existingRow) {
        setTrackerIntakeMessage(
          `已存在跟踪表行：${existingRow.row_title}。已打开报告跟踪表继续补 relation。`
        );
        router.push(
          `/database/${tracker.id}?q=${encodeURIComponent(item.page_title)}`
        );
        return;
      }

      const draft = buildReportTrackerIntakeDraft(item, trackerFields);
      const hasReportPageRelation = draft.mapped_fields.some(
        (field) => field.mapped_value === "report-page-relation"
      );
      if (!hasReportPageRelation) {
        window.alert(
          "当前报告跟踪表缺少报告页 relation 字段，请先补字段后再入库。"
        );
        return;
      }

      await addRow(tracker.id, {
        title: draft.row_title,
        fieldValues: draft.field_values,
        contentText: draft.row_page_content,
      });
      setTrackerIntakeMessage(
        `已创建跟踪表行：${draft.row_title}。已打开报告跟踪表继续补 relation。`
      );
      router.push(
        `/database/${tracker.id}?q=${encodeURIComponent(draft.row_title)}`
      );
    } catch (err) {
      console.error("[Zhinote] Failed to create report tracker row:", err);
      window.alert("报告入库失败，请查看控制台。");
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

        <ReportDecisionSummaryPanel
          summary={reportDecisionSummary}
          exporting={exportingDecisionSummary}
          onExport={handleExportDecisionSummary}
          onOpenDecision={handleDecisionOpen}
        />

        <section
          id="reports-create-assets"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
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
                multiple
                className="hidden"
                onChange={(event) => void handleReportFileSelected(event)}
              />
              <input
                ref={markdownImportInputRef}
                type="file"
                accept={MARKDOWN_EDITABLE_IMPORT_ACCEPT}
                className="hidden"
                onChange={(event) => void handleMarkdownFileSelected(event)}
              />
              <StarterButton
                label={REPORT_FILE_ACTION_LABEL}
                busy={busyAction === REPORT_FILE_ACTION_LABEL}
                emphasis
                onClick={handleChooseReportFile}
              />
              <StarterButton
                label={MARKDOWN_EDITABLE_IMPORT_LABEL}
                busy={busyAction === MARKDOWN_EDITABLE_IMPORT_LABEL}
                onClick={handleChooseMarkdownImport}
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
          {reportFileBatchMessage && (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs leading-5 text-green-700 dark:bg-green-950 dark:text-green-300">
              批量上传结果：已创建 {reportFileBatchMessage.created} /{" "}
              {reportFileBatchMessage.total} 个本地报告页
              {reportFileBatchMessage.failed > 0
                ? `，失败 ${reportFileBatchMessage.failed} 个。`
                : "。"}
              新页面已进入下方报告 intake 队列；文件仍只保存在本地浏览器。
            </p>
          )}
        </section>

        <section
          id="reports-review-queue"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                下一步复核队列
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把 intake 文件合并成可执行的投研待办：第一遍阅读、转换复核、表格入库、
                来源分流和关联归档。这个队列只用本地元数据，不读取文件正文、
                文件字节，不上传、不同步、不调用 AI。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportReviewQueue}
              disabled={exportingReviewQueue}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingReviewQueue ? "导出中..." : "导出队列"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <IntakeMetric
              label="队列"
              value={reportReviewQueue.summary.queue_items}
              detail="条目"
            />
            <IntakeMetric
              label="可阅读"
              value={reportReviewQueue.summary.ready_items}
              detail="就绪"
            />
            <IntakeMetric
              label="需复核"
              value={reportReviewQueue.summary.review_needed_items}
              detail="复核"
            />
            <IntakeMetric
              label="阻塞"
              value={reportReviewQueue.summary.blocked_items}
              detail="阻塞"
            />
            <IntakeMetric
              label="第一遍"
              value={reportReviewQueue.summary.first_pass_reading_items}
              detail="阅读"
            />
            <IntakeMetric
              label="转换"
              value={reportReviewQueue.summary.conversion_review_items}
              detail="保真度"
            />
            <IntakeMetric
              label="表格"
              value={reportReviewQueue.summary.database_review_items}
              detail="数据库"
            />
            <IntakeMetric
              label="确认"
              value={reportReviewQueue.summary.confirmation_required_items}
              detail="需确认"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                队列闸门
              </div>
              {reportReviewQueue.gates.map((gate) => (
                <ReportReviewQueueGateRow key={gate.id} gate={gate} />
              ))}
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                优先队列项
              </div>
              {reportReviewQueue.items.length > 0 ? (
                <div className="mt-2 grid gap-3 lg:grid-cols-2">
                  {reportReviewQueue.items.slice(0, 8).map((item) => (
                    <ReportReviewQueueItemCard
                      key={item.id}
                      item={item}
                      onOpen={() => router.push(`/page/${item.page_id}`)}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                  还没有复核队列。上传报告文件后，ZhiNotes 会自动把文件排入阅读、
                  转换复核、表格入库或来源分流。
                </p>
              )}
            </div>
          </div>
        </section>

        <PreviewRoutingPanel
          packet={filePreviewRouting}
          exporting={exportingPreviewRouting}
          onExport={handleExportPreviewRouting}
          onReviewStepOpen={handlePreviewRoutingStepNavigate}
        />

        <section
          id="reports-upload-preflight"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                上传前格式预检
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                选择文件前先看 ZhiNotes 会如何处理不同格式：原生预览、本地转换、
                可编辑导入、数据库候选、元数据复核或本地留存下载。这个预检只读格式能力元数据，
                不读取文件名、文件字节、文件文本或页面正文。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportUploadPreflight}
              disabled={exportingUploadPreflight}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingUploadPreflight ? "导出中..." : "导出预检"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <IntakeMetric
              label="格式组"
              value={fileUploadPreflight.summary.capability_groups}
              detail="路线"
            />
            <IntakeMetric
              label="扩展名"
              value={fileUploadPreflight.summary.accepted_extension_patterns}
              detail="已接受"
            />
            <IntakeMetric
              label="原生"
              value={fileUploadPreflight.summary.native_groups}
              detail="预览"
            />
            <IntakeMetric
              label="转换"
              value={fileUploadPreflight.summary.converted_groups}
              detail="本地"
            />
            <IntakeMetric
              label="低风险"
              value={fileUploadPreflight.summary.low_risk_groups}
              detail="直接"
            />
            <IntakeMetric
              label="中风险"
              value={fileUploadPreflight.summary.medium_risk_groups}
              detail="复核"
            />
            <IntakeMetric
              label="高风险"
              value={fileUploadPreflight.summary.high_risk_groups}
              detail="确认"
            />
            <IntakeMetric
              label="限制"
              value={fileUploadPreflight.summary.limited_groups}
              detail="缺口"
            />
          </div>
          <div className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              默认路线：
            </span>{" "}
            AI 可视化报告优先用 {fileUploadPreflight.primary_formats.ai_visual_report}，
            个人笔记优先用 {fileUploadPreflight.primary_formats.personal_note}，
            数据库来源优先用 {fileUploadPreflight.primary_formats.database_source}。
            Page 是统一容器；云同步、AI 处理、外部资源加载和批量写入都仍然独立确认。
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                预检闸门
              </div>
              {fileUploadPreflight.gates.map((gate) => (
                <UploadPreflightGateRow key={gate.id} gate={gate} />
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                上传路线
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {fileUploadPreflight.routes.map((route) => (
                  <UploadPreflightRouteCard key={route.id} route={route} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="reports-intake-queue"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                报告 intake 队列
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                从本地 page 的 file-preview block 元数据生成待处理报告队列，
                用来判断格式、优先级、下一步动作和关联缺口。这个报告不读取文件字节、
                不调用 AI、不连接云服务。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportIntake}
              disabled={exportingIntake}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingIntake ? "导出中..." : "导出入库队列"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            <IntakeMetric
              label="待处理"
              value={reportIntake.summary.intake_items}
              detail="文件块"
            />
            <IntakeMetric
              label="高优先级"
              value={reportIntake.summary.high_priority}
              detail="优先复核"
            />
            <IntakeMetric
              label="格式类型"
              value={reportIntake.summary.unique_file_kinds}
              detail="类型"
            />
            <IntakeMetric
              label="HTML"
              value={reportIntake.summary.html_reports}
              detail="报告"
            />
            <IntakeMetric
              label="表格候选"
              value={reportIntake.summary.spreadsheet_candidates}
              detail="入库候选"
            />
            <IntakeMetric
              label="页面扫描"
              value={reportIntake.summary.pages_scanned}
              detail="仅本地"
            />
            <IntakeMetric
              label="队列阶段"
              value={reportIntake.lanes.length}
              detail="工作流"
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

        <section
          id="reports-connection-plan"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                报告关联计划
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                从 intake 元数据和本地数据库 metadata 生成报告到公司、会议、备忘录和组合的关联建议。这个计划不读取报告正文、
                文件文本、文件字节、数据库行值，不写入 relation，不调用 AI 或云服务。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportConnectionPlan}
              disabled={exportingConnectionPlan}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingConnectionPlan ? "导出中..." : "导出关联计划"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <IntakeMetric
              label="建议"
              value={reportConnectionPlan.summary.suggestions}
              detail="关联工作"
            />
            <IntakeMetric
              label="高优先级"
              value={reportConnectionPlan.summary.high_priority_suggestions}
              detail="优先复核"
            />
            <IntakeMetric
              label="缺公司"
              value={reportConnectionPlan.summary.missing_company_links}
              detail="公司"
            />
            <IntakeMetric
              label="缺会议"
              value={reportConnectionPlan.summary.missing_meeting_links}
              detail="会议"
            />
            <IntakeMetric
              label="缺备忘录"
              value={reportConnectionPlan.summary.missing_memo_links}
              detail="备忘录"
            />
            <IntakeMetric
              label="公司表"
              value={reportConnectionPlan.summary.company_trackers}
              detail="目标"
            />
            <IntakeMetric
              label="会议表"
              value={reportConnectionPlan.summary.meeting_trackers}
              detail="目标"
            />
            <IntakeMetric
              label="需确认"
              value={reportConnectionPlan.summary.confirmation_actions}
              detail="手动关联"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                关联建议
              </div>
              {reportConnectionPlan.suggestions.length > 0 ? (
                <div className="mt-2 grid gap-3 lg:grid-cols-2">
                  {reportConnectionPlan.suggestions.slice(0, 8).map((suggestion) => (
                    <ReportConnectionSuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onOpenReport={() => router.push(`/page/${suggestion.report_page_id}`)}
                      onOpenRoute={(route) => router.push(route)}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                  当前没有可生成的关联建议。上传报告文件或补充报告页中的 relation 缺口后会出现在这里。
                </p>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Relation 字段清单
              </div>
              <div className="mt-2 space-y-2">
                {reportConnectionPlan.required_fields.map((fieldSet) => (
                  <ReportConnectionFieldSetRow
                    key={fieldSet.target_kind}
                    fieldSet={fieldSet}
                  />
                ))}
              </div>
              <div className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  可用跟踪表目标
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {reportConnectionPlan.tracker_targets.length > 0 ? (
                    reportConnectionPlan.tracker_targets.map((target) => (
                      <span
                        key={`${target.kind}:${target.database_id}`}
                        className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {target.kind}:{target.database_title}
                      </span>
                    ))
                  ) : (
                    <span className="text-zinc-400">
                      还没有识别到公司、会议、报告或组合 tracker。
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="reports-tracker-intake"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                报告入库台
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把单个 intake 文件创建成报告跟踪表行，并自动填入报告页 relation、
                格式、状态、来源和核心结论。点击后只做本地单条写入，
                不读取报告正文、文件文本或文件字节，不上传、不同步、不调用 AI。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`rounded-md px-2 py-1 ${
                  reportTrackers.length > 0
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {reportTrackers.length > 0 ? "跟踪表就绪" : "缺报告跟踪表"}
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
          {reportIntake.items.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {reportIntake.items.slice(0, 6).map((item) => (
                <ReportTrackerIntakeCard
                  key={item.id}
                  item={item}
                  trackerReady={reportTrackers.length > 0}
                  busy={trackerIntakeBusyId === item.id}
                  onCreate={() => void handleCreateTrackerRow(item)}
                  onOpen={() => router.push(`/page/${item.page_id}`)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
              还没有可入库的报告文件。先上传报告文件或创建包含 file-preview 的报告页。
            </p>
          )}
        </section>

        <section
          id="reports-format-playbook"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                格式处理 Playbook
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把 intake 队列里的格式拆成处理路线：HTML 报告优先原生预览，
                Markdown 笔记优先可编辑导入，表格走数据库候选，其它文件保留本地原件和复核步骤。
                这个 Playbook 不读取文件字节、文件文本或页面正文。
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
              detail="格式类型"
            />
            <IntakeMetric
              label="原生预览"
              value={reportFormatPlaybook.summary.native_preview_routes}
              detail="HTML/PDF/媒体"
            />
            <IntakeMetric
              label="可编辑导入"
              value={reportFormatPlaybook.summary.editable_import_routes}
              detail="Markdown/文档"
            />
            <IntakeMetric
              label="数据库候选"
              value={reportFormatPlaybook.summary.database_import_routes}
              detail="表格"
            />
            <IntakeMetric
              label="元数据复核"
              value={reportFormatPlaybook.summary.metadata_review_routes}
              detail="压缩包/未知"
            />
            <IntakeMetric
              label="确认项"
              value={reportFormatPlaybook.summary.confirmation_queue_items}
              detail="风险动作前"
            />
            <IntakeMetric
              label="HTML"
              value={reportFormatPlaybook.summary.html_reports}
              detail="原生目标"
            />
            <IntakeMetric
              label="Markdown"
              value={reportFormatPlaybook.summary.markdown_notes}
              detail="可编辑目标"
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

        <section
          id="reports-format-coverage"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                格式覆盖缺口
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把当前 intake 里的真实文件格式和 ZhiNotes 能力矩阵对齐，显示已使用、
                未使用、需要确认、旧版 Office 和未知格式缺口。这个报告只按格式计数，
                不列出文件名、不读取文件字节、文件文本或页面正文。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportFormatCoverage}
              disabled={exportingFormatCoverage}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingFormatCoverage ? "导出中..." : "导出覆盖报告"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <IntakeMetric
              label="实际格式"
              value={reportFormatCoverage.summary.active_groups}
              detail="已使用组"
            />
            <IntakeMetric
              label="文件项"
              value={reportFormatCoverage.summary.active_items}
              detail="入库文件"
            />
            <IntakeMetric
              label="未使用"
              value={reportFormatCoverage.summary.supported_unused_groups}
              detail="已支持"
            />
            <IntakeMetric
              label="需确认"
              value={reportFormatCoverage.summary.active_confirmation_groups}
              detail="活跃闸门"
            />
            <IntakeMetric
              label="未知"
              value={reportFormatCoverage.summary.unsupported_active_groups}
              detail="无路线"
            />
            <IntakeMetric
              label="限制"
              value={reportFormatCoverage.summary.blocked_limited_groups}
              detail="已知缺口"
            />
            <IntakeMetric
              label="确认缺口"
              value={reportFormatCoverage.summary.manual_confirmation_gaps}
              detail="复核"
            />
            <IntakeMetric
              label="阻塞缺口"
              value={reportFormatCoverage.summary.blocked_gaps}
              detail="阻塞"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                覆盖缺口
              </div>
              {reportFormatCoverage.gaps.map((gap) => (
                <FormatCoverageGapRow key={gap.id} gap={gap} />
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                格式覆盖
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {reportFormatCoverage.rows.map((row) => (
                  <FormatCoverageRowCard key={row.id} row={row} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="reports-conversion-review"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                转换质量复核
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                区分真正原生展示和本地转换展示：PPT/Word/Excel、RTF、EPUB、
                notebook 等格式可能丢失复杂版式、图表、公式、批注或交互。
                这个复核只看文件类型、扩展名和数量，不导出文件名、不读取文件字节、
                文件文本或页面正文。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportConversionReview}
              disabled={exportingConversionReview}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingConversionReview ? "导出中..." : "导出复核"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <IntakeMetric
              label="文件项"
              value={reportConversionReview.summary.intake_items}
              detail="入库"
            />
            <IntakeMetric
              label="路线"
              value={reportConversionReview.summary.active_routes}
              detail="活跃"
            />
            <IntakeMetric
              label="原生可读"
              value={reportConversionReview.summary.native_ready_items}
              detail="原生"
            />
            <IntakeMetric
              label="需复核"
              value={reportConversionReview.summary.review_needed_items}
              detail="已转换"
            />
            <IntakeMetric
              label="阻塞"
              value={reportConversionReview.summary.blocked_items}
              detail="旧版/未知"
            />
            <IntakeMetric
              label="Office"
              value={reportConversionReview.summary.office_items}
              detail="Word/PPT/Excel"
            />
            <IntakeMetric
              label="PPT"
              value={reportConversionReview.summary.presentation_items}
              detail="幻灯片"
            />
            <IntakeMetric
              label="高风险"
              value={reportConversionReview.summary.high_risk_items}
              detail="手动"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                质量 gates
              </div>
              {reportConversionReview.gates.map((gate) => (
                <ConversionReviewGateRow key={gate.id} gate={gate} />
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                活跃格式复核
              </div>
              {reportConversionReview.routes.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {reportConversionReview.routes.map((route) => (
                    <ConversionReviewRouteCard
                      key={route.id}
                      route={route}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                  还没有 intake 文件。上传 PPT、Word、Excel、PDF、HTML 或 Markdown 后，
                  这里会显示哪些是原生展示，哪些需要转换复核。
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div
            id="reports-privacy-boundary"
            className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
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

        <section
          id="reports-preview-readiness"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                原生预览 readiness
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                汇总当前多格式文件在 ZhiNotes page 里的本地展示能力。这个报告只读取格式能力元数据，
                不读取文件字节、文件文本或页面正文，也不会上传、同步或调用 AI。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPreviewReadiness}
              disabled={exportingPreviewReadiness}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingPreviewReadiness ? "导出中..." : "导出预览就绪"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <IntakeMetric
              label="格式组"
              value={filePreviewReadiness.summary.capability_groups}
              detail="能力"
            />
            <IntakeMetric
              label="扩展名"
              value={filePreviewReadiness.summary.extension_patterns}
              detail="已接受"
            />
            <IntakeMetric
              label="原生"
              value={filePreviewReadiness.summary.native_routes}
              detail="原生"
            />
            <IntakeMetric
              label="转换"
              value={filePreviewReadiness.summary.converted_routes}
              detail="本地"
            />
            <IntakeMetric
              label="元数据"
              value={filePreviewReadiness.summary.metadata_routes}
              detail="复核"
            />
            <IntakeMetric
              label="就绪"
              value={filePreviewReadiness.summary.ready_routes}
              detail={filePreviewReadiness.readiness_verdict}
            />
            <IntakeMetric
              label="需确认"
              value={filePreviewReadiness.summary.manual_confirmation_routes}
              detail="写入前"
            />
            <IntakeMetric
              label="阻塞"
              value={filePreviewReadiness.summary.blocked_routes}
              detail="缺口"
            />
          </div>
          <div className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              推荐原生格式：
            </span>{" "}
            报告用 {filePreviewReadiness.recommended_native_format.report}，
            笔记用 {filePreviewReadiness.recommended_native_format.note}，
            数据库导入用 {filePreviewReadiness.recommended_native_format.database}。
            {filePreviewReadiness.recommended_native_format.rationale}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                就绪闸门
              </div>
              {filePreviewReadiness.gates.map((gate) => (
                <FilePreviewReadinessGateRow key={gate.id} gate={gate} />
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                格式路线
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {filePreviewReadiness.routes.map((route) => (
                  <FilePreviewReadinessRouteCard
                    key={route.id}
                    route={route}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                文件动作收据
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                本地记录最近的报告页面预览、文件留存、文件导入、表格入库和 HTML 外部资源开关动作。
                动作收据只保存动作元数据，不保存文件名、正文、字节、表格值、token 或凭证。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportFileActionReceipts}
              disabled={
                exportingFileActionReceipts || fileActionReceipts.length === 0
              }
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingFileActionReceipts ? "导出中..." : "导出收据"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <IntakeMetric
              label="总数"
              value={fileActionReceiptSummary.total}
              detail="本地"
            />
            <IntakeMetric
              label="页面预览"
              value={fileActionReceiptSummary.native_preview}
              detail="页面"
            />
            <IntakeMetric
              label="下载留存"
              value={fileActionReceiptSummary.download_retain}
              detail="留存"
            />
            <IntakeMetric
              label="可编辑导入"
              value={fileActionReceiptSummary.editable_import}
              detail="页面写入"
            />
            <IntakeMetric
              label="数据库导入"
              value={fileActionReceiptSummary.database_import}
              detail="行"
            />
            <IntakeMetric
              label="资源开关"
              value={fileActionReceiptSummary.external_resource_changes}
              detail="HTML"
            />
          </div>
          {fileActionReceipts.length > 0 ? (
            <div className="mt-4 grid gap-2 lg:grid-cols-2">
              {fileActionReceipts.slice(0, 6).map((receipt) => (
                <FileActionReceiptCard
                  key={receipt.receipt_id}
                  receipt={receipt}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
              还没有文件动作收据。上传报告文件、导入 Markdown、在 page 里执行“导入为可编辑块”、
              “导入为数据库”或切换 HTML 外部资源，这里会自动出现本地记录。
            </p>
          )}
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

function ReportDecisionSummaryPanel({
  summary,
  exporting,
  onExport,
  onOpenDecision,
}: {
  summary: ReportDecisionSummary;
  exporting: boolean;
  onExport: () => void;
  onOpenDecision: (
    decision: ReportDecisionSummary["decisions"][number]
  ) => void;
}) {
  return (
    <section
      id="reports-decision-summary"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            报告决策摘要
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            报告决策摘要
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {summary.current_conclusion}
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="w-fit whitespace-nowrap rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          {exporting ? "导出中..." : "导出摘要"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <IntakeMetric
          label="入库"
          value={summary.summary.intake_items}
          detail="本地报告项"
        />
        <IntakeMetric
          label="HTML"
          value={summary.summary.html_reports}
          detail="原生预览"
        />
        <IntakeMetric
          label="Markdown"
          value={summary.summary.markdown_notes}
          detail="可编辑源"
        />
        <IntakeMetric
          label="需复核"
          value={summary.summary.review_needed_items}
          detail="转换/质量"
        />
        <IntakeMetric
          label="关联"
          value={summary.summary.relation_suggestions}
          detail="待连接"
        />
        <IntakeMetric
          label="阻塞"
          value={summary.summary.blocked_items}
          detail="保持关闭"
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {summary.decisions.map((decision) => (
          <ReportDecisionCard
            key={decision.id}
            decision={decision}
            onOpen={() => onOpenDecision(decision)}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <ReportDecisionList title="当前可做" items={summary.safe_local_work} />
        <ReportDecisionList title="保持关闭" items={summary.blocked_work} />
        <ReportDecisionList
          title="待你确认"
          items={summary.required_owner_decisions}
        />
      </div>

      <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        报告决策摘要只读取本地 summary metadata，不包含报告标题、文件名、
        页面正文、文件字节、文件文本、数据库行值、prompt、token、
        凭证、云端数据或 AI 输出。
      </p>
    </section>
  );
}

function ReportDecisionCard({
  decision,
  onOpen,
}: {
  decision: ReportDecisionSummary["decisions"][number];
  onOpen: () => void;
}) {
  return (
    <article className="flex min-h-[230px] flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">
              {decision.title}
            </h3>
            <p className="mt-1 text-base font-semibold text-zinc-950 dark:text-zinc-50">
              {decision.answer}
            </p>
          </div>
          <ReportDecisionStatusPill status={decision.status} />
        </div>
        <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
          {decision.evidence}
        </p>
      </div>
      <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="text-xs leading-5 text-zinc-400">
          {decision.next_action}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          打开对应区域
        </button>
      </div>
    </article>
  );
}

function ReportDecisionList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <article className="rounded-lg bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-900">
      <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function ReportDecisionStatusPill({
  status,
}: {
  status: ReportDecisionSummaryStatus;
}) {
  const label: Record<ReportDecisionSummaryStatus, string> = {
    "available-local": "本地可做",
    "requires-owner-confirmation": "需确认",
    blocked: "阻塞",
  };
  const className: Record<ReportDecisionSummaryStatus, string> = {
    "available-local":
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200",
    "requires-owner-confirmation":
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    blocked: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${className[status]}`}
    >
      {label[status]}
    </span>
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

function ReportReviewQueueGateRow({
  gate,
}: {
  gate: ReportReviewQueueReport["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
        </div>
        <ReportReviewQueueStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function ReportReviewQueueItemCard({
  item,
  onOpen,
}: {
  item: ReportReviewQueueReport["items"][number];
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
          <ReportReviewQueueStatusPill status={item.status} />
          <ReportReviewQueueRiskPill risk={item.risk} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <ReportReviewQueueWorkstreamPill workstream={item.workstream} />
        <IntakePriorityPill priority={item.priority} />
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {item.file_kind}
        </span>
        {item.required_confirmation && (
          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">
            需确认
          </span>
        )}
      </div>
      <div className="mt-3 rounded-md bg-zinc-50 px-2 py-2 dark:bg-zinc-900">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {item.action_label}
        </div>
        <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
          {item.evidence}
        </p>
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {item.next_step}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {item.relation_gaps.map((gap) => (
          <span
            key={gap}
            className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          >
            缺 {gap}
          </span>
        ))}
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
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

function ReportConnectionSuggestionCard({
  suggestion,
  onOpenReport,
  onOpenRoute,
}: {
  suggestion: ReportConnectionPlan["suggestions"][number];
  onOpenReport: () => void;
  onOpenRoute: (route: string) => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {suggestion.report_page_title}
          </div>
          <div className="mt-1 truncate text-zinc-400">
            {suggestion.file_name} · {suggestion.file_kind}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <IntakePriorityPill priority={suggestion.priority} />
          <IntakeStagePill stage={suggestion.stage} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {suggestion.missing_target_labels.map((label) => (
          <span
            key={label}
            className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          >
            缺 {label}
          </span>
        ))}
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {suggestion.next_action}
      </p>
      <div className="mt-3 space-y-2">
        {suggestion.actions.map((action) => (
          <div
            key={action.id}
            className="rounded-md bg-zinc-50 px-2 py-2 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {action.target_label}
                </div>
                <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
                  {action.reason}
                </p>
              </div>
              <ReportConnectionActionPill status={action.status} />
            </div>
            <button
              type="button"
              onClick={() => onOpenRoute(action.route)}
              className="mt-2 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              打开目标
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
        {suggestion.privacy_boundary}
      </p>
      <button
        type="button"
        onClick={onOpenReport}
        className="mt-3 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        打开报告页
      </button>
    </article>
  );
}

function ReportConnectionFieldSetRow({
  fieldSet,
}: {
  fieldSet: ReportConnectionPlan["required_fields"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
        {fieldSet.target_kind}
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {fieldSet.reason}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {fieldSet.field_names.map((fieldName) => (
          <span
            key={fieldName}
            className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {fieldName}
          </span>
        ))}
      </div>
    </article>
  );
}

function ReportReviewQueueStatusPill({
  status,
}: {
  status: ReportReviewQueueStatus;
}) {
  const labels: Record<ReportReviewQueueStatus, string> = {
    ready: "就绪",
    "review-needed": "需复核",
    blocked: "阻塞",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "review-needed"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function ReportReviewQueueRiskPill({ risk }: { risk: ReportReviewQueueRisk }) {
  const labels: Record<ReportReviewQueueRisk, string> = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
  };
  const className =
    risk === "low"
      ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      : risk === "medium"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[risk]}
    </span>
  );
}

function ReportReviewQueueWorkstreamPill({
  workstream,
}: {
  workstream: ReportReviewQueueWorkstream;
}) {
  const labels: Record<ReportReviewQueueWorkstream, string> = {
    "first-pass-reading": "第一遍阅读",
    "conversion-review": "转换复核",
    "database-review": "表格入库",
    "source-triage": "来源分流",
    "relation-linking": "关联归档",
    "local-retain": "本地留存",
  };

  return (
    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
      {labels[workstream]}
    </span>
  );
}

function ReportConnectionActionPill({
  status,
}: {
  status: ReportConnectionActionStatus;
}) {
  const labels: Record<ReportConnectionActionStatus, string> = {
    ready: "就绪",
    "manual-confirmation": "确认",
    blocked: "阻塞",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function ReportTrackerIntakeCard({
  item,
  trackerReady,
  busy,
  onCreate,
  onOpen,
}: {
  item: ReportIntakeItem;
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
        {item.relation_gaps.map((gap) => (
          <span
            key={gap}
            className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          >
            缺 {gap}
          </span>
        ))}
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        将创建一条本地报告跟踪表行，写入报告页 relation、格式、
        状态、来源和核心结论。
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
        本地单条写入；不读取报告正文、文件文本、文件字节、token 或凭证。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={!trackerReady || busy}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        >
          {busy ? "创建中..." : "创建跟踪表行"}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          打开报告页
        </button>
      </div>
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
          {route.item_count} 个文件
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
    high: "高",
    medium: "中",
    low: "低",
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
    captured: "已捕获",
    "source-triage": "来源分流",
    "reading-review": "复核",
    "database-review": "数据库",
    linking: "关联",
  };

  return (
    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      {labels[stage]}
    </span>
  );
}

function PreviewRoutingPanel({
  packet,
  exporting,
  onExport,
  onReviewStepOpen,
}: {
  packet: FilePreviewRoutingPacket;
  exporting: boolean;
  onExport: () => void;
  onReviewStepOpen: (
    step: FilePreviewRoutingPacket["review_sequence"][number]
  ) => void;
}) {
  const activeRoutes = packet.routes.filter((route) => route.active_items > 0);
  const visibleRoutes = activeRoutes.length > 0 ? activeRoutes : packet.routes;

  return (
    <section
      id="reports-preview-routing"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            原生预览路由
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            把当前格式覆盖、预览就绪度和复核队列汇总成文件进入
            ZhiNotes page 的路线图：原生预览、本地转换、表格入库、元数据复核或本地留存。
            这个路由包不读取文件名、正文、字节、表格值，不写入、不上传、不调用 AI。
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {exporting ? "导出中..." : "导出路由包"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <IntakeMetric
          label="路线"
          value={packet.summary.routes}
          detail="格式路线"
        />
        <IntakeMetric
          label="活跃"
          value={packet.summary.active_routes}
          detail="已使用"
        />
        <IntakeMetric
          label="原生"
          value={packet.summary.native_routes}
          detail="原生"
        />
        <IntakeMetric
          label="转换"
          value={packet.summary.converted_routes}
          detail="本地 HTML"
        />
        <IntakeMetric
          label="可编辑"
          value={packet.summary.editable_import_routes}
          detail="导入"
        />
        <IntakeMetric
          label="入库候选"
          value={packet.summary.database_import_candidates}
          detail="数据库"
        />
        <IntakeMetric
          label="需确认"
          value={packet.summary.confirmation_routes}
          detail="需确认"
        />
        <IntakeMetric
          label="缺口"
          value={packet.summary.unsupported_routes + packet.summary.blocked_routes}
          detail="缺口"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <div>
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            格式路线
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {visibleRoutes.slice(0, 10).map((route) => (
              <PreviewRoutingRouteCard key={route.id} route={route} />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              路由分组
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {packet.lanes.map((lane) => (
                <article
                  key={lane.id}
                  className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {lane.title}
                    </div>
                    <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                      {lane.route_count}
                    </span>
                  </div>
                  <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
                    {lane.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              复核顺序
            </div>
            <div className="mt-2 grid gap-2">
              {packet.review_sequence.map((step) => (
                <PreviewRoutingReviewStepCard
                  key={step.id}
                  step={step}
                  onOpen={() => onReviewStepOpen(step)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewRoutingReviewStepCard({
  step,
  onOpen,
}: {
  step: FilePreviewRoutingPacket["review_sequence"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] text-zinc-400">步骤 {step.order}</div>
          <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
            {step.title}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          打开步骤
        </button>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {step.reason}
      </p>
      <p className="mt-2 leading-5 text-zinc-400">
        完成信号：{step.completion_signal}
      </p>
    </article>
  );
}

function PreviewRoutingRouteCard({
  route,
}: {
  route: FilePreviewRoutingPacket["routes"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {route.label}
            </h3>
            <PreviewRoutingStatusPill status={route.status} />
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            {route.support_level} · {route.display_surface}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {route.active_items}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {route.primary_action}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {route.secondary_action}
      </p>
    </article>
  );
}

function PreviewRoutingStatusPill({
  status,
}: {
  status: FilePreviewRoutingStatus;
}) {
  const labels: Record<FilePreviewRoutingStatus, string> = {
    "native-ready": "原生",
    "external-confirmation": "确认",
    "converted-review": "转换",
    "database-confirmation": "数据库",
    "metadata-review": "元数据",
    "download-retain": "留存",
    "blocked-limited": "受限",
    unsupported: "不支持",
  };

  const className =
    status === "native-ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "external-confirmation" ||
          status === "database-confirmation" ||
          status === "converted-review"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : status === "blocked-limited" || status === "unsupported"
          ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
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

function UploadPreflightGateRow({
  gate,
}: {
  gate: FileUploadPreflightReport["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
        </div>
        <UploadPreflightGatePill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function UploadPreflightRouteCard({
  route,
}: {
  route: FileUploadPreflightReport["routes"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {route.label}
        </h3>
        <SupportPill level={route.support_level} />
        <UploadPreflightActionPill action={route.primary_action} />
        <UploadPreflightRiskPill risk={route.risk_level} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {route.extensions.map((extension) => (
          <span
            key={extension}
            className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {extension}
          </span>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <RouteDetail label="入口" value={route.upload_entrypoint} />
        <RouteDetail label="最适合" value={route.best_fit_use_case} />
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {route.page_handling}
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <RouteDetail label="预览" value={route.preview_result} />
        <RouteDetail label="可编辑" value={route.editable_result} />
        <RouteDetail label="数据库" value={route.database_result} />
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        上传前确认：
        {route.confirmation_required_before_upload ? "需要" : "不需要"} · 上传后确认：
        {route.confirmation_required_after_upload ? "需要" : "不需要"} · 收据：
        {route.local_receipt_action === "auto-recorded"
          ? "自动记录"
          : "上传后可记录"}
      </p>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        {route.privacy_boundary}
      </p>
      {route.fallback_or_gap && (
        <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-amber-600 dark:border-zinc-800 dark:text-amber-300">
          {route.fallback_or_gap}
        </p>
      )}
    </article>
  );
}

function UploadPreflightActionPill({
  action,
}: {
  action: FileUploadPreflightAction;
}) {
  const labels: Record<FileUploadPreflightAction, string> = {
    "native-preview": "原生预览",
    "editable-import": "可编辑",
    "database-import": "入库候选",
    "metadata-review": "元数据",
    "download-retain": "留存下载",
  };
  const className =
    action === "native-preview"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : action === "editable-import"
        ? "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
        : action === "database-import"
          ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          : action === "metadata-review"
            ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[action]}
    </span>
  );
}

function UploadPreflightRiskPill({ risk }: { risk: FileUploadPreflightRisk }) {
  const labels: Record<FileUploadPreflightRisk, string> = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
  };
  const className =
    risk === "low"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : risk === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[risk]}
    </span>
  );
}

function UploadPreflightGatePill({
  status,
}: {
  status: FileUploadPreflightGateStatus;
}) {
  const labels: Record<FileUploadPreflightGateStatus, string> = {
    ready: "就绪",
    "manual-confirmation": "确认",
    blocked: "阻塞",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[status]}
    </span>
  );
}

function FormatCoverageGapRow({
  gap,
}: {
  gap: ReportFormatCoverageReport["gaps"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gap.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gap.id}
          </div>
        </div>
        <FilePreviewReadinessPill status={gap.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gap.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gap.required_action}
      </p>
    </article>
  );
}

function FormatCoverageRowCard({
  row,
}: {
  row: ReportFormatCoverageReport["rows"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {row.label}
        </h3>
        {row.support_level === "unknown" ? (
          <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            未登记
          </span>
        ) : (
          <SupportPill level={row.support_level} />
        )}
        <FormatCoverageStatusPill status={row.coverage_status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {row.kinds.map((kind) => (
          <span
            key={kind}
            className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {kind}
          </span>
        ))}
        {row.extensions.slice(0, 6).map((extension) => (
          <span
            key={extension}
            className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {extension}
          </span>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <RouteDetail label="当前文件" value={`${row.active_items} items`} />
        <RouteDetail
          label="就绪度"
          value={
            row.route_present_in_readiness
              ? row.readiness_status
              : "缺少路线"
          }
        />
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {row.recommended_action}
      </p>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        {row.privacy_boundary}
      </p>
      {row.capability_gap && (
        <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-amber-600 dark:border-zinc-800 dark:text-amber-300">
          {row.capability_gap}
        </p>
      )}
    </article>
  );
}

function FormatCoverageStatusPill({
  status,
}: {
  status: ReportFormatCoverageStatus;
}) {
  const labels: Record<ReportFormatCoverageStatus, string> = {
    active: "活跃",
    "active-needs-confirmation": "需确认",
    "supported-unused": "未使用",
    "blocked-limited": "限制",
    "unsupported-active": "未知",
  };
  const className =
    status === "active"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "active-needs-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : status === "supported-unused"
          ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          : status === "blocked-limited"
            ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[status]}
    </span>
  );
}

function ConversionReviewGateRow({
  gate,
}: {
  gate: ReportConversionReviewReport["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
        </div>
        <ConversionStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function ConversionReviewRouteCard({
  route,
}: {
  route: ReportConversionReviewReport["routes"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {route.label}
        </h3>
        {route.support_level === "unknown" ? (
          <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            未登记
          </span>
        ) : (
          <SupportPill level={route.support_level} />
        )}
        <ConversionStatusPill status={route.fidelity_status} />
        <ConversionRiskPill risk={route.fidelity_risk} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {route.item_count} 项
        </span>
        {route.extensions.map((item) => (
          <span
            key={item.extension}
            className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {item.extension} x{item.count}
          </span>
        ))}
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {route.route_summary}
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <ConversionDetailList title="可能损失" items={route.likely_loss} />
        <ConversionDetailList title="复核清单" items={route.manual_checklist} />
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {route.recommended_action}
      </p>
      <p className="mt-2 leading-5 text-zinc-400">
        {route.privacy_boundary}
      </p>
    </article>
  );
}

function ConversionDetailList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-md bg-zinc-50 px-2 py-2 dark:bg-zinc-900">
      <div className="text-[10px] font-semibold text-zinc-400">{title}</div>
      {items.length > 0 ? (
        <ul className="mt-1 space-y-1 leading-5 text-zinc-500 dark:text-zinc-400">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 leading-5 text-zinc-400">无明显转换损失。</p>
      )}
    </div>
  );
}

function ConversionStatusPill({
  status,
}: {
  status: ReportConversionReviewStatus;
}) {
  const labels: Record<ReportConversionReviewStatus, string> = {
    "native-ready": "原生可读",
    "review-needed": "需复核",
    blocked: "阻塞",
  };
  const className =
    status === "native-ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "review-needed"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[status]}
    </span>
  );
}

function ConversionRiskPill({ risk }: { risk: ReportConversionRisk }) {
  const labels: Record<ReportConversionRisk, string> = {
    high: "高风险",
    medium: "中风险",
    low: "低风险",
  };
  const className =
    risk === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : risk === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[risk]}
    </span>
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

function FilePreviewReadinessGateRow({
  gate,
}: {
  gate: FilePreviewReadinessReport["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
        </div>
        <FilePreviewReadinessPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function FilePreviewReadinessRouteCard({
  route,
}: {
  route: FilePreviewReadinessReport["routes"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {route.label}
        </h3>
        <SupportPill level={route.support_level} />
        <FilePreviewReadinessPill status={route.readiness_status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {route.extensions.map((extension) => (
          <span
            key={extension}
            className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {extension}
          </span>
        ))}
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {route.native_display}
      </p>
      <div className="mt-2 space-y-1 leading-5 text-zinc-500 dark:text-zinc-400">
        <p>可编辑导入：{route.editable_import}</p>
        <p>数据库导入：{route.database_import}</p>
        <p>隐私边界：{route.privacy_boundary}</p>
      </div>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        {route.requires_confirmation
          ? "需要确认或复核后再写入/放开。"
          : "可在本地直接预览或保留。"}
      </p>
      {route.gap && (
        <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-amber-600 dark:border-zinc-800 dark:text-amber-300">
          {route.gap}
        </p>
      )}
    </article>
  );
}

function FileActionReceiptCard({
  receipt,
}: {
  receipt: FilePreviewActionReceipt;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {getFileActionLabel(receipt.action_kind)}
        </h3>
        <FileActionReceiptPill actionKind={receipt.action_kind} />
      </div>
      <div className="mt-2 grid gap-2 leading-5 text-zinc-500 dark:text-zinc-400 md:grid-cols-2">
        <span>格式：{receipt.file.kind}</span>
        <span>扩展：{receipt.file.extension || "未知"}</span>
        <span>大小：{receipt.file.size_label}</span>
        <span>
          本地写入：
          {receipt.boundary.action_may_write_local_workspace_data ? "是" : "否"}
        </span>
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {formatReceiptDate(receipt.created_at)} · 不含文件名、正文、字节或表格值。
      </p>
    </article>
  );
}

function FileActionReceiptPill({
  actionKind,
}: {
  actionKind: FilePreviewActionKind;
}) {
  let className =
    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  if (actionKind === "native-preview") {
    className =
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  } else if (actionKind === "download-retain") {
    className = "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  } else if (actionKind === "database-import") {
    className = "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  } else if (actionKind === "editable-import") {
    className = "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300";
  }

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {actionKind}
    </span>
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

function FilePreviewReadinessPill({
  status,
}: {
  status: FilePreviewReadinessStatus;
}) {
  const labels: Record<FilePreviewReadinessStatus, string> = {
    ready: "就绪",
    "manual-confirmation": "确认",
    blocked: "阻塞",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[status]}
    </span>
  );
}

function countCapabilities(level: FilePreviewSupportLevel) {
  return FILE_PREVIEW_CAPABILITIES.filter(
    (capability) => capability.support_level === level
  ).length;
}

function summarizeFileActionReceipts(receipts: FilePreviewActionReceipt[]) {
  return {
    total: receipts.length,
    native_preview: receipts.filter(
      (receipt) => receipt.action_kind === "native-preview"
    ).length,
    download_retain: receipts.filter(
      (receipt) => receipt.action_kind === "download-retain"
    ).length,
    editable_import: receipts.filter(
      (receipt) => receipt.action_kind === "editable-import"
    ).length,
    database_import: receipts.filter(
      (receipt) => receipt.action_kind === "database-import"
    ).length,
    external_resource_changes: receipts.filter((receipt) =>
      receipt.action_kind.startsWith("external-resource-")
    ).length,
  };
}

function getFileActionLabel(actionKind: FilePreviewActionKind) {
  const labels: Record<FilePreviewActionKind, string> = {
    "native-preview": "本地原生预览",
    "download-retain": "本地留存下载",
    "editable-import": "导入为可编辑块",
    "database-import": "导入为数据库",
    "external-resource-enable": "开启 HTML 外部资源",
    "external-resource-disable": "关闭 HTML 外部资源",
  };
  return labels[actionKind];
}

function getReportFileReceiptActionKind(
  file: Pick<StoredPageFile, "kind">
): FilePreviewActionKind {
  return file.kind === "archive" ? "download-retain" : "native-preview";
}

function formatReceiptDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function markdownPageTitleFromFile(fileName: string) {
  const baseName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return baseName ? `${baseName} 笔记` : "未命名 Markdown 笔记";
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
      <li>相关备忘录：</li>
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

function createMarkdownImportedPageContent(file: StoredPageFile) {
  return `
    <h1>Markdown 笔记</h1>
    <h2>源文件</h2>
    <ul>
      <li>文件名：${escapeHtml(file.name)}</li>
      <li>格式：Markdown / MDX</li>
      <li>本地原文件：</li>
    </ul>
    ${createFilePreviewBlockHtml(file)}
    <h2>关联研究</h2>
    <ul>
      <li>公司页面：</li>
      <li>相关报告：</li>
      <li>相关会议：</li>
      <li>相关数据库：</li>
    </ul>
    <h2>可编辑内容</h2>
    ${markdownToHtml(file.textContent ?? "")}
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
