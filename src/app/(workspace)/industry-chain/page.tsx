"use client";

import dynamic from "next/dynamic";

const IndustryChainModule = dynamic(
  () => import("@/components/modules/IndustryChainShell"),
  { ssr: false }
);

export default function IndustryChainRoute() {
  return <IndustryChainModule />;
}
