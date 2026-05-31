import Phaser from 'phaser';
import { CoverObject, DuelistBoss } from '../boss/DuelistBoss';
import { Player } from '../player/Player';
import { ProgressStore } from '../save/ProgressStore';
import { InventoryMenu } from '../ui/InventoryMenu';
import { TouchControls } from '../ui/TouchControls';

export class GameScene extends Phaser.Scene {
  private player?: Player;
  private controls?: TouchControls;
  private inventory?: InventoryMenu;
  private duelistBoss?: DuelistBoss;
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
  private turnMageSprite?: Phaser.GameObjects.Image;
  private turnHeroSprite?: Phaser.GameObjects.Sprite;
  private turnStatusText?: Phaser.GameObjects.Text;
  private blockers: Phaser.Geom.Rectangle[] = [];
  private covers: CoverObject[] = [];
  private tacticalPoints: Phaser.Math.Vector2[] = [];
  private heroShots: Array<{ body: Phaser.GameObjects.Arc; velocity: Phaser.Math.Vector2; ageMs: number }> = [];
  private heroShotCooldownMs = 0;
  private isDesktopLayout = false;
  private roomBounds = new Phaser.Geom.Rectangle(34, 128, 292, 332);

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.isDesktopLayout = this.scale.gameSize.width >= 1000;
    this.roomBounds = new Phaser.Geom.Rectangle(384, 240, 1280, 760);
    this.createRoom();
    const playerStart = new Phaser.Math.Vector2(1024, 860);
    const bossStart = new Phaser.Math.Vector2(1024, 510);
    this.player = new Player(this, playerStart.x, playerStart.y);
    this.duelistBoss = new DuelistBoss(this, {
      x: bossStart.x,
      y: bossStart.y,
      roomBounds: this.roomBounds,
      tacticalPoints: this.tacticalPoints,
      covers: this.covers,
      onHeroHit: () => this.damageHero(),
      onHeroPush: (origin, force) => this.pushHero(origin, force),
    });
    this.dragon?.setVisible(false);
    this.dragonSpeech?.setText('Duelista legendario');
    this.dragonHealthBar?.setVisible(false);

    if (this.isDesktopLayout) {
      this.cameras.main.setBounds(0, 0, 2048, 1536);
      this.cameras.main.startFollow(this.player.getSprite(), true, 0.12, 0.12);
      this.cameras.main.setDeadzone(360, 240);
    }

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
      this.shootHeroProjectile();
    }

    const direction = this.getMoveDirection();
    this.player.update(delta, direction, this.roomBounds, this.getActiveBlockers());
    this.heroInvulnerableMs = Math.max(0, this.heroInvulnerableMs - delta);
    this.heroShotCooldownMs = Math.max(0, this.heroShotCooldownMs - delta);
    this.updateHeroShots(delta);
    this.duelistBoss?.update(delta, this.player.getPosition(), this.player.getHitbox());
    if (this.duelistBoss) {
      return;
    }
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
    this.createDesktopBossRoom();
    return;

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

    const dragon = this.add.sprite(180, 218, 'mage-idle').setScale(0.72).setDepth(3);
    dragon.play('mage-idle');
    this.dragon = dragon;
    this.dragonHitbox = new Phaser.Geom.Rectangle(dragon.x - 34, dragon.y - 28, 68, 60);
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

  private createDesktopBossRoom(): void {
    this.cameras.main.setBackgroundColor('#111820');
    this.blockers = [];
    this.covers = [];
    this.tacticalPoints = [
      new Phaser.Math.Vector2(760, 430),
      new Phaser.Math.Vector2(1288, 430),
      new Phaser.Math.Vector2(760, 760),
      new Phaser.Math.Vector2(1288, 760),
    ];

    this.drawMuseumFloor();
    this.addRoomFrame();

    this.addCoverRect('statue', 760, 430, 112, 132, 0x7f8794, false, 'C');
    this.addCoverRect('statue', 1288, 430, 112, 132, 0x7f8794, false, 'C');
    this.addCoverRect('statue', 760, 760, 112, 132, 0x7f8794, false, 'C');
    this.addCoverRect('statue', 1288, 760, 112, 132, 0x7f8794, false, 'C');

    this.add
      .text(1024, 266, 'Arena debug · Duelista noble v0.1', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#fff2bd',
        stroke: '#05080a',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.add
      .text(1024, 944, `${ProgressStore.getHeroName()} · B dispara al jefe`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#b9d8c2',
        stroke: '#05080a',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.createHeroHearts();
  }

  private drawMuseumFloor(): void {
    const graphics = this.add.graphics().setDepth(0);
    graphics.fillStyle(0x17202a, 1);
    graphics.fillRect(0, 0, 2048, 1536);
    graphics.fillStyle(0x202b34, 1);
    graphics.fillRect(this.roomBounds.x, this.roomBounds.y, this.roomBounds.width, this.roomBounds.height);
    graphics.lineStyle(2, 0x32424b, 0.7);
    for (let x = this.roomBounds.left; x <= this.roomBounds.right; x += 64) {
      graphics.lineBetween(x, this.roomBounds.top, x, this.roomBounds.bottom);
    }
    for (let y = this.roomBounds.top; y <= this.roomBounds.bottom; y += 64) {
      graphics.lineBetween(this.roomBounds.left, y, this.roomBounds.right, y);
    }
    graphics.lineStyle(4, 0x8f6d3d, 1);
    graphics.strokeRect(this.roomBounds.x + 18, this.roomBounds.y + 18, this.roomBounds.width - 36, this.roomBounds.height - 36);
  }

  private addRoomFrame(): void {
    const graphics = this.add.graphics().setDepth(2);
    graphics.fillStyle(0x101820, 1);
    graphics.fillRect(this.roomBounds.left - 48, this.roomBounds.top - 48, this.roomBounds.width + 96, 48);
    graphics.fillRect(this.roomBounds.left - 48, this.roomBounds.bottom, this.roomBounds.width + 96, 48);
    graphics.fillRect(this.roomBounds.left - 48, this.roomBounds.top - 48, 48, this.roomBounds.height + 96);
    graphics.fillRect(this.roomBounds.right, this.roomBounds.top - 48, 48, this.roomBounds.height + 96);
    graphics.lineStyle(4, 0xf4d06f, 1);
    graphics.strokeRect(this.roomBounds.x, this.roomBounds.y, this.roomBounds.width, this.roomBounds.height);

    this.blockers.push(
      new Phaser.Geom.Rectangle(this.roomBounds.left - 48, this.roomBounds.top - 60, this.roomBounds.width + 96, 86),
      new Phaser.Geom.Rectangle(this.roomBounds.left - 48, this.roomBounds.bottom - 24, this.roomBounds.width + 96, 86),
      new Phaser.Geom.Rectangle(this.roomBounds.left - 54, this.roomBounds.top - 40, 86, this.roomBounds.height + 80),
      new Phaser.Geom.Rectangle(this.roomBounds.right - 32, this.roomBounds.top - 40, 86, this.roomBounds.height + 80),
    );
  }

  private addCoverRect(
    type: CoverObject['type'],
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    breakable: boolean,
    label: string,
  ): void {
    const view = this.add.rectangle(x, y, width, height, color, type === 'vitrine' ? 0.72 : 0.95).setStrokeStyle(4, 0xf4d06f).setDepth(y);
    this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#05080a',
      })
      .setOrigin(0.5)
      .setDepth(y + 1);
    const rect = new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height);
    this.covers.push({ rect, type, breakable, view });
    this.blockers.push(rect);
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

  private shootHeroProjectile(): void {
    if (!this.player || !this.duelistBoss || this.heroShotCooldownMs > 0) {
      return;
    }

    const position = this.player.getPosition();
    const direction = this.duelistBoss.getPosition().subtract(position);
    if (direction.lengthSq() === 0) {
      direction.set(0, -1);
    }
    direction.normalize();
    const body = this.add.circle(position.x + direction.x * 28, position.y + direction.y * 28, 8, 0x74ff9b).setStrokeStyle(2, 0x0b2412).setDepth(13);
    this.heroShots.push({
      body,
      velocity: direction.scale(760),
      ageMs: 0,
    });
    this.heroShotCooldownMs = 1000;
  }

  private updateHeroShots(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;
    this.heroShots = this.heroShots.filter((shot) => {
      shot.ageMs += deltaMs;
      shot.body.x += shot.velocity.x * deltaSeconds;
      shot.body.y += shot.velocity.y * deltaSeconds;

      const shotCircle = new Phaser.Geom.Circle(shot.body.x, shot.body.y, 8);
      if (!this.roomBounds.contains(shot.body.x, shot.body.y) || shot.ageMs > 1600) {
        shot.body.destroy();
        return false;
      }

      const hitCover = this.covers.find((cover) => !cover.broken && Phaser.Geom.Intersects.CircleToRectangle(shotCircle, cover.rect));
      if (hitCover) {
        shot.body.destroy();
        return false;
      }

      if (this.duelistBoss?.tryDeflectHeroProjectile(new Phaser.Math.Vector2(shot.body.x, shot.body.y), shot.velocity.clone())) {
        shot.body.destroy();
        return false;
      }

      if (this.duelistBoss && Phaser.Geom.Intersects.CircleToRectangle(shotCircle, this.duelistBoss.getHitbox())) {
        this.duelistBoss.takeHit(new Phaser.Math.Vector2(shot.body.x, shot.body.y), 1);
        shot.body.destroy();
        return false;
      }

      return true;
    });
  }

  private getActiveBlockers(): Phaser.Geom.Rectangle[] {
    const coverBlockers = this.covers.filter((cover) => !cover.broken).map((cover) => cover.rect);
    const wallBlockers = this.blockers.filter((blocker) => !this.covers.some((cover) => cover.rect === blocker));
    return [...wallBlockers, ...coverBlockers];
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

    if (this.duelistBoss && Phaser.Geom.Intersects.RectangleToRectangle(swordHitbox, this.duelistBoss.getHitbox())) {
      this.duelistBoss.takeHit(position);
      return;
    }

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
      const heart = this.add.image(58 + index * 24, 92, 'heart-full').setScale(1.3).setDepth(30).setScrollFactor(0);
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
    this.player?.flashHit();
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

  private pushHero(origin: Phaser.Math.Vector2, force: number): void {
    this.player?.knockBackFrom(origin, force);
    this.cameras.main.shake(90, 0.004);
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

    const shade = this.add.rectangle(180, 320, 360, 640, 0x05080a, 0.74);
    const backGlow = this.add.ellipse(210, 286, 246, 90, 0x6d1f2b, 0.16);
    const heroGlow = this.add.ellipse(112, 386, 112, 34, 0xf4d06f, 0.18);
    const mageGlow = this.add.ellipse(230, 354, 138, 42, 0xa35aff, 0.2);
    const upperPanel = this.createBattlePanel(52, 90, 256, 64, 0x111923);
    const commandPanel = this.createBattlePanel(26, 434, 130, 96, 0x111923);
    const statusPanel = this.createBattlePanel(164, 434, 170, 96, 0x172b32);
    const mage = this.add.image(226, 260, 'mage-battle').setScale(0.54);
    const hero = this.add.sprite(108, 360, 'hero-idle', 0).setScale(0.74).setFlipX(true);
    const title = this.add
      .text(180, 104, 'MAGO OSCURO', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#fff2bd',
        stroke: '#05080a',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const status = this.add
      .text(249, 458, 'Tu turno', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#b9d8c2',
        wordWrap: { width: 140 },
      })
      .setOrigin(0.5);
    const turnLabel = this.add
      .text(180, 140, 'Fase por turnos', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#f4d06f',
      })
      .setOrigin(0.5);
    const commandTitle = this.add
      .text(90, 450, 'COMANDOS', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#f4d06f',
      })
      .setOrigin(0.5);
    const attack = this.add
      .text(48, 474, '> B Atacar', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#fff2bd',
      })
      .setOrigin(0, 0.5);
    const defend = this.add
      .text(48, 496, '  A Defender', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#b9d8c2',
      })
      .setOrigin(0, 0.5);
    const actions = this.add
      .text(249, 506, 'Elige accion con A/B', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#f4d06f',
      })
      .setOrigin(0.5);

    this.turnMageSprite = mage;
    this.turnHeroSprite = hero;
    this.turnStatusText = status;
    this.turnOverlay = this.add
      .container(0, 0, [
        shade,
        backGlow,
        heroGlow,
        mageGlow,
        upperPanel,
        commandPanel,
        statusPanel,
        mage,
        hero,
        title,
        turnLabel,
        status,
        commandTitle,
        attack,
        defend,
        actions,
      ])
      .setDepth(20);
    this.cameras.main.flash(260, 95, 30, 110);
    this.drawDragonHealthBar();
  }

  private createBattlePanel(x: number, y: number, width: number, height: number, fillColor: number): Phaser.GameObjects.Graphics {
    const panel = this.add.graphics();
    panel.fillStyle(0x05080a, 0.62);
    panel.fillRect(x + 4, y + 4, width, height);
    panel.fillStyle(fillColor, 0.94);
    panel.fillRect(x, y, width, height);
    panel.lineStyle(2, 0xf4d06f, 1);
    panel.strokeRect(x, y, width, height);
    panel.lineStyle(1, 0x8f6d3d, 1);
    panel.strokeRect(x + 5, y + 5, width - 10, height - 10);
    panel.fillStyle(0xf4d06f, 1);
    panel.fillRect(x - 2, y - 2, 8, 2);
    panel.fillRect(x - 2, y - 2, 2, 8);
    panel.fillRect(x + width - 6, y - 2, 8, 2);
    panel.fillRect(x + width, y - 2, 2, 8);
    panel.fillRect(x - 2, y + height, 8, 2);
    panel.fillRect(x - 2, y + height - 6, 2, 8);
    panel.fillRect(x + width - 6, y + height, 8, 2);
    panel.fillRect(x + width, y + height - 6, 2, 8);
    return panel;
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
      targets: this.turnHeroSprite,
      x: 132,
      duration: 90,
      yoyo: true,
      onComplete: () => {
        this.tweens.add({
          targets: this.turnMageSprite,
          alpha: 0.55,
          x: 232,
          duration: 80,
          yoyo: true,
        });
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
      this.tweens.add({
        targets: this.turnMageSprite,
        x: 214,
        duration: 90,
        yoyo: true,
      });
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
    const y = this.combatPhase === 'turn' || this.combatPhase === 'defeated' ? 118 : 96;
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
