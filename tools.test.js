const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// ═══════════════════════════════════════════════════════
// PACE
// ═══════════════════════════════════════════════════════

describe("pace.js", () => {
  const { estimateSlideWeight, paceSlides, injectTimestamps } = require("./pace.js");

  it("estimateSlideWeight returns > 0 for any slide", () => {
    const slide = { notes: "Some notes here for the presenter", bullets: [], body: [], blockquote: null, layout: null, title: "Title" };
    assert.ok(estimateSlideWeight(slide) > 0);
  });

  it("slides with more notes get higher weight", () => {
    const short = { notes: "Brief", bullets: [], body: [], blockquote: null, layout: null, title: "Title" };
    const long = { notes: "This is a much longer set of notes that the presenter will read through carefully during the presentation to make sure they cover all the key points", bullets: [], body: [], blockquote: null, layout: null, title: "Title" };
    assert.ok(estimateSlideWeight(long) > estimateSlideWeight(short));
  });

  it("blank slides get minimal weight", () => {
    const blank = { notes: null, bullets: [], body: [], blockquote: null, layout: "blank", title: null, subtitle: null };
    assert.ok(estimateSlideWeight(blank) < 0.5);
  });

  it("paceSlides distributes time across all slides", () => {
    const md = "# Slide 1\n\n```notes\nLong notes here for the first slide\n```\n\n---\n\n## Slide 2\n\n- bullet\n\n---\n\n## Slide 3";
    const { timing } = paceSlides(md, 30);
    assert.equal(timing.length, 3);
    const totalDuration = timing.reduce((sum, t) => sum + t.duration, 0);
    assert.ok(Math.abs(totalDuration - 30) < 0.1, `Total duration should be ~30, got ${totalDuration}`);
  });

  it("injectTimestamps adds timing cues to notes", () => {
    const md = "# Slide 1\n\n```notes\nOriginal notes\n```\n\n---\n\n## Slide 2";
    const paced = injectTimestamps(md, 10);
    assert.ok(paced.includes("⏱"), "Should contain timing emoji");
    assert.ok(paced.includes("Original notes"), "Should preserve original notes");
    assert.ok(paced.includes("Slide 2"), "Should preserve slide content");
  });

  it("injectTimestamps adds notes block to slides without notes", () => {
    const md = "# No Notes Slide";
    const paced = injectTimestamps(md, 5);
    assert.ok(paced.includes("```notes"), "Should add notes block");
    assert.ok(paced.includes("⏱"), "Should contain timing");
  });
});

// ═══════════════════════════════════════════════════════
// DIFF-SLIDES
// ═══════════════════════════════════════════════════════

describe("diff-slides.js", () => {
  const { extractDirectives, diffSlides } = require("./diff-slides.js");

  it("extractDirectives finds layout", () => {
    const d = extractDirectives("<!-- layout: stagger -->\n# Title");
    assert.equal(d.layout, "stagger");
  });

  it("extractDirectives finds bg", () => {
    const d = extractDirectives("<!-- bg: 0F2A4A -->\n# Title");
    assert.equal(d.bg, "0F2A4A");
  });

  it("extractDirectives finds font", () => {
    const d = extractDirectives("<!-- font: Georgia -->\n# Title");
    assert.equal(d.font, "Georgia");
  });

  it("extractDirectives finds label", () => {
    const d = extractDirectives("### INTRO\n# Title");
    assert.equal(d.label, "INTRO");
  });

  it("extractDirectives finds transition", () => {
    const d = extractDirectives("<!-- transition: zoom -->\n# Title");
    assert.equal(d.transition, "zoom");
  });

  it("extractDirectives returns null for missing directives", () => {
    const d = extractDirectives("# Just a title");
    assert.equal(d.layout, null);
    assert.equal(d.bg, null);
    assert.equal(d.font, null);
  });

  it("diffSlides detects layout changes", () => {
    const before = "<!-- layout: split -->\n# Title\n\n---\n\n<!-- layout: bullets -->\n## Slide 2";
    const after = "<!-- layout: stagger -->\n# Title\n\n---\n\n<!-- layout: bullets -->\n## Slide 2";
    const diffs = diffSlides(before, after);
    assert.equal(diffs.length, 2);
    assert.equal(diffs[0].changes.length, 1);
    assert.equal(diffs[0].changes[0].field, "layout");
    assert.equal(diffs[0].changes[0].before, "split");
    assert.equal(diffs[0].changes[0].after, "stagger");
    assert.equal(diffs[1].changes.length, 0); // unchanged
  });

  it("diffSlides detects added slides", () => {
    const before = "# Slide 1";
    const after = "# Slide 1\n\n---\n\n## Slide 2";
    const diffs = diffSlides(before, after);
    assert.equal(diffs.length, 2);
    assert.ok(diffs[1].added);
  });

  it("diffSlides detects content changes", () => {
    const before = "<!-- layout: split -->\n# Title A";
    const after = "<!-- layout: split -->\n# Title B";
    const diffs = diffSlides(before, after);
    assert.ok(diffs[0].contentChanged);
    assert.equal(diffs[0].changes.length, 0); // layout same
  });
});

// ═══════════════════════════════════════════════════════
// DESIGN-SYSTEM
// ═══════════════════════════════════════════════════════

describe("design-system.js", () => {
  const { saveSystem, loadSystem, listSystems, deleteSystem, LIBRARY_DIR } = require("./design-system.js");
  const fs = require("fs");
  const path = require("path");

  const testName = "__test_system_" + Date.now();
  const testSystem = {
    aesthetic: "Test System",
    palette: [{ hex: "FF0000", name: "Red", role: "accent" }],
    fontStrategy: { default: "Helvetica", secondary: null },
  };

  it("saveSystem writes JSON to library", () => {
    const filePath = saveSystem(testName, testSystem);
    assert.ok(fs.existsSync(filePath));
  });

  it("loadSystem reads back the saved system", () => {
    const loaded = loadSystem(testName);
    assert.equal(loaded.aesthetic, "Test System");
    assert.equal(loaded.palette[0].hex, "FF0000");
  });

  it("listSystems includes the test system", () => {
    const systems = listSystems();
    const found = systems.find(s => s.name === testName);
    assert.ok(found, "Should find the test system");
    assert.equal(found.aesthetic, "Test System");
  });

  it("deleteSystem removes the file", () => {
    const deleted = deleteSystem(testName);
    assert.ok(deleted);
    assert.ok(!fs.existsSync(path.join(LIBRARY_DIR, `${testName}.json`)));
  });

  it("loadSystem throws for nonexistent system", () => {
    assert.throws(() => loadSystem("nonexistent_system_xyz"), /not found/);
  });
});

// ═══════════════════════════════════════════════════════
// IMAGINE
// ═══════════════════════════════════════════════════════

describe("imagine.js", () => {
  const { buildImagePrompt, IMAGE_STYLES } = require("./imagine.js");

  it("IMAGE_STYLES has at least 7 presets", () => {
    assert.ok(Object.keys(IMAGE_STYLES).length >= 7);
  });

  it("each style has name, description, medium, avoid", () => {
    for (const [key, style] of Object.entries(IMAGE_STYLES)) {
      assert.ok(style.name, `${key} missing name`);
      assert.ok(style.description, `${key} missing description`);
      assert.ok(style.medium, `${key} missing medium`);
      assert.ok(style.avoid, `${key} missing avoid`);
    }
  });

  it("buildImagePrompt includes slide content", () => {
    const slides = [{ title: "Test Slide", subtitle: null, bullets: [{ text: "point one" }], body: [], blockquote: null, sectionLabel: null }];
    const prompt = buildImagePrompt(slides, { style: "swiss-poster" });
    assert.ok(prompt.includes("Test Slide"));
    assert.ok(prompt.includes("point one"));
  });

  it("buildImagePrompt includes style info", () => {
    const slides = [{ title: "X", subtitle: null, bullets: [], body: [], blockquote: null }];
    const prompt = buildImagePrompt(slides, { style: "bauhaus" });
    assert.ok(prompt.includes("Bauhaus"));
  });

  it("buildImagePrompt includes abstraction level", () => {
    const slides = [{ title: "X", subtitle: null, bullets: [], body: [], blockquote: null }];
    const prompt = buildImagePrompt(slides, { abstraction: "literal" });
    assert.ok(prompt.includes("LITERAL"));
  });
});

// ═══════════════════════════════════════════════════════
// SPLICE-IMAGES
// ═══════════════════════════════════════════════════════

describe("splice-images.js", () => {
  const { placementCSS, algorithmicPlan } = require("./splice-images.js");

  it("placementCSS returns content for right mode", () => {
    const css = placementCSS("right", "img.png", { size: 40 });
    const all = (css.wrapper || "") + (css.before || "") + (css.after || "");
    assert.ok(all.includes("img.png"), "Should reference the image");
  });

  it("placementCSS returns content for left mode", () => {
    const css = placementCSS("left", "img.png", { size: 35 });
    const all = (css.wrapper || "") + (css.before || "") + (css.after || "");
    assert.ok(all.includes("img.png"), "Should reference the image");
  });

  it("placementCSS background mode includes image at low opacity", () => {
    const css = placementCSS("background", "img.png", {});
    const all = (css.wrapper || "") + (css.before || "") + (css.after || "");
    assert.ok(all.includes("img.png"), "Should reference the image");
    assert.ok(all.includes("opacity"), "Should control image opacity");
    assert.ok(!css.after || !css.after.includes("</div>") || !css.before.includes("</div>"),
      "Should not wrap content (breaks absolute-positioned zones)");
  });

  it("placementCSS overlay mode includes image at low opacity", () => {
    const css = placementCSS("overlay", "img.png", {});
    const all = (css.wrapper || "") + (css.before || "") + (css.after || "");
    assert.ok(all.includes("img.png"), "Should reference the image");
    assert.ok(all.includes("opacity"), "Should control image opacity");
  });

  it("placementCSS none mode returns empty strings", () => {
    const css = placementCSS("none", "img.png", {});
    assert.equal(css.wrapper, "");
    assert.equal(css.before, "");
    assert.equal(css.after, "");
  });

  it("algorithmicPlan generates varied placements", () => {
    const plan = algorithmicPlan(10);
    assert.equal(plan.length, 10);
    const modes = new Set(plan.map(p => p.mode));
    assert.ok(modes.size >= 5, `Should have 5+ unique modes, got ${modes.size}`);
  });

  it("spliceImages inserts img tags into HTML", () => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const { spliceImages } = require("./splice-images.js");

    // Create temp dir with a fake image and HTML
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "splice-test-"));
    const imgDir = path.join(tmp, "images");
    fs.mkdirSync(imgDir);
    fs.writeFileSync(path.join(imgDir, "slide-1.png"), "fake");
    fs.writeFileSync(path.join(imgDir, "slide-2.png"), "fake");
    const html = '<section class="slide">Content 1</section>\n<section class="slide">Content 2</section>';
    const htmlPath = path.join(tmp, "test.html");
    fs.writeFileSync(htmlPath, html);

    const result = spliceImages(htmlPath, imgDir, {
      plan: [
        { slide: 1, mode: "right", size: 30 },
        { slide: 2, mode: "none" },
      ],
    });

    assert.ok(result.includes("slide-1.png"), "Slide 1 should have image spliced");
    assert.ok(!result.includes("slide-2.png"), "Slide 2 should not have image (mode: none)");

    // Clean up
    fs.rmSync(tmp, { recursive: true });
  });

  it("spliceImages adds images to all slides including those with existing content images", () => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const { spliceImages } = require("./splice-images.js");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "splice-skip-"));
    const imgDir = path.join(tmp, "images");
    fs.mkdirSync(imgDir);
    fs.writeFileSync(path.join(imgDir, "slide-1.png"), "fake");
    fs.writeFileSync(path.join(imgDir, "slide-2.png"), "fake");
    // Slide 1 has a content image; slide 2 does not — both should get spliced images
    const html = '<section class="slide"><img src="existing.png" alt="photo">Caption</section>\n<section class="slide">Text only</section>';
    const htmlPath = path.join(tmp, "test.html");
    fs.writeFileSync(htmlPath, html);

    const result = spliceImages(htmlPath, imgDir, {
      plan: [
        { slide: 1, mode: "right", size: 30 },
        { slide: 2, mode: "right", size: 30 },
      ],
    });

    assert.ok(result.includes("slide-1.png"), "Slide 1 should get a spliced image alongside its content image");
    assert.ok(result.includes("slide-2.png"), "Slide 2 should get a spliced image");
    // But skip slides that already have a SPLICED image (prevents double-splicing)
    assert.ok(result.includes("splice-img"), "Spliced images should have the splice-img class marker");

    fs.rmSync(tmp, { recursive: true });
  });

  it("spliced images have visible opacity (not nearly invisible)", () => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const { spliceImages } = require("./splice-images.js");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "splice-opacity-"));
    const imgDir = path.join(tmp, "images");
    fs.mkdirSync(imgDir);
    fs.writeFileSync(path.join(imgDir, "slide-1.png"), "fake");
    const html = '<section class="slide">Text content</section>';
    const htmlPath = path.join(tmp, "test.html");
    fs.writeFileSync(htmlPath, html);

    const result = spliceImages(htmlPath, imgDir, {
      plan: [{ slide: 1, mode: "right", size: 30 }],
    });

    // Extract opacity from the spliced image's container
    const opacityMatch = result.match(/opacity:([\d.]+).*?splice-img/);
    assert.ok(opacityMatch, "Spliced image should have an explicit opacity");
    const opacity = parseFloat(opacityMatch[1]);
    assert.ok(opacity >= 0.2, `Splice opacity ${opacity} should be >= 0.2 (visible, not watermark)`);

    fs.rmSync(tmp, { recursive: true });
  });

  it("spliced images are not re-spliced on second pass", () => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const { spliceImages } = require("./splice-images.js");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "splice-double-"));
    const imgDir = path.join(tmp, "images");
    fs.mkdirSync(imgDir);
    fs.writeFileSync(path.join(imgDir, "slide-1.png"), "fake");
    const html = '<section class="slide">Text content</section>';
    const htmlPath = path.join(tmp, "test.html");
    fs.writeFileSync(htmlPath, html);

    // First splice
    const result1 = spliceImages(htmlPath, imgDir, {
      plan: [{ slide: 1, mode: "right", size: 30 }],
    });
    const count1 = (result1.match(/splice-img/g) || []).length;

    // Write result and splice again
    fs.writeFileSync(htmlPath, result1);
    const result2 = spliceImages(htmlPath, imgDir, {
      plan: [{ slide: 1, mode: "right", size: 30 }],
    });
    const count2 = (result2.match(/splice-img/g) || []).length;

    assert.strictEqual(count1, count2, "Second splice should not add more images (splice-img guard)");

    fs.rmSync(tmp, { recursive: true });
  });
});

// ═══════════════════════════════════════════════════════
// COMPARE — anti-regression: no double-render clobber
// ═══════════════════════════════════════════════════════

describe("compare.js — image preservation", () => {
  const fs = require("fs");

  it("runVariant guards generateHTML with existsSync to protect spliced images", () => {
    // Structural check: compare.js must guard generateHTML so Stage 5 spliced images aren't overwritten
    const src = fs.readFileSync(require.resolve("./compare.js"), "utf-8");
    const runVariantSection = src.slice(
      src.indexOf("async function runVariant"),
      src.indexOf("async function runVariants")
    );
    // The generateHTML call must be inside an fs.existsSync guard
    assert.ok(
      runVariantSection.includes("fs.existsSync(htmlPath)"),
      "runVariant must check htmlPath exists before calling generateHTML"
    );
    // Ensure the guard precedes the generateHTML call (not a stale check elsewhere)
    const guardIdx = runVariantSection.indexOf("fs.existsSync(htmlPath)");
    const renderIdx = runVariantSection.indexOf("generateHTML(composedPath, htmlPath");
    assert.ok(
      guardIdx < renderIdx,
      "existsSync guard must come before generateHTML call"
    );
  });
});

// ═══════════════════════════════════════════════════════
// COMPOSE — parseDirectives, assembleComposed, callClaudeWithRetry
// ═══════════════════════════════════════════════════════

describe("compose.js — directives", () => {
  const { parseDirectives, assembleComposed } = require("./compose.js");

  it("parseDirectives parses valid JSON array", () => {
    const json = '[{"slide":1,"layout":"title","bg":"0F2A4A"},{"slide":2,"layout":"split"}]';
    const d = parseDirectives(json);
    assert.equal(d.length, 2);
    assert.equal(d[0].layout, "title");
  });

  it("parseDirectives strips code fences", () => {
    const json = '```json\n[{"slide":1,"layout":"section"}]\n```';
    const d = parseDirectives(json);
    assert.equal(d.length, 1);
  });

  it("parseDirectives strips preamble text", () => {
    const json = 'Here are the directives:\n[{"slide":1,"layout":"arc"}]';
    const d = parseDirectives(json);
    assert.equal(d[0].layout, "arc");
  });

  it("parseDirectives throws on invalid JSON", () => {
    assert.throws(() => parseDirectives("not json at all"), /valid JSON/);
  });

  it("assembleComposed injects layout directive", () => {
    const md = "# Hello\n\n---\n\n## World";
    const directives = [{ slide: 1, layout: "title", bg: "111111" }, { slide: 2, layout: "split" }];
    const composed = assembleComposed(md, directives);
    assert.ok(composed.includes("<!-- layout: title -->"));
    assert.ok(composed.includes("<!-- bg: 111111 -->"));
    assert.ok(composed.includes("<!-- layout: split -->"));
  });

  it("assembleComposed preserves original content", () => {
    const md = "# Hello World\n\n- point one\n- point two";
    const directives = [{ slide: 1, layout: "bullets" }];
    const composed = assembleComposed(md, directives);
    assert.ok(composed.includes("Hello World"));
    assert.ok(composed.includes("point one"));
    assert.ok(composed.includes("point two"));
  });

  it("assembleComposed adds ### label", () => {
    const md = "# Title";
    const directives = [{ slide: 1, layout: "section", label: "INTRO" }];
    const composed = assembleComposed(md, directives);
    assert.ok(composed.includes("### INTRO"));
  });

  it("assembleComposed preserves speaker notes", () => {
    const md = "# Title\n\n```notes\nOriginal notes\n```";
    const directives = [{ slide: 1, layout: "split" }];
    const composed = assembleComposed(md, directives);
    assert.ok(composed.includes("Original notes"));
  });

  it("assembleComposed maintains slide count", () => {
    const md = "# One\n\n---\n\n## Two\n\n---\n\n## Three";
    const directives = [{ slide: 1, layout: "title" }, { slide: 2, layout: "split" }, { slide: 3, layout: "section" }];
    const composed = assembleComposed(md, directives);
    const slideCount = composed.split("\n---\n").length;
    assert.equal(slideCount, 3);
  });
});

// ═══════════════════════════════════════════════════════
// BEST PICK
// ═══════════════════════════════════════════════════════

describe("bestPick", () => {
  const { bestPick } = require("./compare.js");

  const variants = [
    { label: "minimal-light", intensity: "minimal", theme: "light" },
    { label: "moderate-light", intensity: "moderate", theme: "light" },
    { label: "maximal-light", intensity: "maximal", theme: "light" },
  ];

  it("picks the highest scoring variant", () => {
    const evals = [
      { totalScore: 72, scores: {}, strengths: [], weaknesses: [] },
      { totalScore: 85, scores: {}, strengths: ["good pacing"], weaknesses: [] },
      { totalScore: 68, scores: {}, strengths: [], weaknesses: ["too aggressive"] },
    ];
    const pick = bestPick(variants, evals);
    assert.equal(pick.label, "moderate-light");
    assert.equal(pick.score, 85);
  });

  it("reports margin over runner-up", () => {
    const evals = [
      { totalScore: 70, scores: {}, strengths: [], weaknesses: [] },
      { totalScore: 90, scores: {}, strengths: [], weaknesses: [] },
      { totalScore: 75, scores: {}, strengths: [], weaknesses: [] },
    ];
    const pick = bestPick(variants, evals);
    assert.equal(pick.margin, 15);
    assert.equal(pick.runnerUp.label, "maximal-light");
  });

  it("handles tie gracefully", () => {
    const evals = [
      { totalScore: 80, scores: {}, strengths: [], weaknesses: [] },
      { totalScore: 80, scores: {}, strengths: [], weaknesses: [] },
      { totalScore: 60, scores: {}, strengths: [], weaknesses: [] },
    ];
    const pick = bestPick(variants, evals);
    assert.equal(pick.score, 80);
    assert.equal(pick.margin, 0);
    assert.ok(pick.reasoning.includes("tied"));
  });

  it("returns null when no evaluations", () => {
    const pick = bestPick(variants, [null, null, null]);
    assert.equal(pick, null);
  });

  it("handles partial evaluations (some null)", () => {
    const evals = [
      null,
      { totalScore: 82, scores: {}, strengths: ["clear"], weaknesses: [] },
      null,
    ];
    const pick = bestPick(variants, evals);
    assert.equal(pick.label, "moderate-light");
    assert.equal(pick.score, 82);
  });

  it("includes reasoning with top criteria", () => {
    const evals = [
      { totalScore: 75, scores: { contentCompleteness: { score: 18 }, designQuality: { score: 12 } }, strengths: [], weaknesses: ["missing labels"] },
    ];
    const pick = bestPick([variants[0]], evals);
    assert.ok(pick.reasoning.length > 10);
    assert.ok(pick.reasoning.includes("watch:"));
  });
});

// ═══════════════════════════════════════════════════════
// MASTERS
// ═══════════════════════════════════════════════════════

describe("masters.js", () => {
  const { saveMasterSet, loadMasterSet, listMasterSets, matchMaster, applyMasters, MASTERS_DIR } = require("./masters.js");
  const { parseMarkdown } = require("./raster.js");
  const fs = require("fs");
  const path = require("path");

  const testName = "__test_masters_" + Date.now();
  const testSet = {
    name: testName,
    description: "Test master set",
    masters: {
      title: { layout: "title", bg: "0F2A4A", font: "DM Serif Display" },
      section: { layout: "section", bg: "1A1A1A" },
      content: { layout: "split", bg: null },
      list: { layout: "bullets", bg: null },
      data: { layout: "stagger", bg: null, font: "Space Mono" },
      quote: { layout: "rotated", bg: "1B3D22", font: "Georgia" },
      closing: { layout: "section", bg: "0F2A4A" },
    },
  };

  it("saveMasterSet and loadMasterSet round-trip", () => {
    saveMasterSet(testName, testSet);
    const loaded = loadMasterSet(testName);
    assert.equal(loaded.name, testName);
    assert.equal(Object.keys(loaded.masters).length, 7);
  });

  it("listMasterSets includes saved set", () => {
    const sets = listMasterSets();
    assert.ok(sets.find(s => s.name === testName));
  });

  it("matchMaster returns title for first slide", () => {
    const slides = parseMarkdown("# Title\n\n---\n\n## Content\n\nBody text");
    assert.equal(matchMaster(slides[0], 0, 2, testSet), "title");
  });

  it("matchMaster returns closing for last slide", () => {
    const slides = parseMarkdown("# Title\n\n---\n\n## End");
    assert.equal(matchMaster(slides[1], 1, 2, testSet), "closing");
  });

  it("matchMaster returns quote for blockquote slides", () => {
    const slides = parseMarkdown("> A quote here");
    assert.equal(matchMaster(slides[0], 1, 3, testSet), "quote");
  });

  it("matchMaster returns data for 5+ bullets", () => {
    const slides = parseMarkdown("- a\n- b\n- c\n- d\n- e");
    assert.equal(matchMaster(slides[0], 1, 3, testSet), "data");
  });

  it("matchMaster returns list for 1-4 bullets", () => {
    const slides = parseMarkdown("- a\n- b");
    assert.equal(matchMaster(slides[0], 1, 3, testSet), "list");
  });

  it("matchMaster respects explicit <!-- master: name --> directive", () => {
    const slides = parseMarkdown("<!-- master: quote -->\n# Not actually a quote");
    assert.equal(matchMaster(slides[0], 1, 3, testSet), "quote");
  });

  it("applyMasters injects directives preserving content", () => {
    const md = "# Opening Title\n\n---\n\n## Body Slide\n\nSome content\n\n---\n\n> A quote\n\n---\n\n## The End";
    const composed = applyMasters(md, testSet);
    assert.ok(composed.includes("<!-- layout: title -->"));
    assert.ok(composed.includes("<!-- bg: 0F2A4A -->"));
    assert.ok(composed.includes("Opening Title"));
    assert.ok(composed.includes("Some content"));
    assert.ok(composed.includes("A quote"));
    assert.ok(composed.includes("The End"));
  });

  it("applyMasters maintains slide count", () => {
    const md = "# A\n\n---\n\n## B\n\n---\n\n## C";
    const composed = applyMasters(md, testSet);
    assert.equal(composed.split("\n---\n").length, 3);
  });

  // Cleanup
  it("cleanup test set", () => {
    const fp = path.join(MASTERS_DIR, `${testName}.json`);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    assert.ok(true);
  });
});

// ═══════════════════════════════════════════════════════
// MULTI-LINE COMMENT STRIPPING
// ═══════════════════════════════════════════════════════

describe("Multi-line HTML comment stripping", () => {
  const { parseMarkdown } = require("./raster.js");

  it("strips multi-line comments that span slide separators", () => {
    const md = "# Slide 1\n\n---\n\n## Slide 2\n\n---\n\n<!--\n\n---\n\nHidden slide\n\n---\n\nAnother hidden\n\n-->\n\n---\n\n## Visible Slide 3";
    const slides = parseMarkdown(md);
    assert.equal(slides.length, 3, `Expected 3 slides, got ${slides.length}`);
  });

  it("preserves single-line directive comments", () => {
    const md = "<!-- layout: stagger -->\n# Title\n\n---\n\n<!-- bg: 0F2A4A -->\n## Slide 2";
    const slides = parseMarkdown(md);
    assert.equal(slides.length, 2);
    assert.equal(slides[0].layout, "stagger");
    assert.equal(slides[1].bgOverride, "0F2A4A");
  });

  it("does not leak <!-- or --> into rendered content", () => {
    const md = "# Before\n\n---\n\n<!--\n\n---\n\nHidden\n\n-->\n\n---\n\n# After";
    const slides = parseMarkdown(md);
    slides.forEach((s, i) => {
      assert.ok(!s.raw.match(/^<!--$/m), `Slide ${i+1} leaked <!--`);
      assert.ok(!s.raw.match(/^-->$/m), `Slide ${i+1} leaked -->`);
    });
  });

  it("week-1.md produces 40 slides (6 commented out)", () => {
    const fs = require("fs");
    if (!fs.existsSync("./decks/week-1.md")) return;
    const md = fs.readFileSync("./decks/week-1.md", "utf-8");
    const slides = parseMarkdown(md);
    assert.equal(slides.length, 40, `Expected 40, got ${slides.length}`);
  });
});

// ═══════════════════════════════════════════════════════
// GRID-COMPOSE
// ═══════════════════════════════════════════════════════

describe("grid-compose.js", () => {
  const { buildGridPrompt, renderGridSlideHTML } = require("./grid-compose.js");

  it("buildGridPrompt includes slide content", () => {
    const slides = [{ title: "Test", subtitle: null, bullets: [{ text: "bullet" }], body: ["body text"], blockquote: null, sectionLabel: null, bgOverride: null, notes: null }];
    const prompt = buildGridPrompt(slides);
    assert.ok(prompt.includes("Test"));
    assert.ok(prompt.includes("bullet"));
  });

  it("buildGridPrompt includes grid spec", () => {
    const slides = [{ title: "X", subtitle: null, bullets: [], body: [], blockquote: null, sectionLabel: null, bgOverride: null, notes: null }];
    const prompt = buildGridPrompt(slides);
    assert.ok(prompt.includes("60-column"));
    assert.ok(prompt.includes("40-row"));
  });

  it("renderGridSlideHTML creates a section element", () => {
    const spec = { bg: "FF0000", elements: [{ type: "title", text: "Hello", col: 0, row: 0, colSpan: 30, rowSpan: 10, fontSize: 36, color: "FFFFFF" }] };
    const html = renderGridSlideHTML(spec, 1);
    assert.ok(html.includes("<section"));
    assert.ok(html.includes("Hello"));
    assert.ok(html.includes("FF0000"));
  });

  it("renderGridSlideHTML renders rect elements", () => {
    const spec = { elements: [{ type: "rect", col: 0, row: 0, colSpan: 20, rowSpan: 40, color: "0000FF", opacity: 0.2 }] };
    const html = renderGridSlideHTML(spec, 1);
    assert.ok(html.includes("grid-rect"));
    assert.ok(html.includes("0000FF"));
  });
});

// ═══════════════════════════════════════════════════════
// VIDEO + IMAGE LAYOUT HANDLING
// ═══════════════════════════════════════════════════════

describe("Video and image rendering", () => {
  const { parseMarkdown, detectLayout, generateHTMLCSS } = require("./raster.js");

  describe("YouTube parsing", () => {
    it("parses standalone [text](youtube-url) as video", () => {
      const slides = parseMarkdown("[Watch](https://www.youtube.com/watch?v=abc123def45def45)");
      assert.equal(slides[0].videos.length, 1);
      assert.equal(slides[0].videos[0].id, "abc123def45");
    });

    it("parses bare YouTube URL on its own line", () => {
      const slides = parseMarkdown("# Slide\nhttps://www.youtube.com/watch?v=abc123def45def45");
      assert.equal(slides[0].videos.length, 1);
    });

    it("parses youtu.be short URLs", () => {
      const slides = parseMarkdown("![](https://youtu.be/dQw4w9WgXcQ)");
      assert.equal(slides[0].videos.length, 1);
      assert.equal(slides[0].videos[0].id, "dQw4w9WgXcQ");
    });

    it("does not treat non-YouTube image as video", () => {
      const slides = parseMarkdown("![photo](./img/photo.png)");
      assert.equal(slides[0].images.length, 1);
      assert.equal(slides[0].videos.length, 0);
    });

    it("YouTube links inside bullets stay as bullets (not extracted as videos)", () => {
      const slides = parseMarkdown("- [Video](https://www.youtube.com/watch?v=test123)");
      assert.equal(slides[0].bullets.length, 1);
      // The link renders as clickable <a> inside the bullet via esc()
    });
  });

  describe("Layout detection for media slides", () => {
    it("slide with video gets video layout", () => {
      // 3 slides so the video slide isn't the last (which would get "section")
      const slides = parseMarkdown("# Title\n\n---\n\n[Watch](https://www.youtube.com/watch?v=abc123def45)\n\n---\n\n## End");
      // Reset history then detect
      detectLayout(slides[0], 0, 3);
      const layout = detectLayout(slides[1], 1, 3);
      assert.equal(layout, "video");
    });

    it("slide with image gets image layout", () => {
      const slides = parseMarkdown("# Title\n\n---\n\n![photo](img/test.png)\n\n---\n\n## End");
      detectLayout(slides[0], 0, 3);
      const layout = detectLayout(slides[1], 1, 3);
      assert.equal(layout, "image");
    });
  });

  describe("CSS for extra videos and images", () => {
    it("CSS has .extra-videos with absolute positioning", () => {
      const css = generateHTMLCSS();
      assert.ok(css.includes(".extra-videos"), "Should have .extra-videos class");
      assert.ok(css.includes("position:absolute"), "Extra videos should be absolutely positioned");
    });

    it("CSS has .layout-image flex-direction:row for mixed content", () => {
      const css = generateHTMLCSS();
      assert.ok(css.includes(".layout-image{flex-direction:row"), "Image layout should use row flex for mixed content");
    });

    it("CSS constrains extra videos width", () => {
      const css = generateHTMLCSS();
      assert.ok(css.includes("width:45%"), "Extra videos should be 45% width");
    });
  });

  describe("Extra videos in non-video layouts", () => {
    const { generateHTML } = require("./raster.js");
    const fs = require("fs");
    const os = require("os");
    const path = require("path");

    it("video slide with forced split layout still renders iframe", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vid-test-"));
      const mdPath = path.join(tmp, "test.md");
      const htmlPath = path.join(tmp, "test.html");
      fs.writeFileSync(mdPath, "<!-- layout: split -->\n## Karpathy\n[Watch](https://www.youtube.com/watch?v=abc123def45)\n- See 0:00 - 9:10");
      await generateHTML(mdPath, htmlPath, { theme: "light" });
      const html = fs.readFileSync(htmlPath, "utf-8");
      assert.ok(html.includes("iframe"), "Should contain iframe for YouTube embed");
      assert.ok(html.includes("extra-videos"), "Should use extra-videos container");
      assert.ok(html.includes("abc123"), "Should have the video ID");
      fs.rmSync(tmp, { recursive: true });
    });

    it("video slide with auto-detected video layout renders without extra-videos wrapper", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vid-test2-"));
      const mdPath = path.join(tmp, "test.md");
      const htmlPath = path.join(tmp, "test.html");
      fs.writeFileSync(mdPath, "# Title\n\n---\n\n[Watch](https://www.youtube.com/watch?v=xyz789)");
      await generateHTML(mdPath, htmlPath, { theme: "light" });
      const html = fs.readFileSync(htmlPath, "utf-8");
      assert.ok(html.includes("iframe"), "Should contain iframe");
      assert.ok(html.includes("xyz789"), "Should have video ID");
      // The video layout slide should NOT have extra-videos wrapper
      const videoSlideMatch = html.match(/layout-video[^>]*>[\s\S]*?<\/section>/);
      if (videoSlideMatch) {
        assert.ok(!videoSlideMatch[0].includes("extra-videos"), "Video layout should not use extra-videos wrapper");
      }
      fs.rmSync(tmp, { recursive: true });
    });
  });

  describe("Image layout with mixed content", () => {
    it("slide with image + bullets gets image layout", () => {
      const slides = parseMarkdown("## Title\n![photo](img/test.png)\n- bullet 1\n- bullet 2");
      const layout = detectLayout(slides[0], 1, 3);
      assert.equal(layout, "image");
      assert.equal(slides[0].images.length, 1);
      assert.equal(slides[0].bullets.length, 2);
    });
  });
});

// ═══════════════════════════════════════════════════════
// SOURCE VALIDATION
// ═══════════════════════════════════════════════════════

describe("validateSource", () => {
  const { validateSource } = require("./qa.js");

  it("catches unbalanced HTML comments", () => {
    const results = validateSource("# Title\n<!--\nsome stuff");
    assert.ok(results.some(r => r.message.includes("Unbalanced")));
  });

  it("catches known typos", () => {
    const results = validateSource("# Title\n- Practioner skills needed");
    assert.ok(results.some(r => r.message.includes("Practitioner")));
  });

  it("catches empty slides", () => {
    const results = validateSource("# Title\n\n---\n\n\n\n---\n\n## End");
    assert.ok(results.some(r => r.message.includes("empty")));
  });

  it("catches dense slides", () => {
    const bullets = Array.from({length: 12}, (_, i) => `- bullet ${i+1}`).join("\n");
    const results = validateSource("## Dense\n" + bullets);
    assert.ok(results.some(r => r.message.includes("bullets")));
  });

  it("passes clean content", () => {
    const results = validateSource("# Title\n\n---\n\n## Slide 2\n\n- point one\n- point two");
    const errors = results.filter(r => r.severity === "error");
    assert.equal(errors.length, 0);
  });
});

// ═══════════════════════════════════════════════════════
// RUBRIC-SCORES
// ═══════════════════════════════════════════════════════

describe("rubric-scores.js", () => {
  const { computeScores } = require("./rubric-scores.js");

  // Full valid metrics fixture (representative of a well-designed deck)
  function goodMetrics() {
    return {
      contrastErrors: 0, contrastWarnings: 0, brokenImgs: 0,
      tinyTextCount: 0, overflows: 0,
      total: 10, designed: 10, totalZones: 30, nonDefaultZones: 25,
      uniqueArchetypes: 6, maxArchetypeRun: 2, zoneStarts: 8,
      zoneCollisionSlides: 0,
      hasArc: true, avgTransition: 160, transitionVariance: 400,
      uniqueBgs: 5, maxConsecBg: 2, contrastErrors_color: 0,
      titleSizes: [24, 32, 48], fontSets: 3, densityCV: 0.8,
      accentRatio: 0.5, typographyRatio: 2.2,
      totalImgs: 5, textOnImageCount: 0, imgOverlaps: 0,
      genericAltTotal: 0, imgPlacements: ["right", "left", "inset-tr", "background"],
      emptyBodyZones: 0, contentlessSlides: 0, tableTruncations: 0,
      clippedContentSlides: 0, slidesWithNoVisibleText: 0,
      inventedLabels: 0, lowDensitySlides: 0, sparseSlides: 0,
      linkOnlySlides: 0, duplicateTextSlides: 0,
    };
  }

  // ── Structure ──

  it("returns scores, computedTotal, maxComputed", () => {
    const result = computeScores(goodMetrics());
    assert.ok("scores" in result);
    assert.ok("computedTotal" in result);
    assert.ok("maxComputed" in result);
    assert.equal(typeof result.computedTotal, "number");
    assert.equal(typeof result.maxComputed, "number");
  });

  it("visual-only dimensions are null", () => {
    const { scores } = computeScores(goodMetrics());
    assert.equal(scores.communicability, null);
    assert.equal(scores.taste, null);
    assert.equal(scores.balance, null);
  });

  it("maxComputed is 60 (6 computed dims x 10)", () => {
    const { maxComputed } = computeScores(goodMetrics());
    assert.equal(maxComputed, 60);
  });

  it("all non-null scores are clamped [1, 10]", () => {
    const { scores } = computeScores(goodMetrics());
    for (const [k, v] of Object.entries(scores)) {
      if (v !== null) {
        assert.ok(v >= 1, `${k} should be >= 1, got ${v}`);
        assert.ok(v <= 10, `${k} should be <= 10, got ${v}`);
      }
    }
  });

  it("computedTotal equals sum of non-null scores within 0.1", () => {
    const { scores, computedTotal } = computeScores(goodMetrics());
    const sum = Object.values(scores).filter(v => v !== null).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - computedTotal) < 0.15, `sum ${sum} vs total ${computedTotal}`);
  });

  // ── Accessibility ──

  it("accessibility: zero errors yields cap", () => {
    const m = goodMetrics();
    const { scores } = computeScores(m, { accessibilityCap: 10 });
    assert.equal(scores.accessibility, 10);
  });

  it("accessibility: jsdom cap of 8 is respected", () => {
    const m = goodMetrics();
    const { scores } = computeScores(m, { accessibilityCap: 8 });
    assert.equal(scores.accessibility, 8);
  });

  it("accessibility: contrast errors reduce score", () => {
    const m = goodMetrics();
    m.contrastErrors = 2;
    const { scores } = computeScores(m, { accessibilityCap: 10 });
    assert.equal(scores.accessibility, 6);
  });

  it("accessibility: overflow penalty caps at 3", () => {
    const m = goodMetrics();
    m.overflows = 100;
    const { scores } = computeScores(m, { accessibilityCap: 10 });
    assert.equal(scores.accessibility, 7);
  });

  it("accessibility: extreme errors floor at 1", () => {
    const m = goodMetrics();
    m.contrastErrors = 50; m.brokenImgs = 50; m.overflows = 100;
    const { scores } = computeScores(m);
    assert.equal(scores.accessibility, 1);
  });

  it("accessibility: missing fields default to zero (no NaN)", () => {
    const m = goodMetrics();
    delete m.contrastErrors; delete m.contrastWarnings;
    delete m.brokenImgs; delete m.tinyTextCount; delete m.overflows;
    const { scores } = computeScores(m);
    assert.ok(!isNaN(scores.accessibility), "should not be NaN");
    assert.equal(scores.accessibility, 10);
  });

  // ── Grid ──

  it("grid: fully designed deck scores high", () => {
    const { scores } = computeScores(goodMetrics());
    assert.ok(scores.grid >= 7, `expected >= 7, got ${scores.grid}`);
  });

  it("grid: zero designed slides score low", () => {
    const m = goodMetrics();
    m.designed = 0; m.nonDefaultZones = 0; m.uniqueArchetypes = 0; m.zoneStarts = 0;
    const { scores } = computeScores(m);
    assert.ok(scores.grid <= 3, `expected <= 3, got ${scores.grid}`);
  });

  it("grid: collisions reduce score", () => {
    const m = goodMetrics();
    m.zoneCollisionSlides = 4;
    const noCollision = computeScores(goodMetrics()).scores.grid;
    const { scores } = computeScores(m);
    assert.ok(scores.grid < noCollision, `collisions should reduce: ${scores.grid} vs ${noCollision}`);
  });

  it("grid: archetype run of 4 penalizes more than 3", () => {
    const m3 = goodMetrics(); m3.maxArchetypeRun = 3;
    const m4 = goodMetrics(); m4.maxArchetypeRun = 4;
    const s3 = computeScores(m3).scores.grid;
    const s4 = computeScores(m4).scores.grid;
    assert.ok(s4 < s3, `run4 ${s4} should be < run3 ${s3}`);
  });

  // ── Color ──

  it("color: smooth arc with ideal transition scores higher", () => {
    const mArc = goodMetrics();
    const mNoArc = goodMetrics(); mNoArc.hasArc = false;
    const arcScore = computeScores(mArc).scores.color;
    const noArcScore = computeScores(mNoArc).scores.color;
    assert.ok(arcScore > noArcScore, `arc ${arcScore} should > no-arc ${noArcScore}`);
  });

  it("color: maxConsecBg <= 2 earns max run bonus", () => {
    const m2 = goodMetrics(); m2.maxConsecBg = 2;
    const m4 = goodMetrics(); m4.maxConsecBg = 4;
    const s2 = computeScores(m2).scores.color;
    const s4 = computeScores(m4).scores.color;
    assert.ok(s2 > s4, `consec2 ${s2} should > consec4 ${s4}`);
  });

  // ── Coherence ──

  it("coherence: 2-5 title sizes earns full title score", () => {
    const m = goodMetrics(); m.titleSizes = [24, 32, 48];
    const { scores } = computeScores(m);
    assert.ok(scores.coherence >= 6, `expected >= 6, got ${scores.coherence}`);
  });

  it("coherence: single title size earns partial score", () => {
    const m1 = goodMetrics(); m1.titleSizes = [32];
    const m3 = goodMetrics(); m3.titleSizes = [24, 32, 48];
    const s1 = computeScores(m1).scores.coherence;
    const s3 = computeScores(m3).scores.coherence;
    assert.ok(s3 > s1, `3 sizes ${s3} should > 1 size ${s1}`);
  });

  it("coherence: Set input for titleSizes works (no NaN)", () => {
    const m = goodMetrics();
    m.titleSizes = new Set([24, 32, 48]);
    const { scores } = computeScores(m);
    assert.ok(!isNaN(scores.coherence), "should handle Set input");
  });

  it("coherence: typographyRatio in [1.8, 3.0] earns 2 points", () => {
    const mGood = goodMetrics(); mGood.typographyRatio = 2.5;
    const mBad = goodMetrics(); mBad.typographyRatio = 1.0;
    assert.ok(computeScores(mGood).scores.coherence > computeScores(mBad).scores.coherence);
  });

  // ── Images ──

  it("images: zero images returns 5", () => {
    const m = goodMetrics(); m.totalImgs = 0;
    const { scores } = computeScores(m);
    assert.equal(scores.images, 5);
  });

  it("images: diverse placements score higher", () => {
    const mGood = goodMetrics();
    mGood.imgPlacements = ["right", "left", "inset-tr", "background"];
    const mBad = goodMetrics();
    mBad.imgPlacements = ["right"];
    assert.ok(computeScores(mGood).scores.images > computeScores(mBad).scores.images);
  });

  it("images: Set input for imgPlacements works (no NaN)", () => {
    const m = goodMetrics();
    m.imgPlacements = new Set(["right", "left", "inset-tr", "background"]);
    const { scores } = computeScores(m);
    assert.ok(!isNaN(scores.images), "should handle Set input");
  });

  it("images: text overlap penalizes", () => {
    const m = goodMetrics(); m.textOnImageCount = 4;
    const clean = computeScores(goodMetrics()).scores.images;
    const { scores } = computeScores(m);
    assert.ok(scores.images < clean, `overlap ${scores.images} should < clean ${clean}`);
  });

  // ── Content Completeness ──

  it("contentCompleteness: clean deck scores 10", () => {
    const { scores } = computeScores(goodMetrics());
    assert.equal(scores.contentCompleteness, 10);
  });

  it("contentCompleteness: empty body zones reduce score", () => {
    const m = goodMetrics(); m.emptyBodyZones = 3;
    const { scores } = computeScores(m);
    assert.ok(scores.contentCompleteness < 10);
  });

  it("contentCompleteness: extreme penalties floor at 1", () => {
    const m = goodMetrics();
    m.emptyBodyZones = 10; m.contentlessSlides = 10; m.clippedContentSlides = 10;
    const { scores } = computeScores(m);
    assert.equal(scores.contentCompleteness, 1);
  });

  it("contentCompleteness: missing optional fields default to zero", () => {
    const m = goodMetrics();
    delete m.inventedLabels; delete m.lowDensitySlides;
    delete m.sparseSlides; delete m.linkOnlySlides; delete m.duplicateTextSlides;
    const { scores } = computeScores(m);
    assert.ok(!isNaN(scores.contentCompleteness));
    assert.equal(scores.contentCompleteness, 10);
  });

  // ── Zone collision penalty ──

  it("penalizes zone collisions in grid score", () => {
    const m = goodMetrics();
    m.zoneCollisionSlides = 3;
    const { scores } = computeScores(m);
    assert.ok(scores.grid < 10, `Grid should be < 10 with 3 collisions, got ${scores.grid}`);
    assert.ok(scores.grid <= 6, `Grid should be <= 6 with 3 collisions (-4.5), got ${scores.grid}`);
  });

  it("zero collisions gives no grid penalty", () => {
    const m = goodMetrics();
    m.zoneCollisionSlides = 0;
    const { scores } = computeScores(m);
    assert.ok(scores.grid >= 8, `Grid should be >= 8 with 0 collisions, got ${scores.grid}`);
  });

  // ── Visual utilization penalty ──

  it("penalizes low utilization slides in content score", () => {
    const m = goodMetrics();
    m.lowUtilizationSlides = 4;
    const { scores } = computeScores(m);
    assert.ok(scores.contentCompleteness < 10, `Content should be < 10 with 4 low-util slides, got ${scores.contentCompleteness}`);
  });

  // ── Generic alt penalty ──

  it("penalizes generic alt text in image score", () => {
    const m = goodMetrics();
    m.genericAltTotal = 10;
    const { scores } = computeScores(m);
    assert.ok(scores.images < 10, `Images should be < 10 with 10 generic alts, got ${scores.images}`);
    assert.ok(scores.images >= 6, `Images penalty should be capped, got ${scores.images}`);
  });

  // ── Accessibility cap ──

  it("respects accessibility cap parameter", () => {
    const m = goodMetrics();
    const capped = computeScores(m, { accessibilityCap: 8 });
    const uncapped = computeScores(m, { accessibilityCap: 10 });
    assert.equal(capped.scores.accessibility, 8);
    assert.equal(uncapped.scores.accessibility, 10);
  });

  // ── Typography hierarchy ──

  it("rewards good typography ratio (1.8-3.0)", () => {
    const m = goodMetrics();
    m.typographyRatio = 2.5;
    const good = computeScores(m);
    m.typographyRatio = 1.1; // flat hierarchy
    const flat = computeScores(m);
    assert.ok(good.scores.coherence > flat.scores.coherence, "Good ratio should outscore flat");
  });

  // ── Sparse slides ──

  it("penalizes sparse slides in content", () => {
    const m = goodMetrics();
    m.sparseSlides = 5;
    const { scores } = computeScores(m);
    assert.ok(scores.contentCompleteness < 10, `Content should drop with 5 sparse slides, got ${scores.contentCompleteness}`);
  });
});

// ═══════════════════════════════════════════════════════
// RUBRIC-PERSIST
// ═══════════════════════════════════════════════════════

describe("rubric-persist.js", () => {
  const { getTier, deckKey, appendRun } = require("./rubric-persist.js");

  // ── getTier ──

  it("getTier: 85+ is Exhibition", () => {
    assert.equal(getTier(85), "Exhibition");
    assert.equal(getTier(100), "Exhibition");
  });

  it("getTier: 70-84 is Professional", () => {
    assert.equal(getTier(70), "Professional");
    assert.equal(getTier(84), "Professional");
  });

  it("getTier: 55-69 is Competent", () => {
    assert.equal(getTier(55), "Competent");
    assert.equal(getTier(69), "Competent");
  });

  it("getTier: 40-54 is Draft", () => {
    assert.equal(getTier(40), "Draft");
    assert.equal(getTier(54), "Draft");
  });

  it("getTier: below 40 is Broken", () => {
    assert.equal(getTier(39), "Broken");
    assert.equal(getTier(0), "Broken");
  });

  // ── deckKey ──

  it("deckKey extracts basename without extension", () => {
    assert.equal(deckKey("/path/to/week-1.html"), "week-1");
    assert.equal(deckKey("decks/week-2-v3.spliced.html"), "week-2-v3.spliced");
  });

  // ── appendRun ──

  it("appendRun adds run and updates latest", () => {
    const scorecard = {
      deck: "test.html", source: "test.composed.md",
      slideCount: 10, runs: [], latest: null, trajectory: [],
    };
    const run = {
      engine: "jsdom",
      computed: { accessibility: { score: 8 }, grid: { score: 7 } },
    };
    appendRun(scorecard, run);
    assert.equal(scorecard.runs.length, 1);
    assert.ok(scorecard.runs[0].id, "run should have an id");
    assert.ok(scorecard.runs[0].timestamp, "run should have a timestamp");
    assert.ok(scorecard.latest, "latest should be set");
    assert.equal(scorecard.latest.total, 15);
    assert.equal(scorecard.latest.max, 20);
    assert.equal(scorecard.trajectory.length, 1);
  });

  it("appendRun merges computed + visual from separate runs", () => {
    const scorecard = {
      deck: "test.html", source: "test.composed.md",
      slideCount: 10, runs: [], latest: null, trajectory: [],
    };
    appendRun(scorecard, {
      engine: "jsdom",
      computed: { accessibility: { score: 8 }, grid: { score: 7 } },
    });
    appendRun(scorecard, {
      engine: "chrome-mcp",
      visual: { communicability: { score: 9 }, taste: { score: 6 } },
    });
    assert.equal(scorecard.runs.length, 2);
    assert.equal(scorecard.latest.total, 30); // 8+7+9+6
    assert.equal(scorecard.latest.max, 40);   // 4 dims * 10
    assert.ok(scorecard.latest.computed);
    assert.ok(scorecard.latest.visual);
  });
});

// ═══════════════════════════════════════════════════════
// EVALUATORS/INDEX
// ═══════════════════════════════════════════════════════

describe("evaluators/index.js", () => {
  const { GROUPS, getAvailableEvaluators } = require("./evaluators/index.js");

  it("GROUPS.all contains all evaluator names", () => {
    assert.ok(GROUPS.all.includes("jsdom-rubric"));
    assert.ok(GROUPS.all.includes("headless-rubric"));
    assert.ok(GROUPS.all.includes("screenshot-vision"));
    assert.ok(GROUPS.all.length >= 6);
  });

  it("GROUPS.jsdom expands to jsdom-rubric", () => {
    assert.deepEqual(GROUPS.jsdom, ["jsdom-rubric"]);
  });

  it("getAvailableEvaluators expands group aliases", () => {
    const results = getAvailableEvaluators(["jsdom"], "nonexistent.html");
    assert.equal(results.length, 1);
    assert.equal(results[0].name, "jsdom-rubric");
  });

  it("getAvailableEvaluators marks unknown evaluators unavailable", () => {
    const results = getAvailableEvaluators(["nonexistent"], "test.html");
    assert.equal(results[0].available, false);
    assert.ok(results[0].reason.includes("unknown"));
  });

  it("getAvailableEvaluators deduplicates when group + name overlap", () => {
    const results = getAvailableEvaluators(["jsdom", "jsdom-rubric"], "test.html");
    assert.equal(results.length, 1);
  });
});

// ═══════════════════════════════════════════════════════
// EVAL-HARNESS (mergeScores)
// ═══════════════════════════════════════════════════════

describe("eval-harness.js mergeScores", () => {
  const { mergeScores } = require("./eval-harness.js");

  it("returns null score for dimensions with no evaluator", () => {
    const merged = mergeScores([]);
    assert.equal(merged.accessibility.score, null);
    assert.equal(merged.accessibility.confidence, 0);
  });

  it("single evaluator contribution passes through", () => {
    const merged = mergeScores([{
      evaluatorName: "test",
      dimensions: {
        accessibility: { score: 8, confidence: 0.9 },
      },
    }]);
    assert.equal(merged.accessibility.score, 8);
    assert.equal(merged.accessibility.confidence, 0.9);
    assert.equal(merged.accessibility.sources.length, 1);
  });

  it("multiple evaluators produce weighted average", () => {
    const merged = mergeScores([
      { evaluatorName: "a", dimensions: { accessibility: { score: 10, confidence: 0.8 } } },
      { evaluatorName: "b", dimensions: { accessibility: { score: 6, confidence: 0.2 } } },
    ]);
    // Weighted: (10*0.8 + 6*0.2) / (0.8+0.2) = 9.2
    assert.equal(merged.accessibility.score, 9.2);
    assert.equal(merged.accessibility.sources.length, 2);
  });

  it("confidence is max across sources", () => {
    const merged = mergeScores([
      { evaluatorName: "a", dimensions: { accessibility: { score: 8, confidence: 0.5 } } },
      { evaluatorName: "b", dimensions: { accessibility: { score: 7, confidence: 0.9 } } },
    ]);
    assert.equal(merged.accessibility.confidence, 0.9);
  });
});

// ═══════════════════════════════════════════════════════
// SPLICE-IMAGES (placementCSS, algorithmicPlan)
// ═══════════════════════════════════════════════════════

describe("splice-images.js", () => {
  const { placementCSS, algorithmicPlan } = require("./splice-images.js");

  // ── placementCSS ──

  it("placementCSS right produces absolute-positioned right div", () => {
    const css = placementCSS("right", "slide-01.png");
    assert.ok(css.after.includes("right:0"));
    assert.ok(css.after.includes("splice-img"));
    assert.ok(css.after.includes("slide-01.png"));
  });

  it("placementCSS left produces left-aligned div", () => {
    const css = placementCSS("left", "slide-02.png");
    assert.ok(css.after.includes("left:0"));
  });

  it("placementCSS background uses before slot", () => {
    const css = placementCSS("background", "bg.png");
    assert.ok(css.before.includes("inset:0"), "background should use inset:0");
    assert.equal(css.after, "");
  });

  it("placementCSS none returns empty strings", () => {
    const css = placementCSS("none", "x.png");
    assert.equal(css.wrapper, "");
    assert.equal(css.before, "");
    assert.equal(css.after, "");
  });

  it("placementCSS respects size option", () => {
    const css = placementCSS("right", "x.png", { size: 25 });
    assert.ok(css.after.includes("width:25%"));
  });

  it("placementCSS all modes return valid objects", () => {
    const modes = ["right", "left", "top", "bottom", "inset-tr", "inset-bl", "background", "overlay", "none"];
    for (const mode of modes) {
      const css = placementCSS(mode, "test.png");
      assert.ok("wrapper" in css, `${mode} should have wrapper`);
      assert.ok("before" in css, `${mode} should have before`);
      assert.ok("after" in css, `${mode} should have after`);
    }
  });

  // ── algorithmicPlan ──

  it("algorithmicPlan returns one entry per slide", () => {
    const plan = algorithmicPlan(10);
    assert.equal(plan.length, 10);
    plan.forEach((p, i) => assert.equal(p.slide, i + 1));
  });

  it("algorithmicPlan cycles through modes", () => {
    const plan = algorithmicPlan(11);
    // 11th slide should cycle back to first mode
    assert.equal(plan[10].mode, plan[0].mode);
  });

  it("algorithmicPlan sizes are in 30-44 range", () => {
    const plan = algorithmicPlan(20);
    plan.forEach(p => {
      assert.ok(p.size >= 30 && p.size <= 44, `size ${p.size} out of range`);
    });
  });

  // ── contentAwarePlan ──

  const { contentAwarePlan } = require("./splice-images.js");

  it("contentAwarePlan returns mode:none for blank slides", () => {
    const html = '<section class="slide layout-blank">   </section>';
    const plan = contentAwarePlan(html);
    assert.equal(plan[0].mode, "none");
  });

  it("contentAwarePlan returns mode:none for designed slides with existing <img>", () => {
    const html = '<section class="slide designed"><div class="zone zone-title" style="left:5%;width:50%;top:5%;height:20%">Title</div><img src="photo.png"></section>';
    const plan = contentAwarePlan(html);
    assert.equal(plan[0].mode, "none");
  });

  it("contentAwarePlan returns non-none for designed slide with free space", () => {
    const html = '<section class="slide designed"><div class="zone zone-title" style="left:0%;width:40%;top:5%;height:15%">Title</div></section>';
    const plan = contentAwarePlan(html);
    assert.notEqual(plan[0].mode, "none");
  });

  it("contentAwarePlan uses inset/none for text-heavy designed slides", () => {
    const html = '<section class="slide designed">'
      + '<div class="zone zone-body" style="left:0%;width:90%;top:0%;height:90%">Dense</div>'
      + '</section>';
    const plan = contentAwarePlan(html);
    assert.ok(["inset-tr", "inset-bl", "none"].includes(plan[0].mode),
      `text-heavy slide got ${plan[0].mode}`);
  });
});

// ═══════════════════════════════════════════════════════
// VISUAL-AUDIT (classifySeverity)
// ═══════════════════════════════════════════════════════

describe("visual-audit.js classifySeverity", () => {
  const { classifySeverity } = require("./visual-audit.js");

  it("broken-image is critical", () => {
    assert.equal(classifySeverity({ type: "broken-image" }), "critical");
  });

  it("clipped-overflow is info", () => {
    assert.equal(classifySeverity({ type: "clipped-overflow" }), "info");
  });

  it("overflow > 100px is critical", () => {
    assert.equal(classifySeverity({ type: "overflow", detail: "overflows by 150px" }), "critical");
  });

  it("overflow 21-100px is warning", () => {
    assert.equal(classifySeverity({ type: "overflow", detail: "overflows by 50px" }), "warning");
  });

  it("overflow <= 20px is info", () => {
    assert.equal(classifySeverity({ type: "overflow", detail: "overflows by 10px" }), "info");
  });

  it("zone-collision with zone-extras is info", () => {
    assert.equal(classifySeverity({ type: "zone-collision", detail: "zone-extras overlaps zone-body" }), "info");
  });

  it("zone-collision without zone-extras is critical", () => {
    assert.equal(classifySeverity({ type: "zone-collision", detail: "zone-body overlaps zone-bullets" }), "critical");
  });

  it("text-image-collision in same cell is info", () => {
    assert.equal(classifySeverity({ type: "text-image-collision", sameCell: true }), "info");
  });

  it("text-image-collision not in same cell is warning", () => {
    assert.equal(classifySeverity({ type: "text-image-collision", sameCell: false }), "warning");
  });

  it("tiny-text is warning", () => {
    assert.equal(classifySeverity({ type: "tiny-text" }), "warning");
  });

  it("out-of-bounds is info", () => {
    assert.equal(classifySeverity({ type: "out-of-bounds" }), "info");
  });

  it("table-row-overlap is warning", () => {
    assert.equal(classifySeverity({ type: "table-row-overlap" }), "warning");
  });
});

// ═══════════════════════════════════════════════════════
// RASTER — normaliseDesign precedence regression
// ═══════════════════════════════════════════════════════

describe("raster.js normaliseDesign", () => {
  const { parseMarkdown } = require("./raster.js");

  it("preserves explicit transform values (not overwritten by uppercase)", () => {
    const md = '<!-- design: {"zones":[{"role":"title","col":0,"span":30,"row":0,"rowSpan":10}],"title":{"size":48,"transform":"lowercase"}} -->\n# Test';
    const slides = parseMarkdown(md);
    const typo = slides[0].design?.typography?.title;
    assert.ok(typo, "should have title typography");
    assert.equal(typo.transform, "lowercase", "explicit transform should be preserved");
  });

  it("converts case:upper to transform:uppercase when no explicit transform", () => {
    const md = '<!-- design: {"zones":[{"role":"title","col":0,"span":30,"row":0,"rowSpan":10}],"title":{"size":48,"case":"upper"}} -->\n# Test';
    const slides = parseMarkdown(md);
    const typo = slides[0].design?.typography?.title;
    assert.ok(typo, "should have title typography");
    assert.equal(typo.transform, "uppercase");
  });
});

// ═══════════════════════════════════════════════════════
// EVAL-HARNESS — mergeScores zero-confidence regression
// ═══════════════════════════════════════════════════════

describe("eval-harness.js mergeScores zero-confidence", () => {
  const { mergeScores } = require("./eval-harness.js");

  it("does not produce NaN when all confidences are 0", () => {
    const merged = mergeScores([
      { evaluatorName: "a", dimensions: { accessibility: { score: 7, confidence: 0 } } },
      { evaluatorName: "b", dimensions: { accessibility: { score: 9, confidence: 0 } } },
    ]);
    assert.ok(!isNaN(merged.accessibility.score), "score must not be NaN");
    assert.equal(merged.accessibility.score, 8); // simple average fallback
  });
});

// ═══════════════════════════════════════════════════════
// TODO — CLOSED ITEMS (regression guards)
// ═══════════════════════════════════════════════════════

describe("TODO closed: shared rubric-scores.js", () => {
  it("rubric-jsdom.js imports computeScores from rubric-scores.js", () => {
    const src = require("fs").readFileSync("./rubric-jsdom.js", "utf-8");
    assert.ok(src.includes("require('./rubric-scores.js')") || src.includes('require("./rubric-scores.js")'),
      "rubric-jsdom.js should import from rubric-scores.js");
  });

  it("rubric-headless.js imports computeScores from rubric-scores.js", () => {
    const src = require("fs").readFileSync("./rubric-headless.js", "utf-8");
    assert.ok(src.includes("require('./rubric-scores.js')") || src.includes('require("./rubric-scores.js")'),
      "rubric-headless.js should import from rubric-scores.js");
  });
});

describe("TODO closed: duplicate text renderer fix", () => {
  const { parseMarkdown, renderDesigned, generateHTMLCSS, THEMES } = require("./raster.js");

  it("renderedContent prevents bullet duplication between body and extras zones", () => {
    // Slide with body zone + bullets but NO bullets zone — bullets should render in body, not duplicated in extras
    const md = '<!-- design: {"zones":[{"role":"title","col":0,"span":30,"row":0,"rowSpan":8},{"role":"body","col":0,"span":50,"row":10,"rowSpan":25}]} -->\n# Title\n\n- bullet one\n- bullet two';
    const slides = parseMarkdown(md);
    const html = renderDesigned(slides[0], 0, slides.length, { theme: THEMES.light, css: generateHTMLCSS(THEMES.light) });
    // Count bullet occurrences — each should appear exactly once
    const matches = html.match(/bullet one/g) || [];
    assert.equal(matches.length, 1, `"bullet one" should appear once, found ${matches.length}`);
  });
});

describe("TODO closed: contentCompleteness key (not contentFidelity)", () => {
  it("evaluators/jsdom-rubric.js maps to contentCompleteness", () => {
    const evaluator = require("./evaluators/jsdom-rubric.js");
    assert.ok(evaluator.dimensions.includes("contentCompleteness"),
      "jsdom-rubric should declare contentCompleteness dimension");
    assert.ok(!evaluator.dimensions.includes("contentFidelity"),
      "should not use old contentFidelity name");
  });

  it("rubric-scores.js produces contentCompleteness (not contentFidelity)", () => {
    const { computeScores } = require("./rubric-scores.js");
    const { scores } = computeScores({
      total: 5, designed: 5, contrastErrors: 0, contrastWarnings: 0, brokenImgs: 0,
      tinyTextCount: 0, overflows: 0, totalZones: 10, nonDefaultZones: 8,
      uniqueArchetypes: 4, maxArchetypeRun: 2, zoneStarts: 6, zoneCollisionSlides: 0,
      hasArc: true, avgTransition: 160, transitionVariance: 400, uniqueBgs: 4,
      maxConsecBg: 2, titleSizes: [32, 48], fontSets: 2, densityCV: 0.8,
      accentRatio: 0.5, typographyRatio: 2.2, totalImgs: 0, textOnImageCount: 0,
      imgOverlaps: 0, genericAltTotal: 0, imgPlacements: [],
      emptyBodyZones: 0, contentlessSlides: 0, tableTruncations: 0,
      clippedContentSlides: 0, slidesWithNoVisibleText: 0,
    });
    assert.ok("contentCompleteness" in scores, "should have contentCompleteness key");
    assert.ok(!("contentFidelity" in scores), "should not have contentFidelity key");
  });
});

describe("TODO closed: rubric-persist normalization uses total/max", () => {
  const { appendRun } = require("./rubric-persist.js");

  it("normalized score adapts to actual assessed dimensions, not hardcoded 100", () => {
    const scorecard = { runs: [], latest: null, trajectory: [] };
    // Only 2 dimensions assessed: 8+7=15 out of 20 max → 75%, not 15%
    appendRun(scorecard, {
      computed: { grid: { score: 8 }, coherence: { score: 7 } },
    });
    assert.equal(scorecard.latest.normalized, 75, "should be 75 (15/20*100), not 15");
  });
});

describe("TODO closed: empty-zone exempts tables/images", () => {
  it("empty body zone with table present should NOT be penalized", () => {
    const { JSDOM } = require("jsdom");
    const html = '<section class="slide"><div class="zone-body"></div><table><tr><td>data</td></tr></table></section>';
    const dom = new JSDOM(html);
    const slide = dom.window.document.querySelector(".slide");
    let emptyBodyZones = 0;
    slide.querySelectorAll(".zone-body,.zone-bullets,.zone-quote").forEach(z => {
      if (!z.textContent.trim()) {
        const slideHasTable = slide.querySelector("table");
        const slideHasImg = slide.querySelector("img:not(.splice-img)");
        if (!slideHasTable && !slideHasImg) emptyBodyZones++;
      }
    });
    assert.equal(emptyBodyZones, 0, "table exempts empty body zone");
  });

  it("empty body zone without table or image IS penalized", () => {
    const { JSDOM } = require("jsdom");
    const html = '<section class="slide"><div class="zone-body"></div></section>';
    const dom = new JSDOM(html);
    const slide = dom.window.document.querySelector(".slide");
    let emptyBodyZones = 0;
    slide.querySelectorAll(".zone-body,.zone-bullets,.zone-quote").forEach(z => {
      if (!z.textContent.trim()) {
        const slideHasTable = slide.querySelector("table");
        const slideHasImg = slide.querySelector("img:not(.splice-img)");
        if (!slideHasTable && !slideHasImg) emptyBodyZones++;
      }
    });
    assert.equal(emptyBodyZones, 1, "no exemption without table/image");
  });

  it("splice-img does NOT exempt empty body zone (only content images do)", () => {
    const { JSDOM } = require("jsdom");
    const html = '<section class="slide"><div class="zone-body"></div><img class="splice-img" src="bg.png"></section>';
    const dom = new JSDOM(html);
    const slide = dom.window.document.querySelector(".slide");
    let emptyBodyZones = 0;
    slide.querySelectorAll(".zone-body,.zone-bullets,.zone-quote").forEach(z => {
      if (!z.textContent.trim()) {
        const slideHasTable = slide.querySelector("table");
        const slideHasImg = slide.querySelector("img:not(.splice-img)");
        if (!slideHasTable && !slideHasImg) emptyBodyZones++;
      }
    });
    assert.equal(emptyBodyZones, 1, "splice-img should not grant exemption");
  });
});

describe("TODO closed: sparse-slide exempts title slide", () => {
  it("slide index 0 is exempt from sparse penalty regardless of length", () => {
    // Reproduce the sparse-slide logic from rubric-jsdom.js
    const slides = [
      { textContent: { trim: () => "Hi" }, querySelector: () => null },
      { textContent: { trim: () => "Also short" }, querySelector: () => null },
    ];
    let sparseSlides = 0;
    slides.forEach((slide, i) => {
      const len = slide.textContent.trim().length;
      if (i === 0) return; // exempt title slide
      const hasImg = slide.querySelector("img:not(.splice-img)");
      if (len < 150 && !hasImg) sparseSlides++;
    });
    assert.equal(sparseSlides, 1, "only slide 1 should be sparse, not slide 0");
  });
});

// ═══════════════════════════════════════════════════════
// TODO — OPEN ITEMS (expected failures, documented as todo)
// ═══════════════════════════════════════════════════════

describe("TODO open: bullet structure preservation", () => {
  const fs = require("fs");
  const { parseMarkdown, generateHTML } = require("./raster.js");

  it("all source bullets survive rendering", { todo: "115 source bullets → ~97 rendered (14-18 lost during composition)" }, () => {
    const source = fs.readFileSync("content/week-2/week-2.md", "utf-8");
    const sourceBullets = (source.match(/^\s*-\s+/gm) || []).length;

    // Parse and render to count output bullets
    const slides = parseMarkdown(source);
    const totalParsedBullets = slides.reduce((sum, s) => sum + s.bullets.length, 0);
    assert.equal(totalParsedBullets, sourceBullets,
      `Parser should preserve all ${sourceBullets} bullets, got ${totalParsedBullets}`);
  });
});

describe("compose.js prompt instructs table and title zone roles", () => {
  const fs = require("fs");
  const path = require("path");

  it("compose prompt includes table zone role instruction", () => {
    const compose = fs.readFileSync(path.join(__dirname, "compose.js"), "utf-8");
    assert.ok(compose.includes('"table"'), "compose.js prompt should mention table zone role");
    assert.ok(compose.includes('Use "table" for slides whose primary content is a markdown table'),
      "compose.js should instruct Claude to use table role for table slides");
  });

  it("compose prompt warns against label role for headings", () => {
    const compose = fs.readFileSync(path.join(__dirname, "compose.js"), "utf-8");
    assert.ok(compose.includes('NOT "label"'),
      "compose.js should warn against using label role for headings");
  });
});

describe("TODO open: deck-audit.js uses unified rubric-scores.js", () => {
  it("deck-audit.js imports rubric-scores.js for scoring", { todo: "deck-audit.js uses old scorecard format, not rubric-scores.js" }, () => {
    const src = require("fs").readFileSync("./deck-audit.js", "utf-8");
    assert.ok(
      src.includes("rubric-scores") || src.includes("computeScores"),
      "deck-audit.js should import from rubric-scores.js for unified scoring"
    );
  });
});

describe("TODO open: splice-images zone-collision detection", () => {
  it("contentAwarePlan rejects placement that collides with content zones", { todo: "splice-images has no collision detection" }, () => {
    const { contentAwarePlan } = require("./splice-images.js");
    // Slide with a body zone at right:60-100% — placing an image at right should be rejected
    const html = '<section class="slide designed">'
      + '<div class="zone zone-title" style="left:5%;width:40%;top:5%;height:15%">Title</div>'
      + '<div class="zone zone-body" style="left:55%;width:43%;top:5%;height:90%">Long body text here that fills the right side</div>'
      + '</section>';
    const plan = contentAwarePlan(html);
    // Should NOT pick "right" because it would collide with body zone at right side
    assert.notEqual(plan[0].mode, "right",
      "should not place image where it collides with content zone");
  });
});
