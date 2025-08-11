// Output Manager Window JavaScript
// Handles all machine-specific configuration and output settings

let currentProfile = null;
let availableProfiles = [];
let currentTools = [];
let currentMappings = [];
let currentPriorityOrder = [];

// Global variables for modal management
let modalCallback = null;
let modalType = null;
let editingTools = []; // Copy of tools for editing
let sortColumn = null;
let sortDirection = 'asc';

// Modal management functions
function showModal(title, placeholder, defaultValue = '', callback) {
    modalCallback = callback;
    modalType = 'input';
    
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalInput').placeholder = placeholder;
    document.getElementById('modalInput').value = defaultValue;
    document.getElementById('modalOverlay').style.display = 'flex';
    
    // Focus the input
    setTimeout(() => {
        document.getElementById('modalInput').focus();
    }, 100);
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    modalCallback = null;
    modalType = null;
}

function confirmModal() {
    if (modalCallback) {
        const input = document.getElementById('modalInput');
        modalCallback(input.value);
    }
    closeModal();
}

// Initialize the Output Manager when the window loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Output Manager window loaded');
    await initializeOutputManager();
});

async function initializeOutputManager() {
    try {
        // Load available profiles
        await loadAvailableProfiles();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load current profile if available
        await loadCurrentProfile();
        
        // Load all configuration data
        await loadAllConfiguration();
        
        // Update window title with current profile name
        if (currentProfile && currentProfile.name) {
            await window.electronAPI.updateOutputManagerTitle(currentProfile.name);
        }
        
    } catch (error) {
        console.error('Error initializing Output Manager:', error);
        showError('Failed to initialize Output Manager');
    }
}

async function loadAllConfiguration() {
    try {
        // Load tools
        await loadTools();
        
        // Load line type mappings
        await loadLineTypeMappings();
        
        // Load cutting priority
        await loadCuttingPriority();
        
        // Load header/footer configuration
        await loadHeaderFooterConfig();
        
        // Load output settings
        await loadOutputSettings();
        
    } catch (error) {
        console.error('Error loading configuration:', error);
        showError('Failed to load configuration');
    }
}

async function loadAvailableProfiles() {
    try {
        const profiles = await window.electronAPI.loadXmlProfiles();
        availableProfiles = profiles.map(profile => ({
            ...profile,
            name: profile.name ? profile.name.trim().replace(/[\r\n]/g, '') : profile.name,
            filename: profile.filename ? profile.filename.trim() : profile.filename
        }));
        
        console.log('Loaded profiles:', availableProfiles);
        
        const profileSelect = document.getElementById('profileSelect');
        if (profileSelect) {
            profileSelect.innerHTML = '';
            
            availableProfiles.forEach(profile => {
                const option = document.createElement('option');
                option.value = profile.filename || profile.id || profile.name;
                option.textContent = profile.name || profile.filename;
                profileSelect.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error loading available profiles:', error);
        showError('Failed to load profiles');
    }
}

async function loadCurrentProfile() {
    try {
        // Try to get the current profile from the main application's dropdown first
        const mainProfileSelect = document.querySelector('#postprocessorProfile');
        let currentProfileName = null;
        
        if (mainProfileSelect && mainProfileSelect.value && mainProfileSelect.value !== 'custom') {
            currentProfileName = mainProfileSelect.value.trim();
        } else {
            // Fallback: try to get from main window via IPC
            try {
                currentProfileName = await window.electronAPI.getMainWindowCurrentProfile();
                if (currentProfileName) {
                    currentProfileName = currentProfileName.trim();
                }
            } catch (ipcError) {
                console.log('IPC getMainWindowCurrentProfile failed, trying alternative method');
                // Try the old method as last resort
                try {
                    const profile = await window.electronAPI.getCurrentProfile();
                    if (profile) {
                        currentProfileName = (profile.id || profile.name).trim();
                    }
                } catch (oldIpcError) {
                    console.log('All IPC methods failed');
                }
            }
        }
        
        // If still no profile name, use the first available profile
        if (!currentProfileName && availableProfiles.length > 0) {
            currentProfileName = (availableProfiles[0].name || availableProfiles[0].filename).trim();
            console.log('Using first available profile as fallback:', currentProfileName);
        }
        
        if (currentProfileName) {
            // Find the profile in available profiles by name or filename
            const profile = availableProfiles.find(p => 
                p.name === currentProfileName ||
                p.filename === currentProfileName ||
                (p.filename && p.filename.replace('.xml', '') === currentProfileName.replace('.xml', ''))
            );
            
            if (profile) {
                currentProfile = profile;
                const profileSelect = document.getElementById('profileSelect');
                if (profileSelect) {
                    profileSelect.value = profile.filename || profile.id || profile.name;
                }
                await loadProfileConfiguration(profile);
                console.log('Successfully loaded current profile:', profile.name);
            } else {
                console.warn('Current profile not found in available profiles:', currentProfileName);
                console.log('Available profiles:', availableProfiles.map(p => ({ name: p.name, filename: p.filename })));
                
                // If not found, use the first available profile
                if (availableProfiles.length > 0) {
                    currentProfile = availableProfiles[0];
                    const profileSelect = document.getElementById('profileSelect');
                    if (profileSelect) {
                        profileSelect.value = currentProfile.filename || currentProfile.id || currentProfile.name;
                    }
                    await loadProfileConfiguration(currentProfile);
                    console.log('Using first available profile as fallback:', currentProfile.name);
                }
            }
        }
    } catch (error) {
        console.error('Error loading current profile:', error);
        showError('Failed to load current profile');
    }
}

async function saveOutputUnitsToProfile(units) {
    try {
        if (!currentProfile) return;
        
        // Use the correct profile filename
        const profileName = currentProfile.filename || currentProfile.id || currentProfile.name;
        // Save the units setting to the profile
        await window.electronAPI.savePostprocessorConfig(profileName, {
            units: units
        });
        
        showSuccess(`Output units set to ${units}`);
        
    } catch (error) {
        console.error('Error saving output units:', error);
        showError('Failed to save output units');
    }
}

async function loadProfileConfiguration(profile) {
    try {
        const config = await window.electronAPI.loadPostprocessorConfig(profile.id || profile.name);
        
        if (config) {
            populateConfigurationFields(config);
        } else {
            // Use default values if no config exists
            populateConfigurationFields({
                units: 'mm',
                includeLineNumbers: true
            });
        }
        
    } catch (error) {
        console.error('Error loading profile configuration:', error);
        // Use default values if config file doesn't exist
        console.log('Using default configuration values');
        populateConfigurationFields({
            units: 'mm',
            includeLineNumbers: true
        });
    }
}

function populateConfigurationFields(config) {
    // Profile settings
    const unitsSelect = document.getElementById('outputUnits');
    if (unitsSelect && config.units) {
        unitsSelect.value = config.units;
    }
    
    // Scale command is now in header/footer tab
    const scaleCommandInput = document.getElementById('scaleCommand');
    if (scaleCommandInput && config.scaleCommand) {
        scaleCommandInput.value = config.scaleCommand;
    }
    
    // Line numbers are now in output settings tab
    const lineNumbersCheckbox = document.getElementById('enableLineNumbers');
    if (lineNumbersCheckbox) {
        lineNumbersCheckbox.checked = config.includeLineNumbers !== false;
    }
}

async function loadTools() {
    try {
        if (!currentProfile) return;
        
        // Use the correct profile filename
        const profileName = currentProfile.filename || currentProfile.id || currentProfile.name;
        console.log('Loading tools for profile:', profileName);
        
        const response = await window.electronAPI.getToolsFromProfile(profileName);
        
        // Handle the response format from IPC
        if (response && response.success && response.data) {
            const tools = response.data;
            
            // Ensure tools is an array
            if (Array.isArray(tools)) {
                currentTools = tools;
            } else if (tools && typeof tools === 'object') {
                // If tools is an object, convert to array
                currentTools = Object.values(tools);
            } else {
                currentTools = [];
            }
        } else {
            console.warn('No tools data in response:', response);
            currentTools = [];
        }
        
        console.log('Loaded tools:', currentTools.length, 'tools');
        populateMainToolsTable();
        
    } catch (error) {
        console.error('Error loading tools:', error);
        currentTools = []; // Set empty array on error
        populateMainToolsTable(); // Still try to display
        showError('Failed to load tools');
    }
}

function populateMainToolsTable() {
    const tbody = document.getElementById('toolsTableBody');
    if (!tbody) {
        console.error('Tools table body not found');
        return;
    }
    
    console.log('Populating main tools table with:', currentTools);
    
    tbody.innerHTML = '';
    
    if (!Array.isArray(currentTools) || currentTools.length === 0) {
        console.warn('No tools to display - currentTools:', currentTools);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No tools found in profile</td></tr>';
        return;
    }
    
    // Sort tools if needed
    let toolsToDisplay = [...currentTools];
    if (sortColumn) {
        toolsToDisplay.sort((a, b) => {
            let aVal = a[sortColumn];
            let bVal = b[sortColumn];
            
            // Handle numeric sorting for ID and width
            if (sortColumn === 'id' || sortColumn === 'width') {
                aVal = parseFloat(aVal.toString().replace(/[^\d.]/g, '')) || 0;
                bVal = parseFloat(bVal.toString().replace(/[^\d.]/g, '')) || 0;
            } else {
                aVal = (aVal || '').toString().toLowerCase();
                bVal = (bVal || '').toString().toLowerCase();
            }
            
            if (sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    }
    
    console.log('Creating table rows for', toolsToDisplay.length, 'tools');
    
    toolsToDisplay.forEach((tool, index) => {
        console.log(`Creating table row ${index + 1}:`, tool);
        const row = document.createElement('tr');
        
        // Extract numeric part from H-Code for input field
        const hCodeInput = tool.hCode ? tool.hCode.replace(/^H/, '') : '';
        
        row.innerHTML = `
            <td><input type="number" value="${tool.id ? tool.id.replace(/[^\d]/g, '') : ''}" min="1"></td>
            <td><input type="text" value="${tool.name || ''}" maxlength="50"></td>
            <td><input type="text" value="${tool.description || ''}" maxlength="100"></td>
            <td><input type="number" value="${tool.width || 0}" min="0.1" max="100" step="0.1"></td>
            <td><input type="number" value="${hCodeInput}" min="1" max="999"></td>
            <td><input type="text" value="${tool.type || 'cut'}" maxlength="20"></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-danger btn-small" onclick="deleteMainTool(${index})">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    console.log('Main tools table now contains', tbody.children.length, 'rows');
}

function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    populateMainToolsTable();
}

// Main table operation functions - No longer needed with table rebuild approach
// function updateMainTool(index, field, value) {
//     // This function is no longer used since we rebuild from table on save
// }

// Validation function - No longer needed with table rebuild approach
// function validateMainToolField(index, field, input) {
//     // This function is no longer used since we validate on save
// }

function deleteMainTool(index) {
    try {
        if (index >= 0 && index < currentTools.length) {
            const toolToDelete = currentTools[index];
            const confirmDelete = confirm(`Are you sure you want to delete tool "${toolToDelete.name}" (${toolToDelete.id})?\n\nThis action cannot be undone.`);
            
            if (confirmDelete) {
                currentTools.splice(index, 1);
                populateMainToolsTable();
                showToolsStatus(`✅ Tool "${toolToDelete.name}" deleted successfully!`, 'success');
            }
        } else {
            showToolsStatus('❌ Invalid tool index for deletion', 'error');
        }
    } catch (error) {
        console.error('Error deleting tool:', error);
        showToolsStatus('❌ Error deleting tool', 'error');
    }
}

function addNewMainTool() {
    try {
        // Find the highest existing ID to generate a new unique ID
        const existingIds = currentTools.map(tool => {
            const idNum = parseInt(tool.id.toString().replace(/[^\d]/g, '')) || 0;
            return idNum;
        });
        
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        const newId = maxId + 1;
        
        // Find the highest existing H-Code to generate a new unique H-Code
        const existingHCodes = currentTools.map(tool => {
            const hCodeNum = parseInt(tool.hCode.toString().replace(/[^\d.]/g, '')) || 0;
            return hCodeNum;
        });
        
        const maxHCode = existingHCodes.length > 0 ? Math.max(...existingHCodes) : 0;
        const newHCode = maxHCode + 1;
        
        // Create new tool with empty fields
        const newTool = {
            id: `T${newId}`,
            name: '',
            description: '',
            width: 1,
            hCode: `H${newHCode}`,
            type: 'cut'
        };
        
        // Add to current tools array
        currentTools.push(newTool);
        
        // Refresh the table display
        populateMainToolsTable();
        
        // Show success message
        showToolsStatus('✅ New tool added! Please fill in the details and save.', 'success');
        
    } catch (error) {
        console.error('Error adding new tool:', error);
        showToolsStatus('❌ Error adding new tool', 'error');
    }
}

async function saveMainTools() {
    try {
        // Show saving status
        showToolsStatus('Reading table data...', 'info');
        
        // Read all data from the table and rebuild tools array
        const tableBody = document.getElementById('toolsTableBody');
        if (!tableBody) {
            showToolsStatus('❌ Tools table not found', 'error');
            return;
        }
        
        const tableRows = tableBody.querySelectorAll('tr');
        const newTools = [];
        const validationErrors = [];
        
        console.log('Reading', tableRows.length, 'table rows');
        
        tableRows.forEach((row, index) => {
            console.log(`Processing row ${index}: cells=${row.cells.length}, inputs=${row.querySelectorAll('input').length}`);
            // Skip empty rows or "No tools found" message
            if (row.cells.length < 7) { // 7 columns: ID, Name, Description, Width, H-Code, Type, Action
                console.log('Skipping row', index, '- not a tool row (cells:', row.cells.length, ')');
                return;
            }
            
            const inputs = row.querySelectorAll('input');
            if (inputs.length < 6) { // 6 input fields: ID, Name, Description, Width, H-Code, Type
                console.log('Skipping row', index, '- insufficient inputs (inputs:', inputs.length, ')');
                return;
            }
            
            // Extract values from table inputs
            const toolIdInput = inputs[0];
            const nameInput = inputs[1];
            const descriptionInput = inputs[2];
            const widthInput = inputs[3];
            const hCodeInput = inputs[4];
            const typeInput = inputs[5];
            
            // Get values and apply formatting
            const toolId = toolIdInput.value.trim();
            const name = nameInput.value.trim();
            const description = descriptionInput.value.trim();
            const width = parseFloat(widthInput.value) || 0;
            const hCode = hCodeInput.value.trim();
            const type = typeInput.value.trim();
            
            console.log(`Row ${index + 1}: ID=${toolId}, Name=${name}, HCode=${hCode}`);
            
            // Validation
            if (!toolId) {
                validationErrors.push(`Tool ${index + 1}: ID is required`);
            }
            if (!name) {
                validationErrors.push(`Tool ${index + 1}: Name is required`);
            }
            if (!description) {
                validationErrors.push(`Tool ${index + 1}: Description is required`);
            }
            if (isNaN(width) || width < 0.1 || width > 100) {
                validationErrors.push(`Tool ${index + 1}: Width must be between 0.1 and 100 mm`);
            }
            if (!hCode) {
                validationErrors.push(`Tool ${index + 1}: H-Code is required`);
            }
            if (!type) {
                validationErrors.push(`Tool ${index + 1}: Type is required`);
            }
            
            // Create tool object with proper formatting
            const tool = {
                id: toolId.startsWith('T') ? toolId : `T${toolId}`,
                name: name,
                description: description,
                width: width,
                hCode: hCode.startsWith('H') ? hCode : `H${hCode}`,
                type: type
            };
            
            newTools.push(tool);
        });
        
        // Check for duplicate IDs
        const ids = newTools.map(t => t.id);
        const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
            validationErrors.push(`Duplicate Tool IDs found: ${duplicateIds.join(', ')}`);
        }
        
        // Check for duplicate H-Codes
        const hCodes = newTools.map(t => t.hCode);
        const duplicateHCodes = hCodes.filter((code, index) => hCodes.indexOf(code) !== index);
        if (duplicateHCodes.length > 0) {
            validationErrors.push(`Duplicate H-Codes found: ${duplicateHCodes.join(', ')}`);
        }
        
        if (validationErrors.length > 0) {
            showToolsStatus('Validation errors:\n' + validationErrors.join('\n'), 'error');
            return;
        }
        
        if (!currentProfile) {
            showToolsStatus('No profile selected', 'error');
            return;
        }
        
        // Show saving status
        showToolsStatus('Saving tools to profile...', 'info');
        
        // Debug: Log the tools being saved
        console.log('Saving tools to profile:', currentProfile.filename);
        console.log('Tools data being saved:', newTools);
        console.log('Total tools to save:', newTools.length);
        
        // Update currentTools with the new data
        currentTools = newTools;
        
        // Save tools to profile using existing method
        const response = await window.electronAPI.saveMachineTools(currentTools, 'replace', currentProfile.filename);
        
        if (response && response.success) {
            showToolsStatus('✅ Tools saved successfully!', 'success');
            // No need to refresh the display since we're reading from it
        } else {
            showToolsStatus('❌ Failed to save tools', 'error');
        }
        
    } catch (error) {
        console.error('Error saving tools:', error);
        showToolsStatus('❌ Error saving tools: ' + error.message, 'error');
    }
}

async function loadLineTypeMappings() {
    try {
        if (!currentProfile) return;
        
        // Use the correct profile filename
        const profileName = currentProfile.filename || currentProfile.id || currentProfile.name;
        console.log('Loading line type mappings for profile:', profileName);
        const response = await window.electronAPI.getLineTypeMappingsFromProfile(profileName);
        
        // Handle the response format from IPC
        if (response && response.success && response.data) {
            const mappings = response.data;
            
            // Ensure mappings is an array
            if (Array.isArray(mappings)) {
                currentMappings = mappings;
            } else if (mappings && typeof mappings === 'object') {
                // If mappings is an object, convert to array
                currentMappings = Object.values(mappings);
            } else {
                currentMappings = [];
            }
        } else {
            console.warn('No mappings data in response:', response);
            currentMappings = [];
        }
        
        console.log('Loaded mappings:', currentMappings.length, 'mappings');
        displayLineTypeMappings();
        
    } catch (error) {
        console.error('Error loading line type mappings:', error);
        currentMappings = []; // Set empty array on error
        displayLineTypeMappings(); // Still try to display
        showError('Failed to load line type mappings');
    }
}

function displayLineTypeMappings() {
    const mappingGrid = document.getElementById('mappingGrid');
    if (!mappingGrid) return;
    
    mappingGrid.innerHTML = '';
    
    if (!Array.isArray(currentMappings) || currentMappings.length === 0) {
        mappingGrid.innerHTML = '<div class="no-data">No line type mappings found in profile</div>';
        return;
    }
    
    currentMappings.forEach(mapping => {
        const mappingCard = document.createElement('div');
        mappingCard.className = 'mapping-card';
        
        // Ensure currentTools is available for tool selection
        const toolOptions = Array.isArray(currentTools) ? currentTools.map(tool => 
            `<option value="${tool.id}" ${mapping.toolId === tool.id ? 'selected' : ''}>
                ${tool.id} (${tool.width || 0}mm - ${tool.description || 'No description'})
            </option>`
        ).join('') : '<option value="">No tools available</option>';
        
        mappingCard.innerHTML = `
            <h6>
                <span class="color-indicator" style="background: #ff0000;"></span>
                ${mapping.lineTypeName || 'Unknown'}
            </h6>
            <div><strong>Operation:</strong> ${mapping.lineTypeName || 'Unknown'}</div>
            <div><strong>Current Tool:</strong> ${mapping.toolId || 'None assigned'}</div>
            <div class="form-group">
                <label>Select Machine Tool:</label>
                <select class="form-select tool-select" data-line-type="${mapping.lineTypeId || ''}">
                    <option value="">Choose tool...</option>
                    ${toolOptions}
                </select>
            </div>
            <div><strong>Line Width:</strong> ${mapping.lineTypeName && mapping.lineTypeName.includes('pt') ? mapping.lineTypeName.split('pt')[0] + 'mm' : '1mm'}</div>
            <div><strong>Tool Width:</strong> ${mapping.toolId && Array.isArray(currentTools) ? (currentTools.find(t => t.id === mapping.toolId)?.width || 0) + 'mm' : 'N/A'}</div>
        `;
        mappingGrid.appendChild(mappingCard);
    });
}

async function loadCuttingPriority() {
    try {
        if (!currentProfile) return;
        
        // Use the correct profile filename
        const profileName = currentProfile.filename || currentProfile.id || currentProfile.name;
        console.log('Loading cutting priority for profile:', profileName);
        const response = await window.electronAPI.loadPriorityConfiguration(profileName);
        
        // Handle the response format from IPC
        if (response && response.success && response.data) {
            const priorityConfig = response.data;
            
            // Ensure priorityConfig.items is an array
            if (priorityConfig && Array.isArray(priorityConfig.items)) {
                currentPriorityOrder = priorityConfig.items;
            } else if (priorityConfig && priorityConfig.items && typeof priorityConfig.items === 'object') {
                // If items is an object, convert to array
                currentPriorityOrder = Object.values(priorityConfig.items);
            } else {
                currentPriorityOrder = [];
            }
        } else {
            console.warn('No priority data in response:', response);
            currentPriorityOrder = [];
        }
        
        console.log('Loaded priority order:', currentPriorityOrder.length, 'items');
        console.log('Priority order details:', currentPriorityOrder);
        displayCuttingPriority();
        
    } catch (error) {
        console.error('Error loading cutting priority:', error);
        currentPriorityOrder = []; // Set empty array on error
        displayCuttingPriority(); // Still try to display
        showError('Failed to load cutting priority');
    }
}

// Global variables for priority management
let selectedAvailableItems = new Set();
let selectedPriorityItems = new Set();

function displayCuttingPriority() {
    const availableItems = document.getElementById('availableItems');
    const priorityOrder = document.getElementById('priorityOrder');
    
    if (!availableItems || !priorityOrder) return;
    
    availableItems.innerHTML = '';
    priorityOrder.innerHTML = '';
    
    // Get available tools (tools not in priority order)
    const priorityToolIds = new Set();
    if (Array.isArray(currentPriorityOrder)) {
        currentPriorityOrder.forEach(item => {
            if (item.value && item.value !== '__LINE_BREAK__') {
                priorityToolIds.add(item.value);
            }
        });
    }
    
    // Display available tools (from currentTools, excluding those already in priority)
    console.log('Available tools for display:', currentTools);
    if (Array.isArray(currentTools) && currentTools.length > 0) {
        currentTools.forEach((tool, index) => {
            if (!priorityToolIds.has(tool.id)) {
                const item = document.createElement('div');
                item.className = 'priority-item';
                item.dataset.toolId = tool.id;
                item.dataset.index = index;
                item.onclick = () => toggleAvailableItemSelection(item);
                item.innerHTML = `
                    <span class="order-badge">${index + 1}</span>
                    <span class="item-name">${tool.id} - ${tool.name || 'Unknown Tool'}</span>
                `;
                availableItems.appendChild(item);
            }
        });
    }
    
    if (availableItems.children.length === 0) {
        availableItems.innerHTML = '<div class="no-data">All tools are in priority order</div>';
    }
    
    // Display priority order
    if (Array.isArray(currentPriorityOrder) && currentPriorityOrder.length > 0) {
        currentPriorityOrder.forEach((item, index) => {
            const priorityItem = document.createElement('div');
            priorityItem.className = 'priority-item';
            priorityItem.dataset.index = index;
            priorityItem.onclick = () => togglePriorityItemSelection(priorityItem);
            
            if (item.value === '__LINE_BREAK__') {
                priorityItem.innerHTML = `
                    <span class="priority-number">${index + 1}.</span>
                    <span class="break-item">--- BREAK ---</span>
                `;
                priorityItem.classList.add('break-item');
            } else {
                // Find the tool details
                const tool = Array.isArray(currentTools) ? currentTools.find(t => t.id === item.value) : null;
                console.log('Looking for tool:', item.value, 'Found:', tool);
                const toolName = tool ? (tool.name || 'Unknown Tool') : 'Unknown Tool';
                priorityItem.innerHTML = `
                    <span class="priority-number">${index + 1}.</span>
                    <span class="item-name">${item.value} - ${toolName}</span>
                `;
            }
            priorityOrder.appendChild(priorityItem);
        });
    } else {
        priorityOrder.innerHTML = '<div class="no-data">No priority order set</div>';
    }
}

function toggleAvailableItemSelection(item) {
    if (selectedAvailableItems.has(item.dataset.toolId)) {
        selectedAvailableItems.delete(item.dataset.toolId);
        item.classList.remove('selected');
    } else {
        selectedAvailableItems.add(item.dataset.toolId);
        item.classList.add('selected');
    }
}

function togglePriorityItemSelection(item) {
    const index = parseInt(item.dataset.index);
    if (selectedPriorityItems.has(index)) {
        selectedPriorityItems.delete(index);
        item.classList.remove('selected');
    } else {
        selectedPriorityItems.add(index);
        item.classList.add('selected');
    }
}

function addSelectedItemsToPriority() {
    if (selectedAvailableItems.size === 0) return;
    
    // Convert currentPriorityOrder to array if it's not already
    if (!Array.isArray(currentPriorityOrder)) {
        currentPriorityOrder = [];
    }
    
    // Add selected items to priority order
    selectedAvailableItems.forEach(toolId => {
        currentPriorityOrder.push({
            order: currentPriorityOrder.length + 1,
            value: toolId
        });
    });
    
    // Clear selection and refresh display
    selectedAvailableItems.clear();
    displayCuttingPriority();
    
    // Auto-save the changes
    autoSavePriorityConfiguration();
}

function removeSelectedItemsFromPriority() {
    if (selectedPriorityItems.size === 0) return;
    
    // Convert to array and sort in descending order to remove from end first
    const indicesToRemove = Array.from(selectedPriorityItems).sort((a, b) => b - a);
    
    indicesToRemove.forEach(index => {
        if (index >= 0 && index < currentPriorityOrder.length) {
            currentPriorityOrder.splice(index, 1);
        }
    });
    
    // Reorder remaining items
    currentPriorityOrder.forEach((item, index) => {
        item.order = index + 1;
    });
    
    // Clear selection and refresh display
    selectedPriorityItems.clear();
    displayCuttingPriority();
    
    // Auto-save the changes
    autoSavePriorityConfiguration();
}

function addBreakToPriority() {
    if (!Array.isArray(currentPriorityOrder)) {
        currentPriorityOrder = [];
    }
    
    currentPriorityOrder.push({
        order: currentPriorityOrder.length + 1,
        value: '__LINE_BREAK__'
    });
    
    displayCuttingPriority();
    
    // Auto-save the changes
    autoSavePriorityConfiguration();
}

function moveSelectedItemsUp() {
    if (selectedPriorityItems.size === 0) return;
    
    const indicesToMove = Array.from(selectedPriorityItems).sort((a, b) => a - b);
    
    indicesToMove.forEach(index => {
        if (index > 0 && index < currentPriorityOrder.length) {
            // Swap with previous item
            const temp = currentPriorityOrder[index];
            currentPriorityOrder[index] = currentPriorityOrder[index - 1];
            currentPriorityOrder[index - 1] = temp;
            
            // Update selection
            selectedPriorityItems.delete(index);
            selectedPriorityItems.add(index - 1);
        }
    });
    
    // Reorder all items
    currentPriorityOrder.forEach((item, index) => {
        item.order = index + 1;
    });
    
    displayCuttingPriority();
    
    // Auto-save the changes
    autoSavePriorityConfiguration();
}

function moveSelectedItemsDown() {
    if (selectedPriorityItems.size === 0) return;
    
    const indicesToMove = Array.from(selectedPriorityItems).sort((a, b) => b - a);
    
    indicesToMove.forEach(index => {
        if (index >= 0 && index < currentPriorityOrder.length - 1) {
            // Swap with next item
            const temp = currentPriorityOrder[index];
            currentPriorityOrder[index] = currentPriorityOrder[index + 1];
            currentPriorityOrder[index + 1] = temp;
            
            // Update selection
            selectedPriorityItems.delete(index);
            selectedPriorityItems.add(index + 1);
        }
    });
    
    // Reorder all items
    currentPriorityOrder.forEach((item, index) => {
        item.order = index + 1;
    });
    
    displayCuttingPriority();
    
    // Auto-save the changes
    autoSavePriorityConfiguration();
}

async function savePriorityConfiguration() {
    try {
        if (!currentProfile) return;
        
        // Use the correct profile filename
        const profileName = currentProfile.filename || currentProfile.id || currentProfile.name;
        
        // Save priority configuration to profile
        await window.electronAPI.savePriorityConfiguration(profileName, 'tool', currentPriorityOrder);
        
        showSuccess('Priority configuration saved successfully');
        
    } catch (error) {
        console.error('Error saving priority configuration:', error);
        showError('Failed to save priority configuration');
    }
}

async function autoSavePriorityConfiguration() {
    try {
        if (!currentProfile) return;
        
        // Show auto-save indicator
        const statusElement = document.getElementById('priorityStatus');
        if (statusElement) {
            statusElement.style.display = 'block';
        }
        
        // Use the correct profile filename
        const profileName = currentProfile.filename || currentProfile.id || currentProfile.name;
        
        // Save priority configuration to profile silently
        await window.electronAPI.savePriorityConfiguration(profileName, 'tool', currentPriorityOrder);
        
        console.log('Priority configuration auto-saved');
        
        // Hide auto-save indicator after a short delay
        setTimeout(() => {
            if (statusElement) {
                statusElement.style.display = 'none';
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error auto-saving priority configuration:', error);
        // Don't show error to user for auto-save
        
        // Hide auto-save indicator on error
        const statusElement = document.getElementById('priorityStatus');
        if (statusElement) {
            statusElement.style.display = 'none';
        }
    }
}

function resetPriorityOrder() {
    if (confirm('Are you sure you want to reset the priority order? This will remove all items from the priority list.')) {
        currentPriorityOrder = [];
        selectedAvailableItems.clear();
        selectedPriorityItems.clear();
        displayCuttingPriority();
        
        // Auto-save the empty priority order
        autoSavePriorityConfiguration();
        
        showSuccess('Priority order reset successfully');
    }
}

async function loadHeaderFooterConfig() {
    try {
        if (!currentProfile) return;
        
        // Use the correct profile filename
        const profileName = currentProfile.filename || currentProfile.id || currentProfile.name;
        const config = await window.electronAPI.loadPostprocessorConfig(profileName);
        
        if (config) {
            // Populate header settings
            const machineType = document.getElementById('machineType');
            if (machineType && config.machineType) {
                machineType.value = config.machineType;
            }
            
            const headerTemplate = document.getElementById('headerTemplate');
            if (headerTemplate && config.headerTemplate) {
                headerTemplate.value = config.headerTemplate;
            }
            
            const initialCommands = document.getElementById('initialCommands');
            if (initialCommands && config.initialCommands) {
                initialCommands.value = config.initialCommands;
            }
            
            // Update preview
            updateHeaderPreview();
        }
        
    } catch (error) {
        console.error('Error loading header/footer config:', error);
        showError('Failed to load header/footer configuration');
    }
}

function updateHeaderPreview() {
    const headerPreview = document.getElementById('headerPreview');
    const footerPreview = document.getElementById('footerPreview');
    
    if (headerPreview) {
        headerPreview.textContent = `%1
(Generated by DXF2Laser)
(File: example.dxf)
(Size: 100.0 x 50.0 mm)
(Timestamp: ${new Date().toISOString()})
G90
G60 X0`;
    }
    
    if (footerPreview) {
        footerPreview.textContent = `M30
(End of Program)`;
    }
}

async function loadOutputSettings() {
    try {
        // Load file output settings
        const defaultSavePath = document.getElementById('defaultSavePath');
        if (defaultSavePath) {
            // This would come from user preferences
            defaultSavePath.value = '/Volumes/Public/Lasercomb';
        }
        
        const filenameTemplate = document.getElementById('filenameTemplate');
        if (filenameTemplate) {
            filenameTemplate.value = '{original_name}.din';
        }
        
        // Load line numbers settings
        const startNumber = document.getElementById('startNumber');
        if (startNumber) {
            startNumber.value = '10';
        }
        
        const increment = document.getElementById('increment');
        if (increment) {
            increment.value = '1';
        }
        
        const formatTemplate = document.getElementById('formatTemplate');
        if (formatTemplate) {
            formatTemplate.value = 'N{number}';
        }
        
        // Load G-code commands
        const homeCommand = document.getElementById('homeCommand');
        if (homeCommand) {
            homeCommand.value = 'G0 X0 Y0';
        }
        
        const programEndCommand = document.getElementById('programEndCommand');
        if (programEndCommand) {
            programEndCommand.value = 'M30';
        }
        
    } catch (error) {
        console.error('Error loading output settings:', error);
        showError('Failed to load output settings');
    }
}

function setupEventListeners() {
    // Profile selection change
    const profileSelect = document.getElementById('profileSelect');
    if (profileSelect) {
        profileSelect.addEventListener('change', async (e) => {
            const selectedProfileId = e.target.value;
            if (selectedProfileId) {
                // Find profile by filename, name, or id
                const profile = availableProfiles.find(p => 
                    p.filename === selectedProfileId ||
                    p.name === selectedProfileId ||
                    p.id === selectedProfileId
                );
                if (profile) {
                    currentProfile = profile;
                    await loadProfileConfiguration(profile);
                    // Reload all configuration data for the new profile
                    await loadAllConfiguration();
                    console.log('Switched to profile:', profile.name);
                    
                    // Update window title with profile name
                    await window.electronAPI.updateOutputManagerTitle(profile.name);
                } else {
                    console.warn('Selected profile not found:', selectedProfileId);
                    // Update window title to show no profile
                    await window.electronAPI.updateOutputManagerTitle('No Profile Selected');
                }
            }
        });
    }
    
    // Output units change
    const outputUnits = document.getElementById('outputUnits');
    if (outputUnits) {
        outputUnits.addEventListener('change', (e) => {
            // Save the units selection to the current profile
            if (currentProfile) {
                saveOutputUnitsToProfile(e.target.value);
            }
        });
    }
    
    // Profile management buttons
    const newProfileBtn = document.getElementById('newProfileBtn');
    if (newProfileBtn) {
        newProfileBtn.addEventListener('click', async () => {
            showModal('Create New Profile', 'Enter new profile name:', '', async (profileName) => {
                try {
                    // Create a completely new, independent profile
                    const newProfile = {
                        name: profileName.trim(),
                        description: 'New independent profile',
                        filename: `${profileName.trim().toLowerCase().replace(/\s+/g, '_')}.xml`
                    };
                    
                    // Create a complete, independent profile structure that matches XML generator expectations
                    const newProfileData = {
                        ShowConfigIssuesOnStartup: false,
                        profileInfo: {
                            name: newProfile.name,
                            description: newProfile.description,
                            version: '1.0',
                            created: new Date().toISOString().split('T')[0],
                            lastModified: new Date().toISOString().split('T')[0],
                            author: 'User'
                        },
                        units: {
                            feedInchMachine: false,
                            scalingHeader: {
                                enabled: false,
                                parameter: '',
                                scaleCommand: '',
                                comment: ''
                            }
                        },
                        tools: {
                            T1: {
                                name: 'Default Tool',
                                description: 'Default cutting tool',
                                width: 1,
                                hCode: 'H1'
                            }
                        },
                        lineTypeMappings: {},
                        optimization: {
                            primaryStrategy: 'nearest',
                            withinGroupOptimization: 'closest_path',
                            includeComments: true,
                            validateWidths: true,
                            respectManualBreaks: true
                        },
                        outputSettings: {
                            enableLineNumbers: false,
                            scaleCommand: '',
                            header: '',
                            footer: ''
                        }
                    };
                    
                    // Save the new independent profile
                    await window.electronAPI.saveXmlProfile(newProfile.filename, newProfileData);
                    
                    // Refresh the profile list
                    await loadAvailableProfiles();
                    showSuccess(`Profile "${newProfile.name}" created successfully`);
                } catch (error) {
                    console.error('Error creating new profile:', error);
                    showError('Failed to create new profile');
                }
            });
        });
    }
    
    const copyProfileBtn = document.getElementById('copyProfileBtn');
    if (copyProfileBtn) {
        copyProfileBtn.addEventListener('click', async () => {
            if (!currentProfile) {
                showError('No profile selected to copy');
                return;
            }
            
            showModal('Copy Profile', `Enter name for copy of "${currentProfile.name}":`, `${currentProfile.name} Copy`, async (copyName) => {
                try {
                    // Copy the current profile
                    const copyProfile = {
                        name: copyName.trim(),
                        description: `Copy of ${currentProfile.name}`,
                        filename: `${copyName.trim().toLowerCase().replace(/\s+/g, '_')}.xml`
                    };
                    
                    // Load the current profile data and create an independent copy
                    const currentProfileData = await window.electronAPI.loadXmlProfile(currentProfile.filename || currentProfile.id);
                    if (currentProfileData) {
                        // Create a deep copy and update the profile info for independence
                        const copiedProfileData = JSON.parse(JSON.stringify(currentProfileData));
                        
                        // Update the profile metadata to make it independent
                        if (copiedProfileData.profileInfo) {
                            copiedProfileData.profileInfo.name = copyProfile.name;
                            copiedProfileData.profileInfo.description = copyProfile.description;
                            copiedProfileData.profileInfo.lastModified = new Date().toISOString().split('T')[0];
                            copiedProfileData.profileInfo.created = new Date().toISOString().split('T')[0];
                        }
                        
                        // Save the independent copy
                        await window.electronAPI.saveXmlProfile(copyProfile.filename, copiedProfileData);
                        
                        // Refresh the profile list
                        await loadAvailableProfiles();
                        showSuccess(`Profile "${copyProfile.name}" created successfully`);
                    } else {
                        showError('Failed to load current profile data');
                    }
                } catch (error) {
                    console.error('Error copying profile:', error);
                    showError('Failed to copy profile');
                }
            });
        });
    }
    
    const deleteProfileBtn = document.getElementById('deleteProfileBtn');
    if (deleteProfileBtn) {
        deleteProfileBtn.addEventListener('click', async () => {
            if (!currentProfile) {
                showError('No profile selected to delete');
                return;
            }
            
            const confirmDelete = confirm(`Are you sure you want to delete profile "${currentProfile.name}"?\n\nThis action cannot be undone.`);
            if (confirmDelete) {
                try {
                    // Delete the profile file
                    await window.electronAPI.deleteXmlProfile(currentProfile.filename || currentProfile.id);
                    
                    // Refresh the profile list
                    await loadAvailableProfiles();
                    await loadCurrentProfile(); // Load a new current profile
                    showSuccess(`Profile "${currentProfile.name}" deleted successfully`);
                } catch (error) {
                    console.error('Error deleting profile:', error);
                    showError('Failed to delete profile');
                }
            }
        });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadAvailableProfiles();
            await loadCurrentProfile();
            await loadAllConfiguration();
            showSuccess('Configuration refreshed');
        });
    }
    
    // Main table buttons
    const refreshToolsBtn = document.getElementById('refreshToolsBtn');
    if (refreshToolsBtn) {
        refreshToolsBtn.addEventListener('click', async () => {
            showToolsStatus('Refreshing tools...', 'info');
            try {
                await loadTools();
                showToolsStatus('✅ Tools refreshed successfully!', 'success');
            } catch (error) {
                showToolsStatus('❌ Error refreshing tools', 'error');
            }
        });
    }
    
    const addNewToolBtn = document.getElementById('addNewToolBtn');
    if (addNewToolBtn) {
        addNewToolBtn.addEventListener('click', addNewMainTool);
    }
    
    const saveToolsBtn = document.getElementById('saveToolsBtn');
    if (saveToolsBtn) {
        saveToolsBtn.addEventListener('click', saveMainTools);
    }
    
    // Cutting priority controls
    const addToPriority = document.getElementById('addToPriority');
    if (addToPriority) {
        addToPriority.addEventListener('click', addSelectedItemsToPriority);
    }
    
    const removeFromPriority = document.getElementById('removeFromPriority');
    if (removeFromPriority) {
        removeFromPriority.addEventListener('click', removeSelectedItemsFromPriority);
    }
    
    const insertBreak = document.getElementById('insertBreak');
    if (insertBreak) {
        insertBreak.addEventListener('click', addBreakToPriority);
    }
    
    // Add move up/down buttons for priority order
    const moveUpBtn = document.getElementById('moveUpBtn');
    if (moveUpBtn) {
        moveUpBtn.addEventListener('click', moveSelectedItemsUp);
    }
    
    const moveDownBtn = document.getElementById('moveDownBtn');
    if (moveDownBtn) {
        moveDownBtn.addEventListener('click', moveSelectedItemsDown);
    }
    
    const savePriorityBtn = document.getElementById('savePriorityBtn');
    if (savePriorityBtn) {
        savePriorityBtn.addEventListener('click', savePriorityConfiguration);
    }
    
    const resetOrderBtn = document.getElementById('resetOrderBtn');
    if (resetOrderBtn) {
        resetOrderBtn.addEventListener('click', resetPriorityOrder);
    }
    
    // Line type mapping controls
    const addLineTypeBtn = document.getElementById('addLineTypeBtn');
    if (addLineTypeBtn) {
        addLineTypeBtn.addEventListener('click', () => {
            showInfo('Add line type functionality coming soon');
        });
    }
    
    const autoMapBtn = document.getElementById('autoMapBtn');
    if (autoMapBtn) {
        autoMapBtn.addEventListener('click', () => {
            showInfo('Auto map functionality coming soon');
        });
    }
    
    const clearMappingsBtn = document.getElementById('clearMappingsBtn');
    if (clearMappingsBtn) {
        clearMappingsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all line type mappings?')) {
                currentMappings = [];
                displayLineTypeMappings();
                showSuccess('All mappings cleared');
            }
        });
    }
    
    // File output controls
    const browsePathBtn = document.getElementById('browsePathBtn');
    if (browsePathBtn) {
        browsePathBtn.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.showDirectoryDialog();
                if (result && result.filePaths && result.filePaths.length > 0) {
                    const defaultSavePath = document.getElementById('defaultSavePath');
                    if (defaultSavePath) {
                        defaultSavePath.value = result.filePaths[0];
                    }
                }
            } catch (error) {
                console.error('Error browsing for path:', error);
                showError('Failed to browse for path');
            }
        });
    }
    
    const clearPathBtn = document.getElementById('clearPathBtn');
    if (clearPathBtn) {
        clearPathBtn.addEventListener('click', () => {
            const defaultSavePath = document.getElementById('defaultSavePath');
            if (defaultSavePath) {
                defaultSavePath.value = '';
            }
        });
    }
    
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            
            // Remove active class from all buttons and content
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            e.target.classList.add('active');
            const targetContent = document.getElementById(targetTab + 'Tab');
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
    
    // Real-time preview updates
    const headerTemplate = document.getElementById('headerTemplate');
    if (headerTemplate) {
        headerTemplate.addEventListener('input', updateHeaderPreview);
    }
    
    const initialCommands = document.getElementById('initialCommands');
    if (initialCommands) {
        initialCommands.addEventListener('input', updateHeaderPreview);
    }
}

function showSuccess(message) {
    console.log('Success:', message);
    // You could add a more sophisticated notification system here
}

function showError(message) {
    console.error('Error:', message);
    // You could add a more sophisticated notification system here
}

function showInfo(message) {
    console.log('Info:', message);
    // You could add a more sophisticated notification system here
}

// Tools tab specific status message functions
function showToolsStatus(message, type = 'info') {
    const statusElement = document.getElementById('toolsStatusMessage');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        statusElement.style.display = 'block';
        
        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }
    }
}

function hideToolsStatus() {
    const statusElement = document.getElementById('toolsStatusMessage');
    if (statusElement) {
        statusElement.style.display = 'none';
    }
}

// Export functions for potential use by other modules
window.outputManager = {
    loadAvailableProfiles,
    loadCurrentProfile,
    loadProfileConfiguration,
    populateConfigurationFields,
    saveOutputUnitsToProfile,
    loadTools,
    loadLineTypeMappings,
    loadCuttingPriority,
    loadHeaderFooterConfig,
    loadOutputSettings
};
