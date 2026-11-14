// Echo's 3D model on its own: buildRobot() copied unchanged from robot-companion.js (lines 424-573; the myt Learning Hub's robot,
// used with myt's permission, see README.md), so a scene other than the floating companion can draw the same robot. Do not edit:
// copy it again if robot-companion.js changes. buildRobot(THREE) returns the rig (root, head, armL, armR, faces, ...), about 535 units tall.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function buildRobot(THREE) {
  const X = px => px - 369.5, Y = py => 601 - py, NECK = 300;
  // The brand's colours: a pearl shell with a clear coat, Telecom Blue trim, an indigo glass visor and an aqua face.
  const shell = new THREE.MeshPhysicalMaterial({ name: 'shell_pearl', color: 0xf1f3f8, roughness: 0.3, metalness: 0.03, clearcoat: 0.6, clearcoatRoughness: 0.26 });
  const trim = new THREE.MeshPhysicalMaterial({ name: 'trim_telecom_blue', color: 0x1a168c, roughness: 0.34, metalness: 0.18, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const visor = new THREE.MeshPhysicalMaterial({ name: 'visor_glass', color: 0x0b0a2c, emissive: 0x100c5c, emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glow = new THREE.MeshStandardMaterial({ name: 'face_aqua', color: 0xa5ecf3, emissive: 0x34cfe0, emissiveIntensity: 1.4, roughness: 0.4 });
  const node = (parent, name, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; };
  const add = (parent, name, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat); m.name = name; m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = mat === shell || mat === trim; parent.add(m); return m;
  };
  const lerpTable = (tbl, v) => { for (let i = 1; i < tbl.length; i++) if (v <= tbl[i][0]) { const [a, ra] = tbl[i - 1], [b, rb] = tbl[i]; return ra + ((rb - ra) * (v - a)) / (b - a); } return tbl[tbl.length - 1][1]; };
  const root = new THREE.Group(); root.name = 'robot';
  // `marks`: points on the body (the hand tips, the top of the head, the front of the belly) whose speed on the screen
  // sets how often it is drawn.
  const rig = { root, marks: [] };

  const bodyPx = [[316,0],[319,30],[322,52],[328,74],[334,88.5],[340,99.5],[346,108.5],[352,115.5],[358,121],[364,126],[370,130],[376,133],[382,136],[388,137.5],[394,138.75],[403,139.5],[412,139.5],[424,138.5],[436,137],[448,135.5],[460,134.5],[466,133.75],[478,130.5],[490,128.5],[502,124.5],[514,119.5],[526,113.5],[538,107],[550,99.5],[562,89.5],[574,76.5],[586,60.5],[592,48.5],[598,32],[600,18],[601,0]];
  const remap = py => (py < 400 ? py + (400 - py) * (400 - py) * 0.0031 : py);
  const raw = []; for (let py = 316; py <= 601; py += 2) raw.push([py, lerpTable(bodyPx, py)]);
  const smooth = raw.map(([py, r], i) => {
    if (i < 2 || i > raw.length - 3) return [py, r];
    let s = 0, w = 0;
    for (let k = -12; k <= 12; k++) { const wk = Math.exp((-k * k) / 40); s += raw[clamp(i + k, 0, raw.length - 1)][1] * wk; w += wk; }
    return [py, s / w];
  });
  const pts = smooth.reverse().map(([py, r]) => new THREE.Vector2(r, Y(remap(py))));
  pts[0].x = 0; pts[pts.length - 1].x = 0;
  add(root, 'body', new THREE.LatheGeometry(pts, 64), shell);
  rig.bodyR = y => { for (let i = 1; i < pts.length; i++) if (y <= pts[i].y) { const a = pts[i - 1], b = pts[i]; return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y || 1); } return 0; };
  add(root, 'neck', new THREE.CylinderGeometry(56, 58, 80, 48), trim, 0, Y(328), 0);

  const head = (rig.head = node(root, 'head_pivot', 0, NECK, 0));
  const HB = 40, HD = 120;
  const sq = (a, b, n, seg = 120) => {
    const s = new THREE.Shape();
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
      const x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), y = b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
      if (i) s.lineTo(x, y); else s.moveTo(x, y);
    }
    return s;
  };
  const headGeo = new THREE.ExtrudeGeometry(sq(164.5 - HB, 113.5 - HB, 4), { depth: HD, bevelEnabled: true, bevelThickness: HB, bevelSize: HB, bevelSegments: 10 });
  headGeo.translate(0, 0, -HD / 2);
  add(head, 'head', headGeo, shell, 0, Y(204.5) - NECK, 0);
  const front = HD / 2 + HB, faceZ = front + 6.3;

  const vTbl = [[0,0],[1.5,38],[5.5,73.5],[9.5,93.5],[13.5,107],[17.5,118],[21.5,126.3],[25.5,132.5],[29.5,136.5],[33.5,139.5],[37.5,142.5],[41.5,144.2],[45.5,145.5],[49.5,146.5]];
  const VH = 179.5, VB = 3, vs = new THREE.Shape(), half = [];
  for (let i = 0; i <= 72; i++) { const d = (VH * i) / 72; half.push([Math.max(0, lerpTable(vTbl, Math.min(d, VH - d)) - VB), ((VH / 2 - d) * (VH / 2 - VB)) / (VH / 2)]); }
  half.forEach(([x, y], i) => { if (i) vs.lineTo(x, y); else vs.moveTo(x, y); });
  for (let i = half.length - 2; i > 0; i--) vs.lineTo(-half[i][0], half[i][1]);
  const visorGeo = new THREE.ExtrudeGeometry(vs, { depth: 8, bevelEnabled: true, bevelThickness: 6, bevelSize: VB, bevelSegments: 5 });
  visorGeo.translate(0, 0, -8);
  add(head, 'visor', visorGeo, visor, 0, Y(216.25) - NECK, front);

  const eyeShape = () => {
    const s = new THREE.Shape(), r = 21.5;
    s.moveTo(r, 0); s.absarc(0, 0, r, 0, Math.PI, false); s.lineTo(-r, -5.5);
    s.quadraticCurveTo(-r, -8.2, -18.5, -8.3); s.quadraticCurveTo(0, -6.4, 18.5, -8.3); s.quadraticCurveTo(r, -8.2, r, -5.5); s.lineTo(r, 0);
    return s;
  };
  const flat = { depth: 1.6, bevelEnabled: false, curveSegments: 32 }, EYE_C = 6.6;
  [['L', 299.5, 'eye_left'], ['R', 439.5, 'eye_right']].forEach(([k, px, name]) => {
    const g = (rig['eye' + k] = node(head, name + '_pivot', X(px), Y(216.5) + EYE_C - NECK, faceZ));
    const geo = new THREE.ExtrudeGeometry(eyeShape(), flat); geo.translate(0, -EYE_C, 0);
    rig['eyeDome' + k] = add(g, name, geo, glow);
  });
  rig.eyeBase = { l: X(299.5), r: X(439.5), y: Y(216.5) + EYE_C - NECK };

  const ms = new THREE.Shape();
  ms.moveTo(-15, 4.5); ms.lineTo(15, 4.5); ms.quadraticCurveTo(18, 4.5, 18, 1.5); ms.lineTo(18, 0);
  ms.absellipse(0, 0, 18, 16.5, 0, Math.PI, true); ms.lineTo(-18, 1.5); ms.quadraticCurveTo(-18, 4.5, -15, 4.5);
  const mouthGeo = new THREE.ExtrudeGeometry(ms, flat); mouthGeo.translate(0, -4.5, 0);
  rig.mouth = node(head, 'mouth_pivot', 0, Y(256) + 4.5 - NECK, faceZ);
  rig.mouthSmile = add(rig.mouth, 'mouth', mouthGeo, glow);

  const earProfile = (inner, outer, R, f) => {
    const p = [new THREE.Vector2(0, inner), new THREE.Vector2(R, inner), new THREE.Vector2(R, outer - f)];
    for (let i = 1; i <= 12; i++) { const a = ((i / 12) * Math.PI) / 2; p.push(new THREE.Vector2(R - f + f * Math.cos(a), outer - f + f * Math.sin(a))); }
    p.push(new THREE.Vector2(0, outer));
    return p;
  };
  [[1, 'ear_left'], [-1, 'ear_right']].forEach(([s, name]) => {
    const geo = new THREE.LatheGeometry(earProfile(140, 195.5, 44, 20), 48); geo.rotateZ((s * Math.PI) / 2);
    add(head, name, geo, trim, 0, Y(207) - NECK, 0);
  });
  const capGeo = new THREE.CapsuleGeometry(26, 64, 8, 32); capGeo.rotateZ(Math.PI / 2); capGeo.scale(1, 1, 1.6);
  add(head, 'top_cap', capGeo, shell, 0, Y(93) - NECK, -8);
  rig.marks.push([head, new THREE.Vector3(0, Y(93) - NECK + 26, -8)], [root, new THREE.Vector3(0, Y(470), rig.bodyR(Y(470)))]);

  [[1, 'L', 'arm_left'], [-1, 'R', 'arm_right']].forEach(([side, k, name]) => {
    const T = [X(247) * side, Y(349)], Q = [X(179.5) * side, Y(463)], C = [X(182) * side, Y(517)];
    const bz = t => [(1 - t) * (1 - t) * T[0] + 2 * t * (1 - t) * Q[0] + t * t * C[0], (1 - t) * (1 - t) * T[1] + 2 * t * (1 - t) * Q[1] + t * t * C[1]];
    const bt = t => { const dx = 2 * (1 - t) * (Q[0] - T[0]) + 2 * t * (C[0] - Q[0]), dy = 2 * (1 - t) * (Q[1] - T[1]) + 2 * t * (C[1] - Q[1]), l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
    let Ls = 0;
    for (let i = 1, p = bz(0); i <= 200; i++) { const q = bz(i / 200); Ls += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
    const Rt = 27, Rb = 36, prof = [];
    for (let i = 0; i <= 14; i++) { const a = ((i / 14) * Math.PI) / 2; prof.push([Rt - Rt * Math.cos(a), Rt * Math.sin(a)]); }
    for (let i = 1; i < 30; i++) { const u = i / 30, s = u * u * (3 - 2 * u); prof.push([Rt + (Ls - Rt) * u, Rt + (Rb - Rt) * s]); }
    for (let i = 0; i <= 16; i++) { const a = ((i / 16) * Math.PI) / 2; prof.push([Ls + Rb * Math.sin(a), Rb * Math.cos(a)]); }
    prof[prof.length - 1][1] = 0;
    const geo = new THREE.LatheGeometry(prof.reverse().map(([u, r]) => new THREE.Vector2(r, -u)), 48);
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const u = -pos.getY(i), x = pos.getX(i), z = pos.getZ(i);
      let S, tm;
      if (u <= Ls) { S = bz(u / Ls); tm = bt(u / Ls); } else { tm = bt(1); S = [C[0] + tm[0] * (u - Ls), C[1] + tm[1] * (u - Ls)]; }
      const nm = [-tm[1], tm[0]];
      pos.setXYZ(i, S[0] + x * nm[0], S[1] + x * nm[1], z);
      const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
      nor.setXYZ(i, nx * nm[0] - ny * tm[0], nx * nm[1] - ny * tm[1], nz);
    }
    const P = bz(30 / Ls);
    geo.translate(-P[0], -P[1], 0);
    const pivot = (rig['arm' + k] = node(root, name + '_pivot', P[0] + 8 * side, P[1] - 20, -14));
    add(pivot, name, geo, shell);
    const tip = bt(1);
    rig.marks.push([pivot, new THREE.Vector3(C[0] + tip[0] * Rb - P[0], C[1] + tip[1] * Rb - P[1], 0)]);
    rig.armBias = Math.atan2(Math.abs(C[0] - P[0]), P[1] - C[1]);
  });

  // Expressions: more eye and mouth shapes in the same aqua, swapped in with a blink.
  const arcShape = () => { const s = new THREE.Shape(), R = 21.5, r = 12.5; s.moveTo(R, 0); s.absarc(0, 0, R, 0, Math.PI, false); s.lineTo(-r, 0); s.absarc(0, 0, r, Math.PI, 0, true); s.lineTo(R, 0); return s; };
  const heartShape = () => { const s = new THREE.Shape(); s.moveTo(0, -17); s.bezierCurveTo(-25, -2, -24, 17, -11.5, 19); s.bezierCurveTo(-5, 20, 0, 14.5, 0, 10); s.bezierCurveTo(0, 14.5, 5, 20, 11.5, 19); s.bezierCurveTo(24, 17, 25, -2, 0, -17); return s; };
  const starShape = () => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 9.5 : 22; if (i) s.lineTo(r * Math.cos(a), r * Math.sin(a)); else s.moveTo(r * Math.cos(a), r * Math.sin(a)); } s.closePath(); return s; };
  const crossShape = () => { const s = new THREE.Shape(), L = 19, w = 4.6; [[w, L], [w, w], [L, w], [L, -w], [w, -w], [w, -L], [-w, -L], [-w, -w], [-L, -w], [-L, w], [-w, w], [-w, L]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
  const eyeShapes = { arc: [arcShape, 0, -9], heart: [heartShape, 0, -1.5], star: [starShape, 0, 0], x: [crossShape, Math.PI / 4, 0] };
  rig.faces = { L: { dome: rig.eyeDomeL }, R: { dome: rig.eyeDomeR }, mouth: { smile: rig.mouthSmile } };
  for (const k of ['L', 'R']) {
    for (const [name, [make, rot, dy]] of Object.entries(eyeShapes)) {
      const geo = new THREE.ExtrudeGeometry(make(), flat); if (rot) geo.rotateZ(rot); geo.translate(0, dy, 0);
      const m = add(rig['eye' + k], 'eye_' + k + '_' + name, geo, glow); m.visible = false; rig.faces[k][name] = m;
    }
  }
  const oShape = new THREE.Shape(); oShape.absellipse(0, -12, 10, 12, 0, Math.PI * 2, false);
  const flatMouth = new THREE.Shape(), fw = 13, fh = 3.2;
  flatMouth.moveTo(-fw + fh, fh); flatMouth.lineTo(fw - fh, fh); flatMouth.absarc(fw - fh, 0, fh, Math.PI / 2, -Math.PI / 2, true);
  flatMouth.lineTo(-fw + fh, -fh); flatMouth.absarc(-fw + fh, 0, fh, -Math.PI / 2, Math.PI / 2, true);
  for (const [name, shape, dy] of [['o', oShape, 0], ['flat', flatMouth, -5]]) {
    const geo = new THREE.ExtrudeGeometry(shape, flat); geo.translate(0, dy, 0);
    const m = add(rig.mouth, 'mouth_' + name, geo, glow); m.visible = false; rig.faces.mouth[name] = m;
  }

  let triangles = 0, meshes = 0;
  root.traverse(o => { if (o.isMesh) { meshes++; const g = o.geometry; triangles += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  rig.triangles = Math.round(triangles); rig.meshes = meshes;
  return rig;
}
