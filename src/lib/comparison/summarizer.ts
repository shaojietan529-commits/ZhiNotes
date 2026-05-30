// Generate short, human-readable summaries of what changed between two
// versions of a page. Used for the hover-summary popover and version list.

import { diffStats } from "./differ";

/**
 * A compact one-line summary, e.g. "+12 words, −3 words".
 */
export function summarizeChange(oldText: string, newText: string): string {
  const { addedWords, removedWords, addedChars, removedChars } = diffStats(
    oldText,
    newText
  );

  if (addedWords === 0 && removedWords === 0) {
    // Sub-word edits (e.g. fixing a typo) still register at char level
    if (addedChars === 0 && removedChars === 0) return "No changes";
    return "Minor edits";
  }

  const parts: string[] = [];
  if (addedWords > 0) {
    parts.push(`+${addedWords} word${addedWords === 1 ? "" : "s"}`);
  }
  if (removedWords > 0) {
    parts.push(`−${removedWords} word${removedWords === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

/**
 * A slightly richer descriptor used in version lists, e.g.
 * "Expanded (+40 words)" or "Trimmed (−15 words)" or "Revised".
 */
export function describeChange(oldText: string, newText: string): string {
  const { addedWords, removedWords } = diffStats(oldText, newText);
  if (addedWords === 0 && removedWords === 0) return "Minor edits";
  if (removedWords === 0) return `Expanded (+${addedWords} words)`;
  if (addedWords === 0) return `Trimmed (−${removedWords} words)`;
  return `Revised (+${addedWords} / −${removedWords} words)`;
}
