import type * as THREE from "three";
import type { ObjectType } from "../../GardenObjects";
import { GRID } from "../grid";

export interface GridCell {
  type: ObjectType;
  growth: number;
}

export type Grid = (GridCell | null)[][];

export type EmergenceRule = (grid: Grid, root: THREE.Group) => void;

export const ADJ4 = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];
export const ADJ8 = [...ADJ4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function neighbors(
  grid: Grid,
  gx: number,
  gy: number,
  dirs = ADJ4
): { cell: GridCell; gx: number; gy: number }[] {
  const result: { cell: GridCell; gx: number; gy: number }[] = [];
  for (const [dx, dy] of dirs) {
    const nx = gx + dx;
    const ny = gy + dy;
    if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID && grid[nx][ny]) {
      result.push({ cell: grid[nx][ny]!, gx: nx, gy: ny });
    }
  }
  return result;
}

export function floodFill(
  grid: Grid,
  sx: number,
  sy: number,
  type: string,
  visited: boolean[][]
): [number, number][] {
  const stack: [number, number][] = [[sx, sy]];
  const cluster: [number, number][] = [];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) continue;
    if (visited[x][y]) continue;
    if (!grid[x][y] || grid[x][y]!.type !== type) continue;
    visited[x][y] = true;
    cluster.push([x, y]);
    for (const [dx, dy] of ADJ4) {
      stack.push([x + dx, y + dy]);
    }
  }
  return cluster;
}

export function findClusters(
  grid: Grid,
  type: string
): [number, number][][] {
  const visited = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  const clusters: [number, number][][] = [];
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (!visited[x][y] && grid[x][y]?.type === type) {
        const c = floodFill(grid, x, y, type, visited);
        if (c.length > 0) clusters.push(c);
      }
    }
  }
  return clusters;
}
