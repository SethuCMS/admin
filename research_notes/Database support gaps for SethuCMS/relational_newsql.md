# Relational and distributed-SQL (NewSQL) engines for a "CMS over any database" gateway

Research date: 2026-11-05. Items tagged [UNVERIFIED] come from background knowledge, not a fetched source this session.

## Which relational engines matter by adoption today?

### Takeaway
PostgreSQL is the most-used database among developers (Stack Overflow 2025); Oracle, MySQL, SQL Server and PostgreSQL are the top four on DB-Engines, in that order. MariaDB and SQLite are widely used but score low on DB-Engines. Db2 and SAP HANA are enterprise niches (not verified this session).

### Cited Findings
- Stack Overflow Developer Survey 2025, usage, all respondents: PostgreSQL 55.6%, MySQL 40.5%, SQLite 37.5%, SQL Server 30.1%, MariaDB 22.5%, Oracle 10.6%. Professional developers: PostgreSQL 58.2%, MySQL 39.6%, SQLite 36.9%, SQL Server 30.9%, MariaDB 21.7%, Oracle 10.4% — [Stack Overflow 2025](https://survey.stackoverflow.co/2025/technology)
- DB-Engines July 2026 scores (secondary source): Oracle 1132, MySQL 846, SQL Server 698, PostgreSQL 687, MongoDB 386 — [HelloGitHub report](https://hellogithub.com/report/db-engines)
- DB-Engines March 2026 scores: Oracle 1182.46, MySQL 858.34, SQL Server 711.47, PostgreSQL 680.08 — [zatoima scrape](https://zatoima.github.io/en/db-engines-ranking-march-2026)
- Same top-three order (Oracle, MySQL, SQL Server) is shown on Wikipedia's DB-Engines page; one analysis describes the three as slowly declining and PostgreSQL slowly rising — [Wikipedia](https://en.wikipedia.org/wiki/DB-Engines_ranking)
- Node driver weekly npm downloads (2026-10-29 to 2026-11-04): pg 93.7M, mysql2 23.2M, better-sqlite3 15.8M, mssql 4.73M, tedious 7.34M, oracledb 1.22M, mariadb 1.18M — [npm API](https://api.npmjs.org/downloads/point/last-week/pg) (same endpoint pattern for each package)

### Inferences
- Priority by developer usage and Node ecosystem: PostgreSQL > MySQL/MariaDB > SQLite > SQL Server >> Oracle. DB-Engines favors Oracle because it measures enterprise presence and mentions, not hands-on usage; a CMS gateway's users resemble the Stack Overflow audience.
- Download counts for pg and mysql2 are inflated by ORMs and CI; use them as order-of-magnitude only.

### Gaps
- Could not load db-engines.com directly (certificate error); scores come from secondary sites. Db2, SAP HANA, Snowflake-class and other ranks not verified. JetBrains/State of DB survey not retrieved.

## Which distributed/NewSQL engines are Postgres- or MySQL-wire-compatible, and what differs?

### Takeaway
CockroachDB, YugabyteDB, AlloyDB, Aurora DSQL and Spanner (via PGAdapter) speak the Postgres protocol and work with `pg`; TiDB, SingleStore, OceanBase (MySQL mode) and Vitess speak the MySQL protocol and work with `mysql2`. Dialect gaps (sequences, DDL, types, isolation, introspection) are where a gateway breaks, not the wire protocol.

### Cited Findings
- CockroachDB: PostgreSQL wire protocol 3.0; works with most PG drivers/ORMs; reports PostgreSQL 18 in `server_version`; pg_catalog aligned with PG 18 — [CockroachDB docs](https://docs.cockroachlabs.com/docs/stable/postgresql-compatibility)
- CockroachDB gaps: no range types; INT is always 64-bit; integer `/` returns decimal (use `//`); session-scoped advisory locks unsupported; deadlocked transactions fail with a retry error the client must retry; no column-level privileges, FDWs, XML functions, events — [CockroachDB docs](https://docs.cockroachlabs.com/docs/stable/postgresql-compatibility)
- TiDB: MySQL protocol, targets MySQL 5.7 and 8.0; works with DBeaver, Workbench etc.; X-Protocol and MySQL replication protocol unsupported — [TiDB docs](https://docs.pingcap.com/tidb/stable/mysql-compatibility/)
- TiDB unsupported: stored procedures/functions, triggers, events, UDFs, SPATIAL/GIS, XA, `CREATE TABLE ... AS SELECT`, descending indexes, `SKIP LOCKED`; only ascii/latin1/binary/utf8/utf8mb4/gbk charsets; `lower_case_table_names` only 2; FULLTEXT only on TiDB Cloud Starter in some regions — [TiDB docs](https://docs.pingcap.com/tidb/stable/mysql-compatibility/)
- TiDB auto-increment: IDs unique and increasing per server but not sequential across servers; AUTO_INCREMENT causes hotspots, `AUTO_RANDOM` recommended; defaults utf8mb4 / utf8mb4_bin — [TiDB docs](https://docs.pingcap.com/tidb/stable/mysql-compatibility/)
- Google Spanner PostgreSQL interface: needs PGAdapter (local proxy) for wire-protocol; supports PostgreSQL JDBC, pgx, psql; extensions, user-defined types and stored procedures unsupported; pgAdmin unsupported; Node.js has native Spanner client that is not PG-compatible — [Spanner docs](https://docs.cloud.google.com/spanner/docs/postgresql-interface)
- Aurora DSQL: English docs say no PostgreSQL extensions (PL/pgSQL, PostGIS, pgvector, pg_cron etc.); unsupported commands include TRUNCATE, SAVEPOINT, VACUUM; asyncpg unsupported; localized pages list also foreign keys, temp tables, triggers, sequences, partitions, and fixed Repeatable Read, single `postgres` database — [AWS docs](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-unsupported-features.html); Dec 2024 preview gaps (FKs, views, triggers, sequences) — [DevClass](https://devclass.com/2024/12/09/amazon-explains-absence-of-familiar-features-in-postgresql-compatible-aurora-dsql/)
- [UNVERIFIED, background knowledge] YugabyteDB YSQL reuses the PostgreSQL query layer (full PG wire, works with `pg`, supports sequences/FKs/triggers/extensions in part). AlloyDB is PostgreSQL-compatible (essentially PG, `pg` works). SingleStore, Vitess (via vtgate) and OceanBase MySQL mode work with `mysql2`; Vitess has restrictions on cross-shard queries/FKs. OceanBase also has an Oracle-compatibility mode (needs OBClient/proprietary protocol). Yugabyte fetch returned nothing usable.

### Inferences
- A gateway that supports `pg` + `mysql2` gets the whole NewSQL family nearly free if it avoids: server-side sequences/serial assumptions (DSQL), `RETURNING`/`LASTVAL` assumptions on MySQL-family, SAVEPOINT (DSQL), and transaction retries (CockroachDB `40001` error needs retry logic).
- Introspection via `information_schema` works on all of them; `pg_catalog` is a fallback only where aligned (CockroachDB). Rely on `information_schema.columns/tables/key_column_usage/table_constraints` and treat the rest as best-effort.
- Spanner PG is the awkward one: needs PGAdapter sidecar, so list as "supported through proxy".

### Gaps
- YugabyteDB, AlloyDB, SingleStore, OceanBase, Vitess official compatibility pages not fetched (budget). Exact isolation default per engine (CockroachDB Serializable, TiDB snapshot-isolation "Repeatable Read", Yugabyte Snapshot) not verified from sources.

## SQL Server and Oracle: drivers, licensing, dialect, effort

### Takeaway
SQL Server is reachable with `mssql` (tedious, MIT, pure JS) and Oracle with `oracledb` (Apache-2.0/UPL dual-licensed, Thin mode needs no Oracle client). Both are healthy and actively released; the cost is a separate SQL dialect adapter, not licensing.

### Cited Findings
- `mssql` latest npm version 12.7.14 (also 11.x, 10.x, 9.x maintenance lines) — [npm registry](https://registry.npmjs.org/-/package/mssql/dist-tags); ~4.7M downloads/week — [npm API](https://api.npmjs.org/downloads/point/last-week/mssql)
- `mssql` uses tedious by default (pure JS); optional msnodesqlv8 adds Windows Authentication; named parameters use `@name` with `request.input()`; do not name params `@p{n}`; `encrypt` defaults true; Azure AD auth modes supported — [node-mssql docs](https://tediousjs.github.io/node-mssql/)
- `tedious` 20.3.8, MIT, requires Node >= 22 — [npm registry](https://registry.npmjs.org/tedious/latest)
- `oracledb`: dual-licensed Apache-2.0 OR UPL-1.0; npm latest 26.0.0, Node >= 14.17 — [npm registry](https://registry.npmjs.org/oracledb/latest), [GitHub](https://github.com/oracle/node-oracledb); GitHub README says "26.1.0-dev"; 2.4k stars
- Thin mode (default since 6.0) is pure JS, needs Oracle Database 12.1+; Thick mode needs Oracle Client 19+ and reaches 11.2; tested against Oracle DB 26, 21, 19, 12, 11.2 and Node 18/20/22/23 — [node-oracledb docs](https://node-oracledb.readthedocs.io/en/latest/user_guide/introduction.html)
- v7.0.0 added Thin mode Direct Load and Database Pipelining for Oracle AI Database 26ai; 7.0.1 followed (both noted in release pages; a version-number mismatch with npm 26.0.0 exists — Oracle appears to have moved to a year-based scheme; check) — [release notes discussion](https://github.com/oracle/node-oracledb/discussions/1774)
- [UNVERIFIED, background knowledge] Dialect: SQL Server quotes with `[ident]` or `"ident"`, paginates with `ORDER BY ... OFFSET n ROWS FETCH NEXT m ROWS ONLY` (2012+; requires ORDER BY) or `TOP`, identity via `IDENTITY(1,1)` and `OUTPUT INSERTED.*` instead of `RETURNING`, introspection via `INFORMATION_SCHEMA` and `sys.*`. Oracle quotes with `"IDENT"` (case-folds to uppercase unquoted), paginates with `OFFSET n ROWS FETCH NEXT m ROWS ONLY` (12c+) or ROWNUM, identity columns `GENERATED ... AS IDENTITY` (12c+), binds are `:name` or `:1`, `RETURNING ... INTO :out`, introspection via `ALL_TAB_COLUMNS`, `ALL_CONSTRAINTS`, `ALL_CONS_COLUMNS` (no `information_schema`), VARCHAR2 and NUMBER types, empty string equals NULL, no boolean column before 23ai.

### Inferences
- Effort estimate (judgment): SQL Server adapter is moderate (pagination, OUTPUT, bracket quoting, `@` params, `sys` introspection); Oracle is larger (uppercase folding, no information_schema, `:n` binds, empty-string-NULL, BOOLEAN, RETURNING INTO). No licensing blocker for either driver; Oracle DB itself is commercial, so testing needs Oracle XE/Free container.
- Oracle download volume (1.2M/week) is ~1/4 of mssql; supports prioritizing SQL Server first.

### Gaps
- No licensing check for `mssql` package itself (docs page didn't state it; commonly MIT [UNVERIFIED]). Oracle version-number scheme and Thin mode feature limits not confirmed. Db2 and SAP HANA drivers (`ibm_db` requires native clidriver; `@sap/hana-client` is proprietary/closed; `hdb` pure JS) not researched this session [UNVERIFIED].

## Parameter placeholders and schema introspection per engine

### Takeaway
Placeholders: Postgres family `$1..$n`; MySQL family `?`; SQL Server `@name`; Oracle `:name`/`:1`; SQLite `?` (also `:name`, `@name`, `$name`). Introspection: `information_schema` for PG/MySQL families and SQL Server; Oracle needs `ALL_*` views.

### Cited Findings
- SQL Server `@name` parameters — [node-mssql docs](https://tediousjs.github.io/node-mssql/)
- CockroachDB pg_catalog alignment with PG 18 and information_schema usable through standard PG drivers — [CockroachDB docs](https://docs.cockroachlabs.com/docs/stable/postgresql-compatibility) (information_schema itself not described on page)
- TiDB reports InnoDB in metadata regardless of engine — [TiDB docs](https://docs.pingcap.com/tidb/stable/mysql-compatibility/)

### Inferences
- A thin dialect interface (quoteIdent, placeholder(n), paginate, insertReturning, listTables/columns/keys, type map) covers all engines above; the rest is per-engine query text.

### Gaps
- Placeholder styles for pg, mysql2, oracledb, SQLite are from background knowledge, not fetched pages [UNVERIFIED]. Spanner page did not mention placeholders or information_schema.
