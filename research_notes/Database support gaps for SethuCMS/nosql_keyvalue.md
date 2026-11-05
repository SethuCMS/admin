# NoSQL (document, key-value, wide-column, multi-model) database support for a generic REST gateway

Research date: 2026-11-05. Search tooling was thin (several fetches returned partial pages), so only a limited number of claims carry citations. Everything marked "(unverified, background knowledge)" is NOT sourced and must be checked before use.

## Q1. Which are most widely used today and which are declining?

### Takeaway
MongoDB (#5), Redis (#8) and Cassandra (#10) are the dominant NoSQL systems on DB-Engines in 2026; DynamoDB sits around #18 there but is huge inside AWS and has the largest Node SDK usage of the cloud-native stores. Redis grew in the 2025 Stack Overflow survey; Redis licensing churn pushed a Valkey fork. Evidence of "decline" is mostly from npm/maintenance signals (HBase, RethinkDB, FoundationDB node client, PouchDB), not rankings.

### Cited Findings
- DB-Engines (via third-party reproduction, July 2026): MongoDB 5th (score ~386), Redis 8th (~153), Cassandra 10th (~103), DynamoDB 18th (~55). March 2026: MongoDB 5th (383.58), Redis 8th (145.19), Cassandra 11th (101.88). — [HelloGitHub July 2026 report](https://hellogithub.com/report/db-engines); [March 2026 blog](https://zatoima.github.io/en/db-engines-ranking-march-2026); official page [db-engines.com/en/ranking](https://db-engines.com/en/ranking) (scores differ between reproductions; not verified against the official page)
- DynamoDB was 18th overall in the Jan 2026 DB-Engines ranking (69.79) and 3rd among document stores in April 2026 (62.67). — [DB-Engines document stores](https://db-engines.com/en/ranking/document+store/all)
- DB-Engines assets were bought by Redgate Software in June 2024. — [Wikipedia](https://en.wikipedia.org/wiki/DB-Engines_ranking)
- Stack Overflow 2025: Redis was the strongest riser among top databases (about +8 points; sources quote ~28% vs 30.7%, conflicting); Redis described as fifth most used overall; 30.8% of professionals vs 12.1% of learners have used it extensively. A clean MongoDB percentage was not found. — [i-programmer](https://www.i-programmer.info/news/99-professional/18213-what-does-stack-overflows-survey-tell-us.html); [Redis survey analysis](https://booleanhunter.github.io/redisvl-for-javascript-dev-ecosystem-research/redis-ai-agents-analysis.html)
- Redis moved to SSPL in March 2024, which led AWS and Google to maintain their own fork (Valkey); Redis added AGPLv3 as a licensing option starting with Redis 8 (announced 2025-05-01). — [Redis blog](https://redis.io/blog/agplv3/)
- npm weekly downloads (week 2026-10-29 to 2026-11-04, from api.npmjs.org): mongodb 21.04M; ioredis 42.4M; redis 20.9M (@redis/client 22.6M); @upstash/redis 7.29M; @aws-sdk/client-dynamodb 17.7M; @aws-sdk/lib-dynamodb 9.8M; @azure/cosmos 1.36M; @google-cloud/bigtable 385k; cassandra-driver 376k; @valkey/valkey-glide 695k; nano (CouchDB) 102k; couchbase 98k; pouchdb 88k; @datastax/astra-db-ts 67k; foundationdb 4k; rethinkdbdash 11k. — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/mongodb) (same endpoint pattern per package)
- npm latest versions / last registry modification (registry.npmjs.org, fetched 2026-11-05): client-dynamodb 3.1162.0 (2026-11-04); ioredis 6.0.0 (2026-10-12); redis 6.3.1 (2026-10-29); valkey-glide 2.5.3 (2026-11-05); @upstash/redis 1.41.0 (2026-11-05); cassandra-driver 4.10.0 (2026-09-23); astra-db-ts 2.3.0 (2026-07-15); couchbase 4.7.2 (2026-10-30); @azure/cosmos 4.10.1 (2026-09-14); nano 11.0.8 (2026-11-03); pouchdb 9.0.0 (2025-10-13); @google-cloud/firestore 9.4.0 (2026-10-22); firebase-admin 14.5.0 (2026-10-21); @google-cloud/bigtable 7.5.1 (2026-10-29); surrealdb 2.2.2 (2026-11-04); arangojs 10.6.0 (2026-10-14); etcd3 1.1.2 (2026-04-24); rethinkdb 2.4.2 (2026-06-29); hbase 0.6.1 (2022-06-18, stale); foundationdb 2.0.1 (2023-04-18, stale); rethinkdbdash 2.3.31 (2022-06-26, stale). — [registry.npmjs.org](https://registry.npmjs.org/ioredis) (pattern per package)

### Inferences
- Priority by real-world use plus SDK health: MongoDB-wire family > Redis/Valkey > DynamoDB > Cassandra/Scylla > Cosmos NoSQL > Firestore > Couchbase > CouchDB > rest.
- Stale/low-use signals: HBase (no maintained Node client; usually reached via Thrift/REST gateway), FoundationDB (node binding last published 2023, 4k/wk), RethinkDB (project community-maintained; rethinkdbdash unmaintained since 2022), PouchDB (client-side sync library, last release Oct 2025). Treat as "do not build" or last-priority.
- Rising: Valkey (GLIDE active, releases daily/weekly), SurrealDB (active JS SDK), Redis 8 (back to OSI license reduces Valkey urgency). Dragonfly/KeyDB speak the Redis protocol so need no separate adapter.

### Gaps
- No verified numbers for Firestore/Firebase RTDB, KeyDB, Dragonfly, ScyllaDB, Astra DB, HBase, ArangoDB, etcd on DB-Engines or Stack Overflow; weekly downloads for firebase-admin, @google-cloud/firestore, surrealdb, arangojs, etcd3 returned rate-limit errors.
- Official db-engines.com ranking page and the official Stack Overflow results page were not directly fetched.
- Decline claims for HBase/RethinkDB/FoundationDB are inferred from npm staleness, not from a source stating decline (unverified).

## Q2. Which are wire-compatible with MongoDB versus needing their own driver?

### Takeaway
Use the official `mongodb` driver for MongoDB, Amazon DocumentDB, Azure Cosmos DB for MongoDB (RU and vCore/Azure DocumentDB) and FerretDB 2.x, but with per-engine capability flags because each lacks some MQL features. Everything else (DynamoDB, Cosmos NoSQL, Couchbase, CouchDB, Firestore, Redis family, Cassandra family, Bigtable, SurrealDB, ArangoDB, etcd) needs a dedicated driver.

### Cited Findings
- Amazon DocumentDB supports MongoDB 4.0, 5.0 and 8.0 API compatibility; version 8.0 claims wire compatibility with MongoDB 8.0 drivers and also supports 6.0/7.0 apps; requires a driver compatible with MongoDB 5.0+ (4.0+ for 4.0 clusters); TLS 1.2+ for 5.0.1/8.0. It "does not support every MongoDB feature"; supported-API list is at mongo-apis. — [AWS DocumentDB compatibility](https://docs.aws.amazon.com/documentdb/latest/developerguide/compatibility.html)
- DocumentDB 8.0 added views, collation, $merge, $vectorSearch etc.; 4.0 lacked type-conversion and string operators; Planner v1 vs v3 changes which features work. — same AWS page
- Azure Cosmos DB for MongoDB supports the MongoDB wire protocol so existing drivers work, "often just updating the connection string"; Microsoft points MQL-heavy workloads to Azure DocumentDB instead. — [Microsoft Learn](https://learn.microsoft.com/en-us/azure/cosmos-db/mongodb/introduction)
- FerretDB 2.0 (GA, Apache 2.0) is a proxy converting MongoDB 5.0+ wire protocol to SQL on PostgreSQL using Microsoft's open-sourced DocumentDB extension (the engine behind Cosmos DB for MongoDB vCore); FerretDB 1.x remains for legacy; CEO estimate ~80% of workloads, not a full drop-in. — [Linuxiac](https://linuxiac.com/ferretdb-2-0-open-source-document-database-goes-ga/); [The New Stack](https://thenewstack.io/ferretdb-2-0-open-source-mongodb-alternative-with-postgresql-power/); [InfoQ](https://www.infoq.com/news/2025/02/ferretdb-documentdb)

### Inferences
- One adapter class "mongodb-wire" with a `flavor` field (mongodb | documentdb | cosmos-mongo-ru | cosmos-mongo-vcore | ferretdb) and feature probes (`buildInfo`, try-and-fallback) covers 5 products. Key risks: unsupported aggregation stages, collation, transactions, change streams and `$text` differences, TLS CA bundles (DocumentDB requires global-bundle.pem), retryWrites=false on DocumentDB/Cosmos (unverified, background knowledge).
- Other wire-compatible/cross-protocol: Dragonfly, KeyDB, Valkey, Upstash (Redis protocol; Upstash also REST); ScyllaDB (CQL, plus a DynamoDB-compatible API "Alternator"); Astra DB (own Data API plus CQL) (all unverified, background knowledge).

### Gaps
- Exact Cosmos RU-API supported MQL version and FerretDB feature matrix not fetched.
- ScyllaDB Alternator, Astra Data API, Dragonfly/KeyDB compatibility not verified with sources.

## Q3. Query/filter limits, best Node SDKs, pagination tokens, capability flags (DynamoDB, Redis/Valkey, Cassandra/Scylla, Cosmos NoSQL, Couchbase)

### Takeaway
None offer arbitrary filter+sort+offset pagination on any field. DynamoDB: Query needs a partition key (+ optional sort-key condition), Scan reads everything. Cassandra: partition-key-driven, ordering only by clustering order, ALLOW FILTERING = full scan. Redis: key/scan based only. Cosmos NoSQL and Couchbase (SQL++) are the only ones with SQL-style queries, but need indexes and have continuation-token semantics. A gateway must model each as a set of capability flags and degrade or refuse unsupported list queries.

### Cited Findings
DynamoDB
- Query requires the partition key attribute and a single value; a sort key condition can optionally refine results. — [AWS Query docs](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.html)
- Scan reads up to 1 MB per call, applied before FilterExpression; so filtered pages can be empty while more matches exist; `ScannedCount` can exceed `Count`. — [AWS Scan docs](https://docs.aws.amazon.com/de_de/amazondynamodb/latest/developerguide/Scan.md)
- Pagination: if `LastEvaluatedKey` is returned, repeat the identical request with it as `ExclusiveStartKey` until absent; parallel-scan tokens are segment-specific. — same AWS Scan page; [Scan API](https://docs.aws.amazon.com/zh_cn/amazondynamodb/latest/APIReference/API_Scan.html)
- Items within one partition key come back in ascending sort-key order. — AWS Scan page (Japanese mirror)
- Best Node SDK: AWS SDK v3 `@aws-sdk/client-dynamodb` (17.7M/wk) plus `@aws-sdk/lib-dynamodb` document client (9.8M/wk), released daily. — npm links above

Cassandra / Scylla
- CQL rejects queries that would scan all partitions unless `ALLOW FILTERING` is added (full scan, unpredictable). ORDER BY only by clustering columns' order or its reverse; only equality is allowed on the partition key; WHERE must target primary-key or secondary-indexed columns; `LIMIT`/`PER PARTITION LIMIT` exist. — [Cassandra CQL DML docs](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/dml.html)
- Node: `cassandra-driver` 4.10.0 (376k/wk, last release 2026-09-23); Astra DB has `@datastax/astra-db-ts` 2.3.0 (67k/wk). — npm registry

Cosmos DB (NoSQL API)
- Queries page automatically; `MaxItemCount` sets max items per page but pages can be smaller or empty (throttling, size, time); must iterate until no more pages. — [Microsoft Learn pagination](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/query/pagination)
- Continuation tokens are stateless, do not expire for the same SDK version, one token regardless of partitions; not usable with GROUP BY/DISTINCT (DISTINCT works with ORDER BY). Docs show continuation-token examples for .NET/Java; the Python note says cross-partition sorted/aggregate queries do not support tokens. Node sample linked in docs. — same page
- Node: `@azure/cosmos` 4.10.1 (1.36M/wk). — npm registry

Couchbase
- Node SDK 4.7 supports SQL++ via `cluster.query()` with positional parameters. Whether indexes are required was not stated on the page fetched. `couchbase` npm 4.7.2, 98k/wk, last 2026-10-30. — [Couchbase Node SDK docs](https://docs.couchbase.com/nodejs-sdk/current/hello-world/overview.html); npm registry

Redis / Valkey
- Clients: `ioredis` 6.0.0 (42.4M/wk), `redis`/`@redis/client` 6.3.1 (~21-23M/wk, active), `@valkey/valkey-glide` 2.5.3 (695k/wk, official Valkey client; has ioredis migration guide), `@upstash/redis` 1.41.0 (7.3M/wk, REST/HTTP). — npm registry; [GLIDE ioredis migration](https://glide.valkey.io/migration/nodejs/ioredis/command-comparison-chart/); [Glama benchmark Jan 2026](https://glama.ai/blog/2026-01-26-redis-vs-ioredis-vs-valkey-glide) (single author's benchmark, GLIDE fastest in their SET/GET test)

### Inferences (capability flags a generic adapter must accept)
Suggested flags per collection/resource (mapping from findings above plus unverified background knowledge):
- `canList` (bool), `listMode`: `query` | `scan` | `keyspace-scan` | `none`
- `filterable`: set of fields and operators allowed (DynamoDB: only key attrs for Query; any attr via Scan FilterExpression with read-cost; Cassandra: PK/clustering/indexed; Cosmos/Couchbase: indexed paths, ideally any)
- `requiredFilters`: e.g. partition key must be equal-constrained (DynamoDB Query, Cassandra)
- `sortable`: fields + directions (DynamoDB: sort key only, asc/desc via ScanIndexForward (unverified); Cassandra: clustering order only; Cosmos/Couchbase: indexed/composite only; Redis: sorted sets or none)
- `pagination`: `opaque-cursor` only (no offset, no total count); `maxPageSizeNotGuaranteed` (pages may return fewer or zero items, loop until limit or cursor ends); `cursorStable` (Cosmos tokens do not expire; DynamoDB keys are plain key objects; Cassandra paging state is per-query (unverified))
- `totalCount`: none/expensive; `offset`: not supported (Cosmos has OFFSET LIMIT per background knowledge, unverified, costly)
- `consistency`/`costWarning`: scan may consume read capacity or RUs; gateway should enforce max scan budget and timeouts
- `writes`: `upsertByKey` semantics; `conditionalWrites`; `transactions` (limited); `partialUpdate` (DynamoDB UpdateExpression, Cosmos patch, Couchbase subdoc, Redis hash fields)
- Gateway should return cursors as opaque signed/base64 JSON of {engine token, query hash} and reject a cursor if filters/sort changed.

### Gaps
- Couchbase index requirements (primary index, GSI), Cosmos OFFSET/LIMIT and composite-index ORDER BY requirements, and Cassandra paging-state specifics were not retrieved; marked unverified.
- DynamoDB key-condition operator list, 400 KB item limit, Query-vs-Filter docs sub-pages (Query.FilterExpression, Query.Pagination) not directly fetched; only the Query index page and Scan docs were.
- Redis has no queries beyond SCAN/keys/sorted sets/RediSearch; no source fetched for RediSearch (Redis Query Engine, included in Redis 8 per the licensing blog) support on Valkey or managed services.
- Node SDK last-release dates are npm "modified" timestamps, which may reflect metadata changes rather than code releases.

## Q4. Typical effort and key risks per adapter

### Takeaway
No source-based effort figures exist; the estimates below are inferences. Mongo-wire family is cheapest (reuse one adapter); DynamoDB and Cosmos are medium; Redis/Cassandra/Couchbase are medium to high because of modeling (no schema, key patterns) and index dependence.

### Cited Findings
- (Only supported facts) Cosmos for MongoDB and DocumentDB each state wire-protocol drivers work with some feature gaps; FerretDB is "not a full drop-in". — sources in Q2
- Cosmos tokens/pages behave non-uniformly (empty pages, no tokens for DISTINCT/GROUP BY). — [Microsoft Learn](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/query/pagination)

### Inferences (effort in engineer-days, unverified estimates)
- MongoDB (base adapter): 5-10 days; each extra flavor (DocumentDB, Cosmos RU/vCore, FerretDB): 1-3 days for probes/TLS/feature flags. Risks: ObjectId/BSON type serialization to JSON, `$regex`/collation gaps, schema inference on sampled docs, unindexed sort memory limits.
- DynamoDB: 8-12 days. Risks: Scan cost on customer account, empty filtered pages, marshalling (Set/Number/Binary types, lib-dynamodb vs low-level), GSI discovery via DescribeTable, composite keys, capacity throttling, IAM least-privilege setup.
- Redis/Valkey/Upstash/Dragonfly/KeyDB: 8-15 days; requires user-defined key-pattern "collections" (e.g. `user:*` hashes/JSON), SCAN has no ordering/filtering, JSON/Search modules not universally available, cluster mode, TLS/ACL, danger of KEYS/FLUSH commands (must be blocked).
- Cassandra/Scylla/Astra: 10-15 days. Risks: partition-key-required queries, ALLOW FILTERING danger (default off), tombstones, token-aware routing/datacenter config, secure bundle for Astra, type mapping (UDTs, collections, counters).
- Cosmos NoSQL: 6-10 days. Risks: RU throttling (429) and retry, cross-partition query cost, partition key must be known for point reads/writes/deletes, continuation token gaps for aggregate queries.
- Couchbase: 8-12 days. Risks: native `couchbase` SDK build/binary compat (note 98k/wk, lower adoption), need SQL++ indexes, scopes/collections modeling, Capella TLS, N1QL injection (use parameters).
- Firestore/Firebase RTDB: 6-10 days. Firestore queries need composite indexes, cursor via startAfter (unverified); RTDB has only single-property orderBy (unverified).
- CouchDB (nano): 4-6 days (Mango queries/views, `_id` bookmark pagination (unverified)); PouchDB is a client sync lib, skip.
- Bigtable, HBase, FoundationDB, etcd, RethinkDB, SurrealDB, ArangoDB: low priority. ArangoDB (AQL) and SurrealDB (SurrealQL) are query-capable and cheap-ish (5-8 days) but low demand; etcd is a config KV store (range/prefix reads only); Bigtable needs row-key-design-based scans; HBase and FoundationDB have no maintained Node clients (per npm staleness); RethinkDB project is in maintenance mode (unverified).
- Security risks common to all: stored credentials, least-privilege IAM/ACL, read-only default role, query injection (parameterize), SSRF via host config, result-size caps, hidden-field/permission filtering applied post-read when engine cannot filter.

### Gaps
- No reliable external source on adapter effort; all numbers are judgment estimates.
- Firestore, CouchDB, SurrealDB, ArangoDB, Bigtable, etcd query/pagination specifics were not researched with sources due to tool limits.
