import type { DatabaseField } from "@/lib/utils/types";

export const RESEARCH_PROJECT_PAGE_FIELD_ALIASES = [
  "Project page",
  "项目页",
  "项目页面",
  "投研项目页",
];

export function isResearchProjectPageRelationField(
  field: Pick<DatabaseField, "name" | "field_type">
) {
  return (
    field.field_type === "relation" &&
    matchesResearchProjectFieldAlias(
      field.name,
      RESEARCH_PROJECT_PAGE_FIELD_ALIASES
    )
  );
}

export function matchesResearchProjectFieldAlias(
  fieldName: string,
  aliases: string[]
) {
  const normalizedName = normalizeResearchProjectFieldName(fieldName);
  return aliases.some((alias) => {
    const normalizedAlias = normalizeResearchProjectFieldName(alias);
    return (
      normalizedName === normalizedAlias || normalizedName.includes(normalizedAlias)
    );
  });
}

export function normalizeResearchProjectFieldName(value: string) {
  return value.toLowerCase().replace(/[-_\s]+/g, " ").trim();
}
