# Recuperar AcordeonRush después de restablecer el computador

Respaldo solicitado el 20 de noviembre de 2026. Repositorio: https://github.com/Jesussscy/AcordeonRush.

Se conserva el código actual, los commits locales de la rama `reorganizacion`, los modelos de Blender y GLB, audio, documentación, herramientas y recursos del proyecto. El respaldo adicional en `backups/reset-2026-11-20/` captura también archivos excluidos normalmente de Git: `artifacts/`, la canción MIDI/chart de `songs/_silvestre-niegame-tres-veces/`, copias `.blend1`, logs, resultados de pruebas y la compilación `dist/`.

No se copian `.git/`, `node_modules/`, `__pycache__/` ni respaldos anteriores dentro del ZIP. El historial está en GitHub y también en `history.bundle`; las dependencias se recuperan con `npm ci`. Este respaldo corresponde a la carpeta del proyecto: no captura datos guardados exclusivamente en IndexedDB/localStorage del navegador ni archivos externos a esa carpeta.

## Recuperación recomendada

Instalar Git, Git LFS, Node.js/npm y, para editar las fuentes 3D, Blender. Después ejecutar:

```powershell
git lfs install
git clone https://github.com/Jesussscy/AcordeonRush.git
cd AcordeonRush
git lfs pull
npm ci
npm test
npm run build
npm run dev
```

Los archivos grandes se almacenan en Git LFS. Si se usa el botón de GitHub «Download ZIP», comprobar que los modelos y archivos de respaldo sean binarios reales y no punteros de texto de LFS; clonar y ejecutar `git lfs pull` es la vía recomendada.

## Recuperar los archivos locales excluidos

`backups/reset-2026-11-20/AcordeonRush-full-project.zip` contiene una carpeta `AcordeonRush/` y un `BACKUP-MANIFEST.json` con el tamaño y SHA-256 de cada archivo. Extraerlo primero en una carpeta separada; allí estarán también los modelos anteriores, capturas, canción local y compilación. Se puede ejecutar `npm ci` en esa carpeta para usar la copia sin historial, o recuperar los archivos locales necesarios dentro del clon.

Para verificar el ZIP desde el clon, con Python instalado:

```powershell
python tools/create-reset-backup.py --verify
```

`SHA256SUMS.json` permite verificar el ZIP, manifiesto e historial. El `source_commit` del manifiesto identifica el commit del código contenido en el respaldo; el commit posterior que añade el propio ZIP queda en GitHub. `history.bundle` conserva las referencias locales existentes al crear el respaldo, sin incluir los objetos de LFS: los binarios actuales sí están incluidos como archivos completos dentro del ZIP.

## Validación antes del respaldo

Se ejecutaron los 47 tests unitarios y la compilación de producción; ambos pasaron. La compilación conserva una advertencia de Vite sobre una importación MIDI compartida entre carga estática y dinámica. Se verificó la integridad de los objetos locales de Git LFS. La subida debe confirmarse comparando el SHA remoto con el commit local y descargando los objetos de respaldo desde GitHub para verificar sus hashes.
