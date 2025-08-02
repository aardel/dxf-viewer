import * as THREE from '../../node_modules/three/build/three.module.js';
import { DxfViewer } from '../../src/index.js';

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
const exportLayersBtn = document.getElementById('exportLayersBtn');
const createImportFilterBtn = document.getElementById('createImportFilterBtn');
const lineTypesBtn = document.getElementById('lineTypesBtn');
const panelToggleIcon = document.getElementById('panelToggleIcon');
const layerTableEl = document.getElementById('layerTable');
const drawingInfoEl = document.getElementById('drawingInfo');
const drawingDimensionsEl = document.getElementById('drawingDimensions');
const drawingUnitsEl = document.getElementById('drawingUnits');
const unitOverrideEl = document.getElementById('unitOverride');
const resizeHandleEl = document.getElementById('resizeHandle');
const viewerContainerEl = document.querySelector('.viewer-container');

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

resizeHandleEl.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = parseInt(document.defaultView.getComputedStyle(sidePanelEl).width, 10);
    resizeHandleEl.classList.add('resizing');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const dx = startX - e.clientX; // Negative because we're resizing from the left edge
    const newWidth = startWidth + dx;
    const minWidth = 200;
    const maxWidth = window.innerWidth * 0.6;
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
        sidePanelEl.style.width = newWidth + 'px';
    }
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizeHandleEl.classList.remove('resizing');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // Trigger viewer resize after panel resize
        setTimeout(() => {
            if (viewer && viewer.canvas) {
                // Get the actual container dimensions
                const containerEl = document.getElementById('viewer');
                if (containerEl) {
                    const rect = containerEl.getBoundingClientRect();
                    console.log('Container dimensions after resize:', rect.width, rect.height);
                    
                    // Force viewer to resize to container dimensions
                    if (viewer.SetSize) {
                        viewer.SetSize(Math.floor(rect.width), Math.floor(rect.height));
                    }
                    
                    // Also trigger window resize event as fallback
                    const resizeEvent = new Event('resize');
                    window.dispatchEvent(resizeEvent);
                    
                    // Force a render
                    if (viewer.Render) {
                        viewer.Render();
                    }
                }
            }
        }, 50);
    }
});

// Layer management functions
function populateLayerTable(layers) {
    console.log('populateLayerTable called with:', layers);
    
    if (!layers || layers.length === 0) {
        layerTableEl.innerHTML = '<div class="no-file">No layers found in DXF</div>';
        exportLayersBtn.disabled = true;
        createImportFilterBtn.disabled = true;
        return;
    }

    layerTableEl.innerHTML = '';
    exportLayersBtn.disabled = false; // Enable export button when layers are available
    createImportFilterBtn.disabled = false; // Enable import filter button when layers are available
    
    layers.filter(layer => {
        const layerName = layer.name || '';
        return getLayerObjectCount(layerName) > 0;
    }).forEach((layer, index) => {
        console.log('Processing layer:', layer);
        
        const layerRow = document.createElement('div');
        layerRow.className = 'layer-row';
        
        const layerName = layer.name || `Layer ${index}`;
        const displayName = layer.displayName || layerName;
        const color = layer.color || 0xffffff; // Default to white if no color
        const objectCount = getLayerObjectCount(layerName);
        const lineweightText = formatLineweights(layer.lineweights); // Only show if actual data exists
        
        // Handle multi-color display
        let colorDisplayHtml = '';
        let dxfColorInfo = '';
        // Entity color breakdown HTML
        let entityColorBreakdownHtml = '';
        
        if (layer.hasMultipleColors && layer.entityColors && layer.entityColors.length > 1) {
            // Multi-color layer - show all individual entity colors
            const colorSquares = layer.entityColors.map(c => {
                const hex = rgbToHex(c);
                return `<div class="layer-color mini-color" style="background-color: ${hex}" title="${hex}"></div>`;
            }).join('');
            
            colorDisplayHtml = `
                <div class="multi-color-display">
                    ${colorSquares}
                </div>
            `;
            
            const rgbValues = layer.entityColors.map(c => hexToRGBDisplay(rgbToHex(c))).join(' • ');
            dxfColorInfo = `${layer.entityColors.length} colors: ${rgbValues}`;
                // Add entity color breakdown HTML
                entityColorBreakdownHtml = `<div class="entity-color-breakdown">Entity colors: ${rgbValues}</div>`;
            
        } else if (layer.multiColor && layer.colors && layer.colors.length > 1) {
            // Legacy multi-color layer - show all colors
            const colorSquares = layer.colors.map(c => {
                const hex = rgbToHex(c);
                return `<div class="layer-color mini-color" style="background-color: ${hex}" title="${hex}"></div>`;
            }).join('');
            
            colorDisplayHtml = `
                <div class="multi-color-display">
                    ${colorSquares}
                </div>
            `;
            
            const rgbValues = layer.colors.map(c => hexToRGBDisplay(rgbToHex(c))).join(' • ');
            dxfColorInfo = `${layer.colors.length} colors: ${rgbValues}`;
                // Add entity color breakdown HTML for legacy multi-color
                entityColorBreakdownHtml = `<div class="entity-color-breakdown">Colors: ${rgbValues}</div>`;
            
        } else {
            // Single color layer - traditional display
            const hexColor = rgbToHex(color);
            const rgbDisplay = hexToRGBDisplay(hexColor);
            
            colorDisplayHtml = `<div class="layer-color" style="background-color: ${hexColor}"></div>`;
            
            // Get DXF color information for display
            let aciColor = '';
            if (viewer.parsedDxf?.tables?.layer?.layers) {
                const dxfLayer = viewer.parsedDxf.tables.layer.layers[layerName];
                if (dxfLayer && dxfLayer.color !== undefined) {
                    if (typeof dxfLayer.color === 'number') {
                        aciColor = dxfLayer.color.toString();
                        dxfColorInfo = `Hex: ${hexColor} • RGB: ${rgbDisplay}`;
                    } else {
                        dxfColorInfo = `Hex: ${hexColor} • RGB: ${rgbDisplay}`;
                    }
                } else {
                    dxfColorInfo = `Hex: ${hexColor} • RGB: ${rgbDisplay}`;
                }
            } else {
                dxfColorInfo = `Hex: ${hexColor} • RGB: ${rgbDisplay}`;
            }
        }
        
        layerRow.innerHTML = `
            <input type="checkbox" 
                   class="layer-checkbox" 
                   id="layer-${index}" 
                   checked 
                   data-layer-name="${layerName}">
            <div class="layer-color-info">
                ${colorDisplayHtml}
                <div class="color-code">${dxfColorInfo}</div>
            </div>
            <div class="layer-info">
                <div class="layer-name">${displayName}</div>
                <div class="layer-details">Layer: ${layerName}${lineweightText ? ` • ${lineweightText}` : ''}${layer.entityTypeSummary ? ` • ${layer.entityTypeSummary}` : ''}</div>
                <div class="layer-objects">${objectCount} objects</div>
                ${entityColorBreakdownHtml}
            </div>
        `;
        
        layerTableEl.appendChild(layerRow);
        
        // Add event listener for checkbox
        const checkbox = layerRow.querySelector('.layer-checkbox');
        checkbox.addEventListener('change', (e) => {
            const layerName = e.target.dataset.layerName;
            const isVisible = e.target.checked;
            toggleLayerVisibility(layerName, isVisible);
        });
    });
    
    // Update drawing dimensions display
    updateDrawingDimensions();
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
        9: { r: 192, g: 192, b: 192 }  // Light Gray
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
        return layer ? layer.objects.length : 0;
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

// DXF Viewer functions
async function initViewer() {
    try {
        if (viewer) {
            viewer.Clear();
        } else {
            viewer = new DxfViewer(viewerEl, {
                clearColor: new THREE.Color(0xf8f9fa),
                autoResize: true,
                antialias: true,
                retainParsedDxf: true  // Keep the parsed DXF data for layer extraction
            });
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
            
            // Also add default layer if it exists and has objects
            if (viewer.defaultLayer && viewer.defaultLayer.objects.length > 0) {
                console.log('Adding default layer:', viewer.defaultLayer);
                layersFromMap.push({
                    name: viewer.defaultLayer.name,
                    displayName: viewer.defaultLayer.displayName || viewer.defaultLayer.name,
                    color: viewer.defaultLayer.color !== undefined ? viewer.defaultLayer.color : 0xffffff
                });
            }
            
            // Populate layer table - get ALL layers, including empty ones
            const layers = viewer.GetLayers(false); // Get all layers
            console.log('Found layers via GetLayers():', layers);
            console.log('Found layers via internal map:', layersFromMap);
            
            // Try to extract layers from raw DXF data if viewer layers are empty
            let dxfLayers = [];
            
            // First try the standard layer table structure
            if (viewer.parsedDxf?.tables?.layer?.layers) {
                console.log('Extracting layers from DXF layer table...');
                for (const [layerName, dxfLayer] of Object.entries(viewer.parsedDxf.tables.layer.layers)) {
                    console.log('DXF Layer:', layerName, dxfLayer);
                    
                    // Analyze entities for this layer to get actual colors used
                    let layerEntityColors = [];
                    let shouldSkipLayer = false;
                    
                    // Initialize entity types and summary variables at layer level
                    let entityTypes = new Map();
                    let entityTypeSummary = '';
                    
                    if (viewer.parsedDxf?.entities?.length > 0) {
                        console.log(`=== LAYER "${layerName}" ENTITY ANALYSIS ===`);
                        const layerEntities = viewer.parsedDxf.entities.filter(e => e.layer === layerName);
                        console.log(`Layer "${layerName}" has ${layerEntities.length} entities`);
                        
                        // Skip empty layers (like Layer 0 with no entities)
                        if (layerEntities.length === 0) {
                            console.log(`Skipping empty layer: ${layerName}`);
                            console.log(`=== END LAYER "${layerName}" ANALYSIS ===`);
                            shouldSkipLayer = true;
                        } else {
                            // Extract actual entity colors and types
                            layerEntities.forEach(entity => {
                                if (entity.color !== undefined && entity.color !== null) {
                                    layerEntityColors.push(entity.color);
                                    
                                    // Track entity types and their colors
                                    const entityType = entity.type || 'UNKNOWN';
                                    if (!entityTypes.has(entityType)) {
                                        entityTypes.set(entityType, new Set());
                                    }
                                    entityTypes.get(entityType).add(entity.color);
                                }
                            });
                            
                            console.log(`Layer ${layerName} - Entity colors found: [${layerEntityColors.map(c => c.toString(16)).join(', ')}]`);
                            
                            // Create entity type summary
                            entityTypeSummary = Array.from(entityTypes.entries()).map(([type, colors]) => {
                                return `${type}(${colors.size})`;
                            }).join(', ');
                            
                            console.log(`Layer ${layerName} - Entity types: ${entityTypeSummary}`);
                            console.log(`=== END LAYER "${layerName}" ANALYSIS ===`);
                        }
                    }
                    
                    // Only add layer if it has entities
                    if (!shouldSkipLayer) {
                        // Use entity colors if available, otherwise fall back to layer color
                        const primaryColor = layerEntityColors.length > 0 ? layerEntityColors[0] : (dxfLayer.color || 0xffffff);
                        
                        dxfLayers.push({
                            name: layerName,
                            displayName: layerName,
                            color: primaryColor,
                            entityColors: layerEntityColors,
                            hasMultipleColors: layerEntityColors.length > 1,
                            multiColor: layerEntityColors.length > 1,
                            colors: layerEntityColors.length > 1 ? layerEntityColors : [primaryColor],
                            entityTypes: entityTypes,
                            entityTypeSummary: entityTypeSummary
                        });
                        
                        console.log(`Added layer: ${layerName}, color: ${primaryColor.toString(16)}, hasMultiple: ${layerEntityColors.length > 1}`);
                    }
                }
            } else if (viewer.parsedDxf?.tables?.layer) {
                // Try alternative layer table structure
                console.log('Trying alternative layer table structure...');
                const layerTable = viewer.parsedDxf.tables.layer;
                if (Array.isArray(layerTable)) {
                    layerTable.forEach(layer => {
                        console.log('Layer from array:', layer);
                        if (layer.name) {
                            dxfLayers.push({
                                name: layer.name,
                                displayName: layer.name,
                                color: layer.color || 0xffffff
                            });
                        }
                    });
                } else if (typeof layerTable === 'object') {
                    Object.keys(layerTable).forEach(key => {
                        if (typeof layerTable[key] === 'object' && layerTable[key].name) {
                            console.log('Layer from object:', key, layerTable[key]);
                            dxfLayers.push({
                                name: layerTable[key].name,
                                displayName: layerTable[key].name,
                                color: layerTable[key].color || 0xffffff
                            });
                        }
                    });
                }
                } else {
                    console.log('=== TAKING LAST RESORT PATH ===');
                    // Last resort: extract unique layer names and colors from entities
                    console.log('Extracting unique layer names and colors from entities...');
                    console.log('Total entities found:', viewer.parsedDxf?.entities?.length);
                    console.log('First few raw entities:', viewer.parsedDxf?.entities?.slice(0, 3));                // Debug: Show structure of first few entities in detail
                if (viewer.parsedDxf?.entities?.length > 0) {
                    console.log('=== DETAILED ENTITY ANALYSIS ===');
                    viewer.parsedDxf.entities.slice(0, 5).forEach((entity, index) => {
                        console.log(`Entity ${index}:`, {
                            type: entity.type,
                            layer: entity.layer,
                            // Color-related properties
                            color: entity.color,
                            colorIndex: entity.colorIndex,
                            colorNumber: entity.colorNumber,
                            trueColor: entity.trueColor,
                            materialColor: entity.materialColor,
                            // Find all color-related properties
                            colorKeys: Object.keys(entity).filter(key => 
                                key.toLowerCase().includes('color') || 
                                key === '62' || 
                                key === '420'
                            ),
                            // Show all numeric properties (DXF codes)
                            numericProps: Object.keys(entity).filter(key => 
                                !isNaN(parseInt(key))
                            ).reduce((acc, key) => {
                                acc[key] = entity[key];
                                return acc;
                            }, {})
                        });
                    });
                    console.log('=== END DETAILED ANALYSIS ===');
                }
                
                const layerData = new Map();
                
                viewer.parsedDxf?.entities?.forEach((entity, index) => {
                    if (entity.layer) {
                        const layerName = entity.layer;
                        if (!layerData.has(layerName)) {
                            layerData.set(layerName, {
                                name: layerName,
                                colors: new Set(),
                                colorDetails: new Map(), // Store detailed color info
                                lineweights: new Set(),
                                entities: [],
                                entityTypes: new Map() // Track entity types and their colors
                            });
                        }
                        
                        // Collect color information - handle both ACI and TrueColor
                        let entityColor = null;
                        let colorInfo = { type: 'default', value: 0xffffff };
                        
                        // Try multiple color property names and handle different data types
                        // First check explicit color properties
                        if (entity.color !== undefined && entity.color !== null) {
                            entityColor = entity.color;
                            if (entity.colorIndex !== undefined) {
                                colorInfo = { 
                                    type: 'ACI', 
                                    index: entity.colorIndex, 
                                    value: entity.color 
                                };
                            } else {
                                colorInfo = { 
                                    type: 'TrueColor', 
                                    value: entity.color 
                                };
                            }
                        } else if (entity.colorIndex !== undefined && entity.colorIndex !== null) {
                            // ACI color index - need to resolve to actual color
                            colorInfo = { 
                                type: 'ACI', 
                                index: entity.colorIndex, 
                                value: entity.colorIndex 
                            };
                            entityColor = entity.colorIndex;
                        } else if (entity['62'] !== undefined && entity['62'] !== null) {
                            // DXF code 62 = ACI color number
                            colorInfo = { 
                                type: 'ACI', 
                                index: entity['62'], 
                                value: entity['62'] 
                            };
                            entityColor = entity['62'];
                        } else if (entity['420'] !== undefined && entity['420'] !== null) {
                            // DXF code 420 = TrueColor value
                            colorInfo = { 
                                type: 'TrueColor', 
                                value: entity['420'] 
                            };
                            entityColor = entity['420'];
                        } else if (entity.colorNumber !== undefined && entity.colorNumber !== null) {
                            // Alternative color property
                            entityColor = entity.colorNumber;
                            colorInfo = { 
                                type: 'ColorNumber', 
                                value: entity.colorNumber 
                            };
                        }
                        
                        // If we got a string or object instead of number, try to extract numeric value
                        if (entityColor && typeof entityColor === 'string') {
                            // Try to parse hex color string
                            if (entityColor.startsWith('#')) {
                                entityColor = parseInt(entityColor.slice(1), 16);
                                colorInfo.value = entityColor;
                            } else {
                                // Might be a color name or ID - keep as string for now
                                console.log(`Warning: Got string color value: ${entityColor} for entity ${index}`);
                            }
                        }
                        
                        if (entityColor !== null && entityColor !== undefined && !isNaN(entityColor)) {
                            layerData.get(layerName).colors.add(entityColor);
                            layerData.get(layerName).colorDetails.set(entityColor, colorInfo);
                            
                            // Track entity types and their colors
                            const entityType = entity.type || 'UNKNOWN';
                            if (!layerData.get(layerName).entityTypes.has(entityType)) {
                                layerData.get(layerName).entityTypes.set(entityType, new Set());
                            }
                            layerData.get(layerName).entityTypes.get(entityType).add(entityColor);
                        } else {
                            // No explicit color found - might be using layer color or ByLayer
                            console.log(`Entity ${index} has no explicit color, might be using layer color`);
                        }
                        
                        // Debug: log entity details with color info
                        if (index < 20) { // Increase to 20 to see more entities
                            const entityType = entity.type || 'UNKNOWN';
                            console.log(`\n=== Entity ${index} Details ===`);
                            console.log(`Type: ${entityType}, Layer: "${layerName}"`);
                            console.log(`All properties:`, entity);
                            
                            // Check all possible color-related properties
                            const colorProps = ['color', 'colorIndex', 'colorNumber', 'materialColor', 'trueColor'];
                            colorProps.forEach(prop => {
                                if (entity[prop] !== undefined) {
                                    console.log(`  ${prop}: ${entity[prop]} (type: ${typeof entity[prop]})`);
                                }
                            });
                            
                            if (entityColor) {
                                const hexColor = typeof entityColor === 'number' ? `#${entityColor.toString(16).padStart(6, '0').toUpperCase()}` : entityColor;
                                console.log(`  Final extracted color: ${hexColor} (${entityColor})`);
                            } else {
                                console.log(`  No color extracted`);
                            }
                            console.log(`=== End Entity ${index} ===\n`);
                        }
                        
                        // Collect lineweight information - check multiple possible property names
                        let lineweight = null;
                        if (entity.lineweight !== undefined) {
                            lineweight = entity.lineweight;
                        } else if (entity.lineWeight !== undefined) {
                            lineweight = entity.lineWeight;
                        } else if (entity.thickness !== undefined) {
                            lineweight = entity.thickness;
                        }
                        
                        if (lineweight !== null && lineweight !== undefined) {
                            layerData.get(layerName).lineweights.add(lineweight);
                            console.log(`Found lineweight ${lineweight} on layer ${layerName} (entity type: ${entity.type})`);
                        }
                        
                        // Store entity reference for later use
                        layerData.get(layerName).entities.push(entity);
                    }
                });
                
                console.log('Layer data extracted:', layerData);
                
                // Enhanced debug logging for colors
                layerData.forEach((data, layerName) => {
                    console.log(`Layer "${layerName}": ${data.colors.size} unique colors`, Array.from(data.colors));
                    console.log(`Color details for layer "${layerName}":`, Array.from(data.colorDetails.entries()));
                    
                    // Show entity types and their colors
                    console.log(`Entity types in layer "${layerName}":`);
                    data.entityTypes.forEach((colors, entityType) => {
                        const colorList = Array.from(colors).map(c => 
                            typeof c === 'number' ? `#${c.toString(16).padStart(6, '0').toUpperCase()}` : c
                        ).join(', ');
                        console.log(`  ${entityType}: ${colors.size} colors [${colorList}]`);
                    });
                });
                
                // Debug: log a sample entity to see its structure
                if (viewer.parsedDxf?.entities?.length > 0) {
                    const sampleEntity = viewer.parsedDxf.entities[0];
                    console.log('Sample DXF entity:', sampleEntity);
                    console.log('Sample entity keys:', Object.keys(sampleEntity));
                    
                    // Log first few entities to see variety
                    for (let i = 0; i < Math.min(5, viewer.parsedDxf.entities.length); i++) {
                        const entity = viewer.parsedDxf.entities[i];
                        console.log(`Entity ${i}: type=${entity.type}, layer=${entity.layer}, keys=`, Object.keys(entity));
                    }
                }
                
                // Store extracted layer data globally for use in other functions
                window.extractedLayerData = layerData;
                
                // Try to extract colors from rendered Three.js geometry as fallback
                setTimeout(() => {
                    enhanceColorDataFromRenderedGeometry();
                    analyzeViewerGeometry();
                }, 1000); // Give viewer time to finish rendering
                
                layerData.forEach((data, layerName) => {
                    const colors = Array.from(data.colors);
                    const lineweights = Array.from(data.lineweights);
                    const colorDetails = Array.from(data.colorDetails.entries());
                    
                    console.log(`Layer ${layerName}: ${data.entities.length} entities, ${colors.length} unique colors:`, colors, 'lineweights:', lineweights);
                    
                    // Skip empty layers, especially Layer 0 if it has no entities
                    if (data.entities.length === 0) {
                        console.log(`Skipping empty layer: ${layerName}`);
                        return;
                    }
                    
                    // Special handling for Layer 0 - be more aggressive about filtering
                    if (layerName === '0') {
                        // Check if Layer 0 has any actual geometric entities (not just metadata)
                        const visibleEntities = data.entities.filter(entity => {
                            const entityType = (entity.type || '').toUpperCase();
                            // Skip common non-visual entity types
                            return entityType && !['VIEWPORT', 'DIMENSION', 'MTEXT', 'TEXT', 'ATTDEF', 'ATTRIB', 'INSERT'].includes(entityType);
                        });
                        
                        if (visibleEntities.length === 0) {
                            console.log(`Skipping Layer 0 - no visible geometric entities (had ${data.entities.length} total entities)`);
                            return;
                        } else {
                            console.log(`Layer 0 has ${visibleEntities.length} visible entities out of ${data.entities.length} total`);
                        }
                    }
                    
                    // Create entity type summary for display
                    const entityTypeSummary = Array.from(data.entityTypes.entries()).map(([type, colors]) => {
                        return `${type}(${colors.size})`;
                    }).join(', ');
                    
                    if (colors.length <= 1) {
                        // Single color layer - use traditional approach
                        const primaryColor = colors.length > 0 ? colors[0] : 0xffffff;
                        dxfLayers.push({
                            name: layerName,
                            displayName: layerName,
                            color: primaryColor,
                            lineweights: lineweights,
                            entityCount: data.entities.length,
                            entities: data.entities,
                            colorDetails: colorDetails,
                            entityTypes: data.entityTypes,
                            entityTypeSummary: entityTypeSummary
                        });
                    } else {
                        // Multiple colors - create sub-layers or show all colors
                        const allColorsHex = colors.map(c => 
                            typeof c === 'number' ? `#${c.toString(16).padStart(6, '0').toUpperCase()}` : c
                        ).join(', ');
                        
                        dxfLayers.push({
                            name: layerName,
                            displayName: `${layerName} (${colors.length} colors)`,
                            color: colors[0], // Primary color for main display
                            colors: colors, // All colors for detailed view
                            colorDetails: colorDetails,
                            lineweights: lineweights,
                            entityCount: data.entities.length,
                            entities: data.entities,
                            entityTypes: data.entityTypes,
                            entityTypeSummary: entityTypeSummary,
                            multiColor: true,
                            colorSummary: allColorsHex
                        });
                        
                        console.log(`Multi-color layer "${layerName}" has colors:`, allColorsHex);
                        console.log(`Entity types: ${entityTypeSummary}`);
                    }
                });
            }
            
            // Use the best available layer data - prioritize extracted DXF layers
            let finalLayers = layers;
            if (finalLayers.length === 0 && dxfLayers.length > 0) {
                finalLayers = dxfLayers;
            } else if (finalLayers.length === 0) {
                finalLayers = layersFromMap;
            }
            
            console.log('DXF layers found:', dxfLayers);
            console.log('Final layers to display:', finalLayers);
            populateLayerTable(finalLayers);
            
            // Apply current scaling factor to the newly loaded scene
            applyScalingToScene();
            
            showStatus(`Successfully loaded: ${filename} (${finalLayers.length} layers)`, 'success');
        } catch (error) {
            URL.revokeObjectURL(blobUrl);
            throw error;
        }
        
    } catch (error) {
        showStatus('Error loading DXF: ' + error.message, 'error');
        console.error('DXF load error:', error);
        showDropZone();
    } finally {
        showLoading(false);
    }
}

function clearViewer() {
    currentFilename = null; // Clear the filename
    currentFilePath = null; // Clear the file path
    
    if (viewer) {
        viewer.Clear();
    }
    hideFileInfo();
    showDropZone();
    
    // Reset layer table
    layerTableEl.innerHTML = '<div class="no-file">Load a DXF file to view layers</div>';
    exportLayersBtn.disabled = true; // Disable export button when no file loaded
    createImportFilterBtn.disabled = true; // Disable import filter button when no file loaded
    
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
        showStatus('No content to fit - load a DXF file first', 'warning');
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

function getDXFUnits() {
    // Extract unit information from DXF header
    const header = viewer?.parsedDxf?.header;
    
    if (!header) {
        return {
            unit: 'mm',
            name: 'Millimeters',
            scaleFactor: 1,
            measurementSystem: 'Unknown'
        };
    }
    
    // $INSUNITS - Drawing units for AutoCAD DesignCenter blocks
    const insunits = header.$INSUNITS || header.INSUNITS;
    
    // $MEASUREMENT - Measurement system (0=English, 1=Metric)
    const measurement = header.$MEASUREMENT || header.MEASUREMENT;
    
    // $LUNITS - Linear units format (1=Scientific, 2=Decimal, 3=Engineering, 4=Architectural, 5=Fractional)
    const lunits = header.$LUNITS || header.LUNITS;
    
    console.log('DXF Units Info - INSUNITS:', insunits, 'MEASUREMENT:', measurement, 'LUNITS:', lunits);
    
    // Map INSUNITS values to actual units
    const unitMap = {
        0: { unit: 'units', name: 'Unitless', scaleFactor: 1 },
        1: { unit: 'in', name: 'Inches', scaleFactor: 25.4 }, // 1 inch = 25.4 mm
        2: { unit: 'ft', name: 'Feet', scaleFactor: 304.8 }, // 1 foot = 304.8 mm
        3: { unit: 'mi', name: 'Miles', scaleFactor: 1609344 }, // 1 mile = 1609344 mm
        4: { unit: 'mm', name: 'Millimeters', scaleFactor: 1 },
        5: { unit: 'cm', name: 'Centimeters', scaleFactor: 0.1 }, // 1 cm = 0.1 mm
        6: { unit: 'm', name: 'Meters', scaleFactor: 0.001 }, // 1 m = 0.001 mm
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
    
    // Determine measurement system
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
                await loadDxfContent(fileName, fileResult.content, filePath);
            } else {
                showStatus('Error reading file: ' + fileResult.error, 'error');
            }
        }
    } catch (error) {
        showStatus('Error opening file: ' + error.message, 'error');
    }
}

// Drag and drop handlers
let dragCounter = 0;

viewerEl.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dropZone.classList.add('active');
});

viewerEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
        dropZone.classList.remove('active');
        dragCounter = 0;
    }
});

viewerEl.addEventListener('dragover', (e) => {
    e.preventDefault();
});

viewerEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropZone.classList.remove('active');
    
    const files = Array.from(e.dataTransfer.files);
    const dxfFile = files.find(file => file.name.toLowerCase().endsWith('.dxf'));
    
    if (dxfFile) {
        try {
            const content = await dxfFile.text();
            await loadDxfContent(dxfFile.name, content);
        } catch (error) {
            showStatus('Error reading dropped file: ' + error.message, 'error');
        }
    } else {
        showStatus('Please drop a DXF file', 'error');
    }
});

// Export layer mapping to text file
async function exportLayerMapping() {
    console.log('Export button clicked!');
    console.log('Viewer:', viewer);
    console.log('Current filename:', currentFilename);
    
    if (!viewer || !currentFilename) {
        console.log('Export failed - missing requirements');
        showStatus('No DXF file loaded', 'error');
        return;
    }

    try {
        console.log('Starting export process...');
        
        // Get layer information from the currently displayed layer table
        const layerRows = document.querySelectorAll('.layer-row');
        console.log('Layer rows found:', layerRows.length);
        
        if (layerRows.length === 0) {
            showStatus('No layers found to export', 'error');
            return;
        }

        // Extract layer data from the DOM
        const layers = [];
        layerRows.forEach((row, index) => {
            const checkbox = row.querySelector('.layer-checkbox');
            const layerName = row.querySelector('.layer-name');
            const layerColor = row.querySelector('.layer-color');
            const objectCount = row.querySelector('.layer-count');
            
            if (layerName && layerColor) {
                const colorStyle = layerColor.style.backgroundColor;
                // Extract RGB values and convert to hex
                const rgb = colorStyle.match(/\d+/g);
                let hexColor = '#ffffff';
                if (rgb && rgb.length >= 3) {
                    hexColor = '#' + parseInt(rgb[0]).toString(16).padStart(2, '0') +
                                    parseInt(rgb[1]).toString(16).padStart(2, '0') +
                                    parseInt(rgb[2]).toString(16).padStart(2, '0');
                }
                
                layers.push({
                    name: layerName.textContent.trim(),
                    displayName: layerName.textContent.trim(),
                    color: hexColor,
                    visible: checkbox ? checkbox.checked : true,
                    objectCount: objectCount ? objectCount.textContent.trim() : '0'
                });
            }
        });
        
        console.log('Extracted layers:', layers);

        // Show modal to get profile name
        showProfileModal(layers);
        
    } catch (error) {
        console.error('Export error:', error);
        showStatus('Export failed: ' + error.message, 'error');
    }
}

// Show profile name modal
function showProfileModal(layers) {
    const modal = document.getElementById('profileModal');
    const input = document.getElementById('profileNameInput');
    const saveBtn = document.getElementById('modalSave');
    const cancelBtn = document.getElementById('modalCancel');
    const closeBtn = document.getElementById('modalClose');
    
    // Set default profile name
    const defaultName = `${currentFilename.replace('.dxf', '')}_profile`;
    input.value = defaultName;
    
    // Show modal
    modal.classList.remove('hidden');
    input.focus();
    input.select();
    
    // Handle save
    const handleSave = async () => {
        const profileName = input.value.trim();
        if (!profileName) {
            input.focus();
            return;
        }
        
        // Hide modal
        modal.classList.add('hidden');
        
        // Generate CSV content with profile name as header
        let content = `# ${profileName}\n`;
        content += `Layer,Color,Lineweight\n`;

        layers.forEach(layer => {
            let color = '';
            let lineweight = '';
            
            // Try to get original DXF layer data for accurate color and lineweight
            if (viewer.parsedDxf?.tables?.layer?.layers) {
                const dxfLayer = viewer.parsedDxf.tables.layer.layers[layer.displayName];
                if (dxfLayer) {
                    // Get color from DXF layer (only if it's not the default)
                    if (dxfLayer.color && dxfLayer.color !== 7 && dxfLayer.color !== 'white') {
                        // Convert AutoCAD color index to hex if needed
                        if (typeof dxfLayer.color === 'number') {
                            // For now, just include the color index - could be converted to hex
                            color = `ACI-${dxfLayer.color}`;
                        } else {
                            color = dxfLayer.color;
                        }
                    }
                    
                    // Get lineweight from DXF layer
                    if (dxfLayer.lineweight !== undefined && dxfLayer.lineweight !== -1 && dxfLayer.lineweight !== 'BYLAYER') {
                        lineweight = dxfLayer.lineweight;
                    }
                }
            }
            
            // If no DXF color found, check if the displayed color looks intentional (not white/default)
            if (!color && layer.color !== '#ffffff' && layer.color !== '#000000') {
                color = layer.color;
            }
            
            content += `${layer.displayName},${color},${lineweight}\n`;
        });
        
        // Save the file
        const filename = `${profileName}.txt`;
        try {
            const result = await window.electronAPI.saveLayerMappingFixed(content, filename, currentFilePath);
            
            if (result.success) {
                showStatus(`Layer mapping saved as: ${profileName}`, 'success');
            } else if (result.error) {
                showStatus(`Export failed: ${result.error}`, 'error');
            }
        } catch (error) {
            showStatus(`Export failed: ${error.message}`, 'error');
        }
        
        // Remove event listeners
        cleanup();
    };
    
    // Handle cancel/close
    const handleCancel = () => {
        modal.classList.add('hidden');
        cleanup();
    };
    
    // Handle Enter key
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };
    
    // Cleanup function
    const cleanup = () => {
        saveBtn.removeEventListener('click', handleSave);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
        input.removeEventListener('keydown', handleKeyDown);
    };
    
    // Add event listeners
    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
    input.addEventListener('keydown', handleKeyDown);
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
                const name = layerName.textContent.trim();
                let color = '';
                
                console.log(`\n=== Processing Layer: ${name} ===`);
                
                // Method 1: Get DXF layer color data
                if (viewer.parsedDxf?.tables?.layer?.layers) {
                    const dxfLayer = viewer.parsedDxf.tables.layer.layers[name];
                    console.log('DXF Layer data:', dxfLayer);
                    
                    if (dxfLayer && dxfLayer.color !== undefined) {
                        if (typeof dxfLayer.color === 'number') {
                            // AutoCAD Color Index (ACI) - convert to RGB
                            const rgbColor = aciToRGB(dxfLayer.color);
                            if (rgbColor) {
                                color = rgbColor;
                                console.log(`Converted ACI ${dxfLayer.color} to RGB: ${color}`);
                            } else {
                                // Fallback for unknown ACI values
                                color = 'rgb(128,128,128)'; // Gray
                                console.log(`Unknown ACI ${dxfLayer.color}, using gray`);
                            }
                        } else if (typeof dxfLayer.color === 'string' && dxfLayer.color !== 'BYLAYER') {
                            // Check if it's already in RGB format or hex
                            if (dxfLayer.color.startsWith('rgb(')) {
                                color = dxfLayer.color;
                                console.log(`Found RGB color: ${color}`);
                            } else if (dxfLayer.color.startsWith('#')) {
                                const rgbColor = hexToRGB(dxfLayer.color);
                                color = rgbColor || 'rgb(128,128,128)';
                                console.log(`Converted hex ${dxfLayer.color} to RGB: ${color}`);
                            } else {
                                color = dxfLayer.color;
                                console.log(`Found string color: ${color}`);
                            }
                        }
                    }
                    
                    // Also check for other color properties that might exist
                    if (!color && dxfLayer) {
                        // Check for colorIndex, colorNumber, or similar properties
                        const colorProps = ['colorIndex', 'colorNumber', 'autocadColorIndex', 'aci'];
                        for (const prop of colorProps) {
                            if (dxfLayer[prop] !== undefined) {
                                color = dxfLayer[prop].toString();
                                console.log(`Found color via ${prop}: ${color}`);
                                break;
                            }
                        }
                    }
                }
                
                // Method 1.5: If still no color, check if the layer is using BYLAYER (color 7)
                if (!color && viewer.parsedDxf?.tables?.layer?.layers) {
                    const dxfLayer = viewer.parsedDxf.tables.layer.layers[name];
                    if (dxfLayer && (dxfLayer.color === 7 || dxfLayer.color === 'white' || !dxfLayer.color)) {
                        // Default to white/color 7 for layers without specific colors
                        color = '7';
                        console.log(`Using default color 7 for layer: ${name}`);
                    }
                }
                
                // Method 2: If no DXF color found, try to get from displayed color
                if (!color && layerColor) {
                    const layerColorStyle = layerColor.style.backgroundColor;
                    console.log('Layer color style:', layerColorStyle);
                    
                    // Try to extract the original numeric color from the layer data
                    if (viewer.parsedDxf?.tables?.layer?.layers) {
                        const dxfLayer = viewer.parsedDxf.tables.layer.layers[name];
                        if (dxfLayer) {
                            // Look for any numeric color value
                            if (typeof dxfLayer.color === 'number') {
                                color = dxfLayer.color.toString();
                                console.log(`Extracted numeric color: ${color}`);
                            }
                        }
                    }
                    
                    // If still no color, try to reverse-engineer from the displayed hex color
                    if (!color && layerColorStyle) {
                        // This is a fallback - try to get some color information
                        const rgbMatch = layerColorStyle.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                        if (rgbMatch) {
                            const r = parseInt(rgbMatch[1]);
                            const g = parseInt(rgbMatch[2]);
                            const b = parseInt(rgbMatch[3]);
                            
                            // Convert RGB to hex for reference
                            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                            
                            // Use RGB format directly instead of converting to ACI
                            color = `rgb(${r},${g},${b})`;
                            console.log(`Using RGB color: ${color} (hex: ${hex})`);
                        }
                    }
                    
                    // Final fallback: assign a default color if still empty
                    if (!color) {
                        color = 'rgb(255,255,255)'; // Default to white
                        console.log(`Using final fallback RGB color for layer: ${name}`);
                    }
                }
                
                // Method 3: Check if viewer has color information for this layer
                if (!color && viewer.layers) {
                    let viewerLayer = null;
                    
                    // Handle different possible data structures for viewer.layers
                    if (Array.isArray(viewer.layers)) {
                        viewerLayer = viewer.layers.find(l => l.name === name);
                    } else if (typeof viewer.layers === 'object') {
                        // If it's an object, try to access by name
                        viewerLayer = viewer.layers[name];
                    }
                    
                    if (viewerLayer && viewerLayer.color) {
                        // Convert viewer layer color to RGB format if needed
                        if (typeof viewerLayer.color === 'number') {
                            const rgbColor = aciToRGB(viewerLayer.color);
                            color = rgbColor || 'rgb(128,128,128)';
                            console.log(`Converted viewer ACI ${viewerLayer.color} to RGB: ${color}`);
                        } else if (typeof viewerLayer.color === 'string') {
                            if (viewerLayer.color.startsWith('rgb(')) {
                                color = viewerLayer.color;
                            } else if (viewerLayer.color.startsWith('#')) {
                                color = hexToRGB(viewerLayer.color) || 'rgb(128,128,128)';
                            } else {
                                // Try to parse as ACI number
                                const aciNum = parseInt(viewerLayer.color);
                                if (!isNaN(aciNum)) {
                                    color = aciToRGB(aciNum) || 'rgb(128,128,128)';
                                } else {
                                    color = 'rgb(128,128,128)'; // Default gray
                                }
                            }
                            console.log(`Processed viewer layer color: ${color}`);
                        }
                    }
                }
                
                console.log(`Final color for ${name}: "${color}"`);
                
                // Create rule for this layer
                if (name) {
                    rules.push({
                        id: ruleId++,
                        layerName: name,
                        color: color,
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
document.getElementById('clearBtn').addEventListener('click', clearViewer);
document.getElementById('fitBtn').addEventListener('click', fitToView);
lineTypesBtn.addEventListener('click', openLineTypesManager);
togglePanelBtn.addEventListener('click', toggleSidePanel);
exportLayersBtn.addEventListener('click', exportLayerMapping);
createImportFilterBtn.addEventListener('click', createImportFilterFromLayers);

// Settings tab button listeners
document.getElementById('importFiltersBtn').addEventListener('click', () => {
    window.electronAPI.openImportFiltersManager();
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
    });
});

// Electron IPC event listeners
window.electronAPI.onFileOpened((event, fileData) => {
    loadDxfContent(fileData.name, fileData.content);
});

window.electronAPI.onClearViewer(() => {
    clearViewer();
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

// Initialize when page loads
window.addEventListener('load', async () => {
    try {
        showStatus('DXF Viewer ready - Open a file to begin');
        // Initialize viewer but don't show error if it fails (will try again when loading file)
        await initViewer();
        
        // Initialize unit selector
        initializeUnitSelector();
        
        // Initialize scaling factor selector
        initializeScalingSelector();
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

