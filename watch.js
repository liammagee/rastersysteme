#!/usr/bin/env node
/**
 * watch — hot-reload for rastersysteme
 *
 * Watches a .composed.md (or .md) file for changes, re-renders HTML on save,
 * and auto-refreshes the browser via an injected WebSocket.
 *
 * Usage:
 *   node watch.js <input.md> [options]
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const chalk = require("chalk");
const { generateHTML } = require("./raster.js");

const dim = chalk.gray;
const accent = chalk.hex("#C44230");
const teal = chalk.hex("#2C7A92");
const sage = chalk.hex("#548C5A");
const amber = chalk.hex("#C79B38");

// ═══════════════════════════════════════════════════════
// WEBSOCKET SERVER — minimal, no dependencies
// ═══════════════════════════════════════════════════════

function createWSServer(httpServer) {
  const crypto = require("crypto");
  const clients = new Set();

  httpServer.on("upgrade", (req, socket) => {
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

    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => clients.delete(socket));
  });

  return {
    send(msg) {
      const data = Buffer.from(msg);
      const frame = Buffer.alloc(2 + data.length);
      frame[0] = 0x81; // text frame
      frame[1] = data.length;
      data.copy(frame, 2);
      for (const client of clients) {
        try { client.write(frame); } catch {}
      }
    },
    count() { return clients.size; },
  };
}

// ═══════════════════════════════════════════════════════
// FILE SERVER — serves HTML + injects reload script
// ═══════════════════════════════════════════════════════

function createServer(rootDir, port, wsPort) {
  const mimeTypes = {
    ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
    ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
    ".json": "application/json", ".md": "text/plain",
  };

  const reloadScript = `<script>
(function(){
  var ws;
  function connect(){
    ws=new WebSocket('ws://localhost:${wsPort}');
    ws.onmessage=function(e){if(e.data==='reload')location.reload()};
    ws.onclose=function(){setTimeout(connect,1000)};
  }
  connect();
})();
</script>`;

  const server = http.createServer((req, res) => {
    let filePath = path.join(rootDir, decodeURIComponent(req.url));
    if (filePath.endsWith("/")) filePath += "index.html";

    const ext = path.extname(filePath);
    const mime = mimeTypes[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      // Inject reload script into HTML files
      if (ext === ".html") {
        data = data.toString().replace("</body>", reloadScript + "</body>");
      }

      res.writeHead(200, { "Content-Type": mime });
      res.end(data);
    });
  });

  return server;
}

// ═══════════════════════════════════════════════════════
// WATCHER — debounced file watcher + renderer
// ═══════════════════════════════════════════════════════

async function watch(inputPath, options = {}) {
  const theme = options.theme || "light";
  const port = options.port || 8800;
  const wsPort = port + 1;
  const rootDir = path.dirname(path.resolve(inputPath));
  const base = path.basename(inputPath, ".md").replace(".composed", "");
  const htmlFile = `${base}.html`;
  const htmlPath = path.join(rootDir, htmlFile);

  // Initial render
  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("watch")}\n`);
  process.stderr.write(`  ${dim("Source:")} ${teal(path.basename(inputPath))}\n`);
  process.stderr.write(`  ${dim("Output:")} ${teal(htmlFile)}\n`);
  process.stderr.write(`  ${dim("Server:")} ${teal(`http://localhost:${port}/${htmlFile}`)}\n`);
  process.stderr.write(`\n`);

  let renderCount = 0;

  async function render() {
    const start = Date.now();
    try {
      await generateHTML(inputPath, htmlPath, { theme, transition: options.transition });
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      renderCount++;
      process.stderr.write(`  ${sage("✓")} Render #${renderCount} ${amber(elapsed + "s")} ${dim(new Date().toLocaleTimeString())}\n`);
      return true;
    } catch (err) {
      process.stderr.write(`  ${accent("✗")} ${err.message}\n`);
      return false;
    }
  }

  await render();

  // Start servers
  const httpServer = createServer(rootDir, port, wsPort);
  httpServer.listen(port);

  const wsServer = http.createServer();
  const ws = createWSServer(wsServer);
  wsServer.listen(wsPort);

  process.stderr.write(`  ${dim("Watching for changes... (Ctrl+C to stop)")}\n\n`);

  // Open browser
  const { execSync } = require("child_process");
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try { execSync(`${cmd} http://localhost:${port}/${htmlFile}`, { stdio: "ignore" }); } catch {}

  // Watch for changes with debounce
  let debounceTimer = null;
  const watchPath = path.resolve(inputPath);

  fs.watch(watchPath, { persistent: true }, (eventType) => {
    if (eventType !== "change") return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const ok = await render();
      if (ok) ws.send("reload");
    }, 300);
  });

  // Also watch the directory for new files (if watching a .composed.md that gets regenerated)
  fs.watch(rootDir, { persistent: true }, (eventType, filename) => {
    if (filename !== path.basename(inputPath)) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const ok = await render();
      if (ok) ws.send("reload");
    }, 300);
  });

  // Keep alive
  process.on("SIGINT", () => {
    process.stderr.write(`\n  ${dim("Stopped after")} ${renderCount} ${dim("renders")}\n`);
    process.exit(0);
  });
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  watch — hot-reload for rastersysteme

  Watches a markdown file, re-renders HTML on save, auto-refreshes browser.

  Usage:
    node watch.js <input.md> [options]

  Options:
    --theme <name>       Theme: light (default), dark, red, blue
    --port <n>           Server port (default: 8800)
    --transition <name>  Slide transition (default: fade)
    --help               Show this help

  Examples:
    node watch.js decks/week-1.md
    node watch.js decks/week-1.composed.md --theme dark
    node watch.js decks/week-1.md --port 9000 --transition slide-left
    `);
    process.exit(0);
  }

  const input = args[0];
  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  if (!fs.existsSync(input)) {
    console.error(`Error: file not found: ${input}`);
    process.exit(1);
  }

  watch(input, {
    theme: getFlag("--theme") || "light",
    port: parseInt(getFlag("--port") || "8800"),
    transition: getFlag("--transition"),
  });
}

module.exports = { watch };
