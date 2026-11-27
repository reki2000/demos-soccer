// Shared behaviour for the controls inside each sport's fullscreen surface.
export function setupViewControls() {
  const deck = document.querySelector('.arena-controls');
  const summary = deck.querySelector('summary');
  deck.addEventListener('keydown', event => {
    if (event.key === 'Escape' && deck.open) {
      event.preventDefault();
      deck.open = false;
      summary.focus();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (deck.open && !deck.contains(event.target)) deck.open = false;
  });
  for (const key of ['camera', 'speed']) {
    const buttons = document.querySelectorAll(`[data-${key}]`);
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.classList.contains('active')));
      button.addEventListener('click', () => {
        for (const option of buttons) option.setAttribute('aria-pressed', String(option === button));
      });
    }
  }
}
