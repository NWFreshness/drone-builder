/* vr/vr-app.js — the Drone Lab VR page: camera, headset session, controllers, HUD.
 *
 * Desktop is a hand-rolled orbit over a z-up scene (the same view self-test.html uses). A real
 * session gets the local-floor reference space and the stage is moved to table height in front of
 * the user; the camera is never touched, the headset owns it.
 *
 * Query presets, because typing with a headset on is miserable:
 *   ?d=<id>            drone id (freestyle, bolt, ghost, ...)
 *   ?done=<n|all>      build steps placed
 *   ?xr=0..1           see-through reveal at load
 *   ?demo=<key>        hover|climb|pitch|roll|yaw
 *   ?ink=<px>          face ink width in device pixels (default 2.2)
 *   ?spin=<deg>        prop phase at load (deterministic screenshots)
 */

import * as THREE from './vendor/three.module.js';
import * as VS from './vr-style.js';
import { buildDrone } from './vr-scene.js';

const Q = new URLSearchParams(location.search);
const ERRORS = [];
addEventListener('error', e => ERRORS.push(String(e.message || e)));
addEventListener('unhandledrejection', e => ERRORS.push(String(e.reason)));

const INK = 0x231e16, PAPER = '#f2efe7';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const DR = dlDrone(Q.get('d') || 'freestyle');

/* ---------------- model ---------------- */

const mod = buildDrone(DR);
const TOTAL = mod.stepCount;

const st = {
  done: 0, anim: 1, xr: 0, xrTarget: 0, demo: null,
  building: false, timer: 0, sel: null,
};

if (Q.has('done')) st.done = Q.get('done') === 'all' ? TOTAL : Math.max(0, Math.min(TOTAL, parseInt(Q.get('done'), 10) || 0));
st.anim = 1;
if (Q.has('xr')) st.xr = st.xrTarget = Math.min(1, Math.max(0, parseFloat(Q.get('xr')) || 0));
if (Q.has('spin')) mod.setSpin(parseFloat(Q.get('spin')) || 0);
if (Q.has('demo') && DL_PARTS && Q.get('demo')){
  // snap the attitude for a screenshot: the same easing with dt=1 lands exactly on the target
  st.demo = Q.get('demo');
  for (let i = 0; i < 3; i++) mod.setDemo(st.demo, 1);
}

/* ---------------- renderer, scene, camera ---------------- */

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(2);                              // 2x DPR: the ink is drawn in device pixels
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NoToneMapping;             // colours are already final
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);

const camera = new THREE.PerspectiveCamera(42, innerWidth/innerHeight, .01, 60);
camera.up.set(0, 0, 1);                                 // model space is z-up

// the stage: mat, shadow and the tilt pivot. Desktop leaves `world` alone; XR stands it on a table.
const world = new THREE.Group();
world.add(mod.stage);
scene.add(world);
scene.add(mod.labels.layer);                            // labels live in world space (billboards)

const bb = mod.bbox;
const target = new THREE.Vector3(0, 0, (bb[0][2] + bb[1][2])/2*VS.SCALE);
let yaw = 38, pitch = 27, dist = 1;

function placeCam(){
  const t = yaw*Math.PI/180, p = pitch*Math.PI/180;
  camera.position.set(
    target.x + dist*Math.cos(p)*Math.cos(t),
    target.y + dist*Math.cos(p)*Math.sin(t),
    target.z + dist*Math.sin(p));
  camera.lookAt(target);
}
{
  const box = new THREE.Box3().setFromObject(mod.stage);
  const r = box.getBoundingSphere(new THREE.Sphere()).radius;
  dist = r/Math.sin(camera.fov*.5*Math.PI/180)*.88;
  placeCam();
}

/* ink width: `?ink=<px>` pins it (deterministic screenshots), otherwise fitInk() keeps the stroke
   proportional to the model's apparent size — in the SVG the stroke scales with the zoom, so a
   fixed device-pixel width either turns small parts into black mush or makes a close-up look thin. */
let inkOverride = 0;
{
  const px = parseFloat(Q.get('ink'));
  if (px > 0){ inkOverride = px; VS.setInkWidths(px, px*1.55); }
}

const REF_INK = .0030;                     // ink px per model px: measured off the 2D assembly page
const _bbW = (bb[1][0] - bb[0][0])*VS.SCALE;
const _ctr = new THREE.Vector3((bb[0][0] + bb[1][0])/2*VS.SCALE, (bb[0][1] + bb[1][1])/2*VS.SCALE,
                               (bb[0][2] + bb[1][2])/2*VS.SCALE);
function fitInk(){
  if (inkOverride) return;
  const hpx = renderer.getDrawingBufferSize(_sz).y;
  const d = Math.max(.05, camera.position.distanceTo(_ctr));
  const modelPx = _bbW * hpx/(2*Math.tan(camera.fov*Math.PI/360)*d);
  const face = Math.min(6, Math.max(.85, REF_INK*modelPx));
  VS.setInkWidths(face, face*1.55);
}

/* ---------------- ink resolution (device pixels, per eye in XR) ---------------- */

const _sz = new THREE.Vector2();
let inkKey = '';
function syncInk(){
  renderer.getDrawingBufferSize(_sz);
  // XR draws both eyes into one buffer, so the per-eye viewport is half of it; LineMaterial works
  // in NDC per viewport, so half-width is what keeps the stroke the intended 2.2 device px.
  const w = Math.round(renderer.xr.isPresenting ? _sz.x/2 : _sz.x), h = _sz.y;
  const k = w + 'x' + h;
  if (k === inkKey) return;
  inkKey = k;
  VS.setInkResolution(w, h);
}
syncInk();

/* ---------------- pointer orbit (desktop) ---------------- */

let drag = null, moved = 0;
const el = renderer.domElement;
el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; el.setPointerCapture(e.pointerId); });
el.addEventListener('pointerup', e => {
  const wasDrag = moved > 4;
  drag = null;
  try { el.releasePointerCapture(e.pointerId); } catch (err) {}
  if (!wasDrag && !renderer.xr.isPresenting) pickAt(e.clientX, e.clientY);
});
el.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  moved += Math.abs(dx) + Math.abs(dy);
  yaw += dx*.35;
  pitch = Math.max(-4, Math.min(88, pitch + dy*.28));
  drag = { x: e.clientX, y: e.clientY };
  placeCam();
});
el.addEventListener('wheel', e => {
  e.preventDefault();
  dist = Math.max(.12, Math.min(12, dist*(1 + Math.sign(e.deltaY)*.08)));
  placeCam();
}, { passive: false });

/* ---------------- HUD ---------------- */

const hud = document.getElementById('hud');
const fmtW = g => g >= 1000 ? (g/1000).toFixed(g >= 10000 ? 1 : 2) + ' kg' : Math.round(g) + ' g';
function weightNow(){
  return mod.steps.slice(0, st.done).reduce((a, i) => a + (DR.wt[DL_STEPS[i].k] || 0), 0);
}
let flashTxt = '', flashUntil = 0, hudAt = 0;
function flash(t){ flashTxt = t; flashUntil = performance.now() + 2200; }

function stepBlurb(){
  if (st.sel && DL_PARTS[st.sel]) return [DL_PARTS[st.sel][0], DL_PARTS[st.sel][1]];
  if (st.demo) return ['HOW IT FLIES: ' + st.demo.toUpperCase(), demoText(st.demo)];
  if (st.done){
    const i = mod.steps[st.done - 1], sp = DL_STEPS[i];
    return [`STEP ${st.done} OF ${TOTAL}: ${sp.name.toUpperCase()}`, (DR.stepText && DR.stepText[sp.k]) || sp.t];
  }
  return [DR.name.toUpperCase(), DR.blurb];
}
const DEMO_TXT = {
  hover:  'Every motor pushes the same and total thrust equals the weight. Two props spin clockwise and two counter-clockwise: the twists cancel, so it does not spin.',
  climb:  'Throttle up: all motors speed up together. Thrust is now more than the weight, so the drone accelerates upward. Throttle sets height, not speed.',
  pitch:  'Pitch forward: the flight controller speeds up the rear motors and slows the front ones. The nose dips and the thrust leans forward.',
  roll:   'Roll right: the left motors speed up and the right ones slow down, so the drone banks and slides right. Stop the stick and the gyro holds the angle.',
  yaw:    'Yaw right: the counter-clockwise props speed up and the clockwise ones slow down. The twists no longer cancel, so the frame turns.',
};
const demoText = k => DEMO_TXT[k] || '';

function drawHud(fps){
  const [h, t] = stepBlurb();
  const rows = [
    `<b>Drone Lab VR</b>  <span class="dim">${DR.cls}</span>`,
    `Step <b>${st.done}/${TOTAL}</b>   Weight <b>${fmtW(weightNow())}</b>   FPS <b>${fps.toFixed(0)}</b>`,
    ``,
    `<span class="hd">${h}</span><span class="body">${t}</span>`,
  ];
  if (performance.now() < flashUntil) rows.push(`<span class="flash">${flashTxt}</span>`);
  if (ERRORS.length) rows.push(`<span class="err">${ERRORS.length} JS error(s): ${ERRORS[0]}</span>`);
  hud.innerHTML = rows.join('\n');
}

/* ---------------- build controls ---------------- */

function place(){
  if (st.done >= TOTAL){ flash('Fully built'); return; }
  st.done++; st.anim = 0; st.sel = null; mod.labels.select(null);
}
function remove(){
  if (!st.done){ flash('Nothing to take off yet'); return; }
  st.building = false; st.done--; st.anim = 1; st.sel = null; mod.labels.select(null);
}
function buildAll(){
  if (st.done >= TOTAL){ flash('Already fully built'); return; }
  st.building = true; st.timer = 0;
}
function reset(){ st.building = false; st.done = 0; st.anim = 1; st.sel = null; st.demo = null; mod.labels.select(null); }
function toggleXR(){ st.xrTarget = st.xrTarget > .5 ? 0 : 1; }

/* ---------------- the 3D part panel (what a headset can actually read) ---------------- */

const MONO_FONT = MONO;
function wrapText(ctx, text, maxW){
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words){
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line){ lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
const panelCache = new Map();
function panelTexture(key){
  if (panelCache.has(key)) return panelCache.get(key);
  const [name, blurb] = DL_PARTS[key] || [key.toUpperCase(), ''];
  const W = 800, H = 340;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#fff4d6'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#231e16'; x.lineWidth = 7; x.strokeRect(3.5, 3.5, W - 7, H - 7);
  x.fillStyle = '#231e16';
  x.font = `700 34px ${MONO_FONT}`; x.fillText(name, 34, 66);
  x.fillStyle = 'rgba(35,30,22,.55)'; x.fillRect(34, 84, W - 68, 2);
  x.fillStyle = '#231e16'; x.font = `400 26px ${MONO_FONT}`;
  wrapText(x, blurb, W - 68).slice(0, 6).forEach((ln, i) => x.fillText(ln, 34, 128 + i*36));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  panelCache.set(key, tex);
  return tex;
}
const panel = new THREE.Mesh(new THREE.PlaneGeometry(.52, .221), new THREE.MeshBasicMaterial({
  map: panelTexture('fc'), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
panel.position.set(0, 0, -1);
panel.visible = false;
panel.renderOrder = 20;
scene.add(panel);

function showPanel(key){
  if (!key || !DL_PARTS[key]){ panel.visible = false; return; }
  panel.material.map = panelTexture(key);
  panel.material.needsUpdate = true;
  panel.visible = !!renderer.xr.isPresenting;
}

function placePanel(cam){
  const q = new THREE.Quaternion().setFromRotationMatrix(cam.matrixWorld);
  const p = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  panel.position.copy(p).addScaledVector(fwd, 1.0).addScaledVector(right, .16);
  panel.quaternion.copy(q);
}

/* ---------------- desktop picking ---------------- */

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
function pickAt(cx, cy){
  _ndc.set(cx/innerWidth*2 - 1, -(cy/innerHeight)*2 + 1);
  _ray.setFromCamera(_ndc, camera);
  const hit = _ray.intersectObjects(mod.parts.filter(p => p.at.visible).map(p => p.at), true)[0];
  const key = hit && keyOf(hit.object);
  if (key) { st.sel = key; mod.labels.select(key); showPanel(key); }
  else { st.sel = null; mod.labels.select(null); panel.visible = false; }
}
function keyOf(o){
  for (let n = o; n; n = n.parent) if (n.userData && n.userData.key) return n.userData.key;
  return null;
}

/* ---------------- keyboard ---------------- */

addEventListener('keydown', e => {
  if (/input|textarea|button/i.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'd' || k === 'arrowright' || k === ' ' || k === 'n') place();
  else if (k === 'a' || k === 'arrowleft' || k === 'backspace') remove();
  else if (k === 'b') buildAll();
  else if (k === 'r') reset();
  else if (k === 'l') mod.labels.show(!mod.labels.isOn());
  else if (k === 'x') toggleXR();
  else return;
  e.preventDefault();
});

/* ---------------- controllers ---------------- */

const raycaster = new THREE.Raycaster();
const controllers = [];
/* three's XRControllerModelFactory is not vendored (CONTRACT: no new runtime deps), so each hand
   gets a drawn wand instead of a glTF controller: cream barrel in the ink palette, ink cap. */
const wandGeo = new THREE.CylinderGeometry(.013, .016, .095, 12);
const wandMat = new THREE.MeshBasicMaterial({ color: 0xfff4d6, toneMapped: false });
const capGeo = new THREE.SphereGeometry(.014, 12, 8);
const capMat = new THREE.MeshBasicMaterial({ color: INK, toneMapped: false });
for (let i = 0; i < 2; i++){
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: .75, depthTest: false }));
  line.scale.z = .55; line.renderOrder = 8;
  c.add(line);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.007, 10, 8),
    new THREE.MeshBasicMaterial({ color: INK, depthTest: false }));
  dot.visible = false; dot.renderOrder = 9;
  c.add(dot);
  c.addEventListener('selectstart', () => pickFrom(c, dot));
  c.addEventListener('squeezestart', () => toggleXR());
  scene.add(c);

  const grip = renderer.xr.getControllerGrip(i);
  const wand = new THREE.Mesh(wandGeo, wandMat);
  wand.rotation.x = Math.PI/2;
  wand.position.set(0, 0, -.03);
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.set(0, 0, .022);
  grip.add(wand, cap);
  scene.add(grip);

  // a controller has no pose outside a session: left visible it would hang at the world origin
  c.visible = false; grip.visible = false;
  controllers.push({ c, line, dot, grip });
}

function controllerRay(c){
  raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).transformDirection(c.matrixWorld);
  raycaster.far = 4;
}
function pickFrom(c, dot){
  controllerRay(c);
  const hit = raycaster.intersectObjects(mod.parts.filter(p => p.at.visible).map(p => p.at), true)[0];
  if (!hit){ st.sel = null; mod.labels.select(null); panel.visible = false; return; }
  const key = keyOf(hit.object);
  if (!key) return;
  st.sel = key;
  mod.labels.select(key);
  showPanel(key);
  dot.position.set(0, 0, -hit.distance);
  dot.visible = true;
}

/* thumbstick: one build step per push, with a deadzone, because a stick never returns exactly to 0 */
const stickWas = new Map();
function pollSticks(){
  const s = renderer.xr.getSession();
  if (!s) return;
  for (const src of s.inputSources){
    const gp = src.gamepad;
    if (!gp || !gp.axes || gp.axes.length < 4) continue;
    const id = (src.handedness || 'x') + ':' + (src.index ?? 0);
    const ay = gp.axes[3] || 0;
    const was = stickWas.get(id) || 0;
    if (Math.abs(ay) > .65 && Math.abs(was) <= .65){ if (ay < 0) place(); else remove(); }
    stickWas.set(id, ay);
  }
}

/* ---------------- XR session ---------------- */

const btn = document.getElementById('enter');
async function enterVR(){
  if (!navigator.xr){ flash('WebXR not available in this browser'); return; }
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-vr');
    if (!ok){ flash('No immersive-vr device connected'); return; }
    const s = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    renderer.xr.setReferenceSpaceType('local-floor');
    await renderer.xr.setSession(s);
  } catch (err){ flash('XR: ' + err.message); }
}
btn.addEventListener('click', enterVR);

renderer.xr.addEventListener('sessionstart', () => {
  // table placement: mat top 0.75 m up, model centre 0.55 m in front (the 5" quad's real size).
  // A 4 m helicopter would swallow the user at that range, so a big model pushes the rig back —
  // never scales the drone, just moves the table.
  const bb = mod.bbox;
  const r = Math.max(bb[1][0] - bb[0][0], bb[1][1] - bb[0][1])*.5*VS.SCALE;
  world.rotation.set(-Math.PI/2, 0, 0);                 // model z-up -> headset y-up
  world.position.set(0, .75, -Math.max(.55, r*1.35));
  mod.stage.rotation.z = .55;                           // nose to the right, three-quarter to the user
  btn.textContent = 'Exit VR';
  for (const k of controllers){ k.c.visible = true; k.grip.visible = true; }
  syncInk();
  flash('Point at a part and pull the trigger');
});
renderer.xr.addEventListener('sessionend', () => {
  world.rotation.set(0, 0, 0);
  world.position.set(0, 0, 0);
  mod.stage.rotation.z = 0;
  panel.visible = false;
  btn.textContent = 'Enter VR';
  for (const k of controllers){ k.c.visible = false; k.grip.visible = false; k.dot.visible = false; }
  placeCam();
  syncInk();
});

/* ---------------- resize ---------------- */

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  syncInk();
  placeCam();
});

/* ---------------- loop ---------------- */

const clock = new THREE.Clock();
let fps = 0, frames = 0, fpsT = 0, lastT = 0;

renderer.setAnimationLoop(time => {
  const t = time*0.001;
  const dt = lastT ? Math.min(.1, Math.max(0, t - lastT)) : 0;
  lastT = t;

  // build animation: one part settles in, then the next if "build all" is running
  if (st.anim < 1) st.anim = Math.min(1, st.anim + dt/.45);
  if (st.building && st.anim >= .999){
    st.timer += dt;
    if (st.timer > .22){
      st.timer = 0;
      if (st.done >= TOTAL) st.building = false; else place();
    }
  }
  // see-through eases, so X does not snap
  if (Math.abs(st.xr - st.xrTarget) > .001) st.xr += (st.xrTarget - st.xr)*Math.min(1, dt*7);
  else st.xr = st.xrTarget;

  mod.setStep(st.done, st.anim);
  mod.setDemo(st.demo, dt);
  mod.setXR(st.xr);
  fitInk();

  syncInk();

  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  if (renderer.xr.isPresenting){
    pollSticks();
    const eye = cam.cameras && cam.cameras.length ? cam.cameras[0] : cam;
    eye.updateMatrixWorld();
    const targets = mod.parts.filter(p => p.at.visible).map(p => p.at);
    for (const c of controllers){
      controllerRay(c.c);
      const hit = raycaster.intersectObjects(targets, true)[0];
      c.dot.visible = !!hit;
      if (hit) c.dot.position.set(0, 0, -hit.distance);
    }
    if (panel.visible) placePanel(eye);
  } else {
    camera.updateMatrixWorld();
  }

  mod.labels.update(cam, st.done);
  renderer.render(scene, camera);

  frames++; fpsT += dt;
  if (fpsT > .5){ fps = frames/fpsT; frames = 0; fpsT = 0; }
  if (t*1000 - hudAt > 180){ hudAt = t*1000; drawHud(fps); }
});

// first paint of the HUD, before the loop has measured anything
drawHud(0);

window.__VR = {
  mod, st, scene, camera, renderer,
  total: TOTAL, parts: mod.partCount, items: mod.itemCount,
  errors: ERRORS,
  step: n => { st.done = Math.max(0, Math.min(TOTAL, n)); st.anim = 1; mod.setStep(st.done, 1); },
  xr: v => { st.xr = st.xrTarget = v; mod.setXR(v); },
  info: () => ({ done: st.done, total: TOTAL, weight: weightNow(), sel: st.sel, demo: st.demo }),
};
