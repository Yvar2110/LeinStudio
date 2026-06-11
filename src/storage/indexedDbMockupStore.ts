import { normalizeDesignSettings, type StudioState } from "../types";
import type { MockupRepository } from "./mockupRepository";
import type { SavedMockup, StoredMockupRecord } from "./mockupTypes";

const DB_NAME = "lein-studio";
const DB_VERSION = 1;
const MOCKUPS_STORE = "mockups";
const BLOBS_STORE = "blobs";
const LEGACY_STORAGE_KEY = "lein-saved-mockups";
const MAX_SAVED = 24;

function thumbKey(mockupId: string): string {
  return `thumb:${mockupId}`;
}

function designKey(mockupId: string, designId: string): string {
  return `design:${mockupId}:${designId}`;
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((response) => response.blob());
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MOCKUPS_STORE)) {
        db.createObjectStore(MOCKUPS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export class IndexedDbMockupStore implements MockupRepository {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    this.db = await openDb();
    await this.migrateFromLocalStorage();
  }

  private async readAllRecords(): Promise<StoredMockupRecord[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MOCKUPS_STORE, "readonly");
      const request = tx.objectStore(MOCKUPS_STORE).getAll();
      request.onsuccess = () => resolve(request.result as StoredMockupRecord[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async getBlob(key: string): Promise<Blob | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BLOBS_STORE, "readonly");
      const request = tx.objectStore(BLOBS_STORE).get(key);
      request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  private async putBlob(key: string, blob: Blob): Promise<void> {
    if (!this.db) throw new Error("Mockup storage not initialized");

    const tx = this.db.transaction(BLOBS_STORE, "readwrite");
    tx.objectStore(BLOBS_STORE).put(blob, key);
    await txDone(tx);
  }

  private async deleteBlobsForMockup(mockupId: string): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction(BLOBS_STORE, "readwrite");
    const store = tx.objectStore(BLOBS_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => {
        const prefix = `design:${mockupId}:`;
        for (const key of request.result as string[]) {
          if (key === thumbKey(mockupId) || key.startsWith(prefix)) {
            store.delete(key);
          }
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    await txDone(tx);
  }

  private async recordToMockup(record: StoredMockupRecord): Promise<SavedMockup> {
    const thumbBlob = await this.getBlob(thumbKey(record.id));
    const thumbnail = thumbBlob ? await blobToDataUrl(thumbBlob) : "";

    const designs = await Promise.all(
      record.designs.map(async (layer) => {
        const blob = await this.getBlob(designKey(record.id, layer.id));
        return {
          ...layer,
          settings: normalizeDesignSettings(layer.settings),
          imageDataUrl: blob ? await blobToDataUrl(blob) : undefined,
        };
      })
    );

    return {
      id: record.id,
      title: record.title,
      thumbnail,
      updatedAt: record.updatedAt,
      garmentColor: record.garmentColor,
      designs,
      activeDesignId: record.activeDesignId,
      scene: { ...record.scene },
    };
  }

  private async migrateFromLocalStorage(): Promise<void> {
    const existing = await this.readAllRecords();
    if (existing.length > 0) return;

    let legacy: SavedMockup[] = [];
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) legacy = JSON.parse(raw) as SavedMockup[];
    } catch {
      return;
    }

    if (!Array.isArray(legacy) || legacy.length === 0) return;

    for (const mockup of legacy) {
      const images = new Map<string, string>();
      for (const design of mockup.designs) {
        if (design.imageDataUrl) images.set(design.id, design.imageDataUrl);
      }
      await this.saveRecord(mockup, images, mockup.thumbnail);
    }

    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  private async saveRecord(
    mockup: Omit<SavedMockup, "designs"> & { designs: SavedMockup["designs"] },
    designImages: Map<string, string>,
    thumbnail: string
  ): Promise<void> {
    if (!this.db) throw new Error("Mockup storage not initialized");

    const record: StoredMockupRecord = {
      id: mockup.id,
      title: mockup.title,
      updatedAt: mockup.updatedAt,
      garmentColor: mockup.garmentColor,
      designs: mockup.designs.map(({ imageDataUrl: _img, ...layer }) => ({
        ...layer,
        settings: normalizeDesignSettings(layer.settings),
      })),
      activeDesignId: mockup.activeDesignId,
      scene: { ...mockup.scene },
    };

    const tx = this.db.transaction(MOCKUPS_STORE, "readwrite");
    tx.objectStore(MOCKUPS_STORE).put(record);
    await txDone(tx);

    if (thumbnail) {
      await this.putBlob(thumbKey(mockup.id), await dataUrlToBlob(thumbnail));
    }

    for (const layer of mockup.designs) {
      const dataUrl = designImages.get(layer.id) ?? layer.imageDataUrl;
      if (dataUrl) {
        await this.putBlob(designKey(mockup.id, layer.id), await dataUrlToBlob(dataUrl));
      }
    }
  }

  async list(): Promise<SavedMockup[]> {
    const records = await this.readAllRecords();
    const mockups = await Promise.all(records.map((record) => this.recordToMockup(record)));
    return mockups.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SAVED);
  }

  async get(id: string): Promise<SavedMockup | null> {
    if (!this.db) return null;

    const record = await new Promise<StoredMockupRecord | null>((resolve, reject) => {
      const tx = this.db!.transaction(MOCKUPS_STORE, "readonly");
      const request = tx.objectStore(MOCKUPS_STORE).get(id);
      request.onsuccess = () => resolve((request.result as StoredMockupRecord | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });

    if (!record) return null;
    return this.recordToMockup(record);
  }

  async save(
    state: StudioState,
    designImages: Map<string, string>,
    thumbnail: string,
    title?: string
  ): Promise<SavedMockup> {
    const mockup: SavedMockup = {
      id: crypto.randomUUID(),
      title: title?.trim() || `Diseño ${new Date().toLocaleDateString("es-ES")}`,
      thumbnail,
      updatedAt: Date.now(),
      garmentColor: state.garment.color,
      designs: state.designs.map((layer) => ({
        ...layer,
        imageDataUrl: designImages.get(layer.id) ?? "",
      })),
      activeDesignId: state.activeDesignId,
      scene: { ...state.scene },
    };

    await this.saveRecord(mockup, designImages, thumbnail);

    const records = await this.readAllRecords();
    const overflow = records
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(MAX_SAVED);

    for (const record of overflow) {
      await this.delete(record.id);
    }

    return mockup;
  }

  async delete(id: string): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction(MOCKUPS_STORE, "readwrite");
    tx.objectStore(MOCKUPS_STORE).delete(id);
    await txDone(tx);
    await this.deleteBlobsForMockup(id);
  }

  async getDesignImages(mockup: SavedMockup): Promise<Map<string, string>> {
    const images = new Map<string, string>();

    for (const layer of mockup.designs) {
      const blob = await this.getBlob(designKey(mockup.id, layer.id));
      if (blob) {
        images.set(layer.id, await blobToDataUrl(blob));
      } else if (layer.imageDataUrl) {
        images.set(layer.id, layer.imageDataUrl);
      }
    }

    return images;
  }
}
