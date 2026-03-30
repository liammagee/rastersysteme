<!-- design: {"zones":[{"role":"title","col":4,"span":32,"row":1,"rowSpan":6},{"role":"body","col":4,"span":24,"row":8,"rowSpan":12},{"role":"bullets","col":4,"span":24,"row":21,"rowSpan":18}],"accents":[{"type":"line","col":30,"span":1,"row":1,"rowSpan":38,"color":"6B7F5E"},{"type":"dot","col":32,"span":1,"row":2,"rowSpan":1,"color":"A0522D"},{"type":"dot","col":32,"span":1,"row":38,"rowSpan":1,"color":"A0522D"}],"typography":{"title":{"size":36,"weight":700},"body":{"size":13,"leading":1.4},"bullets":{"size":12,"leading":1.35}},"bg":"EDE4D3","font":"Courier New"} -->
<!-- image: right 35 -->
### CASE STUDY
## Drawing a Long Bow": From Ballistics to AI

 - Without drag - how do we calculate motion of an object?
 - Parabola - models a curved symmetrical movment. One time calculation using geometry, algebra and trigonometry (sine / cosine )
   - Can handle *gravity* - constant downward acceleration
   - **side question: what level mathematics?**
 - But what really happens? We throw a stone / launch a missile
   - Stones / arrows etc - looks like a Gallilean parabola   
   - Gunpowder - greater **velocity** means greater **drag** - less and less symmetrical
   - Acceleration changes every instant - requiring constant recalculation - usually no single neat "closed solution" - instead approximation
     - Break problem into little discrete arithmetic steps - what computers do

---

<!-- design: {"zones":[{"role":"title","col":30,"span":26,"row":4,"rowSpan":6},{"role":"quote","col":8,"span":40,"row":14,"rowSpan":14},{"role":"body","col":30,"span":26,"row":30,"rowSpan":6}],"accents":[{"type":"bar","col":6,"span":1,"row":14,"rowSpan":14,"color":"A0522D"},{"type":"dot","col":48,"span":1,"row":12,"rowSpan":1,"color":"C4956A"}],"typography":{"title":{"size":52,"weight":700,"color":"F5F0E6"},"quote":{"size":18,"weight":400,"leading":1.7,"color":"F2EDE4","tracking":"0.01em"},"body":{"size":13,"color":"8B7355"}},"bg":"2A2A28","font":"Palatino"} -->
## Practice

[Early Ballistic Computer Simulation](https://liammagee.github.io/rastersysteme/pages/ballistic-computer-sim.html)

> Side note: "Make me a simple simulation that shows how the first computers were used to solve problems of derivatives for missiles" (Also bear in mind for assessment)

---

<!-- design: {"zones":[{"role":"title","col":26,"span":30,"row":2,"rowSpan":6},{"role":"body","col":26,"span":28,"row":9,"rowSpan":14},{"role":"bullets","col":26,"span":28,"row":24,"rowSpan":15}],"accents":[{"type":"line","col":24,"span":1,"row":1,"rowSpan":38,"color":"4A5D4A"},{"type":"dot","col":26,"span":1,"row":1,"rowSpan":1,"color":"8B7355"}],"typography":{"title":{"size":44,"weight":600},"body":{"size":12,"leading":1.4},"bullets":{"size":12,"leading":1.3}},"bg":"F5F0E6","font":"Palatino"} -->
<!-- image: left 30 -->
## Thought experiment: Throwing a Stone

So let's throw a stone; we have essentially (simplistically) 4 variables:
 - angle of release
 - velocity (metres/yards per second)
 - gravity (wants to pull the stone back to ground)
 - drag (air resistance; varies with velocity, meaning we need to **calculate as we go** - not an analytic solution)
 - So we now need fancy (17th century and beyond) math:
   - Euler's method (following Newton / Leibniz): decompose the entire stone's thrown into a sequence:
     - Step 1: x, y, velocity x, velocity y
     - Step 2: new x, new y -> then new velocity x, new velocity y
     - etc...

Can be done by hand, but each angle + velocity needs a new set of values...
New problems: mass, shape of stone (etc. etc)
 - Euler: 1760s
 - Runge–Kutta Corrections: 1890s/1900s
 - Initial computation: Euler method (1940s); Runge–Kutta (late 1940s/50s) ...

---

<!-- design: {"zones":[{"role":"title","col":4,"span":28,"row":4,"rowSpan":8},{"role":"body","col":4,"span":30,"row":14,"rowSpan":22}],"accents":[{"type":"line","col":2,"span":1,"row":4,"rowSpan":32,"color":"6B7F5E"},{"type":"line","col":4,"span":20,"row":13,"rowSpan":1,"color":"A0522D"}],"typography":{"title":{"size":44,"weight":700},"body":{"size":15,"leading":1.6}},"bg":"F2EDE4","font":"Palatino"} -->
<!-- image: right 35 -->
## Relevance to Education

Now think about education as a parallael historical process. 

For military purposes, we need trigonometry, calculus, physics, ordinary differential equations...

The "computer" pre-1940s: a person calculating these trajectories (a "computer")

Governmental, Industrial, Military uses: need a ready workforce of "calculaters", "computers", "coders".

Curriculum: shaped by the growing need to throw stones (and other applications of calculus)

Then no longer just *how to compute* but also *how to build computers* (electrical engineering, hardware, software etc).

---

<!-- design: {"zones":[{"role":"body","col":8,"span":44,"row":4,"rowSpan":14},{"role":"bullets","col":8,"span":40,"row":20,"rowSpan":16}],"accents":[{"type":"line","col":6,"span":1,"row":3,"rowSpan":34,"color":"4A5D4A"},{"type":"dot","col":54,"span":1,"row":36,"rowSpan":1,"color":"C4956A"}],"typography":{"body":{"size":14,"leading":1.55},"bullets":{"size":14,"leading":1.5}},"bg":"2A2A28","font":"Palatino"} -->
For those mathematically / philosophically minded:

 - Much of AI-related - and general - computing from 1940s to 2020s involves mapping continuous (derivates) into discrete (very small differences). At least as far as *simulation* (from ballistics to language generation) are concerned.
 - Note *analog* (non digital) calculators can compute continuities directly! Arguably what biological brains also do - open for debate. 
 - Continuous > discrete is always "lossy" - loses definition. Think about how early pixels used RGB - so many values for red, green, blue. Detail, naunce is lost. Is digitization - conversion of continuous to discrete - an approximation but never realization of the real thing? (see interview with Yann LeCun next week).