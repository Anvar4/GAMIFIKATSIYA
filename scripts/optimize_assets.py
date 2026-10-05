"""Higgsfield'da yaratilgan PNG rasmlarni veb uchun optimallashtiradi (WebP, mos oʻlcham).

Manba:   assets-src/   (git'ga kiritilmaydi; scripts/fetch_higgsfield_assets.py yuklab oladi)
Natija:  public/assets/{ships,bg,rounds,devices,brand,abilities,awards}/
         src/game/assets.generated.ts — ilovada mavjud rasmlar roʻyxati

Ishga tushirish:  python scripts/optimize_assets.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src"
OUT = ROOT / "public" / "assets"
MANIFEST_TS = ROOT / "src" / "game" / "assets.generated.ts"

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

SKINS = ("falcon", "phoenix", "nova", "titan")
COLORS = ("blue", "red", "cyan", "green", "gold", "purple")
ABILITIES = ("shield_boost", "double_attack", "time_freeze", "energy_steal", "hint_scan")
AWARDS = ("galactic_champion", "best_strategist", "speed_master", "knowledge_master", "team_player", "most_improved")


def rel(p: Path) -> str:
    try:
        return str(p.relative_to(ROOT))
    except ValueError:
        return str(p)


def save_webp(src: Path, dst: Path, max_w: int, quality: int) -> None:
    im = Image.open(src)
    im.load()
    if im.width > max_w:
        h = round(im.height * max_w / im.width)
        im = im.resize((max_w, h), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    mode = "RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB"
    im.convert(mode).save(dst, "WEBP", quality=quality, method=6)
    print(f"  {rel(dst)}  {dst.stat().st_size // 1024} KB")


def alpha_bbox(im: Image.Image):
    """Shaffof boʻlmagan qismning chegaralari (yarim shaffof soyalar hisobga olinmaydi)."""
    alpha = im.getchannel("A").point(lambda a: 255 if a > 24 else 0)
    return alpha.getbbox()


def save_square_icon(src: Path, dst: Path, size: int = 256, quality: int = 88) -> None:
    """Nishon/medal: shaffof chetlar kesiladi, kvadrat kanvasga markazlab joylanadi."""
    im = Image.open(src).convert("RGBA")
    box = alpha_bbox(im)
    if box:
        im = im.crop(box)
    side = max(im.width, im.height)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    canvas = canvas.resize((size, size), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, "WEBP", quality=quality, method=6)
    print(f"  {rel(dst)}  {dst.stat().st_size // 1024} KB")


def save_ship_variant(src: Path, base: Path, dst: Path, quality: int = 86) -> None:
    """Rang varianti asl kema bilan aynan bir xil kanvas va joylashuvda saqlanadi —
    jang maydonida kemalar oʻlchami va holati oʻzgarmasligi uchun."""
    ref = Image.open(base).convert("RGBA")
    ref_box = alpha_bbox(ref) or (0, 0, ref.width, ref.height)
    im = Image.open(src).convert("RGBA")
    box = alpha_bbox(im)
    if box:
        im = im.crop(box)
    target_w, target_h = ref_box[2] - ref_box[0], ref_box[3] - ref_box[1]
    scale = min(target_w / im.width, target_h / im.height)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", ref.size, (0, 0, 0, 0))
    x = ref_box[0] + (target_w - im.width) // 2
    y = ref_box[1] + (target_h - im.height) // 2
    canvas.paste(im, (x, y), im)
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, "WEBP", quality=quality, method=6)
    print(f"  {rel(dst)}  {dst.stat().st_size // 1024} KB")


def save_og(src: Path, dst: Path) -> None:
    """Ijtimoiy tarmoqlar uchun 1200×630 JPG (markazdan kesib)."""
    im = Image.open(src).convert("RGB")
    target = 1200 / 630
    if im.width / im.height > target:
        w = round(im.height * target)
        im = im.crop(((im.width - w) // 2, 0, (im.width - w) // 2 + w, im.height))
    else:
        h = round(im.width / target)
        im = im.crop((0, (im.height - h) // 2, im.width, (im.height - h) // 2 + h))
    im = im.resize((1200, 630), Image.LANCZOS)
    im.save(dst, "JPEG", quality=84, optimize=True, progressive=True)
    print(f"  {rel(dst)}  {dst.stat().st_size // 1024} KB")


def write_manifest() -> None:
    ships = [f"{s}-{c}" for s in SKINS for c in COLORS if (OUT / "ships" / f"{s}-{c}.webp").exists()]
    abilities = [a for a in ABILITIES if (OUT / "abilities" / f"{a}.webp").exists()]
    awards = [a for a in AWARDS if (OUT / "awards" / f"{a}.webp").exists()]

    def ts_list(items):
        return "[" + ", ".join(f"'{x}'" for x in items) + "] as string[]"

    MANIFEST_TS.write_text(
        "// AVTOMATIK YARATILGAN FAYL — qoʻlda tahrirlamang.\n"
        "// Manba: scripts/optimize_assets.py (public/assets/ ichida mavjud rasmlar roʻyxati).\n"
        "// Roʻyxatda boʻlmagan rasm oʻrniga ilova zaxira koʻrinishdan foydalanadi.\n"
        "export const GENERATED_ASSETS = {\n"
        "  /** kema rang variantlari: \"<skin>-<rang>\" */\n"
        f"  ships: {ts_list(ships)},\n"
        "  /** qobiliyat nishonlari */\n"
        f"  abilities: {ts_list(abilities)},\n"
        "  /** mukofot medallari */\n"
        f"  awards: {ts_list(awards)},\n"
        "};\n",
        encoding="utf-8",
    )
    print(f"  {rel(MANIFEST_TS)}: {len(ships)} kema varianti, {len(abilities)} nishon, {len(awards)} medal")


def main() -> None:
    for src_name, dst_name, max_w, q in JOBS:
        src = SRC / src_name
        if src.exists():
            save_webp(src, OUT / dst_name, max_w, q)

    devices = SRC / "devices"
    if devices.exists():
        for src in sorted(devices.glob("*.png")):
            save_webp(src, OUT / "devices" / f"{src.stem}.webp", 640, 84)

    ships = SRC / "ships"
    if ships.exists():
        for src in sorted(ships.glob("*-*.png")):
            skin = src.stem.split("-")[0]
            base = OUT / "ships" / f"{skin}.webp"
            if skin in SKINS and base.exists():
                save_ship_variant(src, base, OUT / "ships" / f"{src.stem}.webp")

    for folder in ("abilities", "awards"):
        d = SRC / folder
        if d.exists():
            for src in sorted(d.glob("*.png")):
                save_square_icon(src, OUT / folder / f"{src.stem}.webp")

    og = SRC / "brand" / "og.png"
    if og.exists():
        save_og(og, ROOT / "public" / "og.jpg")

    emblem = SRC / "emblem.png"
    if emblem.exists():
        im = Image.open(emblem).convert("RGBA")
        for size in (64, 192, 512):
            out = OUT / "brand" / f"emblem-{size}.png"
            im.resize((size, size), Image.LANCZOS).save(out, "PNG", optimize=True)
            print(f"  {rel(out)}")

    write_manifest()


if __name__ == "__main__":
    main()
