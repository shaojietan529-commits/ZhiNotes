"use client";

import { Fragment, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useLocalFirstDatabaseNavigation } from "@/hooks/useLocalFirstDatabaseNavigation";
import { useLocalFirstModuleNavigation } from "@/hooks/useLocalFirstModuleNavigation";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import {
  getWorkspaceSetting,
  searchPages,
  upsertWorkspaceSetting,
} from "@/lib/db/local/queries";
import { useDatabases } from "@/hooks/useDatabases";
import { usePages } from "@/hooks/usePages";
import { usePageFavorites } from "@/hooks/usePageFavorites";
import {
  dispatchPageLocalCommand,
  type PageLocalCommand,
} from "@/lib/pageLocalCommands";
import {
  dispatchEditorLocalCommand,
  type EditorLocalCommand,
} from "@/lib/editorLocalCommands";
import { PLATFORM_MODULES, type ModuleStarter } from "@/lib/modules/registry";
import { RESEARCH_TEMPLATE_QUICK_ACTIONS } from "@/lib/modules/researchTemplateStarters";
import {
  QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY,
  normalizeQuickSearchSavedSearches,
  parseQuickSearchSavedSearchesWorkspaceSetting,
} from "@/lib/sync/quickSearchWorkspaceSettings";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

const SAVED_SEARCHES_KEY = "zhinote:saved-searches";
const MAX_SAVED_SEARCHES = 10;
const QUICK_SEARCH_RESULT_LIMIT = 20;
const QUICK_SEARCH_ACTIVITY_LIMIT = 8;
const QUICK_SEARCH_FULL_TEXT_DELAY_MS = 180;
const QUICK_SEARCH_DATABASE_REFRESH_TTL_MS = 30_000;
const loadModuleStarterActions = () => import("@/lib/modules/actions");

type CommandCategory = "Page" | "Editor" | "Database" | "Workspace";

interface CommandPaletteAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: CommandCategory;
  aliases: string[];
  route?: string;
  run: () => void;
}

type SearchEntry =
  | { id: string; type: "command"; command: CommandPaletteAction }
  | { id: string; type: "database"; database: Database }
  | { id: string; type: "page"; page: Page };

type ResultFilter = "all" | "pages" | "databases" | "actions";
type PageActivityFilter = "suggested" | "updated" | "created" | "favorites";

export interface QuickSearchProps {
  initialOpen?: boolean;
}

const RESULT_FILTERS: Array<{ label: string; value: ResultFilter }> = [
  { label: "全部", value: "all" },
  { label: "页面", value: "pages" },
  { label: "数据库", value: "databases" },
  { label: "动作", value: "actions" },
];

const PAGE_ACTIVITY_FILTERS: Array<{
  label: string;
  value: PageActivityFilter;
}> = [
  { label: "推荐", value: "suggested" },
  { label: "最近更新", value: "updated" },
  { label: "最近创建", value: "created" },
  { label: "收藏", value: "favorites" },
];

const COMMAND_CATEGORY_LABELS: Record<CommandCategory, string> = {
  Page: "页面",
  Editor: "编辑器",
  Database: "数据库",
  Workspace: "工作区",
};

export default function QuickSearch({ initialOpen = false }: QuickSearchProps) {
  const [open, setOpen] = useState(initialOpen);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Page[]>([]);
  const { databases, refresh: refreshDatabases } = useDatabases();
  const [savedSearches, setSavedSearches] = useState<string[]>(
    readSavedSearchesLocalCache
  );
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [pageActivityFilter, setPageActivityFilter] =
    useState<PageActivityFilter>("suggested");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRequestRef = useRef(0);
  const deferredFullTextSearchTimerRef = useRef<number | null>(null);
  const databaseRefreshInFlightRef = useRef<Promise<Database[]> | null>(null);
  const lastDatabaseRefreshAtRef = useRef(0);
  const openDatabase = useLocalFirstDatabaseNavigation();
  const { openModuleRoute, warmModuleRoute } = useLocalFirstModuleNavigation();
  const openPage = useLocalFirstPageNavigation();
  const pages = useWorkspaceStore((s) => s.pages);
  const getPageById = useWorkspaceStore((s) => s.getPageById);
  const { refresh, upsertPages } = usePages({ autoLoad: false });
  const { favoriteIds } = usePageFavorites();
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const suggestedPages = useMemo(() => {
    if (!open || hasQuery) return [];
    return getPagesForActivity(pages, favoriteIds, pageActivityFilter, getPageById);
  }, [favoriteIds, getPageById, hasQuery, open, pageActivityFilter, pages]);
  const searchIsSaved = savedSearches.some(
    (savedSearch) => savedSearch.toLowerCase() === trimmedQuery.toLowerCase()
  );

  const clearDeferredFullTextSearch = useCallback(() => {
    if (deferredFullTextSearchTimerRef.current === null) return;
    window.clearTimeout(deferredFullTextSearchTimerRef.current);
    deferredFullTextSearchTimerRef.current = null;
  }, []);

  const refreshDatabasesForPalette = useCallback(() => {
    const now = Date.now();
    if (databaseRefreshInFlightRef.current) return;
    if (
      now - lastDatabaseRefreshAtRef.current <
      QUICK_SEARCH_DATABASE_REFRESH_TTL_MS
    ) {
      return;
    }

    lastDatabaseRefreshAtRef.current = now;
    const promise = refreshDatabases({ broadcast: false })
      .catch((error) => {
        console.error("[Zhinote] Failed to refresh quick search databases:", error);
        return [] as Database[];
      })
      .finally(() => {
        if (databaseRefreshInFlightRef.current === promise) {
          databaseRefreshInFlightRef.current = null;
        }
      });
    databaseRefreshInFlightRef.current = promise;
  }, [refreshDatabases]);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        if (isEditorTarget(e.target)) return;
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
        setQuery("");
        setResults([]);
        setResultFilter("all");
        setPageActivityFilter("suggested");
        setSelectedIndex(0);
      }, 50);
      refreshDatabasesForPalette();
    }
  }, [open, refreshDatabasesForPalette]);

  useEffect(() => {
    if (!open || pages.length > 0) return;
    void refresh({ broadcast: false });
  }, [open, pages.length, refresh]);

  useEffect(() => {
    if (open) return;
    searchRequestRef.current += 1;
    clearDeferredFullTextSearch();
  }, [open, clearDeferredFullTextSearch]);

  useEffect(() => {
    return () => {
      clearDeferredFullTextSearch();
    };
  }, [clearDeferredFullTextSearch]);

  useEffect(() => {
    let cancelled = false;
    const localCache = readSavedSearchesLocalCache();

    async function loadSavedSearchesWorkspaceSetting() {
      try {
        const setting = await getWorkspaceSetting(QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY);
        if (cancelled) return;

        if (setting) {
          const workspaceSearches =
            parseQuickSearchSavedSearchesWorkspaceSetting(setting)
              .saved_searches;
          setSavedSearches(workspaceSearches);
          writeSavedSearchesLocalCache(workspaceSearches);
          return;
        }

        // localStorage is a fast boot cache and legacy migration source only.
        // The durable local record is workspace_settings, which queues sync_log.
        if (localCache.length > 0) {
          void persistSavedSearchesWorkspaceSetting(
            localCache,
            "legacy-quick-search-saved-searches-localStorage"
          );
        }
      } catch (error) {
        console.error("[Zhinote] Failed to load saved searches:", error);
      }
    }

    void loadSavedSearchesWorkspaceSetting();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      const requestId = searchRequestRef.current + 1;
      const trimmedValue = value.trim();
      searchRequestRef.current = requestId;
      clearDeferredFullTextSearch();
      setQuery(value);
      setSelectedIndex(0);
      if (trimmedValue.length === 0) {
        setResults([]);
        return;
      }

      const metadataResults = searchPageMetadata(pages, trimmedValue);
      setResults(metadataResults);

      deferredFullTextSearchTimerRef.current = window.setTimeout(() => {
        deferredFullTextSearchTimerRef.current = null;
        void searchPages(trimmedValue, QUICK_SEARCH_RESULT_LIMIT)
          .then((fullTextResults) => {
            if (requestId !== searchRequestRef.current) return;
            setResults((currentResults) =>
              mergeSearchResults(currentResults, fullTextResults)
            );
          })
          .catch((error) => {
            console.error("[Zhinote] Failed to run full-text search:", error);
          });
      }, QUICK_SEARCH_FULL_TEXT_DELAY_MS);
    },
    [clearDeferredFullTextSearch, pages]
  );

  const handleSaveSearch = () => {
    const nextSavedSearches = saveSearchQuery(trimmedQuery, savedSearches);
    setSavedSearches(nextSavedSearches);
    void persistSavedSearchesWorkspaceSetting(nextSavedSearches).catch(
      (error) => {
        console.error("[Zhinote] Failed to save quick search query:", error);
      }
    );
  };

  const handleRemoveSavedSearch = (savedSearch: string) => {
    const nextSavedSearches = savedSearches.filter(
      (item) => item.toLowerCase() !== savedSearch.toLowerCase()
    );
    setSavedSearches(nextSavedSearches);
    void persistSavedSearchesWorkspaceSetting(nextSavedSearches).catch(
      (error) => {
        console.error("[Zhinote] Failed to remove saved search query:", error);
      }
    );
  };

  const resetPalette = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleSelect = (pageId: string, page?: Page) => {
    openPage(
      page ??
        results.find((candidate) => candidate.id === pageId) ??
        getPageById(pageId) ??
        pageId,
      { source: "quick-search-open" }
    );
    resetPalette();
  };

  const handleCreatePage = async () => {
    const { createPageWithCloud } = await import("@/lib/pages/cloudPageMutations");
    const page = await createPageWithCloud({
      title: trimmedQuery || "未命名",
    });
    upsertPages([page]);
    openPage(page, { source: "quick-search-create" });
    resetPalette();
  };

  const handleCreateBlankPage = async () => {
    const { createPageWithCloud } = await import("@/lib/pages/cloudPageMutations");
    const page = await createPageWithCloud();
    upsertPages([page]);
    openPage(page, { source: "quick-search-create" });
    resetPalette();
  };

  const handleCreateDatabase = async () => {
    const { createDatabase } = await import("@/lib/database/cloudDatabaseMutations");
    const database = await createDatabase({ title: "未命名数据库" });
    await refreshDatabases();
    setOpen(false);
    setQuery("");
    setResults([]);
    openDatabase(database.id);
  };

  const handleOpenModuleRoute = (route: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    openModuleRoute(route);
  };

  const handleOpenModuleHub = () => {
    handleOpenModuleRoute("/modules");
  };

  const handleOpenNotes = () => {
    handleOpenModuleRoute("/modules/notes");
  };

  const handleOpenDatabases = () => {
    handleOpenModuleRoute("/modules/databases");
  };

  const handleOpenCompanyResearch = () => {
    handleOpenModuleRoute("/modules/company-research");
  };

  const handleOpenProjects = () => {
    handleOpenModuleRoute("/modules/projects");
  };

  const handleOpenPortfolio = () => {
    handleOpenModuleRoute("/modules/portfolio");
  };

  const handleOpenMeetings = () => {
    handleOpenModuleRoute("/modules/meetings");
  };

  const handleOpenReports = () => {
    handleOpenModuleRoute("/modules/reports");
  };

  const handleOpenFiles = () => {
    handleOpenModuleRoute("/modules/files");
  };

  const handleOpenResearchGraph = () => {
    handleOpenModuleRoute("/modules/research-graph");
  };

  const handleOpenAiWorkbench = () => {
    handleOpenModuleRoute("/modules/ai");
  };

  const handleOpenSync = () => {
    handleOpenModuleRoute("/modules/sync");
  };

  const handleModuleStarter = async (starter: ModuleStarter) => {
    try {
      const { executeModuleStarter } = await loadModuleStarterActions();
      const result = await executeModuleStarter(starter);
      if (result.database) {
        await refreshDatabases();
      }
      if (result.page) {
        upsertPages([result.page]);
      }
      setOpen(false);
      setQuery("");
      setResults([]);
      if (result.page) {
        openPage(result.page, { source: "quick-search-create" });
      } else if (result.database) {
        openDatabase(result.database.id);
      } else {
        openModuleRoute(result.route);
      }
    } catch (err) {
      console.error("[Zhinote] Failed to run module starter:", err);
      window.alert("模块动作失败，请查看控制台详情。");
    }
  };

  const handleCreateCompanyTracker = async () => {
    const starter = PLATFORM_MODULES.find(
      (module) => module.id === "company-research"
    )?.starter;
    if (starter) {
      await handleModuleStarter(starter);
    }
  };

  const handleCreateProjectTracker = async () => {
    const starter = PLATFORM_MODULES.find((module) => module.id === "projects")
      ?.starter;
    if (starter) {
      await handleModuleStarter(starter);
    }
  };

  const handleCreatePortfolioTracker = async () => {
    const starter = PLATFORM_MODULES.find((module) => module.id === "portfolio")
      ?.starter;
    if (starter) {
      await handleModuleStarter(starter);
    }
  };

  const handleCreateMeetingTracker = async () => {
    const starter = PLATFORM_MODULES.find((module) => module.id === "meetings")
      ?.starter;
    if (starter) {
      await handleModuleStarter(starter);
    }
  };

  const handleCreateReportTracker = async () => {
    const starter = PLATFORM_MODULES.find((module) => module.id === "reports")
      ?.starter;
    if (starter) {
      await handleModuleStarter(starter);
    }
  };

  const handleExportMarkdown = async () => {
    try {
      const { exportWorkspaceMarkdown } = await import(
        "@/lib/export/workspaceBackup"
      );
      await exportWorkspaceMarkdown();
      setOpen(false);
    } catch (err) {
      console.error("[Zhinote] Failed to export workspace Markdown:", err);
      window.alert("Markdown 导出失败，请查看控制台详情。");
    }
  };

  const handleExportBackup = async () => {
    try {
      const { exportWorkspaceBackup } = await import(
        "@/lib/export/workspaceBackup"
      );
      await exportWorkspaceBackup();
      setOpen(false);
    } catch (err) {
      console.error("[Zhinote] Failed to export workspace backup:", err);
      window.alert("备份失败，请查看控制台详情。");
    }
  };

  const handleExportZip = async () => {
    try {
      const { exportWorkspaceZip } = await import(
        "@/lib/export/workspaceBackup"
      );
      await exportWorkspaceZip();
      setOpen(false);
    } catch (err) {
      console.error("[Zhinote] Failed to export workspace ZIP:", err);
      window.alert("ZIP 导出失败，请查看控制台详情。");
    }
  };

  const handlePageLocalCommand = useCallback(
    (command: PageLocalCommand) => {
      if (!currentPageId) {
        window.alert("请先打开一个页面再使用这个动作。");
        return;
      }
      dispatchPageLocalCommand(command);
      setOpen(false);
      setQuery("");
      setResults([]);
    },
    [currentPageId]
  );

  const handleEditorLocalCommand = useCallback(
    (command: EditorLocalCommand) => {
      if (!currentPageId) {
        window.alert("请先打开一个页面再使用这个动作。");
        return;
      }
      dispatchEditorLocalCommand(command);
      setOpen(false);
      setQuery("");
      setResults([]);
    },
    [currentPageId]
  );

  const templateQuickActions: CommandPaletteAction[] =
    RESEARCH_TEMPLATE_QUICK_ACTIONS.map((action) => ({
      id: action.id,
      title: action.title,
      description: action.description,
      icon: action.starter.icon ?? "PAGE",
      category: action.category,
      aliases: action.aliases,
      run: () => void handleModuleStarter(action.starter),
    }));

  const commandActions: CommandPaletteAction[] = [
    {
      id: "new-page",
      title: "新建页面",
      description: "创建一个空白本地页面",
      icon: "+",
      category: "Page",
      aliases: ["new", "page", "create", "blank", "新建", "页面"],
      run: () => void handleCreateBlankPage(),
    },
    {
      id: "module-hub",
      title: "模块中心",
      description: "打开模块化投研平台总览",
      icon: "MOD",
      category: "Workspace",
      aliases: ["module", "modules", "platform", "research platform", "模块"],
      route: "/modules",
      run: handleOpenModuleHub,
    },
    {
      id: "notes-module",
      title: "笔记与页面中心",
      description: "打开本地笔记工作台和页面结构总览",
      icon: "NOTE",
      category: "Workspace",
      aliases: ["notes", "pages", "notion", "workspace", "笔记", "页面"],
      route: "/modules/notes",
      run: handleOpenNotes,
    },
    {
      id: "company-research-module",
      title: "公司研究",
      description: "打开公司研究模块",
      icon: "CO",
      category: "Workspace",
      aliases: ["company", "companies", "coverage", "research module", "公司"],
      route: "/modules/company-research",
      run: handleOpenCompanyResearch,
    },
    {
      id: "projects-module",
      title: "投研项目",
      description: "打开投研项目模块，创建项目页和项目跟踪表",
      icon: "PRJ",
      category: "Workspace",
      aliases: [
        "project",
        "projects",
        "research project",
        "project brief",
        "项目",
        "投研项目",
        "专题",
      ],
      route: "/modules/projects",
      run: handleOpenProjects,
    },
    ...templateQuickActions,
    {
      id: "create-company-tracker",
      title: "创建公司跟踪表",
      description: "创建本地公司研究数据库",
      icon: "DB",
      category: "Database",
      aliases: ["company", "tracker", "coverage", "database", "watchlist", "公司", "跟踪表"],
      run: () => void handleCreateCompanyTracker(),
    },
    {
      id: "create-project-tracker",
      title: "创建项目跟踪表",
      description: "创建本地投研项目数据库",
      icon: "PRJ",
      category: "Database",
      aliases: [
        "project",
        "tracker",
        "brief",
        "database",
        "项目",
        "投研项目",
        "跟踪表",
      ],
      run: () => void handleCreateProjectTracker(),
    },
    {
      id: "portfolio-module",
      title: "组合与观察名单",
      description: "打开本地组合与观察名单模块",
      icon: "PF",
      category: "Workspace",
      aliases: ["portfolio", "watchlist", "position", "positions", "sizing", "组合", "观察名单"],
      route: "/modules/portfolio",
      run: handleOpenPortfolio,
    },
    {
      id: "create-portfolio-tracker",
      title: "创建组合跟踪表",
      description: "创建本地组合与观察名单数据库",
      icon: "DB",
      category: "Database",
      aliases: [
        "portfolio",
        "tracker",
        "watchlist",
        "positions",
        "sizing",
        "database",
        "组合",
        "跟踪表",
      ],
      run: () => void handleCreatePortfolioTracker(),
    },
    {
      id: "meetings-module",
      title: "会议与电话会",
      description: "打开会议与电话会模块",
      icon: "MTG",
      category: "Workspace",
      aliases: ["meeting", "meetings", "call", "calls", "transcript", "会议", "电话会"],
      route: "/modules/meetings",
      run: handleOpenMeetings,
    },
    {
      id: "create-meeting-tracker",
      title: "创建会议跟踪表",
      description: "创建本地会议与电话会跟踪数据库",
      icon: "DB",
      category: "Database",
      aliases: ["meeting", "tracker", "call", "follow-up", "database", "会议", "跟踪表"],
      run: () => void handleCreateMeetingTracker(),
    },
    {
      id: "reports-module",
      title: "报告库",
      description: "打开报告库模块",
      icon: "RPT",
      category: "Workspace",
      aliases: ["report", "reports", "html report", "pdf", "file", "报告"],
      route: "/modules/reports",
      run: handleOpenReports,
    },
    {
      id: "markdown-note-entry",
      title: "Markdown 笔记入口",
      description: "打开可编辑 Markdown 笔记导入路线",
      icon: "MD",
      category: "Workspace",
      aliases: [
        "markdown",
        "md",
        "markdown note",
        "import markdown",
        "notes format",
        "格式入口",
        "Markdown 笔记",
      ],
      route: "/modules/reports",
      run: handleOpenReports,
    },
    {
      id: "html-report-entry",
      title: "HTML 报告入口",
      description: "打开 HTML 可视化报告预览和报告页路线",
      icon: "HTML",
      category: "Workspace",
      aliases: [
        "html",
        "html report",
        "visual report",
        "ai report",
        "格式入口",
        "HTML 报告",
      ],
      route: "/modules/reports",
      run: handleOpenReports,
    },
    {
      id: "files-module",
      title: "文件库",
      description: "打开本地文件库工作台",
      icon: "FILE",
      category: "Workspace",
      aliases: [
        "files",
        "file library",
        "uploads",
        "attachments",
        "html",
        "markdown",
        "excel",
        "word",
        "pages",
        "numbers",
        "keynote",
        "iwork",
        "文件",
        "附件",
      ],
      route: "/modules/files",
      run: handleOpenFiles,
    },
    {
      id: "document-file-entry",
      title: "PDF / Office 文件入口",
      description: "打开 PDF、Word、PPT 等文件的本地预览路线",
      icon: "FILE",
      category: "Workspace",
      aliases: [
        "pdf",
        "office",
        "word",
        "ppt",
        "powerpoint",
        "document",
        "文件入口",
      ],
      route: "/modules/files",
      run: handleOpenFiles,
    },
    {
      id: "spreadsheet-entry",
      title: "Excel / CSV 导入入口",
      description: "打开表格文件到本地数据库的确认导入路线",
      icon: "XLS",
      category: "Workspace",
      aliases: [
        "excel",
        "csv",
        "spreadsheet",
        "xlsx",
        "database import",
        "表格导入",
        "Excel 导入",
      ],
      route: "/modules/databases",
      run: handleOpenDatabases,
    },
    {
      id: "create-report-tracker",
      title: "创建报告跟踪表",
      description: "创建本地报告库数据库",
      icon: "DB",
      category: "Database",
      aliases: ["report", "tracker", "library", "database", "files", "报告", "跟踪表"],
      run: () => void handleCreateReportTracker(),
    },
    {
      id: "research-graph-module",
      title: "研究图谱",
      description: "打开跨模块投研关系总览",
      icon: "MAP",
      category: "Workspace",
      aliases: [
        "graph",
        "map",
        "relation",
        "research graph",
        "research map",
        "link",
        "图谱",
        "关系",
        "关联",
      ],
      route: "/modules/research-graph",
      run: handleOpenResearchGraph,
    },
    {
      id: "ai-workbench-module",
      title: "AI 工作台",
      description: "打开本地 AI 请求暂存和隐私检查",
      icon: "AI",
      category: "Workspace",
      aliases: [
        "ai",
        "summary",
        "question",
        "q&a",
        "report generation",
        "compare",
        "framework",
        "automation",
        "总结",
        "问答",
      ],
      route: "/modules/ai",
      run: handleOpenAiWorkbench,
    },
    {
      id: "sync-module",
      title: "Web 同步与权限",
      description: "打开 Web Beta 准备、备份和权限检查",
      icon: "SYNC",
      category: "Workspace",
      aliases: [
        "sync",
        "web beta",
        "permissions",
        "backup",
        "restore",
        "cloud",
        "privacy",
        "同步",
        "权限",
      ],
      route: "/modules/sync",
      run: handleOpenSync,
    },
    ...getEditorCommandActions(handleEditorLocalCommand),
    {
      id: "page-info",
      title: "页面信息",
      description: "打开当前页面的本地元数据和统计",
      icon: "INFO",
      category: "Page",
      aliases: ["info", "properties", "stats", "metadata", "current page", "信息"],
      run: () => handlePageLocalCommand("info"),
    },
    {
      id: "version-history",
      title: "版本历史",
      description: "打开当前页面的已保存版本",
      icon: "HIS",
      category: "Page",
      aliases: ["history", "versions", "version", "compare", "current page", "历史"],
      run: () => handlePageLocalCommand("history"),
    },
    {
      id: "copy-page-link",
      title: "复制页面链接",
      description: "复制当前本地页面链接",
      icon: "URL",
      category: "Page",
      aliases: ["copy", "link", "url", "current page", "复制", "链接"],
      run: () => handlePageLocalCommand("copy-link"),
    },
    {
      id: "export-current-page-html",
      title: "导出当前页面 HTML",
      description: "把当前页面下载为独立 HTML 文件",
      icon: "HTML",
      category: "Page",
      aliases: [
        "export",
        "download",
        "html",
        "current page",
        "page html",
        "导出",
        "当前页面 HTML",
      ],
      run: () => handlePageLocalCommand("export-html"),
    },
    {
      id: "export-current-page-markdown",
      title: "导出当前页面 Markdown",
      description: "把当前页面下载为 Markdown 文件",
      icon: "MD",
      category: "Page",
      aliases: [
        "export",
        "download",
        "markdown",
        "md",
        "current page",
        "page markdown",
        "导出",
        "当前页面 Markdown",
      ],
      run: () => handlePageLocalCommand("export-markdown"),
    },
    {
      id: "copy-page-markdown",
      title: "复制页面 Markdown",
      description: "把当前页面复制为 Markdown 文本",
      icon: "MD",
      category: "Page",
      aliases: [
        "copy",
        "markdown",
        "md",
        "current page",
        "page markdown",
        "复制",
        "页面 Markdown",
      ],
      run: () => handlePageLocalCommand("copy-markdown"),
    },
    {
      id: "copy-page-html",
      title: "复制页面 HTML",
      description: "把当前页面复制为可独立打开的 HTML 文本",
      icon: "HTML",
      category: "Page",
      aliases: [
        "copy",
        "html",
        "current page",
        "page html",
        "复制",
        "页面 HTML",
      ],
      run: () => handlePageLocalCommand("copy-html"),
    },
    {
      id: "print-pdf",
      title: "打印 / PDF",
      description: "打开当前页面的浏览器打印流程",
      icon: "PDF",
      category: "Page",
      aliases: ["print", "pdf", "export", "current page", "打印"],
      run: () => handlePageLocalCommand("print-pdf"),
    },
    {
      id: "export-markdown",
      title: "导出 Markdown",
      description: "把所有活跃页面下载为一个 Markdown 文件",
      icon: "MD",
      category: "Workspace",
      aliases: ["md", "markdown", "export", "download", "导出"],
      run: () => void handleExportMarkdown(),
    },
    {
      id: "new-database",
      title: "新建数据库",
      description: "创建一个空白本地数据库",
      icon: "DB",
      category: "Database",
      aliases: ["new", "database", "table", "data", "新建", "数据库"],
      run: () => void handleCreateDatabase(),
    },
    {
      id: "export-zip",
      title: "导出 ZIP",
      description: "把活跃页面和上传文件下载为本地 ZIP",
      icon: "ZIP",
      category: "Workspace",
      aliases: ["zip", "export", "download", "assets", "files", "导出", "文件"],
      run: () => void handleExportZip(),
    },
    {
      id: "backup",
      title: "备份工作区",
      description: "下载一个本地 JSON 备份",
      icon: "BK",
      category: "Workspace",
      aliases: ["backup", "json", "workspace", "save", "备份"],
      run: () => void handleExportBackup(),
    },
  ];
  const matchingCommands = trimmedQuery
    ? getMatchingCommands(commandActions, trimmedQuery)
    : [];
  const matchingDatabases = trimmedQuery
    ? getMatchingDatabases(databases, trimmedQuery)
    : [];
  const commandEntries: SearchEntry[] = (
    trimmedQuery ? matchingCommands : commandActions
  ).map((command) => ({
    id: `command-${command.id}`,
    type: "command" as const,
    command,
  }));
  const databaseEntries: SearchEntry[] = (
    trimmedQuery ? matchingDatabases : getRecentDatabases(databases)
  ).map((database) => ({
    id: `database-${database.id}`,
    type: "database" as const,
    database,
  }));
  const pageEntries: SearchEntry[] = (
    trimmedQuery ? results : suggestedPages
  ).map((page) => ({
    id: `page-${page.id}`,
    type: "page" as const,
    page,
  }));
  const allEntries: SearchEntry[] = trimmedQuery
    ? [...commandEntries, ...databaseEntries, ...pageEntries]
    : resultFilter === "all"
      ? pageEntries
      : [...commandEntries, ...databaseEntries, ...pageEntries];
  const visibleEntries = filterSearchEntries(allEntries, resultFilter);
  const showEntryGroupHeaders =
    visibleEntries.length > 0 &&
    (Boolean(trimmedQuery) || resultFilter === "actions");

  const handleResultFilterChange = (filter: ResultFilter) => {
    setResultFilter(filter);
    setSelectedIndex(0);
  };

  const handlePageActivityFilterChange = (filter: PageActivityFilter) => {
    setPageActivityFilter(filter);
    setSelectedIndex(0);
  };

  const handleEntrySelect = (entry: SearchEntry) => {
    if (entry.type === "command") {
      entry.command.run();
      return;
    }
    if (entry.type === "database") {
      setOpen(false);
      setQuery("");
      setResults([]);
      openDatabase(entry.database.id);
      return;
    }
    handleSelect(entry.page.id, entry.page);
  };

  const handleEntryPrewarm = (entry: SearchEntry) => {
    if (entry.type === "command" && entry.command.route) {
      warmModuleRoute(entry.command.route);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (visibleEntries.length === 0) return;
      setSelectedIndex((i) => Math.min(i + 1, visibleEntries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (visibleEntries.length === 0) return;
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && visibleEntries[selectedIndex]) {
      handleEntrySelect(visibleEntries[selectedIndex]);
    } else if (e.key === "Enter" && trimmedQuery) {
      void handleCreatePage();
    }
  };

  return (
    <>
      {/* Trigger button in sidebar */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <span className="flex-1 text-left">搜索...</span>
        <kbd className="text-[10px] text-zinc-300 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-700 rounded px-1">
          &#8984;K
        </kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400 shrink-0">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜索页面、数据库或动作..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
              />
              <kbd
                className="text-[10px] text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 cursor-pointer"
                onClick={() => setOpen(false)}
              >
                ESC
              </kbd>
            </div>

            <ResultFilterTabs
              value={resultFilter}
              onChange={handleResultFilterChange}
            />

            {trimmedQuery && !searchIsSaved && (
              <div className="border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={handleSaveSearch}
                  className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  保存搜索：&ldquo;{trimmedQuery}&rdquo;
                </button>
              </div>
            )}

            {!trimmedQuery && savedSearches.length > 0 && (
              <SavedSearches
                savedSearches={savedSearches}
                onRun={(savedSearch) => void handleSearch(savedSearch)}
                onRemove={handleRemoveSavedSearch}
              />
            )}

            {!trimmedQuery &&
              (resultFilter === "all" || resultFilter === "pages") && (
                <PageActivityTabs
                  value={pageActivityFilter}
                  onChange={handlePageActivityFilterChange}
                />
              )}

            {/* Results */}
            {visibleEntries.length > 0 && (
              <>
                <ul className="max-h-72 overflow-y-auto py-2">
                  {!trimmedQuery && (
                    <li className="px-4 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      {resultFilter === "all" || resultFilter === "pages"
                        ? getPageActivityLabel(pageActivityFilter)
                        : resultFilter === "databases"
                          ? "最近数据库"
                          : "动作"}
                    </li>
                  )}
                  {visibleEntries.map((entry, index) => {
                    const groupLabel = getSearchEntryGroupLabel(entry);
                    const previousGroupLabel =
                      index > 0
                        ? getSearchEntryGroupLabel(visibleEntries[index - 1])
                        : "";

                    return (
                      <Fragment key={entry.id}>
                        {showEntryGroupHeaders &&
                          groupLabel !== previousGroupLabel && (
                            <li className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                              {groupLabel}
                            </li>
                          )}
                        <li>
                          <SearchEntryButton
                            entry={entry}
                            query={trimmedQuery}
                            selected={index === selectedIndex}
                            onPrewarm={() => handleEntryPrewarm(entry)}
                            onSelect={() => handleEntrySelect(entry)}
                          />
                        </li>
                      </Fragment>
                    );
                  })}
                </ul>
                {!trimmedQuery && (
                  <CommandActions
                    onNewPage={() => void handleCreateBlankPage()}
                    onPageInfo={() => handlePageLocalCommand("info")}
                    onHistory={() => handlePageLocalCommand("history")}
                    onCopyPageLink={() => handlePageLocalCommand("copy-link")}
                    onCopyPageMarkdown={() =>
                      handlePageLocalCommand("copy-markdown")
                    }
                    onCopyPageHtml={() => handlePageLocalCommand("copy-html")}
                    onPrintPdf={() => handlePageLocalCommand("print-pdf")}
                    onExportMarkdown={() => void handleExportMarkdown()}
                    onExportZip={() => void handleExportZip()}
                    onBackup={() => void handleExportBackup()}
                  />
                )}
              </>
            )}

            {trimmedQuery && visibleEntries.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-zinc-400">
                <p className="mb-3">
                  没有找到匹配的{getFilterEmptyLabel(resultFilter)}：&ldquo;{query}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => void handleCreatePage()}
                  className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  创建 &ldquo;{trimmedQuery}&rdquo;
                </button>
              </div>
            )}

            {!trimmedQuery && visibleEntries.length === 0 && (
              <>
                <EmptyQuickSearchState
                  resultFilter={resultFilter}
                  pageActivityFilter={pageActivityFilter}
                />
                {(resultFilter === "all" || resultFilter === "actions") && (
                  <CommandActions
                    onNewPage={() => void handleCreateBlankPage()}
                    onPageInfo={() => handlePageLocalCommand("info")}
                    onHistory={() => handlePageLocalCommand("history")}
                    onCopyPageLink={() => handlePageLocalCommand("copy-link")}
                    onCopyPageMarkdown={() =>
                      handlePageLocalCommand("copy-markdown")
                    }
                    onCopyPageHtml={() => handlePageLocalCommand("copy-html")}
                    onPrintPdf={() => handlePageLocalCommand("print-pdf")}
                    onExportMarkdown={() => void handleExportMarkdown()}
                    onExportZip={() => void handleExportZip()}
                    onBackup={() => void handleExportBackup()}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function getEditorCommandActions(
  runEditorCommand: (command: EditorLocalCommand) => void
): CommandPaletteAction[] {
  return [
    {
      id: "editor-heading-1",
      title: "标题 1",
      description: "把当前块转换成大标题",
      icon: "H1",
      category: "Editor",
      aliases: ["h1", "heading", "title", "large"],
      run: () => runEditorCommand("heading-1"),
    },
    {
      id: "editor-heading-2",
      title: "标题 2",
      description: "把当前块转换成中标题",
      icon: "H2",
      category: "Editor",
      aliases: ["h2", "heading", "subtitle"],
      run: () => runEditorCommand("heading-2"),
    },
    {
      id: "editor-heading-3",
      title: "标题 3",
      description: "把当前块转换成小标题",
      icon: "H3",
      category: "Editor",
      aliases: ["h3", "heading", "heading 3", "subheading", "三级标题", "小标题"],
      run: () => runEditorCommand("heading-3"),
    },
    {
      id: "editor-child-page",
      title: "新建子页面",
      description: "创建子页面，插入页面链接，并自动进入新页面",
      icon: "PAGE",
      category: "Editor",
      aliases: ["page", "subpage", "new page", "create page", "页面", "新页面", "子页面"],
      run: () => runEditorCommand("child-page"),
    },
    {
      id: "editor-text",
      title: "正文块",
      description: "把当前块转换成普通文本",
      icon: "TXT",
      category: "Editor",
      aliases: ["paragraph", "normal", "text"],
      run: () => runEditorCommand("paragraph"),
    },
    {
      id: "editor-bold",
      title: "加粗",
      description: "切换当前选区的加粗格式",
      icon: "B",
      category: "Editor",
      aliases: ["strong", "format"],
      run: () => runEditorCommand("bold"),
    },
    {
      id: "editor-italic",
      title: "斜体",
      description: "切换当前选区的斜体格式",
      icon: "I",
      category: "Editor",
      aliases: ["emphasis", "format"],
      run: () => runEditorCommand("italic"),
    },
    {
      id: "editor-underline",
      title: "下划线",
      description: "切换当前选区的下划线格式",
      icon: "U",
      category: "Editor",
      aliases: ["format"],
      run: () => runEditorCommand("underline"),
    },
    {
      id: "editor-strike",
      title: "删除线",
      description: "切换当前选区的删除线格式",
      icon: "S",
      category: "Editor",
      aliases: ["strike", "delete", "format"],
      run: () => runEditorCommand("strike"),
    },
    {
      id: "editor-clear",
      title: "清除格式",
      description: "移除当前选区或块的格式",
      icon: "CLR",
      category: "Editor",
      aliases: ["clear", "remove", "format"],
      run: () => runEditorCommand("clear-formatting"),
    },
    {
      id: "editor-block-comment",
      title: "评论当前块",
      description: "给当前块或选中文本添加本地评论",
      icon: "CMT",
      category: "Editor",
      aliases: ["comment", "block comment", "add comment", "评论", "块评论"],
      run: () => runEditorCommand("block-comment"),
    },
    {
      id: "editor-copy-block-link",
      title: "复制块链接",
      description: "复制当前块的本地页面锚点链接",
      icon: "LNK",
      category: "Editor",
      aliases: ["copy link", "block link", "copy block link", "复制块链接"],
      run: () => runEditorCommand("copy-block-link"),
    },
    {
      id: "editor-copy-block-markdown",
      title: "复制块 Markdown",
      description: "把当前块或选中多个块复制为 Markdown",
      icon: "MD",
      category: "Editor",
      aliases: ["copy markdown", "copy md", "block markdown", "复制 Markdown"],
      run: () => runEditorCommand("copy-block-markdown"),
    },
    {
      id: "editor-copy-block-html",
      title: "复制块 HTML",
      description: "把当前块或选中多个块复制为 HTML",
      icon: "HTML",
      category: "Editor",
      aliases: ["copy html", "block html", "复制 HTML", "复制块 HTML"],
      run: () => runEditorCommand("copy-block-html"),
    },
    {
      id: "editor-bullet-list",
      title: "无序列表",
      description: "切换无序列表",
      icon: "UL",
      category: "Editor",
      aliases: ["ul", "list", "bullets"],
      run: () => runEditorCommand("bullet-list"),
    },
    {
      id: "editor-numbered-list",
      title: "有序列表",
      description: "切换有序列表",
      icon: "OL",
      category: "Editor",
      aliases: ["ol", "ordered", "list", "number"],
      run: () => runEditorCommand("numbered-list"),
    },
    {
      id: "editor-task-list",
      title: "待办列表",
      description: "切换本地 checklist",
      icon: "TODO",
      category: "Editor",
      aliases: ["todo", "task", "checkbox", "checklist"],
      run: () => runEditorCommand("task-list"),
    },
    {
      id: "editor-quote",
      title: "引用",
      description: "切换引用格式",
      icon: "QT",
      category: "Editor",
      aliases: ["blockquote", "quote"],
      run: () => runEditorCommand("blockquote"),
    },
    {
      id: "editor-code",
      title: "代码块",
      description: "切换代码块",
      icon: "<>",
      category: "Editor",
      aliases: ["code", "pre", "syntax"],
      run: () => runEditorCommand("code-block"),
    },
    {
      id: "editor-divider",
      title: "分割线",
      description: "插入水平分割线",
      icon: "HR",
      category: "Editor",
      aliases: ["divider", "rule", "horizontal"],
      run: () => runEditorCommand("horizontal-rule"),
    },
    {
      id: "editor-toggle",
      title: "折叠列表",
      description: "插入可折叠 toggle 块",
      icon: ">",
      category: "Editor",
      aliases: ["toggle", "collapse", "disclosure"],
      run: () => runEditorCommand("toggle-block"),
    },
    {
      id: "editor-callout",
      title: "提示块",
      description: "插入 callout 提示块",
      icon: "!",
      category: "Editor",
      aliases: ["callout", "note", "warning", "tip"],
      run: () => runEditorCommand("callout"),
    },
    {
      id: "editor-toc",
      title: "目录",
      description: "插入本地目录",
      icon: "TOC",
      category: "Editor",
      aliases: ["toc", "contents", "outline"],
      run: () => runEditorCommand("table-of-contents"),
    },
    {
      id: "editor-columns",
      title: "双栏",
      description: "插入双栏布局",
      icon: "COL",
      category: "Editor",
      aliases: ["columns", "layout", "two column"],
      run: () => runEditorCommand("columns"),
    },
    {
      id: "editor-table",
      title: "表格",
      description: "插入 3x3 页面表格",
      icon: "TBL",
      category: "Editor",
      aliases: ["table", "grid"],
      run: () => runEditorCommand("table"),
    },
    {
      id: "editor-bookmark",
      title: "书签",
      description: "插入可编辑的本地书签卡片",
      icon: "URL",
      category: "Editor",
      aliases: ["bookmark", "url", "link card"],
      run: () => runEditorCommand("bookmark"),
    },
    {
      id: "editor-embed",
      title: "嵌入",
      description: "插入隐私安全的 embed 块",
      icon: "EMB",
      category: "Editor",
      aliases: ["embed", "iframe", "video"],
      run: () => runEditorCommand("embed"),
    },
    {
      id: "editor-equation",
      title: "公式",
      description: "插入本地公式块",
      icon: "EQ",
      category: "Editor",
      aliases: ["equation", "math", "formula"],
      run: () => runEditorCommand("equation"),
    },
    {
      id: "editor-inline-equation",
      title: "行内公式",
      description: "在当前行插入公式",
      icon: "$x$",
      category: "Editor",
      aliases: ["inline equation", "inline math", "math", "formula"],
      run: () => runEditorCommand("inline-equation"),
    },
    {
      id: "editor-template",
      title: "模板按钮",
      description: "插入可复用的本地模板按钮",
      icon: "TPL",
      category: "Editor",
      aliases: ["template", "button", "memo"],
      run: () => runEditorCommand("template-button"),
    },
    {
      id: "editor-breadcrumb",
      title: "面包屑块",
      description: "把当前页面路径插入笔记",
      icon: "BC",
      category: "Editor",
      aliases: ["breadcrumb", "path"],
      run: () => runEditorCommand("breadcrumb"),
    },
    {
      id: "editor-synced",
      title: "同步块",
      description: "插入本地同步块组",
      icon: "SYNC",
      category: "Editor",
      aliases: ["synced", "sync", "reuse"],
      run: () => runEditorCommand("synced-block"),
    },
  ];
}

function EmptyQuickSearchState({
  resultFilter,
  pageActivityFilter,
}: {
  resultFilter: ResultFilter;
  pageActivityFilter: PageActivityFilter;
}) {
  const message =
    resultFilter === "databases"
      ? "暂无最近数据库。"
      : resultFilter === "actions"
        ? "暂无匹配动作。"
        : `${getPageActivityLabel(pageActivityFilter)}会显示在这里。`;

  return (
    <div className="px-4 py-5 text-center text-sm text-zinc-400">
      {message}
    </div>
  );
}

function ResultFilterTabs({
  value,
  onChange,
}: {
  value: ResultFilter;
  onChange: (value: ResultFilter) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
      {RESULT_FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          className={`rounded-md px-2 py-1 text-xs transition-colors ${
            value === filter.value
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function SavedSearches({
  savedSearches,
  onRun,
  onRemove,
}: {
  savedSearches: string[];
  onRun: (savedSearch: string) => void;
  onRemove: (savedSearch: string) => void;
}) {
  return (
    <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        保存的搜索
      </div>
      <div className="flex flex-wrap gap-2">
        {savedSearches.map((savedSearch) => (
          <span
            key={savedSearch}
            className="inline-flex max-w-full items-center gap-1 rounded-md border border-zinc-200 bg-white text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <button
              type="button"
              onClick={() => onRun(savedSearch)}
              className="max-w-[180px] truncate px-2 py-1 text-left hover:text-zinc-900 dark:hover:text-zinc-100"
              title={`搜索 ${savedSearch}`}
            >
              {savedSearch}
            </button>
            <button
              type="button"
              onClick={() => onRemove(savedSearch)}
              className="border-l border-zinc-200 px-1.5 py-1 text-zinc-400 hover:text-red-500 dark:border-zinc-700"
              title={`移除保存的搜索 ${savedSearch}`}
            >
              x
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function PageActivityTabs({
  value,
  onChange,
}: {
  value: PageActivityFilter;
  onChange: (value: PageActivityFilter) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
      {PAGE_ACTIVITY_FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          className={`rounded-md px-2 py-1 text-xs transition-colors ${
            value === filter.value
              ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function SearchEntryButton({
  entry,
  query,
  selected,
  onPrewarm,
  onSelect,
}: {
  entry: SearchEntry;
  query: string;
  selected: boolean;
  onPrewarm: () => void;
  onSelect: () => void;
}) {
  const isCommand = entry.type === "command";
  const isDatabase = entry.type === "database";
  const icon = isCommand
    ? entry.command.icon
    : isDatabase
      ? entry.database.icon || "DB"
      : entry.page.icon || "📄";
  const title = isCommand
    ? entry.command.title
    : isDatabase
      ? entry.database.title || "未命名数据库"
      : entry.page.title || "未命名";
  const description = isCommand
    ? entry.command.description
    : isDatabase
      ? "数据库"
    : query
      ? getSearchPreview(entry.page, query)
      : "";

  return (
    <button
      onPointerEnter={onPrewarm}
      onFocus={onPrewarm}
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${
        selected
          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      }`}
    >
      <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded bg-zinc-100 px-1 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          <HighlightedText value={title} query={query} />
        </span>
        {description && (
          <span className="block truncate text-xs text-zinc-400">
            <HighlightedText value={description} query={query} />
          </span>
        )}
      </span>
      {(isCommand || isDatabase) && (
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400 dark:bg-zinc-800">
          {isCommand
            ? COMMAND_CATEGORY_LABELS[entry.command.category]
            : "数据库"}
        </span>
      )}
    </button>
  );
}

function CommandActions({
  onNewPage,
  onPageInfo,
  onHistory,
  onCopyPageLink,
  onCopyPageMarkdown,
  onCopyPageHtml,
  onPrintPdf,
  onExportMarkdown,
  onExportZip,
  onBackup,
}: {
  onNewPage: () => void;
  onPageInfo: () => void;
  onHistory: () => void;
  onCopyPageLink: () => void;
  onCopyPageMarkdown: () => void;
  onCopyPageHtml: () => void;
  onPrintPdf: () => void;
  onExportMarkdown: () => void;
  onExportZip: () => void;
  onBackup: () => void;
}) {
  return (
    <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        常用动作
      </div>
      <div className="grid grid-cols-4 gap-2">
        <CommandActionButton label="新建页面" onClick={onNewPage} />
        <CommandActionButton label="信息" onClick={onPageInfo} />
        <CommandActionButton label="历史" onClick={onHistory} />
        <CommandActionButton label="复制链接" onClick={onCopyPageLink} />
        <CommandActionButton label="复制 MD" onClick={onCopyPageMarkdown} />
        <CommandActionButton label="复制 HTML" onClick={onCopyPageHtml} />
        <CommandActionButton label="PDF" onClick={onPrintPdf} />
        <CommandActionButton label="导出 MD" onClick={onExportMarkdown} />
        <CommandActionButton label="ZIP" onClick={onExportZip} />
        <CommandActionButton label="备份" onClick={onBackup} />
      </div>
    </div>
  );
}

function CommandActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-zinc-200 px-2 py-2 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {label}
    </button>
  );
}

function getPagesForActivity(
  pages: Page[],
  favoriteIds: string[],
  filter: PageActivityFilter,
  getPageById: (id: string) => Page | undefined
) {
  if (filter === "updated") {
    return getTopPagesByTimestamp(pages, "updated_at", QUICK_SEARCH_ACTIVITY_LIMIT);
  }

  if (filter === "created") {
    return getTopPagesByTimestamp(pages, "created_at", QUICK_SEARCH_ACTIVITY_LIMIT);
  }

  const favorites = favoriteIds
    .map((id) => getPageById(id))
    .filter((page): page is Page => Boolean(page));
  if (filter === "favorites") return favorites.slice(0, QUICK_SEARCH_ACTIVITY_LIMIT);

  const favoriteIdSet = new Set(favorites.map((page) => page.id));
  const recentPages = getTopPagesByTimestamp(
    pages,
    "updated_at",
    Math.max(0, QUICK_SEARCH_ACTIVITY_LIMIT - favorites.length),
    favoriteIdSet
  );

  return [...favorites, ...recentPages].slice(0, QUICK_SEARCH_ACTIVITY_LIMIT);
}

function getTopPagesByTimestamp(
  pages: Page[],
  timestampField: "created_at" | "updated_at",
  limit: number,
  excludedIds: Set<string> = new Set()
) {
  if (limit <= 0) return [];
  const topPages: Page[] = [];

  for (const page of pages) {
    if (page.deleted_at || excludedIds.has(page.id)) continue;
    const pageTime = new Date(page[timestampField]).getTime();
    let insertAt = topPages.length;

    while (
      insertAt > 0 &&
      pageTime > new Date(topPages[insertAt - 1][timestampField]).getTime()
    ) {
      insertAt -= 1;
    }

    if (insertAt >= limit) continue;
    topPages.splice(insertAt, 0, page);
    if (topPages.length > limit) {
      topPages.pop();
    }
  }

  return topPages;
}

function getPageActivityLabel(filter: PageActivityFilter) {
  if (filter === "updated") return "最近更新的页面";
  if (filter === "created") return "最近创建的页面";
  if (filter === "favorites") return "收藏页面";
  return "收藏和最近页面";
}

function getRecentDatabases(databases: Database[]) {
  return [...databases]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 8);
}

function filterSearchEntries(entries: SearchEntry[], filter: ResultFilter) {
  if (filter === "all") return entries;
  if (filter === "pages") {
    return entries.filter((entry) => entry.type === "page");
  }
  if (filter === "databases") {
    return entries.filter((entry) => entry.type === "database");
  }
  return entries.filter((entry) => entry.type === "command");
}

function getSearchEntryGroupLabel(entry: SearchEntry) {
  if (entry.type === "command") {
    return `${COMMAND_CATEGORY_LABELS[entry.command.category]}动作`;
  }
  if (entry.type === "database") return "数据库";
  return "页面";
}

function getFilterEmptyLabel(filter: ResultFilter) {
  if (filter === "pages") return "页面";
  if (filter === "databases") return "数据库";
  if (filter === "actions") return "动作";
  return "结果";
}

function searchPageMetadata(pages: Page[], query: string) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return [];

  return pages
    .filter((page) => !page.deleted_at)
    .map((page) => ({
      page,
      score: scorePageMetadata(page, normalizedQuery),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return (
        new Date(b.page.updated_at).getTime() -
        new Date(a.page.updated_at).getTime()
      );
    })
    .slice(0, QUICK_SEARCH_RESULT_LIMIT)
    .map((result) => result.page);
}

function scorePageMetadata(page: Page, query: string) {
  const title = normalizeSearchQuery(page.title || "未命名页面");
  const properties = normalizeSearchQuery(page.properties);
  const icon = normalizeSearchQuery(page.icon);
  const tokens = getSearchQueryTokens(query);
  let score = 0;

  if (title === query) score += 100;
  if (title.startsWith(query)) score += 70;
  if (title.includes(query)) score += 50;
  if (tokens.length > 1 && tokens.every((token) => title.includes(token))) {
    score += 35;
  }
  if (properties.includes(query)) score += 18;
  if (
    tokens.length > 1 &&
    tokens.every((token) => properties.includes(token))
  ) {
    score += 12;
  }
  if (icon && icon.includes(query)) score += 3;

  return score;
}

function mergeSearchResults(
  metadataResults: Page[],
  fullTextResults: Page[],
  limit = QUICK_SEARCH_RESULT_LIMIT
) {
  const merged = new Map<string, Page>();
  for (const page of [...metadataResults, ...fullTextResults]) {
    if (!merged.has(page.id)) {
      merged.set(page.id, page);
    }
  }
  return [...merged.values()].slice(0, limit);
}

function normalizeSearchQuery(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchQueryTokens(query: string) {
  return normalizeSearchQuery(query).split(" ").filter(Boolean);
}

function readSavedSearchesLocalCache() {
  if (typeof window === "undefined") return [];
  try {
    const rawValue = window.localStorage.getItem(SAVED_SEARCHES_KEY);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return normalizeQuickSearchSavedSearches(parsed);
  } catch {
    return [];
  }
}

function saveSearchQuery(query: string, currentSearches: string[]) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return currentSearches;
  const nextSavedSearches = [
    normalizedQuery,
    ...currentSearches.filter(
      (item) => item.toLowerCase() !== normalizedQuery.toLowerCase()
    ),
  ].slice(0, MAX_SAVED_SEARCHES);
  return nextSavedSearches;
}

function writeSavedSearchesLocalCache(savedSearches: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SAVED_SEARCHES_KEY,
    JSON.stringify(normalizeQuickSearchSavedSearches(savedSearches))
  );
}

async function persistSavedSearchesWorkspaceSetting(
  savedSearches: string[],
  source = "quick-search-ui"
) {
  const normalized = normalizeQuickSearchSavedSearches(savedSearches);
  writeSavedSearchesLocalCache(normalized);
  await upsertWorkspaceSetting(
    QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY,
    {
      schema_version: 1,
      saved_searches: normalized,
      cloud_target: "workspaces.settings.quick_search_saved_searches",
      local_cache_key: SAVED_SEARCHES_KEY,
      ordinary_sync_pending_only: true,
    },
    source
  );
}

function getMatchingCommands(
  actions: CommandPaletteAction[],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return actions.filter((action) => {
    const haystack = [
      action.title,
      action.description,
      action.category,
      ...action.aliases,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

function getMatchingDatabases(databases: Database[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return databases
    .filter((database) =>
      (database.title || "未命名数据库")
        .toLowerCase()
        .includes(normalizedQuery)
    )
    .sort((a, b) => {
      const aTitle = (a.title || "未命名数据库").toLowerCase();
      const bTitle = (b.title || "未命名数据库").toLowerCase();
      const aExact = aTitle === normalizedQuery ? 0 : 1;
      const bExact = bTitle === normalizedQuery ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })
    .slice(0, 8);
}

function getSearchPreview(page: Page, query: string) {
  const source = stripHtml(page.content_text ?? "");
  if (!source) return "页面标题匹配";

  const lowerSource = source.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerSource.indexOf(lowerQuery);
  if (index === -1) return source.slice(0, 90);

  const start = Math.max(0, index - 35);
  const end = Math.min(source.length, index + query.length + 55);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < source.length ? "..." : "";
  return `${prefix}${source.slice(start, end)}${suffix}`;
}

function HighlightedText({ value, query }: { value: string; query: string }) {
  const parts = splitHighlightParts(value, query);
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark
            key={`${part.text}-${index}`}
            className="rounded bg-yellow-100 px-0.5 text-inherit dark:bg-yellow-900/60"
          >
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        )
      )}
    </>
  );
}

function splitHighlightParts(value: string, query: string) {
  const needle = query.trim();
  if (!needle) return [{ text: value, match: false }];

  const lowerValue = value.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;

  while (cursor < value.length) {
    const index = lowerValue.indexOf(lowerNeedle, cursor);
    if (index === -1) {
      parts.push({ text: value.slice(cursor), match: false });
      break;
    }
    if (index > cursor) {
      parts.push({ text: value.slice(cursor, index), match: false });
    }
    parts.push({
      text: value.slice(index, index + needle.length),
      match: true,
    });
    cursor = index + needle.length;
  }

  return parts.length ? parts : [{ text: value, match: false }];
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isEditorTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest(".ProseMirror") || target.isContentEditable);
}
