/**
 * myPikminGps frontend — Leaflet + WebSocket + control panel
 */

import { initJoystick } from '/static/joystick.js';
import { initWaypointPanel } from '/static/panel.js';

// ── Map tiles ────────────────────────────────────────────────────────────────
const TILE_STYLES = {
  dark:    { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
             attr: '© OpenStreetMap © CARTO', label: '🌑 深色' },
  voyager: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
             attr: '© OpenStreetMap © CARTO', label: '🗺 彩色' },
  sat:     { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
             attr: '© Esri', label: '🛰 衛星' },
};

const map = L.map('map').setView([25.0330, 121.5654], 15);
let currentTileLayer = L.tileLayer(TILE_STYLES.dark.url, {
  attribution: TILE_STYLES.dark.attr, maxZoom: 19,
}).addTo(map);

function switchTile(key) {
  const style = TILE_STYLES[key];
  if (!style) return;
  map.removeLayer(currentTileLayer);
  currentTileLayer = L.tileLayer(style.url, { attribution: style.attr, maxZoom: 19 }).addTo(map);
}

// ── Pikmin position marker ───────────────────────────────────────────────────
const PIKMIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
  <!-- shadow -->
  <ellipse cx="18" cy="46" rx="9" ry="3" fill="rgba(0,0,0,0.3)"/>
  <!-- stem -->
  <rect x="17" y="6" width="2" height="9" rx="1" fill="#3a6e1a"/>
  <!-- leaf -->
  <ellipse cx="18" cy="5" rx="7" ry="4" fill="#4a9e22" transform="rotate(-20 18 5)"/>
  <ellipse cx="19" cy="4" rx="6" ry="3" fill="#66cc2e" transform="rotate(-20 18 5)"/>
  <!-- body -->
  <ellipse cx="18" cy="35" rx="11" ry="10" fill="#f9d74c"/>
  <ellipse cx="18" cy="33" rx="8" ry="6" fill="#fce97a"/>
  <!-- head -->
  <circle cx="18" cy="19" r="10" fill="#f9d74c"/>
  <circle cx="18" cy="18" r="7.5" fill="#fce97a"/>
  <!-- eyes white -->
  <circle cx="14.5" cy="17" r="3" fill="white"/>
  <circle cx="21.5" cy="17" r="3" fill="white"/>
  <!-- pupils -->
  <circle cx="15" cy="17.5" r="1.5" fill="#1a1a2e"/>
  <circle cx="22" cy="17.5" r="1.5" fill="#1a1a2e"/>
  <!-- eye shine -->
  <circle cx="15.5" cy="17" r="0.5" fill="white"/>
  <circle cx="22.5" cy="17" r="0.5" fill="white"/>
  <!-- feet -->
  <ellipse cx="14" cy="44" rx="4" ry="2.5" fill="#e8b820"/>
  <ellipse cx="22" cy="44" rx="4" ry="2.5" fill="#e8b820"/>
</svg>`;

const posIcon = L.divIcon({
  className: '',
  html: PIKMIN_SVG,
  iconSize:   [36, 48],
  iconAnchor: [18, 46],
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

const speedWarning = document.getElementById('speed-warning');

speedInput.addEventListener('input', () => {
  currentSpeed = parseFloat(speedInput.value);
  speedLabel.textContent = `${currentSpeed.toFixed(1)} km/h`;
  speedWarning.style.display = currentSpeed > 5 ? 'block' : 'none';
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

document.getElementById('btn-locate').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('瀏覽器不支援定位');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      document.getElementById('nav-lat').value = lat.toFixed(6);
      document.getElementById('nav-lng').value = lng.toFixed(6);
      map.setView([lat, lng], 17);
      // Also set as simulation starting point (teleport silently)
      api('POST', '/api/teleport', { lat, lng });
    },
    () => alert('無法取得位置，請確認瀏覽器已允許定位權限'),
    { enableHighAccuracy: true, timeout: 8000 }
  );
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

// ── Map style switcher ────────────────────────────────────────────────────────
document.querySelectorAll('.tile-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTile(btn.dataset.tile);
    document.querySelectorAll('.tile-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
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
