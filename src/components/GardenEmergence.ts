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

// ─── Rule implementations ───

function ruleTown(grid: Grid, root: THREE.Group) {
  const clusters = findClusters(grid, "house");
  for (const cluster of clusters) {
    if (cluster.length < 3) continue;
    // Paved ground between houses
    for (const [gx, gy] of cluster) {
      const [px, pz] = gpos(gx, gy);
      const pave = new THREE.Mesh(
        new THREE.BoxGeometry(0.98, 0.02, 0.98),
        new THREE.MeshStandardMaterial({
          color: 0x3a4560,
          roughness: 0.95,
        })
      );
      pave.position.set(px, 0.01, pz);
      pave.receiveShadow = true;
      root.add(pave);
    }
    // Lantern posts at cluster edges
    for (const [gx, gy] of cluster) {
      const adjHouses = neighbors(grid, gx, gy).filter(
        (n) => n.cell.type === "house"
      );
      if (adjHouses.length >= 2) {
        const [px, pz] = gpos(gx, gy);
        addLanternPost(root, px + 0.38, pz + 0.38, 0xffd96a);
      }
    }
  }
}

function ruleNightMarket(grid: Grid, root: THREE.Group) {
  const clusters = findClusters(grid, "house");
  for (const cluster of clusters) {
    if (cluster.length < 4) continue;
    // Colorful awnings on the densest houses
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
    // Undergrowth & mushrooms
    for (const [gx, gy] of cluster) {
      const [px, pz] = gpos(gx, gy);
      // Undergrowth ring
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

      // Mushroom
      if ((gx + gy) % 2 === 0) {
        addMushroom(root, px - 0.3, pz + 0.25);
      }
    }
    // Moss on ground between trees
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
    // Carpet of tiny flowers on ground
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
        dot.position.set(
          px + Math.cos(angle) * r,
          0.04,
          pz + Math.sin(angle) * r
        );
        root.add(dot);
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
      // Hedge around house
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
      // Lamp post next to tree
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
      // Torii gate at base
      const [px, pz] = gpos(x, y);
      const toriiMat = new THREE.MeshStandardMaterial({
        color: 0xcc3333,
        roughness: 0.7,
        emissive: 0xcc3333,
        emissiveIntensity: 0.15,
      });
      // Pillars
      for (const dx of [-0.2, 0.2]) {
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.35),
          toriiMat
        );
        pillar.position.set(px + dx, 0.175, pz + 0.4);
        root.add(pillar);
      }
      // Crossbar
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.04, 0.04),
        toriiMat
      );
      bar.position.set(px, 0.36, pz + 0.4);
      root.add(bar);

      // Glowing particles ring
      const ringGeo = new THREE.BufferGeometry();
      const ringCount = 12;
      const ringPos = new Float32Array(ringCount * 3);
      for (let i = 0; i < ringCount; i++) {
        const a = (i / ringCount) * Math.PI * 2;
        ringPos[i * 3] = px + Math.cos(a) * 0.45;
        ringPos[i * 3 + 1] = 0.5 + Math.sin(a * 3) * 0.1;
        ringPos[i * 3 + 2] = pz + Math.sin(a) * 0.45;
      }
      ringGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(ringPos, 3)
      );
      const ringPts = new THREE.Points(
        ringGeo,
        new THREE.PointsMaterial({
          color: 0xffd700,
          size: 0.08,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      root.add(ringPts);
    }
  }
}

function ruleAvenue(grid: Grid, root: THREE.Group) {
  const visited = new Set<string>();
  // Check horizontal lines
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
  // Check vertical lines
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
      // Fountain
      const [px, pz] = gpos(x, y);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.25, 0.08, 8),
        new THREE.MeshStandardMaterial({
          color: 0x7a8fa6,
          roughness: 0.5,
        })
      );
      base.position.set(px, 0.04, pz);
      base.receiveShadow = true;
      root.add(base);

      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.28),
        new THREE.MeshStandardMaterial({
          color: 0x9aaccd,
          roughness: 0.4,
        })
      );
      pillar.position.set(px, 0.22, pz);
      root.add(pillar);

      const waterTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.02, 8),
        new THREE.MeshStandardMaterial({
          color: 0x4488cc,
          emissive: 0x224466,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.7,
        })
      );
      waterTop.position.set(px, 0.06, pz);
      root.add(waterTop);
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
      // Vines on tower
      const [px, pz] = gpos(x, y);
      for (let vi = 0; vi < 4; vi++) {
        const vine = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.5 + vi * 0.15, 0.04),
          new THREE.MeshStandardMaterial({
            color: 0x3a7a4a,
            emissive: 0x2a5a3a,
            emissiveIntensity: 0.15,
            roughness: 0.9,
          })
        );
        const angle = (vi / 4) * Math.PI * 2;
        vine.position.set(
          px + Math.cos(angle) * 0.31,
          0.3 + vi * 0.12,
          pz + Math.sin(angle) * 0.31
        );
        root.add(vine);
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
      // Glowing ring at flower position
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

function addMushroom(root: THREE.Group, x: number, z: number) {
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.018, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xddd8c4, roughness: 0.9 })
  );
  stem.position.set(x, 0.03, z);
  root.add(stem);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xcc4444,
      emissive: 0x441111,
      emissiveIntensity: 0.3,
      flatShading: true,
    })
  );
  cap.position.set(x, 0.06, z);
  root.add(cap);
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
}

// ─── Main entry ───

// --- New object emergence rules ---

// Windmill + flower(s) adjacent → golden wheat field beneath
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
      for (let i = 0; i < 8; i++) {
        const stalk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, 0.18),
          new THREE.MeshStandardMaterial({ color: 0xc8a030 })
        );
        const a = (i / 8) * Math.PI * 2;
        const r = 0.2 + (i % 3) * 0.08;
        stalk.position.set(px + Math.cos(a) * r, 0.09, pz + Math.sin(a) * r);
        root.add(stalk);
      }
    }
  }
}

// Shrine + tree adjacent → spirit orbs float around shrine
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
      for (let i = 0; i < 5; i++) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), orbMat);
        const a = (i / 5) * Math.PI * 2;
        orb.position.set(px + Math.cos(a) * 0.45, 0.5 + i * 0.12, pz + Math.sin(a) * 0.45);
        root.add(orb);
      }
    }
  }
}

// Lamp cluster (2+ lamps adjacent) → illuminated walkway (glowing ground strip)
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

// Pond + statue adjacent → reflection sparkle (glowing dots on pond)
function ruleReflection(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      const c = grid[gx][gy];
      if (!c || c.type !== "pond") continue;
      const adj = neighbors(grid, gx, gy);
      if (!adj.some((n) => n.cell.type === "statue")) continue;
      const [px, pz] = gpos(gx, gy);
      const sparkleMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 3,
      });
      for (let i = 0; i < 6; i++) {
        const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), sparkleMat);
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const r = 0.1 + (i % 2) * 0.1;
        sparkle.position.set(px + Math.cos(a) * r, 0.045, pz + Math.sin(a) * r);
        root.add(sparkle);
      }
    }
  }
}

// Statue alone (no adjacent same type) + high growth → monument aura (ring of light pillars)
function ruleMonumentAura(grid: Grid, root: THREE.Group) {
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      const c = grid[gx][gy];
      if (!c || c.type !== "statue" || c.growth < 1.0) continue;
      const adj = neighbors(grid, gx, gy, ADJ8);
      if (adj.some((n) => n.cell.type === "statue")) continue;
      const [px, pz] = gpos(gx, gy);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0xb6ff3f,
        emissive: 0xb6ff3f,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.4,
      });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 1.2),
          pillarMat
        );
        pillar.position.set(px + Math.cos(a) * 0.4, 0.6, pz + Math.sin(a) * 0.4);
        root.add(pillar);
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
        const r = 0.4 + i * 0.03;
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.012, 4, 16, Math.PI),
          new THREE.MeshStandardMaterial({
            color: rainbowColors[i],
            emissive: rainbowColors[i],
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.5,
          })
        );
        arc.position.set(px, 0.05, pz);
        root.add(arc);
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
      const [px, pz] = gpos(gx, gy);
      const moss = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.01, 0.95),
        new THREE.MeshStandardMaterial({
          color: 0x1a3a1a,
          roughness: 1,
          transparent: true,
          opacity: 0.5,
        })
      );
      moss.position.set(px, 0.005, pz);
      root.add(moss);
      const runeMat = new THREE.MeshStandardMaterial({
        color: 0x88aaff,
        emissive: 0x88aaff,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.4,
      });
      const rune = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.01, 4, 16),
        runeMat
      );
      rune.rotation.x = Math.PI / 2;
      rune.position.set(px, 0.02, pz);
      root.add(rune);
      const inner = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.008, 4, 12),
        runeMat
      );
      inner.rotation.x = Math.PI / 2;
      inner.position.set(px, 0.02, pz);
      root.add(inner);
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
      for (let i = 0; i < 3; i++) {
        const curve = new THREE.Mesh(
          new THREE.PlaneGeometry(0.8, 0.06),
          windMat
        );
        const offset = (i - 1) * 0.2;
        curve.position.set(px + offset, 0.2 + i * 0.12, pz);
        curve.rotation.x = -0.3;
        curve.rotation.y = 0.4 + i * 0.3;
        root.add(curve);
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
      for (const t of adjTowers) {
        const key = [
          `${Math.min(gx, t.gx)},${Math.min(gy, t.gy)}`,
          `${Math.max(gx, t.gx)},${Math.max(gy, t.gy)}`,
        ].join("-");
        if (visited.has(key)) continue;
        visited.add(key);
        const [p1x, p1z] = gpos(gx, gy);
        const [p2x, p2z] = gpos(t.gx, t.gy);
        const mx = (p1x + p2x) / 2;
        const mz = (p1z + p2z) / 2;
        const bannerColors = [0xff3333, 0x3333ff, 0xffcc00];
        const col = bannerColors[(gx + gy) % bannerColors.length];
        const flag = new THREE.Mesh(
          new THREE.PlaneGeometry(0.15, 0.2),
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
      const fireflyMat = new THREE.PointsMaterial({
        color: 0x88ffdd,
        size: 0.06,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const count = 8;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const r = 0.15 + (i % 3) * 0.1;
        positions[i * 3] = px + Math.cos(a) * r;
        positions[i * 3 + 1] = 0.1 + (i % 4) * 0.1;
        positions[i * 3 + 2] = pz + Math.sin(a) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      root.add(new THREE.Points(geo, fireflyMat));
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
      const steamMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.2,
      });
      for (let i = 0; i < 6; i++) {
        const steam = new THREE.Mesh(
          new THREE.SphereGeometry(0.05 + (i % 3) * 0.02, 6, 6),
          steamMat
        );
        const a = (i / 6) * Math.PI * 2 + gy;
        const r = 0.1 + (i % 2) * 0.08;
        steam.position.set(
          px + Math.cos(a) * r,
          0.15 + i * 0.08,
          pz + Math.sin(a) * r
        );
        root.add(steam);
      }
      const warmLight = new THREE.PointLight(0xff8844, 0.3, 1.5, 2.0);
      warmLight.position.set(px, 0.2, pz);
      root.add(warmLight);
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
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.03, 0.1, 4),
        vaneMat
      );
      arrow.position.set(px + 0.03, 0.58, pz);
      arrow.rotation.z = -Math.PI / 2;
      root.add(arrow);
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
      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0x000000,
          emissive: 0x44ffaa,
          emissiveIntensity: 3.0,
          transparent: true,
          opacity: 0.6,
        })
      );
      aura.position.set(px, 0.5, pz);
      root.add(aura);
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
          new THREE.SphereGeometry(0.02, 4, 4),
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
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.04, beamLen),
          new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffd700,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.35,
          })
        );
        beam.position.set(px + dx * 0.4, 0.8, pz + dz * 0.4);
        beam.rotation.z = Math.atan2(dz, dx) + Math.PI / 2;
        beam.rotation.x = Math.PI / 4;
        root.add(beam);
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
      for (let i = 0; i < 10; i++) {
        const petal = new THREE.Mesh(
          new THREE.PlaneGeometry(0.04, 0.04),
          petalMat
        );
        const a = (i / 10) * Math.PI * 2 + gx;
        const r = 0.15 + (i % 3) * 0.15;
        petal.position.set(
          px + Math.cos(a) * r,
          0.3 + (i % 4) * 0.15,
          pz + Math.sin(a) * r
        );
        petal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        root.add(petal);
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
        for (let i = 0; i < 3; i++) {
          const t = 0.3 + i * 0.2;
          const sx = px + (px2 - px) * t;
          const sz = pz + (pz2 - pz) * t;
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.005, 0.06),
            stripMat
          );
          strip.position.set(sx, 0.04, sz);
          root.add(strip);
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
        const channel = new THREE.Mesh(
          new THREE.BoxGeometry(isX ? 0.8 : 0.15, 0.02, isX ? 0.15 : 0.8),
          new THREE.MeshStandardMaterial({
            color: 0x3366aa,
            emissive: 0x3366aa,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.5,
          })
        );
        channel.position.set(mx, 0.015, mz);
        root.add(channel);
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

  // Order matters: ground effects first, then decorations
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
}
