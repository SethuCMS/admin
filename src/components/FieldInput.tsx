/**
 * Form control for a single record field, chosen by field type.
 */

import { useEffect, useId, useState } from 'react';
import { gateway, type FieldInfo, type RecordData } from '../api';

/** Props for one editable field. */
interface FieldInputProps {
  connectionId: string;
  field: FieldInfo;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
  error?: string | undefined;
}

/** One form control for one field, chosen by the field's type. */
export function FieldInput({
  connectionId,
  field,
  value,
  onChange,
  disabled,
  error,
}: FieldInputProps) {
  const id = useId();
  // Masked, read-only and form-disabled fields all behave the same: shown but
  // not editable.
  const locked = disabled || !field.editable || field.masked;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // Links the control to its hint and error text for screen readers.
  const describedBy =
    [error ? errorId : null, hintFor(field) ? hintId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const common = {
    id,
    disabled: locked,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  } as const;

  let control;
  if (field.masked) {
    // Masked values never reach the browser, so show a placeholder.
    control = <input {...common} className="input" value="••••••••" readOnly />;
  } else if (field.validation?.enum) {
    control = (
      <select
        {...common}
        className="input"
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(event) => onChange(parseEnum(field, event.target.value))}
      >
        <option value="">{field.required ? 'Choose…' : 'None'}</option>
        {field.validation.enum.map((option) => (
          <option key={String(option)} value={String(option)}>
            {String(option)}
          </option>
        ))}
      </select>
    );
  } else {
    switch (field.type) {
      case 'boolean':
        control = (
          <label className="check">
            <input
              {...common}
              type="checkbox"
              checked={value === true}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span>{value === true ? 'Yes' : 'No'}</span>
          </label>
        );
        break;
      case 'text':
        control = (
          <textarea
            {...common}
            className="input textarea"
            rows={7}
            value={asText(value)}
            onChange={(event) => onChange(event.target.value)}
            maxLength={field.validation?.maxLength}
          />
        );
        break;
      // Empty input becomes null rather than 0, so "no value" stays distinct.
      case 'integer':
      case 'decimal':
        control = (
          <input
            {...common}
            className="input mono"
            type="number"
            inputMode={field.type === 'integer' ? 'numeric' : 'decimal'}
            step={field.type === 'integer' ? 1 : 'any'}
            min={field.validation?.min}
            max={field.validation?.max}
            value={typeof value === 'number' ? value : ''}
            onChange={(event) =>
              onChange(
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
          />
        );
        break;
      case 'datetime':
        control = (
          <input
            {...common}
            className="input mono"
            type="datetime-local"
            value={toLocalInput(value)}
            onChange={(event) => onChange(fromLocalInput(event.target.value))}
          />
        );
        break;
      case 'date':
        control = (
          <input
            {...common}
            className="input mono"
            type="date"
            value={typeof value === 'string' ? value.slice(0, 10) : ''}
            onChange={(event) => onChange(event.target.value || null)}
          />
        );
        break;
      case 'json':
      case 'array':
        control = <JsonInput {...common} value={value} onChange={onChange} />;
        break;
      case 'reference':
        // Fall back to a plain id box when the target collection is unknown.
        control = field.references ? (
          <ReferenceSelect
            {...common}
            connectionId={connectionId}
            target={field.references}
            value={value}
            onChange={onChange}
            required={field.required === true}
          />
        ) : (
          <input
            {...common}
            className="input mono"
            value={asText(value)}
            onChange={(event) => onChange(event.target.value || null)}
          />
        );
        break;
      // Not editable here: shown as JSON so it is at least visible.
      case 'binary':
      case 'geopoint':
        control = (
          <input
            {...common}
            className="input mono"
            value={
              value === null || value === undefined ? '' : JSON.stringify(value)
            }
            readOnly
          />
        );
        break;
      default:
        control = (
          <input
            {...common}
            className="input"
            value={asText(value)}
            onChange={(event) => onChange(event.target.value)}
            maxLength={field.validation?.maxLength}
          />
        );
    }
  }

  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {field.name}
        {field.required ? (
          <span className="req" title="Required">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {control}
      {hintFor(field) ? (
        <span id={hintId} className="field-hint">
          {hintFor(field)}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Helper text under a field: why it is locked, or its validation rules in
 * words.
 */
function hintFor(field: FieldInfo): string | null {
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
const asText = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : value === null || value === undefined
      ? ''
      : String(value);

/**
 * Map the chosen text back to the original option so numbers stay numbers.
 */
function parseEnum(field: FieldInfo, raw: string): unknown {
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
function toLocalInput(value: unknown): string {
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
function fromLocalInput(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Accessibility props every control receives. */
type ControlProps = {
  id: string;
  disabled: boolean;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
};

/**
 * JSON is edited as text. Only valid JSON is passed on; the message shows while
 * it is not.
 */
function JsonInput({
  value,
  onChange,
  ...rest
}: ControlProps & { value: unknown; onChange: (value: unknown) => void }) {
  const [text, setText] = useState(() =>
    value === undefined || value === null ? '' : JSON.stringify(value, null, 2),
  );
  const [problem, setProblem] = useState<string | null>(null);

  // Show a new value when it changes from outside (for example after discarding
  // changes).
  useEffect(() => {
    try {
      if (JSON.stringify(JSON.parse(text)) === JSON.stringify(value)) {
        return;
      }
    } catch {
      if (value === undefined || value === null) {
        return;
      }
    }
    setText(
      value === undefined || value === null
        ? ''
        : JSON.stringify(value, null, 2),
    );
    setProblem(null);
    // Only react to outside changes, not to our own typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <>
      <textarea
        {...rest}
        className="input textarea mono"
        rows={6}
        spellCheck={false}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (next.trim() === '') {
            setProblem(null);
            onChange(null);
            return;
          }
          try {
            onChange(JSON.parse(next));
            setProblem(null);
          } catch {
            setProblem('This is not valid JSON yet, so it has not been saved.');
          }
        }}
      />
      {problem ? (
        <span className="field-error" role="alert">
          {problem}
        </span>
      ) : null}
    </>
  );
}

/** A dropdown of records from the collection this field points at. */
function ReferenceSelect({
  connectionId,
  target,
  value,
  onChange,
  required,
  ...rest
}: ControlProps & {
  connectionId: string;
  target: string;
  value: unknown;
  onChange: (value: unknown) => void;
  required: boolean;
}) {
  // Null while loading, which is shown as a plain input.
  const [options, setOptions] = useState<Array<{
    id: string | number;
    label: string;
  }> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      gateway.collection(connectionId, target, controller.signal),
      // Only the first 200 records are offered; larger sets fall back to typing
      // an id.
      gateway.records(
        connectionId,
        target,
        { limit: 200, sort: undefined },
        controller.signal,
      ),
    ])
      .then(([detail, page]) => {
        const key =
          detail.fields.find((field) => field.primaryKey)?.name ?? 'id';
        const labelField = detail.fields.find(
          (field) =>
            !field.primaryKey &&
            (field.type === 'string' || field.type === 'text'),
        )?.name;
        setOptions(
          page.data.map((record: RecordData) => ({
            id: record[key] as string | number,
            label: labelField
              ? `${String(record[labelField] ?? '')} (#${String(record[key])})`
              : `#${String(record[key])}`,
          })),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, [connectionId, target]);

  // Degrade to a free-text id so the field stays usable if choices fail.
  if (failed || options === null) {
    return (
      <input
        {...rest}
        className="input mono"
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : event.target.value)
        }
        placeholder={options === null && !failed ? 'Loading choices…' : ''}
      />
    );
  }

  const current = value === null || value === undefined ? '' : String(value);
  return (
    <select
      {...rest}
      className="input"
      value={current}
      onChange={(event) => {
        const chosen = options.find(
          (option) => String(option.id) === event.target.value,
        );
        onChange(chosen ? chosen.id : null);
      }}
    >
      <option value="">{required ? 'Choose…' : 'None'}</option>
      {options.map((option) => (
        <option key={String(option.id)} value={String(option.id)}>
          {option.label}
        </option>
      ))}
      {current && !options.some((option) => String(option.id) === current) ? (
        <option value={current}>#{current}</option>
      ) : null}
    </select>
  );
}
