import * as THREE from "three";
import type { ObjectType } from "../../GardenObjects";
import { GRID } from "../grid";
import type { Grid } from "./detect";
import { clusterRules } from "./rules/cluster";
import { structureRules } from "./rules/structure";
import { effectRules } from "./rules/effect";

const ALL_RULES = [...clusterRules, ...structureRules, ...effectRules];

export function applyEmergence(
  objects: { type: ObjectType; gx: number; gy: number; growth: number }[],
  root: THREE.Group
) {
  const grid: Grid = Array.from({ length: GRID }, () =>
    Array(GRID).fill(null)
  );

  for (const o of objects) {
    const gx = Math.round(o.gx);
    const gy = Math.round(o.gy);
    if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
      grid[gx][gy] = { type: o.type, growth: o.growth };
    }
  }

  for (const rule of ALL_RULES) rule(grid, root);
}

export type { Grid, GridCell, EmergenceRule } from "./detect";
