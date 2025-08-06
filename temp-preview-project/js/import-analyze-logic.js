// js/import-analyze-logic.js

(function() {
  const fileInput = document.getElementById('importReportFileInput');
  const fileArea = document.getElementById('dxfFileArea');
  const fileInfo = document.getElementById('dxfFileInfo');
  const fileName = document.getElementById('dxfFileName');
  const fileSize = document.getElementById('dxfFileSize');
  const reportContainer = document.getElementById('importReportContainer');
  const svgDxfViewerDiv = document.getElementById('svgDxfViewer');

  console.log('DXF Import elements found:', {
    fileInput: !!fileInput,
    fileArea: !!fileArea,
    fileInfo: !!fileInfo,
    fileName: !!fileName,
    fileSize: !!fileSize,
    reportContainer: !!reportContainer,
    svgDxfViewerDiv: !!svgDxfViewerDiv
  });

  // Handle file area click
  if (fileArea && fileInput) {
    fileArea.onclick = function() {
      console.log('File area clicked, opening file dialog');
      fileInput.click();
    };
  } else {
    console.error('Missing elements:', { fileArea: !!fileArea, fileInput: !!fileInput });
  }

  // Handle drag and drop
  if (fileArea) {
    fileArea.addEventListener('dragover', function(e) {
      e.preventDefault();
      fileArea.style.backgroundColor = 'var(--gray-100)';
    });

    fileArea.addEventListener('dragleave', function(e) {
      e.preventDefault();
      fileArea.style.backgroundColor = '';
    });

    fileArea.addEventListener('drop', function(e) {
      e.preventDefault();
      fileArea.style.backgroundColor = '';
      console.log('File dropped');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        console.log('Dropped file:', file.name);
        if (file.name.toLowerCase().endsWith('.dxf') || file.name.toLowerCase().endsWith('.dwg')) {
          // Manually set the file to the input
          if (fileInput) {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
          }
          handleFileSelection(file);
        } else {
          alert('Please select a DXF or DWG file.');
        }
      }
    });
  }

  // Handle file input change
  if (fileInput) {
    fileInput.onchange = function() {
      console.log('File input changed, files:', fileInput.files);
      const file = fileInput.files[0];
      if (file) {
        console.log('Processing file:', file.name, file.size);
        handleFileSelection(file);
      }
    };
  }

  function handleFileSelection(file) {
    console.log('handleFileSelection called with:', file);
    
    if (!fileName || !fileSize || !fileInfo || !svgDxfViewerDiv) {
      console.error('Missing required elements for file handling');
      return;
    }
    
    // Show file info
    fileName.textContent = file.name;
    fileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
    fileInfo.style.display = 'block';

    // Process the file immediately
    svgDxfViewerDiv.innerHTML = '<span style="color:#888;">Loading...</span>';
    console.log('Set loading message, starting file processing');
    
    // Parse as text for report
    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result;
      // Use DxfParser for parsing
      let dxf;
      try {
        if (typeof window.DxfParser.parseString !== 'function') {
          throw new Error('DXF parser is not loaded correctly: window.DxfParser.parseString is not a function. Please check your dxf-parser-browser.js bundle.');
        }
        dxf = window.DxfParser.parseString(text);
      } catch (err) {
        svgDxfViewerDiv.innerHTML = '<span style="color:red;">Error parsing DXF: ' + (err && err.message ? err.message : err) + '</span>';
        return;
      }
      // Entity report logic (as before, but using dxf.entities)
      const combos = {};
      const knownEntities = new Set([
        'LINE', 'POLYLINE', 'LWPOLYLINE', 'ARC', 'CIRCLE', 'SPLINE', 'ELLIPSE',
        'TEXT', 'MTEXT', 'POINT', 'HATCH', 'SOLID', 'INSERT', 'IMAGE', 'DIMENSION', 'LEADER', 'MLINE', '3DFACE', 'VERTEX', 'SEQEND'
      ]);
      console.log('DXF entities found:', dxf.entities);
      console.log('Total entities:', dxf.entities ? dxf.entities.length : 0);
      if (dxf.entities && Array.isArray(dxf.entities)) {
        dxf.entities.forEach(entity => {
          const type = entity.type || '(unknown)';
          // Show all entities found, not just known ones
          const color = entity.color || entity.colorNumber || '(none)';
          const layer = entity.layer || '(none)';
          const linetype = entity.lineType || '(none)';
          const key = `${type} | color: ${color} | layer: ${layer} | linetype: ${linetype}`;
          combos[key] = (combos[key] || 0) + 1;
        });
      }
      // Build HTML report with collapsible controls
      let html = `<div style="margin-bottom: 12px; color: #212529;">
        <div style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;" onclick="toggleEntityControls()">
          <span id="entityControlsToggle" style="font-size: 12px; transition: transform 0.2s;">▼</span>
          <strong style="color: #495057; font-size: 14px;">Entity Visibility Controls</strong>
          <span style="color: #666; font-size: 12px; margin-left: auto;">Click to expand/collapse</span>
        </div>
        <div id="entityControlsContent" style="overflow-x:auto; margin-top: 8px; display: block;">
          <table class="entity-report-table" style="width:100%; border-collapse:collapse; font-size:12px; border: 1px solid #dee2e6;">
            <thead>
              <tr style="background:#e9ecef; color:#495057; font-weight:bold;">
                <th style="padding:6px 8px; border: 1px solid #dee2e6; text-align: center; font-size: 11px;">Show</th>
                <th style="padding:6px 8px; border: 1px solid #dee2e6; text-align: left; font-size: 11px;">Color</th>
                <th style="padding:6px 8px; border: 1px solid #dee2e6; text-align: left; font-size: 11px;">Layer</th>
                <th style="padding:6px 8px; border: 1px solid #dee2e6; text-align: left; font-size: 11px;">Linetype</th>
                <th style="padding:6px 8px; border: 1px solid #dee2e6; text-align: center; font-size: 11px;">Count</th>
              </tr>
            </thead>
            <tbody>`;
      
      if (Object.keys(combos).length === 0) {
        html += `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #dc3545; font-style: italic; border: 1px solid #dee2e6;">
          No entities found. Make sure the DXF file contains valid LINE, CIRCLE, ARC, LWPOLYLINE, POLYLINE, SPLINE, or ELLIPSE entities.
        </td></tr>`;
      } else {
        Object.entries(combos).forEach(([key, count], idx) => {
          // Parse the key format: "TYPE | color: VALUE | layer: VALUE | linetype: VALUE"
          const parts = key.split(' | ');
          const type = parts[0]; // First part is just the type
          const color = parts[1].split(': ')[1];
          const layer = parts[2].split(': ')[1]; 
          const linetype = parts[3].split(': ')[1];
          let swatch = '';
          if (!isNaN(Number(color)) && Number(color) > 0 && Number(color) <= 256) {
            const dxfColors = ['#000', '#f00', '#ff0', '#0f0', '#0ff', '#00f', '#f0f', '#000']; // Changed white to black for visibility
            let cidx = Number(color);
            let cval = dxfColors[cidx] || '#666';
            if (cidx >= 1 && cidx <= 7) cval = dxfColors[cidx];
            swatch = `<span style="display:inline-block;width:16px;height:16px;border:1px solid #adb5bd;vertical-align:middle;background:${cval};margin-right:6px;border-radius:2px;"></span>`;
          }
          
          // Create unique entity identifier for checkbox
          const entityId = `entity_${type}_${color}_${layer}_${linetype}`.replace(/[^a-zA-Z0-9_]/g, '_');
          
          html += `<tr style="background:${idx%2?'#f8f9fa':'#ffffff'}; color:#212529;">
            <td style="padding:4px 8px; border: 1px solid #dee2e6; text-align: center;">
              <input type="checkbox" id="${entityId}" class="entity-visibility-checkbox" 
                     data-entity-type="${type}" data-color="${color}" data-layer="${layer}" data-linetype="${linetype}"
                     checked style="cursor: pointer;">
            </td>
            <td style="padding:4px 8px; border: 1px solid #dee2e6; font-size: 11px;">${swatch}${color}</td>
            <td style="padding:4px 8px; border: 1px solid #dee2e6; font-size: 11px;">${layer}</td>
            <td style="padding:4px 8px; border: 1px solid #dee2e6; font-size: 11px;">${linetype}</td>
            <td style="padding:4px 8px; border: 1px solid #dee2e6; text-align: center; font-weight: 500; font-size: 11px;">${count}</td>
          </tr>`;
        });
      }
      
      html += '</tbody></table></div></div>';
      reportContainer.innerHTML = html;
      
      // Add toggle function to global scope
      window.toggleEntityControls = function() {
        const content = document.getElementById('entityControlsContent');
        const toggle = document.getElementById('entityControlsToggle');
        if (content && toggle) {
          if (content.style.display === 'none') {
            content.style.display = 'block';
            toggle.textContent = '▼';
            toggle.style.transform = 'rotate(0deg)';
          } else {
            content.style.display = 'none';
            toggle.textContent = '▶';
            toggle.style.transform = 'rotate(-90deg)';
          }
        }
      };
      
      // Add event listeners for visibility checkboxes
      document.querySelectorAll('.entity-visibility-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
          updateEntityVisibility();
        });
      });
      
      // Store the parsed DXF data for re-rendering
      window.currentDxfData = dxf;
      
      // Render the DXF as SVG using DxfParser.toSVG
      try {
        // Get the container dimensions
        const containerWidth = svgDxfViewerDiv.clientWidth - 20; // Leave 10px padding on each side
        const containerHeight = 580; // Leave 20px for padding from 600px container
        
        const svg = window.DxfParser.toSVG(dxf, { 
          width: containerWidth, 
          height: containerHeight 
        });
        
        // Create interactive viewer with zoom and pan controls
        svgDxfViewerDiv.innerHTML = `
          <div class="dxf-viewer-container" style="position: relative; width: 100%; height: 100%; overflow: hidden; border: 1px solid #ccc; background: white;">
            <div class="viewer-controls" style="position: absolute; top: 10px; left: 10px; z-index: 10; display: flex; gap: 5px; background: rgba(255,255,255,0.95); padding: 5px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
              <button class="zoom-in-btn" style="padding: 5px 10px; border: 1px solid #666; background: white; color: #333; border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 14px;">+</button>
              <button class="zoom-out-btn" style="padding: 5px 10px; border: 1px solid #666; background: white; color: #333; border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 14px;">−</button>
              <button class="zoom-fit-btn" style="padding: 5px 8px; border: 1px solid #666; background: white; color: #333; border-radius: 3px; cursor: pointer; font-size: 11px;">Fit</button>
              <button class="zoom-reset-btn" style="padding: 5px 8px; border: 1px solid #666; background: white; color: #333; border-radius: 3px; cursor: pointer; font-size: 11px;">1:1</button>
            </div>
            <div class="svg-container" style="width: 100%; height: 100%; overflow: auto; cursor: grab;" id="svgContainer">
              <div class="svg-wrapper" style="display: inline-block; min-width: 100%; min-height: 100%;">
                ${svg}
              </div>
            </div>
          </div>
        `;
        
        // Add interactive functionality
        setupDxfViewerInteraction();
        
      } catch (err) {
        svgDxfViewerDiv.innerHTML = '<span style="color:red;">Error rendering SVG: ' + (err && err.message ? err.message : err) + '</span>';
      }
    };
    reader.onerror = function() {
      reportContainer.innerHTML = '<span style="color:red;">Error reading file.</span>';
      svgDxfViewerDiv.innerHTML = '';
    };
    reader.readAsText(file);
  }

  // Setup interactive DXF viewer with zoom and pan
  function setupDxfViewerInteraction() {
    const container = document.getElementById('svgContainer');
    const wrapper = container ? container.querySelector('.svg-wrapper') : null;
    const svg = wrapper ? wrapper.querySelector('svg') : null;
    
    if (!container || !wrapper || !svg) {
      console.log('Missing elements:', { container: !!container, wrapper: !!wrapper, svg: !!svg });
      return;
    }
    
    let currentScale = 1;
    let isDragging = false;
    let startX, startY;
    let scrollLeft, scrollTop;
    let lastMouseX = null;
    let lastMouseY = null;
    
    // Zoom controls
    const zoomInBtn = container.parentElement.querySelector('.zoom-in-btn');
    const zoomOutBtn = container.parentElement.querySelector('.zoom-out-btn');
    const zoomFitBtn = container.parentElement.querySelector('.zoom-fit-btn');
    const zoomResetBtn = container.parentElement.querySelector('.zoom-reset-btn');
    
    function updateSvgTransform() {
      wrapper.style.transform = `scale(${currentScale})`;
      wrapper.style.transformOrigin = 'top left';
      console.log('Transform updated:', currentScale);
    }
    
    function zoomToPoint(newScale, centerX = null, centerY = null) {
      if (newScale === currentScale) return;
      
      const rect = container.getBoundingClientRect();
      let zoomX, zoomY;
      
      if (centerX !== null && centerY !== null) {
        // Use provided center point
        zoomX = centerX;
        zoomY = centerY;
      } else if (lastMouseX !== null && lastMouseY !== null) {
        // Use last mouse position relative to container
        zoomX = lastMouseX - rect.left;
        zoomY = lastMouseY - rect.top;
      } else {
        // Use center of visible viewport
        zoomX = container.clientWidth / 2;
        zoomY = container.clientHeight / 2;
      }
      
      // Calculate new scroll position to zoom towards the point
      const scrollX = (container.scrollLeft + zoomX) * (newScale / currentScale) - zoomX;
      const scrollY = (container.scrollTop + zoomY) * (newScale / currentScale) - zoomY;
      
      console.log('Zooming to:', newScale, 'at point:', zoomX, zoomY);
      
      currentScale = newScale;
      updateSvgTransform();
      
      container.scrollLeft = scrollX;
      container.scrollTop = scrollY;
    }
    
    // Zoom in
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        const newScale = Math.min(currentScale * 1.2, 5);
        zoomToPoint(newScale);
      });
    }
    
    // Zoom out
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        const newScale = Math.max(currentScale / 1.2, 0.1);
        zoomToPoint(newScale);
      });
    }
    
    // Fit to view
    if (zoomFitBtn) {
      zoomFitBtn.addEventListener('click', () => {
        const containerRect = container.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const scaleX = containerRect.width / (svgRect.width / currentScale);
        const scaleY = containerRect.height / (svgRect.height / currentScale);
        currentScale = Math.min(scaleX, scaleY) * 0.9; // 90% to add some padding
        updateSvgTransform();
        container.scrollLeft = 0;
        container.scrollTop = 0;
      });
    }
    
    // Reset zoom
    if (zoomResetBtn) {
      zoomResetBtn.addEventListener('click', () => {
        currentScale = 1;
        updateSvgTransform();
        container.scrollLeft = 0;
        container.scrollTop = 0;
      });
    }
    
    // Mouse wheel zoom
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(5, currentScale * delta));
      
      if (newScale !== currentScale) {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate new scroll position to zoom towards mouse cursor
        const scrollX = (container.scrollLeft + x) * (newScale / currentScale) - x;
        const scrollY = (container.scrollTop + y) * (newScale / currentScale) - y;
        
        currentScale = newScale;
        updateSvgTransform();
        
        container.scrollLeft = scrollX;
        container.scrollTop = scrollY;
      }
    }, { passive: false });
    
    // Simplified mouse drag pan
    let panStartX, panStartY, panScrollLeft, panScrollTop;
    
    container.addEventListener('mousedown', (e) => {
      // Don't pan if clicking on zoom buttons
      if (e.target.closest('.viewer-controls')) return;
      
      isDragging = true;
      container.style.cursor = 'grabbing';
      panStartX = e.clientX;
      panStartY = e.clientY;
      panScrollLeft = container.scrollLeft;
      panScrollTop = container.scrollTop;
      e.preventDefault();
      console.log('Pan started at:', panStartX, panStartY);
    });
    
    // Track mouse position for zoom centering and handle panning
    container.addEventListener('mousemove', (e) => {
      // Update mouse position for zoom centering
      if (!isDragging) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      } else {
        // Handle panning
        e.preventDefault();
        const deltaX = e.clientX - panStartX;
        const deltaY = e.clientY - panStartY;
        
        container.scrollLeft = panScrollLeft - deltaX;
        container.scrollTop = panScrollTop - deltaY;
        console.log('Panning:', deltaX, deltaY);
      }
    });
    
    container.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        container.style.cursor = 'grab';
        console.log('Pan ended');
      }
    });
    
    // Handle mouse leave during drag
    container.addEventListener('mouseleave', () => {
      container.style.cursor = isDragging ? 'grabbing' : 'grab';
    });
    
    // Also handle global mouseup to stop dragging if mouse goes outside
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        container.style.cursor = 'grab';
        console.log('Pan ended (global)');
      }
    });
    
    // Touch support for mobile
    let lastTouchDistance = 0;
    
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        lastTouchDistance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) + 
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );
      } else if (e.touches.length === 1) {
        isDragging = true;
        const touch = e.touches[0];
        panStartX = touch.pageX;
        panStartY = touch.pageY;
        panScrollLeft = container.scrollLeft;
        panScrollTop = container.scrollTop;
      }
    }, { passive: true });
    
    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        // Pinch zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) + 
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );
        
        if (lastTouchDistance > 0) {
          const scale = currentDistance / lastTouchDistance;
          currentScale = Math.max(0.1, Math.min(5, currentScale * scale));
          updateSvgTransform();
        }
        lastTouchDistance = currentDistance;
      } else if (e.touches.length === 1 && isDragging) {
        e.preventDefault();
        // Pan
        const touch = e.touches[0];
        const deltaX = touch.pageX - panStartX;
        const deltaY = touch.pageY - panStartY;
        container.scrollLeft = panScrollLeft - deltaX;
        container.scrollTop = panScrollTop - deltaY;
      }
    }, { passive: false });
    
    container.addEventListener('touchend', () => {
      isDragging = false;
      lastTouchDistance = 0;
    });
  }

  // Function to update entity visibility based on checkbox states
  function updateEntityVisibility() {
    if (!window.currentDxfData) return;
    
    // Get checked states
    const visibilityStates = {};
    document.querySelectorAll('.entity-visibility-checkbox').forEach(checkbox => {
      const type = checkbox.dataset.entityType;
      const color = checkbox.dataset.color;
      const layer = checkbox.dataset.layer;
      const linetype = checkbox.dataset.linetype;
      const key = `${type}|${color}|${layer}|${linetype}`;
      visibilityStates[key] = checkbox.checked;
      console.log(`Checkbox ${key}: ${checkbox.checked}`);
    });
    
    // Filter entities based on visibility states
    const filteredDxf = {
      ...window.currentDxfData,
      entities: window.currentDxfData.entities.filter(entity => {
        const type = entity.type || '(unknown)';
        const color = entity.color || entity.colorNumber || '(none)';
        const layer = entity.layer || '(none)';
        const linetype = entity.lineType || '(none)';
        const key = `${type}|${color}|${layer}|${linetype}`;
        return visibilityStates[key] !== false; // Show if not explicitly hidden
      })
    };
    
    console.log(`Filtered entities: ${filteredDxf.entities.length} of ${window.currentDxfData.entities.length} visible`);
    
    // Re-render the SVG with filtered entities
    try {
      const containerWidth = svgDxfViewerDiv.clientWidth - 20;
      const containerHeight = 580;
      
      const svg = window.DxfParser.toSVG(filteredDxf, { 
        width: containerWidth, 
        height: containerHeight,
        originalData: window.currentDxfData // Use original data for consistent bounds
      });
      
      // Create interactive viewer with zoom and pan controls
      svgDxfViewerDiv.innerHTML = `
        <div class="dxf-viewer-container" style="position: relative; width: 100%; height: 100%; overflow: hidden; border: 1px solid #ccc; background: white;">
          <div class="viewer-controls" style="position: absolute; top: 10px; left: 10px; z-index: 10; display: flex; gap: 5px; background: rgba(255,255,255,0.95); padding: 5px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            <button class="zoom-in-btn" style="padding: 5px 10px; border: 1px solid #666; background: white; color: #333; border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 14px;">+</button>
            <button class="zoom-out-btn" style="padding: 5px 10px; border: 1px solid #666; background: white; color: #333; border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 14px;">−</button>
            <button class="zoom-fit-btn" style="padding: 5px 8px; border: 1px solid #666; background: white; color: #333; border-radius: 3px; cursor: pointer; font-size: 11px;">Fit</button>
            <button class="zoom-reset-btn" style="padding: 5px 8px; border: 1px solid #666; background: white; color: #333; border-radius: 3px; cursor: pointer; font-size: 11px;">1:1</button>
          </div>
          <div class="svg-container" style="width: 100%; height: 100%; overflow: auto; cursor: grab;" id="svgContainer">
            <div class="svg-wrapper" style="display: inline-block; min-width: 100%; min-height: 100%;">
              ${svg}
            </div>
          </div>
        </div>
      `;
      
      // Add interactive functionality
      setupDxfViewerInteraction();
      
    } catch (err) {
      console.error('Error updating entity visibility:', err);
      svgDxfViewerDiv.innerHTML = '<span style="color:red;">Error updating display: ' + (err && err.message ? err.message : err) + '</span>';
    }
  }

  // Tab switching logic (show/hide Import/Analyze tab content)
  document.querySelectorAll('.tab-header').forEach(header => {
    header.addEventListener('click', function() {
      const tabId = header.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = (tab.id === tabId + '-tab') ? '' : 'none';
      });
      document.querySelectorAll('.tab-header').forEach(h => h.classList.remove('active'));
      header.classList.add('active');
    });
  });

})(); 