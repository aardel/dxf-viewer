// Line Type Mapping - Minimalist Table Design

let lineTypes = [];
let machineTools = [];
let lineTypeMappings = [];
let currentProfile = null;

// DOM Elements
const tableBody = document.getElementById('lineTypeMappingTableBody');
const saveMappingsBtn = document.getElementById('saveMappingsBtn');
const reloadBtn = document.getElementById('reloadBtn');
const statusText = document.getElementById('statusText');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔄 Line Type Mapping v3.0 - Loading...');
    setupEventListeners();
    await loadData();
    showStatus('Ready - Line Type Mapping v3.0 🚀');
});

function setupEventListeners() {
    saveMappingsBtn.addEventListener('click', saveMappings);
    reloadBtn.addEventListener('click', reloadData);
}

async function loadData() {
    try {
        showStatus('Loading data...');
        
        // Load current profile
        await loadCurrentProfile();
        
        // Load line types
        await loadLineTypes();
        
        // Load machine tools
        await loadMachineTools();
        
        // Load existing mappings
        await loadLineTypeMappings();
        
        // Render the table
        renderMappingTable();
        
        showStatus(`Loaded ${lineTypes.length} line types and ${machineTools.length} machine tools`);
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
            // Use default profile
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
        if (result.success) {
            lineTypes = result.data;
            console.log('Loaded line types:', lineTypes.length);
        } else {
            console.error('Failed to load line types:', result.error);
            lineTypes = getDefaultLineTypes();
        }
    } catch (error) {
        console.error('Error loading line types:', error);
        lineTypes = getDefaultLineTypes();
    }
}

async function loadMachineTools() {
    try {
        const result = await window.electronAPI.getToolsFromProfile();
        if (result.success) {
            machineTools = result.data;
            console.log('Loaded machine tools:', machineTools.length);
        } else {
            console.error('Failed to load machine tools:', result.error);
            machineTools = [];
        }
    } catch (error) {
        console.error('Error loading machine tools:', error);
        machineTools = [];
    }
}

async function loadLineTypeMappings() {
    try {
        const result = await window.electronAPI.getLineTypeMappingsFromProfile();
        if (result.success) {
            lineTypeMappings = result.data;
            console.log('Loaded line type mappings:', lineTypeMappings.length);
        } else {
            console.error('Failed to load line type mappings:', result.error);
            lineTypeMappings = [];
        }
    } catch (error) {
        console.error('Error loading line type mappings:', error);
        lineTypeMappings = [];
    }
}

function renderMappingTable() {
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (!lineTypes || lineTypes.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: #888; padding: 2rem;">
                    No line types available<br>
                    <small>Add line types to begin mapping</small>
                </td>
            </tr>
        `;
        return;
    }
    
    lineTypes.forEach((lineType, index) => {
        const row = createMappingRow(lineType, index);
        tableBody.appendChild(row);
    });
}

function createMappingRow(lineType, index) {
    const row = document.createElement('tr');
    row.dataset.lineType = lineType.name;
    
    // Find current mapping for this line type
    const currentMapping = lineTypeMappings.find(m => m.lineTypeName === lineType.name);
    const currentToolId = currentMapping ? currentMapping.toolId : '';
    
    // Create tool dropdown options
    const toolOptions = createToolDropdownOptions(currentToolId);
    
    row.innerHTML = `
        <td>
            <div class="line-type-name">
                <div class="line-type-icon"></div>
                <div>
                    <div>${lineType.name}</div>
                    <div class="line-type-details">
                        ${getOperationType(lineType.name)} • ${lineType.width || 1}mm width
                    </div>
                </div>
            </div>
        </td>
        <td class="arrow-column">→</td>
        <td>
            <select class="tool-selector" data-line-type="${lineType.name}" onchange="updateMapping('${lineType.name}', this.value)">
                <option value="">-- Select Tool --</option>
                ${toolOptions}
            </select>
        </td>
        <td class="actions-column">
            <button class="action-btn edit" onclick="editLineType('${lineType.name}')" title="Edit Line Type">
                ✏️
            </button>
            <button class="action-btn delete" onclick="removeMapping('${lineType.name}')" title="Remove Mapping">
                🗑️
            </button>
        </td>
    `;
    
    return row;
}

function createToolDropdownOptions(selectedToolId) {
    if (!machineTools || machineTools.length === 0) {
        return '<option value="">No tools available</option>';
    }
    
    return machineTools.map(tool => {
        const selected = tool.id === selectedToolId ? 'selected' : '';
        const displayName = `${tool.id} (${tool.width || 0}mm - ${tool.name || tool.description || 'No description'})`;
        return `<option value="${tool.id}" ${selected}>${displayName}</option>`;
    }).join('');
}

function getOperationType(lineTypeName) {
    // Map line type names to operation types
    const operationMap = {
        'Fast Engrave': 'Engraving',
        'Nozzle Engrave': 'Engraving',
        'Engrave': 'Engraving',
        'Fine Cut CW': 'Cutting',
        'Fine Cut Pulse': 'Cutting',
        '2pt CW': 'Cutting',
        '3pt CW': 'Cutting',
        '4pt CW': 'Cutting',
        '2pt Puls': 'Pulsing',
        '3pt Puls': 'Pulsing',
        '4pt Puls': 'Pulsing',
        'Milling 1': 'Milling',
        'Milling 2': 'Milling',
        'Milling 3': 'Milling',
        'Milling 4': 'Milling',
        'Milling 5': 'Milling',
        'Milling 6': 'Milling',
        'Milling 7': 'Milling',
        'Milling 8': 'Milling'
    };
    
    return operationMap[lineTypeName] || 'Operation';
}

// Global function for dropdown changes
window.updateMapping = function(lineTypeName, toolId) {
    console.log(`Updating mapping: ${lineTypeName} → ${toolId}`);
    
    // Update mappings array
    const existingIndex = lineTypeMappings.findIndex(m => m.lineTypeName === lineTypeName);
    
    if (existingIndex !== -1) {
        if (toolId) {
            lineTypeMappings[existingIndex].toolId = toolId;
        } else {
            lineTypeMappings.splice(existingIndex, 1);
        }
    } else if (toolId) {
        lineTypeMappings.push({
            lineTypeId: getLineTypeId(lineTypeName),
            lineTypeName: lineTypeName,
            toolId: toolId,
            description: `${lineTypeName} mapped to ${getToolName(toolId)}`
        });
    }
    
    const toolName = getToolDisplayName(toolId);
    if (toolId) {
        showStatus(`✓ Mapped ${lineTypeName} to ${toolName}`, 'success');
    } else {
        showStatus(`- Removed tool assignment from ${lineTypeName}`, 'info');
    }
};

function getLineTypeId(lineTypeName) {
    // Convert line type name to ID if needed
    const lineType = lineTypes.find(lt => lt.name === lineTypeName);
    return lineType ? (lineType.id || lineTypeName) : lineTypeName;
}

function getToolName(toolId) {
    if (!toolId) return 'No tool assigned';
    const tool = machineTools.find(t => t.id === toolId);
    return tool ? tool.name : 'Unknown tool';
}

function getToolDisplayName(toolId) {
    if (!toolId) return 'No tool assigned';
    const tool = machineTools.find(t => t.id === toolId);
    return tool ? `${tool.id} (${tool.name || tool.description || 'No description'})` : 'Unknown tool';
}

function editLineType(lineTypeName) {
    // TODO: Implement line type editing
    showStatus(`Edit functionality for ${lineTypeName} - Coming soon`, 'warning');
}

function removeMapping(lineTypeName) {
    if (confirm(`Remove tool mapping for "${lineTypeName}"?`)) {
        window.updateMapping(lineTypeName, '');
        showStatus(`Removed mapping for ${lineTypeName}`, 'info');
    }
}

async function saveMappings() {
    try {
        showStatus('Saving mappings...');
        
        if (!currentProfile) {
            showStatus('No active profile selected', 'error');
            return;
        }
        
        const result = await window.electronAPI.saveLineTypeMappings(lineTypeMappings, currentProfile.filename);
        
        if (result.success) {
            showStatus(`✓ Saved ${lineTypeMappings.length} mappings to ${currentProfile.name}`, 'success');
        } else {
            showStatus(`Error saving mappings: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error saving mappings:', error);
        showStatus('Failed to save mappings', 'error');
    }
}

async function reloadData() {
    await loadData();
}

function getDefaultLineTypes() {
    return [
        { name: '2pt CW', description: '2pt Continuous Wave', width: 2, type: 'cutting' },
        { name: '3pt CW', description: '3pt Continuous Wave', width: 3, type: 'cutting' },
        { name: '4pt CW', description: '4pt Continuous Wave', width: 4, type: 'cutting' },
        { name: '2pt Puls', description: '2pt Pulsing', width: 2, type: 'pulsing' },
        { name: '3pt Puls', description: '3pt Pulsing', width: 3, type: 'pulsing' },
        { name: '4pt Puls', description: '4pt Pulsing', width: 4, type: 'pulsing' },
        { name: 'Fast Engrave', description: 'Fast Engraving', width: 1, type: 'engraving' },
        { name: 'Fine Cut Pulse', description: 'Fine Cut Pulsing', width: 1, type: 'cutting' },
        { name: 'Fine Cut CW', description: 'Fine Cut Continuous Wave', width: 1, type: 'cutting' },
        { name: 'Nozzle Engrave', description: 'Nozzle Engraving', width: 1, type: 'engraving' },
        { name: 'Engrave', description: 'Standard Engraving', width: 1, type: 'engraving' },
        { name: 'Milling 1', description: 'Milling Tool 1', width: 1, type: 'milling' },
        { name: 'Milling 2', description: 'Milling Tool 2', width: 1, type: 'milling' },
        { name: 'Milling 3', description: 'Milling Tool 3', width: 1, type: 'milling' },
        { name: 'Milling 4', description: 'Milling Tool 4', width: 1, type: 'milling' },
        { name: 'Milling 5', description: 'Milling Tool 5', width: 1, type: 'milling' },
        { name: 'Milling 6', description: 'Milling Tool 6', width: 1, type: 'milling' },
        { name: 'Milling 7', description: 'Milling Tool 7', width: 1, type: 'milling' },
        { name: 'Milling 8', description: 'Milling Tool 8', width: 1, type: 'milling' }
    ];
}

function showStatus(message, type = 'info') {
    if (statusText) {
        statusText.textContent = message;
        statusText.className = type;
        
        // Auto-clear success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (statusText.textContent === message) {
                    statusText.textContent = 'Ready';
                    statusText.className = 'info';
                }
            }, 3000);
        }
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
}
