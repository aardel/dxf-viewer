// Lightweight Map Line popup
function openMapLinePopup(summary, exactKey) {
    const modalId = 'mapLinePopupModal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();
    const fieldsHtml = summary.fields.map(f => `<div class="kv"><span class="k">${f.label}</span><span class="v">${f.value}</span></div>`).join('');
    const entry = exactRulesCache.get(`${summary.format}|${exactKey}`);
    const currentLtName = entry?.lineTypeId ? getLineTypeName(String(entry.lineTypeId)) : '';
    const currentEnabled = entry ? (entry.enabled !== false) : null;
    const initialColor = summary.displayColor || '#66d9ef';
    const html = `
      <div id="${modalId}" class="modal" style="display:flex;">
        <div class="modal-content" style="max-width:460px;">
          <div class="modal-header"><h3>Map Line (${summary.format.toUpperCase()})</h3><button class="modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button></div>
          <div class="modal-body">
            <div class="summary">${fieldsHtml}</div>
            <div id="currentMappingInfo" style="margin:8px 0; font-size: 0.9rem; opacity: 0.85;">
              ${currentLtName ? `Current: <strong>${currentLtName}</strong>${currentEnabled===false ? ' (disabled)' : ''}` : 'Not mapped'}
            </div>
            <div class="form-group">
              <label for="mapColorPicker">Display Color (optional)</label>
              <input type="color" id="mapColorPicker" value="${initialColor}">
            </div>
            <div class="form-group">
              <label for="mapLineTypeSelect">Local Line Type</label>
              <select id="mapLineTypeSelect" class="form-select"><option>Loading...</option></select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
            <button class="btn btn-primary" id="mapLineSaveBtn">Save</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    // Load line types
    (async () => {
        try {
            const select = document.getElementById('mapLineTypeSelect');
            const list = await window.electronAPI.getInternalLineTypes();
            select.innerHTML = '<option value="">Choose a line type...</option>' + list.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
            if (entry?.lineTypeId) {
                select.value = String(entry.lineTypeId);
            }
        } catch {}
    })();
    document.getElementById('mapLineSaveBtn').addEventListener('click', async () => {
        const select = document.getElementById('mapLineTypeSelect');
        const lt = select?.value || '';
        if (!lt) { alert('Please select a line type'); return; }
        try {
            // Persist to global filter (exact key)
            const selColor = document.getElementById('mapColorPicker')?.value || undefined;
            await window.electronAPI.addRuleToGlobalImportFilter({ format: summary.format, key: exactKey, lineTypeId: lt, enabled: true, color: selColor });
            // Mirror to active profile if applicable
            if (window.electronAPI?.syncRuleToActiveProfile) {
                await window.electronAPI.syncRuleToActiveProfile({ format: summary.format, key: exactKey, lineTypeId: lt });
            }
            showStatus('Mapping saved', 'success');
            document.getElementById(modalId)?.remove();
            // Refresh rules cache and current table to show mapping and glow
            await refreshRulesCache();
            if (currentFileFormat === 'dxf' && window.currentLayerData) {
                populateLayerTable(window.currentLayerData);
            } else {
                updateImportPanelForUnified();
            }
        } catch (e) {
            showStatus('Failed to save mapping', 'error');
        }
    });
}
// Toggle visibility for entities matching both layer and color
function toggleLayerColorVisibility(layerName, color, isVisible) {
    if (!viewer || !viewer.scene) return;
    let colorInt = (typeof color === 'string' && color.startsWith('#')) ? parseInt(color.slice(1), 16) : color;
    let toggledCount = 0;
    
    viewer.scene.traverse((object) => {
        // Try multiple ways to match layer and color
        let foundMatch = false;
        
        // Method 1: Check userData (preferred method)
        if (object.userData) {
            let objLayer = object.userData.layer;
            let objColor = object.userData.color;
            if (typeof objColor === 'string' && objColor.startsWith('#')) {
                objColor = parseInt(objColor.slice(1), 16);
            }
            if (objLayer === layerName && typeof objColor === 'number' && objColor === colorInt) {
                foundMatch = true;
            }
        }
        
        // Method 2: Check material color (for Three.js materials)
        if (!foundMatch && object.material && object.material.color) {
            const materialColor = object.material.color.getHex();
            if (materialColor === colorInt) {
                // Additional check: try to verify layer from userData if available
                if (!object.userData || !object.userData.layer || object.userData.layer === layerName) {
                    foundMatch = true;
                }
            }
        }
        
        // Method 3: Check material uniforms (for shader materials)
        if (!foundMatch && object.material && object.material.uniforms && object.material.uniforms.color) {
            const uniformColor = object.material.uniforms.color.value;
            if (uniformColor && uniformColor.isColor) {
                const uniformHex = uniformColor.getHex();
                if (uniformHex === colorInt) {
                    // Additional check: try to verify layer from userData if available
                    if (!object.userData || !object.userData.layer || object.userData.layer === layerName) {
                        foundMatch = true;
                    }
                }
            }
        }
        
        if (foundMatch) {
            object.visible = isVisible;
            toggledCount++;
        }
    });
    
    if (viewer.Render) viewer.Render();
    showStatus(`Layer "${layerName}" color #${colorInt.toString(16).padStart(6, '0').toUpperCase()} ${isVisible ? 'shown' : 'hidden'} (${toggledCount} objects)`);
}
// Extract unit information from DXF header
function getDXFUnits() {
    const header = viewer?.parsedDxf?.header || {};
    const insunits = header.$INSUNITS || header.INSUNITS || 4; // Default to mm
    // $MEASUREMENT - Measurement system (0=English, 1=Metric)
    const measurement = header.$MEASUREMENT || header.MEASUREMENT;
    // $LUNITS - Linear units format (1=Scientific, 2=Decimal, 3=Engineering, 4=Architectural, 5=Fractional)
    const lunits = header.$LUNITS || header.LUNITS;
    const unitMap = {
        0: { unit: 'units', name: 'Unitless', scaleFactor: 1 },
        1: { unit: 'in', name: 'Inches', scaleFactor: 25.4 },
        2: { unit: 'ft', name: 'Feet', scaleFactor: 304.8 },
        3: { unit: 'mi', name: 'Miles', scaleFactor: 1609344 },
        4: { unit: 'mm', name: 'Millimeters', scaleFactor: 1 },
        5: { unit: 'cm', name: 'Centimeters', scaleFactor: 0.1 },
        6: { unit: 'm', name: 'Meters', scaleFactor: 0.001 },
        7: { unit: 'km', name: 'Kilometers', scaleFactor: 0.000001 },
        8: { unit: 'µin', name: 'Microinches', scaleFactor: 0.0254 },
        9: { unit: 'mil', name: 'Mils', scaleFactor: 0.0254 },
        10: { unit: 'yd', name: 'Yards', scaleFactor: 914.4 },
        11: { unit: 'Å', name: 'Angstroms', scaleFactor: 0.0000001 },
        12: { unit: 'nm', name: 'Nanometers', scaleFactor: 0.000001 },
        13: { unit: 'µm', name: 'Microns', scaleFactor: 0.001 },
        14: { unit: 'dm', name: 'Decimeters', scaleFactor: 0.01 },
        15: { unit: 'dam', name: 'Decameters', scaleFactor: 0.0001 },
        16: { unit: 'hm', name: 'Hectometers', scaleFactor: 0.00001 },
        17: { unit: 'Gm', name: 'Gigameters', scaleFactor: 0.000000000001 },
        18: { unit: 'au', name: 'Astronomical Units', scaleFactor: 6.68459e-15 },
        19: { unit: 'ly', name: 'Light Years', scaleFactor: 1.057e-19 },
        20: { unit: 'pc', name: 'Parsecs', scaleFactor: 3.24078e-20 }
    };
    const unitInfo = unitMap[insunits] || unitMap[4]; // Default to millimeters
    let measurementSystem = 'Unknown';
    if (measurement === 0) {
        measurementSystem = 'Imperial';
    } else if (measurement === 1) {
        measurementSystem = 'Metric';
    }
    return {
        ...unitInfo,
        measurementSystem,
        insunits,
        lunits
    };
}
import * as THREE from '../../node_modules/three/build/three.module.js';
import { DxfViewer } from './src/index.js';
import { PathOptimizer } from './src/PathOptimizer.js';
import { DinGenerator } from './src/DinGenerator.js';
import { AdvancedVisualization } from './src/advanced-visualization.js';

// Global variables
let viewer = null;
let currentFilename = null;
let currentFilePath = null;
const statusEl = document.getElementById('status');
const loadingEl = document.getElementById('loading');
const dropZone = document.getElementById('dropZone');
const viewerEl = document.getElementById('viewer');
const fileInfoEl = document.getElementById('fileInfo');
const fileNameEl = document.getElementById('fileName');
const fileSizeEl = document.getElementById('fileSize');
const headerEl = document.querySelector('.header');
const sidePanelEl = document.getElementById('sidePanel');
const togglePanelBtn = document.getElementById('togglePanelBtn');
// Header shortcuts
document.getElementById('openGlobalFilterShortcut')?.addEventListener('click', ()=>{
    if (window.electronAPI?.openGlobalImportFilterManager) {
        window.electronAPI.openGlobalImportFilterManager();
    }
});

const groupByPtToggleEl = document.getElementById('groupByPtToggle');
groupByPtToggleEl?.addEventListener('change', ()=>{
    localStorage.setItem('groupByPt', groupByPtToggleEl.checked ? '1' : '0');
    updateImportPanelForUnified();
});
if (groupByPtToggleEl) groupByPtToggleEl.checked = localStorage.getItem('groupByPt') === '1';
// Settings: only display unit is user selectable (mm/in)
// Rules cache for exact-key mapping (DXF/DDS/CFF2)
let exactRulesCache = new Map(); // key: `${format}|${key}` -> { lineTypeId, enabled }
// Internal line types cache for display color resolution
let internalLineTypesCache = [];
let unifiedUnitCode = 'unknown';

async function refreshRulesCache() {
    try {
        const res = await window.electronAPI.loadGlobalImportFilter();
        exactRulesCache = new Map();
        if (res?.success && Array.isArray(res.data?.rules)) {
            for (const r of res.data.rules) {
                if (r && r.format && r.key && r.lineTypeId) {
                    exactRulesCache.set(`${r.format}|${r.key}`, { lineTypeId: r.lineTypeId, enabled: r.enabled !== false, color: r.color });
                }
            }
        }
    } catch {}
}

function resolveMappedLineTypeName(format, key) {
    const entry = exactRulesCache.get(`${format}|${key}`);
    if (entry && entry.enabled && entry.lineTypeId) return getLineTypeName(String(entry.lineTypeId));
    return '';
}

async function refreshLineTypesCache() {
    try {
        const list = await window.electronAPI.getInternalLineTypes();
        internalLineTypesCache = Array.isArray(list) ? list : [];
    } catch { internalLineTypesCache = []; }
}

// Auto-refresh rules cache when main process reports updates
if (window.electronAPI?.onRulesUpdated) {
    window.electronAPI.onRulesUpdated(async () => {
        await refreshRulesCache();
        await refreshLineTypesCache();
        try {
            if (currentFileFormat === 'dxf' && window.currentLayerData) populateLayerTable(window.currentLayerData);
            else updateImportPanelForUnified();
        } catch {}
    });
}

// No import/output unit overrides to persist

const lineTypesBtn = document.getElementById('lineTypesBtn');
const panelToggleIcon = document.getElementById('panelToggleIcon');
const layerTableEl = document.getElementById('layerTable');
const drawingInfoEl = document.getElementById('drawingInfo');
const drawingDimensionsEl = document.getElementById('drawingDimensions');
const drawingUnitsEl = document.getElementById('drawingUnits');
const unitOverrideEl = document.getElementById('unitOverride');
const resizeHandleEl = document.getElementById('resizeHandle');
const viewerContainerEl = document.querySelector('.viewer-container');
const formatIndicatorEl = document.getElementById('formatIndicator');
const showBridgesContainerEl = document.getElementById('showBridgesContainer');
const showBridgesToggleEl = document.getElementById('showBridgesToggle');
let currentFileFormat = 'dxf';

// Overlay renderer state for DDS/CFF2
let overlayCanvas = null;
let overlayCtx = null;
let overlayView = { scale: 1, offsetX: 0, offsetY: 0 };
let overlayBounds = null; // {minX, minY, maxX, maxY}
let overlayIsPanning = false;
let overlayPanStart = { x: 0, y: 0 };
let overlayOffsetStart = { x: 0, y: 0 };
let overlayGroups = {}; // key -> {visible, displayColor, entities: indices, count, length}
let overlayResizeHandler = null;

// ---- Overlay helpers for DDS/CFF2 rendering ----
function ensureOverlayCanvas() {
    if (overlayCanvas) return;
    overlayCanvas = document.createElement('canvas');
    overlayCanvas.id = 'overlayCanvas';
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.left = '0';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.width = '100%';
    overlayCanvas.style.height = '100%';
    overlayCanvas.style.pointerEvents = 'auto';
    overlayCanvas.style.zIndex = '10';
    // Ensure the viewer container can host absolutely positioned children
    if (viewerEl && getComputedStyle(viewerEl).position === 'static') {
        viewerEl.style.position = 'relative';
    }
    viewerEl.appendChild(overlayCanvas);
    overlayCtx = overlayCanvas.getContext('2d');

    overlayResizeHandler = () => {
        const rect = viewerEl.getBoundingClientRect();
        overlayCanvas.width = Math.max(1, Math.floor(rect.width));
        overlayCanvas.height = Math.max(1, Math.floor(rect.height));
        // After container size changes, refit geometry to keep it in view
        if (window.unifiedGeometries && window.unifiedGeometries.length) {
            fitOverlayView();
        } else {
            drawOverlay();
        }
    };
    window.addEventListener('resize', overlayResizeHandler);
    // Also observe viewer size changes not caused by window resize
    const ro = new ResizeObserver(() => overlayResizeHandler());
    ro.observe(viewerEl);
    overlayCanvas._ro = ro;
    overlayResizeHandler();

    // Redraw when bridge overlay toggle changes
    const br = document.getElementById('showBridgesToggle');
    if (br) br.addEventListener('change', drawOverlay);

    // Mouse pan
    overlayCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        overlayIsPanning = true;
        overlayPanStart = { x: e.offsetX, y: e.offsetY };
        overlayOffsetStart = { x: overlayView.offsetX, y: overlayView.offsetY };
    });
    overlayCanvas.addEventListener('mouseup', () => { overlayIsPanning = false; });
    overlayCanvas.addEventListener('mouseleave', () => { overlayIsPanning = false; });
    overlayCanvas.addEventListener('mousemove', (e) => {
        if (!overlayIsPanning) return;
        const dx = e.offsetX - overlayPanStart.x;
        const dy = e.offsetY - overlayPanStart.y;
        overlayView.offsetX = overlayOffsetStart.x + dx;
        overlayView.offsetY = overlayOffsetStart.y + dy;
        drawOverlay();
    });

    // Wheel zoom at cursor
    overlayCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const mx = e.offsetX, my = e.offsetY;
        // Keep model point under cursor fixed
        const model = canvasToModel(mx, my);
        const newScale = Math.max(0.0001, overlayView.scale * zoomFactor);
        // Clamp zoom range
        const minScale = 0.0001;
        const maxScale = 1000;
        overlayView.scale = Math.min(maxScale, Math.max(minScale, newScale));
        overlayView.offsetX = mx - model.x * overlayView.scale;
        overlayView.offsetY = my + model.y * overlayView.scale;
        drawOverlay();
    }, { passive: false });
}

function resetOverlayState() {
    overlayView = { scale: 1, offsetX: 0, offsetY: 0 };
    overlayBounds = null;
    overlayIsPanning = false;
    overlayGroups = {};
}

function destroyOverlayCanvas() {
    try {
        if (overlayResizeHandler) {
            window.removeEventListener('resize', overlayResizeHandler);
            overlayResizeHandler = null;
        }
        if (overlayCanvas && overlayCanvas._ro) {
            try { overlayCanvas._ro.disconnect(); } catch {}
            overlayCanvas._ro = null;
        }
        if (overlayCanvas && overlayCanvas.parentNode) {
            overlayCanvas.parentNode.removeChild(overlayCanvas);
        }
    } catch {}
    overlayCanvas = null;
    overlayCtx = null;
    resetOverlayState();
}

function getUnifiedBounds(geometries) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const g of geometries || []) {
        if (g.type === 'LINE') {
            minX = Math.min(minX, g.start.x, g.end.x);
            minY = Math.min(minY, g.start.y, g.end.y);
            maxX = Math.max(maxX, g.start.x, g.end.x);
            maxY = Math.max(maxY, g.start.y, g.end.y);
        } else if (g.type === 'ARC' && g.center && isFinite(g.radius)) {
            const r = Math.abs(g.radius);
            minX = Math.min(minX, g.center.x - r);
            minY = Math.min(minY, g.center.y - r);
            maxX = Math.max(maxX, g.center.x + r);
            maxY = Math.max(maxY, g.center.y + r);
        }
    }
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
}

// Infer file-level units (mm vs inches) from geometry coordinates
function inferUnitsFromGeometry(geoms) {
    try {
        const b = getUnifiedBounds(geoms);
        if (!b) return { unit: 'unknown', confidence: 0 };
        const w = Math.abs(b.maxX - b.minX);
        const h = Math.abs(b.maxY - b.minY);
        // Collect sample points (cap to 200 for speed)
        const points = [];
        for (let i = 0; i < geoms.length && points.length < 200; i++) {
            const g = geoms[i];
            if (g.start) { points.push(g.start.x, g.start.y); }
            if (g.end) { points.push(g.end.x, g.end.y); }
            if (g.center) { points.push(g.center.x, g.center.y); }
        }
        if (points.length < 4) return { unit: 'unknown', confidence: 0 };

        // Grid residual helper
        const avgResidual = (vals, step, convert) => {
            let acc = 0, n = 0;
            for (let i = 0; i < vals.length; i++) {
                const v = convert ? convert(vals[i]) : vals[i];
                const r = v % step;
                const d = Math.min(r, step - r);
                acc += (d / step);
                n++;
            }
            return n ? acc / n : 1;
        };
        // Hypothesis MM: raw units are millimeters
        const residualMm = avgResidual(points, 0.1);
        // Hypothesis IN: raw units are inches → convert to inches then measure against 1/16 grid
        const residualIn = avgResidual(points, 1/16, (x) => x); // points presumed already inches in this hypo
        // But our raw may be mm when testing inches; convert values to inches in that case:
        const residualRawAsMmToIn = avgResidual(points, 1/16, (x) => x / 25.4);

        // Size plausibility (in mm)
        const plausible = (valMm) => (valMm >= 20 && valMm <= 8000) ? 1 : 0;
        const sizeScoreMm = Math.min(1, (plausible(w) + plausible(h)) / 2);
        const sizeScoreIn = Math.min(1, (plausible(w * 25.4) + plausible(h * 25.4)) / 2);

        // Combine scores (lower residual is better)
        const gridScoreMm = 1 - Math.min(1, residualMm);
        const gridScoreIn = 1 - Math.min(1, residualRawAsMmToIn);
        const scoreMm = 0.6 * gridScoreMm + 0.4 * sizeScoreMm;
        const scoreIn = 0.6 * gridScoreIn + 0.4 * sizeScoreIn;
        if (Math.max(scoreMm, scoreIn) < 0.2 || Math.abs(scoreMm - scoreIn) < 0.1) {
            return { unit: 'unknown', confidence: 0 };
        }
        return (scoreMm > scoreIn)
            ? { unit: 'mm', confidence: +(scoreMm - scoreIn).toFixed(2) }
            : { unit: 'in', confidence: +(scoreIn - scoreMm).toFixed(2) };
    } catch {
        return { unit: 'unknown', confidence: 0 };
    }
}

function fitOverlayViewInitial() {
    if (!overlayCanvas || !window.unifiedGeometries || window.unifiedGeometries.length === 0) return;
    overlayBounds = getUnifiedBounds(window.unifiedGeometries);
    if (!overlayBounds) return;
    const pad = 20;
    const geoW = overlayBounds.maxX - overlayBounds.minX;
    const geoH = overlayBounds.maxY - overlayBounds.minY;
    const sx = (overlayCanvas.width - 2 * pad) / Math.max(geoW, 1e-6);
    const sy = (overlayCanvas.height - 2 * pad) / Math.max(geoH, 1e-6);
    const scale = Math.max(0.0001, Math.min(sx, sy));
    overlayView.scale = scale * 0.98;
    overlayView.offsetX = (overlayCanvas.width - geoW * overlayView.scale) / 2 - overlayBounds.minX * overlayView.scale;
    overlayView.offsetY = (overlayCanvas.height + geoH * overlayView.scale) / 2 + overlayBounds.minY * overlayView.scale;
    drawOverlay();
}

function modelToCanvas(x, y) {
    return {
        x: overlayView.offsetX + x * overlayView.scale,
        y: overlayView.offsetY - y * overlayView.scale
    };
}

function canvasToModel(x, y) {
    return {
        x: (x - overlayView.offsetX) / overlayView.scale,
        y: -(y - overlayView.offsetY) / overlayView.scale
    };
}

function colorFromCode(code) {
    const m = {
        1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF', 5: '#0000FF', 6: '#FF00FF', 7: '#FFFFFF', 8: '#808080', 9: '#C0C0C0', 255: '#0000FF'
    };
    if (typeof code === 'number' && m[code]) return m[code];
    return '#66d9ef';
}

function getGroupKeyForGeometry(g) {
    if (currentFileFormat === 'dds') {
        const rawKerf = g.properties?.rawKerf != null ? String(g.properties.rawKerf) : String(g.kerfWidth ?? '');
        const unit = g.properties?.unitCode || 'unknown';
        return `${g.color}|${rawKerf}|${unit}`;
    }
    if (currentFileFormat === 'cf2' || currentFileFormat === 'cff2') {
        if (g.layer) return String(g.layer);
        const pen = g.properties?.pen ?? '';
        const layer = g.properties?.cff2Layer ?? '';
        return `${pen}-${layer}`;
    }
    return 'default';
}

function stableColorHexFromKey(key) {
    // Deterministic hex color from string key (good for <input type="color">)
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash) + key.charCodeAt(i);
        hash |= 0;
    }
    const hue = Math.abs(hash) % 360;
    const s = 0.65; // 65%
    const l = 0.55; // 55%
    // hsl -> rgb
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hPrime = hue / 60;
    const x = c * (1 - Math.abs((hPrime % 2) - 1));
    let r1 = 0, g1 = 0, b1 = 0;
    if (hPrime < 1) { r1 = c; g1 = x; }
    else if (hPrime < 2) { r1 = x; g1 = c; }
    else if (hPrime < 3) { g1 = c; b1 = x; }
    else if (hPrime < 4) { g1 = x; b1 = c; }
    else if (hPrime < 5) { r1 = x; b1 = c; }
    else { r1 = c; b1 = x; }
    const m = l - c / 2;
    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);
    const toHex = (v) => v.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function buildGroups() {
    overlayGroups = {};
    const geoms = window.unifiedGeometries || [];
    geoms.forEach((g, idx) => {
        const key = getGroupKeyForGeometry(g);
        if (!overlayGroups[key]) {
            overlayGroups[key] = {
                visible: true,
                displayColor: (currentFileFormat === 'dds'
                    ? (typeof g.color === 'number' ? (aciToHex(g.color) || '#66d9ef') : '#66d9ef')
                    : stableColorHexFromKey(key)
                ),
                entities: [],
                count: 0,
                length: 0
            };
        }
        overlayGroups[key].entities.push(idx);
        overlayGroups[key].count++;
        // accumulate length
        if (g.type === 'LINE') {
            overlayGroups[key].length += Math.hypot(g.end.x - g.start.x, g.end.y - g.start.y) || 0;
        } else if (g.type === 'ARC') {
            const r = Math.abs(g.radius) || 0;
            const a0 = Math.atan2(g.start.y - g.center.y, g.start.x - g.center.x);
            const a1 = Math.atan2(g.end.y - g.center.y, g.end.x - g.center.x);
            let sweep = Math.abs(a1 - a0);
            if (sweep > Math.PI) sweep = 2 * Math.PI - sweep;
            overlayGroups[key].length += r * sweep;
        }
    });
}

function updateImportPanelForUnified() {
    const geoms = window.unifiedGeometries || [];
    if (geoms.length === 0) {
        layerTableEl.innerHTML = '<div class="no-file">Load a file to view layers</div>';
        return;
    }
    buildGroups();
    const keys = Object.keys(overlayGroups).sort();
    const isCff2 = (currentFileFormat === 'cf2' || currentFileFormat === 'cff2');
    const isDds = (currentFileFormat === 'dds');

    let thead = '';
    if (isCff2) {
        // Fixed order: Output, Color, Pt, Pen, Layer, →, Mapping
        thead = '<tr><th>Output</th><th>Color</th><th>Pt</th><th>Pen</th><th>Layer</th><th>→</th><th>Mapping</th></tr>';
    } else if (isDds) {
        // Fixed order: Output, Color, Pt, Color, →, Mapping
        thead = '<tr><th>Output</th><th>Color</th><th>Pt</th><th>Color</th><th>→</th><th>Mapping</th></tr>';
    } else {
        thead = '<tr><th>Output</th><th>Color</th><th>Key</th><th>→</th><th>Mapping</th></tr>';
    }

    const doGroupByPt = (groupByPtToggleEl && groupByPtToggleEl.checked);

    if (doGroupByPt && (isCff2 || isDds)) {
        // Build grouped rows by Pt value
        const colSpan = isCff2 ? 7 : 6;
        const groups = new Map();
        keys.forEach((k) => {
            if (isCff2) {
                const pen = (k.split('-')[0] || '0');
                const ptKey = Number(pen || 0).toFixed(2);
                if (!groups.has(ptKey)) groups.set(ptKey, []);
                groups.get(ptKey).push(k);
            } else if (isDds) {
                const [color, rawKerf, unit] = k.split('|');
                const ptVal = (unit==='in' ? Number(rawKerf||0)*72 : unit==='mm' ? Number(rawKerf||0)/25.4*72 : Number(rawKerf||0));
                const ptKey = ptVal.toFixed(2);
                if (!groups.has(ptKey)) groups.set(ptKey, []);
                groups.get(ptKey).push(k);
            }
        });
        const sorted = Array.from(groups.keys()).sort((a,b)=>parseFloat(a)-parseFloat(b));
        const parts = [];
        sorted.forEach((ptKey, idx) => {
            const gid = `grp_${ptKey.replace(/\./g,'_')}`;
            // Header row
            parts.push(`
                <tr class="group-row" data-group-id="${gid}">
                  <td colspan="${colSpan}" style="text-align:left; cursor:pointer;">
                    <span class="twisty">▶</span> <strong>${ptKey} pt</strong> · ${groups.get(ptKey).length} item(s)
                  </td>
                </tr>
            `);
            // Child rows hidden by default
            groups.get(ptKey).forEach((k) => {
                if (isCff2) {
                    const g = overlayGroups[k];
                    const [pen, ...rest] = k.split('-');
                    const layer = rest.join('-');
                    const entry = exactRulesCache.get(`cff2|${k}`);
                    const ltName = entry?.lineTypeId ? getLineTypeName(String(entry.lineTypeId)) : '';
                    const isEnabled = !!(entry && entry.enabled !== false && entry.lineTypeId);
                    const isDisabledRule = !!(entry && entry.lineTypeId && entry.enabled === false);
                    const mappingText = isEnabled ? ltName : (isDisabledRule ? 'NO OUTPUT' : 'UNMAPPED');
                    const mappedClass = isEnabled ? 'mapped' : (isDisabledRule ? 'disabled' : 'unmapped');
                    const checked = (g.visible && !isDisabledRule) ? 'checked' : '';
                    if (isDisabledRule && overlayGroups[k]) overlayGroups[k].visible = false;
                    parts.push(`
                      <tr class="group-child" data-parent-group="${gid}" style="display:none;" data-key="${k}">
                        <td><input type="checkbox" class="unified-layer-visible output-toggle ${mappedClass}" data-key="${k}" ${checked} ${isDisabledRule ? 'disabled title="Disabled rule: no output"' : ''} /></td>
                        <td><span class="color-swatch" style="background:${g.displayColor}"></span></td>
                        <td>${Number(pen || 0).toFixed(2)}</td>
                        <td>${pen}</td>
                        <td>${layer}</td>
                        <td><button class="btn btn-small btn-secondary goto-mapping-btn" data-key="${k}" title="Open Mapping">→</button></td>
                        <td class="lt-name">${mappingText}</td>
                      </tr>`);
                } else {
                    const g = overlayGroups[k];
                    const [color, rawKerf, unit] = k.split('|');
                    const entry = exactRulesCache.get(`dds|${k}`);
                    const ltName = entry?.lineTypeId ? getLineTypeName(String(entry.lineTypeId)) : '';
                    const isEnabled = !!(entry && entry.enabled !== false && entry.lineTypeId);
                    const isDisabledRule = !!(entry && entry.lineTypeId && entry.enabled === false);
                    const mappingText = isEnabled ? ltName : (isDisabledRule ? 'NO OUTPUT' : 'UNMAPPED');
                    const mappedClass = isEnabled ? 'mapped' : (isDisabledRule ? 'disabled' : 'unmapped');
                    const checked = (g.visible && !isDisabledRule) ? 'checked' : '';
                    if (isDisabledRule && overlayGroups[k]) overlayGroups[k].visible = false;
                    parts.push(`
                      <tr class="group-child" data-parent-group="${gid}" style="display:none;" data-key="${k}">
                        <td><input type="checkbox" class="unified-layer-visible output-toggle ${mappedClass}" data-key="${k}" ${checked} ${isDisabledRule ? 'disabled title="Disabled rule: no output"' : ''} /></td>
                        <td><span class="color-swatch" style="background:${g.displayColor}"></span></td>
                        <td title="raw: ${rawKerf} ${unit}">${(unit==='in' ? Number(rawKerf||0)*72 : unit==='mm' ? Number(rawKerf||0)/25.4*72 : Number(rawKerf||0)).toFixed(2)}</td>
                        <td>${color}</td>
                        <td><button class="btn btn-small btn-secondary goto-mapping-btn" data-key="${k}" title="Open Mapping">→</button></td>
                        <td class="lt-name">${mappingText}</td>
                      </tr>`);
                }
            });
        });
        const rows = parts.join('');
        // Inject
        layerTableEl.innerHTML = `
          <div class="rules-table-container">
            <table class="rules-table" id="unifiedLineTypesTable">
              <thead>${thead}</thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
        // Add togglers
        layerTableEl.querySelectorAll('tr.group-row').forEach(row => {
            row.addEventListener('click', () => {
                const gid = row.getAttribute('data-group-id');
                const open = row.classList.toggle('open');
                const twist = row.querySelector('.twisty');
                if (twist) twist.textContent = open ? '▼' : '▶';
                layerTableEl.querySelectorAll(`tr.group-child[data-parent-group="${gid}"]`).forEach(ch => {
                    ch.style.display = open ? '' : 'none';
                });
            });
        });
        // Continue with listeners for checkboxes, mapping btns, etc. below
    } else {
        const rows = keys.map((k) => {
            const g = overlayGroups[k];
            const length = g.length;
            if (isCff2) {
                const parts = k.split('-');
                const pen = parts[0] ?? '';
                const layer = parts.slice(1).join('-');
                const entry = exactRulesCache.get(`cff2|${k}`);
                const ltName = entry?.lineTypeId ? getLineTypeName(String(entry.lineTypeId)) : '';
                const isEnabled = !!(entry && entry.enabled !== false && entry.lineTypeId);
                const isDisabledRule = !!(entry && entry.lineTypeId && entry.enabled === false);
                const mappingText = isEnabled ? ltName : (isDisabledRule ? 'NO OUTPUT' : 'UNMAPPED');
                const mappedClass = isEnabled ? 'mapped' : (isDisabledRule ? 'disabled' : 'unmapped');
                const checked = (g.visible && !isDisabledRule) ? 'checked' : '';
                if (isDisabledRule && overlayGroups[k]) overlayGroups[k].visible = false;
                return `
                  <tr data-key="${k}">
                    <td><input type="checkbox" class="unified-layer-visible output-toggle ${mappedClass}" data-key="${k}" ${checked} ${isDisabledRule ? 'disabled title="Disabled rule: no output"' : ''} /></td>
                    <td><span class="color-swatch" style="background:${g.displayColor}"></span></td>
                    <td>${Number(pen || 0).toFixed(2)}</td>
                    <td>${pen}</td>
                    <td>${layer}</td>
                    <td><button class="btn btn-small btn-secondary goto-mapping-btn" data-key="${k}" title="Open Mapping">→</button></td>
                    <td class="lt-name">${mappingText}</td>
                  </tr>`;
            }
            if (isDds) {
                const [color, rawKerf, unit] = k.split('|');
                const entry = exactRulesCache.get(`dds|${k}`);
                const ltName = entry?.lineTypeId ? getLineTypeName(String(entry.lineTypeId)) : '';
                const isEnabled = !!(entry && entry.enabled !== false && entry.lineTypeId);
                const isDisabledRule = !!(entry && entry.lineTypeId && entry.enabled === false);
                const mappingText = isEnabled ? ltName : (isDisabledRule ? 'NO OUTPUT' : 'UNMAPPED');
                const mappedClass = isEnabled ? 'mapped' : (isDisabledRule ? 'disabled' : 'unmapped');
                const checked = (g.visible && !isDisabledRule) ? 'checked' : '';
                if (isDisabledRule && overlayGroups[k]) overlayGroups[k].visible = false;
                return `
                  <tr data-key="${k}">
                    <td><input type="checkbox" class="unified-layer-visible output-toggle ${mappedClass}" data-key="${k}" ${checked} ${isDisabledRule ? 'disabled title="Disabled rule: no output"' : ''} /></td>
                    <td><span class="color-swatch" style="background:${g.displayColor}"></span></td>
                    <td title="raw: ${rawKerf} ${unit}">${(unit==='in' ? Number(rawKerf||0)*72 : unit==='mm' ? Number(rawKerf||0)/25.4*72 : Number(rawKerf||0)).toFixed(2)}</td>
                    <td>${color}</td>
                    <td><button class="btn btn-small btn-secondary goto-mapping-btn" data-key="${k}" title="Open Mapping">→</button></td>
                    <td class="lt-name">${mappingText}</td>
                  </tr>`;
            }
            return `
              <tr data-key="${k}">
                <td><input type="checkbox" class="unified-layer-visible output-toggle unmapped" data-key="${k}" ${g.visible ? 'checked' : ''} /></td>
                <td><span class="color-swatch" style="background:${g.displayColor}"></span></td>
                <td>${k}</td>
                <td><button class="btn btn-small btn-secondary goto-mapping-btn" data-key="${k}" title="Open Mapping">→</button></td>
                <td class="lt-name">UNMAPPED</td>
              </tr>`;
        }).join('');
        layerTableEl.innerHTML = `
          <div class="rules-table-container">
            <table class="rules-table" id="unifiedLineTypesTable">
              <thead>${thead}</thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
    }
    // Enable column drag-reorder and width persist (like unified-viewer)
    (function makeHeadersDraggable(tableId, storageKey){
        const table = document.getElementById(tableId);
        if (!table) return;
        const headRow = table.querySelector('thead tr');
        if (!headRow) return;
        const ths = Array.from(headRow.children);
        ths.forEach((th, i) => { if (!th.dataset.column) th.dataset.column = `col_${i}`; th.classList.add('draggable'); });
        // Sorting state + helpers (single definition)
        let sortState = { idx: -1, dir: 'asc' };
        const applySortIndicators = () => {
            Array.from(headRow.children).forEach((th, i) => {
                th.classList.remove('sort-asc','sort-desc');
                if (i === sortState.idx) th.classList.add(sortState.dir === 'asc' ? 'sort-asc' : 'sort-desc');
            });
        };
        const sortByColumn = (idx) => {
            const tbody = table.tBodies[0]; if (!tbody) return;
            const rows = Array.from(tbody.rows);
            const dirMult = sortState.idx === idx && sortState.dir === 'asc' ? -1 : 1;
            sortState.idx = idx; sortState.dir = dirMult === 1 ? 'asc' : 'desc';
            rows.sort((a,b) => {
                const ta = (a.children[idx]?.textContent || '').trim();
                const tb = (b.children[idx]?.textContent || '').trim();
                const na = parseFloat(ta); const nb = parseFloat(tb);
                if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dirMult;
                return ta.localeCompare(tb) * dirMult;
            });
            rows.forEach(r => tbody.appendChild(r));
            applySortIndicators();
        };
        const persistWidths = () => {
            const widths = {};
            Array.from(headRow.children).forEach((h, i) => widths[i] = h.offsetWidth + 'px');
            localStorage.setItem(storageKey + '_widths', JSON.stringify(widths));
        };
        const autoFit = (thIdx) => {
            const headCell = headRow.children[thIdx];
            const bodyRows = Array.from(table.tBodies[0]?.rows || []);
            // Reset width to shrink-to-fit before measuring to avoid compounding
            if (headCell) headCell.style.width = '';
            bodyRows.forEach(r => { const c = r.children[thIdx]; if (c) c.style.width = ''; });
            let maxW = headCell ? headCell.scrollWidth : 0;
            const measureCell = (cell) => {
                if (!cell) return 0;
                const clone = cell.cloneNode(true);
                clone.style.width = 'auto';
                clone.style.position = 'absolute';
                clone.style.visibility = 'hidden';
                clone.style.whiteSpace = 'nowrap';
                document.body.appendChild(clone);
                const w = clone.scrollWidth;
                document.body.removeChild(clone);
                return w;
            };
            maxW = Math.max(maxW, ...bodyRows.map(r => measureCell(r.children[thIdx])));
            const target = Math.min(Math.max(60, maxW + 24), 600);
            if (headCell) headCell.style.width = target + 'px';
            bodyRows.forEach(r => { const c = r.children[thIdx]; if (c) c.style.width = target + 'px'; });
            persistWidths();
        };
        // Enforce fixed order; clear any previously stored order
        try { localStorage.removeItem(storageKey); } catch {}
        Array.from(headRow.children).forEach((th, idx) => {
            // Drag-reorder disabled; keep sort/auto-fit/resize
            th.addEventListener('click', () => sortByColumn(idx));
            th.addEventListener('dblclick', () => autoFit(idx));
            const resizer = document.createElement('div');
            resizer.className = 'col-resizer';
            th.appendChild(resizer);
            let startX = 0; let startW = 0;
            resizer.addEventListener('mousedown', (e) => {
                startX = e.clientX; startW = th.offsetWidth; document.body.style.cursor = 'col-resize';
                const onMove = (ev) => { const dx = ev.clientX - startX; th.style.width = Math.max(40, startW + dx) + 'px'; };
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; persistWidths(); };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });
    })(isCff2 ? 'unifiedLineTypesTable' : 'unifiedLineTypesTable', (isCff2?'cff2':'dds')+'_column_order');

    layerTableEl.querySelectorAll('.unified-layer-visible').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const key = e.target.getAttribute('data-key');
            if (overlayGroups[key]) {
                overlayGroups[key].visible = !!e.target.checked;
                drawOverlay();
                updateUnifiedMappingStatus();
            }
        });
    });

    // Ensure disabled rules show as NO OUTPUT and force checkbox off with blue glow
    Array.from(layerTableEl.querySelectorAll('tr[data-key]')).forEach(tr => {
        const k = tr.getAttribute('data-key');
        const cb = tr.querySelector('.output-toggle');
        if (!cb) return;
        const fmt = isDds ? 'dds' : (isCff2 ? 'cff2' : '');
        if (!fmt) return;
        const entry = exactRulesCache.get(`${fmt}|${k}`);
        if (entry && entry.lineTypeId && entry.enabled === false) {
            const mappedCell = tr.querySelector('.lt-name');
            if (mappedCell) mappedCell.textContent = 'NO OUTPUT';
            cb.checked = false;
            cb.classList.remove('mapped','unmapped');
            cb.classList.add('disabled');
            cb.disabled = true;
            if (overlayGroups[k]) overlayGroups[k].visible = false;
        }
    });

    // No manual color picker in simplified UI

    // Map Line popup for unified rows (DDS/CFF2)
    layerTableEl.querySelectorAll('.goto-mapping-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const key = e.currentTarget.getAttribute('data-key');
            if (!key) return;
            if (isDds) {
                const [color, rawKerf, unit] = key.split('|');
                const disp = overlayGroups?.[key]?.displayColor || '#66d9ef';
                openMapLinePopup({
                    format: 'dds',
                    fields: [
                        { label: 'Color', value: color },
                        { label: 'Width', value: `${rawKerf} ${unit}` }
                    ],
                    rulePayload: { format: 'dds', key, color: Number(color), rawKerf: String(rawKerf), unitCode: unit },
                    displayColor: disp
                }, key);
            } else if (isCff2) {
                const parts = key.split('-');
                const pen = parts[0] ?? '';
                const layer = parts.slice(1).join('-');
                const disp = overlayGroups?.[key]?.displayColor || '#66d9ef';
                openMapLinePopup({
                    format: 'cff2',
                    fields: [
                        { label: 'Pen (pt)', value: pen },
                        { label: 'Layer', value: layer }
                    ],
                    rulePayload: { format: 'cff2', key, pen: String(pen), layer: String(layer), unitCode: 'pt' },
                    displayColor: disp
                }, key);
            }
        });
    });

    // Double-click swatch to open mapping popup with color picker
    layerTableEl.querySelectorAll('span.color-swatch').forEach(sw => {
        sw.addEventListener('dblclick', (e) => {
            const tr = e.currentTarget.closest('tr[data-key]');
            if (!tr) return;
            const key = tr.getAttribute('data-key');
            const disp = overlayGroups?.[key]?.displayColor || '#66d9ef';
            if (isDds) {
                const [color, rawKerf, unit] = key.split('|');
                openMapLinePopup({ format: 'dds', fields: [ {label:'Color', value: color}, {label:'Width', value: `${rawKerf} ${unit}`} ], rulePayload: { format:'dds', key }, displayColor: disp }, key).then(()=>updateUnifiedMappingStatus());
            } else if (isCff2) {
                const parts = key.split('-');
                const pen = parts[0] ?? '';
                const layer = parts.slice(1).join('-');
                openMapLinePopup({ format: 'cff2', fields: [ {label:'Pen (pt)', value: pen}, {label:'Layer', value: layer} ], rulePayload: { format:'cff2', key }, displayColor: disp }, key).then(()=>updateUnifiedMappingStatus());
            }
        });
    });

    // After building the table, push status to header
    updateUnifiedMappingStatus();
}

function drawOverlay() {
    if (!overlayCtx || !overlayCanvas) return;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const geoms = window.unifiedGeometries || [];
    if (geoms.length === 0) return;
    // Ensure groups/colors exist before first paint (covers initial resize draw)
    if (!overlayGroups || Object.keys(overlayGroups).length === 0) {
        buildGroups();
    }

    const showBridges = !!document.getElementById('showBridgesToggle')?.checked;
    overlayCtx.lineCap = 'round';
    overlayCtx.lineJoin = 'round';

    for (let idx = 0; idx < geoms.length; idx++) {
        const g = geoms[idx];
        const key = getGroupKeyForGeometry(g);
        const group = overlayGroups[key];
        if (group && group.visible === false) continue;

        overlayCtx.save();
        // Choose color: if mapped to a Local Line Type with a defined display color, use that;
        // otherwise fall back to format-native (DXF ACI for DDS if present) or group color
        let stroke = group?.displayColor || '#66d9ef';
        try {
            // Resolve exact key for this geometry group
            const groupKey = key; // already computed
            let mappedHex = '';
            if (currentFileFormat === 'dds') {
                const entry = exactRulesCache.get(`dds|${groupKey}`);
                const ltId = entry?.enabled ? entry.lineTypeId : null;
                if (ltId && internalLineTypesCache.length) {
                    const lt = internalLineTypesCache.find(x => String(x.id) === String(ltId));
                    if (lt?.color) mappedHex = lt.color; // expect hex like #RRGGBB
                }
                if (!mappedHex && typeof g.color !== 'undefined') {
                    const hex = aciToHex(g.color);
                    if (hex) mappedHex = hex;
                }
            } else if (currentFileFormat === 'cf2' || currentFileFormat === 'cff2') {
                const entry = exactRulesCache.get(`cff2|${groupKey}`);
                const ltId = entry?.enabled ? entry.lineTypeId : null;
                // Prefer explicit rule color if provided
                if (entry?.color) mappedHex = entry.color;
                if (!mappedHex && ltId && internalLineTypesCache.length) {
                    const lt = internalLineTypesCache.find(x => String(x.id) === String(ltId));
                    if (lt?.color) mappedHex = lt.color;
                }
            }
            if (mappedHex) stroke = mappedHex;
        } catch {}
        
        overlayCtx.strokeStyle = stroke;
        overlayCtx.lineWidth = 1.25;
        overlayCtx.setLineDash([]);

        if (g.type === 'LINE' && g.start && g.end) {
            // Always draw the full base geometry first
            const p1 = modelToCanvas(g.start.x, g.start.y);
            const p2 = modelToCanvas(g.end.x, g.end.y);
            overlayCtx.beginPath();
            overlayCtx.moveTo(p1.x, p1.y);
            overlayCtx.lineTo(p2.x, p2.y);
            overlayCtx.stroke();

            // Then overlay the bridge segment(s) without altering the base line
            if (showBridges && (g.bridgeCount || 0) > 0 && (g.bridgeWidth || 0) > 0) {
                drawLineWithBridges(g);
            }
        } else if (g.type === 'ARC' && g.center && isFinite(g.radius) && g.start && g.end) {
            // Always draw the full base arc first
            const cx = g.center.x, cy = g.center.y;
            let a0 = Math.atan2(g.start.y - cy, g.start.x - cx);
            let a1 = Math.atan2(g.end.y - cy, g.end.x - cx);
            const c = modelToCanvas(cx, cy);
            const rAbs = Math.abs(g.radius);
            const isFullCircle = Math.abs(g.start.x - g.end.x) < 1e-6 && Math.abs(g.start.y - g.end.y) < 1e-6;
            overlayCtx.beginPath();
            if (isFullCircle) {
                overlayCtx.arc(c.x, c.y, rAbs * overlayView.scale, 0, 2 * Math.PI, false);
            } else {
                // Preserve original CW/CCW semantics based on radius sign
                const ccw = g.clockwise === false; // negative radius → CCW
                overlayCtx.arc(c.x, c.y, rAbs * overlayView.scale, -a0, -a1, !ccw);
            }
            overlayCtx.stroke();

            // Then overlay the bridge segment(s) without altering the base arc
            if (showBridges && (g.bridgeCount || 0) > 0 && (g.bridgeWidth || 0) > 0) {
                drawArcWithBridges(g);
            }
        }

        overlayCtx.restore();
    }
}
function fitOverlayView() {
    if (!overlayCanvas || !window.unifiedGeometries || window.unifiedGeometries.length === 0) return;
    overlayBounds = getUnifiedBounds(window.unifiedGeometries);
    if (!overlayBounds) return;
    const pad = 20;
    const geoW = overlayBounds.maxX - overlayBounds.minX;
    const geoH = overlayBounds.maxY - overlayBounds.minY;
    const sx = (overlayCanvas.width - 2 * pad) / Math.max(geoW, 1e-6);
    const sy = (overlayCanvas.height - 2 * pad) / Math.max(geoH, 1e-6);
    const scale = Math.max(0.0001, Math.min(sx, sy));
    overlayView.scale = scale * 0.98;
    overlayView.offsetX = (overlayCanvas.width - geoW * overlayView.scale) / 2 - overlayBounds.minX * overlayView.scale;
    overlayView.offsetY = (overlayCanvas.height + geoH * overlayView.scale) / 2 + overlayBounds.minY * overlayView.scale;
    drawOverlay();
}

// duplicate block removed

function drawLineWithBridges(g) {
    // Draw only the bridge segments as a solid overlay (base line already drawn)
    const sx = g.start.x, sy = g.start.y, ex = g.end.x, ey = g.end.y;
    const dx = ex - sx, dy = ey - sy;
    const totalLen = Math.hypot(dx, dy);
    if (!isFinite(totalLen) || totalLen === 0) return;
    const ux = dx / totalLen, uy = dy / totalLen;
    const n = Math.max(0, g.bridgeCount || 0);
    const bw = Math.max(0, g.bridgeWidth || 0);
    const drawable = totalLen - n * bw;
    if (n === 0 || bw === 0 || drawable <= 0) return;
    const segLen = drawable / (n + 1);
    for (let i = 0; i < n; i++) {
        const gapStart = (i + 1) * segLen + i * bw;
        const gapEnd = gapStart + bw;
        const g1 = modelToCanvas(sx + ux * gapStart, sy + uy * gapStart);
        const g2 = modelToCanvas(sx + ux * gapEnd, sy + uy * gapEnd);
        overlayCtx.save();
        overlayCtx.strokeStyle = '#ffcc66'; // solid bridge indicator
        overlayCtx.setLineDash([]);
        overlayCtx.lineWidth = 2;
        overlayCtx.beginPath();
        overlayCtx.moveTo(g1.x, g1.y);
        overlayCtx.lineTo(g2.x, g2.y);
        overlayCtx.stroke();
        overlayCtx.restore();
    }
}

function drawArcWithBridges(g) {
    // Draw only the bridge arc segments as a solid overlay (base arc already drawn)
    const cx = g.center.x, cy = g.center.y;
    const a0 = Math.atan2(g.start.y - cy, g.start.x - cx);
    const a1 = Math.atan2(g.end.y - cy, g.end.x - cx);
    const ccw = g.clockwise === false;
    const R = Math.abs(g.radius);
    if (!isFinite(R) || R === 0) return;

    // Detect full circle when start≈end but not at center
    const startAtCenter = Math.abs(g.start.x - cx) < 1e-9 && Math.abs(g.start.y - cy) < 1e-9;
    const endAtCenter = Math.abs(g.end.x - cx) < 1e-9 && Math.abs(g.end.y - cy) < 1e-9;
    const isFullCircle = !startAtCenter && !endAtCenter && Math.hypot(g.start.x - g.end.x, g.start.y - g.end.y) < 1e-9;

    // Normalize sweep length in the intended direction
    let raw = a1 - a0;
    if (isFullCircle) {
        raw = ccw ? -2 * Math.PI : 2 * Math.PI;
    } else {
        if (ccw && raw > 0) raw -= 2 * Math.PI;
        if (!ccw && raw < 0) raw += 2 * Math.PI;
    }
    const totalArcLen = R * Math.abs(raw);

    const n = Math.max(0, g.bridgeCount || 0);
    const bw = Math.max(0, g.bridgeWidth || 0);
    if (n === 0 || bw === 0) return;
    const totalBridge = n * bw;
    const drawable = totalArcLen - totalBridge;
    if (drawable <= 0) return;

    const segLen = drawable / (n + 1);
    // Match CAD VIEWER convention: for CCW, angles decrease as arc-length increases
    const dir = ccw ? -1 : 1; // arc-length to angle progression
    const C = modelToCanvas(cx, cy);
    const angleAt = (len) => a0 + dir * (len / R);

    overlayCtx.save();
    overlayCtx.strokeStyle = '#ffcc66';
    overlayCtx.setLineDash([]);
    overlayCtx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
        const gapStart = (i + 1) * segLen + i * bw;
        const gapEnd = gapStart + bw;
        const th1 = angleAt(gapStart);
        const th2 = angleAt(gapEnd);
        overlayCtx.beginPath();
        overlayCtx.arc(C.x, C.y, R * overlayView.scale, -th1, -th2, !ccw);
        overlayCtx.stroke();
    }
    overlayCtx.restore();
}
// UI Helper functions
function showStatus(message, type = 'info') {
    // Clear any existing auto-dismiss timeout
    if (window.statusTimeout) {
        clearTimeout(window.statusTimeout);
        window.statusTimeout = null;
    }
    
    statusEl.className = 'status';
    if (type === 'error') statusEl.classList.add('error');
    if (type === 'success') statusEl.classList.add('success');
    if (type === 'warning') statusEl.classList.add('warning');
    
    // For warning messages, add close button
    if (type === 'warning') {
        statusEl.innerHTML = `
            <span class="status-message">${message}</span>
            <button class="status-close-btn" onclick="hideStatus()" title="Close">×</button>
        `;
    } else {
        statusEl.textContent = message;
        // Auto-dismiss non-warning messages after 3 seconds
        window.statusTimeout = setTimeout(hideStatus, 3000);
    }
    
    // Make sure status is visible
    statusEl.style.display = 'block';
    
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function hideStatus() {
    if (statusEl) {
        statusEl.textContent = '';
        statusEl.className = 'status';
        statusEl.style.display = 'none';
    }
    if (window.statusTimeout) {
        clearTimeout(window.statusTimeout);
        window.statusTimeout = null;
    }
}
function updateFormatIndicator(ext) {
    const map = { dxf: 'DXF', dwg: 'DXF', dds: 'DDS', cf2: 'CFF2', cff2: 'CFF2' };
    const key = (ext || '').toLowerCase();
    currentFileFormat = key || 'dxf';
    if (formatIndicatorEl) {
        let label = map[currentFileFormat] || '';
        if (currentFileFormat === 'dds') {
            const geoms = window.unifiedGeometries || [];
            let unit = geoms.find(g => g?.properties?.unitCode)?.properties?.unitCode || 'unknown';
            // Fallback to display preference if detection is unknown
            if (unit === 'unknown') {
                const pref = getUserUnitPreference();
                if (pref === 'mm' || pref === 'in') unit = pref;
            }
            label = `DDS / ${unit}`;
        } else if (currentFileFormat === 'cf2' || currentFileFormat === 'cff2') {
            // Try inference
            const geoms = window.unifiedGeometries || [];
            const inf = inferUnitsFromGeometry(geoms);
            let unit = inf.unit;
            if (unit === 'unknown') {
                const pref = getUserUnitPreference();
                if (pref === 'mm' || pref === 'in') unit = pref;
            }
            label = `CFF2 / ${unit}${inf.confidence ? ` (${Math.round(inf.confidence*100)}%)` : ''}`;
        } else if (currentFileFormat === 'dxf') {
            const u = getDXFUnits();
            label = `DXF / ${u.unit}`;
        }
        if (label) {
            formatIndicatorEl.textContent = label;
            formatIndicatorEl.style.display = 'inline-flex';
        } else {
            formatIndicatorEl.textContent = '';
            formatIndicatorEl.style.display = 'none';
        }
    }
    const isBridgedFormat = currentFileFormat === 'dds' || currentFileFormat === 'cf2' || currentFileFormat === 'cff2';
    if (showBridgesContainerEl) {
        showBridgesContainerEl.style.display = isBridgedFormat ? 'inline-flex' : 'none';
    }
    // Default bridges overlay to ON for all formats
    if (showBridgesToggleEl) {
        showBridgesToggleEl.checked = true;
    }
}

function showLoading(show = true) {
    if (show) {
        loadingEl.classList.add('show');
    } else {
        loadingEl.classList.remove('show');
    }
}

function hideDropZone() {
    dropZone.classList.add('hidden');
}

function showDropZone() {
    dropZone.classList.remove('hidden');
}

function showFileInfo(fileName, fileSize) {
    fileNameEl.textContent = fileName;
    fileSizeEl.textContent = formatFileSize(fileSize);
    fileInfoEl.classList.remove('hidden');
}

function hideFileInfo() {
    fileInfoEl.classList.add('hidden');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'kB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Panel management functions
function toggleSidePanel() {
    const isCollapsed = sidePanelEl.classList.contains('collapsed');
    if (isCollapsed) {
        sidePanelEl.classList.remove('collapsed');
        viewerContainerEl.classList.remove('full-width');
        panelToggleIcon.textContent = '◀';
    } else {
        sidePanelEl.classList.add('collapsed');
        viewerContainerEl.classList.add('full-width');
        panelToggleIcon.textContent = '▶';
    }
    
    // Force viewer resize after panel animation with longer delay
    setTimeout(() => {
        if (viewer && viewer.canvas) {
            // Wait for CSS transition to fully complete and DOM to stabilize
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const containerEl = document.getElementById('viewer');
                    if (containerEl) {
                        const rect = containerEl.getBoundingClientRect();
                        console.log('Container dimensions:', Math.floor(rect.width), Math.floor(rect.height));
                        
                        // Force viewer to resize to container dimensions
                        if (viewer.SetSize && rect.width > 0 && rect.height > 0) {
                            viewer.SetSize(Math.floor(rect.width), Math.floor(rect.height));
                        }
                        
                        // Force a render
                        if (viewer.Render) {
                            viewer.Render();
                        }
                    }
                });
            });
        }
    }, 400); // Longer delay for CSS transition to complete
}

// Resizable side panel functionality
let isResizing = false;
let startX = 0;
let startWidth = 0;

// Disable resizing interactions (fixed width)
// Layer management functions
function populateLayerTable(layers) {
    if (!layers || layers.length === 0) {
        layerTableEl.innerHTML = '<div class="no-file">Load a file to view layers</div>';
        return;
    }
    
    const filteredLayers = layers.filter(layer => {
        const objectCount = layer.objectCount !== undefined ? layer.objectCount : getLayerObjectCount(layer.name || '');
        return objectCount > 0;
    });
    
    // Build simplified DXF table
    // Fixed order: Output, Color, ACI, Layer, →, Mapping
    const thead = '<tr><th>Output</th><th>Color</th><th>ACI</th><th>Layer</th><th>→</th><th>Mapping</th></tr>';
    const tbodyHtml = filteredLayers.map((layer, index) => {
        const layerName = layer.name || `Layer ${index}`;
        const displayName = layer.displayName || layerName;
        const hexColor = rgbToHex(layer.color || 0xffffff);
        // ACI (robust): prefer parsed DXF layer color/colorIndex; fallback to computed from hex
            let aciColor = '';
        try {
            const dxfLayer = viewer.parsedDxf?.tables?.layer?.layers?.[layerName];
            const tableAci = (typeof dxfLayer?.color === 'number') ? dxfLayer.color
                              : (typeof dxfLayer?.colorIndex === 'number') ? dxfLayer.colorIndex
                              : null;
            if (typeof tableAci === 'number') {
                aciColor = String(tableAci);
                    } else {
                // Compute from display hex as last resort
                const guessed = hexToACI(hexColor);
                if (typeof guessed === 'number' && !Number.isNaN(guessed)) aciColor = String(guessed);
            }
        } catch (_) {
            const guessed = hexToACI(hexColor);
            if (typeof guessed === 'number' && !Number.isNaN(guessed)) aciColor = String(guessed);
        }
        const mapped = !!layer.importFilterApplied && !!layer.lineTypeId;
        const ruleLtName = resolveMappedLineTypeName('dxf', `dxf|${layerName}|${aciColor || ''}`);
        const isMapped = !!ruleLtName || mapped;
        const lineTypeName = ruleLtName || (mapped ? getLineTypeName(layer.lineTypeId) : 'UNMAPPED');
        const mappedClass = isMapped ? 'mapped' : 'unmapped';
        const actionBtn = `<button class="btn btn-small btn-secondary edit-mapping-btn" data-layer-name="${layerName}" data-line-type="${layer.lineTypeId||''}" title="Open Mapping">→</button>`;
        return `
          <tr data-layer-index="${index}">
            <td><input type=\"checkbox\" class=\"layer-checkbox output-toggle ${mappedClass}\" id=\"layer-${index}\" checked data-layer-name=\"${layerName}\"></td>
            <td><span class=\"color-swatch\" style=\"background:${hexColor}\"></span></td>
            <td>${aciColor || '-'}</td>
            <td class=\"layer-name-cell\">${displayName}</td>
            <td>${actionBtn}</td>
            <td class=\"lt-name\">${lineTypeName}</td>
          </tr>`;
    }).join('');

    layerTableEl.innerHTML = `
      <div class="rules-table-container">
        <table class="rules-table" id="dxfLayerTable">
          <thead>${thead}</thead>
          <tbody>${tbodyHtml}</tbody>
        </table>
      </div>`;

    // Attach listeners
    filteredLayers.forEach((layer, index) => {
        const row = layerTableEl.querySelector(`tr[data-layer-index="${index}"]`);
        if (!row) return;
        const checkbox = row.querySelector('.layer-checkbox');
        checkbox?.addEventListener('change', (e) => {
            const lname = e.target.dataset.layerName;
            const isVisible = e.target.checked;
            if (layer.isColorVariant && layer.color) {
                toggleLayerColorVisibility(layer.parentLayer || lname.split('_')[0], layer.color, isVisible);
            } else {
                const actual = layer.parentLayer || lname;
                toggleLayerVisibility(actual, isVisible);
            }
        });
        const editBtn = row.querySelector('.edit-mapping-btn');
        if (editBtn) {
            editBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const lname = e.currentTarget.dataset.layerName;
                openMapLinePopup({
                    format: 'dxf',
                    fields: [
                        { label: 'Layer', value: lname },
                        { label: 'ACI', value: (viewer.parsedDxf?.tables?.layer?.layers?.[lname]?.color ?? '-') }
                    ],
                    rulePayload: { format: 'dxf', key: `dxf|${lname}|${viewer.parsedDxf?.tables?.layer?.layers?.[lname]?.color ?? ''}`, layerName: lname, aci: viewer.parsedDxf?.tables?.layer?.layers?.[lname]?.color ?? '' }
                }, `dxf|${lname}|${viewer.parsedDxf?.tables?.layer?.layers?.[lname]?.color ?? ''}`);
            });
        }
    });
    
    updateDrawingDimensions();

    // Make DXF headers resizable/auto-fit/sort only (no reordering)
    (function makeHeadersDraggable(tableId, storageKey){
        const table = document.getElementById(tableId);
        if (!table) return;
        const headRow = table.querySelector('thead tr');
        if (!headRow) return;
        const ths = Array.from(headRow.children);
        ths.forEach((th, i) => { if (!th.dataset.column) th.dataset.column = `col_${i}`; /* fixed order */ });
        const persistWidths = () => {
            const widths = {};
            Array.from(headRow.children).forEach((h, i) => widths[i] = h.offsetWidth + 'px');
            localStorage.setItem(storageKey + '_widths', JSON.stringify(widths));
        };
        const autoFit = (thIdx) => {
            const headCell = headRow.children[thIdx];
            const bodyRows = Array.from(table.tBodies[0]?.rows || []);
            let maxW = headCell ? headCell.scrollWidth : 0;
            const measureCell = (cell) => {
                if (!cell) return 0;
                const clone = cell.cloneNode(true);
                clone.style.width = 'auto';
                clone.style.position = 'absolute';
                clone.style.visibility = 'hidden';
                clone.style.whiteSpace = 'nowrap';
                document.body.appendChild(clone);
                const w = clone.scrollWidth;
                document.body.removeChild(clone);
                return w;
            };
            maxW = Math.max(maxW, ...bodyRows.map(r => measureCell(r.children[thIdx])));
            const target = Math.min(Math.max(60, maxW + 24), 600);
            if (headCell) headCell.style.width = target + 'px';
            bodyRows.forEach(r => { const c = r.children[thIdx]; if (c) c.style.width = target + 'px'; });
            persistWidths();
        };
        Array.from(headRow.children).forEach((th, idx) => {
            // Click to sort, double-click to auto-fit column
            th.addEventListener('click', () => sortByColumn(idx));
            th.addEventListener('dblclick', () => autoFit(idx));
            const resizer = document.createElement('div'); resizer.className = 'col-resizer'; th.appendChild(resizer); let startX=0,startW=0; resizer.addEventListener('mousedown', (e)=>{ startX = e.clientX; startW = th.offsetWidth; document.body.style.cursor = 'col-resize'; const onMove=(ev)=>{ const dx = ev.clientX - startX; th.style.width = Math.max(40, startW+dx)+'px'; }; const onUp=()=>{ document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor=''; persistWidths(); }; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); });
        });
        // restore widths if persisted
        try {
            const widths = JSON.parse(localStorage.getItem(storageKey + '_widths') || 'null');
            if (widths && typeof widths === 'object') {
                Array.from(headRow.children).forEach((th, i) => { const w = widths[i]; if (w) th.style.width = w; });
            }
        } catch {}
    })('dxfLayerTable', 'dxf_column_order');
}

function updateDrawingDimensions() {
    const dimensions = getDrawingDimensions();
    
    if (dimensions && drawingDimensionsEl && drawingUnitsEl && drawingInfoEl) {
        const userUnit = getUserUnitPreference();
        const scalingFactor = getScalingFactor();
        
        let displayDimensions = dimensions;
        let displayUnitName = dimensions.unitName;
        
        if (userUnit !== 'auto') {
            displayDimensions = convertDimensions(dimensions, userUnit);
            displayUnitName = displayDimensions.unitName;
        }
        
        // Show both original and scaled dimensions
        if (scalingFactor !== 1) {
            const scaledDimensions = getScaledDimensions();
            let displayScaledDimensions = scaledDimensions;
            
            if (userUnit !== 'auto') {
                displayScaledDimensions = convertDimensions(scaledDimensions, userUnit);
            }
            
            drawingDimensionsEl.innerHTML = `
                <div style="color: #ffffff; font-size: 0.9rem;">Original: ${formatDimensions(displayDimensions)}</div>
                <div style="color: #4a90e2; font-size: 0.85rem; margin-top: 2px;">Scaled (${scalingFactor}×): ${formatDimensions(displayScaledDimensions)}</div>
            `;
        } else {
            drawingDimensionsEl.textContent = formatDimensions(displayDimensions);
        }
        
        drawingUnitsEl.textContent = displayUnitName;
        drawingInfoEl.style.display = 'block';
        
        console.log('Drawing info updated:', {
            original: `${dimensions.width} × ${dimensions.height} ${dimensions.unit}`,
            displayed: formatDimensions(displayDimensions),
            scaled: scalingFactor !== 1 ? formatDimensions(getScaledDimensions()) : 'same',
            units: displayUnitName,
            userPreference: userUnit,
            scalingFactor
        });
    } else if (drawingInfoEl) {
        drawingInfoEl.style.display = 'none';
    }
    
    // Also update overall size
    updateOverallSize();
    
    // Update layer status summary
    updateLayerStatus();
}

// Unified formats (DDS/CFF2): show overall size as-is (no scaling)
function updateUnifiedDimensions() {
    try {
        const dimsEl = drawingDimensionsEl;
        const unitsEl = drawingUnitsEl;
        if (!dimsEl || !unitsEl) return;
        const geoms = window.unifiedGeometries || [];
        if (!geoms.length) {
            drawingInfoEl.style.display = 'none';
            return;
        }
        const b = getUnifiedBounds(geoms);
        if (!b) { drawingInfoEl.style.display = 'none'; return; }
        const w = Math.abs(b.maxX - b.minX);
        const h = Math.abs(b.maxY - b.minY);
        // CFF2 SCALE note: detect first SCALE record value if provided by parser
        let scaleNote = '';
        try {
            const s = geoms.find(g => g?.properties?.scale)?.properties?.scale;
            if (currentFileFormat !== 'dxf' && typeof s === 'number' && s !== 1) {
                scaleNote = ` (CFF2 SCALE: ${s})`;
            }
        } catch {}
        // Determine unit label per format
        let unit = 'unknown';
        let unitName = 'Unknown';
        if (currentFileFormat === 'dds') {
            const u = geoms.find(g => g.properties?.unitCode)?.properties?.unitCode || 'unknown';
            unit = u;
            if (unit === 'unknown') {
                const pref = getUserUnitPreference();
                if (pref === 'mm' || pref === 'in') unit = pref;
            }
            unitName = (u === 'mm' ? 'Millimeters' : (u === 'in' ? 'Inches' : 'Unknown'));
        } else if (currentFileFormat === 'cf2' || currentFileFormat === 'cff2') {
            const inf = inferUnitsFromGeometry(geoms);
            unit = inf.unit;
            if (unit === 'unknown') {
                const pref = getUserUnitPreference();
                if (pref === 'mm' || pref === 'in') unit = pref;
            }
            unitName = (unit === 'mm' ? 'Millimeters' : unit === 'in' ? 'Inches' : 'Unknown');
        }
        dimsEl.textContent = `${w.toFixed(3)} × ${h.toFixed(3)} ${unit}${scaleNote}`;
        unitsEl.textContent = unitName;
        drawingInfoEl.style.display = 'block';
    } catch {}
}

function rgbToHex(color) {
    // Convert numeric color to hex
    const hex = color.toString(16).padStart(6, '0');
    return `#${hex}`;
}
// Convert hex color to AutoCAD Color Index (ACI) - comprehensive mappings
function hexToACI(hex) {
    const colorMap = {
        // Standard ACI colors
        '#ff0000': 1,   // Red
        '#ffff00': 2,   // Yellow  
        '#00ff00': 3,   // Green
        '#00ffff': 4,   // Cyan
        '#0000ff': 5,   // Blue
        '#ff00ff': 6,   // Magenta
        '#ffffff': 7,   // White/Black
        '#000000': 7,   // Black (same as white in ACI)
        '#808080': 8,   // Gray
        '#c0c0c0': 9,   // Light Gray
        
        // Extended color mappings for common variations
        '#ff8080': 10,  // Light Red
        '#ffff80': 11,  // Light Yellow
        '#80ff80': 12,  // Light Green
        '#80ffff': 13,  // Light Cyan
        '#8080ff': 14,  // Light Blue
        '#ff80ff': 15,  // Light Magenta
        
        // More specific hex mappings from your DXF
        '#00ff7f': 4,   // Spring Green -> Cyan (closest match)
        '#009800': 3,   // Dark Green -> Green
        '#40ff40': 3,   // Bright Green -> Green
        '#008000': 3,   // Web Green -> Green
        '#32cd32': 3,   // Lime Green -> Green
        '#90ee90': 12,  // Light Green
        '#00fa9a': 4,   // Medium Spring Green -> Cyan
        
        // Additional common CAD colors
        '#800080': 6,   // Purple -> Magenta
        '#ffa500': 2,   // Orange -> Yellow (closest)
        '#a52a2a': 1,   // Brown -> Red (closest)
        '#964b00': 1,   // Dark Brown -> Red
    };
    
    const normalizedHex = hex.toLowerCase();
    
    // First check for exact matches
    if (colorMap[normalizedHex]) {
        return colorMap[normalizedHex];
    }
    
    // If no exact match, try to find the closest ACI color by RGB distance
    const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    };
    
    const aciColors = {
        1: { r: 255, g: 0, b: 0 },     // Red
        2: { r: 255, g: 255, b: 0 },   // Yellow
        3: { r: 0, g: 255, b: 0 },     // Green
        4: { r: 0, g: 255, b: 255 },   // Cyan
        5: { r: 0, g: 0, b: 255 },     // Blue
        6: { r: 255, g: 0, b: 255 },   // Magenta
        7: { r: 255, g: 255, b: 255 }, // White
        8: { r: 128, g: 128, b: 128 }, // Gray
    };
    const targetRgb = hexToRgb(normalizedHex);
    let closestAci = 7; // Default to white
    let minDistance = Infinity;
    
    for (const [aci, rgb] of Object.entries(aciColors)) {
        const distance = Math.sqrt(
            Math.pow(targetRgb.r - rgb.r, 2) +
            Math.pow(targetRgb.g - rgb.g, 2) +
            Math.pow(targetRgb.b - rgb.b, 2)
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            closestAci = parseInt(aci);
        }
    }
    
    return closestAci;
}

// Convert RGB color string to AutoCAD Color Index (ACI)
function rgbToACI(rgbString) {
    // Parse RGB string like "rgb(255,0,0)" or "0,255,0"
    let r, g, b;
    
    if (rgbString.startsWith('rgb(')) {
        const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            r = parseInt(match[1]);
            g = parseInt(match[2]);
            b = parseInt(match[3]);
        } else {
            return null;
        }
    } else if (rgbString.includes(',')) {
        const parts = rgbString.split(',').map(s => parseInt(s.trim()));
        if (parts.length === 3) {
            [r, g, b] = parts;
        } else {
            return null;
        }
    } else {
        return null;
    }
    
    // Convert RGB to hex first, then use hexToACI
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return hexToACI(hex);
}

function hexToRGBDisplay(hex) {
    // Convert hex color to RGB display format (r,g,b)
    if (!hex || typeof hex !== 'string') return null;
    
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Handle 3-digit hex
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }
    
    // Validate hex format
    if (hex.length !== 6 || !/^[0-9a-fA-F]+$/.test(hex)) {
        return null;
    }
    
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `${r},${g},${b}`;
}
function hexToRGB(hex) {
    // Convert hex color to RGB format
    if (!hex || typeof hex !== 'string') return null;
    
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Handle 3-digit hex
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }
    
    // Validate hex format
    if (hex.length !== 6 || !/^[0-9a-fA-F]+$/.test(hex)) {
        return null;
    }
    
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgb(${r},${g},${b})`;
}
function aciToRGB(aciNumber) {
    // Convert AutoCAD Color Index to RGB format
    const aciColors = {
        0: 'rgb(255,255,255)', // ByBlock - use white
        1: 'rgb(255,0,0)',     // Red
        2: 'rgb(255,255,0)',   // Yellow
        3: 'rgb(0,255,0)',     // Green
        4: 'rgb(0,255,255)',   // Cyan
        5: 'rgb(0,0,255)',     // Blue
        6: 'rgb(255,0,255)',   // Magenta
        7: 'rgb(255,255,255)', // White (or Black depending on background)
        8: 'rgb(128,128,128)', // Gray
        9: 'rgb(192,192,192)', // Light Gray
        10: 'rgb(255,0,0)',    // Red
        11: 'rgb(255,170,170)', // Light Red
        12: 'rgb(189,0,0)',    // Dark Red
        13: 'rgb(189,126,126)', // Medium Red
        14: 'rgb(129,0,0)',    // Dark Red
        15: 'rgb(129,86,86)',  // Dark Red
        16: 'rgb(104,0,0)',    // Very Dark Red
        17: 'rgb(104,69,69)',  // Very Dark Red
        18: 'rgb(79,0,0)',     // Very Dark Red
        19: 'rgb(79,53,53)',   // Very Dark Red
        20: 'rgb(255,63,0)',   // Orange Red
    };
    
    // For colors beyond the basic set, generate reasonable RGB values
    if (aciColors[aciNumber]) {
        return aciColors[aciNumber];
    }
    
    // For extended ACI colors (beyond 20), use a simple mapping
    if (aciNumber >= 1 && aciNumber <= 255) {
        // Generate colors based on position in spectrum
        const normalized = (aciNumber - 1) / 254; // Normalize to 0-1
        const hue = normalized * 360; // Full hue spectrum
        
        // Convert HSL to RGB (simple approximation)
        const hueToRgb = (h) => {
            h = h / 60;
            const c = 255; // Full saturation and lightness
            const x = c * (1 - Math.abs((h % 2) - 1));
            
            if (h < 1) return [c, x, 0];
            if (h < 2) return [x, c, 0];
            if (h < 3) return [0, c, x];
            if (h < 4) return [0, x, c];
            if (h < 5) return [x, 0, c];
            return [c, 0, x];
        };
        
        const [r, g, b] = hueToRgb(hue);
        return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
    }
    
    return null; // Unknown ACI value
}
// Convert ACI color index to hex for display only
function aciToHex(aci) {
    // Complete AutoCAD Color Index (ACI) to hex color mapping
    // This provides unique colors for all 256 ACI values
    const aciToHexMap = {
        // Standard AutoCAD colors (1-255)
        1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF', 5: '#0000FF',
        6: '#FF00FF', 7: '#FFFFFF', 8: '#808080', 9: '#C0C0C0', 10: '#800000',
        11: '#808000', 12: '#008000', 13: '#008080', 14: '#000080', 15: '#800080',
        16: '#FF0000', 17: '#FF7F00', 18: '#FFFF00', 19: '#7FFF00', 20: '#00FF00',
        21: '#00FF7F', 22: '#00FFFF', 23: '#007FFF', 24: '#0000FF', 25: '#7F00FF',
        26: '#FF00FF', 27: '#FF007F', 28: '#7F0000', 29: '#7F3F00', 30: '#7F7F00',
        31: '#3F7F00', 32: '#007F00', 33: '#007F3F', 34: '#007F7F', 35: '#003F7F',
        36: '#00007F', 37: '#3F007F', 38: '#7F007F', 39: '#7F003F', 40: '#590000',
        41: '#590059', 42: '#000059', 43: '#005959', 44: '#595900', 45: '#595959',
        46: '#7F0000', 47: '#7F007F', 48: '#00007F', 49: '#007F7F', 50: '#7F7F00',
        51: '#7F7F7F', 52: '#3F0000', 53: '#3F003F', 54: '#00003F', 55: '#003F3F',
        56: '#3F3F00', 57: '#3F3F3F', 58: '#1F0000', 59: '#1F001F', 60: '#00001F',
        61: '#001F1F', 62: '#1F1F00', 63: '#1F1F1F', 64: '#0F0000', 65: '#0F000F',
        66: '#00000F', 67: '#000F0F', 68: '#0F0F00', 69: '#0F0F0F', 70: '#FF4040',
        71: '#FF8040', 72: '#FFBF40', 73: '#FFFF40', 74: '#BFFF40', 75: '#80FF40',
        76: '#40FF40', 77: '#40FF80', 78: '#40FFBF', 79: '#40FFFF', 80: '#40BFFF',
        81: '#4080FF', 82: '#4040FF', 83: '#8040FF', 84: '#BF40FF', 85: '#FF40FF',
        86: '#FF4080', 87: '#FF4040', 88: '#FF6040', 89: '#FF8040', 90: '#FFA040',
        91: '#FFC040', 92: '#FFE040', 93: '#FFFF40', 94: '#E0FF40', 95: '#C0FF40',
        96: '#A0FF40', 97: '#80FF40', 98: '#60FF40', 99: '#40FF40', 100: '#40FF60',
        101: '#40FF80', 102: '#40FFA0', 103: '#40FFC0', 104: '#40FFE0', 105: '#40FFFF',
        106: '#40E0FF', 107: '#40C0FF', 108: '#40A0FF', 109: '#4080FF', 110: '#4060FF',
        111: '#4040FF', 112: '#6040FF', 113: '#8040FF', 114: '#A040FF', 115: '#C040FF',
        116: '#E040FF', 117: '#FF40FF', 118: '#FF40F0', 119: '#FF40E0', 120: '#FF40D0',
        121: '#FF40C0', 122: '#FF40B0', 123: '#FF40A0', 124: '#FF4090', 125: '#FF4080',
        126: '#FF4070', 127: '#FF4060', 128: '#FF4050', 129: '#FF4040', 130: '#FF4540',
        131: '#FF4A40', 132: '#FF4F40', 133: '#FF5440', 134: '#FF5940', 135: '#FF5E40',
        136: '#FF6340', 137: '#FF6840', 138: '#FF6D40', 139: '#FF7240', 140: '#FF7740',
        141: '#FF7C40', 142: '#FF8140', 143: '#FF8640', 144: '#FF8B40', 145: '#FF9040',
        146: '#FF9540', 147: '#FF9A40', 148: '#FF9F40', 149: '#FFA440', 150: '#FFA940',
        151: '#FFAE40', 152: '#FFB340', 153: '#FFB840', 154: '#FFBD40', 155: '#FFC240',
        156: '#FFC740', 157: '#FFCC40', 158: '#FFD140', 159: '#FFD640', 160: '#FFDB40',
        161: '#FFE040', 162: '#FFE540', 163: '#FFEA40', 164: '#FFEF40', 165: '#FFF440',
        166: '#FFF940', 167: '#FFFF40', 168: '#FAFF40', 169: '#F5FF40', 170: '#F0FF40',
        171: '#EBFF40', 172: '#E6FF40', 173: '#E1FF40', 174: '#DCFF40', 175: '#D7FF40',
        176: '#D2FF40', 177: '#CDFF40', 178: '#C8FF40', 179: '#C3FF40', 180: '#BEFF40',
        181: '#B9FF40', 182: '#B4FF40', 183: '#AFFF40', 184: '#AAFF40', 185: '#A5FF40',
        186: '#A0FF40', 187: '#9BFF40', 188: '#96FF40', 189: '#91FF40', 190: '#8CFF40',
        191: '#87FF40', 192: '#82FF40', 193: '#7DFF40', 194: '#78FF40', 195: '#73FF40',
        196: '#6EFF40', 197: '#6AFF40', 198: '#65FF40', 199: '#60FF40', 200: '#5BFF40',
        201: '#56FF40', 202: '#51FF40', 203: '#4CFF40', 204: '#47FF40', 205: '#42FF40',
        206: '#3DFF40', 207: '#38FF40', 208: '#33FF40', 209: '#2EFF40', 210: '#29FF40',
        211: '#24FF40', 212: '#1FFF40', 213: '#1AFF40', 214: '#15FF40', 215: '#10FF40',
        216: '#0BFF40', 217: '#06FF40', 218: '#01FF40', 219: '#00FF45', 220: '#00FF4A',
        221: '#00FF4F', 222: '#00FF54', 223: '#00FF59', 224: '#00FF5E', 225: '#00FF63',
        226: '#00FF68', 227: '#00FF6D', 228: '#00FF72', 229: '#00FF77', 230: '#00FF7C',
        231: '#00FF81', 232: '#00FF86', 233: '#00FF8B', 234: '#00FF90', 235: '#00FF95',
        236: '#00FF9A', 237: '#00FF9F', 238: '#00FFA4', 239: '#00FFAA', 240: '#00FFAF',
        241: '#00FFB4', 242: '#00FFB9', 243: '#00FFBE', 244: '#00FFC3', 245: '#00FFC8',
        246: '#00FFCD', 247: '#00FFD2', 248: '#00FFD7', 249: '#00FFDC', 250: '#00FFE1',
        251: '#00FFE6', 252: '#00FFEB', 253: '#00FFF0', 254: '#00FFF5', 255: '#0000FF',
        // Special colors for your specific DXF files
        38912: '#009800', // Green (specific to your DXF)
        65407: '#00FF7F', // Light Green (specific to your DXF)
        16776960: '#FFFF00', // Yellow (specific to your DXF)
        52224: '#00CC00', // Dark Green (specific to your DXF)
        12459565: '#BE1E2D', // Red variant (specific to your DXF)
        16225309: '#F7941D', // Orange variant (specific to your DXF)
        3027346: '#2E3192', // Blue variant (specific to your DXF)
        1865148: '#1C75BC', // Blue variant (specific to your DXF)
        2301728: '#231F20' // Dark variant (specific to your DXF)
    };
    
    // Handle standard ACI values (1-255)
    if (aciToHexMap[aci]) {
        return aciToHexMap[aci];
    }
    
    // Handle direct RGB color values (24-bit integers)
    if (typeof aci === 'number' && aci > 255) {
        // Convert RGB integer to hex string
        const hex = aci.toString(16).padStart(6, '0').toUpperCase();
        return `#${hex}`;
    }
    
    // Default to white if not found
    return '#FFFFFF';
}

// Get line type name from ID
function getLineTypeName(lineTypeId) {
    if (!lineTypeId) return '';
    
    // Line type ID to name mapping based on line-types.xml
    const lineTypeMap = {
        '1': '1pt CW',
        '2': '2pt CW', 
        '3': '3pt CW',
        '4': '4pt CW',
        '5': '2pt Puls',
        '6': '3pt Puls',
        '7': '4pt Puls',
        '8': '1.5pt CW',
        '9': '1pt Puls',
        '10': '1.5pt Puls',
        '11': 'Fast Engrave',
        '12': 'Fine Cut Pulse',
        '13': 'Fine Cut CW',
        '14': '2pt Bridge',
        '15': '3pt Bridge',
        '16': '4pt Bridge',
        '17': 'Nozzle Engrave',
        '18': 'Groove',
        '19': 'Cut CW',
        '20': 'Pulse_1',
        '21': 'Pulse_2',
        '22': 'Engrave',
        '23': 'Milling 1',
        '24': 'Milling 2',
        '25': 'Milling 3',
        '26': 'Milling 4',
        '27': 'Milling 5',
        '28': 'Milling 6',
        '29': 'Milling 7',
        '30': 'Milling 8'
    };
    
    return lineTypeMap[lineTypeId.toString()] || `Line Type ${lineTypeId}`;
}
function lineweightToPoints(lineweight) {
    // Convert DXF lineweight (hundredths of mm) to points
    // 1 point = 0.352778 mm, so 1 mm = 2.834646 points
    // DXF lineweight is in 100th of mm
    if (lineweight === undefined || lineweight === null) return null;
    if (lineweight === -1) return 'BYBLOCK';
    if (lineweight === -2) return 'BYLAYER';
    if (lineweight === -3) return 'STANDARD';
    
    const mm = lineweight / 100; // Convert hundredths of mm to mm
    const points = mm * 2.834646; // Convert mm to points
    return Math.round(points * 100) / 100; // Round to 2 decimal places
}

function formatLineweights(lineweights) {
    if (!lineweights || lineweights.length === 0) return null; // Return null instead of empty string
    
    const pointWeights = lineweights
        .map(lw => lineweightToPoints(lw))
        .filter(lw => lw !== null)
        .sort((a, b) => {
            // Handle string values (BYBLOCK, etc.)
            if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
            if (typeof a === 'string') return 1;
            if (typeof b === 'string') return -1;
            return a - b;
        });
    
    if (pointWeights.length === 0) return null;
    if (pointWeights.length === 1) return `${pointWeights[0]}pt`;
    
    return `${pointWeights[0]}-${pointWeights[pointWeights.length - 1]}pt`;
}

function getDefaultLineweightForLayer(layerName) {
    // Provide reasonable default lineweights based on typical CAD layer naming conventions
    const layerUpper = layerName.toUpperCase();
    
    if (layerUpper.includes('GRIP') || layerUpper.includes('HANDLE')) return '0.25pt';
    if (layerUpper.includes('TEXT') || layerUpper.includes('NAME')) return '0.35pt';
    if (layerUpper.includes('DIM') || layerUpper.includes('DIMENSION')) return '0.25pt';
    if (layerUpper.includes('OUTLINE') || layerUpper.includes('BORDER')) return '0.70pt';
    if (layerUpper.includes('HEAVY') || layerUpper.includes('BOLD')) return '1.40pt';
    
    // Default lineweight for standard drawing entities
    return '0.50pt';
}

function dxfColorToRgb(colorIndex) {
    // DXF standard color palette (simplified version)
    const dxfColors = {
        0: { r: 0, g: 0, b: 0 },       // Black
        1: { r: 255, g: 0, b: 0 },     // Red
        2: { r: 255, g: 255, b: 0 },   // Yellow
        3: { r: 0, g: 255, b: 0 },     // Green
        4: { r: 0, g: 255, b: 255 },   // Cyan
        5: { r: 0, g: 0, b: 255 },     // Blue
        6: { r: 255, g: 0, b: 255 },   // Magenta
        7: { r: 255, g: 255, b: 255 }, // White
        8: { r: 128, g: 128, b: 128 }, // Gray
        9: { r: 192, g: 192, g: 192 }  // Light Gray
    };
    
    return dxfColors[colorIndex] || { r: 255, g: 255, b: 255 }; // Default to white
}
function getLayerObjectCount(layerName) {
    // First try to get entity count from extracted layer data (most accurate)
    if (window.extractedLayerData && window.extractedLayerData.has(layerName)) {
        return window.extractedLayerData.get(layerName).entities.length;
    }
    
    // Fallback: try the viewer's layer system (but this counts rendered objects, not entities)
    if (viewer && viewer.layers.has(layerName)) {
        const layer = viewer.layers.get(layerName);
        return layer && layer.objects ? layer.objects.length : 0;
    }
    
    return 0;
}

// Advanced geometry analysis and layer management
function enhanceColorDataFromRenderedGeometry() {
    if (!viewer || !viewer.scene || !window.extractedLayerData) return;
    
    console.log('Enhancing color data from rendered Three.js geometry...');
    
    const colorCounts = new Map();
    
    viewer.scene.traverse((object) => {
        if (object.material && object.material.color) {
            const color = object.material.color;
            const colorHex = color.getHex();
            
            if (!colorCounts.has(colorHex)) {
                colorCounts.set(colorHex, 0);
            }
            colorCounts.set(colorHex, colorCounts.get(colorHex) + 1);
            
            // Try to map this to a layer
            if (object.userData && object.userData.layer) {
                const layerName = object.userData.layer;
                if (window.extractedLayerData.has(layerName)) {
                    window.extractedLayerData.get(layerName).colors.add(colorHex);
                    window.extractedLayerData.get(layerName).colorDetails.set(colorHex, {
                        type: 'ThreeJS',
                        value: colorHex,
                        source: 'rendered_geometry'
                    });
                }
            }
        }
    });
    
    console.log('Colors found in rendered geometry:', Array.from(colorCounts.entries()).map(([color, count]) => 
        `#${color.toString(16).padStart(6, '0').toUpperCase()} (${count} objects)`
    ));
    
    // If we found additional colors, refresh the layer display
    if (colorCounts.size > 0) {
        console.log('Found additional colors from rendered geometry, refreshing layer display...');
        // You might want to trigger a layer table refresh here
    }
}

function analyzeViewerGeometry() {
    if (!viewer || !viewer.scene) return;
    
    console.log('Analyzing viewer geometry structure...');
    console.log('Viewer scene:', viewer.scene);
    console.log('Scene children:', viewer.scene.children);
    
    // Map Three.js scene objects to our layer data
    window.geometryLayerMap = new Map();
    
    // Traverse the scene to find renderable objects
    viewer.scene.traverse((object) => {
        if (object.geometry && object.material) {
            console.log('Found geometry object:', object);
            console.log('Object userData:', object.userData);
            
            // Try to map geometry to layers based on material or other properties
            if (object.userData && object.userData.layer) {
                const layerName = object.userData.layer;
                if (!window.geometryLayerMap.has(layerName)) {
                    window.geometryLayerMap.set(layerName, []);
                }
                window.geometryLayerMap.get(layerName).push(object);
            }
        }
    });
    
    console.log('Geometry layer mapping:', window.geometryLayerMap);
}
function toggleLayerVisibility(layerName, isVisible) {
    if (!viewer) return;
    // Debug: log all layer names in viewer
    console.log('Viewer layers:', Array.from(viewer.layers.keys()));
    // Debug: log all objects in the layer
    if (viewer.layers.has(layerName)) {
        const layer = viewer.layers.get(layerName);
        console.log(`Toggling layer: ${layerName}, isVisible: ${isVisible}`);
        console.log('Layer objects:', layer.objects);
        layer.objects.forEach(obj => {
            console.log(`Setting object visible:`, obj, 'to', isVisible);
            obj.visible = isVisible;
        });
        viewer.Render();
        showStatus(`Layer "${layerName}" ${isVisible ? 'shown' : 'hidden'}`);
        return;
    }
    // Store layer visibility state
    if (!window.layerVisibility) {
        window.layerVisibility = new Map();
    }
    window.layerVisibility.set(layerName, isVisible);
    // Try to toggle geometry visibility directly
    if (window.geometryLayerMap && window.geometryLayerMap.has(layerName)) {
        const objects = window.geometryLayerMap.get(layerName);
        objects.forEach(obj => {
            console.log(`Direct geometry map: Setting object visible:`, obj, 'to', isVisible);
            obj.visible = isVisible;
        });
        if (viewer.Render) viewer.Render();
        showStatus(`Layer "${layerName}" ${isVisible ? 'shown' : 'hidden'}`);
        return;
    }
    // Fallback: Try to filter by material or other properties
    if (viewer.scene && window.extractedLayerData && window.extractedLayerData.has(layerName)) {
        console.log(`Attempting advanced layer filtering for: ${layerName}`);
        const layerData = window.extractedLayerData.get(layerName);
        const layerColors = Array.from(layerData.colors);
        let toggledCount = 0;
        console.log(`Looking for colors:`, layerColors, `for layer: ${layerName}`);
        const materialInfo = [];
        viewer.scene.traverse((object) => {
            if (object.material) {
                materialInfo.push({
                    type: object.material.type,
                    color: object.material.color,
                    vertexColors: object.material.vertexColors,
                    properties: Object.keys(object.material),
                    geometry: object.geometry ? {
                        type: object.geometry.type,
                        attributes: Object.keys(object.geometry.attributes || {}),
                        hasColors: !!(object.geometry.attributes && object.geometry.attributes.color)
                    } : null
                });
            }
        });
        console.log(`Material info summary:`, materialInfo);
        viewer.scene.traverse((object) => {
            if (object.material && object.material.color) {
                const objectColor = object.material.color.getHex();
                const matchesColor = layerColors.some(layerColor => {
                    if (layerColor === objectColor) return true;
                    if (typeof layerColor === 'number' && layerColor < 256) {
                        const dxfRgb = dxfColorToRgb(layerColor);
                        const dxfHex = (dxfRgb.r << 16) | (dxfRgb.g << 8) | dxfRgb.b;
                        if (dxfHex === objectColor) return true;
                    }
                    return false;
                });
                if (matchesColor) {
                    object.visible = isVisible;
                    toggledCount++;
                }
            }
        });
        if (viewer.Render) viewer.Render();
        if (toggledCount > 0) {
            showStatus(`Layer "${layerName}" ${isVisible ? 'shown' : 'hidden'} (${toggledCount} objects)`);
        } else {
            showStatus(`Layer "${layerName}" toggle attempted (advanced filtering in progress)`);
        }
        return;
    }
    showStatus(`Layer "${layerName}" not found`);
}
function toggleColorVisibility(color, isVisible) {
    if (!viewer || !viewer.scene) return;
    
    console.log(`Toggling color visibility: ${color}, isVisible: ${isVisible}`);
    
    // Support both string and number color values
    let hexColor;
    if (typeof color === 'string') {
        hexColor = color.startsWith('#') ? color : `#${color}`;
    } else if (typeof color === 'number') {
        hexColor = '#' + color.toString(16).padStart(6, '0');
    } else {
        hexColor = '#000000'; // fallback
    }
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    
    console.log(`Looking for RGB color: r=${r}, g=${g}, b=${b}`);
    
    let foundObjects = 0;
    
    viewer.scene.traverse((object) => {
        // Check for RawShaderMaterial with color uniform
        if (object.material && object.material.type === 'RawShaderMaterial' && object.material.uniforms && object.material.uniforms.color) {
            const uniformColor = object.material.uniforms.color.value;
            
            // Check if this is a Three.js Color object
            if (uniformColor && uniformColor.isColor) {
                const objR = uniformColor.r;
                const objG = uniformColor.g;
                const objB = uniformColor.b;
                
                // Compare RGB values with tolerance
                if (Math.abs(objR - r) < 0.01 && Math.abs(objG - g) < 0.01 && Math.abs(objB - b) < 0.01) {
                    object.visible = isVisible;
                    foundObjects++;
                    console.log(`Found matching color object: ${object.type} with RGB(${objR.toFixed(3)}, ${objG.toFixed(3)}, ${objB.toFixed(3)})`);
                }
            }
        }
    });
    
    if (viewer.Render) {
        viewer.Render();
    }
    
    if (foundObjects > 0) {
        showStatus(`Color ${color} ${isVisible ? 'shown' : 'hidden'} (${foundObjects} objects)`);
    } else {
        showStatus(`No objects found with color ${color}`);
    }
}

// Background Color Management
function getBackgroundColorFromSlider(sliderValue) {
    // Convert slider value (0-100) to color
    // 0 = black, 100 = white, with gray interpolation
    const intensity = sliderValue / 100;
    const colorValue = Math.round(intensity * 255);
    return new THREE.Color(`rgb(${colorValue}, ${colorValue}, ${colorValue})`);
}

function getSavedBackgroundColor() {
    // Get saved background color value from localStorage (default to 95 for light gray)
    return parseInt(localStorage.getItem('backgroundColorValue') || '95');
}

function saveBackgroundColor(value) {
    localStorage.setItem('backgroundColorValue', value.toString());
}

function updateBackgroundColor(sliderValue) {
    // Compute CSS fallback color
    const intensity = sliderValue / 100;
    const colorValue = Math.round(intensity * 255);
    const cssColor = `rgb(${colorValue}, ${colorValue}, ${colorValue})`;

    // Apply to Three.js viewer if present
    if (viewer && viewer.renderer) {
        const color = getBackgroundColorFromSlider(sliderValue);
        viewer.renderer.setClearColor(color);
        viewer.options.clearColor = color;
        viewer.clearColor = color.getHex();
        if (viewer.HasRenderer()) {
            viewer.Render();
        }
    }

    // Always apply CSS background so unified overlay and pre-viewer state reflect slider
    if (viewerEl) {
        try {
            viewerEl.style.background = cssColor;
            viewerEl.style.backgroundColor = cssColor;
        } catch {}
    }
}

function initBackgroundColorSlider() {
    const slider = document.getElementById('bgColorSlider');
    if (!slider) return;
    
    // Load saved value
    const savedValue = getSavedBackgroundColor();
    slider.value = savedValue;
    
    // Apply initial background color
    updateBackgroundColor(savedValue);
    
    // Add event listener for real-time updates
    slider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        updateBackgroundColor(value);
        saveBackgroundColor(value);
    });
}
// Canvas control utilities
let controlsInitialized = false;
function initCanvasControls() {
    if (controlsInitialized) return;
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const panUpBtn = document.getElementById('panUpBtn');
    const panLeftBtn = document.getElementById('panLeftBtn');
    const panRightBtn = document.getElementById('panRightBtn');
    const panDownBtn = document.getElementById('panDownBtn');
    const fitToViewBtn = document.getElementById('fitToViewBtn');
    
    // Helper functions for overlay (DDS/CFF2)
    function overlayZoomAtCenter(factor) {
        ensureOverlayCanvas();
        if (!overlayCanvas) return;
        const mx = overlayCanvas.width / 2;
        const my = overlayCanvas.height / 2;
        const model = canvasToModel(mx, my);
        const newScale = Math.max(0.0001, Math.min(1000, overlayView.scale * factor));
        overlayView.scale = newScale;
        overlayView.offsetX = mx - model.x * newScale;
        overlayView.offsetY = my + model.y * newScale;
        drawOverlay();
    }
    function overlayPan(dxPx, dyPx) {
        ensureOverlayCanvas();
        if (!overlayCanvas) return;
        overlayView.offsetX += dxPx;
        overlayView.offsetY += dyPx;
        drawOverlay();
    }
    function getOverlayPanPixels() {
        ensureOverlayCanvas();
        const base = Math.max(overlayCanvas?.width || 0, overlayCanvas?.height || 0);
        return Math.max(5, Math.floor(base * 0.04));
    }

    // Helper for viewer (DXF)
    const controls = viewer?.controls;
    const camera = viewer?.camera;
    const zoomFactor = 1.15; // Slightly reduced zoom factor for smoother zooming
    
    // Smart pan distance calculation based on drawing size (DXF)
    function getViewerPanDistance() {
        if (!viewer || !viewer.bounds) return 5;
        try {
            let bounds = viewer._originalBounds || viewer.GetBounds?.() || viewer.bounds;
            if (!bounds) return 5;
            const drawingWidth = Math.abs(bounds.maxX - bounds.minX);
            const drawingHeight = Math.abs(bounds.maxY - bounds.minY);
            const drawingSize = Math.max(drawingWidth, drawingHeight);
            const basePanDistance = drawingSize * 0.04;
            const zoomAdjustment = Math.max(0.1, Math.min(2.0, 1 / (camera?.zoom || 1)));
            return Math.max(0.1, Math.min(drawingSize * 0.1, basePanDistance * zoomAdjustment));
        } catch { return 5; }
    }
    
    // Zoom controls
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            if (currentFileFormat === 'dds' || currentFileFormat === 'cf2' || currentFileFormat === 'cff2') {
                overlayZoomAtCenter(zoomFactor);
                return;
            }
            if (viewer && camera && controls) {
                camera.zoom *= zoomFactor;
                camera.updateProjectionMatrix();
                controls.update();
                viewer.Render();
            }
        });
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            if (currentFileFormat === 'dds' || currentFileFormat === 'cf2' || currentFileFormat === 'cff2') {
                overlayZoomAtCenter(1 / zoomFactor);
                return;
            }
            if (viewer && camera && controls) {
                camera.zoom /= zoomFactor;
                camera.updateProjectionMatrix();
                controls.update();
                viewer.Render();
            }
        });
    }
    
    // Pan controls with smart distance calculation
    if (panUpBtn) {
        panUpBtn.addEventListener('click', () => {
            if (currentFileFormat === 'dds' || currentFileFormat === 'cf2' || currentFileFormat === 'cff2') {
                overlayPan(0, -getOverlayPanPixels());
                return;
            }
            if (viewer && camera && controls) {
                const panDistance = getViewerPanDistance();
            const target = controls.target.clone();
            target.y += panDistance;
            controls.target.copy(target);
            camera.position.y += panDistance;
            controls.update();
            viewer.Render();
            }
        });
    }
    if (panDownBtn) {
        panDownBtn.addEventListener('click', () => {
            if (currentFileFormat === 'dds' || currentFileFormat === 'cf2' || currentFileFormat === 'cff2') {
                overlayPan(0, getOverlayPanPixels());
                return;
            }
            if (viewer && camera && controls) {
                const panDistance = getViewerPanDistance();
            const target = controls.target.clone();
            target.y -= panDistance;
            controls.target.copy(target);
            camera.position.y -= panDistance;
            controls.update();
            viewer.Render();
            }
        });
    }
    
    if (panLeftBtn) {
        panLeftBtn.addEventListener('click', () => {
            if (currentFileFormat === 'dds' || currentFileFormat === 'cf2' || currentFileFormat === 'cff2') {
                overlayPan(-getOverlayPanPixels(), 0);
                return;
            }
            if (viewer && camera && controls) {
                const panDistance = getViewerPanDistance();
            const target = controls.target.clone();
            target.x -= panDistance;
            controls.target.copy(target);
            camera.position.x -= panDistance;
            controls.update();
            viewer.Render();
            }
        });
    }
    
    if (panRightBtn) {
        panRightBtn.addEventListener('click', () => {
            if (currentFileFormat === 'dds' || currentFileFormat === 'cf2' || currentFileFormat === 'cff2') {
                overlayPan(getOverlayPanPixels(), 0);
                return;
            }
            if (viewer && camera && controls) {
                const panDistance = getViewerPanDistance();
            const target = controls.target.clone();
            target.x += panDistance;
            controls.target.copy(target);
            camera.position.x += panDistance;
            controls.update();
            viewer.Render();
            }
        });
    }
    
    // Fit to view control
    if (fitToViewBtn) {
        fitToViewBtn.addEventListener('click', () => {
            if (currentFileFormat === 'dds' || currentFileFormat === 'cf2' || currentFileFormat === 'cff2') {
                ensureOverlayCanvas();
                fitOverlayView();
                return;
            }
            if (viewer && viewer.bounds && viewer.origin) {
                const bounds = viewer.bounds;
                const origin = viewer.origin;
                viewer.FitView(
                    bounds.minX - origin.x, 
                    bounds.maxX - origin.x,
                    bounds.minY - origin.y, 
                    bounds.maxY - origin.y
                );
                viewer.Render();
            }
        });
    }
    controlsInitialized = true;
}

// Update layer status summary
function updateLayerStatus() {
    if (!currentLayerData) return;
    
    const totalLayers = currentLayerData.length;
    const mappedLayers = currentLayerData.filter(layer => layer.importFilterApplied || layer.lineType).length;
    const unmappedLayers = totalLayers - mappedLayers;
    const unmappedLayerNames = currentLayerData
        .filter(layer => !layer.importFilterApplied && !layer.lineType)
        .map(layer => layer.name);
    
    // IMPORTANT: Also calculate visible AND mapped layers for accurate DIN generation readiness
    let visibleMappedLayers = 0;
    let readyForGeneration = true;
    let generationBlockers = [];
    
    currentLayerData.forEach((layer, index) => {
        const isVisible = document.getElementById(`layer-${index}`)?.checked || false;
        const isMapped = layer.importFilterApplied || layer.lineType;
        
        if (isVisible && isMapped) {
            visibleMappedLayers++;
        }
        
        if (!isMapped) {
            readyForGeneration = false;
            if (!generationBlockers.includes('unmapped layers')) {
                generationBlockers.push('unmapped layers');
            }
        }
    });
    
    // Check if we have visible mapped layers
    if (visibleMappedLayers === 0 && mappedLayers > 0) {
        readyForGeneration = false;
        generationBlockers.push('no visible layers');
    }
    
    // Dispatch event for header controls with enhanced status
    const mappingStatusEvent = new CustomEvent('mappingStatusUpdated', {
        detail: {
            totalLayers,
            mappedLayers,
            unmappedLayers,
            unmappedLayerNames,
            visibleMappedLayers,
            readyForGeneration,
            generationBlockers
        }
    });
    document.dispatchEvent(mappingStatusEvent);
}

// Unified (DDS/CFF2) mapping status for header controls
function updateUnifiedMappingStatus() {
    const isUnified = (currentFileFormat === 'dds' || currentFileFormat === 'cf2' || currentFileFormat === 'cff2');
    if (!isUnified) return;
    if (!overlayGroups || Object.keys(overlayGroups).length === 0) return;

    const keys = Object.keys(overlayGroups);
    const fmt = currentFileFormat === 'dds' ? 'dds' : 'cff2';

    let totalLayers = keys.length;
    let mappedLayers = 0;
    let noOutputLayers = 0;
    let unmappedLayerNames = [];
    let noOutputLayerNames = [];
    let visibleMappedLayers = 0;
    let readyForGeneration = true;
    const generationBlockers = [];

    for (const k of keys) {
        const entry = exactRulesCache.get(`${fmt}|${k}`);
        const hasEnabledMapping = !!(entry && entry.enabled && entry.lineTypeId);
        const isNoOutputRule = !!(entry && entry.lineTypeId && entry.enabled === false);
        
        if (hasEnabledMapping) {
            mappedLayers++;
        } else if (isNoOutputRule) {
            noOutputLayers++;
            // Build a user-friendly name from key for NO OUTPUT layers
            let display = k;
            try {
                if (fmt === 'dds') {
                    const [color, rawKerf, unit] = k.split('|');
                    const pt = (unit==='in' ? Number(rawKerf||0)*72 : unit==='mm' ? Number(rawKerf||0)/25.4*72 : Number(rawKerf||0));
                    display = `${pt.toFixed(2)} pt · color ${color}`;
                } else {
                    const parts = k.split('-');
                    const pen = parts[0] ?? '';
                    const layer = parts.slice(1).join('-');
                    display = `${Number(pen||0).toFixed(2)} pt · ${layer}`;
                }
            } catch {}
            noOutputLayerNames.push(display);
        } else {
            // Build a user-friendly name from key for unmapped layers
            let display = k;
            try {
                if (fmt === 'dds') {
                    const [color, rawKerf, unit] = k.split('|');
                    const pt = (unit==='in' ? Number(rawKerf||0)*72 : unit==='mm' ? Number(rawKerf||0)/25.4*72 : Number(rawKerf||0));
                    display = `${pt.toFixed(2)} pt · color ${color}`;
                } else {
                    const parts = k.split('-');
                    const pen = parts[0] ?? '';
                    const layer = parts.slice(1).join('-');
                    display = `${Number(pen||0).toFixed(2)} pt · ${layer}`;
                }
            } catch {}
            unmappedLayerNames.push(display);
        }

        // Visibility gating – visible items must have enabled mapping
        const isVisible = !!overlayGroups[k]?.visible;
        if (isVisible) {
            if (hasEnabledMapping) {
                visibleMappedLayers++;
            } else {
                readyForGeneration = false;
                if (!generationBlockers.includes('unmapped layers')) {
                    generationBlockers.push('unmapped layers');
                }
            }
        }
    }

    if (visibleMappedLayers === 0 && mappedLayers > 0) {
        readyForGeneration = false;
        generationBlockers.push('no visible layers');
    }

    const unmappedLayers = totalLayers - mappedLayers - noOutputLayers;

    const evt = new CustomEvent('mappingStatusUpdated', {
        detail: {
            totalLayers,
            mappedLayers,
            unmappedLayers,
            noOutputLayers,
            unmappedLayerNames,
            noOutputLayerNames,
            visibleMappedLayers,
            readyForGeneration,
            generationBlockers
        }
    });
    document.dispatchEvent(evt);
}
// Layer validation and warning functions
function validateLayerMappings() {
    // Handle DXF files (using currentLayerData)
    if (typeof currentLayerData !== 'undefined' && currentLayerData) {
        return validateDxfLayerMappings();
    }
    
    // Handle unified formats (CFF2/DDS) using overlayGroups
    if (typeof overlayGroups !== 'undefined' && overlayGroups && Object.keys(overlayGroups).length > 0) {
        return validateUnifiedLayerMappings();
    }
    
    // No data available
    return { valid: false, warnings: [], unmappedLayers: [], hiddenLayers: [], includedLayers: [] };
}

function validateDxfLayerMappings() {
    if (!currentLayerData) return { valid: true, warnings: [] };
    
    // Aggregate layers by name, prioritize unmapped over hidden
    const layerMap = new Map();
    const includedLayers = [];
    
    currentLayerData.forEach((layer, index) => {
        const layerName = layer.parentLayer || layer.name;
        const isVisible = document.getElementById(`layer-${index}`)?.checked || false;
        const objectCount = layer.objectCount !== undefined ? layer.objectCount : (layer.objects ? layer.objects.length : 0);
        
        // If unmapped, add or update in map
        if (!layer.importFilterApplied && !layer.lineType) {
            layerMap.set(layerName, {
                name: layerName,
                color: layer.color,
                objectCount,
                type: 'unmapped'
            });
        } else if (!isVisible && !layerMap.has(layerName)) {
            // Only add hidden if not already unmapped
            layerMap.set(layerName, {
                name: layerName,
                objectCount,
                type: 'hidden'
            });
        } else if (isVisible && (layer.importFilterApplied || layer.lineType)) {
            // Layer is visible and mapped - will be included in output
            const existingIncluded = includedLayers.find(l => l.name === layerName);
            if (existingIncluded) {
                existingIncluded.objectCount += objectCount;
            } else {
                includedLayers.push({
                    name: layerName,
                    objectCount,
                    type: 'included'
                });
            }
        }
    });
    
    // Split back into unmapped and hidden
    const unmappedLayers = [];
    const hiddenLayers = [];
    for (const layer of layerMap.values()) {
        if (layer.type === 'unmapped') {
            unmappedLayers.push(layer);
        } else if (layer.type === 'hidden') {
            hiddenLayers.push(layer);
        }
    }
    
    // Generate warnings
    const warnings = [];
    if (unmappedLayers.length > 0) {
        warnings.push({
            type: 'unmapped',
            count: unmappedLayers.length,
            layers: unmappedLayers,
            message: `${unmappedLayers.length} layer(s) are unmapped and will be skipped during DIN generation`
        });
    }
    if (hiddenLayers.length > 0) {
        warnings.push({
            type: 'hidden',
            count: hiddenLayers.length,
            layers: hiddenLayers,
            message: `${hiddenLayers.length} layer(s) are hidden and will be excluded from processing`
        });
    }
    
    return {
        valid: unmappedLayers.length === 0 && includedLayers.length > 0,  // Valid if all layers are mapped AND at least one layer is visible
        warnings,
        unmappedLayers,
        hiddenLayers,
        includedLayers
    };
}

function validateUnifiedLayerMappings() {
    if (!overlayGroups || Object.keys(overlayGroups).length === 0) {
        return { valid: false, warnings: [], unmappedLayers: [], hiddenLayers: [], includedLayers: [] };
    }
    
    const keys = Object.keys(overlayGroups);
    const fmt = currentFileFormat === 'dds' ? 'dds' : 'cff2';
    
    const unmappedLayers = [];
    const hiddenLayers = [];
    const includedLayers = [];
    const warnings = [];
    
    for (const key of keys) {
        const entry = exactRulesCache.get(`${fmt}|${key}`);
        const isVisible = overlayGroups[key]?.visible !== false;
        const isMapped = !!(entry && entry.enabled && entry.lineTypeId);
        
        // Build a user-friendly name from key
        let displayName = key;
        try {
            if (fmt === 'dds') {
                const [color, rawKerf, unit] = key.split('|');
                const pt = (unit==='in' ? Number(rawKerf||0)*72 : unit==='mm' ? Number(rawKerf||0)/25.4*72 : Number(rawKerf||0));
                displayName = `${pt.toFixed(2)} pt · color ${color}`;
            } else {
                const parts = key.split('-');
                const pen = parts[0] ?? '';
                const layer = parts.slice(1).join('-');
                displayName = `${Number(pen||0).toFixed(2)} pt · ${layer}`;
            }
        } catch {}
        
        if (!isMapped) {
            unmappedLayers.push({
                name: displayName,
                objectCount: 1, // Each key represents one layer/group
                type: 'unmapped'
            });
        } else if (!isVisible) {
            hiddenLayers.push({
                name: displayName,
                objectCount: 1,
                type: 'hidden'
            });
        } else {
            includedLayers.push({
                name: displayName,
                objectCount: 1,
                type: 'included'
            });
        }
    }
    
    // Generate warnings
    if (unmappedLayers.length > 0) {
        warnings.push({
            type: 'unmapped',
            count: unmappedLayers.length,
            layers: unmappedLayers,
            message: `${unmappedLayers.length} layer(s) are unmapped and will be skipped during DIN generation`
        });
    }
    if (hiddenLayers.length > 0) {
        warnings.push({
            type: 'hidden',
            count: hiddenLayers.length,
            layers: hiddenLayers,
            message: `${hiddenLayers.length} layer(s) are hidden and will be excluded from processing`
        });
    }
    
    return {
        valid: unmappedLayers.length === 0 && includedLayers.length > 0,
        warnings,
        unmappedLayers,
        hiddenLayers,
        includedLayers
    };
}
function showLayerValidationWarning(validation) {
    if (validation.warnings.length === 0) return;
    
    let warningContent = '';
    let successContent = '';
    let totalSkipped = 0;
    let totalIncluded = 0;
    
    // Show layers that will be excluded (warnings)
    validation.warnings.forEach(warning => {
        warningContent += `
            <div class="warning-section">
                <div class="warning-header">
                    <span class="warning-icon">⚠️</span>
                    <span class="warning-title">${warning.message}</span>
                </div>
                <div class="warning-details">
                    ${warning.layers.map(layer => {
                        totalSkipped += layer.objectCount;
                        return `<div class="warning-layer">
                            <span class="layer-name">${layer.name}</span>
                            <span class="object-count">${layer.objectCount} objects</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    });
    
    // Show layers that will be included (success)
    if (validation.includedLayers && validation.includedLayers.length > 0) {
        validation.includedLayers.forEach(layer => {
            totalIncluded += layer.objectCount;
        });
        
        successContent = `
            <div class="success-section">
                <div class="success-header">
                    <span class="success-icon">✅</span>
                    <span class="success-title">${validation.includedLayers.length} layer(s) will be included in DIN generation</span>
                </div>
                <div class="success-details">
                    ${validation.includedLayers.map(layer => `
                        <div class="success-layer">
                            <span class="layer-name">${layer.name}</span>
                            <span class="object-count">${layer.objectCount} objects</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    const modalHTML = `
        <div id="layerValidationModal" class="modal" style="display: flex;">
            <div class="modal-content validation-modal">
                <div class="modal-header">
                    <h3>Layer Processing Warning</h3>
                    <button class="modal-close" onclick="closeLayerValidationModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="validation-summary">
                        <p><strong>${totalSkipped} objects</strong> will be excluded from DIN generation.</p>
                    </div>
                    ${warningContent}
                    ${successContent}
                    <div class="validation-actions">
                        <p>Do you want to continue with DIN generation?</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeLayerValidationModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="proceedWithDinGeneration()">Continue Anyway</button>
                    <button class="btn btn-success" onclick="fixLayerMappings()">Fix Mappings</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.getElementById('layerValidationModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function showLayerProcessingConfirmation(validation) {
    let successContent = '';
    let totalIncluded = 0;
    
    // Show layers that will be included
    if (validation.includedLayers && validation.includedLayers.length > 0) {
        validation.includedLayers.forEach(layer => {
            totalIncluded += layer.objectCount;
        });
        
        successContent = `
            <div class="success-section">
                <div class="success-header">
                    <span class="success-icon">✅</span>
                    <span class="success-title">${validation.includedLayers.length} layer(s) will be processed</span>
                </div>
                <div class="success-details">
                    ${validation.includedLayers.map(layer => `
                        <div class="success-layer">
                            <span class="layer-name">${layer.name}</span>
                            <span class="object-count">${layer.objectCount} objects</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    const modalHTML = `
        <div id="layerValidationModal" class="modal" style="display: flex;">
            <div class="modal-content validation-modal">
                <div class="modal-header">
                    <h3>Generate DIN File</h3>
                    <button class="modal-close" onclick="closeLayerValidationModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="validation-summary">
                        <p><strong>${totalIncluded} objects</strong> will be processed for DIN generation.</p>
                    </div>
                    ${successContent}
                    <div class="validation-actions">
                        <p>Proceed with DIN generation?</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeLayerValidationModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="proceedWithDinGeneration()">Generate DIN File</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.getElementById('layerValidationModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeLayerValidationModal() {
    const modal = document.getElementById('layerValidationModal');
    if (modal) {
        modal.remove();
    }
}
function showDinGenerationSuccessDialog(filePath, processedLayers, stats) {
    let includedContent = '';
    let totalObjects = 0;
    
    if (processedLayers && processedLayers.length > 0) {
        processedLayers.forEach(layer => {
            totalObjects += layer.objectCount || 0;
        });
        
        includedContent = `
            <div class="success-section">
                <div class="success-header">
                    <span class="success-icon">✅</span>
                    <span class="success-title">${processedLayers.length} layer(s) were processed successfully</span>
                </div>
                <div class="success-details">
                    ${processedLayers.map(layer => `
                        <div class="success-layer">
                            <span class="layer-name">${layer.name}</span>
                            <span class="object-count">${layer.objectCount || 0} objects</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    const modalHTML = `
        <div id="dinSuccessModal" class="modal" style="display: flex;">
            <div class="modal-content validation-modal">
                <div class="modal-header">
                    <h3>DIN File Generated Successfully</h3>
                    <button class="modal-close" onclick="closeDinSuccessModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="validation-summary">
                        <p><strong>DIN file saved successfully!</strong></p>
                        <p style="margin-top: 0.5rem; font-size: 0.9rem; word-break: break-all;">${filePath}</p>
                    </div>
                    ${includedContent}
                    ${stats ? `
                        <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(0, 191, 255, 0.1); border-radius: 6px; text-align: center;">
                            <p style="margin: 0; color: #00BFFF; font-weight: 500;">
                                Generated ${stats.totalLines || 0} DIN commands from ${totalObjects} objects
                            </p>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="closeDinSuccessModal()">OK</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.getElementById('dinSuccessModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeDinSuccessModal() {
    const modal = document.getElementById('dinSuccessModal');
    if (modal) {
        modal.remove();
    }
}

function getProcessedLayersInfo() {
    const processedLayers = [];
    const layerMap = new Map();
    
    // Check for either DXF viewer (with scene) or unified format viewer (with overlayCanvas)
    const hasDxfViewer = !!(viewer && viewer.scene);
    const hasUnifiedViewer = !!(overlayCanvas && window.unifiedGeometries && window.unifiedGeometries.length > 0);
    
    if (hasDxfViewer && currentLayerData) {
        // Handle DXF files
        currentLayerData.forEach((layer, index) => {
            const layerName = layer.parentLayer || layer.name;
            const isVisible = document.getElementById(`layer-${index}`)?.checked || false;
            const objectCount = layer.objectCount !== undefined ? layer.objectCount : (layer.objects ? layer.objects.length : 0);
            
            // Only include layers that are visible and mapped
            if (isVisible && (layer.importFilterApplied || layer.lineType)) {
                const existingLayer = layerMap.get(layerName);
                if (existingLayer) {
                    existingLayer.objectCount += objectCount;
                } else {
                    layerMap.set(layerName, {
                        name: layerName,
                        objectCount: objectCount
                    });
                }
            }
        });
    } else if (hasUnifiedViewer && overlayGroups) {
        // Handle unified formats (CFF2/DDS)
        const fmt = currentFileFormat === 'dds' ? 'dds' : 'cff2';
        
        Object.keys(overlayGroups).forEach(key => {
            const group = overlayGroups[key];
            if (group && group.visible) {
                const entry = exactRulesCache.get(`${fmt}|${key}`);
                if (entry && entry.lineTypeId) {
                    // Build a user-friendly layer name
                    let layerName = key;
                    try {
                        if (fmt === 'dds') {
                            const [color, rawKerf, unit] = key.split('|');
                            const pt = (unit==='in' ? Number(rawKerf||0)*72 : unit==='mm' ? Number(rawKerf||0)/25.4*72 : Number(rawKerf||0));
                            layerName = `${pt.toFixed(2)} pt · color ${color}`;
                        } else {
                            const parts = key.split('-');
                            const pen = parts[0] ?? '';
                            const layer = parts.slice(1).join('-');
                            layerName = `${Number(pen||0).toFixed(2)} pt · ${layer}`;
                        }
                    } catch {}
                    
                    const existingLayer = layerMap.get(layerName);
                    if (existingLayer) {
                        existingLayer.objectCount += group.count || 1;
                    } else {
                        layerMap.set(layerName, {
                            name: layerName,
                            objectCount: group.count || 1
                        });
                    }
                }
            }
        });
    }
    
    return Array.from(layerMap.values());
}

// Make functions globally accessible for HTML onclick attributes
window.closeLayerValidationModal = closeLayerValidationModal;
window.proceedWithDinGeneration = proceedWithDinGeneration;
window.fixLayerMappings = fixLayerMappings;
window.closeDinSuccessModal = closeDinSuccessModal;

function proceedWithDinGeneration() {
    console.log('=== PROCEED WITH DIN GENERATION CALLED ===');
    closeLayerValidationModal();
    // Continue with actual DIN generation logic
    performDinGeneration();
}

function fixLayerMappings() {
    closeLayerValidationModal();
    // Scroll to layer table to help user fix mappings
    const layerTable = document.getElementById('layerTable');
    if (layerTable) {
        layerTable.scrollIntoView({ behavior: 'smooth' });
        showStatus('Please map the unmapped layers and ensure desired layers are visible.', 'info');
    }
}

// DXF Viewer functions
async function initViewer() {
    try {
        if (viewer) {
            viewer.Clear();
        } else {
            // Get saved background color
            const savedBgValue = getSavedBackgroundColor();
            const clearColor = getBackgroundColorFromSlider(savedBgValue);
            
            viewer = new DxfViewer(viewerEl, {
                clearColor: clearColor,
                autoResize: true,
                antialias: true,
                retainParsedDxf: true  // Keep the parsed DXF data for layer extraction
            });
            
            // Initialize the background color slider after viewer is created
            initBackgroundColorSlider();
            
            // Initialize canvas controls after viewer is created
            initCanvasControls();
        }
        
        return true;
        
    } catch (error) {
        showStatus('Failed to initialize DXF viewer: ' + error.message, 'error');
        console.error('DXF viewer initialization error:', error);
        return false;
    }
}
async function loadDxfContent(filename, dxfData, filePath = null) {
    currentFilename = filename; // Store the filename globally
    currentFilePath = filePath; // Store the file path globally
    
    if (!viewer) {
        if (!await initViewer()) return;
    }
    
    try {
        showLoading(true);
        hideDropZone();
        showStatus('Loading DXF file...');
        
        // Create blob URL for the DXF data
        const blob = new Blob([dxfData], { type: 'text/plain' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Show file info
        showFileInfo(filename, blob.size);
        
        showStatus('Parsing and rendering DXF...');
        
        try {
            await viewer.Load({ url: blobUrl });
            URL.revokeObjectURL(blobUrl);
            
            // Debug the parsed DXF data
            console.log('Raw DXF data:', viewer.parsedDxf);
            console.log('DXF tables:', viewer.parsedDxf?.tables);
            console.log('DXF header:', viewer.parsedDxf?.header);
            console.log('DXF entities sample:', viewer.parsedDxf?.entities?.slice(0, 5));
            
            if (viewer.parsedDxf?.tables?.layer?.layers) {
                console.log('DXF layer table:', viewer.parsedDxf.tables.layer.layers);
            } else {
                console.log('No layer table found, checking alternative structures...');
                if (viewer.parsedDxf?.tables) {
                    console.log('Available table keys:', Object.keys(viewer.parsedDxf.tables));
                    if (viewer.parsedDxf.tables.layer) {
                        console.log('Layer table structure:', viewer.parsedDxf.tables.layer);
                    }
                }
            }
            
            // Debug the viewer's internal layer system
            console.log('Viewer layers map:', viewer.layers);
            console.log('Viewer default layer:', viewer.defaultLayer);
            console.log('Viewer layers size:', viewer.layers.size);
            
            // Try to get layers from the internal layers map
            const layersFromMap = [];
            viewer.layers.forEach((layer, name) => {
                console.log('Layer from map:', name, layer);
                layersFromMap.push({
                    name: name,
                    displayName: layer.displayName || name,
                    color: layer.color !== undefined ? layer.color : 0xffffff
                });
            });
            
            // Also add default layer if it exists and has objects, but only if it's not already in the layers
            if (viewer.defaultLayer && viewer.defaultLayer.objects && viewer.defaultLayer.objects.length > 0) {
                const defaultLayerExists = layersFromMap.some(layer => 
                    layer.name === viewer.defaultLayer.name && 
                    layer.color === viewer.defaultLayer.color
                );
                
                if (!defaultLayerExists) {
                console.log('Adding default layer:', viewer.defaultLayer);
                layersFromMap.push({
                    name: viewer.defaultLayer.name,
                    displayName: viewer.defaultLayer.displayName || viewer.defaultLayer.name,
                    color: viewer.defaultLayer.color !== undefined ? viewer.defaultLayer.color : 0xffffff
                });
                } else {
                    console.log('Default layer already exists in regular layers, skipping:', viewer.defaultLayer.name);
                }
            }
            // Refactored: Always group entities by (layer, color) for mapping
            let mappingEntries = [];
            let entityTypesMap = new Map();
            if (viewer.parsedDxf?.entities?.length > 0) {
                // Group entities by (layer, color)
                const entityGroups = {};
                viewer.parsedDxf.entities.forEach(entity => {
                    const layer = entity.layer || 'Layer 1';
                    // Use color index or fallback to white
                    let colorInt = (entity.color !== undefined && entity.color !== null) ? entity.color : 0xffffff;
                    // Convert color to hex string
                    let colorHex = colorInt.toString(16).padStart(6, '0').toUpperCase();
                    let key = `${layer}_${colorHex}`;
                    if (!entityGroups[key]) {
                        entityGroups[key] = {
                            name: key,
                            displayName: `${layer} (#${colorHex})`,
                            originalLayerName: layer,
                            color: colorInt,
                            colorHex: `#${colorHex}`,
                            objectCount: 0,
                            entityCount: 0,
                            isColorVariant: true,
                            parentLayer: layer,
                            entityTypes: new Map()
                        };
                    }
                    entityGroups[key].objectCount++;
                    entityGroups[key].entityCount++;
                    // Track entity types
                    const entityType = entity.type || 'UNKNOWN';
                    entityGroups[key].entityTypes.set(entityType, (entityGroups[key].entityTypes.get(entityType) || 0) + 1);
                });
                // Convert entityTypes map to summary string
                Object.values(entityGroups).forEach(entry => {
                    entry.entityTypes = Array.from(entry.entityTypes.entries())
                        .map(([type, count]) => `${type}(${count})`)
                        .join(', ');
                    mappingEntries.push(entry);
                });
            }
            // If no entities found, fallback to default layer
            if (mappingEntries.length === 0) {
                mappingEntries.push({
                    name: 'Layer 1_FFFFFF',
                    displayName: 'Layer 1 (#FFFFFF)',
                    originalLayerName: 'Layer 1',
                    color: 0xffffff,
                    colorHex: '#FFFFFF',
                    objectCount: 0,
                    entityCount: 0,
                    isColorVariant: true,
                    parentLayer: 'Layer 1',
                    entityTypes: ''
                });
            }
            // Store layers globally for other functions to access
            window.currentDxfLayers = mappingEntries;
            // Apply global import filter to the mapping entries
            try {
                console.log('Applying global import filter to mapping entries...');
                console.log('Entries being sent to filter:', mappingEntries.map(l => l.name + '_' + l.color));
                const filterResult = await window.electronAPI.applyGlobalImportFilter(mappingEntries);
                if (filterResult.success) {
                    const { appliedLayers, unmatchedLayers, totalLayers } = filterResult.data;
                    if (appliedLayers.length > 0) {
                        showStatus(`Applied import filter to ${appliedLayers.length}/${totalLayers} layers`, 'success');
                    }
                    if (unmatchedLayers.length > 0) {
                        const layerNames = unmatchedLayers.map(l => l.name).join(', ');
                        showStatus(`⚠️ ${unmatchedLayers.length} layers need import filter rules: ${layerNames}. Use "Add to Global" buttons to create rules, or DIN generation will skip these layers.`, 'warning');
                    }
                    // Use the applied layers (which include lineTypeId from the filter)
                    mappingEntries = appliedLayers.concat(unmatchedLayers);
                    window.processedLayersWithLineTypes = mappingEntries;
                    
                    // Update the visual indicators to show the mappings
                    updateMappingVisuals();
                } else {
                    console.error('Failed to apply global import filter:', filterResult.error);
                    showStatus('Failed to apply import filter', 'error');
                }
            } catch (error) {
                console.error('Error applying global import filter:', error);
                showStatus('Error applying import filter', 'error');
            }
            // Store the layer data globally for import filter creation
            window.currentLayerData = mappingEntries;
            // Populate the layer table with resolved mapping entries
            populateLayerTable(mappingEntries);
            // Update the visual mapping indicators
            updateMappingVisuals();
            // Update drawing dimensions
            updateDrawingDimensions();
            // Fit to view
            fitToView();
            showStatus(`Successfully loaded: ${filename} (${mappingEntries.length} layers)`, 'success');
            
            // Dispatch event for header controls
            const dxfLoadedEvent = new CustomEvent('dxfLoaded', {
                detail: {
                    filename: filename,
                    layerCount: mappingEntries.length,
                    filePath: filePath
                }
            });
            document.dispatchEvent(dxfLoadedEvent);
        } catch (error) {
            console.error('Error loading DXF:', error);
            showStatus('Error loading DXF: ' + error.message, 'error');
        }
    } catch (error) {
        console.error('Error in loadDxfContent:', error);
        showStatus('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
        
        // Initialize canvas controls after DXF is loaded
        if (viewer && viewer.controls) {
            initCanvasControls();
        }
    }
}

function clearViewer(showDropZoneAfterClear = true) {
    currentFilename = null; // Clear the filename
    currentFilePath = null; // Clear the file path
    
    if (viewer) {
        try { viewer.Clear(); } catch {}
    }
    // Remove overlay canvas/state if present
    destroyOverlayCanvas();
    hideFileInfo();
    // Only show drop zone if explicitly requested (not during startup)
    if (showDropZoneAfterClear) {
        showDropZone();
    }
    updateFormatIndicator('');
    
    // Reset layer table
    layerTableEl.innerHTML = '<div class="no-file">Load a file to view layers</div>';

    
    // Hide drawing dimensions
    if (drawingInfoEl) {
        drawingInfoEl.style.display = 'none';
    }
    
    showStatus('Viewer cleared');
}

function fitToView() {
    if (viewer && viewer.FitView && viewer.GetBounds && viewer.GetOrigin) {
        // Always use original bounds for fit-to-view, not scaled bounds
        let bounds = null;
        let origin = { x: 0, y: 0 };
        
        // Try to get original bounds first (preferred for scaled content)
        if (viewer._originalBounds) {
            bounds = viewer._originalBounds;
            origin = viewer.GetOrigin() || { x: 0, y: 0 };
        } 
        // Fallback to current bounds using proper API methods
        else {
            bounds = viewer.GetBounds();
            origin = viewer.GetOrigin();
        }
        
        if (bounds && origin) {
            viewer.FitView(
                bounds.minX - origin.x, 
                bounds.maxX - origin.x,
                bounds.minY - origin.y, 
                bounds.maxY - origin.y,
                0.05  // Add small padding for better viewing
            );
            showStatus('Fitted to view');
        } else {
            showStatus('No content bounds available to fit', 'warning');
        }
    } else {
        showStatus('No content to fit - load a file first', 'warning');
    }
}

function openLineTypesManager() {
    window.electronAPI.openLineTypesManager();
}

function getDrawingDimensions() {
    // Get the actual drawing dimensions in DXF units
    if (!viewer || !viewer.bounds) {
        return null;
    }
    const bounds = viewer.bounds;
    const width = Math.abs(bounds.maxX - bounds.minX);
    const height = Math.abs(bounds.maxY - bounds.minY);
    // Get the actual units from DXF header
    const unitInfo = getDXFUnits();
    return {
        width: parseFloat(width.toFixed(3)),
        height: parseFloat(height.toFixed(3)),
        unit: unitInfo.unit,
        unitName: unitInfo.name,
        scaleFactor: unitInfo.scaleFactor,
        measurementSystem: unitInfo.measurementSystem
    };
}

function formatDimensions(dimensions) {
    if (!dimensions) return 'N/A';
    
    // Get user's unit preference
    const userUnit = getUserUnitPreference();
    
    if (userUnit === 'auto') {
        // Use the actual DXF units
        return `${dimensions.width} × ${dimensions.height} ${dimensions.unit}`;
    } else {
        // Convert to user's preferred units
        const converted = convertDimensions(dimensions, userUnit);
        return `${converted.width} × ${converted.height} ${converted.unit}`;
    }
}

function getUserUnitPreference() {
    // Get user's unit preference from localStorage or default to auto
    return localStorage.getItem('unitOverride') || 'auto';
}

function convertDimensions(dimensions, targetUnit) {
    // Convert dimensions from DXF units to target units
    const conversionFactors = {
        'mm': { 
            'mm': 1, 
            'cm': 0.1, 
            'm': 0.001, 
            'in': 0.0393701, 
            'ft': 0.00328084 
        },
        'cm': { 
            'mm': 10, 
            'cm': 1, 
            'm': 0.01, 
            'in': 0.393701, 
            'ft': 0.0328084 
        },
        'm': { 
            'mm': 1000, 
            'cm': 100, 
            'm': 1, 
            'in': 39.3701, 
            'ft': 3.28084 
        },
        'in': { 
            'mm': 25.4, 
            'cm': 2.54, 
            'm': 0.0254, 
            'in': 1, 
            'ft': 0.0833333 
        },
        'ft': { 
            'mm': 304.8, 
            'cm': 30.48, 
            'm': 0.3048, 
            'in': 12, 
            'ft': 1 
        }
    };
    
    const sourceUnit = dimensions.unit;
    const factor = conversionFactors[sourceUnit]?.[targetUnit];
    
    if (!factor) {
        // If conversion not available, return original (no scaling)
        return {
            width: parseFloat(dimensions.width.toFixed(3)),
            height: parseFloat(dimensions.height.toFixed(3)),
            unit: dimensions.unit,
            unitName: dimensions.unitName
        };
    }
    
    const unitNames = {
        'mm': 'mm',
        'cm': 'cm', 
        'm': 'm',
        'in': 'in',
        'ft': 'ft'
    };
    
    return {
        width: parseFloat((dimensions.width * factor).toFixed(3)),
        height: parseFloat((dimensions.height * factor).toFixed(3)),
        unit: unitNames[targetUnit],
        unitName: getUnitDisplayName(targetUnit)
    };
}

function getUnitDisplayName(unit) {
    const displayNames = {
        'mm': 'Millimeters',
        'cm': 'Centimeters',
        'm': 'Meters',
        'in': 'Inches',
        'ft': 'Feet'
    };
    return displayNames[unit] || unit;
}
// Event handlers
async function handleOpenFile() {
    try {
        const result = await window.electronAPI.showOpenDialog();
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            const fileResult = await window.electronAPI.readFile(filePath);
            
            if (fileResult.success) {
                const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
                const ext = (fileName.split('.').pop() || '').toLowerCase();
                updateFormatIndicator(ext);
                if (ext === 'dxf' || ext === 'dwg') {
                await refreshRulesCache();
                // Switching to DXF: clear any overlay canvas/state first
                destroyOverlayCanvas();
                await loadDxfContent(fileName, fileResult.content, filePath);
                            } else if (ext === 'dds' || ext === 'cf2' || ext === 'cff2') {
                currentFilename = fileName; // Set the filename for unified formats
                currentFilePath = filePath; // Set the file path for unified formats
                await refreshRulesCache();
                const res = await window.electronAPI.parseUnified(fileResult.content, fileName);
                if (!res.success) throw new Error(res.error || 'Failed to parse file');
                window.unifiedGeometries = res.data || [];
                // Show file name/size for unified formats
                try { showFileInfo(fileName, new Blob([fileResult.content]).size); } catch {}
                // Clear any DXF content and previous overlay
                try { if (viewer && viewer.Clear) viewer.Clear(); } catch {}
                destroyOverlayCanvas();
                hideDropZone();
                ensureOverlayCanvas();
                // Build groups and UI, then draw so colors are correct on first paint
                updateImportPanelForUnified();
                fitOverlayView();
                updateUnifiedDimensions();
                showStatus(`Loaded ${fileName} (${window.unifiedGeometries.length} entities)`, 'success');
                // Layer list is rendered by updateImportPanelForUnified(); do not overwrite it with a placeholder
                } else {
                    throw new Error('Unsupported file type');
                }
            } else {
                showStatus('Error reading file: ' + fileResult.error, 'error');
            }
        }
    } catch (error) {
        showStatus('Error opening file: ' + error.message, 'error');
    }
}
// Drag and drop handlers - Initialize when DOM is ready
function initDragAndDrop() {
    if (!viewerEl || !dropZone) {
        console.error('Viewer or drop zone elements not found');
        return;
    }

    let dragCounter = 0;

    // Attach drag events to the viewer container (which includes the drop zone)
    const viewerContainer = viewerEl.parentElement;
    
    if (!viewerContainer) {
        console.error('Viewer container not found');
        return;
    }

    // Function to handle file drop
    async function handleFileDrop(files) {
        console.log('Processing dropped files:', files.map(f => ({ name: f.name, type: f.type, size: f.size })));
        
        // Accept DXF, DDS, CF2/CFF2
        const supported = files.filter(file => /\.(dxf|dwg|dds|cf2|cff2)$/i.test(file.name));
        if (supported.length === 0) {
            const fileNames = files.map(f => f.name).join(', ');
            showStatus(`Unsupported files. Drop DXF, DDS, or CFF2. Found: ${fileNames}`, 'error');
            return;
        }
        const sel = supported[0];
        if (supported.length > 1) {
            showStatus('Multiple files detected. Loading the first supported: ' + sel.name, 'warning');
        }

        try {
            showStatus(`Loading ${sel.name}... (${(sel.size / 1024).toFixed(1)} KB)`, 'info');
            const content = await sel.text();
            const ext = (sel.name.split('.').pop() || '').toLowerCase();
            updateFormatIndicator(ext);
            if (ext === 'dxf' || ext === 'dwg') {
                await refreshRulesCache();
                destroyOverlayCanvas();
                await loadDxfContent(sel.name, content);
            } else if (ext === 'dds' || ext === 'cf2' || ext === 'cff2') {
                currentFilename = sel.name; // Set the filename for unified formats
                currentFilePath = null; // No file path for dropped files
                await refreshRulesCache();
                const res = await window.electronAPI.parseUnified(content, sel.name);
                if (!res.success) throw new Error(res.error || 'Failed to parse file');
                window.unifiedGeometries = res.data || [];
                showStatus(`Loaded ${sel.name} (${window.unifiedGeometries.length} entities)`, 'success');
                // Table will be created by updateImportPanelForUnified(); avoid replacing it
                try { if (viewer && viewer.Clear) viewer.Clear(); } catch {}
                // Show file info for dropped unified file
                try { showFileInfo(sel.name, sel.size); } catch {}
                destroyOverlayCanvas();
                hideDropZone();
                ensureOverlayCanvas();
                // Build groups/UI before fitting and perform an explicit draw
                updateImportPanelForUnified();
                fitOverlayView();
                drawOverlay();
                updateUnifiedDimensions();
            } else {
                throw new Error('Unsupported file type');
            }
        } catch (error) {
            console.error('Error reading dropped file:', error);
            showStatus('Error reading dropped file: ' + error.message, 'error');
        }
    }

    // Attach events to viewer container to catch all drag events
    viewerContainer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        dropZone.classList.add('active');
        console.log('Drag enter detected');
    });

    viewerContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter <= 0) {
            dropZone.classList.remove('active');
            dragCounter = 0;
        }
        console.log('Drag leave detected');
    });

    viewerContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Check if the dragged items contain files
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
        }
    });

    viewerContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        dropZone.classList.remove('active');
        
        console.log('File drop detected');
        
        const files = Array.from(e.dataTransfer.files);
        console.log('Dropped files:', files.map(f => f.name));
        
        if (files.length > 0) {
            await handleFileDrop(files);
        } else {
            showStatus('No files detected in drop', 'error');
        }
    });

    // Also attach to document to handle drag events outside the viewer
    document.addEventListener('dragenter', (e) => {
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
        }
    });

    document.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
        }
    });

    document.addEventListener('drop', (e) => {
        // Only handle if not already handled by viewer container
        if (!viewerContainer.contains(e.target)) {
            e.preventDefault();
            dragCounter = 0;
            dropZone.classList.remove('active');
        }
    });

    console.log('Drag and drop initialized successfully');
}
// Create import filter from current layers
async function createImportFilterFromLayers() {
    console.log('Create Import Filter button clicked!');
    
    if (!viewer || !currentFilename) {
        showStatus('No DXF file loaded', 'error');
        return;
    }

    try {
        // Get layer information from the currently displayed layer table
        const layerRows = document.querySelectorAll('.layer-row');
        
        if (layerRows.length === 0) {
            showStatus('No layers found', 'error');
            return;
        }

        // Extract layer data and create import filter rules
        const rules = [];
        let ruleId = 1;

        layerRows.forEach((row, index) => {
            const layerName = row.querySelector('.layer-name');
            const layerColor = row.querySelector('.layer-color');
            
            if (layerName && layerColor) {
                // Extract only the layer name, excluding any button text
                let name = layerName.textContent.trim();
                
                // Remove the "Add to Global" button text and warning symbols
                name = name.replace(/\n\s*⚠\s*\n\s*Add to Global/g, '').trim();
                
                // Also remove any other button text that might be present
                name = name.replace(/\n\s*[^\n]*button[^\n]*/gi, '').trim();
                let color = '';
                
                console.log(`\n=== Processing Layer: ${name} ===`);
                
                // Get color from the displayed layer data - reuse the same processed data as the info panel
                // Look for the layer data that was used to populate the table
                const layerData = window.currentLayerData?.find(l => l.name === name);
                
                if (layerData && layerData.color !== undefined) {
                    // Use the exact color from the processed layer data
                    if (typeof layerData.color === 'number') {
                        color = layerData.color.toString();
                        console.log(`Using exact layer data ACI color: ${color}`);
                    } else if (typeof layerData.color === 'string') {
                        // Keep the exact string color - don't convert
                        color = layerData.color;
                        console.log(`Using exact layer data string color: ${color}`);
                    }
                            } else {
                    console.log(`No color found for layer: ${name} in layer data - assigning unique fallback color`);
                    // Assign a unique fallback color that's not in standard ACI palette
                    const fallbackColor = 1000 + Math.floor(Math.random() * 9000); // 1000-9999 range
                    color = fallbackColor.toString();
                    console.log(`Assigned unique fallback ACI color: ${color} for layer: ${name}`);
                }
                

                
    


                
                console.log(`Final color for ${name}: "${color}"`);
                
                // Create rule for this layer
                if (name) {
                    // Use the EXACT same color conversion as the info panel for consistency
                    const colorHex = rgbToHex(parseInt(color));
                    console.log(`Display color for ${name}: ACI ${color} -> Hex ${colorHex} (using same method as info panel)`);
                    
                    rules.push({
                        id: ruleId++,
                        layerName: name,
                        color: color, // Keep ACI number as source of truth
                        colorHex: colorHex, // Add hex color for display consistency
                        lineTypeId: '' // Will be set by user in the import filter manager
                    });
                }
            }
        });

        if (rules.length === 0) {
            showStatus('No valid layers found for import filter', 'error');
            return;
        }

        // Create import filter profile
        const profileName = `${currentFilename.replace('.dxf', '')}_import_filter`;
        const profile = {
            id: `profile_${Date.now()}`,
            name: profileName,
            description: `Auto-generated import filter for ${currentFilename}`,
            created: new Date().toISOString(),
            rules: rules
        };

        // Save the profile
        const result = await window.electronAPI.saveImportFilter(profile);
        
        if (result.success) {
            showStatus(`Import filter created: ${profileName}`, 'success');
            
            // Ask user if they want to open the Import Filters manager to edit it
            const openManager = confirm('Import filter created successfully!\n\nWould you like to open the Import Filters Manager to assign line types to the rules?');
            if (openManager) {
                window.electronAPI.openImportFiltersManager();
            }
        } else {
            showStatus(`Failed to create import filter: ${result.error}`, 'error');
        }

    } catch (error) {
        console.error('Error creating import filter:', error);
        showStatus(`Error creating import filter: ${error.message}`, 'error');
    }
}

// Button event listeners
document.getElementById('openBtn').addEventListener('click', handleOpenFile);
document.getElementById('clearBtn').addEventListener('click', () => clearViewer(true)); // Show drop zone when user clicks Clear
document.getElementById('fitBtn').addEventListener('click', fitToView);
lineTypesBtn.addEventListener('click', openLineTypesManager);
togglePanelBtn.addEventListener('click', toggleSidePanel);

// Output Manager button and keyboard shortcut
document.getElementById('openOutputManagerBtn').addEventListener('click', () => {
    window.electronAPI.openOutputManager();
});
document.addEventListener('keydown', (e)=>{
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o' && e.shiftKey) {
        try { window.electronAPI.openOutputManager(); } catch {}
    }
});

// Settings tab button listeners
    
    // Open global import filter manager
    document.getElementById('globalFilterManagerBtn').addEventListener('click', () => {
        window.electronAPI.openGlobalImportFilterManager();
    });
    
    // Open machine tool importer
    document.getElementById('machineToolImporterBtn').addEventListener('click', () => {
        console.log('Machine Tool Importer button clicked!');
        window.electronAPI.openMachineToolImporter().then(result => {
            console.log('Machine Tool Importer result:', result);
        }).catch(error => {
            console.error('Error opening Machine Tool Importer:', error);
        });
    });
    


// Tab switching functionality
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
        const targetTab = e.target.dataset.tab;
        
        // Remove active class from all buttons and content
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        e.target.classList.add('active');
        document.getElementById(targetTab + 'Tab').classList.add('active');
        
        // Update panel header label based on selected tab
        const panelHeader = document.querySelector('.panel-header h3');
        if (panelHeader) {
            switch (targetTab) {
                case 'import':
                    panelHeader.textContent = 'Import';
                    break;
                case 'output':
                    panelHeader.textContent = 'Output';
                    break;
                case 'settings':
                    panelHeader.textContent = 'Settings';
                    break;
                default:
                    panelHeader.textContent = 'Import';
            }
        }
        
        // Show/hide import controls based on active tab
        const importControls = document.querySelector('.import-controls');
        if (importControls) {
            if (targetTab === 'import') {
                importControls.style.display = 'flex';
            } else {
                importControls.style.display = 'none';
            }
        }
    });
});

// Electron IPC event listeners
window.electronAPI.onFileOpened((event, fileData) => {
    loadDxfContent(fileData.name, fileData.content);
});

window.electronAPI.onClearViewer(() => {
    clearViewer(false); // Don't show drop zone when clearing from main process
});

window.electronAPI.onFitToView(() => {
    fitToView();
});
window.electronAPI.onWindowResized(() => {
    if (viewer && viewer.Resize) {
        // Delay resize to ensure DOM has updated
        setTimeout(() => {
            viewer.Resize();
        }, 100);
    }
});
// Refresh tool configuration when tools are updated
window.electronAPI.onRefreshToolConfiguration(async () => {
    console.log('Refreshing tool configuration...');
    
    // Refresh all tool displays
    try {
        // Refresh main tool configuration preview
        const mainPreview = document.getElementById('modalToolPreview');
        if (mainPreview) {
            await loadModalToolLibrary();
        }
        
        // Refresh tool configuration interface
        const toolConfigPreview = document.querySelector('.tool-grid');
        if (toolConfigPreview) {
            const currentTools = await getCurrentToolSet();
            toolConfigPreview.innerHTML = '';
            
            Object.entries(currentTools).forEach(([toolId, tool]) => {
                const toolCard = document.createElement('div');
                toolCard.className = 'tool-card';
                toolCard.dataset.toolId = toolId;
                
                toolCard.innerHTML = `
                    <div class="tool-name">${toolId}: ${tool.name}</div>
                    <div class="tool-details">
                        <div>Width: <span class="tool-width">${tool.width}mm</span></div>
                        <div>H-Code: <span class="tool-hcode">${tool.hCode}</span></div>
                        <div>Type: <span class="tool-type">${tool.description}</span></div>
                    </div>
                `;
                
                toolCard.addEventListener('click', () => {
                    document.querySelectorAll('.tool-card').forEach(card => card.classList.remove('selected'));
                    toolCard.classList.add('selected');
                });
                
                toolConfigPreview.appendChild(toolCard);
            });
        }
        
        // Also refresh tool previews in other windows
        if (typeof refreshToolPreviews === 'function') {
            await refreshToolPreviews();
        }
        
        showStatus('Tool configuration refreshed', 'success');
    } catch (error) {
        console.error('Error refreshing tool configuration:', error);
        showStatus('Failed to refresh tool configuration', 'error');
    }
});
// Listen for Global Import Filter data refresh requests
if (window.electronAPI && window.electronAPI.receive) {
    window.electronAPI.receive('refresh-global-filter-data', async () => {
        console.log('Received refresh-global-filter-data message');
        showStatus('Refreshing layer mappings...', 'info');
        
        try {
            // Simple approach: reload the current file if one is loaded
            if (currentFilePath && currentFilename) {
                console.log(`Reloading current file: ${currentFilename}`);
                
                // Read the file again
                const fileContent = await window.electronAPI.readFile(currentFilePath);
                if (fileContent) {
                    // Reload the file content - this will automatically apply the updated Global Import Filter
                    await loadDxfContent(currentFilename, fileContent, currentFilePath);
                    showStatus('Layer mappings refreshed successfully', 'success');
                } else {
                    throw new Error('Failed to read current file');
                }
            } else {
                console.log('No current file to reload');
                showStatus('No file loaded to refresh', 'warning');
            }
        } catch (error) {
            console.error('Error refreshing layer mappings:', error);
            showStatus('Failed to refresh layer mappings: ' + error.message, 'error');
        }
    });
}

// Initialize when page loads
window.addEventListener('load', async () => {
    try {
        showStatus('DXF Viewer ready - Open a file to begin');
        // Defer viewer initialization until a file is actually loaded
        initializeUnitSelector();
        initializeScalingSelector();
        initializePostprocessorUI();
        
        // Initialize background color slider after viewer is ready
        if (!viewer) {
            // If viewer initialization failed, still set up the slider
            // so it's ready when the viewer is created later
            setTimeout(() => {
                const slider = document.getElementById('bgColorSlider');
                if (slider) {
                    const savedValue = getSavedBackgroundColor();
                    slider.value = savedValue;
                    // Apply saved background immediately even before viewer exists
                    try { updateBackgroundColor(savedValue); } catch {}
                    slider.addEventListener('input', (e) => {
                        const value = parseInt(e.target.value);
                        // Always apply background color (works with or without viewer)
                        updateBackgroundColor(value);
                        saveBackgroundColor(value);
                    });
                }
            }, 100);
        }
        
        // Initialize canvas controls after viewer is ready
        setTimeout(() => {
            initCanvasControls();
        }, 150);
        
        // Initialize drag and drop functionality
        setTimeout(() => {
            initDragAndDrop();
            // Ensure drop zone is visible on startup; it will be hidden after a file loads
            showDropZone();
        }, 200);
        
        // Initialize import controls visibility (show by default since import tab is active)
        const importControls = document.querySelector('.import-controls');
        if (importControls) {
            importControls.style.display = 'flex';
        }


    } catch (error) {
        console.error('Initialization error:', error);
    }
});

function initializeUnitSelector() {
    if (unitOverrideEl) {
        // Load saved preference
        const savedUnit = getUserUnitPreference();
        unitOverrideEl.value = savedUnit;
        
        // Add change event listener
        unitOverrideEl.addEventListener('change', (e) => {
            const selectedUnit = e.target.value;
            
            // Save preference
            localStorage.setItem('unitOverride', selectedUnit);
            
            // Update display if drawing is loaded
            updateDrawingDimensions();
            
            console.log('Unit preference changed to:', selectedUnit);
        });
    }
}

function getScalingFactor() {
    return parseFloat(localStorage.getItem('scalingFactor') || '1');
}
function initializeScalingSelector() {
    const scalingDropdown = document.getElementById('scalingDropdown');
    const customScalingContainer = document.getElementById('customScalingContainer');
    const customScalingInput = document.getElementById('customScalingInput');
    const applyCustomScalingBtn = document.getElementById('applyCustomScaling');
    const saveCustomScalingBtn = document.getElementById('saveCustomScaling');
    const cancelCustomScalingBtn = document.getElementById('cancelCustomScaling');
    
    if (!scalingDropdown) return;
    
    // Load saved preference
    const savedScaling = getScalingFactor().toString();
    
    // Set the correct dropdown value or custom if not in list
    if ([...scalingDropdown.options].some(option => option.value === savedScaling)) {
        scalingDropdown.value = savedScaling;
    } else {
        // Add custom option and select it
        addCustomScalingOption(savedScaling);
        scalingDropdown.value = savedScaling;
    }
    
    // Handle dropdown change
    scalingDropdown.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        
        if (selectedValue === 'custom') {
            customScalingContainer.style.display = 'block';
            customScalingInput.focus();
        } else {
            customScalingContainer.style.display = 'none';
            const scalingFactor = parseFloat(selectedValue);
            applyScaling(scalingFactor);
        }
    });
    
    // Show/hide custom container based on current selection
    if (scalingDropdown.value === 'custom') {
        customScalingContainer.style.display = 'block';
    }
    
    // Handle custom scaling input
    if (applyCustomScalingBtn) {
        applyCustomScalingBtn.addEventListener('click', () => {
            const customValue = parseFloat(customScalingInput.value);
            if (isValidScalingValue(customValue)) {
                const success = applyScaling(customValue);
                if (!success) {
                    showScalingError();
                }
            } else {
                showScalingError();
            }
        });
    }
    
    if (saveCustomScalingBtn) {
        saveCustomScalingBtn.addEventListener('click', () => {
            const customValue = parseFloat(customScalingInput.value);
            if (isValidScalingValue(customValue)) {
                const success = applyScaling(customValue);
                if (success) {
                    addCustomScalingOption(customValue.toString());
                    scalingDropdown.value = customValue.toString();
                    customScalingContainer.style.display = 'none';
                    customScalingInput.value = '';
                } else {
                    showScalingError();
                }
            } else {
                showScalingError();
            }
        });
    }
    
    if (cancelCustomScalingBtn) {
        cancelCustomScalingBtn.addEventListener('click', () => {
            customScalingContainer.style.display = 'none';
            customScalingInput.value = '';
            scalingDropdown.value = getScalingFactor().toString();
        });
    }
    
    // Handle Enter key in custom input
    if (customScalingInput) {
        customScalingInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyCustomScalingBtn.click();
            }
        });
    }
}

function addCustomScalingOption(value) {
    const scalingDropdown = document.getElementById('scalingDropdown');
    if (!scalingDropdown) return;
    
    // Check if option already exists
    if ([...scalingDropdown.options].some(option => option.value === value)) {
        return;
    }
    
    // Create new option
    const option = document.createElement('option');
    option.value = value;
    option.textContent = `${value}:1 (×${value})`;
    
    // Insert before "Custom..." option
    const customOption = scalingDropdown.querySelector('option[value="custom"]');
    if (customOption) {
        scalingDropdown.insertBefore(option, customOption);
    } else {
        scalingDropdown.appendChild(option);
    }
}

function isValidScalingValue(value) {
    return !isNaN(value) && isFinite(value) && value > 0.001 && value <= 1000;
}

function showScalingError() {
    const errorEl = document.getElementById('customScalingError');
    if (errorEl) {
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 3000);
    }
}

function validateScalingFactor(scalingFactor) {
    const originalDimensions = getDrawingDimensions();
    if (!originalDimensions) {
        return { valid: true };
    }
    
    // Convert to meters using proper unit conversion  
    let conversionToMeters = 1;
    switch(originalDimensions.unit) {
        case 'mm': conversionToMeters = 0.001; break;
        case 'cm': conversionToMeters = 0.01; break;
        case 'm': conversionToMeters = 1; break;
        case 'in': conversionToMeters = 0.0254; break;
        case 'ft': conversionToMeters = 0.3048; break;
        default: conversionToMeters = 0.001;
    }
    
    const originalWidthM = originalDimensions.width * conversionToMeters;
    const originalHeightM = originalDimensions.height * conversionToMeters;
    
    const scaledWidthM = originalWidthM * scalingFactor;
    const scaledHeightM = originalHeightM * scalingFactor;
    
    const MAX_SIZE_M = 3; // 3 meters maximum
    
    if (scaledWidthM > MAX_SIZE_M || scaledHeightM > MAX_SIZE_M) {
        const maxScaleX = MAX_SIZE_M / originalWidthM;
        const maxScaleY = MAX_SIZE_M / originalHeightM;
        const maxAllowedScale = Math.min(maxScaleX, maxScaleY);
        
        return {
            valid: false,
            message: `Scaling factor ${scalingFactor} would create a canvas size of ${scaledWidthM.toFixed(2)}m × ${scaledHeightM.toFixed(2)}m, exceeding the 3m × 3m limit. Maximum allowed scaling: ${maxAllowedScale.toFixed(2)}`,
            maxAllowedScale: Math.floor(maxAllowedScale * 100) / 100
        };
    }
    
    return { valid: true };
}
function applyScaling(scalingFactor) {
    // Validate scaling factor first
    const validation = validateScalingFactor(scalingFactor);
    if (!validation.valid) {
        showStatus(validation.message, 'warning');
        
        // Revert to previous scaling factor
        const currentScaling = getScalingFactor();
        const scalingDropdown = document.getElementById('scalingDropdown');
        if (scalingDropdown) {
            scalingDropdown.value = currentScaling.toString();
        }
        
        return false;
    }
    
    // If validation passed, hide any existing warning
    hideStatus();
    
    // Save preference
    localStorage.setItem('scalingFactor', scalingFactor.toString());
    
    // Apply scaling to 3D scene if drawing is loaded
    applyScalingToScene();
    
    // Update display dimensions
    updateDrawingDimensions();
    
    return true;
}
function applyScalingToScene() {
    if (!viewer || !viewer.scene) return;
    
    const scalingFactor = getScalingFactor();
    
    try {
        // Apply scaling to the entire scene
        viewer.scene.scale.set(scalingFactor, scalingFactor, scalingFactor);
        
        // Re-render the scene
        if (viewer.Render) {
            viewer.Render();
        }
        
        // Fit to view after scaling using original bounds
        setTimeout(() => {
            fitToView();
        }, 50);
        
        console.log('Applied scaling factor:', scalingFactor, 'to 3D scene');
        
    } catch (error) {
        console.error('Error applying scaling to scene:', error);
    }
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    // Clean up event listeners
    window.electronAPI.removeAllListeners('file-opened');
    window.electronAPI.removeAllListeners('clear-viewer');
    window.electronAPI.removeAllListeners('fit-to-view');
    window.electronAPI.removeAllListeners('window-resized');
});
function getScaledDimensions() {
    // Get dimensions with current scaling factor applied
    const dimensions = getDrawingDimensions();
    const scalingFactor = getScalingFactor();
    
    if (!dimensions) {
        return null;
    }
    
    return {
        width: dimensions.width * scalingFactor,
        height: dimensions.height * scalingFactor,
        unit: dimensions.unit,
        unitName: dimensions.unitName,
        scaleFactor: dimensions.scaleFactor,
        measurementSystem: dimensions.measurementSystem
    };
}
function updateOverallSize() {
    const originalDimensions = getDrawingDimensions();
    const scaledDimensions = getScaledDimensions();
    const overallDimensionsEl = document.getElementById("overallDimensions");
    const overallSizeInfoEl = document.getElementById("overallSizeInfo");
    const scalingFactor = getScalingFactor();
    
    if (scaledDimensions && overallDimensionsEl && overallSizeInfoEl) {
        try {
            // Safety check for valid dimensions
            if (!isFinite(scaledDimensions.width) || !isFinite(scaledDimensions.height) || 
                isNaN(scaledDimensions.width) || isNaN(scaledDimensions.height) ||
                scaledDimensions.width <= 0 || scaledDimensions.height <= 0) {
                overallSizeInfoEl.style.display = "none";
                return;
            }
            
            // Apply user unit preference to both original and scaled
            const userUnit = getUserUnitPreference();
            let displayOriginalDimensions = originalDimensions;
            let displayScaledDimensions = scaledDimensions;
            
            if (userUnit !== "auto" && originalDimensions) {
                displayOriginalDimensions = convertDimensions(originalDimensions, userUnit);
                displayScaledDimensions = convertDimensions(scaledDimensions, userUnit);
            }
            
            // Show both original and scaled if scaling is applied
            if (scalingFactor !== 1 && originalDimensions) {
                overallDimensionsEl.innerHTML = `
                    <div style="color: #888; font-size: 0.75rem; margin-bottom: 2px;">Original: ${formatDimensions(displayOriginalDimensions)}</div>
                    <div style="color: #ffffff; font-size: 0.85rem; font-weight: 600;">Scaled (${scalingFactor}×): ${formatDimensions(displayScaledDimensions)}</div>
                `;
            } else {
                overallDimensionsEl.textContent = formatDimensions(displayScaledDimensions);
            }
            
            overallSizeInfoEl.style.display = "block";
        } catch (error) {
            console.error("Error updating overall size:", error);
            overallSizeInfoEl.style.display = "none";
        }
    } else if (overallSizeInfoEl) {
        overallSizeInfoEl.style.display = "none";
    }
}

// Postprocessor Configuration Management
let currentPostprocessorConfig = null;
let pathOptimizer = new PathOptimizer();
let dinGenerator = new DinGenerator();

// Header Configuration Event Listeners
function initializeHeaderConfiguration() {
    const machineTypeSelect = document.getElementById('machineType');
    const scalingSettingsGroup = document.getElementById('scalingSettings');
    const headerTemplateInput = document.getElementById('headerTemplate');
    const scalingParameterInput = document.getElementById('scalingParameter');
    const scaleCommandInput = document.getElementById('scaleCommand');
    const setupCommandsTextarea = document.getElementById('setupCommands');
    
    // Machine type change handler
    machineTypeSelect?.addEventListener('change', function() {
        const selectedType = this.value;
        if (scalingSettingsGroup) {
            scalingSettingsGroup.style.display = selectedType === 'inch_with_scaling' ? 'block' : 'none';
        }
        updateHeaderPreview();
    });
    
    // Header template change handler
    headerTemplateInput?.addEventListener('input', updateHeaderPreview);
    
    // Scaling parameter change handlers
    scalingParameterInput?.addEventListener('input', updateHeaderPreview);
    scaleCommandInput?.addEventListener('input', updateHeaderPreview);
    setupCommandsTextarea?.addEventListener('input', updateHeaderPreview);
    
    // Checkbox change handlers for header options
    const checkboxes = ['includeFileInfo', 'includeBounds', 'includeSetCount', 'includeProgramStart', 'enableScaling'];
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        checkbox?.addEventListener('change', updateHeaderPreview);
    });
    
    // Load first available profile or create default if none exist
    loadFirstAvailableProfile();
}

// Load postprocessor configuration from file (legacy JSON)
async function loadPostprocessorConfiguration(profileName) {
    try {
        currentPostprocessorConfig = await window.electronAPI.loadPostprocessorConfig(profileName);
        applyConfigurationToUI(currentPostprocessorConfig);
        // Bridges setting is now managed in Output Manager profile
        updateHeaderPreview();
        
        showStatus(`Loaded postprocessor profile: ${currentPostprocessorConfig.name}`, 'success');
    } catch (error) {
        console.error('Error loading postprocessor configuration:', error);
        showStatus(`Failed to load postprocessor profile: ${error.message}`, 'error');
    }
}

// Load XML postprocessor profile
async function loadXmlProfileConfiguration(filename) {
    try {
        currentPostprocessorConfig = await window.electronAPI.loadXmlProfile(filename);
        applyConfigurationToUI(currentPostprocessorConfig);
        // Bridges setting is now managed in Output Manager profile
        updateHeaderPreview();
        
        const profileName = currentPostprocessorConfig.profileInfo?.name || filename;
        showStatus(`Loaded XML profile: ${profileName}`, 'success');
    } catch (error) {
        console.error('Error loading XML profile:', error);
        showStatus('Failed to load XML profile', 'error');
        
        // Fallback to default configuration
        currentPostprocessorConfig = getDefaultConfiguration();
        applyConfigurationToUI(currentPostprocessorConfig);
    }
}
// Save current configuration to XML profile
async function saveXmlProfileConfiguration(filename) {
    try {
        console.log('saveXmlProfileConfiguration called with filename:', filename);
        console.log('currentPostprocessorConfig:', currentPostprocessorConfig);
        
        if (!currentPostprocessorConfig) {
            showStatus('No configuration to save', 'error');
            return;
        }
        
        // Update profile info
        if (!currentPostprocessorConfig.profileInfo) {
            currentPostprocessorConfig.profileInfo = {};
        }
        currentPostprocessorConfig.profileInfo.lastModified = new Date().toISOString().split('T')[0];
        
        await window.electronAPI.saveXmlProfile(filename, currentPostprocessorConfig);
        showStatus(`Saved XML profile: ${filename}`, 'success');
    } catch (error) {
        console.error('Error saving XML profile:', error);
        showStatus('Failed to save XML profile', 'error');
    }
}

// Get default configuration object - NO FALLBACK DATA
function getDefaultConfiguration() {
    return {
        profileInfo: {
            name: 'New Profile',
            description: 'New profile created ' + new Date().toLocaleString(),
            version: '1.0',
            created: new Date().toISOString().split('T')[0],
            author: 'User'
        },
        tools: {},
        mappingWorkflow: {
            lineTypeToTool: []
        },
        optimization: {
            priority: {
                mode: 'tool',
                items: []
            }
        },
        outputSettings: {
            defaultSavePath: '',
            filenameFormat: '{original_name}.din',
            autoSaveEnabled: true
        },
        lineNumbers: {
            enabled: true,
            startNumber: 10,
            increment: 1,
            format: 'N{number}'
        },
        gcode: {
            homeCommand: 'G0 X0 Y0',
            programEnd: ['M30']
        }
    };
}

// Apply configuration to UI elements
function applyConfigurationToUI(config) {
    // Machine type
    const machineTypeSelect = document.getElementById('machineType');
    if (machineTypeSelect && config.units) {
        if (config.units.feedInchMachine && config.units.scalingHeader?.enabled) {
            machineTypeSelect.value = 'inch_with_scaling';
        } else if (config.units.feedInchMachine) {
            machineTypeSelect.value = 'custom';
        } else {
            machineTypeSelect.value = 'metric';
        }
        
        // Show/hide scaling settings
        const scalingSettingsGroup = document.getElementById('scalingSettings');
        if (scalingSettingsGroup) {
            scalingSettingsGroup.style.display = machineTypeSelect.value === 'inch_with_scaling' ? 'block' : 'none';
        }
    }
    
    // Header configuration
    if (config.header) {
        const headerTemplateInput = document.getElementById('headerTemplate');
        if (headerTemplateInput && config.header.template) {
            headerTemplateInput.value = config.header.template;
        }
        
        // Header options checkboxes
        const checkboxMappings = {
            'includeFileInfo': config.header.includeFileInfo,
            'includeBounds': config.header.includeBounds,
            'includeSetCount': config.header.includeSetCount,
            'includeProgramStart': config.header.includeProgramStart
        };
        
        Object.entries(checkboxMappings).forEach(([id, value]) => {
            const checkbox = document.getElementById(id);
            if (checkbox && typeof value === 'boolean') {
                checkbox.checked = value;
            }
        });
        
        // Setup commands
        const setupCommandsTextarea = document.getElementById('setupCommands');
        if (setupCommandsTextarea && config.header.setupCommands) {
            setupCommandsTextarea.value = config.header.setupCommands.join('\n');
        }
    }
    
    // Scaling configuration
    if (config.units?.scalingHeader) {
        const enableScalingCheckbox = document.getElementById('enableScaling');
        const scalingParameterInput = document.getElementById('scalingParameter');
        const scaleCommandInput = document.getElementById('scaleCommand');
        
        if (enableScalingCheckbox) {
            enableScalingCheckbox.checked = config.units.scalingHeader.enabled || false;
        }
        
        if (scalingParameterInput && config.units.scalingHeader.parameter) {
            scalingParameterInput.value = config.units.scalingHeader.parameter;
        }
        
        if (scaleCommandInput && config.units.scalingHeader.scaleCommand) {
            scaleCommandInput.value = config.units.scalingHeader.scaleCommand;
        }
    }
    
    // File output settings
    if (config.outputSettings) {
        loadFileOutputSettings();
    }
}
// Update header preview
function updateHeaderPreview() {
    const previewContainer = document.getElementById('headerPreview');
    if (!previewContainer) {
        // Create preview container if it doesn't exist
        const settingsSection = document.querySelector('.settings-section:has(#machineType)');
        if (settingsSection) {
            const previewDiv = document.createElement('div');
            previewDiv.id = 'headerPreview';
            previewDiv.className = 'header-preview';
            previewDiv.innerHTML = '<strong>Header Preview:</strong><br>';
            settingsSection.appendChild(previewDiv);
        }
        return;
    }
    
    const machineType = document.getElementById('machineType')?.value || 'metric';
    const headerTemplate = document.getElementById('headerTemplate')?.value || '{filename} / - size: {width} x {height} / {timestamp}';
    const enableScaling = document.getElementById('enableScaling')?.checked || false;
    const scalingParameter = document.getElementById('scalingParameter')?.value || ':P2027=25.4/P674';
    const scaleCommand = document.getElementById('scaleCommand')?.value || 'G75 X=P2027 Y=P2027';
    const setupCommands = document.getElementById('setupCommands')?.value || 'G90\nG60 X0\nG0 X0 Y0';
    const includeFileInfo = document.getElementById('includeFileInfo')?.checked || false;
    const includeBounds = document.getElementById('includeBounds')?.checked || false;
    const includeSetCount = document.getElementById('includeSetCount')?.checked || false;
    const includeProgramStart = document.getElementById('includeProgramStart')?.checked || false;
    
    let preview = '<strong>Header Preview:</strong><br><br>';
    
    // Program start marker
    if (includeProgramStart) {
        preview += '<span class="header-command">%1</span><br>';
    }
    
    // Comment header with file info
    if (includeFileInfo) {
        const mockTemplate = headerTemplate
            .replace('{filename}', 'example.dxf')
            .replace('{width}', '100.0')
            .replace('{height}', '50.0')
            .replace('{timestamp}', new Date().toLocaleString());
        preview += `<span class="header-comment">{ ${mockTemplate}</span><br>`;
    }
    
    // Bounds information
    if (includeBounds) {
        preview += '<span class="header-comment">{ BOUNDS: X0.0 Y0.0 to X100.0 Y50.0</span><br>';
    }
    
    // Operation count
    if (includeSetCount) {
        preview += '<span class="header-comment">{ OPERATIONS: 25</span><br>';
    }
    
    // Scaling header for inch machines
    if (machineType === 'inch_with_scaling' && enableScaling) {
        preview += `<span class="header-parameter">${scalingParameter}</span><br>`;
        preview += `<span class="header-command">${scaleCommand}</span><br>`;
        preview += '<span class="header-comment">{ Bei Bedarf nach inch skalieren</span><br>';
    }
    // Setup commands
    if (setupCommands.trim()) {
        const commands = setupCommands.split('\n').filter(cmd => cmd.trim());
        commands.forEach(cmd => {
            preview += `<span class="header-command">${cmd.trim()}</span><br>`;
        });
    }
    
    preview += '<span class="header-comment">{ BEGIN CUTTING OPERATIONS...</span>';
    
    previewContainer.innerHTML = preview;
}

// Postprocessor profile management
function initializePostprocessorManagement() {
    const postprocessorProfileSelect = document.getElementById('postprocessorProfile');
    
    // Profile selection change handler
    postprocessorProfileSelect?.addEventListener('change', async function() {
        const selectedProfile = this.value;
        if (selectedProfile && selectedProfile !== 'custom') {
            // Save the selected profile preference
            localStorage.setItem('lastSelectedProfile', selectedProfile);
            console.log('Profile preference saved:', selectedProfile);
            
            // Also save to main process for persistence
            try {
                await window.electronAPI.saveActiveProfile(selectedProfile);
            } catch (error) {
                console.error('Failed to save active profile to main process:', error);
            }
            
            // Check if it's an XML profile (ends with .xml)
            if (selectedProfile.endsWith('.xml')) {
                loadXmlProfileConfiguration(selectedProfile);
            } else {
                loadPostprocessorConfiguration(selectedProfile);
            }
        }
    });
    
    // Load available XML profiles into dropdown
    loadAvailableXmlProfiles();
    
    // Profile management buttons have been moved to Output Manager
    // Only the profile dropdown and Output Manager button remain in the main UI
}

// Get the currently selected profile filename
function getCurrentProfileFilename() {
    const select = document.getElementById('postprocessorProfile');
    return select?.value && select.value !== 'custom' ? select.value : null;
}
// Load available XML profiles into dropdown
async function loadAvailableXmlProfiles() {
    try {
        const profiles = await window.electronAPI.loadXmlProfiles();
        const select = document.getElementById('postprocessorProfile');
        
        if (!select) return;
        
        // Store current selection to maintain it after refresh
        const currentSelection = select.value;
        
        // Clear existing options except the custom option
        const customOption = select.querySelector('option[value="custom"]');
        select.innerHTML = '';
        
        // Add XML profiles
        profiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.filename;
            option.textContent = profile.name;
            option.title = profile.description;
            select.appendChild(option);
        });
        
        // Re-add custom option
        if (customOption) {
            select.appendChild(customOption);
        }
        
        // Restore previous selection if it still exists, otherwise try to restore saved preference
        if (currentSelection && select.querySelector(`option[value="${currentSelection}"]`)) {
            select.value = currentSelection;
        } else {
            // Try to restore saved profile preference
            const savedProfileName = localStorage.getItem('lastSelectedProfile');
            if (savedProfileName && select.querySelector(`option[value="${savedProfileName}"]`)) {
                select.value = savedProfileName;
                console.log('Restored saved profile preference:', savedProfileName);
            } else if (profiles.length > 0) {
                select.value = profiles[0].filename;
            }
        }
        
        return profiles;
        
    } catch (error) {
        console.error('Error loading XML profiles:', error);
        showStatus('Failed to load XML profiles', 'error');
        return [];
    }
}

// Refresh the profile dropdown (call this after creating/copying/deleting profiles)
async function refreshProfileDropdown() {
    await loadAvailableXmlProfiles();
    showStatus('Profile list refreshed', 'info');
}

// Load first available profile or create default if none exist
async function loadFirstAvailableProfile() {
    try {
        const profiles = await loadAvailableXmlProfiles();
        
        if (profiles.length > 0) {
            // Check for saved profile preference
            const savedProfileName = localStorage.getItem('lastSelectedProfile');
            let profileToLoad = null;
            
            if (savedProfileName) {
                // Try to find the saved profile in available profiles
                profileToLoad = profiles.find(p => 
                    p.filename === savedProfileName || 
                    p.name === savedProfileName ||
                    p.filename.replace('.xml', '') === savedProfileName.replace('.xml', '')
                );
                
                if (profileToLoad) {
                    console.log('Loading saved profile preference:', profileToLoad.name);
                } else {
                    console.log('Saved profile not found, using first available profile');
                }
            }
            
            // If no saved profile or saved profile not found, use first available
            if (!profileToLoad) {
                profileToLoad = profiles[0];
            }
            
            const select = document.getElementById('postprocessorProfile');
            if (select) {
                select.value = profileToLoad.filename;
            }
            await loadXmlProfileConfiguration(profileToLoad.filename);
            
            // Save the loaded profile as the current preference
            localStorage.setItem('lastSelectedProfile', profileToLoad.filename);
            console.log('Set current profile preference:', profileToLoad.filename);
            
            // Also save to main process for persistence
            try {
                await window.electronAPI.saveActiveProfile(profileToLoad.filename);
            } catch (error) {
                console.error('Failed to save active profile to main process:', error);
            }
        } else {
            // No profiles exist, create a default one
            console.log('No XML profiles found, creating default profile');
            await createDefaultProfile();
        }
    } catch (error) {
        console.error('Error loading first available profile:', error);
        // Fallback to default configuration
        currentPostprocessorConfig = getDefaultConfiguration();
        applyConfigurationToUI(currentPostprocessorConfig);
        showStatus('Loaded fallback configuration', 'warning');
    }
}

// Create default profile if none exist
async function createDefaultProfile() {
    try {
        const defaultConfig = getDefaultConfiguration();
        defaultConfig.profileInfo.name = 'Default Profile';
        defaultConfig.profileInfo.description = 'Auto-created default profile';
        
        await window.electronAPI.saveXmlProfile('default_profile.xml', defaultConfig);
        await refreshProfileDropdown();
        
        const select = document.getElementById('postprocessorProfile');
        if (select) {
            select.value = 'default_profile.xml';
        }
        await loadXmlProfileConfiguration('default_profile.xml');
        
        // Save the newly created profile as the preference
        localStorage.setItem('lastSelectedProfile', 'default_profile.xml');
        console.log('Set newly created profile as preference: default_profile.xml');
        
        // Also save to main process for persistence
        try {
            await window.electronAPI.saveActiveProfile('default_profile.xml');
        } catch (error) {
            console.error('Failed to save active profile to main process:', error);
        }
        
        showStatus('Created default profile', 'success');
    } catch (error) {
        console.error('Error creating default profile:', error);
        currentPostprocessorConfig = getDefaultConfiguration();
        applyConfigurationToUI(currentPostprocessorConfig);
        showStatus('Using fallback configuration', 'warning');
    }
}

// Tool management initialization
async function initializeToolManagement() {
    const toolLibrarySelect = document.getElementById('toolLibrary');
    const manageToolsBtn = document.getElementById('manageToolsBtn');
    
    toolLibrarySelect?.addEventListener('change', function() {
        loadToolLibrary(this.value);
    });
    
    manageToolsBtn?.addEventListener('click', () => {
        openToolsManager();
    });
    
    // Load tools from profile instead of JSON file
    try {
        const currentTools = await getCurrentToolSet();
        displayToolPreview({ tools: currentTools });
    } catch (error) {
        console.error('Error loading tools from profile:', error);
        // Fallback to default tools
        const defaultTools = {
            'T1': { name: 'Fine Engraving', width: 0.1, description: 'Precision engraving tool', hCode: 'H20' },
            'T2': { name: 'Standard Cutting', width: 0.2, description: 'General purpose cutting', hCode: 'H12' },
            'T3': { name: 'Perforation', width: 0.15, description: 'Perforation lines', hCode: 'H15' },
            'T4': { name: 'Heavy Cutting', width: 0.3, description: 'Thick material cutting', hCode: 'H08' }
        };
        displayToolPreview({ tools: defaultTools });
    }
}
// Load and display tool library
async function loadToolLibrary(libraryName) {
    try {
        const toolConfig = await window.electronAPI.loadToolLibrary(libraryName);
        displayToolPreview(toolConfig);
        
    } catch (error) {
        console.error('Error loading tool library:', error);
        showStatus(`Failed to load tool library: ${error.message}`, 'error');
    }
}

// Display tool preview cards
function displayToolPreview(toolConfig) {
    const toolGrid = document.querySelector('.tool-grid');
    if (!toolGrid || !toolConfig.tools) return;
    
    toolGrid.innerHTML = '';
    
    // Handle both array and object formats
    if (Array.isArray(toolConfig.tools)) {
        // Array format (from standard_tools.json)
        toolConfig.tools.forEach(tool => {
            const toolCard = document.createElement('div');
            toolCard.className = 'tool-card';
            toolCard.dataset.toolId = tool.id;
            
            toolCard.innerHTML = `
                <div class="tool-name">${tool.id}: ${tool.name}</div>
                <div class="tool-details">
                    <div>Width: <span class="tool-width">${tool.width}mm</span></div>
                    <div>H-Code: <span class="tool-hcode">${tool.hCode}</span></div>
                    <div>Type: <span class="tool-type">${tool.description}</span></div>
                </div>
            `;
            
            toolCard.addEventListener('click', () => {
                document.querySelectorAll('.tool-card').forEach(card => card.classList.remove('selected'));
                toolCard.classList.add('selected');
            });
            
            toolGrid.appendChild(toolCard);
        });
    } else {
        // Object format (from profile)
    Object.entries(toolConfig.tools).forEach(([toolId, tool]) => {
        const toolCard = document.createElement('div');
        toolCard.className = 'tool-card';
        toolCard.dataset.toolId = toolId;
        
        toolCard.innerHTML = `
            <div class="tool-name">${toolId}: ${tool.name}</div>
            <div class="tool-details">
                <div>Width: <span class="tool-width">${tool.width}mm</span></div>
                <div>H-Code: <span class="tool-hcode">${tool.hCode}</span></div>
                    <div>Type: <span class="tool-type">${tool.description}</span></div>
            </div>
        `;
        
        toolCard.addEventListener('click', () => {
            document.querySelectorAll('.tool-card').forEach(card => card.classList.remove('selected'));
            toolCard.classList.add('selected');
        });
        
        toolGrid.appendChild(toolCard);
    });
    }
}
// DIN file generation and preview
function initializeDinGeneration() {
    const previewDinBtn = document.getElementById('previewDinBtn');
    const generateDinBtn = document.getElementById('generateDinBtn');
    const advancedPreviewBtn = document.getElementById('advancedPreviewBtn');
    
    previewDinBtn?.addEventListener('click', async () => {
        await previewDinFile();
    });
    
    advancedPreviewBtn?.addEventListener('click', async () => {
        await showAdvancedVisualization();
    });
    
    generateDinBtn?.addEventListener('click', async () => {
    console.log('=== OUTPUT TAB BUTTON CLICKED ===');
    // Validate layer mappings and visibility before generating
    const validation = validateLayerMappings();
    
    if (validation.warnings.length > 0) {
        console.log('Showing layer validation warning modal');
        // Show warning modal and let user decide
        showLayerValidationWarning(validation);
    } else {
        console.log('Showing layer processing confirmation modal');
        // No issues, but still show confirmation dialog with layers that will be processed
        showLayerProcessingConfirmation(validation);
    }
});
    
    // Initialize file output settings
    initializeFileOutputSettings();
}

// Preview DIN file content
async function previewDinFile() {
    try {
        if (!currentPostprocessorConfig) {
            showStatus('Load a supported file (DXF/DDS/CFF2) and configure postprocessor first', 'warning');
            return;
        }
        
        // Check for either DXF viewer (with scene) or unified format viewer (with overlayCanvas)
        const hasDxfViewer = !!(viewer && viewer.scene);
        const hasUnifiedViewer = !!(overlayCanvas && window.unifiedGeometries && window.unifiedGeometries.length > 0);
        
        if (!hasDxfViewer && !hasUnifiedViewer) {
            showStatus('Load a supported file (DXF/DDS/CFF2) and configure postprocessor first', 'warning');
            return;
        }

        showStatus('Generating DIN preview...', 'info');

        // Extract entities from viewer
        const entities = extractEntitiesFromViewer();
        if (entities.length === 0) {
            showStatus('No entities found to process', 'warning');
            return;
        }

        // Get current settings
        const settings = getCurrentOptimizationSettings();
        
        // Generate preview
        const metadata = getFileMetadata();
        const previewContent = dinGenerator.generatePreview(entities, currentPostprocessorConfig, metadata);
        
        // Show preview in modal or new window
        showDinPreview(previewContent);
        
        showStatus(`Generated DIN preview for ${entities.length} entities`, 'success');

    } catch (error) {
        console.error('Error generating DIN preview:', error);
        showStatus(`Failed to generate DIN preview: ${error.message}`, 'error');
    }
}

// Show advanced 2D visualization
async function showAdvancedVisualization() {
    try {
        if (!currentPostprocessorConfig) {
            showStatus('Load a supported file (DXF/DDS/CFF2) and configure postprocessor first', 'warning');
            return;
        }
        
        // Check for either DXF viewer (with scene) or unified format viewer (with overlayCanvas)
        const hasDxfViewer = !!(viewer && viewer.scene);
        const hasUnifiedViewer = !!(overlayCanvas && window.unifiedGeometries && window.unifiedGeometries.length > 0);
        
        if (!hasDxfViewer && !hasUnifiedViewer) {
            showStatus('Load a supported file (DXF/DDS/CFF2) and configure postprocessor first', 'warning');
            return;
        }

        showStatus('Generating DIN content for visualization...', 'info');

        // Use the same exact DIN generation process as the "Generate DIN" button
        // but without saving to file - this ensures we visualize exactly what the machine will see
        const dinContent = await generateDinContentSilently();

        if (!dinContent || dinContent.trim().length === 0) {
            showStatus('Generated DIN content is empty', 'warning');
            return;
        }

        showStatus('Parsing DIN content for visualization...', 'info');

        // Get current tool set for legend
        const tools = await getCurrentToolSet();

        // Create and initialize advanced visualization with actual DIN content
        const advancedViz = new AdvancedVisualization();
        await advancedViz.initializeFromDinContent(dinContent, tools);
        
        // Count actual DIN lines for status
        const dinLines = dinContent.split('\n').filter(line => line.trim().length > 0);
        showStatus(`Advanced visualization ready with ${dinLines.length} DIN commands`, 'success');

    } catch (error) {
        console.error('Error showing advanced visualization:', error);
        showStatus(`Failed to show advanced visualization: ${error.message}`, 'error');
    }
}
// Generate DIN content silently (same logic as performDinGeneration but without file saving)
async function generateDinContentSilently() {
    console.log('=== GENERATE DIN CONTENT SILENTLY CALLED ===');
    try {

        
        if (!currentPostprocessorConfig) {
            throw new Error('Load a supported file (DXF/DDS/CFF2) and configure postprocessor first');
        }
        
        // Check for either DXF viewer (with scene) or unified format viewer (with overlayCanvas)
        const hasDxfViewer = !!(viewer && viewer.scene);
        const hasUnifiedViewer = !!(overlayCanvas && window.unifiedGeometries && window.unifiedGeometries.length > 0);
        
        if (!hasDxfViewer && !hasUnifiedViewer) {
            throw new Error('Load a supported file (DXF/DDS/CFF2) and configure postprocessor first');
        }

        // VALIDATION: Check layer mappings BEFORE proceeding
        const layerValidation = validateLayerMappings();
        console.log('Layer mapping validation result:', layerValidation);
        
        if (!layerValidation.valid) {
            if (layerValidation.unmappedLayers.length > 0) {
                const unmappedNames = layerValidation.unmappedLayers.map(l => l.name).join(', ');
                throw new Error(`Cannot generate DIN: ${layerValidation.unmappedLayers.length} layer(s) are unmapped: ${unmappedNames}. Please map all layers to line types before generating.`);
            } else if (layerValidation.includedLayers.length === 0) {
                throw new Error(`Cannot generate DIN: No layers are visible and mapped. Please ensure at least one layer is both visible (checked) and mapped to a line type.`);
            } else {
                throw new Error(`Cannot generate DIN: Layer validation failed. Please check layer mappings and visibility.`);
            }
        }

        // Load line types from CSV to pass to DinGenerator
        let lineTypesData = [];
        try {
            lineTypesData = await window.electronAPI.loadLineTypes();
            console.log('Loaded line types for DIN generation:', lineTypesData.length);
        } catch (error) {
            console.warn('Failed to load line types, using fallback:', error);
        }

        // Extract entities from viewer, filtering by visibility and mappings
        let entities = [];
        
        if (hasDxfViewer) {
            console.log('Using DXF entity extraction');
            entities = extractEntitiesFromViewer(true); // true = respect layer visibility AND mappings
        } else if (hasUnifiedViewer) {
            console.log('Using unified format entity extraction');
            entities = extractEntitiesFromUnifiedFormat(true); // true = respect layer visibility AND mappings
        } else {
            throw new Error('No valid viewer data found. Please load a supported file.');
        }
        
        if (entities.length === 0) {
            throw new Error('No valid entities found to process. Ensure layers are visible and properly mapped.');
        }

        // Validate that all entities have line types
        const entitiesWithoutLineTypes = entities.filter(e => !e.lineType);
        if (entitiesWithoutLineTypes.length > 0) {
            throw new Error(`${entitiesWithoutLineTypes.length} entities do not have line type mappings. Please ensure all visible layers are properly mapped.`);
        }

        // Create config with line types data
        const configWithLineTypes = {
            ...currentPostprocessorConfig,
            lineTypes: lineTypesData
        };

        // Generate DIN content
        const metadata = getFileMetadata();
        console.log('Generating DIN content silently with:', {
            entitiesCount: entities.length,
            config: configWithLineTypes,
            metadata: metadata
        });

        // Validate lineType-to-tool mappings exist
        if (!currentPostprocessorConfig.mappingWorkflow) {
            currentPostprocessorConfig.mappingWorkflow = {};
        }
        if (!currentPostprocessorConfig.mappingWorkflow.lineTypeToTool) {
            currentPostprocessorConfig.mappingWorkflow.lineTypeToTool = [];
        }

        // Check for entities with line types but no tool mappings
        const usedLineTypes = [...new Set(entities.map(e => e.lineType).filter(Boolean))];
        const existingMappings = currentPostprocessorConfig.mappingWorkflow.lineTypeToTool.map(m => m.lineType);
        const unmappedLineTypes = usedLineTypes.filter(lt => !existingMappings.includes(lt));

        if (unmappedLineTypes.length > 0) {
            // Try auto-mapping by name matching with available tools from postprocessor profile
            console.log('Attempting auto-mapping for unmapped line types:', unmappedLineTypes);
            
            let machineTools = null;
            if (currentPostprocessorConfig.tools && Array.isArray(currentPostprocessorConfig.tools)) {
                machineTools = currentPostprocessorConfig.tools;
            } else if (currentPostprocessorConfig.tools && typeof currentPostprocessorConfig.tools === 'object') {
                machineTools = Object.values(currentPostprocessorConfig.tools);
            }

            if (machineTools && machineTools.length > 0) {
                const autoMapped = [];
                unmappedLineTypes.forEach(lineTypeName => {
                    const matchingTool = machineTools.find(tool => 
                        tool.name === lineTypeName || 
                        tool.Name === lineTypeName ||
                        tool.id === lineTypeName ||
                        tool.ID === lineTypeName
                    );
                    
                    if (matchingTool) {
                        const toolId = matchingTool.id || matchingTool.ID;
                        console.log(`Auto-mapping internal line type "${lineTypeName}" to machine tool "${toolId}"`);
                        currentPostprocessorConfig.mappingWorkflow.lineTypeToTool.push({
                            lineType: lineTypeName,
                            tool: toolId
                        });
                        autoMapped.push(lineTypeName);
                    }
                });
                
                // Check if any line types are still unmapped after auto-mapping
                const stillUnmapped = unmappedLineTypes.filter(lt => !autoMapped.includes(lt));
                if (stillUnmapped.length > 0) {
                    throw new Error(`Cannot generate DIN: Line types [${stillUnmapped.join(', ')}] are not mapped to tools. Please configure tool mappings in the postprocessor profile.`);
                }
            } else {
                throw new Error(`Cannot generate DIN: Line types [${unmappedLineTypes.join(', ')}] are not mapped to tools, and no tools are available for auto-mapping.`);
            }
        }

        // Generate the actual DIN content using the same function as file generation
    // Get bridge setting from Output Manager (Output Settings tab)
    const outputSettings = currentPostprocessorConfig?.outputSettings || {};
    const enableBridges = outputSettings.enableBridges !== false; // Default to true if not set
    
    console.log('Bridge configuration from Output Settings:', {
        outputSettings,
        enableBridges,
        currentPostprocessorConfig: currentPostprocessorConfig?.outputSettings,
        fullConfig: currentPostprocessorConfig
    });
    
    // Set bridge configuration for DIN generation
    configWithLineTypes.bridges = configWithLineTypes.bridges || {};
    configWithLineTypes.bridges.enabled = enableBridges;
    console.log('Bridge configuration set for DIN generation:', configWithLineTypes.bridges);
    
    console.log('=== ABOUT TO CALL dinGenerator.generateDin() FROM generateDinContentSilently ===');
    console.log('Entities being sent to DinGenerator:', entities.length);
    entities.forEach((entity, index) => {
        console.log(`Entity ${index}:`, {
            type: entity.type,
            layer: entity.layer,
            bridgeCount: entity.bridgeCount,
            bridgeWidth: entity.bridgeWidth,
            hasBridges: !!entity.bridges,
            bridgesLength: entity.bridges?.length
        });
    });
    
    const dinContent = dinGenerator.generateDin(entities, configWithLineTypes, metadata);
        console.log('DIN generation completed, content length:', dinContent.length);
        
        // Validate DIN content
        const validation_din = dinGenerator.validateDin(dinContent);
        if (!validation_din.valid) {
            throw new Error(`DIN validation failed: ${validation_din.issues.join(', ')}`);
        }

        return dinContent;

    } catch (error) {
        console.error('Error generating DIN content silently:', error);
        throw error;
    }
}

// Make the functions globally available for header controls
window.generateDinContentSilently = generateDinContentSilently;
window.saveDinFile = saveDinFile;

// ===== SILENT BATCH PROCESSING FUNCTIONS =====
// These functions simulate the "Open DXF" and "Generate DIN" workflows but silently

/**
 * Load DXF file silently for batch processing
 * Simulates the "Open DXF" button workflow but without UI updates
 * @param {string} filePath - Path to the DXF file
 * @returns {Promise<{success: boolean, filename?: string, layers?: number, error?: string}>}
 */
async function loadDxfFileSilently(filePath) {
    try {
        console.log(`[Silent Load] Loading DXF file: ${filePath}`);
        
        // Read the file content
        const fileResult = await window.electronAPI.readFile(filePath);
        
        if (!fileResult.success) {
            throw new Error(`Failed to read file: ${fileResult.error}`);
        }
        
        // Extract filename
        const filename = filePath.split('/').pop() || filePath.split('\\').pop();
        
        // Load the DXF content (this will parse, process layers, and update the viewer)
        await loadDxfContent(filename, fileResult.content, filePath);
        
        // Wait a moment for processing to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if layers were loaded successfully
        const layerData = window.currentLayerData;
        if (!layerData || layerData.length === 0) {
            throw new Error('No layers found in DXF file');
        }
        
        console.log(`[Silent Load] Successfully loaded ${filename} with ${layerData.length} layers`);
        
        return {
            success: true,
            filename: filename,
            layers: layerData.length
        };
        
    } catch (error) {
        console.error(`[Silent Load] Error loading DXF file:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}
/**
 * Check if all layers are mapped and ready for generation
 * Uses the same validation logic as the header controls
 * @returns {boolean} True if ready for generation
 */
function checkLayerMappingStatus() {
    try {
        // For silent processing, we need to check layer mappings without relying on UI state
        if (!currentLayerData) {
            console.log(`[Silent Check] No layer data available`);
            return false;
        }
        
        const totalLayers = currentLayerData.length;
        let mappedLayers = 0;
        let visibleMappedLayers = 0;
        
        currentLayerData.forEach((layer, index) => {
            const isMapped = layer.importFilterApplied || layer.lineType;
            
            if (isMapped) {
                mappedLayers++;
                // For silent processing, assume all mapped layers are "visible"
                // since we want to process all properly mapped content
                visibleMappedLayers++;
            }
        });
        
        const isReady = totalLayers > 0 && 
                       mappedLayers > 0 && 
                       visibleMappedLayers > 0 &&
                       mappedLayers === totalLayers; // All layers must be mapped for batch processing
        
        console.log(`[Silent Check] Ready for generation: ${isReady}`);
        console.log(`[Silent Check] Details: Total=${totalLayers}, Mapped=${mappedLayers}, Visible=${visibleMappedLayers}, AllMapped=${mappedLayers === totalLayers}`);
        
        if (!isReady) {
            const unmappedCount = totalLayers - mappedLayers;
            console.log(`[Silent Check] Generation blocked: ${unmappedCount} unmapped layers out of ${totalLayers}`);
        }
        
        return isReady;
        
    } catch (error) {
        console.error(`[Silent Check] Error checking layer mapping status:`, error);
        return false;
    }
}
/**
 * Generate DIN content and save to file silently
 * Simulates the "Generate DIN" button workflow but without UI interaction
 * @param {string} outputPath - Path where to save the DIN file
 * @returns {Promise<{success: boolean, outputPath?: string, error?: string}>}
 */
async function generateDinFileSilently(outputPath) {
    try {
        console.log(`[Silent Generate] Generating DIN file: ${outputPath}`);
        
        // Check if we're ready for generation
        if (!checkLayerMappingStatus()) {
            throw new Error('Layer mappings are incomplete or no visible mapped layers found');
        }
        
        // Generate DIN content using the existing function
        const dinContent = await generateDinContentSilently();
        
        if (!dinContent || dinContent.trim().length === 0) {
            throw new Error('Generated DIN content is empty');
        }
        
        // Save the file using the available electronAPI
        // Extract filename and directory from the output path
        const pathParts = outputPath.split('/');
        const filename = pathParts[pathParts.length - 1];
        const savePath = pathParts.slice(0, -1).join('/');
        
        let saveResult;
        if (window.electronAPI && window.electronAPI.saveDinFile) {
            // Use the saveDinFile method which is designed for DIN files
            saveResult = await window.electronAPI.saveDinFile(dinContent, filename, savePath);
        } else {
            throw new Error('electronAPI.saveDinFile not available');
        }
        
        if (!saveResult.success) {
            throw new Error(`Failed to save DIN file: ${saveResult.error}`);
        }
        
        console.log(`[Silent Generate] Successfully generated DIN file: ${outputPath}`);
        console.log(`[Silent Generate] DIN content length: ${dinContent.length} characters`);
        
        return {
            success: true,
            outputPath: outputPath
        };
        
    } catch (error) {
        console.error(`[Silent Generate] Error generating DIN file:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Complete silent batch processing workflow
 * Combines load + validation + generation in one function
 * @param {string} inputPath - Path to input DXF file
 * @param {string} outputPath - Path to output DIN file
 * @returns {Promise<{success: boolean, outputPath?: string, filename?: string, error?: string, reason?: string}>}
 */
async function processDxfFileSilently(inputPath, outputPath) {
    console.log(`[Silent Process] Starting batch processing: ${inputPath} → ${outputPath}`);
    
    try {
        // Step 1: Load DXF file
        const loadResult = await loadDxfFileSilently(inputPath);
        
        if (!loadResult.success) {
            return {
                success: false,
                error: `Failed to load DXF: ${loadResult.error}`,
                reason: 'load_failed'
            };
        }
        
        // Step 2: Check layer mappings
        const isReady = checkLayerMappingStatus();
        
        if (!isReady) {
            return {
                success: false,
                error: 'Layer mappings are incomplete or no visible mapped layers found',
                reason: 'incomplete_mappings',
                filename: loadResult.filename
            };
        }
        
        // Step 3: Generate DIN file
        const generateResult = await generateDinFileSilently(outputPath);
        
        if (!generateResult.success) {
            return {
                success: false,
                error: `Failed to generate DIN: ${generateResult.error}`,
                reason: 'generation_failed',
                filename: loadResult.filename
            };
        }
        
        console.log(`[Silent Process] Successfully processed: ${inputPath} → ${outputPath}`);
        
        return {
            success: true,
            outputPath: generateResult.outputPath,
            filename: loadResult.filename
        };
        
    } catch (error) {
        console.error(`[Silent Process] Unexpected error:`, error);
        return {
            success: false,
            error: `Unexpected error: ${error.message}`,
            reason: 'unexpected_error'
        };
    }
}
// Make silent batch processing functions globally available
window.loadDxfFileSilently = loadDxfFileSilently;
window.checkLayerMappingStatus = checkLayerMappingStatus;
window.generateDinFileSilently = generateDinFileSilently;
window.processDxfFileSilently = processDxfFileSilently;
// Generate and save DIN file
async function performDinGeneration() {
    console.log('=== PERFORM DIN GENERATION STARTED ===');
    try {
        if (!currentPostprocessorConfig) {
            showStatus('Load a supported file (DXF/DDS/CFF2) and configure postprocessor first', 'warning');
            return;
        }
        
        // Check for either DXF viewer (with scene) or unified format viewer (with overlayCanvas)
        const hasDxfViewer = !!(viewer && viewer.scene);
        const hasUnifiedViewer = !!(overlayCanvas && window.unifiedGeometries && window.unifiedGeometries.length > 0);
        
        if (!hasDxfViewer && !hasUnifiedViewer) {
            showStatus('Load a supported file (DXF/DDS/CFF2) and configure postprocessor first', 'warning');
            return;
        }

        // VALIDATION: Check layer mappings BEFORE proceeding
        const layerValidation = validateLayerMappings();
        console.log('Layer mapping validation result:', layerValidation);
        
        if (!layerValidation.valid) {
            if (layerValidation.unmappedLayers.length > 0) {
                const unmappedNames = layerValidation.unmappedLayers.map(l => l.name).join(', ');
                showStatus(`Cannot generate DIN: ${layerValidation.unmappedLayers.length} layer(s) are unmapped: ${unmappedNames}. Please map all layers to line types.`, 'error');
            } else if (layerValidation.includedLayers.length === 0) {
                showStatus(`Cannot generate DIN: No layers are visible and mapped. Please ensure at least one layer is both visible (checked) and mapped to a line type.`, 'error');
            } else {
                showStatus(`Cannot generate DIN: Layer validation failed. Please check layer mappings and visibility.`, 'error');
            }
            
            // Show detailed validation warning
            showLayerValidationWarning(layerValidation);
            return;
        }

        showStatus('Generating DIN file...', 'info');

        // Load line types from CSV to pass to DinGenerator
        let lineTypesData = [];
        try {
            lineTypesData = await window.electronAPI.loadLineTypes();
            console.log('Loaded line types for DIN generation:', lineTypesData.length);
        } catch (error) {
            console.warn('Failed to load line types, using fallback:', error);
        }

        // Extract entities from viewer, filtering by visibility and mappings
        let entities = [];
        
        // Check if we have DXF viewer or unified format
        if (viewer && viewer.scene) {
            // DXF format - use DXF entity extraction
            entities = extractEntitiesFromViewer(true); // true = respect layer visibility
        } else if (overlayCanvas && window.unifiedGeometries && window.unifiedGeometries.length > 0) {
            // Unified format (DDS/CFF2) - use unified entity extraction
            entities = extractEntitiesFromUnifiedFormat(true); // true = respect layer visibility
        }
        
        if (entities.length === 0) {
            showStatus('No entities found to process', 'warning');
            return;
        }
        
        console.log('=== ENTITIES EXTRACTED SUCCESSFULLY, COUNT:', entities.length, '===');

        // Get bridge setting from Output Manager (Output Settings tab)
        const outputSettings = currentPostprocessorConfig?.outputSettings || {};
        const enableBridges = outputSettings.enableBridges !== false; // Default to true if not set
        
        console.log('Bridge configuration from Output Settings:', {
            outputSettings,
            enableBridges,
            currentPostprocessorConfig: currentPostprocessorConfig?.outputSettings,
            fullConfig: currentPostprocessorConfig
        });
        
        // Get current settings
        const settings = getCurrentOptimizationSettings();
        
        // Note: Layer mapping warnings are now handled by the advanced visualization
        // No need for redundant status bar warnings
        
        // Create config with line types data and bridge settings
        const configWithLineTypes = {
            ...currentPostprocessorConfig,
            lineTypes: lineTypesData,
            outputSettings: {
                ...currentPostprocessorConfig.outputSettings,
                enableBridges: enableBridges
            }
        };
        
        // Set bridge configuration for DIN generation
        configWithLineTypes.bridges = configWithLineTypes.bridges || {};
        configWithLineTypes.bridges.enabled = enableBridges;
        console.log('Bridge configuration set for DIN generation:', configWithLineTypes.bridges);
        
        // Generate DIN content
        const metadata = getFileMetadata();
        console.log('About to generate DIN with:', {
            entitiesCount: entities.length,
            config: configWithLineTypes,
            metadata: metadata
        });
        console.log('Current mappingWorkflow:', currentPostprocessorConfig.mappingWorkflow);
        console.log('lineTypeToTool mappings:', currentPostprocessorConfig.mappingWorkflow?.lineTypeToTool);
        
        // Auto-create lineType-to-tool mappings if missing
        if (!currentPostprocessorConfig.mappingWorkflow) {
            currentPostprocessorConfig.mappingWorkflow = {};
        }
        if (!currentPostprocessorConfig.mappingWorkflow.lineTypeToTool) {
            currentPostprocessorConfig.mappingWorkflow.lineTypeToTool = [];
        }
        
        // Check for entities with line types but no tool mappings and auto-map by name
        const usedLineTypes = [...new Set(entities.map(e => e.lineType).filter(Boolean))];
        const existingMappings = currentPostprocessorConfig.mappingWorkflow.lineTypeToTool.map(m => m.lineType);
        const unmappedLineTypes = usedLineTypes.filter(lt => !existingMappings.includes(lt));
        
        console.log('Used line types:', usedLineTypes);
        console.log('Existing tool mappings:', existingMappings);
        console.log('Unmapped line types:', unmappedLineTypes);
        
        // Auto-map by name matching with available tools from postprocessor profile
        if (unmappedLineTypes.length > 0) {
            console.log('Looking for tools in postprocessor config');
            console.log('currentPostprocessorConfig.tools:', currentPostprocessorConfig.tools);
            
            // Get tools from postprocessor profile (these are the machine tools like T20, T22, etc.)
            let machineTools = null;
            if (currentPostprocessorConfig.tools && Array.isArray(currentPostprocessorConfig.tools)) {
                machineTools = currentPostprocessorConfig.tools;
            } else if (currentPostprocessorConfig.tools && typeof currentPostprocessorConfig.tools === 'object') {
                // Convert object to array if tools are stored as object
                machineTools = Object.values(currentPostprocessorConfig.tools);
            }
            
            console.log('Machine tools found:', machineTools);
            
            if (machineTools && machineTools.length > 0) {
                unmappedLineTypes.forEach(lineTypeName => {
                    // Stage 2 mapping: Internal line type name → Machine tool
                    // Find machine tool with matching name (e.g., "Fast Engrave" → T20)
                    const matchingTool = machineTools.find(tool => 
                        tool.name === lineTypeName || 
                        tool.Name === lineTypeName ||  // XML uses capital N
                        tool.id === lineTypeName ||
                        tool.ID === lineTypeName      // XML uses capital ID
                    );
                    
                    if (matchingTool) {
                        const toolId = matchingTool.id || matchingTool.ID;
                        console.log(`Auto-mapping internal line type "${lineTypeName}" to machine tool "${toolId}"`);
                        currentPostprocessorConfig.mappingWorkflow.lineTypeToTool.push({
                            lineType: lineTypeName,
                            tool: toolId
                        });
                    } else {
                        console.warn(`No matching machine tool found for internal line type "${lineTypeName}"`);
                        console.log('Available machine tool names:', machineTools.map(t => t.name || t.Name || t.id || t.ID));
                    }
                });
            } else {
                console.warn('No machine tools found in postprocessor config for auto-mapping');
            }
        }
        
        // Log entities with bridges for debugging
        const entitiesWithBridges = entities.filter(e => e.bridges && e.bridges.length > 0);
        console.log(`Found ${entitiesWithBridges.length} entities with bridges out of ${entities.length} total entities`);
        entitiesWithBridges.forEach((entity, index) => {
            console.log(`Entity ${index}: ${entity.type} with ${entity.bridges.length} bridges of width ${entity.bridges[0]?.width || 'unknown'}`);
        });
        
        // DEBUG: Log ALL entities to see their structure
        console.log('=== ALL ENTITIES BEING SENT TO DIN GENERATOR ===');
        entities.forEach((entity, index) => {
            console.log(`Entity ${index}:`, {
                type: entity.type,
                layer: entity.layer,
                bridgeCount: entity.bridgeCount,
                bridgeWidth: entity.bridgeWidth,
                hasBridges: !!entity.bridges,
                bridgesLength: entity.bridges?.length,
                bridges: entity.bridges
            });
        });
        console.log('=== END ENTITIES DEBUG ===');
        
        console.log('=== ABOUT TO CALL dinGenerator.generateDin() ===');
        const dinContent = dinGenerator.generateDin(entities, configWithLineTypes, metadata);
        console.log('DIN generation completed, content length:', dinContent.length);
        
        // Validate DIN content
        const validation = dinGenerator.validateDin(dinContent);
        if (!validation.valid) {
            showStatus(`DIN validation failed: ${validation.issues.join(', ')}`, 'error');
            return;
        }

        // Save file using Electron API - let saveDinFile handle filename generation from profile
        await saveDinFile(dinContent, null, validation.stats);
        
        // Remove the old status message since we now show a success dialog
        // showStatus(`Generated DIN file with ${validation.stats.totalLines} lines`, 'success');

    } catch (error) {
        console.error('Error generating DIN file:', error);
        showStatus(`Failed to generate DIN file: ${error.message}`, 'error');
    }
}
// Initialize file output settings
function initializeFileOutputSettings() {
    const browseSavePathBtn = document.getElementById('browsePathBtn');
    const clearSavePathBtn = document.getElementById('clearPathBtn');
    const defaultSavePathInput = document.getElementById('defaultSavePath');
    const filenameFormatInput = document.getElementById('filenameTemplate');
    const autoSaveEnabledCheckbox = document.getElementById('autoSaveEnabled');
    
    // Load saved settings
    loadFileOutputSettings();
    
    // Browse button event
    browseSavePathBtn?.addEventListener('click', async () => {
        try {
            const result = await window.electronAPI.showDirectoryDialog();
            if (result && result.filePaths && result.filePaths.length > 0) {
                const selectedPath = result.filePaths[0];
                defaultSavePathInput.value = selectedPath;
                saveFileOutputSettings();
                showStatus('Default save location updated', 'success');
            }
        } catch (error) {
            console.error('Error selecting directory:', error);
            showStatus('Failed to select directory', 'error');
        }
    });
    
    // Clear button event
    clearSavePathBtn?.addEventListener('click', () => {
        defaultSavePathInput.value = '';
        saveFileOutputSettings();
        showStatus('Default save location cleared', 'success');
    });
    
    // Filename format change event
    filenameFormatInput?.addEventListener('input', () => {
        saveFileOutputSettings();
    });
    
    // Auto-save checkbox change event
    autoSaveEnabledCheckbox?.addEventListener('change', () => {
        saveFileOutputSettings();
    });
}

// Load file output settings from current profile
function loadFileOutputSettings() {
    if (!currentPostprocessorConfig) return;
    
    const defaultSavePathInput = document.getElementById('defaultSavePath');
    const filenameFormatInput = document.getElementById('filenameTemplate');
    const autoSaveEnabledCheckbox = document.getElementById('autoSaveEnabled');
    
    // Load from configuration
    const outputSettings = currentPostprocessorConfig.outputSettings || {};
    
    if (defaultSavePathInput) {
        defaultSavePathInput.value = outputSettings.defaultSavePath || '';
    }
    
    if (filenameFormatInput) {
        filenameFormatInput.value = outputSettings.filenameFormat || '{original_name}.din';
    }
    
    if (autoSaveEnabledCheckbox) {
        autoSaveEnabledCheckbox.checked = outputSettings.autoSaveEnabled !== false;
    }
    
    // Load bridge setting
    const enableBridgesCheckbox = document.getElementById('enableBridges');
    if (enableBridgesCheckbox) {
        enableBridgesCheckbox.checked = outputSettings.enableBridges !== false;
    }
}
// Save file output settings to current profile (SAFE UPDATE - no data loss)
async function saveFileOutputSettings() {
    const defaultSavePathInput = document.getElementById('defaultSavePath');
    const filenameFormatInput = document.getElementById('filenameTemplate');
    const autoSaveEnabledCheckbox = document.getElementById('autoSaveEnabled');
    
    // Prepare output settings object
    const outputSettings = {
        defaultSavePath: defaultSavePathInput?.value || '',
        filenameFormat: filenameFormatInput?.value || '{original_name}.din',
        autoSaveEnabled: autoSaveEnabledCheckbox?.checked !== false,
        enableBridges: document.getElementById('enableBridges')?.checked !== false
    };
    
    // Update local configuration (for immediate use)
    if (currentPostprocessorConfig) {
        if (!currentPostprocessorConfig.outputSettings) {
            currentPostprocessorConfig.outputSettings = {};
        }
        currentPostprocessorConfig.outputSettings = { ...outputSettings };
    }
    
    // SAFE UPDATE: Only update OutputSettings section in XML, don't touch other data
    const currentProfile = getCurrentProfileFilename();
    if (currentProfile) {
        try {
            const result = await window.electronAPI.updateOutputSettingsOnly(outputSettings, currentProfile);
            if (result.success) {
                console.log('OutputSettings updated safely');
            } else {
                console.error('Failed to update OutputSettings:', result.error);
            }
        } catch (error) {
            console.error('Error saving file output settings:', error);
        }
    }
}

// Generate filename based on format and metadata
function generateFilename(format, metadata) {
    if (!format || !metadata) return 'output.din';
    
    let filename = format;
    
    // Replace variables
    filename = filename.replace(/{original_name}/g, metadata.originalName || 'output');
    filename = filename.replace(/{date}/g, new Date().toISOString().split('T')[0]);
    filename = filename.replace(/{time}/g, new Date().toTimeString().split(' ')[0].replace(/:/g, '-'));
    filename = filename.replace(/{timestamp}/g, new Date().toISOString().replace(/[:.]/g, '-'));
    filename = filename.replace(/{width}/g, metadata.width ? metadata.width.toFixed(1) : '0');
    filename = filename.replace(/{height}/g, metadata.height ? metadata.height.toFixed(1) : '0');
    
    // Ensure .din extension
    if (!filename.toLowerCase().endsWith('.din')) {
        filename += '.din';
    }
    
    return filename;
}
// Extract entities from unified formats (CFF2/DDS)
function extractEntitiesFromUnifiedFormat(respectVisibility = false) {
    const entities = [];
    
    console.log('extractEntitiesFromUnifiedFormat called, respectVisibility:', respectVisibility);
    console.log('unifiedGeometries:', window.unifiedGeometries);
    console.log('overlayGroups:', overlayGroups);
    
    if (!window.unifiedGeometries || !overlayGroups) {
        console.warn('No unified format data available for entity extraction');
        return entities;
    }
    
    const geoms = window.unifiedGeometries;
    const fmt = currentFileFormat === 'dds' ? 'dds' : 'cff2';
    
    console.log('Processing', geoms.length, 'unified geometries');
    
    geoms.forEach((geom, index) => {
        try {
            const key = getGroupKeyForGeometry(geom);
            const group = overlayGroups[key];
            
            if (!group) {
                console.warn(`No group found for geometry ${index} with key ${key}`);
                return;
            }
            
            // Check visibility if requested
            if (respectVisibility && !group.visible) {
                console.log(`Geometry ${index} - skipping due to visibility: ${key}`);
                return;
            }
            
            // Get mapping information
            const entry = exactRulesCache.get(`${fmt}|${key}`);
            const lineTypeId = entry?.lineTypeId;
            const lineTypeName = lineTypeId ? getLineTypeName(String(lineTypeId)) : null;
            
            // Skip if no mapping and respectVisibility is true
            if (respectVisibility && !lineTypeId) {
                console.log(`Geometry ${index} - skipping due to no mapping: ${key}`);
                return;
            }
            
            // Build a user-friendly layer name
            let layerName = key;
            try {
                if (fmt === 'dds') {
                    const [color, rawKerf, unit] = key.split('|');
                    const pt = (unit==='in' ? Number(rawKerf||0)*72 : unit==='mm' ? Number(rawKerf||0)/25.4*72 : Number(rawKerf||0));
                    layerName = `${pt.toFixed(2)} pt · color ${color}`;
                } else {
                    const parts = key.split('-');
                    const pen = parts[0] ?? '';
                    const layer = parts.slice(1).join('-');
                    layerName = `${Number(pen||0).toFixed(2)} pt · ${layer}`;
                }
            } catch {}
            
            const processedEntity = {
                id: `unified_${index}`,
                type: geom.type,
                layer: layerName,
                color: group.displayColor || '#66d9ef',
                lineTypeId: lineTypeId,
                lineType: lineTypeName,
                originalEntity: geom,
                key: key
            };
            
            // Add type-specific properties
            switch (geom.type) {
                case 'LINE':
                    processedEntity.start = { x: geom.start.x, y: geom.start.y };
                    processedEntity.end = { x: geom.end.x, y: geom.end.y };
                    // DEBUG: Log bridge data for LINE
                    console.log(`LINE geometry ${index} bridge data:`, {
                        hasBridges: !!geom.bridges,
                        bridgesLength: geom.bridges?.length,
                        bridges: geom.bridges,
                        bridgeCount: geom.bridgeCount,
                        bridgeWidth: geom.bridgeWidth
                    });
                    // Add bridge information if available
                    if (geom.bridgeCount && geom.bridgeWidth) {
                        processedEntity.bridgeCount = geom.bridgeCount;
                        processedEntity.bridgeWidth = geom.bridgeWidth;
                        // Create bridges array for compatibility
                        processedEntity.bridges = Array(geom.bridgeCount).fill().map(() => ({ width: geom.bridgeWidth }));
                        console.log(`LINE entity ${index} - BRIDGES ADDED:`, {
                            bridgeCount: processedEntity.bridgeCount,
                            bridgeWidth: processedEntity.bridgeWidth,
                            bridges: processedEntity.bridges
                        });
                    }
                    break;
                case 'ARC':
                    processedEntity.center = { x: geom.center.x, y: geom.center.y };
                    processedEntity.start = { x: geom.start.x, y: geom.start.y };
                    processedEntity.end = { x: geom.end.x, y: geom.end.y };
                    processedEntity.radius = geom.radius;
                    // DEBUG: Log bridge data for ARC
                    console.log(`ARC geometry ${index} bridge data:`, {
                        hasBridges: !!geom.bridges,
                        bridgesLength: geom.bridges?.length,
                        bridges: geom.bridges,
                        bridgeCount: geom.bridgeCount,
                        bridgeWidth: geom.bridgeWidth
                    });
                    // Add bridge information if available
                    if (geom.bridgeCount && geom.bridgeWidth) {
                        processedEntity.bridgeCount = geom.bridgeCount;
                        processedEntity.bridgeWidth = geom.bridgeWidth;
                        // Create bridges array for compatibility
                        processedEntity.bridges = Array(geom.bridgeCount).fill().map(() => ({ width: geom.bridgeWidth }));
                        console.log(`ARC entity ${index} - BRIDGES ADDED:`, {
                            bridgeCount: processedEntity.bridgeCount,
                            bridgeWidth: processedEntity.bridgeWidth,
                            bridges: processedEntity.bridges
                        });
                    }
                    break;
                default:
                    processedEntity.rawData = geom;
                    break;
            }
            
            entities.push(processedEntity);
            console.log(`Added unified entity ${index}: ${geom.type} on layer '${layerName}'`);
            
        } catch (error) {
            console.warn(`Error processing unified geometry ${index}:`, error);
        }
    });
    
    console.log('extractEntitiesFromUnifiedFormat completed, returning', entities.length, 'entities');
    return entities;
}

// Extract entities from the DXF viewer
function extractEntitiesFromViewer(respectVisibility = false) {
    const entities = [];
    
    console.log('extractEntitiesFromViewer called, respectVisibility:', respectVisibility);
    console.log('viewer:', viewer);
    console.log('viewer.parsedDxf:', viewer?.parsedDxf);
    console.log('viewer.parsedDxf.entities:', viewer?.parsedDxf?.entities);
    
    if (!viewer || !viewer.parsedDxf || !viewer.parsedDxf.entities) {
        console.warn('No DXF data available for entity extraction');
        return entities;
    }
    
    // Get visibility states if needed
    let layerVisibility = {};
    if (respectVisibility && currentLayerData) {
        currentLayerData.forEach((layer, index) => {
            const layerName = layer.parentLayer || layer.name;
            const isVisible = document.getElementById(`layer-${index}`)?.checked || false;
            const hasMapping = layer.importFilterApplied || layer.lineType;
            
            layerVisibility[layerName] = isVisible && hasMapping;
            console.log(`Layer ${layerName}: visible=${isVisible}, mapped=${hasMapping}, include=${layerVisibility[layerName]}`);
        });
    }
    // Extract actual DXF entities from the viewer
    console.log('Processing', viewer.parsedDxf.entities.length, 'entities');
    viewer.parsedDxf.entities.forEach((entity, index) => {
        try {
            console.log(`Processing entity ${index}:`, entity);
            // Get the layer object to find the lineTypeId
            const layerName = entity.layer || '0';
            
            // Check visibility if requested
            if (respectVisibility) {
                const includeLayer = layerVisibility[layerName];
                if (includeLayer === false) {
                    console.log(`Entity ${index} - skipping due to layer visibility/mapping: ${layerName}`);
                    return; // Skip this entity
                }
            }
            
            // First try to get from processed layers (with import filter applied)
            let lineTypeId = null;
            let lineTypeName = null;
            
            console.log(`Entity ${index} - trying to match: layer=${layerName}, color=${entity.color}, colorIndex=${entity.colorIndex}`);
            
            if (window.processedLayersWithLineTypes) {
                console.log(`Entity ${index} - checking processed layers:`, window.processedLayersWithLineTypes.map(l => `${l.name} (color: ${l.color})`));
                // Match by both layer name and color for processed layers
                const processedLayer = window.processedLayersWithLineTypes.find(l => 
                    l.name === layerName || 
                    (l.originalLayerName === layerName && l.color === entity.color)
                );
                if (processedLayer) {
                    lineTypeId = processedLayer.lineTypeId;
                    console.log(`Entity ${index} - found in processed layers, lineTypeId: ${lineTypeId}`);
                }
            }
            
            // Fallback to viewer layers if not found in processed layers
            if (lineTypeId === null) {
                const layerObject = viewer.layers?.get(layerName);
                console.log(`Entity ${index} - layer object:`, layerObject);
                console.log(`Entity ${index} - original entity lineType:`, entity.lineType);
                console.log(`Entity ${index} - original entity lineTypeId:`, entity.lineTypeId);
                lineTypeId = layerObject?.lineTypeId || entity.lineTypeId || null;
            }
            
            // Check layer+color-to-line-type mappings from the postprocessor config
            if (lineTypeId === null && currentPostprocessorConfig?.mappingWorkflow?.layerToLineType) {
                console.log(`Entity ${index} - checking mappingWorkflow config:`, currentPostprocessorConfig.mappingWorkflow.layerToLineType);
                const layerMapping = currentPostprocessorConfig.mappingWorkflow.layerToLineType.find(m => m.layer === layerName && m.color === entity.color);
                if (layerMapping) {
                    lineTypeName = layerMapping.lineType;
                    console.log(`Entity ${index} - found layer+color mapping: ${layerName} + ${entity.color} -> ${lineTypeName}`);
                } else {
                    console.log(`Entity ${index} - no mapping found for layer=${layerName}, color=${entity.color}`);
                }
            }
            
            console.log(`Entity ${index} - layer: ${layerName}, final lineTypeId: ${lineTypeId}`);
            
            // Convert lineTypeId to lineType name for DIN generator, or use directly found line type name
            if (!lineTypeName) {
                lineTypeName = lineTypeId ? getLineTypeName(lineTypeId) : null;
            }
            console.log(`Entity ${index} - final lineType: ${lineTypeName}`);
            
            const processedEntity = {
                id: `entity_${index}`,
                type: entity.type,
                layer: layerName,
                color: entity.color,
                colorIndex: entity.colorIndex,
                lineweight: entity.lineweight,
                lineTypeId: lineTypeId, // Add line type ID from layer
                lineType: lineTypeName, // Add line type name for DIN generator
                originalEntity: entity // Keep reference to original for detailed properties
            };
            
            // Add type-specific properties
            switch (entity.type) {
                case 'LINE':
                    if (entity.vertices && entity.vertices.length >= 2) {
                        processedEntity.start = { x: entity.vertices[0].x, y: entity.vertices[0].y };
                        processedEntity.end = { x: entity.vertices[1].x, y: entity.vertices[1].y };
                    }
                    break;
                    
                case 'LWPOLYLINE':
                case 'POLYLINE':
                    if (entity.vertices && entity.vertices.length > 0) {
                        processedEntity.vertices = entity.vertices.map(v => ({ 
                            x: v.x, 
                            y: v.y,
                            bulge: v.bulge || 0 // Include bulge value for arc segments
                        }));
                        processedEntity.closed = entity.closed || false;
                    }
                    break;
                    
                case 'CIRCLE':
                    if (entity.center && entity.radius !== undefined) {
                        processedEntity.center = { x: entity.center.x, y: entity.center.y };
                        processedEntity.radius = entity.radius;
                    }
                    break;
                    
                case 'ARC':
                    if (entity.center && entity.radius !== undefined) {
                        processedEntity.center = { x: entity.center.x, y: entity.center.y };
                        processedEntity.radius = entity.radius;
                        processedEntity.startAngle = entity.startAngle || 0;
                        processedEntity.endAngle = entity.endAngle || 0;
                        processedEntity.clockwise = entity.clockwise || false;
                    }
                    break;
                    
                case 'ELLIPSE':
                    if (entity.center) {
                        processedEntity.center = { x: entity.center.x, y: entity.center.y };
                        processedEntity.majorAxis = entity.majorAxis;
                        processedEntity.minorAxisRatio = entity.minorAxisRatio;
                        processedEntity.startAngle = entity.startAngle || 0;
                        processedEntity.endAngle = entity.endAngle || Math.PI * 2;
                    }
                    break;
                    
                case 'SPLINE':
                    if (entity.controlPoints) {
                        processedEntity.controlPoints = entity.controlPoints.map(p => ({ x: p.x, y: p.y }));
                        processedEntity.degree = entity.degree || 3;
                        processedEntity.closed = entity.closed || false;
                    }
                    break;
                    
                case 'TEXT':
                case 'MTEXT':
                    if (entity.position) {
                        processedEntity.position = { x: entity.position.x, y: entity.position.y };
                        processedEntity.text = entity.text || '';
                        processedEntity.height = entity.height || 1;
                        processedEntity.rotation = entity.rotation || 0;
                    }
                    break;
                    
                default:
                    // For unsupported entity types, keep the original data
                    processedEntity.rawData = entity;
                    break;
            }
            
            entities.push(processedEntity);
            
        } catch (error) {
            console.warn(`Error processing entity ${index} (${entity.type}):`, error);
        }
    });
    
    console.log('extractEntitiesFromViewer completed, returning', entities.length, 'entities');
    console.log('Final entities:', entities);
    
    console.log(`Extracted ${entities.length} entities from DXF viewer`);
    return entities;
}

// Get current optimization settings from profile
function getCurrentOptimizationSettings() {
    // Get settings from current postprocessor configuration
    const config = currentPostprocessorConfig;
    const optimization = config?.optimization || {};
    
    return {
        primaryStrategy: optimization.primaryStrategy || 'priority_order',
        withinGroupOptimization: optimization.withinGroupOptimization || 'closest_path',
        enableBridges: optimization.enableBridges !== false,
        validateWidths: optimization.validateWidths !== false,
        rotaryOutput: optimization.rotaryOutput !== false
    };
}

// Get file metadata for DIN header
function getFileMetadata() {
    let dimensions;
    let entityCount = 0;
    
    // Check for either DXF viewer (with scene) or unified format viewer (with overlayCanvas)
    const hasDxfViewer = !!(viewer && viewer.scene);
    const hasUnifiedViewer = !!(overlayCanvas && window.unifiedGeometries && window.unifiedGeometries.length > 0);
    
    if (hasDxfViewer) {
        dimensions = getDrawingDimensions();
        entityCount = extractEntitiesFromViewer().length;
    } else if (hasUnifiedViewer) {
        dimensions = getUnifiedBounds(window.unifiedGeometries);
        entityCount = extractEntitiesFromUnifiedFormat().length;
    } else {
        dimensions = { width: 0, height: 0 };
        entityCount = 0;
    }
    
    return {
        filename: currentFilename || 'unknown.dxf',
        width: dimensions?.width || 0,
        height: dimensions?.height || 0,
        entityCount: entityCount,
        bounds: {
            minX: dimensions?.minX || 0,
            minY: dimensions?.minY || 0,
            maxX: dimensions?.maxX || (dimensions?.width || 0),
            maxY: dimensions?.maxY || (dimensions?.height || 0)
        }
    };
}
// Show DIN preview in a modal
function showDinPreview(content) {
    // Create preview modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="width: 80%; max-width: 800px;">
            <div class="modal-header">
                <h3>DIN File Preview</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <pre style="background: #1a1a1a; color: #ccc; padding: 1rem; border-radius: 4px; overflow-x: auto; max-height: 400px; white-space: pre-wrap;">${content}</pre>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                <button class="btn btn-primary" onclick="copyToClipboard('${content.replace(/'/g, "\\'")}')">Copy to Clipboard</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Save DIN file using Electron API
async function saveDinFile(content, defaultFilename, generationStats = null) {
    try {
        // Get output settings from current configuration
        const outputSettings = currentPostprocessorConfig?.outputSettings || {};
        const autoSaveEnabled = outputSettings.autoSaveEnabled !== false;
        const defaultSavePath = outputSettings.defaultSavePath || '';
        const filenameFormat = outputSettings.filenameFormat || '{original_name}.din';
        
        // Generate filename based on format (use profile template if no defaultFilename provided)
        let generatedFilename;
        if (defaultFilename) {
            generatedFilename = defaultFilename;
        } else {
            const metadata = {
                originalName: currentFilename ? currentFilename.replace(/\.[^/.]+$/, '') : 'output',
                width: getFileMetadata().width || 0,
                height: getFileMetadata().height || 0
            };
            console.log('Filename generation debug:', {
                filenameFormat,
                metadata,
                currentFilename,
                outputSettings
            });
            generatedFilename = generateFilename(filenameFormat, metadata);
            console.log('Generated filename:', generatedFilename);
        }
        
        // Get processed layers info for success dialog
        const processedLayers = getProcessedLayersInfo();
        
        // If auto-save is enabled and we have a default path, save directly
        if (autoSaveEnabled && defaultSavePath) {
            const result = await window.electronAPI.saveDinFile(content, generatedFilename, defaultSavePath);
            if (result.success) {
                showDinGenerationSuccessDialog(result.filePath, processedLayers, generationStats);
            } else {
                showStatus(`Failed to save DIN file: ${result.error}`, 'error');
            }
            return;
        }
        
        // Otherwise, show save dialog
        const result = await window.electronAPI.saveDinFile(content, generatedFilename, null);
        if (result.success) {
            showDinGenerationSuccessDialog(result.filePath, processedLayers, generationStats);
        } else {
            showStatus(`Failed to save DIN file: ${result.error}`, 'error');
        }
        
    } catch (error) {
        throw new Error(`Failed to save DIN file: ${error.message}`);
    }
}
// Copy content to clipboard
function copyToClipboard(content) {
    navigator.clipboard.writeText(content).then(() => {
        showStatus('DIN content copied to clipboard', 'success');
    }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
        showStatus('Failed to copy to clipboard', 'error');
    });
}

// Profile Management Functions

// Create new postprocessor profile
function createNewProfile() {
    showProfileModal('Create New Profile', '', async (profileName) => {
        try {
            if (!profileName.trim()) {
                showStatus('Profile name cannot be empty', 'error');
                return;
            }

            // Create new profile based on current settings or default configuration
            const newProfile = currentPostprocessorConfig ? { ...currentPostprocessorConfig } : getDefaultConfiguration();
            
            // Update profile info
            if (!newProfile.profileInfo) {
                newProfile.profileInfo = {};
            }
            newProfile.profileInfo.name = profileName;
            newProfile.profileInfo.description = `Custom profile created ${new Date().toLocaleString()}`;
            newProfile.profileInfo.created = new Date().toISOString().split('T')[0];
            newProfile.profileInfo.author = 'User';

            // Save profile as XML
            const filename = profileName.toLowerCase().replace(/\s+/g, '_') + '.xml';
            await window.electronAPI.saveXmlProfile(filename, newProfile);
            
            // Refresh dropdown and select new profile
            await refreshProfileDropdown();
            document.getElementById('postprocessorProfile').value = filename;
            
            // Load the new profile
            await loadXmlProfileConfiguration(filename);
            
            showStatus(`Created new profile: ${profileName}`, 'success');
        } catch (error) {
            console.error('Error creating profile:', error);
            showStatus(`Failed to create profile: ${error.message}`, 'error');
        }
    });
}

// Copy current profile
function copyCurrentProfile() {
    const currentProfileSelect = document.getElementById('postprocessorProfile');
    const currentProfileName = currentProfileSelect.options[currentProfileSelect.selectedIndex].text;
    
    showProfileModal('Copy Profile', `${currentProfileName} - Copy`, async (profileName) => {
        try {
            if (!profileName.trim()) {
                showStatus('Profile name cannot be empty', 'error');
                return;
            }

            // Copy current configuration
            const copiedProfile = { ...currentPostprocessorConfig };
            copiedProfile.name = profileName;
            copiedProfile.description = `Copy of ${currentProfileName} created ${new Date().toLocaleString()}`;
            copiedProfile.created = new Date().toISOString().split('T')[0];
            copiedProfile.author = 'User';

            // Save copied profile as XML
            const filename = profileName.toLowerCase().replace(/\s+/g, '_') + '.xml';
            
            // Update profile info
            if (!copiedProfile.profileInfo) {
                copiedProfile.profileInfo = {};
            }
            copiedProfile.profileInfo.name = profileName;
            copiedProfile.profileInfo.description = `Copy of ${currentProfileName} created ${new Date().toLocaleString()}`;
            copiedProfile.profileInfo.created = new Date().toISOString().split('T')[0];
            copiedProfile.profileInfo.author = 'User';
            
            await window.electronAPI.saveXmlProfile(filename, copiedProfile);
            
            // Refresh dropdown and select new profile
            await refreshProfileDropdown();
            document.getElementById('postprocessorProfile').value = filename;
            
            // Load the new profile
            await loadXmlProfileConfiguration(filename);
            
            showStatus(`Copied profile: ${profileName}`, 'success');
        } catch (error) {
            console.error('Error copying profile:', error);
            showStatus(`Failed to copy profile: ${error.message}`, 'error');
        }
    });
}
// Edit current profile
function editCurrentProfile() {
    const currentProfileSelect = document.getElementById('postprocessorProfile');
    const currentProfileName = currentProfileSelect.options[currentProfileSelect.selectedIndex].text;
    const currentFilename = currentProfileSelect.value;
    
    showProfileModal('Edit Profile', currentProfileName, async (newProfileName) => {
        try {
            if (!newProfileName.trim()) {
                showStatus('Profile name cannot be empty', 'error');
                return;
            }

            // Update current configuration with new name
            const updatedProfile = { ...currentPostprocessorConfig };
            
            // Update profile info
            if (!updatedProfile.profileInfo) {
                updatedProfile.profileInfo = {};
            }
            updatedProfile.profileInfo.name = newProfileName;
            updatedProfile.profileInfo.description = updatedProfile.profileInfo.description || `Profile updated ${new Date().toLocaleString()}`;
            updatedProfile.profileInfo.lastModified = new Date().toISOString().split('T')[0];

            // Check if we need to rename the file
            const newFilename = newProfileName.toLowerCase().replace(/\s+/g, '_') + '.xml';
            
            if (newFilename !== currentFilename) {
                // We need to rename the file
                // First save with new filename
                await window.electronAPI.saveXmlProfile(newFilename, updatedProfile);
                
                // Delete old file
                try {
                    await window.electronAPI.deleteXmlProfile(currentFilename);
                } catch (deleteError) {
                    console.warn('Could not delete old profile file:', deleteError);
                }
                
                // Refresh dropdown and select new profile
                await refreshProfileDropdown();
                document.getElementById('postprocessorProfile').value = newFilename;
                
                // Load the renamed profile
                await loadXmlProfileConfiguration(newFilename);
                
                showStatus(`Profile renamed to: ${newProfileName}`, 'success');
            } else {
                // Same filename, just update content
                await window.electronAPI.saveXmlProfile(currentFilename, updatedProfile);
                
                // Refresh dropdown to update display name
                await refreshProfileDropdown();
                document.getElementById('postprocessorProfile').value = currentFilename;
                
                showStatus(`Updated profile: ${newProfileName}`, 'success');
            }
            
        } catch (error) {
            console.error('Error editing profile:', error);
            showStatus(`Failed to edit profile: ${error.message}`, 'error');
        }
    });
}

// Delete current profile
async function deleteCurrentProfile() {
    const currentProfileSelect = document.getElementById('postprocessorProfile');
    const currentProfileName = currentProfileSelect.options[currentProfileSelect.selectedIndex].text;
    const filename = currentProfileSelect.value;
    
    // Prevent deletion of default profiles
    if (filename === 'default_metric.xml' || filename === 'default_inch.xml') {
        showStatus('Cannot delete default profiles', 'error');
        return;
    }

    if (confirm(`Are you sure you want to delete the profile "${currentProfileName}"?\n\nThis action cannot be undone.`)) {
        try {
            // Delete XML file from disk
            await window.electronAPI.deleteXmlProfile(filename);
            
            // Refresh dropdown
            await refreshProfileDropdown();
            
            // Select first available profile
            const profileSelect = document.getElementById('postprocessorProfile');
            if (profileSelect.options.length > 0) {
                profileSelect.selectedIndex = 0;
                const firstProfile = profileSelect.value;
                if (firstProfile.endsWith('.xml')) {
                    await loadXmlProfileConfiguration(firstProfile);
                } else {
                    await loadPostprocessorConfiguration(firstProfile);
                }
            }
            
            showStatus(`Deleted profile: ${currentProfileName}`, 'success');
        } catch (error) {
            console.error('Error deleting profile:', error);
            showStatus(`Failed to delete profile: ${error.message}`, 'error');
        }
    }
}
// Create profile from current UI settings
function createProfileFromCurrentSettings() {
    const machineType = document.getElementById('machineType')?.value || 'metric';
    const enableScaling = document.getElementById('enableScaling')?.checked || false;
    const scalingParameter = document.getElementById('scalingParameter')?.value || ':P2027=25.4/P674';
    const scaleCommand = document.getElementById('scaleCommand')?.value || 'G75 X=P2027 Y=P2027';
    const headerTemplate = document.getElementById('headerTemplate')?.value || '{filename} / - size: {width} x {height} / {timestamp}';
    const setupCommands = document.getElementById('setupCommands')?.value.split('\n').filter(cmd => cmd.trim()) || ['G90', 'G60 X0', 'G0 X0 Y0'];
    
    return {
        version: '1.0',
        units: {
            system: 'metric',
            feedInchMachine: machineType === 'inch_with_scaling' || machineType === 'custom',
            scalingHeader: {
                enabled: machineType === 'inch_with_scaling' && enableScaling,
                parameter: scalingParameter,
                scaleCommand: scaleCommand,
                comment: '{ Bei Bedarf nach inch skalieren'
            }
        },
        header: {
            template: headerTemplate,
            includeFileInfo: document.getElementById('includeFileInfo')?.checked !== false,
            includeBounds: document.getElementById('includeBounds')?.checked !== false,
            includeSetCount: document.getElementById('includeSetCount')?.checked !== false,
            includeProgramStart: document.getElementById('includeProgramStart')?.checked !== false,
            programStart: '%1',
            customFields: {
                company: 'Lasercomb GmbH',
                operator: '{user}',
                material: '{material}',
                thickness: '{thickness}'
            },
            setupCommands: setupCommands
        },
        gcode: {
            absoluteMode: 'G90',
            homeCommand: 'G60 X0',
            rapidMove: 'G0',
            linearMove: 'G1',
            cwArc: 'G2',
            ccwArc: 'G3',
            programEnd: 'G99'
        },
        laser: {
            laserOn: 'M14',
            laserOff: 'M15',
            toolChange: 'M6',
            comments: {
                enabled: true, // Always enabled - comments are now always included
                onCommand: '{ON / Down}',
                offCommand: '{OFF / Up}',
                toolChange: '{tool_name}'
            }
        },
        lineNumbers: {
            enabled: true,
            startNumber: 1,
            increment: 1,
            format: 'N{number}'
        },
        optimization: {
            enablePathOptimization: true,
            algorithm: document.getElementById('withinGroupOptimization')?.value || 'closest_path',
            minimizeRapidMoves: true,
            groupByTool: document.getElementById('primaryStrategy')?.value === 'tool_grouped',
            zigzagPattern: false
        }
    };
}
// Show profile modal dialog
function showProfileModal(title, defaultName, onSave) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <label for="profileNameInput">Profile Name:</label>
                <input type="text" id="profileNameInput" value="${defaultName}" placeholder="Enter profile name..." />
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" id="saveProfileBtn">Save</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = modal.querySelector('#profileNameInput');
    const saveBtn = modal.querySelector('#saveProfileBtn');
    
    input.focus();
    input.select();
    
    const handleSave = async () => {
        const profileName = input.value.trim();
        if (profileName) {
            await onSave(profileName);
            modal.remove();
        }
    };
    
    saveBtn.addEventListener('click', handleSave);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSave();
        }
    });
}

// Add profile to dropdown
function addProfileToDropdown(profileId, profileName) {
    const select = document.getElementById('postprocessorProfile');
    const option = document.createElement('option');
    option.value = profileId;
    option.textContent = profileName;
    
    // Insert before the "Custom Profile..." option
    const customOption = select.querySelector('option[value="custom"]');
    if (customOption) {
        select.insertBefore(option, customOption);
    } else {
        select.appendChild(option);
    }
}

// Tool Management Functions

// Open tools manager
function openToolsManager() {
    showToolsManagerModal();
}
// Show tools manager modal
function showToolsManagerModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="width: 90%; max-width: 1000px;">
            <div class="modal-header">
                <h3>Tool Library Manager</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                    <button class="btn btn-primary" id="addToolBtn">+ Add Tool</button>
                    <button class="btn btn-secondary" id="importToolsBtn">Import Tools</button>
                    <button class="btn btn-secondary" id="exportToolsBtn">Export Tools</button>
                </div>
                <div id="toolsManagerGrid" class="tool-grid" style="max-height: 400px; overflow-y: auto;">
                    <!-- Tools will be loaded here -->
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                <button class="btn btn-primary" id="saveToolsBtn">Save Changes</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load current tools into manager
    loadToolsIntoManager();
    
    // Add event listeners
    modal.querySelector('#addToolBtn').addEventListener('click', addNewTool);
    modal.querySelector('#saveToolsBtn').addEventListener('click', saveToolChanges);
    modal.querySelector('#importToolsBtn').addEventListener('click', () => showStatus('Import functionality coming soon', 'info'));
    modal.querySelector('#exportToolsBtn').addEventListener('click', () => showStatus('Export functionality coming soon', 'info'));
}

// Load tools into manager grid
async function loadToolsIntoManager() {
    try {
        console.log('loadToolsIntoManager: Starting to load tools...');
        
        // Load tools from current postprocessor configuration
        const currentTools = await getCurrentToolSet();
        console.log('loadToolsIntoManager: Got tools from getCurrentToolSet:', currentTools);
        console.log('loadToolsIntoManager: Tools type:', typeof currentTools);
        console.log('loadToolsIntoManager: Tool keys:', Object.keys(currentTools || {}));
        
        const grid = document.getElementById('toolsManagerGrid');
        if (!grid) {
            console.warn('loadToolsIntoManager: No toolsManagerGrid found');
            return;
        }
        
        grid.innerHTML = '';
        
        if (!currentTools || typeof currentTools !== 'object') {
            console.error('loadToolsIntoManager: Invalid tools object:', currentTools);
            return;
        }
        
        // Load all current tools dynamically
        Object.entries(currentTools).forEach(([toolId, tool]) => {
            console.log(`loadToolsIntoManager: Creating card for ${toolId}:`, tool);
            console.log(`loadToolsIntoManager: Tool properties - name: "${tool.name}", width: "${tool.width}", description: "${tool.description}", hCode: "${tool.hCode}"`);
            const toolCard = createEditableToolCard(toolId, tool);
            grid.appendChild(toolCard);
        });
        
        console.log(`loadToolsIntoManager: Successfully created ${Object.keys(currentTools).length} tool cards`);
        
    } catch (error) {
        console.error('Error loading tools into manager:', error);
        showStatus('Failed to load tools for editing', 'error');
    }
}

// Get current tool set from configuration or defaults
async function getCurrentToolSet() {
    console.log('getCurrentToolSet called');
    
    // Always try to load fresh from mtl.xml profile first to avoid corrupted data
    try {
        console.log('Loading tools from mtl.xml profile...');
        const tools = await window.electronAPI.getToolsFromProfile('mtl.xml');
        console.log('Tools response from main process:', tools);
        if (tools && tools.success && tools.data) {
            console.log('Successfully loaded tools from XML:', tools.data);
            console.log('Tools keys:', Object.keys(tools.data));
            console.log('First tool sample from XML:', tools.data[Object.keys(tools.data)[0]]);
            // XML tools.data is in correct format, return it directly
            return tools.data;
        } else {
            console.warn('Failed to load tools from XML:', tools);
        }
    } catch (error) {
        console.error('Error loading tools from XML profile:', error);
    }
    
    // Fallback: try postprocessor config (but this seems to be corrupted)
    if (currentPostprocessorConfig?.tools) {
        console.log('Falling back to postprocessor config tools:', currentPostprocessorConfig.tools);
        console.log('First postprocessor tool sample:', Object.values(currentPostprocessorConfig.tools)[0]);
        return currentPostprocessorConfig.tools;
    }
    
    // Fallback to default tool set
    return {
        'T1': { name: 'Fine Engraving', width: 0.1, description: 'Precision engraving tool', hCode: 'H20' },
        'T2': { name: 'Standard Cutting', width: 0.2, description: 'General purpose cutting', hCode: 'H12' },
        'T3': { name: 'Perforation', width: 0.15, description: 'Perforation lines', hCode: 'H15' },
        'T4': { name: 'Heavy Cutting', width: 0.3, description: 'Thick material cutting', hCode: 'H08' }
    };
}
// Create editable tool card
function createEditableToolCard(toolId, tool) {
    const card = document.createElement('div');
    card.className = 'tool-card editable';
    card.dataset.toolId = toolId;
    
    card.innerHTML = `
        <div class="tool-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <input type="text" class="tool-id-input" value="${toolId}" style="background: transparent; border: 1px solid #555; color: #4a90e2; font-weight: 600; padding: 0.25rem; width: 60px;">
            <button class="btn-small btn-danger" onclick="this.closest('.tool-card').remove()">×</button>
        </div>
        <div class="tool-field">
            <label>Name:</label>
            <input type="text" class="tool-name-input" value="${tool.name}" style="background: #1a1a1a; border: 1px solid #555; color: #fff; padding: 0.25rem; width: 100%;">
        </div>
        <div class="tool-field" style="margin-top: 0.5rem;">
            <label>Width (mm):</label>
            <input type="number" class="tool-width-input" value="${tool.width}" step="0.1" min="0" style="background: #1a1a1a; border: 1px solid #555; color: #fff; padding: 0.25rem; width: 80px;">
        </div>
        <div class="tool-field" style="margin-top: 0.5rem;">
            <label>Description:</label>
            <input type="text" class="tool-description-input" value="${tool.description || ''}" placeholder="Tool description" style="background: #1a1a1a; border: 1px solid #555; color: #fff; padding: 0.25rem; width: 100%;">
        </div>
        <div class="tool-field" style="margin-top: 0.5rem;">
            <label>H-Code:</label>
            <input type="text" class="tool-hcode-input" value="${tool.hCode}" style="background: #1a1a1a; border: 1px solid #555; color: #ffc107; font-family: monospace; padding: 0.25rem; width: 80px;">
        </div>
    `;
    
    return card;
}
// Add new tool
function addNewTool() {
    const grid = document.getElementById('toolsManagerGrid');
    if (!grid) return;
    
    // Generate next available tool ID
    const existingIds = Array.from(grid.querySelectorAll('.tool-id-input')).map(input => input.value);
    let newToolNumber = 1;
    let newToolId = `T${newToolNumber}`;
    
    // Find the next available tool number
    while (existingIds.includes(newToolId)) {
        newToolNumber++;
        newToolId = `T${newToolNumber}`;
    }
    
    const newTool = {
        name: 'New Tool',
        description: 'User-defined tool',
        width: 0.5,
        hCode: 'H10'
    };
    
    const toolCard = createEditableToolCard(newToolId, newTool);
    grid.appendChild(toolCard);
    
    // Focus on the name input for immediate editing
    toolCard.querySelector('.tool-name-input').focus();
    toolCard.querySelector('.tool-name-input').select();
    
    showStatus(`Added new tool ${newToolId}`, 'success');
}

// Save tool changes
async function saveToolChanges() {
    try {
        if (!currentPostprocessorConfig) {
            showStatus('No postprocessor profile selected', 'error');
            return;
        }
        
        const grid = document.getElementById('toolsManagerGrid');
        const toolCards = grid.querySelectorAll('.tool-card');
        
        const tools = {};
        
        toolCards.forEach(card => {
            const toolId = card.querySelector('.tool-id-input').value.trim();
            const name = card.querySelector('.tool-name-input').value.trim();
            const width = parseFloat(card.querySelector('.tool-width-input').value);
            const hCode = card.querySelector('.tool-hcode-input').value.trim();
            const description = card.querySelector('.tool-description-input')?.value.trim() || 'No description';
            
            if (toolId && name) {
                tools[toolId] = {
                    name,
                    description,
                    width: isNaN(width) ? 0.5 : width,
                    hCode: hCode || 'H10'
                };
            }
        });
        
        // Save tools to current postprocessor configuration
        currentPostprocessorConfig.tools = tools;
        
        // Save to XML profile
        const currentProfile = getCurrentProfileFilename();
        if (currentProfile) {
            await saveXmlProfileConfiguration(currentProfile);
        }
        
        // Update the tool preview in main configuration window
        refreshToolPreviews();
        
        // Close modal
        document.querySelector('.modal').remove();
        
        showStatus(`Tool changes saved successfully (${Object.keys(tools).length} tools)`, 'success');
        
    } catch (error) {
        console.error('Error saving tool changes:', error);
        showStatus('Failed to save tool changes', 'error');
    }
}

// Refresh tool previews in all windows
async function refreshToolPreviews() {
    // Refresh main tool configuration preview
    const mainPreview = document.getElementById('modalToolPreview');
    if (mainPreview) {
        await loadModalToolLibrary();
    }
    
    // Refresh other tool displays if they exist
    const toolPreviewElements = document.querySelectorAll('.tool-preview, .tool-grid');
    for (const element of toolPreviewElements) {
        if (element.id !== 'modalToolPreview' && element.id !== 'toolsManagerGrid') {
            // Refresh other tool displays
            const currentTools = await getCurrentToolSet();
            if (element.className.includes('tool-grid')) {
                element.innerHTML = '';
                Object.entries(currentTools).forEach(([toolId, tool]) => {
                    const toolCard = document.createElement('div');
                    toolCard.className = 'tool-card';
                    toolCard.innerHTML = `
                        <div class="tool-header">
                            <span class="tool-id">${toolId}</span>
                            <span class="tool-name">${tool.name}</span>
                        </div>
                        <div class="tool-details">
                            <div class="tool-width">Width: ${tool.width}mm</div>
                            <div class="tool-desc">${tool.description}</div>
                        </div>
                    `;
                    element.appendChild(toolCard);
                });
            }
        }
    }
}


// Line Type Mapping Functions

// Initialize line type mapping
function initializeLineTypeMappings() {
    const manageMappingsBtn = document.getElementById('manageMappingsBtn');
    
    manageMappingsBtn?.addEventListener('click', openMappingsManager);
    
    // Load default mappings
    loadLineTypeMappings();
}

// Load and display line type mappings
async function loadLineTypeMappings() {
    try {
        const mappingConfig = await window.electronAPI.loadOptimizationConfig();
        displayMappingPreview(mappingConfig);
    } catch (error) {
        console.error('Error loading line type mappings:', error);
        showStatus('Failed to load line type mappings', 'error');
    }
}

// Display mapping preview cards
function displayMappingPreview(mappingConfig) {
    const mappingGrid = document.querySelector('.mapping-grid');
    if (!mappingGrid) return;
    
    mappingGrid.innerHTML = '';
    
    // Get current mappings from postprocessor config
    const currentMappings = currentPostprocessorConfig?.lineTypeMappings?.customMappings || {};
    
    const defaultMappings = [
        { lineType: 'cutting', tool: 'T2', description: 'Standard cutting operations', priority: 3 },
        { lineType: 'engraving', tool: 'T1', description: 'Fine engraving and text', priority: 1 },
        { lineType: 'perforating', tool: 'T3', description: 'Perforation lines', priority: 2 },
        { lineType: 'scoring', tool: 'T1', description: 'Light scoring for bending', priority: 2 },
        { lineType: 'marking', tool: 'T1', description: 'Surface marking only', priority: 1 },
        { lineType: 'construction', tool: 'none', description: 'Construction lines - not machined', priority: 999 }
    ];
    
    defaultMappings.forEach(mapping => {
        const mappingCard = createMappingCard(mapping, currentMappings[mapping.lineType] || mapping.tool);
        mappingGrid.appendChild(mappingCard);
    });
}
// Create mapping card
function createMappingCard(mapping, currentTool) {
    const card = document.createElement('div');
    card.className = 'mapping-card';
    card.dataset.lineType = mapping.lineType;
    
    card.innerHTML = `
        <div class="mapping-header">
            <div class="mapping-line-type">${mapping.lineType.toUpperCase()}</div>
            <div class="mapping-priority">Priority: ${mapping.priority}</div>
        </div>
        <div class="mapping-description">${mapping.description}</div>
        <div class="mapping-tool-selector">
            <label>Tool:</label>
            <select class="mapping-tool-select">
                <option value="none" ${currentTool === 'none' ? 'selected' : ''}>None (Skip)</option>
                ${generateToolOptions(currentTool)}
            </select>
        </div>
    `;
    
    // Add event listener for tool changes
    const toolSelect = card.querySelector('.mapping-tool-select');
    toolSelect.addEventListener('change', () => {
        updateLineTypeMapping(mapping.lineType, toolSelect.value);
    });
    
    return card;
}
// Generate tool options for dropdowns
function generateToolOptions(selectedTool) {
    const currentTools = getCurrentToolSet();
    let options = '';
    
    Object.entries(currentTools).forEach(([toolId, tool]) => {
        const selected = selectedTool === toolId ? 'selected' : '';
        options += `<option value="${toolId}" ${selected}>${toolId} - ${tool.name}</option>`;
    });
    
    return options;
}

// Update line type mapping
function updateLineTypeMapping(lineType, tool) {
    if (!currentPostprocessorConfig) return;
    
    // Initialize lineTypeMappings if it doesn't exist
    if (!currentPostprocessorConfig.lineTypeMappings) {
        currentPostprocessorConfig.lineTypeMappings = {
            mappingFile: 'line_type_mappings.json',
            customMappings: {}
        };
    }
    
    // Update the mapping
    currentPostprocessorConfig.lineTypeMappings.customMappings[lineType] = tool;
    
    // Update header preview to reflect changes
    updateHeaderPreview();
    
    showStatus(`Updated ${lineType} → ${tool}`, 'success');
}

// Open mappings manager
async function openMappingsManager() {
    try {
        await window.electronAPI.openUnifiedMappingWindow();
    } catch (error) {
        console.error('Error opening unified mapping window:', error);
        showStatus('Error opening mapping window', 'error');
    }
}

// Show unified 3-column mapping manager modal
function showMappingsManagerModal() {
    const modal = document.createElement('div');
    modal.className = 'modal mapping-modal';
    
    // Make it floating, resizable, and draggable
    modal.style.cssText = `
        position: fixed;
        top: 40px;
        left: 40px;
        width: 1400px;
        height: 800px;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        border-radius: 12px;
        border: 2px solid #444;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(10px);
        resize: both;
        overflow: auto;
        min-width: 1000px;
        min-height: 600px;
        max-width: calc(100vw - 80px);
        max-height: calc(100vh - 80px);
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="width: 100%; height: 100%; background: #1a1a1a; border-radius: 10px; padding: 0; display: flex; flex-direction: column;">
            <div class="modal-header" style="background: #2a2a2a; padding: 1rem; border-radius: 10px 10px 0 0; border-bottom: 2px solid #444; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center;" id="modalHeader">
                <h3 style="margin: 0; color: #fff; font-size: 1.1rem;">🎯 Unified Mapping Workflow: DXF Layers → Internal Line Types → Machine Tools</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()" style="background: #ff4444; color: white; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; font-weight: bold;">&times;</button>
            </div>
            <div class="modal-body" style="flex: 1; padding: 1rem; overflow: hidden;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem; height: 100%;">
                    <!-- Column 1: DXF Layers -->
                    <div style="border: 2px solid #4a90e2; border-radius: 8px; padding: 1rem;">
                        <h4 style="color: #4a90e2; margin-bottom: 1rem; text-align: center;">DXF Layers</h4>
                        <div style="font-size: 0.9rem; color: #aaa; margin-bottom: 1rem; text-align: center;">
                            Detected layers from loaded DXF file
                        </div>
                        <div class="dxf-layers-list" id="dxfLayersList" style="max-height: 450px; overflow-y: auto;">
                            <!-- DXF layers will be loaded here -->
                        </div>
                        <button class="btn btn-primary btn-small" id="refreshLayersBtn" style="width: 100%; margin-top: 1rem;">Refresh from DXF</button>
                    </div>
                    
                    <!-- Column 2: Internal Line Types -->
                    <div style="border: 2px solid #e2a04a; border-radius: 8px; padding: 1rem;">
                        <h4 style="color: #e2a04a; margin-bottom: 1rem; text-align: center;">Internal Line Types</h4>
                        <div style="font-size: 0.9rem; color: #aaa; margin-bottom: 1rem; text-align: center;">
                            Intermediate cutting operations
                        </div>
                        <div class="internal-line-types-list" id="internalLineTypesList" style="max-height: 450px; overflow-y: auto;">
                            <!-- Internal line types will be loaded here -->
                        </div>
                        <button class="btn btn-primary btn-small" id="addLineTypeBtn" style="width: 100%; margin-top: 1rem;">+ Add Line Type</button>
                    </div>
                    
                    <!-- Column 3: Machine Tools -->
                    <div style="border: 2px solid #4ae24a; border-radius: 8px; padding: 1rem;">
                        <h4 style="color: #4ae24a; margin-bottom: 1rem; text-align: center;">Machine Tools</h4>
                        <div style="font-size: 0.9rem; color: #aaa; margin-bottom: 1rem; text-align: center;">
                            Available machine tools
                        </div>
                        <div class="machine-tools-list" id="machineToolsList" style="max-height: 450px; overflow-y: auto;">
                            <!-- Machine tools will be loaded here -->
                        </div>
                        <button class="btn btn-primary btn-small" id="manageToolsBtn" style="width: 100%; margin-top: 1rem;">Manage Tools</button>
                    </div>
                </div>
                
                <!-- Workflow Controls -->
                <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 2px solid #555;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="color: #4a90e2;">Many-to-One Mapping Controls</h4>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; color: #ccc; font-size: 0.9rem;">
                                <input type="checkbox" id="multiSelectToggle" style="accent-color: #4a90e2;">
                                Multi-Select Mode
                            </label>
                            <button class="btn btn-secondary btn-small" id="autoMapBtn">Auto-Map Common Layers</button>
                            <button class="btn btn-secondary btn-small" id="clearMappingsBtn">Clear All Mappings</button>
                        </div>
                    </div>
                    
                    <!-- Enhanced Instructions -->
                    <div style="background: #1a1a1a; border: 1px solid #444; border-radius: 6px; padding: 1rem; margin-bottom: 1rem;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div>
                                <h5 style="color: #4a90e2; margin-bottom: 0.5rem;">🎯 Many-to-One Layer Mapping</h5>
                                <ul style="font-size: 0.85rem; color: #ccc; margin: 0; padding-left: 1.2rem; line-height: 1.4;">
                                    <li><strong>Single Select:</strong> Click layer → Click line type</li>
                                    <li><strong>Multi-Select:</strong> Ctrl/Cmd+Click multiple layers → Click line type</li>
                                    <li><strong>Toggle Mode:</strong> Enable Multi-Select Mode for easier selection</li>
                                    <li>Multiple layers can map to the same line type (e.g., CUT_OUTER, CUT_INNER → cutting)</li>
                                </ul>
                            </div>
                            <div>
                                <h5 style="color: #e2a04a; margin-bottom: 0.5rem;">⚙️ Line Type to Tool Assignment</h5>
                                <ul style="font-size: 0.85rem; color: #ccc; margin: 0; padding-left: 1.2rem; line-height: 1.4;">
                                    <li>Click line type → Click machine tool</li>
                                    <li>Each line type maps to exactly one tool</li>
                                    <li>Tools can be shared by multiple line types</li>
                                    <li>Visual connections show the complete workflow</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Status and Selection Info -->
                    <div id="mappingStatusPanel" style="background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 0.75rem; font-size: 0.85rem;">
                        <div style="color: #7d8590;">
                            <span id="selectionStatus">Ready for mapping. Select layers to begin.</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                <button class="btn btn-primary" id="saveMappingsBtn">Save Mappings</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Load 3-column mapping interface
    try {
        loadUnifiedMappingInterface();
        console.log('Successfully loaded unified mapping interface');
        
        // Load existing mappings after a short delay to ensure DOM is ready
        setTimeout(() => {
            updateMappingVisuals();
            console.log('Loaded existing mappings');
        }, 100);
        
    } catch (error) {
        console.error('Error loading unified mapping interface:', error);
        // Fallback - show basic interface
        document.getElementById('dxfLayersList').innerHTML = '<div style="color: red; padding: 1rem;">Error loading interface. Check console for details.</div>';
    }
    
    // Add event listeners for new interface
    modal.querySelector('#refreshLayersBtn').addEventListener('click', refreshDxfLayers);
    modal.querySelector('#addLineTypeBtn').addEventListener('click', addNewLineType);
    modal.querySelector('#manageToolsBtn').addEventListener('click', () => {
        modal.remove();
        openToolsManager();
    });
    modal.querySelector('#autoMapBtn').addEventListener('click', autoMapCommonLayers);
    modal.querySelector('#clearMappingsBtn').addEventListener('click', clearAllMappings);
    modal.querySelector('#saveMappingsBtn').addEventListener('click', saveUnifiedMappings);
    
    // Multi-select toggle event listener
    modal.querySelector('#multiSelectToggle').addEventListener('change', (e) => {
        multiSelectMode = e.target.checked;
        updateSelectionStatus(`Multi-select mode ${multiSelectMode ? 'enabled' : 'disabled'}. ${multiSelectMode ? 'Click layers to select multiple.' : 'Use Ctrl/Cmd+Click for multi-select.'}`);
        
        // Show/hide checkboxes based on mode
        if (multiSelectMode) {
            document.querySelectorAll('.selection-checkbox').forEach(cb => cb.style.display = 'block');
        } else {
            clearLayerSelections();
        }
    });
    
    // Add drag functionality to the modal
    makeDraggable(modal, modal.querySelector('#modalHeader'));
}

// Make modal draggable
function makeDraggable(modal, header) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(modal.style.left) || 40;
        startTop = parseInt(modal.style.top) || 40;
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    });
    
    function drag(e) {
        if (!isDragging) return;
        
        const newLeft = startLeft + (e.clientX - startX);
        const newTop = startTop + (e.clientY - startY);
        
        // Keep modal within viewport
        const maxLeft = window.innerWidth - 200;
        const maxTop = window.innerHeight - 100;
        
        modal.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
        modal.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
    }
    
    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
    }
}

// Load unified 3-column mapping interface
async function loadUnifiedMappingInterface() {
    try {
        console.log('Loading unified mapping interface...');
        
        // Load DXF layers from currently loaded file
        console.log('Loading DXF layers column...');
        loadDxfLayersColumn();
        
        // Load internal line types
        console.log('Loading internal line types column...');
        await loadInternalLineTypesColumn();
        
        // Load machine tools
        console.log('Loading machine tools column...');
        loadMachineToolsColumn();
        
        // Load existing mappings and show connections
        console.log('Loading existing mappings...');
        loadExistingMappings();
        
        console.log('Unified mapping interface loaded successfully');
        
    } catch (error) {
        console.error('Error loading unified mapping interface:', error);
        throw error;
    }
}
// Load DXF layers from loaded file
function loadDxfLayersColumn() {
    const layersList = document.getElementById('dxfLayersList');
    if (!layersList) return;
    
    layersList.innerHTML = '';
    
    // Get layers from loaded file
    const dxfLayers = extractDxfLayers();
    
    if (dxfLayers.length === 0) {
        layersList.innerHTML = '<div style="color: #888; text-align: center; padding: 2rem;">No file loaded<br><small>Load a supported file first</small></div>';
        return;
    }
    
    dxfLayers.forEach(layer => {
        console.log('Creating layer card for:', layer.name);
        const layerCard = document.createElement('div');
        layerCard.className = 'mapping-item dxf-layer';
        layerCard.dataset.layer = layer.name;
        console.log('Set data-layer attribute to:', layer.name);
        layerCard.innerHTML = `
            <div class="layer-card" style="padding: 0.75rem; border: 1px solid #555; border-radius: 4px; margin-bottom: 0.5rem; cursor: pointer; background: #2a2a2a; position: relative;">
                <div class="selection-checkbox" style="position: absolute; top: 0.5rem; right: 0.5rem; width: 16px; height: 16px; border: 1px solid #666; border-radius: 3px; background: transparent; display: none;"></div>
                <div style="font-weight: bold; color: #4a90e2; margin-right: 24px;">${layer.name}</div>
                <div style="font-size: 0.8rem; color: #888;">${layer.entityCount} entities</div>
                <div class="mapping-status" style="font-size: 0.75rem; margin-top: 0.25rem;">
                    <span class="mapped-indicator" style="display: none; color: #4ae24a;">✓ Mapped to: <span class="mapped-to-text"></span></span>
                    <span class="unmapped-indicator" style="color: #666;">Click to map</span>
                </div>
            </div>
        `;
        
        layerCard.addEventListener('click', (e) => toggleLayerSelection(layer.name, e));
        
        layersList.appendChild(layerCard);
    });
}

// Extract layers from loaded file
function extractDxfLayers() {
    if (!viewer || !viewer.parsedDxf || !viewer.parsedDxf.entities) {
        return [];
    }
    
    const layerCounts = {};
    
    // Count entities per layer
    viewer.parsedDxf.entities.forEach(entity => {
        const layerName = entity.layer || '0';
        layerCounts[layerName] = (layerCounts[layerName] || 0) + 1;
    });
    
    // Convert to array format
    return Object.entries(layerCounts).map(([name, count]) => ({
        name: name,
        entityCount: count
    }));
}
// Load internal line types column
async function loadInternalLineTypesColumn() {
    const lineTypesList = document.getElementById('internalLineTypesList');
    if (!lineTypesList) return;
    
    lineTypesList.innerHTML = '';
    
    // Get current line types from configuration
    const currentLineTypes = await getCurrentLineTypes();
    
    // Get current tool set for dropdown options
    const currentTools = getCurrentToolSet();
    
    currentLineTypes.forEach(lineType => {
        const lineTypeCard = document.createElement('div');
        lineTypeCard.className = 'mapping-item line-type';
        lineTypeCard.dataset.lineType = lineType.name;
        
        // Generate tool dropdown options
        let toolOptions = '<option value="">-- No Tool Assigned --</option>';
        Object.entries(currentTools).forEach(([toolId, tool]) => {
            toolOptions += `<option value="${toolId}">${toolId} - ${tool.name}</option>`;
        });
        
        lineTypeCard.innerHTML = `
            <div class="line-type-card" style="padding: 0.75rem; border: 1px solid #555; border-radius: 4px; margin-bottom: 0.5rem; cursor: pointer; background: #2a2a2a; position: relative; height: 140px; display: flex; flex-direction: column; box-sizing: border-box;">
                <div style="font-weight: bold; color: #e2a04a; font-size: 0.9rem; margin-bottom: 0.3rem; line-height: 1.1; height: 1.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${lineType.name}</div>
                <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem; height: 1rem; line-height: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${lineType.description || 'Cutting operation'}</div>
                
                <!-- Input connections (from DXF layers) -->
                <div class="input-connections" style="margin-bottom: 0.5rem; flex: 1; min-height: 2.5rem;">
                    <div class="connection-header" style="font-size: 0.65rem; color: #666; margin-bottom: 0.25rem;">Input Layers:</div>
                    <div class="connected-layers" style="font-size: 0.7rem; color: #4a90e2; min-height: 1.5rem; line-height: 1.2; max-height: 2rem; overflow-y: auto;">
                        <span class="no-layers" style="color: #666; font-style: italic; font-size: 0.65rem;">No layers mapped</span>
                    </div>
                </div>
                
                <!-- Output connections (to machine tools) -->
                <div class="output-connections" style="height: 2.5rem; flex-shrink: 0;">
                    <div class="connection-header" style="font-size: 0.65rem; color: #666; margin-bottom: 0.25rem;">Output Tool:</div>
                    <div class="connected-tool" style="font-size: 0.7rem; color: #4ae24a; min-height: 1.5rem; line-height: 1.2; max-height: 1.5rem; overflow: hidden;">
                        <select class="tool-dropdown" style="width: 100%; background: #333; color: #fff; border: 1px solid #555; border-radius: 3px; padding: 2px 4px; font-size: 0.7rem;" data-line-type="${lineType.name}">
                            ${toolOptions}
                        </select>
                    </div>
                </div>
                
                <!-- Visual connection indicator -->
                <div class="connection-indicator" style="position: absolute; left: -10px; top: 50%; transform: translateY(-50%); width: 8px; height: 8px; border-radius: 50%; background: #666; display: none;"></div>
            </div>
        `;
        
        // Add event listener for tool dropdown change
        const toolDropdown = lineTypeCard.querySelector('.tool-dropdown');
        toolDropdown.addEventListener('change', (e) => {
            e.stopPropagation(); // Prevent line type selection
            const selectedTool = e.target.value;
            const lineTypeName = e.target.dataset.lineType;
            
            if (selectedTool) {
                // Update the mapping
                updateLineTypeToolMapping(lineTypeName, selectedTool);
                showStatus(`Mapped ${lineTypeName} → ${selectedTool}`, 'success');
            } else {
                // Remove the mapping
                removeLineTypeMapping(lineTypeName, lineTypeCard);
                showStatus(`Removed mapping for ${lineTypeName}`, 'info');
            }
        });
        
        lineTypeCard.addEventListener('click', (e) => {
            // Don't trigger line type selection if clicking on dropdown
            if (!e.target.classList.contains('tool-dropdown')) {
                selectLineType(lineType.name);
            }
        });
        
        lineTypesList.appendChild(lineTypeCard);
    });
    
    // Load existing mappings to set dropdown values
    loadExistingMappings();
}

// Get current line types from configuration - load from actual line types data
async function getCurrentLineTypes() {
    try {
        // Try to load from external line types data
        const response = await window.electronAPI?.getLineTypes?.();
        if (response && response.lineTypes) {
            return response.lineTypes.map(lt => ({
                name: lt.name || lt.id,
                description: lt.description || `${lt.name} operation`
            }));
        }
    } catch (error) {
        console.log('Could not load external line types, using defaults');
    }
    
    // Fallback to comprehensive list matching your Line Types Manager
    const comprehensiveLineTypes = [
        // CW operations - matching your list
        { name: '1pt CW', description: '1 point' },
        { name: '2pt CW', description: '2 points' },
        { name: '3pt CW', description: '3 points' },
        { name: '4pt CW', description: '4 points' },
        { name: '1.5pt CW', description: '1.5 points' },
        { name: 'Fine Cut CW', description: 'Fine cut CW' },
        { name: 'Cut CW', description: 'Cut CW' },
        
        // Pulse operations
        { name: '2pt Puls', description: '2 points' },
        { name: '3pt Puls', description: '3 points' },
        { name: '4pt Puls', description: '4 points' },
        { name: '1pt Puls', description: '1 point' },
        { name: '1.5pt Puls', description: '1.5 points' },
        { name: 'Fine Cut Pulse', description: 'Fine cut pulse' },
        { name: 'Pulse_1', description: 'Pulse_1' },
        { name: 'Pulse_2', description: 'Pulse_2' },
        
        // Bridge operations
        { name: '2pt Bridge', description: '2 points bridge' },
        { name: '3pt Bridge', description: '3 points bridge' },
        { name: '4pt Bridge', description: '4 points bridge' },
        
        // Engraving operations
        { name: 'Fast Engrave', description: 'Fast Engrave' },
        { name: 'Nozzle Engrave', description: 'Nozzle Engrave' },
        { name: 'Engrave', description: 'Engrave' },
        
        // Specialized operations
        { name: 'Groove', description: 'Groove' },
        
        // Milling operations 1-7
        { name: 'Milling 1', description: 'Milling 1' },
        { name: 'Milling 2', description: 'Milling 2' },
        { name: 'Milling 3', description: 'Milling 3' },
        { name: 'Milling 4', description: 'Milling 4' },
        { name: 'Milling 5', description: 'Milling 5' },
        { name: 'Milling 6', description: 'Milling 6' },
        { name: 'Milling 7', description: 'Milling 7' },
        
        // Basic operations (keep some basics)
        { name: 'cutting', description: 'Standard cutting operations' },
        { name: 'engraving', description: 'Text and detail engraving' },
        { name: 'perforating', description: 'Perforation lines' },
        { name: 'scoring', description: 'Score lines for folding' },
        { name: 'marking', description: 'Reference marks' },
        { name: 'construction', description: 'Construction lines (skipped)' }
    ];
    
    return comprehensiveLineTypes;
}

// Load machine tools column
function loadMachineToolsColumn() {
    const toolsList = document.getElementById('machineToolsList');
    if (!toolsList) return;
    
    toolsList.innerHTML = '';
    
    const currentTools = getCurrentToolSet();
    
    Object.entries(currentTools).forEach(([toolId, tool]) => {
        const toolCard = document.createElement('div');
        toolCard.className = 'mapping-item machine-tool';
        toolCard.dataset.toolId = toolId;
        toolCard.innerHTML = `
            <div style="padding: 0.75rem; border: 1px solid #555; border-radius: 4px; margin-bottom: 0.5rem; cursor: pointer; background: #2a2a2a;">
                <div style="font-weight: bold; color: #4ae24a;">${toolId} - ${tool.name}</div>
                <div style="font-size: 0.8rem; color: #888;">H-Code: ${tool.hCode} | Width: ${tool.width}mm</div>
                <div style="font-size: 0.8rem; color: #888;">${tool.description}</div>
                <div class="mapping-arrow" style="display: none; color: #e2a04a;">← <span class="mapped-from"></span></div>
            </div>
        `;
        
        toolCard.addEventListener('click', () => selectMachineTool(toolId));
        toolsList.appendChild(toolCard);
    });
}
// Enhanced state variables for multi-mapping workflow
let selectedDxfLayers = new Set(); // Support multiple layer selection
let selectedLineType = null;
let selectedMachineTool = null;
let mappingState = 'none'; // 'layer-to-linetype' or 'linetype-to-tool'
let multiSelectMode = false;

// Enhanced layer selection with multi-select support
function toggleLayerSelection(layerName, event) {
    const layerEl = document.querySelector(`[data-layer="${layerName}"]`);
    if (!layerEl) return;
    
    const layerCard = layerEl.querySelector('.layer-card');
    const checkbox = layerEl.querySelector('.selection-checkbox');
    
    // Handle multi-select mode
    if (event.ctrlKey || event.metaKey || multiSelectMode) {
        // Toggle selection in multi-select mode
        if (selectedDxfLayers.has(layerName)) {
            selectedDxfLayers.delete(layerName);
            layerCard.style.background = '#2a2a2a';
            layerCard.style.border = '1px solid #555';
            checkbox.style.background = 'transparent';
            checkbox.innerHTML = '';
        } else {
            selectedDxfLayers.add(layerName);
            layerCard.style.background = '#1a3a5a';
            layerCard.style.border = '1px solid #4a90e2';
            checkbox.style.background = '#4a90e2';
            checkbox.innerHTML = '✓';
        }
        
        // Show selection count
        if (selectedDxfLayers.size > 0) {
            mappingState = 'layer-to-linetype';
            updateSelectionStatus(`${selectedDxfLayers.size} layers selected. Click a Line Type to map them all.`);
            
            // Show checkboxes for all layers when in multi-select mode
            document.querySelectorAll('.selection-checkbox').forEach(cb => cb.style.display = 'block');
        } else {
            mappingState = 'none';
            updateSelectionStatus('No layers selected');
            document.querySelectorAll('.selection-checkbox').forEach(cb => cb.style.display = 'none');
        }
    } else {
        // Single selection mode
        clearLayerSelections();
        selectedDxfLayers.add(layerName);
        layerCard.style.background = '#1a3a5a';
        layerCard.style.border = '1px solid #4a90e2';
        mappingState = 'layer-to-linetype';
        updateSelectionStatus(`Selected layer: ${layerName}. Hold Ctrl/Cmd for multi-select, or click a Line Type to map.`);
    }
}

// Clear all layer selections
function clearLayerSelections() {
    selectedDxfLayers.clear();
    document.querySelectorAll('.dxf-layer').forEach(el => {
        const layerCard = el.querySelector('.layer-card');
        const checkbox = el.querySelector('.selection-checkbox');
        if (layerCard) {
            layerCard.style.background = '#2a2a2a';
            layerCard.style.border = '1px solid #555';
        }
        if (checkbox) {
            checkbox.style.background = 'transparent';
            checkbox.innerHTML = '';
            checkbox.style.display = 'none';
        }
    });
}
function selectLineType(lineTypeName) {
    // Clear previous line type selections
    document.querySelectorAll('.line-type').forEach(el => {
        const card = el.querySelector('.line-type-card');
        if (card) {
            card.style.background = '#2a2a2a';
            card.style.border = '1px solid #555';
        }
    });
    
    // Highlight selected line type
    const lineTypeEl = document.querySelector(`[data-line-type="${lineTypeName}"]`);
    if (lineTypeEl) {
        const card = lineTypeEl.querySelector('.line-type-card');
        if (card) {
            card.style.background = '#3a2a1a';
            card.style.border = '1px solid #e2a04a';
        }
        selectedLineType = lineTypeName;
        
        if (mappingState === 'layer-to-linetype' && selectedDxfLayers.size > 0) {
            // Create many-to-one layer to line type mapping
            createMultiLayerToLineTypeMapping(Array.from(selectedDxfLayers), lineTypeName);
            
            // Update visual indicators immediately
            updateMappingVisuals();
            
            clearLayerSelections();
            resetMappingState();
        } else {
            // Starting line type to tool mapping
            mappingState = 'linetype-to-tool';
            updateSelectionStatus(`Selected line type: ${lineTypeName}. Now click a Machine Tool to assign.`);
        }
    }
}

function selectMachineTool(toolId) {
    // Clear previous tool selections
    document.querySelectorAll('.machine-tool').forEach(el => {
        el.style.backgroundColor = '#2a2a2a';
        el.style.border = '1px solid #555';
    });
    
    // Highlight selected tool
    const toolEl = document.querySelector(`[data-tool-id="${toolId}"]`);
    if (toolEl) {
        toolEl.style.backgroundColor = '#1a3a1a';
        toolEl.style.border = '1px solid #4ae24a';
        selectedMachineTool = toolId;
        
        if (mappingState === 'linetype-to-tool' && selectedLineType) {
            // Create line type to tool mapping
            createLineTypeToToolMapping(selectedLineType, toolId);
            
            // Update visual indicators immediately
            updateMappingVisuals();
            
            // Store the previous line type before reset
            const prevLineType = selectedLineType;
            
            // Reset state but keep mappings visible
            resetMappingState();
            updateSelectionStatus(`Mapped line type "${prevLineType}" to tool "${toolId}". Ready for next mapping.`);
        } else {
            updateSelectionStatus(`Selected tool: ${toolId}. Select a line type first to create mapping.`);
        }
    }
}

function resetMappingState() {
    selectedLineType = null; 
    selectedMachineTool = null;
    mappingState = 'none';
    
    // Reset line type and tool backgrounds
    document.querySelectorAll('.line-type').forEach(el => {
        const card = el.querySelector('.line-type-card');
        if (card) {
            card.style.background = '#2a2a2a';
            card.style.border = '1px solid #555';
        }
    });
    
    document.querySelectorAll('.machine-tool').forEach(el => {
        el.style.backgroundColor = '#2a2a2a';
    });
}
// Create mappings
function createLayerToLineTypeMapping(layerName, lineTypeName) {
    // Update configuration
    if (!currentPostprocessorConfig.mappingWorkflow) {
        currentPostprocessorConfig.mappingWorkflow = { layerToLineType: [] };
    }
    if (!currentPostprocessorConfig.mappingWorkflow.layerToLineType) {
        currentPostprocessorConfig.mappingWorkflow.layerToLineType = [];
    }
    
    // Extract color from layer data for layer+color mapping
    let color = null;
    if (window.currentLayerData) {
        const found = window.currentLayerData.find(l => l.name === layerName || l.originalLayerName === layerName);
        if (found) {
            color = found.color;
            console.log(`createLayerToLineTypeMapping: found color ${color} for layer ${layerName}`);
        }
    }
    
    // Remove existing mapping for this layer+color combination
    currentPostprocessorConfig.mappingWorkflow.layerToLineType = 
        currentPostprocessorConfig.mappingWorkflow.layerToLineType.filter(m => !(m.layer === layerName && m.color === color));
    
    // Add new mapping with color
    currentPostprocessorConfig.mappingWorkflow.layerToLineType.push({
        layer: layerName,
        color: color,
        lineType: lineTypeName
    });
    
    console.log(`createLayerToLineTypeMapping: added mapping layer=${layerName}, color=${color}, lineType=${lineTypeName}`);
    console.log('Current mappings:', currentPostprocessorConfig.mappingWorkflow.layerToLineType);
    
    // Update visual indicators
    updateMappingVisuals();
    
    showStatus(`Mapped layer "${layerName}" (color ${color}) to line type "${lineTypeName}"`, 'success');
}
// Create many-to-one layer mappings (multiple layers to single line type)
function createMultiLayerToLineTypeMapping(layerNames, lineTypeName) {
    if (!currentPostprocessorConfig.mappingWorkflow) {
        currentPostprocessorConfig.mappingWorkflow = { layerToLineType: [] };
    }
    if (!currentPostprocessorConfig.mappingWorkflow.layerToLineType) {
        currentPostprocessorConfig.mappingWorkflow.layerToLineType = [];
    }
    
    // Remove existing mappings for these layers
    layerNames.forEach(layerName => {
        // Extract color from layer data for each layer
        let color = null;
        if (window.currentLayerData) {
            const found = window.currentLayerData.find(l => l.name === layerName || l.originalLayerName === layerName);
            if (found) {
                color = found.color;
            }
        }
        
        // Remove existing mapping for this layer+color
        currentPostprocessorConfig.mappingWorkflow.layerToLineType = 
            currentPostprocessorConfig.mappingWorkflow.layerToLineType.filter(m => !(m.layer === layerName && m.color === color));
        
        // Add new mapping for layer+color
        currentPostprocessorConfig.mappingWorkflow.layerToLineType.push({
            layer: layerName,
            color: color,
            lineType: lineTypeName
        });
    });
    
    // Update visual indicators
    updateMappingVisuals();
    
    const layersList = layerNames.join(', ');
    showStatus(`Mapped ${layerNames.length} layers (${layersList}) to line type "${lineTypeName}"`, 'success');
}

function createLineTypeToToolMapping(lineTypeName, toolId) {
    // Update configuration
    if (!currentPostprocessorConfig.mappingWorkflow) {
        currentPostprocessorConfig.mappingWorkflow = { lineTypeToTool: [] };
    }
    if (!currentPostprocessorConfig.mappingWorkflow.lineTypeToTool) {
        currentPostprocessorConfig.mappingWorkflow.lineTypeToTool = [];
    }
    
    // Remove existing mapping for this line type
    currentPostprocessorConfig.mappingWorkflow.lineTypeToTool = 
        currentPostprocessorConfig.mappingWorkflow.lineTypeToTool.filter(m => m.lineType !== lineTypeName);
    
    // Add new mapping
    currentPostprocessorConfig.mappingWorkflow.lineTypeToTool.push({
        lineType: lineTypeName,
        tool: toolId
    });
    
    // Update visual indicators
    updateMappingVisuals();
    
    showStatus(`Mapped line type "${lineTypeName}" to tool "${toolId}"`, 'success');
}

// Update visual mapping indicators
function updateMappingVisuals() {
    loadExistingMappings();
}

// Load existing mappings and show enhanced visual connections with many-to-one support
function loadExistingMappings() {
    console.log('loadExistingMappings called');
    
    // Use the processed layer data instead of postprocessor config mappings
    const processedLayers = window.processedLayersWithLineTypes || window.currentLayerData || [];
    console.log('Processed layers with line types:', processedLayers);
    
    if (!processedLayers || processedLayers.length === 0) {
        console.log('No processed layer data found');
        return;
    }
    
    // Clear all existing mapping displays
    clearMappingVisuals();
    
    // Create layer mappings from processed data - only include layers that have lineTypeId
    const layerMappings = processedLayers.filter(layer => layer.lineTypeId).map(layer => ({
        layer: layer.name,
        lineType: layer.lineTypeId
    }));
    
    console.log('Created layer mappings from processed data:', layerMappings);
    
    const toolMappings = currentPostprocessorConfig?.mappingWorkflow?.lineTypeToTool || [];
    
    // Group layers by line type (many-to-one support)
    const lineTypeToLayers = {};
    layerMappings.forEach(mapping => {
        if (!lineTypeToLayers[mapping.lineType]) {
            lineTypeToLayers[mapping.lineType] = [];
        }
        lineTypeToLayers[mapping.lineType].push(mapping.layer);
    });
    
    // Update layer visual indicators
    console.log('updateMappingVisuals: Processing', layerMappings.length, 'layer mappings');
    layerMappings.forEach(mapping => {
        console.log('Looking for layer element with selector:', `[data-layer="${mapping.layer}"]`);
        const layerEl = document.querySelector(`[data-layer="${mapping.layer}"]`);
        console.log('Found layer element:', layerEl);
        
        if (layerEl) {
            const mappedIndicator = layerEl.querySelector('.mapped-indicator');
            const unmappedIndicator = layerEl.querySelector('.unmapped-indicator');
            const mappedToText = layerEl.querySelector('.mapped-to-text');
            const layerCard = layerEl.querySelector('.layer-card');
            
            console.log('Elements found:', {
                mappedIndicator: !!mappedIndicator,
                unmappedIndicator: !!unmappedIndicator,
                mappedToText: !!mappedToText,
                layerCard: !!layerCard
            });
            
            if (mappedIndicator && unmappedIndicator && mappedToText) {
                console.log(`Updating mapping status for layer: ${mapping.layer} -> ${mapping.lineType}`);
                mappedIndicator.style.display = 'block';
                unmappedIndicator.style.display = 'none';
                
                // Shorten the tool name for better UI
                let displayText = mapping.lineType;
                if (displayText.length > 12) {
                    displayText = displayText.substring(0, 10) + '...';
                }
                mappedToText.textContent = displayText;
                
                // Ensure edit button is visible
                const editBtn = mappedIndicator.querySelector('.edit-mapping-btn');
                if (editBtn) {
                    editBtn.style.display = 'inline-block';
                    console.log(`Edit button found and made visible for layer: ${mapping.layer}`);
                } else {
                    console.log(`Edit button NOT found for layer: ${mapping.layer}`);
                }
                
                // Add hover effect for mapped layers and setup edit button
                if (layerCard) {
                    layerCard.style.cursor = 'pointer';
                    layerCard.title = `Layer "${mapping.layer}" is mapped to "${mapping.lineType}". Click the edit button (✏️) to modify mapping.`;
                    
                    // Setup edit button functionality - use event delegation from layer card
                    const editBtn = mappedIndicator.querySelector('.edit-mapping-btn');
                    if (editBtn) {
                        console.log(`Setting up edit button for layer: ${mapping.layer}`);
                        
                        // Remove any existing event listeners
                        editBtn.onclick = function(e) {
                            e.stopPropagation();
                            console.log(`Edit button clicked for layer: ${mapping.layer}`);
                            
                            if (window.electronAPI && window.electronAPI.openGlobalImportFilterManager) {
                                window.electronAPI.openGlobalImportFilterManager();
                                showStatus(`Opening global filter to edit mapping for layer "${mapping.layer}"`, 'info');
                            } else {
                                console.error('electronAPI.openGlobalImportFilterManager not available');
                                showStatus('Global filter manager is not available', 'error');
                            }
                        };
                        
                        // Add hover effect to edit button
                        editBtn.onmouseenter = function() {
                            this.style.backgroundColor = '#357abd';
                            this.style.transform = 'scale(1.1)';
                        };
                        
                        editBtn.onmouseleave = function() {
                            this.style.backgroundColor = '#4a90e2';
                            this.style.transform = 'scale(1)';
                        };
                    }
                    
                    // Add enhanced hover effect for mapped layers
                    layerCard.addEventListener('mouseenter', function() {
                        this.style.boxShadow = '0 2px 8px rgba(74, 144, 226, 0.3)';
                        this.style.transform = 'translateY(-1px)';
                        this.style.transition = 'all 0.2s ease';
                    });
                    
                    layerCard.addEventListener('mouseleave', function() {
                        this.style.boxShadow = 'none';
                        this.style.transform = 'translateY(0)';
                    });
                }
            }
        }
    });
    // Update line type visual indicators (show input layers and output tools)
    Object.entries(lineTypeToLayers).forEach(([lineType, layers]) => {
        const lineTypeEl = document.querySelector(`[data-line-type="${lineType}"]`);
        if (lineTypeEl) {
            // Show connected input layers
            const connectedLayersEl = lineTypeEl.querySelector('.connected-layers');
            const noLayersEl = lineTypeEl.querySelector('.no-layers');
            
            if (connectedLayersEl && noLayersEl) {
                noLayersEl.style.display = 'none';
                connectedLayersEl.innerHTML = layers.map(layer => 
                    `<span style="background: #4a90e2; color: white; padding: 2px 6px; border-radius: 3px; margin: 2px; display: inline-block; font-size: 0.7rem;">${layer}</span>`
                ).join('');
            }
            
            // Show connection indicator
            const connectionIndicator = lineTypeEl.querySelector('.connection-indicator');
            if (connectionIndicator) {
                connectionIndicator.style.display = 'block';
                connectionIndicator.style.background = '#4a90e2';
            }
        }
    });
    
    // Update tool assignments for line types
    toolMappings.forEach(mapping => {
        const lineTypeEl = document.querySelector(`[data-line-type="${mapping.lineType}"]`);
        if (lineTypeEl) {
            const toolDropdown = lineTypeEl.querySelector('.tool-dropdown');
            
            if (toolDropdown) {
                // Set the dropdown value to the mapped tool
                toolDropdown.value = mapping.tool;
            }
        }
    });
}

// Clear all mapping visual indicators
function clearMappingVisuals() {
    // Reset layer indicators
    document.querySelectorAll('.dxf-layer').forEach(el => {
        const mappedIndicator = el.querySelector('.mapped-indicator');
        const unmappedIndicator = el.querySelector('.unmapped-indicator');
        
        if (mappedIndicator && unmappedIndicator) {
            mappedIndicator.style.display = 'none';
            unmappedIndicator.style.display = 'block';
        }
    });
    
    // Reset line type indicators
    document.querySelectorAll('.line-type').forEach(el => {
        const connectedLayersEl = el.querySelector('.connected-layers');
        const noLayersEl = el.querySelector('.no-layers');
        const toolDropdown = el.querySelector('.tool-dropdown');
        const connectionIndicator = el.querySelector('.connection-indicator');
        
        if (connectedLayersEl && noLayersEl) {
            connectedLayersEl.innerHTML = '';
            noLayersEl.style.display = 'block';
        }
        
        if (toolDropdown) {
            // Reset dropdown to "no tool assigned"
            toolDropdown.value = '';
        }
        
        if (connectionIndicator) {
            connectionIndicator.style.display = 'none';
        }
    });
}

// Get display name for tool
function getToolDisplayName(toolId) {
    const config = currentPostprocessorConfig;
    if (config?.tools?.[toolId]?.name) {
        return config.tools[toolId].name;
    }
    
    // Fallback tool names
    const defaultNames = {
        'T1': 'Fine Engraving',
        'T2': 'Standard Cutting', 
        'T3': 'Perforation',
        'T4': 'Heavy Cutting',
        'T20': 'Engraving',
        'T22': 'Fine Cut'
    };
    
    return defaultNames[toolId] || 'Unknown Tool';
}

// Update selection status in the mapping interface
function updateSelectionStatus(message) {
    const statusEl = document.getElementById('selectionStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = selectedDxfLayers.size > 0 ? '#58a6ff' : '#7d8590';
    }
}

// Event handler functions
function refreshDxfLayers() {
    loadDxfLayersColumn();
    showStatus('Refreshed DXF layers from loaded file', 'success');
}
function addNewLineType() {
    const lineTypeName = prompt('Enter new line type name:');
    if (lineTypeName && lineTypeName.trim()) {
        loadInternalLineTypesColumn(); // Reload with new type
        showStatus(`Added line type: ${lineTypeName}`, 'success');
    }
}

function autoMapCommonLayers() {
    // Auto-map common layer patterns
    const commonMappings = {
        'CUT': 'cutting',
        'CUTTING': 'cutting', 
        'ENGRAVE': 'engraving',
        'ENGRAVING': 'engraving',
        'TEXT': 'engraving',
        'ACXTEMP': 'Nozzle Engrave',
        'GA_DIE': '2pt Puls',
        'GRIP': 'Fine Cut CW',
        'NAME': 'Nozzle Engrave'
    };
    
    Object.entries(commonMappings).forEach(([layer, lineType]) => {
        createLayerToLineTypeMapping(layer, lineType);
    });
    
    showStatus('Auto-mapped common layer patterns', 'success');
}

function clearAllMappings() {
    if (confirm('Clear all mappings? This cannot be undone.')) {
        if (currentPostprocessorConfig.mappingWorkflow) {
            currentPostprocessorConfig.mappingWorkflow.layerToLineType = [];
            currentPostprocessorConfig.mappingWorkflow.lineTypeToTool = [];
        }
        updateMappingVisuals();
        showStatus('Cleared all mappings', 'info');
    }
}

function saveUnifiedMappings() {
    // Save current configuration
    if (currentPostprocessorConfig) {
        showStatus('Mappings saved successfully', 'success');
        document.querySelector('.modal').remove();
    }
}
// Update line type to tool mapping
function updateLineTypeToolMapping(lineTypeName, toolId) {
    if (!currentPostprocessorConfig) {
        showStatus('No postprocessor profile selected', 'error');
        return;
    }
    
    // Initialize mappingWorkflow structure if it doesn't exist
    if (!currentPostprocessorConfig.mappingWorkflow) {
        currentPostprocessorConfig.mappingWorkflow = {};
    }
    
    if (!currentPostprocessorConfig.mappingWorkflow.lineTypeToTool) {
        currentPostprocessorConfig.mappingWorkflow.lineTypeToTool = [];
    }
    
    // Remove existing mapping for this line type
    currentPostprocessorConfig.mappingWorkflow.lineTypeToTool = 
        currentPostprocessorConfig.mappingWorkflow.lineTypeToTool.filter(m => m.lineType !== lineTypeName);
    
    // Add new mapping
    currentPostprocessorConfig.mappingWorkflow.lineTypeToTool.push({
        lineType: lineTypeName,
        tool: toolId
    });
    
    console.log(`Updated mapping: ${lineTypeName} → ${toolId}`);
    showStatus(`Updated mapping: ${lineTypeName} → ${toolId}`, 'success');
}
// Remove line type mapping
function removeLineTypeMapping(lineType, cardElement) {
        // Remove from configuration
    if (currentPostprocessorConfig?.mappingWorkflow?.lineTypeToTool) {
        currentPostprocessorConfig.mappingWorkflow.lineTypeToTool = 
            currentPostprocessorConfig.mappingWorkflow.lineTypeToTool.filter(m => m.lineType !== lineType);
    }
    
    // Reset dropdown to "no tool assigned"
    if (cardElement) {
        const toolDropdown = cardElement.querySelector('.tool-dropdown');
        if (toolDropdown) {
            toolDropdown.value = '';
        }
    }
        
        showStatus(`Removed mapping for ${lineType}`, 'success');
}

// Show modal to add new line type mapping
function showAddLineTypeMappingModal(actualLineTypes, availableTools, mappingGrid) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="width: 500px;">
            <div class="modal-header">
                <h3>Add Line Type Mapping</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 1rem;">
                    <label for="selectLineType" style="display: block; margin-bottom: 0.5rem; color: #fff; font-weight: bold;">Select Line Type:</label>
                    <select id="selectLineType" style="background: #1a1a1a; border: 1px solid #555; color: #fff; padding: 0.5rem; border-radius: 4px; width: 100%;">
                        <option value="">Choose a line type...</option>
                    </select>
                </div>
                <div style="margin-bottom: 1rem;">
                    <label for="selectTool" style="display: block; margin-bottom: 0.5rem; color: #fff; font-weight: bold;">Select Tool:</label>
                    <select id="selectTool" style="background: #1a1a1a; border: 1px solid #555; color: #fff; padding: 0.5rem; border-radius: 4px; width: 100%;">
                        <option value="none">None (Skip)</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" id="confirmAddMapping">Add Mapping</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Populate line types dropdown (only show unmapped ones)
    const lineTypeSelect = modal.querySelector('#selectLineType');
    const currentMappings = currentPostprocessorConfig?.lineTypeMappings?.customMappings || {};
    
    actualLineTypes.forEach(lineType => {
        const lineTypeName = lineType.name || lineType.id || lineType;
        if (!currentMappings[lineTypeName]) {
            const option = document.createElement('option');
            option.value = lineTypeName;
            option.textContent = `${lineTypeName} - ${lineType.description || 'No description'}`;
            lineTypeSelect.appendChild(option);
        }
    });
    
    // Populate tools dropdown
    const toolSelect = modal.querySelector('#selectTool');
    const toolIds = Object.keys(availableTools);
    toolIds.forEach(toolId => {
        const toolInfo = availableTools[toolId];
        const option = document.createElement('option');
        option.value = toolId;
        option.textContent = toolInfo ? `${toolId} - ${toolInfo.name}` : toolId;
        toolSelect.appendChild(option);
    });
    
    // Add confirm button handler
    modal.querySelector('#confirmAddMapping').addEventListener('click', () => {
        const selectedLineType = lineTypeSelect.value;
        const selectedTool = toolSelect.value;
        
        if (!selectedLineType) {
            alert('Please select a line type');
            return;
        }
        
        // Add the mapping
        updateLineTypeToolMapping(selectedLineType, selectedTool);
        
        // Refresh the mappings display
        modal.remove();
        // Reload the mapping configuration to show the new mapping
        loadModalMappingConfiguration();
    });
}

// Priority Management - Global state for separate lists
let currentPriorityLists = {
    lineType: [],
    tool: []
};

// Priority Management Functions
async function updateAvailableItems(modal, mode) {
    // Save current priority list before switching (only if modal elements exist)
    if (modal.querySelector('input[name="priorityMode"]:checked')) {
        savePriorityListToMemory(modal);
    }
    
    const availableSelect = modal.querySelector('#availableItemsSelect');
    const prioritySelect = modal.querySelector('#priorityOrderList');
    
    // Clear both lists
    availableSelect.innerHTML = '';
    prioritySelect.innerHTML = '';
    
    // Get all items for the current mode
    let allItems = [];
    if (mode === 'lineType') {
        // Load line types
        try {
            const lineTypesResponse = await window.electronAPI.loadLineTypes();
            const lineTypes = lineTypesResponse?.success ? lineTypesResponse.data : [];
            allItems = lineTypes.map(lineType => ({
                value: lineType.name || lineType.id || lineType,
                text: lineType.name || lineType.id || lineType
            }));
        } catch (error) {
            console.error('Error loading line types:', error);
        }
    } else if (mode === 'tool') {
        // Load tools
        const availableTools = getCurrentToolSet();
        allItems = Object.entries(availableTools).map(([toolId, toolInfo]) => ({
            value: toolId,
            text: `${toolId} - ${toolInfo.name}`
        }));
    }
    
    // Get the saved priority list for this mode
    const savedPriorityList = currentPriorityLists[mode] || [];
    
    // Add items to priority list if they're in the saved list
    savedPriorityList.forEach(item => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.text;
        if (item.value === '__LINE_BREAK__') {
            option.style.color = '#888';
            option.style.fontStyle = 'italic';
        }
        prioritySelect.appendChild(option);
    });
    
    // Add remaining items to available list
    allItems.forEach(item => {
        const isInPriorityList = savedPriorityList.some(priorityItem => 
            priorityItem.value === item.value && priorityItem.value !== '__LINE_BREAK__'
        );
        
        if (!isInPriorityList) {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = item.text;
            availableSelect.appendChild(option);
        }
    });
}

function savePriorityListToMemory(modal) {
    if (!modal) return;
    
    const currentModeElement = modal.querySelector('input[name="priorityMode"]:checked');
    if (!currentModeElement) return;
    
    const currentMode = currentModeElement.value;
    const prioritySelect = modal.querySelector('#priorityOrderList');
    
    if (!prioritySelect) return;
    
    const priorityList = Array.from(prioritySelect.options).map(option => ({
        value: option.value,
        text: option.textContent
    }));
    
    currentPriorityLists[currentMode] = priorityList;
}
function addToPriorityList(modal) {
    const availableSelect = modal.querySelector('#availableItemsSelect');
    const prioritySelect = modal.querySelector('#priorityOrderList');
    const selectedOptions = Array.from(availableSelect.selectedOptions);
    
    selectedOptions.forEach(option => {
        const newOption = document.createElement('option');
        newOption.value = option.value;
        newOption.textContent = option.textContent;
        prioritySelect.appendChild(newOption);
    });
    
    // Remove selected items from available list
    selectedOptions.forEach(option => option.remove());
}

function insertLineBreak(modal) {
    const prioritySelect = modal.querySelector('#priorityOrderList');
    const lineBreak = document.createElement('option');
    lineBreak.value = '__LINE_BREAK__';
    lineBreak.textContent = '--- LINE BREAK ---';
    lineBreak.style.color = '#888';
    lineBreak.style.fontStyle = 'italic';
    
    // Insert at selected position or at the end
    const selectedIndex = prioritySelect.selectedIndex;
    if (selectedIndex >= 0) {
        prioritySelect.insertBefore(lineBreak, prioritySelect.options[selectedIndex + 1]);
    } else {
        prioritySelect.appendChild(lineBreak);
    }
}

function clearPriorityList(modal) {
    const prioritySelect = modal.querySelector('#priorityOrderList');
    const availableSelect = modal.querySelector('#availableItemsSelect');
    
    // Move non-line-break items back to available list
    Array.from(prioritySelect.options).forEach(option => {
        if (option.value !== '__LINE_BREAK__') {
            const newOption = document.createElement('option');
            newOption.value = option.value;
            newOption.textContent = option.textContent;
            availableSelect.appendChild(newOption);
        }
    });
    
    prioritySelect.innerHTML = '';
}

function moveItemUp(modal) {
    const prioritySelect = modal.querySelector('#priorityOrderList');
    const selectedIndex = prioritySelect.selectedIndex;
    
    if (selectedIndex > 0) {
        const selectedOption = prioritySelect.options[selectedIndex];
        const previousOption = prioritySelect.options[selectedIndex - 1];
        
        prioritySelect.insertBefore(selectedOption, previousOption);
        selectedOption.selected = true;
    }
}

function moveItemDown(modal) {
    const prioritySelect = modal.querySelector('#priorityOrderList');
    const selectedIndex = prioritySelect.selectedIndex;
    
    if (selectedIndex >= 0 && selectedIndex < prioritySelect.options.length - 1) {
        const selectedOption = prioritySelect.options[selectedIndex];
        const nextOption = prioritySelect.options[selectedIndex + 1];
        
        prioritySelect.insertBefore(nextOption, selectedOption);
        selectedOption.selected = true;
    }
}
function removeFromPriorityList(modal) {
    const prioritySelect = modal.querySelector('#priorityOrderList');
    const availableSelect = modal.querySelector('#availableItemsSelect');
    const selectedOptions = Array.from(prioritySelect.selectedOptions);
    
    selectedOptions.forEach(option => {
        if (option.value !== '__LINE_BREAK__') {
            // Move back to available list
            const newOption = document.createElement('option');
            newOption.value = option.value;
            newOption.textContent = option.textContent;
            availableSelect.appendChild(newOption);
        }
        option.remove();
    });
}
// Configuration Window Management
// Initialize configuration shortcuts
function initializeConfigurationShortcuts() {
    const openToolConfigBtn = document.getElementById('openToolConfigBtn');
    const openMappingConfigBtn = document.getElementById('openMappingConfigBtn');
    const openHeaderConfigBtn = document.getElementById('openHeaderConfigBtn');
    
    openToolConfigBtn?.addEventListener('click', openToolConfigurationWindow);
    openMappingConfigBtn?.addEventListener('click', openMappingsManager);
    openHeaderConfigBtn?.addEventListener('click', openHeaderConfigurationWindow);
}

// Open dedicated tool configuration window
function openToolConfigurationWindow() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="width: 95%; max-width: 1200px; height: 90vh;">
            <div class="modal-header">
                <h3>Tool Configuration</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="height: calc(90vh - 120px); overflow-y: auto;">
                <!-- Tab Navigation -->
                <div style="display: flex; gap: 8px; padding: 8px 8px 0 8px; border-bottom: 2px solid #404040; margin-bottom: 2rem;">
                    <button class="tab-btn active" data-tab="tools" style="
                        flex: 1;
                        background: linear-gradient(135deg, #00BFFF 0%, #0099CC 100%);
                        border: none;
                        color: #ffffff;
                        padding: 1rem 2rem;
                        cursor: pointer;
                        border-radius: 6px 6px 0 0;
                        border-bottom: 3px solid #ffffff;
                        font-weight: 500;
                        transition: all 0.3s ease;
                        box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
                    ">🛠️ Tools & Parameters</button>
                    <button class="tab-btn" data-tab="priority" style="
                        flex: 1;
                        background: #2d2d2d;
                        border: none;
                        color: #cccccc;
                        padding: 1rem 2rem;
                        cursor: pointer;
                        border-radius: 6px 6px 0 0;
                        border-bottom: 3px solid transparent;
                        font-weight: 500;
                        transition: all 0.3s ease;
                    ">🎯 Cutting Priority</button>
                </div>
                
                <!-- Tools & Parameters Tab -->
                <div id="tools-tab" class="tab-content" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <!-- Tool Library Management -->
                <div>
                    <h4 style="color: #4a90e2; margin-bottom: 1rem;">Available Tools</h4>
                    <div class="tool-library-section">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <p style="color: #ccc; margin: 0;">Configure your machine tools (T1-T4) and their parameters.</p>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button class="btn btn-secondary" id="modalRefreshToolsBtn" title="Refresh tools from library">🔄 Refresh</button>
                            <button class="btn btn-primary" id="modalManageToolsBtn">Edit Tools</button>
                                </div>
                        </div>
                        
                        <div class="tool-preview-large" id="modalToolPreview">
                            <div class="tool-grid">
                                <!-- Tool cards will be populated -->
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Tool Parameters -->
                <div>
                    <h4 style="color: #4a90e2; margin-bottom: 1rem;">Tool Parameters</h4>
                    <div class="tool-params-section">
                        <div class="param-group">
                            <div class="param-group-header">
                                <label>
                                    <input type="checkbox" id="enableCuttingSpeeds">
                                    <h5 style="display: inline; margin: 0 0 0 0.5rem;">Cutting Speeds (mm/min)</h5>
                                </label>
                            </div>
                            <div class="param-content" id="cuttingSpeedsContent" style="opacity: 0.5; pointer-events: none;">
                                <div class="param-row">
                                    <label>Engraving Speed:</label>
                                    <input type="number" id="engravingSpeed" value="1200" class="form-input" style="width: 100px;" disabled>
                                </div>
                                <div class="param-row">
                                    <label>Cutting Speed:</label>
                                    <input type="number" id="cuttingSpeed" value="800" class="form-input" style="width: 100px;" disabled>
                                </div>
                                <div class="param-row">
                                    <label>Perforation Speed:</label>
                                    <input type="number" id="perforationSpeed" value="600" class="form-input" style="width: 100px;" disabled>
                                </div>
                            </div>
                        </div>
                        
                        <div class="param-group">
                            <div class="param-group-header">
                                <label>
                                    <input type="checkbox" id="enableToolChange">
                                    <h5 style="display: inline; margin: 0 0 0 0.5rem;">Tool Change Settings</h5>
                                </label>
                            </div>
                            <div class="param-content" id="toolChangeContent" style="opacity: 0.5; pointer-events: none;">
                                <div class="param-row">
                                    <label>Tool Change Time (seconds):</label>
                                    <input type="number" id="toolChangeTime" value="5" step="0.1" class="form-input" style="width: 100px;" disabled>
                                </div>
                                <div class="param-row">
                                    <label>Tool Change Command:</label>
                                    <input type="text" id="toolChangeCommand" value="M6" class="form-input" disabled>
                                </div>
                            </div>
                        </div>
                        
                        <div class="param-group">
                            <div class="param-group-header">
                                <label>
                                    <input type="checkbox" id="enableSafetySettings" checked>
                                    <h5 style="display: inline; margin: 0 0 0 0.5rem;">Safety Settings</h5>
                                </label>
                            </div>
                            <div class="param-content" id="safetySettingsContent">
                                <div class="param-row">
                                    <label>
                                        <input type="checkbox" id="validateToolWidths" checked>
                                        Validate tool widths vs line requirements
                                    </label>
                                </div>
                                <div class="param-row">
                                    <label>
                                        <input type="checkbox" id="warnOnMissingTools" checked>
                                        Warn when required tools are not available
                                    </label>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
                
                <!-- Cutting Priority Tab -->
                <div id="priority-tab" class="tab-content" style="display: none;">
                    <div style="max-width: 1000px; margin: 0 auto;">
                        <h4 style="color: #4a90e2; margin-bottom: 1rem;">🎯 Cutting Priority Configuration</h4>
                        <p style="color: #ccc; margin-bottom: 2rem;">Set the order in which tools will be used during cutting operations. This determines the sequence of tool changes and cutting operations.</p>
                        

                        
                        <!-- Priority Lists Container -->
                        <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 2rem; margin-bottom: 2rem;">
                            <!-- Available Items -->
                            <div>
                                <h5 style="color: #4a90e2; margin-bottom: 1rem;">Available Items</h5>
                                <div id="availableItemsList" style="background: #1a1a1a; border: 1px solid #404040; border-radius: 6px; height: 300px; overflow-y: auto; padding: 1rem;">
                                    <!-- Available items will be populated here -->
                                </div>
                            </div>
                            
                            <!-- Priority Controls -->
                            <div style="display: flex; flex-direction: column; gap: 1rem; justify-content: center;">
                                <button class="btn btn-primary" id="addToPriorityBtn" style="padding: 0.75rem 1rem;">Add →</button>
                                <button class="btn btn-secondary" id="removeFromPriorityBtn" style="padding: 0.75rem 1rem;">← Remove</button>
                                <button class="btn btn-warning" id="insertBreakBtn" style="padding: 0.75rem 1rem;">Insert Break</button>
                            </div>
                            
                            <!-- Priority Order -->
                            <div>
                                <h5 style="color: #4a90e2; margin-bottom: 1rem;">Priority Order</h5>
                                <div style="background: #1a1a1a; border: 1px solid #404040; border-radius: 6px; height: 300px; overflow-y: auto; padding: 1rem;" id="priorityOrderList">
                                    <!-- Priority order will be displayed here -->
                                </div>
                            </div>
                        </div>
                        
                        <!-- Priority Actions -->
                        <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 2rem;">
                            <button class="btn" id="moveUpBtn">↑ Move Up</button>
                            <button class="btn" id="moveDownBtn">↓ Move Down</button>
                            <button class="btn btn-danger" id="clearPriorityBtn">Clear All</button>
                        </div>
                        

                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                <button class="btn btn-primary" id="saveToolConfigBtn">Save & Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load current tool library
    loadModalToolLibrary(modal);
    
    // Add event listeners
    const editToolsBtn = modal.querySelector('#modalManageToolsBtn');
    if (editToolsBtn) {
        editToolsBtn.addEventListener('click', () => {
            modal.remove();
            try {
                showToolsManagerModal();
            } catch (error) {
                console.error('Error opening Tools Manager:', error);
                showStatus('Failed to open Tools Manager', 'error');
            }
        });
    } else {
        console.error('Edit Tools button not found');
    }
    
    // Refresh Tools button
    const refreshToolsBtn = modal.querySelector('#modalRefreshToolsBtn');
    if (refreshToolsBtn) {
        refreshToolsBtn.addEventListener('click', async () => {
            try {
                await loadModalToolLibrary(modal);
                showStatus('Tools refreshed from library', 'success');
            } catch (error) {
                console.error('Error refreshing tools:', error);
                showStatus('Failed to refresh tools', 'error');
            }
        });
    } else {
        console.error('Refresh Tools button not found');
    }
    
    modal.querySelector('#saveToolConfigBtn').addEventListener('click', () => saveToolPriorityConfiguration(modal));
    
    // Add event listeners for parameter group enable/disable checkboxes
    modal.querySelector('#enableCuttingSpeeds').addEventListener('change', function() {
        const content = modal.querySelector('#cuttingSpeedsContent');
        const inputs = content.querySelectorAll('input');
        if (this.checked) {
            content.style.opacity = '1';
            content.style.pointerEvents = 'auto';
            inputs.forEach(input => input.disabled = false);
        } else {
            content.style.opacity = '0.5';
            content.style.pointerEvents = 'none';
            inputs.forEach(input => input.disabled = true);
        }
    });
    
    modal.querySelector('#enableToolChange').addEventListener('change', function() {
        const content = modal.querySelector('#toolChangeContent');
        const inputs = content.querySelectorAll('input');
        if (this.checked) {
            content.style.opacity = '1';
            content.style.pointerEvents = 'auto';
            inputs.forEach(input => input.disabled = false);
        } else {
            content.style.opacity = '0.5';
            content.style.pointerEvents = 'none';
            inputs.forEach(input => input.disabled = true);
        }
    });
    modal.querySelector('#enableSafetySettings').addEventListener('change', function() {
        const content = modal.querySelector('#safetySettingsContent');
        const inputs = content.querySelectorAll('input');
        if (this.checked) {
            content.style.opacity = '1';
            content.style.pointerEvents = 'auto';
            inputs.forEach(input => input.disabled = false);
        } else {
            content.style.opacity = '0.5';
            content.style.pointerEvents = 'none';
            inputs.forEach(input => input.disabled = true);
        }
    });
    
    // Initialize priority management
    initializePriorityManagement(modal);
    
    // Add tab switching functionality
    const tabButtons = modal.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Update active tab button
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.style.background = '#2d2d2d';
                btn.style.color = '#cccccc';
                btn.style.borderBottomColor = 'transparent';
                btn.style.boxShadow = 'none';
            });
            button.classList.add('active');
            button.style.background = 'linear-gradient(135deg, #00BFFF 0%, #0099CC 100%)';
            button.style.color = '#ffffff';
            button.style.borderBottomColor = '#ffffff';
            button.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
            
            // Show/hide tab content
            const tabContents = modal.querySelectorAll('.tab-content');
            tabContents.forEach(content => {
                content.style.display = 'none';
            });
            
            const activeTab = modal.querySelector(`#${tabName}-tab`);
            if (activeTab) {
                activeTab.style.display = tabName === 'tools' ? 'grid' : 'block';
            }
        });
    });
}
// Open dedicated mapping configuration window
async function openMappingConfigurationWindow() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="width: 95%; max-width: 1400px; height: 90vh;">
            <div class="modal-header">
                <h3>Line Type to Tool Mapping Configuration</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="height: calc(90vh - 120px); overflow-y: auto;">
                
                <!-- Current Mappings Overview -->
                <div style="margin-bottom: 2rem;">
                    <h4 style="color: #4a90e2; margin-bottom: 1rem;">Current Line Type → Tool Mappings</h4>
                    <div class="mapping-overview" id="mappingOverview">
                        <div class="mapping-grid">
                            <!-- Current mappings will be displayed here -->
                        </div>
                    </div>
                </div>
                
                <!-- Priority Management System -->
                <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #555;">
                    <h4 style="color: #4a90e2; margin-bottom: 1rem;">Processing Priority & Order</h4>
                    <p style="color: #ccc; font-size: 0.9rem; margin-bottom: 1.5rem;">
                        Define the order in which line types or tools are processed. You can group items and insert line breaks for better organization.
                    </p>
                    
                    <!-- Priority Mode Selection -->
                    <div style="margin-bottom: 2rem; padding: 1rem; background: #333; border-radius: 6px;">
                        <h5 style="color: #4a90e2; margin-bottom: 1rem;">Priority Mode</h5>
                        <div style="display: flex; gap: 2rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="radio" name="priorityMode" value="lineType" id="priorityModeLineType" checked>
                                <span style="color: #fff;">Line Type Priority</span>
                                <span style="color: #888; font-size: 0.8rem;">(Order by internal line types)</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="radio" name="priorityMode" value="tool" id="priorityModeTool">
                                <span style="color: #fff;">Tool Priority</span>
                                <span style="color: #888; font-size: 0.8rem;">(Order by tool numbers)</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Priority Lists Container -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                        <!-- Available Items -->
                        <div>
                            <h5 style="color: #4a90e2; margin-bottom: 1rem;">Available Items</h5>
                            <div style="margin-bottom: 1rem;">
                                <select id="availableItemsSelect" style="background: #1a1a1a; border: 1px solid #555; color: #fff; padding: 0.5rem; width: 100%; height: 200px;" multiple>
                                    <!-- Options will be populated dynamically -->
                                </select>
                            </div>
                            <button class="btn btn-primary btn-small" id="addToPriorityBtn">Add to Priority List →</button>
                        </div>
                        
                        <!-- Priority Order List -->
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <h5 style="color: #4a90e2; margin: 0;">Priority Order</h5>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button class="btn btn-secondary btn-small" id="insertLineBreakBtn">Insert Line Break</button>
                                    <button class="btn btn-secondary btn-small" id="clearPriorityBtn">Clear All</button>
                                </div>
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <select id="priorityOrderList" style="background: #1a1a1a; border: 1px solid #555; color: #fff; padding: 0.5rem; width: 100%; height: 200px;" multiple>
                                    <!-- Priority items will be added here -->
                                </select>
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-secondary btn-small" id="moveUpBtn">↑ Move Up</button>
                                <button class="btn btn-secondary btn-small" id="moveDownBtn">↓ Move Down</button>
                                <button class="btn btn-danger btn-small" id="removeFromPriorityBtn">Remove</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="resetMappingsModalBtn">Reset to Default</button>
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                <button class="btn btn-primary" id="saveMappingConfigBtn">Save Configuration</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Use requestAnimationFrame to ensure DOM is fully rendered before loading configuration
    requestAnimationFrame(async () => {
        await loadModalMappingConfiguration();
    });
    
    // Add event listeners for priority management
    modal.querySelector('#priorityModeLineType').addEventListener('change', () => updateAvailableItems(modal, 'lineType'));
    modal.querySelector('#priorityModeTool').addEventListener('change', () => updateAvailableItems(modal, 'tool'));
    modal.querySelector('#addToPriorityBtn').addEventListener('click', () => addToPriorityList(modal));
    modal.querySelector('#insertLineBreakBtn').addEventListener('click', () => insertLineBreak(modal));
    modal.querySelector('#clearPriorityBtn').addEventListener('click', () => clearPriorityList(modal));
    modal.querySelector('#moveUpBtn').addEventListener('click', () => moveItemUp(modal));
    modal.querySelector('#moveDownBtn').addEventListener('click', () => moveItemDown(modal));
    modal.querySelector('#removeFromPriorityBtn').addEventListener('click', () => removeFromPriorityList(modal));
    modal.querySelector('#resetMappingsModalBtn').addEventListener('click', resetMappingsToDefault);
    modal.querySelector('#saveMappingConfigBtn').addEventListener('click', saveMappingConfiguration);
    
    // Initialize with line type mode
    updateAvailableItems(modal, 'lineType');
}
// Open dedicated header configuration window
function openHeaderConfigurationWindow() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'headerConfigModal';
    console.log('Creating header configuration modal with ID:', modal.id);
    modal.innerHTML = `
        <div class="modal-content" style="width: 95%; max-width: 1000px; height: 90vh;">
            <div class="modal-header">
                <h3>DIN File Header & Footer Configuration</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; height: calc(90vh - 120px); overflow-y: auto;">
                <!-- Header Settings -->
                <div>
                    <h4 style="color: #4a90e2; margin-bottom: 1rem;">Header Settings</h4>
                    
                    <!-- Machine Type -->
                    <div class="setting-group">
                        <label for="modalMachineType">Machine Type:</label>
                        <select id="modalMachineType" class="form-select">
                            <option value="metric">Metric Machine (native metric)</option>
                            <option value="inch_with_scaling">Inch Machine (with metric scaling)</option>
                            <option value="custom">Custom Header</option>
                        </select>
                    </div>
                    
                    <!-- Scaling Parameters -->
                    <div class="setting-group" id="modalScalingSettings" style="display: none;">
                        <h5>Scaling Parameters</h5>
                        <div style="display: grid; grid-template-columns: 30px 1fr; gap: 0; margin-left: 15px; margin-bottom: 15px;">
                            <div style="display: flex; justify-content: center; padding: 8px 0;">
                                <input type="checkbox" id="modalEnableScaling" checked style="margin: 0;">
                            </div>
                            <div style="display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #444;">
                                <span style="color: white; font-size: 14px;">Include scaling header for inch machine</span>
                            </div>
                        </div>
                        <div class="setting-row">
                            <label for="modalScalingParameter">Scaling Parameter:</label>
                            <input type="text" id="modalScalingParameter" class="form-input" value=":P2027=25.4/P674">
                        </div>
                        <div class="setting-row">
                            <label for="modalScaleCommand">Scale Command:</label>
                            <input type="text" id="modalScaleCommand" class="form-input" value="G75 X=P2027 Y=P2027">
                        </div>
                    </div>
                    
                    <!-- Header Template -->
                    <div class="setting-group">
                        <h5>Header Template</h5>
                        <label for="modalHeaderTemplate">Template Format:</label>
                        <input type="text" id="modalHeaderTemplate" class="form-input" 
                               value="{filename} / - size: {width} x {height} / {timestamp}">
                        <div style="font-size: 0.8rem; color: #888; margin-top: 0.5rem;">
                            Variables: {filename}, {width}, {height}, {timestamp}, {user}, {material}
                        </div>
                    </div>
                    
                    <!-- Header Options -->
                    <div class="setting-group">
                        <h5>Include in Header</h5>
                        <div style="margin-left: 15px;">
                            <!-- Checkbox Column -->
                            <!-- Row 1 -->
                            <div style="display: grid; grid-template-columns: 30px 1fr; gap: 0; align-items: center; padding: 8px 0; border-bottom: 1px solid #444;">
                                <div style="display: flex; justify-content: center;">
                                    <input type="checkbox" id="modalIncludeFileInfo" checked style="margin: 0;">
                                </div>
                                <span style="color: white; font-size: 14px;">File information</span>
                            </div>
                            <!-- Row 2 -->
                            <div style="display: grid; grid-template-columns: 30px 1fr; gap: 0; align-items: center; padding: 8px 0; border-bottom: 1px solid #444;">
                                <div style="display: flex; justify-content: center;">
                                    <input type="checkbox" id="modalIncludeProgramStart" checked style="margin: 0;">
                                </div>
                                <span style="color: white; font-size: 14px;">Program start marker (%1)</span>
                            </div>
                            <!-- Row 3 -->
                            <div style="display: grid; grid-template-columns: 30px 1fr; gap: 0; align-items: center; padding: 8px 0; border-bottom: 1px solid #444;">
                                <div style="display: flex; justify-content: center;">
                                    <input type="checkbox" id="modalIncludeBounds" checked style="margin: 0;">
                                </div>
                                <span style="color: white; font-size: 14px;">Drawing bounds</span>
                            </div>
                            <!-- Row 4 -->
                            <div style="display: grid; grid-template-columns: 30px 1fr; gap: 0; align-items: center; padding: 8px 0;">
                                <div style="display: flex; justify-content: center;">
                                    <input type="checkbox" id="modalIncludeSetCount" checked style="margin: 0;">
                                </div>
                                <span style="color: white; font-size: 14px;">Operation count</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Setup Commands -->
                    <div class="setting-group">
                        <h5>Initial Setup Commands</h5>
                        <textarea id="modalSetupCommands" class="form-textarea" rows="4">G90
G60 X0
G0 X0 Y0</textarea>
                    </div>
                    
                    <!-- Line Numbers Settings -->
                    <div class="setting-group">
                        <h5>Line Numbers Settings</h5>
                        <div style="display: grid; grid-template-columns: 30px 1fr; gap: 0; align-items: center; padding: 8px 0; border-bottom: 1px solid #444; margin-bottom: 15px;">
                            <div style="display: flex; justify-content: center;">
                                <input type="checkbox" id="modalLineNumbersEnabled" checked style="margin: 0;">
                            </div>
                            <span style="color: white; font-size: 14px;">Enable line numbers</span>
                        </div>
                        <div class="setting-row">
                            <label for="modalLineNumbersStart">Start Number:</label>
                            <input type="number" id="modalLineNumbersStart" class="form-input" value="10" min="1" max="9999">
                        </div>
                        <div class="setting-row">
                            <label for="modalLineNumbersIncrement">Increment:</label>
                            <input type="number" id="modalLineNumbersIncrement" class="form-input" value="1" min="1" max="100">
                        </div>
                        <div class="setting-row">
                            <label for="modalLineNumbersFormat">Format Template:</label>
                            <input type="text" id="modalLineNumbersFormat" class="form-input" value="N{number}">
                        </div>
                        <div style="font-size: 0.8rem; color: #888; margin-top: 0.5rem;">
                            Variables: {number} - will be replaced with actual line number
                    </div>
                </div>
                
                    <!-- G-Code Commands -->
                    <div class="setting-group">
                        <h5>G-Code Commands</h5>
                        <div class="setting-row">
                            <label for="modalHomeCommand">Home Command:</label>
                            <input type="text" id="modalHomeCommand" class="form-input" value="G0 X0 Y0">
                        </div>
                        <div class="setting-row">
                            <label for="modalProgramEnd">Program End Command:</label>
                            <textarea id="modalProgramEnd" class="form-textarea" rows="3" placeholder="M30">M30</textarea>
                        </div>
                        <div style="font-size: 0.8rem; color: #888; margin-top: 0.5rem;">
                            Common end commands: M30 (End of Program), M02 (End of Program), M99 (End of Subprogram)
                        </div>
                    </div>
                </div>
                
                <!-- Header & Footer Preview -->
                <div>
                    <h4 style="color: #4a90e2; margin-bottom: 1rem;">Live Preview</h4>
                    
                    <!-- Header Preview -->
                    <div style="margin-bottom: 2rem;">
                        <h5 style="color: #4a90e2; margin-bottom: 0.5rem;">Header Preview:</h5>
                        <div id="modalHeaderPreview" class="header-preview" style="height: 200px; max-height: none;">
                        Loading...
                        </div>
                    </div>
                    
                    <!-- Footer Preview -->
                    <div style="margin-bottom: 1rem;">
                        <h5 style="color: #4a90e2; margin-bottom: 0.5rem;">Footer Preview:</h5>
                        <div id="modalFooterPreview" class="header-preview" style="height: 150px; max-height: none;">
                            Loading...
                        </div>
                    </div>
                    
                    <div style="margin-top: 1rem;">
                        <h5 style="color: #4a90e2;">Header Statistics</h5>
                        <div class="header-stats" id="modalHeaderStats">
                            <div>Total Lines: <span id="modalStatsLines">-</span></div>
                            <div>Comment Lines: <span id="modalStatsComments">-</span></div>
                            <div>Command Lines: <span id="modalStatsCommands">-</span></div>
                            <div>Estimated Size: <span id="modalStatsSize">-</span> bytes</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="closeHeaderConfigBtn">Close</button>
                <button class="btn btn-secondary" id="testPreviewBtn" style="margin-right: 10px;">Test Preview</button>
                <button class="btn btn-primary" id="saveHeaderConfigBtn">Save Configuration</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Verify modal was created
    console.log('Modal created, checking for preview element...');
    
    // Load current header configuration AFTER modal is appended to DOM
    loadModalHeaderConfiguration(modal);
    const testPreview = modal.querySelector('#modalHeaderPreview');
    console.log('Preview element found:', !!testPreview);
    
    // Add event listeners for live preview
    const inputs = ['modalMachineType', 'modalHeaderTemplate', 'modalScalingParameter', 'modalScaleCommand', 'modalSetupCommands', 'modalLineNumbersStart', 'modalLineNumbersIncrement', 'modalLineNumbersFormat', 'modalHomeCommand', 'modalProgramEnd'];
    inputs.forEach(id => {
        const element = modal.querySelector(`#${id}`);
        if (element) {
            console.log(`Adding event listener to ${id}`);
            element.addEventListener('input', updateModalHeaderPreview);
            element.addEventListener('change', updateModalHeaderPreview);
        } else {
            console.log(`Element ${id} not found in modal`);
        }
    });
    
    const checkboxes = ['modalEnableScaling', 'modalIncludeFileInfo', 'modalIncludeBounds', 'modalIncludeSetCount', 'modalIncludeProgramStart', 'modalLineNumbersEnabled'];
    checkboxes.forEach(id => {
        const element = modal.querySelector(`#${id}`);
        if (element) {
            console.log(`Adding checkbox event listener to ${id}`);
            element.addEventListener('change', updateModalHeaderPreview);
        } else {
            console.log(`Checkbox ${id} not found in modal`);
        }
    });
    
    // Machine type change handler
    modal.querySelector('#modalMachineType').addEventListener('change', function() {
        const scalingSettings = modal.querySelector('#modalScalingSettings');
        scalingSettings.style.display = this.value === 'inch_with_scaling' ? 'block' : 'none';
        updateModalHeaderPreview();
    });
    
    modal.querySelector('#saveHeaderConfigBtn').addEventListener('click', saveHeaderConfiguration);
    
    // Add event listeners for footer buttons
    modal.querySelector('#closeHeaderConfigBtn').addEventListener('click', () => {
        modal.remove();
    });
    modal.querySelector('#testPreviewBtn').addEventListener('click', updateModalHeaderPreview);
    
    // Initial preview update - delay to ensure DOM is ready
    setTimeout(() => {
        console.log('Initial preview update triggered');
        // Force a DOM update before calling preview
        modal.offsetHeight; // Force reflow
    updateModalHeaderPreview();
    }, 200);
}

// Helper functions for the new modal windows
async function loadModalToolLibrary(modal) {
    // Load current tool configuration into modal
    const preview = modal ? modal.querySelector('#modalToolPreview') : document.getElementById('modalToolPreview');
    if (!preview) return;
    
    const toolGrid = preview.querySelector('.tool-grid');
    if (!toolGrid) return;
    
    // Get current tools dynamically from configuration
    const currentTools = await getCurrentToolSet();
    
    toolGrid.innerHTML = '';
    
    Object.entries(currentTools).forEach(([toolId, tool]) => {
        const toolCard = document.createElement('div');
        toolCard.className = 'tool-card';
        toolCard.innerHTML = `
            <div class="tool-header">
                <span class="tool-id">${toolId}</span>
                <span class="tool-name">${tool.name}</span>
            </div>
            <div class="tool-details">
                <div class="tool-width">Width: ${tool.width}mm</div>
                <div class="tool-desc">${tool.description}</div>
            </div>
        `;
        toolGrid.appendChild(toolCard);
    });
    
    // Load current settings into inputs
    if (currentPostprocessorConfig?.toolSettings && modal) {
        const settings = currentPostprocessorConfig.toolSettings;
        
        if (settings.speeds) {
            modal.querySelector('#engravingSpeed').value = settings.speeds.engraving || 1200;
            modal.querySelector('#cuttingSpeed').value = settings.speeds.cutting || 800;
            modal.querySelector('#perforationSpeed').value = settings.speeds.perforation || 600;
        }
        
        if (settings.toolChange) {
            modal.querySelector('#toolChangeTime').value = settings.toolChange.time || 5;
            modal.querySelector('#toolChangeCommand').value = settings.toolChange.command || 'M6';
        }
        
        if (settings.validation) {
            modal.querySelector('#validateToolWidths').checked = settings.validation.validateWidths !== false;
            modal.querySelector('#warnOnMissingTools').checked = settings.validation.warnOnMissingTools !== false;
        }
        
        // Load and apply enable/disable states for parameter groups
        const enabledSections = settings.enabledSections || {
            cuttingSpeeds: false,
            toolChange: false,
            safetySettings: true  // Safety settings enabled by default
        };
        
        // Apply cutting speeds enable state
        const enableCuttingSpeeds = modal.querySelector('#enableCuttingSpeeds');
        const cuttingSpeedsContent = modal.querySelector('#cuttingSpeedsContent');
        if (enableCuttingSpeeds && cuttingSpeedsContent) {
            enableCuttingSpeeds.checked = enabledSections.cuttingSpeeds;
            if (enabledSections.cuttingSpeeds) {
                cuttingSpeedsContent.style.opacity = '1';
                cuttingSpeedsContent.style.pointerEvents = 'auto';
                cuttingSpeedsContent.querySelectorAll('input').forEach(input => input.disabled = false);
            } else {
                cuttingSpeedsContent.style.opacity = '0.5';
                cuttingSpeedsContent.style.pointerEvents = 'none';
                cuttingSpeedsContent.querySelectorAll('input').forEach(input => input.disabled = true);
            }
        }
        
        // Apply tool change enable state
        const enableToolChange = modal.querySelector('#enableToolChange');
        const toolChangeContent = modal.querySelector('#toolChangeContent');
        if (enableToolChange && toolChangeContent) {
            enableToolChange.checked = enabledSections.toolChange;
            if (enabledSections.toolChange) {
                toolChangeContent.style.opacity = '1';
                toolChangeContent.style.pointerEvents = 'auto';
                toolChangeContent.querySelectorAll('input').forEach(input => input.disabled = false);
            } else {
                toolChangeContent.style.opacity = '0.5';
                toolChangeContent.style.pointerEvents = 'none';
                toolChangeContent.querySelectorAll('input').forEach(input => input.disabled = true);
            }
        }
        
        // Apply safety settings enable state
        const enableSafetySettings = modal.querySelector('#enableSafetySettings');
        const safetySettingsContent = modal.querySelector('#safetySettingsContent');
        if (enableSafetySettings && safetySettingsContent) {
            enableSafetySettings.checked = enabledSections.safetySettings;
            if (enabledSections.safetySettings) {
                safetySettingsContent.style.opacity = '1';
                safetySettingsContent.style.pointerEvents = 'auto';
                safetySettingsContent.querySelectorAll('input').forEach(input => input.disabled = false);
            } else {
                safetySettingsContent.style.opacity = '0.5';
                safetySettingsContent.style.pointerEvents = 'none';
                safetySettingsContent.querySelectorAll('input').forEach(input => input.disabled = true);
            }
        }
    }
}
async function loadModalMappingConfiguration() {
    try {
        // Load actual line types from the system
        const lineTypesResponse = await window.electronAPI.loadLineTypes();
        const actualLineTypes = lineTypesResponse?.success ? lineTypesResponse.data : [];
        
        // Get available tools from current configuration
        const availableTools = getCurrentToolSet();
        const toolIds = Object.keys(availableTools);
        
        // Load current mappings into the overview section
        const overviewEl = document.getElementById('mappingOverview');
        if (overviewEl) {
            const mappingGrid = overviewEl.querySelector('.mapping-grid');
            if (mappingGrid) {
                mappingGrid.innerHTML = '';
                
                // Get current line type to tool mappings
                const currentMappings = currentPostprocessorConfig?.lineTypeMappings?.customMappings || {};
                
                // Create editable mappings for actual line types to tools
                actualLineTypes.forEach(lineType => {
                    const lineTypeName = lineType.name || lineType.id || lineType;
                    const lineTypeDesc = lineType.description || 'No description';
                    const currentTool = currentMappings[lineTypeName] || 'none';
                    
                    const mappingCard = document.createElement('div');
                    mappingCard.className = 'mapping-card';
                    mappingCard.style.cssText = 'padding: 1.5rem; background: #333; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #555;';
                    
                    // Create dropdown with available tools showing number and name
                    const toolOptions = ['none', ...toolIds].map(toolId => {
                        if (toolId === 'none') {
                            return `<option value="none" ${currentTool === 'none' ? 'selected' : ''}>None (Skip)</option>`;
                        }
                        const toolInfo = availableTools[toolId];
                        const displayName = toolInfo ? `${toolId} - ${toolInfo.name}` : toolId;
                        return `<option value="${toolId}" ${currentTool === toolId ? 'selected' : ''}>${displayName}</option>`;
                    }).join('');
                    
                    // Calculate priority (will be updated later)
                    const priority = 999; // Default priority
                    
                    mappingCard.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div>
                                <h5 style="color: #4a90e2; margin: 0 0 0.5rem 0; font-size: 1.1rem;">${lineTypeName.toUpperCase()}</h5>
                                <p style="color: #ccc; margin: 0; font-size: 0.9rem;">${lineTypeDesc}</p>
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-danger btn-small remove-line-type-btn" data-line-type="${lineTypeName}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Remove</button>
                                <span style="background: #444; color: #ffd700; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">Priority: ${priority}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <span style="color: #888; font-weight: bold;">Tool:</span>
                            <select class="tool-select" data-line-type="${lineTypeName}" style="background: #1a1a1a; border: 1px solid #555; color: #fff; padding: 0.5rem; border-radius: 4px; flex: 1;">
                                ${toolOptions}
                            </select>
                        </div>
                    `;
                    
                    // Add event listener for tool changes
                    const select = mappingCard.querySelector('.tool-select');
                    select.addEventListener('change', (e) => {
                        updateLineTypeToolMapping(e.target.dataset.lineType, e.target.value);
                    });
                    
                    // Add event listener for remove button
                    const removeBtn = mappingCard.querySelector('.remove-line-type-btn');
                    removeBtn.addEventListener('click', (e) => {
                        removeLineTypeMapping(e.target.dataset.lineType, mappingCard);
                    });
                    
                    mappingGrid.appendChild(mappingCard);
                });
                
                // Add "Add Line Type" button
                const addButton = document.createElement('div');
                addButton.style.cssText = 'display: flex; justify-content: center; margin-top: 1rem;';
                addButton.innerHTML = `
                    <button class="btn btn-primary" id="addLineTypeMappingBtn" style="padding: 1rem 2rem;">
                        <span style="font-size: 1.2rem;">+</span> Add Line Type Mapping
                    </button>
                `;
                mappingGrid.appendChild(addButton);
                
                // Add event listener for add button
                const addBtn = addButton.querySelector('#addLineTypeMappingBtn');
                addBtn.addEventListener('click', () => {
                    showAddLineTypeMappingModal(actualLineTypes, availableTools, mappingGrid);
                });
                
                // If no actual line types, show placeholder
                if (actualLineTypes.length === 0) {
                    mappingGrid.innerHTML = '<div class="mapping-placeholder">No line types defined. Use Line Types Manager to create line types first.</div>';
                }
            }
        }
        
        // Load priority settings
        loadPrioritySettings(actualLineTypes, toolIds);
    } catch (error) {
        console.error('Error loading mapping configuration:', error);
    }
}

async function loadPrioritySettings(actualLineTypes, toolIds) {
    // Get current priority settings from configuration
    const prioritySettings = currentPostprocessorConfig?.optimization?.priority || {
        mode: 'lineType',
        lineTypeOrder: [],
        toolOrder: []
    };
    
    // Load both priority lists into memory FIRST
    currentPriorityLists.lineType = (prioritySettings.lineTypeOrder || []).map(item => {
        if (item === '__LINE_BREAK__') {
            return { value: '__LINE_BREAK__', text: '--- LINE BREAK ---' };
        }
        return { value: item, text: item };
    });
    
    currentPriorityLists.tool = (prioritySettings.toolOrder || []).map(item => {
        if (item === '__LINE_BREAK__') {
            return { value: '__LINE_BREAK__', text: '--- LINE BREAK ---' };
        }
        // Find tool info for better display
        const availableTools = getCurrentToolSet();
        const toolInfo = availableTools[item];
        const displayText = toolInfo ? `${item} - ${toolInfo.name}` : item;
        return { value: item, text: displayText };
    });

    // Set the radio button for priority mode and update UI
    const modal = document.querySelector('.modal');
    if (modal) {
        const lineTypeRadio = modal.querySelector('#priorityModeLineType');
        const toolRadio = modal.querySelector('#priorityModeTool');
        
        if (lineTypeRadio && toolRadio) {
            if (prioritySettings.mode === 'tool') {
                toolRadio.checked = true;
                await updateAvailableItems(modal, 'tool');
            } else {
                lineTypeRadio.checked = true;
                await updateAvailableItems(modal, 'lineType');
            }
        } else {
            console.error('Priority mode radio buttons not found');
        }
    }
}
function loadModalHeaderConfiguration(modal = null) {
    // Load current header settings into modal
    if (!currentPostprocessorConfig) {
        console.warn('No postprocessor config available for header configuration');
        // Still update preview with default values
        requestAnimationFrame(() => {
            updateModalHeaderPreview();
        });
        return;
    }
    
    const config = currentPostprocessorConfig;
    // Use passed modal or find the first modal
    if (!modal) {
        modal = document.querySelector('.modal');
    }
    if (!modal) return;
    
    try {
        // Machine type
        const machineTypeEl = modal.querySelector('#modalMachineType');
        if (machineTypeEl) {
            if (config.machineSettings?.feedInchMachine && config.machineSettings?.scalingHeader?.enabled) {
                machineTypeEl.value = 'inch_with_scaling';
            } else {
                machineTypeEl.value = 'metric';
            }
        }
        
        // Header template
        const headerTemplateEl = modal.querySelector('#modalHeaderTemplate');
        if (headerTemplateEl) {
            if (config.header?.template) {
                headerTemplateEl.value = config.header.template;
            }
            // Ensure it has a default value if none in config
            if (!headerTemplateEl.value) {
                headerTemplateEl.value = '{filename} / - size: {width} x {height} / {timestamp}';
            }
        }
        
        // Include checkboxes
        const includeFileInfoEl = modal.querySelector('#modalIncludeFileInfo');
        if (includeFileInfoEl && config.header?.includeFileInfo !== undefined) {
            includeFileInfoEl.checked = config.header.includeFileInfo;
        }
        
        const includeBoundsEl = modal.querySelector('#modalIncludeBounds');
        if (includeBoundsEl && config.header?.includeBounds !== undefined) {
            includeBoundsEl.checked = config.header.includeBounds;
        }
        
        const includeSetCountEl = modal.querySelector('#modalIncludeSetCount');
        if (includeSetCountEl && config.header?.includeSetCount !== undefined) {
            includeSetCountEl.checked = config.header.includeSetCount;
        }
        
        const includeProgramStartEl = modal.querySelector('#modalIncludeProgramStart');
        if (includeProgramStartEl && config.header?.includeProgramStart !== undefined) {
            includeProgramStartEl.checked = config.header.includeProgramStart;
        }
        
        // Scaling settings
        const enableScalingEl = modal.querySelector('#modalEnableScaling');
        if (enableScalingEl && config.machineSettings?.scalingHeader?.enabled !== undefined) {
            enableScalingEl.checked = config.machineSettings.scalingHeader.enabled;
        }
        
        const scalingParameterEl = modal.querySelector('#modalScalingParameter');
        if (scalingParameterEl && config.machineSettings?.scalingHeader?.parameter) {
            scalingParameterEl.value = config.machineSettings.scalingHeader.parameter;
        }
        
        const scaleCommandEl = modal.querySelector('#modalScaleCommand');
        if (scaleCommandEl && config.machineSettings?.scalingHeader?.scaleCommand) {
            scaleCommandEl.value = config.machineSettings.scalingHeader.scaleCommand;
        }
        // Setup commands
        const setupCommandsEl = modal.querySelector('#modalSetupCommands');
        if (setupCommandsEl && config.header?.setupCommands) {
            setupCommandsEl.value = config.header.setupCommands.join('\n');
        }
        
        // Line Numbers Settings
        const lineNumbersEnabledEl = modal.querySelector('#modalLineNumbersEnabled');
        if (lineNumbersEnabledEl && config.lineNumbers?.enabled !== undefined) {
            lineNumbersEnabledEl.checked = config.lineNumbers.enabled;
        }
        
        const lineNumbersStartEl = modal.querySelector('#modalLineNumbersStart');
        if (lineNumbersStartEl && config.lineNumbers?.startNumber !== undefined) {
            lineNumbersStartEl.value = config.lineNumbers.startNumber;
        }
        
        const lineNumbersIncrementEl = modal.querySelector('#modalLineNumbersIncrement');
        if (lineNumbersIncrementEl && config.lineNumbers?.increment !== undefined) {
            lineNumbersIncrementEl.value = config.lineNumbers.increment;
        }
        
        const lineNumbersFormatEl = modal.querySelector('#modalLineNumbersFormat');
        if (lineNumbersFormatEl && config.lineNumbers?.format !== undefined) {
            lineNumbersFormatEl.value = config.lineNumbers.format;
        }
        
        // G-Code Commands
        const homeCommandEl = modal.querySelector('#modalHomeCommand');
        if (homeCommandEl && config.gcode?.homeCommand !== undefined) {
            homeCommandEl.value = config.gcode.homeCommand;
        }
        
        const programEndEl = modal.querySelector('#modalProgramEnd');
        console.log('Loading programEnd:', {
            element: !!programEndEl,
            config: config.gcode?.programEnd,
            type: typeof config.gcode?.programEnd,
            isArray: Array.isArray(config.gcode?.programEnd)
        });
        if (programEndEl && config.gcode?.programEnd !== undefined) {
            // Handle both string and array formats
            if (Array.isArray(config.gcode.programEnd)) {
                programEndEl.value = config.gcode.programEnd.join('\n');
            } else {
                programEndEl.value = config.gcode.programEnd;
            }
            console.log('Set programEnd value to:', programEndEl.value);
        }
        
        // Update preview after loading settings
        // Use requestAnimationFrame to ensure DOM is fully updated
        requestAnimationFrame(() => {
            updateModalHeaderPreview();
        });
        
    } catch (error) {
        console.error('Error loading modal header configuration:', error);
    }
}

function saveToolConfiguration() {
    try {
        if (!currentPostprocessorConfig) {
            showStatus('No postprocessor profile selected', 'error');
            return;
        }
        
        // Get values from modal
        const modal = document.querySelector('.modal');
        const engravingSpeed = modal.querySelector('#engravingSpeed').value;
        const cuttingSpeed = modal.querySelector('#cuttingSpeed').value;
        const perforationSpeed = modal.querySelector('#perforationSpeed').value;
        const toolChangeTime = modal.querySelector('#toolChangeTime').value;
        const toolChangeCommand = modal.querySelector('#toolChangeCommand').value;
        const validateWidths = modal.querySelector('#validateToolWidths').checked;
        const warnOnMissing = modal.querySelector('#warnOnMissingTools').checked;
        
        // Get enable/disable states for parameter groups
        const enableCuttingSpeeds = modal.querySelector('#enableCuttingSpeeds').checked;
        const enableToolChange = modal.querySelector('#enableToolChange').checked;
        const enableSafetySettings = modal.querySelector('#enableSafetySettings').checked;
        
        // Update current configuration
        if (!currentPostprocessorConfig.toolSettings) {
            currentPostprocessorConfig.toolSettings = {};
        }
        
        currentPostprocessorConfig.toolSettings = {
            speeds: {
                engraving: parseInt(engravingSpeed),
                cutting: parseInt(cuttingSpeed),
                perforation: parseInt(perforationSpeed)
            },
            toolChange: {
                time: parseFloat(toolChangeTime),
                command: toolChangeCommand
            },
            validation: {
                validateWidths: validateWidths,
                warnOnMissingTools: warnOnMissing
            },
            enabledSections: {
                cuttingSpeeds: enableCuttingSpeeds,
                toolChange: enableToolChange,
                safetySettings: enableSafetySettings
            }
        };
        
        showStatus('Tool configuration saved', 'success');
        modal.remove();
        
    } catch (error) {
        console.error('Error saving tool configuration:', error);
        showStatus('Failed to save tool configuration', 'error');
    }
}
async function saveMappingConfiguration() {
    try {
        if (!currentPostprocessorConfig) {
            showStatus('No postprocessor profile selected', 'error');
            return;
        }
        
        const modal = document.querySelector('.modal');
        
        // Save current priority list to memory before saving
        savePriorityListToMemory(modal);
        
        // Get priority settings
        const priorityModeElement = modal.querySelector('input[name="priorityMode"]:checked');
        const priorityMode = priorityModeElement ? priorityModeElement.value : 'lineType';
        const lineTypeOrder = currentPriorityLists.lineType.map(item => item.value);
        const toolOrder = currentPriorityLists.tool.map(item => item.value);
        
        
        // Update current configuration
        if (!currentPostprocessorConfig.optimization) {
            currentPostprocessorConfig.optimization = {};
        }
        
        currentPostprocessorConfig.optimization.priority = {
            mode: priorityMode,
            lineTypeOrder: lineTypeOrder,
            toolOrder: toolOrder
        };
        
        // Save to XML profile
        const currentProfile = getCurrentProfileFilename();
        if (currentProfile) {
            await saveXmlProfileConfiguration(currentProfile);
        }
        
        showStatus('Mapping configuration saved', 'success');
        modal.remove();
        
        // Refresh the mapping overview in the main UI
        displayMappingPreview(currentPostprocessorConfig.lineTypeMappings || {});
        
    } catch (error) {
        console.error('Error saving mapping configuration:', error);
        showStatus('Failed to save mapping configuration', 'error');
    }
}

// Reset mappings to default values
function resetMappingsToDefault() {
    if (!confirm('Reset all line type mappings to default values?\n\nThis will overwrite any custom mappings.')) {
        return;
    }
    
    if (!currentPostprocessorConfig) {
        showStatus('No postprocessor profile selected', 'error');
        return;
    }
    
    // Reset to default mappings
    if (!currentPostprocessorConfig.lineTypeMappings) {
        currentPostprocessorConfig.lineTypeMappings = {};
    }
    
    currentPostprocessorConfig.lineTypeMappings.customMappings = {
        "cutting": "T2",
        "engraving": "T1", 
        "perforating": "T3",
        "scoring": "T1",
        "marking": "T1",
        "construction": "none"
    };
    
    // Refresh the modal display
    const modal = document.querySelector('.modal');
    if (modal) {
        requestAnimationFrame(async () => {
            await loadModalMappingConfiguration();
        });
    }
    
    showStatus('Line type mappings reset to default', 'success');
}
async function saveHeaderConfiguration() {
    try {
        // Initialize currentPostprocessorConfig if it doesn't exist
        if (!currentPostprocessorConfig) {
            currentPostprocessorConfig = getDefaultConfiguration();
        }
        
        const modal = document.getElementById('headerConfigModal');
        if (!modal) {
            showStatus('Header configuration modal not found', 'error');
            return;
        }
        
        // Get values from modal with null checks
        const machineTypeEl = modal.querySelector('#modalMachineType');
        const enableScalingEl = modal.querySelector('#modalEnableScaling');
        const scalingParameterEl = modal.querySelector('#modalScalingParameter');
        const scaleCommandEl = modal.querySelector('#modalScaleCommand');
        const headerTemplateEl = modal.querySelector('#modalHeaderTemplate');
        const includeFileInfoEl = modal.querySelector('#modalIncludeFileInfo');
        const includeBoundsEl = modal.querySelector('#modalIncludeBounds');
        const includeSetCountEl = modal.querySelector('#modalIncludeSetCount');
        const includeProgramStartEl = modal.querySelector('#modalIncludeProgramStart');
        const setupCommandsEl = modal.querySelector('#modalSetupCommands');
        
        // New form elements for line numbers and G-code
        const lineNumbersEnabledEl = modal.querySelector('#modalLineNumbersEnabled');
        const lineNumbersStartEl = modal.querySelector('#modalLineNumbersStart');
        const lineNumbersIncrementEl = modal.querySelector('#modalLineNumbersIncrement');
        const lineNumbersFormatEl = modal.querySelector('#modalLineNumbersFormat');
        const homeCommandEl = modal.querySelector('#modalHomeCommand');
        const programEndEl = modal.querySelector('#modalProgramEnd');
        
        // Debug: Log what elements we found
        console.log('Found elements:', {
            machineTypeEl: !!machineTypeEl,
            headerTemplateEl: !!headerTemplateEl,
            setupCommandsEl: !!setupCommandsEl,
            includeFileInfoEl: !!includeFileInfoEl,
            includeBoundsEl: !!includeBoundsEl,
            includeSetCountEl: !!includeSetCountEl,
            includeProgramStartEl: !!includeProgramStartEl,
            lineNumbersEnabledEl: !!lineNumbersEnabledEl,
            lineNumbersStartEl: !!lineNumbersStartEl,
            lineNumbersIncrementEl: !!lineNumbersIncrementEl,
            lineNumbersFormatEl: !!lineNumbersFormatEl,
            homeCommandEl: !!homeCommandEl,
            programEndEl: !!programEndEl
        });
        
        if (!machineTypeEl || !headerTemplateEl || !setupCommandsEl) {
            showStatus('Missing form elements', 'error');
            return;
        }
        
        const machineType = machineTypeEl.value;
        const enableScaling = enableScalingEl ? enableScalingEl.checked : false;
        const scalingParameter = scalingParameterEl ? scalingParameterEl.value : '';
        const scaleCommand = scaleCommandEl ? scaleCommandEl.value : '';
        const headerTemplate = headerTemplateEl.value;
        const includeFileInfo = includeFileInfoEl ? includeFileInfoEl.checked : false;
        const includeBounds = includeBoundsEl ? includeBoundsEl.checked : false;
        const includeSetCount = includeSetCountEl ? includeSetCountEl.checked : false;
        const includeProgramStart = includeProgramStartEl ? includeProgramStartEl.checked : false;
        const setupCommands = setupCommandsEl.value.split('\n').filter(cmd => cmd.trim());
        
        // Extract new form values
        const lineNumbersEnabled = lineNumbersEnabledEl ? lineNumbersEnabledEl.checked : true;
        const lineNumbersStart = lineNumbersStartEl ? parseInt(lineNumbersStartEl.value) : 10;
        const lineNumbersIncrement = lineNumbersIncrementEl ? parseInt(lineNumbersIncrementEl.value) : 1;
        const lineNumbersFormat = lineNumbersFormatEl ? lineNumbersFormatEl.value : 'N{number}';
        const homeCommand = homeCommandEl ? homeCommandEl.value : 'G0 X0 Y0';
        const programEnd = programEndEl ? programEndEl.value.split('\n').filter(cmd => cmd.trim()) : ['M30'];
        
        // Update current configuration
        if (!currentPostprocessorConfig.header) {
            currentPostprocessorConfig.header = {};
        }
        
        if (!currentPostprocessorConfig.units) {
            currentPostprocessorConfig.units = {};
        }
        
        if (!currentPostprocessorConfig.lineNumbers) {
            currentPostprocessorConfig.lineNumbers = {};
        }
        
        if (!currentPostprocessorConfig.gcode) {
            currentPostprocessorConfig.gcode = {};
        }
        
        // Set machine type and scaling
        currentPostprocessorConfig.units.feedInchMachine = (machineType === 'inch_with_scaling');
        
        if (machineType === 'inch_with_scaling') {
            currentPostprocessorConfig.units.scalingHeader = {
                enabled: enableScaling,
                parameter: scalingParameter,
                scaleCommand: scaleCommand,
                comment: 'Metric scaling for inch machine'
            };
        }
        
        // Set header options
        currentPostprocessorConfig.header = {
            ...currentPostprocessorConfig.header,
            template: headerTemplate,
            includeFileInfo: includeFileInfo,
            includeBounds: includeBounds,
            includeSetCount: includeSetCount,
            includeProgramStart: includeProgramStart,
            programStart: '%1',
            setupCommands: setupCommands
        };
        // Set line numbers options
        currentPostprocessorConfig.lineNumbers = {
            enabled: lineNumbersEnabled,
            startNumber: lineNumbersStart,
            increment: lineNumbersIncrement,
            format: lineNumbersFormat
        };
        
        // Set G-code options
        currentPostprocessorConfig.gcode = {
            ...currentPostprocessorConfig.gcode,
            homeCommand: homeCommand,
            programEnd: programEnd
        };
        
        // Debug: Log the configuration being saved
        console.log('Saving header configuration:', {
            currentProfile: getCurrentProfileFilename(),
            headerConfig: currentPostprocessorConfig.header,
            unitsConfig: currentPostprocessorConfig.units,
            lineNumbers: currentPostprocessorConfig.lineNumbers,
            gcode: currentPostprocessorConfig.gcode
        });
        
        // Save to XML profile
        const currentProfile = getCurrentProfileFilename();
        console.log('Current profile filename:', currentProfile);
        if (currentProfile) {
            console.log('Calling saveXmlProfileConfiguration...');
            await saveXmlProfileConfiguration(currentProfile);
            console.log('saveXmlProfileConfiguration completed');
        } else {
            console.log('No current profile filename found');
        }
        showStatus('Header configuration saved', 'success');
        modal.remove();
        
        // Update header preview in main UI
        updateHeaderPreview();
        
    } catch (error) {
        console.error('Error saving header configuration:', error);
        showStatus('Failed to save header configuration', 'error');
    }
}

function updateModalHeaderPreview() {
    // Update the live preview in the header modal
    // Look specifically for the header configuration modal
    let modal = document.getElementById('headerConfigModal');
    let previewEl = null;
    
    if (modal) {
        previewEl = modal.querySelector('#modalHeaderPreview');
    }
    
    // Fallback: look for any modal with header preview
    if (!modal || !previewEl) {
        const modals = document.querySelectorAll('.modal');
        for (const m of modals) {
            const preview = m.querySelector('#modalHeaderPreview');
            if (preview) {
                modal = m;
                previewEl = preview;
                break;
            }
        }
    }
    
    if (!modal || !previewEl) {
        console.log('No modal with header preview found');
        return;
    }
    
    const statsEl = modal.querySelector('#modalHeaderStats');
    
    console.log('Found modal and preview element, updating preview...');
    
    console.log('Updating modal header preview...');
    
    try {
        // Get current values from modal with null checks
        const machineTypeEl = modal.querySelector('#modalMachineType');
        const enableScalingEl = modal.querySelector('#modalEnableScaling');
        const scalingParameterEl = modal.querySelector('#modalScalingParameter');
        const scaleCommandEl = modal.querySelector('#modalScaleCommand');
        const headerTemplateEl = modal.querySelector('#modalHeaderTemplate');
        const includeFileInfoEl = modal.querySelector('#modalIncludeFileInfo');
        const includeBoundsEl = modal.querySelector('#modalIncludeBounds');
        const includeSetCountEl = modal.querySelector('#modalIncludeSetCount');
        const includeProgramStartEl = modal.querySelector('#modalIncludeProgramStart');
        const setupCommandsEl = modal.querySelector('#modalSetupCommands');
        
        // Get footer-related values
        const homeCommandEl = modal.querySelector('#modalHomeCommand');
        const programEndEl = modal.querySelector('#modalProgramEnd');
        
        // Check if all elements exist
        if (!machineTypeEl || !headerTemplateEl || !setupCommandsEl) {
            console.error('Missing modal elements for header preview');
            previewEl.innerHTML = '<span style="color: #ff6b6b;">Error: Missing form elements</span>';
            return;
        }
        
        // Get values with defaults for missing elements
        const machineType = machineTypeEl.value || 'metric';
        const enableScaling = enableScalingEl ? enableScalingEl.checked : false;
        const scalingParameter = scalingParameterEl ? scalingParameterEl.value : ':P2027=25.4/P674';
        const scaleCommand = scaleCommandEl ? scaleCommandEl.value : 'G75 X=P2027 Y=P2027';
        const headerTemplate = headerTemplateEl.value || '{filename} / - size: {width} x {height} / {timestamp}';
        const includeFileInfo = includeFileInfoEl ? includeFileInfoEl.checked : true;
        const includeBounds = includeBoundsEl ? includeBoundsEl.checked : true;
        const includeSetCount = includeSetCountEl ? includeSetCountEl.checked : true;
        const includeProgramStart = includeProgramStartEl ? includeProgramStartEl.checked : true;
        const setupCommands = setupCommandsEl.value || 'G90\nG60 X0\nG0 X0 Y0';
        
        // Get footer values
        const homeCommand = homeCommandEl ? homeCommandEl.value : 'G0 X0 Y0';
        const programEnd = programEndEl ? programEndEl.value.split('\n').filter(cmd => cmd.trim()) : ['M30'];
        
        // Create a mock configuration object for the DIN generator
        const mockConfig = {
            header: {
                includeFileInfo: includeFileInfo,
                includeBounds: includeBounds,
                includeSetCount: includeSetCount,
                includeProgramStart: includeProgramStart,
                template: headerTemplate,
                setupCommands: setupCommands.split('\n').filter(cmd => cmd.trim())
            },
            units: {
                feedInchMachine: machineType === 'inch_with_scaling',
                scalingHeader: {
                    enabled: enableScaling,
                    parameter: scalingParameter,
                    scaleCommand: scaleCommand,
                    comment: 'Bei Bedarf nach inch skalieren'
                }
            },
            gcode: {
                homeCommand: homeCommand,
                programEnd: programEnd
            },
            lineNumbers: {
                startNumber: 1
            }
        };

        // Create mock metadata
        const mockMetadata = {
            filename: 'sample.dxf',
            width: 100.0,
            height: 75.0,
            entityCount: 25,
            bounds: {
                minX: 0.0,
                minY: 0.0,
                maxX: 100.0,
                maxY: 75.0
            }
        };

        // Import and use the actual DIN generator
        import('../../src/DinGenerator.js').then(({ DinGenerator }) => {
            const dinGenerator = new DinGenerator();
            
            // Set the configuration
            dinGenerator.config = mockConfig;
            
            // Generate header and footer using the actual DIN generator
            const headerLines = dinGenerator.generateHeader(mockMetadata);
            const setupLines = dinGenerator.generateSetupCommands();
            const footerLines = dinGenerator.generateFooter();
            
            // Combine header and setup commands for header preview
            const allLines = [...headerLines, ...setupLines];
            
            // Count statistics
            let commentLines = 0;
            let commandLines = 0;
            
            allLines.forEach(line => {
                if (line.startsWith('{') || line.startsWith('G253')) {
            commentLines++;
                } else {
                    commandLines++;
                }
            });
            
            // Update header preview
            previewEl.innerHTML = allLines.join('\n');
            
            // Update footer preview
            const footerPreviewEl = modal.querySelector('#modalFooterPreview');
            if (footerPreviewEl) {
                footerPreviewEl.innerHTML = footerLines.join('\n');
            }
        // Update statistics
        if (statsEl) {
                statsEl.innerHTML = `
                    <div>Total Lines: <span id="modalStatsLines">${allLines.length}</span></div>
                    <div>Comment Lines: <span id="modalStatsComments">${commentLines}</span></div>
                    <div>Command Lines: <span id="modalStatsCommands">${commandLines}</span></div>
                    <div>Estimated Size: <span id="modalStatsSize">${allLines.join('\n').length}</span> bytes</div>
                `;
            }
        }).catch(error => {
            console.error('Error loading DIN generator:', error);
            previewEl.innerHTML = '<span style="color: #ff6b6b;">Error: Could not load DIN generator</span>';
        });
        
        return; // Exit early since we're using async import
    } catch (error) {
        console.error('Error updating modal header preview:', error);
        if (previewEl) {
        previewEl.innerHTML = '<span style="color: #ff6b6b;">Error generating preview</span>';
        }
    }
}

// Initialize all postprocessor functionality
function initializePostprocessorUI() {
    initializeHeaderConfiguration();
    initializePostprocessorManagement();
    initializeToolManagement();
    initializeDinGeneration();
    initializeLineTypeMappings();
    initializeConfigurationShortcuts();
}
// Conflict Detection and Resolution Functions
async function detectMappingConflicts(newLayers) {
    try {
        console.log('Detecting mapping conflicts for new layers:', newLayers);
        
        // Get combined mappings (global + file-specific) for the current file
        const currentFilename = window.currentFilename || 'unknown.dxf';
        const currentFilePath = window.currentFilePath;
        
        const combinedMappings = await window.electronAPI.getCombinedMappingsForFile('mtl.xml', currentFilename, currentFilePath);
        
        if (!combinedMappings.combinedMappings || Object.keys(combinedMappings.combinedMappings).length === 0) {
            console.log('No existing mappings found, no conflicts detected');
            return [];
        }
        
        const conflicts = [];
        
        // Check each new layer against combined mappings
        newLayers.forEach(layer => {
            const layerName = layer.name;
            const existingMapping = combinedMappings.combinedMappings[layerName];
            
            if (existingMapping) {
                // Determine if this is a global or file-specific mapping
                const isFileSpecific = combinedMappings.fileSpecificMappings && 
                                     combinedMappings.fileSpecificMappings.mappings[layerName];
                
                conflicts.push({
                    layerName: layerName,
                    layerDisplayName: layer.displayName,
                    layerColor: layer.colorHex,
                    existingMapping: existingMapping,
                    conflictType: isFileSpecific ? 'file_specific_mapping' : 'global_mapping',
                    description: `Layer "${layerName}" already has a ${isFileSpecific ? 'file-specific' : 'global'} mapping to "${existingMapping}"`,
                    isFileSpecific: isFileSpecific
                });
            }
        });
        
        console.log('Detected conflicts:', conflicts);
        return conflicts;
        
    } catch (error) {
        console.error('Error detecting mapping conflicts:', error);
        return [];
    }
}

async function showConflictResolutionModal(conflicts, newLayers) {
    return new Promise((resolve) => {
        // Create modal HTML with modern design
        const modalHTML = `
            <div id="conflictModal" class="modal" style="display: flex;">
                <div class="modal-content conflict-modal" style="max-width: 900px; max-height: 85vh;">
                    <div class="modal-header conflict-header">
                        <div class="header-content">
                            <div class="header-icon">⚠️</div>
                            <div class="header-text">
                                <h3>Mapping Conflicts Detected</h3>
                                <p>${conflicts.length} layer${conflicts.length > 1 ? 's' : ''} have existing mappings</p>
                            </div>
                        </div>
                        <button class="modal-close" onclick="closeConflictModal()">&times;</button>
                    </div>
                    
                    <div class="modal-body conflict-body">
                        <div class="conflict-intro">
                            <p>Choose how to handle each conflicting layer:</p>
                        </div>
                        
                        <div class="conflicts-container">
                            ${conflicts.map((conflict, index) => `
                                <div class="conflict-card" data-conflict-index="${index}">
                                    <div class="conflict-header">
                                        <div class="layer-badge">
                                            <div class="color-indicator" style="background-color: ${conflict.layerColor};"></div>
                                            <span class="layer-name">${conflict.layerDisplayName}</span>
                                        </div>
                                        <div class="conflict-type-badge ${conflict.isFileSpecific ? 'file-specific' : 'global'}">
                                            ${conflict.isFileSpecific ? 'File-Specific' : 'Global'} Conflict
                                        </div>
                                    </div>
                                    
                                    <div class="conflict-description">
                                        <p>${conflict.description}</p>
                                    </div>
                                    
                                    <div class="resolution-options">
                                        <div class="option-group">
                                            <label class="resolution-option ${conflict.isFileSpecific ? 'file-specific' : 'global'}">
                                                <input type="radio" name="resolution_${conflict.layerName}" value="keep_existing" checked>
                                                <div class="option-content">
                                                    <div class="option-icon">✅</div>
                                                    <div class="option-text">
                                                        <div class="option-title">Keep Existing Mapping</div>
                                                        <div class="option-subtitle">Use the current ${conflict.isFileSpecific ? 'file-specific' : 'global'} mapping</div>
                                                    </div>
                                                </div>
                                            </label>
                                            
                                            <label class="resolution-option new-mapping">
                                                <input type="radio" name="resolution_${conflict.layerName}" value="use_new">
                                                <div class="option-content">
                                                    <div class="option-icon">🆕</div>
                                                    <div class="option-text">
                                                        <div class="option-title">Create New Mapping</div>
                                                        <div class="option-subtitle">Override with a new mapping rule</div>
                                                    </div>
                                                </div>
                                            </label>
                                            
                                            ${conflict.isFileSpecific ? `
                                            <label class="resolution-option global-mapping">
                                                <input type="radio" name="resolution_${conflict.layerName}" value="use_global">
                                                <div class="option-content">
                                                    <div class="option-icon">🌐</div>
                                                    <div class="option-text">
                                                        <div class="option-title">Use Global Mapping</div>
                                                        <div class="option-subtitle">Replace file-specific with global rule</div>
                                                    </div>
                                                </div>
                                            </label>
                                            ` : `
                                            <label class="resolution-option file-specific">
                                                <input type="radio" name="resolution_${conflict.layerName}" value="create_file_specific">
                                                <div class="option-content">
                                                    <div class="option-icon">📁</div>
                                                    <div class="option-text">
                                                        <div class="option-title">Create File-Specific</div>
                                                        <div class="option-subtitle">Make a mapping just for this file</div>
                                                    </div>
                                                </div>
                                            </label>
                                            `}
                                            
                                            <label class="resolution-option skip-layer">
                                                <input type="radio" name="resolution_${conflict.layerName}" value="skip">
                                                <div class="option-content">
                                                    <div class="option-icon">⏭️</div>
                                                    <div class="option-text">
                                                        <div class="option-title">Skip This Layer</div>
                                                        <div class="option-subtitle">Don't import this layer</div>
                                                    </div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="conflict-summary">
                            <div class="summary-toggle">
                                <label class="toggle-switch">
                                    <input type="checkbox" id="applyToAll" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                                <div class="toggle-text">
                                    <div class="toggle-title">Apply to All Similar Conflicts</div>
                                    <div class="toggle-subtitle">Use the same resolution for layers with identical names</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer conflict-footer">
                        <div class="footer-info">
                            <span class="conflict-count">${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} to resolve</span>
                        </div>
                        <div class="footer-actions">
                            <button class="btn btn-secondary" onclick="closeConflictModal()">Cancel Import</button>
                            <button class="btn btn-primary" onclick="resolveConflicts()">
                                <span class="btn-icon">✅</span>
                                Resolve & Continue
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Store data for resolution
        window.conflictResolutionData = {
            conflicts: conflicts,
            newLayers: newLayers,
            resolve: resolve
        };
        
        // Add global functions for modal interaction
        window.closeConflictModal = function() {
            const modal = document.getElementById('conflictModal');
            if (modal) {
                modal.remove();
            }
            delete window.conflictResolutionData;
            resolve({ action: 'cancelled' });
        };
        
        window.resolveConflicts = function() {
            const resolutionData = window.conflictResolutionData;
            if (!resolutionData) return;
            
            const resolutions = {};
            const applyToAll = document.getElementById('applyToAll').checked;
            
            resolutionData.conflicts.forEach(conflict => {
                const radioName = `resolution_${conflict.layerName}`;
                const selectedRadio = document.querySelector(`input[name="${radioName}"]:checked`);
                
                if (selectedRadio) {
                    resolutions[conflict.layerName] = selectedRadio.value;
                }
            });
            
            // Close modal
            const modal = document.getElementById('conflictModal');
            if (modal) {
                modal.remove();
            }
            
            delete window.conflictResolutionData;
            delete window.closeConflictModal;
            delete window.resolveConflicts;
            
            resolve({
                action: 'resolved',
                resolutions: resolutions,
                applyToAll: applyToAll
            });
        };
    });
}

async function applyConflictResolutions(resolutions, newLayers) {
    try {
        console.log('Applying conflict resolutions:', resolutions);
        
        // Filter layers based on resolutions
        const filteredLayers = newLayers.filter(layer => {
            const resolution = resolutions[layer.name];
            return resolution !== 'skip';
        });
        
        // Update mappings based on resolutions
        const mappingUpdates = {};
        const fileSpecificMappings = {};
        
        Object.entries(resolutions).forEach(([layerName, resolution]) => {
            if (resolution === 'use_new') {
                // Create new mapping - this would be handled by the mapping wizard
                mappingUpdates[layerName] = 'new_mapping_needed';
            } else if (resolution === 'create_file_specific') {
                // Create file-specific mapping
                fileSpecificMappings[layerName] = 'file_specific_mapping_needed';
            } else if (resolution === 'use_global') {
                // Remove file-specific mapping and use global
                mappingUpdates[layerName] = 'remove_file_specific_mapping';
            }
            // 'keep_existing' means we don't change anything
        });
        
        // Save file-specific mappings if any were created
        if (Object.keys(fileSpecificMappings).length > 0) {
            const currentFilename = window.currentFilename || 'unknown.dxf';
            const currentFilePath = window.currentFilePath;
            
            // Calculate file hash
            let fileHash = null;
            if (currentFilePath) {
                const hashResult = await window.electronAPI.calculateFileHash(currentFilePath);
                if (hashResult.success) {
                    fileHash = hashResult.hash;
                }
            }
            
            // For now, we'll create placeholder mappings - the actual line type would be set by the mapping wizard
            const placeholderMappings = {};
            Object.keys(fileSpecificMappings).forEach(layerName => {
                placeholderMappings[layerName] = 'TO_BE_DETERMINED';
            });
            
            if (fileHash) {
                await window.electronAPI.saveFileSpecificMappingsToProfile(
                    'mtl.xml',
                    currentFilename,
                    fileHash,
                    placeholderMappings,
                    `File-specific mappings created during conflict resolution`
                );
            }
        }
        
        console.log('Filtered layers after conflict resolution:', filteredLayers);
        console.log('Mapping updates needed:', mappingUpdates);
        console.log('File-specific mappings created:', fileSpecificMappings);
        
        return {
            filteredLayers: filteredLayers,
            mappingUpdates: mappingUpdates,
            fileSpecificMappings: fileSpecificMappings
        };
        
    } catch (error) {
        console.error('Error applying conflict resolutions:', error);
        return {
            filteredLayers: newLayers,
            mappingUpdates: {},
            fileSpecificMappings: {}
        };
    }
}
// Add to Global Import Filter Modal
async function showAddToGlobalModal(layerName, layerColor) {
    try {
        // Load line types for the dropdown
        const lineTypes = await window.electronAPI.getInternalLineTypes();
        
        // Convert ACI color to hex for display and swatch
        const colorHex = aciToHex(layerColor);
        
        // Create modal HTML
        const modalHTML = `
            <div id="addToGlobalModal" class="modal" style="display: flex;">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>Add to Global Import Filter</h3>
                        <button class="modal-close" onclick="closeAddToGlobalModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="layer-info-display">
                            <div class="layer-preview">
                                <div class="color-swatch" style="background-color: ${colorHex};"></div>
                                <div class="layer-details">
                                    <div class="layer-name">${layerName}</div>
                                    <div class="layer-color-info">
                                        <div class="color-label">Color:</div>
                                        <div class="color-details">
                                            <div class="color-type">ACI</div>
                                            <div class="color-value">${layerColor}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="lineTypeSelect">Select Line Type:</label>
                            <select id="lineTypeSelect" class="form-select">
                                <option value="">Choose a line type...</option>
                                ${lineTypes.map(lt => `
                                    <option value="${lt.id}">${lt.name} - ${lt.description || 'No description'}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="ruleDescription">Description (optional):</label>
                            <input type="text" id="ruleDescription" class="form-input" placeholder="e.g., Cutting layer for this material">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeAddToGlobalModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="saveToGlobalFilter()">Add to Global Filter</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Store data for saving
        window.addToGlobalData = {
            layerName: layerName,
            layerColor: layerColor
        };
        
        // Add global functions for modal interaction
        window.closeAddToGlobalModal = function() {
            const modal = document.getElementById('addToGlobalModal');
            if (modal) {
                modal.remove();
            }
            delete window.addToGlobalData;
            delete window.closeAddToGlobalModal;
            delete window.saveToGlobalFilter;
        };
        
        window.saveToGlobalFilter = async function() {
            const lineTypeId = document.getElementById('lineTypeSelect').value;
            const description = document.getElementById('ruleDescription').value;
            
            if (!lineTypeId) {
                alert('Please select a line type');
                return;
            }
            
            try {
                const ruleData = {
                    layerName: layerName,
                    color: layerColor, // This is now the ACI color number
                    lineTypeId: lineTypeId,
                    description: description || `Rule for ${layerName}`,
                    source: 'manual'
                };
                // Also update mappingWorkflow config for UI mapping
                if (!currentPostprocessorConfig.mappingWorkflow) {
                    currentPostprocessorConfig.mappingWorkflow = { layerToLineType: [] };
                }
                if (!currentPostprocessorConfig.mappingWorkflow.layerToLineType) {
                    currentPostprocessorConfig.mappingWorkflow.layerToLineType = [];
                }
                // Remove any previous mapping for this layer+color
                currentPostprocessorConfig.mappingWorkflow.layerToLineType = currentPostprocessorConfig.mappingWorkflow.layerToLineType.filter(m => !(m.layer === layerName && m.color === layerColor));
                // Add new mapping
                currentPostprocessorConfig.mappingWorkflow.layerToLineType.push({
                    layer: layerName,
                    color: layerColor,
                    lineType: lineTypeId
                });
                // Save to global filter as before
                const result = await window.electronAPI.addRuleToGlobalImportFilter(ruleData);
                if (result.success) {
                    showStatus(`Added ${layerName} (color ${layerColor}) to global import filter`, 'success');
                    // Refresh the layer table to show the new mapping
                    if (window.currentDxfLayers) {
                        const updatedLayers = await window.electronAPI.applyGlobalImportFilter(window.currentDxfLayers);
                        if (updatedLayers.success) {
                            const { appliedLayers, unmatchedLayers } = updatedLayers.data;
                            const allLayers = appliedLayers.concat(unmatchedLayers);
                            // Update currentLayerData to reflect new mappings
                            window.currentLayerData = allLayers;
                            populateLayerTable(allLayers);
                            // Update layer status counts
                            updateLayerStatus();
                        }
                    }
                } else {
                    throw new Error(result.error);
                }
                closeAddToGlobalModal();
            } catch (error) {
                console.error('Error adding to global filter:', error);
                showStatus('Failed to add to global filter: ' + error.message, 'error');
            }
        };
        
    } catch (error) {
        console.error('Error showing add to global modal:', error);
        showStatus('Error loading line types: ' + error.message, 'error');
    }
}
// Priority Management for Tool Configuration Window
function initializePriorityManagement(modal) {
    console.log('Initializing priority management...');
    
    // Global state for priority management
    let currentPriorityLists = {
        tool: [],
        lineType: []
    };
    let currentPriorityMode = 'tool';
    
    // Load initial priority data
    loadPriorityData(modal);
    
    // Always use tool-based priority
    currentPriorityMode = 'tool';
    
    // Priority controls
    const addToPriorityBtn = modal.querySelector('#addToPriorityBtn');
    const removeFromPriorityBtn = modal.querySelector('#removeFromPriorityBtn');
    const insertBreakBtn = modal.querySelector('#insertBreakBtn');
    const moveUpBtn = modal.querySelector('#moveUpBtn');
    const moveDownBtn = modal.querySelector('#moveDownBtn');
    const clearPriorityBtn = modal.querySelector('#clearPriorityBtn');
    if (addToPriorityBtn) addToPriorityBtn.addEventListener('click', () => addToToolPriorityList(modal));
    if (removeFromPriorityBtn) removeFromPriorityBtn.addEventListener('click', () => removeFromToolPriorityList(modal));
    if (insertBreakBtn) insertBreakBtn.addEventListener('click', () => insertToolBreak(modal));
    if (moveUpBtn) moveUpBtn.addEventListener('click', () => moveToolItemUp(modal));
    if (moveDownBtn) moveDownBtn.addEventListener('click', () => moveToolItemDown(modal));
    if (clearPriorityBtn) clearPriorityBtn.addEventListener('click', () => clearToolPriorityList(modal));
    
    console.log('Priority management initialized');
}

async function loadPriorityData(modal) {
    try {
        // Load available items (always tools)
        await loadAvailableItems(modal);
        
        // Load saved priority configuration
        await loadToolPriorityConfiguration(modal);
    } catch (error) {
        console.error('Error loading priority data:', error);
    }
}
async function loadAvailableItems(modal) {
    const availableList = modal.querySelector('#availableItemsList');
    if (!availableList) return;
    
    availableList.innerHTML = '';
    
    try {
        // Always load tools from current profile
        const tools = await getCurrentToolSet();
        const toolIds = Object.keys(tools);
        
        toolIds.forEach(toolId => {
            const tool = tools[toolId];
            const item = createPriorityItem(toolId, `${toolId} - ${tool.name}`, tool.description);
            availableList.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading tool items:', error);
    }
}

function createPriorityItem(id, name, description) {
    const item = document.createElement('div');
    item.className = 'priority-item';
    item.dataset.id = id;
    item.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem;
        background: #2d2d2d;
        border: 1px solid #404040;
        border-radius: 4px;
        margin-bottom: 0.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
    `;
    
    item.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <div style="color: #ffffff; font-weight: 500; font-size: 0.9rem;">${name}</div>
            <div style="color: #bbb; font-size: 0.75rem;">${description}</div>
        </div>
    `;
    
    item.addEventListener('click', () => toggleItemSelection(item));
    return item;
}

function toggleItemSelection(item) {
    item.classList.toggle('selected');
    if (item.classList.contains('selected')) {
        item.style.background = 'linear-gradient(135deg, #00BFFF 0%, #0099CC 100%)';
        item.style.borderColor = '#0099CC';
        item.style.color = '#fff';
    } else {
        item.style.background = '#2d2d2d';
        item.style.borderColor = '#404040';
        item.style.color = '#ffffff';
    }
}

function addToToolPriorityList(modal) {
    const availableList = modal.querySelector('#availableItemsList');
    const priorityList = modal.querySelector('#priorityOrderList');
    const selectedItems = availableList.querySelectorAll('.priority-item.selected');
    
    let addedCount = 0;
    let skippedCount = 0;
    
    selectedItems.forEach(item => {
        const toolId = item.dataset.id;
        
        // Check if this tool is already in the priority list
        const existingItems = priorityList.querySelectorAll('.priority-item:not(.break-after)');
        const isAlreadyAdded = Array.from(existingItems).some(existingItem => 
            existingItem.dataset.id === toolId
        );
        
        if (isAlreadyAdded) {
            // Tool already exists, skip it
            skippedCount++;
            
            // Deselect the original item in the available list
            item.classList.remove('selected');
            item.style.background = '#2d2d2d';
            item.style.borderColor = '#404040';
            item.style.color = '#ffffff';
            
            return; // Skip this item
        }
        
        const clonedItem = item.cloneNode(true);
        clonedItem.classList.remove('selected');
        clonedItem.style.background = '#2d2d2d';
        clonedItem.style.borderColor = '#404040';
        clonedItem.addEventListener('click', () => toggleToolPriorityItemSelection(clonedItem));
        
        // Add priority number
        const priorityNumber = priorityList.children.length + 1;
        const numberDiv = document.createElement('div');
        numberDiv.style.cssText = `
            background: #00BFFF;
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 600;
        `;
        numberDiv.textContent = priorityNumber;
        clonedItem.appendChild(numberDiv);
        
        priorityList.appendChild(clonedItem);
        addedCount++;
        
        // Deselect the original item in the available list
        item.classList.remove('selected');
        item.style.background = '#2d2d2d';
        item.style.borderColor = '#404040';
        item.style.color = '#ffffff';
    });
    
    updateToolPriorityNumbers(modal);
    updateAvailableItemsBadges(modal); // Update badges in available items
    
    // Show appropriate status message
    if (addedCount > 0 && skippedCount > 0) {
        showStatus(`Added ${addedCount} items, skipped ${skippedCount} duplicates`, 'info');
    } else if (addedCount > 0) {
        showStatus(`Added ${addedCount} items to priority list`, 'success');
    } else if (skippedCount > 0) {
        showStatus(`Skipped ${skippedCount} duplicate items`, 'warning');
    }
}

function toggleToolPriorityItemSelection(item) {
    item.classList.toggle('selected');
    if (item.classList.contains('selected')) {
        if (item.classList.contains('break-after')) {
            item.style.background = 'linear-gradient(135deg, #00BFFF 0%, #0099CC 100%)';
            item.style.borderColor = '#0099CC';
            item.style.borderBottomColor = '#f39c12';
        } else {
            item.style.background = 'linear-gradient(135deg, #00BFFF 0%, #0099CC 100%)';
            item.style.borderColor = '#0099CC';
        }
    } else {
        if (item.classList.contains('break-after')) {
            item.style.background = '#2d2d2d';
            item.style.borderColor = '#404040';
            item.style.borderBottomColor = '#f39c12';
        } else {
            item.style.background = '#2d2d2d';
            item.style.borderColor = '#404040';
        }
    }
}

function removeFromToolPriorityList(modal) {
    const priorityList = modal.querySelector('#priorityOrderList');
    const selectedItems = priorityList.querySelectorAll('.priority-item.selected, .break-after.selected');
    
    selectedItems.forEach(item => item.remove());
    updateToolPriorityNumbers(modal);
    updateAvailableItemsBadges(modal); // Update badges in available items
    showStatus(`Removed ${selectedItems.length} items from priority list`, 'info');
}
function insertToolBreak(modal) {
    const priorityList = modal.querySelector('#priorityOrderList');
    const breakItem = document.createElement('div');
    breakItem.className = 'priority-item break-after';
    breakItem.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem;
        background: #2d2d2d;
        border: 1px solid #404040;
        border-bottom: 3px solid #f39c12;
        border-radius: 4px;
        margin-bottom: 1rem;
        cursor: pointer;
    `;
    
    breakItem.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <div style="color: #ffffff; font-weight: 500; font-size: 0.9rem;">--- LINE BREAK ---</div>
            <div style="color: #bbb; font-size: 0.75rem;">Manual break in cutting sequence</div>
        </div>
    `;
    
    // Add click event listener for selection
    breakItem.addEventListener('click', () => {
        toggleToolPriorityItemSelection(breakItem);
    });
    
    priorityList.appendChild(breakItem);
    showStatus('Inserted break in priority list', 'info');
}

function moveToolItemUp(modal) {
    const priorityList = modal.querySelector('#priorityOrderList');
    const selectedItem = priorityList.querySelector('.priority-item.selected, .break-after.selected');
    
    if (selectedItem && selectedItem.previousElementSibling) {
        priorityList.insertBefore(selectedItem, selectedItem.previousElementSibling);
        updateToolPriorityNumbers(modal);
        updateAvailableItemsBadges(modal); // Update badges in available items
        showStatus('Moved item up in priority list', 'info');
    }
}

function moveToolItemDown(modal) {
    const priorityList = modal.querySelector('#priorityOrderList');
    const selectedItem = priorityList.querySelector('.priority-item.selected, .break-after.selected');
    
    if (selectedItem && selectedItem.nextElementSibling) {
        priorityList.insertBefore(selectedItem.nextElementSibling, selectedItem);
        updateToolPriorityNumbers(modal);
        updateAvailableItemsBadges(modal); // Update badges in available items
        showStatus('Moved item down in priority list', 'info');
    }
}

function clearToolPriorityList(modal) {
    const priorityList = modal.querySelector('#priorityOrderList');
    priorityList.innerHTML = '';
    updateAvailableItemsBadges(modal); // Update badges in available items
    showStatus('Cleared priority list', 'info');
}

function updateToolPriorityNumbers(modal) {
    const priorityList = modal.querySelector('#priorityOrderList');
    const items = priorityList.querySelectorAll('.priority-item:not(.break-after)');
    
    items.forEach((item, index) => {
        let numberDiv = item.querySelector('div[style*="border-radius: 50%"]');
        if (!numberDiv) {
            numberDiv = document.createElement('div');
            numberDiv.style.cssText = `
                background: #00BFFF;
                color: white;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 600;
            `;
            item.appendChild(numberDiv);
        }
        numberDiv.textContent = index + 1;
    });
}
function updateAvailableItemsBadges(modal) {
    const availableList = modal.querySelector('#availableItemsList');
    const priorityList = modal.querySelector('#priorityOrderList');
    
    // Get all tools currently in priority list
    const priorityItems = priorityList.querySelectorAll('.priority-item:not(.break-after)');
    const priorityToolIds = Array.from(priorityItems).map(item => item.dataset.id);
    
    // Update each available item
    const availableItems = availableList.querySelectorAll('.priority-item');
    availableItems.forEach(item => {
        const toolId = item.dataset.id;
        const existingBadge = item.querySelector('.priority-badge');
        
        // Remove existing badge if any
        if (existingBadge) {
            existingBadge.remove();
        }
        
        // Check if this tool is in priority list
        const priorityIndex = priorityToolIds.indexOf(toolId);
        if (priorityIndex !== -1) {
            // Add badge showing priority number
            const badge = document.createElement('div');
            badge.className = 'priority-badge';
            badge.style.cssText = `
                background: #00BFFF;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.7rem;
                font-weight: 600;
                position: absolute;
                top: 8px;
                right: 8px;
                z-index: 10;
            `;
            badge.textContent = priorityIndex + 1;
            item.style.position = 'relative';
            item.appendChild(badge);
        }
    });
}

async function saveToolPriorityConfiguration(modal) {
    try {
        const priorityList = modal.querySelector('#priorityOrderList');
        const items = Array.from(priorityList.children).map(item => {
            if (item.classList.contains('break-after')) {
                return '__LINE_BREAK__';
            }
            return item.dataset.id;
        });
        
        // Always use tool mode
        const currentMode = 'tool';
        
        // Save to current profile
        await window.electronAPI.savePriorityConfiguration('mtl.xml', currentMode, items);
        
        showStatus('Priority configuration saved successfully', 'success');
        
        // Close the modal after successful save
        modal.remove();
    } catch (error) {
        console.error('Error saving priority configuration:', error);
        showStatus(`Error saving priority configuration: ${error.message}`, 'error');
    }
}
async function loadToolPriorityConfiguration(modal) {
    try {
        // Load from current profile
        const response = await window.electronAPI.loadPriorityConfiguration('mtl.xml');
        
        if (response && response.success && response.data) {
            const config = response.data;
            
            // Always use tool mode
            await loadAvailableItems(modal);
            displayToolPriorityList(modal, config.items || []);
            
            showStatus('Priority configuration loaded successfully', 'success');
        } else {
            showStatus('No priority configuration found, using defaults', 'info');
        }
    } catch (error) {
        console.error('Error loading priority configuration:', error);
        showStatus(`Error loading priority configuration: ${error.message}`, 'error');
    }
}
function displayToolPriorityList(modal, items) {
    const priorityList = modal.querySelector('#priorityOrderList');
    priorityList.innerHTML = '';
    
    items.forEach((item, index) => {
        if (item === '__LINE_BREAK__') {
            const breakItem = document.createElement('div');
            breakItem.className = 'priority-item break-after';
            breakItem.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.75rem;
                background: #2d2d2d;
                border: 1px solid #404040;
                border-bottom: 3px solid #f39c12;
                border-radius: 4px;
                margin-bottom: 1rem;
                cursor: pointer;
            `;
            
            breakItem.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="color: #ffffff; font-weight: 500; font-size: 0.9rem;">--- LINE BREAK ---</div>
                    <div style="color: #bbb; font-size: 0.75rem;">Manual break in cutting sequence</div>
                </div>
            `;
            
            // Add click event handler for break items
            breakItem.addEventListener('click', () => {
                // Deselect all items first
                priorityList.querySelectorAll('.priority-item').forEach(el => {
                    el.classList.remove('selected');
                    // Reset styling for all items
                    if (el.classList.contains('break-after')) {
                        el.style.background = '#2d2d2d';
                        el.style.borderColor = '#404040';
                        el.style.borderBottomColor = '#f39c12';
                    } else {
                        el.style.background = '#2d2d2d';
                        el.style.borderColor = '#404040';
                    }
                });
                // Select this break item using the proper function
                toggleToolPriorityItemSelection(breakItem);
            });
            
            priorityList.appendChild(breakItem);
        } else {
            const itemElement = createPriorityItem(item, item, 'Priority item');
            const numberDiv = document.createElement('div');
            numberDiv.style.cssText = `
                background: #00BFFF;
                color: white;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 600;
            `;
            numberDiv.textContent = index + 1;
            itemElement.appendChild(numberDiv);
            priorityList.appendChild(itemElement);
        }
    });
    
    // Update badges in available items after loading priority list
    updateAvailableItemsBadges(modal);
}

// Configuration Validation System
async function validateConfiguration() {
    try {
        console.log('Running configuration validation...');
        const issues = await window.electronAPI.validateConfiguration();
        
        if (issues.length > 0) {
            console.log(`Found ${issues.length} configuration issues:`, issues);
            showConfigurationIssuesModal(issues);
        } else {
            console.log('Configuration validation passed - no issues found');
        }
    } catch (error) {
        console.error('Configuration validation failed:', error);
    }
}

function showConfigurationIssuesModal(issues) {
    // Create modal HTML
    const modalHTML = `
        <div id="configIssuesModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>⚠️ Configuration Issues Detected</h3>
                    <span class="close" onclick="closeConfigIssuesModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <p>The following configuration issues were found. You can fix them automatically or manually:</p>
                    <div id="issuesList">
                        ${issues.map((issue, index) => `
                            <div class="issue-item ${issue.type}">
                                <div class="issue-header">
                                    <span class="issue-type ${issue.type}">${issue.type.toUpperCase()}</span>
                                    <span class="issue-message">${issue.message}</span>
                                </div>
                                <div class="issue-actions">
                                    ${issue.action === 'none' ? 
                                        `<span class="info-only">Information only - no action needed</span>` :
                                        `<button class="btn btn-primary btn-sm" onclick="fixIssue(${index})">
                                            ${getFixButtonText(issue.action)}
                                        </button>
                                        <button class="btn btn-secondary btn-sm" onclick="ignoreIssue(${index})">
                                            Ignore
                                        </button>`
                                    }
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="fixAllIssues()">Fix All Issues</button>
                    <button class="btn btn-secondary" onclick="closeConfigIssuesModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Store issues for later use
    window.configIssues = issues;
    
    // Show modal
    const modal = document.getElementById('configIssuesModal');
    modal.style.display = 'block';
}

function getFixButtonText(action) {
    switch (action) {
        case 'fix_mapping': return 'Remove Mapping';
        case 'fix_priority': return 'Remove Priority';
        case 'fix_filter': return 'Remove Rule';
        case 'restore': return 'Restore Backup';
        case 'none': return 'Info Only';
        default: return 'Fix';
    }
}

async function fixIssue(index) {
    const issue = window.configIssues[index];
    if (!issue) return;
    
    try {
        const result = await window.electronAPI.fixConfigurationIssue(issue);
        if (result.success) {
            // Remove the issue from the list
            window.configIssues.splice(index, 1);
            
            // Update the UI
            updateIssuesList();
            
            // Show success message
            showStatus(`Fixed: ${result.message}`, 'success');
            
            // If no more issues, close modal
            if (window.configIssues.length === 0) {
                closeConfigIssuesModal();
            }
        } else {
            showStatus(`Failed to fix issue: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Error fixing issue:', error);
        showStatus(`Error fixing issue: ${error.message}`, 'error');
    }
}
async function fixAllIssues() {
    const issues = [...window.configIssues];
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const issue of issues) {
        try {
            // Skip info-only items
            if (issue.action === 'none') {
                skippedCount++;
                continue;
            }
            
            const result = await window.electronAPI.fixConfigurationIssue(issue);
            if (result.success) {
                fixedCount++;
            }
        } catch (error) {
            console.error('Error fixing issue:', error);
        }
    }
    
    const totalIssues = issues.length - skippedCount;
    showStatus(`Fixed ${fixedCount} out of ${totalIssues} fixable issues (${skippedCount} info items skipped)`, 'success');
    closeConfigIssuesModal();
    
    // Refresh the application state
    await refreshApplicationState();
}

function ignoreIssue(index) {
    window.configIssues.splice(index, 1);
    updateIssuesList();
    
    if (window.configIssues.length === 0) {
        closeConfigIssuesModal();
    }
}

function updateIssuesList() {
    const issuesList = document.getElementById('issuesList');
    if (!issuesList) return;
    
    issuesList.innerHTML = window.configIssues.map((issue, index) => `
        <div class="issue-item ${issue.type}">
            <div class="issue-header">
                <span class="issue-type ${issue.type}">${issue.type.toUpperCase()}</span>
                <span class="issue-message">${issue.message}</span>
            </div>
            <div class="issue-actions">
                <button class="btn btn-primary btn-sm" onclick="fixIssue(${index})">
                    ${getFixButtonText(issue.action)}
                </button>
                <button class="btn btn-secondary btn-sm" onclick="ignoreIssue(${index})">
                    Ignore
                </button>
            </div>
        </div>
    `).join('');
}

function closeConfigIssuesModal() {
    const modal = document.getElementById('configIssuesModal');
    if (modal) {
        modal.remove();
    }
    window.configIssues = null;
}

async function refreshApplicationState() {
    // Reload tools, line types, and other configuration
    try {
        await loadTools();
        await loadLineTypes();
        await loadGlobalImportFilter();
        showStatus('Configuration refreshed successfully', 'success');
    } catch (error) {
        console.error('Error refreshing application state:', error);
        showStatus('Error refreshing configuration', 'error');
    }
}

// Run validation on startup
// Validation at startup is now handled by the ShowConfigIssuesOnStartup logic in window.onload

// Make functions globally available
window.validateConfiguration = validateConfiguration;
window.fixIssue = fixIssue;
window.fixAllIssues = fixAllIssues;
window.ignoreIssue = ignoreIssue;
window.closeConfigIssuesModal = closeConfigIssuesModal;