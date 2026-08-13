"""Seam tests for the PR comment's phone QR.

The comment must give a camera-scannable code of the published web app, not a
Metro `exp://` URL — a GitHub PR cannot keep a bundler running.

Run: `npm run test:board`
"""

from pathlib import Path
import unittest

from pr_phone import APP_URL, QR_PATH, phone_section, qr_image_url


class PhoneSection(unittest.TestCase):
    def test_qr_points_at_the_committed_png_on_this_commit(self):
        src = qr_image_url(
            "santistebanc/splitnext-app",
            "abc123",
        )
        self.assertEqual(
            src,
            "https://raw.githubusercontent.com/santistebanc/splitnext-app"
            "/abc123/docs/scripts/phone-app-qr.png",
        )

    def test_section_is_a_scannable_link_to_the_published_app(self):
        text = phone_section(
            repo="santistebanc/splitnext-app",
            sha="abc123",
        )
        self.assertIn("## Phone", text)
        self.assertIn(APP_URL, text)
        self.assertIn(
            "https://raw.githubusercontent.com/santistebanc/splitnext-app"
            "/abc123/docs/scripts/phone-app-qr.png",
            text,
        )
        self.assertIn(f"]({APP_URL})", text)
        self.assertIn("Camera", text)
        self.assertNotIn("exp://", text)

    def test_the_png_is_in_the_repo_or_the_comment_404s(self):
        png = Path(__file__).resolve().parents[2] / QR_PATH
        self.assertTrue(png.is_file(), QR_PATH)
        self.assertGreater(png.stat().st_size, 200)
