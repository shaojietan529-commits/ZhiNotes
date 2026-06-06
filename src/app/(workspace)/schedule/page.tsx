"use client";

import dynamic from "next/dynamic";

const MeetingScheduleModule = dynamic(
  () => import("@/components/modules/MeetingScheduleShell"),
  { ssr: false }
);

export default function MeetingScheduleRoute() {
  return <MeetingScheduleModule />;
}
