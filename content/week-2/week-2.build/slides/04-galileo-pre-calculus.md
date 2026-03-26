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
