import Phaser from 'phaser';
import './styles.css';
import { ProgressStore } from './save/ProgressStore';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HeroNameScreen } from './ui/HeroNameScreen';

const isDesktopLayout = true;
document.documentElement.dataset.layout = 'desktop';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#101820',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: isDesktopLayout ? 1280 : 360,
    height: isDesktopLayout ? 1024 : 640,
  },
  scene: [BootScene, GameScene],
};

const startGame = (): void => {
  new Phaser.Game(config);
};

const uiRoot = document.querySelector<HTMLElement>('#ui-root');
if (!uiRoot) {
  throw new Error('Missing #ui-root element');
}

if (ProgressStore.hasHeroName()) {
  startGame();
} else {
  new HeroNameScreen(uiRoot, startGame);
}
