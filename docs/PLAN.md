# PLAN — Vallenato Hero

Estado: **APROBADO con ajustes (2026-11-05).** Basado en [ANALISIS.md](ANALISIS.md).

Leyenda de avance: ☐ pendiente · ☑ hecho

---

## 0. Decisiones del usuario (2026-11-05)

Estas decisiones prevalecen sobre cualquier sección posterior que las contradiga.

1. **Fuelle activo, como “rasgueo”.**
   - En el juego y en el **modo práctica** el fuelle no es automático: el jugador lo acciona.
   - Mantener `Espacio` = cerrar y soltar = abrir (remapeable).
   - Botones = trastes y fuelle = rasgueo:
     - cada **cambio de fuelle** que marca el chart aparece en la franja de fuelle como un evento que hay que ejecutar a tiempo, con las mismas ventanas de juicio;
     - una nota solo cuenta si el botón y la dirección del fuelle son correctos en ese instante.
   - Si el fuelle va en la dirección equivocada, suena **la otra nota del botón** (comportamiento bisonoro real) y se marca “¡FUELLE!”.
   - Habrá una opción “Fuelle asistido” **apagada por defecto**, solo para aprender.
2. **Estudio anterior (`App.tsx`) se elimina.** El estudio actual (Workspace) queda como **“Estudio libre”** en el menú.
3. **Las 5 canciones comerciales se quitan.**
   - No puedo obtener transcripciones verificadas: no tengo acceso al audio, y las partituras publicadas también tienen derechos.
   - Además, distribuir esas melodías en un repo público tiene problemas de copyright.
   - El juego trae la demo original. Las canciones privadas del jugador van en carpetas `songs/_<nombre>/`, que git ignora pero el juego descubre igual.
   - Se hace en H1, cuando el Estudio libre lea los charts de `songs/`.
4. **Arte:**
   - Se eliminan **los ZIP y los duplicados exactos**.
   - **Se conservan todos los renders** y todo lo que no esté duplicado: fotogramas de animación, GIF, hojas de revisión, prototipo y fixtures QA.
   - No se reescribe el historial.
5. **Modelo:** el jugador lo elige al comenzar (pantalla de selección de acordeón antes de jugar). Los 8 siguen disponibles.
6. **Hileras:**
   - El carril de cada gema lo decide la nota: el resolvedor elige botón y hilera.
   - Colores: afuera (G) verde, medio (C) amarillo, adentro (F) rojo.
   - Teclas: afuera Z…, medio A…, adentro Q….
7. **Licencia:** no hubo respuesta.
   - Se aplica **MIT al código** (`LICENSE`).
   - Los modelos y el arte propio quedan en **“todos los derechos reservados”** hasta que decidas otra cosa (`assets/models/LICENSE.md`, `art/LICENSE.md`).
   - Los samples conservan su CC0.

### Ajustes técnicos derivados

- **Arte de Blender:**
  - `assets/blender/` se mueve **completo** a `art/blender/`, conservando su estructura interna (`realistic/`, `curved_v2/<id>/instrument.blend`…).
  - Los 19 scripts de Blender dependen de esas rutas y aquí no hay Blender para probar cambios más profundos. Por eso solo se actualiza el prefijo de ruta (`assets/blender` → `art/blender`, `parents[1]` → `parents[2]`).
- **Nombres del banco de samples:** el banco Hohner conserva sus nombres originales (con espacios), por trazabilidad con el SFZ y `PROVENANCE.json`. El motor ya codifica las URL. Es la única excepción a la convención de nombres.
- **LFS:**
  - Los PNG, JPG, WAV y FLAC que **ya existen** siguen en git normal, porque ya están en el historial.
  - Pasarlos a LFS duplicaría el almacenamiento y consumiría la cuota gratuita de 1 GB de GitHub sin reducir el repo.
  - LFS se aplica a GLB, GLTF, FBX, BLEND, ZIP y GIF (como hoy) y a todo **audio nuevo de canciones** (`*.mp3`, `*.ogg`).

---

## 1. Resumen del estado actual

- AcordeonRush es una SPA **Vite 6 + React 18 + TypeScript + Three.js 0.172**, con motor de audio Web Audio propio y samples reales Hohner (CC0).
- Tiene 8 acordeones 3D GLB con **43 botones animables (huesos) y fuelle calibrado**, mapa GCF bisonoro verificado (31 + 12 botones) y 24 afinaciones. También tiene un transporte musical preciso (reloj de AudioContext) y un resolvedor nota → botón + fuelle que ya minimiza los cambios de fuelle.
- Funciona: carga en ~2.5 s y va a ~7 ms por frame en una RTX 3050. **`npm run build` está roto** por un cambio sin commitear en un archivo muerto.
- No existe nada del juego: autopista, HUD, puntaje por ventanas, errores tipificados, desafine, escenario, personajes, modos ni resultados.
- Deuda: 5 archivos de código muerto y un estudio legacy que siempre se carga. Hay mega-componentes con líneas de 2.500 caracteres, CSS minificado y duplicación (audio ×4, teclado ×3, juicio ×3).
- Repositorio: ya está en GitHub, pero pesa mucho. Hay ~104 MB de binarios duplicados, 190 MB de ZIP y ~200 MB de PNG fuera de LFS. No hay LICENSE.
- **Conclusión:** se conserva el stack y se reutiliza el núcleo (catálogo, sampler, transporte, fingering, escena 3D). El juego se construye como una aplicación nueva encima de ese núcleo, y el estudio actual queda como modo secundario “Estudio libre”.

---

## 2. Nueva estructura de carpetas

Adaptación a Vite: **`assets/` pasa a ser el `publicDir`** (se sirve tal cual en `/`). `data/` y `songs/` se importan en build con `import.meta.glob`, así que una canción nueva aparece sin tocar código. Las fuentes de Blender salen de `assets/` hacia `art/`, porque no son de runtime.

```
/
├── README.md                    # qué es, capturas, instalar, jugar, agregar canciones
├── LICENSE
├── .gitignore
├── .gitattributes               # Git LFS
├── package.json / package-lock.json
├── index.html
├── vite.config.ts               # publicDir: 'assets'
├── tsconfig.json
├── vitest.config.ts / playwright.config.ts
├── docs/
│   ├── ANALISIS.md  PLAN.md
│   ├── guides/                  # agregar-canciones.md, controles.md, arquitectura.md
│   ├── images/                  # capturas para el README
│   └── history/                 # implementation-verification.md, prompts y evidencia QA anteriores
├── src/
│   ├── main.tsx
│   ├── App.tsx                  # (nuevo) enrutador de pantallas del juego
│   ├── core/                    # game-loop, game-state, musical-transport, settings, records
│   ├── render/                  # renderer, camera-rig, lighting, post-processing, shaders/
│   ├── instrument/              # AccordionScene, accordion-catalog, bellows-motion, button-interaction, button-highlights, useInstrument
│   ├── gameplay/                # chart, fingering, difficulty, judge, scoring, streak, parranda, highway/
│   ├── stage/                   # stage, characters, crowd
│   ├── hud/                     # Hud, ScoreLed, Multiplier, StreakOdometer, AmbientMeter, Hats, TimingText
│   ├── audio/                   # accordion-sampler, accompaniment, detune-fx, sfx, backing-track
│   ├── input/                   # keyboard-map, input-manager, midi-input, bindings
│   ├── ui/                      # MainMenu, SongSelect, Pause, Results, Calibration, Settings, theme.css
│   │   └── studio/              # estudio libre actual (Workspace, SongWorkspace, ReferenceGuide, OriginalTrack…)
│   └── utils/
├── assets/                      # publicDir (runtime)
│   ├── models/accordion/        # 8 × <diseño>.glb + <diseño>.png (→ .webp en H6) + model-manifest.json
│   ├── audio/samples/hohner-hn/ # manifest.json + 34 WAV + PROVENANCE.json + LICENSE.txt
│   ├── audio/sfx/               # pifias, golpe de racha, público (sintetizados o CC0)
│   ├── textures/                # autopista, vueltiao
│   ├── fonts/
│   └── favicon.svg
├── data/
│   └── layouts/gcf.json
├── songs/
│   └── paseo-de-prueba/chart.json
├── art/                         # fuentes NO runtime
│   ├── blender/                 # = antiguo assets/blender (realistic/, curved_v2/, renders, frames, GIF)
│   └── audio-source/button-accordion-hn/  # FLAC + SFZ originales (entrada de tools/audio y tools/blender)
├── tools/
│   ├── blender/                 # *.py de modelado/render/QA
│   ├── audio/                   # prepare-recorded-accordion.py, configure-vallenato-audio.mjs…
│   ├── midi-to-chart.mjs
│   └── text-to-chart.mjs
├── tests/
│   ├── unit/                    # Vitest (migración de validate-*.mjs)
│   └── e2e/                     # Playwright: partida simulada y capturas
└── .claude/skills/              # vallenato-hero-design, accordion-layout, chart-authoring, project-architecture
```

### 2.1 Tabla de movimientos (`git mv`)

**Código**

| Ruta actual | Ruta nueva |
|---|---|
| `src/accordion-catalog.ts` | `src/instrument/accordion-catalog.ts` |
| `src/bellows-motion.ts` | `src/instrument/bellows-motion.ts` |
| `src/AccordionScene.tsx` | `src/instrument/AccordionScene.tsx` |
| `src/useInstrument.ts` | `src/instrument/useInstrument.ts` |
| `assets/blender/realistic/button-interaction.js` | `src/instrument/button-interaction.js` |
| `src/recorded-accordion-audio.js` | `src/audio/accordion-sampler.js` |
| `src/asset-runtime.d.ts` | `src/audio/accordion-sampler.d.ts` (se fusiona con `external.d.ts`; tipos de button-interaction → `src/instrument/button-interaction.d.ts`) |
| `src/musical-transport.ts` | `src/core/musical-transport.ts` |
| `src/song-library.ts` | `src/gameplay/song-library.ts` (en H1 se divide en `chart.ts` + `fingering.ts`) |
| `src/phrase-guide.ts` | `src/gameplay/phrase-guide.ts` |
| `src/practice.ts` | `src/input/keyboard-map.ts` |
| `src/songs.ts` | `src/ui/studio/studio-songs.ts` |
| `src/Workspace.tsx` | `src/ui/studio/Workspace.tsx` |
| `src/SongWorkspace.tsx` | `src/ui/studio/SongWorkspace.tsx` |
| `src/ReferenceGuide.tsx` | `src/ui/studio/ReferenceGuide.tsx` |
| `src/OriginalTrack.tsx` | `src/ui/studio/OriginalTrack.tsx` |
| `src/practice.css` | `src/ui/studio/practice.css` |
| `src/performance.css` | `src/ui/studio/performance.css` |
| `src/songs-workspace.css` | `src/ui/studio/songs-workspace.css` |
| `src/styles.css` | `src/ui/studio/base.css` (se queda solo la parte que usa Workspace/AccordionScene) |
| `src/accordion-map.ts` | se absorbe en `src/input/keyboard-map.ts` (solo `buttons`) |

**Datos y runtime** (`public/` → `assets/`)

| Ruta actual | Ruta nueva |
|---|---|
| `public/instruments/layout.json` | `data/layouts/gcf.json` (en H1 se convierte al formato de la spec) |
| `public/instruments/models/*.glb` (8) | `assets/models/accordion/*.glb` |
| `public/instruments/models/*.png` (8) | `assets/models/accordion/*.png` |
| `public/instruments/models/model-manifest.json` | `assets/models/accordion/model-manifest.json` |
| `public/instrument/manifest.json` | `assets/audio/samples/hohner-hn/manifest.json` (`sampleDirectory` pasa a `./`) |
| `public/instrument/recorded-hn/*` (17 WAV + `rel/` 17 WAV + PROVENANCE + LICENSE) | `assets/audio/samples/hohner-hn/` (misma subestructura) |
| `public/instrument/button-accordion-hn/*` (FLAC, `rel/`, SFZ, LICENSE, README) | `art/audio-source/button-accordion-hn/` (copia única del banco original) |
| `public/audio/accordion-hn/PRESET Button Accordion HN tuned.sfz` (variante con nombres `F#`) | `art/audio-source/sfz-nombres-originales-fsharp.sfz` |
| `public/instrument/README.md` | `art/audio-source/README.md` |
| `public/instruments/tuning-audit.json` | `docs/history/qa/tuning-audit.json` |
| `public/instruments/NOTAS_WEB.md` | `docs/history/notas-web.md` |
| `public/charts/chart-template.json` | `tests/fixtures/chart-template-v1.json` |

**Fuentes de arte** (`assets/blender` → `art/blender`)

| Ruta actual | Ruta nueva |
|---|---|
| `assets/blender/**` (todo lo que no se elimina en 2.2: .blend, renders, hojas, GIF, `_motion_frames`, QA, LEEME, prototipo) | `art/blender/**` (**misma estructura interna**; ver §0) |
| `assets/blender/PROMPT_MAESTRO_ACORDEON_VALLENATO_3D.md` | `docs/history/prompt-modelo-3d.md` |
| `assets/blender/realistic/audio/{README.md,manifest.json,file_manifest.json,audio_qa.json,blend_audio_qa.json}` | se quedan en `art/blender/realistic/audio/` (sin la copia de FLAC) |

**Tools, documentación y evidencia**

| Ruta actual | Ruta nueva |
|---|---|
| `tools/*.py` de Blender (19) | `tools/blender/` (prefijo `assets/blender` → `art/blender`, `parents[1]` → `parents[2]`; los que leían `realistic/audio/button-accordion-hn` → `art/audio-source/button-accordion-hn`) |
| `tools/sync-web-models.py` | `tools/blender/sync-web-models.py` (destino `assets/models/accordion`) |
| `tools/redesign-backup/` | se elimina (código; queda en el historial) |
| `tools/{prepare-recorded-accordion.py,prepare_accordion_audio.py,validate-recorded-audio.py,prepare-studio-audio.mjs,configure-vallenato-audio.mjs}` | `tools/audio/` |
| `tools/build-music-audit.mjs` | `tools/audio/build-music-audit.mjs` |
| `tools/validate-*.mjs`, `validate_button_interaction.mjs` | se migran a `tests/unit/*.test.ts` en H0; los originales se eliminan cuando los tests pasen |
| `docs/implementation-verification.md`, `docs/las-locuras-mias-status.md` | `docs/history/` |
| `PROMPT_MAESTRO_AUDIO_CANCIONES_Y_MODELOS.txt` | `docs/history/prompt-audio-canciones.md` (se quita la ruta personal de la línea 6) |
| `artifacts/qa/*` (HTML, JSON, MD, JPG) | `docs/history/qa/` (archivo histórico: los HTML ya no se ejecutan, porque apuntan a rutas de `src/` antiguas) |
| `artifacts/audio/*.wav` | `docs/history/qa/audio/` |
| `artifacts/studio-redesign.png` | `docs/history/qa/studio-redesign.png` |

### 2.2 Archivos a eliminar (aprobado según §0)

Todo sigue recuperable en el historial de git.

**Código muerto o legacy**

| Archivo(s) | Motivo |
|---|---|
| `src/AccordionKeyboard.tsx`, `src/instrument.ts` | Código muerto. AccordionKeyboard rompe el build (incluye el cambio sin commitear de 3 imports sin usar); instrument.ts tiene un layout 11/10/10 incorrecto |
| `src/PracticeStudio.tsx`, `src/InstrumentWorkspace.tsx`, `src/useAccordionInstrument.ts` | Código muerto (nadie los importa) |
| `src/external.d.ts` | Declaración duplicada de un módulo |
| `src/App.tsx`, `src/StudioAccordion.tsx`, `src/accordion-map.ts` (se absorbe en `keyboard-map.ts`) | Estudio legacy (decisión §0.2) |
| `tools/redesign-backup/` | Copia vieja de App.tsx y styles.css |

**ZIP**

| Archivo(s) | Motivo |
|---|---|
| `assets/blender/AcordenRush_{Coleccion_31_12,Curva_V2_31_12,Realista_Asset}.zip` + 3 `.sha256` (190 MB) | Paquetes de entrega (decisión §0.4) |

**Duplicados exactos (MD5 verificado)** — se conserva la copia de runtime

| Duplicado eliminado | Copia que se conserva |
|---|---|
| `public/models/accordion.glb` | `assets/models/accordion/vino-clasico.glb` |
| `assets/blender/realistic/AcordeonVallenato_Realista.glb` | `assets/models/accordion/vino-clasico.glb` |
| `assets/blender/curved_v2/<id>/instrument.glb` (4) | `assets/models/accordion/curva-<id>.glb` |
| `assets/blender/realistic/variants/<id>/instrument.glb` (3) | `assets/models/accordion/<id>.glb` |
| `assets/blender/curved_v2/<id>/preview.png` (4) | `assets/models/accordion/curva-<id>.png` |
| `assets/blender/realistic/variants/<id>/preview.png` (3) | `assets/models/accordion/<id>.png` |
| `public/models/accordion-preview.png` | `art/blender/AcordeonVallenato_preview.png` |
| `public/audio/accordion-hn/` (17 FLAC, LICENSE, README; el SFZ se conserva aparte) | `art/audio-source/button-accordion-hn/` |
| `assets/blender/realistic/audio/button-accordion-hn/` (34 FLAC, SFZ, LICENSE, README) | `art/audio-source/button-accordion-hn/` |
| `public/instrument/{file_manifest,audio_qa,blend_audio_qa}.json` | `art/blender/realistic/audio/` |

**No se elimina:**
- `vino-clasico.png`: es idéntico a `realistic/renders/02_three_quarter_open.png`, pero es un render y se conservan las dos copias.
- Todos los renders, `_motion_frames`, GIF, hojas de revisión, el prototipo `AcordeonVallenato_Animado.glb` y los visores `accordion-audio.js`, `preview.html` y `audio-qa.html`.

**Locales, no versionados** (ya ignorados; limpieza opcional del disco): `dist/`, `*.log`, `*.blend1`, `artifacts/model-backups/`, `tools/__pycache__/`, `tsconfig.tsbuildinfo`.

Resultado: se eliminan unos 300 MB del checkout (ZIP + duplicados).

### 2.3 Convenciones

- Carpetas y módulos en **inglés y kebab-case**.
- Componentes React en **PascalCase**, que es la convención estándar del ecosistema.
- Un módulo por archivo.
- Sin espacios, tildes ni ñ en las rutas. Los samples se renombran a `hn-a4.wav`, `hn-a4-rel.wav`, etc., y se actualiza el manifest.
- El texto de la interfaz va en español.
- Commits convencionales.
- Detalle completo en `.claude/skills/project-architecture/SKILL.md`.

### 2.4 `.gitignore` propuesto
```gitignore
# deps / build
node_modules/
dist/
*.tsbuildinfo
coverage/
playwright-report/
test-results/
# python / blender
__pycache__/
*.pyc
*.blend1
*.log
# entornos y secretos
.env
.env.*
!.env.example
# SO / editores
.DS_Store
Thumbs.db
desktop.ini
.vscode/*
!.vscode/extensions.json
.idea/
# locales
artifacts/
```

### 2.5 `.gitattributes` (versión aprobada, ver §0)
```gitattributes
# Fin de línea normalizado para texto
* text=auto
*.sh text eol=lf
# Git LFS: modelos y fuentes 3D
*.glb   filter=lfs diff=lfs merge=lfs -text
*.gltf  filter=lfs diff=lfs merge=lfs -text
*.fbx   filter=lfs diff=lfs merge=lfs -text
*.blend filter=lfs diff=lfs merge=lfs -text
*.zip   filter=lfs diff=lfs merge=lfs -text
*.gif   filter=lfs diff=lfs merge=lfs -text
# Git LFS: audio de canciones (nuevo)
*.mp3 filter=lfs diff=lfs merge=lfs -text
*.ogg filter=lfs diff=lfs merge=lfs -text
# Binarios en git normal (ya están en el historial; no se renormalizan)
*.png  binary
*.jpg  binary
*.webp binary
*.wav  binary
*.flac binary
```
No se ejecuta `git add --renormalize` ni `git lfs migrate`.

> GitHub LFS gratis = 1 GB de almacenamiento y 1 GB de ancho de banda al mes. Hoy ya hay unos 400 MB en LFS. Con la limpieza, cada clon descarga unos 130 MB.

### 2.6 Licencia (elige)

| Opción | Para qué |
|---|---|
| **MIT (recomendada para el código)** | Permisiva y simple. Cualquiera puede usar y modificar el código citando la autoría |
| Apache-2.0 | Como MIT, más una concesión explícita de patentes |
| GPL-3.0 | Obliga a que los derivados también sean libres |

Para los modelos 3D y el arte propio puedes elegir:
- **CC BY 4.0** (uso libre con atribución)
- **CC BY-NC 4.0** (sin uso comercial)
- “Todos los derechos reservados”

Los samples Hohner conservan su **CC0** en su carpeta.

---

## 3. Brecha

| Área | Existe | Modificar | Crear desde cero |
|---|---|---|---|
| Acordeón 3D | 8 GLB, 43 huesos, fuelle calibrado, raycast | Cámara fija de juego (sin OrbitControls); exponer la posición mundial de cada botón; **resaltado por botón** (halo emisivo o anillo sobre el hueso, porque la malla es única) | — |
| Layout | `layout.json` verificado | Convertir a `data/layouts/gcf.json` (ids A/M/D, nombres de nota) y adaptar el catálogo | — |
| Audio | Sampler, buses, `scheduleNote`, perfiles | Bus de “desafine” por voz (detune, wobble, bitcrush, gain) con recuperación de 300 ms; separar el bus de melodía del jugador del de acompañamiento | Acompañamiento sintetizado de paseo (caja, guacharaca, bajos), pifias ×3, sfx de racha y público, pista mp3 con FX que no desincronizan |
| Tiempo | `musical-transport` (AudioContext, lookahead, latencia) | Reloj en beats, offset, velocidad de práctica, bucle de sección | Calibración de latencia A/V |
| Charts | `MusicalChart` (segundos), `parseChart`, `fingerChart` | Nuevo formato en beats (spec), overrides `button`/`bellows`, preferencia por la hilera medio | Descubrimiento `songs/*`, dificultades derivadas, importador MIDI (`tools/` y runtime), demo “Paseo de Prueba” |
| Gameplay | Juicio básico hit/miss ±200 ms | — | Juez por ventanas (35/70/110 ms), puntaje, multiplicador, racha e hitos, Parranda, Ambientómetro, 5 tipos de error, anti-frustración |
| Autopista | — | — | Carriles, trastes por beat y compás, gemas 3D con id, flechas y bordes de fuelle, colas, franja de fuelle, anillos objetivo, gemas doradas, partículas |
| HUD | — | — | LED de 7 segmentos con rodillo, multiplicador con lucecitas, odómetro, Ambientómetro con física, sombreros, textos de timing, progreso |
| Escenario | — | — | Tarima, luces y reflectores, parlantes, guirnaldas, pantalla LED, 3 personajes low-poly, público en siluetas, bloom |
| UI | Estudio (práctica libre) | Pasa a modo “Estudio libre” | Menú principal, selección de canción, pausa, resultados, ajustes y remapeo, calibración, récords |
| Input | Teclado por `code`, pads, propiedad multi-fuente | Mapeo de la spec (afuera = Z…, medio = A…, adentro = Q…), Espacio mantenido = cerrar (**pregunta 1**), Enter = Parranda, Esc = pausa | Remapeo persistente, Web MIDI, “sacudida de fuelle” |
| Calidad | Validadores sueltos | Migrarlos a Vitest | E2E con Playwright que juega la demo y toma capturas |

---

## 4. Tecnología

**Se conserva Vite + React + TypeScript + Three.js + Web Audio propio. No se migra de motor.**

- Three.js ya renderiza el acordeón con buen rendimiento y el rig es compatible.
- El sampler propio es mejor que una soundfont GM genérica: usa samples reales de acordeón de botones y ya hace bisonoro. Tone.js no aporta lo suficiente para justificar otra dependencia. Si hace falta, se puede añadir una soundfont de respaldo (FluidR3 “accordion”).
- **Postprocesado:** `EffectComposer` + `UnrealBloomPass` de `three/addons`, con una pasada a media resolución.
- **Bucle del juego en TypeScript puro** (rAF propio), fuera de React. React solo para menús y HUD. Así se evita el problema actual de re-render a 60 fps.
- **HUD en DOM/CSS/SVG** superpuesto al canvas: LED, odómetro y aguja son más nítidos y baratos así, y se actualizan con refs.
- **Dependencias nuevas previstas:**
  - `@tonejs/midi` (MIT) para leer .mid
  - `vitest` y `@playwright/test` (dev)

  Nada más sin justificarlo.

---

## 5. Arreglos previos (antes de añadir funciones)

1. Revertir los 3 imports sin usar en `AccordionKeyboard.tsx` (o borrar el archivo) para que `npm run build` vuelva a pasar.
2. Quitar el código muerto y el legacy de la lista 2.2, y cargar el estudio con `React.lazy` para sacarlo del bundle inicial.
3. Unificar las declaraciones `.d.ts` del sampler.
4. Sacar `button-interaction.js` de `assets/blender`.
5. `AccordionScene`:
   - reutilizar el renderer al cambiar de diseño y llamar a `forceContextLoss` al desmontar
   - quitar los listeners
   - añadir un modo de cámara fija
6. Juicio de fuelle con ref, no con estado React (bug de un frame). Lo resuelve el nuevo juez.
7. Que `SongWorkspace` no cambie la afinación global a BEA al montarse.
8. Lead-ins únicos: constante `LEAD_IN_BEATS` en `core/`.
9. Corregir la etiqueta de M31 (`;` frente a `Quote`).
10. Favicon (elimina los 404).
11. Desminificar los archivos que se toquen (formateo con Prettier, configurado en H0).
12. Rutas personales fuera de los archivos versionados.

---

## 6. Hitos

Esfuerzo estimado en sesiones de trabajo de Claude Code (≈ 1 sesión = un bloque largo de trabajo autónomo con pruebas).

### H0 — Organización y preparación para GitHub · ☑ HECHO (2026-11-05, rama `reorganizacion`)
- [x] Rama `reorganizacion` (el repo ya existe).
- [x] `git mv` según 2.1 y eliminaciones según 2.2.
- [x] Commit previo `docs:` con ANALISIS, PLAN y skills.
- [x] `vite.config.ts` → `publicDir: 'assets'`. Actualizar:
  - las rutas de `accordion-catalog.ts`
  - el `baseURL` del sampler
  - el `sampleDirectory` del manifest
  - las rutas de `tools/`
- [x] Prettier + `npm run format`. Vitest con los validadores migrados.
- [x] `.gitignore`, `.gitattributes` (§2.5, sin renormalizar), LICENSE MIT, README inicial y favicon.
- [x] Búsqueda de rutas viejas (`public/instrument`, `instruments/models`, `assets/blender`) y de secretos.
- [x] Commit `chore: reorganizar estructura del proyecto`. **Sin push.** Te entrego los comandos.
- **Terminado cuando:**
  - `npm run typecheck && npm test && npm run build` pasan
  - el estudio funciona igual que antes (prueba headless: modelo listo, tecla suena, 0 errores de consola)
  - no quedan rutas viejas
- Archivos: todo el árbol.

**Resultado del H0:**
- Commits: `ccbed2d` (docs), `0da0522` (reorganización, 391 renombrados con historial) y `41766b2` (Prettier).
- Verificación: `tsc` limpio y 31 tests Vitest en verde. El build de producción pasa (JS 848 KB, aviso de chunk pendiente para H6).
- Estudio libre en Chrome headless (dev y preview): modelo listo, la tecla W suena (RMS 0.045), 0 respuestas HTTP ≥ 400 y 0 errores de consola.
- Desviaciones respecto a la tabla original (aprobadas en §0):
  - `art/blender` conserva la estructura interna.
  - El banco de samples conserva sus nombres originales.
  - Las 5 canciones comerciales siguen en el Estudio libre hasta el H1.
  - `.prettierrc.json`, `.prettierignore`, `vitest.config.ts` y `tests/helpers/` son añadidos.

### H1 — Base jugable con la demo · ☑ HECHO (2026-11-05)
- [x] `data/layouts/gcf.json` en el formato de la spec. El parser y el catálogo lo usan.
- [x] Formato de chart en beats, descubrimiento de `songs/*`, `songs/paseo-de-prueba/chart.json` (A A B A B, 96 BPM, frases B = Parranda) y `tools/text-to-chart.mjs`.
- [x] `gameplay/fingering.ts`: overrides, preferencia por el medio, mínimo de cambios de fuelle. Toda la demo se toca en la hilera medio en GCF (comprobado: C4, E4, G4 y C5 al cerrar; B3, D4, F4, A4 y B4 al abrir).
- [x] `core/game-loop.ts` + máquina de estados (menú → cuenta → jugando → pausa → resultados).
- [x] Escena de juego: cámara baja, autopista con 3 carriles, trastes por beat y compás, gemas con id y flecha de fuelle, colas y anillos objetivo. Acordeón del jugador abajo, con botones hundidos y fuelle.
- [x] `input/`: mapeo de la spec, Espacio para el fuelle, Esc para pausa.
- [x] Juez por ventanas, puntaje básico y acompañamiento sintetizado (bajos, caja y guacharaca en paseo).
- [x] Menú mínimo con la lista de canciones. El Estudio libre sigue accesible.
- **Terminado cuando:**
  - la demo se juega de principio a fin con teclado
  - el test unitario del juez y el fingering pasa
  - el E2E simula una partida perfecta (100 %) y una con fallos
- Archivos: `src/core`, `src/gameplay`, `src/render`, `src/input`, `src/audio/accompaniment.ts`, `songs/`, `data/`.

**Resultado del H1:**
- La demo se juega completa con teclado, con el fuelle activo como rasgueo.
- E2E (Playwright, Chrome del sistema, eventos de teclado reales sobre el reloj de audio):
  - Partida perfecta: 75/75 PERFECTO en Experto, 0 errores.
  - Pasa en las 4 dificultades.
  - El test de errores clasifica botón, fuelle y fallo, y los muestra en resultados.
- Vitest: 46 tests en verde.
- Fingering ajustado con Viterbi: en Experto, 65/75 notas en la hilera del medio y 31 cambios de fuelle.
- El Estudio libre ya usa `songs/`; las 5 canciones comerciales se retiraron.
- Adelantado de H5 (base): Ajustes con remapeo, Calibración, MIDI, importador .mid, resultados y récords.

### H2 — HUD completo · ☑ HECHO (2026-11-05)
- [x] LED de 7 segmentos con dígitos rodantes, círculo multiplicador (x1–x4 y x8) con 10 lucecitas y destello.
- [x] Odómetro de racha con hitos (25/50/100/200/500), letrero, grito y chispas, “Mejor: N” brillando, racha rota (atasco, caída y golpe) y “Racha perdida: N”.
- [x] Ambientómetro con aguja física (resorte con inercia), zonas, alarma y fin de partida por medidor a 0.
- [x] 3 sombreros vueltiaos y activación de Parranda (Enter o sacudida de fuelle) con multiplicador doble, autopista dorada, luces y zoom con pulso.
- [x] Barra de progreso, título y artista, textos de timing y “Perfectos seguidos”.
- **Terminado cuando:** el layout coincide con la spec en 1366×768 y 1920×1080, cada elemento reacciona en el E2E y quedan capturas en `docs/images/`.
- Archivos: `src/hud/*`, `src/gameplay/{streak,parranda,scoring}.ts`.

**Resultado del H2:**
- HUD en DOM/SVG con actualización por diferencias (sin re-render de React por frame).
- Verificado en navegador con capturas durante una partida real: LED, multiplicador y lucecitas, odómetro, Ambientómetro, sombreros, Parranda x8, Perfectos seguidos e indicador de fuelle.

### H3 — Errores y desafine · ☑ HECHO (2026-11-05)
- [x] Clasificador de 5 tipos (perdida, botón, fuelle, temprano/tarde, fantasma) con su etiqueta flotante.
- [x] Resaltado rojo (presionado) y verde (correcto) en el acordeón 3D. Flecha de fuelle grande parpadeando.
- [x] Gema gris y agrietada, sacudida, viñeta roja, caída del multiplicador animada, abucheo tras N fallos y anti-frustración en Fácil.
- [x] `audio/detune-fx.ts`:
  - melodía sintetizada: detune de −40 a −80 cents por voz, wobble, bitcrush (WaveShaper/AudioWorklet), ducking y recuperación de 300 ms
  - pista mp3: vibrato por DelayNode modulado, filtro y ganancia, sin cambiar la velocidad
  - pifias ×3
- **Terminado cuando:**
  - el test verifica que cada error produce su etiqueta y su evento de audio
  - la medición offline (OfflineAudioContext) muestra la caída de afinación y la recuperación en ≤ 300 ms
- Archivos: `src/gameplay/judge.ts`, `src/audio/*`, `src/instrument/button-highlights.ts`, `src/hud/TimingText.tsx`.

**Resultado del H3:** los 5 tipos de error tienen etiqueta y feedback. Desafine medido offline sobre el audio real: −61,2 cents al fallar y −1,7 cents a los 300 ms. Hay pifias, abucheo, golpe de racha rota, sacudida, viñeta y chispas.

### H4 — Escenario y personajes · ☑ HECHO (2026-11-05)
- [x] Tarima procedural de caseta: estructura, parlantes apilados, guirnaldas, pantalla LED con visuales al beat, reflectores que barren (luces volumétricas falsas con conos aditivos) y bloom.
- [x] Acordeonero con sombrero vueltiao (fuelle sincronizado con el del jugador), cajero y guacharaquero: low-poly procedurales y animados al beat.
- [x] Público en siluetas instanciadas (InstancedMesh) con estados según el Ambientómetro.
- [x] Textura de autopista (cuero/madera con vueltiao sutil) generada proceduralmente (canvas/shader). **Todo el arte es original.**
- **Terminado cuando:** 60 FPS estables en 1080p en esta máquina (p95 < 16.7 ms medido en el E2E) y personajes sincronizados al BPM.
- Archivos: `src/stage/*`, `src/render/post-processing.ts`, `src/render/shaders/*`.

**Resultado del H4:**
- Escenario, músicos y público procedurales, con bloom.
- 1080p sin límite de vsync: p95 de 4,2 ms (test E2E).

### H5 — Modos, dificultad y resultados · ☑ HECHO (2026-11-05)
- [x] Dificultades derivadas (Fácil, Medio, Difícil, Experto) y su selector.
- [x] Modo práctica: velocidad del 50 al 100 %, bucle de sección y nombre de la nota visible.
- [x] Calibración de latencia A/V (golpes al pulso y offset visual) persistente.
- [x] Pantalla de resultados (sombreros 1–5, %, racha máxima y récord, desgloses, consejo automático). Récords por canción y dificultad.
- [x] Remapeo de controles en ajustes y Web MIDI opcional.
- [x] Importador `.mid`: `tools/midi-to-chart.mjs` y carga en runtime de `songs/<x>/song.mid`.
- **Terminado cuando:** la demo se completa en las 4 dificultades en el E2E, una carpeta nueva en `songs/` aparece sin tocar código (test) y los récords persisten.
- Archivos: `src/gameplay/difficulty.ts`, `src/ui/*`, `src/core/records.ts`, `tools/midi-to-chart.mjs`.

**Resultado del H5:**
- 4 dificultades, práctica con velocidad y bucle, calibración, resultados con récords y consejo, remapeo de teclas, MIDI, `.mid` en tiempo de ejecución y `tools/midi-to-chart.mjs`.
- Extra pedido por el usuario: modo **Demostración**, en el que el acordeón toca la canción solo.

### H6 — Pulido y rendimiento · ☑ HECHO (2026-11-05)
- [x] Code-splitting (estudio, escenario, MIDI), previews PNG → WebP (de unos 2 MB a menos de 150 KB) y GLB con compresión meshopt opcional.
- [x] Opción de calidad (bloom y público on/off), pausa por visibilidad, auditoría de memoria y contextos.
- [x] README completo con capturas del HUD, guía para agregar canciones, controles y créditos (samples CC0).
- [x] E2E final: juega la demo con aciertos y fallos, verifica los criterios de aceptación 5–10 y regenera las capturas.
- **Terminado cuando:** se cumplen todos los criterios de aceptación de la spec, la consola está limpia, el bundle inicial es menor de 500 KB gzip y el juego va a 60 FPS.

---

**Resultado del H6:**
- Vistas previas en WebP (17 MB → 160 KB) y code-splitting: menú inicial de unos 59 KB gzip.
- Gemas con etiqueta *billboard* y la tecla en grande, más la franja de “próximas teclas”.
- README con capturas.
- 10 tests E2E y 46 unitarios en verde.

## 7. Riesgos y preguntas abiertas

**Riesgos**

1. **Resaltado por botón.** El modelo es una sola malla, así que el rojo/verde por botón se hace con halos sobre los huesos y no tiñendo el botón. Si quieres el botón coloreado de verdad, hay que separar los botones en Blender (sin Blender instalado aquí, no lo puedo hacer yo).
2. **Desafinar un mp3 sin desincronizarlo.** `detune` cambia la velocidad. Se usará vibrato por delay modulado y filtros; el efecto es convincente, pero no es un “pitch shift” puro.
3. **Latencia en Windows/Bluetooth.** Se puede compensar con la calibración, pero no es perfecta.
4. **Cuota de LFS en GitHub** (1 GB). Ver 2.5.
5. **Rendimiento con escenario completo y bloom en portátiles integrados.** Se mitiga con niveles de calidad.
6. **El mapa de la spec ≠ el real.** El ejemplo de la spec (`A1: push B3, pull D4`) no coincide con la tabla Hohner que ya usa el proyecto: el A1 real es el botón de alteraciones C#4/D#4. Se usa la tabla verificada del proyecto, con un comentario.

**Preguntas:** respondidas el 2026-11-05; ver §0.
