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
