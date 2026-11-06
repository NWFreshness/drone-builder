# Vendored dependencies

Committed so the VR page runs offline and with no build step, matching the rest of the project.

| file | source | version | licence |
|---|---|---|---|
| `three.module.js` | three.js `build/three.module.js` | r170 (0.170.0) | MIT — header preserved in the file |
| `LineSegments2.js` | three.js `examples/jsm/lines/LineSegments2.js` | r170 | MIT |
| `LineSegmentsGeometry.js` | three.js `examples/jsm/lines/LineSegmentsGeometry.js` | r170 | MIT |
| `LineMaterial.js` | three.js `examples/jsm/lines/LineMaterial.js` | r170 | MIT |

The three `Line*` files were taken from `unpkg.com/three@0.170.0/examples/jsm/lines/` with one
edit each: their bare `from 'three'` import and `../lines/...` relative imports were rewritten to
`./three.module.js` and `./LineMaterial.js` / `./LineSegmentsGeometry.js`, so the page needs no
import map.

They exist because `LineBasicMaterial.linewidth` is ignored on every WebGL platform: the ink
outlines have to be screen-space fat lines, not GL lines.
