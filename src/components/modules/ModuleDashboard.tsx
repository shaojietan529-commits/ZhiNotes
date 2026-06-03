"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createDatabase, createPage, getAllDatabases } from "@/lib/db/local/queries";
import { usePages } from "@/hooks/usePages";
import {
  MODULE_EXTENSION_SLOTS,
  PLATFORM_MODULES,
  getModuleCategoryLabel,
  getModuleStatusLabel,
  getModulesByStatus,
  type ModuleStatus,
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
import { executeModuleStarter } from "@/lib/modules/actions";
import {
  DEFAULT_APP_LANGUAGE_LABEL,
  DEFAULT_APP_LOCALE,
} from "@/lib/i18n/platformLanguage";
import type { Database } from "@/lib/utils/types";

const STATUS_ORDER: ModuleStatus[] = ["active", "beta", "planned"];

export default function ModuleDashboard() {
  const router = useRouter();
  const { pages, refresh } = usePages();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [exportingManifest, setExportingManifest] = useState(false);
  const [exportingOnboarding, setExportingOnboarding] = useState(false);
  const activeModules = useMemo(() => getModulesByStatus("active"), []);
  const betaModules = useMemo(() => getModulesByStatus("beta"), []);
  const plannedModules = useMemo(() => getModulesByStatus("planned"), []);
  const moduleManifest = useMemo(() => buildModuleManifestReport(), []);
  const moduleOnboarding = useMemo(() => buildModuleOnboardingContract(), []);

  useEffect(() => {
    void getAllDatabases()
      .then(setDatabases)
      .catch((err) => {
        console.error("[Zhinote] Failed to load module dashboard databases:", err);
      });
  }, []);

  const handleNewPage = async () => {
    const page = await createPage({ title: "未命名研究笔记" });
    await refresh();
    router.push(`/page/${page.id}`);
  };

  const handleNewDatabase = async () => {
    const database = await createDatabase({ title: "未命名投研数据库" });
    setDatabases((current) => [database, ...current]);
    router.push(`/database/${database.id}`);
  };

  const handleStartModule = async (module: PlatformModule) => {
    const starter = module.starter;
    if (!starter) return;
    const result = await executeModuleStarter(starter);
    if (result.database) {
      setDatabases((current) => [result.database as Database, ...current]);
    }
    await refresh();
    router.push(result.route);
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

  return (
    <div className="w-full px-6 py-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
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

        <section className="grid gap-3 md:grid-cols-5">
          <Metric label="页面" value={pages.length} />
          <Metric label="数据库" value={databases.length} />
          <Metric label="已启用模块" value={activeModules.length} />
          <Metric label="Beta 模块" value={betaModules.length} />
          <Metric label="规划中模块" value={plannedModules.length} />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
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
              {exportingManifest ? "Exporting..." : "Export manifest"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-6">
            <ManifestMetric
              label="Modules"
              value={moduleManifest.summary.modules}
              detail="Registered"
            />
            <ManifestMetric
              label="Routes"
              value={moduleManifest.summary.routable}
              detail="Module pages"
            />
            <ManifestMetric
              label="Starters"
              value={moduleManifest.summary.starters}
              detail="Local actions"
            />
            <ManifestMetric
              label="Slots"
              value={moduleManifest.summary.extension_slots}
              detail="Extension points"
            />
            <ManifestMetric
              label="Surfaces"
              value={moduleManifest.summary.unique_data_surfaces}
              detail="Data contracts"
            />
            <ManifestMetric
              label="Gates"
              value={moduleManifest.summary.ready}
              detail={`${moduleManifest.summary.partial} partial`}
            />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {moduleManifest.gates.map((gate) => (
              <ModuleManifestGateRow key={gate.id} gate={gate} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
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
              {exportingOnboarding ? "Exporting..." : "Export onboarding"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <OnboardingMetric
              label="Steps"
              value={moduleOnboarding.summary.steps}
              detail="Onboarding gates"
              status="ready"
            />
            <OnboardingMetric
              label="Ready"
              value={moduleOnboarding.summary.ready}
              detail="Static contracts"
              status="ready"
            />
            <OnboardingMetric
              label="Confirm"
              value={moduleOnboarding.summary.manual_confirmation}
              detail="Needs owner review"
              status="manual-confirmation"
            />
            <OnboardingMetric
              label="Blocked"
              value={moduleOnboarding.summary.blocked}
              detail="High-risk gates"
              status="blocked"
            />
            <OnboardingMetric
              label="Boundary"
              value="Local"
              detail="No writes"
              status="manual-confirmation"
            />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {moduleOnboarding.steps.map((step) => (
              <ModuleOnboardingStepRow key={step.id} step={step} />
            ))}
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
    ready: "Ready",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
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
    ready: "Ready",
    partial: "Partial",
    blocked: "Blocked",
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

  return (
    <article className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
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
      <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {module.description}
      </p>
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
