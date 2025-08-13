// Global Import Filter Manager
let globalFilter = null;
let lineTypes = [];

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Global Import Filter Manager: Starting initialization...');
        await loadGlobalFilter();
        console.log('Global Import Filter Manager: Global filter loaded, rules count:', globalFilter?.rules?.length || 0);
        await loadLineTypes();
        console.log('Global Import Filter Manager: Line types loaded, count:', lineTypes?.length || 0);
        updateStatistics();
        renderRulesTable();
        setupEventListeners();
        
        // Listen for updates from other windows
        if (window.electronAPI) {
            console.log('Setting up global filter update listener...');
            window.electronAPI.onGlobalFilterUpdated(() => {
                console.log('Received global filter update notification');
                refreshData();
            });
        } else {
            console.log('window.electronAPI not available');
        }
        
        console.log('Global Import Filter Manager: Initialization complete');
    } catch (error) {
        console.error('Error initializing Global Import Filter Manager:', error);
        showError('Failed to initialize: ' + error.message);
    }
});

// Load global import filter
async function loadGlobalFilter() {
    try {
        console.log('Loading global import filter...');
        const response = await window.electronAPI.loadGlobalImportFilter();
        console.log('Global import filter loaded:', response);
        
        if (response && response.success && response.data) {
            globalFilter = response.data;
            console.log('Global filter set successfully, rules count:', globalFilter?.rules?.length || 0);
            console.log('First few rules:', globalFilter?.rules?.slice(0, 3) || []);
        } else {
            console.error('Failed to load global import filter - response:', response);
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
        console.log('Created default global filter with empty rules');
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

    const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const fmtFilter = (document.getElementById('filterByFormat')?.value || '');
    const ltFilter = (document.getElementById('filterByLineType')?.value || '');
    const srcFilter = (document.getElementById('filterBySource')?.value || '').toLowerCase();

    const filtered = rules.filter(rule => {
        const blob = `${rule.id} ${rule.format||'dxf'} ${rule.key||''} ${rule.layerName||''} ${rule.color||''} ${rule.lineTypeId||''} ${rule.source||''} ${rule.description||''}`.toLowerCase();
        const fmtOk = !fmtFilter || (rule.format||'dxf') === fmtFilter;
        const ltOk = !ltFilter || String(rule.lineTypeId) === String(ltFilter);
        const srcOk = !srcFilter || (rule.source||'').toLowerCase() === srcFilter;
        return blob.includes(search) && fmtOk && ltOk && srcOk;
    });

    const renderRow = (rule) => {
        // Clean up corrupted layer names
        const cleanLayerName = (rule.layerName || '').replace(/\n\s*⚠\s*\n\s*Add to Global/g, '').trim();
        
        // Format color display - handle both ACI numbers and hex colors
        let aciNum = null;
        let hasAci = false;
        let colorDisplay = '-';
        
        if (rule.color) {
            // Check if it's a hex color (starts with #)
            if (rule.color.startsWith('#')) {
                // For hex colors, we'll show the hex value
                colorDisplay = rule.color;
                hasAci = false;
            } else {
                // Try to parse as ACI number
                aciNum = parseInt(rule.color);
                hasAci = Number.isInteger(aciNum) && aciNum >= 0 && aciNum <= 255;
                if (hasAci) {
                    // Show ACI number and its hex equivalent
                    const hexColor = aciToHex(aciNum);
                    colorDisplay = `${aciNum} (${hexColor})`;
                } else {
                    colorDisplay = rule.color;
                }
            }
        }
        const fmt = rule.format || 'dxf';
        const key = rule.key || '';
        let ddsColor = '', rawW='', unit='', cff2Pen='', cff2Layer='';
        if (fmt === 'dds' && key) { const [c,w,u] = key.split('|'); ddsColor=c; rawW=w; unit=u; }
        if (fmt === 'cff2' && key) { const [p, ...rest] = key.split('-'); cff2Pen=p; cff2Layer=rest.join('-'); }
        const enabled = rule.enabled !== false;
        return `
            <tr data-rule-id="${rule.id || ''}">
                <td>${rule.id || ''}</td>
                <td>${fmt}</td>
                <td>${key}</td>
                <td>${cleanLayerName}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div class="color-swatch" style="background-color: ${hasAci ? aciToHex(aciNum) : (rule.color || 'transparent')}"></div>
                        <span>${colorDisplay}</span>
                    </div>
                </td>
                <td>${ddsColor || '-'}</td>
                <td>${rawW || '-'}</td>
                <td>${unit || '-'}</td>
                <td>${cff2Pen || '-'}</td>
                <td>${cff2Layer || '-'}</td>
                <td><input type="color" class="rule-color-picker" data-id="${rule.id}" value="${(rule.color || '#cccccc')}"></td>
                <td>${getLineTypeName(rule.lineTypeId || 1)}</td>
                <td><input type="checkbox" ${enabled?'checked':''} class="rule-enabled" data-id="${rule.id}"></td>
                <td>${rule.source || 'Global'}</td>
                <td>${rule.description || 'No description'}</td>
                <td>
                    <div class="rule-actions">
                        <button class="btn-icon" onclick="editRule('${rule.id || ''}')" title="Edit Rule">✏️</button>
                        <button class="btn-icon" onclick="deleteRule('${rule.id || ''}')" title="Delete Rule">🗑️</button>
                    </div>
                </td>
            </tr>`;
    };

    const rowsHTML = filtered.map(renderRow).join('');
    tableBody.innerHTML = rowsHTML;

    // Apply column visibility based on selected format
    applyColumnVisibility();

    document.querySelectorAll('.rule-enabled').forEach(el => {
        el.addEventListener('change', async (e)=>{
            const id = e.target.getAttribute('data-id');
            await window.electronAPI.updateRuleInGlobalImportFilter(id, { enabled: e.target.checked });
            await loadGlobalFilter();
            renderRulesTable();
        });
    });

    // Inline color picker for CFF2/DDS display color
    document.querySelectorAll('.rule-color-picker').forEach(p => {
        p.addEventListener('input', async (e) => {
            const id = e.target.getAttribute('data-id');
            const color = e.target.value;
            await window.electronAPI.updateRuleInGlobalImportFilter(id, { color });
            await loadGlobalFilter();
            renderRulesTable();
        });
    });
}

// Hide/show non-relevant columns for selected format
function applyColumnVisibility() {
    const fmt = (document.getElementById('filterByFormat')?.value || '').toLowerCase();
    const table = document.getElementById('rulesTable');
    if (!table) return;
    // Column indexes
    const COLS = {
        ID: 0, FORMAT: 1, KEY: 2, LAYER: 3, ACI: 4, DDS_COLOR: 5, RAW_WIDTH: 6, UNIT: 7, CFF2_PEN: 8, CFF2_LAYER: 9,
        COLOR: 10, LINE_TYPE: 11, ENABLED: 12, SOURCE: 13, DESC: 14, ACTIONS: 15
    };
    // By default, show all if no format filter
    let visible = new Set(Object.values(COLS));
    if (fmt === 'dxf') {
        visible = new Set([COLS.ID, COLS.FORMAT, COLS.KEY, COLS.LAYER, COLS.ACI, COLS.COLOR, COLS.LINE_TYPE, COLS.ENABLED, COLS.SOURCE, COLS.DESC, COLS.ACTIONS]);
    } else if (fmt === 'dds') {
        visible = new Set([COLS.ID, COLS.FORMAT, COLS.KEY, COLS.DDS_COLOR, COLS.RAW_WIDTH, COLS.UNIT, COLS.COLOR, COLS.LINE_TYPE, COLS.ENABLED, COLS.SOURCE, COLS.DESC, COLS.ACTIONS]);
    } else if (fmt === 'cff2') {
        visible = new Set([COLS.ID, COLS.FORMAT, COLS.KEY, COLS.CFF2_PEN, COLS.CFF2_LAYER, COLS.ACI, COLS.COLOR, COLS.LINE_TYPE, COLS.ENABLED, COLS.SOURCE, COLS.DESC, COLS.ACTIONS]);
    }
    const setColDisplay = (row, colIdx, show) => {
        const cell = row.children[colIdx];
        if (cell) cell.style.display = show ? '' : 'none';
    };
    const headRow = table.tHead?.rows?.[0];
    if (headRow) {
        for (let i = 0; i < headRow.children.length; i++) setColDisplay(headRow, i, visible.has(i));
    }
    Array.from(table.tBodies[0]?.rows || []).forEach(r => {
        for (let i = 0; i < r.children.length; i++) setColDisplay(r, i, visible.has(i));
    });
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
    document.getElementById('filterByFormat')?.addEventListener('change', ()=>{ renderRulesTable(); applyColumnVisibility(); });
    document.getElementById('filterByLineType')?.addEventListener('change', renderRulesTable);
    document.getElementById('searchInput')?.addEventListener('input', renderRulesTable);

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }
    
    // Add a debug button to manually reload data
    const debugBtn = document.createElement('button');
    debugBtn.textContent = 'Debug: Reload Data';
    debugBtn.className = 'btn btn-warning';
    debugBtn.style.marginLeft = '10px';
    debugBtn.addEventListener('click', async () => {
        console.log('Manual debug reload triggered');
        await loadGlobalFilter();
        console.log('Manual reload - Global filter rules count:', globalFilter?.rules?.length || 0);
        console.log('Manual reload - First few rules:', globalFilter?.rules?.slice(0, 3) || []);
        updateStatistics();
        renderRulesTable();
    });
    
    // Add the debug button to the page
    const buttonContainer = document.querySelector('.button-container') || document.querySelector('.header-controls');
    if (buttonContainer) {
        buttonContainer.appendChild(debugBtn);
    }

    // Clear all button
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllRules);
    }

    // Modal event listeners
    setupModalEventListeners();

    const groupByFormatBtn = document.getElementById('groupByFormatBtn');
    if (groupByFormatBtn) groupByFormatBtn.addEventListener('click', ()=>{ currentGrouping='format'; renderRulesTable(); });
    const groupByLineTypeBtn = document.getElementById('groupByLineTypeBtn');
    if (groupByLineTypeBtn) groupByLineTypeBtn.addEventListener('click', ()=>{ currentGrouping='linetype'; renderRulesTable(); });
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
        console.log('Available rules:', globalFilter.rules.map(r => ({ id: r.id, type: typeof r.id, key: r.key })));
        return;
    }

    const modal = document.getElementById('ruleModal');
    if (!modal) return;

    // Set modal title
    const modalTitle = modal.querySelector('#modalTitle');
    if (modalTitle) modalTitle.textContent = 'Edit Rule';

    // Parse the key to extract layer name and color
    let layerName = '';
    let color = '';
    
    if (rule.key) {
        // Handle key format: "dxf|FNL_DIMS-363|00CC00" or "cff2|2-1" or "dds|100|0.0280|in"
        const keyParts = rule.key.split('|');
        if (keyParts.length >= 2) {
            layerName = keyParts[1]; // Get the layer name part
            if (keyParts.length >= 3) {
                color = keyParts[2]; // Get the color part if it exists
            }
        }
    } else if (rule.layerName) {
        // Fallback to old format
        layerName = rule.layerName;
        color = rule.color || '';
    }

    // Populate form with existing data
    const form = modal.querySelector('#ruleForm');
    if (form) {
        form.querySelector('#ruleLayerName').value = layerName;
        form.querySelector('#ruleColor').value = rule.color || color;
        
        // Update color picker to show the actual color
        const colorPicker = form.querySelector('#ruleColorPicker');
        if (colorPicker) {
            const hexColor = rule.color || color;
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
        const layerName = formData.get('layerName');
        const color = formData.get('color');
        const lineTypeId = formData.get('lineTypeId');
        
        // For DXF files, we need to handle ACI values properly
        let aciValue = color;
        
        // If color is a hex value, try to find the corresponding ACI
        if (color.startsWith('#')) {
            // Convert hex to ACI by finding the matching ACI number
            aciValue = hexToAci(color);
        }
        
        // Create the key in the correct format for DXF: "dxf|layerName|aciValue"
        const key = `dxf|${layerName}|${aciValue}`;
        
        const newRule = {
            id: Date.now().toString(),
            key: key,
            layerName: layerName,
            color: aciValue, // Store the ACI value, not hex
            lineTypeId: lineTypeId,
            description: formData.get('description') || '',
            source: formData.get('source') || 'manual',
            created: new Date().toISOString()
        };

        console.log('Adding new rule:', newRule);
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
        
        // Find the original rule to get the format
        const originalRule = globalFilter.rules.find(r => r.id == ruleId);
        if (!originalRule) {
            throw new Error('Original rule not found');
        }
        
        const layerName = formData.get('layerName');
        const color = formData.get('color');
        const lineTypeId = formData.get('lineTypeId');
        const description = formData.get('description') || '';
        const source = formData.get('source') || 'manual';
        
        // Reconstruct the key based on the original rule format
        let newKey = '';
        if (originalRule.key) {
            const keyParts = originalRule.key.split('|');
            if (keyParts.length >= 1) {
                const format = keyParts[0]; // dxf, cff2, dds
                if (format === 'dxf') {
                    newKey = `dxf|${layerName}|${color}`;
                } else if (format === 'cff2') {
                    newKey = `cff2|${layerName}`;
                } else if (format === 'dds') {
                    // For DDS, preserve the original key structure
                    newKey = originalRule.key;
                }
            }
        }
        
        const updatedRule = {
            key: newKey,
            color: color,
            lineTypeId: lineTypeId,
            description: description,
            source: source
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

// Make refreshData globally accessible so other windows can call it
window.refreshGlobalImportFilter = refreshData;

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

// Convert hex color to ACI value
function hexToAci(hexColor) {
    // Normalize hex color (remove # if present)
    const hex = hexColor.startsWith('#') ? hexColor.substring(1) : hexColor;
    
    // Create reverse mapping from hex to ACI
    const hexToAciMap = {
        '#FF0000': 1, '#FFFF00': 2, '#00FF00': 3, '#00FFFF': 4, '#0000FF': 5,
        '#FF00FF': 6, '#FFFFFF': 7, '#808080': 8, '#C0C0C0': 9, '#800000': 10,
        '#808000': 11, '#008000': 12, '#008080': 13, '#000080': 14, '#800080': 15,
        '#FF7F00': 17, '#7FFF00': 19, '#00FF7F': 21, '#007FFF': 23, '#7F00FF': 25,
        '#FF007F': 27, '#7F0000': 28, '#7F3F00': 29, '#7F7F00': 30, '#3F7F00': 31,
        '#007F00': 32, '#007F3F': 33, '#007F7F': 34, '#003F7F': 35, '#00007F': 36,
        '#3F007F': 37, '#7F007F': 38, '#7F003F': 39, '#590000': 40, '#590059': 41,
        '#000059': 42, '#005959': 43, '#595900': 44, '#595959': 45, '#7F0000': 46,
        '#7F007F': 47, '#00007F': 48, '#007F7F': 49, '#7F7F00': 50, '#7F7F7F': 51,
        '#3F0000': 52, '#3F003F': 53, '#00003F': 54, '#003F3F': 55, '#3F3F00': 56,
        '#3F3F3F': 57, '#1F0000': 58, '#1F001F': 59, '#00001F': 60, '#001F1F': 61,
        '#1F1F00': 62, '#1F1F1F': 63, '#0F0000': 64, '#0F000F': 65, '#00000F': 66,
        '#000F0F': 67, '#0F0F00': 68, '#0F0F0F': 69, '#FF4040': 70, '#FF8040': 71,
        '#FFBF40': 72, '#FFFF40': 73, '#BFFF40': 74, '#80FF40': 75, '#40FF40': 76,
        '#40FF80': 77, '#40FFBF': 78, '#40FFFF': 79, '#40BFFF': 80, '#4080FF': 81,
        '#4040FF': 82, '#8040FF': 83, '#BF40FF': 84, '#FF40FF': 85, '#FF4080': 86,
        '#FF4040': 87, '#FF6040': 88, '#FF8040': 89, '#FFA040': 90, '#FFC040': 91,
        '#FFE040': 92, '#FFFF40': 93, '#E0FF40': 94, '#C0FF40': 95, '#A0FF40': 96,
        '#80FF40': 97, '#60FF40': 98, '#40FF40': 99, '#40FF60': 100, '#40FF80': 101,
        '#40FFA0': 102, '#40FFC0': 103, '#40FFE0': 104, '#40FFFF': 105, '#40E0FF': 106,
        '#40C0FF': 107, '#40A0FF': 108, '#4080FF': 109, '#4060FF': 110, '#4040FF': 111,
        '#6040FF': 112, '#8040FF': 113, '#A040FF': 114, '#C040FF': 115, '#E040FF': 116,
        '#FF40FF': 117, '#FF40F0': 118, '#FF40E0': 119, '#FF40D0': 120, '#FF40C0': 121,
        '#FF40B0': 122, '#FF40A0': 123, '#FF4090': 124, '#FF4080': 125, '#FF4070': 126,
        '#FF4060': 127, '#FF4050': 128, '#FF4040': 129, '#FF4540': 130, '#FF4A40': 131,
        '#FF4F40': 132, '#FF5440': 133, '#FF5940': 134, '#FF5E40': 135, '#FF6340': 136,
        '#FF6840': 137, '#FF6D40': 138, '#FF7240': 139, '#FF7740': 140, '#FF7C40': 141,
        '#FF8140': 142, '#FF8640': 143, '#FF8B40': 144, '#FF9040': 145, '#FF9540': 146,
        '#FF9A40': 147, '#FF9F40': 148, '#FFA440': 149, '#FFA940': 150, '#FFAE40': 151,
        '#FFB340': 152, '#FFB840': 153, '#FFBD40': 154, '#FFC240': 155, '#FFC740': 156,
        '#FFCC40': 157, '#FFD140': 158, '#FFD640': 159, '#FFDB40': 160, '#FFE040': 161,
        '#FFE540': 162, '#FFEA40': 163, '#FFEF40': 164, '#FFF440': 165, '#FFF940': 166,
        '#FFFF40': 167, '#FAFF40': 168, '#F5FF40': 169, '#F0FF40': 170, '#EBFF40': 171,
        '#E6FF40': 172, '#E1FF40': 173, '#DCFF40': 174, '#D7FF40': 175, '#D2FF40': 176,
        '#CDFF40': 177, '#C8FF40': 178, '#C3FF40': 179, '#BEFF40': 180, '#B9FF40': 181,
        '#B4FF40': 182, '#AFFF40': 183, '#AAFF40': 184, '#A5FF40': 185, '#A0FF40': 186,
        '#9BFF40': 187, '#96FF40': 188, '#91FF40': 189, '#8CFF40': 190, '#87FF40': 191,
        '#82FF40': 192, '#7DFF40': 193, '#78FF40': 194, '#73FF40': 195, '#6EFF40': 196,
        '#6AFF40': 197, '#65FF40': 198, '#60FF40': 199, '#5BFF40': 200, '#56FF40': 201,
        '#51FF40': 202, '#4CFF40': 203, '#47FF40': 204, '#42FF40': 205, '#3DFF40': 206,
        '#38FF40': 207, '#33FF40': 208, '#2EFF40': 209, '#29FF40': 210, '#24FF40': 211,
        '#1FFF40': 212, '#1AFF40': 213, '#15FF40': 214, '#10FF40': 215, '#0BFF40': 216,
        '#06FF40': 217, '#01FF40': 218, '#00FF45': 219, '#00FF4A': 220, '#00FF4F': 221,
        '#00FF54': 222, '#00FF59': 223, '#00FF5E': 224, '#00FF63': 225, '#00FF68': 226,
        '#00FF6D': 227, '#00FF72': 228, '#00FF77': 229, '#00FF7C': 230, '#00FF81': 231,
        '#00FF86': 232, '#00FF8B': 233, '#00FF90': 234, '#00FF95': 235, '#00FF9A': 236,
        '#00FF9F': 237, '#00FFA4': 238, '#00FFAA': 239, '#00FFAF': 240, '#00FFB4': 241,
        '#00FFB9': 242, '#00FFBE': 243, '#00FFC3': 244, '#00FFC8': 245, '#00FFCD': 246,
        '#00FFD2': 247, '#00FFD7': 248, '#00FFDC': 249, '#00FFE1': 250, '#00FFE6': 251,
        '#00FFEB': 252, '#00FFF0': 253, '#00FFF5': 254, '#0000FF': 255,
        // Special colors for your specific DXF files
        '#009800': 38912, // Green (specific to your DXF)
        '#00FF7F': 65407, // Light Green (specific to your DXF)
        '#FFFF00': 16776960, // Yellow (specific to your DXF)
        '#00CC00': 52224, // Dark Green (specific to your DXF)
        '#BE1E2D': 12459565, // Red variant (specific to your DXF)
        '#F7941D': 16225309, // Orange variant (specific to your DXF)
        '#2E3192': 3027346, // Blue variant (specific to your DXF)
        '#1C75BC': 1865148, // Blue variant (specific to your DXF)
        '#231F20': 2301728 // Dark variant (specific to your DXF)
    };
    
    // Try to find the ACI value for this hex color
    const aciValue = hexToAciMap[`#${hex.toUpperCase()}`];
    if (aciValue !== undefined) {
        return aciValue;
    }
    
    // If not found, return the hex value as a fallback
    return hex;
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