export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  actionA: boolean;
  actionB: boolean;
};

type MenuCallback = () => void;

export class TouchControls {
  readonly state: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    actionA: false,
    actionB: false,
  };

  private readonly root: HTMLElement;
  private readonly onMenu: MenuCallback;

  constructor(root: HTMLElement, onMenu: MenuCallback) {
    this.root = root;
    this.onMenu = onMenu;
    this.root.append(this.createControls());
  }

  destroy(): void {
    this.root.innerHTML = '';
  }

  private createControls(): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'touch-controls';

    const menuButton = this.createButton('menu-button', 'Menu', 'Abrir menu', this.onMenu);
    controls.append(menuButton);

    const dpad = document.createElement('div');
    dpad.className = 'dpad';
    dpad.append(
      this.createHoldButton('dpad-up', 'up', 'Arriba', '▲'),
      this.createHoldButton('dpad-left', 'left', 'Izquierda', '◀'),
      this.createHoldButton('dpad-right', 'right', 'Derecha', '▶'),
      this.createHoldButton('dpad-down', 'down', 'Abajo', '▼'),
    );

    const actions = document.createElement('div');
    actions.className = 'action-buttons';
    actions.append(
      this.createHoldButton('action-button action-b', 'actionB', 'Accion B', 'B'),
      this.createHoldButton('action-button action-a', 'actionA', 'Interactuar A', 'A'),
    );

    controls.append(dpad, actions);
    return controls;
  }

  private createHoldButton(className: string, key: keyof InputState, label: string, text: string): HTMLButtonElement {
    const button = this.createButton(className, text, label);
    const setPressed = (pressed: boolean) => {
      this.state[key] = pressed;
      button.classList.toggle('is-pressed', pressed);
    };

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setPressed(true);
    });
    button.addEventListener('pointerup', () => setPressed(false));
    button.addEventListener('pointercancel', () => setPressed(false));
    button.addEventListener('lostpointercapture', () => setPressed(false));
    button.addEventListener('contextmenu', (event) => event.preventDefault());

    return button;
  }

  private createButton(className: string, text: string, label: string, onClick?: MenuCallback): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = className;
    button.type = 'button';
    button.textContent = text;
    button.setAttribute('aria-label', label);
    if (onClick) {
      button.addEventListener('click', onClick);
    }
    return button;
  }
}
