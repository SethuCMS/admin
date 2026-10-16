/**
 * Form control for a single record field, chosen by field type.
 */

import { useId, useState } from 'react';
import type { FieldInfo } from '../api';
import { FileUpload, showsFile } from './fields/FileUpload';
import {
  asText,
  fromLocalInput,
  hintFor,
  parseEnum,
  toLocalInput,
} from './fields/helpers';
import { JsonInput } from './fields/JsonInput';
import { ReferenceSelect } from './fields/ReferenceSelect';

/** Props for one editable field. */
interface FieldInputProps {
  connectionId: string;
  /** This connection stores files and the person may change this record. */
  canUpload?: boolean;
  field: FieldInfo;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
  error?: string | undefined;
}

/** One form control for one field, chosen by the field's type. */
export function FieldInput({
  connectionId,
  canUpload = false,
  field,
  value,
  onChange,
  disabled,
  error,
}: FieldInputProps) {
  const id = useId();
  // Files show their preview; the raw JSON opens only on request.
  const [code, setCode] = useState(false);
  // Masked, read-only and form-disabled fields all behave the same: shown but
  // not editable.
  const locked = disabled || !field.editable || field.masked;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // Links the control to its hint and error text for screen readers.
  const describedBy =
    [error ? errorId : null, hintFor(field) || field.ui?.description ? hintId : null]
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
      case 'array': {
        // The schema file can name the editor; otherwise it follows the value.
        const widget = field.ui?.widget;
        const file =
          field.type === 'json' &&
          widget !== 'code' &&
          (widget === 'image' || widget === 'file' || showsFile(field.name, value));
        control = (
          <>
            {file ? (
              <FileUpload
                connectionId={connectionId}
                value={value}
                onChange={onChange}
                canUpload={canUpload && !locked}
              />
            ) : null}
            {file ? (
              <button
                type="button"
                className="button button-quiet code-toggle"
                aria-expanded={code}
                onClick={() => setCode(!code)}
              >
                {code ? 'Hide code' : 'Edit as code'}
              </button>
            ) : null}
            {!file || code ? (
              <JsonInput {...common} value={value} onChange={onChange} />
            ) : null}
          </>
        );
        break;
      }
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
        {field.ui?.label ?? field.name}
        {field.required ? (
          <span className="req" title="Required">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {control}
      {field.ui?.description || hintFor(field) ? (
        <span id={hintId} className="field-hint">
          {[field.ui?.description, hintFor(field)].filter(Boolean).join(' ')}
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
