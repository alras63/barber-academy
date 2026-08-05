#!/usr/bin/env python3
"""
Подготовка фирменных фонов к вебу.

Дизайнер отдаёт PNG по 6000 px и 10–30 МБ каждый — в таком виде их нельзя
ставить на страницу: один такой файл тяжелее всего остального сайта вместе
взятого. Здесь они превращаются в три ширины WebP:

    2400 px — большой монитор
    1400 px — ноутбук и планшет
     800 px — телефон

CSS подбирает нужную через image-set(), поэтому телефон никогда не качает
десктопный кадр. Это же и лечит тормоза на мобильных: там, где раньше
браузер декодировал 6000 px, теперь 800.

Запуск:  python3 scripts/build-assets.py <папка_с_исходниками>
Исходники в репозиторий не кладём — только результат.
"""
import os
import sys

from PIL import Image, ImageEnhance, ImageOps

Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img", "bg")

# (ширина, качество). Мелкие ширины жмём сильнее: на телефоне разницы не видно,
# а вес решает всё.
SIZES = ((2400, 78), (1400, 76), (800, 72))

# Чёрно-белые копии сейчас не нужны: полоса-«дверь» на титуле, ради
# которой они делались, убрана. Оставлено на случай, если понадобится снова.
BW_TOO = set()


def main(src_dir):
    os.makedirs(OUT, exist_ok=True)
    names = sorted(f for f in os.listdir(src_dir) if f.lower().endswith(".png"))
    if not names:
        sys.exit("в %s нет PNG" % src_dir)

    total_in = total_out = 0
    for name in names:
        path = os.path.join(src_dir, name)
        total_in += os.path.getsize(path)
        im = Image.open(path).convert("RGB")
        stem = os.path.splitext(name)[0]
        made = []
        for width, quality in SIZES:
            if im.width < width:
                continue
            h = round(im.height * width / im.width)
            small = im.resize((width, h), Image.LANCZOS)
            out = os.path.join(OUT, "%s-%d.webp" % (stem, width))
            small.save(out, "WEBP", quality=quality, method=6)
            size = os.path.getsize(out)
            total_out += size
            made.append("%d:%.0fКБ" % (width, size / 1024))
            if stem in BW_TOO:
                # Обесцвеченный вариант готовим здесь, а не фильтром в браузере:
                # filter: grayscale на большом слое, который ещё и анимируется,
                # заставляет телефон перерисовывать его каждый кадр.
                bw = os.path.join(OUT, "%s-bw-%d.webp" % (stem, width))
                # Заодно притемняем: на титуле полоса стены идёт приглушённой,
                # и делать это фильтром в браузере — работа на каждом кадре.
                ImageEnhance.Brightness(
                    ImageOps.grayscale(small)).enhance(0.88).save(
                        bw, "WEBP", quality=quality, method=6)
                total_out += os.path.getsize(bw)
        print("%-12s %5dx%-5d → %s" % (name, im.width, im.height, "  ".join(made)))

    print("\nбыло %.0f МБ → стало %.1f МБ (в %.0f раз легче)"
          % (total_in / 2**20, total_out / 2**20, total_in / max(1, total_out)))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
