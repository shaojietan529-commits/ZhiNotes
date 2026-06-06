"use client";

import dynamic from "next/dynamic";

const DailyNotesModule = dynamic(
  () => import("@/components/modules/DailyNotesShell"),
  { ssr: false }
);

export default function DailyNotesRoute() {
  return <DailyNotesModule />;
}
