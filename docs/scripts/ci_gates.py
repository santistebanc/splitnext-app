"""The merge-gate contract: what `npm run check` is, and that capture is a
second CI job that does not need a Cloudflare account.

The workflows and package.json are the source; this module reads them so the
tests do not re-encode the YAML shape.
"""

from __future__ import annotations

import re

FAST_CHECK = "npm test && npm run typecheck && npm run test:board && npm run audit"

_JOB_HEADER = re.compile(r"^  ([a-z][\w-]*)\s*:\s*$", re.M)


def jobs(ci_yml: str) -> list[str]:
    """Job ids under `jobs:`, in file order."""
    after = ci_yml.split("\njobs:", 1)
    if len(after) != 2:
        return []
    return _JOB_HEADER.findall("\n" + after[1])


def job_text(ci_yml: str, name: str) -> str:
    """Body of one job, up to the next job at the same indent."""
    names = jobs(ci_yml)
    if name not in names:
        raise KeyError(name)
    after_jobs = ci_yml.split("\njobs:", 1)[1]
    start = re.search(rf"^  {re.escape(name)}\s*:\s*$", after_jobs, re.M)
    if not start:
        raise KeyError(name)
    rest = after_jobs[start.end() :]
    nxt = _JOB_HEADER.search(rest)
    return rest[: nxt.start()] if nxt else rest


def secret_names(text: str) -> list[str]:
    return re.findall(r"secrets\.([A-Z0-9_]+)", text)
