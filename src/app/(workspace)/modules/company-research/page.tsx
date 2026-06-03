"use client";

import dynamic from "next/dynamic";

const CompanyResearchModule = dynamic(
  () => import("@/components/modules/CompanyResearchShell"),
  {
    ssr: false,
  }
);

export default function CompanyResearchRoute() {
  return <CompanyResearchModule />;
}
