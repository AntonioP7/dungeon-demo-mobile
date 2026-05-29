import Phaser from 'phaser';
import { Player } from '../player/Player';
import { InventoryMenu } from '../ui/InventoryMenu';
import { TouchControls } from '../ui/TouchControls';

export class GameScene extends Phaser.Scene {
  private player?: Player;
  private controls?: TouchControls;
  private inventory?: InventoryMenu;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private menuKey?: Phaser.Input.Keyboard.Key;
  private roomBounds = new Phaser.Geom.Rectangle(38, 116, 284, 284);

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.createRoom();
    this.player = new Player(this, 180, 260);

    const uiRoot = document.querySelector<HTMLElement>('#ui-root');
    if (!uiRoot) {
      throw new Error('Missing #ui-root element');
    }

    uiRoot.innerHTML = '';
    this.inventory = new InventoryMenu(uiRoot);
    this.controls = new TouchControls(uiRoot, () => this.inventory?.toggle());

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
    this.menuKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.M);
  }

  update(_time: number, delta: number): void {
    if (!this.player || !this.controls) {
      return;
    }

    if (this.menuKey && Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      this.inventory?.toggle();
    }

    if (this.inventory?.isOpen) {
      return;
    }

    const direction = this.getMoveDirection();
    this.player.update(delta, direction, this.roomBounds);
  }

  private getMoveDirection(): { x: number; y: number } {
    const touch = this.controls?.state;
    const keyboard = this.cursors;
    const wasd = this.wasd;

    return {
      x: Number(Boolean(touch?.right || keyboard?.right.isDown || wasd?.right.isDown)) -
        Number(Boolean(touch?.left || keyboard?.left.isDown || wasd?.left.isDown)),
      y: Number(Boolean(touch?.down || keyboard?.down.isDown || wasd?.down.isDown)) -
        Number(Boolean(touch?.up || keyboard?.up.isDown || wasd?.up.isDown)),
    };
  }

  private createRoom(): void {
    this.cameras.main.setBackgroundColor('#101820');

    const graphics = this.add.graphics();
    graphics.fillStyle(0x182c2f);
    graphics.fillRect(0, 0, 360, 640);

    graphics.fillStyle(0x2d4a3e);
    graphics.fillRect(this.roomBounds.x, this.roomBounds.y, this.roomBounds.width, this.roomBounds.height);

    graphics.lineStyle(6, 0x8f6d3d);
    graphics.strokeRect(this.roomBounds.x, this.roomBounds.y, this.roomBounds.width, this.roomBounds.height);

    graphics.lineStyle(2, 0xc7a252);
    graphics.strokeRect(this.roomBounds.x + 8, this.roomBounds.y + 8, this.roomBounds.width - 16, this.roomBounds.height - 16);

    for (let x = this.roomBounds.x + 28; x < this.roomBounds.right - 8; x += 40) {
      for (let y = this.roomBounds.y + 34; y < this.roomBounds.bottom - 8; y += 40) {
        graphics.fillStyle(0x345946, 0.55);
        graphics.fillRect(x, y, 16, 16);
      }
    }

    this.add
      .text(180, 154, 'Bienvenido', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#f8e8a8',
        stroke: '#162020',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(180, 424, 'Mueve al heroe', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#b9d8c2',
      })
      .setOrigin(0.5);
  }
}
