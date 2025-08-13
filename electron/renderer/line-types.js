// Line Type Mapping - Minimalist Table Design

let lineTypes = [];
let machineTools = [];
let lineTypeMappings = [];
let currentProfile = null;

// DOM Elements
const tableBody = document.getElementById('lineTypeMappingTableBody');
const saveMappingsBtn = document.getElementById('saveMappingsBtn');
const reloadLineTypesBtn = document.getElementById('reloadLineTypesBtn');
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
    reloadLineTypesBtn.addEventListener('click', reloadLineTypes);
    reloadBtn.addEventListener('click', reloadData);
}

async function loadData() {
    try {
        showStatus('Loading data...');
        
        // Load internal line types (global, not profile-specific)
        await loadLineTypes();
        console.log('✅ Loaded global internal line types');
        
        // Load current profile (for machine tools and mappings)
        await loadCurrentProfile();
        
        // Load machine tools from profile
        await loadMachineTools();
        
        // Load existing mappings from profile
        await loadLineTypeMappings();
        
        // Synchronize line types with profile mappings
        await synchronizeLineTypesWithProfile();
        
        // Render the table
        renderMappingTable();
        
        showStatus(`Loaded ${lineTypes.length} internal line types and ${machineTools.length} machine tools`);
    } catch (error) {
        console.error('Error loading data:', error);
        showStatus('Failed to load data', 'error');
    }
}

async function loadCurrentProfile() {
    try {
        const profileResponse = await window.electronAPI.getCurrentProfile();
        if (profileResponse && profileResponse.success) {
            currentProfile = profileResponse.data;
            console.log('✅ Current profile loaded:', currentProfile.name);
        } else {
            console.warn('Failed to load current profile, using default:', profileResponse?.error);
            // Use default profile
            currentProfile = { filename: 'pts.xml', name: 'PTS Profile' };
        }
    } catch (error) {
        console.warn('Error loading current profile, using default:', error);
        currentProfile = { filename: 'pts.xml', name: 'PTS Profile' };
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
                        <strong>Critical Error:</strong> The application cannot continue without the line types configuration.
                    </div>
                    <div style="font-family: monospace; background: #f8f9fa; padding: 1rem; border-radius: 4px; word-break: break-word;">
                        ${message}
                    </div>
                    <div style="margin-top: 1rem;">
                        <strong>Required Action:</strong>
                        <ul>
                            <li>Ensure the <code>CONFIG/LineTypes/line-types.xml</code> file exists</li>
                            <li>Verify the XML file is not corrupted</li>
                            <li>Restart the application after fixing the issue</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="location.reload()">Retry</button>
                    <button class="btn btn-secondary" onclick="window.close()">Close Application</button>
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

async function loadMachineTools() {
    try {
        if (!currentProfile) {
            console.warn('No current profile available, cannot load machine tools');
            machineTools = [];
            return;
        }
        
        const result = await window.electronAPI.getToolsFromProfile();
        if (result && result.success) {
            machineTools = result.data;
            console.log('✅ Loaded machine tools from profile:', machineTools.length);
        } else {
            console.warn('Failed to load machine tools from profile:', result?.error);
            machineTools = [];
        }
    } catch (error) {
        console.warn('Error loading machine tools from profile:', error);
        machineTools = [];
    }
}

async function loadLineTypeMappings() {
    try {
        if (!currentProfile) {
            console.warn('No current profile available, cannot load line type mappings');
            lineTypeMappings = [];
            return;
        }
        
        const result = await window.electronAPI.getLineTypeMappingsFromProfile();
        if (result && result.success) {
            lineTypeMappings = result.data;
            console.log('✅ Loaded line type mappings from profile:', lineTypeMappings.length);
        } else {
            console.warn('Failed to load line type mappings from profile:', result?.error);
            lineTypeMappings = [];
        }
    } catch (error) {
        console.warn('Error loading line type mappings from profile:', error);
        lineTypeMappings = [];
    }
}

async function synchronizeLineTypesWithProfile() {
    try {
        if (!lineTypes || lineTypes.length === 0) {
            console.warn('No line types available for synchronization');
            return;
        }
        
        console.log('🔄 Synchronizing line types with profile mappings...');
        
        // Get existing mapped line type names
        const existingMappedNames = lineTypeMappings.map(m => m.lineTypeName);
        console.log('Existing mapped line types:', existingMappedNames);
        
        // Find line types that are not mapped in the profile
        const unmappedLineTypes = lineTypes.filter(lt => !existingMappedNames.includes(lt.name));
        
        if (unmappedLineTypes.length > 0) {
            console.log(`Found ${unmappedLineTypes.length} unmapped line types:`, unmappedLineTypes.map(lt => lt.name));
            
            // Add unmapped line types to the profile mappings (with empty tool assignment)
            const newMappings = unmappedLineTypes.map(lt => ({
                lineTypeId: lt.id,
                lineTypeName: lt.name,
                toolId: '', // Empty tool assignment
                toolName: '',
                description: lt.description || ''
            }));
            
            // Add new mappings to existing ones
            lineTypeMappings = [...lineTypeMappings, ...newMappings];
            
            console.log(`Added ${newMappings.length} new mappings to profile`);
            console.log('Updated line type mappings:', lineTypeMappings.map(m => ({ name: m.lineTypeName, tool: m.toolId })));
            
            // Save the updated mappings to the profile
            const saveResult = await window.electronAPI.saveLineTypeMappingsToProfile(lineTypeMappings);
            if (saveResult && saveResult.success) {
                console.log('✅ Successfully saved updated mappings to profile');
                showStatus(`Added ${newMappings.length} new line types to profile mappings`, 'success');
            } else {
                console.warn('Failed to save updated mappings to profile:', saveResult?.error);
                showStatus(`Added ${newMappings.length} new line types but failed to save to profile`, 'warning');
            }
        } else {
            console.log('✅ All line types are already mapped in the profile');
        }
        
    } catch (error) {
        console.error('Error synchronizing line types with profile:', error);
        showStatus('Failed to synchronize line types with profile', 'error');
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
        '1pt CW': 'Cutting',
        '1.5pt CW': 'Cutting',
        '2pt CW': 'Cutting',
        '3pt CW': 'Cutting',
        '4pt CW': 'Cutting',
        '1pt Puls': 'Pulsing',
        '1.5pt Puls': 'Pulsing',
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
        
        const result = await window.electronAPI.saveLineTypeMappingsToProfile(lineTypeMappings, currentProfile.filename);
        
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

async function reloadLineTypes() {
    try {
        showStatus('Reloading internal line types from global configuration...');
        
        // Force reload internal line types from global XML file
        await loadLineTypes();
        console.log('🔄 Reloaded global internal line types');
        
        // Re-synchronize line types with profile mappings
        await synchronizeLineTypesWithProfile();
        
        // Re-render the table with all line types
        renderMappingTable();
        
        showStatus(`✓ Reloaded ${lineTypes.length} internal line types and synchronized with profile`, 'success');
    } catch (error) {
        console.error('Error reloading internal line types:', error);
        showStatus('Failed to reload internal line types', 'error');
    }
}

async function addUnmappedLineTypes() {
    try {
        // Get all line types that should exist but might not have tool mappings
        const allLineTypeNames = lineTypes.map(lt => lt.name);
        const mappedLineTypeNames = lineTypeMappings.map(m => m.lineTypeName);
        
        // Find line types that exist but have no mappings
        const unmappedLineTypeNames = allLineTypeNames.filter(name => 
            !mappedLineTypeNames.includes(name)
        );
        
        console.log('Found unmapped line types:', unmappedLineTypeNames);
        
        // Add placeholder mappings for unmapped line types so they appear in the interface
        unmappedLineTypeNames.forEach(lineTypeName => {
            const existingMapping = lineTypeMappings.find(m => m.lineTypeName === lineTypeName);
            if (!existingMapping) {
                lineTypeMappings.push({
                    lineTypeId: getLineTypeId(lineTypeName),
                    lineTypeName: lineTypeName,
                    toolId: '', // Empty tool ID means "unmapped"
                    description: `${lineTypeName} - UNMAPPED`
                });
            }
        });
        
        return unmappedLineTypeNames;
    } catch (error) {
        console.error('Error checking for unmapped line types:', error);
        return [];
    }
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
