import { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import { type ObjectType } from "./GardenObjects";
import { buildGrownObject } from "./GardenGrowth";
import "./Settings.css";

export interface GardenSettings {
  enableTilt: boolean;
  enableBloom: boolean;
  enableGrade: boolean;
  bloomStrength: number;
  tiltStrength: number;
  vignette: number;
  orbBrightness: number;
  orbGlow: number;
}

const DEFAULTS: GardenSettings = {
  enableTilt: true,
  enableBloom: true,
  enableGrade: true,
  bloomStrength: 0.9,
  tiltStrength: 1.0,
  vignette: 0.5,
  orbBrightness: 1.0,
  orbGlow: 1.0,
};

export function loadGardenSettings(): GardenSettings {
  try {
    const raw = localStorage.getItem("garden-settings");
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

function saveGardenSettings(s: GardenSettings) {
  localStorage.setItem("garden-settings", JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("garden-settings-changed", { detail: s }));
}

export function Settings() {
  const [settings, setSettings] = useState<GardenSettings>(loadGardenSettings);
  const [autostart, setAutostart] = useState<boolean | null>(null);

  const update = useCallback(
    (patch: Partial<GardenSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveGardenSettings(next);
        return next;
      });
    },
    []
  );

  const [version, setVersion] = useState("");
  useEffect(() => {
    try {
      setVersion(__APP_VERSION__ ?? "dev");
    } catch {
      setVersion("dev");
    }
  }, []);

  useEffect(() => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    import("@tauri-apps/plugin-autostart").then(({ isEnabled }) =>
      isEnabled().then(setAutostart),
    ).catch(() => {});
  }, []);

  const toggleAutostart = async () => {
    try {
      const { enable, disable, isEnabled } = await import(
        "@tauri-apps/plugin-autostart"
      );
      if (autostart) {
        await disable();
      } else {
        await enable();
      }
      setAutostart(await isEnabled());
    } catch {
      // plugin unavailable
    }
  };

  return (
    <div className="settings">
      <section className="settings-section">
        <h3>描画エフェクト</h3>
        <p className="settings-hint">
          箱庭の見た目を調整できるよ。重いと感じたらオフにしてみて
        </p>

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.enableBloom}
            onChange={(e) => update({ enableBloom: e.target.checked })}
          />
          <span className="toggle-label">Bloom（光のにじみ）</span>
        </label>

        {settings.enableBloom && (
          <label className="setting-slider">
            <span className="slider-label">強さ</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.bloomStrength}
              onChange={(e) => update({ bloomStrength: parseFloat(e.target.value) })}
            />
            <span className="slider-value">{settings.bloomStrength.toFixed(1)}</span>
          </label>
        )}

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.enableTilt}
            onChange={(e) => update({ enableTilt: e.target.checked })}
          />
          <span className="toggle-label">Tilt-Shift（ミニチュアぼかし）</span>
        </label>

        {settings.enableTilt && (
          <label className="setting-slider">
            <span className="slider-label">強さ</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.tiltStrength}
              onChange={(e) => update({ tiltStrength: parseFloat(e.target.value) })}
            />
            <span className="slider-value">{settings.tiltStrength.toFixed(1)}</span>
          </label>
        )}

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.enableGrade}
            onChange={(e) => update({ enableGrade: e.target.checked })}
          />
          <span className="toggle-label">色グレーディング</span>
        </label>

        <label className="setting-slider">
          <span className="slider-label">ビネット</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.vignette}
            onChange={(e) => update({ vignette: parseFloat(e.target.value) })}
          />
          <span className="slider-value">{settings.vignette.toFixed(2)}</span>
        </label>

        <h3>ライティング</h3>

        <SettingsPreview settings={settings} />

        <label className="setting-slider">
          <span className="slider-label">光源の明るさ</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.orbBrightness}
            onChange={(e) => update({ orbBrightness: parseFloat(e.target.value) })}
          />
          <span className="slider-value">{settings.orbBrightness.toFixed(1)}</span>
        </label>

        <label className="setting-slider">
          <span className="slider-label">オーブの輝き</span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={settings.orbGlow}
            onChange={(e) => update({ orbGlow: parseFloat(e.target.value) })}
          />
          <span className="slider-value">{settings.orbGlow.toFixed(1)}</span>
        </label>
      </section>

      {autostart != null && (
        <section className="settings-section">
          <h3>一般</h3>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={autostart}
              onChange={toggleAutostart}
            />
            <span className="toggle-label">PC 起動時に自動で開く</span>
          </label>
        </section>
      )}

      <section className="settings-section">
        <h3>アプリ情報</h3>
        <div className="settings-info">
          <div className="info-row">
            <span className="info-label">バージョン</span>
            <span className="info-value">{version}</span>
          </div>
          <div className="info-row">
            <span className="info-label">監視間隔</span>
            <span className="info-value">30秒</span>
          </div>
          <div className="info-row">
            <span className="info-label">成長レート</span>
            <span className="info-value">0.04/h（±40%個体差）</span>
          </div>
          <div className="info-row">
            <span className="info-label">シーズン周期</span>
            <span className="info-value">90日</span>
          </div>
        </div>
      </section>
    </div>
  );
}

const ALL_TYPES: ObjectType[] = [
  "house", "tower", "tree", "flower", "windmill",
  "shrine", "lamp", "pond", "statue",
];

const PREVIEW_GRID = 5;
const PREVIEW_HALF = (PREVIEW_GRID - 1) / 2;

const OBJ_POSITIONS: [number, number][] = [
  [0, 0], [1, 0], [2, 0],
  [0, 1], [1, 1], [2, 1],
  [0, 2], [1, 2], [2, 2],
];

function SettingsPreview({ settings }: { settings: GardenSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [growth, setGrowth] = useState(0);
  const sceneState = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    cam: THREE.PerspectiveCamera;
    key: THREE.DirectionalLight;
    orbCoreMat: THREE.MeshStandardMaterial;
    haloMat: THREE.SpriteMaterial;
    halo: THREE.Sprite;
    objContainer: THREE.Group;
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

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1220);
    scene.fog = new THREE.Fog(0x0e1220, 18, 40);

    const cam = new THREE.PerspectiveCamera(34, 2, 0.1, 80);

    scene.add(new THREE.HemisphereLight(0x6a7cff, 0x2a1d24, 1.2));
    scene.add(new THREE.AmbientLight(0x4a5a8a, 1.0));

    const key = new THREE.DirectionalLight(0xffe8c2, 3.0);
    key.position.set(4, 6, 3);
    scene.add(key);

    const baseSize = PREVIEW_GRID + 0.6;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(baseSize, 0.4, baseSize),
      new THREE.MeshStandardMaterial({ color: 0x1a2436, roughness: 1 })
    );
    base.position.y = -0.3;
    base.receiveShadow = true;
    scene.add(base);

    const tileGeo = new THREE.BoxGeometry(0.9, 0.15, 0.9);
    for (let x = 0; x < PREVIEW_GRID; x++) {
      for (let z = 0; z < PREVIEW_GRID; z++) {
        const even = (x + z) % 2 === 0;
        const t = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({
          color: even ? 0x2e3d55 : 0x243050, roughness: 0.92,
        }));
        t.position.set(x - PREVIEW_HALF, -0.05, z - PREVIEW_HALF);
        t.receiveShadow = true;
        scene.add(t);
      }
    }

    const objContainer = new THREE.Group();
    scene.add(objContainer);

    const orbPos = new THREE.Vector3(4, 6, 3);
    const orbCoreMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xfff2d6, emissiveIntensity: 2.5 });
    const orbCore = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), orbCoreMat);
    orbCore.position.copy(orbPos);
    scene.add(orbCore);

    const haloCanvas = document.createElement("canvas");
    haloCanvas.width = 64;
    haloCanvas.height = 64;
    const ctx = haloCanvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,236,192,0.9)");
    grad.addColorStop(0.4, "rgba(255,236,192,0.3)");
    grad.addColorStop(1, "rgba(255,236,192,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const haloMat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(haloCanvas),
      color: 0xffecc0, transparent: true, opacity: 0.62,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(3.0);
    halo.position.copy(orbPos);
    scene.add(halo);

    const rimM = new THREE.PointLight(0xff2fa0, 26, 20, 2.0);
    rimM.position.set(6, 3, -4);
    scene.add(rimM);
    const rimL = new THREE.PointLight(0xb6ff3f, 18, 20, 2.0);
    rimL.position.set(-5, 2, 5);
    scene.add(rimL);

    function resize() {
      const rect = canvas!.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const w = Math.max(2, rect.width);
      const h = Math.max(2, 200);
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    resize();

    let t = 0;
    let animId = 0;
    const animators: { update(dt: number): void }[] = [];

    function loop() {
      t += 0.016;
      const camT = t * 0.2;
      cam.position.x = Math.sin(camT) * 14;
      cam.position.z = Math.cos(camT) * 14;
      cam.position.y = 8;
      cam.lookAt(0, 0.5, 0);
      for (const a of animators) a.update(0.016);
      renderer.render(scene, cam);
      animId = requestAnimationFrame(loop);
    }
    loop();

    sceneState.current = { renderer, scene, cam, key, orbCoreMat, haloMat, halo, objContainer, animators, animId };

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      renderer.dispose();
      sceneState.current = null;
    };
  }, []);

  useEffect(() => {
    const s = sceneState.current;
    if (!s) return;

    while (s.objContainer.children.length) {
      s.objContainer.remove(s.objContainer.children[0]);
    }
    s.animators.length = 0;

    for (let i = 0; i < ALL_TYPES.length; i++) {
      const [gx, gz] = OBJ_POSITIONS[i];
      const { group, animator } = buildGrownObject({
        type: ALL_TYPES[i], gx, gy: gz, growth,
      });
      group.position.set(gx - PREVIEW_HALF, 0, gz - PREVIEW_HALF);
      s.objContainer.add(group);
      if (animator) s.animators.push(animator);
    }
  }, [growth]);

  useEffect(() => {
    const s = sceneState.current;
    if (!s) return;
    s.key.intensity = 3.0 * (0.3 + 0.7 * settings.orbBrightness);
    s.orbCoreMat.emissiveIntensity = 2.5 * settings.orbGlow;
    s.haloMat.opacity = 0.62 * Math.min(settings.orbGlow, 1.0);
    s.halo.scale.setScalar(3.0 * (0.3 + 0.7 * settings.orbGlow));
  }, [settings.orbBrightness, settings.orbGlow]);

  return (
    <div className="settings-preview">
      <canvas ref={canvasRef} />
      {import.meta.env.DEV && (
        <div className="preview-controls">
          <label className="setting-slider preview-slider">
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
        </div>
      )}
    </div>
  );
}

declare const __APP_VERSION__: string | undefined;
