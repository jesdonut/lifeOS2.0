// gestures.js — axis-locked trackpad swipe navigation
//
// Once a gesture commits to horizontal or vertical, it stays locked
// until the gesture ends (no wheel events for IDLE_MS).
// Horizontal → tab navigation. Vertical → normal page scroll.

const AXIS_THRESHOLD = 6;    // px accumulated before axis locks
const SWITCH_THRESHOLD = 60; // px of committed horizontal drag to trigger switch
const IDLE_MS = 120;         // ms of silence = gesture ended

export function initGestures({ stage, getIndex, getCount, onSwitch }) {
  let axis   = null;   // 'x' | 'y' | null
  let accX   = 0;      // accumulated |deltaX| before lock
  let accY   = 0;      // accumulated |deltaY| before lock
  let dragX  = 0;      // live horizontal offset during gesture
  let timer  = null;

  function reset() {
    axis = null;
    accX = 0;
    accY = 0;
    dragX = 0;
  }

  function snap() {
    // Commit: did we swipe far enough to switch?
    const committed = dragX;
    reset();

    stage.style.transition = `transform ${220}ms cubic-bezier(0,0,0.2,1)`;

    if (committed < -SWITCH_THRESHOLD) {
      onSwitch(+1);  // next tab
    } else if (committed > SWITCH_THRESHOLD) {
      onSwitch(-1);  // prev tab
    } else {
      // Bounce back — set transform to current index position
      applyOffset(0);
    }

    // Remove transition after it plays
    setTimeout(() => { stage.style.transition = ''; }, 240);
  }

  function applyOffset(extra) {
    const i = getIndex();
    const w = stage.parentElement.clientWidth;
    stage.style.transform = `translateX(${-i * w + extra}px)`;
  }

  stage.parentElement.addEventListener('wheel', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { snap(); }, IDLE_MS);

    // Prevent browser back/forward navigation: intercept any predominantly
    // horizontal swipe before the browser's own gesture recognizer sees it.
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault();

    // Accumulate before axis locks
    if (!axis) {
      accX += Math.abs(e.deltaX);
      accY += Math.abs(e.deltaY);
      if (accX + accY >= AXIS_THRESHOLD) {
        axis = accX >= accY ? 'x' : 'y';
      }
    }

    if (axis === 'x') {
      e.preventDefault();
      e.stopPropagation();
      dragX -= e.deltaX;
      // Clamp: don't drag past first/last tab
      const max = (getCount() - 1);
      const i   = getIndex();
      if (i === 0   && dragX > 0)   dragX = Math.min(dragX * 0.2, 30);
      if (i === max && dragX < 0)   dragX = Math.max(dragX * 0.2, -30);

      stage.style.transition = 'none';
      applyOffset(dragX);
    }
    // axis === 'y' or not yet locked: fall through to normal scroll
  }, { passive: false });

  // Called by app.js whenever the active tab index changes
  return {
    jumpTo(index) {
      reset();
      clearTimeout(timer);
      const w = stage.parentElement.clientWidth;
      stage.style.transition = `transform ${220}ms cubic-bezier(0,0,0.2,1)`;
      stage.style.transform  = `translateX(${-index * w}px)`;
      setTimeout(() => { stage.style.transition = ''; }, 240);
    },
  };
}
