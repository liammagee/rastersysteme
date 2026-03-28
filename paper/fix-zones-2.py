"""Fix remaining collisions: merge overlapping body+bullets zones into single body zone."""

import re, json, sys

input_path = sys.argv[1] if len(sys.argv) > 1 else "decks/concentric-loops.composed.md"

md = open(input_path).read()
slides = md.split("\n---\n")
fixed = 0

for i, slide in enumerate(slides):
    m = re.search(r"<!-- design: ({.*?}) -->", slide, re.DOTALL)
    if not m:
        continue

    try:
        d = json.loads(m.group(1))
    except:
        continue

    zones = d.get("zones", [])

    # Find body and bullets zones
    body_idx = None
    bullets_idx = None
    for j, z in enumerate(zones):
        if z.get("role") == "body" and body_idx is None:
            body_idx = j
        elif z.get("role") == "bullets":
            bullets_idx = j

    if body_idx is not None and bullets_idx is not None:
        body = zones[body_idx]
        bullets = zones[bullets_idx]

        # Check if they overlap
        b_start, b_end = body.get("row", 0), body.get("row", 0) + body.get("rowSpan", 0)
        bl_start, bl_end = bullets.get("row", 0), bullets.get("row", 0) + bullets.get("rowSpan", 0)

        if b_start < bl_end and bl_start < b_end:
            # Merge: take the earliest start and latest end
            merged_start = min(b_start, bl_start)
            merged_end = max(b_end, bl_end)
            # Use the wider span
            merged_col = min(body.get("col", 0), bullets.get("col", 0))
            merged_span = max(
                body.get("col", 0) + body.get("span", 60),
                bullets.get("col", 0) + bullets.get("span", 60)
            ) - merged_col

            body["row"] = merged_start
            body["rowSpan"] = merged_end - merged_start
            body["col"] = merged_col
            body["span"] = merged_span

            # Remove bullets zone
            zones.pop(bullets_idx)
            d["zones"] = zones

            new_json = json.dumps(d, separators=(",", ":"))
            old_directive = m.group(0)
            new_directive = f"<!-- design: {new_json} -->"
            slides[i] = slide.replace(old_directive, new_directive)
            fixed += 1

result = "\n---\n".join(slides)
open(input_path, "w").write(result)
print(f"Fixed {fixed} slides (merged body+bullets zones)")
