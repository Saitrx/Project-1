// Soft directional sun shadows over a limited area around the action.
import * as THREE from 'three';

export function sunShadow(scene, light, { cx = 0, cz = 0, size = 40, mapSize = 2048, radius = 3 } = {}) {
  const dir = light.position.clone().normalize();
  light.target.position.set(cx, 0, cz);
  light.position.set(cx, 0, cz).addScaledVector(dir, 200);
  scene.add(light.target);
  light.castShadow = true;
  light.shadow.mapSize.set(mapSize, mapSize);
  const cam = light.shadow.camera;
  cam.left = -size;
  cam.right = size;
  cam.top = size;
  cam.bottom = -size;
  cam.near = 20;
  cam.far = 420;
  cam.updateProjectionMatrix();
  light.shadow.radius = radius;
  light.shadow.bias = -0.0006;
  light.shadow.normalBias = 0.03;
}

// Opaque meshes under root cast shadows; blob shadows fade to a light contact shadow.
export function castShadows(root, { receive = false } = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.transparent) {
      if (o.material.map && o.parent === root) o.material.opacity = 0.3;
      return;
    }
    o.castShadow = true;
    o.receiveShadow = receive;
  });
}

export function receiveShadows(...meshes) {
  for (const m of meshes) m.receiveShadow = true;
}
