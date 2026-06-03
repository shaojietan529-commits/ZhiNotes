"use client";

import dynamic from "next/dynamic";

const PortfolioModule = dynamic(
  () => import("@/components/modules/PortfolioShell"),
  {
    ssr: false,
  }
);

export default function PortfolioRoute() {
  return <PortfolioModule />;
}
