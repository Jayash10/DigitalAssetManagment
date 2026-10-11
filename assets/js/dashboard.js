/**
 * Dashboard Page Controller
 */
async function initDashboard() {
    try {
        const [statsRes, profileRes] = await Promise.all([
            fetch('/api/stats').then(r => r.json()),
            fetch('/api/profile').then(r => r.json())
        ]);

        if (profileRes.success && profileRes.data) {
            const nameEl = document.getElementById('dashWelcomeName');
            if (nameEl) nameEl.innerText = profileRes.data.name;
        }

        if (!statsRes.success || !statsRes.data) {
            console.error('Failed to load stats:', statsRes.message);
            return;
        }

        const data = statsRes.data;

        // Animate counter values
        animateCounter('dashTotalAssets', data.total_assets);
        animateCounter('dashImagesCount', data.images_count);
        animateCounter('dashVideosCount', data.videos_count);
        animateCounter('dashDocsCount', data.documents_count);

        // Storage Bar & Info
        const storageTextEl = document.getElementById('dashStorageText');
        const storageBarEl = document.getElementById('dashStorageBar');
        const storageBadgeEl = document.getElementById('dashStorageBadge');

        if (storageTextEl) {
            storageTextEl.innerText = `${data.storage_used_formatted} of ${data.storage_quota_gb} GB Allocated (${data.storage_percent}% used)`;
        }
        if (storageBarEl) {
            const pct = Math.min(Math.max(data.storage_percent, data.storage_used_bytes > 0 ? 1 : 0), 100);
            storageBarEl.style.width = `${pct}%`;
            if (pct > 80) storageBarEl.style.background = '#ef4444';
            else if (pct > 50) storageBarEl.style.background = '#f59e0b';
            else storageBarEl.style.background = '#2563eb';
        }
        if (storageBadgeEl) {
            storageBadgeEl.innerText = `${data.storage_percent}% Used`;
        }

        // Populate Recent Uploads Table
        renderRecentTable(data.recent_uploads);
    } catch (err) {
        console.error('Error initializing dashboard:', err);
    }
}

function renderRecentTable(uploads) {
    const tbody = document.getElementById('dashRecentTableBody');
    if (!tbody) return;

    if (!uploads || uploads.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #64748b; padding: 40px 20px;">
                    <div style="font-size: 32px; color: #94a3b8; margin-bottom: 8px;"><i class="fa-solid fa-folder-open"></i></div>
                    <b>No digital assets uploaded yet.</b>
                    <p style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Click "Upload Asset" to begin managing files.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = uploads.map(asset => {
        const uploadDate = new Date(asset.created_at).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric'
        });

        return `
            <tr>
                <td>
                    <div class="table-asset-cell">
                        <div class="table-asset-icon">
                            <i class="fa-solid ${asset.file_type === 'image' ? 'fa-image' : asset.file_type === 'video' ? 'fa-video' : 'fa-file'}"></i>
                        </div>
                        <div>
                            <b style="color:#1e293b; display: block; font-size: 14px;">${escapeHtml(asset.title)}</b>
                            <small style="color:#94a3b8;">${escapeHtml(asset.original_name)}</small>
                        </div>
                    </div>
                </td>
                <td><span class="badge-pill badge-blue">${escapeHtml(asset.category)}</span></td>
                <td><span style="font-weight: 500; color: #475569;">${escapeHtml(asset.size_formatted)}</span></td>
                <td><span style="color: #64748b; font-size: 13px;">${uploadDate}</span></td>
                <td>
                    <span style="display: inline-flex; align-items: center; gap: 5px; color: #64748b; font-size: 13px;">
                        <i class="fa-solid fa-download" style="font-size: 11px; color: #3b82f6;"></i> ${asset.downloads_count || 0}
                    </span>
                </td>
                <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 8px;">
                        <button class="btn btn-secondary" style="padding: 6px 10px; border-radius: 6px;" title="Quick View" onclick="openAssetPreview(${asset.id})">
                            <i class="fa-solid fa-eye" style="color: #2563eb;"></i>
                        </button>
                        <a href="${asset.download_url}" class="btn btn-secondary" style="padding: 6px 10px; border-radius: 6px;" title="Download" download>
                            <i class="fa-solid fa-download" style="color: #10b981;"></i>
                        </a>
                        <button class="btn btn-secondary" style="padding: 6px 10px; border-radius: 6px;" title="Delete" onclick="confirmDeleteAsset(${asset.id})">
                            <i class="fa-solid fa-trash" style="color: #ef4444;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function animateCounter(elementId, targetValue) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const target = parseInt(targetValue, 10) || 0;
    let current = 0;
    const increment = Math.max(1, Math.floor(target / 20));
    const duration = 400;
    const stepTime = Math.abs(Math.floor(duration / (target || 1)));

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            el.innerText = target;
            clearInterval(timer);
        } else {
            el.innerText = current;
        }
    }, Math.min(stepTime, 30));
}