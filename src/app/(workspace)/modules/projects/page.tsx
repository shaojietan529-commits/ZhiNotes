"use client";

import dynamic from "next/dynamic";

const ProjectsModule = dynamic(
  () => import("@/components/modules/ProjectsShell"),
  {
    ssr: false,
  }
);

export default function ProjectsRoute() {
  return <ProjectsModule />;
}
