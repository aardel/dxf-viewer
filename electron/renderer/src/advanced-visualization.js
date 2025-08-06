/**
 * Advanced DIN Preview Visualization
 * Implements 2D canvas-based visualization with step-by-step execution controls
 * Based on external NC converter project analysis
 */

class AdvancedVisualization {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.container = null;
        this.modal = null;
        this.entities = [];
        this.currentStep = 0;
        this.isPlaying = false;
        this.playbackSpeed = 100; // ms per step
        this.playbackTimer = null;
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.viewportWidth = 800;
        this.viewportHeight = 600;
        this.boundingBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
        
        // Color coding for different cutting types
        this.cuttingColors = {
            'rapid': '#00ff00',      // Green for rapid moves
            'cut': '#ff4444',        // Red for cutting
            'pierce': '#ffff00',     // Yellow for pierce points
            'tool_change': '#ff8800', // Orange for tool changes
            'default': '#ffffff'     // White for default
        };
    }
    
    /**
     * Initialize the advanced visualization with DIN entities
     */
    async initialize(entities, dinContent) {
        this.entities = entities || [];
        this.dinContent = dinContent || '';
        
        if (this.entities.length === 0) {
            throw new Error('No entities provided for visualization');
        }
        
        // Calculate bounding box
        this.calculateBoundingBox();
        
        // Create and show the modal
        this.createModal();
        this.setupCanvas();
        this.setupControls();
        this.setupEventListeners();
        
        // Initial render
        this.fitToView();
        this.render();
    }
    
    /**
     * Calculate bounding box from entities
     */
    calculateBoundingBox() {
        if (this.entities.length === 0) return;
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.entities.forEach(entity => {
            if (entity.vertices) {
                entity.vertices.forEach(vertex => {
                    minX = Math.min(minX, vertex.x);
                    minY = Math.min(minY, vertex.y);
                    maxX = Math.max(maxX, vertex.x);
                    maxY = Math.max(maxY, vertex.y);
                });
            } else if (entity.x !== undefined && entity.y !== undefined) {
                minX = Math.min(minX, entity.x);
                minY = Math.min(minY, entity.y);
                maxX = Math.max(maxX, entity.x);
                maxY = Math.max(maxY, entity.y);
            }
        });
        
        this.boundingBox = {
            minX: minX !== Infinity ? minX : 0,
            minY: minY !== Infinity ? minY : 0,
            maxX: maxX !== -Infinity ? maxX : 100,
            maxY: maxY !== -Infinity ? maxY : 100
        };
    }
    
    /**
     * Create the modal UI structure
     */
    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'modal advanced-visualization-modal';
        this.modal.innerHTML = `
            <div class="modal-content advanced-viz-content">
                <div class="modal-header">
                    <h3>🎯 Advanced DIN Visualization</h3>
                    <button class="modal-close" id="advancedVizClose">&times;</button>
                </div>
                <div class="modal-body advanced-viz-body">
                    <div class="viz-toolbar">
                        <div class="viz-controls">
                            <button id="vizPlayPause" class="btn btn-primary btn-small">▶️ Play</button>
                            <button id="vizStep" class="btn btn-secondary btn-small">⏭️ Step</button>
                            <button id="vizReset" class="btn btn-secondary btn-small">⏮️ Reset</button>
                            <div class="viz-speed-control">
                                <label>Speed:</label>
                                <input type="range" id="vizSpeed" min="10" max="1000" value="100" step="10">
                                <span id="vizSpeedValue">100ms</span>
                            </div>
                        </div>
                        <div class="viz-info">
                            <span id="vizStepInfo">Step 0 / 0</span>
                            <span id="vizEntityInfo">Entity: None</span>
                        </div>
                    </div>
                    <div class="viz-main">
                        <div class="viz-canvas-container">
                            <canvas id="vizCanvas" width="800" height="600"></canvas>
                            <div class="viz-canvas-controls">
                                <button id="vizZoomIn" class="btn btn-tertiary btn-small" title="Zoom In">+</button>
                                <button id="vizZoomOut" class="btn btn-tertiary btn-small" title="Zoom Out">−</button>
                                <button id="vizFitView" class="btn btn-tertiary btn-small" title="Fit to View">⌂</button>
                                <button id="vizResetView" class="btn btn-tertiary btn-small" title="Reset View">↻</button>
                            </div>
                        </div>
                        <div class="viz-sidebar">
                            <div class="viz-legend">
                                <h4>Legend</h4>
                                <div class="legend-item">
                                    <span class="legend-color" style="background: #00ff00;"></span>
                                    <span>Rapid Move</span>
                                </div>
                                <div class="legend-item">
                                    <span class="legend-color" style="background: #ff4444;"></span>
                                    <span>Cutting</span>
                                </div>
                                <div class="legend-item">
                                    <span class="legend-color" style="background: #ffff00;"></span>
                                    <span>Pierce Point</span>
                                </div>
                                <div class="legend-item">
                                    <span class="legend-color" style="background: #ff8800;"></span>
                                    <span>Tool Change</span>
                                </div>
                            </div>
                            <div class="viz-entity-details">
                                <h4>Current Entity</h4>
                                <div id="vizEntityDetails">
                                    <div class="detail-row">
                                        <span class="detail-label">Type:</span>
                                        <span id="entityType">-</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Layer:</span>
                                        <span id="entityLayer">-</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Tool:</span>
                                        <span id="entityTool">-</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Color:</span>
                                        <span id="entityColor">-</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
    }
    
    /**
     * Setup canvas and get 2D context
     */
    setupCanvas() {
        this.canvas = document.getElementById('vizCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = this.canvas.parentElement;
        
        // Set canvas size
        this.viewportWidth = this.canvas.width;
        this.viewportHeight = this.canvas.height;
        
        // Enable high DPI
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.viewportWidth * dpr;
        this.canvas.height = this.viewportHeight * dpr;
        this.canvas.style.width = this.viewportWidth + 'px';
        this.canvas.style.height = this.viewportHeight + 'px';
        this.ctx.scale(dpr, dpr);
    }
    
    /**
     * Setup control buttons and event handlers
     */
    setupControls() {
        // Playback controls
        const playPauseBtn = document.getElementById('vizPlayPause');
        const stepBtn = document.getElementById('vizStep');
        const resetBtn = document.getElementById('vizReset');
        const speedSlider = document.getElementById('vizSpeed');
        const speedValue = document.getElementById('vizSpeedValue');
        
        playPauseBtn.addEventListener('click', () => this.togglePlayback());
        stepBtn.addEventListener('click', () => this.stepForward());
        resetBtn.addEventListener('click', () => this.reset());
        
        speedSlider.addEventListener('input', (e) => {
            this.playbackSpeed = parseInt(e.target.value);
            speedValue.textContent = this.playbackSpeed + 'ms';
        });
        
        // View controls
        const zoomInBtn = document.getElementById('vizZoomIn');
        const zoomOutBtn = document.getElementById('vizZoomOut');
        const fitViewBtn = document.getElementById('vizFitView');
        const resetViewBtn = document.getElementById('vizResetView');
        
        zoomInBtn.addEventListener('click', () => this.zoom(1.2));
        zoomOutBtn.addEventListener('click', () => this.zoom(0.8));
        fitViewBtn.addEventListener('click', () => this.fitToView());
        resetViewBtn.addEventListener('click', () => this.resetView());
        
        // Close button
        const closeBtn = document.getElementById('advancedVizClose');
        closeBtn.addEventListener('click', () => this.close());
    }
    
    /**
     * Setup event listeners for canvas interactions
     */
    setupEventListeners() {
        // Mouse events for panning
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        
        // Wheel event for zooming
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Modal close on background click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }
    
    /**
     * Mouse down handler for panning
     */
    onMouseDown(e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
    }
    
    /**
     * Mouse move handler for panning
     */
    onMouseMove(e) {
        if (!this.isDragging) return;
        
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;
        
        this.panX += deltaX;
        this.panY += deltaY;
        
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        this.render();
    }
    
    /**
     * Mouse up handler for panning
     */
    onMouseUp(e) {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
    }
    
    /**
     * Wheel handler for zooming
     */
    onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom(delta, e.clientX, e.clientY);
    }
    
    /**
     * Keyboard shortcuts handler
     */
    onKeyDown(e) {
        if (!this.modal.classList.contains('modal')) return;
        
        switch (e.key) {
            case ' ':
                e.preventDefault();
                this.togglePlayback();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.stepForward();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.stepBackward();
                break;
            case 'r':
                e.preventDefault();
                this.reset();
                break;
            case 'f':
                e.preventDefault();
                this.fitToView();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }
    
    /**
     * Zoom in/out at specified point
     */
    zoom(factor, centerX = null, centerY = null) {
        const oldScale = this.scale;
        this.scale *= factor;
        this.scale = Math.max(0.1, Math.min(10, this.scale));
        
        // Zoom towards mouse position if provided
        if (centerX !== null && centerY !== null) {
            const rect = this.canvas.getBoundingClientRect();
            const x = centerX - rect.left;
            const y = centerY - rect.top;
            
            this.panX = x - (x - this.panX) * (this.scale / oldScale);
            this.panY = y - (y - this.panY) * (this.scale / oldScale);
        }
        
        this.render();
    }
    
    /**
     * Fit drawing to view
     */
    fitToView() {
        const padding = 50;
        const drawingWidth = this.boundingBox.maxX - this.boundingBox.minX;
        const drawingHeight = this.boundingBox.maxY - this.boundingBox.minY;
        
        const scaleX = (this.viewportWidth - padding * 2) / drawingWidth;
        const scaleY = (this.viewportHeight - padding * 2) / drawingHeight;
        
        this.scale = Math.min(scaleX, scaleY);
        
        // Center the drawing
        const centerX = (this.boundingBox.minX + this.boundingBox.maxX) / 2;
        const centerY = (this.boundingBox.minY + this.boundingBox.maxY) / 2;
        
        this.panX = this.viewportWidth / 2 - centerX * this.scale;
        this.panY = this.viewportHeight / 2 - centerY * this.scale;
        
        this.render();
    }
    
    /**
     * Reset view to default
     */
    resetView() {
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.render();
    }
    
    /**
     * Toggle playback
     */
    togglePlayback() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    /**
     * Start playback
     */
    play() {
        if (this.currentStep >= this.entities.length) {
            this.reset();
        }
        
        this.isPlaying = true;
        document.getElementById('vizPlayPause').innerHTML = '⏸️ Pause';
        
        this.playbackTimer = setInterval(() => {
            this.stepForward();
            if (this.currentStep >= this.entities.length) {
                this.pause();
            }
        }, this.playbackSpeed);
    }
    
    /**
     * Pause playback
     */
    pause() {
        this.isPlaying = false;
        document.getElementById('vizPlayPause').innerHTML = '▶️ Play';
        
        if (this.playbackTimer) {
            clearInterval(this.playbackTimer);
            this.playbackTimer = null;
        }
    }
    
    /**
     * Step forward one entity
     */
    stepForward() {
        if (this.currentStep < this.entities.length) {
            this.currentStep++;
            this.updateStepInfo();
            this.render();
        }
    }
    
    /**
     * Step backward one entity
     */
    stepBackward() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateStepInfo();
            this.render();
        }
    }
    
    /**
     * Reset to beginning
     */
    reset() {
        this.pause();
        this.currentStep = 0;
        this.updateStepInfo();
        this.render();
    }
    
    /**
     * Update step information display
     */
    updateStepInfo() {
        const stepInfo = document.getElementById('vizStepInfo');
        const entityInfo = document.getElementById('vizEntityInfo');
        
        stepInfo.textContent = `Step ${this.currentStep} / ${this.entities.length}`;
        
        if (this.currentStep > 0 && this.currentStep <= this.entities.length) {
            const entity = this.entities[this.currentStep - 1];
            entityInfo.textContent = `Entity: ${entity.type || 'Unknown'}`;
            
            // Update entity details
            this.updateEntityDetails(entity);
        } else {
            entityInfo.textContent = 'Entity: None';
            this.updateEntityDetails(null);
        }
    }
    
    /**
     * Update entity details panel
     */
    updateEntityDetails(entity) {
        const typeEl = document.getElementById('entityType');
        const layerEl = document.getElementById('entityLayer');
        const toolEl = document.getElementById('entityTool');
        const colorEl = document.getElementById('entityColor');
        
        if (entity) {
            typeEl.textContent = entity.type || 'Unknown';
            layerEl.textContent = entity.layer || 'Unknown';
            toolEl.textContent = entity.tool || 'None';
            colorEl.textContent = entity.color || 'Default';
        } else {
            typeEl.textContent = '-';
            layerEl.textContent = '-';
            toolEl.textContent = '-';
            colorEl.textContent = '-';
        }
    }
    
    /**
     * Render the visualization
     */
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
        
        // Save context
        this.ctx.save();
        
        // Apply transformations
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.scale, this.scale);
        
        // Render grid
        this.renderGrid();
        
        // Render entities up to current step
        for (let i = 0; i < this.currentStep; i++) {
            this.renderEntity(this.entities[i], i === this.currentStep - 1);
        }
        
        // Restore context
        this.ctx.restore();
        
        // Render UI overlay
        this.renderOverlay();
    }
    
    /**
     * Render background grid
     */
    renderGrid() {
        const gridSize = 10;
        const gridColor = '#333';
        
        this.ctx.strokeStyle = gridColor;
        this.ctx.lineWidth = 0.5 / this.scale;
        
        const startX = Math.floor((this.boundingBox.minX - 100) / gridSize) * gridSize;
        const endX = Math.ceil((this.boundingBox.maxX + 100) / gridSize) * gridSize;
        const startY = Math.floor((this.boundingBox.minY - 100) / gridSize) * gridSize;
        const endY = Math.ceil((this.boundingBox.maxY + 100) / gridSize) * gridSize;
        
        this.ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += gridSize) {
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
        }
        this.ctx.stroke();
    }
    
    /**
     * Render a single entity
     */
    renderEntity(entity, isCurrent = false) {
        if (!entity) return;
        
        // Determine color based on entity type
        let color = this.cuttingColors.default;
        if (entity.rapid) {
            color = this.cuttingColors.rapid;
        } else if (entity.type === 'pierce') {
            color = this.cuttingColors.pierce;
        } else if (entity.type === 'tool_change') {
            color = this.cuttingColors.tool_change;
        } else if (entity.cutting) {
            color = this.cuttingColors.cut;
        }
        
        // Highlight current entity
        if (isCurrent) {
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = 5 / this.scale;
        }
        
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.lineWidth = (isCurrent ? 2 : 1) / this.scale;
        
        // Render based on entity type
        switch (entity.type) {
            case 'line':
                this.renderLine(entity);
                break;
            case 'arc':
                this.renderArc(entity);
                break;
            case 'circle':
                this.renderCircle(entity);
                break;
            case 'polyline':
                this.renderPolyline(entity);
                break;
            case 'point':
            case 'pierce':
                this.renderPoint(entity);
                break;
            default:
                this.renderGeneric(entity);
                break;
        }
        
        // Reset shadow
        this.ctx.shadowBlur = 0;
    }
    
    /**
     * Render a line entity
     */
    renderLine(entity) {
        this.ctx.beginPath();
        this.ctx.moveTo(entity.start?.x || 0, entity.start?.y || 0);
        this.ctx.lineTo(entity.end?.x || 0, entity.end?.y || 0);
        this.ctx.stroke();
    }
    
    /**
     * Render an arc entity
     */
    renderArc(entity) {
        const center = entity.center || { x: 0, y: 0 };
        const radius = entity.radius || 10;
        const startAngle = entity.startAngle || 0;
        const endAngle = entity.endAngle || Math.PI * 2;
        
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, radius, startAngle, endAngle);
        this.ctx.stroke();
    }
    
    /**
     * Render a circle entity
     */
    renderCircle(entity) {
        const center = entity.center || { x: 0, y: 0 };
        const radius = entity.radius || 10;
        
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    /**
     * Render a polyline entity
     */
    renderPolyline(entity) {
        if (!entity.vertices || entity.vertices.length < 2) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(entity.vertices[0].x, entity.vertices[0].y);
        
        for (let i = 1; i < entity.vertices.length; i++) {
            this.ctx.lineTo(entity.vertices[i].x, entity.vertices[i].y);
        }
        
        if (entity.closed) {
            this.ctx.closePath();
        }
        
        this.ctx.stroke();
    }
    
    /**
     * Render a point entity
     */
    renderPoint(entity) {
        const x = entity.x || 0;
        const y = entity.y || 0;
        const size = 3 / this.scale;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    /**
     * Render generic entity
     */
    renderGeneric(entity) {
        if (entity.vertices && entity.vertices.length > 0) {
            this.renderPolyline(entity);
        } else if (entity.x !== undefined && entity.y !== undefined) {
            this.renderPoint(entity);
        }
    }
    
    /**
     * Render UI overlay
     */
    renderOverlay() {
        // Render coordinate system indicator
        this.ctx.save();
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = '#fff';
        
        // Origin indicator
        const originX = this.panX;
        const originY = this.panY;
        
        this.ctx.beginPath();
        this.ctx.moveTo(originX - 10, originY);
        this.ctx.lineTo(originX + 10, originY);
        this.ctx.moveTo(originX, originY - 10);
        this.ctx.lineTo(originX, originY + 10);
        this.ctx.stroke();
        
        this.ctx.fillText('(0,0)', originX + 15, originY - 5);
        
        this.ctx.restore();
    }
    
    /**
     * Close the visualization modal
     */
    close() {
        this.pause();
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
    }
}

// Export for use in main renderer
export { AdvancedVisualization };
