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
const ZOOM = 1.9;
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let pointer = { x: -9999, y: -9999 };
let navelOn = false;
let raf = 0;

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

function paintFlow(flow) {
  const p = flow.el;
  const items = flow.items;
  const prepared = flow.prepared;
  const lineHeight = flow.lineHeight;
  const width = flow.width;
  p.innerHTML = "";
  p.classList.add("umbigo-flow");

  const rows = [];
  let cursor;
  let index = 0;

  while (index < 80) {
    const next = consume(prepared, width, cursor);
    if (!next) break;
    rows.push(next);
    cursor = next.end;
    index += 1;
    if (!cursor) break;
  }

  rows.forEach(function (row, rowIndex) {
    const last = rowIndex === rows.length - 1;
    const el = document.createElement("span");
    el.className = "umbigo-flow__line";
    el.style.height = lineHeight + "px";
    paintFragments(el, row.line, items, row.maxWidth, !last);
    p.appendChild(el);
  });

  p.style.height = rows.length * lineHeight + "px";
}

function compileParagraph(p, width) {
  restore(p);
  remember(p);
  if (p.classList.contains("umbigo-kicker")) return null;
  const cs = getComputedStyle(p);
  const items = itemsFromElement(p, cs);
  if (!items.length) return null;
  return {
    el: p,
    items: items,
    prepared: prepareRichInline(items),
    lineHeight: lineHeightPx(cs),
    width: width,
  };
}

function isSimpleView() {
  return (
    window.matchMedia("(max-width: 767px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function layoutSection(section) {
  const navel = section.querySelector(".umbigo-navel");
  const verse = section.querySelector(".umbigo-verse");
  const essay = section.querySelector(".umbigo-essay");
  if (!verse) return;

  setLocale(section.getAttribute("lang") || "pt");
  if (navel) fitNavel(navel);
  else shrinkVerse(verse);

  if (!essay) return;

  essay.querySelectorAll("p").forEach(restore);
  if (isSimpleView()) return;

  const width = Math.floor(essay.clientWidth);
  if (width < 160) return;

  essay.querySelectorAll("p").forEach(function (p) {
    const flow = compileParagraph(p, width);
    if (!flow) return;
    paintFlow(flow);
  });
}

function layoutVisible() {
  const section = visibleSection();
  if (!section) return;
  try {
    layoutSection(section);
  } catch (error) {
    console.warn("Pretext layout skipped", error);
    section.querySelectorAll(".umbigo-verse, .umbigo-essay p").forEach(restore);
  }
  fillLens();
}

function setNavel(on) {
  if (on === navelOn) return;
  navelOn = on;
  const dot = document.querySelector(".cursor-dot");
  if (dot) dot.classList.toggle("is-navel", on);
  document.body.classList.toggle("is-umbigo-navel", on);
}

function copySource() {
  return document.querySelector(".umbigo-copy");
}

function fillLens() {
  const dot = document.querySelector(".cursor-dot");
  if (!dot) return;
  let scene = dot.querySelector(".cursor-dot__scene");
  if (!scene) {
    scene = document.createElement("div");
    scene.className = "cursor-dot__scene";
    scene.setAttribute("aria-hidden", "true");
    dot.appendChild(scene);
  }
  const source = copySource();
  scene.innerHTML = "";
  if (!source) return;
  const clone = source.cloneNode(true);
  clone.querySelectorAll("script").forEach(function (node) {
    node.remove();
  });
  scene.style.width = source.offsetWidth + "px";
  scene.appendChild(clone);
}

function overEssay() {
  const essay = document.querySelector(
    ".umbigo-copy section:not([hidden]) .umbigo-essay"
  );
  if (!essay) return false;
  const rect = essay.getBoundingClientRect();
  return (
    pointer.x >= rect.left &&
    pointer.x <= rect.right &&
    pointer.y >= rect.top &&
    pointer.y <= rect.bottom
  );
}

function updateLens() {
  const dot = document.querySelector(".cursor-dot");
  const source = copySource();
  if (!dot || !source) return;
  const scene = dot.querySelector(".cursor-dot__scene");
  if (!scene) return;
  const rect = source.getBoundingClientRect();
  const r = dot.offsetWidth / 2;
  const lx = pointer.x - rect.left;
  const ly = pointer.y - rect.top;
  scene.style.transform =
    "translate(" +
    (r - lx * ZOOM) +
    "px, " +
    (r - ly * ZOOM) +
    "px) scale(" +
    ZOOM +
    ")";
}

function tickNavel() {
  raf = 0;
  setNavel(overEssay());
  if (navelOn) updateLens();
}

function onPointerMove(event) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (raf) return;
  raf = window.requestAnimationFrame(tickNavel);
}

function onPointerLeave() {
  pointer.x = -9999;
  pointer.y = -9999;
  if (raf) window.cancelAnimationFrame(raf);
  raf = window.requestAnimationFrame(tickNavel);
}

let timer = 0;
let lastWidth = 0;

function schedule() {
  window.clearTimeout(timer);
  timer = window.setTimeout(layoutVisible, 60);
}

function onResize() {
  const width = window.innerWidth;
  if (Math.abs(width - lastWidth) < 2) return;
  lastWidth = width;
  schedule();
}

lastWidth = window.innerWidth;
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(layoutVisible);
} else {
  layoutVisible();
}

window.addEventListener("resize", onResize);
window.addEventListener("orientationchange", function () {
  window.setTimeout(layoutVisible, 400);
});
document.addEventListener("avv-lang", schedule);
window.matchMedia("(max-width: 767px)").addEventListener("change", schedule);
window.matchMedia("(pointer: coarse)").addEventListener("change", schedule);

if (canHover.matches && !reduceMotion.matches) {
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("mouseleave", onPointerLeave);
}
