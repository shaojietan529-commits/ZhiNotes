"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  getWorkspaceSetting,
  upsertWorkspaceSetting,
} from "@/lib/db/local/queries";
import {
  MEETING_DELETION_TOMBSTONES_SETTING_KEY,
  normalizeMeetingDeletionPageIds,
  parseMeetingDeletionTombstonesWorkspaceSetting,
  type MeetingDeletionTombstonesWorkspaceSettingValue,
} from "@/lib/sync/meetingDeletionTombstonesWorkspaceSettings";

const LOCAL_CACHE_KEY = "zhinote.zhihui.deleted";

export function useMeetingDeletionTombstonesPreference() {
  const [tombstones, setTombstones] =
    useState<MeetingDeletionTombstonesWorkspaceSettingValue>(
      readMeetingDeletionTombstonesFastCache
    );
  const [loaded, setLoaded] = useState(false);
  const tombstonesRef = useRef(new Set(tombstones.deleted_meeting_page_ids));
  const locallyEditedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const localState = readMeetingDeletionTombstonesFastCache();

    async function loadMeetingDeletionTombstones() {
      try {
        const setting = await getWorkspaceSetting(MEETING_DELETION_TOMBSTONES_SETTING_KEY);
        if (cancelled) return;

        if (setting) {
          const workspaceState =
            parseMeetingDeletionTombstonesWorkspaceSetting(setting);
          const next = locallyEditedRef.current
            ? mergeMeetingDeletionTombstones(
                workspaceState,
                setToMeetingDeletionTombstones(tombstonesRef.current)
              )
            : workspaceState;
          setTombstonesState(next, setTombstones, tombstonesRef);
          if (locallyEditedRef.current) {
            void persistMeetingDeletionTombstonesPreference(
              next,
              "merge-cloud-and-local-meeting-deletion-tombstones"
            );
          } else {
            writeMeetingDeletionTombstonesFastCache(next);
          }
          return;
        }

        // localStorage is a fast boot cache and legacy migration source only.
        // The durable local record is workspace_settings, which queues sync_log.
        if (localState.deleted_meeting_page_ids.length > 0) {
          void persistMeetingDeletionTombstonesPreference(
            localState,
            "legacy-meeting-deletion-tombstones-localStorage"
          );
        }
      } catch (error) {
        console.error(
          "[Zhinote] Failed to load meeting deletion tombstones:",
          error
        );
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    void loadMeetingDeletionTombstones();
    return () => {
      cancelled = true;
    };
  }, []);

  const addMeetingDeletionTombstone = useCallback((pageId: string) => {
    if (tombstonesRef.current.has(pageId)) return;
    locallyEditedRef.current = true;
    const nextSet = new Set(tombstonesRef.current);
    nextSet.add(pageId);
    const next = setToMeetingDeletionTombstones(nextSet);
    setTombstonesState(next, setTombstones, tombstonesRef);
    void persistMeetingDeletionTombstonesPreference(next).catch((error) => {
      console.error(
        "[Zhinote] Failed to save meeting deletion tombstones:",
        error
      );
    });
  }, []);

  return {
    tombstones,
    tombstoneSet: tombstonesRef.current,
    tombstonesRef,
    tombstonesLoaded: loaded,
    addMeetingDeletionTombstone,
  };
}

export function readMeetingDeletionTombstonesFastCache(): MeetingDeletionTombstonesWorkspaceSettingValue {
  if (typeof window === "undefined") {
    return getDefaultMeetingDeletionTombstones();
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    return {
      deleted_meeting_page_ids: normalizeMeetingDeletionPageIds(
        raw ? JSON.parse(raw) : []
      ),
    };
  } catch {
    return getDefaultMeetingDeletionTombstones();
  }
}

export function writeMeetingDeletionTombstonesFastCache(
  value: MeetingDeletionTombstonesWorkspaceSettingValue
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCAL_CACHE_KEY,
      JSON.stringify(value.deleted_meeting_page_ids)
    );
  } catch {
    // Fast cache is best-effort; workspace_settings remains the durable record.
  }
}

export async function persistMeetingDeletionTombstonesPreference(
  value: MeetingDeletionTombstonesWorkspaceSettingValue,
  source = "meeting-deletion-tombstones-ui"
) {
  const next = {
    deleted_meeting_page_ids: normalizeMeetingDeletionPageIds(
      value.deleted_meeting_page_ids
    ),
  };
  writeMeetingDeletionTombstonesFastCache(next);

  await upsertWorkspaceSetting(
    MEETING_DELETION_TOMBSTONES_SETTING_KEY,
    {
      schema_version: 1,
      deleted_meeting_page_ids: next.deleted_meeting_page_ids,
      cloud_target: "workspaces.settings.meeting_deletion_tombstones",
      local_cache_key: LOCAL_CACHE_KEY,
      ordinary_sync_pending_only: true,
    },
    source
  );
}

function setTombstonesState(
  value: MeetingDeletionTombstonesWorkspaceSettingValue,
  setTombstones: Dispatch<
    SetStateAction<MeetingDeletionTombstonesWorkspaceSettingValue>
  >,
  tombstonesRef: MutableRefObject<Set<string>>
) {
  const normalized = {
    deleted_meeting_page_ids: normalizeMeetingDeletionPageIds(
      value.deleted_meeting_page_ids
    ),
  };
  tombstonesRef.current = new Set(normalized.deleted_meeting_page_ids);
  setTombstones(normalized);
}

function mergeMeetingDeletionTombstones(
  a: MeetingDeletionTombstonesWorkspaceSettingValue,
  b: MeetingDeletionTombstonesWorkspaceSettingValue
): MeetingDeletionTombstonesWorkspaceSettingValue {
  return {
    deleted_meeting_page_ids: normalizeMeetingDeletionPageIds([
      ...a.deleted_meeting_page_ids,
      ...b.deleted_meeting_page_ids,
    ]),
  };
}

function setToMeetingDeletionTombstones(
  ids: Set<string>
): MeetingDeletionTombstonesWorkspaceSettingValue {
  return {
    deleted_meeting_page_ids: normalizeMeetingDeletionPageIds([...ids]),
  };
}

function getDefaultMeetingDeletionTombstones(): MeetingDeletionTombstonesWorkspaceSettingValue {
  return {
    deleted_meeting_page_ids: [],
  };
}
