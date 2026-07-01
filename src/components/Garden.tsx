import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "../mock-invoke";
import { listen } from "@tauri-apps/api/event";
import * as THREE from "three";
import { applyEmergence } from "./garden/emergence";
import { type ObjectType } from "./GardenObjects";
import { buildGrownObject } from "./GardenGrowth";
import { loadGardenSettings, type GardenSettings } from "./Settings";
import { GRID, gpos } from "./garden/grid";
import { createGardenRenderer, buildGridTiles } from "./garden/scene";
import { EffectManager } from "./garden/effects/manager";
import { computeEffectIntensities } from "./garden/effects/mapping";
import { UnderwaterEffect, RainEffect } from "./garden/effects/water";
import "./Garden.css";

// 開発用: 監視タスク無しでも各エフェクト変種を確認するためのテスト色
const DEV_SWATCHES: [string, number, number, number][] = [
  ["青濃", 30, 90, 220],
  ["青薄", 150, 190, 235],
  ["赤濃", 210, 40, 40],
  ["赤薄", 240, 180, 180],
  ["緑濃", 40, 170, 60],
  ["緑薄", 190, 225, 190],
];

interface GardenObject {
  type: ObjectType;
  gx: number;
  gy: number;
  growth: number;
}

interface PlacedObject {
  id: number;
  inventory_id: number;
  item_type: string;
  grid_x: number;
  grid_z: number;
  growth_stage: number;
  random_seed: number;
}

interface InventoryItem {
  id: number;
  item_type: string;
  item_variant: string | null;
  obtained_at: string;
  placed: boolean;
}

function placedToGardenObjects(placed: PlacedObject[]): GardenObject[] {
  return placed.map((p) => ({
    type: p.item_type as GardenObject["type"],
    gx: p.grid_x,
    gy: p.grid_z,
    growth: p.growth_stage,
  }));
}

interface SeasonInfo {
  season_number: number;
  days_elapsed: number;
  should_wipe: boolean;
}

export function Garden() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const camStateRef = useRef<CameraState | undefined>(undefined);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [unplaceTarget, setUnplaceTarget] = useState<{
    inventoryId: number;
    itemType: string;
  } | null>(null);
  const [isDaytime, setIsDaytime] = useState(false);
  const [effectGlobal, setEffectGlobal] = useState(1);
  const [gridSize, setGridSize] = useState(GRID);
  const sceneRef = useRef<{
    cam: THREE.PerspectiveCamera;
    tiles: THREE.Mesh[];
    renderer: THREE.WebGLRenderer;
    setHoverTile: (gx: number, gz: number) => void;
    clearHoverTile: () => void;
    getCameraState: () => CameraState;
  } | null>(null);
  const ambientRef = useRef<{ r: number; g: number; b: number } | null>(null);

  const loadData = useCallback(async () => {
    try {
      await invoke("tick_growth");
      const [inv, objs, seasonInfo, gs] = await Promise.all([
        invoke<InventoryItem[]>("get_inventory"),
        invoke<PlacedObject[]>("get_garden_objects"),
        invoke<SeasonInfo>("get_season_info"),
        invoke<number>("get_grid_size"),
      ]);
      setInventory(inv);
      setPlacedObjects(objs);
      setSeason(seasonInfo);
      setGridSize(gs);
    } catch {
      // Tauri IPC unavailable (e.g. opened in browser)
    }
  }, []);

  useEffect(() => {
    loadData();
    invoke<string[]>("check_and_grant_bonus")
      .then((msgs) => {
        if (msgs.length > 0) loadData();
      })
      .catch(() => {});
    let unlisten: Promise<() => void> | null = null;
    if ((window as any).__TAURI_INTERNALS__) {
      unlisten = listen("achievement", () => {
        loadData();
      });
    }
    return () => {
      unlisten?.then((fn) => fn()).catch(() => {});
    };
  }, [loadData]);

  // Poll the ambient color of currently-running monitored apps and broadcast it
  // to the scene, which tints the sky/fog toward it.
  useEffect(() => {
    let active = true;
    const pollAmbient = async () => {
      try {
        const c = await invoke<{ r: number; g: number; b: number } | null>(
          "get_ambient_color"
        );
        if (!active) return;
        ambientRef.current = c;
        window.dispatchEvent(
          new CustomEvent("garden-ambient-changed", { detail: c })
        );
      } catch {
        // Tauri IPC unavailable (e.g. opened in browser)
      }
    };
    pollAmbient();
    const id = setInterval(pollAmbient, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (cleanupRef.current) {
      cleanupRef.current();
    }

    const objects = placedToGardenObjects(placedObjects);
    const result = initThreeScene(canvas, objects, isDaytime, camStateRef.current, gridSize);
    cleanupRef.current = result.cleanup;
    sceneRef.current = {
      cam: result.cam,
      tiles: result.tiles,
      renderer: result.renderer,
      setHoverTile: result.setHoverTile,
      clearHoverTile: result.clearHoverTile,
      getCameraState: result.getCameraState,
    };

    // Re-apply the last known ambient color so a freshly rebuilt scene keeps its tint.
    if (ambientRef.current) {
      window.dispatchEvent(
        new CustomEvent("garden-ambient-changed", { detail: ambientRef.current })
      );
    }

    return () => {
      camStateRef.current = result.getCameraState();
      result.cleanup();
      cleanupRef.current = null;
      sceneRef.current = null;
    };
  }, [placedObjects, gridSize]);

  const unplacedItems = inventory.filter((i) => !i.placed);

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
    },
    []
  );

  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!sceneRef.current) return;

      if (pointerDownPos.current) {
        const dx = e.clientX - pointerDownPos.current.x;
        const dy = e.clientY - pointerDownPos.current.y;
        if (dx * dx + dy * dy > 25) return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, sceneRef.current.cam);
      const hits = raycaster.intersectObjects(sceneRef.current.tiles);
      if (hits.length === 0) return;

      const tile = hits[0].object as THREE.Mesh;
      const gx = tile.userData.gx as number;
      const gz = tile.userData.gz as number;

      const placedHere = placedObjects.find(
        (o) => Math.round(o.grid_x) === gx && Math.round(o.grid_z) === gz
      );

      if (selectedItem) {
        if (placedHere) return;
        try {
          await invoke("place_item", {
            inventoryId: selectedItem.id,
            gridX: gx,
            gridZ: gz,
          });
          setSelectedItem(null);
          await loadData();
        } catch (e) {
          console.error("Failed to place item:", e);
        }
      } else if (placedHere) {
        setUnplaceTarget({
          inventoryId: placedHere.inventory_id,
          itemType: placedHere.item_type,
        });
      }
    },
    [selectedItem, placedObjects, loadData]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!sceneRef.current || !selectedItem) {
        sceneRef.current?.clearHoverTile();
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, sceneRef.current.cam);
      const hits = raycaster.intersectObjects(sceneRef.current.tiles);
      if (hits.length === 0) {
        sceneRef.current.clearHoverTile();
        return;
      }
      const tile = hits[0].object as THREE.Mesh;
      const gx = tile.userData.gx as number;
      const gz = tile.userData.gz as number;
      const occupied = placedObjects.some(
        (o) => Math.round(o.grid_x) === gx && Math.round(o.grid_z) === gz
      );
      if (occupied) {
        sceneRef.current.clearHoverTile();
      } else {
        sceneRef.current.setHoverTile(gx, gz);
      }
    },
    [selectedItem, placedObjects]
  );

  const handleUnplace = async () => {
    if (!unplaceTarget) return;
    try {
      await invoke("unplace_item", { inventoryId: unplaceTarget.inventoryId });
      setUnplaceTarget(null);
      await loadData();
    } catch (e) {
      console.error("Failed to unplace item:", e);
    }
  };

  const handleFreeze = async () => {
    if (!confirm("この箱庭を凍結してギャラリーに保存し、更地から再スタートする？")) return;
    try {
      await invoke("freeze_and_wipe");
      await loadData();
    } catch (e) {
      console.error("Failed to freeze:", e);
    }
  };

  const itemEmoji: Record<string, string> = {
    house: "🏠",
    tree: "🌳",
    flower: "🌸",
    tower: "🏙️",
    windmill: "🌾",
    shrine: "⛩️",
    lamp: "🏮",
    pond: "💧",
    statue: "🗿",
  };

  return (
    <div className="garden-container">
      <canvas
        ref={canvasRef}
        className={`garden-canvas ${selectedItem ? "placing" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={handleCanvasClick}
      />
      {unplaceTarget && (
        <div className="unplace-confirm">
          <span>{itemEmoji[unplaceTarget.itemType] ?? "📦"} インベントリに戻す？</span>
          <button className="btn-unplace-yes" onClick={handleUnplace}>
            戻す
          </button>
          <button
            className="btn-unplace-no"
            onClick={() => setUnplaceTarget(null)}
          >
            ×
          </button>
        </div>
      )}
      {import.meta.env.DEV && (
        <div
          style={{
            position: "fixed",
            bottom: 8,
            left: 8,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderRadius: 6,
            background: "rgba(0,0,0,0.55)",
            color: "#cfe",
            font: "11px/1 monospace",
            pointerEvents: "auto",
          }}
        >
          <span>FX {effectGlobal.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={5}
            step={0.05}
            value={effectGlobal}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setEffectGlobal(v);
              window.dispatchEvent(
                new CustomEvent("garden-effect-global-changed", { detail: v })
              );
            }}
          />
          {DEV_SWATCHES.map(([label, r, g, b]) => (
            <button
              key={label}
              title={label}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("garden-ambient-changed", {
                    detail: { r, g, b },
                  })
                )
              }
              style={{
                width: 16,
                height: 16,
                padding: 0,
                border: "1px solid #fff3",
                borderRadius: 3,
                background: `rgb(${r},${g},${b})`,
                cursor: "pointer",
              }}
            />
          ))}
          <button
            title="クリア"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("garden-ambient-changed", { detail: null })
              )
            }
            style={{
              padding: "0 6px",
              border: "1px solid #fff3",
              borderRadius: 3,
              background: "transparent",
              color: "#cfe",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}
      {season && (
        <div className="season-badge">
          <button
            className="btn-daytime"
            onClick={() => {
              const next = !isDaytime;
              setIsDaytime(next);
              window.dispatchEvent(
                new CustomEvent("garden-daytime-changed", { detail: next })
              );
            }}
            title={isDaytime ? "夜にする" : "昼にする"}
          >
            {isDaytime ? "☀️" : "🌙"}
          </button>
          <span>Season {season.season_number}</span>
          <span className="season-days">{season.days_elapsed}日目</span>
          {season.should_wipe && (
            <button className="btn-freeze" onClick={handleFreeze}>
              凍結する
            </button>
          )}
        </div>
      )}
      {unplacedItems.length > 0 && (
        <div className="inventory-panel">
          <div className="inventory-label">
            {selectedItem ? "配置先をクリック" : "インベントリ"}
          </div>
          <div className="inventory-items">
            {unplacedItems.map((item) => (
              <button
                key={item.id}
                className={`inventory-item ${selectedItem?.id === item.id ? "selected" : ""}`}
                onClick={() =>
                  setSelectedItem(
                    selectedItem?.id === item.id ? null : item
                  )
                }
                title={`${item.item_type}を選択`}
              >
                {itemEmoji[item.item_type] ?? "📦"}
              </button>
            ))}
          </div>
          {selectedItem && (
            <button
              className="btn-cancel-place"
              onClick={() => setSelectedItem(null)}
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface CameraState {
  yaw: number;
  pitch: number;
  dist: number;
}

function initThreeScene(canvas: HTMLCanvasElement, objects: GardenObject[], initialDaytime = false, camState?: CameraState, gridSize = GRID) {
  let running = true;
  let animFrameId = 0;

  // --- Renderer ---
  const renderer = createGardenRenderer(canvas);

  // --- Scene ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1220);
  scene.fog = new THREE.Fog(0x0e1220, 22, 50);

  const cam = new THREE.PerspectiveCamera(34, 16 / 10, 0.1, 100);

  // --- Three-point lighting ---
  scene.add(new THREE.HemisphereLight(0x6a7cff, 0x2a1d24, 1.2));
  scene.add(new THREE.AmbientLight(0x4a5a8a, 1.0));

  const key = new THREE.DirectionalLight(0xffe8c2, 3.0);
  key.position.set(7, 13, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
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

  // --- Visible light source (moon) ---
  const ORB_POS = new THREE.Vector3(7, 13, 5);
  const orbGroup = new THREE.Group();
  scene.add(orbGroup);

  const orbCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xfff2d6, emissiveIntensity: 2.5 })
  );
  orbCore.position.copy(ORB_POS);
  orbGroup.add(orbCore);

  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = 128;
  haloCanvas.height = 128;
  const haloCtx = haloCanvas.getContext("2d")!;
  const grad = haloCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255, 236, 192, 0.9)");
  grad.addColorStop(0.4, "rgba(255, 236, 192, 0.3)");
  grad.addColorStop(1, "rgba(255, 236, 192, 0)");
  haloCtx.fillStyle = grad;
  haloCtx.fillRect(0, 0, 128, 128);
  const haloTex = new THREE.CanvasTexture(haloCanvas);

  const haloMat = new THREE.SpriteMaterial({
    map: haloTex,
    color: 0xffecc0,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(4.0, 4.0, 1);
  halo.position.copy(ORB_POS);
  orbGroup.add(halo);

  // Rim lights
  const rimM = new THREE.PointLight(0xff2fa0, 26, 26, 2.0);
  rimM.position.set(9, 4, -7);
  scene.add(rimM);

  const rimL = new THREE.PointLight(0xb6ff3f, 18, 26, 2.0);
  rimL.position.set(-9, 3, 7);
  scene.add(rimL);

  // --- Ground ---
  const root = new THREE.Group();
  scene.add(root);

  const baseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(gridSize + 0.6, 0.6, gridSize + 0.6),
    new THREE.MeshStandardMaterial({ color: 0x1a2436, roughness: 1, metalness: 0 })
  );
  baseMesh.position.set(0, -0.5, 0);
  baseMesh.receiveShadow = true;
  root.add(baseMesh);

  const tiles = buildGridTiles(root, gridSize);

  // --- Tile hover ---
  let hoveredTile: THREE.Mesh | null = null;
  function setHoverTile(gx: number, gz: number) {
    const tile = tiles.find(
      (t) => t.userData.gx === gx && t.userData.gz === gz
    );
    if (tile === hoveredTile) return;
    clearHoverTile();
    if (tile) {
      hoveredTile = tile;
      const mat = tile.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x2a4a2a);
      mat.emissiveIntensity = 1.0;
    }
  }
  function clearHoverTile() {
    if (hoveredTile) {
      const mat = hoveredTile.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
      hoveredTile = null;
    }
  }

  // --- Place objects ---
  const sorted = [...objects].sort((a, b) => a.gx + a.gy - (b.gx + b.gy));

  const growthAnimators: { update(dt: number): void }[] = [];
  for (const o of sorted) {
    const [px, pz] = gpos(o.gx, o.gy, gridSize);
    const { group: grownGroup, animator } = buildGrownObject({
      type: o.type, gx: o.gx, gy: o.gy, growth: o.growth ?? 0,
    });
    grownGroup.position.set(px, 0, pz);
    root.add(grownGroup);
    if (animator) growthAnimators.push(animator);
  }

  // --- Emergence effects ---
  applyEmergence(objects, root, gridSize);

  // --- Floating particles (fireflies) ---
  const N = 70;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);

  const spread = gridSize * 1.375;
  function respawn(i: number) {
    pos[i * 3] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = -0.3 - Math.random() * 0.6;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
    seed[i] = Math.random() * 6.28;
  }

  for (let i = 0; i < N; i++) {
    respawn(i);
    pos[i * 3 + 1] = Math.random() * 6.5;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xd4ffae,
    size: 0.1,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  scene.add(new THREE.Points(pGeo, pMat));

  const LIT_N = 15;
  const litLights: THREE.PointLight[] = [];
  const litIdx: number[] = [];
  for (let i = 0; i < LIT_N; i++) {
    const pl = new THREE.PointLight(0xc8ff9a, 1.3, 2.6, 2.8);
    scene.add(pl);
    litLights.push(pl);
    litIdx.push(Math.floor((i * N) / LIT_N));
  }

  // --- Post-processing (addon-free) ---
  const fsQuad = (() => {
    const geo = new THREE.PlaneGeometry(2, 2);
    const sceneQ = new THREE.Scene();
    const camQ = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mesh = new THREE.Mesh(geo, undefined);
    sceneQ.add(mesh);
    return {
      render(mat: THREE.ShaderMaterial) {
        mesh.material = mat;
        renderer.render(sceneQ, camQ);
      },
    };
  })();

  const mkRT = (w: number, h: number) =>
    new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

  let rtScene = mkRT(2, 2);
  let rtBrightA = mkRT(2, 2);
  let rtBrightB = mkRT(2, 2);

  const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;

  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, threshold: { value: 0.72 } },
    vertexShader: VERT,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float threshold; varying vec2 vUv;
      void main(){
        vec4 c=texture2D(tDiffuse,vUv);
        float l=dot(c.rgb,vec3(0.299,0.587,0.114));
        float k=smoothstep(threshold,threshold+0.25,l);
        gl_FragColor=vec4(c.rgb*k,1.0);
      }`,
  });

  const blurMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      dir: { value: new THREE.Vector2(1, 0) },
      res: { value: new THREE.Vector2(2, 2) },
    },
    vertexShader: VERT,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 dir; uniform vec2 res; varying vec2 vUv;
      void main(){
        vec2 px=dir/res; vec4 s=vec4(0.0);
        s+=texture2D(tDiffuse,vUv)*0.2270270270;
        s+=texture2D(tDiffuse,vUv+px*1.3846153846)*0.3162162162;
        s+=texture2D(tDiffuse,vUv-px*1.3846153846)*0.3162162162;
        s+=texture2D(tDiffuse,vUv+px*3.2307692308)*0.0702702703;
        s+=texture2D(tDiffuse,vUv-px*3.2307692308)*0.0702702703;
        gl_FragColor=s;
      }`,
  });

  const gs = loadGardenSettings();
  const compMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      tBloom: { value: null },
      res: { value: new THREE.Vector2(2, 2) },
      bloomStrength: { value: gs.bloomStrength },
      focus: { value: 0.5 },
      tiltRange: { value: 0.34 },
      tiltStrength: { value: gs.tiltStrength },
      vignette: { value: gs.vignette },
      enableTilt: { value: gs.enableTilt ? 1.0 : 0.0 },
      enableBloom: { value: gs.enableBloom ? 1.0 : 0.0 },
      enableGrade: { value: gs.enableGrade ? 1.0 : 0.0 },
      time: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform vec2 res;
      uniform float bloomStrength, focus, tiltRange, tiltStrength, vignette;
      uniform float enableTilt, enableBloom, enableGrade, time; varying vec2 vUv;
      vec3 tiltBlur(vec2 uv, float amt){
        if(amt<0.003) return texture2D(tDiffuse,uv).rgb;
        vec2 px=amt/res*vec2(res.y/res.x,1.0)*9.0;
        vec3 s=vec3(0.0); float wsum=0.0;
        for(int i=-4;i<=4;i++){ for(int j=-4;j<=4;j++){
          vec2 o=vec2(float(i),float(j))*px;
          float w=1.0-length(vec2(float(i),float(j)))/6.5; if(w<0.0) continue;
          s+=texture2D(tDiffuse,uv+o).rgb*w; wsum+=w;
        }}
        return s/wsum;
      }
      void main(){
        float d=abs(vUv.y-focus);
        float amt = enableTilt>0.5 ? clamp((d-tiltRange)/0.32,0.0,1.0)*tiltStrength : 0.0;
        vec3 col = amt>0.003 ? tiltBlur(vUv,amt) : texture2D(tDiffuse,vUv).rgb;
        if(enableBloom>0.5){ vec3 b=texture2D(tBloom,vUv).rgb; col += b*bloomStrength; }
        if(enableGrade>0.5){
          float l=dot(col,vec3(0.299,0.587,0.114));
          vec3 shadowT=vec3(0.42,0.46,0.62); vec3 highT=vec3(1.06,1.0,0.92);
          col*=mix(shadowT,highT,smoothstep(0.1,0.7,l));
          col=pow(col,vec3(0.94));
        }
        vec2 q=vUv-0.5; float vig=1.0-dot(q,q)*vignette*2.2;
        col*=clamp(vig,0.0,1.0);
        float g=fract(sin(dot(vUv*res+time,vec2(12.9898,78.233)))*43758.5453);
        col+=(g-0.5)*0.012;
        gl_FragColor=vec4(col,1.0);
      }`,
  });

  // --- Resize ---
  function resize() {
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const W = Math.max(2, Math.floor(rect.width));
    const H = Math.max(2, Math.floor(rect.height));
    const dpr = Math.min(devicePixelRatio, 2);
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    const pw = Math.floor(W * dpr);
    const ph = Math.floor(H * dpr);
    rtScene.setSize(pw, ph);
    const bw = Math.floor(pw / 2);
    const bh = Math.floor(ph / 2);
    rtBrightA.setSize(bw, bh);
    rtBrightB.setSize(bw, bh);
    blurMat.uniforms.res.value.set(bw, bh);
    compMat.uniforms.res.value.set(pw, ph);
  }

  const resizeObs = new ResizeObserver(resize);
  resizeObs.observe(canvas.parentElement!);
  resize();

  // --- Camera orbit ---
  let yaw = camState?.yaw ?? 0.72;
  let pitch = camState?.pitch ?? 0.66;
  let dist = camState?.dist ?? (gridSize * 1.875);
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
  const onPointerUp = () => {
    dragging = false;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    dist = Math.max(8, Math.min(24, dist * (e.deltaY < 0 ? 0.93 : 1.08)));
    updateCam();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // --- Ambient color (起動中アプリのアイコン色を空気に反映) ---
  // NOTE: loop() 内で参照するため、必ずアニメーションループより前に宣言する。
  const NIGHT_SKY = 0x0e1220;
  const DAY_SKY = 0x5b8ec4;
  const AMBIENT_STRENGTH = 0.5; // 昼夜ベース色へ実色を混ぜる割合
  const AMBIENT_LERP = 0.03; // 目標色への毎フレーム追従速度
  let ambientColor: THREE.Color | null = null;
  let daytimeNow = initialDaytime;
  const skyTarget = new THREE.Color();

  // --- Effect system (検知色→大気エフェクト) ---
  // loop() から参照するため、アニメーションループより前に生成する。
  const effectManager = new EffectManager({
    scene,
    camera: cam,
    renderer,
    bounds: gridSize,
    gridSize,
  });
  effectManager.register(new UnderwaterEffect());
  effectManager.register(new RainEffect());
  let lastAmbientRgb: { r: number; g: number; b: number } | null = null;
  let effectGlobal = 1;
  const recomputeEffectIntensities = () => {
    effectManager.setIntensities(
      computeEffectIntensities(lastAmbientRgb, effectGlobal)
    );
  };

  // --- Animation loop ---
  let t = 0;

  function loop() {
    if (!running) return;
    t += 0.016;

    const arr = pGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < N; i++) {
      arr[i * 3 + 1] += 0.0022;
      arr[i * 3] += Math.sin(t * 0.5 + seed[i]) * 0.0016;
      arr[i * 3 + 2] += Math.cos(t * 0.4 + seed[i] * 1.3) * 0.0012;
      if (arr[i * 3 + 1] > 6.7) respawn(i);
    }
    pGeo.attributes.position.needsUpdate = true;
    pMat.opacity = 0.55 + 0.25 * Math.sin(t * 1.4);

    for (let i = 0; i < LIT_N; i++) {
      const idx = litIdx[i];
      litLights[i].position.set(arr[idx * 3], arr[idx * 3 + 1], arr[idx * 3 + 2]);
      litLights[i].intensity = 0.9 + 0.7 * Math.sin(t * 1.6 + seed[idx] * 2.0);
    }
    rimM.intensity = 24 + 6 * Math.sin(t * 1.3);
    rimL.intensity = 16 + 5 * Math.sin(t * 1.7 + 2.0);

    // Ambient tint: 空とフォグを「昼夜ベース色 + 実色」へ滑らかに寄せる
    skyTarget.setHex(daytimeNow ? DAY_SKY : NIGHT_SKY);
    if (ambientColor) skyTarget.lerp(ambientColor, AMBIENT_STRENGTH);
    if (scene.background instanceof THREE.Color) {
      scene.background.lerp(skyTarget, AMBIENT_LERP);
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.lerp(skyTarget, AMBIENT_LERP);
    }

    effectManager.update(0.016, t);

    for (const anim of growthAnimators) anim.update(0.016);

    // Post-process pipeline
    renderer.setRenderTarget(rtScene);
    renderer.clear();
    renderer.render(scene, cam);

    renderer.setRenderTarget(rtBrightA);
    brightMat.uniforms.tDiffuse.value = rtScene.texture;
    fsQuad.render(brightMat);

    blurMat.uniforms.dir.value.set(1, 0);
    blurMat.uniforms.tDiffuse.value = rtBrightA.texture;
    renderer.setRenderTarget(rtBrightB);
    fsQuad.render(blurMat);

    blurMat.uniforms.dir.value.set(0, 1);
    blurMat.uniforms.tDiffuse.value = rtBrightB.texture;
    renderer.setRenderTarget(rtBrightA);
    fsQuad.render(blurMat);

    compMat.uniforms.tDiffuse.value = rtScene.texture;
    compMat.uniforms.tBloom.value = rtBrightA.texture;
    compMat.uniforms.time.value = t;
    renderer.setRenderTarget(null);
    fsQuad.render(compMat);

    animFrameId = requestAnimationFrame(loop);
  }

  loop();

  // --- Settings sync ---
  let orbBrightness = gs.orbBrightness;
  let baseKeyIntensity = key.intensity;
  const applyOrbBrightness = (b: number) => {
    orbBrightness = b;
    key.intensity = baseKeyIntensity * (0.3 + 0.7 * b);
  };
  applyOrbBrightness(gs.orbBrightness);

  const baseOrbEmissive = 2.5;
  const baseHaloOpacity = 0.62;
  let orbGlow = gs.orbGlow;
  const applyOrbGlow = (g: number) => {
    orbGlow = g;
    (orbCore.material as THREE.MeshStandardMaterial).emissiveIntensity = baseOrbEmissive * g;
    haloMat.opacity = baseHaloOpacity * Math.min(g, 1.0);
    halo.scale.setScalar(4.0 * (0.3 + 0.7 * g));
  };
  applyOrbGlow(gs.orbGlow);

  const onSettingsChanged = (e: Event) => {
    const s = (e as CustomEvent<GardenSettings>).detail;
    compMat.uniforms.enableTilt.value = s.enableTilt ? 1.0 : 0.0;
    compMat.uniforms.enableBloom.value = s.enableBloom ? 1.0 : 0.0;
    compMat.uniforms.enableGrade.value = s.enableGrade ? 1.0 : 0.0;
    compMat.uniforms.bloomStrength.value = s.bloomStrength;
    compMat.uniforms.tiltStrength.value = s.tiltStrength;
    compMat.uniforms.vignette.value = s.vignette;
    applyOrbBrightness(s.orbBrightness);
    applyOrbGlow(s.orbGlow);
  };
  window.addEventListener("garden-settings-changed", onSettingsChanged);

  // --- Day/night toggle ---
  const hemi = scene.children.find(
    (c) => c instanceof THREE.HemisphereLight
  ) as THREE.HemisphereLight;
  const ambient = scene.children.find(
    (c) => c instanceof THREE.AmbientLight
  ) as THREE.AmbientLight;

  const nightTileColors = [0x2e3d55, 0x243050];
  const dayTileColors = [0x5a7a52, 0x4d6d45];

  const onDaytimeChanged = (e: Event) => {
    const day = (e as CustomEvent<boolean>).detail;
    daytimeNow = day;
    if (day) {
      renderer.toneMappingExposure = 1.05;
      scene.background = new THREE.Color(0x5b8ec4);
      scene.fog = new THREE.Fog(0x5b8ec4, 16, 38);
      key.color.setHex(0xffffff);
      baseKeyIntensity = 4.5;
      key.intensity = 4.5 * (0.3 + 0.7 * orbBrightness);
      hemi.color.setHex(0xaaccff);
      hemi.groundColor.setHex(0x88aa66);
      hemi.intensity = 0.8;
      ambient.color.setHex(0x8899bb);
      ambient.intensity = 0.6;
      (orbCore.material as THREE.MeshStandardMaterial).emissive.setHex(0xfffaee);
      (orbCore.material as THREE.MeshStandardMaterial).emissiveIntensity = 3.0 * orbGlow;
      haloMat.color.setHex(0xfff8dd);
      haloMat.opacity = 0.4;
      rimM.intensity = 8;
      rimM.color.setHex(0xffaacc);
      rimL.intensity = 6;
      rimL.color.setHex(0x88cc66);
      pMat.color.setHex(0x8ecfff);
      pMat.size = 0.07;
      for (const pl of litLights) {
        pl.color.setHex(0x88ccff);
        pl.intensity = 0.6;
      }
      (baseMesh.material as THREE.MeshStandardMaterial).color.setHex(0x3a5a32);
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        const even = (t.userData.gx + t.userData.gz) % 2 === 0;
        (t.material as THREE.MeshStandardMaterial).color.setHex(
          even ? dayTileColors[0] : dayTileColors[1]
        );
      }
    } else {
      renderer.toneMappingExposure = 1.4;
      scene.background = new THREE.Color(0x0e1220);
      scene.fog = new THREE.Fog(0x0e1220, 22, 50);
      key.color.setHex(0xffe8c2);
      baseKeyIntensity = 3.0;
      key.intensity = 3.0 * (0.3 + 0.7 * orbBrightness);
      hemi.color.setHex(0x6a7cff);
      hemi.groundColor.setHex(0x2a1d24);
      hemi.intensity = 1.2;
      ambient.color.setHex(0x4a5a8a);
      ambient.intensity = 1.0;
      (orbCore.material as THREE.MeshStandardMaterial).emissive.setHex(0xfff2d6);
      (orbCore.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.5 * orbGlow;
      haloMat.color.setHex(0xffecc0);
      haloMat.opacity = 0.62;
      rimM.intensity = 26;
      rimM.color.setHex(0xff2fa0);
      rimL.intensity = 18;
      rimL.color.setHex(0xb6ff3f);
      pMat.color.setHex(0xd4ffae);
      pMat.size = 0.1;
      for (const pl of litLights) {
        pl.color.setHex(0xc8ff9a);
        pl.intensity = 1.3;
      }
      (baseMesh.material as THREE.MeshStandardMaterial).color.setHex(0x1a2436);
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        const even = (t.userData.gx + t.userData.gz) % 2 === 0;
        (t.material as THREE.MeshStandardMaterial).color.setHex(
          even ? nightTileColors[0] : nightTileColors[1]
        );
      }
    }
  };
  window.addEventListener("garden-daytime-changed", onDaytimeChanged);

  const onAmbientChanged = (e: Event) => {
    const d = (e as CustomEvent<{ r: number; g: number; b: number } | null>)
      .detail;
    ambientColor = d
      ? new THREE.Color(d.r / 255, d.g / 255, d.b / 255)
      : null;
    lastAmbientRgb = d ?? null;
    recomputeEffectIntensities();
  };
  window.addEventListener("garden-ambient-changed", onAmbientChanged);

  const onEffectGlobalChanged = (e: Event) => {
    effectGlobal = (e as CustomEvent<number>).detail;
    recomputeEffectIntensities();
  };
  window.addEventListener("garden-effect-global-changed", onEffectGlobalChanged);

  if (initialDaytime) {
    onDaytimeChanged(new CustomEvent("garden-daytime-changed", { detail: true }));
  }

  // --- Cleanup ---
  function cleanup() {
    running = false;
    cancelAnimationFrame(animFrameId);
    resizeObs.disconnect();
    window.removeEventListener("garden-settings-changed", onSettingsChanged);
    window.removeEventListener("garden-daytime-changed", onDaytimeChanged);
    window.removeEventListener("garden-ambient-changed", onAmbientChanged);
    window.removeEventListener(
      "garden-effect-global-changed",
      onEffectGlobalChanged
    );
    effectManager.dispose();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    renderer.dispose();
    rtScene.dispose();
    rtBrightA.dispose();
    rtBrightB.dispose();
  }

  function getCameraState(): CameraState {
    return { yaw, pitch, dist };
  }

  return { cleanup, cam, tiles, renderer, setHoverTile, clearHoverTile, getCameraState };
}
