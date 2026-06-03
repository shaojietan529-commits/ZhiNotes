"use client";

import dynamic from "next/dynamic";

const SyncModule = dynamic(() => import("@/components/modules/SyncShell"), {
  ssr: false,
});

export default function SyncRoute() {
  return <SyncModule />;
}
