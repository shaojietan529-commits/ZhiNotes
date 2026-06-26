#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  editorLocalCommands: "src/lib/editorLocalCommands.ts",
  childPageSeed: "src/lib/pages/childPageSeed.ts",
  compareShell: "src/components/comparison/CompareShell.tsx",
  markdownToHtml: "src/lib/markdown/markdownToHtml.ts",
  notesShell: "src/components/modules/NotesShell.tsx",
  pageExport: "src/lib/export/pageExport.ts",
  keyboardShortcuts: "src/components/editor/extensions/KeyboardShortcuts.ts",
  slashSuggestion: "src/components/editor/extensions/SlashCommandSuggestion.ts",
  filePreviewUpload: "src/components/editor/filePreviewUpload.ts",
  blockDragHandle: "src/components/editor/BlockDragHandleLayer.tsx",
  blockComments: "src/components/shared/BlockComments.tsx",
  backlinks: "src/components/shared/Backlinks.tsx",
  breadcrumb: "src/components/shared/Breadcrumb.tsx",
  breadcrumbBlock: "src/components/editor/extensions/BreadcrumbBlockNode.tsx",
  calloutNode: "src/components/editor/extensions/CalloutNode.tsx",
  childPageTree: "src/components/page/ChildPageTree.tsx",
  dateDisplay: "src/components/shared/DateDisplay.tsx",
  dates: "src/lib/utils/dates.ts",
  editor: "src/components/editor/Editor.tsx",
  hoverSummary: "src/components/comparison/HoverSummary.tsx",
  iconPicker: "src/components/shared/IconPicker.tsx",
  industryChainSearch: "src/lib/pages/industryChainSearch.ts",
  moveToDialog: "src/components/page/MoveToDialog.tsx",
  pageComments: "src/components/shared/PageComments.tsx",
  pageContextMenu: "src/components/page/PageContextMenu.tsx",
  pageLocalCommands: "src/lib/pageLocalCommands.ts",
  pageShell: "src/components/providers/PageShell.tsx",
  pageActionsMenu: "src/components/page/PageActionsMenu.tsx",
  pageProperties: "src/components/page/PageProperties.tsx",
  quickSearch: "src/components/sidebar/QuickSearch.tsx",
  researchTemplateStarters: "src/lib/modules/researchTemplateStarters.ts",
  readme: "README.md",
  sideBySideDiff: "src/components/comparison/SideBySideDiff.tsx",
  subPageTree: "src/components/shared/SubPageTree.tsx",
  syncedBlockNode: "src/components/editor/extensions/SyncedBlockNode.tsx",
  syncedBlockRegistry: "src/lib/pages/syncedBlockRegistry.ts",
  tableOfContentsNode:
    "src/components/editor/extensions/TableOfContentsNode.tsx",
  templateButtonNode: "src/components/editor/extensions/TemplateButtonNode.tsx",
  versionHistoryPanel: "src/components/comparison/VersionHistoryPanel.tsx",
  wikiLinkList: "src/components/editor/extensions/WikiLinkList.tsx",
  wikiSuggestion: "src/components/editor/extensions/WikiLinkSuggestion.ts",
  wikiReferenceNode: "src/components/editor/extensions/WikiReferenceNode.tsx",
  workspaceBackup: "src/lib/export/workspaceBackup.ts",
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

function assertNotIncludes(sourceLabel, source, snippet, message) {
  if (source.includes(snippet)) {
    failures.push(`${sourceLabel} unexpectedly includes ${snippet}: ${message}`);
  }
}

function run() {
  const packageJson = readProjectFile(files.packageJson);
  const editorLocalCommands = readProjectFile(files.editorLocalCommands);
  const childPageSeed = readProjectFile(files.childPageSeed);
  const compareShell = readProjectFile(files.compareShell);
  const markdownToHtml = readProjectFile(files.markdownToHtml);
  const notesShell = readProjectFile(files.notesShell);
  const pageExport = readProjectFile(files.pageExport);
  const keyboardShortcuts = readProjectFile(files.keyboardShortcuts);
  const slashSuggestion = readProjectFile(files.slashSuggestion);
  const filePreviewUpload = readProjectFile(files.filePreviewUpload);
  const blockDragHandle = readProjectFile(files.blockDragHandle);
  const blockComments = readProjectFile(files.blockComments);
  const backlinks = readProjectFile(files.backlinks);
  const breadcrumb = readProjectFile(files.breadcrumb);
  const breadcrumbBlock = readProjectFile(files.breadcrumbBlock);
  const calloutNode = readProjectFile(files.calloutNode);
  const childPageTree = readProjectFile(files.childPageTree);
  const dateDisplay = readProjectFile(files.dateDisplay);
  const dates = readProjectFile(files.dates);
  const editor = readProjectFile(files.editor);
  const hoverSummary = readProjectFile(files.hoverSummary);
  const iconPicker = readProjectFile(files.iconPicker);
  const industryChainSearch = readProjectFile(files.industryChainSearch);
  const moveToDialog = readProjectFile(files.moveToDialog);
  const pageComments = readProjectFile(files.pageComments);
  const pageContextMenu = readProjectFile(files.pageContextMenu);
  const pageLocalCommands = readProjectFile(files.pageLocalCommands);
  const pageShell = readProjectFile(files.pageShell);
  const pageActionsMenu = readProjectFile(files.pageActionsMenu);
  const pageProperties = readProjectFile(files.pageProperties);
  const quickSearch = readProjectFile(files.quickSearch);
  const researchTemplateStarters = readProjectFile(
    files.researchTemplateStarters
  );
  const readme = readProjectFile(files.readme);
  const sideBySideDiff = readProjectFile(files.sideBySideDiff);
  const subPageTree = readProjectFile(files.subPageTree);
  const syncedBlockNode = readProjectFile(files.syncedBlockNode);
  const syncedBlockRegistry = readProjectFile(files.syncedBlockRegistry);
  const tableOfContentsNode = readProjectFile(files.tableOfContentsNode);
  const templateButtonNode = readProjectFile(files.templateButtonNode);
  const versionHistoryPanel = readProjectFile(files.versionHistoryPanel);
  const wikiLinkList = readProjectFile(files.wikiLinkList);
  const wikiSuggestion = readProjectFile(files.wikiSuggestion);
  const wikiReferenceNode = readProjectFile(files.wikiReferenceNode);
  const workspaceBackup = readProjectFile(files.workspaceBackup);

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
    "dispatchEditorLocalCommand",
    "\"Mod-Shift-m\"",
    "dispatchEditorLocalCommand(\"block-comment\")",
    "dispatchEditorBlockMenu",
    "\"Mod-/\"",
    "\"Mod-Shift-9\"",
    "dispatchEditorLocalCommand(\"child-page\")",
  ]) {
    assertIncludes(
      files.keyboardShortcuts,
      keyboardShortcuts,
      snippet,
      "Keyboard shortcuts must expose Notion-style comment and block menu actions."
    );
  }

  for (const snippet of [
    "handleNotionMarkdownShortcut",
    "textBefore === \">\"",
    ".insertToggleBlock()",
    "textBefore === \"\\\"\"",
    ".setBlockquote()",
    "textBefore === \"---\"",
    ".setHorizontalRule()",
  ]) {
    assertIncludes(
      files.keyboardShortcuts,
      keyboardShortcuts,
      snippet,
      "Keyboard shortcuts must preserve Notion-style Markdown block triggers."
    );
  }

  for (const snippet of [
    "EDITOR_BLOCK_MENU_EVENT",
    "dispatchEditorBlockMenu",
    'insertContent("/")',
    "window.addEventListener(EDITOR_BLOCK_MENU_EVENT",
  ]) {
    const sourceLabel =
      snippet === "dispatchEditorBlockMenu" ? files.editorLocalCommands : files.editor;
    const source =
      sourceLabel === files.editorLocalCommands ? editorLocalCommands : editor;
    assertIncludes(
      sourceLabel,
      source,
      snippet,
      "Cmd/Ctrl+/ must trigger the local slash command menu."
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
    "updatePageWithCloud(page.id",
    "getPageMetadata(parentPageId)",
    "upsertPages([updatedPage ?? page])",
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

  assertIncludes(
    files.subPageTree,
    subPageTree,
    "getPageMetadata(pageId)",
    "SubPageTree must read the current page directly instead of scanning every page."
  );
  assertIncludes(
    files.subPageTree,
    subPageTree,
    "listPageMetadata(parentId)",
    "SubPageTree must read siblings through a parent-scoped metadata query."
  );
  assertIncludes(
    files.subPageTree,
    subPageTree,
    "listPageMetadata(pageId)",
    "SubPageTree must read children through a parent-scoped metadata query."
  );
  assertNotIncludes(
    files.subPageTree,
    subPageTree,
    "getAllPageMetadata",
    "SubPageTree must not scan every page to render local hierarchy."
  );
  assertNotIncludes(
    files.subPageTree,
    subPageTree,
    "getAllPages(",
    "SubPageTree must not scan full page bodies."
  );
  assertIncludes(
    files.pageContextMenu,
    pageContextMenu,
    "listMoveTargetPageMetadata({",
    "PageContextMenu move mode must load bounded move targets from the local index instead of scanning every page."
  );
  assertIncludes(
    files.pageContextMenu,
    pageContextMenu,
    "query: moveQuery",
    "PageContextMenu move target search must pass the typed query to the bounded lookup."
  );
  assertNotIncludes(
    files.pageContextMenu,
    pageContextMenu,
    "getAllPageMetadata",
    "PageContextMenu move mode must not scan every page when opening move targets."
  );
  assertNotIncludes(
    files.pageContextMenu,
    pageContextMenu,
    "getAllPages(",
    "PageContextMenu move mode must not scan full page bodies."
  );
  assertIncludes(
    files.moveToDialog,
    moveToDialog,
    "listMoveTargetPageMetadata({ pageId, query, limit: 30 })",
    "MoveToDialog must load bounded move targets from the local index instead of scanning every page."
  );
  assertNotIncludes(
    files.moveToDialog,
    moveToDialog,
    "getAllPageMetadata",
    "MoveToDialog must not scan every page when opening the move picker."
  );
  assertNotIncludes(
    files.moveToDialog,
    moveToDialog,
    "getAllPages(",
    "MoveToDialog must not scan full page bodies."
  );
  assertIncludes(
    files.industryChainSearch,
    industryChainSearch,
    "findDescendantPageMetadataByTitle(rootId, name)",
    "Industry-chain tag navigation must search inside the industry-chain subtree instead of scanning every page."
  );
  assertNotIncludes(
    files.industryChainSearch,
    industryChainSearch,
    "getAllPageMetadata",
    "Industry-chain tag navigation must not scan every page after large imports."
  );
  assertNotIncludes(
    files.industryChainSearch,
    industryChainSearch,
    "getAllPages(",
    "Industry-chain tag navigation must not scan full page bodies."
  );
  for (const [sourceLabel, source] of [
    [files.editor, editor],
    [files.slashSuggestion, slashSuggestion],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "getPageMetadata(parentPageId)",
      "/page child creation must read only the parent metadata, not scan all pages."
    );
    assertIncludes(
      sourceLabel,
      source,
      "upsertPages([updatedPage ?? page])",
      "/page child creation must merge the new page into the store without replacing the whole page list."
    );
    assertNotIncludes(
      sourceLabel,
      source,
      "getAllPageMetadata",
      "/page child creation must not scan every page after large imports."
    );
    assertNotIncludes(
      sourceLabel,
      source,
      "getAllPages(",
      "/page child creation must not scan full page bodies after large imports."
    );
  }
  assertIncludes(
    files.wikiSuggestion,
    wikiSuggestion,
    "listRecentPageMetadata(8)",
    "Wiki link empty-query suggestions must read only the bounded recent page metadata list."
  );
  assertNotIncludes(
    files.wikiSuggestion,
    wikiSuggestion,
    "getAllPageMetadata",
    "Wiki link suggestions must not scan every page after large imports."
  );
  assertNotIncludes(
    files.wikiSuggestion,
    wikiSuggestion,
    "getAllPages(",
    "Wiki link suggestions must not scan full page bodies."
  );
  for (const snippet of [
    "const upsertPages = useWorkspaceStore((s) => s.upsertPages)",
    "const workspacePages = useWorkspaceStore((s) => s.pages)",
    "listPageMetadata(pageId)",
    "upsertPages([child])",
    "upsertPages([pageToOpen])",
    "upsertPages([updatedNote])",
    "setScopedPages((current) => mergePageLists(current, [child]))",
    "setScopedPages((current) => mergePageLists(current, [pageToOpen]))",
    "setScopedPages((current) => mergePageLists(current, [updatedNote]))",
  ]) {
    assertIncludes(
      files.childPageTree,
      childPageTree,
      snippet,
      "ChildPageTree create/move actions must update the in-memory page list locally instead of refreshing all metadata."
    );
  }
  for (const snippet of [
    "await refresh()",
    "usePages()",
    "usePages({",
    "const { pages, refresh } = usePages()",
  ]) {
    assertNotIncludes(
      files.childPageTree,
      childPageTree,
      snippet,
      "ChildPageTree must not trigger a full page-list refresh after large imports or page opens."
    );
  }

  for (const snippet of [
    "RESEARCH_TEMPLATE_QUICK_ACTIONS",
    "templateQuickActions",
    "handleModuleStarter(action.starter)",
  ]) {
    assertIncludes(
      files.quickSearch,
      quickSearch,
      snippet,
      "Cmd/Ctrl+K must source investment research template starters from the shared catalog."
    );
  }

  for (const snippet of [
    '"new-industry-comparison"',
    '"行业对比"',
    '"new-valuation-assumptions"',
    '"估值假设"',
    '"new-key-metrics"',
    '"关键指标看板"',
    '"new-research-decision-log"',
    '"投研决策日志"',
    '"持仓备忘录"',
    '"new-watchlist-note"',
    '"观察名单"',
    '"new-catalyst-risk-review"',
    '"催化剂与风险复盘"',
    '"new-meeting-transcript"',
    '"会议转录稿"',
    '"new-meeting-action-items"',
    '"会议行动项"',
    '"new-expert-call-note"',
    '"专家电话纪要"',
    '"new-management-meeting-note"',
    '"管理层会议纪要"',
    '"new-report-intake-checklist"',
    '"报告摄取清单"',
  ]) {
    assertIncludes(
      files.researchTemplateStarters,
      researchTemplateStarters,
      snippet,
      "Shared template catalog must expose local investment research template starters."
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
    "\"h3\"",
    "\"heading 3\"",
    "\"subheading\"",
    "\"turn h3\"",
    "\"turnh3\"",
    "\"三级标题\"",
    "\"小标题\"",
  ]) {
    assertIncludes(
      files.slashSuggestion,
      slashSuggestion,
      snippet,
      "Heading 3 must be searchable from slash commands with Notion-like aliases."
    );
  }
  assertIncludes(
    files.quickSearch,
    quickSearch,
    "aliases: [\"h3\", \"heading\", \"heading 3\", \"subheading\", \"三级标题\", \"小标题\"]",
    "Heading 3 must remain searchable from Cmd/Ctrl+K."
  );

  for (const snippet of [
    "\"turnbullet\"",
    "\"num\"",
    "\"turnnumber\"",
    "\"divider\"",
    "\"div\"",
    "\"book\"",
    "\"web bookmark\"",
    "\"bold\"",
    "\"clear formatting\"",
    "\"align left\"",
    "\"red text\"",
    "\"blue background\"",
    "\"gray text\"",
    "title: \"默认颜色\"",
    "\"default color\"",
    ".unsetColor()",
    ".unsetHighlight()",
    "title: \"橙色背景\"",
    "\"orange background\"",
    "title: \"灰色背景\"",
    "\"gray background\"",
  ]) {
    assertIncludes(
      files.slashSuggestion,
      slashSuggestion,
      snippet,
      "Slash commands must include common Notion-style aliases."
    );
  }

  for (const snippet of [
    "title: \"复制当前块\"",
    "duplicateCurrentBlock",
    "title: \"删除当前块\"",
    "deleteCurrentBlock",
    "title: \"上移当前块\"",
    "moveCurrentBlockUp",
    "title: \"下移当前块\"",
    "moveCurrentBlockDown",
    "title: \"评论当前块\"",
    "dispatchEditorLocalCommand(\"block-comment\")",
    "title: \"复制块链接\"",
    "dispatchEditorLocalCommand(\"copy-block-link\")",
    "title: \"复制块 Markdown\"",
    "dispatchEditorLocalCommand(\"copy-block-markdown\")",
    "title: \"复制块 HTML\"",
    "dispatchEditorLocalCommand(\"copy-block-html\")",
  ]) {
    assertIncludes(
      files.slashSuggestion,
      slashSuggestion,
      snippet,
      "Slash commands must expose local advanced block operations."
    );
  }

  for (const snippet of [
    "| \"block-comment\"",
    "| \"copy-block-html\"",
    "| \"copy-block-link\"",
    "| \"copy-block-markdown\"",
    "case \"block-comment\"",
    "case \"copy-block-html\"",
    "case \"copy-block-markdown\"",
    "case \"copy-block-link\"",
    "commentCurrentBlock(",
    "copyCurrentBlockHtml(editor)",
    "copyCurrentBlockMarkdown(editor)",
    "copyCurrentBlockLink(",
    "runEditorLocalCommand(editor, command, pageId, persistEditorNow)",
    "id: \"editor-block-comment\"",
    "id: \"editor-copy-block-link\"",
    "id: \"editor-copy-block-markdown\"",
    "id: \"editor-copy-block-html\"",
    "runEditorCommand(\"block-comment\")",
    "runEditorCommand(\"copy-block-link\")",
    "runEditorCommand(\"copy-block-markdown\")",
    "runEditorCommand(\"copy-block-html\")",
  ]) {
    const sourceLabel = snippet.startsWith("| \"")
      ? files.editorLocalCommands
      : snippet.includes("id: \"editor-block-comment\"") ||
          snippet.includes("id: \"editor-copy-block") ||
          snippet.includes("runEditorCommand")
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
      "Block comments and copy/export commands must be available from slash commands and Cmd/Ctrl+K."
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
    "buildPageMarkdownDocument",
    "buildPageHtmlDocument",
    "copyTextToClipboard",
    "请选择图片文件作为页面封面。",
    "封面图片 URL：",
    "移除",
    "页面未找到",
    "返回首页",
    "已复制 Markdown",
    "已复制 HTML",
    "PageActionsMenu",
    "PageProperties",
    "handlePropertiesChange",
  ]) {
    assertIncludes(
      files.pageShell,
      pageShell,
      snippet,
      "Page shell must keep cover controls and wire the clean Notion-style header."
    );
  }
  for (const snippet of [
    "添加子页面",
    "添加封面",
    "保存版本",
    "版本历史",
    "页面信息",
    "复制页面",
    "复制链接",
    "导出 HTML",
    "导出 Markdown",
    "复制 Markdown",
    "复制 HTML",
    "打印 / PDF",
    "删除页面",
    "pointerdown",
    "Escape",
  ]) {
    assertIncludes(
      files.pageActionsMenu,
      pageActionsMenu,
      snippet,
      "Page actions menu must consolidate every page-level action in Chinese."
    );
  }
  for (const snippet of [
    "createPageProperty",
    "updatePageProperty",
    "添加属性",
    "新建选项...",
  ]) {
    assertIncludes(
      files.pageProperties,
      pageProperties,
      snippet,
      "Page properties block must offer Notion-style editable properties."
    );
  }
  for (const snippet of [
    "| \"copy-html\"",
    "| \"copy-markdown\"",
    "| \"export-html\"",
    "| \"export-markdown\"",
    "PAGE_LOCAL_COMMAND_EVENT",
    "dispatchPageLocalCommand",
  ]) {
    assertIncludes(
      files.pageLocalCommands,
      pageLocalCommands,
      snippet,
      "Page local commands must expose current-page copy actions."
    );
  }
  for (const snippet of [
    "handleOpenDatabases",
    "markdown-note-entry",
    "Markdown 笔记入口",
    "html-report-entry",
    "HTML 报告入口",
    "document-file-entry",
    "PDF / Office 文件入口",
    "spreadsheet-entry",
    "Excel / CSV 导入入口",
    "export-current-page-html",
    "导出当前页面 HTML",
    "export-html",
    "export-current-page-markdown",
    "导出当前页面 Markdown",
    "export-markdown",
    "copy-page-markdown",
    "复制页面 Markdown",
    "copy-markdown",
    "copy-page-html",
    "复制页面 HTML",
    "copy-html",
  ]) {
    assertIncludes(
      files.quickSearch,
      quickSearch,
      snippet,
      "Cmd/Ctrl+K must expose current-page Markdown and HTML copy actions."
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
  for (const snippet of [
    "当前页面",
    "未知版本",
    "恢复前",
    "返回页面",
    "版本对比",
    "还没有可对比的保存版本。",
    "恢复“",
  ]) {
    assertIncludes(
      files.compareShell,
      compareShell,
      snippet,
      "Version compare page must keep the default notes UI in Chinese."
    );
  }
  for (const snippet of ["新增", "删除", "没有文本差异"]) {
    assertIncludes(
      files.sideBySideDiff,
      sideBySideDiff,
      snippet,
      "Side-by-side diff stats must keep Chinese labels."
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
  assertIncludes(
    files.backlinks,
    backlinks,
    "getBacklinks(pageId)",
    "Backlinks panel must read backlink index entries directly."
  );
  assertNotIncludes(
    files.backlinks,
    backlinks,
    "getAllPages(",
    "Backlinks panel must not scan every page body when opening a page."
  );
  for (const snippet of [
    "评论",
    "添加本地评论...",
    "添加评论",
    "重新打开",
    "解决",
    "删除",
  ]) {
    assertIncludes(
      files.pageComments,
      pageComments,
      snippet,
      "Page comments must keep the default notes UI in Chinese."
    );
  }
  for (const snippet of [
    "块评论",
    "跳转",
    "重新打开",
    "解决",
    "删除",
    "文本 ",
    "块 ",
  ]) {
    assertIncludes(
      files.blockComments,
      blockComments,
      snippet,
      "Block comments must keep the default notes UI in Chinese."
    );
  }
  for (const snippet of ["刚刚", "分钟前", "小时前", "天前", "zh-CN"]) {
    assertIncludes(
      files.dates,
      dates,
      snippet,
      "Shared date formatting must default to Chinese labels and locale."
    );
  }
  for (const snippet of ["创建于", "更新于"]) {
    assertIncludes(
      files.dateDisplay,
      dateDisplay,
      snippet,
      "Page metadata date display must keep Chinese labels."
    );
  }
  for (const snippet of [
    "buildNotionBreadcrumbTrail",
    "展开中间层级",
    "已折叠的页面层级",
    "hiddenPages",
    "...",
    "displayPageTitle",
  ]) {
    assertIncludes(
      files.breadcrumb,
      breadcrumb,
      snippet,
      "Page breadcrumbs must keep Notion-like hierarchy labels and collapse logic."
    );
  }
  assertNotIncludes(
    files.pageShell,
    pageShell,
    "PagePositionTree",
    "Page shell should use the compact top-left breadcrumb instead of the large page structure block."
  );
  for (const snippet of ["更换图标", "添加图标", "搜索图标"]) {
    assertIncludes(
      files.iconPicker,
      iconPicker,
      snippet,
      "Page icon picker must keep Chinese control labels."
    );
  }
  for (const snippet of ["页面结构", "当前页", "未命名页面"]) {
    assertIncludes(
      files.subPageTree,
      subPageTree,
      snippet,
      "Page structure panel must keep Chinese labels."
    );
  }
  for (const snippet of ["页面路径", "未命名页面"]) {
    assertIncludes(
      files.breadcrumbBlock,
      breadcrumbBlock,
      snippet,
      "Breadcrumb editor block must keep Chinese fallback labels."
    );
  }
  for (const snippet of [
    "getPageMetadata(cursor)",
    "BREADCRUMB_PARENT_LOOKUP_GUARD",
    "parseStoredPath",
  ]) {
    assertIncludes(
      files.breadcrumbBlock,
      breadcrumbBlock,
      snippet,
      "Breadcrumb editor block must resolve parent paths through bounded page metadata reads."
    );
  }
  for (const snippet of [
    'from "@/hooks/usePages"',
    "usePages()",
    "usePages({",
  ]) {
    assertNotIncludes(
      files.breadcrumbBlock,
      breadcrumbBlock,
      snippet,
      "Breadcrumb editor block must not load the global page list just to render one page path."
    );
  }
  for (const snippet of [
    "Wiki 引用：",
    "未解析的 Wiki 引用",
    "未命名页面",
  ]) {
    assertIncludes(
      files.wikiReferenceNode,
      wikiReferenceNode,
      snippet,
      "Wiki reference editor controls must keep Chinese labels."
    );
  }
  for (const snippet of ["没有找到页面", "未命名页面"]) {
    assertIncludes(
      files.wikiLinkList,
      wikiLinkList,
      snippet,
      "Wiki link autocomplete must keep Chinese empty and fallback labels."
    );
  }
  for (const snippet of ["未命名页面", "折叠项"]) {
    assertIncludes(
      files.markdownToHtml,
      markdownToHtml,
      snippet,
      "Markdown import fallback labels must stay Chinese."
    );
  }
  for (const snippet of [
    "buildPageMarkdownDocument",
    "htmlToMarkdown(contentHtml)",
    "页面路径：",
    "模板按钮：",
    "插入模板",
    "同步块",
    "嵌入：",
  ]) {
    assertIncludes(
      files.pageExport,
      pageExport,
      snippet,
      "Markdown page export labels must stay Chinese."
    );
  }
  for (const snippet of [
    "页面路径：",
    "更新时间：",
    "_空页面_",
    "ZhiNotes 工作区",
    "ZhiNotes 导出",
    "没有活跃页面。",
    "未命名页面",
  ]) {
    assertIncludes(
      files.workspaceBackup,
      workspaceBackup,
      snippet,
      "Workspace export labels and fallback titles must stay Chinese."
    );
  }
  for (const snippet of ["同步块", "新同步组", "将此块移到新的同步组"]) {
    assertIncludes(
      files.syncedBlockNode,
      syncedBlockNode,
      snippet,
      "Synced block controls must keep Chinese labels."
    );
  }
  for (const snippet of [
    "buildSyncedBlockRegistryReport",
    'format: "zhinote-synced-block-registry"',
    "reads_synced_block_content: false",
    "performs_cross_page_sync: false",
    "data-sync-id",
  ]) {
    assertIncludes(
      files.syncedBlockRegistry,
      syncedBlockRegistry,
      snippet,
      "Synced block registry must stay local metadata-only."
    );
  }
  for (const snippet of [
    "notes-synced-block-registry",
    "SyncedBlockRegistryPanel",
    "导出 registry",
    "本地同步块实例清单",
    "打开本地页面",
  ]) {
    assertIncludes(
      files.notesShell,
      notesShell,
      snippet,
      "Notes module must expose the local synced block registry."
    );
  }
  for (const snippet of [
    "插入模板",
    "按钮下方",
    "按钮上方",
    "页面顶部",
    "页面底部",
    "模板按钮文案",
    "插入位置",
  ]) {
    assertIncludes(
      files.templateButtonNode,
      templateButtonNode,
      snippet,
      "Template button controls must keep Chinese labels."
    );
  }
  for (const snippet of ["page structure", "breadcrumbs", "synced blocks"]) {
    assertIncludes(
      files.readme,
      readme,
      snippet,
      "README must document the expanded Chinese notes UI coverage."
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
        comment_shortcut: "Mod-Shift-m",
        block_menu_shortcut: "Mod-/",
        page_shortcut: "Mod-Shift-9",
        markdown_block_triggers: [">", "\"", "---"],
        page_slash_aliases: 8,
        block_insert_heading_levels: 3,
        advanced_block_slash_commands: 8,
        block_copy_export_commands: 3,
        notion_style_slash_aliases: 13,
        formatting_color_aliases: true,
        default_color_command: true,
        background_color_commands: 7,
        file_workflow_entrypoints: 3,
        localized_shared_note_controls: true,
        page_command_opens_new_page: true,
        page_command_seeds_child_page: true,
        cmdk_child_page_command: true,
        cmdk_block_comment_command: true,
        cmdk_block_copy_export_commands: true,
        local_only: true,
      },
      null,
      2
    )
  );
}

run();
