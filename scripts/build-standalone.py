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

# --- стили: фоны внутрь -------------------------------------------------------
# В одном файле нет внешних ресурсов, поэтому все фоны вшиваются data-URI.
# Берём только самую лёгкую ширину: единственный файл и так весит под мегабайт,
# а 2400 px в base64 добавили бы ещё несколько.
styles = read("css", "styles.css")

# Ступени для больших экранов в одном файле не нужны: там всё равно
# зашита только самая лёгкая ширина. Выкидываем медиазапросы, которые
# только и делают, что переопределяют --wall на 1400/2400.
styles = re.sub(r"@media \([^)]*\)\s*\{\s*:root \{[^}]*--wall[^}]*\}\s*\}\n?", "", styles)

for path in sorted(set(re.findall(r"assets/img/bg/[\w-]+\.webp", styles))):
    styles = styles.replace('url("../%s")' % path, "url(%s)" % data_uri(path, "image/webp"))

scripts = "\n".join(read("js", n) for n in ("data.js", "main.js"))
# В одном файле внешних ресурсов нет: путь к постеру вёл бы в никуда.
# Постер нужен только вместе с роликом, поэтому здесь он обнуляется.
scripts = re.sub(r'poster: "assets/img/bg/[\w-]+\.webp"', "poster: null", scripts)

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

# Развороты-полосы объявлены как <img srcset> — в одном файле внешних путей
# быть не должно. Оставляем самую лёгкую ширину и вшиваем её data-URI,
# а srcset убираем: выбирать браузеру уже не из чего.
def inline_plate(m):
    path = "assets/img/bg/%s-800.webp" % m.group(1)
    return 'src="%s"' % data_uri(path, "image/webp")

html = re.sub(r'\s+srcset="[^"]*"\s+sizes="100vw"', ' ', html)
# Ширина в имени файла у разных кадров своя (у фотографии стены исходник
# всего 1080 px), поэтому суффикс не зашит: берём любой и подменяем на 800.
html = re.sub(r'src="assets/img/bg/([\w-]+)-\d+\.webp"', inline_plate, html)
title = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
# внешние подключения больше не нужны — всё внутри
body = re.sub(r'\s*<script src="[^"]+"></script>', "", body)

# --- политика конфиденциальности внутрь --------------------------------------
# На сайте это отдельная страница. В одном файле соседней страницы нет, а
# ссылка на неё обязана работать: политика — единственный текст на сайте,
# который человек имеет право прочитать до того, как оставит телефон.
# Поэтому документ подшивается в конец той же страницы, а ссылки ведут
# к нему якорем.
legal = re.search(r'<main class="legal"[^>]*>(.*?)</main>', read("privacy.html"), re.S).group(1)
# Заголовок страницы становится заголовком раздела: h1 на странице один.
legal = legal.replace('<h1 class="display"', '<h2 class="display"').replace("</h1>", "</h2>")
# Поле под закреплённую шапку нужно только на отдельной странице
legal = legal.replace(" head legal__head", " head")
legal = '<section class="legal" id="privacy">%s</section>' % legal
body = body.replace('<footer class="footer">', legal + '\n<footer class="footer">', 1)
body = body.replace('href="privacy.html"', 'href="#privacy"')

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
