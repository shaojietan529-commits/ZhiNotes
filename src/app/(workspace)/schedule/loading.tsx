import ModuleRouteSkeleton from "@/components/modules/ModuleRouteSkeleton";

export default function MeetingScheduleLoading() {
  return (
    <ModuleRouteSkeleton
      icon="🗓️"
      title="ZhiHui"
      subtitle="正在准备会议日历、本地热缓存和云端索引..."
      primaryActionLabel="+ 新建会议"
    />
  );
}
