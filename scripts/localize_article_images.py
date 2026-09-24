"""
Downloads GitHub-hosted images referenced by generated articles, optimizes them
to WebP and rewrites the <img> tags to point at the local copies.

Images are cached by source URL in a manifest, so repeated builds do not
download anything unless --refresh is passed. File names include a hash of the
source bytes, so an image only changes in git when it changes upstream.
"""

import argparse
import hashlib
import html
import io
import json
import logging
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, Optional
from urllib.parse import urlparse

import requests
from PIL import Image, ImageOps, ImageSequence
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

SCRIPT_DIR = Path(__file__).resolve().parent
HTML_DIRS = [SCRIPT_DIR / "../src/articles"]
IMAGES_DIR = SCRIPT_DIR / "../src/resources/article-images"
MANIFEST_FILE = SCRIPT_DIR / "article_images_manifest.json"

GITHUB_HOSTS = {
    "raw.githubusercontent.com",
    "github.com",
    "user-images.githubusercontent.com",
    "private-user-images.githubusercontent.com",
    "objects.githubusercontent.com",
}

EXCLUDED_URL_PARTS = ("/djeada/Personal-Website/",)

MAX_WIDTH = 960
LOSSY_QUALITY = 78
ANIMATED_QUALITY = 70

LOSSLESS_TOLERANCE = 1.05
MAX_SOURCE_BYTES = 25_000_000
WORKERS = 8

IMG_TAG_PATTERN = re.compile(r"<img\b[^>]*>", re.IGNORECASE)
SRC_PATTERN = re.compile(r'\ssrc="([^"]*)"', re.IGNORECASE)


def make_session() -> requests.Session:
    retry = Retry(
        total=4,
        backoff_factor=1.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=retry, pool_maxsize=WORKERS))
    session.headers["User-Agent"] = "adamdjellouli.com article image localizer"
    return session


def is_github_image(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or parsed.netloc not in GITHUB_HOSTS:
        return False
    return not any(part in url for part in EXCLUDED_URL_PARTS)


def download_url(url: str) -> str:
    """Maps GitHub web URLs to their raw file equivalents."""
    parsed = urlparse(url)
    if parsed.netloc == "github.com" and "/blob/" in parsed.path:
        return url.replace(
            "https://github.com", "https://raw.githubusercontent.com", 1
        ).replace("/blob/", "/", 1)
    return url


def output_stem(url: str, data: bytes) -> str:
    stem = Path(urlparse(url).path).stem or "image"
    stem = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")[:60] or "image"
    return f"{stem}-{hashlib.sha256(data).hexdigest()[:10]}"


def fit_size(size: tuple[int, int]) -> tuple[int, int]:
    width, height = size
    if width <= MAX_WIDTH:
        return width, height
    return MAX_WIDTH, max(1, round(height * MAX_WIDTH / width))


def normalize_mode(image: Image.Image) -> Image.Image:
    has_alpha = image.mode in ("RGBA", "LA", "PA") or (
        image.mode == "P" and "transparency" in image.info
    )
    return image.convert("RGBA" if has_alpha else "RGB")


def encode_still(image: Image.Image) -> bytes:
    image = normalize_mode(ImageOps.exif_transpose(image))
    size = fit_size(image.size)
    if size != image.size:
        image = image.resize(size, Image.LANCZOS)

    lossy = io.BytesIO()
    image.save(lossy, "WEBP", quality=LOSSY_QUALITY, method=6)
    lossless = io.BytesIO()
    image.save(lossless, "WEBP", lossless=True, quality=100, method=5)

    if lossless.tell() <= lossy.tell() * LOSSLESS_TOLERANCE:
        return lossless.getvalue()
    return lossy.getvalue()


def encode_animated(image: Image.Image) -> bytes:
    size = fit_size(image.size)
    frames, durations = [], []
    for frame in ImageSequence.Iterator(image):
        frame = frame.convert("RGBA")
        if size != frame.size:
            frame = frame.resize(size, Image.LANCZOS)
        frames.append(frame)
        durations.append(frame.info.get("duration", image.info.get("duration", 100)))

    output = io.BytesIO()
    frames[0].save(
        output,
        "WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=image.info.get("loop", 0),
        quality=ANIMATED_QUALITY,
        method=6,
    )
    return output.getvalue()


def localize(url: str, session: requests.Session) -> Optional[dict]:
    """Downloads and optimizes one image. Returns a manifest entry or None."""
    try:
        response = session.get(download_url(url), timeout=60)
        response.raise_for_status()
        data = response.content
    except requests.RequestException as exc:
        logging.error(f"Download failed for {url}: {exc}")
        return None

    if len(data) > MAX_SOURCE_BYTES:
        logging.error(f"Skipping {url}: {len(data)} bytes is over the limit")
        return None

    stem = output_stem(url, data)
    head = data[:512].lstrip().lower()
    if head.startswith(b"<svg") or (head.startswith(b"<?xml") and b"<svg" in head):
        encoded, extension, width, height = data, "svg", None, None
    else:
        try:
            image = Image.open(io.BytesIO(data))
            image.load()
        except Exception:
            logging.warning(f"Skipping {url}: not an image")
            return None
        if getattr(image, "is_animated", False):
            encoded = encode_animated(image)
        else:
            encoded = encode_still(image)
        extension = "webp"
        width, height = fit_size(image.size)

    filename = f"{stem}.{extension}"
    (IMAGES_DIR / filename).write_bytes(encoded)
    logging.info(
        f"{url} -> {filename} ({len(data) // 1024} KB -> {len(encoded) // 1024} KB)"
    )
    return {
        "file": filename,
        "width": width,
        "height": height,
        "source_bytes": len(data),
        "bytes": len(encoded),
    }


def set_attribute(tag: str, name: str, value: str) -> str:
    if re.search(rf"\s{name}=", tag, re.IGNORECASE):
        return tag
    self_closing = tag.endswith("/>")
    body = tag[: -2 if self_closing else -1].rstrip()
    return f'{body} {name}="{value}"' + (" />" if self_closing else ">")


def rewrite_html(path: Path, manifest: Dict[str, dict]) -> bool:
    text = path.read_text()
    relative_dir = os.path.relpath(IMAGES_DIR.resolve(), path.parent.resolve())

    def replace_tag(match: re.Match) -> str:
        tag = match.group(0)
        src_match = SRC_PATTERN.search(tag)
        if not src_match:
            return tag
        entry = manifest.get(html.unescape(src_match.group(1)))
        if not entry:
            return tag
        local_src = f"{relative_dir}/{entry['file']}".replace(os.sep, "/")
        tag = tag[: src_match.start(1)] + local_src + tag[src_match.end(1) :]
        if entry.get("width") and entry.get("height"):
            width, height = entry["width"], entry["height"]
            author_width = re.search(r'\swidth="(\d+)"', tag, re.IGNORECASE)
            if author_width and not re.search(r"\sheight=", tag, re.IGNORECASE):
                width = int(author_width.group(1))
                height = round(width * entry["height"] / entry["width"])
            tag = set_attribute(tag, "width", str(width))
            tag = set_attribute(tag, "height", str(height))
        tag = set_attribute(tag, "loading", "lazy")
        return set_attribute(tag, "decoding", "async")

    new_text = IMG_TAG_PATTERN.sub(replace_tag, text)
    if new_text != text:
        path.write_text(new_text)
        return True
    return False


def find_html_files() -> list[Path]:
    return sorted(p for d in HTML_DIRS if d.exists() for p in d.rglob("*.html"))


def collect_sources(html_files: list[Path]) -> tuple[set[str], set[str]]:
    """Returns remote GitHub image URLs and already-local file names in use."""
    remote, local = set(), set()
    for path in html_files:
        for tag in IMG_TAG_PATTERN.findall(path.read_text()):
            src_match = SRC_PATTERN.search(tag)
            if not src_match:
                continue
            src = html.unescape(src_match.group(1))
            if is_github_image(src):
                remote.add(src)
            elif "article-images/" in src:
                local.add(src.rsplit("/", 1)[-1])
    return remote, local


def load_manifest() -> Dict[str, dict]:
    if MANIFEST_FILE.exists():
        return json.loads(MANIFEST_FILE.read_text())
    return {}


def main(refresh: bool = False, prune: bool = True) -> int:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    html_files = find_html_files()
    remote, local_in_use = collect_sources(html_files)
    manifest = load_manifest()

    to_fetch = sorted(
        url
        for url in remote
        if refresh
        or url not in manifest
        or not (IMAGES_DIR / manifest[url]["file"]).exists()
    )
    logging.info(
        f"{len(remote)} GitHub images referenced, {len(remote) - len(to_fetch)} cached, "
        f"{len(to_fetch)} to download"
    )

    session = make_session()
    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        results = executor.map(lambda url: localize(url, session), to_fetch)
        failed = []
        for url, entry in zip(to_fetch, results):
            if entry:
                manifest[url] = entry
            else:
                failed.append(url)

    rewritten = sum(rewrite_html(path, manifest) for path in html_files)
    logging.info(f"Rewrote image sources in {rewritten} HTML files")

    in_use = local_in_use | {manifest[url]["file"] for url in remote if url in manifest}
    if prune:
        for file in IMAGES_DIR.iterdir():
            if file.is_file() and file.name not in in_use:
                file.unlink()
                logging.info(f"Removed unused image: {file.name}")
        manifest = {url: e for url, e in manifest.items() if e["file"] in in_use}

    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")

    in_use_entries = [e for e in manifest.values() if e["file"] in in_use]
    source_total = sum(e["source_bytes"] for e in in_use_entries)
    output_total = sum(e["bytes"] for e in in_use_entries)
    logging.info(
        f"{len(in_use_entries)} local images: {source_total / 1e6:.1f} MB at source, "
        f"{output_total / 1e6:.1f} MB optimized"
    )

    if failed:
        logging.warning(
            f"{len(failed)} images still point at GitHub:\n" + "\n".join(failed)
        )
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Re-download every image, even if it is cached in the manifest.",
    )
    parser.add_argument(
        "--no-prune",
        action="store_true",
        help="Keep local images that no article references anymore.",
    )
    args = parser.parse_args()
    sys.exit(main(refresh=args.refresh, prune=not args.no_prune))
