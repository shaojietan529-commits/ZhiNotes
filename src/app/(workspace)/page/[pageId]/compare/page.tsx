"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useParams } from "next/navigation";

const CompareView = dynamic(
  () => import("@/components/comparison/CompareShell"),
  { ssr: false }
);

export default function ComparePage() {
  const params = useParams();
  const pageId = params.pageId as string;
  return (
    <Suspense fallback={null}>
      <CompareView pageId={pageId} />
    </Suspense>
  );
}
