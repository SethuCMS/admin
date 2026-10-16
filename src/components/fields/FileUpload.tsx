/**
 * Upload, preview and replace for fields that hold an image or a file.
 */
import { useEffect, useState } from 'react';
import { gateway } from '../../api';

/** The file types the gateway accepts, for the file chooser. */
const ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf';

const FILE_FIELD_NAME = /image|file|icon|logo|photo|picture|avatar|cover|thumb|pdf|resume|document|attachment/i;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A JSON field that holds a file: it already has a link or an asset reference,
 * or it is empty and named like a file field.
 */
export function showsFile(name: string, value: unknown): boolean {
  if (isObject(value)) {
    return typeof value['url'] === 'string' || 'asset' in value;
  }
  return (value === null || value === undefined) && FILE_FIELD_NAME.test(name);
}

/** Whether a stored link is a PDF (shown as a link, not a picture). */
const looksLikePdf = (value: Record<string, unknown>): boolean => {
  const url = typeof value['url'] === 'string' ? value['url'] : '';
  return value['contentType'] === 'application/pdf' || /\.pdf(\?|$)/i.test(url);
};

/**
 * Shows the file a JSON field points at and lets the person replace it. The
 * file goes into the connected database; the field keeps only its link.
 */
export function FileUpload({
  connectionId,
  value,
  onChange,
  canUpload,
}: {
  connectionId: string;
  value: unknown;
  onChange: (value: unknown) => void;
  canUpload: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // The link that failed to load as a picture, so it is shown as a plain link.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const current = isObject(value) ? value : null;
  // Private files need the signed-in token to open, so they are shown through it.
  const [makePrivate, setMakePrivate] = useState(current?.['access'] === 'private');
  const isPrivate = current?.['access'] === 'private';
  // Only web links are ever used as a link or picture source, so a stored
  // "javascript:" or "data:" value is ignored instead of being opened.
  const rawUrl = current && typeof current['url'] === 'string' ? current['url'] : null;
  const url = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : null;

  const choose = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const stored = await gateway.uploadFile(
        connectionId,
        file,
        makePrivate ? 'private' : 'public',
      );
      // Keep what the person already wrote (for example alt text); replace the file.
      const { asset: _asset, ...rest } = current ?? {};
      onChange({
        ...rest,
        url: stored.url,
        fileId: stored.id,
        name: stored.name,
        contentType: stored.contentType,
        access: stored.access,
      });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="file-field">
      {url && current ? (
        // Try to show it as a picture; anything that is not one falls back to a link.
        isPrivate ? (
          <PrivateFile url={url} pdf={looksLikePdf(current)} />
        ) : looksLikePdf(current) || brokenUrl === url ? (
          <a className="file-link" href={url} target="_blank" rel="noreferrer">
            Open file
          </a>
        ) : (
          <img
            className="file-preview"
            src={url}
            alt=""
            loading="lazy"
            onError={() => setBrokenUrl(url)}
          />
        )
      ) : (
        <span className="muted small">No file yet.</span>
      )}
      {canUpload ? (
        <label className="check small" title="A private file only opens for people who are signed in.">
          <input
            type="checkbox"
            checked={makePrivate}
            disabled={busy}
            onChange={(event) => setMakePrivate(event.target.checked)}
          />
          <span>Private</span>
        </label>
      ) : null}
      {canUpload ? (
        <label className={`button button-small button-outline${busy ? ' is-busy' : ''}`}>
          {busy ? 'Uploading…' : url ? 'Replace file' : 'Upload file'}
          <input
            className="visually-hidden"
            type="file"
            accept={ACCEPT}
            disabled={busy}
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              // Allow choosing the same file again.
              event.target.value = '';
            }}
          />
        </label>
      ) : null}
      {problem ? (
        <span className="field-error" role="alert">
          {problem}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A private file cannot be opened by a plain link, so it is fetched with the
 * signed-in token. A picture is shown from that download; a PDF opens in a new tab.
 */
function PrivateFile({ url, pdf }: { url: string; pdf: boolean }) {
  const [picture, setPicture] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (pdf) {
      return;
    }
    const controller = new AbortController();
    let made: string | null = null;
    gateway
      .fetchFile(url, controller.signal)
      .then((blob) => {
        made = URL.createObjectURL(blob);
        setPicture(made);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setProblem('This private file could not be opened.');
        }
      });
    return () => {
      controller.abort();
      if (made) {
        URL.revokeObjectURL(made);
      }
    };
  }, [url, pdf]);

  const openPdf = async () => {
    setProblem(null);
    try {
      const blob = await gateway.fetchFile(url);
      const address = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(address, '_blank');
      // The new tab has what it needs once it has loaded; free the memory later.
      window.setTimeout(() => URL.revokeObjectURL(address), 60_000);
    } catch {
      setProblem('This private file could not be opened.');
    }
  };

  return (
    <>
      {pdf ? (
        <button type="button" className="file-link link-button" onClick={() => void openPdf()}>
          Open private file
        </button>
      ) : picture ? (
        <img className="file-preview" src={picture} alt="" />
      ) : problem ? null : (
        <span className="muted small">Opening…</span>
      )}
      <span className="muted small">Private</span>
      {problem ? (
        <span className="field-error" role="alert">
          {problem}
        </span>
      ) : null}
    </>
  );
}
