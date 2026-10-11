/**
 * My Assets Library Controller
 */

let assetsViewMode = 'grid';
let assetsSearchTimeout = null;

async function initAssets(routeParams = {}) {
    // Populate categories select
    await loadAssetCategories();

    // Check if route params contain initial filters
    const searchInput = document.getElementById('searchAsset');
    const categorySelect = document.getElementById('categoryFilter');
    const typeSelect = document.getElementById('typeFilter');

    if (routeParams.category && categorySelect) {
        categorySelect.value = routeParams.category;
    }
    if (routeParams.type && typeSelect) {
        typeSelect.value = routeParams.type;
    }
    if (routeParams.q && searchInput) {
        searchInput.value = routeParams.q;
    }

    // View Switcher Buttons
    const gridBtn = document.getElementById('viewGridBtn');
    const listBtn = document.getElementById('viewListBtn');

    if (gridBtn && listBtn) {
        gridBtn.onclick = () => switchAssetsView('grid');
        listBtn.onclick = () => switchAssetsView('list');
    }

    // Filters Listeners
    if (searchInput) {
        searchInput.oninput = () => {
            clearTimeout(assetsSearchTimeout);
            assetsSearchTimeout = setTimeout(() => fetchAndRenderAssets(), 250);
        };
    }

    if (categorySelect) {
        categorySelect.onchange = () => fetchAndRenderAssets();
    }

    if (typeSelect) {
        typeSelect.onchange = () => fetchAndRenderAssets();
    }

    const sortSelect = document.getElementById('sortFilter');
    if (sortSelect) {
        sortSelect.onchange = () => fetchAndRenderAssets();
    }

    // Initial Fetch
    await fetchAndRenderAssets();
}

/**
 * Switch between Grid and Table/List view
 */
function switchAssetsView(mode) {
    assetsViewMode = mode;
    const gridBtn = document.getElementById('viewGridBtn');
    const listBtn = document.getElementById('viewListBtn');
    const gridEl = document.getElementById('assetGrid');
    const tableWrapper = document.getElementById('assetTableWrapper');

    if (mode === 'grid') {
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
        if (gridEl) gridEl.style.display = 'grid';
        if (tableWrapper) tableWrapper.style.display = 'none';
    } else {
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
        if (gridEl) gridEl.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'block';
    }
}

/**
 * Load categories into filter dropdown
 */
async function loadAssetCategories() {
    try {
        const res = await fetch('/api/categories');
        const json = await res.json();
        const select = document.getElementById('categoryFilter');
        if (select && json.success && json.data) {
            const current = select.value;
            select.innerHTML = '<option value="all">All Categories</option>' + json.data.map(cat => `
                <option value="${escapeHtml(cat.name)}" ${current === cat.name ? 'selected' : ''}>
                    ${escapeHtml(cat.name)} (${cat.asset_count})
                </option>
            `).join('');
        }
    } catch (err) {
        console.warn('Could not load categories:', err);
    }
}

/**
 * Fetch filtered assets from backend and render views
 */
async function fetchAndRenderAssets() {
    const searchVal = document.getElementById('searchAsset')?.value.trim() || '';
    const categoryVal = document.getElementById('categoryFilter')?.value || 'all';
    const typeVal = document.getElementById('typeFilter')?.value || 'all';
    const sortVal = document.getElementById('sortFilter')?.value || 'date_desc';

    const gridEl = document.getElementById('assetGrid');
    const tableBody = document.getElementById('assetTableBody');
    const emptyNotice = document.getElementById('assetEmptyNotice');
    const countStatus = document.getElementById('assetCountStatus');

    if (countStatus) countStatus.innerText = 'Searching assets...';

    const params = new URLSearchParams();
    if (searchVal) params.append('search', searchVal);
    if (categoryVal !== 'all') params.append('category', categoryVal);
    if (typeVal !== 'all') params.append('type', typeVal);
    if (sortVal) params.append('sort', sortVal);

    try {
        const res = await fetch(`/api/assets?${params.toString()}`);
        const json = await res.json();

        if (!json.success) {
            showToast('Error', json.message || 'Could not fetch assets', 'error');
            return;
        }

        const assets = json.data;

        if (countStatus) {
            countStatus.innerText = `Displaying ${assets.length} asset${assets.length === 1 ? '' : 's'}`;
        }

        if (assets.length === 0) {
            if (gridEl) gridEl.style.display = 'none';
            const tableWrapper = document.getElementById('assetTableWrapper');
            if (tableWrapper) tableWrapper.style.display = 'none';
            if (emptyNotice) emptyNotice.style.display = 'block';
            return;
        }

        if (emptyNotice) emptyNotice.style.display = 'none';
        switchAssetsView(assetsViewMode);

        // Render Grid View
        if (gridEl) {
            gridEl.innerHTML = assets.map(asset => {
                const isImage = asset.file_type === 'image';
                const thumbMarkup = isImage
                    ? `<div style="height: 140px; overflow: hidden; border-radius: 10px; margin-bottom: 14px; background: #0f172a; display: flex; align-items: center; justify-content: center;">
                         <img src="${asset.preview_url}" style="max-height: 100%; max-width: 100%; object-fit: cover;" alt="${escapeHtml(asset.title)}">
                       </div>`
                    : `<div class="asset-icon" style="height: 100px; display: flex; align-items: center; justify-content: center; font-size: 52px; color: #2563eb; margin-bottom: 10px;">
                         <i class="fa-solid ${asset.icon}"></i>
                       </div>`;

                return `
                    <div class="asset-card" style="display: flex; flex-direction: column; justify-content: space-between; text-align: left; padding: 18px; position: relative;">
                        ${thumbMarkup}
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
                                <h3 style="font-size: 15px; color: #0f172a; margin: 0; line-height: 1.3;" title="${escapeHtml(asset.title)}">
                                    ${escapeHtml(asset.title)}
                                </h3>
                                <span class="badge-pill badge-blue" style="font-size: 11px; flex-shrink: 0;">${escapeHtml(asset.category)}</span>
                            </div>
                            <small style="color: #94a3b8; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 8px;" title="${escapeHtml(asset.original_name)}">
                                ${escapeHtml(asset.original_name)}
                            </small>
                            <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #64748b; margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 8px;">
                                <span><i class="fa-solid fa-hard-drive" style="color: #94a3b8; font-size: 11px;"></i> ${escapeHtml(asset.size_formatted)}</span>
                                <span><i class="fa-solid fa-download" style="color: #3b82f6; font-size: 11px;"></i> ${asset.downloads_count || 0}</span>
                            </div>
                        </div>
                        <div class="asset-actions" style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 6px;">
                            <button class="btn btn-secondary" style="width: 34px; height: 34px; padding: 0; border-radius: 8px;" title="Quick Preview" onclick="openAssetPreview(${asset.id})">
                                <i class="fa-solid fa-eye" style="color: #2563eb;"></i>
                            </button>
                            <button class="btn btn-secondary" style="width: 34px; height: 34px; padding: 0; border-radius: 8px;" title="Edit Metadata" onclick="openAssetEdit(${asset.id})">
                                <i class="fa-solid fa-pen" style="color: #f59e0b;"></i>
                            </button>
                            <a href="${asset.download_url}" class="btn btn-secondary" style="width: 34px; height: 34px; padding: 0; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;" title="Download" download>
                                <i class="fa-solid fa-download" style="color: #10b981;"></i>
                            </a>
                            <button class="btn btn-secondary" style="width: 34px; height: 34px; padding: 0; border-radius: 8px;" title="Delete" onclick="confirmDeleteAsset(${asset.id})">
                                <i class="fa-solid fa-trash" style="color: #ef4444;"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Render Table View
        if (tableBody) {
            tableBody.innerHTML = assets.map(asset => {
                const uploadDate = new Date(asset.created_at).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric'
                });

                return `
                    <tr>
                        <td>
                            <div class="table-asset-cell">
                                <div class="table-asset-icon">
                                    <i class="fa-solid ${asset.icon}"></i>
                                </div>
                                <div>
                                    <b style="color: #1e293b; font-size: 14px; display: block;">${escapeHtml(asset.title)}</b>
                                    <small style="color: #94a3b8;">${escapeHtml(asset.original_name)}</small>
                                </div>
                            </div>
                        </td>
                        <td><span class="badge-pill badge-blue">${escapeHtml(asset.category)}</span></td>
                        <td><span style="font-weight: 500; color: #475569;">${escapeHtml(asset.size_formatted)}</span></td>
                        <td><span style="color: #64748b; font-size: 13px;">${uploadDate}</span></td>
                        <td><span style="color: #64748b; font-size: 13px;"><i class="fa-solid fa-download" style="color: #3b82f6;"></i> ${asset.downloads_count || 0}</span></td>
                        <td style="text-align: right;">
                            <div style="display: inline-flex; gap: 6px;">
                                <button class="btn btn-secondary" style="padding: 6px 10px;" title="View" onclick="openAssetPreview(${asset.id})">
                                    <i class="fa-solid fa-eye" style="color: #2563eb;"></i>
                                </button>
                                <button class="btn btn-secondary" style="padding: 6px 10px;" title="Edit" onclick="openAssetEdit(${asset.id})">
                                    <i class="fa-solid fa-pen" style="color: #f59e0b;"></i>
                                </button>
                                <a href="${asset.download_url}" class="btn btn-secondary" style="padding: 6px 10px;" title="Download" download>
                                    <i class="fa-solid fa-download" style="color: #10b981;"></i>
                                </a>
                                <button class="btn btn-secondary" style="padding: 6px 10px;" title="Delete" onclick="confirmDeleteAsset(${asset.id})">
                                    <i class="fa-solid fa-trash" style="color: #ef4444;"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Error fetching assets:', err);
        if (countStatus) countStatus.innerText = 'Error loading assets.';
    }
}