"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import PageImportPlanPanel from "@/components/modules/PageImportPlanPanel";
import { usePages } from "@/hooks/usePages";
import {
  createPageWithCloud,
  updatePageWithCloud,
} from "@/lib/pages/cloudPageMutations";
import {
  appendFilePreviewActionReceipt,
  buildFilePreviewActionReceipt,
} from "@/lib/files/filePreviewActionReceipts";
import {
  buildFileLibraryWorkbenchReport,
  type FileLibraryActionStatus,
  type FileLibraryDecisionStatus,
  type FileLibraryFileItem,
  type FileLibraryLane,
  type FileLibraryPriority,
  type FileLibraryWorkbenchReport,
} from "@/lib/files/fileLibraryWorkbench";
import {
  getFilePreviewCapabilityByKind,
  type FilePreviewSupportLevel,
} from "@/lib/files/filePreviewCapabilities";
import { buildFilePreviewReadinessReport } from "@/lib/files/filePreviewReadiness";
import {
  buildFilePreviewRoutingPacket,
  type FilePreviewRoutingPacket,
  type FilePreviewRoutingStatus,
} from "@/lib/files/filePreviewRouting";
import {
  formatFileSize,
  listStoredPageFiles,
  savePageFile,
  type StoredPageFile,
} from "@/lib/files/localStore";
import {
  buildFileLibraryPageContent,
  buildFileLibraryPageTitle,
  FILE_LIBRARY_PAGE_ACTION_LABEL,
  getFileLibraryReceiptActionKind,
} from "@/lib/files/filePage";
import {
  buildZipCentralDirectoryPreview,
  buildZipImportPreflightContract,
  type ZipCentralDirectoryPreview,
} from "@/lib/files/zipImportPreflight";
import { buildReportFormatCoverageReport } from "@/lib/reports/reportFormatCoverage";
import {
  REPORT_INTAKE_LANES,
  type ReportIntakeReport,
} from "@/lib/reports/reportIntake";
import { buildReportReviewQueue } from "@/lib/reports/reportReviewQueue";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export default function FilesShell() {
  return (
    <DatabaseProvider>
      <FilesContent />
    </DatabaseProvider>
  );
}

function FilesContent() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <FilesDashboard />
      </main>
    </div>
  );
}

function FilesDashboard() {
  const router = useRouter();
  const { refresh: refreshPages } = usePages();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const zipPreviewInputRef = useRef<HTMLInputElement | null>(null);
  const [storedFiles, setStoredFiles] = useState<StoredPageFile[]>([]);
  const [fileFilterId, setFileFilterId] = useState<FileLibraryFilterId>("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportingWorkbench, setExportingWorkbench] = useState(false);
  const [exportingPreviewRouting, setExportingPreviewRouting] = useState(false);
  const [exportingZipPreflight, setExportingZipPreflight] = useState(false);
  const [readingZipPreview, setReadingZipPreview] = useState(false);
  const [zipDirectoryPreview, setZipDirectoryPreview] =
    useState<ZipCentralDirectoryPreview | null>(null);
  const [zipPreviewError, setZipPreviewError] = useState<string | null>(null);
  const [creatingFilePages, setCreatingFilePages] = useState(false);
  const [creatingExistingFilePageId, setCreatingExistingFilePageId] = useState<
    string | null
  >(null);
  const [filePageBatchMessage, setFilePageBatchMessage] = useState<{
    created: number;
    failed: number;
    total: number;
  } | null>(null);

  const loadStoredFiles = useCallback(async () => {
    try {
      setLoadError(null);
      setStoredFiles(await listStoredPageFiles());
    } catch (err) {
      console.error("[Zhinote] Failed to load file library:", err);
      setLoadError("无法加载本地文件库。");
    }
  }, []);

  useEffect(() => {
    void loadStoredFiles();
  }, [loadStoredFiles]);

  const workbench = useMemo(
    () => buildFileLibraryWorkbenchReport(storedFiles),
    [storedFiles]
  );
  const fileIntake = useMemo(
    () => buildFilesModuleIntakeReport(storedFiles),
    [storedFiles]
  );
  const filePreviewReadiness = useMemo(
    () => buildFilePreviewReadinessReport(),
    []
  );
  const reportFormatCoverage = useMemo(
    () =>
      buildReportFormatCoverageReport({
        intake: fileIntake,
        readiness: filePreviewReadiness,
      }),
    [fileIntake, filePreviewReadiness]
  );
  const reportReviewQueue = useMemo(
    () => buildReportReviewQueue(fileIntake),
    [fileIntake]
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
  const zipImportPreflight = useMemo(() => buildZipImportPreflightContract(), []);

  const fileNameById = useMemo(
    () => new Map(storedFiles.map((file) => [file.id, file.name])),
    [storedFiles]
  );
  const storedFileById = useMemo(
    () => new Map(storedFiles.map((file) => [file.id, file])),
    [storedFiles]
  );
  const filteredFiles = useMemo(
    () =>
      workbench.files.filter((file) =>
        matchesFileLibraryFilter(file, fileFilterId)
      ),
    [fileFilterId, workbench.files]
  );
  const activeFileFilter =
    FILE_LIBRARY_FILTERS.find((filter) => filter.id === fileFilterId) ??
    FILE_LIBRARY_FILTERS[0];

  const handleExportWorkbench = () => {
    setExportingWorkbench(true);
    try {
      downloadJsonFile(`zhinote-file-workbench-${fileSafeTimestamp()}.json`, {
        ...workbench,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export file workbench:", err);
      window.alert("文件工作台导出失败，请查看控制台。");
    } finally {
      setExportingWorkbench(false);
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
      console.error("[Zhinote] Failed to export file preview routing:", err);
      window.alert("文件预览路由包导出失败，请查看控制台。");
    } finally {
      setExportingPreviewRouting(false);
    }
  };

  const handleExportZipPreflight = () => {
    setExportingZipPreflight(true);
    try {
      downloadJsonFile(
        `zhinote-zip-import-preflight-${fileSafeTimestamp()}.json`,
        {
          ...zipImportPreflight,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export ZIP preflight:", err);
      window.alert("ZIP 预检合同导出失败，请查看控制台。");
    } finally {
      setExportingZipPreflight(false);
    }
  };

  const handleExportZipDirectoryPreview = () => {
    if (!zipDirectoryPreview) return;
    try {
      downloadJsonFile(
        `zhinote-zip-directory-preview-${fileSafeTimestamp()}.json`,
        {
          ...zipDirectoryPreview,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export ZIP directory preview:", err);
      window.alert("ZIP 目录预览导出失败，请查看控制台。");
    }
  };

  const handleChooseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleChooseZipPreview = () => {
    zipPreviewInputRef.current?.click();
  };

  const handleZipPreviewSelected = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setReadingZipPreview(true);
    setZipPreviewError(null);
    setZipDirectoryPreview(null);
    try {
      const preview = buildZipCentralDirectoryPreview(await file.arrayBuffer());
      setZipDirectoryPreview(preview);
    } catch (err) {
      console.error("[Zhinote] Failed to preview ZIP central directory:", err);
      setZipPreviewError(
        "无法读取这个 ZIP 的目录信息。没有保存文件、没有解压、没有创建页面。"
      );
    } finally {
      setReadingZipPreview(false);
    }
  };

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;

    setCreatingFilePages(true);
    setFilePageBatchMessage(null);
    try {
      const createdPages: Array<{ id: string }> = [];
      let failed = 0;

      for (const file of selectedFiles) {
        try {
          const storedFile = await savePageFile(file);
          const page = await createFileLibraryPageFromStoredFile(storedFile);
          createdPages.push(page);
        } catch (err) {
          failed += 1;
          console.error("[Zhinote] Failed to create file page:", err);
        }
      }

      await Promise.all([loadStoredFiles(), refreshPages()]);
      if (selectedFiles.length === 1 && createdPages[0]) {
        router.push(`/page/${createdPages[0].id}`);
        return;
      }

      setFilePageBatchMessage({
        created: createdPages.length,
        failed,
        total: selectedFiles.length,
      });

      if (createdPages.length === 0) {
        window.alert(
          "没有成功创建文件页面。文件没有上传；请检查浏览器是否允许本地存储。"
        );
      }
    } catch (err) {
      console.error("[Zhinote] Failed to create file pages:", err);
      window.alert(
        "无法从这些本地文件创建页面。文件没有上传；请检查浏览器是否允许本地存储。"
      );
    } finally {
      setCreatingFilePages(false);
    }
  };

  const createFileLibraryPageFromStoredFile = async (storedFile: StoredPageFile) => {
    const page = await createPageWithCloud({
      title: buildFileLibraryPageTitle(storedFile),
      icon: "FILE",
    });
    await updatePageWithCloud(page.id, {
      content_text: buildFileLibraryPageContent(storedFile),
    });
    const actionKind = getFileLibraryReceiptActionKind(storedFile);
    appendFilePreviewActionReceipt(
      buildFilePreviewActionReceipt({
        file: storedFile,
        action_kind: actionKind,
        source_surface: "files-module",
        writes_page_content: true,
        confirmation_required: false,
        confirmation_matched: true,
        note:
          actionKind === "download-retain"
            ? "文件已从文件模块本地留存，并创建通用文件页面；没有上传、同步或调用 AI。"
            : "文件已从文件模块创建为本地页面预览；没有上传、同步或调用 AI。",
      })
    );
    return page;
  };

  const handleCreatePageForStoredFile = async (storedFile: StoredPageFile) => {
    setCreatingExistingFilePageId(storedFile.id);
    setFilePageBatchMessage(null);
    try {
      const page = await createFileLibraryPageFromStoredFile(storedFile);
      await refreshPages();
      router.push(`/page/${page.id}`);
    } catch (err) {
      console.error("[Zhinote] Failed to create page for stored file:", err);
      window.alert(
        "无法从这个本地文件创建页面。文件没有上传；请检查浏览器是否允许本地存储。"
      );
    } finally {
      setCreatingExistingFilePageId(null);
    }
  };

  const handleReviewStepOpen = (
    step: FileLibraryWorkbenchReport["review_sequence"][number]
  ) => {
    openFileWorkflowRoute(step.route, step.target_section_id, router.push);
  };

  const handlePreviewRoutingStepOpen = (
    step: FilePreviewRoutingPacket["review_sequence"][number]
  ) => {
    openFileWorkflowRoute(step.route, step.target_section_id, router.push);
  };

  const handlePreviewRoutingRouteOpen = (
    route: FilePreviewRoutingPacket["routes"][number]
  ) => {
    const destination = getPreviewRoutingRouteDestination(route);
    openFileWorkflowRoute(
      destination.route,
      destination.target_section_id,
      router.push
    );
  };

  const handleDecisionOpen = (
    decision: FileLibraryWorkbenchReport["decision_summary"]["decisions"][number]
  ) => {
    openFileWorkflowRoute(decision.route, decision.target_section_id, router.push);
  };

  const handleNativeStrategyOpen = (
    item: FileLibraryWorkbenchReport["native_strategy"]["items"][number]
  ) => {
    openFileWorkflowRoute(item.route, item.target_section_id, router.push);
  };

  const handleLaneOpen = (lane: FileLibraryLane) => {
    openFileWorkflowRoute(
      lane.route,
      getFileLaneTargetSectionId(lane.id),
      router.push
    );
  };

  const handleActionOpen = (
    action: FileLibraryWorkbenchReport["actions"][number]
  ) => {
    openFileWorkflowRoute(
      action.action_route,
      getFileLaneTargetSectionId(action.lane_id),
      router.push
    );
  };

  return (
    <div className="w-full px-6 py-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                文件模块
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                文件库中心
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                集中盘点 HTML、Markdown、PDF、Excel、Word、PPT、Notebook、
                ZIP 和媒体文件的本地处理路线。文件库只做元数据工作台，
                不自动删除、不上传、不同步、不调用 AI。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => void handleFilesSelected(event)}
              />
              <input
                ref={zipPreviewInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={(event) => void handleZipPreviewSelected(event)}
              />
              <button
                type="button"
                onClick={handleChooseFiles}
                disabled={creatingFilePages}
                className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                {creatingFilePages ? "创建中..." : FILE_LIBRARY_PAGE_ACTION_LABEL}
              </button>
              <button
                type="button"
                onClick={() => void loadStoredFiles()}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                刷新文件库
              </button>
              <button
                type="button"
                onClick={() => router.push("/modules")}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                所有模块
              </button>
            </div>
          </div>
        </header>

        {loadError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {loadError}
          </div>
        )}

        {filePageBatchMessage && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
            已处理 {filePageBatchMessage.total} 个本地文件，创建{" "}
            {filePageBatchMessage.created} 个文件页面，失败{" "}
            {filePageBatchMessage.failed} 个。文件没有上传、同步或调用 AI。
          </div>
        )}

        <FileDecisionSummaryPanel
          summary={workbench.decision_summary}
          exportingWorkbench={exportingWorkbench}
          onExportWorkbench={handleExportWorkbench}
          onOpenDecision={handleDecisionOpen}
        />

        <FileNativeStrategyPanel
          strategy={workbench.native_strategy}
          onOpenStrategy={handleNativeStrategyOpen}
        />

        <FilePreviewRoutingHubPanel
          packet={filePreviewRouting}
          exportingPreviewRouting={exportingPreviewRouting}
          onExportPreviewRouting={handleExportPreviewRouting}
          onOpenReviewStep={handlePreviewRoutingStepOpen}
          onOpenRoute={handlePreviewRoutingRouteOpen}
        />

        <ZipImportPreflightPanel
          contract={zipImportPreflight}
          exporting={exportingZipPreflight}
          readingPreview={readingZipPreview}
          preview={zipDirectoryPreview}
          previewError={zipPreviewError}
          onExport={handleExportZipPreflight}
          onExportPreview={handleExportZipDirectoryPreview}
          onChoosePreview={handleChooseZipPreview}
        />

        <PageImportPlanPanel />

        <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Metric label="文件" value={workbench.summary.files} />
          <Metric label="总大小" value={workbench.summary.total_size_label} />
          <Metric label="原生预览" value={workbench.summary.native_files} />
          <Metric label="转换复核" value={workbench.summary.converted_files} />
          <Metric label="表格候选" value={workbench.summary.spreadsheet_candidates} />
          <Metric label="HTML 报告" value={workbench.summary.html_reports} />
          <Metric label="需确认" value={workbench.summary.confirmation_required_files} />
          <Metric label="动作" value={workbench.summary.actions} />
        </section>

        <section
          id="files-intake-entrypoints"
          className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                文件接入入口
              </p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                上传、写作和入库分开处理
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                不确定文件属于哪个模块时，先在文件库创建通用文件页面；
                HTML/PDF/PPT 等研究材料可后续进入报告库，Markdown/Word 可进入笔记，
                Excel/CSV 入库仍必须走数据库中心的确认门槛。本地界面显示文件名；
                导出不包含文件名、字节或正文。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleChooseFiles}
                disabled={creatingFilePages}
                className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                {creatingFilePages ? "创建中..." : FILE_LIBRARY_PAGE_ACTION_LABEL}
              </button>
              <RouteButton label="打开报告库上传" route="/modules/reports" />
              <RouteButton label="打开笔记中心" route="/modules/notes" />
              <RouteButton label="打开数据库中心" route="/modules/databases" />
            </div>
          </div>
        </section>

        <section
          id="files-workbench-lanes"
          className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                文件工作台
              </p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                本地格式路线和隐私边界
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                工作台从 IndexedDB 文件元数据和格式能力矩阵生成，
                用来决定哪些文件原生预览、哪些要转换复核、哪些要表格入库、
                哪些只保留下载。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportWorkbench}
              disabled={exportingWorkbench}
              className="w-fit rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              {exportingWorkbench ? "导出中..." : "导出文件工作台"}
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {workbench.lanes.map((lane) => (
              <FileLibraryLaneCard
                key={lane.id}
                lane={lane}
                onOpen={() => handleLaneOpen(lane)}
              />
            ))}
          </div>
        </section>

        <section
          id="files-format-matrix"
          className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              格式路线矩阵
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              多格式文件在 page 里的处理方式
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              这张矩阵来自本地能力表和 IndexedDB 文件元数据，只显示格式、
              扩展名、支持等级和下一步路线；不读取文件正文、字节、表格值或上传文件。
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workbench.format_groups.map((group) => (
              <FileFormatGroupCard key={group.id} group={group} />
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div
            id="files-local-files"
            className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                  本地文件
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  这里显示本机浏览器里的文件名，方便你识别；导出的 JSON 只保留
                  脱敏标签和路线信息。
                </p>
              </div>
              <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                当前筛选：{activeFileFilter.label} · {filteredFiles.length}/
                {workbench.files.length}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {FILE_LIBRARY_FILTERS.map((filter) => {
                const active = filter.id === fileFilterId;
                const count = workbench.files.filter((file) =>
                  matchesFileLibraryFilter(file, filter.id)
                ).length;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setFileFilterId(filter.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                        : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-950"
                    }`}
                    title={filter.description}
                  >
                    {filter.label} {count}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {workbench.files.length === 0 ? (
                <EmptyState
                  title="当前没有本地文件"
                  body="先在文件库创建通用文件页面，或从报告库上传 HTML、Markdown、PDF、Excel、Word 或 PPT，再回到这里复核路线。"
                />
              ) : filteredFiles.length === 0 ? (
                <EmptyState
                  title="当前筛选没有文件"
                  body="切回“全部”，或上传对应格式后再复核。本筛选只读取本地文件元数据，不读取文件正文或字节。"
                />
              ) : (
                filteredFiles.slice(0, 12).map((file) => (
                  <FileCard
                    key={file.local_file_id}
                    item={file}
                    localName={fileNameById.get(file.local_file_id) ?? file.display_label}
                    storedFile={storedFileById.get(file.local_file_id) ?? null}
                    creatingPage={creatingExistingFilePageId === file.local_file_id}
                    onCreatePage={(storedFile) =>
                      void handleCreatePageForStoredFile(storedFile)
                    }
                  />
                ))
              )}
            </div>
          </div>

          <div
            id="files-next-actions"
            className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              下一步动作
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              动作只打开本地模块或提示确认门槛，不会直接创建数据库行、
              加载外部资源、删除文件或连接云服务。
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {workbench.actions.slice(0, 10).map((action) => (
                <div
                  key={action.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityPill priority={action.priority} />
                    <ActionStatusPill status={action.status} />
                    {action.requires_manual_confirmation && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                        需确认
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {action.title}
                  </h3>
                  <p className="mt-2 text-sm leading-5 text-zinc-500 dark:text-zinc-400">
                    {action.next_action}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleActionOpen(action)}
                    className="mt-3 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {action.route_label}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="files-review-sequence"
          className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            复核顺序
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {workbench.review_sequence.map((step) => (
              <article
                key={step.id}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <span className="text-xs font-medium text-zinc-400">
                  步骤 {step.order}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-5 text-zinc-500 dark:text-zinc-400">
                  {step.reason}
                </p>
                <p className="mt-3 text-xs leading-5 text-zinc-400">
                  完成信号：{step.completion_signal}
                </p>
                <button
                  type="button"
                  onClick={() => handleReviewStepOpen(step)}
                  className="mt-3 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  打开步骤
                </button>
              </article>
            ))}
          </div>
        </section>

        <section
          id="files-privacy-boundary"
          className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            禁止动作
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {workbench.forbidden_actions.map((action) => (
              <span
                key={action}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
              >
                {getForbiddenActionLabel(action)}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ZipImportPreflightPanel({
  contract,
  exporting,
  readingPreview,
  preview,
  previewError,
  onExport,
  onExportPreview,
  onChoosePreview,
}: {
  contract: ReturnType<typeof buildZipImportPreflightContract>;
  exporting: boolean;
  readingPreview: boolean;
  preview: ZipCentralDirectoryPreview | null;
  previewError: string | null;
  onExport: () => void;
  onExportPreview: () => void;
  onChoosePreview: () => void;
}) {
  return (
    <section
      id="files-zip-import-preflight"
      className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            ZIP 批量导入预检
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            先定义路线，不读取真实 ZIP
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            这个合同只描述未来 ZIP 导入如何把 Markdown/HTML/Word/EPUB/OPML
            映射为页面，把 CSV/Excel/ODS 映射为数据库，把 PDF/PPT/未知格式留在
            本地复核队列。当前不会读取 ZIP、文件名、条目字节，也不会解压或写入工作区。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onChoosePreview}
            disabled={readingPreview}
            className="w-fit rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            {readingPreview ? "读取中..." : "选择 ZIP 只读预览"}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {exporting ? "导出中..." : "导出 ZIP 预检合同"}
          </button>
        </div>
      </div>

      {previewError && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {previewError}
        </div>
      )}

      {preview && (
        <ZipCentralDirectoryPreviewPanel
          preview={preview}
          onExportPreview={onExportPreview}
        />
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric label="页面格式" value={contract.summary.planned_page_formats} />
        <Metric
          label="数据库格式"
          value={contract.summary.planned_database_formats}
        />
        <Metric
          label="本地留存"
          value={contract.summary.planned_local_retain_formats}
        />
        <Metric
          label="阻塞复核"
          value={contract.summary.blocked_until_owner_review}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-2 md:grid-cols-2">
          {contract.format_routes.map((route) => (
            <article
              key={route.id}
              className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {route.label}
                  </h3>
                  <p className="mt-1 text-zinc-400">
                    {route.extensions.join(", ")}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                  {getZipRouteLabel(route.planned_route)}
                </span>
              </div>
              <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
                {route.privacy_boundary}
              </p>
            </article>
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            必需 gate
          </div>
          {contract.required_gates.map((gate) => (
            <article
              key={gate.id}
              className="rounded-md bg-zinc-50 p-3 text-xs dark:bg-zinc-950"
            >
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                {gate.label}
              </h3>
              <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
                {gate.required_before}
              </p>
              <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
                {gate.reason}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ZipCentralDirectoryPreviewPanel({
  preview,
  onExportPreview,
}: {
  preview: ZipCentralDirectoryPreview;
  onExportPreview: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-sky-700 dark:text-sky-300">
            ZIP 只读目录预览
          </p>
          <h3 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            只显示扩展名分布，不展示内部文件名
          </h3>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-sky-900/80 dark:text-sky-100/80">
            {preview.privacy_note}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-fit rounded-full bg-white px-2 py-1 text-[10px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-200">
            {preview.preview_status}
          </span>
          <button
            type="button"
            onClick={onExportPreview}
            className="rounded-md border border-sky-200 bg-white px-2 py-1 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200 dark:hover:bg-sky-900"
          >
            导出 ZIP 目录预览
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <Metric label="条目" value={preview.summary.entries} />
        <Metric label="文件" value={preview.summary.files} />
        <Metric label="文件夹" value={preview.summary.directories} />
        <Metric
          label="压缩后大小"
          value={formatFileSize(preview.summary.total_compressed_size_bytes)}
        />
        <Metric label="扩展名组" value={preview.summary.extension_groups} />
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {preview.extension_groups.map((group) => (
          <article
            key={group.extension}
            className="rounded-md border border-sky-100 bg-white p-3 text-xs dark:border-sky-900 dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {group.extension}
                </h4>
                <p className="mt-1 text-zinc-400">
                  {group.entries} 个条目 ·{" "}
                  {formatFileSize(group.total_compressed_size_bytes)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-sky-100 px-2 py-1 text-[10px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-200">
                {getZipRouteLabel(group.planned_route)}
              </span>
            </div>
            <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
              目标模块：{getZipDestinationModuleLabel(group.destination_module)}
            </p>
          </article>
        ))}
      </div>

      {preview.summary.truncated_extension_groups > 0 && (
        <p className="mt-3 text-xs leading-5 text-sky-800 dark:text-sky-200">
          还有 {preview.summary.truncated_extension_groups} 组扩展名未显示；预览仍不返回文件名。
        </p>
      )}

      <div className="mt-4 rounded-md bg-white/80 p-3 text-xs dark:bg-sky-950">
        <h4 className="font-semibold text-sky-900 dark:text-sky-100">
          预览后的确认队列
        </h4>
        <ul className="mt-2 space-y-1 leading-5 text-sky-900 dark:text-sky-100">
          {preview.next_steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-md bg-white/80 px-3 py-2 text-xs leading-5 text-sky-900 dark:bg-sky-950 dark:text-sky-100">
        边界：不读取条目 bytes、不解压、不创建 page/database、不上传、不调用 AI。
      </div>
    </div>
  );
}

function FileDecisionSummaryPanel({
  summary,
  exportingWorkbench,
  onExportWorkbench,
  onOpenDecision,
}: {
  summary: FileLibraryWorkbenchReport["decision_summary"];
  exportingWorkbench: boolean;
  onExportWorkbench: () => void;
  onOpenDecision: (
    decision: FileLibraryWorkbenchReport["decision_summary"]["decisions"][number]
  ) => void;
}) {
  return (
    <section
      id="files-decision-summary"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            文件决策摘要
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            文件格式接入决策摘要
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {summary.current_conclusion}
          </p>
        </div>
        <button
          type="button"
          onClick={onExportWorkbench}
          disabled={exportingWorkbench}
          className="w-fit whitespace-nowrap rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          {exportingWorkbench ? "导出中..." : "导出工作台"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {summary.decisions.map((decision) => (
          <FileDecisionCard
            key={decision.id}
            decision={decision}
            onOpen={() => onOpenDecision(decision)}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <FileDecisionList title="当前可做" items={summary.safe_local_work} />
        <FileDecisionList title="保持关闭" items={summary.blocked_work} />
        <FileDecisionList
          title="待你确认"
          items={summary.required_owner_decisions}
        />
      </div>

      <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        文件决策摘要只读取本地元数据和格式能力矩阵；导出仍不包含文件名、
        文件字节、文件正文、表格值、页面正文、token 或凭证。
      </p>
    </section>
  );
}

function FileDecisionCard({
  decision,
  onOpen,
}: {
  decision: FileLibraryWorkbenchReport["decision_summary"]["decisions"][number];
  onOpen: () => void;
}) {
  return (
    <article className="flex min-h-[220px] flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
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
          <FileDecisionStatusPill status={decision.status} />
        </div>
        <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
          {decision.evidence}
        </p>
      </div>
      <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="text-xs leading-5 text-zinc-400">{decision.next_action}</p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          打开对应区域
        </button>
      </div>
    </article>
  );
}

function FileDecisionList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <article className="rounded-lg bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-950">
      <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function FileDecisionStatusPill({
  status,
}: {
  status: FileLibraryDecisionStatus;
}) {
  const label: Record<FileLibraryDecisionStatus, string> = {
    "available-local": "本地可做",
    "requires-owner-confirmation": "需确认",
    blocked: "阻塞",
  };
  const className: Record<FileLibraryDecisionStatus, string> = {
    "available-local":
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200",
    "requires-owner-confirmation":
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    blocked: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${className[status]}`}>
      {label[status]}
    </span>
  );
}

function FileNativeStrategyPanel({
  strategy,
  onOpenStrategy,
}: {
  strategy: FileLibraryWorkbenchReport["native_strategy"];
  onOpenStrategy: (
    item: FileLibraryWorkbenchReport["native_strategy"]["items"][number]
  ) => void;
}) {
  return (
    <section
      id="files-native-strategy"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            原生格式策略
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            原生格式策略
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {strategy.current_recommendation}
          </p>
        </div>
        <div className="grid min-w-[260px] gap-2 text-xs sm:grid-cols-3">
          <NativeStrategyFact
            label="统一容器"
            value={getNativeStrategyValueLabel(strategy.canonical_container)}
          />
          <NativeStrategyFact
            label="报告首选"
            value={getNativeStrategyValueLabel(
              strategy.primary_generated_report_format
            )}
          />
          <NativeStrategyFact
            label="笔记首选"
            value={getNativeStrategyValueLabel(
              strategy.primary_written_note_format
            )}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {strategy.items.map((item) => (
          <FileNativeStrategyCard
            key={item.id}
            item={item}
            onOpen={() => onOpenStrategy(item)}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <NativeStrategyList title="安全默认" items={strategy.safe_defaults} />
        <NativeStrategyList title="默认保持关闭" items={strategy.blocked_defaults} />
      </div>

      <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        {strategy.privacy_boundary}
      </p>
    </section>
  );
}

function NativeStrategyFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="text-[10px] uppercase tracking-wider text-zinc-400">
        {label}
      </div>
      <div className="mt-1 font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function FileNativeStrategyCard({
  item,
  onOpen,
}: {
  item: FileLibraryWorkbenchReport["native_strategy"]["items"][number];
  onOpen: () => void;
}) {
  return (
    <article className="flex min-h-[260px] flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">
              {item.label}
            </h3>
            <p className="mt-1 font-mono text-[11px] text-zinc-400">
              {getNativeRouteLabel(item.default_route)}
            </p>
          </div>
          <NativePreferencePill preference={item.native_preference} />
        </div>
        <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
          {item.best_for}
        </p>
        <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
          {item.page_behavior}
        </p>
      </div>
      <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="text-xs leading-5 text-zinc-400">{item.owner_gate}</p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          打开路线
        </button>
      </div>
    </article>
  );
}

function NativePreferencePill({
  preference,
}: {
  preference: FileLibraryWorkbenchReport["native_strategy"]["items"][number]["native_preference"];
}) {
  const label: Record<typeof preference, string> = {
    primary: "首选",
    supported: "支持",
    "review-required": "复核",
    "retain-only": "保留",
  };
  const className: Record<typeof preference, string> = {
    primary: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200",
    supported: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
    "review-required":
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    "retain-only":
      "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  };

  return (
    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${className[preference]}`}>
      {label[preference]}
    </span>
  );
}

function NativeStrategyList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <article className="rounded-lg bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-950">
      <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function FilePreviewRoutingHubPanel({
  packet,
  exportingPreviewRouting,
  onExportPreviewRouting,
  onOpenReviewStep,
  onOpenRoute,
}: {
  packet: FilePreviewRoutingPacket;
  exportingPreviewRouting: boolean;
  onExportPreviewRouting: () => void;
  onOpenReviewStep: (
    step: FilePreviewRoutingPacket["review_sequence"][number]
  ) => void;
  onOpenRoute: (route: FilePreviewRoutingPacket["routes"][number]) => void;
}) {
  return (
    <section
      id="files-preview-routing"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            文件预览路由
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            文件预览路由总控
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            把文件预览就绪度、格式覆盖和复核队列汇总成每种文件进入
            ZhiNotes page 的路线：原生预览、可编辑导入、表格入库、
            元数据复核或本地留存。不读取文件名、正文、字节、表格值，
            不写入、不上传、不调用 AI。
          </p>
        </div>
        <button
          type="button"
          onClick={onExportPreviewRouting}
          disabled={exportingPreviewRouting}
          className="w-fit whitespace-nowrap rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          {exportingPreviewRouting ? "导出中..." : "导出路由包"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <FilePreviewRoutingFact label="路线" value={packet.summary.routes} />
        <FilePreviewRoutingFact
          label="活跃文件"
          value={packet.summary.active_items}
        />
        <FilePreviewRoutingFact
          label="原生路线"
          value={packet.summary.native_routes}
        />
        <FilePreviewRoutingFact
          label="可编辑导入"
          value={packet.summary.editable_import_routes}
        />
        <FilePreviewRoutingFact
          label="表格候选"
          value={packet.summary.database_import_candidates}
        />
        <FilePreviewRoutingFact
          label="需确认"
          value={packet.summary.confirmation_routes}
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {packet.lanes.map((lane) => (
          <article
            key={lane.id}
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">
                {lane.title}
              </h3>
              <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {lane.route_count} 路线
              </span>
            </div>
            <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
              {lane.description}
            </p>
            <p className="mt-3 text-xs leading-5 text-zinc-400">
              {lane.active_items} 个活跃项 · {lane.confirmation_routes} 条确认路线
            </p>
          </article>
        ))}
      </div>

      <div className="mt-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            格式路线
          </h3>
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            每张卡只展示格式级路线和动作，不展示真实文件名或文件内容。
          </p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {packet.routes.map((route) => (
            <FilePreviewRoutingRouteCard
              key={route.id}
              route={route}
              onOpen={() => onOpenRoute(route)}
            />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          复核顺序
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {packet.review_sequence.map((step) => (
            <FilePreviewRoutingReviewStepCard
              key={step.id}
              step={step}
              onOpen={() => onOpenReviewStep(step)}
            />
          ))}
        </div>
      </div>

      <p className="mt-5 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        {packet.privacy_note}
      </p>
    </section>
  );
}

function FilePreviewRoutingFact({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="text-[10px] uppercase tracking-wider text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function FilePreviewRoutingRouteCard({
  route,
  onOpen,
}: {
  route: FilePreviewRoutingPacket["routes"][number];
  onOpen: () => void;
}) {
  return (
    <article className="flex min-h-[250px] flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">
              {route.label}
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              {route.extensions.length > 0
                ? route.extensions.join(" / ")
                : "未登记扩展名"}
            </p>
          </div>
          <FilePreviewRoutingStatusPill status={route.status} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{getPreviewRoutingLaneLabel(route.lane_id)}</span>
          <span>{getSupportLevelLabel(route.support_level)}</span>
          <span>{getPreviewRoutingSurfaceLabel(route.display_surface)}</span>
          {route.confirmation_required && <span>需确认</span>}
        </div>
        <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
          {route.primary_action}
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          {route.secondary_action}
        </p>
      </div>
      <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="text-xs leading-5 text-zinc-400">
          {route.active_items} 个活跃项 · {route.privacy_boundary}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          打开路线
        </button>
      </div>
    </article>
  );
}

function FilePreviewRoutingReviewStepCard({
  step,
  onOpen,
}: {
  step: FilePreviewRoutingPacket["review_sequence"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <span className="text-xs font-medium text-zinc-400">
        步骤 {step.order}
      </span>
      <h3 className="mt-2 font-semibold text-zinc-950 dark:text-zinc-50">
        {step.title}
      </h3>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {step.reason}
      </p>
      <p className="mt-3 text-xs leading-5 text-zinc-400">
        完成信号：{step.completion_signal}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        打开步骤
      </button>
    </article>
  );
}

function FilePreviewRoutingStatusPill({
  status,
}: {
  status: FilePreviewRoutingStatus;
}) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${getPreviewRoutingStatusClassName(
        status
      )}`}
    >
      {getPreviewRoutingStatusLabel(status)}
    </span>
  );
}

function getNativeStrategyValueLabel(value: string) {
  const labels: Record<string, string> = {
    "zhinote-page": "ZhiNotes Page",
    html: "HTML 报告",
    markdown: "Markdown 笔记",
    "tiptap-html": "可编辑页面块",
  };
  return labels[value] ?? value;
}

function getNativeRouteLabel(
  route: FileLibraryWorkbenchReport["native_strategy"]["items"][number]["default_route"]
) {
  const labels: Record<typeof route, string> = {
    "page-native-preview": "Page 原生预览",
    "editable-page-import": "可编辑页面导入",
    "database-import-candidate": "数据库导入候选",
    "conversion-review": "转换复核",
    "metadata-retain": "元数据留存",
  };
  return labels[route];
}

function FileLibraryLaneCard({
  lane,
  onOpen,
}: {
  lane: FileLibraryLane;
  onOpen: () => void;
}) {
  return (
    <article className="flex min-h-[210px] flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {lane.title}
          </h3>
          <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {lane.file_count} 文件
          </span>
        </div>
        <p className="mt-2 text-sm leading-5 text-zinc-500 dark:text-zinc-400">
          {lane.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{lane.action_count} 动作</span>
          <span>{lane.high_priority_count} 高优先级</span>
          <span>{lane.route}</span>
        </div>
      </div>
      <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="text-xs leading-5 text-zinc-400">
          {lane.privacy_boundary}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          打开路线
        </button>
      </div>
    </article>
  );
}

function RouteButton({ label, route }: { label: string; route: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(route)}
      className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {label}
    </button>
  );
}

function getZipRouteLabel(
  route: "page-import" | "database-import" | "local-retain" | "blocked-review"
) {
  const labels: Record<typeof route, string> = {
    "page-import": "页面",
    "database-import": "数据库",
    "local-retain": "本地留存",
    "blocked-review": "阻塞复核",
  };
  return labels[route];
}

function getZipDestinationModuleLabel(
  module: "notes" | "reports" | "databases" | "files"
) {
  const labels: Record<typeof module, string> = {
    notes: "笔记",
    reports: "报告",
    databases: "数据库",
    files: "文件",
  };
  return labels[module];
}

function getFileLaneTargetSectionId(laneId: FileLibraryLane["id"]) {
  const targets: Record<FileLibraryLane["id"], string> = {
    "native-preview": "reports-preview-routing",
    "editable-import": "reports-conversion-review",
    "database-import": "databases-import-export-readiness",
    "metadata-review": "files-format-matrix",
    "download-retain": "files-local-files",
    "cloud-ai-boundary": "web-beta-owner-review",
  };
  return targets[laneId];
}

function openFileWorkflowRoute(
  route: string,
  targetSectionId: string,
  navigate: (route: string) => void
) {
  if (route === "/modules/files") {
    document
      .getElementById(targetSectionId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  navigate(`${route}#${targetSectionId}`);
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <p className="mt-2 truncate text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function FileFormatGroupCard({
  group,
}: {
  group: FileLibraryWorkbenchReport["format_groups"][number];
}) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">
            {group.label}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            {group.extensions.join(" / ")}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {getSupportLevelLabel(group.support_level)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{group.local_file_count} 个本地文件</span>
        <span>{getLaneLabel(group.route_lane_id)}</span>
        {group.confirmation_required && <span>需确认</span>}
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {group.next_action}
      </p>
      <p className="mt-3 border-t border-zinc-200 pt-3 text-xs leading-5 text-zinc-400 dark:border-zinc-800">
        {group.privacy_boundary}
      </p>
    </article>
  );
}

function FileCard({
  item,
  localName,
  storedFile,
  creatingPage,
  onCreatePage,
}: {
  item: FileLibraryFileItem;
  localName: string;
  storedFile: StoredPageFile | null;
  creatingPage: boolean;
  onCreatePage: (storedFile: StoredPageFile) => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {localName}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            导出标签：{item.display_label}
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {item.kind_label}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{item.size_label}</span>
        <span>{getSupportLevelLabel(item.support_level)}</span>
        <span>{getLaneLabel(item.lane_id)}</span>
        {item.database_import_candidate && <span>数据库候选</span>}
        {item.editable_import_candidate && <span>可编辑候选</span>}
        {item.download_only && <span>本地留存</span>}
      </div>
      <p className="mt-3 text-sm leading-5 text-zinc-500 dark:text-zinc-400">
        {item.next_action}
      </p>
      <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => storedFile && onCreatePage(storedFile)}
          disabled={!storedFile || creatingPage}
          className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {creatingPage ? "创建中..." : "从本地文件创建 Page"}
        </button>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          只复用浏览器本地文件和通用文件页面模板；不上传、不同步、不调用 AI。
        </p>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm dark:border-zinc-700 dark:bg-zinc-950">
      <h3 className="font-medium text-zinc-950 dark:text-zinc-50">{title}</h3>
      <p className="mt-2 leading-6 text-zinc-500 dark:text-zinc-400">{body}</p>
    </div>
  );
}

function PriorityPill({ priority }: { priority: FileLibraryPriority }) {
  const label: Record<FileLibraryPriority, string> = {
    high: "高",
    medium: "中",
    low: "低",
  };
  const className: Record<FileLibraryPriority, string> = {
    high: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    low: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  };
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${className[priority]}`}>
      {label[priority]}优先级
    </span>
  );
}

function ActionStatusPill({ status }: { status: FileLibraryActionStatus }) {
  const label: Record<FileLibraryActionStatus, string> = {
    "ready-to-preview": "可预览",
    "needs-conversion-review": "需转换复核",
    "needs-database-confirmation": "需入库确认",
    "metadata-only": "仅元数据",
    "download-retain": "本地留存",
    "blocked-boundary": "边界阻止",
  };
  return (
    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-200">
      {label[status]}
    </span>
  );
}

function getSupportLevelLabel(
  level: FilePreviewSupportLevel | "unknown"
): string {
  const labels: Record<FilePreviewSupportLevel | "unknown", string> = {
    native: "原生预览",
    converted: "本地转换",
    metadata: "元数据复核",
    "download-only": "仅下载",
    unknown: "未知支持",
  };
  return labels[level];
}

function getLaneLabel(laneId: FileLibraryLane["id"]): string {
  const labels: Record<FileLibraryLane["id"], string> = {
    "native-preview": "原生预览",
    "editable-import": "可编辑导入",
    "database-import": "表格入库",
    "metadata-review": "元数据复核",
    "download-retain": "本地留存",
    "cloud-ai-boundary": "云/AI 边界",
  };
  return labels[laneId];
}

function getForbiddenActionLabel(action: string): string {
  const labels: Record<string, string> = {
    upload_file_bytes_without_confirmation: "未确认前上传文件字节",
    send_file_text_to_ai: "向 AI 发送文件文本",
    load_html_external_resources_without_confirmation:
      "未确认加载 HTML 外部资源",
    bulk_import_spreadsheet_without_typed_confirmation:
      "未输入确认文本批量导入表格",
    delete_or_overwrite_local_files: "删除或覆盖本地文件",
    export_file_names_from_workbench: "从工作台导出文件名",
    export_file_bytes_from_workbench: "从工作台导出文件字节",
    sync_files_to_cloud: "同步文件到云端",
    execute_notebook_code: "执行 Notebook 代码",
    unzip_archive_into_workspace: "解包压缩包到工作区",
  };
  return labels[action] ?? action;
}

function buildFilesModuleIntakeReport(
  storedFiles: StoredPageFile[]
): ReportIntakeReport {
  const items = storedFiles.map((file, index) => {
    const capability = getFilePreviewCapabilityByKind(file.kind);
    const priority = getFilesModuleIntakePriority(file.kind);

    return {
      id: `files-module:${index + 1}:${file.kind}`,
      page_id: "files-module",
      page_title: "文件库本地文件",
      file_id: `local-file-${index + 1}`,
      file_name: getSyntheticFileRouteLabel(file.kind, index),
      file_kind: file.kind,
      file_size: file.size,
      file_size_label: formatFileSize(file.size),
      mime_type: file.mimeType || "application/octet-stream",
      stage: getFilesModuleIntakeStage(file.kind),
      priority,
      preview_support: capability?.support_level ?? "unknown",
      next_action: getFilesModuleIntakeNextAction(file.kind),
      relation_gaps: ["待确认"],
      privacy_boundary:
        capability?.privacy_boundary ??
        "本地文件只保存在浏览器工作区；未知格式默认只做本地保存和下载。",
      updated_at: file.createdAt,
    } satisfies ReportIntakeReport["items"][number];
  });
  const uniqueFileKinds = new Set(items.map((item) => item.file_kind));

  return {
    format: "zhinote-report-intake-report",
    format_version: 1,
    report_status: "local-report-intake-only",
    privacy_note:
      "由文件库本地元数据生成，只用于格式路线计数；不导出真实文件名、文件字节、文件正文、页面正文、云端数据、AI prompt、token 或凭证。",
    boundary: {
      local_report_only: true,
      reads_local_page_html: true,
      extracts_file_preview_attributes_only: true,
      reads_file_bytes: false,
      reads_file_text: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      pages_scanned: 0,
      intake_items: items.length,
      high_priority: items.filter((item) => item.priority === "high").length,
      medium_priority: items.filter((item) => item.priority === "medium").length,
      low_priority: items.filter((item) => item.priority === "low").length,
      unique_file_kinds: uniqueFileKinds.size,
      html_reports: items.filter((item) => item.file_kind === "html").length,
      spreadsheet_candidates: items.filter(
        (item) => item.file_kind === "spreadsheet"
      ).length,
    },
    lanes: REPORT_INTAKE_LANES,
    items,
  };
}

function getFilesModuleIntakeStage(
  kind: StoredPageFile["kind"]
): ReportIntakeReport["items"][number]["stage"] {
  if (kind === "spreadsheet") return "database-review";
  if (kind === "archive" || kind === "unknown") return "source-triage";
  if (kind === "image" || kind === "audio" || kind === "video") {
    return "source-triage";
  }
  return "reading-review";
}

function getFilesModuleIntakePriority(
  kind: StoredPageFile["kind"]
): ReportIntakeReport["items"][number]["priority"] {
  if (
    kind === "html" ||
    kind === "markdown" ||
    kind === "pdf" ||
    kind === "spreadsheet" ||
    kind === "word" ||
    kind === "presentation" ||
    kind === "notebook"
  ) {
    return "high";
  }
  if (kind === "archive" || kind === "epub" || kind === "rtf" || kind === "text") {
    return "medium";
  }
  return "low";
}

function getFilesModuleIntakeNextAction(kind: StoredPageFile["kind"]) {
  if (kind === "spreadsheet") {
    return "确认字段、行数和导入边界后，再决定是否转成本地数据库。";
  }
  if (kind === "html") {
    return "保持外部资源阻止，先在 page 内阅读 AI 可视化报告。";
  }
  if (kind === "markdown") {
    return "导入为可编辑 page 内容后，继续补结论、假设影响和后续问题。";
  }
  if (kind === "pdf" || kind === "word" || kind === "presentation") {
    return "先做阅读或转换复核，再关联公司、会议和备忘录。";
  }
  if (kind === "notebook") {
    return "只复核输出和图表，不执行 notebook 代码。";
  }
  if (kind === "archive") {
    return "先查看压缩包目录，不自动解包写入工作区。";
  }
  return "确认研究用途、来源可信度和是否需要转为标准报告页。";
}

function getSyntheticFileRouteLabel(kind: StoredPageFile["kind"], index: number) {
  return `local-${kind}-file-${index + 1}`;
}

function getPreviewRoutingRouteDestination(
  route: FilePreviewRoutingPacket["routes"][number]
) {
  if (route.lane_id === "database-import") {
    return {
      route: "/modules/databases",
      target_section_id: "databases-import-export-readiness",
    };
  }
  if (route.lane_id === "metadata-review" || route.lane_id === "gap-review") {
    return { route: "/modules/files", target_section_id: "files-format-matrix" };
  }
  if (route.lane_id === "download-retain") {
    return { route: "/modules/files", target_section_id: "files-local-files" };
  }
  if (route.lane_id === "editable-import") {
    return {
      route: "/modules/reports",
      target_section_id: "reports-conversion-review",
    };
  }
  return { route: "/modules/reports", target_section_id: "reports-preview-routing" };
}

function getPreviewRoutingLaneLabel(
  laneId: FilePreviewRoutingPacket["routes"][number]["lane_id"]
) {
  const labels: Record<typeof laneId, string> = {
    "native-preview": "原生预览",
    "editable-import": "可编辑导入",
    "database-import": "表格入库",
    "metadata-review": "元数据复核",
    "download-retain": "本地留存",
    "gap-review": "缺口复核",
  };
  return labels[laneId];
}

function getPreviewRoutingSurfaceLabel(
  surface: FilePreviewRoutingPacket["routes"][number]["display_surface"]
) {
  const labels: Record<typeof surface, string> = {
    "sandboxed-iframe": "沙盒 iframe",
    "browser-native": "浏览器原生",
    "converted-html": "转换 HTML",
    "metadata-list": "元数据列表",
    "download-retain": "下载留存",
  };
  return labels[surface];
}

function getPreviewRoutingStatusLabel(status: FilePreviewRoutingStatus) {
  const labels: Record<FilePreviewRoutingStatus, string> = {
    "native-ready": "原生可用",
    "external-confirmation": "外部资源确认",
    "converted-review": "转换复核",
    "database-confirmation": "入库确认",
    "metadata-review": "元数据复核",
    "download-retain": "本地留存",
    "blocked-limited": "受限",
    unsupported: "未支持",
  };
  return labels[status];
}

function getPreviewRoutingStatusClassName(status: FilePreviewRoutingStatus) {
  const classNames: Record<FilePreviewRoutingStatus, string> = {
    "native-ready":
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200",
    "external-confirmation":
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    "converted-review":
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
    "database-confirmation":
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    "metadata-review":
      "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    "download-retain":
      "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    "blocked-limited":
      "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
    unsupported: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
  };
  return classNames[status];
}

type FileLibraryFilterId =
  | "all"
  | "html"
  | "markdown"
  | "native"
  | "editable"
  | "database"
  | "metadata"
  | "retain";

const FILE_LIBRARY_FILTERS: Array<{
  id: FileLibraryFilterId;
  label: string;
  description: string;
}> = [
  {
    id: "all",
    label: "全部",
    description: "显示所有本地文件。",
  },
  {
    id: "html",
    label: "HTML",
    description: "AI 生成的 HTML 可视化报告优先原生预览。",
  },
  {
    id: "markdown",
    label: "Markdown",
    description: "个人笔记和可编辑导入优先格式。",
  },
  {
    id: "native",
    label: "原生预览",
    description: "HTML、PDF、图片、音频、视频和文本等本地预览路线。",
  },
  {
    id: "editable",
    label: "可编辑导入",
    description: "Markdown、Word、PPT、RTF、EPUB、Notebook 等转换复核路线。",
  },
  {
    id: "database",
    label: "表格入库",
    description: "Excel、CSV、TSV、ODS 等数据库导入候选。",
  },
  {
    id: "metadata",
    label: "元数据复核",
    description: "ZIP、未知或需要先看格式路线的文件。",
  },
  {
    id: "retain",
    label: "本地留存",
    description: "暂不安全转换、只保留下载和后续手动复核的文件。",
  },
];

function matchesFileLibraryFilter(
  file: FileLibraryFileItem,
  filterId: FileLibraryFilterId
) {
  if (filterId === "all") return true;
  if (filterId === "html") return file.kind === "html";
  if (filterId === "markdown") return file.kind === "markdown";
  if (filterId === "native") return file.lane_id === "native-preview";
  if (filterId === "editable") return file.editable_import_candidate;
  if (filterId === "database") return file.database_import_candidate;
  if (filterId === "metadata") return file.lane_id === "metadata-review";
  if (filterId === "retain") return file.download_only;
  return true;
}

function downloadJsonFile(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function fileSafeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
