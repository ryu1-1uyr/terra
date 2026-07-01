import * as THREE from "three";

/** 検知色から算出される 6 エフェクトの強度（各 0..1）。 */
export interface EffectIntensities {
  waterUnderwater: number;
  waterRain: number;
  fireEmber: number;
  fireGlow: number;
  natureLeaves: number;
  natureSeeds: number;
}

export type EffectId = keyof EffectIntensities;

export const ZERO_INTENSITIES: EffectIntensities = {
  waterUnderwater: 0,
  waterRain: 0,
  fireEmber: 0,
  fireGlow: 0,
  natureLeaves: 0,
  natureSeeds: 0,
};

/** エフェクトがシーンへアクセスするための共有コンテキスト。 */
export interface EffectContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** パーティクル散布範囲の目安（ワールド半径）。grid サイズ由来。 */
  bounds: number;
  gridSize: number;
}

/**
 * 大気エフェクトのプラグイン。
 * `init` で生成して scene に追加し、毎フレーム `update` で強度に応じて描画、
 * `dispose` で破棄する。新しいエフェクトはこのインターフェースを実装して
 * EffectManager に register するだけで追加できる。
 */
export interface GardenEffect {
  readonly id: EffectId;
  init(ctx: EffectContext): void;
  /** intensity: 0..1（0 で完全非表示）。dt: 経過秒。t: 累積秒。 */
  update(intensity: number, dt: number, t: number): void;
  dispose(): void;
}
