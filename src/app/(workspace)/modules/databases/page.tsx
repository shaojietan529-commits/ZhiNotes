"use client";

import dynamic from "next/dynamic";

const DatabasesModule = dynamic(
  () => import("@/components/modules/DatabasesShell"),
  {
    ssr: false,
  }
);

export default function DatabasesRoute() {
  return <DatabasesModule />;
}
