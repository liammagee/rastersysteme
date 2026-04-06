#!/usr/bin/env node
/**
 * Refresh the Google Slides OAuth token.
 * Falls back to interactive browser auth if refresh fails.
 */
const fs = require("fs");
const http = require("http");
const { google } = require("googleapis");

const credPath = process.argv[2] || "/Users/lmagee/Dev/youtube-playlist/client_secret.json";
const tokenPath = ".gslides-token.json";

const SCOPES = [
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/drive.file",
];

async function main() {
  const raw = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  const creds = raw.installed || raw.web;
  const oauth2 = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    "http://localhost:3847/oauth2callback"
  );

  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
    oauth2.setCredentials(token);
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);
      fs.writeFileSync(tokenPath, JSON.stringify(credentials, null, 2));
      console.log("Token refreshed successfully. Expires:", new Date(credentials.expiry_date).toISOString());
      return;
    } catch (err) {
      console.log("Refresh failed:", err.message, "— starting interactive auth...");
    }
  }

  // Interactive auth
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\nOpen this URL in your browser to authorize:\n");
  console.log(authUrl, "\n");

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost:3847");
      const c = url.searchParams.get("code");
      if (c) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Authorized! You can close this tab.</h2>");
        server.close();
        resolve(c);
      } else {
        res.writeHead(400);
        res.end("Missing code");
      }
    });
    server.listen(3847, () => {
      const { exec } = require("child_process");
      exec(`open "${authUrl}"`);
    });
    setTimeout(() => { server.close(); reject(new Error("Timeout")); }, 120000);
  });

  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  console.log("New token saved. Expires:", new Date(tokens.expiry_date).toISOString());
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
