/**
 * Content area: browse collections and edit records.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  gateway,
  type CollectionDetail,
  type CollectionSummary,
  type ConnectionListItem,
  type DraftInfo,
  type RecordData,
} from '../api';
import { useGatewayEvents } from '../auth';
import { setHeaderSearch, useHeaderSearch } from '../lib/headerSearch';
import { contentOnly } from '../lib/mode';
import { useSidebarOpen } from '../lib/sidebar';
import { contentHref, type Route } from '../router';
import { useAsync } from '../useAsync';
import { RecordEditor, targetFromParam } from './RecordEditor';

/**
 * The content variant of Route, with optional connection, collection and
 * record.
 */
type ContentRoute = Extract<Route, { name: 'content' }>;

/**
 * Three-pane editor: structure tree, record list and record editor. The URL
 * decides what is open, so every view is linkable. On narrow screens CSS uses
 * `data-depth` to show one pane at a time.
 */
export function ContentPage({ route }: { route: ContentRoute }) {
  // Bumping this changes the load key and so refetches the structure.
  const [round, setRound] = useState(0);
  // A collection list that fails to load becomes empty so one broken database
  // does not hide the others.
  const structure = useAsync(async (signal) => {
    const connections = await gateway.connections(signal);
    return Promise.all(
      connections.map(async (connection) => ({
        connection,
        collections: await gateway
          .collections(connection.id, signal)
          .catch(() => [] as CollectionSummary[]),
      })),
    );
  }, `structure:${round}`);

  // Refresh the tree when a connection is added, removed or changed.
  useGatewayEvents((event) => {
    if (event.type === 'connection.changed') {
      setRound((n) => n + 1);
    }
  });

  const sideOpen = useSidebarOpen();
  const depth = route.recordId
    ? 'record'
    : route.collection
      ? 'collection'
      : 'none';

  return (
    <div className="cms" data-depth={depth} data-side={sideOpen ? 'open' : 'closed'}>
      <nav id="cms-side" className="cms-side" aria-label="Content structure" hidden={!sideOpen}>
        <h1 className="cms-side-title">Content</h1>
        {structure.state.status === 'loading' ? (
          <p className="muted pad-s" aria-busy="true">
            Loading…
          </p>
        ) : null}
        {structure.state.status === 'error' ? (
          <p className="form-error pad-s" role="alert">
            {structure.state.message}
          </p>
        ) : null}
        {structure.state.status === 'ready' &&
        structure.state.data.length === 0 ? (
          <p className="muted pad-s">
            {contentOnly ? (
              'Nothing to edit yet. Ask an admin to connect a database.'
            ) : (
              <>
                No connections yet. <a href="#/connections">Add one</a> to
                start.
              </>
            )}
          </p>
        ) : null}
        {structure.state.status === 'ready'
          ? structure.state.data.map(({ connection, collections }) => (
              <Group
                key={connection.id}
                connection={connection}
                collections={collections}
                route={route}
              />
            ))
          : null}
      </nav>

      {route.connectionId && route.collection ? (
        <CollectionArea
          key={`${route.connectionId}:${route.collection}`}
          connectionId={route.connectionId}
          collectionName={route.collection}
          recordParam={route.recordId}
        />
      ) : (
        <section className="cms-area cms-area-empty">
          <p className="muted">Choose a collection on the left to see its records.</p>
        </section>
      )}
    </div>
  );
}

/** One connection and its collections in the structure pane. */
function Group({
  connection,
  collections,
  route,
}: {
  connection: ConnectionListItem;
  collections: CollectionSummary[];
  route: ContentRoute;
}) {
  return (
    <section className="group" aria-labelledby={`g-${connection.id}`}>
      <h2 id={`g-${connection.id}`} className="group-title">
        {connection.name}
        <span className={`mode mode-${connection.mode}`}>
          {connection.mode === 'read_only' ? 'Read-only' : 'Read and write'}
        </span>
      </h2>
      {collections.length === 0 ? (
        <p className="muted small pad-s">
          {connection.status === 'error'
            ? 'Not reachable right now.'
            : 'No collections in the API yet.'}
        </p>
      ) : (
        <ul className="nav-list">
          {collections.map((collection) => (
            <li key={collection.name}>
              <a
                className="nav-link"
                href={contentHref(connection.id, collection.name)}
                aria-current={
                  route.connectionId === connection.id &&
                  route.collection === collection.name
                    ? 'page'
                    : undefined
                }
              >
                {collection.displayName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Loads a collection's schema and access, then shows its list and editor. Keyed
 * by connection and collection so state resets when switching.
 */
function CollectionArea({
  connectionId,
  collectionName,
  recordParam,
}: {
  connectionId: string;
  collectionName: string;
  recordParam?: string | undefined;
}) {
  const detail = useAsync(
    (signal) => gateway.collection(connectionId, collectionName, signal),
    `detail:${connectionId}:${collectionName}`,
  );

  if (detail.state.status === 'loading') {
    return (
      <section className="cms-area cms-area-empty" aria-busy="true">
        <p className="muted">Loading…</p>
      </section>
    );
  }
  if (detail.state.status === 'error') {
    return (
      <section className="cms-area cms-area-empty">
        <p className="form-error" role="alert">
          {detail.state.message}
        </p>
      </section>
    );
  }
  const collection = detail.state.data;
  return (
    <CollectionView
      connectionId={connectionId}
      collectionName={collectionName}
      collection={collection}
      recordParam={recordParam}
    />
  );
}

/**
 * The right-hand side: a bar with the collection name and actions, then the
 * record list and the editor. The search box is in the top bar.
 */
function CollectionView({
  connectionId,
  collectionName,
  collection,
  recordParam,
}: {
  connectionId: string;
  collectionName: string;
  collection: CollectionDetail;
  recordParam?: string | undefined;
}) {
  const titleField = titleFieldOf(collection);
  const [newestFirst, setNewestFirst] = useState(true);
  // The search box is in the top bar; this collection says what it is for.
  const { value: search } = useHeaderSearch();
  const [query, setQuery] = useState('');
  const titleName = titleField?.name;
  useEffect(() => {
    setHeaderSearch({
      placeholder: titleName ? `Search ${collection.name} by ${titleName}` : null,
      value: '',
    });
    return () => setHeaderSearch({ placeholder: null, value: '' });
  }, [collection.name, titleName]);

  useEffect(() => {
    // Debounce typing so each keystroke does not hit the gateway.
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <section className="cms-area" aria-label={`${collection.name} content`}>
      <header className="cms-toolbar">
        <div className="cms-toolbar-title">
          <a className="back-link" href="#/content">
            All content
          </a>
          <h2>{collection.ui?.title ?? collection.name}</h2>
        </div>
        <div className="cms-toolbar-actions">
          <button
            className="button button-small button-quiet"
            type="button"
            onClick={() => setNewestFirst((value) => !value)}
            aria-label={`Order: ${newestFirst ? 'newest first' : 'oldest first'}. Change order`}
          >
            {newestFirst ? 'Newest first' : 'Oldest first'}
          </button>
          {collection.access.create ? (
            <a
              className="button button-small"
              // "~" prefixes mark drafts in the URL; "~new" starts a blank one.
              href={contentHref(connectionId, collection.name, '~new')}
            >
              New
            </a>
          ) : null}
        </div>
      </header>

      <div className="cms-work" data-open={recordParam ? 'record' : 'list'}>
        <RecordList
          connectionId={connectionId}
          detail={collection}
          selected={recordParam}
          query={query}
          newestFirst={newestFirst}
        />
        {recordParam ? (
          <section className="cms-editor">
            <RecordEditor
              connectionId={connectionId}
              collectionName={collectionName}
              detail={collection}
              target={targetFromParam(recordParam)}
            />
          </section>
        ) : (
          <section className="cms-editor cms-editor-empty">
            <p className="muted">
              Choose a record to edit it
              {collection.access.create ? ', or create a new one' : ''}.
            </p>
          </section>
        )}
      </div>
    </section>
  );
}

// Records fetched per request.
const PAGE_SIZE = 25;

/**
 * The field used as a record's label and search target: the first visible text
 * field that is not the key.
 */
function titleFieldOf(detail: CollectionDetail) {
  const coded = detail.ui?.titleField;
  const chosen = coded
    ? detail.fields.find((field) => field.name === coded && !field.masked)
    : undefined;
  return chosen ?? detail.fields.find(
    (field) =>
      !field.primaryKey &&
      !field.masked &&
      (field.type === 'string' || field.type === 'text'),
  );
}

/**
 * Searchable, sortable, paged list of records, with draft status shown
 * alongside. Updates itself when other editors change the collection.
 */
function RecordList({
  connectionId,
  detail,
  selected,
  query,
  newestFirst,
}: {
  connectionId: string;
  detail: CollectionDetail;
  selected?: string | undefined;
  query: string;
  newestFirst: boolean;
}) {
  // Sort and identify records by the primary key; fall back to "id".
  const key = detail.fields.find((field) => field.primaryKey)?.name ?? 'id';
  const titleField = titleFieldOf(detail);
  const [items, setItems] = useState<RecordData[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('');
  // Counter that lets a slow, outdated response be recognised and ignored.
  const generation = useRef(0);

  const load = useCallback(
    async (from: string | null) => {
      // Claim this request; if another starts, this one is stale.
      const mine = ++generation.current;
      if (from === null) {
        setStatus('loading');
      }
      try {
        const filter =
          query && titleField
            ? { field: titleField.name, op: 'contains', value: query }
            : undefined;
        const [page, draftList] = await Promise.all([
          gateway.records(connectionId, detail.name, {
            limit: PAGE_SIZE,
            sort: `${newestFirst ? '-' : ''}${key}`,
            cursor: from,
            filter,
          }),
          // Drafts are fetched only with the first page, and only for people
          // who can edit.
          from === null && (detail.access.update || detail.access.create)
            ? gateway
                .drafts(connectionId, detail.name)
                .catch(() => [] as DraftInfo[])
            : Promise.resolve(null),
        ]);
        // Stale: a newer request owns the state.
        if (mine !== generation.current) {
          return;
        }
        // First page replaces the list; later pages append.
        setItems((previous) =>
          from === null ? page.data : [...previous, ...page.data],
        );
        setCursor(page.page.nextCursor);
        if (draftList) {
          setDrafts(draftList);
        }
        setStatus('ready');
      } catch (error) {
        if (mine !== generation.current) {
          return;
        }
        setMessage(
          error instanceof Error
            ? error.message
            : 'The records could not be loaded.',
        );
        setStatus('error');
      }
    },
    [connectionId, detail, key, newestFirst, query, titleField],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  // Refresh when something changes through the gateway (this or another
  // editor).
  useGatewayEvents((event) => {
    if (
      'collection' in event &&
      event.connectionId === connectionId &&
      event.collection === detail.name
    ) {
      void load(null);
    }
  });

  // Drafts with edits, keyed by record id, to flag unpublished changes.
  const draftByRecord = new Map(
    drafts
      .filter((draft) => draft.recordId && Object.keys(draft.values).length > 0)
      .map((draft) => [draft.recordId as string, draft]),
  );
  // Drafts with no record yet (created but never published).
  const newDrafts = drafts.filter((draft) => draft.recordId === null);

  return (
    <section className="cms-list" aria-label={`${detail.name} records`}>
      {status === 'loading' ? (
        <p className="muted pad" aria-busy="true">
          Loading…
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="form-error pad" role="alert">
          {message}
        </p>
      ) : null}

      {status === 'ready' ? (
        <ul className="record-list">
          {newDrafts.map((draft) => (
            <li key={draft.id}>
              <a
                className="record"
                href={contentHref(connectionId, detail.name, `~${draft.id}`)}
                aria-current={selected === `~${draft.id}` ? 'true' : undefined}
              >
                <span className="record-title">
                  {titleField &&
                  typeof draft.values[titleField.name] === 'string' &&
                  draft.values[titleField.name] !== ''
                    ? String(draft.values[titleField.name])
                    : 'Untitled'}
                </span>
                <span className="status status-draft">New draft</span>
              </a>
            </li>
          ))}
          {items.map((record) => {
            const id = String(record[key]);
            const draft = draftByRecord.get(id);
            // Prefer the draft's title so the list reflects pending edits.
            const shown =
              draft &&
              titleField &&
              typeof draft.values[titleField.name] === 'string'
                ? String(draft.values[titleField.name])
                : titleField
                  ? String(record[titleField.name] ?? '')
                  : '';
            return (
              <li key={id}>
                <a
                  className="record"
                  href={contentHref(connectionId, detail.name, id)}
                  aria-current={selected === id ? 'true' : undefined}
                >
                  <span className="record-title">{shown || `#${id}`}</span>
                  <span className="record-meta">
                    <span className="muted small mono">#{id}</span>
                    {draft ? (
                      <span className="status status-draft">
                        Unpublished changes
                      </span>
                    ) : null}
                  </span>
                </a>
              </li>
            );
          })}
          {items.length === 0 && newDrafts.length === 0 ? (
            <li className="muted pad">
              {query ? 'Nothing matches your search.' : 'No records yet.'}
            </li>
          ) : null}
        </ul>
      ) : null}

      {status === 'ready' && cursor ? (
        <div className="pad">
          <button
            className="button button-outline button-small"
            type="button"
            onClick={() => void load(cursor)}
          >
            Load more
          </button>
        </div>
      ) : null}
    </section>
  );
}
