/* vr/vr-scene.js — one drone from src/drone-draw.js, as real 3D on a real mat.
 *
 * The drawing layer hands back world-space polygons (`vr` payloads, millimetres); vr-style.js turns
 * those into ink-and-wash meshes. This module is the middle: it calls ddModel once with the attitude
 * zeroed, so the geometry is baked at rest and the demo attitude becomes a rotation of one group —
 * cheap, and it keeps every part rigid the way a real airframe is.
 *
 * buildDrone(D) -> {
 *   group    the tilt pivot: rotate this for the demo (its origin is the drone centre, zc above the mat)
 *   stage    board + shadow + group, already positioned for the desktop camera; add this to the scene
 *   items    ddModel's raw items (one per part, a few with vr:null — ink-only rims)
 *   parts    the meshes actually built, one record per THREE.Group
 *   labels   the callout system: .layer (add to the scene), .show(on), .select(key), .update(cam, done)
 *   shadow   the shadow mesh, top/zP/motors as ddModel reports them, bbox in model millimetres
 *   setStep(done, anim)  build order, anim = 0..1 for the part being placed
 *   setXR(t)             see-through reveal 0..1 (cover parts ghost, inner parts appear)
 *   setDemo(name, dt)    hover|climb|pitch|roll|yaw, eased by dt seconds of frame time
 *   setSpin(v)           prop phase in degrees (deterministic screenshots)
 * }
 */

import * as THREE from './vendor/three.module.js';
import {
  partMesh, boardMesh, shadowMesh, solidMaterial, SCALE, INK,
} from './vr-style.js';

/* The 2D pages set this from the drawing module; the VR page turns it on once, here, so every
   dd* helper also carries its world-space polygons. Nothing else in the project reads it. */
DD_VR = true;

const S = SCALE;
const MAT = { l:'#8cc4a6', m:'#6aa585', d:'#3f6f56' };   // the assembly page's cutting mat, same green
const sstep = t => { t = Math.min(1, Math.max(0, t)); return t*t*(3 - 2*t); };

/* The 2D label order, reused verbatim: the outside parts normally, the electronics in see-through.
   A key missing from DL_PARTS never gets a pill (the glossary is the vocabulary). */
const WANT_OUT = ['payload','module','bay','plate','arm','duct','shell','boom','rotor','tailrotor','mast','skid',
  'motor','prop','camera','gimbal','action','battery','canopy','gear','antenna','engine','hatch','fc','esc','fin'];
const WANT_IN = ['fc','esc','gyro','rx','vtx','pdb','gps','xt60','cap','wire','battery','camera','payload','engine'];
const LABEL_MAX = 8;

const PILL_FRAC = .068;                                // pill height as a fraction of the model's width
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

function canvasPill(text){
  const fs = 26, padX = 16, padY = 11;
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  x.font = `600 ${fs}px ${MONO}`;
  const tw = Math.ceil(x.measureText(text).width);
  const w = tw + padX*2, h = fs + padY*2;
  c.width = w*2; c.height = h*2;                       // 2x, so the ink stays crisp in a headset
  x.scale(2, 2);
  x.font = `600 ${fs}px ${MONO}`;
  x.fillStyle = '#fff4d6'; x.strokeStyle = INK; x.lineWidth = 1.6;
  const r = 9, ww = w - 2, hh = h - 2;
  x.beginPath();
  if (x.roundRect) x.roundRect(1, 1, ww, hh, r); else x.rect(1, 1, ww, hh);
  x.fill(); x.stroke();
  x.fillStyle = INK; x.textBaseline = 'middle';
  x.fillText(text, padX, h/2 + 1);
  return { canvas: c, ratio: c.width/c.height };
}

function pill(text, height){
  const { canvas, ratio } = canvasPill(text);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
  m.scale.set(height*ratio, height, 1);
  m.renderOrder = 6;
  m.userData.h = height;
  return m;
}

/* The mat is part of the stage but must not tilt with the drone, so buildDrone returns the pivot
   (`group`) and the container (`stage`) separately: the app places the stage, tilts the pivot. */
export function buildDrone(D, opt = {}){
  DD_VR = true;
  DD_O = [0, 0, 0];                                    // model space == world space, then scaled once
  DD_T = { r:0, p:0, y:0, zc:0, lift:0 };              // zeroed: geometry must NOT be baked tilted
  DD_DZ = [0, 0, 0];

  const ext = ddExtent(D);
  const zc = opt.pivot != null ? opt.pivot : ext.h*.4;  // the 2D page's pivot height
  const drop = ext.h*1.4;

  /* build everything visible at once: the step machinery is ours, not the drawing layer's */
  const mod = ddModel(D, { show: () => 1, drop: 0, spin: 0, speeds: [], arrows: false, thrust: null, sel: null });

  const stage = new THREE.Group();
  stage.name = 'stage';
  const tilt = new THREE.Group();
  tilt.name = 'drone';
  tilt.position.set(0, 0, zc*S);
  const model = new THREE.Group();
  model.position.set(0, 0, -zc*S);                     // so tilt rotates about (0,0,zc), as ddXF does
  tilt.add(model);
  stage.add(tilt);

  /* ---- mat + shadow ---- */
  const bb = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (const it of mod.items) for (const b of it.box) for (let i = 0; i < 3; i++){
    bb[0][i] = Math.min(bb[0][i], b[i]); bb[1][i] = Math.max(bb[1][i], b[i]);
  }
  if (!isFinite(bb[0][0])) bb[0] = [-100, -100, 0], bb[1] = [100, 100, 0];
  // a pill is .068 of the model's width: same apparent size on a 25 cm whoop and a 2 m Bolt
  const pillH = Math.min(.3, Math.max(.005, Math.max(bb[1][0] - bb[0][0], bb[1][1] - bb[0][1])*S*PILL_FRAC));
  const board = boardMesh(bb, MAT);
  stage.add(board);
  const shadow = shadowMesh(mod.shadow || [], 0);
  stage.add(shadow);

  /* ---- one Group per item ---- */
  const parts = [], propPivots = [];
  for (const it of mod.items){
    if (!it.vr) continue;                              // ink-only (duct rims): no mesh to build
    const pg = partMesh(it.vr);
    const rec = {
      key: it.key, step: it.step, cover: it.cover, inner: it.inner,
      at: pg, home: new THREE.Vector3(), drop: drop*S, body: null, sil: null,
    };
    // partMesh: [silhouette?, body, ink]. Only the body is a Mesh on the shared solid material.
    for (const ch of pg.children){
      if (!ch.isMesh) continue;
      if (ch.material === solidMaterial()) rec.body = ch; else if (!rec.sil) rec.sil = ch;
    }
    if (it.cover && rec.body){
      // ghosting needs per-part opacity, and the solid material is shared by every part: clone it.
      // Only cover parts pay for this (a canopy, a plate, a pod), the rest keep the shared one.
      const m = rec.body.material.clone();
      m.transparent = true; m.opacity = 1;
      rec.body.material = m;
    }
    rec.anchor = mod.labels[it.key] || null;

    if (it.key === 'prop' && mod.motors.length){
      // spin about the motor axis, not the model origin: find the motor this prop sits on
      const c = bbCentre(it.box);
      let best = mod.motors[0], bd = Infinity;
      for (const m of mod.motors){
        const d = (m.x*S - c.x)**2 + (m.y*S - c.y)**2;
        if (d < bd){ bd = d; best = m; }
      }
      const piv = new THREE.Group();
      piv.position.set(best.x*S, best.y*S, c.z);
      pg.position.set(-best.x*S, -best.y*S, -c.z);
      piv.add(pg);
      rec.at = piv; rec.home.copy(piv.position);
      propPivots.push({ piv, dir: best.dir });
    } else {
      rec.home.copy(pg.position);
    }
    rec.at.userData.key = it.key;                      // raycast picks these up
    rec.at.userData.part = rec;
    pg.userData.key = it.key;
    model.add(rec.at);
    parts.push(rec);
  }

  const steps = [...new Set(mod.items.map(it => it.step))].filter(i => i >= 0).sort((a, b) => a - b);
  const stepOf = {};
  for (const it of mod.items) if (stepOf[it.key] == null) stepOf[it.key] = it.step;

  /* ---- labels: a billboarded pill per part, pushed out to the side of its anchor ---- */
  const labelLayer = new THREE.Group();
  labelLayer.name = 'labels';
  const labelRecs = [];                                // {key, pill, leader, at}
  const leaderMat = new THREE.MeshBasicMaterial({
    color: INK, transparent: true, opacity: .6, depthTest: false, depthWrite: false,
    toneMapped: false, side: THREE.DoubleSide });
  const leaderGeo = new THREE.PlaneGeometry(1, 1);
  for (const key of Object.keys(mod.labels)){
    if (!DL_PARTS[key]) continue;
    const p = pill(DL_PARTS[key][0], pillH);
    // a fat GL line is ignored on every platform, and a 1px hairline vanishes at 2x: the leader is a
    // thin quad, scaled along the run and oriented in the billboard plane each frame.
    const leader = new THREE.Mesh(leaderGeo, leaderMat);
    leader.renderOrder = 5;
    labelLayer.add(p, leader);
    const rec = { key, pill: p, leader, at: mod.labels[key] };
    labelRecs.push(rec);
  }
  const leaderW = Math.max(.0008, pillH*.085);

  let labelsOn = true, selKey = null;

  function labelKeys(done){
    const place = done - 1;
    const want = xrT > .6 ? WANT_IN : WANT_OUT;
    const out = [];
    for (const r of labelRecs){
      const k = steps.indexOf(stepOf[r.key]);
      if (k < 0 || k > place) continue;                 // not built yet
      const rank = want.indexOf(r.key);
      if (rank < 0 && r.key !== selKey) continue;
      out.push({ r, rank: r.key === selKey ? -1 : rank });
    }
    out.sort((a, b) => a.rank - b.rank);
    return out.slice(0, LABEL_MAX).map(o => o.r);
  }

  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _right = new THREE.Vector3();

  /* Callouts are laid out in screen space (two columns, one per side of the model) and then placed
     back into the world at their anchor's depth: that keeps the pills off each other, off the HUD,
     and lets the leader line know exactly where the pill's near edge is. */
  function updateLabels(camera, done){
    if (!labelsOn || !camera){ labelLayer.visible = false; return; }
    labelLayer.visible = true;
    const cam = camera.isArrayCamera && camera.cameras && camera.cameras.length ? camera.cameras[0] : camera;
    _q.setFromRotationMatrix(cam.matrixWorld);
    _right.set(1, 0, 0).applyQuaternion(_q);

    const rows = labelKeys(done).map(r => {
      const w = model.localToWorld(_v.set(r.at[0]*S, r.at[1]*S, r.at[2]*S)).clone();
      const ndc = w.clone().project(cam);
      return { r, w, ndc, side: ndc.x >= 0 ? 1 : -1 };
    });
    for (const r of labelRecs){ r.pill.visible = false; r.leader.visible = false; }

    for (const side of [-1, 1]){
      const col = rows.filter(o => o.side === side).sort((a, b) => b.ndc.y - a.ndc.y);
      if (!col.length) continue;
      const dy = .15, yTop = side < 0 ? .30 : .80, yBot = -.80;   // the HUD owns the top-left corner
      const mid = col.reduce((a, o) => a + o.ndc.y, 0)/col.length;
      let ys = col.map((o, i) => mid + ((col.length - 1)/2 - i)*dy);
      const shift = ys[0] > yTop ? yTop - ys[0] : ys[ys.length - 1] < yBot ? yBot - ys[ys.length - 1] : 0;
      ys = ys.map(y => Math.min(yTop, Math.max(yBot, y + shift)));
      col.forEach((o, i) => {
        const pillPos = new THREE.Vector3(side*.58, ys[i], o.ndc.z).unproject(cam);
        const pillW = o.r.pill.scale.x;                 // the plane's width in metres
        const end = pillPos.clone().addScaledVector(_right, -side*(pillW/2 + .006));
        const r = o.r;
        r.pill.visible = true; r.leader.visible = true;
        r.pill.position.copy(pillPos);
        r.pill.quaternion.copy(_q);
        // leader: a quad from the anchor to the pill's near edge, lying in the screen plane
        const dir = end.clone().sub(o.w), len = dir.length();
        if (len < 1e-4){ r.leader.visible = false; return; }
        dir.normalize();
        const zAx = new THREE.Vector3(0, 0, 1).applyQuaternion(_q);
        const yAx = new THREE.Vector3().crossVectors(zAx, dir).normalize();
        r.leader.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, yAx, zAx));
        r.leader.position.copy(o.w).addScaledVector(dir, len*.5);
        r.leader.scale.set(len, leaderW, 1);
      });
    }
  }

  /* ---- state ---- */
  let doneN = 0, animV = 1, xrT = 0, spinDeg = 0, demoName = null;
  const att = { r:0, p:0, y:0, lift:0 };

  /* Step visibility is `visible` plus the drop the 2D page animates with DD_DZ: an opacity fade on
     every part would mean cloning the shared solid material 74 times and would sort-z-fight thin
     plates. The see-through reveal does clone — but only the few cover parts, where the fade is the
     whole point (and where the black silhouette has to go, or it shows through as a blob). */
  function apply(){
    const place = doneN - 1;
    for (const r of parts){
      const k = steps.indexOf(r.step);
      const built = k >= 0 && k <= place;
      const placing = built && k === place && animV < .999;
      const show = built && !(r.inner && xrT <= .02);
      r.at.visible = show;
      r.at.position.z = r.home.z + (placing ? (1 - sstep(animV))*r.drop : 0);
      if (r.body && r.cover){
        const f = 1 - .84*sstep(xrT);
        r.body.material.opacity = f;
        if (r.sil) r.sil.visible = f > .995;
      }
    }
  }

  function setStep(done, anim = 1){
    doneN = Math.max(0, Math.min(steps.length, done));
    animV = anim;
    apply();
  }
  function setXR(t){ xrT = Math.min(1, Math.max(0, t || 0)); apply(); }

  function setSpin(v){
    spinDeg = v || 0;
    const rad = spinDeg*Math.PI/180;
    for (const p of propPivots) p.piv.rotation.z = -p.dir*rad;
  }

  /* Demo attitude. ddXF applies roll about x, then pitch about y, then yaw about z, so the Euler
     order that reproduces it exactly is ZYX (three applies the first-named axis last). */
  function setDemo(name, dt){
    demoName = name || null;
    const t = Math.min(.1, Math.max(0, dt || 0));
    const base = demoName === 'climb' ? 1.35 : 1;
    const tr = demoName === 'roll' ? .16 : 0;
    const tp = demoName === 'pitch' ? .16 : 0;
    const tl = demoName ? ext.h*(demoName === 'climb' ? .7 : .35) : 0;
    const a = Math.min(1, t*3);
    att.r += (tr - att.r)*a; att.p += (tp - att.p)*a; att.lift += (tl - att.lift)*a;
    if (demoName === 'yaw') att.y -= t*.9;
    else { const y0 = Math.round(att.y/(2*Math.PI))*2*Math.PI; att.y += (y0 - att.y)*a; }
    tilt.rotation.set(att.r, att.p, att.y, 'ZYX');
    tilt.position.z = (zc + att.lift)*S;
    if (t) setSpin(spinDeg + t*900*(demoName ? base : 0));
  }

  apply();
  tilt.updateMatrixWorld(true);

  return {
    group: tilt, stage, board, shadow, model,
    items: mod.items, parts, steps, stepCount: steps.length,
    itemCount: mod.items.length, partCount: parts.length,
    top: mod.top, motors: mod.motors, zP: mod.zP, bbox: bb, pivot: zc, drop,
    labels: {
      layer: labelLayer, anchors: mod.labels, keys: () => labelRecs.map(r => r.key),
      show(on){ labelsOn = !!on; }, isOn: () => labelsOn,
      select(k){ selKey = k || null; },
      update(cam, done){ updateLabels(cam, done); },
    },
    setStep, setXR, setDemo, setSpin,
    get done(){ return doneN; },
    get demo(){ return demoName; },
  };
}

function bbCentre(box){
  return new THREE.Vector3((box[0][0] + box[1][0])/2*S, (box[0][1] + box[1][1])/2*S, (box[0][2] + box[1][2])/2*S);
}
