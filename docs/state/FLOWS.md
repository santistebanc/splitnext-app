# Flows

End-to-end paths a human can trigger. Each step cites a logic id from [LOGIC.md](LOGIC.md) and names arguments / payloads when they matter.

Write **Trigger** and **Outcome** as sentences a newcomer can read — what the person did, and what they end up with. Write each step as a sentence too: who acts, on what, and why. The board tags every step with the layer it runs in, so the reader can see the hop from device to server.

## F-create — Create group

**Trigger** — On the lobby screen, the person taps **Create group**, fills group name, their name, and currency (a picker, default Euro), and taps **Create group** again.  
**Outcome** — The group exists on the server, this device holds its access token, this device is already the named member, and the hub opens on names plus a + to add a member — not Settings, not 0.00.

1. `L-lobby` opens `L-create`.
2. `L-create` calls `L-createGroup` with the typed name, chosen currency, and creator name. Empty name or creator name keeps submit off; empty currency becomes `EUR` via `L-createGroupDraft`.
3. `L-deviceUser` reads this install's id through `L-secureStorage`, creating it the first time.
4. `L-getGroupStore` opens a fresh store for the new group and `L-initLocalGroup` writes version 1 into it — the group is usable offline from this moment. `L-createGroupDraft` also writes the creator member and this device's bind.
5. `L-edgeCreate` posts the new group to `L-efCreate`, which registers it and returns an access token.
   - sends `{ group_id, device_user_id, name, currency_label, updated_at }`
   - returns `{ access_token, group }`
6. `L-accessToken` writes that token through `L-secureStorage` and `L-lobbyIds` adds the group to this device's lobby list. The member and bind are queued and `L-flushQueue` pushes them.
7. `L-wakeSub` opens a hibernating WebSocket on the group's Durable Object so other devices' changes arrive. If the socket is unavailable the group still works — only live updates are lost.
8. `L-create` opens `L-hub` for the new group. `L-assumedMember` already resolves, so the hub shows You and a + to add a member.

## F-open — Open group

**Trigger** — The person taps a group row in the lobby (`L-lobbyTitle` and `L-lobbyMembers`), or the hub screen mounts.  
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

**Trigger** — On the hub, the person taps the + under the list, types a name, and submits.  
**Outcome** — The person appears in the list immediately and reaches the server on the next push.

1. `L-hub` is already open. The + **add member** control sits under the names or balances, on the right.
2. Tapping it opens a name field. Submit calls `L-addMember` with the typed name.
3. The member is written into the store at version 1 and queued — the list updates before any network call.
4. `L-flushQueue` pushes it, exactly as in Sync one group step 2.

## F-rename — Rename a member

**Trigger** — On a member screen, the person taps the edit icon, types a new name, and submits or leaves the field.  
**Outcome** — That slot’s display name updates on their screen and anywhere the name itself is shown. This device’s hub row stays You. Who they are (the bind) does not change.

1. `L-hub` expands `L-memberDetail` — a names row or a balance row.
2. `L-memberDetail` shows the display name and an edit icon in the panel. Tapping the icon turns the title into a focused field.
3. Blur or enter calls `L-updateMember`. `L-patchMember` builds the next version, or returns null when the trimmed name is empty or unchanged — then nothing is written.
4. The title is restored with the new display name. A successful write updates the store and queues the member; `L-flushQueue` pushes it.
5. **Close** returns to `L-hub`. `L-memberLabel` still writes You for this device's member; other rows and `L-lobbyMembers` show the new name. Expenses and the bind still point at the same member id.

## F-kick-member — Remove a member

**Trigger** — On an unclaimed member's screen, the person taps **Remove member**, reads the confirm drawer, and taps **Remove member** again.  
**Outcome** — That member id drops off the hub, lobby summary, and pickers. Past expenses and allocations stay; live folds exclude the tombstone.

1. `L-hub` expands `L-memberDetail` for a slot that is not You and has no live bind.
2. **Remove member** sits at the bottom. You and claimed slots omit it.
3. Confirm drawer (same shape as Leave and Delete) then `L-deleteMember` calls `L-tombstoneMember`, queues the member, and flushes.
4. `L-memberDetail` closes back to `L-hub`. `L-balances` and `L-lobbyMembers` no longer list that id.

## F-add-expense — Add expense

**Trigger** — On the hub, the person taps **+ Expense**, types an amount, and taps **Add expense** on the form.  
**Outcome** — The cost is listed immediately against the member who paid, split among whoever was selected (everyone, if they left the defaults), reaches the server on the next push, and the hub switches from names to balances.

1. `L-hub` opens `L-expenseNew` for that group from the FAB.
2. `L-expenseNew` shows **Paid by** first as a drawer (same shape as currency), defaulting to this device's assumed member, then a large amount field (focused on create, not edit), who shares (everyone 1 share unless the query prefills), and **What for** last.
3. The person types an amount; `L-expenseNew` parses it into whole cents and calls `L-addExpense` with that payer and the checked members.
4. `L-addExpense` refuses a fraction of a cent or a non-positive amount before anything is stored, and refuses a payer who is not a member here.
5. `L-participantsForSplit` accepts the checked members only when they are all live and at least one remains; `L-allocateMixed` (equal 1-share) divides the cost across that set, every cent. The split is frozen into the expense: a member added later joins the next expense, not this one.
6. The expense is written into the store at version 1, split and all, and queued — `L-expenseNew` returns to the hub and `L-expenses` will list it; the hub's balances update before any network call. When this device has an assumed member, `L-addExpense` also queues an `expense_added` activity (flush order puts it after the expense). **View all expenses** shows **Pending** on that row until the server accepts it (`L-expenseIsPending`).
7. `L-flushQueue` pushes both items, so the split can never arrive half-applied. `L-sortByFlushOrder` puts the expense after members and the activity after expenses, so the payer and expense exist on the server before the activity that names them.
8. `L-balances` refolds and the hub's balances move — the payer up by what they paid, each selected member down by their share. `L-settle` refolds the transfer list from those nets. After this first live expense, `L-hub` shows balances, **View all expenses** at the bottom, and the + to add a member.

## F-activity — Activity feed

**Trigger** — After recording a cost, the person sees **Recent activity** on the hub (last three events) and can tap **View all events** for the full list.  
**Outcome** — One line for that add (“You added …” with description and amount). Newest first.

1. `L-addExpense` already wrote the `expense_added` activity when this device has an assumed member.
2. `L-hub` shows up to three lines pinned above the expense CTAs via `L-activityRow` (`L-formatActivityLine`, `L-relativeTime`).
3. **View all events** expands `L-activityFeed` on `L-hub` with every live event and relative timestamps. **Close** returns to the hub.
4. On another device, the same add wakes this hub; `L-activitiesFromOthers` surfaces it and `L-activityToast` shows a banner until dismiss or tap (expands `L-activityFeed` on the hub).

## F-edit-expense — Edit an expense

**Trigger** — On All expenses, or on a member's paid-for / owe-for line, the person opens an expense, changes amount, payer, who shares, or what-for, and taps **Save**.  
**Outcome** — That expense is the same id at the next version, split from the editor (equal 1-share unless they changed units or a fixed amount). Hub nets and buckets refold. A second expense is not created.

1. `L-expenses` or a `L-member` bucket line opens `L-expenseNew` on `/expense/{id}` with the stored expense loaded — live members who were not in the original split stay out. Cents-only (pre-mixed) rows open as 1 share each.
2. Save calls `L-updateExpense`. `L-patchExpense` rebuilds allocations via `L-allocateMixed`, or returns null when nothing changed — then nothing is written and Save stays off.
3. A successful write updates the store and queues the expense; `L-flushQueue` pushes it as one item, same as add.
4. While that version is still queued, `L-expenses` shows **Pending** on the row (`L-expenseIsPending`).
5. `L-balances` and `L-memberBuckets` refold from the new version. The list still shows one row for that id.

## F-delete-expense — Delete an expense

**Trigger** — On the edit form, the person taps **Delete**, confirms, and the expense is tombstoned.  
**Outcome** — That id drops out of All expenses, member buckets, and balance folds. The same expense is not hard-deleted.

1. `L-expenses` or a bucket line opens edit; **Delete** is in the header.
2. Confirm drawer (same shape as Leave in Settings) then `L-deleteExpense` calls `L-tombstoneExpense`, queues the expense, and flushes.
3. `L-expenseNew` returns to the previous screen; lists and `L-balances` no longer include that expense.

## F-mixed-split — Unequal split

**Trigger** — On the new-expense form, with at least two members, the person types an amount, taps **Increase share** on one row, and taps **Add expense**.  
**Outcome** — That member takes two shares; the others keep one. Hub nets match the mixed fold. The expense still has one id.

1. `L-hub` opens `L-expenseNew`. The list starts at 1 share each (`L-splitEditor`).
2. **+/-** and tap-amount call `L-splitEditor`; `L-allocateMixed` shows the live cents on each row.
3. `L-addExpense` writes `share_units` and optional `fixed_cents` inside the expense with the frozen `amount_cents`.
4. `L-balances` refolds from those cents.

## F-balances — See who owes what

**Trigger** — The hub is on screen and the group has at least one expense.  
**Outcome** — Every member's net position, most-negative first, with this device's own member marked.

1. `L-hub` reads the group's members and expenses straight from the store, so the list is as fresh as the last sync and needs no network of its own.
2. `L-balances` credits each payer the full amount and debits each member their share. Because a split always sums to its expense, the nets cancel out across the group.
3. `L-assumedMember` marks which row is yours; `L-memberLabel` writes You and signs the net. The hub colours a negative the warn colour and a positive the accent.
4. Anything arriving later — a wake, a roster pull — lands in the store and the list refolds on its own.

## F-settle — See who should pay whom

**Trigger** — The hub is on screen and at least one member is not square.  
**Outcome** — Opening a member who owes shows what they paid for, what they owe for, and the transfers they would pay. The list does not move money; a tap opens the form for that transfer and does not record it.

1. `L-hub` already has the nets from `L-balances`, so settle-up needs no network of its own.
2. `L-settle` drops members at zero, partitions the rest into as many zero-sum subgroups as exist, and pairs poorest with richest inside each. Two devices holding the same nets list the same transfers.
3. Tapping a balance row expands `L-memberDetail` on `L-hub`. `L-memberBuckets` lists that person's expenses as paid-for and owe-for lines that sum to their net. `L-settlementsForMember` keeps only that person's outgoing transfers under **Suggested settlement**. Each row is the transfer as text and a **Settle** button that pushes `L-settlementHref` into `L-expenseNew`; Back abandons.
4. When that member has no outgoing transfer — they are square, or only owed — the settle block is absent. An empty paid-for or owe-for section is omitted.

## F-settle-record — Record a suggested transfer

**Trigger** — On a member screen, the person taps a settle button, checks the form, and taps **Add expense**.  
**Outcome** — That transfer is recorded as an ordinary expense: the debtor paid, only the creditor shares, what-for is Settlement. The tap itself did not move money.

1. `L-member` already has the transfers from `L-settlementsForMember`.
2. The button's `L-settlementHref` opens `L-expenseNew` with payer, amount in cents, the creditor as the only participant, and what-for `Settlement`.
3. `L-expensePrefill` turns that query into the form's starting values; missing or non-money params would have left the You / everyone defaults, which this path does not hit.
4. **Add expense** calls `L-addExpense` with that payer and the one-person share — the same write as any other expense.
5. `L-expenseNew` returns to `L-member`. `L-balances`, `L-memberBuckets` and `L-settle` refold from the new expense, so that transfer is gone or the list shrinks and the Settlement line appears in a bucket. `L-expenses` lists the Settlement row.

## F-bind — Assumed member

**Trigger** — The person creates a group (names themselves) or redeems a join link. There is no This is me to tap.  
**Outcome** — This device is that member. A second pick is refused. Leave unbinds.

1. Create runs `L-createGroupDraft` and writes the bind with the group. Join runs `L-joinGroup`, which inserts the bind on the server for the named member.
2. `L-bindOnce` allows a first live bind, no-ops the same member again, and refuses any other member. A tombstoned bind does not count as live, so leave is what lets this install bind again.
3. `L-bindMe` applies that rule and records `binding_locked` when a live bind already exists. A missing member records `member_missing`. There is no UI that calls it after create or join.
4. `L-assumedMember` resolves this device to that member, which is what puts You on the hub.

## F-invite — Invite a member

**Trigger** — The person opens an unclaimed member.  
**Outcome** — A join link for that member is already on that screen. Copy or share sends it; another device can redeem it once, within seven days.

1. `L-hub` expands `L-memberDetail`. `L-memberClaimed` marks the slot; the invite row is only on Unclaimed. `L-memberDetail` calls `L-mintInvite` with that member when the panel opens.
2. `L-edgeMintInvite` posts to `L-efMintInvite`, which checks this device's access token, refuses a missing or tombstoned member, stores the hash, and returns the plaintext once.
3. That screen shows **invite link** above the `/j/{token}` link (web) or the raw token (native) via `L-inviteShare` in a read-only field, with copy and share. On web the copied URL is the public invite path (`L-parseInviteToken` / `joinPathForToken`), not `/app/j/…`. The secret is not kept on the device after that.

## F-join — Join from an invite

**Trigger** — On another device, the person opens the join link, or expands **Join with link** on the lobby, pastes, and submits.  
**Outcome** — The group is on this device, this device is already that member, and there is no This is me to tap.

1. A public-site `/j/{token}` opens `L-inviteLanding` (`L-invitePath`). Desktop Continue goes to `/app/j/{token}`. Native, lobby paste, and a link that already is `/app/j/…` skip that page.
2. `L-join` (from the URL) or `L-lobby` (from the expanded join field) calls `L-joinGroup`. `L-parseInviteToken` accepts a raw token, a `/j/{token}` URL, or a `/join?token=` URL.
3. `L-edgeJoin` posts the secret and this install's `device_user_id` to `L-efJoin`.
4. `L-efJoin` looks up the hash. `L-inviteIsLive` (the same three checks, on the server) refuses a spent, expired, or tombstoned-member invite. A device that already has a live token for the group is refused without consuming the invite.
5. On success it mints an access token, inserts a v1 bind for the named member, marks the invite redeemed, and `L-efWake` tells the group's other devices.
6. `L-joinGroup` stores the token, adds the group to the lobby, and commits the bind. The hub then `L-openGroup`s — subscribe for wakes, then pull the roster — so the live socket is started on the screen that stays open, not on the join spinner that unmounts.
7. `L-assumedMember` already resolves, so `L-hub` shows You. `L-bindOnce` would refuse a later pick.

## F-bump — Rename group

**Trigger** — On the hub, the person taps the settings icon, changes the group name, and taps **Done**.  
**Outcome** — The new name shows at once here and reaches the other devices without them asking.

1. `L-hub` opens `L-settings`.
2. `L-settings` calls `L-updateGroup` with the typed name (and currency, if that changed too) and `L-settingsDone` lets **Done** through because the group is named and this device is bound.
3. `L-patchGroup` builds the next version; the name changes in the store and is queued, so the UI never waits on the network.
4. `L-flushQueue` pushes it; the server accepts the higher version and `L-efWake` announces the change.
5. On the other device, `L-wakeSub` hears that announcement and `L-applyRemoteFetch` fetches just that group.

## F-leave — Leave group

**Trigger** — On Settings, the person taps **Leave group**, reads the confirm, and taps **Leave group** again.  
**Outcome** — This device is unbound and its access token is revoked. The member slot and expenses stay. The group is gone from this device’s lobby.

1. `L-hub` opens `L-settings`. **Leave group** is at the bottom. Cancel or backdrop closes the confirm drawer and writes nothing.
2. Confirm calls `L-leaveGroup`. `L-tombstoneBind` soft-deletes this device’s live bind at the next version; `L-flushQueue` pushes it while the token still works.
3. `L-edgeLeave` posts to `L-efLeave`, which checks the token belongs to this group and this device, then sets `revoked_at`. A second leave is still success.
4. `L-leaveGroup` drops the token through `L-accessToken` / `L-secureStorage`, takes the group off `L-lobbyIds`, and `L-wakeSub` closes the socket so it does not retry. `L-settings` returns to `L-lobby`.
5. If flush leftover or revoke fails, the lobby is not dropped and `L-settings` shows `leave_failed`. The slot stays; nobody else is bound to it until they redeem a new invite.

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

## F-undo — Undo from Activity

**Trigger** — After adding, deleting, or kicking from this device, the person opens **View all events** and taps **Undo** on that line.
**Outcome** — The add is gone, or the delete/kick is restored. The activity line disappears. Someone else's line has no Undo.

1. `L-addExpense`, `L-deleteExpense`, or `L-deleteMember` stored the pre-job entity on `undo_snapshot` of the activity.
2. The expanded `L-activityFeed` on `L-hub` shows **Undo** on that line when `L-formatActivityLine` says `canUndo` (`L-planUndo` would succeed: this device is the actor, snapshot present, add not edited since).
3. Tap calls `L-undoActivity`, which applies `L-planUndo`: tombstone the added expense, or restore the deleted expense / kicked member at the current version + 1, then tombstone the activity. Entity then activity are queued; `L-flushQueue` sends them.
4. Hub lists and balances refold without waiting for the network. A stale add (edited after) or a foreign line has no control.
