(function () {
  var config = window.AVV_ADMIN_CONFIG || {};
  var repo = config.repo || "andreianmatos/anavitoriaversos";
  var branch = config.branch || "main";
  var manifestPath = config.manifestPath || "images.json";
  var archivePath = (config.archivePath || "imagens/arquivo").replace(/\/$/, "");
  var parts = repo.split("/");
  var owner = parts[0];
  var repoName = parts[1];
  var TOKEN_KEY = "avv-github-token";
  var memoryToken = "";
  var sessionStorageOk = null;

  function canUseSessionStorage() {
    if (sessionStorageOk !== null) return sessionStorageOk;
    try {
      sessionStorage.setItem(TOKEN_KEY + "-probe", "1");
      sessionStorage.removeItem(TOKEN_KEY + "-probe");
      sessionStorageOk = true;
    } catch (e) {
      sessionStorageOk = false;
    }
    return sessionStorageOk;
  }

  var fileInput;
  var tipoFieldset;
  var paginaInput;
  var paginaWrap;
  var obraFieldsEl;
  var titleInput;
  var textInput;
  var saveBtn;
  var loginBtn;
  var logoutBtn;
  var statusEl;
  var uploadCard;
  var setupEl;
  var dropZone;
  var fileNameEl;
  var removeSection;
  var removeList;
  var EMPTY_CLASS = "admin-remove__empty";
  var removeListGen = 0;
  var PAGE_PHOTO_PREFIX = "consequencias/";

  function getCustomPages() {
    var pages = config.customPages;
    return Array.isArray(pages) ? pages : [];
  }

  function findCustomPage(id) {
    if (!id) return null;
    for (var i = 0; i < getCustomPages().length; i += 1) {
      if (getCustomPages()[i].id === id) return getCustomPages()[i];
    }
    return null;
  }

  function pageManifestPath(page) {
    return archivePath + "/" + page.baseDir + "/images.json";
  }

  function pagePhotoArchiveFile(page, filename) {
    return page.baseDir + "/" + PAGE_PHOTO_PREFIX + filename;
  }

  function parseManifestItems(text) {
    var data = JSON.parse(text || "[]");
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  function manifestWrapsItems(text) {
    try {
      var data = JSON.parse(text || "null");
      return Boolean(data && !Array.isArray(data) && Array.isArray(data.items));
    } catch (e) {
      return true;
    }
  }

  function stringifyManifestItems(items, wrapItems) {
    if (wrapItems) {
      return JSON.stringify({ items: items }, null, 2) + "\n";
    }
    return JSON.stringify(items, null, 2) + "\n";
  }

  function isPagePhotoManifestEntry(entry) {
    var file = entry && entry.file ? String(entry.file) : "";
    return file.indexOf(PAGE_PHOTO_PREFIX) === 0;
  }

  function publishMode() {
    if (!tipoFieldset) return "arquivo";
    var checked = tipoFieldset.querySelector('input[name="admin-tipo"]:checked');
    return checked && checked.value === "pagina" ? "pagina" : "arquivo";
  }

  function selectedCustomPage() {
    if (publishMode() !== "pagina") return null;
    return findCustomPage(paginaInput && paginaInput.value);
  }

  function syncPublishModeUi() {
    var isArquivo = publishMode() === "arquivo";
    if (paginaWrap) paginaWrap.hidden = isArquivo;
    if (paginaInput) paginaInput.disabled = isArquivo;
    if (titleInput) titleInput.disabled = false;
    if (textInput) textInput.disabled = !isArquivo;
    var textLabel = textInput && textInput.closest(".admin-label");
    if (textLabel) textLabel.hidden = !isArquivo;
  }

  function populatePageSelect() {
    if (!paginaInput) return;
    var pages = getCustomPages();
    for (var i = 0; i < pages.length; i += 1) {
      var option = document.createElement("option");
      option.value = pages[i].id;
      option.textContent = pages[i].label;
      paginaInput.appendChild(option);
    }
    syncPublishModeUi();
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("is-error", Boolean(isError));
  }

  function getToken() {
    if (memoryToken) return memoryToken;
    if (!canUseSessionStorage()) return "";
    try {
      var stored = sessionStorage.getItem(TOKEN_KEY) || "";
      if (stored) memoryToken = stored;
      return stored;
    } catch (e) {
      return memoryToken || "";
    }
  }

  function setToken(token) {
    memoryToken = String(token || "").trim();
    if (canUseSessionStorage()) {
      try {
        if (memoryToken) sessionStorage.setItem(TOKEN_KEY, memoryToken);
        else sessionStorage.removeItem(TOKEN_KEY);
      } catch (e) {}
    }
    syncAuthUi();
  }

  function formatGitHubError(error) {
    if (!error) return "Erro desconhecido.";
    if (error.message === "no_token") {
      return "Inicia sessão com GitHub.";
    }
    if (error.message === "no_write") {
      return (
        "Esta conta GitHub não pode escrever no repositório. " +
        "Precisas de ser Collaborator com Write em " +
        repo +
        "."
      );
    }
    if (error.message === "github_bad_response") {
      if (error.status === 403) {
        return (
          "Sem permissão no GitHub (403). Termina sessão, faz login outra vez, e confirma SCOPES=repo no Render. " +
          "Se usas preview do IDE, abre o admin no Chrome em github.io."
        );
      }
      return (
        "Resposta inválida do GitHub. Ativa o proxy no Render (admin/render-gh-proxy.cjs) ou abre o site em Chrome/Firefox normal."
      );
    }
    if (error.message === "github_proxy_missing") {
      return (
        "Falta o proxy GitHub no Render. Copia admin/render-gh-proxy.cjs para o serviço OAuth e faz redeploy."
      );
    }
    if (error.status === 401) {
      return "Sessão expirada — faz login GitHub outra vez.";
    }
    if (error.status === 403) {
      return (
        "Sem permissão no repositório (403). Faz login com a conta que tem Write em " +
        repo +
        "."
      );
    }
    if (error.status === 502) {
      return (
        "O proxy no Render falhou (502). Faz push do render-gh-proxy.cjs atualizado e redeploy. " +
        "Abre o admin em Chrome em github.io, não no preview do IDE."
      );
    }
    if (error.payload && error.payload.message) {
      if (error.payload.message === "GitHub proxy error") {
        return "Proxy GitHub no Render: " + (error.payload.detail || "erro de rede") + ". Vê Logs no Render.";
      }
      return String(error.payload.message);
    }
    return "Não foi possível contactar o GitHub. Tenta outra vez.";
  }

  function parseGithubResponse(response) {
    return response.text().then(function (text) {
      var data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          var bad = new Error("github_bad_response");
          bad.status = response.status;
          if (response.status === 404) {
            bad.message = "github_error";
            bad.payload = { message: "Not Found" };
            throw bad;
          }
          throw bad;
        }
      }
      if (!response.ok) {
        var err = new Error((data && data.message) || "github_error");
        err.status = response.status;
        err.payload = data;
        throw err;
      }
      return data;
    });
  }

  function verifyGitHubAccess() {
    return githubApi("/repos/" + owner + "/" + repoName, { method: "GET" }).then(function (repo) {
      var perms = (repo && repo.permissions) || {};
      if (!perms.push && !perms.admin && !perms.maintain) {
        var err = new Error("no_write");
        err.status = 403;
        throw err;
      }
    });
  }

  function oauthConfigured() {
    return Boolean(config.githubClientId && config.oauthBaseUrl);
  }

  function refreshAuthStatusMessage() {
    if (getToken()) {
      setStatus("Sessão GitHub ativa — podes publicar ou remover obras.");
      return;
    }
    if (oauthConfigured()) {
      setStatus("Inicia sessão com GitHub para adicionar ou remover obras.");
      return;
    }
    setStatus("Upload online ainda não configurado — ver SETUP.md no repo.", false);
  }

  function syncAuthUi() {
    var token = getToken();
    var canGitHub = oauthConfigured();
    var loggedIn = Boolean(token);
    document.body.classList.toggle("is-logged-in", loggedIn);
    if (loginBtn) loginBtn.hidden = !canGitHub || loggedIn;
    if (logoutBtn) logoutBtn.hidden = !loggedIn;
    if (saveBtn) saveBtn.disabled = !loggedIn;
    if (setupEl) setupEl.hidden = canGitHub;
  }

  function utf8ToBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  function base64ToUtf8(b64) {
    var binary = atob(String(b64).replace(/\n/g, ""));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        var comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error("read_failed"));
      };
      reader.readAsDataURL(file);
    });
  }

  var THUMB_MAX_WIDTH = 560;
  var THUMB_JPEG_QUALITY = 0.82;

  function archiveThumbRepoPath(archiveFile) {
    var rel = String(archiveFile || "").replace(/\\/g, "/");
    var slash = rel.lastIndexOf("/");
    var baseName = slash === -1 ? rel : rel.slice(slash + 1);
    var dirPart = slash === -1 ? "" : rel.slice(0, slash + 1);
    var dot = baseName.lastIndexOf(".");
    var ext = dot === -1 ? "" : baseName.slice(dot + 1).toLowerCase();
    var baseNoExt = dot === -1 ? baseName : baseName.slice(0, dot);
    var thumbDir = archivePath + "/" + (dirPart ? dirPart + "thumbs/" : "thumbs/");
    if (ext === "gif") {
      return thumbDir + baseNoExt + ".gif";
    }
    if (ext === "png") {
      return thumbDir + baseNoExt + ".png";
    }
    return thumbDir + baseNoExt + ".jpg";
  }

  function createRasterThumbBase64(file, mime) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth || 1;
        var h = img.naturalHeight || 1;
        if (w > THUMB_MAX_WIDTH) {
          h = Math.max(1, Math.round(h * (THUMB_MAX_WIDTH / w)));
          w = THUMB_MAX_WIDTH;
        }
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("thumb_canvas"));
          return;
        }
        if (mime !== "image/png") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        var dataUrl =
          mime === "image/jpeg"
            ? canvas.toDataURL(mime, THUMB_JPEG_QUALITY)
            : canvas.toDataURL(mime);
        var comma = dataUrl.indexOf(",");
        resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("thumb_decode"));
      };
      img.src = url;
    });
  }

  async function uploadArchiveThumb(file, archiveFile, imageBase64) {
    var thumbPath = archiveThumbRepoPath(archiveFile);
    var ext = String(file.name || "")
      .split(".")
      .pop()
      .toLowerCase();
    var thumbBase64;
    if (ext === "gif") {
      thumbBase64 = imageBase64;
    } else if (ext === "png") {
      thumbBase64 = await createRasterThumbBase64(file, "image/png");
    } else {
      thumbBase64 = await createRasterThumbBase64(file, "image/jpeg");
    }
    await putFile(thumbPath, thumbBase64, null, "Add archive thumbnail " + thumbPath.split("/").pop());
  }

  function archiveThumbRepoCandidates(archiveFile) {
    var rel = String(archiveFile || "").replace(/\\/g, "/");
    var slash = rel.lastIndexOf("/");
    var name = slash === -1 ? rel : rel.slice(slash + 1);
    var dirPart = slash === -1 ? "" : rel.slice(0, slash + 1);
    var dot = name.lastIndexOf(".");
    var ext = dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
    var base = dot === -1 ? name : name.slice(0, dot);
    var seen = {};
    var paths = [];
    function add(path) {
      if (!path || seen[path]) return;
      seen[path] = true;
      paths.push(path);
    }
    add(archiveThumbRepoPath(archiveFile));
    if (dirPart) {
      var rootThumbs = archivePath + "/thumbs/";
      if (ext === "gif") {
        add(rootThumbs + dirPart + base + ".gif");
      } else if (ext === "png") {
        add(rootThumbs + dirPart + base + ".png");
      } else {
        if (ext !== "jpg" && ext !== "jpeg") {
          add(rootThumbs + dirPart + name + ".jpg");
        }
        add(rootThumbs + dirPart + base + ".jpg");
      }
    }
    return paths;
  }

  async function deleteArchiveThumbsIfExist(archiveFile) {
    var paths = archiveThumbRepoCandidates(archiveFile);
    for (var i = 0; i < paths.length; i += 1) {
      try {
        var thumbFile = await getFile(paths[i]);
        await deleteFile(paths[i], thumbFile.sha, "Remove archive thumbnail");
      } catch (error) {
        if (error.status !== 404) throw error;
      }
    }
  }

  function safeBaseName(name) {
    return String(name || "obra.png")
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      .replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+/gi, "-");
  }

  function titleFromFilename(filename) {
    var stem = filename.replace(/\.[^.]+$/, "");
    return stem.replace(/\s+/g, " ").trim().toUpperCase();
  }

  function parseTextParagraphs(raw) {
    if (!raw || !String(raw).trim()) return [];
    return String(raw)
      .split(/\n\s*\n/)
      .map(function (block) {
        return block.replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);
  }

  function uniqueFilename(name, existing) {
    if (existing.indexOf(name) === -1) return name;
    var ext = "";
    var stem = name;
    var dot = name.lastIndexOf(".");
    if (dot > 0) {
      ext = name.slice(dot);
      stem = name.slice(0, dot);
    }
    var n = 1;
    var candidate = stem + "(" + n + ")" + ext;
    while (existing.indexOf(candidate) !== -1) {
      n += 1;
      candidate = stem + "(" + n + ")" + ext;
    }
    return candidate;
  }

  function encodeRepoPath(path) {
    return String(path)
      .split("/")
      .map(function (segment) {
        return encodeURIComponent(segment);
      })
      .join("/");
  }

  function githubApiBaseUrl() {
    if (config.useGithubProxy && config.oauthBaseUrl) {
      return String(config.oauthBaseUrl).replace(/\/$/, "") + "/gh";
    }
    return "https://api.github.com";
  }

  function githubApi(path, options) {
    var token = getToken();
    if (!token) return Promise.reject(new Error("no_token"));
    var headers = Object.assign(
      {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      options.headers || {}
    );
    var url = githubApiBaseUrl() + path;
    return fetch(url, Object.assign({}, options, { headers })).then(parseGithubResponse);
  }

  function getFile(path) {
    return githubApi(
      "/repos/" + owner + "/" + repoName + "/contents/" + encodeRepoPath(path),
      { method: "GET" }
    ).then(function (data) {
      var text = data.content ? base64ToUtf8(data.content) : "";
      return { sha: data.sha, text: text };
    });
  }

  function deleteFile(path, sha, message) {
    return githubApi(
      "/repos/" + owner + "/" + repoName + "/contents/" + encodeRepoPath(path),
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message || "Remove " + path,
          sha: sha,
          branch: branch,
        }),
      }
    );
  }

  function putFile(path, base64Content, sha, message) {
    var body = {
      message: message || "Update " + path,
      content: base64Content,
      branch: branch,
    };
    if (sha) body.sha = sha;
    return githubApi(
      "/repos/" + owner + "/" + repoName + "/contents/" + encodeRepoPath(path),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  }

  function oauthPopupOrigin() {
    try {
      return new URL(String(config.oauthBaseUrl).replace(/\/$/, "") + "/").origin;
    } catch (e) {
      return "";
    }
  }

  function loginWithGitHub() {
    if (!oauthConfigured()) return;
    var base = String(config.oauthBaseUrl).replace(/\/$/, "");
    var authUrl = base + "/auth";
    var oauthOrigin = oauthPopupOrigin();
    var popup = null;
    var loginDone = false;
    var pollTimer = 0;

    function finishLogin() {
      loginDone = true;
      window.clearInterval(pollTimer);
      window.removeEventListener("message", onMessage);
    }

    function replyConfigure(event) {
      var configure =
        "authorization:github:configure:" +
        JSON.stringify({
          client_id: config.githubClientId,
          scope: "repo",
        });
      var target = event && event.source;
      if (target && typeof target.postMessage === "function") {
        target.postMessage(configure, "*");
      }
      if (popup && !popup.closed && typeof popup.postMessage === "function") {
        popup.postMessage(configure, "*");
      }
    }

    function onMessage(event) {
      if (!event.data || typeof event.data !== "string") return;

      if (event.data === "authorizing:github") {
        if (oauthOrigin && event.origin !== oauthOrigin) return;
        replyConfigure(event);
        return;
      }

      if (oauthOrigin && event.origin !== oauthOrigin) return;

      if (event.data.indexOf("authorization:github:success:") === 0) {
        finishLogin();
        try {
          var payload = JSON.parse(event.data.slice("authorization:github:success:".length));
          if (payload && payload.token) {
            setToken(payload.token);
            verifyGitHubAccess()
              .then(function () {
                refreshAuthStatusMessage();
                loadRemoveList();
              })
              .catch(function (accessError) {
                setToken("");
                setStatus(formatGitHubError(accessError), true);
              });
            if (popup && !popup.closed) popup.close();
            window.focus();
            return;
          }
        } catch (e) {
          setStatus("Login falhou (resposta inválida).", true);
        }
        if (popup && !popup.closed) popup.close();
        return;
      }

      if (event.data.indexOf("authorization:github:error:") === 0) {
        finishLogin();
        setStatus(
          "Login falhou no servidor OAuth. Verifica REDIRECT_URL e OAUTH_CLIENT_SECRET no Render.",
          true
        );
        if (popup && !popup.closed) popup.close();
      }
    }

    window.addEventListener("message", onMessage);
    setStatus("A abrir GitHub… Completa o login na janela pequena; esta página atualiza sozinha.");

    popup = window.open(
      authUrl,
      "avv-github-auth",
      "popup=yes,width=520,height=720,noopener=no,noreferrer=no"
    );

    if (!popup) {
      finishLogin();
      setStatus(
        "O browser bloqueou a janela de login. Permite pop-ups para este site e tenta outra vez.",
        true
      );
      return;
    }

    pollTimer = window.setInterval(function () {
      if (loginDone || !popup.closed) return;
      finishLogin();
      if (!getToken()) {
        setStatus(
          "Login não concluído. Não feches a janela em branco cedo — espera 5 s. Se persistir, confirma ORIGINS=andreianmatos.github.io no Render.",
          true
        );
      }
    }, 500);

    window.setTimeout(function () {
      if (!loginDone && !getToken() && popup && !popup.closed) {
        setStatus(
          "Janela OAuth aberta — página em branco é normal. Não feches; este separador deve atualizar sozinho."
        );
      }
    }, 2500);
  }

  async function uploadViaGitHub(file, title, textParagraphs) {
    var manifestFile = await getFile(manifestPath);
    var manifest = JSON.parse(manifestFile.text);
    if (!manifest.items || !Array.isArray(manifest.items)) manifest.items = [];

    var existingNames = manifest.items.map(function (item) {
      return item.file;
    });
    var filename = uniqueFilename(safeBaseName(file.name), existingNames);
    var imagePath = archivePath + "/" + filename;
    var imageBase64 = await readFileAsBase64(file);

    await putFile(imagePath, imageBase64, null, "Add archive image " + filename);

    try {
      await uploadArchiveThumb(file, filename, imageBase64);
    } catch (thumbError) {
      console.warn("Thumbnail upload failed:", thumbError);
    }

    var entryTitle =
      title && title.trim() ? title.trim().toUpperCase() : titleFromFilename(filename);
    var text = Array.isArray(textParagraphs) ? textParagraphs : [];
    var entry = { file: filename, title: entryTitle };
    if (text.length) entry.text = text;
    manifest.items.push(entry);

    var manifestText = JSON.stringify(manifest, null, 2) + "\n";
    await putFile(
      manifestPath,
      utf8ToBase64(manifestText),
      manifestFile.sha,
      "Update images.json"
    );

    return { filename: filename, entry: entry };
  }

  async function uploadObraArchiveViaGitHub(file, page, title) {
    var manifestFile = await getFile(manifestPath);
    var manifest = JSON.parse(manifestFile.text);
    if (!manifest.items || !Array.isArray(manifest.items)) manifest.items = [];

    var prefix = page.baseDir + "/";
    var existingNames = manifest.items
      .filter(function (item) {
        return item && item.file && String(item.file).indexOf(prefix) === 0;
      })
      .map(function (item) {
        return String(item.file).slice(prefix.length);
      });
    var filename = uniqueFilename(safeBaseName(file.name), existingNames);
    var archiveFile = prefix + filename;
    var imagePath = archivePath + "/" + archiveFile;
    var imageBase64 = await readFileAsBase64(file);

    await putFile(imagePath, imageBase64, null, "Add archive image " + archiveFile);

    try {
      await uploadArchiveThumb(file, archiveFile, imageBase64);
    } catch (thumbError) {
      console.warn("Thumbnail upload failed:", thumbError);
    }

    var entryTitle =
      title && title.trim() ? title.trim().toUpperCase() : titleFromFilename(filename);
    var entry = { file: archiveFile, title: entryTitle };
    if (page.href) entry.href = page.href;
    manifest.items.push(entry);

    var manifestText = JSON.stringify(manifest, null, 2) + "\n";
    await putFile(
      manifestPath,
      utf8ToBase64(manifestText),
      manifestFile.sha,
      "Update images.json"
    );

    return { filename: archiveFile, entry: entry, page: page };
  }

  async function onSave() {
    var file = fileInput.files && fileInput.files[0];
    if (!file) {
      setStatus("Escolhe uma imagem.", true);
      return;
    }

    var page = selectedCustomPage();
    var title = titleInput.value.trim();
    var textParagraphs = parseTextParagraphs(textInput && textInput.value);
    if (publishMode() === "pagina" && !page) {
      setStatus("Escolhe a página.", true);
      return;
    }
    saveBtn.disabled = true;
    setStatus("A enviar…");

    try {
      if (!getToken()) {
        setStatus("Inicia sessão com GitHub primeiro.", true);
        return;
      }
      var result;
      if (page) {
        result = await uploadObraArchiveViaGitHub(file, page, title);
        setStatus(
          "Nova peça no arquivo (" +
            page.label +
            "): " +
            result.filename +
            ". Aparece na roda com as outras; o HTML da página não é alterado."
        );
        loadRemoveList();
      } else {
        result = await uploadViaGitHub(file, title, textParagraphs);
        setStatus(
          "Publicado: " +
            result.filename +
            " (com miniatura). O arquivo no site atualiza em 1–2 min."
        );
      }
      fileInput.value = "";
      titleInput.value = "";
      if (textInput) textInput.value = "";
      if (fileNameEl) fileNameEl.textContent = "";
      loadRemoveList();
    } catch (error) {
      console.error(error);
      if (error.status === 401 || error.status === 403 || error.message === "no_write") {
        setToken("");
      }
      setStatus(formatGitHubError(error), true);
    } finally {
      saveBtn.disabled = false;
      syncAuthUi();
    }
  }

  function onFileChosen() {
    var file = fileInput.files && fileInput.files[0];
    if (fileNameEl) fileNameEl.textContent = file ? file.name : "";
    if (file && titleInput && publishMode() === "arquivo") {
      if (!titleInput.value.trim()) {
        titleInput.value = titleFromFilename(file.name);
      }
    }
  }

  function publicSiteUrl(repoPath) {
    return (
      "../" +
      String(repoPath || "")
        .replace(/\\/g, "/")
        .split("/")
        .map(function (segment) {
          return encodeURIComponent(segment);
        })
        .join("/")
    );
  }

  function archivePublicUrl(filename) {
    var rel = String(filename || "").replace(/\\/g, "/");
    return publicSiteUrl(archivePath + "/" + rel);
  }

  /** Mesma ordem de fallback que o arquivo no site (miniatura primeiro). */
  function archiveRemovePreviewUrls(file) {
    var rel = String(file || "").replace(/\\/g, "/");
    var slash = rel.lastIndexOf("/");
    var name = slash === -1 ? rel : rel.slice(slash + 1);
    var dir = slash === -1 ? "" : rel.slice(0, slash + 1);
    var dot = name.lastIndexOf(".");
    var ext = dot === -1 ? "" : name.slice(dot).toLowerCase();
    var base = dot === -1 ? name : name.slice(0, dot);
    var urls = [];
    var seen = {};

    function add(repoPath) {
      if (!repoPath || seen[repoPath]) return;
      seen[repoPath] = true;
      urls.push(publicSiteUrl(repoPath));
    }

    archiveThumbRepoCandidates(rel).forEach(function (thumbPath) {
      add(thumbPath);
    });
    add(archivePath + "/" + rel);
    return urls;
  }

  function bindRemovePreviewImg(img, file) {
    var sources = archiveRemovePreviewUrls(file);
    if (!sources.length) return;
    var index = 0;
    img.src = sources[0];
    img.addEventListener("error", function () {
      index += 1;
      if (index < sources.length) {
        img.src = sources[index];
      }
    });
  }

  async function fetchManifestItems() {
    var bust = "?t=" + String(Date.now());
    var candidates = [
      "../" + manifestPath + bust,
      "/" + manifestPath + bust,
      new URL("../" + manifestPath + bust, window.location.href).href,
    ];
    var lastError;
    for (var i = 0; i < candidates.length; i++) {
      try {
        var response = await fetch(candidates[i], { cache: "no-store" });
        if (!response.ok) continue;
        var data = await response.json();
        if (data && Array.isArray(data.items)) return data.items;
        if (Array.isArray(data)) return data;
        return [];
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("manifest");
  }

  async function loadRemoveList() {
    if (!removeList) return;
    var gen = ++removeListGen;
    removeList.innerHTML = "<li class=\"" + EMPTY_CLASS + "\">A carregar…</li>";
    var loggedIn = Boolean(getToken());
    try {
      var items = await fetchManifestItems();
      if (gen !== removeListGen) return;
      removeList.innerHTML = "";
      if (!items.length) {
        removeList.innerHTML = "<li class=\"" + EMPTY_CLASS + "\">Nenhuma obra no arquivo.</li>";
        return;
      }
      items.forEach(function (item) {
        if (!item || !item.file) return;
        var li = document.createElement("li");
        li.className = "admin-remove__item";

        var img = document.createElement("img");
        img.className = "admin-remove__thumb";
        img.alt = "";
        bindRemovePreviewImg(img, item.file);
        img.loading = "lazy";

        var meta = document.createElement("div");
        meta.className = "admin-remove__meta";
        meta.innerHTML =
          "<strong>" +
          (item.title || item.file) +
          "</strong><span>" +
          item.file +
          "</span>";

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "admin-remove__btn";
        btn.textContent = "Remover";
        btn.disabled = !loggedIn;
        btn.addEventListener("click", function () {
          onRemoveItem(item.file, item.title || item.file);
        });

        li.append(img, meta, btn);
        removeList.appendChild(li);
      });
    } catch (error) {
      if (gen !== removeListGen) return;
      console.error(error);
      removeList.innerHTML =
        "<li class=\"" + EMPTY_CLASS + "\">Não foi possível carregar a lista.</li>";
    }
  }

  async function onRemoveItem(filename, title) {
    if (!getToken()) {
      setStatus("Inicia sessão com GitHub.", true);
      return;
    }
    var label = title + " (" + filename + ")";
    if (!window.confirm("Remover do site?\n\n" + label)) return;

    setStatus("A remover…");
    try {
      var manifestFile = await getFile(manifestPath);
      var manifest = JSON.parse(manifestFile.text);
      if (!manifest.items || !Array.isArray(manifest.items)) manifest.items = [];
      manifest.items = manifest.items.filter(function (item) {
        return item && item.file !== filename;
      });
      var manifestText = JSON.stringify(manifest, null, 2) + "\n";
      await putFile(
        manifestPath,
        utf8ToBase64(manifestText),
        manifestFile.sha,
        "Remove archive entry " + filename
      );

      var imagePath = archivePath + "/" + filename;
      try {
        var imageFile = await getFile(imagePath);
        await deleteFile(imagePath, imageFile.sha, "Remove archive image " + filename);
      } catch (imageError) {
        if (imageError.status !== 404) throw imageError;
      }

      await deleteArchiveThumbsIfExist(filename);

      setStatus(
        "Removido do site: entrada no images.json, ficheiro em " +
          archivePath +
          "/ e miniatura(s) em thumbs/. Atualiza em 1–2 min (Ctrl+Shift+R no arquivo)."
      );
      loadRemoveList();
    } catch (error) {
      console.error(error);
      if (error.status === 401 || error.status === 403 || error.message === "no_write") {
        setToken("");
      }
      setStatus(formatGitHubError(error), true);
    }
  }

  function bindDropZone() {
    if (!dropZone || !fileInput) return;

    function openPicker() {
      fileInput.click();
    }

    dropZone.addEventListener("click", openPicker);
    dropZone.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPicker();
      }
    });

    dropZone.addEventListener("dragover", function (event) {
      event.preventDefault();
      dropZone.classList.add("is-dragover");
    });
    dropZone.addEventListener("dragleave", function () {
      dropZone.classList.remove("is-dragover");
    });
    dropZone.addEventListener("drop", function (event) {
      event.preventDefault();
      dropZone.classList.remove("is-dragover");
      var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file || !file.type.match(/^image\//)) {
        setStatus("Só imagens.", true);
        return;
      }
      try {
        var dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
      } catch (e) {
        setStatus("Arrasta ou clica para escolher.", true);
        return;
      }
      onFileChosen();
    });

    fileInput.addEventListener("change", onFileChosen);
  }

  function init() {
    fileInput = $("admin-file");
    tipoFieldset = $("admin-tipo");
    paginaInput = $("admin-pagina");
    paginaWrap = $("admin-pagina-wrap");
    obraFieldsEl = $("admin-obra-fields");
    titleInput = $("admin-title");
    textInput = $("admin-text");
    saveBtn = $("admin-save");
    loginBtn = $("admin-login");
    logoutBtn = $("admin-logout");
    statusEl = $("admin-status");
    uploadCard = $("admin-upload");
    setupEl = $("admin-setup");
    dropZone = $("admin-drop");
    fileNameEl = $("admin-filename");
    removeSection = $("admin-remove");
    removeList = $("admin-remove-list");
    if (loginBtn) loginBtn.addEventListener("click", loginWithGitHub);
    if (logoutBtn) logoutBtn.addEventListener("click", function () {
      setToken("");
      refreshAuthStatusMessage();
      loadRemoveList();
    });
    if (saveBtn) saveBtn.addEventListener("click", onSave);
    if (tipoFieldset) {
      tipoFieldset.addEventListener("change", syncPublishModeUi);
    }
    populatePageSelect();
    bindDropZone();

    syncAuthUi();
    if (getToken()) {
      verifyGitHubAccess()
        .then(function () {
          refreshAuthStatusMessage();
        })
        .catch(function (accessError) {
          setToken("");
          setStatus(formatGitHubError(accessError), true);
        });
    } else {
      refreshAuthStatusMessage();
    }
    loadRemoveList();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

(function () {
  var prefersHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!prefersHover.matches) return;

  document.documentElement.classList.add("has-cursor-dot");

  var dot = document.createElement("div");
  dot.className = "cursor-dot";
  dot.setAttribute("aria-hidden", "true");

  var ball = document.createElement("span");
  ball.className = "cursor-dot__ball";

  var star = document.createElement("span");
  star.className = "cursor-dot__star";

  var starSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  starSvg.setAttribute("viewBox", "0 0 24 24");
  starSvg.setAttribute("class", "cursor-dot__star-svg");

  var lines = document.createElementNS("http://www.w3.org/2000/svg", "g");
  lines.setAttribute("class", "cursor-dot__star-lines");

  var cx = 12;
  var cy = 12;
  var radius = 10;
  for (var i = 0; i < 5; i += 1) {
    var angle = ((-90 + i * 72) * Math.PI) / 180;
    var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(cx));
    line.setAttribute("y1", String(cy));
    line.setAttribute("x2", String(cx + radius * Math.cos(angle)));
    line.setAttribute("y2", String(cy + radius * Math.sin(angle)));
    lines.appendChild(line);
  }

  starSvg.appendChild(lines);
  star.appendChild(starSvg);
  dot.appendChild(ball);
  dot.appendChild(star);
  document.body.appendChild(dot);

  function isHoverable(node) {
    return Boolean(node && node.closest && node.closest("a, button, [role='button']"));
  }

  document.addEventListener(
    "mousemove",
    function (event) {
      dot.classList.toggle("is-hover", isHoverable(event.target));
      dot.style.transform =
        "translate3d(" +
        event.clientX +
        "px, " +
        event.clientY +
        "px, 0) translate(-50%, -50%)";
      dot.classList.add("is-visible");
    },
    { passive: true }
  );

  document.addEventListener("mouseleave", function () {
    dot.classList.remove("is-visible");
  });
})();
