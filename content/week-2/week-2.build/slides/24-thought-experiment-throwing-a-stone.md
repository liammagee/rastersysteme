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
