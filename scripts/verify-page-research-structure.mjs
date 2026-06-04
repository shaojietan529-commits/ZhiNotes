#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  pageStructure: "src/lib/pages/pageResearchStructure.ts",
  pageShell: "src/components/providers/PageShell.tsx",
  readme: "README.md",
};

const failures = [];

function readProjectFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function assertIncludes(sourceLabel, source, snippet, message) {
  if (!source.includes(snippet)) {
    failures.push(`${sourceLabel} missing ${snippet}: ${message}`);
  }
}

function run() {
  const packageJson = readProjectFile(files.packageJson);
  const pageStructure = readProjectFile(files.pageStructure);
  const pageShell = readProjectFile(files.pageShell);
  const readme = readProjectFile(files.readme);

  for (const snippet of [
    "zhinote-page-research-structure",
    "local-page-structure-only",
    "buildPageResearchStructureReport",
    "reads_linked_page_bodies: false",
    "reads_database_rows: false",
    "reads_file_bytes: false",
    "uploads_data: false",
    "connects_cloud_services: false",
    "enables_ai: false",
    "writes_workspace_data: false",
    "decision_markers",
    "thesis_markers",
    "source_markers",
    "action_markers",
    "risk_markers",
    "catalyst_markers",
    "PageResearchStructureGate",
    "PageResearchStructureSignal",
  ]) {
    assertIncludes(
      files.pageStructure,
      pageStructure,
      snippet,
      "Page structure report must keep local-only research-readiness fields."
    );
  }

  for (const snippet of [
    "buildPageResearchStructureReport",
    "PageResearchStructurePanel",
    "PageResearchStructureStatusPill",
    "PageResearchStructureSignalPill",
    "PageResearchStructureGateRow",
    "投研结构",
    "本地页面结构体检",
    "页面目录",
    "researchStructure={pageStructure}",
  ]) {
    assertIncludes(
      files.pageShell,
      pageShell,
      snippet,
      "Page info panel must render the local research structure report."
    );
  }

  assertIncludes(
    files.packageJson,
    packageJson,
    '"verify:page-structure": "node scripts/verify-page-research-structure.mjs"',
    "package.json must expose the focused page-structure verifier."
  );

  for (const snippet of [
    "local page research structure panel",
    "投研结构",
    "npm run verify:page-structure",
    "does not read linked page bodies, database row values, uploaded file bytes, AI prompts, tokens, credentials, cloud data, or private research content",
  ]) {
    assertIncludes(
      files.readme,
      readme,
      snippet,
      "README must document the Notes and Pages research-structure boundary."
    );
  }

  if (failures.length > 0) {
    console.error("Page research structure verification failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("Page research structure verification passed.");
  console.log(
    JSON.stringify(
      {
        format: "zhinote-page-research-structure-verification",
        checked_files: Object.keys(files).length,
        local_boundary: true,
        gates: 6,
        signals: 10,
      },
      null,
      2
    )
  );
}

run();
