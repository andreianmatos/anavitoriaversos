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

  var fileInput;
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
    try {
      var stored = sessionStorage.getItem(TOKEN_KEY) || "";
      if (stored) memoryToken = stored;
      return stored;
    } catch (e) {
      return memoryToken || "";
    }
  }

  function setToken(token) {
    memoryToken = token || "";
    try {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
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
      return (
        "Resposta inválida do GitHub (rede ou extensão do browser). " +
        "Tenta outro browser ou desativa bloqueadores em api.github.com."
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
    if (error.payload && error.payload.message) {
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
    return fetch("https://api.github.com" + path, Object.assign({}, options, { headers })).then(
      parseGithubResponse
    );
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

    var entryTitle =
      title && title.trim() ? title.trim().toUpperCase() : titleFromFilename(filename);
    var text = Array.isArray(textParagraphs) ? textParagraphs : [];
    manifest.items.push({ file: filename, title: entryTitle, text: text });

    var manifestText = JSON.stringify(manifest, null, 2) + "\n";
    await putFile(
      manifestPath,
      utf8ToBase64(manifestText),
      manifestFile.sha,
      "Update images.json"
    );

    return { filename: filename, entry: { file: filename, title: entryTitle, text: text } };
  }

  async function onSave() {
    var file = fileInput.files && fileInput.files[0];
    if (!file) {
      setStatus("Escolhe uma imagem.", true);
      return;
    }

    var title = titleInput.value.trim();
    var textParagraphs = parseTextParagraphs(textInput && textInput.value);
    saveBtn.disabled = true;
    setStatus("A enviar…");

    try {
      if (!getToken()) {
        setStatus("Inicia sessão com GitHub primeiro.", true);
        return;
      }
      var result = await uploadViaGitHub(file, title, textParagraphs);
      setStatus(
        "Publicado: " +
          result.filename +
          ". O site atualiza em 1–2 min (miniaturas pelo workflow)."
      );
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
    if (file && !titleInput.value.trim()) {
      titleInput.value = titleFromFilename(file.name);
    }
  }

  function archivePublicUrl(filename) {
    return (
      "../" +
      archivePath.split("/").map(encodeURIComponent).join("/") +
      "/" +
      encodeURIComponent(String(filename))
    );
  }

  async function fetchManifestItems() {
    var candidates = [
      "../" + manifestPath,
      "/" + manifestPath,
      new URL("../" + manifestPath, window.location.href).href,
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
        img.src = archivePublicUrl(item.file);
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

      setStatus("Removido: " + filename);
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
