import { persistMockup, type SavedMockup } from "../storage/designStorage";
import { TShirtScene } from "../three/TShirtScene";
import {
  createDefaultDesignSettings,
  DEFAULT_STATE,
  MAX_DESIGNS,
  type DesignLayer,
  type DesignSettings,
  type StudioState,
} from "../types";
import { getDefaultActiveSettings, renderStudioShell } from "./studio/studioShell";

export interface StudioAppOptions {
  initialState?: StudioState;
  pendingFiles?: { id: string; file: File }[];
  onClose?: () => void;
  onSaved?: (mockup: SavedMockup) => void;
}
export class StudioApp {
  private root: HTMLElement;
  private options: StudioAppOptions;
  private state: StudioState;
  private scene: TShirtScene | null = null;
  private previewContainer!: HTMLElement;
  private designListEl!: HTMLElement;
  private uploadZoneEl!: HTMLElement;
  private designCountEl!: HTMLElement;
  private positionSectionEl!: HTMLElement;
  private designImageData = new Map<string, string>();
  private pendingFiles: { id: string; file: File }[] = [];
  private destroyed = false;

  constructor(root: HTMLElement, options: StudioAppOptions = {}) {
    this.root = root;
    this.options = options;
    this.state = structuredClone(options.initialState ?? DEFAULT_STATE);
    this.pendingFiles = options.pendingFiles ?? [];
    this.render();
    this.bindEvents();
    this.initScene();
  }

  destroy(): void {
    this.destroyed = true;
    this.scene?.dispose();
    this.scene = null;
    this.root.innerHTML = "";
  }

  private getActiveDesign(): DesignLayer | null {
    if (!this.state.activeDesignId) return null;
    return this.state.designs.find((d) => d.id === this.state.activeDesignId) ?? null;
  }

  private render(): void {
    const active = this.getActiveDesign();
    const activeSettings = active?.settings ?? getDefaultActiveSettings();

    this.root.innerHTML = renderStudioShell(
      this.state,
      activeSettings,
      !!this.options.onClose
    );

    this.previewContainer = this.root.querySelector("#preview-container")!;
    this.designListEl = this.root.querySelector("#design-list")!;
    this.uploadZoneEl = this.root.querySelector("#upload-zone")!;
    this.designCountEl = this.root.querySelector("#design-count")!;
    this.positionSectionEl = this.root.querySelector("#position-section")!;
    this.refreshDesignListUI();
    this.updatePositionSectionState();
  }

  private initScene(): void {
    const boot = async (): Promise<void> => {
      if (this.previewContainer.clientWidth === 0) {
        requestAnimationFrame(() => void boot());
        return;
      }

      this.previewContainer.classList.remove("viewport-error");
      this.previewContainer.innerHTML =
        '<div class="viewport-loading"><div class="viewport-spinner"></div><p>Cargando camiseta 3D…</p></div>';

      try {
        this.scene = await TShirtScene.create(
          this.previewContainer,
          this.state.garment,
          this.state.scene
        );
        this.scene.setCallbacks({
          onDesignChange: (id, settings) => this.handleDesignDrag(id, settings),
          onDesignSelect: (id) => this.selectDesign(id, false),
        });
        this.scene.setDesignLayers(this.state.designs);
        await this.loadPendingDesigns();
        this.previewContainer.querySelector(".viewport-loading")?.remove();
      } catch (error) {
        console.error(error);
        this.previewContainer.classList.add("viewport-error");
        this.previewContainer.innerHTML = `
          <div class="viewport-error-msg">
            <p>No se pudo cargar el modelo 3D.</p>
            <button type="button" class="btn btn-secondary btn-sm" id="retry-scene">Reintentar</button>
          </div>
        `;
        this.previewContainer
          .querySelector("#retry-scene")
          ?.addEventListener("click", () => {
            this.previewContainer.innerHTML = "";
            void this.initScene();
          });
      }
    };

    void boot();
  }

  private bindEvents(): void {
    const designInput = this.root.querySelector("#design-input") as HTMLInputElement;
    const browseBtn = this.root.querySelector("#browse-btn")!;
    const clearBtn = this.root.querySelector("#clear-designs") as HTMLButtonElement;

    browseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.state.designs.length >= MAX_DESIGNS) return;
      designInput.click();
    });

    this.uploadZoneEl.addEventListener("click", () => {
      if (this.state.designs.length >= MAX_DESIGNS) return;
      designInput.click();
    });

    this.uploadZoneEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (this.state.designs.length < MAX_DESIGNS) {
        this.uploadZoneEl.classList.add("dragover");
      }
    });
    this.uploadZoneEl.addEventListener("dragleave", () =>
      this.uploadZoneEl.classList.remove("dragover")
    );
    this.uploadZoneEl.addEventListener("drop", (e) => {
      e.preventDefault();
      this.uploadZoneEl.classList.remove("dragover");
      const files = [...((e as DragEvent).dataTransfer?.files ?? [])];
      if (files.length) void this.handleDesignUpload(files);
    });

    designInput.addEventListener("change", () => {
      const files = [...(designInput.files ?? [])];
      if (files.length) void this.handleDesignUpload(files);
      designInput.value = "";
    });

    clearBtn.addEventListener("click", () => this.clearAllDesigns());

    this.bindSlider("offset-x", (v) => this.updateActiveDesignSetting({ offsetX: v }));
    this.bindSlider("offset-y", (v) => this.updateActiveDesignSetting({ offsetY: v }));
    this.bindSlider("design-scale", (v) => this.updateActiveDesignSetting({ scale: v }));
    this.bindSlider("design-rotation", (v) => this.updateActiveDesignSetting({ rotation: v }), "°");

    this.root.querySelectorAll(".side-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const side = (btn as HTMLElement).dataset.side as "front" | "back";
        if (!side) return;
        this.updateActiveDesignSetting({ side });
        this.root.querySelectorAll(".side-btn").forEach((b) => {
          b.classList.toggle("active", (b as HTMLElement).dataset.side === side);
        });
      });
    });

    const garmentColor = this.root.querySelector("#garment-color") as HTMLInputElement;
    const garmentHex = this.root.querySelector("#garment-hex") as HTMLInputElement;

    const updateGarment = () => {
      this.scene?.setGarment(this.state.garment);
    };

    garmentColor.addEventListener("input", () => {
      this.state.garment.color = garmentColor.value;
      garmentHex.value = garmentColor.value;
      updateGarment();
    });

    garmentHex.addEventListener("change", () => {
      const val = garmentHex.value;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        this.state.garment.color = val;
        garmentColor.value = val;
        updateGarment();
      } else {
        garmentHex.value = this.state.garment.color;
      }
    });

    this.bindSlider("roughness", (v) => {
      this.state.garment.roughness = v;
      updateGarment();
    });

    this.root.querySelectorAll(".color-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        const color = (btn as HTMLElement).dataset.color!;
        this.state.garment.color = color;
        garmentColor.value = color;
        garmentHex.value = color;
        updateGarment();
      });
    });

    this.root.querySelector("#auto-rotate")!.addEventListener("change", (e) => {
      this.state.scene.autoRotate = (e.target as HTMLInputElement).checked;
      this.scene?.setSceneSettings(this.state.scene);
    });

    this.root.querySelector("#wind-effect")!.addEventListener("change", (e) => {
      this.state.scene.windEffect = (e.target as HTMLInputElement).checked;
      this.scene?.setSceneSettings(this.state.scene);
    });

    this.root.querySelector("#show-grid")!.addEventListener("change", (e) => {
      this.state.scene.showGrid = (e.target as HTMLInputElement).checked;
      this.scene?.setSceneSettings(this.state.scene);
    });

    this.root.querySelectorAll(".bg-preset").forEach((btn) => {
      btn.addEventListener("click", () => {
        const bg = (btn as HTMLElement).dataset.bg!;
        this.state.scene.backgroundColor = bg;
        this.state.scene.backgroundImage = null;
        this.scene?.setSceneSettings(this.state.scene);
      });
    });

    const bgInput = this.root.querySelector("#bg-input") as HTMLInputElement;
    this.root.querySelector("#bg-browse")!.addEventListener("click", () => bgInput.click());
    bgInput.addEventListener("change", () => {
      const file = bgInput.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      this.state.scene.backgroundImage = url;
      this.scene?.setSceneSettings(this.state.scene);
    });

    this.options.onClose &&
      this.root.querySelector("#close-editor")!.addEventListener("click", () => {
        this.options.onClose?.();
      });

    this.root.querySelector("#save-design")!.addEventListener("click", () => {
      void this.saveDesign();
    });

    this.root.querySelector("#reset-camera")!.addEventListener("click", () => {
      this.scene?.resetCamera();
    });

    this.root.querySelector("#export-png")!.addEventListener("click", () => {
      const dataUrl = this.scene?.exportImage();
      if (!dataUrl) return;
      const link = document.createElement("a");
      link.download = `lein-mockup-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    });

    this.bindVideoExport();
  }

  private bindVideoExport(): void {
    const button = this.root.querySelector("#export-video") as HTMLButtonElement;
    const label = this.root.querySelector("#export-video-label") as HTMLElement;

    if (!TShirtScene.isVideoExportSupported()) {
      button.disabled = true;
      button.title = "Tu navegador no permite grabar video del lienzo";
      return;
    }

    button.addEventListener("click", async () => {
      if (!this.scene || button.disabled) return;

      const originalText = label.textContent;
      button.disabled = true;
      label.textContent = "Grabando…";

      try {
        const { blob, mimeType } = await this.scene.recordVideo();
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `lein-mockup-${Date.now()}.${ext}`;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        console.error(error);
        alert("No se pudo grabar el video en este navegador.");
      } finally {
        button.disabled = false;
        label.textContent = originalText;
      }
    });
  }

  private bindSlider(
    id: string,
    onChange: (value: number) => void,
    suffix = ""
  ): void {
    const input = this.root.querySelector(`#${id}`) as HTMLInputElement;
    const output = this.root.querySelector(`#${id}-out`)!;
    input.addEventListener("input", () => {
      const val = parseFloat(input.value);
      const step = parseFloat(input.step);
      output.textContent = `${val.toFixed(step < 1 ? 2 : 0)}${suffix}`;
      onChange(val);
    });
  }

  private updateActiveDesignSetting(partial: Partial<DesignSettings>): void {
    const active = this.getActiveDesign();
    if (!active || active.settings.locked) return;

    Object.assign(active.settings, partial);
    this.scene?.updateDesign(active.id, active.settings);
  }

  private handleDesignDrag(id: string, settings: DesignSettings): void {
    const layer = this.state.designs.find((d) => d.id === id);
    if (!layer || layer.settings.locked) return;

    layer.settings = { ...settings, locked: layer.settings.locked };
    if (this.state.activeDesignId === id) {
      this.syncSlidersFromActiveDesign();
    }
  }

  private selectDesign(id: string, syncScene = true): void {
    if (!this.state.designs.some((d) => d.id === id)) return;
    this.state.activeDesignId = id;
    this.refreshDesignListUI();
    this.syncSlidersFromActiveDesign();
    this.updatePositionSectionState();
    if (syncScene) {
      // selección solo visual; la escena ya conoce el diseño activo vía UI
    }
  }

  private syncSlidersFromActiveDesign(): void {
    const active = this.getActiveDesign();
    if (!active) return;

    const { offsetX, offsetY, scale, rotation, side } = active.settings;

    const setSlider = (id: string, value: number, suffix = "") => {
      const input = this.root.querySelector(`#${id}`) as HTMLInputElement | null;
      const output = this.root.querySelector(`#${id}-out`);
      if (!input || !output) return;
      input.value = String(value);
      const step = parseFloat(input.step);
      output.textContent = `${value.toFixed(step < 1 ? 2 : 0)}${suffix}`;
    };

    setSlider("offset-x", offsetX);
    setSlider("offset-y", offsetY);
    setSlider("design-scale", scale);
    setSlider("design-rotation", rotation, "°");

    this.root.querySelectorAll(".side-btn").forEach((btn) => {
      btn.classList.toggle("active", (btn as HTMLElement).dataset.side === side);
    });
  }

  private async loadPendingDesigns(): Promise<void> {
    if (!this.scene || this.pendingFiles.length === 0) return;

    const files = [...this.pendingFiles];
    this.pendingFiles = [];

    for (const { id, file } of files) {
      try {
        await this.scene.loadDesignImage(id, file);
        await this.cacheDesignImage(id, file);
      } catch (error) {
        console.error(error);
        this.state.designs = this.state.designs.filter((d) => d.id !== id);
        if (this.state.activeDesignId === id) {
          this.state.activeDesignId = this.state.designs.at(-1)?.id ?? null;
        }
        this.scene.setDesignLayers(this.state.designs);
      }
    }

    this.refreshDesignListUI();
    this.syncSlidersFromActiveDesign();
    this.updatePositionSectionState();
  }

  private async cacheDesignImage(id: string, file: File): Promise<void> {
    const dataUrl = await this.fileToDataUrl(file);
    this.designImageData.set(id, dataUrl);
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async saveDesign(): Promise<void> {
    if (!this.scene || this.state.designs.length === 0) return;

    const saveBtn = this.root.querySelector("#save-design") as HTMLButtonElement;
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando…";

    try {
      const thumbnail = this.scene.exportImage() ?? "";
      const saved = await persistMockup(this.state, this.designImageData, thumbnail);
      this.options.onSaved?.(saved);
      saveBtn.textContent = "Guardado ✓";
      setTimeout(() => {
        if (!this.destroyed) {
          saveBtn.textContent = originalText;
          saveBtn.disabled = this.state.designs.length === 0;
        }
      }, 2000);
    } catch (error) {
      console.error(error);
      alert("No se pudo guardar el diseño.");
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  }

  private refreshDesignListUI(): void {
    const clearBtn = this.root.querySelector("#clear-designs") as HTMLButtonElement;
    const saveBtn = this.root.querySelector("#save-design") as HTMLButtonElement | null;
    const atMax = this.state.designs.length >= MAX_DESIGNS;

    this.designCountEl.textContent = `${this.state.designs.length}/${MAX_DESIGNS}`;
    clearBtn.disabled = this.state.designs.length === 0;
    if (saveBtn) saveBtn.disabled = this.state.designs.length === 0;
    this.uploadZoneEl.classList.toggle("upload-zone-full", atMax);

    if (this.state.designs.length === 0) {
      this.designListEl.innerHTML = `<p class="design-list-empty">Sin diseños cargados</p>`;
      return;
    }

    this.designListEl.innerHTML = this.state.designs
      .map(
        (d) => `
        <div class="design-item ${d.id === this.state.activeDesignId ? "active" : ""} ${d.settings.locked ? "is-locked" : ""}" data-id="${d.id}">
          <button type="button" class="design-item-select" data-id="${d.id}">
            <span class="design-item-name">${this.escapeHtml(d.name)}</span>
            <span class="design-item-side">${d.settings.side === "front" ? "Frente" : "Espalda"}${d.settings.locked ? " · Fijado" : ""}</span>
          </button>
          <button type="button" class="design-item-lock ${d.settings.locked ? "is-locked" : ""}" data-id="${d.id}" title="${d.settings.locked ? "Desfijar posición" : "Fijar posición"}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              ${
                d.settings.locked
                  ? `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`
                  : `<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a3 3 0 0 0-6 0v3.76"/>`
              }
            </svg>
          </button>
          <button type="button" class="design-item-remove" data-id="${d.id}" title="Quitar">×</button>
        </div>
      `
      )
      .join("");

    this.designListEl.querySelectorAll(".design-item-select").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = (btn as HTMLElement).dataset.id!;
        this.selectDesign(id);
      });
    });

    this.designListEl.querySelectorAll(".design-item-lock").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id!;
        this.toggleDesignLock(id);
      });
    });

    this.designListEl.querySelectorAll(".design-item-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id!;
        this.removeDesign(id);
      });
    });
  }

  private toggleDesignLock(id: string): void {
    const layer = this.state.designs.find((d) => d.id === id);
    if (!layer) return;

    layer.settings.locked = !layer.settings.locked;
    this.scene?.updateDesign(id, layer.settings);
    this.refreshDesignListUI();

    if (this.state.activeDesignId === id) {
      this.updatePositionSectionState();
    }
  }

  private updatePositionSectionState(): void {
    const active = this.getActiveDesign();
    const hasActive = !!active;
    const isLocked = active?.settings.locked ?? false;

    this.positionSectionEl.classList.toggle("is-disabled", !hasActive);
    this.positionSectionEl.classList.toggle("is-locked", isLocked);
    this.positionSectionEl.querySelectorAll("input, button").forEach((el) => {
      (el as HTMLInputElement).disabled = !hasActive || isLocked;
    });

    const hint = this.positionSectionEl.querySelector(".field-hint");
    if (hint) {
      hint.textContent = isLocked
        ? "Diseño fijado — usa el candado en la lista para moverlo de nuevo"
        : "También puedes arrastrar el diseño directamente en la vista 3D";
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private async handleDesignUpload(files: File[]): Promise<void> {
    if (!this.scene) return;

    const imageFiles = files.filter(
      (file) =>
        file.type.startsWith("image/") || /\.(png|jpe?g|webp|svg)$/i.test(file.name)
    );

    if (imageFiles.length === 0) {
      return;
    }

    const slotsLeft = MAX_DESIGNS - this.state.designs.length;
    if (slotsLeft <= 0) return;

    for (const file of imageFiles.slice(0, slotsLeft)) {
      const id = crypto.randomUUID();
      const settings = createDefaultDesignSettings();

      // Escalonar cada diseño nuevo para que no quede exactamente encima del anterior
      const step = this.state.designs.length;
      if (step > 0) {
        const clamp = (v: number, min: number, max: number) =>
          Math.min(max, Math.max(min, v));
        settings.offsetX = clamp(((step % 3) - 1) * 0.1, -0.2, 0.2);
        settings.offsetY = clamp(-Math.floor(step / 3) * 0.1, -0.25, 0.25);
      }

      const layer: DesignLayer = {
        id,
        name: file.name,
        settings,
      };

      this.state.designs.push(layer);
      this.state.activeDesignId = id;
      this.scene.setDesignLayers(this.state.designs);

      try {
        await this.scene.loadDesignImage(id, file);
        await this.cacheDesignImage(id, file);
      } catch (error) {
        console.error(error);
        this.state.designs = this.state.designs.filter((d) => d.id !== id);
        this.state.activeDesignId = this.state.designs.at(-1)?.id ?? null;
        this.scene.setDesignLayers(this.state.designs);
      }
    }

    this.refreshDesignListUI();
    this.syncSlidersFromActiveDesign();
    this.updatePositionSectionState();
  }

  private removeDesign(id: string): void {
    this.scene?.removeDesign(id);
    this.designImageData.delete(id);
    this.state.designs = this.state.designs.filter((d) => d.id !== id);

    if (this.state.activeDesignId === id) {
      this.state.activeDesignId = this.state.designs.at(-1)?.id ?? null;
    }

    this.scene?.setDesignLayers(this.state.designs);
    this.refreshDesignListUI();
    this.syncSlidersFromActiveDesign();
    this.updatePositionSectionState();
  }

  private clearAllDesigns(): void {
    this.scene?.clearAllDesigns();
    this.designImageData.clear();
    this.state.designs = [];
    this.state.activeDesignId = null;
    this.refreshDesignListUI();
    this.updatePositionSectionState();
  }
}
