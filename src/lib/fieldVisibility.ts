/**
 * Which fields of a collection the person wants to see in the editor.
 *
 * Nothing is hidden for good: hidden fields keep their stored values and are
 * saved unchanged. The choice is remembered in this browser only, per
 * connection and collection. Until the person chooses, fields that sync tools
 * add for bookkeeping (names starting with sanity_) stay out of the way.
 */
import { useCallback, useState } from 'react';

const bookkeeping = (name: string): boolean => /^sanity_/i.test(name);

const keyOf = (connectionId: string, collection: string): string =>
  `sethucms.fields.${connectionId}.${collection}`;

type Choices = Record<string, boolean>;

function load(key: string): Choices {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Choices) : {};
  } catch {
    return {};
  }
}

export interface FieldVisibility {
  /** `hiddenByCode` is the schema file's default for the field, if it has one. */
  isShown: (name: string, hiddenByCode?: boolean) => boolean;
  set: (name: string, shown: boolean) => void;
  reset: () => void;
  /** True when the person has changed anything from the defaults. */
  changed: boolean;
}

export function useFieldVisibility(
  connectionId: string,
  collection: string,
): FieldVisibility {
  const key = keyOf(connectionId, collection);
  const [choices, setChoices] = useState<Choices>(() => load(key));

  const save = useCallback(
    (next: Choices) => {
      setChoices(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* the choice then lasts until the page is closed */
      }
    },
    [key],
  );

  return {
    isShown: (name, hiddenByCode) =>
      choices[name] ?? !(hiddenByCode ?? bookkeeping(name)),
    set: (name, shown) => save({ ...choices, [name]: shown }),
    reset: () => save({}),
    changed: Object.keys(choices).length > 0,
  };
}
