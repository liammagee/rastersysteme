## “La Longue Duree” (Annales School, Fernand Braudel)


 - "Total History"

 - Why it matters
   - Should we treat history as (a) the work of (heroic - typically white, male) individuals? Or (b) processes, systems, structures? 
 
 - Compare:
   - AI as the output of individual genius (Schmidhuber, LeCun, Hinton, Goodfellow, Sutskever etc)?

 - Or instead a process of accumulating layers:
   - Material / Mathematical foundations (calculus - 17th century - but etymologically “small stone” - what a child uses to count with). Fundamental to backpropagation, the secret sauce of machine learning - but a fundamentally simple operation repeated over and over. 
   - The problem of curvature. “Old school” Euclidean geometry limited help - until we “square the circle” - decompose curved trajectories into lots of tiny lines (derivatives) / rectangles (integrals). “Unlock” the possibilities of stars, balls - missiles. First uses of computing - calculate the derivates 
  
Instruction: Make me a simple simulation that shows how the first computers were used to solve problems of derivatives for missiles

---

##

People likely know the famous first examples of computers for solving decryption. A kind of "safe" version of the origins of computing: the Nazis, evil, encrypted messages, the Allies, good, decrypted them. Then onto IBM, Apple, Microsoft!

But what of their other use? Ballistics, missile trajectory...


---

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

For those mathematically / philosophically minded:

 - Much of AI-related - and general - computing from 1940s to 2020s involves mapping continuous (derivates) into discrete (very small differences). At least as far as *simulation* (from ballistics to language generation) are concerned.
 - Note *analog* (non digital) calculators can compute continuities directly! Arguably what biological brains also do - open for debate. 
 - Continuous > discrete is always "lossy" - loses definition. Think about how early pixels used RGB - so many values for red, green, blue. Detail, naunce is lost. Is digitization - conversion of continuous to discrete - an approximation but never realization of the real thing?

 

