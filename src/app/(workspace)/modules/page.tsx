"use client";

import dynamic from "next/dynamic";

const ModuleHub = dynamic(() => import("@/components/modules/ModuleHubShell"), {
  ssr: false,
});

export default function ModulesRoute() {
  return <ModuleHub />;
}
