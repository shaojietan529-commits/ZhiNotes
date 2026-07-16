"use client";

import { useParams } from "next/navigation";
import PageRouteQuickDraftInput from "@/components/page/PageRouteQuickDraftInput";
import PageRouteSkeleton from "@/components/page/PageRouteSkeleton";
import { readPageRouteHandoff } from "@/lib/pages/pageRouteHandoff";
import { readPendingPageDraft } from "@/lib/pages/pendingPageDrafts";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export default function PageRouteLocalFirstLoadingShell() {
  const params = useParams();
  const pageId = getRoutePageId(params.pageId);
  const previewPage = pageId ? readLocalFirstPageRouteSeed(pageId) : null;

  return (
    <PageRouteSkeleton
      quickDraft={
        previewPage?.content_text === "" && pageId ? (
          <PageRouteQuickDraftInput pageId={pageId} initialPage={previewPage} />
        ) : undefined
      }
      preview={
        previewPage
          ? {
              title: previewPage.title,
              icon: previewPage.icon,
              properties: previewPage.properties,
            }
          : undefined
      }
    />
  );
}

function readLocalFirstPageRouteSeed(pageId: string) {
  return (
    readPendingPageDraft(pageId) ??
    useWorkspaceStore.getState().getPageById(pageId) ??
    readPageRouteHandoff(pageId) ??
    null
  );
}

function getRoutePageId(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
