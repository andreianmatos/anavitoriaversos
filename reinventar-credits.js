import {
  measureNaturalWidth,
  prepareWithSegments,
} from "https://esm.sh/@chenglou/pretext@0.0.8";

const wired = new WeakSet();
const linkState = new WeakMap();
const WIDTH_TAIL = 2;

function fontFromElement(el) {
  const cs = getComputedStyle(el);
  const style = cs.fontStyle !== "normal" ? cs.fontStyle + " " : "";
  return style + cs.fontWeight + " " + cs.fontSize + "/" + cs.lineHeight + " " + cs.fontFamily;
}

function measureWithPretext(text, font) {
  const prepared = prepareWithSegments(String(text || "").trim().toUpperCase(), font, {
    whiteSpace: "nowrap",
  });
  return measureNaturalWidth(prepared);
}

function measureSpanWidth(el, font) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const dom = range.getBoundingClientRect().width;
  range.detach();
  const pretext = measureWithPretext(el.textContent, font);
  const width = Math.max(dom, pretext);
  return Math.max(1, Math.ceil(width) + WIDTH_TAIL);
}

function measureLink(link) {
  const term = link.querySelector(".reinventar-aroda__credit-term");
  const name = link.querySelector(".reinventar-aroda__credit-name");
  const swap = link.querySelector(".reinventar-aroda__credit-swap");
  if (!term || !name || !swap) return null;
  const font = fontFromElement(term);
  return {
    swap: swap,
    term: measureSpanWidth(term, font),
    name: measureSpanWidth(name, font),
    termEl: term,
    nameEl: name,
    font: font,
  };
}

function setSwapWidth(swap, px) {
  swap.style.width = Math.max(0, px) + "px";
}

function widthForVisible(link) {
  const state = linkState.get(link);
  if (!state) return 0;
  const showingName = link.classList.contains("is-name-visible") || link.matches(":hover, :focus-visible");
  const el = showingName ? state.nameEl : state.termEl;
  return measureSpanWidth(el, state.font);
}

function applyLinkWidth(link) {
  const state = linkState.get(link);
  if (!state) return;
  setSwapWidth(state.swap, widthForVisible(link));
}

function remeasureLink(link) {
  const next = measureLink(link);
  if (!next) return;
  linkState.set(link, next);
  applyLinkWidth(link);
}

function isStaticCredits() {
  return window.matchMedia("(hover: none), (pointer: coarse), (max-width: 1023px)").matches;
}

function wireCreditLink(link) {
  if (wired.has(link)) return;
  wired.add(link);

  if (isStaticCredits()) return;

  remeasureLink(link);

  function showName() {
    link.classList.add("is-name-visible");
    applyLinkWidth(link);
  }

  function showTerm() {
    link.classList.remove("is-name-visible");
    window.setTimeout(function () {
      if (!link.classList.contains("is-name-visible")) {
        applyLinkWidth(link);
      }
    }, 170);
  }

  applyLinkWidth(link);

  link.addEventListener("mouseenter", showName);
  link.addEventListener("mouseleave", showTerm);
  link.addEventListener("focus", showName);
  link.addEventListener("blur", showTerm);
}

function wireAll(root) {
  const links = Array.prototype.slice.call(root.querySelectorAll(".reinventar-aroda__credit-link"));
  if (!links.length) return;
  links.forEach(wireCreditLink);

  const host = root.querySelector(".reinventar-aroda__project-credits") || root;
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(function () {
      links.forEach(remeasureLink);
    });
    ro.observe(host);
  }
}

export function wireReinventarCredits(root) {
  if (!root) return;
  const run = function () {
    wireAll(root);
  };
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(run).catch(run);
  } else {
    run();
  }
}
