// Local-only persistence for the portfolio module. Snapshots and tag maps
// live in the browser's localStorage — never uploaded, never synced.

import type { PortfolioSnapshot, TagMap } from "./positionReport";

const SNAPSHOT_KEY = "zhinote.portfolio.snapshot.v1";
const TAGS_KEY = "zhinote.portfolio.tags.v1";
const ALLOCATION_KEY = "zhinote.portfolio.allocation.v1";

export const DEFAULT_GMV_ALLOCATION = 108_700_000;

export function loadSnapshot(): PortfolioSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.positions)) return null;
    return parsed as PortfolioSnapshot;
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: PortfolioSnapshot) {
  window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function loadTagMap(): TagMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TAGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as TagMap;
  } catch {
    return {};
  }
}

export function saveTagMap(map: TagMap) {
  window.localStorage.setItem(TAGS_KEY, JSON.stringify(map));
}

export function loadAllocation(): number {
  if (typeof window === "undefined") return DEFAULT_GMV_ALLOCATION;
  try {
    const raw = window.localStorage.getItem(ALLOCATION_KEY);
    if (!raw) return DEFAULT_GMV_ALLOCATION;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return DEFAULT_GMV_ALLOCATION;
  } catch {
    return DEFAULT_GMV_ALLOCATION;
  }
}

export function saveAllocation(value: number) {
  window.localStorage.setItem(ALLOCATION_KEY, String(value));
}
