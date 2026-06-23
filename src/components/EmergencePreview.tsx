import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { type ObjectType } from "./GardenObjects";
import { buildGrownObject } from "./GardenGrowth";
import { applyEmergence } from "./GardenEmergence";
import "./EmergencePreview.css";

const ALL_TYPES: ObjectType[] = [
  "house", "tower", "tree", "flower", "windmill",
  "shrine", "lamp", "pond", "statue",
];

const TYPE_LABELS: Record<ObjectType, string> = {
  house: "家", tower: "塔", tree: "木", flower: "花", windmill: "風車",
  shrine: "神社", lamp: "灯台", pond: "池", statue: "像",
};

const TYPE_COLORS: Record<ObjectType, string> = {
  house: "#ff6b9d", tower: "#8a9bb8", tree: "#2d7a3e", flower: "#ff7ad1",
  windmill: "#d4a630", shrine: "#cc3333", lamp: "#ffe8c2", pond: "#4488cc",
  statue: "#b6ff3f",
};

const GRID = 8;

type CellState = ObjectType | null;

interface Preset {
  name: string;
  desc: string;
  cells: [number, number, ObjectType][];
}

const PRESETS: Preset[] = [
  {
    name: "街 (3家)",
    desc: "ruleTown",
    cells: [[2,2,"house"],[3,2,"house"],[2,3,"house"]],
  },
  {
    name: "夜市 (4家)",
    desc: "ruleNightMarket",
    cells: [[2,2,"house"],[3,2,"house"],[2,3,"house"],[3,3,"house"]],
  },
  {
    name: "森 (3木)",
    desc: "ruleForest",
    cells: [[3,2,"tree"],[3,3,"tree"],[3,4,"tree"]],
  },
  {
    name: "花畑 (3花)",
    desc: "ruleFlowerField",
    cells: [[3,3,"flower"],[4,3,"flower"],[3,4,"flower"]],
  },
  {
    name: "庭園 (家+花)",
    desc: "ruleGardenEstate",
    cells: [[3,3,"house"],[3,4,"flower"],[4,3,"flower"]],
  },
  {
    name: "街路樹 (木+家)",
    desc: "ruleStreetTree",
    cells: [[3,3,"tree"],[3,4,"house"],[4,3,"house"]],
  },
  {
    name: "蔦塔 (塔+木2)",
    desc: "ruleTowerGrove",
    cells: [[3,3,"tower"],[3,4,"tree"],[4,3,"tree"]],
  },
  {
    name: "花時計 (花+塔)",
    desc: "ruleFlowerClock",
    cells: [[3,3,"flower"],[3,4,"tower"]],
  },
  {
    name: "麦畑 (風車+花)",
    desc: "ruleWheatField",
    cells: [[3,3,"windmill"],[3,4,"flower"]],
  },
  {
    name: "精霊 (神社+木)",
    desc: "ruleSpiritOrbs",
    cells: [[3,3,"shrine"],[3,4,"tree"]],
  },
  {
    name: "灯路 (灯台+灯台)",
    desc: "ruleLitWalkway",
    cells: [[3,3,"lamp"],[3,4,"lamp"]],
  },
  {
    name: "映込 (池+像)",
    desc: "ruleReflection",
    cells: [[3,3,"pond"],[3,4,"statue"]],
  },
  {
    name: "空中回廊 (塔+塔)",
    desc: "ruleSkybridges",
    cells: [[3,3,"tower"],[3,4,"tower"]],
  },
  {
    name: "広場 (空+3種隣接)",
    desc: "rulePlaza",
    cells: [[3,3,"house"],[4,2,"tree"],[4,4,"flower"]],
  },
  {
    name: "記念碑 (像単独+成長)",
    desc: "ruleMonumentAura",
    cells: [[3,3,"statue"]],
  },
  {
    name: "祈りの灯 (灯台+神社)",
    desc: "rulePrayerLight",
    cells: [[3,3,"lamp"],[3,4,"shrine"]],
  },
  {
    name: "門番 (像+家)",
    desc: "ruleGatekeeper",
    cells: [[3,3,"house"],[3,4,"statue"]],
  },
  {
    name: "庭園彫刻 (像+花)",
    desc: "ruleGardenSculpture",
    cells: [[3,3,"statue"],[3,4,"flower"],[4,3,"flower"]],
  },
  {
    name: "見張り台 (塔+池)",
    desc: "ruleWatchtower",
    cells: [[3,3,"tower"],[3,4,"pond"]],
  },
  {
    name: "風車の丘 (風車+木)",
    desc: "ruleWindmillHill",
    cells: [[3,3,"windmill"],[3,4,"tree"],[4,3,"tree"]],
  },
  {
    name: "城壁 (塔+家)",
    desc: "ruleCastleWall",
    cells: [[3,3,"tower"],[3,4,"house"],[4,3,"house"]],
  },
  {
    name: "鎮守の森 (神社+花)",
    desc: "ruleSacredGrove",
    cells: [[3,3,"shrine"],[3,4,"flower"],[4,3,"flower"]],
  },
  {
    name: "灯台港 (灯台+池)",
    desc: "ruleLighthouseHarbor",
    cells: [[3,3,"lamp"],[3,4,"pond"]],
  },
  {
    name: "水車小屋 (風車+池)",
    desc: "ruleWatermill",
    cells: [[3,3,"windmill"],[3,4,"pond"]],
  },
  {
    name: "全部盛り",
    desc: "全9種を配置",
    cells: [
      [1,1,"house"],[2,1,"tower"],[3,1,"tree"],
      [1,2,"flower"],[2,2,"windmill"],[3,2,"shrine"],
      [1,3,"lamp"],[2,3,"pond"],[3,3,"statue"],
      [4,1,"house"],[4,2,"house"],[4,3,"house"],[5,1,"tree"],[5,2,"tree"],[5,3,"tree"],
    ],
  },
];

export function EmergencePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<CellState[][]>(() =>
    Array.from({ length: GRID }, () => Array(GRID).fill(null))
  );
  const [selectedType, setSelectedType] = useState<ObjectType | "eraser">("house");
  const [growth, setGrowth] = useState(1.0);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    cam: THREE.PerspectiveCamera;
    objGroup: THREE.Group;
    emergenceGroup: THREE.Group;
    animators: { update(dt: number): void }[];
    animId: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1220);
    scene.fog = new THREE.Fog(0x0e1220, 18, 40);

    const cam = new THREE.PerspectiveCamera(34, 2, 0.1, 80);
    cam.position.set(8, 10, 8);
    cam.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0x6a7cff, 0x2a1d24, 1.2));
    scene.add(new THREE.AmbientLight(0x4a5a8a, 1.0));
    const key = new THREE.DirectionalLight(0xffe8c2, 3.0);
    key.position.set(4, 6, 3);
    key.castShadow = true;
    scene.add(key);

    const rimM = new THREE.PointLight(0xff2fa0, 26, 20, 2.0);
    rimM.position.set(6, 3, -4);
    scene.add(rimM);
    const rimL = new THREE.PointLight(0xb6ff3f, 18, 20, 2.0);
    rimL.position.set(-5, 2, 5);
    scene.add(rimL);

    const baseSize = GRID + 0.6;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(baseSize, 0.6, baseSize),
      new THREE.MeshStandardMaterial({ color: 0x1a2436, roughness: 1 })
    );
    base.position.y = -0.5;
    base.receiveShadow = true;
    scene.add(base);

    const HALF = (GRID - 1) / 2;
    const tileGeo = new THREE.BoxGeometry(0.96, 0.18, 0.96);
    for (let gx = 0; gx < GRID; gx++) {
      for (let gy = 0; gy < GRID; gy++) {
        const even = (gx + gy) % 2 === 0;
        const t = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({
          color: even ? 0x2e3d55 : 0x243050, roughness: 0.92,
        }));
        t.position.set(gx - HALF, -0.09, gy - HALF);
        t.receiveShadow = true;
        scene.add(t);
      }
    }

    const objGroup = new THREE.Group();
    scene.add(objGroup);
    const emergenceGroup = new THREE.Group();
    scene.add(emergenceGroup);

    const animators: { update(dt: number): void }[] = [];
    let t = 0;
    let animId = 0;

    function loop() {
      t += 0.016;
      const camT = t * 0.15;
      cam.position.x = Math.sin(camT) * 12;
      cam.position.z = Math.cos(camT) * 12;
      cam.position.y = 9;
      cam.lookAt(0, 0.5, 0);
      for (const a of animators) a.update(0.016);
      renderer.render(scene, cam);
      animId = requestAnimationFrame(loop);
    }

    function resize() {
      const rect = canvas!.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const w = Math.max(2, rect.width);
      const h = Math.max(2, 360);
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    resize();
    loop();

    sceneRef.current = { renderer, scene, cam, objGroup, emergenceGroup, animators, animId };

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      renderer.dispose();
      sceneRef.current = null;
    };
  }, []);

  const rebuildScene = useCallback((g: CellState[][], gr: number) => {
    const s = sceneRef.current;
    if (!s) return;

    while (s.objGroup.children.length) s.objGroup.remove(s.objGroup.children[0]);
    while (s.emergenceGroup.children.length) s.emergenceGroup.remove(s.emergenceGroup.children[0]);
    s.animators.length = 0;

    const HALF = (GRID - 1) / 2;
    const objects: { type: ObjectType; gx: number; gy: number; growth: number }[] = [];

    for (let gx = 0; gx < GRID; gx++) {
      for (let gy = 0; gy < GRID; gy++) {
        const cell = g[gx][gy];
        if (!cell) continue;
        const { group, animator } = buildGrownObject({
          type: cell, gx, gy, growth: gr,
        });
        group.position.set(gx - HALF, 0, gy - HALF);
        s.objGroup.add(group);
        if (animator) s.animators.push(animator);
        objects.push({ type: cell, gx, gy, growth: gr });
      }
    }

    applyEmergence(objects, s.emergenceGroup);
  }, []);

  useEffect(() => {
    rebuildScene(grid, growth);
  }, [grid, growth, rebuildScene]);

  const handleCellClick = (gx: number, gy: number) => {
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      if (selectedType === "eraser") {
        next[gx][gy] = null;
      } else {
        next[gx][gy] = next[gx][gy] === selectedType ? null : selectedType;
      }
      return next;
    });
  };

  const loadPreset = (preset: Preset) => {
    const next: CellState[][] = Array.from({ length: GRID }, () => Array(GRID).fill(null));
    for (const [gx, gy, type] of preset.cells) {
      next[gx][gy] = type;
    }
    setGrid(next);
  };

  const clearGrid = () => {
    setGrid(Array.from({ length: GRID }, () => Array(GRID).fill(null)));
  };

  return (
    <div className="emergence-preview">
      <h3>Emergence プレビュー</h3>
      <p className="settings-hint">
        グリッドをクリックしてオブジェクトを配置し、隣接効果をリアルタイムで確認
      </p>

      <div className="ep-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>

      <div className="ep-toolbar">
        {ALL_TYPES.map(type => (
          <button
            key={type}
            className={`ep-tool-btn ${selectedType === type ? "active" : ""}`}
            style={{ "--tool-color": TYPE_COLORS[type] } as React.CSSProperties}
            onClick={() => setSelectedType(type)}
            title={TYPE_LABELS[type]}
          >
            <span className="ep-tool-dot" />
            <span className="ep-tool-name">{TYPE_LABELS[type]}</span>
          </button>
        ))}
        <button
          className={`ep-tool-btn ep-eraser ${selectedType === "eraser" ? "active" : ""}`}
          onClick={() => setSelectedType("eraser")}
          title="消去"
        >
          <span className="ep-tool-name">×</span>
        </button>
      </div>

      <div className="ep-grid-wrap">
        <div className="ep-grid">
          {Array.from({ length: GRID }, (_, gy) => (
            <div key={gy} className="ep-grid-row">
              {Array.from({ length: GRID }, (_, gx) => {
                const cell = grid[gx][gy];
                return (
                  <button
                    key={gx}
                    className={`ep-grid-cell ${cell ? "filled" : ""}`}
                    style={cell ? { background: TYPE_COLORS[cell] } : undefined}
                    onClick={() => handleCellClick(gx, gy)}
                    title={cell ? TYPE_LABELS[cell] : `(${gx},${gy})`}
                  >
                    {cell && TYPE_LABELS[cell][0]}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="ep-controls">
        <label className="setting-slider ep-slider">
          <span className="slider-label">成長</span>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={growth}
            onChange={(e) => setGrowth(parseFloat(e.target.value))}
          />
          <span className="slider-value">{growth.toFixed(1)}</span>
        </label>
        <button className="ep-clear-btn" onClick={clearGrid}>クリア</button>
      </div>

      <div className="ep-presets">
        <span className="ep-presets-label">プリセット:</span>
        <div className="ep-presets-list">
          {PRESETS.map(p => (
            <button
              key={p.name}
              className="ep-preset-btn"
              onClick={() => loadPreset(p)}
              title={p.desc}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
