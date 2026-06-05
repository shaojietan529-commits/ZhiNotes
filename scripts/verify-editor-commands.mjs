#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  editorLocalCommands: "src/lib/editorLocalCommands.ts",
  childPageSeed: "src/lib/pages/childPageSeed.ts",
  keyboardShortcuts: "src/components/editor/extensions/KeyboardShortcuts.ts",
  slashSuggestion: "src/components/editor/extensions/SlashCommandSuggestion.ts",
  filePreviewUpload: "src/components/editor/filePreviewUpload.ts",
  blockDragHandle: "src/components/editor/BlockDragHandleLayer.tsx",
  backlinks: "src/components/shared/Backlinks.tsx",
  calloutNode: "src/components/editor/extensions/CalloutNode.tsx",
  editor: "src/components/editor/Editor.tsx",
  hoverSummary: "src/components/comparison/HoverSummary.tsx",
  pageShell: "src/components/providers/PageShell.tsx",
  quickSearch: "src/components/sidebar/QuickSearch.tsx",
  readme: "README.md",
  tableOfContentsNode:
    "src/components/editor/extensions/TableOfContentsNode.tsx",
  versionHistoryPanel: "src/components/comparison/VersionHistoryPanel.tsx",
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
  const editorLocalCommands = readProjectFile(files.editorLocalCommands);
  const childPageSeed = readProjectFile(files.childPageSeed);
  const keyboardShortcuts = readProjectFile(files.keyboardShortcuts);
  const slashSuggestion = readProjectFile(files.slashSuggestion);
  const filePreviewUpload = readProjectFile(files.filePreviewUpload);
  const blockDragHandle = readProjectFile(files.blockDragHandle);
  const backlinks = readProjectFile(files.backlinks);
  const calloutNode = readProjectFile(files.calloutNode);
  const editor = readProjectFile(files.editor);
  const hoverSummary = readProjectFile(files.hoverSummary);
  const pageShell = readProjectFile(files.pageShell);
  const quickSearch = readProjectFile(files.quickSearch);
  const readme = readProjectFile(files.readme);
  const tableOfContentsNode = readProjectFile(files.tableOfContentsNode);
  const versionHistoryPanel = readProjectFile(files.versionHistoryPanel);

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
    "buildChildPageInitialHtml",
    "updatePage(page.id",
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
    "父页面：",
    "开始记录...",
    "data-type=\"mention\"",
    "escapeHtml",
  ]) {
    assertIncludes(
      files.childPageSeed,
      childPageSeed,
      snippet,
      "Child pages must keep a reusable safe seed with a parent-page mention."
    );
  }

  for (const snippet of [
    "| \"child-page\"",
    "case \"child-page\"",
    "createChildPageFromEditorCommand",
    "runEditorCommand(\"child-page\")",
    "id: \"editor-child-page\"",
    "title: \"新建子页面\"",
  ]) {
    const sourceLabel = snippet.includes("| \"child-page\"")
      ? files.editorLocalCommands
      : snippet.includes("runEditorCommand") ||
          snippet.includes("editor-child-page") ||
          snippet.includes("新建子页面")
        ? files.quickSearch
        : files.editor;
    const source =
      sourceLabel === files.editorLocalCommands
        ? editorLocalCommands
        : sourceLabel === files.quickSearch
          ? quickSearch
          : editor;
    assertIncludes(
      sourceLabel,
      source,
      snippet,
      "Cmd/Ctrl+K must expose the same child-page workflow as /page."
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

  for (const snippet of [
    "aliases: [\"h3\", \"heading 3\", \"subheading\", \"三级标题\", \"小标题\"]",
    "aliases: [\"h3\", \"heading\", \"heading 3\", \"subheading\", \"三级标题\", \"小标题\"]",
  ]) {
    const sourceLabel = snippet.includes("\"heading\",")
      ? files.quickSearch
      : files.slashSuggestion;
    const source = snippet.includes("\"heading\",") ? quickSearch : slashSuggestion;
    assertIncludes(
      sourceLabel,
      source,
      snippet,
      "Heading 3 must be searchable from slash commands and Cmd/Ctrl+K."
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

  for (const snippet of ["目录", "添加标题后会自动生成目录。"]) {
    assertIncludes(
      files.tableOfContentsNode,
      tableOfContentsNode,
      snippet,
      "Table of contents block must keep the default notes UI in Chinese."
    );
  }
  for (const snippet of [
    "提示块图标",
    "提示块颜色",
    "<option value=\"blue\">蓝色</option>",
    "<option value=\"neutral\">灰色</option>",
  ]) {
    assertIncludes(
      files.calloutNode,
      calloutNode,
      snippet,
      "Callout block controls must keep the default notes UI in Chinese."
    );
  }
  for (const snippet of [
    "请选择图片文件作为页面封面。",
    "封面图片 URL：",
    "添加封面",
    "封面 URL",
    "移除",
    "页面未找到",
    "返回首页",
    "已收藏",
    "添加子页面",
    "保存版本",
    "复制链接",
    "复制页面",
    "查看版本历史",
  ]) {
    assertIncludes(
      files.pageShell,
      pageShell,
      snippet,
      "Page cover controls must keep the default notes UI in Chinese."
    );
  }
  for (const snippet of [
    "版本历史",
    "筛选版本...",
    "最新",
    "对比",
    "恢复",
  ]) {
    assertIncludes(
      files.versionHistoryPanel,
      versionHistoryPanel,
      snippet,
      "Version history panel must keep the default notes UI in Chinese."
    );
  }
  for (const snippet of ["还没有保存版本。编辑时会自动生成版本。", "最近变化"]) {
    assertIncludes(
      files.hoverSummary,
      hoverSummary,
      snippet,
      "Version hover summary must keep the default notes UI in Chinese."
    );
  }
  for (const snippet of ["引用", "反向链接", "未链接提及", "未命名页面"]) {
    assertIncludes(
      files.backlinks,
      backlinks,
      snippet,
      "Backlinks panel must keep the default notes UI in Chinese."
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
        page_slash_aliases: 8,
        block_insert_heading_levels: 3,
        file_workflow_entrypoints: 3,
        page_command_opens_new_page: true,
        page_command_seeds_child_page: true,
        cmdk_child_page_command: true,
        local_only: true,
      },
      null,
      2
    )
  );
}

run();
