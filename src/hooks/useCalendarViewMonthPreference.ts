"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getWorkspaceSetting,
  upsertWorkspaceSetting,
} from "@/lib/db/local/queries";
import {
  CALENDAR_VIEW_STATE_SETTING_KEY,
  normalizeCalendarViewMonth,
  parseCalendarViewStateWorkspaceSetting,
  type CalendarViewStateWorkspaceSettingValue,
} from "@/lib/sync/calendarViewStateWorkspaceSettings";

export type CalendarViewSurface = "daily" | "meeting";

const LOCAL_CACHE_KEYS: Record<CalendarViewSurface, string> = {
  daily: "zhinote.calendar.viewMonth.daily.v1",
  meeting: "zhinote.calendar.viewMonth.meeting.v1",
};

export function useCalendarViewMonthPreference(surface: CalendarViewSurface) {
  const [viewMonth, setViewMonthState] = useState(() => {
    return readCalendarViewMonthFastCache(surface) ?? currentMonthStart();
  });

  useEffect(() => {
    let cancelled = false;
    const localMonth = readCalendarViewMonthFastCache(surface);

    async function loadCalendarViewState() {
      try {
        const setting = await getWorkspaceSetting(
          CALENDAR_VIEW_STATE_SETTING_KEY
        );
        if (cancelled) return;

        if (setting) {
          const preferences = parseCalendarViewStateWorkspaceSetting(setting);
          const monthKey =
            surface === "daily"
              ? preferences.daily_view_month
              : preferences.meeting_view_month;
          const workspaceMonth = monthKeyToDate(monthKey);
          if (workspaceMonth) {
            setViewMonthState(workspaceMonth);
            writeCalendarViewMonthFastCache(surface, workspaceMonth);
          }
          return;
        }

        // localStorage is a fast boot cache and legacy migration source only.
        // The durable local record is workspace_settings, which queues sync_log.
        if (localMonth) {
          void persistCalendarViewMonthPreference(
            surface,
            localMonth,
            "legacy-calendar-view-month-localStorage"
          );
        }
      } catch (error) {
        console.error("[Zhinote] Failed to load calendar view state:", error);
      }
    }

    void loadCalendarViewState();
    return () => {
      cancelled = true;
    };
  }, [surface]);

  const setViewMonth = useCallback(
    (nextMonth: Date) => {
      const normalized = monthStart(nextMonth);
      setViewMonthState(normalized);
      void persistCalendarViewMonthPreference(surface, normalized).catch(
        (error) => {
          console.error("[Zhinote] Failed to save calendar view state:", error);
        }
      );
    },
    [surface]
  );

  return { viewMonth, setViewMonth };
}

export function readCalendarViewMonthFastCache(
  surface: CalendarViewSurface
): Date | null {
  if (typeof window === "undefined") return null;
  try {
    return monthKeyToDate(
      window.localStorage.getItem(LOCAL_CACHE_KEYS[surface])
    );
  } catch {
    return null;
  }
}

export function writeCalendarViewMonthFastCache(
  surface: CalendarViewSurface,
  value: Date
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCAL_CACHE_KEYS[surface],
      dateToMonthKey(value)
    );
  } catch {
    // Fast cache is best-effort; workspace_settings remains the durable record.
  }
}

export async function persistCalendarViewMonthPreference(
  surface: CalendarViewSurface,
  value: Date,
  source = "calendar-view-state-ui"
) {
  const monthKey = dateToMonthKey(value);
  writeCalendarViewMonthFastCache(surface, value);
  const setting = await getWorkspaceSetting(CALENDAR_VIEW_STATE_SETTING_KEY);
  const current = parseCalendarViewStateWorkspaceSetting(setting);
  const next: CalendarViewStateWorkspaceSettingValue = {
    ...current,
    [surface === "daily" ? "daily_view_month" : "meeting_view_month"]:
      monthKey,
  };

  await upsertWorkspaceSetting(
    CALENDAR_VIEW_STATE_SETTING_KEY,
    {
      schema_version: 1,
      daily_view_month: next.daily_view_month,
      meeting_view_month: next.meeting_view_month,
      cloud_target: "workspaces.settings.calendar_view_state",
      local_cache_keys: LOCAL_CACHE_KEYS,
      ordinary_sync_pending_only: true,
    },
    source
  );
}

function currentMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function dateToMonthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyToDate(value: unknown): Date | null {
  const monthKey = normalizeCalendarViewMonth(value);
  if (!monthKey) return null;
  return new Date(
    Number(monthKey.slice(0, 4)),
    Number(monthKey.slice(5, 7)) - 1,
    1
  );
}
