<!-- design: {"zones":[{"role":"body","col":14,"span":32,"row":14,"rowSpan":10}],"accents":[{"type":"dot","col":12,"span":1,"row":18,"rowSpan":1,"color":"A0522D"},{"type":"dot","col":48,"span":1,"row":16,"rowSpan":1,"color":"8B7355"},{"type":"line","col":14,"span":28,"row":13,"rowSpan":1,"color":"C4956A"}],"typography":{"body":{"size":16,"leading":"1.8","align":"center"}},"bg":"EDE4D3","font":"Palatino"} -->
<!-- image: background 100 -->
People likely know the famous first examples of computers for solving decryption. A kind of "safe" version of the origins of computing: the Nazis, evil, encrypted messages, the Allies, good, decrypted them. Then onto IBM, Apple, Microsoft!

But what of their other use? Ballistics, missile trajectory...

---

<!-- design: {"zones":[{"role":"title","col":4,"span":32,"row":2,"rowSpan":8},{"role":"bullets","col":4,"span":30,"row":11,"rowSpan":16},{"role":"body","col":4,"span":32,"row":28,"rowSpan":10}],"accents":[{"type":"line","col":2,"span":1,"row":2,"rowSpan":36,"color":"6B7F5E"},{"type":"dot","col":36,"span":1,"row":4,"rowSpan":1,"color":"A0522D"}],"typography":{"title":{"size":36,"weight":700},"body":{"size":13}},"bg":"F5F0E6","font":"Courier New"} -->
<!-- image: right 28 -->
### BALLISTICS
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

<!-- design: {"zones":[{"role":"title","col":10,"span":40,"row":10,"rowSpan":8},{"role":"quote","col":14,"span":32,"row":20,"rowSpan":8},{"role":"body","col":14,"span":32,"row":30,"rowSpan":4}],"accents":[{"type":"bar","col":0,"span":3,"row":0,"rowSpan":40,"color":"4A5D4A"},{"type":"bar","col":57,"span":3,"row":0,"rowSpan":40,"color":"4A5D4A"}],"typography":{"title":{"size":52,"weight":700,"color":"F5F0E6","tracking":"0.02em"},"quote":{"size":18,"weight":400,"leading":"1.7","color":"C4956A"},"body":{"size":14,"color":"EDE4D3"}},"bg":"2A2A28","font":"Palatino"} -->
## Practice

[Early Ballistic Computer Simulation](https://liammagee.github.io/rastersysteme/pages/ballistic-computer-sim.html)

> Side note: "Make me a simple simulation that shows how the first computers were used to solve problems of derivatives for missiles" (Also bear in mind for assessment)

---

<!-- design: {"zones":[{"role":"title","col":26,"span":30,"row":2,"rowSpan":8},{"role":"bullets","col":26,"span":28,"row":11,"rowSpan":16},{"role":"body","col":26,"span":28,"row":28,"rowSpan":10}],"accents":[{"type":"line","col":24,"span":1,"row":1,"rowSpan":37,"color":"8B7355"},{"type":"dot","col":58,"span":1,"row":3,"rowSpan":1,"color":"A0522D"}],"typography":{"title":{"size":40,"weight":700},"body":{"size":13}},"bg":"F2EDE4","font":"Palatino"} -->
<!-- image: left 35 -->
### EXPERIMENT
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

<!-- design: {"zones":[{"role":"title","col":4,"span":34,"row":3,"rowSpan":8},{"role":"bullets","col":4,"span":30,"row":12,"rowSpan":10},{"role":"body","col":4,"span":32,"row":23,"rowSpan":14}],"accents":[{"type":"bar","col":0,"span":2,"row":0,"rowSpan":40,"color":"A0522D"},{"type":"line","col":4,"span":30,"row":11,"rowSpan":1,"color":"6B7F5E"}],"typography":{"title":{"size":44,"weight":700,"color":"F5F0E6"},"body":{"size":14,"color":"EDE4D3"}},"bg":"2A2A28","font":"Palatino"} -->
<!-- image: right 28 -->
### EDUCATION
## Education: following the arc of history

Now think about education as a parallael historical process. As society changes, so too does demand for labour and learning...

 - With gunpowder, for military purposes, we need trigonometry, calculus, physics, ordinary differential equations...
 - With democracies we need people (& machines) who can count and predict - arithmetic, statistics, probability, forecasting
 - With capitalism, we need accounting, projections, time series analysis, economic modelling, planning

Governmental, Industrial, Military uses: need a ready workforce of "calculaters", "computers", "coders".

Curriculum: shaped by the growing need to throw stones (and other applications of calculus)

Demands exceed the human "computers" (pre-1940s): a person calculating these trajectories (a "computer")

Then no longer just *how to compute* but also *how to build computers* (electrical engineering, hardware, software etc).