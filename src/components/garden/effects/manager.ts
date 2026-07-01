import type { EffectContext, EffectIntensities, GardenEffect } from "./types";
import { ZERO_INTENSITIES } from "./types";

/**
 * 全エフェクトのライフサイクルを束ねる。
 * initThreeScene はこれを 1 個持ち、loop() から `update` を呼ぶだけで済む。
 */
export class EffectManager {
  private effects: GardenEffect[] = [];
  private intensities: EffectIntensities = { ...ZERO_INTENSITIES };

  constructor(private readonly ctx: EffectContext) {}

  /** エフェクトを追加して初期化する。 */
  register(effect: GardenEffect): this {
    effect.init(this.ctx);
    this.effects.push(effect);
    return this;
  }

  /** 検知色から算出した強度をまとめて反映する。 */
  setIntensities(next: EffectIntensities): void {
    this.intensities = next;
  }

  /** 毎フレーム、各エフェクトを自分の強度で駆動する。 */
  update(dt: number, t: number): void {
    for (const e of this.effects) {
      e.update(this.intensities[e.id] ?? 0, dt, t);
    }
  }

  dispose(): void {
    for (const e of this.effects) e.dispose();
    this.effects = [];
  }
}
