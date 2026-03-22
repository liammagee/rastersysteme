#!/usr/bin/env node
/**
 * studio.js — precision slide viewer for rastersysteme
 *
 * Generates a self-contained HTML viewer with three modes:
 *   PRESENT  (default)  Full-screen edge-to-edge presentation
 *   GRID     (G key)    Thumbnail overview with validation badges
 *   QA       (Q key)    Side panel with design quality analysis
 *
 * Usage:
 *   node studio.js <input.md> [output.html] [--theme dark|light|red|blue] [--format html]
 *
 * API:
 *   const { generateStudio } = require("./studio.js");
 *   await generateStudio("deck.composed.md", "deck.studio.html", { theme: "dark" });
 */

const fs = require("fs");
const path = require("path");
const {
  parseMarkdown,
  detectLayout,
  HTML_LAYOUTS,
  THEMES,
  adaptThemeForBg,
  generateHTMLCSS,
  renderDesigned,
} = require("./raster.js");
const { runQA } = require("./qa.js");

// ═══════════════════════════════════════════════════════
// HTML ESCAPING (mirrors raster.js esc)
// ═══════════════════════════════════════════════════════

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\\n/g, "<br>")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

// ═══════════════════════════════════════════════════════
// STUDIO CSS — the viewer chrome
// ═══════════════════════════════════════════════════════

function studioCSS() {
  // Layout-type colour map for grid badges
  const layoutColours = {
    title:    { bg: 'rgba(224,64,64,0.12)',  text: '#E04040' },
    section:  { bg: 'rgba(64,192,128,0.12)', text: '#40C080' },
    split:    { bg: 'rgba(80,140,220,0.12)', text: '#508CDC' },
    bullets:  { bg: 'rgba(224,160,64,0.12)', text: '#E0A040' },
    quote:    { bg: 'rgba(180,120,220,0.12)',text: '#B478DC' },
    statement:{ bg: 'rgba(80,200,200,0.12)', text: '#50C8C8' },
    image:    { bg: 'rgba(220,100,160,0.12)',text: '#DC64A0' },
    code:     { bg: 'rgba(160,180,80,0.12)', text: '#A0B450' },
    table:    { bg: 'rgba(100,160,200,0.12)',text: '#64A0C8' },
    comparison:{ bg:'rgba(200,140,80,0.12)', text: '#C88C50' },
    'content-heavy':{ bg:'rgba(140,120,200,0.12)',text:'#8C78C8' },
    blank:    { bg: 'rgba(136,136,160,0.10)',text: '#8888A0' },
    arc:      { bg: 'rgba(200,80,120,0.12)', text: '#C85078' },
    rotated:  { bg: 'rgba(120,180,120,0.12)',text: '#78B478' },
    overlap:  { bg: 'rgba(180,160,80,0.12)', text: '#B4A050' },
    designed: { bg: 'rgba(200,200,220,0.10)',text: '#C8C8DC' },
  };

  // Generate per-layout badge CSS
  const layoutBadgeCSS = Object.entries(layoutColours).map(([layout, c]) =>
    `.studio-card-layout[data-layout="${layout}"] { background: ${c.bg}; color: ${c.text}; }`
  ).join('\n');

  return `
/* ═══════════════════════════════════════════════════════
   STUDIO CHROME — v2 "Editorial Stage" aesthetic
   Fonts: Fraunces (display), Outfit (UI), JetBrains Mono
   ═══════════════════════════════════════════════════════ */

:root {
  --stage:       #0C0C0E;
  --surface:     #16161A;
  --surface-2:   #1E1E24;
  --border:      #2A2A32;
  --border-2:    #353540;
  --text:        #ECECF0;
  --text-2:      #8888A0;
  --text-3:      #55556A;
  --accent:      #E04040;
  --accent-glow: rgba(224,64,64,0.3);
  --success:     #40C080;
  --warning:     #E0A040;
  --error:       #E04040;
  --radius:      4px;
  --ease:        cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* legacy aliases so existing JS refs don't break */
  --studio-bg:      var(--stage);
  --studio-surface:  var(--surface);
  --studio-surface2: var(--surface-2);
  --studio-border:   var(--border);
  --studio-border2:  var(--border-2);
  --studio-text:     var(--text);
  --studio-text2:    var(--text-2);
  --studio-text3:    var(--text-3);
  --studio-accent:   var(--accent);
  --studio-success:  var(--success);
  --studio-warning:  var(--warning);
  --studio-error:    var(--error);
  --studio-radius:   var(--radius);
  --studio-ease:     var(--ease);
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  width: 100%; height: 100%;
  background: var(--stage);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: 'Outfit', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: var(--text);
}

/* ─── NOISE TEXTURE (CSS-only) ─── */

.studio-stage::before {
  content: '';
  position: absolute; inset: 0;
  background-image:
    repeating-conic-gradient(
      rgba(255,255,255,0.012) 0% 25%,
      transparent 0% 50%
    );
  background-size: 4px 4px;
  pointer-events: none;
  z-index: 0;
}

/* ─── STAGE: the dark area behind slides ─── */

.studio-stage {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--stage);
  padding: 3vmin;
  transition: padding 0.4s var(--ease);
}

.studio-stage.qa-open {
  padding-right: calc(30% + 3vmin);
}

/* ─── SLIDE VIEWPORT — floating card ─── */

.studio-viewport {
  position: relative;
  width: 100%;
  max-width: calc((100vh - 6vmin) * 16 / 9);
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 3px;
  z-index: 1;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.03),
    0 2px 4px rgba(0,0,0,0.3),
    0 8px 24px rgba(0,0,0,0.4),
    0 24px 80px rgba(0,0,0,0.5);
}

.studio-stage.qa-open .studio-viewport {
  max-width: calc((100vh - 6vmin) * 16 / 9 * 0.7);
}

/* ─── INDIVIDUAL SLIDES — crossfade + scale ─── */

.studio-slide {
  position: absolute; inset: 0;
  opacity: 0;
  transform: scale(0.98);
  pointer-events: none;
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.studio-slide.active {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

.studio-slide .slide-content {
  position: absolute; inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── PROGRESS BAR — thin accent with glow ─── */

.studio-progress {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: rgba(255,255,255,0.04);
  z-index: 500;
}

.studio-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.35s ease;
  width: 0;
  box-shadow: 0 0 8px var(--accent-glow), 0 0 24px var(--accent-glow);
}

/* ─── SLIDE COUNTER — bottom-right, Outfit ─── */

.studio-counter {
  position: fixed;
  bottom: 14px; right: 20px;
  font-family: 'Outfit', sans-serif;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-3);
  z-index: 500;
  letter-spacing: 0.08em;
  user-select: none;
  transition: opacity 0.3s ease;
  opacity: 0.6;
}

.studio-counter.hidden { opacity: 0; }

/* ─── SPEAKER NOTES — frosted dark glass ─── */

.studio-notes {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 0;
  background: rgba(12, 12, 14, 0.7);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border-top: 1px solid var(--border);
  color: var(--text);
  overflow: auto;
  transition: height 0.3s var(--ease), padding 0.3s var(--ease);
  z-index: 600;
  padding: 0 40px;
}

.studio-notes.open {
  height: 25vh;
  padding: 24px 40px;
}

.studio-notes-header {
  font-family: 'Outfit', sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 14px;
}

.studio-notes-body {
  font-family: 'Outfit', sans-serif;
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-2);
  white-space: pre-wrap;
  max-width: 80ch;
}

/* ─── GRID MODE — dark surface + grid pattern ─── */

.studio-grid {
  position: fixed; inset: 0;
  background:
    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px),
    var(--stage);
  background-size: 40px 40px, 40px 40px, 100% 100%;
  z-index: 800;
  overflow-y: auto;
  padding: 48px 48px;
  opacity: 0;
  pointer-events: none;
  transform: scale(0.97);
  transition: opacity 0.3s var(--ease), transform 0.3s var(--ease);
}

.studio-grid.open {
  opacity: 1;
  pointer-events: auto;
  transform: scale(1);
}

.studio-grid-header {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 36px;
}

.studio-grid-title {
  font-family: 'Fraunces', serif;
  font-size: 26px;
  font-weight: 400;
  font-optical-sizing: auto;
  color: var(--text);
  letter-spacing: -0.02em;
}

.studio-grid-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-3);
}

.studio-grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

/* ─── GRID CARDS — rounded, hover lift ─── */

.studio-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease),
              border-color 0.25s ease;
  outline: none;
}

.studio-card:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  border-color: var(--border-2);
}

.studio-card:focus-visible,
.studio-card.grid-active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow), 0 12px 40px rgba(0,0,0,0.5);
  transform: scale(1.02);
}

.studio-card-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #000;
}

.studio-card-preview .slide-scaled {
  position: absolute;
  width: 1280px; height: 720px;
  transform-origin: top left;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.studio-card-info {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.studio-card-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  min-width: 24px;
}

/* ─── Layout badge: pill-shaped, colour-coded ─── */

.studio-card-layout {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.04em;
  padding: 3px 10px;
  border-radius: 100px;
  /* default fallback colour */
  color: var(--text-2);
  background: rgba(136,136,160,0.1);
}

${layoutBadgeCSS}

/* ─── QA status dot ─── */

.studio-card-status {
  margin-left: auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.studio-card-status.ok   { background: var(--success); }
.studio-card-status.warn { background: var(--warning); }
.studio-card-status.err  { background: var(--error); }

.studio-card-badges {
  padding: 0 14px 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.studio-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  padding: 2px 8px;
  border-radius: 100px;
  line-height: 1.4;
}
.studio-badge.warn {
  background: rgba(224,160,64,0.12);
  color: var(--warning);
}
.studio-badge.err {
  background: rgba(224,64,64,0.12);
  color: var(--error);
}

/* ─── QA PANEL — slide-in from right ─── */

.studio-qa {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 0;
  background: var(--surface);
  border-left: 1px solid var(--border);
  z-index: 700;
  overflow-y: auto;
  overflow-x: hidden;
  opacity: 0;
  transition: width 0.4s var(--ease-spring), opacity 0.3s ease;
}

.studio-qa.open {
  width: 30%;
  min-width: 380px;
  opacity: 1;
}

.studio-qa-inner {
  padding: 36px 32px;
  min-width: 360px;
}

.studio-qa-title {
  font-family: 'Fraunces', serif;
  font-size: 22px;
  font-weight: 400;
  font-optical-sizing: auto;
  color: var(--text);
  margin-bottom: 4px;
}

.studio-qa-subtitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 32px;
}

/* Grade display — large Fraunces letter */
.studio-grade-container {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 32px;
  padding: 24px;
  background: var(--surface-2);
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

.studio-grade-letter {
  font-family: 'Fraunces', serif;
  font-size: 80px;
  font-weight: 900;
  font-optical-sizing: auto;
  line-height: 1;
}

.studio-grade-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.studio-grade-score {
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  color: var(--text);
}

.studio-grade-pct {
  font-family: 'Outfit', sans-serif;
  font-size: 12px;
  color: var(--text-3);
}

/* Score bars — 4px, rounded, gradient */
.studio-score-section {
  margin-bottom: 28px;
}

.studio-score-label {
  font-family: 'Outfit', sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.studio-score-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.studio-score-name {
  font-family: 'Outfit', sans-serif;
  font-size: 12px;
  color: var(--text-2);
  width: 120px;
  flex-shrink: 0;
}

.studio-score-bar-bg {
  flex: 1;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.studio-score-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.7s var(--ease);
}

.studio-score-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-2);
  min-width: 36px;
  text-align: right;
}

/* Summary stats */
.studio-qa-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 28px;
}

.studio-qa-stat {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 5px 12px;
  border-radius: 100px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.studio-qa-stat.ok   { color: var(--success); }
.studio-qa-stat.warn { color: var(--warning); }
.studio-qa-stat.err  { color: var(--error); }

/* Issue list — cards with left colour border */
.studio-issue {
  padding: 10px 14px;
  margin-bottom: 6px;
  border-radius: var(--radius);
  font-family: 'Outfit', sans-serif;
  font-size: 12px;
  line-height: 1.5;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border);
}

.studio-issue .issue-slide {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-3);
  margin-right: 6px;
}

.studio-issue .issue-layout {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--accent);
  background: rgba(224,64,64,0.1);
  padding: 1px 6px;
  border-radius: 100px;
  margin-right: 8px;
}

.studio-issue.severity-error {
  border-left-color: var(--error);
}
.studio-issue.severity-warning {
  border-left-color: var(--warning);
}

.studio-issue .issue-icon {
  margin-right: 4px;
}
.studio-issue .issue-icon.err  { color: var(--error); }
.studio-issue .issue-icon.warn { color: var(--warning); }

/* Content inventory — compact table, alternating tints */
.studio-inventory {
  margin-top: 16px;
}

.studio-inv-slide {
  padding: 6px 10px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.studio-inv-slide:nth-child(odd) {
  background: rgba(255,255,255,0.02);
}

.studio-inv-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-3);
  width: 28px;
  flex-shrink: 0;
}

.studio-inv-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--text-3);
  background: var(--surface-2);
  padding: 2px 6px;
  border-radius: 100px;
}

/* ─── HELP OVERLAY — frosted glass card, two-column ─── */

.studio-help {
  position: fixed; inset: 0;
  background: rgba(12, 12, 14, 0.85);
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.studio-help.open {
  opacity: 1;
  pointer-events: auto;
}

.studio-help-inner {
  max-width: 520px;
  width: 90%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 36px 40px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.6);
}

.studio-help-title {
  font-family: 'Fraunces', serif;
  font-size: 28px;
  font-weight: 400;
  font-optical-sizing: auto;
  color: var(--text);
  margin-bottom: 4px;
}

.studio-help-subtitle {
  font-family: 'Outfit', sans-serif;
  font-size: 13px;
  color: var(--text-3);
  margin-bottom: 28px;
}

.studio-help-section {
  margin-bottom: 20px;
}

.studio-help-section-title {
  font-family: 'Outfit', sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 10px;
}

.studio-shortcut {
  display: flex;
  align-items: center;
  padding: 5px 0;
}

.studio-key {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border-2);
  border-radius: 4px;
  padding: 4px 12px;
  min-width: 72px;
  text-align: center;
  margin-right: 20px;
  flex-shrink: 0;
}

.studio-shortcut-desc {
  font-family: 'Outfit', sans-serif;
  font-size: 13px;
  color: var(--text-2);
}

/* ─── MODE INDICATOR ─── */

.studio-mode {
  position: fixed;
  top: 16px; left: 50%;
  transform: translateX(-50%);
  font-family: 'Outfit', sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-3);
  z-index: 500;
  user-select: none;
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;
}

.studio-mode.visible {
  opacity: 1;
}

/* ─── BACK LINK (top-left) ─── */

.studio-back {
  position: fixed;
  top: 16px; left: 20px;
  font-family: 'Outfit', sans-serif;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--text-3);
  text-decoration: none;
  z-index: 500;
  user-select: none;
  opacity: 0.5;
  transition: opacity 0.25s ease, color 0.25s ease;
}

.studio-back:hover {
  opacity: 1;
  color: var(--text);
}

/* ─── DECK TITLE (top-right in present mode) ─── */

.studio-deck-title {
  position: fixed;
  top: 16px; right: 20px;
  font-family: 'Outfit', sans-serif;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--text-3);
  z-index: 500;
  user-select: none;
  opacity: 0.35;
  transition: opacity 0.3s ease;
}

.studio-deck-title:hover { opacity: 0.8; }
`;
}

// ═══════════════════════════════════════════════════════
// STUDIO JS — viewer interactivity
// ═══════════════════════════════════════════════════════

function studioJS() {
  return `
(function() {
  'use strict';

  // ── State ──
  const slides = document.querySelectorAll('.studio-slide');
  const total = slides.length;
  let cur = 0;
  let mode = 'present'; // present | grid | qa
  let notesOpen = false;
  let helpOpen = false;
  let qaOpen = false;

  // ── DOM refs ──
  const stage = document.querySelector('.studio-stage');
  const viewport = document.querySelector('.studio-viewport');
  const progressBar = document.querySelector('.studio-progress-fill');
  const counter = document.querySelector('.studio-counter');
  const notesPanel = document.querySelector('.studio-notes');
  const notesBody = document.querySelector('.studio-notes-body');
  const gridOverlay = document.querySelector('.studio-grid');
  const qaPanel = document.querySelector('.studio-qa');
  const helpOverlay = document.querySelector('.studio-help');
  const modeIndicator = document.querySelector('.studio-mode');
  const gridCards = document.querySelectorAll('.studio-card');

  // ── Grid card scaling ──
  function scaleGridCards() {
    document.querySelectorAll('.studio-card-preview').forEach(function(preview) {
      var inner = preview.querySelector('.slide-scaled');
      if (!inner) return;
      var w = preview.clientWidth;
      var scale = w / 1280;
      inner.style.transform = 'scale(' + scale + ')';
    });
  }

  // ── Navigate ──
  function go(n) {
    if (n < 0 || n >= total) return;
    slides[cur].classList.remove('active');
    cur = n;
    slides[cur].classList.add('active');
    progressBar.style.width = ((cur + 1) / total * 100) + '%';
    counter.textContent = String(cur + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');

    // Update notes
    var noteEl = slides[cur].querySelector('.slide-notes');
    notesBody.textContent = noteEl ? noteEl.textContent : '(no notes for this slide)';

    // Update grid focus
    gridCards.forEach(function(c) { c.classList.remove('grid-active'); });
    if (gridCards[cur]) gridCards[cur].classList.add('grid-active');
  }

  // ── Mode indicator flash ──
  function flashMode(label) {
    modeIndicator.textContent = label;
    modeIndicator.classList.add('visible');
    clearTimeout(flashMode._t);
    flashMode._t = setTimeout(function() {
      modeIndicator.classList.remove('visible');
    }, 1200);
  }

  // ── Toggle Grid ──
  function toggleGrid() {
    if (mode === 'grid') {
      gridOverlay.classList.remove('open');
      mode = 'present';
      flashMode('PRESENT');
    } else {
      // Close QA if open
      if (qaOpen) { qaPanel.classList.remove('open'); stage.classList.remove('qa-open'); qaOpen = false; }
      gridOverlay.classList.add('open');
      mode = 'grid';
      flashMode('GRID');
      scaleGridCards();
      // Focus current card and scroll to it
      if (gridCards[cur]) {
        gridCards[cur].focus();
        setTimeout(function() {
          gridCards[cur].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      }
    }
  }

  // ── Toggle QA ──
  function toggleQA() {
    if (mode === 'grid') {
      gridOverlay.classList.remove('open');
      mode = 'present';
    }
    qaOpen = !qaOpen;
    qaPanel.classList.toggle('open', qaOpen);
    stage.classList.toggle('qa-open', qaOpen);
    flashMode(qaOpen ? 'QA' : 'PRESENT');
  }

  // ── Toggle Notes ──
  function toggleNotes() {
    notesOpen = !notesOpen;
    notesPanel.classList.toggle('open', notesOpen);
  }

  // ── Toggle Help ──
  function toggleHelp() {
    helpOpen = !helpOpen;
    helpOverlay.classList.toggle('open', helpOpen);
  }

  // ── Fullscreen ──
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function() {});
    } else {
      document.exitFullscreen();
    }
  }

  // ── Grid card click → open slide ──
  gridCards.forEach(function(card) {
    card.addEventListener('click', function() {
      var idx = parseInt(card.getAttribute('data-index'), 10);
      go(idx);
      gridOverlay.classList.remove('open');
      mode = 'present';
      flashMode('PRESENT');
    });
  });

  // ── Keyboard ──
  document.addEventListener('keydown', function(e) {
    // Help overlay captures Escape
    if (helpOpen) {
      if (e.key === 'Escape' || e.key === '?') { toggleHelp(); e.preventDefault(); }
      return;
    }

    // Grid mode navigation
    if (mode === 'grid') {
      var focused = document.activeElement;
      var focusIdx = -1;
      gridCards.forEach(function(c, i) { if (c === focused) focusIdx = i; });

      if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') {
        toggleGrid(); e.preventDefault(); return;
      }
      if (e.key === 'Enter' && focusIdx >= 0) {
        go(focusIdx); gridOverlay.classList.remove('open');
        mode = 'present'; flashMode('PRESENT'); e.preventDefault(); return;
      }
      // Arrow navigation in grid
      var cols = Math.floor(gridOverlay.querySelector('.studio-grid-cards').clientWidth / 300) || 3;
      var next = focusIdx;
      if (e.key === 'ArrowRight') next = Math.min(focusIdx + 1, total - 1);
      else if (e.key === 'ArrowLeft') next = Math.max(focusIdx - 1, 0);
      else if (e.key === 'ArrowDown') next = Math.min(focusIdx + cols, total - 1);
      else if (e.key === 'ArrowUp') next = Math.max(focusIdx - cols, 0);
      if (next !== focusIdx && next >= 0) {
        gridCards[next].focus();
        gridCards[next].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        e.preventDefault();
      }
      if (e.key === '?') { toggleHelp(); e.preventDefault(); }
      return;
    }

    // Present / QA mode keys
    switch (e.key) {
      case 'ArrowRight': case ' ': case 'PageDown':
        e.preventDefault(); go(cur + 1); break;
      case 'ArrowLeft': case 'PageUp':
        e.preventDefault(); go(cur - 1); break;
      case 'ArrowUp':
        e.preventDefault(); go(cur - 1); break;
      case 'ArrowDown':
        e.preventDefault(); go(cur + 1); break;
      case 'Home':
        e.preventDefault(); go(0); break;
      case 'End':
        e.preventDefault(); go(total - 1); break;
      case 'f': case 'F':
        toggleFullscreen(); break;
      case 'n': case 'N':
        toggleNotes(); break;
      case 'g': case 'G':
        toggleGrid(); break;
      case 'q': case 'Q':
        toggleQA(); break;
      case '?':
        toggleHelp(); e.preventDefault(); break;
      case 'Escape':
        if (notesOpen) toggleNotes();
        else if (qaOpen) toggleQA();
        break;
    }
  });

  // ── Touch / swipe ──
  var touchX = 0, touchY = 0;
  document.addEventListener('touchstart', function(e) {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (mode !== 'present') return;
    var dx = e.changedTouches[0].clientX - touchX;
    var dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      dx < 0 ? go(cur + 1) : go(cur - 1);
    }
  }, { passive: true });

  // ── Click navigation (present mode) ──
  viewport.addEventListener('click', function(e) {
    if (mode !== 'present') return;
    if (e.target.tagName === 'A') return;
    var rect = viewport.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width;
    if (x > 0.65) go(cur + 1);
    else if (x < 0.35) go(cur - 1);
  });

  // ── Resize handler ──
  window.addEventListener('resize', function() {
    if (mode === 'grid') scaleGridCards();
  });

  // ── Init ──
  go(0);
  scaleGridCards();
})();
`;
}

// ═══════════════════════════════════════════════════════
// GENERATE STUDIO HTML
// ═══════════════════════════════════════════════════════

async function generateStudio(inputPath, outputPath, options = {}) {
  const themeName = options.theme || "dark";
  const theme = THEMES[themeName] || THEMES.dark;
  const globalFont = options.font || "Helvetica Neue";

  const md = fs.readFileSync(inputPath, "utf-8");
  const slides = parseMarkdown(md);

  // ── Run QA analysis ──
  const qaResult = runQA(inputPath, { theme: themeName });
  const { a11yResults, layoutResults, design } = qaResult;
  const { scores, totalScore, maxScore } = design;
  const pct = Math.round((totalScore / maxScore) * 100);
  const grade =
    pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
  const gradeColor =
    grade === "A"
      ? "#40C080"
      : grade === "B"
      ? "#508CDC"
      : grade === "C"
      ? "#E0A040"
      : grade === "D"
      ? "#E07040"
      : "#E04040";

  const a11yErrors = a11yResults.filter((r) => r.severity === "error");
  const a11yWarnings = a11yResults.filter((r) => r.severity === "warning");
  const layoutErrors = layoutResults.filter((r) => r.severity === "error");
  const layoutWarnings = layoutResults.filter((r) => r.severity === "warning");

  // ── Build CSS custom properties for slides ──
  const cssVars = Object.entries({
    bg: theme.bg,
    "bg-alt": theme.bgAlt,
    "bg-dark": theme.bgDark,
    text: theme.text,
    "text-mid": theme.textMid,
    "text-light": theme.textLight,
    accent: theme.accent,
    "accent-light": theme.accentLight || theme.accent,
    accent2: theme.accent2,
    accent3: theme.accent3,
    accent4: theme.accent4,
    white: theme.white,
    black: theme.black,
    grey: theme.grey,
  })
    .map(([k, v]) => `--${k}:#${v}`)
    .join(";");

  // ── Build validation data per slide ──
  const slideData = slides.map((slide, idx) => {
    const layout = detectLayout(slide, idx, slides.length);

    // Gather QA issues for this slide
    const slideA11y = a11yResults.filter((r) => r.slide === idx + 1);
    const slideLayout = layoutResults.filter((r) => r.slide === idx + 1);
    const errs = [...slideA11y, ...slideLayout].filter(
      (r) => r.severity === "error"
    );
    const warns = [...slideA11y, ...slideLayout].filter(
      (r) => r.severity === "warning"
    );

    // Content inventory
    const content = [];
    if (slide.title) content.push("title");
    if (slide.subtitle) content.push("subtitle");
    if (slide.sectionLabel) content.push("label");
    if (slide.bullets.length) content.push(slide.bullets.length + " bullets");
    if (slide.body.length) content.push(slide.body.length + " body");
    if (slide.blockquote) content.push("quote");
    if (slide.tables.length) content.push(slide.tables.length + " table");
    if (slide.codeBlocks.length) content.push(slide.codeBlocks.length + " code");
    if (slide.images.length) content.push(slide.images.length + " image");
    if (slide.links.length) content.push(slide.links.length + " link");
    if (slide.notes) content.push("notes");
    if (slide.fontOverride) content.push("font:" + slide.fontOverride);
    if (slide.bgOverride) content.push("bg:#" + slide.bgOverride);

    return { slide, layout, errs, warns, content };
  });

  // ── Render slides for present mode ──
  const presentSlidesHTML = slideData
    .map((d, idx) => {
      const { slide, layout } = d;
      const renderer = HTML_LAYOUTS[layout] || HTML_LAYOUTS.split;

      // Per-slide style overrides
      const styleParts = [];

      // Apply slide-scoped layout CSS: padding, gap, font, etc.
      // The layout classes handle most styling, but we replicate the
      // inline overrides from raster.js generateHTML
      styleParts.push(`padding:5vmin`);
      styleParts.push(`gap:2vmin`);
      styleParts.push(`font-family:var(--font)`);
      styleParts.push(`color:var(--text)`);
      styleParts.push(`background:var(--bg-alt)`);

      if (slide.fontOverride) {
        styleParts.push(
          `font-family:'${esc(slide.fontOverride)}',var(--font)`
        );
      }
      if (slide.bgOverride) {
        styleParts.push(`background:#${slide.bgOverride}`);
        const adapted = adaptThemeForBg(theme, slide.bgOverride);
        if (adapted !== theme) {
          styleParts.push(`--text:#${adapted.text}`);
          styleParts.push(`--text-mid:#${adapted.textMid}`);
          styleParts.push(`--text-light:#${adapted.textLight}`);
          styleParts.push(`--accent:#${adapted.accent}`);
          styleParts.push(`--accent2:#${adapted.accent2}`);
          styleParts.push(`--accent3:#${adapted.accent3}`);
          styleParts.push(`--accent4:#${adapted.accent4}`);
        }
      }

      // Style overrides from <!-- style: ... -->
      if (slide.style) {
        const styleMap = {
          "title-size": (v) => `--title-size:${v}px`,
          "body-size": (v) => `--body-size:${v}px`,
          spacing: (v) =>
            `--slide-gap:${
              v === "tight"
                ? "0.5vmin"
                : v === "loose"
                ? "4vmin"
                : v === "none"
                ? "0"
                : v
            }`,
          padding: (v) =>
            `padding:${
              v === "none"
                ? "0"
                : v === "tight"
                ? "2vmin"
                : v === "loose"
                ? "8vmin"
                : v
            }`,
          opacity: (v) => `opacity:${v}`,
          align: (v) => `text-align:${v}`,
          "letter-spacing": (v) => `letter-spacing:${v}`,
          "text-transform": (v) => `text-transform:${v}`,
          color: (v) => `color:#${v.replace(/^#/, "")}`,
          invert: (v) => (v === "true" ? `filter:invert(1)` : ""),
        };
        for (const [k, v] of Object.entries(slide.style)) {
          const fn = styleMap[k];
          if (fn) {
            const r = fn(v);
            if (r) styleParts.push(r);
          } else {
            const val = /^[0-9A-Fa-f]{6}$/.test(v) ? `#${v}` : v;
            styleParts.push(`${k}:${val}`);
          }
        }
      }

      const style = styleParts.join(";");
      const slideNotesHTML = slide.notes
        ? `<div class="slide-notes" hidden>${esc(slide.notes)}</div>`
        : "";

      // Use designed renderer for slides with a design directive
      if (slide.design) {
        const designStyle = [];
        if (slide.design.bg) designStyle.push(`background:#${slide.design.bg.replace(/^#/, "")}`);
        if (slide.design.font) designStyle.push(`font-family:'${esc(slide.design.font)}',var(--font)`);
        designStyle.push(`color:var(--text)`);
        const ds = designStyle.join(";");
        return `<section class="studio-slide${idx === 0 ? " active" : ""}" data-index="${idx}" data-layout="designed">
  <div class="slide-content designed" style="${ds}">
    ${renderDesigned(slide)}
    ${slideNotesHTML}
  </div>
</section>`;
      }

      return `<section class="studio-slide${idx === 0 ? " active" : ""}" data-index="${idx}" data-layout="${layout}">
  <div class="slide-content layout-${layout}" style="${style}">
    ${renderer(slide)}
    ${slideNotesHTML}
  </div>
</section>`;
    })
    .join("\n");

  // ── Render grid cards ──
  const gridCardsHTML = slideData
    .map((d, idx) => {
      const { slide, layout, errs, warns } = d;
      const renderer = HTML_LAYOUTS[layout] || HTML_LAYOUTS.split;

      // Build scaled preview style
      const previewParts = [];
      previewParts.push(`padding:5vmin`);
      previewParts.push(`gap:2vmin`);
      previewParts.push(`font-family:var(--font)`);
      previewParts.push(`color:var(--text)`);
      previewParts.push(`background:var(--bg-alt)`);

      if (slide.fontOverride) {
        previewParts.push(
          `font-family:'${esc(slide.fontOverride)}',var(--font)`
        );
      }
      if (slide.bgOverride) {
        previewParts.push(`background:#${slide.bgOverride}`);
        const adapted = adaptThemeForBg(theme, slide.bgOverride);
        if (adapted !== theme) {
          previewParts.push(`--text:#${adapted.text}`);
          previewParts.push(`--text-mid:#${adapted.textMid}`);
          previewParts.push(`--text-light:#${adapted.textLight}`);
          previewParts.push(`--accent:#${adapted.accent}`);
          previewParts.push(`--accent2:#${adapted.accent2}`);
          previewParts.push(`--accent3:#${adapted.accent3}`);
          previewParts.push(`--accent4:#${adapted.accent4}`);
        }
      }

      if (slide.style) {
        const styleMap = {
          "title-size": (v) => `--title-size:${v}px`,
          "body-size": (v) => `--body-size:${v}px`,
          spacing: (v) =>
            `--slide-gap:${
              v === "tight"
                ? "0.5vmin"
                : v === "loose"
                ? "4vmin"
                : v === "none"
                ? "0"
                : v
            }`,
          padding: (v) =>
            `padding:${
              v === "none"
                ? "0"
                : v === "tight"
                ? "2vmin"
                : v === "loose"
                ? "8vmin"
                : v
            }`,
          opacity: (v) => `opacity:${v}`,
          align: (v) => `text-align:${v}`,
          "letter-spacing": (v) => `letter-spacing:${v}`,
          "text-transform": (v) => `text-transform:${v}`,
          color: (v) => `color:#${v.replace(/^#/, "")}`,
          invert: (v) => (v === "true" ? `filter:invert(1)` : ""),
        };
        for (const [k, v] of Object.entries(slide.style)) {
          const fn = styleMap[k];
          if (fn) {
            const r = fn(v);
            if (r) previewParts.push(r);
          } else {
            const val = /^[0-9A-Fa-f]{6}$/.test(v) ? `#${v}` : v;
            previewParts.push(`${k}:${val}`);
          }
        }
      }

      const previewStyle = previewParts.join(";");

      // Status (rendered as a coloured dot via CSS)
      const statusClass = errs.length > 0 ? "err" : warns.length > 0 ? "warn" : "ok";

      // QA badges
      const badges = [
        ...errs.map(
          (e) =>
            `<span class="studio-badge err">${esc(e.message).substring(0, 60)}</span>`
        ),
        ...warns.map(
          (w) =>
            `<span class="studio-badge warn">${esc(w.message).substring(0, 60)}</span>`
        ),
      ].join("");

      // Use designed renderer for slides with a design directive
      const isDesigned = !!slide.design;
      const cardClass = isDesigned ? "designed" : `layout-${layout}`;
      let cardStyle = previewStyle;
      if (isDesigned) {
        const designStyleParts = [];
        if (slide.design.bg) designStyleParts.push(`background:#${slide.design.bg.replace(/^#/, "")}`);
        if (slide.design.font) designStyleParts.push(`font-family:'${esc(slide.design.font)}',var(--font)`);
        designStyleParts.push(`color:var(--text);position:relative;overflow:hidden;padding:0`);
        cardStyle = designStyleParts.join(";");
      }
      const cardContent = isDesigned ? renderDesigned(slide) : renderer(slide);
      const cardLayoutLabel = isDesigned ? "designed" : layout;

      return `<div class="studio-card" data-index="${idx}" tabindex="0">
  <div class="studio-card-preview">
    <div class="slide-scaled ${cardClass}" style="${cardStyle}">
      ${cardContent}
    </div>
  </div>
  <div class="studio-card-info">
    <span class="studio-card-num">${String(idx + 1).padStart(2, "0")}</span>
    <span class="studio-card-layout" data-layout="${cardLayoutLabel}">${cardLayoutLabel}</span>
    <span class="studio-card-status ${statusClass}"></span>
  </div>
  ${badges ? `<div class="studio-card-badges">${badges}</div>` : ""}
</div>`;
    })
    .join("\n");

  // ── Build QA panel content ──
  function scoreBarHTML(name, s) {
    const p = Math.round((s.score / s.max) * 100);
    const cStart = p >= 80 ? "#40C080" : p >= 60 ? "#E0A040" : "#E04040";
    const cEnd   = p >= 80 ? "#50D898" : p >= 60 ? "#E8C060" : "#E86060";
    return `<div class="studio-score-row">
  <span class="studio-score-name">${name}</span>
  <div class="studio-score-bar-bg"><div class="studio-score-bar-fill" style="width:${p}%;background:linear-gradient(90deg,${cStart},${cEnd})"></div></div>
  <span class="studio-score-val">${s.score}/${s.max}</span>
</div>`;
  }

  const scoreNames = {
    layoutVariety: "Layout Variety",
    sectionRhythm: "Section Rhythm",
    contentDensity: "Content Density",
    typography: "Typography",
    speakerNotes: "Speaker Notes",
    contentTypes: "Content Types",
    visualRhythm: "Visual Rhythm",
  };

  const scoresHTML = Object.entries(scores)
    .map(([key, s]) => scoreBarHTML(scoreNames[key] || key, s))
    .join("\n");

  // All issues sorted by slide
  const allIssues = [...a11yResults, ...layoutResults].sort(
    (a, b) => (a.slide || 0) - (b.slide || 0)
  );
  const issuesHTML = allIssues
    .map((r) => {
      const icon =
        r.severity === "error"
          ? `<span class="issue-icon err">\u2716</span>`
          : `<span class="issue-icon warn">\u26A0</span>`;
      const loc =
        r.slide > 0
          ? `<span class="issue-slide">S${String(r.slide).padStart(2, "0")}</span><span class="issue-layout">${r.layout || ""}</span>`
          : `<span class="issue-slide">Deck</span>`;
      return `<div class="studio-issue severity-${r.severity}">
  ${icon}${loc}${esc(r.message)}
</div>`;
    })
    .join("\n");

  // Content inventory
  const inventoryHTML = slideData
    .map(
      (d, idx) =>
        `<div class="studio-inv-slide"><span class="studio-inv-num">${String(idx + 1).padStart(2, "0")}</span>${d.content.map((c) => `<span class="studio-inv-tag">${esc(c)}</span>`).join("")}</div>`
    )
    .join("\n");

  // ── Layout distribution for grid header ──
  const layoutCounts = {};
  slideData.forEach((d) => {
    layoutCounts[d.layout] = (layoutCounts[d.layout] || 0) + 1;
  });
  const layoutSummary = Object.entries(layoutCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([l, c]) => `${l}:${c}`)
    .join("  ");

  // ── QA data as embedded JSON (for extensibility) ──
  const qaJSON = JSON.stringify({
    grade,
    pct,
    totalScore,
    maxScore,
    a11yErrors: a11yErrors.length,
    a11yWarnings: a11yWarnings.length,
    layoutErrors: layoutErrors.length,
    layoutWarnings: layoutWarnings.length,
    scores,
    slideCount: slides.length,
  });

  const deckTitle = esc(path.basename(inputPath, path.extname(inputPath)));

  // ── Assemble final HTML ──
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${deckTitle} — Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Outfit:wght@100..900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
/* ── Slide layout system (from raster.js) ── */
:root{${cssVars};--font:'${globalFont}','Helvetica Neue',Helvetica,Arial,sans-serif}
${generateHTMLCSS()}

/* ── Override raster defaults for studio context ── */
body { background: var(--stage, #0C0C0E); overflow: hidden; }
.slide { display: flex; } /* undo display:none from raster default */
.slide.active { display: flex; } /* keep compatibility */
.deck { display: none; } /* we don't use the .deck wrapper */

/* ── Studio chrome ── */
${studioCSS()}

/* ── Slide-content inside studio inherits layout classes ── */
.studio-slide .slide-content {
  /* Reset the raster .slide positioning since we handle it */
  position: absolute; inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Ensure layout-specific flex direction is preserved */
.studio-slide .layout-title,
.studio-slide .layout-split,
.studio-slide .layout-rotated,
.studio-slide .layout-arc,
.studio-slide .layout-overlap { flex-direction: row; }

.studio-slide .layout-title { padding: 0; gap: 5vmin; }
.studio-slide .layout-split { padding: 5vmin; gap: 4vmin; }
.studio-slide .layout-rotated { padding: 0; }
.studio-slide .layout-section { justify-content: center; align-items: flex-start; padding: 5vmin 8vmin; }
.studio-slide .layout-arc { gap: 3vmin; }

/* Grid card previews: scale from 1280x720 */
.studio-card-preview .slide-scaled {
  /* raster slide defaults */
  font-family: var(--font);
  color: var(--text);
}

</style>
<script type="application/json" id="studio-qa-data">${qaJSON}</script>
</head>
<body>

<!-- ═══ PRESENT MODE: Stage + Viewport ═══ -->
<div class="studio-stage">
  <div class="studio-viewport">
    ${presentSlidesHTML}
  </div>
</div>

<!-- ═══ PROGRESS + COUNTER ═══ -->
<div class="studio-progress"><div class="studio-progress-fill"></div></div>
<div class="studio-counter">01 / ${String(slides.length).padStart(2, "0")}</div>
<div class="studio-mode"></div>
<a class="studio-back" href="../index.html">&larr; rastersysteme</a>
<div class="studio-deck-title">${deckTitle}</div>

<!-- ═══ SPEAKER NOTES ═══ -->
<div class="studio-notes">
  <div class="studio-notes-header">Speaker Notes</div>
  <div class="studio-notes-body">(no notes for this slide)</div>
</div>

<!-- ═══ GRID MODE ═══ -->
<div class="studio-grid">
  <div class="studio-grid-header">
    <span class="studio-grid-title">${deckTitle}</span>
    <span class="studio-grid-meta">${slides.length} slides &middot; ${layoutSummary}</span>
  </div>
  <div class="studio-grid-cards">
    ${gridCardsHTML}
  </div>
</div>

<!-- ═══ QA PANEL ═══ -->
<div class="studio-qa">
  <div class="studio-qa-inner">
    <div class="studio-qa-title">Quality Analysis</div>
    <div class="studio-qa-subtitle">${deckTitle} &middot; ${themeName} theme</div>

    <div class="studio-grade-container">
      <div class="studio-grade-letter" style="color:${gradeColor}">${grade}</div>
      <div class="studio-grade-details">
        <div class="studio-grade-score">${totalScore} / ${maxScore}</div>
        <div class="studio-grade-pct">${pct}% design quality</div>
      </div>
    </div>

    <div class="studio-qa-stats">
      <span class="studio-qa-stat">${slides.length} slides</span>
      <span class="studio-qa-stat ${a11yErrors.length ? "err" : "ok"}">${a11yErrors.length} a11y errors</span>
      <span class="studio-qa-stat ${a11yWarnings.length ? "warn" : "ok"}">${a11yWarnings.length} a11y warnings</span>
      <span class="studio-qa-stat ${layoutErrors.length ? "err" : "ok"}">${layoutErrors.length} layout errors</span>
      <span class="studio-qa-stat ${layoutWarnings.length ? "warn" : "ok"}">${layoutWarnings.length} layout warnings</span>
    </div>

    <div class="studio-score-section">
      <div class="studio-score-label">Design Quality Scores</div>
      ${scoresHTML}
    </div>

    <div class="studio-score-section">
      <div class="studio-score-label">Issues (${allIssues.length})</div>
      ${issuesHTML || '<div style="font-size:12px;color:var(--studio-success);">\u2714 No issues found</div>'}
    </div>

    <div class="studio-score-section">
      <div class="studio-score-label">Content Inventory</div>
      <div class="studio-inventory">
        ${inventoryHTML}
      </div>
    </div>
  </div>
</div>

<!-- ═══ HELP OVERLAY ═══ -->
<div class="studio-help">
  <div class="studio-help-inner">
    <div class="studio-help-title">Keyboard Shortcuts</div>
    <div class="studio-help-subtitle">rastersysteme studio viewer</div>

    <div class="studio-help-section">
      <div class="studio-help-section-title">Navigation</div>
      <div class="studio-shortcut"><span class="studio-key">&rarr; / Space</span><span class="studio-shortcut-desc">Next slide</span></div>
      <div class="studio-shortcut"><span class="studio-key">&larr;</span><span class="studio-shortcut-desc">Previous slide</span></div>
      <div class="studio-shortcut"><span class="studio-key">Home</span><span class="studio-shortcut-desc">First slide</span></div>
      <div class="studio-shortcut"><span class="studio-key">End</span><span class="studio-shortcut-desc">Last slide</span></div>
    </div>

    <div class="studio-help-section">
      <div class="studio-help-section-title">Modes</div>
      <div class="studio-shortcut"><span class="studio-key">G</span><span class="studio-shortcut-desc">Grid overview</span></div>
      <div class="studio-shortcut"><span class="studio-key">Q</span><span class="studio-shortcut-desc">QA analysis panel</span></div>
      <div class="studio-shortcut"><span class="studio-key">N</span><span class="studio-shortcut-desc">Speaker notes</span></div>
      <div class="studio-shortcut"><span class="studio-key">F</span><span class="studio-shortcut-desc">Fullscreen</span></div>
      <div class="studio-shortcut"><span class="studio-key">?</span><span class="studio-shortcut-desc">This help overlay</span></div>
      <div class="studio-shortcut"><span class="studio-key">Esc</span><span class="studio-shortcut-desc">Close panel / overlay</span></div>
    </div>

    <div class="studio-help-section">
      <div class="studio-help-section-title">Grid Mode</div>
      <div class="studio-shortcut"><span class="studio-key">Arrows</span><span class="studio-shortcut-desc">Navigate cards</span></div>
      <div class="studio-shortcut"><span class="studio-key">Enter</span><span class="studio-shortcut-desc">Open slide in present mode</span></div>
    </div>
  </div>
</div>

<script>
${studioJS()}
</script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, "utf-8");

  return {
    slides: slides.length,
    output: outputPath,
    theme: themeName,
    grade,
    score: `${totalScore}/${maxScore}`,
  };
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  studio — precision viewer for rastersysteme decks

  Usage:
    node studio.js <input.md> [output.html] [options]

  Options:
    --theme <name>    Theme: dark (default), light, red, blue
    --font <name>     Global font override
    --help            Show this help

  Modes (in viewer):
    PRESENT           Full-screen edge-to-edge (default)
    GRID    (G)       Thumbnail overview with validation
    QA      (Q)       Side panel with design quality analysis

  Keys: arrows/space, Home/End, F=fullscreen, N=notes,
        G=grid, Q=qa, ?=help, Esc=close
    `);
    process.exit(0);
  }

  const input = args[0];
  const getFlag = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  // Output path: second positional arg, or derive from input
  let output = args[1] && !args[1].startsWith("--") ? args[1] : null;
  if (!output) {
    output = input.replace(/\.(composed\.)?md$/, ".studio.html");
  }

  const themeName = getFlag("--theme") || "dark";
  const font = getFlag("--font");

  if (!fs.existsSync(input)) {
    console.error("Error: File not found: " + input);
    process.exit(1);
  }

  generateStudio(input, output, { theme: themeName, font })
    .then((result) => {
      console.log(
        `Studio: ${result.slides} slides, grade ${result.grade} (${result.score}), theme ${result.theme}`
      );
      console.log(`Output: ${result.output}`);
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}

module.exports = { generateStudio };
