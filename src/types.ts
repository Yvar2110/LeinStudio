export type DesignSide = "front" | "back";

export interface DesignSettings {
  side: DesignSide;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
}

export interface GarmentSettings {
  color: string;
  roughness: number;
  metalness: number;
}

export interface SceneSettings {
  backgroundColor: string;
  backgroundImage: string | null;
  autoRotate: boolean;
  windEffect: boolean;
  showGrid: boolean;
}

export interface StudioState {
  design: DesignSettings;
  garment: GarmentSettings;
  scene: SceneSettings;
}

export const DEFAULT_STATE: StudioState = {
  design: {
    side: "front",
    offsetX: 0,
    offsetY: 0,
    scale: 0.99,
    rotation: 0,
  },
  garment: {
    color: "#f5f5f0",
    roughness: 0.82,
    metalness: 0.02,
  },
  scene: {
    backgroundColor: "#1a1a22",
    backgroundImage: null,
    autoRotate: true,
    windEffect: false,
    showGrid: false,
  },
};
