import Phaser from 'phaser';

export type MoveDirection = {
  x: number;
  y: number;
};

export class Player {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly speed = 130;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.add.sprite(x, y, 'hero-idle');
    this.sprite.setScale(2);
    this.sprite.setDepth(3);
  }

  update(deltaMs: number, direction: MoveDirection, bounds: Phaser.Geom.Rectangle): void {
    const deltaSeconds = deltaMs / 1000;
    const normalized = new Phaser.Math.Vector2(direction.x, direction.y);

    if (normalized.lengthSq() > 0) {
      normalized.normalize();
    }

    this.sprite.x += normalized.x * this.speed * deltaSeconds;
    this.sprite.y += normalized.y * this.speed * deltaSeconds;

    const halfWidth = this.sprite.displayWidth / 2;
    const halfHeight = this.sprite.displayHeight / 2;
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, bounds.left + halfWidth, bounds.right - halfWidth);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, bounds.top + halfHeight, bounds.bottom - halfHeight);

    if (normalized.x !== 0) {
      this.sprite.setFlipX(normalized.x < 0);
    }
  }
}
