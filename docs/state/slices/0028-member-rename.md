# Slice 0028 — member rename

**Tier** — core-value · **Closed** — 2026-08-17 · **Tag** — `slice-0028`

## What shipped

Any member’s display name can be changed from their screen. A typo after create or join is a rename, not a rebind. Names-hub rows open that screen; the join link lives only there for unclaimed slots. Share URLs are `/j/{token}` with an 11-char secret.

## Report

### Headline
Rename a slot from its screen; this device stays You, and the invite link is short enough to copy.

### Highlights
- **Rename** — header name + edit; blur or enter writes the next member version (`L-patchMember` / `L-updateMember`). Whitespace or unchanged is a no-op. Bind and expenses stay.
- **Names hub is a list of people** — rows open `L-member`; Invite left the list. Unclaimed detail shows **invite link**.
- **You is just You** — no parenthetical name (D-079). Amounts show a currency symbol; the store stays ISO (D-081).
- **Short join links** — `/j/{token}`, 11-char base64url; `/join?token=` still redeems (D-080).
- **Web chrome** — lobby has no header and centers; hub title lives in the page (home + settings in the header); drawers portal inside the phone frame; the frame scales to fit the viewport.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Names hub | Rows not tappable; Invite on unclaimed | Rows open member detail; no Invite chip |
| Member detail | Invite, buckets, settle | Name + edit in the header; **invite link** if unclaimed; empty buckets omitted |
| Display name | Frozen after add / create / join | Next member version; bind unchanged |
| You | You (Name) in older chrome | You (D-079) |
| Invite URL | `/join?token=` + long secret | `/j/{token}`, 11 chars; legacy query still works |
| Money on screen | ISO code after the amount | Symbol; store still ISO |
| Kick | (none) | Still none |

### Surfaces touched

- **Client** — `L-patchMember` / `L-updateMember`; `L-member` header edit; `L-hub` names rows; `L-lobby` / `L-webFrame`; `L-currency` / `CurrencySelect` / `InFrameOverlay`; `L-inviteShare` / `L-join` `/j/[token]`
- **Server** — `randomInviteToken` (8 bytes) on `L-efMintInvite`; access tokens still 32 bytes
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, this archive, `DECISIONS.md` (D-079–D-081; D-078 restored), `PARKING.md`
- **Capture** — `F-rename`; stills `0028-hub.png` / `0028-member.png`; hub/invite/join clips re-recorded

### Decisions this slice

- D-079 — Assumed member is labelled You, without a parenthetical display name. Narrows D-013’s You (Name) chrome.
- D-080 — Invite share URL is `/j/{token}`; 11-char secret. Narrows D-057.
- D-081 — Display money with the currency’s symbol; store stays ISO.
- D-082 — Display name is editable at the next member version; bind and expenses stay. Unparks D-013’s rename.

### Logic delta

- **Added** — `L-patchMember` · `L-updateMember` · `L-currency`
- **Changed** — `L-member` (header edit; invite link; omit empty buckets) · `L-hub` (names rows open detail; title in page; home) · `L-lobby` (no header; omit empty groups; vertical center) · `L-memberLabel` (You; currency symbol) · `L-inviteShare` / `L-join` / `L-efMintInvite` (`/j/{token}`, 11-char) · `L-webFrame` (scale-to-fit; in-frame overlays) · `L-create` / `L-settings` (currency picker)

### Flow delta

- **Added** — `F-rename`
- **Changed** — `F-invite` (member detail only; invite link) · `F-join` (`/j/{token}`) · `F-create` / `F-open` / `F-add-member` / `F-add-expense` / `F-bump` (chrome)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-patchMember` | whitespace | Returns null. |
| `L-patchMember` | same name after trim | Returns null. |
| `L-member` | whitespace or unchanged | Blur/enter writes nothing; the header title is back. |
| `L-updateMember` | missing or tombstoned member | Does not write. |
| `L-hub` | names, no expenses | Row opens `L-member` (join-link row if unclaimed; no buckets yet). |
| `L-member` | empty paid-for or owe-for | That section is omitted. |
| `L-member` | duplicate of another live name | Allowed. |
| `L-webFrame` | window narrower than 480px | No frame; the app fills the window, including capture's 420×900 viewport. |
| `L-webFrame` | window shorter or larger than 920px outer | Frame scales to fit (shrink or grow); layout stays 420×900. |

### Review

- **Invariants** — No cents / version / soft-delete / Worker-door / D-024 / D-025 breaks. D-013 still parked rename; added D-082 to unpark that clause (D-079 only narrowed You). D-078 restored (had been dropped when D-080 was appended). D-079–D-081 match the code.
- **Spec** — `L-patchMember` tests match the seam table. Accepted: copy/share icon buttons on the join-link row — NEXT’s After already names that row; the parked “sheet” is the prototype’s dedicated post-mint sheet, not these buttons. Extra hub/lobby/currency/frame/invite-URL chrome was user-steered after the core; not on Out of scope.
- **Standards** — Accepted: the tree is wider than a thin rename path because the user steered chrome after the demo. Hub `typeSizeFor` stays in the screen. Phone-scale formula is duplicated in `+html.tsx` and `phoneFrame.web.ts` so first paint cannot wait on the bundle (same shape as 0027). `closeEdit` dry-runs `patchMember` before the job — cheap local no-op.

### Shots

- `0028-hub.png` — names hub after create (You, add member +, home + settings)
- `0028-member.png` — You-detail: header name + edit
- Recorded `flows/F-rename.webm` and re-recorded hub/invite-adjacent clips this slice touched

### Diff pulse

`+1575 / −549 · 50 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **Rename where?** → Member detail, header field, every slot including You.
- **Names-hub rows tappable?** → Yes; Invite leaves the list.
- **Unique names?** → No; duplicates allowed.
- **Kick?** → Parked.
- **Close it?** → Yes.

## What was parked during this slice

- Kick / soft-delete a member
- Expense editor (appetite still next-ish)
- Unique display names
- Invite active / expired / resend
- Invite copy/share sheet
- `splitnext.online` short origin (path shape shipped)

## Notes

D-078 was briefly dropped when D-080 was appended; restored at close. Short invite secrets only apply after this slice’s Worker deploy.
