#!/usr/bin/env python3
"""Tests for `delta.py` — the report that now runs on the PR.

It is the only thing saying which *pieces* a slice moved, so the failure that
matters is a quiet one: a hunk charged to the symbol above it, or a flow that
does not notice one of its steps changed.

    npm run test:board
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "docs/scripts"))

import delta  # noqa: E402
import sourcemap  # noqa: E402

FIXTURE = ROOT / "docs/scripts/fixtures"

ROWS = [
    {"id": "L-a", "name": "alpha", "kind": "Pure", "where": "src/mod.ts", "what": "A.", "area": "Device"},
    {"id": "L-b", "name": "beta", "kind": "Pure", "where": "src/mod.ts", "what": "B.", "area": "Device"},
    {"id": "L-route", "name": "route", "kind": "Screen", "where": "src/route", "what": "R.", "area": "UI"},
]

SRC = """import { store } from './store';

export function alpha() {
  return 1;
}

export function beta() {
  return 2;
}
"""


class Attribution(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        (root / "src/route").mkdir(parents=True)
        (root / "src/mod.ts").write_text(SRC)
        (root / "src/route/index.ts").write_text("export const x = 1;\n")
        real = sourcemap.ROOT
        sourcemap.ROOT = root
        self.addCleanup(lambda: setattr(sourcemap, "ROOT", real))

    def state(self, hunks, changes=None):
        return {
            "hunks": hunks,
            "churn": {},
            "changes": changes
            or [{"path": p, "state": "changed"} for p in hunks],
            "stat": "",
        }

    def test_only_the_symbol_the_hunk_landed_on_is_reported(self):
        touched = delta.touched_symbols(self.state({"src/mod.ts": [(4, 4)]}), ROWS)
        self.assertEqual([e["id"] for e, _ in touched], ["L-a"])

    def test_a_file_with_no_line_data_reports_its_symbols(self):
        touched = delta.touched_symbols(self.state({"src/mod.ts": []}), ROWS)
        self.assertEqual({e["id"] for e, _ in touched}, {"L-a", "L-b"})

    def test_a_directory_entry_owns_changes_under_it(self):
        state = self.state({"src/route/index.ts": [(1, 1)]})
        touched = delta.touched_symbols(state, ROWS)
        self.assertEqual([e["id"] for e, _ in touched], ["L-route"])

    def test_the_file_state_rides_along(self):
        state = self.state(
            {"src/mod.ts": [(4, 4)]},
            changes=[{"path": "src/mod.ts", "state": "new"}],
        )
        self.assertEqual(delta.touched_symbols(state, ROWS)[0][1], "new")


class Flows(unittest.TestCase):
    FLOWS = [
        {
            "id": "F-x",
            "title": "Do the thing",
            "steps": ["`L-a` starts it.", "`L-b` finishes it.", "nothing cited here"],
        }
    ]

    def test_it_names_the_steps_that_cite_a_changed_piece(self):
        hits = delta.touched_flows(self.FLOWS, {"L-b"})
        self.assertEqual(hits[0][1], [2])

    def test_a_flow_citing_nothing_changed_is_not_a_hit(self):
        self.assertEqual(delta.touched_flows(self.FLOWS, {"L-zzz"}), [])


class Why(unittest.TestCase):
    NEXT = {
        "number": "0010",
        "now_after": [{"aspect": "Alpha", "before": "One", "after": "Two"}],
        "plan": ["Rewrite `L-b` so it returns three."],
        "seams": [{"seam": "`L-route`", "behavior": "renders the list"}],
        "edge_paths": [],
    }

    def test_an_id_in_the_plan_explains_the_change(self):
        self.assertIn("returns three", delta.why(ROWS[1], self.NEXT))

    def test_a_before_after_row_wins_over_the_plan(self):
        self.assertEqual(delta.why(ROWS[0], self.NEXT), "One → **Two**")

    def test_a_seam_explains_it_when_nothing_else_does(self):
        self.assertIn("under test", delta.why(ROWS[2], self.NEXT))

    def test_a_piece_nothing_names_gets_no_reason(self):
        row = dict(ROWS[0], id="L-zz", name="zeta", where="src/zeta.ts")
        self.assertEqual(delta.why(row, self.NEXT), "")


class Report(unittest.TestCase):
    """The whole report, over the committed fixture state files."""

    def setUp(self):
        real = (delta.STATE, sourcemap.ROOT)
        delta.STATE = FIXTURE / "state"
        sourcemap.ROOT = FIXTURE
        self.addCleanup(
            lambda: setattr(delta, "STATE", real[0]) or setattr(sourcemap, "ROOT", real[1])
        )

    def test_it_reads_as_pieces_not_files(self):
        state = {
            "hunks": {"src/home.ts": [(4, 4)]},
            "churn": {"src/home.ts": (2, 1)},
            "changes": [{"path": "src/home.ts", "state": "changed"}],
            "stat": "1 file changed",
        }
        out = delta.report(state, "Title")
        self.assertIn("## Title", out)
        self.assertIn("`addThing`", out)  # the piece the hunk landed on
        self.assertIn("Add a thing", out)  # the flow that names it
        self.assertIn("Extend", out)  # what NEXT.md says it is for

    def test_it_says_when_nothing_mapped_moved(self):
        state = {"hunks": {}, "churn": {}, "changes": [], "stat": ""}
        out = delta.report(state, "Title")
        self.assertIn("No mapped piece was touched", out)
        self.assertIn("No flow names a changed piece", out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
