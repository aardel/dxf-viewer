// Mapping Wizard Logic
class MappingWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.selectedLayers = [];
        this.lineTypes = [];
        this.tools = [];
        this.mappings = {};
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadData();
    }
    
    initializeElements() {
        // Progress elements
        this.progressSteps = document.querySelectorAll('.progress-step');
        this.wizardSteps = document.querySelectorAll('.wizard-step');
        
        // Navigation buttons
        this.backBtn = document.getElementById('backBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.finishBtn = document.getElementById('finishBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        
        // Step 1 elements
        this.layersList = document.getElementById('layersList');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.deselectAllBtn = document.getElementById('deselectAllBtn');
        this.selectByColorBtn = document.getElementById('selectByColorBtn');
        
        // Step 2 elements
        this.lineTypesGrid = document.getElementById('lineTypesGrid');
        
        // Step 3 elements
        this.toolsGrid = document.getElementById('toolsGrid');
        
        // Step 4 elements
        this.mappingSummary = document.getElementById('mappingSummary');
        this.saveToGlobalFilter = document.getElementById('saveToGlobalFilter');
        this.createFileSpecificMappings = document.getElementById('createFileSpecificMappings');
        
        // Modal elements
        this.colorSelectionModal = document.getElementById('colorSelectionModal');
        this.colorOptions = document.getElementById('colorOptions');
        this.colorModalClose = document.getElementById('colorModalClose');
        this.colorModalCancel = document.getElementById('colorModalCancel');
        this.colorModalApply = document.getElementById('colorModalApply');
    }
    
    setupEventListeners() {
        // Navigation
        this.backBtn.addEventListener('click', () => this.previousStep());
        this.nextBtn.addEventListener('click', () => this.nextStep());
        this.finishBtn.addEventListener('click', () => this.finishWizard());
        this.cancelBtn.addEventListener('click', () => this.cancelWizard());
        
        // Step 1 controls
        this.selectAllBtn.addEventListener('click', () => this.selectAllLayers());
        this.deselectAllBtn.addEventListener('click', () => this.deselectAllLayers());
        this.selectByColorBtn.addEventListener('click', () => this.showColorSelectionModal());
        
        // Modal controls
        this.colorModalClose.addEventListener('click', () => this.hideColorSelectionModal());
        this.colorModalCancel.addEventListener('click', () => this.hideColorSelectionModal());
        this.colorModalApply.addEventListener('click', () => this.applyColorSelection());
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cancelWizard();
            }
        });
    }
    
    async loadData() {
        try {
            // Load line types
            const lineTypesResponse = await window.electronAPI.getInternalLineTypes();
            this.lineTypes = lineTypesResponse || [];
            
            // Load tools
            const toolsResponse = await window.electronAPI.getMachineTools();
            this.tools = toolsResponse || [];
            
            // Load unmatched layers from the main window
            const unmatchedLayers = await this.getUnmatchedLayers();
            this.unmatchedLayers = unmatchedLayers;
            
            this.renderStep1();
        } catch (error) {
            console.error('Error loading wizard data:', error);
            this.showError('Failed to load wizard data');
        }
    }
    
    async getUnmatchedLayers() {
        try {
            // Get current DXF layers from the main window
            const dxfLayers = await window.electronAPI.getDxfLayers();
            
            // Get global import filter
            const globalFilterResponse = await window.electronAPI.loadGlobalImportFilter();
            const globalFilter = globalFilterResponse.data;
            
            // Filter out layers that already have rules
            const unmatchedLayers = dxfLayers.filter(layer => {
                return !globalFilter.rules.some(rule => 
                    rule.layerName.toLowerCase() === layer.name.toLowerCase()
                );
            });
            
            return unmatchedLayers;
        } catch (error) {
            console.error('Error getting unmatched layers:', error);
            return [];
        }
    }
    
    renderStep1() {
        if (!this.unmatchedLayers || this.unmatchedLayers.length === 0) {
            this.layersList.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #6c757d;">
                    No unmatched layers found. All layers already have mapping rules.
                </div>
            `;
            this.nextBtn.disabled = true;
            return;
        }
        
        this.layersList.innerHTML = '';
        
        this.unmatchedLayers.forEach(layer => {
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerName = layer.name;
            
            layerItem.innerHTML = `
                <input type="checkbox" class="layer-checkbox" data-layer-name="${layer.name}">
                <div class="layer-info">
                    <div class="layer-color" style="background-color: ${layer.colorHex};"></div>
                    <div class="layer-details">
                        <div class="layer-name">${layer.displayName || layer.name}</div>
                        <div class="layer-meta">${layer.objectCount} objects • ${layer.colorHex}</div>
                    </div>
                </div>
            `;
            
            const checkbox = layerItem.querySelector('.layer-checkbox');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedLayers.push(layer);
                    layerItem.classList.add('selected');
                } else {
                    this.selectedLayers = this.selectedLayers.filter(l => l.name !== layer.name);
                    layerItem.classList.remove('selected');
                }
                this.updateNextButton();
            });
            
            this.layersList.appendChild(layerItem);
        });
        
        this.updateNextButton();
    }
    
    renderStep2() {
        this.lineTypesGrid.innerHTML = '';
        
        this.lineTypes.forEach(lineType => {
            const card = document.createElement('div');
            card.className = 'line-type-card';
            card.dataset.lineTypeId = lineType.id;
            
            card.innerHTML = `
                <div class="line-type-name">${lineType.name}</div>
                <div class="line-type-description">${lineType.description || 'No description'}</div>
                <div class="line-type-meta">
                    <span>Type: ${lineType.type || 'Unknown'}</span>
                    <span>Width: ${lineType.width || 'N/A'}</span>
                </div>
            `;
            
            card.addEventListener('click', () => {
                // Remove selection from other cards
                this.lineTypesGrid.querySelectorAll('.line-type-card').forEach(c => 
                    c.classList.remove('selected')
                );
                
                // Select this card
                card.classList.add('selected');
                
                // Assign line type to all selected layers
                this.selectedLayers.forEach(layer => {
                    if (!this.mappings[layer.name]) {
                        this.mappings[layer.name] = {};
                    }
                    this.mappings[layer.name].lineTypeId = lineType.id;
                    this.mappings[layer.name].lineTypeName = lineType.name;
                });
                
                this.updateNextButton();
            });
            
            this.lineTypesGrid.appendChild(card);
        });
    }
    
    renderStep3() {
        this.toolsGrid.innerHTML = '';
        
        this.tools.forEach(tool => {
            const card = document.createElement('div');
            card.className = 'tool-card';
            card.dataset.toolId = tool.id;
            
            card.innerHTML = `
                <div class="tool-name">${tool.name}</div>
                <div class="tool-description">${tool.description || 'No description'}</div>
                <div class="tool-specs">
                    <span>Width: ${tool.width || 'N/A'}</span>
                    <span>H-Code: ${tool.hCode || 'N/A'}</span>
                </div>
            `;
            
            card.addEventListener('click', () => {
                // Remove selection from other cards
                this.toolsGrid.querySelectorAll('.tool-card').forEach(c => 
                    c.classList.remove('selected')
                );
                
                // Select this card
                card.classList.add('selected');
                
                // Assign tool to all selected layers
                this.selectedLayers.forEach(layer => {
                    if (!this.mappings[layer.name]) {
                        this.mappings[layer.name] = {};
                    }
                    this.mappings[layer.name].toolId = tool.id;
                    this.mappings[layer.name].toolName = tool.name;
                });
                
                this.updateNextButton();
            });
            
            this.toolsGrid.appendChild(card);
        });
    }
    
    renderStep4() {
        this.mappingSummary.innerHTML = '';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'summary-row summary-header';
        header.innerHTML = `
            <div class="summary-cell">Layer</div>
            <div class="summary-cell">Line Type</div>
            <div class="summary-cell">Tool</div>
            <div class="summary-cell">Color</div>
        `;
        this.mappingSummary.appendChild(header);
        
        // Create rows for each mapping
        Object.entries(this.mappings).forEach(([layerName, mapping]) => {
            const layer = this.unmatchedLayers.find(l => l.name === layerName);
            if (!layer) return;
            
            const row = document.createElement('div');
            row.className = 'summary-row';
            row.innerHTML = `
                <div class="summary-cell">${layer.displayName || layer.name}</div>
                <div class="summary-cell">${mapping.lineTypeName || 'Not selected'}</div>
                <div class="summary-cell">${mapping.toolName || 'Not selected'}</div>
                <div class="summary-cell">
                    <div class="layer-color" style="background-color: ${layer.colorHex}; width: 20px; height: 20px; display: inline-block; border-radius: 3px;"></div>
                    ${layer.colorHex}
                </div>
            `;
            this.mappingSummary.appendChild(row);
        });
    }
    
    selectAllLayers() {
        this.layersList.querySelectorAll('.layer-checkbox').forEach(checkbox => {
            checkbox.checked = true;
            const layerItem = checkbox.closest('.layer-item');
            layerItem.classList.add('selected');
        });
        
        this.selectedLayers = [...this.unmatchedLayers];
        this.updateNextButton();
    }
    
    deselectAllLayers() {
        this.layersList.querySelectorAll('.layer-checkbox').forEach(checkbox => {
            checkbox.checked = false;
            const layerItem = checkbox.closest('.layer-item');
            layerItem.classList.remove('selected');
        });
        
        this.selectedLayers = [];
        this.updateNextButton();
    }
    
    showColorSelectionModal() {
        const uniqueColors = [...new Set(this.unmatchedLayers.map(l => l.colorHex))];
        
        this.colorOptions.innerHTML = '';
        uniqueColors.forEach(color => {
            const option = document.createElement('div');
            option.className = 'color-option';
            option.dataset.color = color;
            
            option.innerHTML = `
                <div class="color-swatch" style="background-color: ${color};"></div>
                <div class="color-label">${color}</div>
            `;
            
            option.addEventListener('click', () => {
                option.classList.toggle('selected');
            });
            
            this.colorOptions.appendChild(option);
        });
        
        this.colorSelectionModal.classList.remove('hidden');
    }
    
    hideColorSelectionModal() {
        this.colorSelectionModal.classList.add('hidden');
    }
    
    applyColorSelection() {
        const selectedColors = Array.from(this.colorOptions.querySelectorAll('.color-option.selected'))
            .map(option => option.dataset.color);
        
        this.layersList.querySelectorAll('.layer-checkbox').forEach(checkbox => {
            const layerItem = checkbox.closest('.layer-item');
            const layerColor = layerItem.querySelector('.layer-color').style.backgroundColor;
            const hexColor = this.rgbToHex(layerColor);
            
            if (selectedColors.includes(hexColor)) {
                checkbox.checked = true;
                layerItem.classList.add('selected');
            } else {
                checkbox.checked = false;
                layerItem.classList.remove('selected');
            }
        });
        
        this.selectedLayers = this.unmatchedLayers.filter(layer => 
            selectedColors.includes(layer.colorHex)
        );
        
        this.updateNextButton();
        this.hideColorSelectionModal();
    }
    
    rgbToHex(rgb) {
        // Convert rgb(r, g, b) to hex
        const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return rgb;
        
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    nextStep() {
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.updateStep();
        }
    }
    
    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStep();
        }
    }
    
    updateStep() {
        // Update progress indicators
        this.progressSteps.forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.remove('active', 'completed');
            
            if (stepNumber < this.currentStep) {
                step.classList.add('completed');
            } else if (stepNumber === this.currentStep) {
                step.classList.add('active');
            }
        });
        
        // Update step content
        this.wizardSteps.forEach((step, index) => {
            step.classList.remove('active');
            if (index + 1 === this.currentStep) {
                step.classList.add('active');
            }
        });
        
        // Update buttons
        this.backBtn.disabled = this.currentStep === 1;
        this.nextBtn.style.display = this.currentStep === this.totalSteps ? 'none' : 'inline-flex';
        this.finishBtn.style.display = this.currentStep === this.totalSteps ? 'inline-flex' : 'none';
        
        // Render step content
        switch (this.currentStep) {
            case 1:
                this.renderStep1();
                break;
            case 2:
                this.renderStep2();
                break;
            case 3:
                this.renderStep3();
                break;
            case 4:
                this.renderStep4();
                break;
        }
        
        this.updateNextButton();
    }
    
    updateNextButton() {
        let canProceed = false;
        
        switch (this.currentStep) {
            case 1:
                canProceed = this.selectedLayers.length > 0;
                break;
            case 2:
                canProceed = this.selectedLayers.some(layer => this.mappings[layer.name]?.lineTypeId);
                break;
            case 3:
                canProceed = this.selectedLayers.some(layer => this.mappings[layer.name]?.toolId);
                break;
            case 4:
                canProceed = true;
                break;
        }
        
        this.nextBtn.disabled = !canProceed;
        this.finishBtn.disabled = !canProceed;
    }
    
    async finishWizard() {
        try {
            const rules = [];
            
            Object.entries(this.mappings).forEach(([layerName, mapping]) => {
                const layer = this.unmatchedLayers.find(l => l.name === layerName);
                if (!layer || !mapping.lineTypeId || !mapping.toolId) return;
                
                rules.push({
                    layerName: layerName,
                    color: layer.colorHex,
                    lineTypeId: mapping.lineTypeId,
                    description: `Mapped via wizard for ${layer.displayName || layerName}`,
                    source: 'mapping_wizard'
                });
            });
            
            if (rules.length === 0) {
                this.showError('No valid mappings to save');
                return;
            }
            
            // Save to global import filter
            if (this.saveToGlobalFilter.checked) {
                for (const rule of rules) {
                    await window.electronAPI.addRuleToGlobalImportFilter(rule);
                }
            }
            
            // Create file-specific mappings
            if (this.createFileSpecificMappings.checked) {
                // TODO: Implement file-specific mapping creation
                console.log('File-specific mappings not yet implemented');
            }
            
            this.showSuccess(`Successfully created ${rules.length} mapping rules`);
            
            // Close the wizard
            setTimeout(() => {
                window.close();
            }, 1500);
            
        } catch (error) {
            console.error('Error finishing wizard:', error);
            this.showError('Failed to save mappings');
        }
    }
    
    cancelWizard() {
        if (confirm('Are you sure you want to cancel? All mapping progress will be lost.')) {
            window.close();
        }
    }
    
    showError(message) {
        // Simple error display - could be enhanced with a proper notification system
        alert(`Error: ${message}`);
    }
    
    showSuccess(message) {
        // Simple success display - could be enhanced with a proper notification system
        alert(`Success: ${message}`);
    }
}

// Initialize the wizard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MappingWizard();
}); 