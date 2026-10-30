import type { Filters } from "../lib/types";

const DAY = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The period of identical length that ends the day before the selected "from" date. Only available when BOTH
 * dates are chosen (otherwise there is no defined period to compare against, and nothing is guessed).
 */
export function previousPeriod(
  filters: Filters,
): { from: string; to: string; days: number } | undefined {
  const { from, to } = filters;
  if (!from || !to || !ISO_DAY.test(from) || !ISO_DAY.test(to)) return undefined;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return undefined;
  const days = Math.round((end - start) / DAY) + 1;
  const prevEnd = start - DAY;
  return { from: toIso(prevEnd - (days - 1) * DAY), to: toIso(prevEnd), days };
}

/** "23-Oct-2026" from a YYYY-MM-DD filter value (calendar date, no time-zone conversion). */
export function formatFilterDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(/ /g, "-");
}

export function describePeriod(filters: Filters): string {
  const { from, to } = filters;
  if (from && to) return `${formatFilterDate(from)} to ${formatFilterDate(to)}`;
  if (from) return `From ${formatFilterDate(from)}`;
  if (to) return `Up to ${formatFilterDate(to)}`;
  return "All recorded activity";
}

/** Signed change between two counts. Percent is omitted when the earlier value is zero. */
export function change(current: number, previous: number) {
  const diff = current - previous;
  return {
    diff,
    percent: previous === 0 ? undefined : (diff / previous) * 100,
    label: diff === 0 ? "No change" : `${diff > 0 ? "+" : "−"}${Math.abs(diff).toLocaleString()}`,
  };
}
