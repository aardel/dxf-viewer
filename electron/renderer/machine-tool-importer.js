// Machine Tool Importer JavaScript
let parsedTools = [];
let currentFile = null;

// Initialize the importer
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    addConsoleMessage('Machine Tool Importer initialized', 'info');
});

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // File input handling
    document.getElementById('loadXmlBtn').addEventListener('click', loadXmlFile);
    document.getElementById('xmlFile').addEventListener('change', handleFileSelect);
    
    // Import actions
    document.getElementById('importToolsBtn').addEventListener('click', importSelectedTools);
    document.getElementById('cancelImportBtn').addEventListener('click', resetImporter);
    
    // Console actions
    document.getElementById('clearConsoleBtn').addEventListener('click', clearConsole);
    
    console.log('Event listeners setup complete');
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        currentFile = file;
        addConsoleMessage(`File selected: ${file.name}`, 'info');
    }
}

async function loadXmlFile() {
    if (!currentFile) {
        addConsoleMessage('Please select a file first', 'error');
        return;
    }

    try {
        addConsoleMessage('Loading XML file...', 'info');
        
        const text = await currentFile.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('Invalid XML format');
        }
        
        parsedTools = parseMachineTools(xmlDoc);
        displayToolPreview(parsedTools);
        
        addConsoleMessage(`Successfully parsed ${parsedTools.length} tools`, 'success');
        
    } catch (error) {
        addConsoleMessage(`Error parsing XML: ${error.message}`, 'error');
        console.error('XML parsing error:', error);
    }
}

function parseMachineTools(xmlDoc) {
    const tools = [];
    const machiningSettings = xmlDoc.getElementsByTagName('machining_setting');
    
    for (let i = 0; i < machiningSettings.length; i++) {
        const setting = machiningSettings[i];
        
        const tool = {
            id: setting.getAttribute('id'),
            name: setting.getAttribute('name'),
            hSystem: setting.getAttribute('h_system'),
            lineColor: setting.getAttribute('line_color'),
            lineThickness: setting.getAttribute('line_thickness'),
            toolClassId: setting.getAttribute('tool_class_id'),
            kerfAdjustment: setting.getAttribute('kerf_adjustment') === 'True',
            pierce: setting.getAttribute('pierce') === 'True',
            lineStyle: setting.getAttribute('line_style')
        };
        
        tools.push(tool);
    }
    
    return tools;
}

function displayToolPreview(tools) {
    const previewSection = document.getElementById('previewSection');
    const importOptions = document.getElementById('importOptions');
    const toolsGrid = document.getElementById('toolsGrid');
    
    // Update statistics
    const cuttingTools = tools.filter(t => t.toolClassId === '1').length;
    const millingTools = tools.filter(t => t.toolClassId === '2').length;
    
    document.getElementById('toolCount').textContent = `${tools.length} tools found`;
    document.getElementById('cuttingTools').textContent = `${cuttingTools} cutting tools`;
    document.getElementById('millingTools').textContent = `${millingTools} milling tools`;
    
    // Generate tool cards
    toolsGrid.innerHTML = '';
    tools.forEach(tool => {
        const toolCard = createToolCard(tool);
        toolsGrid.appendChild(toolCard);
    });
    
    // Show sections
    previewSection.style.display = 'block';
    importOptions.style.display = 'block';
}

function createToolCard(tool) {
    const card = document.createElement('div');
    card.className = `tool-card ${getToolClass(tool.toolClassId)}`;
    
    const colorHex = convertLineColorToHex(tool.lineColor);
    const toolType = getToolTypeName(tool.toolClassId);
    
    card.innerHTML = `
        <div class="tool-header">
            <div class="tool-name">${tool.name}</div>
            <div class="tool-id">T${tool.hSystem} / H${tool.hSystem}</div>
        </div>
        <div class="tool-details">
            <div class="detail-item">
                <span class="detail-label">Type:</span>
                <span class="detail-value">${toolType}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">T/H Number:</span>
                <span class="detail-value">${tool.hSystem}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Color:</span>
                <span class="detail-value">
                    <div class="color-preview" style="background-color: ${colorHex}"></div>
                    ${colorHex}
                </span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Width (mm):</span>
                <span class="detail-value">${tool.lineThickness}</span>
            </div>
        </div>
    `;
    
    return card;
}

function getToolClass(toolClassId) {
    switch (toolClassId) {
        case '1': return 'cutting';
        case '2': return 'milling';
        default: return '';
    }
}

function getToolTypeName(toolClassId) {
    switch (toolClassId) {
        case '1': return 'Cutting';
        case '2': return 'Milling';
        default: return 'Unknown';
    }
}

function convertLineColorToHex(lineColor) {
    // Remove 'ff' prefix if present (alpha channel)
    const color = lineColor.startsWith('ff') ? lineColor.substring(2) : lineColor;
    
    // Convert to proper hex format
    if (color.length === 6) {
        return `#${color}`;
    }
    
    return `#${color}`;
}

async function importSelectedTools() {
    const importCutting = document.getElementById('importCuttingTools').checked;
    const importMilling = document.getElementById('importMillingTools').checked;
    const importMode = document.querySelector('input[name="importMode"]:checked').value;
    
    if (!importCutting && !importMilling) {
        addConsoleMessage('Please select at least one tool type to import', 'error');
        return;
    }
    
    try {
        addConsoleMessage('Starting tool import...', 'info');
        
        // Filter tools based on selection
        const filteredTools = parsedTools.filter(tool => {
            if (tool.toolClassId === '1' && !importCutting) return false;
            if (tool.toolClassId === '2' && !importMilling) return false;
            return true;
        });
        
        addConsoleMessage(`Importing ${filteredTools.length} tools with mode: ${importMode}...`, 'info');
        
        // Convert to our tool format
        const convertedTools = filteredTools.map(tool => convertToOurFormat(tool));
        
        // Save to tool library
        const result = await window.electronAPI.saveMachineTools(convertedTools, importMode);
        
        if (result.success) {
            let message = `Successfully processed tools: `;
            if (result.importedCount > 0) {
                message += `${result.importedCount} imported`;
            }
            if (result.replacedCount > 0) {
                message += `${result.importedCount > 0 ? ', ' : ''}${result.replacedCount} replaced`;
            }
            message += ` (Total: ${result.totalTools} tools)`;
            
            addConsoleMessage(message, 'success');
            addConsoleMessage('Tools have been updated in your tool library', 'info');
            
            // Refresh tool configuration interface if it's open
            try {
                await window.electronAPI.refreshToolConfiguration();
                addConsoleMessage('Tool configuration interface refreshed', 'info');
            } catch (error) {
                console.log('Tool configuration interface not open or refresh failed:', error);
            }
        } else {
            throw new Error(result.error || 'Unknown error');
        }
        
    } catch (error) {
        addConsoleMessage(`Import failed: ${error.message}`, 'error');
        console.error('Import error:', error);
    }
}

function convertToOurFormat(tool, includeKerf, includePierce) {
    const colorHex = convertLineColorToHex(tool.lineColor);
    
    return {
        id: `T${tool.hSystem}`, // T number = H-System number
        name: tool.name, // Keep original name (Feinschnitt, 2-Pt CW, etc.)
        description: getToolTypeName(tool.toolClassId), // Type as description
        width: parseFloat(tool.lineThickness) || 0.5, // Width = thickness
        hCode: `H${tool.hSystem}`, // H = H-System
        type: tool.toolClassId === '1' ? 'cutting' : 'milling',
        color: colorHex,
        source: 'machine_import'
    };
}

function resetImporter() {
    parsedTools = [];
    currentFile = null;
    
    document.getElementById('xmlFile').value = '';
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('importOptions').style.display = 'none';
    
    addConsoleMessage('Importer reset', 'info');
}

function addConsoleMessage(message, type = 'info') {
    const consoleContent = document.getElementById('consoleContent');
    const messageDiv = document.createElement('div');
    messageDiv.className = `console-message ${type}`;
    messageDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    
    consoleContent.appendChild(messageDiv);
    consoleContent.scrollTop = consoleContent.scrollHeight;
}

function clearConsole() {
    document.getElementById('consoleContent').innerHTML = 
        '<div class="console-message info">Console cleared</div>';
}







async function loadAvailableItems(mode) {
    const availableList = document.getElementById('availableItemsList');
    availableList.innerHTML = '';
    
    try {
        if (mode === 'tool') {
            // Load tools from current profile
            const tools = await window.electronAPI.getToolsFromProfile('mtl.xml');
            const toolIds = Object.keys(tools);
            
            toolIds.forEach(toolId => {
                const tool = tools[toolId];
                const item = createPriorityItem(toolId, `${toolId} - ${tool.name}`, tool.description);
                availableList.appendChild(item);
            });
        } else {
            // Load actual line types from line-types.xml
            try {
                const response = await window.electronAPI.loadLineTypes();
                if (response.success && response.data) {
                    response.data.forEach(lineType => {
                        const item = createPriorityItem(lineType.name, lineType.name, lineType.description);
                        availableList.appendChild(item);
                    });
                } else {
                    // Fallback to default line types if loading fails
                    const defaultLineTypes = ['1pt CW', '2pt CW', '3pt CW', '4pt CW', 'Fast Engrave', 'Nozzle Engrave', 'Engrave', 'Milling 1', 'Milling 2', 'Milling 3'];
                    defaultLineTypes.forEach(lineType => {
                        const item = createPriorityItem(lineType, lineType, `Line type operation`);
                        availableList.appendChild(item);
                    });
                }
            } catch (error) {
                addConsoleMessage(`Error loading line types: ${error.message}`, 'error');
                // Fallback to default line types
                const defaultLineTypes = ['1pt CW', '2pt CW', '3pt CW', '4pt CW', 'Fast Engrave', 'Nozzle Engrave', 'Engrave', 'Milling 1', 'Milling 2', 'Milling 3'];
                defaultLineTypes.forEach(lineType => {
                    const item = createPriorityItem(lineType, lineType, `Line type operation`);
                    availableList.appendChild(item);
                });
            }
        }
    } catch (error) {
        addConsoleMessage(`Error loading ${mode} items: ${error.message}`, 'error');
    }
}

function createPriorityItem(id, name, description) {
    const item = document.createElement('div');
    item.className = 'priority-item';
    item.dataset.id = id;
    
    item.innerHTML = `
        <div class="priority-item-info">
            <div class="priority-item-name">${name}</div>
            <div class="priority-item-details">${description}</div>
        </div>
    `;
    
    item.addEventListener('click', () => toggleItemSelection(item));
    return item;
}

function toggleItemSelection(item) {
    item.classList.toggle('selected');
}

function addToPriorityList() {
    const availableList = document.getElementById('availableItemsList');
    const priorityList = document.getElementById('priorityOrderList');
    const selectedItems = availableList.querySelectorAll('.priority-item.selected');
    
    selectedItems.forEach(item => {
        const clonedItem = item.cloneNode(true);
        clonedItem.classList.remove('selected');
        clonedItem.addEventListener('click', () => togglePriorityItemSelection(clonedItem));
        
        // Add priority number
        const priorityNumber = priorityList.children.length + 1;
        const numberDiv = document.createElement('div');
        numberDiv.className = 'priority-item-number';
        numberDiv.textContent = priorityNumber;
        clonedItem.appendChild(numberDiv);
        
        priorityList.appendChild(clonedItem);
    });
    
    updatePriorityStatus();
    addConsoleMessage(`Added ${selectedItems.length} items to priority list`, 'success');
}

function togglePriorityItemSelection(item) {
    item.classList.toggle('selected');
}

function removeFromPriorityList() {
    const priorityList = document.getElementById('priorityOrderList');
    const selectedItems = priorityList.querySelectorAll('.priority-item.selected');
    
    selectedItems.forEach(item => item.remove());
    updatePriorityNumbers();
    updatePriorityStatus();
    
    addConsoleMessage(`Removed ${selectedItems.length} items from priority list`, 'info');
}

function insertBreak() {
    const priorityList = document.getElementById('priorityOrderList');
    const breakItem = document.createElement('div');
    breakItem.className = 'priority-item break-after';
    breakItem.innerHTML = `
        <div class="priority-item-info">
            <div class="priority-item-name">--- LINE BREAK ---</div>
            <div class="priority-item-details">Manual break in cutting sequence</div>
        </div>
    `;
    
    priorityList.appendChild(breakItem);
    updatePriorityStatus();
    addConsoleMessage('Inserted break in priority list', 'info');
}

function movePriorityItemUp() {
    const priorityList = document.getElementById('priorityOrderList');
    const selectedItem = priorityList.querySelector('.priority-item.selected');
    
    if (selectedItem && selectedItem.previousElementSibling) {
        priorityList.insertBefore(selectedItem, selectedItem.previousElementSibling);
        updatePriorityNumbers();
        addConsoleMessage('Moved item up in priority list', 'info');
    }
}

function movePriorityItemDown() {
    const priorityList = document.getElementById('priorityOrderList');
    const selectedItem = priorityList.querySelector('.priority-item.selected');
    
    if (selectedItem && selectedItem.nextElementSibling) {
        priorityList.insertBefore(selectedItem.nextElementSibling, selectedItem);
        updatePriorityNumbers();
        addConsoleMessage('Moved item down in priority list', 'info');
    }
}

function clearPriorityList() {
    const priorityList = document.getElementById('priorityOrderList');
    priorityList.innerHTML = '';
    updatePriorityStatus();
    addConsoleMessage('Cleared priority list', 'info');
}

function updatePriorityNumbers() {
    const priorityList = document.getElementById('priorityOrderList');
    const items = priorityList.querySelectorAll('.priority-item:not(.break-after)');
    
    items.forEach((item, index) => {
        let numberDiv = item.querySelector('.priority-item-number');
        if (!numberDiv) {
            numberDiv = document.createElement('div');
            numberDiv.className = 'priority-item-number';
            item.appendChild(numberDiv);
        }
        numberDiv.textContent = index + 1;
    });
}

function updatePriorityStatus() {
    const priorityList = document.getElementById('priorityOrderList');
    const itemCount = priorityList.querySelectorAll('.priority-item:not(.break-after)').length;
    const breakCount = priorityList.querySelectorAll('.priority-item.break-after').length;
    
    document.getElementById('priorityCount').textContent = `${itemCount} items in priority list`;
    document.getElementById('priorityMode').textContent = currentPriorityMode === 'tool' ? 'Tool-based' : 'Line Type-based';
}

async function savePriorityConfiguration() {
    try {
        const priorityList = document.getElementById('priorityOrderList');
        const items = Array.from(priorityList.children).map(item => {
            if (item.classList.contains('break-after')) {
                return '__LINE_BREAK__';
            }
            return item.dataset.id;
        });
        
        // Save to current profile
        await window.electronAPI.savePriorityConfiguration('mtl.xml', currentPriorityMode, items);
        
        addConsoleMessage('Priority configuration saved successfully', 'success');
    } catch (error) {
        addConsoleMessage(`Error saving priority configuration: ${error.message}`, 'error');
    }
}

async function loadPriorityConfiguration() {
    try {
        // Load from current profile
        const response = await window.electronAPI.loadPriorityConfiguration('mtl.xml');
        
        if (response && response.success && response.data) {
            const config = response.data;
            currentPriorityMode = config.mode || 'tool';
            currentPriorityLists[currentPriorityMode] = config.items || [];
            
            // Update UI
            document.getElementById(`priorityMode${currentPriorityMode.charAt(0).toUpperCase() + currentPriorityMode.slice(1)}`).checked = true;
            await loadAvailableItems(currentPriorityMode);
            displayPriorityList();
            
            addConsoleMessage('Priority configuration loaded successfully', 'success');
        } else {
            addConsoleMessage('No priority configuration found, using defaults', 'info');
        }
    } catch (error) {
        addConsoleMessage(`Error loading priority configuration: ${error.message}`, 'error');
    }
}

function displayPriorityList() {
    const priorityList = document.getElementById('priorityOrderList');
    priorityList.innerHTML = '';
    
    currentPriorityLists[currentPriorityMode].forEach((item, index) => {
        if (item === '__LINE_BREAK__') {
            const breakItem = document.createElement('div');
            breakItem.className = 'priority-item break-after';
            breakItem.innerHTML = `
                <div class="priority-item-info">
                    <div class="priority-item-name">--- LINE BREAK ---</div>
                    <div class="priority-item-details">Manual break in cutting sequence</div>
                </div>
            `;
            priorityList.appendChild(breakItem);
        } else {
            const itemElement = createPriorityItem(item, item, 'Priority item');
            const numberDiv = document.createElement('div');
            numberDiv.className = 'priority-item-number';
            numberDiv.textContent = index + 1;
            itemElement.appendChild(numberDiv);
            priorityList.appendChild(itemElement);
        }
    });
    
    updatePriorityStatus();
}

async function loadPriorityData() {
    await loadAvailableItems(currentPriorityMode);
    await loadPriorityConfiguration();
} 