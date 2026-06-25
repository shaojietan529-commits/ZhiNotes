"use client";

import dynamic from "next/dynamic";
import ModuleRouteSkeleton from "@/components/modules/ModuleRouteSkeleton";

const MeetingScheduleModule = dynamic(
  () => import("@/components/modules/MeetingScheduleShell"),
  { ssr: false, loading: () => <MeetingRouteLoading /> }
);

export default function MeetingScheduleRoute() {
  return <MeetingScheduleModule />;
}

function MeetingRouteLoading() {
  return (
    <ModuleRouteSkeleton
      icon="🗓️"
      title="ZhiHui"
      subtitle="正在准备会议日历、本地热缓存和云端索引..."
      primaryActionLabel="+ 新建会议"
    />
  );
}
