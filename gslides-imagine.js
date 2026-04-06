#!/usr/bin/env node
/**
 * gslides-imagine — extract slide content from Google Slides, generate image
 * prompts via Claude, create images via Midjourney/Imagen, then upload as
 * atmospheric backgrounds to the same presentation.
 *
 * Usage:
 *   node gslides-imagine.js <presentation-url-or-id> [options]
 *
 * Options:
 *   --style <name>          Image style preset (default: swiss-poster)
 *   --abstraction <level>   abstract|suggestive|representational|literal (default: suggestive)
 *   --aspect <ratio>        Aspect ratio (default: 16:9)
 *   --engine <name>         midjourney|imagen (default: midjourney)
 *   --generate              Actually generate images (default: prompts only)
 *   --upload                Upload generated images to the presentation
 *   --opacity <n>           Background opacity bake (default: 0.75)
 *   --slides <range>        Slide range: "1-10" or "3,5,8"
 *   --credentials <path>    Google OAuth credentials JSON
 *   --out <dir>             Output directory for images (default: auto)
 *
 * Pipeline:
 *   1. Read presentation via Google Slides API → extract per-slide content
 *   2. Generate image prompts via Claude (same as imagine.js)
 *   3. Generate images via Midjourney or Imagen
 *   4. Pre-process images (bake background color opacity)
 *   5. Upload to Google Drive + insert as slide backgrounds
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { google } = require("googleapis");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

const EMU_PER_INCH = 914400;
const SLIDE_WIDTH_EMU = 10 * EMU_PER_INCH;
const SLIDE_HEIGHT_EMU = 5.625 * EMU_PER_INCH;

// ═══════════════════════════════════════════════════════
// STEP 1: READ PRESENTATION
// ═══════════════════════════════════════════════════════

function extractPresentationId(urlOrId) {
  const match = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : urlOrId;
}

function extractText(shape) {
  if (!shape?.text?.textElements) return "";
  return shape.text.textElements
    .filter(t => t.textRun)
    .map(t => t.textRun.content)
    .join("")
    .trim();
}

function rgbToHex(rgb) {
  if (!rgb) return null;
  return [rgb.red || 0, rgb.green || 0, rgb.blue || 0]
    .map(c => Math.round(c * 255).toString(16).padStart(2, "0"))
    .join("");
}

async function readSlideContent(presentationId, auth) {
  const slidesApi = google.slides({ version: "v1", auth });
  const pres = await slidesApi.presentations.get({ presentationId });
  const data = pres.data;

  const slides = data.slides.map((slide, idx) => {
    // Background color
    const bgRgb = slide.pageProperties?.pageBackgroundFill?.solidFill?.color?.rgbColor;
    const bg = rgbToHex(bgRgb) || "F8F5F0";

    // Extract all text content from zones
    const texts = [];
    let title = "";
    let body = [];

    for (const el of (slide.pageElements || [])) {
      if (!el.shape) continue;
      const text = extractText(el.shape);
      if (!text) continue;

      // Heuristic: largest font is the title
      const runs = el.shape.text?.textElements?.filter(t => t.textRun) || [];
      const maxFontSize = Math.max(...runs.map(r => r.textRun.style?.fontSize?.magnitude || 14));

      if (maxFontSize >= 20 && !title) {
        title = text;
      } else {
        body.push(text);
      }
      texts.push(text);
    }

    return {
      slideNumber: idx + 1,
      objectId: slide.objectId,
      title: title || body[0] || "",
      body: body.join("\n"),
      allText: texts.join("\n"),
      bg,
      hasImage: (slide.pageElements || []).some(el => el.image),
    };
  });

  return { title: data.title, slides, presentationId };
}

// ═══════════════════════════════════════════════════════
// STEP 2: GENERATE PROMPTS
// ═══════════════════════════════════════════════════════

async function generatePrompts(slides, options = {}) {
  // Build markdown-like content for imagine.js
  const mdSlides = slides.map(s => {
    const parts = [];
    if (s.title) parts.push(`# ${s.title}`);
    if (s.body) parts.push(s.body);
    return parts.join("\n\n");
  });

  const tempMd = mdSlides.join("\n\n---\n\n");
  const tempPath = path.join(options.outDir || "/tmp", "gslides-imagine-temp.md");
  fs.writeFileSync(tempPath, tempMd);

  // Use imagine.js to generate prompts
  const { imagine } = require("./imagine.js");
  const result = await imagine(tempPath, {
    style: options.style || "swiss-poster",
    abstraction: options.abstraction || "suggestive",
    aspectRatio: options.aspect || "16:9",
    model: options.model || "sonnet",
    generate: options.generate || false,
    engine: options.engine || "midjourney",
    outputDir: options.outDir,
    // Don't pass slides range — filtering already happened at the presentation level
    // slides: options.slides,
    force: true,
  });

  // Clean up temp file
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  return result;
}

// ═══════════════════════════════════════════════════════
// STEP 3: PRE-PROCESS (BAKE OPACITY)
// ═══════════════════════════════════════════════════════

async function preprocessImages(imagesDir, slides, opacity) {
  const { processImage } = require("./gslides-preprocess-images.js");
  const outDir = path.join(imagesDir, "preprocessed");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  let processed = 0;
  for (let i = 0; i < slides.length; i++) {
    const num = String(i + 1).padStart(2, "0");
    const srcPath = path.join(imagesDir, `slide-${num}.png`);
    if (!fs.existsSync(srcPath)) continue;

    const outPath = path.join(outDir, `slide-${num}.png`);
    try {
      processImage(srcPath, outPath, slides[i].bg, opacity);
      processed++;
    } catch (err) {
      console.log(amber(`  Warning: failed to preprocess slide ${i + 1}: ${err.message}`));
    }
  }

  console.log(sage(`  Preprocessed ${processed} images with opacity ${opacity}`));
  return outDir;
}

// ═══════════════════════════════════════════════════════
// STEP 4: UPLOAD AS BACKGROUNDS
// ═══════════════════════════════════════════════════════

async function uploadBackgrounds(presentationId, imagesDir, slides, auth) {
  const slidesApi = google.slides({ version: "v1", auth });
  const driveApi = google.drive({ version: "v3", auth });

  const requests = [];
  let uploaded = 0;

  for (let i = 0; i < slides.length; i++) {
    const num = String(i + 1).padStart(2, "0");
    const imgPath = path.join(imagesDir, `slide-${num}.png`);
    if (!fs.existsSync(imgPath)) continue;

    // Skip slides that already have images
    if (slides[i].hasImage) {
      console.log(dim(`  S${i + 1}: skipped (already has image)`));
      continue;
    }

    try {
      // Upload to Drive
      const res = await driveApi.files.create({
        requestBody: { name: `slide-${num}-bg.png`, mimeType: "image/png" },
        media: { mimeType: "image/png", body: fs.createReadStream(imgPath) },
        fields: "id",
      });
      await driveApi.permissions.create({
        fileId: res.data.id,
        requestBody: { role: "reader", type: "anyone" },
      });

      const imageUrl = `https://drive.google.com/uc?id=${res.data.id}`;
      const imageId = `bg_${Date.now()}_${i}`;

      // Insert as full-bleed background image
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
      // Send to back
      requests.push({
        updatePageElementsZOrder: {
          pageElementObjectIds: [imageId],
          operation: "SEND_TO_BACK",
        },
      });

      uploaded++;
      if (uploaded % 5 === 0) {
        console.log(dim(`  ${uploaded} uploaded...`));
      }
    } catch (err) {
      console.log(amber(`  Warning: S${i + 1}: ${err.message}`));
    }
  }

  if (requests.length > 0) {
    console.log(dim(`  Placing ${uploaded} background images...`));
    // Batch in chunks of 400
    for (let i = 0; i < requests.length; i += 400) {
      await slidesApi.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: requests.slice(i, i + 400) },
      });
    }
  }

  return uploaded;
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function gslidesImagine(urlOrId, options = {}) {
  const presentationId = extractPresentationId(urlOrId);
  const credPath = options.credentials || process.env.GOOGLE_CREDENTIALS_PATH || "/Users/lmagee/Dev/youtube-playlist/client_secret.json";
  const tokenPath = options.token || ".gslides-token.json";
  const opacity = options.opacity || 0.75;

  console.log(dim("\n  ┌─ gslides-imagine ─────────────────────────"));
  console.log(dim("  │ ") + `Presentation: ${teal(presentationId)}`);

  // Auth
  const raw = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  const creds = raw.installed || raw.web;
  const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, "http://localhost:3847/oauth2callback");
  oauth2.setCredentials(JSON.parse(fs.readFileSync(tokenPath, "utf-8")));

  // Step 1: Read presentation
  console.log(dim("  │ ") + "Reading presentation...");
  const presData = await readSlideContent(presentationId, oauth2);
  console.log(dim("  │ ") + `Title: ${sage(presData.title)}`);
  console.log(dim("  │ ") + `Slides: ${presData.slides.length}`);

  // Filter slides if range specified
  let targetSlides = presData.slides;
  if (options.slides) {
    const parseRange = (s) => {
      const parts = s.split(",");
      const nums = new Set();
      for (const p of parts) {
        if (p.includes("-")) {
          const [a, b] = p.split("-").map(Number);
          for (let i = a; i <= b; i++) nums.add(i);
        } else {
          nums.add(Number(p));
        }
      }
      return nums;
    };
    const range = parseRange(options.slides);
    targetSlides = presData.slides.filter(s => range.has(s.slideNumber));
    console.log(dim("  │ ") + `Targeting ${targetSlides.length} slides: ${options.slides}`);
  }

  // Output directory
  const outDir = options.out || path.join("decks", `gslides-${presentationId.slice(0, 8)}-images`);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Step 2: Generate prompts
  console.log(dim("  │"));
  console.log(dim("  │ ") + "Generating image prompts...");
  const imagineResult = await generatePrompts(targetSlides, {
    ...options,
    outDir,
  });
  console.log(dim("  │ ") + sage(`Generated ${(imagineResult.prompts?.prompts || []).length} prompts`));
  console.log(dim("  │ ") + `Prompts: ${teal(imagineResult.promptsPath)}`);

  if (!options.generate) {
    console.log(dim("  │"));
    console.log(dim("  │ ") + amber("Pass --generate to create images via Midjourney/Imagen"));
    console.log(dim("  │ ") + amber("Pass --upload to also upload them as slide backgrounds"));
    console.log(dim("  └──────────────────────────────────────────\n"));
    return { presentationId, prompts: imagineResult.prompts, outDir };
  }

  // Step 3: Pre-process images (bake opacity)
  console.log(dim("  │"));
  console.log(dim("  │ ") + "Pre-processing images...");
  const processedDir = await preprocessImages(outDir, targetSlides, opacity);

  // Step 4: Upload as backgrounds
  if (options.upload) {
    console.log(dim("  │"));
    console.log(dim("  │ ") + "Uploading backgrounds to presentation...");
    const uploaded = await uploadBackgrounds(presentationId, processedDir, targetSlides, oauth2);
    console.log(dim("  │ ") + sage(`Uploaded ${uploaded} background images`));
  } else {
    console.log(dim("  │ ") + amber("Pass --upload to insert images into the presentation"));
  }

  const url = `https://docs.google.com/presentation/d/${presentationId}/edit`;
  console.log(dim("  │"));
  console.log(dim("  │ ") + sage("Done!"));
  console.log(dim("  │ ") + teal(url));
  console.log(dim("  └──────────────────────────────────────────\n"));

  return { presentationId, prompts: imagineResult.prompts, outDir, url };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  ${accent("gslides-imagine")} — generate and upload background images to Google Slides

  ${dim("Usage:")}
    node gslides-imagine.js <presentation-url-or-id> [options]

  ${dim("Options:")}
    --style <name>          Image style: swiss-poster, bauhaus, editorial, etc.
    --abstraction <level>   abstract, suggestive, representational, literal
    --engine <name>         midjourney or imagen (default: midjourney)
    --generate              Generate images (default: prompts only)
    --upload                Upload to the presentation as backgrounds
    --opacity <n>           Background opacity bake (default: 0.75)
    --slides <range>        Slide range: "1-10" or "3,5,8"
    --credentials <path>    OAuth credentials JSON
    --out <dir>             Output directory for images

  ${dim("Examples:")}
    # Generate prompts only (review before generating)
    node gslides-imagine.js https://docs.google.com/presentation/d/1abc.../edit

    # Generate images + upload as backgrounds
    node gslides-imagine.js 1abc... --generate --upload --style editorial

    # Target specific slides
    node gslides-imagine.js 1abc... --generate --upload --slides 1-10
`);
    process.exit(0);
  }

  const input = args.find(a => !a.startsWith("--"));
  const getOpt = (flag) => { const i = args.indexOf(flag); return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined; };

  gslidesImagine(input, {
    style: getOpt("--style"),
    abstraction: getOpt("--abstraction"),
    aspect: getOpt("--aspect"),
    engine: getOpt("--engine"),
    generate: args.includes("--generate"),
    upload: args.includes("--upload"),
    opacity: parseFloat(getOpt("--opacity") || "0.75"),
    slides: getOpt("--slides"),
    credentials: getOpt("--credentials"),
    token: getOpt("--token"),
    out: getOpt("--out"),
    model: getOpt("--model"),
  }).catch(err => {
    console.error(accent("  Error:"), err.message);
    process.exit(1);
  });
}

module.exports = { gslidesImagine, readSlideContent, extractPresentationId };
