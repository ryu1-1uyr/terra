import * as THREE from "three";

export interface GridCell {
  type: "house" | "tower" | "tree" | "flower";
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

export function applyEmergence(
  objects: { type: "house" | "tower" | "tree" | "flower"; gx: number; gy: number; growth: number }[],
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
}
