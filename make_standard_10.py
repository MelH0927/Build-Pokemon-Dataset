import os, json, random, re
from pathlib import Path
from io import BytesIO
from datasets import load_dataset
from PIL import Image as PILImage

# --- CONFIG ---
TOKEN = os.environ.get("HF_TOKEN")  # read from environment; never hardcode
REPO  = "andyqmongo/pokemon-newer-dataset"   # e.g. "sherid/pokemon-types"
SPLIT = "train"
HERE      = Path(__file__).resolve().parent
OUT_JSONL = HERE / "pokemon-quiz/public/standard_all.jsonl"
OUT_DIR   = HERE / "pokemon-quiz/public/quiz_images_all"
NUM       = None  # Set to None to include all standard images

def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def to_pil(img):
    """Accept PIL.Image, dict({'path'|'bytes'}), or bytes → return PIL.Image"""
    if isinstance(img, PILImage.Image):
        return img
    if isinstance(img, dict):
        if img.get("bytes") is not None:
            return PILImage.open(BytesIO(img["bytes"]))
        if img.get("path"):
            return PILImage.open(img["path"])
    if isinstance(img, (bytes, bytearray)):
        return PILImage.open(BytesIO(img))
    raise TypeError(f"Unsupported image type: {type(img)}")

def norm_type(x):
    if x is None:
        return None
    s = str(x).strip().lower()
    return None if s in {"", "none", "null", "n/a"} else s

# Load private dataset with token
ds = load_dataset(REPO, split=SPLIT, token=TOKEN)

# Keep only art_style == "standard"
std = ds.filter(lambda ex: str(ex["art_style"]).strip().lower() == "standard")

# Use all standard images or limit to NUM if specified
if NUM is None:
    subset = std
else:
    # Pick up to NUM at random
    idxs = list(range(len(std)))
    random.shuffle(idxs)
    idxs = idxs[: min(NUM, len(idxs))]
    subset = std.select(idxs)

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_JSONL.parent.mkdir(parents=True, exist_ok=True)

with OUT_JSONL.open("w", encoding="utf-8") as f:
    for i, ex in enumerate(subset):
        name = ex.get("name", f"pkm_{i}")
        # Convert and save image locally
        pil = to_pil(ex["image"]).convert("RGBA")
        fname = f"{slugify(name) or 'pkm'}-{i:03d}.png"
        pil.save(OUT_DIR / fname, format="PNG")

        rec = {
            "image": f"/quiz_images_all/{fname}",  # <-- local path for the web app
            "primary_type": norm_type(ex.get("primary_type")),
            "secondary_type": norm_type(ex.get("secondary_type")),
            "art_style": "standard",
            "name": name,
            "paradox_or_ultrabeast": ex.get("paradox_or_ultrabeast", None),
        }
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

print(f"Wrote {OUT_JSONL} and {len(list(OUT_DIR.iterdir()))} images.")
