/**
 * A dropdown of records from another collection.
 */
import { useEffect, useState } from 'react';
import { gateway, type RecordData } from '../../api';
import type { ControlProps } from './JsonInput';

/** A dropdown of records from the collection this field points at. */
export function ReferenceSelect({
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
