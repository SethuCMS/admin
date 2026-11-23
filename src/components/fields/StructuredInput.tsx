/**
 * A readable form for JSON and array values: lists get one box per item, and
 * objects get one labelled box per key. Shapes it cannot show as a form (mixed
 * lists, empty JSON with no known shape) are left to the code box.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPrimitive = (value: unknown): boolean =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

/** "publishedAt" or "live_url" becomes "Published at" / "Live url". */
export function humanize(key: string): string {
  const words = key
    .replace(/^_+/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? words[0]!.toUpperCase() + words.slice(1) : key;
}

/** True when the value can be shown as a form rather than as code. */
export function canShowAsForm(value: unknown, isArrayField: boolean): boolean {
  if (value === null || value === undefined) {
    return isArrayField;
  }
  return fits(value, 0);
}

function fits(value: unknown, depth: number): boolean {
  if (depth > 6) {
    return false;
  }
  if (isPrimitive(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    // Lists must hold one kind of thing so "Add item" knows what to add.
    const allPrimitive = value.every(isPrimitive);
    const allObjects = value.every(isObject);
    if (!allPrimitive && !allObjects) {
      return false;
    }
    return value.every((item) => fits(item, depth + 1));
  }
  if (isObject(value)) {
    return Object.values(value).every((item) => fits(item, depth + 1));
  }
  return false;
}

/** An empty value of the same shape, for a new list item. */
function blankLike(sample: unknown): Json {
  if (typeof sample === 'number') return 0;
  if (typeof sample === 'boolean') return false;
  if (Array.isArray(sample)) return [];
  if (isObject(sample)) {
    return Object.fromEntries(
      Object.entries(sample).map(([key, item]) => [key, blankLike(item)]),
    );
  }
  return '';
}

interface NodeProps {
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
  label: string;
}

/** The form for one value, picked by its shape. */
function Node({ value, onChange, disabled, label }: NodeProps) {
  if (Array.isArray(value)) {
    return <ListEditor value={value} onChange={onChange} disabled={disabled} label={label} />;
  }
  if (isObject(value)) {
    return <ObjectEditor value={value} onChange={onChange} disabled={disabled} />;
  }
  return <Leaf value={value} onChange={onChange} disabled={disabled} label={label} />;
}

function Leaf({ value, onChange, disabled, label }: NodeProps) {
  if (typeof value === 'boolean') {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={value}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{value ? 'Yes' : 'No'}</span>
      </label>
    );
  }
  if (typeof value === 'number') {
    return (
      <input
        className="input mono"
        type="number"
        step="any"
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : Number(event.target.value))
        }
      />
    );
  }
  const text = value === null || value === undefined ? '' : String(value);
  // Long text gets room to breathe.
  if (text.length > 80 || text.includes('\n')) {
    return (
      <textarea
        className="input textarea"
        rows={Math.min(8, Math.max(3, Math.ceil(text.length / 70)))}
        value={text}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <input
      className="input"
      value={text}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ObjectEditor({
  value,
  onChange,
  disabled,
}: {
  value: Record<string, unknown>;
  onChange: (value: unknown) => void;
  disabled: boolean;
}) {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return <span className="muted small">Empty</span>;
  }
  return (
    <div className="sf-object">
      {entries.map(([key, item]) => (
        <div key={key} className="sf-row">
          <span className="sf-key" title={key}>
            {humanize(key)}
          </span>
          <Node
            value={item}
            label={humanize(key)}
            disabled={disabled}
            onChange={(next) => onChange({ ...value, [key]: next })}
          />
        </div>
      ))}
    </div>
  );
}

function ListEditor({
  value,
  onChange,
  disabled,
  label,
}: {
  value: unknown[];
  onChange: (value: unknown) => void;
  disabled: boolean;
  label: string;
}) {
  const objects = value.length > 0 && value.every(isObject);
  const remove = (index: number) =>
    onChange(value.filter((_, at) => at !== index));
  const move = (index: number, by: number) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange(next);
  };

  return (
    <div className="sf-list">
      {value.length === 0 ? <span className="muted small">No items yet</span> : null}
      {value.map((item, index) => (
        <div key={index} className={objects ? 'sf-item sf-item-card' : 'sf-item'}>
          {objects ? (
            <span className="sf-item-title small muted">
              {label} {index + 1}
            </span>
          ) : null}
          <div className="sf-item-body">
            <Node
              value={item}
              label={`${label} ${index + 1}`}
              disabled={disabled}
              onChange={(next) =>
                onChange(value.map((old, at) => (at === index ? next : old)))
              }
            />
          </div>
          {disabled ? null : (
            <div className="sf-item-actions">
              <button
                type="button"
                className="button button-quiet button-icon"
                aria-label={`Move ${label} ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="button button-quiet button-icon"
                aria-label={`Move ${label} ${index + 1} down`}
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="button button-quiet button-icon"
                aria-label={`Remove ${label} ${index + 1}`}
                onClick={() => remove(index)}
              >
                ×
              </button>
            </div>
          )}
        </div>
      ))}
      {disabled ? null : (
        <button
          type="button"
          className="button button-quiet sf-add"
          onClick={() => onChange([...value, blankLike(value[value.length - 1])])}
        >
          Add item
        </button>
      )}
    </div>
  );
}

/** The whole form for one JSON or array field. */
export function StructuredInput({
  id,
  value,
  onChange,
  disabled,
  label,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div id={id} className="sf" role="group" aria-label={label}>
      <Node
        value={value === null || value === undefined ? [] : value}
        onChange={onChange}
        disabled={disabled}
        label={singular(label)}
      />
    </div>
  );
}

/** "categories" → "Category", for item labels like "Category 2". */
function singular(label: string): string {
  const word = humanize(label);
  if (/ies$/i.test(word)) return word.slice(0, -3) + 'y';
  if (/(ss|us)$/i.test(word)) return word;
  if (/s$/i.test(word)) return word.slice(0, -1);
  return word;
}
