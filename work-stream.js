(function (global) {
  var STREAM_LINE_CHARS = 10;

  function workTextParts(entry) {
    if (!entry) return [];
    if (Array.isArray(entry.text)) {
      return entry.text
        .map(function (part) {
          return String(part || "").trim();
        })
        .filter(Boolean);
    }
    if (typeof entry.text === "string" && entry.text.trim()) {
      return [entry.text.trim()];
    }
    return [];
  }

  function workStreamText(entry) {
    var parts = workTextParts(entry);
    return parts.length ? parts[0] : "";
  }

  function streamLinesFixed(text, lineChars) {
    var width = lineChars || STREAM_LINE_CHARS;
    var flat = String(text || "").replace(/\s+/g, " ").trim();
    if (!flat) return [];
    var lines = [];
    for (var i = 0; i < flat.length; i += width) {
      lines.push(flat.slice(i, i + width).padEnd(width, " "));
    }
    return lines;
  }

  function levaRootFontPx() {
    if (typeof document === "undefined") return 16;
    var root = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return Number.isFinite(root) && root > 0 ? root : 16;
  }

  function levaColumnWidth() {
    if (typeof window === "undefined") return 200;
    return Math.max(72, Math.floor(window.innerWidth / 3));
  }

  function levaUseSingleColumn() {
    return typeof window !== "undefined" && window.innerWidth < 768;
  }

  function levaDefaultLineChars() {
    if (typeof window === "undefined") return 14;
    if (!levaUseSingleColumn()) {
      var colW = Math.max(120, window.innerWidth / 3);
      var fontPx = Math.max(21, Math.min(colW * 0.11, 73));
      return Math.max(7, Math.min(22, Math.round(colW / (fontPx * 0.46))));
    }
    var colW = Math.max(120, window.innerWidth);
    var fontPx = Math.max(21, Math.min(colW * 0.11, 73));
    return Math.max(7, Math.min(22, Math.round(colW / (fontPx * 0.46))));
  }

  function streamLinesContinuous(text, maxChars) {
    var max = maxChars || 14;
    var flat = String(text || "").replace(/\s+/g, " ").trim();
    if (!flat) return [];
    var lines = [];
    for (var i = 0; i < flat.length; i += max) {
      lines.push(flat.slice(i, i + max));
    }
    return lines;
  }

  function appendStreamChar(parent, ch) {
    var glyph = document.createElement("span");
    glyph.className = "work__stream-char";
    glyph.textContent = ch;
    parent.appendChild(glyph);
  }

  function appendWordChars(parent, wordText) {
    var chars = String(wordText || "");
    for (var i = 0; i < chars.length; i += 1) {
      appendStreamChar(parent, chars.charAt(i));
    }
  }

  function createStreamLine(line, opts) {
    opts = opts || {};
    var row = document.createElement("p");
    row.className = "work__stream-line";
    if (opts.wordSpaced) {
      var lineChars = opts.lineChars || levaDefaultLineChars();
      var slice = String(line || "");
      if (!slice) return row;
      row.classList.add("work__stream-line--word-spaced", "work__stream-line--continuous");
      row.style.setProperty("--leva-line-chars", String(lineChars));
      if (slice.length < lineChars) {
        row.classList.add("work__stream-line--partial");
        row.style.setProperty("--leva-line-fill", String(slice.length));
      }
      var lane = document.createElement("span");
      lane.className = "work__stream-word work__stream-word--spread";
      appendWordChars(lane, slice);
      row.appendChild(lane);
      return row;
    }
    var chars = line.padEnd(STREAM_LINE_CHARS, " ").slice(0, STREAM_LINE_CHARS);
    for (var j = 0; j < chars.length; j += 1) {
      appendStreamChar(row, chars.charAt(j));
    }
    return row;
  }

  function createStreamColumn(lines, opts) {
    var column = document.createElement("div");
    column.className = "work__stream-column";
    lines.forEach(function (line) {
      column.appendChild(createStreamLine(line, opts));
    });
    return column;
  }

  function buildWorkTextStream(entry, opts) {
    opts = opts || {};
    var text = workStreamText(entry);
    var stream = document.createElement("div");
    stream.className = "work__stream";
    stream.setAttribute("aria-hidden", "true");
    if (opts.static) {
      stream.classList.add("work__stream--static");
    }
    if (opts.inverted) {
      stream.classList.add("work__stream--invert");
    }
    if (!text) return stream;

    var lineChars = opts.lineChars || (opts.wordSpaced ? levaDefaultLineChars() : STREAM_LINE_CHARS);
    opts.lineChars = lineChars;
    var lines = opts.wordSpaced
      ? streamLinesContinuous(text, lineChars)
      : streamLinesFixed(text, lineChars);
    var viewport = document.createElement("div");
    viewport.className = "work__stream-viewport";
    var track = document.createElement("div");
    track.className = "work__stream-track";
    track.appendChild(createStreamColumn(lines, opts));
    if (!opts.static) {
      var duration = Math.min(520, Math.max(88, Math.round(lines.length * 2.1)));
      stream.style.setProperty("--work-stream-duration", duration + "s");
      var copy = createStreamColumn(lines, opts);
      copy.setAttribute("aria-hidden", "true");
      track.appendChild(copy);
    }
    viewport.appendChild(track);
    stream.appendChild(viewport);
    if (opts.triptychScroll && !opts.static) {
      stream.classList.add("work__stream--triptych-scroll");
      bindTriptychStreamLoop(stream);
    }
    return stream;
  }

  function triptychScrollDurationMs(stream) {
    var raw = stream.style.getPropertyValue("--work-stream-duration").trim();
    if (!raw) return 140000;
    if (raw.indexOf("ms") !== -1) return Math.max(1, parseFloat(raw));
    return Math.max(1, parseFloat(raw) * 1000);
  }

  function bindTriptychStreamLoop(stream) {
    var track = stream.querySelector(".work__stream-track");
    if (!track || typeof track.animate !== "function") return;

    var inverted = stream.classList.contains("work__stream--invert");
    var scrollAnim = null;

    function layoutTrack() {
      track.style.position = "absolute";
      track.style.top = "0";
      track.style.left = "0";
      track.style.right = "0";
      track.style.width = "100%";
      track.style.transform = "none";
      track.style.animation = "none";
    }

    function startScroll() {
      layoutTrack();
      var half = track.scrollHeight / 2;
      if (!half || half < 2) return false;
      if (scrollAnim) scrollAnim.cancel();
      scrollAnim = track.animate(
        [{ top: "0px" }, { top: -half + "px" }],
        {
          duration: triptychScrollDurationMs(stream),
          iterations: Infinity,
          easing: "linear",
          direction: inverted ? "reverse" : "normal",
        }
      );
      return true;
    }

    function ensureScroll() {
      if (startScroll()) return;
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(ensureScroll);
      }
    }

    ensureScroll();
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        ensureScroll();
      });
    }
    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function () {
        startScroll();
      });
      ro.observe(track);
    } else if (typeof window !== "undefined") {
      window.addEventListener("resize", startScroll);
    }
  }

  var LEVA_COLUMN_COUNT = 3;

  function buildLevaTextFrame(entry) {
    var single = levaUseSingleColumn();
    var columnCount = single ? 1 : LEVA_COLUMN_COUNT;
    var canvas = document.createElement("div");
    canvas.className =
      "leva-canvas leva-canvas--triptych" + (single ? " leva-canvas--single" : "");
    var frame = document.createElement("div");
    frame.className =
      "leva-frame leva-frame--triptych" + (single ? " leva-frame--single" : "");
    for (var i = 0; i < columnCount; i += 1) {
      var invert = !single && i !== 1;
      var slot = document.createElement("div");
      slot.className = "leva-frame__slot leva-frame__slot--column";
      if (invert) {
        slot.classList.add("leva-frame__slot--invert");
      }
      slot.appendChild(
        buildWorkTextStream(entry, {
          inverted: invert,
          wordSpaced: true,
          triptychScroll: true,
        })
      );
      frame.appendChild(slot);
    }
    canvas.appendChild(frame);
    return canvas;
  }

  function mountLevaLegend(host) {
    if (!host) return;
    host.innerHTML = "";
    host.hidden = true;
    host.classList.remove("leva-legend--notes");
  }

  function mountLevaFrame(host, entry) {
    if (!host || !entry) return;
    host._avvLevaEntry = entry;
    host.innerHTML = "";
    host.appendChild(buildLevaTextFrame(entry));
  }

  var levaResizeTimer = 0;
  var levaLayoutWidth = 0;
  var levaLayoutSingle = null;

  function remountActiveLevaFrames() {
    if (typeof document === "undefined") return;
    document.querySelectorAll("[data-leva-frame]").forEach(function (host) {
      var work = host.closest(".work.work--leva");
      if (!work || !work.classList.contains("is-active")) return;
      var entry = host._avvLevaEntry;
      if (entry) mountLevaFrame(host, entry);
    });
  }

  function onLevaViewportLayoutChange() {
    if (typeof window === "undefined") return;
    var width = window.innerWidth;
    var single = levaUseSingleColumn();
    var modeChanged = levaLayoutSingle !== null && levaLayoutSingle !== single;
    if (!modeChanged && Math.abs(width - levaLayoutWidth) < 32) return;
    levaLayoutWidth = width;
    levaLayoutSingle = single;
    if (!single && !modeChanged) return;
    window.clearTimeout(levaResizeTimer);
    levaResizeTimer = window.setTimeout(remountActiveLevaFrames, 280);
  }

  if (typeof window !== "undefined") {
    levaLayoutWidth = window.innerWidth;
    levaLayoutSingle = levaUseSingleColumn();
    window.addEventListener("resize", onLevaViewportLayoutChange);
    window.addEventListener("orientationchange", function () {
      levaLayoutWidth = 0;
      levaLayoutSingle = null;
      window.clearTimeout(levaResizeTimer);
      levaResizeTimer = window.setTimeout(onLevaViewportLayoutChange, 400);
    });
  }

  global.avvBuildWorkTextStream = buildWorkTextStream;
  global.avvMountLevaFrame = mountLevaFrame;
  global.avvMountLevaLegend = mountLevaLegend;
  global.avvLevaTextEntry = function (items) {
    return (
      items.find(function (entry) {
        return entry.textStream || (Array.isArray(entry.text) && entry.text.length);
      }) || items[0]
    );
  };
})(typeof window !== "undefined" ? window : globalThis);
