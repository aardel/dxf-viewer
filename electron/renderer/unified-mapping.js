// Unified Mapping Workflow Window JavaScript
// Simplified design with dropdown selectors for each line type

// Global variables
let lineTypes = [];
let tools = [];
let mappings = [];

// Initialize the window when it loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Unified Mapping Window initialized');
    
    try {
        await loadLineTypesAndTools();
        await loadExistingMappings();
        renderLineTypeCards();
        setupEventListeners();
        console.log('Successfully loaded unified mapping interface');
    } catch (error) {
        console.error('Error loading unified mapping interface:', error);
        showConsoleError('Error loading interface. Check console for details.');
    }
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('addLineTypeBtn').addEventListener('click', addNewLineType);
    document.getElementById('saveMappingsBtn').addEventListener('click', saveMappings);
    document.getElementById('closeBtn').addEventListener('click', closeWindow);
    document.getElementById('consoleFilter').addEventListener('input', filterConsole);
}

// Load line types and tools from the profile
async function loadLineTypesAndTools() {
    try {
        // Load tools from profile
        const toolsResponse = await window.electronAPI.getToolsFromProfile();
        if (toolsResponse.success) {
            tools = toolsResponse.data;
            console.log('Loaded tools:', tools);
        } else {
            console.error('Failed to load tools:', toolsResponse.error);
            tools = getDefaultTools();
        }

        // Load line type mappings from profile
        const mappingsResponse = await window.electronAPI.getLineTypeMappingsFromProfile();
        if (mappingsResponse.success) {
            mappings = mappingsResponse.data;
            console.log('Loaded mappings:', mappings);
        } else {
            console.error('Failed to load mappings:', mappingsResponse.error);
            mappings = [];
        }

        // Load line types from the line-types.xml file (via CSV)
        const lineTypesResponse = await window.electronAPI.loadLineTypes();
        if (lineTypesResponse.success) {
            lineTypes = lineTypesResponse.data.map(lineType => ({
                name: lineType.name,
                description: lineType.description,
                width: parseFloat(lineType.width) || 1.0,
                mappedLayers: [],
                assignedTool: null,
                id: lineType.id,
                type: lineType.lineType || lineType.type,
                color: lineType.color
            }));
            console.log('Loaded line types from file:', lineTypes.length, 'types');
        } else {
            console.error('Failed to load line types from file:', lineTypesResponse.error);
            // Fallback to default line types
            lineTypes = getDefaultLineTypes();
        }

        // Apply existing mappings to line types
        mappings.forEach(mapping => {
            const lineType = lineTypes.find(lt => lt.name === mapping.lineTypeName);
            if (lineType) {
                lineType.assignedTool = mapping.toolId;
            }
        });
        
    } catch (error) {
        console.error('Error loading data:', error);
        tools = getDefaultTools();
        lineTypes = getDefaultLineTypes();
        mappings = [];
    }
}

// Load existing mappings
async function loadExistingMappings() {
    try {
        const response = await window.electronAPI.getLineTypeMappingsFromProfile();
        if (response.success) {
            mappings = response.data;
            console.log('Loaded existing mappings:', mappings);
            
            // Apply mappings to line types
            lineTypes.forEach(lineType => {
                lineType.assignedTool = null; // Reset first
            });
            
            mappings.forEach(mapping => {
                const lineType = lineTypes.find(lt => lt.name === mapping.lineTypeName);
                if (lineType) {
                    lineType.assignedTool = mapping.toolId;
                }
            });
        }
    } catch (error) {
        console.error('Error loading existing mappings:', error);
        mappings = [];
    }
}

// Create line types from mappings (deprecated - now using loadLineTypes)
function createLineTypesFromMappings(mappings) {
    console.log('createLineTypesFromMappings is deprecated - using loadLineTypes instead');
    return [];
}

// Render line type cards with dropdown selectors
function renderLineTypeCards() {
    const container = document.getElementById('internalLineTypesList');
    
    if (!lineTypes || lineTypes.length === 0) {
        container.innerHTML = `
            <div style="color: #aaa; padding: 1rem; text-align: center;">
                No line types available<br>
                Add line types to begin
            </div>
        `;
        return;
    }

    let html = '';
    lineTypes.forEach(lineType => {
        const assignedTool = lineType.assignedTool || '';
        const tool = tools[assignedTool];
        
        html += `
            <div class="line-type-card" data-line-type="${lineType.name}">
                <div class="line-type-header">
                    <div class="line-type-icon"></div>
                    <div class="line-type-name">${lineType.name}</div>
                </div>
                
                <div class="line-type-details">
                    <div class="detail-item">
                        <span class="detail-label">Operation:</span> ${getOperationType(lineType.name)}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Line Width:</span> ${lineType.width}mm
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Current Tool:</span> ${getToolDisplayName(assignedTool)}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Tool Width:</span> ${tool ? tool.width + 'mm' : 'N/A'}
                    </div>
                </div>
                
                <div class="tool-mapping-section">
                    <div class="tool-mapping-label">Select Machine Tool:</div>
                    <select class="tool-selector" data-line-type="${lineType.name}" onchange="window.updateToolMapping('${lineType.name}', this.value)">
                        <option value="">Choose tool...</option>
                        ${Object.entries(tools).map(([toolId, tool]) => `
                            <option value="${toolId}" ${assignedTool === toolId ? 'selected' : ''}>
                                ${tool.name} (${tool.width}mm - ${tool.description})
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Update tool mapping when dropdown changes - make it globally accessible
window.updateToolMapping = function(lineTypeName, toolId) {
    console.log(`Updating mapping: ${lineTypeName} → ${toolId}`);
    
    // Update the line type
    const lineType = lineTypes.find(lt => lt.name === lineTypeName);
    if (lineType) {
        lineType.assignedTool = toolId;
    }

    // Update mappings array
    const existingIndex = mappings.findIndex(m => m.lineTypeName === lineTypeName);
    if (existingIndex !== -1) {
        if (toolId) {
            mappings[existingIndex].toolId = toolId;
        } else {
            mappings.splice(existingIndex, 1);
        }
    } else if (toolId) {
        mappings.push({
            lineTypeId: getLineTypeId(lineTypeName),
            lineTypeName: lineTypeName,
            toolId: toolId,
            description: `${lineTypeName} mapped to ${getToolName(toolId)}`
        });
    }

    const toolName = getToolDisplayName(toolId);
    if (toolId) {
        showConsoleSuccess(`✓ Mapped ${lineTypeName} to ${toolName}`);
    } else {
        showConsoleInfo(`- Removed tool assignment from ${lineTypeName}`);
    }
    
    // Re-render to update the display
    renderLineTypeCards();
}

// Get tool name by ID
function getToolName(toolId) {
    if (!toolId) return 'No tool assigned';
    const tool = tools[toolId];
    return tool ? tool.name : 'Unknown tool';
}

// Get tool display name with better formatting
function getToolDisplayName(toolId) {
    if (!toolId) return 'None assigned';
    const tool = tools[toolId];
    return tool ? `${tool.name} (${tool.width}mm)` : 'Unknown tool';
}

// Get operation type from line type name
function getOperationType(lineTypeName) {
    const operationMap = {
        '1pt CW': 'Continuous Wave Cutting',
        '2pt CW': 'Continuous Wave Cutting',
        '3pt CW': 'Continuous Wave Cutting',
        '4pt CW': 'Continuous Wave Cutting',
        'cutting': 'Standard Cutting',
        'engraving': 'Engraving',
        'Fine Cut CW': 'Fine Cutting',
        'Nozzle Engrave': 'Nozzle Engraving'
    };
    return operationMap[lineTypeName] || 'Custom Operation';
}

// Get line type ID by name
function getLineTypeId(lineTypeName) {
    // Find the line type in our loaded data and return its ID
    const lineType = lineTypes.find(lt => lt.name === lineTypeName);
    return lineType ? lineType.id : lineTypeName;
}

// Add new line type
async function addNewLineType() {
    showConsoleInfo('Add Line Type functionality - coming soon');
    // TODO: Implement add line type modal
}

// Save mappings
async function saveMappings() {
    try {
        showConsoleInfo('Saving mappings...');
        
        const response = await window.electronAPI.saveLineTypeMappingsToProfile(mappings);
        if (response.success) {
            showConsoleSuccess('Mappings saved successfully!');
        } else {
            showConsoleError(`Failed to save mappings: ${response.error}`);
        }
    } catch (error) {
        console.error('Error saving mappings:', error);
        showConsoleError(`Error saving mappings: ${error.message}`);
    }
}

// Close window
function closeWindow() {
    window.close();
}

// Console functions
function showConsoleInfo(message) {
    addConsoleMessage('INFO', message, '#4a90e2');
}

function showConsoleSuccess(message) {
    addConsoleMessage('SUCCESS', message, '#4ae24a');
}

function showConsoleError(message) {
    addConsoleMessage('ERROR', message, '#ff4444');
}

function addConsoleMessage(level, message, color) {
    const consoleOutput = document.getElementById('consoleOutput');
    const timestamp = new Date().toLocaleTimeString();
    const messageElement = document.createElement('div');
    messageElement.style.color = color;
    messageElement.style.marginBottom = '0.25rem';
    messageElement.textContent = `[${timestamp}] ${level}: ${message}`;
    consoleOutput.appendChild(messageElement);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function filterConsole() {
    const filter = document.getElementById('consoleFilter').value.toLowerCase();
    const messages = document.querySelectorAll('#consoleOutput div');
    
    messages.forEach(message => {
        const text = message.textContent.toLowerCase();
        message.style.display = text.includes(filter) ? 'block' : 'none';
    });
}

// Default data functions
function getDefaultTools() {
    return [
        { id: 'T1', name: 'Fine Engraving', description: 'Precision engraving tool' },
        { id: 'T2', name: '2pt Cut CW', description: 'Laser Tool' },
        { id: 'T3', name: '3pt Cut CW', description: 'Laser Tool' },
        { id: 'T4', name: '4pt Cut CW', description: 'Laser Tool' },
        { id: 'T22', name: 'Fine Cut', description: 'FineCut' },
        { id: 'T20', name: 'Engraving', description: 'Engrave' }
    ];
}

function getDefaultLineTypes() {
    return [
        // CW operations
        { name: '1pt CW', description: '1 point continuous wave', width: 1, mappedLayers: [], assignedTool: null },
        { name: '2pt CW', description: '2 point continuous wave', width: 2, mappedLayers: [], assignedTool: null },
        { name: '3pt CW', description: '3 point continuous wave', width: 3, mappedLayers: [], assignedTool: null },
        { name: '4pt CW', description: '4 point continuous wave', width: 4, mappedLayers: [], assignedTool: null },
        { name: '1.5pt CW', description: '1.5 point continuous wave', width: 1.5, mappedLayers: [], assignedTool: null },
        { name: 'Fine Cut CW', description: 'Fine cutting operation', width: 0.5, mappedLayers: [], assignedTool: null },
        { name: 'Cut CW', description: 'Cut continuous wave', width: 1, mappedLayers: [], assignedTool: null },
        
        // Pulse operations
        { name: '2pt Puls', description: '2 point pulse', width: 2, mappedLayers: [], assignedTool: null },
        { name: '3pt Puls', description: '3 point pulse', width: 3, mappedLayers: [], assignedTool: null },
        { name: '4pt Puls', description: '4 point pulse', width: 4, mappedLayers: [], assignedTool: null },
        { name: '1pt Puls', description: '1 point pulse', width: 1, mappedLayers: [], assignedTool: null },
        { name: '1.5pt Puls', description: '1.5 point pulse', width: 1.5, mappedLayers: [], assignedTool: null },
        { name: 'Fine Cut Pulse', description: 'Fine cut pulse', width: 0.1, mappedLayers: [], assignedTool: null },
        { name: 'Pulse_1', description: 'Pulse 1', width: 1, mappedLayers: [], assignedTool: null },
        { name: 'Pulse_2', description: 'Pulse 2', width: 2, mappedLayers: [], assignedTool: null },
        
        // Bridge operations
        { name: '2pt Bridge', description: '2 point bridge', width: 2, mappedLayers: [], assignedTool: null },
        { name: '3pt Bridge', description: '3 point bridge', width: 3, mappedLayers: [], assignedTool: null },
        { name: '4pt Bridge', description: '4 point bridge', width: 4, mappedLayers: [], assignedTool: null },
        
        // Engraving operations
        { name: 'Fast Engrave', description: 'Fast engraving', width: 0.5, mappedLayers: [], assignedTool: null },
        { name: 'Nozzle Engrave', description: 'Nozzle engraving', width: 0.1, mappedLayers: [], assignedTool: null },
        { name: 'Engrave', description: 'Standard engraving', width: 0.5, mappedLayers: [], assignedTool: null },
        
        // Specialized operations
        { name: 'Groove', description: 'Groove operation', width: 2, mappedLayers: [], assignedTool: null },
        
        // Milling operations
        { name: 'Milling 1', description: 'Milling operation 1', width: 0.5, mappedLayers: [], assignedTool: null },
        { name: 'Milling 2', description: 'Milling operation 2', width: 1, mappedLayers: [], assignedTool: null },
        { name: 'Milling 3', description: 'Milling operation 3', width: 1.5, mappedLayers: [], assignedTool: null },
        { name: 'Milling 4', description: 'Milling operation 4', width: 2, mappedLayers: [], assignedTool: null },
        { name: 'Milling 5', description: 'Milling operation 5', width: 2.5, mappedLayers: [], assignedTool: null },
        { name: 'Milling 6', description: 'Milling operation 6', width: 3, mappedLayers: [], assignedTool: null },
        { name: 'Milling 7', description: 'Milling operation 7', width: 4, mappedLayers: [], assignedTool: null },
        { name: 'Milling 8', description: 'Milling operation 8', width: 5, mappedLayers: [], assignedTool: null },
        
        // Basic operations
        { name: 'cutting', description: 'Standard cutting operation', width: 1, mappedLayers: [], assignedTool: null },
        { name: 'engraving', description: 'Standard engraving operation', width: 0.5, mappedLayers: [], assignedTool: null },
        { name: 'perforating', description: 'Perforation lines', width: 0.5, mappedLayers: [], assignedTool: null },
        { name: 'scoring', description: 'Score lines for folding', width: 0.5, mappedLayers: [], assignedTool: null },
        { name: 'marking', description: 'Reference marks', width: 0.5, mappedLayers: [], assignedTool: null },
        { name: 'construction', description: 'Construction lines (skipped)', width: 0.5, mappedLayers: [], assignedTool: null }
    ];
} 