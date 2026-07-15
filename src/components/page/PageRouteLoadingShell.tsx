import PageRouteSkeleton from "@/components/page/PageRouteSkeleton";
import PageRouteLocalFirstLoadingEnhancer from "@/components/page/PageRouteLocalFirstLoadingEnhancer";

export default function PageRouteLoadingShell() {
  return (
    <>
      <div className="page-route-server-loading-shell">
        <PageRouteSkeleton />
      </div>
      <PageRouteLocalFirstLoadingEnhancer />
    </>
  );
}
