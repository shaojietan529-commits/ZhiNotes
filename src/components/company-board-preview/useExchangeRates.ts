"use client";

import { useEffect, useSyncExternalStore } from "react";
import { FX_HOUR, isFxStale, parseFxQuote, type FxQuote } from "./currency";

const CACHE_KEY = "zhinote:company-board-fx:v1";
const EMPTY = { quote: null as FxQuote | null, loading: false, failed: false, stale: false };
let state = EMPTY;
let hydrated = false;
let nextAttempt = 0;
let failures = 0;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY;
function publish(next: typeof state) { state = next; listeners.forEach(listener => listener()); }

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const stored = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null");
    const quote = parseFxQuote(stored?.quote);
    const checkedAt = stored.checkedAt;
    if (typeof checkedAt !== "number" || !Number.isFinite(checkedAt) || checkedAt > Date.now() || checkedAt < quote.timestamp * 1000 - 300000) return;
    nextAttempt = Math.min(checkedAt + FX_HOUR, Date.now() + FX_HOUR);
    publish({ quote, loading: false, failed: false, stale: isFxStale(quote) });
  } catch { /* Unavailable storage or an expired cache must not block original amounts. */ }
}

function checkRates() {
  hydrate();
  if (state.quote) {
    try {
      parseFxQuote(state.quote);
      const stale = isFxStale(state.quote);
      if (stale !== state.stale) publish({ ...state, stale });
    } catch { publish({ ...state, quote: null, stale: false }); }
  }
  if (pending || Date.now() < nextAttempt || document.visibilityState === "hidden") return pending;
  publish({ ...state, loading: true });
  // One public feed serves every currency and section; never pass account data.
  pending = (async () => {
    try {
      const response = await fetch("/preview/company-board/exchange-rates", {
        credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("FX unavailable");
      const quote = parseFxQuote(await response.json());
      if (state.quote && quote.timestamp < state.quote.timestamp) throw new Error("Regressed FX quote");
      const checkedAt = Date.now();
      nextAttempt = checkedAt + FX_HOUR;
      failures = 0;
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ quote, checkedAt })); } catch { /* Memory cache still works. */ }
      publish({ quote, loading: false, failed: false, stale: isFxStale(quote) });
    } catch {
      const retryMinutes = [1, 5, 15, 60][Math.min(failures++, 3)];
      nextAttempt = Date.now() + retryMinutes * 60000;
      publish({ ...state, loading: false, failed: true });
    } finally { pending = null; }
  })();
  return pending;
}

export function useExchangeRates(enabled: boolean) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    if (!enabled) return;
    const check = () => { void checkRates(); };
    check();
    const timer = setInterval(check, 60000);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled]);
  return snapshot;
}
