"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PagePeekModal, {
  warmPagePeekModal,
} from "@/components/page/LazyPagePeekModal";
import { useLocalFirstDatabaseNavigation } from "@/hooks/useLocalFirstDatabaseNavigation";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import {
  countActiveDatabases,
  countActivePages,
} from "@/lib/db/local/queries";
import { subscribeDatabasesUpdated } from "@/lib/database/databaseUpdateBus";
import {
  MODULE_EXTENSION_SLOTS,
  PLATFORM_MODULES,
  getModuleCategoryLabel,
  getModuleStatusLabel,
  getModuleUsageTierLabel,
  getModulesByStatus,
  getModulesByUsageTier,
  type ModuleStatus,
  type ModuleUsageTier,
  type PlatformModule,
} from "@/lib/modules/registry";
import {
  buildModuleManifestReport,
  type ModuleManifestGateStatus,
  type ModuleManifestReport,
} from "@/lib/modules/moduleManifest";
import {
  buildModuleOnboardingContract,
  type ModuleOnboardingContract,
  type ModuleOnboardingStatus,
} from "@/lib/modules/moduleOnboarding";
import {
  buildModuleStarterPackContract,
  type ModuleStarterPackContract,
  type ModuleStarterPackStatus,
} from "@/lib/modules/moduleStarterPack";
import {
  buildModuleHealthReport,
  type ModuleHealthReport,
  type ModuleHealthStatus,
} from "@/lib/modules/moduleHealth";
import {
  buildModuleRoadmapReport,
  type ModuleRoadmapReadiness,
  type ModuleRoadmapReport,
} from "@/lib/modules/moduleRoadmap";
import {
  buildProjectProgressSnapshot,
  type ProjectProgressSnapshot,
  type ProjectProgressStatus,
} from "@/lib/modules/projectProgressSnapshot";
import { rememberPendingPageDraft } from "@/lib/pages/pendingPageDrafts";
import { rememberPageRouteHandoff } from "@/lib/pages/pageRouteHandoff";
import { subscribePagesUpdated } from "@/lib/pages/pageUpdateBus";
import {
  DEFAULT_APP_LANGUAGE_LABEL,
  DEFAULT_APP_LOCALE,
} from "@/lib/i18n/platformLanguage";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { ZhiNoteLogo } from "@/components/brand/ZhiNoteLogo";
import type { Page } from "@/lib/utils/types";

const STATUS_ORDER: ModuleStatus[] = ["active", "beta", "planned"];

const loadPageMutationModule = () =>
  import("@/lib/pages/cloudPageMutations");
const loadDatabaseMutationModule = () =>
  import("@/lib/database/cloudDatabaseMutations");
const loadModuleStarterActions = () => import("@/lib/modules/actions");

export default function ModuleDashboard() {
  const router = useRouter();
  const openDatabase = useLocalFirstDatabaseNavigation();
  const openPage = useLocalFirstPageNavigation();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const [pageCount, setPageCount] = useState(0);
  const [databaseCount, setDatabaseCount] = useState(0);
  const [exportingManifest, setExportingManifest] = useState(false);
  const [exportingOnboarding, setExportingOnboarding] = useState(false);
  const [exportingStarterPack, setExportingStarterPack] = useState(false);
  const [exportingHealth, setExportingHealth] = useState(false);
  const [exportingRoadmap, setExportingRoadmap] = useState(false);
  const [exportingProgress, setExportingProgress] = useState(false);
  const [peekPageId, setPeekPageId] = useState<string | null>(null);
  const [peekInitialPage, setPeekInitialPage] = useState<Page | null>(null);
  const activeModules = useMemo(() => getModulesByStatus("active"), []);
  const betaModules = useMemo(() => getModulesByStatus("beta"), []);
  const plannedModules = useMemo(() => getModulesByStatus("planned"), []);
  const stableUseModules = useMemo(() => getModulesByUsageTier("stable-use"), []);
  const betaHardeningModules = useMemo(
    () => getModulesByUsageTier("beta-hardening"),
    []
  );
  const ownerGatedExperimentModules = useMemo(
    () => getModulesByUsageTier("owner-gated-experiment"),
    []
  );
  const moduleManifest = useMemo(() => buildModuleManifestReport(), []);
  const moduleOnboarding = useMemo(() => buildModuleOnboardingContract(), []);
  const moduleStarterPack = useMemo(() => buildModuleStarterPackContract(), []);
  const moduleHealth = useMemo(() => buildModuleHealthReport(), []);
  const moduleRoadmap = useMemo(
    () =>
      buildModuleRoadmapReport({
        manifest: moduleManifest,
        onboarding: moduleOnboarding,
        starterPack: moduleStarterPack,
        health: moduleHealth,
      }),
    [moduleHealth, moduleManifest, moduleOnboarding, moduleStarterPack]
  );
  const progressSnapshot = useMemo(
    () =>
      buildProjectProgressSnapshot({
        page_count: pageCount,
        database_count: databaseCount,
        manifest: moduleManifest,
        health: moduleHealth,
        roadmap: moduleRoadmap,
      }),
    [databaseCount, moduleHealth, moduleManifest, moduleRoadmap, pageCount]
  );

  const refreshWorkspaceCounts = useCallback(async () => {
    if (!dbReady) return;
    const [nextPageCount, nextDatabaseCount] = await Promise.all([
      countActivePages(),
      countActiveDatabases(),
    ]);
    setPageCount(nextPageCount);
    setDatabaseCount(nextDatabaseCount);
  }, [dbReady]);

  useEffect(() => {
    if (!dbReady) return;
    queueMicrotask(() => {
      void refreshWorkspaceCounts();
    });
  }, [dbReady, refreshWorkspaceCounts]);

  useEffect(() => {
    if (!dbReady) return;
    let timer: number | null = null;
    const scheduleCountRefresh = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void refreshWorkspaceCounts();
      }, 120);
    };
    const unsubscribePages = subscribePagesUpdated(scheduleCountRefresh);
    const unsubscribeDatabases =
      subscribeDatabasesUpdated(scheduleCountRefresh);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsubscribePages();
      unsubscribeDatabases();
    };
  }, [dbReady, refreshWorkspaceCounts]);

  const openCreatedModulePage = useCallback((page: Page) => {
    rememberPendingPageDraft(page);
    rememberPageRouteHandoff(page, "module-create");
    warmPagePeekModal();
    setPeekInitialPage(page);
    setPeekPageId(page.id);
  }, []);

  const openModuleFullPageById = useCallback(
    (pageId: string) => {
      if (peekInitialPage?.id === pageId) {
        openPage(peekInitialPage, { source: "module-open" });
        return;
      }
      openPage(pageId, { source: "module-open" });
    },
    [openPage, peekInitialPage]
  );

  const handleNewPage = async () => {
    warmPagePeekModal();
    const { createPageWithCloud } = await loadPageMutationModule();
    const page = await createPageWithCloud({ title: "未命名研究笔记" });
    upsertPages([page]);
    setPageCount((count) => count + 1);
    openCreatedModulePage(page);
  };

  const handleNewDatabase = async () => {
    const { createDatabase } = await loadDatabaseMutationModule();
    const database = await createDatabase({ title: "未命名投研数据库" });
    setDatabaseCount((count) => count + 1);
    openDatabase(database.id);
  };

  const handleStartModule = async (module: PlatformModule) => {
    const starter = module.starter;
    if (!starter) return;
    warmPagePeekModal();
    const { executeModuleStarter } = await loadModuleStarterActions();
    const result = await executeModuleStarter(starter);
    if (result.database) {
      setDatabaseCount((count) => count + 1);
    }
    if (result.page) {
      upsertPages([result.page]);
      setPageCount((count) => count + 1);
      openCreatedModulePage(result.page);
    } else {
      router.push(result.route);
    }
  };

  const handleExportManifest = () => {
    setExportingManifest(true);
    try {
      downloadJsonFile(`zhinote-module-manifest-${fileSafeTimestamp()}.json`, {
        ...moduleManifest,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export module manifest:", err);
      window.alert("Module manifest export failed. Please check the console.");
    } finally {
      setExportingManifest(false);
    }
  };

  const handleExportOnboarding = () => {
    setExportingOnboarding(true);
    try {
      downloadJsonFile(`zhinote-module-onboarding-${fileSafeTimestamp()}.json`, {
        ...moduleOnboarding,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export module onboarding:", err);
      window.alert("Module onboarding export failed. Please check the console.");
    } finally {
      setExportingOnboarding(false);
    }
  };

  const handleExportStarterPack = () => {
    setExportingStarterPack(true);
    try {
      downloadJsonFile(
        `zhinote-module-starter-pack-${fileSafeTimestamp()}.json`,
        {
          ...moduleStarterPack,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export module starter pack:", err);
      window.alert("Module starter pack export failed. Please check the console.");
    } finally {
      setExportingStarterPack(false);
    }
  };

  const handleExportHealth = () => {
    setExportingHealth(true);
    try {
      downloadJsonFile(`zhinote-module-health-${fileSafeTimestamp()}.json`, {
        ...moduleHealth,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export module health:", err);
      window.alert("Module health export failed. Please check the console.");
    } finally {
      setExportingHealth(false);
    }
  };

  const handleExportRoadmap = () => {
    setExportingRoadmap(true);
    try {
      downloadJsonFile(`zhinote-module-roadmap-${fileSafeTimestamp()}.json`, {
        ...moduleRoadmap,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export module roadmap:", err);
      window.alert("Module roadmap export failed. Please check the console.");
    } finally {
      setExportingRoadmap(false);
    }
  };

  const handleExportProgressSnapshot = () => {
    setExportingProgress(true);
    try {
      downloadJsonFile(`zhinote-project-progress-${fileSafeTimestamp()}.json`, {
        ...progressSnapshot,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export project progress snapshot:", err);
      window.alert("项目进度快照导出失败，请查看控制台。");
    } finally {
      setExportingProgress(false);
    }
  };

  const handleModuleDecisionNavigate = (
    decision: ModuleRoadmapReport["decision_summary"]["decisions"][number]
  ) => {
    document
      .getElementById(decision.target_section_id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleProgressSectionOpen = (sectionId: string) => {
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="w-full px-6 py-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 hidden sm:inline-flex">
                <ZhiNoteLogo className="h-11 w-[190px] max-w-full" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                模块化投研平台
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                ZhiNotes 模块中心
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                笔记仍然是底层工作区，每个投研流程都可以作为模块接入，并拥有自己的导航、
                命令、页面块、数据库视图和文件渲染能力。
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                默认语言：{DEFAULT_APP_LANGUAGE_LABEL} ({DEFAULT_APP_LOCALE})
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleNewPage}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
              >
                新建笔记
              </button>
              <button
                type="button"
                onClick={handleNewDatabase}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                新建数据库
              </button>
              <button
                type="button"
                onClick={handleExportManifest}
                disabled={exportingManifest}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {exportingManifest ? "正在导出..." : "导出 manifest"}
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Metric label="页面" value={pageCount} />
          <Metric label="数据库" value={databaseCount} />
          <Metric label="已启用模块" value={activeModules.length} />
          <Metric label="Beta 模块" value={betaModules.length} />
          <Metric label="规划中模块" value={plannedModules.length} />
          <Metric label="稳定入口" value={stableUseModules.length} />
          <Metric label="Owner gate" value={ownerGatedExperimentModules.length} />
        </section>

        <ProjectProgressSnapshotPanel
          snapshot={progressSnapshot}
          exportingProgress={exportingProgress}
          onExportProgress={handleExportProgressSnapshot}
          onOpenRoute={(route) => router.push(route)}
          onOpenSection={handleProgressSectionOpen}
        />

        <ModuleDecisionSummaryPanel
          summary={moduleRoadmap.decision_summary}
          exportingRoadmap={exportingRoadmap}
          exportingOnboarding={exportingOnboarding}
          exportingStarterPack={exportingStarterPack}
          onOpenDecision={handleModuleDecisionNavigate}
          onExportRoadmap={handleExportRoadmap}
          onExportOnboarding={handleExportOnboarding}
          onExportStarterPack={handleExportStarterPack}
        />

        <section
          id="module-roadmap"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                模块接入路线图
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                本地 roadmap contract，把模块分成“本地可用、Beta 强化、规划合同、
                上线阻塞”四条队列。它只读 registry、manifest、onboarding、
                starter pack 和 health metadata，不创建模块、不改 route、不读取页面正文、
                数据库 rows 或文件 bytes。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportRoadmap}
              disabled={exportingRoadmap}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingRoadmap ? "导出中..." : "导出路线图"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <RoadmapMetric
              label="模块"
              value={moduleRoadmap.summary.modules}
              detail="已追踪"
              readiness="ready-local"
            />
            <RoadmapMetric
              label="当前可用"
              value={moduleRoadmap.summary.active_now}
              detail="本地可用"
              readiness="ready-local"
            />
            <RoadmapMetric
              label="Beta"
              value={moduleRoadmap.summary.beta_hardening}
              detail="强化中"
              readiness="needs-hardening"
            />
            <RoadmapMetric
              label="已规划"
              value={moduleRoadmap.summary.planned_contracts}
              detail="仅合同"
              readiness="contract-only"
            />
            <RoadmapMetric
              label="P0 缺口"
              value={moduleRoadmap.summary.p0_gaps}
              detail="上线前"
              readiness="blocked-by-launch-gates"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-2">
              {moduleRoadmap.lanes.map((lane) => (
                <ModuleRoadmapLaneRow key={lane.id} lane={lane} />
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {moduleRoadmap.items.map((item) => (
                <ModuleRoadmapItemRow key={item.module_id} item={item} />
              ))}
            </div>
          </div>
          {moduleRoadmap.gaps.length > 0 && (
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {moduleRoadmap.gaps.map((gap) => (
                <ModuleRoadmapGapRow key={gap.id} gap={gap} />
              ))}
            </div>
          )}
        </section>

        <section
          id="module-manifest"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                模块系统 manifest
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                本地模块合同，只描述模块 id、route、starter、data surfaces
                和 extension slots。导出不会读取页面正文、数据库 rows、文件 bytes
                或任何云端数据。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportManifest}
              disabled={exportingManifest}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingManifest ? "导出中..." : "导出 manifest"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-6">
            <ManifestMetric
              label="模块"
              value={moduleManifest.summary.modules}
              detail="已登记"
            />
            <ManifestMetric
              label="路由"
              value={moduleManifest.summary.routable}
              detail="模块页面"
            />
            <ManifestMetric
              label="启动动作"
              value={moduleManifest.summary.starters}
              detail="本地动作"
            />
            <ManifestMetric
              label="插槽"
              value={moduleManifest.summary.extension_slots}
              detail="扩展点"
            />
            <ManifestMetric
              label="数据面"
              value={moduleManifest.summary.unique_data_surfaces}
              detail="数据合同"
            />
            <ManifestMetric
              label="Gate"
              value={moduleManifest.summary.ready}
              detail={`${moduleManifest.summary.partial} 个部分完成`}
            />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {moduleManifest.gates.map((gate) => (
              <ModuleManifestGateRow key={gate.id} gate={gate} />
            ))}
          </div>
        </section>

        <section
          id="module-health"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                平台目标健康度
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                本地健康度报告，把模块 registry 映射到笔记、数据库、文件报告、公司研究、
                会议、组合、研究图谱、AI 和 Web Beta 目标，显示哪些已经 ready、
                哪些还只是 partial 或 blocked。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportHealth}
              disabled={exportingHealth}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingHealth ? "导出中..." : "导出健康度"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <HealthMetric
              label="目标面"
              value={moduleHealth.summary.areas}
              detail="目标范围"
              status="partial"
            />
            <HealthMetric
              label="就绪"
              value={moduleHealth.summary.ready}
              detail="本地可用"
              status="ready"
            />
            <HealthMetric
              label="部分"
              value={moduleHealth.summary.partial}
              detail="Beta/阶段化"
              status="partial"
            />
            <HealthMetric
              label="阻塞"
              value={moduleHealth.summary.blocked}
              detail="需 gate"
              status="blocked"
            />
            <HealthMetric
              label="模块"
              value={moduleHealth.summary.registry_modules}
              detail="已登记"
              status="ready"
            />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {moduleHealth.areas.map((area) => (
              <ModuleHealthAreaRow key={area.id} area={area} />
            ))}
          </div>
        </section>

        <section
          id="module-onboarding"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                新模块接入清单
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                本地 onboarding 合同，用来约束未来模块必须先声明 registry、
                route、starter、extension slot、data surface、隐私边界和验证命令。
                导出不会创建模块、写入工作区、读取页面正文、数据库 rows 或文件 bytes。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportOnboarding}
              disabled={exportingOnboarding}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingOnboarding ? "导出中..." : "导出接入清单"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <OnboardingMetric
              label="步骤"
              value={moduleOnboarding.summary.steps}
              detail="接入 gate"
              status="ready"
            />
            <OnboardingMetric
              label="就绪"
              value={moduleOnboarding.summary.ready}
              detail="静态合同"
              status="ready"
            />
            <OnboardingMetric
              label="待确认"
              value={moduleOnboarding.summary.manual_confirmation}
              detail="需 owner 审阅"
              status="manual-confirmation"
            />
            <OnboardingMetric
              label="阻塞"
              value={moduleOnboarding.summary.blocked}
              detail="高风险 gate"
              status="blocked"
            />
            <OnboardingMetric
              label="边界"
              value="本地"
              detail="不写入"
              status="manual-confirmation"
            />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {moduleOnboarding.steps.map((step) => (
              <ModuleOnboardingStepRow key={step.id} step={step} />
            ))}
          </div>
        </section>

        <section
          id="module-starter-pack"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                新模块 Starter Pack
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                本地 starter pack，把未来新增模块需要的文件模板、registry
                字段、route、shell、starter、extension slot、数据边界、高风险 gate
                和验证命令放到一个可导出的合同里。导出不会创建文件、创建模块、
                写入工作区、读取页面正文、数据库 rows 或文件 bytes。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportStarterPack}
              disabled={exportingStarterPack}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingStarterPack ? "导出中..." : "导出 Starter Pack"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-6">
            <StarterPackMetric
              label="文件"
              value={moduleStarterPack.summary.files}
              detail="模板"
              status="manual-confirmation"
            />
            <StarterPackMetric
              label="清单"
              value={moduleStarterPack.summary.checklist_items}
              detail="必要步骤"
              status="ready"
            />
            <StarterPackMetric
              label="风险 gate"
              value={moduleStarterPack.summary.risk_gates}
              detail="默认阻塞"
              status="blocked"
            />
            <StarterPackMetric
              label="插槽"
              value={moduleStarterPack.summary.extension_slots}
              detail="接入点"
              status="ready"
            />
            <StarterPackMetric
              label="启动器"
              value={moduleStarterPack.summary.starter_modules}
              detail="当前模块"
              status="ready"
            />
            <StarterPackMetric
              label="阻塞"
              value={moduleStarterPack.summary.blocked}
              detail="需 gate"
              status="blocked"
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                必要文件
              </h3>
              <div className="mt-2 space-y-2">
                {moduleStarterPack.required_files.map((file) => (
                  <ModuleStarterPackFileRow
                    key={file.path_template}
                    file={file}
                  />
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                接入清单
              </h3>
              <div className="mt-2 space-y-2">
                {moduleStarterPack.checklist.map((item) => (
                  <ModuleStarterPackChecklistRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                扩展插槽决策
              </h3>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {moduleStarterPack.extension_slots.map((slot) => (
                  <ModuleStarterPackSlotRow key={slot.slot_id} slot={slot} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                高风险 gate
              </h3>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {moduleStarterPack.risk_gates.map((gate) => (
                  <ModuleStarterPackRiskGateRow key={gate.id} gate={gate} />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              验证命令
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {moduleStarterPack.verification_commands.map((command) => (
                <span
                  key={command}
                  className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {command}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                模块路线图
              </h2>
              <span className="text-xs text-zinc-400">
                {PLATFORM_MODULES.length} 个模块
              </span>
            </div>
            <div
              id="module-stable-use-tier-summary"
              data-testid="module-stable-use-tier-summary"
              data-stable-use-modules={stableUseModules.length}
              data-beta-hardening-modules={betaHardeningModules.length}
              data-owner-gated-experiment-modules={
                ownerGatedExperimentModules.length
              }
              className="mb-3 grid gap-2 text-xs md:grid-cols-3"
            >
              <ModuleUsageTierSummaryCard
                usageTier="stable-use"
                count={stableUseModules.length}
                detail="你日常可以优先使用的入口"
              />
              <ModuleUsageTierSummaryCard
                usageTier="beta-hardening"
                count={betaHardeningModules.length}
                detail="可以试用，但继续打磨体验"
              />
              <ModuleUsageTierSummaryCard
                usageTier="owner-gated-experiment"
                count={ownerGatedExperimentModules.length}
                detail="高风险能力保持关闭"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {STATUS_ORDER.flatMap((status) =>
                getModulesByStatus(status).map((module) => (
                  <ModuleCard
                    key={module.id}
                    module={module}
                    onOpen={
                      module.route
                        ? () => {
                            router.push(module.route as string);
                          }
                        : undefined
                    }
                    onStart={() => void handleStartModule(module)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                扩展插槽
              </h2>
              <div className="mt-3 space-y-3">
                {MODULE_EXTENSION_SLOTS.map((slot) => (
                  <div key={slot.id} className="border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0 dark:border-zinc-800">
                    <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {slot.title}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {slot.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Web Beta 依赖栈
              </h2>
              <ol className="mt-3 space-y-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                <li>1. 先保持本地笔记、数据库、文件和备份稳定。</li>
                <li>2. 再加入登录、云数据库和私有工作区边界。</li>
                <li>3. 然后补齐同步队列、恢复流程和冲突处理。</li>
                <li>4. 最后把公司研究和报告变成一等模块。</li>
              </ol>
            </div>
          </div>
        </section>
      </div>
      </div>
      {peekPageId && (
        <PagePeekModal
          pageId={peekPageId}
          initialPage={peekInitialPage}
          onClose={() => {
            setPeekPageId(null);
            setPeekInitialPage(null);
          }}
          onOpenFull={(id) => {
            setPeekPageId(null);
            setPeekInitialPage(null);
            openModuleFullPageById(id);
          }}
        />
      )}
    </>
  );
}

function ProjectProgressSnapshotPanel({
  snapshot,
  exportingProgress,
  onExportProgress,
  onOpenRoute,
  onOpenSection,
}: {
  snapshot: ProjectProgressSnapshot;
  exportingProgress: boolean;
  onExportProgress: () => void;
  onOpenRoute: (route: string) => void;
  onOpenSection: (sectionId: string) => void;
}) {
  return (
    <section
      id="module-progress-snapshot"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            项目进度快照
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            当前项目进度快照
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {snapshot.current_conclusion}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-zinc-100 px-2 py-1 font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {snapshot.current_stage}
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              {snapshot.summary.routable_modules} 个可打开模块
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              {snapshot.summary.owner_gated_decisions} 个 owner gate
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportProgress}
            disabled={exportingProgress}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {exportingProgress ? "导出中..." : "导出进度快照"}
          </button>
          <button
            type="button"
            onClick={() => onOpenSection("module-health")}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            看健康度
          </button>
          <button
            type="button"
            onClick={() => onOpenSection("module-roadmap")}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            看路线图
          </button>
        </div>
      </div>

      <ProjectStableUsePanel snapshot={snapshot} />

      <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-6">
        <ProjectProgressMetric
          label="就绪目标"
          value={snapshot.summary.ready_areas}
          detail="本地可用"
          status="ready-local"
        />
        <ProjectProgressMetric
          label="部分目标"
          value={snapshot.summary.partial_areas}
          detail="Beta 强化"
          status="beta-hardening"
        />
        <ProjectProgressMetric
          label="阻塞"
          value={snapshot.summary.blocked_areas}
          detail="需 owner gate"
          status="blocked"
        />
        <ProjectProgressMetric
          label="活跃模块"
          value={snapshot.summary.active_modules}
          detail="可稳定试用"
          status="ready-local"
        />
        <ProjectProgressMetric
          label="Beta 模块"
          value={snapshot.summary.beta_modules}
          detail="继续打磨"
          status="beta-hardening"
        />
        <ProjectProgressMetric
          label="上线阻塞"
          value={snapshot.summary.web_launch_blockers}
          detail="上线前处理"
          status="owner-gated"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            阶段状态
          </div>
          {snapshot.phases.map((phase) => (
            <ProjectProgressPhaseRow key={phase.id} phase={phase} />
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            醒来后可试用入口
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {snapshot.trial_routes.map((route) => (
              <ProjectProgressTrialRouteRow
                key={route.module_id}
                route={route}
                onOpen={() => onOpenRoute(route.route)}
              />
            ))}
          </div>
          {snapshot.owner_gate_routes.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                上线前 owner gate
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {snapshot.owner_gate_routes.map((route) => (
                  <ProjectProgressTrialRouteRow
                    key={route.module_id}
                    route={route}
                    onOpen={() => onOpenRoute(route.route)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ProjectProgressList
          title="已完成底座"
          items={snapshot.completed_foundation}
        />
        <ProjectProgressList
          title="继续强化"
          items={snapshot.in_progress_hardening}
        />
        <ProjectProgressList
          title="等 owner 确认"
          items={snapshot.owner_gated_work}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            接下来睡眠时段可继续做
          </div>
          <ul className="mt-2 space-y-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {snapshot.recommended_sleep_run_work.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            本地验证命令
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {snapshot.required_verification_commands.map((command) => (
              <span
                key={command}
                className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {command}
              </span>
            ))}
          </div>
          <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
            进度快照只读模块 metadata、页面数量和数据库数量，不读取正文、row value
            或文件 bytes。
          </p>
        </div>
      </div>

      {snapshot.blockers.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.blockers.map((blocker) => (
            <ProjectProgressBlockerRow key={blocker.id} blocker={blocker} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectStableUsePanel({
  snapshot,
}: {
  snapshot: ProjectProgressSnapshot;
}) {
  const stableUse = snapshot.stable_use_status;
  const toneClass =
    stableUse.status === "can-use-now"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
      : stableUse.status === "use-with-care"
        ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        : "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950 dark:text-red-100";

  return (
    <section
      data-testid="project-stable-use-status"
      data-stable-use-status={stableUse.status}
      data-user-can-keep-working={stableUse.user_can_keep_working}
      data-web-beta-can-launch-now={stableUse.web_beta_can_launch_now}
      data-cloud-sync-can-start-now={stableUse.cloud_sync_can_start_now}
      className={`mt-4 rounded-lg border px-4 py-3 ${toneClass}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-70">
            稳定使用状态
          </p>
          <h3 className="mt-1 text-base font-semibold">{stableUse.label}</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 opacity-80">
            {stableUse.detail}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-md bg-white/70 px-2 py-1 dark:bg-black/20">
            输入策略：本地优先
          </span>
          <span className="rounded-md bg-white/70 px-2 py-1 dark:bg-black/20">
            Web Beta：未批准上线
          </span>
          <span className="rounded-md bg-white/70 px-2 py-1 dark:bg-black/20">
            云同步：需确认
          </span>
        </div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md bg-white/60 px-3 py-2 text-xs dark:bg-black/20">
          <div className="font-semibold">当前可用入口</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {stableUse.stable_entrypoints.map((entrypoint) => (
              <span
                key={entrypoint}
                className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
              >
                {entrypoint}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-md bg-white/60 px-3 py-2 text-xs dark:bg-black/20">
          <div className="font-semibold">保护边界</div>
          <ul className="mt-2 space-y-1 leading-5 opacity-80">
            {stableUse.protected_boundaries.slice(0, 4).map((boundary) => (
              <li key={boundary}>{boundary}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 opacity-80">
        下一步：{stableUse.next_safe_action}
      </p>
    </section>
  );
}

function ProjectProgressMetric({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: ProjectProgressStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <ProjectProgressStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function ProjectProgressPhaseRow({
  phase,
}: {
  phase: ProjectProgressSnapshot["phases"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {phase.title}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {phase.module_ids.map((moduleId) => (
              <span
                key={moduleId}
                className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {moduleId}
              </span>
            ))}
          </div>
        </div>
        <ProjectProgressStatusPill status={phase.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {phase.evidence}
      </p>
    </article>
  );
}

function ProjectProgressTrialRouteRow({
  route,
  onOpen,
}: {
  route: ProjectProgressSnapshot["trial_routes"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
            {route.title}
          </div>
          <div className="mt-1 font-mono text-[11px] text-zinc-400">
            {route.route}
          </div>
        </div>
        <ProjectProgressStatusPill status={route.readiness} />
      </div>
      <p className="mt-2 line-clamp-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {route.recommended_test}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        打开试用
      </button>
    </article>
  );
}

function ProjectProgressList({
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
      <ul className="mt-2 space-y-1 leading-5 text-zinc-500 dark:text-zinc-400">
        {items.slice(0, 5).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function ProjectProgressBlockerRow({
  blocker,
}: {
  blocker: ProjectProgressSnapshot["blockers"][number];
}) {
  return (
    <article className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900 dark:bg-amber-950">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-amber-900 dark:text-amber-100">
          {blocker.title}
        </div>
        <ProjectProgressStatusPill status={blocker.status} />
      </div>
      <p className="mt-2 leading-5 text-amber-700 dark:text-amber-200">
        {blocker.evidence}
      </p>
      <p className="mt-2 border-t border-amber-100 pt-2 leading-5 text-amber-700 dark:border-amber-900 dark:text-amber-200">
        {blocker.next_action}
      </p>
    </article>
  );
}

function ProjectProgressStatusPill({
  status,
}: {
  status: ProjectProgressStatus;
}) {
  const labels: Record<ProjectProgressStatus, string> = {
    "ready-local": "本地就绪",
    "beta-hardening": "强化中",
    "owner-gated": "需确认",
    blocked: "阻塞",
  };

  const className =
    status === "ready-local"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "beta-hardening"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : status === "owner-gated"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function ModuleDecisionSummaryPanel({
  summary,
  exportingRoadmap,
  exportingOnboarding,
  exportingStarterPack,
  onOpenDecision,
  onExportRoadmap,
  onExportOnboarding,
  onExportStarterPack,
}: {
  summary: ModuleRoadmapReport["decision_summary"];
  exportingRoadmap: boolean;
  exportingOnboarding: boolean;
  exportingStarterPack: boolean;
  onOpenDecision: (
    decision: ModuleRoadmapReport["decision_summary"]["decisions"][number]
  ) => void;
  onExportRoadmap: () => void;
  onExportOnboarding: () => void;
  onExportStarterPack: () => void;
}) {
  return (
    <section
      id="module-decision-summary"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            模块决策摘要
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            新模块接入决策摘要
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {summary.current_conclusion}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportRoadmap}
            disabled={exportingRoadmap}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {exportingRoadmap ? "导出中..." : "导出路线图"}
          </button>
          <button
            type="button"
            onClick={onExportOnboarding}
            disabled={exportingOnboarding}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {exportingOnboarding ? "导出中..." : "导出接入清单"}
          </button>
          <button
            type="button"
            onClick={onExportStarterPack}
            disabled={exportingStarterPack}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {exportingStarterPack ? "导出中..." : "导出 Starter Pack"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {summary.decisions.map((decision) => (
          <ModuleDecisionCard
            key={decision.id}
            decision={decision}
            onOpen={() => onOpenDecision(decision)}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ModuleDecisionList title="当前可做" items={summary.safe_local_work} />
        <ModuleDecisionList title="保持关闭" items={summary.blocked_work} />
        <ModuleDecisionList
          title="Owner 待确认"
          items={summary.required_owner_decisions}
        />
      </div>

      <div className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        决策摘要只读取 registry、manifest、onboarding、starter pack 和 health
        metadata；不会创建模块、写入工作区、读取页面正文、数据库 rows 或文件
        bytes。
      </div>
    </section>
  );
}

function ModuleDecisionCard({
  decision,
  onOpen,
}: {
  decision: ModuleRoadmapReport["decision_summary"]["decisions"][number];
  onOpen: () => void;
}) {
  return (
    <article className="flex min-h-[220px] flex-col justify-between rounded-md border border-zinc-100 p-3 text-xs dark:border-zinc-800">
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
          <ModuleDecisionStatusPill status={decision.status} />
        </div>
        <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
          {decision.evidence}
        </p>
      </div>
      <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <p className="leading-5 text-zinc-400 dark:text-zinc-500">
          {decision.next_action}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          打开对应区域
        </button>
      </div>
    </article>
  );
}

function ModuleDecisionList({
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
      <ul className="mt-2 space-y-1 leading-5 text-zinc-500 dark:text-zinc-400">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function ModuleDecisionStatusPill({
  status,
}: {
  status: ModuleRoadmapReport["decision_summary"]["decisions"][number]["status"];
}) {
  const labels: Record<
    ModuleRoadmapReport["decision_summary"]["decisions"][number]["status"],
    string
  > = {
    "available-local": "本地可做",
    "requires-owner-confirmation": "需确认",
    blocked: "阻塞",
  };
  const className =
    status === "available-local"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "requires-owner-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
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

function ManifestMetric({
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

function OnboardingMetric({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: ModuleOnboardingStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <ModuleOnboardingStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function HealthMetric({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: ModuleHealthStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <ModuleHealthStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function RoadmapMetric({
  label,
  value,
  detail,
  readiness,
}: {
  label: string;
  value: number | string;
  detail: string;
  readiness: ModuleRoadmapReadiness;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <ModuleRoadmapReadinessPill readiness={readiness} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function ModuleRoadmapLaneRow({
  lane,
}: {
  lane: ModuleRoadmapReport["lanes"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {lane.title}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            {lane.module_count} 个模块 ·{" "}
            {lane.owner_decision_required ? "owner 审阅" : "本地构建"}
          </div>
        </div>
        <ModuleRoadmapReadinessPill readiness={lane.readiness} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {lane.module_ids.map((moduleId) => (
          <span
            key={moduleId}
            className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {moduleId}
          </span>
        ))}
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {lane.next_action}
      </p>
    </article>
  );
}

function ModuleRoadmapItemRow({
  item,
}: {
  item: ModuleRoadmapReport["items"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
            {item.title}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            {item.module_id} · {item.starter_type ?? "无启动器"}
          </div>
        </div>
        <ModuleRoadmapReadinessPill readiness={item.readiness} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {item.acceptance_gates.slice(0, 5).map((gate) => (
          <span
            key={gate}
            className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {gate}
          </span>
        ))}
      </div>
      <p className="mt-2 line-clamp-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {item.next_action}
      </p>
    </article>
  );
}

function ModuleRoadmapGapRow({
  gap,
}: {
  gap: ModuleRoadmapReport["gaps"][number];
}) {
  return (
    <article className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900 dark:bg-amber-950">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-amber-900 dark:text-amber-100">
          {gap.title}
        </div>
        <span className="shrink-0 rounded bg-white px-2 py-1 text-[10px] text-amber-700 dark:bg-amber-900 dark:text-amber-100">
          {gap.severity}
        </span>
      </div>
      <p className="mt-2 leading-5 text-amber-700 dark:text-amber-200">
        {gap.evidence}
      </p>
      <p className="mt-2 border-t border-amber-100 pt-2 leading-5 text-amber-700 dark:border-amber-900 dark:text-amber-200">
        {gap.required_action}
      </p>
    </article>
  );
}

function ModuleRoadmapReadinessPill({
  readiness,
}: {
  readiness: ModuleRoadmapReadiness;
}) {
  const labels: Record<ModuleRoadmapReadiness, string> = {
    "ready-local": "本地就绪",
    "needs-hardening": "强化中",
    "contract-only": "仅合同",
    "blocked-by-launch-gates": "阻塞",
  };

  const className =
    readiness === "ready-local"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : readiness === "needs-hardening"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : readiness === "contract-only"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[readiness]}
    </span>
  );
}

function ModuleHealthAreaRow({
  area,
}: {
  area: ModuleHealthReport["areas"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {area.title}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {area.phase}
            </span>
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800">
              {area.module_ids.join(", ")}
            </span>
          </div>
        </div>
        <ModuleHealthStatusPill status={area.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {area.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {area.next_action}
      </p>
    </article>
  );
}

function ModuleHealthStatusPill({
  status,
}: {
  status: ModuleHealthStatus;
}) {
  const labels: Record<ModuleHealthStatus, string> = {
    ready: "就绪",
    partial: "部分",
    blocked: "阻塞",
  };

  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "partial"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function ModuleOnboardingStepRow({
  step,
}: {
  step: ModuleOnboardingContract["steps"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {step.title}
          </div>
          <div className="mt-1 text-[11px] uppercase text-zinc-400">
            {step.phase}
          </div>
        </div>
        <ModuleOnboardingStatusPill status={step.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {step.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {step.required_action}
      </p>
    </article>
  );
}

function ModuleOnboardingStatusPill({
  status,
}: {
  status: ModuleOnboardingStatus;
}) {
  const labels: Record<ModuleOnboardingStatus, string> = {
    ready: "就绪",
    "manual-confirmation": "待确认",
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

function StarterPackMetric({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: ModuleStarterPackStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <ModuleStarterPackStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function ModuleStarterPackFileRow({
  file,
}: {
  file: ModuleStarterPackContract["required_files"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {file.path_template}
          </div>
          <div className="mt-1 text-[10px] uppercase text-zinc-400">
            {file.item_type}
          </div>
        </div>
        <ModuleStarterPackStatusPill status={file.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {file.required_for}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {file.privacy_boundary}
      </p>
    </article>
  );
}

function ModuleStarterPackChecklistRow({
  item,
}: {
  item: ModuleStarterPackContract["checklist"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {item.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {item.id} · {item.item_type}
          </div>
        </div>
        <ModuleStarterPackStatusPill status={item.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {item.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {item.required_action}
      </p>
    </article>
  );
}

function ModuleStarterPackSlotRow({
  slot,
}: {
  slot: ModuleStarterPackContract["extension_slots"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
        {slot.title}
      </div>
      <div className="mt-1 font-mono text-[10px] text-zinc-400">
        {slot.slot_id}
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {slot.required_decision}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {slot.current_module_ids.slice(0, 5).map((moduleId) => (
          <span
            key={moduleId}
            className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {moduleId}
          </span>
        ))}
      </div>
    </article>
  );
}

function ModuleStarterPackRiskGateRow({
  gate,
}: {
  gate: ModuleStarterPackContract["risk_gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {gate.title}
        </div>
        <ModuleStarterPackStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.trigger}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_before_enablement}
      </p>
    </article>
  );
}

function ModuleStarterPackStatusPill({
  status,
}: {
  status: ModuleStarterPackStatus;
}) {
  const labels: Record<ModuleStarterPackStatus, string> = {
    ready: "就绪",
    "manual-confirmation": "待确认",
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

function ModuleManifestGateRow({
  gate,
}: {
  gate: ModuleManifestReport["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {gate.title}
        </div>
        <ModuleManifestGatePill status={gate.status} />
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

function ModuleManifestGatePill({
  status,
}: {
  status: ModuleManifestGateStatus;
}) {
  const labels: Record<ModuleManifestGateStatus, string> = {
    ready: "就绪",
    partial: "部分",
    blocked: "阻塞",
  };

  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "partial"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function ModuleCard({
  module,
  onOpen,
  onStart,
}: {
  module: PlatformModule;
  onOpen?: () => void;
  onStart: () => void;
}) {
  const statusLabel = getModuleStatusLabel(module.status);
  const usageTierLabel = getModuleUsageTierLabel(module.usageTier);

  return (
    <article
      data-module-id={module.id}
      data-module-status={module.status}
      data-module-usage-tier={module.usageTier}
      className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {module.icon}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {module.title}
            </h3>
            <p className="text-xs text-zinc-400">
              {getModuleCategoryLabel(module.category)}
            </p>
          </div>
        </div>
        <span
          className={`rounded-md px-2 py-1 text-[10px] font-medium ${
            module.status === "active"
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : module.status === "beta"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {statusLabel}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ModuleUsageTierPill usageTier={module.usageTier} />
        <span className="text-[11px] text-zinc-400">
          {usageTierLabel} · 开发期风险层
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {module.description}
      </p>
      <div className="mt-3 grid gap-2 text-xs">
        <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
          <div className="font-semibold text-zinc-800 dark:text-zinc-100">
            稳定使用说明
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {module.stableUseNote}
          </p>
        </div>
        <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
          <div className="font-semibold text-zinc-800 dark:text-zinc-100">
            开发边界
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {module.developmentBoundary}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {module.capabilities.slice(0, 4).map((capability) => (
          <span
            key={capability}
            className="rounded bg-zinc-100 px-1.5 py-1 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {capability}
          </span>
        ))}
      </div>
      {(onOpen || module.starter) && (
        <div className="mt-3 grid gap-2">
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              className="w-full rounded-md bg-zinc-900 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
            >
              打开模块
            </button>
          )}
          {module.starter && (
            <button
              type="button"
              onClick={onStart}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {module.starter.label}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function ModuleUsageTierSummaryCard({
  usageTier,
  count,
  detail,
}: {
  usageTier: ModuleUsageTier;
  count: number;
  detail: string;
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-zinc-400">
          {getModuleUsageTierLabel(usageTier)}
        </div>
        <ModuleUsageTierPill usageTier={usageTier} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {count}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </article>
  );
}

function ModuleUsageTierPill({
  usageTier,
}: {
  usageTier: ModuleUsageTier;
}) {
  const className =
    usageTier === "stable-use"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : usageTier === "beta-hardening"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {getModuleUsageTierLabel(usageTier)}
    </span>
  );
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
