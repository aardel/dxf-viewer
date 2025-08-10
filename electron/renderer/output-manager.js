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

// Edit Tools Modal Functions
function openEditToolsModal() {
    if (!currentTools || currentTools.length === 0) {
        showError('No tools to edit');
        return;
    }
    
    // Create a copy of tools for editing
    editingTools = JSON.parse(JSON.stringify(currentTools));
    populateToolsTable();
    document.getElementById('editToolsModal').style.display = 'flex';
}

function closeEditToolsModal() {
    document.getElementById('editToolsModal').style.display = 'none';
    editingTools = [];
}

function populateToolsTable() {
    const tbody = document.getElementById('toolsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    editingTools.forEach((tool, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" value="${tool.id || ''}" onchange="updateTool(${index}, 'id', this.value)"></td>
            <td><input type="text" value="${tool.name || ''}" onchange="updateTool(${index}, 'name', this.value)"></td>
            <td><input type="text" value="${tool.description || ''}" onchange="updateTool(${index}, 'description', this.value)"></td>
            <td><input type="number" value="${tool.width || 0}" step="0.1" onchange="updateTool(${index}, 'width', parseFloat(this.value))"></td>
            <td><input type="text" value="${tool.hCode || ''}" onchange="updateTool(${index}, 'hCode', this.value)"></td>
            <td><input type="text" value="${tool.type || 'cut'}" onchange="updateTool(${index}, 'type', this.value)"></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-danger btn-small" onclick="deleteTool(${index})">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateTool(index, field, value) {
    if (editingTools[index]) {
        editingTools[index][field] = value;
    }
}

function deleteTool(index) {
    if (confirm('Are you sure you want to delete this tool?')) {
        editingTools.splice(index, 1);
        populateToolsTable();
    }
}

function addNewTool() {
    const newTool = {
        id: 'T' + (editingTools.length + 1),
        name: 'New Tool',
        description: 'New tool description',
        width: 1,
        hCode: 'H' + (editingTools.length + 1),
        type: 'cut'
    };
    
    editingTools.push(newTool);
    populateToolsTable();
}

async function saveTools() {
    try {
        if (!currentProfile) {
            showError('No profile selected');
            return;
        }
        
        // Update currentTools with editingTools
        currentTools = JSON.parse(JSON.stringify(editingTools));
        
        // Save tools to profile using existing method
        const response = await window.electronAPI.saveMachineTools(currentTools, 'replace');
        
        if (response && response.success) {
            showSuccess('Tools saved successfully');
            closeEditToolsModal();
            displayTools(); // Refresh the display
        } else {
            showError('Failed to save tools');
        }
        
    } catch (error) {
        console.error('Error saving tools:', error);
        showError('Failed to save tools');
    }
}

// Add event listeners for modal
document.addEventListener('DOMContentLoaded', function() {
    // Modal confirm button
    document.getElementById('modalConfirmBtn').addEventListener('click', confirmModal);
    
    // Modal input enter key
    document.getElementById('modalInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            confirmModal();
        }
    });
    
    // Modal overlay click to close
    document.getElementById('modalOverlay').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
});

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
        
        // Save the units setting to the profile
        await window.electronAPI.savePostprocessorConfig(currentProfile.id || currentProfile.name, {
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
        displayTools();
        
    } catch (error) {
        console.error('Error loading tools:', error);
        currentTools = []; // Set empty array on error
        displayTools(); // Still try to display
        showError('Failed to load tools');
    }
}

function displayTools() {
    const toolGrid = document.getElementById('toolGrid');
    if (!toolGrid) {
        console.error('Tool grid element not found');
        return;
    }
    
    console.log('Displaying tools:', currentTools);
    console.log('Number of tools to display:', currentTools ? currentTools.length : 0);
    
    toolGrid.innerHTML = '';
    
    if (!Array.isArray(currentTools) || currentTools.length === 0) {
        console.warn('No tools to display - currentTools:', currentTools);
        toolGrid.innerHTML = '<div class="no-data">No tools found in profile</div>';
        return;
    }
    
    console.log('Creating tool cards for', currentTools.length, 'tools');
    
    currentTools.forEach((tool, index) => {
        console.log(`Creating tool card ${index + 1}:`, tool);
        const toolCard = document.createElement('div');
        toolCard.className = 'tool-card';
        toolCard.innerHTML = `
            <h6>${tool.id || 'Unknown'}</h6>
            <div><strong>${tool.name || 'Unnamed Tool'}</strong></div>
            <div>${tool.description || 'No description'}</div>
            <div>Width: ${tool.width || 0}mm</div>
            <div>H-Code: ${tool.hCode || 'N/A'}</div>
        `;
        toolGrid.appendChild(toolCard);
    });
    
    console.log('Tool grid now contains', toolGrid.children.length, 'tool cards');
}

async function loadLineTypeMappings() {
    try {
        if (!currentProfile) return;
        
        console.log('Loading line type mappings for profile:', currentProfile.id || currentProfile.name);
        const response = await window.electronAPI.getLineTypeMappingsFromProfile(currentProfile.id || currentProfile.name);
        
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
        
        console.log('Loading cutting priority for profile:', currentProfile.id || currentProfile.name);
        const response = await window.electronAPI.loadPriorityConfiguration(currentProfile.id || currentProfile.name);
        
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
        displayCuttingPriority();
        
    } catch (error) {
        console.error('Error loading cutting priority:', error);
        currentPriorityOrder = []; // Set empty array on error
        displayCuttingPriority(); // Still try to display
        showError('Failed to load cutting priority');
    }
}

function displayCuttingPriority() {
    const availableItems = document.getElementById('availableItems');
    const priorityOrder = document.getElementById('priorityOrder');
    
    if (!availableItems || !priorityOrder) return;
    
    availableItems.innerHTML = '';
    priorityOrder.innerHTML = '';
    
    // Display available tools (from currentTools)
    if (Array.isArray(currentTools) && currentTools.length > 0) {
        currentTools.forEach(tool => {
            const item = document.createElement('div');
            item.className = 'priority-item';
            item.innerHTML = `
                <span>${tool.id} - ${tool.name}</span>
                <span class="tool-width">${tool.width || 0}mm</span>
            `;
            availableItems.appendChild(item);
        });
    } else {
        availableItems.innerHTML = '<div class="no-data">No tools available</div>';
    }
    
    // Display priority order
    if (Array.isArray(currentPriorityOrder) && currentPriorityOrder.length > 0) {
        currentPriorityOrder.forEach((item, index) => {
            const priorityItem = document.createElement('div');
            priorityItem.className = 'priority-item';
            priorityItem.innerHTML = `
                <span class="priority-number">${index + 1}.</span>
                <span>${item.name || item.id || 'Unknown Item'}</span>
                <span class="tool-width">${item.width || 0}mm</span>
            `;
            priorityOrder.appendChild(priorityItem);
        });
    } else {
        priorityOrder.innerHTML = '<div class="no-data">No priority order set</div>';
    }
}

async function loadHeaderFooterConfig() {
    try {
        if (!currentProfile) return;
        
        const config = await window.electronAPI.loadPostprocessorConfig(currentProfile.id || currentProfile.name);
        
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
                    console.log('Switched to profile:', profile.name);
                } else {
                    console.warn('Selected profile not found:', selectedProfileId);
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
    
    // Tool refresh button
    const refreshToolsBtn = document.getElementById('refreshToolsBtn');
    if (refreshToolsBtn) {
        refreshToolsBtn.addEventListener('click', async () => {
            await loadTools();
            showSuccess('Tools refreshed');
        });
    }
    
    // Edit tools button
    const editToolsBtn = document.getElementById('editToolsBtn');
    if (editToolsBtn) {
        editToolsBtn.addEventListener('click', openEditToolsModal);
    }
    
    // Cutting priority controls
    const addToPriority = document.getElementById('addToPriority');
    if (addToPriority) {
        addToPriority.addEventListener('click', () => {
            // Add selected available item to priority order
            showInfo('Add to priority functionality coming soon');
        });
    }
    
    const removeFromPriority = document.getElementById('removeFromPriority');
    if (removeFromPriority) {
        removeFromPriority.addEventListener('click', () => {
            // Remove selected priority item
            showInfo('Remove from priority functionality coming soon');
        });
    }
    
    const insertBreak = document.getElementById('insertBreak');
    if (insertBreak) {
        insertBreak.addEventListener('click', () => {
            // Insert manual break in priority order
            showInfo('Insert break functionality coming soon');
        });
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
