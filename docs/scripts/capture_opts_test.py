"""Seam tests for capture CLI options.

`--assert-only` is how CI drives every recorded flow without rewriting clips.
The parser is the public interface; Playwright stays out of `npm run check`.

Run: `npm run test:board`
"""

from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent


def call_opts(argv: list[str]) -> dict:
    script = f"""
import {{ parseCaptureArgv, contextOptions }} from './capture-opts.mjs';
const parsed = parseCaptureArgv({json.dumps(argv)});
const ctx = contextOptions({{
  assertOnly: parsed.assertOnly,
  viewport: {{ width: 390, height: 844 }},
  videoDir: '/tmp/video',
  storageState: {{ cookies: [], origins: [] }},
}});
process.stdout.write(JSON.stringify({{ parsed, ctx }}));
"""
    raw = subprocess.check_output(
        ["node", "--input-type=module", "-e", script],
        cwd=SCRIPTS,
        text=True,
    )
    return json.loads(raw)


class ParseCaptureArgv(unittest.TestCase):
    def test_assert_only_drives_without_recording_video(self):
        result = call_opts(["--assert-only"])
        self.assertTrue(result["parsed"]["assertOnly"])
        self.assertNotIn("recordVideo", result["ctx"])

    def test_default_records_a_clip(self):
        result = call_opts([])
        self.assertFalse(result["parsed"]["assertOnly"])
        self.assertEqual(
            result["ctx"]["recordVideo"],
            {"dir": "/tmp/video", "size": {"width": 390, "height": 844}},
        )

    def test_url_override_is_the_web_origin(self):
        result = call_opts(["--url", "http://127.0.0.1:9999"])
        self.assertEqual(result["parsed"]["base"], "http://127.0.0.1:9999")

    def test_flow_ids_narrow_the_run(self):
        result = call_opts(["--assert-only", "F-create", "F-open"])
        self.assertEqual(result["parsed"]["only"], ["F-create", "F-open"])
        self.assertTrue(result["parsed"]["assertOnly"])
