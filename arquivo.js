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
  let layoutSeed = 0;

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

  function renderArchiveGrid(items, reuseSeed) {
    const scatter = window.avvArchiveScatter;
    if (!scatter) return;

    const panelWidth = Math.round(
      container.clientWidth || document.documentElement.clientWidth || 0
    );
    if (panelWidth < 48) {
      window.requestAnimationFrame(function () {
        renderArchiveGrid(items, reuseSeed);
      });
      return;
    }

    const token = ++scatterToken;
    const scrollY = window.scrollY;
    container.innerHTML = "";
    container.style.minHeight = "";
    container.className = "arquivo arquivo--scatter";

    const surface = document.createElement("div");
    surface.className = "arquivo-scatter-surface";
    container.appendChild(surface);

    if (!reuseSeed || !layoutSeed) {
      layoutSeed = freshArchiveSeed();
    }

    const scatterWidth = Math.round(surface.clientWidth || panelWidth);
    const vv = window.visualViewport;
    const viewH = (vv && vv.height) || window.innerHeight;
    const topInset = container.getBoundingClientRect().top;
    const firstScreen = Math.max(viewH - Math.max(0, topInset), viewH * 0.88);
    const panelHeight = Math.max(
      firstScreen * 1.05,
      viewH * (items.length > 10 ? 1.5 : 1.28)
    );
    const files = seededShuffle(items, layoutSeed);
    const layout = scatter.getLayout(files.length, scatterWidth, panelHeight, { page: true });
    const placed = [];
    let contentBottom = layout.padding;
    let pending = files.length;

    function finishLayout() {
      if (token !== scatterToken) return;
      pending -= 1;
      if (pending > 0) return;
      const scrollH = Math.ceil(contentBottom + layout.padding);
      surface.style.minHeight = scrollH + "px";
      container.style.minHeight = "";
      window.requestAnimationFrame(function () {
        window.scrollTo(0, scrollY);
      });
    }

    files.forEach(function (entry, index) {
      const title = entry.title || titleFromFile(entry.file);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "arquivo-item is-loading";
      button.setAttribute("aria-label", "Ver " + title);

      const frame = document.createElement("span");
      frame.className = "arquivo-item__frame";

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
          finishLayout();
          return;
        }
        img.src = sources[sourceIndex];
      });

      function mountPlacedItem() {
        if (token !== scatterToken || button.isConnected) return;
        const bottom = scatter.placeItem(button, img, placed, layout, index, layoutSeed);
        if (bottom === null) {
          finishLayout();
          return;
        }
        surface.appendChild(button);
        contentBottom = Math.max(contentBottom, bottom);
        finishLayout();
      }

      img.addEventListener("load", mountPlacedItem);
      if (img.complete && img.naturalWidth) {
        mountPlacedItem();
      }

      button.addEventListener("click", function () {
        if (entry.href) {
          window.location.href = entry.href;
          return;
        }
        openModal(entry);
      });

      frame.appendChild(img);
      button.appendChild(frame);
    });

    if (!files.length) {
      container.style.minHeight = "";
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
    if (width === lastLayoutWidth && Math.abs(height - lastLayoutHeight) < 80) {
      return;
    }
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
        renderArchiveGrid(manifest, true);
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
