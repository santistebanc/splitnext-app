# State file templates

All files live in `docs/state/`. Write them exactly in this shape — `docs/slicer.html` is rendered from them, and the renderer expects these headings.

Also maintain **`LOGIC.md`** (catalogue of behaviour pieces with stable `L-` ids) and **`FLOWS.md`** (end-to-end flows citing those ids). The board’s Symbols and Flows pages are rendered from those two files. Update them at every slice close when behaviour is added or changed.

In `LOGIC.md`: the `##` headings are **areas** — where the code runs. Keep them coarse and few (`UI` · `Device` · `Edge` · `Server`); they are the group dividers on Symbols and a band on Flows, not a folder listing. Their order in the file is their order on the board, so write them as a path. **Kind** is one of `Screen` (what the person sees and taps) · `Pure` (input in, answer out — no state, no network) · `State` (owns local data) · `Job` (sequences other pieces into one unit of work) · `Network` (crosses the wire from the device) · `Endpoint` (the server side of that wire). It is the board's browsing axis, so pick exactly one and pick it honestly — a “Pure” that touches the store makes the Pure filter a lie. **Name** is the real code symbol in backticks (the thing you would grep for); **What it is for** is one plain sentence a newcomer can read — what it does and why, not a telegraphic list of the identifiers it touches. “Local v1 group + `create-group` remote + token + lobby id + wake” is a changelog; “Creates a group: writes it locally first, registers it on the server, stores the returned access token, adds it to the lobby, and subscribes for wakes” is a description.

Cite `L-` ids in `NEXT.md` too — in the plan, the Before → After rows and the seams under test. The board matches the symbols in your changed files against those lines to say *what each change is for*; an id matches exactly, prose matches only by luck. A symbol nothing names shows on the board as "Its file changed, but nothing in `NEXT.md` names this piece" — sometimes that is a gap in the plan, sometimes it is just a neighbour in a shared file.

Cite step numbers in a flow delta note (`- **Changed** — `F-sync` (step 4 pull roster)`) — the board highlights exactly those steps, so a vague note costs the reader the highlight.

In a slice archive's `### Logic delta` / `### Flow delta`: keep one bullet per verb (`- **Added** — …`, `- **Changed** — …`, `- **Removed** — …`) with the pieces separated by `·`. Cite the `L-`/`F-` id and put any note in parentheses after it — the board renders each piece as a row and reads the description straight out of `LOGIC.md`, so the delta line never has to repeat it.

**Edge paths live in `NEXT.md` while the slice is being built, and move into the archive's `### Edge paths` at close.** Same three columns in both places, so it is a cut and paste. Keeping it in `NEXT.md` puts the review on the board's *This slice* page while there is still time to act on it — a review that only appears in the archive arrives after the slice shipped.

In an archive's `### Edge paths`: this is Phase 4's self-review, written down, and it is the only place the process records that the non-happy states were considered at all. One row per state you **actually checked** — empty list, offline, permission denied, stale hydration, a second tap while the first is in flight. **Surface** is an `L-` or `F-` id so the board can chip it; **What happens** is the behaviour you observed or built, not the intention (“the queue keeps the item and the hub shows the last sync error” — not “handled gracefully”). A state you did not check does not get a row; an empty block says the review did not happen, which is information.

In an archive's `### Review`: the result of Phase 6's `/code-review`, one bullet per finding — what it was and what you did about it, including the ones you accepted and why. Edge paths and this are not the same review: edge paths are the states the builder walked before the demo, this is what a reader of the finished diff found. A slice where the review turned up nothing writes one bullet saying so; a missing block means the review left no trace, which is the same as not having run it.

In an archive's `### Shots`: one bullet per file in `docs/state/shots/`, `` `NNNN-slug.png` `` then what it shows, plus a line naming the flow clips this slice recorded or re-recorded (`` `flows/F-add-expense.webm` ``). Flow clips are keyed by flow id and live on past the slice — the archive records that they were refreshed, not that they belong to it. If nothing could be captured, write the single line why instead — the block is never silently empty.

In `FLOWS.md`: **Trigger** and **Outcome** are sentences about the person — “On the lobby screen, the person taps **Create group**”, not “Lobby → Create group”. Each step is a sentence too: who acts, on what, and why, with the `L-` ids cited inline so they render as symbol chips. An arrow between two ids is not a description of anything.

---

## `OVERVIEW.md` — where we stand

Rewritten at every slice close. Describes the app **as it is now**, not how it got here. Keep each section to roughly a page; if a section outgrows that, it is hiding a `docs/adr/` entry or a slice archive.

```markdown
# Overview

Last updated: slice 0007

## Direction

<!-- written once in the bootstrap pass, edited only when the user changes course -->

**Destination** — <what the finished thing is, one or two lines>

**Users** — <who uses it, and for what>

**Constraints** — <platform, stack, deployment, budget, deadlines, anything hard>

**Non-goals** — <ruled out; each one is a question nobody has to ask again>

## Capabilities

<!-- what a user can actually do today, one line each -->

- <capability> — shipped in [slice 0003](slices/0003-name.md)

## Stack

- <layer> — <choice> — <one-line why, or a D-NNN reference>

## Data model

<!-- entities as they exist in code right now; types/schema shapes where they encode a decision -->

**<Entity>** — <fields, relationships, invariants>

## Routes / surfaces

| Route | What it does | Shipped in |
| --- | --- | --- |
| `/things/:id` | <one line> | slice 0004 |

## Seams

<!-- the agreed test seams; new slices prefer these over cutting new ones -->

- <seam> — <what it lets you test, at what level>
```

---

## `NEXT.md` — the next slice

Overwritten each time a slice is picked. This is the pre-build gate's script — the user reads it and says build it or not.

```markdown
# Slice 0008 — <short name>

**Tier** — foundation-risk | core-value | breadth | polish

## Goal

<one or two lines: what a user can do after this slice that they cannot do now>

## Before → After

| | Now | After |
| --- | --- | --- |
| <aspect> | <current state> | <state after this slice> |

## Plan

1. <step — narrow, concrete, ordered>

## Seams under test

<!-- the public interfaces this slice puts under test, agreed at the pre-build
     gate. Prefer seams OVERVIEW.md already lists; cite `L-` ids. -->

| Seam | Behavior |
| --- | --- |
| `L-splitEvenly` | <what the tests pin down at that seam> |

## Acceptance

<!-- how the demo gate gets passed: the exact thing the user will run and see -->

- Run `<command>`, open `<url>`, and <observable outcome>.
- Tests at <seam> cover <behaviour>.

## Edge paths

<!-- filled in during the build, not at pick time: one row per non-happy state
     you actually walked. Moves into the archive's Report at close. -->

| Surface | State | What happens |
| --- | --- | --- |
| `L-hub` | <state> | <what the person sees> |

## Out of scope

<!-- explicitly not in this slice, however tempting; each links to its PARKING entry -->

- <thing> — parked

## Parked this session

<!-- what the interview surfaced and deferred; the user's chance to promote one -->

- <verbatim-ish phrasing> — <tier guess>
```

---

## `PARKING.md` — deferred, unresolved, unquestioned

Everything the user said that was not this slice. Entries are **not** cleaned up into agent prose — keep the user's own phrasing, because that is what makes the item recognizable to them months later.

Groomed at every slice close: prune delivered or obsolete items, re-score tiers against what the last slice revealed.

```markdown
# Parking

## Foundation-risk

- **<short label>** — "<verbatim user phrasing>" — area: <auth|data|deploy|…> — raised: slice 0003

## Core value

- ...

## Breadth

- ...

## Polish

- ...

## Delivered

<!-- kept briefly so the user can see their input landed, then pruned -->

- **<label>** — delivered in [slice 0006](slices/0006-name.md)
```

---

## `DECISIONS.md` — append-only

Ids are stable and never renumbered. Slices, ADRs, and code comments cite them by id.

```markdown
# Decisions

| Id | Decision | Made in | Why |
| --- | --- | --- | --- |
| D-001 | <one line — the decision itself, not the discussion> | slice 0001 | <one line> |
```

---

## `slices/NNNN-<name>.md` — archive

Written once at close, then never read unless someone asks about that slice. It carries the detail `OVERVIEW.md` deliberately drops. The **`## Report`** block is what the per-PR slice page renders when the slice is closed — keep it scannable and concrete.

```markdown
# Slice 0007 — <short name>

**Tier** — <tier> · **Closed** — <date> · **Tag** — `<sha or subject>`

## What shipped

<what a user can do now that they could not before>

## Report

### Headline
<one sentence: the delta a human should remember>

### Highlights
- <user-visible or architectural bullet>
- <…3–6 total>

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| <aspect> | <before> | <after> |

### Surfaces touched

- **Client** — <routes/modules, short>
- **Server** — <migrations/functions, short>
- **State** — <overview/parking/decisions, short>

### Decisions this slice

- D-004 — <one line>

### Logic delta

- **Added** — `L-…` (new catalogue entries)
- **Changed** — `L-…` (behaviour or location changed)

### Flow delta

- **Added** — `F-…`
- **Changed** — `F-…`

### Edge paths

<!-- the self-review, written down: one row per non-happy state you actually checked -->

| Surface | State | What happens |
| --- | --- | --- |
| `L-hub` | roster empty | <what the person sees> |
| `F-sync` | offline mid-push | <what happens to the queue and the error> |

### Review

<!-- what /code-review found, one bullet each: the finding and what you did
     about it. "Clean" is a legitimate result and gets one line saying so. -->

- <finding> — fixed in `<symbol>` / accepted because <reason>

### Shots

- `0007-hub.webm` — <the flow it walks, end to end>
- `0007-hub.png` — <what the still shows>

### Diff pulse

`+A / −D · N files` — from `git show --stat` at close

## Questions asked and answered

- **<question>** → <answer> (D-004)

## What was parked during this slice

- <label> → PARKING

## Notes

<anything a future slice needs to know: gotchas, deferred cleanups, surprises from the build>
```
