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

  // Появление героя (построчный вылет заголовка)
  var hero = document.getElementById("hero");
  if (hero) requestAnimationFrame(function () { hero.classList.add("ready"); });

  /* ===================== ПОРТАЛ (scroll-scrub) =====================
     Скролл управляет проходом сквозь стену. Если задано видео —
     проматываем его currentTime по прогрессу (как в кинематографичных
     лендингах). Если нет — двигаем три слоя стены с разной скоростью:
     камера входит внутрь, свет разгорается, кадр уходит в темноту.
  ================================================================= */
  (function portal() {
    var sec = document.getElementById("portal");
    var stage = document.getElementById("portalStage");
    if (!sec || !stage) return;

    var layers = {
      far:  stage.querySelector('[data-layer="far"]'),
      mid:  stage.querySelector('[data-layer="mid"]'),
      near: stage.querySelector('[data-layer="near"]')
    };
    var dark = stage.querySelector("[data-dark]");
    var glow = stage.querySelector("[data-glow]");
    var cap  = stage.querySelector("[data-cap]");

    // Видео-режим (если ролик подключён)
    var vid = null;
    if (canUseVideo(M.portalScrub)) {
      vid = buildVideo(M.portalScrub, { loop: false });
      vid.style.opacity = "0";
      stage.insertBefore(vid, stage.firstChild);
      attachSources(vid);
      vid.addEventListener("loadedmetadata", function () {
        vid.style.opacity = "1";
        // слои-фолбэк больше не нужны
        Object.keys(layers).forEach(function (k) { if (layers[k]) layers[k].style.display = "none"; });
      });
    }

    if (reduce) { if (cap) cap.style.opacity = "1"; return; }

    var ticking = false;
    function update() {
      var r = sec.getBoundingClientRect();
      var total = sec.offsetHeight - window.innerHeight;
      var p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;

      if (vid && vid.duration) {
        // проматываем ролик строго по прогрессу скролла
        var t = p * (vid.duration - 0.05);
        if (Math.abs(vid.currentTime - t) > 0.01) vid.currentTime = t;
      } else {
        // CSS-камера: слои разлетаются, создавая проход внутрь
        if (layers.far)  layers.far.style.transform  = "scale(" + (1 + p * 0.55) + ")";
        if (layers.mid)  layers.mid.style.transform  = "scale(" + (1 + p * 1.15) + ")";
        if (layers.near) {
          layers.near.style.transform = "scale(" + (1 + p * 2.4) + ")";
          layers.near.style.opacity = String(Math.max(0, 0.7 - p * 0.9));
        }
      }

      // свет разгорается к середине и гаснет к концу
      if (glow) glow.style.opacity = String(Math.sin(Math.min(1, p * 1.15) * Math.PI) * 0.95);
      // затемнение к финалу — «мы внутри»
      if (dark) dark.style.opacity = String(Math.max(0, (p - 0.72) / 0.28));
      // подпись живёт в середине прохода
      if (cap) {
        var o = p < 0.12 ? p / 0.12 : p > 0.66 ? Math.max(0, 1 - (p - 0.66) / 0.2) : 1;
        cap.style.opacity = String(o);
        cap.style.transform = "translateY(" + (1 - o) * 16 + "px)";
      }
      ticking = false;
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
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
      ? '<div class="pcard__img"><img src="' + esc(photo) + '" alt="' + esc(name) + '" loading="lazy" /></div>'
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
      if (v.poster) inner = '<img src="' + esc(v.poster) + '" alt="' + esc(v.name) + '" loading="lazy" />';
      return (
        '<article class="vcard reveal" data-d="' + ((i % 3) + 1) + '"' +
          (v.url ? ' data-src="' + esc(v.url) + '"' : "") +
          (v.poster ? ' data-poster="' + esc(v.poster) + '"' : "") + ">" +
          inner +
          '<button class="vcard__play" type="button" aria-label="Смотреть историю: ' + esc(v.name) + '">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
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

  /* ===================== Reveal ===================== */
  var animated = document.querySelectorAll(".reveal:not(.in), .wipe:not(.in)");
  if (reduce || !("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(animated, function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
    Array.prototype.forEach.call(animated, function (el) { io.observe(el); });
  }

  /* ============ Topbar, прогресс, активная глава ============ */
  var topbar   = document.getElementById("topbar");
  var progress = document.getElementById("routeProgress");
  var rail2    = document.getElementById("chapters");
  var chapLinks = rail2 ? rail2.querySelectorAll("a") : [];
  var sections = document.querySelectorAll("[data-chapter]");
  var invertZones = document.querySelectorAll("[data-invert]");

  var tick = false;
  function onScroll() {
    if (tick) return;
    tick = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (topbar) topbar.classList.toggle("is-scrolled", y > 60);
      if (progress) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
      }
      // активная глава
      var mid = y + window.innerHeight * 0.4, current = null;
      Array.prototype.forEach.call(sections, function (s) {
        if (s.offsetTop <= mid) current = s.dataset.chapter;
      });
      Array.prototype.forEach.call(chapLinks, function (a) {
        a.classList.toggle("on", a.dataset.ch === current);
      });
      // рельса темнеет на светлых секциях
      if (rail2) {
        var inv = false, probe = y + window.innerHeight / 2;
        Array.prototype.forEach.call(invertZones, function (z) {
          if (probe >= z.offsetTop && probe <= z.offsetTop + z.offsetHeight) inv = true;
        });
        rail2.classList.toggle("inv", inv);
      }
      tick = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();

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
        if (ok) { ok.style.color = "#ff9a9a"; ok.textContent = "Заполните имя и телефон — и мы вам перезвоним."; }
        return;
      }
      // Демо: в проде здесь отправка на бэкенд/CRM.
      if (ok) { ok.style.color = ""; ok.textContent = "Спасибо, " + name + "! Заявка принята — свяжемся с вами в ближайшее время."; }
      form.reset();
    });
  }

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
