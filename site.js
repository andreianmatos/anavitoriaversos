(function () {
  const imageDir = "imagens/arquivo/";
  const thumbDir = "imagens/arquivo/thumbs/";
  const manifestUrl = document.body.getAttribute("data-manifest") || "images.json";

  /** URL slug (path segment) per obra kind — ver também _redirects */
  const WORK_ROUTE_SLUG = {
    umbigo: "DeQuemVens",
    leva: "LevaMeDeVolta",
    frango: "QuemVeioPrimeiro",
    "reinventar-aroda": "ReInventarARoda",
  };

  /** HTML fragments na raiz do site (carregados em #obras) */
  const WORK_FRAGMENTS = {
    umbigo: { file: "umbigo.html", selector: "main.umbigo" },
    leva: { file: "leva-me-de-volta.html", selector: "main.leva" },
    frango: { file: "quem-veio-primeiro.html", selector: "main.frango" },
    "reinventar-aroda": { file: "reinventar-a-roda.html", selector: "main.reinventar-aroda" },
  };

  /** Pastas em imagens/arquivo/ — mesmo nome que o fragmento HTML (kebab-case) */
  const WORK_ARCHIVE_DIR = {
    umbigo: "de-quem-vens",
    frango: "quem-veio-primeiro",
    leva: "leva-me-de-volta",
    "reinventar-aroda": "reinventar-a-roda",
  };

  const WORK_PAGE_HREFS = {
    umbigo: ["umbigo.html"],
    leva: ["leva-me-de-volta.html"],
    frango: ["quem-veio-primeiro.html", "frango.html"],
    "reinventar-aroda": ["reinventar-a-roda.html"],
  };

  function workPageHrefMatches(kind, href) {
    const list = WORK_PAGE_HREFS[kind];
    return list ? list.indexOf(href) !== -1 : false;
  }
  const works = document.getElementById("obras");
  const star = document.querySelector("[data-star]");
  const starRoll = document.querySelector("[data-star-roll]");
  const starDock = document.querySelector("[data-star-dock]");
  const sobreRoll = document.querySelector(".sobre-roll");
  const siteHomeNodes = document.querySelectorAll("[data-site-home]");

  function getHomeDockFig() {
    return starDock ? starDock.querySelector(".wheel-figure--home") : null;
  }

  const HOME_STAR_REST_DEG = 0;
  const HOME_DOCK_SETTLE_MS = 1200;

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

  function workSlug(title) {
    return String(title || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(function (word) {
        if (/^\d/.test(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join("");
  }

  function assignWorkPaths(list) {
    const used = {};
    list.forEach(function (group) {
      let base =
        WORK_ROUTE_SLUG[group.kind] !== undefined
          ? WORK_ROUTE_SLUG[group.kind]
          : workSlug(group.title);
      if (!base) base = "Obra";
      let path = base;
      let extra = 2;
      while (used[path]) {
        path = base + extra;
        extra += 1;
      }
      used[path] = true;
      group.path = path;
    });
  }

  function pathSlugFromLocation() {
    const fromQuery = new URLSearchParams(location.search).get("obra");
    if (fromQuery) return fromQuery;
    let path = location.pathname || "/";
    path = path.replace(/\/index\.html$/i, "").replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    if (!parts.length) return "";
    const last = decodeURIComponent(parts[parts.length - 1]);
    if (/\.[a-z0-9]+$/i.test(last)) return "";
    return last;
  }

  const WORK_PATH_ALIASES = {
    Frango: "QuemVeioPrimeiro",
  };

  function findGroupByPath(slug) {
    if (!slug) return null;
    if (WORK_PATH_ALIASES[slug]) slug = WORK_PATH_ALIASES[slug];
    return (
      groups.find(function (group) {
        return group.path === slug;
      }) || null
    );
  }

  function showWorkUrl(group) {
    if (!group || !group.path) return;
    const next = "/" + group.path;
    if (location.pathname === next) return;
    history.pushState({ work: group.path }, "", next);
  }

  function showHomeUrl() {
    const slug = pathSlugFromLocation();
    if (!slug) return;
    const home = "/";
    history.pushState({ work: "" }, "", home);
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

  const PAGE_PHOTO_PREFIX = "consequencias/";

  function normalizeAssetSrc(src) {
    if (!src) return "";
    const clean = String(src).split("?")[0];
    try {
      return decodeURIComponent(clean);
    } catch (error) {
      return clean;
    }
  }

  function assetKeyFromSrc(src) {
    const normalized = normalizeAssetSrc(src);
    const marker = "imagens/arquivo/";
    const idx = normalized.indexOf(marker);
    return idx === -1 ? normalized : normalized.slice(idx);
  }

  function existingImageKeys(root) {
    const set = new Set();
    if (!root) return set;
    root.querySelectorAll("img[src]").forEach(function (img) {
      set.add(assetKeyFromSrc(img.getAttribute("src") || img.currentSrc || ""));
    });
    return set;
  }

  async function loadPagePhotoManifest(baseDir) {
    try {
      const response = await fetch(imageDir + encodePath(baseDir + "/images.json"), {
        cache: "no-store",
      });
      if (!response.ok) return [];
      const data = await response.json();
      const items = Array.isArray(data) ? data : data.items || [];
      return items.filter(function (entry) {
        const file = entry && entry.file ? String(entry.file) : "";
        if (file.indexOf(PAGE_PHOTO_PREFIX) !== 0) return false;
        if (entry.polaroid === false) return false;
        return true;
      });
    } catch (error) {
      return [];
    }
  }

  function appendPagePhotoFigure(host, src, options) {
    const figure = document.createElement("figure");
    if (options && options.figureClass) figure.className = options.figureClass;
    if (options && options.tilt != null) {
      figure.style.setProperty("--polaroid-tilt", String(options.tilt));
    }
    if (options && options.tabIndex) figure.tabIndex = 0;
    if (options && options.ariaLabel) figure.setAttribute("aria-label", options.ariaLabel);
    const img = document.createElement("img");
    if (options && options.imgClass) img.className = options.imgClass;
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    figure.appendChild(img);
    host.appendChild(figure);
    return figure;
  }

  async function hydrateCustomPagePhotos(main, baseDir) {
    const items = await loadPagePhotoManifest(baseDir);
    if (!items.length) return;
    const existing = existingImageKeys(main);
    const polaroidTilts = [-5, 3, -2, 4, -3];

    items.forEach(function (entry, index) {
      const file = baseDir + "/" + entry.file;
      const src = fullPath(file);
      if (existing.has(assetKeyFromSrc(src))) return;

      if (baseDir === WORK_ARCHIVE_DIR.umbigo) {
        const caixas = main.querySelector(".umbigo-caixas");
        if (!caixas) return;
        appendPagePhotoFigure(caixas, src);
      } else if (baseDir === WORK_ARCHIVE_DIR.frango) {
        if (entry.polaroid !== true) return;
        const deck =
          main.querySelector(".frango-polaroids__deck--play") ||
          main.querySelector(".frango-polaroids__deck");
        if (!deck) return;
        appendPagePhotoFigure(deck, src, {
          figureClass: "frango-polaroid",
          imgClass: "frango-polaroid__frame",
          tilt: polaroidTilts[index % polaroidTilts.length],
          tabIndex: true,
          ariaLabel: "Polaroid",
        });
      } else if (baseDir === "leva-me-de-volta") {
        const host = main.querySelector("[data-page-extra-photos]");
        if (!host) return;
        host.hidden = false;
        appendPagePhotoFigure(host, src);
      } else if (baseDir === "reinventar-a-roda") {
        const stage = main.querySelector(".reinventar-aroda__stage");
        if (!stage) return;
        appendPagePhotoFigure(stage, src, {
          figureClass: "reinventar-aroda__float reinventar-aroda__float--extra",
          tabIndex: true,
          ariaLabel: "Imagem",
        });
      } else {
        const host = main.querySelector("[data-page-extra-photos]");
        if (!host) return;
        host.hidden = false;
        appendPagePhotoFigure(host, src);
      }

      existing.add(assetKeyFromSrc(src));
    });
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
    if (Array.isArray(entry.text)) {
      return entry.text.join("\n\n");
    }
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

  function buildWorkTextStream(entry) {
    if (typeof window.avvBuildWorkTextStream === "function") {
      return window.avvBuildWorkTextStream(entry);
    }
    const stream = document.createElement("div");
    stream.className = "work__stream";
    return stream;
  }

  function workUsesTextStream(entry) {
    if (!entry) return false;
    return Boolean(entry.textStream);
  }

  function workTextParts(entry) {
    if (!entry) return [];
    if (Array.isArray(entry.text)) {
      return entry.text.map(function (part) {
        return String(part || "").trim();
      }).filter(Boolean);
    }
    const text = resolveWorkText(entry);
    return text ? [text] : [];
  }

  function paintWorkText(textEl, parts) {
    textEl.textContent = "";
    const hasNotes = parts.some(function (part, index) {
      if (index === 0) return false;
      return /[a-záàâãéêíóôõúç]/.test(part);
    });
    parts.forEach(function (part, index) {
      const block = document.createElement("p");
      block.className = !hasNotes || index === 0 ? "work__text-verse" : "work__text-note";
      block.textContent = part;
      textEl.appendChild(block);
    });
  }

  function applyWorkCopy(section, entry) {
    if (workUsesTextStream(entry)) return;
    const textEl = section.querySelector(".work__text");
    const titleEl = section.querySelector(".work__copy-title");
    const copyWrap = section.querySelector(".work__copy");
    if (!textEl || !copyWrap) return;
    const parts = workTextParts(entry);
    const title = entry ? entry.title || titleFromFile(entry.file) : "";
    if (titleEl) titleEl.textContent = title;
    paintWorkText(textEl, parts);
    copyWrap.hidden = !parts.length && !title;
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

    if (ext === ".png") {
      const pngName = encodeURIComponent(base + ".png");
      return [
        folderThumbs + pngName,
        rootThumbs + pngName,
        rootThumbs + encodePath(dir + base + ".png"),
        fullPath(file),
      ];
    }

    const jpgName = encodeURIComponent(base + ".jpg");
    const fileJpg = encodeURIComponent(name + ".jpg");
    const candidates = [];
    candidates.push(rootThumbs + jpgName);
    candidates.push(folderThumbs + jpgName);
    candidates.push(rootThumbs + encodePath(dir + base + ".jpg"));
    if (ext !== ".jpg" && ext !== ".jpeg") {
      candidates.push(folderThumbs + fileJpg);
      candidates.push(rootThumbs + encodePath(dir + name + ".jpg"));
      candidates.push(rootThumbs + fileJpg);
    }
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

  function scheduleIdle(task) {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(function () {
        task();
      }, { timeout: 2400 });
      return;
    }
    window.setTimeout(task, 400);
  }

  function isUmbigoEntry(entry) {
    const file = String(entry.file || "");
    const href = entry.href ? String(entry.href).trim() : "";
    return (
      file.indexOf(WORK_ARCHIVE_DIR.umbigo + "/") === 0 ||
      file.indexOf("umbigo/") === 0 ||
      workPageHrefMatches("umbigo", href)
    );
  }

  function isLevaEntry(entry) {
    const file = String(entry.file || "");
    const href = entry.href ? String(entry.href).trim() : "";
    return (
      file === "in utero 3D.png" ||
      file === "primeira queda.png" ||
      file === "leva-me-de-volta/in utero 3D.png" ||
      file === "leva-me-de-volta/primeira queda.png" ||
      file.indexOf("leva-me-de-volta/") === 0 ||
      workPageHrefMatches("leva", href)
    );
  }

  function isFrangoEntry(entry) {
    const file = String(entry.file || "");
    const href = entry.href ? String(entry.href).trim() : "";
    return (
      file === "frango.png" ||
      file === "frango(1).png" ||
      file === "frango/frango.png" ||
      file === "frango/frango(1).png" ||
      file === WORK_ARCHIVE_DIR.frango + "/frango.png" ||
      file === WORK_ARCHIVE_DIR.frango + "/frango(1).png" ||
      file.indexOf(WORK_ARCHIVE_DIR.frango + "/") === 0 ||
      file.indexOf("frango/") === 0 ||
      workPageHrefMatches("frango", href)
    );
  }

  function isReinventarArodaEntry(entry) {
    const file = String(entry.file || "");
    const href = entry.href ? String(entry.href).trim() : "";
    return (
      file === "reinventar a roda.png" ||
      file === "reinventar-a-roda/reinventar a roda.png" ||
      file.indexOf("reinventar-a-roda/") === 0 ||
      workPageHrefMatches("reinventar-aroda", href)
    );
  }

  function groupEntries(items) {
    const groups = [];
    let umbigoGroup = null;
    let levaGroup = null;
    let frangoGroup = null;
    let reinventarArodaGroup = null;

    items.forEach(function (entry, index) {
      const title = entry.title || titleFromFile(entry.file);

      if (isUmbigoEntry(entry)) {
        if (!umbigoGroup) {
          umbigoGroup = {
            id: "obra-umbigo",
            title: "De quem vens?",
            kind: "umbigo",
            files: [],
            file: entry.file,
          };
          groups.push(umbigoGroup);
        }
        umbigoGroup.files.push(entry);
        return;
      }

      if (isLevaEntry(entry)) {
        if (!levaGroup) {
          levaGroup = {
            id: "obra-leva-me-de-volta",
            title: "Leva-me de volta",
            kind: "leva",
            files: [],
            file: entry.file,
          };
          groups.push(levaGroup);
        }
        levaGroup.files.push(entry);
        return;
      }

      if (isFrangoEntry(entry)) {
        if (!frangoGroup) {
          frangoGroup = {
            id: "obra-frango",
            title: "Quem veio primeiro",
            kind: "frango",
            files: [],
            file: entry.file,
          };
          groups.push(frangoGroup);
        }
        frangoGroup.files.push(entry);
        return;
      }

      if (isReinventarArodaEntry(entry)) {
        if (!reinventarArodaGroup) {
          reinventarArodaGroup = {
            id: "obra-reinventar-a-roda",
            title: "Reinventar a roda",
            kind: "reinventar-aroda",
            files: [],
            file: entry.file,
          };
          groups.push(reinventarArodaGroup);
        }
        reinventarArodaGroup.files.push(entry);
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
    if (group.kind === "frango") {
      scrollToWork(group.id, "");
      return;
    }
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
    stopInactiveFrangoVideos();
    if (section.classList.contains("work--frango")) {
      startFrangoVideo(section);
    }
    if (section.classList.contains("work--reinventar-aroda")) {
      requestAnimationFrame(function () {
        initReinventarArodaDrag(section);
      });
    }
    if (section.classList.contains("work--frango")) {
      requestAnimationFrame(function () {
        initFrangoPolaroids(section, { forceLayout: true });
        fitFrangoIntroHeading(section);
      });
    }
  }

  const umbigoFragmentCache = { template: null, promise: null };
  const levaFragmentCache = { template: null, promise: null };
  const frangoFragmentCache = { template: null, promise: null };
  const reinventarFragmentCache = { template: null, promise: null };

  function createWorkFragmentLoader(spec, cache) {
    return function loadWorkMain() {
      if (cache.template) {
        return Promise.resolve(cache.template.cloneNode(true));
      }
      if (!cache.promise) {
        cache.promise = (async function () {
          try {
            const response = await fetch(spec.file);
            if (!response.ok) throw new Error(spec.file);
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            const main = doc.querySelector(spec.selector);
            if (!main) throw new Error(spec.file);
            cache.template = main;
            return cache.template;
          } catch (error) {
            console.error("Nao foi possivel carregar " + spec.file, error);
            cache.promise = null;
            return null;
          }
        })();
      }
      return cache.promise.then(function (main) {
        return main ? main.cloneNode(true) : null;
      });
    };
  }
  const FRANGO_VIMEO_SRC =
    "https://player.vimeo.com/video/1031577006?autoplay=0&loop=1&muted=1&background=1&title=0&byline=0&portrait=0&playsinline=1&dnt=1&api=1";
  const FRANGO_VIMEO_START_SEC = 8;

  function frangoVideoIframe(section) {
    return section ? section.querySelector(".frango-video__player") : null;
  }

  function frangoVideoFrame(section) {
    return section ? section.querySelector(".frango-video__frame") : null;
  }

  function frangoSetVideoRevealed(section, revealed) {
    const frame = frangoVideoFrame(section);
    if (!frame) return;
    frame.classList.toggle("is-playing", Boolean(revealed));
  }

  function frangoPlayerPost(iframe, payload) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(JSON.stringify(payload), "https://player.vimeo.com");
    } catch (error) {}
  }

  function frangoWhenPlayerReady(iframe, fn) {
    if (!iframe) return;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      fn();
    }
    function onMessage(event) {
      if (event.origin !== "https://player.vimeo.com") return;
      if (event.source !== iframe.contentWindow) return;
      var data;
      try {
        data = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      if (data && data.event === "ready") {
        window.removeEventListener("message", onMessage);
        run();
      }
    }
    window.addEventListener("message", onMessage);
    frangoPlayerPost(iframe, { method: "addEventListener", value: "ready" });
    if (iframe.classList.contains("is-ready")) {
      window.setTimeout(run, 0);
    }
  }

  function frangoBindPlayerShell(iframe) {
    if (!iframe || iframe.dataset.avvFrangoBound === "1") return;
    iframe.dataset.avvFrangoBound = "1";
    iframe.addEventListener("load", function () {
      iframe.classList.add("is-ready");
      frangoPlayerPost(iframe, { method: "addEventListener", value: "ready" });
    });
  }

  function preloadFrangoVideo(section) {
    const iframe = frangoVideoIframe(section);
    if (!iframe) return;
    frangoBindPlayerShell(iframe);
    if (!iframe.getAttribute("src")) {
      iframe.setAttribute("src", FRANGO_VIMEO_SRC);
    }
  }

  function pauseFrangoVideo(section) {
    const iframe = frangoVideoIframe(section);
    if (!iframe || !iframe.getAttribute("src")) return;
    frangoPlayerPost(iframe, { method: "pause" });
    frangoSetVideoRevealed(section, false);
  }

  function stopFrangoVideo(section) {
    pauseFrangoVideo(section);
  }

  function stopInactiveFrangoVideos() {
    works.querySelectorAll(".work.work--frango:not(.is-active)").forEach(stopFrangoVideo);
  }

  function frangoWhenPlayerEvent(iframe, eventName, fn) {
    if (!iframe) return;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      fn();
    }
    function onMessage(event) {
      if (event.origin !== "https://player.vimeo.com") return;
      if (event.source !== iframe.contentWindow) return;
      var data;
      try {
        data = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      if (data && data.event === eventName) {
        window.removeEventListener("message", onMessage);
        run();
      }
    }
    window.addEventListener("message", onMessage);
    frangoWhenPlayerReady(iframe, function () {
      frangoPlayerPost(iframe, { method: "addEventListener", value: eventName });
    });
  }

  function frangoPlayFromMark(section, iframe) {
    frangoSetVideoRevealed(section, false);
    frangoWhenPlayerEvent(iframe, "playing", function () {
      frangoSetVideoRevealed(section, true);
    });
    frangoPlayerPost(iframe, { method: "setCurrentTime", value: FRANGO_VIMEO_START_SEC });
    frangoPlayerPost(iframe, { method: "play" });
    frangoWhenPlayerReady(iframe, function () {
      frangoPlayerPost(iframe, { method: "setCurrentTime", value: FRANGO_VIMEO_START_SEC });
      frangoPlayerPost(iframe, { method: "play" });
    });
  }

  function startFrangoVideo(section) {
    const iframe = frangoVideoIframe(section);
    if (!iframe) return;
    if (!section.classList.contains("is-active")) return;
    preloadFrangoVideo(section);
    frangoPlayFromMark(section, iframe);
  }

  function levaTextEntry(group) {
    if (!group || !group.files) return null;
    return (
      group.files.find(function (entry) {
        return entry.textStream || (Array.isArray(entry.text) && entry.text.length);
      }) || group.files[0]
    );
  }

  function mountLevaLegend(legendHost) {
    if (typeof window.avvMountLevaLegend === "function") {
      window.avvMountLevaLegend(legendHost);
    }
  }

  const loadUmbigoMain = createWorkFragmentLoader(WORK_FRAGMENTS.umbigo, umbigoFragmentCache);
  const loadLevaMain = createWorkFragmentLoader(WORK_FRAGMENTS.leva, levaFragmentCache);
  const loadFrangoMain = createWorkFragmentLoader(WORK_FRAGMENTS.frango, frangoFragmentCache);
  const loadReinventarArodaMain = createWorkFragmentLoader(
    WORK_FRAGMENTS["reinventar-aroda"],
    reinventarFragmentCache
  );

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
    if (!scatter || typeof scatter.getLayout !== "function") {
      console.error("Nao foi possivel carregar o arquivo (archive-scatter.js).");
      archivePanel.classList.remove("is-arranging");
      scrollSurface.classList.remove("is-preparing");
      return;
    }
    const panelSeed = freshArchiveSeed();
    const files = seededShuffle(manifest.slice(), panelSeed);
    const layout = scatter.getLayout(files.length, scatterWidth, panelHeight, { panel: true });
    const placed = [];
    let contentBottom = layout.padding;
    let pending = files.length;
    let arrangeDeadline = 0;

    function revealArchiveScatter() {
      window.clearTimeout(arrangeDeadline);
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

    if (!files.length) {
      revealArchiveScatter();
      return;
    }

    arrangeDeadline = window.setTimeout(function () {
      if (token !== scatterToken) return;
      if (!scrollSurface.classList.contains("is-preparing")) return;
      revealArchiveScatter();
    }, 12000);

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

      window.setTimeout(function () {
        if (token !== scatterToken) return;
        if (button.parentNode || placeFragment.contains(button)) return;
        mountPlacedItem();
        if (!button.parentNode && !placeFragment.contains(button)) {
          finishArchiveArrange();
        }
      }, 7500);

      button.addEventListener("click", function () {
        archivePanel.querySelectorAll(".arquivo-item.is-picked").forEach(function (node) {
          node.classList.remove("is-picked");
        });
        button.classList.add("is-picked");
        setIndexOpen(false);
        const targetGroup = findGroupForFile(entry.file) || group;
        if (targetGroup) {
          navigateToGroup(targetGroup, entry.file);
          return;
        }
        if (entry.href) {
          window.location.href = entry.href;
        }
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

  function restartStarRollAnimation() {}

  function scrollToWork(id, anchorFile, options) {
    const section = document.getElementById(id);
    if (!section) return;
    lastWorkId = id;
    const group = groups.find(function (item) {
      return item.id === id;
    });
    const frangoVideoFirst = group && group.kind === "frango";
    setWorkSectionOpen(true);
    window.scrollTo(0, 0);
    activateWorkSection(section);
    if (!options || !options.skipUrl) {
      showWorkUrl(group);
    }

    function alignViewport() {
      if (frangoVideoFirst || !anchorFile) {
        section.scrollTo({ top: 0, behavior: "auto" });
        return;
      }
      const anchor = findWorkAnchor(section, anchorFile);
      if (anchor) {
        scrollElementToReveal(section, anchor);
      } else {
        section.scrollTo({
          top: 0,
          behavior: reducedMotion.matches ? "auto" : "smooth",
        });
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

  function freezeHomeDockFig(fig) {
    if (!fig) return;
    const deg = getWheelRotation(fig);
    fig.getAnimations().forEach(function (anim) {
      anim.cancel();
    });
    fig.style.animation = "none";
    fig.style.animationDelay = "";
    fig.style.removeProperty("--wheel-spin-base");
    fig.style.transform = "rotate(" + deg + "deg)";
  }

  function settleHomeDockFig(fig) {
    if (!fig) return;
    fig.getAnimations().forEach(function (anim) {
      anim.cancel();
    });
    fig.style.animation = "none";
    fig.style.animationDelay = "";
    fig.style.removeProperty("--wheel-spin-base");
    fig.style.transform = "rotate(" + HOME_STAR_REST_DEG + "deg)";
  }

  function easeHomeDockToRest(fig, spinMeta) {
    if (!fig) return Promise.resolve();
    spinMeta = spinMeta || {};
    const from = getWheelRotation(fig);
    let delta = HOME_STAR_REST_DEG - from;
    const spinSign = (spinMeta.spinExtraDeg || 360) >= 0 ? 1 : -1;
    if (spinSign > 0) {
      while (delta <= 0) delta += 360;
    } else {
      while (delta >= 0) delta -= 360;
    }
    if (Math.abs(delta) < 0.35) {
      settleHomeDockFig(fig);
      return Promise.resolve();
    }
    if (reducedMotion.matches) {
      settleHomeDockFig(fig);
      return Promise.resolve();
    }
    const end = from + delta;
    const dist = Math.abs(delta);
    const spinDuration = spinMeta.spinDuration || 1720;
    const spinExtra = Math.abs(spinMeta.spinExtraDeg || 360);
    const omega = spinExtra / spinDuration;
    let duration = dist / Math.max(omega, 0.08);
    duration = Math.min(Math.max(duration, 320), HOME_DOCK_SETTLE_MS);

    fig.getAnimations().forEach(function (anim) {
      anim.cancel();
    });
    fig.style.animation = "none";
    const anim = fig.animate(
      [
        { transform: "rotate(" + from + "deg)" },
        { transform: "rotate(" + end + "deg)" },
      ],
      {
        duration: duration,
        easing: "cubic-bezier(0.12, 0.72, 0.22, 1)",
        fill: "forwards",
      }
    );
    return anim.finished.then(function () {
      fig.getAnimations().forEach(function (a) {
        a.cancel();
      });
      fig.style.animation = "none";
      fig.style.removeProperty("--wheel-spin-base");
      fig.style.transform = "rotate(" + HOME_STAR_REST_DEG + "deg)";
    });
  }

  function scrollToTop(options) {
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
    if (!options || !options.skipUrl) showHomeUrl();
  }

  function flyStarBetween(fromEl, toEl, onDone, flyOpts) {
    flyOpts = flyOpts || {};
    const sourceImg =
      fromEl &&
      (fromEl.querySelector(".wheel-figure__img") || fromEl.querySelector("img"));
    if (!fromEl || !toEl || !sourceImg) {
      if (onDone) onDone();
      return;
    }

    const deferTarget = flyOpts.deferTargetMeasure === true;
    const fromRect = fromEl.getBoundingClientRect();
    if (fromRect.width < 1) {
      if (onDone) onDone();
      return;
    }
    if (!deferTarget) {
      const toRectCheck = toEl.getBoundingClientRect();
      if (toRectCheck.width < 1) {
        if (onDone) onDone();
        return;
      }
    }

    const fly = document.createElement("div");
    fly.className = "star-flight";
    fly.setAttribute("aria-hidden", "true");

    const bonecoLayer = document.createElement("div");
    bonecoLayer.className = "star-flight__boneco wheel-figure";
    const img = document.createElement("img");
    img.className = "wheel-figure__img";
    img.src = sourceImg.currentSrc || sourceImg.src;
    img.alt = "";
    bonecoLayer.appendChild(img);
    const shine = document.createElement("span");
    shine.className = "wheel-figure__shine";
    shine.setAttribute("aria-hidden", "true");
    bonecoLayer.appendChild(shine);

    const wheelWrap = document.createElement("div");
    wheelWrap.className = "star-flight__wheel";

    const linkedSpin =
      typeof flyOpts.spinFromDeg === "number" && typeof flyOpts.spinExtraDeg === "number";
    let spinAnim = null;
    let dockSpinAnim = null;
    if (linkedSpin) {
      const spinKeyframes = [
        { transform: "rotate(" + flyOpts.spinFromDeg + "deg)" },
        {
          transform: "rotate(" + (flyOpts.spinFromDeg + flyOpts.spinExtraDeg) + "deg)",
        },
      ];
      const spinTiming = {
        duration: flyOpts.spinDuration || FLIGHT_MS,
        easing: flyOpts.spinEasing || FLIGHT_EASING,
        fill: "forwards",
      };
      wheelWrap.style.transform = "rotate(" + flyOpts.spinFromDeg + "deg)";
      spinAnim = wheelWrap.animate(spinKeyframes, spinTiming);
      if (flyOpts.keepDockVisible && toEl) {
        const dockFig = toEl.querySelector(".wheel-figure--dock");
        if (dockFig) {
          dockFig.style.animation = "none";
          dockFig.style.transform = "rotate(" + flyOpts.spinFromDeg + "deg)";
        }
      } else if (!deferTarget) {
        const dockFig = toEl.querySelector(".wheel-figure--dock");
        if (dockFig) {
          dockFig.getAnimations().forEach(function (anim) {
            anim.cancel();
          });
          dockFig.style.animation = "none";
          dockFig.style.transform = "rotate(" + flyOpts.spinFromDeg + "deg)";
          dockSpinAnim = dockFig.animate(spinKeyframes, spinTiming);
        }
      }
    }

    const strokesLayer = document.createElement("div");
    strokesLayer.className = "star-flight__strokes";
    const linesTemplate = toEl.querySelector(".wheel-figure__lines");
    if (linesTemplate) {
      strokesLayer.appendChild(linesTemplate.cloneNode(true));
    }

    wheelWrap.appendChild(bonecoLayer);
    wheelWrap.appendChild(strokesLayer);
    fly.appendChild(wheelWrap);
    document.body.appendChild(fly);

    fromEl.classList.add("is-star-handoff");
    if (!flyOpts.keepDockVisible) {
      toEl.classList.add("is-star-handoff");
    }

    const fromCx = fromRect.left + fromRect.width / 2;
    const fromCy = fromRect.top + fromRect.height / 2;
    let toCx = fromCx;
    let toCy = fromCy;
    let scale = 1;

    const holdMs = flyOpts.holdMs || 0;
    const flightMoveMs = flyOpts.flightMoveMs || flyOpts.spinDuration || FLIGHT_MS;
    const morphLeadMs = flyOpts.morphLeadMs || FLIGHT_MORPH_LEAD_MS;
    fly.style.setProperty("--star-flight-ms", flightMoveMs + "ms");
    if (flyOpts.spinEasingMove) {
      fly.style.setProperty("--star-flight-ease", flyOpts.spinEasingMove);
    } else {
      fly.style.removeProperty("--star-flight-ease");
    }
    fly.style.width = fromRect.width + "px";
    fly.style.height = fromRect.height + "px";
    fly.style.transform =
      "translate(" + fromCx + "px, " + fromCy + "px) translate(-50%, -50%)";

    function finish() {
      let finalDeg = linkedSpin ? flyOpts.spinFromDeg + flyOpts.spinExtraDeg : 0;
      if (linkedSpin) {
        finalDeg = getWheelRotation(wheelWrap);
      }
      stopDockFlySync();
      if (spinAnim) spinAnim.cancel();
      if (dockSpinAnim) dockSpinAnim.cancel();

      const instantStar = flyOpts.instantStarHandoff === true;
      if (flyOpts.keepDockVisible && linkedSpin) {
        const dockFig = toEl.querySelector(".wheel-figure--dock");
        if (dockFig) {
          dockFig.style.animation = "none";
          dockFig.style.transform = "rotate(" + finalDeg + "deg)";
        }
      } else {
        primeDockWheelHandoff(toEl, finalDeg);
      }

      if (instantStar) {
        const boneco = fly.querySelector(".star-flight__boneco");
        const strokes = fly.querySelector(".star-flight__strokes");
        if (boneco) {
          boneco.style.transition = "none";
        }
        if (strokes) {
          strokes.style.transition = "none";
          strokes.style.opacity = "1";
          strokes.style.transform = "scale(1)";
        }
        fromEl.classList.remove("is-star-handoff");
        toEl.classList.remove("is-star-handoff");
        window.requestAnimationFrame(function () {
          fly.remove();
          window.requestAnimationFrame(function () {
            if (onDone) onDone(finalDeg);
          });
        });
        return;
      }

      fly.remove();
      fromEl.classList.remove("is-star-handoff");
      toEl.classList.remove("is-star-handoff");
      if (onDone) onDone(finalDeg);
    }

    let morphTimer = 0;
    let syncDockRaf = 0;

    function stopDockFlySync() {
      if (!syncDockRaf) return;
      window.cancelAnimationFrame(syncDockRaf);
      syncDockRaf = 0;
    }

    function startDockFlySync() {
      if (!flyOpts.keepDockVisible || !linkedSpin) return;
      const dockFig = toEl.querySelector(".wheel-figure--dock");
      if (!dockFig) return;
      stopDockFlySync();
      function tick() {
        if (!fly.isConnected) return;
        dockFig.style.animation = "none";
        dockFig.style.transform = "rotate(" + getWheelRotation(wheelWrap) + "deg)";
        syncDockRaf = window.requestAnimationFrame(tick);
      }
      tick();
    }

    function syncDockSpinForDescend() {
      if (!linkedSpin) return;
      if (flyOpts.keepDockVisible) return;
      const dockFig = toEl.querySelector(".wheel-figure--dock");
      if (!dockFig) return;
      const currentDeg = getWheelRotation(wheelWrap);
      const endDeg = flyOpts.spinFromDeg + flyOpts.spinExtraDeg;
      dockFig.getAnimations().forEach(function (anim) {
        anim.cancel();
      });
      dockFig.style.animation = "none";
      dockFig.style.transform = "rotate(" + currentDeg + "deg)";
      dockSpinAnim = dockFig.animate(
        [
          { transform: "rotate(" + currentDeg + "deg)" },
          { transform: "rotate(" + endDeg + "deg)" },
        ],
        {
          duration: flightMoveMs,
          easing: flyOpts.spinEasing || "linear",
          fill: "forwards",
        }
      );
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
      if (!flyOpts.skipMorph) {
        morphTimer = window.setTimeout(function () {
          fly.classList.add("is-morph");
          if (flyOpts.revealDockOnMorph) {
            toEl.classList.remove("is-star-handoff");
          }
        }, Math.max(0, flightMoveMs - morphLeadMs));
      }
    }

    function beginDescend() {
      if (typeof flyOpts.onBeforeDescend === "function") {
        flyOpts.onBeforeDescend();
      }
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          const toRect = toEl.getBoundingClientRect();
          if (toRect.width < 1) {
            complete();
            return;
          }
          toCx = toRect.left + toRect.width / 2;
          toCy = toRect.top + toRect.height / 2;
          scale = toRect.width / fromRect.width;
          fly.style.setProperty("--star-flight-ms", flightMoveMs + "ms");
          syncDockSpinForDescend();
          run();
        });
      });
    }

    if (holdMs > 0) {
      window.setTimeout(beginDescend, holdMs);
    } else {
      beginDescend();
    }

    if (linkedSpin && flyOpts.keepDockVisible) {
      window.requestAnimationFrame(function () {
        startDockFlySync();
      });
    }

    let done = false;
    function complete() {
      if (done) return;
      done = true;
      window.clearTimeout(morphTimer);
      const morphTailMs = flyOpts.skipMorph ? 0 : flyOpts.morphTailMs || 400;
      if (morphTailMs > 0) {
        window.setTimeout(finish, morphTailMs);
      } else {
        finish();
      }
    }

    fly.addEventListener("transitionend", function (event) {
      if (event.propertyName === "transform") complete();
    });
    const morphPad = flyOpts.skipMorph
      ? 160
      : (flyOpts.morphLeadMs || FLIGHT_MORPH_LEAD_MS) + 180;
    window.setTimeout(complete, holdMs + flightMoveMs + morphPad);
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

  const PINWHEEL_MS = 1480;
  const HERO_SPIN_MS = 1000;
  const HERO_SPIN_TURNS = 1.35;
  const FLIGHT_MS = 720;
  const FLIGHT_SPIN_TURNS = 1.35;
  const FLIGHT_EASING = "cubic-bezier(0.33, 1, 0.68, 1)";
  const FLIGHT_MORPH_LEAD_MS = 300;
  const HOME_LANDING_SPIN_TURNS = 0.4;

  function getWheelRotation(fig) {
    if (!fig) return 0;
    const matrix = new DOMMatrixReadOnly(window.getComputedStyle(fig).transform);
    const deg = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
    return Number.isFinite(deg) ? deg : 0;
  }

  function resumeWheelIdlePulse(fig) {
    if (!fig) return;
    fig.style.removeProperty("--wheel-spin-base");
    fig.style.animation = "none";
    fig.style.transform = "";
    void fig.offsetHeight;
    fig.style.animation = "";
    fig.style.animationDelay = "";
  }

  function resumeWheelIdleSpin(fig, isDock) {
    if (!fig) return;
    const workOpen = document.body.classList.contains("is-work-open");
    if (isDock && !workOpen) {
      fig.style.animation = "";
      fig.style.animationDelay = "";
      fig.style.transform = "";
      fig.style.removeProperty("--wheel-spin-base");
      return;
    }
    if (!isDock) {
      resumeWheelIdlePulse(fig);
      return;
    }

    const duration = 26;
    let deg = getWheelRotation(fig);
    if (!Number.isFinite(deg)) deg = 0;
    deg = ((deg % 360) + 360) % 360;

    fig.style.removeProperty("--wheel-spin-base");
    fig.style.animation = "none";
    void fig.offsetHeight;
    fig.style.animation = "";
    fig.style.animationDelay = (-(deg / 360) * duration) + "s";
    fig.style.transform = "";
  }

  function syncWheelIdleFromDeg(fig, isDock, deg) {
    if (!fig) return;
    fig.getAnimations().forEach(function (anim) {
      anim.cancel();
    });
    fig.style.animation = "none";
    if (typeof deg === "number" && Number.isFinite(deg)) {
      fig.style.transform = "rotate(" + deg + "deg)";
    } else {
      fig.style.transform = "";
    }
    void fig.offsetHeight;
    resumeWheelIdleSpin(fig, isDock);
  }

  function primeDockWheelHandoff(toEl, deg) {
    const dockFig = toEl && toEl.querySelector(".wheel-figure--dock");
    if (!dockFig || !Number.isFinite(deg)) return;
    dockFig.getAnimations().forEach(function (anim) {
      anim.cancel();
    });
    dockFig.style.animation = "none";
    dockFig.style.transform = "rotate(" + deg + "deg)";
  }

  function captureWheelSpinBase(fig) {
    fig.getAnimations().forEach(function (anim) {
      anim.cancel();
    });
    const deg = getWheelRotation(fig);
    fig.style.animation = "none";
    fig.style.transform = "rotate(" + deg + "deg)";
    void fig.offsetHeight;
    fig.style.setProperty("--wheel-spin-base", deg + "deg");
  }

  function startPinwheelDraw(dockOnly, durationMs) {
    const pinMs = durationMs || PINWHEEL_MS;
    document.documentElement.style.setProperty("--pinwheel-duration", pinMs + "ms");
    const mainFig = star.querySelector(".wheel-figure");
    const dockFig = getHomeDockFig();
    if (!dockOnly && mainFig) captureWheelSpinBase(mainFig);
    if (dockFig) captureWheelSpinBase(dockFig);
    if (!dockOnly) star.classList.add("is-draw");
    if (starRoll) starRoll.classList.add("is-draw");
    if (sobreRoll) sobreRoll.classList.add("is-draw");
  }

  function endPinwheelDraw() {
    const mainFig = star.querySelector(".wheel-figure");
    const dockFig = getHomeDockFig();
    if (mainFig) resumeWheelIdlePulse(mainFig);
    if (dockFig) freezeHomeDockFig(dockFig);
    star.classList.remove("is-draw");
    if (starRoll) starRoll.classList.remove("is-draw");
    if (sobreRoll) sobreRoll.classList.remove("is-draw");
  }

  function beginHeroSpinToBar(group) {
    const mainFig = star.querySelector(".wheel-figure");
    if (!mainFig) return;

    mainFig.getAnimations().forEach(function (anim) {
      anim.cancel();
    });
    star.classList.remove("is-draw");
    if (starRoll) starRoll.classList.remove("is-draw");
    if (sobreRoll) sobreRoll.classList.remove("is-draw");

    const startDeg = getWheelRotation(mainFig);
    mainFig.style.animation = "none";
    mainFig.style.animationDelay = "";

    const holdMs = HERO_SPIN_MS;
    const flightMoveMs = FLIGHT_MS;
    const spinDuration = holdMs + flightMoveMs;
    const heroSpinDeg = HERO_SPIN_TURNS * 360;
    const spinExtraDeg =
      (heroSpinDeg / holdMs) * spinDuration + HOME_LANDING_SPIN_TURNS * 360;

    document.body.classList.add("is-star-flight");

    flyStarBetween(
      star,
      starDock,
      function (finalDeg) {
        document.body.classList.remove("is-star-flight");
        spinning = false;

        const dockFig = getHomeDockFig();
        if (dockFig) {
          dockFig.classList.add("is-flight-landed");
          easeHomeDockToRest(dockFig, {
            spinDuration: spinDuration,
            spinExtraDeg: spinExtraDeg,
          }).finally(function () {
            dockFig.classList.remove("is-flight-landed");
          });
        }
        resumeWheelIdlePulse(mainFig);

        restartStarRollAnimation();
      },
      {
        deferTargetMeasure: true,
        holdMs: holdMs,
        flightMoveMs: flightMoveMs,
        spinFromDeg: startDeg,
        spinExtraDeg: spinExtraDeg,
        spinDuration: spinDuration,
        spinEasing: "linear",
        spinEasingMove: FLIGHT_EASING,
        morphLeadMs: 280,
        morphTailMs: 200,
        keepDockVisible: true,
        onBeforeDescend: function () {
          setWorkSectionOpen(true);
          syncStarRollMotion();
          scrollToWork(group.id);
        },
      }
    );
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
      scrollToWork(group.id);
      return;
    }

    spinning = true;
    beginHeroSpinToBar(group);
  }

  async function mountUmbigoWork(section, group) {
    const main = await loadUmbigoMain();
    if (!main || !section.isConnected) return;
    await hydrateCustomPagePhotos(main, WORK_ARCHIVE_DIR.umbigo);
    section.appendChild(main);
    group.files.forEach(function (entry) {
      const anchor = findWorkAnchor(section, entry.file);
      if (anchor) anchor.setAttribute("data-archive-file", entry.file);
    });
    document.dispatchEvent(new CustomEvent("umbigo-mounted"));
  }

  function fitFrangoIntroHeading(section) {
    if (!section || !section.classList.contains("work--frango")) return;
    const heading = section.querySelector(".frango-intro .frango-heading");
    if (!heading) return;
    const title = heading.querySelector(".umbigo-work__title:not([hidden])");
    const subtitle = heading.querySelector(".umbigo-work__subtitle:not([hidden])");
    const maxWidth = heading.clientWidth;
    if (maxWidth < 48) return;

    function fitLine(el, maxPx, minPx, probePx) {
      if (!el) return;
      el.style.removeProperty("font-size");
      el.style.whiteSpace = "nowrap";
      el.style.display = "inline-block";
      el.style.width = "auto";
      el.style.fontSize = probePx + "px";
      const measured = el.getBoundingClientRect().width;
      if (!measured) {
        el.style.removeProperty("display");
        el.style.removeProperty("width");
        el.style.removeProperty("white-space");
        return;
      }
      const size = Math.max(minPx, Math.min(probePx, (probePx * maxPx) / measured));
      el.style.fontSize = size + "px";
      el.style.display = "block";
      el.style.width = "100%";
      if (size <= minPx + 0.5 && measured > maxPx) {
        el.style.whiteSpace = "normal";
        el.style.textWrap = "balance";
      }
    }

    fitLine(title, maxWidth, 11, 42);
    fitLine(subtitle, maxWidth, 10, 28);
  }

  let frangoHeadingFitWired = false;
  function wireFrangoIntroHeadingFit() {
    if (frangoHeadingFitWired) return;
    frangoHeadingFitWired = true;
    const run = function () {
      const section = works.querySelector(".work.work--frango.is-active");
      if (section) fitFrangoIntroHeading(section);
    };
    window.addEventListener("resize", run);
    window.addEventListener("orientationchange", function () {
      window.setTimeout(run, 350);
    });
    document.addEventListener("avv-lang", run);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(run);
    }
  }

  async function mountFrangoWork(section, group) {
    const main = await loadFrangoMain();
    if (!main || !section.isConnected) return;
    await hydrateCustomPagePhotos(main, WORK_ARCHIVE_DIR.frango);
    section.appendChild(main);
    group.files.forEach(function (entry) {
      const anchor = findWorkAnchor(section, entry.file);
      if (anchor) anchor.setAttribute("data-archive-file", entry.file);
    });
    wireFrangoIntroHeadingFit();
    wireFrangoPolaroids();
    window.requestAnimationFrame(function () {
      initFrangoPolaroids(section, { forceLayout: true });
      fitFrangoIntroHeading(section);
    });
    section.scrollTo(0, 0);
    window.requestAnimationFrame(function () {
      if (section.isConnected) section.scrollTo(0, 0);
    });
    preloadFrangoVideo(section);
    if (section.classList.contains("is-active")) {
      startFrangoVideo(section);
    }
  }

  const frangoPolaroidSpots = new WeakMap();
  let frangoPolaroidDrag = null;

  function frangoApplyPolaroidSpotRaw(fig, spot) {
    const tilt = spot.tilt != null ? spot.tilt : 0;
    fig.style.left = spot.x + "px";
    fig.style.top = spot.y + "px";
    fig.style.transform = "rotate(" + tilt + "deg)";
  }

  function frangoReadCssVarPx(varName, contextEl) {
    const host = contextEl && contextEl.isConnected ? contextEl : document.documentElement;
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;left:0;top:0;width:0;height:var(" +
      varName +
      ");visibility:hidden;pointer-events:none;border:0;margin:0;padding:0;";
    host.appendChild(probe);
    const px = probe.getBoundingClientRect().height;
    host.removeChild(probe);
    return px || 0;
  }

  function frangoPolaroidClipRect(deck) {
    const pad = 6;
    const deckRect = deck.getBoundingClientRect();
    const style = window.getComputedStyle(deck);
    const padL = parseFloat(style.paddingLeft) || 0;
    const padR = parseFloat(style.paddingRight) || 0;
    const padT = parseFloat(style.paddingTop) || 0;
    const padB = parseFloat(style.paddingBottom) || 0;
    const stage = deck.closest(".frango-poem-stage");

    if (stage) {
      const stageRect = stage.getBoundingClientRect();
      const section = deck.closest(".work.work--frango");
      const frangoRoot = section ? section.querySelector(".frango") : null;
      const bleed = frangoRoot ? frangoReadCssVarPx("--frango-polaroid-bleed-left", frangoRoot) : 0;
      return {
        left: stageRect.left + pad - bleed,
        right: stageRect.right - pad,
        top: stageRect.top + pad,
        bottom: stageRect.bottom - pad,
        padL: padL,
        padT: padT,
        padR: padR,
        padB: padB,
        deckRect: deckRect,
      };
    }

    return {
      left: deckRect.left + padL + pad,
      right: deckRect.right - padR - pad,
      top: deckRect.top + padT + pad,
      bottom: deckRect.bottom - padB - pad,
      padL: padL,
      padT: padT,
      padR: padR,
      padB: padB,
      deckRect: deckRect,
    };
  }

  function frangoClampPolaroidSpot(fig, deck, spot) {
    const clip = frangoPolaroidClipRect(deck);
    let x = spot.x;
    let y = spot.y;
    const tilt = spot.tilt != null ? spot.tilt : 0;
    const z = spot.z;

    frangoApplyPolaroidSpotRaw(fig, { x: x, y: y, tilt: tilt });

    for (let pass = 0; pass < 12; pass += 1) {
      const figRect = fig.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      if (figRect.left < clip.left) {
        dx = clip.left - figRect.left;
      } else if (figRect.right > clip.right) {
        dx = clip.right - figRect.right;
      }
      if (figRect.top < clip.top) {
        dy = clip.top - figRect.top;
      } else if (figRect.bottom > clip.bottom) {
        dy = clip.bottom - figRect.bottom;
      }
      if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) break;
      x += dx;
      y += dy;
      frangoApplyPolaroidSpotRaw(fig, { x: x, y: y, tilt: tilt });
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
      tilt: tilt,
      z: z,
    };
  }

  function applyFrangoPolaroidSpot(fig, deck, spot) {
    if (!deck) {
      frangoApplyPolaroidSpotRaw(fig, spot);
      return spot;
    }
    const clamped = frangoClampPolaroidSpot(fig, deck, spot);
    frangoApplyPolaroidSpotRaw(fig, clamped);
    return clamped;
  }

  function syncFrangoPolaroidSpot(fig, deck, reset) {
    if (!fig || !deck) return;
    const deckRect = deck.getBoundingClientRect();
    let spot = frangoPolaroidSpots.get(fig);
    if (!spot || reset) {
      const rect = fig.getBoundingClientRect();
      if (rect.width < 2) return;
      const clip = frangoPolaroidClipRect(deck);
      const tiltRaw = fig.style.getPropertyValue("--polaroid-tilt").trim();
      const tilt = tiltRaw ? parseFloat(tiltRaw) : 0;
      spot = {
        x: rect.left - clip.deckRect.left - clip.padL,
        y: rect.top - clip.deckRect.top - clip.padT,
        tilt: tilt,
        z: parseInt(fig.style.zIndex, 10) || 1,
      };
      spot = frangoClampPolaroidSpot(fig, deck, spot);
      frangoPolaroidSpots.set(fig, spot);
      fig.style.left = spot.x + "px";
      fig.style.top = spot.y + "px";
      fig.style.right = "auto";
      fig.style.bottom = "auto";
    }
    spot = applyFrangoPolaroidSpot(fig, deck, spot);
    frangoPolaroidSpots.set(fig, spot);
    if (spot.z) fig.style.zIndex = String(spot.z);
  }

  function layoutFrangoPolaroidsDeck(deck) {
    if (!deck) return false;
    const figures = Array.from(deck.querySelectorAll(".frango-polaroid"));
    if (!figures.length) return false;
    const style = window.getComputedStyle(deck);
    const padL = parseFloat(style.paddingLeft) || 0;
    const padR = parseFloat(style.paddingRight) || 0;
    const padT = parseFloat(style.paddingTop) || 0;
    const padB = parseFloat(style.paddingBottom) || 0;
    const deckW = deck.clientWidth - padL - padR;
    const deckH = deck.clientHeight - padT - padB;
    if (deckW < 24 || deckH < 24) return false;

    const shuffled = figures.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    shuffled.forEach(function (fig, index) {
      const w = fig.offsetWidth || fig.getBoundingClientRect().width;
      const h = fig.offsetHeight || fig.getBoundingClientRect().height;
      if (w < 2) return;
      const x = Math.random() * Math.max(0, deckW - w);
      const y = Math.random() * Math.max(0, deckH - h);
      const tilt = Math.round((Math.random() * 14 - 7) * 10) / 10;
      let spot = {
        x: Math.round(x),
        y: Math.round(y),
        tilt: tilt,
        z: index + 1,
      };
      spot = applyFrangoPolaroidSpot(fig, deck, spot);
      frangoPolaroidSpots.set(fig, spot);
      fig.style.zIndex = String(spot.z);
    });
    deck.classList.add("is-ready");
    return true;
  }

  function initFrangoPolaroids(section, options) {
    if (!section) return;
    const forceLayout = Boolean(options && options.forceLayout);
    const decks = section.querySelectorAll(".frango-polaroids__deck");
    if (!decks.length) return;
    decks.forEach(function (deck) {
      const figures = deck.querySelectorAll(".frango-polaroid");
      let needsRandom = false;
      figures.forEach(function (fig) {
        if (!frangoPolaroidSpots.has(fig)) needsRandom = true;
      });
      if (forceLayout || needsRandom) {
        const laidOut = layoutFrangoPolaroidsDeck(deck);
        if (!laidOut) {
          window.requestAnimationFrame(function () {
            if (!section.isConnected) return;
            if (layoutFrangoPolaroidsDeck(deck)) return;
            window.requestAnimationFrame(function () {
              if (section.isConnected) layoutFrangoPolaroidsDeck(deck);
            });
          });
        }
        return;
      }
      figures.forEach(function (fig) {
        syncFrangoPolaroidSpot(fig, deck, false);
      });
      deck.classList.add("is-ready");
    });
  }

  function wireFrangoPolaroids() {
    if (document.documentElement.dataset.frangoPolaroidDragWired === "1") return;
    document.documentElement.dataset.frangoPolaroidDragWired = "1";

    document.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      const fig = event.target.closest(".work--frango .frango-polaroid");
      if (!fig) return;
      const section = fig.closest(".work.work--frango");
      if (!section || !section.classList.contains("is-active")) return;
      const deck = fig.closest(".frango-polaroids__deck");
      if (!deck) return;
      syncFrangoPolaroidSpot(fig, deck, false);
      const spot = frangoPolaroidSpots.get(fig);
      if (!spot) return;
      frangoPolaroidDrag = {
        fig: fig,
        deck: deck,
        section: section,
        pointerId: event.pointerId,
        pointerX: event.clientX,
        pointerY: event.clientY,
        originX: spot.x,
        originY: spot.y,
        tilt: spot.tilt,
        baseZ: fig.style.zIndex,
      };
      fig.style.zIndex = "16";
      fig.classList.add("is-dragging");
      if (fig.setPointerCapture) fig.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    function endFrangoPolaroidDrag(event) {
      if (!frangoPolaroidDrag || event.pointerId !== frangoPolaroidDrag.pointerId) return;
      const fig = frangoPolaroidDrag.fig;
      fig.style.zIndex = frangoPolaroidDrag.baseZ || "";
      fig.classList.remove("is-dragging");
      if (fig.releasePointerCapture) {
        try {
          fig.releasePointerCapture(event.pointerId);
        } catch (error) {
          /* already released */
        }
      }
      frangoPolaroidDrag = null;
    }

    document.addEventListener("pointermove", function (event) {
      if (!frangoPolaroidDrag || event.pointerId !== frangoPolaroidDrag.pointerId) return;
      const fig = frangoPolaroidDrag.fig;
      const deck = frangoPolaroidDrag.deck;
      const spot = applyFrangoPolaroidSpot(fig, deck, {
        x: frangoPolaroidDrag.originX + (event.clientX - frangoPolaroidDrag.pointerX),
        y: frangoPolaroidDrag.originY + (event.clientY - frangoPolaroidDrag.pointerY),
        tilt: frangoPolaroidDrag.tilt,
        z: parseInt(fig.style.zIndex, 10) || 1,
      });
      frangoPolaroidSpots.set(fig, spot);
    });

    document.addEventListener("pointerup", endFrangoPolaroidDrag);
    document.addEventListener("pointercancel", endFrangoPolaroidDrag);
  }

  const reinventarFloatSpots = new WeakMap();
  let reinventarFloatDrag = null;

  function reinventarArodaStage(section) {
    return section ? section.querySelector(".reinventar-aroda__stage") : null;
  }

  function refreshReinventarStageExtents(section) {
    const stage = reinventarArodaStage(section);
    if (!stage) return;
    const base = Math.max(
      window.innerHeight,
      stage.getBoundingClientRect().height
    );
    let maxBottom = base;
    stage.querySelectorAll(".reinventar-aroda__float").forEach(function (fig) {
      const spot = reinventarFloatSpots.get(fig);
      const y = spot ? spot.y : fig.offsetTop;
      maxBottom = Math.max(maxBottom, y + fig.offsetHeight);
    });
    stage.style.minHeight = Math.round(maxBottom + 72) + "px";
  }

  function syncReinventarFloatSpot(fig, stage, reset) {
    if (!fig || !stage) return;
    const stageRect = stage.getBoundingClientRect();
    let spot = reinventarFloatSpots.get(fig);
    if (!spot || reset) {
      const rect = fig.getBoundingClientRect();
      if (rect.width < 2) return;
      spot = {
        x: rect.left - stageRect.left,
        y: rect.top - stageRect.top,
      };
      reinventarFloatSpots.set(fig, spot);
    }
    fig.style.left = spot.x + "px";
    fig.style.top = spot.y + "px";
  }

  function initReinventarArodaDrag(section) {
    const stage = reinventarArodaStage(section);
    if (!stage) return;
    const floats = stage.querySelectorAll(".reinventar-aroda__float");
    floats.forEach(function (fig) {
      syncReinventarFloatSpot(fig, stage, !reinventarFloatSpots.has(fig));
    });
    refreshReinventarStageExtents(section);
  }

  function wireReinventarArodaDrag() {
    if (document.documentElement.dataset.reinventarDragWired === "1") return;
    document.documentElement.dataset.reinventarDragWired = "1";

    document.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      const fig = event.target.closest(".work--reinventar-aroda .reinventar-aroda__float");
      if (!fig) return;
      const section = fig.closest(".work.work--reinventar-aroda");
      if (!section || !section.classList.contains("is-active")) return;
      const stage = reinventarArodaStage(section);
      if (!stage) return;
      syncReinventarFloatSpot(fig, stage, false);
      const spot = reinventarFloatSpots.get(fig);
      if (!spot) return;
      reinventarFloatDrag = {
        fig: fig,
        stage: stage,
        section: section,
        pointerId: event.pointerId,
        pointerX: event.clientX,
        pointerY: event.clientY,
        originX: spot.x,
        originY: spot.y,
        baseZ: fig.style.zIndex,
      };
      fig.style.zIndex = "12";
      fig.classList.add("is-dragging");
      if (fig.setPointerCapture) fig.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    function endReinventarFloatDrag(event) {
      if (!reinventarFloatDrag || event.pointerId !== reinventarFloatDrag.pointerId) return;
      const fig = reinventarFloatDrag.fig;
      fig.style.zIndex = reinventarFloatDrag.baseZ || "";
      fig.classList.remove("is-dragging");
      if (fig.releasePointerCapture) {
        try {
          fig.releasePointerCapture(event.pointerId);
        } catch (error) {
          /* already released */
        }
      }
      reinventarFloatDrag = null;
    }

    document.addEventListener("pointermove", function (event) {
      if (!reinventarFloatDrag || event.pointerId !== reinventarFloatDrag.pointerId) return;
      const fig = reinventarFloatDrag.fig;
      const section = reinventarFloatDrag.section;
      const spot = {
        x: reinventarFloatDrag.originX + (event.clientX - reinventarFloatDrag.pointerX),
        y: reinventarFloatDrag.originY + (event.clientY - reinventarFloatDrag.pointerY),
      };
      reinventarFloatSpots.set(fig, spot);
      fig.style.left = spot.x + "px";
      fig.style.top = spot.y + "px";
      refreshReinventarStageExtents(section);
    });

    document.addEventListener("pointerup", endReinventarFloatDrag);
    document.addEventListener("pointercancel", endReinventarFloatDrag);
  }

  async function mountReinventarArodaWork(section, group) {
    const main = await loadReinventarArodaMain();
    if (!main || !section.isConnected) return;
    await hydrateCustomPagePhotos(main, "reinventar-a-roda");
    section.appendChild(main);
    group.files.forEach(function (entry) {
      const anchor = findWorkAnchor(section, entry.file);
      if (anchor) anchor.setAttribute("data-archive-file", entry.file);
    });
    wireReinventarArodaDrag();
    requestAnimationFrame(function () {
      initReinventarArodaDrag(section);
    });
    section.scrollTo(0, 0);
  }

  async function mountLevaWork(section, group) {
    const main = await loadLevaMain();
    if (!main || !section.isConnected) return;
    await hydrateCustomPagePhotos(main, "leva-me-de-volta");
    section.appendChild(main);
    const frameHost = main.querySelector("[data-leva-frame]");
    const legendHost = main.querySelector("[data-leva-legend]");
    const textEntry = levaTextEntry(group);
    if (frameHost && textEntry) {
      if (typeof window.avvMountLevaFrame === "function") {
        window.avvMountLevaFrame(frameHost, textEntry);
      } else {
        frameHost.innerHTML = "";
        frameHost.appendChild(buildWorkTextStream(textEntry));
      }
      if (legendHost) {
        mountLevaLegend(legendHost);
      }
    }
  }

  async function renderWorks(items) {
    works.innerHTML = "";
    let umbigoMount = null;
    let levaMount = null;
    let frangoMount = null;
    let reinventarArodaMount = null;
    for (let i = 0; i < items.length; i += 1) {
      const group = items[i];

      if (group.kind === "umbigo") {
        const section = document.createElement("section");
        section.className = "work work--umbigo umbigo-page";
        section.id = group.id;
        section.setAttribute("aria-hidden", "true");
        works.appendChild(section);
        umbigoMount = mountUmbigoWork(section, group);
        continue;
      }

      if (group.kind === "leva") {
        const section = document.createElement("section");
        section.className = "work work--leva leva-page work--text-stream";
        section.id = group.id;
        section.setAttribute("aria-hidden", "true");
        works.appendChild(section);
        levaMount = mountLevaWork(section, group);
        continue;
      }

      if (group.kind === "frango") {
        const section = document.createElement("section");
        section.className = "work work--frango frango-page";
        section.id = group.id;
        section.setAttribute("aria-hidden", "true");
        works.appendChild(section);
        frangoMount = mountFrangoWork(section, group);
        continue;
      }

      if (group.kind === "reinventar-aroda") {
        const section = document.createElement("section");
        section.className = "work work--reinventar-aroda reinventar-aroda-page";
        section.id = group.id;
        section.setAttribute("aria-hidden", "true");
        works.appendChild(section);
        reinventarArodaMount = mountReinventarArodaWork(section, group);
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

      const manifestEntry = group.files[0];
      layout.appendChild(frame);
      {
        const copyWrap = document.createElement("div");
        copyWrap.className = "work__copy";
        copyWrap.hidden = true;
        const titleEl = document.createElement("h2");
        titleEl.className = "work__copy-title";
        const textEl = document.createElement("div");
        textEl.className = "work__text";
        copyWrap.appendChild(titleEl);
        copyWrap.appendChild(textEl);
        layout.appendChild(copyWrap);
      }
      section.appendChild(layout);
      applyWorkCopy(section, manifestEntry);

      works.appendChild(section);
    }
    if (umbigoMount) {
      umbigoMount.catch(function (error) {
        console.error("Nao foi possivel montar umbigo", error);
      });
    }
    if (levaMount) {
      levaMount.catch(function (error) {
        console.error("Nao foi possivel montar leva-me-de-volta", error);
      });
    }
    if (frangoMount) {
      frangoMount.catch(function (error) {
        console.error("Nao foi possivel montar frango", error);
      });
    }
    if (reinventarArodaMount) {
      reinventarArodaMount.catch(function (error) {
        console.error("Nao foi possivel montar reinventar a roda", error);
      });
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

  siteHomeNodes.forEach(function (siteHome) {
    siteHome.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (document.body.classList.contains("is-work-open")) {
        scrollToTop();
        return;
      }
      if (
        document.body.classList.contains("is-sobre-open") ||
        document.body.classList.contains("is-index-open")
      ) {
        setSobreOpen(false);
        setIndexOpen(false);
      }
    });
  });

  updateWorkChrome();
  document.addEventListener("avv-lang", updateWorkChrome);
  window.addEventListener("popstate", onWorkPop);

  if (starRoll) starRoll.hidden = false;

  function syncStarRollMotion() {}

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

  async function loadManifest() {
      const response = await fetch(archiveManifestFetchUrl(manifestUrl), { cache: "no-store" });
    if (!response.ok) throw new Error("manifest");
    manifest = parseArchiveManifest(await response.json());
    groups = groupEntries(manifest);
    assignWorkPaths(groups);
  }

  function openWorkFromLocation() {
    const slug = pathSlugFromLocation();
    const group = findGroupByPath(slug);
    if (!group) return;
    scrollToWork(group.id, "", { skipUrl: true });
  }

  function onWorkPop(event) {
    const slug =
      event.state && typeof event.state.work === "string"
        ? event.state.work
        : pathSlugFromLocation();
    if (!slug) {
      if (document.body.classList.contains("is-work-open")) {
        scrollToTop({ skipUrl: true });
      }
      return;
    }
    const group = findGroupByPath(slug);
    if (!group) return;
    scrollToWork(group.id, "", { skipUrl: true });
  }

  async function init() {
    loadUmbigoMain().catch(function () {});
    loadLevaMain().catch(function () {});
    loadFrangoMain().catch(function () {});
    loadReinventarArodaMain().catch(function () {});
    try {
      await loadManifest();
    } catch (error) {
      console.error("Nao foi possivel carregar images.json", error);
      return;
    }

    await renderWorks(groups);
    scheduleIdle(prefetchArchivePanelThumbs);
    lockScrollTop();
    syncStarRollMotion();
    history.replaceState({ work: pathSlugFromLocation() }, "", location.href);
    openWorkFromLocation();
  }

  document.addEventListener("avv-archive-updated", function () {
    loadManifest()
      .then(function () {
        return renderWorks(groups);
      })
      .then(function () {
        if (document.body.classList.contains("is-index-open")) {
          scheduleArchivePanelRender();
        }
      })
      .catch(function (error) {
        console.error("Nao foi possivel atualizar images.json", error);
      });
  });

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
