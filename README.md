# QR Code Generator

A small web app that turns a URL into a QR code. Static HTML/CSS/JS frontend,
Python serverless backend, deployable on [Vercel](https://vercel.com).

## Features

- Enter a URL, press **Generate**, get a QR code (PNG)
- Settings popup (gear icon): foreground color, background color, size, border
- **Copy** the QR code to the clipboard or **Download** it as a PNG

The only dependency is [segno](https://pypi.org/project/segno/), a pure-Python
QR code library with no dependencies of its own. The frontend is vanilla
HTML/CSS/JS — no frameworks, no build step.

## Project structure

```
├── index.html        # Frontend page
├── style.css         # Styles
├── app.js            # Frontend logic (fetches /api/generate)
├── api/
│   └── generate.py   # Vercel serverless function (QR generation)
├── dev_server.py     # Local dev server (stdlib only)
└── pyproject.toml    # Project metadata + dependencies (segno)
```

## Run locally

Requires [uv](https://docs.astral.sh/uv/getting-started/installation/) — it
fetches a compatible Python and installs the dependency automatically:

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
pip install segno==1.6.6
python dev_server.py
```

</details>

Alternatively, if you have the [Vercel CLI](https://vercel.com/docs/cli)
installed, `vercel dev` runs the app exactly as it runs in production.

## Deploy on Vercel

1. Push this repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Keep the default settings (no build command needed) and click **Deploy**.

Vercel serves the static files from the repository root and automatically
turns `api/generate.py` into a serverless function at `/api/generate`,
installing the dependencies declared in `pyproject.toml`.

## API

`GET /api/generate` returns a PNG image.

| Query param | Default   | Description                          |
|-------------|-----------|--------------------------------------|
| `url`       | required  | Text/URL to encode (max 2000 chars)  |
| `dark`      | `#000000` | Foreground color (hex)               |
| `light`     | `#ffffff` | Background color (hex)               |
| `scale`     | `10`      | Pixels per QR module (1–40)          |
| `border`    | `4`       | Quiet-zone width in modules (0–20)   |

Example:

```bash
curl "http://localhost:3000/api/generate?url=https://example.com&dark=%231a3d8f&scale=8" -o qr.png
```
