// File: js/visualization.js
/**
 * NC File Converter Visualization Module - Fixed Version
 * Provides a 2D visualization of NC file toolpaths with focus on cutting processes
 */

NCConverter.VisInitializer = {
  init: function() {
    NCConverter.debugLog("Visualization Initializer running");
    // Initialize or reinitialize Visualization
    if (NCConverter.Visualization) {
      NCConverter.Visualization.init();
    } else {
      console.error("Visualization module not found");
    }
  }
};

NCConverter.Visualization = {
  /**
   * DOM element cache
   */
  elements: {},
  
  /**
   * Visualization state
   */
  state: {
    canvas: null,
    ctx: null,
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    scale: 1,
    panX: 0,
    panY: 0,
    paths: [],
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    initialized: false,
    darkMode: false // Track dark mode state
  },
  
  /**
   * Color configuration for different path types with improved visual design
   */
  colors: {
    // Improved color palette with better contrast and modern look
    rapidTraverse: '#64748b',    // Gray for non-cutting moves (laser off)
    cutting: '#3b82f6',          // Modern blue for regular cutting (laser on)
    h1: '#ef4444',               // Red for H1 cutting
    h2: '#f59e0b',               // Amber for H2 cutting  
    h3: '#22c55e',               // Green for H3 cutting
    h4: '#06b6d4',               // Cyan for H4 cutting
    h20: '#8b5cf6',              // Purple for H20 (engraving)
    h22: '#ec4899',              // Pink for H22 (fine cut)
    h104: '#f97316',             // Orange for H104 (milling)
    background: '#1e293b',       // Modern dark background
    grid: '#475569',             // Subtle grid
    gridMajor: '#64748b',        // Major grid lines
    axis: '#e2e8f0',             // Light axis lines
    startPoint: '#dc2626',       // Bright red for start point
    endPoint: '#16a34a',         // Green for end point
    darkBackground: '#0f172a',   // Darker mode background
    darkGrid: '#334155',         // Darker grid
    legend: {
      background: 'rgba(15, 23, 42, 0.9)',
      border: 'rgba(100, 116, 139, 0.3)',
      text: '#e2e8f0'
    }
  },
  
  /**
   * Initialize the visualization module
   */
  init: function() {
    NCConverter.debugLog("Visualization initializing");
    
    // Cache DOM elements
    this.elements = {
      canvas: document.getElementById('visualizationCanvas')
    };
    
    const { canvas } = this.elements;
    
    if (!canvas) {
      console.error("Visualization canvas not found");
      return;
    }
    
    // Set up canvas
    this.state.canvas = canvas;
    this.state.ctx = canvas.getContext('2d');
    
    // Get dark mode state
    if (document.body.classList.contains('dark-mode')) {
      this.state.darkMode = true;
    }
    
    // Clean up any existing rapid moves toggle from previous versions
    const existingToggle = document.getElementById('rapidMovesToggleContainer');
    if (existingToggle) {
      existingToggle.remove();
      NCConverter.debugLog("Removed existing rapid moves toggle");
    }
    
    // Set up controls
    this.setupControls();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Reset canvas size
    this.resetCanvasSize();
    
    // Draw an empty grid initially
    this.resetVisualization();
    this.drawGrid();
    
    // If there's already file content, parse and display it
    if (NCConverter.state && NCConverter.state.fileContent) {
      // Step Loader integration
      const stepControls = document.getElementById('stepLoaderControls');
      if (stepControls && window.StepLoader) {
        const lines = NCConverter.state.fileContent.split(/\r?\n/);
        if (Array.isArray(lines) && lines.length > 0) {
          StepLoader.init(lines, function(visibleLines, currentLineIdx) {
            NCConverter.Visualization.parseGCode(visibleLines.join('\n'));
            // Update line info
            var info = document.getElementById('stepLineInfo');
            if (info) info.textContent = `Line ${currentLineIdx + 1} / ${lines.length}`;
            // Show current DIN file line
            var lineWindow = document.getElementById('stepCurrentLineWindow');
            if (lineWindow) {
              lineWindow.textContent = lines[currentLineIdx] ? lines[currentLineIdx] : '';
            }
          });
          // Wire up controls
          document.getElementById('stepBackBtn').onclick = () => StepLoader.stepBackward();
          document.getElementById('stepForwardBtn').onclick = () => StepLoader.stepForward();
          const speedInput = document.getElementById('stepPlaySpeed');
          document.getElementById('stepPlayBtn').onclick = () => {
            let speed = 250;
            if (speedInput && !isNaN(parseInt(speedInput.value))) {
              speed = Math.max(50, Math.min(2000, parseInt(speedInput.value)));
            }
            StepLoader.play(speed);
          };
          // Update play speed immediately if changed while playing
          if (speedInput) {
            const speedValue = document.getElementById('stepPlaySpeedValue');
            // Map slider value (1-40) to ms interval (fast=25ms, slow=1000ms)
            function getMappedSpeed(val) {
              // Linear mapping: 1 (fast) → 10ms, 60 (slow) → 1500ms
              val = parseInt(val);
              return Math.round(10 + ((60 - val) * (1490 / 59)));
            }
            speedInput.addEventListener('input', function() {
              let speed = getMappedSpeed(speedInput.value);
              if (speedValue) speedValue.textContent = speed + ' ms';
              if (StepLoader.state.playing) {
                StepLoader.pause();
                StepLoader.play(speed);
              }
            });
            // Show initial value
            if (speedValue) speedValue.textContent = getMappedSpeed(speedInput.value) + ' ms';
          }
          document.getElementById('stepPauseBtn').onclick = () => StepLoader.pause();
          document.getElementById('stepResetBtn').onclick = () => StepLoader.reset();
          // Force initial visualization to only first line
          StepLoader.state.currentLine = 0;
          StepLoader.update();
        } else {
          this.parseAndDisplayFile();
        }
      } else {
        this.parseAndDisplayFile();
      }
    } else if (NCConverter.state && NCConverter.state.convertedContent) {
      // Try with converted content if available
      const contentToUse = NCConverter.state.convertedContent;
      this.parseGCode(contentToUse);
      this.fitToView();
    }
    
    this.state.initialized = true;
    NCConverter.debugLog("Visualization initialized");
  },
  
  /**
   * Set up visualization controls
   */
  setupControls: function() {
    const { canvas } = this.elements;
    if (!canvas) return;

    // Do NOT remove static controls; just add zoom/fit buttons if needed
    const visualizationContainer = document.querySelector('.visualization-canvas-wrapper');
    if (!visualizationContainer) return;

    // Find the static controls container
    const controlsContainer = document.getElementById('visualizationControls');
    if (!controlsContainer) return;

    // Add zoom in button
    if (!document.getElementById('zoomInBtn')) {
      const zoomInBtn = document.createElement('button');
      zoomInBtn.id = 'zoomInBtn';
      zoomInBtn.className = 'btn-sm';
      zoomInBtn.title = 'Zoom In';
      zoomInBtn.textContent = '+';
      zoomInBtn.onclick = () => this.zoom(1.2);
      controlsContainer.appendChild(zoomInBtn);
      this.elements.zoomInBtn = zoomInBtn;
    }

    // Add zoom out button
    if (!document.getElementById('zoomOutBtn')) {
      const zoomOutBtn = document.createElement('button');
      zoomOutBtn.id = 'zoomOutBtn';
      zoomOutBtn.className = 'btn-sm';
      zoomOutBtn.title = 'Zoom Out';
      zoomOutBtn.textContent = '−';
      zoomOutBtn.onclick = () => this.zoom(0.8);
      controlsContainer.appendChild(zoomOutBtn);
      this.elements.zoomOutBtn = zoomOutBtn;
    }

    // Add fit view button
    if (!document.getElementById('fitBtn')) {
      const fitBtn = document.createElement('button');
      fitBtn.id = 'fitBtn';
      fitBtn.className = 'btn-sm';
      fitBtn.title = 'Fit View';
      fitBtn.textContent = '↔';
      fitBtn.onclick = () => this.fitToView();
      controlsContainer.appendChild(fitBtn);
      this.elements.fitBtn = fitBtn;
    }
    // Step loader controls are already present in static HTML
  },
  
  /**
   * Set up event listeners for visualization controls
   */
  setupEventListeners: function() {
    const { canvas } = this.elements;
    
    // Canvas mouse events for panning and zooming
    if (canvas) {
      // Pan with mouse drag
      canvas.addEventListener('mousedown', (e) => {
        this.state.isDragging = true;
        this.state.lastMouseX = e.offsetX;
        this.state.lastMouseY = e.offsetY;
        canvas.style.cursor = 'grabbing';
      });
      
      canvas.addEventListener('mousemove', (e) => {
        if (this.state.isDragging) {
          const dx = e.offsetX - this.state.lastMouseX;
          const dy = e.offsetY - this.state.lastMouseY;
          
          this.state.panX += dx;
          this.state.panY -= dy; // Negate Y to match natural panning (up mouse = up view)
          
          this.state.lastMouseX = e.offsetX;
          this.state.lastMouseY = e.offsetY;
          
          this.redraw();
        }
      });
      
      canvas.addEventListener('mouseup', () => {
        this.state.isDragging = false;
        canvas.style.cursor = 'default';
      });
      
      canvas.addEventListener('mouseleave', () => {
        this.state.isDragging = false;
        canvas.style.cursor = 'default';
      });
      
      // Zoom with mouse wheel
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Get mouse position relative to canvas
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Convert mouse position to world space (accounting for Y-axis flip)
        const worldX = (mouseX - this.state.panX) / this.state.scale;
        const worldY = (canvas.height - mouseY - this.state.panY) / this.state.scale;
        
        // Determine zoom direction
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        
        // Apply zoom
        this.state.scale *= zoomFactor;
        
        // Adjust pan to zoom toward mouse position (accounting for Y-axis flip)
        this.state.panX = mouseX - worldX * this.state.scale;
        this.state.panY = canvas.height - mouseY - worldY * this.state.scale;
        
        // Redraw
        this.redraw();
      }, { passive: false });
    }
    
    // Listen for dark mode changes
    document.addEventListener('dark-mode-changed', (e) => {
      this.state.darkMode = e.detail.darkMode;
      this.redraw();
    });
    
    // Listen for file content changes - hook this to multiple events
    document.addEventListener('fileContentChanged', () => {
      console.log("Visualization: File content changed event received");
      this.parseAndDisplayFile();
    });
    
    // Also monitor the FileHandler directly
    if (NCConverter.FileHandler) {
      const originalHandleFileSelection = NCConverter.FileHandler.handleFileSelection;
      
      NCConverter.FileHandler.handleFileSelection = function() {
        originalHandleFileSelection.apply(this, arguments);
        
        // Dispatch custom event after file is loaded and processed
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('fileContentChanged'));
        }, 500);
      };
    }
    
    // Listen for tab activation to resize canvas properly
    document.querySelectorAll('.tab-header').forEach(header => {
      header.addEventListener('click', () => {
        if (header.getAttribute('data-tab') === 'visualization') {
          console.log("Visualization tab activated");
          setTimeout(() => {
            this.resetCanvasSize();
            this.redraw();
            
            // Check if we need to parse file content
            if ((!this.state.paths || this.state.paths.length === 0) && 
                NCConverter.state && NCConverter.state.fileContent) {
              console.log("Parsing file content after tab activation");
              this.parseAndDisplayFile();
            }
          }, 100);
        }
      });
    });
    
    // Listen for window resize to adjust canvas
    window.addEventListener('resize', () => {
      if (document.querySelector('.tab-header[data-tab="visualization"]').classList.contains('active')) {
        this.resetCanvasSize();
        this.redraw();
      }
    });
    
    // Add direct hook into Conversion module to catch content changes
    if (NCConverter.Conversion) {
      const originalUpdateConversion = NCConverter.Conversion.updateConversion;
      
      NCConverter.Conversion.updateConversion = function() {
        originalUpdateConversion.apply(this, arguments);
        
        // Notify visualization of content change
        document.dispatchEvent(new CustomEvent('fileContentChanged'));
      };
    }
  },
  
  /**
   * Reset canvas size to match its container
   */
  resetCanvasSize: function() {
    const { canvas } = this.elements;
    if (!canvas) return;
    
    const container = canvas.parentElement;
    if (!container) return;
    
    // Get container dimensions
    const rect = container.getBoundingClientRect();
    
    // Only update if dimensions actually changed
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      NCConverter.debugLog(`Canvas resized to ${canvas.width}x${canvas.height}`);
    }
  },
  
  /**
   * Reset visualization state
   */
  resetVisualization: function() {
    this.state.bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    this.state.scale = 1;
    this.state.panX = 0;
    this.state.panY = 0;
    this.state.paths = [];
  },
  
  /**
   * Parse the file content and prepare for display
   */
  parseAndDisplayFile: function() {
    NCConverter.debugLog("Parsing file for visualization");
    
    // Reset visualization first
    this.resetVisualization();
    
    // Get file content - try both original and converted
    let content = NCConverter.state.fileContent;
    
    // If no content, try with converted content
    if (!content && NCConverter.state.convertedContent) {
      content = NCConverter.state.convertedContent;
    }
    
    if (!content) {
      NCConverter.debugLog("No content to visualize");
      this.drawGrid();
      return;
    }
    
    // Parse G-code to extract paths
    this.parseGCode(content);
    
    // Fit the view to show the entire toolpath
    this.fitToView();
  },
  
  /**
   * Parse G-code content to extract toolpaths - Simplified M14/M15 focused version
   * @param {string} content - G-code content to parse
   */
  parseGCode: function(content) {
    NCConverter.debugLog("Parsing G-code - M14/M15 focused mode");
    
    // Split by lines
    const lines = content.split('\n');
    
    // Current position and state
    let currentX = 0;
    let currentY = 0;
    let currentZ = 0;
    let isAbsolute = true;  // G90 is default (absolute positioning)
    let isMetric = true;    // G21 is default (metric)
    let currentH = null;    // Current H function
    let drawingActive = false;    // M14 = start drawing, M15 = stop drawing
    
    // Prepare paths array
    this.state.paths = [];
    
    // Current path being built
    let currentPath = {
      points: [],
      hFunction: null
    };
    
    // Process each line
    lines.forEach(line => {
      // Skip comments and empty lines
      if (line.trim().startsWith('(') || line.trim().startsWith(';') || line.trim() === '') {
        return; // Skip comments and empty lines
      }

      // Check for M codes that control drawing state
      if (/M\s*14\b/i.test(line)) {
        drawingActive = true; // M14 = Start drawing
        NCConverter.debugLog("🔥 M14 - START DRAWING - Line:", line.trim());
        
        // Start a new path for drawing
        if (currentPath.points.length > 0) {
          // Save previous path if it has points
          this.state.paths.push(currentPath);
        }
        currentPath = {
          points: [{ x: currentX, y: currentY, z: currentZ }],
          hFunction: currentH
        };
      }
      
      if (/M\s*15\b/i.test(line)) {
        drawingActive = false; // M15 = Stop drawing
        NCConverter.debugLog("⏹️ M15 - STOP DRAWING - Line:", line.trim());
        
        // Finish current path if drawing was active
        if (currentPath.points.length > 1) {
          this.state.paths.push(currentPath);
          NCConverter.debugLog(`✅ Path completed with ${currentPath.points.length} points`);
          currentPath = {
            points: [],
            hFunction: currentH
          };
        }
      }
      
      // Check for arc commands (G02/G03) and handle them specially
      const g02Match = line.match(/G\s*0?2\b/i); // Clockwise arc
      const g03Match = line.match(/G\s*0?3\b/i); // Counterclockwise arc
      
      // Extract coordinates - Updated to handle decimal numbers starting with dot
      const xMatch = line.match(/X\s*(-?(?:\d*\.\d+|\d+))/i);
      const yMatch = line.match(/Y\s*(-?(?:\d*\.\d+|\d+))/i);
      const zMatch = line.match(/Z\s*(-?(?:\d*\.\d+|\d+))/i);
      
      // Extract I and J parameters for arcs - Updated to handle decimal numbers starting with dot
      const iMatch = line.match(/I\s*(-?(?:\d*\.\d+|\d+))/i);
      const jMatch = line.match(/J\s*(-?(?:\d*\.\d+|\d+))/i);
      
      // Extract H functions
      const hMatch = line.match(/H\s*(\d+)/i);
      if (hMatch) {
        currentH = 'H' + hMatch[1];
        NCConverter.debugLog("H function detected:", currentH);
        currentPath.hFunction = currentH;
      }
      
      // Handle arc commands (G02/G03) - require either I or J parameter
      if ((g02Match || g03Match) && (xMatch || yMatch) && (iMatch || jMatch)) {
        const isClockwise = !!g02Match;
        
        // Calculate end position
        let endX = currentX;
        let endY = currentY;
        let endZ = currentZ;
        
        if (xMatch) {
          const newX = parseFloat(xMatch[1]);
          endX = isAbsolute ? newX : currentX + newX;
        }
        
        if (yMatch) {
          const newY = parseFloat(yMatch[1]);
          endY = isAbsolute ? newY : currentY + newY;
        }
        
        if (zMatch) {
          const newZ = parseFloat(zMatch[1]);
          endZ = isAbsolute ? newZ : currentZ + newZ;
        }
        
        // Get I and J offsets (relative to current position)
        const iOffset = iMatch ? parseFloat(iMatch[1]) : 0;
        const jOffset = jMatch ? parseFloat(jMatch[1]) : 0;
        
        // Convert to display units
        let scaledCurrentX = currentX;
        let scaledCurrentY = currentY;
        let scaledEndX = endX;
        let scaledEndY = endY;
        let scaledI = iOffset;
        let scaledJ = jOffset;
        
        if (!isMetric) {
          scaledCurrentX *= 25.4;
          scaledCurrentY *= 25.4;
          scaledEndX *= 25.4;
          scaledEndY *= 25.4;
          scaledI *= 25.4;
          scaledJ *= 25.4;
        }
        
        NCConverter.debugLog(`🌀 ${isClockwise ? 'G02 (CW)' : 'G03 (CCW)'} Arc from X${scaledCurrentX.toFixed(2)},Y${scaledCurrentY.toFixed(2)} to X${scaledEndX.toFixed(2)},Y${scaledEndY.toFixed(2)} I${scaledI.toFixed(2)} J${scaledJ.toFixed(2)}`);
        
        // Only process arc when drawing is active
        if (drawingActive) {
          // Generate arc points
          const arcPoints = this.generateArcPoints(
            scaledCurrentX, scaledCurrentY,
            scaledEndX, scaledEndY,
            scaledI, scaledJ,
            isClockwise
          );
          
          // Add arc points to current path
          arcPoints.forEach(point => {
            currentPath.points.push({ x: point.x, y: point.y, z: endZ });
            this.updateBounds(point.x, point.y);
          });
          
          NCConverter.debugLog(`➕ Arc with ${arcPoints.length} points added to path`);
          NCConverter.debugLog(`✅ Visualized arc: ${line.trim()}`);
        } else {
          NCConverter.debugLog(`❌ Skipped arc (drawing OFF): ${line.trim()}`);
        }
        
        // Update current position to end position
        currentX = endX;
        currentY = endY;
        currentZ = endZ;
        
        // Update bounds for end point
        this.updateBounds(scaledEndX, scaledEndY);
        
      } else if (xMatch || yMatch || zMatch) {
        // Handle linear movement (existing logic)
        
        // Update position based on new coordinates
        if (xMatch) {
          const newX = parseFloat(xMatch[1]);
          currentX = isAbsolute ? newX : currentX + newX;
        }
        
        if (yMatch) {
          const newY = parseFloat(yMatch[1]);
          currentY = isAbsolute ? newY : currentY + newY;
        }
        
        if (zMatch) {
          const newZ = parseFloat(zMatch[1]);
          currentZ = isAbsolute ? newZ : currentZ + newZ;
        }
        
        // Convert to common unit (mm) for display
        let scaledX = currentX;
        let scaledY = currentY;
        
        if (!isMetric) {
          scaledX *= 25.4; // Convert inches to mm
          scaledY *= 25.4;
        }
        
        NCConverter.debugLog(`📍 Linear move to X${scaledX.toFixed(2)}, Y${scaledY.toFixed(2)} - Drawing: ${drawingActive ? 'ON' : 'OFF'} - H: ${currentH || 'none'}`);
        
        // Only add points when drawing is active (between M14 and M15)
        if (drawingActive) {
          currentPath.points.push({ x: scaledX, y: scaledY, z: currentZ });
          NCConverter.debugLog(`➕ Point added to path (${currentPath.points.length} total points)`);
        }
        
        // Update bounds for auto-fit
        this.updateBounds(scaledX, scaledY);
      }
    }); // End of lines.forEach

    // Add the last path if it has points
    if (currentPath.points.length > 1) {
      this.state.paths.push(currentPath);
      NCConverter.debugLog(`✅ Final path added with ${currentPath.points.length} points`);
    }
    
    NCConverter.debugLog(`🎨 Parsed ${this.state.paths.length} drawing paths`);
    
    // Draw the toolpaths
    this.redraw();
  },
  
  /**
   * Update bounds to encompass all points
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  updateBounds: function(x, y) {
    const { bounds } = this.state;
    
    // Initialize bounds if this is the first point
    if (bounds.minX === 0 && bounds.maxX === 1) {
      bounds.minX = x;
      bounds.maxX = x;
      bounds.minY = y;
      bounds.maxY = y;
    } else {
      // Expand bounds if needed
      bounds.minX = Math.min(bounds.minX, x);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y);
    }
  },
  
  /**
   * Generate points along an arc defined by start, end, and center offsets
   * @param {number} startX - Starting X coordinate
   * @param {number} startY - Starting Y coordinate  
   * @param {number} endX - Ending X coordinate
   * @param {number} endY - Ending Y coordinate
   * @param {number} iOffset - I offset (X offset to arc center from start)
   * @param {number} jOffset - J offset (Y offset to arc center from start)
   * @param {boolean} isClockwise - True for G02 (clockwise), false for G03 (counterclockwise)
   * @return {Array} Array of {x, y} points along the arc
   */
  generateArcPoints: function(startX, startY, endX, endY, iOffset, jOffset, isClockwise) {
    const centerX = startX + iOffset;
    const centerY = startY + jOffset;
    const radius = Math.sqrt(iOffset * iOffset + jOffset * jOffset);
    if (radius < 0.001) {
      NCConverter.debugLog(`⚠️ Arc radius too small (${radius}), treating as line`);
      return [{ x: endX, y: endY }];
    }
    const startRadius = Math.sqrt((startX - centerX) ** 2 + (startY - centerY) ** 2);
    const endRadius = Math.sqrt((endX - centerX) ** 2 + (endY - centerY) ** 2);
    if (Math.abs(startRadius - endRadius) > 0.1) {
      NCConverter.debugLog(`⚠️ Arc radii mismatch: start=${startRadius.toFixed(3)}, end=${endRadius.toFixed(3)}, treating as line`);
      return [{ x: endX, y: endY }];
    }
    const startAngle = Math.atan2(startY - centerY, startX - centerX);
    const endAngle = Math.atan2(endY - centerY, endX - centerX);
    let sweep = endAngle - startAngle;
    if (isClockwise && sweep > 0) sweep -= 2 * Math.PI;
    if (!isClockwise && sweep < 0) sweep += 2 * Math.PI;
    // Full circle if start/end are the same
    if (Math.abs(sweep) < 1e-6 && Math.abs(startX - endX) < 1e-6 && Math.abs(startY - endY) < 1e-6) {
      sweep = isClockwise ? -2 * Math.PI : 2 * Math.PI;
    }
    // Use angle-based segment count: 1 segment per 2 degrees, min 24
    const segments = Math.max(24, Math.ceil(Math.abs(sweep) / (Math.PI / 90)));
    const points = [];
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const angle = startAngle + sweep * t;
      points.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    }
    // Always include the end point exactly
    points[points.length - 1] = { x: endX, y: endY };
    return points;
  },
  
  /**
   * Fit the view to show all toolpaths
   */
  fitToView: function() {
    const { canvas, ctx } = this.state;
    if (!canvas || !ctx) return;
    
    const { bounds } = this.state;
    
    // If no valid bounds, use defaults
    if (bounds.minX === bounds.maxX && bounds.minY === bounds.maxY) {
      bounds.minX = -10;
      bounds.minY = -10;
      bounds.maxX = 10;
      bounds.maxY = 10;
    }
    
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    // Add padding
    const padding = Math.max(width, height) * 0.1;
    bounds.minX -= padding;
    bounds.minY -= padding;
    bounds.maxX += padding;
    bounds.maxY += padding;
    
    // Calculate scale to fit
    const scaleX = canvas.width / (bounds.maxX - bounds.minX);
    const scaleY = canvas.height / (bounds.maxY - bounds.minY);
    this.state.scale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave margin
    
    // Center the view
    this.state.panX = (canvas.width - (bounds.maxX - bounds.minX) * this.state.scale) / 2 - bounds.minX * this.state.scale;
    this.state.panY = (canvas.height - (bounds.maxY - bounds.minY) * this.state.scale) / 2 - bounds.minY * this.state.scale;
    this.redraw();
  },
  
  /**
   * Apply zoom centered on canvas
   * @param {number} factor - Zoom factor (> 1 to zoom in, < 1 to zoom out)
   */
  zoom: function(factor) {
    const { canvas } = this.state;
    if (!canvas) return;
    
    // Get center of canvas
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Convert center to world space
    const worldX = (centerX - this.state.panX) / this.state.scale;
    const worldY = (centerY - this.state.panY) / this.state.scale;
    
    // Apply zoom
    this.state.scale *= factor;
    
    // Adjust pan to keep the center point fixed
    this.state.panX = centerX - worldX * this.state.scale;
    this.state.panY = centerY - worldY * this.state.scale;
    
    this.redraw();
  },
  
  /**
   * Redraw the entire visualization with enhanced quality
   */
  redraw: function() {
    const { canvas, ctx } = this.state;
    if (!canvas || !ctx) return;
    
    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    this.drawGrid();
    
    // Draw toolpaths with enhanced styling
    this.drawToolpaths();
  },
  
  /**
   * Draw the background grid with improved styling
   */
  drawGrid: function() {
    const { canvas, ctx, scale, panX, panY } = this.state;
    if (!canvas || !ctx) return;
    
    // Set high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw background
    ctx.fillStyle = this.colors.darkBackground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Determine grid size based on scale for better visual hierarchy
    let gridSize = 10; // mm
    let majorGridSize = 50; // mm
    
    // Adjust grid size based on zoom level
    if (scale < 0.5) {
      gridSize = 50;
      majorGridSize = 200;
    } else if (scale < 1) {
      gridSize = 20;
      majorGridSize = 100;
    } else if (scale > 5) {
      gridSize = 5;
      majorGridSize = 25;
    } else if (scale > 10) {
      gridSize = 1;
      majorGridSize = 10;
    }
    
    // Calculate grid boundaries
    const startX = Math.floor((0 - panX) / scale / gridSize) * gridSize;
    const endX = Math.ceil((canvas.width - panX) / scale / gridSize) * gridSize;
    const startY = Math.floor((0 - panY) / scale / gridSize) * gridSize;
    const endY = Math.ceil((canvas.height - panY) / scale / gridSize) * gridSize;
    
    // Draw minor grid lines
    ctx.strokeStyle = this.colors.darkGrid;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;
    
    // Vertical grid lines
    for (let x = startX; x <= endX; x += gridSize) {
      const screenX = Math.round(x * scale + panX) + 0.5; // +0.5 for crisp lines
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, canvas.height);
      ctx.stroke();
    }
    
    // Horizontal grid lines with flipped Y-axis
    for (let y = startY; y <= endY; y += gridSize) {
      const screenY = Math.round(canvas.height - (y * scale + panY)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(canvas.width, screenY);
      ctx.stroke();
    }
    
    // Draw major grid lines
    ctx.strokeStyle = this.colors.gridMajor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    
    // Major vertical grid lines
    for (let x = Math.floor(startX / majorGridSize) * majorGridSize; x <= endX; x += majorGridSize) {
      const screenX = Math.round(x * scale + panX) + 0.5;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, canvas.height);
      ctx.stroke();
    }
    
    // Major horizontal grid lines with flipped Y-axis
    for (let y = Math.floor(startY / majorGridSize) * majorGridSize; y <= endY; y += majorGridSize) {
      const screenY = Math.round(canvas.height - (y * scale + panY)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(canvas.width, screenY);
      ctx.stroke();
    }
    
    // Draw axes with enhanced styling
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = this.colors.axis;
    ctx.lineWidth = 2;
    
    // X axis with flipped Y-axis
    const originY = Math.round(canvas.height - (0 * scale + panY)) + 0.5;
    if (originY >= 0 && originY <= canvas.height) {
      ctx.beginPath();
      ctx.moveTo(0, originY);
      ctx.lineTo(canvas.width, originY);
      ctx.stroke();
    }
    
    // Y axis
    const originX = Math.round(0 * scale + panX) + 0.5;
    if (originX >= 0 && originX <= canvas.width) {
      ctx.beginPath();
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, canvas.height);
      ctx.stroke();
    }
    
    // Reset alpha
    ctx.globalAlpha = 1.0;
  },
  
  /**
   * Draw all toolpaths with improved visual quality
   */
  drawToolpaths: function() {
    const { canvas, ctx, scale, panX, panY, paths } = this.state;
    if (!canvas || !ctx || !paths.length) return;
    
    NCConverter.debugLog(`🎨 Drawing ${paths.length} paths with enhanced quality`);
    
    // Set high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Collect used H functions for legend
    const usedHFunctions = new Set();
    
    // Draw each path with improved styling
    paths.forEach((path, pathIndex) => {
      if (path.points.length < 2) return;
      
      // Track used H functions
      if (path.hFunction) {
        usedHFunctions.add(path.hFunction);
      }
      
      ctx.globalAlpha = 0.9; // Slightly transparent for better overlapping
      
      // Set line style based on H function with improved colors
      let strokeColor = this.colors.cutting;
      let lineWidth = 1.5; // Thinner, more elegant lines
      
      if (path.hFunction) {
        const hFunc = path.hFunction.toLowerCase();
        if (hFunc.startsWith('h1')) {
          strokeColor = this.colors.h1;
          lineWidth = 2.0; // Slightly thicker for primary cutting
        } else if (hFunc.startsWith('h2')) {
          strokeColor = this.colors.h2;
          lineWidth = 1.8;
        } else if (hFunc.startsWith('h3')) {
          strokeColor = this.colors.h3;
          lineWidth = 1.6;
        } else if (hFunc.startsWith('h4')) {
          strokeColor = this.colors.h4;
          lineWidth = 1.4;
        } else if (hFunc.startsWith('h20')) {
          strokeColor = this.colors.h20;
          lineWidth = 1.2; // Thinner for engraving
        } else if (hFunc.startsWith('h22')) {
          strokeColor = this.colors.h22;
          lineWidth = 1.0; // Very thin for fine cut
        } else if (hFunc.startsWith('h104')) {
          strokeColor = this.colors.h104;
          lineWidth = 2.2; // Thicker for milling
        }
        
        NCConverter.debugLog(`Path ${pathIndex}: ${path.hFunction} with ${path.points.length} points`);
      } else {
        NCConverter.debugLog(`Path ${pathIndex}: No H-function with ${path.points.length} points`);
      }
      
      // Apply dynamic line width based on zoom for better visibility
      const dynamicLineWidth = Math.max(0.8, lineWidth / Math.sqrt(scale)) * 1.5;
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = dynamicLineWidth;
      ctx.setLineDash([]); // Solid lines
      
      // Add subtle shadow for depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 0.5;
      ctx.shadowOffsetY = 0.5;
      
      // Draw the path with anti-aliased lines
      ctx.beginPath();
      const startPoint = path.points[0];
      const startY = canvas.height - (startPoint.y * scale + panY);
      ctx.moveTo(startPoint.x * scale + panX, startY);
      
      for (let i = 1; i < path.points.length; i++) {
        const point = path.points[i];
        const pointY = canvas.height - (point.y * scale + panY);
        ctx.lineTo(point.x * scale + panX, pointY);
      }
      
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    });
    
    // Draw start and end point markers with improved styling
    this.drawPointMarkers();
    
    // Draw legend with used H functions
    this.drawLegend(Array.from(usedHFunctions));
    
    // Reset alpha
    ctx.globalAlpha = 1.0;
  },
  
  /**
   * Draw start and end point markers with enhanced styling
   */
  drawPointMarkers: function() {
    const { canvas, ctx, scale, panX, panY, paths } = this.state;
    if (!canvas || !ctx || !paths.length) return;
    
    // Draw start point marker
    if (paths[0].points.length > 0) {
      const startPoint = paths[0].points[0];
      const markerY = canvas.height - (startPoint.y * scale + panY);
      const markerX = startPoint.x * scale + panX;
      
      // Outer ring
      ctx.fillStyle = this.colors.startPoint;
      ctx.beginPath();
      ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner circle
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(markerX, markerY, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Label
      ctx.fillStyle = this.colors.legend.text;
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('START', markerX + 10, markerY + 4);
    }
    
    // Draw end point marker
    const lastPath = paths[paths.length - 1];
    if (lastPath.points.length > 0) {
      const endPoint = lastPath.points[lastPath.points.length - 1];
      const markerY = canvas.height - (endPoint.y * scale + panY);
      const markerX = endPoint.x * scale + panX;
      
      // Outer ring
      ctx.fillStyle = this.colors.endPoint;
      ctx.beginPath();
      ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner circle
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(markerX, markerY, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Label
      ctx.fillStyle = this.colors.legend.text;
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('END', markerX + 10, markerY + 4);
    }
  },
  
  /**
   * Draw legend showing cutting types by color
   */
  drawLegend: function(usedHFunctions) {
    const { canvas, ctx } = this.state;
    if (!canvas || !ctx) return;
    
    // Sort H functions for consistent display
    const sortedHFunctions = usedHFunctions.sort((a, b) => {
      const numA = parseInt(a.replace('H', ''));
      const numB = parseInt(b.replace('H', ''));
      return numA - numB;
    });
    
    // Add default cutting if no H functions
    const legendItems = [];
    if (sortedHFunctions.length === 0) {
      legendItems.push({ label: 'Cutting', color: this.colors.cutting, hFunction: null });
    } else {
      sortedHFunctions.forEach(hFunc => {
        let color = this.colors.cutting;
        
        // Get the description from settings
        let description = 'Cutting';
        if (NCConverter.state && NCConverter.state.settings && NCConverter.state.settings.hFunctions) {
          const settingsName = NCConverter.state.settings.hFunctions[hFunc.toUpperCase()];
          if (settingsName) {
            description = settingsName;
          }
        }
        
        // If no settings name found, try default H functions
        if (description === 'Cutting' && NCConverter.DEFAULT_H_FUNCTIONS) {
          const defaultName = NCConverter.DEFAULT_H_FUNCTIONS[hFunc.toUpperCase()];
          if (defaultName) {
            description = defaultName;
          }
        }
        
        // Assign colors based on H function
        const hLower = hFunc.toLowerCase();
        if (hLower.startsWith('h1')) {
          color = this.colors.h1;
        } else if (hLower.startsWith('h2')) {
          color = this.colors.h2;
        } else if (hLower.startsWith('h3')) {
          color = this.colors.h3;
        } else if (hLower.startsWith('h4')) {
          color = this.colors.h4;
        } else if (hLower.startsWith('h20')) {
          color = this.colors.h20;
        } else if (hLower.startsWith('h22')) {
          color = this.colors.h22;
        } else if (hLower.startsWith('h104')) {
          color = this.colors.h104;
        }
        
        legendItems.push({ label: `${hFunc} - ${description}`, color, hFunction: hFunc });
      });
    }
    
    if (legendItems.length === 0) return;
    
    // Calculate legend dimensions
    const itemHeight = 24;
    const padding = 12;
    const legendWidth = 180;
    const legendHeight = (legendItems.length * itemHeight) + (padding * 2) + 20; // +20 for title
    
    // Position legend in top-right corner
    const legendX = canvas.width - legendWidth - 20;
    const legendY = 20;
    
    // Draw legend background with modern styling
    ctx.fillStyle = this.colors.legend.background;
    ctx.strokeStyle = this.colors.legend.border;
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    
    this.roundRect(ctx, legendX, legendY, legendWidth, legendHeight, 8);
    ctx.fill();
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Draw legend title
    ctx.fillStyle = this.colors.legend.text;
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText('Cutting Types', legendX + padding, legendY + padding + 14);
    
    // Draw legend items
    ctx.font = '12px Inter, sans-serif';
    legendItems.forEach((item, index) => {
      const itemY = legendY + padding + 30 + (index * itemHeight);
      
      // Draw color indicator (line)
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(legendX + padding, itemY);
      ctx.lineTo(legendX + padding + 20, itemY);
      ctx.stroke();
      
      // Draw label
      ctx.fillStyle = this.colors.legend.text;
      ctx.fillText(item.label, legendX + padding + 30, itemY + 4);
    });
  },
  
  /**
   * Helper function to draw rounded rectangles
   */
  roundRect: function(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
};
