"use client";

import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { type SuggestionOptions } from "@tiptap/suggestion";
import SlashCommandList, {
  type SlashCommandItem,
  type SlashCommandListRef,
} from "./SlashCommandList";
import {
  getAllPages,
  updateWikiLinks,
} from "@/lib/db/local/queries";
import { createDatabase } from "@/lib/database/cloudDatabaseMutations";
import {
  createPageWithCloud,
  updatePageWithCloud,
} from "@/lib/pages/cloudPageMutations";
import {
  promptAndInsertHtmlReportPreview,
  promptAndInsertMarkdownFilePreview,
  promptAndImportMarkdown,
  promptAndInsertFilePreview,
  promptAndInsertFileEmbed,
} from "../filePreviewUpload";
import { NOTE_TEMPLATES } from "@/lib/templates/noteTemplates";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { buildChildPageInitialHtml } from "@/lib/pages/childPageSeed";
import { dispatchEditorLocalCommand } from "@/lib/editorLocalCommands";

function getSlashCommands(): SlashCommandItem[] {
  const templateCommands: SlashCommandItem[] = NOTE_TEMPLATES.map((template) => ({
    title: template.title,
    description: template.description,
    icon: "TMP",
    category: "模板",
    aliases: template.aliases,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(template.html).run();
    },
  }));

  return [
    // ── Basic Blocks ──
    {
      title: "文本",
      description: "普通文本块",
      icon: "Aa",
      category: "基础块",
      aliases: ["paragraph", "plain", "text", "turn text", "turntext", "wenben"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
    },
    {
      title: "标题 1",
      description: "一级大标题",
      icon: "H1",
      category: "基础块",
      aliases: ["h1", "title", "heading 1", "turn h1", "turnh1", "biaoti"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
      },
    },
    {
      title: "标题 2",
      description: "二级标题",
      icon: "H2",
      category: "基础块",
      aliases: ["h2", "subtitle", "heading 2", "turn h2", "turnh2"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
      },
    },
    {
      title: "标题 3",
      description: "三级小标题",
      icon: "H3",
      category: "基础块",
      aliases: [
        "h3",
        "heading 3",
        "subheading",
        "turn h3",
        "turnh3",
        "三级标题",
        "小标题",
      ],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
      },
    },
    {
      title: "新建页面 / Page",
      description: "创建子页面，插入页面链接，并自动进入新页面（/page）",
      icon: "📄",
      category: "基础块",
      aliases: [
        "page",
        "subpage",
        "new page",
        "create page",
        "new",
        "页面",
        "新页面",
        "子页面",
      ],
      command: async ({ editor, range }) => {
        const currentPageId = useWorkspaceStore.getState().currentPageId;
        const parentPageId = currentPageId ?? null;
        const page = await createPageWithCloud({
          parentId: parentPageId,
        });
        const allPages = await getAllPages();
        const parentPage = parentPageId
          ? allPages.find((candidate) => candidate.id === parentPageId)
          : null;
        await updatePageWithCloud(page.id, {
          content_text: buildChildPageInitialHtml({
            parentPageId,
            parentTitle: parentPage?.title ?? null,
          }),
        });
        useWorkspaceStore.getState().setPages(allPages);

        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent([
            {
              type: "mention",
              attrs: {
                id: page.id,
                label: page.title || "新页面",
              },
            },
            { type: "text", text: " " },
          ])
          .run();

        if (currentPageId) {
          await updatePageWithCloud(currentPageId, {
            content_text: editor.getHTML(),
          });
          await updateWikiLinks(currentPageId, getLinkedPageIds(editor));
        }

        window.location.href = `/page/${page.id}`;
      },
    },
    // ── Lists ──
    {
      title: "无序列表",
      description: "项目符号列表",
      icon: "•",
      category: "列表",
      aliases: [
        "bullet",
        "bullets",
        "ul",
        "turn bullet",
        "turnbullet",
        "turn ul",
        "无序",
        "列表",
      ],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "编号列表",
      description: "数字排序列表",
      icon: "1.",
      category: "列表",
      aliases: [
        "number",
        "num",
        "ordered",
        "ol",
        "turn number",
        "turnnumber",
        "turn num",
        "编号",
        "有序",
      ],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "待办列表",
      description: "带复选框的任务列表",
      icon: "☑",
      category: "列表",
      aliases: [
        "todo",
        "task",
        "checkbox",
        "turn todo",
        "turntodo",
        "turn task",
        "待办",
        "任务",
      ],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: "折叠列表",
      description: "可以展开/收起的内容块",
      icon: ">",
      category: "列表",
      aliases: ["toggle", "collapse", "fold", "turn toggle", "turntoggle", "折叠"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertToggleBlock().run();
      },
    },
    // ── Content Blocks ──
    {
      title: "引用",
      description: "引用块",
      icon: "❝",
      category: "内容块",
      aliases: ["blockquote", "quote", "turn quote", "turnquote", "引用"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setBlockquote().run();
      },
    },
    {
      title: "分割线",
      description: "水平分割线",
      icon: "—",
      category: "内容块",
      aliases: ["hr", "line", "separator", "divider", "div", "分割线"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: "目录",
      description: "自动列出当前页面的标题",
      icon: "TOC",
      category: "内容块",
      aliases: ["toc", "outline", "目录"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertTableOfContents().run();
      },
    },
    {
      title: "面包屑路径",
      description: "在页面内显示当前页面路径",
      icon: "BC",
      category: "内容块",
      aliases: ["breadcrumb", "path", "路径"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertBreadcrumbBlock().run();
      },
    },
    {
      title: "同步块",
      description: "本地保持重复内容块同步",
      icon: "SYNC",
      category: "内容块",
      aliases: ["sync", "synced", "同步"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertSyncedBlock().run();
      },
    },
    {
      title: "双栏",
      description: "把内容分成左右两栏",
      icon: "2C",
      category: "内容块",
      aliases: ["columns", "layout", "two column", "双栏", "分栏"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertTwoColumns().run();
      },
    },
    {
      title: "代码块",
      description: "带语法高亮的代码块",
      icon: "<>",
      category: "内容块",
      aliases: ["code", "pre", "snippet", "代码"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setCodeBlock().run();
      },
    },
    {
      title: "公式块",
      description: "适合财务、估值或数学笔记的公式块",
      icon: "fx",
      category: "内容块",
      aliases: ["math", "formula", "latex", "公式"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertEquation().run();
      },
    },
    {
      title: "行内公式",
      description: "插入到当前行里的公式",
      icon: "$x$",
      category: "行内",
      aliases: ["inline equation", "inline math", "math inline", "formula inline", "行内公式"],
      command: ({ editor, range }) => {
        const formula = window.prompt("行内公式：", "");
        if (formula === null) return;
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertInlineEquation(formula.trim())
          .run();
      },
    },
    {
      title: "模板按钮",
      description: "点击后插入指定模板的复用按钮",
      icon: "BTN",
      category: "内容块",
      aliases: ["template button", "button", "reusable template", "模板按钮"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertTemplateButton().run();
      },
    },
    {
      title: "提示块",
      description: "高亮展示备注、提醒或风险",
      icon: "💡",
      category: "内容块",
      aliases: ["note", "info", "warning", "callout", "提示"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertCallout().run();
      },
    },
    // ── Modules (composable cards) ──
    {
      title: "模块卡片",
      description: "可自由组合的模块：图标 + 标题 + 任意内容（文字/清单/图片…）",
      icon: "📦",
      category: "模块",
      aliases: [
        "module",
        "card",
        "block module",
        "widget",
        "模块",
        "卡片",
        "组件",
      ],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertModuleCard().run();
      },
    },
    {
      title: "并排模块",
      description: "左右两个模块卡片并排，用于组合版面",
      icon: "▥",
      category: "模块",
      aliases: [
        "module columns",
        "side by side",
        "two modules",
        "并排",
        "并排模块",
        "组合模块",
      ],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: "columnLayout",
            attrs: { columns: 2 },
            content: [
              {
                type: "columnBlock",
                content: [
                  {
                    type: "moduleCard",
                    attrs: { icon: "📦", title: "", tone: "neutral" },
                    content: [{ type: "paragraph" }],
                  },
                ],
              },
              {
                type: "columnBlock",
                content: [
                  {
                    type: "moduleCard",
                    attrs: { icon: "📦", title: "", tone: "blue" },
                    content: [{ type: "paragraph" }],
                  },
                ],
              },
            ],
          })
          .run();
      },
    },
    {
      title: "要点模块",
      description: "蓝色要点卡片，适合放结论 / 投资要点",
      icon: "📊",
      category: "模块",
      aliases: ["key points", "highlights", "要点", "结论", "投资要点"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertModuleCard({ icon: "📊", title: "要点", tone: "blue" })
          .run();
      },
    },
    {
      title: "待办模块",
      description: "黄色待办卡片，适合放跟踪事项",
      icon: "📌",
      category: "模块",
      aliases: ["todo", "checklist", "tasks", "待办", "跟踪", "清单"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertModuleCard({ icon: "📌", title: "待办", tone: "amber" })
          .run();
      },
    },
    {
      title: "风险模块",
      description: "红色风险卡片，适合放风险 / 注意事项",
      icon: "⚠️",
      category: "模块",
      aliases: ["risk", "warning", "风险", "注意"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertModuleCard({ icon: "⚠️", title: "风险", tone: "red" })
          .run();
      },
    },
    // ── Media ──
    {
      title: "图片",
      description: "通过 URL 插入图片",
      icon: "🖼",
      category: "媒体",
      aliases: ["photo", "picture", "media", "image", "图片"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        const url = window.prompt("图片 URL：");
        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      },
    },
    {
      title: "嵌入文件",
      description: "嵌入文件链接，点击展开预览（同步到云端）",
      icon: "📎",
      category: "媒体",
      aliases: [
        "embed file",
        "attach",
        "attachment",
        "嵌入",
        "嵌入文件",
        "附件",
        "文件链接",
      ],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        promptAndInsertFileEmbed(editor);
      },
    },
    {
      title: "文件 / 报告",
      description: "本地上传 HTML、Markdown、PDF、Office、notebook 或媒体",
      icon: "F",
      category: "媒体",
      aliases: [
        "upload",
        "file",
        "report",
        "pdf",
        "word",
        "excel",
        "epub",
        "book",
        "ipynb",
        "jupyter",
        "notebook",
        "open document",
        "odt",
        "ods",
        "odp",
        "powerpoint",
        "ppt",
        "pptx",
        "pages",
        "numbers",
        "keynote",
        "iwork",
        "rtf",
        "zip",
        "archive",
        "文件",
        "报告",
        "上传",
      ],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        promptAndInsertFilePreview(editor);
      },
    },
    {
      title: "网页嵌入",
      description: "嵌入网页，加载前会保留确认边界",
      icon: "EMB",
      category: "媒体",
      aliases: ["embed", "iframe", "web embed", "website", "嵌入", "网页"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        const url = window.prompt("嵌入 URL：");
        editor
          .chain()
          .focus()
          .insertEmbed({ url: url?.trim() ?? "" })
          .run();
      },
    },
    {
      title: "HTML 报告",
      description: "本地上传 HTML，插入沙盒原生预览块（默认阻止外部资源）",
      icon: "H",
      category: "媒体",
      aliases: [
        "html",
        "htm",
        "html report",
        "ai report",
        "visual report",
        "report",
        "visualization",
        "报告",
        "可视化",
      ],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        promptAndInsertHtmlReportPreview(editor);
      },
    },
    {
      title: "Markdown 文件预览",
      description: "本地上传 Markdown/MDX，保留原文件预览块，并可再导入",
      icon: "MD",
      category: "媒体",
      aliases: [
        "markdown preview",
        "md preview",
        "markdown file",
        "md file",
        "mdx",
        "markdown",
        "md",
        "预览",
        "原文件",
      ],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        promptAndInsertMarkdownFilePreview(editor);
      },
    },
    {
      title: "Markdown 导入为可编辑块",
      description: "选择 Markdown 文件并直接写入当前页面内容",
      icon: "MD",
      category: "媒体",
      aliases: ["markdown import", "md import", "import", "editable", "笔记", "导入", "可编辑"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        promptAndImportMarkdown(editor);
      },
    },
    {
      title: "表格",
      description: "插入一个表格",
      icon: "⊞",
      category: "媒体",
      aliases: ["grid", "matrix", "table", "表格"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    // ── Database ──
    {
      title: "内嵌数据库",
      description: "在当前页面里嵌入一个新数据库",
      icon: "🗄️",
      category: "数据库",
      aliases: ["inline database", "table database", "db", "内嵌数据库"],
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        try {
          const db = await createDatabase({ title: "未命名数据库" });
          editor.chain().focus().insertInlineDatabase(db.id).run();
        } catch (err) {
          console.error("[Zhinote] Failed to create inline database:", err);
        }
      },
    },
    {
      title: "整页数据库",
      description: "创建一个新的数据库页面",
      icon: "🗄️",
      category: "数据库",
      aliases: ["full database", "database page", "db page", "数据库"],
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        try {
          const db = await createDatabase({ title: "未命名数据库" });
          // Navigate to the full database page
          window.location.href = `/database/${db.id}`;
        } catch (err) {
          console.error("[Zhinote] Failed to create database:", err);
        }
      },
    },
    // ── Advanced block operations ──
    {
      title: "复制当前块",
      description: "复制光标所在块或选中的多个块",
      icon: "DUP",
      category: "高级",
      aliases: ["duplicate", "copy block", "clone", "复制块", "复制当前块"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).duplicateCurrentBlock().run();
      },
    },
    {
      title: "删除当前块",
      description: "删除光标所在块或选中的多个块，可用撤销恢复",
      icon: "DEL",
      category: "高级",
      aliases: ["delete", "remove", "del", "delete block", "删除块", "删除当前块"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).deleteCurrentBlock().run();
      },
    },
    {
      title: "上移当前块",
      description: "把当前块向上移动一位",
      icon: "UP",
      category: "高级",
      aliases: ["move up", "moveup", "up", "block up", "上移", "上移块"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).moveCurrentBlockUp().run();
      },
    },
    {
      title: "下移当前块",
      description: "把当前块向下移动一位",
      icon: "DN",
      category: "高级",
      aliases: ["move down", "movedown", "down", "block down", "下移", "下移块"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).moveCurrentBlockDown().run();
      },
    },
    {
      title: "评论当前块",
      description: "给当前块或选中文本添加本地评论",
      icon: "CMT",
      category: "高级",
      aliases: ["comment", "add comment", "block comment", "评论", "块评论"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        dispatchEditorLocalCommand("block-comment");
      },
    },
    {
      title: "复制块链接",
      description: "复制当前块的本地页面锚点链接",
      icon: "LNK",
      category: "高级",
      aliases: ["copy link", "copy block link", "block link", "复制块链接"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        dispatchEditorLocalCommand("copy-block-link");
      },
    },
    {
      title: "复制块 Markdown",
      description: "把当前块或选中多个块复制为 Markdown",
      icon: "MD",
      category: "高级",
      aliases: ["copy markdown", "copy md", "block markdown", "复制 Markdown"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        dispatchEditorLocalCommand("copy-block-markdown");
      },
    },
    {
      title: "复制块 HTML",
      description: "把当前块或选中多个块复制为 HTML",
      icon: "HTML",
      category: "高级",
      aliases: ["copy html", "block html", "复制 HTML", "复制块 HTML"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        dispatchEditorLocalCommand("copy-block-html");
      },
    },
    // ── Inline ──
    {
      title: "链接到页面",
      description: "链接到已有页面，也可以直接输入 //",
      icon: "📄",
      category: "行内",
      aliases: ["page", "mention", "wiki", "页面链接"],
      command: ({ editor, range }) => {
        // Delete the slash command text and insert the wiki link trigger
        editor.chain().focus().deleteRange(range).insertContent("//").run();
      },
    },
    {
      title: "书签",
      description: "添加本地链接预览卡片",
      icon: "URL",
      category: "行内",
      aliases: ["url", "link", "web", "bookmark", "book", "web bookmark", "书签"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        const url = window.prompt("书签 URL：");
        if (!url?.trim()) return;
        editor
          .chain()
          .focus()
          .insertBookmark({ url: url.trim(), title: url.trim() })
          .run();
      },
    },
    // ── Text Formatting ──
    {
      title: "加粗",
      description: "加粗文字",
      icon: "B",
      category: "文字格式",
      aliases: ["bold", "strong", "加粗"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBold().run();
      },
    },
    {
      title: "斜体",
      description: "文字斜体",
      icon: "I",
      category: "文字格式",
      aliases: ["italic", "emphasis", "italics", "斜体"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleItalic().run();
      },
    },
    {
      title: "下划线",
      description: "给文字加下划线",
      icon: "U",
      category: "文字格式",
      aliases: ["underline", "underlined", "下划线"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleUnderline().run();
      },
    },
    {
      title: "删除线",
      description: "给文字加删除线",
      icon: "S̶",
      category: "文字格式",
      aliases: ["strike", "strikethrough", "delete line", "删除线"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleStrike().run();
      },
    },
    {
      title: "行内代码",
      description: "把文字设为行内代码",
      icon: "`",
      category: "文字格式",
      aliases: ["inline code", "code", "code text", "行内代码"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCode().run();
      },
    },
    {
      title: "高亮",
      description: "高亮文字",
      icon: "🖍",
      category: "文字格式",
      aliases: ["highlight", "mark", "高亮"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight().run();
      },
    },
    {
      title: "清除格式",
      description: "移除文字样式并重置当前块",
      icon: "X",
      category: "文字格式",
      aliases: ["clear", "clear format", "clear formatting", "remove formatting", "清除格式"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .unsetAllMarks()
          .clearNodes()
          .run();
      },
    },
    // ── Alignment ──
    {
      title: "左对齐",
      description: "文字左对齐",
      icon: "⫷",
      category: "对齐",
      aliases: ["left", "align left", "left align", "左对齐"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setTextAlign("left").run();
      },
    },
    {
      title: "居中对齐",
      description: "文字居中对齐",
      icon: "⫸",
      category: "对齐",
      aliases: ["center", "align center", "center align", "居中"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setTextAlign("center").run();
      },
    },
    {
      title: "右对齐",
      description: "文字右对齐",
      icon: "⫸",
      category: "对齐",
      aliases: ["right", "align right", "right align", "右对齐"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setTextAlign("right").run();
      },
    },
    // ── Colors ──
    {
      title: "红色文字",
      description: "把文字颜色设为红色",
      icon: "🔴",
      category: "颜色",
      aliases: ["red", "red text", "text red", "红色"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#ef4444").run();
      },
    },
    {
      title: "橙色文字",
      description: "把文字颜色设为橙色",
      icon: "🟠",
      category: "颜色",
      aliases: ["orange", "orange text", "text orange", "橙色"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#f97316").run();
      },
    },
    {
      title: "黄色文字",
      description: "把文字颜色设为黄色",
      icon: "🟡",
      category: "颜色",
      aliases: ["yellow", "yellow text", "text yellow", "黄色"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#eab308").run();
      },
    },
    {
      title: "绿色文字",
      description: "把文字颜色设为绿色",
      icon: "🟢",
      category: "颜色",
      aliases: ["green", "green text", "text green", "绿色"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#22c55e").run();
      },
    },
    {
      title: "蓝色文字",
      description: "把文字颜色设为蓝色",
      icon: "🔵",
      category: "颜色",
      aliases: ["blue", "blue text", "text blue", "蓝色"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#3b82f6").run();
      },
    },
    {
      title: "紫色文字",
      description: "把文字颜色设为紫色",
      icon: "🟣",
      category: "颜色",
      aliases: ["purple", "purple text", "text purple", "紫色"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#a855f7").run();
      },
    },
    {
      title: "灰色文字",
      description: "把文字颜色设为灰色",
      icon: "⚪",
      category: "颜色",
      aliases: ["gray", "grey", "gray text", "grey text", "text gray", "灰色"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#9ca3af").run();
      },
    },
    {
      title: "默认颜色",
      description: "移除文字颜色和背景高亮",
      icon: "DEF",
      category: "颜色",
      aliases: [
        "default",
        "default color",
        "clear color",
        "remove color",
        "default background",
        "默认",
        "默认颜色",
      ],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .unsetColor()
          .unsetHighlight()
          .run();
      },
    },
    ...templateCommands,
    // ── Background Colors ──
    {
      title: "红色背景",
      description: "用红色背景高亮",
      icon: "🔴",
      category: "背景色",
      aliases: ["red background", "red bg", "background red", "红色背景"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHighlight({ color: "#fecaca" })
          .run();
      },
    },
    {
      title: "橙色背景",
      description: "用橙色背景高亮",
      icon: "🟠",
      category: "背景色",
      aliases: ["orange background", "orange bg", "background orange", "橙色背景"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHighlight({ color: "#fed7aa" })
          .run();
      },
    },
    {
      title: "黄色背景",
      description: "用黄色背景高亮",
      icon: "🟡",
      category: "背景色",
      aliases: ["yellow background", "yellow bg", "background yellow", "黄色背景"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHighlight({ color: "#fef08a" })
          .run();
      },
    },
    {
      title: "绿色背景",
      description: "用绿色背景高亮",
      icon: "🟢",
      category: "背景色",
      aliases: ["green background", "green bg", "background green", "绿色背景"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHighlight({ color: "#bbf7d0" })
          .run();
      },
    },
    {
      title: "蓝色背景",
      description: "用蓝色背景高亮",
      icon: "🔵",
      category: "背景色",
      aliases: ["blue background", "blue bg", "background blue", "蓝色背景"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHighlight({ color: "#bfdbfe" })
          .run();
      },
    },
    {
      title: "紫色背景",
      description: "用紫色背景高亮",
      icon: "🟣",
      category: "背景色",
      aliases: ["purple background", "purple bg", "background purple", "紫色背景"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHighlight({ color: "#e9d5ff" })
          .run();
      },
    },
    {
      title: "灰色背景",
      description: "用灰色背景高亮",
      icon: "⚪",
      category: "背景色",
      aliases: [
        "gray background",
        "grey background",
        "gray bg",
        "grey bg",
        "background gray",
        "灰色背景",
      ],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHighlight({ color: "#e4e4e7" })
          .run();
      },
    },
  ];
}

const SlashCommandSuggestion: Omit<SuggestionOptions<SlashCommandItem>, "editor"> = {
  char: "/",
  allowSpaces: true,
  startOfLine: false,

  items: ({ query }) => {
    // If query starts with "/" it means the user typed "//", let wiki links handle it
    if (query.startsWith("/")) return [];

    const commands = getSlashCommands();
    if (!query) return commands;

    const lower = query.trim().replace(/\s+/g, " ").toLowerCase();
    if (!lower) return commands;
    return commands.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower) ||
        item.aliases?.some((alias) => alias.toLowerCase().includes(lower))
    );
  },

  render: () => {
    let component: ReactRenderer<SlashCommandListRef> | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashCommandList, {
          props: {
            items: props.items,
            command: (item: SlashCommandItem) => {
              item.command({ editor: props.editor, range: props.range });
            },
          },
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          maxWidth: "none",
        });
      },

      onUpdate(props) {
        component?.updateProps({
          items: props.items,
          command: (item: SlashCommandItem) => {
            item.command({ editor: props.editor, range: props.range });
          },
        });

        if (popup && props.clientRect) {
          popup[0].setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        }
      },

      onKeyDown(props) {
        if (props.event.key === "Escape") {
          popup?.[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props.event) ?? false;
      },

      onExit() {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};

export default SlashCommandSuggestion;

function getLinkedPageIds(editor: SlashCommandItemCommandEditor) {
  const linkedPageIds: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "mention" && node.attrs.id) {
      linkedPageIds.push(node.attrs.id);
    }
  });
  return linkedPageIds;
}

type SlashCommandItemCommandEditor = Parameters<
  SlashCommandItem["command"]
>[0]["editor"];
