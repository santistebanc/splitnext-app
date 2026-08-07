# Decisions

| Id | Decision | Made in | Why |
| --- | --- | --- | --- |
| D-001 | Use remote Supabase project `splitnext-v3` (`ycpkguwfxlhpovnsuujr`, eu-central-1); do not reuse legacy `splitnext` | bootstrap | Fresh empty project matching locked architecture; old project has incompatible schema/functions |
| D-002 | Store access tokens (and device_user_id) in `expo-secure-store` | bootstrap | Long-lived capability secrets; OS keychain/keystore over plain KV |
| D-003 | Dev/demo on physical phone via Expo Go | bootstrap | Real mobile path from WSL; web SQLite is alpha; Expo Go cannot do HTTPS app links (invites later need a dev build) |
| D-004 | Separate `create-group` Edge Function mints first access token; `merge`/`fetch`/`rt-jwt` require it | slice 0001 | Create cannot call merge before a token exists |
| D-005 | Expo app at repo root; `supabase/` alongside | slice 0001 | No monorepo until a second package appears |
| D-006 | `rt-jwt` falls back to `auth_mode: anon_channel` when no mintable JWT secret is configured | slice 0001 | New Supabase projects use ES256 signing keys; legacy JWT secret is not injected into Edge Functions. Capability check still gates subscription; private minted JWT when `JWT_SECRET`/`SUPABASE_JWT_SECRET` is set |
| D-007 | Fetch Edge Function slug is `fetch-entity` (not `fetch`) | slice 0001 | Slug `fetch` produced intermittent HTML/502 responses that broke client JSON parsing |
| D-008 | Create path inserts group via `create-group`; merge→wake→fetch proven via hub bump | slice 0001 | Post-create merge at v1 would be rejected (`version_not_greater`); bump exercises the sync loop |
| D-009 | On group open and app foreground: flush queue + one group fetch (thin missed-wake catch-up) | slice 0002 | Offline bumps must upload without another tap; full missed-wake protocol stays parked |
| D-010 | Foreground sync covers all lobby group ids, not only the open group | slice 0002 | Offline edits on any known group should upload without opening that hub |
| D-011 | Create group stays empty; creator binds via Add member → This is me | slice 0003 | Matches empty-create direction; no auto-member |
| D-012 | On open/foreground, list members + binds for the group (apply by version) | slice 0003 | Thin roster catch-up without full missed-wake protocol |
| D-013 | Slice 0003 hub UI is list + add + This is me + You (Name); rename/leave/rebind parked | slice 0003 | Prove membership spine before chrome |
| D-014 | At most one active bind per device_user_id per group; same member on multiple devices allowed | slice 0003 | Assumed member is per-install; claimed-slot policy stays with invites |
| D-015 | Bind.member_id must reference a member in the same group (composite FK + merge check) | slice 0003 | Prevent cross-group bind via crafted merge |
| D-016 | Outbound queue identity is `entity_type + id + version`; `merge` returns all three per result | slice 0004 | Dropping by bare `id` discarded a pending newer version of the same entity |
| D-017 | `lastError` is a typed `SyncError` `{ code, message, at }`, cleared on every success; old string values are coerced on read | slice 0004 | String prefixes could not be matched on, and stuck red after a good sync |
| D-018 | Flow tests run the real client against a fake `src/api/edge.ts`, importing the server's own `shouldAccept` | slice 0004 | One wire boundary makes flows testable in process; sharing the rule stops the fake from disagreeing with the server |
| D-019 | Flow tests gate the demo gate and slice close, not every commit | slice 0004 | Commits inside a slice are work-in-progress; a per-commit gate gets bypassed rather than obeyed |
| D-020 | Binding stays open until the group's first live expense, then closes for good | slice 0005 | Before there is money in the group a wrong tap costs nothing, so every member stays offerable and the claim can be moved; afterwards expenses are attributed to the payer and moving a bind would silently re-attribute them. |
| D-021 | One bind per device per group: re-binding re-points the existing bind, never adds a second | slice 0005 | Two live binds would make "which member am I?" depend on iteration order. |
| D-022 | Web uses `localStorage` for both secrets and durability, not the wasm sqlite path | slice 0006 | expo-sqlite on web needs `createSyncAccessHandle`, which headless Chromium does not implement — and headless is the environment the web target exists to serve. |
| D-023 | Platform splits use `.web.ts` file resolution, never a `Platform.OS` branch in a caller | slice 0006 | Metro picks the file, so the native module never enters the web bundle and callers stay ignorant of platform. |
| D-024 | Allocations ride inside the expense entity as jsonb, not as child rows | slice 0007 | One version number covers the whole split, so merge cannot accept a new amount while rejecting one of its shares — the entity-level protocol has no transaction to do it with. |
| D-025 | Expenses split equally across the members live at record time, remainder cents handed out in sorted member-id order, frozen into the expense | slice 0007 | Two devices with the same roster in different insertion orders must produce identical allocations or merge flaps; freezing means a member added later joins the next expense, not this one. |
| D-026 | Balances are derived on read from live members + live expenses, never stored | slice 0007 | Nothing to keep in sync and nothing to migrate; the fold is pure and testable. |
| D-027 | Persisted timestamps are repaired at store open, not by changing the persisted format | slice 0007 | Legend revives ISO strings into `Date` before any reviver hook sees them; a format change would leave every already-persisted store broken. |
| D-028 | A slice is a branch → PR gated on tests + typecheck → squash merge → tag `slice-NNNN` on `main` | post-0007 | The repo now has a remote and CI, so the gate can be enforced rather than remembered; `main` still reads one line per slice. |
| D-029 | The process is vendored into the repo at `.claude/skills/`, with `AGENTS.md` as the entry point | post-0007 | A clone should carry the loop; depending on a machine-local skill install makes the repo unusable to any other agent. |
| D-030 | The published board is regenerated by CI from `docs/state/`, never served from the committed `docs/slicer.html` | post-0007 | A stale commit of a generated file can then never become the published truth. |
