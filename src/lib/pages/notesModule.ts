import type { PageModuleCounts } from "@/lib/db/local/queries";
import {
  buildPageResearchStructureReport,
  type PageResearchStructureStatus,
} from "@/lib/pages/pageResearchStructure";
import type { Page } from "@/lib/utils/types";

export type NotesModuleLaneId =
  | "inbox"
  | "structure"
  | "research-links"
  | "review-trail"
  | "knowledge-base"
  | "export-safety";

export type NotesModuleActionStatus =
  | "needs-page"
  | "needs-structure"
  | "needs-linking"
  | "needs-review"
  | "ready-to-open"
  | "review-only";

export type NotesModulePriority = "high" | "medium" | "low";

export interface NotesModuleSnapshot {
  page: Page;
  favorite: boolean;
  locked: boolean;
  counts: PageModuleCounts;
}

export interface NotesModuleLane {
  id: NotesModuleLaneId;
  title: string;
  description: string;
  route: string;
  action_count: number;
  high_priority_count: number;
  privacy_boundary: string;
}

export interface NotesModulePageItem {
  page_id: string;
  title: string;
  parent_id: string | null;
  is_root: boolean;
  favorite: boolean;
  locked: boolean;
  has_cover: boolean;
  created_at: string;
  updated_at: string;
  structure_status: PageResearchStructureStatus;
  word_count: number;
  block_count: number;
  heading_count: number;
  file_blocks: number;
  database_blocks: number;
  page_mentions: number;
  outgoing_links: number;
  backlinks: number;
  versions: number;
  comments: number;
  unresolved_comments: number;
  role: "research-note" | "report-note" | "meeting-note" | "company-note" | "general-note";
  readiness_score: number;
  next_action: string;
  open_route: string;
  privacy_boundary: string;
}

export interface NotesModuleAction {
  id: string;
  lane_id: NotesModuleLaneId;
  page_id: string | null;
  title: string;
  priority: NotesModulePriority;
  status: NotesModuleActionStatus;
  evidence: string;
  next_action: string;
  action_route: string;
  route_label: string;
  writes_workspace_data: false;
  requires_manual_confirmation: boolean;
  privacy_boundary: string;
}

export interface NotesModuleReviewStep {
  id: string;
  order: number;
  title: string;
  route: string;
  target_section_id: string;
  reason: string;
  completion_signal: string;
}

export interface NotesModuleWorkbenchReport {
  format: "zhinote-notes-module-workbench";
  format_version: 1;
  report_status: "local-notes-module-only";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_page_metadata: true;
    reads_page_content_html: true;
    reads_page_versions_metadata: true;
    reads_comment_counts: true;
    reads_wiki_link_counts: true;
    reads_database_rows: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    uploads_data: false;
    connects_cloud_services: false;
    enables_ai: false;
    writes_workspace_data: false;
    includes_page_body_text: false;
    includes_comment_body_text: false;
    includes_file_bytes: false;
  };
  summary: {
    pages: number;
    root_pages: number;
    child_pages: number;
    favorite_pages: number;
    locked_pages: number;
    pages_with_covers: number;
    empty_pages: number;
    structured_pages: number;
    thin_pages: number;
    needs_structure_pages: number;
    pages_with_files: number;
    pages_with_inline_databases: number;
    pages_with_links: number;
    pages_with_backlinks: number;
    pages_with_versions: number;
    pages_with_unresolved_comments: number;
    total_words: number;
    total_blocks: number;
    actions: number;
    high_priority_actions: number;
  };
  lanes: NotesModuleLane[];
  pages: NotesModulePageItem[];
  actions: NotesModuleAction[];
  review_sequence: NotesModuleReviewStep[];
  forbidden_actions: string[];
  required_verification_commands: string[];
}

const EMPTY_COUNTS: PageModuleCounts = {
  pageId: "",
  versions: 0,
  pageComments: 0,
  unresolvedPageComments: 0,
  blockComments: 0,
  unresolvedBlockComments: 0,
  outgoingLinks: 0,
  backlinks: 0,
};

const LANE_META: Record<
  NotesModuleLaneId,
  Omit<NotesModuleLane, "action_count" | "high_priority_count">
> = {
  inbox: {
    id: "inbox",
    title: "笔记入口",
    description: "把新笔记、模板页和最近更新页集中到一个模块入口。",
    route: "/modules/notes",
    privacy_boundary:
      "只打开本地页面或创建用户确认的新页面，不同步、不上传、不调用 AI。",
  },
  structure: {
    id: "structure",
    title: "投研结构",
    description: "检查页面是否有标题骨架、结论、证据、行动项和复盘线索。",
    route: "/modules/notes",
    privacy_boundary:
      "结构判断在浏览器本地完成；导出只包含统计和状态，不包含页面正文。",
  },
  "research-links": {
    id: "research-links",
    title: "研究关联",
    description: "检查页面是否连接到其他页面、文件预览或 inline database。",
    route: "/modules/research-graph",
    privacy_boundary:
      "只使用 wiki link、file block 和 inline database 计数，不读取 linked page bodies 或 row values。",
  },
  "review-trail": {
    id: "review-trail",
    title: "复盘痕迹",
    description: "检查版本历史、评论和未解决 review 项。",
    route: "/modules/notes",
    privacy_boundary:
      "只读取版本数量和评论数量，不导出版本正文、评论正文或 block anchor text。",
  },
  "knowledge-base": {
    id: "knowledge-base",
    title: "知识库组织",
    description: "区分根页面、子页面、收藏、锁定和封面，保持笔记库可导航。",
    route: "/modules/notes",
    privacy_boundary:
      "只使用本地页面 metadata，不改变页面层级、收藏或锁定状态。",
  },
  "export-safety": {
    id: "export-safety",
    title: "导出安全",
    description: "把 Markdown、HTML、PDF、备份和 ZIP 导出留在本地手动路径。",
    route: "/modules/notes",
    privacy_boundary:
      "工作台不自动导出页面正文或文件；真实导出由用户在页面或侧边栏主动触发。",
  },
};

const FORBIDDEN_ACTIONS = [
  "upload_notes_without_confirmation",
  "send_page_text_to_ai",
  "export_page_body_text_from_workbench",
  "export_comment_body_text_from_workbench",
  "read_database_row_values_for_notes_module",
  "read_file_bytes_for_notes_module",
  "auto_delete_pages",
  "auto_overwrite_pages",
  "auto_sync_notes",
  "load_external_assets_without_confirmation",
];

export function buildNotesModuleWorkbenchReport(
  snapshots: NotesModuleSnapshot[]
): NotesModuleWorkbenchReport {
  const pages = snapshots.map(buildPageItem).sort(sortPages);
  const actions = buildActions(pages).sort(sortActions);
  const lanes = buildLanes(actions);

  return {
    format: "zhinote-notes-module-workbench",
    format_version: 1,
    report_status: "local-notes-module-only",
    privacy_note:
      "Generated locally from active page metadata, local page HTML structure, version counts, comment counts, wiki-link counts, local favorite state, and local lock state. It does not read database rows, row values, file bytes, linked page bodies, cloud data, prompts, tokens, credentials, holdings, or trading plans. The exported workbench includes structure counts and statuses, not page body text or comment body text, and it does not write workspace data, connect cloud services, upload data, or enable AI.",
    boundary: {
      local_report_only: true,
      reads_page_metadata: true,
      reads_page_content_html: true,
      reads_page_versions_metadata: true,
      reads_comment_counts: true,
      reads_wiki_link_counts: true,
      reads_database_rows: false,
      reads_database_row_values: false,
      reads_file_bytes: false,
      uploads_data: false,
      connects_cloud_services: false,
      enables_ai: false,
      writes_workspace_data: false,
      includes_page_body_text: false,
      includes_comment_body_text: false,
      includes_file_bytes: false,
    },
    summary: summarize(pages, actions),
    lanes,
    pages,
    actions,
    review_sequence: buildReviewSequence(pages, actions),
    forbidden_actions: FORBIDDEN_ACTIONS,
    required_verification_commands: [
      "npm run verify:page-structure",
      "npm run verify:modules",
      "npm run lint",
      "npm run build",
    ],
  };
}

function buildPageItem(snapshot: NotesModuleSnapshot): NotesModulePageItem {
  const page = snapshot.page;
  const counts = snapshot.counts ?? {
    ...EMPTY_COUNTS,
    pageId: page.id,
  };
  const structure = buildPageResearchStructureReport({
    html: page.content_text ?? "",
    title: page.title || "未命名页面",
    metadata: {
      favorite: snapshot.favorite,
      hasCover: Boolean(page.cover_url),
      locked: snapshot.locked,
      versionsCount: counts.versions,
      widePage: false,
    },
  });
  const unresolvedComments =
    counts.unresolvedPageComments + counts.unresolvedBlockComments;
  const comments = counts.pageComments + counts.blockComments;
  const role = inferPageRole(page.title, page.content_text ?? "");

  return {
    page_id: page.id,
    title: page.title || "未命名页面",
    parent_id: page.parent_id,
    is_root: !page.parent_id,
    favorite: snapshot.favorite,
    locked: snapshot.locked,
    has_cover: Boolean(page.cover_url),
    created_at: page.created_at,
    updated_at: page.updated_at,
    structure_status: structure.structure_status,
    word_count: structure.summary.words,
    block_count: structure.summary.blocks,
    heading_count: structure.summary.headings,
    file_blocks: structure.summary.file_blocks,
    database_blocks: structure.summary.database_blocks,
    page_mentions: structure.summary.page_mentions,
    outgoing_links: counts.outgoingLinks,
    backlinks: counts.backlinks,
    versions: counts.versions,
    comments,
    unresolved_comments: unresolvedComments,
    role,
    readiness_score: scorePage(structure.structure_status, {
      words: structure.summary.words,
      links: counts.outgoingLinks + counts.backlinks + structure.summary.page_mentions,
      versions: counts.versions,
      comments,
      fileBlocks: structure.summary.file_blocks,
      databaseBlocks: structure.summary.database_blocks,
      favorite: snapshot.favorite,
      locked: snapshot.locked,
    }),
    next_action: getPageNextAction(structure.structure_status, counts, structure.summary),
    open_route: `/page/${page.id}`,
    privacy_boundary:
      "Page rollup is generated locally. It stores page title, structure counts, metadata counts, and routes only; it does not include page body text, comment body text, linked page bodies, database row values, or file bytes.",
  };
}

function buildActions(pages: NotesModulePageItem[]): NotesModuleAction[] {
  const actions: NotesModuleAction[] = [];

  if (pages.length === 0) {
    actions.push({
      id: "notes-workbench:create-first-note",
      lane_id: "inbox",
      page_id: null,
      title: "创建第一篇投研笔记",
      priority: "high",
      status: "needs-page",
      evidence: "当前工作区没有活跃页面。",
      next_action:
        "在笔记模块创建空白页面或投资备忘录模板，作为本地知识库的第一块内容。",
      action_route: "/modules/notes",
      route_label: "打开笔记模块",
      writes_workspace_data: false,
      requires_manual_confirmation: true,
      privacy_boundary:
        "The workbench only shows the route. Creating a page is a separate local user click.",
    });
    return actions;
  }

  for (const page of pages) {
    if (page.structure_status === "empty") {
      actions.push({
        id: `notes-workbench:empty:${page.page_id}`,
        lane_id: "structure",
        page_id: page.page_id,
        title: `${page.title} 还是空白页`,
        priority: "high",
        status: "needs-structure",
        evidence: `${page.word_count} words · ${page.block_count} blocks`,
        next_action:
          "打开页面，用 slash command 或投研结构面板插入 H2/H3、结论、证据和下一步。",
        action_route: page.open_route,
        route_label: "打开页面",
        writes_workspace_data: false,
        requires_manual_confirmation: false,
        privacy_boundary:
          "Opening a page does not edit it. Structure insertion still happens inside the page after the user clicks.",
      });
    } else if (page.structure_status === "needs-structure") {
      actions.push({
        id: `notes-workbench:structure:${page.page_id}`,
        lane_id: "structure",
        page_id: page.page_id,
        title: `${page.title} 需要补投研结构`,
        priority: "high",
        status: "needs-structure",
        evidence: `${page.heading_count} headings · ${page.word_count} words`,
        next_action:
          "打开页面的信息面板，按“下一步队列”补标题骨架、结论、证据来源或行动项。",
        action_route: page.open_route,
        route_label: "打开页面",
        writes_workspace_data: false,
        requires_manual_confirmation: false,
        privacy_boundary:
          "The module report does not write page content. Any scaffold insertion is a manual page-level action.",
      });
    } else if (page.structure_status === "thin") {
      actions.push({
        id: `notes-workbench:thin:${page.page_id}`,
        lane_id: "structure",
        page_id: page.page_id,
        title: `${page.title} 内容偏薄`,
        priority: "medium",
        status: "needs-structure",
        evidence: `${page.word_count} words · ${page.heading_count} headings`,
        next_action:
          "补充核心结论、来源、风险、催化剂或后续行动，让笔记可复盘。",
        action_route: page.open_route,
        route_label: "打开页面",
        writes_workspace_data: false,
        requires_manual_confirmation: false,
        privacy_boundary:
          "The workbench only recommends review. It does not generate content or call AI.",
      });
    }

    if (
      page.outgoing_links + page.backlinks + page.page_mentions === 0 &&
      page.word_count > 80
    ) {
      actions.push({
        id: `notes-workbench:links:${page.page_id}`,
        lane_id: "research-links",
        page_id: page.page_id,
        title: `${page.title} 尚未连接研究上下文`,
        priority: "medium",
        status: "needs-linking",
        evidence: "0 wiki/page relations detected.",
        next_action:
          "用 [[页面链接]]、报告文件块或 inline database，把它连接到公司、报告、会议或组合资产。",
        action_route: page.open_route,
        route_label: "打开页面",
        writes_workspace_data: false,
        requires_manual_confirmation: false,
        privacy_boundary:
          "Relation suggestions use link counts only and do not read linked page bodies or database row values.",
      });
    }

    if (page.versions === 0 && page.word_count > 120) {
      actions.push({
        id: `notes-workbench:version:${page.page_id}`,
        lane_id: "review-trail",
        page_id: page.page_id,
        title: `${page.title} 没有保存版本`,
        priority: "low",
        status: "needs-review",
        evidence: "0 saved versions.",
        next_action:
          "打开页面后保存一个 named version，方便后续比较投资假设变化。",
        action_route: page.open_route,
        route_label: "打开页面",
        writes_workspace_data: false,
        requires_manual_confirmation: false,
        privacy_boundary:
          "Version recommendation uses version count only and does not export version content.",
      });
    }

    if (page.unresolved_comments > 0) {
      actions.push({
        id: `notes-workbench:comments:${page.page_id}`,
        lane_id: "review-trail",
        page_id: page.page_id,
        title: `${page.title} 有未解决评论`,
        priority: "medium",
        status: "needs-review",
        evidence: `${page.unresolved_comments} unresolved comments.`,
        next_action:
          "打开页面处理评论或 block comment，确认哪些是行动项、观点变化或待查证问题。",
        action_route: page.open_route,
        route_label: "打开页面",
        writes_workspace_data: false,
        requires_manual_confirmation: false,
        privacy_boundary:
          "The workbench uses comment counts only. It does not include comment body text or anchor text.",
      });
    }
  }

  const rootPages = pages.filter((page) => page.is_root).length;
  if (rootPages > 8) {
    actions.push({
      id: "notes-workbench:root-page-sprawl",
      lane_id: "knowledge-base",
      page_id: null,
      title: "根页面较多，建议整理知识库层级",
      priority: "low",
      status: "review-only",
      evidence: `${rootPages} root pages.`,
      next_action:
        "把临时笔记归入公司、报告、会议、组合或研究框架页面下，减少侧边栏噪音。",
      action_route: "/modules/notes",
      route_label: "查看笔记模块",
      writes_workspace_data: false,
      requires_manual_confirmation: false,
      privacy_boundary:
        "This is a metadata-only organization suggestion. It does not move pages automatically.",
    });
  }

  return actions;
}

function buildLanes(actions: NotesModuleAction[]): NotesModuleLane[] {
  return (Object.keys(LANE_META) as NotesModuleLaneId[]).map((id) => {
    const laneActions = actions.filter((action) => action.lane_id === id);
    return {
      ...LANE_META[id],
      action_count: laneActions.length,
      high_priority_count: laneActions.filter(
        (action) => action.priority === "high"
      ).length,
    };
  });
}

function buildReviewSequence(
  pages: NotesModulePageItem[],
  actions: NotesModuleAction[]
): NotesModuleReviewStep[] {
  if (pages.length === 0) {
    return [
      reviewStep(
        "create-first-note",
        1,
        "创建第一篇本地投研笔记",
        "/modules/notes",
        "notes-create-entry",
        "笔记/page 是 ZhiNotes 的知识库底座，没有页面就没有后续模块承载。",
        "至少有一篇本地页面。"
      ),
    ];
  }

  const steps: NotesModuleReviewStep[] = [];
  if (actions.some((action) => action.lane_id === "structure")) {
    steps.push(
      reviewStep(
        "structure-first",
        steps.length + 1,
        "先补投研结构",
        "/modules/notes",
        "notes-priority-actions",
        "标题骨架、结论、证据、行动项让笔记从记录变成可复盘研究资产。",
        "高优先级页面不再是 empty 或 needs-structure。"
      )
    );
  }
  if (actions.some((action) => action.lane_id === "research-links")) {
    steps.push(
      reviewStep(
        "link-context",
        steps.length + 1,
        "再补研究关联",
        "/modules/research-graph",
        "notes-research-links",
        "投研平台需要公司、报告、会议、组合和笔记互相连接。",
        "关键研究笔记至少有一个 wiki link、file block、inline database 或 backlink。"
      )
    );
  }
  if (actions.some((action) => action.lane_id === "review-trail")) {
    steps.push(
      reviewStep(
        "review-trail",
        steps.length + 1,
        "最后补复盘痕迹",
        "/modules/notes",
        "notes-focus-pages",
        "版本历史和评论能记录观点变化，避免研究结论丢失上下文。",
        "长笔记保存版本，未解决评论被处理或转成行动项。"
      )
    );
  }
  if (steps.length === 0) {
    steps.push(
      reviewStep(
        "keep-notes-operable",
        1,
        "保持笔记库可导航",
        "/modules/notes",
        "notes-workbench-routes",
        "当前没有紧急缺口，下一步是按真实投研流程整理根页面、收藏和锁定状态。",
        "关键页面容易从侧边栏、搜索和模块入口找到。"
      )
    );
  }
  return steps;
}

function reviewStep(
  id: string,
  order: number,
  title: string,
  route: string,
  targetSectionId: string,
  reason: string,
  completionSignal: string
): NotesModuleReviewStep {
  return {
    id,
    order,
    title,
    route,
    target_section_id: targetSectionId,
    reason,
    completion_signal: completionSignal,
  };
}

function summarize(
  pages: NotesModulePageItem[],
  actions: NotesModuleAction[]
): NotesModuleWorkbenchReport["summary"] {
  return {
    pages: pages.length,
    root_pages: pages.filter((page) => page.is_root).length,
    child_pages: pages.filter((page) => !page.is_root).length,
    favorite_pages: pages.filter((page) => page.favorite).length,
    locked_pages: pages.filter((page) => page.locked).length,
    pages_with_covers: pages.filter((page) => page.has_cover).length,
    empty_pages: pages.filter((page) => page.structure_status === "empty").length,
    structured_pages: pages.filter((page) => page.structure_status === "ready")
      .length,
    thin_pages: pages.filter((page) => page.structure_status === "thin").length,
    needs_structure_pages: pages.filter(
      (page) => page.structure_status === "needs-structure"
    ).length,
    pages_with_files: pages.filter((page) => page.file_blocks > 0).length,
    pages_with_inline_databases: pages.filter(
      (page) => page.database_blocks > 0
    ).length,
    pages_with_links: pages.filter(
      (page) => page.outgoing_links + page.page_mentions > 0
    ).length,
    pages_with_backlinks: pages.filter((page) => page.backlinks > 0).length,
    pages_with_versions: pages.filter((page) => page.versions > 0).length,
    pages_with_unresolved_comments: pages.filter(
      (page) => page.unresolved_comments > 0
    ).length,
    total_words: pages.reduce((sum, page) => sum + page.word_count, 0),
    total_blocks: pages.reduce((sum, page) => sum + page.block_count, 0),
    actions: actions.length,
    high_priority_actions: actions.filter((action) => action.priority === "high")
      .length,
  };
}

function inferPageRole(
  title: string,
  content: string
): NotesModulePageItem["role"] {
  const searchable = `${title} ${content}`.toLowerCase();
  if (searchable.includes("会议") || searchable.includes("transcript")) {
    return "meeting-note";
  }
  if (searchable.includes("报告") || searchable.includes("html report")) {
    return "report-note";
  }
  if (searchable.includes("公司") || searchable.includes("company")) {
    return "company-note";
  }
  if (
    searchable.includes("投资") ||
    searchable.includes("估值") ||
    searchable.includes("thesis")
  ) {
    return "research-note";
  }
  return "general-note";
}

function scorePage(
  structureStatus: PageResearchStructureStatus,
  input: {
    words: number;
    links: number;
    versions: number;
    comments: number;
    fileBlocks: number;
    databaseBlocks: number;
    favorite: boolean;
    locked: boolean;
  }
) {
  let score = 0;
  if (structureStatus === "ready") score += 30;
  if (structureStatus === "thin") score += 15;
  if (input.words > 120) score += 10;
  if (input.words > 600) score += 10;
  if (input.links > 0) score += 15;
  if (input.versions > 0) score += 10;
  if (input.comments > 0) score += 5;
  if (input.fileBlocks > 0) score += 5;
  if (input.databaseBlocks > 0) score += 5;
  if (input.favorite) score += 5;
  if (input.locked) score += 5;
  return score;
}

function getPageNextAction(
  structureStatus: PageResearchStructureStatus,
  counts: PageModuleCounts,
  summary: ReturnType<typeof buildPageResearchStructureReport>["summary"]
) {
  if (structureStatus === "empty") {
    return "先插入投研结构模板或 H2/H3 骨架。";
  }
  if (structureStatus === "needs-structure") {
    return "补核心结论、证据来源、行动项或研究 relation。";
  }
  if (structureStatus === "thin") {
    return "补充假设、风险、催化剂、来源和下一步。";
  }
  if (counts.outgoingLinks + counts.backlinks + summary.page_mentions === 0) {
    return "补 wiki link 或 relation，让这篇笔记进入研究图谱。";
  }
  if (counts.versions === 0) {
    return "保存一个 named version，留下复盘痕迹。";
  }
  return "结构可用，继续保持版本、评论和研究关系。";
}

function sortPages(left: NotesModulePageItem, right: NotesModulePageItem) {
  if (left.readiness_score !== right.readiness_score) {
    return left.readiness_score - right.readiness_score;
  }
  return (
    new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  );
}

function sortActions(left: NotesModuleAction, right: NotesModuleAction) {
  const priorityRank: Record<NotesModulePriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  const laneRank: Record<NotesModuleLaneId, number> = {
    inbox: 0,
    structure: 1,
    "research-links": 2,
    "review-trail": 3,
    "knowledge-base": 4,
    "export-safety": 5,
  };
  if (priorityRank[left.priority] !== priorityRank[right.priority]) {
    return priorityRank[left.priority] - priorityRank[right.priority];
  }
  if (laneRank[left.lane_id] !== laneRank[right.lane_id]) {
    return laneRank[left.lane_id] - laneRank[right.lane_id];
  }
  return left.title.localeCompare(right.title, "zh-CN");
}
