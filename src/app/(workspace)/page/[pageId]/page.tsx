"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import PageRouteLocalFirstLoadingShell from "@/components/page/PageRouteLocalFirstLoadingShell";

const PageView = dynamic(() => import("@/components/providers/PageShell"), {
  ssr: false,
  loading: () => <PageRouteLocalFirstLoadingShell />,
});

export default function PageRoute() {
  const params = useParams();
  const pageId = params.pageId as string;
  return <PageView pageId={pageId} />;
}
