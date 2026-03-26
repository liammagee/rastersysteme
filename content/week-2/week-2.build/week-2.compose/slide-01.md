<!-- design: {"zones":[{"role":"label","col":4,"span":20,"row":2,"rowSpan":3},{"role":"title","col":4,"span":28,"row":6,"rowSpan":11},{"role":"body","col":4,"span":30,"row":20,"rowSpan":12}],"accents":[{"type":"bar","col":2,"span":1,"row":0,"rowSpan":40,"color":"9C8A76"}],"typography":{"title":{"size":52,"weight":700},"body":{"size":14},"label":{"size":11,"weight":400,"transform":"uppercase","tracking":"0.12em"}},"bg":"F8F5F0","font":"Helvetica Neue"} -->
<!-- image: right 35 -->
### GEN AI / WEEK 2
# Gen AI - Week 2 - Pathways to AI


### ![Image](images/gen_ai___week_1___pathways_to_ai_img_1.png)  

| | |
|---|---|
| Generative AI for Education<br><br> |  |

---

<!-- design: {"zones":[{"role":"label","col":12,"span":16,"row":1,"rowSpan":3},{"role":"title","col":12,"span":22,"row":4,"rowSpan":7},{"role":"body","col":4,"span":26,"row":14,"rowSpan":23},{"role":"bullets","col":32,"span":24,"row":14,"rowSpan":23}],"accents":[{"type":"bar","col":10,"span":1,"row":0,"rowSpan":40,"color":"9C8A76"}],"typography":{"title":{"size":44,"weight":400},"body":{"size":13},"label":{"size":11,"weight":400,"transform":"uppercase","tracking":"0.12em"}},"bg":"F8F5F0","font":"Helvetica Neue"} -->
### HISTORY
## “La Longue Duree” (Annales School, Fernand Braudel)


 - "Total History"

 - Why it matters
   - Should we treat history as (a) the work of (heroic - typically white, male) individuals? Or (b) processes, systems, structures? 
 
 - Compare:
   - AI as the output of individual genius (Schmidhuber, LeCun, Hinton, Goodfellow, Sutskever etc)?

   - Or instead a process of accumulating layers:
     - Material / Mathematical foundations (calculus - 17th century - but etymologically “small stone” - what a child uses to count with). Fundamental to backpropagation, fundamental to machine learning - but a fundamentally simple operation repeated over and over.  
     - Development of statistics: again, 17th century, register of births, deaths and marriages. "Big data" in the era of pen and paper. Connection to government: control of the people via techniques of governance, governmentality (Foucault, *Les Mots et Les Choses* / *The Order of Things*). 
     - Colonization: how to control people at a distance. 
     - Rise of industralialization, modernization: accumulation and deployment of capital. Fixed vs variable costs: factories, rail. 
     - Early informatics: the printing press, the typewriter. Babbage's "Difference Engine" (1830s) 
  
  ---


     - The problem of curvature. “Old school” Euclidean geometry, trigonometry good for architecture, but doesn't help in a world of *motion*
     - Problems of astronomy, ship navigation - but still relatively limited influence of *drag*
     - Ballistics - force, resistance, shape of projectile, atmosphere: shift from stars, ships to missles
     -  limited help - until we “square the circle” - decompose curved trajectories into lots of tiny lines (derivatives) / rectangles (integrals). “Unlock” the possibilities of stars, balls - missiles. First uses of computing - calculate the derivates 
    
Instruction: Make me a simple simulation that shows how the first computers were used to solve problems of derivatives for missiles

---

<!-- design: {"zones":[{"role":"label","col":26,"span":20,"row":2,"rowSpan":3},{"role":"title","col":26,"span":30,"row":6,"rowSpan":9},{"role":"body","col":26,"span":30,"row":18,"rowSpan":16}],"accents":[{"type":"bar","col":25,"span":1,"row":0,"rowSpan":40,"color":"9C8A76"}],"typography":{"title":{"size":36,"weight":600},"body":{"size":14},"label":{"size":11,"weight":400,"transform":"uppercase","tracking":"0.12em"}},"bg":"F8F5F0","font":"Helvetica Neue"} -->
<!-- image: left 30 -->
### CONTEXT
##

People likely know the famous first examples of computers for solving decryption. A kind of "safe" version of the origins of computing: the Nazis, evil, encrypted messages, the Allies, good, decrypted them. Then onto IBM, Apple, Microsoft!

But what of their other use? Ballistics, missile trajectory...

---

<!-- design: {"zones":[{"role":"title","col":34,"span":22,"row":2,"rowSpan":7},{"role":"body","col":4,"span":26,"row":12,"rowSpan":25},{"role":"bullets","col":34,"span":22,"row":12,"rowSpan":25}],"accents":[{"type":"bar","col":26,"span":1,"row":0,"rowSpan":40,"color":"9C8A76"}],"typography":{"title":{"size":36,"weight":700},"body":{"size":13},"label":{"size":11,"weight":400,"transform":"uppercase","tracking":"0.12em"}},"bg":"F8F5F0","font":"Helvetica Neue"} -->
### FOUNDATIONS
Galileo (pre-Calculus!)

 - Parabola - models an curved but essentially consistent universe. One time calculation using sine / cosine / trigonometry (what year mathematics)?
   - Can handle *gravity* - constant downward force
 
 - But what really happens? We throw a stone / launch a missile
   - And drag - acceleration changes every instant - requiring constant recalculation
   
  

So let's throw stone; we have essentially (simplistically) 4 variables:
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
 
 
Now think about education. For military purposes, we need trigonometry, calculus, physics, ordinary differential equations...
The "computer" pre-1940s: a person (typically woman) calculating these

---

<!-- design: {"zones":[{"role":"label","col":4,"span":20,"row":12,"rowSpan":3},{"role":"title","col":4,"span":34,"row":16,"rowSpan":10},{"role":"body","col":4,"span":34,"row":28,"rowSpan":7}],"accents":[{"type":"bar","col":34,"span":1,"row":10,"rowSpan":20,"color":"9C8A76"}],"typography":{"title":{"size":44,"weight":300},"body":{"size":14},"label":{"size":11,"weight":400,"transform":"uppercase","tracking":"0.12em"}},"bg":"F8F5F0","font":"Georgia"} -->
<!-- image: inset-tr 32 -->
### NOTE
[claude.ai](https://claude.ai/public/artifacts/c8c048da-b0af-4ac8-befc-33faf70536a4)