// DOM elements
const addProfileBtn = document.getElementById('addProfileBtn');
const reloadBtn = document.getElementById('reloadBtn');
const profilesTableBody = document.getElementById('profilesTableBody');
const profileModal = document.getElementById('profileModal');
const modalClose = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalSave = document.getElementById('modalSave');
const modalTitle = document.getElementById('modalTitle');
const profileName = document.getElementById('profileName');
const profileDescription = document.getElementById('profileDescription');
const addRuleBtn = document.getElementById('addRuleBtn');
const rulesTableBody = document.getElementById('rulesTableBody');

// State
let profiles = [];
let currentProfile = null;
let isEditMode = false;
let currentRules = [];
let lineTypes = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadLineTypes();
    await loadProfiles();
    setupEventListeners();
});

// Load line types for dropdowns
async function loadLineTypes() {
    try {
        console.log('Loading line types...');
        const response = await window.electronAPI.loadLineTypes();
        
        if (response && response.success && response.data) {
            lineTypes = response.data;
            console.log('Line types loaded:', lineTypes.length, 'items');
            console.log('First few line types:', lineTypes.slice(0, 3));
        } else {
            console.error('Failed to load line types:', response?.error || 'Unknown error');
            lineTypes = [];
        }
    } catch (error) {
        console.error('Error loading line types:', error);
        lineTypes = [];
    }
}

// Load import filter profiles
async function loadProfiles() {
    try {
        const data = await window.electronAPI.loadImportFilters();
        profiles = data || [];
        renderProfiles();
    } catch (error) {
        console.error('Error loading import filters:', error);
        profiles = [];
        renderProfiles();
    }
}

// Render profiles table
function renderProfiles() {
    profilesTableBody.innerHTML = '';
    
    if (profiles.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="4" style="text-align: center; color: #666; padding: 2rem;">
                No import filter profiles found. Create one to get started.
            </td>
        `;
        profilesTableBody.appendChild(row);
        return;
    }
    
    profiles.forEach(profile => {
        const row = createProfileRow(profile);
        profilesTableBody.appendChild(row);
    });
}

// Create profile table row
function createProfileRow(profile) {
    const row = document.createElement('tr');
    const ruleCount = profile.rules ? profile.rules.length : 0;
    
    row.innerHTML = `
        <td><strong>${profile.name || 'Unnamed Profile'}</strong></td>
        <td>${profile.description || 'No description'}</td>
        <td><span class="mapping-count">${ruleCount} rules</span></td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-info btn-small" onclick="editProfile('${profile.id}')">
                    📝 Edit
                </button>
                <button class="btn btn-info btn-small" onclick="copyProfile('${profile.id}')">
                    📋 Copy
                </button>
                <button class="btn btn-danger btn-small" onclick="deleteProfile('${profile.id}')">
                    🗑️ Delete
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Event listeners
function setupEventListeners() {
    addProfileBtn.addEventListener('click', createNewProfile);
    reloadBtn.addEventListener('click', loadProfiles);
    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);
    modalSave.addEventListener('click', saveProfile);
    addRuleBtn.addEventListener('click', addMappingRule);
    
    // Modal keyboard events
    profileModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// Create new profile
function createNewProfile() {
    isEditMode = false;
    currentProfile = null;
    currentRules = [];
    
    modalTitle.textContent = 'Create New Import Filter Profile';
    profileName.value = '';
    profileDescription.value = '';
    
    // Ensure line types are loaded before showing modal
    loadLineTypes().then(() => {
        renderMappingRules();
        profileModal.classList.remove('hidden');
        profileName.focus();
    });
}

// Edit existing profile
function editProfile(profileId) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    isEditMode = true;
    currentProfile = profile;
    currentRules = [...(profile.rules || [])];
    
    modalTitle.textContent = 'Edit Import Filter Profile';
    profileName.value = profile.name || '';
    profileDescription.value = profile.description || '';
    
    // Ensure line types are loaded before showing modal
    loadLineTypes().then(() => {
        renderMappingRules();
        profileModal.classList.remove('hidden');
        profileName.focus();
    });
}

// Copy profile
function copyProfile(profileId) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    isEditMode = false;
    currentProfile = null;
    currentRules = [...(profile.rules || [])];
    
    modalTitle.textContent = 'Copy Import Filter Profile';
    profileName.value = `${profile.name} (Copy)`;
    profileDescription.value = profile.description || '';
    
    // Ensure line types are loaded before showing modal
    loadLineTypes().then(() => {
        renderMappingRules();
        profileModal.classList.remove('hidden');
        profileName.focus();
    });
}

// Delete profile
async function deleteProfile(profileId) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    if (confirm(`Are you sure you want to delete the profile "${profile.name}"?`)) {
        try {
            await window.electronAPI.deleteImportFilter(profileId);
            await loadProfiles();
            showStatus(`Deleted profile: ${profile.name}`);
        } catch (error) {
            console.error('Error deleting profile:', error);
            showStatus('Error deleting profile', 'error');
        }
    }
}

// Add mapping rule
function addMappingRule() {
    // Ensure lineTypes is loaded
    const safeLineTypes = Array.isArray(lineTypes) ? lineTypes : [];
    
    const rule = {
        id: Date.now(),
        layerName: '',
        color: '',
        lineTypeId: safeLineTypes.length > 0 ? safeLineTypes[0].id : ''
    };
    
    currentRules.push(rule);
    renderMappingRules();
}

// Remove mapping rule
function removeMappingRule(ruleId) {
    currentRules = currentRules.filter(rule => rule.id !== ruleId);
    renderMappingRules();
}

// Render mapping rules table
function renderMappingRules() {
    rulesTableBody.innerHTML = '';
    
    if (currentRules.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="4" style="text-align: center; color: #666; padding: 1rem;">
                No mapping rules defined. Click "Add Rule" to create one.
            </td>
        `;
        rulesTableBody.appendChild(row);
        return;
    }
    
    currentRules.forEach(rule => {
        const row = createMappingRuleRow(rule);
        rulesTableBody.appendChild(row);
    });
}

// Helper function to extract RGB values from color string
function parseRGBColor(colorStr) {
    if (!colorStr) return null;
    
    // Handle rgb(r,g,b) format
    const rgbMatch = colorStr.match(/rgb\((\d+),(\d+),(\d+)\)/);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1]),
            g: parseInt(rgbMatch[2]),
            b: parseInt(rgbMatch[3])
        };
    }
    
    // Handle r,g,b format
    const directMatch = colorStr.match(/^(\d+),(\d+),(\d+)$/);
    if (directMatch) {
        return {
            r: parseInt(directMatch[1]),
            g: parseInt(directMatch[2]),
            b: parseInt(directMatch[3])
        };
    }
    
    // Handle hex format
    if (colorStr.startsWith('#')) {
        const hex = colorStr.substring(1);
        if (hex.length === 6) {
            return {
                r: parseInt(hex.substring(0, 2), 16),
                g: parseInt(hex.substring(2, 4), 16),
                b: parseInt(hex.substring(4, 6), 16)
            };
        }
    }
    
    // Handle ACI numbers (AutoCAD Color Index)
    const aciNum = parseInt(colorStr);
    if (!isNaN(aciNum) && aciNum >= 0 && aciNum <= 255) {
        // Convert ACI to RGB using the same mapping as in renderer.js
        const aciToRGBMap = {
            1: { r: 255, g: 0, b: 0 },     // Red
            2: { r: 255, g: 255, b: 0 },   // Yellow
            3: { r: 0, g: 255, b: 0 },     // Green
            4: { r: 0, g: 255, b: 255 },   // Cyan
            5: { r: 0, g: 0, b: 255 },     // Blue
            6: { r: 255, g: 0, b: 255 },   // Magenta
            7: { r: 255, g: 255, b: 255 }, // White
            8: { r: 128, g: 128, b: 128 }, // Gray
            9: { r: 192, g: 192, b: 192 }, // Light Gray
            10: { r: 255, g: 128, b: 128 }, // Light Red
            11: { r: 255, g: 255, b: 128 }, // Light Yellow
            12: { r: 128, g: 255, b: 128 }, // Light Green
            13: { r: 128, g: 255, b: 255 }, // Light Cyan
            14: { r: 128, g: 128, b: 255 }, // Light Blue
            15: { r: 255, g: 128, b: 255 }, // Light Magenta
        };
        
        if (aciToRGBMap[aciNum]) {
            return aciToRGBMap[aciNum];
        } else {
            // For other ACI numbers, use a default mapping or generate a color
            return { r: 128, g: 128, b: 128 }; // Default to gray
        }
    }
    
    return null;
}

// Helper function to format color display
function formatColorDisplay(colorStr) {
    // Check if it's an ACI number first
    const aciNum = parseInt(colorStr);
    if (!isNaN(aciNum) && aciNum >= 0 && aciNum <= 255) {
        return aciNum.toString(); // Just show the number, not "ACI X"
    }
    
    const rgb = parseRGBColor(colorStr);
    if (rgb) {
        return `${rgb.r},${rgb.g},${rgb.b}`;
    }
    return colorStr || '';
}

// Helper function to get RGB CSS color from color string
function getRGBCSSColor(colorStr) {
    const rgb = parseRGBColor(colorStr);
    if (rgb) {
        return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    }
    return '#cccccc'; // Default gray
}

// Create mapping rule row
function createMappingRuleRow(rule) {
    console.log('Creating rule row, lineTypes available:', lineTypes.length);
    const row = document.createElement('tr');
    
    // Create line type options - ensure lineTypes is an array
    const safeLineTypes = Array.isArray(lineTypes) ? lineTypes : [];
    console.log('Safe line types:', safeLineTypes.length);
    const lineTypeOptions = safeLineTypes.map(lt => 
        `<option value="${lt.id}" ${rule.lineTypeId == lt.id ? 'selected' : ''}>${lt.name}</option>`
    ).join('');
    
    row.innerHTML = `
        <td>
            <input type="text" value="${rule.layerName || ''}" 
                   onchange="updateRule(${rule.id}, 'layerName', this.value)"
                   placeholder="Layer name or regex">
        </td>
        <td>
            <div class="color-input-container">
                <div class="color-square" style="background-color: ${rule.colorHex || getRGBCSSColor(rule.color)}"></div>
                <input type="text" value="${formatColorDisplay(rule.color)}" 
                       onchange="updateRuleColor(${rule.id}, this.value)"
                       placeholder="r,g,b (e.g., 255,0,0)">
            </div>
        </td>
        <td>
            <select onchange="updateRule(${rule.id}, 'lineTypeId', this.value)">
                <option value="">Select line type...</option>
                ${lineTypeOptions}
            </select>
        </td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-danger btn-small" onclick="removeMappingRule(${rule.id})">
                    🗑️
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Update mapping rule
function updateRule(ruleId, field, value) {
    const rule = currentRules.find(r => r.id === ruleId);
    if (rule) {
        rule[field] = value;
    }
}

// Update rule color with special handling
function updateRuleColor(ruleId, value) {
    const rule = currentRules.find(r => r.id === ruleId);
    if (rule) {
        // Store in rgb(r,g,b) format for consistency
        const rgb = parseRGBColor(value);
        if (rgb) {
            rule.color = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
        } else {
            rule.color = value; // Store as-is if parsing fails
        }
        
        // Update the color square visual
        const colorSquare = document.querySelector(`input[onchange*="updateRuleColor(${ruleId}"]`).parentElement.querySelector('.color-square');
        if (colorSquare) {
            colorSquare.style.backgroundColor = getRGBCSSColor(rule.color);
        }
        
        console.log(`Updated rule ${ruleId} color to:`, rule.color);
    }
}

// Save profile
async function saveProfile() {
    const name = profileName.value.trim();
    const description = profileDescription.value.trim();
    
    if (!name) {
        profileName.focus();
        showStatus('Profile name is required', 'error');
        return;
    }
    
    if (currentRules.length === 0) {
        showStatus('At least one mapping rule is required', 'error');
        return;
    }
    
    // Validate rules
    const invalidRules = currentRules.filter(rule => 
        (!rule.layerName && !rule.color) || !rule.lineTypeId
    );
    
    if (invalidRules.length > 0) {
        showStatus('All rules must have layer name or color, and a line type', 'error');
        return;
    }
    
    const profileData = {
        id: currentProfile ? currentProfile.id : `profile_${Date.now()}`,
        name,
        description,
        rules: currentRules,
        created: currentProfile ? currentProfile.created : new Date().toISOString(),
        modified: new Date().toISOString()
    };
    
    try {
        await window.electronAPI.saveImportFilter(profileData);
        await loadProfiles();
        closeModal();
        showStatus(`${isEditMode ? 'Updated' : 'Created'} profile: ${name}`);
    } catch (error) {
        console.error('Error saving profile:', error);
        showStatus('Error saving profile', 'error');
    }
}

// Close modal
function closeModal() {
    profileModal.classList.add('hidden');
    currentProfile = null;
    currentRules = [];
    isEditMode = false;
}

// Show status message
function showStatus(message, type = 'success') {
    // Create or update status element
    let status = document.getElementById('status-message');
    if (!status) {
        status = document.createElement('div');
        status.id = 'status-message';
        status.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 2000;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(status);
    }
    
    status.textContent = message;
    status.style.background = type === 'error' ? '#dc3545' : '#28a745';
    status.style.transform = 'translateX(0)';
    status.style.opacity = '1';
    
    setTimeout(() => {
        status.style.transform = 'translateX(100%)';
        status.style.opacity = '0';
    }, 3000);
}

// Make functions globally available
window.editProfile = editProfile;
window.copyProfile = copyProfile;
window.deleteProfile = deleteProfile;
window.removeMappingRule = removeMappingRule;
window.updateRule = updateRule;
