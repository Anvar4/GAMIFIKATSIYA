"""Higgsfield'da yaratilgan rasmlarni yuklab oladi va veb uchun optimallashtiradi.

Manba roʻyxati:  scripts/higgsfield-assets.json  (har bir rasm: target, job_id, url)
Yuklab olinadi:  assets-src/<target>              (git'ga kiritilmaydi)
Natija:          public/assets/...                 (scripts/optimize_assets.py orqali)

Ishga tushirish:
    python scripts/fetch_higgsfield_assets.py            # yetishmayotganlarini yuklaydi
    python scripts/fetch_higgsfield_assets.py --force    # hammasini qayta yuklaydi
"""
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "scripts" / "higgsfield-assets.json"
SRC = ROOT / "assets-src"


def main() -> int:
    force = "--force" in sys.argv
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    failed = []
    for item in data["assets"]:
        dst = SRC / item["target"]
        if dst.exists() and not force:
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        try:
            with urllib.request.urlopen(item["url"], timeout=60) as r:
                dst.write_bytes(r.read())
            print(f"  yuklandi: {item['target']}")
        except Exception as e:  # tarmoq yoki ruxsat xatosi — keyingisiga oʻtamiz
            failed.append(item["target"])
            print(f"! yuklab boʻlmadi: {item['target']} ({e})")

    # optimallashtirish (WebP, oʻlcham)
    sys.path.insert(0, str(ROOT / "scripts"))
    import optimize_assets

    optimize_assets.main()
    if failed:
        print(f"\n{len(failed)} ta rasm yuklanmadi. Tarmoq ruxsatini tekshiring va qayta ishga tushiring.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
