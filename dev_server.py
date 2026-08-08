"""Local development server.

Serves the static frontend and routes /api/generate to the same QR logic
used by the Vercel serverless function. Run with:

    uv run dev_server.py
"""
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from api.generate import MAX_BODY_BYTES, generate_qr

PORT = 3000


class DevHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/generate":
            super().do_GET()
            return
        query = parse_qs(parsed.query)
        self._api({k: v[0] for k, v in query.items()})

    def do_POST(self):
        if urlparse(self.path).path != "/api/generate":
            self._send_json(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            self._send_json(400, {"error": "Missing request body"})
            return
        if length > MAX_BODY_BYTES:
            self._send_json(413, {"error": "Request body too large"})
            return
        try:
            params = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            self._send_json(400, {"error": "Request body must be valid JSON"})
            return
        if not isinstance(params, dict):
            self._send_json(400, {"error": "Request body must be a JSON object"})
            return
        self._api(params)

    def _api(self, params):
        try:
            body, content_type = generate_qr(params)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

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
