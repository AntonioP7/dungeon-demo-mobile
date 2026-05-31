import Phaser from 'phaser';

export enum DuelistBossState {
  Evaluate = 'Evaluate',
  MoveToCover = 'MoveToCover',
  TakeCover = 'TakeCover',
  PeekFromCover = 'PeekFromCover',
  FirePreciseShot = 'FirePreciseShot',
  ReturnToCover = 'ReturnToCover',
  Reposition = 'Reposition',
  DeflectProjectile = 'DeflectProjectile',
  HitReact = 'HitReact',
  PhaseEnd = 'PhaseEnd',
}

class DuelistPhaseController {
  currentPhase = DuelistBossPhase.CoverDuel;

  update(hp: number, maxHp: number): void {
    const hpRatio = hp / maxHp;
    if (hpRatio <= 0.34) {
      this.currentPhase = DuelistBossPhase.MasterDuel;
      return;
    }
    if (hpRatio <= 0.67) {
      this.currentPhase = DuelistBossPhase.TrickShots;
      return;
    }
    this.currentPhase = DuelistBossPhase.CoverDuel;
  }
}

class DuelistAbilitySystem {
  private readonly cooldowns = new Map<DuelistAbilityId, number>();

  update(deltaMs: number): void {
    this.cooldowns.forEach((cooldownMs, ability) => {
      this.cooldowns.set(ability, Math.max(0, cooldownMs - deltaMs));
    });
  }

  canUse(ability: DuelistAbilityId): boolean {
    return this.getCooldownMs(ability) <= 0;
  }

  getCooldownMs(ability: DuelistAbilityId): number {
    return this.cooldowns.get(ability) ?? 0;
  }

  startCooldown(ability: DuelistAbilityId, durationMs: number): void {
    this.cooldowns.set(ability, Math.max(0, durationMs));
  }
}

class DuelistUtilityBrain {
  chooseIntent(context: DuelistUtilityContext): DuelistIntent {
    const scores = this.scoreIntents(context);
    return Object.entries(scores).reduce(
      (best, [intent, score]) => (score > best.score ? { intent: intent as DuelistIntent, score } : best),
      { intent: DuelistIntent.TakeCover, score: Number.NEGATIVE_INFINITY },
    ).intent;
  }

  private scoreIntents({ phase, sensors, memory, abilities }: DuelistUtilityContext): Record<DuelistIntent, number> {
    const phaseAggression = phase === DuelistBossPhase.CoverDuel ? 0 : phase === DuelistBossPhase.TrickShots ? 12 : 24;

    return {
      [DuelistIntent.TakeCover]: 35 + (sensors.currentCoverBlocksHero ? 25 : 0) - phaseAggression,
      [DuelistIntent.PreciseShot]:
        (abilities.canUse(DuelistAbilityId.PreciseShot) ? 55 : -100) +
        (sensors.hasDirectLineOfSight ? 65 : 0) +
        (sensors.currentCoverHasPeekLine ? 30 : -35) +
        (sensors.heroTooClose ? -45 : 0) +
        phaseAggression,
      [DuelistIntent.Reposition]:
        (sensors.shouldReposition ? 80 : 0) +
        (sensors.heroTooClose ? 45 : 0) +
        (memory.shotsFromCurrentCover >= 2 ? 22 : 0) +
        (memory.recentDamageTaken > 0 ? 15 : 0),
      [DuelistIntent.Deflect]: -100,
    };
  }
}

export type CoverObject = {
  rect: Phaser.Geom.Rectangle;
  type: 'statue' | 'vitrine' | 'pedestal' | 'wall';
  breakable?: boolean;
  broken?: boolean;
  view?: Phaser.GameObjects.Rectangle;
};

type CoverPoints = {
  safePoint: Phaser.Math.Vector2;
  peekLeftPoint: Phaser.Math.Vector2;
  peekRightPoint: Phaser.Math.Vector2;
};

type BossProjectile = {
  body: Phaser.GameObjects.Arc;
  velocity: Phaser.Math.Vector2;
  ageMs: number;
};

type DuelistBossConfig = {
  x: number;
  y: number;
  roomBounds: Phaser.Geom.Rectangle;
  tacticalPoints?: Phaser.Math.Vector2[];
  covers: CoverObject[];
  onHeroHit: () => void;
  onHeroPush?: (origin: Phaser.Math.Vector2, force: number) => void;
};

enum DuelistBossPhase {
  CoverDuel = 'CoverDuel',
  TrickShots = 'TrickShots',
  MasterDuel = 'MasterDuel',
}

enum DuelistAbilityId {
  PreciseShot = 'PreciseShot',
  Deflect = 'Deflect',
  Reposition = 'Reposition',
}

enum DuelistIntent {
  TakeCover = 'TakeCover',
  PreciseShot = 'PreciseShot',
  Reposition = 'Reposition',
  Deflect = 'Deflect',
}

type DuelistBossMemory = {
  lastCover?: CoverObject;
  lastPeekPoint?: Phaser.Math.Vector2;
  shotsFromCurrentCover: number;
  recentDamageTaken: number;
};

type DuelistBossSensors = {
  heroDistance: number;
  heroTooClose: boolean;
  hasDirectLineOfSight: boolean;
  hasCurrentCover: boolean;
  currentCoverHasPeekLine: boolean;
  currentCoverBlocksHero: boolean;
  canPreciseShot: boolean;
  shouldReposition: boolean;
};

type DuelistUtilityContext = {
  phase: DuelistBossPhase;
  sensors: DuelistBossSensors;
  memory: DuelistBossMemory;
  abilities: DuelistAbilitySystem;
};

const TILE_SIZE = 32;
const BOSS_SIZE = 44;
const PROJECTILE_RADIUS = 8;
const PRECISE_SHOT_WINDUP_MS = 160;
const PRECISE_SHOT_SPEED = 980;

export class DuelistBoss {
  readonly visual: Phaser.GameObjects.Rectangle;
  readonly maxHp = 16;

  hp = this.maxHp;
  currentState = DuelistBossState.Evaluate;

  private readonly scene: Phaser.Scene;
  private readonly roomBounds: Phaser.Geom.Rectangle;
  private readonly covers: CoverObject[];
  private readonly onHeroHit: () => void;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly stateText: Phaser.GameObjects.Text;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly idealDistanceMin = 5 * TILE_SIZE;
  private readonly idealDistanceMax = 8 * TILE_SIZE;
  private readonly tooCloseDistance = 3 * TILE_SIZE;
  private readonly moveToCoverSpeed = 280;
  private readonly returnToCoverSpeed = 360;
  private readonly maxShotsPerCover = 3;
  private readonly phaseController = new DuelistPhaseController();
  private readonly utilityBrain = new DuelistUtilityBrain();
  private readonly abilitySystem = new DuelistAbilitySystem();

  private bossProjectiles: BossProjectile[] = [];
  private playerPosition = new Phaser.Math.Vector2();
  private playerVelocity = new Phaser.Math.Vector2();
  private lastPlayerPosition?: Phaser.Math.Vector2;
  private currentCover?: CoverObject;
  private lastCover?: CoverObject;
  private targetCover?: CoverObject;
  private targetPeekPoint?: Phaser.Math.Vector2;
  private movementDetourPoint?: Phaser.Math.Vector2;
  private evasionPoint?: Phaser.Math.Vector2;
  private lastPeekPoint?: Phaser.Math.Vector2;
  private lastMovePosition = new Phaser.Math.Vector2();
  private bossFacing = new Phaser.Math.Vector2(0, 1);
  private stateTimerMs = 0;
  private stuckTimerMs = 0;
  private shotWindupMs = 0;
  private attackCooldownMs = 850;
  private deflectCooldownMs = 0;
  private shotsFromCurrentCover = 0;
  private memory: DuelistBossMemory = {
    shotsFromCurrentCover: 0,
    recentDamageTaken: 0,
  };
  private sensors: DuelistBossSensors = {
    heroDistance: Number.POSITIVE_INFINITY,
    heroTooClose: false,
    hasDirectLineOfSight: false,
    hasCurrentCover: false,
    currentCoverHasPeekLine: false,
    currentCoverBlocksHero: false,
    canPreciseShot: false,
    shouldReposition: false,
  };
  private telegraph?: Phaser.GameObjects.GameObject;
  private pendingShotTarget?: Phaser.Math.Vector2;

  constructor(scene: Phaser.Scene, config: DuelistBossConfig) {
    this.scene = scene;
    this.roomBounds = config.roomBounds;
    this.covers = config.covers;
    this.onHeroHit = config.onHeroHit;
    this.visual = scene.add.rectangle(config.x, config.y, BOSS_SIZE, BOSS_SIZE, 0xc89b3c, 0).setStrokeStyle(0, 0xfff2bd, 0).setDepth(12);
    this.sprite = scene.add.sprite(config.x, config.y - 12, 'duelist-idle').setScale(0.82).setDepth(13);
    this.sprite.play('duelist-idle');
    this.lastMovePosition.set(config.x, config.y);
    this.stateText = scene.add
      .text(config.x, config.y - 56, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#f4d06f',
        stroke: '#05080a',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.hpText = scene.add
      .text(config.x, config.y - 76, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#fff2bd',
        stroke: '#05080a',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.abilitySystem.startCooldown(DuelistAbilityId.PreciseShot, this.attackCooldownMs);
  }

  update(deltaMs: number, playerPosition: Phaser.Math.Vector2, playerHitbox: Phaser.Geom.Rectangle): void {
    if (this.currentState === DuelistBossState.PhaseEnd) {
      return;
    }

    this.updateTimers(deltaMs);
    this.updateHeroData(deltaMs, playerPosition);
    this.updateBossProjectiles(deltaMs, playerHitbox);
    this.phaseController.update(this.hp, this.maxHp);
    this.sensors = this.readSensors();
    this.updateParallelPreciseShot(deltaMs);

    if (this.hp <= 0) {
      this.changeState(DuelistBossState.PhaseEnd);
      return;
    }

    switch (this.currentState) {
      case DuelistBossState.Evaluate:
        this.updateEvaluate();
        break;
      case DuelistBossState.MoveToCover:
        this.updateMoveToCover(deltaMs);
        break;
      case DuelistBossState.TakeCover:
        this.updateTakeCover(deltaMs);
        break;
      case DuelistBossState.PeekFromCover:
        this.updatePeekFromCover(deltaMs);
        break;
      case DuelistBossState.FirePreciseShot:
        this.updateFirePreciseShot();
        break;
      case DuelistBossState.ReturnToCover:
        this.updateReturnToCover(deltaMs);
        break;
      case DuelistBossState.Reposition:
        this.updateReposition();
        break;
      case DuelistBossState.DeflectProjectile:
        this.updateTimedState(DuelistBossState.Evaluate, 180);
        break;
      case DuelistBossState.HitReact:
        this.updateTimedState(DuelistBossState.Evaluate, 180);
        break;
      default:
        break;
    }

    this.updateSpriteAnimation();
    this.updateLabels();
  }

  tryDeflectHeroProjectile(projectilePosition: Phaser.Math.Vector2, projectileVelocity: Phaser.Math.Vector2): boolean {
    if (!this.shouldDeflectProjectile(projectilePosition, projectileVelocity)) {
      this.queueDodge(projectilePosition, projectileVelocity);
      return false;
    }

    this.abilitySystem.startCooldown(DuelistAbilityId.Deflect, Phaser.Math.Between(1400, 1900));
    this.deflectCooldownMs = this.abilitySystem.getCooldownMs(DuelistAbilityId.Deflect);
    this.spawnDeflectSpark(projectilePosition);
    this.changeState(DuelistBossState.DeflectProjectile);
    return true;
  }

  takeHit(_fromPosition: Phaser.Math.Vector2, damage = 1): boolean {
    if (this.currentState === DuelistBossState.PhaseEnd || this.currentState === DuelistBossState.DeflectProjectile) {
      return false;
    }

    this.hp = Math.max(0, this.hp - damage);
    this.memory.recentDamageTaken += damage;
    this.visual.setFillStyle(0xff6d7a);
    this.sprite.setTintFill(0xfff2bd);
    this.scene.time.delayedCall(110, () => this.sprite.clearTint());
    this.changeState(this.hp <= 0 ? DuelistBossState.PhaseEnd : DuelistBossState.HitReact);
    return true;
  }

  getHitbox(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.visual.x - BOSS_SIZE / 2, this.visual.y - BOSS_SIZE / 2, BOSS_SIZE, BOSS_SIZE);
  }

  getPosition(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.visual.x, this.visual.y);
  }

  private updateEvaluate(): void {
    this.visual.setFillStyle(0xc89b3c);
    this.syncMemory();

    const intent = this.utilityBrain.chooseIntent({
      phase: this.phaseController.currentPhase,
      sensors: this.sensors,
      memory: this.memory,
      abilities: this.abilitySystem,
    });

    if (!this.currentCover) {
      this.targetCover = this.chooseBestCover();
      this.changeState(DuelistBossState.MoveToCover);
      return;
    }

    if (intent === DuelistIntent.Reposition) {
      this.changeState(DuelistBossState.Reposition);
      return;
    }

    if (intent === DuelistIntent.Deflect) {
      this.changeState(DuelistBossState.DeflectProjectile);
      return;
    }

    if (this.shouldReposition()) {
      this.changeState(DuelistBossState.Reposition);
      return;
    }

    this.changeState(DuelistBossState.TakeCover);
  }

  private updateMoveToCover(deltaMs: number): void {
    const cover = this.targetCover ?? this.chooseBestCover();
    if (!cover) {
      return;
    }

    this.visual.setFillStyle(0xd6bd63);
    this.faceHeroApprox();
    if (this.tryResolveEvasion(deltaMs)) {
      return;
    }
    const reached = this.moveTowardCoverPoint(cover, this.getCoverPoints(cover).safePoint, this.moveToCoverSpeed, deltaMs);
    if (reached) {
      this.currentCover = cover;
      this.targetCover = undefined;
      this.movementDetourPoint = undefined;
      this.changeState(DuelistBossState.TakeCover);
    }
  }

  private updateTakeCover(deltaMs: number): void {
    if (!this.currentCover) {
      this.changeState(DuelistBossState.Evaluate);
      return;
    }

    if (this.canFireFromCurrentPosition()) {
      this.changeState(DuelistBossState.FirePreciseShot);
      return;
    }

    this.visual.setFillStyle(0x8f6d3d);
    this.faceHeroApprox();
    if (this.tryResolveEvasion(deltaMs)) {
      return;
    }
    const reachedCover = this.moveTowardCoverPoint(this.currentCover, this.getCoverPoints(this.currentCover).safePoint, this.returnToCoverSpeed, deltaMs);

    if (this.heroTooClose() || this.shotsFromCurrentCover >= this.maxShotsPerCover) {
      this.changeState(DuelistBossState.Reposition);
      return;
    }

    if (reachedCover && this.attackCooldownMs <= 0 && this.stateTimerMs >= 300) {
      this.changeState(DuelistBossState.PeekFromCover);
    }
  }

  private updatePeekFromCover(deltaMs: number): void {
    if (!this.currentCover) {
      this.changeState(DuelistBossState.Evaluate);
      return;
    }

    this.visual.setFillStyle(0xf4d06f);
    this.targetPeekPoint ??= this.chooseBestPeekPoint(this.currentCover);
    this.faceHero();
    const reached = this.moveToward(this.targetPeekPoint, this.returnToCoverSpeed, deltaMs);
    const hasLineOfSight = this.hasLineOfSight(this.getPosition(), this.playerPosition);

    if (reached && hasLineOfSight && this.attackCooldownMs <= 0) {
      this.updateParallelPreciseShot(deltaMs);
      if (this.pendingShotTarget) {
        return;
      }
      this.changeState(DuelistBossState.ReturnToCover);
      return;
    }

    if (this.stateTimerMs > 900) {
      this.changeState(DuelistBossState.ReturnToCover);
    }
  }

  private updateFirePreciseShot(): void {
    this.updateParallelPreciseShot(16);
    this.changeState(this.currentCover ? DuelistBossState.ReturnToCover : DuelistBossState.Evaluate);
  }

  private updateReturnToCover(deltaMs: number): void {
    if (!this.currentCover) {
      this.changeState(DuelistBossState.Evaluate);
      return;
    }

    this.visual.setFillStyle(0x8f6d3d);
    this.faceHeroApprox();
    if (this.tryResolveEvasion(deltaMs)) {
      return;
    }
    const reached = this.moveTowardCoverPoint(this.currentCover, this.getCoverPoints(this.currentCover).safePoint, this.returnToCoverSpeed, deltaMs);
    if (reached) {
      this.movementDetourPoint = undefined;
      this.changeState(DuelistBossState.Evaluate);
    }
  }

  private updateReposition(): void {
    this.lastCover = this.currentCover;
    this.memory.lastCover = this.lastCover;
    this.currentCover = undefined;
    this.targetCover = this.chooseBestCover(this.lastCover);
    this.shotsFromCurrentCover = 0;
    this.memory.shotsFromCurrentCover = 0;
    this.targetPeekPoint = undefined;
    this.changeState(DuelistBossState.MoveToCover);
  }

  private updateBossProjectiles(deltaMs: number, playerHitbox: Phaser.Geom.Rectangle): void {
    const deltaSeconds = deltaMs / 1000;
    this.bossProjectiles = this.bossProjectiles.filter((projectile) => {
      projectile.ageMs += deltaMs;
      projectile.body.x += projectile.velocity.x * deltaSeconds;
      projectile.body.y += projectile.velocity.y * deltaSeconds;

      const circle = new Phaser.Geom.Circle(projectile.body.x, projectile.body.y, PROJECTILE_RADIUS);
      if (Phaser.Geom.Intersects.CircleToRectangle(circle, playerHitbox)) {
        projectile.body.destroy();
        this.onHeroHit();
        return false;
      }

      const hitCover = this.covers.some((cover) => !cover.broken && Phaser.Geom.Intersects.CircleToRectangle(circle, cover.rect));
      const expired = projectile.ageMs > 2200 || !this.roomBounds.contains(projectile.body.x, projectile.body.y);
      if (hitCover || expired) {
        projectile.body.destroy();
        return false;
      }

      return true;
    });
  }

  private shouldDeflectProjectile(projectilePosition: Phaser.Math.Vector2, projectileVelocity: Phaser.Math.Vector2): boolean {
    if (
      !this.abilitySystem.canUse(DuelistAbilityId.Deflect) ||
      this.currentState === DuelistBossState.FirePreciseShot ||
      this.currentState === DuelistBossState.HitReact ||
      this.currentState === DuelistBossState.PhaseEnd
    ) {
      return false;
    }

    const toProjectile = projectilePosition.clone().subtract(this.getPosition());
    if (toProjectile.length() > 96 || toProjectile.lengthSq() === 0) {
      return false;
    }

    const incomingToBoss = this.getPosition().subtract(projectilePosition);
    if (incomingToBoss.lengthSq() === 0 || projectileVelocity.clone().normalize().dot(incomingToBoss.normalize()) < 0.45) {
      return false;
    }

    const angle = Phaser.Math.Angle.Wrap(this.bossFacing.angle() - toProjectile.angle());
    return Math.abs(angle) <= Phaser.Math.DegToRad(60);
  }

  private firePreciseShot(targetPosition: Phaser.Math.Vector2): void {
    const origin = this.getPosition();
    const velocity = targetPosition.clone().subtract(origin);
    if (velocity.lengthSq() === 0) {
      velocity.set(0, 1);
    }
    velocity.normalize().scale(PRECISE_SHOT_SPEED);

    const body = this.scene.add.circle(origin.x + velocity.x * 0.035, origin.y + velocity.y * 0.035, PROJECTILE_RADIUS, 0xffdf6e);
    body.setStrokeStyle(2, 0x3b2f0a).setDepth(14);
    this.bossProjectiles.push({ body, velocity, ageMs: 0 });
  }

  private chooseBestCover(exclude?: CoverObject): CoverObject | undefined {
    const available = this.covers.filter((cover) => !cover.broken && cover.type === 'statue' && cover !== exclude);
    if (available.length === 0) {
      return this.covers.find((cover) => !cover.broken && cover.type === 'statue');
    }

    return available.reduce((best, cover) => (this.scoreCover(cover) > this.scoreCover(best) ? cover : best), available[0]);
  }

  private scoreCover(cover: CoverObject): number {
    const points = this.getCoverPoints(cover);
    const coverPosition = new Phaser.Math.Vector2(cover.rect.centerX, cover.rect.centerY);
    const distanceToHero = Phaser.Math.Distance.BetweenPoints(coverPosition, this.playerPosition);
    const distanceToBoss = Phaser.Math.Distance.BetweenPoints(coverPosition, this.getPosition());
    let score = 0;

    if (this.blocksLineFromHeroToBoss(cover)) {
      score += 50;
    }
    if (this.hasLineOfSight(points.peekLeftPoint, this.playerPosition, cover) || this.hasLineOfSight(points.peekRightPoint, this.playerPosition, cover)) {
      score += 40;
    }
    if (distanceToHero >= this.idealDistanceMin && distanceToHero <= this.idealDistanceMax) {
      score += 30;
    }
    if (distanceToBoss < 8 * TILE_SIZE) {
      score += 15;
    }
    if (cover === this.currentCover) {
      score -= 40;
    }
    if (cover === this.lastCover) {
      score -= 20;
    }
    if (distanceToHero < this.tooCloseDistance) {
      score -= 60;
    }

    return score;
  }

  private chooseBestPeekPoint(cover: CoverObject): Phaser.Math.Vector2 {
    const points = this.getCoverPoints(cover);
    const leftScore = this.scorePeekPoint(points.peekLeftPoint);
    const rightScore = this.scorePeekPoint(points.peekRightPoint);
    const bestPoint = leftScore >= rightScore ? points.peekLeftPoint : points.peekRightPoint;
    this.lastPeekPoint = bestPoint.clone();
    this.memory.lastPeekPoint = bestPoint.clone();
    return bestPoint;
  }

  private scorePeekPoint(point: Phaser.Math.Vector2): number {
    const distance = Phaser.Math.Distance.BetweenPoints(point, this.playerPosition);
    let score = 0;

    if (this.hasLineOfSight(point, this.playerPosition)) {
      score += 50;
    }
    if (distance >= this.idealDistanceMin && distance <= this.idealDistanceMax) {
      score += 20;
    }
    if (this.lastPeekPoint && Phaser.Math.Distance.BetweenPoints(point, this.lastPeekPoint) < 8) {
      score -= 20;
    }
    if (distance < this.tooCloseDistance) {
      score -= 40;
    }

    return score;
  }

  private shouldReposition(): boolean {
    return (
      this.heroTooClose() ||
      this.shotsFromCurrentCover >= this.maxShotsPerCover ||
      !this.currentCover ||
      !this.currentCoverHasPeekLineToHero() ||
      !this.blocksLineFromHeroToBoss(this.currentCover)
    );
  }

  private getCoverPoints(cover: CoverObject): CoverPoints {
    const center = new Phaser.Math.Vector2(cover.rect.centerX, cover.rect.centerY);
    const awayFromHero = center.clone().subtract(this.playerPosition);
    if (awayFromHero.lengthSq() === 0) {
      awayFromHero.set(0, 1);
    }
    awayFromHero.normalize();
    const tangent = new Phaser.Math.Vector2(-awayFromHero.y, awayFromHero.x);
    const safeDistance = Math.max(cover.rect.width, cover.rect.height) * 0.5 + 42;
    const peekDistance = Math.max(cover.rect.width, cover.rect.height) * 0.5 + 34;
    const sideDistance = Math.max(54, Math.min(86, Math.max(cover.rect.width, cover.rect.height) * 0.58));

    return {
      safePoint: this.clampToRoom(center.clone().add(awayFromHero.clone().scale(safeDistance))),
      peekLeftPoint: this.clampToRoom(center.clone().add(awayFromHero.clone().scale(peekDistance)).add(tangent.clone().scale(sideDistance))),
      peekRightPoint: this.clampToRoom(center.clone().add(awayFromHero.clone().scale(peekDistance)).subtract(tangent.clone().scale(sideDistance))),
    };
  }

  private moveToward(target: Phaser.Math.Vector2, speed: number, deltaMs: number): boolean {
    const current = this.getPosition();
    const toTarget = target.clone().subtract(current);
    const distance = toTarget.length();
    if (distance < 6) {
      this.visual.setPosition(target.x, target.y);
      return true;
    }

    toTarget.normalize().scale(Math.min(distance, speed * (deltaMs / 1000)));
    this.tryMove(toTarget.x, toTarget.y);
    return false;
  }

  private moveTowardCoverPoint(cover: CoverObject, target: Phaser.Math.Vector2, speed: number, deltaMs: number): boolean {
    if (this.movementDetourPoint) {
      const reachedDetour = this.moveToward(this.movementDetourPoint, speed, deltaMs);
      if (reachedDetour || Phaser.Math.Distance.BetweenPoints(this.getPosition(), this.movementDetourPoint) < 14) {
        this.movementDetourPoint = undefined;
      }
      return false;
    }

    const before = this.getPosition();
    const reached = this.moveToward(target, speed, deltaMs);
    const movedDistance = Phaser.Math.Distance.BetweenPoints(before, this.getPosition());

    if (!reached && movedDistance < 1.2) {
      this.stuckTimerMs += deltaMs;
    } else {
      this.stuckTimerMs = 0;
    }

    if (this.stuckTimerMs > 220) {
      this.movementDetourPoint = this.chooseCoverDetourPoint(cover, target);
      this.stuckTimerMs = 0;
    }

    return reached;
  }

  private chooseCoverDetourPoint(cover: CoverObject, finalTarget: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const center = new Phaser.Math.Vector2(cover.rect.centerX, cover.rect.centerY);
    const bossToCover = center.clone().subtract(this.getPosition());
    if (bossToCover.lengthSq() === 0) {
      bossToCover.set(0, 1);
    }
    bossToCover.normalize();

    const tangent = new Phaser.Math.Vector2(-bossToCover.y, bossToCover.x);
    const radius = Math.max(cover.rect.width, cover.rect.height) * 0.5 + BOSS_SIZE + 26;
    const candidates = [
      center.clone().add(tangent.clone().scale(radius)),
      center.clone().subtract(tangent.clone().scale(radius)),
      center.clone().subtract(bossToCover.clone().scale(radius)),
    ].map((point) => this.clampToRoom(point));

    return candidates.reduce((best, candidate) => {
      const candidateScore = Phaser.Math.Distance.BetweenPoints(candidate, this.getPosition()) + Phaser.Math.Distance.BetweenPoints(candidate, finalTarget);
      const bestScore = Phaser.Math.Distance.BetweenPoints(best, this.getPosition()) + Phaser.Math.Distance.BetweenPoints(best, finalTarget);
      return candidateScore < bestScore ? candidate : best;
    }, candidates[0]);
  }

  private tryMove(dx: number, dy: number): void {
    const previousX = this.visual.x;
    const previousY = this.visual.y;

    if (this.tryMoveDelta(dx, dy)) {
      return;
    }
    this.visual.setPosition(previousX, previousY);
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (this.tryMoveDelta(dx, 0) || this.tryMoveDelta(0, dy)) {
        return;
      }
    } else if (this.tryMoveDelta(0, dy) || this.tryMoveDelta(dx, 0)) {
      return;
    }
    this.visual.setPosition(previousX, previousY);
  }

  private tryMoveDelta(dx: number, dy: number): boolean {
    const previousX = this.visual.x;
    const previousY = this.visual.y;
    this.visual.x = Phaser.Math.Clamp(this.visual.x + dx, this.roomBounds.left + BOSS_SIZE / 2, this.roomBounds.right - BOSS_SIZE / 2);
    this.visual.y = Phaser.Math.Clamp(this.visual.y + dy, this.roomBounds.top + BOSS_SIZE / 2, this.roomBounds.bottom - BOSS_SIZE / 2);

    const hitbox = this.getHitbox();
    if (this.covers.some((cover) => !cover.broken && Phaser.Geom.Intersects.RectangleToRectangle(hitbox, cover.rect))) {
      this.visual.setPosition(previousX, previousY);
      return false;
    }
    return true;
  }

  private hasLineOfSight(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, ignoreCover?: CoverObject): boolean {
    const line = new Phaser.Geom.Line(from.x, from.y, to.x, to.y);
    return !this.covers.some((cover) => {
      return cover !== ignoreCover && !cover.broken && Phaser.Geom.Intersects.LineToRectangle(line, cover.rect);
    });
  }

  private blocksLineFromHeroToBoss(cover: CoverObject): boolean {
    const line = new Phaser.Geom.Line(this.playerPosition.x, this.playerPosition.y, this.visual.x, this.visual.y);
    return Phaser.Geom.Intersects.LineToRectangle(line, cover.rect);
  }

  private currentCoverHasPeekLineToHero(): boolean {
    if (!this.currentCover) {
      return false;
    }
    const points = this.getCoverPoints(this.currentCover);
    return this.hasLineOfSight(points.peekLeftPoint, this.playerPosition, this.currentCover) || this.hasLineOfSight(points.peekRightPoint, this.playerPosition, this.currentCover);
  }

  private heroTooClose(): boolean {
    return Phaser.Math.Distance.BetweenPoints(this.getPosition(), this.playerPosition) < this.tooCloseDistance;
  }

  private faceHero(): void {
    const direction = this.playerPosition.clone().subtract(this.getPosition());
    if (direction.lengthSq() > 0) {
      this.bossFacing = direction.normalize();
    }
  }

  private faceHeroApprox(): void {
    if (this.currentCover && this.blocksLineFromHeroToBoss(this.currentCover)) {
      const direction = new Phaser.Math.Vector2(this.currentCover.rect.centerX, this.currentCover.rect.centerY).subtract(this.getPosition());
      if (direction.lengthSq() > 0) {
        this.bossFacing = direction.normalize();
      }
      return;
    }
    this.faceHero();
  }

  private canFireFromCurrentPosition(): boolean {
    return (
      this.attackCooldownMs <= 0 &&
      !this.sensors.heroTooClose &&
      this.hasLineOfSight(this.getPosition(), this.playerPosition)
    );
  }

  private updateParallelPreciseShot(deltaMs: number): void {
    if (!this.pendingShotTarget && this.canFireFromCurrentPosition()) {
      this.pendingShotTarget = this.playerPosition.clone();
      this.shotWindupMs = PRECISE_SHOT_WINDUP_MS;
      this.telegraph = this.scene.add
        .line(0, 0, this.visual.x, this.visual.y, this.pendingShotTarget.x, this.pendingShotTarget.y, 0xffdf6e, 0.68)
        .setOrigin(0, 0)
        .setLineWidth(4)
        .setDepth(13);
    }

    if (!this.pendingShotTarget) {
      return;
    }

    if (!this.hasLineOfSight(this.getPosition(), this.pendingShotTarget)) {
      this.pendingShotTarget = undefined;
      this.shotWindupMs = 0;
      this.destroyTelegraph();
      return;
    }

    this.faceHero();
    this.updateShotTelegraph();
    this.shotWindupMs -= deltaMs;
    if (this.shotWindupMs <= 0) {
      this.firePreciseShot(this.pendingShotTarget);
      this.shotsFromCurrentCover += 1;
      this.memory.shotsFromCurrentCover = this.shotsFromCurrentCover;
      this.resetAttackCooldown();
      this.pendingShotTarget = undefined;
      this.destroyTelegraph();
    }
  }

  private updateShotTelegraph(): void {
    if (!this.telegraph || !this.pendingShotTarget || !('setTo' in this.telegraph)) {
      return;
    }

    (this.telegraph as Phaser.GameObjects.Line).setTo(this.visual.x, this.visual.y, this.pendingShotTarget.x, this.pendingShotTarget.y);
  }

  private queueDodge(projectilePosition: Phaser.Math.Vector2, projectileVelocity: Phaser.Math.Vector2): void {
    const incomingToBoss = this.getPosition().subtract(projectilePosition);
    if (incomingToBoss.lengthSq() === 0 || projectileVelocity.clone().normalize().dot(incomingToBoss.normalize()) < 0.35) {
      return;
    }

    if (Phaser.Math.Distance.BetweenPoints(projectilePosition, this.getPosition()) > 220) {
      return;
    }

    const side = new Phaser.Math.Vector2(-projectileVelocity.y, projectileVelocity.x).normalize();
    const left = this.clampToRoom(this.getPosition().add(side.clone().scale(86)));
    const right = this.clampToRoom(this.getPosition().subtract(side.clone().scale(86)));
    this.evasionPoint =
      Phaser.Math.Distance.BetweenPoints(left, this.playerPosition) > Phaser.Math.Distance.BetweenPoints(right, this.playerPosition) ? left : right;
  }

  private tryResolveEvasion(deltaMs: number): boolean {
    if (!this.evasionPoint) {
      return false;
    }

    const reached = this.moveToward(this.evasionPoint, this.returnToCoverSpeed * 1.18, deltaMs);
    if (reached || Phaser.Math.Distance.BetweenPoints(this.getPosition(), this.evasionPoint) < 12) {
      this.evasionPoint = undefined;
    }
    return true;
  }

  private readSensors(): DuelistBossSensors {
    const currentCoverHasPeekLine = this.currentCoverHasPeekLineToHero();
    const currentCoverBlocksHero = Boolean(this.currentCover && this.blocksLineFromHeroToBoss(this.currentCover));
    const hasDirectLineOfSight = this.hasLineOfSight(this.getPosition(), this.playerPosition);

    return {
      heroDistance: Phaser.Math.Distance.BetweenPoints(this.getPosition(), this.playerPosition),
      heroTooClose: this.heroTooClose(),
      hasDirectLineOfSight,
      hasCurrentCover: Boolean(this.currentCover),
      currentCoverHasPeekLine,
      currentCoverBlocksHero,
      canPreciseShot: this.abilitySystem.canUse(DuelistAbilityId.PreciseShot),
      shouldReposition:
        this.heroTooClose() ||
        this.shotsFromCurrentCover >= this.maxShotsPerCover ||
        !this.currentCover ||
        !currentCoverHasPeekLine ||
        !currentCoverBlocksHero,
    };
  }

  private syncMemory(): void {
    this.memory.lastCover = this.lastCover;
    this.memory.lastPeekPoint = this.lastPeekPoint;
    this.memory.shotsFromCurrentCover = this.shotsFromCurrentCover;
  }

  private updateTimers(deltaMs: number): void {
    this.stateTimerMs += deltaMs;
    this.abilitySystem.update(deltaMs);
    this.attackCooldownMs = this.abilitySystem.getCooldownMs(DuelistAbilityId.PreciseShot);
    this.deflectCooldownMs = this.abilitySystem.getCooldownMs(DuelistAbilityId.Deflect);
    this.memory.recentDamageTaken = Math.max(0, this.memory.recentDamageTaken - deltaMs / 1400);
  }

  private updateHeroData(deltaMs: number, playerPosition: Phaser.Math.Vector2): void {
    this.playerPosition = playerPosition.clone();
    if (this.lastPlayerPosition && deltaMs > 0) {
      this.playerVelocity = playerPosition.clone().subtract(this.lastPlayerPosition).scale(1000 / deltaMs);
    }
    this.lastPlayerPosition = playerPosition.clone();
  }

  private resetAttackCooldown(): void {
    this.abilitySystem.startCooldown(DuelistAbilityId.PreciseShot, Phaser.Math.Between(750, 1150));
    this.attackCooldownMs = this.abilitySystem.getCooldownMs(DuelistAbilityId.PreciseShot);
  }

  private changeState(nextState: DuelistBossState): void {
    if (this.currentState === nextState) {
      return;
    }
    this.currentState = nextState;
    this.stateTimerMs = 0;
    this.stuckTimerMs = 0;
    this.movementDetourPoint = undefined;
    this.targetPeekPoint = nextState === DuelistBossState.PeekFromCover ? this.targetPeekPoint : undefined;
    if (nextState === DuelistBossState.PhaseEnd || nextState === DuelistBossState.HitReact) {
      this.pendingShotTarget = undefined;
      this.shotWindupMs = 0;
      this.destroyTelegraph();
    }
  }

  private updateTimedState(nextState: DuelistBossState, durationMs: number): void {
    if (this.stateTimerMs >= durationMs) {
      this.changeState(nextState);
    }
  }

  private clampToRoom(point: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(point.x, this.roomBounds.left + BOSS_SIZE / 2, this.roomBounds.right - BOSS_SIZE / 2),
      Phaser.Math.Clamp(point.y, this.roomBounds.top + BOSS_SIZE / 2, this.roomBounds.bottom - BOSS_SIZE / 2),
    );
  }

  private spawnDeflectSpark(position: Phaser.Math.Vector2): void {
    const spark = this.scene.add.circle(position.x, position.y, 18, 0xffffff, 0.82).setStrokeStyle(3, 0xf4d06f).setDepth(20);
    this.scene.tweens.add({
      targets: spark,
      scale: 1.8,
      alpha: 0,
      duration: 180,
      onComplete: () => spark.destroy(),
    });
  }

  private destroyTelegraph(): void {
    this.telegraph?.destroy();
    this.telegraph = undefined;
  }

  private updateSpriteAnimation(): void {
    this.sprite.setPosition(this.visual.x, this.visual.y - 12);

    if (this.currentState === DuelistBossState.PhaseEnd) {
      this.sprite.setTint(0x7a6a55);
      this.playDuelistAnimation('duelist-idle');
      return;
    }

    if (this.currentState === DuelistBossState.FirePreciseShot || this.pendingShotTarget) {
      this.playDuelistAnimation(`duelist-attack-${this.getFacingDirection()}`);
      return;
    }

    if (
      this.currentState === DuelistBossState.MoveToCover ||
      this.currentState === DuelistBossState.PeekFromCover ||
      this.currentState === DuelistBossState.ReturnToCover ||
      this.currentState === DuelistBossState.Reposition
    ) {
      this.playDuelistAnimation(`duelist-move-${this.getFacingDirection()}`);
      return;
    }

    this.playDuelistAnimation('duelist-idle');
  }

  private playDuelistAnimation(key: string): void {
    if (this.sprite.anims.currentAnim?.key === key) {
      return;
    }
    this.sprite.play(key, true);
  }

  private getFacingDirection(): string {
    const x = this.bossFacing.x;
    const y = this.bossFacing.y;
    const diagonalThreshold = 0.38;

    if (Math.abs(x) > diagonalThreshold && Math.abs(y) > diagonalThreshold) {
      if (x > 0 && y < 0) {
        return 'northeast';
      }
      if (x < 0 && y < 0) {
        return 'northwest';
      }
      if (x > 0 && y > 0) {
        return 'southeast';
      }
      return 'southwest';
    }

    if (Math.abs(x) > Math.abs(y)) {
      return x > 0 ? 'east' : 'west';
    }

    return y > 0 ? 'south' : 'north';
  }

  private updateLabels(): void {
    this.sprite.setPosition(this.visual.x, this.visual.y - 12);
    this.stateText.setPosition(this.visual.x, this.visual.y - 54);
    this.hpText.setPosition(this.visual.x, this.visual.y - 74);
    this.stateText.setText(`${this.phaseController.currentPhase} / ${this.currentState}`);
    this.hpText.setText(`HP ${this.hp}/${this.maxHp} · tiros ${this.shotsFromCurrentCover}/${this.maxShotsPerCover}`);
  }
}
