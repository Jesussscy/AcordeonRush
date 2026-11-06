---
name: vallenato-hero-design
description: Game design rules for Vallenato Hero (rhythm game on a 3D vallenato accordion) - HUD layout, scoring, timing windows, error types and detune feedback, bellows, Parranda mode, streak milestones, difficulty, results, and the original vallenato aesthetic. Use for any gameplay, HUD, audio-feedback, stage or UI work.
---

# Vallenato Hero — reglas de diseño

Inspirado en el LAYOUT de un juego de ritmo de autopista, con arte 100% original: sin logos, nombres, personajes, fuentes ni assets de otros juegos.

## Escena
- Cámara baja detrás del acordeón mirando al escenario. Autopista centrada abajo, se pierde en perspectiva.
- Escenario de caseta/festival: luces de colores y reflectores barriendo, parlantes apilados, guirnaldas y pantalla LED. Acordeonero con sombrero vueltiao al frente; cajero y guacharaquero detrás, todos low-poly procedurales y animados al beat. El fuelle del acordeonero se sincroniza con el del jugador.
- Público en siluetas que reacciona al Ambientómetro (salta / aplaude / abuchea).
- El acordeón 3D del jugador va abajo: el botón presionado se hunde y brilla y el fuelle sigue la dirección.

## Autopista
- Superficie oscura de cuero o madera con un motivo tejido de vueltiao muy sutil. Trastes por beat y una línea más gruesa por compás.
- 3 carriles: afuera = verde, medio = amarillo, adentro = rojo. Anillos objetivo al fondo.
- Gema = botón de acordeón con su id visible (`M5`). Borde y flecha de fuelle: **azul ← cerrar**, **naranja → abrir**. Franja lateral que anticipa los cambios de fuelle.
- Las notas sostenidas tienen cola que vibra mientras se mantienen. Las gemas Parranda brillan en dorado pulsante.

## HUD
- **Izquierda:** puntaje LED de 7 segmentos con dígitos que ruedan; círculo multiplicador x1–x4 (x8 dorado en Parranda); 10 lucecitas; odómetro de racha con hitos en 25/50/100/200/500 ("¡50 NOTAS SEGUIDAS!", grito y chispas); "Mejor: N" debajo, que brilla al superarse. Al romperse la racha el odómetro se atasca, los dígitos caen, suena un golpe y aparece "Racha perdida: N".
- **Derecha:** Ambientómetro semicircular con aguja física (inercia y rebote) y zonas roja/amarilla/verde ("¡PARRANDA!" en la verde). En rojo hay alarma suave; en 0 la partida termina con "¡Se acabó la parranda!". Encima, 3 sombreros vueltiaos que se llenan con las frases Parranda. Con ≥ 50 % se activa Parranda con Enter o con una sacudida rápida del fuelle.
- **Arriba:** progreso de la canción, título y artista al inicio, textos de timing (¡PERFECTO! / ¡BIEN! / OK) y "Perfectos seguidos".

## Fuelle activo (“rasgueo”), decisión del usuario
- En el juego y en el modo práctica el fuelle NO es automático: botones = trastes, fuelle = rasgueo.
- Mantener `Espacio` = cerrar (push), soltar = abrir (pull). Remapeable.
- Cada cambio de fuelle del chart es un evento juzgado (mismas ventanas) que se muestra en la franja lateral.
- Una nota solo cuenta si el botón y la dirección son correctos en ese instante. Con la dirección equivocada suena la OTRA nota del botón (bisonoro real) y aparece “¡FUELLE!”.
- La opción “Fuelle asistido” está apagada por defecto y sirve solo para aprender.

## Puntaje y timing
| Juicio | Ventana | Puntos base |
|---|---|---|
| Perfecto | ±35 ms | 50 |
| Bien | ±70 ms | 35 |
| OK | ±110 ms | 20 |
- Puntos = base × multiplicador. Sostenidas: 25 por beat mantenido.
- Multiplicador: sube 1 nivel cada 10 aciertos seguidos (x1→x4); en Parranda se dobla (máx. x8).
- Botón correcto con fuelle incorrecto: como máximo OK, y **rompe** el multiplicador.
- Ventanas medidas contra el tiempo de audio (AudioContext) menos la calibración de latencia.

## Errores (deben SENTIRSE y ENSEÑAR)
| Tipo | Etiqueta | Feedback específico |
|---|---|---|
| Nota perdida | ¡FALLO! | gema gris, agrietada, pasa de largo |
| Botón equivocado | BOTÓN | en el 3D: rojo el presionado, verde el correcto |
| Fuelle equivocado | ¡FUELLE! | la flecha correcta parpadea grande |
| Temprano / tarde | TEMPRANO / TARDE | indicador de desfase |
| Nota fantasma | (leve) | pequeña penalización al medidor, sin romper racha en Fácil |
Comunes: leve sacudida de cámara, viñeta roja breve, el multiplicador cae a x1 con animación y las lucecitas se apagan; la aguja baja y el público abuchea tras varios fallos seguidos.
- **Audio al fallar:** la pista del acordeón se desafina entre −40 y −80 cents, con wobble y bitcrush ligero y menos volumen, y se recupera en ~300 ms al acertar. Suena una "pifia" (cluster disonante corto, 3 variantes aleatorias). El acompañamiento NUNCA se detiene.
  - Pista mp3: no usar `detune`/`playbackRate`, porque desincroniza. Usar vibrato por DelayNode modulado, filtro, waveshaper y ganancia.
- **Anti-frustración:** en Fácil, los primeros 2 fallos solo bajan el medidor.

## Modos y dificultad
- Fácil: solo la hilera del medio. Medio: medio + afuera. Difícil: 3 hileras con densidad reducida. Experto: 3 hileras, chart completo.
- Práctica: velocidad del 50 al 100 %, bucle de sección y nombre de la nota visible.
- Calibración de latencia de audio y video.

## Resultados
1–5 sombreros, % de acierto, racha máxima (aviso de récord), desglose Perfecto/Bien/OK/Fallo y por tipo de error, y un consejo según el error más frecuente. Récords en localStorage por canción y dificultad.

## Estética
Paleta caribeña nocturna: negro cálido, dorado, rojo, verde y amarillo de las guirnaldas, y el patrón vueltiao en negro y crema. Tipografías libres (Google Fonts) y textos en español. Rendimiento: 60 FPS en un portátil normal y bloom ligero.
