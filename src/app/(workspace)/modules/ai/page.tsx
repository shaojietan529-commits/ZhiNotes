"use client";

import dynamic from "next/dynamic";

const AiWorkbenchModule = dynamic(
  () => import("@/components/modules/AiWorkbenchShell"),
  {
    ssr: false,
  }
);

export default function AiWorkbenchRoute() {
  return <AiWorkbenchModule />;
}
