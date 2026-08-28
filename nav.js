(function () {
  const prefersHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compactFrame = window.matchMedia("(max-width: 1023px)");

  function setMobileFrame() {
    if (!compactFrame.matches) {
      document.documentElement.style.removeProperty("--app-height");
      return;
    }
    const height =
      (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    document.documentElement.style.setProperty(
      "--app-height",
      Math.round(height) + "px"
    );
  }

  setMobileFrame();
  if (compactFrame.addEventListener) {
    compactFrame.addEventListener("change", setMobileFrame);
  }
  window.addEventListener("orientationchange", function () {
    window.setTimeout(setMobileFrame, 350);
  });
  window.addEventListener("resize", function () {
    if (compactFrame.matches) return;
    setMobileFrame();
  });

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
      contactos: "Contactos",
      close: "fechar",
      lang: "Idioma",
    },
    en: {
      sobre: "About",
      arquivo: "Archive",
      formacao: "Education",
      exposicoes: "Exhibitions // Residencies",
      contactos: "Contacts",
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

    const customTitle = document.body.getAttribute("data-title");
    if (customTitle) {
      document.title = customTitle;
    } else if (document.body.classList.contains("sobre-page")) {
      document.title = copy.sobre;
    } else if (document.body.classList.contains("arquivo-page")) {
      document.title = copy.arquivo;
    }

    document.dispatchEvent(new CustomEvent("avv-lang", { detail: lang }));
  }

  setLang(readLang());

  (function initSobreCv() {
    const toggles = document.querySelectorAll("[data-cv-toggle]");
    if (!toggles.length) return;

    function setCvOpen(open) {
      document.body.classList.toggle("is-cv-open", open);
      toggles.forEach(function (button) {
        button.setAttribute("aria-expanded", open ? "true" : "false");
      });
      const panel = document.querySelector(".sobre-cv-panel");
      if (panel) panel.hidden = !open;
    }

    toggles.forEach(function (button) {
      button.addEventListener("click", function () {
        setCvOpen(!document.body.classList.contains("is-cv-open"));
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.body.classList.contains("is-cv-open")) {
        setCvOpen(false);
      }
    });
  })();

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-lang]");
    if (!button) return;
    setLang(button.getAttribute("data-lang"));
  });

  const homePage = document.body.classList.contains("home-page");
  const homeTitle = document.querySelector(".home-title");
  const homeVideo = document.querySelector(".video-bg video");

  function fitHomeTitle() {
    if (!homeTitle) return;
    const width = homeTitle.clientWidth;
    if (width < 40) return;

    const lines = homeTitle.querySelectorAll(".home-title__line");
    lines.forEach(function (line) {
      line.style.display = "inline-block";
      line.style.width = "max-content";
      line.style.fontSize = "50px";
      const measured = line.offsetWidth;
      line.style.display = "block";
      line.style.width = "100%";
      if (!measured) return;
      line.style.fontSize = Math.max(8, 50 * (width / measured)) + "px";
    });

    if (!compactFrame.matches) return;
    const frame =
      (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    const cap = frame * 0.5;
    const height = homeTitle.scrollHeight;
    if (height > cap && height > 0) {
      const scale = cap / height;
      lines.forEach(function (line) {
        const size = parseFloat(line.style.fontSize);
        if (!size) return;
        line.style.fontSize = size * scale + "px";
      });
    }
  }

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
    if (visible) {
      window.requestAnimationFrame(fitHomeTitle);
    }
  }

  function fitUmbigoSubtitle() {
    const el = document.querySelector(".umbigo-work__subtitle:not([hidden])");
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const parentStyle = window.getComputedStyle(parent);
    const max =
      parent.clientWidth -
      parseFloat(parentStyle.paddingLeft) -
      parseFloat(parentStyle.paddingRight);
    if (max < 40) return;
    el.style.whiteSpace = "nowrap";
    el.style.display = "inline-block";
    el.style.width = "auto";
    el.style.fontSize = "40px";
    const width = el.getBoundingClientRect().width;
    if (!width) return;
    el.style.fontSize = Math.max(14, (40 * max) / width) + "px";
    el.style.display = "block";
    el.style.width = "100%";
  }

  if (document.body.classList.contains("umbigo-page")) {
    const runFit = function () {
      window.requestAnimationFrame(fitUmbigoSubtitle);
    };
    runFit();
    window.addEventListener("resize", runFit);
    window.addEventListener("orientationchange", function () {
      window.setTimeout(runFit, 400);
    });
    document.addEventListener("avv-lang", runFit);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(runFit);
    }
  }

  if (!homePage) return;

  fitHomeTitle();
  window.addEventListener("resize", fitHomeTitle);
  window.addEventListener("orientationchange", function () {
    window.setTimeout(fitHomeTitle, 400);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitHomeTitle);
  }

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
