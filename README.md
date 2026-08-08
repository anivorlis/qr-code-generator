# QR Code Generator

A small web app that turns URLs, Wi-Fi credentials, contacts, and more into
QR codes. Static HTML/CSS/JS frontend, Python serverless backend, deployable
on [Vercel](https://vercel.com).

## Features

- **Content types:** URL, plain text, Wi-Fi network, email, contact (vCard)
- **Output formats:** PNG or SVG
- **Customization** (gear icon): foreground/background color, size, border,
  error correction level (L/M/Q/H), optional center logo
- **Copy** the QR code to the clipboard, **Download** it, or **Copy link** —
  a shareable URL that regenerates the same code
- Warns when the chosen colors are low-contrast or inverted (hard to scan)

Dependencies: [segno](https://pypi.org/project/segno/) (pure-Python QR
encoding) and [Pillow](https://pypi.org/project/pillow/) (only used for the
logo overlay). The frontend is vanilla HTML/CSS/JS — no frameworks, no build
step.

## Project structure

```
├── index.html        # Frontend page
├── style.css         # Styles
├── app.js            # Frontend logic (builds payloads, calls /api/generate)
├── api/
│   └── generate.py   # Vercel serverless function (QR generation)
├── dev_server.py     # Local dev server (stdlib only)
└── pyproject.toml    # Project metadata + dependencies
```

## Run locally

Requires [uv](https://docs.astral.sh/uv/getting-started/installation/) — it
fetches a compatible Python and installs the dependencies automatically:

```bash
uv run dev_server.py
```

Then open <http://localhost:3000> in your browser.

The dev server serves the static files and routes `/api/generate` to the same
QR logic used by the Vercel function, so local behavior matches production.

<details>
<summary>Without uv (plain pip)</summary>

```bash
python3 -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install segno==1.6.6 pillow
python dev_server.py
```

</details>

## Deploy on Vercel

1. Push this repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Set **Framework Preset** to **Other**, keep the rest default, and click
   **Deploy**.

Vercel serves the static files from the repository root and turns
`api/generate.py` into a serverless function at `/api/generate`, installing
the dependencies declared in `pyproject.toml`.

> **Important:** do not add a `[tool.vercel] entrypoint` section to
> `pyproject.toml`. That tells Vercel to treat the repo as a single Python
> *application* and routes **every** path (including `/`) to the function —
> which means visitors see a JSON error instead of the page. Without it,
> Vercel serves `index.html` at `/` and the function at `/api/generate`.

## API

`/api/generate` returns a PNG or SVG image. Parameters can be sent as query
strings (`GET`) or as a JSON body (`POST`). The frontend uses `POST`; the
**Copy link** button produces `GET` URLs.

| Parameter | Default   | Description                                    |
|-----------|-----------|------------------------------------------------|
| `data`    | required  | Text to encode, max 2000 chars (`url` also accepted) |
| `dark`    | `#000000` | Foreground color (hex)                         |
| `light`   | `#ffffff` | Background color (hex)                         |
| `scale`   | `10`      | Pixels per QR module (1–40)                    |
| `border`  | `4`       | Quiet-zone width in modules (0–20)             |
| `error`   | `m`       | Error correction level: `l`, `m`, `q`, or `h`  |
| `format`  | `png`     | Output format: `png` or `svg`                  |
| `logo`    | —         | Base64/data-URL image overlaid on the center (POST only, PNG only; forces `error=h`) |

Examples:

```bash
curl "http://localhost:3000/api/generate?data=https://example.com&dark=%231a3d8f&scale=8" -o qr.png
```

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"data": "https://example.com", "format": "svg"}' -o qr.svg
```
