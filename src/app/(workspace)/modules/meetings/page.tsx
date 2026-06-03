"use client";

import dynamic from "next/dynamic";

const MeetingsModule = dynamic(
  () => import("@/components/modules/MeetingsShell"),
  {
    ssr: false,
  }
);

export default function MeetingsRoute() {
  return <MeetingsModule />;
}
