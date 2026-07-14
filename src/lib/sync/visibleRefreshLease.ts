"use client";

const localOwners = new Map<string, string>();

function getLocalOwner(storageKey: string) {
  const existing = localOwners.get(storageKey);
  if (existing) return existing;
  const owner = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
  localOwners.set(storageKey, owner);
  return owner;
}

export function claimVisibleRefreshLease(
  storageKey: string,
  ttlMs: number
): boolean {
  if (typeof window === "undefined") return false;
  const owner = getLocalOwner(storageKey);
  const now = Date.now();

  try {
    const raw = window.localStorage.getItem(storageKey);
    const lease = raw
      ? (JSON.parse(raw) as { owner?: string; until?: number })
      : null;
    if (
      lease?.owner &&
      lease.owner !== owner &&
      typeof lease.until === "number" &&
      lease.until > now
    ) {
      return false;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ owner, until: now + ttlMs })
    );
    const confirmed = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "{}"
    ) as { owner?: string };
    return confirmed.owner === owner;
  } catch {
    // This lease only reduces duplicate status refreshes across tabs. If
    // localStorage is blocked, keep the current tab responsive.
    return true;
  }
}
