// Local-first cache for the portfolio module. The browser keeps a fast local
// copy, and account/passcode sync helpers upload normalized snapshots when
// cloud sync is enabled.

import type { PortfolioSnapshot, TagMap } from "./positionReport";
import type { CloudPortfolioData } from "./cloudSync";
import { getPortfolioStorageScope, portfolioStorage, portfolioStorageKey, type PortfolioStorageScope } from "./portfolioStorageScope";

const SNAPSHOT_KEY = "zhinote.portfolio.snapshot.v1";
const TAGS_KEY = "zhinote.portfolio.tags.v1";
const ALLOCATION_KEY = "zhinote.portfolio.allocation.v1";
const MAX_NET_KEY = "zhinote.portfolio.maxNetPct.v1";
const EMAIL_MESSAGE_KEY = "zhinote.portfolio.lastEmailMessage.v1";
const UPDATED_AT_KEY = "zhinote.portfolio.updatedAt.v1";
const DATA_KEYS = [SNAPSHOT_KEY, TAGS_KEY, ALLOCATION_KEY, MAX_NET_KEY, EMAIL_MESSAGE_KEY, UPDATED_AT_KEY];

export function isPortfolioDataStorageKey(key: string | null, scope = getPortfolioStorageScope()): boolean {
  return key !== null && DATA_KEYS.some((dataKey) => key === portfolioStorageKey(dataKey, scope));
}

// Memory-only comparison token. Unlike display loaders, a failed read must
// throw so an ACK cannot mistake unreadable local data for an empty portfolio.
export function readPortfolioLocalFingerprint(scope = getPortfolioStorageScope()): string {
  return JSON.stringify(DATA_KEYS.map((key) => portfolioStorage(scope).getItem(key)));
}

export const DEFAULT_GMV_ALLOCATION = 108_700_000;
export const DEFAULT_MAX_NET_PCT = 12;

// Sync and recovery use one strict snapshot, never the display loaders' defaults.
export function readLocalPortfolioData(scope = getPortfolioStorageScope()): CloudPortfolioData {
  const raw = JSON.parse(readPortfolioLocalFingerprint(scope)) as (string | null)[];
  const snapshot = raw[0] === null ? null : JSON.parse(raw[0]);
  const tagMap = raw[1] === null ? {} : JSON.parse(raw[1]);
  const allocation = raw[2] === null ? DEFAULT_GMV_ALLOCATION : Number(raw[2]);
  const maxNetPct = raw[3] === null ? DEFAULT_MAX_NET_PCT : Number(raw[3]);
  if ((snapshot !== null && (!snapshot || !Array.isArray(snapshot.positions))) ||
      !tagMap || typeof tagMap !== "object" || Array.isArray(tagMap) ||
      !Object.values(tagMap).every((tag) => typeof tag === "string") ||
      !Number.isFinite(allocation) || allocation <= 0 ||
      !Number.isFinite(maxNetPct) || maxNetPct <= 0 || maxNetPct > 100 ||
      (raw[5] !== null && !Number.isFinite(Date.parse(raw[5])))) {
    throw new Error("本机组合格式异常，未用空值替代原始内容，请先恢复备份。");
  }
  return { snapshot, tagMap, allocation, maxNetPct, lastEmailMessageId: raw[4],
    updatedAt: raw[5] ?? new Date().toISOString() };
}

export function loadSnapshot(scope = getPortfolioStorageScope()): PortfolioSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = portfolioStorage(scope).getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.positions)) return null;
    return parsed as PortfolioSnapshot;
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: PortfolioSnapshot | null, scope = getPortfolioStorageScope()) {
  portfolioStorage(scope).setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function loadTagMap(scope = getPortfolioStorageScope()): TagMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = portfolioStorage(scope).getItem(TAGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as TagMap;
  } catch {
    return {};
  }
}

export function saveTagMap(map: TagMap, scope = getPortfolioStorageScope()) {
  portfolioStorage(scope).setItem(TAGS_KEY, JSON.stringify(map));
}

export function loadAllocation(scope = getPortfolioStorageScope()): number {
  if (typeof window === "undefined") return DEFAULT_GMV_ALLOCATION;
  try {
    const raw = portfolioStorage(scope).getItem(ALLOCATION_KEY);
    if (!raw) return DEFAULT_GMV_ALLOCATION;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return DEFAULT_GMV_ALLOCATION;
  } catch {
    return DEFAULT_GMV_ALLOCATION;
  }
}

export function saveAllocation(value: number, scope = getPortfolioStorageScope()) {
  portfolioStorage(scope).setItem(ALLOCATION_KEY, String(value));
}

export function loadMaxNetPct(scope = getPortfolioStorageScope()): number {
  if (typeof window === "undefined") return DEFAULT_MAX_NET_PCT;
  try {
    const raw = portfolioStorage(scope).getItem(MAX_NET_KEY);
    if (!raw) return DEFAULT_MAX_NET_PCT;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 100) return parsed;
    return DEFAULT_MAX_NET_PCT;
  } catch {
    return DEFAULT_MAX_NET_PCT;
  }
}

export function saveMaxNetPct(value: number, scope = getPortfolioStorageScope()) {
  portfolioStorage(scope).setItem(MAX_NET_KEY, String(value));
}

export function loadLastEmailMessageId(scope = getPortfolioStorageScope()): string | null {
  if (typeof window === "undefined") return null;
  try {
    return portfolioStorage(scope).getItem(EMAIL_MESSAGE_KEY);
  } catch {
    return null;
  }
}

export function saveLastEmailMessageId(id: string | null, scope = getPortfolioStorageScope()) {
  if (id === null) portfolioStorage(scope).removeItem(EMAIL_MESSAGE_KEY);
  else portfolioStorage(scope).setItem(EMAIL_MESSAGE_KEY, id);
}

export function loadDataUpdatedAt(scope = getPortfolioStorageScope()): string | null {
  if (typeof window === "undefined") return null;
  try {
    return portfolioStorage(scope).getItem(UPDATED_AT_KEY);
  } catch {
    return null;
  }
}

export function saveDataUpdatedAt(iso: string, scope = getPortfolioStorageScope()) {
  portfolioStorage(scope).setItem(UPDATED_AT_KEY, iso);
}

export function bindPortfolioStore(scope: PortfolioStorageScope) {
  return {
    loadSnapshot: () => loadSnapshot(scope), saveSnapshot: (value: PortfolioSnapshot | null) => saveSnapshot(value, scope),
    loadTagMap: () => loadTagMap(scope), saveTagMap: (value: TagMap) => saveTagMap(value, scope),
    loadAllocation: () => loadAllocation(scope), saveAllocation: (value: number) => saveAllocation(value, scope),
    loadMaxNetPct: () => loadMaxNetPct(scope), saveMaxNetPct: (value: number) => saveMaxNetPct(value, scope),
    loadLastEmailMessageId: () => loadLastEmailMessageId(scope), saveLastEmailMessageId: (value: string | null) => saveLastEmailMessageId(value, scope),
    loadDataUpdatedAt: () => loadDataUpdatedAt(scope), saveDataUpdatedAt: (value: string) => saveDataUpdatedAt(value, scope),
  };
}
