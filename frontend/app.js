/**
 * myPikminGps frontend — Leaflet + WebSocket + control panel
 */

import { initJoystick } from '/static/joystick.js';
import { initWaypointPanel } from '/static/panel.js';

// ── Map setup ────────────────────────────────────────────────────────────────
const map = L.map('map').setView([25.0330, 121.5654], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

// Current position marker
const posIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;background:#4ade80;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px #4ade80"></div>',
  iconAnchor: [7, 7],
});

let posMarker = null;
let trailCoords = [];
let trailPolyline = L.polyline([], { color: '#4ade80', weight: 2, opacity: 0.6 }).addTo(map);

// Destination marker for single-point navigate
let destMarker = null;

// ── State ────────────────────────────────────────────────────────────────────
let currentMode = 'navigate';
let currentSpeed = 3.5;

// ── Speed control ────────────────────────────────────────────────────────────
const speedInput = document.getElementById('speed-input');
const speedLabel = document.getElementById('speed-label');

speedInput.addEventListener('input', () => {
  currentSpeed = parseFloat(speedInput.value);
  speedLabel.textContent = `${currentSpeed.toFixed(1)} km/h`;
  api('POST', '/api/speed', { speed_kmh: currentSpeed });
});

// ── Mode tabs ────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    currentMode = tab.dataset.mode;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${currentMode}`)?.classList.add('active');
  });
});

// ── Navigate panel ───────────────────────────────────────────────────────────
document.getElementById('btn-navigate').addEventListener('click', async () => {
  const lat = parseFloat(document.getElementById('nav-lat').value);
  const lng = parseFloat(document.getElementById('nav-lng').value);
  if (isNaN(lat) || isNaN(lng)) return alert('請輸入有效的座標');
  await startNavigate(lat, lng);
});

async function startNavigate(lat, lng) {
  setDestMarker(lat, lng);
  await api('POST', '/api/navigate', { lat, lng, speed_kmh: currentSpeed });
}

function setDestMarker(lat, lng) {
  if (destMarker) destMarker.remove();
  destMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: '',
      html: '<div style="width:12px;height:12px;background:#f59e0b;border:2px solid #fff;border-radius:50%"></div>',
      iconAnchor: [6, 6],
    })
  }).addTo(map);
}

// ── Map click ────────────────────────────────────────────────────────────────
map.on('click', async (e) => {
  const { lat, lng } = e.latlng;

  if (e.originalEvent.shiftKey) {
    // Shift+click → add waypoint
    waypointPanel.addWaypoint(lat, lng);
    return;
  }

  if (currentMode === 'navigate') {
    document.getElementById('nav-lat').value = lat.toFixed(6);
    document.getElementById('nav-lng').value = lng.toFixed(6);
    await startNavigate(lat, lng);
  }
});

// ── Joystick panel ───────────────────────────────────────────────────────────
document.getElementById('btn-joystick-start').addEventListener('click', async () => {
  await api('POST', '/api/joystick/start', { speed_kmh: currentSpeed });
});

// ── Stop button ──────────────────────────────────────────────────────────────
document.getElementById('btn-stop').addEventListener('click', async () => {
  await api('POST', '/api/stop');
  trailCoords = [];
  trailPolyline.setLatLngs([]);
  if (destMarker) { destMarker.remove(); destMarker = null; }
});

// ── Teleport ─────────────────────────────────────────────────────────────────
document.getElementById('btn-teleport').addEventListener('click', async () => {
  const lat = parseFloat(document.getElementById('tp-lat').value);
  const lng = parseFloat(document.getElementById('tp-lng').value);
  if (isNaN(lat) || isNaN(lng)) return alert('請輸入有效的座標');
  await api('POST', '/api/teleport', { lat, lng });
});

// ── Connect ───────────────────────────────────────────────────────────────────
document.getElementById('btn-connect').addEventListener('click', async () => {
  const res = await api('POST', '/api/connect');
  if (res?.connected) {
    updateDeviceStatus(true, res.udid, res.ios_version);
  }
});

// ── WebSocket ────────────────────────────────────────────────────────────────
function connectWS() {
  const ws = new WebSocket(`ws://${location.host}/ws`);

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'position') {
      updatePosition(msg.lat, msg.lng, msg.mode);
    }
  };

  ws.onclose = () => setTimeout(connectWS, 2000);

  // Expose WS for joystick key streaming
  window._ws = ws;
}

connectWS();

// ── Position update ──────────────────────────────────────────────────────────
function updatePosition(lat, lng, mode) {
  if (!posMarker) {
    posMarker = L.marker([lat, lng], { icon: posIcon }).addTo(map);
    map.setView([lat, lng], map.getZoom());
  } else {
    posMarker.setLatLng([lat, lng]);
  }

  trailCoords.push([lat, lng]);
  if (trailCoords.length > 500) trailCoords.shift();
  trailPolyline.setLatLngs(trailCoords);

  const el = document.getElementById('status-pos');
  el.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  document.getElementById('status-mode').textContent = mode;
}

function updateDeviceStatus(connected, udid, version) {
  const el = document.getElementById('status-device');
  if (connected) {
    el.textContent = `iOS ${version} (${udid?.slice(-4)})`;
    el.className = 'device-connected';
  } else {
    el.textContent = '裝置未連線';
    el.className = 'device-disconnected';
  }
}

// ── Initial status poll ───────────────────────────────────────────────────────
async function pollStatus() {
  const data = await api('GET', '/api/status');
  if (data?.connected) {
    updateDeviceStatus(true, data.udid, data.ios_version);
    if (data.lat && data.lng) {
      updatePosition(data.lat, data.lng, data.mode);
      map.setView([data.lat, data.lng], 16);
    }
  }
  speedInput.value = data?.speed_kmh ?? 3.5;
  speedLabel.textContent = `${(data?.speed_kmh ?? 3.5).toFixed(1)} km/h`;
}

pollStatus();

// ── Sub-module init ───────────────────────────────────────────────────────────
initJoystick();
const waypointPanel = initWaypointPanel(map, currentSpeed);

// ── REST helper ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
  try {
    const opts = {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    };
    const res = await fetch(path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`API ${method} ${path} → ${res.status}`, err);
      return null;
    }
    return res.json();
  } catch (e) {
    console.error('fetch error', e);
    return null;
  }
}

export { api, map };
