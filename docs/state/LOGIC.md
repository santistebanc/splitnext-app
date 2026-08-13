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
| L-lobby | Lobby screen | Screen | `app/index.tsx` | The first screen: lists every group this device knows, offers Create group or Join group (paste a token), and opens one into the hub. |
| L-hub | Group hub | Screen | `app/group/[id]/index.tsx` | One group's screen: shows its name, member list and everyone's balance, lists the fewest transfers that settle those nets (each row opens the new-expense form for that transfer), lets you add a member, claim a member as yourself, invite another device onto a member who is not You, You (Name), and opens the new-expense form; bump sync proof; surfaces the last sync error. |
| L-expenseNew | New expense | Screen | `app/group/[id]/expense/new.tsx` | Records a cost: who paid, how much, what for, and who shares equally among the selected members. Defaults to You paid and everyone shares, unless the query names a prefill. |
| L-join | Join screen | Screen | `app/join.tsx` | Redeems a `/join?token=` invite, stores the new access token, and opens the hub already bound to the named member. |
| L-rootLayout | Root layout | Screen | `app/_layout.tsx` | The app shell; it starts the background catch-up sync so groups refresh on launch and on return to the app. |

## Device

Everything else running on the device: domain rules, sync, local state, secrets.

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| L-shouldAcceptVersion | `shouldAcceptVersion` | Pure | `src/domain/version.ts` | Decides who wins when two copies of an entity disagree: the incoming one, but only if its version number is strictly higher. |
| L-sortByFlushOrder | `sortByFlushOrder` | Pure | `src/domain/version.ts` | Orders pending changes so parents reach the server before their children — a group before its members, a member before the bind pointing at it. |
| L-assumedMember | `assumedMemberIdFromBinds` | Pure | `src/domain/assumedMember.ts` | Answers "which member am I in this group?" by finding this device's live bind. |
| L-bindingOpen | `bindingIsOpen` | Pure | `src/domain/assumedMember.ts` | Answers "can this device still say which member it is?" — yes until the group's first live expense, which is what shows or hides the This is me button. |
| L-splitEqually | `splitEqually` | Pure | `src/domain/split.ts` | Divides a cost equally, to the cent, across the members given. Leftover cents go out in member-id order, so two devices splitting the same cost agree exactly. One participant receives the whole amount. |
| L-participantsForSplit | `participantsForSplit` | Pure | `src/domain/split.ts` | Answers who shares an expense: the selected members, but only if every one of them is live and at least one remains. A missing member is refused, not dropped. |
| L-balances | `computeBalances` | Pure | `src/domain/balances.ts` | Works out what each member is up or down overall — what they paid minus what they owe — most-negative first. |
| L-settle | `suggestSettlements` | Pure | `src/domain/settle.ts` | Turns those nets into the fewest transfers that zero everyone who can be settled, identical on every device. |
| L-expensePrefill | `expensePrefillFromSearchParams` | Pure | `src/domain/expensePrefill.ts` | Turns the new-expense query into payer, integer cents, who shares, and what-for — or `null` if a required piece is missing or is not money, so the form can keep its defaults. |
| L-settlementHref | `settlementHref` | Pure | `src/domain/expensePrefill.ts` | Builds the path a settle-up row opens: same transfer, same href on every device, amount in integer cents, what-for `Settlement`. |
| L-inviteIsLive | `inviteIsLive` | Pure | `src/domain/invite.ts` | Answers whether an invite can still be redeemed — not spent, not past `expires_at`, and the named member still live. |
| L-parseInviteToken | `parseInviteToken` | Pure | `src/domain/invite.ts` | Pulls the invite secret out of a raw token or a `/join?token=` URL so lobby paste and the join route share one parser. |
| L-createGroup | `createGroup` | Job | `src/sync/groupSync.ts` | Creates a group: writes it locally first, registers it on the server, stores the returned access token, adds it to the lobby, and starts a wake subscription without waiting for the socket to open. |
| L-openGroup | `openGroup` | Job | `src/sync/groupSync.ts` | Opens a group for viewing — subscribes for wakes, then runs a full sync. The wake socket being down does not block opening. |
| L-syncGroup | `syncGroup` | Job | `src/sync/groupSync.ts` | One full round trip for a group: push everything pending, pull the group back, then pull its roster. Runs alone per group so nothing races. |
| L-syncAllLobby | `syncAllLobbyGroups` | Job | `src/sync/groupSync.ts` | Syncs every group this device knows at once, isolating failures so one bad group cannot block the rest. |
| L-bumpName | `bumpGroupName` | Job | `src/sync/groupSync.ts` | Renames a group: the new name shows immediately, then goes to the server as the next version. |
| L-addMember | `addMember` | Job | `src/sync/groupSync.ts` | Adds a person to the group locally, then sends them to the server. |
| L-addExpense | `addExpense` | Job | `src/sync/groupSync.ts` | Records a cost: refuses anything that is not a positive whole number of cents, splits it equally across the members selected at record time (everyone live, if the form did not narrow it), writes it locally against the paying member, then sends it. The payer need not be in the split. |
| L-bindMe | `bindMe` | Job | `src/sync/groupSync.ts` | Claims a member as this device's own person, or moves that claim to a different member — one bind per device, re-pointed rather than duplicated. Refuses once the group has an expense, or if the member is gone. |
| L-mintInvite | `mintInvite` | Job | `src/sync/invite.ts` | Asks the server for a one-use invite bound to one member and returns the plaintext secret to copy. |
| L-inviteShare | `inviteShareText` | Pure | `src/sync/inviteShareText.ts` | Turns that secret into what you copy: the raw token on native, a `/join?token=` URL on web. |
| L-joinGroup | `joinGroup` | Job | `src/sync/invite.ts` | Redeems an invite: stores the new access token, writes the returned bind locally, and adds the group to the lobby. The hub then opens and subscribes — join itself is a spinner that unmounts. |
| L-runExclusive | `runExclusive` | Job | `src/sync/exclusive.ts` | Queues async work per group so a push and a pull can never overlap on the same group. |
| L-flushQueue | `flushQueue` | Job | `src/sync/outbound.ts` | Sends everything pending for a group in dependency order, keeps whatever the server did not accept, and records a typed error when it fails. |
| L-shouldFlush | `shouldAttemptFlush` | Pure | `src/sync/queuePolicy.ts` | Says whether a push is worth making at all — an empty queue is a no-op, not a request. |
| L-queuePolicy | `queueAfterMergeResults` | Pure | `src/sync/queuePolicy.ts` | Decides what stays pending after a push: drop only the exact versions the server accepted, so nothing newer is lost. |
| L-applyRemoteEntity | `applyRemoteEntity` | Pure | `src/sync/inboundApply.ts` | Works out the next local state for one incoming entity, or says no change if the local copy is already as new. Pure, so it is unit-tested. |
| L-commitRemote | `commitRemoteEntity` | State | `src/sync/inbound.ts` | Writes the accepted result of that decision into the store. |
| L-applyRemoteFetch | `applyRemoteFetch` | Job | `src/sync/inbound.ts` | Fetches one entity from the server and commits it, clearing or setting the group's error. |
| L-pullRoster | `pullRoster` | Job | `src/sync/inbound.ts` | Fetches every member, bind and expense of a group and commits them one by one, so the group catches up in a single call. |
| L-wakeCatchUp | `shouldCatchUpOnStatus` / `shouldReplaceSubscription` / `nextReconnectDelayMs` | Pure | `src/sync/wakePolicy.ts` | Answers whether a wake-socket status change means this group missed wakes — only when the socket is `OPEN` again after `ERROR` or `CLOSED`, not on the first connect — whether a dead socket should be replaced so the hub can listen, and how long to wait before the next retry (1s, doubling, capped at 30s). |
| L-wakeSub | `startWakeSubscription` / `wakeUrl` | Network | `src/sync/wake.ts` | Opens a hibernating WebSocket on the group's Durable Object; a wake says only what changed, and this fetches that one entity. If the socket drops, it retries with backoff and then runs that group's full catch-up. A close of a socket already replaced is ignored, so error-then-close is one retry. One live socket per group. The URL carries the token on the query string because RN `WebSocket` cannot set headers. |
| L-foreground | `useLobbyForegroundSync` | Job | `src/sync/appForegroundSync.ts` | Runs the lobby-wide catch-up on mount and every time the app returns to the foreground. |
| L-syncError | `syncError` / `coerceSyncError` | Pure | `src/sync/syncErrors.ts` | Gives every failure a code, a message and a timestamp, and normalises older stored errors into that shape. |
| L-getGroupStore | `getGroupStore` | State | `src/store/groupStore.ts` | Hands out the one observable state object per group — group, members, binds, expenses, sync status, pending queue — persisted so it survives restarts, and repaired on open by `L-normalizeTimestamps`. |
| L-initLocalGroup | `initLocalGroup` | State | `src/store/groupStore.ts` | Seeds a group into its store before a sync fills the rest — used on create and on join. |
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
| L-edgeMintInvite | `mintInviteRemote` | Network | `src/api/edge.ts` | Asks the server to mint a one-use invite for one member of a group this device already belongs to. |
| L-edgeJoin | `joinGroupRemote` | Network | `src/api/edge.ts` | Redeems an invite secret for a new access token and the bind that names who this device is. |

## Server

The Cloudflare Worker and the group Durable Object.

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| L-efCreate | `handleCreateGroup` | Endpoint | `workers/src/index.ts` | Creates the group row in that group's Durable Object and issues an access token, storing only its hash in D1. |
| L-efMintInvite | `handleMintInvite` | Endpoint | `workers/src/index.ts` | Issues a 7-day one-use invite for one member, storing only the hash in D1, after a capability check. |
| L-efJoin | `handleJoin` | Endpoint | `workers/src/index.ts` | Redeems a live invite into a new access token and a v1 bind for the named member, then wakes the group. |
| L-efMerge | `mergeOne` | Endpoint | `workers/src/merge.ts` | The write path: applies each pushed item if its version wins, reports accepted or rejected per item; the Durable Object then wakes the group's other devices. |
| L-efFetch | `fetchEntity` | Endpoint | `workers/src/groupObject.ts` | Returns one entity to a caller whose token proves access to that group. |
| L-efRoster | `listRoster` | Endpoint | `workers/src/groupObject.ts` | Returns every member, bind and expense of a group in one response. |
| L-efAccess | `resolveAccessToken` | Endpoint | `workers/src/indexDb.ts` | The door: hashes the presented token and only lets it through if it is unrevoked and belongs to this group and this device. |
| L-efWake | `broadcastWake` | Network | `workers/src/groupObject.ts` | Tells the group's other devices that something changed, naming only what — never the data itself. A failed wake never undoes the write. |
| L-efHealth | `isHealthRequest` / `healthPayload` | Pure | `workers/src/health.ts` | Lets anyone ask a deployed route which commit it is running, so a server that silently lagged behind the repo can be caught instead of assumed. |
| L-deployTarget | `target_for` | Pure | `docs/scripts/deploy_target.py` | Answers whether a GitHub event and ref may deploy to Worker `splitnext`, and refuses a wipe — `push` to `main` or `slice/**` is yes, everything else is no. |
| L-prPhone | `phone_section` | Pure | `docs/scripts/pr_phone.py` | The PR comment's scan code: a QR of the published web app, so a phone camera opens it without a Metro bundler. |
| L-efShouldAccept | `shouldAccept` | Pure | `workers/src/entities.ts` | The server's name for the version rule, imported from the same module the client tests, so both sides agree on who wins. |
