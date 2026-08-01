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
VIEW = 24.0     # итоговая клетка
PAD = 1.6       # поля внутри клетки

# Человекочитаемые имена для тех иконок, что реально стоят на странице.
# Номера — позиция на листе дизайнера; если лист переверстают, править тут.
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
    "ic-razor":       "i-48",
    "ic-chair":       "i-49",
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


def to_path_d(path, box):
    """Переносим контур в систему координат клетки 24×24.

    Важная тонкость: примитивы внутри одного контура идут подряд и делят
    концы. Если на каждый ставить свой M, контур рассыпается на отдельные
    чёрточки — так и было в первой версии. Поэтому M ставится только там,
    где действительно начинается новый подконтур.
    """
    scale = (VIEW - 2 * PAD) / max(box.width, box.height)
    ox = PAD + (VIEW - 2 * PAD - box.width * scale) / 2
    oy = PAD + (VIEW - 2 * PAD - box.height * scale) / 2

    def pt(p):
        return ("%.2f %.2f" % ((p.x - box.x0) * scale + ox,
                               (p.y - box.y0) * scale + oy))

    def same(a, b):
        return a is not None and abs(a.x - b.x) < 0.01 and abs(a.y - b.y) < 0.01

    d, cur = [], None
    for it in path["items"]:
        kind = it[0]
        if kind == "l":
            if not same(cur, it[1]):
                d.append("M" + pt(it[1]))
            d.append("L" + pt(it[2]))
            cur = it[2]
        elif kind == "c":
            if not same(cur, it[1]):
                d.append("M" + pt(it[1]))
            d.append("C%s %s %s" % (pt(it[2]), pt(it[3]), pt(it[4])))
            cur = it[4]
        elif kind == "re":
            r = it[1]
            d.append("M%s L%s L%s L%s Z" % (
                pt(r.tl), pt(fitz.Point(r.x1, r.y0)), pt(r.br), pt(fitz.Point(r.x0, r.y1))))
            cur = None
        elif kind == "qu":
            q = it[1]
            d.append("M%s L%s L%s L%s Z" % (pt(q.ul), pt(q.ur), pt(q.lr), pt(q.ll)))
            cur = None
    if path.get("closePath"):
        d.append("Z")
    return " ".join(d)


def main(src, out=OUT):
    page = fitz.open(src)[0]
    paths = [p for p in page.get_drawings() if fitz.Rect(p["rect"]).width > 0.5]
    groups = cluster(paths)
    # читаем как текст: сверху вниз, слева направо
    groups.sort(key=lambda g: (round(g["rect"].y0 / 40), g["rect"].x0))

    symbols = []
    for i, g in enumerate(groups, 1):
        box = g["rect"]
        scale = (VIEW - 2 * PAD) / max(box.width, box.height)
        # Часть иконок нарисована обводкой, а не заливкой (кольца, циферблат).
        # Если гнать их через fill, кольцо превращается в чёрный кружок.
        fills = [p for p in g["paths"] if p["items"] and p["type"] != "s"]
        strokes = [p for p in g["paths"] if p["items"] and p["type"] == "s"]
        parts = []
        if fills:
            d = " ".join(to_path_d(p, box) for p in fills)
            if d.strip():
                parts.append('    <path d="%s"/>' % d)
        for p in strokes:
            d = to_path_d(p, box)
            if not d.strip():
                continue
            w = max(0.7, (p.get("width") or 1.0) * scale)
            parts.append('    <path d="%s" fill="none" stroke="currentColor" '
                         'stroke-width="%.2f" stroke-linecap="round"/>' % (d, w))
        if not parts:
            continue
        symbols.append('  <symbol id="i-%02d" viewBox="0 0 24 24">\n%s\n  </symbol>'
                       % (i, "\n".join(parts)))

    have = {sym.split('id="')[1].split('"')[0] for sym in symbols}
    for name, src_id in ALIASES.items():
        if src_id in have:
            symbols.append('  <symbol id="%s" viewBox="0 0 24 24">\n'
                           '    <use href="#%s"/>\n  </symbol>' % (name, src_id))
        else:
            print("  ! нет исходной иконки %s для %s" % (src_id, name))

    # Контуры в исходнике залиты, а не обведены: тонкая линия нарисована
    # как замкнутая фигура. Поэтому fill, а не stroke, и evenodd — иначе
    # внутренние отверстия (дырки в буквах и кольцах) зальются.
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" style="display:none"\n'
           '     fill="currentColor" fill-rule="evenodd" stroke="none">\n'
           + "\n".join(symbols) + "\n</svg>\n")

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(svg)
    print("иконок: %d → %s (%.0f КБ)" % (len(symbols), out, len(svg.encode()) / 1024))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else OUT)
