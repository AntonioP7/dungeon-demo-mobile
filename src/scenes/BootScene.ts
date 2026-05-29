import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.image('dragon-cave-arena', '/dungeon-demo-mobile/assets/backgrounds/dragon-cave-arena-preview.png');
    this.load.spritesheet('hero-idle', '/dungeon-demo-mobile/assets/sprites/hero-epic-idle.png', {
      frameWidth: 96,
      frameHeight: 96,
    });
    this.load.spritesheet('hero-move', '/dungeon-demo-mobile/assets/sprites/hero-epic-move.png', {
      frameWidth: 96,
      frameHeight: 96,
    });
    this.load.spritesheet('hero-sword-attack', '/dungeon-demo-mobile/assets/sprites/hero-epic-sword-attack.png', {
      frameWidth: 96,
      frameHeight: 96,
    });
    this.load.spritesheet('mage-idle', '/dungeon-demo-mobile/assets/sprites/archimago_fragmento_oscuro_large_idle.png', {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.image('mage-battle', '/dungeon-demo-mobile/assets/sprites/archimago_fragmento_oscuro_battle_320x320.png');
    this.load.spritesheet('fireball-projectile', '/dungeon-demo-mobile/assets/sprites/fireball-projectile.png', {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.createSwordTexture();
    this.createHeartTexture();
  }

  create(): void {
    this.createHeroAnimations();
    this.createMageAnimations();
    this.createFireballAnimations();
    this.scene.start('GameScene');
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

  private createMageAnimations(): void {
    this.anims.create({
      key: 'mage-idle',
      frames: this.anims.generateFrameNumbers('mage-idle', { start: 0, end: 7 }),
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: 'mage-attack',
      frames: this.anims.generateFrameNumbers('mage-idle', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: 0,
    });
  }

  private createHeroAnimations(): void {
    this.anims.create({
      key: 'hero-idle',
      frames: this.anims.generateFrameNumbers('hero-idle', { start: 0, end: 7 }),
      frameRate: 4,
      repeat: -1,
    });

    this.anims.create({
      key: 'hero-move',
      frames: this.anims.generateFrameNumbers('hero-move', { start: 0, end: 7 }),
      frameRate: 7,
      repeat: -1,
    });

    this.anims.create({
      key: 'hero-sword-attack',
      frames: this.anims.generateFrameNumbers('hero-sword-attack', { start: 0, end: 7 }),
      frameRate: 12,
      repeat: 0,
    });
  }

  private createFireballAnimations(): void {
    this.anims.create({
      key: 'fireball-projectile',
      frames: this.anims.generateFrameNumbers('fireball-projectile', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });
  }
}
