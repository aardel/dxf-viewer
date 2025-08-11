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
        
        // Initialize DIN File Structure preview after a short delay to ensure DOM is ready
        setTimeout(async () => {
            await initializeStructureInterface();
        }, 500);
        
        // Also ensure structure is loaded when page becomes visible (for better reliability)
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden && (headerElements.length === 0 || footerElements.length === 0)) {
                console.log('Page became visible, ensuring structure is initialized...');
                await initializeStructureInterface();
            }
        });
        
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
        // First try to load the saved active profile
        const savedProfile = await loadActiveProfile();
        let currentProfileName = null;
        
        if (savedProfile) {
            currentProfileName = savedProfile.filename || savedProfile.name;
            console.log('Loaded saved active profile:', currentProfileName);
        } else {
            // Try to get the current profile from the main application's dropdown
            const mainProfileSelect = document.querySelector('#postprocessorProfile');
            
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
                
                // Save the active profile for persistence
                await saveActiveProfile(profile);
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
                    
                    // Save the active profile for persistence
                    await saveActiveProfile(currentProfile);
                }
            }
        }
    } catch (error) {
        console.error('Error loading current profile:', error);
        showError('Failed to load current profile');
    }
}

// Save active profile to localStorage for persistence
async function saveActiveProfile(profile) {
    try {
        const profileData = {
            filename: profile.filename,
            name: profile.name,
            id: profile.id,
            timestamp: Date.now()
        };
        localStorage.setItem('outputManager_activeProfile', JSON.stringify(profileData));
        console.log('Saved active profile:', profile.name);
    } catch (error) {
        console.error('Error saving active profile:', error);
    }
}

// Load active profile from localStorage
async function loadActiveProfile() {
    try {
        const savedData = localStorage.getItem('outputManager_activeProfile');
        if (savedData) {
            const profileData = JSON.parse(savedData);
            console.log('Loaded saved profile data:', profileData);
            return profileData;
        }
        return null;
    } catch (error) {
        console.error('Error loading active profile:', error);
        return null;
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
    
    // Load optimization settings
    loadOptimizationSettings(config);
}

function loadOptimizationSettings(config) {
    // Load optimization strategy
    const optimizationStrategy = document.getElementById('optimizationStrategy');
    if (optimizationStrategy && config.optimization?.primaryStrategy) {
        optimizationStrategy.value = config.optimization.primaryStrategy;
    }
    
    // Load path optimization
    const pathOptimization = document.getElementById('pathOptimization');
    if (pathOptimization && config.optimization?.withinGroupOptimization) {
        pathOptimization.value = config.optimization.withinGroupOptimization;
    }
    
    // Load optimization checkboxes
    const enableBridges = document.getElementById('enableBridges');
    if (enableBridges) {
        enableBridges.checked = config.optimization?.enableBridges !== false;
    }
    
    const validateWidths = document.getElementById('validateWidths');
    if (validateWidths) {
        validateWidths.checked = config.optimization?.validateWidths !== false;
    }
    
    const rotaryOutput = document.getElementById('rotaryOutput');
    if (rotaryOutput) {
        rotaryOutput.checked = config.optimization?.rotaryOutput !== false;
    }
}

async function saveOptimizationSettings() {
    if (!currentProfile) return;
    
    try {
        const profileName = currentProfile.filename || currentProfile.id || currentProfile.name;
        const config = await window.electronAPI.loadPostprocessorConfig(profileName);
        
        if (!config) {
            console.warn('No existing config found for profile:', profileName);
            return;
        }
        
        // Update optimization settings
        if (!config.optimization) {
            config.optimization = {};
        }
        
        const optimizationStrategy = document.getElementById('optimizationStrategy');
        if (optimizationStrategy) {
            config.optimization.primaryStrategy = optimizationStrategy.value;
        }
        
        const pathOptimization = document.getElementById('pathOptimization');
        if (pathOptimization) {
            config.optimization.withinGroupOptimization = pathOptimization.value;
        }
        
        const enableBridges = document.getElementById('enableBridges');
        if (enableBridges) {
            config.optimization.enableBridges = enableBridges.checked;
        }
        
        const validateWidths = document.getElementById('validateWidths');
        if (validateWidths) {
            config.optimization.validateWidths = validateWidths.checked;
        }
        
        const rotaryOutput = document.getElementById('rotaryOutput');
        if (rotaryOutput) {
            config.optimization.rotaryOutput = rotaryOutput.checked;
        }
        
        // Save the updated config
        await window.electronAPI.savePostprocessorConfig(profileName, config);
        console.log('Optimization settings saved for profile:', profileName);
        
    } catch (error) {
        console.error('Error saving optimization settings:', error);
        showError('Failed to save optimization settings');
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
        
        // Also refresh line type mappings to ensure tool dropdowns are updated
        if (currentMappings && currentMappings.length > 0) {
            console.log('Refreshing line type mappings after tools loaded');
            displayLineTypeMappings();
        }
        
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
                    <button class="btn btn-secondary btn-small" onclick="duplicateMainTool(${index})" title="Duplicate this tool">Duplicate</button>
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

async function deleteMainTool(index) {
    try {
        if (index >= 0 && index < currentTools.length) {
            const toolToDelete = currentTools[index];
            const confirmDelete = confirm(`Are you sure you want to delete tool "${toolToDelete.name}" (${toolToDelete.id})?\n\nThis action cannot be undone.`);
            
            if (confirmDelete) {
                currentTools.splice(index, 1);
                populateMainToolsTable();
                showToolsStatus(`✅ Tool "${toolToDelete.name}" deleted successfully! Saving changes...`, 'success');
                
                // Automatically save the changes after deletion
                await saveMainTools();
                
                // Refresh line type mappings to update tool dropdowns
                try {
                    await loadLineTypeMappings();
                    console.log('Line type mappings refreshed after tool deletion');
                } catch (error) {
                    console.error('Error refreshing line type mappings after tool deletion:', error);
                }
            }
        } else {
            showToolsStatus('❌ Invalid tool index for deletion', 'error');
        }
    } catch (error) {
        console.error('Error deleting tool:', error);
        showToolsStatus('❌ Error deleting tool', 'error');
    }
}

async function duplicateMainTool(index) {
    try {
        if (index >= 0 && index < currentTools.length) {
            const toolToDuplicate = currentTools[index];
            
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
            
            // Create duplicated tool with new ID and H-Code
            const duplicatedTool = {
                id: `T${newId}`,
                name: `${toolToDuplicate.name} (Copy)`,
                description: toolToDuplicate.description,
                width: toolToDuplicate.width,
                hCode: `H${newHCode}`,
                type: toolToDuplicate.type
            };
            
            // Insert the duplicated tool right after the original tool
            currentTools.splice(index + 1, 0, duplicatedTool);
            
            // Refresh the table to show the new tool
            populateMainToolsTable();
            
            showToolsStatus(`✅ Tool "${toolToDuplicate.name}" duplicated successfully! New tool: ${duplicatedTool.name}`, 'success');
            
            // Automatically save the changes after duplication
            await saveMainTools();
            
            // Refresh line type mappings to update tool dropdowns
            try {
                await loadLineTypeMappings();
                console.log('Line type mappings refreshed after tool duplication');
            } catch (error) {
                console.error('Error refreshing line type mappings after tool duplication:', error);
            }
        } else {
            showToolsStatus('❌ Invalid tool index for duplication', 'error');
        }
    } catch (error) {
        console.error('Error duplicating tool:', error);
        showToolsStatus('❌ Error duplicating tool', 'error');
    }
}

async function addNewMainTool() {
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
        
        // Save tools to profile using existing method - use 'replace_all' to completely replace the tools
        const response = await window.electronAPI.saveMachineTools(currentTools, 'replace_all', currentProfile.filename);
        
        if (response && response.success) {
            showToolsStatus('✅ Tools saved successfully!', 'success');
            // No need to refresh the display since we're reading from it
            
            // Refresh line type mappings to update tool dropdowns with new tools
            try {
                await loadLineTypeMappings();
                console.log('Line type mappings refreshed after tool save');
            } catch (error) {
                console.error('Error refreshing line type mappings after tool save:', error);
            }
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
    console.log('Displaying line type mappings. currentTools length:', currentTools ? currentTools.length : 'undefined');
    console.log('Current mappings:', currentMappings);
    
    const tableBody = document.getElementById('lineTypeMappingTableBody');
    if (!tableBody) {
        console.error('Line type mapping table body not found');
        return;
    }
    
    tableBody.innerHTML = '';
    
    if (!Array.isArray(currentMappings) || currentMappings.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: #888; padding: 2rem;">
                    No line type mappings found in profile<br>
                    <small>Add mappings to begin</small>
                </td>
            </tr>
        `;
        return;
    }
    
    currentMappings.forEach((mapping, index) => {
        const row = createMappingTableRow(mapping, index);
        tableBody.appendChild(row);
    });
}

function createMappingTableRow(mapping, index) {
    const row = document.createElement('tr');
    row.dataset.lineType = mapping.lineTypeName;
    
    // Create tool dropdown options
    const toolOptions = createToolDropdownOptions(mapping.toolId);
    
    // Get operation type and line width
    const operationType = getOperationType(mapping.lineTypeName);
    const lineWidth = getLineWidth(mapping.lineTypeName);
    
    row.innerHTML = `
        <td>
            <div class="line-type-name">
                <div class="line-type-icon"></div>
                <div>
                    <div>${mapping.lineTypeName || 'Unknown'}</div>
                    <div class="line-type-details">
                        ${operationType}
                    </div>
                </div>
            </div>
        </td>
        <td class="arrow-column">→</td>
        <td>
            <select class="tool-selector" data-line-type="${mapping.lineTypeName}" onchange="updateMapping('${mapping.lineTypeName}', this.value)">
                <option value="">-- Select Tool --</option>
                ${toolOptions}
            </select>
        </td>
        <td class="actions-column">
            <button class="action-btn edit" onclick="editLineType('${mapping.lineTypeName}')" title="Edit Line Type">
                ✏️
            </button>
            <button class="action-btn delete" onclick="removeMapping('${mapping.lineTypeName}')" title="Remove Mapping">
                🗑️
            </button>
        </td>
    `;
    
    return row;
}

function createToolDropdownOptions(selectedToolId) {
    console.log('Creating tool dropdown options. currentTools:', currentTools);
    console.log('Selected tool ID:', selectedToolId);
    
    if (!Array.isArray(currentTools) || currentTools.length === 0) {
        console.warn('No tools available for dropdown');
        return '<option value="">No tools available</option>';
    }
    
    return currentTools.map(tool => {
        const selected = tool.id === selectedToolId ? 'selected' : '';
        const displayName = `${tool.id} (${tool.name || tool.description || 'No description'})`;
        console.log(`Tool option: ${tool.id} - ${tool.name} - ${tool.description} - Display: ${displayName}`);
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

function getLineWidth(lineTypeName) {
    if (lineTypeName && lineTypeName.includes('pt')) {
        const width = lineTypeName.split('pt')[0];
        return width || 1;
    }
    return 1;
}

// Global function for dropdown changes
window.updateMapping = function(lineTypeName, toolId) {
    console.log(`Updating mapping: ${lineTypeName} → ${toolId}`);
    
    // Update mappings array
    const existingIndex = currentMappings.findIndex(m => m.lineTypeName === lineTypeName);
    
    if (existingIndex !== -1) {
        if (toolId) {
            currentMappings[existingIndex].toolId = toolId;
        } else {
            currentMappings.splice(existingIndex, 1);
        }
    } else if (toolId) {
        currentMappings.push({
            lineTypeId: getLineTypeId(lineTypeName),
            lineTypeName: lineTypeName,
            toolId: toolId,
            description: `${lineTypeName} mapped to ${getToolName(toolId)}`
        });
    }
    
    const toolName = getToolDisplayName(toolId);
    if (toolId) {
        showSuccess(`✓ Mapped ${lineTypeName} to ${toolName}`);
    } else {
        showInfo(`- Removed tool assignment from ${lineTypeName}`);
    }
};

function getLineTypeId(lineTypeName) {
    // Convert line type name to ID if needed
    return lineTypeName;
}

function getToolName(toolId) {
    if (!toolId) return 'No tool assigned';
    const tool = currentTools.find(t => t.id === toolId);
    return tool ? tool.name : 'Unknown tool';
}

function getToolDisplayName(toolId) {
    if (!toolId) return 'No tool assigned';
    const tool = currentTools.find(t => t.id === toolId);
    return tool ? `${tool.id} (${tool.name || tool.description || 'No description'})` : 'Unknown tool';
}

function editLineType(lineTypeName) {
    // TODO: Implement line type editing
    showInfo(`Edit functionality for ${lineTypeName} - Coming soon`);
}

function removeMapping(lineTypeName) {
    if (confirm(`Remove tool mapping for "${lineTypeName}"?`)) {
        window.updateMapping(lineTypeName, '');
        showInfo(`Removed mapping for ${lineTypeName}`);
    }
}

async function saveLineTypeMappings() {
    try {
        showInfo('Saving mappings...');
        
        if (!currentProfile) {
            showError('No active profile selected');
            return;
        }
        
        const result = await window.electronAPI.saveLineTypeMappings(currentMappings, currentProfile.filename);
        
        if (result.success) {
            showSuccess(`✓ Saved ${currentMappings.length} mappings to ${currentProfile.name}`);
        } else {
            showError(`Error saving mappings: ${result.error}`);
        }
    } catch (error) {
        console.error('Error saving mappings:', error);
        showError('Failed to save mappings');
    }
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
            updateDinFileStructurePreview();
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
        footerPreview.textContent = `G99
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
            programEndCommand.value = 'G99';
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
                    
                    // Save the active profile for persistence
                    await saveActiveProfile(profile);
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
                            enableBridges: true,
                            validateWidths: false,
                            rotaryOutput: false
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
    const saveMappingsBtn = document.getElementById('saveMappingsBtn');
    if (saveMappingsBtn) {
        saveMappingsBtn.addEventListener('click', saveLineTypeMappings);
    }
    
    const reloadMappingsBtn = document.getElementById('reloadMappingsBtn');
    if (reloadMappingsBtn) {
        reloadMappingsBtn.addEventListener('click', async () => {
            try {
                // Reload tools first to get the latest data
                await loadTools();
                // Then reload line type mappings to update dropdowns
                await loadLineTypeMappings();
                showSuccess('Tools and mappings reloaded successfully');
            } catch (error) {
                console.error('Error reloading tools and mappings:', error);
                showError('Failed to reload tools and mappings');
            }
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
        button.addEventListener('click', async (e) => {
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
            
            // Refresh tool dropdowns when switching to Line Type Mapping tab
            if (targetTab === 'mapping') {
                console.log('Switching to Line Type Mapping tab - refreshing tool dropdowns...');
                try {
                    // Reload tools to get the latest data
                    await loadTools();
                    // Refresh the line type mappings display to update dropdowns
                    await loadLineTypeMappings();
                    console.log('Tool dropdowns refreshed successfully');
                } catch (error) {
                    console.error('Error refreshing tool dropdowns:', error);
                }
            }
            
            // Update preview when switching to DIN File Structure tab
            if (targetTab === 'header') {
                console.log('Switching to DIN File Structure tab - initializing structure interface...');
                setTimeout(async () => {
                    // Check if structure is initialized
                    if (headerElements.length === 0 && footerElements.length === 0) {
                        console.log('Structure not initialized, initializing now...');
                        await initializeStructureInterface();
                    } else {
                        console.log('Structure already initialized, updating preview...');
                        updateDinFileStructurePreview();
                    }
                }, 100);
            }
        });
    });
    
    // Real-time preview updates for DIN File Structure
    const dinFileStructureElements = [
        'enableLineNumbers', 'startNumber', 'increment', 'formatTemplate'
    ];
    
    dinFileStructureElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            // Remove any existing listeners to prevent duplicates
            element.removeEventListener('input', updateDinFileStructurePreview);
            element.removeEventListener('change', updateDinFileStructurePreview);
            
            // Add appropriate listener based on element type
            if (element.type === 'checkbox') {
                element.addEventListener('change', updateDinFileStructurePreview);
            } else {
                // Only use 'input' for text fields to avoid duplicate calls
                element.addEventListener('input', updateDinFileStructurePreview);
            }
        }
    });
    
    // Remove the problematic interval timer that was causing infinite loops
    // Preview will update based on user actions instead
    
    // Legacy header preview updates (for backward compatibility)
    const headerTemplate = document.getElementById('headerTemplate');
    if (headerTemplate) {
        headerTemplate.addEventListener('input', updateHeaderPreview);
    }
    
    const initialCommands = document.getElementById('initialCommands');
    if (initialCommands) {
        initialCommands.addEventListener('input', updateHeaderPreview);
    }
    
    // Optimization settings event listeners
    const optimizationStrategy = document.getElementById('optimizationStrategy');
    if (optimizationStrategy) {
        optimizationStrategy.addEventListener('change', saveOptimizationSettings);
    }
    
    const pathOptimization = document.getElementById('pathOptimization');
    if (pathOptimization) {
        pathOptimization.addEventListener('change', saveOptimizationSettings);
    }
    
    const enableBridges = document.getElementById('enableBridges');
    if (enableBridges) {
        enableBridges.addEventListener('change', saveOptimizationSettings);
    }
    
    const validateWidths = document.getElementById('validateWidths');
    if (validateWidths) {
        validateWidths.addEventListener('change', saveOptimizationSettings);
    }
    
    const rotaryOutput = document.getElementById('rotaryOutput');
    if (rotaryOutput) {
        rotaryOutput.addEventListener('change', saveOptimizationSettings);
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

// Debounce timer for preview updates
let previewUpdateTimer = null;

// Comprehensive live preview function for DIN File Structure
function updateDinFileStructurePreview() {
    // Clear any existing timer to debounce rapid calls
    if (previewUpdateTimer) {
        clearTimeout(previewUpdateTimer);
    }
    
    // Debounce the actual update to prevent excessive calls
    previewUpdateTimer = setTimeout(() => {
        updateDinFileStructurePreviewInternal();
    }, 100); // Wait 100ms before updating
}

function updateDinFileStructurePreviewInternal() {
    console.log('Updating DIN File Structure preview...');
    
    const headerPreview = document.getElementById('headerPreview');
    const footerPreview = document.getElementById('footerPreview');
    const headerStats = document.getElementById('headerStats');
    
    if (!headerPreview || !footerPreview || !headerStats) {
        console.warn('Preview elements not found');
        return;
    }
    
    // Get line number settings
    const enableLineNumbers = document.getElementById('enableLineNumbers')?.checked || false;
    const startNumber = parseInt(document.getElementById('startNumber')?.value) || 10;
    const increment = parseInt(document.getElementById('increment')?.value) || 1;
    const formatTemplate = document.getElementById('formatTemplate')?.value || 'N{number}';
    
    // Machine type is no longer needed - users can configure elements individually
    
    // Generate header preview from drag-and-drop elements
    let headerLines = [];
    let lineNumber = startNumber;
    
    // Flag to track when line numbering should start (only from setup-commands onwards)
    let shouldStartLineNumbers = false;
    
    // Helper function to add line with optional line number
    const addLine = (content, isCommand = false, forceLineNumbers = false) => {
        let line = content;
        if (enableLineNumbers && (shouldStartLineNumbers || forceLineNumbers)) {
            const lineNum = formatTemplate.replace('{number}', lineNumber.toString().padStart(4, '0'));
            line = `${lineNum} ${content}`;
            lineNumber += increment;
        }
        headerLines.push(line);
    };
    
    // Process header elements in order
    headerElements.forEach(element => {
        if (!element.enabled) return;
        
        const config = element.config || {};
        
        switch (element.type) {
            case 'program-start':
                addLine(config.marker || '%1');
                break;
                
            case 'file-info':
                const template = config.template || '{filename} / - size: {width} x {height} / {timestamp}';
                const mockTemplate = template
                    .replace('{filename}', 'example.dxf')
                    .replace('{width}', '100.0')
                    .replace('{height}', '50.0')
                    .replace('{timestamp}', new Date().toLocaleString())
                    .replace('{user}', 'Operator')
                    .replace('{material}', 'Steel');
                addLine(`{ ${mockTemplate} }`);
                break;
                
            case 'console-output':
                const consoleTemplate = config.template || 'G253 F="{filename} / - size: {width} x {height} / {timestamp}"';
                const mockConsoleTemplate = consoleTemplate
                    .replace('{filename}', 'example.dxf')
                    .replace('{width}', '100.0')
                    .replace('{height}', '50.0')
                    .replace('{timestamp}', new Date().toLocaleString());
                addLine(mockConsoleTemplate, true);
                break;
                
            case 'bounds':
                const boundsFormat = config.format || 'BOUNDS: X{minX} Y{minY} to X{maxX} Y{maxY}';
                const mockBounds = boundsFormat
                    .replace('{minX}', '0.0')
                    .replace('{minY}', '0.0')
                    .replace('{maxX}', '100.0')
                    .replace('{maxY}', '50.0');
                addLine(`{ ${mockBounds} }`);
                break;
                
            case 'operations':
                const opsFormat = config.format || 'OPERATIONS: {count}';
                const mockOps = opsFormat.replace('{count}', '25');
                addLine(`{ ${mockOps} }`);
                break;
                
            case 'scaling':
                if (config.commands) {
                    const scalingCommands = config.commands.split('\n').filter(cmd => cmd.trim());
                    scalingCommands.forEach(cmd => {
                        addLine(cmd.trim(), true);
                    });
                    if (config.comment) {
                        addLine(`{ ${config.comment} }`);
                    }
                }
                break;
                
            case 'setup-commands':
                // Start line numbering from setup-commands onwards
                shouldStartLineNumbers = true;
                const setupCommands = (config.commands || 'G90\nG60 X0').split('\n').filter(cmd => cmd.trim());
                setupCommands.forEach(cmd => {
                    addLine(cmd.trim(), true);
                });
                break;
                
            case 'home-command':
                addLine(config.command || 'G0 X0 Y0', true);
                break;
                
            case 'custom':
                if (config.content) {
                    const customLines = config.content.split('\n').filter(line => line.trim());
                    customLines.forEach(line => {
                        addLine(line.trim());
                    });
                }
                break;
        }
    });
    
    // Add separator
    addLine('{ BEGIN CUTTING OPERATIONS... }');
    
    // Generate footer preview from drag-and-drop elements
    let footerLines = [];
    let footerLineNumber = lineNumber;
    
    const addFooterLine = (content, isCommand = false) => {
        let line = content;
        if (enableLineNumbers) {
            const lineNum = formatTemplate.replace('{number}', footerLineNumber.toString().padStart(4, '0'));
            line = `${lineNum} ${content}`;
            footerLineNumber += increment;
        }
        footerLines.push(line);
    };
    
    addFooterLine('{ END CUTTING OPERATIONS');
    
    // Process footer elements in order
    footerElements.forEach(element => {
        if (!element.enabled) return;
        
        const config = element.config || {};
        
        switch (element.type) {
            case 'end-commands':
                const endCommands = (config.commands || 'G99').split('\n').filter(cmd => cmd.trim());
                endCommands.forEach(cmd => {
                    addFooterLine(cmd.trim(), true);
                });
                break;
                
            case 'custom':
                if (config.content) {
                    const customLines = config.content.split('\n').filter(line => line.trim());
                    customLines.forEach(line => {
                        addFooterLine(line.trim());
                    });
                }
                break;
        }
    });
    
    addFooterLine('{ End of Program }');
    
    // Update preview displays
    headerPreview.innerHTML = headerLines.map(line => {
        if (line.startsWith('{')) {
            return `<span style="color: #888; font-style: italic;">${line}</span>`;
        } else if (line.startsWith('G') || line.startsWith('M') || line.startsWith('%')) {
            return `<span style="color: #4a90e2; font-weight: bold;">${line}</span>`;
        } else {
            return `<span style="color: #fff;">${line}</span>`;
        }
    }).join('<br>');
    
    footerPreview.innerHTML = footerLines.map(line => {
        if (line.startsWith('{')) {
            return `<span style="color: #888; font-style: italic;">${line}</span>`;
        } else if (line.startsWith('G') || line.startsWith('M') || line.startsWith('%')) {
            return `<span style="color: #4a90e2; font-weight: bold;">${line}</span>`;
        } else {
            return `<span style="color: #fff;">${line}</span>`;
        }
    }).join('<br>');
    
    // Update statistics
    const totalLines = headerLines.length + footerLines.length;
    const commentLines = headerLines.filter(line => line.includes('{')).length + 
                        footerLines.filter(line => line.includes('{')).length;
    const commandLines = totalLines - commentLines;
    const estimatedSize = (headerLines.join('\n') + '\n' + footerLines.join('\n')).length;
    
    headerStats.innerHTML = `
        <div>Total Lines: <span style="color: #4a90e2;">${totalLines}</span></div>
        <div>Comment Lines: <span style="color: #888;">${commentLines}</span></div>
        <div>Command Lines: <span style="color: #4a90e2;">${commandLines}</span></div>
        <div>Estimated Size: <span style="color: #4a90e2;">${estimatedSize}</span> bytes</div>
    `;
    
    console.log('DIN File Structure preview updated successfully');
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

// DIN File Structure Elements Management
let headerElements = [];
let footerElements = [];
let draggedElement = null;

// Default element definitions
const defaultElements = {
    'program-start': {
        type: 'program-start',
        title: 'Program Start Marker',
        icon: '🚀',
        enabled: true,
        config: {
            marker: '%1'
        }
    },
    'file-info': {
        type: 'file-info',
        title: 'File Information',
        icon: '📄',
        enabled: true,
        config: {
            template: '{filename} / - size: {width} x {height} / {timestamp}'
        }
    },
    'bounds': {
        type: 'bounds',
        title: 'Drawing Bounds',
        icon: '📐',
        enabled: true,
        config: {
            format: 'BOUNDS: X{minX} Y{minY} to X{maxX} Y{maxY}'
        }
    },
    'operations': {
        type: 'operations',
        title: 'Operation Count',
        icon: '🔢',
        enabled: true,
        config: {
            format: 'OPERATIONS: {count}'
        }
    },
    'scaling': {
        type: 'scaling',
        title: 'Scaling Commands',
        icon: '⚖️',
        enabled: false,
        config: {
            commands: ':P2027=25.4/P674\nG75 X=P2027 Y=P2027',
            comment: 'Imperial scaling applied'
        }
    },
    'setup-commands': {
        type: 'setup-commands',
        title: 'Setup Commands',
        icon: '⚙️',
        enabled: true,
        config: {
            commands: 'G90\nG60 X0'
        }
    },
    'home-command': {
        type: 'home-command',
        title: 'Home Command',
        icon: '🏠',
        enabled: true,
        config: {
            command: 'G0 X0 Y0'
        }
    },
    'console-output': {
        type: 'console-output',
        title: 'Console Output',
        icon: '💻',
        enabled: true,
        config: {
            template: 'G253 F="{filename} / - size: {width} x {height} / {timestamp}"'
        }
    },
    'end-commands': {
        type: 'end-commands',
        title: 'End Commands',
        icon: '🏁',
        enabled: true,
        config: {
            commands: 'G99'
        }
    }
};

// Predefined element templates for quick selection
const predefinedTemplates = {
    'basic-header': {
        name: 'Basic Header',
        description: 'Simple header with file info and setup',
        elements: [
            { ...defaultElements['program-start'] },
            { ...defaultElements['file-info'] },
            { ...defaultElements['setup-commands'] },
            { ...defaultElements['home-command'] }
        ]
    },
    'detailed-header': {
        name: 'Detailed Header',
        description: 'Complete header with all information (includes scaling)',
        elements: [
            { ...defaultElements['file-info'] },
            { ...defaultElements['program-start'] },
            { ...defaultElements['scaling'] },
            { ...defaultElements['bounds'] },
            { ...defaultElements['operations'] },
            { ...defaultElements['console-output'] },
            { ...defaultElements['setup-commands'] },
            { ...defaultElements['home-command'] }
        ]
    },
    'imperial-header': {
        name: 'Imperial Header',
        description: 'Header with scaling for imperial machines',
        elements: [
            { ...defaultElements['file-info'] },
            { ...defaultElements['program-start'] },
            { ...defaultElements['scaling'] },
            { ...defaultElements['bounds'] },
            { ...defaultElements['operations'] },
            { ...defaultElements['console-output'] },
            { ...defaultElements['setup-commands'] },
            { ...defaultElements['home-command'] }
        ]
    },
    'minimal-header': {
        name: 'Minimal Header',
        description: 'Minimal header with just essentials',
        elements: [
            { ...defaultElements['program-start'] },
            { ...defaultElements['setup-commands'] }
        ]
    },
    'basic-footer': {
        name: 'Basic Footer',
        description: 'Simple footer with end command',
        elements: [
            { ...defaultElements['end-commands'] }
        ]
    },
    'detailed-footer': {
        name: 'Detailed Footer',
        description: 'Footer with additional information',
        elements: [
            {
                type: 'custom',
                title: 'End Comment',
                icon: '💬',
                enabled: true,
                config: {
                    content: '{ End of program - {filename}'
                }
            },
            { ...defaultElements['end-commands'] }
        ]
    }
};

// Initialize the drag-and-drop structure interface
async function initializeStructureInterface() {
    console.log('Initializing structure interface...');
    
    // Load saved structure or use defaults
    await loadStructureConfiguration();
    
    // Populate containers (this will also setup drag and drop)
    populateElementsContainers();
    
    // Set up add element button
    setupAddElementButton();
    
    // Initial preview update
    updateDinFileStructurePreview();
    
    // Set up placeholder copy functionality
    setupPlaceholderCopy();
    
    console.log('Structure interface initialized successfully');
}

// Load structure configuration from profile
async function loadStructureConfiguration() {
    try {
        if (!currentProfile) {
            console.log('No current profile, using default structure');
            initializeDefaultStructure();
            return;
        }
        
        const profileName = currentProfile.filename || currentProfile.id || currentProfile.name;
        const config = await window.electronAPI.loadPostprocessorConfig(profileName);
        
        if (config && config.structure && config.structure.header && config.structure.footer) {
            headerElements = config.structure.header;
            footerElements = config.structure.footer;
            console.log('Loaded saved structure configuration:', { 
                headerElements: headerElements.length, 
                footerElements: footerElements.length 
            });
        } else {
            console.log('No saved structure found, initializing default structure');
            initializeDefaultStructure();
            // Save the default structure for future use
            await saveStructureConfiguration();
        }
        
    } catch (error) {
        console.error('Error loading structure configuration:', error);
        console.log('Using default structure due to error');
        initializeDefaultStructure();
    }
}

// Initialize default structure
function initializeDefaultStructure() {
    headerElements = [
        { ...defaultElements['program-start'] },
        { ...defaultElements['file-info'] },
        { ...defaultElements['bounds'] },
        { ...defaultElements['operations'] },
        { ...defaultElements['setup-commands'] },
        { ...defaultElements['home-command'] }
    ];
    footerElements = [
        { ...defaultElements['end-commands'] }
    ];
    
    console.log('Default structure initialized:', { 
        headerElements: headerElements.length, 
        footerElements: footerElements.length 
    });
}

// Save structure configuration to profile
async function saveStructureConfiguration() {
    try {
        if (!currentProfile) return;
        
        const profileName = currentProfile.filename || currentProfile.id || currentProfile.name;
        const config = await window.electronAPI.loadPostprocessorConfig(profileName) || {};
        
        config.structure = {
            header: headerElements,
            footer: footerElements
        };
        
        await window.electronAPI.savePostprocessorConfig(profileName, config);
        console.log('Structure configuration saved');
        
    } catch (error) {
        console.error('Error saving structure configuration:', error);
        showError('Failed to save structure configuration');
    }
}

// Populate the elements containers
function populateElementsContainers() {
    console.log('Populating elements containers...');
    const headerContainer = document.getElementById('headerElementsContainer');
    const footerContainer = document.getElementById('footerElementsContainer');
    
    if (!headerContainer || !footerContainer) {
        console.error('Elements containers not found');
        return;
    }
    
    // Clear containers
    headerContainer.innerHTML = '';
    footerContainer.innerHTML = '';
    
    // Add header elements
    headerElements.forEach((element, index) => {
        const elementFrame = createElementFrame(element, 'header', index);
        headerContainer.appendChild(elementFrame);
    });
    
    // Add footer elements
    footerElements.forEach((element, index) => {
        const elementFrame = createElementFrame(element, 'footer', index);
        footerContainer.appendChild(elementFrame);
    });
    
    console.log(`Added ${headerElements.length} header elements and ${footerElements.length} footer elements`);
    
    // Re-setup drag and drop after repopulating
    setupDragAndDrop();
}

// Create an element frame
function createElementFrame(element, container, index) {
    const frame = document.createElement('div');
    frame.className = 'element-frame';
    frame.setAttribute('data-type', element.type);
    frame.setAttribute('data-index', index);
    frame.setAttribute('data-container', container);
    
    const isExpanded = element.expanded || false;
    if (isExpanded) frame.classList.add('expanded');
    
    frame.innerHTML = `
        <div class="element-header">
            <div class="element-title" onclick="toggleElementExpansion(this.parentElement.parentElement)">
                <span class="element-icon">${element.icon}</span>
                <span>${element.title}</span>
            </div>
            <div class="element-controls">
                <div class="element-toggle">
                    <input type="checkbox" id="toggle_${container}_${index}" 
                           ${element.enabled ? 'checked' : ''} 
                           onchange="toggleElement('${container}', ${index}, this.checked)">
                    <label for="toggle_${container}_${index}">Enabled</label>
                </div>
                <span class="drag-handle" draggable="true" title="Drag to reorder"></span>
                <button class="element-delete" onclick="deleteElement('${container}', ${index})" title="Delete element">×</button>
            </div>
        </div>
        <div class="element-content">
            ${generateElementConfig(element, container, index)}
            <div class="element-preview" id="preview_${container}_${index}">
                ${generateElementPreview(element)}
            </div>
        </div>
    `;
    
    // Add event listeners to the drag handle (clean approach like test file)
    const dragHandle = frame.querySelector('.drag-handle');
    dragHandle.addEventListener('dragstart', (e) => handleDragStart(e, container, index));
    dragHandle.addEventListener('dragend', handleDragEnd);
    
    return frame;
}

// Generate element configuration HTML
function generateElementConfig(element, container, index) {
    const config = element.config || {};
    
    switch (element.type) {
        case 'program-start':
            return `
                <div class="element-config">
                    <label>Program Start Marker:</label>
                    <input type="text" value="${config.marker || '%1'}" 
                           onchange="updateElementConfig('${container}', ${index}, 'marker', this.value)">
                    <small>Marker that indicates the start of the program</small>
                </div>
            `;
            
        case 'file-info':
            return `
                <div class="element-config">
                    <label>File Information Template:</label>
                    <input type="text" value="${config.template || '{filename} / - size: {width} x {height} / {timestamp}'}" 
                           onchange="updateElementConfig('${container}', ${index}, 'template', this.value)">
                    <small>Variables: {filename}, {width}, {height}, {timestamp}, {user}, {material}</small>
                </div>
            `;
            
        case 'console-output':
            return `
                <div class="element-config">
                    <label>Console Output Template:</label>
                    <input type="text" value="${config.template || 'G253 F="{filename} / - size: {width} x {height} / {timestamp}"'}" 
                           onchange="updateElementConfig('${container}', ${index}, 'template', this.value)">
                    <small>Variables: {filename}, {width}, {height}, {timestamp}</small>
                </div>
            `;
            
        case 'bounds':
            return `
                <div class="element-config">
                    <label>Bounds Format:</label>
                    <input type="text" value="${config.format || 'BOUNDS: X{minX} Y{minY} to X{maxX} Y{maxY}'}" 
                           onchange="updateElementConfig('${container}', ${index}, 'format', this.value)">
                    <small>Format for displaying drawing bounds</small>
                </div>
            `;
            
        case 'operations':
            return `
                <div class="element-config">
                    <label>Operations Format:</label>
                    <input type="text" value="${config.format || 'OPERATIONS: {count}'}" 
                           onchange="updateElementConfig('${container}', ${index}, 'format', this.value)">
                    <small>Format for displaying operation count</small>
                </div>
            `;
            
        case 'scaling':
            return `
                <div class="element-config">
                    <label>Scaling Commands:</label>
                    <textarea rows="3" onchange="updateElementConfig('${container}', ${index}, 'commands', this.value)">${config.commands || ':P2027=25.4/P674\nG75 X=P2027 Y=P2027'}</textarea>
                    <small>Imperial scaling commands (one per line)</small>
                </div>
                <div class="element-config">
                    <label>Scaling Comment:</label>
                    <input type="text" value="${config.comment || 'Imperial scaling applied'}" 
                           onchange="updateElementConfig('${container}', ${index}, 'comment', this.value)">
                    <small>Comment to display after scaling commands</small>
                </div>
            `;
            
        case 'setup-commands':
            return `
                <div class="element-config">
                    <label>Setup Commands:</label>
                    <textarea rows="3" onchange="updateElementConfig('${container}', ${index}, 'commands', this.value)">${config.commands || 'G90\nG60 X0'}</textarea>
                    <small>Initial setup commands (one per line)</small>
                </div>
            `;
            
        case 'home-command':
            return `
                <div class="element-config">
                    <label>Home Command:</label>
                    <input type="text" value="${config.command || 'G0 X0 Y0'}" 
                           onchange="updateElementConfig('${container}', ${index}, 'command', this.value)">
                    <small>Command to move to home position</small>
                </div>
            `;
            
        case 'end-commands':
            return `
                <div class="element-config">
                    <label>End Commands:</label>
                    <textarea rows="3" onchange="updateElementConfig('${container}', ${index}, 'commands', this.value)">${config.commands || 'G99'}</textarea>
                    <small>Program end commands (one per line)</small>
                </div>
            `;
            
        case 'custom':
            return `
                <div class="element-config">
                    <label>Custom Content:</label>
                    <textarea rows="3" onchange="updateElementConfig('${container}', ${index}, 'content', this.value)">${config.content || ''}</textarea>
                    <small>Custom text or commands</small>
                </div>
            `;
            
        default:
            return '<div class="element-config">No configuration available for this element type.</div>';
    }
}

// Generate element preview
function generateElementPreview(element) {
    if (!element.enabled) return '<span class="comment">Element disabled</span>';
    
    const config = element.config || {};
    
    switch (element.type) {
        case 'program-start':
            return `<span class="command">${config.marker || '%1'}</span>`;
            
        case 'file-info':
            const template = config.template || '{filename} / - size: {width} x {height} / {timestamp}';
            const mockTemplate = template
                .replace('{filename}', 'example.dxf')
                .replace('{width}', '100.0')
                .replace('{height}', '50.0')
                .replace('{timestamp}', new Date().toLocaleString());
            return `<span class="comment">{ ${mockTemplate} }</span>`;
            
        case 'console-output':
            const consoleTemplate = config.template || 'G253 F="{filename} / - size: {width} x {height} / {timestamp}"';
            const mockConsoleTemplate = consoleTemplate
                .replace('{filename}', 'example.dxf')
                .replace('{width}', '100.0')
                .replace('{height}', '50.0')
                .replace('{timestamp}', new Date().toLocaleString());
            return `<span class="command">${mockConsoleTemplate}</span>`;
            
        case 'bounds':
            const boundsFormat = config.format || 'BOUNDS: X{minX} Y{minY} to X{maxX} Y{maxY}';
            const mockBounds = boundsFormat
                .replace('{minX}', '0.0')
                .replace('{minY}', '0.0')
                .replace('{maxX}', '100.0')
                .replace('{maxY}', '50.0');
            return `<span class="comment">{ ${mockBounds} }</span>`;
            
        case 'operations':
            const opsFormat = config.format || 'OPERATIONS: {count}';
            const mockOps = opsFormat.replace('{count}', '25');
            return `<span class="comment">{ ${mockOps} }</span>`;
            
        case 'scaling':
            let scalingPreview = '';
            if (config.commands) {
                const scalingCommands = config.commands.split('\n').filter(cmd => cmd.trim());
                scalingPreview += scalingCommands.map(cmd => `<span class="command">${cmd.trim()}</span>`).join('<br>');
            }
            if (config.comment) {
                if (config.commands) scalingPreview += '<br>';
                scalingPreview += `<span class="comment">{ ${config.comment} }</span>`;
            }
            return scalingPreview;
            
        case 'setup-commands':
            const setupCommands = (config.commands || 'G90\nG60 X0').split('\n').filter(cmd => cmd.trim());
            return setupCommands.map(cmd => `<span class="command">${cmd.trim()}</span>`).join('<br>');
            
        case 'home-command':
            return `<span class="command">${config.command || 'G0 X0 Y0'}</span>`;
            
        case 'end-commands':
            const endCommands = (config.commands || 'G99').split('\n').filter(cmd => cmd.trim());
            return endCommands.map(cmd => `<span class="command">${cmd.trim()}</span>`).join('<br>');
            
        case 'custom':
            if (!config.content) return '<span class="comment">No content</span>';
            const customLines = config.content.split('\n').filter(line => line.trim());
            return customLines.map(line => `<span class="command">${line.trim()}</span>`).join('<br>');
            
        default:
            return '<span class="comment">Preview not available</span>';
    }
}

// Element management functions
function toggleElementExpansion(frame) {
    frame.classList.toggle('expanded');
    const element = frame.querySelector('.element-icon');
    if (frame.classList.contains('expanded')) {
        element.style.transform = 'rotate(90deg)';
    } else {
        element.style.transform = 'rotate(0deg)';
    }
}

function toggleElement(container, index, enabled) {
    const elements = container === 'header' ? headerElements : footerElements;
    if (elements[index]) {
        elements[index].enabled = enabled;
        updateElementPreview(container, index);
        updateDinFileStructurePreview();
        saveStructureConfiguration();
    }
}

function updateElementConfig(container, index, key, value) {
    const elements = container === 'header' ? headerElements : footerElements;
    if (elements[index] && elements[index].config) {
        elements[index].config[key] = value;
        updateElementPreview(container, index);
        updateDinFileStructurePreview();
        saveStructureConfiguration();
    }
}

function updateElementPreview(container, index) {
    const previewElement = document.getElementById(`preview_${container}_${index}`);
    if (previewElement) {
        const elements = container === 'header' ? headerElements : footerElements;
        const element = elements[index];
        if (element) {
            previewElement.innerHTML = generateElementPreview(element);
        }
    }
}

function deleteElement(container, index) {
    const elements = container === 'header' ? headerElements : footerElements;
    const element = elements[index];
    
    if (!element) {
        console.warn('Element not found for deletion');
        return;
    }
    
    const confirmMessage = `Are you sure you want to delete "${element.title}"?\n\nThis will remove it from your DIN file structure.`;
    
    if (confirm(confirmMessage)) {
        elements.splice(index, 1);
        populateElementsContainers();
        updateDinFileStructurePreview();
        saveStructureConfiguration();
        
        console.log(`Deleted element: ${element.title} from ${container}`);
    }
}

// Drag and drop functionality
function setupDragAndDrop() {
    console.log('Setting up drag and drop...');
    const containers = ['headerElementsContainer', 'footerElementsContainer'];
    
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return;
        }
        
        // Remove existing event listeners to prevent duplicates
        container.removeEventListener('dragover', handleDragOver);
        container.removeEventListener('drop', handleDrop);
        container.removeEventListener('dragenter', handleDragEnter);
        container.removeEventListener('dragleave', handleDragLeave);
        
        // Add new event listeners
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);
        container.addEventListener('dragenter', handleDragEnter);
        container.addEventListener('dragleave', handleDragLeave);
        
        console.log(`Drag and drop setup for ${containerId}`);
    });
}

function handleDragStart(event, container, index) {
    console.log('🚀 Drag started for:', { container, index });
    draggedElement = { container, index };
    
    const frame = event.target.closest('.element-frame');
    if (frame) {
        frame.classList.add('dragging');
    }
    
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `${container}:${index}`);
}

function handleDragEnd(event) {
    console.log('🏁 Drag ended');
    const frame = event.target.closest('.element-frame');
    if (frame) {
        frame.classList.remove('dragging');
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    const container = event.currentTarget;
    const frames = Array.from(container.querySelectorAll('.element-frame:not(.dragging)'));
    
    // Clear all drop indicators
    frames.forEach(frame => {
        frame.classList.remove('drop-above', 'drop-below');
    });
    
    if (frames.length > 0 && draggedElement) {
        const dropIndex = calculateDropIndex(event.clientY, frames);
        
        if (dropIndex === 0 && frames[0]) {
            frames[0].classList.add('drop-above');
        } else if (dropIndex === frames.length && frames[frames.length - 1]) {
            frames[frames.length - 1].classList.add('drop-below');
        } else if (dropIndex > 0 && frames[dropIndex - 1]) {
            frames[dropIndex - 1].classList.add('drop-below');
        }
    }
}

function handleDragEnter(event) {
    event.preventDefault();
    const container = event.currentTarget;
    container.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    const container = event.currentTarget;
    if (!container.contains(event.relatedTarget)) {
        container.classList.remove('drag-over');
        
        // Clean up drop indicators
        const frames = container.querySelectorAll('.element-frame');
        frames.forEach(frame => frame.classList.remove('drop-above', 'drop-below'));
    }
}

function handleDrop(event) {
    console.log('💧 Drop event triggered');
    event.preventDefault();
    
    const container = event.currentTarget;
    container.classList.remove('drag-over');
    
    // Clean up drop indicators
    const frames = container.querySelectorAll('.element-frame');
    frames.forEach(frame => frame.classList.remove('drop-above', 'drop-below', 'dragging'));
    
    if (!draggedElement) {
        console.log('❌ No dragged element found');
        return;
    }
    
    const sourceContainer = draggedElement.container;
    const sourceIndex = draggedElement.index;
    const targetContainer = container.id === 'headerElementsContainer' ? 'header' : 'footer';
    
    // Calculate target index based on drop position
    const nonDraggingFrames = Array.from(container.querySelectorAll('.element-frame:not(.dragging)'));
    const targetIndex = calculateDropIndex(event.clientY, nonDraggingFrames);
    
    console.log('🔄 Moving element from', { sourceContainer, sourceIndex }, 'to', { targetContainer, targetIndex });
    
    // Move element
    moveElement(sourceContainer, sourceIndex, targetContainer, targetIndex);
    
    // Clean up
    draggedElement = null;
}

function calculateDropIndex(clientY, frames) {
    if (frames.length === 0) {
        return 0;
    }
    
    for (let i = 0; i < frames.length; i++) {
        const rect = frames[i].getBoundingClientRect();
        const middle = rect.top + rect.height / 2;
        
        if (clientY < middle) {
            return i;
        }
    }
    
    return frames.length;
}

function moveElement(sourceContainer, sourceIndex, targetContainer, targetIndex) {
    const sourceElements = sourceContainer === 'header' ? headerElements : footerElements;
    const targetElements = targetContainer === 'header' ? headerElements : footerElements;
    
    console.log('📦 Before move - Source:', sourceElements.map(e => e.title), 'Target:', targetElements.map(e => e.title));
    
    if (sourceContainer === targetContainer) {
        // Move within same container
        const element = sourceElements.splice(sourceIndex, 1)[0];
        
        // Adjust target index if moving from before to after
        let adjustedTargetIndex = targetIndex;
        if (sourceIndex < targetIndex) {
            adjustedTargetIndex = targetIndex - 1;
        }
        
        targetElements.splice(adjustedTargetIndex, 0, element);
    } else {
        // Move between containers
        const element = sourceElements.splice(sourceIndex, 1)[0];
        targetElements.splice(targetIndex, 0, element);
    }
    
    console.log('✅ After move - Source:', sourceElements.map(e => e.title), 'Target:', targetElements.map(e => e.title));
    
    populateElementsContainers();
    updateDinFileStructurePreview();
    saveStructureConfiguration();
}

// Add custom element functionality
function setupAddElementButton() {
    const addBtn = document.getElementById('addElementBtn');
    if (addBtn) {
        addBtn.addEventListener('click', showAddElementDialog);
    }
    
    // Setup reset to default button
    const resetBtn = document.getElementById('resetToDefaultBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetToDefaultStructure);
    }
    
    // Setup placeholder copy functionality
    setupPlaceholderCopy();
}

function showAddElementDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.innerHTML = `
        <div class="modal-content" style="width: 600px; max-height: 80vh;">
            <div class="modal-header">
                <h3>Add Element</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="overflow-y: auto;">
                <div class="template-selector">
                    <h4 style="color: #4a90e2; margin-bottom: 0.5rem;">📋 Predefined Templates</h4>
                    <p style="color: #ccc; font-size: 0.9rem; margin-bottom: 1rem;">Select a predefined template or create a custom element:</p>
                    
                    <div class="template-grid">
                        <div class="template-option" onclick="selectTemplate('basic-header')">
                            <span class="template-icon">📄</span>
                            <div class="template-title">Basic Header</div>
                            <div class="template-description">Simple header with file info and setup</div>
                        </div>
                        <div class="template-option" onclick="selectTemplate('detailed-header')">
                            <span class="template-icon">📋</span>
                            <div class="template-title">Detailed Header</div>
                            <div class="template-description">Complete header with all information</div>
                        </div>
                        <div class="template-option" onclick="selectTemplate('imperial-header')">
                            <span class="template-icon">⚖️</span>
                            <div class="template-title">Imperial Header</div>
                            <div class="template-description">Header with scaling for imperial machines</div>
                        </div>
                        <div class="template-option" onclick="selectTemplate('minimal-header')">
                            <span class="template-icon">⚡</span>
                            <div class="template-title">Minimal Header</div>
                            <div class="template-description">Minimal header with just essentials</div>
                        </div>
                        <div class="template-option" onclick="selectTemplate('basic-footer')">
                            <span class="template-icon">🏁</span>
                            <div class="template-title">Basic Footer</div>
                            <div class="template-description">Simple footer with end command</div>
                        </div>
                        <div class="template-option" onclick="selectTemplate('detailed-footer')">
                            <span class="template-icon">💬</span>
                            <div class="template-title">Detailed Footer</div>
                            <div class="template-description">Footer with additional information</div>
                        </div>
                    </div>
                </div>
                
                <!-- Template Preview Section -->
                <div id="templatePreview" style="border-top: 1px solid #444; padding-top: 1rem; margin-top: 1rem; display: none;">
                    <h4 style="color: #4a90e2; margin-bottom: 0.5rem;">👁️ Template Preview</h4>
                    <p style="color: #ccc; font-size: 0.9rem; margin-bottom: 1rem;">This template will add the following elements:</p>
                    <div id="templatePreviewContent" style="background: #1a1a1a; border: 1px solid #444; border-radius: 6px; padding: 1rem; font-family: 'Courier New', monospace; font-size: 0.85rem; color: #ccc; max-height: 200px; overflow-y: auto;">
                        <!-- Preview content will be populated here -->
                    </div>
                </div>

                <div style="border-top: 1px solid #444; padding-top: 1rem; margin-top: 1rem;">
                    <h4 style="color: #4a90e2; margin-bottom: 0.5rem;">✏️ Custom Element</h4>
                    <div class="form-group">
                        <label>Element Title:</label>
                        <input type="text" id="customElementTitle" class="form-input" placeholder="My Custom Element">
                    </div>
                    <div class="form-group">
                        <label>Custom Content:</label>
                        <textarea id="customElementContent" class="form-input" rows="4" placeholder="Enter your custom text or commands..."></textarea>
                        <small style="color: #888;">Use placeholders like {filename}, {timestamp}, etc. See the reference below.</small>
                    </div>
                    <div class="form-group">
                        <label>Add to:</label>
                        <select id="customElementContainer" class="form-select">
                            <option value="header">Header</option>
                            <option value="footer">Footer</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="addCustomElement()">Add Element</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Clear any previous template selection when modal opens
    window.selectedTemplate = null;
}

function addCustomElement() {
    // Check if a template is selected
    if (window.selectedTemplate) {
        // Add template elements
        const template = window.selectedTemplate;
        
        // Determine if it's a header or footer template
        const isHeaderTemplate = template.name.toLowerCase().includes('header');
        const targetElements = isHeaderTemplate ? headerElements : footerElements;
        
        // Replace existing elements with template elements
        const newElements = template.elements.map(element => {
            const newElement = { ...element };
            newElement.enabled = true; // Ensure template elements are enabled
            return newElement;
        });
        
        // Clear existing elements and replace with template elements
        targetElements.length = 0; // Clear array
        targetElements.push(...newElements); // Add all template elements
        
        populateElementsContainers();
        updateDinFileStructurePreview();
        saveStructureConfiguration();
        
        // Close dialog
        document.querySelector('.modal').remove();
        showSuccess(`${template.name} template applied successfully (replaced existing ${isHeaderTemplate ? 'header' : 'footer'} elements)`);
        
        // Clear selected template
        window.selectedTemplate = null;
        return;
    }
    
    // Handle custom element
    const title = document.getElementById('customElementTitle').value.trim();
    const content = document.getElementById('customElementContent').value.trim();
    const container = document.getElementById('customElementContainer').value;
    
    if (!title || !content) {
        showError('Please provide both title and content for the custom element');
        return;
    }
    
    const customElement = {
        type: 'custom',
        title: title,
        icon: '📝',
        enabled: true,  // Make sure custom elements are enabled by default
        config: {
            content: content
        }
    };
    
    const elements = container === 'header' ? headerElements : footerElements;
    elements.push(customElement);
    
    populateElementsContainers();
    updateDinFileStructurePreview();
    saveStructureConfiguration();
    
    // Close dialog
    document.querySelector('.modal').remove();
    showSuccess('Custom element added successfully');
}

// Template selection functionality
function selectTemplate(templateKey) {
    const template = predefinedTemplates[templateKey];
    if (!template) {
        console.error('Template not found:', templateKey);
        return;
    }
    
    console.log('Selecting template:', templateKey, 'with elements:', template.elements.map(e => e.title));
    
    // Clear previous selections
    document.querySelectorAll('.template-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Select the clicked template
    const selectedOption = event.target.closest('.template-option');
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    // Store selected template for use when adding
    window.selectedTemplate = template;
    
    // Show template preview
    showTemplatePreview(template);
    
    console.log('Selected template:', template.name);
}

function showTemplatePreview(template) {
    const previewSection = document.getElementById('templatePreview');
    const previewContent = document.getElementById('templatePreviewContent');
    
    if (!previewSection || !previewContent) return;
    
    console.log('Showing preview for template:', template.name, 'with elements:', template.elements.map(e => e.title));
    
    // Show the preview section
    previewSection.style.display = 'block';
    
    // Generate preview content
    let previewHTML = '';
    
    // Show ALL elements from template in preview, regardless of enabled status
    const allElements = template.elements;
    
    console.log('All elements for preview:', allElements.map(e => e.title));
    
    allElements.forEach((element, index) => {
        // Add element title with icon
        previewHTML += `<div style="color: #4a90e2; font-weight: bold; margin-bottom: 0.5rem;">${element.icon} ${element.title}</div>`;
        
        // Generate element preview (ensure element is treated as enabled for preview)
        const previewElement = { ...element, enabled: true };
        const elementPreview = generateElementPreview(previewElement);
        previewHTML += `<div style="margin-left: 1rem; margin-bottom: 1rem;">${elementPreview}</div>`;
        
        // Add separator except for last element
        if (index < allElements.length - 1) {
            previewHTML += '<div style="border-bottom: 1px solid #444; margin: 1rem 0;"></div>';
        }
    });
    
    if (previewHTML === '') {
        previewHTML = '<div style="color: #888; font-style: italic;">This template has no enabled elements.</div>';
    }
    
    previewContent.innerHTML = previewHTML;
}

// Reset to default structure
function resetToDefaultStructure() {
    if (confirm('Are you sure you want to reset to the default structure? This will replace your current header and footer elements.')) {
        // Reset to default structure matching sample output order (includes scaling)
        const defaultHeaderElements = [
            { ...defaultElements['file-info'] },
            { ...defaultElements['program-start'] },
            { ...defaultElements['scaling'], enabled: true }, // Enable scaling by default to match sample
            { ...defaultElements['bounds'] },
            { ...defaultElements['operations'] },
            { ...defaultElements['console-output'] },
            { ...defaultElements['setup-commands'] },
            { ...defaultElements['home-command'] }
        ];
        
        // Reset to basic-footer template (simple and clean)
        const defaultFooterElements = [
            { ...defaultElements['end-commands'] }
        ];
        
        // Ensure all elements are enabled
        headerElements.length = 0; // Clear existing
        headerElements.push(...defaultHeaderElements.map(element => ({ ...element, enabled: true })));
        
        footerElements.length = 0; // Clear existing  
        footerElements.push(...defaultFooterElements.map(element => ({ ...element, enabled: true })));
        
        populateElementsContainers();
        updateDinFileStructurePreview();
        saveStructureConfiguration();
        
        showSuccess('Structure reset to default successfully (Detailed Header + Basic Footer)');
    }
}

// Setup placeholder copy functionality
function setupPlaceholderCopy() {
    // Add copy buttons to placeholder items
    document.querySelectorAll('.placeholder-item').forEach(item => {
        const codeElement = item.querySelector('code');
        if (codeElement) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-placeholder';
            copyBtn.textContent = 'Copy';
            copyBtn.onclick = () => copyPlaceholder(codeElement.textContent);
            item.appendChild(copyBtn);
        }
    });
}

// Copy placeholder to clipboard
function copyPlaceholder(placeholder) {
    navigator.clipboard.writeText(placeholder).then(() => {
        showSuccess(`Copied ${placeholder} to clipboard`);
    }).catch(err => {
        console.error('Failed to copy placeholder:', err);
        showError('Failed to copy placeholder');
    });
}
