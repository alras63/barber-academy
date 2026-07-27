#!/usr/bin/env python3
"""
Сборка версии для вставки в блок «T123 · HTML-код» на Tilda.

Отличия от обычной автономной сборки (build-standalone.py):

1. Убран <title> — заголовок страницы задаётся в настройках Tilda.

2. Снят `overflow-x: hidden` с body. Любой предок со значением overflow,
   отличным от visible, превращается в контейнер прокрутки и ломает
   position: sticky — а на нём держатся портал и программа-маршрут.

3. Добавлен слой совместимости: обёртки Tilda (#allrecords, .t-rec, .t123
   и прочие) принудительно получают overflow: visible. Без этого
   закрепление кадров не работает, даже если сам код верный.

Запуск:  python3 scripts/build-tilda.py [путь_на_выход]
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist", "menscut-tilda.html")
TMP = os.path.join(ROOT, "dist", "_base.html")

# базовую самодостаточную сборку не дублируем — переиспользуем
subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build-standalone.py"), TMP], check=True)

with open(TMP, encoding="utf-8") as f:
    page = f.read()
os.remove(TMP)

# 1. заголовок задаёт Tilda
page = re.sub(r"<title>.*?</title>\n", "", page, count=1, flags=re.S)

# 2. body не должен быть контейнером прокрутки — иначе sticky не работает
page = page.replace("  overflow-x: hidden;\n}", "}", 1)

COMPAT = """
/* =====================================================================
   СЛОЙ СОВМЕСТИМОСТИ С TILDA
   Tilda оборачивает блок в свои контейнеры. Если у любого из них
   overflow отличается от visible, он становится контейнером прокрутки,
   и position: sticky перестаёт работать — портал и программа замирают
   или уезжают вверх. Поэтому обёртки принудительно распрямляем.
   ===================================================================== */
html, body,
#allrecords, .t-body, .t-records, .t-rec, .t-rec__wrapper,
.t123, .t123 > div, .t-container, .t-col {
  overflow: visible !important;
}
/* Блок должен занимать всю ширину окна, а не колонку Tilda */
.t123, .t-rec { padding: 0 !important; margin: 0 !important; }
/* Отступ, который Tilda добавляет между блоками, тут не нужен */
.t-rec + .t-rec { margin-top: 0 !important; }
"""

page = page.replace("<style>\n", "<style>\n" + COMPAT, 1)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(page)

print("собрано для Tilda: %s (%.0f КБ)" % (OUT, len(page.encode()) / 1024))
