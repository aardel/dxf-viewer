// Line Types Manager JavaScript

let lineTypes = [];
let currentEditingId = null;
let isAddMode = false;

// DOM Elements
const cardsView = document.getElementById('cardsView');
const listView = document.getElementById('listView');
const cardsViewBtn = document.getElementById('cardsViewBtn');
const listViewBtn = document.getElementById('listViewBtn');
const cardsGrid = document.getElementById('cardsGrid');
const tableBody = document.getElementById('lineTypesTableBody');
const statusEl = document.getElementById('status');

// Button elements
const addLineTypeBtn = document.getElementById('addLineTypeBtn');
const reloadBtn = document.getElementById('reloadBtn');
const saveAllBtn = document.getElementById('saveAllBtn');

// Modal elements
const editModal = document.getElementById('editModal');
const modalTitle = document.getElementById('modalTitle');
const modalClose = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalDelete = document.getElementById('modalDelete');
const modalSave = document.getElementById('modalSave');

// Form elements
const editName = document.getElementById('editName');
const editDescription = document.getElementById('editDescription');
const editLineTypeSelect = document.getElementById('editLineType');
const editWidth = document.getElementById('editWidth');
const editColor = document.getElementById('editColor');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔄 Line Types Manager v2.0 - Auto-Save Edition Loading...');
    setupEventListeners();
    await loadLineTypes();
    showStatus('Ready - Auto-Save Edition v2.0 🚀');
});

function setupEventListeners() {
    // View toggle
    cardsViewBtn.addEventListener('click', () => switchView('cards'));
    listViewBtn.addEventListener('click', () => switchView('list'));
    
    // Buttons
    addLineTypeBtn.addEventListener('click', addLineType);
    reloadBtn.addEventListener('click', reloadLineTypes);
    saveAllBtn.addEventListener('click', saveAllLineTypes);
    
    // Modal
    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);
    modalDelete.addEventListener('click', deleteLineType);
    modalSave.addEventListener('click', saveLineType);
    
    // Modal keyboard events
    editModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveLineType();
    });
}

function switchView(view) {
    if (view === 'cards') {
        cardsView.classList.remove('hidden');
        listView.classList.add('hidden');
        cardsViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
    } else {
        cardsView.classList.add('hidden');
        listView.classList.remove('hidden');
        cardsViewBtn.classList.remove('active');
        listViewBtn.classList.add('active');
    }
}

async function loadLineTypes() {
    try {
        showStatus('Loading line types...');
        const result = await window.electronAPI.loadLineTypes();
        
        if (result.success) {
            lineTypes = result.data;
            renderViews();
            showStatus(`Loaded ${lineTypes.length} line types`);
        } else {
            showStatus('Error loading line types: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error loading line types:', error);
        showStatus('Failed to load line types', 'error');
    }
}

async function reloadLineTypes() {
    await loadLineTypes();
}

async function saveAllLineTypes() {
    try {
        console.log('💾 AUTO-SAVE: Saving', lineTypes.length, 'line types...');
        showStatus('Saving line types...');
        const result = await window.electronAPI.saveLineTypes(lineTypes);
        
        if (result.success) {
            console.log('✅ AUTO-SAVE: Save successful -', result.message || 'Saved successfully');
            showStatus(result.message || 'Line types saved successfully');
            return true;
        } else {
            console.error('❌ AUTO-SAVE: Save failed -', result.error);
            showStatus('Error saving line types: ' + result.error, 'error');
            return false;
        }
    } catch (error) {
        console.error('❌ AUTO-SAVE: Exception during save:', error);
        showStatus('Failed to save line types', 'error');
        return false;
    }
}

function renderViews() {
    renderCardsView();
    renderListView();
}

function renderCardsView() {
    cardsGrid.innerHTML = '';
    
    lineTypes.forEach(lineType => {
        const card = createLineTypeCard(lineType);
        cardsGrid.appendChild(card);
    });
}

function createLineTypeCard(lineType) {
    const card = document.createElement('div');
    card.className = 'line-type-card';
    
    const lineTypeClass = `linetype-${lineType.lineType}`;
    const icon = getLineTypeIcon(lineType.lineType);
    
    card.innerHTML = `
        <div class="card-header">
            <div class="card-icon" style="background-color: ${lineType.color}">
                ${icon}
            </div>
            <div class="card-title">
                <h3>${lineType.name}</h3>
                <p>${lineType.description}</p>
            </div>
        </div>
        <div class="card-body">
            <div class="card-details">
                <div class="detail-item">
                    <div class="detail-label">Line Type</div>
                    <div class="detail-value">
                        <span class="linetype-badge ${lineTypeClass}">
                            ${lineType.lineType.charAt(0).toUpperCase() + lineType.lineType.slice(1)}
                        </span>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Width</div>
                    <div class="detail-value width-value">${lineType.width}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Color</div>
                    <div class="detail-value">
                        <div class="color-indicator" style="background-color: ${lineType.color}"></div>
                        ${lineType.color}
                    </div>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-primary btn-small" onclick="editLineType(${lineType.id})">
                    ✏️ Edit
                </button>
                <button class="btn btn-danger btn-small" onclick="confirmDeleteLineType(${lineType.id})">
                    🗑️
                </button>
            </div>
        </div>
    `;
    
    return card;
}

function renderListView() {
    tableBody.innerHTML = '';
    
    lineTypes.forEach(lineType => {
        const row = createLineTypeRow(lineType);
        tableBody.appendChild(row);
    });
}

function createLineTypeRow(lineType) {
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td>
            <input type="text" value="${lineType.name}" 
                   onchange="updateLineType(${lineType.id}, 'name', this.value)"
                   class="table-input name-input">
        </td>
        <td>
            <input type="text" value="${lineType.description}" 
                   onchange="updateLineType(${lineType.id}, 'description', this.value)"
                   class="table-input description-input">
        </td>
        <td>
            <select onchange="updateLineType(${lineType.id}, 'lineType', this.value)"
                    class="table-select linetype-select">
                <option value="laser" ${lineType.lineType === 'laser' ? 'selected' : ''}>Laser</option>
                <option value="milling" ${lineType.lineType === 'milling' ? 'selected' : ''}>Milling</option>
                <option value="plasma" ${lineType.lineType === 'plasma' ? 'selected' : ''}>Plasma</option>
                <option value="waterjet" ${lineType.lineType === 'waterjet' ? 'selected' : ''}>Water Jet</option>
                <option value="engraving" ${lineType.lineType === 'engraving' ? 'selected' : ''}>Engraving</option>
            </select>
        </td>
        <td>
            <input type="number" value="${lineType.width}" step="0.1" min="0"
                   onchange="updateLineType(${lineType.id}, 'width', parseFloat(this.value))"
                   class="table-input width-input">
        </td>
        <td>
            <div class="color-cell">
                <input type="color" value="${lineType.color}" 
                       onchange="updateLineType(${lineType.id}, 'color', this.value)"
                       class="color-picker">
                <span class="color-value">${lineType.color}</span>
            </div>
        </td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-danger btn-small" onclick="confirmDeleteLineType(${lineType.id})">
                    Delete
                </button>
            </div>
        </td>
    `;
    
    return row;
}

function getLineTypeIcon(lineType) {
    const icons = {
        'laser': '🔴',
        'milling': '⚙️', 
        'plasma': '⚡',
        'waterjet': '💧',
        'engraving': '✏️'
    };
    return icons[lineType] || '🔧';
}

async function updateLineType(id, field, value) {
    const lineType = lineTypes.find(lt => lt.id === id);
    if (lineType) {
        lineType[field] = value;
        renderViews(); // Re-render to show changes
        showStatus(`Updated ${lineType.name}`);
        
        // Auto-save after inline edit
        await saveAllLineTypes();
    }
}

function addLineType() {
    isAddMode = true;
    currentEditingId = null;
    
    // Generate new ID
    const maxId = Math.max(...lineTypes.map(lt => lt.id), 0);
    const newId = maxId + 1;
    
    // Set modal for add mode
    modalTitle.textContent = 'Add New Line Type';
    modalDelete.style.display = 'none';
    
    // Clear form
    editName.value = '';
    editDescription.value = '';
    editLineTypeSelect.value = 'laser';
    editWidth.value = '1';
    editColor.value = '#FF0000';
    
    currentEditingId = newId;
    editModal.classList.remove('hidden');
    editName.focus();
}

function editLineType(id) {
    const lineType = lineTypes.find(lt => lt.id === id);
    if (!lineType) return;
    
    isAddMode = false;
    currentEditingId = id;
    
    // Set modal for edit mode
    modalTitle.textContent = 'Edit Line Type';
    modalDelete.style.display = 'block';
    
    // Fill form
    editName.value = lineType.name;
    editDescription.value = lineType.description;
    editLineTypeSelect.value = lineType.lineType;
    editWidth.value = lineType.width;
    editColor.value = lineType.color;
    
    editModal.classList.remove('hidden');
    editName.focus();
    editName.select();
}

async function saveLineType() {
    const name = editName.value.trim();
    const description = editDescription.value.trim();
    const lineType = editLineTypeSelect.value;
    const width = parseFloat(editWidth.value);
    const color = editColor.value;
    
    if (!name) {
        editName.focus();
        return;
    }
    
    if (isNaN(width) || width < 0) {
        editWidth.focus();
        return;
    }
    
    const lineTypeData = {
        id: currentEditingId,
        name,
        description,
        lineType,
        width,
        color: color.toUpperCase()
    };
    
    if (isAddMode) {
        lineTypes.push(lineTypeData);
        showStatus(`Added new line type: ${name}`);
    } else {
        const index = lineTypes.findIndex(lt => lt.id === currentEditingId);
        if (index !== -1) {
            lineTypes[index] = lineTypeData;
            showStatus(`Updated line type: ${name}`);
        }
    }
    
    renderViews();
    closeModal();
    
    // Auto-save after modification
    await saveAllLineTypes();
}

function confirmDeleteLineType(id) {
    const lineType = lineTypes.find(lt => lt.id === id);
    if (!lineType) return;
    
    if (confirm(`Are you sure you want to delete "${lineType.name}"?`)) {
        deleteLineTypeById(id);
    }
}

function deleteLineType() {
    if (currentEditingId && !isAddMode) {
        const lineType = lineTypes.find(lt => lt.id === currentEditingId);
        if (lineType && confirm(`Are you sure you want to delete "${lineType.name}"?`)) {
            deleteLineTypeById(currentEditingId);
            closeModal();
        }
    }
}

async function deleteLineTypeById(id) {
    const index = lineTypes.findIndex(lt => lt.id === id);
    if (index !== -1) {
        const deleted = lineTypes.splice(index, 1)[0];
        renderViews();
        console.log('🗑️ AUTO-SAVE: Deleting line type:', deleted.name);
        showStatus(`Deleted line type: ${deleted.name} - Auto-saving...`);
        
        // Auto-save after deletion
        const result = await saveAllLineTypes();
        if (result) {
            console.log('✅ AUTO-SAVE: Successfully saved after deletion');
            showStatus(`Deleted "${deleted.name}" and auto-saved ✅`);
        }
    }
}

function closeModal() {
    editModal.classList.add('hidden');
    currentEditingId = null;
    isAddMode = false;
}

function showStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = 'status';
    if (type === 'error') {
        statusEl.style.color = '#dc3545';
        statusEl.style.background = '#f8d7da';
    } else if (type === 'success') {
        statusEl.style.color = '#155724';
        statusEl.style.background = '#d4edda';
    } else {
        statusEl.style.color = '#666';
        statusEl.style.background = '#f8f9fa';
    }
    
    // Clear status after 3 seconds
    setTimeout(() => {
        if (statusEl.textContent === message) {
            statusEl.textContent = 'Ready';
            statusEl.style.color = '#666';
            statusEl.style.background = '#f8f9fa';
        }
    }, 3000);
}

// Make functions globally available
window.editLineType = editLineType;
window.updateLineType = updateLineType;
window.confirmDeleteLineType = confirmDeleteLineType;
