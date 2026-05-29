import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.createPlayerTexture();
    this.createDragonTexture();
    this.createSwordTexture();
    this.createHeartTexture();
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

  private createDragonTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);

    graphics.fillStyle(0x6d1f2b);
    graphics.fillRect(10, 12, 28, 22);
    graphics.fillStyle(0x9f2f3f);
    graphics.fillRect(16, 6, 20, 12);
    graphics.fillRect(4, 16, 10, 10);
    graphics.fillRect(34, 16, 10, 10);
    graphics.fillStyle(0xf4d06f);
    graphics.fillRect(18, 3, 4, 5);
    graphics.fillRect(30, 3, 4, 5);
    graphics.fillStyle(0xffe39a);
    graphics.fillRect(21, 11, 3, 3);
    graphics.fillRect(30, 11, 3, 3);
    graphics.fillStyle(0x1a1a1a);
    graphics.fillRect(22, 12, 1, 1);
    graphics.fillRect(31, 12, 1, 1);
    graphics.fillStyle(0xff7a1a);
    graphics.fillRect(25, 18, 7, 4);
    graphics.fillStyle(0xf4d06f);
    graphics.fillTriangle(10, 34, 16, 46, 22, 34);
    graphics.fillTriangle(26, 34, 32, 46, 38, 34);
    graphics.generateTexture('legendary-dragon', 48, 48);
    graphics.destroy();
  }

  private createSwordTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);

    graphics.fillStyle(0xfff2a8);
    graphics.fillRect(13, 0, 6, 30);
    graphics.fillStyle(0xffffff);
    graphics.fillRect(15, 2, 2, 24);
    graphics.fillStyle(0xf4d06f);
    graphics.fillRect(6, 27, 20, 5);
    graphics.fillStyle(0x6d4a2d);
    graphics.fillRect(13, 31, 6, 11);
    graphics.fillStyle(0xffd166);
    graphics.fillRect(11, 41, 10, 4);
    graphics.generateTexture('legendary-sword', 32, 48);
    graphics.destroy();
  }

  private createHeartTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);

    graphics.fillStyle(0xff4f6d);
    graphics.fillRect(4, 2, 4, 4);
    graphics.fillRect(10, 2, 4, 4);
    graphics.fillRect(2, 6, 14, 6);
    graphics.fillRect(4, 12, 10, 4);
    graphics.fillRect(7, 16, 4, 3);
    graphics.fillStyle(0xffa3b5);
    graphics.fillRect(5, 4, 2, 2);
    graphics.generateTexture('heart-full', 18, 20);
    graphics.clear();
    graphics.lineStyle(2, 0xff4f6d);
    graphics.strokeRect(3, 4, 12, 10);
    graphics.strokeTriangle(4, 13, 14, 13, 9, 18);
    graphics.generateTexture('heart-empty', 18, 20);
    graphics.destroy();
  }
}
