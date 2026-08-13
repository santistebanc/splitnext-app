# Production backend for this kind of app

Researched: 2026-08-13. Primary sources only. Companion to `docs/research/cheap-dev-backend.md` (that note is about a *second* remote for slice work; this one is “what should host a live SplitNext”).

## What “this kind of app” actually needs

Not a generic CRUD API. The live product is:

| Need | How it is done now | Why it is non-negotiable |
| --- | --- | --- |
| No user accounts | Capability token, hashed server-side, one per device per group | Direction in `OVERVIEW.md` |
| Local-first | Client SQLite / Legend; outbound queue; merge by `version` | Incoming wins only when strictly newer |
| Referential checks | Payer in group; bind’s member in group; one live bind per device; one-use invite | `merge`, `join-group`, D-014 / D-056 |
| Wake, not stream | Realtime broadcast of a tip; client fetches | D-054; missed-wake is catch-up, not a CRDT |
| Clients never talk to Postgres | Deny-all RLS; Edge Functions after hash-check | Invariant |
| Money | Integer cents | Invariant |
| Region | `eu-central-1` today | D-001 |
| Deploy provenance | CI `db push` + function deploy + `?health=1` sha | D-052, D-058 |

The client already *is* the offline/sync layer. The server is a **merge authority + durable copy + wake channel**. A “better backend” that replaces that protocol with a sync engine is a different app.

Production extras the Free plan does not give you: daily backups, no pause, email support, 8 GB disk, 7-day log retention. Those are plan features, not a new stack.

## Ranked for *going to production*

### 1. Stay on Supabase, Pro org — **keep the protocol, pay for ops** (recommended)

Same Postgres, same seven Edge Functions, same Realtime, same CI. Upgrade the org.

| | Free (today) | Pro |
| --- | --- | --- |
| Base | $0 | **$25/month per org** |
| Compute | included Micro | $10/month compute credit covers one Micro |
| Disk | 500 MB | 8 GB, then $0.125/GB |
| Edge Functions | 500k invocations | 2M, then $2/million |
| Realtime | 200 peak connections, 2M messages | 500 peak, 5M messages, then $10/1k connections and $2.50/million messages |
| Backups | DIY `db dump`; they tell you to | Daily, last 7 days |
| Pause | after inactivity | no |

Sources: https://supabase.com/pricing · https://supabase.com/docs/guides/platform/billing-on-supabase · https://supabase.com/docs/guides/platform/backups · https://supabase.com/docs/guides/functions/pricing

At this app’s shape (small groups, wake-only, merge HTTP not chatty listeners) Pro quotas are large. One open hub is one Realtime connection. A trip weekend of expenses is a handful of `merge` invocations. You will hit **product** limits (invite abuse, retention — both parked) before you hit Pro overages.

PITR is an add-on (~$100/month for 7-day, needs Small compute). Skip it until restoring “the last two minutes of expenses” is worth that. Daily backups are the production bar for a ledger that never moves money.

**What production actually adds on this stack, not a rewrite:** Pro + keep D-052 + the parked invite rate limits and retention policy.

Fits: capability tokens (you never used Supabase Auth), version merge, EU region, Expo Go, the existing `edge.ts` seam.

Does not fix: D-006’s `anon_channel` Realtime wart; one shared Postgres for every group.

### 2. Cloudflare: one SQLite Durable Object per group — **best other architecture, full server rewrite**

Not KV. Not D1-as-the-merge-store. A Durable Object is single-threaded, strongly consistent, and (for new classes) has **embedded SQLite** plus 30-day point-in-time recovery per object.

Map:

| Today | Cloudflare |
| --- | --- |
| `merge` / `shouldAccept` + FKs | SQL inside the group DO; no race |
| Realtime wake + `rt-jwt` | WebSocket on the same DO |
| `fetch-entity` / `list-roster` | SQL in the DO |
| `access_tokens` / `invites` (global lookup) | Worker + D1 (or KV as a write-once index of `token_hash → group_id`) |
| CI health sha | Worker `?health=1` + wrangler deploy from the same workflow |

PartyKit / PartyServer is a DX layer on this (rooms, broadcast). The durable store is the DO’s SQLite, not KV. KV stays a token index at most.

Pricing (Workers Paid): **$5/month** minimum, 10M Worker requests, Durable Objects included; SQLite storage 5 GB-month then $0.20/GB-month; row reads/writes match D1 (25B reads / 50M writes included). Free plan exists for SQLite DOs (5M row reads / 100k row writes / day) but Worker CPU is **10 ms** per invocation — too tight for merge. Production is Paid.

Sources: https://developers.cloudflare.com/workers/platform/pricing/ · https://developers.cloudflare.com/durable-objects/platform/pricing/ · https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/ · https://github.com/cloudflare/partykit/ (PartyServer)

Why this is the *right* Cloudflare shape: merge and wake want a single writer per group. A DO *is* that. Idle groups hibernate; you do not pay a always-on Postgres.

Cost of choosing it: rewrite every Edge Function, `wake.ts`, deploy pipeline (D-052), and the token/invite global index. Client protocol (`groupSync`, queue, version) can stay. EU: DO location hints / jurisdiction exist; it is not “the same eu-central-1 project.”

**When to pick this:** you are leaving Supabase on purpose (Realtime reliability, scale-to-zero of idle groups, or you want the actor model). Not to save the $25 Pro bill.

### 3. Convex mutations as the merge authority — **rewrite functions, fight auth grain**

Convex mutations are transactional TypeScript against a reactive DB. You could port `shouldAccept` into a mutation. Daily backups are Professional ($25 **per developer**/month). Selectable region. Offline is not native; PowerSync-on-Convex is experimental (2026).

Auth is OIDC / Clerk / Convex Auth (users). Capability tokens would be HTTP actions that hash-check a secret you store — possible, not what the product is for.

Sources: https://www.convex.dev/pricing · https://docs.convex.dev/auth/overview · https://releases.powersync.com/announcements/announcing-convex-backend-support-experimental

Worse than (1) because you throw away working functions and CI for a platform that wants user accounts and live queries. Worse than (2) because you still have a global database, not a per-group actor, and you add a second sync product if you want their offline story.

### 4. InstantDB / Jazz — **replace the client protocol**

Both are local-first sync products: client talks to a sync engine; permissions are rules, not your merge function.

- Instant: Expo SDK, guest auth, CEL permissions (default allow). Free never-paused 1 GB; Pro **$30/month** for 10 GB + 7-day backups. Architecture: client triple store + Clojure sync + multi-tenant Postgres. https://www.instantdb.com/pricing · https://www.instantdb.com/essays/architecture · https://www.instantdb.com/docs/permissions · https://www.instantdb.com/docs/auth/guest-auth
- Jazz: Expo, `local-first` device-secret auth (close to “no accounts”). Jazz 2.0 is **alpha** (repo created 2026-01). Cloud is usage-based. https://jazz.tools/docs · https://jazz.tools/docs/auth/authentication · https://github.com/garden-co/jazz

You would delete `groupSync`, the queue, `shouldAccept`, and the Edge Functions. Conflict rule becomes theirs (not “incoming version strictly greater”). Invites-as-one-use-rows become permission rules. This contradicts `OVERVIEW.md` non-goals (full CRDT / dedicated sync platforms) and D-024/D-025 (entity-level version covering the whole split).

Attractive if you were starting over with “multiplayer expenses and we do not care who the merge authority is.” Not attractive as a migration of *this* repo.

### 5. Zero / Electric / PowerSync on Postgres — **sync sidecar, you still write the API**

These sync a **subset of Postgres** to client SQLite. Writes still go through *your* backend. You already have client SQLite + a write API. Adding one of these means:

- Keep Postgres (or get it)
- Keep (or rewrite) merge/invite HTTP
- Replace Legend persist + queue + wake with their client
- Auth is JWTs / users

Pricing: Electric Cloud PAYG, bills under $5 waived, writes $1/million (+$2/million for Postgres Sync). PowerSync Pro from **$49/month**. Zero managed Hobby **$30/month**, Professional **$300/month**; self-host is a replication manager + Postgres.

Sources: https://electric.ax/pricing · https://electric.ax/blog/2026/04/02/electric-cloud-pricing · https://powersync.com/pricing · https://zero.rocicorp.dev/ · https://docs.powersync.com/client-sdks/reference/react-native-and-expo

PowerSync’s Expo Go path is a JS SQL adapter, not the native one. Named as non-goals in `OVERVIEW.md`. You would pay for a second sync stack you already implemented.

### 6. Firebase / Firestore — **wrong billing, wrong conflict rule**

Custom tokens exist (Admin SDK mints a JWT with claims). Security rules can gate on those claims. Offline persistence is built in.

Problems for this app: listeners bill on reconnect; rule `get()`/`exists()` bill extra reads; conflict is last-write-wins unless you invent version checks in rules (weak transactions, no real FKs); you would be minting Firebase *users* for devices. Integer cents and soft-delete are application conventions, not schema.

Sources: https://firebase.google.com/docs/auth/admin/create-custom-tokens · https://firebase.google.com/docs/firestore/pricing

A default for chat/social apps. A poor merge authority for a ledger.

### 7. PocketBase (self-host) — **cheap VPS, you become ops**

Single binary, SQLite, SSE realtime, Go hooks for merge. Production is “a VPS with a volume” (Hetzner-class). Backups: zip of `pb_data` or S3; restore takes the app read-only. Vertical scale only; author claims 10k realtime connections on a ~$4 VPS. No hosted SLA. Tokens are user JWTs, not stored hashed capabilities — you would implement that in hooks.

Sources: https://pocketbase.io/docs/going-to-production/ · https://pocketbase.io/faq/ · https://pocketbase.io/docs/authentication/

Fine for a hobby single-tenant. Production for a public invite-link app means you own patching, TLS, offsite backups, and abuse. You already have a hosted Postgres with a deploy contract.

### 8. Neon + (Workers or Deno) + a wake bus — **$0-ish, three products, full rewrite**

Covered in `cheap-dev-backend.md`. Postgres without Realtime. You glue functions and a socket vendor. Neon Functions were beta and region-locked (`aws-us-east-2`) when that note was written. After beta, function pricing unpublished. Worse operationally than staying on Supabase; cheaper only if you value $25/month over weeks of rewrite and a three-vendor outage mode.

## What is *not* the production stack

| Idea | Why it loses |
| --- | --- |
| Cloudflare KV as the entity store | Eventual consistency, no transactions, 1 write/s/key, no indexes — breaks version merge and one-use invites |
| Stay on Supabase **Free** for production | No daily backups; pause; 500 MB; they tell you to DIY dump |
| Appwrite Cloud | 2 functions / project; we ship 7 |
| Turso / D1 as the only database | Global SQLite without a per-group serialiser reintroduces merge races unless every write is carefully fenced |
| Self-hosted Supabase on Oracle Always Free | Same software, high ops, capacity and abandonment risk (`cheap-dev-backend.md`) |

## Recommendation

**Go to production on Supabase Pro.** The backend you have is already the right *kind* of backend: HTTP capability boundary, versioned merge, wake-only. Production is paying for backups and “will not pause,” then shipping the parked abuse/retention work — not picking a new vendor.

**If you later leave Supabase,** the stack that matches the protocol is **Workers Paid + one SQLite Durable Object per group** (PartyServer optional) **+ D1/KV only as a token/invite index.** That is a planned rewrite of the server and CI, not a cheaper host for the same functions.

**Do not** pick Instant, Jazz, Zero, Electric, or PowerSync to “get local-first.” You already have local-first. Those products would replace the merge rules this repo was built to own.

## Sources

- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/functions/pricing
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/
- https://github.com/cloudflare/partykit/
- https://www.convex.dev/pricing
- https://docs.convex.dev/auth/overview
- https://www.instantdb.com/pricing
- https://www.instantdb.com/essays/architecture
- https://www.instantdb.com/docs/permissions
- https://jazz.tools/docs
- https://jazz.tools/docs/auth/authentication
- https://zero.rocicorp.dev/
- https://electric.ax/pricing
- https://powersync.com/pricing
- https://firebase.google.com/docs/firestore/pricing
- https://firebase.google.com/docs/auth/admin/create-custom-tokens
- https://pocketbase.io/docs/going-to-production/
- https://pocketbase.io/faq/
