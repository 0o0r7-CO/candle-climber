#!/usr/bin/env python3
"""Render ART_PROMPTS_V2 prompts via NVIDIA NIM image models (zero-cost owner plan).

Usage:
  NIM_KEY=nvapi-... python3 scripts/render_nim.py P1 p1.png [1024x1024] [flux|sd35] [seed]

Key resolution: env NIM_KEY, else /home/z/my-project/.nim_key (chmod 600, gitignored).
Prompts are parsed live from docs/ART_PROMPTS_V2.md (sections "### P1 —" etc.),
so the doc stays the single source of truth.
"""
import sys, os, json, base64, urllib.request, urllib.error, re, pathlib

DOC = pathlib.Path("/home/z/my-project/docs/ART_PROMPTS_V2.md")
ENDPOINTS = {
    "flux": "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev",
    "sd35": "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3.5-large",
}

def load_key() -> str:
    k = os.environ.get("NIM_KEY", "").strip()
    if k:
        return k
    f = pathlib.Path("/home/z/my-project/.nim_key")
    if f.exists():
        k = f.read_text().strip()
        if k:
            return k
    sys.exit("NO KEY: set NIM_KEY env or write it to /home/z/my-project/.nim_key")

def prompt_for(tag: str) -> str:
    text = DOC.read_text()
    m = re.search(rf"### {re.escape(tag)}\b.*?```\n(.*?)```", text, re.S)
    if not m:
        sys.exit(f"prompt '{tag}' not found in {DOC}")
    return " ".join(m.group(1).split())

def render(tag: str, out: str, size: str, model: str, seed: int) -> None:
    w, h = (int(x) for x in size.lower().split("x"))
    body = {
        "mode": "base",
        "prompt": prompt_for(tag),
        "cfg_scale": 3.5,
        "width": w,
        "height": h,
        "seed": seed,
    }
    req = urllib.request.Request(
        ENDPOINTS[model],
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {load_key()}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=240) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read()[:300].decode(errors='replace')}")
    b64 = data["artifacts"][0]["base64"]
    pathlib.Path(out).write_bytes(base64.b64decode(b64))
    print(f"OK {tag} -> {out} ({len(b64) // 1024} KB b64) seed={seed}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    render(
        sys.argv[1],
        sys.argv[2],
        sys.argv[3] if len(sys.argv) > 3 else "1024x1024",
        sys.argv[4] if len(sys.argv) > 4 else "flux",
        int(sys.argv[5]) if len(sys.argv) > 5 else 0,
    )
