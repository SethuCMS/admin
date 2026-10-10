/**
 * Placeholder page with a way back home.
 */

/**
 * Placeholder page for unbuilt, unavailable or admin-only routes.
 */
export function ComingNext({
  title,
  message,
}: {
  title: string;
  message?: string;
}) {
  return (
    <div className="page">
      <h1 className="page-title">{title}</h1>
      <p className="muted">{message ?? 'This page has not been built yet.'}</p>
      <p>
        <a className="button button-quiet" href="#/">
          Back to home
        </a>
      </p>
    </div>
  );
}
