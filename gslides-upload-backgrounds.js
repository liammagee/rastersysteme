#!/usr/bin/env node
/**
 * gslides-upload-backgrounds — preprocess and upload Midjourney images as
 * atmospheric backgrounds to a Google Slides presentation.
 *
 * Steps:
 *   1. Read presentation via Slides API to get slide objectIds + background colors
 *   2. Preprocess images (bake background color at 0.8 opacity)
 *   3. Upload preprocessed images to Google Drive
 *   4. Insert as full-bleed backgrounds, sent to back
 *
 * Usage:
 *   node gslides-upload-backgrounds.js
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { google } = require("googleapis");
const { processImage } = require("./gslides-preprocess-images.js");

const dim = chalk.dim;
const sage = chalk.green;
const amber = chalk.yellow;
const teal = chalk.cyan;

const EMU_PER_INCH = 914400;
const SLIDE_WIDTH_EMU = 10 * EMU_PER_INCH;   // 9144000
const SLIDE_HEIGHT_EMU = 5.625 * EMU_PER_INCH; // 5143500

const PRESENTATION_ID = "1aih3hyzqruR-icDIAE7QBqETDynMJdlUA4uAHsz9PzA";
const IMAGES_DIR = path.resolve(__dirname, "decks/gslides-1aih3hyz-images/gslides-imagine-temp-images");
const PREPROCESSED_DIR = path.resolve(__dirname, "decks/gslides-1aih3hyz-images/preprocessed");
const CRED_PATH = "/Users/lmagee/Dev/youtube-playlist/client_secret.json";
const TOKEN_PATH = path.resolve(__dirname, ".gslides-token.json");
const OPACITY = 0.8;
const SLIDE_COUNT = 6; // Process slides 1-6

function rgbToHex(rgb) {
  if (!rgb) return null;
  return [rgb.red || 0, rgb.green || 0, rgb.blue || 0]
    .map(c => Math.round(c * 255).toString(16).padStart(2, "0"))
    .join("");
}

function getAuth() {
  const raw = JSON.parse(fs.readFileSync(CRED_PATH, "utf-8"));
  const creds = raw.installed || raw.web;
  const oauth2 = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    "http://localhost:3847/oauth2callback"
  );
  oauth2.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8")));
  return oauth2;
}

async function readPresentation(auth) {
  const slidesApi = google.slides({ version: "v1", auth });
  const res = await slidesApi.presentations.get({ presentationId: PRESENTATION_ID });
  const data = res.data;

  console.log(dim("  Presentation: ") + teal(data.title));
  console.log(dim("  Slides: ") + data.slides.length);

  const slides = data.slides.map((slide, idx) => {
    const bgFill = slide.pageProperties?.pageBackgroundFill;
    let bg = "F8F5F0"; // default

    if (bgFill?.solidFill?.color?.rgbColor) {
      bg = rgbToHex(bgFill.solidFill.color.rgbColor);
    } else if (bgFill?.solidFill?.color?.themeColor) {
      // Theme colors won't have explicit RGB, fall back to default
      bg = "F8F5F0";
    }

    return {
      slideNumber: idx + 1,
      objectId: slide.objectId,
      bg,
    };
  });

  return slides;
}

function preprocessImages(slides) {
  if (!fs.existsSync(PREPROCESSED_DIR)) {
    fs.mkdirSync(PREPROCESSED_DIR, { recursive: true });
  }

  console.log(dim("\n  Preprocessing images (opacity=" + OPACITY + ")"));

  for (let i = 0; i < SLIDE_COUNT; i++) {
    const num = String(i + 1).padStart(2, "0");
    const srcPath = path.join(IMAGES_DIR, `slide-${num}.png`);
    const outPath = path.join(PREPROCESSED_DIR, `slide-${num}.png`);
    const slide = slides[i];

    if (!fs.existsSync(srcPath)) {
      console.log(amber(`  Warning: ${srcPath} not found, skipping`));
      continue;
    }

    console.log(dim(`  S${i + 1}: `) + `bg=#${slide.bg}, processing ${path.basename(srcPath)}`);
    processImage(srcPath, outPath, slide.bg, OPACITY);
    console.log(sage(`  S${i + 1}: done -> ${path.basename(outPath)}`));
  }
}

async function uploadAndInsert(slides, auth) {
  const slidesApi = google.slides({ version: "v1", auth });
  const driveApi = google.drive({ version: "v3", auth });

  const requests = [];
  let uploaded = 0;

  for (let i = 0; i < SLIDE_COUNT; i++) {
    const num = String(i + 1).padStart(2, "0");
    const imgPath = path.join(PREPROCESSED_DIR, `slide-${num}.png`);

    if (!fs.existsSync(imgPath)) {
      console.log(amber(`  S${i + 1}: no preprocessed image, skipping`));
      continue;
    }

    const slide = slides[i];
    console.log(dim(`  S${i + 1}: `) + `uploading to Drive...`);

    // Upload to Drive
    const res = await driveApi.files.create({
      requestBody: {
        name: `gslides-bg-slide-${num}.png`,
        mimeType: "image/png",
      },
      media: {
        mimeType: "image/png",
        body: fs.createReadStream(imgPath),
      },
      fields: "id",
    });

    // Make publicly readable
    await driveApi.permissions.create({
      fileId: res.data.id,
      requestBody: { role: "reader", type: "anyone" },
    });

    const imageUrl = `https://drive.google.com/uc?id=${res.data.id}`;
    const imageId = `bg_upload_${Date.now()}_${i}`;

    console.log(sage(`  S${i + 1}: `) + `uploaded (${res.data.id}), inserting as background...`);

    // Create full-bleed image
    requests.push({
      createImage: {
        objectId: imageId,
        url: imageUrl,
        elementProperties: {
          pageObjectId: slide.objectId,
          size: {
            width: { magnitude: SLIDE_WIDTH_EMU, unit: "EMU" },
            height: { magnitude: SLIDE_HEIGHT_EMU, unit: "EMU" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: 0,
            translateY: 0,
            unit: "EMU",
          },
        },
      },
    });

    // Send to back (behind text)
    requests.push({
      updatePageElementsZOrder: {
        pageElementObjectIds: [imageId],
        operation: "SEND_TO_BACK",
      },
    });

    uploaded++;
  }

  if (requests.length > 0) {
    console.log(dim(`\n  Sending batch update (${uploaded} images)...`));
    await slidesApi.presentations.batchUpdate({
      presentationId: PRESENTATION_ID,
      requestBody: { requests },
    });
    console.log(sage(`  Batch update complete: ${uploaded} backgrounds inserted`));
  } else {
    console.log(amber("  No images to upload"));
  }

  return uploaded;
}

async function main() {
  console.log(dim("\n  === gslides-upload-backgrounds ==="));
  console.log(dim("  Presentation: ") + PRESENTATION_ID);
  console.log(dim("  Images: ") + IMAGES_DIR);

  const auth = getAuth();

  // Step 1: Read presentation
  console.log(dim("\n  Step 1: Reading presentation..."));
  const slides = await readPresentation(auth);

  for (let i = 0; i < Math.min(SLIDE_COUNT, slides.length); i++) {
    console.log(dim(`  S${i + 1}: `) + `objectId=${slides[i].objectId}, bg=#${slides[i].bg}`);
  }

  // Step 2: Preprocess images
  console.log(dim("\n  Step 2: Preprocessing images..."));
  preprocessImages(slides);

  // Step 3: Upload and insert
  console.log(dim("\n  Step 3: Uploading and inserting backgrounds..."));
  const count = await uploadAndInsert(slides, auth);

  console.log(sage(`\n  Done: ${count} atmospheric backgrounds uploaded to presentation`));
  console.log(dim("  View at: ") + teal(`https://docs.google.com/presentation/d/${PRESENTATION_ID}/edit`));
}

main().catch(err => {
  console.error(chalk.red("Error: " + err.message));
  if (err.response?.data) {
    console.error(chalk.red(JSON.stringify(err.response.data, null, 2)));
  }
  process.exit(1);
});
