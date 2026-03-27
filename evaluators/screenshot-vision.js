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
const { execFileSync } = require("child_process");
// Load .env keys directly to avoid circular dependency with index.js
const envPath = require("path").join(__dirname, "..", ".env");
function loadEnvKeys() {
  try {
    if (!require("fs").existsSync(envPath)) return {};
    const lines = require("fs").readFileSync(envPath, "utf-8").split("\n");
    const keys = {};
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match) keys[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
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

function buildVisionPrompt(screenshotPaths, slideCount) {
  return `You are evaluating a Swiss-grid slide deck design. I am providing ${screenshotPaths.length} slide screenshots from a ${slideCount}-slide deck.

Score each of these three visual dimensions (1-10 scale):

1. COMMUNICABILITY: Does the design serve the content hierarchy? Can you find the point of each slide quickly? Is the reading order clear? Do headings, labels, and body text create a clear information architecture?

2. TASTE: Does this exhibit Swiss/modernist quality (Muller-Brockmann, Ruder, Hofmann)? Is there restraint? Typography as primary design element? Or is it generic/corporate? Is the grid visible as an organizing principle?

3. LAYOUT BALANCE: Does each slide feel visually balanced? Is whitespace intentional and purposeful? Is there dynamic tension between elements (asymmetric balance), or static centering? Do accents and images create visual rhythm?

Return ONLY valid JSON:
{
  "communicability": { "score": <1-10>, "rationale": "..." },
  "taste": { "score": <1-10>, "rationale": "..." },
  "layoutBalance": { "score": <1-10>, "rationale": "..." }
}`;
}

function callClaudeCLI(screenshotPaths, slideCount) {
  const prompt = buildVisionPrompt(screenshotPaths, slideCount);
  // Build args: pass screenshot paths as file attachments
  const args = ["-p", prompt, "--output-format", "json"];
  for (const p of screenshotPaths) {
    args.push("--file", p);
  }
  const result = execFileSync("claude", args, {
    encoding: "utf-8",
    timeout: 300000,
    maxBuffer: 10 * 1024 * 1024,
  });

  // claude --output-format json returns { result: "..." }
  const parsed = JSON.parse(result);
  const text = parsed.result || parsed;
  const textStr = typeof text === "string" ? text : JSON.stringify(text);
  const jsonMatch = textStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in claude CLI response");
  return JSON.parse(jsonMatch[0]);
}

module.exports = {
  name: "screenshot-vision",
  dimensions: ["communicability", "taste", "layoutBalance"],
  requires: ["puppeteer"],  // Only Puppeteer required for capture; API is best-effort for scoring
  confidences: {
    communicability: 0.85,
    taste: 0.8,
    layoutBalance: 0.85,
  },

  // Phase 1: capture screenshots (needs Puppeteer page)
  // Always captures ALL slides — sampling misses key conflicts
  async captureScreenshots(page, slideCount, deckName, options = {}) {
    const indices = options.slides || Array.from({ length: slideCount }, (_, i) => i);
    return captureScreenshots(page, slideCount, deckName, indices);
  },

  // Phase 2: call API if available, otherwise return screenshots only
  async evaluate(deckPath, options = {}) {
    const screenshots = options.screenshots;
    if (!screenshots || screenshots.length === 0) {
      throw new Error("screenshot-vision requires screenshots via options.screenshots");
    }

    const slideCount = options.slideCount || screenshots.length;
    const screenshotPaths = screenshots.map(s => s.path);

    // Scoring chain: Anthropic API → Claude CLI → capture-only
    const parseDims = (result, source) => {
      const dims = {};
      for (const dim of ["communicability", "taste", "layoutBalance"]) {
        if (result[dim]) {
          dims[dim] = {
            score: result[dim].score,
            confidence: this.confidences[dim],
            source,
            details: { rationale: result[dim].rationale, perSlide: result.perSlide },
          };
        }
      }
      return dims;
    };

    // 1. Try Anthropic API (fastest, cheapest)
    const envKeys = loadEnvKeys();
    if (envKeys.ANTHROPIC_API_KEY) {
      try {
        const result = await callAnthropicVision(screenshots, slideCount);
        return { dimensions: parseDims(result, "screenshot-vision-api"), screenshotPaths };
      } catch (err) {
        process.stderr.write("  \x1b[33m\u26A0\x1b[0m API scoring failed: " + err.message + "\n");
      }
    }

    // 2. Fall back to Claude CLI (uses session auth, no API credits needed)
    try {
      process.stderr.write("  \x1b[2mFalling back to claude CLI for visual scoring...\x1b[0m\n");
      const result = callClaudeCLI(screenshotPaths, slideCount);
      return { dimensions: parseDims(result, "screenshot-vision-cli"), screenshotPaths };
    } catch (err) {
      process.stderr.write("  \x1b[33m\u26A0\x1b[0m Claude CLI scoring failed: " + err.message + "\n");
    }

    // 3. Capture-only fallback
    process.stderr.write("  \x1b[2m  Screenshots saved for manual review at: " + screenshotPaths[0].replace(/[^/]+$/, "") + "\x1b[0m\n");
    return { dimensions: {}, screenshotPaths, captureOnly: true };
  },
};
