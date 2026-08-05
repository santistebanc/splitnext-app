# Flows

End-to-end paths a human can trigger. Each step cites a logic id from [LOGIC.md](LOGIC.md) and names arguments / payloads when they matter.

Write **Trigger** and **Outcome** as sentences a newcomer can read — what the person did, and what they end up with. Write each step as a sentence too: who acts, on what, and why. The board tags every step with the layer it runs in, so the reader can see the hop from device to server.

## F-create — Create group

**Trigger** — On the lobby screen, the person taps **Create group**.  
**Outcome** — The group exists on the server, this device holds its access token, and the hub opens.

1. `L-lobby` calls `L-createGroup`.
2. `L-deviceUser` reads this install's id from Secure Store, creating it the first time.
3. `L-getGroupStore` opens a fresh store for the new group and `L-initLocalGroup` writes version 1 into it — the group is usable offline from this moment.
4. `L-edgeCreate` posts the new group to `L-efCreate`, which registers it and returns an access token.
   - sends `{ group_id, device_user_id, name, currency_label, updated_at }`
   - returns `{ access_token, group }`
5. `L-accessToken` stores that token in Secure Store and `L-lobbyIds` adds the group to this device's lobby list.
6. `L-wakeSub` subscribes to the group's channel so other devices' changes arrive, asking `L-edgeRtJwt` / `L-efRtJwt` for permission first. If Realtime is unavailable the group still works — only live updates are lost.

## F-open — Open group

**Trigger** — The person taps a group in the lobby, or the hub screen mounts.  
**Outcome** — The screen shows the latest group and roster, anything pending has been pushed, and live updates are running.

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
4. `L-pullRoster` pulls every member and bind in one call through `L-edgeRoster` / `L-efRoster` and commits each one the same way.

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

## F-bind — This is me

**Trigger** — On the hub, the person taps **This is me** on a member row.  
**Outcome** — That member is this device's own person; the hub shows You (Name) and the button disappears.

1. `L-hub` calls `L-bindMe` with the member tapped.
2. `L-deviceHasBind` refuses if this device already claimed someone, recording `already_bound`; a missing member records `member_missing`.
3. A bind linking this device to that member is written locally and queued.
4. `L-flushQueue` pushes it, and the server rejects it unless the member belongs to the same group.
5. `L-assumedMember` now resolves this device to that member, which is what puts You (Name) on the hub.

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
