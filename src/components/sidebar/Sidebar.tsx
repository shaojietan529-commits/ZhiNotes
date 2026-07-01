"use client";

import {
  useCallback,
  useRef,
  useState,
  useEffect,
  type PointerEvent,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { useLocalFirstDatabaseNavigation } from "@/hooks/useLocalFirstDatabaseNavigation";
import { useLocalFirstModuleNavigation } from "@/hooks/useLocalFirstModuleNavigation";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useDatabases } from "@/hooks/useDatabases";
import LazyQuickSearch from "./LazyQuickSearch";
import PageTree from "./PageTree";
import TrashPages from "./TrashPages";
import FavoritePages from "./FavoritePages";
import { PLATFORM_MODULES } from "@/lib/modules/registry";
import { MODULE_WORKSPACE_LIST } from "@/lib/pages/moduleWorkspaces";
import { ZhiNoteLogo, ZhiNoteMark } from "@/components/brand/ZhiNoteLogo";
import {
  useAccountCloudSyncCoordinator,
  type AccountCloudSyncCoordinatorState,
} from "@/hooks/useAccountCloudSyncCoordinator";
import { useHotCacheRouteWarmup } from "@/hooks/useHotCacheRouteWarmup";
import {
  getWorkspaceSetting,
  upsertWorkspaceSetting,
  type WorkspaceSettingRecord,
} from "@/lib/db/local/queries";
import {
  ACCOUNT_PROFILE_UPDATED_EVENT,
} from "@/lib/account/clientProfile";
import {
  ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY,
  fetchAccountSession,
  getLastAuthenticatedAccount,
} from "@/lib/account/clientSession";
import {
  SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY,
  SIDEBAR_PRIMARY_ORDER_SETTING_KEY,
} from "@/lib/sync/sidebarWorkspaceSettings";

const SIDEBAR_PRIMARY_ORDER_KEY = SIDEBAR_PRIMARY_ORDER_SETTING_KEY;
const SIDEBAR_PRIMARY_CUSTOMIZATION_KEY =
  SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY;
const SIDEBAR_PRIMARY_ORDER_LOCAL_CACHE_KEY = "zhinote.sidebar.primaryOrder.v1";
const SIDEBAR_PRIMARY_CUSTOMIZATION_LOCAL_CACHE_KEY =
  "zhinote.sidebar.primaryCustomization.v1";

interface SidebarPrimaryItem {
  id: string;
  href: string;
  icon: string;
  label: string;
}

interface SidebarPrimaryPointerDrag {
  itemId: string;
  pointerId: number;
  startX: number;
  startY: number;
  hasMoved: boolean;
}

interface SidebarPrimaryCustomization {
  icon?: string;
  label?: string;
}

const DEFAULT_PRIMARY_ITEMS: SidebarPrimaryItem[] = [
  ...MODULE_WORKSPACE_LIST.map((workspace) => ({
    id: workspace.key,
    href: workspace.route,
    icon: workspace.icon,
    label: workspace.label,
  })),
  {
    id: "portfolio",
    href: "/portfolio",
    icon: "💼",
    label: "组合管理",
  },
];

function getAccountSyncShortLabel(state: AccountCloudSyncCoordinatorState) {
  switch (state) {
    case "checking":
      return "检查中";
    case "syncing":
      return "同步中";
    case "queued":
      return "待上传";
    case "attention":
      return "需处理";
    case "signed-out":
      return "未登录";
    case "error":
      return "重试中";
    case "disabled":
      return "未开启";
    case "synced":
    default:
      return "已同步";
  }
}

function getAccountSyncIcon(state: AccountCloudSyncCoordinatorState) {
  switch (state) {
    case "checking":
    case "syncing":
      return "⏳";
    case "queued":
      return "⬆️";
    case "attention":
    case "error":
      return "⚠️";
    case "signed-out":
      return "🔒";
    case "disabled":
      return "☁️";
    case "synced":
    default:
      return "☁️";
  }
}

function getAccountSyncToneClass(state: AccountCloudSyncCoordinatorState) {
  switch (state) {
    case "checking":
    case "syncing":
      return "border-blue-500/20 bg-blue-500/10 text-blue-700 hover:bg-blue-500/15 dark:text-blue-300";
    case "queued":
      return "border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300";
    case "attention":
    case "error":
      return "border-red-500/25 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-300";
    case "signed-out":
      return "border-zinc-300 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800";
    case "disabled":
      return "border-zinc-200 text-zinc-400 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-900";
    case "synced":
    default:
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300";
  }
}

function getAccountSyncCenterTarget(accountSync: {
  failedTotal: number;
  manualReviewTotal: number;
  pagePendingTotal: number;
  databasePendingTotal: number;
  settingsPendingTotal: number;
  knowledgePendingTotal: number;
}) {
  if (accountSync.failedTotal > 0 || accountSync.manualReviewTotal > 0) {
    return "/modules/sync#sync-upload-safety-panel";
  }
  if (accountSync.pagePendingTotal > 0) {
    return "/modules/sync#page-pending-upload-queue";
  }
  if (accountSync.databasePendingTotal > 0) {
    return "/modules/sync#database-pending-upload-queue";
  }
  if (accountSync.knowledgePendingTotal > 0) {
    return "/modules/sync#knowledge-replay-batch-plan";
  }
  if (accountSync.settingsPendingTotal > 0) {
    return "/modules/sync#account-module-settings-pending-plan";
  }
  return "/modules/sync#sync-upload-safety-panel";
}

function getLastKnownAccountLabel() {
  return getLastAuthenticatedAccount()?.display_name || "账号";
}

function normalizePrimaryIcon(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, 8) || fallback;
}

function normalizePrimaryLabel(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.trim().replace(/\s+/g, " ").slice(0, 24) || fallback;
}

function parseSidebarPrimaryCustomizations(
  value: unknown
): Record<string, SidebarPrimaryCustomization> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const parsed: Record<string, SidebarPrimaryCustomization> = {};
  const defaults = new Map(DEFAULT_PRIMARY_ITEMS.map((item) => [item.id, item]));
  for (const [id, customization] of Object.entries(value)) {
    const fallback = defaults.get(id);
    if (
      !fallback ||
      !customization ||
      typeof customization !== "object" ||
      Array.isArray(customization)
    ) {
      continue;
    }
    parsed[id] = {
      icon: normalizePrimaryIcon(
        (customization as SidebarPrimaryCustomization).icon,
        fallback.icon
      ),
      label: normalizePrimaryLabel(
        (customization as SidebarPrimaryCustomization).label,
        fallback.label
      ),
    };
  }
  return parsed;
}

function applySidebarPrimaryCustomizations(
  items: SidebarPrimaryItem[],
  customizations: Record<string, SidebarPrimaryCustomization>
): SidebarPrimaryItem[] {
  return items.map((item) => {
    const customization = customizations[item.id];
    if (!customization) return item;
    return {
      ...item,
      icon: normalizePrimaryIcon(customization.icon, item.icon),
      label: normalizePrimaryLabel(customization.label, item.label),
    };
  });
}

function applySidebarPrimaryOrder(
  order: unknown,
  customizations: Record<string, SidebarPrimaryCustomization> = {}
): SidebarPrimaryItem[] {
  const byId = new Map(DEFAULT_PRIMARY_ITEMS.map((item) => [item.id, item]));
  const ordered: SidebarPrimaryItem[] = [];
  if (Array.isArray(order)) {
    for (const id of order) {
      if (typeof id !== "string") continue;
      const item = byId.get(id);
      if (!item || ordered.some((existing) => existing.id === item.id)) {
        continue;
      }
      ordered.push(item);
    }
  }
  for (const item of DEFAULT_PRIMARY_ITEMS) {
    if (!ordered.some((existing) => existing.id === item.id)) {
      ordered.push(item);
    }
  }
  return applySidebarPrimaryCustomizations(ordered, customizations);
}

function moveSidebarPrimaryItem(
  items: SidebarPrimaryItem[],
  draggedId: string,
  targetId: string
): SidebarPrimaryItem[] {
  if (draggedId === targetId) return items;
  const draggedIndex = items.findIndex((item) => item.id === draggedId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return items;
  const next = [...items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  return next;
}

function safeJsonParse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readWorkspaceSettingValue(
  setting: WorkspaceSettingRecord | null
): unknown {
  return safeJsonParse(setting?.valueJson ?? null);
}

function parseSidebarPrimaryOrderPayload(value: unknown): string[] | null {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { order?: unknown; primaryOrder?: unknown }).order ??
        (value as { order?: unknown; primaryOrder?: unknown }).primaryOrder
      : value;
  if (!Array.isArray(candidate)) return null;
  return candidate.filter((item): item is string => typeof item === "string");
}

function parseSidebarPrimaryCustomizationPayload(
  value: unknown
): Record<string, SidebarPrimaryCustomization> {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { customizations?: unknown; primaryCustomizations?: unknown })
          .customizations ??
        (value as { customizations?: unknown; primaryCustomizations?: unknown })
          .primaryCustomizations ??
        value
      : value;
  return parseSidebarPrimaryCustomizations(candidate);
}

function readSidebarPrimaryLocalCache() {
  if (typeof window === "undefined") {
    return {
      hasOrder: false,
      hasCustomizations: false,
      order: null,
      customizations: {},
    };
  }
  const orderRaw = window.localStorage.getItem(
    SIDEBAR_PRIMARY_ORDER_LOCAL_CACHE_KEY
  );
  const customizationRaw = window.localStorage.getItem(
    SIDEBAR_PRIMARY_CUSTOMIZATION_LOCAL_CACHE_KEY
  );
  return {
    hasOrder: Boolean(orderRaw),
    hasCustomizations: Boolean(customizationRaw),
    order: parseSidebarPrimaryOrderPayload(safeJsonParse(orderRaw)),
    customizations: parseSidebarPrimaryCustomizationPayload(
      safeJsonParse(customizationRaw)
    ),
  };
}

function writeSidebarPrimaryOrderLocalCache(order: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SIDEBAR_PRIMARY_ORDER_LOCAL_CACHE_KEY,
    JSON.stringify(order)
  );
}

function writeSidebarPrimaryCustomizationsLocalCache(
  customizations: Record<string, SidebarPrimaryCustomization>
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SIDEBAR_PRIMARY_CUSTOMIZATION_LOCAL_CACHE_KEY,
    JSON.stringify(customizations)
  );
}

async function persistSidebarPrimaryOrder(items: SidebarPrimaryItem[]) {
  const order = items.map((item) => item.id);
  writeSidebarPrimaryOrderLocalCache(order);
  await upsertWorkspaceSetting(
    SIDEBAR_PRIMARY_ORDER_KEY,
    {
      schema_version: 1,
      order,
      cloud_target: "workspaces.settings.sidebar_primary_order",
      local_cache_key: SIDEBAR_PRIMARY_ORDER_LOCAL_CACHE_KEY,
      ordinary_sync_pending_only: true,
    },
    "sidebar-primary-ui"
  );
}

async function persistSidebarPrimaryCustomizations(
  customizations: Record<string, SidebarPrimaryCustomization>
) {
  const normalized = parseSidebarPrimaryCustomizations(customizations);
  writeSidebarPrimaryCustomizationsLocalCache(normalized);
  await upsertWorkspaceSetting(
    SIDEBAR_PRIMARY_CUSTOMIZATION_KEY,
    {
      schema_version: 1,
      customizations: normalized,
      cloud_target: "workspaces.settings.sidebar_primary_customization",
      local_cache_key: SIDEBAR_PRIMARY_CUSTOMIZATION_LOCAL_CACHE_KEY,
      ordinary_sync_pending_only: true,
    },
    "sidebar-primary-ui"
  );
}

export default function Sidebar() {
  useHotCacheRouteWarmup();
  const { databases, refresh: refreshDatabases } = useDatabases();
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const openPage = useLocalFirstPageNavigation();
  const openDatabase = useLocalFirstDatabaseNavigation();
  const { openModuleRoute, warmModuleRoute } = useLocalFirstModuleNavigation();
  const [backupRunning, setBackupRunning] = useState(false);
  const [markdownExportRunning, setMarkdownExportRunning] = useState(false);
  const [zipExportRunning, setZipExportRunning] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [accountLabel, setAccountLabel] = useState(getLastKnownAccountLabel);
  const [primaryItems, setPrimaryItems] = useState(DEFAULT_PRIMARY_ITEMS);
  const [draggedPrimaryId, setDraggedPrimaryId] = useState<string | null>(null);
  const [primaryCustomizations, setPrimaryCustomizations] = useState<
    Record<string, SidebarPrimaryCustomization>
  >({});
  const [editingPrimaryItem, setEditingPrimaryItem] = useState<{
    id: string;
    icon: string;
    label: string;
  } | null>(null);
  const primaryPointerDragRef = useRef<SidebarPrimaryPointerDrag | null>(null);
  const suppressPrimaryClickRef = useRef(false);
  const accountSync = useAccountCloudSyncCoordinator();
  const { pageSync, databaseSync } = accountSync;
  const sidebarModules = PLATFORM_MODULES.filter(
    (module) => module.route && module.route !== "/"
  );
  const pageSyncPendingTotal =
    pageSync.pendingStatus.pending + pageSync.pendingStatus.queued;
  const databaseSyncPendingTotal =
    databaseSync.pendingStatus.pending +
    databaseSync.pendingStatus.queued +
    databaseSync.pendingStatus.syncLogPending;
  const pageSyncTitle =
    pageSync.pendingStatus.failed > 0
      ? `页面同步：${pageSync.pendingStatus.failed} 个待重试；打开同步中心查看最近失败原因`
      : pageSyncPendingTotal > 0
      ? `页面同步：${pageSyncPendingTotal} 个待上传；普通同步只补传 pending queue`
      : pageSync.state === "synced"
        ? `页面已同步${
            pageSync.lastSyncAt
              ? ` · ${new Date(pageSync.lastSyncAt).toLocaleTimeString("zh-CN")}`
              : ""
          }`
        : pageSync.state === "syncing"
          ? "页面同步中…"
          : pageSync.state === "signed-out"
            ? "页面同步：未登录"
            : pageSync.state === "disabled" && pageSync.pendingStatus.enabled
              ? "页面同步：已开启，等待后台检查"
              : pageSync.state === "disabled"
              ? "页面同步未开启"
              : "页面同步：账号或网络暂不可确认，已保留本地输入，稍后重试";
  const databaseSyncTitle =
    databaseSync.pendingStatus.failed > 0
      ? `数据库同步：${databaseSync.pendingStatus.failed} 条待重试；打开同步中心查看最近失败原因`
      : databaseSyncPendingTotal > 0
      ? `数据库同步：${databaseSyncPendingTotal} 条待上传；普通同步只补传 pending queue`
      : databaseSync.state === "synced"
        ? `数据库已同步${
            databaseSync.lastSyncAt
              ? ` · ${new Date(databaseSync.lastSyncAt).toLocaleTimeString("zh-CN")}`
              : ""
          }`
        : databaseSync.state === "syncing"
          ? "数据库同步中…"
          : databaseSync.state === "signed-out"
            ? "数据库同步：未登录"
            : databaseSync.state === "disabled" &&
                databaseSync.pendingStatus.enabled
              ? "数据库同步：已开启，等待后台检查"
              : databaseSync.state === "disabled"
              ? "数据库同步未开启"
              : "数据库同步：账号或网络暂不可确认，已保留本地输入，稍后重试";
  const accountSyncTitle = `${accountSync.title}\n${pageSyncTitle}\n${databaseSyncTitle}`;
  const accountSyncShortLabel = getAccountSyncShortLabel(accountSync.state);
  const accountSyncIcon = getAccountSyncIcon(accountSync.state);
  const accountSyncToneClass = getAccountSyncToneClass(accountSync.state);
  const accountSyncNeedsSyncCenter =
    accountSync.failedTotal > 0 ||
    accountSync.manualReviewTotal > 0 ||
    accountSync.pagePendingTotal > 0 ||
    accountSync.databasePendingTotal > 0 ||
    accountSync.settingsPendingTotal > 0 ||
    accountSync.knowledgePendingTotal > 0;
  const accountSyncCenterTarget = getAccountSyncCenterTarget(accountSync);
  const accountSyncActionLabel = accountSyncNeedsSyncCenter
    ? "查看队列"
    : "快速同步";
  const accountSyncAriaLabel = `${accountSyncShortLabel}，${accountSyncActionLabel}：${accountSyncTitle.replace(
    /\n/g,
    "；"
  )}`;
  const accountSyncButtonTitle = `${accountSyncTitle}\n点击：${accountSyncActionLabel}`;
  const handleAccountSyncButtonClick = useCallback(() => {
    if (accountSyncNeedsSyncCenter) {
      openModuleRoute(accountSyncCenterTarget);
      return;
    }
    void accountSync.syncNow({ forceLease: true });
  }, [
    accountSync,
    accountSyncCenterTarget,
    accountSyncNeedsSyncCenter,
    openModuleRoute,
  ]);

  const refreshAccountLabel = useCallback(async () => {
    try {
      const session = await fetchAccountSession();
      if (session.authenticated && session.account) {
        setAccountLabel(session.account.display_name || "账号");
        return;
      }
      if (session.status === "ok") {
        setAccountLabel("账号");
        return;
      }
      setAccountLabel((currentLabel) =>
        currentLabel === "账号" ? getLastKnownAccountLabel() : currentLabel
      );
    } catch {
      setAccountLabel((currentLabel) =>
        currentLabel === "账号" ? getLastKnownAccountLabel() : currentLabel
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const localCache = readSidebarPrimaryLocalCache();
    const hasLocalCache =
      Boolean(localCache.order) ||
      Object.keys(localCache.customizations).length > 0;

    if (hasLocalCache) {
      setPrimaryCustomizations(localCache.customizations);
      setPrimaryItems(
        applySidebarPrimaryOrder(localCache.order, localCache.customizations)
      );
    }

    async function loadWorkspaceSidebarSettings() {
      try {
        const [orderSetting, customizationSetting] = await Promise.all([
          getWorkspaceSetting(SIDEBAR_PRIMARY_ORDER_SETTING_KEY),
          getWorkspaceSetting(SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY),
        ]);
        if (cancelled) return;

        const workspaceOrder = parseSidebarPrimaryOrderPayload(
          readWorkspaceSettingValue(orderSetting)
        );
        const workspaceCustomizations = parseSidebarPrimaryCustomizationPayload(
          readWorkspaceSettingValue(customizationSetting)
        );
        const hasWorkspaceSettings = Boolean(orderSetting || customizationSetting);

        if (hasWorkspaceSettings) {
          setPrimaryCustomizations(workspaceCustomizations);
          setPrimaryItems(
            applySidebarPrimaryOrder(workspaceOrder, workspaceCustomizations)
          );
          if (workspaceOrder) {
            writeSidebarPrimaryOrderLocalCache(workspaceOrder);
          }
          writeSidebarPrimaryCustomizationsLocalCache(workspaceCustomizations);
          return;
        }

        // localStorage is only a fast boot cache and migration source. The
        // durable local record is workspace_settings, which queues sync_log.
        if (localCache.hasOrder && localCache.order) {
          void persistSidebarPrimaryOrder(
            applySidebarPrimaryOrder(localCache.order, localCache.customizations)
          );
        }
        if (localCache.hasCustomizations) {
          void persistSidebarPrimaryCustomizations(localCache.customizations);
        }
      } catch (err) {
        console.error("[Zhinote] Failed to load sidebar settings:", err);
        if (!hasLocalCache && !cancelled) {
          setPrimaryItems(DEFAULT_PRIMARY_ITEMS);
          setPrimaryCustomizations({});
        }
      }
    }

    void loadWorkspaceSidebarSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshAccountLabel();
    const handleAccountStorage = (event: StorageEvent) => {
      if (event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY) {
        void refreshAccountLabel();
      }
    };
    window.addEventListener(
      ACCOUNT_PROFILE_UPDATED_EVENT,
      refreshAccountLabel
    );
    window.addEventListener("storage", handleAccountStorage);
    return () => {
      window.removeEventListener(
        ACCOUNT_PROFILE_UPDATED_EVENT,
        refreshAccountLabel
      );
      window.removeEventListener("storage", handleAccountStorage);
    };
  }, [refreshAccountLabel]);

  const handleNewPage = async () => {
    try {
      const { createPageWithCloud } = await import("@/lib/pages/cloudPageMutations");
      const page = await createPageWithCloud();
      openPage(page, { source: "sidebar-create" });
    } catch (err) {
      console.error("[Zhinote] Failed to create page:", err);
    }
  };

  const handleNewDatabase = async () => {
    try {
      const { createDatabase } = await import("@/lib/database/cloudDatabaseMutations");
      const db = await createDatabase({ title: "未命名数据库" });
      await refreshDatabases();
      openDatabase(db.id);
    } catch (err) {
      console.error("[Zhinote] Failed to create database:", err);
    }
  };

  const handleExportBackup = async () => {
    setBackupRunning(true);
    try {
      const { exportWorkspaceBackup } = await import(
        "@/lib/export/workspaceBackup"
      );
      await exportWorkspaceBackup();
    } catch (err) {
      console.error("[Zhinote] Failed to export workspace backup:", err);
      window.alert("备份失败，请查看控制台详情。");
    } finally {
      setBackupRunning(false);
    }
  };

  const handleExportWorkspaceMarkdown = async () => {
    setMarkdownExportRunning(true);
    try {
      const { exportWorkspaceMarkdown } = await import(
        "@/lib/export/workspaceBackup"
      );
      await exportWorkspaceMarkdown();
    } catch (err) {
      console.error("[Zhinote] Failed to export workspace Markdown:", err);
      window.alert("Markdown 导出失败，请查看控制台详情。");
    } finally {
      setMarkdownExportRunning(false);
    }
  };

  const handleExportWorkspaceZip = async () => {
    setZipExportRunning(true);
    try {
      const { exportWorkspaceZip } = await import(
        "@/lib/export/workspaceBackup"
      );
      await exportWorkspaceZip();
    } catch (err) {
      console.error("[Zhinote] Failed to export workspace ZIP:", err);
      window.alert("ZIP 导出失败，请查看控制台详情。");
    } finally {
      setZipExportRunning(false);
    }
  };

  // Pointer-based drag to reorder the primary sidebar items. We deliberately
  // avoid HTML5 drag-and-drop here: anchors start a native drag that cancels
  // pointer events mid-gesture, so the two systems cannot coexist on a Link.
  const handlePrimaryPointerDown = (
    e: PointerEvent<HTMLElement>,
    itemId: string
  ) => {
    if (e.button !== 0) return;
    primaryPointerDragRef.current = {
      itemId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
    };
  };

  const handlePrimaryPointerMove = (e: PointerEvent<HTMLElement>) => {
    const drag = primaryPointerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const distance = Math.hypot(
      e.clientX - drag.startX,
      e.clientY - drag.startY
    );
    if (distance < 6 && !drag.hasMoved) return;

    if (!drag.hasMoved) {
      drag.hasMoved = true;
      suppressPrimaryClickRef.current = true;
      setDraggedPrimaryId(drag.itemId);
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    // Pointer capture routes all events to the pressed element, so hit-test
    // the cursor position to find which row we are hovering.
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-sidebar-primary-id]");
    const targetId = target?.dataset.sidebarPrimaryId;
    if (!targetId || targetId === drag.itemId) return;

    setPrimaryItems((items) =>
      moveSidebarPrimaryItem(items, drag.itemId, targetId)
    );
  };

  const handlePrimaryPointerEnd = (e: PointerEvent<HTMLElement>) => {
    const drag = primaryPointerDragRef.current;
    if (drag?.pointerId === e.pointerId) {
      primaryPointerDragRef.current = null;
      if (drag.hasMoved) {
        setPrimaryItems((items) => {
          void persistSidebarPrimaryOrder(items).catch((err) => {
            console.error("[Zhinote] Failed to save sidebar order:", err);
          });
          return items;
        });
      }
      setDraggedPrimaryId(null);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handlePrimaryClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!suppressPrimaryClickRef.current) return;
    e.preventDefault();
    suppressPrimaryClickRef.current = false;
  };

  const openPrimaryEditor = (item: SidebarPrimaryItem) => {
    setEditingPrimaryItem({
      id: item.id,
      icon: item.icon,
      label: item.label,
    });
  };

  const handlePrimaryEditSave = () => {
    if (!editingPrimaryItem) return;
    const defaults = new Map(DEFAULT_PRIMARY_ITEMS.map((item) => [item.id, item]));
    const fallback = defaults.get(editingPrimaryItem.id);
    if (!fallback) return;
    const icon = normalizePrimaryIcon(editingPrimaryItem.icon, fallback.icon);
    const label = normalizePrimaryLabel(editingPrimaryItem.label, fallback.label);
    const nextCustomizations = {
      ...primaryCustomizations,
      [editingPrimaryItem.id]: { icon, label },
    };
    setPrimaryCustomizations(nextCustomizations);
    void persistSidebarPrimaryCustomizations(nextCustomizations).catch((err) => {
      console.error("[Zhinote] Failed to save sidebar customization:", err);
    });
    setPrimaryItems((items) =>
      items.map((item) =>
        item.id === editingPrimaryItem.id ? { ...item, icon, label } : item
      )
    );
    setEditingPrimaryItem(null);
  };

  const handlePrimaryEditReset = () => {
    if (!editingPrimaryItem) return;
    const fallback = DEFAULT_PRIMARY_ITEMS.find(
      (item) => item.id === editingPrimaryItem.id
    );
    if (!fallback) return;
    const nextCustomizations = { ...primaryCustomizations };
    delete nextCustomizations[editingPrimaryItem.id];
    setPrimaryCustomizations(nextCustomizations);
    void persistSidebarPrimaryCustomizations(nextCustomizations).catch((err) => {
      console.error("[Zhinote] Failed to reset sidebar customization:", err);
    });
    setPrimaryItems((items) =>
      items.map((item) =>
        item.id === editingPrimaryItem.id
          ? { ...item, icon: fallback.icon, label: fallback.label }
          : item
      )
    );
    setEditingPrimaryItem(null);
  };

  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 rounded-lg border border-transparent p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        title="打开侧边栏"
      >
        <ZhiNoteMark className="h-8 w-8" />
      </button>
    );
  }

  return (
    <aside className="w-64 h-screen flex flex-col bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
        <button
          type="button"
          onPointerEnter={() => warmModuleRoute("/modules")}
          onFocus={() => warmModuleRoute("/modules")}
          onClick={() => openModuleRoute("/modules")}
          className="rounded-md p-1 transition-colors hover:bg-white/5"
          title="打开模块中心"
        >
          <ZhiNoteLogo className="h-9 w-[150px]" />
        </button>
        <button
          onClick={toggleSidebar}
          className="p-1 rounded text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
          title="收起侧边栏"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <LazyQuickSearch />
      </div>

      {/* New page + New database buttons */}
      <div className="px-3 pb-2 flex gap-1">
        <button
          onClick={handleNewPage}
          className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          页面
        </button>
        <button
          onClick={handleNewDatabase}
          className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="text-xs">🗄️</span>
          数据库
        </button>
      </div>

      {/* Primary workspaces (the three big categories + portfolio) */}
      <div className="px-2 pb-2">
        {primaryItems.map((item) => (
          <div key={item.id} className="relative">
            <div
              data-sidebar-primary-id={item.id}
              onPointerDown={(e) => handlePrimaryPointerDown(e, item.id)}
              onPointerMove={handlePrimaryPointerMove}
              onPointerUp={handlePrimaryPointerEnd}
              onPointerCancel={handlePrimaryPointerEnd}
              onDragStart={(e) => e.preventDefault()}
              className={`group mt-0.5 flex w-full select-none items-center gap-1 rounded-md text-sm font-medium text-zinc-700 transition-colors dark:text-zinc-200 ${
                draggedPrimaryId === item.id
                  ? "bg-zinc-200 opacity-70 shadow-sm ring-1 ring-zinc-300 dark:bg-zinc-800 dark:ring-zinc-600"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              } ${draggedPrimaryId ? "cursor-grabbing" : ""}`}
            >
              <Link
                href={item.href}
                prefetch
                draggable={false}
                onPointerEnter={() => warmModuleRoute(item.href)}
                onFocus={() => warmModuleRoute(item.href)}
                onClick={handlePrimaryClick}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2"
              >
                <span className="w-5 shrink-0 text-center text-base">
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openPrimaryEditor(item);
                }}
                className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-colors hover:bg-zinc-200 hover:text-zinc-700 group-hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                title="编辑名称和图标"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            </div>

            {editingPrimaryItem?.id === item.id && (
              <div className="mt-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <label className="w-12 text-[11px] text-zinc-400">
                    图标
                    <input
                      value={editingPrimaryItem.icon}
                      onChange={(e) =>
                        setEditingPrimaryItem((current) =>
                          current
                            ? { ...current, icon: e.target.value }
                            : current
                        )
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-center text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>
                  <label className="min-w-0 flex-1 text-[11px] text-zinc-400">
                    名称
                    <input
                      value={editingPrimaryItem.label}
                      onChange={(e) =>
                        setEditingPrimaryItem((current) =>
                          current
                            ? { ...current, label: e.target.value }
                            : current
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handlePrimaryEditSave();
                        if (e.key === "Escape") setEditingPrimaryItem(null);
                      }}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrimaryEditReset}
                    className="rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    重置
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPrimaryItem(null)}
                    className="rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handlePrimaryEditSave}
                    disabled={!editingPrimaryItem.label.trim()}
                    className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    保存
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Secondary modules, collapsed by default */}
      <div className="px-2 pb-3">
        <button
          type="button"
          onClick={() => setModulesOpen((value) => !value)}
          className="flex w-full items-center justify-between rounded-md px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <span>备选模块</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${modulesOpen ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        {modulesOpen && (
          <div className="mt-1">
            <Link
              href="/modules"
              onPointerEnter={() => warmModuleRoute("/modules")}
              onFocus={() => warmModuleRoute("/modules")}
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                模块
              </span>
              <span className="truncate">模块中心</span>
            </Link>
            {sidebarModules.map((module) => (
              <Link
                key={module.id}
                href={module.route || "/modules"}
                onPointerEnter={() => warmModuleRoute(module.route || "/modules")}
                onFocus={() => warmModuleRoute(module.route || "/modules")}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {module.icon}
                </span>
                <span className="truncate">{module.shortTitle}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Page tree */}
      <nav className="flex-1 overflow-y-auto px-2">
        {/* Databases section */}
        {databases.length > 0 && (
          <div className="mb-3">
            <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
              数据库
            </p>
            <ul className="space-y-0.5">
              {databases.map((db) => (
                <li key={db.id}>
                  <button
                    onClick={() => openDatabase(db.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="shrink-0">{db.icon || "🗄️"}</span>
                    <span className="truncate">{db.title || "未命名"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <FavoritePages />

        {/* Pages section */}
        <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
          页面
        </p>
        <PageTree />
        <TrashPages />
      </nav>
      <div className="border-t border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
        <div className="flex items-center gap-1 rounded-md">
          <Link
            href="/account"
            prefetch
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <span className="shrink-0 text-base">👤</span>
            <span className="min-w-0 flex-1 truncate">{accountLabel}</span>
          </Link>
          {accountSync.enabledDomainCount > 0 && (
            <button
              type="button"
              data-testid="account-cloud-sync-coordinator"
              data-sync-state={accountSync.state}
              data-pending-total={accountSync.pendingTotal}
              data-failed-total={accountSync.failedTotal}
              data-manual-review-total={accountSync.manualReviewTotal}
              data-page-pending-total={accountSync.pagePendingTotal}
              data-database-pending-total={accountSync.databasePendingTotal}
              data-settings-pending-total={accountSync.settingsPendingTotal}
              data-knowledge-pending-total={accountSync.knowledgePendingTotal}
              data-sync-action={
                accountSyncNeedsSyncCenter ? "open-sync-center" : "quick-sync"
              }
              data-sync-target={accountSyncCenterTarget}
              aria-label={accountSyncAriaLabel}
              onPointerEnter={() => {
                if (accountSyncNeedsSyncCenter) {
                  warmModuleRoute(accountSyncCenterTarget);
                }
              }}
              onFocus={() => {
                if (accountSyncNeedsSyncCenter) {
                  warmModuleRoute(accountSyncCenterTarget);
                }
              }}
              onClick={handleAccountSyncButtonClick}
              className={`inline-flex h-8 min-w-8 max-w-[7.5rem] shrink-0 items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-colors ${accountSyncToneClass}`}
              title={accountSyncButtonTitle}
            >
              <span aria-hidden="true">{accountSyncIcon}</span>
              <span className="min-w-0 truncate">{accountSyncShortLabel}</span>
              {accountSync.pendingTotal > 0 && (
                <span className="rounded-full bg-amber-500 px-1 text-[9px] font-semibold leading-4 text-white">
                  {accountSync.pendingTotal}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleExportWorkspaceMarkdown}
          disabled={markdownExportRunning}
          className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 disabled:cursor-wait disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="下载所有活跃页面为一个 Markdown 文件"
        >
          {markdownExportRunning ? "导出中..." : "导出 MD"}
        </button>
        <button
          type="button"
          onClick={handleExportWorkspaceZip}
          disabled={zipExportRunning}
          className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 disabled:cursor-wait disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="下载活跃页面和上传文件为本地 ZIP"
        >
          {zipExportRunning ? "导出中..." : "导出 ZIP"}
        </button>
        <button
          type="button"
          onClick={handleExportBackup}
          disabled={backupRunning}
          className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 disabled:cursor-wait disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="下载当前工作区的本地 JSON 备份"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          {backupRunning ? "备份中..." : "备份"}
        </button>
      </div>
    </aside>
  );
}
