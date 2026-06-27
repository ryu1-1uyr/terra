import * as THREE from "three";
import { GRID, gpos } from "../../grid";
import type { Grid, EmergenceRule } from "../detect";
import { neighbors, findClusters, ADJ8 } from "../detect";
import { anim } from "../anim";

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

function removeObjectAt(root: THREE.Group, px: number, pz: number) {
  const eps = 0.01;
  const searchTargets = root.parent
    ? root.parent.children.filter((c): c is THREE.Group => c instanceof THREE.Group)
    : [root];
  for (const group of searchTargets) {
    for (let i = group.children.length - 1; i >= 0; i--) {
      const child = group.children[i];
      if (child instanceof THREE.Group &&
          Math.abs(child.position.x - px) < eps &&
          Math.abs(child.position.z - pz) < eps) {
        group.remove(child);
        return;
      }
    }
  }
}

function ruleRuins(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  for (let gx = 0; gx < gridSize; gx++) {
    for (let gy = 0; gy < gridSize; gy++) {
      if (grid[gx][gy]?.type !== "tower") continue;
      const adj = neighbors(grid, gx, gy, ADJ8);
      const types = new Set(adj.map((n) => n.cell.type));
      if (!types.has("statue") || !types.has("tree") || !types.has("flower"))
        continue;

      const statueN = adj.find((n) => n.cell.type === "statue")!;
      const treeN = adj.find((n) => n.cell.type === "tree")!;
      const flowerN = adj.find((n) => n.cell.type === "flower")!;
      const members: [number, number][] = [
        [gx, gy], [statueN.gx, statueN.gy],
        [treeN.gx, treeN.gy], [flowerN.gx, flowerN.gy],
      ];
      const tiles = members.map(([cx, cy]) => gpos(cx, cy));
      const midX = tiles.reduce((s, [x]) => s + x, 0) / 4;
      const midZ = tiles.reduce((s, [, z]) => s + z, 0) / 4;

      // --- Remove original objects ---
      for (const [px, pz] of tiles) {
        removeObjectAt(root, px, pz);
      }

      // --- Ruin structure: stone platform ---
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.08, 2.2),
        new THREE.MeshStandardMaterial({
          color: 0x3a3a4a,
          roughness: 0.95,
          metalness: 0.1,
        })
      );
      platform.position.set(midX, 0.04, midZ);
      platform.receiveShadow = true;
      root.add(platform);

      // --- Broken walls ---
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x5a5a6a,
        roughness: 0.9,
        flatShading: true,
      });
      const wallPositions = [
        { x: midX - 0.85, z: midZ, w: 0.08, h: 0.55, d: 1.6, ry: 0 },
        { x: midX + 0.85, z: midZ, w: 0.08, h: 0.35, d: 1.2, ry: 0 },
        { x: midX, z: midZ - 0.85, w: 1.0, h: 0.4, d: 0.08, ry: 0 },
      ];
      for (const wp of wallPositions) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(wp.w, wp.h, wp.d),
          wallMat
        );
        wall.position.set(wp.x, wp.h / 2 + 0.08, wp.z);
        wall.rotation.y = wp.ry;
        wall.castShadow = true;
        wall.receiveShadow = true;
        root.add(wall);
      }

      // --- Pillars (broken columns at corners) ---
      const pillarCorners = [
        [midX - 0.75, midZ - 0.75], [midX + 0.75, midZ - 0.75],
        [midX - 0.75, midZ + 0.75], [midX + 0.75, midZ + 0.75],
      ];
      for (let i = 0; i < pillarCorners.length; i++) {
        const [cx, cz] = pillarCorners[i];
        const h = 0.35 + (i % 3) * 0.2;
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.09, h, 7),
          new THREE.MeshStandardMaterial({
            color: 0x6a6a7a,
            roughness: 0.85,
            flatShading: true,
          })
        );
        pillar.position.set(cx, h / 2 + 0.08, cz);
        pillar.rotation.z = (i % 2 === 0 ? 0.08 : -0.06);
        pillar.castShadow = true;
        root.add(pillar);
      }

      // --- Archway (entrance) ---
      const archMat = new THREE.MeshStandardMaterial({
        color: 0x4a4a5a,
        roughness: 0.85,
        flatShading: true,
      });
      const archL = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.7, 0.1), archMat
      );
      archL.position.set(midX - 0.2, 0.43, midZ + 0.85);
      archL.castShadow = true;
      root.add(archL);
      const archR = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.7, 0.1), archMat
      );
      archR.position.set(midX + 0.2, 0.43, midZ + 0.85);
      archR.castShadow = true;
      root.add(archR);
      const archTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.08, 0.12), archMat
      );
      archTop.position.set(midX, 0.82, midZ + 0.85);
      root.add(archTop);

      // --- Moss / vine patches on walls ---
      const mossMat = new THREE.MeshStandardMaterial({
        color: 0x3a6a3a,
        roughness: 1,
        transparent: true,
        opacity: 0.7,
      });
      for (let i = 0; i < 6; i++) {
        const moss = new THREE.Mesh(
          new THREE.PlaneGeometry(0.15 + (i % 3) * 0.05, 0.1 + (i % 2) * 0.06),
          mossMat
        );
        const angle = (i / 6) * Math.PI * 2;
        const r = 0.7 + (i % 2) * 0.2;
        moss.position.set(
          midX + Math.cos(angle) * r,
          0.15 + (i % 3) * 0.12,
          midZ + Math.sin(angle) * r
        );
        moss.rotation.y = angle + Math.PI / 2;
        root.add(moss);
      }

      // --- Scattered rubble ---
      for (let i = 0; i < 8; i++) {
        const rubble = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.06 + (i % 3) * 0.03,
            0.04 + (i % 2) * 0.02,
            0.05 + (i % 3) * 0.02
          ),
          new THREE.MeshStandardMaterial({
            color: 0x5a5a6a + ((i * 0x080808) % 0x202020),
            roughness: 0.95,
            flatShading: true,
          })
        );
        const ra = (i / 8) * Math.PI * 2 + 0.3;
        const rr = 0.3 + (i % 3) * 0.25;
        rubble.position.set(
          midX + Math.cos(ra) * rr,
          0.1,
          midZ + Math.sin(ra) * rr
        );
        rubble.rotation.set(i * 0.5, i * 0.7, i * 0.3);
        root.add(rubble);
      }

      // --- Effects (crystal, runes, fragments, beam, light) ---
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
      outerRune.position.set(midX, 0.09, midZ);
      root.add(outerRune);
      const innerRune = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.012, 4, 18),
        circleMat.clone()
      );
      innerRune.rotation.x = Math.PI / 2;
      innerRune.position.set(midX, 0.09, midZ);
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

      const ruinLight = new THREE.PointLight(0x6688cc, 0.8, 3.0, 2.0);
      ruinLight.position.set(midX, 1.0, midZ);
      root.add(ruinLight);
      anim(ruinLight, (t) => {
        ruinLight.intensity = 0.6 + Math.sin(t * 1.5) * 0.3;
      });
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
        new THREE.SphereGeometry(0.55, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: 0x3a7a3a,
          roughness: 0.95,
          flatShading: true,
        })
      );
      hill.position.set(px, -0.05, pz);
      hill.receiveShadow = true;
      root.add(hill);

      const wildColors = [0xffdd44, 0xff88aa, 0xaaddff, 0xffffff];
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + gx * 0.7;
        const r = 0.25 + (i % 3) * 0.08;
        const fx = px + Math.cos(angle) * r;
        const fz = pz + Math.sin(angle) * r;
        const wildFlower = new THREE.Mesh(
          new THREE.SphereGeometry(0.018, 4, 4),
          new THREE.MeshStandardMaterial({
            color: wildColors[i % wildColors.length],
            emissive: wildColors[i % wildColors.length],
            emissiveIntensity: 0.3,
          })
        );
        const hillH = Math.sqrt(Math.max(0, 0.55 * 0.55 - r * r)) * 0.7;
        wildFlower.position.set(fx, hillH + 0.02, fz);
        root.add(wildFlower);
        const phase = i * 0.8 + gx * 1.3;
        anim(wildFlower, (t) => {
          wildFlower.position.y = hillH + 0.02 + Math.sin(t * 2.0 + phase) * 0.01;
        });
      }

      for (const tree of adjTrees) {
        const [tx, tz] = gpos(tree.gx, tree.gy);
        const mx = (px + tx) / 2;
        const mz = (pz + tz) / 2;
        const path = new THREE.Mesh(
          new THREE.PlaneGeometry(0.12, 0.6),
          new THREE.MeshStandardMaterial({
            color: 0x8a7a5a,
            roughness: 1,
            transparent: true,
            opacity: 0.5,
          })
        );
        path.rotation.x = -Math.PI / 2;
        path.rotation.z = Math.atan2(tz - pz, tx - px) + Math.PI / 2;
        path.position.set(mx, 0.007, mz);
        root.add(path);
      }
    }
  }
}

export const structureRules: EmergenceRule[] = [
  ruleTowerGrove,
  ruleFlowerClock,
  ruleSkybridges,
  ruleCathedral,
  ruleFortress,
  ruleParadise,
  ruleRuins,
  ruleCastleBanner,
  ruleCastleWall,
  ruleWindmillHill,
];
