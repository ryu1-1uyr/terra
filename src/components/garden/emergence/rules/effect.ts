import * as THREE from "three";
import { GRID, gpos } from "../../grid";
import type { Grid, EmergenceRule } from "../detect";
import { neighbors, ADJ8 } from "../detect";
import { anim } from "../anim";
import { addPaperLantern } from "../helpers";

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

export const effectRules: EmergenceRule[] = [
  ruleWheatField,
  ruleSpiritOrbs,
  ruleLitWalkway,
  ruleReflection,
  ruleMonumentAura,
  ruleWindValley,
  ruleMagicGarden,
  ruleFestival,
  ruleHotSpring,
  ruleWeatherVane,
  rulePrayerLight,
  ruleGatekeeper,
  ruleGardenSculpture,
  ruleWatchtower,
  ruleSacredGrove,
  ruleLighthouseHarbor,
  ruleWatermill,
];
