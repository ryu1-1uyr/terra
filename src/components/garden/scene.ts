import * as THREE from "three";
import { gpos } from "./grid";

export function createGardenRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  return renderer;
}

export interface TileOptions {
  tileSize?: number;
  tileHeight?: number;
  tileY?: number;
}

export function buildGridTiles(
  parent: THREE.Object3D,
  gridSize: number,
  opts?: TileOptions
): THREE.Mesh[] {
  const size = opts?.tileSize ?? 0.96;
  const height = opts?.tileHeight ?? 0.18;
  const y = opts?.tileY ?? -0.09;

  const tiles: THREE.Mesh[] = [];
  const tileGeo = new THREE.BoxGeometry(size, height, size);
  for (let gx = 0; gx < gridSize; gx++) {
    for (let gy = 0; gy < gridSize; gy++) {
      const even = (gx + gy) % 2 === 0;
      const t = new THREE.Mesh(
        tileGeo,
        new THREE.MeshStandardMaterial({
          color: even ? 0x2e3d55 : 0x243050,
          roughness: 0.92,
          metalness: 0,
        })
      );
      const [px, pz] = gpos(gx, gy, gridSize);
      t.position.set(px, y, pz);
      t.receiveShadow = true;
      t.userData = { gx, gz: gy };
      parent.add(t);
      tiles.push(t);
    }
  }
  return tiles;
}
