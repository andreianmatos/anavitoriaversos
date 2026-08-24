(function () {
  const prefersHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (prefersHover.matches) {
    document.documentElement.classList.add("has-cursor-dot");

    const dot = document.createElement("div");
    dot.className = "cursor-dot";
    dot.setAttribute("aria-hidden", "true");
    document.body.appendChild(dot);

    function attachDot() {
      const openDialog = document.querySelector("dialog[open]");
      const parent = openDialog || document.body;
      if (dot.parentElement !== parent) {
        parent.appendChild(dot);
      }
    }

    function isHoverable(node) {
      if (!node || node === document || node === document.documentElement) {
        return false;
      }
      if (node.closest) {
        return Boolean(node.closest("a, button, [role='button']"));
      }
      return false;
    }

    document.addEventListener(
      "mousemove",
      function (event) {
        attachDot();
        const hover = isHoverable(event.target);
        const scale = hover ? 1.45 : 1;
        dot.classList.toggle("is-hover", hover);
        dot.style.transform =
          "translate3d(" +
          event.clientX +
          "px, " +
          event.clientY +
          "px, 0) translate(-50%, -50%) scale(" +
          scale +
          ")";
        dot.classList.add("is-visible");
      },
      { passive: true }
    );

    document.addEventListener("mouseleave", function () {
      dot.classList.remove("is-visible");
    });
  }

  const COPY = {
    pt: {
      sobre: "Sobre",
      arquivo: "Arquivo",
      formacao: "Formação",
      exposicoes: "Exposições // Residências",
      close: "fechar",
      lang: "Idioma",
    },
    en: {
      sobre: "About",
      arquivo: "Archive",
      formacao: "Education",
      exposicoes: "Exhibitions // Residencies",
      close: "close",
      lang: "Language",
    },
  };
  const langKey = "avv-lang";

  function langToggles() {
    return document.querySelectorAll(".lang-toggle");
  }

  function readLang() {
    try {
      localStorage.removeItem(langKey);
    } catch (error) {}
    try {
      const stored = sessionStorage.getItem(langKey);
      if (stored === "en" || stored === "pt") return stored;
    } catch (error) {}
    return "pt";
  }

  function setLang(lang) {
    const copy = COPY[lang] || COPY.pt;

    document.documentElement.lang = lang;

    try {
      sessionStorage.setItem(langKey, lang);
    } catch (error) {}

    langToggles().forEach(function (toggle) {
      toggle.setAttribute("aria-label", copy.lang);
      toggle.querySelectorAll("[data-lang]").forEach(function (button) {
        const active = button.getAttribute("data-lang") === lang;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    });

    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      const key = node.getAttribute("data-i18n");
      if (copy[key]) node.textContent = copy[key];
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(function (node) {
      const key = node.getAttribute("data-i18n-aria");
      if (copy[key]) node.setAttribute("aria-label", copy[key]);
    });

    document.querySelectorAll("[data-lang-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-lang-panel") !== lang;
    });

    if (document.body.classList.contains("sobre-page")) {
      document.title = copy.sobre;
    } else if (document.body.classList.contains("arquivo-page")) {
      document.title = copy.arquivo;
    }
  }

  setLang(readLang());

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-lang]");
    if (!button) return;
    setLang(button.getAttribute("data-lang"));
  });

  const homePage = document.body.classList.contains("home-page");
  const title = document.querySelector(".site-title");
  const homeVideo = document.querySelector(".video-bg video");

  if (homeVideo) {
    if (prefersReducedMotion.matches) {
      homeVideo.pause();
      homeVideo.removeAttribute("src");
      homeVideo.load();
    } else {
      homeVideo.muted = true;
      homeVideo.defaultMuted = true;
      homeVideo.playsInline = true;
      const tryPlay = function () {
        homeVideo.play().catch(function () {});
      };
      tryPlay();
      homeVideo.addEventListener("canplay", tryPlay);
      document.addEventListener("touchstart", tryPlay, { once: true, passive: true });
    }
  }

  function setNavVisible(visible) {
    document.body.classList.toggle("is-nav-visible", visible);
  }

  if (title) {
    title.addEventListener("click", function (event) {
      if (!homePage) return;
      event.preventDefault();
      setNavVisible(false);
    });
  }

  if (!homePage) return;

  if (prefersReducedMotion.matches) {
    setNavVisible(true);
    return;
  }

  let lockUntil = 0;

  function requestNav(visible) {
    const now = Date.now();
    if (now < lockUntil) return;
    if (document.body.classList.contains("is-nav-visible") === visible) return;
    lockUntil = now + 500;
    setNavVisible(visible);
  }

  window.addEventListener(
    "wheel",
    function (event) {
      event.preventDefault();
      if (event.deltaY > 4) {
        requestNav(true);
      } else if (event.deltaY < -4) {
        requestNav(false);
      }
    },
    { passive: false }
  );

  let touchStartY = 0;

  window.addEventListener(
    "touchstart",
    function (event) {
      const touch = event.touches[0];
      if (touch) touchStartY = touch.clientY;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    function (event) {
      const touch = event.touches[0];
      if (!touch) return;
      const delta = touchStartY - touch.clientY;
      if (Math.abs(delta) < 18) return;
      event.preventDefault();
      requestNav(delta > 0);
    },
    { passive: false }
  );

  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      setNavVisible(false);
    }
  });
})();
