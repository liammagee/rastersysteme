#!/usr/bin/env node
/**
 * Upload generated images as atmospheric backgrounds to a Google Slides presentation.
 * Uses existing images in a directory, matched by slide number.
 *
 * Usage:
 *   node gslides-upload-batch.js <presentation-id> --images <dir> [--slides <range>] [--opacity <n>]
 */
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const EMU_PER_INCH = 914400;
const SLIDE_WIDTH_EMU = 10 * EMU_PER_INCH;
const SLIDE_HEIGHT_EMU = 5.625 * EMU_PER_INCH;

function parseRange(s) {
  if (!s) return null;
  const nums = new Set();
  for (const p of s.split(",")) {
    if (p.includes("-")) {
      const [a, b] = p.trim().split("-").map(Number);
      for (let i = a; i <= b; i++) nums.add(i);
    } else {
      nums.add(Number(p.trim()));
    }
  }
  return nums;
}

function extractPresentationId(urlOrId) {
  const match = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : urlOrId;
}

function rgbToHex(rgb) {
  if (!rgb) return null;
  return [rgb.red || 0, rgb.green || 0, rgb.blue || 0]
    .map(c => Math.round(c * 255).toString(16).padStart(2, "0"))
    .join("");
}

async function bakeOpacity(srcPath, outPath, bgHex, opacity) {
  // Use Puppeteer for canvas compositing (no native canvas module)
  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const imgBuf = fs.readFileSync(srcPath);
  const b64 = imgBuf.toString("base64");
  const bg = hexToRgb(bgHex);

  await page.setContent(`<canvas id="c"></canvas><script>
    const img = new Image();
    img.onload = () => {
      const c = document.getElementById("c");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = "rgba(${bg.r},${bg.g},${bg.b},${opacity})";
      ctx.fillRect(0, 0, c.width, c.height);
      window.__done = c.toDataURL("image/png");
    };
    img.src = "data:image/png;base64,${b64}";
  </script>`);

  await page.waitForFunction("window.__done", { timeout: 30000 });
  const dataUrl = await page.evaluate(() => window.__done);
  const buf = Buffer.from(dataUrl.split(",")[1], "base64");
  fs.writeFileSync(outPath, buf);
  await browser.close();
  return outPath;
}

function hexToRgb(hex) {
  hex = (hex || "F8F5F0").replace(/^#/, "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith("--"));
  const getOpt = (flag) => { const i = args.indexOf(flag); return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined; };

  if (!input) {
    console.log("Usage: node gslides-upload-batch.js <presentation-id-or-url> --images <dir> [--slides <range>] [--opacity <n>]");
    process.exit(1);
  }

  const presentationId = extractPresentationId(input);
  const imagesDir = getOpt("--images") || "decks/gslides-1TimgHnV-images/gslides-imagine-temp-images";
  const slideRange = parseRange(getOpt("--slides"));
  const opacity = parseFloat(getOpt("--opacity") || "0.75");

  console.log(`Presentation: ${presentationId}`);
  console.log(`Images dir: ${imagesDir}`);
  console.log(`Opacity bake: ${opacity}`);

  // Auth
  const credPath = "/Users/lmagee/Dev/youtube-playlist/client_secret.json";
  const tokenPath = ".gslides-token.json";
  const raw = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  const creds = raw.installed || raw.web;
  const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, "http://localhost:3847/oauth2callback");
  oauth2.setCredentials(JSON.parse(fs.readFileSync(tokenPath, "utf-8")));

  // Read presentation
  const slidesApi = google.slides({ version: "v1", auth: oauth2 });
  const driveApi = google.drive({ version: "v3", auth: oauth2 });
  const pres = await slidesApi.presentations.get({ presentationId });
  const slides = pres.data.slides;
  console.log(`Slides in presentation: ${slides.length}`);

  // Preprocess directory
  const preprocessDir = path.join(imagesDir, "preprocessed-upload");
  if (!fs.existsSync(preprocessDir)) fs.mkdirSync(preprocessDir, { recursive: true });

  const requests = [];
  let uploaded = 0;

  for (let i = 0; i < slides.length; i++) {
    const slideNum = i + 1;
    if (slideRange && !slideRange.has(slideNum)) continue;

    const num = String(slideNum).padStart(2, "0");
    const srcPath = path.join(imagesDir, `slide-${num}.png`);
    if (!fs.existsSync(srcPath)) {
      console.log(`  S${slideNum}: no image (slide-${num}.png)`);
      continue;
    }

    // Get background color
    const bgRgb = slides[i].pageProperties?.pageBackgroundFill?.solidFill?.color?.rgbColor;
    const bgHex = rgbToHex(bgRgb) || "F8F5F0";

    // Bake opacity
    const outPath = path.join(preprocessDir, `slide-${num}.png`);
    console.log(`  S${slideNum}: baking opacity ${opacity} on #${bgHex}...`);
    await bakeOpacity(srcPath, outPath, bgHex, opacity);

    // Upload to Drive
    console.log(`  S${slideNum}: uploading to Drive...`);
    const res = await driveApi.files.create({
      requestBody: { name: `week3-slide-${num}-bg.png`, mimeType: "image/png" },
      media: { mimeType: "image/png", body: fs.createReadStream(outPath) },
      fields: "id",
    });
    await driveApi.permissions.create({
      fileId: res.data.id,
      requestBody: { role: "reader", type: "anyone" },
    });

    const imageUrl = `https://drive.google.com/uc?id=${res.data.id}`;
    const imageId = `bg_${Date.now()}_${i}`;

    requests.push({
      createImage: {
        objectId: imageId,
        url: imageUrl,
        elementProperties: {
          pageObjectId: slides[i].objectId,
          size: {
            width: { magnitude: SLIDE_WIDTH_EMU, unit: "EMU" },
            height: { magnitude: SLIDE_HEIGHT_EMU, unit: "EMU" },
          },
          transform: { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, unit: "EMU" },
        },
      },
    });
    requests.push({
      updatePageElementsZOrder: {
        pageElementObjectIds: [imageId],
        operation: "SEND_TO_BACK",
      },
    });

    uploaded++;
    console.log(`  S${slideNum}: queued for placement`);
  }

  if (requests.length > 0) {
    console.log(`\nPlacing ${uploaded} background images...`);
    for (let i = 0; i < requests.length; i += 400) {
      await slidesApi.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: requests.slice(i, i + 400) },
      });
    }
    console.log(`Done! ${uploaded} images uploaded as atmospheric backgrounds.`);
  } else {
    console.log("No images to upload.");
  }
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
