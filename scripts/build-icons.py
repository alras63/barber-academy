#!/usr/bin/env python3
"""
Нарезка фирменных иконок из вектора дизайнера в SVG-спрайт.

Дизайнер отдаёт один .ai (внутри — PDF) со всеми иконками на одном листе.
Скрипт достаёт из него настоящие векторные контуры (не растр), группирует
их по близости в отдельные иконки, нормализует каждую в квадрат 24×24 и
складывает в один <svg> со <symbol> — так вся библиотека едет одним файлом,
а на странице иконка ставится через <use>.

Запуск:  python3 scripts/build-icons.py <файл.ai|.pdf> [имя_на_выход]
"""
import os
import sys

import fitz

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img", "icons.svg")

# Зазор, по которому контуры считаются одной иконкой. Внутри иконки части
# стоят вплотную, между иконками — заметный воздух.
GAP = 9.0

# Человекочитаемые имена для тех иконок, что реально стоят на странице.
# Номера — позиция на листе дизайнера; если лист переверстают, править тут.
# Автоматическая группировка не всесильна: на плотных рядах соседние знаки
# стоят ближе, чем части одного знака. Здесь — рамки, выставленные руками,
# в координатах листа (x0, y0, x1, y1). Они добавляются как отдельные символы.
MANUAL = {
    "ic-razor":    (1091, 394, 1154, 458),   # бритва — верхний контур пары
    "ic-scissors": (1091, 456, 1139, 517),   # ножницы — нижний
}

ALIASES = {
    "ic-check":       "i-17",
    "ic-search":      "i-18",
    "ic-play":        "i-25",
    "ic-arrow-right": "i-28",
    "ic-arrow-left":  "i-29",
    "ic-person":      "i-37",
    "ic-phone":       "i-42",
    "ic-mail":        "i-55",
    "ic-map":         "i-46",
    "ic-chair":       "i-49",
    "ic-bookmark":    "i-54",
    "ic-clock":       "i-44",
    "ic-dryer":       "i-50",
}


def bbox_of(paths):
    r = fitz.Rect(paths[0]["rect"])
    for p in paths[1:]:
        r |= fitz.Rect(p["rect"])
    return r


def cluster(paths):
    """Группируем контуры в иконки: два контура в одной группе, если их
    рамки пересекаются с запасом GAP."""
    groups = []
    for p in paths:
        r = fitz.Rect(p["rect"])
        probe = fitz.Rect(r.x0 - GAP, r.y0 - GAP, r.x1 + GAP, r.y1 + GAP)
        hit = [g for g in groups if probe.intersects(g["rect"])]
        if not hit:
            groups.append({"rect": fitz.Rect(r), "paths": [p]})
            continue
        first = hit[0]
        first["paths"].append(p)
        first["rect"] |= r
        for other in hit[1:]:               # склеились две группы — объединяем
            first["paths"] += other["paths"]
            first["rect"] |= other["rect"]
            groups.remove(other)
    return groups


def main(src, out=OUT):
    page = fitz.open(src)[0]
    paths = [p for p in page.get_drawings() if fitz.Rect(p["rect"]).width > 0.5]
    groups = cluster(paths)
    groups.sort(key=lambda g: (round(g["rect"].y0 / 40), g["rect"].x0))

    # Сам рисунок берём готовым от MuPDF. Раньше контуры пересобирались
    # вручную — и правило заливки терялось: у кресла внутренние вырезы
    # заливались вместе с фигурой, и оно превращалось в чёрную кляксу.
    # Здесь весь лист выгружается один раз как есть, а каждая иконка —
    # это окно viewBox в него. Одна копия артворка на 55 символов.
    sheet = page.get_svg_image(text_as_path=True)
    inner = sheet[sheet.index(">", sheet.index("<svg")) + 1: sheet.rindex("</svg>")]

    symbols, clips, ids = [], [], []
    for i, g in enumerate(groups, 1):
        r = g["rect"]
        pad = max(r.width, r.height) * 0.09          # воздух вокруг знака
        side = max(r.width, r.height) + pad * 2      # клетка всегда квадратная
        x = r.x0 - (side - r.width) / 2
        y = r.y0 - (side - r.height) / 2
        sid = "i-%02d" % i
        ids.append(sid)
        # Квадратная клетка шире самого знака и на плотных рядах цепляла
        # край соседней иконки. Обрезаем строго по рамке своей группы.
        clips.append('    <clipPath id="c-%02d"><rect x="%.1f" y="%.1f" width="%.1f" height="%.1f"/></clipPath>'
                     % (i, r.x0 - 0.5, r.y0 - 0.5, r.width + 1, r.height + 1))
        symbols.append('  <symbol id="%s" viewBox="%.1f %.1f %.1f %.1f">\n'
                       '    <g clip-path="url(#c-%02d)"><use href="#sheet"/></g>\n  </symbol>'
                       % (sid, x, y, side, side, i))

    for j, (name, box) in enumerate(MANUAL.items(), 1):
        x0, y0, x1, y1 = box
        w, h = x1 - x0, y1 - y0
        pad = max(w, h) * 0.09
        side = max(w, h) + pad * 2
        clips.append('    <clipPath id="cm-%d"><rect x="%.1f" y="%.1f" width="%.1f" height="%.1f"/></clipPath>'
                     % (j, x0 - 0.5, y0 - 0.5, w + 1, h + 1))
        symbols.append('  <symbol id="%s" viewBox="%.1f %.1f %.1f %.1f">\n'
                       '    <g clip-path="url(#cm-%d)"><use href="#sheet"/></g>\n  </symbol>'
                       % (name, x0 - (side - w) / 2, y0 - (side - h) / 2, side, side, j))
        ids.append(name)

    for name, src_id in ALIASES.items():
        if src_id in ids:
            base = next(x for x in symbols if 'id="%s"' % src_id in x)
            symbols.append(base.replace('id="%s"' % src_id, 'id="%s"' % name, 1))
        else:
            print("  ! нет исходной иконки %s для %s" % (src_id, name))

    svg = ('<svg xmlns="http://www.w3.org/2000/svg" '
           'xmlns:xlink="http://www.w3.org/1999/xlink" style="display:none">\n'
           '  <defs>\n  <g id="sheet">%s</g>\n%s\n  </defs>\n'
           % (inner, "\n".join(clips)) + "\n".join(symbols) + "\n</svg>\n")

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(svg)
    print("иконок: %d → %s (%.0f КБ)" % (len(ids), out, len(svg.encode()) / 1024))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else OUT)
