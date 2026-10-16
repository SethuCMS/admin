/** Small helpers the field controls share. */
import type { FieldInfo } from '../../api';

/**
 * Helper text under a field: why it is locked, or its validation rules in
 * words.
 */
export function hintFor(field: FieldInfo): string | null {
  if (field.masked) {
    return 'Hidden from your role.';
  }
  if (!field.editable) {
    return field.generated ? 'Created by the database.' : 'Read-only.';
  }
  const rules = field.validation;
  if (!rules) {
    return null;
  }
  const parts: string[] = [];
  if (rules.maxLength) {
    parts.push(`up to ${rules.maxLength} characters`);
  }
  if (rules.minLength) {
    parts.push(`at least ${rules.minLength} characters`);
  }
  if (rules.min !== undefined && rules.max !== undefined) {
    parts.push(`${rules.min} to ${rules.max}`);
  } else if (rules.min !== undefined) {
    parts.push(`at least ${rules.min}`);
  } else if (rules.max !== undefined) {
    parts.push(`at most ${rules.max}`);
  }
  if (rules.pattern) {
    parts.push(`must match ${rules.pattern}`);
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

/** Show null or undefined as an empty box. */
export const asText = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : value === null || value === undefined
      ? ''
      : String(value);

/**
 * Map the chosen text back to the original option so numbers stay numbers.
 */
export function parseEnum(field: FieldInfo, raw: string): unknown {
  if (raw === '') {
    return null;
  }
  return (
    field.validation?.enum?.find((option) => String(option) === raw) ?? raw
  );
}

/**
 * `datetime-local` wants "2026-10-08T14:30" in local time; the database wants
 * an ISO string.
 */
export function toLocalInput(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convert a local date-time back to an ISO (UTC) string, or null. */
export function fromLocalInput(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
