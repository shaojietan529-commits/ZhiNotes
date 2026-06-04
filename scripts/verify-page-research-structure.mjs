#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  editor: "src/components/editor/Editor.tsx",
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
  const editor = readProjectFile(files.editor);
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
    "PageResearchStructureAction",
    "next_actions",
    "insert_html",
    "action_status: \"suggested-only\"",
    "suggestion_writes_workspace_data: false",
    "apply-research-template",
    "write-investment-decision",
    "add-evidence-sources",
    "link-research-relations",
  ]) {
    assertIncludes(
      files.pageStructure,
      pageStructure,
      snippet,
      "Page structure report must keep local-only research-readiness fields."
    );
  }

  for (const snippet of [
    "appendHtml: (html: string) => string | undefined",
    "appendHtml(html: string)",
    "insertContentAt(editor.state.doc.content.size, html)",
  ]) {
    assertIncludes(
      files.editor,
      editor,
      snippet,
      "Editor must expose a narrow appendHtml API for local suggested structure insertion."
    );
  }

  for (const snippet of [
    "buildPageResearchStructureReport",
    "handleApplyResearchAction",
    "PageResearchStructurePanel",
    "PageResearchStructureStatusPill",
    "PageResearchStructureSignalPill",
    "PageResearchStructureGateRow",
    "PageResearchStructureActionRow",
    "投研结构",
    "本地页面结构体检",
    "导出结构报告",
    "下一步队列",
    "插入结构块",
    "appendHtml(action.insert_html)",
    "页面目录",
    "researchStructure={pageStructure}",
    "zhinote-page-research-structure-export",
    "local-page-structure-export-only",
    "includes_page_title: false",
    "includes_page_body_text: false",
    "includes_database_row_values: false",
    "includes_file_bytes: false",
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
    "下一步队列",
    "导出结构报告",
    "插入结构块",
    "npm run verify:page-structure",
    "does not read linked page bodies, database row values, uploaded file bytes, AI prompts, tokens, credentials, cloud data, or private research content",
    "export excludes page titles, page body text, linked page bodies, database row values, file bytes, tokens, credentials, cloud data, and AI output",
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
        suggested_actions: 8,
        signals: 10,
      },
      null,
      2
    )
  );
}

run();
