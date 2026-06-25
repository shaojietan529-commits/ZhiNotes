"use client";

import dynamic from "next/dynamic";
import ModuleRouteSkeleton from "@/components/modules/ModuleRouteSkeleton";

const DailyNotesModule = dynamic(
  () => import("@/components/modules/DailyNotesShell"),
  { ssr: false, loading: () => <DailyRouteLoading /> }
);

export default function DailyNotesRoute() {
  return <DailyNotesModule />;
}

function DailyRouteLoading() {
  return (
    <ModuleRouteSkeleton
      icon="📅"
      title="每日纪要"
      subtitle="正在准备本地热缓存和云端索引..."
      primaryActionLabel="+ 今天新增"
    />
  );
}
