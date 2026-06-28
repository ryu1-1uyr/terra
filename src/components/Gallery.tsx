import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "../mock-invoke";
import * as THREE from "three";
import { applyEmergence } from "./garden/emergence";
import { gpos } from "./garden/grid";
import { buildGridTiles } from "./garden/scene";
import { createObjectMesh, type ObjectType } from "./GardenObjects";
import "./Gallery.css";

interface FrozenGarden {
  id: number;
  season_number: number;
  frozen_at: string;
  snapshot_json: string;
  grid_size: number;
}

interface PlacedObject {
  item_type: ObjectType;
  grid_x: number;
  grid_z: number;
  growth_stage: number;
  random_seed: number;
}

export function Gallery() {
  const [gardens, setGardens] = useState<FrozenGarden[]>([]);
  const [selected, setSelected] = useState<FrozenGarden | null>(null);

  const loadGardens = useCallback(async () => {
    try {
      const list = await invoke<FrozenGarden[]>("list_frozen_gardens");
      setGardens(list);
    } catch {
      // Tauri IPC unavailable
    }
  }, []);

  useEffect(() => {
    loadGardens();
  }, [loadGardens]);

  if (selected) {
    return (
      <FrozenViewer
        garden={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  if (gardens.length === 0) {
    return (
      <div className="placeholder">
        <div className="placeholder-icon">🏛️</div>
        <div className="placeholder-text">
          凍結された箱庭がここに並ぶよ
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-grid">
      {gardens.map((g) => (
        <button
          key={g.id}
          className="gallery-card"
          onClick={() => setSelected(g)}
        >
          <div className="gallery-card-season">Season {g.season_number}</div>
          <div className="gallery-card-date">
            {g.frozen_at.split("T")[0]}
          </div>
          <div className="gallery-card-count">
            {JSON.parse(g.snapshot_json).length} objects
          </div>
        </button>
      ))}
    </div>
  );
}

function FrozenViewer({
  garden,
  onBack,
}: {
  garden: FrozenGarden;
  onBack: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const objects: PlacedObject[] = JSON.parse(garden.snapshot_json);
    const gardenObjects = objects.map((p) => ({
      type: p.item_type as "house" | "tower" | "tree" | "flower",
      gx: p.grid_x,
      gy: p.grid_z,
      growth: p.growth_stage,
    }));

    const { cleanup } = initFrozenScene(canvas, gardenObjects, garden.grid_size);
    return cleanup;
  }, [garden]);

  return (
    <div className="frozen-viewer">
      <div className="frozen-header">
        <button className="btn-back" onClick={onBack}>← 戻る</button>
        <span className="frozen-title">
          Season {garden.season_number} — {garden.frozen_at.split("T")[0]}
        </span>
      </div>
      <div className="frozen-canvas-wrap">
        <canvas ref={canvasRef} className="frozen-canvas" />
      </div>
    </div>
  );
}

interface FrozenObj {
  type: ObjectType;
  gx: number;
  gy: number;
  growth: number;
}

function initFrozenScene(canvas: HTMLCanvasElement, objects: FrozenObj[], gridSize: number) {
  let running = true;
  let animFrameId = 0;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c13);
  scene.fog = new THREE.Fog(0x0a0c13, 16, 38);

  const cam = new THREE.PerspectiveCamera(34, 16 / 10, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0x6a7cff, 0x2a1d24, 0.55));
  scene.add(new THREE.AmbientLight(0x36406a, 0.35));

  const key = new THREE.DirectionalLight(0xffe8c2, 3.0);
  key.position.set(7, 13, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 46;
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.04;
  key.shadow.radius = 3;
  scene.add(key);

  const rimM = new THREE.PointLight(0xff2fa0, 26, 26, 2.0);
  rimM.position.set(9, 4, -7);
  scene.add(rimM);
  const rimL = new THREE.PointLight(0xb6ff3f, 18, 26, 2.0);
  rimL.position.set(-9, 3, 7);
  scene.add(rimL);

  const root = new THREE.Group();
  scene.add(root);

  const baseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(gridSize + 0.6, 0.6, gridSize + 0.6),
    new THREE.MeshStandardMaterial({ color: 0x121a26, roughness: 1 })
  );
  baseMesh.position.set(0, -0.5, 0);
  baseMesh.receiveShadow = true;
  root.add(baseMesh);

  buildGridTiles(root, gridSize);

  for (const o of objects) {
    const [px, pz] = gpos(o.gx, o.gy, gridSize);
    const s = 1 + (o.growth ?? 0);
    const g = new THREE.Group();
    g.position.set(px, 0, pz);
    g.scale.set(s, s, s);

    const meshGroup = createObjectMesh(o.type, o.gx, o.gy);
    for (const child of meshGroup.children) {
      g.add(child.clone());
    }
    root.add(g);
  }

  applyEmergence(objects, root, gridSize);

  let yaw = 0.72;
  let pitch = 0.66;
  let dist = gridSize * 1.875;
  let dragging = false;
  let lx = 0;
  let ly = 0;

  function updateCam() {
    cam.position.set(
      Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.sin(pitch) * dist,
      Math.cos(yaw) * Math.cos(pitch) * dist
    );
    cam.lookAt(0, 1.0, 0);
  }
  updateCam();

  const onPointerDown = (e: PointerEvent) => {
    dragging = true;
    lx = e.clientX;
    ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    yaw -= (e.clientX - lx) * 0.008;
    pitch = Math.max(0.16, Math.min(1.45, pitch + (e.clientY - ly) * 0.006));
    lx = e.clientX;
    ly = e.clientY;
    updateCam();
  };
  const onPointerUp = () => { dragging = false; };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    dist = Math.max(8, Math.min(24, dist * (e.deltaY < 0 ? 0.93 : 1.08)));
    updateCam();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  function resize() {
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    renderer.setSize(Math.max(2, rect.width), Math.max(2, rect.height), false);
    cam.aspect = rect.width / rect.height;
    cam.updateProjectionMatrix();
  }

  const resizeObs = new ResizeObserver(resize);
  resizeObs.observe(canvas.parentElement!);
  resize();

  function loop() {
    if (!running) return;
    renderer.render(scene, cam);
    animFrameId = requestAnimationFrame(loop);
  }
  loop();

  function cleanup() {
    running = false;
    cancelAnimationFrame(animFrameId);
    resizeObs.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    renderer.dispose();
  }

  return { cleanup };
}
