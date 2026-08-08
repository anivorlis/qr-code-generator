# /// script
# requires-python = ">=3.9"
# dependencies = ["segno==1.6.6"]
# ///
"""Local development server.

Serves the static frontend and routes /api/generate to the same QR logic
used by the Vercel serverless function. Run with:

    uv run dev_server.py
"""
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from api.generate import make_qr_png

PORT = 3000


class DevHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/generate":
            super().do_GET()
            return

        params = parse_qs(parsed.query)

        def param(name, default):
            return params.get(name, [default])[0]

        data = param("url", "").strip()
        if not data:
            self._send_json(400, {"error": "Missing 'url' query parameter"})
            return
        if len(data) > 2000:
            self._send_json(400, {"error": "URL is too long (max 2000 characters)"})
            return

        try:
            png = make_qr_png(
                data,
                dark=param("dark", "#000000"),
                light=param("light", "#ffffff"),
                scale=param("scale", "10"),
                border=param("border", "4"),
            )
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return

        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", str(len(png)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(png)

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), DevHandler)
    print(f"Serving on http://localhost:{PORT}")
    server.serve_forever()
