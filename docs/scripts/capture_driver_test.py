"""Seam tests for capture's reload assertions on the member-first hub.

Balances live on the hub as signed money; settle buttons live on a member
screen as "Pay …" / "… pays …" lines. The helpers have to pick those out of
a full page body without the old BALANCES / SETTLE UP headings.

Run: `npm run test:board`
"""

from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent


def call_extract(fn: str, body: str) -> str:
    script = f"""
import {{ balancesOf, settleOf }} from './capture-driver.mjs';
const fn = {json.dumps(fn)};
const body = {json.dumps(body)};
const out = fn === 'balancesOf' ? balancesOf(body) : settleOf(body);
process.stdout.write(JSON.stringify(out));
"""
    raw = subprocess.check_output(
        ["node", "--input-type=module", "-e", script],
        cwd=SCRIPTS,
        text=True,
    )
    return json.loads(raw)


HUB = """
(empty)
You (Ana)
+6.67 EUR
Bo
−3.33 EUR
Cy
−3.34 EUR
Settings
All expenses →
+ Expense
"""

MEMBER = """
You (Ana)
Net balance
+6.67 EUR
Settle
Suggested efficient transfers for the group
Bo pays 3.33 EUR to You (Ana)
"""


class BalancesOf(unittest.TestCase):
    def test_keeps_signed_money_and_drops_chrome(self):
        self.assertEqual(
            call_extract("balancesOf", HUB),
            "+6.67 EUR\n−3.33 EUR\n−3.34 EUR",
        )

    def test_empty_when_nothing_is_spent(self):
        self.assertEqual(call_extract("balancesOf", "All expenses →\nAdd member"), "")


class SettleOf(unittest.TestCase):
    def test_keeps_pay_lines_and_drops_the_net(self):
        self.assertEqual(
            call_extract("settleOf", MEMBER),
            "Bo pays 3.33 EUR to You (Ana)",
        )

    def test_keeps_a_you_pay_button(self):
        self.assertEqual(
            call_extract("settleOf", "Pay 3.33 EUR to Bo\nNet balance\n−3.33 EUR"),
            "Pay 3.33 EUR to Bo",
        )
