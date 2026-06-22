import * as THREE from "three";
import { createObjectMesh, type ObjectType } from "./GardenObjects";

interface PlacedObj {
  type: ObjectType;
  gx: number;
  gy: number;
  growth: number;
}

interface GrowthAnimator {
  update(dt: number): void;
}

export function buildGrownObject(
  obj: PlacedObj,
): { group: THREE.Group; animator: GrowthAnimator | null } {
  const { type, gx, gy, growth } = obj;

  switch (type) {
    case "tower":
      return buildGrownTower(gx, gy, growth);
    case "house":
      return buildGrownHouse(gx, gy, growth);
    case "flower":
      return buildGrownFlower(gx, gy, growth);
    case "windmill":
      return buildGrownWindmill(gx, gy, growth);
    case "pond":
      return buildGrownPond(gx, gy, growth);
    case "statue":
      return buildGrownStatue(gx, gy, growth);
    case "shrine":
    case "lamp":
      return { group: createObjectMesh(type, gx, gy), animator: null };
    default: {
      const base = createObjectMesh(type, gx, gy);
      const s = 1 + growth;
      base.scale.set(s, s, s);
      return { group: base, animator: null };
    }
  }
}

function buildGrownTower(
  gx: number,
  gy: number,
  growth: number,
): { group: THREE.Group; animator: null } {
  const g = createObjectMesh("tower", gx, gy);
  const yScale = 1 + growth;
  for (const child of g.children) {
    child.position.y *= yScale;
    if ((child as THREE.Mesh).geometry) {
      const geo = (child as THREE.Mesh).geometry;
      if (geo instanceof THREE.BoxGeometry || geo instanceof THREE.CylinderGeometry) {
        child.scale.y = yScale;
      }
    }
  }
  return { group: g, animator: null };
}

function buildGrownStatue(
  gx: number,
  gy: number,
  growth: number,
): { group: THREE.Group; animator: null } {
  const g = createObjectMesh("statue", gx, gy);
  const yScale = 1 + growth;
  for (const child of g.children) {
    child.position.y *= yScale;
    if ((child as THREE.Mesh).geometry) {
      const geo = (child as THREE.Mesh).geometry;
      if (
        geo instanceof THREE.BoxGeometry ||
        geo instanceof THREE.CylinderGeometry ||
        geo instanceof THREE.SphereGeometry ||
        geo instanceof THREE.OctahedronGeometry
      ) {
        child.scale.y = yScale;
      }
    }
  }
  return { group: g, animator: null };
}

function buildGrownHouse(
  gx: number,
  gy: number,
  growth: number,
): { group: THREE.Group; animator: null } {
  const g = createObjectMesh("house", gx, gy);
  if (growth <= 0) return { group: g, animator: null };

  const body = g.children[0] as THREE.Mesh;
  const roof = g.children[1] as THREE.Mesh;
  const win = g.children[2] as THREE.Mesh;

  const extraH = growth * 0.3;
  body.scale.y = 1 + growth * 0.5;
  body.position.y = 0.3 + extraH * 0.5;

  const bodyTop = body.position.y + (0.3 * body.scale.y);
  roof.position.y = bodyTop + 0.22;

  win.position.y = body.position.y;

  return { group: g, animator: null };
}

function buildGrownFlower(
  gx: number,
  gy: number,
  growth: number,
): { group: THREE.Group; animator: null } {
  const g = new THREE.Group();
  const count = Math.min(5, 1 + Math.floor(growth));
  const sizeScale = 1 + growth * 0.06;

  const offsets: [number, number][] = [
    [0, 0],
    [-0.2, 0.15],
    [0.2, -0.15],
    [-0.1, -0.2],
    [0.15, 0.2],
  ];

  for (let i = 0; i < count; i++) {
    const flower = createObjectMesh("flower", gx + i, gy + i);
    flower.position.set(offsets[i][0], 0, offsets[i][1]);
    flower.scale.setScalar(sizeScale);
    if (i > 0) {
      flower.scale.multiplyScalar(0.7 + Math.random() * 0.3);
      flower.rotation.y = Math.random() * Math.PI * 2;
    }
    g.add(flower);
  }
  return { group: g, animator: null };
}

function buildGrownWindmill(
  gx: number,
  gy: number,
  growth: number,
): { group: THREE.Group; animator: GrowthAnimator } {
  const g = createObjectMesh("windmill", gx, gy);

  let bladeGroup: THREE.Group | null = null;
  g.traverse((child) => {
    if (child.userData.isBladeGroup) {
      bladeGroup = child as THREE.Group;
    }
  });

  const baseSpeed = 0.3;
  const speed = baseSpeed + growth * 0.4;

  return {
    group: g,
    animator: {
      update(dt: number) {
        if (bladeGroup) {
          bladeGroup.rotation.z += speed * dt;
        }
      },
    },
  };
}

function buildGrownPond(
  gx: number,
  gy: number,
  growth: number,
): { group: THREE.Group; animator: GrowthAnimator | null } {
  const g = createObjectMesh("pond", gx, gy);
  if (growth <= 0) return { group: g, animator: null };

  const maxH = 0.5 + growth * 2.5;
  const particleCount = 30 + Math.floor(growth * 15);
  const spread = 0.08 + growth * 0.03;

  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    resetParticle(i, positions, velocities, maxH, spread);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0x88ccff,
    size: 0.03 + growth * 0.01,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  g.add(points);

  return {
    group: g,
    animator: {
      update(dt: number) {
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          const idx = i * 3;
          arr[idx + 1] += velocities[i] * dt;
          const drift = 0.003 + growth * 0.002;
          arr[idx] += (Math.random() - 0.5) * drift;
          arr[idx + 2] += (Math.random() - 0.5) * drift;

          if (arr[idx + 1] > maxH || arr[idx + 1] < 0) {
            resetParticle(i, arr, velocities, maxH, spread);
          }
        }
        pos.needsUpdate = true;
      },
    },
  };
}

function resetParticle(
  i: number,
  positions: Float32Array,
  velocities: Float32Array,
  maxH: number,
  spread = 0.12,
) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * spread;
  const idx = i * 3;
  positions[idx] = Math.cos(angle) * r;
  positions[idx + 1] = Math.random() * maxH * 0.2;
  positions[idx + 2] = Math.sin(angle) * r;
  velocities[i] = (0.3 + Math.random() * 0.5) * (maxH / 1.5);
}
