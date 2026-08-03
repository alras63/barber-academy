/* =====================================================================
   MANSPIRE ACADEMY — интерактив v2
   Видео-система (Kling-ready) + портал на скролле + рендер данных.
   Без зависимостей. Уважает prefers-reduced-motion и слабые устройства.
   ===================================================================== */
(function () {
  "use strict";

  var reduce  = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isPhone = window.matchMedia("(max-width: 700px)").matches;

  var M = window.MEDIA || {};

  /* ===================== ВИДЕО-СИСТЕМА =====================
     Ambient-видео подключается только когда:
     — файл указан в media.js,
     — пользователь не просил уменьшить движение,
     — это не телефон (экономим трафик; там остаётся постер).
     Ленивая загрузка через IntersectionObserver: src подставляется,
     когда блок подходит к экрану, и пауза, когда уходит.
  ================================================================= */
  function canUseVideo(slot) {
    return !!(slot && (slot.webm || slot.mp4) && !reduce && !isPhone);
  }

  function buildVideo(slot, opts) {
    opts = opts || {};
    var v = document.createElement("video");
    v.muted = true; v.defaultMuted = true;
    v.playsInline = true; v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    if (opts.loop !== false) v.loop = true;
    v.preload = "none";
    if (slot.poster) v.poster = slot.poster;
    // src не ставим сразу — только когда блок близко к экрану
    v.dataset.webm = slot.webm || "";
    v.dataset.mp4  = slot.mp4  || "";
    return v;
  }

  function attachSources(v) {
    if (v.dataset.loaded) return;
    v.dataset.loaded = "1";
    if (v.dataset.webm) {
      var s1 = document.createElement("source");
      s1.src = v.dataset.webm; s1.type = "video/webm"; v.appendChild(s1);
    }
    if (v.dataset.mp4) {
      var s2 = document.createElement("source");
      s2.src = v.dataset.mp4; s2.type = "video/mp4"; v.appendChild(s2);
    }
    v.load();
  }

  // Один общий наблюдатель на все ambient-видео — не грузим главный поток
  var ambientIO = "IntersectionObserver" in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var v = en.target;
          if (en.isIntersecting) {
            attachSources(v);
            var p = v.play();
            if (p && p.catch) p.catch(function () {});
          } else if (!v.paused) {
            v.pause();
          }
        });
      }, { threshold: 0.05, rootMargin: "200px 0px" })
    : null;

  function mountAmbient(container, slot) {
    if (!container || !canUseVideo(slot)) return null;
    var v = buildVideo(slot);
    container.insertBefore(v, container.firstChild);
    if (ambientIO) ambientIO.observe(v); else { attachSources(v); v.play(); }
    return v;
  }

  // Герой: видео поверх CSS-фолбэка (фолбэк остаётся, если видео нет)
  mountAmbient(document.getElementById("heroMedia"), M.heroLoop);
  mountAmbient(document.getElementById("ctaMedia"),  M.ctaMedia || M.ambientCta);
  // Фоновые ambient-слоты секций
  Array.prototype.forEach.call(document.querySelectorAll("[data-media]"), function (el) {
    mountAmbient(el, M[el.dataset.media]);
  });

  /* ===================== ПОРТАЛ =====================
     Здесь был проход сквозь стену: прокрутка вела камеру внутрь листвы.
     Движение с сайта снято совсем, поэтому осталась одна неподвижная
     стена с одной репликой. Показываем её сразу — ждать нечего.
  ================================================================= */
  (function portal() {
    var stage = document.getElementById("portalStage");
    if (!stage) return;
    var caps = stage.querySelectorAll(".portal__cap p");
    for (var i = 0; i < caps.length; i++) {
      // вторая реплика была второй точкой прохода — без прохода она лишняя
      if (i === 0) caps[i].style.opacity = "1";
      else caps[i].style.display = "none";
    }
    var hint = stage.querySelector(".portal__hint");
    if (hint) hint.remove();      // «прокрутите, чтобы войти» — входить больше некуда
  })();

  /* ===================== ПРОГРАММА =====================
     Раньше шаги сменяли друг друга в закреплённом кадре по мере прокрутки.
     Теперь это просто список из шести пунктов: всё видно сразу. Полоска
     прогресса и крупная цифра шага вместе с закреплением потеряли смысл.
  ================================================================= */
  (function program() {
    var sec = document.getElementById("program");
    if (!sec) return;
    var ticks = sec.querySelector(".program__ticks");
    if (ticks) ticks.remove();
    var big = sec.querySelector(".program__big");
    if (big) big.remove();
  })();

  /* ===================== РЕНДЕР ДАННЫХ ===================== */
  function initials(name) {
    return name.split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function media(photo, name, cls) {
    return photo
      ? '<div class="pcard__img"><img src="' + esc(photo) + '" alt="' + esc(name) + '" loading="lazy" decoding="async" /></div>'
      : '<div class="' + cls + '">' + initials(name) + "</div>";
  }

  // Преподаватели
  var tGrid = document.getElementById("teachersGrid");
  if (tGrid && window.TEACHERS) {
    tGrid.innerHTML = TEACHERS.map(function (t, i) {
      var tags = (t.skills || []).map(function (s) { return "<span>" + esc(s) + "</span>"; }).join("");
      return (
        '<article class="pcard reveal" data-d="' + ((i % 3) + 1) + '">' +
          media(t.photo, t.name, "pcard__mono") +
          '<div class="pcard__body">' +
            "<h4>" + esc(t.name) + "</h4>" +
            '<div class="pcard__role">' + esc(t.role) + "</div>" +
            "<p>" + esc(t.bio) + "</p>" +
            '<div class="pcard__tags">' + tags + "</div>" +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  // Ученики — горизонтальная лента
  var rail = document.getElementById("studentsRail");
  if (rail && window.STUDENTS) {
    rail.innerHTML = STUDENTS.map(function (s) {
      return (
        '<article class="pcard">' +
          '<span class="pcard__badge">' + esc(s.year) + "</span>" +
          media(s.photo, s.name, "pcard__mono") +
          '<div class="pcard__body">' +
            "<h4>" + esc(s.name) + "</h4>" +
            '<div class="pcard__role">' + esc(s.now) + "</div>" +
            "<p>" + esc(s.story) + "</p>" +
          "</div>" +
          '<div class="pcard__res"><b>Результат:</b> ' + esc(s.result) + "</div>" +
        "</article>"
      );
    }).join("");

    // стрелки
    var prev = document.getElementById("railPrev");
    var next = document.getElementById("railNext");
    function step() { return rail.firstElementChild ? rail.firstElementChild.offsetWidth + 18 : 300; }
    function syncArrows() {
      if (!prev || !next) return;
      prev.disabled = rail.scrollLeft < 6;
      next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 6;
    }
    if (prev) prev.addEventListener("click", function () { rail.scrollLeft -= step(); });
    if (next) next.addEventListener("click", function () { rail.scrollLeft += step(); });
    rail.addEventListener("scroll", syncArrows, { passive: true });
    syncArrows();

    // перетаскивание мышью — лента ощущается «физической»
    var down = false, startX = 0, startL = 0, moved = 0;
    rail.addEventListener("mousedown", function (e) {
      down = true; moved = 0; startX = e.pageX; startL = rail.scrollLeft; rail.classList.add("drag");
    });
    window.addEventListener("mousemove", function (e) {
      if (!down) return;
      e.preventDefault();
      var d = e.pageX - startX;
      moved = Math.abs(d);
      rail.scrollLeft = startL - d;
    });
    window.addEventListener("mouseup", function () {
      if (!down) return;
      down = false; rail.classList.remove("drag"); syncArrows();
    });
  }

  // Видео-истории
  var vGrid = document.getElementById("videosGrid");
  if (vGrid && window.VIDEOS) {
    vGrid.innerHTML = VIDEOS.map(function (v, i) {
      var inner = "";
      if (v.poster) inner = '<img src="' + esc(v.poster) + '" alt="' + esc(v.name) + '" loading="lazy" decoding="async" />';
      return (
        '<article class="vcard reveal" data-d="' + ((i % 3) + 1) + '"' +
          (v.url ? ' data-src="' + esc(v.url) + '"' : "") +
          (v.poster ? ' data-poster="' + esc(v.poster) + '"' : "") + ">" +
          inner +
          '<button class="vcard__play" type="button" aria-label="Смотреть историю: ' + esc(v.name) + '">' +
            '<svg class="ic" aria-hidden="true"><use href="#ic-play"/></svg>' +
          "</button>" +
          '<div class="vcard__cap"><h4>' + esc(v.name) + "</h4><span>" + esc(v.role) + "</span></div>" +
        "</article>"
      );
    }).join("");

    vGrid.addEventListener("click", function (e) {
      var btn = e.target.closest(".vcard__play");
      if (!btn) return;
      var card = btn.closest(".vcard");
      var src = card.dataset.src;
      if (!src) return; // видео ещё не загружено — карточка остаётся постером
      var v = card.querySelector("video");
      if (!v) {
        v = document.createElement("video");
        v.src = src; v.controls = true; v.playsInline = true;
        v.setAttribute("playsinline", "");
        if (card.dataset.poster) v.poster = card.dataset.poster;
        card.insertBefore(v, card.firstChild);
      }
      card.classList.add("playing");
      var p = v.play(); if (p && p.catch) p.catch(function () {});
      v.addEventListener("pause", function () { card.classList.remove("playing"); });
    });
  }

  /* ===================== Шапка =====================
     Всё, что относилось к появлению блоков — наблюдатель, страховка от
     «навсегда невидимого» блока, слушатель прокрутки — убрано вместе с
     анимациями: показывать нечего, содержимое видно сразу.

     Осталось одно состояние: на белой странице у шапки появляется фон
     и волосяная линейка. Это не анимация, а переключение вида, и делает
     его IntersectionObserver — метровая полоска у верхнего края страницы.
     Слушателей прокрутки на странице нет ни одного.
  ================================================================= */
  var topbar = document.getElementById("topbar");
  if (topbar && "IntersectionObserver" in window) {
    var sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:60px;pointer-events:none";
    document.body.appendChild(sentinel);
    new IntersectionObserver(function (e) {
      topbar.classList.toggle("is-scrolled", !e[0].isIntersecting);
    }).observe(sentinel);
  } else if (topbar) {
    topbar.classList.add("is-scrolled");
  }

  /* ===================== Меню ===================== */
  var burger = document.getElementById("burger");
  var menu   = document.getElementById("mobileMenu");
  var close  = document.getElementById("menuClose");
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle("open", open);
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.style.overflow = open ? "hidden" : "";
  }
  if (burger) burger.addEventListener("click", function () { setMenu(true); });
  if (close)  close.addEventListener("click", function () { setMenu(false); });
  if (menu)   menu.addEventListener("click", function (e) { if (e.target.tagName === "A") setMenu(false); });

  /* ===================== Форма ===================== */
  var form = document.getElementById("enrollForm");
  var ok   = document.getElementById("formOk");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim(), phone = form.phone.value.trim();
      if (!name || !phone) {
        if (ok) { ok.style.color = "#ff9a9a"; ok.textContent = "Оставьте имя и телефон — иначе мы не сможем перезвонить."; }
        return;
      }
      // Демо: в проде здесь отправка на бэкенд/CRM.
      if (ok) { ok.style.color = ""; ok.textContent = "Спасибо, " + name + ". Заявку получили — перезвоним в ближайшее рабочее время."; }
      form.reset();
    });
  }

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
