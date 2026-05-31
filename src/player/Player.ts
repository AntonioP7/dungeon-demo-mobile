import Phaser from 'phaser';

export type MoveDirection = {
  x: number;
  y: number;
};

export class Player {
  private readonly sprite: Phaser.GameObjects.Rectangle;
  private readonly speed = 220;
  private facingX = 1;
  private aimDirection = new Phaser.Math.Vector2(0, -1);
  private knockbackVelocity = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.add.rectangle(x, y, 34, 34, 0x4aa3ff).setStrokeStyle(3, 0xd8f3ff).setDepth(10);
  }

  update(
    deltaMs: number,
    direction: MoveDirection,
    bounds: Phaser.Geom.Rectangle,
    blockers: Phaser.Geom.Rectangle[] = [],
  ): void {
    const deltaSeconds = deltaMs / 1000;
    const normalized = new Phaser.Math.Vector2(direction.x, direction.y);

    if (normalized.lengthSq() > 0) {
      normalized.normalize();
    }

    if (this.knockbackVelocity.lengthSq() > 1) {
      this.tryMove(this.knockbackVelocity.x * deltaSeconds, 0, bounds, blockers);
      this.tryMove(0, this.knockbackVelocity.y * deltaSeconds, bounds, blockers);
      this.knockbackVelocity.scale(0.86);
      return;
    }

    this.knockbackVelocity.set(0, 0);
    this.tryMove(normalized.x * this.speed * deltaSeconds, 0, bounds, blockers);
    this.tryMove(0, normalized.y * this.speed * deltaSeconds, bounds, blockers);

    if (normalized.x !== 0) {
      this.facingX = normalized.x < 0 ? -1 : 1;
    }

    if (normalized.lengthSq() > 0) {
      this.aimDirection = normalized.clone();
    }
  }

  getPosition(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  getFacingX(): number {
    return this.facingX;
  }

  getAimDirection(): Phaser.Math.Vector2 {
    return this.aimDirection.clone();
  }

  getHitbox(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.sprite.x - 17, this.sprite.y - 17, 34, 34);
  }

  getSprite(): Phaser.GameObjects.Rectangle {
    return this.sprite;
  }

  playSwordAttack(): void {
    this.sceneTweenPulse(0xffffff, 80);
  }

  flashHit(): void {
    this.sceneTweenPulse(0xff6d7a, 120);
  }

  knockBackFrom(origin: Phaser.Math.Vector2, force: number): void {
    const direction = this.getPosition().subtract(origin);
    if (direction.lengthSq() === 0) {
      direction.set(0, 1);
    }
    this.knockbackVelocity = direction.normalize().scale(force);
    this.sceneTweenPulse(0xffd166, 140);
  }

  private tryMove(dx: number, dy: number, bounds: Phaser.Geom.Rectangle, blockers: Phaser.Geom.Rectangle[]): void {
    const previousX = this.sprite.x;
    const previousY = this.sprite.y;
    this.sprite.x += dx;
    this.sprite.y += dy;

    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, bounds.left + 17, bounds.right - 17);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, bounds.top + 17, bounds.bottom - 17);

    const hitbox = this.getHitbox();
    if (blockers.some((blocker) => Phaser.Geom.Intersects.RectangleToRectangle(hitbox, blocker))) {
      this.sprite.setPosition(previousX, previousY);
    }
  }

  private sceneTweenPulse(color: number, duration: number): void {
    this.sprite.setFillStyle(color);
    this.sprite.scene.time.delayedCall(duration, () => this.sprite.setFillStyle(0x4aa3ff));
  }
}
