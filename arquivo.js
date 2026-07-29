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

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  function placeImages() {
    container.innerHTML = "";

    const isMobile = window.innerWidth < 640;
    const isTablet = window.innerWidth < 1024;
    const maxImages = isMobile ? 8 : isTablet ? 12 : 16;
    const images = shuffle(IMAGES).slice(0, maxImages);

    const sizeMin = isMobile ? 28 : isTablet ? 22 : 18;
    const sizeMax = isMobile ? 42 : isTablet ? 32 : 28;
    const topMin = 4;
    const topMax = 72;

    images.forEach((file) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "arquivo-item";
      button.setAttribute("aria-label", "Ver " + formatTitle(file));

      const img = document.createElement("img");
      img.src = "imagens/" + encodeURIComponent(file);
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";

      const width = randomBetween(sizeMin, sizeMax);
      const left = randomBetween(2, Math.max(2, 98 - width));
      const top = randomBetween(topMin, topMax);
      const rotate = reducedMotion ? 0 : randomBetween(-10, 10);

      button.style.width = "clamp(5rem, " + width + "vw, 18rem)";
      button.style.top = top + "%";
      button.style.left = left + "%";
      button.style.transform = "rotate(" + rotate + "deg)";
      button.style.zIndex = String(Math.floor(randomBetween(1, 5)));

      button.addEventListener("click", function () {
        openModal(file);
      });

      img.addEventListener("error", function () {
        button.remove();
      });

      button.appendChild(img);
      container.appendChild(button);
    });
  }

  placeImages();

  let resizeTimer;
  window.addEventListener("resize", function () {
    if (modal.open) return;

    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(placeImages, 250);
  });
})();
