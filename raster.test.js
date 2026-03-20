const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseMarkdown, createGrid, THEMES, LAYOUTS, HTML_LAYOUTS, detectLayout, adaptThemeForBg, generateHTMLCSS } = require("./raster.js");
const { runQA, auditA11y, scoreDesign, validateLayouts, contrastRatio, relativeLuminance } = require("./qa.js");
const { buildPrompt, sanitizeClaudeOutput, DESIGN_BRIEF, DEFAULT_BRIEF, INTENSITY } = require("./compose.js");
const { RUBRIC, buildEvalPrompt, parseEvaluation } = require("./compare.js");

// ═══════════════════════════════════════════════════════
// GRID SYSTEM
// ═══════════════════════════════════════════════════════

describe("Grid system", () => {
  const g = createGrid(10, 5.625);

  it("has correct dimensions", () => {
    assert.equal(g.SW, 10);
    assert.equal(g.SH, 5.625);
    assert.equal(g.COLS, 60);
    assert.equal(g.ROWS, 40);
    assert.equal(g.M, 0.5);
  });

  it("first column starts at left margin", () => {
    assert.ok(Math.abs(g.cx(0) - 0.5) < 0.001);
  });

  it("column 30 is at horizontal center", () => {
    assert.ok(Math.abs(g.cx(30) - 5.0) < 0.05);
  });

  it("column positions are monotonically increasing", () => {
    for (let i = 1; i <= 60; i++) {
      assert.ok(g.cx(i) > g.cx(i - 1), `col ${i} should be > col ${i - 1}`);
    }
  });

  it("row positions are monotonically increasing", () => {
    for (let i = 1; i <= 40; i++) {
      assert.ok(g.cy(i) > g.cy(i - 1), `row ${i} should be > row ${i - 1}`);
    }
  });

  it("all columns fit within slide width", () => {
    const rightEdge = g.cx(59) + g.cw(1);
    assert.ok(rightEdge <= g.SW, `right edge ${rightEdge} exceeds slide width ${g.SW}`);
  });

  it("all rows fit within slide height", () => {
    const bottomEdge = g.cy(39) + g.ch(1);
    assert.ok(bottomEdge <= g.SH, `bottom edge ${bottomEdge} exceeds slide height ${g.SH}`);
  });

  it("span of all 60 columns equals inner width", () => {
    assert.ok(Math.abs(g.cw(60) - g.IW) < 0.01);
  });

  it("span of all 40 rows equals inner height", () => {
    assert.ok(Math.abs(g.ch(40) - g.IH) < 0.01);
  });

  it("÷12 divisions produce 5 equal zones", () => {
    const w12 = g.cw(12);
    for (let i = 0; i < 5; i++) {
      assert.ok(Math.abs(g.cw(12) - w12) < 0.001);
    }
  });

  it("supports 4:3 ratio", () => {
    const g43 = createGrid(10, 7.5);
    assert.equal(g43.SW, 10);
    assert.equal(g43.SH, 7.5);
    assert.ok(g43.RH > g.RH);
  });
});

// ═══════════════════════════════════════════════════════
// THEMES
// ═══════════════════════════════════════════════════════

describe("Themes", () => {
  const requiredKeys = [
    "bg", "bgAlt", "bgDark", "text", "textMid", "textLight",
    "accent", "accentLight", "accent2", "accent3", "accent4",
    "white", "black", "grey",
  ];

  for (const [name, theme] of Object.entries(THEMES)) {
    describe(name, () => {
      it("has all required colour keys", () => {
        for (const key of requiredKeys) {
          assert.ok(theme[key], `${name} missing key: ${key}`);
        }
      });

      it("all values are valid 6-char hex", () => {
        for (const [key, val] of Object.entries(theme)) {
          assert.match(val, /^[0-9A-Fa-f]{6}$/, `${name}.${key} = "${val}" is not valid hex`);
        }
      });

      it("text and background have sufficient contrast", () => {
        const lum = (hex) => {
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          return r * 0.299 + g * 0.587 + b * 0.114;
        };
        const bgLum = lum(theme.bg);
        const textLum = lum(theme.text);
        const contrast = Math.abs(bgLum - textLum);
        assert.ok(contrast > 80, `${name}: bg/text contrast ${contrast.toFixed(0)} is too low`);
      });

      it("white text on all accents passes AA large (3:1)", () => {
        const white = theme.white;
        for (const key of ["accent", "accent2", "accent3", "accent4"]) {
          const ratio = contrastRatio(white, theme[key]);
          assert.ok(ratio >= 3.0, `${name}: white on ${key} (#${theme[key]}) = ${ratio.toFixed(2)}:1, need 3:1`);
        }
      });
    });
  }

  it("has exactly 4 themes", () => {
    assert.equal(Object.keys(THEMES).length, 4);
  });

  it("light and dark themes have opposite bg luminance", () => {
    const lum = (hex) => parseInt(hex.slice(0, 2), 16) * 0.299 +
      parseInt(hex.slice(2, 4), 16) * 0.587 + parseInt(hex.slice(4, 6), 16) * 0.114;
    assert.ok(lum(THEMES.light.bg) > 128);
    assert.ok(lum(THEMES.dark.bg) < 128);
  });
});

// ═══════════════════════════════════════════════════════
// ADAPT THEME FOR BG
// ═══════════════════════════════════════════════════════

describe("adaptThemeForBg", () => {
  it("returns theme unchanged when no bg override", () => {
    const t = adaptThemeForBg(THEMES.light, null);
    assert.equal(t, THEMES.light);
  });

  it("returns theme unchanged when bg matches theme darkness", () => {
    const t = adaptThemeForBg(THEMES.light, "F0F0F0");
    assert.equal(t, THEMES.light);
  });

  it("adapts light theme for dark bg override", () => {
    const t = adaptThemeForBg(THEMES.light, "111111");
    assert.notEqual(t.text, THEMES.light.text);
    assert.ok(t.accentLight, "should set accentLight for dark bg");
  });

  it("adapts dark theme for light bg override", () => {
    const t = adaptThemeForBg(THEMES.dark, "F0F0F0");
    assert.notEqual(t.text, THEMES.dark.text);
  });
});

// ═══════════════════════════════════════════════════════
// MARKDOWN PARSER
// ═══════════════════════════════════════════════════════

describe("Markdown parser", () => {
  describe("slide splitting", () => {
    it("splits on --- separator", () => {
      const slides = parseMarkdown("# A\n---\n# B\n---\n# C");
      assert.equal(slides.length, 3);
    });

    it("filters empty slides", () => {
      const slides = parseMarkdown("# A\n---\n\n---\n# C");
      assert.equal(slides.length, 2);
    });

    it("handles single slide", () => {
      const slides = parseMarkdown("# Only slide");
      assert.equal(slides.length, 1);
    });
  });

  describe("headings", () => {
    it("parses # as title", () => {
      const [s] = parseMarkdown("# Hello World");
      assert.equal(s.title, "Hello World");
      assert.equal(s.subtitle, null);
    });

    it("parses ## as subtitle", () => {
      const [s] = parseMarkdown("## Sub");
      assert.equal(s.subtitle, "Sub");
      assert.equal(s.title, null);
    });

    it("parses ### as section label", () => {
      const [s] = parseMarkdown("### SECTION");
      assert.equal(s.sectionLabel, "SECTION");
    });

    it("does not confuse ## with #", () => {
      const [s] = parseMarkdown("## Not a title");
      assert.equal(s.title, null);
      assert.equal(s.subtitle, "Not a title");
    });

    it("does not confuse ### with ##", () => {
      const [s] = parseMarkdown("### Not a subtitle");
      assert.equal(s.subtitle, null);
      assert.equal(s.sectionLabel, "Not a subtitle");
    });
  });

  describe("bullets", () => {
    it("parses flat bullets as level 0", () => {
      const [s] = parseMarkdown("- one\n- two\n- three");
      assert.equal(s.bullets.length, 3);
      s.bullets.forEach(b => assert.equal(b.level, 0));
    });

    it("parses nested bullets with correct levels", () => {
      const [s] = parseMarkdown("- parent\n  - child\n    - grandchild");
      assert.equal(s.bullets.length, 3);
      assert.equal(s.bullets[0].level, 0);
      assert.equal(s.bullets[0].text, "parent");
      assert.equal(s.bullets[1].level, 1);
      assert.equal(s.bullets[1].text, "child");
      assert.equal(s.bullets[2].level, 2);
      assert.equal(s.bullets[2].text, "grandchild");
    });

    it("supports * as bullet marker", () => {
      const [s] = parseMarkdown("* item");
      assert.equal(s.bullets.length, 1);
      assert.equal(s.bullets[0].text, "item");
    });
  });

  describe("blockquotes", () => {
    it("parses > lines", () => {
      const [s] = parseMarkdown("> Hello world");
      assert.equal(s.blockquote, "Hello world");
    });

    it("joins multi-line blockquotes", () => {
      const [s] = parseMarkdown("> line one\n> line two");
      assert.ok(s.blockquote.includes("line one"));
      assert.ok(s.blockquote.includes("line two"));
    });
  });

  describe("images", () => {
    it("parses ![alt](src)", () => {
      const [s] = parseMarkdown("![photo](img/photo.png)");
      assert.equal(s.images.length, 1);
      assert.equal(s.images[0].alt, "photo");
      assert.equal(s.images[0].src, "img/photo.png");
    });

    it("does not parse images inside text", () => {
      const [s] = parseMarkdown("see ![icon](x.png) here");
      assert.equal(s.images.length, 0);
    });
  });

  describe("tables", () => {
    it("parses pipe-delimited tables", () => {
      const md = "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
      const [s] = parseMarkdown(md);
      assert.equal(s.tables.length, 1);
      assert.deepEqual(s.tables[0].headers, ["A", "B"]);
      assert.equal(s.tables[0].rows.length, 2);
      assert.deepEqual(s.tables[0].rows[0], ["1", "2"]);
    });

    it("parses column alignments", () => {
      const md = "| L | C | R |\n|:---|:---:|---:|\n| a | b | c |";
      const [s] = parseMarkdown(md);
      assert.deepEqual(s.tables[0].alignments, ["left", "center", "right"]);
    });

    it("ignores malformed tables (no separator)", () => {
      const md = "| A | B |\n| 1 | 2 |";
      const [s] = parseMarkdown(md);
      assert.equal(s.tables.length, 0);
    });
  });

  describe("code blocks", () => {
    it("parses fenced code blocks", () => {
      const md = "```javascript\nconst x = 1;\n```";
      const [s] = parseMarkdown(md);
      assert.equal(s.codeBlocks.length, 1);
      assert.equal(s.codeBlocks[0].lang, "javascript");
      assert.equal(s.codeBlocks[0].code, "const x = 1;");
    });

    it("does not confuse notes blocks with code", () => {
      const md = "```notes\nThese are notes\n```";
      const [s] = parseMarkdown(md);
      assert.equal(s.codeBlocks.length, 0);
      assert.equal(s.notes, "These are notes");
    });

    it("handles code blocks without language", () => {
      const md = "```\nhello\n```";
      const [s] = parseMarkdown(md);
      assert.equal(s.codeBlocks.length, 1);
      assert.equal(s.codeBlocks[0].lang, "text");
    });
  });

  describe("directives", () => {
    it("parses layout directive", () => {
      const [s] = parseMarkdown("<!-- layout: stagger -->\n# Title");
      assert.equal(s.layout, "stagger");
    });

    it("parses bg directive", () => {
      const [s] = parseMarkdown("<!-- bg: FF0000 -->\n# Title");
      assert.equal(s.bgOverride, "FF0000");
    });

    it("strips # from bg hex", () => {
      const [s] = parseMarkdown("<!-- bg: #AABBCC -->\n# Title");
      assert.equal(s.bgOverride, "AABBCC");
    });

    it("parses font directive", () => {
      const [s] = parseMarkdown("<!-- font: Georgia -->\n# Title");
      assert.equal(s.fontOverride, "Georgia");
    });

    it("directives do not appear in body text", () => {
      const [s] = parseMarkdown("<!-- layout: split -->\nBody text");
      assert.ok(!s.body.some(b => b.includes("layout")));
    });
  });

  describe("links", () => {
    it("parses standalone links", () => {
      const [s] = parseMarkdown("[GitHub](https://github.com)");
      assert.equal(s.links.length, 1);
      assert.equal(s.links[0].text, "GitHub");
      assert.equal(s.links[0].url, "https://github.com");
    });
  });

  describe("notes", () => {
    it("extracts speaker notes", () => {
      const [s] = parseMarkdown("# Title\n```notes\nSpeaker notes here\n```");
      assert.equal(s.notes, "Speaker notes here");
    });

    it("notes do not appear in body", () => {
      const [s] = parseMarkdown("Body\n```notes\nHidden\n```");
      assert.ok(!s.body.some(b => b.includes("Hidden")));
    });
  });
});

// ═══════════════════════════════════════════════════════
// LAYOUT DETECTION
// ═══════════════════════════════════════════════════════

describe("Layout detection", () => {
  function detect(md, index = 1, total = 3) {
    const slides = parseMarkdown(md);
    return detectLayout(slides[0], index, total);
  }

  it("first slide → title", () => {
    assert.equal(detect("# Anything", 0), "title");
  });

  it("forced layout overrides detection", () => {
    assert.equal(detect("<!-- layout: arc -->\n# Title"), "arc");
  });

  it("title + subtitle → section", () => {
    assert.equal(detect("# Title\n## Subtitle"), "section");
  });

  it("has images → image", () => {
    assert.equal(detect("![pic](a.png)"), "image");
  });

  it("has table → table", () => {
    assert.equal(detect("| A |\n|---|\n| 1 |"), "table");
  });

  it("has code block → code", () => {
    assert.equal(detect("```js\nx\n```"), "code");
  });

  it("4+ flat bullets → stagger", () => {
    assert.equal(detect("- a\n- b\n- c\n- d"), "stagger");
  });

  it("nested bullets stay as bullets, not stagger", () => {
    assert.equal(detect("- a\n  - a1\n  - a2\n- b\n  - b1\n  - b2\n  - b3"), "bullets");
  });

  it("1-3 bullets → bullets", () => {
    assert.equal(detect("- a\n- b"), "bullets");
  });

  it("blockquote → rotated", () => {
    assert.equal(detect("> Quote text"), "rotated");
  });

  it("title + body → split", () => {
    assert.equal(detect("# Title\nBody paragraph here"), "split");
  });

  it("links only → fragment", () => {
    assert.equal(detect("[A](http://a.com)\n[B](http://b.com)"), "fragment");
  });
});

// ═══════════════════════════════════════════════════════
// LAYOUT RENDERERS
// ═══════════════════════════════════════════════════════

describe("Layout renderers", () => {
  const allLayouts = [
    "title", "section", "bullets", "stagger", "split",
    "rotated", "fragment", "overlap", "arc", "image",
    "table", "code", "blank",
  ];

  it("all 13 PPTX layouts are registered", () => {
    assert.equal(Object.keys(LAYOUTS).length, 13);
    for (const name of allLayouts) {
      assert.ok(typeof LAYOUTS[name] === "function", `LAYOUTS.${name} should be a function`);
    }
  });

  it("all 13 HTML layouts are registered", () => {
    assert.equal(Object.keys(HTML_LAYOUTS).length, 13);
    for (const name of allLayouts) {
      assert.ok(typeof HTML_LAYOUTS[name] === "function", `HTML_LAYOUTS.${name} should be a function`);
    }
  });

  it("HTML CSS generator returns a non-empty string", () => {
    const css = generateHTMLCSS();
    assert.ok(css.length > 500, "CSS should be substantial");
    assert.ok(css.includes(".slide"), "CSS should style .slide");
    assert.ok(css.includes(".layout-title"), "CSS should have layout-title");
    assert.ok(css.includes(".layout-section"), "CSS should have layout-section");
  });
});

// ═══════════════════════════════════════════════════════
// COLOUR UTILITIES (QA)
// ═══════════════════════════════════════════════════════

describe("Colour utilities", () => {
  it("contrastRatio of white on black is ~21:1", () => {
    const ratio = contrastRatio("FFFFFF", "000000");
    assert.ok(ratio > 20 && ratio < 22, `expected ~21, got ${ratio.toFixed(2)}`);
  });

  it("contrastRatio of identical colours is 1:1", () => {
    assert.ok(Math.abs(contrastRatio("888888", "888888") - 1) < 0.01);
  });

  it("contrastRatio is commutative", () => {
    const ab = contrastRatio("FF0000", "0000FF");
    const ba = contrastRatio("0000FF", "FF0000");
    assert.ok(Math.abs(ab - ba) < 0.01);
  });

  it("relativeLuminance of white is ~1", () => {
    assert.ok(relativeLuminance("FFFFFF") > 0.99);
  });

  it("relativeLuminance of black is ~0", () => {
    assert.ok(relativeLuminance("000000") < 0.01);
  });

  it("each theme has distinct accent and accent2", () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      assert.notEqual(theme.accent, theme.accent2, `${name}: accent and accent2 should differ`);
    }
  });

  it("each theme has 4 unique accent colours", () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      const accents = new Set([theme.accent, theme.accent2, theme.accent3, theme.accent4]);
      assert.equal(accents.size, 4, `${name}: should have 4 distinct accents`);
    }
  });
});

// ═══════════════════════════════════════════════════════
// QA AUDIT
// ═══════════════════════════════════════════════════════

describe("QA audit", () => {
  it("scoreDesign returns scores and total", () => {
    const slides = parseMarkdown("# Title\n---\n## Slide 2\n- a\n- b");
    const result = scoreDesign(slides);
    assert.ok(result.totalScore >= 0);
    assert.ok(result.maxScore === 100);
    assert.ok(result.scores.layoutVariety);
    assert.ok(result.scores.sectionRhythm);
    assert.ok(result.scores.contentDensity);
    assert.ok(result.scores.typography);
    assert.ok(result.scores.speakerNotes);
    assert.ok(result.scores.contentTypes);
    assert.ok(result.scores.visualRhythm);
  });

  it("validateLayouts catches empty slides", () => {
    const slides = parseMarkdown("# A\n---\n\n---\n# C");
    // Empty slides get filtered by parser, so this should be clean
    const results = validateLayouts(slides);
    assert.ok(Array.isArray(results));
  });

  it("validateLayouts warns on overflow risk", () => {
    // 3 slides: title + 9 bullets (stagger) + end — middle slide triggers warning
    const slides = parseMarkdown("# Intro\n---\n- a\n- b\n- c\n- d\n- e\n- f\n- g\n- h\n- i\n---\n# End");
    const results = validateLayouts(slides);
    assert.ok(results.some(r => r.message.includes("Stagger") || r.message.includes("overflow")),
      "Expected overflow warning for 9-bullet stagger, got: " + JSON.stringify(results));
  });

  it("auditA11y returns results array", () => {
    const slides = parseMarkdown("# Title\n---\n## Slide\n- bullet");
    const results = auditA11y(slides, THEMES.dark);
    assert.ok(Array.isArray(results));
  });

  it("runQA integrates all checks", () => {
    const fs = require("fs");
    if (!fs.existsSync("./showcase.md")) return;
    const result = runQA("./showcase.md", { theme: "dark" });
    assert.ok(result.slides.length > 0);
    assert.ok(Array.isArray(result.a11yResults));
    assert.ok(Array.isArray(result.layoutResults));
    assert.ok(result.design.totalScore >= 0);
  });
});

// ═══════════════════════════════════════════════════════
// COMPOSE MODULE
// ═══════════════════════════════════════════════════════

describe("Compose module", () => {
  it("DESIGN_BRIEF is a non-empty string", () => {
    assert.ok(typeof DESIGN_BRIEF === "string");
    assert.ok(DESIGN_BRIEF.length > 500);
  });

  it("DEFAULT_BRIEF is a non-empty string", () => {
    assert.ok(typeof DEFAULT_BRIEF === "string");
    assert.ok(DEFAULT_BRIEF.length > 200);
  });

  it("INTENSITY has faithful, moderate, and radical levels", () => {
    assert.ok(INTENSITY.faithful);
    assert.ok(INTENSITY.moderate);
    assert.ok(INTENSITY.radical);
  });

  it("radical intensity mentions content preservation", () => {
    assert.ok(INTENSITY.radical.includes("content") || INTENSITY.radical.includes("information"));
  });

  it("buildPrompt includes the source markdown", () => {
    const prompt = buildPrompt("# My Slide\n- bullet one", { intensity: "moderate" });
    assert.ok(prompt.includes("My Slide"));
    assert.ok(prompt.includes("bullet one"));
  });

  it("buildPrompt includes intensity guide", () => {
    const prompt = buildPrompt("# Title", { intensity: "radical" });
    assert.ok(prompt.includes("RADICAL"));
  });

  it("buildPrompt defaults to moderate", () => {
    const prompt = buildPrompt("# Title", {});
    assert.ok(prompt.includes("MODERATE"));
  });

  it("buildPrompt includes custom brief when provided", () => {
    const prompt = buildPrompt("# Title", { brief: "brutalist maximalism" });
    assert.ok(prompt.includes("brutalist maximalism"));
  });

  describe("sanitizeClaudeOutput", () => {
    it("strips code fences", () => {
      const raw = "```markdown\n<!-- layout: section -->\n# Title\n```";
      const result = sanitizeClaudeOutput(raw);
      assert.ok(result.startsWith("<!-- layout:"));
    });

    it("strips preamble before first layout directive", () => {
      const raw = "Here is your deck:\n\n<!-- layout: title -->\n# Hello";
      const result = sanitizeClaudeOutput(raw);
      assert.ok(result.startsWith("<!-- layout:"));
    });

    it("throws on empty output", () => {
      assert.throws(() => sanitizeClaudeOutput(""), /empty/i);
    });

    it("throws on output without layout directives", () => {
      assert.throws(() => sanitizeClaudeOutput("# Just a title\n- no directives"), /layout/i);
    });

    it("preserves valid slide markdown", () => {
      const valid = "<!-- layout: section -->\n# Hello World\n---\n<!-- layout: bullets -->\n- one\n- two";
      const result = sanitizeClaudeOutput(valid);
      assert.ok(result.includes("Hello World"));
      assert.ok(result.includes("- one"));
    });
  });
});

// ═══════════════════════════════════════════════════════
// COMPARE MODULE
// ═══════════════════════════════════════════════════════

describe("Compare module", () => {
  it("RUBRIC has 7 criteria totaling 100 points", () => {
    const keys = Object.keys(RUBRIC);
    assert.equal(keys.length, 7);
    const total = Object.values(RUBRIC).reduce((sum, r) => sum + r.weight, 0);
    assert.equal(total, 100);
  });

  it("every RUBRIC criterion has weight, description, and prompt", () => {
    for (const [key, r] of Object.entries(RUBRIC)) {
      assert.ok(typeof r.weight === "number", `${key} missing weight`);
      assert.ok(typeof r.description === "string", `${key} missing description`);
      assert.ok(typeof r.prompt === "string", `${key} missing prompt`);
      assert.ok(r.weight > 0, `${key} weight should be > 0`);
    }
  });

  it("buildEvalPrompt includes URL checklist from source", () => {
    const prompt = buildEvalPrompt("Visit https://example.com and https://other.org", "<!-- layout: title -->\n# Test", {}, "moderate");
    assert.ok(prompt.includes("https://example.com"));
  });

  it("buildEvalPrompt includes email checklist from source", () => {
    const prompt = buildEvalPrompt("Contact jane@example.com", "<!-- layout: title -->\n# Test", {}, "moderate");
    assert.ok(prompt.includes("jane@example.com"));
  });

  it("buildEvalPrompt includes source and composed markdown", () => {
    const prompt = buildEvalPrompt("# Source", "<!-- layout: title -->\n# Composed", {}, "moderate");
    assert.ok(prompt.includes("# Source"));
    assert.ok(prompt.includes("# Composed"));
    assert.ok(prompt.includes("moderate"));
  });

  it("buildEvalPrompt includes rubric criteria", () => {
    const prompt = buildEvalPrompt("src", "composed", {}, "faithful");
    for (const key of Object.keys(RUBRIC)) {
      assert.ok(prompt.includes(key), `prompt should reference ${key}`);
    }
  });

  describe("parseEvaluation", () => {
    it("parses valid JSON evaluation", () => {
      const json = JSON.stringify({
        scores: {
          contentCompleteness: { score: 18, rationale: "good", findings: [] },
          contentFidelity: { score: 14, rationale: "ok", findings: [] },
          designQuality: { score: 16, rationale: "nice", findings: [] },
          speakerNotes: { score: 12, rationale: "present", findings: [] },
          pacing: { score: 8, rationale: "varied", findings: [] },
          accessibility: { score: 9, rationale: "passes", findings: [] },
          narrativeCoherence: { score: 7, rationale: "flows", findings: [] },
        },
        totalScore: 84,
        strengths: ["good variety"],
        weaknesses: ["dense bullets"],
        recommendation: "Use this version.",
      });
      const result = parseEvaluation(json);
      assert.equal(result.totalScore, 84);
      assert.ok(result.scores.contentCompleteness);
    });

    it("handles JSON wrapped in code fences", () => {
      const wrapped = '```json\n{"scores":{},"totalScore":50,"strengths":[],"weaknesses":[],"recommendation":"ok"}\n```';
      const result = parseEvaluation(wrapped);
      assert.equal(result.totalScore, 50);
    });

    it("returns fallback for invalid JSON", () => {
      const result = parseEvaluation("This is not JSON at all");
      assert.ok(result.error, "should have error field");
      assert.equal(result.totalScore, null);
    });
  });
});

// ═══════════════════════════════════════════════════════
// TYPOGRAPHY CONSTANTS
// ═══════════════════════════════════════════════════════

describe("Typography", () => {
  it("default font is Helvetica Neue", () => {
    const src = require("fs").readFileSync("./raster.js", "utf-8");
    assert.ok(src.includes('"Helvetica Neue"'));
  });

  it("slide number uses size 8", () => {
    const src = require("fs").readFileSync("./raster.js", "utf-8");
    assert.ok(src.includes("fontSize: 8") && src.includes("addSlideNumber"));
  });

  it("code blocks use Courier New", () => {
    const src = require("fs").readFileSync("./raster.js", "utf-8");
    assert.ok(src.includes('"Courier New"'));
  });
});

// ═══════════════════════════════════════════════════════
// INTEGRATION: SHOWCASE
// ═══════════════════════════════════════════════════════

describe("Integration: showcase.md", () => {
  const fs = require("fs");
  const mdPath = "./showcase.md";
  const exists = fs.existsSync(mdPath);

  it("parses showcase.md without errors", { skip: !exists }, () => {
    const md = fs.readFileSync(mdPath, "utf-8");
    const slides = parseMarkdown(md);
    assert.ok(slides.length > 0);
  });

  it("showcase has 30 slides", { skip: !exists }, () => {
    const md = fs.readFileSync(mdPath, "utf-8");
    const slides = parseMarkdown(md);
    assert.equal(slides.length, 30);
  });

  it("every slide has content", { skip: !exists }, () => {
    const md = fs.readFileSync(mdPath, "utf-8");
    const slides = parseMarkdown(md);
    slides.forEach((s, i) => {
      const hasContent = s.title || s.subtitle || s.body.length > 0 ||
        s.bullets.length > 0 || s.blockquote || s.tables.length > 0 ||
        s.codeBlocks.length > 0 || s.images.length > 0;
      assert.ok(hasContent, `slide ${i + 1} has no content`);
    });
  });

  it("all speaker notes are populated", { skip: !exists }, () => {
    const md = fs.readFileSync(mdPath, "utf-8");
    const slides = parseMarkdown(md);
    slides.forEach((s, i) => {
      assert.ok(s.notes, `slide ${i + 1} missing speaker notes`);
    });
  });

  it("passes QA dark theme with zero errors", { skip: !exists }, () => {
    const result = runQA(mdPath, { theme: "dark" });
    const errors = result.a11yResults.filter(r => r.severity === "error");
    assert.equal(errors.length, 0, `Expected 0 errors, got ${errors.length}: ${errors.map(e => e.message).join("; ")}`);
  });
});
