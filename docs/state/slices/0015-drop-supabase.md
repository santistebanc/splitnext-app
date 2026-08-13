# Slice 0015 — Drop leftover host files

**Tier** — foundation-risk · **Closed** — 2026-08-13 · **Tag** — `slice-0015`

## What shipped

The live tree, README, and current-state docs describe only the Cloudflare Worker. `supabase/` is gone. Slice archives and `DECISIONS.md` still record what shipped then.

## Report

### Headline
Nothing a clone or an agent would follow still points at the old host.

### Highlights
- Deleted `supabase/` (config + Postgres migrations kept as history by D-064) and the two research notes that still argued for or against it.
- README, OVERVIEW, PARKING, and live comments say Worker / wake socket.
- `npm run audit` fails if `supabase/` returns or if a current-state doc names the old host.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| `supabase/` | Migrations kept as history | Gone |
| README | Stack and setup named the old host | Worker URL |
| Audit | Silent on a leftover tree | Finding |

### Logic delta

- **Changed** — `L-wakeCatchUp` (parameter name `hasSocket`; status strings unchanged, D-061)

### Flow delta

- **Changed** — `F-wake-reconnect` (step 1: socket, not channel)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| audit | `supabase/` still on disk | Finding; CI red |
| audit | OVERVIEW still names the old host | Finding; archives and `DECISIONS.md` naming it do not fail |
| clone | `cp .env.example .env` | Worker URL, no anon key |

### Review

- **Invariants** — cents, version merge, soft-delete, client talks only to the Worker. D-065 says so rather than quietly reversing D-064's keep-migrations clause. Archives and past `D-NNN` rows were left as history.
- **Spec** — tree and live docs match the plan. Wake status strings (`SUBSCRIBED` / `CHANNEL_ERROR`) stayed, as scoped.
- **Standards** — audit is the seam that keeps this true. Test files next to a seam are not map rows. Accepted: `node_modules/@legendapp/state/sync-plugins/` still ships an unused third-party plugin file; it is not ours.

### Shots

No capture: no surface changed.

### Surfaces touched

- **Client** — comments in `groupSync.ts`, `invite.ts`, `timestamps.ts`; `wakePolicy` parameter name
- **Repo** — `supabase/` deleted, `deno.lock` deleted, `docs/research/` deleted
- **State** — README, OVERVIEW, PARKING, FLOWS, this archive, `DECISIONS.md` (D-065)
- **Tooling** — `audit-state.py`, `delta.py`, `tsconfig.json`, `.gitignore`, code-review skill

### Decisions this slice

- D-065 — `supabase/` is gone; schema history is `workers/migrations` and slice archives. Supersedes D-064's keep-migrations clause.

### Diff pulse

`+56 / −566 · 25 files` plus this archive — from `git diff main --stat` at close.

## Questions asked and answered

- **Scrub archives too?** → No. They are the record of what shipped. Live docs and the tree must not name the old host.

## What was parked during this slice

- Wake status names still use the old words so `wakePolicy` stays put (D-061)
- Deleting the remote project and GitHub `SUPABASE_*` secrets — owner's dashboard, not CI

## Notes

GitHub repo secrets `SUPABASE_*` and the unused remote project are not in this tree; delete them in the dashboards if they are still there.
