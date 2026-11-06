#!/usr/bin/env node
/* SVG regression gate for the Drone Lab drawing layer.

   The three built pages (hub, assembly, flight) must render exactly as they did before the VR
   backend was added.  Comparing the built HTML text proves nothing (a comment changes the hash),
   so this compares what ddModel() actually emits: every drone, three option sets, the SVG string
   for every part plus its labels and shadow points.

     node tools/svg-snapshot.js            # print the snapshot as JSON
     node tools/svg-snapshot.js --write    # (re)record tools/svg-baseline.json
     node tools/svg-snapshot.js --check    # diff against tools/svg-baseline.json, exit 1 on drift

   Everything runs in a vm with a stub DOM: core.js registers an error listener at top level and
   reads window.LBL_U inside tag(), neither of which ddModel touches. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const FILES = ['src/core.js', 'src/drones-data.js', 'src/drone-draw.js'];

function context() {
  const noop = () => {};
  const el = { dataset: {}, style: {}, classList: { add: noop, remove: noop, toggle: noop }, appendChild: noop, setAttribute: noop };
  const sandbox = {
    console,
    window: { LBL_U: undefined, __ln: {} },
    document: { documentElement: el, createElement: () => el, querySelector: () => el, getElementById: () => el, addEventListener: noop },
    addEventListener: noop,
    requestAnimationFrame: noop,
    localStorage: { getItem: () => null, setItem: noop },
    Math, JSON, Object, Array, String, Number, Date, isFinite, parseFloat, parseInt,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const src = FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
  vm.runInContext(src, sandbox, { filename: 'drone-lab-drawing.js' });
  return sandbox;
}

const OPTS = [
  ['full',      { show: () => 1, drop: 0 }],
  ['mid',       { show: i => (i === 0 ? 1 : 0.5), drop: 12, spin: 20, speeds: [1, 1, 1, 1],
                  arrows: true, thrust: [.5, .5, .5, .5], sel: 'motor' }],
  ['early',     { show: () => 0.3, drop: 5, spin: 7, from: { battery: [0, 0, 1] } }],
];

function snapshot() {
  const ctx = context();
  const drones = vm.runInContext('DL_DRONES', ctx);
  const out = {};
  for (const D of drones) {
    if (!D.geo) continue;                       // fixed wing / VTOL have no mesh (ddExtent throws)
    out[D.id] = { style: D.geo.style, states: {} };
    for (const [name, opt] of OPTS) {
      // opt.show must be a function inside the sandbox; wrap by building the call in-context
      ctx.__D = D; ctx.__opt = opt;
      const m = vm.runInContext('ddModel(__D, __opt)', ctx);
      const payload = JSON.stringify({
        items: m.items.map(i => ({ key: i.key, step: i.step, cover: !!i.cover, inner: !!i.inner, svg: i.svg })),
        labels: m.labels, shadow: m.shadow, top: m.top, zP: m.zP,
      });
      out[D.id].states[name] = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
      out[D.id].states[name + ':bytes'] = payload.length;
    }
  }
  return out;
}

const snap = snapshot();
const file = path.join(__dirname, 'svg-baseline.json');
const rank = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'print';

if (rank === 'write') { fs.writeFileSync(file, JSON.stringify(snap, null, 2) + '\n'); console.log('wrote', path.relative(ROOT, file)); }
else if (rank === 'print') { console.log(JSON.stringify(snap, null, 2)); }
else {
  if (!fs.existsSync(file)) { console.error('no baseline; run --write first'); process.exit(2); }
  const base = JSON.parse(fs.readFileSync(file, 'utf8'));
  const drift = [];
  for (const id of new Set([...Object.keys(base), ...Object.keys(snap)])) {
    if (!base[id]) { drift.push(`${id}: new drone`); continue; }
    if (!snap[id]) { drift.push(`${id}: disappeared`); continue; }
    for (const k of new Set([...Object.keys(base[id].states), ...Object.keys(snap[id].states)])) {
      if (base[id].states[k] !== snap[id].states[k]) drift.push(`${id}/${k}: ${base[id].states[k]} -> ${snap[id].states[k]}`);
    }
  }
  const drones = Object.keys(snap).length, states = Object.values(snap).reduce((a, d) => a + Object.keys(d.states).length / 2, 0);
  if (drift.length) { console.error('SVG DRIFT in ' + drift.length + ' state(s):\n  ' + drift.join('\n  ')); process.exit(1); }
  console.log(`SVG gate OK: ${drones} drones x ${OPTS.length} states (${states} hashes) identical`);
}
