"""Detect `/j/{token}` invite URLs on the public landing (not Expo `/app`)."""

from __future__ import annotations

import re
from urllib.parse import unquote

PAGES_PREFIX = "/splitnext-app"
_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def site_path(url_path: str) -> str:
    path = url_path.split("?", 1)[0].split("#", 1)[0]
    if not path.startswith("/"):
        path = "/" + path
    if path == PAGES_PREFIX or path.startswith(PAGES_PREFIX + "/"):
        return path[len(PAGES_PREFIX) :] or "/"
    return path


def is_invite_landing_path(url_path: str) -> bool:
    rest = site_path(url_path)
    return rest == "/j" or rest.startswith("/j/")


def invite_token_from_path(url_path: str) -> str | None:
    rest = site_path(url_path)
    match = re.fullmatch(r"/j/([^/]+)/?", rest)
    if not match:
        return None
    token = unquote(match.group(1))
    if not _TOKEN_RE.fullmatch(token):
        return None
    return token
