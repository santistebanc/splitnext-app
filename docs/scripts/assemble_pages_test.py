import tempfile
import unittest
from pathlib import Path

from assemble_pages import assemble

ROOT = Path(__file__).resolve().parents[2]


class AssemblePages(unittest.TestCase):
    def test_production_root_is_the_landing_not_the_board(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "site"
            assemble(out)
            self.assertTrue((out / "index.html").exists())
            html = (out / "index.html").read_text(encoding="utf-8")
            self.assertIn("Use on web", html)
            self.assertNotIn("Slicer board", html)
            self.assertFalse((out / "slicer.html").exists())
            self.assertFalse((out / "state").exists())
            self.assertTrue((out / "try" / "index.html").exists())
            self.assertTrue((out / ".nojekyll").exists())

    def test_app_export_lands_under_app(self):
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp) / "dist"
            dist.mkdir()
            (dist / "index.html").write_text("<html>app</html>", encoding="utf-8")
            out = Path(tmp) / "site"
            assemble(out, app=dist)
            self.assertEqual((out / "app" / "index.html").read_text(encoding="utf-8"), "<html>app</html>")
            self.assertEqual((out / "app" / "404.html").read_text(encoding="utf-8"), "<html>app</html>")
            self.assertIn("Use on web", (out / "index.html").read_text(encoding="utf-8"))


class PagesWorkflow(unittest.TestCase):
    def test_pages_workflow_does_not_publish_the_board(self):
        yml = (ROOT / ".github/workflows/pages.yml").read_text(encoding="utf-8")
        self.assertIn("assemble_pages.py", yml)
        self.assertNotIn("generate-slicer-board.py", yml)
        self.assertNotIn("slicer.html", yml)
        self.assertNotIn("cp -r docs", yml)


if __name__ == "__main__":
    unittest.main()
