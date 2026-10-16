import {
  measureNaturalWidth,
  prepareWithSegments,
  setLocale,
} from "https://esm.sh/@chenglou/pretext@0.0.8";
import {
  layoutNextRichInlineLineRange,
  materializeRichInlineLineRange,
  prepareRichInline,
} from "https://esm.sh/@chenglou/pretext@0.0.8/rich-inline";

const originals = new WeakMap();
const MIN_SEG = 28;

function visibleSection() {
  return document.querySelector(".umbigo-copy section:not([hidden])");
}

function remember(el) {
  if (!originals.has(el)) originals.set(el, el.innerHTML);
  return originals.get(el);
}

function restore(el) {
  if (originals.has(el)) el.innerHTML = originals.get(el);
  el.style.width = "";
  el.style.height = "";
  el.style.fontSize = "";
  el.style.whiteSpace = "";
  el.classList.remove("umbigo-flow");
}

function fontShorthand(cs, weight, style) {
  const w = weight || cs.fontWeight;
  const s = style || cs.fontStyle;
  const prefix = s && s !== "normal" ? s + " " : "";
  return prefix + w + " " + cs.fontSize + "/" + cs.lineHeight + " " + cs.fontFamily;
}

function lineHeightPx(cs) {
  const value = cs.lineHeight;
  if (value === "normal") return parseFloat(cs.fontSize) * 1.68;
  return parseFloat(value);
}

function itemsFromElement(el, cs) {
  const items = [];

  function walk(node, weight, style) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) {
        items.push({
          text: node.textContent,
          font: fontShorthand(cs, weight, style),
        });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    const nextWeight = tag === "STRONG" || tag === "B" ? "700" : weight;
    const nextStyle = tag === "EM" || tag === "I" ? "italic" : style;
    node.childNodes.forEach(function (child) {
      walk(child, nextWeight, nextStyle);
    });
  }

  el.childNodes.forEach(function (child) {
    walk(child, cs.fontWeight, cs.fontStyle);
  });
  return items;
}

function spaceCount(line) {
  return line.fragments.reduce(function (sum, frag) {
    const extra = frag.gapBefore ? 1 : 0;
    return sum + extra + (frag.text.match(/ /g) || []).length;
  }, 0);
}

function shrinkVerse(verse) {
  restore(verse);
  remember(verse);
  let widest = 0;
  verse.querySelectorAll("p").forEach(function (line) {
    const cs = getComputedStyle(line);
    const prepared = prepareWithSegments(line.textContent, fontShorthand(cs), {
      whiteSpace: "nowrap",
    });
    widest = Math.max(widest, measureNaturalWidth(prepared));
  });
  const max = verse.parentElement ? verse.parentElement.clientWidth : widest;
  verse.style.width = Math.min(widest + 2, max) + "px";
}

function fitNavel(navel) {
  const verse = navel.querySelector(".umbigo-verse");
  if (verse) {
    restore(verse);
    remember(verse);
    verse.style.width = "";
  }
  navel.style.width = "";
  navel.style.height = "";
}

function consume(prepared, width, cursor) {
  if (width < MIN_SEG) return null;
  const range = layoutNextRichInlineLineRange(prepared, width, cursor);
  if (!range) return null;
  return {
    line: materializeRichInlineLineRange(prepared, range),
    maxWidth: width,
    end: range.end,
  };
}

function paintFragments(parent, line, items, maxWidth, justify) {
  line.fragments.forEach(function (frag) {
    const span = document.createElement("span");
    span.textContent = (frag.gapBefore ? " " : "") + frag.text;
    span.style.font = items[frag.itemIndex].font;
    if (/\b(700|800|900|bold)\b/.test(items[frag.itemIndex].font)) {
      span.className = "umbigo-emph";
    }
    parent.appendChild(span);
  });
  const leftover = maxWidth - line.width;
  const spaces = spaceCount(line);
  if (justify && spaces && leftover > 0.5) {
    parent.style.wordSpacing = leftover / spaces + "px";
  }
}

const preparedCache = new WeakMap();
const FLOAT_PAD = 14;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function workRoot() {
  const work = document.querySelector(".work.work--umbigo");
  if (work) return work;
  if (document.body.classList.contains("umbigo-page")) return document.body;
  return null;
}

function motionOn() {
  const root = workRoot();
  return Boolean(root && root.classList.contains("is-umbigo-motion"));
}

function motionAllowed() {
  const root = workRoot();
  if (!root || root.offsetWidth < 40 || isSimpleView()) return false;
  if (root === document.body) return true;
  return document.body.classList.contains("site-page");
}

function sectionFolhas(section) {
  return section ? section.querySelector(".umbigo-folhas") : null;
}

function buildFolhas(section) {
  if (!section || section.querySelector(".umbigo-folhas")) return;
  const essay = section.querySelector(".umbigo-essay");
  if (!essay) return;
  const paragraphs = Array.from(essay.children).filter(function (el) {
    return el.tagName === "P";
  });
  if (!paragraphs.length) return;

  const folhas = document.createElement("div");
  folhas.className = "umbigo-folhas";

  let index = 0;
  while (index < paragraphs.length) {
    const sheet = document.createElement("article");
    sheet.className = "umbigo-sheet umbigo-sheet--chunk";
    const first = paragraphs[index];
    const chunk =
      index === 0 && first.classList.contains("umbigo-kicker")
        ? Math.min(3, paragraphs.length)
        : Math.min(2, paragraphs.length - index);
    for (let i = 0; i < chunk; i += 1) {
      sheet.appendChild(paragraphs[index]);
      index += 1;
    }
    const n = folhas.children.length + 1;
    if (n % 2 === 0) {
      sheet.classList.add(n % 4 === 0 ? "umbigo-sheet--tilt-b" : "umbigo-sheet--tilt-a");
    }
    folhas.appendChild(sheet);
  }
  essay.replaceWith(folhas);
}

const heroLabelSpot = { x: 0, y: 0, ready: false };
let heroLabelDrag = null;

function heroStage() {
  return document.querySelector(".umbigo-hero__stage");
}

function heroLabelEl() {
  return document.querySelector(".umbigo-hero__label");
}

function heroLayoutReady() {
  if (!document.body.classList.contains("site-page")) return true;
  const work = workRoot();
  return Boolean(work && work.classList.contains("is-active"));
}

function heroLabelBounds() {
  const stage = heroStage();
  const label = heroLabelEl();
  if (!stage || !label) return null;
  const pad = 8;
  const stageRect = stage.getBoundingClientRect();
  let minViewportTop = pad;
  let maxViewportBottom = window.innerHeight - pad;
  if (document.body.classList.contains("site-page")) {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const topClear = parseFloat(styles.getPropertyValue("--site-top-clearance"));
    const bottomClear = parseFloat(styles.getPropertyValue("--site-bottom-clearance"));
    if (Number.isFinite(topClear)) minViewportTop = topClear;
    if (Number.isFinite(bottomClear)) {
      maxViewportBottom = window.innerHeight - bottomClear;
    }
  }
  const minY = Math.max(pad, minViewportTop - stageRect.top);
  const maxY = Math.max(
    minY,
    maxViewportBottom - stageRect.top - label.offsetHeight
  );
  return {
    minX: pad,
    maxX: Math.max(pad, stage.clientWidth - label.offsetWidth - pad),
    minY: minY,
    maxY: maxY,
  };
}

function syncHeroLabelPosition(reset) {
  const stage = heroStage();
  const label = heroLabelEl();
  if (!stage || !label) return;
  if (!heroLayoutReady()) return;
  if (reset || !heroLabelSpot.ready) {
    label.style.left = "";
    label.style.top = "";
    label.style.right = "";
    label.style.bottom = "";
    const stageRect = stage.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    if (labelRect.width < 2) return;
    heroLabelSpot.x = labelRect.left - stageRect.left;
    heroLabelSpot.y = labelRect.top - stageRect.top;
    heroLabelSpot.ready = true;
  }
  const bounds = heroLabelBounds();
  if (bounds) {
    heroLabelSpot.x = clamp(heroLabelSpot.x, bounds.minX, bounds.maxX);
    heroLabelSpot.y = clamp(heroLabelSpot.y, bounds.minY, bounds.maxY);
  }
  label.style.left = heroLabelSpot.x + "px";
  label.style.top = heroLabelSpot.y + "px";
  label.style.right = "auto";
  label.style.bottom = "auto";
}

function moveHeroLabel(clientX, clientY) {
  if (!heroLabelDrag) return;
  const label = heroLabelDrag.label;
  const dx = clientX - heroLabelDrag.pointerX;
  const dy = clientY - heroLabelDrag.pointerY;
  const next = clampHeroLabel(heroLabelDrag.originX + dx, heroLabelDrag.originY + dy);
  heroLabelSpot.x = next.x;
  heroLabelSpot.y = next.y;
  label.style.left = next.x + "px";
  label.style.top = next.y + "px";
}

function clampHeroLabel(x, y) {
  const bounds = heroLabelBounds();
  if (!bounds) return { x: x, y: y };
  return {
    x: clamp(x, bounds.minX, bounds.maxX),
    y: clamp(y, bounds.minY, bounds.maxY),
  };
}

function initHeroLabel() {
  if (!heroLayoutReady()) return;
  if (document.body.classList.contains("site-page")) {
    heroLabelSpot.ready = false;
  }
  syncHeroLabelPosition(document.body.classList.contains("site-page"));
}

function ringBounds(poem) {
  const track = poem ? poem.closest(".umbigo-canvas") || poem : null;
  const ring = poem ? poem.querySelector(":scope > .umbigo-navel__ring") : null;
  if (!track || !ring || !poem) return { min: -80, max: 80 };
  const ringWidth = ring.offsetWidth;
  if (ringWidth < 4) return { min: -80, max: 80 };

  const trackRect = track.getBoundingClientRect();
  const poemRect = poem.getBoundingClientRect();
  const anchorX = poemRect.left + poem.offsetWidth * 0.5;
  const radius = ringWidth * 0.5;
  const pad = 8;
  const minCenter = trackRect.left + radius + pad;
  const maxCenter = trackRect.right - radius - pad;
  if (maxCenter <= minCenter) return { min: 0, max: 0 };

  return {
    min: minCenter - anchorX,
    max: maxCenter - anchorX,
  };
}

function fitRingToPoem(poem) {
  const ring = poem.querySelector(":scope > .umbigo-navel__ring");
  if (!ring) return;
  const width = poem.offsetWidth;
  const height = poem.offsetHeight;
  if (width < 4 || height < 4) return;
  const size = Math.max(width, height);
  ring.style.width = size + "px";
  ring.style.height = size + "px";
}

function syncRingTrack(poem) {
  const bounds = ringBounds(poem);
  poem.style.setProperty("--umbigo-ring-min", bounds.min + "px");
  poem.style.setProperty("--umbigo-ring-max", bounds.max + "px");
}

function initPoemRing(poem) {
  if (!poem) return;
  fitRingToPoem(poem);
  syncRingTrack(poem);
}

function visiblePoem() {
  return document.querySelector(".umbigo-poem:not([hidden])");
}

function floatBox() {
  return sectionFolhas(visibleSection());
}

function floatItems() {
  const folhas = floatBox();
  if (!folhas) return [];
  return Array.from(folhas.querySelectorAll(".umbigo-sheet--chunk"));
}

const spots = new WeakMap();
let pinsReady = false;
let drag = null;

function clearFloatMotion() {
  const root = workRoot();
  const folhas = floatBox();
  if (folhas) {
    folhas.style.minHeight = "";
    folhas.classList.remove("is-folhas-motion");
  }
  if (root) {
    root.classList.remove("is-umbigo-motion");
    root.querySelectorAll(".umbigo-sheet--chunk").forEach(function (fig) {
      fig.style.left = "";
      fig.style.top = "";
      fig.classList.remove("is-dragging");
      spots.delete(fig);
    });
  }
  pinsReady = false;
  drag = null;
}

function applyPins() {
  floatItems().forEach(function (fig) {
    const spot = spots.get(fig);
    if (!spot) return;
    fig.style.left = spot.x + "px";
    fig.style.top = spot.y + "px";
  });
}

function refreshMotionExtents() {
  const folhas = floatBox();
  if (!folhas || !motionOn()) return;
  let maxBottom = 0;
  floatItems().forEach(function (fig) {
    const spot = spots.get(fig);
    if (!spot) return;
    maxBottom = Math.max(maxBottom, spot.y + fig.offsetHeight);
  });
  folhas.style.minHeight = maxBottom + 32 + "px";
}

function pinFloats() {
  const folhas = floatBox();
  const root = workRoot();
  if (!folhas || !root || !floatItems().length) return;
  if (!pinsReady) {
    const boxRect = folhas.getBoundingClientRect();
    floatItems().forEach(function (fig) {
      const rect = fig.getBoundingClientRect();
      spots.set(fig, {
        x: rect.left - boxRect.left,
        y: rect.top - boxRect.top,
      });
    });
    folhas.style.minHeight = folhas.offsetHeight + "px";
    folhas.classList.add("is-folhas-motion");
    root.classList.add("is-umbigo-motion");
    pinsReady = true;
  } else if (!root.classList.contains("is-umbigo-motion")) {
    root.classList.add("is-umbigo-motion");
  }
  applyPins();
  refreshMotionExtents();
}

function moveDrag(clientX, clientY) {
  if (!drag) return;
  const box = floatBox();
  if (!box) return;
  const fig = drag.fig;
  const width = fig.offsetWidth;
  const height = fig.offsetHeight;
  const x = clamp(drag.originX + (clientX - drag.pointerX), 0, Math.max(0, box.clientWidth - width));
  const y = clamp(
    drag.originY + (clientY - drag.pointerY),
    0,
    Math.max(0, box.clientHeight - height)
  );
  spots.set(fig, { x: x, y: y });
  fig.style.left = x + "px";
  fig.style.top = y + "px";
  refreshMotionExtents();
}

function subtractGap(gaps, cutL, cutR) {
  const next = [];
  gaps.forEach(function (gap) {
    if (cutR <= gap.start || cutL >= gap.end) {
      next.push(gap);
      return;
    }
    if (cutL > gap.start) next.push({ start: gap.start, end: Math.min(cutL, gap.end) });
    if (cutR < gap.end) next.push({ start: Math.max(cutR, gap.start), end: gap.end });
  });
  return next;
}

function pickGap(gaps, prevX) {
  let best = null;
  gaps.forEach(function (gap) {
    const width = gap.end - gap.start;
    if (width < MIN_SEG) return;
    const candidate = { start: gap.start, end: gap.end, width: width };
    if (!best || width > best.width + 10) {
      best = candidate;
      return;
    }
    if (Math.abs(width - best.width) <= 10 && Math.abs(gap.start - prevX) < Math.abs(best.start - prevX)) {
      best = candidate;
    }
  });
  return best;
}

function lineGaps(left, right, lineTop, lineBottom) {
  let gaps = [{ start: left, end: right }];
  if (!motionOn()) return gaps;
  floatItems().forEach(function (fig) {
    const rect = fig.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    if (rect.bottom < lineTop + 1 || rect.top > lineBottom - 1) return;
    gaps = subtractGap(gaps, rect.left - FLOAT_PAD, rect.right + FLOAT_PAD);
  });
  return gaps;
}

function paintFlow(flow) {
  const p = flow.el;
  const items = flow.items;
  const prepared = flow.prepared;
  const lineHeight = flow.lineHeight;
  const box = p.getBoundingClientRect();
  const originTop = box.top;
  const originLeft = box.left;
  const fullWidth = Math.max(MIN_SEG, box.width);
  p.innerHTML = "";
  p.classList.add("umbigo-flow");

  const rows = [];
  let cursor;
  let index = 0;
  let prevX = originLeft;

  while (index < 120) {
    const gaps = lineGaps(originLeft, originLeft + fullWidth, originTop + rows.length * lineHeight, originTop + (rows.length + 1) * lineHeight);
    const gap = pickGap(gaps, prevX) || {
      start: originLeft,
      end: originLeft + fullWidth,
      width: fullWidth,
    };
    const next = consume(prepared, gap.width, cursor);
    if (!next || next.end === cursor) break;
    rows.push({
      line: next.line,
      maxWidth: gap.width,
      x: gap.start - originLeft,
    });
    prevX = gap.start;
    cursor = next.end;
    index += 1;
    if (!cursor) break;
  }

  rows.forEach(function (row, rowIndex) {
    const last = rowIndex === rows.length - 1;
    const el = document.createElement("span");
    el.className = "umbigo-flow__line";
    el.style.height = lineHeight + "px";
    el.style.marginLeft = row.x + "px";
    el.style.width = row.maxWidth + "px";
    paintFragments(el, row.line, items, row.maxWidth, !last);
    p.appendChild(el);
  });

  p.style.height = Math.max(rows.length, 1) * lineHeight + "px";
}

function compileParagraph(p) {
  const cs = getComputedStyle(p);
  const fontSize = cs.fontSize;
  const cached = preparedCache.get(p);
  if (cached && cached.fontSize === fontSize) {
    cached.lineHeight = lineHeightPx(cs);
    return cached;
  }
  restore(p);
  remember(p);
  if (p.classList.contains("umbigo-kicker")) return null;
  const items = itemsFromElement(p, getComputedStyle(p));
  if (!items.length) return null;
  const flow = {
    el: p,
    items: items,
    prepared: prepareRichInline(items),
    lineHeight: lineHeightPx(getComputedStyle(p)),
    fontSize: fontSize,
  };
  preparedCache.set(p, flow);
  return flow;
}

function isSimpleView() {
  return (
    window.matchMedia("(max-width: 767px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function layoutPoem(poem, options) {
  if (!poem) return;
  const navel = poem.querySelector(".umbigo-navel");
  const verse = poem.querySelector(".umbigo-verse");
  const withVerse = !options || options.verse !== false;
  if (!verse) return;

  setLocale(poem.getAttribute("data-lang-panel") || poem.getAttribute("lang") || "pt");
  if (withVerse) {
    if (navel) fitNavel(navel);
    else shrinkVerse(verse);
    initPoemRing(poem);
  }
}

function layoutVisible(options) {
  document.querySelectorAll(".umbigo-copy section").forEach(buildFolhas);
  const poem = visiblePoem();
  try {
    clearFloatMotion();
    layoutPoem(poem, options);
    initHeroLabel();
    if (motionAllowed()) pinFloats();
  } catch (error) {
    console.warn("Pretext layout skipped", error);
    document.querySelectorAll(".umbigo-verse, .umbigo-essay p").forEach(restore);
  }
}

let timer = 0;
let lastWidth = 0;

function schedule() {
  window.clearTimeout(timer);
  timer = window.setTimeout(function () {
    layoutVisible();
  }, 60);
}

function onResize() {
  const width = window.innerWidth;
  if (Math.abs(width - lastWidth) < 2) return;
  lastWidth = width;
  heroLabelSpot.ready = false;
  clearFloatMotion();
  schedule();
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  const label = event.target.closest(".umbigo-hero__label");
  if (label) {
    syncHeroLabelPosition(false);
    heroLabelDrag = {
      label: label,
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: heroLabelSpot.x,
      originY: heroLabelSpot.y,
    };
    label.classList.add("is-dragging");
    if (label.setPointerCapture) label.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }
  if (!motionOn()) return;
  const sheet = event.target.closest(".umbigo-folhas .umbigo-sheet--chunk");
  const spot = sheet ? spots.get(sheet) : null;
  if (!sheet || !spot) return;
  drag = {
    fig: sheet,
    pointerId: event.pointerId,
    pointerX: event.clientX,
    pointerY: event.clientY,
    originX: spot.x,
    originY: spot.y,
  };
  sheet.classList.add("is-dragging");
  if (sheet.setPointerCapture) sheet.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onPointerMove(event) {
  if (heroLabelDrag && event.pointerId === heroLabelDrag.pointerId) {
    moveHeroLabel(event.clientX, event.clientY);
    return;
  }
  if (!drag || event.pointerId !== drag.pointerId) return;
  moveDrag(event.clientX, event.clientY);
}

function onPointerUp(event) {
  if (heroLabelDrag && event.pointerId === heroLabelDrag.pointerId) {
    heroLabelDrag.label.classList.remove("is-dragging");
    if (heroLabelDrag.label.releasePointerCapture) {
      try {
        heroLabelDrag.label.releasePointerCapture(event.pointerId);
      } catch (error) {
        /* already released */
      }
    }
    heroLabelDrag = null;
    return;
  }
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag.fig.classList.remove("is-dragging");
  if (drag.fig.releasePointerCapture) {
    try {
      drag.fig.releasePointerCapture(event.pointerId);
    } catch (error) {
      /* already released */
    }
  }
  drag = null;
  layoutPoem(visiblePoem(), { verse: true });
}

function watchWorkOpen() {
  const root = workRoot();
  if (!root || root.dataset.dragWatch) return;
  root.dataset.dragWatch = "1";
  let wasActive = root.classList.contains("is-active");
  const obs = new MutationObserver(function () {
    const active = root.classList.contains("is-active");
    if (active && !wasActive) {
      clearFloatMotion();
      schedule();
    }
    wasActive = active;
  });
  obs.observe(root, { attributes: true, attributeFilter: ["class"] });
}

lastWidth = window.innerWidth;
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(layoutVisible);
} else {
  layoutVisible();
}

window.addEventListener("resize", onResize);
window.addEventListener("orientationchange", function () {
  window.setTimeout(function () {
    clearFloatMotion();
    layoutVisible();
  }, 400);
});
document.addEventListener("avv-lang", function () {
  clearFloatMotion();
  schedule();
});
document.addEventListener("umbigo-mounted", function () {
  watchWorkOpen();
  schedule();
});
window.matchMedia("(max-width: 767px)").addEventListener("change", function () {
  clearFloatMotion();
  schedule();
});
window.matchMedia("(pointer: coarse)").addEventListener("change", function () {
  clearFloatMotion();
  schedule();
});
document.querySelectorAll(".umbigo-hero__photo img").forEach(function (img) {
  if (img.complete) return;
  img.addEventListener("load", function () {
    heroLabelSpot.ready = false;
    schedule();
  });
});
document.addEventListener("pointerdown", onPointerDown);
document.addEventListener("pointermove", onPointerMove);
document.addEventListener("pointerup", onPointerUp);
document.addEventListener("pointercancel", onPointerUp);
