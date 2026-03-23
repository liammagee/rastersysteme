---
description: Run a visual accessibility audit on an HTML slideshow using Claude in Chrome
---

Run an interactive visual accessibility audit on an HTML slideshow using Chrome browser automation.

The user may provide a file path as an argument (e.g., `/qa-visual decks/week-1.html`).
If no argument, ask which HTML file to audit.

## Steps

### 1. Connect to Chrome

Use `mcp__claude-in-chrome__tabs_context_mcp` to get available tabs.
If the slideshow is already open, use that tab.
Otherwise create a new tab with `mcp__claude-in-chrome__tabs_create_mcp` and navigate to `http://localhost:8701/<path>`.

If connection fails, tell the user to:
- Ensure Chrome is open (not Arc/Brave)
- Click the Claude extension icon and connect
- Run `npm run serve` if the local server isn't running

### 2. Screenshot the current slide

Use `mcp__claude-in-chrome__computer` with `action: "screenshot"` to capture the current state.
Show it to the user so they can see what you see.

### 3. Run the a11y audit

Execute this JavaScript via `mcp__claude-in-chrome__javascript_tool`:

```javascript
(function() {
  const slides = document.querySelectorAll('.slide,.grid-slide');
  const total = slides.length;
  function parseRGB(s){const m=s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?{r:+m[1],g:+m[2],b:+m[3]}:null}
  function lum(c){const[r,g,b]=[c.r,c.g,c.b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*r+0.7152*g+0.0722*b}
  function cr(a,b){const l1=lum(a),l2=lum(b);return(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)}
  const report=[];let passCount=0;
  slides.forEach((slide,idx)=>{
    const wasActive=slide.classList.contains('active');slide.style.display='flex';
    const cs=getComputedStyle(slide);const bg=parseRGB(cs.backgroundColor)||{r:248,g:245,b:240};const issues=[];
    slide.querySelectorAll('h1,h2,h3,p,li,span,.label,.stagger-bar,.frag-cell,.pill,td,th,blockquote').forEach(el=>{
      const st=getComputedStyle(el);if(st.display==='none'||st.visibility==='hidden')return;
      const text=el.textContent.trim().slice(0,30);if(!text)return;
      const fg=parseRGB(st.color);let elBg=parseRGB(st.backgroundColor);
      if(!elBg||st.backgroundColor.includes('0)'))elBg=bg;
      if(fg&&elBg){const ratio=cr(fg,elBg);const size=parseFloat(st.fontSize);const bold=parseInt(st.fontWeight)>=700;
        const large=size>=18||(size>=14&&bold);const min=large?3.0:4.5;
        if(ratio<min)issues.push({sev:ratio<2?'error':'warning',msg:ratio.toFixed(1)+':1 (need '+min+') "'+text+'"'})}});
    slide.querySelectorAll('img').forEach(img=>{if(!img.complete||img.naturalWidth===0)issues.push({sev:'error',msg:'Broken: '+img.src.split('/').pop()})});
    if(!wasActive)slide.style.display='none';
    if(issues.length>0)report.push({s:idx+1,issues});else passCount++});
  return JSON.stringify({total,pass:passCount,fail:report.length,slides:report},null,2);
})()
```

### 4. Screenshot problem slides

For each slide with errors, navigate to it and screenshot:

```javascript
const slides = document.querySelectorAll('.slide,.grid-slide');
slides.forEach((s,i) => { s.classList.toggle('active', i===N); s.style.display = i===N ? 'flex' : 'none'; });
```

Then screenshot with `mcp__claude-in-chrome__computer`.

### 5. Report

Summarize:
- Total slides, pass/warn/fail counts
- Per-slide issues with severity
- Screenshots of worst offenders
- Specific fix recommendations (theme colors, bg overrides, etc.)

### 6. Offer fixes

If issues are found, offer to fix:
- Theme colors in `raster.js` (THEMES object)
- Specific `<!-- bg: -->` overrides in composed markdown
- Then re-render with `node raster.js` and re-audit
