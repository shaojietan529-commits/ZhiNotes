// Decides when to capture a page version snapshot and orchestrates writing it.
// Auto-snapshots are throttled so we don't store a version on every keystroke.

import {
  getLatestVersion,
  createVersion,
} from "@/lib/db/local/queries";
import type { PageVersion } from "@/lib/utils/types";
import { htmlToText, diffStats } from "./differ";
import { summarizeChange } from "./summarizer";

// Capture a snapshot once the accumulated change since the last version is
// "significant", OR enough time has passed that even a small edit is worth
// preserving (so slow, deliberate research edits still get tracked).
const MIN_CHARS_FOR_SNAPSHOT = 120;
const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Possibly create an automatic version snapshot for a page.
 * Returns the new version if one was created, otherwise null.
 */
export async function maybeSnapshot(
  pageId: string,
  title: string,
  html: string
): Promise<PageVersion | null> {
  const latest = await getLatestVersion(pageId);
  const newText = htmlToText(html);

  // First-ever save: establish a baseline so future diffs have a reference.
  if (!latest) {
    return createVersion(pageId, {
      title,
      contentHtml: html,
      summary: "Initial version",
    });
  }

  const oldText = htmlToText(latest.content_text || "");
  const stats = diffStats(oldText, newText);
  if (!stats.hasChanges) return null;

  const elapsed = Date.now() - new Date(latest.created_at).getTime();
  const significant = stats.changedChars >= MIN_CHARS_FOR_SNAPSHOT;
  const overdue = elapsed >= MIN_INTERVAL_MS;

  if (significant || overdue) {
    return createVersion(pageId, {
      title,
      contentHtml: html,
      summary: summarizeChange(oldText, newText),
    });
  }

  return null;
}

/**
 * Explicitly capture a version snapshot, optionally with a custom label
 * (e.g. "Q3 earnings update"). Always creates a version.
 */
export async function manualSnapshot(
  pageId: string,
  title: string,
  html: string,
  label?: string
): Promise<PageVersion> {
  const latest = await getLatestVersion(pageId);
  const newText = htmlToText(html);
  const autoSummary = latest
    ? summarizeChange(htmlToText(latest.content_text || ""), newText)
    : "Manual save";

  return createVersion(pageId, {
    title,
    contentHtml: html,
    summary: label?.trim() ? label.trim() : autoSummary,
  });
}
