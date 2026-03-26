/**
 * evaluators/screenshot-vision.js — Puppeteer screenshots + Anthropic API vision
 *
 * Takes headless screenshots of sampled slides and sends them to the
 * Anthropic Messages API for visual assessment. Delivers the 3 visual
 * rubric dimensions without Chrome MCP.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
// Load .env keys directly to avoid circular dependency with index.js
const envPath = require("path").join(__dirname, "..", ".env");
function loadEnvKeys() {
  try {
    if (!require("fs").existsSync(envPath)) return {};
    const lines = require("fs").readFileSync(envPath, "utf-8").split("\n");
    const keys = {};
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match) keys[match[1]] = match[2].trim();
    }
    return keys;
  } catch { return {}; }
}

const QA_DIR = path.join(__dirname, "..", "logs", "qa", "screenshots");

function sampleSlideIndices(slideCount, samples) {
  if (slideCount <= samples) return Array.from({ length: slideCount }, (_, i) => i);
  const indices = [0]; // always include first
  for (let i = 1; i < samples - 1; i++) {
    indices.push(Math.round((i / (samples - 1)) * (slideCount - 1)));
  }
  indices.push(slideCount - 1); // always include last
  return [...new Set(indices)].sort((a, b) => a - b);
}

async function captureScreenshots(page, slideCount, deckName, indices) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const screenshots = [];

  for (const idx of indices) {
    await page.evaluate((i) => {
      const slides = document.querySelectorAll('.slide, .grid-slide');
      slides.forEach((s, j) => {
        s.classList.toggle('active', j === i);
        s.style.display = j === i ? 'flex' : 'none';
      });
    }, idx);
    await new Promise(r => setTimeout(r, 200));

    const buf = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 1920, height: 1080 },
    });

    const filePath = path.join(QA_DIR, `${deckName}-slide-${idx + 1}.png`);
    fs.writeFileSync(filePath, buf);
    screenshots.push({ index: idx, slide: idx + 1, buffer: buf, path: filePath });
  }

  return screenshots;
}

function callAnthropicVision(screenshots, slideCount) {
  const envKeys = loadEnvKeys();
  const apiKey = envKeys.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not found in .env");

  const model = envKeys.EVAL_VISION_MODEL || "claude-sonnet-4-5-20250929";

  const content = [];
  for (const ss of screenshots) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: ss.buffer.toString("base64") },
    });
  }
  content.push({
    type: "text",
    text: `You are evaluating a Swiss-grid slide deck design. These are ${screenshots.length} sampled slides from a ${slideCount}-slide deck (slides ${screenshots.map(s => s.slide).join(", ")}).

Score each of these three visual dimensions (1-10 scale):

1. COMMUNICABILITY: Does the design serve the content hierarchy? Can you find the point of each slide quickly? Is the reading order clear? Do headings, labels, and body text create a clear information architecture?

2. TASTE: Does this exhibit Swiss/modernist quality (Müller-Brockmann, Ruder, Hofmann)? Is there restraint? Typography as primary design element? Or is it generic/corporate? Is the grid visible as an organizing principle?

3. LAYOUT BALANCE: Does each slide feel visually balanced? Is whitespace intentional and purposeful? Is there dynamic tension between elements (asymmetric balance), or static centering? Do accents and images create visual rhythm?

Return ONLY valid JSON:
{
  "communicability": { "score": <1-10>, "rationale": "..." },
  "taste": { "score": <1-10>, "rationale": "..." },
  "layoutBalance": { "score": <1-10>, "rationale": "..." },
  "perSlide": [
    { "slide": <N>, "communicability": <1-10>, "taste": <1-10>, "layoutBalance": <1-10>, "notes": "..." }
  ]
}`,
  });

  const body = JSON.stringify({
    model,
    max_tokens: 1024,
    messages: [{ role: "user", content }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    }, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          const resp = JSON.parse(data);
          if (resp.error) {
            reject(new Error(resp.error.message || JSON.stringify(resp.error)));
            return;
          }
          const text = (resp.content || []).find(b => b.type === "text");
          if (!text) { reject(new Error("No text in response")); return; }
          // Extract JSON from response
          const jsonMatch = text.text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) { reject(new Error("No JSON in response")); return; }
          resolve(JSON.parse(jsonMatch[0]));
        } catch (err) {
          reject(new Error(`Parse error: ${err.message}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  name: "screenshot-vision",
  dimensions: ["communicability", "taste", "layoutBalance"],
  requires: ["puppeteer", "anthropic-api"],
  confidences: {
    communicability: 0.85,
    taste: 0.8,
    layoutBalance: 0.85,
  },

  // Phase 1: capture screenshots (needs Puppeteer page)
  async captureScreenshots(page, slideCount, deckName, options = {}) {
    const samples = options.samples || 5;
    const indices = options.slides || sampleSlideIndices(slideCount, samples);
    return captureScreenshots(page, slideCount, deckName, indices);
  },

  // Phase 2: call API (no Puppeteer needed)
  async evaluate(deckPath, options = {}) {
    const screenshots = options.screenshots;
    if (!screenshots || screenshots.length === 0) {
      throw new Error("screenshot-vision requires screenshots via options.screenshots");
    }

    const slideCount = options.slideCount || screenshots.length;
    const result = await callAnthropicVision(screenshots, slideCount);

    const dims = {};
    for (const dim of ["communicability", "taste", "layoutBalance"]) {
      if (result[dim]) {
        dims[dim] = {
          score: result[dim].score,
          confidence: this.confidences[dim],
          source: "screenshot-vision",
          details: { rationale: result[dim].rationale, perSlide: result.perSlide },
        };
      }
    }

    return {
      dimensions: dims,
      screenshotPaths: screenshots.map(s => s.path),
    };
  },
};
