"use client";

import { useEffect, useState } from "react";
import { ACCOUNT_SESSION_CHANGED_EVENT, getLastAuthenticatedAccount, isAccountSessionStorageKey } from "@/lib/account/clientSession";
import { ACCOUNT_PROFILE_UPDATED_EVENT } from "@/lib/account/clientProfile";
import { listenForAccountChanges, type RealtimeState } from "@/lib/sync/accountRealtimeClient";
import { ACCOUNT_REMOTE_CHANGE_EVENT } from "@/lib/sync/realtimeProtocol";

export function useAccountRealtime() {
  const [state, setState] = useState<RealtimeState>("polling");
  useEffect(() => {
    let current: AbortController | undefined;
    let identity: string | undefined;
    const stop = () => { current?.abort(); current = undefined; identity = undefined; };
    const refresh = () => {
      const accountId = getLastAuthenticatedAccount()?.id;
      if (!accountId || document.visibilityState !== "visible" || !navigator.onLine) {
        stop();
        setState("polling");
        return;
      }
      if (current && identity === accountId) return;
      stop();
      const connection = new AbortController();
      current = connection;
      identity = accountId;
      void listenForAccountChanges({
        accountId, signal: connection.signal,
        onState: (next) => { if (!connection.signal.aborted) setState(next); },
        onChange: (change) => {
          if (!connection.signal.aborted && getLastAuthenticatedAccount()?.id === accountId) {
            window.dispatchEvent(new CustomEvent(ACCOUNT_REMOTE_CHANGE_EVENT, { detail: change }));
          }
        },
      }).finally(() => { if (current === connection) { current = undefined; identity = undefined; } });
    };
    const sessionChanged = () => { stop(); refresh(); };
    const storage = (event: StorageEvent) => {
      if (event.key === null || isAccountSessionStorageKey(event.key)) refresh();
    };
    // Cached identity is a hint only; the server authenticates every connection.
    refresh();
    window.addEventListener(ACCOUNT_SESSION_CHANGED_EVENT, sessionChanged);
    window.addEventListener(ACCOUNT_PROFILE_UPDATED_EVENT, refresh);
    window.addEventListener("storage", storage);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stop();
      window.removeEventListener(ACCOUNT_SESSION_CHANGED_EVENT, sessionChanged);
      window.removeEventListener(ACCOUNT_PROFILE_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", storage);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return state;
}
