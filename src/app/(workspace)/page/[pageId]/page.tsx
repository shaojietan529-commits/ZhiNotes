"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import PageRouteSkeleton from "@/components/page/PageRouteSkeleton";
import { readPageRouteHandoff } from "@/lib/pages/pageRouteHandoff";

const PageView = dynamic(() => import("@/components/providers/PageShell"), {
  ssr: false,
  loading: () => <PageRouteLoadingSkeleton />,
});

export default function PageRoute() {
  const params = useParams();
  const pageId = params.pageId as string;
  return <PageView pageId={pageId} />;
}

function PageRouteLoadingSkeleton() {
  const params = useParams();
  const pageId = params.pageId as string;
  const previewPage = pageId ? readPageRouteHandoff(pageId) : null;

  return (
    <PageRouteSkeleton
      preview={
        previewPage
          ? {
              title: previewPage.title,
              icon: previewPage.icon,
            }
          : undefined
      }
    />
  );
}
