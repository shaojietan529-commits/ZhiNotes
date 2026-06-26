"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import { usePageFavorites } from "@/hooks/usePageFavorites";
import {
  PAGE_VIEW_PREFERENCES_CHANGED_EVENT,
  migrateLegacyPageViewPreferences,
  readLegacyPageViewPreferences,
  writePageViewPreferencesFastCache,
} from "@/hooks/usePageViewPreferences";
import { usePages } from "@/hooks/usePages";
import {
  getPageModuleCounts,
  type PageModuleCounts,
} from "@/lib/db/local/queries";
import { createPageWithCloud } from "@/lib/pages/cloudPageMutations";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import { executeModuleStarter } from "@/lib/modules/actions";
import {
  buildNotesModuleWorkbenchReport,
  type NotesModuleActionStatus,
  type NotesModuleDecisionStatus,
  type NotesModulePriority,
  type NotesModuleWorkbenchReport,
} from "@/lib/pages/notesModule";
import {
  buildSyncedBlockRegistryReport,
  type SyncedBlockRegistryReport,
  type SyncedBlockRegistryStatus,
} from "@/lib/pages/syncedBlockRegistry";
import { getResearchTemplateStarters } from "@/lib/modules/researchTemplateStarters";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const NOTE_TEMPLATE_STARTERS = getResearchTemplateStarters("notes");
const NOTES_FORMAT_ENTRIES: NotesFormatEntry[] = [
  {
    id: "markdown-notes",
    title: "Markdown 笔记",
    description: "把 .md/.mdx/.rmd/.qmd 作为可编辑页面导入，保留标题和 wiki link。",
    route: "/modules/reports",
    routeLabel: "打开报告库",
    boundary: "用户选择文件前不读取文件；导入仍在浏览器本地完成。",
  },
  {
    id: "html-reports",
    title: "HTML 可视化报告",
    description: "把 AI 生成的 HTML 报告作为页面内原生预览和报告页承载。",
    route: "/modules/reports",
    routeLabel: "打开报告库",
    boundary: "HTML 外部资源默认阻断；信任外部资源需要单独确认。",
  },
  {
    id: "documents",
    title: "PDF / Word / PPT",
    description: "先进入文件库做本地预览路线、转换复核和页面容器归档。",
    route: "/modules/files",
    routeLabel: "打开文件库",
    boundary: "不会自动转换、上传、解析正文或调用 AI。",
  },
  {
    id: "spreadsheets",
    title: "Excel / CSV",
    description: "需要变成结构化数据时，进入数据库模块做确认后的导入。",
    route: "/modules/databases",
    routeLabel: "打开数据库",
    boundary: "表格导入前保留确认步骤，不自动写 row values。",
  },
];

const NOTES_NOTION_PARITY_ITEMS: NotesNotionParityItem[] = [
  {
    id: "page-hierarchy",
    area: "页面层级",
    status: "covered",
    notionCapability: "顶部层级路径、深层路径折叠、父级快速跳转。",
    zhinoteCoverage: "已改为紧凑层级路径，超过 3 层显示最高级 / ... / 上一层 / 当前页。",
    nextStep: "... 菜单可展开中间页面；下一步继续补移动页面和重排层级的批量入口。",
    route: "/modules/notes",
    routeLabel: "查看笔记",
  },
  {
    id: "page-native-formats",
    area: "文件进页面",
    status: "partial",
    notionCapability: "Markdown、HTML、PDF、Word、CSV/Excel 可导入或转成页面/database。",
    zhinoteCoverage: "HTML/Markdown 已有本地报告/笔记入口，Files 已有 ZIP metadata-only 预检合同。",
    nextStep: "继续做只读 ZIP central directory 预览，再做 Markdown/HTML 批量 page 创建确认。",
    route: "/modules/reports",
    routeLabel: "打开报告库",
  },
  {
    id: "database-preview",
    area: "Database 体验",
    status: "partial",
    notionCapability: "视图筛选、排序、分组、预览层、item 作为页面打开。",
    zhinoteCoverage: "已有多视图、字段显示、行搜索、side/center peek、view 设置和冻结列。",
    nextStep: "继续做 sub-group 和 nested filters；这需要数据库 view config 结构升级。",
    route: "/modules/databases",
    routeLabel: "打开数据库",
  },
  {
    id: "synced-blocks",
    area: "同步块",
    status: "partial",
    notionCapability: "一段内容复用到多个页面，任一实例更新后同步。",
    zhinoteCoverage: "已有本地 synced block 节点和 registry，可列出 sync id、实例和跨页面复用状态。",
    nextStep: "定义原始块、实例列表、删除/解除同步语义；云权限上线前不跨用户同步正文。",
    route: "/modules/notes",
    routeLabel: "查看 registry",
  },
  {
    id: "cloud-ai-boundary",
    area: "云端与 AI",
    status: "blocked",
    notionCapability: "多人协作、权限、AI 辅助、云端同步。",
    zhinoteCoverage: "本地高风险 API 默认关闭，已有 sync/permission/audit 的 disabled guard 和检查面板。",
    nextStep: "等 GitHub 凭据、Supabase/Vercel preview、权限和烟测通过后再启用云写入。",
    route: "/modules/sync",
    routeLabel: "查看同步",
  },
];

interface NotesFormatEntry {
  id: string;
  title: string;
  description: string;
  route: string;
  routeLabel: string;
  boundary: string;
}

type NotesNotionParityStatus = "covered" | "partial" | "blocked";

interface NotesNotionParityItem {
  id: string;
  area: string;
  status: NotesNotionParityStatus;
  notionCapability: string;
  zhinoteCoverage: string;
  nextStep: string;
  route: string;
  routeLabel: string;
}

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
  const openPage = useLocalFirstPageNavigation();
  const { pages, refresh } = usePages({
    includeContent: true,
    deferContent: true,
  });
  const { favoriteIds } = usePageFavorites();
  const [counts, setCounts] = useState<Record<string, PageModuleCounts>>({});
  const [lockedPageIds, setLockedPageIds] = useState<Set<string>>(
    () => new Set()
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportingWorkbench, setExportingWorkbench] = useState(false);
  const [exportingSyncedRegistry, setExportingSyncedRegistry] = useState(false);

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
    let cancelled = false;
    const pageIds = pages.map((page) => page.id);

    const refreshLockedIds = async (event?: Event) => {
      const preferencesFromEvent = (
        event as
          | CustomEvent<{
              preferences?: { locked_page_ids: string[] };
            }>
          | undefined
      )?.detail?.preferences;
      if (preferencesFromEvent) {
        setLockedPageIds(new Set(preferencesFromEvent.locked_page_ids));
        return;
      }

      try {
        const preferences = await migrateLegacyPageViewPreferences(
          pageIds,
          "legacy-notes-locked-pages-localStorage"
        );
        if (cancelled) return;
        writePageViewPreferencesFastCache(preferences, pageIds, {
          notify: false,
        });
        setLockedPageIds(new Set(preferences.locked_page_ids));
      } catch (error) {
        console.warn("[Zhinote] Failed to hydrate notes lock badges:", error);
        if (!cancelled) {
          setLockedPageIds(
            new Set(readLegacyPageViewPreferences(pageIds).locked_page_ids)
          );
        }
      }
    };

    queueMicrotask(() => void refreshLockedIds());
    window.addEventListener(
      PAGE_VIEW_PREFERENCES_CHANGED_EVENT,
      refreshLockedIds
    );
    return () => {
      cancelled = true;
      window.removeEventListener(
        PAGE_VIEW_PREFERENCES_CHANGED_EVENT,
        refreshLockedIds
      );
    };
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
  const syncedBlockRegistry = useMemo(
    () => buildSyncedBlockRegistryReport(pages),
    [pages]
  );

  const handleCreateBlankPage = async () => {
    setBusyAction("blank-page");
    try {
      const page = await createPageWithCloud({
        title: "未命名研究笔记",
        icon: "NOTE",
      });
      await refresh();
      await loadCounts();
      openPage(page, { source: "module-create" });
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
      if (result.page) {
        openPage(result.page, { source: "module-create" });
      } else {
        router.push(result.route);
      }
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

  const handleExportSyncedRegistry = () => {
    setExportingSyncedRegistry(true);
    try {
      downloadJsonFile(
        `zhinote-synced-block-registry-${fileSafeTimestamp()}.json`,
        {
          ...syncedBlockRegistry,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export synced block registry:", err);
      window.alert("同步块 registry 导出失败，请查看控制台。");
    } finally {
      setExportingSyncedRegistry(false);
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

  const handleDecisionOpen = (
    decision: NotesModuleWorkbenchReport["decision_summary"]["decisions"][number]
  ) => {
    if (decision.route === "/modules/notes") {
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
                笔记模块
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                笔记与页面中心
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                把本地页面变成投研平台的知识库底座：集中查看结构、关联、版本、
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

        {workbench.summary.pages === 0 && (
          <NotesEmptyStartPanel
            busyAction={busyAction}
            onCreateBlankPage={() => void handleCreateBlankPage()}
            onCreateTemplatePage={(starter) =>
              void handleCreateTemplatePage(starter)
            }
          />
        )}

        <NotesDecisionSummaryPanel
          summary={workbench.decision_summary}
          exportingWorkbench={exportingWorkbench}
          onExportWorkbench={handleExportWorkbench}
          onOpenDecision={handleDecisionOpen}
        />

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
                可以创建空白研究笔记，或直接用投研模板创建本地页面。模板只写入当前
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

        <NotesFormatEntryPanel onOpenRoute={(route) => router.push(route)} />

        <NotesNotionParityPanel onOpenRoute={(route) => router.push(route)} />

        <SyncedBlockRegistryPanel
          report={syncedBlockRegistry}
          exporting={exportingSyncedRegistry}
          onExport={handleExportSyncedRegistry}
          onOpenPage={(pageId) => openPage(pageId, { source: "module-open" })}
        />

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

function NotesNotionParityPanel({
  onOpenRoute,
}: {
  onOpenRoute: (route: string) => void;
}) {
  const summary = NOTES_NOTION_PARITY_ITEMS.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { covered: 0, partial: 0, blocked: 0 }
  );

  return (
    <section
      id="notes-notion-parity-roadmap"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            Notion 对齐
          </p>
          <h2 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            笔记模块路线图
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            按 Notion 的通用能力拆成可检查的本地路线图。这里只读取代码里的能力清单，
            不读取页面正文、数据库行值、评论正文、文件字节，不上传、不调用 AI。
          </p>
        </div>
        <div className="grid w-full gap-2 text-xs sm:grid-cols-3 lg:w-auto">
          <Metric label="已覆盖" value={summary.covered} />
          <Metric label="部分覆盖" value={summary.partial} />
          <Metric label="需确认" value={summary.blocked} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        {NOTES_NOTION_PARITY_ITEMS.map((item) => (
          <NotesNotionParityCard
            key={item.id}
            item={item}
            onOpen={() => onOpenRoute(item.route)}
          />
        ))}
      </div>
    </section>
  );
}

function NotesNotionParityCard({
  item,
  onOpen,
}: {
  item: NotesNotionParityItem;
  onOpen: () => void;
}) {
  return (
    <article className="flex min-h-[260px] flex-col justify-between rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            {item.area}
          </h3>
          <NotesNotionParityStatusPill status={item.status} />
        </div>
        <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
          Notion：{item.notionCapability}
        </p>
        <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
          ZhiNotes：{item.zhinoteCoverage}
        </p>
        <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          下一步：{item.nextStep}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 w-fit rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {item.routeLabel}
      </button>
    </article>
  );
}

function NotesNotionParityStatusPill({
  status,
}: {
  status: NotesNotionParityStatus;
}) {
  const labels: Record<NotesNotionParityStatus, string> = {
    covered: "已覆盖",
    partial: "部分覆盖",
    blocked: "需确认",
  };
  const className: Record<NotesNotionParityStatus, string> = {
    covered: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200",
    partial: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200",
    blocked: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${className[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function NotesFormatEntryPanel({
  onOpenRoute,
}: {
  onOpenRoute: (route: string) => void;
}) {
  return (
    <section
      id="notes-format-entry"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          格式入口
        </p>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          不同文件从哪里进入
        </h2>
        <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          Notes 仍是最终知识库容器；具体文件先走最合适的本地模块。这里仅做路由，
          不读取文件、不创建页面、不写数据库、不上传、不调用 AI。
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {NOTES_FORMAT_ENTRIES.map((entry) => (
          <NotesFormatEntryCard
            key={entry.id}
            entry={entry}
            onOpen={() => onOpenRoute(entry.route)}
          />
        ))}
      </div>
    </section>
  );
}

function NotesFormatEntryCard({
  entry,
  onOpen,
}: {
  entry: NotesFormatEntry;
  onOpen: () => void;
}) {
  return (
    <article className="flex min-h-[190px] flex-col justify-between rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {entry.title}
        </h3>
        <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
          {entry.description}
        </p>
        <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          {entry.boundary}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 w-fit rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {entry.routeLabel}
      </button>
    </article>
  );
}

function SyncedBlockRegistryPanel({
  report,
  exporting,
  onExport,
  onOpenPage,
}: {
  report: SyncedBlockRegistryReport;
  exporting: boolean;
  onExport: () => void;
  onOpenPage: (pageId: string) => void;
}) {
  const visibleGroups = report.groups.slice(0, 6);

  return (
    <section
      id="notes-synced-block-registry"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            同步块 registry
          </p>
          <h2 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            本地同步块实例清单
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            这里只扫描本地页面 HTML 里的 sync id 和页面标题，用来知道哪些同步块已经复用。
            不读取同步块正文，不跨页面改写内容，不上传、不调用 AI。
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="w-fit whitespace-nowrap rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {exporting ? "导出中..." : "导出 registry"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="扫描页面" value={report.summary.pages_scanned} />
        <Metric
          label="有同步块"
          value={report.summary.pages_with_synced_blocks}
        />
        <Metric label="同步组" value={report.summary.synced_groups} />
        <Metric label="实例" value={report.summary.synced_instances} />
        <Metric label="跨页面" value={report.summary.cross_page_groups} />
        <Metric
          label="单实例"
          value={report.summary.single_instance_groups}
        />
      </div>

      <div className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        {report.privacy_note}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              同步组
            </h3>
            <span className="text-[11px] text-zinc-400">
              显示 {visibleGroups.length}/{report.groups.length}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {visibleGroups.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
                当前还没有同步块。可以在编辑器里插入“同步块”后回到这里复核。
              </p>
            ) : (
              visibleGroups.map((group) => (
                <SyncedBlockGroupCard
                  key={group.sync_id}
                  group={group}
                  onOpenPage={onOpenPage}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            下一步
          </h3>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {report.next_steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SyncedBlockGroupCard({
  group,
  onOpenPage,
}: {
  group: SyncedBlockRegistryReport["groups"][number];
  onOpenPage: (pageId: string) => void;
}) {
  const pageRefs = uniqueByPageId(group.refs).slice(0, 4);

  return (
    <article className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2">
        <SyncedBlockStatusPill status={group.status} />
        <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          {group.sync_id}
        </span>
        <span className="text-zinc-400">
          {group.instances} 个实例 · {group.pages} 个页面
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {group.next_action}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {pageRefs.map((ref) => (
          <button
            key={ref.page_id}
            type="button"
            onClick={() => onOpenPage(ref.page_id)}
            className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-white hover:text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            title="打开本地页面"
          >
            {ref.page_title}
          </button>
        ))}
      </div>
    </article>
  );
}

function SyncedBlockStatusPill({
  status,
}: {
  status: SyncedBlockRegistryStatus;
}) {
  const labels: Record<SyncedBlockRegistryStatus, string> = {
    "cross-page": "跨页面",
    "same-page-duplicates": "同页复用",
    "single-instance": "单实例",
  };
  const className: Record<SyncedBlockRegistryStatus, string> = {
    "cross-page":
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    "same-page-duplicates":
      "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200",
    "single-instance":
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-medium ${className[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function uniqueByPageId(
  refs: SyncedBlockRegistryReport["groups"][number]["refs"]
) {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.page_id)) return false;
    seen.add(ref.page_id);
    return true;
  });
}

function NotesEmptyStartPanel({
  busyAction,
  onCreateBlankPage,
  onCreateTemplatePage,
}: {
  busyAction: string | null;
  onCreateBlankPage: () => void;
  onCreateTemplatePage: (starter: (typeof NOTE_TEMPLATE_STARTERS)[number]) => void;
}) {
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            第一篇笔记
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            还没有本地页面
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-900/80 dark:text-emerald-100/80">
            可以先创建一篇空白研究笔记，或直接从投研模板开始。这里只显示入口，
            不会自动写入页面、上传、同步或调用 AI。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            label="新建空白笔记"
            busy={busyAction === "blank-page"}
            emphasis
            onClick={onCreateBlankPage}
          />
          {NOTE_TEMPLATE_STARTERS.slice(0, 4).map((starter) => (
            <ActionButton
              key={starter.label}
              label={starter.label}
              busy={busyAction === starter.label}
              onClick={() => onCreateTemplatePage(starter)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function NotesDecisionSummaryPanel({
  summary,
  exportingWorkbench,
  onExportWorkbench,
  onOpenDecision,
}: {
  summary: NotesModuleWorkbenchReport["decision_summary"];
  exportingWorkbench: boolean;
  onExportWorkbench: () => void;
  onOpenDecision: (
    decision: NotesModuleWorkbenchReport["decision_summary"]["decisions"][number]
  ) => void;
}) {
  return (
    <section
      id="notes-decision-summary"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            笔记决策总览
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            笔记决策摘要
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {summary.current_conclusion}
          </p>
        </div>
        <button
          type="button"
          onClick={onExportWorkbench}
          disabled={exportingWorkbench}
          className="w-fit whitespace-nowrap rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          {exportingWorkbench ? "导出中..." : "导出工作台"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {summary.decisions.map((decision) => (
          <NotesDecisionCard
            key={decision.id}
            decision={decision}
            onOpen={() => onOpenDecision(decision)}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <NotesDecisionList title="当前可做" items={summary.safe_local_work} />
        <NotesDecisionList title="保持关闭" items={summary.blocked_work} />
        <NotesDecisionList
          title="待你确认"
          items={summary.required_owner_decisions}
        />
      </div>

      <div className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        关键阻塞：{" "}
        {summary.top_blockers.length > 0
          ? summary.top_blockers.join("；")
          : "暂无"}
        。笔记决策摘要只读取本地摘要元数据，不包含页面正文、评论正文、
        关联页面正文、数据库行值、文件字节、提示词、token 或凭证。
      </div>
    </section>
  );
}

function NotesDecisionCard({
  decision,
  onOpen,
}: {
  decision: NotesModuleWorkbenchReport["decision_summary"]["decisions"][number];
  onOpen: () => void;
}) {
  return (
    <article className="flex min-h-[220px] flex-col justify-between rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              {decision.title}
            </h3>
            <p className="mt-1 text-base font-semibold text-zinc-950 dark:text-zinc-50">
              {decision.answer}
            </p>
          </div>
          <NotesDecisionStatusPill status={decision.status} />
        </div>
        <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
          {decision.evidence}
        </p>
      </div>
      <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="leading-5 text-zinc-400 dark:text-zinc-500">
          {decision.next_action}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          打开对应区域
        </button>
      </div>
    </article>
  );
}

function NotesDecisionList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1 leading-5 text-zinc-500 dark:text-zinc-400">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 leading-5 text-zinc-400">暂无。</p>
      )}
    </article>
  );
}

function NotesDecisionStatusPill({
  status,
}: {
  status: NotesModuleDecisionStatus;
}) {
  const labels: Record<NotesModuleDecisionStatus, string> = {
    "available-local": "本地可做",
    "requires-owner-confirmation": "需确认",
    blocked: "阻塞",
  };
  const className: Record<NotesModuleDecisionStatus, string> = {
    "available-local":
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200",
    "requires-owner-confirmation":
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    blocked: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${className[status]}`}
    >
      {labels[status]}
    </span>
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
            把所有本地页面按入口收集、投研结构、研究关联、复盘痕迹、知识库组织和
            导出安全拆成行动队列。导出不包含页面正文、评论正文或文件字节。
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
          label="内联数据库"
          value={report.summary.pages_with_inline_databases}
        />
        <Metric label="反向链接" value={report.summary.pages_with_backlinks} />
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
            禁止动作：不从工作台导出页面正文、不导出评论正文、不读取数据库行值、
            不读取文件字节、不自动删除或覆盖页面、不自动同步、不调用 AI。
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
            {lane.action_count} 个行动 · {lane.high_priority_count} 个高优先
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
            {getRoleLabel(page.role)} · 就绪分 {page.readiness_score}
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
        <Chip label={getStructureStatusLabel(page.structure_status)} />
        <Chip label={`${page.word_count} 字`} />
        <Chip label={`${page.heading_count} 个标题`} />
        <Chip label={`${page.outgoing_links + page.backlinks} 个链接`} />
        <Chip label={`${page.versions} 个版本`} />
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

function getStructureStatusLabel(
  status: NotesModuleWorkbenchReport["pages"][number]["structure_status"]
) {
  const labels: Record<typeof status, string> = {
    ready: "已就绪",
    "needs-structure": "需补结构",
    thin: "偏薄",
    empty: "空白",
  };
  return labels[status];
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
