(function () {
  const imageDir = (document.body.getAttribute("data-image-dir") || "imagens/arquivo/").replace(
    /\/?$/,
    "/"
  );
  const thumbDir = (document.body.getAttribute("data-thumb-dir") || "imagens/arquivo/thumbs/").replace(
    /\/?$/,
    "/"
  );
  const manifestUrl = document.body.getAttribute("data-manifest") || "images.json?v=10";

  const container = document.getElementById("arquivo");
  const modal = document.getElementById("arquivo-modal");
  if (!container || !modal) return;

  const modalImage = modal.querySelector(".arquivo-modal__image");
  const modalTitle = modal.querySelector(".arquivo-modal__title");
  const modalText = modal.querySelector(".arquivo-modal__text");
  const closeButton = modal.querySelector(".arquivo-modal__close");

  let scatterToken = 0;
  let manifest = [];

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

  function fullPath(file) {
    return imageDir + encodePath(file);
  }

  function archivePageColumnCount() {
    const width = (window.visualViewport && window.visualViewport.width) || window.innerWidth;
    return width < 560 ? 2 : 3;
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

  function setModalText(entry) {
    modalTitle.textContent = entry.title || titleFromFile(entry.file);

    const paragraphs = Array.isArray(entry.text) ? entry.text : [];
    modalText.querySelectorAll("p").forEach(function (node) {
      node.remove();
    });

    paragraphs.forEach(function (text) {
      const p = document.createElement("p");
      p.textContent = text;
      modalText.appendChild(p);
    });
  }

  function openModal(entry) {
    const title = entry.title || titleFromFile(entry.file);
    modalImage.classList.add("is-loading");
    modalImage.alt = title;
    modalImage.src = fullPath(entry.file);
    setModalText(entry);
    modal.showModal();
  }

  function closeModal() {
    if (modal.open) {
      modal.close();
    }
    modalImage.removeAttribute("src");
    modalImage.classList.remove("is-loading");
  }

  closeButton.addEventListener("click", closeModal);

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });

  modal.addEventListener("cancel", function (event) {
    event.preventDefault();
    closeModal();
  });

  modalImage.addEventListener("load", function () {
    modalImage.classList.remove("is-loading");
  });

  modalImage.addEventListener("error", function () {
    modalImage.classList.remove("is-loading");
  });

  function renderArchiveGrid(items) {
    const token = ++scatterToken;
    container.innerHTML = "";
    container.style.minHeight = "100dvh";
    const layoutSeed = freshArchiveSeed();
    const columnCount = archivePageColumnCount();
    container.className = "arquivo arquivo--cols-" + columnCount;
    const cols = createArchiveColumns(container, columnCount, layoutSeed, false);

    const files = seededShuffle(items, layoutSeed);

    files.forEach(function (entry, index) {
      const title = entry.title || titleFromFile(entry.file);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "arquivo-item is-loading";
      button.setAttribute("aria-label", "Ver " + title);
      applyArchiveColumnItem(button, index, layoutSeed, false);

      const img = document.createElement("img");
      img.alt = "";
      img.decoding = "async";
      img.loading = "eager";
      if ("fetchPriority" in img && index < 12) {
        img.fetchPriority = "high";
      }

      const sources = thumbCandidates(entry.file).concat(fullPath(entry.file));
      let sourceIndex = 0;
      img.src = sources[0];

      img.addEventListener("error", function onThumbError() {
        sourceIndex += 1;
        if (sourceIndex >= sources.length) {
          button.remove();
          return;
        }
        img.src = sources[sourceIndex];
      });

      img.addEventListener("load", function onThumbLoad() {
        if (token !== scatterToken) return;
        button.classList.remove("is-loading");
        button.classList.add("is-placed");
      });

      button.addEventListener("click", function () {
        if (entry.href) {
          window.location.href = entry.href;
          return;
        }
        openModal(entry);
      });

      button.appendChild(img);
      cols[index % columnCount].appendChild(button);
    });
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

    renderArchiveGrid(manifest);
  }

  function layoutWidth() {
    return Math.round(window.innerWidth);
  }

  function isPhone() {
    return (
      window.matchMedia("(max-width: 767px)").matches ||
      window.matchMedia("(hover: none) and (pointer: coarse)").matches
    );
  }

  let lastLayoutWidth = layoutWidth();
  let lastLayoutHeight = Math.round(
    (window.visualViewport && window.visualViewport.height) || window.innerHeight
  );
  let resizeTimer = 0;

  function onArchiveLayoutChange() {
    const width = layoutWidth();
    const height = Math.round(
      (window.visualViewport && window.visualViewport.height) || window.innerHeight
    );
    if (isPhone() && Math.abs(width - lastLayoutWidth) < 80) {
      return;
    }
    if (
      !isPhone() &&
      width === lastLayoutWidth &&
      Math.abs(height - lastLayoutHeight) < 32
    ) {
      return;
    }
    lastLayoutWidth = width;
    lastLayoutHeight = height;

    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (manifest.length) {
        renderArchiveGrid(manifest);
      }
    }, 280);
  }

  window.addEventListener("resize", onArchiveLayoutChange);
  document.addEventListener("avv-ui-scale", onArchiveLayoutChange);
  window.addEventListener("orientationchange", function () {
    lastLayoutWidth = 0;
    lastLayoutHeight = 0;
    onArchiveLayoutChange();
  });
  if (window.visualViewport && !isPhone()) {
    window.visualViewport.addEventListener("resize", onArchiveLayoutChange);
  }

  init();
})();
