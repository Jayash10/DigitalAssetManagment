/**
 * Advanced Search Page Controller (Keyword & AI Semantic Search)
 */

let searchMode = 'ai'; // 'standard' or 'ai'

async function initSearch(routeParams = {}) {
    await loadSearchCategories();

    const searchInput = document.getElementById('advSearchInput');
    const categorySelect = document.getElementById('advCategoryFilter');
    const typeSelect = document.getElementById('advTypeFilter');
    const sortSelect = document.getElementById('advSortFilter');
    const searchBtn = document.getElementById('executeSearchBtn');
    const resetBtn = document.getElementById('resetSearchBtn');
    const modeStandardBtn = document.getElementById('searchModeStandardBtn');
    const modeAiBtn = document.getElementById('searchModeAiBtn');

    if (routeParams.q && searchInput) {
        searchInput.value = routeParams.q;
    }

    // Search Mode Toggle Handlers
    if (modeStandardBtn && modeAiBtn) {
        modeStandardBtn.onclick = () => {
            searchMode = 'standard';
            modeStandardBtn.className = 'btn btn-primary';
            modeAiBtn.className = 'btn btn-secondary';
            if (searchInput) searchInput.placeholder = "Type exact title, tag, or filename...";
            executeSearchQuery();
        };

        modeAiBtn.onclick = () => {
            searchMode = 'ai';
            modeAiBtn.className = 'btn btn-ai';
            modeStandardBtn.className = 'btn btn-secondary';
            if (searchInput) searchInput.placeholder = "Try natural queries like: 'presentation decks for cloud', 'official certificates', 'vector logos'...";
            executeSearchQuery();
        };

        // Default to AI Mode
        modeAiBtn.click();
    }

    if (searchBtn) {
        searchBtn.onclick = () => executeSearchQuery();
    }

    if (searchInput) {
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') executeSearchQuery();
        };
    }

    if (categorySelect) categorySelect.onchange = () => executeSearchQuery();
    if (typeSelect) typeSelect.onchange = () => executeSearchQuery();
    if (sortSelect) sortSelect.onchange = () => executeSearchQuery();

    if (resetBtn) {
        resetBtn.onclick = () => {
            if (searchInput) searchInput.value = '';
            if (categorySelect) categorySelect.value = 'all';
            if (typeSelect) typeSelect.value = 'all';
            if (sortSelect) sortSelect.value = 'date_desc';
            executeSearchQuery();
        };
    }

    // Run initial search
    executeSearchQuery();
}

/**
 * Load categories into advanced search dropdown
 */
async function loadSearchCategories() {
    try {
        const res = await fetch('/api/categories');
        const json = await res.json();
        const select = document.getElementById('advCategoryFilter');
        if (select && json.success && json.data) {
            select.innerHTML = '<option value="all">All Categories</option>' + json.data.map(cat => `
                <option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>
            `).join('');
        }
    } catch (err) {
        console.warn('Could not load categories for search:', err);
    }
}

/**
 * Execute search query against backend API
 */
async function executeSearchQuery() {
    const searchVal = document.getElementById('advSearchInput')?.value.trim() || '';
    const categoryVal = document.getElementById('advCategoryFilter')?.value || 'all';
    const typeVal = document.getElementById('advTypeFilter')?.value || 'all';
    const sortVal = document.getElementById('advSortFilter')?.value || 'date_desc';

    const statusEl = document.getElementById('searchResultsStatus');
    const gridEl = document.getElementById('searchResultsGrid');
    const emptyNotice = document.getElementById('searchEmptyNotice');

    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing asset repository...';

    try {
        let assets = [];

        if (searchMode === 'ai' && searchVal) {
            // AI Semantic Search Endpoint
            const res = await fetch(`/api/ai/semantic-search?q=${encodeURIComponent(searchVal)}`);
            const json = await res.json();
            if (json.success) {
                assets = json.data;
            }
        } else {
            // Standard Database Search
            const params = new URLSearchParams();
            if (searchVal) params.append('search', searchVal);
            if (categoryVal !== 'all') params.append('category', categoryVal);
            if (typeVal !== 'all') params.append('type', typeVal);
            if (sortVal) params.append('sort', sortVal);

            const res = await fetch(`/api/assets?${params.toString()}`);
            const json = await res.json();
            if (json.success) {
                assets = json.data;
            }
        }

        if (statusEl) {
            const queryLabel = searchVal ? ` for "${escapeHtml(searchVal)}"` : '';
            const modeLabel = searchMode === 'ai' && searchVal ? ' <span class="badge-pill badge-ai"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Semantic Match</span>' : '';
            statusEl.innerHTML = `Found <b>${assets.length}</b> digital asset${assets.length === 1 ? '' : 's'}${queryLabel}${modeLabel}`;
        }

        if (!gridEl) return;

        if (assets.length === 0) {
            gridEl.innerHTML = '';
            if (emptyNotice) emptyNotice.style.display = 'block';
            return;
        }

        if (emptyNotice) emptyNotice.style.display = 'none';

        gridEl.innerHTML = assets.map(asset => {
            const previewContent = renderSearchThumbnail(asset);
            const scoreBadge = asset.relevance_score ? `
                <span class="badge-pill badge-ai" style="position: absolute; top: 12px; left: 12px; z-index: 2; box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);">
                    <i class="fa-solid fa-sparkles"></i> ${asset.relevance_score}% Match
                </span>` : '';

            return `
                <div class="asset-card">
                    <div class="asset-thumbnail-container" onclick="openAssetPreview(${asset.id})" style="cursor: pointer;">
                        ${scoreBadge}
                        <span class="badge-pill badge-blue" style="position: absolute; top: 12px; right: 12px; z-index: 2;">
                            ${escapeHtml(asset.category)}
                        </span>
                        ${previewContent}
                    </div>
                    <div class="asset-details">
                        <h4 class="asset-title" title="${escapeHtml(asset.title)}" onclick="openAssetPreview(${asset.id})" style="cursor: pointer;">
                            ${escapeHtml(asset.title)}
                        </h4>
                        <div class="asset-meta-row">
                            <span><i class="fa-regular fa-file"></i> ${escapeHtml(asset.file_type || 'file')}</span>
                            <span>${escapeHtml(asset.size_formatted)}</span>
                        </div>
                        <div class="asset-meta-row" style="font-size: 11.5px; color: var(--text-muted);">
                            <span><i class="fa-solid fa-download"></i> ${asset.downloads_count || 0} downloads</span>
                            <span>${new Date(asset.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="asset-actions">
                            <button type="button" class="asset-action-btn" onclick="openAssetPreview(${asset.id})">
                                <i class="fa-solid fa-eye"></i> View
                            </button>
                            <a class="asset-action-btn" href="${asset.download_url}" download="${escapeHtml(asset.original_name)}">
                                <i class="fa-solid fa-download"></i>
                            </a>
                            <button type="button" class="asset-action-btn" onclick="openAssetEdit(${asset.id})">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Search execution failed:', err);
        if (statusEl) statusEl.innerText = 'Search query failed due to connection error.';
    }
}

function renderSearchThumbnail(asset) {
    if (asset.file_type === 'image') {
        return `<img src="${asset.preview_url}" alt="${escapeHtml(asset.title)}" loading="lazy" onerror="this.onerror=null;this.src='assets/images/user.svg'">`;
    }
    return `<i class="fa-solid ${asset.icon || 'fa-file'} asset-thumbnail-icon"></i>`;
}
