// Native transactions serialize read/modify/write across browser tabs.
// Network calls must stay outside the synchronous transaction callback.
export const PORTFOLIO_LOCAL_DB = "zhinote-portfolio";
export const PORTFOLIO_LOCAL_STORE = "accounts";
export const PORTFOLIO_LOCAL_VALUE_KEYS = [
  "snapshot.v1", "tags.v1", "allocation.v1", "maxNetPct.v1", "lastEmailMessage.v1", "updatedAt.v1",
  "sync.status.v1", "sync.base.v2.account", "sync.base.v2.passcode",
  "sync.resolution.v1.account", "sync.resolution.v1.passcode",
  "sync.conflict.v1.account", "sync.conflict.v1.passcode", "legacy-reviewed.v1",
].map((key) => `zhinote.portfolio.${key}`);
export interface PortfolioLocalRecord {
  format: 1;
  scope: string;
  revision: number;
  values: Record<string, string | null>;
  legacySource: Record<string, string | null>;
}

let opening: Promise<IDBDatabase> | null = null;
const snapshots = new Map<string, PortfolioLocalRecord>();

function openDatabase(): Promise<IDBDatabase> {
  if (opening) return opening;
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("浏览器不支持组合本机存储，原数据未改动。"));
    const request = indexedDB.open(PORTFOLIO_LOCAL_DB, 1);
    let settled = false;
    const timeout = setTimeout(() => fail(new Error("组合本机存储暂时无法打开，请关闭旧版本标签页后重试。")), 8000);
    const fail = (error: unknown) => { settled = true; clearTimeout(timeout); reject(error); };
    request.onupgradeneeded = () => request.result.createObjectStore(PORTFOLIO_LOCAL_STORE);
    request.onblocked = () => fail(new Error("另一标签页正在使用旧版本组合存储，请关闭该标签页后重试。"));
    request.onerror = () => fail(request.error);
    request.onsuccess = () => {
      clearTimeout(timeout);
      const db = request.result;
      if (settled) { db.close(); return; }
      settled = true;
      db.onversionchange = () => { db.close(); opening = null; };
      db.onclose = () => { opening = null; };
      resolve(db);
    };
  });
  opening = promise;
  void promise.catch(() => { if (opening === promise) opening = null; });
  return promise;
}

export function cachedPortfolioRecord(scope: string): PortfolioLocalRecord | undefined {
  return snapshots.get(scope);
}

export function validatePortfolioRecord(value: unknown, scope: string): PortfolioLocalRecord {
  const record = value as PortfolioLocalRecord;
  const isValues = (values: unknown) => values && typeof values === "object" && !Array.isArray(values) &&
    Object.entries(values).every(([key, val]) => key.startsWith("zhinote.portfolio.") && (val === null || typeof val === "string"));
  if (!record || record.format !== 1 || record.scope !== scope || !Number.isSafeInteger(record.revision) || record.revision < 1 ||
      !isValues(record.values) || !isValues(record.legacySource) ||
      PORTFOLIO_LOCAL_VALUE_KEYS.some((key) => !Object.hasOwn(record.values, key))) {
    throw new Error("组合本机记录无法读取，原始记录已保留。");
  }
  return record;
}

function remember(record: PortfolioLocalRecord) {
  const current = snapshots.get(record.scope);
  if (!current || current.revision <= record.revision) snapshots.set(record.scope, record);
}

export async function readPortfolioRecord(scope: string): Promise<PortfolioLocalRecord | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PORTFOLIO_LOCAL_STORE, "readonly");
    const request = tx.objectStore(PORTFOLIO_LOCAL_STORE).get(scope);
    let record: PortfolioLocalRecord | undefined;
    let failure: unknown;
    const timeout = setTimeout(() => {
      failure = new Error("组合本机读取暂时超时，原数据未改动，请重试。");
      tx.abort();
    }, 5000);
    request.onsuccess = () => {
      try {
        if (request.result !== undefined) record = validatePortfolioRecord(request.result, scope);
        else if (snapshots.has(scope)) throw new Error("组合本机保存记录发生变化，未从旧缓存自动恢复，请重新打开页面核对。");
      }
      catch (error) { failure = error; tx.abort(); }
    };
    tx.onabort = () => { clearTimeout(timeout); reject(failure ?? tx.error ?? new Error("组合本机读取已中断。")); };
    tx.oncomplete = () => { clearTimeout(timeout); if (record) remember(record); resolve(record); };
  });
}

export async function changePortfolioRecord<T>(
  scope: string,
  change: (current: PortfolioLocalRecord | undefined) => { record: PortfolioLocalRecord; result: T }
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PORTFOLIO_LOCAL_STORE, "readwrite", { durability: "strict" });
    const store = tx.objectStore(PORTFOLIO_LOCAL_STORE);
    const request = store.get(scope);
    let saved: PortfolioLocalRecord;
    let result: T;
    let failure: unknown;
    const timeout = setTimeout(() => {
      failure = new Error("另一标签页暂时占用组合保存，请保留输入并重试。");
      tx.abort();
    }, 5000);
    request.onsuccess = () => {
      try {
        if (request.result === undefined && snapshots.has(scope)) throw new Error("组合本机保存记录发生变化，未从旧缓存自动恢复，请重新打开页面核对。");
        const current = request.result === undefined ? undefined : validatePortfolioRecord(request.result, scope);
        const next = change(current);
        result = next.result;
        saved = validatePortfolioRecord(next.record, scope);
        if (saved !== current) store.put(saved, scope);
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.onabort = () => { clearTimeout(timeout); reject(failure ?? tx.error ?? new Error("组合本机保存已中断。")); };
    tx.oncomplete = () => { clearTimeout(timeout); remember(saved); resolve(result); };
  });
}
