"""Which remote a GitHub Actions run may touch.

`target_for` is the whole decision: given the event name and git ref, return
the project this run may deploy to (`prod` / `dev` / None) and whether it may
wipe that database first. The workflows call this; they do not re-encode the
table.

Prod is `main` on `push` only (D-052). Dev is any `slice/**` branch: `push`
deploys additively, `workflow_dispatch` resets then deploys (D-058).
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass

# Not secrets: both refs are in every client bundle that talks to that project.
# Dev is filled once splitnext-v3-dev exists; github_output fails closed until then.
PROD_PROJECT_REF = "ycpkguwfxlhpovnsuujr"
DEV_PROJECT_REF = ""

PROJECTS = {"prod": PROD_PROJECT_REF, "dev": DEV_PROJECT_REF}


@dataclass(frozen=True)
class Decision:
    target: str | None
    reset: bool


def target_for(event: str, ref: str) -> Decision:
    if event == "push" and ref == "refs/heads/main":
        return Decision(target="prod", reset=False)
    if event == "push" and _is_slice_branch(ref):
        return Decision(target="dev", reset=False)
    if event == "workflow_dispatch" and _is_slice_branch(ref):
        return Decision(target="dev", reset=True)
    return Decision(target=None, reset=False)


def github_output(decision: Decision) -> str:
    """GITHUB_OUTPUT body for this run, or ValueError if it must not proceed."""
    if decision.target is None:
        raise ValueError("this event+ref may not touch any remote")
    if decision.reset and decision.target != "dev":
        raise ValueError("reset is only allowed on dev")
    project_ref = PROJECTS[decision.target]
    if not project_ref:
        raise ValueError(f"no project ref configured for {decision.target}")
    reset = "true" if decision.reset else "false"
    return (
        f"target={decision.target}\n"
        f"reset={reset}\n"
        f"project_ref={project_ref}\n"
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
