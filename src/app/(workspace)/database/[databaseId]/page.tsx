"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const DatabasePage = dynamic(
  () => import("@/components/providers/DatabasePageShell"),
  { ssr: false }
);

export default function DatabaseRoute() {
  const params = useParams();
  const databaseId = params.databaseId as string;
  return <DatabasePage databaseId={databaseId} />;
}
