// Global Import Filter Manager
let globalFilter = null;
let lineTypes = [];

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadGlobalFilter();
        await loadLineTypes();
        updateStatistics();
        renderRulesTable();
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing Global Import Filter Manager:', error);
        showError('Failed to initialize: ' + error.message);
    }
});

// Load global import filter
async function loadGlobalFilter() {
    try {
        const response = await window.electronAPI.loadGlobalImportFilter();
        console.log('Global import filter loaded:', response);
        
        if (response && response.success && response.data) {
            globalFilter = response.data;
        } else {
            throw new Error('Failed to load global import filter');
        }
    } catch (error) {
        console.error('Error loading global import filter:', error);
        // Create default filter if it doesn't exist
        globalFilter = {
            id: 'global_import_filter',
            name: 'Global Import Filter',
            description: 'Global import filter for all DXF files',
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            version: '1.0',
            rules: [],
            settings: {
                autoApply: true,
                fileSpecificPriority: true,
                conflictResolution: 'global-first'
            }
        };
    }
}

// Load line types
async function loadLineTypes() {
    try {
        const response = await window.electronAPI.loadLineTypes();
        console.log('Line types loaded:', response);
        
        if (response && response.success && response.data) {
            lineTypes = response.data;
            console.log('Line types structure:', lineTypes.slice(0, 3)); // Log first 3 line types for debugging
        } else {
            throw new Error('Failed to load line types');
        }
    } catch (error) {
        console.error('Error loading line types:', error);
        lineTypes = [];
    }
}

// Update statistics display
function updateStatistics() {
    if (!globalFilter) return;

    // Ensure rules array exists
    const rules = globalFilter.rules || [];
    
    const totalRules = rules.length;
    const uniqueLayers = new Set(rules.map(rule => rule.layerName)).size;
    const uniqueColors = new Set(rules.map(rule => rule.color)).size;
    const mappedLineTypes = new Set(rules.map(rule => rule.lineTypeId)).size;

    // Update DOM elements safely
    const totalRulesEl = document.getElementById('totalRules');
    const uniqueLayersEl = document.getElementById('uniqueLayers');
    const uniqueColorsEl = document.getElementById('uniqueColors');
    const mappedLineTypesEl = document.getElementById('mappedLineTypes');

    if (totalRulesEl) totalRulesEl.textContent = totalRules;
    if (uniqueLayersEl) uniqueLayersEl.textContent = uniqueLayers;
    if (uniqueColorsEl) uniqueColorsEl.textContent = uniqueColors;
    if (mappedLineTypesEl) mappedLineTypesEl.textContent = mappedLineTypes;
}

// Render rules table
function renderRulesTable() {
    const tableBody = document.getElementById('rulesTableBody');
    if (!tableBody) return;

    // Ensure rules array exists
    const rules = globalFilter?.rules || [];

    if (!globalFilter || rules.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem;">
                    <div class="empty-state">
                        <h4>No Rules Found</h4>
                        <p>No import filter rules have been created yet. Rules will appear here once you add them.</p>
                        <button class="btn btn-primary" onclick="showAddRuleModal()">Add First Rule</button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const rulesHTML = rules.map(rule => {
        // Clean up corrupted layer names
        const cleanLayerName = (rule.layerName || '').replace(/\n\s*⚠\s*\n\s*Add to Global/g, '').trim();
        
        // Format color display - show just the ACI number (same as import filters manager)
        const aciNum = parseInt(rule.color);
        const colorDisplay = !isNaN(aciNum) && aciNum >= 0 && aciNum <= 255
            ? aciNum.toString() // Just show the number, not "ACI X"
            : (typeof rule.color === 'string' && rule.color.startsWith('rgb(') 
                ? `RGB ${rule.color}` 
                : rule.color || '7');
        
        return `
            <tr data-rule-id="${rule.id || ''}">
                <td>${rule.id || ''}</td>
                <td>${cleanLayerName}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div class="color-swatch" style="background-color: ${rule.colorHex || aciToHex(parseInt(rule.color))}"></div>
                        <span>${colorDisplay}</span>
                    </div>
                </td>
                <td>${getLineTypeName(rule.lineTypeId || 1)}</td>
                <td>${rule.source || 'Global'}</td>
                <td>${rule.description || 'No description'}</td>
                <td>
                    <div class="rule-actions">
                        <button class="btn-icon" onclick="editRule('${rule.id || ''}')" title="Edit Rule">✏️</button>
                        <button class="btn-icon" onclick="deleteRule('${rule.id || ''}')" title="Delete Rule">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = rulesHTML;
}

// Setup event listeners
function setupEventListeners() {
    // Add rule button
    const addRuleBtn = document.getElementById('addRuleBtn');
    if (addRuleBtn) {
        addRuleBtn.addEventListener('click', showAddRuleModal);
    }



    // Export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportGlobalFilter);
    }

    // Import button
    const importBtn = document.getElementById('importBtn');
    if (importBtn) {
        importBtn.addEventListener('click', importGlobalFilter);
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }

    // Clear all button
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllRules);
    }

    // Modal event listeners
    setupModalEventListeners();
}

// Setup modal event listeners
function setupModalEventListeners() {
    const ruleModal = document.getElementById('ruleModal');
    const confirmModal = document.getElementById('confirmModal');

    // Rule modal close button
    const modalClose = document.getElementById('modalClose');
    if (modalClose) {
        modalClose.addEventListener('click', () => hideModal('ruleModal'));
    }

    // Rule modal cancel button
    const modalCancel = document.getElementById('modalCancel');
    if (modalCancel) {
        modalCancel.addEventListener('click', () => hideModal('ruleModal'));
    }

    // Rule modal save button
    const modalSave = document.getElementById('modalSave');
    if (modalSave) {
        modalSave.addEventListener('click', handleRuleFormSubmit);
    }

    // Rule form submit
    const ruleForm = document.getElementById('ruleForm');
    if (ruleForm) {
        ruleForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleRuleFormSubmit();
        });
    }

    // Confirm modal close button
    const confirmClose = document.getElementById('confirmClose');
    if (confirmClose) {
        confirmClose.addEventListener('click', () => hideModal('confirmModal'));
    }

    // Confirm modal cancel button
    const confirmCancel = document.getElementById('confirmCancel');
    if (confirmCancel) {
        confirmCancel.addEventListener('click', () => hideModal('confirmModal'));
    }

    // Close modals when clicking outside
    if (ruleModal) {
        ruleModal.addEventListener('click', (e) => {
            if (e.target === ruleModal) hideModal('ruleModal');
        });
    }

    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) hideModal('confirmModal');
        });
    }

    // Color picker synchronization
    const colorPicker = document.getElementById('ruleColorPicker');
    const colorInput = document.getElementById('ruleColor');
    
    if (colorPicker && colorInput) {
        // When color picker changes, update the text input with ACI number
        colorPicker.addEventListener('change', (e) => {
            const hexColor = e.target.value;
            // Convert hex to ACI (simplified - you might want to implement a proper hexToACI function)
            // For now, we'll keep the text input as hex for consistency
            colorInput.value = hexColor;
        });
        
        // When text input changes, update the color picker
        colorInput.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.startsWith('#')) {
                // It's a hex color
                colorPicker.value = value;
            } else {
                // It's an ACI number, convert to hex
                const aciNum = parseInt(value);
                if (!isNaN(aciNum)) {
                    const hexColor = aciToHex(aciNum);
                    colorPicker.value = hexColor;
                }
            }
        });
    }
}

// Handle rule form submission
async function handleRuleFormSubmit() {
    const modal = document.getElementById('ruleModal');
    const form = document.getElementById('ruleForm');
    
    if (!form || !modal) return;

    const formData = new FormData(form);
    const mode = modal.dataset.mode;

    if (mode === 'add') {
        await addRule(formData);
    } else if (mode === 'edit') {
        await updateRule(formData);
    }
}

// Show add rule modal - make it globally accessible
window.showAddRuleModal = function() {
    const modal = document.getElementById('ruleModal');
    if (!modal) return;

    // Set modal title
    const modalTitle = modal.querySelector('#modalTitle');
    if (modalTitle) modalTitle.textContent = 'Add New Rule';

    // Reset form
    const form = modal.querySelector('#ruleForm');
    if (form) form.reset();

    // Populate line type options
    const lineTypeSelect = modal.querySelector('#ruleLineType');
    if (lineTypeSelect) {
        lineTypeSelect.innerHTML = '<option value="">Select line type...</option>' +
            lineTypes.map(lt => `<option value="${lt.id}">${lt.name}</option>`).join('');
    }

    // Set modal mode
    modal.dataset.mode = 'add';
    modal.classList.add('show');
}

// Hide modal
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

// Show edit rule modal
function showEditRuleModal(ruleId) {
    console.log('Editing rule with ID:', ruleId, 'Type:', typeof ruleId);
    const rule = globalFilter.rules.find(r => r.id == ruleId);
    console.log('Found rule:', rule);
    
    if (!rule) {
        console.error('Rule not found for ID:', ruleId);
        console.log('Available rules:', globalFilter.rules.map(r => ({ id: r.id, type: typeof r.id, layerName: r.layerName })));
        return;
    }

    const modal = document.getElementById('ruleModal');
    if (!modal) return;

    // Set modal title
    const modalTitle = modal.querySelector('#modalTitle');
    if (modalTitle) modalTitle.textContent = 'Edit Rule';

    // Populate form with existing data
    const form = modal.querySelector('#ruleForm');
    if (form) {
        form.querySelector('#ruleLayerName').value = rule.layerName;
        form.querySelector('#ruleColor').value = rule.color;
        
        // Update color picker to show the actual color
        const colorPicker = form.querySelector('#ruleColorPicker');
        if (colorPicker) {
            const hexColor = aciToHex(parseInt(rule.color));
            colorPicker.value = hexColor;
        }
        
        form.querySelector('#ruleLineType').value = rule.lineTypeId;
        form.querySelector('#ruleDescription').value = rule.description || '';
        form.querySelector('#ruleSource').value = rule.source || '';
    }

    // Populate line type options
    const lineTypeSelect = modal.querySelector('#ruleLineType');
    if (lineTypeSelect) {
        lineTypeSelect.innerHTML = '<option value="">Select line type...</option>' +
            lineTypes.map(lt => `<option value="${lt.id}">${lt.name}</option>`).join('');
        lineTypeSelect.value = rule.lineTypeId;
    }

    // Set modal mode and rule ID
    modal.dataset.mode = 'edit';
    modal.dataset.ruleId = ruleId;
    modal.classList.add('show');
}

// Add new rule
async function addRule(formData) {
    try {
        const newRule = {
            id: Date.now().toString(),
            layerName: formData.get('layerName'),
            color: formData.get('color'),
            lineTypeId: formData.get('lineTypeId'),
            description: formData.get('description') || '',
            source: formData.get('source') || 'manual',
            created: new Date().toISOString()
        };

        const result = await window.electronAPI.addRuleToGlobalImportFilter(newRule);
        if (result.success) {
            await loadGlobalFilter();
            updateStatistics();
            renderRulesTable();
            hideModal('ruleModal');
            showSuccess('Rule added successfully');
        } else {
            throw new Error(result.error || 'Failed to add rule');
        }
    } catch (error) {
        console.error('Error adding rule:', error);
        showError('Failed to add rule: ' + error.message);
    }
}

// Edit rule - make it globally accessible
window.editRule = async function(ruleId) {
    showEditRuleModal(ruleId);
}

// Update rule
async function updateRule(formData) {
    try {
        const modal = document.getElementById('ruleModal');
        const ruleId = modal.dataset.ruleId;
        console.log('Updating rule with ID:', ruleId, 'Type:', typeof ruleId);
        
        const updatedRule = {
            layerName: formData.get('layerName'),
            color: formData.get('color'),
            lineTypeId: formData.get('lineTypeId'),
            description: formData.get('description') || '',
            source: formData.get('source') || 'manual'
        };

        console.log('Updated rule data:', updatedRule);
        const result = await window.electronAPI.updateRuleInGlobalImportFilter(ruleId, updatedRule);
        console.log('Update result:', result);
        
        if (result.success) {
            await loadGlobalFilter();
            updateStatistics();
            renderRulesTable();
            hideModal('ruleModal');
            showSuccess('Rule updated successfully');
        } else {
            throw new Error(result.error || 'Failed to update rule');
        }
    } catch (error) {
        console.error('Error updating rule:', error);
        showError('Failed to update rule: ' + error.message);
    }
}

// Delete rule - make it globally accessible
window.deleteRule = async function(ruleId) {
    console.log('Deleting rule with ID:', ruleId, 'Type:', typeof ruleId);
    
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
        const result = await window.electronAPI.deleteRuleFromGlobalImportFilter(ruleId);
        console.log('Delete result:', result);
        
        if (result.success) {
            await loadGlobalFilter();
            updateStatistics();
            renderRulesTable();
            showSuccess('Rule deleted successfully');
        } else {
            throw new Error(result.error || 'Failed to delete rule');
        }
    } catch (error) {
        console.error('Error deleting rule:', error);
        showError('Failed to delete rule: ' + error.message);
    }
}



// Export global filter
async function exportGlobalFilter() {
    try {
        const dataStr = JSON.stringify(globalFilter, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `global_import_filter_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        showSuccess('Global filter exported successfully');
    } catch (error) {
        console.error('Error exporting global filter:', error);
        showError('Failed to export: ' + error.message);
    }
}

// Import global filter
async function importGlobalFilter() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedFilter = JSON.parse(text);
            
            // Validate the imported filter
            if (!importedFilter.rules || !Array.isArray(importedFilter.rules)) {
                throw new Error('Invalid global filter format');
            }

            // Save the imported filter
            const result = await window.electronAPI.saveGlobalImportFilter(importedFilter);
            if (result.success) {
                await loadGlobalFilter();
                updateStatistics();
                renderRulesTable();
                showSuccess('Global filter imported successfully');
            } else {
                throw new Error(result.error || 'Failed to import global filter');
            }
        } catch (error) {
            console.error('Error importing global filter:', error);
            showError('Failed to import: ' + error.message);
        }
    };
    
    input.click();
}

// Refresh data
async function refreshData() {
    try {
        showLoading(true);
        await loadGlobalFilter();
        await loadLineTypes();
        updateStatistics();
        renderRulesTable();
        showSuccess('Data refreshed successfully');
    } catch (error) {
        console.error('Error refreshing data:', error);
        showError('Failed to refresh data: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Clear all rules
async function clearAllRules() {
    try {
        // Show confirmation modal
        const confirmModal = document.getElementById('confirmModal');
        const confirmTitle = document.getElementById('confirmTitle');
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmAction = document.getElementById('confirmAction');
        
        if (confirmModal && confirmTitle && confirmMessage && confirmAction) {
            confirmTitle.textContent = 'Clear All Rules';
            confirmMessage.textContent = 'Are you sure you want to clear all rules? This action cannot be undone.';
            
            // Show modal
            confirmModal.classList.add('show');
            
            // Wait for user confirmation
            const confirmed = await new Promise((resolve) => {
                const handleConfirm = () => {
                    confirmAction.removeEventListener('click', handleConfirm);
                    hideModal('confirmModal');
                    resolve(true);
                };
                
                const handleCancel = () => {
                    confirmModal.removeEventListener('click', handleCancel);
                    hideModal('confirmModal');
                    resolve(false);
                };
                
                confirmAction.addEventListener('click', handleConfirm);
                confirmModal.addEventListener('click', handleCancel);
            });
            
            if (!confirmed) return;
        }
        
        // Clear all rules
        globalFilter.rules = [];
        globalFilter.statistics.lastConsolidated = null;
        
        const result = await window.electronAPI.saveGlobalImportFilter(globalFilter);
        if (result.success) {
            updateStatistics();
            renderRulesTable();
            showSuccess('All rules cleared successfully');
        } else {
            throw new Error(result.error || 'Failed to clear rules');
        }
    } catch (error) {
        console.error('Error clearing rules:', error);
        showError('Failed to clear rules: ' + error.message);
    }
}

// Utility functions
// Convert ACI number directly to hex (same as main renderer)
function aciToHex(aci) {
    if (typeof aci === 'number') {
        // Direct ACI to hex conversion
        if (aci === 1) return '#FF0000';
        if (aci === 2) return '#FFFF00';
        if (aci === 3) return '#00FF00';
        if (aci === 4) return '#00FFFF';
        if (aci === 5) return '#0000FF';
        if (aci === 6) return '#FF00FF';
        if (aci === 7) return '#FFFFFF';
        if (aci === 8) return '#808080';
        if (aci === 9) return '#C0C0C0';
        if (aci === 10) return '#800000';
        if (aci === 11) return '#808000';
        if (aci === 12) return '#008000';
        if (aci === 13) return '#008080';
        if (aci === 14) return '#000080';
        if (aci === 15) return '#800080';
        if (aci === 16) return '#FF0000';
        if (aci === 17) return '#FF7F00';
        if (aci === 18) return '#FFFF00';
        if (aci === 19) return '#7FFF00';
        if (aci === 20) return '#00FF00';
        if (aci === 21) return '#00FF7F';
        if (aci === 22) return '#00FFFF';
        if (aci === 23) return '#007FFF';
        if (aci === 24) return '#0000FF';
        if (aci === 25) return '#7F00FF';
        if (aci === 26) return '#FF00FF';
        if (aci === 27) return '#FF007F';
        if (aci === 28) return '#7F0000';
        if (aci === 29) return '#7F3F00';
        if (aci === 30) return '#7F7F00';
        if (aci === 31) return '#3F7F00';
        if (aci === 32) return '#007F00';
        if (aci === 33) return '#007F3F';
        if (aci === 34) return '#007F7F';
        if (aci === 35) return '#003F7F';
        if (aci === 36) return '#00007F';
        if (aci === 37) return '#3F007F';
        if (aci === 38) return '#7F007F';
        if (aci === 39) return '#7F003F';
        if (aci === 40) return '#590000';
        if (aci === 41) return '#590059';
        if (aci === 42) return '#000059';
        if (aci === 43) return '#005959';
        if (aci === 44) return '#595900';
        if (aci === 45) return '#595959';
        if (aci === 46) return '#7F0000';
        if (aci === 47) return '#7F007F';
        if (aci === 48) return '#00007F';
        if (aci === 49) return '#007F7F';
        if (aci === 50) return '#7F7F00';
        if (aci === 51) return '#7F7F7F';
        if (aci === 52) return '#3F0000';
        if (aci === 53) return '#3F003F';
        if (aci === 54) return '#00003F';
        if (aci === 55) return '#003F3F';
        if (aci === 56) return '#3F3F00';
        if (aci === 57) return '#3F3F3F';
        if (aci === 58) return '#1F0000';
        if (aci === 59) return '#1F001F';
        if (aci === 60) return '#00001F';
        if (aci === 61) return '#001F1F';
        if (aci === 62) return '#1F1F00';
        if (aci === 63) return '#1F1F1F';
        if (aci === 64) return '#0F0000';
        if (aci === 65) return '#0F000F';
        if (aci === 66) return '#00000F';
        if (aci === 67) return '#000F0F';
        if (aci === 68) return '#0F0F00';
        if (aci === 69) return '#0F0F0F';
        if (aci === 70) return '#FF4040';
        if (aci === 71) return '#FF8040';
        if (aci === 72) return '#FFBF40';
        if (aci === 73) return '#FFFF40';
        if (aci === 74) return '#BFFF40';
        if (aci === 75) return '#80FF40';
        if (aci === 76) return '#40FF40';
        if (aci === 77) return '#40FF80';
        if (aci === 78) return '#40FFBF';
        if (aci === 79) return '#40FFFF';
        if (aci === 80) return '#40BFFF';
        if (aci === 81) return '#4080FF';
        if (aci === 82) return '#4040FF';
        if (aci === 83) return '#8040FF';
        if (aci === 84) return '#BF40FF';
        if (aci === 85) return '#FF40FF';
        if (aci === 86) return '#FF4080';
        if (aci === 87) return '#FF4040';
        if (aci === 88) return '#FF6040';
        if (aci === 89) return '#FF8040';
        if (aci === 90) return '#FFA040';
        if (aci === 91) return '#FFC040';
        if (aci === 92) return '#FFE040';
        if (aci === 93) return '#FFFF40';
        if (aci === 94) return '#E0FF40';
        if (aci === 95) return '#C0FF40';
        if (aci === 96) return '#A0FF40';
        if (aci === 97) return '#80FF40';
        if (aci === 98) return '#60FF40';
        if (aci === 99) return '#40FF40';
        if (aci === 100) return '#40FF60';
        if (aci === 101) return '#40FF80';
        if (aci === 102) return '#40FFA0';
        if (aci === 103) return '#40FFC0';
        if (aci === 104) return '#40FFE0';
        if (aci === 105) return '#40FFFF';
        if (aci === 106) return '#40E0FF';
        if (aci === 107) return '#40C0FF';
        if (aci === 108) return '#40A0FF';
        if (aci === 109) return '#4080FF';
        if (aci === 110) return '#4060FF';
        if (aci === 111) return '#4040FF';
        if (aci === 112) return '#6040FF';
        if (aci === 113) return '#8040FF';
        if (aci === 114) return '#A040FF';
        if (aci === 115) return '#C040FF';
        if (aci === 116) return '#E040FF';
        if (aci === 117) return '#FF40FF';
        if (aci === 118) return '#FF40E0';
        if (aci === 119) return '#FF40C0';
        if (aci === 120) return '#FF40A0';
        if (aci === 121) return '#FF4080';
        if (aci === 122) return '#FF4060';
        if (aci === 123) return '#FF4040';
        if (aci === 124) return '#FF5040';
        if (aci === 125) return '#FF6040';
        if (aci === 126) return '#FF7040';
        if (aci === 127) return '#FF8040';
        if (aci === 128) return '#FF9040';
        if (aci === 129) return '#FFA040';
        if (aci === 130) return '#FFB040';
        if (aci === 131) return '#FFC040';
        if (aci === 132) return '#FFD040';
        if (aci === 133) return '#FFE040';
        if (aci === 134) return '#FFF040';
        if (aci === 135) return '#FFFF40';
        if (aci === 136) return '#F0FF40';
        if (aci === 137) return '#E0FF40';
        if (aci === 138) return '#D0FF40';
        if (aci === 139) return '#C0FF40';
        if (aci === 140) return '#B0FF40';
        if (aci === 141) return '#A0FF40';
        if (aci === 142) return '#90FF40';
        if (aci === 143) return '#80FF40';
        if (aci === 144) return '#70FF40';
        if (aci === 145) return '#60FF40';
        if (aci === 146) return '#50FF40';
        if (aci === 147) return '#40FF40';
        if (aci === 148) return '#40FF50';
        if (aci === 149) return '#40FF60';
        if (aci === 150) return '#40FF70';
        if (aci === 151) return '#40FF80';
        if (aci === 152) return '#40FF90';
        if (aci === 153) return '#40FFA0';
        if (aci === 154) return '#40FFB0';
        if (aci === 155) return '#40FFC0';
        if (aci === 156) return '#40FFD0';
        if (aci === 157) return '#40FFE0';
        if (aci === 158) return '#40FFF0';
        if (aci === 159) return '#40FFFF';
        if (aci === 160) return '#40F0FF';
        if (aci === 161) return '#40E0FF';
        if (aci === 162) return '#40D0FF';
        if (aci === 163) return '#40C0FF';
        if (aci === 164) return '#40B0FF';
        if (aci === 165) return '#40A0FF';
        if (aci === 166) return '#4090FF';
        if (aci === 167) return '#4080FF';
        if (aci === 168) return '#4070FF';
        if (aci === 169) return '#4060FF';
        if (aci === 170) return '#4050FF';
        if (aci === 171) return '#4040FF';
        if (aci === 172) return '#5040FF';
        if (aci === 173) return '#6040FF';
        if (aci === 174) return '#7040FF';
        if (aci === 175) return '#8040FF';
        if (aci === 176) return '#9040FF';
        if (aci === 177) return '#A040FF';
        if (aci === 178) return '#B040FF';
        if (aci === 179) return '#C040FF';
        if (aci === 180) return '#D040FF';
        if (aci === 181) return '#E040FF';
        if (aci === 182) return '#F040FF';
        if (aci === 183) return '#FF40FF';
        if (aci === 184) return '#FF40F0';
        if (aci === 185) return '#FF40E0';
        if (aci === 186) return '#FF40D0';
        if (aci === 187) return '#FF40C0';
        if (aci === 188) return '#FF40B0';
        if (aci === 189) return '#FF40A0';
        if (aci === 190) return '#FF4090';
        if (aci === 191) return '#FF4080';
        if (aci === 192) return '#FF4070';
        if (aci === 193) return '#FF4060';
        if (aci === 194) return '#FF4050';
        if (aci === 195) return '#FF4040';
        if (aci === 196) return '#FF4540';
        if (aci === 197) return '#FF4A40';
        if (aci === 198) return '#FF4F40';
        if (aci === 199) return '#FF5440';
        if (aci === 200) return '#FF5940';
        if (aci === 201) return '#FF5E40';
        if (aci === 202) return '#FF6340';
        if (aci === 203) return '#FF6840';
        if (aci === 204) return '#FF6D40';
        if (aci === 205) return '#FF7240';
        if (aci === 206) return '#FF7740';
        if (aci === 207) return '#FF7C40';
        if (aci === 208) return '#FF8140';
        if (aci === 209) return '#FF8640';
        if (aci === 210) return '#FF8B40';
        if (aci === 211) return '#FF9040';
        if (aci === 212) return '#FF9540';
        if (aci === 213) return '#FF9A40';
        if (aci === 214) return '#FF9F40';
        if (aci === 215) return '#FFA440';
        if (aci === 216) return '#FFA940';
        if (aci === 217) return '#FFAE40';
        if (aci === 218) return '#FFB340';
        if (aci === 219) return '#FFB840';
        if (aci === 220) return '#FFBD40';
        if (aci === 221) return '#FFC240';
        if (aci === 222) return '#FFC740';
        if (aci === 223) return '#FFCC40';
        if (aci === 224) return '#FFD140';
        if (aci === 225) return '#FFD640';
        if (aci === 226) return '#FFDB40';
        if (aci === 227) return '#FFE040';
        if (aci === 228) return '#FFE540';
        if (aci === 229) return '#FFEA40';
        if (aci === 230) return '#FFEF40';
        if (aci === 231) return '#FFF440';
        if (aci === 232) return '#FFF940';
        if (aci === 233) return '#FFFF40';
        if (aci === 234) return '#FAFF40';
        if (aci === 235) return '#F5FF40';
        if (aci === 236) return '#F0FF40';
        if (aci === 237) return '#EBFF40';
        if (aci === 238) return '#E6FF40';
        if (aci === 239) return '#E1FF40';
        if (aci === 240) return '#DCFF40';
        if (aci === 241) return '#D7FF40';
        if (aci === 242) return '#D2FF40';
        if (aci === 243) return '#CDFF40';
        if (aci === 244) return '#C8FF40';
        if (aci === 245) return '#C3FF40';
        if (aci === 246) return '#BEFF40';
        if (aci === 247) return '#B9FF40';
        if (aci === 248) return '#B4FF40';
        if (aci === 249) return '#AFFF40';
        if (aci === 250) return '#AAFF40';
        if (aci === 251) return '#A5FF40';
        if (aci === 252) return '#A0FF40';
        if (aci === 253) return '#9BFF40';
        if (aci === 254) return '#96FF40';
        if (aci === 255) return '#0000FF'; // FIXED: Blue instead of green
        // Special colors for your specific DXF files
        if (aci === 38912) return '#009800'; // Green (specific to your DXF)
        if (aci === 65407) return '#00FF7F'; // Light Green (specific to your DXF)
        if (aci === 16776960) return '#FFFF00'; // Yellow (specific to your DXF)
        if (aci === 52224) return '#00CC00'; // Dark Green (specific to your DXF)
        if (aci === 12459565) return '#BE1E2D'; // Red variant (specific to your DXF)
        if (aci === 16225309) return '#F7941D'; // Orange variant (specific to your DXF)
        if (aci === 3027346) return '#2E3192'; // Blue variant (specific to your DXF)
        if (aci === 1865148) return '#1C75BC'; // Blue variant (specific to your DXF)
        if (aci === 2301728) return '#231F20'; // Dark variant (specific to your DXF)
        return '#FFFFFF'; // Default to white if not found
    }
    
    // Handle string ACI numbers
    if (typeof aci === 'string') {
        const aciNum = parseInt(aci);
        if (!isNaN(aciNum)) {
            return aciToHex(aciNum);
        }
    }
    
    return '#FFFFFF'; // Default to white if not found
}

function getLineTypeName(lineTypeId) {
    // Handle both string and number lineTypeId
    const id = lineTypeId?.toString();
    if (!id) return 'Unknown';
    
    // Find line type by ID
    const lineType = lineTypes.find(lt => lt.id?.toString() === id || lt.Id?.toString() === id);
    
    if (lineType) {
        // Return the name property (could be 'name', 'Name', or 'Name' from XML)
        return lineType.name || lineType.Name || `Line Type ${lineTypeId}`;
    }
    
    // Fallback to ID if not found
    return `Line Type ${lineTypeId}`;
}

// UI feedback functions
function showSuccess(message) {
    // You can implement a toast notification system here
    console.log('Success:', message);
    alert(message);
}

function showError(message) {
    // You can implement a toast notification system here
    console.error('Error:', message);
    alert('Error: ' + message);
}

function showLoading(show) {
    // You can implement a loading indicator here
    console.log('Loading:', show);
}

// Form submission handlers
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize the application
    try {
        await loadGlobalFilter();
        await loadLineTypes();
        updateStatistics();
        renderRulesTable();
        setupEventListeners();
        console.log('Global Import Filter Manager initialized successfully');
    } catch (error) {
        console.error('Error initializing Global Import Filter Manager:', error);
        showError('Failed to initialize: ' + error.message);
    }

    // Add rule form
    const addRuleForm = document.getElementById('addRuleForm');
    if (addRuleForm) {
        addRuleForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(addRuleForm);
            addRule(formData);
        });
    }

    // Edit rule form
    const editRuleForm = document.getElementById('editRuleForm');
    if (editRuleForm) {
        editRuleForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(editRuleForm);
            updateRule(formData);
        });
    }

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) {
                modal.classList.remove('show');
            }
        });
    });

    // Close modal when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
});

// Add window close handler to refresh main window when Global Import Filter Manager is closed
window.addEventListener('beforeunload', () => {
    // Send refresh message to main window when this window is being closed
    if (window.electronAPI && window.electronAPI.ipcRenderer) {
        console.log('Global Import Filter window closing - sending refresh message');
        window.electronAPI.ipcRenderer.send('refresh-all-windows-global-filter-data');
    }
}); 