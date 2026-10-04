interface ResizePaneOptions {
  parent: HTMLElement;
  pane: HTMLElement;
  handle: HTMLElement;
  property: string;
  minPane: number;
  minRemaining: number;
}

export function setupPaneResize({
  parent,
  pane,
  handle,
  property,
  minPane,
  minRemaining,
}: ResizePaneOptions): void {
  const bounds = (): { min: number; max: number } => {
    const max = Math.max(0, parent.clientWidth - handle.offsetWidth - minRemaining);
    return { min: Math.min(minPane, max), max };
  };

  const resize = (width: number): void => {
    const { min, max } = bounds();
    const value = Math.round(Math.max(min, Math.min(max, width)));
    parent.style.setProperty(property, `${value}px`);
    handle.setAttribute('aria-valuemin', String(min));
    handle.setAttribute('aria-valuemax', String(max));
    handle.setAttribute('aria-valuenow', String(value));
  };

  const { min, max } = bounds();
  handle.setAttribute('aria-valuemin', String(min));
  handle.setAttribute('aria-valuemax', String(max));
  handle.setAttribute(
    'aria-valuenow',
    String(Math.round(Math.max(min, Math.min(max, pane.getBoundingClientRect().width))))
  );
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    parent.classList.add('swe-resizing');
  });
  handle.addEventListener('pointermove', (event) => {
    if (handle.hasPointerCapture(event.pointerId)) {
      resize(event.clientX - parent.getBoundingClientRect().left);
    }
  });
  const finish = (): void => parent.classList.remove('swe-resizing');
  handle.addEventListener('pointerup', (event) => {
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    finish();
  });
  handle.addEventListener('pointercancel', finish);
  handle.addEventListener('lostpointercapture', finish);
  handle.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    resize(pane.getBoundingClientRect().width + (event.key === 'ArrowRight' ? 20 : -20));
  });
}
