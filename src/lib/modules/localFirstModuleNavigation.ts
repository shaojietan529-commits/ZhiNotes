"use client";

type ModuleWarmup = () => Promise<unknown>;

const moduleWarmups: Record<string, ModuleWarmup> = {
  "/daily": () => import("@/components/modules/DailyNotesShell"),
  "/industry-chain": () => import("@/components/modules/IndustryChainShell"),
  "/knowledge-base": () => import("@/components/modules/KnowledgeBaseShell"),
  "/modules": () => import("@/components/modules/ModuleHubShell"),
  "/modules/ai": () => import("@/components/modules/AiWorkbenchShell"),
  "/modules/company-research": () =>
    import("@/components/modules/CompanyResearchShell"),
  "/modules/databases": () => import("@/components/modules/DatabasesShell"),
  "/modules/files": () => import("@/components/modules/FilesShell"),
  "/modules/meetings": () => import("@/components/modules/MeetingsShell"),
  "/modules/notes": () => import("@/components/modules/NotesShell"),
  "/modules/portfolio": () => import("@/components/modules/PortfolioShell"),
  "/modules/projects": () => import("@/components/modules/ProjectsShell"),
  "/modules/reports": () => import("@/components/modules/ReportsShell"),
  "/modules/research-graph": () =>
    import("@/components/modules/ResearchGraphShell"),
  "/modules/sync": () => import("@/components/modules/SyncShell"),
  "/portfolio": () => import("@/components/modules/PortfolioBoardShell"),
  "/schedule": () => import("@/components/modules/MeetingScheduleShell"),
};

const moduleWarmupPromises = new Map<string, Promise<unknown>>();

export function warmModuleRoute(route: string): void {
  const pathname = normalizeRoutePath(route);
  const warmup = moduleWarmups[pathname];
  if (!warmup || moduleWarmupPromises.has(pathname)) return;

  const promise = warmup().catch(() => {
    moduleWarmupPromises.delete(pathname);
  });
  moduleWarmupPromises.set(pathname, promise);
}

function normalizeRoutePath(route: string): string {
  return route.split(/[?#]/, 1)[0] || route;
}
