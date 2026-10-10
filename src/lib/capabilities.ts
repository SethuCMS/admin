/**
 * Turns raw adapter capabilities into labelled grid cells.
 */

import type { ConnectionSummary } from '../api';

/** full = supported, partial = limited, none = unsupported. */
export type CellState = 'full' | 'partial' | 'none';

/** One cell of the capability grid. */
export interface CapabilityCell {
  key: string;
  label: string;
  state: CellState;
  /**
   * Plain-language explanation, shown as a tooltip and read by screen readers.
   */
  detail: string;
}

/** The columns of the capability grid, in display order. */
export const CAPABILITY_LABELS = [
  'Joins',
  'Transactions',
  'OR filters',
  'Inequality',
  'Full-text',
  'Realtime',
  'Writes',
] as const;

/**
 * Turn a connection's capabilities into the cells shown in the grid.
 * "Writes" is only on when both the database and the connection mode allow it.
 */
export function capabilityCells(
  connection: ConnectionSummary,
): CapabilityCell[] {
  const c = connection.capabilities;
  // Two gates: the adapter must support writes and the connection must not be
  // read-only.
  const writesOn = c.writes && connection.mode === 'read_write';

  return [
    {
      key: 'joins',
      label: 'Joins',
      state: c.joins ? 'full' : 'none',
      detail: c.joins
        ? 'Can combine collections in one query'
        : 'Cannot combine collections in one query',
    },
    {
      key: 'transactions',
      label: 'Transactions',
      state:
        c.transactions === 'multi-document'
          ? 'full'
          : c.transactions === 'single-document'
            ? 'partial'
            : 'none',
      detail:
        c.transactions === 'multi-document'
          ? 'Changes to several records can succeed or fail together'
          : c.transactions === 'single-document'
            ? 'Only changes to a single record are all-or-nothing'
            : 'No all-or-nothing changes',
    },
    {
      key: 'or',
      label: 'OR filters',
      state: c.filterOr ? 'full' : 'none',
      detail: c.filterOr
        ? 'Supports "this or that" filters'
        : 'Does not support "this or that" filters',
    },
    {
      key: 'inequality',
      label: 'Inequality',
      state:
        c.inequality === 'full'
          ? 'full'
          : c.inequality === 'single-field'
            ? 'partial'
            : 'none',
      detail:
        c.inequality === 'full'
          ? 'Supports greater-than and less-than filters on any fields'
          : c.inequality === 'single-field'
            ? 'Greater-than and less-than filters work on one field per query'
            : 'No greater-than or less-than filters',
    },
    {
      key: 'fulltext',
      label: 'Full-text',
      state: c.fullText ? 'full' : 'none',
      detail: c.fullText ? 'Supports text search' : 'No text search',
    },
    {
      key: 'realtime',
      label: 'Realtime',
      state: c.realtime ? 'full' : 'none',
      detail: c.realtime ? 'Can push live changes' : 'No live changes',
    },
    {
      key: 'writes',
      label: 'Writes',
      state: writesOn ? 'full' : 'none',
      detail: writesOn
        ? 'Editors can create, change and delete records'
        : c.writes
          ? 'Off: this connection is read-only'
          : 'Off: this database adapter cannot write',
    },
  ];
}
