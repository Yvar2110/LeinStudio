import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GarmentSettings } from "../types";

const MODEL_URL = "/models/regular-tshirt.glb";
const FABRIC_NORMAL =
  "https://virtualthreads-app.nyc3.cdn.digitaloceanspaces.com/wiggle_bones_test2/t-shirt_normal.jpg";
const FABRIC_ROUGHNESS =
  "https://virtualthreads-app.nyc3.cdn.digitaloceanspaces.com/wiggle_bones_test2/t-shirt_roughness.jpg";

export interface LoadedShirt {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  chestAnchor: {
    position: THREE.Vector3;
    normal: THREE.Vector3;
  };
}

function pickBodyMesh(root: THREE.Object3D): THREE.Mesh {
  let best: THREE.Mesh | null = null;
  let bestCount = 0;

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;
    const count = child.geometry.attributes.position?.count ?? 0;
    if (count > bestCount) {
      bestCount = count;
      best = child;
    }
  });

  if (!best) {
    throw new Error("El modelo GLB no contiene mallas válidas");
  }

  return best;
}

function computeChestAnchor(mesh: THREE.Mesh): LoadedShirt["chestAnchor"] {
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const position = new THREE.Vector3(center.x, center.y + box.getSize(new THREE.Vector3()).y * 0.08, box.max.z);
  return { position, normal: new THREE.Vector3(0, 0, 1) };
}

function normalizeModel(group: THREE.Group): void {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  group.position.sub(center);

  const targetHeight = 1.02;
  const scale = targetHeight / Math.max(size.y, 0.001);
  group.scale.setScalar(scale);

  group.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(group);
  const hemY = -0.5;
  group.position.y += hemY - fitted.min.y;
}

function createFabricMaterial(
  garment: GarmentSettings,
  normalMap: THREE.Texture | null,
  roughnessMap: THREE.Texture | null
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(garment.color),
    roughness: garment.roughness,
    metalness: garment.metalness,
    sheen: 0.35,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(0xffffff),
    side: THREE.DoubleSide,
  });

  if (normalMap) {
    normalMap.colorSpace = THREE.LinearSRGBColorSpace;
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(2, 2);
    material.normalMap = normalMap;
    material.normalScale.set(0.45, 0.45);
  }

  if (roughnessMap) {
    roughnessMap.colorSpace = THREE.LinearSRGBColorSpace;
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(2, 2);
    material.roughnessMap = roughnessMap;
  }

  return material;
}

function loadTexture(url: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => resolve(tex),
      undefined,
      () => resolve(null)
    );
  });
}

export function loadTShirtModel(garment: GarmentSettings): Promise<LoadedShirt> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    Promise.all([loadTexture(FABRIC_NORMAL), loadTexture(FABRIC_ROUGHNESS)])
      .then(([normalMap, roughnessMap]) => {
        loader.load(
          MODEL_URL,
          (gltf) => {
            const group = gltf.scene;
            group.name = "tshirt-root";

            normalizeModel(group);

            const sharedMaterial = createFabricMaterial(garment, normalMap, roughnessMap);

            group.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material = sharedMaterial;
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const bodyMesh = pickBodyMesh(group);
            bodyMesh.name = "tshirt-body";

            resolve({
              group,
              bodyMesh,
              bodyMaterial: sharedMaterial,
              chestAnchor: computeChestAnchor(bodyMesh),
            });
          },
          undefined,
          reject
        );
      })
      .catch(reject);
  });
}
