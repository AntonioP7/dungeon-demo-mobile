# Plan Para Demo Inicial De Dungeon 2D Movil

## Resumen
Antes de implementar, crear `README.md` con este plan como documento base del proyecto. Despues crear una primera demo jugable en navegador movil vertical con estilo retro pixel 2D, vista cenital tipo Zelda, usando **Phaser 3 + TypeScript + Vite**.

La demo incluira una sala inicial cuadrada con texto "Bienvenido", un personaje joven de pelo castano que pueda moverse, controles tactiles con flechas, botones `A`, `B` y boton de menu. El menu mostrara huecos vacios para items.

## Cambios Clave
- Crear `README.md` con el plan del juego, stack elegido, controles y alcance de la primera demo.
- Crear proyecto web con Vite, TypeScript y Phaser.
- Configurar canvas responsive para **movil vertical**, pixel-art y escalado nitido.
- Crear escena principal con:
  - Sala cuadrada cerrada.
  - Texto "Bienvenido".
  - Personaje provisional preparado para sprites personalizados.
  - Movimiento top-down en cuatro direcciones.
- Anadir controles:
  - Cruceta tactil.
  - Boton `A` para interactuar.
  - Boton `B` para accion futura.
  - Boton de menu.
  - Teclado para pruebas en ordenador.
- Anadir menu de inventario:
  - Panel superpuesto.
  - Cuadricula de huecos vacios.
  - Apertura/cierre con boton de menu.
  - Movimiento bloqueado mientras este abierto.

## Estructura De Implementacion
- `README.md`: plan y decisiones iniciales del proyecto.
- `src/main.ts`: arranque de Phaser y configuracion responsive.
- `src/scenes/BootScene.ts`: preparacion de recursos minimos.
- `src/scenes/GameScene.ts`: sala inicial, jugador, movimiento y controles.
- `src/ui/TouchControls.ts`: botones tactiles y estado de input.
- `src/ui/InventoryMenu.ts`: menu visual de huecos de items.
- `src/player/Player.ts`: logica del personaje.
- `src/styles.css`: pantalla completa, pixel rendering y UI movil.

## Plan De Pruebas
- Verificar que el proyecto instala y compila.
- Probar en escritorio con teclado.
- Probar viewport movil vertical, por ejemplo 390x844.
- Confirmar movimiento, limites de sala, botones tactiles y menu.
- Hacer captura de verificacion tras implementar.

## Supuestos
- Vista top-down tipo Zelda.
- Primera demo sin combate ni puzzles todavia.
- `A` queda reservado para interactuar.
- `B` queda reservado para accion.
- Menu solo visual por ahora, sin items ni guardado.
- Prioridad absoluta: navegador movil vertical.

## Guardado Local De Progreso
- El progreso se guarda por dispositivo y navegador usando `localStorage`.
- La primera pantalla pide el nombre del heroe.
- Si el dispositivo ya tiene nombre guardado, el juego salta directamente al nivel 1.
- La version inicial guarda `heroName` y `currentLevel`.
