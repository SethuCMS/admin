/**
 * Live preview of a draft, fed by a signed preview link.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  absoluteUrl,
  gateway,
  type FieldInfo,
  type PreviewLink,
  type RecordData,
} from '../api';

/** Which draft to preview and how to close the pane. */
interface PreviewPaneProps {
  connectionId: string;
  collectionName: string;
  draftId: string;
  fields: FieldInfo[];
  onClose: () => void;
}

/** State of the live preview stream. */
type Connection = 'connecting' | 'live' | 'reconnecting' | 'ended';

/**
 * A live view of the draft. It opens the same signed preview link a website
 * would use, so what you see here is what your site would receive.
 */
export function PreviewPane({
  connectionId,
  collectionName,
  draftId,
  fields,
  onClose,
}: PreviewPaneProps) {
  const [link, setLink] = useState<PreviewLink | null>(null);
  const [data, setData] = useState<RecordData | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [round, setRound] = useState(0);
  // Timer for the brief highlight when new data arrives.
  const flash = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    // EventSource suffices here: the signed preview link carries its own
    // authorisation, unlike the main event stream which needs a header.
    let source: EventSource | undefined;
    let cancelled = false;
    setConnection('connecting');
    setError(null);

    gateway
      .previewLink(connectionId, collectionName, draftId)
      .then((created) => {
        // The pane closed before the link arrived; do not open a stream.
        if (cancelled) {
          return;
        }
        setLink(created);
        source = new EventSource(absoluteUrl(`${created.path}/events`));

        const receive = (event: MessageEvent<string>) => {
          try {
            const payload = JSON.parse(event.data) as { data: RecordData };
            setData(payload.data);
            setConnection('live');
            setJustUpdated(true);
            clearTimeout(flash.current);
            flash.current = setTimeout(() => setJustUpdated(false), 900);
          } catch {
            // Ignore a malformed message.
          }
        };
        // The gateway may use any of these event names for a draft snapshot.
        for (const name of ['draft', 'draft.updated', 'draft.published']) {
          source.addEventListener(name, receive as EventListener);
        }
        // The gateway sends this when the link expires; stop the browser's
        // automatic retry.
        source.addEventListener('closed', () => {
          setConnection('ended');
          source?.close();
        });
        // EventSource retries on its own, so just show "reconnecting" unless it
        // has ended.
        source.onerror = () =>
          setConnection((current) =>
            current === 'ended' ? current : 'reconnecting',
          );
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'The preview could not start.',
          );
        }
      });

    return () => {
      cancelled = true;
      source?.close();
      clearTimeout(flash.current);
    };
    // `round` forces a fresh link after expiry.
  }, [connectionId, collectionName, draftId, round]);

  // Clipboard access can be blocked, so fall back to manual copy.
  const copy = useCallback(async () => {
    if (!link) {
      return;
    }
    try {
      await navigator.clipboard.writeText(absoluteUrl(link.path));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(
        'Copying is blocked by the browser. Select the address below and copy it by hand.',
      );
    }
  }, [link]);

  // Same idea as the record list: first text field is the heading.
  const titleField = fields.find(
    (field) =>
      !field.primaryKey && (field.type === 'string' || field.type === 'text'),
  );
  const title = data && titleField ? String(data[titleField.name] ?? '') : '';
  const label = {
    connecting: 'Connecting…',
    live: 'Live',
    reconnecting: 'Reconnecting…',
    ended: 'Preview ended',
  }[connection];

  return (
    <aside className="preview" aria-label="Live preview">
      <header className="preview-head">
        <h2>Live preview</h2>
        <span className={`live live-${connection}`}>
          <span className="live-dot" aria-hidden="true" />
          {label}
        </span>
        <button
          className="button button-small button-quiet"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {connection === 'ended' ? (
        <p className="notice" role="status">
          This preview link has expired.{' '}
          <button
            className="link-button"
            type="button"
            onClick={() => setRound((n) => n + 1)}
          >
            Start a new preview
          </button>
        </p>
      ) : null}

      <article
        className={`preview-card${justUpdated ? ' preview-updated' : ''}`}
        aria-live="polite"
      >
        {data === null ? (
          <p className="muted">Waiting for the draft…</p>
        ) : (
          <>
            {title ? <h3>{title}</h3> : null}
            <dl>
              {fields
                .filter(
                  (field) =>
                    field.name !== titleField?.name &&
                    data[field.name] !== undefined,
                )
                .map((field) => (
                  <div key={field.name}>
                    <dt>{field.name}</dt>
                    <dd>{display(data[field.name])}</dd>
                  </div>
                ))}
            </dl>
          </>
        )}
      </article>

      {link ? (
        <div className="preview-share">
          <p className="small muted">
            Use this address in your website to show the draft there. It works
            without an API token and stops working at{' '}
            {new Date(link.expiresAt).toLocaleTimeString()}.
          </p>
          <input
            className="input mono small"
            readOnly
            value={absoluteUrl(link.path)}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Preview address"
          />
          <button
            className="button button-small button-outline"
            type="button"
            onClick={copy}
          >
            {copied ? 'Copied' : 'Copy address'}
          </button>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * Show a value as plain text in the preview.
 */
function display(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
