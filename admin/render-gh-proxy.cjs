/**
 * Proxy GitHub API for the admin (browser → Render → api.github.com).
 * Copy this file into your Render OAuth repo (next to app.js), then in app.js:
 *
 *   require("./render-gh-proxy.cjs")(app);
 *
 * (before app.listen)
 */
const https = require("https");
const { URL } = require("url");

module.exports = function mountGhProxy(app) {
  const express = require("express");
  const rawOrigins = (process.env.ORIGINS || "")
    .split(",")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);

  function originAllowed(origin) {
    if (!origin) return true;
    const host = origin.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    return rawOrigins.some(function (allowed) {
      return host === allowed || host.endsWith("." + allowed);
    });
  }

  function githubPath(req) {
    const raw = req.originalUrl || req.url || "";
    let path = raw.replace(/^\/gh(?=\/|$)/, "");
    if (!path || path === "") path = "/";
    if (path.charAt(0) !== "/") path = "/" + path;
    return path;
  }

  function upstreamRequest(targetUrl, method, headers, body) {
    return new Promise(function (resolve, reject) {
      const u = new URL(targetUrl);
      const opts = {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: method,
        headers: Object.assign({}, headers, { Host: u.hostname }),
      };
      const req = https.request(opts, function (upstream) {
        const chunks = [];
        upstream.on("data", function (chunk) {
          chunks.push(chunk);
        });
        upstream.on("end", function () {
          resolve({
            status: upstream.statusCode || 502,
            headers: upstream.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      });
      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    });
  }

  const gh = express.Router();
  gh.use(express.json({ limit: "64mb" }));

  gh.use(function (req, res, next) {
    const origin = req.headers.origin;
    if (origin && !originAllowed(origin)) {
      return res.status(403).json({ message: "Origin not allowed" });
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Accept, X-GitHub-Api-Version"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  gh.all(/.*/, function (req, res) {
    const auth = req.headers.authorization;
    if (!auth) {
      return res.status(401).json({ message: "Authorization required" });
    }

    const ghPath = githubPath(req);
    const targetUrl = "https://api.github.com" + ghPath;
    const headers = {
      Accept: req.headers.accept || "application/vnd.github+json",
      Authorization: auth,
      "X-GitHub-Api-Version": req.headers["x-github-api-version"] || "2022-11-28",
      "User-Agent": "avv-oauth-gh-proxy",
    };

    let body = null;
    if (req.method !== "GET" && req.method !== "HEAD" && req.body && Object.keys(req.body).length) {
      body = JSON.stringify(req.body);
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    upstreamRequest(targetUrl, req.method, headers, body)
      .then(function (upstream) {
        res.status(upstream.status);
        const ct = upstream.headers["content-type"];
        if (ct) res.setHeader("Content-Type", ct);
        res.send(upstream.body);
      })
      .catch(function (error) {
        console.error("gh-proxy", error && error.message ? error.message : error);
        res.status(502).json({
          message: "GitHub proxy error",
          detail: error && error.message ? error.message : "upstream_failed",
        });
      });
  });

  app.use("/gh", gh);
};
