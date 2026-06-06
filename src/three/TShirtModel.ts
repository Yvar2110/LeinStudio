import * as THREE from "three";
import type { DesignSettings, GarmentSettings } from "../types";
import { loadTShirtModel, type DesignAnchor, type LoadedShirt } from "./TShirtModelLoader";

interface TShirtParts {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  designMesh: THREE.Mesh | null;
  anchors: LoadedShirt["anchors"];
}

export function createTShirtModel(garment: GarmentSettings): Promise<TShirtParts> {
  return loadTShirtModel(garment).then((loaded) => ({
    group: loaded.group,
    bodyMesh: loaded.bodyMesh,
    bodyMaterial: loaded.bodyMaterial,
    designMesh: null,
    anchors: loaded.anchors,
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

function alignToNormal(mesh: THREE.Mesh, normal: THREE.Vector3, rotationDeg: number): void {
  const z = normal.clone().normalize();
  let x = new THREE.Vector3(0, 1, 0).cross(z);
  if (x.lengthSq() < 1e-6) {
    x.set(1, 0, 0);
  }
  x.normalize();
  const y = z.clone().cross(x).normalize();

  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  mesh.rotateZ(THREE.MathUtils.degToRad(rotationDeg));
}

function getDesignAnchor(parts: TShirtParts, settings: DesignSettings): DesignAnchor {
  return settings.side === "back" ? parts.anchors.back : parts.anchors.front;
}

function buildDesignMesh(
  parts: TShirtParts,
  texture: THREE.Texture,
  settings: DesignSettings
): THREE.Mesh {
  const anchor = getDesignAnchor(parts, settings);
  const aspect = texture.image
    ? (texture.image as HTMLImageElement).width /
      (texture.image as HTMLImageElement).height
    : 1;

  const base = 0.32 * settings.scale;
  const width = base * Math.max(aspect, 0.45);
  const height = base;

  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.02,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "tshirt-design";
  mesh.renderOrder = 20;

  const position = anchor.position.clone();
  position.x += settings.offsetX;
  position.y += settings.offsetY;
  position.add(anchor.normal.clone().multiplyScalar(0.018));

  mesh.position.copy(position);
  alignToNormal(mesh, anchor.normal, settings.rotation);

  return mesh;
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

  parts.designMesh = buildDesignMesh(parts, texture, settings);
  parts.group.add(parts.designMesh);
}

export type { TShirtParts };
