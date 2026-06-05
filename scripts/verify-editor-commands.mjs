#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  keyboardShortcuts: "src/components/editor/extensions/KeyboardShortcuts.ts",
  slashSuggestion: "src/components/editor/extensions/SlashCommandSuggestion.ts",
  filePreviewUpload: "src/components/editor/filePreviewUpload.ts",
  blockDragHandle: "src/components/editor/BlockDragHandleLayer.tsx",
  editor: "src/components/editor/Editor.tsx",
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
  const keyboardShortcuts = readProjectFile(files.keyboardShortcuts);
  const slashSuggestion = readProjectFile(files.slashSuggestion);
  const filePreviewUpload = readProjectFile(files.filePreviewUpload);
  const blockDragHandle = readProjectFile(files.blockDragHandle);
  const editor = readProjectFile(files.editor);
  const readme = readProjectFile(files.readme);

  assertIncludes(
    files.packageJson,
    packageJson,
    "verify:editor",
    "Editor command contract must be runnable from npm scripts."
  );
  assertIncludes(
    files.editor,
    editor,
    "KeyboardShortcuts",
    "Editor must load the local keyboard shortcut extension."
  );
  assertIncludes(
    files.editor,
    editor,
    "SlashCommandExtension",
    "Editor must load the slash command extension."
  );

  for (const snippet of [
    "addProseMirrorPlugins",
    "isHeadingThreeShortcut",
    "event.code === \"Digit3\"",
    "event.key === \"#\"",
    "event.altKey && isDigitThree",
    "setHeading({ level: 3 })",
    "\"Mod-Shift-3\"",
    "\"Mod-#\"",
    "\"Mod-Alt-3\"",
  ]) {
    assertIncludes(
      files.keyboardShortcuts,
      keyboardShortcuts,
      snippet,
      "Heading 3 shortcut must support primary and fallback key paths."
    );
  }

  for (const snippet of [
    "新建页面 / Page",
    "创建子页面，插入页面链接，并自动进入新页面（/page）",
    "\"page\"",
    "\"subpage\"",
    "\"new page\"",
    "\"create page\"",
    "\"new\"",
    "\"新页面\"",
    "window.location.href = `/page/${page.id}`",
    "updateWikiLinks",
  ]) {
    assertIncludes(
      files.slashSuggestion,
      slashSuggestion,
      snippet,
      "/page slash command must stay discoverable and open the new page."
    );
  }

  for (const snippet of [
    "| \"heading3\"",
    "type: \"heading3\"",
    "label: \"标题 3\"",
    "aliases: [\"h3\", \"subheading\", \"三级标题\", \"小标题\"]",
    "case \"heading3\"",
    "attrs: { level: 3 }",
  ]) {
    assertIncludes(
      files.blockDragHandle,
      blockDragHandle,
      snippet,
      "Block insert menu must expose Heading 3 alongside Heading 1 and Heading 2."
    );
  }

  assertIncludes(
    files.slashSuggestion,
    slashSuggestion,
    "item.aliases?.some((alias) => alias.toLowerCase().includes(lower))",
    "Slash command search must include aliases so /page can match the page command."
  );
  assertIncludes(
    files.readme,
    readme,
    "Cmd/Ctrl+Alt+3",
    "README must document the browser-safe H3 fallback."
  );
  assertIncludes(
    files.readme,
    readme,
    "/page",
    "README must document the /page slash command."
  );

  for (const snippet of [
    "HTML_REPORT_ACCEPT",
    "MARKDOWN_FILE_ACCEPT",
    "promptAndInsertHtmlReportPreview",
    "promptAndInsertMarkdownFilePreview",
  ]) {
    assertIncludes(
      files.filePreviewUpload,
      filePreviewUpload,
      snippet,
      "File upload helpers must expose explicit HTML and Markdown page-preview entrypoints."
    );
  }

  for (const snippet of [
    "promptAndInsertHtmlReportPreview",
    "promptAndInsertMarkdownFilePreview",
    "HTML 报告",
    "本地上传 HTML，插入沙盒原生预览块（默认阻止外部资源）",
    "Markdown 文件预览",
    "本地上传 Markdown/MDX，保留原文件预览块，并可再导入",
    "Markdown 导入为可编辑块",
    "选择 Markdown 文件并直接写入当前页面内容",
  ]) {
    assertIncludes(
      files.slashSuggestion,
      slashSuggestion,
      snippet,
      "Slash commands must keep HTML and Markdown file workflows clearly separated."
    );
  }

  if (failures.length > 0) {
    console.error("Editor command verification failed");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Editor command verification passed");
  console.log(
    JSON.stringify(
      {
        h3_shortcut_paths: 3,
        page_slash_aliases: 6,
        block_insert_heading_levels: 3,
        file_workflow_entrypoints: 3,
        page_command_opens_new_page: true,
        local_only: true,
      },
      null,
      2
    )
  );
}

run();
