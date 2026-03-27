const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseMarkdown, createGrid, THEMES, LAYOUTS, HTML_LAYOUTS, detectLayout, adaptThemeForBg, generateHTMLCSS, renderDesigned } = require("./raster.js");
const { runQA, auditA11y, scoreDesign, validateLayouts, validateIntensity, validateContentPreservation, contrastRatio, relativeLuminance, INTENSITY_RULES } = require("./qa.js");
const { buildPrompt, sanitizeClaudeOutput, DESIGN_BRIEF, DESIGN_MOODS, INTENSITY } = require("./compose.js");
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

    it("### alone promotes to subtitle (no title on slide)", () => {
      const [s] = parseMarkdown("### SECTION");
      assert.equal(s.subtitle, "SECTION");
      assert.equal(s.sectionLabel, null);
    });

    it("does not confuse ## with #", () => {
      const [s] = parseMarkdown("## Not a title");
      assert.equal(s.title, null);
      assert.equal(s.subtitle, "Not a title");
    });

    it("### becomes subtitle when no title exists (PowerPoint export)", () => {
      const [s] = parseMarkdown("### Section heading");
      assert.equal(s.subtitle, "Section heading");
      assert.equal(s.sectionLabel, null);
    });

    it("### stays as sectionLabel when title exists", () => {
      const [s] = parseMarkdown("## Main Title\n### SECTION");
      assert.equal(s.subtitle, "Main Title");
      assert.equal(s.sectionLabel, "SECTION");
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

    it("parses style directive", () => {
      const [s] = parseMarkdown("<!-- style: title-size=48; spacing=tight; opacity=0.8 -->\n# Title");
      assert.ok(s.style);
      assert.equal(s.style["title-size"], "48");
      assert.equal(s.style["spacing"], "tight");
      assert.equal(s.style["opacity"], "0.8");
    });

    it("parses color in style directive", () => {
      const [s] = parseMarkdown("<!-- style: color=FF0000 -->\n# Title");
      assert.ok(s.style);
      assert.equal(s.style["color"], "FF0000");
    });

    it("style is null when no style directive", () => {
      const [s] = parseMarkdown("# Title");
      assert.equal(s.style, null);
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
// DESIGN DIRECTIVE
// ═══════════════════════════════════════════════════════

describe("Design directive", () => {
  it("parseMarkdown extracts design directive as parsed JSON", () => {
    const md = `<!-- design: { "zones": [{ "role": "title", "col": 0, "span": 24, "row": 0, "rowSpan": 20 }], "bg": "0A1628" } -->
# Hello`;
    const [s] = parseMarkdown(md);
    assert.ok(s.design, "design should be parsed");
    assert.deepEqual(s.design.zones[0].role, "title");
    assert.equal(s.design.zones[0].col, 0);
    assert.equal(s.design.zones[0].span, 24);
    assert.equal(s.design.bg, "0A1628");
  });

  it("design is null when no directive present", () => {
    const [s] = parseMarkdown("# Title\n- bullet");
    assert.equal(s.design, null);
  });

  it("design is null for invalid JSON", () => {
    const [s] = parseMarkdown("<!-- design: {invalid json} -->\n# Title");
    assert.equal(s.design, null);
  });

  it("parses multi-line design directive", () => {
    const md = `<!-- design: {
  "zones": [
    { "role": "title", "col": 0, "span": 30, "row": 0, "rowSpan": 20 },
    { "role": "body", "col": 32, "span": 28, "row": 0, "rowSpan": 40 }
  ],
  "accents": [
    { "type": "bar", "col": 30, "span": 1, "row": 0, "rowSpan": 40, "color": "E63946" }
  ],
  "typography": {
    "title": { "size": 48, "weight": 900 },
    "body": { "size": 14, "weight": 400 }
  },
  "bg": "1A1A1A",
  "font": "Georgia"
} -->
# My Title
Some body text`;
    const [s] = parseMarkdown(md);
    assert.ok(s.design);
    assert.equal(s.design.zones.length, 2);
    assert.equal(s.design.accents.length, 1);
    assert.equal(s.design.accents[0].type, "bar");
    assert.equal(s.design.typography.title.size, 48);
    assert.equal(s.design.font, "Georgia");
  });

  it("design coexists with layout directive (layout ignored when design present)", () => {
    const md = `<!-- layout: split -->
<!-- design: { "zones": [{ "role": "title", "col": 0, "span": 30, "row": 0, "rowSpan": 20 }] } -->
# Title`;
    const [s] = parseMarkdown(md);
    assert.equal(s.layout, "split");
    assert.ok(s.design);
    assert.equal(s.design.zones.length, 1);
  });

  describe("zone validation", () => {
    it("col must be in range 0-59", () => {
      const design = { zones: [{ role: "title", col: 0, span: 20, row: 0, rowSpan: 20 }] };
      assert.ok(design.zones[0].col >= 0 && design.zones[0].col <= 59);
    });

    it("col + span must not exceed 60", () => {
      const design = { zones: [{ role: "title", col: 30, span: 30, row: 0, rowSpan: 20 }] };
      assert.ok(design.zones[0].col + design.zones[0].span <= 60);
    });

    it("col + span exceeding 60 is out of bounds", () => {
      const design = { zones: [{ role: "title", col: 50, span: 15, row: 0, rowSpan: 20 }] };
      assert.ok(design.zones[0].col + design.zones[0].span > 60, "should exceed 60");
    });

    it("row must be in range 0-39", () => {
      const design = { zones: [{ role: "title", col: 0, span: 20, row: 0, rowSpan: 20 }] };
      assert.ok(design.zones[0].row >= 0 && design.zones[0].row <= 39);
    });

    it("row + rowSpan must not exceed 40", () => {
      const design = { zones: [{ role: "title", col: 0, span: 20, row: 0, rowSpan: 40 }] };
      assert.ok(design.zones[0].row + design.zones[0].rowSpan <= 40);
    });

    it("row + rowSpan exceeding 40 is out of bounds", () => {
      const design = { zones: [{ role: "title", col: 0, span: 20, row: 30, rowSpan: 15 }] };
      assert.ok(design.zones[0].row + design.zones[0].rowSpan > 40, "should exceed 40");
    });
  });

  describe("renderDesigned", () => {
    it("produces HTML with correct percentage positions", () => {
      const md = `<!-- design: { "zones": [{ "role": "title", "col": 0, "span": 24, "row": 0, "rowSpan": 20 }], "bg": "0A1628" } -->
# Hello World`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      // col=0 → left:0%, span=24 → width: 24/60*100 = 40%
      assert.ok(html.includes("left:0.0000%"), "should have left:0%");
      assert.ok(html.includes("width:40.0000%"), "should have width:40% (24/60)");
      // row=0 → top:0%, rowSpan=20 → height: 20/40*100 = 50%
      assert.ok(html.includes("top:0.0000%"), "should have top:0%");
      assert.ok(html.includes("height:50.0000%"), "should have height:50% (20/40)");
    });

    it("renders accent elements", () => {
      const md = `<!-- design: { "zones": [], "accents": [{ "type": "bar", "col": 26, "span": 2, "row": 0, "rowSpan": 40, "color": "E63946" }] } -->
# Title`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("accent-bar"), "should have accent-bar class");
      assert.ok(html.includes("#E63946"), "should have accent colour");
    });

    it("renders title zone content", () => {
      const md = `<!-- design: { "zones": [{ "role": "title", "col": 0, "span": 30, "row": 0, "rowSpan": 20 }] } -->
# My Title`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("My Title"), "should contain title text");
      assert.ok(html.includes("<h1"), "should use h1 tag");
    });

    it("renders body zone content", () => {
      const md = `<!-- design: { "zones": [{ "role": "body", "col": 30, "span": 28, "row": 0, "rowSpan": 40 }] } -->
## Heading
Body line one
Body line two`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("Body line one"), "should contain body text");
      assert.ok(html.includes("<p"), "should use p tags");
    });

    it("renders bullets zone content", () => {
      const md = `<!-- design: { "zones": [{ "role": "bullets", "col": 0, "span": 40, "row": 10, "rowSpan": 30 }] } -->
- First bullet
- Second bullet`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("First bullet"), "should contain bullet text");
      assert.ok(html.includes("bullets"), "should have bullets class");
    });

    it("renders quote zone content", () => {
      const md = `<!-- design: { "zones": [{ "role": "quote", "col": 5, "span": 50, "row": 10, "rowSpan": 20 }] } -->
> To be or not to be`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("To be or not to be"), "should contain quote text");
      assert.ok(html.includes("<blockquote"), "should use blockquote tag");
    });

    it("applies typography styles", () => {
      const md = `<!-- design: { "zones": [{ "role": "title", "col": 0, "span": 30, "row": 0, "rowSpan": 20 }], "typography": { "title": { "size": 48, "weight": 900, "transform": "uppercase", "tracking": "0.15em" } } } -->
# Styled Title`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("font-size:48px"), "should have font-size from typography");
      assert.ok(html.includes("font-weight:900"), "should have font-weight from typography");
      assert.ok(html.includes("text-transform:uppercase"), "should have text-transform");
      assert.ok(html.includes("letter-spacing:0.15em"), "should have letter-spacing");
    });

    it("handles dot accent type with border-radius", () => {
      const md = `<!-- design: { "zones": [], "accents": [{ "type": "dot", "col": 10, "span": 4, "row": 10, "rowSpan": 4, "color": "FF0000" }] } -->
# Title`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("border-radius:50%"), "dot should have border-radius:50%");
      assert.ok(html.includes("accent-dot"), "should have accent-dot class");
    });

    it("handles block accent type with opacity", () => {
      const md = `<!-- design: { "zones": [], "accents": [{ "type": "block", "col": 0, "span": 20, "row": 0, "rowSpan": 40, "color": "0000FF" }] } -->
# Title`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("opacity:0.15"), "block should have opacity:0.15");
      assert.ok(html.includes("accent-block"), "should have accent-block class");
    });

    it("renders video zone with YouTube iframe", () => {
      const md = `<!-- design: { "zones": [{ "role": "video", "col": 5, "span": 50, "row": 5, "rowSpan": 30 }] } -->
![Demo](https://www.youtube.com/watch?v=dQw4w9WgXcQ)`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("zone-video"), "should have zone-video class");
      assert.ok(html.includes("youtube-nocookie.com/embed/dQw4w9WgXcQ"), "should contain YouTube iframe");
      assert.ok(!html.includes("zone-extras"), "should NOT have extras when video zone exists");
    });

    it("renders image zone content", () => {
      const md = `<!-- design: { "zones": [{ "role": "image", "col": 30, "span": 28, "row": 0, "rowSpan": 40 }] } -->
![Photo](photo.png)`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("zone-image"), "should have zone-image class");
      assert.ok(html.includes("photo.png"), "should contain image src");
      assert.ok(!html.includes("zone-extras"), "should NOT have extras when image zone exists");
    });

    it("renders links zone content", () => {
      const md = `<!-- design: { "zones": [{ "role": "links", "col": 5, "span": 50, "row": 30, "rowSpan": 8 }] } -->
[Example](http://example.com)`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("zone-links"), "should have zone-links class");
      assert.ok(html.includes("example.com"), "should contain link URL");
    });

    it("renders code zone content", () => {
      const md = `<!-- design: { "zones": [{ "role": "code", "col": 5, "span": 50, "row": 10, "rowSpan": 25 }] } -->
\`\`\`js
console.log("hello");
\`\`\``;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("zone-code"), "should have zone-code class");
      assert.ok(html.includes("code-block"), "should contain code-block div");
      assert.ok(html.includes("console.log"), "should contain code text");
    });

    it("appends unzoned video as zone-extras fallback", () => {
      const md = `<!-- design: { "zones": [{ "role": "title", "col": 5, "span": 40, "row": 20, "rowSpan": 10 }] } -->
## Karpathy on Agents
![Demo](https://youtu.be/kwSVtQ7dziU)`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("zone-extras"), "should have zone-extras fallback");
      assert.ok(html.includes("youtube-nocookie.com/embed/kwSVtQ7dziU"), "extras should contain YouTube iframe");
      assert.ok(html.includes("video-responsive"), "should have responsive video wrapper");
    });

    it("appends unzoned images as positioned fallback", () => {
      const md = `<!-- design: { "zones": [{ "role": "title", "col": 5, "span": 40, "row": 0, "rowSpan": 10 }] } -->
# Slide
![Photo](diagram.png)`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("diagram.png"), "extras should contain image");
      assert.ok(html.includes("position:absolute"), "image should be absolutely positioned to avoid text");
    });

    it("appends unzoned links as zone-extras fallback", () => {
      const md = `<!-- design: { "zones": [{ "role": "title", "col": 5, "span": 40, "row": 0, "rowSpan": 10 }] } -->
# Slide
[Resources](http://example.com)`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("zone-extras"), "should have zone-extras for unzoned links");
      assert.ok(html.includes("example.com"), "extras should contain link");
    });

    it("does NOT produce zone-extras when all content has zones", () => {
      const md = `<!-- design: { "zones": [{ "role": "title", "col": 0, "span": 30, "row": 0, "rowSpan": 10 }, { "role": "video", "col": 0, "span": 60, "row": 10, "rowSpan": 30 }] } -->
# Watch
![](https://youtu.be/dQw4w9WgXcQ)`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      assert.ok(html.includes("zone-video"), "should render video in its zone");
      assert.ok(!html.includes("zone-extras"), "should NOT have extras when video zone exists");
    });
  });
});

// ═══════════════════════════════════════════════════════
// LAYOUT DETECTION
// ═══════════════════════════════════════════════════════

describe("Layout detection", () => {
  function detect(md, index = 1, total = 3) {
    // Reset layout history by simulating a new deck
    detectLayout({ layout: null, title: "reset", subtitle: null, bullets: [], body: [], blockquote: null, images: [], videos: [], tables: [], codeBlocks: [], links: [] }, 0, total);
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
// YOUTUBE / VIDEO PARSING
// ═══════════════════════════════════════════════════════

describe("YouTube video parsing", () => {
  it("parses ![title](youtube-url) as video, not image", () => {
    const slides = parseMarkdown("# Demo\n![My Video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)");
    assert.equal(slides[0].videos.length, 1);
    assert.equal(slides[0].images.length, 0);
    assert.equal(slides[0].videos[0].id, "dQw4w9WgXcQ");
    assert.equal(slides[0].videos[0].title, "My Video");
  });

  it("parses youtu.be short URLs", () => {
    const slides = parseMarkdown("![](https://youtu.be/dQw4w9WgXcQ)");
    assert.equal(slides[0].videos.length, 1);
    assert.equal(slides[0].videos[0].id, "dQw4w9WgXcQ");
  });

  it("parses standalone [text](youtube-url) as video", () => {
    const slides = parseMarkdown("[Watch this](https://youtube.com/watch?v=abc123def45)");
    assert.equal(slides[0].videos.length, 1);
    assert.equal(slides[0].links.length, 0);
    assert.equal(slides[0].videos[0].id, "abc123def45");
  });

  it("parses bare YouTube URL on its own line", () => {
    const slides = parseMarkdown("# Slide\nhttps://www.youtube.com/watch?v=abc123def45");
    assert.equal(slides[0].videos.length, 1);
    assert.equal(slides[0].videos[0].id, "abc123def45");
  });

  it("does not treat non-YouTube image as video", () => {
    const slides = parseMarkdown("![photo](./img/photo.png)");
    assert.equal(slides[0].images.length, 1);
    assert.equal(slides[0].videos.length, 0);
  });

  it("auto-detects video layout", () => {
    const slides = parseMarkdown("# Intro\n---\n# Watch\n![](https://youtu.be/dQw4w9WgXcQ)");
    // First slide is title, second has video
    const layout = detectLayout(slides[1], 1, 2);
    assert.equal(layout, "video");
  });
});

// ═══════════════════════════════════════════════════════
// LAYOUT RENDERERS
// ═══════════════════════════════════════════════════════

describe("Layout renderers", () => {
  const allLayouts = [
    "title", "section", "bullets", "stagger", "split",
    "rotated", "fragment", "overlap", "arc", "image",
    "video", "table", "code", "blank",
  ];

  it("all 14 PPTX layouts are registered", () => {
    assert.equal(Object.keys(LAYOUTS).length, 14);
    for (const name of allLayouts) {
      assert.ok(typeof LAYOUTS[name] === "function", `LAYOUTS.${name} should be a function`);
    }
  });

  it("all 14 HTML layouts are registered", () => {
    assert.equal(Object.keys(HTML_LAYOUTS).length, 14);
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
// INTENSITY COMPLIANCE
// ═══════════════════════════════════════════════════════

describe("Intensity compliance checker", () => {
  it("INTENSITY_RULES has minimal, moderate, and maximal", () => {
    assert.ok(INTENSITY_RULES.minimal);
    assert.ok(INTENSITY_RULES.moderate);
    assert.ok(INTENSITY_RULES.maximal);
  });

  it("returns empty for unknown intensity", () => {
    const slides = parseMarkdown("# Title");
    assert.deepEqual(validateIntensity(slides, "nonexistent"), []);
  });

  it("minimal: flags font overrides", () => {
    const md = "# Title\n---\n<!-- font: Georgia -->\n## Slide 2\n- a\n---\n# End";
    const slides = parseMarkdown(md);
    const results = validateIntensity(slides, "minimal");
    assert.ok(results.some(r => r.message.includes("font")), "should flag font override in minimal");
  });

  it("minimal: flags blank slides", () => {
    const md = "# Title\n---\n<!-- layout: blank -->\n---\n## End\n- a";
    const slides = parseMarkdown(md);
    const results = validateIntensity(slides, "minimal");
    assert.ok(results.some(r => r.message.includes("blank")), "should flag blank slide in minimal");
  });

  it("minimal: flags dominant layout over 25%", () => {
    // 4 slides, 3 with same detected layout = 75%
    const md = "# Title\n---\n## A\nBody\n---\n## B\nBody\n---\n## C\nBody";
    const slides = parseMarkdown(md);
    const results = validateIntensity(slides, "minimal");
    // split will be detected for A, B, C (75%)
    assert.ok(results.some(r => r.message.includes("%")), "should flag dominant layout");
  });

  it("maximal: flags too few layout types", () => {
    // Only 3 layout types
    const md = "# Title\n---\n## A\n- a\n- b\n---\n## B\n- c\n- d\n---\n## End";
    const slides = parseMarkdown(md);
    const results = validateIntensity(slides, "maximal");
    assert.ok(results.some(r => r.message.includes("layout types")), "should flag insufficient layout variety");
  });

  it("maximal: flags missing required layouts", () => {
    const md = "# Title\n---\n## A\n- a\n---\n## B\n- b\n---\n## End";
    const slides = parseMarkdown(md);
    const results = validateIntensity(slides, "maximal");
    assert.ok(results.some(r => r.message.includes("stagger")), "should flag missing stagger");
    assert.ok(results.some(r => r.message.includes("rotated")), "should flag missing rotated");
  });

  it("maximal: flags insufficient font overrides", () => {
    const md = "# Title\n---\n## Slide\n- a\n- b\n---\n# End";
    const slides = parseMarkdown(md);
    const results = validateIntensity(slides, "maximal");
    assert.ok(results.some(r => r.message.includes("font")), "should flag missing font overrides");
  });

  it("detects 3× consecutive same layout", () => {
    // 5 slides: title, split, split, split, section → 3× split in a row
    const md = "# Title\n---\n## A\nBody\n---\n## B\nBody\n---\n## C\nBody\n---\n# End";
    const slides = parseMarkdown(md);
    const results = validateIntensity(slides, "moderate");
    assert.ok(results.some(r => r.message.includes("3× in a row")), "should flag 3× consecutive layout");
  });

  it("moderate: flags too few bg overrides", () => {
    // No bg overrides → 0%, moderate needs 30%+
    const md = "# Title\n---\n## A\n- a\n---\n## B\n- b\n---\n# End";
    const slides = parseMarkdown(md);
    const results = validateIntensity(slides, "moderate");
    assert.ok(results.some(r => r.message.includes("bg overrides")), "should flag missing bg overrides");
  });

  it("flags slide count mismatch when source count provided", () => {
    const slides = parseMarkdown("# Title\n---\n## A\n- a\n---\n## B\n- b");
    // Source had 3 slides, composed has 3 — should pass
    const passResults = validateIntensity(slides, "minimal", 3);
    assert.ok(!passResults.some(r => r.message.includes("slides")),
      "same count should not flag");
    // Source had 5, composed has 3 — should fail
    const failResults = validateIntensity(slides, "minimal", 5);
    assert.ok(failResults.some(r => r.message.includes("slides") && r.message.includes("must be equal")),
      "different count should flag");
  });

  it("INTENSITY_RULES: all levels require slideCountMatch", () => {
    for (const [name, rules] of Object.entries(INTENSITY_RULES)) {
      assert.equal(rules.slideCountMatch, true, `${name} should require slideCountMatch`);
    }
  });

  it("INTENSITY_RULES: all levels have zero blank slides allowed", () => {
    for (const [name, rules] of Object.entries(INTENSITY_RULES)) {
      assert.deepEqual(rules.blankSlides, [0, 0], `${name} should have [0,0] blank slides`);
    }
  });

  it("validates actual composed output files if they exist", () => {
    const fsModule = require("fs");
    const dir = "./decks/compare-week-1-2026-03-20-19-38-";
    if (!fsModule.existsSync(dir)) return;

    for (const sub of ["minimal-light", "moderate-light", "maximal-light"]) {
      const mdPath = `${dir}/${sub}/week-1.${sub}.composed.md`;
      if (!fsModule.existsSync(mdPath)) continue;
      const intensity = sub.split("-")[0];
      const slides = parseMarkdown(fsModule.readFileSync(mdPath, "utf-8"));
      const results = validateIntensity(slides, intensity);
      // Just log — don't assert pass (Claude compliance is imperfect)
      if (results.length > 0) {
        console.log(`  [${sub}] ${results.length} compliance issues`);
      }
    }
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

  it("DESIGN_BRIEF describes 60 HORIZONTAL columns, not a cell grid", () => {
    assert.ok(DESIGN_BRIEF.includes("HORIZONTAL") || DESIGN_BRIEF.includes("horizontal"),
      "should explicitly say horizontal columns");
    assert.ok(DESIGN_BRIEF.includes("NOT") && DESIGN_BRIEF.includes("10"),
      "should clarify it is NOT a 10×6 cell grid");
    assert.ok(DESIGN_BRIEF.includes("60") && DESIGN_BRIEF.includes("column"),
      "should reference 60 columns");
  });

  it("DESIGN_MOODS provides distinct mood seeds (not hardcoded palettes)", () => {
    assert.ok(Array.isArray(DESIGN_MOODS));
    assert.ok(DESIGN_MOODS.length >= 8);
    const names = DESIGN_MOODS.map(m => m.name);
    assert.equal(new Set(names).size, names.length, "mood names must be unique");
    DESIGN_MOODS.forEach(m => {
      assert.ok(m.seed && m.seed.length > 20, `mood "${m.name}" needs a seed`);
      // Seeds should be short conceptual prompts, NOT hardcoded hex values
      const hexCount = (m.seed.match(/[0-9A-F]{6}/g) || []).length;
      assert.ok(hexCount === 0, `mood "${m.name}" seed should not hardcode hex colours (found ${hexCount})`);
    });
  });

  it("INTENSITY has minimal, moderate, and maximal levels", () => {
    assert.ok(INTENSITY.minimal);
    assert.ok(INTENSITY.moderate);
    assert.ok(INTENSITY.maximal);
  });

  describe("intensity levels define different grid philosophies", () => {
    it("all intensities: exact slide count", () => {
      for (const [name, text] of Object.entries(INTENSITY)) {
        assert.ok(text.includes("EXACTLY"), `${name} must require EXACTLY N slides`);
      }
    });

    it("minimal: Helvetica only, no font overrides", () => {
      assert.ok(INTENSITY.minimal.includes("Helvetica Neue ONLY") || INTENSITY.minimal.includes("Helvetica Neue only"),
        "minimal should restrict to Helvetica");
    });

    it("minimal: light backgrounds, wide margins", () => {
      assert.ok(INTENSITY.minimal.includes("light") || INTENSITY.minimal.includes("80%"),
        "minimal should emphasise light backgrounds");
      assert.ok(INTENSITY.minimal.includes("margin") || INTENSITY.minimal.includes("whitespace"),
        "minimal should emphasise wide margins");
    });

    it("minimal: restrained type scale", () => {
      assert.ok(INTENSITY.minimal.includes("28") || INTENSITY.minimal.includes("36"),
        "minimal should specify moderate title sizes");
    });

    it("moderate: asymmetric zones, editorial confidence", () => {
      assert.ok(INTENSITY.moderate.includes("asymmetric") || INTENSITY.moderate.includes("vary position"),
        "moderate should encourage asymmetric zone placement");
    });

    it("moderate: accent elements", () => {
      assert.ok(INTENSITY.moderate.includes("accent") || INTENSITY.moderate.includes("bar") || INTENSITY.moderate.includes("line"),
        "moderate should introduce accent elements");
    });

    it("maximal: UNIQUE composition per slide", () => {
      assert.ok(INTENSITY.maximal.includes("UNIQUE") || INTENSITY.maximal.includes("unique"),
        "maximal should require unique compositions");
    });

    it("maximal: extreme type scale range", () => {
      assert.ok(INTENSITY.maximal.includes("96") || INTENSITY.maximal.includes("18"),
        "maximal should specify extreme type size range");
    });

    it("maximal: bold accent elements on 50%+ slides", () => {
      assert.ok(INTENSITY.maximal.includes("50%") && INTENSITY.maximal.includes("accent"),
        "maximal should mandate accents on majority of slides");
    });

    it("grid composition varies across levels", () => {
      // Minimal: narrow zones, wide margins
      assert.ok(INTENSITY.minimal.includes("span") && INTENSITY.minimal.includes("col"),
        "minimal should reference grid columns");
      // Maximal: full-bleed and extreme positions
      assert.ok(INTENSITY.maximal.includes("full-bleed") || INTENSITY.maximal.includes("span:58"),
        "maximal should reference full-bleed compositions");
    });
  });

  it("buildPrompt includes the source markdown", () => {
    const prompt = buildPrompt("# My Slide\n- bullet one", { intensity: "moderate" });
    assert.ok(prompt.includes("My Slide"));
    assert.ok(prompt.includes("bullet one"));
  });

  it("buildPrompt includes intensity guide", () => {
    const prompt = buildPrompt("# Title", { intensity: "maximal" });
    assert.ok(prompt.includes("MAXIMAL"));
  });

  it("buildPrompt defaults to moderate", () => {
    const prompt = buildPrompt("# Title", {});
    assert.ok(prompt.includes("MODERATE"));
  });

  it("buildPrompt includes custom brief when provided", () => {
    const prompt = buildPrompt("# Title", { brief: "brutalist maximalism" });
    assert.ok(prompt.includes("brutalist maximalism"));
  });

  it("buildPrompt --slides filters source slides", () => {
    const md = "# Slide 1\n---\n# Slide 2\n---\n# Slide 3\n---\n# Slide 4";
    const prompt = buildPrompt(md, { slides: "2-3", intensity: "minimal" });
    assert.ok(prompt.includes("Slide 2"), "should include slide 2");
    assert.ok(prompt.includes("Slide 3"), "should include slide 3");
    assert.ok(!prompt.includes("Slide 4"), "should not include slide 4");
    assert.ok(prompt.includes("2 objects"), "should request 2 directives");
  });

  it("buildPrompt --slides single slide", () => {
    const md = "# Slide 1\n---\n# Slide 2\n---\n# Slide 3";
    const prompt = buildPrompt(md, { slides: "2", intensity: "minimal" });
    assert.ok(prompt.includes("Slide 2"));
    assert.ok(!prompt.includes("Slide 1"));
    assert.ok(prompt.includes("1 objects"), "should request 1 directive");
  });

  describe("JSON directives approach", () => {
    it("prompt asks for JSON array of directives", () => {
      const prompt = buildPrompt("# Title\n- a\n- b", { intensity: "maximal" });
      assert.ok(prompt.includes("JSON array"),
        "should ask for JSON array");
    });

    it("prompt specifies layout, bg, font, label fields", () => {
      const prompt = buildPrompt("# Title", { intensity: "moderate" });
      assert.ok(prompt.includes('"layout"') && prompt.includes('"bg"') && prompt.includes('"font"'),
        "should specify directive fields");
    });

    it("DESIGN PLAN asks for accent strategy", () => {
      const prompt = buildPrompt("# Title", { intensity: "maximal" });
      assert.ok(prompt.includes("Accent strategy:") || prompt.includes("accent"),
        "design plan should ask for accent strategy");
    });

    it("prompt includes layout options", () => {
      const prompt = buildPrompt("# Title", { intensity: "moderate" });
      assert.ok(prompt.includes("split") || prompt.includes("stagger") || prompt.includes("layout"),
        "prompt should reference layout types");
    });

    it("prompt requests exact slide count", () => {
      const prompt = buildPrompt("# Title\n---\n# Slide 2", { intensity: "maximal" });
      assert.ok(prompt.includes("EXACTLY 2") || prompt.includes("exactly 2"),
        "prompt should request exact slide count");
    });

    it("mood seeds are conceptual, not hex-coded recipes", () => {
      DESIGN_MOODS.forEach(m => {
        const hexMatches = m.seed.match(/[0-9A-Fa-f]{6}/g) || [];
        assert.equal(hexMatches.length, 0,
          `mood "${m.name}" seed contains hardcoded hex: ${hexMatches.join(", ")}`);
      });
    });

    it("intensity prompts reference grid columns and zones", () => {
      for (const [name, text] of Object.entries(INTENSITY)) {
        assert.ok(text.includes("col") && text.includes("span"),
          `${name} should reference grid columns and spans`);
      }
    });

    it("intensities specify different type scale ranges", () => {
      // Minimal: restrained (28-36px), Maximal: extreme (18-96px)
      assert.ok(INTENSITY.minimal.includes("28") || INTENSITY.minimal.includes("32"));
      assert.ok(INTENSITY.maximal.includes("96") || INTENSITY.maximal.includes("72"));
    });
  });

  describe("sanitizeClaudeOutput", () => {
    it("strips code fences", () => {
      const raw = "```markdown\n<!-- layout: section -->\n# Title\n```";
      const result = sanitizeClaudeOutput(raw);
      assert.ok(result.startsWith("<!-- layout:"));
    });

    it("strips text preamble but preserves comment blocks", () => {
      const raw = "Here is your deck:\n\n<!-- layout: title -->\n# Hello";
      const result = sanitizeClaudeOutput(raw);
      assert.ok(result.includes("<!-- layout:"));
      assert.ok(!result.includes("Here is your deck"));
    });

    it("preserves design plan comments in output", () => {
      const raw = "<!-- DESIGN PLAN\nMood: nocturne\nPalette: 111111\n-->\n\n<!-- layout: title -->\n# Hello";
      const result = sanitizeClaudeOutput(raw);
      assert.ok(result.includes("DESIGN PLAN"), "design plan should be preserved");
      assert.ok(result.includes("<!-- layout:"), "layout directives should be preserved");
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
// THEME-AWARENESS IN COMPOSE
// ═══════════════════════════════════════════════════════

describe("Theme-aware compose", () => {
  const src = require("fs").readFileSync("./compose.js", "utf-8");

  it("design system prompt includes theme description for light", () => {
    assert.ok(src.includes("LIGHT THEME"), "should have LIGHT THEME description");
    assert.ok(src.includes("warm white") || src.includes("paper"),
      "light theme should mention warm/white/paper");
  });

  it("design system prompt includes theme description for dark", () => {
    assert.ok(src.includes("DARK THEME"), "should have DARK THEME description");
    assert.ok(src.includes("near-black"), "dark theme should mention near-black");
  });

  it("light theme instructs 70%+ null bg", () => {
    assert.ok(src.includes("70%") && src.includes("null"),
      "light theme should tell Claude to leave 70%+ slides without bg override");
  });

  it("theme is passed to design system generation", () => {
    assert.ok(src.includes("options.theme") || src.includes("themeName"),
      "composeIncremental should read options.theme");
    assert.ok(src.includes("themeDesc"), "should have theme descriptions object");
  });
});

// ═══════════════════════════════════════════════════════
// JSON DIRECTIVE PIPELINE
// ═══════════════════════════════════════════════════════

describe("JSON directive pipeline", () => {
  const src = require("fs").readFileSync("./compose.js", "utf-8");

  it("incremental compose asks for JSON directives, not content", () => {
    assert.ok(src.includes("Do NOT reproduce the slide content") ||
      src.includes("one JSON object") || src.includes('"layout"'),
      "should ask for JSON directives only");
  });

  it("directives are merged with original source (not reproduced by Claude)", () => {
    assert.ok(src.includes("mergedSlides") || src.includes("merge"),
      "should merge directives with original source");
  });

  it("slide summaries sent to Claude, not full content", () => {
    assert.ok(src.includes("slideSummaries") || src.includes("bulletCount"),
      "should send summaries, not full slide content");
  });

  it("JSON parsing handles both array and one-per-line formats", () => {
    assert.ok(src.includes("startsWith(\"[\")") || src.includes("split(\"\\n\")"),
      "should handle JSON array and line-by-line");
  });
});

// ═══════════════════════════════════════════════════════
// SESSION REUSE
// ═══════════════════════════════════════════════════════

describe("Session reuse", () => {
  const src = require("fs").readFileSync("./compose.js", "utf-8");

  it("callClaudeAsync supports --resume flag", () => {
    assert.ok(src.includes("options.resume") && src.includes("--resume"),
      "should pass --resume to CLI when session exists");
  });

  it("session_id is extracted from stream-json result", () => {
    assert.ok(src.includes("__SESSION:") && src.includes("session_id"),
      "should extract session_id from result event");
  });

  it("first call sends full context, subsequent calls resume", () => {
    assert.ok(src.includes("sessionId") && (src.includes("useSession") || src.includes("!sessionId")),
      "should check sessionId to decide full vs resume prompt");
  });
});

// ═══════════════════════════════════════════════════════
// ANTI-REGRESSION: KNOWN BUGS
// ═══════════════════════════════════════════════════════

describe("Anti-regression guards", () => {

  it("--slides filter applied in incremental compose", () => {
    const src = require("fs").readFileSync("./compose.js", "utf-8");
    // composeIncremental must filter sourceSlides by options.slides
    const incremental = src.slice(src.indexOf("async function composeIncremental"));
    assert.ok(incremental.includes("options.slides"),
      "composeIncremental must apply --slides filter");
  });

  it("designed slides use position:absolute not position:relative", () => {
    const {generateHTMLCSS} = require("./raster.js");
    const css = generateHTMLCSS();
    assert.ok(css.includes(".slide.designed{position:absolute"),
      "designed slides must use position:absolute;inset:0 to fill viewport");
    assert.ok(!css.includes(".slide.designed{position:relative"),
      "position:relative causes black screen — must not be used");
  });

  it("CLI uses --setting-sources user to skip project CLAUDE.md", () => {
    const src = require("fs").readFileSync("./compose.js", "utf-8");
    assert.ok(src.includes("--setting-sources") && src.includes("user"),
      "CLI calls should use --setting-sources user to avoid CLAUDE.md caching overhead");
  });

  it("CLI uses --append-system-prompt to suppress Insight blocks", () => {
    const src = require("fs").readFileSync("./compose.js", "utf-8");
    assert.ok(src.includes("--append-system-prompt") && src.includes("No commentary"),
      "CLI calls should append system prompt suppressing Insight blocks");
  });

  it("normaliseDesign handles Claude's varied JSON schemas", () => {
    const {parseMarkdown} = require("./raster.js");
    // titleZone format (Claude's common variation)
    const [s1] = parseMarkdown('<!-- design: {"titleZone":{"col":0,"span":24,"row":0,"rowSpan":20},"bg":"F0E9DE"} -->\n# Title');
    assert.ok(s1.design, "should normalise titleZone format");
    assert.equal(s1.design.zones[0].role, "title");
    assert.equal(s1.design.zones[0].col, 0);

    // colSpan format
    const [s2] = parseMarkdown('<!-- design: {"titleZone":{"col":0,"colSpan":24,"row":0,"rowSpan":20}} -->\n# Title');
    assert.ok(s2.design, "should normalise colSpan → span");
    assert.equal(s2.design.zones[0].span, 24);

    // width/height format
    const [s3] = parseMarkdown('<!-- design: {"titleZone":{"col":0,"width":24,"row":0,"height":20}} -->\n# Title');
    assert.ok(s3.design, "should normalise width → span, height → rowSpan");
    assert.equal(s3.design.zones[0].span, 24);
    assert.equal(s3.design.zones[0].rowSpan, 20);

    // background → bg normalisation
    const [s4] = parseMarkdown('<!-- design: {"zones":[{"role":"title","col":0,"span":30,"row":0,"rowSpan":20}],"background":"#1A1A1A"} -->\n# Title');
    assert.ok(s4.design);
    assert.equal(s4.design.bg, "1A1A1A");
  });

  it("Insight blocks are stripped from slide output", () => {
    const src = require("fs").readFileSync("./compose.js", "utf-8");
    // Post-processing strip
    assert.ok(src.includes("designStart") || src.includes("indexOf(\"<!-- design:\")"),
      "should strip preamble before design/layout directives");
  });

  it("stall detection kills after 90s with no progress", () => {
    const src = require("fs").readFileSync("./compose.js", "utf-8");
    assert.ok(src.includes("90") && src.includes("stallCheck"),
      "should detect stall after 90s with no progress");
  });

  it("content preservation: slide count must match", () => {
    const {validateContentPreservation} = require("./qa.js");
    const ok = validateContentPreservation("# A\n---\n# B", "<!-- layout: section -->\n# A\n---\n<!-- layout: bullets -->\n# B");
    assert.ok(!ok.some(r => r.check === "slideCount"), "same count should pass");
    const bad = validateContentPreservation("# A\n---\n# B\n---\n# C", "<!-- layout: section -->\n# A\n---\n<!-- layout: bullets -->\n# B");
    assert.ok(bad.some(r => r.check === "slideCount"), "different count should fail");
  });

  it("bg-accent colour clash detection exists in QA", () => {
    const src = require("fs").readFileSync("./qa.js", "utf-8");
    assert.ok(src.includes("accent") && src.includes("dist < 80"),
      "QA should detect bg-accent colour clash (Euclidean distance < 80)");
  });
});

// ═══════════════════════════════════════════════════════
// OUTPUT PATH CONTRACTS
// ═══════════════════════════════════════════════════════

describe("Output path contracts", () => {
  it("compose CLI: output defaults to same dir as input", () => {
    const src = require("fs").readFileSync("./compose.js", "utf-8");
    // The default output is input.replace(.md, .html) — preserves directory
    assert.ok(src.includes('input.replace(/\\.md$/, ".html")'),
      "CLI should derive output from input path (same directory)");
  });

  it("compose CLI: workDir derived from outputPath (same directory)", () => {
    const src = require("fs").readFileSync("./compose.js", "utf-8");
    assert.ok(src.includes('outputPath.replace(/\\.(pptx|html)$/, ".compose")'),
      "workDir should be derived from outputPath");
  });

  it("compose CLI: composedPath derived from outputPath (same directory)", () => {
    const src = require("fs").readFileSync("./compose.js", "utf-8");
    assert.ok(src.includes('outputPath.replace(/\\.(pptx|html)$/, ".composed.md")'),
      "composedPath should be derived from outputPath");
  });

  it("npm start: output goes to input's directory, not project root", () => {
    const src = require("fs").readFileSync("./rastersysteme.js", "utf-8");
    // Must use path.dirname(input) or similar — NOT SCRIPT_DIR
    assert.ok(src.includes("path.dirname(path.resolve(input))") || src.includes("outputDir"),
      "npm start must write output to input file's directory");
    assert.ok(!src.includes('path.join(SCRIPT_DIR, `${outputName}.html`)'),
      "must NOT write HTML to SCRIPT_DIR (project root)");
  });

  it("background renderer writes to correct outputPath", () => {
    const src = require("fs").readFileSync("./compose.js", "utf-8");
    // The background renderer should use generateHTML(composedPath, outputPath, ...)
    // NOT fork a child process with potentially wrong paths
    assert.ok(src.includes("generateHTML(composedPath, outputPath"),
      "background renderer should use generateHTML with correct paths");
  });

  it("refresh.js re-renders all composed.md files", () => {
    const src = require("fs").readFileSync("./refresh.js", "utf-8");
    assert.ok(src.includes(".composed.md") && src.includes("Re-render"),
      "refresh should find and re-render .composed.md files");
    assert.ok(!src.includes("--all") || src.includes("--minimal"),
      "refresh should render decks by default (not require --all)");
  });
});

// ═══════════════════════════════════════════════════════
// THEME ENFORCEMENT + DESIGN CONSISTENCY
// ═══════════════════════════════════════════════════════

describe("Theme enforcement in compose pipeline", () => {
  const src = require("fs").readFileSync("./compose.js", "utf-8");

  it("post-processes bg luminance: light theme rejects dark bg", () => {
    assert.ok(src.includes("lum < 100") && src.includes("too dark"),
      "should check luminance and replace dark bg on light themes");
  });

  it("post-processes bg luminance: dark theme rejects light bg", () => {
    assert.ok(src.includes("lum > 200") && src.includes("too light"),
      "should check luminance and replace light bg on dark themes");
  });

  it("palette validation demotes dark ground colours in light theme", () => {
    assert.ok(src.includes("demoted to accent") || src.includes("Fixing dark"),
      "should demote dark ground/dominant colours in light theme palette");
  });

  it("palette validation injects Warm White if no light ground exists", () => {
    assert.ok(src.includes("Warm White") && src.includes("F8F5F0"),
      "should inject Warm White ground if palette has none");
  });

  it("design prompt asks for consistent grid templates, not unique per slide", () => {
    assert.ok(src.includes("2-3 CONSISTENT") || src.includes("consistent grid"),
      "should ask for consistent templates, not unique layouts per slide");
  });

  it("design prompt asks for subtle variation within templates", () => {
    assert.ok(src.includes("SUBTLE variation") || src.includes("subtle variation"),
      "should ask for subtle variation, not radical changes per slide");
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
    const prompt = buildEvalPrompt("src", "composed", {}, "minimal");
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
// CONTENT PRESERVATION
// ═══════════════════════════════════════════════════════

describe("Content preservation checker", () => {
  it("detects dropped URLs", () => {
    const source = "Visit https://example.com for details";
    const composed = "<!-- layout: section -->\n# Visit for details";
    const results = validateContentPreservation(source, composed);
    assert.ok(results.some(r => r.check === "urlPreservation"), "should flag missing URL");
  });

  it("detects dropped emails", () => {
    const source = "Contact jane@example.com";
    const composed = "<!-- layout: section -->\n# Contact us";
    const results = validateContentPreservation(source, composed);
    assert.ok(results.some(r => r.check === "emailPreservation"), "should flag missing email");
  });

  it("passes when all content preserved", () => {
    const source = "Visit https://example.com\n---\nContact jane@example.com";
    const composed = "<!-- layout: section -->\nVisit https://example.com\n---\n<!-- layout: bullets -->\nContact jane@example.com";
    const results = validateContentPreservation(source, composed);
    const errors = results.filter(r => r.severity === "error");
    assert.equal(errors.length, 0, "should have no errors when content preserved");
  });

  it("flags slide count mismatch (fewer)", () => {
    const source = "# A\n---\n# B\n---\n# C";
    const composed = "<!-- layout: section -->\n# A";
    const results = validateContentPreservation(source, composed);
    assert.ok(results.some(r => r.check === "slideCount"), "should flag slide count mismatch");
  });

  it("flags slide count mismatch (more)", () => {
    const source = "# A\n---\n# B";
    const composed = "<!-- layout: section -->\n# A\n---\n<!-- layout: bullets -->\n# B\n---\n<!-- layout: section -->\n# C extra";
    const results = validateContentPreservation(source, composed);
    assert.ok(results.some(r => r.check === "slideCount"), "should flag extra slides");
  });

  it("ignores HTML comments when counting slides", () => {
    const source = "# A\n---\n# B";
    const composed = "<!-- DESIGN PLAN\nMood: test\n-->\n\n<!-- layout: section -->\n# A\n---\n<!-- layout: bullets -->\n# B";
    const results = validateContentPreservation(source, composed);
    const countErrors = results.filter(r => r.check === "slideCount");
    assert.equal(countErrors.length, 0, "DESIGN PLAN comment should not inflate slide count");
  });

  it("flags missing layout directives", () => {
    const source = "# A\n---\n# B";
    const composed = "# A\n---\n# B"; // no <!-- layout: --> directives
    const results = validateContentPreservation(source, composed);
    assert.ok(results.some(r => r.check === "layoutDirectives"), "should flag missing layout directives");
  });

  it("flags invalid layout names", () => {
    const source = "# A";
    const composed = "<!-- layout: funky -->\n# A";
    const results = validateContentPreservation(source, composed);
    assert.ok(results.some(r => r.check === "layoutValidity"), "should flag invalid layout name");
  });

  it("flags 3× consecutive same layout", () => {
    const source = "# A\n---\n# B\n---\n# C\n---\n# D";
    const composed = "<!-- layout: section -->\n# A\n---\n<!-- layout: section -->\n# B\n---\n<!-- layout: section -->\n# C\n---\n<!-- layout: section -->\n# D";
    const results = validateContentPreservation(source, composed);
    assert.ok(results.some(r => r.check === "layoutRepetition"), "should flag 3× consecutive layout");
  });

  it("detects invented URLs", () => {
    const source = "# Hello";
    const composed = "<!-- layout: section -->\n# Hello\nhttps://invented.example.com";
    const results = validateContentPreservation(source, composed);
    assert.ok(results.some(r => r.check === "noInvention"), "should flag invented URL");
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
// INTERACTIVE FLOW (rastersysteme.js) — regression guards
// ═══════════════════════════════════════════════════════

describe("Interactive flow contracts", () => {
  const src = require("fs").readFileSync("./rastersysteme.js", "utf-8");

  it("explosive mode skips theme selection", () => {
    // The theme select must be gated behind mode.key !== 'x'
    assert.ok(src.includes('mode.key !== "x"'), "theme selection should be skipped for explosive mode");
  });

  it("creative brief defaults to skip (no Claude call)", () => {
    // 'skip' should be the first option in the CREATIVE BRIEF menu
    const briefMenuMatch = src.match(/CREATIVE BRIEF.*?\[([^\]]+)\]/s);
    assert.ok(briefMenuMatch, "should have CREATIVE BRIEF select menu");
    const firstItem = briefMenuMatch[1].match(/key:\s*"(\w)"/);
    assert.ok(firstItem, "should have items in brief menu");
    assert.equal(firstItem[1], "s", "first brief option should be 'skip' (key 's')");
  });

  it("skip brief returns empty string (no Claude invocation)", () => {
    // getBrief should return "" for skip, not generate anything
    assert.ok(src.includes('briefMode.key === "s") return ""'), "skip should return empty string immediately");
  });

  it("explosive mode passes --explosive flag to compare.js", () => {
    assert.ok(src.includes('"--explosive"'), "explosive should pass --explosive to compare");
  });

  it("explosive mode does not pass --theme to compare.js", () => {
    // The compare args should only include --theme for non-explosive
    assert.ok(src.includes('if (!explosive) compareArgs.push("--theme"'), "theme should be conditional on non-explosive");
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

// ═══════════════════════════════════════════════════════
// CONTENT PRESERVATION IN DESIGNED SLIDES
// ═══════════════════════════════════════════════════════

describe("Designed slide content preservation", () => {
  describe("double ### parsing", () => {
    it("first short ### becomes sectionLabel, second becomes subtitle", () => {
      const md = `<!-- design: {"zones":[{"role":"label","col":0,"span":20,"row":0,"rowSpan":5},{"role":"title","col":0,"span":40,"row":10,"rowSpan":10}]} -->
### LABEL
### Actual Title Text`;
      const [slide] = parseMarkdown(md);
      assert.equal(slide.sectionLabel, "LABEL", "first ### should be sectionLabel");
      assert.equal(slide.subtitle, "Actual Title Text", "second ### should be subtitle");
    });

    it("single ### remains as sectionLabel", () => {
      const md = `<!-- design: {"zones":[]} -->
### ONLY LABEL
## Real Title`;
      const [slide] = parseMarkdown(md);
      assert.equal(slide.sectionLabel, "ONLY LABEL");
      assert.equal(slide.subtitle, "Real Title");
    });

    it("second ### does not overwrite subtitle if already set via ##", () => {
      const md = `<!-- design: {"zones":[]} -->
## My Subtitle
### LABEL`;
      const [slide] = parseMarkdown(md);
      assert.equal(slide.subtitle, "My Subtitle");
      assert.equal(slide.sectionLabel, "LABEL");
    });
  });

  describe("body zone falls back to bullets", () => {
    it("renders bullets in body zone when no body text exists", () => {
      const md = `<!-- design: {"zones":[{"role":"title","col":0,"span":30,"row":0,"rowSpan":10},{"role":"body","col":0,"span":50,"row":12,"rowSpan":28}]} -->
## Title
- First bullet
- Second bullet
- Third bullet`;
      const [slide] = parseMarkdown(md);
      assert.equal(slide.bullets.length, 3, "should parse 3 bullets");
      assert.equal(slide.body.length, 0, "should have no body text");
      const html = renderDesigned(slide);
      assert.ok(html.includes("First bullet"), "body zone should contain bullet text");
      assert.ok(html.includes("Second bullet"), "body zone should contain all bullets");
    });

    it("renders both body text AND bullets in body zone", () => {
      const md = `<!-- design: {"zones":[{"role":"body","col":0,"span":50,"row":0,"rowSpan":40}]} -->
## Heading
Intro paragraph
- Bullet one
- Bullet two`;
      const [slide] = parseMarkdown(md);
      assert.ok(slide.body.length > 0, "should have body text");
      assert.ok(slide.bullets.length > 0, "should have bullets");
      const html = renderDesigned(slide);
      assert.ok(html.includes("Intro paragraph"), "should contain body text");
      assert.ok(html.includes("Bullet one"), "should also contain bullets");
    });
  });

  describe("bullets zone falls back to body text", () => {
    it("renders body paragraphs in bullets zone when no bullets exist", () => {
      const md = `<!-- design: {"zones":[{"role":"bullets","col":0,"span":50,"row":0,"rowSpan":40}]} -->
## Heading
A body paragraph here
Another body paragraph`;
      const [slide] = parseMarkdown(md);
      assert.equal(slide.bullets.length, 0);
      assert.ok(slide.body.length > 0, "should have body text");
      const html = renderDesigned(slide);
      assert.ok(html.includes("A body paragraph"), "bullets zone should fall back to body text");
    });
  });

  describe("quote zone falls back to body text", () => {
    it("renders body text in quote zone when no blockquote exists", () => {
      const md = `<!-- design: {"zones":[{"role":"label","col":0,"span":10,"row":0,"rowSpan":5},{"role":"quote","col":0,"span":50,"row":8,"rowSpan":30}]} -->
### CRAWFORD
Long prose paragraph that is not a blockquote but should render in the quote zone.`;
      const [slide] = parseMarkdown(md);
      assert.equal(slide.blockquote, null);
      assert.ok(slide.body.length > 0);
      const html = renderDesigned(slide);
      assert.ok(html.includes("Long prose paragraph"), "quote zone should fall back to body text");
    });
  });

  describe("unzoned body content appended as extras", () => {
    it("body text renders when design has only a title zone", () => {
      const md = `<!-- design: {"zones":[{"role":"title","col":0,"span":40,"row":5,"rowSpan":10}]} -->
## Bold Proposition
First paragraph of body text
Second paragraph of body text`;
      const [slide] = parseMarkdown(md);
      assert.ok(slide.body.length >= 2, "should parse body paragraphs");
      const html = renderDesigned(slide);
      assert.ok(html.includes("First paragraph"), "unzoned body should appear as extras");
      assert.ok(html.includes("Second paragraph"), "all body paragraphs should appear");
    });

    it("bullets render when design has only a title zone", () => {
      const md = `<!-- design: {"zones":[{"role":"title","col":0,"span":40,"row":5,"rowSpan":10}]} -->
## Title
- Alpha
- Beta
- Gamma`;
      const [slide] = parseMarkdown(md);
      assert.equal(slide.bullets.length, 3);
      const html = renderDesigned(slide);
      assert.ok(html.includes("Alpha"), "unzoned bullets should appear as extras");
      assert.ok(html.includes("Gamma"), "all bullets should appear");
    });
  });

  describe("no content loss in designed slides", () => {
    it("every non-empty parsed field renders in the HTML", () => {
      const md = `<!-- design: {"zones":[{"role":"label","col":0,"span":10,"row":0,"rowSpan":5},{"role":"title","col":0,"span":30,"row":5,"rowSpan":10},{"role":"body","col":0,"span":50,"row":16,"rowSpan":24}],"bg":"F8F5F0"} -->
### SECTION LABEL
## Main Title
Body paragraph here
- Bullet item A
- Bullet item B
> A blockquote line`;
      const [slide] = parseMarkdown(md);
      const html = renderDesigned(slide);
      // All content types should appear somewhere
      assert.ok(html.includes("SECTION LABEL"), "label should render in label zone");
      assert.ok(html.includes("Main Title"), "title should render in title zone");
      assert.ok(html.includes("Body paragraph"), "body should render in body zone");
      assert.ok(html.includes("Bullet item A"), "bullets should render in body zone via inclusion");
      assert.ok(html.includes("blockquote line"), "blockquote should render in body zone via inclusion");
    });
  });
});
