import * as THREE from "three";

export type ObjectType =
  | "house"
  | "tower"
  | "tree"
  | "flower"
  | "windmill"
  | "shrine"
  | "lamp"
  | "pond"
  | "statue";

export function createObjectMesh(
  type: ObjectType,
  gx: number,
  gy: number
): THREE.Group {
  const g = new THREE.Group();

  switch (type) {
    case "house":
      buildHouse(g);
      break;
    case "tower":
      buildTower(g);
      break;
    case "tree":
      buildTree(g);
      break;
    case "flower":
      buildFlower(g, gx, gy);
      break;
    case "windmill":
      buildWindmill(g);
      break;
    case "shrine":
      buildShrine(g);
      break;
    case "lamp":
      buildLamp(g);
      break;
    case "pond":
      buildPond(g);
      break;
    case "statue":
      buildStatue(g);
      break;
  }

  return g;
}

function buildHouse(g: THREE.Group) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.6, 0.66),
    new THREE.MeshStandardMaterial({ color: 0xe9edf7, roughness: 0.8, metalness: 0.02 })
  );
  body.position.set(0, 0.3, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.56, 0.44, 4),
    new THREE.MeshStandardMaterial({ color: 0xff4fa6, roughness: 0.55 })
  );
  roof.position.set(0, 0.6 + 0.22, 0);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);

  const win = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.18),
    new THREE.MeshStandardMaterial({
      color: 0x0,
      emissive: 0xffd96a,
      emissiveIntensity: 1.4,
      side: THREE.DoubleSide,
    })
  );
  win.position.set(0, 0.3, 0.331);
  g.add(win);
}

function buildTower(g: THREE.Group) {
  const h = 3 * 0.62;
  const towerBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, h, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x9aaccd, roughness: 0.32, metalness: 0.02 })
  );
  towerBody.position.set(0, h / 2, 0);
  towerBody.castShadow = true;
  towerBody.receiveShadow = true;
  g.add(towerBody);

  const winMat = new THREE.MeshStandardMaterial({
    color: 0x0,
    emissive: 0x8fe0ff,
    emissiveIntensity: 1.1,
    side: THREE.DoubleSide,
  });
  for (let fy = 0; fy < 6; fy++) {
    for (let si = 0; si < 4; si++) {
      if (Math.random() < 0.5) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.12), winMat);
      const yy = 0.25 + (fy * (h - 0.4)) / 6;
      const off = 0.301;
      if (si === 0) win.position.set(-0.15 + Math.random() * 0.3, yy, off);
      else if (si === 1) {
        win.position.set(-0.15 + Math.random() * 0.3, yy, -off);
        win.rotation.y = Math.PI;
      } else if (si === 2) {
        win.position.set(off, yy, -0.15 + Math.random() * 0.3);
        win.rotation.y = Math.PI / 2;
      } else {
        win.position.set(-off, yy, -0.15 + Math.random() * 0.3);
        win.rotation.y = -Math.PI / 2;
      }
      g.add(win);
    }
  }

  const ant = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xb6ff3f, emissive: 0xb6ff3f, emissiveIntensity: 2 })
  );
  ant.position.set(0, h + 0.25, 0);
  g.add(ant);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xb6ff3f, emissive: 0xb6ff3f, emissiveIntensity: 3 })
  );
  beacon.position.set(0, h + 0.52, 0);
  g.add(beacon);
}

function buildTree(g: THREE.Group) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x7a4f33, roughness: 0.95 })
  );
  trunk.position.set(0, 0.2, 0);
  trunk.castShadow = true;
  g.add(trunk);

  const foli = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.34, 0),
    new THREE.MeshStandardMaterial({ color: 0x4fc06f, roughness: 0.85, flatShading: true })
  );
  foli.position.set(0, 0.64, 0);
  foli.castShadow = true;
  foli.receiveShadow = true;
  g.add(foli);

  const foli2 = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({ color: 0x6ad888, roughness: 0.85, flatShading: true })
  );
  foli2.position.set(0.1, 0.82, -0.05);
  foli2.castShadow = true;
  g.add(foli2);
}

function buildFlower(g: THREE.Group, gx: number, gy: number) {
  const colArr = [0xff7ad1, 0xffd24a, 0x7ad1ff, 0xb6ff3f];
  const col = colArr[(gx * 3 + gy) % 4];

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x46b86a, roughness: 0.9 })
  );
  stem.position.set(0, 0.12, 0);
  stem.castShadow = true;
  g.add(stem);

  const head = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.13, 0),
    new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.5,
      flatShading: true,
    })
  );
  head.position.set(0, 0.3, 0);
  head.castShadow = true;
  g.add(head);
}

// --- New object types ---

function buildWindmill(g: THREE.Group) {
  // Stone base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.7, 6),
    new THREE.MeshStandardMaterial({ color: 0xc9b89d, roughness: 0.9 })
  );
  base.position.set(0, 0.35, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  // Roof cap
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.3, 6),
    new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 })
  );
  cap.position.set(0, 0.85, 0);
  cap.castShadow = true;
  g.add(cap);

  // Blade hub + rotor group
  const bladeGroup = new THREE.Group();
  bladeGroup.position.set(0, 0.68, 0.3);
  bladeGroup.userData.isBladeGroup = true;

  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x5a4a3a })
  );
  hub.position.set(0, 0, -0.01);
  bladeGroup.add(hub);

  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xddd5c4, roughness: 0.7 });
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.4, 0.02),
      bladeMat
    );
    blade.position.set(
      Math.sin((i * Math.PI) / 2) * 0.2,
      Math.cos((i * Math.PI) / 2) * 0.2,
      0.01
    );
    blade.rotation.z = (i * Math.PI) / 2;
    bladeGroup.add(blade);
  }
  g.add(bladeGroup);

  // Door
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.18),
    new THREE.MeshStandardMaterial({
      color: 0x0,
      emissive: 0xffa54f,
      emissiveIntensity: 1.0,
      side: THREE.DoubleSide,
    })
  );
  door.position.set(0, 0.12, 0.35);
  g.add(door);
}

function buildShrine(g: THREE.Group) {
  // Torii gate
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.6 });
  const pillarGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7);

  const lp = new THREE.Mesh(pillarGeo, pillarMat);
  lp.position.set(-0.22, 0.35, -0.25);
  lp.castShadow = true;
  g.add(lp);

  const rp = new THREE.Mesh(pillarGeo, pillarMat);
  rp.position.set(0.22, 0.35, -0.25);
  rp.castShadow = true;
  g.add(rp);

  // Top beam (kasagi)
  const kasagi = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.05, 0.06),
    pillarMat
  );
  kasagi.position.set(0, 0.72, -0.25);
  g.add(kasagi);

  // Second beam (nuki)
  const nuki = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.035, 0.04),
    pillarMat
  );
  nuki.position.set(0, 0.56, -0.25);
  g.add(nuki);

  // Main hall
  const hall = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.35, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xf0e6d3, roughness: 0.85 })
  );
  hall.position.set(0, 0.175, 0.1);
  hall.castShadow = true;
  hall.receiveShadow = true;
  g.add(hall);

  // Shrine roof
  const sRoof = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.06, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.5 })
  );
  sRoof.position.set(0, 0.38, 0.1);
  sRoof.castShadow = true;
  g.add(sRoof);

  // Offering box glow
  const offering = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.06, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0x4a3520,
      emissive: 0xffd700,
      emissiveIntensity: 0.6,
    })
  );
  offering.position.set(0, 0.03, -0.08);
  g.add(offering);
}

function buildLamp(g: THREE.Group) {
  // Post
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.03, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.4, metalness: 0.5 })
  );
  post.position.set(0, 0.3, 0);
  post.castShadow = true;
  g.add(post);

  // Arm
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.02, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.4, metalness: 0.5 })
  );
  arm.position.set(0.08, 0.58, 0);
  arm.rotation.z = -0.3;
  g.add(arm);

  // Lantern housing
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.12, 0.1),
    new THREE.MeshStandardMaterial({
      color: 0x1a1a2a,
      emissive: 0xffcc66,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.85,
    })
  );
  housing.position.set(0.16, 0.54, 0);
  g.add(housing);

  // Glow bulb
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffcc66,
      emissive: 0xffcc66,
      emissiveIntensity: 2.5,
    })
  );
  bulb.position.set(0.16, 0.54, 0);
  g.add(bulb);

  // Point light for actual illumination
  const light = new THREE.PointLight(0xffcc66, 1.5, 2.5, 2.0);
  light.position.set(0.16, 0.54, 0);
  g.add(light);

  // Base plate
  const basePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.02, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a3a4a, metalness: 0.5 })
  );
  basePlate.position.set(0, 0.01, 0);
  g.add(basePlate);
}

function buildPond(g: THREE.Group) {
  // Stone rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.05, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x7a8a7a, roughness: 0.9 })
  );
  rim.position.set(0, 0.02, 0);
  rim.rotation.x = -Math.PI / 2;
  rim.receiveShadow = true;
  g.add(rim);

  // Water surface
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.33, 16),
    new THREE.MeshStandardMaterial({
      color: 0x2a5d8f,
      emissive: 0x1a3d5f,
      emissiveIntensity: 0.3,
      roughness: 0.1,
      metalness: 0.4,
      transparent: true,
      opacity: 0.85,
    })
  );
  water.position.set(0, 0.03, 0);
  water.rotation.x = -Math.PI / 2;
  g.add(water);

  // Lily pads
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x3d7a4f,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 3; i++) {
    const angle = (i * 2.3) + 0.5;
    const r = 0.15 + i * 0.05;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), padMat);
    pad.position.set(Math.cos(angle) * r, 0.035, Math.sin(angle) * r);
    pad.rotation.x = -Math.PI / 2;
    g.add(pad);
  }

  // Tiny flower on one pad
  const lilyFlower = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 6, 6),
    new THREE.MeshStandardMaterial({
      color: 0xff88cc,
      emissive: 0xff88cc,
      emissiveIntensity: 0.4,
    })
  );
  lilyFlower.position.set(Math.cos(0.5) * 0.15, 0.055, Math.sin(0.5) * 0.15);
  g.add(lilyFlower);
}

function buildStatue(g: THREE.Group) {
  // Pedestal
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.25, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.5, metalness: 0.1 })
  );
  pedestal.position.set(0, 0.125, 0);
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  g.add(pedestal);

  // Body (abstract figure)
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xc0c8d8, roughness: 0.3, metalness: 0.3 })
  );
  body.position.set(0, 0.45, 0);
  body.castShadow = true;
  g.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xc0c8d8, roughness: 0.3, metalness: 0.3 })
  );
  head.position.set(0, 0.72, 0);
  head.castShadow = true;
  g.add(head);

  // Star above head (magical glow)
  const star = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.05, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 2.0,
    })
  );
  star.position.set(0, 0.86, 0);
  g.add(star);

  // Pedestal inscription (emissive line)
  const inscription = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.03),
    new THREE.MeshStandardMaterial({
      color: 0x0,
      emissive: 0xb6ff3f,
      emissiveIntensity: 1.2,
      side: THREE.DoubleSide,
    })
  );
  inscription.position.set(0, 0.15, 0.151);
  g.add(inscription);
}
