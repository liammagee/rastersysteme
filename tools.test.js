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
