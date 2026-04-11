#!/usr/bin/env node
/**
 * serve-lan.js — serve project files on all network interfaces
 *
 * Usage: node serve-lan.js [port]
 * Default port: 8801
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = parseInt(process.argv[2]) || 8801;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp4": "video/mp4",
};

// ============================================================
// ROLEPLAY ROOM SYNC (in-memory, ephemeral)
// ============================================================

const rooms = {};
// rooms["room-1"] = { scenarioId, messages: [{id, sender, name, text, color}], lastId }

// Persist dialogues to disk for review
const DIALOGUE_DIR = path.join(__dirname, "dialogues");
if (!fs.existsSync(DIALOGUE_DIR)) fs.mkdirSync(DIALOGUE_DIR);

function persistRoom(roomId) {
  const room = rooms[roomId];
  if (!room || room.messages.length === 0) return;
  const filename = roomId + "_" + (room.scenarioId || "unknown") + ".json";
  const filePath = path.join(DIALOGUE_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify({
    roomId: roomId,
    scenarioId: room.scenarioId,
    messageCount: room.messages.length,
    exportedAt: new Date().toISOString(),
    messages: room.messages,
  }, null, 2));
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function handleRoleplayAPI(req, res, urlPath, query) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return true;
  }

  // POST /api/workshop/roleplay/message
  if (urlPath === "/api/workshop/roleplay/message" && req.method === "POST") {
    readBody(req).then((data) => {
      const { roomId, scenarioId, messages } = data;
      if (!roomId || !messages || !Array.isArray(messages)) {
        res.writeHead(400, { ...corsHeaders(), "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "roomId and messages[] required" }));
        return;
      }
      if (!rooms[roomId]) {
        rooms[roomId] = { scenarioId: scenarioId || "", messages: [], lastId: 0 };
      }
      const room = rooms[roomId];
      // Update scenarioId if provided and room was auto-created without one
      if (scenarioId && !room.scenarioId) room.scenarioId = scenarioId;
      for (const msg of messages) {
        room.lastId++;
        room.messages.push({ ...msg, id: room.lastId, streaming: false });
      }
      // Trim to last 500 messages per room
      if (room.messages.length > 500) {
        room.messages = room.messages.slice(-500);
      }
      // Persist to disk for review
      persistRoom(roomId);
      res.writeHead(200, { ...corsHeaders(), "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, lastId: room.lastId }));
    }).catch((err) => {
      res.writeHead(400, { ...corsHeaders(), "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    });
    return true;
  }

  // GET /api/workshop/roleplay/poll?roomId=X&after=N
  if (urlPath === "/api/workshop/roleplay/poll" && req.method === "GET") {
    const roomId = query.roomId || query.roomid;
    const after = parseInt(query.after) || 0;
    if (!roomId) {
      res.writeHead(400, { ...corsHeaders(), "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "roomId required" }));
      return true;
    }
    // Auto-create room on first poll
    if (!rooms[roomId]) {
      rooms[roomId] = { scenarioId: query.scenarioId || "", messages: [], lastId: 0 };
    }
    const room = rooms[roomId];
    const newMessages = room.messages.filter((m) => m.id > after);
    res.writeHead(200, { ...corsHeaders(), "Content-Type": "application/json" });
    res.end(JSON.stringify({ messages: newMessages, lastId: room.lastId }));
    return true;
  }

  // GET /api/workshop/roleplay/rooms — list active rooms (for instructor)
  if (urlPath === "/api/workshop/roleplay/rooms" && req.method === "GET") {
    const summary = Object.entries(rooms).map(([id, room]) => ({
      roomId: id,
      scenarioId: room.scenarioId,
      messageCount: room.messages.length,
      lastId: room.lastId,
    }));
    res.writeHead(200, { ...corsHeaders(), "Content-Type": "application/json" });
    res.end(JSON.stringify({ rooms: summary }));
    return true;
  }

  return false; // not handled
}

const server = http.createServer((req, res) => {
  const fullUrl = req.url;
  const [urlPath, queryString] = fullUrl.split("?");
  const decodedPath = decodeURIComponent(urlPath);

  // Parse query params
  const query = {};
  if (queryString) {
    queryString.split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k) query[k] = decodeURIComponent(v || "");
    });
  }

  // Try roleplay API first
  if (decodedPath.startsWith("/api/workshop/roleplay")) {
    if (handleRoleplayAPI(req, res, decodedPath, query)) return;
  }

  // Static file serving
  let filePath = path.join(ROOT, decodedPath);

  // Directory → index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";

  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": stat.size,
    "Cache-Control": "no-cache",
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  const ifaces = Object.values(os.networkInterfaces()).flat().filter(i => i.family === "IPv4" && !i.internal);
  const lanIP = ifaces.length ? ifaces[0].address : "unknown";

  console.log("");
  console.log("  Serving on LAN:");
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${lanIP}:${PORT}`);
  console.log("");
  console.log("  Workshop page:");
  console.log(`  http://${lanIP}:${PORT}/pages/talking-to-machines.html`);
  console.log("");
  console.log("  Roleplay rooms (multi-device sync active):");
  console.log(`  POST http://${lanIP}:${PORT}/api/workshop/roleplay/message`);
  console.log(`  GET  http://${lanIP}:${PORT}/api/workshop/roleplay/poll?roomId=X&after=0`);
  console.log(`  GET  http://${lanIP}:${PORT}/api/workshop/roleplay/rooms`);
  console.log("");
});
