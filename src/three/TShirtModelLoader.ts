import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { DesignSide, GarmentSettings } from "../types";

const MODEL_URL = "/models/regular-tshirt.glb";
const FABRIC_NORMAL =
  "https://virtualthreads-app.nyc3.cdn.digitaloceanspaces.com/wiggle_bones_test2/t-shirt_normal.jpg";
const FABRIC_ROUGHNESS =
  "https://virtualthreads-app.nyc3.cdn.digitaloceanspaces.com/wiggle_bones_test2/t-shirt_roughness.jpg";

export interface DesignAnchor {
  position: THREE.Vector3;
  normal: THREE.Vector3;
}

export interface LoadedShirt {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  anchors: {
    front: DesignAnchor;
    back: DesignAnchor;
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

/** Punto de colocación del diseño en coordenadas locales del grupo */
function computeDesignAnchor(group: THREE.Group, side: DesignSide): DesignAnchor {
  group.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const meshes: THREE.Mesh[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child);
  });

  const chestY = center.y + size.y * 0.06;
  const attempt =
    side === "front"
      ? {
          origin: new THREE.Vector3(center.x, chestY, box.max.z + 0.35),
          dir: new THREE.Vector3(0, 0, -1),
          fallback: new THREE.Vector3(center.x, chestY, box.max.z),
          fallbackNormal: new THREE.Vector3(0, 0, 1),
        }
      : {
          origin: new THREE.Vector3(center.x, chestY, box.min.z - 0.35),
          dir: new THREE.Vector3(0, 0, 1),
          fallback: new THREE.Vector3(center.x, chestY, box.min.z),
          fallbackNormal: new THREE.Vector3(0, 0, -1),
        };

  const raycaster = new THREE.Raycaster(attempt.origin, attempt.dir);
  const hits = raycaster.intersectObjects(meshes, false);

  let worldPoint: THREE.Vector3;
  let worldNormal: THREE.Vector3;

  if (hits.length > 0) {
    worldPoint = hits[0].point.clone();
    const faceNormal = hits[0].face?.normal ?? attempt.dir.clone().negate();
    worldNormal = faceNormal.clone().transformDirection(hits[0].object.matrixWorld);
  } else {
    worldPoint = attempt.fallback.clone();
    worldNormal = attempt.fallbackNormal.clone();
  }

  const invMatrix = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const position = worldPoint.applyMatrix4(invMatrix);
  const normal = worldNormal.transformDirection(invMatrix).normalize();

  return { position, normal };
}

export function computeDesignAnchors(group: THREE.Group): LoadedShirt["anchors"] {
  return {
    front: computeDesignAnchor(group, "front"),
    back: computeDesignAnchor(group, "back"),
  };
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
              anchors: computeDesignAnchors(group),
            });
          },
          undefined,
          reject
        );
      })
      .catch(reject);
  });
}
