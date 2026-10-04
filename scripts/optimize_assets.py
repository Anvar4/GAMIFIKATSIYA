"""Higgsfield'da yaratilgan PNG rasmlarni veb uchun optimallashtiradi (WebP, mos oʻlcham).

Manba:   assets-src/   (git'ga kiritilmaydi)
Natija:  public/assets/{ships,bg,rounds,devices,brand}/

Ishga tushirish:  python scripts/optimize_assets.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src"
OUT = ROOT / "public" / "assets"

JOBS = [
    # (manba, natija, maksimal kenglik, sifat)
    ("ship_falcon.png", "ships/falcon.webp", 900, 86),
    ("ship_phoenix.png", "ships/phoenix.webp", 900, 86),
    ("ship_nova.png", "ships/nova.webp", 900, 86),
    ("ship_titan.png", "ships/titan.webp", 900, 86),
    ("boss.png", "ships/boss.webp", 1000, 84),
    ("bg_arena.png", "bg/arena.webp", 1920, 80),
    ("bg_intro.png", "bg/intro.webp", 1920, 80),
    ("round1.png", "rounds/round1.webp", 1280, 78),
    ("round2.png", "rounds/round2.webp", 1280, 78),
    ("round3.png", "rounds/round3.webp", 1280, 78),
    ("round4.png", "rounds/round4.webp", 1280, 78),
    ("round5.png", "rounds/round5.webp", 1280, 78),
    ("emblem.png", "brand/emblem.webp", 512, 88),
    ("trophy.png", "brand/trophy.webp", 640, 86),
]


def save_webp(src: Path, dst: Path, max_w: int, quality: int) -> None:
    im = Image.open(src)
    im.load()
    if im.width > max_w:
        h = round(im.height * max_w / im.width)
        im = im.resize((max_w, h), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    mode = "RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB"
    im.convert(mode).save(dst, "WEBP", quality=quality, method=6)
    print(f"  {dst.relative_to(ROOT)}  {dst.stat().st_size // 1024} KB")


def main() -> None:
    for src_name, dst_name, max_w, q in JOBS:
        src = SRC / src_name
        if not src.exists():
            print(f"! topilmadi: {src_name}")
            continue
        save_webp(src, OUT / dst_name, max_w, q)

    devices = SRC / "devices"
    if devices.exists():
        for src in sorted(devices.glob("*.png")):
            save_webp(src, OUT / "devices" / f"{src.stem}.webp", 640, 84)

    emblem = SRC / "emblem.png"
    if emblem.exists():
        im = Image.open(emblem).convert("RGBA")
        for size in (64, 192, 512):
            out = OUT / "brand" / f"emblem-{size}.png"
            im.resize((size, size), Image.LANCZOS).save(out, "PNG", optimize=True)
            print(f"  {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
