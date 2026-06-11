import type { StudioState } from "../types";
import type { SavedMockup } from "./mockupTypes";

export interface MockupRepository {
  list(): Promise<SavedMockup[]>;
  get(id: string): Promise<SavedMockup | null>;
  save(
    state: StudioState,
    designImages: Map<string, string>,
    thumbnail: string,
    title?: string
  ): Promise<SavedMockup>;
  delete(id: string): Promise<void>;
  getDesignImages(mockup: SavedMockup): Promise<Map<string, string>>;
}
