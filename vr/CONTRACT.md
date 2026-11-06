# Drone Lab VR: build contract

Source of truth for the WebXR port. Read this before touching anything under `vr/` or the
drawing layer. If you need to change a rule here, change it here first and say why.

## What the project is

`~/Documents/drone-teacher` is an offline, self-contained ink-and-wash 3D explainer. It has no
frameworks and no network at runtime:

- `src/core.js` — hand-rolled renderer: orthographic-ish projection `P(x,y,z)`, free yaw/pitch
  camera, 3-band tone shading (`tone`, `toneI`, `step3`, `PALS`), SVG primitives (`box`, `loft`,
  `rod`, `cyl`, `board`, `castShadow`, `hullInk`, `tag`), page shell (`mountFigure`).
- `src/drones-data.js` — `DL_STEPS` (array index IS build order), `DL_PARTS` glossary, `DL_DRONES`.
- `src/drone-draw.js` — `ddModel(D, opt)` returns `{items, labels, shadow, top, motors, zP}`.
  Each item is `{box, svg, key, step, cover, inner}`: one drone part, its 3D bbox, its build step,
  and its drawing already projected for the current camera.
- `src/drone-flight.html` — 2D canvas flight sim with a real 3D 6DoF flight model (`step(dt)`).
- `build.py` inlines the JS into three root HTML files. **Do not modify `build.py` or the three
  root HTML files for the VR work.** The VR app is served from `vr/` and loads `../src/*.js`
  directly as classic scripts.

## Hard invariants

1. **The existing pages must not change.** The gate is
   `node tools/svg-snapshot.js --check` — it runs `ddModel` in a vm over all 11 drones x 3 option
   sets and compares 33 SVG hashes plus byte counts against `tools/svg-baseline.json`.
   It must print `SVG gate OK` after every commit.
2. **`DD_VR` is off by default.** `let DD_VR = false;` at the top of `drone-draw.js`. All VR
   payload work is opt-in; when the flag is false nothing new is computed and `vr` is `null`.
   The SVG pages never set it.
3. **No new runtime dependencies** beyond the vendored `vr/vendor/three.module.js` (three r170).
   No CDN, no import maps, no OrbitControls/VRButton — hand-roll the little we need.
4. **Numbers come from the data.** `facts` (manufacturer numbers) are never derived; geometry
   estimates stay in `geo`/`fly`, exactly as the 2D pages do.

## Coordinates and units

Model space is millimetres, **x = nose, y = left, z = up**, origin at the drone centre.
`ddXF()` applies the demo attitude (roll/pitch/yaw about `DD_T.zc`) and `DD_DZ` drop offset, so
**every point in a `vr` payload is already in final world mm coordinates**. The VR side only
multiplies by `SCALE = 0.001` to get metres. A 5-inch quad is ~0.25 m across — correct for a
headset; do not re-scale per drone.

## The `vr` payload (produced by `src/drone-draw.js`)

Every helper that returns `{svg, pts}` also returns `vr`, which is `null` unless `DD_VR` is true:

```js
// a solid: world-space convex planar polygons, one tone per face
{ kind: 'solid',
  faces: [[[x,y,z], ...], ...],      // polygon soup, already through ddXF
  mat:   {l:'#..', m:'#..', d:'#..'},// the same 3-tone ramp the SVG side used
  shade: 'in' | 'out',               // 'in' = toneI (interior/props/default), 'out' = tone
  w: 0.8,                            // per-face ink width, drawing units
  sil: 1.2 }                         // silhouette weight; 0 = no silhouette

// a line: a wire, a spin arc, a leader
{ kind: 'wire', pts: [[x,y,z], ...], col: '#e2483d', w: 0.9 }
```

Rules:

- `ddSolid` already computes its faces in world coords — attach them. `ddPrism`, `ddBox` and
  `ddSlab` go through it and get the payload for free.
- `ddRod` / `ddCyl`: build the two rings with the same ring math as `rod()` in `core.js`
  (`d = norm(sub(b,a))`, `u = norm(cross(d, |dz|<.9 ? [0,0,1] : [1,0,0]))`, `v = cross(d,u)`),
  then emit `n` quads plus two end caps.
- `ddSweep`, `ddDome`, `ddBall`: lofted rings → quads. `ddProp`: blades are already polygons;
  hub comes from `ddCyl`.
- `ddWire`: `kind:'wire'` through the same points.
- Add `ddCat(...sols)` that merges `svg` strings **in argument order**, `pts`, and `vr.faces`
  (or keeps the first wire). Use it in place of the existing manual `a.svg + b.svg` merges so the
  SVG output stays byte-identical.
- `ddModel`'s `add()` stores `vr: sol.vr || null` on the item; the direct `items.push` sites for
  arrows/thrust do the same. Nothing else in `ddModel` changes.

## VR rendering contract (consumed by `vr/*.js`)

The look is not "toon-lit 3D". It is the SVG renderer's own algorithm carried into 3D:

- **Flat tone per face, baked.** For each face compute `n = ddNormal(poly)` and evaluate the
  3-band step with a **fixed world sun** `L = norm([-0.45, 0.35, 0.82])` (the flight sim's `SUN`),
  using the same bands: exterior `step3(dot(n,L), -.15, -.45, m)`, interior
  `step3(dot(n,L), .6, .05, m)`, `SOFT = .18`. Write the resulting colour into vertex colours.
  The shade must **not** follow the head: walking around the model must not re-light it.
- **Ink.** Every polygon edge gets a black line (dedupe shared edges by rounding coordinates to
  0.01 mm) — that is what the SVG `shape()` stroke does. Each part also gets a silhouette: a
  black back-face clone scaled 1.012 about the part's bbox centre (uniform scale, not normal
  extrusion — the face soup is not guaranteed manifold).
- **Shadows** are the `shadow` point cloud projected onto the mat: draw the hull at
  `z = matTop` in `#41538f` at ~55% opacity. `castShadow`'s 0.45 length factor applies.
- One `MeshBasicMaterial({vertexColors:true, side:DoubleSide})` per part colour is not needed —
  materials can be shared; geometry is per part. No lights, no shadow maps, no tonemapping.

## Module layout

```
vr/vendor/three.module.js   three r170, vendored (present)
vr/vr-style.js              palette bridge, toneW/step3, face normal, triangulate + bake,
                            partMesh(vr) -> THREE.Group, wireLine(vr), mat/board builder
vr/vr-scene.js              buildDrone(D, opt) -> {group, items, labels, shadow, top, motors, zP, bbox}
vr/vr-app.js                renderer, hand-rolled orbit, XR session entry, UI wiring
vr/index.html               classic scripts for core.js/drones-data.js/drone-draw.js,
                            then <script type="module" src="vr-app.js">; sets DD_VR = true
```

`ddModel(D, opt)` is called by the VR side with the same `opt` shape the assembly page uses
(`show(i) -> 0|0..1|1`, `drop`, `from`, `spin`, `speeds`, `thrust`, `arrows`, `sel`), so the
assembly sequence, drop-in animation and see-through reveal (`cover`/`inner`) all carry over.

## Verification

```bash
node --check src/drone-draw.js          # after touching it
node tools/svg-snapshot.js --check      # MUST print "SVG gate OK"
python3 -m http.server 8017 &           # serve the repo root, open /vr/
```

Visual checks follow the `browser-verification` skill: capture at 2x DPR, compare against
`?d=<id>&done=all` on the 2D assembly page, and ask falsifiable questions (part count, silhouette,
tone count, label positions). A green `node --check` proves nothing about legibility.
