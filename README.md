# splitnext

A local-first app for splitting shared costs among a small group of friends — groups, members, expenses, derived balances. It records and suggests; it never moves money.

No accounts: a per-device capability token proves access to a group, members are name-slots rather than logins, and everything works offline and merges when it reconnects.

**Try it:** https://santistebanc.github.io/splitnext-app/ — landing, then **Use on web** for the framed live app. Direct app: https://santistebanc.github.io/splitnext-app/app/

The slicer board is a local dev tool (`npm run board:serve`), not the public site.

## Stack

Expo React Native 57 + Expo Router · Legend State v3 · expo-sqlite (localStorage on web) · Cloudflare Worker + SQLite Durable Object per group + D1 token index · TypeScript · Vitest · Playwright for flow capture.

## Running it

```bash
npm install
cp .env.example .env      # already holds the Worker URL
npm start                 # phone, via Expo Go
npm run web               # the whole app in a browser
```

```bash
npm test                  # seam tests (vitest)
npm run typecheck         # tsc --noEmit
npm run capture           # record a clip per flow (needs `npm run web` running)
python3 docs/scripts/generate-slicer-board.py   # regenerate docs/slicer.html
```

## How it is built

One **slice** at a time: a narrow but complete path through every layer that runs and can be demoed on its own. Each slice is a branch → PR → one squashed commit on `main`, tagged `slice-NNNN`, with an archive under `docs/state/slices/` recording what shipped, what the edge paths were, and which decisions it made.

`docs/state/` is the source of truth for that loop:

| File | What it holds |
| --- | --- |
| `OVERVIEW.md` | Where the app stands today — direction, capabilities, stack, data model, routes, seams |
| `LOGIC.md` | Every behaviour piece, `L-` ids |
| `FLOWS.md` | End-to-end flows, `F-` ids, citing the logic they use |
| `NEXT.md` | The next slice as a delta |
| `PARKING.md` | Everything deferred, with its tier |
| `DECISIONS.md` | Append-only `D-NNN` |
| `slices/` | One archive per closed slice |

## Working on it with an AI agent

Read [`AGENTS.md`](AGENTS.md) first — it is the entry point, and `CLAUDE.md` just imports it. The process itself is vendored into the repo under [`.claude/skills/`](.claude/skills/) (`slicer`, `tdd`, `code-review`, `prototype`), so any agent that can read files can run the same loop without depending on a machine-local skill install.

## License

See [LICENSE](LICENSE).
