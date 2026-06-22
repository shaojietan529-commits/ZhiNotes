"use client";

import { useWorkspaceStore } from "@/stores/workspaceStore";

export function usePageRevision(): string {
  return useWorkspaceStore((s) => {
    const latestUpdatedAt = s.pages.reduce(
      (latest, page) => (page.updated_at > latest ? page.updated_at : latest),
      ""
    );
    return `${s.pages.length}:${latestUpdatedAt}`;
  });
}

export function usePageRecordRevision(pageId: string | null): string {
  return useWorkspaceStore((s) => {
    if (!pageId) return "";
    const page = s.pages.find((candidate) => candidate.id === pageId);
    if (!page) return "missing";
    return `${page.updated_at}:${page.deleted_at ?? ""}`;
  });
}
