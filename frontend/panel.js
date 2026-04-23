/**
 * Multi-waypoint panel logic.
 *
 * Exposes: initWaypointPanel(map, defaultSpeed) → { addWaypoint }
 */

import { api } from '/static/app.js';

export function initWaypointPanel(map, defaultSpeed) {
  const listEl = document.getElementById('waypoint-list');
  const startBtn = document.getElementById('btn-route-start');
  const clearBtn = document.getElementById('btn-route-clear');
  const loopCk = document.getElementById('route-loop');
  const dwellDefault = document.getElementById('dwell-default');

  let waypoints = [];          // [{ lat, lng, dwell_s, marker }]
  let routePreviewLine = null; // Leaflet polyline preview

  function addWaypoint(lat, lng) {
    const dwell = parseFloat(dwellDefault.value) || 5;
    const idx = waypoints.length;

    const marker = createWpMarker(lat, lng, idx + 1);
    marker.addTo(map);

    waypoints.push({ lat, lng, dwell_s: dwell, marker });
    renderList();
    drawPreview();
  }

  function removeWaypoint(idx) {
    waypoints[idx].marker.remove();
    waypoints.splice(idx, 1);
    // Re-index markers
    waypoints.forEach((wp, i) => {
      wp.marker.remove();
      wp.marker = createWpMarker(wp.lat, wp.lng, i + 1);
      wp.marker.addTo(map);
    });
    renderList();
    drawPreview();
  }

  function renderList() {
    listEl.innerHTML = '';
    waypoints.forEach((wp, i) => {
      const li = document.createElement('li');
      li.className = 'waypoint-item';
      li.innerHTML = `
        <span class="wp-idx">${i + 1}</span>
        <span class="wp-coords">${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}</span>
        <input class="wp-dwell" type="number" min="0" max="300" step="1" value="${wp.dwell_s}" title="停留秒數" />
        <button class="wp-remove" title="移除">×</button>
      `;
      li.querySelector('.wp-dwell').addEventListener('change', (e) => {
        waypoints[i].dwell_s = parseFloat(e.target.value) || 0;
      });
      li.querySelector('.wp-remove').addEventListener('click', () => removeWaypoint(i));
      listEl.appendChild(li);
    });
  }

  function drawPreview() {
    if (routePreviewLine) routePreviewLine.remove();
    if (waypoints.length < 2) return;
    const coords = waypoints.map(wp => [wp.lat, wp.lng]);
    routePreviewLine = L.polyline(coords, {
      color: '#f59e0b',
      weight: 2,
      dashArray: '6 4',
      opacity: 0.7,
    }).addTo(map);
  }

  function clearAll() {
    waypoints.forEach(wp => wp.marker.remove());
    waypoints = [];
    if (routePreviewLine) { routePreviewLine.remove(); routePreviewLine = null; }
    renderList();
  }

  startBtn.addEventListener('click', async () => {
    if (waypoints.length < 2) return alert('至少需要兩個停留點');
    const speedKmh = parseFloat(document.getElementById('speed-input').value) || defaultSpeed;
    const payload = {
      waypoints: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng, dwell_s: wp.dwell_s })),
      speed_kmh: speedKmh,
      loop: loopCk.checked,
    };
    const res = await api('POST', '/api/route', payload);
    if (res?.ok) {
      if (routePreviewLine) { routePreviewLine.remove(); routePreviewLine = null; }
    }
  });

  clearBtn.addEventListener('click', clearAll);

  return { addWaypoint };
}

function createWpMarker(lat, lng, idx) {
  return L.marker([lat, lng], {
    icon: L.divIcon({
      className: '',
      html: `<div style="
        width:22px;height:22px;
        background:#f59e0b;
        border:2px solid #fff;
        border-radius:50%;
        color:#0a0a1a;
        font-weight:700;
        font-size:11px;
        display:flex;align-items:center;justify-content:center;
      ">${idx}</div>`,
      iconAnchor: [11, 11],
    }),
    draggable: true,
  });
}
