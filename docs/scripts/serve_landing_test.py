import unittest
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

from serve_landing import handler_for, metro_path_for, prepare_metro_html, rewrite_root_urls


class MetroPath(unittest.TestCase):
    def test_app_prefix_maps_to_metro_root(self):
        self.assertEqual(metro_path_for("/app"), "/")
        self.assertEqual(metro_path_for("/app/"), "/")
        self.assertEqual(metro_path_for("/app/node_modules/x"), "/node_modules/x")

    def test_landing_paths_are_not_proxied(self):
        self.assertIsNone(metro_path_for("/"))
        self.assertIsNone(metro_path_for("/try/"))
        self.assertIsNone(metro_path_for("/styles.css"))

    def test_other_paths_proxy_so_absolute_bundle_urls_work(self):
        self.assertEqual(metro_path_for("/node_modules/expo-router/entry.bundle"), "/node_modules/expo-router/entry.bundle")
        self.assertEqual(metro_path_for("/create"), "/create")


class RewriteRootUrls(unittest.TestCase):
    def test_bundle_script_stays_under_the_app_prefix(self):
        html = '<script src="/node_modules/expo-router/entry.bundle"></script>'
        self.assertIn(
            'src="/app/node_modules/expo-router/entry.bundle"',
            rewrite_root_urls(html),
        )

    def test_proxied_html_makes_expo_router_see_the_lobby_path(self):
        html = prepare_metro_html("<head></head><script src=\"/x.js\"></script>")
        self.assertIn("history.replaceState", html)
        self.assertIn('src="/app/x.js"', html)


class ServeTry(unittest.TestCase):
    def test_try_page_frames_same_origin_app(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for("http://127.0.0.1:9/"))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            port = server.server_address[1]
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/try/") as res:
                html = res.read().decode()
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/") as res:
                home = res.read().decode()
        finally:
            server.shutdown()
            server.server_close()
        self.assertIn("../app/", html)
        self.assertNotIn("127.0.0.1:8081", html)
        self.assertIn("Use on web", home)

    def test_app_prefix_proxies_metro_html(self):
        class Metro(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                body = b'<html><script src="/node_modules/x.js"></script>lobby</html>'
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args) -> None:
                pass

        metro = ThreadingHTTPServer(("127.0.0.1", 0), Metro)
        Thread(target=metro.serve_forever, daemon=True).start()
        metro_origin = f"http://127.0.0.1:{metro.server_address[1]}/"
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(metro_origin))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            port = server.server_address[1]
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/app/") as res:
                html = res.read().decode()
        finally:
            server.shutdown()
            server.server_close()
            metro.shutdown()
            metro.server_close()
        self.assertIn("lobby", html)
        self.assertIn('src="/app/node_modules/x.js"', html)
        self.assertIn("history.replaceState", html)


if __name__ == "__main__":
    unittest.main()
