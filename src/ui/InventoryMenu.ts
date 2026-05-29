export class InventoryMenu {
  private readonly root: HTMLElement;
  private readonly element: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.element = this.createMenu();
    this.root.append(this.element);
  }

  get isOpen(): boolean {
    return this.element.classList.contains('is-open');
  }

  toggle(): void {
    this.setOpen(!this.isOpen);
  }

  setOpen(open: boolean): void {
    this.element.classList.toggle('is-open', open);
    this.element.setAttribute('aria-hidden', String(!open));
  }

  destroy(): void {
    this.element.remove();
  }

  private createMenu(): HTMLElement {
    const overlay = document.createElement('section');
    overlay.className = 'inventory-menu';
    overlay.setAttribute('aria-label', 'Menu de inventario');
    overlay.setAttribute('aria-hidden', 'true');

    const panel = document.createElement('div');
    panel.className = 'inventory-panel';

    const title = document.createElement('h1');
    title.textContent = 'Items';

    const grid = document.createElement('div');
    grid.className = 'inventory-grid';

    for (let index = 0; index < 12; index += 1) {
      const slot = document.createElement('div');
      slot.className = 'inventory-slot';
      slot.setAttribute('aria-label', `Hueco vacio ${index + 1}`);
      grid.append(slot);
    }

    panel.append(title, grid);
    overlay.append(panel);
    return overlay;
  }
}
