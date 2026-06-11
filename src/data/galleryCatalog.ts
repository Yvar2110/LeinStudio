import { createDefaultDesignSettings, type DesignSettings } from "../types";

export interface GalleryTemplate {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  garmentColor: string;
  designSettings?: Partial<DesignSettings>;
  tags: string[];
}

/** Diseños curados y verificados — solo assets estáticos del proyecto, sin subidas de terceros. */
export interface CommunityDesign {
  id: string;
  title: string;
  author: string;
  authorInitials: string;
  imageUrl: string;
  garmentColor: string;
  designSettings?: Partial<DesignSettings>;
  createdAt: string;
}

export const GALLERY_TEMPLATES: GalleryTemplate[] = [
  {
    id: "minimal",
    title: "Logo minimal",
    description: "Tipografía limpia para marcas personales",
    imageUrl: "/gallery/template-minimal.svg",
    garmentColor: "#f5f5f0",
    tags: ["minimal", "logo"],
  },
  {
    id: "wave",
    title: "Ondas fluidas",
    description: "Líneas suaves con acento azul-violeta",
    imageUrl: "/gallery/template-wave.svg",
    garmentColor: "#1a1a1a",
    designSettings: { scale: 0.65 },
    tags: ["abstracto", "color"],
  },
  {
    id: "geo",
    title: "Formas geométricas",
    description: "Composición geométrica en tono dorado",
    imageUrl: "/gallery/template-geo.svg",
    garmentColor: "#1e3a5f",
    designSettings: { scale: 0.6, offsetY: -0.05 },
    tags: ["geométrico"],
  },
  {
    id: "nature",
    title: "Natura",
    description: "Ilustración orgánica en verde bosque",
    imageUrl: "/gallery/template-nature.svg",
    garmentColor: "#f5f5f0",
    designSettings: { scale: 0.58 },
    tags: ["naturaleza", "ilustración"],
  },
];

export const COMMUNITY_DESIGNS: CommunityDesign[] = [
  {
    id: "community-aurora",
    title: "Aurora",
    author: "Marta V.",
    authorInitials: "MV",
    imageUrl: "/gallery/community-aurora.svg",
    garmentColor: "#1a1a1a",
    designSettings: { scale: 0.62 },
    createdAt: "2026-06-08T14:30:00Z",
  },
  {
    id: "community-retro",
    title: "Retro 88",
    author: "Carlos R.",
    authorInitials: "CR",
    imageUrl: "/gallery/community-retro.svg",
    garmentColor: "#f5f5f0",
    designSettings: { scale: 0.55 },
    createdAt: "2026-06-07T09:15:00Z",
  },
  {
    id: "community-bloom",
    title: "Bloom",
    author: "Sofía L.",
    authorInitials: "SL",
    imageUrl: "/gallery/community-bloom.svg",
    garmentColor: "#ffffff",
    designSettings: { scale: 0.58, offsetY: 0.02 },
    createdAt: "2026-06-05T18:45:00Z",
  },
];

export function buildStateFromCatalogItem(
  item: GalleryTemplate | CommunityDesign,
  title: string
): { state: import("../types").StudioState; imageUrl: string } {
  const designId = crypto.randomUUID();
  const settings = {
    ...createDefaultDesignSettings(),
    ...item.designSettings,
  };

  return {
    imageUrl: item.imageUrl,
    state: {
      designs: [
        {
          id: designId,
          name: title,
          settings,
        },
      ],
      activeDesignId: designId,
      garment: {
        color: item.garmentColor,
        roughness: 0.82,
        metalness: 0.02,
      },
      scene: {
        backgroundColor: "#1a1a22",
        backgroundImage: null,
        autoRotate: true,
        windEffect: false,
        showGrid: false,
      },
    },
  };
}
