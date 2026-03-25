#!/usr/bin/env node
/**
 * imagine — generate consistent image prompts for each slide
 *
 * Takes markdown slides, uses Claude to create image prompts with a shared
 * aesthetic, optionally calls image generation APIs (Google Imagen, Midjourney).
 *
 * Usage:
 *   node imagine.js <input.md> [options]
 *
 * Pipeline:
 *   input.md → Claude (aesthetic brief + per-slide prompts) → prompts.json
 *            → optionally → Google Imagen / Midjourney API → images/
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

// Load .env keys for image APIs only — parsed but NOT injected into process.env
// This prevents ANTHROPIC_API_KEY from leaking to the Claude CLI
// (which would use API credits instead of your subscription)
function loadEnvKeys() {
  try {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return {};
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    const keys = {};
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match) keys[match[1]] = match[2].trim();
    }
    return keys;
  } catch { return {}; }
}

const { callClaude, callClaudeAsync } = require("./compose.js");

function parseSlideRange(range) {
  if (!range) return null;
  const indices = new Set();
  for (const part of range.split(",")) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map(Number);
      for (let i = start; i <= end; i++) indices.add(i);
    } else {
      indices.add(Number(trimmed));
    }
  }
  return indices;
}
const { parseMarkdown } = require("./raster.js");

const dim = chalk.dim;
const accent = chalk.red;
const teal = chalk.cyan;
const sage = chalk.green;
const amber = chalk.yellow;

// ═══════════════════════════════════════════════════════
// IMAGE STYLES — aesthetic presets for prompt generation
// ═══════════════════════════════════════════════════════

const IMAGE_STYLES = {
  "swiss-poster": {
    name: "Swiss Poster",
    description: "Müller-Brockmann / Armin Hofmann inspired. Geometric abstraction, flat color fields, mathematical composition. No photorealism.",
    medium: "flat vector illustration, screen print aesthetic, limited color palette",
    avoid: "photorealism, gradients, textures, 3D rendering, lens flare",
  },
  "bauhaus": {
    name: "Bauhaus",
    description: "Kandinsky / Moholy-Nagy inspired. Primary geometry, constructivist composition, bold primary colors on white or black.",
    medium: "geometric abstraction, hard edges, primary colors, constructivist collage",
    avoid: "organic forms, photorealism, soft gradients, decoration",
  },
  "editorial": {
    name: "Editorial Photography",
    description: "High-end magazine editorial. Cinematic lighting, shallow depth of field, muted color grading.",
    medium: "editorial photography, 35mm film grain, natural light, shallow DOF",
    avoid: "stock photo aesthetic, HDR, oversaturation, clip art",
  },
  "data-viz": {
    name: "Data Visualization",
    description: "Information is beautiful. Abstract representations of data, networks, flows. Inspired by Nicholas Felton, Giorgia Lupi.",
    medium: "data visualization art, generative patterns, network diagrams, abstract infographic",
    avoid: "pie charts, bar graphs, clip art, photorealism",
  },
  "collage": {
    name: "Digital Collage",
    description: "April Greiman / David Carson inspired. Layered fragments, mixed media, deconstructed typography as image.",
    medium: "digital collage, mixed media, layered fragments, torn paper, overprint",
    avoid: "clean vectors, photorealism, minimalism, symmetry",
  },
  "architectural": {
    name: "Architectural",
    description: "Brutalist / modernist architecture photography. Concrete, glass, shadow, geometric perspective.",
    medium: "architectural photography, brutalist concrete, geometric shadows, high contrast B&W",
    avoid: "nature, people, warm tones, soft focus",
  },
  "generative": {
    name: "Generative Art",
    description: "Processing / p5.js aesthetic. Algorithmic patterns, particle systems, mathematical beauty.",
    medium: "generative art, algorithmic patterns, particle systems, code-generated geometry",
    avoid: "photorealism, hand-drawn, organic textures",
  },
  "swiss-generative-architectural": {
    name: "Swiss-Generative-Architectural",
    description: "A synthesis of three aesthetics: (1) Swiss poster rigor — Müller-Brockmann's mathematical grid composition and flat color fields; (2) Generative art — algorithmic patterns, particle systems, code-generated geometry evoking computation itself; (3) Architectural photography — brutalist concrete, geometric shadows, monumental perspective. The result is disciplined geometric abstraction with computational texture and architectural weight. Forms should feel both precisely composed and emergently complex.",
    medium: "flat vector illustration with algorithmic texture, screen print meets generative code, brutalist geometry, limited palette with computational patterning, architectural perspective grids",
    avoid: "photorealism, soft gradients, organic curves, decoration, naturalistic scenes, warm organic tones",
  },
};

// ═══════════════════════════════════════════════════════
// PROMPT GENERATOR — Claude creates the aesthetic brief + per-slide prompts
// ═══════════════════════════════════════════════════════

const ABSTRACTION_LEVELS = {
  abstract: `ABSTRACTION: FULLY ABSTRACT. No recognizable objects, no literal depictions.
Pure geometry, color fields, textures, patterns. The image should evoke the slide's
MOOD and ENERGY, not illustrate its content. Think Rothko, Mondrian, Agnes Martin.`,

  suggestive: `ABSTRACTION: SUGGESTIVE. Semi-abstract — recognizable forms but stylized.
Simplified shapes that SUGGEST the topic without literally depicting it. A network
diagram for "AI", overlapping circles for "collaboration", ascending bars for "progress".
Think Saul Bass poster design, Otl Aicher pictograms, isotype charts.`,

  representational: `ABSTRACTION: REPRESENTATIONAL. The image should clearly relate to the
slide content. Show recognizable scenes, objects, or concepts — but through the lens
of the chosen aesthetic style. A classroom for education, a neural network for AI,
hands typing for practice. Stylized, not photorealistic (unless the style calls for it).`,

  literal: `ABSTRACTION: LITERAL. Create a direct visual representation of the slide
content. If the slide discusses "assessment criteria", show a rubric or checklist.
If it discusses "six lenses", show six distinct viewpoints or frames. Prioritize
clarity and immediate comprehension over artistic expression.`,
};

function buildImagePrompt(slides, options = {}) {
  const style = IMAGE_STYLES[options.style || "swiss-poster"];
  const aspectRatio = options.aspectRatio || "16:9";
  const abstraction = ABSTRACTION_LEVELS[options.abstraction || "suggestive"];

  const slideDescriptions = slides.map((slide, i) => {
    const title = slide.title || slide.subtitle || "(untitled)";
    const bullets = slide.bullets.map(b => b.text || b).join("; ");
    const body = slide.body.join(" ").slice(0, 200);
    const blockquote = slide.blockquote || "";
    return `SLIDE ${i + 1}: "${title}"${bullets ? ` | Bullets: ${bullets}` : ""}${body ? ` | Body: ${body}` : ""}${blockquote ? ` | Quote: ${blockquote}` : ""}`;
  }).join("\n");

  return `You are an art director creating image prompts for a slide presentation.
Each slide needs one image prompt suitable for AI image generation (Midjourney, DALL-E, Imagen).

AESTHETIC PRESET: ${style.name}
${style.description}
Medium: ${style.medium}
Avoid: ${style.avoid}

${abstraction}

ASPECT RATIO: ${aspectRatio}

CONSISTENCY RULES:
1. First, define a VISUAL THREAD — a recurring set of:
   - Color palette (3-5 specific colors that appear across all images)
   - Compositional motif (a recurring visual element or structure)
   - Lighting/atmosphere (consistent across the series)
2. Every prompt must reference the visual thread
3. Prompts should form a visual narrative when seen in sequence
4. Each prompt must be self-contained (understandable without the others)
5. Include technical parameters: aspect ratio, style keywords, negative prompts

SLIDES:
${slideDescriptions}

OUTPUT FORMAT — return ONLY valid JSON, no commentary:
{
  "visualThread": {
    "palette": ["color1", "color2", "color3"],
    "motif": "description of recurring visual element",
    "atmosphere": "description of consistent lighting/mood"
  },
  "prompts": [
    {
      "slide": 1,
      "title": "slide title",
      "prompt": "the full image generation prompt, 50-120 words, specific and vivid",
      "negativePrompt": "what to avoid",
      "params": {
        "aspectRatio": "${aspectRatio}",
        "style": "${style.name}"
      }
    }
  ]
}`;
}

// ═══════════════════════════════════════════════════════
// IMAGE GENERATION APIS
// ═══════════════════════════════════════════════════════

async function generateWithImagen(prompt, outputPath, apiKey, imagenModel) {
  const https = require("https");
  return new Promise((resolve, reject) => {
    // Prepend "Generate an image:" to make intent clear to the model
    const imagePrompt = `Generate an image: ${prompt}`;
    const body = JSON.stringify({
      contents: [{ parts: [{ text: imagePrompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        imageSafety: "BLOCK_NONE",
      },
    });

    const model = imagenModel || "gemini-2.0-flash-preview-image-generation";
    const req = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);

          // Check for API errors
          if (parsed.error) {
            return reject(new Error(`Imagen API: ${parsed.error.message || JSON.stringify(parsed.error).slice(0, 200)}`));
          }

          const parts = parsed.candidates?.[0]?.content?.parts || [];
          const imagePart = parts.find(p => p.inlineData);
          if (imagePart) {
            const imgData = Buffer.from(imagePart.inlineData.data, "base64");
            fs.writeFileSync(outputPath, imgData);
            resolve(outputPath);
          } else {
            // Log the actual response for debugging
            const textPart = parts.find(p => p.text);
            const errMsg = textPart ? textPart.text.slice(0, 200) : JSON.stringify(parsed).slice(0, 300);
            reject(new Error(`No image in response: ${errMsg}`));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

let mjClient = null;

async function getMidjourneyClient(envKeys) {
  if (mjClient) return mjClient;
  const { Midjourney } = require("midjourney");
  mjClient = new Midjourney({
    ServerId: envKeys.MIDJOURNEY_SERVER_ID,
    ChannelId: envKeys.MIDJOURNEY_CHANNEL_ID,
    SalaiToken: envKeys.MIDJOURNEY_DISCORD_TOKEN,
    Debug: false,
    Ws: true,
  });
  await mjClient.init();
  return mjClient;
}

function downloadImage(uri, outputPath) {
  const https = require("https");
  const http = require("http");
  return new Promise((resolve, reject) => {
    const url = new URL(uri);
    const get = url.protocol === "https:" ? https.get : http.get;
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, outputPath).then(resolve, reject);
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        fs.writeFileSync(outputPath, Buffer.concat(chunks));
        resolve(outputPath);
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function generateWithMidjourney(prompt, outputPath, envKeys, aspectRatio) {
  const client = await getMidjourneyClient(envKeys);

  // Append aspect ratio to prompt (Midjourney syntax)
  const ar = aspectRatio || "16:9";
  const fullPrompt = `${prompt} --ar ${ar}`;

  process.stderr.write(dim(" grid..."));
  const imagine = await client.Imagine(fullPrompt, (uri, progress) => {
    process.stderr.write(`\r  ${dim("  grid")} ${amber(progress)}   `);
  });

  if (!imagine || !imagine.uri) {
    throw new Error("No image returned from Midjourney");
  }

  // Save the 4-grid for reference
  const gridPath = outputPath.replace(/\.png$/, "-grid.png");
  await downloadImage(imagine.uri, gridPath);

  // Upscale image 1 (top-left) — best default for consistent compositions
  // The hash and msgId come from the imagine response
  process.stderr.write(`\r  ${dim("  upscaling U1...")}   `);
  const upscaled = await client.Upscale({
    index: 1,
    msgId: imagine.id || imagine.msgId,
    hash: imagine.hash,
    flags: imagine.flags || 0,
    loading: (uri, progress) => {
      process.stderr.write(`\r  ${dim("  U1")} ${amber(progress)}   `);
    },
  });

  if (upscaled && upscaled.uri) {
    await downloadImage(upscaled.uri, outputPath);
  } else {
    // Fallback: use the grid image if upscale fails
    process.stderr.write(dim(" (upscale failed, using grid)"));
    fs.copyFileSync(gridPath, outputPath);
  }

  return outputPath;
}

// ═══════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════

async function imagine(inputPath, options = {}) {
  const md = fs.readFileSync(inputPath, "utf-8");
  const slides = parseMarkdown(md);
  const base = path.basename(inputPath, ".md");
  const outputDir = path.join(path.dirname(path.resolve(inputPath)), `${base}-images`);

  process.stderr.write(`\n  ${accent("■")} ${chalk.white.bold("imagine")}\n`);
  process.stderr.write(`  ${dim("Source:")} ${teal(path.basename(inputPath))} ${dim(`(${slides.length} slides)`)}\n`);
  process.stderr.write(`  ${dim("Style:")} ${teal(options.style || "swiss-poster")}\n`);

  fs.mkdirSync(outputDir, { recursive: true });
  const promptsPath = path.join(outputDir, "prompts.json");
  let result;

  // Check for existing prompts (skip Claude if --images-only or prompts.json exists + --generate)
  if (options.imagesOnly && fs.existsSync(promptsPath)) {
    process.stderr.write(`  ${sage("✓")} Using existing prompts: ${teal(promptsPath)}\n`);
    result = JSON.parse(fs.readFileSync(promptsPath, "utf-8"));
  } else {
    // Phase 1: Generate prompts via Claude
    process.stderr.write(`  ${amber("⟐")} ${dim("Generating image prompts...")}\n`);
    const prompt = buildImagePrompt(slides, options);
    const raw = await callClaudeAsync(prompt, {
      model: options.model || "sonnet",
      label: "imagine",
      raw: true,
    });

    // Parse JSON response
    try {
      let text = raw.trim();
      if (/^```(?:json)?\s*\n/.test(text)) {
        text = text.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
      }
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      if (first >= 0 && last > first) text = text.slice(first, last + 1);
      result = JSON.parse(text);
    } catch (e) {
      process.stderr.write(`  ${accent("✗")} Failed to parse Claude response as JSON\n`);
      const rawPath = path.join(path.dirname(path.resolve(inputPath)), `${base}-prompts-raw.txt`);
      fs.writeFileSync(rawPath, raw);
      process.stderr.write(`  ${dim("Raw saved to:")} ${teal(rawPath)}\n`);
      return null;
    }

    // Save prompts
    fs.writeFileSync(promptsPath, JSON.stringify(result, null, 2));
    process.stderr.write(`  ${sage("✓")} ${chalk.white.bold(result.prompts.length)} prompts → ${teal(promptsPath)}\n`);
  }

  // Log visual thread
  if (result.visualThread) {
    const vt = result.visualThread;
    process.stderr.write(`  ${dim("Palette:")} ${vt.palette.join(", ")}\n`);
    process.stderr.write(`  ${dim("Motif:")} ${vt.motif}\n`);
    process.stderr.write(`  ${dim("Atmosphere:")} ${vt.atmosphere}\n`);
  }

  // Save individual prompts as text files for easy copy-paste
  result.prompts.forEach((p, i) => {
    const promptFile = path.join(outputDir, `slide-${String(i + 1).padStart(2, "0")}.txt`);
    const content = [
      `# Slide ${p.slide}: ${p.title}`,
      "",
      p.prompt,
      "",
      `Negative: ${p.negativePrompt}`,
      "",
      `Aspect: ${p.params?.aspectRatio || "16:9"}`,
      `Style: ${p.params?.style || "default"}`,
    ].join("\n");
    fs.writeFileSync(promptFile, content);
  });

  // Phase 2: Generate images if API key provided
  const envKeys = loadEnvKeys();
  const apiKey = options.apiKey || envKeys.GOOGLE_API_KEY || envKeys.IMAGEN_API_KEY;
  const hasMj = envKeys.MIDJOURNEY_DISCORD_TOKEN && envKeys.MIDJOURNEY_SERVER_ID && envKeys.MIDJOURNEY_CHANNEL_ID;

  if (options.generate && (apiKey || hasMj)) {
    const engine = options.engine || "midjourney";
    const slideFilter = parseSlideRange(options.slides);
    const promptsToGenerate = slideFilter
      ? result.prompts.filter(p => slideFilter.has(p.slide))
      : result.prompts;

    process.stderr.write(`\n  ${dim("── Image Generation")} ${teal(engine)} ${dim("────────────────")}\n`);
    process.stderr.write(`  ${dim("Slides:")} ${slideFilter ? `${promptsToGenerate.length} selected` : `all ${promptsToGenerate.length}`}\n`);
    process.stderr.write(`  ${dim("Aspect:")} ${options.aspectRatio || "16:9"}\n`);

    for (const p of promptsToGenerate) {
      const imgPath = path.join(outputDir, `slide-${String(p.slide).padStart(2, "0")}.png`);

      // Skip if image already exists (unless --force)
      if (fs.existsSync(imgPath) && !options.force) {
        process.stderr.write(`  ${dim(`[${p.slide}]`)} ${p.title.slice(0, 40)} ${dim("(exists, skip)")}\n`);
        continue;
      }

      process.stderr.write(`  ${dim(`[${p.slide}]`)} ${p.title.slice(0, 40)}`);

      try {
        if (engine === "midjourney" && hasMj) {
          await generateWithMidjourney(p.prompt, imgPath, envKeys, options.aspectRatio);
          process.stderr.write(` ${sage("✓")}\n`);
        } else if (apiKey) {
          await generateWithImagen(p.prompt, imgPath, apiKey, options.imagenModel);
          process.stderr.write(` ${sage("✓")}\n`);
        }
      } catch (err) {
        process.stderr.write(` ${accent("✗")} ${err.message}\n`);
      }
    }

    // Close Midjourney client if used
    if (mjClient) { try { mjClient.Close(); } catch {} }
  }

  // Generate a markdown gallery
  const galleryPath = path.join(outputDir, "gallery.md");
  const gallery = result.prompts.map((p) => {
    const imgFile = `slide-${String(p.slide).padStart(2, "0")}.png`;
    const hasImg = fs.existsSync(path.join(outputDir, imgFile));
    return [
      `## Slide ${p.slide}: ${p.title}`,
      "",
      hasImg ? `![${p.title}](${imgFile})` : `*(image not generated)*`,
      "",
      `> ${p.prompt}`,
      "",
      `Negative: ${p.negativePrompt}`,
      "",
    ].join("\n");
  }).join("---\n\n");

  const galleryContent = [
    `# Image Prompts: ${base}`,
    "",
    `**Style:** ${options.style || "swiss-poster"}`,
    `**Visual Thread:**`,
    `- Palette: ${result.visualThread?.palette?.join(", ") || "—"}`,
    `- Motif: ${result.visualThread?.motif || "—"}`,
    `- Atmosphere: ${result.visualThread?.atmosphere || "—"}`,
    "",
    "---",
    "",
    gallery,
  ].join("\n");

  fs.writeFileSync(galleryPath, galleryContent);
  process.stderr.write(`\n  ${sage("✓")} Gallery → ${teal(galleryPath)}\n`);

  return { prompts: result, outputDir, promptsPath, galleryPath };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
  imagine — generate consistent image prompts for slide presentations

  Usage:
    node imagine.js <input.md> [options]

  Options:
    --style <name>         Image style preset (default: swiss-poster)
    --abstraction <level>  abstract | suggestive (default) | representational | literal
    --aspect <ratio>       Aspect ratio: 16:9 (default), 1:1, 9:16, 4:3
    --model <model>        Claude model (default: sonnet)
    --generate             Actually generate images (requires API key)
    --images-only          Skip prompt generation, use existing prompts.json
    --slides <range>       Only process specific slides (e.g. "1", "1-3", "1,5,10")
    --force                Re-generate images that already exist
    --engine <name>        Image engine: midjourney (default), imagen
    --imagen-model <name>  Imagen model (default: gemini-2.0-flash-preview-image-generation)
                           Options: gemini-2.0-flash-preview-image-generation
                                    gemini-3-pro-image-preview
                                    gemini-3.1-flash-image-preview
    --help                 Show this help

  Styles:
    swiss-poster    Müller-Brockmann geometric abstraction
    bauhaus         Kandinsky constructivist geometry
    editorial       Cinematic editorial photography
    data-viz        Abstract data visualization art
    collage         April Greiman digital collage
    architectural   Brutalist architecture photography
    generative      Algorithmic generative art

  Environment variables:
    GOOGLE_API_KEY         For Google Imagen generation
    MIDJOURNEY_API_KEY     For Midjourney generation
    MIDJOURNEY_API_URL     Custom Midjourney proxy URL

  Examples:
    node imagine.js slides.md
    node imagine.js slides.md --style bauhaus --aspect 1:1
    node imagine.js slides.md --style editorial --generate --engine imagen
    node imagine.js slides.md --style collage --model haiku
    `);
    process.exit(0);
  }

  const input = args[0];

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const options = {
    style: getFlag("--style") || "swiss-poster",
    abstraction: getFlag("--abstraction") || "suggestive",
    aspectRatio: getFlag("--aspect") || "16:9",
    model: getFlag("--model") || "sonnet",
    generate: args.includes("--generate") || args.includes("--images-only"),
    imagesOnly: args.includes("--images-only"),
    slides: getFlag("--slides"),
    force: args.includes("--force"),
    engine: getFlag("--engine") || "midjourney",
    imagenModel: getFlag("--imagen-model"),
    midjourneyUrl: loadEnvKeys().MIDJOURNEY_API_URL,
  };

  if (!fs.existsSync(input)) {
    console.error(`Error: file not found: ${input}`);
    process.exit(1);
  }

  imagine(input, options).catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { imagine, buildImagePrompt, IMAGE_STYLES };
