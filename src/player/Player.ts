import Phaser from 'phaser';

export type MoveDirection = {
  x: number;
  y: number;
};

export class Player {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly speed = 130;
  private facingX = 1;
  private isAttacking = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.add.sprite(x, y, 'hero-idle');
    this.sprite.setScale(0.62);
    this.sprite.setDepth(3);
    this.sprite.play('hero-idle');
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

    if (!this.isAttacking) {
      this.sprite.play(normalized.lengthSq() > 0 ? 'hero-move' : 'hero-idle', true);
    }
  }

  getPosition(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  getFacingX(): number {
    return this.facingX;
  }

  getHitbox(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.sprite.x - 15, this.sprite.y - 20, 30, 40);
  }

  playSwordAttack(): void {
    this.isAttacking = true;
    this.sprite.play('hero-sword-attack', true);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.isAttacking = false;
      this.sprite.play('hero-idle', true);
    });
  }
}
