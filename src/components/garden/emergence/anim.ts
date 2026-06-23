import * as THREE from "three";

export function anim(obj: THREE.Object3D, fn: (t: number) => void) {
  obj.onBeforeRender = () => fn(performance.now() * 0.001);
}
