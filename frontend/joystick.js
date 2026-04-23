/**
 * Joystick: circle drag joystick + keyboard fallback.
 * Sends { type:"vector", vx, vy } for circle drag (continuous, [-1,1]).
 * Sends { type:"keys", keys:[...] } for keyboard.
 */

const KEYBOARD_KEYS = new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']);

let heldKeys = new Set();

export function initJoystick() {
  initCircleJoystick();
  initKeyboard();
}

// ── Circle joystick ────────────────────────────────────────────────────────
function initCircleJoystick() {
  const base  = document.getElementById('joystick-base');
  const thumb = document.getElementById('joystick-thumb');
  if (!base || !thumb) return;

  const RADIUS = 44; // max thumb travel in px
  let dragging = false;
  let originX = 0, originY = 0;

  function getCenter() {
    const r = base.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  function applyThumb(clientX, clientY) {
    const { cx, cy } = getCenter();
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > RADIUS) {
      dx = dx / dist * RADIUS;
      dy = dy / dist * RADIUS;
    }
    thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // vx = east, vy = north (flip Y because screen Y is inverted)
    const vx =  dx / RADIUS;
    const vy = -dy / RADIUS;
    sendVector(vx, vy);
  }

  function release() {
    if (!dragging) return;
    dragging = false;
    base.classList.remove('active');
    thumb.style.transform = 'translate(-50%, -50%)';
    sendVector(0, 0);
  }

  // Mouse
  base.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    base.classList.add('active');
    applyThumb(e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    applyThumb(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', release);

  // Touch
  base.addEventListener('touchstart', (e) => {
    e.preventDefault();
    dragging = true;
    base.classList.add('active');
    applyThumb(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    applyThumb(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  document.addEventListener('touchend', release);
}

// ── Keyboard ───────────────────────────────────────────────────────────────
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (!KEYBOARD_KEYS.has(key)) return;
    e.preventDefault();
    heldKeys.add(key);
    sendKeys();
  });
  document.addEventListener('keyup', (e) => {
    heldKeys.delete(e.key.toLowerCase());
    sendKeys();
  });
}

// ── WS helpers ─────────────────────────────────────────────────────────────
function sendVector(vx, vy) {
  const ws = window._ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'vector', vx, vy }));
}

function sendKeys() {
  const ws = window._ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'keys', keys: [...heldKeys] }));
}
