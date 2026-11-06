# ANÁLISIS — AcordeonRush → Vallenato Hero

Fecha: 2026-11-05 · Commit analizado: `8d8c505` (rama `main`, igual a `origin/main`) · Fase 1 del plan (solo lectura).

> Método: se listaron los 499 archivos versionados más los no versionados, se leyó el código fuente completo de `src/`, `tools/` y los assets de código; se inspeccionó la estructura interna de los GLB, se ejecutó `tsc`, `vite build`, el servidor de desarrollo y la app en Chrome headless (playwright-core instalado fuera del proyecto).

---

## 1. Mapa del proyecto

Carpetas ignoradas en el árbol (existen): `node_modules/` (deps npm), `.git/` (182 MB en packs + LFS), `dist/` (108 MB, build viejo, ignorado), `tools/__pycache__/`.

```
AcordeonRush/
├── .gitattributes            LFS: *.zip *.blend *.glb *.gif
├── .gitignore                node_modules, dist, *.tsbuildinfo, *.blend1, *.log, .env, artifacts/model-backups …
├── PROMPT_MAESTRO_AUDIO_CANCIONES_Y_MODELOS.txt   prompt de una sesión anterior (25 KB)
├── README.md                 README en inglés del estudio actual
├── index.html                entrada Vite (fuentes Google)
├── package.json / package-lock.json
├── tsconfig.json / tsconfig.tsbuildinfo (ignorado) / vite.config.ts
├── docs/
│   ├── implementation-verification.md
│   └── las-locuras-mias-status.md
├── src/                      29 archivos (React + Three.js + Web Audio)
├── public/                   112 MB servidos tal cual
│   ├── audio/accordion-hn/           17 FLAC (copia, NO usada)
│   ├── charts/chart-template.json
│   ├── instrument/                   manifest de audio + samples
│   │   ├── manifest.json             USADO (regiones, 43 botones, perfiles, 24 afinaciones)
│   │   ├── recorded-hn/              USADO: 34 WAV procesados (+PROVENANCE, LICENSE)
│   │   ├── button-accordion-hn/      FLAC originales (fuente de tools, no runtime)
│   │   └── README.md, audio_qa.json, blend_audio_qa.json, file_manifest.json (no usados)
│   ├── instruments/
│   │   ├── layout.json               USADO: mapa GCF 10/11/10 + 12 bajos + 12 familias
│   │   ├── tuning-audit.json         1.1 MB, no usado en runtime
│   │   ├── NOTAS_WEB.md
│   │   └── models/                   USADO: 8 GLB (70 MB) + 8 PNG (17 MB) + model-manifest.json
│   └── models/accordion.glb + accordion-preview.png   (duplicados, NO usados)
├── assets/blender/           526 MB: fuentes Blender, renders, ZIPs, frames de animación
│   ├── AcordeonVallenato_Animado.blend/.glb + 4 PNG     prototipo histórico
│   ├── AcordenRush_*.zip (3, 190 MB, LFS) + .sha256
│   ├── realistic/            modelo "Vino clásico": .blend/.glb, renders, audio FLAC, button-interaction.js (USADO por src), accordion-audio.js (v1, obsoleto), variants/ (azul-caribe, marfil-artesanal, negro-escenario)
│   └── curved_v2/            4 modelos "Curva" (.blend/.glb, renders, qa), motion_previews/*.gif, _motion_frames/ (112 PNG, 69 MB)
├── tools/                    30 scripts (Blender/Python/Node) + redesign-backup/ (copia vieja de App.tsx y styles.css)
└── artifacts/
    ├── audio/                3 WAV de comparación A/B (QA)
    ├── qa/                   42 archivos: fixtures HTML + resultados JSON + capturas JPG (evidencia histórica)
    ├── studio-redesign.png
    └── model-backups/        4 GLB (39 MB, ignorado, solo local)
```

No versionados en disco (ignorados correctamente): `dist/`, 22 `*.log` de Blender, 7 `*.blend1`, `artifacts/model-backups/`, `artifacts/qa/.local-media-syntax.mjs`, `tsconfig.tsbuildinfo`, `tools/__pycache__/`.

**Cambio sin commitear:** `src/AccordionKeyboard.tsx` (3 imports sin usar añadidos el 2026-11-05 20:29, probablemente auto-import del editor). **Rompe `npm run build`** (ver §5).

---

## 2. Tecnología

| Aspecto | Detalle |
|---|---|
| Tipo | Aplicación web SPA |
| Framework UI | React 18.3.1 (StrictMode) |
| 3D | Three.js 0.172.0 (WebGLRenderer, GLTFLoader, OrbitControls, RoomEnvironment, AnimationMixer). Sin React Three Fiber |
| Audio | Web Audio API nativa, motor propio (`src/recorded-accordion-audio.js`) con samples reales. Sin Tone.js |
| Lenguaje | TypeScript ~5.7.3 (strict, `noUnusedLocals`) + 2 archivos JS |
| Bundler | Vite 6.4.5 + @vitejs/plugin-react 4.7.0 |
| Iconos | lucide-react 0.468 |
| Gestor | npm 11 (package-lock v3), Node 24 en esta máquina (README pide 20+) |
| Scripts | `dev` (vite), `build` (`tsc -b && vite build`), `preview`, `typecheck` |
| Herramientas fuera de npm | Blender 5.2 (bpy) para `tools/*.py` de modelado; Python 3 + numpy + soundfile para audio; `esbuild` (transitivo de vite) para `tools/*.mjs` |
| Tests | No hay runner (ni Vitest ni Playwright). Validadores ad-hoc en `tools/validate-*.mjs` y fixtures HTML en `artifacts/qa/` |
| Git | Repo existente con 5 commits, remoto `github.com/Jesussscy/AcordeonRush`, Git LFS activo |

---

## 3. Archivo por archivo

### 3.1 Código `src/` (alcance desde `main.tsx`)

`main.tsx` renderiza `Workspace.tsx` (importado con el alias confuso `PracticeStudio`) y, si se pulsa “Estudio anterior”, `App.tsx` (legacy). Ambos se importan estáticamente, así que los dos van siempre en el bundle.

| Archivo | Qué hace | Depende de | Lo usa | Estado |
|---|---|---|---|---|
| `main.tsx` | Raíz; alterna Workspace ↔ App legacy | App, Workspace, styles.css | index.html | Vivo |
| `Workspace.tsx` | Pantalla principal: 3D + pads + ajustes de sonido + pantalla grande + pestañas Practicar/Canciones/Ver tocar. Teclado global (Espacio = fuelle) | AccordionScene, accordion-catalog, practice, useInstrument, SongWorkspace, practice.css, performance.css | main | **Vivo (núcleo)** |
| `SongWorkspace.tsx` | Biblioteca de canciones, transporte, juicio de práctica (acierto/fallo ±200 ms), modo “ver tocar”, referencia YouTube, importar/exportar JSON, audio local con SHA-256 | song-library, musical-transport, OriginalTrack, ReferenceGuide, phrase-guide, practice | Workspace | Vivo |
| `AccordionScene.tsx` | Escena Three.js del acordeón: carga GLB, fuelle por AnimationMixer calibrado, raycast a botones por pesos de skin, animación de botones | bellows-motion, accordion-catalog, `assets/blender/realistic/button-interaction.js` | Workspace, StudioAccordion, (PracticeStudio, InstrumentWorkspace muertos) | **Vivo (reutilizable)** |
| `useInstrument.ts` | Hook: ciclo de vida del AudioContext/motor, propiedad de notas por fuente (tecla, puntero, foco), dirección y modo manual | accordion-catalog, recorded-accordion-audio | Workspace, SongWorkspace (tipo) | **Vivo (reutilizable)** |
| `recorded-accordion-audio.js` | Motor de audio: sampler de 17 regiones con loops, buses melodía/bajo/acorde, EQ, limitador, perfiles de lengüetas (natural, vallenato, vallenato-high…), `scheduleNote` programado en tiempo de AudioContext | `public/instrument/manifest.json` | useInstrument, App, musical-transport (tipo) | **Vivo (reutilizable)** |
| `musical-transport.ts` | Reloj musical sobre `AudioContext.currentTime` con lookahead 140 ms, pausa, seek, tempo, bucle A-B, cuenta atrás, reloj de medio externo | recorded-accordion-audio (tipo), song-library (tipo) | SongWorkspace | **Vivo (reutilizable)** |
| `song-library.ts` | Formatos `MusicalChart`/`FingeringEvent`, `parseChart` (validación estricta), `fingerChart` (nota → botón + fuelle minimizando cambios), `didacticChart`, `phraseOpening` | accordion-catalog, songs | SongWorkspace, tools | **Vivo (reutilizable)** |
| `songs.ts` | 5 “arreglos didácticos generados” con títulos comerciales (Las locuras mías, etc.); generador de melodía/bajo/acorde | — | song-library, App, PracticeStudio | Vivo (contenido a reemplazar) |
| `phrase-guide.ts` | Divide en frases de 2 compases | song-library (tipo) | SongWorkspace | Vivo |
| `accordion-catalog.ts` | Fuente de verdad: 31 + 12 botones desde `layout.json`, 24 afinaciones, registros, 8 diseños de modelo, nombres de notas en solfeo | layout.json, model-manifest.json | casi todo | **Vivo (reutilizable)** |
| `bellows-motion.ts` | Calibra cada clip de fuelle midiendo la separación real de las cajas; convierte “apertura 0–1” en tiempo de clip | three | AccordionScene | Vivo |
| `practice.ts` | `keyboardButton`/`keyboardLabel` (mapa por `KeyboardEvent.code`), `clockLabel`; además `lessonFor`/`releaseResult` (solo para código muerto) | accordion-map | Workspace, SongWorkspace, ReferenceGuide | Vivo (parcial) |
| `accordion-map.ts` | Adaptador legacy (`buttons`, `makeChart`, `makeAccompaniment`) | accordion-catalog | practice, App, StudioAccordion | Vivo por `practice.ts`; resto legacy |
| `OriginalTrack.tsx` | Envoltorio de la API IFrame de YouTube | — | SongWorkspace, App | Vivo |
| `ReferenceGuide.tsx` | Bucle A-B y velocidad sobre la referencia YouTube | practice | SongWorkspace | Vivo |
| `App.tsx` | Estudio legacy con su propio motor, teclado (`e.key`), juego de carriles con puntos (1000 Perfecto / 600 Bien) | songs, accordion-map, StudioAccordion, OriginalTrack, audio | main (modo legacy) | Legacy |
| `StudioAccordion.tsx` | Adaptador AccordionScene para App | AccordionScene | App | Legacy |
| `PracticeStudio.tsx` | Versión anterior de la pantalla de práctica | — | **nadie** | **Muerto** |
| `InstrumentWorkspace.tsx` | Panel de instrumento anterior | — | **nadie** | **Muerto** |
| `AccordionKeyboard.tsx` | Teclado 2D muy antiguo | instrument.ts | **nadie** (solo `tools/redesign-backup`) | **Muerto y rompe el build** |
| `instrument.ts` | Layout alternativo 11/10/10 basado en frecuencias (incorrecto respecto a layout.json) | — | AccordionKeyboard | **Muerto** |
| `useAccordionInstrument.ts` | Hook de audio anterior | — | **nadie** | **Muerto** |
| `external.d.ts` / `asset-runtime.d.ts` | Tipos de `*accordion-audio.js` (dos declaraciones distintas) y `*button-interaction.js` | — | tsc | Duplicado |
| `styles.css` (36 KB) | Global; ~103 de 121 clases solo sirven al legacy App | — | main | Mayoritariamente legacy |
| `practice.css` (23 KB) | Estilos de Workspace; 10 clases solo para PracticeStudio | — | Workspace | Vivo |
| `performance.css` (7 KB) | Vista inmersiva | — | Workspace | Vivo |
| `songs-workspace.css` (14 KB) | Canciones | — | SongWorkspace | Vivo |

### 3.2 `tools/` (ningún script está en `package.json`)

| Script | Función | Requiere | Relevancia |
|---|---|---|---|
| `build_accordion_blender.py` | Prototipo estilizado | Blender | Histórico; **ruta personal fija** (línea 206) |
| `build_realistic_accordion.py` | Modelo Realista (vino-clásico), rig 43 botones, renders, GLB | Blender + numpy | Fuente (sus funciones las reutilizan otros) |
| `export_realistic_accordion.py`, `validate_realistic_accordion.py`, `playback_realistic_accordion.py`, `pack_realistic_accordion_audio.py`, `package_accordion_asset.py` | Pipeline del Realista | Blender/Py | Histórico |
| `build_accordion_variants.py`, `render_accordion_collection.py`, `playback_accordion_collection.py`, `validate_accordion_collection.py`, `package_accordion_collection.py` | Colección de 3 variantes | Blender/Py+Pillow | Histórico |
| `build_curved_accordions.py`, `update_curva_all_buttons.py`, `validate_curved_accordions.py`, `render_curved_accordions.py`, `render_curva_motion_previews.py`, `playback_curved_accordions.py`, `package_curved_accordions.py` | Familia Curva (4 modelos usados en la web) | Blender/Py | Fuente/histórico |
| `sync-web-models.py` | Copia GLB/PNG Curva a `public/` y genera `model-manifest.json` | Py | **Vigente** |
| `prepare_accordion_audio.py` | Manifest de audio v1 | Py | Histórico |
| `prepare-recorded-accordion.py` | FLAC → WAV con loops de fase emparejada; actualiza manifest | Py+numpy+soundfile | **Vigente** |
| `prepare-studio-audio.mjs`, `configure-vallenato-audio.mjs` | Regeneran `manifest.json` (botones, afinaciones, perfiles vallenato) | Node | **Vigente** |
| `build-music-audit.mjs` | Genera `tuning-audit.json` (2064 casos) | Node+esbuild | Vigente |
| `validate-practice.mjs`, `validate-musical-transport.mjs`, `validate-recorded-audio.py`, `validate-studio.mjs`, `validate_button_interaction.mjs` | Validadores | Node/Py | Vigentes (base para tests reales) |
| `redesign-backup/App.tsx`, `styles.css` | Copia vieja (27-oct) del juego anterior sin 3D | — | **Basura** (historial ya en git) |

### 3.3 Assets

| Asset | Formato | Tamaño | Uso |
|---|---|---|---|
| `public/instruments/models/*.glb` (8) | glTF binario, 1 malla con skinning, `KHR_materials_clearcoat` | 6.9–10.1 MB c/u, 70 MB total | **Usado** (selector de diseño) |
| `public/instruments/models/*.png` (8) | PNG preview | 1.5–2.6 MB c/u, 17 MB | **Usado** (póster/fallback) — muy pesados para miniaturas |
| `public/instrument/recorded-hn/**` | WAV PCM16 estéreo 44.1 kHz, 34 archivos | 6.9 MB | **Usado** (único banco de runtime) |
| `public/instrument/manifest.json` | JSON | 19 KB | **Usado** |
| `public/instruments/layout.json` | JSON | 6 KB | **Usado** (importado en build) |
| `public/instrument/button-accordion-hn/**` | FLAC + SFZ (CC0) | 4.5 MB | Fuente de `prepare-recorded-accordion.py`; no runtime |
| `public/audio/accordion-hn/**` | FLAC (copia con nombres `F#`) | 3.8 MB | **Sin usar** (solo código muerto) |
| `public/models/accordion.glb` / `accordion-preview.png` | GLB / PNG | 7.7 / 0.9 MB | **Sin usar** (duplicados; el GLB solo lo usa `validate-studio.mjs`) |
| `public/instruments/tuning-audit.json` | JSON | 1.1 MB | Sin usar en runtime (evidencia) |
| `public/charts/chart-template.json` | JSON | 0.6 KB | Plantilla para el usuario y tests |
| `assets/blender/**/*.blend` | Blender | 1.3–5.6 MB c/u | Fuentes editables (LFS) |
| `assets/blender/**/instrument.glb`, `Realista.glb` | GLB | 77 MB | **Duplicados exactos** de `public/instruments/models` |
| `assets/blender/*.zip` (3) | ZIP | 190 MB | Re-empaquetan casi todo lo demás (entregas) |
| `assets/blender/curved_v2/_motion_frames/` | 112 PNG | 69 MB | Solo para generar los GIF; **en git sin LFS** |
| `assets/blender/**/renders/*.png` y hojas de revisión | PNG | ~100 MB | Documentación; **en git sin LFS** |
| `assets/blender/curved_v2/motion_previews/*.gif` | GIF | 22 MB | Documentación (LFS) |
| `assets/blender/realistic/audio/**` | FLAC | 4.5 MB | 3.ª copia del banco original |
| `artifacts/audio/*.wav` | WAV | 4.9 MB | Evidencia A/B |
| `artifacts/qa/*.jpg` | JPG | ~0.5 MB | Capturas de QA |
| Fuentes | Google Fonts por CDN (DM Sans, Space Grotesk sin usar, Manrope vía `@import`) | — | No hay fuentes locales |
| Shaders | Ninguno propio | — | — |

**Duplicados exactos (MD5):** ≈ 104 MB entre GLB (77 MB), PNG (18 MB) y FLAC (8 MB), sin contar los ZIP.

**Licencias de audio:** samples “Button Accordion HN” de FreePats, **CC0 1.0** (Jeff Stauffer / michael02022). Los modelos y el código son trabajo propio del proyecto; no hay licencia del proyecto declarada.

---

## 4. El acordeón 3D

- **Malla:** cada GLB es **una sola `SkinnedMesh`** (≈117k triángulos en la colección anterior, ≈132k en Curva), 11–12 materiales PBR con clearcoat, 1–3 texturas embebidas.
- **Jerarquía / rig:** `ROOT` → `CTRL_LADO_BAJO`, `CTRL_LADO_MELODIA`, `CTRL_FUELLE` (+ `BELLOW_RING_NN` en Curva) y **43 huesos de botón**: `BTN_Melody_01…31` (hileras 10/11/10) y `BTN_Bass_01…12`. 47 joints (colección) / 108 joints (Curva).
- **Botones modelados:** 31 de melodía + 12 de bajos. **Son animables individualmente** (cada uno es un hueso). `button-interaction.js` deduce el recorrido de presión a partir de los clips y los hunde con suavizado (τ 26 ms / 40 ms).
- **Fuelle:** animable vía clips (`Bellows_OpenClose`, y en Curva 5 variantes + `Idle_Breath_Loop`). `bellows-motion.ts` mide la separación real entre cajas para convertir “apertura 0–1” en tiempo de clip. Funciona muy bien.
- **Limitación clave para el juego:** al ser una malla única con materiales compartidos, **no se puede teñir un botón individual cambiando su material**. Para “botón rojo/verde” hará falta superponer un halo/emisivo (sprite o anillo) anclado a la posición mundial del hueso, o separar los botones en el pipeline de Blender.
- **Render:** `WebGLRenderer` con ACES, `RoomEnvironment` como IBL, `OrbitControls`, pixel ratio ≤ 1.75, pausa cuando no es visible (IntersectionObserver).
- **Entrada:** teclado físico por `KeyboardEvent.code` (layout-agnóstico): hilera 1 `Q…P`, hilera 2 `A…L Ñ Z`, hilera 3 `X…/ ´`, bajos `1…0 - =`. Espacio (fase de captura) = **abrir**; Shift+Espacio = cerrar; dirección de reposo = **cerrar (push)**. Pads en pantalla (multitáctil) y clic en el 3D (raycast por pesos de skin). Propiedad de notas por fuente en `useInstrument`.
- **Sonido:** **sí**, con samples reales Hohner, bisonoro (cada botón tiene nota push/pull distinta según `layout.json`, verificado contra la tabla Hohner GCF de 31 botones), 6 registros, 24 afinaciones transpuestas, bajos y acordes.

> Diferencia con la especificación: la spec pide Espacio mantenido = **cerrar**, soltar = abrir. El proyecto hace lo contrario (Espacio = abrir). Hay que decidirlo (ver PLAN §7).

---

## 5. Estado real (ejecución)

| Prueba | Resultado |
|---|---|
| `npx tsc -b` | **FALLA**: 3 errores TS6133/TS6192 en `src/AccordionKeyboard.tsx` (cambio sin commitear). Con la versión commiteada compila. Por eso `npm run build` está roto ahora mismo |
| `npx vite build` | OK en 4.2 s. Bundle JS **883 KB** (243 KB gzip): aviso de chunk > 500 KB. `dist` = 108 MB porque copia todo `public/` (incluidos 13 MB sin usar) |
| `npm run dev` | OK (Vite 6.4.5, puerto 5186) |
| App en Chrome (RTX 3050 Laptop, D3D11) | Carga y el modelo 3D está listo en **~2.5 s**. Teclas W y Espacio+E suenan y animan |
| FPS | Frame mediano **6.9 ms**, p95 7.1 ms (≈144 Hz limitado por vsync en headless) → holgado para 60 FPS en esta GPU. Heap JS 46 MB (84 MB tras abrir el estudio legacy) |
| Consola | Sin errores de JS. **2× 404 `/favicon.ico`** (no hay favicon). ~20 advertencias “Construction of GainNode is not useful when context is closed” por el doble montaje de StrictMode en desarrollo |
| `node tools/validate-studio.mjs` | PASS (43 huesos, 24 afinaciones) |
| Lo que NO funciona / falta para el juego | No hay HUD de puntaje, multiplicador, racha con hitos, medidor, autopista 3D de gemas, escenario, personajes, errores tipificados, desafine, resultados ni récords. La pantalla “Canciones → práctica” solo cuenta aciertos/fallos/racha/%. |

---

## 6. Calidad del código

**Lo que vale la pena conservar (alto valor):**
- `accordion-catalog.ts` + `layout.json`: mapa bisonoro verificado contra Hohner, 31/12 botones, 24 afinaciones.
- `recorded-accordion-audio.js`: sampler serio (loops con fase emparejada, buses, EQ, limitador, `scheduleNote` con tiempo de AudioContext). Base ideal para el desafine (`detune` por voz + buses de ganancia).
- `musical-transport.ts`: reloj musical con lookahead, ya pensado para latencia (`getOutputTimestamp`).
- `song-library.ts → fingerChart`: ya resuelve nota → botón + fuelle minimizando cambios de fuelle, con conflictos de dirección. Es justo lo que pide la spec.
- `AccordionScene.tsx` + `bellows-motion.ts` + `button-interaction.js`: modelo 3D con botones y fuelle animables.
- `useInstrument.ts`: propiedad de entrada multi-fuente bien resuelta.
- Los 8 modelos GLB y los samples CC0.

**Problemas:**
1. **Código muerto:** `PracticeStudio.tsx`, `InstrumentWorkspace.tsx`, `AccordionKeyboard.tsx`, `instrument.ts`, `useAccordionInstrument.ts`, `tools/redesign-backup/`, y casi todo `styles.css` + `App.tsx` legacy (se carga siempre).
2. **Duplicación:** el ciclo de vida del audio está implementado 4 veces, los manejadores globales de teclado 3, la lógica de juicio/racha 3 y el guardado de diseño en localStorage 3. Además hay dos `.d.ts` que declaran el mismo módulo con firmas distintas.
3. **Mega-componentes:** App (29 `useState`), PracticeStudio (30), Workspace (22), SongWorkspace (25). Hay líneas de hasta 2.500 caracteres y CSS minificado en una línea de 19.550 caracteres. Mantenerlo así es muy difícil.
4. **Acoplamiento:** `src/` importa `assets/blender/realistic/button-interaction.js`, es decir, el código de runtime vive dentro de los assets de Blender.
5. **Rendimiento:**
   - `SongWorkspace` ejecuta un rAF más un intervalo de 25 ms siempre que está montado, y hace `setState` en cada frame, lo que re-renderiza todo el árbol.
   - `useInstrument` hace `setMeter` cada 70 ms y re-renderiza Workspace.
   - `AccordionScene` crea un contexto WebGL nuevo y recarga el GLB al cambiar de diseño o reiniciar la cámara, y no llama a `forceContextLoss`.
   - Hay pasadas O(n²) en `song-library`.
   - Bundle único de 883 KB.
6. **Bugs:**
   - El juicio de fuelle lee el estado React de la dirección (va un frame tarde).
   - `SongWorkspace` cambia la afinación global a BEA al montarse.
   - App legacy no cierra su `AudioContext` y deja timers sin limpiar.
   - Espacio bloquea siempre la activación de botones, `<summary>` y pestañas (accesibilidad).
   - Los inputs de archivo no se reinician.
   - La etiqueta de M31 no coincide (`;` frente a `Quote`).
7. **Números mágicos:** los *lead-ins* son inconsistentes (2200, 2500 y 1800 ms en tres sitios).
8. **CSS:** la misma clase se redefine en 3 archivos y el resultado depende del orden de importación. Hay `!important`. Las fuentes se cargan dos veces (Space Grotesk no se usa).
9. **Contenido:** los 5 títulos de canciones comerciales son arreglos generados (no transcripciones). Para un juego publicable conviene reemplazarlos por material original o con licencia.
10. **Sin tests automatizados reales:** solo scripts sueltos y fixtures HTML manuales.

---

## 7. Preparación para GitHub

| Elemento | Estado |
|---|---|
| Repositorio git | **Sí**, 5 commits, rama `main` sincronizada con `origin` (github.com/Jesussscy/AcordeonRush) |
| `.gitignore` | Sí, razonable. Falta: `tools/__pycache__` está cubierto; añadir `.DS_Store`, `Thumbs.db`, `.vscode/` local, `coverage/`, `playwright-report/`, `test-results/` |
| `.gitattributes` | Sí, LFS para zip/blend/glb/gif. **Faltan PNG, JPG, WAV, FLAC** |
| README | Sí (inglés, del estudio). Habrá que reescribirlo para Vallenato Hero |
| LICENSE | **No existe** |
| Secretos | **Ninguno** (búsqueda de api_key, token, secret, password, sk-, AKIA, claves privadas; no hay `.env`) |
| Rutas personales | `PROMPT_MAESTRO_AUDIO_CANCIONES_Y_MODELOS.txt:6` y `tools/build_accordion_blender.py:206` (`C:\Users\Xermy\...`); el binario `AcordeonVallenato_Animado.blend` contiene “Xermy” una vez. Los `*.log` con rutas están ignorados |
| No deben subirse | `node_modules/`, `dist/`, `*.tsbuildinfo`, `*.blend1`, `*.log`, `artifacts/model-backups/`, `__pycache__/` — ya ignorados correctamente |
| **Archivos pesados fuera de LFS** | **~200 MB de PNG/JPG** (renders, `_motion_frames` 69 MB, previews 1.5–2.9 MB c/u) y **~24 MB de WAV/FLAC** versionados en git normal → el historial ya pesa 182 MB. Ninguno supera 100 MB individualmente (el mayor es el ZIP de 99.7 MB, en LFS, al límite) |
| Peso total en el checkout | assets/blender 526 MB, public 112 MB, artifacts 45 MB |

**Conclusión:** el repo es subible hoy, pero pesado y redundante. Recomendación para H0:
- Mover a LFS los binarios nuevos.
- Sacar del árbol de trabajo los ZIP, los `_motion_frames`, los renders y los duplicados, de forma que el historial los conserve.
- Opcional (con tu permiso, porque reescribe historia): `git lfs migrate` para aligerar el historial.
