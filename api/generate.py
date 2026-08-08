import io
import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import segno

HEX_COLOR = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def make_qr_png(data, dark="#000000", light="#ffffff", scale=10, border=4):
    """Generate a QR code PNG for the given data. Returns raw PNG bytes."""
    if not HEX_COLOR.match(dark) or not HEX_COLOR.match(light):
        raise ValueError("Colors must be hex values like #000 or #1a2b3c")
    scale = max(1, min(int(scale), 40))
    border = max(0, min(int(border), 20))

    qr = segno.make(data, error="m")
    buf = io.BytesIO()
    qr.save(buf, kind="png", dark=dark, light=light, scale=scale, border=border)
    return buf.getvalue()


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)

        def param(name, default):
            return params.get(name, [default])[0]

        data = param("url", "").strip()
        if not data:
            self._send_error(400, "Missing 'url' query parameter")
            return
        if len(data) > 2000:
            self._send_error(400, "URL is too long (max 2000 characters)")
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
            self._send_error(400, str(exc))
            return

        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", str(len(png)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(png)

    def _send_error(self, status, message):
        body = json.dumps({"error": message}).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
