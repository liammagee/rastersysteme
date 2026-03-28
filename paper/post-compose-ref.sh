#!/bin/bash
# Post-compose pipeline for fractal-reference deck
set -e
cd "$(dirname "$0")/.."

DECK="fractal-reference"

echo "=== POST-COMPOSE: ${DECK} ==="

echo "  [1/6] Adding title zones..."
python3 paper/fix-zones.py decks/${DECK}.composed.md

echo "  [2/6] Merging body+bullets..."
python3 paper/fix-zones-2.py decks/${DECK}.composed.md

echo "  [3/6] Fixing overlaps..."
for iter in 1 2 3; do
  python3 -c "
import re, json
md = open('decks/${DECK}.composed.md').read()
slides = md.split('\n---\n')
fixed = 0
for i, slide in enumerate(slides):
    m = re.search(r'<!-- design: ({.*?}) -->', slide, re.DOTALL)
    if not m: continue
    d = json.loads(m.group(1))
    zones = d.get('zones', [])
    changed = False
    for j in range(len(zones)):
        for k in range(j+1, len(zones)):
            z1, z2 = zones[j], zones[k]
            r1s = z1.get('row',0); r1e = r1s + z1.get('rowSpan',0)
            r2s = z2.get('row',0); r2e = r2s + z2.get('rowSpan',0)
            c1s = z1.get('col',0); c1e = c1s + z1.get('span',60)
            c2s = z2.get('col',0); c2e = c2s + z2.get('span',60)
            if r1s<r2e and r2s<r1e and c1s<c2e and c2s<c1e:
                later = z2 if z2.get('row',0) >= z1.get('row',0) else z1
                earlier = z1 if later is z2 else z2
                earlier_end = earlier.get('row',0) + earlier.get('rowSpan',0)
                later['row'] = earlier_end + 1
                rem = 40 - later['row']
                if later.get('rowSpan',30) > rem - 1:
                    later['rowSpan'] = max(rem - 1, 6)
                changed = True
    if changed:
        d['zones'] = zones
        nj = json.dumps(d, separators=(',',':'))
        slides[i] = slide.replace(m.group(0), f'<!-- design: {nj} -->')
        fixed += 1
open('decks/${DECK}.composed.md','w').write('\n---\n'.join(slides))
if fixed: print(f'    iter $iter: fixed {fixed}')
" 2>/dev/null
done

echo "  [4/6] Dark dividers + accents + tiny text..."
python3 -c "
import re, json
md = open('decks/${DECK}.composed.md').read()
slides = md.split('\n---\n')
for i, slide in enumerate(slides):
    clean = re.sub(r'<!-- .*? -->', '', slide, flags=re.DOTALL)
    clean = re.sub(r'\x60\x60\x60.*?\x60\x60\x60', '', clean, flags=re.DOTALL)
    lines = [l.strip() for l in clean.strip().split('\n') if l.strip()]
    headings = [l for l in lines if l.startswith('##')]
    non_headings = [l for l in lines if not l.startswith('#')]
    if headings and len(non_headings) <= 1:
        m = re.search(r'<!-- design: ({.*?}) -->', slide, re.DOTALL)
        if not m: continue
        d = json.loads(m.group(1))
        d['bg'] = '0A1628'
        if 'typography' not in d: d['typography'] = {}
        if 'title' not in d['typography']: d['typography']['title'] = {}
        d['typography']['title']['color'] = 'FAF6EE'
        d['zones'] = [z for z in d.get('zones', []) if z.get('role') == 'title']
        for a in d.get('accents', []): a['color'] = 'B7311A'
        nj = json.dumps(d, separators=(',', ':'))
        slides[i] = slide.replace(m.group(0), f'<!-- design: {nj} -->')
for i, slide in enumerate(slides):
    if i % 3 != 0: continue
    m = re.search(r'<!-- design: ({.*?}) -->', slide, re.DOTALL)
    if not m: continue
    d = json.loads(m.group(1))
    if d.get('accents'):
        d['accents'] = []
        nj = json.dumps(d, separators=(',', ':'))
        slides[i] = slide.replace(m.group(0), f'<!-- design: {nj} -->')
for i, slide in enumerate(slides):
    m = re.search(r'<!-- design: ({.*?}) -->', slide, re.DOTALL)
    if not m: continue
    d = json.loads(m.group(1))
    typo = d.get('typography', {})
    changed = False
    for role in ['body', 'label', 'sectionLabel']:
        if role in typo and typo[role].get('size', 16) < 12:
            typo[role]['size'] = 12 if role != 'body' else 13
            changed = True
    if 'body' in typo and typo['body'].get('size', 16) < 13:
        typo['body']['size'] = 13
        changed = True
    if changed:
        d['typography'] = typo
        nj = json.dumps(d, separators=(',', ':'))
        slides[i] = slide.replace(m.group(0), f'<!-- design: {nj} -->')
open('decks/${DECK}.composed.md', 'w').write('\n---\n'.join(slides))
print('    Applied')
" 2>/dev/null

echo "  [5/6] Rendering..."
node -e "require('./raster.js').generateHTML('decks/${DECK}.composed.md', 'decks/${DECK}.html')" 2>/dev/null

echo "  [6/6] Splicing..."
node splice-images.js decks/${DECK}.html decks/${DECK}.composed-images/ --image-scale visible 2>&1 | grep "Spliced"

echo ""
echo "=== EVALUATION ==="
node rubric-jsdom.js decks/${DECK}.spliced.html --json 2>/dev/null | python3 -c "
import json, sys
d = json.load(sys.stdin)
total = d.get('computedTotal')
m = d.get('metrics', {})
print(f'  Score: {total}/60  |  Slides: {m.get(\"total\")}  |  Collisions: {m.get(\"zoneCollisionSlides\",0)}  |  Sparse: {m.get(\"sparseSlides\",0)}')
for k, v in d.get('scores', {}).items():
    if v is not None: print(f'    {k}: {v}')
print(f'  Low density: {m.get(\"lowDensitySlides\",0)}  |  Empty body: {m.get(\"emptyBodyZones\",0)}  |  Tiny text: {m.get(\"tinyTextCount\",0)}')
print(f'  Unique archetypes: {m.get(\"uniqueArchetypes\",0)}  |  Max run: {m.get(\"maxArchetypeRun\",0)}')
print(f'  Unique bgs: {m.get(\"uniqueBgs\",0)}  |  Has arc: {m.get(\"hasArc\",False)}  |  Max consec bg: {m.get(\"maxConsecBg\",0)}')
"
echo ""
echo "=== DONE ==="
