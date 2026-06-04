"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import { usePageFavorites } from "@/hooks/usePageFavorites";
import { usePages } from "@/hooks/usePages";
import {
  createPage,
  getPageModuleCounts,
  type PageModuleCounts,
} from "@/lib/db/local/queries";
import { executeModuleStarter } from "@/lib/modules/actions";
import {
  buildNotesModuleWorkbenchReport,
  type NotesModuleActionStatus,
  type NotesModulePriority,
  type NotesModuleWorkbenchReport,
} from "@/lib/pages/notesModule";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const NOTE_TEMPLATE_STARTERS = [
  {
    label: "投资备忘录",
    title: "未命名投资备忘录",
    templateTitle: "投资备忘录",
    icon: "MEMO",
  },
  {
    label: "公司研究页",
    title: "未命名公司研究",
    templateTitle: "公司研究",
    icon: "CO",
  },
  {
    label: "会议纪要",
    title: "未命名会议纪要",
    templateTitle: "会议纪要",
    icon: "MTG",
  },
  {
    label: "研究报告",
    title: "未命名研究报告",
    templateTitle: "研究报告",
    icon: "RPT",
  },
];

export default function NotesShell() {
  return (
    <DatabaseProvider>
      <NotesContent />
    </DatabaseProvider>
  );
}

function NotesContent() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <NotesDashboard />
      </main>
    </div>
  );
}

function NotesDashboard() {
  const router = useRouter();
  const { pages, refresh } = usePages();
  const { favoriteIds } = usePageFavorites();
  const [counts, setCounts] = useState<Record<string, PageModuleCounts>>({});
  const [lockedPageIds, setLockedPageIds] = useState<Set<string>>(
    () => new Set()
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportingWorkbench, setExportingWorkbench] = useState(false);

  const loadCounts = useCallback(async () => {
    try {
      setLoadError(null);
      setCounts(await getPageModuleCounts());
    } catch (err) {
      console.error("[Zhinote] Failed to load notes module counts:", err);
      setLoadError("无法加载本地笔记模块统计。");
    }
  }, []);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts, pages.length]);

  useEffect(() => {
    queueMicrotask(() => {
      const nextLockedIds = new Set<string>();
      for (const page of pages) {
        if (window.localStorage.getItem(`zhinote.page.locked.${page.id}`) === "true") {
          nextLockedIds.add(page.id);
        }
      }
      setLockedPageIds(nextLockedIds);
    });
  }, [pages]);

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const workbench = useMemo(
    () =>
      buildNotesModuleWorkbenchReport(
        pages.map((page) => ({
          page,
          favorite: favoriteIdSet.has(page.id),
          locked: lockedPageIds.has(page.id),
          counts: counts[page.id] ?? getEmptyPageCounts(page.id),
        }))
      ),
    [counts, favoriteIdSet, lockedPageIds, pages]
  );

  const handleCreateBlankPage = async () => {
    setBusyAction("blank-page");
    try {
      const page = await createPage({ title: "未命名研究笔记", icon: "NOTE" });
      await refresh();
      await loadCounts();
      router.push(`/page/${page.id}`);
    } catch (err) {
      console.error("[Zhinote] Failed to create note page:", err);
      window.alert("笔记创建失败，请查看控制台。");
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateTemplatePage = async (
    starter: (typeof NOTE_TEMPLATE_STARTERS)[number]
  ) => {
    setBusyAction(starter.label);
    try {
      const result = await executeModuleStarter({
        type: "page",
        label: starter.label,
        title: starter.title,
        templateTitle: starter.templateTitle,
        icon: starter.icon,
      });
      await refresh();
      await loadCounts();
      router.push(result.route);
    } catch (err) {
      console.error("[Zhinote] Failed to create template note:", err);
      window.alert("模板笔记创建失败，请查看控制台。");
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportWorkbench = () => {
    setExportingWorkbench(true);
    try {
      downloadJsonFile(`zhinote-notes-workbench-${fileSafeTimestamp()}.json`, {
        ...workbench,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export notes workbench:", err);
      window.alert("笔记工作台导出失败，请查看控制台。");
    } finally {
      setExportingWorkbench(false);
    }
  };

  const handleReviewStepNavigate = (
    step: NotesModuleWorkbenchReport["review_sequence"][number]
  ) => {
    if (step.route === "/modules/notes") {
      document
        .getElementById(step.target_section_id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    router.push(step.route);
  };

  return (
    <div className="w-full px-6 py-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                笔记模块
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                笔记与页面中心
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                把本地 page 变成投研平台的知识库底座：集中查看结构、关联、版本、
                评论、收藏、锁定和导出边界。这个页面只在浏览器本地运行。
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

        {loadError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {loadError}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Metric label="页面" value={workbench.summary.pages} />
          <Metric label="根页面" value={workbench.summary.root_pages} />
          <Metric label="子页面" value={workbench.summary.child_pages} />
          <Metric label="结构就绪" value={workbench.summary.structured_pages} />
          <Metric
            label="需结构"
            value={workbench.summary.needs_structure_pages}
          />
          <Metric label="有版本" value={workbench.summary.pages_with_versions} />
          <Metric
            label="有链接"
            value={workbench.summary.pages_with_links}
          />
          <Metric label="行动" value={workbench.summary.actions} />
        </section>

        <section
          id="notes-create-entry"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                创建笔记入口
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                可以创建空白研究笔记，或直接用投研模板创建本地 page。模板只写入当前
                浏览器本地页面，不同步、不上传、不调用 AI。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                label="新建空白笔记"
                busy={busyAction === "blank-page"}
                emphasis
                onClick={() => void handleCreateBlankPage()}
              />
              {NOTE_TEMPLATE_STARTERS.map((starter) => (
                <ActionButton
                  key={starter.label}
                  label={starter.label}
                  busy={busyAction === starter.label}
                  onClick={() => void handleCreateTemplatePage(starter)}
                />
              ))}
            </div>
          </div>
        </section>

        <NotesWorkbenchPanel
          report={workbench}
          exporting={exportingWorkbench}
          onExport={handleExportWorkbench}
          onOpenRoute={(route) => router.push(route)}
          onReviewStepOpen={handleReviewStepNavigate}
        />
      </div>
    </div>
  );
}

function NotesWorkbenchPanel({
  report,
  exporting,
  onExport,
  onOpenRoute,
  onReviewStepOpen,
}: {
  report: NotesModuleWorkbenchReport;
  exporting: boolean;
  onExport: () => void;
  onOpenRoute: (route: string) => void;
  onReviewStepOpen: (
    step: NotesModuleWorkbenchReport["review_sequence"][number]
  ) => void;
}) {
  const topActions = report.actions.slice(0, 8);
  const focusPages = report.pages.slice(0, 8);

  return (
    <section
      id="notes-workbench"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            笔记工作台
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            把所有本地页面按 inbox、投研结构、研究关联、复盘痕迹、知识库组织和
            导出安全拆成行动队列。导出不包含页面正文、评论正文或文件 bytes。
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {exporting ? "导出中..." : "导出笔记工作台"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metric label="高优先" value={report.summary.high_priority_actions} />
        <Metric label="空白页" value={report.summary.empty_pages} />
        <Metric label="偏薄" value={report.summary.thin_pages} />
        <Metric label="文件块" value={report.summary.pages_with_files} />
        <Metric
          label="Inline DB"
          value={report.summary.pages_with_inline_databases}
        />
        <Metric label="Backlinks" value={report.summary.pages_with_backlinks} />
        <Metric
          label="未解评论"
          value={report.summary.pages_with_unresolved_comments}
        />
        <Metric label="总字数" value={report.summary.total_words} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div id="notes-workbench-routes" className="scroll-mt-6 space-y-2">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            工作台路线
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {report.lanes.map((lane) => (
              <NotesLaneCard
                key={lane.id}
                lane={lane}
                onOpen={() => onOpenRoute(lane.route)}
              />
            ))}
          </div>
        </div>
        <div id="notes-priority-actions" className="scroll-mt-6 space-y-2">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            优先行动
          </div>
          {topActions.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {topActions.map((action) => (
                <NotesActionCard
                  key={action.id}
                  action={action}
                  onOpen={() => onOpenRoute(action.action_route)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
              当前没有紧急笔记行动。可以继续整理收藏、根页面和版本复盘。
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div id="notes-focus-pages" className="scroll-mt-6 space-y-2">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            需要关注的页面
          </div>
          {focusPages.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {focusPages.map((page) => (
                <NotesPageCard
                  key={page.page_id}
                  page={page}
                  onOpen={() => onOpenRoute(page.open_route)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
              还没有本地页面。创建第一篇笔记后，这里会显示结构和关联建议。
            </p>
          )}
        </div>
        <div id="notes-review-sequence" className="scroll-mt-6 space-y-2">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            建议顺序
          </div>
          {report.review_sequence.map((step) => (
            <NotesReviewStepCard
              key={step.id}
              step={step}
              onOpen={() => onReviewStepOpen(step)}
            />
          ))}
          <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
            禁止动作：不从工作台导出页面正文、不导出评论正文、不读取数据库 row values、
            不读取文件 bytes、不自动删除或覆盖页面、不自动同步、不调用 AI。
          </p>
        </div>
      </div>
    </section>
  );
}

function NotesLaneCard({
  lane,
  onOpen,
}: {
  lane: NotesModuleWorkbenchReport["lanes"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {lane.title}
          </h3>
          <p className="mt-1 text-zinc-400">
            {lane.action_count} actions · {lane.high_priority_count} high
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          打开
        </button>
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {lane.description}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {lane.privacy_boundary}
      </p>
    </article>
  );
}

function NotesActionCard({
  action,
  onOpen,
}: {
  action: NotesModuleWorkbenchReport["actions"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {action.title}
          </h3>
          <p className="mt-1 text-zinc-400">{action.evidence}</p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {action.route_label}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <NotesPriorityPill priority={action.priority} />
        <NotesStatusPill status={action.status} />
        {action.requires_manual_confirmation && <Chip label="需手动点击" />}
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {action.next_action}
      </p>
      <p className="mt-2 leading-5 text-zinc-400">{action.privacy_boundary}</p>
    </article>
  );
}

function NotesPageCard({
  page,
  onOpen,
}: {
  page: NotesModuleWorkbenchReport["pages"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {page.title}
          </h3>
          <p className="mt-1 text-zinc-400">
            {getRoleLabel(page.role)} · score {page.readiness_score}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          打开
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <Chip label={page.structure_status} />
        <Chip label={`${page.word_count} words`} />
        <Chip label={`${page.heading_count} H`} />
        <Chip label={`${page.outgoing_links + page.backlinks} links`} />
        <Chip label={`${page.versions} versions`} />
        {page.favorite && <Chip label="收藏" />}
        {page.locked && <Chip label="锁定" />}
        {page.unresolved_comments > 0 && (
          <Chip label={`${page.unresolved_comments} 未解评论`} />
        )}
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {page.next_action}
      </p>
    </article>
  );
}

function NotesReviewStepCard({
  step,
  onOpen,
}: {
  step: NotesModuleWorkbenchReport["review_sequence"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {step.order}. {step.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {step.reason}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          打开步骤
        </button>
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        完成信号：{step.completion_signal}
      </p>
    </article>
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

function ActionButton({
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

function NotesPriorityPill({ priority }: { priority: NotesModulePriority }) {
  const labels: Record<NotesModulePriority, string> = {
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
    <span className={`rounded px-2 py-0.5 text-[10px] ${className}`}>
      {labels[priority]}
    </span>
  );
}

function NotesStatusPill({ status }: { status: NotesModuleActionStatus }) {
  const labels: Record<NotesModuleActionStatus, string> = {
    "needs-page": "需建页面",
    "needs-structure": "需结构",
    "needs-linking": "需关联",
    "needs-review": "需复盘",
    "ready-to-open": "可打开",
    "review-only": "复核",
  };
  const className =
    status === "needs-page" || status === "needs-structure"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : status === "needs-linking" || status === "needs-review"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      {label}
    </span>
  );
}

function getRoleLabel(role: NotesModuleWorkbenchReport["pages"][number]["role"]) {
  const labels: Record<typeof role, string> = {
    "research-note": "研究笔记",
    "report-note": "报告笔记",
    "meeting-note": "会议笔记",
    "company-note": "公司笔记",
    "general-note": "通用笔记",
  };
  return labels[role];
}

function getEmptyPageCounts(pageId: string): PageModuleCounts {
  return {
    pageId,
    versions: 0,
    pageComments: 0,
    unresolvedPageComments: 0,
    blockComments: 0,
    unresolvedBlockComments: 0,
    outgoingLinks: 0,
    backlinks: 0,
  };
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
