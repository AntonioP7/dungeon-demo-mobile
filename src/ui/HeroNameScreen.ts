import { ProgressStore } from '../save/ProgressStore';

type StartCallback = () => void;

export class HeroNameScreen {
  private readonly root: HTMLElement;
  private readonly onStart: StartCallback;
  private readonly element: HTMLElement;

  constructor(root: HTMLElement, onStart: StartCallback) {
    this.root = root;
    this.onStart = onStart;
    this.element = this.createScreen();
    this.root.innerHTML = '';
    this.root.append(this.element);
  }

  destroy(): void {
    this.element.remove();
  }

  private createScreen(): HTMLElement {
    const screen = document.createElement('section');
    screen.className = 'name-screen';
    screen.setAttribute('aria-label', 'Crear heroe');

    const panel = document.createElement('form');
    panel.className = 'name-panel';

    const title = document.createElement('h1');
    title.textContent = 'Nombre del heroe';

    const input = document.createElement('input');
    input.className = 'name-input';
    input.type = 'text';
    input.name = 'heroName';
    input.maxLength = 16;
    input.autocomplete = 'off';
    input.placeholder = 'Tu heroe';
    input.setAttribute('aria-label', 'Nombre del heroe');

    const error = document.createElement('p');
    error.className = 'name-error';
    error.setAttribute('aria-live', 'polite');

    const button = document.createElement('button');
    button.className = 'name-submit';
    button.type = 'submit';
    button.textContent = 'Empezar';

    panel.addEventListener('submit', (event) => {
      event.preventDefault();
      const heroName = input.value.trim();

      if (heroName.length < 2) {
        error.textContent = 'Minimo 2 letras';
        input.focus();
        return;
      }

      ProgressStore.saveHeroName(heroName);
      this.destroy();
      this.onStart();
    });

    panel.append(title, input, error, button);
    screen.append(panel);

    window.setTimeout(() => input.focus(), 0);
    return screen;
  }
}
