/**
 * Capability grid: one row of squares per connection.
 */

import { CAPABILITY_LABELS, capabilityCells } from '../lib/capabilities';
import type { ConnectionSummary } from '../api';

/** Header row for the grid. Rendered once above the list of connections. */
export function CapabilityHeader() {
  return (
    <div className="cap-header" aria-hidden="true">
      {CAPABILITY_LABELS.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  );
}

/**
 * One connection's capabilities as a row of squares: filled, half, or open.
 * Each cell also carries visually hidden text, since the squares alone mean
 * nothing to screen readers.
 */
export function CapabilityRow({
  connection,
  rowIndex,
}: {
  connection: ConnectionSummary;
  rowIndex: number;
}) {
  const cells = capabilityCells(connection);

  return (
    <ul className="cap-row" aria-label={`What ${connection.name} supports`}>
      {cells.map((cell, columnIndex) => (
        <li
          key={cell.key}
          className={`cap-cell cap-${cell.state}`}
          title={`${cell.label}: ${cell.detail}`}
          // Staggers the entrance animation by row and column via a CSS
          // variable.
          style={{
            ['--delay' as string]: `${rowIndex * 90 + columnIndex * 35}ms`,
          }}
        >
          <span className="cap-square" aria-hidden="true" />
          <span className="visually-hidden">
            {cell.label}:{' '}
            {cell.state === 'full'
              ? 'yes'
              : cell.state === 'partial'
                ? 'partly'
                : 'no'}
            . {cell.detail}.
          </span>
          <span className="cap-name" aria-hidden="true">
            {cell.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Key explaining the three square styles used by the rows. */
export function CapabilityLegend() {
  const items: Array<[string, string]> = [
    ['cap-full', 'Supported'],
    ['cap-partial', 'Partly supported'],
    ['cap-none', 'Not available'],
  ];
  return (
    <ul className="legend" aria-label="Legend">
      {items.map(([state, label]) => (
        <li key={state}>
          <span className={`cap-square ${state}`} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}
