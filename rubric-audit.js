/**
 * rubric-audit.js — in-browser rubric evaluation script
 *
 * Designed to run via mcp__claude-in-chrome__javascript_tool.
 * Returns a structured JSON scorecard with computed metrics for
 * each rubric dimension. Visual dimensions (taste, communicability,
 * balance) return raw data for Claude to assess from screenshots.
 *
 * Usage in a skill:
 *   const result = await javascript_tool({ text: fs.readFileSync('rubric-audit.js','utf-8') });
 *   const scorecard = JSON.parse(result);
 */

(function rubricAudit() {
  const slides = document.querySelectorAll('.slide, .grid-slide');
  const total = slides.length;
  if (!total) return JSON.stringify({ error: 'No slides found' });

  // ── Utilities ──
  function parseRGB(str) {
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
  }
  function lum(c) {
    const [r, g, b] = [c.r, c.g, c.b].map(v => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function cr(fg, bg) {
    const l1 = lum(fg), l2 = lum(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function hexFromRGB(c) {
    return '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function colorDistance(a, b) {
    return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
  }

  // ── Per-slide data collection ──
  const slideData = [];

  slides.forEach((slide, idx) => {
    const wasDisplay = slide.style.display;
    slide.style.display = 'flex';
    const cs = getComputedStyle(slide);
    const bg = parseRGB(cs.backgroundColor) || { r: 248, g: 243, b: 230 };

    const data = {
      slide: idx + 1,
      bg: hexFromRGB(bg),
      bgLum: lum(bg),
      isDesigned: slide.classList.contains('designed'),
      // A11Y
      contrastErrors: 0,
      contrastWarnings: 0,
      minContrast: 21,
      overflowCount: 0,
      brokenImages: 0,
      // Grid
      zones: [],
      // Typography
      titleSize: null,
      bodySizes: [],
      labelSize: null,
      fonts: new Set(),
      // Layout
      hasAccents: false,
      accentTypes: [],
      // Images
      imageCount: 0,
      imageOverlaps: 0,
      imagePlacements: [],
    };

    // ── A11Y: Contrast ──
    slide.querySelectorAll('h1,h2,h3,p,li,span,blockquote,.label,.bullet,td,th,code').forEach(el => {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return;
      const text = el.textContent.trim();
      if (!text) return;
      const fg = parseRGB(st.color);
      let elBg = parseRGB(st.backgroundColor);
      if (!elBg || (elBg.r === 0 && elBg.g === 0 && elBg.b === 0 && st.backgroundColor.includes('0)'))) elBg = bg;
      if (fg && elBg) {
        const ratio = cr(fg, elBg);
        const size = parseFloat(st.fontSize);
        const bold = parseInt(st.fontWeight) >= 700;
        const large = size >= 18 || (size >= 14 && bold);
        const min = large ? 3.0 : 4.5;
        if (ratio < min) {
          if (ratio < 2) data.contrastErrors++;
          else data.contrastWarnings++;
        }
        data.minContrast = Math.min(data.minContrast, ratio);
      }
    });

    // ── A11Y: Overflow ──
    slide.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (st.display === 'none' || r.width === 0) return;
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'link', 'meta'].includes(tag)) return;
      if (r.right > window.innerWidth + 10 || r.bottom > window.innerHeight + 10) data.overflowCount++;
    });

    // ── A11Y: Broken images ──
    slide.querySelectorAll('img').forEach(img => {
      if (!img.complete || img.naturalWidth === 0) data.brokenImages++;
    });

    // ── Grid: Zone positions ──
    slide.querySelectorAll('.zone').forEach(zone => {
      const st = zone.style;
      data.zones.push({
        role: (zone.className.match(/zone-(\w+)/) || [])[1] || 'unknown',
        left: parseFloat(st.left) || 0,
        top: parseFloat(st.top) || 0,
        width: parseFloat(st.width) || 0,
        height: parseFloat(st.height) || 0,
      });
    });

    // ── Typography ──
    slide.querySelectorAll('h1,h2').forEach(el => {
      const st = getComputedStyle(el);
      if (st.display !== 'none') data.titleSize = parseFloat(st.fontSize);
    });
    slide.querySelectorAll('p,.bullet span:not(.dot)').forEach(el => {
      const st = getComputedStyle(el);
      if (st.display !== 'none' && el.textContent.trim().length > 3) {
        data.bodySizes.push(parseFloat(st.fontSize));
      }
    });
    slide.querySelectorAll('.label,h3').forEach(el => {
      const st = getComputedStyle(el);
      if (st.display !== 'none') data.labelSize = parseFloat(st.fontSize);
    });
    slide.querySelectorAll('h1,h2,p,.bullet,.label').forEach(el => {
      const family = getComputedStyle(el).fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      if (family) data.fonts.add(family);
    });

    // ── Accents ──
    slide.querySelectorAll('.accent,[class*=accent]').forEach(el => {
      data.hasAccents = true;
      const cls = el.className;
      if (cls.includes('line')) data.accentTypes.push('line');
      else if (cls.includes('bar')) data.accentTypes.push('bar');
      else if (cls.includes('dot')) data.accentTypes.push('dot');
      else if (cls.includes('block')) data.accentTypes.push('block');
    });

    // ── Images ──
    const imgs = slide.querySelectorAll('img');
    data.imageCount = imgs.length;
    imgs.forEach(img => {
      const ir = img.getBoundingClientRect();
      if (ir.width === 0) return;
      // Detect placement
      const cx = ir.left + ir.width / 2;
      const cy = ir.top + ir.height / 2;
      const placement = cx > window.innerWidth * 0.65 ? 'right'
        : cx < window.innerWidth * 0.35 ? 'left'
        : cy < window.innerHeight * 0.35 ? 'top'
        : cy > window.innerHeight * 0.65 ? 'bottom'
        : 'centre';
      data.imagePlacements.push(placement);

      // Check text overlap
      slide.querySelectorAll('h1,h2,p,.bullet').forEach(el => {
        const tr = el.getBoundingClientRect();
        if (tr.width === 0 || tr.height === 0) return;
        if (tr.left < ir.right && tr.right > ir.left && tr.top < ir.bottom && tr.bottom > ir.top) {
          const imgDiv = img.closest('div[style]');
          const opacity = imgDiv ? parseFloat(imgDiv.style.opacity || '1') : 1;
          if (opacity > 0.15) data.imageOverlaps++;
        }
      });
    });

    data.fonts = [...data.fonts];
    if (!slide.classList.contains('active')) slide.style.display = wasDisplay || 'none';
    slideData.push(data);
  });

  // ── Aggregate Scores ──

  // 1. Accessibility
  const totalErrors = slideData.reduce((n, s) => n + s.contrastErrors, 0);
  const totalWarnings = slideData.reduce((n, s) => n + s.contrastWarnings, 0);
  const totalOverflows = slideData.reduce((n, s) => n + s.overflowCount, 0);
  const totalBroken = slideData.reduce((n, s) => n + s.brokenImages, 0);
  const a11yScore = Math.max(1, Math.min(10,
    10 - totalErrors * 2 - totalWarnings * 0.3 - Math.min(totalOverflows * 0.1, 2) - totalBroken * 2
  ));

  // 4. Grid Utilization
  const designedCount = slideData.filter(s => s.isDesigned).length;
  const zoneColStarts = slideData.flatMap(s => s.zones.map(z => Math.round(z.left)));
  const uniqueColStarts = new Set(zoneColStarts);
  const zoneWidths = slideData.flatMap(s => s.zones.map(z => Math.round(z.width)));
  const uniqueWidths = new Set(zoneWidths);
  const gridScore = Math.max(1, Math.min(10,
    (designedCount / total) * 4 +                    // % using design directives
    Math.min(uniqueColStarts.size / 4, 1.5) * 2 +    // variety of starting positions
    Math.min(uniqueWidths.size / 3, 1.5) * 2 +       // variety of zone widths
    (designedCount > 0 ? 2 : 0)                       // bonus for any grid use
  ));

  // 5. Color Harmonics
  const bgs = slideData.map(s => parseRGB(s.bg.replace('#', 'rgb(').replace(/(..)(..)(..)/, (_, r, g, b) =>
    parseInt(r, 16) + ',' + parseInt(g, 16) + ',' + parseInt(b, 16))) || parseRGB('rgb(248,243,230)'));
  // Actually parse from hex
  const bgColors = slideData.map(s => {
    const h = s.bg.replace('#', '');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  });
  const uniqueBgs = new Set(slideData.map(s => s.bg));
  const bgTransitions = [];
  for (let i = 1; i < bgColors.length; i++) {
    bgTransitions.push(colorDistance(bgColors[i - 1], bgColors[i]));
  }
  const avgTransition = bgTransitions.length ? bgTransitions.reduce((a, b) => a + b, 0) / bgTransitions.length : 0;
  const hasArc = bgTransitions.some(t => t > 200); // at least one major shift
  const colorScore = Math.max(1, Math.min(10,
    Math.min(uniqueBgs.size / 3, 2) * 2 +       // palette variety
    (hasArc ? 3 : 1) +                           // chromatic arc exists
    (avgTransition > 50 && avgTransition < 250 ? 3 : 1) + // transitions aren't jarring
    (totalErrors === 0 ? 2 : 0)                  // no contrast failures
  ));

  // 7. Coherence & Variance
  const layouts = slideData.map(s => s.isDesigned ? 'designed' : 'standard');
  const titleSizes = slideData.map(s => s.titleSize).filter(Boolean);
  const titleSizeSet = new Set(titleSizes.map(s => Math.round(s)));
  const fontSets = slideData.map(s => s.fonts.sort().join(','));
  const uniqueFontSets = new Set(fontSets);
  // Check for 3× consecutive same bg
  let maxConsecutive = 1, currentRun = 1;
  for (let i = 1; i < slideData.length; i++) {
    if (slideData[i].bg === slideData[i - 1].bg) { currentRun++; maxConsecutive = Math.max(maxConsecutive, currentRun); }
    else currentRun = 1;
  }
  const coherenceScore = Math.max(1, Math.min(10,
    (titleSizeSet.size >= 2 && titleSizeSet.size <= 6 ? 3 : 1) +  // title size variety but not chaos
    (uniqueFontSets.size >= 2 ? 2 : 1) +                           // font alternation
    (uniqueBgs.size >= 3 ? 2 : 1) +                                 // bg variety
    (maxConsecutive <= 3 ? 2 : 0) +                                  // no long repeats
    (designedCount > total * 0.5 ? 1 : 0)                           // majority designed
  ));

  // 8. Image Integration
  const totalImages = slideData.reduce((n, s) => n + s.imageCount, 0);
  const totalOverlaps = slideData.reduce((n, s) => n + s.imageOverlaps, 0);
  const placements = slideData.flatMap(s => s.imagePlacements);
  const uniquePlacements = new Set(placements);
  const imageScore = totalImages === 0 ? 5 : Math.max(1, Math.min(10,
    (totalOverlaps === 0 ? 4 : Math.max(1, 4 - totalOverlaps)) +    // no collisions
    Math.min(uniquePlacements.size / 3, 1) * 3 +                     // placement variety
    (totalImages > total * 0.3 ? 2 : 1) +                            // image coverage
    1                                                                  // baseline
  ));

  // ── Compile scorecard ──
  const computed = {
    accessibility: { score: Math.round(a11yScore * 10) / 10, errors: totalErrors, warnings: totalWarnings, overflows: totalOverflows, brokenImages: totalBroken },
    gridUtilization: { score: Math.round(gridScore * 10) / 10, designedSlides: designedCount, uniqueStarts: uniqueColStarts.size, uniqueWidths: uniqueWidths.size },
    colorHarmonics: { score: Math.round(colorScore * 10) / 10, uniqueBgs: uniqueBgs.size, hasArc, avgTransition: Math.round(avgTransition), palette: [...uniqueBgs] },
    coherenceVariance: { score: Math.round(coherenceScore * 10) / 10, titleSizes: [...titleSizeSet], fontSets: uniqueFontSets.size, maxConsecutiveSameBg: maxConsecutive },
    imageIntegration: { score: Math.round(imageScore * 10) / 10, totalImages, overlaps: totalOverlaps, placements: [...uniquePlacements] },
  };

  // Dimensions needing Claude visual assessment (return raw data)
  const forVisualReview = {
    communicability: 'Assess from screenshots: Does the design serve the content hierarchy? Can you find the point of each slide quickly?',
    taste: 'Assess from screenshots: Does this exhibit Swiss/modernist quality? Restraint? Typography as design element? Or generic/corporate?',
    layoutBalance: 'Assess from screenshots: Does each slide feel visually balanced? Is whitespace intentional? Is there dynamic tension or static centering?',
  };

  const computedTotal = computed.accessibility.score + computed.gridUtilization.score +
    computed.colorHarmonics.score + computed.coherenceVariance.score + computed.imageIntegration.score;

  return JSON.stringify({
    total: total,
    computedScore: Math.round(computedTotal * 10) / 10,
    computedMax: 50,
    visualDimensionsNeeded: 3,
    visualMax: 30,
    computed,
    forVisualReview,
    slideData: slideData.map(s => ({
      slide: s.slide, bg: s.bg, isDesigned: s.isDesigned,
      contrastErrors: s.contrastErrors, contrastWarnings: s.contrastWarnings,
      overflowCount: s.overflowCount, imageCount: s.imageCount, imageOverlaps: s.imageOverlaps,
      titleSize: s.titleSize, fonts: s.fonts, hasAccents: s.hasAccents,
      zones: s.zones.length, imagePlacements: s.imagePlacements
    }))
  }, null, 2);
})()
