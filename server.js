#!/usr/bin/env node
/**
 * server — web UI for rastersysteme pipeline
 *
 * Dashboard with file browser, slide preview, pipeline controls,
 * and live activity log over WebSocket.
 *
 * Usage:
 *   node server.js [--port 8800]
 *   npm run ui
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const chalk = require("chalk");
const { parseMarkdown, generateHTML, generate, generateExternalCSS, THEMES } = require("./raster.js");
const { runPipeline, split, STAGES } = require("./pipeline.js");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;

const ROOT = process.cwd();
const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--port") || "8800");

// ═══════════════════════════════════════════════════════
// WEBSOCKET — minimal, no dependencies (from watch.js)
// ═══════════════════════════════════════════════════════

const wsClients = new Set();

function setupWS(server) {
  server.on("upgrade", (req, socket) => {
    if (req.url !== "/ws") return socket.destroy();
    const key = req.headers["sec-websocket-key"];
    const accept = crypto.createHash("sha1")
      .update(key + "258EAFA5-E914-47DA-95CA-5AB5FF87D35E")
      .digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    wsClients.add(socket);
    socket.on("close", () => wsClients.delete(socket));
    socket.on("error", () => wsClients.delete(socket));
  });
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  const data = Buffer.from(msg);
  // WebSocket framing: handle messages up to 65535 bytes
  let frame;
  if (data.length < 126) {
    frame = Buffer.alloc(2 + data.length);
    frame[0] = 0x81;
    frame[1] = data.length;
    data.copy(frame, 2);
  } else {
    frame = Buffer.alloc(4 + data.length);
    frame[0] = 0x81;
    frame[1] = 126;
    frame.writeUInt16BE(data.length, 2);
    data.copy(frame, 4);
  }
  for (const client of wsClients) {
    try { client.write(frame); } catch {}
  }
}

function logEvent(status, msg) {
  const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
  broadcast({ type: "log", time, status, msg });
}

// ═══════════════════════════════════════════════════════
// FILE DISCOVERY
// ═══════════════════════════════════════════════════════

function findAllMarkdown() {
  const results = [];

  function scan(dir, recursive = false) {
    if (!fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        if (entry.name.includes(".composed.")) continue;
        if (entry.name.includes(".build")) continue;
        if (entry.name === "CLAUDE.md" || entry.name === "SPEC.md") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && recursive) {
          scan(full, true);
        } else if (entry.isFile() && entry.name.endsWith(".md")
          && !entry.name.startsWith("README")
          && !entry.name.startsWith("TODO")
          && !entry.name.includes("-README")) {
          const stat = fs.statSync(full);
          const content = fs.readFileSync(full, "utf-8");
          const slideCount = content.split(/\n---\n/).filter(s => s.trim()).length;
          results.push({
            path: path.relative(ROOT, full),
            name: entry.name,
            slides: slideCount,
            size: (stat.size / 1024).toFixed(1) + " KB",
            modified: stat.mtime.toISOString(),
          });
        }
      }
    } catch {}
  }

  scan(ROOT, false);
  scan(path.join(ROOT, "decks"), false);
  scan(path.join(ROOT, "content"), true);
  return results;
}

function getSlidePreview(filePath) {
  const full = path.resolve(ROOT, filePath);
  if (!fs.existsSync(full)) return [];
  const md = fs.readFileSync(full, "utf-8");
  const slides = parseMarkdown(md);
  const { detectLayout } = require("./raster.js");
  return slides.map((s, i) => {
    // body can be a string or array depending on the slide
    const bodyText = Array.isArray(s.body) ? s.body.join(" ") : (s.body || "");
    return {
      num: i + 1,
      title: s.title || "",
      subtitle: s.subtitle || "",
      body: String(bodyText).slice(0, 120),
      bullets: (s.bullets || []).slice(0, 4).map(b => typeof b === "string" ? b : (b.text || "")),
      layout: detectLayout(s, i, slides.length),
      bg: s.bgOverride || null,
      font: s.fontOverride || null,
      hasImage: !!(s.images && s.images.length),
      hasVideo: !!(s.videos && s.videos.length),
      hasNotes: !!s.notes,
    };
  });
}

function getBuildStatus(filePath) {
  const full = path.resolve(ROOT, filePath);
  const base = path.basename(full, ".md");
  const dir = path.dirname(full);
  const buildDir = path.join(dir, `${base}.build`);
  const status = { hasBuild: false, stages: {} };

  if (fs.existsSync(buildDir)) {
    status.hasBuild = true;
    status.buildDir = path.relative(ROOT, buildDir);
    status.stages.split = fs.existsSync(path.join(buildDir, "slides", "manifest.json"));
    status.stages.design = fs.existsSync(path.join(buildDir, "design-system.json"));
    status.stages.compose = fs.existsSync(path.join(buildDir, "composition.md"));
    status.stages.render = fs.existsSync(path.join(buildDir, `${base}.html`));

    if (status.stages.design) {
      try {
        status.designSystem = JSON.parse(fs.readFileSync(path.join(buildDir, "design-system.json"), "utf-8"));
      } catch {}
    }
    if (status.stages.compose) {
      try {
        const { parseComposition } = require("./pipeline.js");
        status.composition = parseComposition(fs.readFileSync(path.join(buildDir, "composition.md"), "utf-8"));
      } catch {}
    }
    if (status.stages.split) {
      try {
        status.manifest = JSON.parse(fs.readFileSync(path.join(buildDir, "slides", "manifest.json"), "utf-8"));
      } catch {}
    }
  }

  // Also check flat outputs (legacy)
  status.hasComposed = fs.existsSync(path.join(dir, `${base}.composed.md`));
  status.hasHTML = fs.existsSync(path.join(dir, `${base}.html`)) || (status.hasBuild && status.stages.render);
  status.hasPPTX = fs.existsSync(path.join(dir, `${base}.pptx`)) || fs.existsSync(path.join(buildDir, `${base}.pptx`));

  return status;
}

// ═══════════════════════════════════════════════════════
// DECK GALLERY — scan all rendered HTML slideshows
// ═══════════════════════════════════════════════════════

function findAllDecks() {
  const decks = [];
  const seen = new Set();

  function scanHTML(dir, category, recursive = false) {
    if (!fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && recursive) {
          // Compare run directories
          if (entry.name.startsWith("compare-")) {
            scanCompareDir(full);
          } else if (!entry.name.includes("node_modules") && !entry.name.endsWith("-images")) {
            scanHTML(full, category, true);
          }
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
        // Skip non-slideshow HTML
        if (entry.name === "index.html") continue;
        if (entry.name.includes("template")) continue;

        const rel = path.relative(ROOT, full);
        if (seen.has(rel)) continue;
        seen.add(rel);

        const meta = extractDeckMeta(full, rel, category);
        if (meta) decks.push(meta);
      }
    } catch {}
  }

  function scanCompareDir(dir) {
    // Compare dirs have structure: compare-<deck>-<date>/intensity-theme/deck.html
    const dirName = path.basename(dir);
    const dateMatch = dirName.match(/(\d{4}-\d{2}-\d{2}[-_]\d{2}[-_]\d{2})/);
    const dateStr = dateMatch ? dateMatch[1].replace(/_/g, "-") : "";
    const variants = [];

    try {
      for (const variant of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!variant.isDirectory()) continue;
        const variantDir = path.join(dir, variant.name);
        for (const f of fs.readdirSync(variantDir)) {
          if (!f.endsWith(".html")) continue;
          const full = path.join(variantDir, f);
          const rel = path.relative(ROOT, full);
          if (seen.has(rel)) continue;
          seen.add(rel);
          variants.push({
            path: rel,
            variant: variant.name,
            name: f,
          });
        }
      }
    } catch {}

    if (variants.length > 0) {
      decks.push({
        type: "compare",
        name: dirName,
        date: dateStr,
        path: path.relative(ROOT, dir),
        variants,
      });
    }
  }

  function extractDeckMeta(full, rel, category) {
    try {
      const stat = fs.statSync(full);
      const content = fs.readFileSync(full, "utf-8");
      const slideCount = (content.match(/<section class="slide/g) || []).length;
      if (slideCount === 0) return null; // Not a slideshow

      // Detect type from filename
      const name = path.basename(rel, ".html");
      let type = "deck";
      if (name.includes(".review") || name.includes("-review")) type = "review";
      else if (name.includes(".studio") || name.includes("-studio")) type = "studio";
      else if (name.includes(".qa") || name.includes(".audit")) type = "qa";
      else if (name.includes(".grid")) type = "grid";
      else if (name.includes(".reveal")) type = "reveal";
      else if (name.includes("diff-")) type = "diff";
      else if (name.includes(".spliced") || name.includes(".merged")) type = "spliced";

      // Detect theme from CSS vars
      let theme = "light";
      const bgMatch = content.match(/--bg:#([0-9A-Fa-f]{6})/);
      if (bgMatch) {
        const hex = bgMatch[1];
        const lum = parseInt(hex.slice(0,2),16)*0.299 + parseInt(hex.slice(2,4),16)*0.587 + parseInt(hex.slice(4,6),16)*0.114;
        theme = lum < 128 ? "dark" : "light";
      }

      // Extract first slide title
      const titleMatch = content.match(/<(?:h1|div)[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/i)
        || content.match(/<h1[^>]*>([^<]+)/i);
      const firstTitle = titleMatch ? titleMatch[1].trim().slice(0, 60) : "";

      return {
        type,
        category,
        path: rel,
        name,
        slides: slideCount,
        theme,
        firstTitle,
        size: (stat.size / 1024).toFixed(0) + "K",
        modified: stat.mtime.toISOString(),
      };
    } catch { return null; }
  }

  scanHTML(ROOT, "root", false);
  scanHTML(path.join(ROOT, "decks"), "decks", true);

  // Sort: decks first, then by modified date descending
  decks.sort((a, b) => {
    if (a.type === "compare" && b.type !== "compare") return 1;
    if (a.type !== "compare" && b.type === "compare") return -1;
    return (b.modified || b.date || "") > (a.modified || a.date || "") ? 1 : -1;
  });

  return decks;
}

// ═══════════════════════════════════════════════════════
// PIPELINE RUNNER (with WebSocket progress)
// ═══════════════════════════════════════════════════════

let pipelineRunning = false;

async function runPipelineWithProgress(filePath, options) {
  if (pipelineRunning) {
    return { error: "Pipeline already running" };
  }
  pipelineRunning = true;
  broadcast({ type: "pipeline-start", file: filePath, options });

  // Intercept stderr to capture pipeline progress
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = function(chunk) {
    origWrite(chunk);
    const text = chunk.toString().replace(/\x1b\[[0-9;]*m/g, "").trim();
    if (text) logEvent("run", text);
  };

  try {
    logEvent("info", `Pipeline started: ${filePath}`);
    const results = await runPipeline(filePath, options);
    logEvent("ok", `Pipeline complete: ${filePath}`);
    broadcast({ type: "pipeline-done", file: filePath, results });
    return results;
  } catch (err) {
    logEvent("err", `Pipeline failed: ${err.message}`);
    broadcast({ type: "pipeline-error", file: filePath, error: err.message });
    return { error: err.message };
  } finally {
    process.stderr.write = origWrite;
    pipelineRunning = false;
  }
}

// ═══════════════════════════════════════════════════════
// HTTP SERVER + API ROUTER
// ═══════════════════════════════════════════════════════

function parseJSON(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error("Invalid JSON")); }
    });
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
  ".json": "application/json", ".md": "text/plain", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST", "Access-Control-Allow-Headers": "Content-Type" });
    return res.end();
  }

  try {
    // ── API ROUTES ───────────────────────────────
    if (pathname === "/api/files") {
      return json(res, findAllMarkdown());
    }

    if (pathname === "/api/preview" && url.searchParams.get("file")) {
      return json(res, getSlidePreview(url.searchParams.get("file")));
    }

    if (pathname === "/api/build" && url.searchParams.get("file")) {
      return json(res, getBuildStatus(url.searchParams.get("file")));
    }

    if (pathname === "/api/decks") {
      return json(res, findAllDecks());
    }

    if (pathname === "/api/design-systems") {
      const { listSystems } = require("./design-system.js");
      return json(res, listSystems());
    }

    if (pathname === "/api/file" && url.searchParams.get("path")) {
      const fp = path.resolve(ROOT, url.searchParams.get("path"));
      if (!fp.startsWith(ROOT)) return json(res, { error: "forbidden" }, 403);
      if (!fs.existsSync(fp)) return json(res, { error: "not found" }, 404);
      const content = fs.readFileSync(fp, "utf-8");
      return json(res, { content });
    }

    if (pathname === "/api/pipeline" && req.method === "POST") {
      const body = await parseJSON(req);
      const result = await runPipelineWithProgress(body.file, {
        from: body.from || "split",
        to: body.to,
        theme: body.theme || "light",
        intensity: body.intensity || "moderate",
        model: body.model || "sonnet",
        designSystem: body.designSystem,
        externalCSS: true,
        recompose: body.recompose || false,
      });
      return json(res, result);
    }

    if (pathname === "/api/render-only" && req.method === "POST") {
      const body = await parseJSON(req);
      const result = await runPipelineWithProgress(body.file, {
        from: "render",
        to: "render",
        theme: body.theme || "light",
        externalCSS: true,
      });
      return json(res, result);
    }

    // ── DASHBOARD ────────────────────────────────
    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(getDashboardHTML());
    }

    if (pathname === "/gallery") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(getGalleryHTML());
    }

    // ── STATIC FILES (serve from project root) ──
    let filePath = path.join(ROOT, decodeURIComponent(pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mime = MIME[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      return res.end(fs.readFileSync(filePath));
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (err) {
    json(res, { error: err.message }, 500);
  }
});

setupWS(server);

// ═══════════════════════════════════════════════════════
// DASHBOARD HTML
// ═══════════════════════════════════════════════════════

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>rastersysteme</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Fira+Code:wght@400;500;600&family=Syne:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
:root {
  --bg:             #F8F5F0;
  --bg-panel:       #FFFFFF;
  --bg-inset:       #F0ECE6;
  --bg-terminal:    #1A1714;
  --bg-hover:       #EDE9E3;
  --bg-selected:    #E8E3DB;
  --border:         #D8D3CB;
  --border-light:   #E8E4DD;
  --grid-line:      rgba(180, 172, 158, 0.18);
  --text:           #1A1714;
  --text-mid:       #5C564D;
  --text-light:     #918A7E;
  --text-inverse:   #F0EBE3;
  --text-terminal:  #C8C2B6;
  --red:            #B7311A;
  --red-light:      rgba(183, 49, 26, 0.08);
  --teal:           #1B5E80;
  --teal-light:     rgba(27, 94, 128, 0.08);
  --green:          #2B7038;
  --green-light:    rgba(43, 112, 56, 0.08);
  --amber:          #876512;
  --amber-light:    rgba(135, 101, 18, 0.08);
  --purple:         #6B4FA0;
  --purple-light:   rgba(107, 79, 160, 0.08);
  --status-ok:      #2B7038;
  --status-err:     #B7311A;
  --status-run:     #1B5E80;
  --status-warn:    #876512;
  --font-heading:   'Syne', sans-serif;
  --font-body:      'DM Sans', sans-serif;
  --font-data:      'Fira Code', monospace;
  --topbar-h:       52px;
  --gap:            1px;
  --panel-pad:      20px;
  --radius:         3px;
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; font-family: var(--font-body); font-size: 14px; color: var(--text); background: var(--border); -webkit-font-smoothing: antialiased; }

.graph-paper {
  background-image: linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: calc(100% / 12) calc(100% / 12);
}

/* ═══ TOPBAR ═══ */
.topbar { height: var(--topbar-h); background: var(--text); color: var(--text-inverse); display: flex; align-items: center; padding: 0 24px; gap: 24px; font-size: 13px; user-select: none; z-index: 100; }
.topbar-brand { display: flex; align-items: center; gap: 10px; font-family: var(--font-heading); font-weight: 700; font-size: 15px; letter-spacing: -0.01em; }
.topbar-brand .square { width: 16px; height: 16px; background: var(--red); display: inline-block; flex-shrink: 0; }
.topbar-sep { width: 1px; height: 24px; background: rgba(255,255,255,0.15); }
.topbar-settings { display: flex; gap: 20px; align-items: center; margin-left: auto; }
.topbar-setting { display: flex; align-items: center; gap: 6px; }
.topbar-setting-label { color: rgba(255,255,255,0.4); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-data); }
.topbar-setting-value { color: rgba(255,255,255,0.85); font-family: var(--font-data); font-size: 12px; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 2px; cursor: pointer; transition: background 0.15s; }
.topbar-setting-value:hover { background: rgba(255,255,255,0.14); }
.topbar-shortcuts { font-family: var(--font-data); font-size: 11px; color: rgba(255,255,255,0.3); }
.topbar-shortcuts kbd { display: inline-block; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; padding: 0 4px; font-family: var(--font-data); font-size: 10px; line-height: 18px; margin: 0 1px; color: rgba(255,255,255,0.5); }

/* ═══ DASHBOARD GRID ═══ */
.dashboard { display: grid; grid-template-columns: 320px 1fr; grid-template-rows: 1fr 1fr; gap: var(--gap); height: calc(100vh - var(--topbar-h)); background: var(--border); }
.quadrant { background: var(--bg); display: flex; flex-direction: column; overflow: hidden; position: relative; }
.quadrant-header { display: flex; align-items: center; justify-content: space-between; padding: 14px var(--panel-pad); border-bottom: 1px solid var(--border-light); flex-shrink: 0; background: var(--bg); }
.quadrant-title { font-family: var(--font-heading); font-weight: 700; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text); display: flex; align-items: center; gap: 8px; }
.quadrant-title .q-num { font-family: var(--font-data); font-size: 10px; font-weight: 500; color: var(--text-light); background: var(--bg-inset); border: 1px solid var(--border-light); width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; border-radius: 2px; }
.quadrant-badge { font-family: var(--font-data); font-size: 11px; color: var(--text-light); }
.quadrant-body { flex: 1; overflow-y: auto; overflow-x: hidden; }
.quadrant-body::-webkit-scrollbar { width: 6px; }
.quadrant-body::-webkit-scrollbar-track { background: transparent; }
.quadrant-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* ═══ Q1: FILE BROWSER ═══ */
.file-list { list-style: none; }
.file-group-label { padding: 8px var(--panel-pad) 4px; font-family: var(--font-data); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-light); background: var(--bg-inset); border-bottom: 1px solid var(--border-light); }
.file-item { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 9px var(--panel-pad); border-bottom: 1px solid var(--border-light); cursor: pointer; transition: background 0.1s; font-size: 13px; }
.file-item:hover { background: var(--bg-hover); }
.file-item.selected { background: var(--bg-selected); border-left: 3px solid var(--red); padding-left: calc(var(--panel-pad) - 3px); }
.file-name { font-family: var(--font-data); font-size: 12px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-item.selected .file-name { color: var(--red); }
.file-meta { font-family: var(--font-data); font-size: 11px; color: var(--text-light); white-space: nowrap; }
.file-meta-slides { background: var(--bg-inset); border: 1px solid var(--border-light); padding: 1px 7px; border-radius: 2px; font-variant-numeric: tabular-nums; }

/* ═══ Q2: PREVIEW ═══ */
.preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; padding: var(--panel-pad); }
.preview-thumb { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius); display: flex; flex-direction: column; overflow: hidden; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
.preview-thumb:hover { border-color: var(--text-light); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.preview-thumb-inner { flex: 1; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; position: relative; min-height: 90px; }
.preview-thumb-inner.dark-bg { background: var(--text); color: var(--text-inverse); }
.preview-thumb-inner.dark-bg .preview-thumb-body { color: rgba(255,255,255,0.5); }
.preview-thumb-num { position: absolute; top: 6px; right: 8px; font-family: var(--font-data); font-size: 9px; color: var(--text-light); opacity: 0.6; }
.dark-bg .preview-thumb-num { color: rgba(255,255,255,0.4); }
.preview-thumb-title { font-family: var(--font-heading); font-weight: 700; font-size: 11px; line-height: 1.2; letter-spacing: -0.01em; }
.preview-thumb-body { font-size: 9px; line-height: 1.4; color: var(--text-mid); overflow: hidden; max-height: 40px; }
.preview-thumb-bullets { font-size: 8px; color: var(--text-mid); line-height: 1.5; }
.preview-thumb-bullets li { margin-left: 12px; }
.preview-thumb-accent { height: 3px; width: 40%; border-radius: 1px; margin-top: auto; }
.preview-thumb-layout { font-family: var(--font-data); font-size: 9px; color: var(--text-light); padding: 4px 12px; border-top: 1px solid var(--border-light); background: var(--bg-inset); display: flex; justify-content: space-between; }
.preview-thumb-icons { display: flex; gap: 4px; }
.preview-thumb-icons span { opacity: 0.5; font-size: 9px; }

/* Build status badges */
.build-badges { display: flex; gap: 4px; padding: 6px var(--panel-pad); border-bottom: 1px solid var(--border-light); }
.build-badge { font-family: var(--font-data); font-size: 10px; padding: 2px 8px; border-radius: 2px; border: 1px solid var(--border); color: var(--text-light); }
.build-badge.done { background: var(--green-light); border-color: var(--green); color: var(--green); }
.build-badge.pending { background: var(--bg-inset); }

/* ═══ Q3: TOOLS ═══ */
.tool-panel { padding: var(--panel-pad); display: flex; flex-direction: column; gap: 14px; height: 100%; }
.tool-section-label { font-family: var(--font-data); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-light); padding-bottom: 2px; }
.tool-buttons { display: flex; flex-direction: column; gap: 5px; }
.tool-btn { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-panel); cursor: pointer; transition: all 0.15s; position: relative; overflow: hidden; }
.tool-btn:hover { border-color: var(--text-light); box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.tool-btn:active { transform: scale(0.995); }
.tool-btn.disabled { opacity: 0.5; pointer-events: none; }
.tool-btn-accent { width: 4px; height: 100%; position: absolute; left: 0; top: 0; border-radius: var(--radius) 0 0 var(--radius); }
.tool-btn-icon { width: 28px; height: 28px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; font-family: var(--font-heading); font-weight: 800; font-size: 12px; color: white; flex-shrink: 0; }
.tool-btn-content { flex: 1; min-width: 0; }
.tool-btn-name { font-family: var(--font-heading); font-weight: 600; font-size: 13px; color: var(--text); display: flex; align-items: center; gap: 8px; }
.tool-btn-name kbd { font-family: var(--font-data); font-size: 10px; font-weight: 500; color: var(--text-light); background: var(--bg-inset); border: 1px solid var(--border-light); padding: 0 5px; border-radius: 2px; line-height: 18px; }
.tool-btn-desc { font-size: 11px; color: var(--text-light); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tool-btn-status { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--border); }
.tool-btn-status.idle     { background: var(--border); }
.tool-btn-status.running  { background: var(--teal); animation: pulse 1.5s ease-in-out infinite; }
.tool-btn-status.success  { background: var(--green); }
.tool-btn-status.error    { background: var(--red); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

/* Config */
.tool-config { display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border-light); margin-top: auto; }
.tool-config-row { display: flex; align-items: center; gap: 8px; }
.tool-config-label { font-family: var(--font-data); font-size: 11px; color: var(--text-light); width: 72px; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.05em; }
.tool-config-options { display: flex; gap: 3px; }
.tool-config-opt { font-family: var(--font-data); font-size: 11px; padding: 3px 10px; border: 1px solid var(--border); border-radius: 2px; background: var(--bg-panel); cursor: pointer; color: var(--text-mid); transition: all 0.12s; }
.tool-config-opt:hover { border-color: var(--text-light); }
.tool-config-opt.active { background: var(--text); color: var(--text-inverse); border-color: var(--text); }

/* ═══ Q4: LOG ═══ */
.quadrant.q4 { background: var(--bg-terminal); }
.quadrant.q4 .quadrant-header { background: var(--bg-terminal); border-bottom-color: rgba(255,255,255,0.06); }
.quadrant.q4 .quadrant-title { color: var(--text-terminal); }
.quadrant.q4 .quadrant-title .q-num { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); }
.quadrant.q4 .quadrant-badge { color: rgba(255,255,255,0.3); }
.log-panel { background: var(--bg-terminal); height: 100%; font-family: var(--font-data); font-size: 12px; line-height: 1.7; color: var(--text-terminal); overflow-y: auto; padding: 14px var(--panel-pad); }
.log-panel::-webkit-scrollbar { width: 6px; }
.log-panel::-webkit-scrollbar-track { background: transparent; }
.log-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
.log-entry { display: flex; gap: 10px; padding: 2px 0; align-items: baseline; }
.log-time { color: rgba(255,255,255,0.25); font-size: 11px; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.log-status { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
.log-status.ok   { background: #4ADE80; }
.log-status.err  { background: #F87171; }
.log-status.run  { background: #60A5FA; animation: pulse 1.5s ease-in-out infinite; }
.log-status.warn { background: #FBBF24; }
.log-status.info { background: rgba(255,255,255,0.2); }
.log-msg { flex: 1; word-break: break-word; }
.hl-file  { color: #93C5FD; }
.hl-ok    { color: #4ADE80; }
.hl-err   { color: #F87171; }
.hl-val   { color: #FBBF24; }
.hl-tool  { color: #C4B5FD; }
.hl-dim   { color: rgba(255,255,255,0.3); }

/* ═══ SLIDE DETAIL OVERLAY ═══ */
.slide-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; align-items: center; justify-content: center; }
.slide-overlay.visible { display: flex; }
.slide-overlay-inner { background: var(--bg); border-radius: 6px; width: 90vw; height: 80vh; box-shadow: 0 20px 60px rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden; }
.slide-overlay-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--border-light); flex-shrink: 0; }
.slide-overlay-header h3 { font-family: var(--font-heading); font-size: 14px; font-weight: 700; }
.slide-overlay-close { background: none; border: 1px solid var(--border); padding: 4px 12px; border-radius: 2px; cursor: pointer; font-family: var(--font-data); font-size: 11px; }
.slide-overlay-body { flex: 1; display: flex; }
.slide-overlay-body iframe { flex: 1; border: none; }

/* ═══ RESPONSIVE ═══ */
@media (max-width: 900px) {
  .dashboard { grid-template-columns: 1fr; grid-template-rows: auto auto auto auto; }
  .quadrant { min-height: 220px; max-height: 50vh; }
  .topbar-shortcuts { display: none; }
}
</style>
</head>
<body>

<header class="topbar">
  <div class="topbar-brand"><span class="square"></span> rastersysteme</div>
  <div class="topbar-sep"></div>
  <div class="topbar-settings">
    <div class="topbar-setting">
      <span class="topbar-setting-label">theme</span>
      <span class="topbar-setting-value" id="set-theme" data-values='["light","dark","red","blue"]' data-index="0">light</span>
    </div>
    <div class="topbar-setting">
      <span class="topbar-setting-label">intensity</span>
      <span class="topbar-setting-value" id="set-intensity" data-values='["minimal","moderate","maximal"]' data-index="1">moderate</span>
    </div>
    <div class="topbar-setting">
      <span class="topbar-setting-label">model</span>
      <span class="topbar-setting-value" id="set-model" data-values='["sonnet","haiku","opus"]' data-index="0">sonnet</span>
    </div>
    <div class="topbar-sep"></div>
    <div class="topbar-shortcuts">
      <kbd>P</kbd>ipeline <kbd>R</kbd>ender <kbd>S</kbd>plit <kbd>O</kbd>pen
      <a href="/gallery" style="color:rgba(255,255,255,0.5);text-decoration:none;margin-left:12px;border:1px solid rgba(255,255,255,0.15);padding:2px 10px;border-radius:2px;font-size:11px">Gallery</a>
    </div>
  </div>
</header>

<main class="dashboard">
  <section class="quadrant q1 graph-paper" id="q1">
    <div class="quadrant-header">
      <div class="quadrant-title"><span class="q-num">1</span> Files</div>
      <div class="quadrant-badge" id="file-count"></div>
    </div>
    <div class="quadrant-body">
      <ul class="file-list" id="file-list"></ul>
    </div>
  </section>

  <section class="quadrant q2" id="q2">
    <div class="quadrant-header">
      <div class="quadrant-title"><span class="q-num">2</span> Preview</div>
      <div class="quadrant-badge" id="preview-badge">select a file</div>
    </div>
    <div id="build-badges" class="build-badges" style="display:none"></div>
    <div class="quadrant-body">
      <div class="preview-grid" id="preview-grid"></div>
    </div>
  </section>

  <section class="quadrant q3" id="q3">
    <div class="quadrant-header">
      <div class="quadrant-title"><span class="q-num">3</span> Pipeline</div>
      <div class="quadrant-badge" id="pipeline-status">ready</div>
    </div>
    <div class="quadrant-body">
      <div class="tool-panel">
        <div class="tool-section-label">Stages</div>
        <div class="tool-buttons" id="tool-buttons"></div>
        <div class="tool-section-label" style="margin-top:8px">Actions</div>
        <div class="tool-buttons" id="action-buttons"></div>
        <div class="tool-config">
          <div class="tool-section-label">Configuration</div>
          <div class="tool-config-row">
            <span class="tool-config-label">Theme</span>
            <div class="tool-config-options" data-config="theme">
              <button class="tool-config-opt active" data-val="light">light</button>
              <button class="tool-config-opt" data-val="dark">dark</button>
              <button class="tool-config-opt" data-val="red">red</button>
              <button class="tool-config-opt" data-val="blue">blue</button>
            </div>
          </div>
          <div class="tool-config-row">
            <span class="tool-config-label">Intensity</span>
            <div class="tool-config-options" data-config="intensity">
              <button class="tool-config-opt" data-val="minimal">minimal</button>
              <button class="tool-config-opt active" data-val="moderate">moderate</button>
              <button class="tool-config-opt" data-val="maximal">maximal</button>
            </div>
          </div>
          <div class="tool-config-row">
            <span class="tool-config-label">Model</span>
            <div class="tool-config-options" data-config="model">
              <button class="tool-config-opt active" data-val="sonnet">sonnet</button>
              <button class="tool-config-opt" data-val="haiku">haiku</button>
              <button class="tool-config-opt" data-val="opus">opus</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="quadrant q4" id="q4">
    <div class="quadrant-header">
      <div class="quadrant-title"><span class="q-num">4</span> Activity</div>
      <div class="quadrant-badge" id="log-count">0 events</div>
    </div>
    <div class="quadrant-body">
      <div class="log-panel" id="log-panel"></div>
    </div>
  </section>
</main>

<div class="slide-overlay" id="slide-overlay">
  <div class="slide-overlay-inner">
    <div class="slide-overlay-header">
      <h3 id="overlay-title">Slide Preview</h3>
      <button class="slide-overlay-close" id="overlay-close">ESC close</button>
    </div>
    <div class="slide-overlay-body">
      <iframe id="overlay-iframe" sandbox="allow-scripts"></iframe>
    </div>
  </div>
</div>

<script>
(function() {
  'use strict';

  // ─── STATE ─────────────────────────────────
  let files = [];
  let selectedFile = null;
  let slides = [];
  let buildStatus = null;
  let logEntries = [];
  let ws = null;

  const config = {
    theme: 'light',
    intensity: 'moderate',
    model: 'sonnet',
  };

  const STAGES = [
    { id: 'split',   name: 'Split',   key: 'S', color: 'var(--teal)',   desc: 'Break source into per-slide files' },
    { id: 'design',  name: 'Design',  key: 'D', color: 'var(--purple)', desc: 'Generate or load design system' },
    { id: 'compose', name: 'Compose', key: 'C', color: 'var(--red)',    desc: 'Claude assigns layout + color directives' },
    { id: 'render',  name: 'Render',  key: 'R', color: 'var(--green)',  desc: 'Produce HTML + PPTX output' },
  ];

  const ACTIONS = [
    { id: 'pipeline', name: 'Full Pipeline', key: 'P', color: 'var(--red)',   desc: 'Run all stages: split, design, compose, render' },
    { id: 'open',     name: 'Open HTML',     key: 'O', color: 'var(--teal)',  desc: 'Open rendered slideshow in browser' },
  ];

  const ACCENT_COLORS = ['var(--red)', 'var(--teal)', 'var(--green)', 'var(--amber)', 'var(--purple)'];

  // ─── API ───────────────────────────────────
  async function api(url) { return (await fetch(url)).json(); }
  async function apiPost(url, body) {
    return (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  }

  // ─── WEBSOCKET ─────────────────────────────
  function connectWS() {
    ws = new WebSocket('ws://' + location.host + '/ws');
    ws.onmessage = function(e) {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'log') {
          addLogEntry(msg.time, msg.status, msg.msg);
        } else if (msg.type === 'pipeline-done') {
          document.getElementById('pipeline-status').textContent = 'done';
          setAllStageStatus('success');
          setTimeout(() => { setAllStageStatus('idle'); }, 4000);
          refreshBuild();
        } else if (msg.type === 'pipeline-error') {
          document.getElementById('pipeline-status').textContent = 'error';
          setAllStageStatus('error');
          setTimeout(() => { setAllStageStatus('idle'); }, 4000);
        } else if (msg.type === 'pipeline-start') {
          document.getElementById('pipeline-status').textContent = 'running...';
          setAllStageStatus('running');
        }
      } catch {}
    };
    ws.onclose = function() { setTimeout(connectWS, 2000); };
  }

  function setAllStageStatus(status) {
    document.querySelectorAll('#tool-buttons .tool-btn-status, #action-buttons .tool-btn-status').forEach(el => {
      el.className = 'tool-btn-status ' + status;
    });
  }

  // ─── RENDER: FILE LIST ─────────────────────
  async function loadFiles() {
    files = await api('/api/files');
    renderFileList();
    if (files.length > 0 && !selectedFile) {
      selectFile(files[0].path);
    }
  }

  function renderFileList() {
    const list = document.getElementById('file-list');
    // Group by directory
    const groups = {};
    files.forEach(f => {
      const dir = f.path.includes('/') ? f.path.split('/').slice(0, -1).join('/') : '.';
      if (!groups[dir]) groups[dir] = [];
      groups[dir].push(f);
    });

    let html = '';
    for (const [dir, groupFiles] of Object.entries(groups)) {
      if (Object.keys(groups).length > 1) {
        html += '<li class="file-group-label">' + (dir === '.' ? 'root' : dir) + '</li>';
      }
      for (const f of groupFiles) {
        const sel = f.path === selectedFile ? ' selected' : '';
        html += '<li class="file-item' + sel + '" data-file="' + f.path + '">'
          + '<span class="file-name">' + f.name + '</span>'
          + '<span class="file-meta file-meta-slides">' + f.slides + ' slides</span>'
          + '<span class="file-meta">' + f.size + '</span>'
          + '</li>';
      }
    }
    list.innerHTML = html;
    document.getElementById('file-count').textContent = files.length + ' files';

    list.querySelectorAll('.file-item').forEach(el => {
      el.addEventListener('click', () => selectFile(el.dataset.file));
    });
  }

  async function selectFile(filePath) {
    selectedFile = filePath;
    renderFileList();
    await Promise.all([loadPreview(), refreshBuild()]);
  }

  // ─── RENDER: PREVIEW ──────────────────────
  async function loadPreview() {
    if (!selectedFile) return;
    slides = await api('/api/preview?file=' + encodeURIComponent(selectedFile));
    renderPreview();
  }

  function renderPreview() {
    const grid = document.getElementById('preview-grid');
    const badge = document.getElementById('preview-badge');
    if (!selectedFile) { badge.textContent = 'select a file'; grid.innerHTML = ''; return; }

    const name = selectedFile.split('/').pop();
    badge.textContent = name + ' \\u2014 ' + slides.length + ' slides';

    grid.innerHTML = slides.map((s, i) => {
      const isDark = s.bg && parseInt(s.bg.slice(0,2),16)*0.299 + parseInt(s.bg.slice(2,4),16)*0.587 + parseInt(s.bg.slice(4,6),16)*0.114 < 128;
      const bgClass = isDark ? ' dark-bg' : '';
      const bgStyle = s.bg ? ' style="background:#' + s.bg + '"' : '';
      const icons = (s.hasImage ? '<span title="image">img</span>' : '')
        + (s.hasVideo ? '<span title="video">vid</span>' : '')
        + (s.hasNotes ? '<span title="notes">n</span>' : '');

      const bodyText = s.bullets.length > 0
        ? '<ul class="preview-thumb-bullets">' + s.bullets.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>'
        : '<div class="preview-thumb-body">' + esc(s.body || s.subtitle) + '</div>';

      return '<div class="preview-thumb" data-slide="' + i + '">'
        + '<div class="preview-thumb-inner' + bgClass + '"' + bgStyle + '>'
        + '<span class="preview-thumb-num">' + s.num + '</span>'
        + '<div class="preview-thumb-title">' + esc(s.title) + '</div>'
        + bodyText
        + '<div class="preview-thumb-accent" style="background:' + ACCENT_COLORS[i % ACCENT_COLORS.length] + '"></div>'
        + '</div>'
        + '<div class="preview-thumb-layout"><span>' + s.layout + '</span>'
        + '<div class="preview-thumb-icons">' + icons + '</div></div>'
        + '</div>';
    }).join('');
  }

  // ─── RENDER: BUILD STATUS ─────────────────
  async function refreshBuild() {
    if (!selectedFile) return;
    buildStatus = await api('/api/build?file=' + encodeURIComponent(selectedFile));
    renderBuildBadges();
  }

  function renderBuildBadges() {
    const el = document.getElementById('build-badges');
    if (!buildStatus || !buildStatus.hasBuild) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'flex';
    el.innerHTML = ['split','design','compose','render'].map(s => {
      const done = buildStatus.stages[s] ? 'done' : 'pending';
      return '<span class="build-badge ' + done + '">' + s + '</span>';
    }).join('') +
    (buildStatus.hasHTML ? '<span class="build-badge done">html</span>' : '') +
    (buildStatus.hasPPTX ? '<span class="build-badge done">pptx</span>' : '');
  }

  // ─── RENDER: TOOL BUTTONS ─────────────────
  function renderToolButtons() {
    document.getElementById('tool-buttons').innerHTML = STAGES.map(t =>
      '<button class="tool-btn" data-stage="' + t.id + '" title="' + t.desc + '">'
      + '<div class="tool-btn-accent" style="background:' + t.color + '"></div>'
      + '<div class="tool-btn-icon" style="background:' + t.color + '">' + t.name[0] + '</div>'
      + '<div class="tool-btn-content">'
      + '<div class="tool-btn-name">' + t.name + ' <kbd>' + t.key + '</kbd></div>'
      + '<div class="tool-btn-desc">' + t.desc + '</div>'
      + '</div>'
      + '<div class="tool-btn-status idle" id="status-' + t.id + '"></div>'
      + '</button>'
    ).join('');

    document.getElementById('action-buttons').innerHTML = ACTIONS.map(t =>
      '<button class="tool-btn" data-action="' + t.id + '" title="' + t.desc + '">'
      + '<div class="tool-btn-accent" style="background:' + t.color + '"></div>'
      + '<div class="tool-btn-icon" style="background:' + t.color + '">' + t.name[0] + '</div>'
      + '<div class="tool-btn-content">'
      + '<div class="tool-btn-name">' + t.name + ' <kbd>' + t.key + '</kbd></div>'
      + '<div class="tool-btn-desc">' + t.desc + '</div>'
      + '</div>'
      + '<div class="tool-btn-status idle"></div>'
      + '</button>'
    ).join('');

    document.querySelectorAll('#tool-buttons .tool-btn').forEach(btn => {
      btn.addEventListener('click', () => runStage(btn.dataset.stage));
    });
    document.querySelectorAll('#action-buttons .tool-btn').forEach(btn => {
      btn.addEventListener('click', () => runAction(btn.dataset.action));
    });
  }

  // ─── PIPELINE CONTROL ─────────────────────
  async function runStage(stageId) {
    if (!selectedFile) return addLogEntry(time(), 'warn', 'No file selected');
    await apiPost('/api/pipeline', {
      file: selectedFile,
      from: stageId,
      to: stageId,
      theme: config.theme,
      intensity: config.intensity,
      model: config.model,
    });
  }

  async function runAction(actionId) {
    if (actionId === 'pipeline') {
      if (!selectedFile) return addLogEntry(time(), 'warn', 'No file selected');
      await apiPost('/api/pipeline', {
        file: selectedFile,
        theme: config.theme,
        intensity: config.intensity,
        model: config.model,
      });
    } else if (actionId === 'open') {
      if (!buildStatus) return;
      const base = selectedFile.replace(/\\.md$/, '');
      const dir = selectedFile.split('/').slice(0, -1).join('/');
      const name = selectedFile.split('/').pop().replace(/\\.md$/, '');
      // Try build dir first, then flat
      const candidates = [
        dir + '/' + name + '.build/' + name + '.html',
        base + '.html',
      ];
      for (const c of candidates) {
        try {
          const resp = await fetch('/' + c, { method: 'HEAD' });
          if (resp.ok) { window.open('/' + c, '_blank'); return; }
        } catch {}
      }
      addLogEntry(time(), 'warn', 'No HTML output found — run render first');
    }
  }

  // ─── RENDER: LOG ──────────────────────────
  function addLogEntry(timeStr, status, msg) {
    const panel = document.getElementById('log-panel');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = '<span class="log-time">' + timeStr + '</span>'
      + '<span class="log-status ' + status + '"></span>'
      + '<span class="log-msg">' + msg + '</span>';
    panel.insertBefore(entry, panel.firstChild);
    logEntries.push({ time: timeStr, status, msg });
    document.getElementById('log-count').textContent = logEntries.length + ' events';
  }

  function time() {
    const now = new Date();
    return [now.getHours(), now.getMinutes(), now.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
  }

  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ─── CONFIG TOGGLES ──────────────────────
  function initConfigToggles() {
    document.querySelectorAll('.tool-config-options').forEach(group => {
      group.querySelectorAll('.tool-config-opt').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.tool-config-opt').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          config[group.dataset.config] = btn.dataset.val;
          // Sync topbar
          const topbarEl = document.getElementById('set-' + group.dataset.config);
          if (topbarEl) topbarEl.textContent = btn.dataset.val;
        });
      });
    });

    document.querySelectorAll('.topbar-setting-value').forEach(el => {
      el.addEventListener('click', () => {
        const values = JSON.parse(el.dataset.values);
        let idx = (parseInt(el.dataset.index) + 1) % values.length;
        el.dataset.index = idx;
        el.textContent = values[idx];
        const key = el.id.replace('set-', '');
        config[key] = values[idx];
        // Sync config panel
        const group = document.querySelector('.tool-config-options[data-config="' + key + '"]');
        if (group) {
          group.querySelectorAll('.tool-config-opt').forEach(b => {
            b.classList.toggle('active', b.dataset.val === values[idx]);
          });
        }
      });
    });
  }

  // ─── KEYBOARD SHORTCUTS ────────────────────
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = e.key.toLowerCase();

    if (key === 'escape') {
      document.getElementById('slide-overlay').classList.remove('visible');
      return;
    }

    const stageMap = { s: 'split', d: 'design', c: 'compose', r: 'render' };
    if (stageMap[key] && !e.metaKey && !e.ctrlKey) { e.preventDefault(); runStage(stageMap[key]); return; }
    if (key === 'p' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); runAction('pipeline'); return; }
    if (key === 'o' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); runAction('open'); return; }

    // Arrow keys for file navigation
    if ((key === 'arrowdown' || key === 'arrowup') && files.length > 0) {
      e.preventDefault();
      const idx = files.findIndex(f => f.path === selectedFile);
      const newIdx = key === 'arrowdown' ? Math.min(idx + 1, files.length - 1) : Math.max(idx - 1, 0);
      selectFile(files[newIdx].path);
    }
  });

  // ─── OVERLAY ──────────────────────────────
  document.getElementById('overlay-close').addEventListener('click', () => {
    document.getElementById('slide-overlay').classList.remove('visible');
  });

  // ─── INIT ─────────────────────────────────
  renderToolButtons();
  initConfigToggles();
  connectWS();
  loadFiles().then(() => {
    addLogEntry(time(), 'info', 'Dashboard loaded \\u2014 ' + files.length + ' files found');
  });

})();
</script>

</body>
</html>`;
}

// ═══════════════════════════════════════════════════════
// GALLERY HTML
// ═══════════════════════════════════════════════════════

function getGalleryHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>rastersysteme — gallery</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Fira+Code:wght@400;500;600&family=Syne:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #F8F5F0; --bg-panel: #FFFFFF; --bg-inset: #F0ECE6; --bg-terminal: #1A1714;
  --bg-hover: #EDE9E3; --bg-selected: #E8E3DB;
  --border: #D8D3CB; --border-light: #E8E4DD; --grid-line: rgba(180,172,158,0.18);
  --text: #1A1714; --text-mid: #5C564D; --text-light: #918A7E; --text-inverse: #F0EBE3;
  --red: #B7311A; --teal: #1B5E80; --green: #2B7038; --amber: #876512; --purple: #6B4FA0;
  --font-heading: 'Syne', sans-serif; --font-body: 'DM Sans', sans-serif; --font-data: 'Fira Code', monospace;
  --topbar-h: 52px; --radius: 3px;
}
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
html, body { height:100%; font-family:var(--font-body); font-size:14px; color:var(--text); background:var(--bg); -webkit-font-smoothing:antialiased; }

/* Topbar */
.topbar { height:var(--topbar-h); background:var(--text); color:var(--text-inverse); display:flex; align-items:center; padding:0 24px; gap:16px; user-select:none; position:sticky; top:0; z-index:100; }
.topbar-brand { display:flex; align-items:center; gap:10px; font-family:var(--font-heading); font-weight:700; font-size:15px; }
.topbar-brand .square { width:16px; height:16px; background:var(--red); }
.topbar-sep { width:1px; height:24px; background:rgba(255,255,255,0.15); }
.topbar a { color:rgba(255,255,255,0.6); text-decoration:none; font-size:13px; transition:color 0.15s; }
.topbar a:hover { color:rgba(255,255,255,0.9); }
.topbar a.active { color:white; border-bottom:2px solid var(--red); padding-bottom:2px; }
.topbar-right { margin-left:auto; display:flex; gap:12px; align-items:center; }
.topbar-stat { font-family:var(--font-data); font-size:11px; color:rgba(255,255,255,0.4); }
.topbar-stat b { color:rgba(255,255,255,0.75); }

/* Filter bar */
.filters { display:flex; gap:6px; padding:16px 24px 0; flex-wrap:wrap; align-items:center; }
.filter-btn { font-family:var(--font-data); font-size:11px; padding:4px 12px; border:1px solid var(--border); border-radius:2px; background:var(--bg-panel); cursor:pointer; color:var(--text-mid); transition:all 0.12s; }
.filter-btn:hover { border-color:var(--text-light); }
.filter-btn.active { background:var(--text); color:var(--text-inverse); border-color:var(--text); }
.filter-count { font-family:var(--font-data); font-size:10px; color:var(--text-light); margin-left:2px; }
.filter-sep { width:1px; height:20px; background:var(--border); margin:0 6px; }
.search-input { font-family:var(--font-data); font-size:12px; padding:4px 12px; border:1px solid var(--border); border-radius:2px; background:var(--bg-panel); color:var(--text); width:200px; outline:none; }
.search-input:focus { border-color:var(--text-light); }

/* Grid */
.gallery { display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px; padding:16px 24px 40px; }

/* Card */
.card { background:var(--bg-panel); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; cursor:pointer; transition:border-color 0.15s, box-shadow 0.2s, transform 0.15s; display:flex; flex-direction:column; }
.card:hover { border-color:var(--text-light); box-shadow:0 4px 16px rgba(0,0,0,0.08); transform:translateY(-1px); }
.card-preview { height:180px; position:relative; overflow:hidden; background:var(--bg-inset); border-bottom:1px solid var(--border-light); }
.card-preview iframe { width:1600px; height:900px; border:none; transform-origin:0 0; transform:scale(0.2); pointer-events:none; position:absolute; top:0; left:0; }
.card-preview-overlay { position:absolute; inset:0; }
.card-type { position:absolute; top:8px; right:8px; font-family:var(--font-data); font-size:9px; text-transform:uppercase; letter-spacing:0.08em; padding:2px 6px; border-radius:2px; z-index:2; }
.card-type.deck    { background:var(--red); color:white; }
.card-type.review  { background:var(--amber); color:white; }
.card-type.studio  { background:var(--purple); color:white; }
.card-type.compare { background:var(--teal); color:white; }
.card-type.qa      { background:var(--green); color:white; }
.card-type.grid    { background:var(--text-light); color:white; }
.card-type.reveal  { background:var(--text-mid); color:white; }
.card-type.diff    { background:var(--amber); color:white; }
.card-type.spliced { background:var(--text-light); color:white; }
.card-info { padding:12px 14px; display:flex; flex-direction:column; gap:4px; }
.card-name { font-family:var(--font-heading); font-weight:600; font-size:14px; color:var(--text); }
.card-title { font-size:12px; color:var(--text-mid); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.card-meta { display:flex; gap:10px; margin-top:4px; }
.card-meta span { font-family:var(--font-data); font-size:11px; color:var(--text-light); }
.card-meta .slides-badge { background:var(--bg-inset); border:1px solid var(--border-light); padding:0 6px; border-radius:2px; }
.card-meta .theme-dot { width:10px; height:10px; border-radius:50%; border:1px solid var(--border); display:inline-block; vertical-align:middle; margin-right:2px; }

/* Compare card */
.card-compare { background:var(--bg-panel); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; cursor:default; }
.card-compare-header { padding:12px 14px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center; }
.card-compare-title { font-family:var(--font-heading); font-weight:600; font-size:13px; }
.card-compare-date { font-family:var(--font-data); font-size:11px; color:var(--text-light); }
.card-compare-variants { display:flex; gap:1px; }
.card-compare-variant { flex:1; padding:8px 10px; background:var(--bg-inset); cursor:pointer; transition:background 0.1s; text-align:center; }
.card-compare-variant:hover { background:var(--bg-hover); }
.card-compare-variant span { font-family:var(--font-data); font-size:11px; color:var(--text-mid); display:block; }

/* Viewer overlay */
.viewer { display:none; position:fixed; inset:0; z-index:200; background:rgba(0,0,0,0.85); flex-direction:column; }
.viewer.open { display:flex; }
.viewer-bar { height:48px; background:var(--text); display:flex; align-items:center; padding:0 20px; gap:16px; flex-shrink:0; }
.viewer-bar-title { font-family:var(--font-heading); font-weight:600; font-size:14px; color:var(--text-inverse); flex:1; }
.viewer-bar a, .viewer-bar button { font-family:var(--font-data); font-size:11px; color:rgba(255,255,255,0.6); background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); padding:4px 12px; border-radius:2px; cursor:pointer; text-decoration:none; transition:all 0.15s; }
.viewer-bar a:hover, .viewer-bar button:hover { background:rgba(255,255,255,0.15); color:white; }
.viewer-body { flex:1; }
.viewer-body iframe { width:100%; height:100%; border:none; }

/* Section headers */
.section-header { padding:20px 24px 8px; display:flex; align-items:baseline; gap:10px; }
.section-title { font-family:var(--font-heading); font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:var(--text); }
.section-count { font-family:var(--font-data); font-size:11px; color:var(--text-light); }

/* Empty state */
.empty { padding:60px 24px; text-align:center; color:var(--text-light); font-size:14px; }
</style>
</head>
<body>

<header class="topbar">
  <div class="topbar-brand"><span class="square"></span> rastersysteme</div>
  <div class="topbar-sep"></div>
  <a href="/">Pipeline</a>
  <a href="/gallery" class="active">Gallery</a>
  <div class="topbar-right">
    <span class="topbar-stat" id="total-stat"></span>
  </div>
</header>

<div class="filters" id="filters"></div>
<div id="content"></div>

<div class="viewer" id="viewer">
  <div class="viewer-bar">
    <span class="viewer-bar-title" id="viewer-title"></span>
    <a id="viewer-newtab" href="#" target="_blank">open in tab</a>
    <button onclick="closeViewer()">ESC close</button>
  </div>
  <div class="viewer-body">
    <iframe id="viewer-iframe" sandbox="allow-scripts"></iframe>
  </div>
</div>

<script>
(function(){
  'use strict';

  let allDecks = [];
  let activeType = 'all';
  let searchQuery = '';

  const TYPE_ORDER = ['deck','studio','review','qa','grid','reveal','diff','spliced','compare'];
  const TYPE_LABELS = { deck:'Decks', studio:'Studio', review:'Review', qa:'QA', grid:'Grid', reveal:'Reveal', diff:'Diff', spliced:'Spliced', compare:'Compare Runs' };

  async function load() {
    allDecks = await (await fetch('/api/decks')).json();
    const stat = document.getElementById('total-stat');
    const deckCount = allDecks.filter(d => d.type !== 'compare').length;
    const compareCount = allDecks.filter(d => d.type === 'compare').length;
    stat.innerHTML = '<b>' + deckCount + '</b> decks, <b>' + compareCount + '</b> compare runs';
    renderFilters();
    renderGallery();
  }

  function renderFilters() {
    const counts = {};
    allDecks.forEach(d => { counts[d.type] = (counts[d.type] || 0) + 1; });

    const el = document.getElementById('filters');
    let html = '<button class="filter-btn' + (activeType === 'all' ? ' active' : '') + '" data-type="all">All<span class="filter-count">' + allDecks.length + '</span></button>';
    TYPE_ORDER.forEach(t => {
      if (!counts[t]) return;
      html += '<button class="filter-btn' + (activeType === t ? ' active' : '') + '" data-type="' + t + '">' + (TYPE_LABELS[t] || t) + '<span class="filter-count">' + counts[t] + '</span></button>';
    });
    html += '<div class="filter-sep"></div>';
    html += '<input class="search-input" placeholder="Search decks..." value="' + esc(searchQuery) + '" id="search-input">';
    el.innerHTML = html;

    el.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => { activeType = btn.dataset.type; renderFilters(); renderGallery(); });
    });
    document.getElementById('search-input').addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      renderGallery();
    });
  }

  function renderGallery() {
    const filtered = allDecks.filter(d => {
      if (activeType !== 'all' && d.type !== activeType) return false;
      if (searchQuery) {
        const haystack = ((d.name || '') + ' ' + (d.firstTitle || '') + ' ' + (d.path || '')).toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      document.getElementById('content').innerHTML = '<div class="empty">No decks match the current filter.</div>';
      return;
    }

    // Group: regular decks vs compare runs
    const regular = filtered.filter(d => d.type !== 'compare');
    const compares = filtered.filter(d => d.type === 'compare');

    let html = '';

    if (regular.length > 0) {
      // Group by category
      const byCategory = {};
      regular.forEach(d => {
        const cat = d.category || 'other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(d);
      });

      for (const [cat, decks] of Object.entries(byCategory)) {
        html += '<div class="section-header"><span class="section-title">' + esc(cat) + '</span><span class="section-count">' + decks.length + '</span></div>';
        html += '<div class="gallery">';
        decks.forEach(d => {
          const themeDot = d.theme === 'dark'
            ? '<span class="theme-dot" style="background:#1A1714"></span>'
            : '<span class="theme-dot" style="background:#F8F5F0"></span>';
          html += '<div class="card" data-path="' + esc(d.path) + '" data-name="' + esc(d.name) + '">'
            + '<div class="card-preview">'
            + '<iframe src="/' + esc(d.path) + '" loading="lazy" tabindex="-1"></iframe>'
            + '<div class="card-preview-overlay"></div>'
            + '<span class="card-type ' + d.type + '">' + d.type + '</span>'
            + '</div>'
            + '<div class="card-info">'
            + '<div class="card-name">' + esc(d.name) + '</div>'
            + (d.firstTitle ? '<div class="card-title">' + esc(d.firstTitle) + '</div>' : '')
            + '<div class="card-meta">'
            + '<span class="slides-badge">' + d.slides + ' slides</span>'
            + '<span>' + themeDot + d.theme + '</span>'
            + '<span>' + d.size + '</span>'
            + '<span>' + formatDate(d.modified) + '</span>'
            + '</div></div></div>';
        });
        html += '</div>';
      }
    }

    if (compares.length > 0) {
      html += '<div class="section-header"><span class="section-title">Compare Runs</span><span class="section-count">' + compares.length + '</span></div>';
      html += '<div class="gallery">';
      compares.forEach(d => {
        html += '<div class="card-compare">'
          + '<div class="card-compare-header">'
          + '<span class="card-compare-title">' + esc(d.name.replace('compare-', '').replace(/-\\d{4}.*/, '')) + '</span>'
          + '<span class="card-compare-date">' + esc(d.date) + '</span>'
          + '</div>'
          + '<div class="card-compare-variants">';
        d.variants.forEach(v => {
          html += '<div class="card-compare-variant" data-path="' + esc(v.path) + '" data-name="' + esc(d.name + '/' + v.variant) + '">'
            + '<span>' + esc(v.variant) + '</span></div>';
        });
        html += '</div></div>';
      });
      html += '</div>';
    }

    document.getElementById('content').innerHTML = html;

    // Click handlers
    document.querySelectorAll('.card[data-path]').forEach(el => {
      el.addEventListener('click', () => openViewer(el.dataset.path, el.dataset.name));
    });
    document.querySelectorAll('.card-compare-variant[data-path]').forEach(el => {
      el.addEventListener('click', () => openViewer(el.dataset.path, el.dataset.name));
    });
  }

  function openViewer(deckPath, name) {
    const viewer = document.getElementById('viewer');
    viewer.classList.add('open');
    document.getElementById('viewer-title').textContent = name;
    document.getElementById('viewer-iframe').src = '/' + deckPath;
    document.getElementById('viewer-newtab').href = '/' + deckPath;
  }

  window.closeViewer = function() {
    const viewer = document.getElementById('viewer');
    viewer.classList.remove('open');
    document.getElementById('viewer-iframe').src = 'about:blank';
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeViewer();
  });

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    return m + ' ' + d.getDate();
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  load();
})();
</script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  server.listen(PORT, () => {
    console.log("");
    console.log(`  ${accent("\\u25A0")} ${chalk.white.bold("rastersysteme")} ${dim("web ui")}`);
    console.log(`  ${dim("Server:")} ${teal(`http://localhost:${PORT}`)}`);
    console.log(`  ${dim("API:")}    ${teal(`http://localhost:${PORT}/api/files`)}`);
    console.log("");

    // Open in browser
    const { execSync } = require("child_process");
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    try { execSync(`${cmd} http://localhost:${PORT}`, { stdio: "ignore" }); } catch {}
  });
}

module.exports = { server, getDashboardHTML };
