"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import DatabaseRouteSkeleton from "@/components/database/DatabaseRouteSkeleton";

const DatabasePage = dynamic(
  () => import("@/components/providers/DatabasePageShell"),
  { ssr: false, loading: () => <DatabaseRouteSkeleton /> }
);

export default function DatabaseRoute() {
  const params = useParams();
  const databaseId = params.databaseId as string;
  return <DatabasePage databaseId={databaseId} />;
}
