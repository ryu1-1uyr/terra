import type { EffectIntensities } from "./types";
import { ZERO_INTENSITIES } from "./types";

export interface Rgb {
  r: number; // 0..255
  g: number;
  b: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 検知色を 6 エフェクトの強度へ変換する純関数。
 *
 * - grey(=最小チャンネル) を引いた chroma を各原色の presence とする（無彩色→0→無エフェクト）
 * - HSV 彩度 S から denseFactor を作り、各原色を「濃(dense)」「薄(pale)」へ振り分ける
 * - global（開発スライダー等）で全体をスケールする
 *
 * 混合色は各チャンネルの寄与が加算されて自然に合成される
 * （例: 紫 = R+B → 火の粉 + 泡）。
 */
export function computeEffectIntensities(
  color: Rgb | null,
  global = 1,
): EffectIntensities {
  if (!color) return { ...ZERO_INTENSITIES };

  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max <= 0) return { ...ZERO_INTENSITIES };

  const grey = min;
  const chromaR = r - grey;
  const chromaG = g - grey;
  const chromaB = b - grey;
  const sat = (max - min) / max; // HSV 彩度

  // 鮮やか(高彩度)→濃(1)、淡い→薄(0)
  const dense = smoothstep(0.25, 0.75, sat);
  const pale = 1 - dense;
  const s = Math.max(0, global);

  return {
    waterUnderwater: chromaB * dense * s,
    waterRain: chromaB * pale * s,
    fireEmber: chromaR * dense * s,
    fireGlow: chromaR * pale * s,
    natureLeaves: chromaG * dense * s,
    natureSeeds: chromaG * pale * s,
  };
}
