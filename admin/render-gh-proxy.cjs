/**
 * Proxy GitHub API for the admin (browser → Render → api.github.com).
 * Copy this file into your Render OAuth repo (next to app.js), then in app.js:
 *
 *   const mountGhProxy = require("./render-gh-proxy.cjs");
 *   mountGhProxy(app);
 *
 * (before app.listen)
 */
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
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, X-GitHub-Api-Version");
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  gh.all(/.*/, async function (req, res) {
    const auth = req.headers.authorization;
    if (!auth) {
      return res.status(401).json({ message: "Authorization required" });
    }
    const ghPath = req.originalUrl.replace(/^\/gh/, "") || req.url;
    const url = "https://api.github.com" + ghPath;
    const init = {
      method: req.method,
      headers: {
        Accept: req.headers.accept || "application/vnd.github+json",
        Authorization: auth,
        "X-GitHub-Api-Version": req.headers["x-github-api-version"] || "2022-11-28",
        "User-Agent": "avv-oauth-gh-proxy",
      },
    };
    if (req.method !== "GET" && req.method !== "HEAD" && req.body && Object.keys(req.body).length) {
      init.body = JSON.stringify(req.body);
      init.headers["Content-Type"] = "application/json";
    }
    try {
      const upstream = await fetch(url, init);
      const text = await upstream.text();
      res.status(upstream.status);
      const ct = upstream.headers.get("content-type");
      if (ct) res.setHeader("Content-Type", ct);
      res.send(text);
    } catch (error) {
      console.error("gh-proxy", error);
      res.status(502).json({ message: "GitHub proxy error" });
    }
  });

  app.use("/gh", gh);
};
