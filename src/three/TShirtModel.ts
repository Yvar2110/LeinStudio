import * as THREE from "three";
import type { DesignSettings, GarmentSettings } from "../types";
import { loadTShirtModel, type DesignAnchor, type LoadedShirt } from "./TShirtModelLoader";
import { TShirtDesignShader, type DesignShaderSlot } from "./TShirtDesignShader";

interface SurfaceHit {
  localPosition: THREE.Vector3;
  localNormal: THREE.Vector3;
  worldPosition: THREE.Vector3;
  worldNormal: THREE.Vector3;
  mesh: THREE.Mesh;
}

interface DesignEntry {
  pickerMesh: THREE.Mesh;
  texture: THREE.Texture;
  settings: DesignSettings;
}

interface TShirtParts {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  designs: Map<string, DesignEntry>;
  anchors: LoadedShirt["anchors"];
  designShader: TShirtDesignShader;
}

/** Pequeña separación del plano invisible de detección sobre la tela */
const SURFACE_OFFSET = 0.0108;
const RAY_PROBE_DISTANCE = 0.32;

function getShirtMeshes(parts: TShirtParts): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  parts.group.traverse((child) => {
    if (child instanceof THREE.Mesh && !child.userData.designId) {
      meshes.push(child);
    }
  });
  return meshes;
}

function getDesignAnchor(parts: TShirtParts, settings: DesignSettings): DesignAnchor {
  return settings.side === "back" ? parts.anchors.back : parts.anchors.front;
}

function getAnchorBasis(normal: THREE.Vector3) {
  const n = normal.clone().normalize();
  let tangentX = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n);
  if (tangentX.lengthSq() < 1e-6) tangentX.set(1, 0, 0);
  tangentX.normalize();
  const tangentY = new THREE.Vector3().crossVectors(n, tangentX).normalize();
  return { normal: n, tangentX, tangentY };
}

function getSurfaceHit(parts: TShirtParts, settings: DesignSettings): SurfaceHit | null {
  const anchor = getDesignAnchor(parts, settings);
  const { tangentX, tangentY, normal } = getAnchorBasis(anchor.normal);

  const planarPoint = anchor.position
    .clone()
    .add(tangentX.clone().multiplyScalar(settings.offsetX))
    .add(tangentY.clone().multiplyScalar(settings.offsetY));

  parts.group.updateMatrixWorld(true);

  const worldPlanar = planarPoint.clone().applyMatrix4(parts.group.matrixWorld);
  const worldNormal = normal.clone().transformDirection(parts.group.matrixWorld).normalize();
  const probeOrigin = worldPlanar.clone().add(worldNormal.clone().multiplyScalar(RAY_PROBE_DISTANCE));
  const rayDir = worldNormal.clone().negate();

  const invMatrix = new THREE.Matrix4().copy(parts.group.matrixWorld).invert();
  const raycaster = new THREE.Raycaster(probeOrigin, rayDir);
  const hits = raycaster.intersectObjects(getShirtMeshes(parts), false);

  for (const hit of hits) {
    if (!hit.face || !(hit.object instanceof THREE.Mesh)) continue;

    const hitWorldNormal = hit.face.normal
      .clone()
      .transformDirection(hit.object.matrixWorld)
      .normalize();
    let localHitNormal = hitWorldNormal.clone().transformDirection(invMatrix).normalize();

    if (localHitNormal.dot(anchor.normal) < 0) {
      localHitNormal.negate();
    }

    return {
      localPosition: parts.group.worldToLocal(hit.point.clone()),
      localNormal: localHitNormal,
      worldPosition: hit.point.clone(),
      worldNormal: hitWorldNormal,
      mesh: hit.object,
    };
  }

  return null;
}

function getSurfaceAtOffset(
  parts: TShirtParts,
  settings: DesignSettings
): { position: THREE.Vector3; normal: THREE.Vector3 } {
  const hit = getSurfaceHit(parts, settings);
  if (hit) {
    const position = hit.localPosition.clone().add(hit.localNormal.clone().multiplyScalar(SURFACE_OFFSET));
    return { position, normal: hit.localNormal };
  }

  const anchor = getDesignAnchor(parts, settings);
  const { tangentX, tangentY, normal } = getAnchorBasis(anchor.normal);
  const planarPoint = anchor.position
    .clone()
    .add(tangentX.clone().multiplyScalar(settings.offsetX))
    .add(tangentY.clone().multiplyScalar(settings.offsetY))
    .add(normal.clone().multiplyScalar(SURFACE_OFFSET));
  return { position: planarPoint, normal: anchor.normal.clone() };
}

function getDesignDimensions(texture: THREE.Texture, scale: number) {
  const aspect = texture.image
    ? (texture.image as HTMLImageElement).width / (texture.image as HTMLImageElement).height
    : 1;

  const base = 0.32 * scale;
  const width = base * Math.max(aspect, 0.45);
  const height = base;
  const depth = Math.max(width, height) * 0.5;

  return { width, height, depth };
}

/** Proyector del diseño expresado en el espacio de objeto de la malla (constante al rotar) */
function buildDesignShaderSlot(
  parts: TShirtParts,
  texture: THREE.Texture,
  settings: DesignSettings
): DesignShaderSlot {
  const hit = getSurfaceHit(parts, settings);
  const anchor = getDesignAnchor(parts, settings);
  const { width, height, depth } = getDesignDimensions(texture, settings.scale);

  parts.group.updateMatrixWorld(true);

  const targetMesh = hit?.mesh ?? parts.bodyMesh;
  targetMesh.updateMatrixWorld(true);

  // El origen sigue al punto bajo el cursor (se mueve al arrastrar)
  const worldOrigin =
    hit?.worldPosition ??
    anchor.position.clone().applyMatrix4(parts.group.matrixWorld);

  // La ORIENTACIÓN usa el marco fijo del anclaje (no la normal del punto),
  // así el diseño no rota al arrastrarlo por la superficie curva.
  const groupBasis = getAnchorBasis(anchor.normal);
  const worldNormal = groupBasis.normal
    .clone()
    .transformDirection(parts.group.matrixWorld)
    .normalize();
  const worldTangentX = groupBasis.tangentX
    .clone()
    .transformDirection(parts.group.matrixWorld)
    .normalize();
  const worldTangentY = groupBasis.tangentY
    .clone()
    .transformDirection(parts.group.matrixWorld)
    .normalize();

  const rotRad = THREE.MathUtils.degToRad(settings.rotation);
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);
  const rotX = worldTangentX.clone().multiplyScalar(cos).add(worldTangentY.clone().multiplyScalar(sin));
  const rotY = worldTangentY.clone().multiplyScalar(cos).sub(worldTangentX.clone().multiplyScalar(sin));
  const rotZ = worldNormal.clone();

  const meshInverse = new THREE.Matrix4().copy(targetMesh.matrixWorld).invert();
  const objOrigin = worldOrigin.clone().applyMatrix4(meshInverse);
  const objX = rotX.transformDirection(meshInverse).normalize();
  const objY = rotY.transformDirection(meshInverse).normalize();
  const objZ = rotZ.transformDirection(meshInverse).normalize();

  const basis = new THREE.Matrix4().makeBasis(objX, objY, objZ);
  basis.setPosition(objOrigin);

  return {
    texture,
    inverseMatrix: basis.clone().invert(),
    size: new THREE.Vector2(width, height),
    depth,
    localNormal: objZ,
  };
}

/** Plano invisible solo para detectar clic/arrastre; el diseño visible lo pinta el shader */
function buildPickerMesh(
  parts: TShirtParts,
  id: string,
  texture: THREE.Texture,
  settings: DesignSettings
): THREE.Mesh {
  const { width, height } = getDesignDimensions(texture, settings.scale);
  const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `tshirt-design-${id}`;
  mesh.userData.designId = id;
  mesh.renderOrder = 10;

  const { position, normal } = getSurfaceAtOffset(parts, settings);
  mesh.position.copy(position);

  const { tangentX, tangentY, normal: n } = getAnchorBasis(normal);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangentX, tangentY, n));
  mesh.rotateZ(THREE.MathUtils.degToRad(settings.rotation));

  parts.group.add(mesh);
  return mesh;
}

function syncShaderDesigns(parts: TShirtParts): void {
  const slots: DesignShaderSlot[] = [];
  for (const entry of parts.designs.values()) {
    slots.push(buildDesignShaderSlot(parts, entry.texture, entry.settings));
  }
  parts.designShader.setSlots(slots);
}

export function createTShirtModel(garment: GarmentSettings): Promise<TShirtParts> {
  return loadTShirtModel(garment).then((loaded) => {
    // Instalamos el shader una sola vez. Con 0 diseños no pinta nada (la camiseta
    // se ve normal); así evitamos recompilar el material al añadir/quitar diseños.
    const designShader = new TShirtDesignShader();
    designShader.install(loaded.bodyMaterial);

    return {
      group: loaded.group,
      bodyMesh: loaded.bodyMesh,
      bodyMaterial: loaded.bodyMaterial,
      designs: new Map(),
      anchors: loaded.anchors,
      designShader,
    };
  });
}

export function updateGarmentColor(parts: TShirtParts, garment: GarmentSettings): void {
  parts.bodyMaterial.color.set(garment.color);
  parts.bodyMaterial.roughness = garment.roughness;
  parts.bodyMaterial.metalness = garment.metalness;
}

function disposePickerMesh(parts: TShirtParts, entry: DesignEntry): void {
  parts.group.remove(entry.pickerMesh);
  entry.pickerMesh.geometry.dispose();
  (entry.pickerMesh.material as THREE.Material).dispose();
}

function removeDesignEntry(parts: TShirtParts, id: string): void {
  const entry = parts.designs.get(id);
  if (!entry) return;
  disposePickerMesh(parts, entry);
  parts.designs.delete(id);
  syncShaderDesigns(parts);
}

export function upsertDesign(
  parts: TShirtParts,
  id: string,
  texture: THREE.Texture,
  settings: DesignSettings
): void {
  const existing = parts.designs.get(id);
  if (existing) disposePickerMesh(parts, existing);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  const pickerMesh = buildPickerMesh(parts, id, texture, settings);
  parts.designs.set(id, { pickerMesh, texture, settings: { ...settings } });
  syncShaderDesigns(parts);
}

export function updateDesignSettings(
  parts: TShirtParts,
  id: string,
  settings: DesignSettings
): void {
  const entry = parts.designs.get(id);
  if (!entry) return;

  disposePickerMesh(parts, entry);
  entry.settings = { ...settings };
  entry.pickerMesh = buildPickerMesh(parts, id, entry.texture, settings);
  syncShaderDesigns(parts);
}

export function removeDesign(parts: TShirtParts, id: string): void {
  removeDesignEntry(parts, id);
}

export function clearAllDesigns(parts: TShirtParts): void {
  [...parts.designs.keys()].forEach((id) => removeDesignEntry(parts, id));
}

export function getDesignMeshes(parts: TShirtParts): THREE.Mesh[] {
  return [...parts.designs.values()].map((e) => e.pickerMesh);
}

export function worldPointToOffsets(
  parts: TShirtParts,
  settings: DesignSettings,
  worldPoint: THREE.Vector3
): { offsetX: number; offsetY: number } {
  const anchor = getDesignAnchor(parts, settings);
  const localPoint = parts.group.worldToLocal(worldPoint.clone());
  const delta = localPoint.sub(anchor.position);
  const { tangentX, tangentY } = getAnchorBasis(anchor.normal);
  return {
    offsetX: delta.dot(tangentX),
    offsetY: delta.dot(tangentY),
  };
}

export function getDragPlaneNormal(parts: TShirtParts, settings: DesignSettings): THREE.Vector3 {
  const { normal } = getSurfaceAtOffset(parts, settings);
  return normal.clone().transformDirection(parts.group.matrixWorld).normalize();
}

export function getDragPlanePoint(parts: TShirtParts, settings: DesignSettings): THREE.Vector3 {
  const { position } = getSurfaceAtOffset(parts, settings);
  return position.clone().applyMatrix4(parts.group.matrixWorld);
}

export type { TShirtParts };
