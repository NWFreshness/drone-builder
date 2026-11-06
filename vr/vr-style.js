/* vr/vr-style.js — the Colorfigures ink-and-wash look, carried into three.js.
 *
 * The SVG renderer does not "light" a scene: for every polygon it takes ONE world-space normal,
 * steps it through a 3-band tone ramp against a fixed sun, fills the polygon flat, and strokes its
 * outline. This module does exactly that, baking the tone into vertex colours and the outline into a
 * line-segment buffer, so the result is view-independent: walking around never re-lights the model.
 *
 * Input is plain data (the `vr` payload from src/drone-draw.js, all points in world millimetres):
 *   { kind:'solid', faces:[[[x,y,z],...],...], mat:{l,m,d}, shade:'in'|'out', w, sil }
 *   { kind:'wire',  pts:[[x,y,z],...], col:'#e2483d', w }
 * Only SCALE is applied; nothing here knows about drones, cameras or the DOM.
 *
 * Formula-bearing functions name the core.js function they were copied from, so the 3D shade matches
 * the 2D figures tone for tone.
 */

import * as THREE from './vendor/three.module.js';
import { LineSegments2 } from './vendor/LineSegments2.js';
import { LineSegmentsGeometry } from './vendor/LineSegmentsGeometry.js';
import { LineMaterial } from './vendor/LineMaterial.js';

/* ============================================================
   1. palettes and constants  (core.js PALS / METAL / ... / INK / SHADOW, BOARD)
   ============================================================ */

export const SCALE = 0.001;                 // model mm -> world metres (a 5" quad is ~0.25 m)
export const SOFT = .18;                    // width of the blend band at each tone step (core.js SOFT)
export const INK = '#231e16';
export const SHADOW = '#41538f';
export const SHADOW_OPACITY = .55;
export const SHADOW_LEN = .45;              // core.js SHADOW_LEN: shadows are drawn shorter than the light implies

export const PALS = {
  mustard: { l:'#f4b829', m:'#d49c1f', d:'#4e4a18' },
  tomato:  { l:'#ef6a4c', m:'#cf5038', d:'#4a2219' },
  mint:    { l:'#93d3b0', m:'#71b693', d:'#1f4034' },
  cobalt:  { l:'#76a0e2', m:'#5a82c6', d:'#1c2948' },
  blush:   { l:'#f3a6bb', m:'#d8869c', d:'#4b2430' },
};
export const METAL   = { l:'#eef0f0', m:'#c6ccce', d:'#8f989b' };
export const CLEAR   = { l:'#e4f2f4', m:'#c4dfe4', d:'#97b9c0' };
export const CERAMIC = { l:'#fbfaf3', m:'#e3e0d2', d:'#bdb8a6' };
export const DARK    = { l:'#55504a', m:'#3d3935', d:'#272421' };
export const BOARD   = { l:'#e6e1d4', m:'#cfc8b8', d:'#aaa293' };

/* The light the 2D pages actually shade with: mountFigure defaults az = 105 deg, and core.js
   setLight() turns that into a shadow direction SH = SHADOW_K*[cos, sin] and a sun
   L = norm([-SH[0], -SH[1], 1]).  Baking this exact vector is what keeps a face's tone in VR
   identical to the tone the SVG page gives the same face: rotV() is the identity at the default
   yaw, so the world normal can be used directly.
   Do NOT substitute the flight sim's sun [-.45,.35,.82] — it is mirrored in y, so every drone
   would be lit from the wrong side compared with the page you came from. */
const SHADOW_K = .85, AZ0 = 105;
const SH0 = [SHADOW_K*Math.cos(AZ0*Math.PI/180), SHADOW_K*Math.sin(AZ0*Math.PI/180)];
export const SUN = norm([-SH0[0], -SH0[1], 1]);

/* ============================================================
   2. vectors + shading  (core.js: sub/dot/cross/norm/mix/step3/tone/toneI)
   ============================================================ */

const dot   = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
function norm(a){ const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }

/* core.js mix(): blend two #rrggbb strings, returns a #rrggbb string. */
export function mix(a, b, t){
  let out = '#';
  for (let i = 1; i < 6; i += 2){
    const v = Math.round(parseInt(a.substr(i, 2), 16)*(1 - t) + parseInt(b.substr(i, 2), 16)*t);
    out += v.toString(16).padStart(2, '0');
  }
  return out;
}

/* core.js step3(): three flat tones, blended across a narrow band at each threshold so a face that
   turns past a step fades instead of snapping. hi/lo are dot-product thresholds. */
export function step3(d, hi, lo, m){
  const ss = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a)/(b - a))); return k*k*(3 - 2*k); };
  const a = ss(hi - SOFT, hi + SOFT, d), b = ss(lo - SOFT, lo + SOFT, d);
  return a >= 1 ? m.l : b <= 0 ? m.d : a > 0 ? mix(m.m, m.l, a) : b < 1 ? mix(m.d, m.m, b) : m.m;
}

/* core.js tone()/toneI(), with rotV() dropped: the VR sun is world-fixed, so the normal is used as-is
   and the shade no longer depends on where the viewer stands.
     'out' -> tone()  : exterior surfaces, threshold -.15 / -.45
     'in'  -> toneI() : interiors and small props, threshold .6 / .05               */
export function toneW(n, mat, shade){
  const d = dot(n, SUN);
  return shade === 'out' ? step3(d, -.15, -.45, mat) : step3(d, .6, .05, mat);
}

/* drone-draw.js ddNormal(): face normal by Newell's method, robust for rounded outlines whose
   first points are nearly in line (and for slightly non-planar quads). */
function newell(p){
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < p.length; i++){
    const a = p[i], b = p[(i + 1) % p.length];
    nx += (a[1] - b[1])*(a[2] + b[2]);
    ny += (a[2] - b[2])*(a[0] + b[0]);
    nz += (a[0] - b[0])*(a[1] + b[1]);
  }
  return [nx, ny, nz];
}
export function faceNormal(poly){ return norm(newell(poly)); }

/* ============================================================
   3. geometry: triangulate, bake one tone per face, collect ink edges
   ============================================================ */

const _c = new THREE.Color(), _lin = new Map();
/* #rrggbb (sRGB, as written in core.js) -> linear RGB for a vertex-colour attribute.
   Three converts vertex colours to the output colour space at draw time; feeding it linear values
   is what makes the pixel come out as the exact palette hex. */
function linear(hex){
  let v = _lin.get(hex);
  if (!v){ _c.setStyle(hex); v = [_c.r, _c.g, _c.b]; _lin.set(hex, v); }
  return v;
}

const q01 = v => Math.round(v*100);          // quantise to 0.01 mm before hashing an edge

/* Dedupe a polygon boundary edge against its twin on the neighbouring face. Keying on the sorted
   endpoint pair (not the direction) is what makes shared edges collapse to one line even though
   the two faces may list it in opposite order. */
function addEdge(map, a, b){
  const ka = q01(a[0]) + ',' + q01(a[1]) + ',' + q01(a[2]);
  const kb = q01(b[0]) + ',' + q01(b[1]) + ',' + q01(b[2]);
  if (ka === kb) return;                     // collapsed edge: nothing to draw
  const key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
  if (map.has(key)) return;
  map.set(key, [a[0]*SCALE, a[1]*SCALE, a[2]*SCALE, b[0]*SCALE, b[1]*SCALE, b[2]*SCALE]);
}

/* Fan-triangulate convex 3-8 gons from vertex 0, one flat colour per face, plus the ink edges.
   Winding is left exactly as the payload has it (callers render DoubleSide), so triangles are never
   rejected or flipped. The normal's SIGN, though, is settled the way core.js ddSolid() settles it:
   a face normal must point away from the part's centre. ddPrism lists its bottom cap with the top
   cap's winding, so an un-oriented normal would shade that face with the tone of its opposite side. */
function bake(polys, colourOf){
  const pos = [], col = [], seen = new Map();
  polys = polys || [];

  // part centre (core.js ddSolid: c = avg(all) of the part's vertices)
  let cx = 0, cy = 0, cz = 0, nv = 0;
  for (const poly of polys) for (const p of poly || []){ cx += p[0]; cy += p[1]; cz += p[2]; nv++; }
  if (nv){ cx /= nv; cy /= nv; cz /= nv; }

  for (const poly of polys){
    if (!poly || poly.length < 3) continue;
    const nl = newell(poly);
    const area = Math.hypot(nl[0], nl[1], nl[2])/2;   // mm²; NaN/zero-area faces fail this too
    if (!(area > 1e-6)) continue;
    let n = norm(nl);
    // ddSolid: if (dot(n, sub(avg(q), c)) < 0) n = n.map(v => -v)
    let fx = 0, fy = 0, fz = 0;
    for (const p of poly){ fx += p[0]; fy += p[1]; fz += p[2]; }
    fx /= poly.length; fy /= poly.length; fz /= poly.length;
    if (n[0]*(fx - cx) + n[1]*(fy - cy) + n[2]*(fz - cz) < 0) n = [-n[0], -n[1], -n[2]];
    const rgb = linear(colourOf(n, poly));
    for (let i = 1; i < poly.length - 1; i++){
      const tri = [poly[0], poly[i], poly[i + 1]];
      for (let k = 0; k < 3; k++){
        const p = tri[k];
        pos.push(p[0]*SCALE, p[1]*SCALE, p[2]*SCALE);
        col.push(rgb[0], rgb[1], rgb[2]);
      }
    }
    for (let i = 0; i < poly.length; i++) addEdge(seen, poly[i], poly[(i + 1) % poly.length]);
  }
  const edge = new Float32Array(seen.size*6);
  let k = 0;
  for (const s of seen.values()){ for (let i = 0; i < 6; i++) edge[k++] = s[i]; }
  return { position: new Float32Array(pos), color: new Float32Array(col), edge };
}

/* vr.faces + vr.mat + vr.shade -> { position, color, edge }, all in metres.
   position/color: 3 vertices per triangle (3 floats each). edge: 6 floats per segment — the two
   xyz endpoints back to back — ready for THREE.LineSegments; segments = edge.length / 6. */
export function facesToGeometry(faces, mat = BOARD, shade = 'in'){
  return bake(faces || [], n => toneW(n, mat, shade));
}

/* ============================================================
   4. materials (shared, flat, no lighting anywhere)
   ============================================================ */
const INK_HEX = 0x231e16;
const SOLID_MAT = new THREE.MeshBasicMaterial({
  vertexColors: true, side: THREE.DoubleSide, toneMapped: false,
  // push the fill a hair away from the camera so the coplanar ink lines win the depth test
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});
// Silhouette: black, drawn first with no depth write, so the real body paints straight over it and
// only the 1.2% rim survives — no winding assumptions, no normal extrusion on a non-manifold soup.
const SIL_MAT = new THREE.MeshBasicMaterial({
  color: INK_HEX, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
/* Ink is drawn as screen-space fat lines, not GL_LINES: LineBasicMaterial.linewidth is ignored on
   every WebGL platform, and a 1-device-pixel hairline throws away the drawing's whole character.
   ONE shared material per ink class (face / silhouette) so the app can retune width every frame
   without walking a thousand parts: in an SVG the stroke scales with the zoom, so the VR ink has
   to track the model's apparent size, not stay a fixed number of pixels. */
const INK_W = { face: 2.2, sil: 3.4 };
const INK_FACE = new LineMaterial({ color: INK_HEX, linewidth: INK_W.face, worldUnits: false,
                                    depthWrite: false, toneMapped: false });
const INK_SIL  = new LineMaterial({ color: INK_HEX, linewidth: INK_W.sil,  worldUnits: false,
                                    depthWrite: false, toneMapped: false });
export function setInkResolution(w, h){ INK_FACE.resolution.set(w, h); INK_SIL.resolution.set(w, h); }
// face/silhouette widths in device px. Call from the render loop: 0.0045 x the model's width on
// screen reproduces the SVG page's ink-to-model ratio.
export function setInkWidths(face, sil){
  INK_W.face = face; INK_W.sil = sil == null ? face*1.55 : sil;
  INK_FACE.linewidth = INK_W.face; INK_SIL.linewidth = INK_W.sil;
}
export function inkWidths(){ return { face: INK_W.face, sil: INK_W.sil }; }
function fatInk(edge, which){
  const g = new LineSegmentsGeometry();
  g.setPositions(edge);
  const l = new LineSegments2(g, which === 'sil' ? INK_SIL : INK_FACE);
  l.computeLineDistances();
  l.renderOrder = 1;
  return l;
}
const WIRE_MATS = new Map();

export function solidMaterial(){ return SOLID_MAT; }

function wireMaterial(col){
  let m = WIRE_MATS.get(col);
  if (!m){ m = new THREE.LineBasicMaterial({ color: col, depthTest: false, depthWrite: false, toneMapped: false }); WIRE_MATS.set(col, m); }
  return m;
}

/* ============================================================
   5. partMesh(vr) -> THREE.Group
   ============================================================ */

const bboxCentre = pts => {                     // metres
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const p of pts){ x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); z0 = Math.min(z0, p[2]);
                        x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); z1 = Math.max(z1, p[2]); }
  return [(x0 + x1)/2*SCALE, (y0 + y1)/2*SCALE, (z0 + z1)/2*SCALE];
};

export function wireLine(vr){
  const pts = vr.pts || vr.points || [];
  const g = new THREE.BufferGeometry();
  const arr = new Float32Array(pts.length*3);
  for (let i = 0; i < pts.length; i++){ arr[i*3] = pts[i][0]*SCALE; arr[i*3 + 1] = pts[i][1]*SCALE; arr[i*3 + 2] = pts[i][2]*SCALE; }
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const line = new THREE.Line(g, wireMaterial(vr.col || '#e2483d'));
  line.renderOrder = 2;                          // wires are annotations: keep them over the parts
  return line;
}

/* One part -> a Group of: silhouette (renderOrder -1), body, ink edges (renderOrder 1). */
export function partMesh(vr){
  const group = new THREE.Group();
  if (!vr) return group;
  if (vr.kind === 'wire'){ group.add(wireLine(vr)); return group; }

  const faces = vr.faces || [];
  const geo = facesToGeometry(faces, vr.mat || BOARD, vr.shade || 'in');

  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.BufferAttribute(geo.position, 3));
  bg.setAttribute('color', new THREE.BufferAttribute(geo.color, 3));
  const body = new THREE.Mesh(bg, SOLID_MAT);
  body.renderOrder = 0;

  if (vr.sil !== 0 && geo.position.length){
    const c = bboxCentre(faces.flat());
    const s = 1.012;                                     // uniform scale about the part's bbox centre
    const sil = new THREE.Mesh(bg, SIL_MAT);
    sil.scale.setScalar(s);
    sil.position.set(c[0]*(1 - s), c[1]*(1 - s), c[2]*(1 - s));
    sil.renderOrder = -1;                                // behind the fill, or it would paint it black
    group.add(sil);
  }
  group.add(body);

  if (geo.edge.length){
    group.add(fatInk(geo.edge));
  }
  return group;
}

/* ============================================================
   6. boardMesh(bbox, palette) — the cutting mat the model stands on
   ============================================================ */

export function boardMesh(bbox, palette = BOARD){
  const group = new THREE.Group();
  const lo = (bbox && bbox[0]) || [-100, -100, 0], hi = (bbox && bbox[1]) || [100, 100, 0];
  const w = hi[0] - lo[0], d = hi[1] - lo[1];
  const pad = Math.max(10, Math.max(w, d)*.10);           // mm of mat around the model
  const x0 = lo[0] - pad, x1 = hi[0] + pad, y0 = lo[1] - pad, y1 = hi[1] + pad;
  const h = 6;                                            // slab thickness, mm (core.js board() uses 3)
  const zt = 0, zb = -h;                                  // the mat's top is z = 0: the model stands on it

  const top    = [[x0, y0, zt], [x1, y0, zt], [x1, y1, zt], [x0, y1, zt]];
  const bottom = [[x0, y0, zb], [x1, y0, zb], [x1, y1, zb], [x0, y1, zb]];
  const sides  = [
    [[x0, y0, zb], [x1, y0, zb], [x1, y0, zt], [x0, y0, zt]],
    [[x1, y0, zb], [x1, y1, zb], [x1, y1, zt], [x1, y0, zt]],
    [[x1, y1, zb], [x0, y1, zb], [x0, y1, zt], [x1, y1, zt]],
    [[x0, y1, zb], [x0, y0, zb], [x0, y0, zt], [x0, y1, zt]],
  ];

  // top face light, sides mid, underside dark — the same three-band idea as core.js board()
  const parts = [bake([top], () => palette.l), bake(sides, () => palette.m), bake([bottom], () => palette.d)];
  const pos = [], col = [], edge = [];
  for (const p of parts){ pos.push(...p.position); col.push(...p.color); edge.push(...p.edge); }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  const slab = new THREE.Mesh(g, SOLID_MAT);
  slab.renderOrder = 0;
  group.add(slab);

  // light grid, inset 2 mm so it never fights the inked border
  const step = 20, inset = 2, lift = .1;                 // mm
  const grid = [];
  for (let x = Math.ceil((x0 + inset)/step)*step; x < x1 - inset; x += step)
    grid.push(x, y0 + inset, zt + lift, x, y1 - inset, zt + lift);
  for (let y = Math.ceil((y0 + inset)/step)*step; y < y1 - inset; y += step)
    grid.push(x0 + inset, y, zt + lift, x1 - inset, y, zt + lift);
  if (grid.length){
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(grid.map(v => v*SCALE)), 3));
    const lines = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({
      color: 0xb9b09c, transparent: true, opacity: .5, depthWrite: false, toneMapped: false }));
    group.add(lines);
  }

  if (edge.length){
    group.add(fatInk(new Float32Array(edge), 'sil'));
  }
  return group;
}

/* ============================================================
   7. shadowMesh(points) — the point cloud's hull, laid on the mat
   ============================================================ */

/* core.js hull(): Andrew's monotone chain, in the mat plane. */
function hull2(pts){
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0])*(b[1] - o[1]) - (a[1] - o[1])*(b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p){ while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()){ while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

/* core.js castShadow(): every point slides along the ground away from the light by
   (z - z0) * SHADOW_LEN, then the hull of the slid points is filled at the mat. Same 0.45 factor,
   but taken from the fixed sun instead of the viewer-turned light. */
export function shadowMesh(points, z0 = 0){
  const hxy = Math.hypot(SUN[0], SUN[1]) || 1;
  const dx = -SUN[0]/hxy*SHADOW_LEN, dy = -SUN[1]/hxy*SHADOW_LEN;
  const flat = [];
  for (const p of points || []){
    if (!p || !isFinite(p[0]) || !isFinite(p[1]) || !isFinite(p[2])) continue;
    const h = p[2] - z0;
    flat.push([p[0] + h*dx, p[1] + h*dy]);
  }
  const pos = [];
  const h2 = flat.length >= 3 ? hull2(flat) : [];
  for (let i = 1; i < h2.length - 1; i++){              // fan the hull
    for (const q of [h2[0], h2[i], h2[i + 1]]) pos.push(q[0]*SCALE, q[1]*SCALE, (z0 + .15)*SCALE);   // +0.15 mm: off the mat
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color: SHADOW, transparent: true, opacity: SHADOW_OPACITY,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  m.renderOrder = 2;
  return m;
}
