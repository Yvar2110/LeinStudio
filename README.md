# Lein Studio — Mockup 3D de Camiseta

Estudio web para crear mockups 3D de camisetas regulares, inspirado en [VirtualThreads](https://www.virtualthreads.io/studio/regular-t-shirt) con una interfaz más organizada y renderizado PBR mejorado.

## Características

- Galería con plantillas y diseños curados
- Vista 3D interactiva con iluminación de estudio (OrbitControls)
- Subida de diseño por drag & drop (PNG, JPG, WEBP, SVG)
- Controles de posición, escala y rotación del diseño
- Fijar diseños para evitar moverlos sin querer
- Selector de color de prenda con presets y código hex
- Ajuste de textura de tela (roughness)
- Fondo personalizable (presets o imagen)
- Efectos: rotación automática y simulación de viento
- Exportación a PNG en alta resolución
- Guardado local opcional en el navegador (IndexedDB)

## Requisitos

- Node.js 18+

## Uso

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` en el navegador.

## Guardado de diseños

Los diseños se guardan **solo en el navegador** (IndexedDB) cuando usas «Guardar diseño». No hay registro ni cuenta. Si borras los datos del sitio o cambias de dispositivo, se pierden.

## Build de producción

```bash
npm run build
npm run preview
```

## Despliegue en Cloudflare

```bash
npm run deploy
```

Requiere Wrangler (`npm i -g wrangler`) e iniciar sesión (`wrangler login`). El archivo `wrangler.jsonc` sirve los archivos estáticos generados en `dist/`.

## Modelo 3D

El estudio carga un modelo **GLB de camiseta regular** (`public/models/regular-tshirt.glb`). Las texturas de tela están en `public/textures/`.

## Stack

- TypeScript + Vite + Three.js
- IndexedDB (guardado local)
