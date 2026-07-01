import * as THREE from "three";
import type { EffectContext, GardenEffect } from "./types";

/** 中心が白く縁が透明な発光スプライト（加算合成前提）。 */
function makeGlowTexture(): THREE.Texture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * 赤・濃 → 火の粉。暖色の粒が下から上へ立ち上り、揺らぎながら消えていく。
 * 加算合成で発光感を出し、全体を軽く明滅させる。
 */
export class EmberEffect implements GardenEffect {
  readonly id = "fireEmber" as const;

  private readonly count = 150;
  private half = 4;
  private points!: THREE.Points;
  private geo!: THREE.BufferGeometry;
  private mat!: THREE.PointsMaterial;
  private tex!: THREE.Texture;
  private vel = new Float32Array(this.count);
  private phase = new Float32Array(this.count);

  init(ctx: EffectContext): void {
    this.half = ctx.gridSize / 2 + 0.5;
    this.tex = makeGlowTexture();
    const pos = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) this.reset(pos, i, true);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({
      map: this.tex,
      color: 0xff7a2a,
      size: 0.11,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    ctx.scene.add(this.points);
  }

  private reset(pos: Float32Array, i: number, anyHeight: boolean): void {
    pos[i * 3] = (Math.random() * 2 - 1) * this.half;
    pos[i * 3 + 1] = anyHeight ? Math.random() * 7 : -0.2 - Math.random() * 0.4;
    pos[i * 3 + 2] = (Math.random() * 2 - 1) * this.half;
    this.vel[i] = 0.7 + Math.random() * 1.2; // 上昇は速め
    this.phase[i] = Math.random() * Math.PI * 2;
  }

  update(intensity: number, dt: number, t: number): void {
    const visible = intensity > 0.01;
    this.points.visible = visible;
    if (!visible) return;
    const flicker = 0.82 + 0.18 * Math.sin(t * 9);
    this.mat.opacity = Math.min(1, intensity) * 0.9 * flicker;

    const pos = this.geo.attributes.position.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      pos[i * 3 + 1] += this.vel[i] * dt;
      pos[i * 3] += Math.sin(t * 3 + this.phase[i]) * 0.008;
      if (pos[i * 3 + 1] > 7) this.reset(pos, i, false);
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

/**
 * 赤・薄 → 陽だまり。暖色のやわらかい光の粒が、それぞれの居場所の周りを
 * ゆっくり漂う。火の粉と違って上昇せず、穏やかで安らいだ空気を作る。
 */
export class GlowEffect implements GardenEffect {
  readonly id = "fireGlow" as const;

  private readonly count = 42;
  private half = 4;
  private points!: THREE.Points;
  private geo!: THREE.BufferGeometry;
  private mat!: THREE.PointsMaterial;
  private tex!: THREE.Texture;

  private hx = new Float32Array(this.count); // 居場所（漂う中心）
  private hy = new Float32Array(this.count);
  private hz = new Float32Array(this.count);
  private phase = new Float32Array(this.count);
  private sp = new Float32Array(this.count); // 漂う速さ

  init(ctx: EffectContext): void {
    this.half = ctx.gridSize / 2 + 0.5;
    this.tex = makeGlowTexture();
    for (let i = 0; i < this.count; i++) {
      this.hx[i] = (Math.random() * 2 - 1) * this.half;
      this.hy[i] = 0.6 + Math.random() * 5;
      this.hz[i] = (Math.random() * 2 - 1) * this.half;
      this.phase[i] = Math.random() * Math.PI * 2;
      this.sp[i] = 0.25 + Math.random() * 0.35;
    }

    const pos = new Float32Array(this.count * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.writePositions(pos, 0);

    this.mat = new THREE.PointsMaterial({
      map: this.tex,
      color: 0xffd39a,
      size: 0.42,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    ctx.scene.add(this.points);
  }

  private writePositions(pos: Float32Array, t: number): void {
    for (let i = 0; i < this.count; i++) {
      const ph = this.phase[i];
      const s = this.sp[i];
      pos[i * 3] = this.hx[i] + Math.sin(t * s + ph) * 0.5;
      pos[i * 3 + 1] = this.hy[i] + Math.sin(t * s * 0.7 + ph * 1.7) * 0.35;
      pos[i * 3 + 2] = this.hz[i] + Math.cos(t * s * 0.8 + ph) * 0.5;
    }
  }

  update(intensity: number, _dt: number, t: number): void {
    const visible = intensity > 0.01;
    this.points.visible = visible;
    if (!visible) return;
    // ゆっくりとした呼吸のような明滅
    const breathe = 0.85 + 0.15 * Math.sin(t * 1.5);
    this.mat.opacity = Math.min(1, intensity) * 0.5 * breathe;

    const pos = this.geo.attributes.position.array as Float32Array;
    this.writePositions(pos, t);
    this.geo.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.points.parent?.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}
