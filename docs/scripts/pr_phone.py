"""QR block for the PR comment so a phone can open the published app.

A GitHub PR cannot keep Metro running, so this is the web build at `/app`,
not an Expo Go `exp://` URL. Scan it with the Camera app. Expo Go still
needs `npm start` on a machine the phone can reach.
"""

from __future__ import annotations

APP_URL = "https://santistebanc.github.io/splitnext-app/app/"
QR_PATH = "docs/scripts/phone-app-qr.png"


def qr_image_url(repo: str, sha: str) -> str:
    """Raw GitHub URL of the committed QR PNG at this commit."""
    return f"https://raw.githubusercontent.com/{repo}/{sha}/{QR_PATH}"


def phone_section(*, repo: str, sha: str, app_url: str = APP_URL) -> str:
    src = qr_image_url(repo, sha)
    return (
        "## Phone\n"
        "\n"
        "Scan with the Camera app to open the live web app on your phone.\n"
        "Expo Go cannot scan this — it is a website, not a Metro bundle.\n"
        "\n"
        f"[![Scan to open the app]({src})]({app_url})\n"
        "\n"
        f"{app_url}\n"
        "\n"
        "This PR's Edge Functions are on `splitnext-v3` once the supabase job "
        "is green. The client in that QR is what's on `main` until this merges.\n"
    )


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--sha", required=True)
    args = parser.parse_args()
    print(phone_section(repo=args.repo, sha=args.sha), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
