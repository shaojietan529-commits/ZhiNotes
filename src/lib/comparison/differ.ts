// Text diffing utilities for the page version comparison feature.
// Works on plain text extracted from the editor's HTML content.

import { diffWords, diffLines } from "diff";

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/**
 * Convert editor HTML into readable plain text, preserving paragraph and
 * line breaks so diffs read naturally. Deterministic and SSR-safe (no DOM).
 */
export function htmlToText(html: string): string {
  if (!html) return "";
  let text = html
    // Block-level closings become newlines
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|pre)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Drop all remaining tags
    .replace(/<[^>]+>/g, "");

  // Decode the most common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .trim();
}

/** Word-level diff between two plain-text strings. */
export function wordDiff(oldText: string, newText: string): DiffPart[] {
  return diffWords(oldText, newText) as DiffPart[];
}

/** Line-level diff between two plain-text strings. */
export function lineDiff(oldText: string, newText: string): DiffPart[] {
  return diffLines(oldText, newText) as DiffPart[];
}

function countWords(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export interface DiffStats {
  addedChars: number;
  removedChars: number;
  addedWords: number;
  removedWords: number;
  changedChars: number; // addedChars + removedChars
  hasChanges: boolean;
}

/** Compute aggregate added/removed counts between two plain-text strings. */
export function diffStats(oldText: string, newText: string): DiffStats {
  const parts = diffWords(oldText, newText) as DiffPart[];
  let addedChars = 0;
  let removedChars = 0;
  let addedWords = 0;
  let removedWords = 0;

  for (const part of parts) {
    if (part.added) {
      addedChars += part.value.length;
      addedWords += countWords(part.value);
    } else if (part.removed) {
      removedChars += part.value.length;
      removedWords += countWords(part.value);
    }
  }

  return {
    addedChars,
    removedChars,
    addedWords,
    removedWords,
    changedChars: addedChars + removedChars,
    hasChanges: addedChars > 0 || removedChars > 0,
  };
}
