"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const PageView = dynamic(() => import("@/components/providers/PageShell"), {
  ssr: false,
});

export default function PageRoute() {
  const params = useParams();
  const pageId = params.pageId as string;
  return <PageView pageId={pageId} />;
}
