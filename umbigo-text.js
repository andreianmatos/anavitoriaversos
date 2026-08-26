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
  return (
    (weight || cs.fontWeight) +
    " " +
    (style || cs.fontStyle) +
    " " +
    cs.fontSize +
    "/" +
    cs.lineHeight +
    " " +
    cs.fontFamily
  );
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
    return sum + (frag.text.match(/ /g) || []).length;
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
  const compact = window.matchMedia("(max-width: 639px)").matches;
  if (verse) {
    if (compact) {
      restore(verse);
      remember(verse);
      verse.style.width = "";
    } else {
      shrinkVerse(verse);
    }
  }
  navel.style.width = "";
  navel.style.height = "";
  const parent = navel.parentElement;
  const max = parent ? parent.clientWidth : navel.scrollWidth;
  const size = Math.ceil(Math.max(navel.scrollWidth, navel.scrollHeight));
  if (size <= max) {
    navel.style.width = size + "px";
    navel.style.height = size + "px";
    return;
  }
  navel.style.width = max + "px";
  navel.style.height = "";
}

function layoutParagraph(p, opts) {
  restore(p);
  remember(p);

  if (p.classList.contains("umbigo-kicker")) return;

  const cs = getComputedStyle(p);
  const lineHeight = lineHeightPx(cs);
  const items = itemsFromElement(p, cs);
  if (!items.length) return;

  const prepared = prepareRichInline(items);
  p.innerHTML = "";
  p.classList.add("umbigo-flow");

  let cursor;
  let index = 0;
  const rows = [];
  while (index < 80) {
    const range = layoutNextRichInlineLineRange(prepared, opts.width, cursor);
    if (!range) break;
    rows.push({
      line: materializeRichInlineLineRange(prepared, range),
      maxWidth: opts.width,
    });
    cursor = range.end;
    index += 1;
  }

  rows.forEach(function (row, rowIndex) {
    const last = rowIndex === rows.length - 1;
    const el = document.createElement("span");
    el.className = "umbigo-flow__line";
    el.style.height = lineHeight + "px";
    row.line.fragments.forEach(function (frag) {
      const span = document.createElement("span");
      if (frag.gapBefore) span.style.marginLeft = frag.gapBefore + "px";
      span.textContent = frag.text;
      span.style.font = items[frag.itemIndex].font;
      if (/\b(700|800|900|bold)\b/.test(items[frag.itemIndex].font)) {
        span.className = "umbigo-emph";
      }
      el.appendChild(span);
    });
    const leftover = row.maxWidth - row.line.width;
    const spaces = spaceCount(row.line);
    if (!last && spaces && leftover > 1 && leftover < row.maxWidth * 0.22) {
      el.style.wordSpacing = leftover / spaces + "px";
    }
    p.appendChild(el);
  });

  p.style.height = rows.length * lineHeight + "px";
}

function layoutSection(section) {
  const navel = section.querySelector(".umbigo-navel");
  const verse = section.querySelector(".umbigo-verse");
  const essay = section.querySelector(".umbigo-essay");
  if (!verse || !essay) return;

  const width = Math.min(essay.clientWidth, section.clientWidth);
  if (width < 160) return;

  setLocale(section.getAttribute("lang") || "pt");
  if (navel) fitNavel(navel);
  else shrinkVerse(verse);

  const compact = window.matchMedia("(max-width: 639px)").matches;
  if (compact) {
    essay.querySelectorAll("p").forEach(restore);
    return;
  }

  const opts = { width: width };

  essay.querySelectorAll("p").forEach(function (p) {
    layoutParagraph(p, opts);
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
