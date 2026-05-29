const PROGRESS_KEY = 'dungeon-demo-progress-v1';

export type GameProgress = {
  heroName: string;
  currentLevel: number;
};

export class ProgressStore {
  static load(): GameProgress | null {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<GameProgress>;
      if (typeof parsed.heroName !== 'string' || parsed.heroName.trim().length === 0) {
        return null;
      }

      return {
        heroName: parsed.heroName,
        currentLevel: typeof parsed.currentLevel === 'number' ? parsed.currentLevel : 1,
      };
    } catch {
      return null;
    }
  }

  static hasHeroName(): boolean {
    return this.load() !== null;
  }

  static saveHeroName(heroName: string): GameProgress {
    const progress: GameProgress = {
      heroName: heroName.trim(),
      currentLevel: 1,
    };
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return progress;
  }

  static getHeroName(): string {
    return this.load()?.heroName ?? 'Heroe';
  }
}
