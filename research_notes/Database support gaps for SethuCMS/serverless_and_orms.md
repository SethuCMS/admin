# Serverless / BaaS databases and ORMs: what they are underneath and how a gateway integrates

Note on method: ~16 searches, snippets only (no full-page fetches). Items marked "background (unverified)" come from model background knowledge and have no citation from this session. Treat them as hypotheses to check against official docs.

## 1. What engine and wire protocol is under each service, how does Node connect, and does pg / mysql2 / sqlite already work?

### Takeaway
Most of the "serverless database" names are plain Postgres (Supabase, Neon, Prisma Postgres, Vercel Postgres->Neon, Xata, Nile, PlanetScale Postgres, Aurora/RDS), so a connection string to the existing `pg` adapter works, with pooler caveats (transaction-mode pooling, prepared statements, session state). PlanetScale classic is MySQL/Vitess (mysql2 compatible, background). The genuinely different ones are Turso/libSQL (SQLite over Hrana), D1 (SQLite via Cloudflare REST/binding), Convex, Appwrite, PocketBase, Firebase, and Atlas (Mongo).

### Cited Findings
- Supabase: pooled access via Supavisor; shared pooler transaction mode (port 6543) does not support prepared statements, so disable them in the driver (e.g. asyncpg `statement_cache_size=0`, JDBC `prepareThreshold=0`); session mode on 5432 supports them. Dedicated poolers (Pro+) run transaction mode only. — [Supabase KB: Disabling prepared statements](https://supabase.com/kb/troubleshooting/disabling-prepared-statements-qL8lEL); [Supabase connecting docs](https://supabase.com/docs/guides/database/connecting/connecting-to-postgres)
- Supavisor has a `named_prepared_statements` feature flag (env `NAMED_PREPARED_STATEMENTS_ENABLED` or per-tenant) enabling named prepared statements in transaction mode; Prisma uses named prepared statements by default and can conflict. — [Supavisor docs](https://docsearch.algolia.com/mcp/docs/repo/supabase/supavisor). A DEV blog claims Supavisor emulates prepared statements automatically; this contradicts Supabase docs, low-confidence — [DEV Community](https://dev.to/gabrielanhaia/connection-pooling-2026-pgbouncer-vs-rds-proxy-vs-supabase-pooler-171e)
- Neon: managed PgBouncer in transaction mode per database, `max_client_conn` 10,000, pooled host has `-pooler` suffix; avoid client-side pooling on top of a pooled string. `@neondatabase/serverless` offers HTTP (single queries / non-interactive transactions, one fetch each) and WebSocket (sessions / interactive transactions; must open and close within a request handler). TCP with `pg` or postgres.js suits long-lived servers. — [Neon connection choice docs](https://neon.com/docs/connect/choose-connection.md); [Neon FAQ](https://neon.com/faqs/postgres-serverless-functions-connection-issues)
- Prisma Postgres: Postgres 17 on bare metal with unikernels (Unikraft); requests historically routed through Accelerate's pool (HTTP, Accelerate client extension required). Late-2025 post says direct TCP connections GA since October 2025 so Drizzle, Kysely, TypeORM, psql can connect directly; pooling over TCP is Early Access via `pooled=true` param. Older docs/Feb 2025 post said TCP unavailable (superseded). — [Prisma blog: Life of a query](https://blog.prisma.io/blog/cloudflare-unikernels-and-bare-metal-life-of-a-prisma-postgres-query); [Prisma docs overview](https://prisma.io/docs/postgres/overview); [Prisma connection pooling](https://docs.prisma.io/docs/postgres/database/connection-pooling)
- PlanetScale launched PlanetScale for Postgres in 2025 (GA reported ~Sept/Oct 2025), explicitly not Vitess; uses PgBouncer for pooling per third-party summary; MySQL product remains Vitess. — [PlanetScale GA post](https://planetscale.com/blog/planetscale-for-postgres-is-generally-available); [Simon Willison](https://simonwillison.net/2025/Jul/1/planetscale-for-postgres/); [InfoQ](https://infoq.com/news/2025/10/planetscale-metal-postgres). Conflicting third-party claim (Raft) is low-confidence.
- Turso/libSQL: `@libsql/client` speaks the Hrana protocol over HTTP or WebSocket; raw HTTP possible by POSTing to `<http-url>/v2/pipeline` with a token from `turso db tokens create`; `/web` entry uses HTTP. — [Turso HTTP quickstart](https://docs.turso.tech/sdk/http/quickstart.md); [libsql-client-ts](https://github.com/psarna/libsql-client-ts) (older fork README; default-protocol statement may be dated)
- Cloudflare D1: SQLite; queryable from Workers binding or REST API: `POST https://api.cloudflare.com/client/v4/accounts/{accountId}/d1/database/{databaseId}/query` with body `{sql, params}` or `{batch:[...]}`; Wrangler uses the same REST APIs. Auth/rate limits not confirmed. — [Cloudflare D1 query docs preview](https://codex-container-api-docs.previews.developers.cloudflare.com/d1/best-practices/query-d1/index.md); [third-party endpoint summary](https://www.withone.ai/knowledge/cloudflare/conn_mod_def%3A%3AGLv16_MeQCA%3A%3ADadBlvP5Qc66t4O0s2GiGw)
- Vercel Postgres: no longer available; stores auto-moved to Neon in Dec 2024 (a blog says June 2025, unverified); `@vercel/postgres` deprecated; Marketplace offers Neon, Prisma Postgres, Supabase, Aurora Postgres. — [Vercel docs](https://vercel.com/docs/postgres); [Neon transition guide](https://neon.com/docs/guides/vercel-postgres-transition-guide)
- Xata: old Xata Lite (REST/spreadsheet-style) permanently retired 2026-02-28, client-ts repo archived; new Xata Platform is vanilla Postgres with copy-on-write branching. — [xataio/client-ts README](https://raw.githubusercontent.com/xataio/client-ts/main/README.md); [Xata blog](https://xata.io/blog/serverless-postgres-platform)
- Nile: Postgres with tenant virtualization; tables made tenant-aware with reserved `tenant_id uuid`; tenant scope set per session via `nile.tenant_id`; Nile says it avoids RLS. Third-party claim that unset tenant means all tenants is unverified. — [Nile tenant isolation](https://www.thenile.dev/docs/tenant-virtualization/tenant-isolation); [Nile tenant management](https://docs.thenile.dev/docs/tenant-management)
- Convex: HTTP client exposes query/mutation/action; third-party listing says `/api/query`, `/api/mutation`, `/api/action`, `/api/run/{functionIdentifier}` with deployment/admin-key bearer auth (verify). Access is through developer-defined functions, not generic table access. — [ConvexHttpClient docs](https://docs.convex.dev/api/classes/browser.ConvexHttpClient); [Jentic listing](https://jentic.com/apis/convex)
- Appwrite: TablesDB API (tables/columns/rows) with server API key and scopes (`databases.write`, `tables.write`, `columns.write`, `rows.read`, `rows.write`); docs say future SQL/NoSQL adapters (MariaDB, MySQL, MongoDB) are planned, i.e. not a direct SQL connection. — [Appwrite tables docs](https://appwrite.io/docs/products/databases/tablesdb/tables.md); [Appwrite Node quickstart](https://appwrite.io/docs/quick-starts/node.md)
- PocketBase: collections are plain SQLite tables; REST API with per-action rules; null (locked) rule = superuser only (default); rules ignored for superusers; rules double as record filters. — [PocketBase collections](https://pocketbase.io/docs/collections/); [API rules](https://pocketbase.io/docs/api-rules-and-filters/)
- Aurora / RDS Proxy: RDS Proxy supports Aurora Serverless v2 (not v1); same VPC required; PostgreSQL pinning triggers include SET commands, reducing multiplexing; CloudWatch metric `DatabaseConnectionsCurrentlySessionPinned`. — [AWS: RDS Proxy pinning](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/rds-proxy-pinning.html); [AWS RDS Proxy for Aurora](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/rds-proxy.html)

### Inferences
- Connection-string-only (reuse `pg`): Supabase, Neon, Prisma Postgres (TCP), Vercel/Marketplace Postgres, Xata (new), Nile, PlanetScale Postgres, Aurora/RDS Postgres. Reuse `mysql2` for PlanetScale MySQL, Aurora MySQL (background, unverified). Gateway should treat transaction-mode poolers as a profile: disable prepared statements / named statements, avoid session `SET`, advisory locks, LISTEN/NOTIFY; for RLS-per-request use `SET LOCAL` inside a transaction only.
- New driver/adapter required: libSQL/Turso (Hrana client, also local SQLite files), D1-over-REST (stateless HTTP, no transactions across calls except batch), Convex (function-based, no generic table API unless customer exposes functions), Appwrite (REST, schema from its own API), PocketBase (REST, or open the SQLite file directly only if co-located), Firebase/Firestore (document SDK), Atlas (MongoDB driver).
- Serverless-driver restrictions (Neon HTTP no interactive tx; WebSocket lifetimes) matter only for edge deployment of the gateway; on a Node server plain TCP with the pooled host is fine.

### Gaps
- Not verified: PlanetScale MySQL connection string/TLS specifics and Vitess feature limits (foreign keys, online DDL); Turso embedded replicas; D1 REST auth header and rate limits; Aurora Data API and scale-to-zero status; Firestore REST/Admin SDK rule bypass (search returned nothing); MongoDB Atlas serverless/Data API status (Atlas Data API was deprecated by MongoDB per background, unverified); Appwrite self-host underlying engine (MariaDB per background, unverified); Neon scale-to-zero cold-start behavior.

## 2. Supabase specifics: service-role key, RLS, pooler modes, JWT forwarding

### Takeaway
`service_role` is a Postgres role that bypasses RLS and must stay server-side; a gateway connecting with the DB password (postgres role) or service_role gets the same "RLS is bypassed" effect, so the gateway's own permission layer becomes the only guard. To honor RLS you must forward a user JWT (anon/authenticated role) via PostgREST or emulate with per-transaction claims.

### Cited Findings
- service_role is a predefined elevated Postgres role that can skip RLS; keep it only on a private server. — [Supabase API keys docs](https://Supabase.com/docs/guides/api/api-keys)
- anon key is a JWT PostgREST uses to choose the role and RLS policies; PostgREST requires `apikey` and `Authorization` headers carrying the JWT. — [chat2db guide](https://chat2db.ai/resources/blog/secure-supabase-role-key) (secondary); [Supabase API keys](https://Supabase.com/docs/guides/api/api-keys)
- Pooler: shared pooler 6543 transaction mode, 5432 session mode, prepared statements off in transaction mode (see Q1).

### Inferences
- Integration options: (a) direct Postgres via pooler session mode (5432) or direct connection for the gateway, gateway enforces permissions itself; (b) call Supabase PostgREST with the end-user's JWT so RLS applies (adds a second REST hop); (c) emulate RLS by `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', ...)` (background: this is how PostgREST does it; unverified here, and works only with a transaction-safe pooler flow).
- The gateway should detect RLS-enabled tables (pg_class.relrowsecurity) and warn when connecting as a BYPASSRLS role.

### Gaps
- Official docs for new Supabase API key format (publishable/secret keys replacing anon/service_role JWTs) not checked; IPv4/IPv6 direct-connection add-on details not checked.

## 3. Prisma, Drizzle and other ORMs: is Prisma a database, and is a "Prisma adapter" sensible versus schema import?

### Takeaway
Prisma ORM is not a database; it is a schema DSL + client + migrations over the customer's DB. Prisma Postgres is a separate managed Postgres product. The sensible integrations are: (1) connect to the underlying DB by connection string (works for Prisma Postgres via TCP), and (2) optionally import `schema.prisma` / Drizzle schema as metadata (relations, enums, field names). A runtime "Prisma adapter" (calling PrismaClient) adds little and couples the gateway to generated clients.

### Cited Findings
- `getDMMF` in `@prisma/internals` / standalone `@prisma/get-dmmf` (v7.8.0 listed) parses schema.prisma into DMMF; `@prisma/dmmf` is deprecated/internal; a community write-up found DMMF output incomplete and used a third-party parser. — [@prisma/get-dmmf README](https://cdn.jsdelivr.net/npm/@prisma/get-dmmf@7.8.0/README.md); [npm @prisma/dmmf](https://www.npmjs.com/package/@prisma/dmmf); [Zenn write-up](https://zenn.dev/maruware/articles/282c313718d5a9)
- Drizzle Kit generates a schema file from an existing DB (`introspect` in the older guide; likely renamed `pull`, unconfirmed). — [Drizzle: migrate from Prisma](https://orm.drizzle.team/docs/migrate/migrate-from-prisma)
- Prisma Postgres supports direct TCP so non-Prisma tools can connect (see Q1).
- Prisma Accelerate = connection pool + global cache in front of a DB; required client extension for Prisma Postgres' original HTTP path. — [Prisma docs](https://prisma.io/docs/postgres/overview)

### Inferences
- Better than an adapter: introspect the live DB (source of truth, works for any ORM user) and treat schema.prisma / drizzle schema as an optional import that adds hints (relation names, enums, `@map`, soft-delete conventions). Introspection already yields FKs; ORM schemas mostly add naming/enum/virtual-relation info (Prisma relations of implicit many-to-many `_AToB` tables are a gotcha, background).
- Parsing schema.prisma without Prisma packages is feasible via the grammar-light DSL, but using `@prisma/get-dmmf` is lower-risk, at the cost of a large dependency.
- TypeORM, Sequelize, MikroORM, Kysely: defined in code (decorators/models/types); no stable file to import for most; Kysely has codegen from DB (background, unverified). Recommend DB introspection as the universal path.

### Gaps
- No sources fetched for TypeORM / Sequelize / MikroORM / Kysely behavior; Drizzle schema.ts parsing (needs executing TS, not static parse) not verified; Prisma 7 driver-adapter changes not verified.

## 4. Adoption signals

### Takeaway
Postgres dominates; Supabase is rising while Firebase falls. ORM download figures conflict by source; Drizzle appears to have reached or passed Prisma on some counts by 2026, but numbers are inconsistent.

### Cited Findings
- Stack Overflow 2025 (as reported by secondary sources): PostgreSQL 55.6% usage (+7pp), #1 in popularity/admired/desired; Supabase 5.4% in cloud platforms with growth (2.6%, 3.8%, 6% over three years per one author); Firebase 13.1% with a reported 16.1% decline. Another source says 58.2% among professionals. — [Vonng analysis](https://blog.vonng.com/en/pg/so2025-pg/); [DEV Community](https://dev.to/davidshq/thoughts-on-stackoverflow-2025-developer-survey-part-1-3d5o); [EDB](https://enterprisedb.com/blog/postgresqls-incredible-trip-top-developers-0)
- npm weekly downloads (conflicting): one Oct 12-18 2026 snapshot has drizzle-orm ~18.3M, `prisma` ~11.7M, `@prisma/client` ~11.1M (also Prisma latest tag 8.0.0 RC, 7.10.1 last stable); Pkgpulse: Drizzle 15.5M vs Prisma 14.9M (another page: Prisma 7.8M vs Drizzle 4.2M, Drizzle passed Prisma late 2025); Depscope ~Apr-May 2026: Prisma 11.6M vs Drizzle 6.8M; an earlier article's 2.5M vs 0.9M looks too low. — [tech-insider](https://tech-insider.org/drizzle-vs-prisma-2026/); [pkgpulse](https://www.pkgpulse.com/guides/prisma-vs-drizzle-2026); [depscope](https://depscope.dev/compare/npm/prisma-vs-drizzle-orm-vs-typeorm)

### Inferences
- Prioritize by demand: Postgres-family (Supabase, Neon, RDS/Aurora) first, then MySQL, then libSQL/D1; Prisma/Drizzle users all sit on those same databases, so ORM support should be schema-import, not a new database type.

### Gaps
- No GitHub star counts, TypeORM/Sequelize/Kysely/MikroORM downloads, State of JS data, or per-service usage (Neon, Turso, D1, PocketBase, Appwrite, Convex) retrieved. Official survey pages not fetched (only secondary reports). Weekly download numbers should be pulled directly from `api.npmjs.org/downloads/point/last-week/<pkg>`.
