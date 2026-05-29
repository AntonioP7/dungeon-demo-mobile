import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.createPlayerTexture();
  }

  create(): void {
    this.scene.start('GameScene');
  }

  private createPlayerTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);

    graphics.fillStyle(0x5c3a21);
    graphics.fillRect(5, 1, 10, 5);
    graphics.fillStyle(0xf0b47a);
    graphics.fillRect(4, 5, 12, 8);
    graphics.fillStyle(0x263f73);
    graphics.fillRect(5, 13, 10, 11);
    graphics.fillStyle(0x172744);
    graphics.fillRect(5, 24, 4, 5);
    graphics.fillRect(11, 24, 4, 5);
    graphics.fillStyle(0x1a1a1a);
    graphics.fillRect(7, 8, 2, 2);
    graphics.fillRect(12, 8, 2, 2);
    graphics.fillStyle(0xf0b47a);
    graphics.fillRect(2, 14, 3, 8);
    graphics.fillRect(15, 14, 3, 8);
    graphics.generateTexture('hero-idle', 20, 30);
    graphics.destroy();
  }
}
