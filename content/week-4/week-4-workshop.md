# Gen AI - Week 4 - Concentric Loops: Iterating with AI

## Workshop: Building a Self-Improving Design Pipeline with Claude

---

### What We'll Build Today

A three-loop iteration system where:
- **You** provide the content and aesthetic direction
- **Claude** composes, renders, and evaluates the design
- **Together** you calibrate what "good" means — and that calibration itself improves over time

---

### The Three Loops

```
OUTER-OUTER: "Is our process of evaluating design itself improving?"
  └── OUTER: "Does the rubric match what I actually see?"
        └── INNER: "Make the scores go up."
```

Think of concentric circles — the inner loop spins fast (minutes), the outer loop spins slower (per session), the outer-outer loop evolves across weeks.

---

### Loop 1: The Inner Loop (Automated)

The machine does this on its own:

1. **Evaluate** — run the rubric against the rendered deck
2. **Identify weaknesses** — which dimensions score lowest?
3. **Fix** — edit design directives targeting the weak dimensions
4. **Re-render** — generate new HTML
5. **Re-evaluate** — did the scores improve?
6. **Repeat** until scores plateau

In Claude Code: `/loop 2m /refine-step decks/my-deck.html`

---

### Loop 2: The Outer Loop (Human + Machine)

You do this with Claude:

1. **Look at the deck** — screenshot every slide
2. **Tell Claude what you see** — "overlapping text on slide 7", "too much whitespace on slide 20"
3. **Compare to scores** — the rubric said 98%! But you see problems.
4. **Fix the rubric** — add checks for the issues you identified
5. **Re-evaluate** — does the rubric now agree with your eyes?
6. **Run the inner loop again** — with the calibrated rubric

The key insight: **the rubric serves your eyes, not the other way around.**

---

### Loop 3: The Outer-Outer Loop (Meta)

Across sessions, you notice patterns:

- "I keep having to tell Claude about overlapping zones"
- "The rubric always misses whitespace problems"
- "Composition keeps putting tables in body zones"

These become **methodology improvements**:
- Add zone collision detection to the rubric permanently
- Add visual utilization metrics
- Fix the renderer's content routing

The outer-outer loop is **the system learning to learn**.

---

### Practice: Set Up Your Pipeline

1. **Source content** — write or choose a markdown file with slides

```bash
ls content/week-*/
```

2. **Compose** — Claude designs the grid layouts

```bash
node compose.js content/your-topic/source.md decks/your-deck.composed.md --model opus
```

3. **Render** — generate HTML

```bash
# Write render script (never use node -e)
cat > /tmp/render.js << 'EOF'
const r = require('./raster.js');
r.generateHTML('decks/your-deck.composed.md', 'decks/your-deck.html');
console.log('OK');
EOF
node /tmp/render.js
```

4. **Splice images** — add generated visuals

```bash
node splice-images.js decks/your-deck.html decks/your-deck.composed-images/
```

5. **Evaluate** — run the rubric

```bash
node run-rubric-eval.js decks/your-deck.spliced.html --screenshots-all --json
```

6. **Compare wireframe to screenshot**

```bash
node wireframe.js decks/your-deck.composed.md --slide 7
# Then look at /tmp/rubric-screenshots/slide-07.png
```

---

### Practice: Run the Inner Loop

```bash
# One manual step:
/refine-step decks/your-deck.spliced.html

# Or autonomous:
/loop 2m /refine-step decks/your-deck.spliced.html
```

Watch the scores converge. Note what the rubric catches and what it misses.

---

### Practice: Run the Outer Loop

Look at the screenshots. Ask yourself:

- Are the images visible?
- Is there overlapping text?
- Which slides look weakest?
- Does the design match the brief?

Now tell Claude what you see. Watch as:
1. Claude adds checks to the rubric for your feedback
2. The rubric score drops (it's now catching real issues)
3. Claude fixes the design to address the new checks
4. The score recovers — but honestly this time

---

### Practice: The Outer-Outer Loop

After running the outer loop a few times, notice:

- What kinds of issues do you keep reporting?
- What rubric checks keep producing false positives?
- What aspects of "good design" are fundamentally unmeasurable by automation?

Document these in METHODOLOGY.md. Each observation becomes a permanent improvement to the system.

---

### Key Concepts

**Goodhart's Law**: "When a measure becomes a target, it ceases to be a good measure."

The inner loop makes the rubric score go up. But if the rubric is wrong, you're optimizing toward the wrong target. The outer loop ensures the rubric stays honest.

---

### Key Concepts

**Cybernetics (from Week 2!)**: The system observing and correcting itself.

- Inner loop: first-order feedback (adjust the design)
- Outer loop: second-order feedback (adjust the evaluation)
- Outer-outer loop: third-order feedback (adjust how we adjust the evaluation)

Norbert Wiener would recognize this as recursive self-regulation.

---

### Key Concepts

**Co-intelligence (Mollick)**: Human and AI each doing what they're best at.

- AI is best at: fast iteration, metric collection, pattern application
- Human is best at: judging visual quality, identifying blind spots, defining "good"
- Together: the human calibrates, the AI iterates

---

### The Dangerous 100%

Our rubric scored 100% on decks with:
- Overlapping text
- Missing images
- 80% whitespace slides
- Generic placeholder alt text

**A confident wrong answer is worse than an uncertain right one.**

The process of making the rubric honest — from 100% down to 57% — was more valuable than any design fix.

---

### Your Turn

1. Pick a topic. Write 10 slides in markdown.
2. Run the full pipeline: compose → render → splice → evaluate
3. Look at the deck. What does the rubric miss?
4. Tell Claude. Watch the rubric evolve.
5. Document what you learned about the gap between metrics and perception.

---

### Discussion

- When is automated evaluation sufficient? When is human judgment essential?
- Can the outer-outer loop ever close? (Can we fully automate "what good looks like"?)
- What other domains could use concentric feedback loops?
- How does this relate to assessment in education — rubrics that grade, but who grades the rubric?

---

### Next Week: Deeper into the Black Box

We'll look at the AI models themselves — how they generate, what they "know", and what happens when we push them to evaluate their own output.

[cgscholar.com](https://cgscholar.com/posts/1200?communityId=141)
