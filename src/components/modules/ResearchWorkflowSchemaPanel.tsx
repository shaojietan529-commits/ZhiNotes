import {
  getResearchAssetKindLabel,
  getResearchWorkflowSpec,
  type ResearchAssetKind,
} from "@/lib/modules/researchWorkflow";

interface ResearchWorkflowSchemaPanelProps {
  kind: ResearchAssetKind;
  title?: string;
}

const SURFACE_LABELS: Record<string, string> = {
  page: "页面",
  database: "数据库",
  file: "文件",
  relation: "关联",
};

export default function ResearchWorkflowSchemaPanel({
  kind,
  title = "投研对象模型",
}: ResearchWorkflowSchemaPanelProps) {
  const spec = getResearchWorkflowSpec(kind);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {spec.label}模块使用统一投研结构：页面承载判断，数据库承载状态，
            关系字段把公司、报告、会议和组合连接起来。
          </p>
        </div>
        <span className="w-fit rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {spec.primary_database_preset}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            工作阶段
          </h3>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {spec.stages.map((stage) => (
              <article
                key={stage.id}
                className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {stage.title}
                  </h4>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {SURFACE_LABELS[stage.surface] ?? stage.surface}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {stage.detail}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <SchemaChips title="核心资产" items={spec.primary_assets} />
          <SchemaChips
            title="必须连接"
            items={spec.required_relation_kinds.map(getResearchAssetKindLabel)}
          />
          <SchemaChips title="关键字段" items={spec.key_tracker_fields} mono />
          <div className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              隐私边界
            </h3>
            <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {spec.privacy_boundary}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SchemaChips({
  title,
  items,
  mono,
}: {
  title: string;
  items: string[];
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
      <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>
      <div className="mt-2 flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className={`rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 ${
              mono ? "font-mono" : ""
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
