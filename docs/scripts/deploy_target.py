"""Which GitHub Actions runs may deploy the Cloudflare Worker.

`target_for` is the whole decision: given the event name and git ref, return
whether this run may deploy to the one remote (`prod`) and it may never wipe.
The workflows call this; they do not re-encode the table.

`push` to `main` or to `slice/**` deploys (D-058). Hand deploy and
`workflow_dispatch` stay forbidden (D-052).
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass

WORKER_NAME = "splitnext"
WORKER_HOST = "splitnext.santistebanc94.workers.dev"
PROJECTS = {"prod": WORKER_NAME}


@dataclass(frozen=True)
class Decision:
    target: str | None
    reset: bool


def target_for(event: str, ref: str) -> Decision:
    if event == "push" and (ref == "refs/heads/main" or _is_slice_branch(ref)):
        return Decision(target="prod", reset=False)
    return Decision(target=None, reset=False)


def github_output(decision: Decision) -> str:
    """GITHUB_OUTPUT body for this run, or ValueError if it must not proceed."""
    if decision.target is None:
        raise ValueError("this event+ref may not touch the remote")
    if decision.reset:
        raise ValueError("reset is never allowed")
    worker_name = PROJECTS[decision.target]
    return (
        f"target={decision.target}\n"
        f"reset=false\n"
        f"worker_name={worker_name}\n"
        f"base_url=https://{WORKER_HOST}\n"
    )


def _is_slice_branch(ref: str) -> bool:
    prefix = "refs/heads/slice/"
    return ref.startswith(prefix) and len(ref) > len(prefix)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event", required=True, help="GitHub event_name")
    parser.add_argument("--ref", required=True, help="GitHub ref, e.g. refs/heads/main")
    args = parser.parse_args(argv)

    try:
        text = github_output(target_for(args.event, args.ref))
    except ValueError as err:
        print(f"deploy-target: {err}", file=sys.stderr)
        return 1

    sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
