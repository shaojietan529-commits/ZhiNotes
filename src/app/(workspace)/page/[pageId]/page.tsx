"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import PageRouteSkeleton from "@/components/page/PageRouteSkeleton";

const PageView = dynamic(() => import("@/components/providers/PageShell"), {
  ssr: false,
  loading: () => <PageRouteSkeleton />,
});

export default function PageRoute() {
  const params = useParams();
  const pageId = params.pageId as string;
  return <PageView pageId={pageId} />;
}
