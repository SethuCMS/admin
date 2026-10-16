/**
 * The code box for JSON and array values.
 */
import { useEffect, useState } from 'react';

/** Accessibility props every control receives. */
export type ControlProps = {
  id: string;
  disabled: boolean;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
};

/**
 * JSON is edited as text. Only valid JSON is passed on; the message shows while
 * it is not.
 */
export function JsonInput({
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
