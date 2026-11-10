// Dựng mô hình 3D "Queen of White" và bạn thú bông bằng các khối hình cơ bản.
// Nét viền xanh mực bút bi được giữ lại để giống bản vẽ trên giấy.
import * as THREE from 'three';
import { Face } from './face.js';

export const PALETTE = {
  ink: 0x1c2a80,
  skin: 0xffeee2,
  hair: 0x2c3c9e,
  white: 0xffffff,
  rose: 0x3f5fe6,
  roseDark: 0x1f3399,
  pale: 0xcfdcff,
};

const outlineMat = new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.BackSide });
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, ...extra });

// Tạo mesh kèm lớp viền (vỏ ngược phóng to một chút)
function part(geo, mat, w = 0.013) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  if (w > 0) {
    geo.computeBoundingSphere();
    const { radius, center } = geo.boundingSphere;
    const s = 1 + w / radius;
    const o = new THREE.Mesh(geo, outlineMat);
    o.scale.setScalar(s);
    o.position.copy(center).multiplyScalar(1 - s);
    m.add(o);
  }
  return m;
}

const Z = new THREE.Vector3(0, 0, 1);
function aim(obj, x, y, z) {
  obj.quaternion.setFromUnitVectors(Z, new THREE.Vector3(x, y, z).normalize());
  return obj;
}

function checkerTexture(repX, repY) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#1c2a80'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Bông hồng xanh có đường xoắn ốc như trong tranh
export function makeRose(r, mats) {
  const g = new THREE.Group();
  const core = part(new THREE.SphereGeometry(r, 18, 14), mats.rose, r * 0.13);
  core.scale.z = 0.75;
  g.add(core);
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 4.2;
    const rad = r * 0.82 * (i / 40);
    pts.push(new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad,
      r * 0.75 * Math.sqrt(1 - (rad / r) ** 2) + r * 0.02));
  }
  const spiral = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r * 0.055, 5),
    mats.roseDark);
  g.add(spiral);
  return g;
}

function heartGeometry(size) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9);
  s.bezierCurveTo(-1.6, 0.2, -0.8, 1.3, 0, 0.5);
  s.bezierCurveTo(0.8, 1.3, 1.6, 0.2, 0, -0.9);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
  geo.scale(size, size, size);
  return geo;
}

function angerSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#e8243c';
  g.lineWidth = 13;
  g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    g.save();
    g.translate(64, 64);
    g.rotate((i * Math.PI) / 2);
    g.beginPath();
    g.moveTo(14, 50);
    g.quadraticCurveTo(14, 14, 50, 14);
    g.stroke();
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.renderOrder = 10;
  return sp;
}

export function createCharacter() {
  const mats = {
    skin: toon(PALETTE.skin),
    hair: toon(PALETTE.hair, { side: THREE.DoubleSide }),
    dress: toon(PALETTE.white, { side: THREE.DoubleSide }),
    white: toon(PALETTE.white),
    rose: toon(PALETTE.rose),
    roseDark: new THREE.MeshBasicMaterial({ color: PALETTE.roseDark }),
    checker: toon(0xffffff, { map: checkerTexture(28, 7), side: THREE.DoubleSide }),
    ribbon: toon(0xffffff, { map: checkerTexture(2, 8), side: THREE.DoubleSide }),
  };

  const root = new THREE.Group();
  const body = new THREE.Group(); // nhún + co giãn
  root.add(body);

  // ---------- Chân ----------
  const makeLeg = (x) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.47, 0);
    const stocking = part(new THREE.CapsuleGeometry(0.058, 0.3, 4, 12), mats.white);
    stocking.position.y = -0.2;
    const shoe = part(new THREE.SphereGeometry(0.085, 16, 12), mats.rose, 0.012);
    shoe.scale.set(1, 0.8, 1.5);
    shoe.position.set(0, -0.41, 0.035);
    leg.add(stocking, shoe);
    body.add(leg);
    return leg;
  };
  const legL = makeLeg(0.105);
  const legR = makeLeg(-0.105);

  // ---------- Hông + váy ----------
  const hips = new THREE.Group();
  hips.position.y = 0.47;
  body.add(hips);

  const skirt = new THREE.Group();
  skirt.position.y = 0.28;
  hips.add(skirt);

  const profile = new THREE.SplineCurve([
    new THREE.Vector2(0.14, 0.02), new THREE.Vector2(0.2, -0.04),
    new THREE.Vector2(0.37, -0.19), new THREE.Vector2(0.5, -0.33),
    new THREE.Vector2(0.57, -0.44),
  ]).getPoints(14).reverse(); // từ gấu váy lên eo để mặt ngoài hướng ra
  const under = part(new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p.x * 1.02, p.y * 1.2)), 40), mats.checker, 0.012);
  under.position.y = -0.012;
  const over = part(new THREE.LatheGeometry(profile, 40), mats.dress, 0.014);
  skirt.add(under, over);
  for (let i = 0; i < 18; i++) { // diềm váy lượn sóng
    const a = (i / 18) * Math.PI * 2;
    const f = part(new THREE.SphereGeometry(0.062, 10, 8), mats.dress, 0.011);
    f.position.set(Math.sin(a) * 0.56, -0.44, Math.cos(a) * 0.56);
    f.scale.y = 0.8;
    skirt.add(f);
  }
  for (let i = 0; i < 6; i++) { // hoa hồng trên váy
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const hi = i % 2 === 0;
    const rad = hi ? 0.31 : 0.45, y = hi ? -0.13 : -0.27;
    const r = makeRose(hi ? 0.06 : 0.075, mats);
    r.position.set(Math.sin(a) * rad, y, Math.cos(a) * rad);
    aim(r, Math.sin(a), 0.75, Math.cos(a));
    skirt.add(r);
  }
  for (const s of [-1, 1]) { // dải ruy băng caro sau lưng
    const rb = part(new THREE.BoxGeometry(0.11, 0.5, 0.012), mats.ribbon, 0.008);
    rb.position.set(s * 0.13, -0.22, -0.36);
    rb.rotation.set(-0.72, 0, s * 0.28);
    skirt.add(rb);
  }
  const backBow = makeRose(0.07, mats);
  backBow.position.set(0, 0.0, -0.17);
  aim(backBow, 0, 0.3, -1);
  skirt.add(backBow);

  // ---------- Thân ----------
  const torso = new THREE.Group();
  torso.position.y = 0.28;
  hips.add(torso);
  const chest = part(new THREE.CapsuleGeometry(0.145, 0.12, 6, 16), mats.dress);
  chest.position.y = 0.12;
  torso.add(chest);
  for (let i = 0; i < 10; i++) { // cổ bèo
    const a = (i / 10) * Math.PI * 2;
    const f = part(new THREE.SphereGeometry(0.05, 10, 8), mats.dress, 0.01);
    f.position.set(Math.sin(a) * 0.115, 0.265, Math.cos(a) * 0.105);
    f.scale.y = 0.6;
    torso.add(f);
  }
  const chestRose = makeRose(0.065, mats);
  chestRose.position.set(0, 0.17, 0.15);
  aim(chestRose, 0, 0.25, 1);
  torso.add(chestRose);

  // ---------- Tay ----------
  const makeArm = (s) => {
    const arm = new THREE.Group();
    arm.position.set(s * 0.19, 0.22, 0);
    const puff = part(new THREE.SphereGeometry(0.095, 14, 12), mats.dress);
    puff.position.y = -0.02;
    const upper = part(new THREE.CapsuleGeometry(0.04, 0.14, 4, 10), mats.skin, 0.01);
    upper.position.y = -0.13;
    const elbow = new THREE.Group();
    elbow.position.y = -0.22;
    const fore = part(new THREE.CapsuleGeometry(0.038, 0.14, 4, 10), mats.skin, 0.01);
    fore.position.y = -0.09;
    const cuff = part(new THREE.TorusGeometry(0.045, 0.022, 8, 14), mats.dress, 0.008);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.17;
    const hand = part(new THREE.SphereGeometry(0.056, 12, 10), mats.skin, 0.01);
    hand.position.y = -0.225;
    elbow.add(fore, cuff, hand);
    arm.add(puff, upper, elbow);
    torso.add(arm);
    return { arm, elbow };
  };
  const L = makeArm(1), R = makeArm(-1);

  // ---------- Đầu ----------
  const head = new THREE.Group();
  head.position.y = 0.3;
  torso.add(head);
  const HC = 0.36; // tâm đầu
  const skull = part(new THREE.SphereGeometry(0.4, 32, 24), mats.skin);
  skull.position.y = HC;
  head.add(skull);

  const face = new Face();
  const A = 0.9;
  const faceMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.404, 32, 24, Math.PI / 2 - A, 2 * A, Math.PI / 2 - A, 2 * A),
    new THREE.MeshBasicMaterial({ map: face.texture, transparent: true, depthWrite: false }));
  faceMesh.position.y = HC;
  head.add(faceMesh);

  // Tóc: mái bằng + ót + tóc dài
  const hairTop = part(new THREE.SphereGeometry(0.44, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.455), mats.hair, 0.012);
  hairTop.position.y = HC;
  const hairBackCap = part(new THREE.SphereGeometry(0.44, 28, 18, Math.PI * 0.93, Math.PI * 1.14, 0, Math.PI * 0.74), mats.hair, 0.012);
  hairBackCap.position.y = HC;
  head.add(hairTop, hairBackCap);
  for (const s of [-1, 1]) { // tóc mai kiểu công chúa
    const lock = part(new THREE.CapsuleGeometry(0.075, 0.3, 4, 10), mats.hair, 0.011);
    lock.scale.z = 0.6;
    lock.position.set(s * 0.355, HC - 0.17, 0.2);
    lock.rotation.z = s * 0.06;
    head.add(lock);
  }
  const hairLong = new THREE.Group();
  hairLong.position.y = HC;
  const tail = part(new THREE.CapsuleGeometry(0.35, 0.72, 8, 20), mats.hair, 0.014);
  tail.scale.z = 0.38;
  tail.position.set(0, -0.36, -0.27);
  hairLong.add(tail);
  for (const s of [-1, 1]) {
    const strand = part(new THREE.CapsuleGeometry(0.1, 0.8, 4, 10), mats.hair, 0.012);
    strand.scale.z = 0.6;
    strand.position.set(s * 0.3, -0.42, -0.2);
    strand.rotation.z = s * 0.16;
    hairLong.add(strand);
  }
  head.add(hairLong);

  // Hoa hồng hai bên đầu + lọn tóc xoăn trắng
  for (const s of [-1, 1]) {
    const r = makeRose(0.12, mats);
    r.position.set(s * 0.43, HC + 0.07, 0.03);
    aim(r, s * 1, 0.1, 0.55);
    head.add(r);
    const curls = [[0.47, 0.3, -0.1, 0.085], [0.54, 0.2, -0.06, 0.07], [0.42, 0.38, -0.14, 0.07], [0.52, 0.33, -0.2, 0.06]];
    for (const [x, y, z, rad] of curls) {
      const cu = part(new THREE.SphereGeometry(rad, 10, 8), mats.white, 0.011);
      cu.position.set(s * x, HC + y, z);
      head.add(cu);
    }
  }
  // Nơ lớn trên đầu
  const bow = new THREE.Group();
  bow.position.set(0, HC + 0.5, -0.03);
  for (const s of [-1, 1]) {
    const lobe = part(new THREE.SphereGeometry(0.3, 18, 14), mats.white, 0.016);
    lobe.scale.set(1, 0.72, 0.3);
    lobe.position.set(s * 0.29, 0.05, 0);
    lobe.rotation.z = s * 0.38;
    const tip = makeRose(0.07, mats);
    tip.position.set(s * 0.33, -0.08, 0.09);
    aim(tip, s * 0.3, 0, 1);
    bow.add(lobe, tip);
  }
  const knot = makeRose(0.09, mats);
  knot.position.set(0, -0.03, 0.08);
  bow.add(knot);
  head.add(bow);

  const anger = angerSprite();
  anger.position.set(0.4, HC + 0.62, 0.25);
  anger.scale.setScalar(0.001);
  head.add(anger);

  return {
    root, body, hips, skirt, torso, head, hairLong, bow, anger, face, mats,
    legL, legR, armL: L.arm, elbowL: L.elbow, armR: R.arm, elbowR: R.elbow,
  };
}

// Bạn thú bông tròn trong tranh: mũ nồi, cổ bèo, ba trái tim trên bụng
export function createCompanion() {
  const mats = {
    white: toon(0xffffff),
    rose: toon(PALETTE.rose),
    roseDark: new THREE.MeshBasicMaterial({ color: PALETTE.roseDark }),
    pale: toon(PALETTE.pale),
    ink: new THREE.MeshBasicMaterial({ color: PALETTE.ink }),
  };
  const g = new THREE.Group();
  const belly = part(new THREE.SphereGeometry(0.21, 20, 16), mats.white);
  belly.scale.y = 1.12;
  belly.position.y = -0.2;
  const head = part(new THREE.SphereGeometry(0.27, 24, 18), mats.white);
  head.scale.set(1.08, 0.95, 1);
  head.position.y = 0.14;
  g.add(belly, head);

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), mats.ink);
    eye.position.set(s * 0.1, 0.15, 0.255);
    g.add(eye);
    // vạch mặt cáo từ mũi lên trán
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.085, 0.272),
      new THREE.Vector3(s * 0.05, 0.2, 0.262),
      new THREE.Vector3(s * 0.15, 0.31, 0.19),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.006, 5), mats.ink));
    const paw = part(new THREE.SphereGeometry(0.06, 10, 8), mats.white, 0.01);
    paw.position.set(s * 0.21, -0.12, 0.06);
    g.add(paw);
    const foot = part(new THREE.SphereGeometry(0.065, 10, 8), mats.white, 0.01);
    foot.position.set(s * 0.1, -0.42, 0.05);
    g.add(foot);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), mats.ink);
  nose.position.set(0, 0.08, 0.268);
  g.add(nose);

  for (let i = 0; i < 10; i++) { // cổ bèo
    const a = (i / 10) * Math.PI * 2;
    const f = part(new THREE.SphereGeometry(0.055, 8, 8), mats.pale, 0.01);
    f.position.set(Math.sin(a) * 0.17, -0.07, Math.cos(a) * 0.17);
    f.scale.y = 0.6;
    g.add(f);
  }
  const heartGeo = heartGeometry(0.028);
  [[0, -0.14], [-0.035, -0.22], [0.03, -0.3]].forEach(([x, y], i) => {
    const h = new THREE.Mesh(heartGeo, mats.rose);
    const zz = 0.21 * Math.sqrt(Math.max(0, 1 - ((y + 0.2) / 0.235) ** 2)) - 0.004;
    h.position.set(x, y, zz);
    h.rotation.z = (i - 1) * 0.2;
    g.add(h);
  });

  const beret = part(new THREE.SphereGeometry(0.2, 18, 12), mats.pale, 0.012);
  beret.scale.set(1.15, 0.42, 1.05);
  beret.position.set(0.05, 0.39, 0);
  beret.rotation.z = -0.25;
  g.add(beret);
  const hatRose = makeRose(0.06, mats);
  hatRose.position.set(0.08, 0.44, 0.1);
  aim(hatRose, 0.2, 0.8, 0.6);
  g.add(hatRose);
  const pom = part(new THREE.SphereGeometry(0.06, 10, 8), mats.rose, 0.01);
  pom.position.set(-0.27, -0.3, 0);
  g.add(pom);

  return g;
}
