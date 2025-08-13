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

        // Load line types from the line-types.xml file
        const lineTypesResponse = await window.electronAPI.loadLineTypes();
        if (lineTypesResponse && lineTypesResponse.success) {
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
            console.log('✅ Loaded internal line types from global XML config:', lineTypes.length);
        } else {
            // Show critical error for missing/damaged line-types.xml
            console.error('CRITICAL: Failed to load internal line types:', lineTypesResponse?.error);
            if (lineTypesResponse?.requiresDialog) {
                showCriticalErrorDialog('Line Types Configuration Error', lineTypesResponse.error);
            }
            lineTypes = [];
            throw new Error(lineTypesResponse?.error || 'Failed to load line types');
        }

        // Apply existing mappings to line types
        mappings.forEach(mapping => {
            const lineType = lineTypes.find(lt => lt.name === mapping.lineTypeName);
            if (lineType) {
                lineType.assignedTool = mapping.toolId;
            }
        });
        
    } catch (error) {
        console.error('CRITICAL: Error loading unified mapping data:', error);
        showCriticalErrorDialog('Unified Mapping Loading Error', `Critical error loading configuration: ${error.message}`);
        tools = [];
        lineTypes = [];
        mappings = [];
        throw error;
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
                        <strong>Critical Error:</strong> The Unified Mapping interface cannot function without the line types configuration.
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
                    <button class="btn btn-secondary" onclick="window.close()">Close Interface</button>
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

 