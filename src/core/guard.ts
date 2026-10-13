/**
 * Page hardening for a game embed: no context menu, right-click, selection,
 * drag, pinch/double-tap zoom or browser zoom shortcuts.
 */
export function installInputGuards(): void {
  const prevent = (e: Event) => e.preventDefault();
  window.addEventListener('contextmenu', prevent, { capture: true });
  document.addEventListener('selectstart', prevent);
  document.addEventListener('dragstart', prevent);
  // iOS Safari pinch gestures
  document.addEventListener('gesturestart', prevent as EventListener);
  document.addEventListener('gesturechange', prevent as EventListener);
  // right/middle mouse buttons do nothing
  window.addEventListener(
    'mousedown',
    (e) => {
      if (e.button !== 0) e.preventDefault();
    },
    { capture: true },
  );
  window.addEventListener(
    'auxclick',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true },
  );
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true },
  );
  // multi-touch zoom & double-tap zoom
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
  // double-tap zoom is disabled via CSS `touch-action: manipulation`
  document.addEventListener('dblclick', prevent, { passive: false });
  // ctrl+wheel / ctrl +/- zoom
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
  });
}
