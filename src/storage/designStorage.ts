import { normalizeDesignSettings, type StudioState } from "../types";
import { IndexedDbMockupStore } from "./indexedDbMockupStore";
import type { MockupRepository } from "./mockupRepository";
import type { SavedMockup } from "./mockupTypes";

export type { PersistedDesignLayer, SavedMockup } from "./mockupTypes";
export type { MockupRepository } from "./mockupRepository";

const store: MockupRepository = new IndexedDbMockupStore();
let initPromise: Promise<void> | null = null;

export function initMockupStorage(): Promise<void> {
  if (!initPromise) {
    initPromise = (store as IndexedDbMockupStore).init();
  }
  return initPromise;
}

export async function listSavedMockups(): Promise<SavedMockup[]> {
  await initMockupStorage();
  return store.list();
}

export async function getSavedMockup(id: string): Promise<SavedMockup | null> {
  await initMockupStorage();
  return store.get(id);
}

export async function deleteSavedMockup(id: string): Promise<void> {
  await initMockupStorage();
  return store.delete(id);
}

export async function persistMockup(
  state: StudioState,
  designImages: Map<string, string>,
  thumbnail: string,
  title?: string
): Promise<SavedMockup> {
  await initMockupStorage();
  return store.save(state, designImages, thumbnail, title);
}

export function savedMockupToState(mockup: SavedMockup): StudioState {
  return {
    designs: mockup.designs.map(({ imageDataUrl: _img, ...layer }) => ({
      ...layer,
      settings: normalizeDesignSettings(layer.settings),
    })),
    activeDesignId: mockup.activeDesignId,
    garment: {
      color: mockup.garmentColor,
      roughness: 0.82,
      metalness: 0.02,
    },
    scene: { ...mockup.scene },
  };
}

export async function getSavedDesignImages(mockup: SavedMockup): Promise<Map<string, string>> {
  await initMockupStorage();
  return store.getDesignImages(mockup);
}

export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/png" });
}

export async function urlToFile(url: string, name: string): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/svg+xml" });
}
