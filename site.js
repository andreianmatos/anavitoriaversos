(function () {
  const imageDir = "imagens/arquivo/";
  const thumbDir = "imagens/arquivo/thumbs/";
  const manifestUrl = document.body.getAttribute("data-manifest") || "images.json";
  const works = document.getElementById("obras");
  const star = document.querySelector("[data-star]");
  const starRoll = document.querySelector("[data-star-roll]");
  const starAgain = document.querySelector("[data-star-again]");
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

  function scheduleArchivePanelRender() {
    window.clearTimeout(archivePanelRenderTimer);
    archivePanelRenderTimer = window.setTimeout(function () {
      if (!document.body.classList.contains("is-index-open")) return;
      renderArchivePanel();
    }, 80);
  }

  function beginArchivePanelRender() {
    archiveOpenGen += 1;
    const gen = archiveOpenGen;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (gen !== archiveOpenGen) return;
        if (!document.body.classList.contains("is-index-open")) return;
        renderArchivePanel();
      });
    });
  }

  function shuffle(list) {
    const items = list.slice();
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
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

  function estimateArchiveImageHeight(count, width, height) {
    const gap = 5;
    const titleH = 22;
    const innerW = Math.max(0, width - 18);
    const innerH = Math.max(0, height - 14);
    let best = { imgH: 36, cellW: 48 };

    for (let cols = 1; cols <= Math.min(count, 16); cols += 1) {
      const rows = Math.ceil(count / cols);
      const cellW = (innerW - gap * (cols - 1)) / cols;
      const cellH = (innerH - gap * (rows - 1)) / rows;
      const imgH = cellH - titleH;
      if (cellW < 28 || imgH < 16) continue;
      const score = imgH * Math.min(cellW, imgH);
      const bestScore = best.imgH * Math.min(best.cellW, best.imgH);
      if (score >= bestScore) {
        best = { imgH: imgH, cellW: cellW };
      }
    }

    return best;
  }

  function getArchivePanelLayout(count, width, height) {
    const size = estimateArchiveImageHeight(count, width, height);
    const density = Math.min(1, 38 / Math.max(count, 1));
    const padding = 8;
    const gap = 5;
    const minW = Math.max(26, size.cellW * (0.55 + 0.22 * density));
    const maxW = Math.max(minW + 4, size.cellW * (0.82 + 0.12 * density));

    return {
      padding: padding,
      gap: gap,
      maxAttempts: count > 55 ? 90 : 130,
      imgMaxH: size.imgH,
      minW: minW,
      maxW: maxW,
      panelWidth: width,
      panelHeight: height,
    };
  }

  function archiveRectsOverlap(a, b, gap) {
    return !(
      a.right + gap < b.left ||
      a.left > b.right + gap ||
      a.bottom + gap < b.top ||
      a.top > b.bottom + gap
    );
  }

  function archiveItemRect(button, containerRect) {
    const rect = button.getBoundingClientRect();
    return {
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      right: rect.right - containerRect.left,
      bottom: rect.bottom - containerRect.top,
    };
  }

  function archiveCollides(rect, zones, gap) {
    for (let i = 0; i < zones.length; i += 1) {
      if (archiveRectsOverlap(rect, zones[i], gap)) {
        return true;
      }
    }
    return false;
  }

  function placeArchivePanelItem(button, img, placed, layout) {
    if (!img.naturalWidth) {
      button.remove();
      return;
    }

    const aspect = img.naturalWidth / img.naturalHeight;
    let itemW = Math.round(randomBetween(layout.minW, layout.maxW));
    let imgH = Math.min(layout.imgMaxH, itemW / aspect);
    itemW = Math.round(Math.min(itemW, imgH * aspect));
    itemW = Math.min(itemW, layout.panelWidth - layout.padding * 2);
    imgH = Math.min(layout.imgMaxH, itemW / aspect);

    button.style.width = itemW + "px";
    button.style.setProperty("--archive-img-max-h", Math.floor(imgH) + "px");
    button.style.setProperty("--archive-cell-w", itemW + "px");

    const panelWidth = archivePanel.clientWidth;
    const panelHeight = archivePanel.clientHeight;
    const containerRect = archivePanel.getBoundingClientRect();
    const maxLeft = Math.max(
      layout.padding,
      panelWidth - button.offsetWidth - layout.padding
    );
    const maxTop = Math.max(
      layout.padding,
      panelHeight - button.offsetHeight - layout.padding
    );

    let positioned = false;
    let rect;

    for (let attempt = 0; attempt < layout.maxAttempts; attempt += 1) {
      const left = randomBetween(layout.padding, maxLeft);
      const top = randomBetween(layout.padding, maxTop);

      button.style.left = Math.round(left) + "px";
      button.style.top = Math.round(top) + "px";

      rect = archiveItemRect(button, containerRect);

      if (rect.left < layout.padding || rect.top < layout.padding) continue;
      if (rect.right > panelWidth - layout.padding) continue;
      if (rect.bottom > panelHeight - layout.padding) continue;
      if (archiveCollides(rect, placed, layout.gap)) continue;

      positioned = true;
      break;
    }

    if (!positioned) {
      for (let attempt = 0; attempt < 48; attempt += 1) {
        const left = randomBetween(layout.padding, maxLeft);
        const top = randomBetween(layout.padding, maxTop);
        button.style.left = Math.round(left) + "px";
        button.style.top = Math.round(top) + "px";
        rect = archiveItemRect(button, containerRect);
        if (rect.bottom <= panelHeight - layout.padding && !archiveCollides(rect, placed, 2)) {
          positioned = true;
          break;
        }
      }
    }

    if (!positioned) {
      const angle = randomBetween(0, Math.PI * 2);
      const radius = randomBetween(0, Math.min(panelWidth, panelHeight) * 0.38);
      const cx = panelWidth / 2;
      const cy = panelHeight / 2;
      const left = cx + Math.cos(angle) * radius - button.offsetWidth / 2;
      const top = cy + Math.sin(angle) * radius - button.offsetHeight / 2;
      button.style.left = Math.round(Math.max(layout.padding, Math.min(left, maxLeft))) + "px";
      button.style.top = Math.round(Math.max(layout.padding, Math.min(top, maxTop))) + "px";
      rect = archiveItemRect(button, containerRect);
    }

    placed.push(rect);
    button.classList.remove("is-loading");
    button.classList.add("is-placed");
  }

  function renderArchivePanel() {
    if (!manifest.length) return;
    const panelWidth = archivePanel.clientWidth;
    const panelHeight = archivePanel.clientHeight;
    if (panelWidth < 48 || panelHeight < 48) {
      requestAnimationFrame(renderArchivePanel);
      return;
    }

    const token = ++scatterToken;
    archivePanel.classList.add("is-arranging");
    archivePanel.innerHTML = "";
    archivePanel.style.minHeight = "";
    archivePanel.style.removeProperty("grid-template-columns");
    archivePanel.style.removeProperty("grid-template-rows");
    archivePanel.style.removeProperty("gap");

    const layout = getArchivePanelLayout(manifest.length, panelWidth, panelHeight);
    const placed = [];
    const files = shuffle(manifest.slice());
    let pending = files.length;

    function finishArchiveArrange() {
      if (token !== scatterToken) return;
      pending -= 1;
      if (pending > 0) return;
      archivePanel.classList.remove("is-arranging");
    }

    files.forEach(function (entry) {
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
      img.decoding = "async";
      img.loading = "eager";

      const label = document.createElement("span");
      label.className = "archive-panel-item__title";
      label.textContent = title;

      const sources = thumbCandidates(entry.file).concat(fullPath(entry.file));
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

      img.addEventListener("load", function () {
        if (token !== scatterToken) return;
        placeArchivePanelItem(button, img, placed, layout);
        finishArchiveArrange();
      });

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
      button.appendChild(label);
      archivePanel.appendChild(button);
    });

    if (lastWorkId) {
      archivePanel.querySelectorAll(".arquivo-item").forEach(function (item) {
        item.classList.toggle("is-current", item.getAttribute("data-work-id") === lastWorkId);
      });
    }
  }

  function setIndexOpen(open) {
    document.body.classList.toggle("is-index-open", open);
    if (indexToggle) indexToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) {
      archiveOpenGen += 1;
      scatterToken += 1;
      archivePanel.classList.add("is-arranging");
      archivePanel.innerHTML = "";
      return;
    }
    if (manifest.length) {
      beginArchivePanelRender();
    }
  }

  function setWorkSectionOpen(open) {
    document.body.classList.toggle("is-work-open", open);
    if (!open) setIndexOpen(false);
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
    updateStarAgainLabel();
  }

  function isPastHero() {
    return document.body.classList.contains("is-work-open");
  }

  function scrollToTop() {
    setIndexOpen(false);
    document.body.classList.remove("is-star-flight");
    works.querySelectorAll(".work").forEach(function (node) {
      node.classList.remove("is-active");
      node.setAttribute("aria-hidden", "true");
    });
    setWorkSectionOpen(false);
    window.scrollTo(0, 0);
    updateStarAgainLabel();
  }

  function flyStarBetween(fromEl, toEl, onDone) {
    const sourceImg = fromEl && fromEl.querySelector("img");
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
    const img = document.createElement("img");
    img.src = sourceImg.currentSrc || sourceImg.src;
    img.alt = "";
    fly.appendChild(img);
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
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(run);
    });

    let done = false;
    function complete() {
      if (done) return;
      done = true;
      finish();
    }

    fly.addEventListener("transitionend", function (event) {
      if (event.propertyName === "transform") complete();
    });
    window.setTimeout(complete, 950);
  }

  function updateStarAgainLabel() {
    if (!starAgain) return;
    const en = document.documentElement.lang === "en";
    if (isPastHero()) {
      starAgain.setAttribute("aria-label", en ? "Back to star" : "Voltar à estrela");
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
      section.className = "work";
      section.id = group.id;
      section.setAttribute("aria-hidden", "true");

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

      section.appendChild(frame);

      works.appendChild(section);
    }
  }

  function setSobreOpen(open) {
    if (!overlay || !sobreToggle) return;
    overlay.hidden = !open;
    document.body.classList.toggle("is-sobre-open", open);
    sobreToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) setIndexOpen(false);
    if (!open) {
      document.body.classList.remove("is-cv-open");
      const panel = overlay.querySelector(".sobre-cv-panel");
      if (panel) panel.hidden = true;
      const cv = overlay.querySelector("[data-cv-toggle]");
      if (cv) cv.setAttribute("aria-expanded", "false");
    }
  }

  if (sobreToggle) {
    sobreToggle.addEventListener("click", function () {
      setSobreOpen(overlay && overlay.hidden);
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

  if (starAgain) {
    starAgain.addEventListener("click", function () {
      if (document.body.classList.contains("is-index-open")) {
        setIndexOpen(false);
        return;
      }
      if (isPastHero()) {
        scrollToTop();
        return;
      }
      spinToWork();
    });
    updateStarAgainLabel();
    document.addEventListener("avv-lang", updateStarAgainLabel);
  }

  if (starRoll) starRoll.hidden = false;

  function syncStarRollMotion() {
    const dock = document.querySelector(".star-roll__dock");
    const mover = starAgain;
    const toggle = indexToggle;
    if (!dock || !mover || !document.body.classList.contains("is-work-open")) return;

    const dockWidth = dock.clientWidth;
    const moverWidth = mover.offsetWidth;
    if (moverWidth < 1) return;

    const toggleWidth = toggle ? toggle.offsetWidth : 0;
    const travelPx = Math.max(0, dockWidth - moverWidth - toggleWidth - 6);
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
    await renderWorks(groups);
    lockScrollTop();
    syncStarRollMotion();
  }

  let lastWidth = window.innerWidth;
  window.addEventListener("resize", function () {
    const width = window.innerWidth;
    if (Math.abs(width - lastWidth) < 80) return;
    lastWidth = width;
    if (manifest.length && document.body.classList.contains("is-index-open")) {
      scheduleArchivePanelRender();
    }
  });

  init();
})();
