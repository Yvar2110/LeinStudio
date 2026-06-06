import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import type { DesignSettings, GarmentSettings } from "../types";
import { loadTShirtModel, type LoadedShirt } from "./TShirtModelLoader";

interface TShirtParts {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  designMesh: THREE.Mesh | null;
  chestAnchor: LoadedShirt["chestAnchor"];
}

export function createTShirtModel(garment: GarmentSettings): Promise<TShirtParts> {
  return loadTShirtModel(garment).then((loaded) => ({
    group: loaded.group,
    bodyMesh: loaded.bodyMesh,
    bodyMaterial: loaded.bodyMaterial,
    designMesh: null,
    chestAnchor: loaded.chestAnchor,
  }));
}

export function updateGarmentColor(
  parts: TShirtParts,
  garment: GarmentSettings
): void {
  parts.bodyMaterial.color.set(garment.color);
  parts.bodyMaterial.roughness = garment.roughness;
  parts.bodyMaterial.metalness = garment.metalness;
}

function removeDesignMesh(parts: TShirtParts): void {
  if (parts.designMesh) {
    parts.group.remove(parts.designMesh);
    parts.designMesh.geometry.dispose();
    (parts.designMesh.material as THREE.Material).dispose();
    parts.designMesh = null;
  }
}

function buildFallbackDesignMesh(
  parts: TShirtParts,
  texture: THREE.Texture,
  settings: DesignSettings
): THREE.Mesh {
  const aspect = texture.image
    ? (texture.image as HTMLImageElement).width /
      (texture.image as HTMLImageElement).height
    : 1;

  const w = 0.28 * settings.scale * Math.max(aspect, 0.5);
  const h = 0.28 * settings.scale;
  const geometry = new THREE.PlaneGeometry(w, h);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const pos = parts.chestAnchor.position.clone().add(
    parts.chestAnchor.normal.clone().multiplyScalar(0.015)
  );
  pos.x += settings.offsetX;
  pos.y += settings.offsetY;

  mesh.position.copy(pos);
  mesh.lookAt(pos.clone().add(parts.chestAnchor.normal));
  mesh.rotateZ(THREE.MathUtils.degToRad(settings.rotation));
  mesh.renderOrder = 10;
  return mesh;
}

function buildDecalMesh(
  parts: TShirtParts,
  texture: THREE.Texture,
  settings: DesignSettings
): THREE.Mesh {
  parts.bodyMesh.updateMatrixWorld(true);

  try {
    const position = parts.chestAnchor.position.clone();
    position.add(parts.chestAnchor.normal.clone().multiplyScalar(0.012));
    position.x += settings.offsetX;
    position.y += settings.offsetY;

    const target = position.clone().add(parts.chestAnchor.normal);
    const orientMatrix = new THREE.Matrix4().lookAt(
      position,
      target,
      new THREE.Vector3(0, 1, 0)
    );
    const orientation = new THREE.Euler().setFromRotationMatrix(orientMatrix);
    orientation.z += THREE.MathUtils.degToRad(settings.rotation);

    const baseSize = 0.3 * settings.scale;
    const aspect = texture.image
      ? (texture.image as HTMLImageElement).width /
        (texture.image as HTMLImageElement).height
      : 1;

    const size = new THREE.Vector3(
      baseSize * Math.max(aspect, 0.5),
      baseSize,
      0.22 * settings.scale
    );

    const decalGeo = new DecalGeometry(
      parts.bodyMesh,
      position,
      orientation,
      size
    );

    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(decalGeo, material);
    mesh.renderOrder = 10;
    mesh.name = "tshirt-design";
    return mesh;
  } catch {
    return buildFallbackDesignMesh(parts, texture, settings);
  }
}

export function applyDesignTexture(
  parts: TShirtParts,
  texture: THREE.Texture | null,
  settings: DesignSettings
): void {
  removeDesignMesh(parts);
  if (!texture) return;

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  parts.designMesh = buildDecalMesh(parts, texture, settings);
  parts.group.add(parts.designMesh);
}

export type { TShirtParts };
