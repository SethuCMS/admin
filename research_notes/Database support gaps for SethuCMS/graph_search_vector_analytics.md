# Specialised databases (graph, search, vector, time-series, analytics/warehouse) as sources for a "CMS over any database" gateway

Method note: npm versions/dates and weekly downloads were read live from the npm registry (registry.npmjs.org / api.npmjs.org) on 2026-11-05 via CLI. Weekly downloads are a noisy proxy (they include CI, transitive deps, and non-CMS use). Items marked "(unverified, background knowledge)" were not confirmed by a fetched source this session.

## 1. Which are realistically used as a CMS content store or content-adjacent store?

### Takeaway
Only search engines are genuinely content-adjacent for CMSs (index of content, synced from the primary DB); vector stores are content-adjacent for AI features, usually as a derived index; analytics warehouses are dashboard/reporting sources; graph and time-series are rarely CMS content stores. None of these is a normal primary content store.

### Cited Findings
- Meilisearch publishes an official Strapi plugin with automatic content sync and webhook support; Strapi states its integration guides are not official docs and its support team won't help with them — [Meilisearch Strapi integration](https://www.meilisearch.com/integrations/strapi), [Strapi integrations](https://strapi.io/integrations/meilisearch)
- Directus has a community Meilisearch hook extension (hook-based, needs restart after settings changes, offers reindex), and Directus's integrations directory lists Algolia and Typesense under Search — [Directus Meilisearch extension](https://directus.io/extensions/directus-extension-meilisearch-integration), [Directus integrations](https://directus.io/integrations)
- Payload has third-party Meilisearch (`@nouance/payload-meilisearch`, v0.1.3, MIT, early-stage) and Typesense (community plugin, maintenance unverified) plugins — [jsDelivr package](https://www.jsdelivr.com/package/npm/@nouance/payload-meilisearch), [typesense-search plugin](https://github.com/fronttribe/typesense-search)
- Search engines are by far the most-used of the surveyed group among developers: Stack Overflow 2025 all-respondent database usage: Elasticsearch 16.7%, BigQuery 6.5%, Snowflake 4.1%, InfluxDB 3.7%, Databricks SQL 3.4%, DuckDB 3.3%, Neo4j 2.6%, ClickHouse 2.4%, Redshift 2.3%; Pinecone, Chroma and pgvector did not appear in the extracted content — [Stack Overflow Developer Survey 2025](https://survey.stackoverflow.co/2025/technology)
- DB-Engines (via third-party scrape of March 2026 trend data): Snowflake score ~211 (rank 6), Elasticsearch ~103.6 (rank 10); Neo4j was 47 (rank 20) in April 2025; a vector-DBMS table put Pinecone/Qdrant/Milvus at the top of the vector category (the source's two tables conflict) — [zatoima blog on DB-Engines March 2026](https://zatoima.github.io/en/db-engines-ranking-march-2026), [April 2025 ranking summary](https://hellogithub.com/en/report/db-engines)
- Elastic added AGPL as a licence option for Elasticsearch/Kibana (2024), after the SSPL/Elastic License era that prompted AWS's OpenSearch fork; OpenSearch moved to the Linux Foundation in Sept 2024 (Apache 2.0) — [InfoQ](https://www.infoq.com/news/2024/09/elastic-open-source-agpl), [DevClass](https://devclass.com/2024/09/16/aws-hands-opensearch-to-linux-foundation-is-this-why-elasticsearch-was-made-open-source-again)
- Vector DB guidance in 2026 is mostly opinion pieces: pgvector if already on Postgres, Pinecone for managed scale, Qdrant for self-hosted; no authoritative market-share dataset exists — [dev.to comparison](https://dev.to/gabrielanhaia/vector-db-choice-2026-pgvector-vs-qdrant-vs-pinecone-vs-weaviate-the-real-trade-matrix-166o), [amtocsoft comparison](https://amtocsoft.blogspot.com/2026/04/pgvector-vs-pinecone-vs-qdrant.html)

### Inferences
- Search indexes (Meilisearch, Typesense, Algolia, Elasticsearch/OpenSearch) are always derived from a primary store in CMS ecosystems (plugins sync on content hooks), so a gateway should treat them as a sync target / search backend, not as a collection source with CRUD semantics.
- pgvector is not a separate system: it is a Postgres extension, so a Postgres adapter already covers the data; the gateway only needs to understand `vector` column types (npm `pgvector` helper exists, see Q4).
- Graph and time-series stores have no evidence of use as CMS content stores in what I found.
- Analytics warehouses appear as dashboard/reporting sources, matching the "read-only" framing.

### Gaps
- No source found for Neo4j/Memgraph/ArangoDB being used as a CMS content store (absence of evidence only).
- Stack Overflow figures for OpenSearch, Meilisearch, Typesense, Algolia, Qdrant, Weaviate, Milvus, TimescaleDB, QuestDB, MotherDuck not retrieved; the pages did not list them in the extract.
- Official DB-Engines page could not be fetched (TLS certificate error); scores are from third-party scrapes; ClickHouse and others' scores not obtained.
- Algolia plugins for Strapi/Payload not confirmed either way.

## 2. Read-mostly systems suited to a read-only adapter: cost, latency, auth gotchas

### Takeaway
BigQuery, Snowflake, Databricks and Redshift are pay-per-scan or warehouse-time systems with no cheap point lookups, so a read-only adapter needs cost guards (dry-run, max bytes billed, row caps, no per-keystroke queries), caching, and service-account/key-pair/OAuth auth. ClickHouse and DuckDB are cheap and fast to query but have their own constraints (HTTP-only client; embedded/local file for DuckDB).

### Cited Findings
- BigQuery on-demand: $6.25/TiB (US), first 1 TiB/month free; minimum 10 MB billed per referenced table and per query; charge is based on columns scanned even with LIMIT — [BigQuery pricing](https://cloud.google.com/bigquery/pricing/?hl=it) (LIMIT note read in Italian/Indonesian translations of the official page), [Activepieces 2026 cost guide](https://www.activepieces.com/blog/google-bigquery-pricing-explained-2026-cost-guide)
- Cost controls: dry-run byte estimates and a maximum-bytes-billed job setting that fails over-limit queries without charge; select fewer columns, filter on partitions — [Activepieces guide](https://www.activepieces.com/blog/google-bigquery-pricing-explained-2026-cost-guide) (third-party; official doc not fetched)
- Snowflake Node driver (`snowflake-sdk`) auth options: password, external-browser SSO, Okta native SSO, key pair (`SNOWFLAKE_JWT`), OAuth token, OAuth 2.0 auth-code and client-credentials, workload identity federation (AWS/Azure/GCP/OIDC), username-password-MFA; token caching off by default — [Snowflake Node.js auth docs](https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-authenticate)
- ClickHouse Node client uses HTTP/HTTPS only (RowBinary planned), username/password auth, supports ClickHouse Cloud (idle instances may need a retried ping to wake), `{name: Type}` parameter binding, 64-bit ints returned as strings in JSON formats, Node 20/22/24 supported; aborting a request does not guarantee a write was not applied — [ClickHouse JS client docs](https://clickhouse.com/docs/integrations/javascript)
- DuckDB Node API is `@duckdb/node-api` 2.0.0-r.1 (MIT), MotherDuck has `@motherduck/wasm-client` 1.5.6-r.1 — npm registry (see Q4)

### Inferences
- Read-only adapters for BigQuery/Snowflake/Databricks should: enforce a maximum-bytes-billed / row limit, show dry-run cost, paginate via keyset on a partition/clustered column, cache results, and never run per-keystroke or per-row lookups. Warehouse start-up (Snowflake auto-resume, Databricks SQL warehouse cold start, ClickHouse Cloud idle wake) implies seconds of latency (latency magnitudes unverified, background knowledge).
- A service-account JSON key (BigQuery), key-pair (Snowflake), and PAT/OAuth M2M (Databricks) are the likely server-side auth paths; the gateway must store these as secrets and prefer least-privilege read-only roles (specifics for BigQuery and Databricks auth not verified this session).
- DuckDB is embedded (in-process files/Parquet/CSV, or MotherDuck cloud), so adapter risk is different: file path access and extension loading rather than network auth (unverified, background knowledge).

### Gaps
- Official BigQuery pricing page returned only a title via fetch; figures rely on search snippets of the official page's translated versions.
- Databricks SQL and Redshift (Data API vs JDBC/pg wire) auth and cost specifics not researched; Redshift has no first-party Node query driver in the check (see Q4).
- Concrete latency numbers for any warehouse not found.

## 3. SQL vs custom query language (sql-kit dialect reuse)

### Takeaway
Warehouses and ClickHouse/DuckDB/Timescale/QuestDB speak SQL (varying dialects), so a SQL-builder dialect could be reused with caveats; graph, search, vector (except pgvector) and Influx's classic APIs use custom languages or REST, so they need purpose-built adapters. Evidence in this session is limited to driver-level facts.

### Cited Findings
- ClickHouse client takes SQL with `{name: Type}` typed parameters over HTTP — [ClickHouse JS docs](https://clickhouse.com/docs/integrations/javascript)
- Snowflake, BigQuery, Databricks, DuckDB, Redshift each ship SQL-oriented Node clients (`snowflake-sdk`, `@google-cloud/bigquery`, `@databricks/sql`, `@duckdb/node-api`) — npm registry (Q4 table)
- InfluxDB has two JS clients: `@influxdata/influxdb-client` (v2 API, Flux/InfluxQL; 205,598 weekly downloads) and `@influxdata/influxdb3-client` (v3, 28,484 weekly downloads) — npm registry
- Search and vector systems ship REST/SDK clients (`@elastic/elasticsearch`, `meilisearch`, `typesense`, `algoliasearch`, `@pinecone-database/pinecone`, `@qdrant/js-client-rest`, `weaviate-client`, `@zilliz/milvus2-sdk-node`, `chromadb`) — npm registry

### Inferences (unverified, background knowledge)
- SQL: ClickHouse, BigQuery (GoogleSQL), Snowflake, Databricks SQL, DuckDB, Redshift (Postgres-derived), TimescaleDB (is Postgres, so existing Postgres dialect works), QuestDB (Postgres wire protocol + own SQL extensions). DuckDB is close to Postgres syntax. Dialect quirks (identifier quoting, LIMIT/OFFSET, parameter style `$1` vs `?` vs `@name` vs `{n:Type}`, no RETURNING on some) mean a per-dialect shim is needed even where SQL is nominal.
- Custom: Neo4j/Memgraph (Cypher over Bolt; Memgraph is Bolt/Cypher-compatible so the Neo4j driver works, see Q4), ArangoDB (AQL), Elasticsearch/OpenSearch (JSON Query DSL; both also have limited SQL plugins), Meilisearch/Typesense/Algolia (REST filter strings), vector stores (similarity query APIs), Influx v2 (Flux).
- Elasticsearch/OpenSearch/Meilisearch/Typesense/Algolia/vector DBs: filter-and-search semantics, not general query; a "collection" abstraction maps to index/collection with documents.

### Gaps
- Dialect specifics (quoting, parameter style, pagination) were not verified from docs this session.
- QuestDB and TimescaleDB drivers not checked; no sources fetched for them at all.

## 4. Best-maintained Node drivers/SDKs and adoption signals

### Takeaway
All major systems have actively maintained first-party Node clients (published within the last ~2 months as of 2026-11-05) except Memgraph (no dedicated client; use the Neo4j driver) and Redshift (use the AWS Data API client or the Postgres wire protocol). Downloads show the warehouse and search clients are heavily used.

### Cited Findings
npm registry, queried 2026-11-05 (version, last modified, licence, weekly downloads):

| Package | Version | Last modified | Licence | Weekly dl |
|---|---|---|---|---|
| neo4j-driver (Neo4j, also Memgraph via Bolt) | 6.3.0 | 2026-10-29 | Apache-2.0 | 1,255,653 |
| arangojs | 10.6.0 | 2026-10-14 | Apache-2.0 | 47,967 |
| memgraph (npm name) | 0.0.1 | 2022-06-19 | n/a | not checked (stale; not a real client) |
| @elastic/elasticsearch | 9.5.1 | 2026-11-04 | Apache-2.0 | 3,167,623 |
| @opensearch-project/opensearch | 3.9.0 | 2026-09-23 | Apache-2.0 | 3,312,580 |
| meilisearch | 0.62.0 | 2026-09-09 | MIT | 1,004,361 |
| typesense | 3.2.0 | 2026-10-19 | Apache-2.0 | 1,307,579 |
| algoliasearch | 5.61.0 | 2026-10-29 | MIT | 9,868,651 |
| pgvector (node helper) | 0.3.1 | 2026-11-04 | MIT | 1,043,751 |
| @pinecone-database/pinecone | 9.1.0 | 2026-10-20 | Apache-2.0 | 1,040,923 |
| @qdrant/js-client-rest | 1.20.0 | 2026-10-23 | Apache-2.0 | 947,942 |
| weaviate-client | 3.15.3 | 2026-10-29 | BSD-3 | 496,403 |
| @zilliz/milvus2-sdk-node | 3.0.6 | 2026-10-14 | Apache-2.0 | 214,734 |
| chromadb | 3.5.0 | 2026-08-24 | Apache-2.0 | 265,128 |
| @influxdata/influxdb-client | 1.35.0 | 2026-09-02 | MIT | 205,598 |
| @influxdata/influxdb3-client | 2.4.0 | 2026-09-08 | MIT | 28,484 |
| @clickhouse/client | 1.25.0 | 2026-11-04 | Apache-2.0 | 4,770,159 |
| @google-cloud/bigquery | 9.6.0 | 2026-11-03 | Apache-2.0 | 6,869,382 |
| snowflake-sdk | 3.4.1 | 2026-10-30 | Apache-2.0 | 3,638,182 |
| @databricks/sql | 3.0.0 | 2026-11-05 | Apache-2.0 | 718,653 |
| @duckdb/node-api | 2.0.0-r.1 | 2026-10-21 | MIT | 3,222,486 |
| @motherduck/wasm-client | 1.5.6-r.1 | 2026-10-20 | MIT | not checked |
| @aws-sdk/client-redshift-data | not returned (command timed out/empty) | n/a | n/a | not returned |

- Source for all rows: npm registry and downloads API (`registry.npmjs.org`, `api.npmjs.org`), queried by CLI 2026-11-05.

### Inferences
- The `algoliasearch` figure is inflated by frontend InstantSearch usage; `@opensearch-project/opensearch` and `@elastic/elasticsearch` are inflated by AWS SDK/tooling and Kibana-style dependents (unverified).
- Majors just shipped (neo4j-driver 6, Databricks SQL 3, DuckDB node-api 2.0 pre-release "-r.1", Pinecone 9) imply some API churn risk; DuckDB's `-r.1` tag suggests the 2.0 line is still a release-candidate-style numbering.
- TimescaleDB is a Postgres extension and QuestDB speaks the Postgres wire protocol (unverified), so neither likely needs a bespoke driver.

### Gaps
- TimescaleDB, QuestDB, Memgraph official client guidance, Redshift Data API package metadata, and `pg`-compat details not checked.
- GitHub stars not collected (other than a blog claim of pgvector 22,100+ stars from [algeriatech.news](https://algeriatech.news/database-wars-postgres-mongodb-vector-2026/), not verified against GitHub).

## 5. Typical effort and risk of each as an adapter, and judgement: support vs ignore

### Takeaway
The judgement below is mine (inference from the evidence above and background knowledge, not a sourced finding). Recommended tiers: (A) cheap wins reusing existing work: pgvector (via Postgres adapter), TimescaleDB (via Postgres adapter), Memgraph (via Neo4j/Bolt) later; (B) worth a read-only SQL adapter: ClickHouse, BigQuery, Snowflake, DuckDB; (C) optional search-sync targets rather than sources: Meilisearch, Typesense, Elasticsearch/OpenSearch, Algolia; (D) ignore for now: Pinecone, Qdrant, Weaviate, Milvus, Chroma, InfluxDB, QuestDB, ArangoDB, Neo4j, Redshift, Databricks.

### Cited Findings
- Evidence of content-adjacent use is concentrated in search-engine CMS plugins (Strapi, Directus, Payload) — see Q1 sources.
- Snowflake, BigQuery, ClickHouse, DuckDB clients are each downloaded 3-7M times weekly, the highest among the specialised set besides Algolia — npm downloads API (Q4 table).
- Developer-survey usage of Neo4j (2.6%), ClickHouse (2.4%), Redshift (2.3%) is small; Elasticsearch (16.7%) is the clear outlier — [Stack Overflow 2025](https://survey.stackoverflow.co/2025/technology)

### Inferences (effort: S = days, M = 1-2 weeks, L = weeks; risk: all are my estimates)
- pgvector: effort S (type mapping, display `vector` as read-only/hidden; no new connection code). Risk low. Support.
- TimescaleDB: S via Postgres adapter; hypertables behave like tables. Risk low. Support as "Postgres flavour" (unverified details).
- ClickHouse: M read-only SQL adapter. Risk medium: HTTP client, typed params, 64-bit ints as strings, no real transactions/UPDATE semantics, mutations are async (mutation semantics unverified), abort does not guarantee no write (cited). Support read-only.
- BigQuery: M. Risk medium-high: money per scan, 10 MB minimum, LIMIT doesn't help (cited), needs service account/ADC, project/dataset/location handling, no primary keys (so no row identity for edit/detail pages; unverified background). Support read-only with cost guards (dry-run, max bytes billed).
- Snowflake: M. Risk medium-high: warehouse credit cost, auto-resume latency, key-pair/OAuth auth setup (cited options), identifier case folding (unverified). Support read-only.
- DuckDB / MotherDuck: S-M. Embedded; useful for Parquet/CSV/file sources and as a local analytics engine for the gateway itself. Risk: native binaries, pre-release `-r.1` Node API versioning, concurrency/file locking (unverified). Support read-only, optional.
- Databricks SQL: M, enterprise-only demand, PAT/OAuth auth, warehouse cold start. Defer until requested (unverified specifics).
- Redshift: M-L, Postgres-flavoured, mostly overlaps with Postgres adapter via wire protocol, but provisioned/serverless and IAM auth complicate it. Defer.
- Meilisearch / Typesense / Algolia: S-M each if treated as sync targets (index on publish) rather than sources; reading as a source loses relational data. Highest CMS relevance. Meilisearch/Typesense best first (open-source, simple REST, key-based auth); Algolia is SaaS, strong brand, key/app-id auth.
- Elasticsearch / OpenSearch: M as sync targets; L as generic sources (DSL, mappings, eventual consistency, no joins, two diverging forks with an unsupported compatibility guarantee between the 8.x/9.x clients and OpenSearch). Support at most one target first.
- Vector stores (Pinecone, Qdrant, Weaviate, Milvus, Chroma): S-M each as optional "embeddings sync" targets; poor candidates as content sources (no relational data, vendor-specific filters). Ignore as sources; consider one target only if AI-feature demand appears.
- Neo4j / Memgraph / ArangoDB: L as sources (graph model to collection/field mapping is lossy; Cypher/AQL not SQL). Ignore for now; Memgraph is Bolt/Cypher-compatible with Neo4j (unverified), so any Neo4j effort covers it.
- InfluxDB / QuestDB: time-series; low content relevance; Influx has two incompatible client generations (cited). Ignore.

### Gaps
- No user-demand data for SethuCMS specifically; ranking should be validated against actual customer requests.
- Effort/risk numbers are judgement calls, not sourced.
- Not verified: TimescaleDB, QuestDB, Memgraph-Bolt compatibility, Elasticsearch/OpenSearch client compatibility, Databricks and BigQuery auth details, and licence terms for Meilisearch/Typesense/Algolia server software (client licences are in the Q4 table).
