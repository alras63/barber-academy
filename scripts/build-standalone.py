#!/usr/bin/env python3
"""
Сборка сайта в один самодостаточный HTML-файл.

Нужна для площадок, где страница обязана быть без внешних файлов
(предпросмотр, отправка заказчику одним файлом, встраивание в Tilda).
Шрифты и фотография стены зашиваются в файл как data-URI,
CSS и JS вставляются внутрь разметки.

Запуск:  python3 scripts/build-standalone.py [путь_на_выход]
"""
import base64, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist", "menscut-standalone.html")

# Для предпросмотра берём только кириллицу и латиницу: расширенные наборы
# добавляют ~90 КБ, а на этом сайте не используются.
FONT_SUBSETS = ("cyrillic", "latin")

# Портреты в одном файле пережимаются: base64 раздувает вес на треть, а блок
# HTML-кода на Tilda не любит мегабайты. Для предпросмотра этой ширины хватает.
PORTRAIT_WIDTH = 340


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return f.read()


def data_uri(path, mime):
    with open(os.path.join(ROOT, path), "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode())


# --- шрифты: только нужные наборы, файлы внутрь ------------------------------
fonts_css = read("css", "fonts.css")
kept = []
for block in re.findall(r"@font-face \{.*?\}", fonts_css, re.S):
    src = re.search(r"url\(\.\./(assets/fonts/[^)]+)\)", block)
    if not src:
        continue
    name = os.path.basename(src.group(1))
    if not any(name.endswith(s + ".woff2") for s in FONT_SUBSETS):
        continue
    kept.append(block.replace("../" + src.group(1), data_uri(src.group(1), "font/woff2")))
fonts_css = "\n".join(kept)

# --- стили: фотография стены внутрь ------------------------------------------
# Картинка встречается в разметке несколько раз (герой, портал, программа,
# финал). Вшивать её копиями — это лишний мегабайт, поэтому объявляем один
# раз переменной и везде ссылаемся на неё.
styles = read("css", "styles.css")
wall = data_uri("assets/img/wall.jpeg", "image/jpeg")
styles = styles.replace('url("../assets/img/wall.jpeg")', "var(--wall)")
styles = styles.replace(":root {", ':root {\n  --wall: url("%s");' % wall, 1)

scripts = "\n".join(read("js", n) for n in ("media.js", "data.js", "main.js"))
# В одном файле внешних ресурсов нет: путь к постеру вёл бы в никуда.
# Постер нужен только вместе с роликом, поэтому здесь он обнуляется.
scripts = scripts.replace('poster: "assets/img/wall.jpeg"', "poster: null")

# --- портреты внутрь -----------------------------------------------------------
# Пути вида assets/img/students/artem.jpg живут в data.js. Подменяем каждый
# на data-URI уменьшенной копии — иначе в отдельном файле карточки будут пустые.
from PIL import Image  # noqa: E402  (нужен только сборщику, не сайту)

photos = 0
for path in sorted(set(re.findall(r"assets/img/(?:students|teachers|stories)/[\w-]+\.jpg", scripts))):
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        continue  # в комментариях data.js встречаются примеры путей
    im = Image.open(full)
    if im.width > PORTRAIT_WIDTH:
        im = im.resize((PORTRAIT_WIDTH, round(im.height * PORTRAIT_WIDTH / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=72, optimize=True, progressive=True)
    scripts = scripts.replace(
        '"%s"' % path,
        '"data:image/jpeg;base64,%s"' % base64.b64encode(buf.getvalue()).decode())
    photos += 1

# --- разметка: вынимаем содержимое <body> ------------------------------------
html = read("index.html")
title = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
# внешние подключения больше не нужны — всё внутри
body = re.sub(r'\s*<script src="[^"]+"></script>', "", body)

page = """<title>%s</title>
<style>
%s
%s
</style>
%s
<script>
%s
</script>
""" % (title, fonts_css, styles, body.strip(), scripts)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(page)

print("собрано: %s (%.0f КБ)" % (OUT, len(page.encode()) / 1024))
print("шрифтовых правил: %d, портретов: %d" % (len(kept), photos))
