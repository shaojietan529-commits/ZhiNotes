"use client";

import dynamic from "next/dynamic";

const ReportsModule = dynamic(
  () => import("@/components/modules/ReportsShell"),
  {
    ssr: false,
  }
);

export default function ReportsRoute() {
  return <ReportsModule />;
}
