# sethucms-admin

The admin panel for [SethuCMS](https://github.com/sethucms/sethucms). It talks only to the
SethuCMS gateway, never to a database directly.

## What you can do

| Page | What it is for |
|---|---|
| **Home** | One sentence on whether your connections are healthy, what each database can do, what is waiting for review, and recent activity |
| **Content** | A three-pane studio: pick a connection and collection, search and page through records, edit one in a form built from the collection's fields |
| **Drafts and publish** | Edits are saved automatically as a draft. Nothing reaches your database until you press **Publish**. If the record changed meanwhile you are asked before overwriting it |
| **Live preview** | Opens a signed preview link for the draft and shows it updating as you type. The same link can be used by your own website |
| **Connections** | Add several databases at once, test them, read their structure again, choose which collections appear in the API, switch between read-only and read-write |
| **Roles and access** | Create and revoke API tokens (admin, editor, viewer) |
| **Audit log** | Who changed what, and when. Passwords and tokens are never recorded |

Sign-in uses an API token. The gateway prints the first admin token when it starts for the first time.

## Run it with the gateway (one process)

The gateway can serve this app, so one command runs everything. From the `sethucms` repository:

```sh
sh scripts/build-all.sh     # builds core, adapters, gateway and this app
sh scripts/run-local.sh     # starts http://127.0.0.1:8080
```

This app is built with `pnpm build:embedded`, which makes it call the address it was loaded from.

## Develop the admin on its own

```sh
pnpm install
pnpm dev
```

Without configuration the home page shows **sample data** and the other pages say they need a gateway.
To use a real gateway while developing, start it (`sh scripts/run-local.sh` in `sethucms`), then copy
`.env.example` to `.env` and set:

```
VITE_API_URL=http://127.0.0.1:8080
```

and allow the dev server's address in the gateway: `SETHUCMS_ALLOWED_ORIGINS=http://localhost:5173`.

## Layout

| Path | What it does |
|---|---|
| `src/api/gateway.ts` | The one place that talks to the gateway: types, token handling, every request |
| `src/auth.tsx` | Sign-in state and the live-events hook |
| `src/router.ts` | Small hash router (`#/content/conn_1/articles/42`) |
| `src/components/` | Pages (`HomePage`, `ContentPage`, `ConnectionsPage`, ...) and parts (`RecordEditor`, `FieldInput`, `PreviewPane`) |
| `src/lib/` | Plain helpers: headline sentence, capability cells, relative time |
| `src/styles.css` | All styling, with colour and type tokens at the top. Light and dark themes |

## Security notes

- The token is kept in memory and `sessionStorage` (cleared when the tab closes) and is sent only in the `Authorization` header, never in a URL.
- Fonts and images are bundled, never inlined as `data:` URLs, so the gateway can serve the app with a strict Content-Security-Policy (everything from its own address only).
- Error messages shown to people come from the gateway's standard error body. Database error text never reaches the browser.
