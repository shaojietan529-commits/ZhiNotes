"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteBlockComment,
  getBlockComments,
  updateBlockComment,
} from "@/lib/db/local/queries";
import type { BlockComment } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";

export const BLOCK_COMMENTS_CHANGED_EVENT = "zhinote:block-comments-changed";
export const INLINE_COMMENT_DELETED_EVENT = "zhinote:inline-comment-deleted";
export const INLINE_COMMENT_SELECTED_EVENT = "zhinote:inline-comment-selected";

interface BlockCommentsProps {
  pageId: string;
  disabled?: boolean;
}

export default function BlockComments({
  pageId,
  disabled = false,
}: BlockCommentsProps) {
  const [comments, setComments] = useState<BlockComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const activeResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await getBlockComments(pageId);
    setComments(rows);
    setLoading(false);
  }, [pageId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });

    const handleChanged = () => void load();
    window.addEventListener(BLOCK_COMMENTS_CHANGED_EVENT, handleChanged);
    return () =>
      window.removeEventListener(BLOCK_COMMENTS_CHANGED_EVENT, handleChanged);
  }, [load]);

  useEffect(() => {
    const handleInlineCommentSelected = (event: Event) => {
      const inlineCommentId = (event as CustomEvent<{ inlineCommentId?: string }>)
        .detail?.inlineCommentId;
      if (!inlineCommentId) return;

      setActiveCommentId(inlineCommentId);
      if (activeResetTimerRef.current) {
        clearTimeout(activeResetTimerRef.current);
      }
      activeResetTimerRef.current = setTimeout(() => {
        setActiveCommentId(null);
        activeResetTimerRef.current = null;
      }, 2400);

      window.requestAnimationFrame(() => {
        const target = document.querySelector(
          `[data-comment-ref="${inlineCommentId}"]`
        );
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    };

    window.addEventListener(
      INLINE_COMMENT_SELECTED_EVENT,
      handleInlineCommentSelected
    );
    return () => {
      window.removeEventListener(
        INLINE_COMMENT_SELECTED_EVENT,
        handleInlineCommentSelected
      );
      if (activeResetTimerRef.current) {
        clearTimeout(activeResetTimerRef.current);
        activeResetTimerRef.current = null;
      }
    };
  }, []);

  const handleToggleResolved = useCallback(
    async (comment: BlockComment) => {
      if (disabled) return;
      await updateBlockComment(comment.id, {
        resolved: comment.resolved ? 0 : 1,
      });
      await load();
    },
    [disabled, load]
  );

  const handleDelete = useCallback(
    async (comment: BlockComment) => {
      if (disabled) return;
      await deleteBlockComment(comment.id);
      if (comment.block_ref.startsWith("inline_")) {
        window.dispatchEvent(
          new CustomEvent(INLINE_COMMENT_DELETED_EVENT, {
            detail: { inlineCommentId: comment.block_ref },
          })
        );
      }
      await load();
    },
    [disabled, load]
  );

  if (loading || comments.length === 0) return null;

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-700">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Comments
        </h3>
        <span className="rounded-full bg-zinc-100 px-1.5 text-xs text-zinc-400 dark:bg-zinc-800">
          {comments.length}
        </span>
      </div>

      {disabled && (
        <p className="mb-4 text-xs text-zinc-400">
          Unlock this page to resolve or delete comments.
        </p>
      )}

      <ul className="space-y-2">
        {comments.map((comment) => {
          const resolved = Boolean(comment.resolved);
          return (
            <li
              key={comment.id}
              data-comment-ref={comment.block_ref}
              className={`rounded-md border px-3 py-2 transition-shadow ${
                activeCommentId === comment.block_ref
                  ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-white dark:ring-amber-500 dark:ring-offset-zinc-950"
                  : ""
              } ${
                resolved
                  ? "border-zinc-100 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60"
                  : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] text-zinc-400">
                    {formatRelativeDate(comment.created_at)}
                  </span>
                  <span className="ml-2 text-[11px] text-zinc-300 dark:text-zinc-600">
                    {formatBlockRef(comment.block_ref)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollToBlock(comment.block_ref)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    Jump
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleResolved(comment)}
                    disabled={disabled}
                    className="text-[11px] text-zinc-400 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-zinc-200"
                  >
                    {resolved ? "Reopen" : "Resolve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(comment)}
                    disabled={disabled}
                    className="text-[11px] text-zinc-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mb-2 rounded bg-zinc-50 px-2 py-1 text-xs leading-5 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                {comment.anchor_text}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">
                {comment.body}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatBlockRef(blockRef: string) {
  if (blockRef.startsWith("inline_")) return `Text ${blockRef.slice(7, 13)}`;
  if (!blockRef.startsWith("blk_")) return blockRef;
  return `Block ${blockRef.slice(4, 10)}`;
}

function scrollToBlock(blockRef: string) {
  const target = blockRef.startsWith("inline_")
    ? document.querySelector(`[data-inline-comment-id="${blockRef}"]`)
    : document.querySelector(`[data-block-id="${blockRef}"]`);

  if (!(target instanceof HTMLElement)) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("zhinote-inline-comment-target");
  window.setTimeout(() => {
    target.classList.remove("zhinote-inline-comment-target");
  }, 1600);
}
