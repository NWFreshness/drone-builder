#!/usr/bin/env node
/* Smoke test for the VR backend: take the REAL ddModel payload for every drone and push each
   part through vr-style.partMesh(), so a schema change in the drawing layer fails here instead of
   in the headset.

     node tools/vr-payload-smoke.js            # every drone, rest state
     node tools/vr-payload-smoke.js freestyle  # one drone

   Cheap because it is pure geometry: no DOM, no WebGL. It proves the payload is consumable and
   reports the poly budget per airframe, not that the model looks right (that is a screenshot). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

function payloads() {
  const noop = () => {};
  const el = { dataset: {}, style: {}, classList: { add: noop, remove: noop, toggle: noop }, appendChild: noop, setAttribute: noop };
  const sandbox = {
    console, window: { __ln: {} },
    document: { documentElement: el, createElement: () => el, querySelector: () => el, getElementById: () => el, addEventListener: noop },
    addEventListener: noop, requestAnimationFrame: noop,
    localStorage: { getItem: () => null, setItem: noop },
    Math, JSON, Object, Array, String, Number, Date, isFinite, parseFloat, parseInt,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const src = ['src/core.js', 'src/drones-data.js', 'src/drone-draw.js']
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
  vm.runInContext(src, sandbox, { filename: 'drawing.js' });
  vm.runInContext('DD_VR = true', sandbox);
  const drones = vm.runInContext('DL_DRONES', sandbox);
  const out = [];
  for (const D of drones) {
    if (!D.geo) continue;
    sandbox.__D = D; sandbox.__opt = { show: () => 1, drop: 0 };
    const m = vm.runInContext('ddModel(__D, __opt)', sandbox);
    out.push({ id: D.id, style: D.geo.style, items: m.items, labels: m.labels, shadow: m.shadow, top: m.top });
  }
  return out;
}

(async () => {
  const VS = await import('../vr/vr-style.js');
  const only = process.argv[2];
  const all = payloads().filter(d => !only || d.id === only);
  if (!all.length) { console.error(only ? `no drone '${only}'` : 'no drones with geo'); process.exit(2); }

  let bad = 0, totalTris = 0, totalSegs = 0;
  const rows = [];
  for (const d of all) {
    let groups = 0, skipped = 0, tris = 0, segs = 0, wires = 0, meshes = 0;
    for (const it of d.items) {
      if (!it.vr) { skipped++; continue; }
      try {
        const g = VS.partMesh(it.vr);
        groups++;
        for (const c of g.children) {
          if (c.isLineSegments2 || c.type === 'LineSegments2') { segs += c.geometry.attributes.instanceStart ? c.geometry.attributes.instanceStart.count : 0; }
          else if (c.isMesh) { meshes++; tris += (c.geometry.attributes.position ? c.geometry.attributes.position.count / 3 : 0); }
          else if (c.isLine) wires++;
        }
      } catch (e) { bad++; console.error(`  FAIL ${d.id}/${it.key}: ${e.message}`); }
    }
    totalTris += tris; totalSegs += segs;
    rows.push({ drone: d.id, style: d.style, items: d.items.length, groups,
                inkOnly: skipped, meshes, tris: Math.round(tris), segs, wires });
  }
  const pad = (v, n) => String(v).padStart(n);
  console.log('drone        style    items  parts  inkOnly  meshes    tris    segs  wires');
  for (const r of rows) console.log(
    r.drone.padEnd(12), r.style.padEnd(7), pad(r.items, 5), pad(r.groups, 6), pad(r.inkOnly, 8),
    pad(r.meshes, 7), pad(r.tris, 7), pad(r.segs, 7), pad(r.wires, 6));
  console.log(`\n${rows.length} drones, ${rows.reduce((a, r) => a + r.groups, 0)} parts, ${totalTris} tris, ${totalSegs} ink segments`);
  if (bad) { console.error(`\n${bad} part(s) failed to build`); process.exit(1); }
  console.log('payload consumable by partMesh: OK');
})();
