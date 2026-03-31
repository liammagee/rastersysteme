#!/usr/bin/env node
/**
 * simulated-learner.js — Puppeteer-driven simulated learner
 *
 * Navigates through all 4 stages of the language-models page,
 * interacting with each widget, completing challenges, and generating
 * a learning trajectory report. Extends eval criteria with learner-progress
 * dimensions.
 *
 * Usage:
 *   node pages/simulated-learner.js pages/language-models.html
 *   node pages/simulated-learner.js pages/language-models.html --json
 *   node pages/simulated-learner.js pages/language-models.html --port 8701
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

// ═══════════════════════════════════════════════════════════
// LEARNER PROGRESS DIMENSIONS
// ═══════════════════════════════════════════════════════════

const PROGRESS_DIMENSIONS = {
  stageCompletion: {
    label: "Stage Completion Rate",
    description: "How many stages can the learner navigate to and interact with?",
  },
  interactionDepth: {
    label: "Interaction Depth",
    description: "Does the learner engage with all available widgets in each stage?",
  },
  challengePerformance: {
    label: "Challenge Performance",
    description: "Can the learner complete the unlock challenges?",
  },
  conceptExposure: {
    label: "Concept Exposure",
    description: "How many of the key concepts are encountered through interaction?",
  },
  feedbackLoop: {
    label: "Feedback Loop Quality",
    description: "Does the learner receive and see explanatory feedback for their actions?",
  },
  progressionClarity: {
    label: "Progression Clarity",
    description: "Is the path from one stage to the next clear and navigable?",
  },
  visualizationEngagement: {
    label: "Visualization Engagement",
    description: "Are canvas visualizations rendering and interactive?",
  },
  timeToMastery: {
    label: "Time to Mastery",
    description: "How quickly can the learner progress through all stages?",
  },
};


// ═══════════════════════════════════════════════════════════
// SIMULATED LEARNER ACTIONS
// ═══════════════════════════════════════════════════════════

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function simulateStage1(page, log) {
  log.push({ stage: 1, action: "enter", time: Date.now() });

  // 1. Read the intro (scroll down)
  await page.evaluate(() => {
    const main = document.querySelector("[style*='overflow-y: auto']");
    if (main) main.scrollTop = 300;
  });
  await wait(500);
  log.push({ stage: 1, action: "read_intro", time: Date.now() });

  // 2. Try different source texts
  const presetButtons = await page.$$("button");
  for (const btn of presetButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "shakespeare") {
      await btn.click();
      await wait(300);
      log.push({ stage: 1, action: "select_text_shakespeare", time: Date.now() });
      break;
    }
  }

  // 3. Change n-gram order
  for (const btn of presetButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "3") {
      const style = await page.evaluate(el => el.style.width, btn);
      if (style) { // n-gram buttons have a width
        await btn.click();
        await wait(200);
        log.push({ stage: 1, action: "set_ngram_3", time: Date.now() });
        break;
      }
    }
  }

  // 4. Generate text
  for (const btn of presetButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Generate") {
      await btn.click();
      await wait(2000);
      log.push({ stage: 1, action: "generate_text", time: Date.now() });
      break;
    }
  }

  // 5. Check if generated text appeared
  const hasGenerated = await page.evaluate(() => {
    const divs = document.querySelectorAll("div");
    for (const d of divs) {
      if (d.style && d.style.whiteSpace === "pre-wrap" && d.textContent.length > 20) return true;
    }
    return false;
  });
  log.push({ stage: 1, action: "generated_text_visible", success: hasGenerated, time: Date.now() });

  // 6. Scroll to Markov chain graph
  await page.evaluate(() => {
    const main = document.querySelector("[style*='overflow-y: auto']");
    if (main) main.scrollTop = 800;
  });
  await wait(500);

  // 7. Click "Walk the Chain"
  const allButtons = await page.$$("button");
  for (const btn of allButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes("Walk the Chain")) {
      await btn.click();
      await wait(3000);
      log.push({ stage: 1, action: "walk_chain", time: Date.now() });
      break;
    }
  }

  // 8. Start prediction game
  await page.evaluate(() => {
    const main = document.querySelector("[style*='overflow-y: auto']");
    if (main) main.scrollTop = 1200;
  });
  await wait(300);

  for (const btn of allButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes("Start Prediction Game")) {
      await btn.click();
      await wait(500);
      log.push({ stage: 1, action: "start_game", time: Date.now() });
      break;
    }
  }

  // 9. Play prediction game — make guesses
  let gameCorrect = 0;
  let gameTotal = 0;
  for (let round = 0; round < 15; round++) {
    // Find character buttons (single char buttons)
    const charButtons = await page.$$("button");
    const charBtns = [];
    for (const btn of charButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      const disabled = await page.evaluate(el => el.disabled, btn);
      if ((text.length === 1 || text === "\u2423") && !disabled) {
        charBtns.push({ btn, text });
      }
    }

    if (charBtns.length === 0) break;

    // Strategy: guess common letters (e, t, a, o, space) to simulate a learning pattern
    const commonChars = [" ", "e", "t", "a", "o", "i", "n", "s", "h", "r"];
    let guessed = false;
    for (const ch of commonChars) {
      const target = ch === " " ? "\u2423" : ch;
      const match = charBtns.find(b => b.text === target);
      if (match) {
        await match.btn.click();
        guessed = true;
        break;
      }
    }
    if (!guessed && charBtns.length > 0) {
      await charBtns[0].btn.click();
    }

    await wait(300);
    gameTotal++;

    // Check if answer was correct
    const scoreText = await page.evaluate(() => {
      const spans = document.querySelectorAll("span");
      for (const s of spans) {
        if (s.textContent.match(/^\d+\/\d+$/)) return s.textContent;
      }
      return null;
    });
    if (scoreText) {
      const parts = scoreText.split("/");
      gameCorrect = parseInt(parts[0]);
    }

    // Check if "Why?" explanation appeared
    const hasExplanation = await page.evaluate(() => {
      const strongs = document.querySelectorAll("strong");
      for (const s of strongs) {
        if (s.textContent === "Why?") return true;
      }
      return false;
    });
    log.push({
      stage: 1, action: "game_round",
      round: round + 1, correct: gameCorrect, total: gameTotal,
      explanationVisible: hasExplanation,
      time: Date.now(),
    });

    // Click Next Round
    const nextBtns = await page.$$("button");
    for (const btn of nextBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes("Next Round")) {
        await btn.click();
        await wait(300);
        break;
      }
    }
  }

  const accuracy = gameTotal > 0 ? Math.round((gameCorrect / gameTotal) * 100) : 0;
  log.push({ stage: 1, action: "game_complete", accuracy, correct: gameCorrect, total: gameTotal, time: Date.now() });

  return { accuracy, correct: gameCorrect, total: gameTotal };
}


async function simulateStage2(page, log) {
  log.push({ stage: 2, action: "enter", time: Date.now() });

  // Enable free explore and navigate to stage 2
  await page.evaluate(() => {
    // Click "Unlock all stages"
    const divs = document.querySelectorAll("div");
    for (const d of divs) {
      if (d.textContent.includes("Unlock all stages")) { d.click(); break; }
    }
  });
  await wait(300);

  // Click Word2Vec in nav
  await page.evaluate(() => {
    const divs = document.querySelectorAll("div");
    for (const d of divs) {
      if (d.textContent.trim() === "Word2Vec" && d.style.fontSize === "13px") { d.parentElement.click(); break; }
    }
  });
  await wait(1000);

  // Check "Building on" section visible
  const hasBuildingOn = await page.evaluate(() => {
    const body = document.body.innerText;
    return /Building on Markov Chains/i.test(body);
  });
  log.push({ stage: 2, action: "building_on_visible", success: hasBuildingOn, time: Date.now() });

  // Click "Watch Training" tab
  const allButtons = await page.$$("button");
  for (const btn of allButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Watch Training") {
      await btn.click();
      await wait(500);
      log.push({ stage: 2, action: "open_training_tab", time: Date.now() });
      break;
    }
  }

  // Start training
  const btns2 = await page.$$("button");
  for (const btn of btns2) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Train") {
      await btn.click();
      await wait(3000);
      log.push({ stage: 2, action: "run_training", time: Date.now() });
      break;
    }
  }

  // Pause training
  const btns3 = await page.$$("button");
  for (const btn of btns3) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Pause") {
      await btn.click();
      await wait(200);
      break;
    }
  }

  // Switch to Explore Embeddings
  const btns4 = await page.$$("button");
  for (const btn of btns4) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Explore Embeddings") {
      await btn.click();
      await wait(500);
      log.push({ stage: 2, action: "open_explore_tab", time: Date.now() });
      break;
    }
  }

  // Check canvas has content
  const canvasHealth = await page.evaluate(() => {
    const canvases = document.querySelectorAll("canvas");
    let nonEmpty = 0;
    canvases.forEach(c => {
      try {
        const ctx = c.getContext("2d");
        const data = ctx.getImageData(0, 0, 50, 50).data;
        if (data.some(v => v > 0)) nonEmpty++;
      } catch (e) {}
    });
    return { total: canvases.length, nonEmpty };
  });
  log.push({ stage: 2, action: "canvas_check", ...canvasHealth, time: Date.now() });

  // Switch to Analogy Solver
  const btns5 = await page.$$("button");
  for (const btn of btns5) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Analogy Solver") {
      await btn.click();
      await wait(500);
      log.push({ stage: 2, action: "open_analogy_tab", time: Date.now() });
      break;
    }
  }

  // Solve analogies
  let analogyCorrect = 0;
  for (let ai = 0; ai < 6; ai++) {
    // Click Solve button
    const solveBtns = await page.$$("button");
    for (const btn of solveBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.trim() === "Solve") {
        await btn.click();
        await wait(500);
        break;
      }
    }

    // Check result
    const resultText = await page.evaluate(() => {
      const body = document.body.innerText;
      if (/correct/i.test(body)) return "correct";
      if (/expected/i.test(body)) return "wrong";
      return "unknown";
    });
    if (resultText === "correct") analogyCorrect++;
    log.push({ stage: 2, action: "analogy_attempt", result: resultText, time: Date.now() });

    // Click Next Analogy
    const nextBtns = await page.$$("button");
    for (const btn of nextBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes("Next Analogy")) {
        await btn.click();
        await wait(300);
        break;
      }
    }
  }

  log.push({ stage: 2, action: "analogies_complete", correct: analogyCorrect, total: 6, time: Date.now() });

  // Check Architecture tab
  const btns6 = await page.$$("button");
  for (const btn of btns6) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Architecture") {
      await btn.click();
      await wait(500);
      log.push({ stage: 2, action: "open_arch_tab", time: Date.now() });
      break;
    }
  }

  // Click Propagate
  const btns7 = await page.$$("button");
  for (const btn of btns7) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Propagate") {
      await btn.click();
      await wait(2000);
      log.push({ stage: 2, action: "propagate_network", time: Date.now() });
      break;
    }
  }

  return { analogyCorrect };
}


async function simulateStage3(page, log) {
  log.push({ stage: 3, action: "enter", time: Date.now() });

  // Navigate to Transformers
  await page.evaluate(() => {
    const divs = document.querySelectorAll("div");
    for (const d of divs) {
      if (d.textContent.trim() === "Transformers" && d.style.fontSize === "13px") { d.parentElement.click(); break; }
    }
  });
  await wait(1000);

  // Check Building On section
  const hasBuildingOn = await page.evaluate(() => /Building on Word2Vec/i.test(document.body.innerText));
  log.push({ stage: 3, action: "building_on_visible", success: hasBuildingOn, time: Date.now() });

  // Explore attention heatmap — try different sentences
  const btns = await page.$$("button");
  let sentenceClicked = 0;
  for (const btn of btns) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('"The') && sentenceClicked < 2) {
      await btn.click();
      await wait(400);
      sentenceClicked++;
      log.push({ stage: 3, action: "select_sentence", time: Date.now() });
    }
  }

  // Try different attention heads
  for (const btn of btns) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes("Coreference")) {
      await btn.click();
      await wait(400);
      log.push({ stage: 3, action: "select_coreference_head", time: Date.now() });
      break;
    }
  }

  // Open training tab
  const btns2 = await page.$$("button");
  for (const btn of btns2) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Watch Training") {
      await btn.click();
      await wait(500);
      break;
    }
  }

  // Run transformer training
  const btns3 = await page.$$("button");
  for (const btn of btns3) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Train") {
      await btn.click();
      await wait(4000);
      log.push({ stage: 3, action: "run_training", time: Date.now() });
      break;
    }
  }

  // Pause
  const btns3b = await page.$$("button");
  for (const btn of btns3b) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Pause") { await btn.click(); break; }
  }

  // Open Network View
  const btns4 = await page.$$("button");
  for (const btn of btns4) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Network View") {
      await btn.click();
      await wait(500);
      log.push({ stage: 3, action: "open_network_view", time: Date.now() });
      break;
    }
  }

  // Propagate both networks
  const propBtns = await page.$$("button");
  let propCount = 0;
  for (const btn of propBtns) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Propagate" && propCount < 2) {
      await btn.click();
      await wait(1500);
      propCount++;
    }
  }
  log.push({ stage: 3, action: "propagate_networks", count: propCount, time: Date.now() });

  // Challenge
  const btns5 = await page.$$("button");
  for (const btn of btns5) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Challenge") {
      await btn.click();
      await wait(500);
      log.push({ stage: 3, action: "open_challenge", time: Date.now() });
      break;
    }
  }

  // Attempt 3 challenge questions
  let challengeCorrect = 0;
  for (let ci = 0; ci < 3; ci++) {
    // The correct answers are: ball (idx 4), trophy (idx 1), council (idx 2)
    // Simulate a learner who gets 2/3 right
    const answerBtns = await page.$$("button");
    const answerTexts = [];
    for (const btn of answerBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (["ball", "dog", "trophy", "suitcase", "council", "demonstrators"].includes(text.trim())) {
        answerTexts.push({ btn, text: text.trim() });
      }
    }

    // Pick: ball, trophy, demonstrators (wrong on 3rd)
    const correctAnswers = ["ball", "trophy", "council"];
    const learnerAnswers = ["ball", "trophy", "demonstrators"];
    const targetAnswer = learnerAnswers[ci];
    const match = answerTexts.find(a => a.text === targetAnswer);
    if (match) {
      await match.btn.click();
      await wait(500);
      if (targetAnswer === correctAnswers[ci]) challengeCorrect++;
      log.push({ stage: 3, action: "challenge_answer", question: ci + 1, answer: targetAnswer, correct: targetAnswer === correctAnswers[ci], time: Date.now() });
    }

    // Click Next Question
    const nextBtns = await page.$$("button");
    for (const btn of nextBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes("Next Question")) {
        await btn.click();
        await wait(300);
        break;
      }
    }
  }

  log.push({ stage: 3, action: "challenge_complete", correct: challengeCorrect, total: 3, time: Date.now() });
  return { challengeCorrect };
}


async function simulateStage4(page, log) {
  log.push({ stage: 4, action: "enter", time: Date.now() });

  // Navigate to RLHF
  await page.evaluate(() => {
    const divs = document.querySelectorAll("div");
    for (const d of divs) {
      if (d.textContent.trim() === "RLHF" && d.style.fontSize === "13px") { d.parentElement.click(); break; }
    }
  });
  await wait(1000);

  // Check Building On section
  const hasBuildingOn = await page.evaluate(() => /Building on Transformers/i.test(document.body.innerText));
  log.push({ stage: 4, action: "building_on_visible", success: hasBuildingOn, time: Date.now() });

  // Play reward model game — 5 rounds
  let rewardCorrect = 0;
  for (let ri = 0; ri < 5; ri++) {
    // Strategy: pick Response B for odd rounds, Response A for even (simulates learning)
    const respBtns = await page.$$("button");
    const responseButtons = [];
    for (const btn of respBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      // Response A/B are rendered as divs with onClick, not buttons
    }

    // Click on the response div
    const picked = await page.evaluate((round) => {
      // Find the two response panels
      const panels = document.querySelectorAll("[style*='cursor: pointer']");
      const responsePanels = [];
      for (const p of panels) {
        if (p.textContent.includes("Response A") || p.textContent.includes("Response B")) {
          responsePanels.push(p);
        }
      }
      // Alternate picking A and B
      if (responsePanels.length >= 2) {
        const pick = round % 2 === 0 ? 1 : 0; // Lean toward B (often the better one)
        responsePanels[pick].click();
        return true;
      }
      return false;
    }, ri);

    await wait(600);

    // Check result
    const wasCorrect = await page.evaluate(() => {
      const body = document.body.innerText;
      return /Why .* is preferred/i.test(body);
    });
    if (wasCorrect) rewardCorrect++;
    log.push({ stage: 4, action: "reward_round", round: ri + 1, feedbackVisible: wasCorrect, time: Date.now() });

    // Click Next Pair
    const nextBtns = await page.$$("button");
    for (const btn of nextBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes("Next Pair")) {
        await btn.click();
        await wait(300);
        break;
      }
    }
  }

  log.push({ stage: 4, action: "reward_complete", rounds: 5, time: Date.now() });

  // Open Under the Hood tab
  const btns = await page.$$("button");
  for (const btn of btns) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Under the Hood") {
      await btn.click();
      await wait(500);
      log.push({ stage: 4, action: "open_underhood", time: Date.now() });
      break;
    }
  }

  // Toggle to Post-Alignment
  const btns2 = await page.$$("button");
  for (const btn of btns2) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Post-Alignment") {
      await btn.click();
      await wait(500);
      log.push({ stage: 4, action: "toggle_post_alignment", time: Date.now() });
      break;
    }
  }

  // Open Pipeline tab
  const btns3 = await page.$$("button");
  for (const btn of btns3) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "RLHF Pipeline") {
      await btn.click();
      await wait(500);
      log.push({ stage: 4, action: "open_pipeline", time: Date.now() });
      break;
    }
  }

  // Propagate all three pipeline networks
  const propBtns = await page.$$("button");
  let propCount = 0;
  for (const btn of propBtns) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === "Propagate" && propCount < 3) {
      await btn.click();
      await wait(1500);
      propCount++;
    }
  }
  log.push({ stage: 4, action: "propagate_pipeline", count: propCount, time: Date.now() });

  return { rewardCorrect };
}


// ═══════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════

function scoreTrajectory(log, results) {
  const scores = {};
  const startTime = log[0]?.time || Date.now();
  const endTime = log[log.length - 1]?.time || Date.now();
  const totalTime = (endTime - startTime) / 1000;

  // Stage completion: did we enter all 4 stages?
  const stagesEntered = new Set(log.filter(l => l.action === "enter").map(l => l.stage));
  scores.stageCompletion = { score: Math.min(10, (stagesEntered.size / 4) * 10), detail: stagesEntered.size + "/4 stages entered" };

  // Interaction depth: how many unique actions per stage?
  const actionsPerStage = {};
  log.forEach(l => {
    if (!actionsPerStage[l.stage]) actionsPerStage[l.stage] = new Set();
    actionsPerStage[l.stage].add(l.action);
  });
  const avgActions = Object.values(actionsPerStage).reduce((s, a) => s + a.size, 0) / Math.max(stagesEntered.size, 1);
  scores.interactionDepth = { score: Math.min(10, avgActions / 1.2), detail: avgActions.toFixed(1) + " avg actions/stage" };

  // Challenge performance
  const s1Accuracy = results.stage1?.accuracy || 0;
  const s2Analogies = results.stage2?.analogyCorrect || 0;
  const s3Challenge = results.stage3?.challengeCorrect || 0;
  const challengeScore = ((s1Accuracy / 100) * 3 + (s2Analogies / 6) * 3 + (s3Challenge / 3) * 4);
  scores.challengePerformance = {
    score: challengeScore,
    detail: `S1: ${s1Accuracy}% acc, S2: ${s2Analogies}/6 analogies, S3: ${s3Challenge}/3 coref`,
  };

  // Concept exposure: count key concepts encountered
  const conceptActions = ["read_intro", "building_on_visible", "generate_text", "walk_chain",
    "run_training", "open_arch_tab", "propagate_network", "select_coreference_head",
    "open_underhood", "toggle_post_alignment", "open_pipeline"];
  const encounteredConcepts = log.filter(l => conceptActions.includes(l.action));
  scores.conceptExposure = {
    score: Math.min(10, (encounteredConcepts.length / conceptActions.length) * 10),
    detail: encounteredConcepts.length + "/" + conceptActions.length + " key interactions",
  };

  // Feedback loop quality
  const feedbackEvents = log.filter(l => l.explanationVisible || l.feedbackVisible || l.action.includes("building_on"));
  scores.feedbackLoop = {
    score: Math.min(10, feedbackEvents.length > 0 ? 7 + Math.min(feedbackEvents.length, 6) * 0.5 : 3),
    detail: feedbackEvents.length + " feedback moments",
  };

  // Progression clarity
  const buildingOnVisible = log.filter(l => l.action === "building_on_visible" && l.success);
  scores.progressionClarity = {
    score: Math.min(10, (buildingOnVisible.length / 3) * 7 + 3),
    detail: buildingOnVisible.length + "/3 building-on sections visible",
  };

  // Visualization engagement
  const vizActions = log.filter(l =>
    l.action.includes("canvas") || l.action.includes("propagate") ||
    l.action.includes("training") || l.action.includes("walk_chain")
  );
  scores.visualizationEngagement = {
    score: Math.min(10, vizActions.length > 0 ? 5 + Math.min(vizActions.length, 10) * 0.5 : 2),
    detail: vizActions.length + " visualization interactions",
  };

  // Time to mastery
  const timeScore = totalTime < 60 ? 9 : totalTime < 120 ? 8 : totalTime < 180 ? 7 : totalTime < 300 ? 6 : 5;
  scores.timeToMastery = {
    score: timeScore,
    detail: totalTime.toFixed(0) + "s total time",
  };

  return scores;
}


// ═══════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════

function printReport(scores, log, pagePath) {
  const chalk = require("chalk");
  console.log();
  console.log(chalk.bold("  Simulated Learner Trajectory Report"));
  console.log(chalk.dim("  " + pagePath));
  console.log(chalk.dim("  " + "=".repeat(56)));

  let total = 0, count = 0;
  for (const [dimId, data] of Object.entries(scores)) {
    const def = PROGRESS_DIMENSIONS[dimId];
    const score = data.score;
    total += score;
    count++;

    const bar = "\u2588".repeat(Math.round(score)) + chalk.dim("\u2591".repeat(10 - Math.round(score)));
    const color = score >= 8 ? chalk.green : score >= 6 ? chalk.yellow : chalk.red;
    console.log(`  ${(def?.label || dimId).padEnd(30)} ${color(score.toFixed(1).padStart(5))}/10  ${bar}  ${chalk.dim(data.detail)}`);
  }

  const avg = count > 0 ? total / count : 0;
  const pct = Math.round(avg * 10);
  const tier = pct >= 85 ? "Exemplary" : pct >= 70 ? "Proficient" : pct >= 55 ? "Developing" : pct >= 40 ? "Emerging" : "Needs Work";
  const tierColor = pct >= 70 ? chalk.green.bold : pct >= 55 ? chalk.yellow : chalk.red;

  console.log(chalk.dim("  " + "-".repeat(56)));
  console.log(`  ${"Learner Progress Score".padEnd(30)} ${chalk.bold(pct.toString().padStart(4))}%  ${tierColor(tier)}`);
  console.log();

  // Action timeline
  console.log(chalk.dim("  Action Timeline (" + log.length + " events):"));
  const stageColors = { 1: chalk.hex("#E8A838"), 2: chalk.hex("#48BFE3"), 3: chalk.hex("#C4A1FF"), 4: chalk.hex("#FF6B6B") };
  for (const entry of log) {
    const color = stageColors[entry.stage] || chalk.dim;
    const t = ((entry.time - log[0].time) / 1000).toFixed(1).padStart(6) + "s";
    const detail = entry.success !== undefined ? (entry.success ? " \u2713" : " \u2717") : "";
    console.log(chalk.dim("  " + t) + "  " + color("S" + entry.stage) + " " + chalk.dim(entry.action + detail));
  }
  console.log();

  return { avg, pct, tier };
}


// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const pagePath = args.find(a => !a.startsWith("--"));
  const jsonMode = args.includes("--json");
  const portArg = args.find(a => a.startsWith("--port="));
  const port = portArg ? parseInt(portArg.split("=")[1]) : null;

  if (!pagePath) {
    console.error("Usage: node pages/simulated-learner.js <page.html> [--json] [--port=8701]");
    process.exit(1);
  }

  const fullPath = path.resolve(pagePath);
  if (!fs.existsSync(fullPath)) { console.error("File not found: " + fullPath); process.exit(1); }

  // Start server if needed
  let server = null;
  let serverPort = port;
  if (!serverPort) {
    serverPort = 9125;
    const projectRoot = path.dirname(fullPath);
    server = http.createServer((req, res) => {
      const safePath = path.normalize(req.url.split("?")[0]).replace(/^(\.\.[\/\\])+/, "");
      const filePath = path.join(projectRoot, safePath);
      if (!fs.existsSync(filePath)) { res.writeHead(404); res.end("Not found"); return; }
      const ext = path.extname(filePath).toLowerCase();
      const mimes = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
      res.writeHead(200, { "Content-Type": mimes[ext] || "text/plain" });
      fs.createReadStream(filePath).pipe(res);
    });
    await new Promise(r => { server.listen(serverPort, r); });
  }

  const relativePath = path.relative(path.dirname(fullPath), fullPath);
  const url = "http://localhost:" + serverPort + "/" + relativePath;

  let puppeteer;
  try { puppeteer = require("puppeteer"); } catch {
    console.error("Puppeteer required. Install with: npm install puppeteer");
    if (server) server.close(); process.exit(1);
  }

  if (!jsonMode) {
    const chalk = require("chalk");
    console.log(chalk.dim("  Launching simulated learner for " + relativePath + "..."));
  }

  const browser = await puppeteer.launch({ headless: "new", args: ["--window-size=1920,1080", "--no-sandbox"] });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await wait(2500); // Wait for React + Babel

    const log = [];
    const results = {};

    // Run through all 4 stages
    results.stage1 = await simulateStage1(page, log);
    results.stage2 = await simulateStage2(page, log);
    results.stage3 = await simulateStage3(page, log);
    results.stage4 = await simulateStage4(page, log);

    // Score the trajectory
    const scores = scoreTrajectory(log, results);

    if (jsonMode) {
      const output = {
        $schema: "simulated-learner-v1",
        page: pagePath,
        timestamp: new Date().toISOString(),
        trajectory: log,
        results,
        scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, {
          score: Math.round(v.score * 10) / 10,
          detail: v.detail,
          definition: PROGRESS_DIMENSIONS[k]?.label,
        }])),
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      const summary = printReport(scores, log, pagePath);

      // Save report
      const logsDir = path.join(path.dirname(fullPath), "..", "logs", "qa");
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
      const reportPath = path.join(logsDir, "language-models-learner-trajectory.json");
      const output = {
        $schema: "simulated-learner-v1",
        page: pagePath, timestamp: new Date().toISOString(),
        trajectory: log, results, scores,
        summary,
      };
      fs.writeFileSync(reportPath, JSON.stringify(output, null, 2));
      const chalk = require("chalk");
      console.log(chalk.dim("  Trajectory saved to " + path.relative(process.cwd(), reportPath)));
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
