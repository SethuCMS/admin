/**
 * Record editor with autosaved drafts, publishing and conflict handling.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GatewayError,
  gateway,
  type CollectionDetail,
  type DraftInfo,
  type RecordData,
} from '../api';
import { contentHref, navigate } from '../router';
import { useAsync } from '../useAsync';
import { FieldInput } from './FieldInput';
import { useFieldVisibility } from '../lib/fieldVisibility';
import { PreviewPane } from './PreviewPane';

/**
 * What the editor is open on: a published record, a brand-new record (no draft
 * yet), or an existing draft. Encoded in the URL: "~new" and "~<draftId>" are
 * drafts; anything else is a record id.
 */
export type EditorTarget =
  | { kind: 'record'; id: string }
  | { kind: 'new' }
  | { kind: 'draft'; id: string };

/**
 * Turn the part of the address after the collection name into an editor target.
 */
export function targetFromParam(param: string): EditorTarget {
  if (param === '~new') {
    return { kind: 'new' };
  }
  if (param.startsWith('~')) {
    return { kind: 'draft', id: param.slice(1) };
  }
  return { kind: 'record', id: param };
}

// Autosave waits for a pause in typing before sending a draft.
const SAVE_DELAY_MS = 700;

/** Which record or draft to edit, and its collection schema. */
interface RecordEditorProps {
  connectionId: string;
  collectionName: string;
  detail: CollectionDetail;
  target: EditorTarget;
}

/** Loads the record and any open draft, then shows the form. */
export function RecordEditor({
  connectionId,
  collectionName,
  detail,
  target,
}: RecordEditorProps) {
  // Part of the load key so switching record or draft refetches.
  const targetKey =
    target.kind === 'new' ? 'new' : `${target.kind}:${target.id}`;
  // Bumped to force a reload, which also remounts the form below.
  const [round, setRound] = useState(0);

  const loaded = useAsync(async (signal) => {
    // Viewers cannot see drafts, so do not ask for them.
    const canDraft = detail.access.update || detail.access.create;
    const draftsPromise: Promise<DraftInfo[]> = canDraft
      ? // A failed draft lookup is treated as "no drafts" so the record still
        // opens.
        gateway.drafts(connectionId, collectionName, signal).catch(() => [])
      : Promise.resolve([]);
    const [drafts, record] = await Promise.all([
      draftsPromise,
      target.kind === 'record'
        ? gateway.record(connectionId, collectionName, target.id, signal)
        : Promise.resolve(null),
    ]);
    // A published record may have a pending draft; find it by record id or by
    // draft id.
    const draft =
      target.kind === 'record'
        ? (drafts.find((item) => item.recordId === target.id) ?? null)
        : target.kind === 'draft'
          ? (drafts.find((item) => item.id === target.id) ?? null)
          : null;
    // The link points at a draft someone else published or discarded.
    if (target.kind === 'draft' && !draft) {
      throw new Error(
        'That draft no longer exists. It may have been published or discarded.',
      );
    }
    return { record, draft };
  }, `${connectionId}:${collectionName}:${targetKey}:${round}`);

  if (loaded.state.status === 'loading') {
    return (
      <div className="editor" aria-busy="true">
        <p className="muted pad">Loading…</p>
      </div>
    );
  }
  if (loaded.state.status === 'error') {
    return (
      <div className="editor">
        <p className="form-error pad" role="alert">
          {loaded.state.message}
        </p>
        <p className="pad">
          <a
            className="button button-quiet"
            href={contentHref(connectionId, collectionName)}
          >
            Back to the list
          </a>
        </p>
      </div>
    );
  }

  return (
    <EditorForm
      // Remount on change so form state never leaks between records.
      key={`${targetKey}:${round}`}
      connectionId={connectionId}
      collectionName={collectionName}
      detail={detail}
      target={target}
      record={loaded.state.data.record}
      initialDraft={loaded.state.data.draft}
      reload={() => setRound((n) => n + 1)}
    />
  );
}

/** Loaded data handed to the form. */
interface EditorFormProps extends RecordEditorProps {
  record: RecordData | null;
  initialDraft: DraftInfo | null;
  reload: () => void;
}

/**
 * The edit form. Changes autosave as a draft; "Publish" writes the draft to the
 * database. Drafts mean the live record is untouched until publishing, and
 * edits are never lost on errors.
 */
function EditorForm({
  connectionId,
  collectionName,
  detail,
  target,
  record,
  initialDraft,
  reload,
}: EditorFormProps) {
  const isNew = target.kind !== 'record';
  const fieldChoice = useFieldVisibility(connectionId, collectionName);
  // Mode and role both come from the gateway; this only reflects them.
  const canEdit = isNew ? detail.access.create : detail.access.update;
  const recordId = target.kind === 'record' ? target.id : null;
  // Needed to find the new record's id after publishing.
  const primaryKey =
    detail.fields.find((field) => field.primaryKey)?.name ?? 'id';

  // Draft as last confirmed by the gateway; it carries the version used for
  // conflict checks.
  const [draft, setDraft] = useState<DraftInfo | null>(initialDraft);
  const [local, setLocal] = useState<RecordData>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [staleDraft, setStaleDraft] = useState(false);
  const [recordChanged, setRecordChanged] = useState(false);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Edits not sent yet, the latest draft, and a queue so saves never overlap.
  const dirty = useRef<Set<string>>(new Set());
  const localRef = useRef<RecordData>({});
  const draftRef = useRef<DraftInfo | null>(initialDraft);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // Value precedence: what you typed, then the saved draft, then the live
  // record.
  const valueOf = (name: string): unknown => {
    if (name in local) {
      return local[name];
    }
    if (draft && name in draft.values) {
      return draft.values[name];
    }
    return record?.[name];
  };

  // Translate gateway errors: field problems show beside the field; a CONFLICT
  // means the draft changed under us.
  const applyError = useCallback((error: unknown) => {
    if (
      error instanceof GatewayError &&
      error.code === 'VALIDATION_FAILED' &&
      Array.isArray(error.details)
    ) {
      const next: Record<string, string> = {};
      for (const issue of error.details as Array<{
        path?: string;
        message?: string;
      }>) {
        if (issue.path && issue.message) {
          next[issue.path] = issue.message;
        }
      }
      setFieldErrors(next);
      setProblem(Object.keys(next).length > 0 ? null : error.message);
      return;
    }
    if (error instanceof GatewayError && error.code === 'CONFLICT') {
      setStaleDraft(true);
      return;
    }
    setProblem(error instanceof Error ? error.message : 'That did not work.');
  }, []);

  /**
   * Send unsaved edits to the gateway as a draft. Resolves to the draft
   * afterwards.
   */
  const flush = useCallback((): Promise<DraftInfo | null> => {
    clearTimeout(timer.current);
    const run = queue.current.then(async () => {
      // Another queued save already sent these edits.
      if (dirty.current.size === 0) {
        return draftRef.current;
      }
      // Snapshot and clear before the request, so edits made while saving are
      // kept for the next one.
      const names = [...dirty.current];
      dirty.current = new Set();
      const values: RecordData = Object.fromEntries(
        names.map((name) => [name, localRef.current[name]]),
      );

      setSaveState('saving');
      setProblem(null);
      try {
        // The first save creates the draft; later ones update it, sending the
        // version for optimistic locking.
        const saved = draftRef.current
          ? await gateway.saveDraft(
              connectionId,
              collectionName,
              draftRef.current.id,
              { version: draftRef.current.version, values },
            )
          : await gateway.createDraft(connectionId, collectionName, {
              recordId,
              values,
            });
        draftRef.current = saved;
        setDraft(saved);
        setFieldErrors({});
        setSaveState('saved');
        return saved;
      } catch (error) {
        for (const name of names) {
          dirty.current.add(name);
        } // keep the edits so nothing is lost
        setSaveState('idle');
        applyError(error);
        return draftRef.current;
      }
    });
    // Chain saves so two requests never run at once and clash on the version; a
    // failure must not block later saves.
    queue.current = run.catch(() => undefined);
    return run;
  }, [connectionId, collectionName, recordId, applyError]);

  // Cancel a pending autosave on unmount.
  useEffect(() => () => clearTimeout(timer.current), []);

  // Update the screen immediately, then debounce the network save.
  const change = (name: string, value: unknown) => {
    localRef.current = { ...localRef.current, [name]: value };
    setLocal(localRef.current);
    dirty.current.add(name);
    setFieldErrors((previous) => {
      if (!(name in previous)) {
        return previous;
      }
      // Clear a field's error once the person edits it.
      const { [name]: _removed, ...rest } = previous;
      return rest;
    });
    setSaveState('idle');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  // `force` is used only after the person confirms overwriting a record that
  // changed since they started.
  const publish = async (force = false) => {
    setPublishing(true);
    setRecordChanged(false);
    try {
      // Flush first so publish always uses the latest edits and draft version.
      const saved = await flush();
      if (!saved || dirty.current.size > 0) {
        return;
      } // something is still wrong; the message is already shown
      const result = await gateway.publishDraft(
        connectionId,
        collectionName,
        saved.id,
        { version: saved.version, ...(force ? { force: true } : {}) },
      );
      const key = result.record[primaryKey];
      if (isNew && key !== undefined) {
        navigate(contentHref(connectionId, collectionName, String(key)));
      } else {
        reload();
      }
    } catch (error) {
      if (
        error instanceof GatewayError &&
        error.code === 'CONFLICT' &&
        // The gateway distinguishes "record changed under the draft" from a
        // stale draft version.
        (error.details as { reason?: string } | undefined)?.reason ===
          'record_changed'
      ) {
        setRecordChanged(true);
      } else {
        applyError(error);
      }
    } finally {
      setPublishing(false);
    }
  };

  // Removes the draft only; the published record is untouched.
  const discard = async () => {
    setConfirm(null);
    try {
      if (draftRef.current) {
        await gateway.discardDraft(
          connectionId,
          collectionName,
          draftRef.current.id,
        );
      }
      if (isNew) {
        navigate(contentHref(connectionId, collectionName));
      } else {
        reload();
      }
    } catch (error) {
      applyError(error);
    }
  };

  // Deletes the real record from the database.
  const remove = async () => {
    setConfirm(null);
    try {
      if (recordId) {
        await gateway.deleteRecord(connectionId, collectionName, recordId);
      }
      navigate(contentHref(connectionId, collectionName));
    } catch (error) {
      applyError(error);
    }
  };

  const hasDraftChanges =
    draft !== null && Object.keys(draft.values).length > 0;
  const hasUnsaved = dirty.current.size > 0 || saveState === 'saving';
  const status = !canEdit
    ? 'Read-only'
    : hasDraftChanges || hasUnsaved
      ? 'Unpublished changes'
      : isNew
        ? 'New, nothing entered yet'
        : 'Published';
  const heading =
    titleOf(detail, record, draft, local) ||
    (isNew ? 'New record' : `#${recordId}`);
  // A database-generated key cannot be entered for a new record, so hide it.
  const editable = detail.fields.filter(
    (field) => !(field.primaryKey && field.generated && isNew),
  );
  // Keys and required fields always show: hiding them would hide why a save
  // is refused.
  const pinned = (field: (typeof editable)[number]): boolean =>
    field.primaryKey === true || field.required === true;
  const visibleFields = editable.filter(
    (field) => pinned(field) || fieldChoice.isShown(field.name, field.ui?.hidden),
  );

  return (
    <div className={`editor${previewOpen ? ' editor-with-preview' : ''}`}>
      <form
        className="editor-main"
        onSubmit={(event) => {
          event.preventDefault();
          void publish();
        }}
        aria-label={`Edit ${collectionName}`}
      >
        <header className="editor-head">
          <div>
            <p className="crumbs small">
              <a href={contentHref(connectionId, collectionName)}>
                {collectionName}
              </a>
            </p>
            <h2>{heading}</h2>
            <p className="editor-status">
              <span
                className={`status status-${!canEdit ? 'readonly' : hasDraftChanges || hasUnsaved ? 'draft' : 'published'}`}
              >
                {status}
              </span>
              <span className="muted small" role="status" aria-live="polite">
                {saveState === 'saving'
                  ? 'Saving draft…'
                  : saveState === 'saved'
                    ? 'Draft saved'
                    : ''}
              </span>
            </p>
          </div>
          {canEdit ? (
            <div className="head-actions">
              <button
                className="button button-outline"
                type="button"
                disabled={!draft || !hasDraftChanges}
                onClick={() => setPreviewOpen((open) => !open)}
                title={
                  draft
                    ? undefined
                    : 'Change something first to start a preview'
                }
              >
                {previewOpen ? 'Hide preview' : 'Live preview'}
              </button>
              <button
                className="button"
                type="submit"
                disabled={publishing || (!hasDraftChanges && !hasUnsaved)}
              >
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          ) : null}
        </header>

        {!canEdit ? (
          <p className="notice" role="note">
            {detail.mode === 'read_only'
              ? 'This connection is read-only, so records cannot be changed.'
              : 'Your role can read this record but not change it.'}
          </p>
        ) : null}
        {problem ? (
          <p className="form-error" role="alert">
            {problem}
          </p>
        ) : null}
        {staleDraft ? (
          <p className="form-error" role="alert">
            Someone else changed this draft while you were editing.{' '}
            <button className="link-button" type="button" onClick={reload}>
              Load their version
            </button>{' '}
            (your latest edits stay in this form until you do).
          </p>
        ) : null}
        {recordChanged ? (
          <div className="panel warn" role="alert">
            <p>
              <strong>This record changed after you started editing.</strong>{' '}
              Publishing now will overwrite those changes with your draft.
            </p>
            <div className="form-actions">
              <button
                className="button"
                type="button"
                onClick={() => void publish(true)}
              >
                Publish anyway
              </button>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setRecordChanged(false)}
              >
                Keep editing
              </button>
            </div>
          </div>
        ) : null}

        <details className="field-picker">
          <summary>
            Fields
            <span className="small">
              {' '}
              {visibleFields.length} of {editable.length} shown
            </span>
          </summary>
          <div className="field-picker-list">
            {editable.map((field) => (
              <label key={field.name} className="check">
                <input
                  type="checkbox"
                  checked={pinned(field) || fieldChoice.isShown(field.name, field.ui?.hidden)}
                  disabled={pinned(field)}
                  onChange={(event) =>
                    fieldChoice.set(field.name, event.target.checked)
                  }
                />
                <span>{field.ui?.label ?? field.name}</span>
              </label>
            ))}
            {fieldChoice.changed ? (
              <button
                type="button"
                className="button button-quiet"
                onClick={fieldChoice.reset}
              >
                Back to default
              </button>
            ) : null}
          </div>
        </details>

        <div className="fields">
          {visibleFields.map((field) => (
            <FieldInput
              key={field.name}
              connectionId={connectionId}
              canUpload={canEdit && detail.canStoreFiles === true}
              field={field}
              value={valueOf(field.name)}
              onChange={(value) => change(field.name, value)}
              disabled={!canEdit || (field.primaryKey === true && !isNew)}
              error={fieldErrors[field.name]}
            />
          ))}
        </div>

        {canEdit ? (
          <footer className="editor-foot">
            {confirm === 'discard' ? (
              <span className="confirm">
                <span>Throw away your unpublished changes?</span>
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => void discard()}
                >
                  Discard changes
                </button>
                <button
                  className="button button-quiet"
                  type="button"
                  onClick={() => setConfirm(null)}
                >
                  Keep
                </button>
              </span>
            ) : confirm === 'delete' ? (
              <span className="confirm">
                <span>
                  Delete this record from the database? This cannot be undone.
                </span>
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => void remove()}
                >
                  Delete record
                </button>
                <button
                  className="button button-quiet"
                  type="button"
                  onClick={() => setConfirm(null)}
                >
                  Keep
                </button>
              </span>
            ) : (
              <>
                {draft ? (
                  <button
                    className="button button-danger-quiet"
                    type="button"
                    onClick={() => setConfirm('discard')}
                  >
                    Discard changes
                  </button>
                ) : null}
                {!isNew && detail.access.delete ? (
                  <button
                    className="button button-danger-quiet"
                    type="button"
                    onClick={() => setConfirm('delete')}
                  >
                    Delete record
                  </button>
                ) : null}
              </>
            )}
          </footer>
        ) : null}
      </form>

      {previewOpen && draft ? (
        <PreviewPane
          connectionId={connectionId}
          collectionName={collectionName}
          draftId={draft.id}
          fields={detail.fields.filter((field) => !field.masked)}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * Heading for the editor: the first text field, using the freshest value
 * (typed, draft, then record).
 */
function titleOf(
  detail: CollectionDetail,
  record: RecordData | null,
  draft: DraftInfo | null,
  local: RecordData,
): string {
  const field = detail.fields.find(
    (candidate) =>
      !candidate.primaryKey &&
      (candidate.type === 'string' || candidate.type === 'text'),
  );
  if (!field) {
    return '';
  }
  const value =
    field.name in local
      ? local[field.name]
      : draft && field.name in draft.values
        ? draft.values[field.name]
        : record?.[field.name];
  return typeof value === 'string' ? value : '';
}
