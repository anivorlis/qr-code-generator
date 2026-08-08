import base64
import io
import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import segno

HEX_COLOR = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
ERROR_LEVELS = {"l", "m", "q", "h"}
MAX_DATA_LEN = 2000
MAX_LOGO_B64_LEN = 2_000_000  # ~1.5 MB decoded
MAX_BODY_BYTES = 3_000_000


def generate_qr(params):
    """Generate a QR code from a dict of string parameters.

    Returns (body_bytes, content_type). Raises ValueError on bad input.
    """
    data = str(params.get("data") or params.get("url") or "").strip()
    if not data:
        raise ValueError("Missing 'data' parameter")
    if len(data) > MAX_DATA_LEN:
        raise ValueError(f"Data is too long (max {MAX_DATA_LEN} characters)")

    dark = str(params.get("dark") or "#000000")
    light = str(params.get("light") or "#ffffff")
    if not HEX_COLOR.match(dark) or not HEX_COLOR.match(light):
        raise ValueError("Colors must be hex values like #000 or #1a2b3c")

    try:
        scale = max(1, min(int(params.get("scale") or 10), 40))
        border = max(0, min(int(params.get("border") or 4), 20))
    except (TypeError, ValueError):
        raise ValueError("'scale' and 'border' must be integers")

    error = str(params.get("error") or "m").lower()
    if error not in ERROR_LEVELS:
        raise ValueError("'error' must be one of: l, m, q, h")

    fmt = str(params.get("format") or "png").lower()
    if fmt not in ("png", "svg"):
        raise ValueError("'format' must be 'png' or 'svg'")

    logo_b64 = params.get("logo") or None
    if logo_b64:
        if fmt == "svg":
            raise ValueError("Logo overlay is only supported for PNG output")
        if len(logo_b64) > MAX_LOGO_B64_LEN:
            raise ValueError("Logo image is too large (max ~1.5 MB)")
        # A logo covers part of the code, so use the highest error correction.
        error = "h"

    qr = segno.make(data, error=error)
    buf = io.BytesIO()

    if fmt == "svg":
        qr.save(buf, kind="svg", dark=dark, light=light, scale=scale, border=border)
        return buf.getvalue(), "image/svg+xml"

    qr.save(buf, kind="png", dark=dark, light=light, scale=scale, border=border)
    png = buf.getvalue()
    if logo_b64:
        png = _overlay_logo(png, logo_b64, light)
    return png, "image/png"


def _overlay_logo(png, logo_b64, light):
    """Paste a logo (base64 image, optionally a data URL) onto the QR center."""
    from PIL import Image  # deferred: only needed when a logo is supplied

    if logo_b64.lstrip().startswith("data:"):
        logo_b64 = logo_b64.split(",", 1)[-1]
    try:
        raw = base64.b64decode(logo_b64, validate=True)
        logo = Image.open(io.BytesIO(raw))
        logo.load()
    except Exception:
        raise ValueError("Logo must be a valid base64-encoded image")

    logo = logo.convert("RGBA")
    img = Image.open(io.BytesIO(png)).convert("RGB")

    target = max(1, img.width // 4)
    logo.thumbnail((target, target))

    pad = max(6, img.width // 40)
    box = Image.new("RGB", (logo.width + 2 * pad, logo.height + 2 * pad), light)
    box.paste(logo, (pad, pad), logo)
    img.paste(box, ((img.width - box.width) // 2, (img.height - box.height) // 2))

    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        self._respond({k: v[0] for k, v in query.items()})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            self._send_error(400, "Missing request body")
            return
        if length > MAX_BODY_BYTES:
            self._send_error(413, "Request body too large")
            return
        try:
            params = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            self._send_error(400, "Request body must be valid JSON")
            return
        if not isinstance(params, dict):
            self._send_error(400, "Request body must be a JSON object")
            return
        self._respond(params)

    def _respond(self, params):
        try:
            body, content_type = generate_qr(params)
        except ValueError as exc:
            self._send_error(400, str(exc))
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, status, message):
        body = json.dumps({"error": message}).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
