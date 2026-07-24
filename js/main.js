/* =====================================================================
   MANSPIRE ACADEMY — интерактив
   Всё лёгкое, без зависимостей. Уважает prefers-reduced-motion.
   ===================================================================== */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------- утилиты рендера ----------------------- */
  function initials(name) {
    return name.split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ----------------------- Преподаватели ------------------------- */
  var tGrid = document.getElementById("teachersGrid");
  if (tGrid && window.TEACHERS) {
    tGrid.innerHTML = TEACHERS.map(function (t, i) {
      var photo = t.photo
        ? '<img src="' + esc(t.photo) + '" alt="' + esc(t.name) + '" loading="lazy" />'
        : '<span class="tcard__mono">' + initials(t.name) + "</span>";
      var tags = (t.skills || []).map(function (s) { return "<span>" + esc(s) + "</span>"; }).join("");
      return (
        '<article class="tcard reveal" data-d="' + ((i % 3) + 1) + '">' +
          '<div class="tcard__photo">' + photo + "</div>" +
          '<div class="tcard__body">' +
            "<h4>" + esc(t.name) + "</h4>" +
            '<div class="tcard__role">' + esc(t.role) + "</div>" +
            "<p>" + esc(t.bio) + "</p>" +
            '<div class="tcard__tags">' + tags + "</div>" +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  /* --------------------------- Ученики --------------------------- */
  var sGrid = document.getElementById("studentsGrid");
  if (sGrid && window.STUDENTS) {
    sGrid.innerHTML = STUDENTS.map(function (s, i) {
      var photo = s.photo
        ? '<img src="' + esc(s.photo) + '" alt="' + esc(s.name) + '" loading="lazy" />'
        : '<span class="scard__mono">' + initials(s.name) + "</span>";
      return (
        '<article class="scard reveal" data-d="' + ((i % 4) + 1) + '">' +
          '<div class="scard__photo"><span class="scard__year">' + esc(s.year) + "</span>" + photo + "</div>" +
          '<div class="scard__body">' +
            "<h4>" + esc(s.name) + "</h4>" +
            '<div class="scard__now">' + esc(s.now) + "</div>" +
            "<p>" + esc(s.story) + "</p>" +
            '<div class="scard__result"><b>Результат:</b> ' + esc(s.result) + "</div>" +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  /* ----------------------- Видео-истории ------------------------- */
  var vGrid = document.getElementById("videosGrid");
  if (vGrid && window.VIDEOS) {
    vGrid.innerHTML = VIDEOS.map(function (v, i) {
      var media = "";
      if (v.url) {
        media = '<video src="' + esc(v.url) + '"' + (v.poster ? ' poster="' + esc(v.poster) + '"' : "") +
                ' preload="none" playsinline controls></video>';
      } else if (v.poster) {
        media = '<img src="' + esc(v.poster) + '" alt="' + esc(v.name) + '" loading="lazy" />';
      }
      return (
        '<article class="vcard reveal" data-d="' + ((i % 3) + 1) + '"' +
          (v.url ? ' data-video="1"' : "") + ">" +
          media +
          '<button class="vcard__play" type="button" aria-label="Смотреть историю: ' + esc(v.name) + '">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
          "</button>" +
          '<div class="vcard__cap"><h4>' + esc(v.name) + "</h4><span>" + esc(v.role) + "</span></div>" +
        "</article>"
      );
    }).join("");

    // play → запускает встроенное видео, если оно задано; иначе мягкая подсказка
    vGrid.addEventListener("click", function (e) {
      var btn = e.target.closest(".vcard__play");
      if (!btn) return;
      var card = btn.closest(".vcard");
      var video = card.querySelector("video");
      if (video) {
        if (video.paused) { video.play(); btn.style.opacity = "0"; }
        else video.pause();
      }
    });
  }

  /* --------------- Reveal + прорастание листвы ------------------- */
  var revealEls = document.querySelectorAll(".reveal:not(.in)");
  var foliage = document.querySelectorAll(".foliage[data-grow]");

  if (reduce || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("in"); });
    foliage.forEach(function (el) { el.classList.add("grow"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });

    var fio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("grow"); fio.unobserve(en.target); }
      });
    }, { threshold: 0.05 });
    foliage.forEach(function (el) { fio.observe(el); });
  }

  /* --------------------- Topbar + прогресс ----------------------- */
  var topbar = document.getElementById("topbar");
  var progress = document.getElementById("routeProgress");
  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (topbar) topbar.classList.toggle("is-scrolled", y > 40);
    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* --------------------- Параллакс стены ------------------------- */
  var heroWall = document.getElementById("heroWall");
  if (heroWall && !reduce) {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset;
        if (y < window.innerHeight) {
          heroWall.style.transform = "scale(1.08) translateY(" + (y * 0.14) + "px)";
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* ------------------------ Мобильное меню ----------------------- */
  var burger = document.getElementById("burger");
  var menu = document.getElementById("mobileMenu");
  var close = document.getElementById("menuClose");
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle("open", open);
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.style.overflow = open ? "hidden" : "";
  }
  if (burger) burger.addEventListener("click", function () { setMenu(true); });
  if (close) close.addEventListener("click", function () { setMenu(false); });
  if (menu) menu.addEventListener("click", function (e) {
    if (e.target.tagName === "A") setMenu(false);
  });

  /* -------------------------- Форма ------------------------------ */
  var form = document.getElementById("enrollForm");
  var ok = document.getElementById("formOk");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var phone = form.phone.value.trim();
      if (!name || !phone) {
        if (ok) { ok.style.color = "#ff9a9a"; ok.textContent = "Заполните имя и телефон — и мы вам перезвоним."; }
        return;
      }
      // Демо-обработка: в проде здесь отправка на бэкенд/CRM.
      if (ok) {
        ok.style.color = "";
        ok.textContent = "Спасибо, " + name + "! Заявка принята — свяжемся с вами в ближайшее время.";
      }
      form.reset();
    });
  }

  /* --------------------------- Год ------------------------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
