import { TShirtScene } from "../three/TShirtScene";
import { DEFAULT_STATE, type StudioState } from "../types";

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
  private fileNameEl!: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.render();
    this.bindEvents();
    this.initScene();
  }

  private render(): void {
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
            <button type="button" class="btn btn-primary" id="export-png">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar PNG
            </button>
          </div>
        </header>

        <main class="studio-main">
          <aside class="panel panel-left">
            <section class="panel-section">
              <h2>Diseño</h2>
              <div class="upload-zone" id="upload-zone">
                <input type="file" id="design-input" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden />
                <div class="upload-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <p class="upload-title">Arrastra tu diseño aquí</p>
                <p class="upload-sub">PNG, JPG, WEBP o SVG</p>
                <button type="button" class="btn btn-secondary btn-sm" id="browse-btn">Seleccionar archivo</button>
              </div>
              <p class="file-name" id="file-name">Sin diseño cargado</p>
              <button type="button" class="btn btn-ghost btn-sm btn-block" id="clear-design" disabled>Quitar diseño</button>
            </section>

            <section class="panel-section">
              <h2>Posición del diseño</h2>
              ${this.sliderControl("offset-x", "Horizontal", -0.3, 0.3, 0.01, this.state.design.offsetX)}
              ${this.sliderControl("offset-y", "Vertical", -0.2, 0.3, 0.01, this.state.design.offsetY)}
              ${this.sliderControl("design-scale", "Escala", 0.2, 1.2, 0.01, this.state.design.scale)}
              ${this.sliderControl("design-rotation", "Rotación", -180, 180, 1, this.state.design.rotation, "°")}
            </section>
          </aside>

          <div class="viewport">
            <div class="viewport-frame" id="preview-container"></div>
            <div class="viewport-hint">
              <span>Arrastra para rotar</span>
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
    this.fileNameEl = this.root.querySelector("#file-name")!;
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
    const uploadZone = this.root.querySelector("#upload-zone")!;
    const designInput = this.root.querySelector("#design-input") as HTMLInputElement;
    const browseBtn = this.root.querySelector("#browse-btn")!;
    const clearBtn = this.root.querySelector("#clear-design") as HTMLButtonElement;

    browseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      designInput.click();
    });
    uploadZone.addEventListener("click", () => designInput.click());

    uploadZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadZone.classList.add("dragover");
    });
    uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
    uploadZone.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadZone.classList.remove("dragover");
      const file = (e as DragEvent).dataTransfer?.files[0];
      if (file) this.handleDesignUpload(file);
    });

    designInput.addEventListener("change", () => {
      const file = designInput.files?.[0];
      if (file) this.handleDesignUpload(file);
    });

    clearBtn.addEventListener("click", () => {
      this.scene?.clearDesign();
      this.fileNameEl.textContent = "Sin diseño cargado";
      clearBtn.disabled = true;
      designInput.value = "";
    });

    this.bindSlider("offset-x", (v) => {
      this.state.design.offsetX = v;
      this.scene?.setDesign(this.state.design);
    });
    this.bindSlider("offset-y", (v) => {
      this.state.design.offsetY = v;
      this.scene?.setDesign(this.state.design);
    });
    this.bindSlider("design-scale", (v) => {
      this.state.design.scale = v;
      this.scene?.setDesign(this.state.design);
    });
    this.bindSlider("design-rotation", (v) => {
      this.state.design.rotation = v;
      this.scene?.setDesign(this.state.design);
    }, "°");

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

  private async handleDesignUpload(file: File): Promise<void> {
    const isImage =
      file.type.startsWith("image/") ||
      /\.(png|jpe?g|webp|svg)$/i.test(file.name);

    if (!isImage) {
      this.fileNameEl.textContent = "Formato no soportado";
      return;
    }

    if (!this.scene) {
      this.fileNameEl.textContent = "Espera a que cargue el visor 3D…";
      return;
    }

    try {
      await this.scene.loadDesignImage(file);
      this.fileNameEl.textContent = file.name;
      (this.root.querySelector("#clear-design") as HTMLButtonElement).disabled = false;
      this.scene.setDesign(this.state.design);
    } catch (error) {
      console.error(error);
      this.fileNameEl.textContent = "Error al cargar imagen";
    }
  }
}
