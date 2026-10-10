/**
 * Move data between connections (admin only).
 */

import { useEffect, useRef, useState } from 'react';
import { gateway, type MigrationJob, type MigrationPlan } from '../api';
import { timeAgo } from '../lib/time';
import { useAsync } from '../useAsync';

// Plain-language job outcomes.
const STATUS_TEXT: Record<MigrationJob['status'], string> = {
  running: 'Copying…',
  completed: 'Finished',
  completed_with_errors: 'Finished, but some records were not copied',
  failed: 'Stopped',
  cancelled: 'Cancelled',
};

/**
 * Format a record count; "+" marks a lower bound when the database could not
 * count exactly.
 */
const count = (value: { count: number; exact: boolean } | null) =>
  value ? `${value.count.toLocaleString()}${value.exact ? '' : '+'}` : '—';

/**
 * Copy data between two connections in two steps: "Check first" produces a dry-
 * run plan, and only a plan with no blocking problems can be started. The
 * gateway runs the copy as a background job that this page polls.
 */
export function MigratePage() {
  const { state, reload } = useAsync(async (signal) => {
    const [connections, jobs] = await Promise.all([
      gateway.connections(signal),
      gateway.migrations(signal),
    ]);
    return { connections, jobs };
  }, 'migrate');

  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [onConflict, setOnConflict] = useState<'skip' | 'overwrite' | 'fail'>(
    'skip',
  );
  const [preserveIds, setPreserveIds] = useState(false);
  const [dropUnmappedFields, setDrop] = useState(false);
  const [createMissing, setCreateMissing] = useState(false);

  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [job, setJob] = useState<MigrationJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Handle for the progress poll, so cleanup can cancel it.
  const timer = useRef<number | undefined>(undefined);

  // The same options feed both the dry run and the real run, so the plan
  // matches what will happen.
  const options = {
    source,
    target,
    onConflict,
    preserveIds,
    dropUnmappedFields,
    createMissing,
  };
  // Any edit invalidates the plan: it was computed for the old settings.
  const changed = () => {
    setPlan(null);
    setError('');
  };

  // Follows a running migration until it ends. Polls once a second; the effect
  // re-runs on each update, so it stops once
  // the status is no longer "running".
  useEffect(() => {
    if (!job || job.status !== 'running') {
      return undefined;
    }
    const controller = new AbortController();
    timer.current = window.setTimeout(() => {
      gateway
        .migration(job.id, controller.signal)
        .then(setJob)
        .catch((e: unknown) => {
          if (!controller.signal.aborted) {
            setError(
              e instanceof Error ? e.message : 'Could not read the progress.',
            );
          }
        });
    }, 1000);
    return () => {
      controller.abort();
      window.clearTimeout(timer.current);
    };
  }, [job]);

  useEffect(() => {
    if (job && job.status !== 'running') {
      reload();
    }
  }, [job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dry run: reads both sides but writes nothing.
  async function check() {
    setBusy(true);
    setError('');
    setPlan(null);
    try {
      setPlan(await gateway.planMigration(options));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not check the migration.',
      );
    } finally {
      setBusy(false);
    }
  }

  // Clears the plan so the same check cannot be started twice.
  async function start() {
    setBusy(true);
    setError('');
    try {
      setJob(await gateway.startMigration(options));
      setPlan(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not start the migration.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!job) {
      return;
    }
    try {
      setJob(await gateway.cancelMigration(job.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel.');
    }
  }

  // Show connection names; fall back to the id for deleted connections.
  const name = (id: string) =>
    (state.status === 'ready'
      ? state.data.connections.find((c) => c.id === id)?.name
      : undefined) ?? id;
  const connections = state.status === 'ready' ? state.data.connections : [];
  const targetItem = connections.find((c) => c.id === target);
  const running = job?.status === 'running';
  // Past runs, excluding the one already shown in detail.
  const earlier =
    state.status === 'ready'
      ? state.data.jobs.filter((j) => j.id !== job?.id)
      : [];

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Move data</h1>
      </header>
      <p className="muted section-lede">
        Copy records from one database connection into another, for example from
        PostgreSQL into a new PostgreSQL, or from a demo into a real database.
        The source is only read. Tables or collections the target does not have
        can be created for you.
      </p>

      {state.status === 'loading' ? (
        <p className="muted" aria-busy="true">
          Loading…
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === 'ready' && connections.length < 2 ? (
        <p className="muted">
          Add a second connection first. Moving data needs a source and a
          different target.
        </p>
      ) : null}

      {state.status === 'ready' && connections.length >= 2 ? (
        <section className="section">
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              void check();
            }}
          >
            <div className="field-row">
              <label className="field grow">
                <span className="field-label">Copy from</span>
                <select
                  className="input"
                  value={source}
                  disabled={running}
                  onChange={(e) => {
                    setSource(e.target.value);
                    changed();
                  }}
                >
                  <option value="">Choose a connection</option>
                  {connections
                    .filter((c) => c.id !== target)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.adapterType})
                      </option>
                    ))}
                </select>
              </label>
              <label className="field grow">
                <span className="field-label">Copy into</span>
                <select
                  className="input"
                  value={target}
                  disabled={running}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    changed();
                  }}
                >
                  <option value="">Choose a connection</option>
                  {connections
                    .filter((c) => c.id !== source)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.adapterType})
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {targetItem && targetItem.mode !== 'read_write' ? (
              <p className="form-error" role="alert">
                “{targetItem.name}” is read-only. Switch it to read-write on its
                connection page before copying into it.
              </p>
            ) : null}

            <label className="field">
              <span className="field-label">
                If a record already exists in the target
              </span>
              <select
                className="input"
                value={onConflict}
                disabled={running}
                onChange={(e) => {
                  setOnConflict(e.target.value as typeof onConflict);
                  changed();
                }}
              >
                <option value="skip">
                  Leave it as it is (safe to run again)
                </option>
                <option value="overwrite">
                  Replace it with the source version
                </option>
                <option value="fail">Report an error</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={createMissing}
                disabled={running}
                onChange={(e) => {
                  setCreateMissing(e.target.checked);
                  changed();
                }}
              />
              <span>
                Create tables or collections the target does not have yet. They
                get the same fields and key, and keep the original ids. Existing
                ones are never changed.
              </span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={preserveIds}
                disabled={running}
                onChange={(e) => {
                  setPreserveIds(e.target.checked);
                  changed();
                }}
              />
              <span>
                Keep the original ids when copying into a table that already
                exists and numbers its own records. Some databases do not allow
                this.
              </span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={dropUnmappedFields}
                disabled={running}
                onChange={(e) => {
                  setDrop(e.target.checked);
                  changed();
                }}
              />
              <span>
                Leave behind fields that the target does not have. Their values
                are not copied.
              </span>
            </label>

            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="form-actions">
              <button
                className="button"
                type="submit"
                disabled={!source || !target || busy || running}
              >
                {busy && !plan ? 'Checking…' : 'Check first'}
              </button>
              {plan?.ready && targetItem?.mode === 'read_write' ? (
                <button
                  className="button button-outline"
                  type="button"
                  disabled={busy || running}
                  onClick={() => void start()}
                >
                  Start copying
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      {plan ? <PlanView plan={plan} /> : null}
      {job ? (
        <JobView job={job} name={name} onCancel={() => void cancel()} />
      ) : null}

      {earlier.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <h2>Earlier runs</h2>
          </div>
          <ul className="list">
            {earlier.map((j) => (
              <li className="list-item" key={j.id}>
                <div>
                  <div className="item-title">
                    {name(j.source)} → {name(j.target)}
                  </div>
                  <div className="meta-line muted small">
                    <span>{STATUS_TEXT[j.status]}</span>
                    <time dateTime={j.startedAt}>{timeAgo(j.startedAt)}</time>
                    <span>
                      {j.collections
                        .reduce((n, c) => n + c.created + c.updated, 0)
                        .toLocaleString()}{' '}
                      records written
                    </span>
                  </div>
                </div>
                <button
                  className="button button-quiet button-small"
                  type="button"
                  onClick={() => setJob(j)}
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Dry-run result: blocking problems, warnings and per-collection counts.
 */
function PlanView({ plan }: { plan: MigrationPlan }) {
  return (
    <section className="section" aria-live="polite">
      <div className="section-head">
        <h2>{plan.ready ? 'Ready to copy' : 'Fix these before copying'}</h2>
      </div>
      {plan.problems.map((p) => (
        <p className="form-error" key={p}>
          {p}
        </p>
      ))}
      {plan.warnings.map((w) => (
        <p className="muted" key={w}>
          {w}
        </p>
      ))}
      <ul className="list">
        {plan.collections.map((c) => (
          <li className="list-item migrate-item" key={c.from}>
            <div>
              <div className="item-title">
                {c.from}
                {c.to !== c.from ? ` → ${c.to}` : ''}
              </div>
              <div className="meta-line muted small">
                <span>{count(c.sourceRecords)} to copy</span>
                <span>{count(c.targetRecords)} already in the target</span>
                <span>
                  {c.create
                    ? 'will be created'
                    : c.idsPreserved
                      ? 'ids kept'
                      : 'new ids assigned'}
                </span>
              </div>
              {c.problems.map((p) => (
                <p className="form-error" key={p}>
                  {p}
                </p>
              ))}
              {c.warnings.map((w) => (
                <p className="muted small" key={w}>
                  {w}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Progress and outcome of a migration job, with cancel while it runs.
 */
function JobView({
  job,
  name,
  onCancel,
}: {
  job: MigrationJob;
  name: (id: string) => string;
  onCancel: () => void;
}) {
  return (
    <section className="section" aria-live="polite">
      <div className="section-head">
        <h2>
          {name(job.source)} → {name(job.target)}
        </h2>
        {job.status === 'running' ? (
          <button
            className="button button-outline button-small"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
      <p className={job.status === 'completed' ? 'item-title' : 'muted'}>
        {STATUS_TEXT[job.status]}
        {job.message ? `. ${job.message}` : ''}
      </p>
      <ul className="list">
        {job.collections.map((c) => (
          <li className="list-item migrate-item" key={c.from}>
            <div>
              <div className="item-title">
                {c.from}
                {c.to !== c.from ? ` → ${c.to}` : ''}
              </div>
              {c.total !== null && c.state === 'running' ? (
                <progress
                  max={c.total}
                  value={c.read}
                  aria-label={`Copying ${c.from}`}
                />
              ) : null}
              <div className="meta-line muted small">
                <span>
                  {c.state === 'waiting'
                    ? 'Waiting'
                    : c.state === 'running'
                      ? 'Copying'
                      : c.state === 'skipped'
                        ? 'Not started'
                        : c.state === 'failed'
                          ? 'Some records failed'
                          : 'Done'}
                </span>
                <span>{c.created.toLocaleString()} copied</span>
                {c.updated > 0 ? (
                  <span>{c.updated.toLocaleString()} replaced</span>
                ) : null}
                {c.skipped > 0 ? (
                  <span>{c.skipped.toLocaleString()} already there</span>
                ) : null}
                {c.failed > 0 ? (
                  <span className="bad">
                    {c.failed.toLocaleString()} failed
                  </span>
                ) : null}
                {c.verified === true ? <span>count checked</span> : null}
                {c.verified === false ? (
                  <span className="bad">count does not match</span>
                ) : null}
                {c.differences > 0 ? (
                  <span className="bad">
                    {c.differences.toLocaleString()} stored differently
                  </span>
                ) : null}
              </div>
              {c.note ? <p className="muted small">{c.note}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      {job.errors.length > 0 ? (
        <details className="migrate-errors">
          <summary>
            {job.errorsTruncated ? 'First ' : ''}
            {job.errors.length} problems
          </summary>
          <ul className="list">
            {job.errors.map((e, i) => (
              <li className="list-item" key={i}>
                <div>
                  <span className="item-title">
                    {e.collection} · {e.id}
                  </span>{' '}
                  <span className="muted small">{e.message}</span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
