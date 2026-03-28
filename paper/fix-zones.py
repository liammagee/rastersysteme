"""Fix zone collisions: add title zones to slides with headings but no title zone.
Pushes body zones down to make room for the title."""

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
    has_title = any(z.get("role") == "title" for z in zones)

    # Check if slide has a heading
    clean = re.sub(r"<!-- .*? -->", "", slide, flags=re.DOTALL)
    clean = re.sub(r"```.*?```", "", clean, flags=re.DOTALL)
    has_heading = bool(re.search(r"^#{1,3}\s", clean, re.MULTILINE))

    if has_heading and not has_title:
        # Find the body zone (or first non-accent zone)
        body_idx = None
        for j, z in enumerate(zones):
            if z.get("role") in ("body", "table", "quote", "code"):
                body_idx = j
                break

        if body_idx is not None:
            body_zone = zones[body_idx]
            body_row = body_zone.get("row", 4)

            # Add title zone above body
            title_row = max(2, body_row - 8)
            title_span = body_zone.get("span", 52)
            title_col = body_zone.get("col", 4)

            title_zone = {
                "role": "title",
                "col": title_col,
                "span": title_span,
                "row": title_row,
                "rowSpan": 6
            }

            # Push body zone down if it would collide
            if body_row < title_row + 7:
                body_zone["row"] = title_row + 7
                # Reduce rowSpan to fit
                remaining = 40 - body_zone["row"]
                if body_zone.get("rowSpan", 30) > remaining - 2:
                    body_zone["rowSpan"] = max(remaining - 2, 10)

            zones.insert(0, title_zone)
            d["zones"] = zones

            # Also fix accents that overlap the new title zone
            accents = d.get("accents", [])
            for a in accents:
                a_row = a.get("row", 0)
                a_end = a_row + a.get("rowSpan", 1)
                if a_end > title_row and a_row < title_row + 7:
                    # Move accent above title
                    a["row"] = max(0, title_row - 1)
                    a["rowSpan"] = 1

            new_json = json.dumps(d, separators=(",", ":"))
            old_directive = m.group(0)
            new_directive = f"<!-- design: {new_json} -->"
            slides[i] = slide.replace(old_directive, new_directive)
            fixed += 1

result = "\n---\n".join(slides)
open(input_path, "w").write(result)
print(f"Fixed {fixed} slides (added title zones, pushed body zones down)")
