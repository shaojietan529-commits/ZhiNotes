"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addPageComment,
  deletePageComment,
  getPageComments,
  updatePageComment,
} from "@/lib/db/local/queries";
import type { PageComment } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";

interface PageCommentsProps {
  pageId: string;
  disabled?: boolean;
}

export default function PageComments({
  pageId,
  disabled = false,
}: PageCommentsProps) {
  const [comments, setComments] = useState<PageComment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const rows = await getPageComments(pageId);
    setComments(rows);
    setLoading(false);
  }, [pageId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (composerOpen) textareaRef.current?.focus();
  }, [composerOpen]);

  const handleAdd = useCallback(async () => {
    const body = draft.trim();
    if (!body || disabled) return;
    await addPageComment(pageId, body);
    setDraft("");
    setComposerOpen(false);
    await load();
  }, [disabled, draft, load, pageId]);

  const handleToggleResolved = useCallback(
    async (comment: PageComment) => {
      if (disabled) return;
      await updatePageComment(comment.id, {
        resolved: comment.resolved ? 0 : 1,
      });
      await load();
    },
    [disabled, load]
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (disabled) return;
      await deletePageComment(commentId);
      await load();
    },
    [disabled, load]
  );

  if (loading) return null;

  // Nothing written yet: collapse to a single ghost row that only really
  // shows itself on hover. Clicking opens the composer inline.
  if (comments.length === 0 && !composerOpen) {
    if (disabled) return null;
    return (
      <div className="group/comments mb-1">
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-50 hover:text-zinc-500 dark:text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-400"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          添加评论
        </button>
      </div>
    );
  }

  return (
    <section className="mb-2">
      {comments.length > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
            评论
          </h3>
          <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] text-zinc-400 dark:bg-zinc-800">
            {comments.length}
          </span>
        </div>
      )}

      {comments.length > 0 && (
        <ul className="mb-2 space-y-2">
          {comments.map((comment) => {
            const resolved = Boolean(comment.resolved);
            return (
              <li
                key={comment.id}
                className={`rounded-md border px-3 py-2 ${
                  resolved
                    ? "border-zinc-100 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60"
                    : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-zinc-400">
                    {formatRelativeDate(comment.created_at)}
                  </span>
                  <div className="flex items-center gap-2">
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
                      onClick={() => handleDelete(comment.id)}
                      disabled={disabled}
                      className="text-[11px] text-zinc-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6">{comment.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      {!disabled &&
        (composerOpen || comments.length > 0 ? (
          composerOpen ? (
            <div className="flex items-start gap-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !draft.trim()) {
                    setComposerOpen(false);
                  }
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    void handleAdd();
                  }
                }}
                placeholder="添加本地评论...（Esc 收起）"
                rows={2}
                className="min-h-14 flex-1 resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-300 focus:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
              />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!draft.trim()}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                >
                  添加
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft("");
                    setComposerOpen(false);
                  }}
                  className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="rounded px-1.5 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-300"
            >
              + 添加评论
            </button>
          )
        ) : null)}
    </section>
  );
}
