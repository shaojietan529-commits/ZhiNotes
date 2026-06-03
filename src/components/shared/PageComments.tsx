"use client";

import { useCallback, useEffect, useState } from "react";
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

  const handleAdd = useCallback(async () => {
    const body = draft.trim();
    if (!body || disabled) return;
    await addPageComment(pageId, body);
    setDraft("");
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

      {!disabled && (
        <div className="mb-4 flex items-start gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a local comment..."
            rows={2}
            className="min-h-16 flex-1 resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-300 focus:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.trim()}
            className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
          >
            Add
          </button>
        </div>
      )}

      {disabled && (
        <p className="mb-4 text-xs text-zinc-400">
          Unlock this page to add or change comments.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-zinc-400">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
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
                      {resolved ? "Reopen" : "Resolve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      disabled={disabled}
                      className="text-[11px] text-zinc-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6">{comment.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

