# Competitor database support and database adoption rankings (as of Nov 2026)

## Q1. Exactly which databases does each competitor officially support (and which only experimentally)?

### Takeaway
Content-first CMSs (Strapi, Payload, Keystone) support only 3-4 databases, almost always PostgreSQL + SQLite (+ MySQL/MariaDB or MongoDB). Only Directus (7 SQL engines) and the data-API / internal-tool products (Hasura, Appsmith, Retool, Budibase, Metabase) go wide, adding MSSQL, Oracle, DynamoDB, Redis, Firestore and analytics warehouses. Sanity and Contentful are hosted-only, so they are not comparable on this point.

### Cited Findings
- **Strapi** officially supports four: MySQL (min 8.0, rec 8.4), MariaDB (min 10.3, rec 11.4), PostgreSQL (min 14, rec 17), SQLite 3. Docs state MongoDB/any NoSQL is not supported (NoSQL existed only in v3). Aurora and Google Cloud SQL are listed as unsupported. Strapi must not be pointed at a database it did not create. — [Strapi docs](https://docs.strapi.io/cms/configurations/database)
- **Payload CMS** officially supports three adapters: MongoDB (Mongoose), Postgres (Drizzle), SQLite (Drizzle). No adapter is labelled beta on that page. SQLite does not yet support the Point field. — [Payload docs](https://payloadcms.com/docs/database/overview)
- **KeystoneJS** `db.provider`: postgresql, mysql, sqlite (via Prisma, with driver adapters PrismaPg, PrismaMariaDb, PrismaBetterSqlite3). SQLite is "not intended" for production, lacks the `decimal` field, limits `timestamp` to 1970-2038, and has different text-filter case sensitivity. — [Keystone docs](https://keystonejs.com/docs/config/config)
- **Directus** `DB_CLIENT` values: pg/postgres, mysql (MySQL and MariaDB), oracledb, mssql, sqlite3, cockroachdb. The page gives no versions. — [Directus docs](https://directus.com/docs/configuration/database)
- Directus minimum versions as shown in README mirrors (mirrors, not the official repo page; may be dated): PostgreSQL 10, MySQL 5.7.8/8, MariaDB 10.2.7, SQLite 3, CockroachDB 21.1.13, MS SQL 13, OracleDB 19. Older versions of CockroachDB, MSSQL and OracleDB "may work but are not officially tested". — [search summary of README mirrors, e.g. github.com/piotr-cz/directus](https://github.com/piotr-cz/directus)
- Directus GitHub README lists: "Postgres, MySQL, MariaDB, MS SQL, SQLite, OracleDB, CockroachDB, and more." — [directus/directus](https://github.com/directus/directus)
- **Hasura v2** docs list: Postgres and compatible, SQL Server, BigQuery, Athena, Redshift, ClickHouse, MongoDB, Snowflake, MariaDB, MySQL, Oracle. Only status label on the page is MySQL "Currently in Alpha preview". — [Hasura v2 docs](https://hasura.io/docs/2.0/databases/overview/)
- **Hasura DDN (v3)** native connectors: PostgreSQL, MongoDB, ClickHouse (labelled DDN Beta in its repo), SQL Server. This wording is from a search summary and may be pre-GA; the official connector index was not retrievable. — [hasura/graphql-engine](https://www.github.com/hasura/graphql-engine), [ndc-clickhouse](https://github.com/hasura/ndc-clickhouse), [Hasura SQL Server connector](https://hasura.io/docs/3.0/reference/connectors/sqlserver/)
- **Prisma ORM** (basis for Keystone and many tools): the "Prisma ORM 8" page shows PostgreSQL = release candidate, MongoDB = early access, MySQL = early preview (migrations/reads only, no writes), SQLite = experimental, and MariaDB, SQL Server, CockroachDB = "coming soon" with no v8 library. Prisma ORM 7 supports all three. — [Prisma docs](https://www.prisma.io/docs/orm/reference/supported-databases)
- **Appsmith** datasources: PostgreSQL, MongoDB, MySQL, Elasticsearch, Redis, Microsoft SQL Server, Firestore, Redshift, S3, DynamoDB, Snowflake, ArangoDB, Oracle, SMTP, Databricks (plus REST/GraphQL). — [Appsmith docs](https://docs.appsmith.com/connect-data/reference)
- **Retool** database integration guides include PostgreSQL, MySQL, MongoDB, DynamoDB, SQL Server, Oracle, AlloyDB, CockroachDB, ClickHouse, Snowflake; JDBC or REST/GraphQL fallback for others. (Search summary of the index, not a full page read.) — [Retool database guides](https://docs.retool.com/data-sources/guides/integrations/database/)
- **Budibase** docs sidebar datasources: CouchDB, CSV, DynamoDB, Elasticsearch, Firestore, Google Sheets, MongoDB, MS SQL Server, MySQL/MariaDB, Oracle, PostgreSQL, Redis, S3, Snowflake; spec page also mentions ArangoDB; sources disagree on whether Redis is a true data source. Internal default DB is CouchDB. — [Budibase docs search summary](https://docs.budibase.com/docs/templates), [Budibase data sources](https://docs.budibase.com/docs/data-sources)
- **Metabase** officially supported: Athena, BigQuery, ClickHouse, Databricks, Druid, MongoDB, MariaDB, MySQL, Oracle, PostgreSQL, Presto, Redshift, Snowflake, SparkSQL, SQL Server, SQLite, Starburst, Vertica; others via community drivers. — [Metabase docs](https://www.metabase.com/docs/latest/databases/connecting)
- **Supabase**: every project is "a full Postgres database"; page does not mention other engines. — [Supabase docs](https://supabase.com/docs/guides/database/overview)
- **Sanity**: data lives in its proprietary Content Lake; Studio can be self-hosted but the backend is SaaS. **Contentful**: fully managed SaaS only (per vendor-adjacent comparison blogs). Neither lets you pick a database. — [Sanity docs](https://www.sanity.io/docs/content-lake), [comparison summary](https://www.cosmicjs.com/blog/sanity-vs-contentful)

### Support matrix (derived from the findings above; Y = officially listed)
| DB | Directus | Strapi | Payload | Keystone | Hasura v2 | Appsmith | Retool | Budibase | Metabase |
|---|---|---|---|---|---|---|---|---|---|
| PostgreSQL | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| MySQL | Y | Y | - | Y | Y (alpha) | Y | Y | Y | Y |
| MariaDB | Y | Y | - | via mysql | Y | via MySQL? | ? | Y | Y |
| SQLite | Y | Y | Y | Y | - | - | - | - | Y |
| MongoDB | - | - | Y | - | Y | Y | Y | Y | Y |
| MSSQL | Y | - | - | - | Y | Y | Y | Y | Y |
| Oracle | Y | - | - | - | Y | Y | Y | Y | Y |
| CockroachDB | Y | - | - | - | - | - | Y | - | - |
| DynamoDB | - | - | - | - | - | Y | Y | Y | - |
| Redis | - | - | - | - | - | Y | ? | Y (disputed) | - |
| Firestore | - | - | - | - | - | Y | ? | Y | - |

### Inferences
- SethuCMS's current list (PostgreSQL, MySQL/MariaDB, SQLite, MongoDB, Firestore) already covers the CMS-class norm. It is broader than Strapi, Payload and Keystone, and it covers NoSQL, which only Payload does among CMSs.
- The rows missing for SethuCMS (MSSQL, Oracle, DynamoDB, Redis, CockroachDB) are carried only by Directus and the internal-tool/data-API products, so they are differentiators against CMS peers but table stakes against Appsmith/Retool/Budibase-style data connectors.

### Gaps
- Official Directus minimum versions and per-database caveats could not be read from directus.com (the quickstart page had none; the config page listed no versions). Versions above are from README mirrors.
- Hasura DDN official connector index and GA/beta status, Airbyte source list (page rendered "Loading sources..."), Retool and Budibase full per-database pages, and Contentful/Sanity official statements were not directly verified.
- PostgREST docs fetch was rate-limited (429). It is widely understood to be PostgreSQL-only, but I have no fetched source. Supabase REST is built on PostgREST, which is also unconfirmed here.
- Payload's Vercel Postgres / D1 variants were not on the fetched overview page, so their status is unverified.

## Q2. Which databases appear in almost every competitor (must-haves) versus a few (differentiators)?

### Takeaway
PostgreSQL is in 100% of the DB-agnostic products surveyed, followed by MySQL/MariaDB (all except Payload and Supabase). SQLite and MongoDB are common but not universal. MSSQL and Oracle are standard for data-connector products (Hasura, Appsmith, Retool, Budibase, Metabase) but rare among CMSs (Directus only). CockroachDB, DynamoDB, Redis and Firestore are differentiators.

### Cited Findings
- PostgreSQL appears in every product matrix above (Strapi, Payload, Keystone, Directus, Hasura, Appsmith, Retool, Budibase, Metabase, Supabase). — see Q1 sources
- MySQL/MariaDB are in Strapi, Keystone, Directus, Hasura, Appsmith, Retool, Budibase, Metabase. Payload does not list them. — [Payload docs](https://payloadcms.com/docs/database/overview)
- MSSQL is in Directus, Hasura, Appsmith, Retool, Budibase, Metabase, but not in Strapi, Payload or Keystone. — see Q1 sources
- DynamoDB is listed by Appsmith, Retool and Budibase, and by none of the CMSs or Hasura. Redis is listed as a datasource by Appsmith (and Budibase per docs sidebar). — [Appsmith docs](https://docs.appsmith.com/connect-data/reference)
- Strapi explicitly rejects MongoDB, and states it does not support connecting to pre-existing databases. — [Strapi docs](https://docs.strapi.io/cms/configurations/database)

### Inferences
- Must-haves: PostgreSQL, MySQL/MariaDB, SQLite (CMS class). Strong expectations for a "database-agnostic" label: MSSQL and Oracle (enterprise demand). SethuCMS planning MSSQL first is consistent with this evidence.
- Planned DynamoDB and Redis would be differentiators relative to CMS peers. Oracle and CockroachDB are not on SethuCMS's list but are in Directus; CockroachDB is cheap to add if a Postgres wire-compatible path exists (inference).
- Evidence that Oracle is a competitive gap: it appears in Directus, Hasura, Appsmith, Retool, Budibase and Metabase. SethuCMS has no Oracle plan.

### Gaps
- No usage data per database for each competitor (e.g. which engines customers actually run on Directus). Not found.

## Q3. How does Directus handle MSSQL, Oracle, CockroachDB, SQLite/libSQL, and their limitations?

### Takeaway
Directus runs on the Knex query builder with one `DB_CLIENT` switch per dialect, and ships MSSQL, Oracle, CockroachDB and SQLite as first-class clients. Limitations are handled mostly by "tested minimum version" disclaimers and by dialect-specific code paths, not by a published limitation matrix. I found no evidence of libSQL/Turso support.

### Cited Findings
- Directus lists pg, mysql, oracledb, mssql, sqlite3, cockroachdb as `DB_CLIENT` values; `DB_VERSION` exists for non-standard databases that use the PostgreSQL adapter; `DB_EXCLUDE_TABLES` defaults to `spatial_ref_sys,sysdiagrams` (the latter is an SQL Server system table name, which signals introspection hygiene for MSSQL/Postgres). SQLite needs only `DB_FILENAME`. — [Directus docs](https://directus.com/docs/configuration/database)
- CockroachDB, MS SQL and OracleDB are the three with the "older versions may work but are not officially tested" footnote. — [README mirror](https://github.com/piotr-cz/directus)
- A 2022 Directus issue reported that field default values could not be updated on a fresh CockroachDB install (9.5.2); a commenter says it was fixed in 9.10.0 via the Knex 2.0.0 upgrade (unverified comment). — [directus issue 11832](https://github.com/directus/directus/issues/11832)
- Knex FAQ notes Azure SQL needs `encrypt: true`, and migrations are incompatible with databases lacking `select for update`. — [Knex FAQ](https://knexjs.org/faq/recipes.html)
- CockroachDB itself has documented PostgreSQL-compatibility gaps (e.g. no user-defined functions in some expressions, differences in CHECK validation on upsert, per older versions). — [CockroachDB known limitations v23.2](https://deploy-preview-23302--cockroachdb-docs.netlify.app/docs/v23.2/known-limitations)

### Inferences
- Directus's approach is tiered: Postgres/MySQL/SQLite are the tested core; Oracle, MSSQL and CockroachDB are supported with a "minimum tested version" caveat. SethuCMS could adopt a similar explicit tiering (GA / Beta / Experimental) in docs.
- CockroachDB can reuse a Postgres adapter largely unchanged, as Directus ships it as a separate client name only for dialect quirks (inference from the listing, not documented).

### Gaps
- No libSQL/Turso support found for Directus; no official statement either way.
- Directus's own documentation of per-database limitations (e.g. JSON, spatial, schema introspection differences for Oracle/MSSQL) was not found.

## Q4. Current database popularity: DB-Engines, Stack Overflow Developer Survey 2025, and 2025-2026 trends

### Takeaway
DB-Engines (a score-based popularity ranking, not market share) still ranks Oracle, MySQL, SQL Server, PostgreSQL 1-4, with PostgreSQL the only one of the four trending upward. The Stack Overflow 2025 survey (usage by developers) ranks PostgreSQL first at 55.6%, then MySQL, SQLite, SQL Server, Redis, MongoDB, MariaDB. PostgreSQL is also the most admired and desired.

### Cited Findings
- **DB-Engines, November 2026** (secondary: HelloGitHub report of DB-Engines data; db-engines.com itself had a certificate error): 1 Oracle 1096, 2 MySQL 823, 3 SQL Server 693, 4 PostgreSQL 689, 5 MongoDB 366, 6 Snowflake 218, 7 Databricks 176, 8 Redis 163, 9 IBM Db2 102, 10 Cassandra 98. — [HelloGitHub](https://hellogithub.com/report/db-engines)
- Earlier snapshots: March 2026 Oracle 1182, MySQL 858, SQL Server 711, PostgreSQL 680 ([zatoima](https://zatoima.github.io/en/db-engines-ranking-march-2026)); a third-party blog claims PostgreSQL was the only top-4 database gaining year over year in July 2026 (+6.92) while MySQL lost 94 points (unverified). A Bytebase page quoted conflicting Snowflake figures and is regarded as unreliable. — [search summary](https://hellogithub.com/report/db-engines)
- DB-Engines is a popularity score from mentions, searches, job ads, etc., updated monthly; Redgate bought DB-Engines in June 2024. — [Wikipedia](https://en.wikipedia.org/wiki/DB-Engines_ranking)
- **Stack Overflow Developer Survey 2025, most used (all respondents):** PostgreSQL 55.6%, MySQL 40.5%, SQLite 37.5%, SQL Server 30.1%, Redis 28%, MongoDB 24%, MariaDB 22.5%, Elasticsearch 16.7%, Oracle 10.6%, DynamoDB 9.8%. Professional developers: PostgreSQL 58.2%, MySQL 39.6%, SQLite 36.9%. Redis grew +8%. — [Stack Overflow 2025](https://survey.stackoverflow.co/2025/technology)
- **Admired/desired (secondary sources, not read at the official page):** PostgreSQL about 65.5-66% admired and 46.5-47% desired; Valkey debuted at 64.7% admired; Redis admired 54.9% and about 23.5% desired; admiration fell across most databases. — [data-bene](https://www.data-bene.io/en/blog/most-desired-database-three-years-running-postgresqls-developer-appeal/), [vonng](https://blog.vonng.com/en/pg/so2025-pg/), [EnterpriseDB](https://enterprisedb.com/blog/postgresqls-incredible-trip-top-developers-0)

### Inferences
- The two sources diverge on the ranking: DB-Engines favours enterprise incumbents (Oracle #1, SQL Server #3), while developer-survey data puts Oracle at 10.6% usage and SQL Server at 30.1%. For a CMS targeting developers, the Stack Overflow ordering is the better guide; for enterprise sales, DB-Engines justifies MSSQL and Oracle.
- Based on the 2025 usage figures, MSSQL (30.1%), Redis (28%), MariaDB (22.5%) and Elasticsearch (16.7%) are the biggest remaining gaps; Redis and MSSQL are already on SethuCMS's plan. Elasticsearch and Oracle have more usage than DynamoDB (9.8%). DynamoDB's priority looks lowest by usage but it is common in connector products.
- SQLite's third place among developers (37.5%) supports keeping it first-class.

### Gaps
- Official admired/desired database numbers were not read from the Stack Overflow page (truncated in the fetch); figures are from secondary articles.
- No 2026 Stack Overflow survey results were checked; the 2025 edition is the latest I confirmed.
- I did not find authoritative 2025-2026 data on SQLite/libSQL rise, vector databases or serverless Postgres adoption, so I make no claims about those trends.
- Direct db-engines.com access failed (TLS certificate error), so the November 2026 numbers rely on a secondary mirror; verify before publishing.
