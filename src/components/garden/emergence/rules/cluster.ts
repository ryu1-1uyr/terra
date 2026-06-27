import * as THREE from "three";
import { gpos } from "../../grid";
import { GRID } from "../../grid";
import type { Grid, EmergenceRule } from "../detect";
import { neighbors, findClusters, ADJ8 } from "../detect";
import { anim } from "../anim";
import { addLanternPost, addMushroom, addPaperLantern } from "../helpers";

function ruleTown(grid: Grid, root: THREE.Group) {
  const clusters = findClusters(grid, "house");
  for (const cluster of clusters) {
    if (cluster.length < 3) continue;
    for (const [gx, gy] of cluster) {
      const [px, pz] = gpos(gx, gy);
      const pave = new THREE.Mesh(
        new THREE.BoxGeometry(0.98, 0.02, 0.98),
        new THREE.MeshStandardMaterial({ color: 0x3a4560, roughness: 0.95 })
      );
      pave.position.set(px, 0.01, pz);
      pave.receiveShadow = true;
      root.add(pave);
    }
    for (const [gx, gy] of cluster) {
      const adjHouses = neighbors(grid, gx, gy).filter(
        (n) => n.cell.type === "house"
      );
      if (adjHouses.length >= 2) {
        const [px, pz] = gpos(gx, gy);
        addLanternPost(root, px + 0.38, pz + 0.38, 0xffd96a);
      }
    }
    const cx = cluster.reduce((s, [gx]) => s + gpos(gx, 0)[0], 0) / cluster.length;
    const cz = cluster.reduce((s, [, gy]) => s + gpos(0, gy)[1], 0) / cluster.length;
    const count = Math.min(cluster.length, 5);
    const vColors = [0xffcc88, 0x88ccff, 0xff88aa, 0xaaff88, 0xddaaff];
    for (let i = 0; i < count; i++) {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.09, 0.06),
        new THREE.MeshStandardMaterial({ color: vColors[i % vColors.length] })
      );
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xffdbb4 })
      );
      head.position.y = 0.07;
      body.add(head);
      root.add(body);
      const phase = (i / count) * Math.PI * 2;
      const r = 0.2 + (i % 3) * 0.12;
      const speed = 0.4 + (i % 2) * 0.15;
      anim(body, (t) => {
        const a = t * speed + phase;
        body.position.set(cx + Math.cos(a) * r, 0.06, cz + Math.sin(a) * r);
        body.rotation.y = a + Math.PI / 2;
      });
    }
  }
}

function ruleNightMarket(grid: Grid, root: THREE.Group) {
  const clusters = findClusters(grid, "house");
  for (const cluster of clusters) {
    if (cluster.length < 4) continue;
    for (const [gx, gy] of cluster) {
      const adjCount = neighbors(grid, gx, gy).filter(
        (n) => n.cell.type === "house"
      ).length;
      if (adjCount < 2) continue;
      const [px, pz] = gpos(gx, gy);
      const colors = [0xff6b9d, 0xffd93d, 0x6bcb77, 0x4d96ff];
      const col = colors[(gx * 7 + gy * 3) % colors.length];
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.03, 0.25),
        new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.3,
        })
      );
      awning.position.set(px, 0.52, pz + 0.42);
      root.add(awning);
    }
  }
}

function ruleForest(grid: Grid, root: THREE.Group) {
  const clusters = findClusters(grid, "tree");
  for (const cluster of clusters) {
    if (cluster.length < 3) continue;
    for (const [gx, gy] of cluster) {
      const [px, pz] = gpos(gx, gy);
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 4),
        new THREE.MeshStandardMaterial({
          color: 0x2d7a3e,
          roughness: 0.95,
          flatShading: true,
        })
      );
      bush.scale.set(1, 0.5, 1);
      bush.position.set(px + 0.25, 0.06, pz - 0.2);
      root.add(bush);

      if ((gx + gy) % 2 === 0) {
        const mush = addMushroom(root, px - 0.3, pz + 0.25);
        const cap = mush.children[1] as THREE.Mesh;
        const phase = gx * 1.7 + gy * 2.3;
        anim(mush, (t) => {
          const mat = cap.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 0.3 + 0.4 * Math.sin(t * 2.0 + phase);
        });
      }
    }
    for (const [gx, gy] of cluster) {
      const [px, pz] = gpos(gx, gy);
      const moss = new THREE.Mesh(
        new THREE.BoxGeometry(0.94, 0.015, 0.94),
        new THREE.MeshStandardMaterial({
          color: 0x1a4a2a,
          roughness: 1,
          transparent: true,
          opacity: 0.6,
        })
      );
      moss.position.set(px, 0.005, pz);
      root.add(moss);
    }
  }
}

function ruleFlowerField(grid: Grid, root: THREE.Group) {
  const clusters = findClusters(grid, "flower");
  for (const cluster of clusters) {
    if (cluster.length < 3) continue;

    for (const [gx, gy] of cluster) {
      const [px, pz] = gpos(gx, gy);
      const carpet = new THREE.Mesh(
        new THREE.PlaneGeometry(0.98, 0.98),
        new THREE.MeshStandardMaterial({
          color: 0x3a6b2a,
          emissive: 0x2a4a1a,
          emissiveIntensity: 0.1,
          roughness: 1,
        })
      );
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.set(px, 0.006, pz);
      carpet.receiveShadow = true;
      root.add(carpet);

      const colors = [0xff7ad1, 0xffd24a, 0x7ad1ff, 0xffaacc, 0xb6ff3f];
      for (let i = 0; i < 10; i++) {
        const col = colors[(gx * 3 + gy + i) % colors.length];
        const angle = (i / 10) * Math.PI * 2 + gx * 1.7 + gy * 0.3;
        const r = 0.1 + ((i * 7 + gx) % 5) * 0.06;
        const bx = px + Math.cos(angle) * r;
        const bz = pz + Math.sin(angle) * r;
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.006, 0.006, 0.06 + (i % 3) * 0.02),
          new THREE.MeshStandardMaterial({ color: 0x44884a })
        );
        const sh = 0.03 + (i % 3) * 0.01;
        stem.position.set(bx, sh, bz);
        root.add(stem);
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.025 + (i % 2) * 0.01, 5, 4),
          new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.4,
          })
        );
        petal.position.set(bx, sh * 2 + 0.01, bz);
        root.add(petal);
        const phase = gx * 1.3 + gy * 2.1 + i * 0.7;
        anim(stem, (t) => {
          stem.rotation.z = Math.sin(t * 1.5 + phase) * 0.15;
          stem.rotation.x = Math.cos(t * 1.2 + phase) * 0.1;
        });
        anim(petal, (t) => {
          petal.position.y = sh * 2 + 0.01 + Math.sin(t * 2.0 + phase) * 0.008;
          (petal.material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.3 + Math.sin(t * 2.5 + phase) * 0.3;
        });
      }
    }

    const midX = cluster.reduce((s, [gx]) => s + gpos(gx, 0)[0], 0) / cluster.length;
    const midZ = cluster.reduce((s, [, gy]) => s + gpos(0, gy)[1], 0) / cluster.length;
    const butterflyCount = Math.min(cluster.length, 4);
    const wingColors = [0xff88cc, 0xffdd66, 0x88ccff, 0xccff88];
    for (let bi = 0; bi < butterflyCount; bi++) {
      const wingMat = new THREE.MeshStandardMaterial({
        color: wingColors[bi % wingColors.length],
        emissive: wingColors[bi % wingColors.length],
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      });
      const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.035), wingMat);
      const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.035), wingMat);
      const body = new THREE.Group();
      wingL.position.x = -0.025;
      wingR.position.x = 0.025;
      body.add(wingL);
      body.add(wingR);
      root.add(body);
      const bPhase = bi * 1.57 + cluster[0][0] * 0.7;
      const bRadius = 0.5 + bi * 0.3;
      const bSpeed = 0.3 + bi * 0.08;
      anim(body, (t) => {
        const a = t * bSpeed + bPhase;
        body.position.set(
          midX + Math.cos(a) * bRadius + Math.sin(t * 0.7 + bPhase) * 0.2,
          0.25 + Math.sin(t * 1.5 + bPhase) * 0.12,
          midZ + Math.sin(a) * bRadius + Math.cos(t * 0.9 + bPhase) * 0.2
        );
        body.rotation.y = a + Math.PI / 2;
        const wingAngle = Math.sin(t * 12.0 + bPhase) * 0.6;
        wingL.rotation.y = -wingAngle;
        wingR.rotation.y = wingAngle;
      });
    }
  }
}

function ruleGardenEstate(grid: Grid, root: THREE.Group) {
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (grid[x][y]?.type !== "house") continue;
      const adjFlowers = neighbors(grid, x, y).filter(
        (n) => n.cell.type === "flower"
      );
      if (adjFlowers.length === 0) continue;
      const [px, pz] = gpos(x, y);
      const hedgeMat = new THREE.MeshStandardMaterial({
        color: 0x2e6b3a,
        roughness: 0.9,
        flatShading: true,
      });
      for (const side of [
        [0.42, 0],
        [-0.42, 0],
        [0, 0.42],
        [0, -0.42],
      ]) {
        const isX = side[0] !== 0;
        const hedge = new THREE.Mesh(
          new THREE.BoxGeometry(
            isX ? 0.08 : 0.8,
            0.15,
            isX ? 0.8 : 0.08
          ),
          hedgeMat
        );
        hedge.position.set(px + side[0], 0.075, pz + side[1]);
        hedge.castShadow = true;
        root.add(hedge);
      }
    }
  }
}

function ruleStreetTree(grid: Grid, root: THREE.Group) {
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (grid[x][y]?.type !== "tree") continue;
      const adjHouses = neighbors(grid, x, y).filter(
        (n) => n.cell.type === "house"
      );
      if (adjHouses.length === 0) continue;
      const [px, pz] = gpos(x, y);
      addLanternPost(root, px - 0.35, pz - 0.35, 0xffe8c2);
    }
  }
}

function ruleSacredTree(grid: Grid, root: THREE.Group) {
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      const cell = grid[x][y];
      if (cell?.type !== "tree" || cell.growth < 1.5) continue;
      const adjObjects = neighbors(grid, x, y, ADJ8);
      if (adjObjects.length > 0) continue;
      const [px, pz] = gpos(x, y);
      const toriiMat = new THREE.MeshStandardMaterial({
        color: 0xcc3333,
        roughness: 0.7,
        emissive: 0xcc3333,
        emissiveIntensity: 0.15,
      });
      for (const dx of [-0.2, 0.2]) {
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.35),
          toriiMat
        );
        pillar.position.set(px + dx, 0.175, pz + 0.4);
        root.add(pillar);
      }
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.04, 0.04),
        toriiMat
      );
      bar.position.set(px, 0.36, pz + 0.4);
      root.add(bar);

      const ringCount = 16;
      const ringGeo = new THREE.BufferGeometry();
      const ringPos = new Float32Array(ringCount * 3);
      ringGeo.setAttribute("position", new THREE.BufferAttribute(ringPos, 3));
      const ringPts = new THREE.Points(
        ringGeo,
        new THREE.PointsMaterial({
          color: 0xffd700,
          size: 0.1,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      root.add(ringPts);
      anim(ringPts, (t) => {
        const arr = ringGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < ringCount; i++) {
          const a = (i / ringCount) * Math.PI * 2 + t * 0.6;
          arr[i * 3] = px + Math.cos(a) * 0.45;
          arr[i * 3 + 1] = 0.4 + Math.sin(a * 3 + t) * 0.15;
          arr[i * 3 + 2] = pz + Math.sin(a) * 0.45;
        }
        ringGeo.attributes.position.needsUpdate = true;
      });
    }
  }
}

function ruleAvenue(grid: Grid, root: THREE.Group) {
  const visited = new Set<string>();
  for (let y = 0; y < GRID; y++) {
    let run: number[] = [];
    for (let x = 0; x <= GRID; x++) {
      if (x < GRID && grid[x][y]?.type === "tree") {
        run.push(x);
      } else {
        if (run.length >= 3) {
          for (let i = 0; i < run.length - 1; i++) {
            const key = `${run[i]},${y}-${run[i + 1]},${y}`;
            if (visited.has(key)) continue;
            visited.add(key);
            const [p1x] = gpos(run[i], y);
            const [p2x, pz] = gpos(run[i + 1], y);
            const mx = (p1x + p2x) / 2;
            addPaperLantern(root, mx, pz);
          }
        }
        run = [];
      }
    }
  }
  for (let x = 0; x < GRID; x++) {
    let run: number[] = [];
    for (let y = 0; y <= GRID; y++) {
      if (y < GRID && grid[x][y]?.type === "tree") {
        run.push(y);
      } else {
        if (run.length >= 3) {
          for (let i = 0; i < run.length - 1; i++) {
            const key = `${x},${run[i]}-${x},${run[i + 1]}`;
            if (visited.has(key)) continue;
            visited.add(key);
            const [px, p1z] = gpos(x, run[i]);
            const [, p2z] = gpos(x, run[i + 1]);
            const mz = (p1z + p2z) / 2;
            addPaperLantern(root, px, mz);
          }
        }
        run = [];
      }
    }
  }
}

function rulePlaza(grid: Grid, root: THREE.Group) {
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (grid[x][y] !== null) continue;
      const adj = neighbors(grid, x, y);
      const types = new Set(adj.map((n) => n.cell.type));
      if (adj.length < 3 || types.size < 2) continue;
      const [px, pz] = gpos(x, y);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.25, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: 0x7a8fa6, roughness: 0.5 })
      );
      base.position.set(px, 0.04, pz);
      base.receiveShadow = true;
      root.add(base);

      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.28),
        new THREE.MeshStandardMaterial({ color: 0x9aaccd, roughness: 0.4 })
      );
      pillar.position.set(px, 0.22, pz);
      root.add(pillar);

      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x4488cc,
        emissive: 0x224466,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7,
      });
      const waterTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.02, 8),
        waterMat
      );
      waterTop.position.set(px, 0.06, pz);
      root.add(waterTop);
      const phase = x * 2.3 + y * 1.7;
      anim(waterTop, (t) => {
        waterTop.scale.x = 1.0 + Math.sin(t * 2.5 + phase) * 0.05;
        waterTop.scale.z = 1.0 + Math.cos(t * 2.5 + phase) * 0.05;
        waterMat.emissiveIntensity = 0.5 + Math.sin(t * 3.0 + phase) * 0.3;
      });

      for (let i = 0; i < 4; i++) {
        const drop = new THREE.Mesh(
          new THREE.SphereGeometry(0.015, 4, 4),
          new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            emissive: 0x4488cc,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.6,
          })
        );
        root.add(drop);
        const dp = i * 1.57;
        anim(drop, (t) => {
          const prog = ((t * 0.8 + dp) % 1.0);
          const a = prog * Math.PI * 2;
          drop.position.set(
            px + Math.cos(a) * 0.06,
            0.22 + prog * 0.2 - prog * prog * 0.3,
            pz + Math.sin(a) * 0.06
          );
          drop.material.opacity = 0.6 * (1.0 - prog);
        });
      }
    }
  }
}

function ruleLotusGarden(grid: Grid, root: THREE.Group) {
  const clusters = findClusters(grid, "pond");
  for (const cluster of clusters) {
    if (cluster.length < 3) continue;
    const tileSet = new Set(cluster.map(([cx, cy]) => `${cx},${cy}`));

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a4d8a,
      emissive: 0x1a3d6f,
      emissiveIntensity: 0.6,
      roughness: 0.15,
      metalness: 0.5,
      transparent: true,
      opacity: 0.82,
    });
    for (const [cx, cy] of cluster) {
      const [px, pz] = gpos(cx, cy);
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(1.04, 1.04),
        waterMat
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(px, 0.045, pz);
      root.add(water);
    }
    anim(root, (t) => {
      waterMat.emissiveIntensity = 0.5 + Math.sin(t * 1.5) * 0.2;
    });

    for (const [cx, cy] of cluster) {
      const [px, pz] = gpos(cx, cy);
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        if (tileSet.has(`${cx + dx},${cy + dy}`)) continue;
        const edgeX = px + dx * 0.48;
        const edgeZ = pz + dy * 0.48;
        const stoneCount = 3 + ((cx * 7 + cy * 3 + dx + dy) % 3);
        const isXEdge = dx !== 0;
        for (let si = 0; si < stoneCount; si++) {
          const spread = (si / (stoneCount - 1) - 0.5) * 0.8;
          const stone = new THREE.Mesh(
            new THREE.SphereGeometry(0.04 + ((si * 3 + cx) % 3) * 0.015, 5, 4),
            new THREE.MeshStandardMaterial({
              color: 0x6a7a6a + ((si * 111) % 0x101010),
              roughness: 0.95,
              flatShading: true,
            })
          );
          stone.scale.y = 0.5;
          stone.position.set(
            edgeX + (isXEdge ? 0 : spread) + (Math.sin(si * 2.7) * 0.03),
            0.05,
            edgeZ + (isXEdge ? spread : 0) + (Math.cos(si * 3.1) * 0.03)
          );
          root.add(stone);
        }
      }
    }

    const midX = cluster.reduce((s, [cx]) => s + gpos(cx, 0)[0], 0) / cluster.length;
    const midZ = cluster.reduce((s, [, cy]) => s + gpos(0, cy)[1], 0) / cluster.length;

    for (let ri = 0; ri < 3; ri++) {
      const rippleMat = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        emissive: 0x88ccff,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.0,
      });
      const ripple = new THREE.Mesh(
        new THREE.TorusGeometry(0.05, 0.008, 4, 16),
        rippleMat
      );
      ripple.rotation.x = -Math.PI / 2;
      const [rcx, rcy] = cluster[ri % cluster.length];
      const [rpx, rpz] = gpos(rcx, rcy);
      ripple.position.set(rpx, 0.05, rpz);
      root.add(ripple);
      const rPhase = ri * 2.1;
      anim(ripple, (t) => {
        const prog = ((t * 0.4 + rPhase) % 3.0) / 3.0;
        const scale = 0.5 + prog * 6.0;
        ripple.scale.setScalar(scale);
        rippleMat.opacity = 0.35 * Math.max(0, 1.0 - prog);
      });
    }

    for (let i = 0; i < cluster.length; i++) {
      const [cx, cy] = cluster[i];
      const [px, pz] = gpos(cx, cy);
      if (i % 2 === 0) {
        const ox = ((cx * 3 + cy * 7) % 5 - 2) * 0.1;
        const oz = ((cx * 7 + cy * 3) % 5 - 2) * 0.1;
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.11, 0.008, 8),
          new THREE.MeshStandardMaterial({ color: 0x33aa44, roughness: 0.8 })
        );
        pad.position.set(px + ox, 0.05, pz + oz);
        root.add(pad);
        const bloom = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({
            color: 0xff88aa,
            emissive: 0xff88aa,
            emissiveIntensity: 0.5,
          })
        );
        bloom.position.set(px + ox, 0.06, pz + oz);
        root.add(bloom);
        const phase = cx * 1.3 + cy * 2.1;
        anim(pad, (t) => {
          pad.position.y = 0.05 + Math.sin(t * 1.2 + phase) * 0.006;
          pad.rotation.y = Math.sin(t * 0.5 + phase) * 0.05;
        });
        anim(bloom, (t) => {
          bloom.position.y = 0.06 + Math.sin(t * 1.2 + phase) * 0.006;
          (bloom.material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.5 + Math.sin(t * 2.0 + phase) * 0.3;
        });
      }
    }

    const waterLight = new THREE.PointLight(0x3388cc, 0.5, 3.0, 2.0);
    waterLight.position.set(midX, 0.3, midZ);
    root.add(waterLight);
    anim(waterLight, (t) => {
      waterLight.intensity = 0.4 + Math.sin(t * 1.2) * 0.2;
    });
  }
}

export const clusterRules: EmergenceRule[] = [
  ruleTown,
  ruleNightMarket,
  ruleForest,
  ruleFlowerField,
  ruleGardenEstate,
  ruleStreetTree,
  ruleSacredTree,
  ruleAvenue,
  rulePlaza,
  ruleLotusGarden,
];
