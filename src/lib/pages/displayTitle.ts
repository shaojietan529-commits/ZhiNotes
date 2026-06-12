export function displayPageTitle(
  title: string | null | undefined,
  fallback = "新页面"
) {
  const normalized = title?.trim();
  if (!normalized || normalized.toLowerCase() === "untitled") {
    return fallback;
  }
  return normalized;
}
