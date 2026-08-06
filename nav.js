(function () {
  const nav = document.querySelector(".bottom-bar");
  if (!nav) return;

  const revealZone = 88;
  const persistKey = "bottom-bar-from-nav";

  function isNearBottom(clientY) {
    return window.innerHeight - clientY <= revealZone;
  }

  function showBar(instant) {
    nav.classList.add("is-visible");
    if (instant) {
      nav.classList.add("is-instant");
    }
  }

  function hideBar() {
    nav.classList.remove("is-visible", "is-instant");
  }

  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      sessionStorage.setItem(persistKey, "1");
    });
  });

  if (sessionStorage.getItem(persistKey)) {
    sessionStorage.removeItem(persistKey);
    showBar(true);
  }

  document.addEventListener(
    "mousemove",
    function (event) {
      nav.classList.remove("is-instant");

      if (nav.contains(event.target) || isNearBottom(event.clientY)) {
        showBar();
        return;
      }

      hideBar();
    },
    { passive: true }
  );

  document.addEventListener("mouseleave", hideBar);

  nav.addEventListener("focusin", function () {
    showBar();
  });

  nav.addEventListener("focusout", function (event) {
    if (nav.contains(event.relatedTarget)) return;
    hideBar();
  });

  document.addEventListener(
    "touchstart",
    function (event) {
      const touch = event.touches[0];
      if (!touch) return;

      nav.classList.remove("is-instant");

      if (nav.contains(event.target) || isNearBottom(touch.clientY)) {
        showBar();
      } else {
        hideBar();
      }
    },
    { passive: true }
  );
})();
