import { expect, test } from 'bun:test';
import { setupPaneResize } from '../../src/features/pane-resize';

test('境界のドラッグと矢印キーで幅を調整し、最小幅を守る', () => {
  const parent = document.createElement('div');
  const pane = document.createElement('div');
  const handle = document.createElement('div');
  parent.append(pane, handle);
  Object.defineProperty(parent, 'clientWidth', { value: 800 });
  Object.defineProperty(handle, 'offsetWidth', { value: 6 });
  pane.getBoundingClientRect = () => ({ left: 0, width: 250 }) as DOMRect;
  parent.getBoundingClientRect = () => ({ left: 100 }) as DOMRect;
  let captured = false;
  handle.setPointerCapture = () => { captured = true; };
  handle.hasPointerCapture = () => captured;
  handle.releasePointerCapture = () => { captured = false; };

  setupPaneResize({
    parent, pane, handle, property: '--pane-width', minPane: 120, minRemaining: 200,
  });
  const pointer = (type: string, clientX: number): void => {
    const event = new window.Event(type);
    Object.assign(event, { pointerId: 1, button: 0, clientX });
    handle.dispatchEvent(event);
  };

  pointer('pointerdown', 350);
  pointer('pointermove', 1000);
  expect(parent.style.getPropertyValue('--pane-width')).toBe('594px');
  expect(handle.getAttribute('aria-valuenow')).toBe('594');
  pointer('pointermove', 110);
  expect(parent.style.getPropertyValue('--pane-width')).toBe('120px');
  pointer('pointerup', 110);
  expect(parent.classList.contains('swe-resizing')).toBe(false);
  pointer('pointermove', 500);
  expect(parent.style.getPropertyValue('--pane-width')).toBe('120px');

  handle.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(parent.style.getPropertyValue('--pane-width')).toBe('270px');
});
