/**
 * Publish later: pick a date and time, see it, change it or cancel it.
 */

import { useId, useState, type KeyboardEvent } from 'react';
import { pickProblem, suggestedTime, toLocalInput } from '../lib/schedule';

/** The time in the person's own time zone and language, like "Nov 5, 2026, 9:00 AM". */
export function describeTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

interface ScheduleBoxProps {
  /** Set when a publish is already scheduled. */
  publishAt: string | undefined;
  /** Set when the last scheduled publish did not happen. */
  failure: string | undefined;
  /** There are changes to publish, so scheduling makes sense. */
  ready: boolean;
  busy: boolean;
  onSchedule: (isoWithZone: string) => void;
  onCancel: () => void;
}

/**
 * Three states: nothing scheduled (a "Schedule" button opens the picker),
 * scheduled (shows the time with Change and Cancel schedule), and failed
 * (shows why, with a way to schedule again).
 */
export function ScheduleBox({
  publishAt,
  failure,
  ready,
  busy,
  onSchedule,
  onCancel,
}: ScheduleBoxProps) {
  const [picking, setPicking] = useState(false);
  const [value, setValue] = useState(suggestedTime());
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Not a <form>: the editor around this box is already a form, and a nested
  // form would also submit (publish) the editor.
  const submit = () => {
    const problem = pickProblem(value);
    if (problem) {
      setError(problem);
      return;
    }
    const when = new Date(value); // read as the person's local time
    setError(null);
    setPicking(false);
    // toISOString() ends in Z, which names the zone unambiguously for the gateway.
    onSchedule(when.toISOString());
  };

  const picker = (
    <div className="schedule-picker" role="group" aria-label="Schedule a publish">
      <label htmlFor={inputId} className="field-label">
        Publish at
      </label>
      <input
        id={inputId}
        className="input"
        type="datetime-local"
        value={value}
        min={toLocalInput(new Date())}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event: KeyboardEvent) => {
          // Enter schedules, instead of publishing the whole editor.
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
        }}
        required
        aria-describedby={`${inputId}-zone`}
      />
      <span id={`${inputId}-zone`} className="muted small">
        Your time zone: {zone}
      </span>
      <div className="form-actions">
        <button
          className="button button-small"
          type="button"
          disabled={busy}
          onClick={submit}
        >
          Schedule
        </button>
        <button
          className="button button-small button-quiet"
          type="button"
          onClick={() => {
            setPicking(false);
            setError(null);
          }}
        >
          Keep as draft
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );

  if (publishAt) {
    return (
      <div className="panel schedule" role="status">
        <p>
          <strong>Scheduled.</strong> This draft will publish on{' '}
          <time dateTime={publishAt}>{describeTime(publishAt)}</time>, with
          whatever is saved then.
        </p>
        {picking ? (
          picker
        ) : (
          <div className="form-actions">
            <button
              className="button button-small button-outline"
              type="button"
              disabled={busy}
              onClick={() => setPicking(true)}
            >
              Change time
            </button>
            <button
              className="button button-small button-quiet"
              type="button"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel schedule
            </button>
          </div>
        )}
      </div>
    );
  }

  if (failure) {
    return (
      <div className="panel warn schedule" role="alert">
        <p>
          <strong>The scheduled publish did not happen.</strong> {failure}.
          Nothing was published.
        </p>
        {picking ? (
          picker
        ) : (
          <div className="form-actions">
            <button
              className="button button-small"
              type="button"
              disabled={busy || !ready}
              onClick={() => setPicking(true)}
            >
              Schedule again
            </button>
            <button
              className="button button-small button-quiet"
              type="button"
              disabled={busy}
              onClick={onCancel}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!ready) {
    return null; // nothing to publish yet
  }

  return picking ? (
    <div className="panel schedule">{picker}</div>
  ) : (
    <p className="schedule-hint">
      <button
        className="link-button"
        type="button"
        disabled={busy}
        onClick={() => setPicking(true)}
      >
        Schedule
      </button>{' '}
      <span className="muted small">to publish at a later time</span>
    </p>
  );
}
