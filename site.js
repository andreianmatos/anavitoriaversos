(function () {
  const imageDir = "imagens/arquivo/";
  const thumbDir = "imagens/arquivo/thumbs/";
  const manifestUrl = document.body.getAttribute("data-manifest") || "images.json";
  const works = document.getElementById("obras");
  const star = document.querySelector("[data-star]");
  const starRoll = document.querySelector("[data-star-roll]");
  const starAgain = document.querySelector("[data-star-again]");
  const siteHome = document.querySelector("[data-site-home]");
  const archivePanel = document.querySelector("[data-star-index]");
  const indexToggle = document.querySelector("[data-index-toggle]");
  const overlay = document.querySelector("[data-sobre-overlay]");
  const sobreToggle = document.querySelector("[data-sobre-toggle]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!archivePanel || !works || !star) return;

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  function lockScrollTop() {
    if (window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
  }

  lockScrollTop();
  window.addEventListener("load", lockScrollTop, { once: true });

  let manifest = [];
  let groups = [];
  let lastWorkId = "";
  let spinning = false;
  let scatterToken = 0;
  let archiveOpenGen = 0;
  let archivePanelRenderTimer = 0;
  let archiveLayoutWidth = 0;
  let archivePlacedCount = 0;

  function scheduleArchivePanelRender() {
    window.clearTimeout(archivePanelRenderTimer);
    archivePanelRenderTimer = window.setTimeout(function () {
      if (!document.body.classList.contains("is-index-open")) return;
      renderArchivePanel(false);
    }, 120);
  }

  function beginArchivePanelRender() {
    archiveOpenGen += 1;
    const gen = archiveOpenGen;

    function runRender() {
      if (gen !== archiveOpenGen) return;
      if (!document.body.classList.contains("is-index-open")) return;
      renderArchivePanel(true);
    }

    if (!starRoll || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      requestAnimationFrame(runRender);
      return;
    }

    let rendered = false;
    let fallbackTimer = 0;
    function runOnce() {
      if (rendered) return;
      rendered = true;
      starRoll.removeEventListener("transitionend", onHeightEnd);
      window.clearTimeout(fallbackTimer);
      runRender();
    }

    function onHeightEnd(event) {
      if (event.target !== starRoll || event.propertyName !== "height") return;
      runOnce();
    }

    starRoll.addEventListener("transitionend", onHeightEnd);
    const durationVar = getComputedStyle(document.documentElement)
      .getPropertyValue("--archive-panel-duration")
      .trim();
    const durationSec = parseFloat(durationVar) || 0.7;
    fallbackTimer = window.setTimeout(runOnce, durationSec * 1000 + 80);
  }

  function shuffle(list) {
    const items = list.slice();
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function seedFromWidth(width) {
    return ((Math.round(width) * 2654435761) >>> 0) || 1;
  }

  function freshArchiveSeed() {
    const mix =
      (Date.now() >>> 0) ^
      (Math.imul(Math.floor(Math.random() * 0xffffffff), 2246822519) >>> 0);
    return (mix >>> 0) || 1;
  }

  function seededShuffle(list, seed) {
    const items = list.slice();
    let state = seed >>> 0;
    function rnd() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    }
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function isArchivePhone() {
    return (
      window.matchMedia("(max-width: 767px)").matches ||
      window.matchMedia("(hover: none) and (pointer: coarse)").matches
    );
  }

  function shouldRelayoutArchive(panelWidth) {
    const width = Math.round(panelWidth);
    if (!archiveLayoutWidth) return true;
    const delta = Math.abs(width - archiveLayoutWidth);
    if (isArchivePhone()) {
      return delta >= 56;
    }
    return delta >= 28;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function encodePath(rel) {
    return String(rel)
      .split("/")
      .map(function (part) {
        return encodeURIComponent(part);
      })
      .join("/");
  }

  function dirname(file) {
    const index = file.lastIndexOf("/");
    return index === -1 ? "" : file.slice(0, index + 1);
  }

  function basename(file) {
    const index = file.lastIndexOf("/");
    return index === -1 ? file : file.slice(index + 1);
  }

  function titleFromFile(file) {
    return basename(file).replace(/\.[^.]+$/, "");
  }

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function fullPath(file) {
    return imageDir + encodePath(file);
  }

  function manifestEntryForFile(file) {
    return manifest.find(function (entry) {
      return entry.file === file;
    });
  }

  /** Optional manifest fields: text, copy, caption, description (string or { pt, en }). */
  function resolveWorkText(entry) {
    if (!entry) return "";
    const lang = document.documentElement.lang === "en" ? "en" : "pt";
    if (entry.text && typeof entry.text === "object") {
      return entry.text[lang] || entry.text.pt || entry.text.en || "";
    }
    if (typeof entry.text === "string") return entry.text;
    if (entry.copy && typeof entry.copy === "object") {
      return entry.copy[lang] || entry.copy.pt || entry.copy.en || "";
    }
    if (typeof entry.copy === "string") return entry.copy;
    if (typeof entry.caption === "string") return entry.caption;
    if (typeof entry.description === "string") return entry.description;
    return "";
  }

  function applyWorkCopy(section, entry) {
    const textEl = section.querySelector(".work__text");
    const copyWrap = section.querySelector(".work__copy");
    if (!textEl || !copyWrap) return;
    const text = resolveWorkText(entry);
    textEl.textContent = text;
    copyWrap.hidden = !text;
  }

  function refreshWorkCopyTexts() {
    works.querySelectorAll(".work.work--image").forEach(function (section) {
      const file = section.getAttribute("data-work-file");
      if (!file) return;
      applyWorkCopy(section, manifestEntryForFile(file));
    });
  }

  function thumbCandidates(file) {
    const dir = dirname(file);
    const name = basename(file);
    const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
    const base = name.slice(0, name.length - ext.length);
    const folderThumbs = imageDir + encodePath(dir + "thumbs/");
    const rootThumbs = thumbDir;

    if (ext === ".gif") {
      return [
        folderThumbs + encodeURIComponent(base + ".gif"),
        rootThumbs + encodePath(dir + base + ".gif"),
        rootThumbs + encodeURIComponent(base + ".gif"),
      ];
    }

    const jpgName = encodeURIComponent(base + ".jpg");
    const fileJpg = encodeURIComponent(name + ".jpg");
    const candidates = [];
    if (ext !== ".jpg" && ext !== ".jpeg") {
      candidates.push(folderThumbs + fileJpg);
      candidates.push(rootThumbs + encodePath(dir + name + ".jpg"));
      candidates.push(rootThumbs + fileJpg);
    }
    candidates.push(folderThumbs + jpgName);
    candidates.push(rootThumbs + encodePath(dir + base + ".jpg"));
    candidates.push(rootThumbs + jpgName);
    return candidates;
  }

  function archiveThumbSources(file) {
    const seen = new Set();
    const list = [];
    thumbCandidates(file).forEach(function (url) {
      if (seen.has(url)) return;
      seen.add(url);
      list.push(url);
    });
    return list;
  }

  function prefetchArchivePanelThumbs() {
    const limit = Math.min(16, manifest.length);
    for (let i = 0; i < limit; i += 1) {
      const entry = manifest[i];
      const sources = archiveThumbSources(entry.file);
      const src = sources.length ? sources[0] : fullPath(entry.file);
      const probe = new Image();
      probe.decoding = "async";
      probe.src = src;
    }
  }

  function isUmbigoEntry(entry) {
    const file = String(entry.file || "");
    const href = entry.href ? String(entry.href).trim() : "";
    return file.indexOf("umbigo/") === 0 || href === "umbigo.html";
  }

  function groupEntries(items) {
    const groups = [];
    let umbigoGroup = null;

    items.forEach(function (entry, index) {
      const title = entry.title || titleFromFile(entry.file);

      if (isUmbigoEntry(entry)) {
        if (!umbigoGroup) {
          umbigoGroup = {
            id: "obra-umbigo",
            title: "umbigo",
            kind: "umbigo",
            files: [],
            file: entry.file,
          };
          groups.push(umbigoGroup);
        }
        umbigoGroup.files.push(entry);
        return;
      }

      groups.push({
        id: "obra-" + (slugify(entry.file) || slugify(title) || "peca") + "-" + index,
        title: title,
        files: [entry],
        file: entry.file,
      });
    });

    return groups;
  }

  function findGroupForFile(file) {
    return groups.find(function (group) {
      return group.files.some(function (entry) {
        return entry.file === file;
      });
    });
  }

  function navigateToGroup(group, anchorFile) {
    if (!group) return;
    scrollToWork(group.id, anchorFile || "");
  }

  let workLayer = 0;

  function filePathInUrl(file) {
    const parts = String(file).split("/");
    const tail = parts[parts.length - 1];
    return {
      full: encodePath(file),
      tail: encodeURIComponent(tail),
      rawTail: tail,
    };
  }

  function findWorkAnchor(section, file) {
    if (!file) return null;
    const paths = filePathInUrl(file);
    const marked = section.querySelector('[data-archive-file="' + file.replace(/"/g, "") + '"]');
    if (marked) return marked;

    const imgs = section.querySelectorAll("img");
    for (let i = 0; i < imgs.length; i += 1) {
      const src = imgs[i].currentSrc || imgs[i].src || "";
      if (
        src.indexOf(paths.full) !== -1 ||
        src.indexOf(paths.tail) !== -1 ||
        src.indexOf(paths.rawTail) !== -1
      ) {
        return imgs[i];
      }
    }
    return null;
  }

  function scrollElementToReveal(container, el) {
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offset = elRect.top - containerRect.top + container.scrollTop;
    const lead = Math.min(container.clientHeight * 0.14, 72);
    container.scrollTo({
      top: Math.max(0, offset - lead),
      behavior: reducedMotion.matches ? "auto" : "smooth",
    });
  }

  function activateWorkSection(section) {
    if (!section) return;
    workLayer += 1;
    section.style.zIndex = String(workLayer);
    works.querySelectorAll(".work").forEach(function (node) {
      const active = node === section;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-hidden", active ? "false" : "true");
    });
  }

  let umbigoMainTemplate = null;

  async function loadUmbigoMain() {
    if (umbigoMainTemplate) return umbigoMainTemplate.cloneNode(true);
    try {
      const response = await fetch("umbigo.html", { cache: "no-store" });
      if (!response.ok) throw new Error("umbigo");
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const main = doc.querySelector("main.umbigo");
      if (!main) throw new Error("umbigo");
      umbigoMainTemplate = main;
      return main.cloneNode(true);
    } catch (error) {
      console.error("Nao foi possivel carregar umbigo.html", error);
      return null;
    }
  }

  function panelUiScale(width, height) {
    const viewportScale = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")
    );
    const base =
      Number.isFinite(viewportScale) && viewportScale > 0 ? viewportScale : 1;
    const panelScale = Math.min(1.14, Math.max(0.72, Math.min(width / 1440, height / 820)));
    return Math.min(base, panelScale);
  }

  function getArchivePanelLayout(count, width, height) {
    const scale = panelUiScale(width, height);
    const padding = Math.max(10, Math.round(12 * scale));
    const gap = Math.max(12, Math.round(14 * scale));
    const innerW = Math.max(48, width - padding * 2);
    const innerH = Math.max(48, height - padding * 2);
    const fill = Math.min(1, 14 / Math.max(count, 1));
    const narrow = innerW < 400;

    let minRatio = (narrow ? 0.36 : 0.32) + 0.14 * fill;
    let maxRatio = (narrow ? 0.52 : 0.48) + 0.1 * fill;
    minRatio = Math.min(minRatio, 0.44);
    maxRatio = Math.min(Math.max(maxRatio, minRatio + 0.1), 0.64);

    const imgMaxH = Math.max(
      72,
      Math.min(innerH * 0.58, innerW * 0.68, 500 * scale)
    );

    return {
      padding: padding,
      gap: gap,
      innerW: innerW,
      innerH: innerH,
      itemCount: count,
      minRatio: minRatio,
      maxRatio: maxRatio,
      imgMaxH: imgMaxH,
      maxAttempts: 28,
      panelWidth: width,
      panelHeight: height,
    };
  }

  function archivePanelSpreadRegion(layout, placeIndex, minTop) {
    const count = Math.max(1, layout.itemCount || 1);
    const aspect = layout.innerW / Math.max(layout.innerH, 1);
    const cols = Math.max(2, Math.ceil(Math.sqrt(count * aspect)));
    const rows = Math.ceil(count / cols);
    const col = placeIndex % cols;
    const row = Math.floor(placeIndex / cols);
    const cellW = layout.innerW / cols;
    const cellH = layout.innerH / rows;
    const inset = layout.gap * 0.35;

    return {
      minLeft: layout.padding + col * cellW + inset,
      maxLeft: layout.padding + (col + 1) * cellW - inset,
      minTop: minTop + row * cellH + inset,
      maxTop: minTop + (row + 1) * cellH - inset,
    };
  }

  function archivePanelCellSize(layout, placeIndex, aspect) {
    const minTop = layout.padding;
    const region = archivePanelSpreadRegion(layout, placeIndex, minTop);
    const cellW = Math.max(40, region.maxLeft - region.minLeft);
    const cellH = Math.max(40, region.maxTop - region.minTop);
    const capW = cellW * 0.94;
    const capH = Math.min(layout.imgMaxH, cellH * 0.94);
    let h = Math.min(capH, capW / aspect);
    let w = Math.min(capW, h * aspect);
    const floorW = layout.innerW * layout.minRatio;
    if (w < floorW * 0.85) {
      w = Math.min(capW, layout.innerW * layout.maxRatio);
      h = Math.min(layout.imgMaxH, capH, w / aspect);
      w = Math.min(w, h * aspect);
    }
    return archivePanelItemBox(w, h, aspect);
  }

  function archiveItemRng(seed, placeIndex) {
    let state = (seed + Math.imul(placeIndex + 1, 2246822519)) >>> 0;
    return function () {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function archivePanelColumnCount(panelWidth) {
    return panelWidth < 520 ? 2 : 3;
  }

  function archiveColumnRng(index, seed) {
    let state = (seed + Math.imul(index + 1, 2246822519)) >>> 0;
    return function () {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function styleArchiveColumn(colEl, colIndex, seed, compact) {
    let state = (seed + Math.imul(colIndex + 11, 1597334677)) >>> 0;
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const r = state / 4294967296;
    const bases = compact ? [0, 10, 5] : [0, 26, 12];
    const padTop = (bases[colIndex] || 0) + Math.round(r * (compact ? 12 : 20));
    const gapScale = 0.9 + colIndex * 0.05 + r * 0.14;
    colEl.style.setProperty("--archive-col-offset", padTop + "px");
    colEl.style.setProperty(
      "--archive-col-gap-scale",
      String(Math.round(gapScale * 100) / 100)
    );
  }

  function createArchiveColumns(parent, columnCount, seed, compact) {
    const cols = [];
    const colClass = compact ? "archive-panel-col" : "arquivo-col";
    for (let c = 0; c < columnCount; c += 1) {
      const col = document.createElement("div");
      col.className = colClass;
      col.setAttribute("data-archive-col", String(c));
      styleArchiveColumn(col, c, seed, compact);
      parent.appendChild(col);
      cols.push(col);
    }
    return cols;
  }

  function applyArchiveColumnItem(button, index, seed, compact) {
    const rnd = archiveColumnRng(index, seed);
    const r1 = rnd();
    const r2 = rnd();
    const r3 = rnd();
    const r4 = rnd();
    const maxH = compact ? 14 + Math.round(r1 * 18) : 26 + Math.round(r1 * 30);
    const maxRem = compact ? 9 + Math.round(r2 * 6) : 18 + Math.round(r2 * 20);
    const xShift = Math.round((r3 - 0.5) * (compact ? 16 : 26));
    const gapExtra = Math.round(r4 * (compact ? 14 : 22));
    const scale = (compact ? 0.84 : 0.82) + r1 * (compact ? 0.18 : 0.2);

    button.style.setProperty(
      "--archive-thumb-max",
      "min(" + maxH + "vh, " + maxRem + "rem)"
    );
    button.style.setProperty("--archive-x-shift", xShift + "px");
    button.style.setProperty("--archive-item-gap-extra", gapExtra + "px");
    button.style.setProperty("--archive-thumb-scale", String(Math.round(scale * 1000) / 1000));
  }

  function archivePanelOverlaps(a, b, gap) {
    return !(
      a.right + gap < b.left ||
      a.left > b.right + gap ||
      a.bottom + gap < b.top ||
      a.top > b.bottom + gap
    );
  }

  function archivePanelRect(element, containerRect) {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      right: rect.right - containerRect.left,
      bottom: rect.bottom - containerRect.top,
    };
  }

  function archivePanelCollides(rect, zones, gap) {
    for (let i = 0; i < zones.length; i += 1) {
      if (archivePanelOverlaps(rect, zones[i], gap)) {
        return true;
      }
    }
    return false;
  }

  function archivePlacedBottom(placed) {
    let bottom = 0;
    for (let i = 0; i < placed.length; i += 1) {
      if (placed[i].bottom > bottom) {
        bottom = placed[i].bottom;
      }
    }
    return bottom;
  }

  function findArchivePanelPosition(
    button,
    placed,
    layout,
    itemW,
    itemH,
    rnd,
    placeIndex
  ) {
    const minTop = layout.padding;
    const maxLeft = Math.max(layout.padding, layout.panelWidth - layout.padding - itemW);
    const spreadH = layout.innerH * 1.02;
    const region = archivePanelSpreadRegion(layout, placeIndex, minTop);
    const rndBetween = function (min, max) {
      if (max <= min) {
        return min;
      }
      return min + rnd() * (max - min);
    };

    function tryAt(left, top) {
      if (left < layout.padding - 0.25 || left > maxLeft + 0.25) {
        return null;
      }
      if (top < minTop - 0.25) {
        return null;
      }
      const rect = {
        left: left,
        top: top,
        right: left + itemW,
        bottom: top + itemH,
      };
      if (rect.right > layout.panelWidth - layout.padding + 0.25) {
        return null;
      }
      if (archivePanelCollides(rect, placed, layout.gap)) {
        return null;
      }
      button.style.left = Math.round(left) + "px";
      button.style.top = Math.round(top) + "px";
      return rect;
    }

    function bandLimits(bandMinLeft, bandMaxLeft, bandMinTop, bandMaxTop) {
      const leftLo = Math.max(layout.padding, Math.min(bandMinLeft, maxLeft));
      const leftHi = Math.max(leftLo, Math.min(bandMaxLeft, maxLeft));
      const topLo = Math.max(minTop, bandMinTop);
      const topHi = Math.max(topLo, Math.min(bandMaxTop - itemH, minTop + spreadH - itemH));
      return { leftLo: leftLo, leftHi: leftHi, topLo: topLo, topHi: topHi };
    }

    const anchors = [];
    const regionBand = bandLimits(region.minLeft, region.maxLeft, region.minTop, region.maxTop);
    const cx = (regionBand.leftLo + regionBand.leftHi) / 2;
    const cy = (regionBand.topLo + regionBand.topHi) / 2;
    anchors.push({ left: cx, top: cy });
    anchors.push({ left: regionBand.leftLo, top: regionBand.topLo });
    anchors.push({ left: regionBand.leftHi, top: regionBand.topLo });
    anchors.push({ left: regionBand.leftLo, top: regionBand.topHi });
    anchors.push({ left: regionBand.leftHi, top: regionBand.topHi });

    let rect;
    for (let i = 0; i < anchors.length; i += 1) {
      rect = tryAt(anchors[i].left, anchors[i].top);
      if (rect) {
        return rect;
      }
    }

    for (let attempt = 0; attempt < layout.maxAttempts; attempt += 1) {
      const inRegion = attempt < layout.maxAttempts * 0.75;
      const band = inRegion
        ? regionBand
        : bandLimits(
            layout.padding,
            layout.padding + layout.innerW,
            minTop,
            minTop + spreadH
          );
      rect = tryAt(rndBetween(band.leftLo, band.leftHi), rndBetween(band.topLo, band.topHi));
      if (rect) {
        return rect;
      }
    }

    const stepY = itemH + layout.gap;
    let top = minTop;
    const bottomLimit = minTop + spreadH + layout.innerH * 0.55;
    while (top <= bottomLimit) {
      const xs = [
        layout.padding,
        maxLeft,
        (layout.padding + maxLeft) / 2,
        rndBetween(layout.padding, maxLeft),
      ];
      for (let x = 0; x < xs.length; x += 1) {
        rect = tryAt(xs[x], top);
        if (rect) {
          return rect;
        }
      }
      top += stepY;
    }

    return null;
  }

  function archivePanelItemBox(itemW, imgH, aspect) {
    const h = Math.max(12, Math.round(Math.min(imgH, itemW / aspect)));
    const w = Math.max(12, Math.round(Math.min(itemW, h * aspect)));
    return { w: w, h: h };
  }

  function tryArchivePanelRect(button, placed, layout, itemW, itemH, left, top) {
    const minTop = layout.padding;
    const maxLeft = Math.max(layout.padding, layout.panelWidth - layout.padding - itemW);
    if (left < layout.padding - 0.25 || left > maxLeft + 0.25 || top < minTop - 0.25) {
      return null;
    }
    const rect = {
      left: left,
      top: top,
      right: left + itemW,
      bottom: top + itemH,
    };
    if (rect.right > layout.panelWidth - layout.padding + 0.25) {
      return null;
    }
    if (archivePanelCollides(rect, placed, layout.gap)) {
      return null;
    }
    button.style.left = Math.round(left) + "px";
    button.style.top = Math.round(top) + "px";
    return rect;
  }

  function placeInArchivePanelRegion(button, placed, layout, placeIndex, itemW, itemH) {
    const minTop = layout.padding;
    const maxLeft = Math.max(layout.padding, layout.panelWidth - layout.padding - itemW);
    const region = archivePanelSpreadRegion(layout, placeIndex, minTop);
    const cx = (region.minLeft + region.maxLeft) / 2 - itemW / 2;
    const cy = (region.minTop + region.maxTop) / 2 - itemH / 2;
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
      const rect = tryArchivePanelRect(button, placed, layout, itemW, itemH, left, top);
      if (rect) {
        return rect;
      }
    }

    return null;
  }

  function placeArchivePanelItem(button, img, placed, layout, placeIndex, panelSeed) {
    if (!img.naturalWidth) {
      button.remove();
      return 0;
    }

    const rnd = archiveItemRng(panelSeed, placeIndex);
    const aspect = img.naturalWidth / img.naturalHeight;
    let itemW = 0;
    let imgH = 0;
    let rect = null;

    function applyPanelThumb(w, h) {
      button.style.width = w + "px";
      button.style.setProperty("--archive-img-max-h", Math.floor(h) + "px");
      button.style.setProperty("--archive-cell-w", w + "px");
    }

    for (let shrink = 0; shrink < 3 && !rect; shrink += 1) {
      const scaleDown = 1 - shrink * 0.07;
      const box = archivePanelCellSize(layout, placeIndex, aspect);
      itemW = Math.max(48, Math.round(box.w * scaleDown));
      imgH = Math.max(36, Math.round(box.h * scaleDown));
      applyPanelThumb(itemW, imgH);
      rect = placeInArchivePanelRegion(button, placed, layout, placeIndex, itemW, imgH);
      if (!rect) {
        rect = findArchivePanelPosition(
          button,
          placed,
          layout,
          itemW,
          imgH,
          rnd,
          placeIndex
        );
      }
    }

    if (!rect) {
      const box = archivePanelCellSize(layout, placeIndex, aspect);
      itemW = Math.max(48, Math.round(box.w * 0.82));
      imgH = Math.max(36, Math.round(box.h * 0.82));
      applyPanelThumb(itemW, imgH);
      rect = placeInArchivePanelRegion(button, placed, layout, placeIndex, itemW, imgH);
    }

    if (!rect) {
      button.remove();
      return archivePlacedBottom(placed) + layout.padding;
    }

    placed.push(rect);

    const delay = Math.min(placeIndex, 28) * 0.03;
    button.style.setProperty("--archive-enter-delay", delay + "s");
    button.classList.remove("is-loading");
    button.classList.add("is-placed");

    return archivePlacedBottom(placed) + layout.padding;
  }

  function renderArchivePanel(force) {
    if (!manifest.length) return;
    const panelWidth = archivePanel.clientWidth;
    const panelHeight = archivePanel.clientHeight;
    if (panelWidth < 48 || panelHeight < 48) {
      requestAnimationFrame(function () {
        renderArchivePanel(force);
      });
      return;
    }
    if (!force && !shouldRelayoutArchive(panelWidth)) {
      return;
    }

    archiveLayoutWidth = Math.round(panelWidth);
    const token = ++scatterToken;
    archivePanel.classList.add("is-arranging");
    archivePanel.innerHTML = "";
    archivePanel.style.minHeight = "";
    archivePanel.classList.remove("archive-panel--cols-2", "archive-panel--cols-3");
    archivePanel.classList.add("archive-panel--scatter");

    const scrollSurface = document.createElement("div");
    scrollSurface.className = "archive-panel-scroll is-preparing";
    archivePanel.appendChild(scrollSurface);
    const placeFragment = document.createDocumentFragment();
    const scatterWidth = scrollSurface.clientWidth || panelWidth;

    const scatter = window.avvArchiveScatter;
    const panelSeed = freshArchiveSeed();
    const files = seededShuffle(manifest.slice(), panelSeed);
    const layout = scatter.getLayout(files.length, scatterWidth, panelHeight, { panel: true });
    const placed = [];
    let contentBottom = layout.padding;
    let pending = files.length;

    function revealArchiveScatter() {
      scrollSurface.appendChild(placeFragment);
      scrollSurface.querySelectorAll(".archive-panel-item").forEach(function (node) {
        node.classList.remove("is-loading");
        node.classList.add("is-placed");
      });
      scrollSurface.classList.remove("is-preparing");
      archivePanel.classList.remove("is-arranging");
    }

    function finishArchiveArrange() {
      if (token !== scatterToken) return;
      pending -= 1;
      if (pending > 0) return;
      const scrollH = Math.ceil(contentBottom + layout.padding);
      scrollSurface.style.minHeight = Math.max(scrollH, panelHeight) + "px";
      archivePanel.style.minHeight = "";
      window.requestAnimationFrame(function () {
        if (token !== scatterToken) return;
        revealArchiveScatter();
      });
    }

    files.forEach(function (entry, orderIndex) {
      const title = entry.title || titleFromFile(entry.file);
      const group = findGroupForFile(entry.file);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "archive-panel-item arquivo-item is-loading";
      button.setAttribute("aria-label", title);
      button.setAttribute("data-archive-file", entry.file);
      if (group) button.setAttribute("data-work-id", group.id);

      const frame = document.createElement("span");
      frame.className = "archive-panel-item__frame";

      const img = document.createElement("img");
      img.alt = "";
      img.decoding = "sync";
      img.loading = "eager";
      img.style.visibility = "hidden";
      if ("fetchPriority" in img && orderIndex < 8) {
        img.fetchPriority = "high";
      }

      const sources = archiveThumbSources(entry.file);
      if (!sources.length) {
        sources.push(fullPath(entry.file));
      }
      let sourceIndex = 0;
      img.src = sources[0];

      img.addEventListener("error", function () {
        sourceIndex += 1;
        if (sourceIndex >= sources.length) {
          button.remove();
          finishArchiveArrange();
          return;
        }
        img.src = sources[sourceIndex];
      });

      function mountPlacedItem() {
        if (token !== scatterToken || button.parentNode) return;
        const bottom = scatter.placeItem(
          button,
          img,
          placed,
          layout,
          orderIndex,
          panelSeed,
          true
        );
        img.style.visibility = "";
        if (bottom === null) {
          finishArchiveArrange();
          return;
        }
        placeFragment.appendChild(button);
        contentBottom = Math.max(contentBottom, bottom);
        finishArchiveArrange();
      }

      img.addEventListener("load", mountPlacedItem);
      if (img.complete && img.naturalWidth) {
        mountPlacedItem();
      }

      button.addEventListener("click", function () {
        archivePanel.querySelectorAll(".arquivo-item.is-picked").forEach(function (node) {
          node.classList.remove("is-picked");
        });
        button.classList.add("is-picked");
        setIndexOpen(false);
        if (group) navigateToGroup(group, entry.file);
      });

      frame.appendChild(img);
      button.appendChild(frame);
    });

    if (lastWorkId) {
      archivePanel.querySelectorAll(".arquivo-item").forEach(function (item) {
        item.classList.toggle("is-current", item.getAttribute("data-work-id") === lastWorkId);
      });
    }
  }

  function setIndexOpen(open) {
    if (open && document.body.classList.contains("is-sobre-open")) {
      setSobreOpen(false);
    }
    document.body.classList.toggle("is-index-open", open);
    if (indexToggle) indexToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) {
      archiveOpenGen += 1;
      scatterToken += 1;
      archivePanel.classList.add("is-arranging");
      archivePanel.innerHTML = "";
      archivePanel.style.minHeight = "";
      archivePanel.classList.remove("archive-panel--scatter");
      archiveLayoutWidth = 0;
      return;
    }
    archivePanel.innerHTML = "";
    archivePanel.style.minHeight = "";
    archivePanel.classList.remove("archive-panel--cols-2", "archive-panel--cols-3");
    archivePanel.classList.add("archive-panel--scatter", "is-arranging");
    if (manifest.length) {
      beginArchivePanelRender();
    }
  }

  function updateWorkChrome() {
    updateStarAgainLabel();
    syncStarRollMotion();
  }

  function setWorkSectionOpen(open) {
    document.body.classList.toggle("is-work-open", open);
    if (!open) setIndexOpen(false);
    updateWorkChrome();
    if (open) {
      requestAnimationFrame(function () {
        syncStarRollMotion();
        restartStarRollAnimation();
      });
    }
  }

  function restartStarRollAnimation() {
    if (!starAgain || reducedMotion.matches) return;
    starAgain.style.animation = "none";
    void starAgain.offsetHeight;
    starAgain.style.animation = "";
  }

  function scrollToWork(id, anchorFile) {
    const section = document.getElementById(id);
    if (!section) return;
    lastWorkId = id;
    setWorkSectionOpen(true);
    window.scrollTo(0, 0);
    activateWorkSection(section);

    function alignViewport() {
      if (!anchorFile) {
        section.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
        return;
      }
      const anchor = findWorkAnchor(section, anchorFile);
      if (anchor) {
        scrollElementToReveal(section, anchor);
      } else {
        section.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
      }
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(alignViewport);
    });
    updateWorkChrome();
  }

  function isPastHero() {
    return document.body.classList.contains("is-work-open");
  }

  function scrollToTop() {
    setSobreOpen(false);
    setIndexOpen(false);
    document.body.classList.remove("is-star-flight");
    works.querySelectorAll(".work").forEach(function (node) {
      node.classList.remove("is-active");
      node.setAttribute("aria-hidden", "true");
    });
    setWorkSectionOpen(false);
    window.scrollTo(0, 0);
    updateWorkChrome();
  }

  function flyStarBetween(fromEl, toEl, onDone) {
    const sourceImg =
      fromEl &&
      (fromEl.querySelector(".wheel-figure__img") || fromEl.querySelector("img"));
    if (!fromEl || !toEl || !sourceImg) {
      if (onDone) onDone();
      return;
    }

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    if (fromRect.width < 1 || toRect.width < 1) {
      if (onDone) onDone();
      return;
    }

    const fly = document.createElement("div");
    fly.className = "star-flight";
    fly.setAttribute("aria-hidden", "true");

    const bonecoLayer = document.createElement("div");
    bonecoLayer.className = "star-flight__boneco";
    const img = document.createElement("img");
    img.src = sourceImg.currentSrc || sourceImg.src;
    img.alt = "";
    bonecoLayer.appendChild(img);

    const strokesLayer = document.createElement("div");
    strokesLayer.className = "star-flight__strokes";
    const linesTemplate = toEl.querySelector(".wheel-figure__lines");
    if (linesTemplate) {
      strokesLayer.appendChild(linesTemplate.cloneNode(true));
    }

    fly.appendChild(bonecoLayer);
    fly.appendChild(strokesLayer);
    document.body.appendChild(fly);

    fromEl.classList.add("is-star-handoff");
    toEl.classList.add("is-star-handoff");

    const fromCx = fromRect.left + fromRect.width / 2;
    const fromCy = fromRect.top + fromRect.height / 2;
    const toCx = toRect.left + toRect.width / 2;
    const toCy = toRect.top + toRect.height / 2;
    const scale = toRect.width / fromRect.width;

    fly.style.width = fromRect.width + "px";
    fly.style.height = fromRect.height + "px";
    fly.style.transform =
      "translate(" + fromCx + "px, " + fromCy + "px) translate(-50%, -50%)";

    function finish() {
      fly.remove();
      fromEl.classList.remove("is-star-handoff");
      toEl.classList.remove("is-star-handoff");
      if (onDone) onDone();
    }

    let morphTimer = 0;

    function run() {
      fly.classList.add("is-active");
      fly.style.transform =
        "translate(" +
        toCx +
        "px, " +
        toCy +
        "px) translate(-50%, -50%) scale(" +
        scale +
        ")";
      morphTimer = window.setTimeout(function () {
        fly.classList.add("is-morph");
      }, 340);
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(run);
    });

    let done = false;
    function complete() {
      if (done) return;
      done = true;
      window.clearTimeout(morphTimer);
      finish();
    }

    fly.addEventListener("transitionend", function (event) {
      if (event.propertyName === "transform") complete();
    });
    window.setTimeout(complete, 780);
  }

  function updateStarAgainLabel() {
    if (!starAgain) return;
    const en = document.documentElement.lang === "en";
    if (isPastHero()) {
      starAgain.setAttribute("aria-label", en ? "Spin again" : "Roleta outra vez");
    } else {
      starAgain.setAttribute("aria-label", en ? "Spin" : "Roleta");
    }
  }

  function pickWork() {
    if (!groups.length) return null;
    let pool = groups;
    if (groups.length > 1) {
      pool = groups.filter(function (group) {
        return group.id !== lastWorkId;
      });
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function spinToWork(id) {
    if (spinning) return;
    const group =
      (id &&
        groups.find(function (item) {
          return item.id === id;
        })) ||
      pickWork();
    if (!group) return;

    if (reducedMotion.matches) {
      scrollToWork(group.id);
      return;
    }

    if (document.body.classList.contains("is-work-open")) {
      spinning = true;
      if (starRoll) starRoll.classList.add("is-draw");
      restartStarRollAnimation();
      scrollToWork(group.id);
      window.setTimeout(function () {
        if (starRoll) starRoll.classList.remove("is-draw");
        spinning = false;
      }, 1100);
      return;
    }

    spinning = true;
    star.classList.add("is-draw");
    if (starRoll) starRoll.classList.add("is-draw");
    window.setTimeout(function () {
      star.classList.remove("is-draw");
      if (starRoll) starRoll.classList.remove("is-draw");
      setWorkSectionOpen(true);
      syncStarRollMotion();
      document.body.classList.add("is-star-flight");
      scrollToWork(group.id);
      flyStarBetween(star, starAgain, function () {
        document.body.classList.remove("is-star-flight");
        spinning = false;
        restartStarRollAnimation();
      });
    }, 1400);
  }

  async function renderWorks(items) {
    works.innerHTML = "";
    for (let i = 0; i < items.length; i += 1) {
      const group = items[i];

      if (group.kind === "umbigo") {
        const section = document.createElement("section");
        section.className = "work work--umbigo umbigo-page";
        section.id = group.id;
        section.setAttribute("aria-hidden", "true");

        const main = await loadUmbigoMain();
        if (main) section.appendChild(main);
        group.files.forEach(function (entry) {
          const anchor = findWorkAnchor(section, entry.file);
          if (anchor) anchor.setAttribute("data-archive-file", entry.file);
        });

        works.appendChild(section);
        document.dispatchEvent(new CustomEvent("umbigo-mounted"));
        continue;
      }

      const section = document.createElement("section");
      section.className = "work work--image";
      section.id = group.id;
      section.setAttribute("aria-hidden", "true");
      section.setAttribute("data-work-file", group.file || group.files[0].file);

      const layout = document.createElement("div");
      layout.className = "work__layout";

      const frame = document.createElement("div");
      frame.className = "work__frame";

      group.files.forEach(function (entry) {
        const img = document.createElement("img");
        img.src = fullPath(entry.file);
        img.alt = group.title;
        img.loading = "lazy";
        img.setAttribute("data-archive-file", entry.file);
        frame.appendChild(img);
      });

      const copyWrap = document.createElement("div");
      copyWrap.className = "work__copy";
      copyWrap.hidden = true;
      const textEl = document.createElement("p");
      textEl.className = "work__text";
      copyWrap.appendChild(textEl);

      layout.appendChild(frame);
      layout.appendChild(copyWrap);
      section.appendChild(layout);
      applyWorkCopy(section, group.files[0]);

      works.appendChild(section);
    }
  }

  function setSobreOpen(open) {
    if (!overlay || !sobreToggle) return;
    if (open) {
      setIndexOpen(false);
    }
    document.body.classList.toggle("is-sobre-open", open);
    overlay.setAttribute("aria-hidden", open ? "false" : "true");
    sobreToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) {
      document.body.classList.remove("is-cv-open");
    }
  }

  if (sobreToggle) {
    sobreToggle.addEventListener("click", function () {
      setSobreOpen(!document.body.classList.contains("is-sobre-open"));
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (document.body.classList.contains("is-index-open")) {
      setIndexOpen(false);
      return;
    }
    if (document.body.classList.contains("is-sobre-open")) {
      setSobreOpen(false);
      return;
    }
    if (isPastHero()) {
      scrollToTop();
    }
  });

  star.addEventListener("click", function () {
    spinToWork();
  });

  if (indexToggle) {
    indexToggle.addEventListener("click", function () {
      setIndexOpen(!document.body.classList.contains("is-index-open"));
    });
  }

  if (siteHome) {
    siteHome.addEventListener("click", function (event) {
      event.preventDefault();
      scrollToTop();
    });
  }

  if (starAgain) {
    starAgain.addEventListener("click", function () {
      scrollToTop();
    });
    updateWorkChrome();
    document.addEventListener("avv-lang", updateWorkChrome);
  }

  if (starRoll) starRoll.hidden = false;

  function syncStarRollMotion() {
    const dock = document.querySelector(".star-roll__dock");
    const mover = starAgain;
    const toggle = indexToggle;
    if (!dock || !mover) return;
    if (!document.body.classList.contains("is-work-open")) {
      mover.style.left = "";
      return;
    }

    const dockWidth = dock.clientWidth;
    const moverWidth = mover.offsetWidth;
    if (moverWidth < 1) return;

    const toggleWidth = toggle ? toggle.offsetWidth : 0;
    const insetPx = Math.max(
      0,
      Math.round(mover.getBoundingClientRect().left - dock.getBoundingClientRect().left)
    );
    const travelPx = Math.max(0, dockWidth - moverWidth - toggleWidth - insetPx - 6);
    const radiusPx = moverWidth / 2;
    const turnDeg = (travelPx / radiusPx) * (180 / Math.PI);

    mover.style.setProperty("--star-roll-travel", travelPx + "px");
    mover.style.setProperty("--star-roll-turn", turnDeg + "deg");
    restartStarRollAnimation();
  }

  syncStarRollMotion();
  window.addEventListener("resize", syncStarRollMotion);
  document.addEventListener("avv-lang", syncStarRollMotion);
  if (typeof ResizeObserver !== "undefined") {
    const dock = document.querySelector(".star-roll__dock");
    if (dock) {
      const rollResize = new ResizeObserver(syncStarRollMotion);
      rollResize.observe(dock);
    }
  }

  async function init() {
    try {
      const response = await fetch(manifestUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("manifest");
      manifest = await response.json();
    } catch (error) {
      console.error("Nao foi possivel carregar images.json", error);
      return;
    }

    groups = groupEntries(manifest);
    prefetchArchivePanelThumbs();
    await renderWorks(groups);
    lockScrollTop();
    syncStarRollMotion();
  }

  let lastWidth = window.innerWidth;
  let lastHeight =
    (window.visualViewport && window.visualViewport.height) || window.innerHeight;

  function onViewportLayoutChange() {
    const width = window.innerWidth;
    const height =
      (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    const widthDelta = Math.abs(width - lastWidth);
    const heightDelta = Math.abs(height - lastHeight);
    const phone = isArchivePhone();
    const relayoutArchiveWidth = phone ? widthDelta >= 56 : widthDelta >= 28;
    if (widthDelta < 28 && heightDelta < 32) return;
    lastWidth = width;
    lastHeight = height;
    syncStarRollMotion();
    if (manifest.length && document.body.classList.contains("is-index-open") && relayoutArchiveWidth) {
      if (shouldRelayoutArchive(archivePanel.clientWidth || width)) {
        scheduleArchivePanelRender();
      }
    }
  }

  window.addEventListener("resize", onViewportLayoutChange);
  document.addEventListener("avv-ui-scale", onViewportLayoutChange);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onViewportLayoutChange);
  }

  if (typeof ResizeObserver !== "undefined" && archivePanel) {
    let observedPanelWidth = 0;
    const panelResize = new ResizeObserver(function (entries) {
      if (!document.body.classList.contains("is-index-open")) return;
      if (archivePanel.classList.contains("is-arranging")) return;
      const width = Math.round(entries[0].contentRect.width);
      if (!width) return;
      if (observedPanelWidth && Math.abs(width - observedPanelWidth) < (isArchivePhone() ? 48 : 24)) {
        return;
      }
      observedPanelWidth = width;
      if (shouldRelayoutArchive(width)) {
        scheduleArchivePanelRender();
      }
    });
    panelResize.observe(archivePanel);
  }

  init();
})();
