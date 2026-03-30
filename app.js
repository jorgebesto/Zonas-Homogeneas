// ═══════════════════════════════════════════════════
//  LICENCIAS — Supabase
// ═══════════════════════════════════════════════════
const SUPA_URL = 'https://cknkscsglejyccwqkiys.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrbmtzY3NnbGVqeWNjd3FraXlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTk3ODQsImV4cCI6MjA5MDM5NTc4NH0.V3eYDnFJHhT4ALNKo66yCr1gwUtzsZtQ_ftToQDx48Y';

async function verificarLicencia() {
  const input = document.getElementById('lic-input');
  const btn   = document.getElementById('lic-btn');
  const err   = document.getElementById('lic-error');
  const ok    = document.getElementById('lic-ok');
  const codigo = input.value.trim().toUpperCase();

  if (!codigo) { mostrarErrorLic('Ingresa tu código de licencia.'); return; }

  btn.disabled = true;
  btn.textContent = 'Verificando...';
  err.classList.remove('show');
  ok.classList.remove('show');

  try {
    const res = await fetch(
      SUPA_URL + '/rest/v1/licencias?codigo=eq.' + encodeURIComponent(codigo) + '&select=*',
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    );

    if (!res.ok) throw new Error('Error de conexión (' + res.status + ')');
    const data = await res.json();

    if (!data.length) {
      mostrarErrorLic('Código no encontrado. Verifica e intenta de nuevo.');
      btn.disabled = false; btn.textContent = 'Verificar licencia'; return;
    }

    const lic = data[0];

    if (!lic.activo) {
      mostrarErrorLic('Esta licencia ha sido desactivada. Contacta al administrador.');
      btn.disabled = false; btn.textContent = 'Verificar licencia'; return;
    }

    const hoy   = new Date(); hoy.setHours(0,0,0,0);
    const vence = new Date(lic.fecha_vencimiento + 'T00:00:00');
    if (hoy > vence) {
      const fechaStr = vence.toLocaleDateString('es-CO', {day:'2-digit', month:'long', year:'numeric'});
      mostrarErrorLic('Licencia vencida el ' + fechaStr + '. Contacta al administrador.');
      btn.disabled = false; btn.textContent = 'Verificar licencia'; return;
    }

    // Calcular días restantes
    const diasRestantes = Math.ceil((vence - hoy) / 86400000);
    const fechaStr = vence.toLocaleDateString('es-CO', {day:'2-digit', month:'long', year:'numeric'});

    // Guardar sesión en localStorage
    localStorage.setItem('catastral_licencia', JSON.stringify({
      codigo: lic.codigo,
      nombre: lic.nombre || '',
      vence:  lic.fecha_vencimiento,
      validadoEn: new Date().toISOString()
    }));

    ok.textContent = '✓ Bienvenido' + (lic.nombre ? ', ' + lic.nombre : '') + ' — Licencia válida hasta ' + fechaStr + ' (' + diasRestantes + ' días)';
    ok.classList.add('show');

    setTimeout(() => lanzarAppConLicencia(), 1200);

  } catch(e) {
    mostrarErrorLic('Error de conexión. Verifica tu internet e intenta de nuevo.');
    btn.disabled = false; btn.textContent = 'Verificar licencia';
  }
}

function mostrarErrorLic(msg) {
  const err = document.getElementById('lic-error');
  err.textContent = msg; err.classList.add('show');
}

function lanzarAppConLicencia() {
  document.getElementById('license-screen').classList.add('hide');
  document.getElementById('upload-screen').style.display = 'flex';
  // Verificar si hay sesión guardada
  verificarSesionGuardada();
}

// Verificar sesión guardada al cargar
window.addEventListener('DOMContentLoaded', () => {
  // Botón verificar
  document.getElementById('lic-btn').addEventListener('click', verificarLicencia);

  // Enter para verificar
  document.getElementById('lic-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') verificarLicencia();
  });

  const sesionGuardada = localStorage.getItem('catastral_licencia');
  if (!sesionGuardada) return;

  try {
    const ses = JSON.parse(sesionGuardada);
    const hoy   = new Date(); hoy.setHours(0,0,0,0);
    const vence = new Date(ses.vence + 'T00:00:00');

    // Si la licencia ya venció localmente, pedir código de nuevo
    if (hoy > vence) { localStorage.removeItem('catastral_licencia'); return; }

    // Siempre re-verificar contra Supabase al abrir la app
    // Si no hay conexión, se deja pasar con la sesión guardada
    reVerificarLicencia(ses.codigo);
  } catch(e) {
    localStorage.removeItem('catastral_licencia');
  }
});

async function reVerificarLicencia(codigo) {
  try {
    const res = await fetch(
      SUPA_URL + '/rest/v1/licencias?codigo=eq.' + encodeURIComponent(codigo) + '&select=activo,fecha_vencimiento,nombre',
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    );
    const data = await res.json();

    // Licencia desactivada o no existe
    if (!data.length || !data[0].activo) {
      localStorage.removeItem('catastral_licencia');
      mostrarErrorLic('Tu licencia ha sido desactivada. Contacta al administrador.');
      return;
    }

    // Licencia vencida
    const hoy   = new Date(); hoy.setHours(0,0,0,0);
    const vence = new Date(data[0].fecha_vencimiento + 'T00:00:00');
    if (hoy > vence) {
      localStorage.removeItem('catastral_licencia');
      const fechaStr = vence.toLocaleDateString('es-CO', {day:'2-digit', month:'long', year:'numeric'});
      mostrarErrorLic('Tu licencia venció el ' + fechaStr + '. Contacta al administrador.');
      return;
    }

    // Todo OK — actualizar timestamp y entrar
    const ses = JSON.parse(localStorage.getItem('catastral_licencia'));
    ses.validadoEn = new Date().toISOString();
    localStorage.setItem('catastral_licencia', JSON.stringify(ses));
    lanzarAppConLicencia();

  } catch(e) {
    // Sin conexión — dejar pasar con sesión guardada
    lanzarAppConLicencia();
  }
}

// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
let features    = [];   // [{id, name, coords[[lat,lng]], centroid, props}]
let photos      = {};   // photos[id][corner] = [{name,dataUrl}, ...]
let finished    = {};   // finished[id] = bool
let currentId   = null;
let pendingCorner = null;
let pendingLatLng  = null;  // coordenadas elegidas en el mapa
let leafletLayers = {}; // id → L.polygon
let map         = null;
let panelOpen   = false;

const CORNERS = ['top-left','top-right','bottom-left','bottom-right'];
const CLABELS = {'top-left':'↖ Sup Izq','top-right':'↗ Sup Der','bottom-left':'↙ Inf Izq','bottom-right':'↘ Inf Der'};

// ═══════════════════════════════════════════════════
//  SHAPEFILE READER
// ═══════════════════════════════════════════════════
async function handleShapefile(event) {
  const files = Array.from(event.target.files);
  const shpFile  = files.find(f => f.name.toLowerCase().endsWith('.shp'));
  const dbfFile  = files.find(f => f.name.toLowerCase().endsWith('.dbf'));
  const prjFile  = files.find(f => f.name.toLowerCase().endsWith('.prj'));
  if (!shpFile) { alert('No se encontró el archivo .shp'); return; }

  showProc('Leyendo Shapefile...');

  try {
    const shpBuf = await readFileBuffer(shpFile);
    const dbfBuf = dbfFile ? await readFileBuffer(dbfFile) : null;
    let prjText  = null;
    if (prjFile) prjText = await prjFile.text();

    // Detect projection
    let fromProj = null;
    if (prjText) {
      fromProj = detectProjection(prjText);
    }

    const geojson = await shapefileToGeoJSON(shpBuf, dbfBuf);
    processGeoJSON(geojson, fromProj);
  } catch(e) {
    alert('Error leyendo shapefile: ' + e.message);
    resetProc();
  }
}

async function shapefileToGeoJSON(shpBuf, dbfBuf) {
  return new Promise((resolve, reject) => {
    if (typeof shapefile === 'undefined') { reject(new Error('shapefile.js no cargó')); return; }
    const geojson = { type:'FeatureCollection', features:[] };
    shapefile.open(shpBuf, dbfBuf)
      .then(source => source.read().then(function collect(result) {
        if (result.done) { resolve(geojson); return; }
        geojson.features.push(result.value);
        return source.read().then(collect);
      }))
      .catch(reject);
  });
}

// ═══════════════════════════════════════════════════
//  GEOPACKAGE READER (SQLite via sql.js)
// ═══════════════════════════════════════════════════
async function handleGeopackage(event) {
  const file = event.target.files[0];
  if (!file) return;
  showProc('Leyendo GeoPackage...');

  try {
    const buf = await readFileBuffer(file);
    const SQL = await initSqlJs({
      locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`
    });
    const db = new SQL.Database(new Uint8Array(buf));

    // Find geometry tables
    const tables = db.exec("SELECT table_name FROM gpkg_contents WHERE data_type='features'");
    if (!tables.length || !tables[0].values.length) throw new Error('No se encontraron capas de geometría');

    const tableName = tables[0].values[0][0];
    showProc(`Procesando capa: ${tableName}...`);

    // Get geometry column
    const geomCols = db.exec(`SELECT column_name FROM gpkg_geometry_columns WHERE table_name='${tableName}'`);
    const geomCol  = geomCols[0].values[0][0];

    // Get all rows
    const rows = db.exec(`SELECT * FROM "${tableName}"`);
    if (!rows.length) throw new Error('La tabla está vacía');

    const cols  = rows[0].columns;
    const vals  = rows[0].values;
    const geomIdx = cols.indexOf(geomCol);

    // Get projection
    const srsRows = db.exec(`SELECT s.definition FROM gpkg_spatial_ref_sys s
      JOIN gpkg_geometry_columns g ON s.srs_id = g.srs_id
      WHERE g.table_name='${tableName}'`);
    let fromProj = null;
    if (srsRows.length && srsRows[0].values.length) {
      fromProj = detectProjection(srsRows[0].values[0][0]);
    }

    const geojson = { type:'FeatureCollection', features:[] };
    for (const row of vals) {
      const geomBytes = row[geomIdx];
      if (!geomBytes) continue;
      const geom = parseGpkgGeometry(geomBytes);
      if (!geom) continue;
      const props = {};
      cols.forEach((c,i) => { if (i !== geomIdx) props[c] = row[i]; });
      geojson.features.push({ type:'Feature', geometry:geom, properties:props });
    }

    db.close();
    processGeoJSON(geojson, fromProj);
  } catch(e) {
    alert('Error leyendo GeoPackage: ' + e.message);
    resetProc();
  }
}

// Parse GeoPackage binary geometry (WKB with 8-byte header)
function parseGpkgGeometry(bytes) {
  try {
    const view = new DataView(bytes.buffer || bytes);
    // Skip GeoPackage header (at least 8 bytes)
    let offset = 0;
    const magic = view.getUint8(0); // 'G'
    if (magic !== 0x47) return null;
    const flags = view.getUint8(3);
    const envelopeType = (flags >> 1) & 0x07;
    const envBytes = [0,32,48,48,64][envelopeType] || 0;
    offset = 8 + envBytes;
    return parseWKB(view, offset).geom;
  } catch { return null; }
}

function parseWKB(view, offset) {
  const byteOrder = view.getUint8(offset); offset++;
  const le = byteOrder === 1;
  const geomType = le ? view.getUint32(offset,true) : view.getUint32(offset,false); offset+=4;

  const readDouble = () => { const v = le ? view.getFloat64(offset,true) : view.getFloat64(offset,false); offset+=8; return v; };
  const readUint32 = () => { const v = le ? view.getUint32(offset,true) : view.getUint32(offset,false); offset+=4; return v; };

  const readPoint   = () => [readDouble(), readDouble()];
  const readRing    = () => { const n=readUint32(); const pts=[]; for(let i=0;i<n;i++) pts.push(readPoint()); return pts; };

  let geom = null;
  const t = geomType & 0xFFFF;

  if (t===1) { // Point
    const c=readPoint(); geom={type:'Point',coordinates:c};
  } else if (t===3) { // Polygon
    const n=readUint32(); const rings=[]; for(let i=0;i<n;i++) rings.push(readRing());
    geom={type:'Polygon',coordinates:rings};
  } else if (t===6) { // MultiPolygon
    const n=readUint32(); const polys=[];
    for(let i=0;i<n;i++){ const r=parseWKB(view,offset); offset=r.offset; polys.push(r.geom.coordinates); }
    geom={type:'MultiPolygon',coordinates:polys};
  } else if (t===4) { // MultiPoint
    const n=readUint32(); const pts=[];
    for(let i=0;i<n;i++){ const r=parseWKB(view,offset); offset=r.offset; pts.push(r.geom.coordinates); }
    geom={type:'MultiPoint',coordinates:pts};
  }
  return {geom, offset};
}

// ═══════════════════════════════════════════════════
//  AUTOSAVE — IndexedDB (sin límite de tamaño)
// ═══════════════════════════════════════════════════
const DB_NAME    = 'catastral_autosave';
const DB_VERSION = 1;
const STORE_NAME = 'sesion';
let   db         = null;

function abrirDB() {
  return new Promise((res, rej) => {
    if (db) return res(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = e => { db = e.target.result; res(db); };
    req.onerror   = () => rej(req.error);
  });
}

async function guardarSesion() {
  if (!features.length) return;
  try {
    const d = await abrirDB();
    const sesion = {
      id:        'sesion_actual',
      ts:        new Date().toISOString(),
      features:  features,
      photos:    photos,
      finished:  finished
    };
    const tx = d.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(sesion);
  } catch(e) { console.warn('Autoguardado falló:', e); }
}

async function cargarSesionGuardada() {
  try {
    const d = await abrirDB();
    return new Promise((res) => {
      const tx  = d.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('sesion_actual');
      req.onsuccess = () => res(req.result || null);
      req.onerror   = () => res(null);
    });
  } catch(e) { return null; }
}

async function borrarSesionGuardada() {
  try {
    const d = await abrirDB();
    const tx = d.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete('sesion_actual');
  } catch(e) {}
}

async function verificarSesionGuardada() {
  const sesion = await cargarSesionGuardada();
  if (!sesion || !sesion.features || !sesion.features.length) return;

  const ts      = new Date(sesion.ts);
  const fecha   = ts.toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });
  const hora    = ts.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
  const nFotos  = Object.values(sesion.photos || {}).reduce((s,a) => s + (a||[]).length, 0);
  const nManz   = sesion.features.length;
  const nFin    = Object.values(sesion.finished || {}).filter(Boolean).length;

  const recuperar = confirm(
    '📂 Hay una sesión guardada\n\n' +
    '📅 ' + fecha + ' a las ' + hora + '\n' +
    '🗺️  ' + nManz + ' manzanas · ' + nFotos + ' fotos · ' + nFin + ' finalizadas\n\n' +
    '¿Deseas continuar donde lo dejaste?'
  );

  if (recuperar) {
    features  = sesion.features;
    photos    = sesion.photos   || {};
    finished  = sesion.finished || {};
    // Inicializar arrays faltantes
    features.forEach(f => {
      if (!photos[f.id])   photos[f.id]   = [];
      if (finished[f.id] === undefined) finished[f.id] = false;
    });
    launchApp();
    // Actualizar estilos de polígonos según estado guardado
    setTimeout(() => {
      features.forEach(f => updatePolygonStyle(f.id));
      updateProgress();
      // Restaurar marcadores de fotos
      features.forEach(f => syncPhotoMarkers(f.id));
    }, 500);
  } else {
    borrarSesionGuardada();
  }
}

// ═══════════════════════════════════════════════════
//  PROJECTION DETECTION & REPROJECTION
// ═══════════════════════════════════════════════════
function detectProjection(prjText) {
  if (!prjText) return null;
  const t = prjText.toUpperCase();
  // Already WGS84
  if (t.includes('GEOGCS') && t.includes('WGS_1984') && !t.includes('PROJCS')) return null;
  if (t.includes('EPSG:4326') || t.includes('"4326"')) return null;

  // Try to find EPSG code
  const epsgMatch = prjText.match(/AUTHORITY\["EPSG","(\d+)"\]/i);
  if (epsgMatch) {
    const code = epsgMatch[1];
    if (code === '4326') return null;
    return `EPSG:${code}`;
  }
  // UTM zones
  const utmMatch = t.match(/UTM_ZONE_(\d+)([NS])/);
  if (utmMatch) {
    const zone = utmMatch[1], hemi = utmMatch[2];
    const epsg = hemi === 'N' ? 32600 + parseInt(zone) : 32700 + parseInt(zone);
    return `EPSG:${epsg}`;
  }
  return null;
}

function reprojectCoords(coords, fromProj) {
  if (!fromProj || !proj4) return coords;
  try {
    return proj4(fromProj, 'EPSG:4326', coords);
  } catch { return coords; }
}

function reprojectGeom(geom, fromProj) {
  if (!fromProj) return geom;
  const reproj = (c) => reprojectCoords(c, fromProj);
  const reprojRing = ring => ring.map(reproj);

  if (geom.type === 'Polygon') {
    return { ...geom, coordinates: geom.coordinates.map(reprojRing) };
  } else if (geom.type === 'MultiPolygon') {
    return { ...geom, coordinates: geom.coordinates.map(poly => poly.map(reprojRing)) };
  }
  return geom;
}

// ═══════════════════════════════════════════════════
//  PROCESS GEOJSON → features array
// ═══════════════════════════════════════════════════
function processGeoJSON(geojson, fromProj) {
  showProc('Procesando geometrías...');
  features = [];

  const fts = geojson.features || [];
  if (!fts.length) { alert('El archivo no contiene geometrías'); resetProc(); return; }

  fts.forEach((f, i) => {
    const geom = reprojectGeom(f.geometry, fromProj);
    if (!geom) return;

    // Get polygon rings as [lat,lng] arrays for Leaflet
    let rings = [];
    if (geom.type === 'Polygon') {
      rings = [geom.coordinates[0].map(c => [c[1],c[0]])];
    } else if (geom.type === 'MultiPolygon') {
      rings = geom.coordinates.map(poly => poly[0].map(c => [c[1],c[0]]));
    } else return;

    // Compute centroid from first ring
    const allPts = rings.flat();
    const centroid = [
      allPts.reduce((s,p)=>s+p[0],0)/allPts.length,
      allPts.reduce((s,p)=>s+p[1],0)/allPts.length
    ];

    // Name from properties
    const props  = f.properties || {};
    const nameKey = Object.keys(props).find(k =>
      /nombre|name|manzana|id|codigo|cod|num/i.test(k)
    );
    const name = nameKey ? String(props[nameKey]) : String(i+1);

    features.push({ id: i, num: i+1, name, rings, centroid, props });
    photos[i]   = photos[i]   || [];
    finished[i] = finished[i] || false;
  });

  const n = features.length;
  document.getElementById('proc-ok').textContent = `✓ ${n} manzana${n!==1?'s':''} cargadas`;
  document.getElementById('prog-count').textContent = `0 / ${n}`;

  setTimeout(() => launchApp(), 700);
}


// ═══════════════════════════════════════════════════
//  FREE PHOTO MARKERS  (puntos libres en el mapa)
// ═══════════════════════════════════════════════════
// photoMarkers[featureId][photoIndex] = L.Marker
const photoMarkers = {};

function makePhotoIcon() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">'
    + '<circle cx="8" cy="8" r="6" fill="#ffffff" stroke="#0f1117" stroke-width="2.5"/>'
    + '<circle cx="8" cy="8" r="2.5" fill="#0f1117" opacity="0.7"/></svg>';
  return L.divIcon({ html: svg, className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
}

function syncPhotoMarkers(featureId) {
  if (!map) return;
  const pList = photos[featureId] || [];
  if (!photoMarkers[featureId]) photoMarkers[featureId] = {};

  // Remove markers for deleted photos
  Object.keys(photoMarkers[featureId]).forEach(idx => {
    if (!pList[idx]) {
      map.removeLayer(photoMarkers[featureId][idx]);
      delete photoMarkers[featureId][idx];
    }
  });

  // Add markers for new photos
  pList.forEach((ph, idx) => {
    if (!photoMarkers[featureId][idx]) {
      const marker = L.marker([ph.lat, ph.lng], {
        icon: makePhotoIcon(), interactive: true, zIndexOffset: 1000
      });
      marker.bindTooltip('Foto ' + (idx+1) + ' \u2014 ' + ph.lat.toFixed(5) + ', ' + ph.lng.toFixed(5),
        { direction: 'top', className: 'lf-tt' });
      marker.on('click', () => selectManzana(featureId));
      marker.addTo(map);
      photoMarkers[featureId][idx] = marker;
    }
  });
}

function removeAllMarkersForFeature(featureId) {
  if (!photoMarkers[featureId]) return;
  Object.values(photoMarkers[featureId]).forEach(m => map && map.removeLayer(m));
  photoMarkers[featureId] = {};
}

// ═══════════════════════════════════════════════════
//  APP LAUNCH
// ═══════════════════════════════════════════════════
function launchApp() {
  document.getElementById('upload-screen').style.display = 'none';
  document.getElementById('app-screen').classList.add('show');

  // Init Leaflet map
  map = L.map('map', { zoomControl:true, attributionControl:true });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    maxZoom:19
  }).addTo(map);

  // Draw polygons
  const bounds = [];
  features.forEach(f => {
    f.rings.forEach(ring => {
      const poly = L.polygon(ring, { className:'lf-empty', weight:1.5 });
      poly.on('click', () => selectManzana(f.id));
      poly.bindTooltip(`Manzana ${f.num}`, { permanent:false, direction:'top', className:'lf-tt' });
      poly.addTo(map);
      leafletLayers[f.id] = leafletLayers[f.id] || poly;
      bounds.push(...ring);
    });
  });

  if (bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding:[30,30] });
  updateProgress();
}

// ═══════════════════════════════════════════════════
//  GEOLOCATION
// ═══════════════════════════════════════════════════
let locationMarker   = null;
let locationCircle   = null;
let locationWatchId  = null;
let locationActive   = false;

function toggleLocation() {
  if (locationActive) {
    stopLocation();
  } else {
    startLocation();
  }
}

function startLocation() {
  if (!navigator.geolocation) {
    alert('Tu navegador no soporta geolocalización.');
    return;
  }
  const btn = document.getElementById('btn-locate');
  btn.classList.add('loading');
  btn.textContent = '⏳';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locationActive = true;
      btn.classList.remove('loading');
      btn.classList.add('active');
      btn.textContent = '🔵';

      updateLocationMarker(pos);

      // Centrar el mapa en la ubicación
      map.setView([pos.coords.latitude, pos.coords.longitude], Math.max(map.getZoom(), 17));

      // Seguimiento continuo
      locationWatchId = navigator.geolocation.watchPosition(
        updateLocationMarker,
        (err) => console.warn('GPS error:', err.message),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    },
    (err) => {
      btn.classList.remove('loading');
      btn.textContent = '📍';
      const msgs = {
        1: 'Permiso de ubicación denegado.\nActívalo en la configuración del navegador.',
        2: 'No se pudo obtener la ubicación. Verifica que el GPS esté activo.',
        3: 'Tiempo de espera agotado. Intenta de nuevo.'
      };
      alert('⚠️ ' + (msgs[err.code] || 'Error de geolocalización.'));
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function updateLocationMarker(pos) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const acc = pos.coords.accuracy; // metros

  // Crear icono del punto azul pulsante
  const dotHtml = '<div class="gps-dot"><div class="gps-dot-pulse"></div><div class="gps-dot-inner"></div></div>';
  const icon = L.divIcon({ html: dotHtml, className: '', iconSize: [16,16], iconAnchor: [8,8] });

  if (!locationMarker) {
    locationMarker = L.marker([lat, lng], { icon, zIndexOffset: 2000, interactive: false }).addTo(map);
    locationCircle  = L.circle([lat, lng], {
      radius: acc, color: '#4a9eff', fillColor: '#4a9eff',
      fillOpacity: 0.08, weight: 1, opacity: 0.4
    }).addTo(map);
  } else {
    locationMarker.setLatLng([lat, lng]);
    locationCircle.setLatLng([lat, lng]);
    locationCircle.setRadius(acc);
  }
}

function stopLocation() {
  locationActive = false;
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
  if (locationMarker) { map.removeLayer(locationMarker); locationMarker = null; }
  if (locationCircle) { map.removeLayer(locationCircle); locationCircle = null; }
  const btn = document.getElementById('btn-locate');
  btn.classList.remove('active', 'loading');
  btn.textContent = '📍';
}


function togglePanel() {
  panelOpen = !panelOpen;
  document.getElementById('bottom-panel').classList.toggle('open', panelOpen);
}

function openPanel() {
  if (!panelOpen) { panelOpen = true; document.getElementById('bottom-panel').classList.add('open'); }
}

function selectManzana(id) {
  currentId = id;
  if (!photos[id]) photos[id] = [];

  // Reset all polygon styles
  features.forEach(f => {
    const ly = leafletLayers[f.id];
    if (!ly) return;
    const cls = finished[f.id] ? 'lf-finished'
      : hasPhotos(f.id) ? 'lf-partial' : 'lf-empty';
    ly.setStyle({ className: cls, weight: 1.5 });
  });
  // Highlight selected
  const selLy = leafletLayers[id];
  if (selLy) selLy.setStyle({ className:'lf-selected', weight:2.5 });

  const f = features.find(x => x.id === id);
  document.getElementById('panel-title').innerHTML =
    `Manzana ${f.num} — <span style="color:var(--muted);font-size:0.6rem">${f.name}</span>`;

  document.getElementById('panel-empty').style.display = 'none';
  document.getElementById('panel-content').style.display = 'block';
  document.getElementById('mz-num').textContent = f.num;
  document.getElementById('mz-coords').textContent =
    `${f.centroid[0].toFixed(5)}, ${f.centroid[1].toFixed(5)}`;

  openPanel();
  renderPanelContent();
}

function renderPanelContent() {
  const id   = currentId;
  const pList = photos[id] || [];
  const isF  = !!finished[id];

  document.getElementById('mz-photo-count').textContent = pList.length;

  const badge = document.getElementById('mz-badge');
  badge.className = 'status-badge';
  if (isF)          { badge.textContent='✓ Finalizada'; badge.classList.add('finished'); }
  else if (pList.length) { badge.textContent=pList.length+' foto'+(pList.length>1?'s':''); badge.classList.add('partial'); }
  else              { badge.textContent='Sin fotos'; badge.classList.add('empty'); }

  document.getElementById('fin-banner').classList.toggle('show', isF);
  document.getElementById('btn-finish').style.display = isF ? 'none' : 'flex';
  const btnPin = document.getElementById('btn-pin');
  if (btnPin) btnPin.style.display = isF ? 'none' : 'flex';

  // Photo list
  const list = document.getElementById('photo-list');
  list.innerHTML = '';
  pList.forEach((ph, idx) => {
    const item = document.createElement('div'); item.className = 'photo-item';
    const img  = document.createElement('img'); img.src = ph.dataUrl;
    img.onclick = () => openLightboxByIndex(idx);
    const info = document.createElement('div'); info.className = 'photo-item-info';
    const coord = document.createElement('div'); coord.className = 'photo-item-coord';
    coord.textContent = ph.lat.toFixed(5) + ', ' + ph.lng.toFixed(5);
    const nm = document.createElement('div'); nm.className = 'photo-item-name';
    nm.textContent = ph.name;
    info.appendChild(coord); info.appendChild(nm);
    item.appendChild(img); item.appendChild(info);
    if (!isF) {
      const rm = document.createElement('button'); rm.className = 'photo-item-rm'; rm.textContent = '✕';
      rm.onclick = () => removePhoto(idx);
      item.appendChild(rm);
    }
    list.appendChild(item);
  });

  document.getElementById('btn-dl').style.display = pList.length > 0 ? 'flex' : 'none';
  updatePolygonStyle(id);
  updateProgress();
  syncPhotoMarkers(id);
  guardarSesion();
}

// ═══════════════════════════════════════════════════
//  PIN MODE  — el usuario toca el mapa para ubicar la foto
// ═══════════════════════════════════════════════════
let pinModeActive = false;
let pinMapClickHandler = null;

function enterPinMode() {
  if (!currentId && currentId !== 0) return;
  pinModeActive = true;
  document.getElementById('map-wrap').classList.add('pin-mode');
  document.getElementById('pin-banner').style.display = 'block';
  document.getElementById('pin-cancel').style.display = 'block';
  document.getElementById('btn-pin').classList.add('active');
  document.getElementById('btn-pin').textContent = '⏳ Toca el mapa...';
  // Cerrar panel para ver el mapa
  if (panelOpen) togglePanel();

  pinMapClickHandler = function(e) {
    if (!pinModeActive) return;
    pendingLatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
    cancelPinMode(true); // true = conservar pendingLatLng
    openPhotoSourceModal();
  };
  map.once('click', pinMapClickHandler);
}

function cancelPinMode(keepLatLng) {
  pinModeActive = false;
  document.getElementById('map-wrap').classList.remove('pin-mode');
  document.getElementById('pin-banner').style.display = 'none';
  document.getElementById('pin-cancel').style.display = 'none';
  const btn = document.getElementById('btn-pin');
  if (btn) { btn.classList.remove('active'); btn.textContent = '📍 Agregar foto'; }
  if (pinMapClickHandler) { map.off('click', pinMapClickHandler); pinMapClickHandler = null; }
  if (!keepLatLng) pendingLatLng = null;
}

// ═══════════════════════════════════════════════════
//  PHOTOS
// ═══════════════════════════════════════════════════
function openPhotoSourceModal() {
  const modal = document.getElementById('photo-source-modal');
  modal.style.display = 'flex';
  const inner = modal.querySelector('div');
  inner.style.transform = 'translateY(100%)';
  inner.style.transition = 'transform 0.25s ease';
  requestAnimationFrame(() => requestAnimationFrame(() => { inner.style.transform = 'translateY(0)'; }));
}

function choosePhotoSource(source) {
  closePhotoModal();
  const inputId = source === 'camera' ? 'photo-input-camera' : 'photo-input-gallery';
  document.getElementById(inputId).click();
}

function closePhotoModal() {
  const modal = document.getElementById('photo-source-modal');
  const inner = modal.querySelector('div');
  inner.style.transform = 'translateY(100%)';
  setTimeout(() => {
    modal.style.display = 'none';
    inner.style.transform = '';
    // Solo limpiar si el usuario canceló (no eligió ninguna fuente)
    // pendingLatLng se limpia en handlePhotoFile después de usarse
  }, 220);
}

// ═══════════════════════════════════════════════════
//  MEMORY MANAGEMENT
// ═══════════════════════════════════════════════════
const MEM_LIMIT_MB  = 400;  // límite total recomendado
const MEM_WARN_PCT  = 0.70; // 70% → advertencia amarilla
const MEM_BLOCK_PCT = 0.90; // 90% → bloqueo rojo

function calcMemoryMB() {
  let bytes = 0;
  Object.values(photos).forEach(pList => {
    (pList||[]).forEach(ph => { bytes += ph.dataUrl.length * 0.75; });
  });
  return bytes / (1024 * 1024);
}

function updateMemoryUI() {
  const mb     = calcMemoryMB();
  const pct    = Math.min(mb / MEM_LIMIT_MB, 1);
  const fill   = document.getElementById('mem-fill');
  const count  = document.getElementById('mem-count');
  const wrap   = document.getElementById('mem-wrap');
  if (!fill) return;

  wrap.style.display = 'flex';
  fill.style.width   = (pct * 100).toFixed(1) + '%';
  count.textContent  = mb.toFixed(1) + ' MB / ' + MEM_LIMIT_MB + ' MB';

  fill.className  = 'mem-fill';
  count.className = 'mem-count';
  if (pct >= MEM_BLOCK_PCT) {
    fill.classList.add('danger');
    count.classList.add('danger');
  } else if (pct >= MEM_WARN_PCT) {
    fill.classList.add('warn');
    count.classList.add('warn');
  }
}

// Comprimir imagen a máx 1200px, calidad 72%
function compressImage(dataUrl) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width  = Math.round(img.width  * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}

function handlePhotoFile(event) {
  const file = event.target.files[0];
  if (!file || !pendingLatLng) { event.target.value=''; return; }
  event.target.value = '';
  const ll = { ...pendingLatLng };
  pendingLatLng = null;

  // Check memory
  const mb = calcMemoryMB();
  if (mb / MEM_LIMIT_MB >= MEM_BLOCK_PCT) {
    alert('⚠️ Memoria casi llena (' + mb.toFixed(1) + ' MB)\nGenera el reporte HTML antes de continuar.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const id = currentId;
    if (!photos[id]) photos[id] = [];
    const compressed = await compressImage(e.target.result);
    photos[id].push({ lat: ll.lat, lng: ll.lng, dataUrl: compressed, name: file.name });

    // Reopen panel and render
    if (!panelOpen) togglePanel();
    renderPanelContent();
    updateMemoryUI();

    // Memory warning
    const newMb  = calcMemoryMB();
    const newPct = newMb / MEM_LIMIT_MB;
    if (newPct >= MEM_WARN_PCT && newPct < MEM_BLOCK_PCT) {
      const totalFotos = Object.values(photos).reduce((s,a) => s + a.length, 0);
      const threshold = Math.floor(newPct * 10);
      if (threshold !== handlePhotoFile._lastWarn) {
        handlePhotoFile._lastWarn = threshold;
        setTimeout(() => alert(
          '⚠️ Memoria al ' + Math.round(newPct*100) + '%\n' +
          totalFotos + ' fotos · ' + newMb.toFixed(1) + ' MB / ' + MEM_LIMIT_MB + ' MB\n\n' +
          'Exporta el reporte pronto para evitar pérdida de datos.'
        ), 300);
      }
    }
  };
  reader.readAsDataURL(file);
}
handlePhotoFile._lastWarn = -1;

function removePhoto(idx) {
  const p = photos[currentId];
  if (p && p[idx] !== undefined) {
    p.splice(idx, 1);
    // Remove marker for this index and re-sync all
    removeAllMarkersForFeature(currentId);
  }
  renderPanelContent();
  updateMemoryUI();
}
function clearManzana() {
  if (!currentId && currentId !== 0) return;
  const pList = photos[currentId] || [];
  if (pList.length > 0 && !confirm('¿Eliminar todas las fotos de Manzana ' + (features.find(f=>f.id===currentId)?.num) + '?')) return;
  photos[currentId] = [];
  finished[currentId] = false;
  removeAllMarkersForFeature(currentId);
  renderPanelContent();
  updateMemoryUI();
}
function finishManzana()   { finished[currentId]=true;  renderPanelContent(); }
function unfinishManzana() { finished[currentId]=false; renderPanelContent(); }

function hasPhotos(id) { return (photos[id]||[]).length > 0; }

function updatePolygonStyle(id) {
  const ly=leafletLayers[id]; if(!ly) return;
  const cls = id===currentId ? 'lf-selected'
    : finished[id] ? 'lf-finished'
    : hasPhotos(id) ? 'lf-partial' : 'lf-empty';
  ly.setStyle({ className:cls, weight: id===currentId?2.5:1.5 });
}

function updateProgress() {
  const total = features.length;
  const fin   = features.filter(f => finished[f.id]).length;
  document.getElementById('prog-fill').style.width  = total ? (fin/total*100)+'%' : '0%';
  document.getElementById('prog-count').textContent = fin + ' / ' + total;
  const hasAny = features.some(f => hasPhotos(f.id));
  document.getElementById('btn-html').disabled = !hasAny;
  document.getElementById('btn-kmz').disabled  = !hasAny;
}

function downloadPhotos() {
  const p=photos[currentId]||{};
  const f=features.find(x=>x.id===currentId);
  Object.entries(p).forEach(([corner,arr])=>{
    arr.forEach((ph,idx)=>{
      const a=document.createElement('a');
      a.href=ph.dataUrl;
      a.download=`Manzana_${f.num}_${corner}_foto${idx+1}_${ph.name}`;
      a.click();
    });
  });
}

// ═══════════════════════════════════════════════════
//  KMZ EXPORT
// ═══════════════════════════════════════════════════
// Resize + convert to JPEG data URI (keeps KMZ compact, avoids Google Earth webp issues)
function resizeImage(dataUrl, maxPx) {
  maxPx = maxPx || 600;
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      var w = Math.round(img.width  * scale);
      var h = Math.round(img.height * scale);
      var c = document.createElement('canvas');
      c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      resolve(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = function() { resolve(dataUrl); };
    img.src = dataUrl;
  });
}

async function exportKMZ() {
  const btn = document.getElementById('btn-kmz');
  btn.textContent='\u23f3 Generando...'; btn.disabled=true;
  try {
    const zip = new JSZip();
    let placemarks = '';
    for (const f of features) {
      const pList = photos[f.id] || [];
      if (!pList.length) continue;
      const isF = !!finished[f.id];
      let inner = '<b>Manzana ' + f.num + '</b><br>';
      if (f.name !== String(f.num)) inner += 'Nombre: ' + f.name + '<br>';
      if (isF) inner += '<i style="color:#7c5fe6">&#10003; Finalizada</i><br>';
      inner += '<hr style="border:0;border-top:1px solid #ccc;margin:6px 0">';
      for (let idx=0; idx<pList.length; idx++) {
        const ph = pList[idx];
        const resized = await resizeImage(ph.dataUrl, 600);
        inner += '<div style="margin-bottom:10px">';
        inner += '<div style="font-size:11px;color:#666;margin-bottom:4px">Foto ' + (idx+1) + ' · ' + ph.lat.toFixed(5) + ', ' + ph.lng.toFixed(5) + '</div>';
        inner += '<img src="' + resized + '" width="300" style="max-width:100%;border-radius:4px">';
        inner += '</div>';
      }
      const descHtml = '<![CDATA[' + inner + ']]>';
      const coordStr = f.rings[0].map(([lat,lng]) => lng+','+lat+',0').join(' ');
      const color = isF ? 'cc6e5f9f' : hasPhotos(f.id) ? 'cc38b8e0' : 'cc3a5ce0';
      placemarks += '\n  <Placemark>'
        + '\n    <n>Manzana ' + f.num + '</n>'
        + '\n    <description>' + descHtml + '</description>'
        + '\n    <Style>'
        + '\n      <PolyStyle><color>' + color + '</color><fill>1</fill><outline>1</outline></PolyStyle>'
        + '\n      <LineStyle><color>ffffffff</color><width>1.5</width></LineStyle>'
        + '\n    </Style>'
        + '\n    <Polygon>'
        + '\n      <extrude>0</extrude><altitudeMode>clampToGround</altitudeMode>'
        + '\n      <outerBoundaryIs><LinearRing><coordinates>' + coordStr + '</coordinates></LinearRing></outerBoundaryIs>'
        + '\n    </Polygon>'
        + '\n  </Placemark>';
    }
    const kml = '<?xml version="1.0" encoding="UTF-8"?>'
      + '\n<kml xmlns="http://www.opengis.net/kml/2.2">'
      + '\n<Document>'
      + '\n  <n>Registro Catastral</n>'
      + '\n  <description>Manzanas con registro fotografico georreferenciado</description>'
      + placemarks
      + '\n</Document>\n</kml>';
    zip.file('doc.kml', kml);
    const content = await zip.generateAsync({type:'blob'});
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href=url; a.download='registro_catastral.kmz'; a.click();
    URL.revokeObjectURL(url);
    btn.textContent='\u2b07 KMZ (pol\u00edgonos)'; btn.disabled=false;
  } catch(e) {
    alert('Error generando KMZ: ' + e.message);
    btn.textContent='\u2b07 Exportar KMZ'; btn.disabled=false;
  }
}
// ═══════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════
function readFileBuffer(file) {
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=e=>res(e.target.result);
    r.onerror=rej;
    r.readAsArrayBuffer(file);
  });
}

function showProc(msg) {
  document.querySelector('.upload-grid').style.display='none';
  document.querySelector('.shp-multi-note').style.display='none';
  const ps=document.getElementById('proc-status');
  ps.classList.add('show');
  document.getElementById('proc-label').textContent=msg;
  document.getElementById('proc-ok').textContent='';
}
function resetProc() {
  document.querySelector('.upload-grid').style.display='grid';
  document.querySelector('.shp-multi-note').style.display='block';
  document.getElementById('proc-status').classList.remove('show');
}
function resetApp() {
  if(!confirm('¿Volver al inicio? Se perderán los datos.')) return;
  borrarSesionGuardada();
  location.reload();
}

function openLightboxByIndex(idx) {
  const pList = photos[currentId] || [];
  const ph = pList[idx]; if (!ph) return;
  document.getElementById('lb-img').src = ph.dataUrl;
  const f = features.find(x => x.id === currentId);
  document.getElementById('lb-caption').textContent =
    'Manzana ' + f.num + ' — Foto ' + (idx+1) + ' · ' + ph.lat.toFixed(5) + ', ' + ph.lng.toFixed(5);
  document.getElementById('lightbox').classList.add('show');
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('show'); }
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeLightbox(); });

// ═══════════════════════════════════════════════════
//  EXPORT HTML REPORT  (fotos embebidas, 100% offline)
// ═══════════════════════════════════════════════════
async function exportHTML() {
  const btn = document.getElementById('btn-html');
  btn.textContent = '⏳ Generando...'; btn.disabled = true;
  try {
    const fecha = new Date().toLocaleDateString('es-CO', {day:'2-digit',month:'long',year:'numeric'});
    const totalFin   = features.filter(f => finished[f.id]).length;
    const totalFotos = Object.values(photos).reduce((s, a) => s + (a||[]).length, 0);

    const toThumb = (dataUrl) => new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 500 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width*scale); c.height = Math.round(img.height*scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.80));
      };
      img.onerror = () => res(dataUrl);
      img.src = dataUrl;
    });

    let cardsHtml = '';
    for (const f of features) {
      const pList = photos[f.id] || [];
      if (!pList.length) continue;
      const isF  = !!finished[f.id];
      const total = pList.length;
      const badge = isF
        ? '<span style="background:#2d1f5e;color:#b09ef5;border:1px solid #7c5fe6;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700">✓ FINALIZADA</span>'
        : '<span style="background:#1e2a1a;color:#60c080;border:1px solid #3ab87a;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700">' + total + ' FOTO' + (total>1?'S':'') + '</span>';

      let photosHtml = '';
      for (let idx = 0; idx < pList.length; idx++) {
        const ph = pList[idx];
        const thumb = await toThumb(ph.dataUrl);
        const coordLabel = ph.lat.toFixed(5) + ', ' + ph.lng.toFixed(5);
        photosHtml += '<div style="break-inside:avoid;display:inline-block;width:calc(50% - 8px);margin:4px;vertical-align:top">'
          + '<img src="' + thumb + '" data-full="' + thumb + '" data-label="Manzana ' + f.num + ' — Foto ' + (idx+1) + '"'
          + ' onclick="openReportLightbox(this)"'
          + ' style="width:100%;border-radius:6px;display:block;border:1px solid #2a2f44;cursor:zoom-in" alt="Foto">'
          + '<div style="font-size:10px;color:#7a7f94;text-align:center;margin-top:4px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em">Foto ' + (idx+1) + ' · ' + coordLabel + '</div>'
          + '</div>';
      }

      const coordStr = f.centroid ? f.centroid[0].toFixed(5) + ', ' + f.centroid[1].toFixed(5) : '';
      cardsHtml += '<div style="background:#181c27;border:1px solid #2a2f44;border-radius:10px;padding:16px;margin-bottom:16px;page-break-inside:avoid">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #2a2f44">'
        + '<span style="font-size:18px;font-weight:800;letter-spacing:-0.02em">Manzana <span style="color:#e05c3a">' + f.num + '</span></span>'
        + (f.name !== String(f.num) ? '<span style="font-size:11px;color:#7a7f94;font-family:monospace">' + f.name + '</span>' : '')
        + badge
        + (coordStr ? '<span style="margin-left:auto;font-size:10px;color:#7a7f94;font-family:monospace">' + coordStr + '</span>' : '')
        + '</div>'
        + '<div style="font-size:0">' + photosHtml + '</div>'
        + '</div>';
    }

    if (!cardsHtml) { alert('No hay manzanas con fotos para exportar.'); btn.textContent='⬇ Reporte HTML'; btn.disabled=false; return; }

    // Map data
    const featuresJson = JSON.stringify(features.map(f=>({
      num: f.num, name: f.name, rings: f.rings,
      hasPhotos: hasPhotos(f.id),
      finished: !!finished[f.id]
    })));

    // Markers for report map: one per photo with exact coords
    const markersJson = JSON.stringify(
      features.flatMap(f =>
        (photos[f.id]||[]).map((ph, idx) => ({
          num: f.num, idx: idx+1,
          lat: ph.lat, lng: ph.lng
        }))
      )
    );

    const cntFotos = features.filter(f => hasPhotos(f.id)).length;

    const mapScript = [
      '(function(){',
      '  var map = L.map("report-map");',
      '  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{',
      '    attribution:"\u00a9 OpenStreetMap \u00a9 CARTO",maxZoom:19',
      '  }).addTo(map);',
      '  var features = ' + featuresJson + ';',
      '  var markers  = ' + markersJson + ';',
      '  var allLatLngs = [];',
      '  features.forEach(function(f){',
      '    f.rings.forEach(function(ring){',
      '      var color = f.finished ? "#7c5fe6" : f.hasPhotos ? "#e0b83a" : "#e05c3a";',
      '      L.polygon(ring,{color:color,weight:1.5,fillColor:color,fillOpacity:0.3})',
      '       .bindTooltip("Manzana "+f.num,{direction:"top"}).addTo(map);',
      '      allLatLngs = allLatLngs.concat(ring);',
      '    });',
      '  });',
      '  var svg = \'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">\'',
      '    + \'<circle cx="8" cy="8" r="6" fill="#ffffff" stroke="#0f1117" stroke-width="2.5"/>\'',
      '    + \'<circle cx="8" cy="8" r="2.5" fill="#0f1117" opacity="0.7"/></svg>\';',
      '  var icon = L.divIcon({html:svg,className:"",iconSize:[16,16],iconAnchor:[8,8]});',
      '  markers.forEach(function(m){',
      '    L.marker([m.lat,m.lng],{icon:icon})',
      '     .bindTooltip("Manzana "+m.num+" \u2014 Foto "+m.idx,{direction:"top"}).addTo(map);',
      '  });',
      '  if(allLatLngs.length) map.fitBounds(L.latLngBounds(allLatLngs),{padding:[20,20]});',
      '})();',
      '',
      'function openReportLightbox(img){',
      '  var lb=document.getElementById("r-lightbox");',
      '  document.getElementById("r-lb-img").src=img.dataset.full||img.src;',
      '  document.getElementById("r-lb-cap").textContent=img.dataset.label||"";',
      '  lb.style.display="flex"; document.body.style.overflow="hidden";',
      '}',
      'function closeReportLightbox(){',
      '  document.getElementById("r-lightbox").style.display="none";',
      '  document.body.style.overflow="";',
      '}',
      'document.addEventListener("keydown",function(e){if(e.key==="Escape")closeReportLightbox();});'
    ].join('\n');

    const parts = [];
    parts.push('<!DOCTYPE html>');
    parts.push('<html lang="es"><head>');
    parts.push('<meta charset="UTF-8">');
    parts.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
    parts.push('<title>Reporte Catastral \u2014 ' + fecha + '</title>');
    parts.push('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">');
    parts.push('<scr'+'ipt src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><'+'/script>');
    parts.push('<style>');
    parts.push('*{box-sizing:border-box;margin:0;padding:0}');
    parts.push('body{background:#0f1117;color:#e8e4dc;font-family:"Segoe UI",system-ui,sans-serif;padding:24px}');
    parts.push('h1{font-size:clamp(1.4rem,3vw,2rem);font-weight:800;letter-spacing:-0.02em;margin-bottom:4px}');
    parts.push('h1 span{color:#e05c3a}');
    parts.push('.meta{font-family:monospace;font-size:11px;color:#7a7f94;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:20px}');
    parts.push('.stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}');
    parts.push('.stat{background:#181c27;border:1px solid #2a2f44;border-radius:8px;padding:10px 16px;text-align:center}');
    parts.push('.stat-val{font-size:1.6rem;font-weight:800;color:#e05c3a;line-height:1}');
    parts.push('.stat-lbl{font-family:monospace;font-size:10px;color:#7a7f94;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px}');
    parts.push('#report-map{width:100%;height:320px;border-radius:10px;border:1px solid #2a2f44;margin-bottom:24px}');
    parts.push('.section-title{font-family:monospace;font-size:11px;color:#7a7f94;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #2a2f44}');
    parts.push('@media print{body{background:#fff;color:#111}.stat{background:#f5f5f5;border-color:#ddd}#report-map{display:none}}');
    parts.push('#r-lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9000;align-items:center;justify-content:center;flex-direction:column;gap:12px;padding:16px;}');
    parts.push('#r-lb-img{max-width:92vw;max-height:84vh;border-radius:10px;border:1px solid #2a2f44;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,0.8);}');
    parts.push('#r-lb-cap{font-family:monospace;font-size:11px;color:#7a7f94;text-transform:uppercase;letter-spacing:0.1em;text-align:center;}');
    parts.push('#r-lb-close{position:fixed;top:16px;right:16px;width:38px;height:38px;border-radius:50%;background:#1e2333;border:1px solid #2a2f44;color:#e8e4dc;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;}');
    parts.push('#r-lb-close:hover{background:#2a2f44;}');
    parts.push('</style></head><body>');
    parts.push('<div id="r-lightbox" onclick="if(event.target===this)closeReportLightbox()">');
    parts.push('<button id="r-lb-close" onclick="closeReportLightbox()">&#x2715;</button>');
    parts.push('<img id="r-lb-img" src="" alt=""><p id="r-lb-cap"></p></div>');
    parts.push('<h1>Registro <span>Catastral</span></h1>');
    parts.push('<p class="meta">Generado el ' + fecha + ' &nbsp;&middot;&nbsp; ' + features.length + ' manzanas totales</p>');
    parts.push('<div class="stats">');
    parts.push('<div class="stat"><div class="stat-val">' + features.length + '</div><div class="stat-lbl">Manzanas totales</div></div>');
    parts.push('<div class="stat"><div class="stat-val">' + totalFin + '</div><div class="stat-lbl">Finalizadas</div></div>');
    parts.push('<div class="stat"><div class="stat-val">' + cntFotos + '</div><div class="stat-lbl">Con fotos</div></div>');
    parts.push('<div class="stat"><div class="stat-val">' + totalFotos + '</div><div class="stat-lbl">Fotos totales</div></div>');
    parts.push('</div>');
    parts.push('<div id="report-map"></div>');
    parts.push('<p class="section-title">Registro fotogr\u00e1fico por manzana</p>');
    parts.push(cardsHtml);
    parts.push('<scr'+'ipt>' + mapScript + '<'+'/script>');
    parts.push('</body></html>');
    const html = parts.join('\n');

    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download='reporte_catastral.html'; a.click();
    URL.revokeObjectURL(url);
    btn.textContent = '⬇ Reporte HTML'; btn.disabled = false;

    // Ofrecer limpiar la sesión guardada
    setTimeout(() => {
      if (confirm('✅ Reporte generado.\n\n¿Deseas limpiar el progreso guardado para empezar una nueva sesión?')) {
        borrarSesionGuardada();
      }
    }, 500);
  } catch(e) {
    alert('Error generando reporte: ' + e.message);
    btn.textContent = '⬇ Reporte HTML'; btn.disabled = false;
  }
}
