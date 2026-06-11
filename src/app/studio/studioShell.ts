import { MAX_DESIGNS, createDefaultDesignSettings, type DesignSettings, type StudioState } from "../../types";
import { BG_PRESETS, PRESET_COLORS } from "./studioConstants";

function sliderControl(
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

export function renderStudioShell(
  state: StudioState,
  activeSettings: DesignSettings,
  showCloseButton: boolean
): string {
  return `
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
          ${
            showCloseButton
              ? `<button type="button" class="btn btn-ghost" id="close-editor">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                  Volver
                </button>`
              : ""
          }
          <button type="button" class="btn btn-ghost" id="save-design" ${state.designs.length === 0 ? "disabled" : ""}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Guardar diseño
          </button>
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
            ${sliderControl("offset-x", "Horizontal", -0.35, 0.35, 0.01, activeSettings.offsetX)}
            ${sliderControl("offset-y", "Vertical", -0.3, 0.35, 0.01, activeSettings.offsetY)}
            ${sliderControl("design-scale", "Escala", 0.2, 1.2, 0.01, activeSettings.scale)}
            ${sliderControl("design-rotation", "Rotación", -180, 180, 1, activeSettings.rotation, "°")}
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
              <input type="color" id="garment-color" value="${state.garment.color}" />
              <input type="text" id="garment-hex" class="hex-input" value="${state.garment.color}" maxlength="7" />
            </div>
            <div class="color-presets" id="color-presets">
              ${PRESET_COLORS.map(
                (c) =>
                  `<button type="button" class="color-swatch" style="background:${c}" data-color="${c}" title="${c}"></button>`
              ).join("")}
            </div>
            ${sliderControl("roughness", "Textura tela", 0.3, 1, 0.01, state.garment.roughness)}
          </section>

          <section class="panel-section">
            <h2>Escena</h2>
            <label class="toggle">
              <input type="checkbox" id="auto-rotate" ${state.scene.autoRotate ? "checked" : ""} />
              <span class="toggle-track"></span>
              <span>Rotación automática</span>
            </label>
            <label class="toggle">
              <input type="checkbox" id="wind-effect" ${state.scene.windEffect ? "checked" : ""} />
              <span class="toggle-track"></span>
              <span>Efecto viento</span>
            </label>
            <label class="toggle">
              <input type="checkbox" id="show-grid" ${state.scene.showGrid ? "checked" : ""} />
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
}

export function getDefaultActiveSettings(): DesignSettings {
  return createDefaultDesignSettings();
}
