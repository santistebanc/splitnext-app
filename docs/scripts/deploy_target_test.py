"""Seam tests for which remote a GitHub event may touch.

`target_for` is the whole decision: given the event name and git ref, which
project may this run deploy to, and may it wipe that database first? The
workflows call this; they do not re-encode the table.

Run: `npm run test:board`
"""

import unittest

from deploy_target import (
    PROD_PROJECT_REF,
    Decision,
    github_output,
    target_for,
)


class TargetFor(unittest.TestCase):
    def test_push_main_is_prod_without_reset(self):
        decision = target_for("push", "refs/heads/main")
        self.assertEqual(decision.target, "prod")
        self.assertFalse(decision.reset)

    def test_push_slice_branch_is_dev_without_reset(self):
        decision = target_for("push", "refs/heads/slice/0013-dev-remote")
        self.assertEqual(decision.target, "dev")
        self.assertFalse(decision.reset)

    def test_dispatch_on_slice_branch_is_dev_with_reset(self):
        decision = target_for("workflow_dispatch", "refs/heads/slice/0012-member-invites")
        self.assertEqual(decision.target, "dev")
        self.assertTrue(decision.reset)

    def test_dispatch_on_main_is_none(self):
        decision = target_for("workflow_dispatch", "refs/heads/main")
        self.assertIsNone(decision.target)
        self.assertFalse(decision.reset)

    def test_push_to_any_other_branch_is_none(self):
        decision = target_for("push", "refs/heads/chore/slicer-process")
        self.assertIsNone(decision.target)
        self.assertFalse(decision.reset)

    def test_pull_request_on_a_slice_branch_is_none(self):
        decision = target_for("pull_request", "refs/heads/slice/0013-dev-remote")
        self.assertIsNone(decision.target)
        self.assertFalse(decision.reset)


class GitHubOutput(unittest.TestCase):
    def test_prod_push_names_the_prod_project(self):
        text = github_output(target_for("push", "refs/heads/main"))
        self.assertEqual(
            text,
            f"target=prod\nreset=false\nproject_ref={PROD_PROJECT_REF}\n",
        )

    def test_none_is_refused(self):
        with self.assertRaises(ValueError):
            github_output(target_for("workflow_dispatch", "refs/heads/main"))

    def test_reset_on_prod_is_refused_even_if_forced(self):
        with self.assertRaises(ValueError):
            github_output(Decision(target="prod", reset=True))

    def test_dev_is_refused_until_the_project_ref_is_configured(self):
        with self.assertRaises(ValueError):
            github_output(target_for("push", "refs/heads/slice/0013-dev-remote"))
