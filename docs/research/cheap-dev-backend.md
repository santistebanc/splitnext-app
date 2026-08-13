# Cheap (ideally free) backends for a second SplitNext remote

**Decision (slice 0013):** no second remote. `splitnext-v3` is shared; slice-branch CI may deploy to it. This note stays as the lookup for if that is ever revisited.

Researched: 2026-08-13. Primary sources only.

## What “the same thing” actually is

The phone and `npm run web` today talk to **one** hosted product:

| Need | How it is done now | Source in this repo |
| --- | --- | --- |
| Postgres | `groups`, `members`, `binds`, `expenses`, `access_tokens`, `invites`; deny-all RLS; service role after a capability hash-check | `OVERVIEW.md`, Edge Functions |
| HTTP API | Seven Deno Edge Functions at `{url}/functions/v1/{name}` | `src/api/edge.ts` |
| Wakes | Supabase Realtime broadcast; client is `supabase-js` | `src/sync/wake.ts` |
| Reachable from Expo Go | Public HTTPS | Direction: physical phone + Expo Go |
| CI deploy | `db push` + `functions deploy` + `?health=1` | D-052 |

A substitute has to cover **all five**, or the client and the deploy pipeline change. “Has a database” is not enough.

## Ranked options

### 1. Stay on Supabase, pause the unused project — **$0, no rewrite** (cheapest that works)

Free plan: two **active** projects, across every org you own or admin. Paused projects do not count. Limit of two active; paused after one week of inactivity.

- Pricing: https://supabase.com/pricing
- Billing: https://supabase.com/docs/guides/platform/billing-on-supabase#free-plan

Pause old `splitnext` (not `splitnext-v3`). Create `splitnext-v3-dev`. Same URLs, same functions, same Realtime, same CI. This is the $0 path for **slice 0013**.

### 2. Stay on Supabase, upgrade the org to Pro — **~$35–45/month, no rewrite**

Pro is **per organization**, from $25/month. Every project in the org becomes Pro. Compute is extra per project. Pro includes $10/month of compute credits (one Micro). Their own example: two Micros = $35/month. Three Micros ≈ $45/month.

- Pricing: https://supabase.com/pricing
- Org billing (this org): https://supabase.com/dashboard/org/ygljnsxodcadeesmxccq/billing

Keeps the old `splitnext` running. No client or function rewrite. This is the paid path for slice 0013.

### 3. Supabase Branching (persistent preview) — **not cheaper than (2), still Pro, no rewrite**

A branch is a full extra Supabase instance (DB, Auth, Storage, Edge Functions, Realtime). Preview branches are ephemeral; **persistent** branches exist for staging/dev and are not auto-deleted.

- How it works: https://supabase.com/docs/guides/deployment/branching
- Charge: no fixed branch fee; Micro compute **$0.01344/hour**. Compute credits **do not** apply to branching compute. https://supabase.com/docs/guides/platform/manage-your-usage/branching

A persistent branch left up for a month is about **$10** of branching compute **on top of** the $25 Pro plan and prod’s own compute. You still cannot do this on Free. Better *shape* for “this git branch gets a server” than a second project, but it is not the cheapest, and it is not free.

### 4. Neon Postgres + Neon Functions (beta) — **$0 during beta, full rewrite, region lock**

Closest *combination that is still one vendor* and currently free:

| Piece | Neon Free / beta | Source |
| --- | --- | --- |
| Postgres | 100 projects, 10 branches/project, 0.5 GB, 100 CU-hours, scale-to-zero after 5 min, 5 GB egress | https://neon.tech/pricing |
| Functions | Beta, **free on any plan**, JS/TS on **Node 24** (not Deno), WebSockets/SSE supported, `DATABASE_URL` injected, **only `aws-us-east-2`** | https://neon.com/docs/compute/functions/overview |
| Branching | Copy-on-write DB + a function URL per branch | https://neon.com/docs/introduction/branching |

What would have to change in this repo:

- Rewrite seven Deno Edge Functions as Node `fetch` handlers (Hono is their recommended shape).
- Replace `supabase-js` Realtime in `wake.ts` with Neon function WebSockets (different protocol).
- Replace `supabase db push` / `functions deploy` / `verify_deploy.py` health stamp.
- Prod today is `eu-central-1`. Neon Functions do not run there during beta.

**Not drop-in.** Recurring $0 only while Functions stay free in beta and the DB stays under Free limits (compute suspends for the month if you hit 100 CU-hours or 0.5 GB). After beta, Functions pricing is unpublished.

### 5. Neon (Free) + Deno Deploy (Free) + Ably (Free) — **$0, three vendors, full rewrite**

| Piece | Free tier | Source |
| --- | --- | --- |
| Postgres | Neon Free, as above | https://neon.tech/pricing |
| HTTP functions | Deno Deploy Free: 1M requests, 20 GB egress, 15 h CPU, 20 apps | https://deno.com/deploy/pricing |
| Wakes | Ably Free: 200 connections, 6M messages/month | https://ably.com/pricing |

Deno Deploy Classic is being shut down (docs: 20 July 2026); new Deploy is a different product. Connecting Deploy to Postgres is documented (their own tutorial even used a Supabase DB): https://docs.deno.com/deploy/manual/postgres/

Still a rewrite: functions move off Supabase’s gateway (`/functions/v1/...` + `apikey`), Realtime is replaced by Ably, CI is three deploys. Operationally worse than (4) because wakes and DB are different vendors.

### 6. Cloudflare Workers + anything — **free tier is the wrong shape**

Workers Free: **100,000 requests/day**, **10 ms CPU per invocation**. https://developers.cloudflare.com/workers/platform/pricing/

A `merge` that opens Postgres and applies a batch will blow 10 ms CPU. This combo is not viable on the free plan for this app. Paid Workers removes the 10 ms cap ($5/month historically for the paid Workers plan — confirm on that page if chosen later).

### 7. Appwrite Cloud Free — **cannot host this API**

Free: 2 projects, pause after 1 week, **2 functions per project**. We ship **seven** Edge Functions. Different APIs (not `/functions/v1`, not supabase-js Realtime). https://appwrite.io/pricing

Same two-project / pause-after-inactivity pattern as Supabase Free, with a harder function cap.

### 8. Fly.io — **not free for new orgs**

No free allowance for new customers (legacy hobby only). Credit card required. Smallest always-on Machine ≈ **$2/month**; unmanaged Postgres “about $2/month for a single-node dev cluster.” https://fly.io/docs/about/pricing/

Cheap for a VM, not free, and you still self-host Supabase or rewrite.

### 9. Railway — **effectively not free for a 24/7 remote**

Free: $1/month usage credits, 0.5 GB RAM cap. Hobby: $5/month including $5 credits. https://railway.com/pricing

A Postgres + API left running will eat the $1 credit. Fine as a trial, not as the Expo Go target.

### 10. Oracle Cloud Always Free + self-hosted Supabase — **$0, same software, high ops, fragile**

Always Free includes compute (Ampere A1 / AMD) and Autonomous DB, unlimited time, **credit/debit card required** for identity, **one account per person**, idle 30 days may be deemed abandoned. “Out of host capacity” on Always Free compute is a documented failure mode. No SLA; Always-Free-only accounts are not eligible for Oracle Support. https://www.oracle.com/cloud/free/faq.html

You get the same Docker stack as production, on a VM you run. That is an ops slice, not a second project.

### 11. Turso — **wrong database**

Free SQLite (100 DBs, 5 GB). https://turso.tech/pricing  
This app’s schema and Edge Functions are Postgres. Not a substitute without a storage rewrite.

## What is *not* cheaper

| Idea | Why it loses |
| --- | --- |
| Second Supabase org on Free | Two-project cap is **per person across orgs**, not per org. https://supabase.com/docs/guides/platform/billing-on-supabase#free-plan |
| Neon/Deno/Ably “to save money vs Pro” | $0 *fees*, but weeks of rewrite, three dashboards, and prod still on Supabase unless you migrate that too |
| Cloudflare free | 10 ms CPU |
| Appwrite free | 2 functions, we need 7 |

## Recommendation for this app

**For slice 0013 (demo an unmerged server from a phone):** keep Supabase.

1. **Free:** pause old `splitnext`, create `splitnext-v3-dev`.
2. **Paid, keep everything:** Pro on this org (~$35–45/month for two or three Micros).
3. **Paid, nicer DX later:** Pro + a **persistent** Supabase branch (still not free; branching compute is extra and excluded from the $10 credits).

A Neon (or Neon+Deno+Ably) combo is the only *other-vendor* path that can be $0 **and** cover Postgres + HTTP + a wake channel. It is a **new backend slice**, not a drop-in for 0013. Park it until someone wants to leave Supabase on purpose.

## Sources

- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/deployment/branching
- https://supabase.com/docs/guides/platform/manage-your-usage/branching
- https://neon.tech/pricing
- https://neon.com/docs/introduction/branching
- https://neon.com/docs/compute/functions/overview
- https://deno.com/deploy/pricing
- https://docs.deno.com/deploy/manual/postgres/
- https://ably.com/pricing
- https://developers.cloudflare.com/workers/platform/pricing/
- https://appwrite.io/pricing
- https://fly.io/docs/about/pricing/
- https://railway.com/pricing
- https://turso.tech/pricing
- https://www.oracle.com/cloud/free/faq.html
