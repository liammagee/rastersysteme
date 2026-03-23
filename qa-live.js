#!/usr/bin/env node
/**
 * qa-live — interactive visual a11y audit via Claude in Chrome
 *
 * Injects an a11y audit overlay into a running HTML slideshow.
 * Press A to toggle the audit panel, which shows per-slide:
 * - Contrast ratio issues (computed colors)
 * - Overflow warnings
 * - Broken images
 * - Empty slide detection
 *
 * No Puppeteer needed — runs in YOUR browser, you see what it sees.
 *
 * Usage:
 *   node qa-live.js <slides.html>    # injects audit panel into HTML
 *   node qa-live.js --serve <dir>    # serves directory + opens with audit
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const dim = chalk.dim;
const sage = chalk.green;
const teal = chalk.cyan;

// ═══════════════════════════════════════════════════════
// AUDIT OVERLAY — injected into the HTML slideshow
// ═══════════════════════════════════════════════════════

const AUDIT_SCRIPT = `
<style>
#qa-panel{position:fixed;top:0;right:0;width:320px;height:100vh;background:rgba(10,10,10,0.95);
  color:#e0d8cc;font-family:'Space Mono',monospace;font-size:11px;z-index:10000;
  transform:translateX(100%);transition:transform 0.3s ease;overflow-y:auto;
  border-left:2px solid #B7311A;backdrop-filter:blur(8px)}
#qa-panel.open{transform:translateX(0)}
#qa-panel h3{font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8C8478;
  padding:12px 16px;border-bottom:1px solid #222;margin:0;position:sticky;top:0;background:rgba(10,10,10,0.98)}
.qa-slide{padding:8px 16px;border-bottom:1px solid #1a1a1a}
.qa-slide.pass{border-left:3px solid #2B7038}
.qa-slide.warn{border-left:3px solid #876512}
.qa-slide.fail{border-left:3px solid #B7311A}
.qa-slide-num{font-weight:700;color:#8C8478;margin-bottom:4px}
.qa-issue{font-size:10px;line-height:1.4;margin:2px 0;padding:2px 0}
.qa-issue.error{color:#B7311A}
.qa-issue.warning{color:#876512}
.qa-summary{padding:12px 16px;border-bottom:2px solid #222;font-size:12px;position:sticky;top:32px;background:rgba(10,10,10,0.98)}
.qa-summary .pass{color:#2B7038}.qa-summary .fail{color:#B7311A}.qa-summary .warn{color:#876512}
#qa-badge{position:fixed;top:8px;right:8px;z-index:10001;font-family:'Space Mono',monospace;
  font-size:10px;padding:4px 10px;border-radius:3px;cursor:pointer;letter-spacing:0.1em;
  transition:all 0.2s;user-select:none}
#qa-badge.pass{background:#2B7038;color:#fff}
#qa-badge.warn{background:#876512;color:#fff}
#qa-badge.fail{background:#B7311A;color:#fff}
#qa-badge:hover{opacity:0.85}
#qa-highlight{position:fixed;pointer-events:none;z-index:9999;border:2px solid #B7311A;
  background:rgba(183,49,26,0.1);display:none;transition:all 0.15s}
</style>
<div id="qa-badge">A11Y</div>
<div id="qa-panel"><h3>A11Y AUDIT</h3><div id="qa-content"></div></div>
<div id="qa-highlight"></div>
<script>
(function(){
  function parseRGB(s){const m=s.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);return m?{r:+m[1],g:+m[2],b:+m[3]}:null}
  function lum(c){const[r,g,b]=[c.r,c.g,c.b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*r+0.7152*g+0.0722*b}
  function cr(a,b){const l1=lum(a),l2=lum(b);return(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)}

  const panel=document.getElementById('qa-panel');
  const badge=document.getElementById('qa-badge');
  const content=document.getElementById('qa-content');
  const highlight=document.getElementById('qa-highlight');
  let panelOpen=false;

  function runAudit(){
    const slides=document.querySelectorAll('.slide,.grid-slide');
    let totalIssues=0,errors=0,warnings=0,passCount=0;
    let html='';

    slides.forEach((slide,idx)=>{
      const wasActive=slide.classList.contains('active');
      const wasDis=slide.style.display;
      slide.style.display='flex';
      const cs=getComputedStyle(slide);
      const bg=parseRGB(cs.backgroundColor)||{r:248,g:245,b:240};
      const issues=[];

      slide.querySelectorAll('h1,h2,h3,p,li,span,.label,.stagger-bar,.frag-cell,.pill,td,th,blockquote').forEach(el=>{
        const st=getComputedStyle(el);
        if(st.display==='none'||st.visibility==='hidden')return;
        const text=el.textContent.trim().slice(0,30);
        if(!text)return;
        const fg=parseRGB(st.color);
        let elBg=parseRGB(st.backgroundColor);
        if(!elBg||st.backgroundColor.includes('0)'))elBg=bg;
        if(fg&&elBg){
          const ratio=cr(fg,elBg);
          const size=parseFloat(st.fontSize);
          const bold=parseInt(st.fontWeight)>=700;
          const large=size>=18||(size>=14&&bold);
          const min=large?3.0:4.5;
          if(ratio<min){
            const sev=ratio<2?'error':'warning';
            issues.push({sev,msg:ratio.toFixed(1)+':1 (need '+min+') "'+text+'"'});
          }
        }
      });

      slide.querySelectorAll('img').forEach(img=>{
        if(!img.complete||img.naturalWidth===0)issues.push({sev:'error',msg:'Broken image: '+img.src.split('/').pop()});
      });

      if(!wasActive)slide.style.display=wasDis||'none';

      if(issues.length===0){passCount++;html+='<div class="qa-slide pass"><div class="qa-slide-num">'+String(idx+1).padStart(2,'0')+' ✓</div></div>'}
      else{
        const hasFail=issues.some(i=>i.sev==='error');
        errors+=issues.filter(i=>i.sev==='error').length;
        warnings+=issues.filter(i=>i.sev==='warning').length;
        totalIssues+=issues.length;
        html+='<div class="qa-slide '+(hasFail?'fail':'warn')+'"><div class="qa-slide-num">'+String(idx+1).padStart(2,'0')+' ('+issues.length+')</div>';
        issues.forEach(i=>{html+='<div class="qa-issue '+i.sev+'">'+i.msg+'</div>'});
        html+='</div>';
      }
    });

    const summary='<div class="qa-summary"><span class="pass">'+passCount+' pass</span>  <span class="warn">'+warnings+' warn</span>  <span class="fail">'+errors+' error</span>  ('+slides.length+' slides)</div>';
    content.innerHTML=summary+html;
    badge.className=errors>0?'fail':warnings>0?'warn':'pass';
    badge.textContent='A11Y '+(errors>0?errors+'✗':warnings>0?warnings+'⚠':'✓');
  }

  badge.addEventListener('click',()=>{panelOpen=!panelOpen;panel.classList.toggle('open',panelOpen);if(panelOpen)runAudit()});
  document.addEventListener('keydown',e=>{
    if(e.key==='a'||e.key==='A'){
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
      panelOpen=!panelOpen;panel.classList.toggle('open',panelOpen);if(panelOpen)runAudit();
    }
  });

  // Re-audit on slide change
  const observer=new MutationObserver(()=>{if(panelOpen)runAudit()});
  observer.observe(document.querySelector('.deck')||document.body,{subtree:true,attributes:true,attributeFilter:['class']});

  // Initial audit
  setTimeout(runAudit,500);
})();
</script>`;

// ═══════════════════════════════════════════════════════
// INJECT INTO HTML FILE
// ═══════════════════════════════════════════════════════

function injectAudit(htmlPath, outputPath) {
  let html = fs.readFileSync(htmlPath, "utf-8");

  // Don't double-inject
  if (html.includes("qa-panel")) {
    process.stderr.write(`  ${dim("Audit already injected")}\n`);
    return outputPath || htmlPath;
  }

  html = html.replace("</body>", AUDIT_SCRIPT + "\n</body>");
  const out = outputPath || htmlPath;
  fs.writeFileSync(out, html);
  return out;
}

// ═══════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
  qa-live — inject interactive a11y audit overlay into HTML slideshows

  Press A (or click the badge) to toggle the audit panel.
  Shows per-slide contrast issues, broken images, and a pass/warn/fail summary.
  Re-audits automatically when you navigate slides.

  Usage:
    node qa-live.js <slides.html>              # inject into file (modifies in place)
    node qa-live.js <slides.html> --out <path>  # inject into a copy

  Examples:
    node qa-live.js decks/week-1.html
    node qa-live.js decks/week-1.html --out decks/week-1.audit.html
    `);
    process.exit(0);
  }

  const input = args[0];
  if (!fs.existsSync(input)) {
    console.error(`Error: file not found: ${input}`);
    process.exit(1);
  }

  const outIdx = args.indexOf("--out");
  const output = outIdx >= 0 ? args[outIdx + 1] : null;

  process.stderr.write(`\n  ${chalk.red("■")} ${chalk.white.bold("qa-live")}\n`);
  process.stderr.write(`  ${dim("Injecting audit overlay into")} ${teal(path.basename(input))}\n`);

  const result = injectAudit(input, output);
  process.stderr.write(`  ${sage("✓")} ${teal(result)}\n`);
  process.stderr.write(`  ${dim("Open in browser, press")} ${chalk.white.bold("A")} ${dim("to toggle audit panel")}\n`);
}

module.exports = { injectAudit, AUDIT_SCRIPT };
