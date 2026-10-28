/**
 * Turns a collection's records into dashboard numbers. Pure functions: the page
 * loads the records, this decides what is worth showing.
 */

import type { FieldInfo, RecordData } from '../api';

const DAY = 86_400_000;
const MAX_BREAKDOWN_VALUES = 12;
const TIMELINE_DAYS = 14;

export interface NumberStat {
  field: string;
  sum: number;
  average: number;
  min: number;
  max: number;
}

export interface Breakdown {
  field: string;
  rows: Array<{ value: string; count: number }>;
}

export interface DashboardData {
  total: number;
  numbers: NumberStat[];
  breakdowns: Breakdown[];
  timeline: { field: string; days: Array<{ day: string; count: number }>; today: number } | null;
}

const isNumeric = (field: FieldInfo) => field.type === 'integer' || field.type === 'decimal';
const isDate = (field: FieldInfo) => field.type === 'datetime' || field.type === 'date';

// Fields that say nothing useful in a chart: ids, secrets, generated keys.
const skip = (field: FieldInfo) => field.masked || field.primaryKey || field.ui?.hidden === true;

/** The date field to chart over time: a "created" one when there is one. */
function pickDateField(fields: FieldInfo[]): FieldInfo | undefined {
  const dates = fields.filter((f) => isDate(f) && !f.masked);
  return dates.find((f) => /created|placed|ordered/i.test(f.name)) ?? dates[0];
}

export function buildDashboard(
  records: RecordData[],
  fields: FieldInfo[],
  now: Date = new Date(),
): DashboardData {
  const usable = fields.filter((f) => !skip(f));

  const numbers: NumberStat[] = [];
  for (const field of usable.filter(isNumeric)) {
    const values = records
      .map((r) => r[field.name])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (values.length === 0) continue;
    const sum = values.reduce((a, b) => a + b, 0);
    numbers.push({
      field: field.name,
      sum,
      average: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    });
  }

  // A text field with only a few different values is a category (a status, a
  // size): count each. Free text, where nearly every value differs, is not.
  const breakdowns: Breakdown[] = [];
  for (const field of usable.filter((f) => f.type === 'string')) {
    const counts = new Map<string, number>();
    let filled = 0;
    for (const record of records) {
      const value = record[field.name];
      if (typeof value !== 'string' || value === '') continue;
      filled += 1;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    // A category repeats; if every value is different it is free text or a name.
    if (counts.size < 2 || counts.size > MAX_BREAKDOWN_VALUES || counts.size === filled) continue;
    breakdowns.push({
      field: field.name,
      rows: [...counts]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
    });
  }

  let timeline: DashboardData['timeline'] = null;
  const dateField = pickDateField(fields);
  if (dateField) {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const days = Array.from({ length: TIMELINE_DAYS }, (_, i) => {
      const date = new Date(startOfToday.getTime() - (TIMELINE_DAYS - 1 - i) * DAY);
      return { day: date.toDateString(), count: 0 };
    });
    for (const record of records) {
      const raw = record[dateField.name];
      const time = typeof raw === 'string' || typeof raw === 'number' ? new Date(raw) : null;
      if (!time || Number.isNaN(time.getTime())) continue;
      const slot = days.find((d) => d.day === time.toDateString());
      if (slot) slot.count += 1;
    }
    timeline = { field: dateField.name, days, today: days[days.length - 1]?.count ?? 0 };
  }

  return { total: records.length, numbers, breakdowns, timeline };
}
