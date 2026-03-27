#!/usr/bin/env node
/**
 * run-rubric-eval.js — helper script to evaluate a deck with rubric-headless
 *
 * Starts a temporary HTTP server to serve the HTML file, then runs rubric-headless
 * against it, and cleans up.
 *
 * Usage:
 *   node run-rubric-eval.js <deck.html> [--json] [--refine] [--max N]
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const chalk = require('chalk');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node run-rubric-eval.js <deck.html> [--json] [--refine] [--max N]');
  process.exit(1);
}

const deckPath = args[0];
const deckDir = path.dirname(deckPath);
const projectRoot = path.resolve(__dirname);

// Verify file exists
if (!fs.existsSync(deckPath)) {
  console.error(`Error: File not found: ${deckPath}`);
  process.exit(1);
}

// Start HTTP server on available port
function startServer(port = 8701) {
  const server = http.createServer((req, res) => {
    // Serve files from project root
    let filePath = path.join(projectRoot, req.url);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      res.writeHead(400);
      res.end('Directory listing not supported');
      return;
    }

    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    };

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.listen(port, 'localhost', () => {
      resolve({ server, port });
    });
    server.on('error', reject);
  });
}

async function main() {
  const dim = chalk.dim;
  const teal = chalk.cyan;

  console.log(`\n${chalk.yellow('Starting HTTP server...')}`);

  let serverInfo;
  try {
    serverInfo = await startServer(8701);
  } catch (e) {
    // If 8701 is busy, try another port
    serverInfo = await startServer(8702);
  }

  const port = serverInfo.port;
  console.log(`${teal(`✓ Server running on http://localhost:${port}`)}`);

  // Run rubric-headless with the port
  const rubricArgs = [
    'rubric-headless.js',
    deckPath,
    ...args.slice(1)
  ];

  console.log(`\n${chalk.yellow('Running rubric evaluation...')}\n`);

  return new Promise((resolve) => {
    const child = spawn('node', rubricArgs, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        RUBRIC_PORT: port
      }
    });

    child.on('close', (code) => {
      console.log(`\n${chalk.yellow('Cleaning up...')}`);
      serverInfo.server.close();
      console.log(`${teal('✓ Server stopped')}\n`);
      process.exit(code);
    });

    child.on('error', (err) => {
      console.error('Error running rubric-headless:', err);
      serverInfo.server.close();
      process.exit(1);
    });
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
