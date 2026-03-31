#!/usr/bin/env node
/**
 * eval-educational.js — Educational artefact evaluation harness
 *
 * Assesses interactive educational pages against 8 dimensions drawn from
 * educational theory: Bloom's taxonomy, constructivist scaffolding,
 * multimedia learning principles, engagement design, and accessibility.
 *
 * Uses Puppeteer for DOM inspection + interaction testing, and optionally
 * the Claude API for qualitative assessment of explanatory text quality.
 *
 * Usage:
 *   node pages/eval-educational.js pages/language-models.html
 *   node pages/eval-educational.js pages/language-models.html --json
 *   node pages/eval-educational.js pages/language-models.html --with-claude
 *   node pages/eval-educational.js pages/language-models.html --port 8701
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

// ═══════════════════════════════════════════════════════════
// EDUCATIONAL RUBRIC: 8 DIMENSIONS
// ═══════════════════════════════════════════════════════════
//
// Each dimension is scored 1-10 with specific indicators.
// Dimensions are drawn from established educational frameworks:
//
//  1. Bloom's Taxonomy Coverage (Anderson & Krathwohl, 2001)
//  2. Constructivist Scaffolding (Vygotsky ZPD, Bruner)
//  3. Interactive Engagement (Chi & Wylie ICAP, 2014)
//  4. Feedback & Assessment (Hattie & Timperley, 2007)
//  5. Multimedia Learning (Mayer, 2009)
//  6. Conceptual Progression (Ausubel advance organizers)
//  7. Accessibility & Inclusivity (WCAG 2.1 + UDL)
//  8. Explanatory Clarity (Keller ARCS motivation model)

const DIMENSIONS = {
  blooms: {
    label: "Bloom's Taxonomy Coverage",
    weight: 1.0,
    theory: "Anderson & Krathwohl (2001) revised taxonomy",
    description: "Does the artefact engage learners across cognitive levels, from remembering facts to creating/evaluating?",
    indicators: {
      remember:  "Presents key facts, dates, definitions, terminology",
      understand: "Explains concepts with analogies, paraphrases, examples",
      apply:      "Lets learners use knowledge in interactive exercises",
      analyze:    "Encourages learners to compare, contrast, or decompose concepts",
      evaluate:   "Asks learners to judge, critique, or assess outputs",
      create:     "Allows learners to generate, construct, or produce something novel",
    },
    scoring: [
      { min: 9, desc: "All 6 levels actively engaged with distinct interactions" },
      { min: 7, desc: "5 levels present; at least Apply and Evaluate active" },
      { min: 5, desc: "3-4 levels; mostly Remember/Understand with some Apply" },
      { min: 3, desc: "2 levels; predominantly passive content" },
      { min: 1, desc: "Single level; pure information delivery" },
    ],
  },

  scaffolding: {
    label: "Constructivist Scaffolding",
    weight: 1.0,
    theory: "Vygotsky (1978) ZPD, Bruner (1960) spiral curriculum",
    description: "Are concepts introduced incrementally with appropriate support, building on prior knowledge?",
    indicators: {
      sequencing:      "Concepts ordered from simple to complex with clear prerequisites",
      priorKnowledge:  "Each stage connects to and builds on the previous one",
      bridgeTexts:     "Transitions explain why the next concept follows",
      adjustableDifficulty: "Learner can control complexity (e.g. n-gram order)",
      unlockGating:    "Progressive disclosure prevents cognitive overload",
    },
    scoring: [
      { min: 9, desc: "Expert scaffolding with adaptive difficulty and explicit connections" },
      { min: 7, desc: "Clear cumulative progression with bridge texts and gating" },
      { min: 5, desc: "Sequential content with some scaffolding but gaps in connections" },
      { min: 3, desc: "Content is ordered but scaffolding is implicit" },
      { min: 1, desc: "No scaffolding; topics presented in arbitrary order" },
    ],
  },

  engagement: {
    label: "Interactive Engagement",
    weight: 1.0,
    theory: "Chi & Wylie (2014) ICAP framework",
    description: "Does the artefact move learners from passive to interactive/constructive modes?",
    indicators: {
      passive:       "Reading text, viewing static content",
      active:        "Clicking buttons, selecting options, toggling views",
      constructive:  "Building models, typing text, solving puzzles",
      interactive:   "Getting feedback on actions, seeing consequences of choices",
      manipulable:   "Direct manipulation of parameters that update visualizations",
    },
    scoring: [
      { min: 9, desc: "Rich constructive + interactive elements in every section" },
      { min: 7, desc: "Multiple interactive elements per stage with real-time feedback" },
      { min: 5, desc: "Some interactive elements but substantial passive content" },
      { min: 3, desc: "Mostly active (click-to-reveal) with little constructive activity" },
      { min: 1, desc: "Entirely passive; read-only content" },
    ],
  },

  feedback: {
    label: "Feedback & Assessment",
    weight: 1.0,
    theory: "Hattie & Timperley (2007) feedback model",
    description: "Does the artefact provide timely, specific feedback that helps learners understand their progress?",
    indicators: {
      immediacy:      "Feedback appears immediately after learner action",
      specificity:    "Feedback explains why an answer is right or wrong",
      progressTracking: "Cumulative score or progress indicator visible",
      scaffoldedHints: "Hints or explanations available before/after attempts",
      masteryThreshold: "Clear criteria for 'mastery' at each level",
    },
    scoring: [
      { min: 9, desc: "Immediate, specific feedback with scaffolded explanations and mastery criteria" },
      { min: 7, desc: "Immediate feedback with explanations; clear progress tracking" },
      { min: 5, desc: "Feedback present but generic or delayed" },
      { min: 3, desc: "Binary right/wrong feedback only" },
      { min: 1, desc: "No feedback mechanism" },
    ],
  },

  multimedia: {
    label: "Multimedia Learning Design",
    weight: 1.0,
    theory: "Mayer (2009) multimedia learning principles",
    description: "Does the artefact use multiple representations effectively without cognitive overload?",
    indicators: {
      dualCoding:     "Information presented in both verbal and visual channels",
      coherence:      "No extraneous decoration; visuals serve learning goals",
      signaling:      "Key information highlighted with visual cues (color, emphasis)",
      spatialContiguity: "Related text and visuals placed close together",
      segmenting:     "Complex information broken into manageable chunks",
      modality:       "Uses visual channel for graphics (canvas, SVG) not just text",
    },
    scoring: [
      { min: 9, desc: "Exemplary dual coding with canvas visualizations, no extraneous content" },
      { min: 7, desc: "Good use of visual + verbal channels; mostly coherent layout" },
      { min: 5, desc: "Some visualizations but text-heavy sections remain" },
      { min: 3, desc: "Minimal visual representation; predominantly text-based" },
      { min: 1, desc: "Pure text content with no visual aids" },
    ],
  },

  progression: {
    label: "Conceptual Progression",
    weight: 1.0,
    theory: "Ausubel (1968) advance organizers, Gagné (1985) events of instruction",
    description: "Does the artefact establish a clear narrative arc connecting historical developments to core concepts?",
    indicators: {
      historicalContext:  "Each concept situated in its historical moment",
      coreIntuition:      "Central insight explicitly stated before details",
      cumulativeBuilding: "Each stage explicitly connects to and extends the previous",
      conceptualContrast: "Limitations of each approach motivate the next",
      synthesisArc:       "Final stage provides synthesis of all prior concepts",
    },
    scoring: [
      { min: 9, desc: "Masterful narrative arc with explicit conceptual bridges and synthesis" },
      { min: 7, desc: "Clear progression with stated intuitions and historical context" },
      { min: 5, desc: "Sequential but connections between stages are implicit" },
      { min: 3, desc: "Topics presented in order but no narrative thread" },
      { min: 1, desc: "Disconnected topics with no progression logic" },
    ],
  },

  accessibility: {
    label: "Accessibility & Inclusivity",
    weight: 0.8,
    theory: "WCAG 2.1, Universal Design for Learning (CAST)",
    description: "Is the artefact usable by learners with diverse abilities, devices, and contexts?",
    indicators: {
      colorContrast:    "Text meets WCAG AA contrast ratios (4.5:1 normal, 3:1 large)",
      keyboardNav:      "All interactive elements reachable via keyboard",
      responsiveLayout: "Usable on mobile devices (<768px)",
      readableTypography: "Font sizes >= 12px, line height >= 1.5",
      semanticHTML:     "Proper heading hierarchy, ARIA labels where needed",
      noMotionDependency: "No essential information conveyed only through animation",
    },
    scoring: [
      { min: 9, desc: "Full WCAG AA compliance, keyboard navigable, responsive, semantic" },
      { min: 7, desc: "Good contrast, responsive layout, readable typography" },
      { min: 5, desc: "Some accessibility issues but core content accessible" },
      { min: 3, desc: "Significant barriers for some users" },
      { min: 1, desc: "Major accessibility failures" },
    ],
  },

  clarity: {
    label: "Explanatory Clarity",
    weight: 0.8,
    theory: "Keller (1987) ARCS model, Sweller (1988) cognitive load theory",
    description: "Are explanations clear, concise, and motivating without unnecessary jargon?",
    indicators: {
      attention:    "Opening hooks or epigraphs capture interest",
      relevance:    "Content connected to real-world applications or familiar analogies",
      confidence:   "Achievable challenges build learner self-efficacy",
      satisfaction: "Completion feels rewarding; progress is visible and celebrated",
      jargonManagement: "Technical terms introduced with definitions, not assumed",
      cognitiveLoad: "Information density appropriate; not overwhelming",
    },
    scoring: [
      { min: 9, desc: "Compelling explanations with apt analogies, managed jargon, appropriate density" },
      { min: 7, desc: "Clear explanations with some analogies and good pacing" },
      { min: 5, desc: "Adequate explanations but some jargon or density issues" },
      { min: 3, desc: "Explanations present but unclear or too dense" },
      { min: 1, desc: "No explanatory text; raw data or interface only" },
    ],
  },
};


// ═══════════════════════════════════════════════════════════
// EVALUATOR ENGINES
// ═══════════════════════════════════════════════════════════

/**
 * Engine 1: DOM/Structure Evaluator (Puppeteer)
 * Tests the page structure, interactivity, accessibility, and progression.
 */
async function evaluateDOM(page) {
  const results = {};

  // --- Bloom's: check for interactive element types ---
  const bloomsData = await page.evaluate(() => {
    const body = document.body.innerText || "";
    const buttons = document.querySelectorAll("button");
    const inputs = document.querySelectorAll("input, textarea");
    const canvases = document.querySelectorAll("canvas");
    const headings = document.querySelectorAll("h1, h2, h3");

    // Check for key Bloom's indicators in the content
    const hasDefinitions = /core intuition|key concept|definition/i.test(body);
    const hasAnalogies = /imagine|think of|like a|analogy|metaphor/i.test(body);
    const hasExercises = buttons.length > 5; // interactive exercises
    const hasComparison = /compare|contrast|vs\.|versus|difference/i.test(body);
    const hasEvaluation = /pick the better|which is|judge|evaluate|reward model/i.test(body);
    const hasCreation = inputs.length > 0 && canvases.length > 0; // input + visualization

    const levels = [hasDefinitions, hasAnalogies, hasExercises, hasComparison, hasEvaluation, hasCreation];
    const count = levels.filter(Boolean).length;

    return {
      levelsPresent: count,
      hasDefinitions, hasAnalogies, hasExercises, hasComparison, hasEvaluation, hasCreation,
      buttonCount: buttons.length,
      inputCount: inputs.length,
      canvasCount: canvases.length,
      headingCount: headings.length,
    };
  });

  const bloomsScore = Math.min(10, Math.max(1,
    bloomsData.levelsPresent <= 1 ? 2 :
    bloomsData.levelsPresent <= 2 ? 4 :
    bloomsData.levelsPresent <= 3 ? 5.5 :
    bloomsData.levelsPresent <= 4 ? 7 :
    bloomsData.levelsPresent <= 5 ? 8.5 : 10
  ));

  results.blooms = {
    score: bloomsScore,
    confidence: 0.70,
    details: bloomsData,
    rationale: `${bloomsData.levelsPresent}/6 Bloom's levels detected. ` +
      `${bloomsData.buttonCount} buttons, ${bloomsData.inputCount} inputs, ${bloomsData.canvasCount} canvases.`,
  };


  // --- Scaffolding: check for progressive structure ---
  const scaffoldingData = await page.evaluate(() => {
    const body = document.body.innerText || "";
    const hasStages = /stage|phase|step|level|unlock/i.test(body);
    const hasBridgeTexts = /what if|but .* have no|this replaced|bridge|however|limitation/i.test(body);
    const hasPrerequisites = /unlock|locked|complete.*to|score.*to/i.test(body);
    const hasDifficultyControl = document.querySelectorAll("input[type='range'], button").length > 10;
    const hasProgression = /1913.*2013.*2017.*2022|stage 1.*stage 2|markov.*word2vec.*transformer/i.test(body);

    const indicators = [hasStages, hasBridgeTexts, hasPrerequisites, hasDifficultyControl, hasProgression];
    return {
      indicatorsPresent: indicators.filter(Boolean).length,
      hasStages, hasBridgeTexts, hasPrerequisites, hasDifficultyControl, hasProgression,
    };
  });

  const scaffScore = Math.min(10, Math.max(1,
    scaffoldingData.indicatorsPresent <= 1 ? 3 :
    scaffoldingData.indicatorsPresent <= 2 ? 5 :
    scaffoldingData.indicatorsPresent <= 3 ? 7 :
    scaffoldingData.indicatorsPresent <= 4 ? 8.5 : 10
  ));

  results.scaffolding = {
    score: scaffScore,
    confidence: 0.75,
    details: scaffoldingData,
    rationale: `${scaffoldingData.indicatorsPresent}/5 scaffolding indicators detected.`,
  };


  // --- Engagement: count interactive element types ---
  const engagementData = await page.evaluate(() => {
    const buttons = document.querySelectorAll("button");
    const inputs = document.querySelectorAll("input, textarea");
    const canvases = document.querySelectorAll("canvas");
    const sliders = document.querySelectorAll("input[type='range']");

    // Check for event handlers (proxy for interactivity)
    let clickableNonButtons = 0;
    document.querySelectorAll("[style*='cursor: pointer'], [style*='cursor:pointer']").forEach(() => clickableNonButtons++);

    return {
      buttons: buttons.length,
      textInputs: document.querySelectorAll("textarea, input[type='text']").length,
      canvases: canvases.length,
      sliders: sliders.length,
      clickableElements: clickableNonButtons,
      totalInteractive: buttons.length + inputs.length + canvases.length,
    };
  });

  const engScore = Math.min(10, Math.max(1,
    engagementData.totalInteractive <= 3 ? 2 :
    engagementData.totalInteractive <= 8 ? 4 :
    engagementData.totalInteractive <= 15 ? 6 :
    engagementData.totalInteractive <= 25 ? 7.5 :
    engagementData.totalInteractive <= 40 ? 8.5 : 9.5
  ));
  // Bonus for constructive elements (text input + canvas)
  const constructiveBonus = (engagementData.textInputs > 0 && engagementData.canvases > 0) ? 0.5 : 0;

  results.engagement = {
    score: Math.min(10, engScore + constructiveBonus),
    confidence: 0.85,
    details: engagementData,
    rationale: `${engagementData.totalInteractive} interactive elements. ` +
      `${engagementData.textInputs} text inputs, ${engagementData.canvases} canvases, ${engagementData.sliders} sliders.`,
  };


  // --- Feedback: check for score displays, explanations, progress ---
  const feedbackData = await page.evaluate(() => {
    const body = document.body.innerText || "";
    const hasScoreDisplay = /score:|correct|accuracy|agreement|\d+\s*\/\s*\d+|\d+%/i.test(body);
    const hasExplanations = /because|reason|why|explanation|refers to|preferred/i.test(body);
    const hasProgress = /completed|unlocked|progress|stage.*completed/i.test(body);
    const hasMastery = /70%|unlock.*stage|complete.*to|solve.*to/i.test(body);
    const hasHints = /hint:|tip:|note:|key insight/i.test(body);

    const indicators = [hasScoreDisplay, hasExplanations, hasProgress, hasMastery, hasHints];
    return {
      indicatorsPresent: indicators.filter(Boolean).length,
      hasScoreDisplay, hasExplanations, hasProgress, hasMastery, hasHints,
    };
  });

  const feedbackScore = Math.min(10, Math.max(1,
    feedbackData.indicatorsPresent <= 1 ? 3 :
    feedbackData.indicatorsPresent <= 2 ? 5 :
    feedbackData.indicatorsPresent <= 3 ? 7 :
    feedbackData.indicatorsPresent <= 4 ? 8.5 : 10
  ));

  results.feedback = {
    score: feedbackScore,
    confidence: 0.70,
    details: feedbackData,
    rationale: `${feedbackData.indicatorsPresent}/5 feedback indicators detected.`,
  };


  // --- Multimedia: check for visual representations ---
  const multimediaData = await page.evaluate(() => {
    const canvases = document.querySelectorAll("canvas");
    const hasCanvasViz = canvases.length > 0;
    const textLength = (document.body.innerText || "").length;
    const headings = document.querySelectorAll("h1, h2, h3");
    const sections = headings.length;

    // Check for color-coded elements (signaling)
    const coloredElements = document.querySelectorAll("[style*='color: #'], [style*='color: rgb']");
    const hasSignaling = coloredElements.length > 10;

    // Check spatial contiguity: are canvases near explanatory text?
    let contiguityScore = 0;
    canvases.forEach(c => {
      const prev = c.parentElement?.previousElementSibling;
      const hasPrecedingText = prev && (prev.tagName === "P" || prev.tagName === "DIV");
      if (hasPrecedingText) contiguityScore++;
    });

    // Segmenting: check for discrete sections
    const hasSegmenting = sections >= 4;

    return {
      canvasCount: canvases.length,
      textLength,
      sectionCount: sections,
      hasSignaling,
      contiguityScore,
      hasSegmenting,
      textToVizRatio: canvases.length > 0 ? textLength / canvases.length : Infinity,
    };
  });

  const mmScore = Math.min(10, Math.max(1,
    (multimediaData.canvasCount === 0) ? 2 :
    (multimediaData.canvasCount <= 1) ? 4 :
    (multimediaData.canvasCount <= 2 && multimediaData.hasSegmenting) ? 6 :
    (multimediaData.canvasCount >= 3 && multimediaData.hasSignaling) ? 8 :
    (multimediaData.canvasCount >= 3 && multimediaData.hasSignaling && multimediaData.contiguityScore >= 2) ? 9 : 7
  ));

  results.multimedia = {
    score: mmScore,
    confidence: 0.80,
    details: multimediaData,
    rationale: `${multimediaData.canvasCount} canvas visualizations, ${multimediaData.sectionCount} sections. ` +
      `Signaling: ${multimediaData.hasSignaling ? "yes" : "no"}. Contiguity: ${multimediaData.contiguityScore}/${multimediaData.canvasCount}.`,
  };


  // --- Accessibility: contrast, font sizes, responsive, semantics ---
  const a11yData = await page.evaluate(() => {
    const allText = document.querySelectorAll("span, p, div, h1, h2, h3, button, label, a");
    let tinyTextCount = 0;
    let lowContrastCount = 0;
    let totalChecked = 0;

    // Sample font sizes
    const fontSizes = new Set();
    allText.forEach(el => {
      const styles = window.getComputedStyle(el);
      const size = parseFloat(styles.fontSize);
      if (size > 0 && size < 12) tinyTextCount++;
      if (size > 0) fontSizes.add(Math.round(size));
      totalChecked++;

      // Basic contrast check (background vs color)
      const color = styles.color;
      const bg = styles.backgroundColor;
      if (color && bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        // Rough luminance check
        const parseRGB = (s) => {
          const m = s.match(/\d+/g);
          return m ? m.map(Number) : null;
        };
        const fg = parseRGB(color);
        const bgRGB = parseRGB(bg);
        if (fg && bgRGB) {
          const lum = (rgb) => {
            const [r, g, b] = rgb.map(c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const ratio = (Math.max(lum(fg), lum(bgRGB)) + 0.05) / (Math.min(lum(fg), lum(bgRGB)) + 0.05);
          if (ratio < 3) lowContrastCount++;
        }
      }
    });

    // Check heading hierarchy
    const headings = [...document.querySelectorAll("h1, h2, h3, h4")].map(h => parseInt(h.tagName[1]));
    let hierarchyViolations = 0;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] > headings[i-1] + 1) hierarchyViolations++;
    }

    // Check viewport meta
    const viewportMeta = document.querySelector("meta[name='viewport']");
    const hasViewport = !!viewportMeta;

    return {
      totalChecked,
      tinyTextCount,
      lowContrastCount,
      fontSizeRange: [...fontSizes].sort((a,b) => a-b),
      hierarchyViolations,
      hasViewport,
      headingCount: headings.length,
    };
  });

  const a11yPenalties = a11yData.tinyTextCount * 0.3 + a11yData.lowContrastCount * 0.5 + a11yData.hierarchyViolations * 0.5;
  const a11yBonus = a11yData.hasViewport ? 0.5 : 0;
  const a11yScore = Math.min(10, Math.max(1, 8 - a11yPenalties + a11yBonus));

  results.accessibility = {
    score: a11yScore,
    confidence: 0.85,
    details: a11yData,
    rationale: `${a11yData.tinyTextCount} tiny text elements, ${a11yData.lowContrastCount} low contrast. ` +
      `${a11yData.hierarchyViolations} heading hierarchy violations. Viewport: ${a11yData.hasViewport ? "yes" : "no"}.`,
  };

  return results;
}


/**
 * Engine 2: Interaction Evaluator (Puppeteer)
 * Actually interacts with the page to test functional behavior.
 */
async function evaluateInteraction(page) {
  const results = {};

  // Test: click Generate button and check for output
  const generatorWorks = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const genBtn = buttons.find(b => b.textContent.includes("Generate"));
    if (genBtn) {
      genBtn.click();
      return true;
    }
    return false;
  });

  // Wait for generation
  if (generatorWorks) {
    await new Promise(r => setTimeout(r, 1500));
  }

  // Test: check if prediction game can start
  const gameStartable = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const startBtn = buttons.find(b => b.textContent.includes("Start Prediction Game"));
    if (startBtn) {
      startBtn.click();
      return true;
    }
    return false;
  });

  await new Promise(r => setTimeout(r, 500));

  // Check: are character buttons rendered for the game?
  const gameRendered = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const charButtons = buttons.filter(b => b.textContent.length === 1 || b.textContent === "\u2423");
    return charButtons.length;
  });

  // Test: n-gram order buttons
  const orderButtonsWork = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const orderBtns = buttons.filter(b => ["1","2","3","4"].includes(b.textContent.trim()) && b.style.width);
    return orderBtns.length;
  });

  // Test: preset text buttons
  const presetButtonsWork = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const presets = buttons.filter(b => ["pushkin","shakespeare","austen","custom"].includes(b.textContent.toLowerCase().trim()));
    return presets.length;
  });

  // Test: canvas rendering
  const canvasHasContent = await page.evaluate(() => {
    const canvases = document.querySelectorAll("canvas");
    let nonEmpty = 0;
    canvases.forEach(c => {
      const ctx = c.getContext("2d");
      if (ctx) {
        const data = ctx.getImageData(0, 0, Math.min(c.width, 100), Math.min(c.height, 100)).data;
        const hasPixels = data.some(v => v > 0);
        if (hasPixels) nonEmpty++;
      }
    });
    return { total: canvases.length, nonEmpty };
  });

  const interactionTests = [
    generatorWorks,
    gameStartable,
    gameRendered >= 20,
    orderButtonsWork >= 4,
    presetButtonsWork >= 3,
    canvasHasContent.nonEmpty > 0,
  ];

  const passCount = interactionTests.filter(Boolean).length;
  const interactionScore = Math.min(10, Math.max(1, (passCount / interactionTests.length) * 10));

  results.interactionHealth = {
    score: interactionScore,
    confidence: 0.90,
    details: {
      generatorWorks,
      gameStartable,
      gameButtonsRendered: gameRendered,
      orderButtons: orderButtonsWork,
      presetButtons: presetButtonsWork,
      canvasRendering: canvasHasContent,
      passCount,
      totalTests: interactionTests.length,
    },
    rationale: `${passCount}/${interactionTests.length} interaction tests passed. ` +
      `Canvas: ${canvasHasContent.nonEmpty}/${canvasHasContent.total} non-empty.`,
  };

  return results;
}


/**
 * Engine 3: Progression Evaluator (Source Text)
 * Analyzes the full page source to assess all 4 stages, even if locked in the UI.
 */
async function evaluateProgressionFromSource(page, sourceText) {
  const body = sourceText;

  // Check for key stage markers
  const hasMarkov = /markov/i.test(body) && /1913/.test(body);
  const hasWord2Vec = /word2vec|word embedding/i.test(body) && /2013/.test(body);
  const hasTransformer = /transformer|attention/i.test(body) && /2017/.test(body);
  const hasRLHF = /rlhf|reinforcement learning.*human/i.test(body) && /2022/.test(body);

  // Check for core intuitions
  const hasTokenPrediction = /token prediction|next.*character|predict.*next/i.test(body);
  const hasSemanticSpace = /semantic space|embedding|vector|latent space/i.test(body);
  const hasAttention = /attention.*every.*token|self-attention|query.*key.*value/i.test(body);
  const hasAlignment = /align.*preference|human feedback|reward model/i.test(body);

  // Check for historical context
  const hasHistoricalNames = /markov/i.test(body) && /mikolov/i.test(body) && /vaswani/i.test(body) && /ouyang/i.test(body);
  const hasPaperTitles = /eugene onegin/i.test(body) && /efficient estimation/i.test(body) && /attention is all/i.test(body);

  // Check for transition/bridge texts
  const bridgePatterns = [
    /no understanding of meaning/i,
    /static.*context/i,
    /gap between.*prediction.*helpful/i,
    /what if.*semantic/i,
    /limitation/i,
  ];
  const bridgeCount = bridgePatterns.filter(p => p.test(body)).length;

  // Check for epigraphs
  const hasEpigraphs = (body.match(/epigraph/gi) || []).length >= 3;

  // Check for scholarly framing
  const hasScholarlyFraming = /st\. petersburg|distributional hypothesis|NeurIPS|openai/i.test(body);

  // Check for cumulative narrative
  const hasCumulativeNarrative = /century after|100 years|built on|evolved|foundation/i.test(body);

  const stagesPresent = [hasMarkov, hasWord2Vec, hasTransformer, hasRLHF].filter(Boolean).length;
  const intuitionsPresent = [hasTokenPrediction, hasSemanticSpace, hasAttention, hasAlignment].filter(Boolean).length;

  const progScore = Math.min(10, Math.max(1,
    (stagesPresent / 4) * 3 +
    (intuitionsPresent / 4) * 3 +
    (hasHistoricalNames ? 1 : 0) +
    (hasPaperTitles ? 1 : 0) +
    Math.min(bridgeCount / 3, 1) * 1 +
    (hasCumulativeNarrative ? 1 : 0)
  ));

  // Also re-assess Bloom's from source (catches levels only visible in later stages)
  const bloomsFromSource = {
    remember: hasMarkov && hasWord2Vec && hasTransformer && hasRLHF,
    understand: /analogy|imagine|think of|core insight|deceptively simple/i.test(body),
    apply: /generate.*text|type.*text|drag|click.*character|n-gram order/i.test(body),
    analyze: /attention.*heatmap|transition matrix|vector arithmetic|embedding.*space/i.test(body),
    evaluate: /pick the better|reward model|which.*refer|agreement/i.test(body),
    create: /type.*text|custom|your.*text|prediction game/i.test(body),
  };
  const bloomsLevels = Object.values(bloomsFromSource).filter(Boolean).length;

  const bloomsScore = Math.min(10, Math.max(1,
    bloomsLevels <= 1 ? 2 :
    bloomsLevels <= 2 ? 4 :
    bloomsLevels <= 3 ? 5.5 :
    bloomsLevels <= 4 ? 7 :
    bloomsLevels <= 5 ? 8.5 : 10
  ));

  // Scaffolding from source
  const scaffFromSource = {
    sequencing: stagesPresent === 4,
    priorKnowledge: hasCumulativeNarrative,
    bridgeTexts: bridgeCount >= 2,
    adjustableDifficulty: /n-gram order|order.*1.*2.*3.*4/i.test(body),
    unlockGating: /unlock|locked|complete.*to|70%/i.test(body),
  };
  const scaffIndicators = Object.values(scaffFromSource).filter(Boolean).length;

  const scaffScore = Math.min(10, Math.max(1,
    scaffIndicators <= 1 ? 3 :
    scaffIndicators <= 2 ? 5 :
    scaffIndicators <= 3 ? 7 :
    scaffIndicators <= 4 ? 8.5 : 10
  ));

  return {
    progression: {
      score: progScore,
      confidence: 0.85,
      details: {
        stagesPresent, intuitionsPresent,
        hasHistoricalNames, hasPaperTitles, bridgeCount,
        hasCumulativeNarrative, hasScholarlyFraming, hasEpigraphs,
        hasMarkov, hasWord2Vec, hasTransformer, hasRLHF,
        hasTokenPrediction, hasSemanticSpace, hasAttention, hasAlignment,
      },
      rationale: `${stagesPresent}/4 stages, ${intuitionsPresent}/4 core intuitions. ` +
        `Historical names: ${hasHistoricalNames ? "all 4" : "partial"}. ` +
        `Bridge texts: ${bridgeCount}/5. Cumulative narrative: ${hasCumulativeNarrative ? "yes" : "no"}.`,
    },
    blooms_source: {
      score: bloomsScore,
      confidence: 0.80,
      details: bloomsFromSource,
      rationale: `${bloomsLevels}/6 Bloom's levels detected from full source analysis.`,
    },
    scaffolding_source: {
      score: scaffScore,
      confidence: 0.80,
      details: scaffFromSource,
      rationale: `${scaffIndicators}/5 scaffolding indicators from full source analysis.`,
    },
  };
}


/**
 * Engine 4: Claude API Evaluator (optional)
 * Sends page text to Claude for qualitative assessment of explanatory clarity.
 */
async function evaluateWithClaude(pageText) {
  let apiKey;
  try {
    const envPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const match = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
      if (match) apiKey = match[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {}

  if (!apiKey) {
    apiKey = process.env.ANTHROPIC_API_KEY;
  }

  if (!apiKey) {
    return { clarity: { score: null, confidence: 0, rationale: "No ANTHROPIC_API_KEY available; skipping Claude evaluation." } };
  }

  const prompt = `You are evaluating an interactive educational web page that teaches language model fundamentals through 4 stages (Markov Chains 1913, Word2Vec 2013, Transformers 2017, RLHF 2022).

Score the EXPLANATORY CLARITY dimension (1-10) based on the extracted text content below. Consider:

1. ATTENTION: Do openings/epigraphs capture interest?
2. RELEVANCE: Are concepts connected to real-world understanding via analogies?
3. JARGON MANAGEMENT: Are technical terms introduced before being used?
4. COGNITIVE LOAD: Is information density appropriate per section?
5. NARRATIVE VOICE: Is the tone scholarly yet accessible?

Return ONLY a JSON object:
{"score": <number 1-10>, "rationale": "<2-3 sentences>", "strengths": ["<strength1>", ...], "weaknesses": ["<weakness1>", ...]}

TEXT CONTENT (first 4000 chars):
${pageText.substring(0, 4000)}`;

  try {
    const https = require("https");
    const response = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });

      const req = https.request({
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(body),
        },
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve(JSON.parse(data)));
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });

    if (response.content && response.content[0]) {
      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          clarity: {
            score: parsed.score,
            confidence: 0.75,
            details: { strengths: parsed.strengths, weaknesses: parsed.weaknesses },
            rationale: parsed.rationale,
          },
        };
      }
    }
  } catch (err) {
    return {
      clarity: {
        score: null,
        confidence: 0,
        rationale: `Claude API error: ${err.message}`,
      },
    };
  }

  return { clarity: { score: null, confidence: 0, rationale: "Failed to parse Claude response." } };
}


// ═══════════════════════════════════════════════════════════
// SCORE MERGING & REPORTING
// ═══════════════════════════════════════════════════════════

function mergeResults(...resultSets) {
  const merged = {};

  for (const results of resultSets) {
    for (const [dim, data] of Object.entries(results)) {
      if (data.score === null) continue;
      if (!merged[dim]) {
        merged[dim] = data;
      } else {
        // Confidence-weighted merge
        const w1 = merged[dim].confidence;
        const w2 = data.confidence;
        merged[dim] = {
          score: (merged[dim].score * w1 + data.score * w2) / (w1 + w2),
          confidence: Math.max(w1, w2),
          rationale: merged[dim].rationale + " | " + data.rationale,
          details: { ...merged[dim].details, ...data.details },
        };
      }
    }
  }

  return merged;
}

function getTier(normalized) {
  if (normalized >= 85) return "Exemplary";
  if (normalized >= 70) return "Proficient";
  if (normalized >= 55) return "Developing";
  if (normalized >= 40) return "Emerging";
  return "Needs Work";
}

function printReport(merged, deckPath) {
  const chalk = require("chalk");
  const dim = chalk.dim;
  const accent = chalk.red;

  console.log();
  console.log(chalk.bold("  Educational Artefact Evaluation"));
  console.log(dim(`  ${deckPath}`));
  console.log(dim("  " + "=".repeat(56)));

  let totalWeighted = 0;
  let totalWeight = 0;

  const dimOrder = ["blooms", "scaffolding", "engagement", "feedback", "multimedia", "progression", "accessibility", "clarity"];

  for (const dimId of dimOrder) {
    const def = DIMENSIONS[dimId];
    const result = merged[dimId];
    if (!result || result.score === null) {
      console.log(dim(`  ${def.label.padEnd(30)} ${"--".padStart(6)}  ${dim("(not evaluated)")}`));
      continue;
    }

    const score = result.score;
    const weight = def.weight;
    totalWeighted += score * weight;
    totalWeight += weight;

    const bar = "█".repeat(Math.round(score)) + dim("░".repeat(10 - Math.round(score)));
    const scoreStr = score.toFixed(1).padStart(5);
    const color = score >= 8 ? chalk.green : score >= 6 ? chalk.yellow : score >= 4 ? chalk.red : chalk.red.bold;

    console.log(`  ${def.label.padEnd(30)} ${color(scoreStr)}/10  ${bar}  ${dim(result.rationale?.substring(0, 60) || "")}`);
  }

  const normalized = totalWeight > 0 ? (totalWeighted / totalWeight) * 10 : 0;
  const tier = getTier(normalized);
  const tierColor = normalized >= 85 ? chalk.green.bold : normalized >= 70 ? chalk.green : normalized >= 55 ? chalk.yellow : chalk.red;

  console.log(dim("  " + "-".repeat(56)));
  console.log(`  ${"Overall".padEnd(30)} ${chalk.bold(Math.round(normalized).toString().padStart(4))}%  ${tierColor(tier)}`);
  console.log();

  // Print interaction health if available
  if (merged.interactionHealth) {
    const ih = merged.interactionHealth;
    console.log(dim("  Interaction Health"));
    console.log(`  ${"Functional Tests".padEnd(30)} ${chalk.cyan(ih.score.toFixed(1).padStart(5))}/10  ${dim(ih.rationale?.substring(0, 60) || "")}`);
    console.log();
  }

  return { normalized, tier, totalWeighted, totalWeight };
}

function buildJSONOutput(merged, deckPath, summary) {
  return {
    $schema: "eval-educational-v1",
    page: deckPath,
    timestamp: new Date().toISOString(),
    dimensions: Object.fromEntries(
      Object.entries(merged).map(([k, v]) => [k, {
        score: v.score !== null ? Math.round(v.score * 10) / 10 : null,
        confidence: v.confidence,
        rationale: v.rationale,
        details: v.details,
        definition: DIMENSIONS[k]?.label || k,
        theory: DIMENSIONS[k]?.theory || null,
      }])
    ),
    summary: {
      normalized: Math.round(summary.normalized * 10) / 10,
      tier: summary.tier,
      totalWeighted: Math.round(summary.totalWeighted * 10) / 10,
      totalWeight: summary.totalWeight,
    },
    rubric: Object.fromEntries(
      Object.entries(DIMENSIONS).map(([k, v]) => [k, {
        label: v.label,
        weight: v.weight,
        theory: v.theory,
        description: v.description,
        indicators: v.indicators,
      }])
    ),
  };
}


// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const pagePath = args.find(a => !a.startsWith("--"));
  const jsonMode = args.includes("--json");
  const withClaude = args.includes("--with-claude");
  const portArg = args.find(a => a.startsWith("--port="));
  const port = portArg ? parseInt(portArg.split("=")[1]) : null;

  if (!pagePath) {
    console.error("Usage: node pages/eval-educational.js <page.html> [--json] [--with-claude] [--port=8701]");
    process.exit(1);
  }

  const fullPath = path.resolve(pagePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }

  // Start server if no port provided
  let server = null;
  let serverPort = port;

  if (!serverPort) {
    serverPort = 9123;
    const projectRoot = path.dirname(fullPath);
    server = http.createServer((req, res) => {
      const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, "");
      const filePath = path.join(projectRoot, safePath);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
        ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
        ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff",
      };
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
      fs.createReadStream(filePath).pipe(res);
    });
    await new Promise((resolve, reject) => {
      server.listen(serverPort, () => resolve());
      server.on("error", () => {
        serverPort = 9124;
        server.listen(serverPort, () => resolve());
      });
    });
  }

  const relativePath = path.relative(path.dirname(fullPath), fullPath);
  const url = `http://localhost:${serverPort}/${relativePath}`;

  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch {
    console.error("Puppeteer is required. Install with: npm install puppeteer");
    if (server) server.close();
    process.exit(1);
  }

  if (!jsonMode) {
    const chalk = require("chalk");
    console.log(chalk.dim(`  Launching headless browser for ${relativePath}...`));
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--window-size=1920,1080", "--no-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

    // Wait for React + Babel to compile and render
    await new Promise(r => setTimeout(r, 2000));

    // Unlock all stages and collect content from each by navigating through them
    await page.evaluate(() => {
      // Force-unlock all stages by dispatching through React's rendered buttons
      // Find stage navigator nodes and mark all as unlocked
      const stageNodes = document.querySelectorAll("[style*='border-radius: 50%']");
      // We need to access the React state - collect all text from the HTML source instead
    });

    // Collect full-page text by visiting each stage
    // First, unlock all stages via React internals
    await page.evaluate(() => {
      // Access the root React fiber to dispatch unlock actions
      const rootEl = document.getElementById("root");
      if (!rootEl || !rootEl._reactRootContainer && !rootEl.__reactContainer) {
        // React 18 createRoot - try finding the fiber
      }
    });

    // Approach: read ALL text from the script source (contains all stage data as JS constants)
    const fullSourceText = await page.evaluate(() => {
      const scripts = document.querySelectorAll("script[type='text/babel']");
      let allText = document.body.innerText || "";
      // Also extract string literals from the script source (stage intros, etc.)
      scripts.forEach(s => {
        const content = s.textContent || "";
        // Extract all quoted strings that look like educational content
        const strings = content.match(/"[^"]{20,}"/g) || [];
        allText += " " + strings.join(" ");
      });
      return allText;
    });

    // Navigate through all stages by clicking stage nav nodes
    // Stage 1 is visible by default. Try clicking stages 2-4 to check if navigation works.
    // Since stages are locked, we'll evaluate what's navigable.
    const stageTexts = [await page.evaluate(() => document.body.innerText || "")];

    // Run evaluators with enriched text
    const domResults = await evaluateDOM(page);
    const interactionResults = await evaluateInteraction(page);

    // Use full source text for progression analysis (sees all 4 stages)
    const progressionResults = await evaluateProgressionFromSource(page, fullSourceText);

    // Optional Claude evaluation
    let claudeResults = {};
    if (withClaude) {
      const pageText = await page.evaluate(() => document.body.innerText || "");
      claudeResults = await evaluateWithClaude(pageText);
    }

    // Remap source-based scores to merge with DOM-based equivalents
    if (progressionResults.blooms_source) {
      progressionResults.blooms = progressionResults.blooms_source;
      delete progressionResults.blooms_source;
    }
    if (progressionResults.scaffolding_source) {
      progressionResults.scaffolding = progressionResults.scaffolding_source;
      delete progressionResults.scaffolding_source;
    }

    const merged = mergeResults(domResults, interactionResults, progressionResults, claudeResults);

    if (jsonMode) {
      const summary = { normalized: 0, tier: "", totalWeighted: 0, totalWeight: 0 };
      let tw = 0, w = 0;
      for (const [dimId, result] of Object.entries(merged)) {
        if (result.score !== null && DIMENSIONS[dimId]) {
          tw += result.score * DIMENSIONS[dimId].weight;
          w += DIMENSIONS[dimId].weight;
        }
      }
      summary.normalized = w > 0 ? (tw / w) * 10 : 0;
      summary.tier = getTier(summary.normalized);
      summary.totalWeighted = tw;
      summary.totalWeight = w;

      const output = buildJSONOutput(merged, pagePath, summary);
      console.log(JSON.stringify(output, null, 2));
    } else {
      const summary = printReport(merged, pagePath);

      // Save scorecard
      const logsDir = path.join(path.dirname(fullPath), "..", "logs", "qa");
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
      const scorecardPath = path.join(logsDir, `${path.basename(pagePath, ".html")}-educational-scorecard.json`);
      const output = buildJSONOutput(merged, pagePath, summary);
      fs.writeFileSync(scorecardPath, JSON.stringify(output, null, 2));

      const chalk = require("chalk");
      console.log(chalk.dim(`  Scorecard saved to ${path.relative(process.cwd(), scorecardPath)}`));
    }

  } finally {
    await browser.close();
    if (server) server.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
