# Slice 0009 — symbol tree

**Tier** — breadth · **Closed** — 2026-08-07 · **Tag** — `slice-0009`

## What shipped

The Symbols page has a second view. **Flat** is unchanged and still the default; **Tree** re-nests the same rows under the symbols that call them, from a call graph read out of the source at generation time. Every row in both views now carries how many symbols call it, beside how many flows name it. No app behaviour changed.

## Report

### Headline
The map could say what each piece is and how much of the product leans on it. It can now say what leans on *what* — and its roots turn out to be the app's entry points, which nobody had to write down.

### Highlights
- **Two views, one set of rows.** 49 symbols in Flat, 49 expanded in Tree. The count is the invariant: a view of the map whose row count does not match the map is not a view of the map (D-036).
- **Measured, not authored.** A `uses` column in `LOGIC.md` would be stale within a slice, so the graph is derived from the source every time the board is generated (D-034) — the same rule that already made flow weight a count rather than a ranking.
- **The trap was real, and measuring first is what caught it.** `LOGIC.md` lists deep modules and omits private helpers, so a mapped symbol's own declaration often holds none of its real calls: `flushQueue` (`src/sync/outbound.ts:52`) only delegates to `flushQueueInner`, which holds all nine. Extent-scoped detection reported it as calling nothing and promoted it to an entry point beside the screens. Following unmapped local helpers — and stopping at any name the map claims — fixed it and dropped the bogus roots from 13 to 10 (D-035).
- **It is a DAG, so nesting had to be decided rather than assumed.** 14 symbols have more than one caller and `getGroupStore` has 12; unfolding every occurrence is 217 nodes for 49 symbols. Each expands once at its shallowest position and stubs elsewhere, naming its home: 49 rows and 42 stubs.
- **The entry points fell out for free.** Nothing calls the 3 screens, the 5 Edge Functions, `persistPlugin` or `publishWake` — that list is the graph's answer, not an assertion anyone maintains.
- **It rests closed, and a shut row is two things.** Ten rows, not ninety-one; each is a name and the area it runs in (D-038, D-039). The path, both counts and the sentence are what opening it is for, the whole row is the target, and a chevron on the right says whether opening it reveals children or just that row's own detail — solid or hollow.
- **The derived part is gated.** `npm run test:board` runs 21 Python tests over the resolver in CI (D-037). A graph that silently under-reports still looks authoritative, which is worse than no graph.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Symbols page | One view, grouped by area, ordered by flow weight | Flat (default, unchanged) and Tree, switched in the topbar |
| Reading the tree | — | Rests closed at 10 entry points, a shut row being name + area; the row is the toggle, a solid/hollow chevron marks it, and search opens the path to its hits |
| "What calls this?" | Unanswerable without grepping | `N callers` on every row; Tree nests callees under callers |
| Entry points | Inferred from area order | The tree's roots, derived |
| Call graph | Nowhere | `docs/scripts/callgraph.py`, read from source at generation time |
| Board gates | `npm test` + `npm run typecheck` | Plus `npm run test:board` |

### Logic delta

- Unchanged. This slice ships no app behaviour: `LOGIC.md` and `FLOWS.md` describe the same app after it as before.

### Flow delta

- Unchanged.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `resolve` | mapped symbol whose real calls sit under a private helper | The case the slice turns on. Extent-scoped detection reports `flushQueue` as calling nothing; the walk follows unmapped local declarations and finds all nine. Bogus roots went from 13 to 10. |
| `resolve` | a mapped name reached through another mapped name | Not traversed. A mapped symbol is an edge, not a corridor — without this every root inherits every leaf and a deep module stops being a boundary. |
| `resolve` | a name mentioned but never called (`import { target }`) | No edge. The call pattern needs the paren, and a negative lookbehind drops `function target(` / `const target = (` so a file's own declarations cannot read as calls to themselves. |
| `resolve` | entry whose `where` no longer exists | Empty edge list, not a crash. The map can name a piece the tree has already moved. |
| `resolve` | read/write pair calling its other half (`saveAccessToken` → `getAccessToken`) | No self-edge. Two names under one id are one idea; an internal call is not a relationship between two pieces. |
| `plan_tree` | a cycle no root can reach | Seeded as its own root into a **Not reached from any entry point** group. Zero cycles today, but a dropped symbol would be invisible and the count would silently disagree with Flat. |
| Tree row | shut | Its name and its area, nothing else — 45px, one line. The path, both counts and the sentence are what opening it is for (D-039). |
| Tree row | click anywhere on it | Toggles. Clicks landing on the row's permalink or its path chip still navigate, and a text selection inside the row does not shut it underneath. |
| Chevron | row has children vs is a leaf | Solid vs hollow. Without the difference the two look identical until you click, which is the question the tree exists to answer. 26 solid, 23 hollow today. |
| Chevron | keyboard | A real `<button>`: focusable, answers Enter, and `aria-expanded` plus its label track the state (`Collapse — 3 calls`). The row-wide handler catches its click by bubbling, so it toggles once, not twice. |
| Tree view | at rest | Closed to its 10 entry points, not 91 rows. An always-open tree is a longer flat list with indentation — it shows structure without letting anyone use it. |
| Tree view | opening a node | Reveals its path, both counts and its sentence, then its children, each shut in turn. |
| Tree fold | counted fold (`11 calls`) at the end of the row, then at the front | Both tried and both replaced. At the end it wrapped at 900px, so every shut child took two lines; at the front it read as a column but still put four things on a shut row. The chevron on the right, with the row as the target, is what stuck (D-039). |
| Tree row | narrow screens | Holds one line down to 420px. Dropping the path and the counts from the shut row removed the wrap entirely — before D-039 rows took two lines below 1200px. The board stills stay at 1200 so an open row is shown unwrapped too. |
| Expand all | reader opens every foldable row by hand | Button flips to Collapse all. Stubs are excluded from the check — they have nothing behind them, and counting them meant the toggle could never read as finished. |
| Deep link | `#tree-L-edgeRoster`, four levels down and behind shut parents | Router opens every ancestor before scrolling. Verified: the target is visible on arrival. |
| Tree view | a symbol with 12 callers | Expands once under `Group hub`, stubs elsewhere naming their home. 49 expanded + 42 stubs, against 217 if every occurrence expanded. |
| Search in Tree | a match four levels down | Ancestors kept and dimmed as context; hiding them would orphan the hit. Counts stay measured on the flat rows so the rail cannot double-count a symbol. |
| Deep link | `#L-syncGroup` arriving while Tree is the remembered view | Router reads the target's own view and switches to it. Without this the link scrolls to a row the current view has hidden and the page looks broken. |
| View toggle | reload, or a link from Flows | View persists in `localStorage`, so returning to Symbols lands where you left it. |
| `capture-board.mjs` | second still in the same browser context | Caught in the build: the remembered view leaked between shots and the third still waited on a hidden row. Each still now gets its own context — a capture whose result depends on the order it ran in is not evidence. |
| Board, 900px | both counts on one row | The pair is one block (`.weights`) and wraps as a unit. Left to wrap freely it split into a lone em dash above a lone caller count. |
| Board, local server | browser's own `/favicon.ico` probe | 404s — the dev server serves the board and nothing else. Pre-existing, not the page's error; the capture script filters it rather than pretending the console is clean. |

### Shots

- `0009-symbols-tree.png` — Tree at rest: ten entry points, each a name and an area, with a solid or hollow chevron on the right.
- `0009-symbols-tree-open.png` — `Group hub` opened one level: its path, counts and sentence appear, then its eleven children, each shut, with indentation rails and their own chevrons.
- `0009-symbols-tree-search.png` — searching `roster` in Tree: `syncGroup → pullRoster → listRoster` as hits, with `Group hub` and `openGroup` dimmed as the ancestors holding them up.
- `0009-symbols-flat.png` — Flat view, unchanged apart from the new caller count.

Captured with `node docs/scripts/capture-board.mjs --slice 0009`, written this slice: the board is a surface now, and re-shooting it next slice should not be an ad-hoc run somebody has to reconstruct.

### Surfaces touched

- **Board tooling** — `docs/scripts/callgraph.py` (new), `docs/scripts/callgraph_test.py` (new), `docs/scripts/generate-slicer-board.py`, `docs/scripts/capture-board.mjs` (new)
- **CI** — `.github/workflows/ci.yml` (board tooling tests)
- **Scripts** — `package.json` (`test:board`)
- **Process** — `.claude/skills/slicer/references/board.md` (rule 20)
- **State** — `OVERVIEW.md`, `DECISIONS.md`, `PARKING.md`, `NEXT.md`, `shots/0009-*.png`

### Decisions this slice

- D-034 — the Symbols call graph is derived from source, never authored in `LOGIC.md`
- D-035 — resolution follows unmapped local helpers, and stops at any name the map claims
- D-036 — Tree expands each symbol once at its shallowest position, stubs elsewhere
- D-037 — board tooling is tested by `npm run test:board`, gated in CI
- D-038 — Tree rests closed at its entry points; opening a symbol reveals its sentence and its children
- D-039 — a shut row is name + area, the whole row toggles, and a solid/hollow chevron marks it (narrows D-038)

### Diff pulse

`+831 / −23 · 13 files` — excluding the generated `docs/slicer.html`

## Questions asked and answered

- **Flat/tree toggle, or just a "calls / called by" line on the existing rows?** → The toggle. The cheaper option gives most of the same facts, but not the one thing the tree is for: reading the app downward from its entry points.
- **Author the relationship in `LOGIC.md`, or derive it?** → Derive. An authored column is stale by the next slice, and the board already refuses to let anyone hand-rank weight.
- **Sibling order inside a parent — source order or caller count?** → Source order, confirmed at the pre-build gate. It is the only ordering the caller itself asserts; flow weight says nothing about a parent's children.
- **How do Python seams get gated when the suite is Vitest?** → A third CI step. Porting one function to TypeScript to reach the runner would split the tool across two languages for nothing.

## Deviations from the plan

- Fixtures live in the test file as dicts rather than in `docs/scripts/fixtures/`. `resolve` takes a reader, so a dict *is* the seam, and on-disk fixture files would have been a directory to keep in sync for no extra isolation.
- `docs/scripts/capture-board.mjs` was not in the plan. The board became a surface this slice, and the process asks for a capture that can be repeated rather than reconstructed.
