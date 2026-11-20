# Prompt para evolucionar el frontend de Vallenato Hero

Actúa como diseñador de producto y desarrollador frontend sénior. Trabaja sobre este repositorio React, TypeScript y Vite. Revisa primero App.tsx, los componentes de src/ui, el estudio en src/ui/studio y los estilos que cargan. Identifica las rutas reales y conserva sus interacciones al modificarlas.

Rediseña la experiencia completa siguiendo el lenguaje visual del estudio. Usa un fondo verde carbón, superficies oscuras, texto marfil, secundarios gris verdoso y acentos melocotón. Usa Manrope para títulos y DM Sans para texto. Define tamaños, espacios, bordes, estados de foco y componentes compartidos para que el menú, la biblioteca, los ajustes, la calibración, los resultados y las ventanas del juego se sientan parte del mismo producto.

El menú debe presentar el acordeón como protagonista y una acción clara para jugar. Da acceso a Práctica, Demostración, Estudio libre, Canciones privadas, Ajustes y Calibración. Usa los modelos y recursos del proyecto. Mantén una composición equilibrada en escritorio y una lectura cómoda en móvil. Cada texto debe ayudar a decidir, navegar o actuar.

En la selección de canciones, permite identificar el título, artista, tempo, origen privado, grabación disponible y récord. Distingue la selección mediante borde, fondo y estado accesible. Mantén dificultades, controles de práctica, selección del acordeón y entrada a la partida. Explica los controles con texto breve y comprensible.

Desarrolla una biblioteca privada accesible desde el menú y el selector. Permite importar MIDI o chart JSON con título y artista opcionales, afinación automática o manual y grabación MP3, WAV u OGG opcional. Incluye el desplazamiento de sincronización. Valida formatos, tamaño, notas, afinación y decodificación del audio antes de guardar. Muestra las notas que quedan fuera del rango del instrumento. El MIDI aporta la melodía jugable y el audio aporta la grabación de fondo.

Guarda los archivos privados en IndexedDB y restaura la biblioteca al iniciar. Confirma las escrituras antes de mostrar éxito. Permite practicar y eliminar canciones importadas, libera las URL de objetos que dejen de utilizarse y comunica los fallos de almacenamiento. Explica que la biblioteca pertenece al navegador y se elimina al borrar sus datos. Conecta las nuevas canciones tanto con el juego como con el estudio, incluso cuando el usuario ya haya visitado esas pantallas en la misma sesión.

Diseña los estados vacíos, carga, importación, éxito, fallo, selección, pausa y resultado. Evita introducir acompañamientos musicales ajenos a la melodía elegida. Conserva el reloj musical, el mapeo de botones, el fuelle, la calibración y la liberación de recursos de audio y WebGL.

Verifica navegación por teclado, etiquetas de formularios, contraste, foco visible, botones táctiles y movimiento reducido. Comprueba anchos de 390, 768 y 1440 píxeles y corrige desbordamientos. Revisa la apariencia después de entrar y salir del estudio porque sus estilos se cargan de forma diferida.

Entrega los cambios implementados y comprobados. Ejecuta la compilación, las pruebas pertinentes y una revisión en navegador. Prueba la importación, la recarga, la selección de una canción privada y su eliminación. Informa qué se verificó, qué depende de los archivos del usuario y cualquier limitación pendiente.
