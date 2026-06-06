export type DesignSide = "front" | "back";

export const MAX_DESIGNS = 5;

export interface DesignSettings {
  side: DesignSide;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
}

export interface DesignLayer {
  id: string;
  name: string;
  settings: DesignSettings;
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
  designs: DesignLayer[];
  activeDesignId: string | null;
  garment: GarmentSettings;
  scene: SceneSettings;
}

export function createDefaultDesignSettings(): DesignSettings {
  return {
    side: "front",
    offsetX: 0,
    offsetY: 0,
    scale: 0.55,
    rotation: 0,
  };
}

export const DEFAULT_STATE: StudioState = {
  designs: [],
  activeDesignId: null,
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
