# The board — `docs/slicer.html`

One self-contained HTML file, rendered from `docs/state/` by `docs/scripts/generate-slicer-board.py`. It answers two questions fast: **how the app works now**, and **what the slice in flight is changing**.

The generator is four files: `generate-slicer-board.py` renders, `state_files.py` parses the state files, `sourcemap.py` locates symbols and attributes diff hunks, `callgraph.py` derives what calls what. The three beside the renderer are the parts with a right answer, and they are tested — `board_test.py`, `callgraph_test.py`, both under `npm run test:board`.

The generator already implements the design. **The reasoning behind it lives in [`docs/board-design.md`](../../../../docs/board-design.md)** — read that only when changing how the board looks, not to use it. What follows is the part an agent can violate.

## Contract

- **Generated, never edited.** `npm run board` regenerates; `npm run board:serve` regenerates and serves. `docs/slicer.html` is **gitignored** — there is no committed copy to conflict, go stale, or hand-merge. CI regenerates it for the published site.
- **Regenerate and open** after behaviour lands, at the demo gate, and at close. Skipping the open is a process bug.
- **Serve it, never `file://`** — `npm run board:serve` → `http://127.0.0.1:8777/slicer.html`. The helper is what makes a path chip open the file in the *running* editor (`cursor -r -g`), including inside the IDE's own browser.
- **Nothing leaves the machine.** Inline CSS and one inline script for search/filter. No CDN, no external fonts, no fetches. Captures are the one exception and ride as **relative sibling paths** (`state/shots/…`), never data URIs — inlining them would add hundreds of KB per slice to a file that is regenerated constantly.
- **Ids are plumbing.** `L-` / `F-` / `D-` ids live in the state files, in anchors, tooltips and `data-search`. A reader never sees one; every reference renders as its human label.
- **The Symbols call graph is derived from source at generation time, never authored in `LOGIC.md`.** A `uses` column is stale within a slice. It lives in `callgraph.py` and is tested (D-037).
- **Changes are attributed by hunk, not by file** — a file-level delta reports every symbol that merely shares a file with the edit. It lives in `sourcemap.py` and is tested; keep it that way.
- **Light and dark**, square edges, full-width rows, one spacing scale. Same structure in every project so the board stays recognizable.

## Pages

| # | Page | Source | Question it answers |
| --- | --- | --- | --- |
| 01 | Overview | `OVERVIEW.md` | What the product is |
| 02 | Symbols | `LOGIC.md` | What exists — **Flat** (by area, by weight) and **Tree** (what leans on what) |
| 03 | Flows | `FLOWS.md` | How it runs end to end, with each flow's clip |
| 04 | This slice | `NEXT.md` + working tree, or the newest archive | What is changing right now |
| 05 | Steering | `NEXT.md`, `PARKING.md`, `slices/` | What is next and what is parked |

**One question per page** — never stack them. *This slice* is the slice in flight (delta derived from the working tree at render time, so regenerate to refresh); the last closed report sits at the bottom behind a collapsed disclosure. Once the slice closes, the page falls back to that report.
