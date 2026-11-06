# Biblioteca sonora del asset

34 archivos FLAC estéreo: 17 muestras sostenidas y 17 de liberación de tecla. Proceden de [Button Accordion HN, FreePats](https://freepats.zenvoid.org/Organ/accordion.html) y su [repositorio original](https://github.com/freepats/button-accordion-HN). Grabación: Jeff Stauffer, noviembre de 2023; procesamiento del banco: michael02022; intermediación: Piotr Barz. Licencia CC0-1.0, incluida en `button-accordion-hn/LICENSE.txt`.

Los archivos y referencias SFZ que incluían `F#` se renombraron a `Fs` para evitar que servidores web interpreten el sostenido como fragmento de URL. No se modificó el audio de las grabaciones. `file_manifest.json` conserva tamaños, frecuencia original, muestras y SHA-256. Los puntos de loop se convierten de muestras originales de 44,1 kHz a segundos; así siguen siendo correctos al decodificar en un contexto de 48 kHz.

Registros disponibles: **natural**, **doble**, **musette** y **octava**. El primero reproduce el banco original; los restantes son combinaciones virtuales de esas mismas muestras con desafinación leve u octavación. No son cuatro instrumentos grabados ni emulaciones certificadas de marcas. También se incluyen cuatro transposiciones virtuales: GCF, ADG, F/B♭/E♭ y EAD. El mapa de los 43 botones es demostrativo y debe revisarlo un intérprete antes de presentarlo como digitación pedagógica exacta de un acordeón comercial.

Uso: `createAccordionAudio()` en `../accordion-audio.js`, `unlock()` desde un gesto del usuario, después `await preload()`. `setBellows('pull', 0.65)` o `setBellows('push', 0.65)` establece sentido y presión; con presión cero no hay nota. `noteOn('Melody_05')` y `noteOff('Melody_05')` inician/sueltan la nota. Los bajos pares del mapa disparan acordes; los demás disparan notas graves. `setProfile('musette')` y `setTuning('ADG')` cambian registro y transposición. `allNotesOff()` debe ejecutarse cuando el juego pierde foco; `dispose()` desconecta el controlador.

El controlador usa un ataque suave, sustain mediante los loops del SFZ, muestras reales de note-off, caída de ganancia, filtro discreto según dirección y control de dinámica. El mismo botón cambia de nota según empujar/halar. La afinación cambia mediante reproducción a distinta velocidad, de modo que las notas lejanas al registro grabado alteran también el timbre. No se incluyen muestras independientes de bajo profundo ni ruidos mecánicos adicionales grabados.

`../preview.html` sincroniza las pulsaciones manuales y las de los clips con el controlador sonoro. El fuelle sonoro del visor se controla manualmente con el sentido y el deslizador de presión; en el juego se debe alimentar desde el control real de fuelle. Los clips de apertura no generan melodías por sí mismos.

El GLB estándar contiene geometría, PBR y animaciones, y se distribuye junto con esta carpeta. No necesita extensiones propietarias de audio. En el `.blend` se incluyen las grabaciones como biblioteca empaquetada, sin pistas sonoras en la línea de tiempo.

Se ejecutó la decodificación de los 34 FLAC y síntesis offline de los cuatro registros en navegador, con melodía y acorde de bajo. `audio_qa.json` guarda picos y RMS medidos y comprueba ausencia de saturación y retorno a silencio al soltar. Esta es una verificación técnica de señal; no equivale a una evaluación auditiva humana ni a una certificación acústica del instrumento.
