# Logic map

Living catalogue of meaningful pieces of behaviour. Each entry has a stable **id** (cited by flows), a **name**, **where it lives**, and **what it is for**. Rewritten at slice close when the map changes. Prefer deep modules; do not list every private helper.

**Name** is the actual code symbol in backticks (`` `syncGroup` ``) — the thing you would grep for. Two names under one id (`` `getAccessToken` / `saveAccessToken` ``) means **one idea with two verbs** — a read/write pair on the same secret. It is not a place to park two different rules: if a flow would ever cite one half and not the other, they are two entries. For route files with no meaningful export, use the route path (`` `/group/[id]` ``). The board renders this column in monospace.

**What it is for** is one plain sentence a newcomer can read: what it does and why, not a list of the identifiers it touches.

**Area** is *where the code runs* — keep it coarse: `UI` · `Device` · `Edge` · `Server`. Four is the budget; a fifth area needs a reason a reader would care about, not a folder.

**Kind** is what the piece *is*, which is how the board filters. Pick exactly one:

| Kind | Means |
| --- | --- |
| `Screen` | What the person sees and taps. |
| `Pure` | Input in, answer out. No state, no clock, no network — so it is the cheap thing to unit-test. |
| `State` | Owns local data: reads and writes the store, SQLite or Secure Store. |
| `Job` | Sequences other pieces into one unit of work; the thing a flow step usually names. |
| `Network` | Crosses the wire from the device — an HTTP call or a subscription. |
| `Endpoint` | The server side of that wire. |

## UI

Screens and routes the person touches.

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| L-lobby | Lobby screen | Screen | `app/index.tsx` | The first screen: lists every group this device knows, offers Create group, and opens one into the hub. |
| L-hub | Group hub | Screen | `app/group/[id].tsx` | One group's screen: shows its name, member list and everyone's balance, lets you add a member or an expense, claim a member as yourself, rename the group, and surfaces the last sync error. |
| L-rootLayout | Root layout | Screen | `app/_layout.tsx` | The app shell; it starts the background catch-up sync so groups refresh on launch and on return to the app. |

## Device

Everything else running on the device: domain rules, sync, local state, secrets.

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| L-shouldAcceptVersion | `shouldAcceptVersion` | Pure | `src/domain/version.ts` | Decides who wins when two copies of an entity disagree: the incoming one, but only if its version number is strictly higher. |
| L-sortByFlushOrder | `sortByFlushOrder` | Pure | `src/domain/version.ts` | Orders pending changes so parents reach the server before their children — a group before its members, a member before the bind pointing at it. |
| L-assumedMember | `assumedMemberIdFromBinds` | Pure | `src/domain/assumedMember.ts` | Answers "which member am I in this group?" by finding this device's live bind. |
| L-bindingOpen | `bindingIsOpen` | Pure | `src/domain/assumedMember.ts` | Answers "can this device still say which member it is?" — yes until the group's first live expense, which is what shows or hides the This is me button. |
| L-memberClaimed | `memberHasLiveBind` | Pure | `src/domain/assumedMember.ts` | Answers "is this person's slot still free?" — whether any device has claimed them, which is what decides if they can be invited. Unlike the rule above, expenses have no say in it. |
| L-inviteCode | `normalizeInviteCode` / `formatInviteCode` | Pure | `src/domain/inviteCode.ts` | The shape of an invite code: prints it hyphenated to read aloud, and takes back whatever someone typed — any case, spaces, hyphens — as the one canonical form. |
| L-splitEqually | `splitEqually` | Pure | `src/domain/split.ts` | Divides a cost equally, to the cent, across the members given. Leftover cents go out in member-id order, so two devices splitting the same cost agree exactly. |
| L-balances | `computeBalances` | Pure | `src/domain/balances.ts` | Works out what each member is up or down overall — what they paid minus what they owe — most-negative first. |
| L-createGroup | `createGroup` | Job | `src/sync/groupSync.ts` | Creates a group: writes it locally first, registers it on the server, stores the returned access token, adds it to the lobby, and subscribes for wakes. |
| L-openGroup | `openGroup` | Job | `src/sync/groupSync.ts` | Opens a group for viewing — subscribes for wakes, then runs a full sync. Realtime being down does not block opening. |
| L-syncGroup | `syncGroup` | Job | `src/sync/groupSync.ts` | One full round trip for a group: push everything pending, pull the group back, then pull its roster. Runs alone per group so nothing races. |
| L-syncAllLobby | `syncAllLobbyGroups` | Job | `src/sync/groupSync.ts` | Syncs every group this device knows at once, isolating failures so one bad group cannot block the rest. |
| L-bumpName | `bumpGroupName` | Job | `src/sync/groupSync.ts` | Renames a group: the new name shows immediately, then goes to the server as the next version. |
| L-addMember | `addMember` | Job | `src/sync/groupSync.ts` | Adds a person to the group locally, then sends them to the server. |
| L-addExpense | `addExpense` | Job | `src/sync/groupSync.ts` | Records a cost: refuses anything that is not a positive whole number of cents, splits it across everyone in the group right now, writes it locally against the paying member, then sends it. |
| L-bindMe | `bindMe` | Job | `src/sync/groupSync.ts` | Claims a member as this device's own person, or moves that claim to a different member — one bind per device, re-pointed rather than duplicated. Refuses once the group has an expense, or if the member is gone. |
| L-createInvite | `createInvite` | Job | `src/sync/groupSync.ts` | Asks the server for a one-time code that will bind whoever redeems it to one named member. Needs the network — there is no offline way to grant somebody else access. |
| L-redeemInvite | `redeemInvite` | Job | `src/sync/groupSync.ts` | Joins a group this device has never seen: trades the code for an access token, saves it, adds the group to the lobby, subscribes for wakes and pulls the roster. Arrives already bound, because the code named the member. |
| L-runExclusive | `runExclusive` | Job | `src/sync/exclusive.ts` | Queues async work per group so a push and a pull can never overlap on the same group. |
| L-flushQueue | `flushQueue` | Job | `src/sync/outbound.ts` | Sends everything pending for a group in dependency order, keeps whatever the server did not accept, and records a typed error when it fails. |
| L-shouldFlush | `shouldAttemptFlush` | Pure | `src/sync/queuePolicy.ts` | Says whether a push is worth making at all — an empty queue is a no-op, not a request. |
| L-queuePolicy | `queueAfterMergeResults` | Pure | `src/sync/queuePolicy.ts` | Decides what stays pending after a push: drop only the exact versions the server accepted, so nothing newer is lost. |
| L-applyRemoteEntity | `applyRemoteEntity` | Pure | `src/sync/inboundApply.ts` | Works out the next local state for one incoming entity, or says no change if the local copy is already as new. Pure, so it is unit-tested. |
| L-commitRemote | `commitRemoteEntity` | State | `src/sync/inbound.ts` | Writes the accepted result of that decision into the store. |
| L-applyRemoteFetch | `applyRemoteFetch` | Job | `src/sync/inbound.ts` | Fetches one entity from the server and commits it, clearing or setting the group's error. |
| L-pullRoster | `pullRoster` | Job | `src/sync/inbound.ts` | Fetches every member, bind and expense of a group and commits them one by one, so the group catches up in a single call. |
| L-wakeSub | `startWakeSubscription` | Network | `src/sync/wake.ts` | Listens on the group's Realtime channel; a wake says only what changed, and this fetches that one entity. One subscription per group. |
| L-foreground | `useLobbyForegroundSync` | Job | `src/sync/appForegroundSync.ts` | Runs the lobby-wide catch-up on mount and every time the app returns to the foreground. |
| L-syncError | `syncError` / `coerceSyncError` | Pure | `src/sync/syncErrors.ts` | Gives every failure a code, a message and a timestamp, and normalises older stored errors into that shape. |
| L-getGroupStore | `getGroupStore` | State | `src/store/groupStore.ts` | Hands out the one observable state object per group — group, members, binds, expenses, sync status, pending queue — persisted so it survives restarts, and repaired on open by `L-normalizeTimestamps`. |
| L-initLocalGroup | `initLocalGroup` | State | `src/store/groupStore.ts` | Seeds a freshly created group into its store as local-only, before the server knows about it. |
| L-deviceUser | `getOrCreateDeviceUserId` | State | `src/device/deviceUser.ts` | The identity of this install: one id, generated once and kept in the secret store, since there are no accounts. |
| L-secureStorage | `getSecret` / `setSecret` | State | `src/secrets/secureStorage.ts` | The one door to the device's secrets. Native goes to the OS keychain; the web build swaps in `localStorage`, which is why nothing wider than a per-group token belongs here. |
| L-normalizeTimestamps | `normalizePersistedTimestamps` | Pure | `src/store/timestamps.ts` | Undoes the `Date` objects that reloading a saved store invents in place of our timestamp strings, so a reopened group holds exactly what a freshly synced one does. |
| L-persistPlugin | `persistPlugin` | State | `src/store/persistPlugin.ts` | Where a store survives a restart: SQLite on a device, `localStorage` on web, so the browser target needs no wasm. |
| L-accessToken | `getAccessToken` / `saveAccessToken` | State | `src/secrets/tokens.ts` | Keeps each group's capability token in the secret store — holding it is what proves access to that group. |
| L-lobbyIds | `listLobbyGroupIds` / `addLobbyGroupId` | State | `src/secrets/tokens.ts` | The device's list of known group ids, which is what the lobby and the catch-up sync iterate over. Temporary home. |

## Edge

The client side of the wire — HTTP calls out of the device.

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| L-edgeCreate | `createGroupRemote` | Network | `src/api/edge.ts` | Asks the server to register a new group and hand back its access token. |
| L-edgeMerge | `mergeEntities` | Network | `src/api/edge.ts` | Pushes a batch of pending changes and reports per item whether the server accepted them. |
| L-edgeFetch | `fetchEntity` | Network | `src/api/edge.ts` | Asks for one entity by type and id — the call a wake triggers. |
| L-edgeRoster | `listRoster` | Network | `src/api/edge.ts` | Asks for a group's whole roster — members, binds and expenses — in one request. |
| L-edgeRtJwt | `mintRealtimeAuth` | Network | `src/api/edge.ts` | Trades the group's access token for permission to listen on its Realtime channel. |
| L-edgeCreateInvite | `createInviteRemote` | Network | `src/api/edge.ts` | Asks the server to mint an invite code for one member of a group this device is already in. |
| L-edgeRedeemInvite | `redeemInviteRemote` | Network | `src/api/edge.ts` | Trades an invite code for access to its group. The one call made without an access token — the code is the capability. |

## Server

Edge Functions and their shared helpers.

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| L-efCreate | `create-group` | Endpoint | `supabase/functions/create-group` | Creates the group row and issues an access token, storing only its hash. |
| L-efMerge | `merge` / `mergeOne` | Endpoint | `supabase/functions/merge` | The write path: applies each pushed item if its version wins, reports accepted or rejected per item, and wakes the group's other devices. |
| L-efFetch | `fetch-entity` | Endpoint | `supabase/functions/fetch-entity` | Returns one entity to a caller whose token proves access to that group. |
| L-efRoster | `list-roster` | Endpoint | `supabase/functions/list-roster` | Returns every member, bind and expense of a group in one response. |
| L-efRtJwt | `rt-jwt` | Endpoint | `supabase/functions/rt-jwt` | Issues a short-lived Realtime token, falling back to a shared anonymous channel when it cannot. |
| L-efCreateInvite | `create-invite` | Endpoint | `supabase/functions/create-invite` | Mints a one-time code for one member, storing only its hash and a 7-day expiry. Refuses a member who is already claimed. |
| L-efRedeemInvite | `redeem-invite` | Endpoint | `supabase/functions/redeem-invite` | Trades a code for access: checks it is live, unspent and for a free slot, claims it atomically, then issues an access token and writes the bind. The only endpoint besides create-group that grants access without one. |
| L-inviteAlphabet | `randomInviteCode` | Pure | `supabase/functions/_shared/crypto.ts` | Makes a code short enough to read aloud, from an alphabet with no characters people confuse, sampled without the bias a plain modulo would introduce. |
| L-efAccess | `resolveAccessToken` | Endpoint | `supabase/functions/_shared/access.ts` | The door: hashes the presented token and only lets it through if it is unrevoked and belongs to this group and this device. |
| L-efWake | `publishWake` | Network | `supabase/functions/_shared/wake.ts` | Tells the group's other devices that something changed, naming only what — never the data itself. A failed wake never undoes the write. |
| L-efShouldAccept | `shouldAccept` | Pure | `supabase/functions/_shared/entities.ts` | The server's copy of the version rule, deliberately identical to the client's so both sides agree on who wins. |
