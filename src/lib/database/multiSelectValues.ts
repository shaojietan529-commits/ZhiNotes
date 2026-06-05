export function normalizeMultiSelectValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function toggleMultiSelectValue(value: unknown, option: string) {
  const selected = normalizeMultiSelectValue(value);
  return selected.includes(option)
    ? selected.filter((item) => item !== option)
    : [...selected, option];
}

export function stringifyMultiSelectValue(value: unknown) {
  return normalizeMultiSelectValue(value).join(", ");
}
