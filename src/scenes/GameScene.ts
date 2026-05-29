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
  private dragonHp = 12;
  private readonly dragonMaxHp = 12;
  private heroHp = 3;
  private readonly heroMaxHp = 3;
  private heroInvulnerableMs = 0;
  private fireballs: Array<{ body: Phaser.GameObjects.Sprite; velocity: Phaser.Math.Vector2 }> = [];
  private fireTimerMs = 900;
  private lastTouchB = false;
  private lastTouchA = false;
  private combatPhase: 'action' | 'turn' | 'defeated' = 'action';
  private turnInputLocked = false;
  private heroIsDefending = false;
  private turnOverlay?: Phaser.GameObjects.Container;
  private turnStatusText?: Phaser.GameObjects.Text;
  private roomBounds = new Phaser.Geom.Rectangle(34, 128, 292, 332);

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

    if (this.combatPhase === 'turn') {
      this.updateTurnCombat();
      return;
    }

    if (this.didPressB()) {
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

    this.add.image(180, 320, 'dragon-cave-arena').setDepth(0);

    this.add
      .text(180, 112, 'Bienvenido', {
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

    this.dragon = this.add.sprite(180, 218, 'mage-idle').setScale(0.72).setDepth(3);
    this.dragon.play('mage-idle');
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

  private didPressB(): boolean {
    const touchB = Boolean(this.controls?.state.actionB);
    const pressed = (touchB && !this.lastTouchB) || Boolean(this.bKey && Phaser.Input.Keyboard.JustDown(this.bKey));
    this.lastTouchB = touchB;
    return pressed;
  }

  private didPressA(): boolean {
    const touchA = Boolean(this.controls?.state.actionA);
    const pressed = touchA && !this.lastTouchA;
    this.lastTouchA = touchA;
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
    const target = this.player.getPosition();
    const velocity = new Phaser.Math.Vector2(target.x - origin.x, target.y - origin.y);
    if (velocity.lengthSq() === 0) {
      velocity.set(0, 1);
    }
    velocity.normalize().scale(128);
    const body = this.add.sprite(origin.x, origin.y, 'fireball-projectile').setScale(0.32).setDepth(5);
    body.setRotation(velocity.angle() + Math.PI / 2);
    body.play('fireball-projectile');
    this.fireballs.push({ body, velocity });

    this.dragon.play('mage-attack', true);
    this.dragon.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.dragonHp > 0) {
        this.dragon?.play('mage-idle', true);
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
    if (this.dragonHp <= 0 || this.combatPhase === 'defeated') {
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

    if (this.dragonHp <= this.dragonMaxHp / 2 && this.combatPhase === 'action') {
      this.startTurnCombat();
      return;
    }

    if (this.dragonHp === 0) {
      this.defeatMage();
    }
  }

  private startTurnCombat(): void {
    this.combatPhase = 'turn';
    this.turnInputLocked = false;
    this.heroIsDefending = false;
    this.fireballs.forEach((fireball) => fireball.body.destroy());
    this.fireballs = [];
    this.dragon?.setVisible(false);
    this.dragonSpeech?.setText('FASE POR TURNOS');

    const shade = this.add.rectangle(180, 320, 360, 640, 0x05080a, 0.62);
    const mage = this.add.image(180, 210, 'mage-battle').setScale(0.68);
    const panel = this.add.rectangle(180, 482, 304, 112, 0x172b32, 0.94).setStrokeStyle(3, 0xf4d06f);
    const title = this.add
      .text(180, 430, 'Combate por turnos', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#fff2bd',
      })
      .setOrigin(0.5);
    const status = this.add
      .text(180, 466, 'Tu turno', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#b9d8c2',
      })
      .setOrigin(0.5);
    const actions = this.add
      .text(180, 514, 'B Atacar    A Defender', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#f4d06f',
      })
      .setOrigin(0.5);

    this.turnStatusText = status;
    this.turnOverlay = this.add.container(0, 0, [shade, mage, panel, title, status, actions]).setDepth(20);
    this.cameras.main.flash(260, 95, 30, 110);
    this.drawDragonHealthBar();
  }

  private updateTurnCombat(): void {
    this.heroInvulnerableMs = 0;
    if (this.turnInputLocked) {
      return;
    }

    if (this.didPressB()) {
      this.playHeroTurnAttack();
      return;
    }

    if (this.didPressA()) {
      this.heroIsDefending = true;
      this.turnStatusText?.setText('Te defiendes');
      this.scheduleMageTurn();
    }
  }

  private playHeroTurnAttack(): void {
    if (!this.player) {
      return;
    }

    this.turnInputLocked = true;
    this.player.playSwordAttack();
    this.dragonHp = Math.max(0, this.dragonHp - 2);
    this.drawDragonHealthBar();
    this.turnStatusText?.setText('Golpe legendario: -2');
    this.tweens.add({
      targets: this.turnOverlay?.getAt(1),
      x: 188,
      duration: 70,
      yoyo: true,
      onComplete: () => {
        if (this.dragonHp === 0) {
          this.defeatMage();
          return;
        }
        this.scheduleMageTurn();
      },
    });
  }

  private scheduleMageTurn(): void {
    this.turnInputLocked = true;
    this.time.delayedCall(620, () => this.playMageTurn());
  }

  private playMageTurn(): void {
    if (this.combatPhase !== 'turn') {
      return;
    }

    if (this.heroIsDefending) {
      this.turnStatusText?.setText('Bloqueas el conjuro');
      this.heroIsDefending = false;
    } else {
      this.turnStatusText?.setText('El mago contraataca');
      this.damageHero();
    }

    this.time.delayedCall(760, () => {
      if (this.combatPhase === 'turn') {
        this.turnStatusText?.setText('Tu turno');
        this.turnInputLocked = false;
      }
    });
  }

  private defeatMage(): void {
    this.combatPhase = 'defeated';
    this.dragonHp = 0;
    this.drawDragonHealthBar();
    this.dragonSpeech?.setText('NOOOO');
    this.fireballs.forEach((fireball) => fireball.body.destroy());
    this.fireballs = [];
    this.turnStatusText?.setText('Mago derrotado');
    this.tweens.add({
      targets: this.turnOverlay ?? this.dragon,
      alpha: 0.25,
      angle: 3,
      duration: 500,
    });
  }

  private drawDragonHealthBar(): void {
    if (!this.dragonHealthBar) {
      this.dragonHealthBar = this.add.graphics().setDepth(8);
    }

    this.dragonHealthBar.setDepth(this.combatPhase === 'turn' || this.combatPhase === 'defeated' ? 22 : 8);

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
