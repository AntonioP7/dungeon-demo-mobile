import Phaser from 'phaser';

export type MoveDirection = {
  x: number;
  y: number;
};

export class Player {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly speed = 130;
  private facingX = 1;

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
      this.facingX = normalized.x < 0 ? -1 : 1;
      this.sprite.setFlipX(this.facingX < 0);
    }
  }

  getPosition(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  getFacingX(): number {
    return this.facingX;
  }

  getHitbox(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.sprite.x - 14, this.sprite.y - 18, 28, 36);
  }
}
