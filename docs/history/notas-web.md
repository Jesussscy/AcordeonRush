# AcordenRush: mapa y sonido de práctica

El instrumento tiene 31 botones melódicos (10 / 11 / 10) y 12 botones de bajos y acordes. El mapa base G/C/F está en `layout.json`. Las otras afinaciones son transposiciones virtuales del mismo mapa, incluyendo variantes una octava abajo; no representan bancos grabados de instrumentos diferentes.

Referencia del mapa base: [Hohner, GCF de 31 botones](https://hohner.de/fileadmin/documents/instruments/accordions/diatonic/HOHNER-fingeringcharts_diatonic-keyboard-GCF-31-buttons.pdf).

Audio: [FreePats Button Accordion HN](https://github.com/freepats/button-accordion-HN), licencia CC0-1.0. Los originales FLAC están en `/instrument/button-accordion-hn/`; el motor web reproduce sus versiones estéreo PCM WAV en `/instrument/recorded-hn/`, con trazabilidad en `PROVENANCE.json`; manifiesto en `/instrument/manifest.json`. Natural, Doble, Musette y Octava son registros virtuales procesados sobre este banco. Los ocho diseños visuales comparten las mismas muestras.

Los arreglos de práctica son ejercicios generados localmente. No hay transcripciones verificadas de las grabaciones comerciales en este catálogo. Las indicaciones de botones, fuelle y duración corresponden únicamente al ejercicio que se reproduce con las muestras locales. Algunas notas se adaptan al mapa seleccionado. Elegir canción o diseño no cambia silenciosamente la afinación de práctica.

Teclado: se usan posiciones físicas (`KeyboardEvent.code`) para conservar acordes con Mayús. Q–P: primera hilera; A–L, posición de Ñ/; y Z: segunda; X–M, coma, punto, posición / y posición '/": tercera. 1–0, - y =: bajos y acordes. El mapa visible usa etiquetas españolas; las teclas de puntuación pueden tener otras leyendas según tu teclado. No se requiere conexión MIDI: un acordeón externo necesita presentar estas pulsaciones de teclado; no se incluye entrada MIDI.

Tocar directamente está activado por defecto: elige fuelle cerrado o abierto y toca sin mantener aire. Espacio selecciona abierto temporalmente y, al soltar, vuelve al sentido elegido. Para el modo manual opcional, desactiva Tocar directamente: mantén Espacio para abrir y añade Mayús para cerrar. En móvil, elige Abrir/Cerrar para activar el aire y usa Detener fuelle cuando termines. El modo asistido aporta aire solo mientras sostienes botones. Una pestaña oculta o pérdida de foco pausa la reproducción y apaga todas las voces.

Pantalla grande muestra solamente el modelo 3D y el teclado debajo, con controles de sentido y salida. Usa pantalla completa nativa cuando el navegador lo permite y una vista que ocupa la página en los demás casos.
