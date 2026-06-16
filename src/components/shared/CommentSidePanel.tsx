"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteBlockComment,
  getBlockComments,
  updateBlockComment,
} from "@/lib/db/local/queries";
import type { BlockComment } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";
import {
  BLOCK_COMMENTS_CHANGED_EVENT,
  INLINE_COMMENT_DELETED_EVENT,
  INLINE_COMMENT_SELECTED_EVENT,
} from "@/components/shared/BlockComments";

interface CommentSidePanelProps {
  pageId: string;
  disabled?: boolean;
  onClose: () => void;
}

// A Notion-style right-hand comment drawer. It lists all text-anchored
// (inline) and block comments for the page, lets the user jump to the
// commented text, resolve, or delete. New comments are still created from the
// editor by selecting text and pressing ⌘⇧M.
export default function CommentSidePanel({
  pageId,
  disabled = false,
  onClose,
}: CommentSidePanelProps) {
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

  const openCount = comments.filter((c) => !c.resolved).length;

  return (
    <aside className="flex h-screen w-80 shrink-0 flex-col border-l border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            评论
          </h2>
          {comments.length > 0 && (
            <span className="rounded-full bg-zinc-200 px-1.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {openCount > 0 ? openCount : comments.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="关闭评论区"
          title="关闭评论区"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <p className="px-1 py-6 text-center text-xs text-zinc-400">
            正在加载评论…
          </p>
        ) : comments.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <div className="mb-2 text-2xl">💬</div>
            <p className="text-xs leading-5 text-zinc-400">
              还没有评论。
              <br />
              选中正文中的文字，按{" "}
              <kbd className="rounded border border-zinc-300 px-1 text-[10px] dark:border-zinc-600">
                ⌘⇧M
              </kbd>{" "}
              即可在此添加评论。
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {comments.map((comment) => {
              const resolved = Boolean(comment.resolved);
              return (
                <li
                  key={comment.id}
                  data-comment-ref={comment.block_ref}
                  className={`rounded-md border px-3 py-2 transition-shadow ${
                    activeCommentId === comment.block_ref
                      ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-zinc-50 dark:ring-amber-500 dark:ring-offset-zinc-900"
                      : ""
                  } ${
                    resolved
                      ? "border-zinc-100 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60"
                      : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-zinc-400">
                      {formatRelativeDate(comment.created_at)}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => scrollToBlock(comment.block_ref)}
                        className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        title="跳转到对应文字"
                      >
                        跳转
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleResolved(comment)}
                        disabled={disabled}
                        className="text-[11px] text-zinc-400 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-zinc-200"
                      >
                        {resolved ? "重新打开" : "解决"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(comment)}
                        disabled={disabled}
                        className="text-[11px] text-zinc-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <div className="mb-2 rounded bg-amber-50 px-2 py-1 text-xs leading-5 text-zinc-500 dark:bg-amber-950/30 dark:text-zinc-400">
                    {comment.anchor_text}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {comment.body}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {disabled && (
        <p className="border-t border-zinc-200 px-4 py-2 text-[11px] text-zinc-400 dark:border-zinc-800">
          解锁页面后可以解决或删除评论。
        </p>
      )}
    </aside>
  );
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
