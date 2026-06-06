# Lein Studio — Mockup 3D de Camiseta

Estudio web para crear mockups 3D de camisetas regulares, inspirado en [VirtualThreads](https://www.virtualthreads.io/studio/regular-t-shirt) con una interfaz más organizada y renderizado PBR mejorado.

## Características

- Vista 3D interactiva con iluminación de estudio (OrbitControls)
- Subida de diseño por drag & drop (PNG, JPG, WEBP, SVG)
- Controles de posición, escala y rotación del diseño
- Selector de color de prenda con presets y código hex
- Ajuste de textura de tela (roughness)
- Fondo personalizable (presets o imagen)
- Efectos: rotación automática y simulación de viento
- Exportación a PNG en alta resolución

## Requisitos

- Node.js 18+

## Uso

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` en el navegador.

## Build de producción

```bash
npm run build
npm run preview
```

## Despliegue en Cloudflare

### Cloudflare Pages (recomendado)

1. Conecta el repositorio en **Workers & Pages → Create → Pages**
2. Configura el build:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node.js version:** 18 o superior

### Wrangler CLI

```bash
npm run deploy
```

Requiere tener instalado Wrangler (`npm i -g wrangler`) e iniciar sesión (`wrangler login`).

El archivo `wrangler.jsonc` sirve los archivos estáticos generados en `dist/`.

## Modelo 3D

El estudio carga un modelo **GLB de camiseta regular** (`public/models/regular-tshirt.glb`) con mallas y UVs profesionales, similar al enfoque de [VirtualThreads](https://www.virtualthreads.io/studio/regular-t-shirt), que usa geometría real exportada desde Blender/Verge3D.

Las texturas de tela (normal y roughness) se toman del CDN público de VirtualThreads para lograr un acabado de tela similar al de su editor.

## Stack

- TypeScript
- HTML + CSS
- Three.js + GLTFLoader
- Vite
