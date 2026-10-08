(function () {
  var UI_DESIGN_W = 1440;
  var UI_DESIGN_H = 820;
  var UI_SCALE_MIN = 0.72;
  var UI_SCALE_MAX = 1.14;

  var layoutHeight = Math.round(
    (window.visualViewport && window.visualViewport.height) || window.innerHeight
  );
  var lastScaleWidth = Math.round(window.innerWidth);

  function computeUiScale(width, height) {
    var scale = Math.min(
      UI_SCALE_MAX,
      Math.max(UI_SCALE_MIN, Math.min(width / UI_DESIGN_W, height / UI_DESIGN_H))
    );
    return Math.round(scale * 1000) / 1000;
  }

  function refreshLayoutHeight() {
    layoutHeight = Math.round(
      (window.visualViewport && window.visualViewport.height) || window.innerHeight
    );
  }

  function applyUiScale() {
    var width = Math.round(window.innerWidth);
    document.documentElement.style.setProperty(
      "--ui-scale",
      String(computeUiScale(width, layoutHeight))
    );
    document.dispatchEvent(new CustomEvent("avv-ui-scale"));
  }

  function onLayoutChange(refreshHeight) {
    var width = Math.round(window.innerWidth);
    if (refreshHeight) {
      refreshLayoutHeight();
      lastScaleWidth = width;
      applyUiScale();
      return;
    }
    if (Math.abs(width - lastScaleWidth) < 2) {
      return;
    }
    lastScaleWidth = width;
    refreshLayoutHeight();
    applyUiScale();
  }

  window.avvApplyUiScale = function (refreshHeight) {
    if (refreshHeight) {
      refreshLayoutHeight();
      lastScaleWidth = Math.round(window.innerWidth);
    }
    applyUiScale();
  };

  applyUiScale();

  window.addEventListener("resize", function () {
    onLayoutChange(false);
  });
  window.addEventListener("orientationchange", function () {
    window.setTimeout(function () {
      onLayoutChange(true);
    }, 350);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      onLayoutChange(false);
    });
  }
})();
