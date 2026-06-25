"use client";

import type { Editor as TiptapEditor, JSONContent } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";

interface BlockDragHandleLayerProps {
  editor: TiptapEditor;
  editable: boolean;
}

interface BlockMeta {
  element: HTMLElement;
  node: ProseMirrorNode;
  parentName: string;
  pos: number;
  end: number;
  rect: DOMRect;
}

interface DraggedBlock {
  node: ProseMirrorNode;
  nodes: ProseMirrorNode[];
  parentName: string;
  pos: number;
  end: number;
}

interface VisualBlock {
  dragLeft: number;
  insertLeft: number;
  menuLeft: number;
  menuTop: number;
  pos: number;
  top: number;
}

type InsertMenuItemType =
  | "text"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "taskList"
  | "toggle"
  | "callout"
  | "quote"
  | "divider"
  | "code"
  | "toc"
  | "columns"
  | "bookmark"
  | "embed";

interface InsertMenuItem {
  aliases?: string[];
  description: string;
  label: string;
  type: InsertMenuItemType;
}

interface DropTarget {
  insertPos: number;
  left: number;
  side: "before" | "after";
  top: number;
  width: number;
}

const BLOCK_HANDLE_GAP = 24;

const DEFAULT_INSERT_ITEMS: InsertMenuItem[] = [
  {
    type: "text",
    label: "文本",
    description: "空白段落",
    aliases: ["paragraph", "plain", "text", "文本"],
  },
  {
    type: "heading1",
    label: "标题 1",
    description: "一级章节标题",
    aliases: ["h1", "title", "标题"],
  },
  {
    type: "heading2",
    label: "标题 2",
    description: "二级章节标题",
    aliases: ["h2", "subtitle", "标题"],
  },
  {
    type: "heading3",
    label: "标题 3",
    description: "三级小标题",
    aliases: ["h3", "subheading", "三级标题", "小标题"],
  },
  {
    type: "bulletList",
    label: "无序列表",
    description: "项目符号列表",
    aliases: ["bullets", "ul", "列表"],
  },
  {
    type: "taskList",
    label: "待办",
    description: "复选框任务",
    aliases: ["todo", "task", "checkbox", "待办"],
  },
  {
    type: "toggle",
    label: "折叠列表",
    description: "可展开/收起的内容",
    aliases: ["details", "collapse", "toggle", "折叠"],
  },
  {
    type: "callout",
    label: "提示块",
    description: "高亮备注或提醒",
    aliases: ["note", "info", "warning", "callout", "提示"],
  },
  {
    type: "quote",
    label: "引用",
    description: "引用文字",
    aliases: ["blockquote", "quote", "引用"],
  },
  {
    type: "divider",
    label: "分割线",
    description: "水平分割线",
    aliases: ["hr", "line", "separator", "分割线"],
  },
  {
    type: "code",
    label: "代码块",
    description: "代码块",
    aliases: ["pre", "snippet", "code", "代码"],
  },
  {
    type: "toc",
    label: "目录",
    description: "页面标题目录",
    aliases: ["toc", "outline", "目录"],
  },
  {
    type: "columns",
    label: "双栏",
    description: "左右并排内容块",
    aliases: ["layout", "2 columns", "columns", "双栏"],
  },
  {
    type: "bookmark",
    label: "书签",
    description: "本地网页卡片",
    aliases: ["link preview", "url", "bookmark", "书签"],
  },
  {
    type: "embed",
    label: "网页嵌入",
    description: "安全预览块",
    aliases: ["iframe", "video", "figma", "embed", "嵌入"],
  },
];

const LIST_INSERT_ITEMS: InsertMenuItem[] = [
  {
    type: "text",
    label: "列表项",
    description: "继续当前列表",
    aliases: ["bullet", "todo", "task", "列表"],
  },
];

export function BlockDragHandleLayer({
  editor,
  editable,
}: BlockDragHandleLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const insertMenuRef = useRef<HTMLDivElement | null>(null);
  const insertMenuInputRef = useRef<HTMLInputElement | null>(null);
  const draggedBlockRef = useRef<DraggedBlock | null>(null);
  const mouseDraggingRef = useRef(false);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const [hoverBlock, setHoverBlock] = useState<VisualBlock | null>(null);
  const [insertMenu, setInsertMenu] = useState<VisualBlock | null>(null);
  const [insertMenuQuery, setInsertMenuQuery] = useState("");
  const [activeInsertMenuIndex, setActiveInsertMenuIndex] = useState(0);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const updateDropTarget = useCallback((target: DropTarget | null) => {
    dropTargetRef.current = target;
    setDropTarget(target);
  }, []);

  const resetDragState = useCallback(() => {
    draggedBlockRef.current = null;
    mouseDraggingRef.current = false;
    updateDropTarget(null);
  }, [updateDropTarget]);

  const getSurface = useCallback(
    () => layerRef.current?.closest<HTMLElement>(".zhinote-editor-surface"),
    []
  );

  const getVisualBlock = useCallback(
    (meta: BlockMeta): VisualBlock | null => {
      const surface = getSurface();
      if (!surface) return null;
      const surfaceRect = surface.getBoundingClientRect();
      const baseLeft = 0;
      return {
        dragLeft: baseLeft + BLOCK_HANDLE_GAP,
        insertLeft: baseLeft,
        menuLeft: Math.min(
          Math.max(8, window.innerWidth - 256),
          Math.max(8, meta.rect.left + 8)
        ),
        menuTop: Math.max(
          8,
          Math.min(meta.rect.top - 48, window.innerHeight - 400)
        ),
        pos: meta.pos,
        top: meta.rect.top - surfaceRect.top + 2,
      };
    },
    [getSurface]
  );

  useEffect(() => {
    if (!editable) return;

    const editorDom = editor.view.dom;

    const handleMouseMove = (event: MouseEvent) => {
      if (draggedBlockRef.current) return;
      const meta = getBlockMetaFromElement(editor, event.target);
      setHoverBlock(meta ? getVisualBlock(meta) : null);
    };

    const handleMouseLeave = () => {
      if (!draggedBlockRef.current) setHoverBlock(null);
    };

    editorDom.addEventListener("mousemove", handleMouseMove);
    editorDom.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      editorDom.removeEventListener("mousemove", handleMouseMove);
      editorDom.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [editable, editor, getVisualBlock, resetDragState]);

  useEffect(() => {
    if (!insertMenu) return;

    const frame = window.requestAnimationFrame(() => {
      insertMenuInputRef.current?.focus();
    });

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (insertMenuRef.current?.contains(target)) return;
      if (target.closest(".zhinote-block-insert-handle")) return;
      setInsertMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInsertMenu(null);
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [insertMenu]);

  useEffect(() => {
    if (!editable) return;

    const surface = getSurface();
    if (!surface) return;

    const handleDragOver = (event: DragEvent) => {
      const dragged = draggedBlockRef.current;
      if (!dragged) return;

      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";

      const target = getBlockMetaFromCoords(
        editor,
        event.clientX,
        event.clientY,
        dragged
      );
      if (!target) {
        updateDropTarget(null);
        return;
      }

      updateDropTarget(
        getDropTargetFromBlockMeta(target, surface, event.clientY)
      );
    };

    const handleDrop = (event: DragEvent) => {
      const dragged = draggedBlockRef.current;
      if (!dragged) return;

      event.preventDefault();
      event.stopPropagation();

      const target =
        dropTargetRef.current ??
        getDropTargetFromCoords(
          editor,
          surface,
          event.clientX,
          event.clientY,
          dragged
        );
      if (target) {
        moveBlock(editor, dragged, target.insertPos);
      }
      resetDragState();
    };

    const handleDragEnd = () => {
      resetDragState();
    };

    surface.addEventListener("dragover", handleDragOver, true);
    surface.addEventListener("drop", handleDrop, true);
    surface.addEventListener("dragend", handleDragEnd, true);
    return () => {
      surface.removeEventListener("dragover", handleDragOver, true);
      surface.removeEventListener("drop", handleDrop, true);
      surface.removeEventListener("dragend", handleDragEnd, true);
    };
  }, [editable, editor, getSurface, resetDragState, updateDropTarget]);

  useEffect(() => {
    if (!editable) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseDraggingRef.current || !draggedBlockRef.current) return;
      const surface = getSurface();
      if (!surface) return;

      event.preventDefault();
      event.stopPropagation();
      updateDropTarget(
        getDropTargetFromCoords(
          editor,
          surface,
          event.clientX,
          event.clientY,
          draggedBlockRef.current
        )
      );
    };

    const handleMouseUp = (event: MouseEvent) => {
      const dragged = draggedBlockRef.current;
      if (!mouseDraggingRef.current || !dragged) return;
      const surface = getSurface();

      event.preventDefault();
      event.stopPropagation();

      const target =
        dropTargetRef.current ??
        (surface
          ? getDropTargetFromCoords(
              editor,
              surface,
              event.clientX,
              event.clientY,
              dragged
            )
          : null);
      if (target) {
        moveBlock(editor, dragged, target.insertPos);
      }
      resetDragState();
    };

    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("mouseup", handleMouseUp, true);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("mouseup", handleMouseUp, true);
    };
  }, [editable, editor, getSurface, resetDragState, updateDropTarget]);

  if (!editable) return null;

  const handleDragStart = (event: ReactDragEvent<HTMLButtonElement>) => {
    if (!hoverBlock) return;
    const meta = getBlockMetaByPos(editor, hoverBlock.pos);
    if (!meta) return;

    const dragged = createDraggedBlock(editor, meta);
    draggedBlockRef.current = dragged;

    const label =
      dragged.nodes
        .map((node) => node.textContent.trim())
        .filter(Boolean)
        .join(" ")
        .slice(0, 80) || "ZhiNotes block";
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", label);
    event.dataTransfer.setData("application/x-zhinote-block", "move");
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!hoverBlock || event.button !== 0) return;
    const meta = getBlockMetaByPos(editor, hoverBlock.pos);
    if (!meta) return;

    event.preventDefault();
    event.stopPropagation();
    draggedBlockRef.current = createDraggedBlock(editor, meta);
    mouseDraggingRef.current = true;
  };

  const handleInsertMenuItem = (type: InsertMenuItemType) => {
    if (!insertMenu) return;
    const meta = getBlockMetaByPos(editor, insertMenu.pos);
    setInsertMenu(null);
    setInsertMenuQuery("");
    setActiveInsertMenuIndex(0);
    if (!meta) return;
    insertBlockAfter(editor, meta, type);
  };

  const insertMenuItems = (() => {
    if (!insertMenu) return [];
    const meta = getBlockMetaByPos(editor, insertMenu.pos);
    return meta && isListItemNode(meta.node.type.name)
      ? LIST_INSERT_ITEMS
      : DEFAULT_INSERT_ITEMS;
  })();
  const visibleInsertMenuItems = filterInsertMenuItems(
    insertMenuItems,
    insertMenuQuery
  );
  const activeVisibleInsertMenuIndex =
    visibleInsertMenuItems.length > 0
      ? Math.min(activeInsertMenuIndex, visibleInsertMenuItems.length - 1)
      : 0;

  const openInsertMenu = (block: VisualBlock) => {
    setInsertMenu(block);
    setInsertMenuQuery("");
    setActiveInsertMenuIndex(0);
  };

  return (
    <>
      <div ref={layerRef} className="zhinote-block-drag-layer">
        {hoverBlock && (
          <>
            <button
              type="button"
              aria-label="打开块插入菜单"
              data-block-pos={hoverBlock.pos}
              title="打开块插入菜单"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openInsertMenu(hoverBlock);
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openInsertMenu(hoverBlock);
              }}
              className="zhinote-block-insert-handle"
              style={{ left: hoverBlock.insertLeft, top: hoverBlock.top }}
            >
              +
            </button>
            <button
              type="button"
              draggable
              aria-label="拖拽块"
              data-block-pos={hoverBlock.pos}
              title="拖拽块"
              onMouseDown={handleMouseDown}
              onDragStart={handleDragStart}
              onDragEnd={resetDragState}
              className="zhinote-block-drag-handle"
              style={{ left: hoverBlock.dragLeft, top: hoverBlock.top }}
            >
              <span className="zhinote-block-drag-dots" aria-hidden="true" />
            </button>
          </>
        )}
        {insertMenu && (
          <div
            ref={insertMenuRef}
            className="zhinote-block-insert-menu"
            style={{
              left: insertMenu.menuLeft,
              top: insertMenu.menuTop,
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <input
              ref={insertMenuInputRef}
              value={insertMenuQuery}
              onChange={(event) => {
                setInsertMenuQuery(event.target.value);
                setActiveInsertMenuIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveInsertMenuIndex((index) =>
                    visibleInsertMenuItems.length === 0
                      ? 0
                      : Math.min(index + 1, visibleInsertMenuItems.length - 1)
                  );
                  return;
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveInsertMenuIndex((index) =>
                    visibleInsertMenuItems.length === 0
                      ? 0
                      : Math.max(index - 1, 0)
                  );
                  return;
                }

                if (
                  event.key === "Enter" &&
                  visibleInsertMenuItems[activeVisibleInsertMenuIndex]
                ) {
                  event.preventDefault();
                  handleInsertMenuItem(
                    visibleInsertMenuItems[activeVisibleInsertMenuIndex].type
                  );
                }
              }}
              placeholder="搜索块..."
              className="zhinote-block-insert-menu-search"
            />
            {visibleInsertMenuItems.length === 0 && (
              <div className="zhinote-block-insert-menu-empty">
                没有匹配的块
              </div>
            )}
            {visibleInsertMenuItems.map((item, index) => (
              <button
                key={item.type}
                type="button"
                data-active={index === activeVisibleInsertMenuIndex}
                className="zhinote-block-insert-menu-item"
                onMouseEnter={() => setActiveInsertMenuIndex(index)}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleInsertMenuItem(item.type);
                }}
              >
                <span>{item.label}</span>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      {dropTarget && (
        <div
          className="zhinote-block-drop-indicator"
          data-side={dropTarget.side}
          style={{
            left: dropTarget.left,
            top: dropTarget.top,
            width: dropTarget.width,
          }}
        />
      )}
    </>
  );
}

function filterInsertMenuItems(items: InsertMenuItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  return items.filter((item) => {
    const haystack = [
      item.label,
      item.description,
      item.type,
      ...(item.aliases ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

function getDropTargetFromCoords(
  editor: TiptapEditor,
  surface: HTMLElement,
  clientX: number,
  clientY: number,
  dragged?: DraggedBlock | null
): DropTarget | null {
  const target = getBlockMetaFromCoords(editor, clientX, clientY, dragged);
  if (!target) return null;
  return getDropTargetFromBlockMeta(target, surface, clientY);
}

function getDropTargetFromBlockMeta(
  target: BlockMeta,
  surface: HTMLElement,
  clientY: number
): DropTarget {
  const side = clientY < target.rect.top + target.rect.height / 2
    ? "before"
    : "after";
  const surfaceRect = surface.getBoundingClientRect();
  const top =
    side === "before"
      ? target.rect.top - surfaceRect.top
      : target.rect.bottom - surfaceRect.top;

  return {
    insertPos: side === "before" ? target.pos : target.end,
    left: target.rect.left - surfaceRect.left,
    side,
    top,
    width: target.rect.width,
  };
}

function createDraggedBlock(editor: TiptapEditor, meta: BlockMeta): DraggedBlock {
  const selectedRange = getSelectedDraggedBlockRange(editor, meta);
  if (selectedRange) return selectedRange;

  return {
    node: meta.node,
    nodes: [meta.node],
    parentName: meta.parentName,
    pos: meta.pos,
    end: meta.end,
  };
}

function getSelectedDraggedBlockRange(
  editor: TiptapEditor,
  draggedMeta: BlockMeta
): DraggedBlock | null {
  const { selection } = editor.state;
  if (selection.empty) return null;
  if (isListItemNode(draggedMeta.node.type.name)) return null;
  if (draggedMeta.parentName !== "doc" && draggedMeta.parentName !== "columnBlock") {
    return null;
  }

  const { from, to } = selection;
  const selectedBlocks = getDraggableBlocks(editor)
    .filter((block) => block.parentName === draggedMeta.parentName)
    .filter((block) => !isListItemNode(block.node.type.name))
    .filter((block) => from < block.end && to > block.pos)
    .sort((a, b) => a.pos - b.pos);

  if (selectedBlocks.length <= 1) return null;
  if (!selectedBlocks.some((block) => block.pos === draggedMeta.pos)) return null;

  return {
    node: selectedBlocks[0].node,
    nodes: selectedBlocks.map((block) => block.node),
    parentName: draggedMeta.parentName,
    pos: selectedBlocks[0].pos,
    end: selectedBlocks[selectedBlocks.length - 1].end,
  };
}

function moveBlock(
  editor: TiptapEditor,
  dragged: DraggedBlock,
  insertPos: number
) {
  if (insertPos === dragged.pos || insertPos === dragged.end) return;
  if (insertPos > dragged.pos && insertPos < dragged.end) return;

  const draggedSize = dragged.end - dragged.pos;
  const adjustedInsertPos =
    insertPos > dragged.pos ? insertPos - draggedSize : insertPos;
  const tr = editor.state.tr
    .delete(dragged.pos, dragged.end)
    .insert(adjustedInsertPos, Fragment.fromArray(dragged.nodes));

  try {
    const selectionPos = Math.min(
      adjustedInsertPos + 1,
      Math.max(0, tr.doc.content.size)
    );
    tr.setSelection(TextSelection.near(tr.doc.resolve(selectionPos)));
  } catch {
    // Leaving the selection unchanged is acceptable after a structural drag.
  }

  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}

function insertBlockAfter(
  editor: TiptapEditor,
  block: BlockMeta,
  itemType: InsertMenuItemType
) {
  const nodeName = block.node.type.name;
  const insertContent = getInsertContent(nodeName, itemType);

  editor
    .chain()
    .focus()
    .insertContentAt(block.end, insertContent, { updateSelection: true })
    .run();
}

function getInsertContent(
  currentNodeName: string,
  itemType: InsertMenuItemType
): JSONContent {
  if (currentNodeName === "taskItem") {
    return {
      type: "taskItem",
      attrs: { checked: false },
      content: [{ type: "paragraph" }],
    };
  }

  if (currentNodeName === "listItem") {
    return {
      type: "listItem",
      content: [{ type: "paragraph" }],
    };
  }

  switch (itemType) {
    case "heading1":
      return { type: "heading", attrs: { level: 1 } };
    case "heading2":
      return { type: "heading", attrs: { level: 2 } };
    case "heading3":
      return { type: "heading", attrs: { level: 3 } };
    case "bulletList":
      return {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
      };
    case "taskList":
      return {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [{ type: "paragraph" }],
          },
        ],
      };
    case "toggle":
      return {
        type: "toggleBlock",
        attrs: { summary: "Toggle", open: true },
        content: [{ type: "paragraph" }],
      };
    case "callout":
      return {
        type: "calloutBlock",
        attrs: { icon: "i", tone: "blue" },
        content: [{ type: "paragraph" }],
      };
    case "quote":
      return {
        type: "blockquote",
        content: [{ type: "paragraph" }],
      };
    case "divider":
      return { type: "horizontalRule" };
    case "code":
      return {
        type: "codeBlock",
        attrs: { language: "text" },
      };
    case "toc":
      return { type: "tableOfContentsBlock" };
    case "columns":
      return {
        type: "columnLayout",
        attrs: { columns: 2 },
        content: [
          { type: "columnBlock", content: [{ type: "paragraph" }] },
          { type: "columnBlock", content: [{ type: "paragraph" }] },
        ],
      };
    case "bookmark":
      return {
        type: "bookmarkBlock",
        attrs: { url: "", title: "", description: "" },
      };
    case "embed":
      return {
        type: "embedBlock",
        attrs: { url: "", caption: "" },
      };
    case "text":
    default:
      return { type: "paragraph" };
  }
}

function getBlockMetaFromCoords(
  editor: TiptapEditor,
  clientX: number,
  clientY: number,
  dragged?: DraggedBlock | null
) {
  const element = document.elementFromPoint(clientX, clientY);
  const directMeta = getBlockMetaFromElement(editor, element, dragged);
  if (directMeta) return directMeta;
  return getClosestBlockMetaByY(editor, clientY, clientX, dragged);
}

function getBlockMetaFromElement(
  editor: TiptapEditor,
  target: EventTarget | null,
  dragged?: DraggedBlock | null
) {
  if (!(target instanceof Element)) return null;
  return getDraggableBlocks(editor)
    .filter((block) => isCompatibleDropTarget(block, dragged))
    .filter((block) => block.element.contains(target))
    .sort((a, b) => getRectArea(a.rect) - getRectArea(b.rect))[0] ?? null;
}

function getBlockMetaByPos(editor: TiptapEditor, pos: number) {
  return getDraggableBlocks(editor).find((block) => block.pos === pos) ?? null;
}

function getClosestBlockMetaByY(
  editor: TiptapEditor,
  clientY: number,
  clientX?: number,
  dragged?: DraggedBlock | null
) {
  const blocks = getDraggableBlocks(editor).filter((block) =>
    isCompatibleDropTarget(block, dragged)
  );
  const xMatches = blocks.filter(
    (block) =>
      clientX === undefined ||
      (clientX >= block.rect.left - 8 && clientX <= block.rect.right + 8)
  );
  const candidates = xMatches.length > 0 ? xMatches : blocks;
  let closest: BlockMeta | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  candidates.forEach((block) => {
    const midpoint = block.rect.top + block.rect.height / 2;
    const distance = Math.abs(clientY - midpoint);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = block;
    }
  });

  return closest;
}

function getDraggableBlocks(editor: TiptapEditor) {
  const blocks: BlockMeta[] = [];

  editor.state.doc.descendants((node, pos, parent) => {
    const parentName = parent?.type.name ?? "";
    const isListItem = isListItemNode(node.type.name);
    if (
      !node.isBlock ||
      node.type.name === "columnBlock" ||
      (!isListItem && parentName !== "doc" && parentName !== "columnBlock")
    ) {
      return true;
    }

    const element = editor.view.nodeDOM(pos);
    if (!(element instanceof HTMLElement)) return true;
    blocks.push({
      element,
      end: pos + node.nodeSize,
      node,
      parentName,
      pos,
      rect: element.getBoundingClientRect(),
    });
    return true;
  });

  return blocks;
}

function isCompatibleDropTarget(
  target: BlockMeta,
  dragged?: DraggedBlock | null
) {
  if (!dragged) return true;

  const draggedIsListItem = isListItemNode(dragged.node.type.name);
  const targetIsListItem = isListItemNode(target.node.type.name);
  if (draggedIsListItem || targetIsListItem) {
    return (
      draggedIsListItem &&
      targetIsListItem &&
      dragged.node.type.name === target.node.type.name
    );
  }

  return target.parentName === "doc" || target.parentName === "columnBlock";
}

function isListItemNode(nodeName: string) {
  return nodeName === "listItem" || nodeName === "taskItem";
}

function getRectArea(rect: DOMRect) {
  return rect.width * rect.height;
}
