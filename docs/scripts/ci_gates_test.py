"""Seam tests for the merge gates.

`npm run check` stays the four fast gates. Capture is a second required CI
job and must not need a Cloudflare account.

Run: `npm run test:board`
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from ci_gates import (
    FAST_CHECK,
    job_text,
    jobs,
    secret_names,
)

ROOT = Path(__file__).resolve().parents[2]


class PackageCheck(unittest.TestCase):
    def test_check_is_the_four_fast_gates(self):
        package = json.loads((ROOT / "package.json").read_text())
        self.assertEqual(package["scripts"]["check"], FAST_CHECK)
        self.assertNotIn("capture", package["scripts"]["check"])


class CiWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ci = (ROOT / ".github/workflows/ci.yml").read_text()

    def test_check_and_capture_are_both_jobs(self):
        self.assertEqual(set(jobs(self.ci)), {"check", "capture"})

    def test_check_job_still_runs_npm_run_check(self):
        body = job_text(self.ci, "check")
        self.assertIn("npm run check", body)
        self.assertNotIn("playwright", body)
        self.assertNotIn("capture", body)

    def test_capture_job_installs_playwright_and_runs_assert_only(self):
        body = job_text(self.ci, "capture")
        self.assertIn("playwright install", body)
        self.assertIn("capture:ci", body)

    def test_capture_job_has_no_cloudflare_secrets(self):
        body = job_text(self.ci, "capture")
        self.assertEqual(secret_names(body), [])
        self.assertNotRegex(body, r"CLOUDFLARE")
