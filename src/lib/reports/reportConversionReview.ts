import {
  getFilePreviewCapabilityByKind,
  type FilePreviewSupportLevel,
} from "@/lib/files/filePreviewCapabilities";
import type { PageFileKind } from "@/lib/files/localStore";
import type { ReportIntakeReport } from "@/lib/reports/reportIntake";

export type ReportConversionReviewStatus =
  | "native-ready"
  | "review-needed"
  | "blocked";

export type ReportConversionRisk = "low" | "medium" | "high";

export interface ReportConversionReviewRoute {
  id: string;
  kind: PageFileKind;
  label: string;
  item_count: number;
  extensions: Array<{ extension: string; count: number }>;
  support_level: FilePreviewSupportLevel | "unknown";
  fidelity_status: ReportConversionReviewStatus;
  fidelity_risk: ReportConversionRisk;
  legacy_items: number;
  route_summary: string;
  likely_loss: string[];
  manual_checklist: string[];
  recommended_action: string;
  privacy_boundary: string;
}

export interface ReportConversionReviewGate {
  id:
    | "native-render-fit"
    | "office-conversion-fidelity"
    | "presentation-layout-gap"
    | "spreadsheet-formula-chart-review"
    | "legacy-office-block"
    | "cloud-ai-boundary";
  title: string;
  status: ReportConversionReviewStatus;
  evidence: string;
  required_action: string;
}

export interface ReportConversionReviewReport {
  format: "zhinote-report-conversion-review";
  format_version: 1;
  report_status: "local-conversion-review-only";
  review_verdict: "usable-after-local-review";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_report_intake_metadata: true;
    reads_capability_metadata: true;
    reads_file_extensions: true;
    includes_file_names: false;
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
    intake_items: number;
    active_routes: number;
    native_ready_items: number;
    review_needed_items: number;
    blocked_items: number;
    converted_items: number;
    metadata_items: number;
    office_items: number;
    presentation_items: number;
    legacy_office_items: number;
    high_risk_items: number;
  };
  gates: ReportConversionReviewGate[];
  routes: ReportConversionReviewRoute[];
}

interface ConversionPolicy {
  status: ReportConversionReviewStatus;
  risk: ReportConversionRisk;
  routeSummary: string;
  likelyLoss: string[];
  manualChecklist: string[];
  recommendedAction: string;
}

export function buildReportConversionReviewReport(
  intake: ReportIntakeReport
): ReportConversionReviewReport {
  const routes = buildConversionRoutes(intake);
  const gates = buildConversionGates(routes, intake.summary.intake_items);

  return {
    format: "zhinote-report-conversion-review",
    format_version: 1,
    report_status: "local-conversion-review-only",
    review_verdict: "usable-after-local-review",
    privacy_note:
      "由报告 intake 元数据和文件预览能力元数据在本地生成。它只读取文件类型、扩展名、数量、支持级别和转换路线；不包含文件名、不读取文件字节、不读取转换后的文件文本、不读取页面正文、不加载外部资源、不写入工作区、不连接云服务、不上传数据、也不启用 AI。",
    boundary: {
      local_report_only: true,
      reads_report_intake_metadata: true,
      reads_capability_metadata: true,
      reads_file_extensions: true,
      includes_file_names: false,
      reads_file_bytes: false,
      reads_file_text: false,
      reads_page_body_text: false,
      writes_workspace_data: false,
      loads_external_resources: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: summarizeConversion(routes, intake.summary.intake_items),
    gates,
    routes,
  };
}

function buildConversionRoutes(
  intake: ReportIntakeReport
): ReportConversionReviewRoute[] {
  const groups = intake.items.reduce<Record<string, typeof intake.items>>(
    (result, item) => {
      result[item.file_kind] = [...(result[item.file_kind] ?? []), item];
      return result;
    },
    {}
  );

  return Object.entries(groups)
    .map(([kind, items]) => {
      const fileKind = kind as PageFileKind;
      const capability = getFilePreviewCapabilityByKind(fileKind);
      const extensions = summarizeExtensions(items.map((item) => item.file_name));
      const legacyItems = items.filter((item) =>
        isLegacyOfficeExtension(getFileExtension(item.file_name))
      ).length;
      const policy = getConversionPolicy({
        kind: fileKind,
        supportLevel: capability?.support_level ?? "unknown",
        legacyItems,
      });

      return {
        id: `conversion-review-${fileKind}`,
        kind: fileKind,
        label:
          capability?.label ??
          fileKind.charAt(0).toUpperCase() + fileKind.slice(1),
        item_count: items.length,
        extensions,
        support_level: capability?.support_level ?? "unknown",
        fidelity_status: policy.status,
        fidelity_risk: policy.risk,
        legacy_items: legacyItems,
        route_summary: policy.routeSummary,
        likely_loss: policy.likelyLoss,
        manual_checklist: policy.manualChecklist,
        recommended_action: policy.recommendedAction,
        privacy_boundary:
          capability?.privacy_boundary ??
          "未知格式默认只做本地留存和下载，不读取正文、不执行、不上传。",
      } satisfies ReportConversionReviewRoute;
    })
    .sort(sortRoutes);
}

function buildConversionGates(
  routes: ReportConversionReviewRoute[],
  intakeItems: number
): ReportConversionReviewGate[] {
  const nativeItems = sumItems(
    routes.filter((route) => route.fidelity_status === "native-ready")
  );
  const officeRoutes = routes.filter((route) =>
    ["word", "presentation", "spreadsheet"].includes(route.kind)
  );
  const officeItems = sumItems(officeRoutes);
  const presentationItems = sumItems(
    routes.filter((route) => route.kind === "presentation")
  );
  const spreadsheetItems = sumItems(
    routes.filter((route) => route.kind === "spreadsheet")
  );
  const legacyItems = routes.reduce(
    (total, route) => total + route.legacy_items,
    0
  );

  return [
    gate(
      "native-render-fit",
      "原生展示适配",
      intakeItems === 0 || nativeItems > 0 ? "native-ready" : "review-needed",
      intakeItems === 0
        ? "还没有 intake 文件，暂时只显示格式路线。"
        : `${nativeItems} 个文件项走原生或近原生展示路线，适合保留原件阅读。`,
      "HTML/PDF/媒体类文件优先保留原生预览；HTML 外部资源仍默认阻止。"
    ),
    gate(
      "office-conversion-fidelity",
      "Office 转换复核",
      officeItems > 0 ? "review-needed" : "native-ready",
      `${officeItems} 个 Office/表格/演示文稿文件项需要区分原生展示和本地转换。`,
      "Word、PPT 和 Excel 转换后先人工复核布局、图表、批注、公式和关键结论。"
    ),
    gate(
      "presentation-layout-gap",
      "PPT 版式缺口",
      presentationItems > 0 ? "review-needed" : "native-ready",
      presentationItems > 0
        ? `${presentationItems} 个演示文稿文件项当前走文本级幻灯片大纲或 ODP 本地转换。`
        : "当前没有演示文稿 intake 项。",
      "PPTX/ODP 导入后复核幻灯片顺序、图表、图片、注释和原始版式；旧版 .ppt 先转 .pptx。"
    ),
    gate(
      "spreadsheet-formula-chart-review",
      "表格公式/图表复核",
      spreadsheetItems > 0 ? "review-needed" : "native-ready",
      spreadsheetItems > 0
        ? `${spreadsheetItems} 个表格文件项可能包含公式、图表、多 sheet 或隐藏列。`
        : "当前没有表格 intake 项。",
      "导入数据库前确认字段、行数、公式值、图表来源和回滚方案。"
    ),
    gate(
      "legacy-office-block",
      "旧版 Office 阻塞",
      legacyItems > 0 ? "blocked" : "native-ready",
      legacyItems > 0
        ? `${legacyItems} 个旧版 .doc/.ppt 文件项只能本地保存和下载。`
        : "当前未识别到旧版 .doc/.ppt 文件项。",
      "优先把旧版 Office 转为 .docx/.pptx，或后续接入明确的安全本地转换器。"
    ),
    gate(
      "cloud-ai-boundary",
      "云端和 AI 边界",
      "blocked",
      "转换质量复核不读取文件内容；AI 总结、云同步和外部资源加载仍是独立高风险动作。",
      "在发送内容预览、权限检查、审计事件和用户确认齐备前，不把文件内容发送到 AI 或云服务。"
    ),
  ];
}

function summarizeConversion(
  routes: ReportConversionReviewRoute[],
  intakeItems: number
): ReportConversionReviewReport["summary"] {
  return {
    intake_items: intakeItems,
    active_routes: routes.length,
    native_ready_items: sumItems(
      routes.filter((route) => route.fidelity_status === "native-ready")
    ),
    review_needed_items: sumItems(
      routes.filter((route) => route.fidelity_status === "review-needed")
    ),
    blocked_items: sumItems(
      routes.filter((route) => route.fidelity_status === "blocked")
    ),
    converted_items: sumItems(
      routes.filter((route) => route.support_level === "converted")
    ),
    metadata_items: sumItems(
      routes.filter((route) => route.support_level === "metadata")
    ),
    office_items: sumItems(
      routes.filter((route) =>
        ["word", "presentation", "spreadsheet"].includes(route.kind)
      )
    ),
    presentation_items: sumItems(
      routes.filter((route) => route.kind === "presentation")
    ),
    legacy_office_items: routes.reduce(
      (total, route) => total + route.legacy_items,
      0
    ),
    high_risk_items: sumItems(
      routes.filter((route) => route.fidelity_risk === "high")
    ),
  };
}

function getConversionPolicy(input: {
  kind: PageFileKind;
  supportLevel: FilePreviewSupportLevel | "unknown";
  legacyItems: number;
}): ConversionPolicy {
  if (input.legacyItems > 0) {
    return {
      status: "blocked" as const,
      risk: "high" as const,
      routeSummary:
        "包含旧版 Office 文件；当前不能安全转换为可编辑页面，只能本地留存和下载。",
      likelyLoss: ["无法本地解析旧版二进制结构", "不能保证版式、图表或批注完整"],
      manualChecklist: ["先转成 .docx/.pptx", "保留原件", "转换后再复核内容"],
      recommendedAction:
        "把旧版 Office 文件转成新版格式，再回到报告页做本地预览或可编辑导入。",
    };
  }

  if (input.kind === "presentation") {
    return {
      status: "review-needed" as const,
      risk: "high" as const,
      routeSummary:
        "PPTX/ODP 可以本地转换为幻灯片大纲，但不是原始幻灯片画布级渲染。",
      likelyLoss: ["复杂版式", "图片和图表语义", "动画", "演讲者备注", "嵌入对象"],
      manualChecklist: [
        "核对幻灯片顺序",
        "核对图表和图片结论",
        "把关键结论写回报告页",
      ],
      recommendedAction:
        "先保留原始 PPT/PPTX 附件，再把转换后的文本作为可编辑摘要，并手动复核图表和版式。",
    };
  }

  if (input.kind === "spreadsheet") {
    return {
      status: "review-needed" as const,
      risk: "high" as const,
      routeSummary:
        "表格可本地预览并可确认后入库，但公式、图表和多 sheet 结构需要人工复核。",
      likelyLoss: ["公式逻辑", "图表", "隐藏行列", "跨 sheet 引用", "格式化语义"],
      manualChecklist: ["确认字段", "确认行数", "确认公式值", "确认导入回滚方案"],
      recommendedAction:
        "把表格先作为本地预览复核，只有字段和行数确认后再执行数据库导入。",
    };
  }

  if (input.kind === "word") {
    return {
      status: "review-needed" as const,
      risk: "medium" as const,
      routeSummary:
        "DOCX/ODT 可以本地转换为 HTML，但复杂样式、批注和嵌入对象需要复核。",
      likelyLoss: ["复杂排版", "批注", "页眉页脚", "嵌入对象", "部分表格样式"],
      manualChecklist: ["复核标题层级", "复核表格", "复核批注/脚注", "补研究关联"],
      recommendedAction:
        "导入为可编辑页面后，先人工复核结构，再提炼结论和关联公司/会议。",
    };
  }

  if (input.kind === "notebook") {
    return {
      status: "review-needed" as const,
      risk: "high" as const,
      routeSummary:
        "Notebook 只解析 markdown/code 单元格和常见文本输出，不执行代码。",
      likelyLoss: ["交互输出", "图表上下文", "执行顺序语义", "外部数据依赖"],
      manualChecklist: ["不要执行代码", "复核输出来源", "标记关键图表", "补数据来源"],
      recommendedAction:
        "把 notebook 当作本地研究附件和可编辑摘要来源，不把代码执行结果当作已验证事实。",
    };
  }

  if (input.supportLevel === "converted") {
    return {
      status: "review-needed" as const,
      risk: input.kind === "markdown" || input.kind === "text" ? "low" : "medium",
      routeSummary: "这个格式走本地转换路线，导入后需要快速复核格式。",
      likelyLoss: ["部分样式", "嵌入内容", "源文件特定交互"],
      manualChecklist: ["复核标题", "复核列表/表格", "补关联研究"],
      recommendedAction:
        "转换为可编辑页面后，先复核结构，再把结论挂回公司、会议或备忘录。",
    };
  }

  if (input.supportLevel === "metadata" || input.kind === "archive") {
    return {
      status: "review-needed" as const,
      risk: "medium" as const,
      routeSummary: "这个格式只做元数据复核，不自动解包或写入工作区。",
      likelyLoss: ["压缩包内部上下文", "目录外的说明文件", "拆分资产关系"],
      manualChecklist: ["确认来源", "确认是否需要拆分", "保留原件"],
      recommendedAction:
        "先用元数据判断用途，再决定是否拆成标准报告、数据库或附件。",
    };
  }

  if (input.supportLevel === "unknown") {
    return {
      status: "blocked" as const,
      risk: "high" as const,
      routeSummary: "这个格式没有能力矩阵路线。",
      likelyLoss: ["无法预估格式损失", "无法确认安全转换边界"],
      manualChecklist: ["保留下载", "确认来源", "新增明确格式路线"],
      recommendedAction: "先只保留本地附件，后续补能力矩阵和验证脚本。",
    };
  }

  return {
    status: "native-ready" as const,
    risk: "low" as const,
    routeSummary: "这个格式可以走本地原生或近原生展示路线。",
    likelyLoss:
      input.kind === "html"
        ? ["外部资源默认阻止", "脚本交互不作为可信研究输出"]
        : [],
    manualChecklist:
      input.kind === "html"
        ? ["确认外部资源保持关闭", "把核心结论写入报告页"]
        : ["保留原件", "补公司/会议/备忘录关联"],
    recommendedAction:
      "保留原件和页面预览，把关键投研结论写入 ZhiNotes page。",
  };
}

function summarizeExtensions(fileNames: string[]) {
  const counts = fileNames.reduce<Record<string, number>>((result, fileName) => {
    const extension = getFileExtension(fileName) || "未知";
    result[extension] = (result[extension] ?? 0) + 1;
    return result;
  }, {});

  return Object.entries(counts)
    .map(([extension, count]) => ({ extension, count }))
    .sort((left, right) => right.count - left.count || left.extension.localeCompare(right.extension));
}

function getFileExtension(fileName: string) {
  const lowerName = fileName.toLowerCase().trim();
  const match = lowerName.match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function isLegacyOfficeExtension(extension: string) {
  return extension === ".doc" || extension === ".ppt";
}

function sumItems(routes: ReportConversionReviewRoute[]) {
  return routes.reduce((total, route) => total + route.item_count, 0);
}

function gate(
  id: ReportConversionReviewGate["id"],
  title: string,
  status: ReportConversionReviewStatus,
  evidence: string,
  requiredAction: string
): ReportConversionReviewGate {
  return {
    id,
    title,
    status,
    evidence,
    required_action: requiredAction,
  };
}

function sortRoutes(
  left: ReportConversionReviewRoute,
  right: ReportConversionReviewRoute
) {
  return (
    statusRank(left.fidelity_status) - statusRank(right.fidelity_status) ||
    riskRank(left.fidelity_risk) - riskRank(right.fidelity_risk) ||
    right.item_count - left.item_count ||
    left.label.localeCompare(right.label)
  );
}

function statusRank(status: ReportConversionReviewStatus) {
  const ranks: Record<ReportConversionReviewStatus, number> = {
    blocked: 0,
    "review-needed": 1,
    "native-ready": 2,
  };
  return ranks[status];
}

function riskRank(risk: ReportConversionRisk) {
  const ranks: Record<ReportConversionRisk, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return ranks[risk];
}
