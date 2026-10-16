/**
 * The schema file as the gateway loaded it: read-only. The file is edited in
 * your own editor, like any other code, and the gateway reads it on start.
 */
import { gateway } from '../api';
import { useAsync } from '../useAsync';

export function SchemaPanel() {
  const { state: report } = useAsync((signal) => gateway.schema(signal), 'schema');
  if (report.status === 'error') {
    return null;
  }
  if (report.status !== 'ready') {
    return <p className="muted">Loading schema…</p>;
  }
  const data = report.data;
  return (
    <section className="schema-panel" aria-label="Schema">
      <h2>Schema</h2>
      {!data.configured ? (
        <p className="muted">
          No schema file. Fields come from your database as they are. Point{' '}
          <code>SETHUCMS_SCHEMA_FILE</code> at a <code>.json</code> or{' '}
          <code>.mjs</code> file to name fields, choose editors and hide the
          ones you don’t want in the form.
        </p>
      ) : (
        <>
          <p>
            Loaded from <code>{data.source}</code>. Change the file and restart
            the gateway to apply it.
          </p>
          {data.checks?.map((check) => (
            <div key={check.connectionId}>
              {check.error ? (
                <p className="field-error">{check.name}: {check.error}</p>
              ) : check.notes.length > 0 ? (
                <>
                  <p>Where {check.name} differs from the file:</p>
                  <ul>
                    {check.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">{check.name} matches the file.</p>
              )}
            </div>
          ))}
          {data.collections?.map((collection) => (
            <details key={collection.name} className="schema-collection">
              <summary>
                {collection.title ?? collection.name}
                <span className="small">
                  {' '}
                  {collection.fields?.length ?? 0} fields
                  {collection.strict ? ', only these shown' : ''}
                </span>
              </summary>
              <pre className="mono">
                {JSON.stringify(collection, null, 2)}
              </pre>
            </details>
          ))}
        </>
      )}
    </section>
  );
}
