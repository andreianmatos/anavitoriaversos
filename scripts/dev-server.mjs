import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT) || 3000;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function isAssetPath(urlPath) {
  return /\.[a-z0-9]+$/i.test(path.basename(urlPath));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = mime[ext] || "application/octet-stream";
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(data);
  });
}

const server = http.createServer(function (req, res) {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let filePath = path.normalize(path.join(root, urlPath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }

  fs.stat(filePath, function (err, stat) {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      return sendFile(res, filePath);
    }
    if (!err && stat.isFile()) {
      return sendFile(res, filePath);
    }
    if (!isAssetPath(urlPath)) {
      return sendFile(res, path.join(root, "index.html"));
    }
    res.writeHead(404);
    res.end("Not found");
  });
});

server.listen(port, function () {
  console.log("SPA dev server at http://127.0.0.1:" + port + "/");
  console.log("Direct obra URLs work, e.g. /DeQuemVens");
});
