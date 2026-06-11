import {
  buildStateFromCatalogItem,
  type CommunityDesign,
  type GalleryTemplate,
} from "../data/galleryCatalog";
import {
  dataUrlToFile,
  getSavedDesignImages,
  getSavedMockup,
  initMockupStorage,
  savedMockupToState,
  urlToFile,
} from "../storage/designStorage";
import { DEFAULT_STATE, type StudioState } from "../types";
import { GalleryPage } from "./GalleryPage";
import { navigate, parseRoute } from "./router";
import type { StudioApp } from "./StudioApp";

interface PendingDesignLoad {
  state: StudioState;
  files: { id: string; file: File }[];
}

export class App {
  private root: HTMLElement;
  private gallery: GalleryPage | null = null;
  private editor: StudioApp | null = null;
  private overlayEl: HTMLElement | null = null;
  private editorModule: typeof import("./StudioApp") | null = null;
  private activeMockupId: string | null = null;

  private constructor(root: HTMLElement) {
    this.root = root;
    window.addEventListener("hashchange", () => void this.handleRoute());
  }

  static async create(root: HTMLElement): Promise<App> {
    await initMockupStorage();
    const app = new App(root);
    await app.handleRoute();
    return app;
  }

  private async handleRoute(): Promise<void> {
    const route = parseRoute();

    if (route.view === "gallery") {
      await this.showGallery();
      return;
    }

    if (route.mockupId) {
      if (this.activeMockupId === route.mockupId && this.editor) return;
      await this.openSavedById(route.mockupId);
      return;
    }

    if (!this.editor) {
      await this.openEditor();
    }
  }

  private async showGallery(): Promise<void> {
    this.closeEditor();
    this.activeMockupId = null;
    this.gallery = await GalleryPage.create(this.root, {
      onNewDesign: () => navigate({ view: "editor" }),
      onOpenTemplate: (template) => void this.openFromTemplate(template),
      onOpenCommunity: (design) => void this.openFromCommunity(design),
      onOpenSaved: (mockup) => navigate({ view: "editor", mockupId: mockup.id }),
    });
  }

  private async openFromTemplate(template: GalleryTemplate): Promise<void> {
    const { state, imageUrl } = buildStateFromCatalogItem(template, template.title);
    const designId = state.designs[0]!.id;
    const file = await urlToFile(imageUrl, `${template.id}.svg`);
    await this.openEditor({ state, files: [{ id: designId, file }] });
    navigate({ view: "editor" }, true);
  }

  private async openFromCommunity(design: CommunityDesign): Promise<void> {
    const { state, imageUrl } = buildStateFromCatalogItem(design, design.title);
    const designId = state.designs[0]!.id;
    const file = await urlToFile(imageUrl, `${design.id}.svg`);
    await this.openEditor({ state, files: [{ id: designId, file }] });
    navigate({ view: "editor" }, true);
  }

  private async openSavedById(id: string): Promise<void> {
    const fresh = await getSavedMockup(id);
    if (!fresh) {
      navigate({ view: "gallery" }, true);
      await this.showGallery();
      return;
    }

    const state = savedMockupToState(fresh);
    const images = await getSavedDesignImages(fresh);
    const files: { id: string; file: File }[] = [];

    for (const layer of fresh.designs) {
      const dataUrl = images.get(layer.id);
      if (!dataUrl) continue;
      files.push({ id: layer.id, file: await dataUrlToFile(dataUrl, layer.name) });
    }

    this.activeMockupId = id;
    await this.openEditor({ state, files });
  }

  private async loadEditorModule(): Promise<typeof import("./StudioApp")> {
    this.editorModule ??= await import("./StudioApp");
    return this.editorModule;
  }

  private async openEditor(pending?: PendingDesignLoad): Promise<void> {
    this.gallery?.destroy();
    this.gallery = null;

    if (!this.overlayEl) {
      this.overlayEl = document.createElement("div");
      this.overlayEl.className = "editor-overlay";
      this.overlayEl.setAttribute("role", "dialog");
      this.overlayEl.setAttribute("aria-modal", "true");
      this.overlayEl.setAttribute("aria-label", "Editor de mockup 3D");

      const editorRoot = document.createElement("div");
      editorRoot.className = "editor-overlay-inner";
      editorRoot.innerHTML =
        '<div class="editor-loading"><div class="viewport-spinner"></div><p>Cargando editor 3D…</p></div>';
      this.overlayEl.appendChild(editorRoot);
      this.root.appendChild(this.overlayEl);
      document.body.classList.remove("gallery-mode");

      requestAnimationFrame(() => {
        this.overlayEl?.classList.add("is-open");
      });
    }

    const { StudioApp } = await this.loadEditorModule();
    const editorRoot = this.overlayEl.querySelector(".editor-overlay-inner") as HTMLElement;

    this.editor?.destroy();
    this.editor = new StudioApp(editorRoot, {
      initialState: pending?.state ?? structuredClone(DEFAULT_STATE),
      pendingFiles: pending?.files,
      onClose: () => navigate({ view: "gallery" }),
      onSaved: (saved) => {
        this.activeMockupId = saved.id;
        navigate({ view: "editor", mockupId: saved.id }, true);
      },
    });
  }

  private closeEditor(): void {
    this.editor?.destroy();
    this.editor = null;
    this.activeMockupId = null;
    this.overlayEl?.remove();
    this.overlayEl = null;
  }
}
