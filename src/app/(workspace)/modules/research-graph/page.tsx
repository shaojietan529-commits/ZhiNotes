"use client";

import dynamic from "next/dynamic";

const ResearchGraphModule = dynamic(
  () => import("@/components/modules/ResearchGraphShell"),
  {
    ssr: false,
  }
);

export default function ResearchGraphRoute() {
  return <ResearchGraphModule />;
}
