import { COMMUNITY_DESIGNS, GALLERY_TEMPLATES, type CommunityDesign, type GalleryTemplate } from "../data/galleryCatalog";
import { deleteSavedMockup, listSavedMockups, type SavedMockup } from "../storage/designStorage";

export interface GalleryPageOptions {
  onNewDesign: () => void;
  onOpenTemplate: (template: GalleryTemplate) => void;
  onOpenCommunity: (design: CommunityDesign) => void;
  onOpenSaved: (mockup: SavedMockup) => void;
}

export class GalleryPage {
  private root: HTMLElement;
  private options: GalleryPageOptions;
  private savedMockups: SavedMockup[] = [];

  private constructor(root: HTMLElement, options: GalleryPageOptions) {
    this.root = root;
    this.options = options;
  }

  static async create(root: HTMLElement, options: GalleryPageOptions): Promise<GalleryPage> {
    const page = new GalleryPage(root, options);
    await page.init();
    return page;
  }

  private async init(): Promise<void> {
    this.savedMockups = await listSavedMockups();
    this.render();
    this.bindEvents();
  }

  destroy(): void {
    this.root.innerHTML = "";
    document.body.classList.remove("gallery-mode");
  }

  private render(): void {
    document.body.classList.add("gallery-mode");
    const saved = this.savedMockups;

    this.root.innerHTML = `
      <div class="gallery">
        <header class="gallery-header">
          <div class="brand">
            <div class="brand-mark">L</div>
            <div>
              <h1>Lein Studio</h1>
              <p>Explora diseños y crea tu mockup 3D</p>
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="new-design-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo diseño
          </button>
        </header>

        <main class="gallery-main">
          <section class="gallery-hero">
            <div class="gallery-hero-content">
              <h2>Diseña tu camiseta en 3D</h2>
              <p>Elige una plantilla, inspírate en la comunidad o empieza desde cero. El editor se abre en pantalla completa para que puedas ajustar cada detalle.</p>
              <button type="button" class="btn btn-primary btn-lg" id="hero-new-btn">Crear mockup</button>
            </div>
            <div class="gallery-hero-visual" aria-hidden="true">
              <div class="hero-card hero-card-1"></div>
              <div class="hero-card hero-card-2"></div>
              <div class="hero-card hero-card-3"></div>
            </div>
          </section>

          <section class="gallery-section">
            <div class="section-heading">
              <h3>Plantillas disponibles</h3>
              <p>Diseños listos para personalizar en el editor</p>
            </div>
            <div class="design-grid" id="templates-grid">
              ${GALLERY_TEMPLATES.map((t) => this.templateCard(t)).join("")}
            </div>
          </section>

          <section class="gallery-section">
            <div class="section-heading">
              <div>
                <h3>Recientes de la comunidad</h3>
                <p>Diseños verificados y curados por Lein — sin subidas de usuarios en tiempo real</p>
              </div>
              <span class="verified-badge" title="Solo contenido estático revisado por el equipo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                Verificados
              </span>
            </div>
            <div class="design-grid" id="community-grid">
              ${COMMUNITY_DESIGNS.map((d) => this.communityCard(d)).join("")}
            </div>
            <p class="gallery-security-note">
              Por seguridad, los diseños de otros usuarios se muestran solo cuando están pre-aprobados por el equipo.
              Las creaciones en tiempo real requerirán autenticación y moderación en una futura versión.
            </p>
          </section>

          <section class="gallery-section" id="saved-section">
            <div class="section-heading">
              <h3>Tus diseños recientes</h3>
              <p>Guardados en este navegador — solo tú puedes verlos</p>
            </div>
            ${
              saved.length === 0
                ? `<div class="gallery-empty">
                    <p>Aún no has guardado ningún diseño.</p>
                    <p class="gallery-empty-hint">Abre el editor y usa «Guardar diseño» para verlo aquí.</p>
                  </div>`
                : `<div class="design-grid" id="saved-grid">
                    ${saved.map((m) => this.savedCard(m)).join("")}
                  </div>`
            }
          </section>
        </main>
      </div>
    `;
  }

  private templateCard(t: GalleryTemplate): string {
    return `
      <article class="design-card" data-template-id="${t.id}">
        <button type="button" class="design-card-btn" data-template-id="${t.id}">
          <div class="design-card-preview" style="background:${t.garmentColor}">
            <img src="${t.imageUrl}" alt="" loading="lazy" />
          </div>
          <div class="design-card-body">
            <h4>${this.escape(t.title)}</h4>
            <p>${this.escape(t.description)}</p>
            <div class="design-card-tags">
              ${t.tags.map((tag) => `<span class="tag">${this.escape(tag)}</span>`).join("")}
            </div>
          </div>
        </button>
      </article>
    `;
  }

  private communityCard(d: CommunityDesign): string {
    const date = this.formatRelativeDate(d.createdAt);
    return `
      <article class="design-card design-card-community" data-community-id="${d.id}">
        <button type="button" class="design-card-btn" data-community-id="${d.id}">
          <div class="design-card-preview" style="background:${d.garmentColor}">
            <img src="${d.imageUrl}" alt="" loading="lazy" />
          </div>
          <div class="design-card-body">
            <div class="design-card-author">
              <span class="author-avatar">${this.escape(d.authorInitials)}</span>
              <span class="author-name">${this.escape(d.author)}</span>
              <span class="author-date">${date}</span>
            </div>
            <h4>${this.escape(d.title)}</h4>
          </div>
        </button>
      </article>
    `;
  }

  private savedCard(m: SavedMockup): string {
    const date = this.formatRelativeDate(new Date(m.updatedAt).toISOString());
    return `
      <article class="design-card design-card-saved" data-saved-id="${m.id}">
        <button type="button" class="design-card-btn" data-saved-id="${m.id}">
          <div class="design-card-preview" style="background:${m.garmentColor}">
            <img src="${m.thumbnail}" alt="" loading="lazy" />
          </div>
          <div class="design-card-body">
            <h4>${this.escape(m.title)}</h4>
            <p class="saved-meta">Guardado ${date}</p>
          </div>
        </button>
        <button type="button" class="design-card-delete" data-delete-id="${m.id}" title="Eliminar">×</button>
      </article>
    `;
  }

  private bindEvents(): void {
    this.root.querySelector("#new-design-btn")?.addEventListener("click", () => {
      this.options.onNewDesign();
    });

    this.root.querySelector("#hero-new-btn")?.addEventListener("click", () => {
      this.options.onNewDesign();
    });

    this.root.querySelectorAll("[data-template-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).dataset.templateId!;
        const template = GALLERY_TEMPLATES.find((t) => t.id === id);
        if (template) this.options.onOpenTemplate(template);
      });
    });

    this.root.querySelectorAll("[data-community-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).dataset.communityId!;
        const design = COMMUNITY_DESIGNS.find((d) => d.id === id);
        if (design) this.options.onOpenCommunity(design);
      });
    });

    this.root.querySelectorAll("[data-saved-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).dataset.savedId!;
        const mockup = this.savedMockups.find((m) => m.id === id);
        if (mockup) this.options.onOpenSaved(mockup);
      });
    });

    this.root.querySelectorAll("[data-delete-id]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = (el as HTMLElement).dataset.deleteId!;
        if (confirm("¿Eliminar este diseño guardado?")) {
          void this.removeSaved(id);
        }
      });
    });
  }

  private async removeSaved(id: string): Promise<void> {
    await deleteSavedMockup(id);
    this.savedMockups = await listSavedMockups();
    this.render();
    this.bindEvents();
  }

  private formatRelativeDate(iso: string): string {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "hoy";
    if (days === 1) return "ayer";
    if (days < 7) return `hace ${days} días`;
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }

  private escape(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
