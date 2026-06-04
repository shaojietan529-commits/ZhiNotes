"use client";

import { Fragment, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createDatabase,
  createPage,
  getAllDatabases,
  searchPages,
} from "@/lib/db/local/queries";
import { usePages } from "@/hooks/usePages";
import { usePageFavorites } from "@/hooks/usePageFavorites";
import {
  exportWorkspaceBackup,
  exportWorkspaceMarkdown,
  exportWorkspaceZip,
} from "@/lib/export/workspaceBackup";
import {
  dispatchPageLocalCommand,
  type PageLocalCommand,
} from "@/lib/pageLocalCommands";
import {
  dispatchEditorLocalCommand,
  type EditorLocalCommand,
} from "@/lib/editorLocalCommands";
import { executeModuleStarter } from "@/lib/modules/actions";
import { PLATFORM_MODULES, type ModuleStarter } from "@/lib/modules/registry";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

const SAVED_SEARCHES_KEY = "zhinote:saved-searches";
const MAX_SAVED_SEARCHES = 10;

type CommandCategory = "Page" | "Editor" | "Database" | "Workspace";

interface CommandPaletteAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: CommandCategory;
  aliases: string[];
  run: () => void;
}

type SearchEntry =
  | { id: string; type: "command"; command: CommandPaletteAction }
  | { id: string; type: "database"; database: Database }
  | { id: string; type: "page"; page: Page };

type ResultFilter = "all" | "pages" | "databases" | "actions";
type PageActivityFilter = "suggested" | "updated" | "created" | "favorites";

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

export default function QuickSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Page[]>([]);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [savedSearches, setSavedSearches] =
    useState<string[]>(readSavedSearches);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [pageActivityFilter, setPageActivityFilter] =
    useState<PageActivityFilter>("suggested");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRequestRef = useRef(0);
  const router = useRouter();
  const { pages, refresh } = usePages();
  const { favoriteIds } = usePageFavorites();
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);

  const trimmedQuery = query.trim();
  const suggestedPages = getPagesForActivity(
    pages,
    favoriteIds,
    pageActivityFilter
  );
  const searchIsSaved = savedSearches.some(
    (savedSearch) => savedSearch.toLowerCase() === trimmedQuery.toLowerCase()
  );

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
      void getAllDatabases()
        .then(setDatabases)
        .catch((err) => {
          console.error("[Zhinote] Failed to load databases for search:", err);
        });
    }
  }, [open]);

  const handleSearch = useCallback(async (value: string) => {
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setQuery(value);
    setSelectedIndex(0);
    if (value.trim().length === 0) {
      setResults([]);
      return;
    }
    const found = await searchPages(value.trim());
    if (requestId !== searchRequestRef.current) return;
    setResults(found);
  }, []);

  const handleSaveSearch = () => {
    const nextSavedSearches = saveSearchQuery(trimmedQuery, savedSearches);
    setSavedSearches(nextSavedSearches);
  };

  const handleRemoveSavedSearch = (savedSearch: string) => {
    const nextSavedSearches = savedSearches.filter(
      (item) => item.toLowerCase() !== savedSearch.toLowerCase()
    );
    setSavedSearches(nextSavedSearches);
    writeSavedSearches(nextSavedSearches);
  };

  const handleSelect = (pageId: string) => {
    router.push(`/page/${pageId}`);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleCreatePage = async () => {
    const page = await createPage({
      title: trimmedQuery || "未命名",
    });
    await refresh();
    handleSelect(page.id);
  };

  const handleCreateBlankPage = async () => {
    const page = await createPage();
    await refresh();
    handleSelect(page.id);
  };

  const handleCreateDatabase = async () => {
    const database = await createDatabase({ title: "未命名数据库" });
    setDatabases((currentDatabases) => [database, ...currentDatabases]);
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/database/${database.id}`);
  };

  const handleOpenModuleHub = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push("/modules");
  };

  const handleOpenNotes = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push("/modules/notes");
  };

  const handleOpenCompanyResearch = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push("/modules/company-research");
  };

  const handleOpenPortfolio = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push("/modules/portfolio");
  };

  const handleOpenMeetings = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push("/modules/meetings");
  };

  const handleOpenReports = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push("/modules/reports");
  };

  const handleOpenResearchGraph = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push("/modules/research-graph");
  };

  const handleOpenAiWorkbench = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push("/modules/ai");
  };

  const handleOpenSync = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push("/modules/sync");
  };

  const handleModuleStarter = async (starter: ModuleStarter) => {
    try {
      const result = await executeModuleStarter(starter);
      if (result.database) {
        setDatabases((currentDatabases) => [
          result.database as Database,
          ...currentDatabases,
        ]);
      }
      await refresh();
      setOpen(false);
      setQuery("");
      setResults([]);
      router.push(result.route);
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
      await exportWorkspaceMarkdown();
      setOpen(false);
    } catch (err) {
      console.error("[Zhinote] Failed to export workspace Markdown:", err);
      window.alert("Markdown 导出失败，请查看控制台详情。");
    }
  };

  const handleExportBackup = async () => {
    try {
      await exportWorkspaceBackup();
      setOpen(false);
    } catch (err) {
      console.error("[Zhinote] Failed to export workspace backup:", err);
      window.alert("备份失败，请查看控制台详情。");
    }
  };

  const handleExportZip = async () => {
    try {
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
      run: handleOpenModuleHub,
    },
    {
      id: "notes-module",
      title: "笔记与页面中心",
      description: "打开本地笔记工作台和页面结构总览",
      icon: "NOTE",
      category: "Workspace",
      aliases: ["notes", "pages", "notion", "workspace", "笔记", "页面"],
      run: handleOpenNotes,
    },
    {
      id: "company-research-module",
      title: "公司研究",
      description: "打开公司研究模块",
      icon: "CO",
      category: "Workspace",
      aliases: ["company", "companies", "coverage", "research module", "公司"],
      run: handleOpenCompanyResearch,
    },
    {
      id: "new-company-profile",
      title: "新建公司研究页",
      description: "创建一个本地公司研究页面",
      icon: "CO",
      category: "Page",
      aliases: ["company", "profile", "coverage", "deep dive", "公司", "研究"],
      run: () =>
        void handleModuleStarter({
          type: "page",
          label: "新建公司研究页",
          title: "未命名公司研究",
          templateTitle: "公司研究",
          icon: "CO",
        }),
    },
    {
      id: "new-investment-memo",
      title: "新建投资备忘录",
      description: "创建一个本地投资备忘录页面",
      icon: "MEMO",
      category: "Page",
      aliases: ["investment", "memo", "thesis", "stock", "投资", "备忘录"],
      run: () =>
        void handleModuleStarter({
          type: "page",
          label: "新建投资备忘录",
          title: "未命名投资备忘录",
          templateTitle: "投资备忘录",
          icon: "MEMO",
        }),
    },
    {
      id: "new-earnings-review",
      title: "新建业绩复盘",
      description: "创建一个本地业绩复盘页面",
      icon: "Q",
      category: "Page",
      aliases: ["earnings", "quarter", "results", "call", "业绩", "复盘"],
      run: () =>
        void handleModuleStarter({
          type: "page",
          label: "新建业绩复盘",
          title: "未命名业绩复盘",
          templateTitle: "业绩复盘",
          icon: "Q",
        }),
    },
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
      id: "portfolio-module",
      title: "组合与观察名单",
      description: "打开本地组合与观察名单模块",
      icon: "PF",
      category: "Workspace",
      aliases: ["portfolio", "watchlist", "position", "positions", "sizing", "组合", "观察名单"],
      run: handleOpenPortfolio,
    },
    {
      id: "new-position-memo",
      title: "新建持仓备忘录",
      description: "创建一个本地持仓备忘录页面",
      icon: "PF",
      category: "Page",
      aliases: ["portfolio", "position", "memo", "sizing", "thesis", "持仓", "备忘录"],
      run: () =>
        void handleModuleStarter({
          type: "page",
          label: "新建持仓备忘录",
          title: "未命名持仓备忘录",
          templateTitle: "投资备忘录",
          icon: "PF",
        }),
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
      run: handleOpenMeetings,
    },
    {
      id: "new-meeting-note",
      title: "新建会议纪要",
      description: "创建一个本地会议纪要页面",
      icon: "MTG",
      category: "Page",
      aliases: ["meeting", "notes", "call", "transcript", "action items", "会议", "纪要"],
      run: () =>
        void handleModuleStarter({
          type: "page",
          label: "新建会议纪要",
          title: "未命名会议纪要",
          templateTitle: "会议纪要",
          icon: "MTG",
        }),
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
      run: handleOpenReports,
    },
    {
      id: "new-report-note",
      title: "新建报告笔记",
      description: "创建一个本地研究报告页面",
      icon: "RPT",
      category: "Page",
      aliases: ["report", "research report", "html report", "pdf", "file note", "报告", "笔记"],
      run: () =>
        void handleModuleStarter({
          type: "page",
          label: "新建报告笔记",
          title: "未命名研究报告",
          templateTitle: "研究报告",
          icon: "RPT",
        }),
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
      router.push(`/database/${entry.database.id}`);
      setOpen(false);
      setQuery("");
      setResults([]);
      return;
    }
    handleSelect(entry.page.id);
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
      aliases: ["h3", "heading"],
      run: () => runEditorCommand("heading-3"),
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
  onSelect,
}: {
  entry: SearchEntry;
  query: string;
  selected: boolean;
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
  onPrintPdf,
  onExportMarkdown,
  onExportZip,
  onBackup,
}: {
  onNewPage: () => void;
  onPageInfo: () => void;
  onHistory: () => void;
  onCopyPageLink: () => void;
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
  filter: PageActivityFilter
) {
  if (filter === "updated") {
    return [...pages]
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
      .slice(0, 8);
  }

  if (filter === "created") {
    return [...pages]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 8);
  }

  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const favorites = favoriteIds
    .map((id) => pagesById.get(id))
    .filter((page): page is Page => Boolean(page));
  if (filter === "favorites") return favorites.slice(0, 8);

  const favoriteIdSet = new Set(favorites.map((page) => page.id));
  const recentPages = pages
    .filter((page) => !favoriteIdSet.has(page.id))
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, Math.max(0, 8 - favorites.length));

  return [...favorites, ...recentPages].slice(0, 8);
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

function readSavedSearches() {
  if (typeof window === "undefined") return [];
  try {
    const rawValue = window.localStorage.getItem(SAVED_SEARCHES_KEY);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, MAX_SAVED_SEARCHES);
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
  writeSavedSearches(nextSavedSearches);
  return nextSavedSearches;
}

function writeSavedSearches(savedSearches: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(savedSearches));
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
