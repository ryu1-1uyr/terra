export const GRID = 8;
export const HALF = (GRID - 1) / 2;

export function gpos(gx: number, gy: number, gridSize = GRID): [number, number] {
  const half = (gridSize - 1) / 2;
  return [gx - half, gy - half];
}
