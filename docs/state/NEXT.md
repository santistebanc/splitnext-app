# Slice 0009 — symbol tree

**Tier** — breadth (the board gains a question it cannot answer today; no app behaviour moves)

## Goal

Symbols lists 49 pieces of behaviour and says how many flows lean on each. It cannot say what leans on *what*. Add a second view of the same page — **Tree** beside the current **Flat** — that nests each symbol under the symbols that call it, derived from the source rather than authored, so the map can be read downward from the app's entry points.

## Before → After

| | Now | After |
| --- | --- | --- |
| Symbols page | One view: 49 rows, grouped by area, sorted by flow weight | Two views on one page — **Flat** (unchanged, the default) and **Tree**, toggled in the topbar |
| "What calls this?" | Unanswerable without grepping the tree | Every row carries `N callers`; Tree nests callees under their callers |
| Entry points | Implicit — a reader infers them from the area order | Explicit — Tree's roots are the 3 screens, the 5 Edge Functions, `persistPlugin` and `publishWake`, and they fall out of the graph rather than being listed |
| Call graph | Nowhere | Derived at generation time from the source, in `docs/scripts/callgraph.py` |
| Board gates | `npm test` (Vitest) + `npm run typecheck` | Plus `npm run test:board` — Python unit tests over the resolver, run in CI |

## What the data actually looks like

Measured before writing this, over today's 49 `LOGIC.md` entries — the numbers are why the plan is shaped the way it is:

- **81 call edges, 0 cycles, max depth 8.**
- **It is a DAG, not a tree.** 14 symbols have more than one caller; `getGroupStore` has 12, `syncError` and `getOrCreateDeviceUserId` have 7 each. Unfolding every root yields **217 nodes for 49 symbols** — 4.4× duplication if the view expands every occurrence.
- **Extent-scoped detection under-reports, badly.** `L-flushQueue` maps to `flushQueue` at `src/sync/outbound.ts:52`, which only delegates to `flushQueueInner` — an unmapped private helper holding all nine real calls. Scanning a symbol's own declaration extent reports `flushQueue` as calling nothing and promotes it to a root beside the screens. `LOGIC.md` deliberately omits private helpers ("prefer deep modules; do not list every private helper"), so this is the normal case, not an outlier. Following calls through unmapped local declarations in the same file fixes it and drops the bogus roots from 13 to 10.

## Plan

1. **`docs/scripts/callgraph.py`** — a module, not a lump in the generator. `resolve(entries, read_source) -> {id: set(callee_id)}`. For each entry: take its own top-level declarations, then walk the declarations it calls that **no** `LOGIC.md` entry claims, transitively within the same file, and treat every mapped name called anywhere in that closure as an edge. Entries whose name is not a code symbol (a route file, a function directory) stand for the whole file, as they already do for change attribution.
2. **Callers count on every row, in both views** — `12 callers`, `—` for none, in the shape `used_badge` already uses for flow weight. This is the part that pays off even if Tree is never opened.
3. **Tree view.** Roots are symbols nobody calls. **Each symbol expands exactly once, at its shallowest position; every other occurrence renders as a stub chip** — `→ also under syncGroup` — that links to the expanded copy. So Tree shows 49 real rows, the same invariant Flat has: the sidebar count stays honest and no symbol can go missing behind a fold. Anything unreachable from a root (a cycle, if one ever appears) gets a final **Not reached from any entry point** group rather than being dropped.
4. **Area becomes a row tag in Tree, not a divider.** A tree crosses areas by nature — Screen → Job → Pure → Network — so the `logic-area` sections only render in Flat. Kind glyphs are unchanged and carry across both.
5. **Search and kind filter keep working in Tree** with keep-ancestors semantics: a match reveals its ancestor chain so the row stays reachable, with ancestors marked as context rather than counted as hits. Sibling order inside a parent is source order — the order the calls appear in the caller — since flow weight says nothing about a parent's children.
6. **Cycle-safe rendering** — expand-once already bounds it, but the walk carries its own visited set so a future cycle degrades to a stub instead of hanging the generator.
7. **`npm run test:board` + a CI step**, since Vitest cannot reach a Python module and an untested resolver is the whole risk here (see the `flushQueue` finding).
8. Update `references/board.md` with the rules this adds, regenerate `docs/slicer.html`, open it.

## Seams under test

Fixture-based — small synthetic source files under `docs/scripts/fixtures/`, never the live tree, or every slice that edits `src/sync/` flaps the board's tests.

| Seam | Behaviour |
| --- | --- |
| `resolve` — `docs/scripts/callgraph.py` | A mapped symbol calling another mapped symbol directly produces one edge |
| `resolve` | A call reached only through an **unmapped private helper** in the same file still produces the edge — the `flushQueue` → `mergeEntities` case, which the naive version misses |
| `resolve` | An unmapped helper that is *also* a mapped entry is not traversed through: the edge stops at it, so a deep module stays the boundary |
| `resolve` | A whole-file entry (route file, function directory) claims every call in its file |
| `resolve` | A cycle terminates and yields each edge once |
| `roots` / `layout` — `docs/scripts/callgraph.py` | Every entry appears exactly once as an expanded node; unreachable entries land in the leftover group; total nodes == total entries |

## Acceptance

- `python3 docs/scripts/generate-slicer-board.py`, open `http://127.0.0.1:8777/slicer.html#symbols`: the topbar offers **Flat / Tree**, Flat renders exactly as it does today, and Tree opens with 10 roots and 49 expanded rows.
- `getGroupStore` shows `12 callers` in both views, is expanded once in Tree, and its other 11 positions are stubs that link to it.
- `flushQueue` sits under its callers in Tree with its nine callees beneath it — the case the naive resolver got wrong.
- Typing `roster` in Tree leaves matching rows visible with their ancestor chains intact; the kind filter behaves the same way.
- `npm run test:board` green, `npm test` and `npm run typecheck` still green, and CI runs all three.

## Decisions this would add

- **D-034** — The call graph is derived from source at generation time, never authored in `LOGIC.md`. An authored `uses` column goes stale within a slice, and the board's own rule is that weight is measured, not asserted.
- **D-035** — Call resolution follows unmapped local helpers transitively within a file, and stops at any name `LOGIC.md` maps. The map lists deep modules, so the calls that matter usually sit one private hop below the mapped name.
- **D-036** — Tree expands each symbol once at its shallowest position and stubs every other occurrence. Full unfolding is 4.4× the rows for the same 49 symbols, and a view of the map whose row count does not match the map is not a view of the map.
- **D-037** — Board tooling is tested by `npm run test:board` (Python), gated in CI alongside `npm test`. The generator is Python and the suite is Vitest; porting one function to TS to reach the runner would split the tool across two languages for no gain.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `resolve` | mapped symbol whose real calls sit under a private helper | The case the whole slice turns on. Extent-scoped detection reports `flushQueue` as calling nothing; the walk follows unmapped local declarations and finds all nine. Bogus roots went from 13 to 10. |
| `resolve` | a mapped name reached through another mapped name | Not traversed. `middle` is an edge, not a corridor — without this every root inherits every leaf and a deep module stops being a boundary. |
| `resolve` | a name mentioned but never called (`import { target }`) | No edge. The call regex needs the paren, and a negative lookbehind drops `function target(` / `const target = (` so a file's own declarations cannot read as calls to themselves. |
| `resolve` | entry whose `where` no longer exists | Empty edge list, not a crash. The map can name a piece the tree has already moved. |
| `resolve` | read/write pair calling its other half (`saveAccessToken` → `getAccessToken`) | No self-edge. Two names under one id are one idea; an internal call is not a relationship between two pieces. |
| `plan_tree` | a cycle no root can reach | Seeded as its own root into a **Not reached from any entry point** group. Zero cycles today, but a dropped symbol would be invisible and the count would silently disagree with Flat. |
| Tree view | a symbol with 12 callers | Expands once under `Group hub`, stubs elsewhere naming their home. 49 expanded + 42 stubs, against 217 nodes if every occurrence expanded. |
| Search in Tree | a match four levels down | Ancestors are kept and dimmed as context; hiding them would orphan the hit. Counts stay measured on the flat rows so the rail cannot double-count the same symbol. |
| Deep link | `#L-syncGroup` arriving while Tree is the remembered view | Router reads the target's own view and switches to it. Without this the link scrolls to a row the current view has hidden and the page looks broken. |
| View toggle | reload, or a link from Flows | View persists in `localStorage`, so returning to Symbols lands where you left it. |
| `capture-board.mjs` | second still in the same browser context | Caught in the build: the remembered view leaked between shots and the third still waited on a hidden row. Each still now gets its own context — a capture whose result depends on the order it ran in is not evidence. |
| Board, 900px | both counts on one row | The pair is one block (`.weights`), so it wraps as a unit. Left to wrap freely it split into a lone em dash above a lone caller count. |
| Board, local server | browser's own `/favicon.ico` probe | 404s — the dev server serves the board and nothing else. Pre-existing, not the page's error, and the capture script filters it rather than pretending the console is clean. |

## Out of scope

- Any change to app behaviour: this slice adds no `L-` entry and touches nothing under `src/`, `app/` or `supabase/`.
- **Import-level edges** (module A imports module B). The graph is call sites only; an import that is never called is not a relationship worth drawing.
- **Cross-boundary edges** — `mergeEntities` (client) to `merge` (Edge Function) is a wire hop, not a call. Flows already draws that crossing, and inventing an edge for it would make the tree claim a call the code does not make.
- Tree view on the Flows page or on the newest-slice delta rows.
- Replacing flow weight with caller count as the Flat sort order. Two sort keys, one page, silently swapped is worse than either.

## Parked this session

- **Import-level dependency view** — a second graph, module to module rather than symbol to symbol — area: board — raised: slice 0009
- **Wire-hop edges in the symbol graph** — draw `mergeEntities` → `merge` as a distinct kind of edge so the tree can cross the device/server boundary the way Flows does — area: board — raised: slice 0009
