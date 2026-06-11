import type { DesignLayer, StudioState } from "../types";

export interface PersistedDesignLayer extends DesignLayer {
  imageDataUrl?: string;
}

export interface SavedMockup {
  id: string;
  title: string;
  thumbnail: string;
  updatedAt: number;
  garmentColor: string;
  designs: PersistedDesignLayer[];
  activeDesignId: string | null;
  scene: StudioState["scene"];
}

export interface StoredMockupRecord {
  id: string;
  title: string;
  updatedAt: number;
  garmentColor: string;
  designs: DesignLayer[];
  activeDesignId: string | null;
  scene: StudioState["scene"];
}
