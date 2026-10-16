/**
 * The shapes the gateway sends and receives. Types only: nothing here runs.
 */

// ---- Types ---------------------------------------------------------------

/** Permission level; the gateway enforces it, the UI only hides actions. */
export type Role = 'admin' | 'editor' | 'viewer';

/** The signed-in person. */
export interface Me {
  id: string;
  name: string;
  role: Role;
}

/** One field of a collection, including what this person may see or edit. */
export interface FieldInfo {
  name: string;
  type:
    | 'string'
    | 'text'
    | 'integer'
    | 'decimal'
    | 'boolean'
    | 'datetime'
    | 'date'
    | 'json'
    | 'array'
    | 'reference'
    | 'binary'
    | 'geopoint';
  required?: boolean;
  primaryKey?: boolean;
  generated?: boolean;
  readOnly?: boolean;
  references?: string;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: Array<string | number>;
  };
  /** The value is hidden from this person (shown as asterisks). */
  masked: boolean;
  /** This person may change the field. */
  editable: boolean;
  /** How the schema file wants the field shown, when it says anything. */
  ui?: FieldUi;
}

/** Display wishes from the gateway's schema file. */
export interface FieldUi {
  label?: string;
  description?: string;
  widget?: 'text' | 'textarea' | 'code' | 'image' | 'file';
  hidden?: boolean;
}

/** The schema file as an admin sees it, with where it differs from each database. */
export interface SchemaReport {
  configured: boolean;
  source?: string;
  collections?: Array<{
    name: string;
    title?: string;
    titleField?: string;
    strict?: boolean;
    fields?: Array<FieldUi & { name: string; type?: string; readOnly?: boolean; required?: boolean }>;
  }>;
  checks?: Array<{ connectionId: string; name: string; notes: string[]; error?: string }>;
}

/** A collection with its fields and what this person may do. */
export interface CollectionDetail {
  name: string;
  /** Title and title field from the schema file. */
  ui?: { title?: string; titleField?: string };
  fields: FieldInfo[];
  access: { create: boolean; update: boolean; delete: boolean };
  mode: 'read_only' | 'read_write';
  /** Images and PDFs can be uploaded to this connection (Firestore). */
  canStoreFiles?: boolean;
}

/** A file stored in the database, as the gateway describes it. */
export interface UploadedFile {
  id: string;
  name: string;
  contentType: string;
  size: number;
  /** Address on the gateway. Public files open for anyone; private ones need a sign-in. */
  url: string;
  access: 'public' | 'private';
}

/** A collection as listed, without per-person access. */
export interface CollectionSummary {
  name: string;
  displayName: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    primaryKey: boolean;
  }>;
}

/** A connection as listed for content editors. */
export interface ConnectionListItem {
  id: string;
  name: string;
  adapterType: string;
  mode: 'read_only' | 'read_write';
  status: string;
}

// ---- Migration -----------------------------------------------------------

/** What to move and how to handle conflicts. */
export interface MigrationOptions {
  source: string;
  target: string;
  onConflict?: 'skip' | 'overwrite' | 'fail';
  preserveIds?: boolean;
  createMissing?: boolean;
  dropUnmappedFields?: boolean;
  collections?: Array<
    string | { from: string; to?: string; fields?: Record<string, string> }
  >;
}

/** Dry-run result for one collection. */
export interface MigrationCollectionPlan {
  from: string;
  to: string;
  idsPreserved: boolean;
  /** The target collection does not exist and will be created. */
  create: boolean;
  leftBehind: string[];
  problems: string[];
  warnings: string[];
  sourceRecords: { count: number; exact: boolean } | null;
  targetRecords: { count: number; exact: boolean } | null;
}

/** Dry-run result; `ready` is false when blocking problems exist. */
export interface MigrationPlan {
  source: { id: string; name: string; adapter: string };
  target: { id: string; name: string; adapter: string };
  collections: MigrationCollectionPlan[];
  problems: string[];
  warnings: string[];
  ready: boolean;
}

/** Live counters for one collection during a migration. */
export interface MigrationProgress {
  from: string;
  to: string;
  state: 'waiting' | 'running' | 'done' | 'failed' | 'skipped';
  total: number | null;
  read: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  differences: number;
  verified: boolean | null;
  note?: string;
}

/** A migration run and its overall outcome. */
export interface MigrationJob {
  id: string;
  status:
    'running' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';
  source: string;
  target: string;
  startedAt: string;
  finishedAt?: string;
  collections: MigrationProgress[];
  errors: Array<{
    collection: string;
    id: string;
    code: string;
    message: string;
  }>;
  errorsTruncated: boolean;
  message?: string;
}

/** A record's values by field name. */
export type RecordData = Record<string, unknown>;

/** One page of records; use `nextCursor` to continue. */
export interface RecordPage {
  data: RecordData[];
  page: { nextCursor: string | null; limit: number };
  meta?: { capabilityNotes?: string[] };
}

/**
 * An unpublished edit. `version` is for optimistic locking: saves and publishes
 * are rejected if someone else changed the draft meanwhile.
 */
export interface DraftInfo {
  id: string;
  connectionId: string;
  collection: string;
  recordId: string | null;
  values: RecordData;
  version: number;
  status: 'draft' | 'publishing' | 'published' | 'discarded';
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  publishedRecordId?: string;
}

/** A short-lived link to view a draft without signing in. */
export interface PreviewLink {
  token: string;
  path: string;
  expiresAt: string;
}

/** Full admin view of a connection. Secrets are never included. */
export interface ConnectionDetail {
  id: string;
  name: string;
  adapter: string;
  adapterLabel: string;
  mode: 'read_only' | 'read_write';
  config: Record<string, unknown>;
  hasCredentials: boolean;
  health: string;
  healthNote?: string;
  lastCheckedAt: string;
  /** True when this connection lets an admin declare a new, empty collection. */
  canCreateCollections?: boolean;
  capabilities: {
    joins: boolean;
    transactions: string;
    filterOr: boolean;
    inequality: string;
    fullText: boolean;
    realtime: boolean;
    writes: boolean;
  };
  collections: Array<{
    name: string;
    exposed: boolean;
    reviewed: boolean;
    fields: number;
    primaryKey: string | null;
  }>;
}

/** An API token's metadata; the secret is shown only on creation. */
export interface TokenInfo {
  id: string;
  name: string;
  role: Role;
  createdAt: string;
  revokedAt?: string;
  expiresAt?: string;
}

/** A person who signs in with an authenticator app. */
export interface PersonInfo {
  id: string;
  username: string;
  name: string;
  role: Role;
  /** False until their first correct code. */
  enabled: boolean;
  createdAt: string;
}

/** What the gateway returns when a person is added or reset: shown once. */
export interface PersonSetup extends PersonInfo {
  /** The setup key to type into the authenticator app. */
  secret: string;
  /** The same key as a link; opens the authenticator app on a phone. */
  otpauthUri: string;
}

/** An e-mail address invited to sign in with Google or GitHub. */
export interface InviteInfo {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

/** One audit-log entry. */
export interface AuditItem {
  id: string;
  at: string;
  actor: string;
  operation: string;
  target: string;
  detail?: unknown;
}

/** Live changes pushed over the event stream. */
export type GatewayEvent =
  | {
      type: 'record.created' | 'record.updated' | 'record.deleted';
      connectionId: string;
      collection: string;
      recordId: string;
    }
  | {
      type:
        | 'draft.created'
        | 'draft.updated'
        | 'draft.discarded'
        | 'draft.published';
      connectionId: string;
      collection: string;
      draftId: string;
      recordId: string | null;
      version: number;
    }
  | { type: 'connection.changed'; connectionId: string };

/** The social sign-in methods a gateway offers (from /v1/auth/config). */
export interface SocialConfig {
  /** Some OpenID Connect provider is set up. */
  sso: boolean;
  /** That provider is Google. */
  google: boolean;
  /** Direct GitHub sign-in is set up. */
  github: boolean;
  /** Firebase Authentication is set up; public web settings for the popup. */
  firebase?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    providers: string[];
    /** Everyone who signs in gets a workspace of their own. */
    workspaces?: boolean;
  };
}
