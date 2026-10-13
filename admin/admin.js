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

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("is-error", Boolean(isError));
  }

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setToken(token) {
    try {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
    syncAuthUi();
  }

  function oauthConfigured() {
    return Boolean(config.githubClientId && config.oauthBaseUrl);
  }

  function syncAuthUi() {
    var token = getToken();
    var canGitHub = oauthConfigured();
    if (loginBtn) loginBtn.hidden = !canGitHub || Boolean(token);
    if (logoutBtn) logoutBtn.hidden = !canGitHub || !token;
    if (saveBtn) saveBtn.disabled = !token;
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
      function (response) {
        return response.json().then(function (data) {
          if (!response.ok) {
            var err = new Error(data.message || "github_error");
            err.status = response.status;
            err.payload = data;
            throw err;
          }
          return data;
        });
      }
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

  function loginWithGitHub() {
    if (!oauthConfigured()) return;
    var base = String(config.oauthBaseUrl).replace(/\/$/, "");
    var authUrl =
      base +
      "/auth?provider=github&scope=repo&client_id=" +
      encodeURIComponent(config.githubClientId);
    var popup = window.open(authUrl, "avv-github-auth", "width=600,height=720");

    function onMessage(event) {
      if (!event.data || typeof event.data !== "string") return;
      if (event.data === "authorizing:github" && popup && !popup.closed) {
        popup.postMessage("authorization:github:configure", window.location.origin);
        return;
      }
      if (event.data.indexOf("authorization:github:success:") !== 0) return;
      window.removeEventListener("message", onMessage);
      try {
        var payload = JSON.parse(event.data.slice("authorization:github:success:".length));
        if (payload && payload.token) {
          setToken(payload.token);
          setStatus("Sessão GitHub iniciada. Podes enviar imagens.");
        }
      } catch (e) {
        setStatus("Login falhou.", true);
      }
      if (popup) popup.close();
    }

    window.addEventListener("message", onMessage);
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
    } catch (error) {
      console.error(error);
      if (error.message === "no_token") {
        setStatus("Inicia sessão com GitHub.", true);
      } else if (error.status === 403 || error.status === 401) {
        setStatus("Sem permissão no repositório. Precisas de acesso Write.", true);
        setToken("");
      } else {
        setStatus("Não foi possível enviar. Tenta outra vez ou verifica a configuração.", true);
      }
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

    if (loginBtn) loginBtn.addEventListener("click", loginWithGitHub);
    if (logoutBtn) logoutBtn.addEventListener("click", function () {
      setToken("");
      setStatus("Sessão terminada.");
    });
    if (saveBtn) saveBtn.addEventListener("click", onSave);
    bindDropZone();

    syncAuthUi();
    if (getToken()) {
      setStatus("Sessão GitHub ativa.");
    } else if (oauthConfigured()) {
      setStatus("Inicia sessão com GitHub para publicar.");
    } else {
      setStatus("Upload online ainda não configurado — usa COMO-ADICIONAR-OBRA.md no repo.", false);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
