import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { createCharacter, createCompanion, makeRose, PALETTE } from './character.js';

// ---------------------------------------------------------------- Cảnh
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const SKY = 0xe6edff;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 16, 42);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(1.1, 1.7, 4.7);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.0, 0);
controls.enablePan = false;
controls.enableDamping = true;
controls.minDistance = 2.5;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd6f5, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
sun.shadow.bias = -0.002;
scene.add(sun, sun.target);
const SUN_OFFSET = new THREE.Vector3(4, 9, 6);

// Mặt đất: giấy vở màu kem + tấm thảm caro
function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f2e1';
  g.fillRect(0, 0, 1024, 1024);
  g.save();
  g.beginPath(); g.arc(512, 512, 250, 0, Math.PI * 2); g.clip();
  const n = 16, s = 500 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = (i + j) % 2 ? '#dfe7ff' : '#ffffff';
    g.fillRect(262 + i * s, 262 + j * s, s + 1, s + 1);
  }
  g.restore();
  g.strokeStyle = '#1c2a80';
  g.lineWidth = 5;
  g.beginPath(); g.arc(512, 512, 250, 0, Math.PI * 2); g.stroke();
  g.setLineDash([10, 14]);
  g.lineWidth = 3;
  g.beginPath(); g.arc(512, 512, 272, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const WORLD_R = 13;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(32, 32),
  new THREE.MeshToonMaterial({ map: groundTexture() }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const farGround = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0xf7f2e1 }));
farGround.rotation.x = -Math.PI / 2;
farGround.position.y = -0.01;
scene.add(farGround);

// Trang trí: hoa hồng xanh và mây như các nét vẽ nguệch ngoạc trong tranh
const decoMats = {
  rose: new THREE.MeshToonMaterial({ color: PALETTE.rose }),
  roseDark: new THREE.MeshBasicMaterial({ color: PALETTE.roseDark }),
  white: new THREE.MeshToonMaterial({ color: 0xffffff }),
};
const clouds = [];
for (let i = 0; i < 14; i++) {
  const a = (i / 14) * Math.PI * 2;
  const rad = 7.5 + (i % 3) * 2.2;
  const r = makeRose(0.3 + (i % 4) * 0.1, decoMats);
  r.position.set(Math.sin(a) * rad, 0.25 + (i % 4) * 0.08, Math.cos(a) * rad);
  r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-Math.sin(a) * 0.4, 1, -Math.cos(a) * 0.4).normalize());
  scene.add(r);
}
for (let i = 0; i < 9; i++) {
  const cloud = new THREE.Group();
  for (const [x, y, s] of [[0, 0, 0.5], [0.5, -0.05, 0.38], [-0.5, -0.05, 0.4], [0.2, 0.25, 0.36], [-0.25, 0.2, 0.3]]) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), decoMats.white);
    const o = new THREE.Mesh(puff.geometry, new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.BackSide }));
    o.scale.setScalar(1 + 0.03 / s);
    puff.add(o);
    puff.position.set(x, y, 0);
    cloud.add(puff);
  }
  const a = (i / 9) * Math.PI * 2 + 0.3;
  cloud.position.set(Math.sin(a) * (9 + (i % 3) * 3), 3.2 + (i % 4) * 1.1, Math.cos(a) * (9 + (i % 3) * 3));
  cloud.userData.a = a;
  cloud.scale.setScalar(1 + (i % 3) * 0.4);
  clouds.push(cloud);
  scene.add(cloud);
}

// ---------------------------------------------------------------- Nhân vật
const ch = createCharacter();
scene.add(ch.root);
const pal = createCompanion();
pal.position.set(0.9, 1.3, -0.5);
scene.add(pal);

const state = {
  pos: new THREE.Vector3(),
  y: 0, vy: 0, grounded: true,
  heading: 0, speed: 0,
  phase: 0,
  auto: null,          // 'walk' | 'run' : tự đi vòng tròn khi bấm nút
  emote: null, emoteT: 0, emoteDur: 0,
  landT: 1,
  blinkT: -1, nextBlink: 2,
  action: 'idle',
};

const REST = {
  hipY: 0, hipRX: 0, hipRZ: 0, torsoRX: 0, torsoRY: 0, torsoRZ: 0,
  headRX: 0, headRY: 0, headRZ: 0,
  aLX: 0, aLZ: 0.24, eLX: -0.12, eLZ: 0,
  aRX: 0, aRZ: -0.24, eRX: -0.12, eRZ: 0,
  lLX: 0, lRX: 0,
};
const pose = { ...REST };

// Tư thế mục tiêu cho từng hành động (tính theo thời gian t và pha bước chân p)
function targetPose(action, t, p) {
  const P = { ...REST };
  const s = Math.sin, abs = Math.abs;
  switch (action) {
    case 'idle':
      P.hipY = s(t * 2) * 0.006;
      P.headRZ = s(t * 0.8) * 0.04;
      P.headRY = s(t * 0.5) * 0.08;
      P.aLZ += s(t * 2) * 0.02; P.aRZ -= s(t * 2) * 0.02;
      break;
    case 'walk':
      P.lLX = -s(p) * 0.55; P.lRX = s(p) * 0.55;
      P.aLX = s(p) * 0.5; P.aRX = -s(p) * 0.5;
      P.eLX = -0.25; P.eRX = -0.25;
      P.hipY = abs(Math.cos(p)) * 0.03;
      P.hipRZ = s(p) * 0.04; P.headRZ = -s(p) * 0.03;
      P.torsoRX = 0.04; P.torsoRY = s(p) * 0.08;
      break;
    case 'run':
      P.lLX = -s(p) * 1.0; P.lRX = s(p) * 1.0;
      P.aLX = s(p) * 1.0; P.aRX = -s(p) * 1.0;
      P.aLZ = 0.35; P.aRZ = -0.35;
      P.eLX = -1.5; P.eRX = -1.5;
      P.hipY = abs(Math.cos(p)) * 0.08;
      P.hipRX = 0.12; P.torsoRX = 0.18; P.headRX = -0.15;
      P.torsoRY = s(p) * 0.14;
      break;
    case 'jump': {
      const up = state.vy > 0;
      P.aLZ = up ? 2.7 : 1.7; P.aRZ = up ? -2.7 : -1.7;
      P.eLX = -0.2; P.eRX = -0.2;
      P.lLX = up ? -0.7 : -0.15; P.lRX = up ? 0.35 : 0.15;
      P.headRX = up ? -0.25 : 0.1;
      P.torsoRX = up ? -0.08 : 0.08;
      break;
    }
    case 'talk':
      P.headRX = s(t * 5) * 0.05; P.headRZ = s(t * 2.3) * 0.07;
      P.aRX = -0.75; P.aRZ = -0.3; P.eRX = -1.3 + s(t * 4.5) * 0.3; P.eRZ = s(t * 3) * 0.2;
      P.aLX = -0.2 + s(t * 3.1) * 0.1; P.eLX = -0.6;
      P.torsoRY = s(t * 1.7) * 0.06;
      break;
    case 'laugh':
      P.hipY = abs(s(t * 11)) * 0.035;
      P.torsoRX = -0.14 + s(t * 11) * 0.03; P.headRX = -0.22; P.headRZ = s(t * 3) * 0.08;
      P.aRX = -1.15; P.aRZ = 0.3; P.eRX = -2.1;
      P.aLX = -0.45; P.aLZ = -0.2; P.eLX = -1.5;
      break;
    case 'wave':
      P.aRZ = -2.0; P.aRX = 0; P.eRX = 0; P.eRZ = -0.5 + s(t * 10) * 0.45;
      P.aLZ = 0.5; P.eLX = -0.2; P.eLZ = -0.9;
      P.headRZ = -0.14; P.torsoRZ = -0.06;
      P.hipY = abs(s(t * 5)) * 0.015;
      break;
    case 'cry':
      P.headRX = 0.3; P.torsoRX = 0.12; P.hipY = s(t * 17) * 0.008;
      P.torsoRZ = s(t * 2.2) * 0.03;
      P.aLX = -1.25; P.aLZ = -0.3; P.eLX = -2.15 + s(t * 6) * 0.08;
      P.aRX = -1.25; P.aRZ = 0.3; P.eRX = -2.15 - s(t * 6) * 0.08;
      P.lLX = 0.05; P.lRX = 0.05;
      break;
    case 'angry': {
      const stomp = Math.max(0, s(t * 9));
      P.aLZ = 0.55; P.aRZ = -0.55; P.aLX = 0.3; P.aRX = 0.3; P.eLX = 0; P.eRX = 0;
      P.torsoRX = 0.14; P.headRX = 0.1; P.headRZ = s(t * 30) * 0.02;
      P.lRX = -stomp * 0.7;
      P.hipY = -0.01 + stomp * 0.012;
      P.hipRZ = s(t * 30) * 0.012;
      break;
    }
  }
  return P;
}

function targetFace(action, t) {
  const s = Math.sin;
  switch (action) {
    case 'run': return { mouthOpen: 0.3, smile: 0.7 };
    case 'jump': return { mouthOpen: 0.6, smile: 0.9, blush: 0.7 };
    case 'talk': return { mouthOpen: 0.12 + 0.6 * Math.abs(s(t * 11)) * (0.6 + 0.4 * s(t * 3.7)), smile: 0.3 };
    case 'laugh': return { happy: 1, mouthOpen: 0.8 + 0.2 * s(t * 14), smile: 1, blush: 1 };
    case 'wave': return { mouthOpen: 0.4, smile: 0.9, blush: 0.8 };
    case 'cry': return { eyeOpen: 0, brow: -1, tears: 1, mouthOpen: 0.5 + 0.2 * s(t * 7), smile: -1, blush: 0.9 };
    case 'angry': return { angry: 1, brow: 1, mouthOpen: s(t * 3) > 0.2 ? 0.55 : 0.0, smile: -1, blush: 0.9 };
    default: return {};
  }
}

// ---------------------------------------------------------------- Điều khiển
const keys = new Set();
const joy = { x: 0, y: 0 };
const bubble = document.getElementById('bubble');
const buttons = [...document.querySelectorAll('[data-action]')];
let bubbleUntil = 0;

const EMOTES = {
  talk: { dur: 3.2, lines: ['Xin chào! Mình là Queen of White!', 'Hôm nay bạn có vui không?', 'Bố ơi, đợi con với!', 'Mình thích hoa hồng xanh lắm!'] },
  laugh: { dur: 3, lines: ['Ha ha ha!'] },
  wave: { dur: 2.8, lines: ['Xin chào!'] },
  cry: { dur: 4, lines: ['Hu hu hu...'] },
  angry: { dur: 3.6, lines: ['Hứ! Giận rồi đó!'] },
};

function say(text, seconds) {
  bubble.textContent = text;
  bubble.classList.add('show');
  bubbleUntil = clock.elapsedTime + seconds;
}

function speak(text) {
  const soundOn = document.getElementById('sound').checked;
  let dur = Math.max(1.8, text.length * 0.085);
  if (soundOn && 'speechSynthesis' in window) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'vi-VN';
      u.pitch = 1.7;
      u.rate = 1.0;
      u.onend = () => { if (state.emote === 'talk') state.emoteDur = Math.min(state.emoteDur, state.emoteT + 0.25); };
      speechSynthesis.speak(u);
      dur += 1.5; // chờ giọng đọc, onend sẽ kết thúc sớm hơn nếu xong
    } catch { /* trình duyệt không hỗ trợ giọng đọc */ }
  }
  return dur;
}

function startEmote(name, text) {
  const e = EMOTES[name];
  state.auto = null;
  state.emote = name;
  state.emoteT = 0;
  state.emoteDur = e.dur;
  const line = text || e.lines[Math.floor(Math.random() * e.lines.length)];
  if (name === 'talk') state.emoteDur = speak(line);
  say(line, state.emoteDur);
}

function jump() {
  if (!state.grounded) return;
  state.vy = 5.4;
  state.grounded = false;
  state.emote = null;
}

function blink() { state.blinkT = 0; state.blinks = 2; }

function doAction(name, text) {
  switch (name) {
    case 'idle': state.auto = null; state.emote = null; break;
    case 'walk': case 'run': state.emote = null; state.auto = name; break;
    case 'jump': jump(); break;
    case 'blink': blink(); break;
    default: startEmote(name, text);
  }
}
buttons.forEach((b) => b.addEventListener('click', () => doAction(b.dataset.action)));

document.getElementById('sayForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('sayText');
  doAction('talk', input.value.trim() || undefined);
  input.blur();
});

const HOTKEYS = { Digit1: 'idle', Digit2: 'walk', Digit3: 'run', Digit4: 'jump', Digit5: 'talk', Digit6: 'laugh', Digit7: 'wave', Digit8: 'cry', Digit9: 'blink', Digit0: 'angry' };
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); jump(); return; }
  if (HOTKEYS[e.code] && !e.repeat) { doAction(HOTKEYS[e.code]); return; }
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// Cần điều khiển cảm ứng
const stick = document.getElementById('stick');
const knob = document.getElementById('knob');
let stickId = null;
function stickMove(e) {
  const r = stick.getBoundingClientRect();
  let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
  let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  joy.x = x; joy.y = -y;
  knob.style.transform = `translate(${x * 32}px, ${y * 32}px)`;
}
stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); });
stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = (e) => { if (e.pointerId !== stickId) return; stickId = null; joy.x = joy.y = 0; knob.style.transform = ''; };
stick.addEventListener('pointerup', stickEnd);
stick.addEventListener('pointercancel', stickEnd);

// Đổi màu tóc / váy
document.getElementById('hairColor').addEventListener('input', (e) => ch.mats.hair.color.set(e.target.value));
document.getElementById('dressColor').addEventListener('input', (e) => ch.mats.dress.color.set(e.target.value));

// ---------------------------------------------------------------- Vòng lặp
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
const fwd = new THREE.Vector3();
const prev = new THREE.Vector3();
const WALK = 1.35, RUN = 3.7;

function angleLerp(a, b, k) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

function update(dt, t) {
  // --- Hướng di chuyển theo góc nhìn camera
  let ix = joy.x, iy = joy.y;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iy += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iy -= 1;
  const mag = Math.min(1, Math.hypot(ix, iy));

  let wantSpeed = 0;
  if (mag > 0.15) {
    state.auto = null;
    state.emote = null;
    camera.getWorldDirection(fwd);
    fwd.y = 0; fwd.normalize();
    const dx = fwd.x * iy - fwd.z * ix, dz = fwd.z * iy + fwd.x * ix;
    state.heading = angleLerp(state.heading, Math.atan2(dx, dz), 1 - Math.exp(-dt * 12));
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(joy.x, joy.y) > 0.85;
    wantSpeed = running ? RUN : WALK;
  } else if (state.auto) {
    wantSpeed = state.auto === 'run' ? RUN : WALK;
    const radius = state.auto === 'run' ? 3.2 : 2.2;
    state.heading += (wantSpeed / radius) * dt; // đi vòng tròn
    // kéo nhẹ về sân khấu nếu đi quá xa
    if (state.pos.length() > 4.5) state.heading = angleLerp(state.heading, Math.atan2(-state.pos.x, -state.pos.z), dt * 2);
  }
  state.speed += (wantSpeed - state.speed) * (1 - Math.exp(-dt * 8));
  prev.copy(state.pos);
  state.pos.x += Math.sin(state.heading) * state.speed * dt;
  state.pos.z += Math.cos(state.heading) * state.speed * dt;
  if (state.pos.length() > WORLD_R) state.pos.setLength(WORLD_R);

  // --- Nhảy
  if (!state.grounded) {
    state.vy -= 15 * dt;
    state.y += state.vy * dt;
    if (state.y <= 0) { state.y = 0; state.vy = 0; state.grounded = true; state.landT = 0; }
  }
  state.landT += dt;

  // --- Chọn hành động hiện tại
  if (state.emote) {
    state.emoteT += dt;
    if (state.emoteT > state.emoteDur) state.emote = null;
  }
  let action = 'idle';
  if (!state.grounded) action = 'jump';
  else if (state.speed > (WALK + RUN) / 2) action = 'run';
  else if (state.speed > 0.15) action = 'walk';
  else if (state.emote) action = state.emote;
  state.action = action;
  state.phase += dt * state.speed * (action === 'run' ? 2.7 : 4.6);

  // --- Tư thế
  const target = targetPose(action, t, state.phase);
  const k = 1 - Math.exp(-dt * 16);
  for (const key in pose) pose[key] += (target[key] - pose[key]) * k;

  const squash = state.grounded ? Math.exp(-state.landT * 9) * Math.sin(state.landT * 22) * -0.16
    : THREE.MathUtils.clamp(state.vy * 0.02, -0.06, 0.1);
  const shake = action === 'angry' ? Math.sin(t * 45) * 0.012 : 0;

  ch.root.position.set(state.pos.x + shake, state.y, state.pos.z);
  ch.root.rotation.y = state.heading;
  ch.body.position.y = pose.hipY;
  ch.body.scale.set(1 - squash * 0.6, 1 + squash, 1 - squash * 0.6);
  ch.hips.rotation.set(pose.hipRX, 0, pose.hipRZ);
  ch.torso.rotation.set(pose.torsoRX, pose.torsoRY, pose.torsoRZ);
  ch.head.rotation.set(pose.headRX, pose.headRY, pose.headRZ);
  ch.armL.rotation.set(pose.aLX, 0, pose.aLZ);
  ch.armR.rotation.set(pose.aRX, 0, pose.aRZ);
  ch.elbowL.rotation.set(pose.eLX, 0, pose.eLZ);
  ch.elbowR.rotation.set(pose.eRX, 0, pose.eRZ);
  ch.legL.rotation.x = pose.lLX;
  ch.legR.rotation.x = pose.lRX;
  // váy, tóc, nơ đung đưa theo chuyển động
  const air = state.grounded ? 0 : state.vy;
  ch.skirt.rotation.x = -state.speed * 0.035 + Math.sin(state.phase * 2) * 0.02 * Math.min(1, state.speed);
  ch.skirt.scale.set(1 - air * 0.02, 1 + air * 0.015, 1 - air * 0.02);
  ch.hairLong.rotation.x = -pose.headRX * 0.7 - pose.torsoRX * 0.6 + state.speed * 0.07 - air * 0.04 + Math.sin(t * 1.6) * 0.015;
  ch.hairLong.rotation.z = -pose.headRZ * 0.6 + Math.sin(state.phase) * 0.03 * Math.min(1, state.speed);
  ch.bow.rotation.x = -air * 0.03 + Math.sin(state.phase * 2) * 0.03 * Math.min(1, state.speed);
  ch.bow.scale.y = 1 + Math.sin(t * 2) * 0.02;

  // --- Khuôn mặt
  state.nextBlink -= dt;
  if (state.nextBlink <= 0) { state.blinkT = 0; state.blinks = Math.random() < 0.2 ? 2 : 1; state.nextBlink = 2 + Math.random() * 3.5; }
  let lid = 1;
  if (state.blinkT >= 0) {
    state.blinkT += dt;
    const BL = 0.16;
    lid = Math.abs(Math.cos((Math.min(state.blinkT, BL) / BL) * Math.PI));
    if (state.blinkT >= BL) { state.blinks -= 1; state.blinkT = state.blinks > 0 ? 0 : -1; }
  }
  ch.face.approach(targetFace(action, t), 1 - Math.exp(-dt * 14));
  ch.face.draw(t, lid);
  const ang = ch.face.v.angry;
  ch.anger.scale.setScalar(Math.max(0.001, ang * (0.26 + Math.sin(t * 12) * 0.04)));

  // --- Bạn thú bông bay theo sau
  const off = tmp.set(0.85, 0, -0.55).applyAxisAngle(THREE.Object3D.DEFAULT_UP, state.heading);
  const bob = action === 'laugh' ? Math.abs(Math.sin(t * 11)) * 0.15 : Math.sin(t * 2.2) * 0.07;
  const px = state.pos.x + off.x, pz = state.pos.z + off.z, py = 1.25 + state.y * 0.6 + bob;
  const pk = 1 - Math.exp(-dt * 3.5);
  pal.position.x += (px - pal.position.x) * pk;
  pal.position.z += (pz - pal.position.z) * pk;
  pal.position.y += (py - pal.position.y) * (1 - Math.exp(-dt * 6));
  pal.rotation.y = angleLerp(pal.rotation.y, state.heading - 0.35, pk);
  pal.rotation.z = Math.sin(t * 1.7) * 0.08 + (action === 'angry' ? Math.sin(t * 30) * 0.04 : 0);
  pal.rotation.x = action === 'cry' ? 0.3 : 0;

  // --- Camera + ánh sáng đi theo nhân vật
  camera.position.add(prev.sub(state.pos).negate());
  controls.target.set(state.pos.x, 1.0 + state.y * 0.5, state.pos.z);
  controls.update();
  sun.position.copy(state.pos).add(SUN_OFFSET);
  sun.target.position.copy(state.pos);

  for (const c of clouds) {
    c.position.y += Math.sin(t * 0.5 + c.userData.a * 3) * 0.002;
    c.lookAt(camera.position.x, c.position.y, camera.position.z);
  }

  // --- Giao diện: nút đang hoạt động + bong bóng thoại
  const shown = state.blinkT >= 0 && action === 'idle' ? 'idle' : action;
  for (const b of buttons) b.classList.toggle('active', b.dataset.action === shown);
  if (bubble.classList.contains('show')) {
    if (t > bubbleUntil || !state.emote) bubble.classList.remove('show');
    ch.head.getWorldPosition(tmp);
    tmp.y += 1.15;
    tmp.project(camera);
    bubble.style.left = `${(tmp.x * 0.5 + 0.5) * canvas.clientWidth}px`;
    bubble.style.top = `${(-tmp.y * 0.5 + 0.5) * canvas.clientHeight}px`;
  }
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 52 : 40; // màn hình dọc: nhìn rộng hơn
    camera.updateProjectionMatrix();
  }
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  resize();
  update(dt, clock.elapsedTime);
  renderer.render(scene, camera);
});

// Dùng để kiểm thử / nghịch trong console
window.app = { state, doAction, ch, camera, controls };
