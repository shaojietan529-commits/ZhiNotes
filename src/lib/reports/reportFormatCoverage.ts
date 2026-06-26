import type {
  FilePreviewCapability,
  FilePreviewSupportLevel,
} from "@/lib/files/filePreviewCapabilities";
import { FILE_PREVIEW_CAPABILITIES } from "@/lib/files/filePreviewCapabilities";
import type { FilePreviewReadinessReport } from "@/lib/files/filePreviewReadiness";
import type { PageFileKind } from "@/lib/files/localStore";
import type { ReportIntakeReport } from "@/lib/reports/reportIntake";

export type ReportFormatCoverageStatus =
  | "active"
  | "active-needs-confirmation"
  | "supported-unused"
  | "blocked-limited"
  | "unsupported-active";

export type ReportFormatCoverageGapStatus =
  | "ready"
  | "manual-confirmation"
  | "blocked";

export interface ReportFormatCoverageInput {
  intake: ReportIntakeReport;
  readiness: FilePreviewReadinessReport;
  capabilities?: FilePreviewCapability[];
}

export interface ReportFormatCoverageRow {
  id: string;
  label: string;
  kinds: PageFileKind[];
  extensions: string[];
  support_level: FilePreviewSupportLevel | "unknown";
  readiness_status: ReportFormatCoverageGapStatus;
  coverage_status: ReportFormatCoverageStatus;
  active_items: number;
  route_present_in_readiness: boolean;
  requires_confirmation: boolean;
  capability_gap: string | null;
  recommended_action: string;
  privacy_boundary: string;
}

export interface ReportFormatCoverageGap {
  id: string;
  title: string;
  status: ReportFormatCoverageGapStatus;
  evidence: string;
  required_action: string;
}

export interface ReportFormatCoverageReport {
  format: "zhinote-report-format-coverage";
  format_version: 1;
  report_status: "local-format-coverage-only";
  coverage_verdict: "usable-with-local-gates";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_report_intake_metadata: true;
    reads_capability_metadata: true;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_file_text: false;
    reads_page_body_text: false;
    writes_workspace_data: false;
    loads_external_resources: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    capability_groups: number;
    active_groups: number;
    supported_unused_groups: number;
    unsupported_active_groups: number;
    blocked_limited_groups: number;
    active_items: number;
    active_native_groups: number;
    active_converted_groups: number;
    active_metadata_groups: number;
    active_confirmation_groups: number;
    gap_count: number;
    manual_confirmation_gaps: number;
    blocked_gaps: number;
  };
  rows: ReportFormatCoverageRow[];
  gaps: ReportFormatCoverageGap[];
}

export function buildReportFormatCoverageReport({
  intake,
  readiness,
  capabilities = FILE_PREVIEW_CAPABILITIES,
}: ReportFormatCoverageInput): ReportFormatCoverageReport {
  const rows = buildCoverageRows(intake, readiness, capabilities);
  const gaps = buildCoverageGaps(intake, rows);
  const summary = summarizeCoverage(rows, gaps);

  return {
    format: "zhinote-report-format-coverage",
    format_version: 1,
    report_status: "local-format-coverage-only",
    coverage_verdict: "usable-with-local-gates",
    privacy_note:
      "由报告 intake 计数和文件预览能力元数据在本地生成。这个覆盖报告只按格式类型分组；不包含文件名、文件字节、转换后的文件文本、页面正文、云端数据、AI prompt、token、凭证或私有研究内容。",
    boundary: {
      local_report_only: true,
      reads_report_intake_metadata: true,
      reads_capability_metadata: true,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_file_text: false,
      reads_page_body_text: false,
      writes_workspace_data: false,
      loads_external_resources: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary,
    rows,
    gaps,
  };
}

function buildCoverageRows(
  intake: ReportIntakeReport,
  readiness: FilePreviewReadinessReport,
  capabilities: FilePreviewCapability[]
): ReportFormatCoverageRow[] {
  const countByKind = countIntakeKinds(intake);
  const readinessById = new Map(readiness.routes.map((route) => [route.id, route]));
  const supportedKinds = new Set(capabilities.flatMap((capability) => capability.kinds));
  const rows = capabilities.map((capability) => {
    const route = readinessById.get(capability.id);
    const activeItems = capability.kinds.reduce(
      (count, kind) => count + (countByKind.get(kind) ?? 0),
      0
    );
    const coverageStatus = getCoverageStatus(capability, route, activeItems);

    return {
      id: capability.id,
      label: capability.label,
      kinds: capability.kinds,
      extensions: capability.extensions,
      support_level: capability.support_level,
      readiness_status: route?.readiness_status ?? "blocked",
      coverage_status: coverageStatus,
      active_items: activeItems,
      route_present_in_readiness: Boolean(route),
      requires_confirmation: Boolean(route?.requires_confirmation),
      capability_gap: route?.gap ?? capability.limitation ?? null,
      recommended_action: getRecommendedAction(capability, activeItems),
      privacy_boundary: capability.privacy_boundary,
    } satisfies ReportFormatCoverageRow;
  });

  const unsupportedRows = [...countByKind.entries()]
    .filter(([kind]) => !supportedKinds.has(kind))
    .map(([kind, count]) => ({
      id: `unsupported-${kind}`,
      label: `${kind} / 未登记格式`,
      kinds: [kind],
      extensions: [],
      support_level: "unknown" as const,
      readiness_status: "blocked" as const,
      coverage_status: "unsupported-active" as const,
      active_items: count,
      route_present_in_readiness: false,
      requires_confirmation: true,
      capability_gap:
        "这个格式在能力矩阵中没有明确路线，默认只能本地保存和下载。",
      recommended_action:
        "先确认来源和研究用途，再决定是否新增安全的本地预览或转换路线。",
      privacy_boundary:
        "未知格式不读取正文、不执行、不上传；只保留本地附件和元数据。",
    }));

  return [...rows, ...unsupportedRows].sort(sortRows);
}

function buildCoverageGaps(
  intake: ReportIntakeReport,
  rows: ReportFormatCoverageRow[]
): ReportFormatCoverageGap[] {
  const activeNeedsConfirmation = rows.filter(
    (row) => row.active_items > 0 && row.requires_confirmation
  );
  const blockedLimited = rows.filter(
    (row) => row.coverage_status === "blocked-limited"
  );
  const unsupportedActive = rows.filter(
    (row) => row.coverage_status === "unsupported-active"
  );
  const activeConverted = rows.filter(
    (row) => row.active_items > 0 && row.support_level === "converted"
  );
  const activeHtml = rows.find((row) => row.id === "html-report")?.active_items ?? 0;
  const activeSpreadsheet =
    rows.find((row) => row.id === "spreadsheet")?.active_items ?? 0;

  return [
    {
      id: "intake-coverage",
      title: "实际文件覆盖",
      status: intake.summary.intake_items > 0 ? "ready" : "manual-confirmation",
      evidence:
        intake.summary.intake_items > 0
          ? `${intake.summary.intake_items} 个本地 file-preview 项已经映射到格式覆盖表。`
          : "还没有本地 file-preview 项，覆盖表只能显示支持矩阵，不能反映真实使用情况。",
      required_action:
        "继续通过报告页上传或导入文件，让覆盖报告反映真实投研资料结构。",
    },
    {
      id: "confirmation-workload",
      title: "确认动作负载",
      status:
        activeNeedsConfirmation.length > 0 ? "manual-confirmation" : "ready",
      evidence: `${activeNeedsConfirmation.length} 个正在使用的格式组需要外部资源、转换复核、数据库导入或元数据复核确认。`,
      required_action:
        "在批量导入、开放外部资源、AI 处理或云同步前，逐项导出并复核动作收据。",
    },
    {
      id: "html-report-boundary",
      title: "HTML 报告外部资源边界",
      status: activeHtml > 0 ? "manual-confirmation" : "ready",
      evidence:
        activeHtml > 0
          ? `${activeHtml} 个 HTML 报告走沙盒原生预览，外部图片、脚本、样式、字体和 frame 默认阻止。`
          : "当前没有 HTML 报告文件；HTML 能力仍可用于未来 AI 可视化报告。",
      required_action:
        "只有在明确确认远程资源风险后，才允许单个 HTML 预览切换外部资源。",
    },
    {
      id: "spreadsheet-database-import",
      title: "表格入库确认",
      status: activeSpreadsheet > 0 ? "manual-confirmation" : "ready",
      evidence:
        activeSpreadsheet > 0
          ? `${activeSpreadsheet} 个表格文件可以在确认后导入本地数据库。`
          : "当前没有待入库表格。",
      required_action:
        "导入前确认字段、行数、目标表名、回滚边界，并输入确认文本。",
    },
    {
      id: "converted-format-review",
      title: "转换格式复核",
      status: activeConverted.length > 0 ? "manual-confirmation" : "ready",
      evidence: `${activeConverted.length} 个正在使用的格式组依赖本地转换，可能丢失复杂布局、图表交互或样式。`,
      required_action:
        "转换为可编辑页面后先人工复核，再把结论连接到公司、会议、备忘录或数据库。",
    },
    {
      id: "legacy-office-gap",
      title: "旧版 Office 缺口",
      status: blockedLimited.length > 0 ? "blocked" : "ready",
      evidence: `${blockedLimited.length} 个格式组存在明确限制，例如旧版 .doc/.ppt 只能本地保存和下载。`,
      required_action:
        "优先要求转换为 .docx/.pptx，或后续接入安全的本地旧版 Office 转换器。",
    },
    {
      id: "unsupported-format-gap",
      title: "未知格式缺口",
      status: unsupportedActive.length > 0 ? "blocked" : "ready",
      evidence:
        unsupportedActive.length > 0
          ? `${unsupportedActive.length} 个实际使用的格式种类没有能力矩阵路线。`
          : "当前实际文件都能映射到已登记能力路线。",
      required_action:
        "为真实出现的未知格式新增明确本地预览、转换、元数据复核或仅下载路线。",
    },
  ];
}

function summarizeCoverage(
  rows: ReportFormatCoverageRow[],
  gaps: ReportFormatCoverageGap[]
) {
  const activeRows = rows.filter((row) => row.active_items > 0);

  return {
    capability_groups: rows.filter(
      (row) => row.coverage_status !== "unsupported-active"
    ).length,
    active_groups: activeRows.length,
    supported_unused_groups: rows.filter(
      (row) => row.coverage_status === "supported-unused"
    ).length,
    unsupported_active_groups: rows.filter(
      (row) => row.coverage_status === "unsupported-active"
    ).length,
    blocked_limited_groups: rows.filter(
      (row) => row.coverage_status === "blocked-limited"
    ).length,
    active_items: rows.reduce((total, row) => total + row.active_items, 0),
    active_native_groups: activeRows.filter((row) => row.support_level === "native")
      .length,
    active_converted_groups: activeRows.filter(
      (row) => row.support_level === "converted"
    ).length,
    active_metadata_groups: activeRows.filter(
      (row) => row.support_level === "metadata"
    ).length,
    active_confirmation_groups: activeRows.filter(
      (row) => row.requires_confirmation
    ).length,
    gap_count: gaps.length,
    manual_confirmation_gaps: gaps.filter(
      (gap) => gap.status === "manual-confirmation"
    ).length,
    blocked_gaps: gaps.filter((gap) => gap.status === "blocked").length,
  };
}

function countIntakeKinds(intake: ReportIntakeReport) {
  return intake.items.reduce((counts, item) => {
    counts.set(item.file_kind, (counts.get(item.file_kind) ?? 0) + 1);
    return counts;
  }, new Map<PageFileKind, number>());
}

function getCoverageStatus(
  capability: FilePreviewCapability,
  route: FilePreviewReadinessReport["routes"][number] | undefined,
  activeItems: number
): ReportFormatCoverageStatus {
  if (capability.limitation || route?.readiness_status === "blocked") {
    return "blocked-limited";
  }
  if (activeItems === 0) return "supported-unused";
  if (route?.requires_confirmation) return "active-needs-confirmation";
  return "active";
}

function getRecommendedAction(
  capability: FilePreviewCapability,
  activeItems: number
) {
  if (capability.limitation) {
    return "保留本地附件和下载入口；需要新版格式或安全转换器后再做可编辑导入。";
  }
  if (activeItems === 0) {
    return "保持能力登记，等真实文件出现后再进入 intake 和复核队列。";
  }
  if (capability.support_level === "native") {
    return "使用本地原生预览；如果涉及 HTML 外部资源，继续保持默认阻止。";
  }
  if (capability.support_level === "converted") {
    return "先本地转换预览，再复核是否导入为可编辑页面或数据库。";
  }
  if (capability.support_level === "metadata") {
    return "只查看元数据；确认来源和用途后再决定是否拆分或转成标准资产。";
  }
  return "保留本地下载入口，等待人工确认处理路线。";
}

function sortRows(a: ReportFormatCoverageRow, b: ReportFormatCoverageRow) {
  return (
    statusRank(a.coverage_status) - statusRank(b.coverage_status) ||
    b.active_items - a.active_items ||
    a.label.localeCompare(b.label)
  );
}

function statusRank(status: ReportFormatCoverageStatus) {
  const ranks: Record<ReportFormatCoverageStatus, number> = {
    "unsupported-active": 0,
    "active-needs-confirmation": 1,
    active: 2,
    "blocked-limited": 3,
    "supported-unused": 4,
  };
  return ranks[status];
}
