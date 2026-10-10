# AGENTS.md — sethucms-admin

The admin app (React 19, Vite).

This repository is one part of SethuCMS. **Read `../sethucms/AGENTS.md` first** for the whole picture, the security rules that must not be broken, and the working agreements.

## Build and test

```sh
pnpm install && pnpm typecheck && pnpm build:embedded
```

## Notes

The gateway serves the built app; build:embedded makes it call its own address. Fonts are bundled, never loaded from the internet. The token is kept in memory and sessionStorage only. Words: sentence case, plain verbs, same name for an action everywhere.

## Always

- Run the tests for what you changed and say what you ran and what you could not run.
- Do not `git commit` or `git push` unless the owner asks.
- Never print or store a secret, token or password.
