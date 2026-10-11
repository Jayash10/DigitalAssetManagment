/**
 * Categories Directory Controller
 */

async function initCategories() {
    const grid = document.getElementById('categoryGrid');
    const addBtn = document.getElementById('addCategoryBtn');
    const modal = document.getElementById('categoryModal');
    const closeBtn = document.getElementById('closeCategoryModal');
    const cancelBtn = document.getElementById('cancelCategoryModal');
    const form = document.getElementById('createCategoryForm');

    // Modal controls
    if (addBtn && modal) {
        addBtn.onclick = () => modal.classList.add('show');
    }

    if (closeBtn && modal) {
        closeBtn.onclick = () => modal.classList.remove('show');
    }

    if (cancelBtn && modal) {
        cancelBtn.onclick = () => modal.classList.remove('show');
    }

    // Create Category Form Submission
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('newCategoryName').value.trim();
            const icon = document.getElementById('newCategoryIcon').value;
            const description = document.getElementById('newCategoryDesc').value.trim();

            if (!name) {
                showToast('Validation Error', 'Category name is required.', 'warning');
                return;
            }

            try {
                const res = await fetch('/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, icon, description })
                });

                const data = await res.json();
                if (data.success) {
                    showToast('Category Created', `"${name}" added successfully!`, 'success');
                    form.reset();
                    if (modal) modal.classList.remove('show');
                    loadCategoriesList();
                } else {
                    showToast('Creation Failed', data.message || 'Could not create category', 'error');
                }
            } catch (err) {
                showToast('Error', 'Server connection error: ' + err.message, 'error');
            }
        };
    }

    // Load and render categories
    await loadCategoriesList();
}

/**
 * Fetch and Render Category Cards
 */
async function loadCategoriesList() {
    const grid = document.getElementById('categoryGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/categories');
        const json = await res.json();

        if (!json.success || !json.data) {
            grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #ef4444; padding: 20px;">Failed to load categories.</div>`;
            return;
        }

        const categories = json.data;
        window.DAM_STATE.categories = categories;

        if (categories.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 40px;">No categories configured.</div>`;
            return;
        }

        grid.innerHTML = categories.map(cat => {
            const isDefault = cat.name.toLowerCase() === 'others';
            const deleteAction = !isDefault ? `
                <button class="category-menu" title="Delete Category" onclick="event.stopPropagation(); deleteCategory(${cat.id}, '${escapeHtml(cat.name)}')">
                    <i class="fa-solid fa-trash" style="font-size: 14px; color: #ef4444;"></i>
                </button>
            ` : '';

            return `
                <div class="category-card" style="cursor: pointer;" onclick="navigateToPage('pages/assets.html', { category: '${escapeHtml(cat.name)}' })">
                    <div class="category-icon ${cat.color_class || 'other-icon'}">
                        <i class="fa-solid ${cat.icon || 'fa-folder'}"></i>
                    </div>

                    <div class="category-info" style="min-width: 0;">
                        <h3 style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(cat.name)}">
                            ${escapeHtml(cat.name)}
                        </h3>
                        <p>${cat.asset_count} Asset${cat.asset_count === 1 ? '' : 's'}</p>
                        ${cat.description ? `<small style="color: #94a3b8; font-size: 11.5px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(cat.description)}</small>` : ''}
                    </div>

                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${deleteAction}
                        <i class="fa-solid fa-chevron-right" style="font-size: 12px; color: #cbd5e1;"></i>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Error fetching categories:', err);
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #ef4444; padding: 20px;">Network error loading categories.</div>`;
    }
}

/**
 * Delete category with prompt
 */
async function deleteCategory(id, name) {
    if (!confirm(`Are you sure you want to delete the category "${name}"?\nAssets belonging to this category will be automatically reassigned to "Others".`)) {
        return;
    }

    try {
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            showToast('Category Deleted', json.message, 'success');
            loadCategoriesList();
        } else {
            showToast('Delete Failed', json.message, 'error');
        }
    } catch (err) {
        showToast('Error', 'Server error deleting category: ' + err.message, 'error');
    }
}