# Design Theory: Text-Image Interaction

## The Problem with "Overlap = Bad"

Our rubric flags 63 text-image "collisions" on week-2-v11. But in design practice, text over images is one of the most powerful compositional techniques. The rubric is measuring the wrong thing.

## When Text-Over-Image Works (Pro-Design)

### 1. Atmospheric Backgrounds
Low-opacity images behind text create mood without competing for attention. The image is texture, not content. Classic in editorial design, Swiss poster tradition, and contemporary web design.

**Conditions**: opacity < 0.3, image has low local contrast in the text region, text is the primary figure.

### 2. Hero Compositions
Large text overlaid on a full-bleed image. The image IS the visual statement; the text anchors it. Works when: the image has a "quiet zone" (sky, gradient, solid area) where the text sits, or a color overlay ensures contrast.

**Conditions**: intentional placement (design directive), sufficient contrast (WCAG AA on the image region), clear visual hierarchy.

### 3. Inset Figures
Small images in corners or margins that partially overlap text zones. The overlap is minor and the image reads as a secondary element. Common in academic and technical presentations.

**Conditions**: image area < 25% of slide, overlap < 30% of image area, image has clear border/frame.

### 4. Layered Compositions
Deliberate depth: text at z-index above an image layer, creating figure-ground tension. The overlap is the point — it creates visual energy. Requires strong typographic contrast.

**Conditions**: explicit z-ordering, text has shadow/outline/contrast enhancement, the composition is clearly layered not accidentally stacked.

## When Text-Over-Image Fails (Anti-Design)

### 1. Accidental Overlap
Content routing error: text that was supposed to be in a separate zone ends up on top of an image. Neither element was designed for the relationship. The reader can't parse either one.

**Signals**: the design directive places text and image in separate zones, but the renderer puts them together. The overlap has no contrast treatment.

### 2. Busy Image Under Dense Text
A detailed, high-contrast image (photo with many edges) behind dense paragraph text. Both compete for the same visual channel. The reader's eye can't resolve figure from ground.

**Signals**: text length > 200 chars over the image area, image has high local variance (many edges/details), no opacity reduction.

### 3. No Contrast Treatment
Text and image have similar luminance. White text on a light image area, or dark text on a dark image area. The text becomes illegible.

**Signals**: contrast ratio < 3:1 between text color and average image luminance in the overlap region.

### 4. Semantic Conflict
The image depicts something unrelated to the text, and the overlap makes them read as one unit. A photo of machinery behind a slide about education creates cognitive dissonance when overlapped.

**Signals**: harder to detect automatically. Could check if the image was spliced (decorative, may conflict) vs content (related to the text by design).

## Rubric Implications

### Current Approach (Wrong)
Every text-image overlap is a warning. Score = 10 - N*penalty. This penalizes atmospheric backgrounds the same as accidental collisions.

### Proposed Approach
Classify each overlap into categories:

| Category | Detection | Score Impact |
|---|---|---|
| **Atmospheric splice** (opacity < 0.3) | Check splice-img class + parent opacity | No penalty (decorative intent) |
| **Framed inset** (< 25% of slide, has border) | Check size + box-shadow/border style | No penalty (minor, framed) |
| **High-contrast collision** (text illegible over image) | Estimate contrast: text color vs image brightness | **Penalty: -1.5 per slide** |
| **Dense text over busy image** (>200 chars, high-detail image) | Text length in overlap zone + image present at >0.3 opacity | **Penalty: -1.0 per slide** |
| **Accidental overlap** (separate zones rendered overlapping) | Zones in directive are non-overlapping, but rendered zones collide | **Penalty: -2.0 per slide** (layout failure) |
| **Intentional hero** (design directive places both) | Single zone contains both text and image | No penalty (check contrast only) |

### Key Metrics to Add

1. **Splice opacity at overlap point**: If the image is splice-img with opacity < 0.3, it's atmospheric — not a collision.
2. **Text density in overlap region**: Short text (< 50 chars) over an image is a caption or label — tolerable. Dense text (> 200 chars) is a readability problem.
3. **Image provenance**: splice-img (decorative, generated) vs content img (source material, related to text). Splice overlaps are less severe because the image is supplementary.
4. **Effective contrast**: For Puppeteer path, sample pixels in the overlap region and compute contrast ratio. For jsdom, estimate from inline opacity + background color.

## Design Theory References

- **Müller-Brockmann**, *Grid Systems in Graphic Design* (1981): Zones should maintain clear figure-ground relationships. Grid discipline means each element has a defined position — overlap should be a composition choice, not a layout accident.

- **Tschichold**, *The New Typography* (1928): Asymmetric composition with clear hierarchy. Every element should have a purpose — decorative overlap serves atmosphere, accidental overlap serves nothing.

- **Tufte**, *The Visual Display of Quantitative Information* (1983): Data-ink ratio. Every pixel should carry information. An image that obscures text has negative data-ink ratio — it takes away more than it adds.

- **Lupton**, *Thinking with Type* (2004): Layers and transparency as expressive tools. Text over images works when the layering is intentional and the contrast is managed. "Layering is a strategy for creating complex visual effects."

- **Gestalt figure-ground**: The viewer needs to resolve what's figure (text) and what's ground (image). When both compete at similar visual weight, neither reads clearly. Low-opacity images recede to ground; high-opacity images demand figure status.

## Implementation Priority

1. **Exempt splice-img at opacity < 0.3 from text-image warnings** — this is the single change that would eliminate most of our 63 false warnings. These are atmospheric backgrounds by design.

2. **Add text density check**: only warn when > 200 chars of text overlaps a visible (> 0.3 opacity) image.

3. **Distinguish content images from splice images in all overlap checks.** Content-image overlaps are layout failures. Splice-image overlaps are design choices (possibly bad ones, but not accidental).
