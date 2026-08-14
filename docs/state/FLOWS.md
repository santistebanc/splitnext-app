# Flows

End-to-end paths a human can trigger. Each step cites a logic id from [LOGIC.md](LOGIC.md) and names arguments / payloads when they matter.

Write **Trigger** and **Outcome** as sentences a newcomer can read — what the person did, and what they end up with. Write each step as a sentence too: who acts, on what, and why. The board tags every step with the layer it runs in, so the reader can see the hop from device to server.

## F-create — Create group

**Trigger** — On the lobby screen, the person taps **Create group**.  
**Outcome** — The group exists on the server, this device holds its access token, and the hub opens.

1. `L-lobby` calls `L-createGroup`.
2. `L-deviceUser` reads this install's id through `L-secureStorage`, creating it the first time.
3. `L-getGroupStore` opens a fresh store for the new group and `L-initLocalGroup` writes version 1 into it — the group is usable offline from this moment.
4. `L-edgeCreate` posts the new group to `L-efCreate`, which registers it and returns an access token.
   - sends `{ group_id, device_user_id, name, currency_label, updated_at }`
   - returns `{ access_token, group }`
5. `L-accessToken` writes that token through `L-secureStorage` and `L-lobbyIds` adds the group to this device's lobby list.
6. `L-wakeSub` opens a hibernating WebSocket on the group's Durable Object so other devices' changes arrive. If the socket is unavailable the group still works — only live updates are lost.

## F-open — Open group

**Trigger** — The person taps a group in the lobby, or the hub screen mounts.  
**Outcome** — The screen shows the latest group and roster, anything pending has been pushed, and live updates are running.

0. `L-getGroupStore` opens the group's store, loading whatever `L-persistPlugin` saved on this device and running `L-normalizeTimestamps` over it, so a reopened group is the same shape as a freshly synced one before anything reads it.
1. `L-hub` calls `L-openGroup` for that group.
2. `L-wakeSub` subscribes for live updates, as in Create group step 6. A failure here is swallowed: browsing must still work.
3. `L-syncGroup` runs a full round trip — see Sync one group.

## F-sync — Sync one group

**Trigger** — Any full refresh of one group: opening it, or the app-wide catch-up.  
**Outcome** — Everything this device had pending is on the server, and the group plus its roster match the server.

1. `L-runExclusive` claims the group, so a push and a pull can never overlap on it.
2. `L-flushQueue` sends everything pending, oldest layer first.
   - `L-sortByFlushOrder` puts the group ahead of its members and members ahead of binds, so nothing arrives before its parent
   - `L-shouldFlush` stops here when the queue is empty
   - `L-accessToken` and `L-deviceUser` supply the proof of access
   - `L-edgeMerge` posts the batch to `L-efMerge` as `[{ entity_type, id, version, payload }, …]`
   - `L-efAccess` checks the token belongs to this group and this device before anything is written
   - the server applies each item through `L-efShouldAccept` and, for each one it accepts, `L-efWake` nudges the group's other devices
   - `L-queuePolicy` drops exactly the versions the server accepted and keeps the rest
   - `L-syncError` clears once the push succeeds
3. `L-applyRemoteFetch` pulls the group row back through `L-edgeFetch` / `L-efFetch`, and `L-applyRemoteEntity` asks `L-shouldAcceptVersion` whether it is newer before `L-commitRemote` writes it.
4. `L-pullRoster` pulls every member, bind and expense in one call through `L-edgeRoster` / `L-efRoster` and commits each one the same way.

## F-foreground — App foreground

**Trigger** — The app launches, or the person switches back to it.  
**Outcome** — Every group this device knows has caught up.

1. `L-rootLayout` mounts `L-foreground`, which listens for the app becoming active.
2. `L-lobbyIds` lists the known groups and `L-syncAllLobby` runs Sync one group on each in parallel, isolating failures so one bad group cannot block the others.

## F-add-member — Add member

**Trigger** — On the hub, the person types a name and taps **Add member**.  
**Outcome** — The person appears in the member list immediately and reaches the server on the next push.

1. `L-hub` calls `L-addMember` with the typed name.
2. The member is written into the store at version 1 and queued — the list updates before any network call.
3. `L-flushQueue` pushes it, exactly as in Sync one group step 2.

## F-add-expense — Add expense

**Trigger** — On the hub, the person taps **+ Expense**, types an amount, and taps **Add expense** on the form.  
**Outcome** — The cost is listed immediately against the member who paid, split among whoever was selected (everyone, if they left the defaults), reaches the server on the next push, and the This is me buttons go away — see This is me.

1. `L-hub` opens `L-expenseNew` for that group from the FAB.
2. `L-expenseNew` defaults the payer to this device's assumed member and checks every live member as sharing.
3. The person types an amount; `L-expenseNew` parses it into whole cents and calls `L-addExpense` with that payer and the checked members.
4. `L-addExpense` refuses a fraction of a cent or a non-positive amount before anything is stored, and refuses a payer who is not a member here.
5. `L-participantsForSplit` accepts the checked members only when they are all live and at least one remains; `L-splitEqually` divides the cost across that set, every cent. The split is frozen into the expense: a member added later joins the next expense, not this one.
6. The expense is written into the store at version 1, split and all, and queued — `L-expenseNew` returns to the hub and `L-expenses` will list it; the hub's balances update before any network call.
7. `L-flushQueue` pushes it as one item, so the split can never arrive half-applied. `L-sortByFlushOrder` puts it after members, so the payer exists on the server before the expense that names them, and `L-efMerge` rejects it outright if that member belongs to another group.
8. `L-balances` refolds and the hub's balances move — the payer up by what they paid, each selected member down by their share. `L-settle` refolds the transfer list from those nets.

## F-balances — See who owes what

**Trigger** — The hub is on screen and the group has at least one expense.  
**Outcome** — Every member's net position, most-negative first, with this device's own member marked.

1. `L-hub` reads the group's members and expenses straight from the store, so the list is as fresh as the last sync and needs no network of its own.
2. `L-balances` credits each payer the full amount and debits each member their share. Because a split always sums to its expense, the nets cancel out across the group.
3. `L-assumedMember` marks which row is yours; `L-memberLabel` writes You (Name) and signs the net. The hub colours a negative the warn colour and a positive the accent.
4. Anything arriving later — a wake, a roster pull — lands in the store and the list refolds on its own.

## F-settle — See who should pay whom

**Trigger** — The hub is on screen and at least one member is not square.  
**Outcome** — Opening a member who owes shows the transfers they would pay. The list does not move money; a tap opens the form for that transfer and does not record it.

1. `L-hub` already has the nets from `L-balances`, so settle-up needs no network of its own.
2. `L-settle` drops members at zero, partitions the rest into as many zero-sum subgroups as exist, and pairs poorest with richest inside each. Two devices holding the same nets list the same transfers.
3. Tapping a balance row opens `L-member`. `L-settlementsForMember` keeps only that person's outgoing transfers. Each button pushes `L-settlementHref` into `L-expenseNew`; Back abandons.
4. When that member has no outgoing transfer — they are square, or only owed — the settle block is absent.

## F-settle-record — Record a suggested transfer

**Trigger** — On a member screen, the person taps a settle button, checks the form, and taps **Add expense**.  
**Outcome** — That transfer is recorded as an ordinary expense: the debtor paid, only the creditor shares, what-for is Settlement. The tap itself did not move money.

1. `L-member` already has the transfers from `L-settlementsForMember`.
2. The button's `L-settlementHref` opens `L-expenseNew` with payer, amount in cents, the creditor as the only participant, and what-for `Settlement`.
3. `L-expensePrefill` turns that query into the form's starting values; missing or non-money params would have left the You / everyone defaults, which this path does not hit.
4. **Add expense** calls `L-addExpense` with that payer and the one-person share — the same write as any other expense.
5. `L-expenseNew` returns to `L-member`. `L-balances` and `L-settle` refold from the new expense, so that transfer is gone or the list shrinks. `L-expenses` lists the Settlement row.

## F-bind — This is me

**Trigger** — On the hub, the person taps **This is me** on a member row. Every member offers the button while the group has no expenses, so the choice can be made and changed freely.  
**Outcome** — That member is this device's own person; the hub shows You (Name) and that row's button goes away, while the others stay offerable until the first expense.

1. `L-hub` shows the button on every member except the one already claimed, as long as `L-bindingOpen` says the group has no live expense.
2. `L-hub` calls `L-bindMe` with the member tapped.
3. `L-bindMe` refuses once an expense exists, recording `binding_closed` — the UI hides the button by then, so this is the rule behind the rule, not a message anyone should normally see. A missing member records `member_missing`.
4. A bind linking this device to that member is written locally and queued. If this device already had a bind, that same bind is re-pointed at the new member at the next version rather than a second one being created, so "which member am I?" never depends on which bind is found first.
5. `L-flushQueue` pushes it, and the server rejects it unless the member belongs to the same group.
6. `L-assumedMember` now resolves this device to that member, which is what puts You (Name) on the hub.
7. The first expense closes it: `L-bindingOpen` turns false, every remaining button disappears, and the choice is fixed until some future slice offers a deliberate way to change it.

## F-invite — Invite a member

**Trigger** — On the hub, the person taps **Invite** on a member who is not You.  
**Outcome** — A join link for that member is shown (and copied when the platform allows). Another device can redeem it once, within seven days.

1. `L-hub` shows **Invite** on every live member except You, then calls `L-mintInvite` with the member tapped.
2. `L-edgeMintInvite` posts to `L-efMintInvite`, which checks this device's access token, refuses a missing or tombstoned member, stores the hash, and returns the plaintext once.
3. `L-hub` shows the `/join?token=` link (web) or the raw token (native) via `L-inviteShare`. The secret is not kept on the device after that.

## F-join — Join from an invite

**Trigger** — On another device, the person opens the join link, or pastes the token on the lobby and taps **Join group**.  
**Outcome** — The group is on this device, this device is already that member, and **This is me** does not appear for them.

1. `L-join` (from the URL) or `L-lobby` (from paste) calls `L-joinGroup`. `L-parseInviteToken` accepts either a raw token or a `/join?token=` URL.
2. `L-edgeJoin` posts the secret and this install's `device_user_id` to `L-efJoin`.
3. `L-efJoin` looks up the hash. `L-inviteIsLive` (the same three checks, on the server) refuses a spent, expired, or tombstoned-member invite. A device that already has a live token for the group is refused without consuming the invite.
4. On success it mints an access token, inserts a v1 bind for the named member, marks the invite redeemed, and `L-efWake` tells the group's other devices.
5. `L-joinGroup` stores the token, adds the group to the lobby, and commits the bind. The hub then `L-openGroup`s — subscribe for wakes, then pull the roster — so the live socket is started on the screen that stays open, not on the join spinner that unmounts.
6. `L-assumedMember` already resolves, so `L-hub` shows You (Name) and no **This is me** for this device.

## F-bump — Bump group name

**Trigger** — On the hub, the person renames the group.  
**Outcome** — The new name shows at once here and reaches the other devices without them asking.

1. `L-hub` calls `L-bumpName` with the new name.
2. The name changes in the store at the next version number and is queued, so the UI never waits on the network.
3. `L-flushQueue` pushes it; the server accepts the higher version and `L-efWake` announces the change.
4. On the other device, `L-wakeSub` hears that announcement and `L-applyRemoteFetch` fetches just that group.

## F-wake — Peer change arrives live

**Trigger** — Another device changed something while this one was subscribed.  
**Outcome** — That one entity is refetched and applied, if it is newer than the local copy.

1. `L-wakeSub` receives a wake naming only what changed — `{ group_id, entity_type, id, version }`, never the data itself.
2. `L-applyRemoteFetch` fetches that single entity and commits it if its version wins.

## F-wake-reconnect — Catch up after a dropped socket

**Trigger** — The wake socket drops while the hub is still open.  
**Outcome** — This group matches the server again, without waiting for a foreground.

1. `L-wakeSub` sees the socket leave `OPEN` — `ERROR` or `CLOSED`.
2. It retries after `L-wakeCatchUp`'s backoff (1s, then doubling, capped at 30s). A close of a socket it already replaced is ignored.
3. When the socket is `OPEN` again, `L-wakeCatchUp` says this group missed wakes. The first `OPEN` does not, because `L-openGroup` already ran `L-syncGroup`.
4. `L-wakeSub` runs `L-syncGroup` for that group only — flush, fetch the group, pull the roster — the same catch-up as Open group.
