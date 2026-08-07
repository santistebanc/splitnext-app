"""Seam tests for the symbol call graph.

Fixtures are synthetic sources held in the test, never the live tree: the
resolver takes a reader precisely so it can be driven without a repo, and
pointing these at `src/` would make every slice that edits sync flap the
board's own tests.

Run: `npm run test:board`
"""

import unittest

from callgraph import plan_tree, resolve, symbol_names


def entry(eid, name, where):
    return {"id": eid, "name": name, "where": where}


def reader(files):
    """A read_source over a dict, standing in for the filesystem."""
    return lambda rel: files.get(rel)


class SymbolNames(unittest.TestCase):
    def test_single_name(self):
        self.assertEqual(symbol_names("syncGroup"), ["syncGroup"])

    def test_read_write_pair_is_two_names_one_idea(self):
        self.assertEqual(
            symbol_names("getAccessToken / saveAccessToken"),
            ["getAccessToken", "saveAccessToken"],
        )

    def test_prose_title_is_not_a_code_symbol(self):
        # "Lobby screen" names no export, so its entry stands for its whole file
        self.assertEqual(symbol_names("Lobby screen"), [])

    def test_route_path_is_not_a_code_symbol(self):
        self.assertEqual(symbol_names("/group/[id]"), [])


class Resolve(unittest.TestCase):
    def test_direct_call_is_an_edge(self):
        files = {
            "a.ts": "export function outer() {\n  return inner();\n}\n",
            "b.ts": "export function inner() {\n  return 1;\n}\n",
        }
        edges = resolve(
            [entry("L-outer", "outer", "a.ts"), entry("L-inner", "inner", "b.ts")],
            reader(files),
        )
        self.assertEqual(edges["L-outer"], ["L-inner"])
        self.assertEqual(edges["L-inner"], [])

    def test_call_through_an_unmapped_private_helper_still_counts(self):
        # The flushQueue case: the mapped name delegates to a private helper
        # that holds every real call. LOGIC.md lists deep modules and omits
        # private helpers, so this is the normal shape, not an edge case.
        files = {
            "outbound.ts": (
                "async function flushQueueInner(id) {\n"
                "  const r = await mergeEntities(id);\n"
                "  return r;\n"
                "}\n"
                "export async function flushQueue(id) {\n"
                "  return runExclusive(id, () => flushQueueInner(id));\n"
                "}\n"
            ),
            "edge.ts": "export async function mergeEntities(id) {}\n",
        }
        edges = resolve(
            [
                entry("L-flush", "flushQueue", "outbound.ts"),
                entry("L-merge", "mergeEntities", "edge.ts"),
            ],
            reader(files),
        )
        self.assertEqual(edges["L-flush"], ["L-merge"])

    def test_helper_walk_is_transitive(self):
        files = {
            "a.ts": (
                "function third() {\n  return target();\n}\n"
                "function second() {\n  return third();\n}\n"
                "export function first() {\n  return second();\n}\n"
            ),
            "b.ts": "export function target() {}\n",
        }
        edges = resolve(
            [entry("L-first", "first", "a.ts"), entry("L-target", "target", "b.ts")],
            reader(files),
        )
        self.assertEqual(edges["L-first"], ["L-target"])

    def test_walk_stops_at_a_mapped_name(self):
        # `middle` is its own entry, so it is an edge and not a corridor:
        # whatever it calls belongs to it, not to its caller. Without this a
        # deep module stops being a boundary and every root inherits the leaves.
        files = {
            "a.ts": "export function outer() {\n  return middle();\n}\n",
            "b.ts": "export function middle() {\n  return deep();\n}\n",
            "c.ts": "export function deep() {}\n",
        }
        edges = resolve(
            [
                entry("L-outer", "outer", "a.ts"),
                entry("L-middle", "middle", "b.ts"),
                entry("L-deep", "deep", "c.ts"),
            ],
            reader(files),
        )
        self.assertEqual(edges["L-outer"], ["L-middle"])
        self.assertEqual(edges["L-middle"], ["L-deep"])

    def test_whole_file_entry_claims_every_call_in_its_file(self):
        # A route file or a function directory names no export, so the entry
        # stands for the file — the same rule change attribution already uses.
        files = {
            "app/group/[id].tsx": (
                "function Header() {\n  return openGroup();\n}\n"
                "export default function Hub() {\n  return addExpense();\n}\n"
            ),
            "sync.ts": (
                "export function openGroup() {}\n" "export function addExpense() {}\n"
            ),
        }
        edges = resolve(
            [
                entry("L-hub", "Group hub", "app/group/[id].tsx"),
                entry("L-open", "openGroup", "sync.ts"),
                entry("L-add", "addExpense", "sync.ts"),
            ],
            reader(files),
        )
        self.assertEqual(edges["L-hub"], ["L-open", "L-add"])

    def test_directory_entry_reads_its_index(self):
        files = {
            "functions/merge/index.ts": "Deno.serve(() => resolveAccessToken());\n",
            "shared/access.ts": "export function resolveAccessToken() {}\n",
        }
        edges = resolve(
            [
                entry("L-efMerge", "merge", "functions/merge"),
                entry("L-efAccess", "resolveAccessToken", "shared/access.ts"),
            ],
            reader(files),
        )
        self.assertEqual(edges["L-efMerge"], ["L-efAccess"])

    def test_children_are_in_source_order(self):
        # Sibling order in the tree is the order the calls happen, which is the
        # only ordering the caller itself asserts.
        files = {
            "a.ts": (
                "export function outer() {\n"
                "  second();\n"
                "  first();\n"
                "  second();\n"
                "}\n"
            ),
            "b.ts": "export function first() {}\nexport function second() {}\n",
        }
        edges = resolve(
            [
                entry("L-outer", "outer", "a.ts"),
                entry("L-first", "first", "b.ts"),
                entry("L-second", "second", "b.ts"),
            ],
            reader(files),
        )
        self.assertEqual(edges["L-outer"], ["L-second", "L-first"])

    def test_an_entry_never_calls_itself(self):
        # A read/write pair is one entry with two names; one half calling the
        # other is internal, not a relationship between two pieces.
        files = {
            "t.ts": (
                "export function saveAccessToken(v) {\n"
                "  return getAccessToken() ?? v;\n"
                "}\n"
                "export function getAccessToken() {}\n"
            )
        }
        edges = resolve(
            [entry("L-token", "getAccessToken / saveAccessToken", "t.ts")],
            reader(files),
        )
        self.assertEqual(edges["L-token"], [])

    def test_a_bare_mention_is_not_a_call(self):
        files = {
            "a.ts": (
                "import { target } from './b';\n"
                "export const outer = () => [target].length;\n"
            ),
            "b.ts": "export function target() {}\n",
        }
        edges = resolve(
            [entry("L-outer", "outer", "a.ts"), entry("L-target", "target", "b.ts")],
            reader(files),
        )
        self.assertEqual(edges["L-outer"], [])

    def test_a_missing_file_yields_no_edges_rather_than_an_error(self):
        edges = resolve([entry("L-gone", "gone", "nowhere.ts")], reader({}))
        self.assertEqual(edges["L-gone"], [])

    def test_a_cycle_terminates_and_reports_each_edge_once(self):
        files = {
            "a.ts": "export function a() {\n  return b();\n}\n",
            "b.ts": "export function b() {\n  return a();\n}\n",
        }
        edges = resolve(
            [entry("L-a", "a", "a.ts"), entry("L-b", "b", "b.ts")], reader(files)
        )
        self.assertEqual(edges["L-a"], ["L-b"])
        self.assertEqual(edges["L-b"], ["L-a"])


class PlanTree(unittest.TestCase):
    def plan(self, entries, edges):
        return plan_tree(entries, edges)

    def test_roots_are_the_symbols_nobody_calls(self):
        entries = [entry(i, i, "x.ts") for i in ("L-screen", "L-job", "L-pure")]
        edges = {"L-screen": ["L-job"], "L-job": ["L-pure"], "L-pure": []}
        plan = self.plan(entries, edges)
        self.assertEqual(plan.roots, ["L-screen"])
        self.assertEqual(plan.unreached, [])

    def test_every_entry_expands_exactly_once(self):
        # The invariant that keeps Tree a view of the map: same row count as
        # Flat, so the sidebar count stays honest and nothing hides in a fold.
        entries = [entry(i, i, "x.ts") for i in ("L-a", "L-b", "L-c", "L-shared")]
        edges = {
            "L-a": ["L-shared", "L-b"],
            "L-b": ["L-shared"],
            "L-c": ["L-shared"],
            "L-shared": [],
        }
        plan = self.plan(entries, edges)
        self.assertEqual(sorted(plan.home), ["L-a", "L-b", "L-c", "L-shared"])
        self.assertEqual(len(plan.home), len(entries))

    def test_a_shared_symbol_expands_at_its_shallowest_caller(self):
        entries = [entry(i, i, "x.ts") for i in ("L-root", "L-mid", "L-leaf")]
        edges = {"L-root": ["L-mid", "L-leaf"], "L-mid": ["L-leaf"], "L-leaf": []}
        plan = self.plan(entries, edges)
        # depth 1 under the root beats depth 2 under mid
        self.assertEqual(plan.home["L-leaf"], "L-root")
        self.assertTrue(plan.expands_here("L-root", "L-leaf"))
        self.assertFalse(plan.expands_here("L-mid", "L-leaf"))

    def test_a_symbol_in_a_cycle_still_gets_a_home(self):
        entries = [entry(i, i, "x.ts") for i in ("L-top", "L-a", "L-b")]
        edges = {"L-top": [], "L-a": ["L-b"], "L-b": ["L-a"]}
        plan = self.plan(entries, edges)
        self.assertEqual(plan.roots, ["L-top"])
        self.assertEqual(plan.unreached, ["L-a"])
        self.assertEqual(len(plan.home), 3)
        self.assertEqual(plan.home["L-b"], "L-a")

    def test_an_isolated_symbol_is_a_root(self):
        entries = [entry("L-alone", "alone", "x.ts")]
        plan = self.plan(entries, {"L-alone": []})
        self.assertEqual(plan.roots, ["L-alone"])

    def test_roots_keep_the_order_the_map_writes_them_in(self):
        entries = [entry(i, i, "x.ts") for i in ("L-one", "L-two", "L-three")]
        edges = {"L-one": [], "L-two": [], "L-three": []}
        self.assertEqual(self.plan(entries, edges).roots, ["L-one", "L-two", "L-three"])


if __name__ == "__main__":
    unittest.main()
