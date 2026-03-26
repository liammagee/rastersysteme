<!-- design: {"zones":[{"role":"label","col":2,"span":54,"row":1,"rowSpan":3},{"role":"bullets","col":2,"span":17,"row":7,"rowSpan":31},{"role":"body","col":21,"span":17,"row":7,"rowSpan":31},{"role":"body","col":40,"span":18,"row":7,"rowSpan":31}],"accents":[{"type":"line","col":2,"span":54,"row":5,"rowSpan":1,"color":"4A6B8A"},{"type":"bar","col":19,"span":1,"row":7,"rowSpan":31,"color":"4A6B8A"},{"type":"bar","col":38,"span":1,"row":7,"rowSpan":31,"color":"D4924A"}],"typography":{"bullets":{"size":12,"weight":400,"leading":1.65,"color":"1A2840"},"body":{"size":12,"weight":300,"leading":1.6,"color":"4A6B8A"},"label":{"size":11,"weight":700,"transform":"uppercase","tracking":"0.14em","color":"4A6B8A"}},"bg":"FAF6EE","font":"Helvetica Neue"} -->
### WEEK 2
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