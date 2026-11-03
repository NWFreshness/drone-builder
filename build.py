#!/usr/bin/env python3
"""Build the Drone Lab pages into self-contained HTML files (no network needed).
    python3 build.py
src/drone-assembly.html goes through the Colorfigures build (core.js + page features);
the hub and the simulator get core.js and the shared drone files inlined directly."""
import os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SRC = os.path.join(HERE, 'src')
CF = os.path.expanduser('~/.claude/skills/colorfigures/scripts/build.py')
def inline(page, names):
    for n in names:
        tag = re.search(r'<script\s+src="%s"\s*>\s*</script>' % re.escape(n), page)
        if tag: page = page[:tag.start()] + '<script>\n' + open(os.path.join(SRC, n), encoding='utf-8').read() + '\n</script>' + page[tag.end():]
    return page
def build(src, out, cf=False):
    page = inline(open(os.path.join(SRC, src), encoding='utf-8').read(), ['drones-data.js', 'drone-draw.js'] + ([] if cf else ['core.js']))
    if cf:
        tmp = os.path.join(SRC, '.tmp-' + src); open(tmp, 'w', encoding='utf-8').write(page)
        subprocess.run([sys.executable, CF, tmp, os.path.join(HERE, out)], check=True); os.remove(tmp)
    else:
        open(os.path.join(HERE, out), 'w', encoding='utf-8').write(page); print('wrote', out)
build('drone-assembly.html', 'drone-assembly.html', cf=True)
for src, out in [('drone-lab.html', 'drone-lab.html'), ('drone-flight.html', 'drone-flight.html')]:
    if os.path.exists(os.path.join(SRC, src)): build(src, out)
