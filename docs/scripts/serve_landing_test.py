import unittest
import urllib.request
from http.server import ThreadingHTTPServer
from threading import Thread

from serve_landing import handler_for, inject_app_origin


class InjectAppOrigin(unittest.TestCase):
    def test_production_html_is_unchanged_without_an_origin(self):
        html = "<head>\n<title>x</title>\n</head>"
        self.assertEqual(inject_app_origin(html, None), html)

    def test_local_serve_points_the_frame_at_metro(self):
        html = "<head>\n<title>x</title>\n</head>"
        out = inject_app_origin(html, "http://127.0.0.1:8081")
        self.assertIn('window.SPLITNEXT_APP="http://127.0.0.1:8081/"', out)
        self.assertTrue(out.startswith("<head>"))

    def test_assembled_try_page_has_no_metro_injection(self):
        from pathlib import Path

        try_html = Path(__file__).resolve().parents[2].joinpath(
            "landing/try/index.html"
        ).read_text(encoding="utf-8")
        self.assertNotIn('window.SPLITNEXT_APP="http://', try_html)
        self.assertIn("../app/", try_html)


class ServeTry(unittest.TestCase):
    def test_try_page_injects_metro_origin(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for("http://127.0.0.1:8081/"))
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            port = server.server_address[1]
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/try/") as res:
                html = res.read().decode()
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/") as res:
                home = res.read().decode()
        finally:
            server.shutdown()
        self.assertIn('window.SPLITNEXT_APP="http://127.0.0.1:8081/"', html)
        self.assertIn("Use on web", home)
        self.assertNotIn("SPLITNEXT_APP", home)


if __name__ == "__main__":
    unittest.main()
