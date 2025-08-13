// Internal Line Types Editor - Create and manage internal line types

let lineTypes = [];
let currentProfile = null;
let saveTimeout = null; // For debouncing save operations

// DOM Elements
const tableBody = document.getElementById('lineTypeEditorTableBody');
const saveLineTypesBtn = document.getElementById('saveLineTypesBtn');
const reloadBtn = document.getElementById('reloadBtn');
const addLineTypeBtn = document.getElementById('addLineTypeBtn');
const statusText = document.getElementById('statusText');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔄 Internal Line Types Editor v3.0 - Loading...');
    setupEventListeners();
    await loadData();
    showStatus('Ready - Internal Line Types Editor v3.0 🚀');
});

function setupEventListeners() {
    saveLineTypesBtn.addEventListener('click', saveLineTypes);
    reloadBtn.addEventListener('click', reloadData);
    addLineTypeBtn.addEventListener('click', addNewLineType);
}

async function loadData() {
    try {
        showStatus('Loading line types...');
        
        // Load current profile
        await loadCurrentProfile();
        
        // Load line types from XML
        await loadLineTypes();
        
        // Render the table
        renderLineTypesTable();
        
        showStatus(`Loaded ${lineTypes.length} line types`);
    } catch (error) {
        console.error('Error loading data:', error);
        showStatus('Failed to load data', 'error');
    }
}

async function loadCurrentProfile() {
    try {
        const profileResponse = await window.electronAPI.getCurrentProfile();
        if (profileResponse.success) {
            currentProfile = profileResponse.data;
            console.log('Current profile:', currentProfile);
        } else {
            console.error('Failed to load current profile:', profileResponse.error);
            currentProfile = { filename: 'mtl.xml', name: 'Default Profile' };
        }
    } catch (error) {
        console.error('Error loading current profile:', error);
        currentProfile = { filename: 'mtl.xml', name: 'Default Profile' };
    }
}

async function loadLineTypes() {
    try {
        const result = await window.electronAPI.loadLineTypes();
        if (result && result.success) {
            lineTypes = result.data;
            console.log('✅ Loaded internal line types from global XML config:', lineTypes.length);
        } else {
            // Show critical error dialog for missing/damaged line-types.xml
            if (result?.requiresDialog) {
                showCriticalErrorDialog('Line Types Configuration Error', result.error);
            }
            console.error('CRITICAL: Failed to load internal line types:', result?.error);
            lineTypes = [];
            throw new Error(result?.error || 'Failed to load line types');
        }
    } catch (error) {
        console.error('CRITICAL: Error loading internal line types:', error);
        lineTypes = [];
        showCriticalErrorDialog('Line Types Loading Error', `Critical error loading line types configuration: ${error.message}`);
        throw error;
    }
}

function showCriticalErrorDialog(title, message) {
    // Create modal dialog for critical errors
    const modalHTML = `
        <div id="criticalErrorModal" class="modal" style="display: flex; z-index: 10000;">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header" style="background: #dc3545; color: white;">
                    <h3>🚨 ${title}</h3>
                </div>
                <div class="modal-body">
                    <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
                        <strong>Critical Error:</strong> The Line Types Editor cannot function without the line types configuration.
                    </div>
                    <div style="font-family: monospace; background: #f8f9fa; padding: 1rem; border-radius: 4px; word-break: break-word;">
                        ${message}
                    </div>
                    <div style="margin-top: 1rem;">
                        <strong>Required Action:</strong>
                        <ul>
                            <li>Ensure the <code>CONFIG/LineTypes/line-types.xml</code> file exists</li>
                            <li>Verify the XML file is not corrupted</li>
                            <li>Use the application's backup tools to restore the configuration</li>
                            <li>Restart the application after fixing the issue</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="location.reload()">Retry</button>
                    <button class="btn btn-secondary" onclick="window.close()">Close Editor</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.getElementById('criticalErrorModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function renderLineTypesTable() {
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (lineTypes.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #888;">
                    No line types found. Click "Add Line Type" to create your first line type.
                </td>
            </tr>
        `;
        return;
    }
    
    lineTypes.forEach((lineType, index) => {
        const row = createLineTypeRow(lineType, index);
        tableBody.appendChild(row);
    });
}

function createLineTypeRow(lineType, index) {
    const row = document.createElement('tr');
    row.dataset.lineTypeId = lineType.id;
    
    row.innerHTML = `
        <td>
            <input type="text" class="line-type-id" value="${lineType.id || ''}" 
                   style="width: 60px; background: #333; border: 1px solid #555; color: #fff; padding: 4px; border-radius: 3px;">
        </td>
        <td>
            <input type="text" class="line-type-name" value="${lineType.name || ''}" 
                   style="width: 120px; background: #333; border: 1px solid #555; color: #fff; padding: 4px; border-radius: 3px;">
        </td>
        <td>
            <input type="text" class="line-type-description" value="${lineType.description || ''}" 
                   style="width: 200px; background: #333; border: 1px solid #555; color: #fff; padding: 4px; border-radius: 3px;">
        </td>
        <td>
            <select class="line-type-type" style="background: #333; border: 1px solid #555; color: #fff; padding: 4px; border-radius: 3px;">
                <option value="laser" ${lineType.type === 'laser' ? 'selected' : ''}>Laser</option>
                <option value="engraving" ${lineType.type === 'engraving' ? 'selected' : ''}>Engraving</option>
                <option value="milling" ${lineType.type === 'milling' ? 'selected' : ''}>Milling</option>
                <option value="cutting" ${lineType.type === 'cutting' ? 'selected' : ''}>Cutting</option>
                <option value="marking" ${lineType.type === 'marking' ? 'selected' : ''}>Marking</option>
            </select>
        </td>
        <td>
            <input type="number" class="line-type-width" value="${lineType.width || 1}" step="0.1" min="0.1" max="10"
                   style="width: 80px; background: #333; border: 1px solid #555; color: #fff; padding: 4px; border-radius: 3px;">
        </td>
        <td>
            <input type="color" class="line-type-color" value="${lineType.color || '#FF0000'}" 
                   style="width: 60px; height: 30px; background: #333; border: 1px solid #555; border-radius: 3px;">
        </td>
        <td>
            <button class="action-btn delete" onclick="deleteLineType('${lineType.id}')" title="Delete Line Type" 
                    style="background: #ff4444; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; margin-right: 4px;">
                🗑️
            </button>
            <button class="action-btn duplicate" onclick="duplicateLineType('${lineType.id}')" title="Duplicate Line Type"
                    style="background: #4444ff; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">
                📋
            </button>
        </td>
    `;
    
    // Add event listeners for auto-save on field changes
    const inputs = row.querySelectorAll('input, select');
    inputs.forEach(input => {
        // For select and color inputs, save immediately on change
        if (input.tagName === 'SELECT' || input.type === 'color') {
            input.addEventListener('change', () => {
                updateLineTypeFromRow(row);
            });
        } else {
            // For text and number inputs, use debounced save
            input.addEventListener('input', () => {
                updateLineTypeFromRow(row);
            });
            
            // Also save on blur for immediate feedback
            input.addEventListener('blur', async () => {
                clearTimeout(saveTimeout);
                updateLineTypeFromRow(row);
                
                // Save immediately on blur
                try {
                    const result = await window.electronAPI.saveLineTypes(lineTypes);
                    if (result.success) {
                        showStatus('Changes saved', 'success');
                    } else {
                        showStatus(`Failed to save changes: ${result.error}`, 'error');
                    }
                } catch (error) {
                    console.error('Error saving changes:', error);
                    showStatus('Failed to save changes', 'error');
                }
            });
        }
    });
    
    return row;
}

async function addNewLineType() {
    const newId = (lineTypes.length + 1).toString();
    const newLineType = {
        id: newId,
        name: `New Line Type ${newId}`,
        description: 'New line type description',
        type: 'laser',
        width: 1.0,
        color: '#FF0000'
    };
    
    lineTypes.push(newLineType);
    renderLineTypesTable();
    
    // Save the updated line types to XML
    try {
        const result = await window.electronAPI.saveLineTypes(lineTypes);
        if (result.success) {
            showStatus(`Added new line type: ${newLineType.name} and saved successfully`, 'success');
        } else {
            showStatus(`Failed to save changes: ${result.error}`, 'error');
            // Revert the addition if save failed
            lineTypes.pop();
            renderLineTypesTable();
        }
    } catch (error) {
        console.error('Error saving after addition:', error);
        showStatus('Failed to save changes after addition', 'error');
        // Revert the addition if save failed
        lineTypes.pop();
        renderLineTypesTable();
    }
}

async function deleteLineType(lineTypeId) {
    if (confirm('Are you sure you want to delete this line type?')) {
        // Convert lineTypeId to string for consistent comparison
        const targetId = lineTypeId.toString();
        console.log('Deleting line type with ID:', targetId, 'Type:', typeof targetId);
        console.log('Before deletion, line types count:', lineTypes.length);
        
        lineTypes = lineTypes.filter(lt => {
            const ltId = lt.id.toString();
            const shouldKeep = ltId !== targetId;
            console.log(`Line type ${ltId} (${typeof lt.id}): ${shouldKeep ? 'keeping' : 'deleting'}`);
            return shouldKeep;
        });
        
        console.log('After deletion, line types count:', lineTypes.length);
        renderLineTypesTable();
        
        // Save the updated line types to XML
        try {
            const result = await window.electronAPI.saveLineTypes(lineTypes);
            if (result.success) {
                showStatus('Line type deleted and saved successfully', 'success');
            } else {
                showStatus(`Failed to save changes: ${result.error}`, 'error');
                // Revert the deletion if save failed
                await loadLineTypes();
                renderLineTypesTable();
            }
        } catch (error) {
            console.error('Error saving after deletion:', error);
            showStatus('Failed to save changes after deletion', 'error');
            // Revert the deletion if save failed
            await loadLineTypes();
            renderLineTypesTable();
        }
    }
}

async function duplicateLineType(lineTypeId) {
    // Convert lineTypeId to string for consistent comparison
    const targetId = lineTypeId.toString();
    const original = lineTypes.find(lt => lt.id.toString() === targetId);
    if (original) {
        const newId = (Math.max(...lineTypes.map(lt => parseInt(lt.id) || 0)) + 1).toString();
        const duplicate = {
            ...original,
            id: newId,
            name: `${original.name} (Copy)`,
            description: `${original.description} (Copy)`
        };
        
        lineTypes.push(duplicate);
        renderLineTypesTable();
        
        // Save the updated line types to XML
        try {
            const result = await window.electronAPI.saveLineTypes(lineTypes);
            if (result.success) {
                showStatus(`Duplicated line type: ${duplicate.name} and saved successfully`, 'success');
            } else {
                showStatus(`Failed to save changes: ${result.error}`, 'error');
                // Revert the duplication if save failed
                lineTypes.pop();
                renderLineTypesTable();
            }
        } catch (error) {
            console.error('Error saving after duplication:', error);
            showStatus('Failed to save changes after duplication', 'error');
            // Revert the duplication if save failed
            lineTypes.pop();
            renderLineTypesTable();
        }
    }
}

async function saveLineTypes() {
    try {
        showStatus('Saving line types...');
        
        // Collect data from the table
        const updatedLineTypes = [];
        const rows = tableBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const idInput = row.querySelector('.line-type-id');
            const nameInput = row.querySelector('.line-type-name');
            const descInput = row.querySelector('.line-type-description');
            const typeSelect = row.querySelector('.line-type-type');
            const widthInput = row.querySelector('.line-type-width');
            const colorInput = row.querySelector('.line-type-color');
            
            if (idInput && nameInput) {
                updatedLineTypes.push({
                    id: idInput.value,
                    name: nameInput.value,
                    description: descInput ? descInput.value : '',
                    type: typeSelect ? typeSelect.value : 'laser',
                    width: widthInput ? parseFloat(widthInput.value) : 1.0,
                    color: colorInput ? colorInput.value : '#FF0000'
                });
            }
        });
        
        // Save to XML
        const result = await window.electronAPI.saveLineTypes(updatedLineTypes);
        if (result.success) {
            lineTypes = updatedLineTypes;
            showStatus(`Saved ${lineTypes.length} line types successfully`, 'success');
        } else {
            showStatus(`Failed to save: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error saving line types:', error);
        showStatus('Failed to save line types', 'error');
    }
}

function updateLineTypeFromRow(row) {
    const lineTypeId = row.dataset.lineTypeId;
    const idInput = row.querySelector('.line-type-id');
    const nameInput = row.querySelector('.line-type-name');
    const descInput = row.querySelector('.line-type-description');
    const typeSelect = row.querySelector('.line-type-type');
    const widthInput = row.querySelector('.line-type-width');
    const colorInput = row.querySelector('.line-type-color');
    
    if (idInput && nameInput) {
        // Find and update the line type in the array (handle type mismatch)
        const lineTypeIndex = lineTypes.findIndex(lt => lt.id.toString() === lineTypeId.toString());
        if (lineTypeIndex !== -1) {
            lineTypes[lineTypeIndex] = {
                id: idInput.value,
                name: nameInput.value,
                description: descInput ? descInput.value : '',
                type: typeSelect ? typeSelect.value : 'laser',
                width: widthInput ? parseFloat(widthInput.value) : 1.0,
                color: colorInput ? colorInput.value : '#FF0000'
            };
            
            // Update the row's dataset to reflect the new ID if it changed
            row.dataset.lineTypeId = idInput.value;
            
            // Debounce save operations to prevent too many saves
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(async () => {
                try {
                    const result = await window.electronAPI.saveLineTypes(lineTypes);
                    if (result.success) {
                        showStatus('Changes saved automatically', 'success');
                    } else {
                        showStatus(`Failed to save changes: ${result.error}`, 'error');
                    }
                } catch (error) {
                    console.error('Error saving changes:', error);
                    showStatus('Failed to save changes', 'error');
                }
            }, 500); // Wait 500ms after last change before saving
        }
    }
}

async function reloadData() {
    await loadData();
    showStatus('Data reloaded', 'success');
}


function showStatus(message, type = 'info') {
    if (statusText) {
        statusText.textContent = message;
        statusText.className = `status-message ${type}`;
        
        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusText.textContent = 'Ready';
                statusText.className = 'status-message info';
            }, 3000);
        }
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Make functions globally available
window.deleteLineType = deleteLineType;
window.duplicateLineType = duplicateLineType;
