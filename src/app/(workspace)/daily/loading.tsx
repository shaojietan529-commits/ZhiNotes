import ModuleRouteSkeleton from "@/components/modules/ModuleRouteSkeleton";

export default function DailyNotesLoading() {
  return (
    <ModuleRouteSkeleton
      icon="📅"
      title="每日纪要"
      subtitle="正在准备本地热缓存和云端索引..."
      primaryActionLabel="+ 今天新增"
    />
  );
}
