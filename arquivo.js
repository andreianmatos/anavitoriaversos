(function () {
  const IMAGES = [
    "caixa poster encontro mundo.jpg",
    "caixa poster primeiro tudo.jpg",
    "caixa poster quantos foram.jpg",
    "EPSON014.JPG",
    "in utero 3D.png",
    "nao sou ninguem.png",
    "panfleto folha de sala frente.png",
    "panfleto folha de sala verso.jpg",
    "poster talvez final.png",
    "primeira queda.png",
    "PTDC0010.JPG",
    "Untitled - Made with FlexClip.gif",
  ];

  const container = document.getElementById("arquivo");
  const modal = document.getElementById("arquivo-modal");
  if (!container || !modal) return;

  const modalImage = modal.querySelector(".arquivo-modal__image");
  const modalTitle = modal.querySelector(".arquivo-modal__title");
  const closeButton = modal.querySelector(".arquivo-modal__close");

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

  function formatTitle(file) {
    return file.replace(/\.[^.]+$/, "");
  }

  function openModal(file) {
    const src = "imagens/" + encodeURIComponent(file);
    modalImage.src = src;
    modalImage.alt = formatTitle(file);
    modalTitle.textContent = formatTitle(file);
    modal.showModal();
  }

  function closeModal() {
    if (modal.open) {
      modal.close();
    }
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

  function waitForImage(img) {
    return new Promise(function (resolve) {
      if (img.complete) {
        resolve();
        return;
      }
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
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

  async function scatterImages() {
    container.innerHTML = "";
    container.style.minHeight = "calc(100dvh - var(--bottom-bar-offset))";

    const isMobile = window.innerWidth < 640;
    const padding = isMobile ? 16 : 24;
    const gap = isMobile ? 14 : 20;
    const maxAttempts = 100;
    const placed = [];
    const files = shuffle(IMAGES);

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "arquivo-item";
      button.setAttribute("aria-label", "Ver " + formatTitle(file));

      const img = document.createElement("img");
      img.src = "imagens/" + encodeURIComponent(file);
      img.alt = "";
      img.loading = i < 4 ? "eager" : "lazy";
      img.decoding = "async";

      button.appendChild(img);
      container.appendChild(button);

      button.addEventListener("click", function () {
        openModal(file);
      });

      await waitForImage(img);

      if (!img.naturalWidth) {
        button.remove();
        continue;
      }

      const containerWidth = container.clientWidth;
      const width = Math.round(
        randomBetween(isMobile ? 0.3 : 0.16, isMobile ? 0.52 : 0.34) * containerWidth
      );
      button.style.width = width + "px";

      const buttonHeight = button.offsetHeight;
      const maxLeft = containerWidth - width - padding;
      const maxTop = Math.max(
        padding,
        (placed.length ? Math.max(...placed.map(function (p) { return p.bottom; })) + gap : padding) + 120
      );

      let positioned = false;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const left = randomBetween(padding, Math.max(padding, maxLeft));
        const top = randomBetween(padding, maxTop);

        button.style.left = left + "px";
        button.style.top = top + "px";

        const containerRect = container.getBoundingClientRect();
        const rect = getRect(button, containerRect);

        if (rect.left < padding || rect.right > containerWidth - padding) {
          continue;
        }

        const hasCollision = placed.some(function (existing) {
          return overlaps(rect, existing, gap);
        });

        if (!hasCollision) {
          placed.push(rect);
          positioned = true;
          break;
        }
      }

      if (!positioned) {
        const fallbackTop = placed.length
          ? Math.max(...placed.map(function (p) { return p.bottom; })) + gap
          : padding;
        button.style.left = padding + randomBetween(0, Math.max(0, maxLeft - padding)) + "px";
        button.style.top = fallbackTop + "px";

        const containerRect = container.getBoundingClientRect();
        placed.push(getRect(button, containerRect));
      }

      const lastBottom = Math.max(...placed.map(function (p) { return p.bottom; }));
      const minHeight = lastBottom + padding + 48;
      container.style.minHeight = "max(calc(100dvh - var(--bottom-bar-offset)), " + minHeight + "px)";
    }
  }

  scatterImages();

  let resizeTimer;
  window.addEventListener("resize", function () {
    if (modal.open) return;

    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scatterImages, 300);
  });
})();
