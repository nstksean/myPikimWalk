/**
 * Joystick key listener — streams held keys to the backend via WebSocket.
 *
 * Sends: { type: "keys", keys: ["w", "a"] }  (empty array = stopped)
 */

const JOYSTICK_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

let heldKeys = new Set();
let active = false;  // only stream while joystick mode is engaged

export function initJoystick() {
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (!JOYSTICK_KEYS.has(key)) return;
    e.preventDefault();
    heldKeys.add(key);
    sendKeys();
    updateDpad(key, true);
  });

  document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    heldKeys.delete(key);
    sendKeys();
    updateDpad(key, false);
  });

  // D-pad touch/click buttons
  document.querySelectorAll('.dpad-btn[data-key]').forEach(btn => {
    const key = btn.dataset.key.toLowerCase();
    if (!key) return;

    const press = () => { heldKeys.add(key); sendKeys(); btn.classList.add('pressed'); };
    const release = () => { heldKeys.delete(key); sendKeys(); btn.classList.remove('pressed'); };

    btn.addEventListener('mousedown', press);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); press(); });
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
    btn.addEventListener('touchend', release);
  });
}

function sendKeys() {
  const ws = window._ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'keys', keys: [...heldKeys] }));
}

function updateDpad(key, pressed) {
  const btn = document.querySelector(`.dpad-btn[data-key="${key}"]`) ||
              document.querySelector(`.dpad-btn[data-key="${key.charAt(0).toUpperCase() + key.slice(1)}"]`);
  if (btn) btn.classList.toggle('pressed', pressed);
}
