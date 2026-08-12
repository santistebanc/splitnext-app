#!/usr/bin/env python3
"""Tests for `state_files.py` (the parsers) and `sourcemap.py` (hunk attribution).

Together they are the path that reads `docs/state/*.md` and says what a slice
changed. When it is wrong it is silently wrong — the board still renders, it
just reports the wrong symbol. These cover the seams: the parsers that turn
the state files into rows, and the diff-to-symbol attribution that decides
which piece a hunk belongs to.

    npm run test:board
"""
from __future__ import annotations

import importlib.util
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "docs/scripts"))

import sourcemap  # noqa: E402
import state_files as g  # noqa: E402

spec = importlib.util.spec_from_file_location(
    "board", ROOT / "docs/scripts/generate-slicer-board.py"
)
board = importlib.util.module_from_spec(spec)
spec.loader.exec_module(board)


class ParseLogic(unittest.TestCase):
    def test_areas_keep_file_order_and_rows_parse(self):
        areas = g.parse_logic(
            """# Logic

## UI

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| `L-hub` | `HubScreen` | Screen | app/hub.tsx | Shows the group. |

## Device

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| `L-queue` | `flushQueue` | Job | src/sync/queue.ts | Drains the outbox. |
"""
        )
        self.assertEqual([a for a, _ in areas], ["UI", "Device"])
        row = areas[0][1][0]
        self.assertEqual(row["id"], "L-hub")
        self.assertEqual(row["name"], "HubScreen")
        self.assertEqual(row["kind"], "Screen")
        self.assertEqual(row["where"], "app/hub.tsx")
        self.assertEqual(row["what"], "Shows the group.")

    def test_column_order_is_read_from_the_header(self):
        areas = g.parse_logic(
            """## UI

| Id | Kind | Name | Where | What it is for |
| --- | --- | --- | --- | --- |
| `L-hub` | Screen | `HubScreen` | app/hub.tsx | Shows the group. |
"""
        )
        row = areas[0][1][0]
        self.assertEqual(row["kind"], "Screen")
        self.assertEqual(row["name"], "HubScreen")

    def test_rows_that_are_not_symbols_are_skipped(self):
        areas = g.parse_logic(
            """## UI

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| not-an-id | `X` | Pure | a.ts | no |
| `L-ok` | `X` | Pure | a.ts | yes |
"""
        )
        self.assertEqual([r["id"] for r in areas[0][1]], ["L-ok"])


class ParseFlows(unittest.TestCase):
    SRC = """# Flows

## F-open — Open a group

**Trigger** — On the lobby, the person taps a group.
**Outcome** — The hub shows the roster.

1. The lobby calls `L-openGroup`.
2. The hub hydrates from `L-store`.
   - and subscribes for wakes

## F-bump — Bump the version

**Trigger** — A write lands.
**Outcome** — The version goes up.

1. `L-bump` increments it.
"""

    def test_ids_titles_meta_and_steps(self):
        flows = g.parse_flows(self.SRC)
        self.assertEqual([f["id"] for f in flows], ["F-open", "F-bump"])
        self.assertEqual(flows[0]["title"], "Open a group")
        self.assertTrue(flows[0]["trigger"].startswith("On the lobby"))
        self.assertEqual(flows[0]["outcome"], "The hub shows the roster.")
        self.assertEqual(len(flows[0]["steps"]), 2)

    def test_continuation_folds_into_the_step_above(self):
        flows = g.parse_flows(self.SRC)
        self.assertIn("subscribes for wakes", flows[0]["steps"][1])


class ParseNext(unittest.TestCase):
    SRC = """# Slice 0009 — invites

**Tier** — foundation-risk

## Goal

Someone can join
a group from a link.

## Before → After

| | Now | After |
| --- | --- | --- |
| Joining | Impossible | One link |

## Plan

1. Mint the link in `L-invite`.

## Out of scope

- Expiry — parked
"""

    def test_header_goal_and_table(self):
        nxt = g.parse_next(self.SRC)
        self.assertEqual(nxt["number"], "0009")
        self.assertEqual(nxt["tier"], "foundation-risk")
        self.assertEqual(nxt["goal"], "Someone can join a group from a link.")
        self.assertEqual(
            nxt["now_after"],
            [{"aspect": "Joining", "before": "Impossible", "after": "One link"}],
        )

    def test_plan_and_scope_bullets(self):
        nxt = g.parse_next(self.SRC)
        self.assertEqual(nxt["plan"], ["Mint the link in `L-invite`."])
        self.assertEqual(nxt["out_of_scope"], ["Expiry — parked"])


class ParseNextBetweenSlices(unittest.TestCase):
    def test_a_next_naming_no_slice_parses_as_empty(self):
        nxt = g.parse_next("# No slice picked\n\nThe last slice closed.\n")
        self.assertEqual(nxt["number"], "")
        self.assertEqual(nxt["plan"], [])
        self.assertEqual(nxt["seams"], [])


class ParseDelta(unittest.TestCase):
    def test_status_pieces_and_notes(self):
        out = g.parse_delta(
            ["**Added** — `L-hub` (the group screen) · `L-addMember`"]
        )
        self.assertEqual(out[0][0], "Added")
        self.assertEqual(
            [(p["ref"], p["note"]) for p in out[0][1]],
            [("L-hub", "the group screen"), ("L-addMember", "")],
        )

    def test_a_bullet_with_no_status_reads_as_changed(self):
        out = g.parse_delta(["`L-hub`"])
        self.assertEqual(out[0][0], "Changed")
        self.assertEqual(out[0][1][0]["ref"], "L-hub")


class ParseReport(unittest.TestCase):
    SRC = """# Slice 0007 — balances

## Report

### Headline
Balances land.

### Highlights
- Two of them

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-hub` | roster empty | The hub says so |

### Shots

- `0007-balances.png` — the balances panel
- `flows/F-balances.webm` — the flow end to end

### Diff pulse

`+120 / −8 · 6 files`
"""

    def test_edge_paths_shots_and_pulse(self):
        rep = g.parse_report(self.SRC)
        self.assertEqual(rep["headline"], "Balances land.")
        self.assertEqual(
            rep["edge_paths"],
            [{"surface": "`L-hub`", "state": "roster empty", "what": "The hub says so"}],
        )
        self.assertEqual(
            [s["file"] for s in rep["shots"]],
            ["0007-balances.png", "flows/F-balances.webm"],
        )
        self.assertEqual(rep["pulse"], "+120 / −8 · 6 files")


class ReviewBlock(unittest.TestCase):
    def test_the_review_bullets_are_read_out_of_the_report(self):
        rep = g.parse_report(
            "# Slice 0010 — x\n\n## Report\n\n### Review\n\n"
            "- `L-hub` re-read the roster on every render — fixed\n"
            "- Duplicated cents rounding — accepted, one call site\n"
        )
        self.assertEqual(len(rep["review"]), 2)
        self.assertTrue(rep["review"][0].startswith("`L-hub`"))

    def test_an_archive_with_no_review_block_reads_as_empty(self):
        rep = g.parse_report("# Slice 0009 — x\n\n## Report\n\n### Headline\nA thing.\n")
        self.assertEqual(rep["review"], [])


class RenderedBoard(unittest.TestCase):
    """The renderer, against a fixture repo, compared to a committed golden file.

    Everything else here tests a function with a right answer. This one tests
    the 2000-line pass that turns those answers into a page: that every section
    still renders, that ids stay out of the copy, that a slice in flight and a
    closed archive both come out. The golden holds the markup only — the inline
    CSS and script are stripped, or a colour tweak would rewrite the fixture.

        UPDATE_GOLDEN=1 npm run test:board     # after an intended change
    """

    FIXTURE = ROOT / "docs/scripts/fixtures"
    GOLDEN = ROOT / "docs/scripts/fixtures/board.golden.html"

    @staticmethod
    def markup(page: str) -> str:
        page = re.sub(r"<style>.*?</style>", "<style/>", page, flags=re.S)
        page = re.sub(r"<script[^>]*>.*?</script>", "<script/>", page, flags=re.S)
        # Editor links are per-machine: absolute checkout path, and a
        # cursor://vscode-remote/wsl+<distro> form under WSL that becomes
        # cursor://file anywhere else. None of it says anything about the
        # render, and pinning it would make the golden machine-specific.
        page = page.replace(str(ROOT), "<repo>")
        return re.sub(r"cursor://[^\"&]*", "cursor://&lt;editor&gt;", page)

    def render_fixture(self, **kwargs) -> str:
        # The published board reads the state files and nothing else. The
        # per-PR slice page may also read git; the fixture is not a repo, so
        # that path renders the in-flight plan with no touched symbols.
        real = (board.ROOT, board.STATE, sourcemap.ROOT)
        board.ROOT = self.FIXTURE
        board.STATE = self.FIXTURE / "state"
        sourcemap.ROOT = self.FIXTURE
        try:
            return self.markup(board.render(**kwargs))
        finally:
            board.ROOT, board.STATE, sourcemap.ROOT = real

    def test_it_matches_the_golden_file(self):
        out = self.render_fixture()
        if os.environ.get("UPDATE_GOLDEN"):
            self.GOLDEN.write_text(out, encoding="utf-8")
        expected = self.GOLDEN.read_text(encoding="utf-8")
        self.assertEqual(
            out,
            expected,
            "the rendered board changed — if that was the point, "
            "re-run with UPDATE_GOLDEN=1 and read the diff",
        )

    def test_the_published_board_does_not_carry_the_current_slice(self):
        out = self.render_fixture()
        for page in ["overview", "symbols", "flows", "steering"]:
            self.assertIn(f'id="{page}"', out)
        self.assertNotIn('id="newest"', out)
        self.assertNotIn("Latest slice", out)
        self.assertNotIn("This slice", out)
        self.assertNotIn("Uncommitted files", out)
        self.assertNotIn("Seams under test", out)

    def test_a_slice_page_is_this_slice_not_the_map(self):
        out = self.render_fixture(slice_page=True)
        self.assertIn('id="newest"', out)
        self.assertIn("This slice", out)
        self.assertIn("Seams under test", out)
        self.assertIn("Prove the board renders a slice in flight.", out)
        for page in ["overview", "symbols", "flows", "steering"]:
            self.assertNotIn(f'id="{page}"', out)

    def test_ids_never_reach_the_copy(self):
        out = self.render_fixture()
        # ids live in anchors, tooltips and data-search — never as visible text
        visible = re.sub(r"<[^>]+>", " ", out)
        for ident in ["L-add", "L-screen", "F-add", "D-001"]:
            self.assertNotIn(ident, visible, f"{ident} is visible copy, not plumbing")


class AuditRuns(unittest.TestCase):
    """The audit is a merge gate, so a crash in it is a broken build."""

    def test_it_runs_over_this_repo_and_reports(self):
        import subprocess

        out = subprocess.run(
            [sys.executable, str(ROOT / "docs/scripts/audit-state.py")],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )
        self.assertIn("findings", out.stdout)
        self.assertIn(out.returncode, (0, 1), out.stderr)


class HunkAttribution(unittest.TestCase):
    """Which symbol owns a diff hunk. A file-level answer gets most rows wrong."""

    SRC = """import { store } from './store';

type Row = { id: string };

export function alpha(row: Row) {
  return row.id;
}

export function beta(row: Row) {
  return row.id + '!';
}

export function gamma() {
  return 1;
}
"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        (root / "src").mkdir()
        (root / "src/mod.ts").write_text(self.SRC)
        (root / "src/route").mkdir()
        (root / "src/route/index.ts").write_text("export const x = 1;\n")
        self.real_root = sourcemap.ROOT
        sourcemap.ROOT = root
        self.addCleanup(lambda: setattr(sourcemap, "ROOT", self.real_root))

    def ranges(self, name, where, hunks):
        return sourcemap.symbol_change_ranges(
            {"name": name, "where": where}, {where: hunks}
        )

    def test_extent_stops_at_the_next_declaration_in_the_source(self):
        start = sourcemap.symbol_line("src/mod.ts", "alpha")
        self.assertEqual(start, 5)
        # beta is declared on line 9, so alpha owns up to line 8
        self.assertEqual(sourcemap.symbol_extent("src/mod.ts", start), 8)

    def test_a_hunk_inside_the_symbol_is_its_own(self):
        self.assertEqual(
            self.ranges("alpha", "src/mod.ts", [(6, 6)]), [(6, 6)]
        )

    def test_a_neighbours_hunk_is_not_charged_to_the_symbol_above(self):
        # beta is unmapped as far as LOGIC.md is concerned; its edits still
        # must not land on alpha's row.
        self.assertEqual(self.ranges("alpha", "src/mod.ts", [(10, 10)]), [])

    def test_hunks_above_the_first_declaration_belong_to_nobody(self):
        self.assertEqual(self.ranges("alpha", "src/mod.ts", [(1, 1)]), [])

    def test_an_entry_that_is_not_a_code_symbol_owns_the_whole_file(self):
        # A route file / directory entry stands for everything in it.
        self.assertEqual(
            self.ranges("route", "src/route", [(1, 1), (9, 9)]),
            [(1, 1), (9, 9)],
        )

    def test_no_hunks_in_the_file_means_no_ranges(self):
        self.assertEqual(
            sourcemap.symbol_change_ranges({"name": "alpha", "where": "src/mod.ts"}, {}), []
        )


class StateFilesParse(unittest.TestCase):
    """The real files still parse — a heading rename shows up here, not on the board."""

    def test_logic_flows_next_parse_and_cross_reference(self):
        state = ROOT / "docs/state"
        areas = g.parse_logic((state / "LOGIC.md").read_text())
        rows = [e for _, r in areas for e in r]
        flows = g.parse_flows((state / "FLOWS.md").read_text())
        nxt = g.parse_next((state / "NEXT.md").read_text())
        self.assertTrue(rows and flows)
        self.assertTrue(all(e["id"] and e["where"] and e["what"] for e in rows))
        self.assertTrue(all(f["trigger"] and f["outcome"] and f["steps"] for f in flows))
        # between slices NEXT.md names none, which is a state, not a failure
        self.assertRegex(nxt["number"], r"^(\d{4})?$")


if __name__ == "__main__":
    unittest.main(verbosity=2)
