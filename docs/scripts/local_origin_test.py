"""Seam tests for the local Worker origin the web target must hit.

Capture-in-CI boots a listen origin, not workers.dev. Metro inlines
EXPO_PUBLIC_API_URL at start, so the env we pass is the whole decision.

Run: `npm run test:board`
"""

from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent


def node_json(expr: str) -> object:
    script = f"""
import {{
  assertLocalOrigin,
  isDeployedWorkerUrl,
  metroEnv,
  webPortOccupied,
}} from './local-origin.mjs';
process.stdout.write(JSON.stringify({expr}));
"""
    raw = subprocess.check_output(
        ["node", "--input-type=module", "-e", script],
        cwd=SCRIPTS,
        text=True,
    )
    return json.loads(raw)


def node_throws(expr: str) -> str:
    script = f"""
import {{ assertLocalOrigin, metroEnv }} from './local-origin.mjs';
try {{
  {expr};
  process.exit(0);
}} catch (err) {{
  process.stderr.write(String(err.message ?? err));
  process.exit(1);
}}
"""
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=SCRIPTS,
        text=True,
        capture_output=True,
    )
    if result.returncode == 0:
        raise AssertionError(f"expected throw from {expr}")
    return result.stderr


class AssertLocalOrigin(unittest.TestCase):
    def test_refuses_the_deployed_worker(self):
        err = node_throws(
            "assertLocalOrigin('https://splitnext.santistebanc94.workers.dev')"
        )
        self.assertRegex(err, r"deployed Worker|workers\.dev")

    def test_accepts_a_listen_origin(self):
        self.assertEqual(
            node_json("assertLocalOrigin('http://127.0.0.1:54321')"),
            "http://127.0.0.1:54321",
        )


class MetroEnv(unittest.TestCase):
    def test_points_the_bundle_at_the_listen_origin(self):
        env = node_json(
            "metroEnv('http://127.0.0.1:8787/', { PATH: '/bin', EXPO_PUBLIC_API_URL: 'https://splitnext.santistebanc94.workers.dev' })"
        )
        self.assertEqual(env["EXPO_PUBLIC_API_URL"], "http://127.0.0.1:8787")
        self.assertEqual(env["BROWSER"], "none")
        self.assertEqual(env["CI"], "1")

    def test_refuses_to_inline_workers_dev(self):
        err = node_throws(
            "metroEnv('https://splitnext.santistebanc94.workers.dev')"
        )
        self.assertRegex(err, r"deployed Worker|workers\.dev")


class DeployedWorkerUrl(unittest.TestCase):
    def test_create_group_on_workers_dev_is_the_deployed_worker(self):
        self.assertTrue(
            node_json(
                "isDeployedWorkerUrl('https://splitnext.santistebanc94.workers.dev/create-group')"
            )
        )

    def test_create_group_on_the_listen_origin_is_local(self):
        self.assertFalse(
            node_json("isDeployedWorkerUrl('http://127.0.0.1:54321/create-group')")
        )


class WebPortOccupied(unittest.TestCase):
    def test_any_http_response_means_metro_already_owns_the_port(self):
        self.assertTrue(
            node_json(
                "await webPortOccupied('http://127.0.0.1:8081', async () => ({ ok: false, status: 500 }))"
            )
        )

    def test_connection_refused_means_the_port_is_free(self):
        self.assertFalse(
            node_json(
                "await webPortOccupied('http://127.0.0.1:8081', async () => { throw new Error('ECONNREFUSED'); })"
            )
        )
