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
| L-lobby | Lobby screen | Screen | `app/index.tsx` | The first screen (no header): content is vertically centered; **groups** lists every group this device knows by name with a one-line member summary (the section is omitted when there are none), **Create group** (opens the create form), and under it a quiet Join with link (expands to a focused field). Tapping a group opens the hub. On the first lobby visit each app session, when a last-opened group is still known, replaces to that hub automatically. |
| L-create | Create group screen | Screen | `app/create.tsx` | The create form: group name, your name, and a currency picker (symbol + name, drawer of every tender currency). Submit runs `L-createGroup` and opens the hub already named and bound. |
| L-hub | Group hub | Screen | `app/group/[id]/index.tsx` | One group's home: the group name centered in the space above the list (header is home and settings; home opens the lobby); names until the first expense (right-aligned, rows open member detail), then balances as two columns (name right-aligned, amount left-aligned; type grows with leftover space, capped so a 6-digit amount stays fully visible without scrolling — longer names ellipsize, amounts never do); add member + directly under the list; **Recent activity** (last three events) and **View all events** pinned above the expense CTAs when anything is recorded; a toast when sync brings someone else's activity; **View all expenses** at the bottom once there is a cost; a FAB to record a cost once bound; surfaces the last sync error. |
| L-activity | Activity | Screen | `app/group/[id]/activity.tsx` | Full activity list from **View all events** on the hub; scrollable, newest first. |
| L-settings | Settings screen | Screen | `app/group/[id]/settings.tsx` | Group name and a currency picker (same drawer as create), Done once the group is named and this device is someone, and Leave group (confirm drawer). |
| L-member | Member screen | Screen | `app/group/[id]/member/[memberId].tsx` | One member's screen: the display name and an edit icon in the header (tap expands the title to a field; blur or enter commits), an **invite link** heading and join-link row (copy / share) if that slot is unclaimed, and — once the group has an expense — what they paid for and owe for (omitted when empty; a line opens that expense for edit), their net, and suggested settlement as text plus a Settle button. Unclaimed non-You slots also get **Remove member** (confirm drawer). |
| L-expenses | All expenses | Screen | `app/group/[id]/expenses.tsx` | The group's expense list, pushed from the hub, newest first. A row opens that expense for edit. |
| L-expenseNew | New expense | Screen | `app/group/[id]/expense/new.tsx` | Records a cost or edits one: who paid (drawer, same shape as currency), how much (large amount field, focused on create), who shares (equal 1-share by default, or share units and fixed cents), and what for last. Edit adds header **Delete** with a confirm drawer. Edit (`app/group/[id]/expense/[expenseId].tsx`) loads the stored intent. |
| L-join | Join screen | Screen | `app/join.tsx` | Redeems a `/j/{token}` invite (or a legacy `/join?token=`), stores the new access token, and opens the hub already bound to the named member. The `/j/[token]` route (`app/j/[token].tsx`) re-exports this screen. |
| L-landing | Public landing | Screen | `landing/index.html` | Public GitHub Pages home: showcase copy, a hub preview, and **Use on web**. Not the slicer board. |
| L-tryWeb | Use on web | Screen | `landing/try/index.html` | Desktop phone frame with a live iframe of `/app`; a narrow window redirects to full-bleed `/app`. |
| L-rootLayout | Root layout | Screen | `app/_layout.tsx` | The app shell; it starts the background catch-up sync so groups refresh on launch and on return to the app. |
| L-confirmDrawer | `ConfirmDrawer` | Screen | `src/ui/ConfirmDrawer.tsx` | A bottom confirm sheet for destructive actions: title, message, Cancel, and confirm; backdrop tap cancels. Used for Leave group and Delete expense. |
| L-activityLineText | `ActivityLineText` | Screen | `src/ui/ActivityLineText.tsx` | Renders one activity line with per-kind verbs (`added`, `edited`, `deleted`, `removed`, `renamed`); the expense or member name is semibold ink. |
| L-activityRow | `ActivityRow` | Screen | `src/ui/ActivityRow.tsx` | One activity line plus a relative time label on the right; the label refreshes every minute. |
| L-activityToast | `ActivityToast` | Screen | `src/ui/ActivityToast.tsx` | Brief bottom banner on the hub when sync brings someone else's activity; auto-dismiss; tap opens the Activity page. |

## Device

Everything else running on the device: domain rules, sync, local state, secrets.

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| L-shouldAcceptVersion | `shouldAcceptVersion` | Pure | `src/domain/version.ts` | Decides who wins when two copies of an entity disagree: the incoming one, but only if its version number is strictly higher. |
| L-sortByFlushOrder | `sortByFlushOrder` | Pure | `src/domain/version.ts` | Orders pending changes so parents reach the server before their children — a group before its members, a member before the bind pointing at it. |
| L-assumedMember | `assumedMemberIdFromBinds` | Pure | `src/domain/assumedMember.ts` | Answers "which member am I in this group?" by finding this device's live bind. |
| L-memberClaimed | `memberIsClaimed` | Pure | `src/domain/assumedMember.ts` | Answers whether a member slot is joined — a live bind points at them — which is what offers the join-link row on an unclaimed member. |
| L-tombstoneBind | `tombstoneBind` | Pure | `src/domain/bind.ts` | Soft-deletes a live bind at the next version so the member slot remains and this device is no longer that person. |
| L-bindOnce | `bindOnce` | Pure | `src/domain/bind.ts` | Answers whether this device may bind: allowed with no live bind, a no-op for the same member, refused for any other. A tombstone does not count as live. |
| L-bindingOpen | `bindingIsOpen` | Pure | `src/domain/assumedMember.ts` | Answers whether the group still has no live expense — the hub shows names until the first one, then balances. |
| L-splitEqually | `splitEqually` | Pure | `src/domain/split.ts` | Divides a cost equally, to the cent, across the members given. Leftover cents go out in member-id order, so two devices splitting the same cost agree exactly. One participant receives the whole amount. The equal case of `L-allocateMixed`. |
| L-allocateMixed | `allocateMixed` | Pure | `src/domain/allocateMixed.ts` | Allocates an expense: fixed cents come off the total first, the rest by share units; leftover cents by largest remainder then member id. |
| L-splitEditor | `equalSplitState` / `increaseMemberSplit` / `decreaseMemberSplit` / `commitMemberFixedAmount` / `deriveSplitEditor` | Pure | `src/domain/splitEditor.ts` | The who-shares editor: +/- shares, tap amount for fixed, at least one non-fixed share member remains. |
| L-participantsForSplit | `participantsForSplit` | Pure | `src/domain/split.ts` | Answers who shares an expense: the selected members, but only if every one of them is live and at least one remains. A missing member is refused, not dropped. |
| L-balances | `computeBalances` | Pure | `src/domain/balances.ts` | Works out what each member is up or down overall — what they paid minus what they owe — most-negative first. |
| L-memberBuckets | `memberBuckets` | Pure | `src/domain/buckets.ts` | Lists one member's expenses as paid-for and owe-for lines — one line per expense, amount equal to their net on that expense — so the two buckets add up to their balance. |
| L-settle | `suggestSettlements` | Pure | `src/domain/settle.ts` | Turns those nets into the fewest transfers that zero everyone who can be settled, identical on every device. |
| L-settlementsForMember | `settlementsForMember` | Pure | `src/domain/settle.ts` | Picks the transfers one member would pay, in the same order the group list had them, so a member screen does not invent a different settle-up. |
| L-theme | `colors` | Pure | `src/ui/theme.ts` | The prototype palette every screen paints with, so a hex is not invented per file. |
| L-memberLabel | `memberLabel` / `formatMoney` / `formatCents` | Pure | `src/ui/format.ts` | How a member is labelled You (no parenthetical name) and how integer cents become signed decimal text with the currency's symbol, without a float. |
| L-currency | `currencySymbol` / `allCurrencies` | Pure | `src/domain/currency.ts` | Maps a stored ISO code to its symbol and lists every tender currency for the picker. Unknown codes stay as typed. |
| L-expensePrefill | `expensePrefillFromSearchParams` | Pure | `src/domain/expensePrefill.ts` | Turns the new-expense query into payer, integer cents, who shares, and what-for — or `null` if a required piece is missing or is not money, so the form can keep its defaults. |
| L-settlementHref | `settlementHref` | Pure | `src/domain/expensePrefill.ts` | Builds the path a settle button opens: same transfer, same href on every device, amount in integer cents, what-for `Settlement`. |
| L-inviteIsLive | `inviteIsLive` | Pure | `src/domain/invite.ts` | Answers whether an invite can still be redeemed — not spent, not past `expires_at`, and the named member still live. |
| L-parseInviteToken | `parseInviteToken` | Pure | `src/domain/invite.ts` | Pulls the invite secret out of a raw token, a `/j/{token}` path, or a `/join?token=` URL so lobby paste and the join routes share one parser. |
| L-createGroup | `createGroup` | Job | `src/sync/groupSync.ts` | Creates a group from a name, currency, and creator name: writes the group, that member, and this device's bind locally first, registers the group on the server, stores the returned access token, adds it to the lobby, flushes the member and bind, and starts a wake subscription without waiting for the socket to open. |
| L-openGroup | `openGroup` | Job | `src/sync/groupSync.ts` | Opens a group for viewing — remembers it as last opened, registers for push (native), subscribes for wakes, then runs a full sync. The wake socket being down does not block opening. |
| L-syncGroup | `syncGroup` | Job | `src/sync/groupSync.ts` | One full round trip for a group: push everything pending, pull the group back, then pull its roster. Runs alone per group so nothing races. |
| L-syncAllLobby | `syncAllLobbyGroups` | Job | `src/sync/groupSync.ts` | Syncs every group this device knows at once, isolating failures so one bad group cannot block the rest. |
| L-patchGroup | `patchGroup` | Pure | `src/domain/group.ts` | Next version of a group with a new name and/or currency; omitted fields stay, and an empty currency label keeps the current one. |
| L-createGroupDraft | `createGroupDraft` | Pure | `src/domain/group.ts` | Builds the local v1 group, creator member, and this device's bind, or null when the group name or creator name is empty. An empty currency label becomes EUR. |
| L-lobbyTitle | `lobbyGroupTitle` | Pure | `src/domain/lobby.ts` | The lobby row's title: the trimmed group name, or (empty) when it has none. |
| L-lobbyMembers | `lobbyMemberSummary` | Pure | `src/domain/lobby.ts` | A one-line list of live member names in member-id order, or null when the group has nobody to name. |
| L-lastOpened | `lastOpenedHubId` | Pure | `src/domain/lastOpened.ts` | Returns the last-opened group id when it is still on the lobby, else null. |
| L-lastOpenedSession | `shouldAutoOpenLastGroup` / `markAutoOpenedLastGroup` | Pure | `src/domain/lastOpenedSession.ts` | Session gate so the lobby auto-opens the last hub once per app launch, not when the user taps Home. |
| L-settingsDone | `settingsDoneEnabled` | Pure | `src/domain/group.ts` | Answers whether Settings **Done** may fire — the group has a non-empty name and this device is already someone. |
| L-updateGroup | `updateGroup` | Job | `src/sync/groupSync.ts` | Patches the group locally and sends the next version to the server, so Settings never waits on the network to show. |
| L-patchMember | `patchMember` | Pure | `src/domain/member.ts` | Next version of a member with a new display name, or null when the trimmed name is empty or unchanged. |
| L-updateMember | `updateMember` | Job | `src/sync/groupSync.ts` | Renames a member locally, appends a `member_renamed` activity when this device has an assumed member, queues both, and flushes. A missing or tombstoned member is a no-op. |
| L-addMember | `addMember` | Job | `src/sync/groupSync.ts` | Adds a person to the group locally, then sends them to the server. |
| L-addExpense | `addExpense` | Job | `src/sync/groupSync.ts` | Records a cost: refuses anything that is not a positive whole number of cents, splits it via `L-allocateMixed` from the editor (everyone 1 share, if the form did not narrow it), writes it locally against the paying member, appends an `expense_added` activity when this device has an assumed member, then sends both (activity after expense in flush order). The payer need not be in the split. |
| L-patchExpense | `patchExpense` | Pure | `src/domain/expense.ts` | Next version of an expense with a new split (share units and optional fixed cents), or null when the trimmed fields and split intent are unchanged, the amount is not positive cents, the payer is not live, or the share set is invalid. |
| L-tombstoneExpense | `tombstoneExpense` | Pure | `src/domain/expense.ts` | Soft-deletes a live expense at the next version, or null when already tombstoned. |
| L-tombstoneMember | `tombstoneMember` | Pure | `src/domain/member.ts` | Soft-deletes a live member at the next version, or null when already tombstoned. |
| L-updateExpense | `updateExpense` | Job | `src/sync/groupSync.ts` | Applies that patch, queues the expense and an `expense_edited` activity when this device has an assumed member, and flushes. A missing or tombstoned expense is a no-op. |
| L-deleteExpense | `deleteExpense` | Job | `src/sync/groupSync.ts` | Tombstones an expense locally, queues it and an `expense_deleted` activity when this device has an assumed member, and flushes. Missing or already deleted is a no-op. |
| L-deleteMember | `deleteMember` | Job | `src/sync/groupSync.ts` | Tombstones a member locally, queues it and a `member_kicked` activity when this device has an assumed member, and flushes. Missing or already deleted is a no-op. |
| L-activityForExpenseAdded | `activityForExpenseAdded` | Pure | `src/domain/activity.ts` | Builds a version-1 `expense_added` activity for an expense, or null when ids are missing. |
| L-activityForExpenseEdited | `activityForExpenseEdited` | Pure | `src/domain/activity.ts` | Builds a version-1 `expense_edited` activity, or null when ids are missing. |
| L-activityForExpenseDeleted | `activityForExpenseDeleted` | Pure | `src/domain/activity.ts` | Builds a version-1 `expense_deleted` activity, or null when ids are missing. |
| L-activityForMemberKicked | `activityForMemberKicked` | Pure | `src/domain/activity.ts` | Builds a version-1 `member_kicked` activity, or null when ids are missing. |
| L-activityForMemberRenamed | `activityForMemberRenamed` | Pure | `src/domain/activity.ts` | Builds a version-1 `member_renamed` activity, or null when ids are missing. |
| L-formatActivityLine | `formatActivityLine` / `sortActivities` / `formatActivityLinePlain` | Pure | `src/domain/activity.ts` | Turns an activity plus members and expenses into one readable line per kind; plain text for push. Sorts live events newest first. Tombstoned targets still format for delete/kick lines. |
| L-activitiesFromOthers | `activitiesFromOthers` | Pure | `src/domain/activity.ts` | New live activities since a snapshot, excluding this device's actor — used for the hub toast. |
| L-relativeTime | `relativeTimeLabel` | Pure | `src/domain/relativeTime.ts` | Formats an activity timestamp as a relative label (`just now`, `5m ago`, …). |
| L-bindMe | `bindMe` | Job | `src/sync/groupSync.ts` | Claims a member as this device's own person the first time. Same member again is a no-op; any other member records `binding_locked`. A missing member records `member_missing`. Create and join are the callers that succeed. |
| L-leaveGroup | `leaveGroup` | Job | `src/sync/leave.ts` | Leaves a group: tombstones this device's bind and flushes it while the token still works, revokes push registration, revokes the token, drops it locally, and takes the group off the lobby. |
| L-mintInvite | `mintInvite` | Job | `src/sync/invite.ts` | Asks the server for a one-use invite bound to one member and returns the plaintext secret to copy. |
| L-inviteShare | `inviteShareText` | Pure | `src/sync/inviteShareText.ts` | Turns that secret into what you copy: the raw token on native, a `/j/{token}` URL on web. |
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
| L-wakeSub | `startWakeSubscription` / `stopWakeSubscription` / `wakeUrl` | Network | `src/sync/wake.ts` | Opens a hibernating WebSocket on the group's Durable Object; a wake runs that group's full catch-up (`L-syncGroup`). If the socket drops, it retries with backoff and then runs catch-up on reconnect. A close of a socket already replaced is ignored, so error-then-close is one retry. Leave closes the socket and does not retry. One live socket per group. The URL carries the token on the query string because RN `WebSocket` cannot set headers. |
| L-foreground | `useLobbyForegroundSync` | Job | `src/sync/appForegroundSync.ts` | Runs the lobby-wide catch-up on mount and every time the app returns to the foreground. |
| L-syncError | `syncError` / `coerceSyncError` | Pure | `src/sync/syncErrors.ts` | Gives every failure a code, a message and a timestamp, and normalises older stored errors into that shape. |
| L-getGroupStore | `getGroupStore` | State | `src/store/groupStore.ts` | Hands out the one observable state object per group — group, members, binds, expenses, sync status, pending queue — persisted so it survives restarts, and repaired on open by `L-normalizeTimestamps`. |
| L-initLocalGroup | `initLocalGroup` | State | `src/store/groupStore.ts` | Seeds a group into its store before a sync fills the rest — used on create and on join. |
| L-deviceUser | `getOrCreateDeviceUserId` | State | `src/device/deviceUser.ts` | The identity of this install: one id, generated once and kept in the secret store, since there are no accounts. |
| L-secureStorage | `getSecret` / `setSecret` / `deleteSecret` | State | `src/secrets/secureStorage.ts` | The one door to the device's secrets. Native goes to the OS keychain; the web build swaps in `src/secrets/secureStorage.web.ts` (`localStorage`), which is why nothing wider than a per-group token belongs here. |
| L-normalizeTimestamps | `normalizePersistedTimestamps` | Pure | `src/store/timestamps.ts` | Undoes the `Date` objects that reloading a saved store invents in place of our timestamp strings, so a reopened group holds exactly what a freshly synced one does. |
| L-persistPlugin | `persistPlugin` | State | `src/store/persistPlugin.ts` | Where a store survives a restart: SQLite on a device, `localStorage` on web, so the browser target needs no wasm. |
| L-accessToken | `getAccessToken` / `saveAccessToken` / `deleteAccessToken` | State | `src/secrets/tokens.ts` | Keeps each group's capability token in the secret store — holding it is what proves access to that group; deleting it is how leave drops the secret. |
| L-lobbyIds | `listLobbyGroupIds` / `addLobbyGroupId` / `removeLobbyGroupId` / `getLastOpenedGroupId` / `saveLastOpenedGroupId` / `clearLastOpenedGroupId` | State | `src/secrets/tokens.ts` | The device's list of known group ids, which is what the lobby and the catch-up sync iterate over, plus the last hub opened on this device. Removing a group clears a matching last-opened id. Temporary home. |
| L-registerPushToken | `registerPushTokenForGroup` | Job | `src/push/registerPushToken.ts` | Registers this device's Expo push token with the Worker for a group (native only; web no-op). |
| L-revokePushToken | `revokePushTokenForGroup` | Job | `src/push/revokePushToken.ts` | Revokes this device's push token for a group on leave (native; web no-op). |
| L-usePushNotificationOpen | `usePushNotificationOpen` | Job | `src/push/usePushNotificationOpen.ts` | Opens the group hub when the user taps a push notification. |
| L-pushRecipients | `pushRecipientTokens` | Pure | `workers/src/pushRecipients.ts` | Picks Expo tokens for devices that should receive a push — excludes actor device and devices bound to the actor member. |
| L-activityPushMessage | `activityPushMessage` | Pure | `workers/src/pushMessage.ts` | Builds push title/body from an activity and roster snapshot. |
| L-expoPush | `sendExpoPush` | Network | `workers/src/expoPush.ts` | Sends messages to Expo Push API; no-op when access token unset. |

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
| L-edgeLeave | `leaveGroupRemote` | Network | `src/api/edge.ts` | Asks the server to revoke this device's access token for a group. |

## Server

The Cloudflare Worker and the group Durable Object.

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| L-efCreate | `handleCreateGroup` | Endpoint | `workers/src/index.ts` | Creates the group row in that group's Durable Object and issues an access token, storing only its hash in D1. |
| L-efMintInvite | `handleMintInvite` | Endpoint | `workers/src/index.ts` | Issues a 7-day one-use invite for one member (11-char secret, hashed in D1) after a capability check. |
| L-efJoin | `handleJoin` | Endpoint | `workers/src/index.ts` | Redeems a live invite into a new access token and a v1 bind for the named member, then wakes the group. |
| L-efLeave | `handleLeave` | Endpoint | `workers/src/index.ts` | Revokes this device's access token after matching group and device (`accessIdentifies`), including when the token is already revoked — that is still success. The member and expenses are not touched. |
| L-efMerge | `mergeOne` | Endpoint | `workers/src/merge.ts` | The write path: applies each pushed item if its version wins, reports accepted or rejected per item; the Durable Object then wakes the group's other devices. |
| L-efFetch | `fetchEntity` | Endpoint | `workers/src/groupObject.ts` | Returns one entity to a caller whose token proves access to that group. |
| L-efRoster | `listRoster` | Endpoint | `workers/src/groupObject.ts` | Returns every member, bind and expense of a group in one response. |
| L-efAccess | `resolveAccessToken` | Endpoint | `workers/src/indexDb.ts` | The door: hashes the presented token and only lets it through if it is unrevoked and belongs to this group and this device. |
| L-efWake | `broadcastWake` | Network | `workers/src/groupObject.ts` | Tells the group's other devices that something changed, naming only what — never the data itself. A failed wake never undoes the write. |
| L-efHealth | `isHealthRequest` / `healthPayload` | Pure | `workers/src/health.ts` | Lets anyone ask a deployed route which commit it is running, so a server that silently lagged behind the repo can be caught instead of assumed. |
| L-deployTarget | `target_for` | Pure | `docs/scripts/deploy_target.py` | Answers whether a GitHub event and ref may deploy to Worker `splitnext`, and refuses a wipe — `push` to `main` or `slice/**` is yes, everything else is no. |
| L-prPhone | `phone_section` | Pure | `docs/scripts/pr_phone.py` | The PR comment's scan code: a QR of the published web app, so a phone camera opens it without a Metro bundler. |
| L-assemblePages | `assemble` | Pure | `docs/scripts/assemble_pages.py` | Builds the public Pages tree: landing at `/`, Expo export at `/app`. Never copies the slicer board. |
| L-efShouldAccept | `shouldAccept` | Pure | `workers/src/entities.ts` | The server's name for the version rule, imported from the same module the client tests, so both sides agree on who wins. |
