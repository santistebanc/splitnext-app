"""Seam tests for the post-deploy verification.

`evaluate` is the whole decision: given what each function answered and the sha
CI deployed, does this run go green? The fetching lives outside it, so every
case below — a stale function, a missing one, a timeout — is a dict, not a
network condition nobody can reproduce.

Run: `npm run test:board`
"""

import unittest

from verify_deploy import FUNCTIONS, evaluate

SHA = "0123456789abcdef0123456789abcdef01234567"


def ok(fn, sha=SHA):
    return {"fn": fn, "status": 200, "body": {"ok": True, "fn": fn, "revision": sha}}


def all_ok(sha=SHA):
    return [ok(fn, sha) for fn in FUNCTIONS]


class Evaluate(unittest.TestCase):
    def test_every_function_reporting_the_deploy_sha_passes(self):
        self.assertEqual(evaluate(all_ok(), SHA), [])

    def test_covers_every_deployed_function(self):
        self.assertEqual(
            FUNCTIONS,
            [
                "create-group",
                "merge",
                "fetch-entity",
                "list-roster",
                "mint-invite",
                "join-group",
                "leave-group",
                "register-push-token",
                "revoke-push-token",
            ],
        )

    # The failure this slice exists to catch: a deploy that no-ops leaves one
    # function on the previous commit, answering 200 to everything else.
    def test_a_stale_function_fails_and_is_named(self):
        probes = all_ok()
        probes[2] = ok("fetch-entity", "cafebabe" * 5)
        failures = evaluate(probes, SHA)
        self.assertEqual(len(failures), 1)
        self.assertIn("fetch-entity", failures[0])
        self.assertIn("cafebabe", failures[0])

    def test_every_function_stale_names_every_function(self):
        failures = evaluate(all_ok("deadbeef" * 5), SHA)
        self.assertEqual(len(failures), len(FUNCTIONS))

    def test_a_function_that_did_not_answer_fails(self):
        last = FUNCTIONS[-1]
        probes = all_ok()[:-1] + [{"fn": last, "error": "timed out after 10s"}]
        failures = evaluate(probes, SHA)
        self.assertEqual(len(failures), 1)
        self.assertIn(last, failures[0])
        self.assertIn("timed out", failures[0])

    def test_a_non_200_fails_with_its_status(self):
        probes = all_ok()[:1] + [{"fn": "merge", "status": 404, "body": None}]
        probes += [ok(fn) for fn in FUNCTIONS[2:]]
        failures = evaluate(probes, SHA)
        self.assertEqual(len(failures), 1)
        self.assertIn("merge", failures[0])
        self.assertIn("404", failures[0])

    # An unset DEPLOY_SHA is the quiet version of the same bug: the function is
    # up, and cannot say what it is running.
    def test_an_unknown_revision_fails(self):
        probes = all_ok()
        probes[0] = ok("create-group", "unknown")
        failures = evaluate(probes, SHA)
        self.assertEqual(len(failures), 1)
        self.assertIn("create-group", failures[0])

    def test_a_200_that_is_not_a_health_payload_fails(self):
        probes = all_ok()
        probes[1] = {"fn": "merge", "status": 200, "body": {"error": "unauthorized"}}
        failures = evaluate(probes, SHA)
        self.assertEqual(len(failures), 1)
        self.assertIn("merge", failures[0])

    def test_a_200_with_non_json_body_fails(self):
        probes = all_ok()
        probes[1] = {"fn": "merge", "status": 200, "body": "ok"}
        failures = evaluate(probes, SHA)
        self.assertEqual(len(failures), 1)
        self.assertIn("merge", failures[0])

    # A probe list that silently lost a function would otherwise pass by
    # vacuum: nothing reported, nothing wrong.
    def test_a_function_missing_from_the_probes_fails(self):
        failures = evaluate(all_ok()[:-1], SHA)
        self.assertEqual(len(failures), 1)
        self.assertIn(FUNCTIONS[-1], failures[0])

    def test_no_probes_at_all_fails_for_every_function(self):
        self.assertEqual(len(evaluate([], SHA)), len(FUNCTIONS))

    # The body names the function too; if a deploy ever crossed the routes,
    # every revision would still match and nothing else would notice.
    def test_a_function_answering_under_another_name_fails(self):
        probes = all_ok()
        probes[3] = {
            "fn": "list-roster",
            "status": 200,
            "body": {"ok": True, "fn": "merge", "revision": SHA},
        }
        failures = evaluate(probes, SHA)
        self.assertEqual(len(failures), 1)
        self.assertIn("list-roster", failures[0])

    def test_failures_are_ordered_by_the_function_list_not_the_probes(self):
        probes = [ok(fn, "stale") for fn in reversed(FUNCTIONS)]
        failures = evaluate(probes, SHA)
        self.assertEqual([f.split()[0] for f in failures], FUNCTIONS)

    # Guarding the guard: an empty expected sha would make every comparison
    # trivially wrong, and a caller could pass one by forgetting an env var.
    def test_an_empty_expected_sha_is_rejected(self):
        with self.assertRaises(ValueError):
            evaluate(all_ok(), "")


if __name__ == "__main__":
    unittest.main()
