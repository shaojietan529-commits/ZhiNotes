import { getDatabaseNumberFormat } from "@/lib/database/fields";
import type { DatabaseField } from "@/lib/utils/types";

export function formatDatabaseNumberValue(
  value: unknown,
  field: Pick<DatabaseField, "config">
) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return "";

  switch (getDatabaseNumberFormat(field)) {
    case "percent":
      return `${formatCompactNumber(number * 100)}%`;
    case "currency_usd":
      return formatCurrency(number, "USD");
    case "currency_cny":
      return formatCurrency(number, "CNY");
    case "multiple":
      return `${formatCompactNumber(number)}x`;
    case "plain":
    default:
      return formatCompactNumber(number);
  }
}

function formatCurrency(value: number, currency: "USD" | "CNY") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}
