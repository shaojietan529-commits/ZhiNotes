"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import {
  buildFileLibraryWorkbenchReport,
  type FileLibraryActionStatus,
  type FileLibraryDecisionStatus,
  type FileLibraryFileItem,
  type FileLibraryPriority,
  type FileLibraryWorkbenchReport,
} from "@/lib/files/fileLibraryWorkbench";
import {
  listStoredPageFiles,
  type StoredPageFile,
} from "@/lib/files/localStore";
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
  const [storedFiles, setStoredFiles] = useState<StoredPageFile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportingWorkbench, setExportingWorkbench] = useState(false);

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

  const fileNameById = useMemo(
    () => new Map(storedFiles.map((file) => [file.id, file.name])),
    [storedFiles]
  );

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

  const handleReviewStepOpen = (
    step: FileLibraryWorkbenchReport["review_sequence"][number]
  ) => {
    if (step.route === "/modules/files") {
      document
        .getElementById(step.target_section_id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    router.push(step.route);
  };

  const handleDecisionOpen = (
    decision: FileLibraryWorkbenchReport["decision_summary"]["decisions"][number]
  ) => {
    if (decision.route === "/modules/files") {
      document
        .getElementById(decision.target_section_id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    router.push(decision.route);
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
                ZIP 和媒体文件的本地处理路线。文件库只做 metadata 工作台，
                不自动删除、不上传、不同步、不调用 AI。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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

        <FileDecisionSummaryPanel
          summary={workbench.decision_summary}
          exportingWorkbench={exportingWorkbench}
          onExportWorkbench={handleExportWorkbench}
          onOpenDecision={handleDecisionOpen}
        />

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
                真实文件上传仍从报告库进入；Markdown 笔记继续走笔记中心；
                Excel/CSV 入库必须走数据库中心的确认门槛。本地界面显示文件名；
                导出不包含文件名、bytes 或正文。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
                工作台从 IndexedDB 文件 metadata 和格式能力矩阵生成，
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
              <div
                key={lane.id}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
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
              这张矩阵来自本地能力表和 IndexedDB 文件 metadata，只显示格式、
              扩展名、支持等级和下一步路线；不读取文件正文、bytes、表格值或上传文件。
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
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              本地文件
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              这里显示本机浏览器里的文件名，方便你识别；导出的 JSON 只保留
              redacted label 和路线信息。
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {workbench.files.length === 0 ? (
                <EmptyState
                  title="当前没有本地文件"
                  body="先从报告库上传 HTML、Markdown、PDF、Excel、Word 或 PPT，再回到文件库复核路线。"
                />
              ) : (
                workbench.files.slice(0, 12).map((file) => (
                  <FileCard
                    key={file.local_file_id}
                    item={file}
                    localName={fileNameById.get(file.local_file_id) ?? file.display_label}
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
              动作只打开本地模块或提示确认门槛，不会直接创建数据库 rows、
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
                    onClick={() => router.push(action.action_route)}
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
                  Step {step.order}
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
                {action}
              </span>
            ))}
          </div>
        </section>
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
            File Decision Summary
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
          title="Owner 待确认"
          items={summary.required_owner_decisions}
        />
      </div>

      <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        文件决策摘要只读取本地 metadata 和格式能力矩阵；导出仍不包含文件名、
        文件 bytes、文件正文、表格值、页面正文、token 或 credentials。
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
          {group.support_level}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{group.local_file_count} 个本地文件</span>
        <span>{group.route_lane_id}</span>
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
}: {
  item: FileLibraryFileItem;
  localName: string;
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
        <span>{item.support_level}</span>
        <span>{item.lane_id}</span>
        {item.database_import_candidate && <span>数据库候选</span>}
        {item.editable_import_candidate && <span>可编辑候选</span>}
        {item.download_only && <span>本地留存</span>}
      </div>
      <p className="mt-3 text-sm leading-5 text-zinc-500 dark:text-zinc-400">
        {item.next_action}
      </p>
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
    "metadata-only": "仅 metadata",
    "download-retain": "本地留存",
    "blocked-boundary": "边界阻止",
  };
  return (
    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-200">
      {label[status]}
    </span>
  );
}

function downloadJsonFile(fileName: string, payload: FileLibraryWorkbenchReport & {
  exported_at: string;
}) {
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
