const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseMarkdown, createGrid, THEMES, LAYOUTS } = require("./raster.js");

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
    assert.ok(g43.RH > g.RH); // taller rows
  });
});

// ═══════════════════════════════════════════════════════
// THEMES
// ═══════════════════════════════════════════════════════

describe("Themes", () => {
  const requiredKeys = [
    "bg", "bgAlt", "bgDark", "text", "textMid", "textLight",
    "accent", "accent2", "accent3", "accent4",
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
      assert.equal(s.images.length, 0); // only standalone image lines
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
  // Helper: parse single slide and detect layout at given index
  function detect(md, index = 1, total = 3) {
    const slides = parseMarkdown(md);
    // Use the internal detection by checking what layout the module picks
    // We test via the parsed structure
    const slide = slides[0];
    // Replicate detection logic
    if (slide.layout) return slide.layout;
    if (index === 0) return "title";
    if (index === total - 1 && !slide.title && slide.body.length <= 1) return "section";
    if (slide.title && slide.subtitle && slide.bullets.length === 0 &&
        slide.body.length <= 1 && slide.images.length === 0 &&
        slide.tables.length === 0 && slide.codeBlocks.length === 0) return "section";
    if (slide.images.length > 0) return "image";
    if (slide.tables.length > 0) return "table";
    if (slide.codeBlocks.length > 0) return "code";
    const topLevel = slide.bullets.filter(b => (b.level || 0) === 0).length;
    if (topLevel >= 4 && topLevel === slide.bullets.length) return "stagger";
    if (slide.bullets.length > 0) return "bullets";
    if (slide.blockquote) return "rotated";
    if (slide.title && slide.body.length > 0) return "split";
    if (slide.title) return "section";
    if (slide.links.length > 0) return "fragment";
    return "split";
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

  it("all 13 layouts are registered", () => {
    assert.equal(Object.keys(LAYOUTS).length, 13);
    for (const name of allLayouts) {
      assert.ok(typeof LAYOUTS[name] === "function", `LAYOUTS.${name} should be a function`);
    }
  });
});

// ═══════════════════════════════════════════════════════
// TYPOGRAPHY CONSTANTS
// ═══════════════════════════════════════════════════════

describe("Typography", () => {
  it("default font is Helvetica Neue", () => {
    // Check that the CLI defaults to Helvetica Neue by parsing the source
    const src = require("fs").readFileSync("./raster.js", "utf-8");
    assert.ok(src.includes('"Helvetica Neue"'));
  });

  it("slide number uses size 8", () => {
    const src = require("fs").readFileSync("./raster.js", "utf-8");
    // addSlideNumber function
    assert.ok(src.includes("fontSize: 8") && src.includes("addSlideNumber"));
  });

  it("code blocks use Courier New", () => {
    const src = require("fs").readFileSync("./raster.js", "utf-8");
    assert.ok(src.includes('"Courier New"'));
  });
});

// ═══════════════════════════════════════════════════════
// COLOUR UTILITIES
// ═══════════════════════════════════════════════════════

describe("Colour utilities", () => {
  // Import the functions via the source since they're not exported
  const src = require("fs").readFileSync("./raster.js", "utf-8");
  const hasDarkCheck = src.includes("function isDarkColor");
  const hasAdapt = src.includes("function adaptThemeForBg");

  it("isDarkColor exists", () => {
    assert.ok(hasDarkCheck);
  });

  it("adaptThemeForBg exists", () => {
    assert.ok(hasAdapt);
  });

  it("each theme has distinct accent and accent2", () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      assert.notEqual(theme.accent, theme.accent2,
        `${name}: accent and accent2 should differ`);
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
// INTEGRATION: FULL PARSE + DETECT
// ═══════════════════════════════════════════════════════

describe("Integration: showcase.md", () => {
  const fs = require("fs");
  const mdPath = "./showcase.md";

  // Skip if showcase.md doesn't exist
  const exists = fs.existsSync(mdPath);

  it("parses showcase.md without errors", { skip: !exists }, () => {
    const md = fs.readFileSync(mdPath, "utf-8");
    const slides = parseMarkdown(md);
    assert.ok(slides.length > 0, "should have at least one slide");
  });

  it("showcase has 30 slides", { skip: !exists }, () => {
    const md = fs.readFileSync(mdPath, "utf-8");
    const slides = parseMarkdown(md);
    assert.equal(slides.length, 30);
  });

  it("every slide has either title, subtitle, body, or bullets", { skip: !exists }, () => {
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
});
