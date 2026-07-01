import * as THREE from "three";
import type { EffectContext, GardenEffect } from "./types";

/** 白い葉のシルエット（tint はマテリアル色で行う）。 */
function makeLeafTexture(): THREE.Texture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(s / 2, 6);
  ctx.quadraticCurveTo(s - 8, s / 2, s / 2, s - 6);
  ctx.quadraticCurveTo(8, s / 2, s / 2, 6);
  ctx.fill();
  // 中央の葉脈をうっすら
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s / 2, 8);
  ctx.lineTo(s / 2, s - 8);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** ふわっとした綿毛用のやわらかい丸。 */
function makeFluffTexture(): THREE.Texture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.5, "rgba(240,255,225,0.4)");
  g.addColorStop(1, "rgba(220,245,200,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * 緑・濃 → 落ち葉。板ポリの葉が回転しながらハラハラと舞い落ちる。
 * per-leaf の回転が要るため Points ではなく Mesh で構成する。
 */
export class LeavesEffect implements GardenEffect {
  readonly id = "natureLeaves" as const;

  private readonly count = 48;
  private half = 4;
  private geo!: THREE.PlaneGeometry;
  private tex!: THREE.Texture;
  private mats: THREE.MeshBasicMaterial[] = [];
  private leaves: THREE.Mesh[] = [];

  private fall = new Float32Array(this.count);
  private swayPhase = new Float32Array(this.count);
  private swayAmp = new Float32Array(this.count);
  private rvx = new Float32Array(this.count);
  private rvz = new Float32Array(this.count);

  init(ctx: EffectContext): void {
    this.half = ctx.gridSize / 2 + 0.5;
    this.tex = makeLeafTexture();
    this.geo = new THREE.PlaneGeometry(1, 1.15);
    const shades = [0x3f7a2e, 0x5a9e3a, 0x2f6b34, 0x77aa3e];
    this.mats = shades.map(
      (col) =>
        new THREE.MeshBasicMaterial({
          map: this.tex,
          color: col,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
    );
    for (let i = 0; i < this.count; i++) {
      const m = new THREE.Mesh(this.geo, this.mats[i % this.mats.length]);
      m.frustumCulled = false;
      this.leaves.push(m);
      this.reset(i, true);
      ctx.scene.add(m);
    }
  }

  private reset(i: number, anyHeight: boolean): void {
    const m = this.leaves[i];
    m.position.set(
      (Math.random() * 2 - 1) * this.half,
      anyHeight ? Math.random() * 8 : 7.5 + Math.random() * 2,
      (Math.random() * 2 - 1) * this.half
    );
    m.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    const sc = 0.22 + Math.random() * 0.22;
    m.scale.setScalar(sc);
    this.fall[i] = 0.5 + Math.random() * 0.8;
    this.swayPhase[i] = Math.random() * Math.PI * 2;
    this.swayAmp[i] = 0.15 + Math.random() * 0.35;
    this.rvx[i] = (Math.random() * 2 - 1) * 1.6;
    this.rvz[i] = (Math.random() * 2 - 1) * 2.2;
  }

  update(intensity: number, dt: number, t: number): void {
    const visible = intensity > 0.01;
    for (const m of this.leaves) m.visible = visible;
    if (!visible) return;
    const op = Math.min(1, intensity) * 0.95;
    for (const mat of this.mats) mat.opacity = op;

    for (let i = 0; i < this.count; i++) {
      const m = this.leaves[i];
      m.position.y -= this.fall[i] * dt;
      m.position.x += Math.sin(t * 1.3 + this.swayPhase[i]) * this.swayAmp[i] * dt;
      m.rotation.x += this.rvx[i] * dt;
      m.rotation.z += this.rvz[i] * dt;
      if (m.position.y < -0.4) this.reset(i, false);
    }
  }

  dispose(): void {
    for (const m of this.leaves) m.parent?.remove(m);
    for (const mat of this.mats) mat.dispose();
    this.geo.dispose();
    this.tex.dispose();
    this.leaves = [];
    this.mats = [];
  }
}

/**
 * 緑・薄 → 綿毛。やわらかい綿毛がふわふわと上へ漂う。
 * 落ち葉と逆向き（上昇）で、軽く頼りない動き。
 */
export class SeedEffect implements GardenEffect {
  readonly id = "natureSeeds" as const;

  private readonly count = 60;
  private half = 4;
  private points!: THREE.Points;
  private geo!: THREE.BufferGeometry;
  private mat!: THREE.PointsMaterial;
  private tex!: THREE.Texture;
  private vel = new Float32Array(this.count);
  private phase = new Float32Array(this.count);
  private amp = new Float32Array(this.count);

  init(ctx: EffectContext): void {
    this.half = ctx.gridSize / 2 + 0.5;
    this.tex = makeFluffTexture();
    const pos = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) this.reset(pos, i, true);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({
      map: this.tex,
      color: 0xe6f5cf,
      size: 0.2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    ctx.scene.add(this.points);
  }

  private reset(pos: Float32Array, i: number, anyHeight: boolean): void {
    pos[i * 3] = (Math.random() * 2 - 1) * this.half;
    pos[i * 3 + 1] = anyHeight ? Math.random() * 7 : -0.3 - Math.random() * 0.5;
    pos[i * 3 + 2] = (Math.random() * 2 - 1) * this.half;
    this.vel[i] = 0.05 + Math.random() * 0.13; // ふわっと漂う程度の上昇
    this.phase[i] = Math.random() * Math.PI * 2;
    this.amp[i] = 0.003 + Math.random() * 0.006;
  }

  update(intensity: number, dt: number, t: number): void {
    const visible = intensity > 0.01;
    this.points.visible = visible;
    if (!visible) return;
    this.mat.opacity = Math.min(1, intensity) * 0.8;

    const pos = this.geo.attributes.position.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      pos[i * 3 + 1] += this.vel[i] * dt;
      // 頼りなく左右にふらつく
      pos[i * 3] += Math.sin(t * 0.45 + this.phase[i]) * this.amp[i];
      pos[i * 3 + 2] += Math.cos(t * 0.35 + this.phase[i] * 1.3) * this.amp[i];
      if (pos[i * 3 + 1] > 7.2) this.reset(pos, i, false);
    }
    this.geo.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.points.parent?.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}
