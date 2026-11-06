export function thesisDraftKey(companyId: string): string {
  return `zhinote:company-research-draft:v1:${companyId}`;
}

export function readThesisDraft(raw: string | null, companyId: string): string {
  if (!raw) return "";
  try {
    const value = JSON.parse(raw);
    return value?.version === 1 && value.companyId === companyId && typeof value.thesis === "string"
      ? value.thesis.slice(0, 16000) : "";
  } catch { return ""; }
}
