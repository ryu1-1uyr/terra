import * as THREE from "three";
import type { EffectContext, GardenEffect } from "./types";

/** 中心が明るく縁が透明な丸スプライト（泡用）。 */
function makeSoftCircleTexture(): THREE.Texture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.4, "rgba(210,235,255,0.5)");
  g.addColorStop(1, "rgba(180,220,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** 水面に広がる波紋リング用テクスチャ。 */
function makeRingTexture(): THREE.Texture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = "rgba(210,235,255,0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * 青・濃 → 水中。床の「噴出口」から泡が湧き出して立ち上る。
 * 各点は個別の速度・揺らぎで独立に上昇し、上昇するほど横に散る。
 * 噴出口が発生源のまとまりを作りつつ、剛体的な塊移動にはならない。
 * 単一の Points（1 ドローコール）で軽量。
 */
export class UnderwaterEffect implements GardenEffect {
  readonly id = "waterUnderwater" as const;

  private readonly ventCount = 18;
  private readonly perVent = 46;
  private readonly count = this.ventCount * this.perVent;
  private half = 4;

  private points!: THREE.Points;
  private geo!: THREE.BufferGeometry;
  private mat!: THREE.PointsMaterial;
  private tex!: THREE.Texture;

  // 噴出口
  private vx = new Float32Array(this.ventCount);
  private vz = new Float32Array(this.ventCount);
  private vspread = new Float32Array(this.ventCount);
  private vtimer = new Float32Array(this.ventCount); // 移動までの残り秒
  // 各点の絶対基準位置（噴出時に噴出口位置から確定）＋個別パラメータ
  private bx = new Float32Array(this.count);
  private bz = new Float32Array(this.count);
  private py = new Float32Array(this.count);
  private pvel = new Float32Array(this.count);
  private pphase = new Float32Array(this.count);
  private pamp = new Float32Array(this.count);

  init(ctx: EffectContext): void {
    this.half = ctx.gridSize / 2 + 0.5;
    this.tex = makeSoftCircleTexture();

    for (let v = 0; v < this.ventCount; v++) this.placeVent(v);
    for (let i = 0; i < this.count; i++) this.resetPoint(i, true);

    const pos = new Float32Array(this.count * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.writePositions(pos, 0);

    this.mat = new THREE.PointsMaterial({
      map: this.tex,
      color: 0xcdeeff,
      size: 0.085,
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

  private placeVent(v: number): void {
    this.vx[v] = (Math.random() * 2 - 1) * this.half;
    this.vz[v] = (Math.random() * 2 - 1) * this.half;
    this.vspread[v] = 0.08 + Math.random() * 0.4; // 噴出口の太さをランダムに
    this.vtimer[v] = 30 + Math.random() * 30; // 30〜60秒で別の場所へ移動
  }

  private resetPoint(i: number, anyHeight: boolean): void {
    const v = (i / this.perVent) | 0;
    const angle = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * this.vspread[v];
    // 噴出口の“現在位置”を基準に絶対座標で確定（＝噴出口が動いても
    // 既に上昇中の泡はワープしない。新しく湧く泡から移動が反映される）
    this.bx[i] = this.vx[v] + Math.cos(angle) * rad;
    this.bz[i] = this.vz[v] + Math.sin(angle) * rad;
    this.py[i] = anyHeight ? Math.random() * 7 : -0.3 - Math.random() * 0.5;
    this.pvel[i] = 0.5 + Math.random() * 0.95; // 個別の上昇速度
    this.pphase[i] = Math.random() * Math.PI * 2;
    this.pamp[i] = 0.02 + Math.random() * 0.06; // 横揺れの大きさ
  }

  private writePositions(pos: Float32Array, t: number): void {
    for (let i = 0; i < this.count; i++) {
      // 上昇するほど横揺れが大きくなる（泡が散っていく）
      const spreadY = 0.4 + this.py[i] * 0.18;
      pos[i * 3] =
        this.bx[i] + Math.sin(t * 1.6 + this.pphase[i]) * this.pamp[i] * spreadY;
      pos[i * 3 + 1] = this.py[i];
      pos[i * 3 + 2] =
        this.bz[i] + Math.cos(t * 1.4 + this.pphase[i]) * this.pamp[i] * spreadY;
    }
  }

  update(intensity: number, dt: number, t: number): void {
    const visible = intensity > 0.01;
    this.points.visible = visible;
    if (!visible) return;
    this.mat.opacity = Math.min(1, intensity) * 0.85;

    // 噴出口を一定時間ごとに別の場所へ移動
    for (let v = 0; v < this.ventCount; v++) {
      this.vtimer[v] -= dt;
      if (this.vtimer[v] <= 0) this.placeVent(v);
    }

    for (let i = 0; i < this.count; i++) {
      this.py[i] += this.pvel[i] * dt;
      if (this.py[i] > 7.3) this.resetPoint(i, false);
    }
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

/**
 * 青・薄 → 雨。上から落ちる雨筋（線分）と、地面で広がる波紋（リング）。
 */
export class RainEffect implements GardenEffect {
  readonly id = "waterRain" as const;

  private readonly count = 140;
  private readonly streak = 0.55;
  private half = 4;

  private lines!: THREE.LineSegments;
  private lineGeo!: THREE.BufferGeometry;
  private lineMat!: THREE.LineBasicMaterial;
  private dropX = new Float32Array(this.count);
  private dropY = new Float32Array(this.count);
  private dropZ = new Float32Array(this.count);
  private dropSpd = new Float32Array(this.count);

  // 波紋プール（地面に寝かせたリング Mesh。個別に拡大・フェード）
  private readonly rippleCount = 24;
  private rippleGeo!: THREE.PlaneGeometry;
  private rippleTex!: THREE.Texture;
  private ripples: THREE.Mesh[] = [];
  private rippleMats: THREE.MeshBasicMaterial[] = [];
  private rippleAge = new Float32Array(this.rippleCount).fill(999);

  init(ctx: EffectContext): void {
    this.half = ctx.gridSize / 2 + 0.5;

    // 雨筋
    const lpos = new Float32Array(this.count * 2 * 3);
    for (let i = 0; i < this.count; i++) this.resetDrop(i, true);
    this.writeLines(lpos);
    this.lineGeo = new THREE.BufferGeometry();
    this.lineGeo.setAttribute("position", new THREE.BufferAttribute(lpos, 3));
    this.lineMat = new THREE.LineBasicMaterial({
      color: 0xaad2ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.lines = new THREE.LineSegments(this.lineGeo, this.lineMat);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    ctx.scene.add(this.lines);

    // 波紋
    this.rippleTex = makeRingTexture();
    this.rippleGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < this.rippleCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.rippleTex,
        color: 0xcce8ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const m = new THREE.Mesh(this.rippleGeo, mat);
      m.rotation.x = -Math.PI / 2; // 地面に寝かせる
      m.position.y = 0.05;
      m.visible = false;
      m.frustumCulled = false;
      this.rippleMats.push(mat);
      this.ripples.push(m);
      ctx.scene.add(m);
    }
  }

  private resetDrop(i: number, anyHeight: boolean): void {
    this.dropX[i] = (Math.random() * 2 - 1) * this.half;
    this.dropY[i] = anyHeight ? Math.random() * 8 : 8 + Math.random() * 2;
    this.dropZ[i] = (Math.random() * 2 - 1) * this.half;
    this.dropSpd[i] = 7 + Math.random() * 4;
  }

  private writeLines(lpos: Float32Array): void {
    for (let i = 0; i < this.count; i++) {
      const b = i * 6;
      lpos[b] = this.dropX[i];
      lpos[b + 1] = this.dropY[i];
      lpos[b + 2] = this.dropZ[i];
      lpos[b + 3] = this.dropX[i];
      lpos[b + 4] = this.dropY[i] - this.streak;
      lpos[b + 5] = this.dropZ[i];
    }
  }

  private spawnRipple(x: number, z: number): void {
    for (let i = 0; i < this.rippleCount; i++) {
      if (this.rippleAge[i] >= 1) {
        this.rippleAge[i] = 0;
        const m = this.ripples[i];
        m.position.set(x, 0.05, z);
        m.visible = true;
        return;
      }
    }
  }

  update(intensity: number, dt: number, _t: number): void {
    const visible = intensity > 0.01;
    this.lines.visible = visible;
    if (!visible) {
      for (const m of this.ripples) m.visible = false;
      return;
    }

    // 雨筋
    this.lineMat.opacity = Math.min(1, intensity) * 0.6;
    const lpos = this.lineGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      this.dropY[i] -= this.dropSpd[i] * dt;
      if (this.dropY[i] < 0.1) {
        this.spawnRipple(this.dropX[i], this.dropZ[i]);
        this.resetDrop(i, false);
      }
    }
    this.writeLines(lpos);
    this.lineGeo.attributes.position.needsUpdate = true;

    // 波紋（拡大しながらフェード）
    for (let i = 0; i < this.rippleCount; i++) {
      if (this.rippleAge[i] >= 1) continue;
      this.rippleAge[i] = Math.min(1, this.rippleAge[i] + dt * 1.6);
      const age = this.rippleAge[i];
      const m = this.ripples[i];
      m.scale.setScalar(0.3 + age * 1.8);
      this.rippleMats[i].opacity = (1 - age) * Math.min(1, intensity) * 0.7;
      if (age >= 1) m.visible = false;
    }
  }

  dispose(): void {
    this.lines.parent?.remove(this.lines);
    this.lineGeo.dispose();
    this.lineMat.dispose();
    for (const m of this.ripples) m.parent?.remove(m);
    for (const mat of this.rippleMats) mat.dispose();
    this.rippleGeo.dispose();
    this.rippleTex.dispose();
    this.ripples = [];
    this.rippleMats = [];
  }
}
