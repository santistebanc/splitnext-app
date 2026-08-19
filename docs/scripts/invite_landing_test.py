import unittest
from pathlib import Path

from invite_landing import invite_token_from_path, is_invite_landing_path


class InvitePathDetect(unittest.TestCase):
    def test_join_path_is_an_invite(self):
        self.assertTrue(is_invite_landing_path("/j/xK3mP9qL2nQ"))
        self.assertTrue(is_invite_landing_path("/j/xK3mP9qL2nQ/"))
        self.assertTrue(is_invite_landing_path("/splitnext-app/j/xK3mP9qL2nQ"))

    def test_expo_join_path_is_not_the_landing_invite(self):
        self.assertFalse(is_invite_landing_path("/app/j/xK3mP9qL2nQ"))
        self.assertFalse(is_invite_landing_path("/splitnext-app/app/j/xK3mP9qL2nQ"))

    def test_other_unknown_paths_are_not_invites(self):
        self.assertFalse(is_invite_landing_path("/no-such-page"))
        self.assertFalse(is_invite_landing_path("/try/"))
        self.assertFalse(is_invite_landing_path("/"))


class InviteTokenExtract(unittest.TestCase):
    def test_pulls_an_11_char_secret(self):
        self.assertEqual(invite_token_from_path("/j/xK3mP9qL2nQ"), "xK3mP9qL2nQ")
        self.assertEqual(
            invite_token_from_path("/splitnext-app/j/xK3mP9qL2nQ"),
            "xK3mP9qL2nQ",
        )
        self.assertEqual(
            invite_token_from_path("/j/xK3mP9qL2nQ?utm=1"),
            "xK3mP9qL2nQ",
        )

    def test_missing_or_short_token_is_not_an_invite_secret(self):
        self.assertIsNone(invite_token_from_path("/j/"))
        self.assertIsNone(invite_token_from_path("/j/ab"))
        self.assertIsNone(invite_token_from_path("/j/not-a-token!!"))
        self.assertIsNone(invite_token_from_path("/no-such-page"))


class InviteLandingHtml(unittest.TestCase):
    def test_404_page_mirrors_the_token_shape_and_has_no_store_links(self):
        html = (Path(__file__).resolve().parents[2] / "landing" / "404.html").read_text(
            encoding="utf-8"
        )
        self.assertIn(r"[A-Za-z0-9_-]{11}", html)
        self.assertIn("You've been invited", html)
        self.assertIn("Page not found", html)
        self.assertNotIn("play.google.com", html.lower())
        self.assertNotIn("apps.apple.com", html.lower())


if __name__ == "__main__":
    unittest.main()
