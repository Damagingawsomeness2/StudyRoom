import type { ReadingReport } from './study-types';

export function validatedReadingReport(value: unknown, readableLabels: string[]): ReadingReport | undefined {
  if (!value || typeof value !== 'object') return;
  const x = value as Record<string, unknown>;
  if (typeof x.totalUnits !== 'number' || !Number.isInteger(x.totalUnits) || x.totalUnits < readableLabels.length || x.totalUnits > 100000 || !Array.isArray(x.unreadable)) return;
  const seen = new Set(readableLabels), unreadable: ReadingReport['unreadable'] = [];
  for (const row of x.unreadable) {
    if (!row || typeof row.label !== 'string' || !row.label.trim() || row.label.length > 200 || typeof row.reason !== 'string' || row.reason.length > 500 || seen.has(row.label)) return;
    seen.add(row.label); unreadable.push({ label: row.label, reason: row.reason });
  }
  if (readableLabels.length + unreadable.length !== x.totalUnits) return;
  return { totalUnits: x.totalUnits, unreadable };
}
