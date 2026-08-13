#!/usr/bin/env python3
"""Post-deploy verification: is the deployed server the commit CI just merged?

`wrangler deploy` reporting success is not evidence. The failure this
guards against is the one that happened: the remote ran a stale `fetch-entity`
for three slices while every archive said it had shipped, answering 200 to
anything a liveness check could have asked.

So each Worker route is asked what it is running (`?health=1`, see
workers/src/health.ts) and every answer has to be the deploy sha.

`evaluate` holds the whole decision and touches no network, which is what makes
the stale / missing / timed-out cases testable — see verify_deploy_test.py.

Usage:
    verify_deploy.py --base-url https://splitnext.<subdomain>.workers.dev --sha $GITHUB_SHA
                     [--timeout 10] [--retries 5]

Exit code 0 when every function reports the sha, 1 otherwise, with each
offending function named on stderr.
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

# The list, in deploy order. A function that nobody adds here is a
# function nobody verifies, so this list is also the deploy list in CI.
FUNCTIONS = [
    "create-group",
    "merge",
    "fetch-entity",
    "list-roster",
    "mint-invite",
    "join-group",
]


def evaluate(probes, expected_sha):
    """Return one failure line per function that is not provably on `expected_sha`.

    An empty list means the deployment is the commit. `probes` is a list of
    ``{"fn": name, "status": int, "body": obj}`` or ``{"fn": name, "error": str}``;
    order does not matter and a missing function is a failure, never a pass by
    omission.
    """
    if not expected_sha:
        raise ValueError("expected_sha is empty — nothing to verify against")

    by_fn = {p.get("fn"): p for p in probes}
    failures = []

    for fn in FUNCTIONS:
        probe = by_fn.get(fn)

        if probe is None:
            failures.append(f"{fn} was never probed")
            continue

        if probe.get("error"):
            failures.append(f"{fn} did not answer: {probe['error']}")
            continue

        status = probe.get("status")
        if status != 200:
            failures.append(f"{fn} answered HTTP {status}, not 200")
            continue

        body = probe.get("body")
        if not isinstance(body, dict) or body.get("ok") is not True:
            failures.append(f"{fn} answered 200 but not with a health payload: {body!r}")
            continue

        # The payload names itself, so a deploy that crossed two functions'
        # routes fails here rather than passing on matching revisions.
        if body.get("fn") != fn:
            failures.append(f"{fn} answered under the name {body.get('fn')!r}")
            continue

        revision = body.get("revision")
        if revision != expected_sha:
            failures.append(
                f"{fn} is running {revision!r}, not the merge sha {expected_sha!r}"
            )

    return failures


def probe(base_url, fn, anon_key, timeout, retries):
    """Ask one function what it is running. Never raises; a failure is a probe."""
    url = f"{base_url.rstrip('/')}/{fn}?health=1"
    headers = {"User-Agent": "splitnext-verify-deploy"}

    last = "no attempt made"
    for attempt in range(retries):
        # A function is cold right after deploy and the first hit can time out
        # on boot rather than on being wrong.
        if attempt:
            time.sleep(2 * attempt)
        try:
            req = urllib.request.Request(url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=timeout) as res:
                raw = res.read().decode("utf-8")
                try:
                    body = json.loads(raw)
                except json.JSONDecodeError:
                    body = raw
                return {"fn": fn, "status": res.status, "body": body}
        except urllib.error.HTTPError as err:
            # A 4xx/5xx is an answer, not a transport failure: report it and
            # let evaluate say what is wrong, rather than retrying a verdict.
            return {"fn": fn, "status": err.code, "body": None}
        except Exception as err:  # timeout, DNS, connection reset
            last = f"{type(err).__name__}: {err}"

    return {"fn": fn, "error": last}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="https://splitnext.<subdomain>.workers.dev")
    parser.add_argument("--sha", required=True, help="the commit CI just deployed")
    parser.add_argument("--anon-key", default="", help="unused; kept so old callers do not break")
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument("--retries", type=int, default=5)
    args = parser.parse_args(argv)

    probes = [
        probe(args.base_url, fn, args.anon_key, args.timeout, args.retries)
        for fn in FUNCTIONS
    ]

    try:
        failures = evaluate(probes, args.sha)
    except ValueError as err:
        print(f"verify-deploy: {err}", file=sys.stderr)
        return 1

    if failures:
        print(
            f"verify-deploy: the deployment is not {args.sha}", file=sys.stderr
        )
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    print(f"verify-deploy: all {len(FUNCTIONS)} functions are running {args.sha}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
