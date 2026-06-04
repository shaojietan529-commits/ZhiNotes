"use client";

import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { type SuggestionOptions } from "@tiptap/suggestion";
import SlashCommandList, {
  type SlashCommandItem,
  type SlashCommandListRef,
} from "./SlashCommandList";
import {
  createDatabase,
  createPage,
  getAllPages,
  updatePage,
  updateWikiLinks,
} from "@/lib/db/local/queries";
import {
  promptAndImportMarkdown,
  promptAndInsertFilePreview,
} from "../filePreviewUpload";
import { NOTE_TEMPLATES } from "@/lib/templates/noteTemplates";
import { useWorkspaceStore } from "@/stores/workspaceStore";

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
      aliases: ["paragraph", "plain", "text", "wenben"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
    },
    {
      title: "标题 1",
      description: "一级大标题",
      icon: "H1",
      category: "基础块",
      aliases: ["h1", "title", "heading 1", "biaoti"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
      },
    },
    {
      title: "标题 2",
      description: "二级标题",
      icon: "H2",
      category: "基础块",
      aliases: ["h2", "subtitle", "heading 2"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
      },
    },
    {
      title: "标题 3",
      description: "三级小标题",
      icon: "H3",
      category: "基础块",
      aliases: ["h3"],
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
        const title = window.prompt("新页面标题：", "未命名页面");
        if (title === null) return;

        const currentPageId = useWorkspaceStore.getState().currentPageId;
        const page = await createPage({
          title: title.trim() || "未命名页面",
          parentId: currentPageId,
        });
        const allPages = await getAllPages();
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
                label: page.title || "未命名页面",
              },
            },
            { type: "text", text: " " },
          ])
          .run();

        if (currentPageId) {
          await updatePage(currentPageId, { content_text: editor.getHTML() });
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
      aliases: ["bullet", "bullets", "ul", "无序", "列表"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "编号列表",
      description: "数字排序列表",
      icon: "1.",
      category: "列表",
      aliases: ["number", "ordered", "ol", "编号", "有序"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "待办列表",
      description: "带复选框的任务列表",
      icon: "☑",
      category: "列表",
      aliases: ["todo", "task", "checkbox", "待办", "任务"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: "折叠列表",
      description: "可以展开/收起的内容块",
      icon: ">",
      category: "列表",
      aliases: ["toggle", "collapse", "fold", "折叠"],
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
      aliases: ["blockquote", "quote", "引用"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setBlockquote().run();
      },
    },
    {
      title: "分割线",
      description: "水平分割线",
      icon: "—",
      category: "内容块",
      aliases: ["hr", "line", "separator", "分割线"],
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
      description: "本地上传 AI 生成的 HTML 可视化报告",
      icon: "H",
      category: "媒体",
      aliases: ["html", "report", "visualization", "报告", "可视化"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        promptAndInsertFilePreview(editor);
      },
    },
    {
      title: "Markdown 笔记",
      description: "导入 Markdown 文件为可编辑块",
      icon: "MD",
      category: "媒体",
      aliases: ["markdown", "md", "import", "笔记", "导入"],
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
      aliases: ["url", "link", "web", "bookmark", "书签"],
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
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBold().run();
      },
    },
    {
      title: "斜体",
      description: "文字斜体",
      icon: "I",
      category: "文字格式",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleItalic().run();
      },
    },
    {
      title: "下划线",
      description: "给文字加下划线",
      icon: "U",
      category: "文字格式",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleUnderline().run();
      },
    },
    {
      title: "删除线",
      description: "给文字加删除线",
      icon: "S̶",
      category: "文字格式",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleStrike().run();
      },
    },
    {
      title: "行内代码",
      description: "把文字设为行内代码",
      icon: "`",
      category: "文字格式",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCode().run();
      },
    },
    {
      title: "高亮",
      description: "高亮文字",
      icon: "🖍",
      category: "文字格式",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight().run();
      },
    },
    {
      title: "清除格式",
      description: "移除文字样式并重置当前块",
      icon: "X",
      category: "文字格式",
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
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setTextAlign("left").run();
      },
    },
    {
      title: "居中对齐",
      description: "文字居中对齐",
      icon: "⫸",
      category: "对齐",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setTextAlign("center").run();
      },
    },
    {
      title: "右对齐",
      description: "文字右对齐",
      icon: "⫸",
      category: "对齐",
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
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#ef4444").run();
      },
    },
    {
      title: "橙色文字",
      description: "把文字颜色设为橙色",
      icon: "🟠",
      category: "颜色",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#f97316").run();
      },
    },
    {
      title: "黄色文字",
      description: "把文字颜色设为黄色",
      icon: "🟡",
      category: "颜色",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#eab308").run();
      },
    },
    {
      title: "绿色文字",
      description: "把文字颜色设为绿色",
      icon: "🟢",
      category: "颜色",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#22c55e").run();
      },
    },
    {
      title: "蓝色文字",
      description: "把文字颜色设为蓝色",
      icon: "🔵",
      category: "颜色",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#3b82f6").run();
      },
    },
    {
      title: "紫色文字",
      description: "把文字颜色设为紫色",
      icon: "🟣",
      category: "颜色",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#a855f7").run();
      },
    },
    {
      title: "灰色文字",
      description: "把文字颜色设为灰色",
      icon: "⚪",
      category: "颜色",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#9ca3af").run();
      },
    },
    ...templateCommands,
    // ── Background Colors ──
    {
      title: "红色背景",
      description: "用红色背景高亮",
      icon: "🔴",
      category: "背景色",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight({ color: "#fecaca" }).run();
      },
    },
    {
      title: "黄色背景",
      description: "用黄色背景高亮",
      icon: "🟡",
      category: "背景色",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight({ color: "#fef08a" }).run();
      },
    },
    {
      title: "绿色背景",
      description: "用绿色背景高亮",
      icon: "🟢",
      category: "背景色",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight({ color: "#bbf7d0" }).run();
      },
    },
    {
      title: "蓝色背景",
      description: "用蓝色背景高亮",
      icon: "🔵",
      category: "背景色",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight({ color: "#bfdbfe" }).run();
      },
    },
    {
      title: "紫色背景",
      description: "用紫色背景高亮",
      icon: "🟣",
      category: "背景色",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight({ color: "#e9d5ff" }).run();
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
