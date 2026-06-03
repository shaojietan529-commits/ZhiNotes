export type AiWorkflowId = "summary" | "qa" | "report" | "compare" | "framework";

export interface AiWorkflowSpec {
  id: AiWorkflowId;
  title: string;
  detail: string;
  output: string;
  prompt_sections: string[];
  required_context: string[];
  privacy_boundary: string;
}

export const AI_WORKFLOWS: AiWorkflowSpec[] = [
  {
    id: "summary",
    title: "研究总结",
    detail: "把选中的笔记、报告和会议上下文压缩成可读的投研摘要。",
    output: "摘要 brief",
    prompt_sections: ["目标", "已选本地上下文", "输出结构", "引用要求"],
    required_context: ["明确选择页面", "确认是否包含文件内容", "确认输出用途"],
    privacy_boundary: "默认不包含页面正文或文件 bytes；发送前必须预览最终 payload。",
  },
  {
    id: "qa",
    title: "研究问答",
    detail: "围绕一个明确问题，在显式选择的本地上下文中寻找答案。",
    output: "带本地来源说明的回答",
    prompt_sections: ["问题", "已选本地上下文", "回答边界", "不确定性"],
    required_context: ["明确研究问题", "选择相关页面", "确认引用方式"],
    privacy_boundary: "问题文本和页面正文都需要在最终 payload 里单独确认。",
  },
  {
    id: "report",
    title: "报告草稿",
    detail: "从选中材料生成 memo、报告或业绩复盘的结构化初稿。",
    output: "报告结构草稿",
    prompt_sections: ["报告目标", "受众", "已选本地上下文", "章节结构", "输出格式"],
    required_context: ["明确报告类型", "选择相关页面", "确认是否允许引用文件内容"],
    privacy_boundary: "报告生成属于高风险外发场景；必须确认 provider、retention 和最终 payload。",
  },
  {
    id: "compare",
    title: "文件/文档对比",
    detail: "准备报告、笔记或文件之间的差异、变化和投资含义对比。",
    output: "差异与变化清单",
    prompt_sections: ["对比对象", "比较维度", "已选本地上下文", "输出粒度"],
    required_context: ["选择至少两个对象", "确认是否包含文件内容", "明确比较维度"],
    privacy_boundary: "文件 bytes 默认排除；每种文件类型进入 AI payload 前都需要单独确认。",
  },
  {
    id: "framework",
    title: "研究框架",
    detail: "把一个主题转成可复用的投资研究 checklist 或模板。",
    output: "研究框架模板",
    prompt_sections: ["研究主题", "适用场景", "输出模块", "检查清单"],
    required_context: ["明确研究主题", "选择可参考页面", "确认模板输出用途"],
    privacy_boundary: "可以先只用主题和页面标题生成框架；正文进入 payload 前仍需确认。",
  },
];

export function getAiWorkflowSpec(id: AiWorkflowId) {
  return AI_WORKFLOWS.find((workflow) => workflow.id === id) ?? AI_WORKFLOWS[0];
}
