"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getWorkspaceSetting,
  upsertWorkspaceSetting,
} from "@/lib/db/local/queries";
import {
  MEETING_REVIEW_STATE_SETTING_KEY,
  normalizeMeetingReviewPageIds,
  parseMeetingReviewStateWorkspaceSetting,
  type MeetingReviewStateWorkspaceSettingValue,
} from "@/lib/sync/meetingReviewStateWorkspaceSettings";

const LOCAL_CACHE_KEYS = {
  seen_meeting_page_ids: "zhinote.zhihui.seen",
  dismissed_trace_page_ids: "zhinote.zhihui.trace-dismissed",
} as const;

export function useMeetingReviewStatePreference() {
  const [reviewState, setReviewState] =
    useState<MeetingReviewStateWorkspaceSettingValue>(
      readMeetingReviewStateFastCache
    );
  const reviewStateRef = useRef(reviewState);

  useEffect(() => {
    let cancelled = false;
    const localState = readMeetingReviewStateFastCache();

    async function loadMeetingReviewState() {
      try {
        const setting = await getWorkspaceSetting(MEETING_REVIEW_STATE_SETTING_KEY);
        if (cancelled) return;

        if (setting) {
          const workspaceState =
            parseMeetingReviewStateWorkspaceSetting(setting);
          reviewStateRef.current = workspaceState;
          setReviewState(workspaceState);
          writeMeetingReviewStateFastCache(workspaceState);
          return;
        }

        // localStorage is a fast boot cache and legacy migration source only.
        // The durable local record is workspace_settings, which queues sync_log.
        if (
          localState.seen_meeting_page_ids.length > 0 ||
          localState.dismissed_trace_page_ids.length > 0
        ) {
          void persistMeetingReviewStatePreference(
            localState,
            "legacy-meeting-review-state-localStorage"
          );
        }
      } catch (error) {
        console.error("[Zhinote] Failed to load meeting review state:", error);
      }
    }

    void loadMeetingReviewState();
    return () => {
      cancelled = true;
    };
  }, []);

  const seenIds = useMemo(
    () => new Set(reviewState.seen_meeting_page_ids),
    [reviewState.seen_meeting_page_ids]
  );
  const dismissedTraces = useMemo(
    () => new Set(reviewState.dismissed_trace_page_ids),
    [reviewState.dismissed_trace_page_ids]
  );

  const markMeetingSeen = useCallback((pageId: string) => {
    const current = reviewStateRef.current;
    if (current.seen_meeting_page_ids.includes(pageId)) return;
    const next = {
      ...current,
      seen_meeting_page_ids: normalizeMeetingReviewPageIds([
        ...current.seen_meeting_page_ids,
        pageId,
      ]),
    };
    reviewStateRef.current = next;
    setReviewState(next);
    void persistMeetingReviewStatePreference(next).catch((error) => {
      console.error("[Zhinote] Failed to save meeting review state:", error);
    });
  }, []);

  const dismissTrace = useCallback((pageId: string) => {
    const current = reviewStateRef.current;
    if (current.dismissed_trace_page_ids.includes(pageId)) return;
    const next = {
      ...current,
      dismissed_trace_page_ids: normalizeMeetingReviewPageIds([
        ...current.dismissed_trace_page_ids,
        pageId,
      ]),
    };
    reviewStateRef.current = next;
    setReviewState(next);
    void persistMeetingReviewStatePreference(next).catch((error) => {
      console.error("[Zhinote] Failed to save meeting review state:", error);
    });
  }, []);

  return {
    seenIds,
    dismissedTraces,
    markMeetingSeen,
    dismissTrace,
  };
}

export function readMeetingReviewStateFastCache(): MeetingReviewStateWorkspaceSettingValue {
  if (typeof window === "undefined") {
    return getDefaultMeetingReviewState();
  }
  return {
    seen_meeting_page_ids: readLocalIdList(
      LOCAL_CACHE_KEYS.seen_meeting_page_ids
    ),
    dismissed_trace_page_ids: readLocalIdList(
      LOCAL_CACHE_KEYS.dismissed_trace_page_ids
    ),
  };
}

export function writeMeetingReviewStateFastCache(
  value: MeetingReviewStateWorkspaceSettingValue
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCAL_CACHE_KEYS.seen_meeting_page_ids,
      JSON.stringify(value.seen_meeting_page_ids)
    );
    window.localStorage.setItem(
      LOCAL_CACHE_KEYS.dismissed_trace_page_ids,
      JSON.stringify(value.dismissed_trace_page_ids)
    );
  } catch {
    // Fast cache is best-effort; workspace_settings remains the durable record.
  }
}

export async function persistMeetingReviewStatePreference(
  value: MeetingReviewStateWorkspaceSettingValue,
  source = "meeting-review-state-ui"
) {
  const next = {
    seen_meeting_page_ids: normalizeMeetingReviewPageIds(
      value.seen_meeting_page_ids
    ),
    dismissed_trace_page_ids: normalizeMeetingReviewPageIds(
      value.dismissed_trace_page_ids
    ),
  };
  writeMeetingReviewStateFastCache(next);

  await upsertWorkspaceSetting(
    MEETING_REVIEW_STATE_SETTING_KEY,
    {
      schema_version: 1,
      seen_meeting_page_ids: next.seen_meeting_page_ids,
      dismissed_trace_page_ids: next.dismissed_trace_page_ids,
      cloud_target: "workspaces.settings.meeting_review_state",
      local_cache_keys: LOCAL_CACHE_KEYS,
      ordinary_sync_pending_only: true,
    },
    source
  );
}

function readLocalIdList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    return normalizeMeetingReviewPageIds(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

function getDefaultMeetingReviewState(): MeetingReviewStateWorkspaceSettingValue {
  return {
    seen_meeting_page_ids: [],
    dismissed_trace_page_ids: [],
  };
}
