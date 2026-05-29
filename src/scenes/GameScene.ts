import Phaser from 'phaser';
import { Player } from '../player/Player';
import { ProgressStore } from '../save/ProgressStore';
import { InventoryMenu } from '../ui/InventoryMenu';
import { TouchControls } from '../ui/TouchControls';

export class GameScene extends Phaser.Scene {
  private player?: Player;
  private controls?: TouchControls;
  private inventory?: InventoryMenu;
  private heroHearts: Phaser.GameObjects.Image[] = [];
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private bKey?: Phaser.Input.Keyboard.Key;
  private menuKey?: Phaser.Input.Keyboard.Key;
  private dragon?: Phaser.GameObjects.Sprite;
  private dragonSpeech?: Phaser.GameObjects.Text;
  private dragonHealthBar?: Phaser.GameObjects.Graphics;
  private dragonHitbox?: Phaser.Geom.Rectangle;
  private dragonHp = 6;
  private readonly dragonMaxHp = 6;
  private heroHp = 3;
  private readonly heroMaxHp = 3;
  private heroInvulnerableMs = 0;
  private fireballs: Array<{ body: Phaser.GameObjects.Sprite; velocity: Phaser.Math.Vector2 }> = [];
  private fireTimerMs = 900;
  private lastTouchB = false;
  private roomBounds = new Phaser.Geom.Rectangle(38, 116, 284, 284);

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.createRoom();
    this.player = new Player(this, 180, 360);

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
    this.bKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.B);
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

    if (this.didPressLegendarySword()) {
      this.useLegendarySword();
    }

    const direction = this.getMoveDirection();
    this.player.update(delta, direction, this.roomBounds);
    this.heroInvulnerableMs = Math.max(0, this.heroInvulnerableMs - delta);
    this.updateDragon(delta);
    this.updateFireballs(delta);
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
      .text(180, 136, 'Bienvenido', {
        fontFamily: 'monospace',
        fontSize: '20px',
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

    this.add
      .text(180, 462, ProgressStore.getHeroName(), {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#fff2bd',
      })
      .setOrigin(0.5);

    this.dragon = this.add.sprite(180, 214, 'dragon-idle').setScale(0.72).setDepth(3);
    this.dragon.play('dragon-idle');
    this.dragonHitbox = new Phaser.Geom.Rectangle(this.dragon.x - 34, this.dragon.y - 28, 68, 60);
    this.dragonSpeech = this.add
      .text(180, 162, 'SIUUUU', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffdf6e',
        stroke: '#3b0d18',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(4);

    this.add
      .text(180, 502, 'Espada legendaria Nv.9999: B', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f4d06f',
      })
      .setOrigin(0.5);

    this.createHeroHearts();
    this.drawDragonHealthBar();
  }

  private didPressLegendarySword(): boolean {
    const touchB = Boolean(this.controls?.state.actionB);
    const pressed = (touchB && !this.lastTouchB) || Boolean(this.bKey && Phaser.Input.Keyboard.JustDown(this.bKey));
    this.lastTouchB = touchB;
    return pressed;
  }

  private useLegendarySword(): void {
    if (!this.player) {
      return;
    }

    const position = this.player.getPosition();
    const facingX = this.player.getFacingX();
    const swordX = position.x + facingX * 28;
    const swordY = position.y - 16;
    const swordHitbox = new Phaser.Geom.Rectangle(swordX - 14, swordY - 26, 28, 52);
    this.player.playSwordAttack();

    const damageText = this.add
      .text(position.x, position.y - 44, '9999', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#fff2bd',
        stroke: '#6d1f2b',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(7);

    this.tweens.add({
      targets: damageText,
      y: damageText.y - 20,
      alpha: 0,
      duration: 420,
      onComplete: () => damageText.destroy(),
    });

    this.fireballs = this.fireballs.filter((fireball) => {
      const distance = Phaser.Math.Distance.Between(position.x, position.y, fireball.body.x, fireball.body.y);
      if (distance < 68) {
        fireball.body.destroy();
        return false;
      }
      return true;
    });

    if (this.dragonHitbox && Phaser.Geom.Intersects.RectangleToRectangle(swordHitbox, this.dragonHitbox)) {
      this.damageDragon();
    }
  }

  private updateDragon(deltaMs: number): void {
    if (!this.dragon || !this.player) {
      return;
    }
    if (this.dragonHp <= 0) {
      return;
    }

    this.fireTimerMs -= deltaMs;
    if (this.fireTimerMs > 0) {
      return;
    }

    this.fireTimerMs = 950;
    const origin = new Phaser.Math.Vector2(this.dragon.x, this.dragon.y + 46);
    const velocity = new Phaser.Math.Vector2(0, 112);
    const body = this.add.sprite(origin.x, origin.y, 'fireball-projectile').setScale(0.32).setDepth(5);
    body.play('fireball-projectile');
    this.fireballs.push({ body, velocity });

    this.dragon.play('dragon-attack', true);
    this.dragon.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.dragonHp > 0) {
        this.dragon?.play('dragon-idle', true);
      }
    });

    this.dragonSpeech?.setVisible(true);
    this.tweens.add({
      targets: this.dragonSpeech,
        y: 154,
      alpha: 0.35,
      duration: 220,
      yoyo: true,
      onComplete: () => {
        this.dragonSpeech?.setAlpha(1);
        this.dragonSpeech?.setY(162);
      },
    });
  }

  private updateFireballs(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;
    this.fireballs = this.fireballs.filter((fireball) => {
      fireball.body.x += fireball.velocity.x * deltaSeconds;
      fireball.body.y += fireball.velocity.y * deltaSeconds;

      if (this.player && this.heroInvulnerableMs <= 0) {
        const fireHitbox = new Phaser.Geom.Rectangle(fireball.body.x - 7, fireball.body.y - 7, 14, 14);
        if (Phaser.Geom.Intersects.RectangleToRectangle(fireHitbox, this.player.getHitbox())) {
          fireball.body.destroy();
          this.damageHero();
          return false;
        }
      }

      const insideRoom = this.roomBounds.contains(fireball.body.x, fireball.body.y);
      if (!insideRoom) {
        fireball.body.destroy();
      }
      return insideRoom;
    });
  }

  private createHeroHearts(): void {
    this.heroHearts = [];
    for (let index = 0; index < this.heroMaxHp; index += 1) {
      const heart = this.add.image(58 + index * 24, 92, 'heart-full').setScale(1.3).setDepth(8);
      this.heroHearts.push(heart);
    }
  }

  private updateHeroHearts(): void {
    this.heroHearts.forEach((heart, index) => {
      heart.setTexture(index < this.heroHp ? 'heart-full' : 'heart-empty');
    });
  }

  private damageHero(): void {
    this.heroHp = Math.max(0, this.heroHp - 1);
    this.heroInvulnerableMs = 900;
    this.updateHeroHearts();
    this.cameras.main.shake(120, 0.006);

    const position = this.player?.getPosition();
    if (position) {
      const ouch = this.add
        .text(position.x, position.y - 44, '-1 corazon', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ff9aa8',
          stroke: '#3b0d18',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(8);
      this.tweens.add({
        targets: ouch,
        y: ouch.y - 18,
        alpha: 0,
        duration: 600,
        onComplete: () => ouch.destroy(),
      });
    }
  }

  private damageDragon(): void {
    if (this.dragonHp <= 0) {
      return;
    }

    this.dragonHp = Math.max(0, this.dragonHp - 1);
    this.drawDragonHealthBar();
    this.tweens.add({
      targets: this.dragon,
      tint: 0xffffff,
      duration: 80,
      yoyo: true,
      onComplete: () => this.dragon?.clearTint(),
    });

    if (this.dragonHp === 0) {
      this.dragonSpeech?.setText('NOOOO');
      this.fireballs.forEach((fireball) => fireball.body.destroy());
      this.fireballs = [];
      this.tweens.add({
        targets: this.dragon,
        alpha: 0.25,
        angle: 8,
        duration: 500,
      });
    }
  }

  private drawDragonHealthBar(): void {
    if (!this.dragonHealthBar) {
      this.dragonHealthBar = this.add.graphics().setDepth(8);
    }

    const x = 112;
    const y = 96;
    const width = 136;
    const fillWidth = Math.round((this.dragonHp / this.dragonMaxHp) * width);

    this.dragonHealthBar.clear();
    this.dragonHealthBar.fillStyle(0x160d12, 1);
    this.dragonHealthBar.fillRect(x - 3, y - 3, width + 6, 14);
    this.dragonHealthBar.fillStyle(0x6d1f2b, 1);
    this.dragonHealthBar.fillRect(x, y, width, 8);
    this.dragonHealthBar.fillStyle(0xff4f6d, 1);
    this.dragonHealthBar.fillRect(x, y, fillWidth, 8);
    this.dragonHealthBar.lineStyle(2, 0xf4d06f, 1);
    this.dragonHealthBar.strokeRect(x - 3, y - 3, width + 6, 14);
  }
}
