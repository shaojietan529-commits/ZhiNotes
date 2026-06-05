import type { ModuleStarter } from "@/lib/modules/registry";

export type ResearchTemplateStarterGroup =
  | "notes"
  | "company"
  | "report"
  | "meeting"
  | "portfolio";

export interface ResearchTemplateQuickAction {
  id: string;
  title: string;
  description: string;
  category: "Page";
  aliases: string[];
  starter: Extract<ModuleStarter, { type: "page" }>;
}

type PageStarter = Extract<ModuleStarter, { type: "page" }>;

function pageStarter(
  label: string,
  title: string,
  templateTitle: string,
  icon: string
): PageStarter {
  return {
    type: "page",
    label,
    title,
    templateTitle,
    icon,
  };
}

const investmentMemoStarter = pageStarter(
  "新建投资备忘录",
  "未命名投资备忘录",
  "投资备忘录",
  "MEMO"
);
const companyResearchStarter = pageStarter(
  "新建公司研究页",
  "未命名公司研究",
  "公司研究",
  "CO"
);
const meetingNoteStarter = pageStarter(
  "新建会议纪要",
  "未命名会议纪要",
  "会议纪要",
  "MTG"
);
const reportNoteStarter = pageStarter(
  "新建报告笔记",
  "未命名研究报告",
  "研究报告",
  "RPT"
);
const reportIntakeStarter = pageStarter(
  "新建报告摄取",
  "未命名报告摄取清单",
  "报告摄取清单",
  "FILE"
);
const industryComparisonStarter = pageStarter(
  "新建行业对比",
  "未命名行业对比",
  "行业对比",
  "PEER"
);
const expertCallStarter = pageStarter(
  "新建专家电话",
  "未命名专家电话纪要",
  "专家电话纪要",
  "EXP"
);
const researchDecisionLogStarter = pageStarter(
  "新建决策日志",
  "未命名投研决策日志",
  "投研决策日志",
  "DEC"
);
const earningsReviewStarter = pageStarter(
  "新建业绩复盘",
  "未命名业绩复盘",
  "业绩复盘",
  "Q"
);
const valuationAssumptionsStarter = pageStarter(
  "新建估值假设",
  "未命名估值假设",
  "估值假设",
  "VAL"
);
const keyMetricsStarter = pageStarter(
  "新建关键指标",
  "未命名关键指标看板",
  "关键指标看板",
  "KPI"
);
const meetingTranscriptStarter = pageStarter(
  "新建转录稿",
  "未命名会议转录稿",
  "会议转录稿",
  "TRN"
);
const meetingActionItemsStarter = pageStarter(
  "新建行动项",
  "未命名会议行动项",
  "会议行动项",
  "ACT"
);
const managementMeetingStarter = pageStarter(
  "新建管理层会议",
  "未命名管理层会议纪要",
  "管理层会议纪要",
  "MGMT"
);
const positionMemoStarter = pageStarter(
  "新建持仓备忘录",
  "未命名持仓备忘录",
  "持仓备忘录",
  "PF"
);
const watchlistStarter = pageStarter(
  "新建观察名单",
  "未命名观察名单",
  "观察名单",
  "WL"
);
const catalystRiskReviewStarter = pageStarter(
  "新建催化剂复盘",
  "未命名催化剂与风险复盘",
  "催化剂与风险复盘",
  "CAT"
);

export const RESEARCH_TEMPLATE_STARTERS = {
  notes: [
    { ...investmentMemoStarter, label: "投资备忘录" },
    { ...companyResearchStarter, label: "公司研究页" },
    { ...meetingNoteStarter, label: "会议纪要" },
    { ...reportNoteStarter, label: "研究报告" },
    { ...reportIntakeStarter, label: "报告摄取" },
    { ...industryComparisonStarter, label: "行业对比" },
    { ...expertCallStarter, label: "专家电话" },
    { ...researchDecisionLogStarter, label: "决策日志" },
  ],
  company: [
    companyResearchStarter,
    investmentMemoStarter,
    earningsReviewStarter,
    valuationAssumptionsStarter,
    keyMetricsStarter,
    industryComparisonStarter,
    researchDecisionLogStarter,
  ],
  report: [reportNoteStarter, reportIntakeStarter],
  meeting: [
    meetingNoteStarter,
    meetingTranscriptStarter,
    meetingActionItemsStarter,
    expertCallStarter,
    managementMeetingStarter,
  ],
  portfolio: [positionMemoStarter, watchlistStarter, catalystRiskReviewStarter],
} satisfies Record<ResearchTemplateStarterGroup, PageStarter[]>;

export function getResearchTemplateStarters(
  group: ResearchTemplateStarterGroup
) {
  return RESEARCH_TEMPLATE_STARTERS[group];
}

export const RESEARCH_TEMPLATE_QUICK_ACTIONS: ResearchTemplateQuickAction[] = [
  quickAction(
    "new-company-profile",
    "新建公司研究页",
    "创建一个本地公司研究页面",
    companyResearchStarter,
    ["company", "profile", "coverage", "deep dive", "公司", "研究"]
  ),
  quickAction(
    "new-investment-memo",
    "新建投资备忘录",
    "创建一个本地投资备忘录页面",
    investmentMemoStarter,
    ["investment", "memo", "thesis", "stock", "投资", "备忘录"]
  ),
  quickAction(
    "new-earnings-review",
    "新建业绩复盘",
    "创建一个本地业绩复盘页面",
    earningsReviewStarter,
    ["earnings", "quarter", "results", "call", "业绩", "复盘"]
  ),
  quickAction(
    "new-industry-comparison",
    "新建行业对比",
    "创建一个本地行业与同业对比页面",
    industryComparisonStarter,
    ["industry", "peers", "comparison", "sector", "行业", "同业", "对比"]
  ),
  quickAction(
    "new-valuation-assumptions",
    "新建估值假设",
    "创建一个本地估值假设页面",
    valuationAssumptionsStarter,
    ["valuation", "assumptions", "target price", "scenario", "估值", "目标价", "情景"]
  ),
  quickAction(
    "new-key-metrics",
    "新建关键指标",
    "创建一个本地 KPI 和单位经济看板页面",
    keyMetricsStarter,
    ["metrics", "kpi", "dashboard", "unit economics", "关键指标", "指标", "单位经济"]
  ),
  quickAction(
    "new-research-decision-log",
    "新建投研决策日志",
    "创建一个本地投研决策复盘页面",
    researchDecisionLogStarter,
    ["decision", "decision log", "ic", "committee", "决策", "投委会", "复盘"]
  ),
  quickAction(
    "new-position-memo",
    "新建持仓备忘录",
    "创建一个本地持仓备忘录页面",
    positionMemoStarter,
    ["portfolio", "position", "memo", "sizing", "thesis", "持仓", "备忘录"]
  ),
  quickAction(
    "new-watchlist-note",
    "新建观察名单",
    "创建一个本地观察名单或想法队列页面",
    watchlistStarter,
    ["watchlist", "idea", "pipeline", "观察名单", "想法", "研究队列"]
  ),
  quickAction(
    "new-catalyst-risk-review",
    "新建催化剂复盘",
    "创建一个本地催化剂和风险复盘页面",
    catalystRiskReviewStarter,
    ["catalyst", "risk review", "risk notes", "review", "催化剂", "风险复盘", "风险笔记"]
  ),
  quickAction(
    "new-meeting-note",
    "新建会议纪要",
    "创建一个本地会议纪要页面",
    meetingNoteStarter,
    ["meeting", "notes", "call", "transcript", "action items", "会议", "纪要"]
  ),
  quickAction(
    "new-meeting-transcript",
    "新建会议转录稿",
    "创建一个本地会议 transcript 页面",
    meetingTranscriptStarter,
    ["transcript", "recording", "raw notes", "转录稿", "会议转录", "录音"]
  ),
  quickAction(
    "new-meeting-action-items",
    "新建会议行动项",
    "创建一个本地会议 follow-up 和开放问题页面",
    meetingActionItemsStarter,
    ["action items", "follow up", "todo", "open questions", "行动项", "开放问题", "待办"]
  ),
  quickAction(
    "new-expert-call-note",
    "新建专家电话纪要",
    "创建一个本地专家访谈或渠道调研页面",
    expertCallStarter,
    ["expert", "expert call", "interview", "channel check", "专家", "访谈", "渠道调研"]
  ),
  quickAction(
    "new-management-meeting-note",
    "新建管理层会议纪要",
    "创建一个本地管理层会议或 NDR 页面",
    managementMeetingStarter,
    ["management", "management meeting", "ndr", "investor meeting", "管理层", "路演"]
  ),
  quickAction(
    "new-report-note",
    "新建报告笔记",
    "创建一个本地研究报告页面",
    reportNoteStarter,
    ["report", "research report", "html report", "pdf", "file note", "报告", "笔记"]
  ),
  quickAction(
    "new-report-intake-checklist",
    "新建报告摄取清单",
    "创建一个本地报告格式、预览和关联复核页面",
    reportIntakeStarter,
    [
      "report intake",
      "file intake",
      "html report",
      "markdown",
      "pdf",
      "excel",
      "word",
      "报告摄取",
      "格式复核",
    ]
  ),
];

function quickAction(
  id: string,
  title: string,
  description: string,
  starter: PageStarter,
  aliases: string[]
): ResearchTemplateQuickAction {
  return {
    id,
    title,
    description,
    category: "Page",
    aliases,
    starter,
  };
}
