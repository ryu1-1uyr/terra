import * as THREE from "three";
import { gpos } from "../../grid";
import type { Grid, EmergenceRule } from "../detect";
import { neighbors, findClusters, ADJ8 } from "../detect";
import { anim } from "../anim";

function ruleTowerGrove(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (grid[x][y]?.type !== "tower") continue;
      const adjTrees = neighbors(grid, x, y, ADJ8).filter(
        (n) => n.cell.type === "tree"
      );
      if (adjTrees.length < 2) continue;
      const [px, pz] = gpos(x, y, gridSize);
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
  const gridSize = grid.length;
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (grid[x][y]?.type !== "flower") continue;
      const adjTowers = neighbors(grid, x, y).filter(
        (n) => n.cell.type === "tower"
      );
      if (adjTowers.length === 0) continue;
      const [px, pz] = gpos(x, y, gridSize);
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
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
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

        const [p1x, p1z] = gpos(x, y, gridSize);
        const [p2x, p2z] = gpos(adj.gx, adj.gy, gridSize);
        const mx = (p1x + p2x) / 2;
        const mz = (p1z + p2z) / 2;
        const dx = p2x - p1x;
        const dz = p2z - p1z;
        const angle = Math.atan2(dz, dx);

        removeObjectAt(root, p1x, p1z);
        removeObjectAt(root, p2x, p2z);

        const towerMat = new THREE.MeshStandardMaterial({
          color: 0x6a7a8a,
          roughness: 0.7,
          metalness: 0.2,
          flatShading: true,
        });
        for (const [tx, tz] of [[p1x, p1z], [p2x, p2z]]) {
          const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.22, 0.9, 8),
            towerMat
          );
          base.position.set(tx, 0.45, tz);
          base.castShadow = true;
          root.add(base);
          const top = new THREE.Mesh(
            new THREE.ConeGeometry(0.22, 0.25, 8),
            new THREE.MeshStandardMaterial({ color: 0x4a5a6a, flatShading: true })
          );
          top.position.set(tx, 1.02, tz);
          root.add(top);
          for (let wi = 0; wi < 3; wi++) {
            const wa = (wi / 3) * Math.PI * 2;
            const win = new THREE.Mesh(
              new THREE.PlaneGeometry(0.06, 0.08),
              new THREE.MeshStandardMaterial({
                color: 0xffeeaa,
                emissive: 0xffeeaa,
                emissiveIntensity: 1.5,
                side: THREE.DoubleSide,
              })
            );
            win.position.set(
              tx + Math.cos(wa) * 0.19,
              0.55 + wi * 0.12,
              tz + Math.sin(wa) * 0.19
            );
            win.rotation.y = wa;
            root.add(win);
          }
        }

        const bridgeMat = new THREE.MeshStandardMaterial({
          color: 0x8a9bb8,
          roughness: 0.4,
          metalness: 0.3,
        });
        const bridge = new THREE.Mesh(
          new THREE.BoxGeometry(0.85, 0.05, 0.2),
          bridgeMat
        );
        bridge.position.set(mx, 0.75, mz);
        bridge.rotation.y = angle;
        bridge.castShadow = true;
        root.add(bridge);
        for (const side of [-1, 1]) {
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, 0.08, 0.02),
            towerMat
          );
          rail.position.set(
            mx + Math.cos(angle + Math.PI / 2) * side * 0.09,
            0.82,
            mz + Math.sin(angle + Math.PI / 2) * side * 0.09
          );
          rail.rotation.y = angle;
          root.add(rail);
        }

        const lanternMat = new THREE.MeshStandardMaterial({
          color: 0x000000,
          emissive: 0xffa500,
          emissiveIntensity: 2.5,
        });
        const lantern = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 6, 6),
          lanternMat
        );
        lantern.position.set(mx, 0.88, mz);
        root.add(lantern);
        const lanternLight = new THREE.PointLight(0xffa500, 0.4, 2.0, 2.0);
        lanternLight.position.set(mx, 0.88, mz);
        root.add(lanternLight);
        anim(lantern, (t) => {
          lanternMat.emissiveIntensity = 2.0 + Math.sin(t * 3.0) * 1.0;
          lanternLight.intensity = 0.3 + Math.sin(t * 3.0) * 0.2;
        });
      }
    }
  }
}

function ruleCathedral(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
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
    const [px, pz] = gpos(centerGx, centerGy, gridSize);
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
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
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

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }

      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x5a5a6a,
        roughness: 0.85,
        metalness: 0.1,
        flatShading: true,
      });

      const cobble = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.06, 2.0),
        new THREE.MeshStandardMaterial({ color: 0x4a4a5a, roughness: 0.95 })
      );
      cobble.position.set(cx, 0.03, cz);
      cobble.receiveShadow = true;
      root.add(cobble);

      const wallSegments = [
        { x: cx, z: cz - 0.95, w: 2.0, d: 0.1 },
        { x: cx, z: cz + 0.95, w: 2.0, d: 0.1 },
        { x: cx - 0.95, z: cz, w: 0.1, d: 2.0 },
        { x: cx + 0.95, z: cz, w: 0.1, d: 2.0 },
      ];
      for (const ws of wallSegments) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(ws.w, 0.45, ws.d),
          stoneMat
        );
        wall.position.set(ws.x, 0.285, ws.z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        root.add(wall);
      }
      for (let side = 0; side < 4; side++) {
        const merlonCount = 5;
        for (let mi = 0; mi < merlonCount; mi++) {
          const frac = (mi / (merlonCount - 1)) * 2 - 1;
          const mx2 = side < 2
            ? cx + frac * 0.9
            : cx + (side === 2 ? -0.95 : 0.95);
          const mz2 = side < 2
            ? cz + (side === 0 ? -0.95 : 0.95)
            : cz + frac * 0.9;
          if (mi % 2 === 0) {
            const merlon = new THREE.Mesh(
              new THREE.BoxGeometry(0.1, 0.12, 0.1),
              stoneMat
            );
            merlon.position.set(mx2, 0.57, mz2);
            root.add(merlon);
          }
        }
      }

      const corners = [
        [cx - 0.85, cz - 0.85], [cx + 0.85, cz - 0.85],
        [cx - 0.85, cz + 0.85], [cx + 0.85, cz + 0.85],
      ];
      for (let ti = 0; ti < corners.length; ti++) {
        const [tx, tz] = corners[ti];
        const turret = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.15, 0.7, 8),
          stoneMat
        );
        turret.position.set(tx, 0.41, tz);
        turret.castShadow = true;
        root.add(turret);
        const turretTop = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 0.18, 8),
          new THREE.MeshStandardMaterial({ color: 0x8b4513, flatShading: true })
        );
        turretTop.position.set(tx, 0.85, tz);
        root.add(turretTop);

        const flameMat = new THREE.MeshStandardMaterial({
          color: 0x000000,
          emissive: 0xff6622,
          emissiveIntensity: 3.0,
        });
        const flame = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 6, 6),
          flameMat
        );
        flame.position.set(tx, 0.98, tz);
        root.add(flame);
        const torchLight = new THREE.PointLight(0xff6622, 0.3, 1.5, 2.0);
        torchLight.position.set(tx, 1.0, tz);
        root.add(torchLight);
        const phase = ti * 1.5 + gx;
        anim(flame, (t) => {
          flameMat.emissiveIntensity = 2.5 + Math.sin(t * 6.0 + phase) * 1.5;
          flame.scale.y = 1.0 + Math.sin(t * 8.0 + phase) * 0.3;
          torchLight.intensity = 0.25 + Math.sin(t * 6.0 + phase) * 0.15;
        });
      }

      const gate = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 })
      );
      gate.position.set(cx, 0.21, cz + 0.95);
      root.add(gate);
    }
  }
}

function ruleParadise(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  for (let gx = 0; gx < gridSize; gx++) {
    for (let gy = 0; gy < gridSize; gy++) {
      const cell = grid[gx][gy];
      if (!cell || cell.type !== "pond") continue;
      const adj = neighbors(grid, gx, gy, ADJ8);
      const allTypes = new Set([cell.type, ...adj.map((n) => n.cell.type)]);
      if (!allTypes.has("flower") || !allTypes.has("tree") || !allTypes.has("house"))
        continue;

      const flowerN = adj.find((n) => n.cell.type === "flower")!;
      const treeN = adj.find((n) => n.cell.type === "tree")!;
      const houseN = adj.find((n) => n.cell.type === "house")!;
      const members: [number, number][] = [
        [gx, gy], [flowerN.gx, flowerN.gy],
        [treeN.gx, treeN.gy], [houseN.gx, houseN.gy],
      ];
      const tiles = members.map(([cx, cy]) => gpos(cx, cy, gridSize));
      const midX = tiles.reduce((s, [x]) => s + x, 0) / 4;
      const midZ = tiles.reduce((s, [, z]) => s + z, 0) / 4;

      for (const [px, pz] of tiles) {
        removeObjectAt(root, px, pz);
      }

      // --- Garden platform ---
      const grassMat = new THREE.MeshStandardMaterial({
        color: 0x3a7a3a,
        roughness: 0.95,
      });
      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.15, 0.08, 16),
        grassMat
      );
      platform.position.set(midX, 0.04, midZ);
      platform.receiveShadow = true;
      root.add(platform);

      // --- Pond (center) ---
      const pondMat = new THREE.MeshStandardMaterial({
        color: 0x3388cc,
        emissive: 0x2266aa,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8,
        metalness: 0.3,
      });
      const pond = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.02, 12),
        pondMat
      );
      pond.position.set(midX, 0.09, midZ);
      root.add(pond);
      anim(pond, (t) => {
        pondMat.emissiveIntensity = 0.4 + Math.sin(t * 1.5) * 0.2;
      });

      // --- Gazebo pillars ---
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        roughness: 0.5,
      });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const pr = 0.7;
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6),
          pillarMat
        );
        pillar.position.set(
          midX + Math.cos(a) * pr,
          0.38,
          midZ + Math.sin(a) * pr
        );
        pillar.castShadow = true;
        root.add(pillar);
      }
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 0.25, 6),
        new THREE.MeshStandardMaterial({
          color: 0xcc8844,
          flatShading: true,
        })
      );
      roof.position.set(midX, 0.78, midZ);
      root.add(roof);

      // --- Flower beds ---
      const flowerColors = [0xff6699, 0xff99cc, 0xffcc66, 0xcc66ff];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = 0.85 + (i % 3) * 0.08;
        const fl = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 4, 4),
          new THREE.MeshStandardMaterial({
            color: flowerColors[i % flowerColors.length],
            emissive: flowerColors[i % flowerColors.length],
            emissiveIntensity: 0.3,
          })
        );
        fl.position.set(
          midX + Math.cos(a) * r,
          0.12,
          midZ + Math.sin(a) * r
        );
        root.add(fl);
      }

      // --- Rainbow arch ---
      const rainbowColors = [
        0xff0000, 0xff7700, 0xffff00, 0x00ff00, 0x0077ff, 0x0000ff, 0x8b00ff,
      ];
      for (let i = 0; i < rainbowColors.length; i++) {
        const r = 0.7 + i * 0.04;
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.015, 6, 24, Math.PI),
          new THREE.MeshStandardMaterial({
            color: rainbowColors[i],
            emissive: rainbowColors[i],
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.5,
          })
        );
        arc.position.set(midX, 0.08, midZ);
        root.add(arc);
        const phase = i * 0.3;
        anim(arc, (t) => {
          (arc.material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.6 + Math.sin(t * 1.5 + phase) * 0.4;
          (arc.material as THREE.MeshStandardMaterial).opacity =
            0.4 + Math.sin(t * 1.0 + phase) * 0.15;
        });
      }

      // --- Sparkles ---
      for (let i = 0; i < 8; i++) {
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
        const sp = i * 0.8;
        anim(sparkle, (t) => {
          const a = t * 0.6 + sp;
          const r2 = 0.5 + (i % 3) * 0.15;
          sparkle.position.set(
            midX + Math.cos(a) * r2,
            0.3 + Math.sin(a * 1.5 + sp) * 0.35,
            midZ + Math.sin(a) * r2
          );
          (sparkle.material as THREE.MeshStandardMaterial).opacity =
            0.3 + Math.sin(t * 3.0 + sp) * 0.3;
        });
      }

      const paradiseLight = new THREE.PointLight(0xffeedd, 0.6, 3.0, 2.0);
      paradiseLight.position.set(midX, 0.7, midZ);
      root.add(paradiseLight);
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
      const tiles = members.map(([cx, cy]) => gpos(cx, cy, gridSize));
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
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize; gx++) {
    for (let gy = 0; gy < gridSize; gy++) {
      if (grid[gx][gy]?.type !== "tower") continue;
      const adj = neighbors(grid, gx, gy);
      const adjTowers = adj.filter((n) => n.cell.type === "tower");
      const adjHouses = adj.filter((n) => n.cell.type === "house");
      if (adjTowers.length === 0 || adjHouses.length === 0) continue;

      for (const t2 of adjTowers) {
        const houseN = adjHouses[0];
        const key = [
          `${Math.min(gx, t2.gx)},${Math.min(gy, t2.gy)}`,
          `${Math.max(gx, t2.gx)},${Math.max(gy, t2.gy)}`,
          `${houseN.gx},${houseN.gy}`,
        ].join("-");
        if (visited.has(key)) continue;
        visited.add(key);

        const members: [number, number][] = [
          [gx, gy], [t2.gx, t2.gy], [houseN.gx, houseN.gy],
        ];
        const tiles = members.map(([cx, cy]) => gpos(cx, cy, gridSize));
        const midX = tiles.reduce((s, [x]) => s + x, 0) / 3;
        const midZ = tiles.reduce((s, [, z]) => s + z, 0) / 3;

        for (const [px, pz] of tiles) {
          removeObjectAt(root, px, pz);
        }

        const stoneMat = new THREE.MeshStandardMaterial({
          color: 0x6a6a7a,
          roughness: 0.8,
          metalness: 0.1,
          flatShading: true,
        });

        // --- Main keep ---
        const keep = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.7, 0.6),
          stoneMat
        );
        keep.position.set(midX, 0.41, midZ);
        keep.castShadow = true;
        root.add(keep);

        // --- Tower pair ---
        const [p1x, p1z] = tiles[0];
        const [p2x, p2z] = tiles[1];
        for (const [tx, tz] of [[p1x, p1z], [p2x, p2z]]) {
          const tower = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.16, 0.9, 8),
            stoneMat
          );
          tower.position.set(tx, 0.51, tz);
          tower.castShadow = true;
          root.add(tower);
          const coneTop = new THREE.Mesh(
            new THREE.ConeGeometry(0.17, 0.2, 8),
            new THREE.MeshStandardMaterial({ color: 0x8b4513, flatShading: true })
          );
          coneTop.position.set(tx, 1.06, tz);
          root.add(coneTop);
        }

        // --- Connecting wall ---
        const dx = p2x - p1x;
        const dz = p2z - p1z;
        const len = Math.sqrt(dx * dx + dz * dz);
        const wallAngle = Math.atan2(dz, dx);
        const wallMx = (p1x + p2x) / 2;
        const wallMz = (p1z + p2z) / 2;
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(len * 0.6, 0.45, 0.08),
          stoneMat
        );
        wall.position.set(wallMx, 0.29, wallMz);
        wall.rotation.y = wallAngle;
        wall.castShadow = true;
        root.add(wall);

        // --- Gate (house side) ---
        const [hx, hz] = tiles[2];
        const gateDx = hx - midX;
        const gateDz = hz - midZ;
        const gateAngle = Math.atan2(gateDz, gateDx);
        const gateX = midX + Math.cos(gateAngle) * 0.3;
        const gateZ = midZ + Math.sin(gateAngle) * 0.3;
        const gateL = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.5, 0.08),
          stoneMat
        );
        gateL.position.set(
          gateX + Math.cos(gateAngle + Math.PI / 2) * 0.12,
          0.31,
          gateZ + Math.sin(gateAngle + Math.PI / 2) * 0.12
        );
        root.add(gateL);
        const gateR = gateL.clone();
        gateR.position.set(
          gateX + Math.cos(gateAngle - Math.PI / 2) * 0.12,
          0.31,
          gateZ + Math.sin(gateAngle - Math.PI / 2) * 0.12
        );
        root.add(gateR);
        const gateTop = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.06, 0.08),
          stoneMat
        );
        gateTop.position.set(gateX, 0.59, gateZ);
        gateTop.rotation.y = gateAngle;
        root.add(gateTop);

        // --- Banner ---
        const bannerColors = [0xff3333, 0x3333ff, 0xffcc00];
        const col = bannerColors[(gx + gy) % bannerColors.length];
        const flag = new THREE.Mesh(
          new THREE.PlaneGeometry(0.15, 0.2),
          new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.4,
            side: THREE.DoubleSide,
          })
        );
        flag.position.set(midX, 0.95, midZ);
        root.add(flag);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.01, 0.01, 0.3),
          poleMat
        );
        pole.position.set(midX, 0.88, midZ);
        root.add(pole);
        const phase = gx * 2.1 + gy * 3.3;
        anim(flag, (t) => {
          flag.rotation.z = Math.sin(t * 3.0 + phase) * 0.15;
          flag.scale.x = 1.0 + Math.sin(t * 4.0 + phase) * 0.06;
        });
      }
    }
  }
}

function ruleCastleWall(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  for (let gx = 0; gx < gridSize; gx++) {
    for (let gy = 0; gy < gridSize; gy++) {
      if (grid[gx][gy]?.type !== "tower") continue;
      const adjHouses = neighbors(grid, gx, gy).filter(
        (n) => n.cell.type === "house"
      );
      if (adjHouses.length === 0) continue;
      const [px, pz] = gpos(gx, gy, gridSize);
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x6a6a7a,
        roughness: 0.85,
        metalness: 0.1,
      });
      for (const h of adjHouses) {
        const [hx, hz] = gpos(h.gx, h.gy, gridSize);
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
  const gridSize = grid.length;
  for (let gx = 0; gx < gridSize; gx++) {
    for (let gy = 0; gy < gridSize; gy++) {
      if (grid[gx][gy]?.type !== "windmill") continue;
      const adjTrees = neighbors(grid, gx, gy, ADJ8).filter(
        (n) => n.cell.type === "tree"
      );
      if (adjTrees.length === 0) continue;
      const [px, pz] = gpos(gx, gy, gridSize);
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
        const [tx, tz] = gpos(tree.gx, tree.gy, gridSize);
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

function ruleSteamFactory(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "windmill").length < 2 ||
          block.filter((t) => t === "tower").length < 2) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const brickMat = new THREE.MeshStandardMaterial({
        color: 0x8b4513, roughness: 0.9, metalness: 0.1, flatShading: true,
      });
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.7, 1.2), brickMat
      );
      building.position.set(cx, 0.41, cz);
      building.castShadow = true;
      root.add(building);

      const roofMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.06, 1.3),
        new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.95 })
      );
      roofMesh.position.set(cx, 0.78, cz);
      root.add(roofMesh);

      const stackMat = new THREE.MeshStandardMaterial({
        color: 0x5a5a5a, roughness: 0.7, metalness: 0.3,
      });
      const stacks = [[cx - 0.4, cz - 0.2], [cx + 0.3, cz + 0.15]];
      for (let si = 0; si < stacks.length; si++) {
        const [sx, sz] = stacks[si];
        const stack = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.1, 0.6, 8), stackMat
        );
        stack.position.set(sx, 1.08, sz);
        stack.castShadow = true;
        root.add(stack);

        for (let i = 0; i < 6; i++) {
          const steamMat = new THREE.MeshStandardMaterial({
            color: 0xcccccc, emissive: 0x888888, emissiveIntensity: 0.3,
            transparent: true, opacity: 0.3,
          });
          const steam = new THREE.Mesh(
            new THREE.SphereGeometry(0.04 + (i % 3) * 0.02, 6, 6), steamMat
          );
          root.add(steam);
          const phase = (i / 6) * Math.PI * 2 + si * 3.0;
          anim(steam, (t) => {
            const prog = ((t * 0.4 + i * 0.2) % 2.0);
            steam.position.set(
              sx + Math.sin(t * 0.8 + phase) * 0.06,
              1.4 + prog * 0.4,
              sz + Math.cos(t * 0.6 + phase) * 0.06
            );
            steamMat.opacity = 0.35 * Math.max(0, 1.0 - prog / 1.5);
            steam.scale.setScalar(1.0 + prog * 0.8);
          });
        }
      }

      const gearMat = new THREE.MeshStandardMaterial({
        color: 0x888888, roughness: 0.4, metalness: 0.6,
      });
      for (let gi = 0; gi < 2; gi++) {
        const gear = new THREE.Mesh(
          new THREE.TorusGeometry(0.15, 0.03, 4, 8), gearMat
        );
        gear.position.set(cx + (gi === 0 ? -0.5 : 0.5), 0.5, cz + 0.61);
        root.add(gear);
        const dir = gi === 0 ? 1 : -1;
        anim(gear, (t) => { gear.rotation.z = t * 1.5 * dir; });
      }

      for (let wi = 0; wi < 4; wi++) {
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(0.12, 0.1),
          new THREE.MeshStandardMaterial({
            color: 0xff8844, emissive: 0xff6622, emissiveIntensity: 2.0,
            transparent: true, opacity: 0.8,
          })
        );
        win.position.set(cx - 0.45 + wi * 0.3, 0.35, cz + 0.61);
        root.add(win);
      }

      for (let i = 0; i < 5; i++) {
        const sparkMat = new THREE.MeshStandardMaterial({
          color: 0xff4400, emissive: 0xff4400, emissiveIntensity: 3.0,
          transparent: true, opacity: 0.8,
        });
        const spark = new THREE.Mesh(
          new THREE.SphereGeometry(0.015, 4, 4), sparkMat
        );
        root.add(spark);
        const phase = i * 1.26;
        anim(spark, (t) => {
          const prog = ((t * 0.6 + i * 0.3) % 1.5);
          spark.position.set(
            cx - 0.4 + Math.sin(t * 2.0 + phase) * 0.15,
            1.4 + prog * 0.3,
            cz - 0.2 + Math.cos(t * 1.5 + phase) * 0.15
          );
          sparkMat.opacity = 0.8 * Math.max(0, 1.0 - prog / 1.2);
        });
      }

      const fLight = new THREE.PointLight(0xff6622, 0.5, 2.5, 2.0);
      fLight.position.set(cx, 0.5, cz);
      root.add(fLight);
      anim(fLight, (t) => { fLight.intensity = 0.4 + Math.sin(t * 3.0) * 0.2; });
    }
  }
}

function ruleGrandFlowerField(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "flower").length < 4) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const carpet = new THREE.Mesh(
        new THREE.PlaneGeometry(2.0, 2.0),
        new THREE.MeshStandardMaterial({
          color: 0x55aa44, roughness: 0.95, side: THREE.DoubleSide,
        })
      );
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.set(cx, 0.02, cz);
      carpet.receiveShadow = true;
      root.add(carpet);

      const flowerColors = [0xff6699, 0xff99cc, 0xffcc66, 0xcc66ff, 0xff4488, 0xffaa33];
      for (let i = 0; i < 40; i++) {
        const fx = cx + (Math.random() - 0.5) * 1.8;
        const fz = cz + (Math.random() - 0.5) * 1.8;
        const col = flowerColors[i % flowerColors.length];
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.006, 0.006, 0.08 + (i % 4) * 0.03),
          new THREE.MeshStandardMaterial({ color: 0x33aa33 })
        );
        const h = 0.04 + (i % 4) * 0.015;
        stem.position.set(fx, h, fz);
        root.add(stem);
        const bloom = new THREE.Mesh(
          new THREE.SphereGeometry(0.025 + (i % 3) * 0.008, 5, 5),
          new THREE.MeshStandardMaterial({
            color: col, emissive: col, emissiveIntensity: 0.4,
          })
        );
        bloom.position.set(fx, h * 2 + 0.02, fz);
        root.add(bloom);
        const phase = i * 0.3;
        anim(bloom, (t) => {
          bloom.position.y = h * 2 + 0.02 + Math.sin(t * 2.0 + phase) * 0.01;
        });
      }

      for (let i = 0; i < 6; i++) {
        const bCol = [0xffddee, 0xffeedd, 0xddddff][i % 3];
        const wingMat = new THREE.MeshStandardMaterial({
          color: bCol, emissive: bCol, emissiveIntensity: 0.5,
          transparent: true, opacity: 0.8, side: THREE.DoubleSide,
        });
        const wing = new THREE.Mesh(
          new THREE.PlaneGeometry(0.06, 0.04), wingMat
        );
        root.add(wing);
        const phase = i * 1.05;
        const r = 0.4 + (i % 3) * 0.2;
        const bh = 0.3 + (i % 4) * 0.1;
        anim(wing, (t) => {
          const a = t * 0.5 + phase;
          wing.position.set(
            cx + Math.cos(a) * r,
            bh + Math.sin(t * 1.5 + phase) * 0.15,
            cz + Math.sin(a) * r
          );
          wing.rotation.y = a + Math.PI / 2;
          wing.rotation.z = Math.sin(t * 8.0 + phase) * 0.5;
        });
      }

      for (let i = 0; i < 10; i++) {
        const petalMat = new THREE.MeshStandardMaterial({
          color: flowerColors[i % flowerColors.length],
          emissive: flowerColors[i % flowerColors.length],
          emissiveIntensity: 0.6,
          transparent: true, opacity: 0.6, side: THREE.DoubleSide,
        });
        const petal = new THREE.Mesh(
          new THREE.PlaneGeometry(0.04, 0.04), petalMat
        );
        root.add(petal);
        const phase = i * 0.63;
        const pr = 0.3 + (i % 4) * 0.15;
        anim(petal, (t) => {
          const a = t * 0.8 + phase;
          const prog = ((t * 0.3 + i * 0.15) % 2.0);
          petal.position.set(
            cx + Math.cos(a) * pr,
            0.1 + prog * 0.5,
            cz + Math.sin(a) * pr
          );
          petal.rotation.set(t + phase, t * 0.7 + phase, 0);
          petalMat.opacity = 0.6 * Math.max(0, 1.0 - prog / 1.8);
        });
      }
    }
  }
}

function ruleBarrier(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "lamp").length < 4) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const corners = [
        [cx - 0.5, cz - 0.5], [cx + 0.5, cz - 0.5],
        [cx - 0.5, cz + 0.5], [cx + 0.5, cz + 0.5],
      ];
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0xaaccff, emissive: 0x6688ff, emissiveIntensity: 2.0,
        transparent: true, opacity: 0.8,
      });
      for (let ci = 0; ci < corners.length; ci++) {
        const [px, pz] = corners[ci];
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.07, 1.2, 6), pillarMat
        );
        pillar.position.set(px, 0.6, pz);
        root.add(pillar);
        const pLight = new THREE.PointLight(0x6688ff, 0.4, 1.5, 2.0);
        pLight.position.set(px, 0.8, pz);
        root.add(pLight);
        const phase = ci * 1.57;
        anim(pillar, (t) => {
          (pillar.material as THREE.MeshStandardMaterial).emissiveIntensity =
            1.5 + Math.sin(t * 2.5 + phase) * 1.0;
        });
      }

      const beamMat = new THREE.MeshStandardMaterial({
        color: 0x88aaff, emissive: 0x88aaff, emissiveIntensity: 2.0,
        transparent: true, opacity: 0.3,
      });
      const edges = [[0, 1], [1, 3], [3, 2], [2, 0], [0, 3], [1, 2]];
      for (const [a, b] of edges) {
        const [ax, az] = corners[a];
        const [bx, bz] = corners[b];
        const mx = (ax + bx) / 2;
        const mz = (az + bz) / 2;
        const dx = bx - ax;
        const dz = bz - az;
        const len = Math.sqrt(dx * dx + dz * dz);
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, len, 4), beamMat.clone()
        );
        beam.position.set(mx, 0.7, mz);
        beam.rotation.z = Math.PI / 2;
        beam.rotation.y = Math.atan2(dz, dx);
        root.add(beam);
        const phase = a + b;
        anim(beam, (t) => {
          const m = beam.material as THREE.MeshStandardMaterial;
          m.opacity = 0.2 + Math.sin(t * 3.0 + phase) * 0.15;
          m.emissiveIntensity = 1.5 + Math.sin(t * 2.0 + phase) * 1.0;
        });
      }

      const circleMat = new THREE.MeshStandardMaterial({
        color: 0xaaddff, emissive: 0xaaddff, emissiveIntensity: 2.5,
        transparent: true, opacity: 0.4,
      });
      const circle = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.02, 4, 24), circleMat
      );
      circle.position.set(cx, 0.7, cz);
      circle.rotation.x = Math.PI / 2;
      root.add(circle);
      anim(circle, (t) => {
        circle.rotation.z = t * 0.5;
        circle.position.y = 0.7 + Math.sin(t * 1.0) * 0.05;
        circleMat.emissiveIntensity = 2.0 + Math.sin(t * 2.0) * 1.0;
      });

      const innerCircle = new THREE.Mesh(
        new THREE.TorusGeometry(0.25, 0.015, 4, 18), circleMat.clone()
      );
      innerCircle.position.set(cx, 0.7, cz);
      innerCircle.rotation.x = Math.PI / 2;
      root.add(innerCircle);
      anim(innerCircle, (t) => {
        innerCircle.rotation.z = -t * 0.8;
        innerCircle.position.y = 0.7 + Math.sin(t * 1.0) * 0.05;
      });
    }
  }
}

function ruleAncientForest(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "tree").length < 4) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const barkMat = new THREE.MeshStandardMaterial({
        color: 0x4a3520, roughness: 0.95, flatShading: true,
      });
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.35, 1.5, 8), barkMat
      );
      trunk.position.set(cx, 0.75, cz);
      trunk.castShadow = true;
      root.add(trunk);

      const canopyMat = new THREE.MeshStandardMaterial({
        color: 0x2a6a2a, emissive: 0x1a4a1a, emissiveIntensity: 0.2,
        flatShading: true,
      });
      for (let i = 0; i < 5; i++) {
        const canopy = new THREE.Mesh(
          new THREE.SphereGeometry(0.5 - i * 0.06, 6, 5), canopyMat
        );
        const a = (i / 5) * Math.PI * 2;
        const r = 0.2 + (i % 3) * 0.1;
        canopy.position.set(
          cx + Math.cos(a) * r,
          1.4 + (i % 3) * 0.15,
          cz + Math.sin(a) * r
        );
        canopy.castShadow = true;
        root.add(canopy);
      }

      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const rootMat = new THREE.MeshStandardMaterial({
          color: 0x3a6a3a, emissive: 0x22ff66, emissiveIntensity: 0.8,
          transparent: true, opacity: 0.6,
        });
        const rootMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.04, 0.8, 4), rootMat
        );
        const rx = cx + Math.cos(a) * 0.5;
        const rz = cz + Math.sin(a) * 0.5;
        rootMesh.position.set(rx, 0.1, rz);
        rootMesh.rotation.z = Math.cos(a) * 0.6;
        rootMesh.rotation.x = Math.sin(a) * 0.6;
        root.add(rootMesh);
        const phase = i * 1.05;
        anim(rootMesh, (t) => {
          rootMat.emissiveIntensity = 0.5 + Math.sin(t * 2.0 + phase) * 0.5;
        });
      }

      for (let i = 0; i < 12; i++) {
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x44bb44, emissive: 0x22aa22, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.6, side: THREE.DoubleSide,
        });
        const leaf = new THREE.Mesh(
          new THREE.PlaneGeometry(0.05, 0.05), leafMat
        );
        root.add(leaf);
        const phase = i * 0.52;
        const lr = 0.4 + (i % 4) * 0.15;
        anim(leaf, (t) => {
          const a = t * 0.3 + phase;
          const prog = ((t * 0.2 + i * 0.1) % 2.5);
          leaf.position.set(
            cx + Math.cos(a) * lr,
            1.8 - prog * 0.6,
            cz + Math.sin(a) * lr
          );
          leaf.rotation.set(t * 0.5 + phase, t * 0.3, 0);
          leafMat.opacity = 0.6 * Math.max(0, 1.0 - prog / 2.2);
        });
      }

      const treeLight = new THREE.PointLight(0x22ff66, 0.5, 3.0, 2.0);
      treeLight.position.set(cx, 0.3, cz);
      root.add(treeLight);
      anim(treeLight, (t) => {
        treeLight.intensity = 0.4 + Math.sin(t * 1.5) * 0.2;
      });
    }
  }
}

function ruleFireflyLake(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "pond").length < 2 ||
          block.filter((t) => t === "lamp").length < 2) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x224488, emissive: 0x112244, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.75, metalness: 0.4,
      });
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 0.95, 0.03, 16), waterMat
      );
      water.position.set(cx, 0.04, cz);
      root.add(water);
      anim(water, (t) => {
        waterMat.emissiveIntensity = 0.4 + Math.sin(t * 1.0) * 0.2;
      });

      for (let i = 0; i < 3; i++) {
        const rippleMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.5,
          transparent: true, opacity: 0.3,
        });
        const ripple = new THREE.Mesh(
          new THREE.TorusGeometry(0.2, 0.008, 4, 16), rippleMat
        );
        ripple.rotation.x = Math.PI / 2;
        ripple.position.set(cx, 0.06, cz);
        root.add(ripple);
        const phase = i * 2.1;
        anim(ripple, (t) => {
          const prog = ((t * 0.5 + phase) % 3.0);
          const s = 0.5 + prog * 0.8;
          ripple.scale.set(s, s, 1);
          rippleMat.opacity = 0.3 * Math.max(0, 1.0 - prog / 2.5);
        });
      }

      for (let i = 0; i < 5; i++) {
        const lily = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 0.01, 6),
          new THREE.MeshStandardMaterial({
            color: 0x33aa44, emissive: 0x22aa33, emissiveIntensity: 0.2,
          })
        );
        const a = (i / 5) * Math.PI * 2 + 0.5;
        const r = 0.4 + (i % 3) * 0.15;
        lily.position.set(cx + Math.cos(a) * r, 0.06, cz + Math.sin(a) * r);
        root.add(lily);
      }

      for (let i = 0; i < 20; i++) {
        const flyMat = new THREE.MeshStandardMaterial({
          color: 0xccff88, emissive: 0xccff88, emissiveIntensity: 3.0,
          transparent: true, opacity: 0.8,
        });
        const fly = new THREE.Mesh(
          new THREE.SphereGeometry(0.015, 4, 4), flyMat
        );
        root.add(fly);
        const phase = i * 0.31;
        const fr = 0.3 + (i % 5) * 0.12;
        const fh = 0.15 + (i % 4) * 0.1;
        anim(fly, (t) => {
          const a = t * (0.3 + (i % 3) * 0.2) + phase;
          fly.position.set(
            cx + Math.cos(a) * fr,
            fh + Math.sin(t * 1.5 + phase) * 0.12,
            cz + Math.sin(a) * fr
          );
          flyMat.emissiveIntensity = 2.0 + Math.sin(t * 4.0 + phase) * 2.0;
          flyMat.opacity = 0.5 + Math.sin(t * 3.0 + phase) * 0.4;
        });
      }

      const lakeLight = new THREE.PointLight(0xccff88, 0.6, 3.0, 2.0);
      lakeLight.position.set(cx, 0.3, cz);
      root.add(lakeLight);
      anim(lakeLight, (t) => {
        lakeLight.intensity = 0.4 + Math.sin(t * 2.0) * 0.3;
      });
    }
  }
}

function ruleTemple(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "shrine").length < 2 ||
          block.filter((t) => t === "statue").length < 2) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0xddddcc, roughness: 0.7, metalness: 0.1,
      });
      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.05, 0.12, 12), stoneMat
      );
      platform.position.set(cx, 0.06, cz);
      platform.receiveShadow = true;
      root.add(platform);

      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.05, 0.8, 6), stoneMat
        );
        pillar.position.set(cx + Math.cos(a) * 0.75, 0.52, cz + Math.sin(a) * 0.75);
        pillar.castShadow = true;
        root.add(pillar);
      }

      const roofMesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 0.35, 8),
        new THREE.MeshStandardMaterial({
          color: 0xcc4444, roughness: 0.8, flatShading: true,
        })
      );
      roofMesh.position.set(cx, 1.1, cz);
      root.add(roofMesh);

      const beamMat = new THREE.MeshStandardMaterial({
        color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 2.0,
        transparent: true, opacity: 0.2,
      });
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.2, 1.5, 6), beamMat
      );
      beam.position.set(cx, 0.85, cz);
      root.add(beam);
      anim(beam, (t) => {
        beamMat.opacity = 0.15 + Math.sin(t * 1.5) * 0.1;
        beamMat.emissiveIntensity = 1.5 + Math.sin(t * 2.0) * 1.0;
        beam.rotation.y = t * 0.2;
      });

      for (let i = 0; i < 8; i++) {
        const sparkle = new THREE.Mesh(
          new THREE.SphereGeometry(0.02, 4, 4),
          new THREE.MeshStandardMaterial({
            color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 3.0,
            transparent: true, opacity: 0.6,
          })
        );
        root.add(sparkle);
        const phase = i * 0.79;
        anim(sparkle, (t) => {
          const a = t * 0.5 + phase;
          const prog = ((t * 0.4 + i * 0.2) % 2.0);
          sparkle.position.set(
            cx + Math.cos(a) * 0.15,
            0.3 + prog * 0.6,
            cz + Math.sin(a) * 0.15
          );
          (sparkle.material as THREE.MeshStandardMaterial).opacity =
            0.6 * Math.max(0, 1.0 - prog / 1.8);
        });
      }

      const templeLight = new THREE.PointLight(0xffd700, 0.7, 3.0, 2.0);
      templeLight.position.set(cx, 0.6, cz);
      root.add(templeLight);
      anim(templeLight, (t) => {
        templeLight.intensity = 0.5 + Math.sin(t * 1.5) * 0.3;
      });
    }
  }
}

function ruleWindGarden(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "windmill").length < 2 ||
          block.filter((t) => t === "flower").length < 2) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = 0.6 + (i % 3) * 0.15;
        const col = [0xff6699, 0xffcc44, 0xcc66ff, 0xff88aa][i % 4];
        const fl = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 5, 5),
          new THREE.MeshStandardMaterial({
            color: col, emissive: col, emissiveIntensity: 0.4,
          })
        );
        fl.position.set(cx + Math.cos(a) * r, 0.08, cz + Math.sin(a) * r);
        root.add(fl);
      }

      const petalColors = [0xff6699, 0xffcc44, 0xcc66ff, 0xff88aa, 0xffaacc];
      for (let i = 0; i < 20; i++) {
        const col = petalColors[i % petalColors.length];
        const petalMat = new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: 0.8,
          transparent: true, opacity: 0.7, side: THREE.DoubleSide,
        });
        const petal = new THREE.Mesh(
          new THREE.PlaneGeometry(0.05, 0.04), petalMat
        );
        root.add(petal);
        const phase = i * 0.31;
        const startR = 0.2 + (i % 5) * 0.1;
        anim(petal, (t) => {
          const a = t * (1.0 + (i % 3) * 0.3) + phase;
          const prog = ((t * 0.5 + i * 0.15) % 2.5);
          const r2 = startR + prog * 0.15;
          petal.position.set(
            cx + Math.cos(a) * r2,
            0.1 + prog * 0.5,
            cz + Math.sin(a) * r2
          );
          petal.rotation.set(t * 2.0 + phase, t * 1.5, 0);
          petalMat.opacity = 0.7 * Math.max(0, 1.0 - prog / 2.2);
        });
      }

      for (let i = 0; i < 4; i++) {
        const windMat = new THREE.MeshStandardMaterial({
          color: 0xaaddff, emissive: 0xaaddff, emissiveIntensity: 0.4,
          transparent: true, opacity: 0.12, side: THREE.DoubleSide,
        });
        const wind = new THREE.Mesh(
          new THREE.PlaneGeometry(1.0, 0.04), windMat
        );
        wind.position.set(cx, 0.3 + i * 0.15, cz);
        root.add(wind);
        const phase = i * 1.57;
        anim(wind, (t) => {
          wind.rotation.y = t * 0.8 + phase;
          wind.position.y = 0.3 + i * 0.15 + Math.sin(t * 1.5 + phase) * 0.05;
          windMat.opacity = 0.08 + Math.sin(t * 2.0 + phase) * 0.06;
        });
      }
    }
  }
}

function ruleTavernDistrict(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "house").length < 2 ||
          block.filter((t) => t === "lamp").length < 2) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const woodMat = new THREE.MeshStandardMaterial({
        color: 0x6a4a2a, roughness: 0.9, flatShading: true,
      });
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.8, 1.0), woodMat
      );
      building.position.set(cx, 0.46, cz);
      building.castShadow = true;
      root.add(building);

      const roofMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.06, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x8b4513 })
      );
      roofMesh.position.set(cx, 0.88, cz);
      root.add(roofMesh);
      const roofTop = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.06, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x7a3a10 })
      );
      roofTop.position.set(cx, 0.94, cz);
      root.add(roofTop);

      const chimney = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.3, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x555555 })
      );
      chimney.position.set(cx + 0.45, 1.08, cz - 0.2);
      root.add(chimney);
      for (let i = 0; i < 4; i++) {
        const smokeMat = new THREE.MeshStandardMaterial({
          color: 0x999999, transparent: true, opacity: 0.2,
        });
        const smoke = new THREE.Mesh(
          new THREE.SphereGeometry(0.03 + i * 0.01, 6, 6), smokeMat
        );
        root.add(smoke);
        const phase = i * 1.57;
        anim(smoke, (t) => {
          const prog = ((t * 0.3 + i * 0.25) % 2.0);
          smoke.position.set(
            cx + 0.45 + Math.sin(t * 0.5 + phase) * 0.04,
            1.25 + prog * 0.3,
            cz - 0.2 + Math.cos(t * 0.4 + phase) * 0.04
          );
          smokeMat.opacity = 0.2 * Math.max(0, 1.0 - prog / 1.5);
          smoke.scale.setScalar(1.0 + prog * 0.6);
        });
      }

      const warmWinMat = new THREE.MeshStandardMaterial({
        color: 0xffaa44, emissive: 0xff8822, emissiveIntensity: 2.5,
        transparent: true, opacity: 0.85,
      });
      for (let wi = 0; wi < 3; wi++) {
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(0.15, 0.12), warmWinMat.clone()
        );
        win.position.set(cx - 0.35 + wi * 0.35, 0.45, cz + 0.51);
        root.add(win);
        const phase = wi * 1.5;
        anim(win, (t) => {
          (win.material as THREE.MeshStandardMaterial).emissiveIntensity =
            2.0 + Math.sin(t * 1.5 + phase) * 0.8;
        });
      }

      const doorLight = new THREE.PointLight(0xffaa44, 0.6, 2.0, 2.0);
      doorLight.position.set(cx, 0.3, cz + 0.55);
      root.add(doorLight);

      const signPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      );
      signPole.position.set(cx + 0.6, 0.6, cz + 0.51);
      root.add(signPole);
      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.12, 0.02),
        new THREE.MeshStandardMaterial({
          color: 0xcc8833, emissive: 0x664411, emissiveIntensity: 0.3,
        })
      );
      signBoard.position.set(cx + 0.7, 0.55, cz + 0.51);
      root.add(signBoard);
      anim(signBoard, (t) => {
        signBoard.rotation.z = Math.sin(t * 1.5 + gx) * 0.12;
      });

      anim(doorLight, (t) => {
        doorLight.intensity = 0.5 + Math.sin(t * 2.0) * 0.2;
      });
    }
  }
}

function ruleColosseum(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "statue").length < 4) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x8a8a7a, roughness: 0.85, metalness: 0.1, flatShading: true,
      });
      const arena = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.95, 0.06, 16), stoneMat
      );
      arena.position.set(cx, 0.03, cz);
      arena.receiveShadow = true;
      root.add(arena);

      for (let tier = 0; tier < 3; tier++) {
        const r = 0.85 - tier * 0.05;
        const h = 0.2 + tier * 0.18;
        const wallSeg = 12;
        for (let i = 0; i < wallSeg; i++) {
          const a = (i / wallSeg) * Math.PI * 2;
          const archGap = i % 3 === 0 && tier === 0;
          if (archGap) continue;
          const seg = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, h * 0.5, 0.06), stoneMat
          );
          seg.position.set(
            cx + Math.cos(a) * r,
            0.06 + h * 0.25,
            cz + Math.sin(a) * r
          );
          seg.rotation.y = a;
          seg.castShadow = true;
          root.add(seg);
        }
      }

      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.04, 0.7, 6), stoneMat
        );
        pillar.position.set(cx + Math.cos(a) * 0.88, 0.41, cz + Math.sin(a) * 0.88);
        pillar.castShadow = true;
        root.add(pillar);
      }

      const orbColors = [0xff4444, 0x4444ff];
      for (let i = 0; i < 2; i++) {
        const orbMat = new THREE.MeshStandardMaterial({
          color: orbColors[i], emissive: orbColors[i], emissiveIntensity: 3.0,
          transparent: true, opacity: 0.8,
        });
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 6, 6), orbMat
        );
        root.add(orb);
        const dir = i === 0 ? 1 : -1;
        anim(orb, (t) => {
          const a = t * 1.2 * dir;
          orb.position.set(
            cx + Math.cos(a) * 0.2,
            0.5 + Math.sin(t * 2.0 + i * 3.14) * 0.1,
            cz + Math.sin(a) * 0.2
          );
          orbMat.emissiveIntensity = 2.5 + Math.sin(t * 3.0 + i * 3.14) * 1.5;
        });
      }

      for (let i = 0; i < 6; i++) {
        const sparkMat = new THREE.MeshStandardMaterial({
          color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3.0,
          transparent: true, opacity: 0.6,
        });
        const spark = new THREE.Mesh(
          new THREE.SphereGeometry(0.012, 4, 4), sparkMat
        );
        root.add(spark);
        const phase = i * 1.05;
        anim(spark, (t) => {
          const burst = Math.sin(t * 4.0 + phase);
          spark.position.set(
            cx + Math.cos(t * 3.0 + phase) * (0.05 + burst * 0.15),
            0.5 + Math.sin(t * 2.5 + phase) * 0.2,
            cz + Math.sin(t * 3.0 + phase) * (0.05 + burst * 0.15)
          );
          sparkMat.opacity = 0.3 + burst * 0.4;
        });
      }

      const arenaLight = new THREE.PointLight(0xff8844, 0.6, 3.0, 2.0);
      arenaLight.position.set(cx, 0.5, cz);
      root.add(arenaLight);
      anim(arenaLight, (t) => {
        arenaLight.intensity = 0.4 + Math.sin(t * 2.5) * 0.3;
      });
    }
  }
}

function ruleCursedSwamp(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "pond").length < 2 ||
          block.filter((t) => t === "statue").length < 2) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const swampMat = new THREE.MeshStandardMaterial({
        color: 0x2a3322, emissive: 0x112211, emissiveIntensity: 0.3,
        transparent: true, opacity: 0.85, metalness: 0.2,
      });
      const swamp = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.0, 0.04, 16), swampMat
      );
      swamp.position.set(cx, 0.02, cz);
      root.add(swamp);

      for (let i = 0; i < 10; i++) {
        const mistMat = new THREE.MeshStandardMaterial({
          color: 0x8844aa, emissive: 0x6622aa, emissiveIntensity: 1.0,
          transparent: true, opacity: 0.15,
        });
        const mist = new THREE.Mesh(
          new THREE.SphereGeometry(0.1 + (i % 3) * 0.05, 6, 6), mistMat
        );
        root.add(mist);
        const phase = i * 0.63;
        const mr = 0.3 + (i % 4) * 0.15;
        anim(mist, (t) => {
          const a = t * 0.3 + phase;
          const prog = ((t * 0.2 + i * 0.12) % 2.5);
          mist.position.set(
            cx + Math.cos(a) * mr,
            0.08 + prog * 0.2,
            cz + Math.sin(a) * mr
          );
          mistMat.opacity = 0.18 * Math.max(0, 1.0 - prog / 2.0);
          mist.scale.setScalar(1.0 + prog * 0.5);
        });
      }

      for (let i = 0; i < 4; i++) {
        const tentMat = new THREE.MeshStandardMaterial({
          color: 0x443366, emissive: 0x331155, emissiveIntensity: 0.5,
          roughness: 0.9,
        });
        const tentacle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.04, 0.4, 5), tentMat
        );
        root.add(tentacle);
        const phase = i * 1.57;
        const tr = 0.4 + (i % 2) * 0.2;
        const ta = (i / 4) * Math.PI * 2;
        anim(tentacle, (t) => {
          const h = 0.15 + Math.sin(t * 1.0 + phase) * 0.12;
          tentacle.position.set(
            cx + Math.cos(ta) * tr + Math.sin(t * 0.8 + phase) * 0.05,
            h,
            cz + Math.sin(ta) * tr + Math.cos(t * 0.6 + phase) * 0.05
          );
          tentacle.rotation.z = Math.sin(t * 1.2 + phase) * 0.4;
          tentacle.rotation.x = Math.cos(t * 0.9 + phase) * 0.3;
        });
      }

      for (let i = 0; i < 5; i++) {
        const bubbleMat = new THREE.MeshStandardMaterial({
          color: 0x44ff44, emissive: 0x22aa22, emissiveIntensity: 2.0,
          transparent: true, opacity: 0.5,
        });
        const bubble = new THREE.Mesh(
          new THREE.SphereGeometry(0.02, 4, 4), bubbleMat
        );
        root.add(bubble);
        const phase = i * 1.26;
        anim(bubble, (t) => {
          const prog = ((t * 0.5 + i * 0.3) % 1.5);
          const ba = (i / 5) * Math.PI * 2 + phase;
          const br = 0.3 + (i % 3) * 0.15;
          bubble.position.set(
            cx + Math.cos(ba + t * 0.3) * br,
            0.04 + prog * 0.25,
            cz + Math.sin(ba + t * 0.3) * br
          );
          bubbleMat.opacity = 0.5 * Math.max(0, 1.0 - prog / 1.2);
          bubble.scale.setScalar(0.8 + prog * 0.4);
        });
      }

      const cursedLight = new THREE.PointLight(0x44ff44, 0.5, 2.5, 2.0);
      cursedLight.position.set(cx, 0.3, cz);
      root.add(cursedLight);
      anim(cursedLight, (t) => {
        cursedLight.intensity = 0.3 + Math.sin(t * 1.5) * 0.25;
        cursedLight.color.setHex(
          Math.sin(t * 0.5) > 0 ? 0x44ff44 : 0x8844aa
        );
      });
    }
  }
}

function ruleMagicAcademy(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "tower").length < 2 ||
          block.filter((t) => t === "shrine").length < 2) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const darkStoneMat = new THREE.MeshStandardMaterial({
        color: 0x3a3a5a, roughness: 0.8, metalness: 0.2, flatShading: true,
      });
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.2, 1.3, 8), darkStoneMat
      );
      spire.position.set(cx, 0.75, cz);
      spire.castShadow = true;
      root.add(spire);
      const spireTop = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.35, 8),
        new THREE.MeshStandardMaterial({
          color: 0x2a2a4a, emissive: 0x4444aa, emissiveIntensity: 0.5,
          flatShading: true,
        })
      );
      spireTop.position.set(cx, 1.55, cz);
      root.add(spireTop);

      const ringColors = [0x8866ff, 0x44aaff, 0xaa44ff];
      for (let i = 0; i < 3; i++) {
        const ringMat = new THREE.MeshStandardMaterial({
          color: ringColors[i], emissive: ringColors[i],
          emissiveIntensity: 2.0, transparent: true, opacity: 0.4,
        });
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.35 + i * 0.12, 0.012, 4, 16), ringMat
        );
        ring.position.set(cx, 0.6 + i * 0.25, cz);
        root.add(ring);
        const dir = i % 2 === 0 ? 1 : -1;
        const tilt = 0.3 + i * 0.2;
        anim(ring, (t) => {
          ring.rotation.x = tilt + Math.sin(t * 0.5 + i) * 0.1;
          ring.rotation.y = t * 0.6 * dir;
          ringMat.emissiveIntensity = 1.5 + Math.sin(t * 2.0 + i * 2.1) * 1.0;
          ringMat.opacity = 0.3 + Math.sin(t * 1.5 + i) * 0.15;
        });
      }

      for (let i = 0; i < 10; i++) {
        const particleMat = new THREE.MeshStandardMaterial({
          color: 0x8866ff, emissive: 0x8866ff, emissiveIntensity: 3.0,
          transparent: true, opacity: 0.6,
        });
        const particle = new THREE.Mesh(
          new THREE.SphereGeometry(0.015, 4, 4), particleMat
        );
        root.add(particle);
        const phase = i * 0.63;
        anim(particle, (t) => {
          const prog = ((t * 0.4 + i * 0.15) % 3.0);
          const a = prog * 3.0 + phase;
          const r = 0.15 + prog * 0.08;
          particle.position.set(
            cx + Math.cos(a) * r,
            0.3 + prog * 0.4,
            cz + Math.sin(a) * r
          );
          particleMat.opacity = 0.6 * Math.max(0, 1.0 - prog / 2.5);
        });
      }

      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.08, 0),
        new THREE.MeshStandardMaterial({
          color: 0xaa88ff, emissive: 0x8866ff, emissiveIntensity: 3.0,
          transparent: true, opacity: 0.9, metalness: 0.3,
        })
      );
      crystal.position.set(cx, 1.75, cz);
      root.add(crystal);
      anim(crystal, (t) => {
        crystal.rotation.y = t * 0.8;
        crystal.position.y = 1.75 + Math.sin(t * 1.0) * 0.05;
        (crystal.material as THREE.MeshStandardMaterial).emissiveIntensity =
          2.5 + Math.sin(t * 2.5) * 1.5;
      });

      const academyLight = new THREE.PointLight(0x8866ff, 0.7, 3.0, 2.0);
      academyLight.position.set(cx, 0.8, cz);
      root.add(academyLight);
      anim(academyLight, (t) => {
        academyLight.intensity = 0.5 + Math.sin(t * 1.5) * 0.3;
      });
    }
  }
}

function ruleLighthouse(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "tower").length < 2 ||
          block.filter((t) => t === "lamp").length < 2) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const whiteMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee, roughness: 0.6,
      });
      const redMat = new THREE.MeshStandardMaterial({
        color: 0xcc3333, roughness: 0.7,
      });
      for (let i = 0; i < 4; i++) {
        const sec = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18 - i * 0.02, 0.2 - i * 0.02, 0.35, 8),
          i % 2 === 0 ? whiteMat : redMat
        );
        sec.position.set(cx, 0.175 + i * 0.35, cz);
        sec.castShadow = true;
        root.add(sec);
      }

      const gallery = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.16, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      );
      gallery.position.set(cx, 1.44, cz);
      root.add(gallery);

      const lanternMat = new THREE.MeshStandardMaterial({
        color: 0xffdd44, emissive: 0xffdd44, emissiveIntensity: 3.0,
        transparent: true, opacity: 0.9,
      });
      const lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8), lanternMat
      );
      lantern.position.set(cx, 1.55, cz);
      root.add(lantern);

      const lanternTop = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.12, 8),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      );
      lanternTop.position.set(cx, 1.67, cz);
      root.add(lanternTop);

      const beamMat = new THREE.MeshStandardMaterial({
        color: 0xffdd44, emissive: 0xffdd44, emissiveIntensity: 2.0,
        transparent: true, opacity: 0.15,
      });
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.3, 2.5, 4), beamMat
      );
      beam.position.set(cx + 1.0, 1.55, cz);
      beam.rotation.z = Math.PI / 2;
      root.add(beam);
      const beamLight = new THREE.SpotLight(0xffdd44, 2.0, 5.0, 0.3, 0.5);
      beamLight.position.set(cx, 1.55, cz);
      root.add(beamLight);
      anim(beam, (t) => {
        const a = t * 0.8;
        beam.position.set(cx + Math.cos(a) * 1.0, 1.55, cz + Math.sin(a) * 1.0);
        beam.rotation.y = -a;
        beamMat.opacity = 0.1 + Math.sin(t * 2.0) * 0.06;
        beamLight.target.position.set(
          cx + Math.cos(a) * 3.0, 0, cz + Math.sin(a) * 3.0
        );
        beamLight.target.updateMatrixWorld();
      });
      root.add(beamLight.target);

      const waveMat = new THREE.MeshStandardMaterial({
        color: 0x2244aa, emissive: 0x113388, emissiveIntensity: 0.3,
        transparent: true, opacity: 0.3,
      });
      for (let i = 0; i < 3; i++) {
        const wave = new THREE.Mesh(
          new THREE.TorusGeometry(0.7 + i * 0.15, 0.02, 4, 16), waveMat.clone()
        );
        wave.rotation.x = Math.PI / 2;
        wave.position.set(cx, 0.02, cz);
        root.add(wave);
        const phase = i * 2.1;
        anim(wave, (t) => {
          const s = 1.0 + Math.sin(t * 0.8 + phase) * 0.1;
          wave.scale.set(s, s, 1);
          (wave.material as THREE.MeshStandardMaterial).opacity =
            0.2 + Math.sin(t * 1.0 + phase) * 0.1;
        });
      }
    }
  }
}

function ruleRanch(grid: Grid, root: THREE.Group) {
  const gridSize = grid.length;
  const visited = new Set<string>();
  for (let gx = 0; gx < gridSize - 1; gx++) {
    for (let gy = 0; gy < gridSize - 1; gy++) {
      const block = [
        grid[gx][gy]?.type, grid[gx + 1][gy]?.type,
        grid[gx][gy + 1]?.type, grid[gx + 1][gy + 1]?.type,
      ];
      if (block.filter((t) => t === "house").length < 2 ||
          block.filter((t) => t === "windmill").length < 2) continue;
      const key = `${gx},${gy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const members: [number, number][] = [
        [gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1],
      ];
      for (const [mx, my] of members) {
        const [px, pz] = gpos(mx, my, gridSize);
        removeObjectAt(root, px, pz);
      }
      const H = (gridSize - 1) / 2;
      const cx = gx + 0.5 - H;
      const cz = gy + 0.5 - H;

      const barnMat = new THREE.MeshStandardMaterial({
        color: 0x8b2500, roughness: 0.9, flatShading: true,
      });
      const barn = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.6, 0.8), barnMat
      );
      barn.position.set(cx, 0.36, cz - 0.2);
      barn.castShadow = true;
      root.add(barn);

      const barnRoof = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.06, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x6a1a00 })
      );
      barnRoof.position.set(cx, 0.69, cz - 0.2);
      root.add(barnRoof);

      const barnDoor = new THREE.Mesh(
        new THREE.PlaneGeometry(0.25, 0.35),
        new THREE.MeshStandardMaterial({
          color: 0x4a2a10, emissive: 0x332211, emissiveIntensity: 0.3,
        })
      );
      barnDoor.position.set(cx, 0.24, cz + 0.21);
      root.add(barnDoor);

      const fenceMat = new THREE.MeshStandardMaterial({
        color: 0x8a7a5a, roughness: 0.95,
      });
      const fenceCorners = [
        [cx - 0.9, cz - 0.9], [cx + 0.9, cz - 0.9],
        [cx + 0.9, cz + 0.9], [cx - 0.9, cz + 0.9],
      ];
      for (let i = 0; i < 4; i++) {
        const [fx, fz] = fenceCorners[i];
        const [nx, nz] = fenceCorners[(i + 1) % 4];
        const dx = nx - fx;
        const dz = nz - fz;
        const len = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx);

        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.02, 0.02), fenceMat
        );
        rail.position.set((fx + nx) / 2, 0.15, (fz + nz) / 2);
        rail.rotation.y = angle;
        root.add(rail);
        const rail2 = rail.clone();
        rail2.position.y = 0.08;
        root.add(rail2);

        for (let pi = 0; pi <= 4; pi++) {
          const t = pi / 4;
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, 0.2, 4), fenceMat
          );
          post.position.set(fx + dx * t, 0.1, fz + dz * t);
          root.add(post);
        }
      }

      for (let i = 0; i < 3; i++) {
        const hay = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8),
          new THREE.MeshStandardMaterial({
            color: 0xccaa44, roughness: 1,
          })
        );
        hay.position.set(
          cx + 0.5 - i * 0.25,
          0.06,
          cz + 0.5 + (i % 2) * 0.15
        );
        hay.rotation.z = Math.PI / 2;
        root.add(hay);
      }

      const vanePole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x444444 })
      );
      vanePole.position.set(cx, 0.82, cz - 0.2);
      root.add(vanePole);
      const vaneGroup = new THREE.Group();
      vaneGroup.position.set(cx, 0.9, cz - 0.2);
      const vane = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.12, 4),
        new THREE.MeshStandardMaterial({ color: 0xcc8833 })
      );
      vane.position.set(0.04, 0, 0);
      vane.rotation.z = -Math.PI / 2;
      vaneGroup.add(vane);
      root.add(vaneGroup);
      anim(vaneGroup, (t) => {
        vaneGroup.rotation.y = Math.sin(t * 0.4 + gx * 2.3) * Math.PI;
      });

      for (let i = 0; i < 4; i++) {
        const strawMat = new THREE.MeshStandardMaterial({
          color: 0xccaa44, emissive: 0xaa8833, emissiveIntensity: 0.2,
          transparent: true, opacity: 0.5, side: THREE.DoubleSide,
        });
        const straw = new THREE.Mesh(
          new THREE.PlaneGeometry(0.04, 0.04), strawMat
        );
        root.add(straw);
        const phase = i * 1.57;
        anim(straw, (t) => {
          const prog = ((t * 0.3 + i * 0.4) % 3.0);
          straw.position.set(
            cx + 0.5 + Math.sin(t * 0.5 + phase) * 0.3,
            0.15 + prog * 0.15,
            cz + 0.5 + Math.cos(t * 0.4 + phase) * 0.3
          );
          straw.rotation.set(t + phase, t * 0.7, 0);
          strawMat.opacity = 0.5 * Math.max(0, 1.0 - prog / 2.5);
        });
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
  ruleSteamFactory,
  ruleGrandFlowerField,
  ruleBarrier,
  ruleAncientForest,
  ruleFireflyLake,
  ruleTemple,
  ruleWindGarden,
  ruleTavernDistrict,
  ruleColosseum,
  ruleCursedSwamp,
  ruleMagicAcademy,
  ruleLighthouse,
  ruleRanch,
];
