/**
 * Header Controls Component
 * Manages warning indicators and smart generate button in the main header
 */

class HeaderControls {
    constructor() {
        this.mappingStatus = {
            totalLayers: 0,
            mappedLayers: 0,
            unmappedLayers: 0,
            unmappedLayerNames: []
        };
        
        this.elements = {};
        this.init();
    }

    init() {
        this.createElements();
        this.attachEventListeners();
        this.updateStatus();
    }

    createElements() {
        // Get the inline header controls container
        let headerContainer = document.getElementById('header-controls');
        if (!headerContainer) {
            console.error('Header controls container not found');
            return;
        }

        // Update container class for inline styling
        headerContainer.className = 'header-controls-inline';

        // Create warning indicator
        this.elements.warningIndicator = document.createElement('div');
        this.elements.warningIndicator.className = 'warning-indicator';
        this.elements.warningIndicator.innerHTML = `
            <div class="warning-icon" title="Layer Mapping Status">
                <span class="warning-symbol">⚠️</span>
                <span class="warning-count">0</span>
            </div>
            <div class="warning-tooltip">
                <div class="tooltip-header">Layer Mapping Status</div>
                <div class="tooltip-content">
                    <div class="status-line">
                        <span class="status-label">Total Layers:</span>
                        <span class="status-value total-count">0</span>
                    </div>
                    <div class="status-line">
                        <span class="status-label">Mapped:</span>
                        <span class="status-value mapped-count">0</span>
                    </div>
                    <div class="status-line">
                        <span class="status-label">Unmapped:</span>
                        <span class="status-value unmapped-count">0</span>
                    </div>
                    <div class="status-line">
                        <span class="status-label">NO OUTPUT:</span>
                        <span class="status-value no-output-count">0</span>
                    </div>
                    <div class="unmapped-list"></div>
                </div>
            </div>
        `;

        // Create smart generate button
        this.elements.generateButton = document.createElement('button');
        this.elements.generateButton.className = 'smart-generate-btn';
        this.elements.generateButton.innerHTML = `
            <span class="btn-icon">💾</span>
            <span class="btn-text">Generate DIN</span>
            <span class="btn-status"></span>
        `;

        // Create batch monitor button
        this.elements.batchMonitorButton = document.createElement('button');
        this.elements.batchMonitorButton.className = 'batch-monitor-btn';
        this.elements.batchMonitorButton.innerHTML = `
            <span class="btn-icon">🔍</span>
            <span class="btn-text">Batch Monitor</span>
        `;
        this.elements.batchMonitorButton.title = 'Open DXF Batch Monitor for automated processing';

        // Add elements to container
        headerContainer.appendChild(this.elements.warningIndicator);
        headerContainer.appendChild(this.elements.generateButton);
        headerContainer.appendChild(this.elements.batchMonitorButton);

        // Cache frequently used elements
        this.elements.warningIcon = this.elements.warningIndicator.querySelector('.warning-icon');
        this.elements.warningSymbol = this.elements.warningIndicator.querySelector('.warning-symbol');
        this.elements.warningCount = this.elements.warningIndicator.querySelector('.warning-count');
        this.elements.tooltip = this.elements.warningIndicator.querySelector('.warning-tooltip');
        this.elements.totalCount = this.elements.tooltip.querySelector('.total-count');
        this.elements.mappedCount = this.elements.tooltip.querySelector('.mapped-count');
        this.elements.unmappedCount = this.elements.tooltip.querySelector('.unmapped-count');
        this.elements.noOutputCount = this.elements.tooltip.querySelector('.no-output-count');
        this.elements.unmappedList = this.elements.tooltip.querySelector('.unmapped-list');
        this.elements.btnIcon = this.elements.generateButton.querySelector('.btn-icon');
        this.elements.btnText = this.elements.generateButton.querySelector('.btn-text');
        this.elements.btnStatus = this.elements.generateButton.querySelector('.btn-status');
    }

    attachEventListeners() {
        // Warning indicator hover
        this.elements.warningIndicator.addEventListener('mouseenter', () => {
            this.showTooltip();
        });

        this.elements.warningIndicator.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });

        // Generate button click
        this.elements.generateButton.addEventListener('click', () => {
            this.handleGenerateClick();
        });

        // Batch monitor button click
        this.elements.batchMonitorButton.addEventListener('click', () => {
            this.handleBatchMonitorClick();
        });

        // Listen for mapping updates from the main application
        document.addEventListener('mappingStatusUpdated', (event) => {
            this.updateMappingStatus(event.detail);
        });

        // Listen for DXF load events
        document.addEventListener('dxfLoaded', (event) => {
            this.onDxfLoaded(event.detail);
        });
        // Also listen for unified updates to refresh status on DDS/CFF2 changes
        document.addEventListener('mappingStatusUpdated', (event) => {
            this.updateMappingStatus(event.detail);
        });
    }

    updateMappingStatus(statusData) {
        this.mappingStatus = {
            totalLayers: statusData.totalLayers || 0,
            mappedLayers: statusData.mappedLayers || 0,
            unmappedLayers: statusData.unmappedLayers || 0,
            noOutputLayers: statusData.noOutputLayers || 0,
            unmappedLayerNames: statusData.unmappedLayerNames || [],
            noOutputLayerNames: statusData.noOutputLayerNames || [],
            visibleMappedLayers: statusData.visibleMappedLayers || 0,
            readyForGeneration: statusData.readyForGeneration || false,
            generationBlockers: statusData.generationBlockers || []
        };

        this.updateStatus();
    }

    updateStatus() {
        const { totalLayers, mappedLayers, unmappedLayers, unmappedLayerNames, readyForGeneration, generationBlockers } = this.mappingStatus;
        const isComplete = readyForGeneration && totalLayers > 0;  // Use enhanced readiness check
        const hasLayers = totalLayers > 0;

        // Update warning indicator
        this.updateWarningIndicator(isComplete, hasLayers, unmappedLayers);
        
        // Update generate button
        this.updateGenerateButton(isComplete, hasLayers, generationBlockers);
        
        // Update tooltip content
        this.updateTooltipContent();
    }

    updateWarningIndicator(isComplete, hasLayers, unmappedLayers) {
        if (!hasLayers) {
            // No DXF loaded
            this.elements.warningIcon.className = 'warning-icon status-none';
            this.elements.warningSymbol.textContent = '📄';
            this.elements.warningCount.textContent = '';
            this.elements.warningCount.style.display = 'none';
        } else if (isComplete) {
            // All layers mapped
            this.elements.warningIcon.className = 'warning-icon status-complete';
            this.elements.warningSymbol.textContent = '✅';
            this.elements.warningCount.textContent = '';
            this.elements.warningCount.style.display = 'none';
        } else {
            // Has unmapped layers
            this.elements.warningIcon.className = 'warning-icon status-warning';
            this.elements.warningSymbol.textContent = '⚠️';
            this.elements.warningCount.textContent = unmappedLayers;
            this.elements.warningCount.style.display = 'inline';
        }
    }

    updateGenerateButton(isComplete, hasLayers, generationBlockers = []) {
        if (!hasLayers) {
            // No DXF loaded
            this.elements.generateButton.className = 'smart-generate-btn disabled';
            this.elements.generateButton.disabled = true;
            this.elements.btnIcon.textContent = '📄';
            this.elements.btnText.textContent = 'Load File First';
            this.elements.btnStatus.textContent = '';
        } else if (isComplete) {
            // Ready to generate
            this.elements.generateButton.className = 'smart-generate-btn ready';
            this.elements.generateButton.disabled = false;
            this.elements.btnIcon.textContent = '✅';
            this.elements.btnText.textContent = 'Generate DIN';
            this.elements.btnStatus.textContent = 'Ready';
        } else {
            // Missing mappings or other blockers
            this.elements.generateButton.className = 'smart-generate-btn warning';
            this.elements.generateButton.disabled = true;
            this.elements.btnIcon.textContent = '⚠️';
            
            if (generationBlockers.length > 0) {
                this.elements.btnText.textContent = 'Cannot Generate';
                this.elements.btnStatus.textContent = generationBlockers[0]; // Show first blocker
            } else {
                this.elements.btnText.textContent = 'Missing Mappings';
                this.elements.btnStatus.textContent = `${this.mappingStatus.unmappedLayers} unmapped`;
            }
        }
    }

    updateTooltipContent() {
        const { totalLayers, mappedLayers, unmappedLayers, noOutputLayers, unmappedLayerNames, noOutputLayerNames,
                visibleMappedLayers, readyForGeneration, generationBlockers } = this.mappingStatus;
        
        this.elements.totalCount.textContent = totalLayers;
        this.elements.mappedCount.textContent = mappedLayers;
        this.elements.unmappedCount.textContent = unmappedLayers;
        this.elements.noOutputCount.textContent = noOutputLayers;

        // Build tooltip content
        let tooltipContent = '';

        // Add NO OUTPUT layers info if any
        if (noOutputLayers > 0) {
            const noOutputHtml = noOutputLayerNames
                .map(layerName => `<div class="no-output-layer">• ${layerName}</div>`)
                .join('');
            tooltipContent += `
                <div class="no-output-layers-title">NO OUTPUT Palettes:</div>
                ${noOutputHtml}
            `;
        }

        // Update unmapped layers list
        if (unmappedLayerNames.length > 0) {
            const listHtml = unmappedLayerNames
                .map(layerName => `<div class="unmapped-layer">• ${layerName}</div>`)
                .join('');
            tooltipContent += `
                <div class="unmapped-layers-title">Unmapped Layers:</div>
                ${listHtml}
            `;
        } else if (noOutputLayers === 0) {
            tooltipContent += '<div class="no-unmapped">All layers mapped!</div>';
        }
        
        // Add generation readiness info
        if (generationBlockers && generationBlockers.length > 0) {
            const blockersHtml = generationBlockers
                .map(blocker => `<div class="generation-blocker">• ${blocker}</div>`)
                .join('');
            tooltipContent += `
                <div class="generation-blockers-title">Generation Issues:</div>
                ${blockersHtml}
            `;
        }
        
        // Add visible layers info if available
        if (typeof visibleMappedLayers !== 'undefined') {
            tooltipContent += `
                <div class="visible-info">Visible mapped layers: ${visibleMappedLayers}</div>
            `;
        }

        this.elements.unmappedList.innerHTML = tooltipContent;
    }

    showTooltip() {
        this.elements.tooltip.style.display = 'block';
        
        // Position tooltip below the warning icon, but check for viewport constraints
        const rect = this.elements.warningIcon.getBoundingClientRect();
        const tooltipRect = this.elements.tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Calculate optimal position
        let left = rect.left;
        let top = rect.bottom + 10;
        
        // Ensure tooltip doesn't go off the right edge
        if (left + tooltipRect.width > viewportWidth - 20) {
            left = viewportWidth - tooltipRect.width - 20;
        }
        
        // If tooltip would overlap with canvas controls area (top-right), move it to the left
        const canvasControlsArea = {
            right: viewportWidth - 20,
            left: viewportWidth - 200, // Approximate canvas controls width
            top: 120, // Header height + some padding
            bottom: 300 // Approximate height of controls area
        };
        
        if (left + tooltipRect.width > canvasControlsArea.left && 
            top < canvasControlsArea.bottom) {
            // Position to the left of the warning icon instead
            left = rect.left - tooltipRect.width - 10;
            
            // If that goes off screen, position above the warning icon
            if (left < 20) {
                left = rect.left;
                top = rect.top - tooltipRect.height - 10;
            }
        }
        
        // Ensure tooltip doesn't go off the top
        if (top < 10) {
            top = rect.bottom + 10;
        }
        
        // Ensure tooltip doesn't go off the left edge
        if (left < 10) {
            left = 10;
        }
        
        this.elements.tooltip.style.left = `${left}px`;
        this.elements.tooltip.style.top = `${top}px`;
    }

    hideTooltip() {
        this.elements.tooltip.style.display = 'none';
    }

    async handleGenerateClick() {
        if (this.elements.generateButton.disabled) {
            return;
        }

        try {
            // Show processing state
            this.setProcessingState(true);

            // Call the existing DIN generation function
            if (typeof window.generateDinContentSilently === 'function') {
                const dinContent = await window.generateDinContentSilently();
                
                // Save the file using the proper save function
                if (typeof window.saveDinFile === 'function') {
                    await window.saveDinFile(dinContent);
                    this.showSuccessAnimation();
                } else if (window.electronAPI && window.electronAPI.saveDinFile) {
                    const saved = await window.electronAPI.saveDinFile(dinContent);
                    if (saved) {
                        this.showSuccessAnimation();
                    }
                } else {
                    // Fallback: trigger download
                    this.downloadDinFile(dinContent);
                    this.showSuccessAnimation();
                }
            } else {
                throw new Error('DIN generation function not available');
            }

        } catch (error) {
            console.error('Generate DIN failed:', error);
            this.showErrorState(error.message);
        } finally {
            this.setProcessingState(false);
        }
    }

    setProcessingState(isProcessing) {
        if (isProcessing) {
            this.elements.generateButton.className = 'smart-generate-btn processing';
            this.elements.generateButton.disabled = true;
            this.elements.btnIcon.textContent = '⏳';
            this.elements.btnText.textContent = 'Generating...';
            this.elements.btnStatus.textContent = '';
        } else {
            this.updateStatus(); // Restore normal state
        }
    }

    showSuccessAnimation() {
        // Temporary success state
        this.elements.generateButton.className = 'smart-generate-btn success';
        this.elements.btnIcon.textContent = '✅';
        this.elements.btnText.textContent = 'Generated!';
        this.elements.btnStatus.textContent = 'Success';

        // Reset after animation
        setTimeout(() => {
            this.updateStatus();
        }, 2000);
    }

    showErrorState(errorMessage) {
        this.elements.generateButton.className = 'smart-generate-btn error';
        this.elements.btnIcon.textContent = '❌';
        this.elements.btnText.textContent = 'Generation Failed';
        this.elements.btnStatus.textContent = errorMessage.substring(0, 20) + '...';

        // Reset after delay
        setTimeout(() => {
            this.updateStatus();
        }, 3000);
    }

    downloadDinFile(content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'output.din';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    onDxfLoaded(dxfData) {
        // Reset status when new DXF is loaded
        console.log('DXF loaded, updating header controls');
        // The mapping status will be updated by the mapping system
    }

    handleBatchMonitorClick() {
        try {
            if (window.electronAPI && window.electronAPI.openBatchMonitor) {
                window.electronAPI.openBatchMonitor();
            } else {
                console.error('Electron API not available for batch monitor');
            }
        } catch (error) {
            console.error('Failed to open batch monitor:', error);
        }
    }

    // Public method to manually trigger status update
    refresh() {
        this.updateStatus();
    }
}

// Global instance
window.headerControls = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.headerControls = new HeaderControls();
    });
} else {
    window.headerControls = new HeaderControls();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeaderControls;
}
