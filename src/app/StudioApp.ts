import { TShirtScene } from "../three/TShirtScene";
import {
  createDefaultDesignSettings,
  DEFAULT_STATE,
  MAX_DESIGNS,
  type DesignLayer,
  type DesignSettings,
  type StudioState,
} from "../types";

const PRESET_COLORS = [
  "#f5f5f0",
  "#ffffff",
  "#1a1a1a",
  "#2d4a3e",
  "#1e3a5f",
  "#8b2942",
  "#e8c547",
  "#c4a484",
  "#6b7280",
  "#7c3aed",
];

const BG_PRESETS = [
  { label: "Oscuro", value: "#1a1a22" },
  { label: "Estudio", value: "#2a2a32" },
  { label: "Blanco", value: "#f0f0f5" },
  { label: "Azul", value: "#0f172a" },
  { label: "Arena", value: "#d4c4a8" },
];

export class StudioApp {
  private root: HTMLElement;
  private state: StudioState = structuredClone(DEFAULT_STATE);
  private scene: TShirtScene | null = null;
  private previewContainer!: HTMLElement;
  private designListEl!: HTMLElement;
  private uploadZoneEl!: HTMLElement;
  private designCountEl!: HTMLElement;
  private positionSectionEl!: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.render();
    this.bindEvents();
    this.initScene();
  }

  private getActiveDesign(): DesignLayer | null {
    if (!this.state.activeDesignId) return null;
    return this.state.designs.find((d) => d.id === this.state.activeDesignId) ?? null;
  }

  private render(): void {
    const active = this.getActiveDesign();
    const activeSettings = active?.settings ?? createDefaultDesignSettings();

    this.root.innerHTML = `
      <div class="studio">
        <header class="studio-header">
          <div class="brand">
            <div class="brand-mark">L</div>
            <div>
              <h1>Lein Studio</h1>
              <p>Mockup 3D de camiseta regular</p>
            </div>
          </div>
          <div class="header-actions">
            <button type="button" class="btn btn-ghost" id="reset-camera">Reset cámara</button>
            <button type="button" class="btn btn-ghost" id="export-video">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span id="export-video-label">Descargar video</span>
            </button>
            <button type="button" class="btn btn-primary" id="export-png">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar PNG
            </button>
          </div>
        </header>

        <main class="studio-main">
          <aside class="panel panel-left">
            <section class="panel-section">
              <div class="section-header-row">
                <h2>Diseños</h2>
                <span class="design-count" id="design-count">0/${MAX_DESIGNS}</span>
              </div>
              <div class="upload-zone" id="upload-zone">
                <input type="file" id="design-input" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple hidden />
                <div class="upload-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <p class="upload-title">Arrastra tus diseños aquí</p>
                <p class="upload-sub">PNG, JPG, WEBP o SVG · hasta ${MAX_DESIGNS} imágenes</p>
                <button type="button" class="btn btn-secondary btn-sm" id="browse-btn">Seleccionar archivos</button>
              </div>
              <div class="design-list" id="design-list"></div>
              <button type="button" class="btn btn-ghost btn-sm btn-block" id="clear-designs" disabled>Quitar todos</button>
            </section>

            <section class="panel-section" id="position-section">
              <h2>Posición del diseño</h2>
              <p class="field-label">Ubicación</p>
              <div class="side-toggle" id="design-side-toggle">
                <button type="button" class="side-btn ${activeSettings.side === "front" ? "active" : ""}" data-side="front">Frente</button>
                <button type="button" class="side-btn ${activeSettings.side === "back" ? "active" : ""}" data-side="back">Espalda</button>
              </div>
              ${this.sliderControl("offset-x", "Horizontal", -0.35, 0.35, 0.01, activeSettings.offsetX)}
              ${this.sliderControl("offset-y", "Vertical", -0.3, 0.35, 0.01, activeSettings.offsetY)}
              ${this.sliderControl("design-scale", "Escala", 0.2, 1.2, 0.01, activeSettings.scale)}
              ${this.sliderControl("design-rotation", "Rotación", -180, 180, 1, activeSettings.rotation, "°")}
              <p class="field-hint">También puedes arrastrar el diseño directamente en la vista 3D</p>
            </section>
          </aside>

          <div class="viewport">
            <div class="viewport-frame" id="preview-container"></div>
            <div class="viewport-hint">
              <span>Arrastra diseño para mover</span>
              <span>·</span>
              <span>Fondo para rotar</span>
              <span>·</span>
              <span>Rueda para zoom</span>
            </div>
          </div>

          <aside class="panel panel-right">
            <section class="panel-section">
              <h2>Color de prenda</h2>
              <div class="color-picker-row">
                <input type="color" id="garment-color" value="${this.state.garment.color}" />
                <input type="text" id="garment-hex" class="hex-input" value="${this.state.garment.color}" maxlength="7" />
              </div>
              <div class="color-presets" id="color-presets">
                ${PRESET_COLORS.map(
                  (c) =>
                    `<button type="button" class="color-swatch" style="background:${c}" data-color="${c}" title="${c}"></button>`
                ).join("")}
              </div>
              ${this.sliderControl("roughness", "Textura tela", 0.3, 1, 0.01, this.state.garment.roughness)}
            </section>

            <section class="panel-section">
              <h2>Escena</h2>
              <label class="toggle">
                <input type="checkbox" id="auto-rotate" ${this.state.scene.autoRotate ? "checked" : ""} />
                <span class="toggle-track"></span>
                <span>Rotación automática</span>
              </label>
              <label class="toggle">
                <input type="checkbox" id="wind-effect" ${this.state.scene.windEffect ? "checked" : ""} />
                <span class="toggle-track"></span>
                <span>Efecto viento</span>
              </label>
              <label class="toggle">
                <input type="checkbox" id="show-grid" ${this.state.scene.showGrid ? "checked" : ""} />
                <span class="toggle-track"></span>
                <span>Mostrar rejilla</span>
              </label>

              <p class="field-label">Fondo</p>
              <div class="bg-presets" id="bg-presets">
                ${BG_PRESETS.map(
                  (p) =>
                    `<button type="button" class="bg-preset" data-bg="${p.value}" style="background:${p.value}" title="${p.label}"></button>`
                ).join("")}
              </div>
              <div class="upload-zone upload-zone-sm" id="bg-upload-zone">
                <input type="file" id="bg-input" accept="image/*" hidden />
                <p>Fondo personalizado</p>
                <button type="button" class="btn btn-secondary btn-sm" id="bg-browse">Subir imagen</button>
              </div>
            </section>
          </aside>
        </main>
      </div>
    `;

    this.previewContainer = this.root.querySelector("#preview-container")!;
    this.designListEl = this.root.querySelector("#design-list")!;
    this.uploadZoneEl = this.root.querySelector("#upload-zone")!;
    this.designCountEl = this.root.querySelector("#design-count")!;
    this.positionSectionEl = this.root.querySelector("#position-section")!;
    this.refreshDesignListUI();
    this.updatePositionSectionState();
  }

  private sliderControl(
    id: string,
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    suffix = ""
  ): string {
    return `
      <div class="control">
        <div class="control-header">
          <label for="${id}">${label}</label>
          <output id="${id}-out">${value.toFixed(step < 1 ? 2 : 0)}${suffix}</output>
        </div>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
      </div>
    `;
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
    if (!active) return;

    Object.assign(active.settings, partial);
    this.scene?.updateDesign(active.id, active.settings);
  }

  private handleDesignDrag(id: string, settings: DesignSettings): void {
    const layer = this.state.designs.find((d) => d.id === id);
    if (!layer) return;

    layer.settings = { ...settings };
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

  private refreshDesignListUI(): void {
    const clearBtn = this.root.querySelector("#clear-designs") as HTMLButtonElement;
    const atMax = this.state.designs.length >= MAX_DESIGNS;

    this.designCountEl.textContent = `${this.state.designs.length}/${MAX_DESIGNS}`;
    clearBtn.disabled = this.state.designs.length === 0;
    this.uploadZoneEl.classList.toggle("upload-zone-full", atMax);

    if (this.state.designs.length === 0) {
      this.designListEl.innerHTML = `<p class="design-list-empty">Sin diseños cargados</p>`;
      return;
    }

    this.designListEl.innerHTML = this.state.designs
      .map(
        (d) => `
        <div class="design-item ${d.id === this.state.activeDesignId ? "active" : ""}" data-id="${d.id}">
          <button type="button" class="design-item-select" data-id="${d.id}">
            <span class="design-item-name">${this.escapeHtml(d.name)}</span>
            <span class="design-item-side">${d.settings.side === "front" ? "Frente" : "Espalda"}</span>
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

    this.designListEl.querySelectorAll(".design-item-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id!;
        this.removeDesign(id);
      });
    });
  }

  private updatePositionSectionState(): void {
    const hasActive = !!this.getActiveDesign();
    this.positionSectionEl.classList.toggle("is-disabled", !hasActive);
    this.positionSectionEl.querySelectorAll("input, button").forEach((el) => {
      (el as HTMLInputElement).disabled = !hasActive;
    });
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
    this.state.designs = [];
    this.state.activeDesignId = null;
    this.refreshDesignListUI();
    this.updatePositionSectionState();
  }
}
