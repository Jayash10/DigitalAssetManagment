/**
 * Core Application Controller - Digital Asset Management System (SPA)
 */

// Global State
window.DAM_STATE = {
    currentPage: 'pages/dashboard.html',
    currentRouteParams: {},
    categories: [],
    profile: null
};

// DOM Content Loaded - Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    // Auth Guard Check
    if (!localStorage.getItem('dam_token')) {
        window.location.href = 'login.html';
        return;
    }
    // 1. Setup Menu Click Listeners
    setupNavigation();

    // 2. Setup Topbar Global Handlers
    setupTopbar();

    // 3. Setup Global Modals & Forms
    setupGlobalModals();

    // 4. Initial User & Notifications Load
    loadGlobalProfile();
    loadNotifications();

    // 5. Load Initial Dashboard View
    navigateToPage('pages/dashboard.html');
});

/**
 * Setup Sidebar Menu Navigation
 */
function setupNavigation() {
    document.querySelectorAll('.menu li[data-page]').forEach(item => {
        item.addEventListener('click', function () {
            const page = this.dataset.page;
            navigateToPage(page);
        });
    });

    // Logout action
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to log out of the DAM System?')) {
                localStorage.removeItem('dam_token');
                localStorage.removeItem('dam_user');
                showToast('Session Ended', 'You have been logged out securely.', 'info');
                setTimeout(() => {
                    location.href = 'login.html';
                }, 1000);
            }
        });
    }
}

/**
 * Page Navigation Controller
 */
function navigateToPage(page, params = {}) {
    window.DAM_STATE.currentPage = page;
    window.DAM_STATE.currentRouteParams = params;

    // Update active class in sidebar
    document.querySelectorAll('.menu li').forEach(li => {
        if (li.dataset.page === page) {
            li.classList.add('active');
            const pageTitleEl = document.getElementById('pageTitle');
            if (pageTitleEl) {
                pageTitleEl.innerText = li.querySelector('span').innerText.trim();
            }
        } else {
            li.classList.remove('active');
        }
    });

    const contentEl = document.getElementById('content');
    if (!contentEl) return;

    // Loading indicator
    contentEl.style.opacity = '0.6';

    fetch(page)
        .then(response => {
            if (!response.ok) throw new Error('Page not found');
            return response.text();
        })
        .then(html => {
            contentEl.innerHTML = html;
            contentEl.style.opacity = '1';

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Invoke Lifecycle hook for the active page
            dispatchPageInit(page, params);
        })
        .catch(err => {
            console.error('Routing error:', err);
            contentEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon" style="background: #fee2e2; color: #ef4444;">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <h3>Page Failed to Load</h3>
                    <p>Could not load the requested page component.</p>
                    <button class="btn btn-primary" onclick="navigateToPage('pages/dashboard.html')">
                        <i class="fa-solid fa-house"></i> Return to Dashboard
                    </button>
                </div>
            `;
            contentEl.style.opacity = '1';
        });
}

/**
 * Dispatch page initialization after innerHTML injection
 */
function dispatchPageInit(page, params) {
    if (page.includes('dashboard.html') && typeof initDashboard === 'function') {
        initDashboard();
    } else if (page.includes('upload.html') && typeof initUpload === 'function') {
        initUpload();
    } else if (page.includes('assets.html') && typeof initAssets === 'function') {
        initAssets(params);
    } else if (page.includes('categories.html') && typeof initCategories === 'function') {
        initCategories();
    } else if (page.includes('search.html') && typeof initSearch === 'function') {
        initSearch(params);
    } else if (page.includes('profile.html') && typeof initProfile === 'function') {
        initProfile();
    } else if (page.includes('settings.html') && typeof initSettings === 'function') {
        initSettings();
    }
}

/**
 * Setup Topbar search, notifications, profile shortcuts
 */
function setupTopbar() {
    // Theme Toggle Handler
    const themeBtn = document.getElementById('themeToggleBtn');
    const syncThemeIcon = (theme) => {
        if (!themeBtn) return;
        const icon = themeBtn.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    };

    const currentTheme = localStorage.getItem('dam_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    syncThemeIcon(currentTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const activeTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', activeTheme);
            localStorage.setItem('dam_theme', activeTheme);
            syncThemeIcon(activeTheme);
            showToast('Theme Updated', `Switched to ${activeTheme === 'dark' ? 'Midnight Dark' : 'Studio Light'} mode.`, 'info', 2000);
            window.dispatchEvent(new CustomEvent('dam:themechange', { detail: { theme: activeTheme } }));
        });
    }

    // Global search input
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    navigateToPage('pages/search.html', { q: query });
                }
            }
        });
    }

    // Topbar Profile shortcut
    const profileBtn = document.getElementById('topbarProfileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            navigateToPage('pages/profile.html');
        });
    }

    // Notification dropdown toggle
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle('show');
            if (notifDropdown.classList.contains('show')) {
                loadNotifications();
            }
        });

        document.addEventListener('click', (e) => {
            if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
                notifDropdown.classList.remove('show');
            }
        });
    }
}

/**
 * Fetch and update Global Profile details in Topbar
 */
async function loadGlobalProfile() {
    try {
        const res = await fetch('/api/profile');
        const json = await res.json();
        if (json.success) {
            window.DAM_STATE.profile = json.data;
            const nameEl = document.getElementById('topbarUserName');
            const roleEl = document.getElementById('topbarUserRole');
            const avatarEl = document.getElementById('topbarAvatar');

            if (nameEl) nameEl.innerText = json.data.name;
            if (roleEl) roleEl.innerText = json.data.role;
            if (avatarEl && json.data.avatar_url) avatarEl.src = json.data.avatar_url;
        }
    } catch (err) {
        console.warn('Could not load profile:', err);
    }
}

/**
 * Fetch and populate Activity Notifications
 */
async function loadNotifications() {
    try {
        const res = await fetch('/api/stats');
        const json = await res.json();
        if (json.success && json.data.recent_activities) {
            const list = document.getElementById('notifList');
            const badge = document.getElementById('notifCountBadge');
            if (!list) return;

            const acts = json.data.recent_activities;
            if (badge) badge.innerText = acts.length;

            if (acts.length === 0) {
                list.innerHTML = `
                    <li class="notification-item">
                        <i class="fa-solid fa-check"></i>
                        <div class="notif-text">
                            <b>No new activities</b>
                            <span class="notif-time">All caught up</span>
                        </div>
                    </li>
                `;
                return;
            }

            list.innerHTML = acts.map(act => {
                let icon = 'fa-arrow-up';
                if (act.action === 'Deleted') icon = 'fa-trash';
                if (act.action === 'Edited') icon = 'fa-pen';
                if (act.action === 'Downloaded') icon = 'fa-download';

                const timeAgo = formatTimeAgo(act.timestamp);

                return `
                    <li class="notification-item">
                        <i class="fa-solid ${icon}"></i>
                        <div class="notif-text">
                            <b>${escapeHtml(act.action)}:</b> ${escapeHtml(act.asset_name)}
                            <span class="notif-time">${timeAgo}</span>
                        </div>
                    </li>
                `;
            }).join('');
        }
    } catch (err) {
        console.warn('Could not load notifications:', err);
    }
}

/**
 * Toast Notification Utility
 */
function showToast(title, message, type = 'success', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-xmark';
    if (type === 'warning') icon = 'fa-triangle-exclamation';
    if (type === 'info') icon = 'fa-circle-info';

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fa-solid ${icon}"></i>
        </div>
        <div class="toast-content">
            <h5>${escapeHtml(title)}</h5>
            <p>${escapeHtml(message)}</p>
        </div>
        <button class="toast-close" title="Dismiss">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
        dismissToast(toast);
    });

    container.appendChild(toast);

    setTimeout(() => {
        dismissToast(toast);
    }, duration);
}

function dismissToast(toast) {
    toast.classList.add('toast-hide');
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 300);
}

/**
 * Global Modal Controls
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

// Close modals when clicking backdrop or pressing ESC
function setupGlobalModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
        }
    });

    // Edit form submission
    const editForm = document.getElementById('editAssetForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editAssetId').value;
            const title = document.getElementById('editAssetTitle').value.trim();
            const category = document.getElementById('editAssetCategory').value;
            const tags = document.getElementById('editAssetTags').value.trim();
            const description = document.getElementById('editAssetDesc').value.trim();

            try {
                const res = await fetch(`/api/assets/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, category, tags, description })
                });

                const data = await res.json();
                if (data.success) {
                    showToast('Metadata Updated', `Asset "${title}" updated successfully!`, 'success');
                    closeModal('assetEditModal');
                    closeModal('assetPreviewModal');

                    // Refresh current page
                    dispatchPageInit(window.DAM_STATE.currentPage, window.DAM_STATE.currentRouteParams);
                } else {
                    showToast('Update Failed', data.message || 'Error updating asset', 'error');
                }
            } catch (err) {
                showToast('Error', 'Network or server error updating asset.', 'error');
            }
        });
    }

    // Confirm Delete button
    const execDeleteBtn = document.getElementById('executeDeleteAssetBtn');
    if (execDeleteBtn) {
        execDeleteBtn.addEventListener('click', async () => {
            const id = document.getElementById('deleteTargetAssetId').value;
            if (!id) return;

            try {
                const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    showToast('Asset Deleted', data.message, 'success');
                    closeModal('confirmDeleteModal');
                    closeModal('assetPreviewModal');

                    // Refresh current page
                    dispatchPageInit(window.DAM_STATE.currentPage, window.DAM_STATE.currentRouteParams);
                } else {
                    showToast('Delete Failed', data.message, 'error');
                }
            } catch (err) {
                showToast('Error', 'Could not delete asset due to network error.', 'error');
            }
        });
    }
}

/**
 * Open Asset Preview Modal with rich viewer
 */
async function openAssetPreview(assetId) {
    try {
        const res = await fetch(`/api/assets/${assetId}`);
        const json = await res.json();
        if (!json.success || !json.data) {
            showToast('Not Found', 'Asset details could not be retrieved.', 'error');
            return;
        }

        const asset = json.data;
        const container = document.getElementById('previewMediaContainer');

        // Render Media based on type
        if (asset.file_type === 'image') {
            container.innerHTML = `<img src="${asset.preview_url}" alt="${escapeHtml(asset.title)}" onerror="this.src='assets/images/user.svg'">`;
        } else if (asset.file_type === 'video') {
            container.innerHTML = `<video src="${asset.preview_url}" controls autoplay muted style="width:100%;max-height:360px;"></video>`;
        } else if (asset.file_type === 'audio') {
            container.innerHTML = `
                <div style="text-align:center;padding:20px;width:100%;">
                    <i class="fa-solid fa-music" style="font-size:50px;color:#3b82f6;margin-bottom:20px;"></i>
                    <br>
                    <audio src="${asset.preview_url}" controls style="width:90%;"></audio>
                </div>`;
        } else {
            container.innerHTML = `
                <div class="preview-doc-placeholder">
                    <i class="fa-solid ${asset.icon || 'fa-file'}"></i>
                    <h4>${escapeHtml(asset.original_name)}</h4>
                    <p style="font-size:13px;color:#94a3b8;margin-top:6px;">Direct in-browser preview not supported for this format.</p>
                </div>`;
        }

        // Fill metadata
        document.getElementById('previewModalTitle').innerHTML = `<i class="fa-solid ${asset.icon || 'fa-file'}"></i> ${escapeHtml(asset.title)}`;
        document.getElementById('previewAssetTitle').innerText = asset.title;
        document.getElementById('previewAssetCategory').innerText = asset.category;
        document.getElementById('previewAssetOriginalName').innerText = asset.original_name;
        document.getElementById('previewAssetSize').innerText = asset.size_formatted;
        document.getElementById('previewAssetMime').innerText = asset.mime_type;
        document.getElementById('previewAssetDownloads').innerText = asset.downloads_count;
        document.getElementById('previewAssetDate').innerText = new Date(asset.created_at).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        document.getElementById('previewAssetTags').innerText = asset.tags || 'None';
        document.getElementById('previewAssetDesc').innerText = asset.description || 'No description provided.';

        // Configure buttons
        const downloadBtn = document.getElementById('previewDownloadBtn');
        downloadBtn.href = asset.download_url;
        downloadBtn.download = asset.original_name;
        downloadBtn.onclick = () => {
            setTimeout(() => {
                document.getElementById('previewAssetDownloads').innerText = parseInt(document.getElementById('previewAssetDownloads').innerText, 10) + 1;
            }, 600);
        };

        const editBtn = document.getElementById('previewEditBtn');
        editBtn.onclick = () => {
            openAssetEdit(asset.id);
        };

        openModal('assetPreviewModal');
    } catch (err) {
        showToast('Error', 'Failed to load asset details: ' + err.message, 'error');
    }
}

/**
 * Open Asset Edit Modal
 */
async function openAssetEdit(assetId) {
    try {
        const [assetRes, catRes] = await Promise.all([
            fetch(`/api/assets/${assetId}`).then(r => r.json()),
            fetch('/api/categories').then(r => r.json())
        ]);

        if (!assetRes.success) {
            showToast('Error', 'Asset not found', 'error');
            return;
        }

        const asset = assetRes.data;
        document.getElementById('editAssetId').value = asset.id;
        document.getElementById('editAssetTitle').value = asset.title;
        document.getElementById('editAssetTags').value = asset.tags || '';
        document.getElementById('editAssetDesc').value = asset.description || '';

        // Populate Category select
        const catSelect = document.getElementById('editAssetCategory');
        if (catSelect && catRes.success) {
            catSelect.innerHTML = catRes.data.map(c => `
                <option value="${c.name}" ${c.name.toLowerCase() === asset.category.toLowerCase() ? 'selected' : ''}>
                    ${c.name}
                </option>
            `).join('');
        }

        openModal('assetEditModal');
    } catch (err) {
        showToast('Error', 'Could not open editor', 'error');
    }
}

/**
 * Trigger Confirm Delete Modal
 */
function confirmDeleteAsset(assetId) {
    document.getElementById('deleteTargetAssetId').value = assetId;
    openModal('confirmDeleteModal');
}

/**
 * String Helper: Escape HTML
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Relative time formatter helper
 */
function formatTimeAgo(isoString) {
    if (!isoString) return 'recently';
    const date = new Date(isoString);
    const now = new Date();
    const sec = Math.floor((now - date) / 1000);

    if (sec < 60) return 'Just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}