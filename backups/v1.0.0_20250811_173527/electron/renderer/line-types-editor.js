// Internal Line Types Editor - Create and manage internal line types

let lineTypes = [];
let currentProfile = null;

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
        const result = await window.electronAPI.getInternalLineTypes();
        if (result && Array.isArray(result)) {
            lineTypes = result;
            console.log('Loaded line types:', lineTypes.length);
        } else {
            console.error('Failed to load line types:', result);
            lineTypes = getDefaultLineTypes();
        }
    } catch (error) {
        console.error('Error loading line types:', error);
        lineTypes = getDefaultLineTypes();
    }
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
    
    return row;
}

function addNewLineType() {
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
    showStatus(`Added new line type: ${newLineType.name}`, 'success');
}

function deleteLineType(lineTypeId) {
    if (confirm('Are you sure you want to delete this line type?')) {
        lineTypes = lineTypes.filter(lt => lt.id !== lineTypeId);
        renderLineTypesTable();
        showStatus('Line type deleted', 'success');
    }
}

function duplicateLineType(lineTypeId) {
    const original = lineTypes.find(lt => lt.id === lineTypeId);
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
        showStatus(`Duplicated line type: ${duplicate.name}`, 'success');
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

async function reloadData() {
    await loadData();
    showStatus('Data reloaded', 'success');
}

function getDefaultLineTypes() {
    return [
        { id: '1', name: '1pt CW', description: '1 point', type: 'laser', width: 1, color: '#FF0000' },
        { id: '2', name: '2pt CW', description: '2 points', type: 'laser', width: 2, color: '#FF0000' },
        { id: '3', name: '3pt CW', description: '3 points', type: 'laser', width: 3, color: '#FF0000' },
        { id: '4', name: '4pt CW', description: '4 points', type: 'laser', width: 4, color: '#FF0000' },
        { id: '5', name: '2pt Puls', description: '2 points', type: 'laser', width: 2, color: '#FF0000' },
        { id: '6', name: '3pt Puls', description: '3 points', type: 'laser', width: 3, color: '#FF0000' },
        { id: '7', name: '4pt Puls', description: '4 points', type: 'laser', width: 4, color: '#FF0000' },
        { id: '8', name: '1.5pt CW', description: '1.5 points', type: 'laser', width: 1.5, color: '#FF0000' },
        { id: '9', name: '1pt Puls', description: '1 point', type: 'laser', width: 1, color: '#FF0000' },
        { id: '10', name: '1.5pt Puls', description: '1.5 points', type: 'laser', width: 1.5, color: '#FF0000' },
        { id: '11', name: 'Fast Engrave', description: 'Fast Engrave', type: 'engraving', width: 0.5, color: '#00FF00' },
        { id: '12', name: 'Fine Cut Pulse', description: 'Fine cut pulse', type: 'laser', width: 0.1, color: '#FF4444' },
        { id: '13', name: 'Fine Cut CW', description: 'Fine cut CW', type: 'laser', width: 0.1, color: '#FF4444' },
        { id: '14', name: '2pt Bridge', description: '2 points bridge', type: 'laser', width: 2, color: '#FFAA00' },
        { id: '15', name: '3pt Bridge', description: '3 points bridge', type: 'laser', width: 3, color: '#FFAA00' },
        { id: '16', name: '4pt Bridge', description: '4 points bridge', type: 'laser', width: 4, color: '#FFAA00' },
        { id: '17', name: 'Nozzle Engrave', description: 'Nozzle Engrave', type: 'engraving', width: 1, color: '#00AAFF' },
        { id: '18', name: 'Groove', description: 'Groove', type: 'laser', width: 2, color: '#AA00FF' },
        { id: '19', name: 'Cut CW', description: 'Cut CW', type: 'laser', width: 1, color: '#FF0044' },
        { id: '20', name: 'Pulse_1', description: 'Pulse_1', type: 'laser', width: 1, color: '#FF00AA' },
        { id: '21', name: 'Pulse_2', description: 'Pulse_2', type: 'laser', width: 2, color: '#FF00AA' },
        { id: '22', name: 'Engrave', description: 'Engrave', type: 'engraving', width: 0.5, color: '#00FF88' },
        { id: '23', name: 'Milling 1', description: 'Milling 1', type: 'milling', width: 0.5, color: '#666666' },
        { id: '24', name: 'Milling 2', description: 'Milling 2', type: 'milling', width: 1, color: '#777777' },
        { id: '25', name: 'Milling 3', description: 'Milling 3', type: 'milling', width: 1.5, color: '#888888' },
        { id: '26', name: 'Milling 4', description: 'Milling 4', type: 'milling', width: 2, color: '#999999' },
        { id: '27', name: 'Milling 5', description: 'Milling 5', type: 'milling', width: 2.5, color: '#AAAAAA' },
        { id: '28', name: 'Milling 6', description: 'Milling 6', type: 'milling', width: 3, color: '#BBBBBB' },
        { id: '29', name: 'Milling 7', description: 'Milling 7', type: 'milling', width: 4, color: '#CCCCCC' },
        { id: '30', name: 'Milling 8', description: 'Milling 8', type: 'milling', width: 5, color: '#DDDDDD' }
    ];
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
