import * as THREE from "three";

import type { ObjectType } from "./GardenObjects";

export interface GridCell {
  type: ObjectType;
  growth: number;
}

type Grid = (GridCell | null)[][];

const GRID = 8;
const HALF = (GRID - 1) / 2;
function gpos(gx: number, gy: number): [number, number] {
  return [gx - HALF, gy - HALF];
}

const ADJ4 = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];
const ADJ8 = [...ADJ4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

function neighbors(
  grid: Grid,
  gx: number,
  gy: number,
  dirs = ADJ4
): { cell: GridCell; gx: number; gy: number }[] {
  const result: { cell: GridCell; gx: number; gy: number }[] = [];
  for (const [dx, dy] of dirs) {
    const nx = gx + dx;
    const ny = gy + dy;
    if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID && grid[nx][ny]) {
      result.push({ cell: grid[nx][ny]!, gx: nx, gy: ny });
    }
  }
  return result;
}

function floodFill(
  grid: Grid,
  sx: number,
  sy: number,
  type: string,
  visited: boolean[][]
): [number, number][] {
  const stack: [number, number][] = [[sx, sy]];
  const cluster: [number, number][] = [];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) continue;
    if (visited[x][y]) continue;
    if (!grid[x][y] || grid[x][y]!.type !== type) continue;
    visited[x][y] = true;
    cluster.push([x, y]);
    for (const [dx, dy] of ADJ4) {
      stack.push([x + dx, y + dy]);
    }
  }
  return cluster;
}

function findClusters(
  grid: Grid,
  type: string
): [number, number][][] {
  const visited = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  const clusters: [number, number][][] = [];
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (!visited[x][y] && grid[x][y]?.type === type) {
        const c = floodFill(grid, x, y, type, visited);
        if (c.length > 0) clusters.push(c);
      }
    }
  }
  return clusters;
}

// ─── Animation helper ───

function anim(obj: THREE.Object3D, fn: (t: number) => void) {
  obj.onBeforeRender = () => fn(performance.now() * 0.001);
}

// ─── Rule implementations ───

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
    // Walking cube villagers
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
      const colors = [0xff7ad1, 0xffd24a, 0x7ad1ff, 0xb6ff3f];
      for (let i = 0; i < 6; i++) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.03, 4, 4),
          new THREE.MeshStandardMaterial({
            color: colors[(gx * 3 + gy + i) % colors.length],
            emissive: colors[(gx * 3 + gy + i) % colors.length],
            emissiveIntensity: 0.4,
          })
        );
        const angle = (i / 6) * Math.PI * 2 + gx;
        const r = 0.2 + ((i * 7 + gx) % 3) * 0.1;
        const bx = px + Math.cos(angle) * r;
        const bz = pz + Math.sin(angle) * r;
        dot.position.set(bx, 0.04, bz);
        root.add(dot);
        const phase = gx * 1.3 + gy * 2.1 + i * 0.7;
        anim(dot, (t) => {
          dot.position.x = bx + Math.sin(t * 1.5 + phase) * 0.02;
          dot.position.y = 0.04 + Math.sin(t * 2.0 + phase) * 0.015;
          dot.position.z = bz + Math.cos(t * 1.3 + phase) * 0.02;
        });
      }
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

      // Orbiting particle ring
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

      // Water droplets rising from fountain
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

function ruleTowerGrove(grid: Grid, root: THREE.Group) {
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (grid[x][y]?.type !== "tower") continue;
      const adjTrees = neighbors(grid, x, y, ADJ8).filter(
        (n) => n.cell.type === "tree"
      );
      if (adjTrees.length < 2) continue;
      const [px, pz] = gpos(x, y);
      const growth = grid[x][y]!.growth;
      const vineCount = Math.floor(6 + growth * 4);
      const maxH = 0.4 + growth * 0.25;
      const vineMat = new THREE.MeshStandardMaterial({
        color: 0x3a7a4a,
        emissive: 0x2a5a3a,
        emissiveIntensity: 0.15,
        roughness: 0.9,
      });
      for (let vi = 0; vi < vineCount; vi++) {
        const angle = (vi / vineCount) * Math.PI * 2 + vi * 0.3;
        const h = 0.3 + (vi % 4) * 0.12 * (1 + growth * 0.3);
        const w = 0.03 + growth * 0.008;
        const vine = new THREE.Mesh(
          new THREE.BoxGeometry(w, Math.min(h, maxH), w),
          vineMat
        );
        vine.position.set(
          px + Math.cos(angle) * (0.28 + (vi % 3) * 0.04),
          h / 2 + 0.1,
          pz + Math.sin(angle) * (0.28 + (vi % 3) * 0.04)
        );
        vine.rotation.z = Math.sin(vi * 1.3) * 0.15;
        root.add(vine);
        const phase = vi * 1.1;
        anim(vine, (t) => {
          vine.rotation.z = Math.sin(t * 0.8 + phase) * 0.1;
          vine.rotation.x = Math.cos(t * 0.6 + phase) * 0.05;
        });
      }
      // Leaf clusters at vine tips
      const leafCount = Math.floor(3 + growth * 2);
      for (let li = 0; li < leafCount; li++) {
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.06 + growth * 0.015, 5, 4),
          new THREE.MeshStandardMaterial({
            color: 0x4a9a5a,
            emissive: 0x2a6a3a,
            emissiveIntensity: 0.2,
            flatShading: true,
          })
        );
        const la = (li / leafCount) * Math.PI * 2 + li * 0.7;
        const ly = 0.5 + (li % 3) * 0.2 + growth * 0.12;
        leaf.position.set(
          px + Math.cos(la) * 0.35,
          ly,
          pz + Math.sin(la) * 0.35
        );
        leaf.scale.y = 0.6;
        root.add(leaf);
      }
    }
  }
}

function ruleFlowerClock(grid: Grid, root: THREE.Group) {
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (grid[x][y]?.type !== "flower") continue;
      const adjTowers = neighbors(grid, x, y).filter(
        (n) => n.cell.type === "tower"
      );
      if (adjTowers.length === 0) continue;
      const [px, pz] = gpos(x, y);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.015, 6, 16),
        new THREE.MeshStandardMaterial({
          color: 0xb6ff3f,
          emissive: 0xb6ff3f,
          emissiveIntensity: 1.5,
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(px, 0.02, pz);
      root.add(ring);
      anim(ring, (t) => {
        ring.rotation.z = t * 0.3;
        (ring.material as THREE.MeshStandardMaterial).emissiveIntensity =
          1.5 + Math.sin(t * 2.0) * 0.5;
      });
    }
  }
}

function ruleSkybridges(grid: Grid, root: THREE.Group) {
  const visited = new Set<string>();
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (grid[x][y]?.type !== "tower") continue;
      const adjTowers = neighbors(grid, x, y).filter(
        (n) => n.cell.type === "tower"
      );
      for (const adj of adjTowers) {
        const key = [
          `${Math.min(x, adj.gx)},${Math.min(y, adj.gy)}`,
          `${Math.max(x, adj.gx)},${Math.max(y, adj.gy)}`,
        ].join("-");
        if (visited.has(key)) continue;
        visited.add(key);

        const [p1x, p1z] = gpos(x, y);
        const [p2x, p2z] = gpos(adj.gx, adj.gy);
        const mx = (p1x + p2x) / 2;
        const mz = (p1z + p2z) / 2;
        const dx = p2x - p1x;
        const dz = p2z - p1z;
        const len = Math.sqrt(dx * dx + dz * dz);

        const bridge = new THREE.Mesh(
          new THREE.BoxGeometry(len * 0.85, 0.04, 0.12),
          new THREE.MeshStandardMaterial({
            color: 0x8a9bb8,
            roughness: 0.4,
            metalness: 0.3,
          })
        );
        bridge.position.set(mx, 1.1, mz);
        bridge.rotation.y = Math.atan2(dz, dx);
        bridge.castShadow = true;
        root.add(bridge);
      }
    }
  }
}

// ─── Helper builders ───

function addLanternPost(
  root: THREE.Group,
  x: number,
  z: number,
  color: number
) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 })
  );
  pole.position.set(x, 0.225, z);
  root.add(pole);

  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: color,
      emissiveIntensity: 2.5,
    })
  );
  lamp.position.set(x, 0.47, z);
  root.add(lamp);

  const light = new THREE.PointLight(color, 0.6, 1.8, 2.5);
  light.position.set(x, 0.47, z);
  root.add(light);
}

function addMushroom(root: THREE.Group, x: number, z: number): THREE.Group {
  const group = new THREE.Group();

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.018, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xddd8c4, roughness: 0.9 })
  );
  stem.position.set(0, 0.03, 0);
  group.add(stem);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xcc4444,
      emissive: 0x441111,
      emissiveIntensity: 0.3,
      flatShading: true,
    })
  );
  cap.position.set(0, 0.06, 0);
  group.add(cap);

  group.position.set(x, 0, z);
  root.add(group);
  return group;
}

function addPaperLantern(root: THREE.Group, x: number, z: number) {
  const colors = [0xff6633, 0xffcc33, 0xff3366];
  const col = colors[Math.floor((x * 7.3 + z * 11.1) * 100) % colors.length];

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 6, 6),
    new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.85,
    })
  );
  body.scale.set(1, 1.4, 1);
  body.position.set(x, 0.7, z);
  root.add(body);

  const light = new THREE.PointLight(col, 0.4, 1.5, 2.5);
  light.position.set(x, 0.7, z);
  root.add(light);

  const phase = x * 3.7 + z * 5.3;
  anim(body, (t) => {
    body.position.x = x + Math.sin(t * 1.2 + phase) * 0.03;
    body.position.y = 0.7 + Math.sin(t * 1.8 + phase) * 0.02;
    body.rotation.z = Math.sin(t * 1.0 + phase) * 0.15;
  });
}

// ─── Main entry ───

// --- New object emergence rules ---

function ruleWheatField(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      const c = grid[gx][gy];
      if (!c || c.type !== "windmill") continue;
      const adj = neighbors(grid, gx, gy);
      if (!adj.some((n) => n.cell.type === "flower")) continue;
      const [px, pz] = gpos(gx, gy);
      const wheat = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.9),
        new THREE.MeshStandardMaterial({
          color: 0xd4a630,
          emissive: 0xd4a630,
          emissiveIntensity: 0.15,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        })
      );
      wheat.position.set(px, 0.01, pz);
      wheat.rotation.x = -Math.PI / 2;
      root.add(wheat);
      for (let i = 0; i < 12; i++) {
        const stalk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, 0.22),
          new THREE.MeshStandardMaterial({ color: 0xc8a030 })
        );
        const a = (i / 12) * Math.PI * 2;
        const r = 0.15 + (i % 4) * 0.07;
        const sx = px + Math.cos(a) * r;
        const sz = pz + Math.sin(a) * r;
        stalk.position.set(sx, 0.11, sz);
        root.add(stalk);
        const phase = i * 0.5 + gx;
        anim(stalk, (t) => {
          stalk.rotation.z = Math.sin(t * 2.0 + phase) * 0.2;
          stalk.rotation.x = Math.cos(t * 1.5 + phase) * 0.1;
        });
      }
    }
  }
}

function ruleSpiritOrbs(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      const c = grid[gx][gy];
      if (!c || c.type !== "shrine") continue;
      const adj = neighbors(grid, gx, gy, ADJ8);
      if (!adj.some((n) => n.cell.type === "tree")) continue;
      const [px, pz] = gpos(gx, gy);
      const orbMat = new THREE.MeshStandardMaterial({
        color: 0x88ffcc,
        emissive: 0x88ffcc,
        emissiveIntensity: 2.5,
        transparent: true,
        opacity: 0.7,
      });
      for (let i = 0; i < 6; i++) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), orbMat.clone());
        root.add(orb);
        const phase = (i / 6) * Math.PI * 2;
        const baseH = 0.4 + i * 0.1;
        const radius = 0.35 + (i % 2) * 0.12;
        anim(orb, (t) => {
          const a = t * 0.7 + phase;
          orb.position.set(
            px + Math.cos(a) * radius,
            baseH + Math.sin(t * 1.5 + phase) * 0.12,
            pz + Math.sin(a) * radius
          );
          (orb.material as THREE.MeshStandardMaterial).emissiveIntensity =
            2.0 + Math.sin(t * 3.0 + phase) * 1.0;
        });
      }
      const orbLight = new THREE.PointLight(0x88ffcc, 0.5, 2.0, 2.0);
      orbLight.position.set(px, 0.5, pz);
      root.add(orbLight);
      anim(orbLight, (t) => {
        orbLight.intensity = 0.4 + Math.sin(t * 2.0) * 0.2;
      });
    }
  }
}

function ruleLitWalkway(grid: Grid, root: THREE.Group) {
  const visited = new Set<string>();
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      const c = grid[gx][gy];
      if (!c || c.type !== "lamp") continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      const adj = neighbors(grid, gx, gy);
      const lampNeighbors = adj.filter((n) => n.cell.type === "lamp");
      if (lampNeighbors.length === 0) continue;
      visited.add(key);
      for (const n of lampNeighbors) {
        visited.add(`${n.gx},${n.gy}`);
        const [px1, pz1] = gpos(gx, gy);
        const [px2, pz2] = gpos(n.gx, n.gy);
        const mx = (px1 + px2) / 2;
        const mz = (pz1 + pz2) / 2;
        const walkway = new THREE.Mesh(
          new THREE.PlaneGeometry(0.3, 0.9),
          new THREE.MeshStandardMaterial({
            color: 0xffcc66,
            emissive: 0xffcc66,
            emissiveIntensity: 0.2,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
          })
        );
        walkway.position.set(mx, 0.005, mz);
        walkway.rotation.x = -Math.PI / 2;
        if (gx !== n.gx) walkway.rotation.z = Math.PI / 2;
        root.add(walkway);
      }
    }
  }
}

function ruleReflection(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      const c = grid[gx][gy];
      if (!c || c.type !== "pond") continue;
      const adj = neighbors(grid, gx, gy);
      if (!adj.some((n) => n.cell.type === "statue")) continue;
      const [px, pz] = gpos(gx, gy);
      for (let i = 0; i < 8; i++) {
        const sparkle = new THREE.Mesh(
          new THREE.SphereGeometry(0.018, 4, 4),
          new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffd700,
            emissiveIntensity: 3,
            transparent: true,
            opacity: 0.8,
          })
        );
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const r = 0.08 + (i % 3) * 0.1;
        const sx = px + Math.cos(a) * r;
        const sz = pz + Math.sin(a) * r;
        sparkle.position.set(sx, 0.045, sz);
        root.add(sparkle);
        const phase = i * 0.8;
        anim(sparkle, (t) => {
          const mat = sparkle.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 2.0 + Math.sin(t * 4.0 + phase) * 2.0;
          mat.opacity = 0.4 + Math.sin(t * 3.0 + phase) * 0.4;
          sparkle.position.y = 0.045 + Math.sin(t * 2.5 + phase) * 0.01;
        });
      }
    }
  }
}

function ruleMonumentAura(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      const c = grid[gx][gy];
      if (!c || c.type !== "statue" || c.growth < 1.0) continue;
      const adj = neighbors(grid, gx, gy, ADJ8);
      if (adj.some((n) => n.cell.type === "statue")) continue;
      const [px, pz] = gpos(gx, gy);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const pillarMat = new THREE.MeshStandardMaterial({
          color: 0xb6ff3f,
          emissive: 0xb6ff3f,
          emissiveIntensity: 1.5,
          transparent: true,
          opacity: 0.4,
        });
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 1.2),
          pillarMat
        );
        pillar.position.set(px + Math.cos(a) * 0.4, 0.6, pz + Math.sin(a) * 0.4);
        root.add(pillar);
        const phase = i * 1.05;
        anim(pillar, (t) => {
          pillarMat.emissiveIntensity = 1.0 + Math.sin(t * 2.5 + phase) * 1.0;
          pillarMat.opacity = 0.3 + Math.sin(t * 2.5 + phase) * 0.2;
          pillar.scale.y = 1.0 + Math.sin(t * 1.5 + phase) * 0.1;
        });
      }
    }
  }
}

function ruleLotusGarden(grid: Grid, root: THREE.Group) {
  const clusters = findClusters(grid, "pond");
  for (const cluster of clusters) {
    if (cluster.length < 3) continue;
    for (const [cx, cy] of cluster) {
      const [px, pz] = gpos(cx, cy);
      const water = new THREE.Mesh(
        new THREE.BoxGeometry(0.96, 0.01, 0.96),
        new THREE.MeshStandardMaterial({
          color: 0x2255aa,
          emissive: 0x224488,
          emissiveIntensity: 0.4,
          transparent: true,
          opacity: 0.4,
        })
      );
      water.position.set(px, 0.025, pz);
      root.add(water);
    }
    for (let i = 0; i < cluster.length; i++) {
      const [cx, cy] = cluster[i];
      const [px, pz] = gpos(cx, cy);
      if (i % 2 === 0) {
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 0.01, 8),
          new THREE.MeshStandardMaterial({ color: 0x33aa44, roughness: 0.8 })
        );
        const ox = ((cx * 3 + cy * 7) % 5 - 2) * 0.08;
        const oz = ((cx * 7 + cy * 3) % 5 - 2) * 0.08;
        pad.position.set(px + ox, 0.04, pz + oz);
        root.add(pad);
        const bloom = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({
            color: 0xff88aa,
            emissive: 0xff88aa,
            emissiveIntensity: 0.5,
          })
        );
        bloom.position.set(px + ox, 0.06, pz + oz);
        root.add(bloom);
        const phase = cx * 1.3 + cy * 2.1;
        const baseY = 0.04;
        anim(pad, (t) => {
          pad.position.y = baseY + Math.sin(t * 1.2 + phase) * 0.008;
          pad.rotation.y = Math.sin(t * 0.5 + phase) * 0.05;
        });
        anim(bloom, (t) => {
          bloom.position.y = 0.06 + Math.sin(t * 1.2 + phase) * 0.008;
          (bloom.material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.5 + Math.sin(t * 2.0 + phase) * 0.3;
        });
      }
    }
  }
}

function ruleCathedral(grid: Grid, root: THREE.Group) {
  const clusters = findClusters(grid, "tower");
  for (const cluster of clusters) {
    if (cluster.length < 4) continue;
    let maxAdj = 0;
    let centerGx = cluster[0][0];
    let centerGy = cluster[0][1];
    for (const [cx, cy] of cluster) {
      const adjCount = neighbors(grid, cx, cy).filter(
        (n) => n.cell.type === "tower"
      ).length;
      if (adjCount > maxAdj) {
        maxAdj = adjCount;
        centerGx = cx;
        centerGy = cy;
      }
    }
    const [px, pz] = gpos(centerGx, centerGy);
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.6, 6),
      new THREE.MeshStandardMaterial({
        color: 0xccccdd,
        emissive: 0x8888aa,
        emissiveIntensity: 0.3,
        metalness: 0.4,
        roughness: 0.5,
      })
    );
    spire.position.set(px, 1.6, pz);
    root.add(spire);

    const crossMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 2.0,
    });
    const cross1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.02, 0.02),
      crossMat
    );
    cross1.position.set(px, 1.95, pz);
    root.add(cross1);
    const cross2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.15, 0.02),
      crossMat
    );
    cross2.position.set(px, 1.92, pz);
    root.add(cross2);
    anim(cross1, (t) => {
      crossMat.emissiveIntensity = 2.0 + Math.sin(t * 2.0) * 1.0;
    });

    // Holy light beam
    const beamMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.15,
    });
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.15, 2.0, 6),
      beamMat
    );
    beam.position.set(px, 1.0, pz);
    root.add(beam);
    anim(beam, (t) => {
      beamMat.opacity = 0.1 + Math.sin(t * 1.5) * 0.08;
    });
  }
}

function ruleFortress(grid: Grid, root: THREE.Group) {
  const visited = new Set<string>();
  for (let gx = 0; gx < GRID - 1; gx++) {
    for (let gy = 0; gy < GRID - 1; gy++) {
      const block = [
        grid[gx][gy]?.type,
        grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type,
        grid[gx + 1][gy + 1]?.type,
      ];
      const towers = block.filter((t) => t === "tower").length;
      const houses = block.filter((t) => t === "house").length;
      if (towers < 2 || houses < 2) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const H = (GRID - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;
      const cobble = new THREE.Mesh(
        new THREE.BoxGeometry(1.96, 0.02, 1.96),
        new THREE.MeshStandardMaterial({ color: 0x4a4a5a, roughness: 0.95 })
      );
      cobble.position.set(cx, 0.01, cz);
      cobble.receiveShadow = true;
      root.add(cobble);
      const torchPositions = [
        [cx - 0.85, cz - 0.85],
        [cx + 0.85, cz - 0.85],
        [cx - 0.85, cz + 0.85],
        [cx + 0.85, cz + 0.85],
      ];
      for (let ti = 0; ti < torchPositions.length; ti++) {
        const [tx, tz] = torchPositions[ti];
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.3),
          new THREE.MeshStandardMaterial({ color: 0x553322 })
        );
        pole.position.set(tx, 0.15, tz);
        root.add(pole);
        const flameMat = new THREE.MeshStandardMaterial({
          color: 0x000000,
          emissive: 0xff6622,
          emissiveIntensity: 3.0,
        });
        const flame = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 6, 6),
          flameMat
        );
        flame.position.set(tx, 0.33, tz);
        root.add(flame);
        const torchLight = new THREE.PointLight(0xff6622, 0.3, 1.0, 2.0);
        torchLight.position.set(tx, 0.35, tz);
        root.add(torchLight);
        const phase = ti * 1.5 + gx;
        anim(flame, (t) => {
          flameMat.emissiveIntensity = 2.5 + Math.sin(t * 6.0 + phase) * 1.5;
          flame.scale.y = 1.0 + Math.sin(t * 8.0 + phase) * 0.3;
          flame.position.y = 0.33 + Math.sin(t * 5.0 + phase) * 0.015;
          torchLight.intensity = 0.25 + Math.sin(t * 6.0 + phase) * 0.15;
        });
      }
    }
  }
}

function ruleParadise(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      const cell = grid[gx][gy];
      if (!cell) continue;
      const adj = neighbors(grid, gx, gy, ADJ8);
      const allTypes = new Set([cell.type, ...adj.map((n) => n.cell.type)]);
      if (
        !allTypes.has("flower") ||
        !allTypes.has("tree") ||
        !allTypes.has("pond") ||
        !allTypes.has("house")
      )
        continue;
      if (cell.type !== "pond") continue;
      const [px, pz] = gpos(gx, gy);
      const rainbowColors = [
        0xff0000, 0xff7700, 0xffff00, 0x00ff00, 0x0077ff, 0x0000ff, 0x8b00ff,
      ];
      for (let i = 0; i < rainbowColors.length; i++) {
        const r = 0.55 + i * 0.04;
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.018, 6, 24, Math.PI),
          new THREE.MeshStandardMaterial({
            color: rainbowColors[i],
            emissive: rainbowColors[i],
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.6,
          })
        );
        arc.position.set(px, 0.05, pz);
        root.add(arc);
        const phase = i * 0.3;
        anim(arc, (t) => {
          (arc.material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.6 + Math.sin(t * 1.5 + phase) * 0.4;
          (arc.material as THREE.MeshStandardMaterial).opacity =
            0.5 + Math.sin(t * 1.0 + phase) * 0.15;
        });
      }
      // Sparkle particles around rainbow
      for (let i = 0; i < 6; i++) {
        const sparkle = new THREE.Mesh(
          new THREE.SphereGeometry(0.02, 4, 4),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 3.0,
            transparent: true,
            opacity: 0.6,
          })
        );
        root.add(sparkle);
        const sp = i * 1.05;
        anim(sparkle, (t) => {
          const a = t * 0.8 + sp;
          const r2 = 0.6 + i * 0.04;
          sparkle.position.set(
            px + Math.cos(a) * r2,
            0.2 + Math.sin(a) * 0.4,
            pz + Math.sin(t * 0.3 + sp) * 0.15
          );
          (sparkle.material as THREE.MeshStandardMaterial).opacity =
            0.3 + Math.sin(t * 3.0 + sp) * 0.3;
        });
      }
      break;
    }
  }
}

function ruleRuins(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "tower") continue;
      const adj = neighbors(grid, gx, gy, ADJ8);
      const types = new Set(adj.map((n) => n.cell.type));
      if (!types.has("statue") || !types.has("tree") || !types.has("flower"))
        continue;

      // Find the 4 participating tiles
      const statueN = adj.find((n) => n.cell.type === "statue")!;
      const treeN = adj.find((n) => n.cell.type === "tree")!;
      const flowerN = adj.find((n) => n.cell.type === "flower")!;
      const tiles = [
        gpos(gx, gy),
        gpos(statueN.gx, statueN.gy),
        gpos(treeN.gx, treeN.gy),
        gpos(flowerN.gx, flowerN.gy),
      ];
      const midX = tiles.reduce((s, [x]) => s + x, 0) / 4;
      const midZ = tiles.reduce((s, [, z]) => s + z, 0) / 4;

      // Ground: ancient stone platform spanning all 4 tiles
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.06, 2.2),
        new THREE.MeshStandardMaterial({
          color: 0x3a3a4a,
          roughness: 0.95,
          metalness: 0.1,
        })
      );
      platform.position.set(midX, 0.03, midZ);
      platform.receiveShadow = true;
      root.add(platform);

      // Broken pillars at each tile position
      for (let i = 0; i < tiles.length; i++) {
        const [tx, tz] = tiles[i];
        const h = 0.4 + (i % 3) * 0.25;
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.08, h, 6),
          new THREE.MeshStandardMaterial({
            color: 0x6a6a7a,
            roughness: 0.8,
            flatShading: true,
          })
        );
        pillar.position.set(tx, h / 2 + 0.06, tz);
        pillar.rotation.z = (i % 2 === 0 ? 0.1 : -0.08);
        root.add(pillar);
      }

      // Central hovering ruin crystal
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.15, 0),
        new THREE.MeshStandardMaterial({
          color: 0x6688cc,
          emissive: 0x4466aa,
          emissiveIntensity: 2.5,
          transparent: true,
          opacity: 0.8,
          metalness: 0.3,
        })
      );
      crystal.position.set(midX, 1.0, midZ);
      root.add(crystal);
      anim(crystal, (t) => {
        crystal.position.y = 1.0 + Math.sin(t * 0.8) * 0.12;
        crystal.rotation.y = t * 0.5;
        crystal.rotation.x = Math.sin(t * 0.3) * 0.2;
        (crystal.material as THREE.MeshStandardMaterial).emissiveIntensity =
          2.0 + Math.sin(t * 2.0) * 1.0;
      });

      // Arcane circle on ground
      const circleMat = new THREE.MeshStandardMaterial({
        color: 0x88aaff,
        emissive: 0x88aaff,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.5,
      });
      const outerRune = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.015, 4, 24),
        circleMat
      );
      outerRune.rotation.x = Math.PI / 2;
      outerRune.position.set(midX, 0.07, midZ);
      root.add(outerRune);
      const innerRune = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.012, 4, 18),
        circleMat.clone()
      );
      innerRune.rotation.x = Math.PI / 2;
      innerRune.position.set(midX, 0.07, midZ);
      root.add(innerRune);
      anim(outerRune, (t) => {
        outerRune.rotation.z = t * 0.2;
        circleMat.emissiveIntensity = 1.5 + Math.sin(t * 2.0) * 1.0;
        circleMat.opacity = 0.4 + Math.sin(t * 1.5) * 0.2;
      });
      anim(innerRune, (t) => {
        innerRune.rotation.z = -t * 0.3;
        const m = innerRune.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = 1.5 + Math.cos(t * 2.0) * 1.0;
      });

      // Floating stone fragments orbiting the crystal
      for (let i = 0; i < 5; i++) {
        const frag = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.08, 0.05),
          new THREE.MeshStandardMaterial({
            color: 0x5a5a6a,
            roughness: 0.9,
            flatShading: true,
          })
        );
        root.add(frag);
        const fp = (i / 5) * Math.PI * 2;
        const fr = 0.4 + (i % 2) * 0.15;
        const fh = 0.7 + i * 0.1;
        anim(frag, (t) => {
          const a = t * 0.6 + fp;
          frag.position.set(
            midX + Math.cos(a) * fr,
            fh + Math.sin(t * 1.2 + fp) * 0.1,
            midZ + Math.sin(a) * fr
          );
          frag.rotation.x = t * 0.8 + fp;
          frag.rotation.z = t * 0.5 + fp;
        });
      }

      // Mystical energy beam from crystal down
      const energyBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.08, 0.9, 6),
        new THREE.MeshStandardMaterial({
          color: 0x88aaff,
          emissive: 0x88aaff,
          emissiveIntensity: 2.0,
          transparent: true,
          opacity: 0.2,
        })
      );
      energyBeam.position.set(midX, 0.5, midZ);
      root.add(energyBeam);
      anim(energyBeam, (t) => {
        (energyBeam.material as THREE.MeshStandardMaterial).opacity =
          0.15 + Math.sin(t * 2.5) * 0.1;
      });

      // Blue point light for the whole ruin
      const ruinLight = new THREE.PointLight(0x6688cc, 0.8, 3.0, 2.0);
      ruinLight.position.set(midX, 1.0, midZ);
      root.add(ruinLight);
      anim(ruinLight, (t) => {
        ruinLight.intensity = 0.6 + Math.sin(t * 1.5) * 0.3;
      });
    }
  }
}

function ruleWindValley(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "windmill") continue;
      const adj = neighbors(grid, gx, gy, ADJ8);
      const hasFlower = adj.some((n) => n.cell.type === "flower");
      const hasTree = adj.some((n) => n.cell.type === "tree");
      if (!hasFlower || !hasTree) continue;
      const [px, pz] = gpos(gx, gy);
      const windMat = new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        emissive: 0xaaddff,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      });
      for (let i = 0; i < 4; i++) {
        const curve = new THREE.Mesh(
          new THREE.PlaneGeometry(0.9, 0.06),
          windMat.clone()
        );
        const offset = (i - 1.5) * 0.15;
        curve.position.set(px + offset, 0.2 + i * 0.1, pz);
        curve.rotation.x = -0.3;
        curve.rotation.y = 0.4 + i * 0.3;
        root.add(curve);
        const phase = i * 1.3;
        anim(curve, (t) => {
          curve.position.x = px + offset + Math.sin(t * 2.0 + phase) * 0.15;
          curve.position.y = 0.2 + i * 0.1 + Math.sin(t * 1.5 + phase) * 0.05;
          const m = curve.material as THREE.MeshStandardMaterial;
          m.opacity = 0.1 + Math.sin(t * 2.5 + phase) * 0.1;
        });
      }
    }
  }
}

function ruleCastleBanner(grid: Grid, root: THREE.Group) {
  const visited = new Set<string>();
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "tower") continue;
      const adj = neighbors(grid, gx, gy);
      const adjTowers = adj.filter((n) => n.cell.type === "tower");
      const adjHouses = adj.filter((n) => n.cell.type === "house");
      if (adjTowers.length === 0 || adjHouses.length === 0) continue;
      for (const t2 of adjTowers) {
        const key = [
          `${Math.min(gx, t2.gx)},${Math.min(gy, t2.gy)}`,
          `${Math.max(gx, t2.gx)},${Math.max(gy, t2.gy)}`,
        ].join("-");
        if (visited.has(key)) continue;
        visited.add(key);
        const [p1x, p1z] = gpos(gx, gy);
        const [p2x, p2z] = gpos(t2.gx, t2.gy);
        const mx = (p1x + p2x) / 2;
        const mz = (p1z + p2z) / 2;
        const bannerColors = [0xff3333, 0x3333ff, 0xffcc00];
        const col = bannerColors[(gx + gy) % bannerColors.length];
        const flag = new THREE.Mesh(
          new THREE.PlaneGeometry(0.18, 0.25),
          new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.3,
            side: THREE.DoubleSide,
          })
        );
        flag.position.set(mx, 1.0, mz);
        const dx = p2x - p1x;
        const dz = p2z - p1z;
        flag.rotation.y = Math.atan2(dz, dx);
        root.add(flag);
        const phase = gx * 2.1 + gy * 3.3;
        anim(flag, (t) => {
          flag.rotation.z = Math.sin(t * 3.0 + phase) * 0.2;
          flag.scale.x = 1.0 + Math.sin(t * 4.0 + phase) * 0.08;
        });
      }
    }
  }
}

function ruleMagicGarden(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "pond") continue;
      const adj = neighbors(grid, gx, gy, ADJ8);
      const hasFlower = adj.some((n) => n.cell.type === "flower");
      const hasStatue = adj.some((n) => n.cell.type === "statue");
      if (!hasFlower || !hasStatue) continue;
      const [px, pz] = gpos(gx, gy);
      const count = 10;
      const positions = new Float32Array(count * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const pts = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          color: 0x88ffdd,
          size: 0.07,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      root.add(pts);
      anim(pts, (t) => {
        const arr = geo.attributes.position.array as Float32Array;
        for (let i = 0; i < count; i++) {
          const phase = (i / count) * Math.PI * 2;
          const r = 0.15 + (i % 3) * 0.1;
          arr[i * 3] = px + Math.cos(t * 0.5 + phase) * r;
          arr[i * 3 + 1] = 0.1 + (i % 4) * 0.08 + Math.sin(t * 1.5 + phase) * 0.08;
          arr[i * 3 + 2] = pz + Math.sin(t * 0.5 + phase) * r;
        }
        geo.attributes.position.needsUpdate = true;
        (pts.material as THREE.PointsMaterial).opacity =
          0.6 + Math.sin(t * 2.0) * 0.3;
      });

      const magicLight = new THREE.PointLight(0x88ffdd, 0.4, 1.5, 2.0);
      magicLight.position.set(px, 0.3, pz);
      root.add(magicLight);
      anim(magicLight, (t) => {
        magicLight.intensity = 0.3 + Math.sin(t * 2.5) * 0.2;
      });
    }
  }
}

function ruleFestival(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "shrine") continue;
      const adj = neighbors(grid, gx, gy, ADJ8);
      const hasLamp = adj.some((n) => n.cell.type === "lamp");
      const hasHouse = adj.some((n) => n.cell.type === "house");
      if (!hasLamp || !hasHouse) continue;
      const [px, pz] = gpos(gx, gy);
      const houses = adj.filter((n) => n.cell.type === "house");
      for (const h of houses) {
        const [hx, hz] = gpos(h.gx, h.gy);
        const count = 3;
        for (let i = 0; i < count; i++) {
          const t = (i + 1) / (count + 1);
          const lx = px + (hx - px) * t;
          const lz = pz + (hz - pz) * t;
          addPaperLantern(root, lx, lz);
        }
      }
    }
  }
}

function ruleHotSpring(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "pond") continue;
      const adj = neighbors(grid, gx, gy, ADJ8);
      const hasHouse = adj.some((n) => n.cell.type === "house");
      const hasLamp = adj.some((n) => n.cell.type === "lamp");
      if (!hasHouse || !hasLamp) continue;
      const [px, pz] = gpos(gx, gy);
      for (let i = 0; i < 8; i++) {
        const steamMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.2,
        });
        const steam = new THREE.Mesh(
          new THREE.SphereGeometry(0.04 + (i % 3) * 0.02, 6, 6),
          steamMat
        );
        root.add(steam);
        const phase = (i / 8) * Math.PI * 2 + gy;
        const r = 0.08 + (i % 3) * 0.06;
        anim(steam, (t) => {
          const prog = ((t * 0.3 + i * 0.15) % 1.5);
          steam.position.set(
            px + Math.cos(phase) * r + Math.sin(t * 0.5 + phase) * 0.04,
            0.08 + prog * 0.35,
            pz + Math.sin(phase) * r + Math.cos(t * 0.4 + phase) * 0.04
          );
          steamMat.opacity = 0.25 * Math.max(0, 1.0 - prog / 1.2);
          steam.scale.setScalar(1.0 + prog * 0.5);
        });
      }
      const warmLight = new THREE.PointLight(0xff8844, 0.4, 1.5, 2.0);
      warmLight.position.set(px, 0.2, pz);
      root.add(warmLight);
      anim(warmLight, (t) => {
        warmLight.intensity = 0.3 + Math.sin(t * 1.5) * 0.15;
      });
    }
  }
}

function ruleWeatherVane(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "house") continue;
      const adjWindmills = neighbors(grid, gx, gy, ADJ8).filter(
        (n) => n.cell.type === "windmill"
      );
      if (adjWindmills.length === 0) continue;
      const [px, pz] = gpos(gx, gy);
      const vaneMat = new THREE.MeshStandardMaterial({
        color: 0xcc8833,
        roughness: 0.5,
        metalness: 0.4,
      });
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.15),
        vaneMat
      );
      pole.position.set(px, 0.52, pz);
      root.add(pole);
      const arrowGroup = new THREE.Group();
      arrowGroup.position.set(px, 0.58, pz);
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.03, 0.1, 4),
        vaneMat
      );
      arrow.position.set(0.03, 0, 0);
      arrow.rotation.z = -Math.PI / 2;
      arrowGroup.add(arrow);
      root.add(arrowGroup);
      const phase = gx * 2.3 + gy * 1.7;
      anim(arrowGroup, (t) => {
        arrowGroup.rotation.y = Math.sin(t * 0.4 + phase) * Math.PI;
      });
    }
  }
}

function rulePrayerLight(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "lamp") continue;
      const adjShrines = neighbors(grid, gx, gy, ADJ8).filter(
        (n) => n.cell.type === "shrine"
      );
      if (adjShrines.length === 0) continue;
      const [px, pz] = gpos(gx, gy);
      const sacredLight = new THREE.PointLight(0x44ffaa, 0.8, 2.0, 2.0);
      sacredLight.position.set(px, 0.5, pz);
      root.add(sacredLight);
      const auraMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0x44ffaa,
        emissiveIntensity: 3.0,
        transparent: true,
        opacity: 0.6,
      });
      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        auraMat
      );
      aura.position.set(px, 0.5, pz);
      root.add(aura);
      const phase = gx * 1.5 + gy * 2.7;
      anim(aura, (t) => {
        auraMat.emissiveIntensity = 2.5 + Math.sin(t * 3.0 + phase) * 1.5;
        auraMat.opacity = 0.5 + Math.sin(t * 2.0 + phase) * 0.2;
        aura.scale.setScalar(1.0 + Math.sin(t * 2.5 + phase) * 0.15);
        sacredLight.intensity = 0.6 + Math.sin(t * 2.0 + phase) * 0.3;
      });
    }
  }
}

function ruleGatekeeper(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "house") continue;
      const adjStatues = neighbors(grid, gx, gy).filter(
        (n) => n.cell.type === "statue"
      );
      if (adjStatues.length === 0) continue;
      const [px, pz] = gpos(gx, gy);
      const guardMat = new THREE.MeshStandardMaterial({
        color: 0x7a8a9a,
        roughness: 0.6,
        metalness: 0.2,
      });
      for (const s of adjStatues) {
        const dx = s.gx - gx;
        const dz = s.gy - gy;
        const gx2 = px + dx * 0.35;
        const gz2 = pz + dz * 0.35;
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.04, 0.25),
          guardMat
        );
        pillar.position.set(gx2, 0.125, gz2);
        pillar.castShadow = true;
        root.add(pillar);
        const top = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 6, 6),
          guardMat
        );
        top.position.set(gx2, 0.27, gz2);
        root.add(top);
      }
    }
  }
}

function ruleGardenSculpture(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "statue") continue;
      const adjFlowers = neighbors(grid, gx, gy).filter(
        (n) => n.cell.type === "flower"
      );
      if (adjFlowers.length === 0) continue;
      const [px, pz] = gpos(gx, gy);
      const wreathMat = new THREE.MeshStandardMaterial({
        color: 0x44aa55,
        emissive: 0x22aa33,
        emissiveIntensity: 0.3,
        roughness: 0.8,
      });
      const wreath = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.03, 6, 12),
        wreathMat
      );
      wreath.rotation.x = Math.PI / 2;
      wreath.position.set(px, 0.12, pz);
      root.add(wreath);
      const colors = [0xff7ad1, 0xffd24a, 0x7ad1ff];
      for (let i = 0; i < 5; i++) {
        const bud = new THREE.Mesh(
          new THREE.SphereGeometry(0.025, 4, 4),
          new THREE.MeshStandardMaterial({
            color: colors[i % colors.length],
            emissive: colors[i % colors.length],
            emissiveIntensity: 0.5,
          })
        );
        const a = (i / 5) * Math.PI * 2;
        bud.position.set(
          px + Math.cos(a) * 0.18,
          0.12,
          pz + Math.sin(a) * 0.18
        );
        root.add(bud);
        const phase = i * 1.26;
        anim(bud, (t) => {
          (bud.material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.3 + Math.sin(t * 3.0 + phase) * 0.5;
          bud.position.y = 0.12 + Math.sin(t * 2.0 + phase) * 0.01;
        });
      }
    }
  }
}

function ruleWatchtower(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "tower") continue;
      const adjPonds = neighbors(grid, gx, gy).filter(
        (n) => n.cell.type === "pond"
      );
      if (adjPonds.length === 0) continue;
      const [px, pz] = gpos(gx, gy);
      for (const pond of adjPonds) {
        const [px2, pz2] = gpos(pond.gx, pond.gy);
        const dx = px2 - px;
        const dz = pz2 - pz;
        const beamLen = 0.6;
        const beamMat = new THREE.MeshStandardMaterial({
          color: 0xffd700,
          emissive: 0xffd700,
          emissiveIntensity: 2.0,
          transparent: true,
          opacity: 0.35,
        });
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.04, beamLen),
          beamMat
        );
        beam.position.set(px + dx * 0.4, 0.8, pz + dz * 0.4);
        beam.rotation.z = Math.atan2(dz, dx) + Math.PI / 2;
        beam.rotation.x = Math.PI / 4;
        root.add(beam);
        const phase = pond.gx * 2.3 + pond.gy * 1.7;
        anim(beam, (t) => {
          beamMat.emissiveIntensity = 1.5 + Math.sin(t * 2.0 + phase) * 1.0;
          beamMat.opacity = 0.25 + Math.sin(t * 1.5 + phase) * 0.15;
        });
      }
    }
  }
}

function ruleWindmillHill(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "windmill") continue;
      const adjTrees = neighbors(grid, gx, gy, ADJ8).filter(
        (n) => n.cell.type === "tree"
      );
      if (adjTrees.length === 0) continue;
      const [px, pz] = gpos(gx, gy);
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: 0x3a7a3a,
          roughness: 0.95,
          flatShading: true,
        })
      );
      hill.position.set(px, 0.0, pz);
      hill.receiveShadow = true;
      root.add(hill);
    }
  }
}

function ruleCastleWall(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "tower") continue;
      const adjHouses = neighbors(grid, gx, gy).filter(
        (n) => n.cell.type === "house"
      );
      if (adjHouses.length === 0) continue;
      const [px, pz] = gpos(gx, gy);
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x6a6a7a,
        roughness: 0.85,
        metalness: 0.1,
      });
      for (const h of adjHouses) {
        const [hx, hz] = gpos(h.gx, h.gy);
        const mx = (px + hx) / 2;
        const mz = (pz + hz) / 2;
        const isX = gx !== h.gx;
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(isX ? 0.7 : 0.08, 0.35, isX ? 0.08 : 0.7),
          wallMat
        );
        wall.position.set(mx, 0.175, mz);
        wall.castShadow = true;
        root.add(wall);
        const merlon = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.08, 0.1),
          wallMat
        );
        merlon.position.set(mx, 0.39, mz);
        root.add(merlon);
      }
    }
  }
}

function ruleSacredGrove(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "shrine") continue;
      const adjFlowers = neighbors(grid, gx, gy, ADJ8).filter(
        (n) => n.cell.type === "flower"
      );
      if (adjFlowers.length === 0) continue;
      const [px, pz] = gpos(gx, gy);
      const petalMat = new THREE.MeshStandardMaterial({
        color: 0xffb7c5,
        emissive: 0xffb7c5,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      for (let i = 0; i < 14; i++) {
        const petal = new THREE.Mesh(
          new THREE.PlaneGeometry(0.05, 0.05),
          petalMat
        );
        root.add(petal);
        const phase = i * 0.45 + gx * 1.3;
        const r = 0.1 + (i % 4) * 0.12;
        const baseH = 0.2 + (i % 5) * 0.12;
        anim(petal, (t) => {
          const a = t * 0.4 + phase;
          petal.position.set(
            px + Math.cos(a) * r,
            baseH + Math.sin(t * 0.8 + phase) * 0.1,
            pz + Math.sin(a) * r
          );
          petal.rotation.x = t * 0.5 + phase;
          petal.rotation.z = Math.sin(t * 1.2 + phase) * 0.5;
        });
      }
    }
  }
}

function ruleLighthouseHarbor(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "lamp") continue;
      const adjPonds = neighbors(grid, gx, gy).filter(
        (n) => n.cell.type === "pond"
      );
      if (adjPonds.length === 0) continue;
      const [px, pz] = gpos(gx, gy);
      for (const pond of adjPonds) {
        const [px2, pz2] = gpos(pond.gx, pond.gy);
        const stripMat = new THREE.MeshStandardMaterial({
          color: 0xff8833,
          emissive: 0xff8833,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.3,
        });
        for (let i = 0; i < 4; i++) {
          const t = 0.2 + i * 0.2;
          const sx = px + (px2 - px) * t;
          const sz = pz + (pz2 - pz) * t;
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.005, 0.08),
            stripMat.clone()
          );
          strip.position.set(sx, 0.04, sz);
          root.add(strip);
          const phase = i * 0.8 + gx;
          anim(strip, (t2) => {
            const m = strip.material as THREE.MeshStandardMaterial;
            m.emissiveIntensity = 0.5 + Math.sin(t2 * 3.0 + phase) * 0.5;
            m.opacity = 0.2 + Math.sin(t2 * 2.0 + phase) * 0.15;
          });
        }
      }
    }
  }
}

function ruleWatermill(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      if (grid[gx][gy]?.type !== "windmill") continue;
      const adjPonds = neighbors(grid, gx, gy).filter(
        (n) => n.cell.type === "pond"
      );
      if (adjPonds.length === 0) continue;
      const [px, pz] = gpos(gx, gy);
      for (const pond of adjPonds) {
        const [px2, pz2] = gpos(pond.gx, pond.gy);
        const mx = (px + px2) / 2;
        const mz = (pz + pz2) / 2;
        const isX = gx !== pond.gx;
        const channelMat = new THREE.MeshStandardMaterial({
          color: 0x3366aa,
          emissive: 0x3366aa,
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.5,
        });
        const channel = new THREE.Mesh(
          new THREE.BoxGeometry(isX ? 0.8 : 0.15, 0.02, isX ? 0.15 : 0.8),
          channelMat
        );
        channel.position.set(mx, 0.015, mz);
        root.add(channel);
        anim(channel, (t) => {
          channelMat.emissiveIntensity = 0.4 + Math.sin(t * 2.5) * 0.3;
          channelMat.opacity = 0.4 + Math.sin(t * 2.0) * 0.15;
        });
      }
      const glow = new THREE.PointLight(0x4488cc, 0.4, 1.5, 2.5);
      glow.position.set(px, 0.3, pz);
      root.add(glow);
    }
  }
}

export function applyEmergence(
  objects: { type: ObjectType; gx: number; gy: number; growth: number }[],
  root: THREE.Group
) {
  const grid: Grid = Array.from({ length: GRID }, () =>
    Array(GRID).fill(null)
  );

  for (const o of objects) {
    const gx = Math.round(o.gx);
    const gy = Math.round(o.gy);
    if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
      grid[gx][gy] = { type: o.type, growth: o.growth };
    }
  }

  ruleTown(grid, root);
  ruleNightMarket(grid, root);
  ruleForest(grid, root);
  ruleFlowerField(grid, root);
  ruleGardenEstate(grid, root);
  ruleStreetTree(grid, root);
  ruleSacredTree(grid, root);
  ruleAvenue(grid, root);
  rulePlaza(grid, root);
  ruleTowerGrove(grid, root);
  ruleFlowerClock(grid, root);
  ruleSkybridges(grid, root);
  ruleWheatField(grid, root);
  ruleSpiritOrbs(grid, root);
  ruleLitWalkway(grid, root);
  ruleReflection(grid, root);
  ruleMonumentAura(grid, root);
  ruleWatermill(grid, root);
  ruleLighthouseHarbor(grid, root);
  ruleSacredGrove(grid, root);
  ruleCastleWall(grid, root);
  ruleWindmillHill(grid, root);
  ruleWatchtower(grid, root);
  ruleGardenSculpture(grid, root);
  ruleGatekeeper(grid, root);
  rulePrayerLight(grid, root);
  ruleWeatherVane(grid, root);
  ruleHotSpring(grid, root);
  ruleFestival(grid, root);
  ruleMagicGarden(grid, root);
  ruleCastleBanner(grid, root);
  ruleWindValley(grid, root);
  ruleRuins(grid, root);
  ruleParadise(grid, root);
  ruleFortress(grid, root);
  ruleCathedral(grid, root);
  ruleLotusGarden(grid, root);
}
