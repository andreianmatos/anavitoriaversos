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

  const langToggle = document.querySelector(".lang-toggle");
  if (langToggle) {
    const buttons = langToggle.querySelectorAll("[data-lang]");
    const panels = document.querySelectorAll("[data-lang-panel]");

    function setLang(lang) {
      buttons.forEach(function (button) {
        const active = button.getAttribute("data-lang") === lang;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-lang-panel") !== lang;
      });
      document.documentElement.lang = lang;
    }

    langToggle.addEventListener("click", function (event) {
      const button = event.target.closest("[data-lang]");
      if (!button) return;
      setLang(button.getAttribute("data-lang"));
    });
  }

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

  function setHomeEntered(entered) {
    document.body.classList.toggle("is-home-entered", entered);
  }

  if (title) {
    title.addEventListener("click", function (event) {
      if (!homePage) return;
      event.preventDefault();
      setHomeEntered(false);
    });
  }

  if (!homePage) return;

  if (prefersReducedMotion.matches) {
    setHomeEntered(true);
    return;
  }

  let lockUntil = 0;

  function requestEnter(entered) {
    const now = Date.now();
    if (now < lockUntil) return;
    if (document.body.classList.contains("is-home-entered") === entered) return;
    lockUntil = now + 700;
    setHomeEntered(entered);
  }

  window.addEventListener(
    "wheel",
    function (event) {
      event.preventDefault();
      if (event.deltaY > 4) {
        requestEnter(true);
      } else if (event.deltaY < -4) {
        requestEnter(false);
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
      requestEnter(delta > 0);
    },
    { passive: false }
  );

  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      setHomeEntered(false);
    }
  });
})();
