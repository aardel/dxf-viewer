import * as THREE from '../../node_modules/three/build/three.module.js';
import { DxfViewer } from '../../src/index.js';
import { PathOptimizer } from '../../src/PathOptimizer.js';
import { DinGenerator } from '../../src/DinGenerator.js';

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
        createImportFilterBtn.disabled = true; // Disable import filter button when layers are available
        return;
    }

    layerTableEl.innerHTML = '';
    createImportFilterBtn.disabled = false; // Enable import filter button when layers are available
    
    // Debug: Log all layers before filtering
    console.log('All layers before filtering:', layers);
    
    const filteredLayers = layers.filter(layer => {
        // Use the layer's own objectCount if available, otherwise fall back to getLayerObjectCount
        const objectCount = layer.objectCount !== undefined ? layer.objectCount : getLayerObjectCount(layer.name || '');
        console.log(`Layer ${layer.name}: objectCount = ${objectCount}`);
        return objectCount > 0;
    });
    
    console.log('Filtered layers:', filteredLayers);
    
    filteredLayers.forEach((layer, index) => {
        console.log('Processing layer:', layer);
        
        const layerRow = document.createElement('div');
        layerRow.className = `layer-row ${layer.importFilterApplied ? 'mapped' : ''}`;
        
        const layerName = layer.name || `Layer ${index}`;
        const displayName = layer.displayName || layerName;
        const color = layer.color || 0xffffff; // Default to white if no color
        const objectCount = layer.objectCount !== undefined ? layer.objectCount : getLayerObjectCount(layerName);
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
            
            // Get DXF color information for display - show ACI color number
            let aciColor = '';
            if (viewer.parsedDxf?.tables?.layer?.layers) {
                const dxfLayer = viewer.parsedDxf.tables.layer.layers[layerName];
                if (dxfLayer && dxfLayer.color !== undefined) {
                    if (typeof dxfLayer.color === 'number') {
                        aciColor = dxfLayer.color.toString();
                        dxfColorInfo = `ACI: ${aciColor}`;
                    } else {
                        dxfColorInfo = `ACI: ${layer.color || 'Unknown'}`;
                    }
                } else {
                    dxfColorInfo = `ACI: ${layer.color || 'Unknown'}`;
                }
            } else {
                dxfColorInfo = `ACI: ${layer.color || 'Unknown'}`;
            }
        }
        
        // Add import filter status indicator and line type info
        const filterStatus = layer.importFilterApplied ? 
            `<span class="filter-applied" title="Global filter applied">✓</span>` : 
            `<span class="filter-unapplied" title="No global filter rule">⚠</span>`;
        
        // Get proper line type name instead of cryptic ID
        const lineTypeName = layer.lineTypeId ? getLineTypeName(layer.lineTypeId) : '';
        const lineTypeInfo = lineTypeName ? 
            `<span class="line-type-info" title="Assigned Line Type: ${lineTypeName}">${lineTypeName}</span>` : '';
        
        // Add "Add to Global" button for unmapped layers
        const addToGlobalButton = !layer.importFilterApplied ? 
            `<button class="btn btn-small btn-primary add-to-global-btn" data-layer-name="${layerName}" data-layer-color="${aciToHex(layer.color)}" title="Add to Global Import Filter">Add to Global</button>` : '';
        
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
                <div class="layer-name ${layer.importFilterApplied ? 'mapped-layer' : ''}">
                    ${displayName}
                    ${filterStatus}
                    ${addToGlobalButton}
                </div>
                <div class="layer-details">
                    ${lineweightText ? `<span class="lineweight-info">${lineweightText}</span>` : ''}
                    ${layer.entityTypeSummary ? `<span class="entity-summary">${layer.entityTypeSummary}</span>` : ''}
                    <span class="object-count">${objectCount} objects</span>
                </div>
                ${lineTypeInfo ? `<div class="line-type-display">${lineTypeInfo}</div>` : ''}
                ${entityColorBreakdownHtml}
            </div>
        `;
        
        layerTableEl.appendChild(layerRow);
        
        // Add event listener for checkbox
        const checkbox = layerRow.querySelector('.layer-checkbox');
        checkbox.addEventListener('change', (e) => {
            const layerName = e.target.dataset.layerName;
            const isVisible = e.target.checked;
            
            // For color variants, toggle visibility by color instead of entire layer
            if (layer.isColorVariant && layer.color) {
                toggleColorVisibility(layer.color, isVisible);
            } else {
                // For regular layers, use the parent layer name
                const actualLayerName = layer.parentLayer || layerName;
                toggleLayerVisibility(actualLayerName, isVisible);
            }
        });
        
        // Add event listener for "Add to Global" button
        const addToGlobalBtn = layerRow.querySelector('.add-to-global-btn');
        if (addToGlobalBtn) {
            addToGlobalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                            const layerName = e.target.dataset.layerName;
            const layerColor = e.target.dataset.layerColor;
            // Convert hex back to ACI number for proper handling
            const aciColor = parseInt(layerColor.replace('#', ''), 16);
            showAddToGlobalModal(layerName, aciColor);
            });
        }
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
        116: '#E040FF', 117: '#FF40FF', 118: '#FF40E0', 119: '#FF40C0', 120: '#FF40A0',
        121: '#FF4080', 122: '#FF4060', 123: '#FF4040', 124: '#FF5040', 125: '#FF6040',
        126: '#FF7040', 127: '#FF8040', 128: '#FF9040', 129: '#FFA040', 130: '#FFB040',
        131: '#FFC040', 132: '#FFD040', 133: '#FFE040', 134: '#FFF040', 135: '#FFFF40',
        136: '#F0FF40', 137: '#E0FF40', 138: '#D0FF40', 139: '#C0FF40', 140: '#B0FF40',
        141: '#A0FF40', 142: '#90FF40', 143: '#80FF40', 144: '#70FF40', 145: '#60FF40',
        146: '#50FF40', 147: '#40FF40', 148: '#40FF50', 149: '#40FF60', 150: '#40FF70',
        151: '#40FF80', 152: '#40FF90', 153: '#40FFA0', 154: '#40FFB0', 155: '#40FFC0',
        156: '#40FFD0', 157: '#40FFE0', 158: '#40FFF0', 159: '#40FFFF', 160: '#40F0FF',
        161: '#40E0FF', 162: '#40D0FF', 163: '#40C0FF', 164: '#40B0FF', 165: '#40A0FF',
        166: '#4090FF', 167: '#4080FF', 168: '#4070FF', 169: '#4060FF', 170: '#4050FF',
        171: '#4040FF', 172: '#5040FF', 173: '#6040FF', 174: '#7040FF', 175: '#8040FF',
        176: '#9040FF', 177: '#A040FF', 178: '#B040FF', 179: '#C040FF', 180: '#D040FF',
        181: '#E040FF', 182: '#F040FF', 183: '#FF40FF', 184: '#FF40F0', 185: '#FF40E0',
        186: '#FF40D0', 187: '#FF40C0', 188: '#FF40B0', 189: '#FF40A0', 190: '#FF4090',
        191: '#FF4080', 192: '#FF4070', 193: '#FF4060', 194: '#FF4050', 195: '#FF4040',
        196: '#FF4540', 197: '#FF4A40', 198: '#FF4F40', 199: '#FF5440', 200: '#FF5940',
        201: '#FF5E40', 202: '#FF6340', 203: '#FF6840', 204: '#FF6D40', 205: '#FF7240',
        206: '#FF7740', 207: '#FF7C40', 208: '#FF8140', 209: '#FF8640', 210: '#FF8B40',
        211: '#FF9040', 212: '#FF9540', 213: '#FF9A40', 214: '#FF9F40', 215: '#FFA440',
        216: '#FFA940', 217: '#FFAE40', 218: '#FFB340', 219: '#FFB840', 220: '#FFBD40',
        221: '#FFC240', 222: '#FFC740', 223: '#FFCC40', 224: '#FFD140', 225: '#FFD640',
        226: '#FFDB40', 227: '#FFE040', 228: '#FFE540', 229: '#FFEA40', 230: '#FFEF40',
        231: '#FFF440', 232: '#FFF940', 233: '#FFFF40', 234: '#FAFF40', 235: '#F5FF40',
        236: '#F0FF40', 237: '#EBFF40', 238: '#E6FF40', 239: '#E1FF40', 240: '#DCFF40',
        241: '#D7FF40', 242: '#D2FF40', 243: '#CDFF40', 244: '#C8FF40', 245: '#C3FF40',
        246: '#BEFF40', 247: '#B9FF40', 248: '#B4FF40', 249: '#AFFF40', 250: '#AAFF40',
        251: '#A5FF40', 252: '#A0FF40', 253: '#9BFF40', 254: '#96FF40', 255: '#0000FF',
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
    
    return aciToHexMap[aci] || '#FFFFFF'; // Default to white if not found
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

function toggleColorVisibility(color, isVisible) {
    if (!viewer || !viewer.scene) return;
    
    console.log(`Toggling color visibility: ${color}, isVisible: ${isVisible}`);
    
    // Convert hex color to RGB for comparison
    const hexColor = color.startsWith('#') ? color : `#${color}`;
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
            
            // Also add default layer if it exists and has objects, but only if it's not already in the layers
            if (viewer.defaultLayer && viewer.defaultLayer.objects.length > 0) {
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
                            continue;
                        }
                        
                        // Analyze each entity in this layer
                        layerEntities.forEach(entity => {
                            // Track entity types
                                    const entityType = entity.type || 'UNKNOWN';
                            entityTypes.set(entityType, (entityTypes.get(entityType) || 0) + 1);
                            
                            // Extract color information
                            if (entity.color !== undefined && entity.color !== null) {
                                // Convert ACI color index to hex
                                const colorHex = entity.color.toString(16).padStart(6, '0');
                                if (!layerEntityColors.includes(colorHex)) {
                                    layerEntityColors.push(colorHex);
                                }
                            }
                        });
                            
                            // Create entity type summary
                        entityTypeSummary = Array.from(entityTypes.entries())
                            .map(([type, count]) => `${type}(${count})`)
                            .join(', ');
                        
                        console.log(`Layer ${layerName} - Entity colors found: [${layerEntityColors.join(', ')}]`);
                            console.log(`Layer ${layerName} - Entity types: ${entityTypeSummary}`);
                            console.log(`=== END LAYER "${layerName}" ANALYSIS ===`);
                    }
                    
                    // Create separate layer entries for each color found
                    if (layerEntityColors.length > 1) {
                        console.log(`Creating separate layer entries for multi-color layer "${layerName}" with colors: [${layerEntityColors.map(c => parseInt(c, 16))}]`);
                        
                        layerEntityColors.forEach((colorHex, index) => {
                            const colorInt = parseInt(colorHex, 16);
                            const colorVariantName = `${layerName}_${colorHex.toUpperCase()}`;
                            
                            // Count entities with this specific color
                            const colorEntities = viewer.parsedDxf.entities.filter(e => 
                                e.layer === layerName && 
                                e.color !== undefined && 
                                e.color !== null && 
                                e.color.toString(16).padStart(6, '0') === colorHex
                            );
                        
                        dxfLayers.push({
                                name: colorVariantName,
                                displayName: `${layerName} (#${colorHex.toUpperCase()})`,
                                originalLayerName: layerName,
                                color: colorInt,
                                colorHex: aciToHex(colorInt),
                                objectCount: colorEntities.length,
                                entityCount: colorEntities.length,
                                isColorVariant: true,
                                parentLayer: layerName,
                                entityTypes: entityTypeSummary
                            });
                            
                            console.log(`Created color variant: ${colorVariantName} (#${colorHex.toUpperCase()}) with ${colorEntities.length} entities`);
                        });
                        
                        console.log(`Multi-color layer "${layerName}" split into ${layerEntityColors.length} color variants`);
                        // Skip creating the original layer entry for multi-color layers
                        continue; // Continue to next layer in the for loop
                    } else if (layerEntityColors.length === 1) {
                        // Single color layer
                        const colorInt = parseInt(layerEntityColors[0], 16);
                        const layerEntities = viewer.parsedDxf.entities.filter(e => e.layer === layerName);
                        
                            dxfLayers.push({
                            name: layerName,
                            displayName: layerName,
                            color: colorInt,
                            colorHex: `#${layerEntityColors[0].toUpperCase()}`,
                            objectCount: layerEntities.length,
                            entityCount: layerEntities.length,
                            isColorVariant: false,
                            entityTypes: entityTypeSummary
                        });
                } else {
                        // No color information, use default
                        const layerEntities = viewer.parsedDxf.entities.filter(e => e.layer === layerName);
                        dxfLayers.push({
                                name: layerName,
                            displayName: layerName,
                            color: 0xffffff, // Default white
                            colorHex: '#FFFFFF',
                            objectCount: layerEntities.length,
                            entityCount: layerEntities.length,
                            isColorVariant: false,
                            entityTypes: entityTypeSummary
                        });
                    }
                }
            }
            
            // Prioritize dxfLayers (multi-color variants) over layersFromMap for finalLayers
            console.log('Layer prioritization - dxfLayers:', dxfLayers.length, 'layers:', layersFromMap.length);
            console.log('dxfLayers before deduplication:', dxfLayers.map(l => l.name + '_' + l.color));
            // Deduplicate dxfLayers by name+color to avoid double layers
            if (dxfLayers.length > 0) {
                const seen = new Set();
                dxfLayers = dxfLayers.filter(layer => {
                    const key = layer.name + '_' + layer.color;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                console.log('dxfLayers after deduplication:', dxfLayers.map(l => l.name + '_' + l.color));
            }
            // Use dxfLayers if available, otherwise fall back to layersFromMap
            let finalLayers = dxfLayers.length > 0 ? dxfLayers : layersFromMap;
            
            // Ensure we always have some layers to display
            if (finalLayers.length === 0) {
                console.log('No layers found, creating default layer');
                finalLayers = [{
                    name: 'Layer 1',
                    displayName: 'Layer 1',
                    color: 0xffffff,
                    colorHex: '#FFFFFF',
                    objectCount: 0,
                    entityCount: 0,
                    isColorVariant: false
                }];
            }
            
            console.log('DXF layers found:', finalLayers);
            console.log('Final layers to display:', finalLayers);
            console.log('Final layers names:', finalLayers.map(l => l.name + '_' + l.color));
            
            // Store layers globally for other functions to access
            window.currentDxfLayers = finalLayers;
            
            // Simplified approach - no conflict detection on loading
            
            // Apply global import filter to the layers
            try {
                console.log('Applying global import filter to layers...');
                console.log('Layers being sent to filter:', finalLayers.map(l => l.name + '_' + l.color));
                const filterResult = await window.electronAPI.applyGlobalImportFilter(finalLayers);
                
                if (filterResult.success) {
                    const { appliedLayers, unmatchedLayers, totalLayers } = filterResult.data;
                    
                    console.log(`Global import filter applied: ${appliedLayers.length} matched, ${unmatchedLayers.length} unmatched`);
                    
                    // Show status about filter application
                    if (appliedLayers.length > 0) {
                        showStatus(`Applied import filter to ${appliedLayers.length}/${totalLayers} layers`, 'success');
                    }
                    
                    if (unmatchedLayers.length > 0) {
                        showStatus(`${unmatchedLayers.length} layers need import filter rules - use "Add to Global" buttons to create rules`, 'info');
                    }
                    
                                // Use the applied layers (which include lineTypeId from the filter)
            finalLayers = appliedLayers.concat(unmatchedLayers);
            
            // Store the processed layers with lineTypeId for DIN generation
            window.processedLayersWithLineTypes = finalLayers;
                        } else {
                    console.error('Failed to apply global import filter:', filterResult.error);
                    showStatus('Failed to apply import filter', 'error');
                }
            } catch (error) {
                console.error('Error applying global import filter:', error);
                showStatus('Error applying import filter', 'error');
            }
            
            // Store the layer data globally for import filter creation
            window.currentLayerData = finalLayers;
            
            // Populate the layer table with resolved layers
            populateLayerTable(finalLayers);
            
            // Update drawing dimensions
            updateDrawingDimensions();
            
            // Fit to view
            fitToView();
            
            showStatus(`Successfully loaded: ${filename} (${finalLayers.length} layers)`, 'success');
            
        } catch (error) {
            console.error('Error loading DXF:', error);
            showStatus('Error loading DXF: ' + error.message, 'error');
        }
        
    } catch (error) {
        console.error('Error in loadDxfContent:', error);
        showStatus('Error: ' + error.message, 'error');
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
document.getElementById('clearBtn').addEventListener('click', clearViewer);
document.getElementById('fitBtn').addEventListener('click', fitToView);
lineTypesBtn.addEventListener('click', openLineTypesManager);
togglePanelBtn.addEventListener('click', toggleSidePanel);
createImportFilterBtn.addEventListener('click', createImportFilterFromLayers);

// Settings tab button listeners
document.getElementById('importFiltersBtn').addEventListener('click', () => {
    window.electronAPI.openImportFiltersManager();
});
    
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
        
        // Initialize postprocessor UI
        initializePostprocessorUI();
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

// Get default configuration object
function getDefaultConfiguration() {
    return {
        profileInfo: {
            name: 'Default Configuration',
            description: 'Default fallback configuration',
            version: '1.0',
            created: new Date().toISOString().split('T')[0],
            author: 'System'
        },
        tools: getCurrentToolSet(),
        toolSettings: {
            speeds: { engraving: 1200, cutting: 800, perforation: 600 },
            toolChange: { time: 5.0, command: 'M6' },
            validation: { validateWidths: true, warnOnMissingTools: true }
        },
        lineTypeMappings: {
            customMappings: {
                cutting: 'T2', engraving: 'T1', perforating: 'T3',
                scoring: 'T1', marking: 'T1', construction: 'none'
            }
        },
        header: {
            template: '{filename} / - size: {width} x {height} / {timestamp}',
            includeFileInfo: true, includeBounds: true, includeSetCount: true,
            includeProgramStart: true, programStart: '%1',
            setupCommands: ['G90', 'G60 X0', 'G0 X0 Y0']
        },
        optimization: {
            primaryStrategy: 'tool_grouped',
            withinGroupOptimization: 'closest_path',
            includeComments: true, validateWidths: true, respectManualBreaks: true
        },
        gcode: {
            rapidMove: 'G0', linearMove: 'G1', cwArc: 'G2', ccwArc: 'G3',
            homeCommand: 'G0 X0 Y0', programEnd: 'M30'
        },
        laser: {
            laserOn: 'M14', laserOff: 'M15', toolChange: 'M6',
            comments: {
                enabled: true, onCommand: 'LASER ON', offCommand: 'LASER OFF',
                toolChange: 'Tool change: {tool_name} ({tool_id})'
            }
        },
        lineNumbers: {
            enabled: true, startNumber: 10, increment: 10, format: 'N{number}'
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
    postprocessorProfileSelect?.addEventListener('change', function() {
        const selectedProfile = this.value;
        if (selectedProfile && selectedProfile !== 'custom') {
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
    
    // Profile management buttons
    const createProfileBtn = document.getElementById('createProfileBtn');
    const copyProfileBtn = document.getElementById('copyProfileBtn');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const refreshProfileBtn = document.getElementById('refreshProfileBtn');
    const deleteProfileBtn = document.getElementById('deleteProfileBtn');
    
    createProfileBtn?.addEventListener('click', () => {
        createNewProfile();
    });
    
    copyProfileBtn?.addEventListener('click', () => {
        copyCurrentProfile();
    });
    
    editProfileBtn?.addEventListener('click', () => {
        editCurrentProfile();
    });
    
    refreshProfileBtn?.addEventListener('click', () => {
        refreshProfileDropdown();
    });
    
    deleteProfileBtn?.addEventListener('click', () => {
        deleteCurrentProfile();
    });
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
        
        // Restore previous selection if it still exists, otherwise select first profile
        if (currentSelection && select.querySelector(`option[value="${currentSelection}"]`)) {
            select.value = currentSelection;
        } else if (profiles.length > 0) {
            select.value = profiles[0].filename;
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
            // Load first available profile
            const firstProfile = profiles[0];
            const select = document.getElementById('postprocessorProfile');
            if (select) {
                select.value = firstProfile.filename;
            }
            await loadXmlProfileConfiguration(firstProfile.filename);
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
    
    previewDinBtn?.addEventListener('click', async () => {
        await previewDinFile();
    });
    
    generateDinBtn?.addEventListener('click', async () => {
        await generateDinFile();
    });
}

// Preview DIN file content
async function previewDinFile() {
    try {
        if (!viewer || !viewer.scene || !currentPostprocessorConfig) {
            showStatus('Load a DXF file and configure postprocessor first', 'warning');
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

// Generate and save DIN file
async function generateDinFile() {
    try {
        if (!viewer || !viewer.scene || !currentPostprocessorConfig) {
            showStatus('Load a DXF file and configure postprocessor first', 'warning');
            return;
        }

        showStatus('Generating DIN file...', 'info');

        // Extract entities from viewer
        const entities = extractEntitiesFromViewer();
        if (entities.length === 0) {
            showStatus('No entities found to process', 'warning');
            return;
        }

        // Get current settings
        const settings = getCurrentOptimizationSettings();
        
        // Generate DIN content
        const metadata = getFileMetadata();
        console.log('About to generate DIN with:', {
            entitiesCount: entities.length,
            config: currentPostprocessorConfig,
            metadata: metadata
        });
        const dinContent = dinGenerator.generateDin(entities, currentPostprocessorConfig, metadata);
        console.log('DIN generation completed, content length:', dinContent.length);
        
        // Validate DIN content
        const validation = dinGenerator.validateDin(dinContent);
        if (!validation.valid) {
            showStatus(`DIN validation failed: ${validation.issues.join(', ')}`, 'error');
            return;
        }

        // Save file using Electron API
        const defaultFilename = currentFilename ? 
            currentFilename.replace(/\.[^/.]+$/, '.din') : 'output.din';
        
        await saveDinFile(dinContent, defaultFilename);
        
        showStatus(`Generated DIN file with ${validation.stats.totalLines} lines`, 'success');

    } catch (error) {
        console.error('Error generating DIN file:', error);
        showStatus(`Failed to generate DIN file: ${error.message}`, 'error');
    }
}

// Extract entities from the DXF viewer
function extractEntitiesFromViewer() {
    const entities = [];
    
    console.log('extractEntitiesFromViewer called');
    console.log('viewer:', viewer);
    console.log('viewer.parsedDxf:', viewer?.parsedDxf);
    console.log('viewer.parsedDxf.entities:', viewer?.parsedDxf?.entities);
    
    if (!viewer || !viewer.parsedDxf || !viewer.parsedDxf.entities) {
        console.warn('No DXF data available for entity extraction');
        return entities;
    }
    
    // Extract actual DXF entities from the viewer
    console.log('Processing', viewer.parsedDxf.entities.length, 'entities');
    viewer.parsedDxf.entities.forEach((entity, index) => {
        try {
            console.log(`Processing entity ${index}:`, entity);
            // Get the layer object to find the lineTypeId
            const layerName = entity.layer || '0';
            
            // First try to get from processed layers (with import filter applied)
            let lineTypeId = null;
            if (window.processedLayersWithLineTypes) {
                const processedLayer = window.processedLayersWithLineTypes.find(l => l.name === layerName);
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
            
            console.log(`Entity ${index} - layer: ${layerName}, final lineTypeId: ${lineTypeId}`);
            
            const processedEntity = {
                id: `entity_${index}`,
                type: entity.type,
                layer: layerName,
                color: entity.color,
                colorIndex: entity.colorIndex,
                lineweight: entity.lineweight,
                lineTypeId: lineTypeId, // Add line type ID from layer
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

// Get current optimization settings from UI
function getCurrentOptimizationSettings() {
    return {
        primaryStrategy: document.getElementById('primaryStrategy')?.value || 'tool_grouped',
        withinGroupOptimization: document.getElementById('withinGroupOptimization')?.value || 'closest_path',
        respectPriority: document.getElementById('respectManualBreaks')?.checked !== false,
        includeComments: document.getElementById('includeComments')?.checked !== false,
        validateWidths: document.getElementById('validateWidths')?.checked !== false
    };
}

// Get file metadata for DIN header
function getFileMetadata() {
    const dimensions = getDrawingDimensions();
    
    return {
        filename: currentFilename || 'unknown.dxf',
        width: dimensions?.width || 0,
        height: dimensions?.height || 0,
        entityCount: extractEntitiesFromViewer().length,
        bounds: {
            minX: 0,
            minY: 0,
            maxX: dimensions?.width || 0,
            maxY: dimensions?.height || 0
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
async function saveDinFile(content, defaultFilename) {
    try {
        // Use existing layer mapping save functionality as template
        await window.electronAPI.saveLayerMappingFixed(content, defaultFilename, currentFilePath);
        
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
                enabled: document.getElementById('includeComments')?.checked !== false,
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
        // Load tools from current postprocessor configuration
        const currentTools = await getCurrentToolSet();
        
        const grid = document.getElementById('toolsManagerGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // Load all current tools dynamically
        Object.entries(currentTools).forEach(([toolId, tool]) => {
            const toolCard = createEditableToolCard(toolId, tool);
            grid.appendChild(toolCard);
        });
        
    } catch (error) {
        console.error('Error loading tools into manager:', error);
        showStatus('Failed to load tools for editing', 'error');
    }
}

// Get current tool set from configuration or defaults
async function getCurrentToolSet() {
    // First try to get from current postprocessor config
    if (currentPostprocessorConfig?.tools) {
        return currentPostprocessorConfig.tools;
    }
    
    // Try to load from mtl.xml profile
    try {
        const tools = await window.electronAPI.getToolsFromProfile('mtl.xml');
        if (tools && tools.success && tools.data) {
            // Convert array format to object format for compatibility
            const toolsObject = {};
            tools.data.forEach(tool => {
                toolsObject[tool.id] = {
                    name: tool.name,
                    width: tool.width,
                    description: tool.description,
                    hCode: tool.hCode,
                    type: tool.type || 'cut'
                };
            });
            return toolsObject;
        }
    } catch (error) {
        console.error('Error loading tools from profile:', error);
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
    
    // Get layers from loaded DXF file
    const dxfLayers = extractDxfLayers();
    
    if (dxfLayers.length === 0) {
        layersList.innerHTML = '<div style="color: #888; text-align: center; padding: 2rem;">No DXF file loaded<br><small>Load a DXF file first</small></div>';
        return;
    }
    
    dxfLayers.forEach(layer => {
        const layerCard = document.createElement('div');
        layerCard.className = 'mapping-item dxf-layer';
        layerCard.dataset.layer = layer.name;
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

// Extract DXF layers from loaded file
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
    
    // Remove existing mapping for this layer
    currentPostprocessorConfig.mappingWorkflow.layerToLineType = 
        currentPostprocessorConfig.mappingWorkflow.layerToLineType.filter(m => m.layer !== layerName);
    
    // Add new mapping
    currentPostprocessorConfig.mappingWorkflow.layerToLineType.push({
        layer: layerName,
        lineType: lineTypeName
    });
    
    // Update visual indicators
    updateMappingVisuals();
    
    showStatus(`Mapped layer "${layerName}" to line type "${lineTypeName}"`, 'success');
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
        currentPostprocessorConfig.mappingWorkflow.layerToLineType = 
            currentPostprocessorConfig.mappingWorkflow.layerToLineType.filter(m => m.layer !== layerName);
    });
    
    // Add new mappings for all layers to the same line type
    layerNames.forEach(layerName => {
        currentPostprocessorConfig.mappingWorkflow.layerToLineType.push({
            layer: layerName,
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
    if (!currentPostprocessorConfig?.mappingWorkflow) return;
    
    // Clear all existing mapping displays
    clearMappingVisuals();
    
    const layerMappings = currentPostprocessorConfig.mappingWorkflow.layerToLineType || [];
    const toolMappings = currentPostprocessorConfig.mappingWorkflow.lineTypeToTool || [];
    
    // Group layers by line type (many-to-one support)
    const lineTypeToLayers = {};
    layerMappings.forEach(mapping => {
        if (!lineTypeToLayers[mapping.lineType]) {
            lineTypeToLayers[mapping.lineType] = [];
        }
        lineTypeToLayers[mapping.lineType].push(mapping.layer);
    });
    
    // Update layer visual indicators
    layerMappings.forEach(mapping => {
        const layerEl = document.querySelector(`[data-layer="${mapping.layer}"]`);
        if (layerEl) {
            const mappedIndicator = layerEl.querySelector('.mapped-indicator');
            const unmappedIndicator = layerEl.querySelector('.unmapped-indicator');
            const mappedToText = layerEl.querySelector('.mapped-to-text');
            
            if (mappedIndicator && unmappedIndicator && mappedToText) {
                mappedIndicator.style.display = 'block';
                unmappedIndicator.style.display = 'none';
                mappedToText.textContent = mapping.lineType;
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
    modal.innerHTML = `
        <div class="modal-content" style="width: 95%; max-width: 1000px; height: 90vh;">
            <div class="modal-header">
                <h3>DIN File Header Configuration</h3>
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
                        <label>
                            <input type="checkbox" id="modalEnableScaling" checked>
                            Include scaling header for inch machine
                        </label>
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
                        <div class="checkbox-group">
                            <label><input type="checkbox" id="modalIncludeFileInfo" checked> File information</label>
                            <label><input type="checkbox" id="modalIncludeBounds" checked> Drawing bounds</label>
                            <label><input type="checkbox" id="modalIncludeSetCount" checked> Operation count</label>
                            <label><input type="checkbox" id="modalIncludeProgramStart" checked> Program start marker (%1)</label>
                        </div>
                    </div>
                    
                    <!-- Setup Commands -->
                    <div class="setting-group">
                        <h5>Initial Setup Commands</h5>
                        <textarea id="modalSetupCommands" class="form-textarea" rows="4">G90
G60 X0
G0 X0 Y0</textarea>
                    </div>
                </div>
                
                <!-- Header Preview -->
                <div>
                    <h4 style="color: #4a90e2; margin-bottom: 1rem;">Live Preview</h4>
                    <div id="modalHeaderPreview" class="header-preview" style="height: 400px; max-height: none;">
                        <strong>Header Preview:</strong><br>
                        Loading...
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
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                <button class="btn btn-primary" id="saveHeaderConfigBtn">Save Configuration</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load current header configuration
    loadModalHeaderConfiguration();
    
    // Add event listeners for live preview
    const inputs = ['modalMachineType', 'modalHeaderTemplate', 'modalScalingParameter', 'modalScaleCommand', 'modalSetupCommands'];
    inputs.forEach(id => {
        const element = modal.querySelector(`#${id}`);
        if (element) {
            element.addEventListener('input', updateModalHeaderPreview);
            element.addEventListener('change', updateModalHeaderPreview);
        }
    });
    
    const checkboxes = ['modalEnableScaling', 'modalIncludeFileInfo', 'modalIncludeBounds', 'modalIncludeSetCount', 'modalIncludeProgramStart'];
    checkboxes.forEach(id => {
        const element = modal.querySelector(`#${id}`);
        if (element) {
            element.addEventListener('change', updateModalHeaderPreview);
        }
    });
    
    // Machine type change handler
    modal.querySelector('#modalMachineType').addEventListener('change', function() {
        const scalingSettings = modal.querySelector('#modalScalingSettings');
        scalingSettings.style.display = this.value === 'inch_with_scaling' ? 'block' : 'none';
        updateModalHeaderPreview();
    });
    
    modal.querySelector('#saveHeaderConfigBtn').addEventListener('click', saveHeaderConfiguration);
    
    // Initial preview update - delay to ensure DOM is ready
    setTimeout(() => {
        updateModalHeaderPreview();
    }, 100);
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


function loadModalHeaderConfiguration() {
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
    const modal = document.querySelector('.modal');
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
        
        const modal = document.querySelector('.modal');
        if (!modal) {
            showStatus('Modal not found', 'error');
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
        
        // Update current configuration
        if (!currentPostprocessorConfig.header) {
            currentPostprocessorConfig.header = {};
        }
        
        if (!currentPostprocessorConfig.units) {
            currentPostprocessorConfig.units = {};
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
        
        // Save to XML profile
        const currentProfile = getCurrentProfileFilename();
        if (currentProfile) {
            await saveXmlProfileConfiguration(currentProfile);
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
    const modal = document.querySelector('.modal');
    if (!modal) return;
    
    const previewEl = modal.querySelector('#modalHeaderPreview');
    const statsEl = modal.querySelector('#modalHeaderStats');
    
    if (!previewEl) return;
    
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
        
        // Generate preview header
        const headerLines = [];
        let commentLines = 0;
        let commandLines = 0;
        
        // Program start
        if (includeProgramStart) {
            headerLines.push('%1');
            commandLines++;
        }
        
        // File info
        if (includeFileInfo) {
            const template = headerTemplate
                .replace('{filename}', 'sample.dxf')
                .replace('{width}', '100.0')
                .replace('{height}', '75.0')
                .replace('{timestamp}', new Date().toLocaleString());
            headerLines.push(`{ ${template}`);
            commentLines++;
        }
        
        // Bounds
        if (includeBounds) {
            headerLines.push('{ BOUNDS: X0.0 Y0.0 to X100.0 Y75.0');
            commentLines++;
        }
        
        // Set count
        if (includeSetCount) {
            headerLines.push('{ OPERATIONS: 25');
            commentLines++;
        }
        
        // Scaling for inch machines
        if (machineType === 'inch_with_scaling' && enableScaling) {
            headerLines.push(scalingParameter);
            headerLines.push(scaleCommand);
            headerLines.push('{ Metric scaling for inch machine');
            commandLines += 2;
            commentLines++;
        }
        
        // Setup commands
        if (setupCommands.trim()) {
            const commands = setupCommands.split('\n').filter(cmd => cmd.trim());
            headerLines.push(...commands);
            commandLines += commands.length;
        }
        
        // Display preview
        previewEl.innerHTML = `<strong>Header Preview:</strong><br><pre style="color: #ddd; margin-top: 0.5rem;">${headerLines.join('\n')}</pre>`;
        
        // Update statistics
        if (statsEl) {
            const totalLines = headerLines.length;
            const estimatedSize = headerLines.join('\n').length;
            
            const statsLinesEl = modal.querySelector('#modalStatsLines');
            const statsCommentsEl = modal.querySelector('#modalStatsComments');
            const statsCommandsEl = modal.querySelector('#modalStatsCommands');
            const statsSizeEl = modal.querySelector('#modalStatsSize');
            
            if (statsLinesEl) statsLinesEl.textContent = totalLines;
            if (statsCommentsEl) statsCommentsEl.textContent = commentLines;
            if (statsCommandsEl) statsCommandsEl.textContent = commandLines;
            if (statsSizeEl) statsSizeEl.textContent = estimatedSize;
        }
        
    } catch (error) {
        console.error('Error updating modal header preview:', error);
        previewEl.innerHTML = '<span style="color: #ff6b6b;">Error generating preview</span>';
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
                                    <div class="layer-color">Color: ACI ${layerColor}</div>
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
                
                const result = await window.electronAPI.addRuleToGlobalImportFilter(ruleData);
                
                if (result.success) {
                    showStatus(`Added ${layerName} to global import filter`, 'success');
                    
                    // Refresh the layer table to show the new mapping
                    if (window.currentDxfLayers) {
                        const updatedLayers = await window.electronAPI.applyGlobalImportFilter(window.currentDxfLayers);
                        if (updatedLayers.success) {
                            const { appliedLayers, unmatchedLayers } = updatedLayers.data;
                            populateLayerTable(appliedLayers.concat(unmatchedLayers));
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

