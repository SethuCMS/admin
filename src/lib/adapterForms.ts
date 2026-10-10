/**
 * Per-database connection form definitions and their conversion to the gateway
 * payload.
 */

/**
 * What to ask for when adding a connection, per database type.
 *
 * Settings go to `config` (shown in the admin, written to the audit log).
 * Secrets go to `credentials` (encrypted, never shown again).
 */
export interface FormField {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'password' | 'secret-text' | 'check';
  where: 'config' | 'credentials';
  default?: string | boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  mono?: boolean;
  /** Share a row with the next field. */
  pair?: boolean;
}

export interface AdapterForm {
  intro?: string;
  fields: FormField[];
}

// Adapters name this option `ssl` or `tls`; defaults to on so a new connection
// is encrypted unless the user opts out.
const tls = (key: 'ssl' | 'tls'): FormField => ({
  key,
  label:
    'Encrypt the connection (TLS). Turn off only for a database on your own machine.',
  kind: 'check',
  where: 'config',
  default: true,
});

/**
 * Form definitions keyed by adapter id (matches `ConnectionSummary.adapter`).
 */
export const ADAPTER_FORMS: Record<string, AdapterForm> = {
  postgres: {
    fields: [
      {
        key: 'host',
        label: 'Host',
        kind: 'text',
        where: 'config',
        required: true,
        placeholder: 'db.example.com',
        mono: true,
        pair: true,
      },
      {
        key: 'port',
        label: 'Port',
        kind: 'number',
        where: 'config',
        default: '5432',
        required: true,
        mono: true,
      },
      {
        key: 'database',
        label: 'Database',
        kind: 'text',
        where: 'config',
        required: true,
        mono: true,
        pair: true,
      },
      {
        key: 'schema',
        label: 'Schema',
        kind: 'text',
        where: 'config',
        default: 'public',
        required: true,
        mono: true,
      },
      {
        key: 'user',
        label: 'User',
        kind: 'text',
        where: 'credentials',
        required: true,
        mono: true,
        pair: true,
      },
      {
        key: 'password',
        label: 'Password',
        kind: 'password',
        where: 'credentials',
        hint: 'Stored encrypted. It is never shown again.',
      },
      tls('ssl'),
    ],
  },
  mysql: {
    intro: 'Works with MySQL and MariaDB.',
    fields: [
      {
        key: 'host',
        label: 'Host',
        kind: 'text',
        where: 'config',
        required: true,
        placeholder: 'db.example.com',
        mono: true,
        pair: true,
      },
      {
        key: 'port',
        label: 'Port',
        kind: 'number',
        where: 'config',
        default: '3306',
        required: true,
        mono: true,
      },
      {
        key: 'database',
        label: 'Database',
        kind: 'text',
        where: 'config',
        required: true,
        mono: true,
      },
      {
        key: 'user',
        label: 'User',
        kind: 'text',
        where: 'credentials',
        required: true,
        mono: true,
        pair: true,
      },
      {
        key: 'password',
        label: 'Password',
        kind: 'password',
        where: 'credentials',
        hint: 'Stored encrypted. It is never shown again.',
      },
      tls('ssl'),
    ],
  },
  mongodb: {
    intro:
      'MongoDB has no fixed structure, so fields are worked out from a sample of documents. For read-only use, give SethuCMS a database user that can only read.',
    fields: [
      {
        key: 'host',
        label: 'Host',
        kind: 'text',
        where: 'config',
        required: true,
        placeholder: 'cluster0.example.mongodb.net',
        mono: true,
        pair: true,
      },
      {
        key: 'port',
        label: 'Port',
        kind: 'number',
        where: 'config',
        default: '27017',
        mono: true,
      },
      {
        key: 'srv',
        label:
          'This is a mongodb+srv address (MongoDB Atlas). The port is not used.',
        kind: 'check',
        where: 'config',
        default: false,
      },
      {
        key: 'database',
        label: 'Database',
        kind: 'text',
        where: 'config',
        required: true,
        mono: true,
        pair: true,
      },
      {
        key: 'authSource',
        label: 'Login database',
        kind: 'text',
        where: 'config',
        default: 'admin',
        mono: true,
      },
      {
        key: 'user',
        label: 'User',
        kind: 'text',
        where: 'credentials',
        mono: true,
        pair: true,
      },
      {
        key: 'password',
        label: 'Password',
        kind: 'password',
        where: 'credentials',
        hint: 'Stored encrypted. It is never shown again.',
      },
      tls('tls'),
    ],
  },
  sqlite: {
    intro: 'A SQLite file stored on the machine that runs the gateway.',
    fields: [
      {
        key: 'path',
        label: 'File',
        kind: 'text',
        where: 'config',
        required: true,
        placeholder: 'site.db',
        mono: true,
        hint: 'A file name inside the gateway’s SQLite folder. Use :memory: for a temporary database.',
      },
    ],
  },
  firestore: {
    intro:
      'Firestore has no fixed structure, so fields are worked out from a sample of documents. Searching inside text reads the whole collection, so it only works on smaller ones.',
    fields: [
      {
        key: 'projectId',
        label: 'Project id',
        kind: 'text',
        where: 'config',
        required: true,
        placeholder: 'my-project-1234',
        mono: true,
        pair: true,
      },
      {
        key: 'databaseId',
        label: 'Database',
        kind: 'text',
        where: 'config',
        default: '(default)',
        mono: true,
      },
      {
        key: 'serviceAccount',
        label: 'Service account key (JSON)',
        kind: 'secret-text',
        where: 'credentials',
        hint: 'Paste the key file. Stored encrypted. It is never shown again. For read-only use, create the key from a service account that can only read.',
      },
    ],
  },
};

/**
 * Starting form values: each field's default, else false for checkboxes and an
 * empty string.
 */
export function initialValues(
  form: AdapterForm | undefined,
): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const field of form?.fields ?? []) {
    values[field.key] = field.default ?? (field.kind === 'check' ? false : '');
  }
  return values;
}

/**
 * Turn the form into the `config` and `credentials` the gateway expects. Empty
 * optional fields are left out.
 */
export function buildSettings(
  form: AdapterForm,
  values: Record<string, string | boolean>,
): { config: Record<string, unknown>; credentials: Record<string, unknown> } {
  const config: Record<string, unknown> = {};
  const credentials: Record<string, unknown> = {};
  for (const field of form.fields) {
    const raw = values[field.key];
    let value: unknown;
    if (field.kind === 'check') {
      value = raw === true;
      // Skip blank optional fields so the gateway applies its own defaults.
    } else if (typeof raw !== 'string' || raw.trim() === '') {
      continue;
    } else if (field.kind === 'number') {
      value = Number(raw);
    } else if (field.kind === 'secret-text') {
      value = raw.trim();
    } else {
      // Passwords are sent untrimmed because spaces may be significant.
      value = field.kind === 'password' ? raw : raw.trim();
    }
    // Credentials are sent separately so the gateway can encrypt them.
    (field.where === 'config' ? config : credentials)[field.key] = value;
  }
  return { config, credentials };
}
