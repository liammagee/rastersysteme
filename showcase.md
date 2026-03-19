# Rastersysteme

## A Swiss Grid Manifesto

- Typography
- Proportion
- Rhythm
- Colour
- Tension

```notes
Title slide. "Rastersysteme" — German for "grid systems." The five topic pills map to the five sections of this presentation. Each section explores one axis of Swiss graphic design, then shows how New Wave pushed it further. The 60-column grid underpins every slide.
```

---

<!-- layout: section -->
<!-- bg: 1A1A1A -->

## I. Das Raster

### THE GRID

```notes
Section I: The Grid. "Das Raster" is the German term. We begin with the mathematical foundation that makes everything else possible.
```

---

## The Module

### GRUNDLAGEN

A grid is not a cage. It is a coordinate system for decisions.

Every element placed on a grid exists in relationship to every other element. The grid makes those relationships explicit, measurable, and reproducible.

> The grid system is an aid, not a guarantee. It permits a number of possible uses and each designer can look for a solution appropriate to his personal style.

```notes
"Grundlagen" = foundations. This quote is from Josef Müller-Brockmann's "Grid Systems in Graphic Design" (1981). The split layout demonstrates the grid in action — title locked to the left zone, body text to the right, blockquote at the bottom. Every element aligns to column boundaries.
```

---

## Why 60 Columns

### MATHEMATICS

| Division | Columns | Zones | Character |
|:--------:|:-------:|:-----:|-----------|
| ÷2 | 30 | 2 | Binary split — thesis / antithesis |
| ÷3 | 20 | 3 | Triptych — narrative sequence |
| ÷4 | 15 | 4 | Quadrant — dashboard density |
| ÷5 | 12 | 5 | Pentad — the primary rhythm |
| ÷6 | 10 | 6 | Hexad — dense information |
| ÷10 | 6 | 10 | Decad — fine granularity |
| ÷12 | 5 | 12 | Dodecad — structural backbone |
| ÷15 | 4 | 15 | Ultra-fine control |
| ÷20 | 3 | 20 | Micro-placement |
| ÷30 | 2 | 30 | Sub-pixel precision |

```notes
60 is a "highly composite number" — it has more divisors than any smaller positive integer. This table shows every clean division. The ÷5 (12-column zones) and ÷12 (5-column zones) are the two primary rhythms in rastersysteme. Ancient Babylonians used base-60 for the same reason — maximum divisibility.
```

---

## Grid Anatomy

### KONSTRUKTION

```javascript
// The grid is defined by six parameters
const grid = createGrid(
  10,      // slideWidth  — 10 inches (16:9)
  5.625,   // slideHeight — 5.625 inches
  60,      // cols        — 60 vertical divisions
  40,      // rows        — 40 horizontal divisions
  0.5,     // margin      — 0.5" on all sides
  0.02     // gutter      — 0.02" micro-gutter
);

// Inner width: 10 - (2 × 0.5) = 9 inches
// Column width: (9 - 59 × 0.02) / 60 ≈ 0.130"
// Row height:   (4.625 - 39 × 0.02) / 40 ≈ 0.096"

// Placement is always column-based:
grid.cx(0)   // → 0.500" (left margin)
grid.cx(12)  // → 2.300" (first ÷5 division)
grid.cx(30)  // → 5.000" (exact centre)
grid.cx(48)  // → 7.700" (last ÷5 division)
grid.cx(60)  // → 9.500" (right margin)
```

```notes
"Konstruktion" = construction. This code block reveals the exact mathematics of the grid. The micro-gutter of 0.02" (about half a point) creates the barest separation between columns without visible gaps. Note that column 30 lands at exactly 5.0" — the mathematical center of the slide. The 40-row vertical grid gives a 3:2 column-to-row ratio.
```

---

## Grid Hierarchy

### ORDNUNG

- Primary structure — ÷12 divisions
  - Every 12th column creates a strong vertical
  - Five equal zones across the slide
  - The backbone of all layouts
- Secondary rhythm — ÷5 divisions
  - Every 5th column creates a medium pulse
  - Twelve zones for finer control
  - Text columns, image placement
- Tertiary detail — individual columns
  - 60 positions for micro-adjustment
  - Indent, offset, fine kerning
  - Optical alignment corrections

```notes
"Ordnung" = order. The three-level hierarchy is fundamental to Swiss design — structure at every scale. The nested bullets demonstrate this hierarchy visually: top-level items get numbered accent dots (primary), sub-items get em-dash markers and are indented (secondary), creating information architecture through typography alone.
```

---

<!-- layout: section -->
<!-- bg: 0F2A4A -->

## II. Typografie

### LETTERFORMS AS ARCHITECTURE

```notes
Section II: Typography. The blue-dark background signals a new chapter. Swiss typography treats letters as architectural elements — each glyph is a structure, each line is a beam, each paragraph is a facade. The section layout centres the text as a declaration.
```

---

<!-- layout: stagger -->

## The Swiss Typefaces

- Akzidenz-Grotesk — the origin, 1898
- Neue Haas Grotesk — Miedinger, 1957
- Helvetica — renamed for the world, 1960
- Univers — Frutiger's numbered system, 1957
- Folio — Bauer's rational alternative, 1957

```notes
The stagger layout presents the five foundational Swiss typefaces as cascading colour bars — each one a historical layer. Akzidenz-Grotesk from Berthold was the grandfather; Helvetica (originally Neue Haas Grotesk) became universal; Univers introduced the revolutionary numbered weight/width system. All are neo-grotesque sans-serifs with even stroke width and minimal contrast.
```

---

## The Type Scale

### MASSSTAB

| Role | Size | Weight | Spacing | Grid Rows |
|------|:----:|--------|:-------:|:---------:|
| Display title | 40pt | Bold | −0.02em | 10 |
| Slide title | 28–34pt | Bold | −0.02em | 7–8 |
| Subtitle | 18–24pt | Bold | 0 | 5–6 |
| Body text | 13–17pt | Regular | 0 | 4 |
| Bullet text | 12–14pt | Regular | 0 | 3–4 |
| Caption | 9–11pt | Regular | +0.01em | 2 |
| Section label | 8pt | Bold | +0.25em | 2 |
| Slide number | 8pt | Regular | 0 | 1 |

```notes
"Massstab" = scale/measure. This table maps every typographic role to its grid allocation. Note the inverse relationship between size and letterspacing: large type needs tighter tracking (optical correction), while small caps labels need wide spacing for legibility at small sizes. Each role occupies a specific number of grid rows — type and grid are inseparable.
```

---

## Flush Left, Ragged Right

### FLATTERSATZ

The only acceptable alignment in Swiss typography.

Justified text creates uneven word spacing — "rivers" of white that destroy the texture of the paragraph. Centred text has no strong vertical edge for the eye to return to.

Flush left, ragged right produces even word spacing and a consistent left edge. The ragged right margin creates organic rhythm — a visual breathing.

> Asymmetry is the rhythmic expression of functional design. In terms of design it contains the tension we see in the contrast between unequal parts — balance created not through equal distribution but through dynamic equilibrium.

```notes
"Flattersatz" = flush left/ragged right (literally "flutter setting"). This is perhaps the most sacred rule of Swiss typography. Jan Tschichold codified it in "Die neue Typographie" (1928). The split layout mirrors the principle: the left column is the strong vertical anchor, the right column flows freely.
```

---

## Spacing Systems

### DURCHSCHUSS

- Line spacing (leading)
  - Body: 1.3–1.5× font size
  - Display: 0.95–1.05× (tighter for impact)
  - Code: 1.2× (scanning density)
- Paragraph spacing
  - Half-line space between paragraphs
  - Never indent first lines — use space instead
- Letterspacing (tracking)
  - Negative for display type above 24pt
  - Neutral for body text
  - Positive for small caps and labels
  - Maximum +0.25em for section headers

```notes
"Durchschuss" = leading (literally "shot through" — from the lead strips inserted between lines of metal type). Swiss designers were obsessive about spacing ratios. The nested bullets demonstrate three hierarchical levels of spacing information, each progressively more detailed — mirroring the spacing hierarchy itself.
```

---

<!-- layout: section -->
<!-- bg: 8B1A10 -->

## III. Farbe

### COLOUR AS INFORMATION

```notes
Section III: Colour. The deep red background is itself a statement — colour in Swiss design is never decorative, always functional. Red signals urgency, importance, or section breaks. Müller-Brockmann's Musica Viva posters used red as the primary accent against black and white.
```

---

## The Four-Colour System

### FARBSYSTEM

- Red — E63222
  - Primary accent, calls to action
  - Section dividers, emphasis
  - Danger, urgency, passion
- Blue — 1B4FA0
  - Secondary accent, information
  - Links, references, navigation
  - Stability, trust, depth
- Green — 2A7A4B
  - Tertiary accent, confirmation
  - Success states, natural themes
  - Growth, balance, harmony
- Gold — F2C12E
  - Quaternary accent, highlights
  - Warnings, premium markers
  - Energy, optimism, attention

```notes
Swiss design typically restricts the palette to three or four colours plus black and white. Each colour carries semantic weight — it's not just aesthetic, it's informational. The four-colour system in rastersysteme cycles through these accents in bullets, stagger bars, and fragment cells. The restriction forces clarity.
```

---

<!-- layout: overlap -->

## Transparency & Layering

- Solid fields at 15–40%
- Colour mixing through overlap
- Depth without drop shadows

- Background tints at 90–95%
- Text fields with subtle fill
- Information density via layers

```notes
The overlap layout demonstrates colour interaction directly. Two translucent fields (accent and accent2) intersect, and where they overlap, a third colour emerges. This is a technique from concrete art — Max Bill, Richard Paul Lohse — where colour relationships are systematic, not intuitive. The transparency percentages are grid-aligned values.
```

---

<!-- layout: fragment -->

## Colour in Context

- F8F5F0 — warm white
- FFFFFF — pure white
- 1A1A1A — near black
- D4CEC4 — warm grey
- 5C5549 — mid text
- 8C8478 — light text
- E63222 — red accent
- 1B4FA0 — blue accent
- 2A7A4B — green accent

```notes
The fragment layout presents the full colour palette as a grid of swatches. Each cell is one of the nine core colours in the light theme. The grid arrangement lets you see relationships between colours at a glance — warms on the left, neutrals in the middle, accents on the right. This is Gerstner's "programme" applied to colour.
```

---

<!-- layout: section -->
<!-- bg: 1A1A1A -->

## IV. Komposition

### PLACING ELEMENTS IN SPACE

```notes
Section IV: Composition. Back to black — the most Swiss of backgrounds. "Komposition" covers the rules for placing elements on the grid: asymmetry, white space, visual weight, and the tension between order and energy.
```

---

## Asymmetry

### DAS PRINZIP

The Swiss rejected centred composition as static, hierarchical, and conventional.

Asymmetric layout creates dynamic equilibrium — balance through unequal distribution of visual weight.

> The asymmetric layout is the rhythmic expression of functional design. Tension arises from contrast between unequal parts.

- Place the heaviest element off-centre
  - Typically at the first ÷5 or ÷12 column
  - Never exactly centred, never touching the margin
- Let white space do equal work
  - Empty grid cells are design elements
  - Silence is part of the composition

```notes
"Das Prinzip" = the principle. This is the most fundamental rule of Swiss layout. The split layout itself demonstrates asymmetry — the left zone is 22 columns (37%), the right zone is 33 columns (55%), with 5 columns of gutter between. This 2:3 ratio is close to the golden section.
```

---

## White Space

### WEISSRAUM

Nothing is louder than silence.

The grid exists not only where elements are placed, but equally where they are not. Empty modules are not waste — they are breathing room, pacing, emphasis through absence.

Müller-Brockmann's posters often leave 40–60% of the grid empty. The courage to leave space is the mark of confident design.

> White space is to be regarded as an active element, not a passive background.

```notes
"Weissraum" = white space. Jan Tschichold wrote extensively about the active role of empty space. In rastersysteme, each layout deliberately leaves large areas of the grid unused — the split layout uses only ~55% of columns, the rotated layout dedicates 15% to a single vertical bar. This slide, in the split layout, demonstrates the principle by keeping the right column sparse.
```

---

<!-- layout: stagger -->

## Visual Weight

- Display type at 40pt commands the eye first
- Colour fields create zones of density
- Numbered dots add punctuation and rhythm
- Body text forms the ground texture
- Micro-type (labels, numbers) recedes to structure

```notes
Visual weight determines reading order. The stagger layout makes weight literal — each bar's size and colour intensity corresponds to the visual weight of the element it describes. Display type (heaviest bar, brightest colour) cascades down to micro-type (thinnest bar, most transparent). The diagonal energy of the cascade itself embodies the concept.
```

---

## Ten Layout Modes

| Layout | Cols Used | Grid Character | Inspiration |
|--------|:---------:|----------------|-------------|
| title | 24 + 22 | Binary split | Book covers |
| section | 52 | Full-width centre | Chapter pages |
| bullets | 55 | Left-anchored list | Neue Grafik |
| stagger | 42–60 | Diagonal cascade | Musica Viva |
| split | 22 + 33 | Asymmetric pair | Editorial |
| rotated | 13 + 40 | Vertical + horizontal | Weingart |
| fragment | 3 × 18 | Modular cells | Lohse |
| overlap | 32 + 32 | Intersecting fields | Concrete art |
| arc | 25 + 35 | Geometric + text | Constructivism |
| code | 58 | Full-width dark | Terminal |

```notes
This table maps each layout to its grid usage and art-historical reference. Note the column counts — every layout uses grid-aligned widths. The title layout's 24 + 22 = 46 columns, leaving 14 unused (breathing room). The split's 22 + 33 = 55, with 5-column gutter. These are not arbitrary — they're divisions of 60.
```

---

<!-- layout: section -->
<!-- bg: 2A7A4B -->

## V. Musica Viva

### THE POSTER AS PROGRAMME

```notes
Section V: Musica Viva. Green background for a new chapter. Müller-Brockmann's concert poster series for the Zurich Tonhalle (1950–1972) is the single most important body of work in Swiss graphic design. Each poster was a "programme" — a systematic composition generated from the musical content.
```

---

<!-- layout: stagger -->

## Zurich Tonhalle 1958

- Vertical colour fields in musical intervals
- Each bar tuned to the frequency of the programme
- Warm tones for strings, cool for winds
- Width as duration, height as dynamic
- The poster does not illustrate — it is

```notes
The stagger layout is rastersysteme's direct homage to the Musica Viva posters. The cascading bars don't represent data — they ARE visual music. Each bar's width, position, and colour is generated from the grid system, just as Müller-Brockmann generated poster compositions from musical structure. The diagonal progression creates rhythm; the colour cycle creates harmony.
```

---

<!-- layout: arc -->

## Proportion & Geometry

From Euclid to Euler to Müller-Brockmann — the same mathematical impulse.

The circle inscribed in the rectangle. The golden ratio as compositional anchor. Concentric forms creating visual gravity.

A dot is a circle is a world.

```notes
The arc layout places concentric circles in the right zone — a direct reference to Müller-Brockmann's "Beethovens" poster (1955), which used overlapping arcs to represent musical dynamics. The concentric circles also reference the Bauhaus preliminary course: Itten, Albers, and Moholy-Nagy all used the circle-in-square as a fundamental compositional exercise.
```

---

<!-- layout: section -->
<!-- bg: 0F2A4A -->

## VI. Neue Welle

### FROM ORDER TO EXPRESSIVE TENSION

```notes
Section VI: New Wave. Deep blue for the final chapter. "Neue Welle" marks the transition from Swiss rationalism to the expressive typography of Weingart, Greiman, and their students. The grid remains — but it bends.
```

---

## Weingart at Basel

### 1968–2005

> I took Swiss typography as my starting point, but tried to find out what else was possible with the same elements.

- Layered type at conflicting angles
- Extreme letterspacing stretched to texture
- Ruled lines as autonomous elements
- Stepped type creating visual staircases
- The grid acknowledged, then violated

```notes
Wolfgang Weingart arrived at the Basel School of Design as an instructor in 1968, aged 26. He taught typography for nearly four decades. His approach was not anti-grid — it was meta-grid. He used the system's own logic to generate visual complexity that the system's creators never intended. The rotated layout captures a fraction of this energy with its vertical title bar.
```

---

## The Programme Generalized

### GERSTNER → CODE

```javascript
// Gerstner's morphological box — every design
// is one path through a multi-dimensional matrix

const programme = {
  grid:       [60, 30, 20, 15, 12, 10, 6, 5, 4, 3, 2],
  typeface:   ['Helvetica Neue', 'Akzidenz', 'Univers'],
  weight:     ['light', 'regular', 'medium', 'bold'],
  size:       [8, 9, 10, 11, 12, 13, 14, 17, 18, 24, 28, 30, 34, 40],
  leading:    [0.95, 1.0, 1.05, 1.2, 1.25, 1.3, 1.4, 1.5],
  tracking:   [-0.02, 0, 0.01, 0.1, 0.15, 0.2, 0.25],
  colour:     ['E63222', '1B4FA0', '2A7A4B', 'F2C12E',
               '1A1A1A', 'F8F5F0', 'FFFFFF'],
  opacity:    [0.10, 0.15, 0.20, 0.25, 0.35, 0.40, 0.85, 0.88, 0.90, 0.92, 0.93, 0.94, 0.95],
  layout:     ['title', 'section', 'bullets', 'stagger',
               'split', 'rotated', 'fragment', 'overlap',
               'arc', 'image', 'table', 'code', 'blank'],
};

// Total unique combinations:
// 11 × 3 × 4 × 14 × 8 × 7 × 7 × 13 × 13
// = 5,765,683,968 possible slides
```

```notes
Karl Gerstner's "Designing Programmes" (1964) proposed that design is not a series of artistic decisions but a systematic exploration of a possibility space. This code block makes the concept executable. The morphological box here has 9 axes, each with a set of valid values. Every slide in rastersysteme is one path through this matrix — and there are 5.7 billion unique combinations. This is the grid as generative programme.
```

---

<!-- layout: overlap -->

## Concrete + Expressive

- Systematic rigour
- Mathematical precision
- Modular repetition
- Objective photography
- Universal communication

- Intuitive disruption
- Optical texture
- Controlled accident
- Subjective collage
- Personal expression

```notes
The overlap layout is the visual thesis of this presentation. Two colour fields intersect — red (Swiss rationalism) and blue (New Wave expression). The bullets in each field represent the values of each tradition. Where the fields overlap, something new emerges: a design practice that is both systematic AND expressive. Neither tradition makes sense without the other.
```

---

<!-- layout: stagger -->

## After Switzerland

- April Greiman — digital collage, 1980s
- Neville Brody — The Face, postmodern type
- David Carson — anti-grid as grid, Ray Gun
- Emigre — Rudy VanderLans + Zuzana Licko
- Experimental Jetset — Swiss revival, Amsterdam
- Norm — systematics as aesthetic, Zurich

```notes
The legacy of Swiss/New Wave design extends through every major movement in graphic design since. Greiman brought Weingart's approach to America and into digital media. Brody and Carson pushed deconstruction further. Emigre created the typefaces of the digital revolution. Experimental Jetset and Norm represent a contemporary return to systematic design — Swiss principles applied with New Wave awareness.
```

---

<!-- font: Georgia -->

## Coda

### NACHSPIEL

Typography is not about choosing pretty letters. It is about giving language a spatial body — weight, rhythm, breath, and silence.

The grid is not a prison. It is a musical instrument.

> The typographer must take the greatest care to study and observe the rules of legibility and order. But within this framework, he can and must explore all possibilities of expression.

```notes
"Nachspiel" = postscript/aftermath. Georgia (a serif face) is used here deliberately — an act of typographic transgression that Weingart would approve. The quote synthesizes the Swiss and New Wave positions: rules AND expression, order AND exploration. The grid enables freedom precisely because it provides structure.
```

---

<!-- layout: section -->

Raster. System. Programme.

```notes
Final slide. Three German-inflected words that summarise the intellectual heritage: Raster (Müller-Brockmann's grid), System (the International Style's aspiration to universal order), Programme (Gerstner's generative design). Displayed in the section layout — dark background, centred, with the red accent bar below. The presentation ends where it began: with the grid.
```
