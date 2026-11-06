export type ResearchSource = {
  id: string;
  kind: "public" | "notion" | "zhinote";
  title: string;
  url: string;
  date: string | null;
  dateKind: "published" | "modified" | "unknown";
};
export type ResearchPoint = {
  text: string;
  category: "alpha" | "industry" | "macro";
  basis: "fact" | "inference" | "hypothesis";
  sourceIds: string[];
};
export type ResearchResult = {
  companyId: string;
  generatedAt: string;
  bull: ResearchPoint[];
  bear: ResearchPoint[];
  sources: ResearchSource[];
  warnings: string[];
};
export type ResearchJob = {
  id: string;
  companyId: string;
  status: "running" | "complete" | "failed";
  startedAt: string;
  deadline: number;
  finishedAt?: string;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  searches: number;
  estimatedUsd?: number;
};
export type ResearchScope = {
  companyId: string;
  name: string;
  ticker: string;
  exchange: string;
  zhinotePages: number;
  notionPages: number;
  monthlyBudgetUsd: number;
  reservationUsd: number;
  model: string;
  blockers: string[];
};
export type ResearchSnapshot = { scope: ResearchScope; job: ResearchJob | null; result: ResearchResult | null };
export type ResearchPreview = {
  id: string;
  digest: string;
  expiresAt: number;
  outbound: string;
  warnings: string[];
};
