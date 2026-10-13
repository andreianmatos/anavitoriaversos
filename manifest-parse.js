(function (global) {
  var ARCHIVE_IMAGE_PREFIX = "imagens/arquivo/";

  function normalizeArchiveFile(file) {
    if (!file) return file;
    var value = String(file).replace(/^\//, "");
    if (value.indexOf(ARCHIVE_IMAGE_PREFIX) === 0) {
      return value.slice(ARCHIVE_IMAGE_PREFIX.length);
    }
    return value;
  }

  function normalizeArchiveText(text) {
    if (text == null) return text;
    if (!Array.isArray(text)) {
      return typeof text === "string" && text.trim() ? [text] : [];
    }
    return text
      .map(function (item) {
        if (typeof item === "string") return item;
        if (item && typeof item.body === "string") return item.body;
        if (item && typeof item.text === "string") return item.text;
        if (item && typeof item.paragraph === "string") return item.paragraph;
        return "";
      })
      .filter(function (paragraph) {
        return Boolean(paragraph && String(paragraph).trim());
      });
  }

  function normalizeArchiveEntry(entry) {
    if (!entry || typeof entry !== "object") return entry;
    var copy = Object.assign({}, entry);
    if (copy.file) copy.file = normalizeArchiveFile(copy.file);
    if (copy.text !== undefined) copy.text = normalizeArchiveText(copy.text);
    return copy;
  }

  function parseArchiveManifest(data) {
    var list = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.items)) {
      list = data.items;
    }
    return list.map(normalizeArchiveEntry);
  }

  global.parseArchiveManifest = parseArchiveManifest;
})(typeof window !== "undefined" ? window : globalThis);
