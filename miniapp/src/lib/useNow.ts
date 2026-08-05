import { useSyncExternalStore } from 'react';

/**
 * One shared 1 Hz clock for every live timer on screen. A per-component
 * interval would drift apart and repaint the tree several times a second.
 */
const listeners = new Set<() => void>();
let timer: number | null = null;
let now = Date.now();

function tick(): void {
  now = Date.now();
  for (const listener of listeners) listener();
  schedule();
}

/** Re-aims at the next whole second so digits flip on the boundary. */
function schedule(): void {
  const delay = 1000 - (Date.now() % 1000);
  timer = window.setTimeout(tick, delay);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    now = Date.now();
    schedule();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

// Coming back from the background can leave the clock a minute behind.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && listeners.size > 0) {
      if (timer !== null) clearTimeout(timer);
      tick();
    }
  });
}

export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}
