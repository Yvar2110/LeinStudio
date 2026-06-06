import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  applyDesignTexture,
  createTShirtModel,
  updateGarmentColor,
  type TShirtParts,
} from "./TShirtModel";
import type { DesignSettings, GarmentSettings, SceneSettings } from "../types";

/** Ajustes de cámara inspirados en VirtualThreads (Verge3D) */
const VT_CAMERA_FOV = THREE.MathUtils.radToDeg(0.503);

export class TShirtScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private parts!: TShirtParts;
  private baseGroupY = 0;
  private designTexture: THREE.Texture | null = null;
  private backgroundTexture: THREE.Texture | null = null;
  private clock = new THREE.Clock();
  private animationId = 0;
  private container: HTMLElement;
  private gridHelper!: THREE.GridHelper;
  private platform!: THREE.Mesh;

  private sceneSettings: SceneSettings;
  private designSettings: DesignSettings;

  private constructor(container: HTMLElement, sceneSettings: SceneSettings) {
    this.container = container;
    this.sceneSettings = { ...sceneSettings };
    this.designSettings = {
      side: "front",
      offsetX: 0,
      offsetY: 0,
      scale: 0.99,
      rotation: 0,
    };

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

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

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

    const fillLight = new THREE.DirectionalLight(0xd0dcff, 0.65);
    fillLight.position.set(-2.8, 1.5, -0.5);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, 0.5, -3);
    this.scene.add(rimLight);

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
      new THREE.MeshStandardMaterial({
        color: 0x22222c,
        roughness: 0.88,
        metalness: 0.12,
      })
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
      if (this.sceneSettings.autoRotate) {
        this.parts.group.rotation.y = elapsed * 0.35;
      }

      if (this.sceneSettings.windEffect) {
        this.parts.group.rotation.z = Math.sin(elapsed * 1.8) * 0.035;
        this.parts.group.position.y =
          this.baseGroupY + Math.sin(elapsed * 2.2) * 0.012;
      } else {
        this.parts.group.rotation.z = THREE.MathUtils.lerp(
          this.parts.group.rotation.z,
          0,
          0.08
        );
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

  setGarment(garment: GarmentSettings): void {
    if (this.parts) updateGarmentColor(this.parts, garment);
  }

  setDesign(settings: DesignSettings): void {
    this.designSettings = { ...settings };
    if (this.parts) {
      applyDesignTexture(this.parts, this.designTexture, this.designSettings);
    }
  }

  loadDesignImage(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          if (this.designTexture) this.designTexture.dispose();
          this.designTexture = new THREE.Texture(img);
          this.designTexture.needsUpdate = true;
          if (this.parts) {
            applyDesignTexture(this.parts, this.designTexture, this.designSettings);
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

  clearDesign(): void {
    if (this.designTexture) {
      this.designTexture.dispose();
      this.designTexture = null;
    }
    if (this.parts) applyDesignTexture(this.parts, null, this.designSettings);
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

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.handleResize);
    this.controls.dispose();
    this.renderer.dispose();
    if (this.designTexture) this.designTexture.dispose();
    if (this.backgroundTexture) this.backgroundTexture.dispose();
  }
}
