(function () {
  const nav = document.getElementById("home-nav");
  if (!nav) return;

  const revealZone = 88;
  const hideDelay = 1400;
  let hideTimer;
  let touchStartY = 0;
  let touchStartX = 0;

  function showBar() {
    clearTimeout(hideTimer);
    nav.classList.add("is-visible");
  }

  function hideBar() {
    nav.classList.remove("is-visible");
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBar, hideDelay);
  }

  function isNearBottom(clientY) {
    return window.innerHeight - clientY <= revealZone;
  }

  document.addEventListener(
    "mousemove",
    function (event) {
      if (isNearBottom(event.clientY) || nav.contains(event.target)) {
        showBar();
        return;
      }

      if (!nav.classList.contains("is-visible")) return;
      scheduleHide();
    },
    { passive: true }
  );

  document.addEventListener(
    "wheel",
    function (event) {
      if (event.deltaY < 0) {
        showBar();
        return;
      }

      if (event.deltaY > 0 && !nav.matches(":hover")) {
        scheduleHide();
      }
    },
    { passive: true }
  );

  nav.addEventListener("mouseenter", showBar);
  nav.addEventListener("mouseleave", scheduleHide);
  nav.addEventListener("focusin", showBar);
  nav.addEventListener("focusout", function (event) {
    if (nav.contains(event.relatedTarget)) return;
    scheduleHide();
  });

  document.addEventListener(
    "touchstart",
    function (event) {
      const touch = event.touches[0];
      if (!touch) return;

      touchStartY = touch.clientY;
      touchStartX = touch.clientX;

      if (isNearBottom(touch.clientY)) {
        showBar();
      }
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    function (event) {
      const touch = event.touches[0];
      if (!touch) return;

      const deltaY = touchStartY - touch.clientY;
      const deltaX = Math.abs(touch.clientX - touchStartX);

      if (deltaY > 28 && deltaX < 60) {
        showBar();
      }
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    function () {
      if (!nav.classList.contains("is-visible")) return;
      scheduleHide();
    },
    { passive: true }
  );
})();
