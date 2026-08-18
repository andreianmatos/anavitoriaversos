(function () {
  const FULL_DIR = "imagens/";
  const THUMB_DIR = "imagens/thumbs/";

  const container = document.getElementById("arquivo");
  const modal = document.getElementById("arquivo-modal");
  if (!container || !modal) return;

  const modalImage = modal.querySelector(".arquivo-modal__image");
  const modalTitle = modal.querySelector(".arquivo-modal__title");
  const modalText = modal.querySelector(".arquivo-modal__text");
  const closeButton = modal.querySelector(".arquivo-modal__close");

  let scatterToken = 0;
  let manifest = [];

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

  function titleFromFile(file) {
    return file.replace(/\.[^.]+$/, "");
  }

  function thumbPath(file) {
    const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
    const base = file.slice(0, file.length - ext.length);
    if (ext === ".gif") {
      return THUMB_DIR + encodeURIComponent(base + ".gif");
    }
    return THUMB_DIR + encodeURIComponent(base + ".jpg");
  }

  function fullPath(file) {
    return FULL_DIR + encodeURIComponent(file);
  }

  function getLayout(count) {
    const width = window.innerWidth;
    const isMobile = width < 640;
    const isTablet = width >= 640 && width < 1024;
    const density = Math.min(1, 42 / Math.max(count, 1));

    let minRatio;
    let maxRatio;

    if (isMobile) {
      minRatio = 0.14 + 0.2 * density;
      maxRatio = 0.22 + 0.28 * density;
    } else if (isTablet) {
      minRatio = 0.1 + 0.12 * density;
      maxRatio = 0.16 + 0.2 * density;
    } else {
      minRatio = 0.08 + 0.1 * density;
      maxRatio = 0.14 + 0.18 * density;
    }

    return {
      padding: isMobile ? 12 : isTablet ? 18 : 24,
      gap: isMobile ? 10 : isTablet ? 14 : 18,
      maxAttempts: count > 60 ? 60 : 100,
      minRatio,
      maxRatio,
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

  function getRect(element, containerRect) {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      right: rect.right - containerRect.left,
      bottom: rect.bottom - containerRect.top,
    };
  }

  function getHeaderZone(containerRect, gap) {
    const header = document.querySelector(".page-header");
    if (!header) {
      return null;
    }

    const rect = header.getBoundingClientRect();
    const extra = Math.max(gap, 24);

    return {
      left: 0,
      top: 0,
      right: rect.right - containerRect.left + extra,
      bottom: rect.bottom - containerRect.top + extra,
    };
  }

  function collides(rect, zones, gap) {
    for (let i = 0; i < zones.length; i += 1) {
      if (overlaps(rect, zones[i], gap)) {
        return true;
      }
    }
    return false;
  }

  function updateContainerHeight(placed, padding) {
    if (!placed.length) return;

    let lastBottom = 0;
    for (let i = 0; i < placed.length; i += 1) {
      if (placed[i].bottom > lastBottom) {
        lastBottom = placed[i].bottom;
      }
    }

    const minHeight = lastBottom + padding + 48;
    container.style.minHeight =
      "max(100dvh, " + minHeight + "px)";
  }

  function placeButton(button, img, placed, layout) {
    if (!img.naturalWidth) {
      button.remove();
      return;
    }

    const containerWidth = container.clientWidth;
    const width = Math.round(
      randomBetween(layout.minRatio, layout.maxRatio) * containerWidth
    );
    button.style.width = width + "px";

    const containerRect = container.getBoundingClientRect();
    const headerZone = getHeaderZone(containerRect, layout.gap);
    const blocked = headerZone ? [headerZone] : [];

    const maxLeft = Math.max(layout.padding, containerWidth - width - layout.padding);
    const placedBottom = placed.length
      ? Math.max.apply(
          null,
          placed.map(function (p) {
            return p.bottom;
          })
        )
      : layout.padding;
    const maxTop = Math.max(layout.padding, placedBottom + layout.gap + 80);

    let positioned = false;
    let rect;

    for (let attempt = 0; attempt < layout.maxAttempts; attempt += 1) {
      const left = randomBetween(layout.padding, maxLeft);
      const top = randomBetween(layout.padding, maxTop);

      button.style.left = left + "px";
      button.style.top = top + "px";

      rect = getRect(button, container.getBoundingClientRect());

      if (rect.left < layout.padding || rect.right > containerWidth - layout.padding) {
        continue;
      }

      if (collides(rect, blocked.concat(placed), layout.gap)) {
        continue;
      }

      positioned = true;
      break;
    }

    if (!positioned) {
      const fallbackTop = placed.length ? placedBottom + layout.gap : layout.padding;
      let fallbackLeft =
        layout.padding + randomBetween(0, Math.max(0, maxLeft - layout.padding));

      if (headerZone && fallbackTop < headerZone.bottom) {
        fallbackLeft = Math.max(fallbackLeft, headerZone.right + layout.gap);
        if (fallbackLeft + width > containerWidth - layout.padding) {
          fallbackLeft = layout.padding;
          button.style.top = headerZone.bottom + layout.gap + "px";
        } else {
          button.style.top = fallbackTop + "px";
        }
      } else {
        button.style.top = fallbackTop + "px";
      }

      button.style.left = fallbackLeft + "px";
      rect = getRect(button, container.getBoundingClientRect());
    }

    placed.push(rect);
    button.classList.remove("is-loading");
    button.classList.add("is-placed");
    updateContainerHeight(placed, layout.padding);
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

  function scatterImages(items) {
    const token = ++scatterToken;
    container.innerHTML = "";
    container.style.minHeight = "100dvh";

    const layout = getLayout(items.length);
    const placed = [];
    const files = shuffle(items);

    files.forEach(function (entry, index) {
      const title = entry.title || titleFromFile(entry.file);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "arquivo-item is-loading";
      button.setAttribute("aria-label", "Ver " + title);

      const img = document.createElement("img");
      img.alt = "";
      img.decoding = "async";
      img.loading = index < 8 ? "eager" : "lazy";

      let triedFallback = false;
      img.src = thumbPath(entry.file);

      img.addEventListener("error", function onThumbError() {
        if (triedFallback) {
          button.remove();
          return;
        }
        triedFallback = true;
        img.src = fullPath(entry.file);
      });

      img.addEventListener("load", function onThumbLoad() {
        if (token !== scatterToken) return;
        placeButton(button, img, placed, layout);
      });

      button.addEventListener("click", function () {
        openModal(entry);
      });

      button.appendChild(img);
      container.appendChild(button);
    });
  }

  async function init() {
    try {
      const response = await fetch("images.json?v=6", { cache: "no-store" });
      if (!response.ok) throw new Error("manifest");
      manifest = await response.json();
    } catch (error) {
      console.error("Nao foi possivel carregar images.json", error);
      return;
    }

    scatterImages(manifest);
  }

  let resizeTimer = 0;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (manifest.length) {
        scatterImages(manifest);
      }
    }, 250);
  });

  init();
})();
