import * as THREE from "three";
import { anim } from "./anim";

export function addLanternPost(
  root: THREE.Group,
  x: number,
  z: number,
  color: number
) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 })
  );
  pole.position.set(x, 0.225, z);
  root.add(pole);

  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: color,
      emissiveIntensity: 2.5,
    })
  );
  lamp.position.set(x, 0.47, z);
  root.add(lamp);

  const light = new THREE.PointLight(color, 0.6, 1.8, 2.5);
  light.position.set(x, 0.47, z);
  root.add(light);
}

export function addMushroom(root: THREE.Group, x: number, z: number): THREE.Group {
  const group = new THREE.Group();

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.018, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xddd8c4, roughness: 0.9 })
  );
  stem.position.set(0, 0.03, 0);
  group.add(stem);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xcc4444,
      emissive: 0x441111,
      emissiveIntensity: 0.3,
      flatShading: true,
    })
  );
  cap.position.set(0, 0.06, 0);
  group.add(cap);

  group.position.set(x, 0, z);
  root.add(group);
  return group;
}

export function addPaperLantern(root: THREE.Group, x: number, z: number) {
  const colors = [0xff6633, 0xffcc33, 0xff3366];
  const col = colors[Math.floor((x * 7.3 + z * 11.1) * 100) % colors.length];

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 6, 6),
    new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.85,
    })
  );
  body.scale.set(1, 1.4, 1);
  body.position.set(x, 0.7, z);
  root.add(body);

  const light = new THREE.PointLight(col, 0.4, 1.5, 2.5);
  light.position.set(x, 0.7, z);
  root.add(light);

  const phase = x * 3.7 + z * 5.3;
  anim(body, (t) => {
    body.position.x = x + Math.sin(t * 1.2 + phase) * 0.03;
    body.position.y = 0.7 + Math.sin(t * 1.8 + phase) * 0.02;
    body.rotation.z = Math.sin(t * 1.0 + phase) * 0.15;
  });
}
