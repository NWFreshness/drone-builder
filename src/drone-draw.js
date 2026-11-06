/* Drone Lab: draws any multirotor in DL_DRONES with the Colorfigures engine (core.js), part by part.
   Everything goes through ddXF(), so the whole drone can tilt and lift for the "how it flies" demo, and every part
   is a byDepth item with its own box, so it sorts correctly from every side.
   x = nose, y = left, z = up, millimetres; the drone's centre sits at DD_O. */

let DD_O = [0, 0, 0];                       // world position of the drone centre (z = the surface it stands on)
let DD_T = { r:0, p:0, y:0, zc:0, lift:0 };  // demo attitude: roll (+ right side down), pitch (+ nose down), yaw (+ left), about height zc
let DD_DZ = [0, 0, 0];                      // extra offset while a part is being placed (it drops in)
const DD_CW = '#e2483d', DD_CCW = '#3f78d8';
const DD_CARBON = { l:'#5a5651', m:'#3f3c38', d:'#2a2825' };
const DD_ALU = { l:'#f0d27a', m:'#d9b04a', d:'#9c7a26' };
const DD_PCB_E = matOf('#3f8f5a'), DD_PCB_F = matOf('#4b4f9e'), DD_CHIP = matOf('#2b2826');
const DD_COPPER = matOf('#e0a35a'), DD_RUBBER = matOf('#3a3632'), DD_SILVER = { l:'#eef0f0', m:'#c6ccce', d:'#8f989b' };
const DD_GREY = matOf('#d9d6cc'), DD_WHITE = { l:'#fbfaf3', m:'#e3e0d2', d:'#bdb8a6' };

function ddXF(p){
  let x = p[0], y = p[1], z = p[2] - DD_T.zc;
  const t = DD_T;
  if (t.r){ const c = Math.cos(t.r), s = Math.sin(t.r); [y, z] = [y*c - z*s, y*s + z*c]; }
  if (t.p){ const c = Math.cos(t.p), s = Math.sin(t.p); [x, z] = [x*c + z*s, -x*s + z*c]; }
  if (t.y){ const c = Math.cos(t.y), s = Math.sin(t.y); [x, y] = [x*c - y*s, x*s + y*c]; }
  return [x + DD_O[0] + DD_DZ[0], y + DD_O[1] + DD_DZ[1], z + DD_T.zc + DD_T.lift + DD_O[2] + DD_DZ[2]];
}
const ddBB = pts => [[0,1,2].map(i => Math.min(...pts.map(p => p[i]))), [0,1,2].map(i => Math.max(...pts.map(p => p[i])))];
// face normal by Newell's method (robust for rounded outlines whose first points are nearly in line)
const ddNormal = q => { let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < q.length; i++){ const a = q[i], b = q[(i+1) % q.length]; nx += (a[1]-b[1])*(a[2]+b[2]); ny += (a[2]-b[2])*(a[0]+b[0]); nz += (a[0]-b[0])*(a[1]+b[1]); }
  return norm([nx, ny, nz]); };

/* ---------- solids (local coords in, {svg, pts} out, pts in world coords) ---------- */
function ddSolid(faces, m, w = .8, sil = 1.2){
  const F = faces.map(q => q.map(ddXF)), all = F.flat(), c = avg(all);
  let s = '';
  for (const q of F){ let n = ddNormal(q); if (dot(n, sub(avg(q), c)) < 0) n = n.map(v => -v); if (vis(n)) s += shape(q, toneI(n, m), w); }
  return { svg: s + (sil ? hullInk(all, sil) : ''), pts: all };
}
function ddPrism(poly, z0, z1, m, w = .8, sil = 1.2){
  const n = poly.length, faces = [poly.map(([x, y]) => [x, y, z0]), poly.map(([x, y]) => [x, y, z1])];
  for (let i = 0; i < n; i++){ const a = poly[i], b = poly[(i+1) % n]; faces.push([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]]); }
  return ddSolid(faces, m, w, sil);
}
const ddBox = (x0, y0, z0, x1, y1, z1, m, w = .8, sil = 1.1) => ddPrism([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, m, w, sil);
function ddRod(a, b, r, m, w = .9, r1 = r, n = 14){
  const A = ddXF(a), B = ddXF(b), e = Math.max(r, r1);
  return { svg: rod(A, B, r, m, toneI, w, r1, n), pts: [A, B, ...[[e,0,0],[-e,0,0],[0,e,0],[0,-e,0],[0,0,e],[0,0,-e]].flatMap(d => [A.map((v, i) => v + d[i]), B.map((v, i) => v + d[i])])] };
}
const ddCyl = (x, y, z0, z1, r, m, w = .9, n = 16) => ddRod([x, y, z0], [x, y, z1], r, m, w, r, n);
// a body swept along x between two (y, z) outlines (rounded shells, noses); ends capped
function ddSweep(prof0, x0, prof1, x1, m, w = 1.4){
  const A = prof0.map(([y, z]) => ddXF([x0, y, z])), B = prof1.map(([y, z]) => ddXF([x1, y, z]));
  let s = loft(A, B, nr => tone(nr, m));
  const ax = norm(sub(avg(B), avg(A)));
  for (const [R, d] of [[A, ax.map(v => -v)], [B, ax]]) if (vis(d)) s += shape(R, tone(d, m), 1);
  return { svg: s + hullInk([...A, ...B], w), pts: [...A, ...B] };
}
// a dome (canopy) on a ring: radius r, height h, centred (x, y) at z0
function ddDome(x, y, z0, r, h, m){
  const rings = [0, .35, .65, .88, 1].map(t => { const a = t*Math.PI/2; return ellUV(x, y, r*Math.cos(a) + .01, r*Math.cos(a) + .01, 20).map(([u, v]) => ddXF([u, v, z0 + h*Math.sin(a)])); });
  let s = ''; for (let i = 0; i < rings.length - 1; i++) s += loft(rings[i], rings[i+1], nr => tone(nr, m));
  return { svg: s + hullInk(rings.flat(), 1.6), pts: rings.flat() };
}
// a ball: two domes back to back (the sensor turret under a nose)
const ddBall = (x, y, z, r, m) => { const u = ddDome(x, y, z, r, r, m), d = ddDome(x, y, z, r, -r, m);
  return { svg: u.svg + d.svg, pts: [...u.pts, ...d.pts] }; };
// a slab between two copies of an [x, z] outline, extruded from y0 to y1 (fins, gear plates, flat brackets)
function ddSlab(poly, y0, y1, m, w = .9){
  const A = poly.map(([x, z]) => [x, y0, z]), B = poly.map(([x, z]) => [x, y1, z]), faces = [A, B];
  for (let i = 0; i < poly.length; i++){ const j = (i + 1) % poly.length;
    faces.push([[poly[i][0], y0, poly[i][1]], [poly[j][0], y0, poly[j][1]], [poly[j][0], y1, poly[j][1]], [poly[i][0], y1, poly[i][1]]]); }
  return ddSolid(faces, m, w, 1.2);
}
// a wire: an inked coloured line through local points
function ddWire(pts, col, w = .9){
  const W = pts.map(ddXF), d = pd(W, false);
  return { svg: `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(w*2 + .9)}" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${f(w*2)}" stroke-linejoin="round" stroke-linecap="round"/>`, pts: W };
}
const dd2Rect = (x0, y0, x1, y1, r = 0) => r > 0 ? rrUV(x0, y0, x1, y1, r, 4) : rectUV(x0, y0, x1, y1);
// an octagonal section: a box with its corners cut, which is what makes a moulded shell read as faceted
const dd2Oct = (h, z0, z1, c) => [[-h + c, z0], [h - c, z0], [h, z0 + c], [h, z1 - c], [h - c, z1], [-h + c, z1], [-h, z1 - c], [-h, z0 + c]];
// a rectangle of length len, width w, centred at (cx, cy), turned to angle a (deg)
const dd2Rot = (cx, cy, a, len, w) => { const c = Math.cos(a*Math.PI/180), s = Math.sin(a*Math.PI/180);
  return [[-len/2, -w/2], [len/2, -w/2], [len/2, w/2], [-len/2, w/2]].map(([u, v]) => [cx + u*c - v*s, cy + u*s + v*c]); };
// an arm: from radius r0 to the motor at r1 along angle a, with a round motor pad
const dd2Arm = (a, r0, r1, w, pad) => { const c = Math.cos(a*Math.PI/180), s = Math.sin(a*Math.PI/180), mx = r1*c, my = r1*s;
  return hull([[r0*c + w/2*s, r0*s - w/2*c], [r0*c - w/2*s, r0*s + w/2*c], ...ellUV(mx, my, pad, pad, 16)]); };

/* ---------- propeller, spin arrow, thrust arrow ---------- */
function ddProp(mx, my, zP, R, blades, dir, col, ang, speed, chord = 1){
  const M = matOf(col), hubR = Math.max(R*.09, 2.2);
  let s = '';
  const pts = [];
  // spinning fast: a pale disc with faint blades; slow or still: solid twisted blades
  const blur = Math.min(1, speed*1.6);
  if (blur > .05){ const ring = ellUV(mx, my, R, R, 28).map(([u, v]) => ddXF([u, v, zP + 1.2]));
    s += fill(pd(ring), col, `opacity="${f(.28*blur)}"`) + `<path d="${pd(ring)}" fill="none" stroke="${INK}" stroke-width=".6" opacity="${f(.5*blur)}" stroke-dasharray="3 3"/>`; }
  for (let b = 0; b < blades; b++){
    const th = ang*Math.PI/180*-dir + b*2*Math.PI/blades, r0 = hubR*.8;
    const wr = R*.17*chord, wt = R*.08*chord, lead = -dir;   // leading edge moves the way the prop turns, and sits higher (pitch)
    const P2 = (r, w, z) => { const a = th + lead*w/r; return [mx + r*Math.cos(a), my + r*Math.sin(a), z]; };
    const q = [P2(r0, wr*.5, zP + 2.4), P2(R*.55, wr, zP + 2.2), P2(R, wt, zP + 1.6), P2(R, -wt*.6, zP + .9), P2(R*.55, -wr*.6, zP + .6), P2(r0, -wr*.4, zP + .5)].map(ddXF);
    let n = ddNormal(q); if (!vis(n)) n = n.map(v => -v);
    s += `<g opacity="${f(1 - .75*blur)}">` + shape(q, toneI(n, M), .8) + '</g>'; pts.push(...q);
  }
  const hub = ddCyl(mx, my, zP, zP + 3.2, hubR, M, .8, 12);
  return { svg: s + hub.svg, pts: [...pts, ...hub.pts, ...ellUV(mx, my, R, R, 8).map(([u, v]) => ddXF([u, v, zP + 1]))] };
}
function ddSpinArrow(mx, my, z, R, dir){
  const col = dir > 0 ? DD_CW : DD_CCW, a0 = dir > 0 ? 160 : 20, sweep = -dir*130, r = R*.62, n = 14;
  const arc = Array.from({ length:n+1 }, (_, i) => { const a = (a0 + sweep*i/n)*Math.PI/180; return [mx + r*Math.cos(a), my + r*Math.sin(a), z]; });
  const ae = (a0 + sweep)*Math.PI/180, tdir = [-Math.sin(ae)*-dir, Math.cos(ae)*-dir], hl = R*.2, hw = R*.11;
  const end = arc[n], tip = [end[0] + tdir[0]*hl, end[1] + tdir[1]*hl, z], rad = [Math.cos(ae), Math.sin(ae)];
  const head = [tip, [end[0] + rad[0]*hw, end[1] + rad[1]*hw, z], [end[0] - rad[0]*hw, end[1] - rad[1]*hw, z]].map(ddXF);
  const W = arc.map(ddXF), d = pd(W, false);
  return { svg: `<path d="${d}" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round"/>` + shape(head, col, 1.1), pts: [...W, ...head] };
}
function ddThrust(mx, my, z, R, k){
  const len = R*1.15*k, r = Math.max(1.4, R*.045);
  const shaft = ddRod([mx, my, z], [mx, my, z + len], r, matOf('#f4b829'), .9), head = ddRod([mx, my, z + len], [mx, my, z + len + r*5], r*2.6, matOf('#f4b829'), 1, 0);
  return { svg: shaft.svg + head.svg, pts: [...shaft.pts, ...head.pts] };
}

/* ---------- the model: every part as a byDepth item tagged with its build step and kind ---------- */
const DD_STEP_I = Object.fromEntries(DL_STEPS.map((s, i) => [s.k, i]));
/* opt: { show(i) -> 0 (hidden) | 0..1 (placing) | 1, drop: dz for a part being placed, spin, speeds[], thrust[], arrows, sel }
   returns { items, labels:{key: point}, shadow: points, top } */
function ddModel(D, opt){
  const g = D.geo, items = [], labels = {}, shadow = [];
  let cur = null;
  const step = k => { const i = DD_STEP_I[k], v = opt.show(i); cur = v > 0 ? { i, v } : null;
    const k2 = v > 0 && v < 1 ? 1 - ease(v) : 0, from = opt.from && opt.from[k] || [0, 0, 1];
    DD_DZ = from.map(c => c*k2*opt.drop); return !!cur; };
  const add = (key, sol, flags = {}) => { if (!cur) return; const box3 = ddBB(sol.pts);
    let svg = sol.svg; if (cur.v < 1) svg = `<g opacity="${f(Math.min(1, cur.v*2))}">${svg}</g>`;
    const nm = (D.partText && D.partText[key]) || DL_PARTS[key] || [key.toUpperCase(), ''];
    svg = `<g data-act="part" data-k="${key}" class="pt${opt.sel === key ? ' selp' : ''}"><title>${nm[0]}: ${nm[1]}</title>${svg}</g>`;
    items.push({ box: box3, svg, key, step: cur.i, cover: !!flags.cover, inner: !!flags.inner });
    if (!labels[key] && cur.v >= 1) labels[key] = flags.at ? ddXF(flags.at) : boxMid(box3); };
  const motors = g.motors.map((m, i) => ({ ...m, ...(g.pos ? { x: g.pos[i][0], y: g.pos[i][1] } : { x: g.arm*Math.cos(m.a*Math.PI/180), y: g.arm*Math.sin(m.a*Math.PI/180) }) }));
  // spin / speed / arrows are handed to the style too: a helicopter draws its tail rotor, so it needs the same phase
  const st = { motors, zP: 0, zMotor: 0, top: 0, spin: opt.spin || 0, speed: (opt.speeds && opt.speeds[0]) || 0, arrows: !!opt.arrows };
  const B = { xplate: ddXPlate, duct: ddDuct, shell: ddShell, round: ddRound, strike: ddStrike, bolt: ddBolt, heli: ddHeli }[g.style];
  B(D, g, st, step, add, shadow);
  // motors, props, arrows and thrust are the same on every drone (each style sets st.zMotor, st.zP and motor sizes)
  const mm = matOf(D.geo.motorCol || '#c9cfd2'), bell = g.bellCol ? matOf(g.bellCol) : PALS[D.pal] ? PALS[D.pal] : DD_SILVER;
  if (step('motors')) motors.forEach((m, i) => {
    const z0 = m.z0 != null ? m.z0 : st.zMotor, R = g.motorR, h = g.motorH || R*1.2;
    const base = ddCyl(m.x, m.y, z0, z0 + R*.22, R*.86, DD_CHIP, .8, 16), bel = ddCyl(m.x, m.y, z0 + R*.22, z0 + R*.22 + h, R, bell, 1, 18);
    const shaft = ddCyl(m.x, m.y, z0 + R*.22 + h, (m.zP != null ? m.zP : st.zP) + 3, Math.max(1, R*.13), DD_SILVER, .7, 10);
    add('motor', { svg: base.svg + bel.svg + shaft.svg, pts: [...base.pts, ...bel.pts, ...shaft.pts] }, { at: [m.x, m.y, z0 + h] });
    shadow.push(ddXF([m.x, m.y, z0 + h]));
  });
  if (opt.arrows && opt.show(DD_STEP_I.motors) >= 1) motors.forEach(m => {
    const zP = m.zP != null ? m.zP : st.zP; DD_DZ = [0, 0, 0];
    // a rotor with a huge disc draws its arrow close in: a full-size arc reads as a stray cable, not a spin cue
    const aR = m.arrowR || g.propR;
    const a = ddSpinArrow(m.x, m.y, zP + aR*.14 + 4, aR, m.dir);
    items.push({ box: ddBB(a.pts), svg: `<g class="spin">${a.svg}</g>`, key: 'arrow', step: -1 }); });
  if (step('props')) motors.forEach((m, i) => {
    if (m.noProp) return;   // a style that draws its own blades (a helicopter's rotor) opts out here
    const zP = m.zP != null ? m.zP : st.zP, sp = (opt.speeds && opt.speeds[i]) || 0;
    add('prop', ddProp(m.x, m.y, zP, g.propR, g.blades, m.dir, g.propCol, (opt.spin || 0)*(.6 + .4*sp) + i*37, sp), { at: [m.x + g.propR*.7, m.y, zP + 2] });
  });
  if (opt.thrust) motors.forEach((m, i) => { DD_DZ = [0, 0, 0];
    const zP = m.zP != null ? m.zP : st.zP, tR = m.thrustR || g.propR, t = ddThrust(m.x, m.y, zP + 5, tR, opt.thrust[i]);
    items.push({ box: ddBB(t.pts), svg: t.svg, key: 'thrust', step: -1 }); });
  DD_DZ = [0, 0, 0];
  return { items, labels, shadow, top: st.top, motors, zP: st.zP };
}

/* ---------- style: carbon X frame (5" freestyle, racer, 7" long range) ---------- */
function ddXPlate(D, g, st, step, add, shadow){
  const L = g.plateL, W = g.plateW, pal = PALS[D.pal];
  const zB = 2.5, zA = 5, zA1 = 10, zC = 12, T0 = zC + g.standH, R = g.motorR;
  st.zMotor = zA1; st.zP = zA1 + R*.22 + g.motorH + 1.2; st.top = T0;
  const corners = [[L/2 - 9, W/2 - 6], [L/2 - 9, -W/2 + 6], [-L/2 + 9, W/2 - 6], [-L/2 + 9, -W/2 + 6]];
  if (step('frame')){
    add('plate', ddPrism(dd2Rect(-L/2, -W/2, L/2, W/2, 8), zB, zA, DD_CARBON, .9, 1.4), { at: [-L/2 + 6, W/2 - 4, zA] });
    for (const [x, y] of corners) add('foot', ddCyl(x, y, 0, zB, 4, DD_RUBBER, .7, 10));
    // camera side plates (the cage the FPV camera sits in)
    for (const y of [-12.5, 11]) add('plate', ddBox(L/2 - 24, y, zC, L/2 + 1, y + 1.5, T0, DD_CARBON, .8, 1));
  }
  if (step('arms')){
    g.motors.forEach(m => add('arm', ddPrism(dd2Arm(m.a, 18, g.arm, g.armW, R*.95), zA, zA1, DD_CARBON, .9, 1.3), { at: [g.arm*.6*Math.cos(m.a*Math.PI/180), g.arm*.6*Math.sin(m.a*Math.PI/180), zA1] }));
    add('plate', ddPrism(dd2Rect(-L/2 + 4, -W/2 + 2, L/2 - 22, W/2 - 2, 6), zA1, zC, DD_CARBON, .8, 1.1));
    for (const m of g.motors) shadow.push(ddXF([g.arm*Math.cos(m.a*Math.PI/180), g.arm*Math.sin(m.a*Math.PI/180), zA1]));
  }
  const s2 = g.stack/2, bw = s2 + 3, zE = zC + 4, zF = zE + 10;
  if (step('esc')){
    for (const sx of [-s2, s2]) for (const sy of [-s2, s2]) add('standoff', ddCyl(sx - 4, sy, zC, zF + 2, 1.5, DD_GREY, .6, 8));
    const esc = ddBox(-bw - 4, -bw, zE, bw - 4, bw, zE + 1.6, DD_PCB_E, .8, 1);
    let svg = esc.svg; for (let i = 0; i < 4; i++) for (const sy of [-9, 5]) svg += ddBox(-14 - 4 + i*7, sy, zE + 1.6, -10 - 4 + i*7, sy + 4, zE + 3, DD_CHIP, .5, .6).svg;
    add('esc', { svg, pts: esc.pts }, { inner: true, at: [bw - 4, bw, zE + 1] });
  }
  if (step('fc')){
    const fc = ddBox(-bw - 4, -bw, zF, bw - 4, bw, zF + 1.6, DD_PCB_F, .8, 1);
    const mcu = ddBox(-9, -6, zF + 1.6, 3, 6, zF + 3, DD_CHIP, .5, .6), usb = ddBox(-8, bw - 1, zF + 1.6, 0, bw + 1.5, zF + 4.6, DD_SILVER, .5, .6);
    add('fc', { svg: fc.svg + mcu.svg + usb.svg, pts: fc.pts }, { inner: true, at: [-bw - 4, -bw, zF + 1] });
    add('gyro', ddBox(6, -bw + 4, zF + 1.6, 10, -bw + 8, zF + 2.8, matOf('#d8d8d8'), .5, .6), { inner: true });
  }
  const zV = zF + 3.6, rear = -L/2;
  if (step('camera')){
    const cam = ddBox(L/2 - 21, -9.5, zC + 5, L/2 - 2, 9.5, zC + 24, DD_CHIP, .8, 1.1);
    const tilt = 25*Math.PI/180, lc = [L/2 - 2, 0, zC + 14.5], lens = ddRod(lc, [lc[0] + 9*Math.cos(tilt), 0, lc[2] + 9*Math.sin(tilt)], 7, DD_CHIP, .9, 6.4);
    const glass = ddRod([lc[0] + 9*Math.cos(tilt), 0, lc[2] + 9*Math.sin(tilt)], [lc[0] + 9.6*Math.cos(tilt), 0, lc[2] + 9.6*Math.sin(tilt)], 4.6, matOf('#4b6b9a'), .6);
    add('camera', { svg: cam.svg + lens.svg + glass.svg, pts: [...cam.pts, ...lens.pts] });
    add('vtx', ddBox(-14 - 4, -13, zV, 14 - 4, 13, zV + 4, matOf('#3a3f45'), .8, 1), { inner: true });
    add('rx', ddBox(rear + 6, -5, zC, rear + 18, 5, zC + 2, DD_PCB_E, .6, .8), { inner: true });
    for (const s of [-1, 1]) add('antenna', ddRod([rear + 6, 3*s, zC + 1], [rear - 22, 16*s, zC + 10], 1, DD_WHITE, .7), { at: [rear - 20, 15*s, zC + 9] });
    add('antenna', ddRod([rear - 2, 0, zV + 2], [rear - 20, 0, T0 + 20], 2.6, DD_CHIP, .8), { at: [rear - 18, 0, T0 + 18] });
  }
  if (step('wiring')){
    const cols = ['#e2483d', '#f4b829', '#3f78d8'];
    g.motors.forEach(m => { const c = Math.cos(m.a*Math.PI/180), s = Math.sin(m.a*Math.PI/180);
      cols.forEach((col, k) => { const o = (k - 1)*2.4, ox = -s*o, oy = c*o, rr = g.arm - R - 2;
        add('wire', ddWire([[rr*c + ox, rr*s + oy, zA1 + .8], [(rr*.5 + 12)*c + ox, (rr*.5 + 12)*s + oy, zA1 + .8]], col, .7), { inner: true });
        add('wire', ddWire([[(rr*.5 + 12)*c + ox, (rr*.5 + 12)*s + oy, zA1 + .8], [24*c + ox, 24*s + oy, zC + .8], [(bw - 2)*c - 4 + ox, (bw - 2)*s + oy, zE + 1.8]], col, .7), { inner: true }); }); });
    for (const [s, col] of [[3, '#e2483d'], [-3, '#3a3632']]) add('xt60', ddWire([[-bw - 2, s, zE + 1.8], [rear + 2, s, zE + 1], [rear - 6, s, zE + 4], [rear - 10, s, T0 - 2]], col, 1.5), { inner: true });
    add('xt60', ddBox(rear - 16, -6, T0 - 4, rear - 4, 6, T0 + 4, matOf('#f4c430'), .8, 1));
    add('cap', ddRod([rear + 4, 8, zC + 5], [rear - 16, 8, zC + 5], 4.5, matOf('#3b4a6b'), .8), { inner: true });
    add('wire', ddWire([[L/2 - 21, 0, zC + 10], [bw - 2, 0, zF + 2]], '#8a8a8a', .5), { inner: true });
  }
  if (step('shell')){
    for (const [x, y] of corners) add('standoff', ddCyl(x, y, zC, T0, 2.6, pal || DD_ALU, .7, 10));
    add('plate', ddPrism(dd2Rect(-L/2, -W/2, L/2, W/2, 8), T0, T0 + 2.5, DD_CARBON, .9, 1.4), { cover: true, at: [L/2 - 10, -W/2 + 4, T0 + 2.5] });
    if (g.action){
      add('action', ddBox(L/2 - 34, -4, T0 + 2.5, L/2 - 4, 4, T0 + 8, pal, .7, .9), { cover: true });
      const ac = ddBox(L/2 - 32, -35, T0 + 8, L/2 - 4, 35, T0 + 54, DD_CHIP, .9, 1.4), lens = ddRod([L/2 - 4, 18, T0 + 34], [L/2 + 4, 18, T0 + 34], 10, DD_CHIP, 1);
      add('action', { svg: ac.svg + lens.svg, pts: [...ac.pts, ...lens.pts] }, { cover: true });
    }
    if (g.gps){ add('gps', ddBox(rear - 2, -14, T0 + 2.5, rear + 24, 14, T0 + 10, matOf('#2f3640'), .8, 1)); }
  }
  if (step('battery')){
    const [bl, bw2, bh] = g.batt, x1 = g.action ? L/2 - 36 : g.gps ? bl/2 + 12 : bl/2, x0 = x1 - bl, z0 = T0 + 2.5;
    const b = ddBox(x0, -bw2/2, z0, x1, bw2/2, z0 + bh, matOf('#3f9fd8'), 1, 1.8);
    let svg = b.svg;
    if (!DD_T.r && !DD_T.p && !DD_T.y){ const sy = vis([0, 1, 0]) ? bw2/2 + .3 : -bw2/2 - .3;
      svg += vis([0, sy > 0 ? 1 : -1, 0]) ? ddLabelY((x0 + x1)/2, sy, z0 + bh/2 - 3, g.cells, 9) : ''; }
    add('battery', { svg, pts: b.pts }, { cover: true, at: [x0 + 6, bw2/2, z0 + bh*.7] });
    const sx = (x0 + x1)/2;
    add('strap', ddPrism(dd2Rect(sx - 7, -bw2/2 - 1.2, sx + 7, bw2/2 + 1.2), z0 + bh, z0 + bh + 1.4, pal || matOf('#e2483d'), .7, .9), { cover: true });
    for (const s of [-1, 1]) add('strap', ddBox(sx - 7, s > 0 ? bw2/2 : -bw2/2 - 1.2, z0, sx + 7, s > 0 ? bw2/2 + 1.2 : -bw2/2, z0 + bh + 1.4, pal || matOf('#e2483d'), .7, .9), { cover: true });
    add('xt60', ddWire([[x0 + 2, 4, z0 + bh*.4], [rear - 10, 4, T0 + 4]], '#e2483d', 1.4));
    shadow.push(ddXF([x0, -bw2/2, z0 + bh]), ddXF([x1, bw2/2, z0 + bh]));
  }
}
// text on a y = const face, reading correctly from whichever side faces the viewer
function ddLabelY(x, y, z, str, size){
  const o = P(...ddXF([x, y, z])), U = Dv(y > 0 ? -1 : 1, 0, 0), V = Dv(0, 0, -1);
  return `<text transform="${txM(o, U, V)}" font-size="${size}" fill="#fff4d6" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="800">${str}</text>`;
}

/* ---------- style: ducted (cinewhoop, tiny whoop) ---------- */
function ddDuct(D, g, st, step, add, shadow){
  const wh = !!g.whoop, pal = PALS[D.pal], zp0 = wh ? 7 : 3, zp1 = zp0 + (wh ? 1.5 : 2.5), R = g.motorR;
  st.zMotor = zp1; st.zP = zp1 + R*.22 + g.motorH + 1;
  const dH = Math.max(g.ductH, st.zP + 4), dR = g.ductR, thick = wh ? 1.2 : 2.5;
  const L = wh ? 30 : 64, W = wh ? 22 : 40;
  st.top = dH;
  const ducts = () => g.motors.forEach(m => { const mx = g.arm*Math.cos(m.a*Math.PI/180), my = g.arm*Math.sin(m.a*Math.PI/180), n = 16;
    for (let i = 0; i < n; i++){ const a0 = i/n*2*Math.PI, a1 = (i + 1)/n*2*Math.PI, pt = (r, a) => [mx + r*Math.cos(a), my + r*Math.sin(a)];
      add('duct', ddPrism([pt(dR, a0), pt(dR + thick, a0), pt(dR + thick, a1), pt(dR, a1)], 0, dH, pal, .5, 0), { at: [mx + (dR + thick)*Math.cos(m.a*Math.PI/180), my + (dR + thick)*Math.sin(m.a*Math.PI/180), dH] }); }
    // the duct's rim ink, top and bottom, in short pieces so they sort with the ring
    for (let i = 0; i < n; i++){ const a0 = i/n*2*Math.PI, a1 = (i + 1)/n*2*Math.PI, ring = [];
      for (const r of [dR, dR + thick]) for (const z of [0, dH]) ring.push([[mx + r*Math.cos(a0), my + r*Math.sin(a0), z], [mx + r*Math.cos(a1), my + r*Math.sin(a1), z]]);
      const W2 = ring.map(seg => seg.map(ddXF)), hidden = !vis([Math.cos((a0 + a1)/2), Math.sin((a0 + a1)/2), 0]);
      add('duct', { svg: W2.map(s2 => ink(pd(s2, false), 1.5)).join('') + (hidden ? '' : ink(pd([W2[2][0], W2[3][0]], false), .4)), pts: W2.flat() }); }
    shadow.push(...ellUV(mx, my, dR + thick, dR + thick, 10).map(([u, v]) => ddXF([u, v, dH]))); });
  if (step('frame')){
    add('plate', ddPrism(dd2Rect(-L/2, -W/2, L/2, W/2, wh ? 4 : 8), zp0, zp1, wh ? pal : DD_CARBON, .9, 1.3), { at: [-L/2 + 4, W/2 - 3, zp1] });
    g.motors.forEach(m => { add('arm', ddPrism(dd2Arm(m.a, wh ? 8 : 16, g.arm, g.armW, R*1.25), zp0, zp1, wh ? pal : DD_CARBON, .8, 1.1));
      const mx = g.arm*Math.cos(m.a*Math.PI/180), my = g.arm*Math.sin(m.a*Math.PI/180);
      for (const da of [70, -70]) { const a = m.a + 180 + da, poly = dd2Arm(a, 0, dR + thick/2, wh ? 2 : 4, 0).map(([u, v]) => [u + mx, v + my]);
        add('arm', ddPrism(hull(poly), zp0, zp1, wh ? pal : DD_CARBON, .6, .8)); } });
    if (wh) ducts();
  }
  if (!wh && step('arms')) ducts();
  const s2 = g.stack/2, zE = zp1 + 3.5, zF = zE + 7;
  if (!wh && step('esc')){
    for (const sx of [-s2, s2]) for (const sy of [-s2, s2]) add('standoff', ddCyl(sx, sy, zp1, zF + 2, 1.2, DD_GREY, .6, 8));
    add('esc', ddBox(-s2 - 3, -s2 - 3, zE, s2 + 3, s2 + 3, zE + 1.6, DD_PCB_E, .8, 1), { inner: true });
  }
  if (step('fc')){
    const zz = wh ? zp1 + 1 : zF, h = wh ? 12 : s2 + 3;
    add('fc', ddBox(-h, -h, zz, h, h, zz + 1.4, DD_PCB_F, .8, 1), { inner: true, at: [h, h, zz + 1] });
    add('gyro', ddBox(-2, -2, zz + 1.4, 2, 2, zz + 2.4, matOf('#d8d8d8'), .5, .6), { inner: true });
  }
  const camX = wh ? L/2 - 4 : L/2 - 6, cs = wh ? 7 : 10;
  if (step('camera')){
    const cz = zp1 + (wh ? 2 : 3), cam = ddBox(camX - cs*1.2, -cs, cz, camX, cs, cz + cs*2, DD_CHIP, .8, 1.1);
    const tilt = (D.fly.uptilt || 0)*Math.PI/180, lc = [camX, 0, cz + cs], lens = ddRod(lc, [camX + cs*.8*Math.cos(tilt), 0, cz + cs + cs*.8*Math.sin(tilt)], cs*.65, DD_CHIP, .9);
    add('camera', { svg: cam.svg + lens.svg, pts: [...cam.pts, ...lens.pts] });
    if (!wh) add('vtx', ddBox(-L/2 + 8, -15, zF + 2.5, 10, 15, zF + 10, matOf('#d9d6cc'), .8, 1), { inner: true });
    for (const s of wh ? [0] : [-1, 1]) add('antenna', ddRod([-L/2 + 4, 6*s, zp1 + 6], [-L/2 - (wh ? 14 : 22), 12*s, zp1 + (wh ? 10 : 22)], wh ? .5 : 1.4, DD_WHITE, .7));
  }
  if (step('wiring')){
    g.motors.forEach(m => { const c = Math.cos(m.a*Math.PI/180), s = Math.sin(m.a*Math.PI/180), r0 = g.arm - R - 1, r1 = wh ? 10 : s2 + 2;
      add('wire', ddWire([[r0*c, r0*s, zp1 + .6], [r1*c, r1*s, zp1 + .6], [r1*c, r1*s, (wh ? zp1 + 2 : zE + 1.6)]], wh ? '#e2483d' : '#f4b829', wh ? .4 : .7), { inner: true }); });
    for (const [s, col] of [[2, '#e2483d'], [-2, '#3a3632']]) add('xt60', ddWire([[-s2 - 2, s, zE + 1], [-L/2 - 4, s, zp1 + 2], [-L/2 - 8, s, zp1 + 10]], col, wh ? .5 : 1.1), { inner: true });
    if (!wh) add('cap', ddRod([-L/2 + 2, 9, zp1 + 4], [-L/2 - 10, 9, zp1 + 4], 3.5, matOf('#3b4a6b'), .8), { inner: true });
  }
  if (step('shell')){
    const zt = wh ? zp1 + 10 : zF + 13;
    add('canopy', ddPrism(hull([[-L/2 + 2, -W/2 + 3], [L/2 - 14, -W/2 + 3], [L/2 - 8, -W/2 + 8], [L/2 - 8, W/2 - 8], [L/2 - 14, W/2 - 3], [-L/2 + 2, W/2 - 3]]), zp1, zt, wh ? matOf('#f2efe7') : pal, 1, 1.5), { cover: true });
    st.top = Math.max(st.top, zt);
  }
  if (step('battery')){
    const [bl, bw2, bh] = g.batt;
    const z0 = wh ? zp0 - bh : zF + 13, b = ddBox(-bl/2 - (wh ? 0 : 4), -bw2/2, z0, bl/2 - (wh ? 0 : 4), bw2/2, z0 + bh, matOf('#3f9fd8'), 1, 1.6);
    let svg = b.svg;
    if (!wh && !DD_T.r && !DD_T.p && !DD_T.y){ const sy = vis([0, 1, 0]) ? bw2/2 + .3 : -bw2/2 - .3; svg += ddLabelY(-4, sy, z0 + bh/2 - 3, g.cells, 8); }
    add('battery', { svg, pts: b.pts }, { cover: !wh, at: [bl/2 - 6, bw2/2, z0 + bh*.6] });
    if (!wh) add('strap', ddPrism(dd2Rect(-11, -bw2/2 - 1, 3, bw2/2 + 1), z0 + bh, z0 + bh + 1.2, matOf('#e2483d'), .7, .9), { cover: true });
    st.top = Math.max(st.top, z0 + bh);
  }
}

/* ---------- style: folding camera drone with a moulded shell (Mini) ---------- */
const DD_MINI_POS = [[88, 104], [-86, 98], [-86, -98], [88, -104]];
function ddShell(D, g, st, step, add, shadow){
  const pal = PALS[D.pal], light = DD_WHITE, X0 = -72, X1 = 62, XN = 78;
  g.pos = DD_MINI_POS;
  st.zMotor = 0; st.zP = 0;
  // front motors sit high on the upper arms, rear motors low on the lower arms
  const mz = [40, 26, 26, 40]; st.motors.forEach((m, i) => { m.x = DD_MINI_POS[i][0]; m.y = DD_MINI_POS[i][1]; m.z0 = mz[i]; m.zP = mz[i] + g.motorR*.22 + g.motorR*1.2 + 2; });
  g.motorH = g.motorR*1.2;
  const lower = rrUV(-31, 10, 31, 34, 7, 4), upper = rrUV(-30, 33, 30, 57, 12, 4), sc = (pr, k, cz) => pr.map(([y, z]) => [y*k, cz + (z - cz)*k]);
  if (step('frame')){
    add('shell', ddSweep(lower, X0, lower, X1, light), { cover: true, at: [X1 - 10, -31, 22] });
    add('shell', ddSweep(lower, X1, sc(lower, .72, 22), XN - 4, light, 1.2), { cover: true });
  }
  if (step('arms')){
    st.motors.forEach((m, i) => { const front = m.x > 0, s = Math.sign(m.y), hinge = front ? [X1 - 8, 29*s, 30] : [X0 + 8, 29*s, 16];
      const pod = [m.x, m.y, front ? m.z0 - 4 : m.z0 - 4];
      add('arm', ddRod(hinge, pod, 5, light, 1), { at: [(hinge[0] + pod[0])/2, (hinge[1] + pod[1])/2, (hinge[2] + pod[2])/2 + 5] });
      add('arm', ddCyl(m.x, m.y, front ? m.z0 - 14 : 0, m.z0, g.motorR + 1.5, light, 1, 16));
      if (front) add('foot', ddRod([m.x, m.y, m.z0 - 14], [m.x, m.y, 0], 2.5, light, .8));
      add('arm', ddCyl(hinge[0], hinge[1], hinge[2] - 5, hinge[2] + 5, 5.5, matOf('#c9c4b6'), .8, 12)); });
  }
  if (step('esc')) add('esc', ddBox(-6, -22, 13, 44, 22, 14.6, DD_PCB_E, .8, 1), { inner: true });
  if (step('fc')){
    const b = ddBox(-4, -24, 26, 52, 24, 27.6, DD_PCB_F, .8, 1), soc = ddBox(14, -9, 27.6, 30, 9, 29.4, DD_CHIP, .5, .6);
    add('fc', { svg: b.svg + soc.svg, pts: b.pts }, { inner: true, at: [52, 24, 27] });
    add('gyro', ddBox(36, -4, 27.6, 40, 0, 28.8, matOf('#d8d8d8'), .5, .6), { inner: true });
  }
  if (step('camera')){
    const br = ddBox(XN - 6, -6, 12, XN + 2, 6, 22, matOf('#c9c4b6'), .8, 1), roll = ddRod([XN + 2, 0, 17], [XN + 8, 0, 17], 7, DD_CHIP, .9);
    add('gimbal', { svg: br.svg + roll.svg, pts: [...br.pts, ...roll.pts] }, { at: [XN + 6, 7, 17] });
    add('gimbal', ddBox(XN + 8, -17, 6, XN + 12, -13, 24, DD_CHIP, .8, 1));
    add('gimbal', ddRod([XN + 16, -19, 15], [XN + 16, -13, 15], 6, DD_CHIP, .9));
    const head = ddBox(XN + 12, -12, 5, XN + 30, 12, 25, DD_CHIP, .9, 1.3), lens = ddRod([XN + 30, 0, 15], [XN + 34, 0, 15], 7, DD_CHIP, .9), gl = ddRod([XN + 34, 0, 15], [XN + 34.6, 0, 15], 4.8, matOf('#4b6b9a'), .6);
    add('camera', { svg: head.svg + lens.svg + gl.svg, pts: [...head.pts, ...lens.pts] });
    add('gps', ddBox(-60, -13, 46, -34, 13, 50, matOf('#c9a45a'), .7, .9), { inner: true });
    for (const s of [-1, 1]) add('antenna', ddRod([88, 104*s, 24], [88, 104*s, 6], 1.2, matOf('#7a7a7a'), .6), { inner: true });
  }
  if (step('wiring')){
    st.motors.forEach(m => { const front = m.x > 0, s = Math.sign(m.y);
      add('wire', ddWire([[front ? 30 : -10, 20*s, front ? 27 : 14], [front ? X1 - 8 : X0 + 8, 27*s, front ? 30 : 16], [m.x, m.y, m.z0 - 2]], '#d9a640', .6), { inner: true }); });
    add('wire', ddWire([[48, 0, 27], [XN - 4, 0, 20], [XN + 4, 0, 17]], '#d9a640', 1), { inner: true });
  }
  if (step('shell')){
    add('shell', ddSweep(upper, X0, upper, X1 - 2, pal, 1.6), { cover: true, at: [0, 30, 50] });
    add('shell', ddSweep(upper, X1 - 2, sc(upper, .7, 40), XN - 8, pal, 1.2), { cover: true });
  }
  if (step('battery')){
    const b = ddBox(X0 - 1, -24, 13, -6, 24, 33, matOf('#4a4a4a'), 1, 1.4);
    let svg = b.svg; if (vis([-1, 0, 0])) svg += shape([[X0 - 1.2, -6, 20], [X0 - 1.2, 6, 20], [X0 - 1.2, 6, 26], [X0 - 1.2, -6, 26]].map(ddXF), '#8af0ae', .5);
    add('battery', { svg, pts: b.pts }, { inner: true, at: [X0, 20, 28] });
  }
  if (step('frame')) shadow.push(...[[X0, -31, 34], [X1, 31, 34], [X0, 31, 34], [X1, -31, 34], [XN, 0, 30]].map(ddXF));
  st.top = 60;
}

/* ---------- style: strike quad (tall legs, payload pod slung under the belly) ---------- */
const ddStrikeLayout = g => DL_STRIKE(g);
function ddStrike(D, g, st, step, add, shadow){
  const L = g.plateL, W = g.plateW, pal = PALS[D.pal], R = g.motorR;
  const { zB, zA, zA1, zC, zE, zF, T0, s2, bw, pod: P } = ddStrikeLayout(g);
  st.zMotor = zA1; st.zP = zA1 + R*.22 + g.motorH + 1.2; st.top = T0 + g.batt[2];
  const corners = [[L/2 - 14, W/2 - 9], [L/2 - 14, -W/2 + 9], [-L/2 + 14, W/2 - 9], [-L/2 + 14, -W/2 + 9]];
  if (step('frame')){
    add('plate', ddPrism(dd2Rect(-L/2, -W/2, L/2, W/2, 10), zB, zA, DD_CARBON, .9, 1.4), { at: [-L/2 + 8, W/2 - 6, zA] });
    // long splayed legs: the payload pod needs clear air under the belly
    for (const [x, y] of corners){
      add('gear', ddRod([x, y, zB], [x*1.1, y*1.22, 3], 4.5, DD_CARBON, 1), { at: [x*1.05, y*1.11, zB*.5] });
      add('foot', ddCyl(x*1.1, y*1.22, 0, 3, 7, DD_RUBBER, .8, 10));
      shadow.push(ddXF([x*1.1, y*1.22, 0]));
    }
    for (const y of [-13, 12]) add('plate', ddBox(L/2 - 24, y, zC, L/2 + 1, y + 1.5, T0, DD_CARBON, .8, 1));
  }
  if (step('arms')){
    g.motors.forEach(m => add('arm', ddPrism(dd2Arm(m.a, 18, g.arm, g.armW, R*.95), zA, zA1, DD_CARBON, .9, 1.3),
      { at: [g.arm*.6*Math.cos(m.a*Math.PI/180), g.arm*.6*Math.sin(m.a*Math.PI/180), zA1] }));
    add('plate', ddPrism(dd2Rect(-L/2 + 4, -W/2 + 2, L/2 - 22, W/2 - 2, 6), zA1, zC, DD_CARBON, .8, 1.1));
    for (const m of g.motors) shadow.push(ddXF([g.arm*Math.cos(m.a*Math.PI/180), g.arm*Math.sin(m.a*Math.PI/180), zA1]));
  }
  if (step('esc')){
    for (const sx of [-s2, s2]) for (const sy of [-s2, s2]) add('standoff', ddCyl(sx - 4, sy, zC, zF + 2, 1.6, DD_GREY, .6, 8));
    const esc = ddBox(-bw - 4, -bw, zE, bw - 4, bw, zE + 1.6, DD_PCB_E, .8, 1);
    let svg = esc.svg; for (let i = 0; i < 4; i++) for (const sy of [-9, 5]) svg += ddBox(-14 - 4 + i*7, sy, zE + 1.6, -10 - 4 + i*7, sy + 4, zE + 3, DD_CHIP, .5, .6).svg;
    add('esc', { svg, pts: esc.pts }, { inner: true, at: [bw - 4, bw, zE + 1] });
  }
  if (step('fc')){
    const fc = ddBox(-bw - 4, -bw, zF, bw - 4, bw, zF + 1.6, DD_PCB_F, .8, 1);
    const mcu = ddBox(-9, -6, zF + 1.6, 3, 6, zF + 3, DD_CHIP, .5, .6), usb = ddBox(-8, bw - 1, zF + 1.6, 0, bw + 1.5, zF + 4.6, DD_SILVER, .5, .6);
    add('fc', { svg: fc.svg + mcu.svg + usb.svg, pts: fc.pts }, { inner: true, at: [-bw - 4, -bw, zF + 1] });
    add('gyro', ddBox(6, -bw + 4, zF + 1.6, 10, -bw + 8, zF + 2.8, matOf('#d8d8d8'), .5, .6), { inner: true });
  }
  const zV = zF + 3.6, rear = -L/2;
  if (step('camera')){
    const cam = ddBox(L/2 - 21, -9.5, zC + 5, L/2 - 2, 9.5, zC + 24, DD_CHIP, .8, 1.1);
    const tilt = (D.fly.uptilt || 0)*Math.PI/180, lc = [L/2 - 2, 0, zC + 14.5];
    const lens = ddRod(lc, [lc[0] + 9*Math.cos(tilt), 0, lc[2] + 9*Math.sin(tilt)], 7, DD_CHIP, .9, 6.4);
    const glass = ddRod([lc[0] + 9*Math.cos(tilt), 0, lc[2] + 9*Math.sin(tilt)], [lc[0] + 9.6*Math.cos(tilt), 0, lc[2] + 9.6*Math.sin(tilt)], 4.6, matOf('#4b6b9a'), .6);
    add('camera', { svg: cam.svg + lens.svg + glass.svg, pts: [...cam.pts, ...lens.pts] });
    add('vtx', ddBox(-14 - 4, -13, zV, 14 - 4, 13, zV + 4, matOf('#3a3f45'), .8, 1), { inner: true });
    add('rx', ddBox(rear + 6, -5, zC, rear + 18, 5, zC + 2, DD_PCB_E, .6, .8), { inner: true });
    for (const s of [-1, 1]) add('antenna', ddRod([rear + 6, 3*s, zC + 1], [rear - 22, 16*s, zC + 10], 1, DD_WHITE, .7), { at: [rear - 20, 15*s, zC + 9] });
    add('antenna', ddRod([rear - 2, 0, zV + 2], [rear - 20, 0, T0 + 20], 2.6, DD_CHIP, .8), { at: [rear - 18, 0, T0 + 18] });
  }
  if (step('wiring')){
    const cols = ['#e2483d', '#f4b829', '#3f78d8'];
    g.motors.forEach(m => { const c = Math.cos(m.a*Math.PI/180), s = Math.sin(m.a*Math.PI/180);
      cols.forEach((col, k) => { const o = (k - 1)*2.4, ox = -s*o, oy = c*o, rr = g.arm - R - 2;
        add('wire', ddWire([[rr*c + ox, rr*s + oy, zA1 + .8], [(rr*.5 + 12)*c + ox, (rr*.5 + 12)*s + oy, zA1 + .8]], col, .7), { inner: true });
        add('wire', ddWire([[(rr*.5 + 12)*c + ox, (rr*.5 + 12)*s + oy, zA1 + .8], [24*c + ox, 24*s + oy, zC + .8], [(bw - 2)*c - 4 + ox, (bw - 2)*s + oy, zE + 1.8]], col, .7), { inner: true }); }); });
    for (const [s, col] of [[3, '#e2483d'], [-3, '#3a3632']]) add('xt60', ddWire([[-bw - 2, s, zE + 1.8], [rear + 2, s, zE + 1], [rear - 6, s, zE + 4], [rear - 10, s, T0 - 2]], col, 1.5), { inner: true });
    add('xt60', ddBox(rear - 16, -6, T0 - 4, rear - 4, 6, T0 + 4, matOf('#f4c430'), .8, 1));
    add('cap', ddRod([rear + 4, 8, zC + 5], [rear - 16, 8, zC + 5], 4.5, matOf('#3b4a6b'), .8), { inner: true });
    add('wire', ddWire([[L/2 - 21, 0, zC + 10], [bw - 2, 0, zF + 2]], '#8a8a8a', .5), { inner: true });
  }
  if (step('shell')){
    for (const [x, y] of corners) add('standoff', ddCyl(x, y, zC, T0, 2.6, pal || DD_ALU, .7, 10));
    add('plate', ddPrism(dd2Rect(-L/2, -W/2, L/2, W/2, 10), T0, T0 + 2.5, DD_CARBON, .9, 1.4), { cover: true, at: [L/2 - 12, -W/2 + 5, T0 + 2.5] });
  }
  if (step('payload')){
    // the payload pod, slung under the belly on two rails
    const body = ddBox(P.x0, -P.hy, P.z0, P.x1, P.hy, P.z1, matOf('#3f4750'), .9, 1.4);
    const nose = ddSweep(rrUV(-P.hy, P.z0, P.hy, P.z1, 8), P.x1, rrUV(-5, P.z0 + 7, 5, P.z1 - 6, 3), P.x1 + P.nose, DD_SILVER, 1.2);
    add('payload', { svg: body.svg + nose.svg, pts: [...body.pts, ...nose.pts] }, { cover: true, at: [P.x0 + 14, 0, (P.z0 + P.z1)/2] });
    // tail fins: two swept wings, one up, one down
    for (const s of [-1, 1]) add('fin', ddBox(P.x0, s > 0 ? P.hy : -P.hy - 3, P.z0 + 3, P.x0 + 18, s > 0 ? P.hy + 3 : -P.hy, P.z0 + 31, matOf('#c94f3d'), .7, .9));
    add('fin', ddBox(P.x0, -2.5, P.z1, P.x0 + 16, 2.5, P.z1 + 15, matOf('#c94f3d'), .7, .9));
    add('fin', ddBox(P.x0, -2.5, P.z0, P.x0 + 16, 2.5, P.z0 + 12, matOf('#c94f3d'), .7, .9));
    // the rails that hold the pod to the frame
    for (const s of [-1, 1]) add('standoff', ddRod([P.x0 + 16, s*12, P.z1], [P.x0 + 16, s*12, zB + 1], 2.2, DD_SILVER, .7), { at: [P.x0 + 16, s*12, (P.z1 + zB)/2] });
  }
  if (step('battery')){
    const [bl, bw2, bh] = g.batt, x1 = bl/2, x0 = x1 - bl, z0 = T0 + 2.5;
    const b = ddBox(x0, -bw2/2, z0, x1, bw2/2, z0 + bh, matOf('#3f9fd8'), 1, 1.8);
    let svg = b.svg;
    if (!DD_T.r && !DD_T.p && !DD_T.y){ const sy = vis([0, 1, 0]) ? bw2/2 + .3 : -bw2/2 - .3;
      svg += vis([0, sy > 0 ? 1 : -1, 0]) ? ddLabelY((x0 + x1)/2, sy, z0 + bh/2 - 3, g.cells, 9) : ''; }
    add('battery', { svg, pts: b.pts }, { cover: true, at: [x0 + 6, bw2/2, z0 + bh*.7] });
    const sx = (x0 + x1)/2;
    add('strap', ddPrism(dd2Rect(sx - 7, -bw2/2 - 1.2, sx + 7, bw2/2 + 1.2), z0 + bh, z0 + bh + 1.4, pal || matOf('#e2483d'), .7, .9), { cover: true });
    for (const s of [-1, 1]) add('strap', ddBox(sx - 7, s > 0 ? bw2/2 : -bw2/2 - 1.2, z0, sx + 7, s > 0 ? bw2/2 + 1.2 : -bw2/2, z0 + bh + 1.4, pal || matOf('#e2483d'), .7, .9), { cover: true });
    add('xt60', ddWire([[x0 + 2, 4, z0 + bh*.4], [rear - 10, 4, T0 + 4]], '#e2483d', 1.4));
    shadow.push(ddXF([x0, -bw2/2, z0 + bh]), ddXF([x1, bw2/2, z0 + bh]));
  }
}

/* ---------- style: round centre plates, tube arms, landing gear (octo, hexa) ---------- */
function ddRound(D, g, st, step, add, shadow){
  const Rp = g.plateR, k = Rp/165, G = g.gearH, pal = PALS[D.pal], tr = 12.5*k, zt = G + 4 + tr, Rm = g.motorR;
  const zMt = G + 31*k; st.zMotor = zMt; st.zP = zMt + Rm*.22 + Rm*.65 + 3; g.motorH = Rm*.65;
  const plate = ellUV(0, 0, Rp, Rp, 24);
  if (step('frame')){
    add('plate', ddPrism(plate, G, G + 4*k, DD_CARBON, .9, 1.4), { at: [Rp*.7, -Rp*.7, G + 4] });
    add('plate', ddPrism(plate, G + 27*k, G + 31*k, DD_CARBON, .9, 1.4), { at: [-Rp*.7, Rp*.7, G + 31*k] });
    // landing gear: four legs to two skids
    for (const sy of [-1, 1]){ for (const sx of [-1, 1]) add('gear', ddRod([sx*.42*Rp, sy*.62*Rp, G], [sx*1.15*Rp, sy*1.4*Rp, 10*k], 7*k, DD_CARBON, 1), { at: [sx*.8*Rp, sy*1.0*Rp, G*.5] });
      add('gear', ddRod([-1.7*Rp, sy*1.4*Rp, 10*k], [1.7*Rp, sy*1.4*Rp, 10*k], 8*k, DD_CARBON, 1));
      for (const sx of [-1, 1]) add('foot', ddCyl(sx*1.15*Rp, sy*1.4*Rp, 0, 3*k, 14*k, DD_RUBBER, .8, 10)); }
    // battery tray hung under the bottom plate
    add('plate', ddBox(-.75*Rp, -.72*Rp, G - 92*k, .75*Rp, .72*Rp, G - 88*k, DD_CARBON, .8, 1.1));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) add('standoff', ddCyl(sx*.65*Rp, sy*.62*Rp, G - 88*k, G, 4*k, DD_ALU, .7, 8));
    shadow.push(...[[-1.7*Rp, -1.4*Rp, 10], [1.7*Rp, 1.4*Rp, 10], [1.7*Rp, -1.4*Rp, 10], [-1.7*Rp, 1.4*Rp, 10]].map(ddXF));
  }
  if (step('arms')) g.motors.forEach(m => { const c = Math.cos(m.a*Math.PI/180), s = Math.sin(m.a*Math.PI/180);
    add('arm', ddRod([.55*Rp*c, .55*Rp*s, zt], [(g.arm - 26*k)*c, (g.arm - 26*k)*s, zt], tr, DD_CARBON, 1.1), { at: [g.arm*.6*c, g.arm*.6*s, zt + tr] });
    add('arm', ddPrism(dd2Rot(g.arm*c, g.arm*s, m.a, 56*k, 56*k), G + 4*k, zMt, matOf('#3a3632'), .8, 1));
    add('arm', ddPrism(dd2Rot(.85*Rp*c, .85*Rp*s, m.a, 30*k, 36*k), G + 2*k, G + 33*k, pal, .7, .9));
    shadow.push(ddXF([g.arm*c, g.arm*s, zMt])); });
  if (step('esc')) g.motors.forEach(m => { const c = Math.cos(m.a*Math.PI/180), s = Math.sin(m.a*Math.PI/180), r = g.arm*.68;
    add('esc', ddPrism(dd2Rot(r*c, r*s, m.a, 74*k, 34*k), zt - 15*k, zt + 15*k, matOf('#4a5a7a'), .8, 1), { at: [r*c, r*s, zt + 15*k] }); });
  if (step('fc')){
    const fc = ddBox(-26*k, -22*k, G + 31*k, 26*k, 22*k, G + 61*k, matOf('#e8e4da'), .9, 1.2), stripe = ddBox(-26.3*k, -22.3*k, G + 52*k, 26.3*k, 22.3*k, G + 57*k, matOf('#f08a3c'), .6, 0);
    add('fc', { svg: fc.svg + stripe.svg, pts: fc.pts }, { at: [26*k, 22*k, G + 55*k] });
    add('gps', ddRod([-.86*Rp, 0, G + 31*k], [-.86*Rp, 0, G + 180*k], 5*k, DD_CARBON, .9));
    add('gps', ddCyl(-.86*Rp, 0, G + 180*k, G + 196*k, 40*k, matOf('#2f3640'), 1.1, 20), { at: [-.86*Rp, 40*k, G + 192*k] });
  }
  const gx = 1.2*Rp;
  if (step('camera')){
    for (const sy of [-1, 1]) add('gimbal', ddRod([.3*Rp, sy*40*k, G - 6*k], [gx + 30*k, sy*40*k, G - 6*k], 6*k, DD_SILVER, .8));
    add('gimbal', ddCyl(gx, 0, G - 34*k, G - 8*k, 24*k, DD_CHIP, 1, 16), { at: [gx + 24*k, 0, G - 20*k] });
    add('gimbal', ddBox(gx - 12*k, -82*k, G - 46*k, gx + 12*k, 82*k, G - 34*k, DD_CHIP, .8, 1.1));
    for (const sy of [-1, 1]){ add('gimbal', ddBox(gx - 10*k, sy > 0 ? 70*k : -82*k, G - 160*k, gx + 10*k, sy > 0 ? 82*k : -70*k, G - 46*k, DD_CHIP, .8, 1.1));
      add('gimbal', ddRod([gx, sy*84*k, G - 120*k], [gx, sy*70*k, G - 120*k], 22*k, DD_CHIP, .9)); }
    if (g.gimbal === 'cine'){
      const cam = ddBox(gx - 70*k, -62*k, G - 172*k, gx + 70*k, 62*k, G - 70*k, matOf('#cf5038'), 1, 1.6), lens = ddRod([gx + 70*k, 0, G - 122*k], [gx + 140*k, 0, G - 122*k], 38*k, DD_CHIP, 1.1), gl = ddRod([gx + 140*k, 0, G - 122*k], [gx + 142*k, 0, G - 122*k], 28*k, matOf('#4b6b9a'), .7);
      add('camera', { svg: cam.svg + lens.svg + gl.svg, pts: [...cam.pts, ...lens.pts] });
    } else {
      const cam = ddBox(gx - 50*k, -55*k, G - 160*k, gx + 50*k, 55*k, G - 80*k, matOf('#e8e4da'), 1, 1.4), lens = ddRod([gx, 0, G - 160*k], [gx, 0, G - 190*k], 26*k, DD_CHIP, 1);
      add('camera', { svg: cam.svg + lens.svg, pts: [...cam.pts, ...lens.pts] });
    }
    add('rx', ddBox(.2*Rp, -.5*Rp, G + 31*k, .45*Rp, -.3*Rp, G + 39*k, matOf('#2f3640'), .7, .9));
    for (const s of [-1, 1]) add('antenna', ddRod([.1*Rp, s*.9*Rp, G + 4*k], [.1*Rp, s*.9*Rp, G - 70*k], 3*k, DD_WHITE, .7));
  }
  if (step('wiring')){
    add('pdb', ddPrism(ellUV(0, 0, .5*Rp, .5*Rp, 8), G + 4*k, G + 7*k, DD_COPPER, .8, 1), { inner: true });
    g.motors.forEach(m => { const c = Math.cos(m.a*Math.PI/180), s = Math.sin(m.a*Math.PI/180), r0 = .45*Rp, r1 = g.arm*.68 - 37*k, r2 = g.arm*.68 + 37*k, r3 = g.arm - 30*k;
      for (const [o, col] of [[-5*k, '#e2483d'], [5*k, '#3a3632']]) add('wire', ddWire([[r0*c - s*o, r0*s + c*o, G + 7*k], [r1*c - s*o, r1*s + c*o, zt + tr + 2]], col, 1.2), { inner: true });
      add('wire', ddWire([[r2*c, r2*s, zt + tr], [r3*c, r3*s, zMt - 4*k]], '#f4b829', 1.2), { inner: true }); });
    for (const sy of [-1, 1]) add('xt60', ddWire([[-.4*Rp, sy*.3*Rp, G + 5*k], [-.6*Rp, sy*.5*Rp, G - 40*k]], '#e2483d', 1.6), { inner: true });
  }
  if (step('shell')) add('canopy', ddDome(0, 0, G + 31*k, .7*Rp, .4*Rp, pal), { cover: true });
  if (step('battery')) for (const sy of [-1, 1]){
    const b = ddBox(-.62*Rp, sy > 0 ? .05*Rp : -.62*Rp, G - 88*k - 70*k, .62*Rp, sy > 0 ? .62*Rp : -.05*Rp, G - 88*k, matOf('#3f9fd8'), 1, 1.6);
    add('battery', b, { at: [.62*Rp, sy*.4*Rp, G - 120*k] });
    add('strap', ddBox(-.1*Rp, sy > 0 ? .04*Rp : -.63*Rp, G - 160*k, .1*Rp, sy > 0 ? .63*Rp : -.04*Rp, G - 157*k, matOf('#e2483d'), .6, .8));
  }
  st.top = G + 200*k;
}

/* ---------- style: Anduril Bolt (faceted black quad, mission module on the spine) ---------- */
// the deck heights the whole build hangs off; ddExtent reads the same numbers, so the frame always fits
const ddBoltZ = { belly: 38, deck: 178, modTop: 258, top: 302 };
function ddBolt(D, g, st, step, add, shadow){
  const L = g.plateL, hy = g.plateW/2, R = g.motorR, Z = ddBoltZ, pal = PALS[D.pal];
  const blk = matOf('#2a2826'), dark = matOf('#1d1b19');    // matte black airframe: the palette only on small details
  st.zMotor = 130; st.zP = st.zMotor + R*.22 + g.motorH + 1.5; st.top = Z.top;
  const full = dd2Oct(hy, Z.belly, Z.deck, 30), nose = dd2Oct(hy*.42, Z.belly + 32, Z.deck - 34, 14);
  if (step('frame')){
    // two flat rails: it stands on these, so the gimbal under the nose never touches the ground
    for (const s of [-1, 1]) add('skid', ddBox(-235, s > 0 ? 58 : -80, 0, 235, s > 0 ? 80 : -58, 10, dark, .9, 1.2), { at: [170, 68*s, 10] });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) add('foot', ddRod([sx*206, sy*70, 8], [sx*196, sy*58, Z.belly], 4.5, DD_CARBON, .8));
    // the belly plate: the pack, the ESCs and the arm hinges all bolt to it
    add('plate', ddBox(-L/2 + 14, -hy + 12, Z.belly, L/2 - 14, hy - 12, Z.belly + 9, DD_CARBON, .9, 1.3), { at: [-L/2 + 30, hy - 12, Z.belly + 9] });
    shadow.push(...[[-206, -60, 0], [206, 60, 0], [206, -60, 0], [-206, 60, 0]].map(ddXF));
  }
  if (step('arms')){
    g.motors.forEach(m => { const c = Math.cos(m.a*Math.PI/180), s = Math.sin(m.a*Math.PI/180);
      add('arm', ddPrism(dd2Arm(m.a, 74, g.arm, g.armW, 42), 112, 126, blk, .9, 1.3), { at: [g.arm*.62*c, g.arm*.62*s, 126] });
      // the fold: a vertical pin at the root, so the arm lies back along the body to fit the case
      add('arm', ddCyl(84*c, 84*s, 104, 134, 11, DD_SILVER, .8, 12));
      add('arm', ddCyl(g.arm*c, g.arm*s, 126, 132, R*1.35, blk, .9, 16));
      shadow.push(ddXF([g.arm*c, g.arm*s, 126]));
    });
  }
  if (step('esc')){
    const esc = ddBox(-96, -48, Z.belly + 16, 58, 48, Z.belly + 18, DD_PCB_E, .8, 1);
    let svg = esc.svg; for (let i = 0; i < 4; i++) svg += ddBox(-86 + i*26, -32, Z.belly + 18, -72 + i*26, -18, Z.belly + 23, DD_CHIP, .5, .6).svg;
    add('esc', { svg, pts: esc.pts }, { inner: true, at: [58, 48, Z.belly + 18] });
  }
  if (step('fc')){
    const fc = ddBox(-56, -40, Z.belly + 26, 66, 40, Z.belly + 28, DD_PCB_F, .8, 1);
    add('fc', { svg: fc.svg + ddBox(-16, -12, Z.belly + 28, 6, 12, Z.belly + 31, DD_CHIP, .5, .6).svg, pts: fc.pts }, { inner: true, at: [66, 40, Z.belly + 28] });
    add('gyro', ddBox(22, -7, Z.belly + 28, 30, 1, Z.belly + 30, matOf('#d8d8d8'), .5, .6), { inner: true });
    // the GPS puck and two radio antennas sit on the open deck aft of the module
    add('gps', ddBox(-266, -17, Z.deck, -228, 17, Z.deck + 9, matOf('#2f3640'), .8, 1), { at: [-247, 17, Z.deck + 9] });
    for (const s of [-1, 1]) add('antenna', ddRod([-204, 40*s, Z.deck], [-220, 62*s, Z.deck + 44], 2.4, blk, .8), { at: [-220, 62*s, Z.deck + 44] });
  }
  const gx = L/2 - 42, gz = 82, gr = 56;
  if (step('camera')){
    // the gimbal ball hangs under the nose on a two-cheek yoke, so it can look straight down
    add('gimbal', ddBall(gx, 0, gz, gr, matOf('#1b1a18')), { at: [gx, 0, gz + gr] });
    for (const s of [-1, 1]) add('gimbal', ddRod([gx - 34, 40*s, Z.belly + 2], [gx - 4, (gr - 6)*s, gz + 8], 7, DD_SILVER, .8));
    const lens = ddRod([gx + gr*.5, 0, gz], [gx + gr*.98, 0, gz], 26, matOf('#141312'), .9, 22);
    const gl = ddRod([gx + gr*.98, 0, gz], [gx + gr*1.02, 0, gz], 17, matOf('#4b6b9a'), .6);
    add('camera', { svg: lens.svg + gl.svg, pts: lens.pts }, { at: [gx + gr, 0, gz] });
  }
  if (step('wiring')){
    const cols = ['#e2483d', '#f4b829', '#3f78d8'];
    g.motors.forEach((m, i) => { const c = Math.cos(m.a*Math.PI/180), s = Math.sin(m.a*Math.PI/180);
      add('wire', ddWire([[g.arm*.45*c, g.arm*.45*s, 126], [84*c, 84*s, 118], [52*c, 52*s, Z.belly + 20]], cols[i % 3], .8), { inner: true }); });
    add('xt60', ddWire([[58, 26, Z.belly + 18], [110, 34, 60], [120, 40, 96]], '#e2483d', 1.5), { inner: true });
    add('cap', ddRod([-40, 40, Z.belly + 22], [-58, 40, Z.belly + 22], 5, matOf('#3b4a6b'), .8), { inner: true });
  }
  if (step('shell')){
    // the faceted body: one octagonal section, tapering to a squared nose
    add('shell', ddSweep(full, -L/2, full, 170, blk, 1.7), { cover: true, at: [0, hy, Z.deck] });
    add('shell', ddSweep(full, 170, nose, L/2 + 20, blk, 1.4), { cover: true });
    // the silver heat-sink spine: the avionics under it dump their heat into the airstream
    add('shell', ddBox(-L/2 + 8, -30, Z.deck, 150, 30, Z.deck + 6, DD_SILVER, .8, 1), { cover: true });
    for (let i = 0; i < 15; i++){ const x = -L/2 + 16 + i*28;
      add('shell', ddBox(x, -30, Z.deck + 6, x + 9, 30, Z.deck + 13, DD_SILVER, .6, .8), { cover: true }); }
    // the carry loop: one hand, so a soldier can lift it out of the case and throw it up
    for (const x of [126, 158]) add('shell', ddBox(x, -6, Z.deck, x + 7, 6, Z.deck + 32, blk, .7, .9), { cover: true });
    add('shell', ddBox(126, -6, Z.deck + 32, 165, 6, Z.deck + 38, blk, .7, .9), { cover: true });
  }
  if (step('payload')){
    // the mission module: a latched can on the spine, sensors or warhead, swapped without tools
    const m0 = -120, m1 = 86, z0 = Z.deck + 12, z1 = Z.modTop, zc = (z0 + z1)/2, hz = (z1 - z0)/2;
    const prof = k => ellUV(0, zc, hy*.78*k, hz*k, 18);
    const mod = ddSweep(prof(1), m0, prof(1), m1, dark, 1.5), capA = ddSweep(prof(1), m0, prof(.5), m0 - 26, dark, 1.2),
          capB = ddSweep(prof(1), m1, prof(.46), m1 + 30, pal, 1.2);   // the one accent: a painted nose on the can
    add('module', { svg: mod.svg + capA.svg + capB.svg, pts: [...mod.pts, ...capA.pts, ...capB.pts] }, { at: [m0 + 24, 0, z1 + 6] });
    for (let i = 0; i < 7; i++){ const x = m0 + 18 + i*28;   // heat-sink strips on the can's top
      add('module', ddBox(x, -38, z1 - 5, x + 9, 38, z1 + 3, DD_SILVER, .6, .8)); }
    for (const s of [-1, 1]) add('module', ddBox(-10, s > 0 ? hy*.76 : -hy*.79, zc - 8, 34, s > 0 ? hy*.79 : -hy*.76, zc + 8, DD_SILVER, .7, .9));
  }
  if (step('battery')){
    const [bl, bw, bh] = g.batt, z0 = Z.belly + 6;
    // the pack sits low and aft in the belly: out of the way of the gimbal, right over the centre of mass
    const b = ddBox(-bl + 5, -bw/2, z0, 5, bw/2, z0 + bh, matOf('#2f6f8f'), 1, 1.7);
    let svg = b.svg;
    if (!DD_T.r && !DD_T.p && !DD_T.y){ const sy = vis([0, 1, 0]) ? bw/2 + .3 : -bw/2 - .3;
      svg += vis([0, sy > 0 ? 1 : -1, 0]) ? ddLabelY(-bl/2 + 5, sy, z0 + bh/2 - 3, g.cells, 9) : ''; }
    add('battery', { svg, pts: b.pts }, { inner: true, at: [-bl + 12, bw/2, z0 + bh*.7] });
    for (const sx of [-bl + 40, -bl + 110]) add('strap', ddBox(sx - 7, -bw/2 - 1.6, z0 + bh, sx + 7, bw/2 + 1.6, z0 + bh + 1.8, pal, .7, .9), { cover: true });
    add('xt60', ddWire([[5, 10, z0 + bh*.5], [60, 20, 70], [100, 30, Z.belly + 18]], '#8a3a30', 1.4), { inner: true });
    shadow.push(ddXF([-bl + 5, -bw/2, z0 + bh]), ddXF([5, bw/2, z0 + bh]));
  }
}

/* ---------- style: Anduril Ghost-X (one main rotor on a mast, tail boom, skids) ---------- */
function ddHeli(D, g, st, step, add, shadow){
  const blk = matOf('#26241f'), dark = matOf('#1b1a18'), pal = PALS[D.pal];
  const zB = 320, zD = 640;                                  // belly and deck of the moulded body
  st.zMotor = 700; st.zP = 812; st.top = 860;                // the generic pass puts the head can and the blades here
  const body = dd2Oct(210, zB, zD, 44), nose = dd2Oct(122, zB + 44, zD - 96, 32);
  if (step('frame')){
    // two wide rails: a 25 kg machine lands hard, and the chin sensor needs clearance
    for (const s of [-1, 1]){
      add('skid', ddBox(-600, s > 0 ? 288 : -306, 0, 500, s > 0 ? 306 : -288, 22, blk, .9, 1.3), { at: [440, 300*s, 22] });
      for (const x of [-380, 300]) add('skid', ddRod([x, 296*s, 20], [x*.88, 176*s, zB], 9, blk, .9), { at: [x*.94, 236*s, (22 + zB)/2] });
      shadow.push(ddXF([-520, 296*s, 0]), ddXF([430, 296*s, 0]));
    }
    // the keel: body, payload rail and mast all bolt to this beam
    add('plate', ddBox(-840, -130, zB - 24, 700, 130, zB, DD_CARBON, .9, 1.3), { at: [-820, 130, zB] });
    for (const x of [-640, -120, 400]) add('plate', ddBox(x, -206, zB - 2, x + 22, 206, zB + 20, DD_CARBON, .8, 1));
  }
  if (step('boom')){
    // the boom tapers aft and carries the tail drive shaft inside it
    add('boom', ddRod([-620, 0, 470], [-2350, 0, 470], 76, blk, 1.2, 46, 18), { at: [-1500, 0, 546] });
    add('boom', ddRod([-660, 0, 470], [-2260, 0, 470], 13, DD_SILVER, .6, 9, 12), { inner: true });
    // the fin: a slab the tail gearbox and rotor hang on, with a painted tip for the crew to see
    add('boom', ddSlab([[-2354, 336], [-2286, 336], [-2286, 690], [-2312, 806], [-2354, 762]], -13, 13, blk), { at: [-2322, 13, 720] });
    add('boom', ddSlab([[-2318, 756], [-2350, 748], [-2350, 762], [-2312, 806]], 13, 18, pal, .6));
    // the tail skid: it keeps the boom off the ground when the machine sits tail-down
    add('gear', ddRod([-2140, 0, 430], [-2140, 0, 14], 9, blk, .9), { at: [-2140, 0, 180] });
    add('skid', ddBox(-2192, -42, 0, -2088, 42, 14, DD_RUBBER, .8, 1));
    shadow.push(ddXF([-2140, 0, 0]));
  }
  if (step('motors')){
    // engine and gearbox under the deck; the mast comes up through the roof
    add('engine', ddBox(-250, -145, 372, 250, 145, 600, matOf('#3a3833'), .9, 1.4), { inner: true, at: [250, 145, 470] });
    add('engine', ddBox(-236, -155, 560, 236, 155, 606, matOf('#232120'), .8, 1));
    add('mast', ddRod([0, 0, 588], [0, 0, 708], 26, DD_SILVER, 1, 22, 16), { at: [0, 26, 650] });
    for (const s of [-1, 1]) add('engine', ddRod([-150, 118*s, 620], [-250, 132*s, 700], 18, dark, .9, 14), { at: [-250, 132*s, 700] });
  }
  if (step('esc')){
    const esc = ddBox(-240, -100, 342, 10, 100, 354, DD_PCB_E, .8, 1);
    let svg = esc.svg; for (let i = 0; i < 5; i++) svg += ddBox(-222 + i*42, -82, 354, -200 + i*42, 82, 362, DD_CHIP, .5, .6).svg;
    add('esc', { svg, pts: esc.pts }, { inner: true, at: [10, 100, 354] });
  }
  if (step('fc')){
    const fc = ddBox(-320, -85, 430, -60, 85, 442, DD_PCB_F, .8, 1.2);
    add('fc', { svg: fc.svg + ddBox(-220, -40, 442, -160, 40, 450, DD_CHIP, .5, .6).svg, pts: fc.pts }, { inner: true, at: [-60, 85, 442] });
    add('gyro', ddBox(-120, -20, 442, -100, 0, 446, matOf('#d8d8d8'), .5, .6), { inner: true });
    // GPS on the nose deck, a stub behind the mast and a whip on the boom
    add('gps', ddBox(420, -58, zD - 4, 540, 58, zD + 8, matOf('#2f3640'), .9, 1.2), { at: [480, 58, zD + 8] });
    add('antenna', ddRod([-80, 0, zD - 4], [-80, 0, zD + 72], 5, blk, .8), { at: [-80, 0, zD + 70] });
    add('antenna', ddRod([-1500, 64, 500], [-1760, 74, 330], 3.5, blk, .8), { at: [-1760, 74, 322] });
  }
  const gx = 760, gz = 240, gr = 185;
  if (step('camera')){
    // the sensor ball hangs under the nose on a two-arm fork: it can point straight down
    add('gimbal', ddBall(gx, 0, gz, gr, matOf('#191817')), { at: [gx, 0, gz + gr] });
    for (const s of [-1, 1]) add('gimbal', ddRod([gx - 70, 96*s, zB + 20], [gx - 6, (gr - 6)*s, gz + 30], 15, blk, .9));
    const lens = ddRod([gx + gr*.48, 0, gz], [gx + gr*.99, 0, gz], 54, matOf('#121110'), 1, 46);
    const gl = ddRod([gx + gr*.99, 0, gz], [gx + gr*1.03, 0, gz], 37, matOf('#4b6b9a'), .7);
    add('camera', { svg: lens.svg + gl.svg, pts: lens.pts }, { at: [gx + gr, 0, gz] });
  }
  if (step('wiring')){
    // inside an opaque body: keep the runs dark, so a part caught by the depth sort reads as a shadow, not a cable
    for (const s of [-1, 1]) add('xt60', ddWire([[40, 110*s, 400], [160, 150*s, 372], [300, 110*s, 356]], s > 0 ? '#7d332c' : '#2e2b28', 1.5), { inner: true });
    add('wire', ddWire([[250, 0, 390], [420, 0, 430], [640, 0, 500]], '#5a5a5a', .7), { inner: true });
    add('wire', ddWire([[0, 0, 340], [0, 60, 372], [60, 90, 470]], '#5a5348', .7), { inner: true });
  }
  if (step('shell')){
    // the moulded body: slab sides, a squared nose and a cowling hump behind the mast
    add('shell', ddSweep(body, -900, body, 620, blk, 1.9), { cover: true, at: [0, 210, 600] });
    add('shell', ddSweep(body, 620, nose, 900, blk, 1.5), { cover: true, at: [770, 150, 470] });
    add('shell', ddSweep(dd2Oct(150, zD - 8, zD + 66, 26), -600, dd2Oct(118, zD - 8, zD + 54, 22), -90, blk, 1.3), { cover: true, at: [-300, 150, zD + 66] });
    // the hatch panels the crew opens to reach the packs and the avionics
    for (const s of [-1, 1]) add('hatch', ddBox(-330, s > 0 ? 208 : -212, 360, 140, s > 0 ? 212 : -208, 560, matOf('#302e2a'), .7, 1), { cover: true });
  }
  if (step('payload')){
    // the bay: it hangs on two rails under the keel, so a crew can swap it in minutes
    add('bay', ddBox(-310, -160, 110, 310, 160, 296, matOf('#33302b'), 1, 1.6), { at: [310, 160, 200] });
    for (const s of [-1, 1]) add('bay', ddBox(-326, s > 0 ? 118 : -142, 292, 326, s > 0 ? 142 : -118, 306, DD_ALU, .8, 1));
    for (const x of [-250, 250]) for (const s of [-1, 1]) add('bay', ddCyl(x, 150*s, 300, 322, 9, DD_SILVER, .7, 10));
    // the sensor window in the bay's chin
    add('bay', ddBox(-110, -96, 104, 130, 96, 112, matOf('#2b3a44'), .8, 1));
    add('camera', ddBox(-96, -74, 96, 116, 74, 106, matOf('#3d5a70'), .7, 1), { at: [116, 74, 101] });
    shadow.push(ddXF([-310, -160, 0]), ddXF([310, 160, 0]));
  }
  if (step('battery')){
    for (const s of [-1, 1]){
      // packs in dark cases: they live inside the body, so nothing bright should read through the skin
      add('battery', ddBox(-350, s > 0 ? 40 : -200, 336, 150, s > 0 ? 200 : -40, 470, matOf('#39434b'), 1, 1.8), { inner: true, at: [150, 200*s, 400] });
      add('strap', ddBox(-70, s > 0 ? 34 : -206, 468, -54, s > 0 ? 206 : -34, 476, matOf('#2a2e33'), .7, .9), { cover: true });
    }
  }
  if (step('rotor')){
    // swashplate and pitch links: the two controls that reach the spinning blades
    add('rotor', ddCyl(0, 0, 660, 676, 74, DD_SILVER, .9, 18), { at: [74, 0, 668] });
    for (const s of [-1, 1]) add('rotor', ddRod([-34, 66*s, 676], [-14, 92*s, 700], 7, DD_SILVER, .8));
    // the blades: ddProp, so the blur disc and the spin arrows come from the same kit as every other prop.
    // chord .42: a rotor blade is far more slender than a quad prop, and at full size it would hide the body
    add('rotor', ddProp(0, 0, st.zP, g.rotorR, g.blades, 1, g.propCol, (st.spin || 0) + 18, st.speed || 0, .42), { at: [g.rotorR*.62, 0, st.zP + 2] });
    // the tail rotor: blades in a vertical plane, turning about the boom axis. The gearbox and shaft are
    // part of it, so the hub never looks like it floats beside the fin
    add('tailrotor', ddBox(-2342, 14, 528, -2284, 62, 596, blk, .8, 1));
    add('tailrotor', ddRod([-2315, 50, 560], [-2315, 118, 560], 22, dark, .8, 20));
    add('tailrotor', ddTailRotor(-2315, 130, 560, g.tailR, g.tailBlades, (st.spin || 0) + 55, g.propCol, st.speed || 0), { at: [-2315, 130, 560 + g.tailR] });
    if (st.arrows) add('tailrotor', ddTailArc(-2315, 130, 560, g.tailR, 200));
  }
}
// a rotor in a vertical plane (normal y): the blades sweep x-z, so it reads as a tail rotor and not a prop
function ddTailRotor(cx, cy, cz, R, blades, ang, col, speed){
  const M = matOf(col), blur = Math.min(1, (speed || 0)*1.6), pts = [];
  let s = '';
  if (blur > .05){ const ring = Array.from({ length: 24 }, (_, i) => { const a = i/24*2*Math.PI;
      return ddXF([cx + R*Math.cos(a), cy + 2, cz + R*Math.sin(a)]); });
    s += fill(pd(ring), col, `opacity="${f(.26*blur)}"`); pts.push(...ring); }
  for (let b = 0; b < blades; b++){
    const th = ang*Math.PI/180 + b*2*Math.PI/blades, c = Math.cos(th), sn = Math.sin(th);
    // w runs along the chord (tangential, so the blade has width), dy is its pitch
    const Q = (r, w, dy) => ddXF([cx + r*c - w*sn, cy + dy, cz + r*sn + w*c]);
    const q = [Q(26, 20, 5), Q(R*.6, 30, 4), Q(R, 13, 1), Q(R, -10, -1), Q(R*.6, -22, -1), Q(26, -12, -1)];
    let n = ddNormal(q); if (!vis(n)) n = n.map(v => -v);
    s += `<g opacity="${f(1 - .7*blur)}">` + shape(q, toneI(n, M), .8) + '</g>'; pts.push(...q);
  }
  const hub = ddRod([cx, cy - 15, cz], [cx, cy + 15, cz], 20, M, .8, 20, 12);
  return { svg: s + hub.svg, pts: [...pts, ...hub.pts, ...ellUV(cx, cz, R, R, 8).map(([u, v]) => ddXF([u, cy, v]))] };
}
// the spin arrow for it, in the same vertical plane
function ddTailArc(cx, cy, cz, R, a0deg){
  const r = R*.66, n = 9, a0 = a0deg*Math.PI/180, sw = -2.1, col = DD_CW;
  const arc = Array.from({ length: n + 1 }, (_, i) => { const a = a0 + sw*i/n; return ddXF([cx + r*Math.cos(a), cy + 4, cz + r*Math.sin(a)]); });
  const ae = a0 + sw, end = [cx + r*Math.cos(ae), cy + 4, cz + r*Math.sin(ae)], tg = [Math.sin(ae), 0, -Math.cos(ae)];
  const tip = ddXF([end[0] + tg[0]*R*.15, end[1], end[2] + tg[2]*R*.15]), rad = [Math.cos(ae), 0, Math.sin(ae)], w = R*.085;
  const head = [tip, ddXF([end[0] + rad[0]*w, end[1], end[2] + rad[2]*w]), ddXF([end[0] - rad[0]*w, end[1], end[2] - rad[2]*w])];
  const d = pd(arc, false);
  return { svg: `<path d="${d}" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round"/>` + shape(head, col, 1.1), pts: [...arc, ...head] };
}

/* ---------- extents (for framing and the build mat) ---------- */
function ddExtent(D){
  const g = D.geo;
  if (g.style === 'strike'){ const L = ddStrikeLayout(g); return { r: g.arm + g.propR, h: L.T0 + g.batt[2] + 16 }; }
  if (g.style === 'bolt') return { r: g.arm + g.propR, h: ddBoltZ.top + 20 };
  if (g.style === 'heli') return { r: g.rotorR + 60, h: 860 };
  const r = g.style === 'shell' ? 160 : g.arm + (g.style === 'duct' ? g.ductR + 3 : g.propR);
  const h = g.style === 'round' ? g.gearH + 200*g.plateR/165 : g.style === 'shell' ? 70 : g.style === 'duct' ? (g.whoop ? 32 : 62) : 12 + g.standH + (g.action ? 56 : g.batt[2] + 6);
  return { r, h };
}

/* ---------- thumbnails of the two fixed-wing types (hub only; they are not built yet) ---------- */
function ddWingThumb(D){
  const pal = PALS[D.pal], items = [];
  const wing = [[120, 0], [-40, 330], [-95, 330], [-70, 0], [-95, -330], [-40, -330]];
  // convex halves of the swept wing, split down the middle so each is convex
  for (const half of [[[120, 0], [-40, 330], [-95, 330], [-70, 0]], [[120, 0], [-70, 0], [-95, -330], [-40, -330]]]) items.push(ddPrism(half, 30, 44, pal, .9, 1.6));
  for (const s of [-1, 1]) items.push(ddBox(-98, s > 0 ? 330 : -336, 30, -46, s > 0 ? 336 : -330, 110, matOf('#3d3935'), .8, 1.2));
  items.push(ddRod([-70, 0, 37], [-92, 0, 37], 14, DD_CHIP, 1));
  items.push(ddBox(-97, -70, 33, -94, 70, 41, DD_CHIP, .8, 1));
  items.push(ddRod([118, 0, 40], [132, 0, 42], 8, DD_CHIP, .9));
  return items;
}
function ddVtolThumb(D){
  const pal = PALS[D.pal], items = [];
  items.push(ddSweep(rrUV(-40, 30, 40, 100, 20, 4), -260, rrUV(-40, 30, 40, 100, 20, 4), 180, DD_WHITE, 1.6));
  items.push(ddSweep(rrUV(-40, 30, 40, 100, 20, 4), 180, rrUV(-12, 58, 12, 80, 8, 4), 250, DD_WHITE, 1.2));
  items.push(ddPrism([[60, -560], [0, -560], [-10, 560], [60, 560]].map(([x, y]) => [x, y]), 92, 104, pal, .9, 1.5));
  for (const s of [-1, 1]){ items.push(ddRod([300, s*220, 90], [-420, s*220, 90], 10, DD_CARBON, 1));
    for (const x of [270, -390]){ items.push(ddCyl(x, s*220, 100, 120, 20, DD_SILVER, .9)); items.push(ddProp(x, s*220, 122, 150, 2, s*(x > 0 ? 1 : -1), '#3d3935', 30 + x, 0)); }
    items.push(ddBox(-440, s > 0 ? 220 : -310, 90, -390, s > 0 ? 310 : -220, 96, pal, .8, 1)); }
  items.push(ddRod([-260, 0, 65], [-290, 0, 65], 16, DD_CHIP, 1));
  items.push(ddBox(-294, -110, 60, -290, 110, 70, DD_CHIP, .8, 1));
  return items;
}
