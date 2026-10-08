(function (global) {
  function panelUiScale(width, height) {
    const viewportScale = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")
    );
    const base =
      Number.isFinite(viewportScale) && viewportScale > 0 ? viewportScale : 1;
    const panelScale = Math.min(1.14, Math.max(0.72, Math.min(width / 1440, height / 820)));
    return Math.min(base, panelScale);
  }

  function getLayout(count, width, height, options) {
    const page = options && options.page;
    const panel = options && options.panel;
    const scale = panelUiScale(width, height);
    const padding = Math.max(10, Math.round(12 * scale));
    const gap = Math.max(14, Math.round(16 * scale));
    const itemPad = Math.max(6, Math.round(8 * scale));
    const chromePad = Math.max(4, Math.round(6 * scale));
    const innerW = Math.max(48, width - padding * 2);
    let innerH = Math.max(48, height - padding * 2);
    if (page) {
      innerH = Math.max(innerH, Math.round(height * 1.35));
    }
    const fill = Math.min(1, 16 / Math.max(count, 1));
    const narrow = innerW < 400;
    const sparse = count <= 10;

    let minRatio = (narrow ? 0.26 : 0.22) + 0.08 * fill;
    let maxRatio = (narrow ? 0.4 : 0.36) + 0.09 * fill;
    if (page) {
      minRatio += sparse ? 0.03 : 0.015;
      maxRatio += sparse ? 0.04 : 0.02;
    } else if (panel) {
      minRatio += sparse ? 0.025 : 0.01;
      maxRatio += sparse ? 0.035 : 0.018;
    }
    minRatio = Math.min(minRatio, page ? 0.34 : panel ? 0.32 : 0.3);
    const density = Math.min(1, 10 / Math.max(count, 1));
    minRatio *= 0.9 + 0.1 * density;
    maxRatio *= 0.86 + 0.14 * density;
    maxRatio = Math.min(
      Math.max(maxRatio, minRatio + 0.08),
      page ? 0.5 : panel ? 0.44 : 0.4
    );

    const imgMaxH = Math.max(
      56,
      Math.min(
        innerH * (page ? 0.46 : panel ? 0.4 : 0.38),
        innerW * (page ? 0.54 : panel ? 0.48 : 0.44),
        (page ? 420 : panel ? 320 : 280) * scale
      )
    );

    return {
      padding: padding,
      gap: gap,
      itemPad: itemPad,
      chromePad: chromePad,
      innerW: innerW,
      innerH: innerH,
      itemCount: count,
      minRatio: minRatio,
      maxRatio: maxRatio,
      imgMaxH: imgMaxH,
      maxAttempts: page ? 52 : panel ? 56 : 36,
      panelWidth: width,
      panelHeight: height,
      page: !!page,
      panel: !!panel,
      cellLoose: page ? 1.22 : panel ? 1.18 : 1.08,
    };
  }

  function spreadRegion(layout, placeIndex, minTop) {
    const count = Math.max(1, layout.itemCount || 1);
    const aspect = layout.innerW / Math.max(layout.innerH, 1);
    const cols = Math.max(2, Math.ceil(Math.sqrt(count * aspect)));
    const rows = Math.ceil(count / cols);
    const col = placeIndex % cols;
    const row = Math.floor(placeIndex / cols);
    const cellW = layout.innerW / cols;
    const cellH = layout.innerH / rows;
    const inset = layout.gap * (layout.page || layout.panel ? 0.14 : 0.28);

    return {
      minLeft: layout.padding + col * cellW + inset,
      maxLeft: layout.padding + (col + 1) * cellW - inset,
      minTop: minTop + row * cellH + inset,
      maxTop: minTop + (row + 1) * cellH - inset,
    };
  }

  function itemBox(itemW, imgH, aspect) {
    const h = Math.max(12, Math.round(Math.min(imgH, itemW / aspect)));
    const w = Math.max(12, Math.round(Math.min(itemW, h * aspect)));
    return { w: w, h: h };
  }

  function cellSize(layout, placeIndex, aspect) {
    const span = Math.max(0.08, layout.maxRatio - layout.minRatio);
    const mix = ((placeIndex + 1) * 0.6180339887) % 1;
    const mix2 = ((placeIndex + 5) * 0.467977) % 1;
    let w = layout.innerW * (layout.minRatio + span * mix);
    let h = Math.min(layout.imgMaxH, w / aspect);
    w = Math.min(w, h * aspect, layout.innerW * layout.maxRatio);
    const jitter = 0.86 + mix2 * 0.06;
    w = Math.max(layout.innerW * layout.minRatio * 0.82, w * jitter);
    h = Math.min(layout.imgMaxH, w / aspect);
    w = Math.min(w, h * aspect);
    return itemBox(w, h, aspect);
  }

  function itemRng(seed, placeIndex) {
    let state = (seed + Math.imul(placeIndex + 1, 2246822519)) >>> 0;
    return function () {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function overlaps(a, b, gap) {
    return !(
      a.right + gap < b.left ||
      a.left > b.right + gap ||
      a.bottom + gap < b.top ||
      a.top > b.bottom + gap
    );
  }

  function collides(rect, zones, gap) {
    for (let i = 0; i < zones.length; i += 1) {
      if (overlaps(rect, zones[i], gap)) {
        return true;
      }
    }
    return false;
  }

  function placedBottom(placed) {
    let bottom = 0;
    for (let i = 0; i < placed.length; i += 1) {
      if (placed[i].bottom > bottom) {
        bottom = placed[i].bottom;
      }
    }
    return bottom;
  }

  function outerSize(layout, itemW, itemH) {
    const chrome = layout.chromePad || 0;
    const btnPad = 6;
    return {
      w: itemW + chrome * 2 + btnPad,
      h: itemH + chrome * 2 + btnPad,
    };
  }

  function hitBox(left, top, outerW, outerH, layout) {
    const pad = layout.itemPad || 0;
    return {
      left: left - pad,
      top: top - pad,
      right: left + outerW + pad,
      bottom: top + outerH + pad,
    };
  }

  function tryRect(button, placed, layout, itemW, itemH, left, top) {
    const minTop = layout.padding;
    const outer = outerSize(layout, itemW, itemH);
    const maxLeft = Math.max(
      layout.padding,
      layout.panelWidth - layout.padding - outer.w
    );
    if (left < layout.padding - 0.25 || left > maxLeft + 0.25 || top < minTop - 0.25) {
      return null;
    }
    const rect = hitBox(left, top, outer.w, outer.h, layout);
    if (rect.right > layout.panelWidth - layout.padding + layout.itemPad + 0.25) {
      return null;
    }
    if (collides(rect, placed, layout.gap)) {
      return null;
    }
    button.style.left = Math.round(left) + "px";
    button.style.top = Math.round(top) + "px";
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    };
  }

  function placeInRegion(button, placed, layout, placeIndex, itemW, itemH) {
    const minTop = layout.padding;
    const outer = outerSize(layout, itemW, itemH);
    const maxLeft = Math.max(layout.padding, layout.panelWidth - layout.padding - outer.w);
    const region = spreadRegion(layout, placeIndex, minTop);
    const cx = (region.minLeft + region.maxLeft) / 2 - outer.w / 2;
    const cy = (region.minTop + region.maxTop) / 2 - outer.h / 2;
    const nudges = [
      [0, 0],
      [10, 0],
      [-10, 0],
      [0, 12],
      [0, -12],
      [14, 10],
      [-14, 10],
      [14, -10],
      [-14, -10],
      [22, 0],
      [-22, 0],
      [0, 22],
    ];

    for (let i = 0; i < nudges.length; i += 1) {
      const left = Math.min(maxLeft, Math.max(layout.padding, cx + nudges[i][0]));
      const top = Math.max(minTop, cy + nudges[i][1]);
      const rect = tryRect(button, placed, layout, itemW, itemH, left, top);
      if (rect) {
        return rect;
      }
    }

    return null;
  }

  function findPosition(button, placed, layout, itemW, itemH, rnd, placeIndex) {
    const minTop = layout.padding;
    const outer = outerSize(layout, itemW, itemH);
    const maxLeft = Math.max(layout.padding, layout.panelWidth - layout.padding - outer.w);
    const panelSpread =
      layout.panel ? Math.min(2.35, 0.92 + layout.itemCount * 0.12) : 1.02;
    const spreadH = layout.innerH * (layout.page ? 1.08 : panelSpread);
    const region = spreadRegion(layout, placeIndex, minTop);
    const rndBetween = function (min, max) {
      if (max <= min) {
        return min;
      }
      return min + rnd() * (max - min);
    };

    function tryAt(left, top) {
      return tryRect(button, placed, layout, itemW, itemH, left, top);
    }

    function bandLimits(bandMinLeft, bandMaxLeft, bandMinTop, bandMaxTop) {
      const leftLo = Math.max(layout.padding, Math.min(bandMinLeft, maxLeft));
      const leftHi = Math.max(leftLo, Math.min(bandMaxLeft, maxLeft));
      const topLo = Math.max(minTop, bandMinTop);
      const topHi = Math.max(topLo, Math.min(bandMaxTop - outer.h, minTop + spreadH - outer.h));
      return { leftLo: leftLo, leftHi: leftHi, topLo: topLo, topHi: topHi };
    }

    const regionBand = bandLimits(region.minLeft, region.maxLeft, region.minTop, region.maxTop);
    const fullBand = bandLimits(
      layout.padding,
      layout.padding + layout.innerW,
      minTop,
      minTop + spreadH
    );

    let rect;
    for (let attempt = 0; attempt < layout.maxAttempts; attempt += 1) {
      const inRegion = attempt > layout.maxAttempts * 0.62;
      const band = inRegion ? regionBand : fullBand;
      rect = tryAt(rndBetween(band.leftLo, band.leftHi), rndBetween(band.topLo, band.topHi));
      if (rect) {
        return rect;
      }
    }

    const cx = (regionBand.leftLo + regionBand.leftHi) / 2;
    const cy = (regionBand.topLo + regionBand.topHi) / 2;
    const anchors = [
      { left: cx, top: cy },
      { left: regionBand.leftLo, top: regionBand.topLo },
      { left: regionBand.leftHi, top: regionBand.topHi },
    ];
    for (let i = 0; i < anchors.length; i += 1) {
      rect = tryAt(anchors[i].left, anchors[i].top);
      if (rect) {
        return rect;
      }
    }

    for (let sweep = 0; sweep < 24; sweep += 1) {
      rect = tryAt(rndBetween(fullBand.leftLo, fullBand.leftHi), rndBetween(fullBand.topLo, fullBand.topHi));
      if (rect) {
        return rect;
      }
    }

    const stepY = outer.h + layout.gap;
    let scanTop = minTop;
    const bottomLimit = minTop + spreadH + layout.innerH * 0.55;
    while (scanTop <= bottomLimit) {
      const xs = [
        layout.padding,
        maxLeft,
        (layout.padding + maxLeft) / 2,
        rndBetween(layout.padding, maxLeft),
      ];
      for (let x = 0; x < xs.length; x += 1) {
        rect = tryAt(xs[x], scanTop);
        if (rect) {
          return rect;
        }
      }
      scanTop += stepY;
    }

    return null;
  }

  function placeItem(button, img, placed, layout, placeIndex, seed, deferReveal) {
    if (!img.naturalWidth) {
      button.remove();
      return null;
    }

    const rnd = itemRng(seed, placeIndex);
    const aspect = img.naturalWidth / img.naturalHeight;
    let itemW = 0;
    let imgH = 0;
    let rect = null;

    function applyThumb(w, h) {
      button.style.width = w + "px";
      button.style.setProperty("--archive-img-max-h", Math.floor(h) + "px");
      button.style.setProperty("--archive-cell-w", w + "px");
    }

    for (let shrink = 0; shrink < 7 && !rect; shrink += 1) {
      const scaleDown = 1 - shrink * (layout.page ? 0.045 : 0.055);
      const box = cellSize(layout, placeIndex, aspect);
      itemW = Math.max(40, Math.round(box.w * scaleDown));
      imgH = Math.max(30, Math.round(box.h * scaleDown));
      applyThumb(itemW, imgH);
      rect = findPosition(button, placed, layout, itemW, imgH, rnd, placeIndex);
      if (!rect) {
        rect = placeInRegion(button, placed, layout, placeIndex, itemW, imgH);
      }
    }

    if (!rect) {
      const box = cellSize(layout, placeIndex, aspect);
      itemW = Math.max(40, Math.round(box.w * 0.82));
      imgH = Math.max(30, Math.round(box.h * 0.82));
      applyThumb(itemW, imgH);
      rect = findPosition(button, placed, layout, itemW, imgH, rnd, placeIndex);
      if (!rect) {
        rect = placeInRegion(button, placed, layout, placeIndex, itemW, imgH);
      }
    }

    if (!rect || collides(rect, placed, layout.gap)) {
      button.remove();
      return null;
    }

    placed.push(rect);
    button.style.position = "absolute";
    button.style.setProperty(
      "--archive-enter-delay",
      Math.min(placeIndex, 28) * 0.03 + "s"
    );
    if (!deferReveal) {
      button.classList.remove("is-loading");
      button.classList.add("is-placed");
    }
    return placedBottom(placed) + layout.padding;
  }

  global.avvArchiveScatter = {
    getLayout: getLayout,
    placeItem: placeItem,
  };
})(window);
