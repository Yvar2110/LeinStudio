import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  clearAllDesigns as clearAllDesignMeshes,
  createTShirtModel,
  getDesignMeshes,
  getDragPlaneNormal,
  getDragPlanePoint,
  removeDesign as removeDesignMesh,
  updateDesignSettings,
  updateGarmentColor,
  upsertDesign,
  worldPointToOffsets,
  type TShirtParts,
} from "./TShirtModel";
import type { DesignLayer, DesignSettings, GarmentSettings, SceneSettings } from "../types";

const VT_CAMERA_FOV = THREE.MathUtils.radToDeg(0.503);

export class TShirtScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private parts!: TShirtParts;
  private baseGroupY = 0;
  private designTextures = new Map<string, THREE.Texture>();
  private backgroundTexture: THREE.Texture | null = null;
  private clock = new THREE.Clock();
  private animationId = 0;
  private container: HTMLElement;
  private gridHelper!: THREE.GridHelper;
  private platform!: THREE.Mesh;

  private sceneSettings: SceneSettings;
  private layers: DesignLayer[] = [];
  private onDesignChange?: (id: string, settings: DesignSettings) => void;
  private onDesignSelect?: (id: string) => void;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private dragPlane = new THREE.Plane();
  private dragWorldPoint = new THREE.Vector3();
  private draggingId: string | null = null;
  private isDragging = false;

  private isRecording = false;
  private recordAngle = 0;

  private constructor(container: HTMLElement, sceneSettings: SceneSettings) {
    this.container = container;
    this.sceneSettings = { ...sceneSettings };

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(sceneSettings.backgroundColor);
    this.scene.fog = new THREE.FogExp2(sceneSettings.backgroundColor, 0.06);

    this.camera = new THREE.PerspectiveCamera(VT_CAMERA_FOV, width / height, 0.1, 100);
    this.camera.position.set(0, 0.08, 2.05);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.35;
    this.controls.maxDistance = 4.2;
    this.controls.maxPolarAngle = Math.PI * 0.88;
    this.controls.target.set(0, 0.02, 0);

    this.setupLighting();
    this.setupEnvironment();
    this.setupDesignDrag();

    this.platform = this.createPlatform();
    this.scene.add(this.platform);

    this.gridHelper = new THREE.GridHelper(4, 20, 0x444466, 0x2a2a3a);
    this.gridHelper.position.y = -0.54;
    this.gridHelper.visible = sceneSettings.showGrid;
    this.scene.add(this.gridHelper);

    window.addEventListener("resize", this.handleResize);
    this.animate();
  }

  static async create(
    container: HTMLElement,
    garment: GarmentSettings,
    sceneSettings: SceneSettings
  ): Promise<TShirtScene> {
    const instance = new TShirtScene(container, sceneSettings);
    instance.parts = await createTShirtModel(garment);
    instance.scene.add(instance.parts.group);
    instance.baseGroupY = instance.parts.group.position.y;
    return instance;
  }

  setCallbacks(callbacks: {
    onDesignChange?: (id: string, settings: DesignSettings) => void;
    onDesignSelect?: (id: string) => void;
  }): void {
    this.onDesignChange = callbacks.onDesignChange;
    this.onDesignSelect = callbacks.onDesignSelect;
  }

  private setupDesignDrag(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerUp);
  }

  private updatePointer(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private getLayerSettings(id: string): DesignSettings | null {
    return this.layers.find((l) => l.id === id)?.settings ?? null;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.parts || event.button !== 0) return;

    this.updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(getDesignMeshes(this.parts), false);
    if (hits.length === 0) return;

    // Solo se puede agarrar un diseño cuya cara mire hacia la cámara: así no se
    // arrastra el diseño de la espalda mientras vemos el frente, ni viceversa.
    const surfaceNormal = new THREE.Vector3();
    const toCamera = new THREE.Vector3();
    let hit: THREE.Intersection | null = null;
    for (const candidate of hits) {
      const mesh = candidate.object as THREE.Mesh;
      mesh.updateMatrixWorld();
      const e = mesh.matrixWorld.elements;
      surfaceNormal.set(e[8], e[9], e[10]).normalize();
      toCamera.copy(this.camera.position).sub(candidate.point);
      if (surfaceNormal.dot(toCamera) > 0) {
        hit = candidate;
        break;
      }
    }
    if (!hit) return;

    const id = hit.object.userData.designId as string;
    const settings = this.getLayerSettings(id);
    if (!settings || settings.locked) return;

    event.preventDefault();
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.draggingId = id;
    this.isDragging = true;
    this.controls.enabled = false;
    this.renderer.domElement.style.cursor = "grabbing";
    this.onDesignSelect?.(id);

    const planeNormal = getDragPlaneNormal(this.parts, settings);
    const planePoint = getDragPlanePoint(this.parts, settings);
    this.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, planePoint);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.isDragging || !this.draggingId || !this.parts) return;

    const settings = this.getLayerSettings(this.draggingId);
    if (!settings || settings.locked) return;

    this.updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.dragWorldPoint)) return;

    const { offsetX, offsetY } = worldPointToOffsets(
      this.parts,
      settings,
      this.dragWorldPoint
    );

    const next: DesignSettings = {
      ...settings,
      offsetX: THREE.MathUtils.clamp(offsetX, -0.35, 0.35),
      offsetY: THREE.MathUtils.clamp(offsetY, -0.3, 0.35),
    };

    const layer = this.layers.find((l) => l.id === this.draggingId);
    if (layer) layer.settings = next;

    updateDesignSettings(this.parts, this.draggingId, next);
    this.onDesignChange?.(this.draggingId, next);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.isDragging) return;

    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }

    this.isDragging = false;
    this.draggingId = null;
    this.controls.enabled = true;
    this.renderer.domElement.style.cursor = "";
  };

  private setupLighting(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.55);
    keyLight.position.set(1.8, 3.5, 2.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 12;
    keyLight.shadow.camera.left = -1.5;
    keyLight.shadow.camera.right = 1.5;
    keyLight.shadow.camera.top = 1.5;
    keyLight.shadow.camera.bottom = -1.5;
    keyLight.shadow.bias = -0.0003;
    this.scene.add(keyLight);

    this.scene.add(new THREE.DirectionalLight(0xd0dcff, 0.65).translateX(-2.8).translateY(1.5));
    this.scene.add(new THREE.DirectionalLight(0xffffff, 0.4).translateZ(-3).translateY(0.5));
    this.scene.add(new THREE.HemisphereLight(0xe8eeff, 0x2a2a32, 0.4));
  }

  private setupEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x9090a0);
    envScene.add(new THREE.AmbientLight(0xffffff, 0.8));
    this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
  }

  private createPlatform(): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 64),
      new THREE.MeshStandardMaterial({ color: 0x22222c, roughness: 0.88, metalness: 0.12 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.54;
    mesh.receiveShadow = true;
    return mesh;
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const elapsed = this.clock.getElapsedTime();

    if (this.parts) {
      if (this.isRecording) {
        this.parts.group.rotation.y = this.recordAngle;
      } else if (this.sceneSettings.autoRotate && !this.isDragging) {
        this.parts.group.rotation.y = elapsed * 0.35;
      }

      if (this.sceneSettings.windEffect) {
        this.parts.group.rotation.z = Math.sin(elapsed * 1.8) * 0.035;
        this.parts.group.position.y = this.baseGroupY + Math.sin(elapsed * 2.2) * 0.012;
      } else {
        this.parts.group.rotation.z = THREE.MathUtils.lerp(this.parts.group.rotation.z, 0, 0.08);
        this.parts.group.position.y = THREE.MathUtils.lerp(
          this.parts.group.position.y,
          this.baseGroupY,
          0.08
        );
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private syncDesignMeshes(): void {
    if (!this.parts) return;
    clearAllDesignMeshes(this.parts);
    for (const layer of this.layers) {
      const texture = this.designTextures.get(layer.id);
      if (texture) upsertDesign(this.parts, layer.id, texture, layer.settings);
    }
  }

  setGarment(garment: GarmentSettings): void {
    if (this.parts) updateGarmentColor(this.parts, garment);
  }

  setDesignLayers(layers: DesignLayer[]): void {
    this.layers = layers.map((l) => ({
      ...l,
      settings: { ...l.settings },
    }));
    this.syncDesignMeshes();
  }

  updateDesign(id: string, settings: DesignSettings): void {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) return;
    layer.settings = { ...settings };
    if (this.parts) updateDesignSettings(this.parts, id, layer.settings);
  }

  loadDesignImage(id: string, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const existing = this.designTextures.get(id);
          if (existing) existing.dispose();

          // Las imágenes muy grandes superan el tamaño máximo de textura de la GPU
          // y se ven como un parche negro: las reducimos a un máximo seguro.
          const source = this.normalizeImageSize(img);

          const texture = new THREE.Texture(source);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          texture.needsUpdate = true;
          this.designTextures.set(id, texture);

          const layer = this.layers.find((l) => l.id === id);
          if (layer && this.parts) {
            upsertDesign(this.parts, id, texture, layer.settings);
          }
          resolve();
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private normalizeImageSize(img: HTMLImageElement): HTMLImageElement | HTMLCanvasElement {
    const maxSize = Math.min(2048, this.renderer.capabilities.maxTextureSize || 2048);
    const largest = Math.max(img.width, img.height);
    if (largest <= maxSize) return img;

    const ratio = maxSize / largest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * ratio));
    canvas.height = Math.max(1, Math.round(img.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return img;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  removeDesign(id: string): void {
    const texture = this.designTextures.get(id);
    if (texture) {
      texture.dispose();
      this.designTextures.delete(id);
    }
    this.layers = this.layers.filter((l) => l.id !== id);
    if (this.parts) removeDesignMesh(this.parts, id);
  }

  clearAllDesigns(): void {
    this.designTextures.forEach((t) => t.dispose());
    this.designTextures.clear();
    this.layers = [];
    if (this.parts) clearAllDesignMeshes(this.parts);
  }

  setSceneSettings(settings: SceneSettings): void {
    this.sceneSettings = { ...settings };

    if (settings.backgroundImage) {
      new THREE.TextureLoader().load(settings.backgroundImage, (texture) => {
        if (this.backgroundTexture) this.backgroundTexture.dispose();
        this.backgroundTexture = texture;
        texture.colorSpace = THREE.SRGBColorSpace;
        this.scene.background = texture;
        this.scene.fog = null;
      });
    } else {
      if (this.backgroundTexture) {
        this.backgroundTexture.dispose();
        this.backgroundTexture = null;
      }
      this.scene.background = new THREE.Color(settings.backgroundColor);
      this.scene.fog = new THREE.FogExp2(settings.backgroundColor, 0.06);
    }

    if (this.gridHelper) this.gridHelper.visible = settings.showGrid;
  }

  resetCamera(): void {
    this.camera.position.set(0, 0.08, 2.05);
    this.controls.target.set(0, 0.02, 0);
    this.controls.update();
  }

  exportImage(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  static isVideoExportSupported(): boolean {
    return (
      typeof MediaRecorder !== "undefined" &&
      typeof HTMLCanvasElement.prototype.captureStream === "function"
    );
  }

  private pickVideoMimeType(): string {
    // Preferimos MP4 (H.264) si el navegador lo soporta de forma nativa.
    const candidates = [
      "video/mp4;codecs=avc1.640033",
      "video/mp4;codecs=avc1.4d002a",
      "video/mp4;codecs=h264",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "video/webm";
  }

  /** Graba un giro completo (360°) de la camiseta configurada y devuelve el video. */
  recordVideo(
    durationMs = 6000,
    fps = 60,
    resolutionLongSide = 2160
  ): Promise<{ blob: Blob; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!TShirtScene.isVideoExportSupported()) {
        reject(new Error("La grabación de video no está soportada en este navegador"));
        return;
      }

      // Subimos la resolución interna de render para más detalle, sin cambiar el
      // tamaño visible del lienzo (updateStyle = false).
      const prevPixelRatio = this.renderer.getPixelRatio();
      const prevAspect = this.camera.aspect;
      const containerAspect =
        this.container.clientWidth / Math.max(this.container.clientHeight, 1);
      let renderW: number;
      let renderH: number;
      if (containerAspect >= 1) {
        renderW = resolutionLongSide;
        renderH = Math.round(resolutionLongSide / containerAspect);
      } else {
        renderH = resolutionLongSide;
        renderW = Math.round(resolutionLongSide * containerAspect);
      }

      this.renderer.setPixelRatio(1);
      this.renderer.setSize(renderW, renderH, false);
      this.camera.aspect = renderW / renderH;
      this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera);

      const canvas = this.renderer.domElement;
      const stream = canvas.captureStream(fps);
      const mimeType = this.pickVideoMimeType();

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 80_000_000,
        });
      } catch (error) {
        this.renderer.setPixelRatio(prevPixelRatio);
        this.camera.aspect = prevAspect;
        this.camera.updateProjectionMatrix();
        this.handleResize();
        reject(error as Error);
        return;
      }

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const startRotation = this.parts ? this.parts.group.rotation.y : 0;
      const wasAutoRotate = this.sceneSettings.autoRotate;
      this.sceneSettings.autoRotate = false;
      this.controls.enabled = false;
      this.isRecording = true;
      this.recordAngle = startRotation;

      const cleanup = () => {
        this.isRecording = false;
        this.controls.enabled = true;
        this.sceneSettings.autoRotate = wasAutoRotate;
        if (this.parts) this.parts.group.rotation.y = startRotation;
        // Restaurar resolución de pantalla
        this.renderer.setPixelRatio(prevPixelRatio);
        this.camera.aspect = prevAspect;
        this.camera.updateProjectionMatrix();
        this.handleResize();
      };

      recorder.onstop = () => {
        cleanup();
        resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType });
      };
      recorder.onerror = () => {
        cleanup();
        reject(new Error("Error durante la grabación del video"));
      };

      recorder.start();

      const start = performance.now();
      const tick = () => {
        const progress = (performance.now() - start) / durationMs;
        if (progress >= 1) {
          this.recordAngle = startRotation + Math.PI * 2;
          if (recorder.state !== "inactive") recorder.stop();
          return;
        }
        this.recordAngle = startRotation + progress * Math.PI * 2;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.handleResize);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.removeEventListener("pointerleave", this.onPointerUp);
    this.controls.dispose();
    this.renderer.dispose();
    this.designTextures.forEach((t) => t.dispose());
    if (this.backgroundTexture) this.backgroundTexture.dispose();
  }
}
