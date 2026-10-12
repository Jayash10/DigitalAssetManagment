/**
 * Plugins & Integrations Controller
 * Manages SQLite plugins registry, live health checks, and custom connectors
 */

let ALL_PLUGINS = [];
let ACTIVE_CATEGORY_FILTER = 'ALL';

async function initPlugins() {
    const searchInput = document.getElementById('pluginSearchInput');
    const refreshBtn = document.getElementById('refreshPluginsBtn');
    const testAllBtn = document.getElementById('testAllPluginsBtn');
    const installBtn = document.getElementById('openInstallPluginModalBtn');
    const configForm = document.getElementById('pluginConfigForm');
    const installForm = document.getElementById('installPluginForm');

    // 1. Load initial plugins list from SQLite backend
    await loadPluginsList();

    // 2. Setup Category Tabs
    const tabs = document.querySelectorAll('#pluginCategoryTabs button[data-category]');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active-filter-tab'));
            tab.classList.add('active-filter-tab');
            ACTIVE_CATEGORY_FILTER = tab.dataset.category;
            renderPluginsGrid();
        };
    });

    // 3. Search Filter
    if (searchInput) {
        searchInput.oninput = () => {
            renderPluginsGrid();
        };
    }

    // 4. Refresh Button
    if (refreshBtn) {
        refreshBtn.onclick = async () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
            await loadPluginsList();
            showToast('Registry Refreshed', 'Plugin statuses updated from SQLite.', 'info');
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Refresh Status';
        };
    }

    // 5. Test All Plugins Button
    if (testAllBtn) {
        testAllBtn.onclick = async () => {
            await runTestAllPlugins();
        };
    }

    // 6. Install Custom Plugin Modal trigger
    if (installBtn) {
        installBtn.onclick = () => {
            const modal = document.getElementById('pluginInstallModal');
            if (modal) modal.classList.add('show');
        };
    }

    // 7. Save Config Form Submission
    if (configForm) {
        configForm.onsubmit = async (e) => {
            e.preventDefault();
            await savePluginConfig();
        };
    }

    // 8. Install Custom Plugin Form Submission
    if (installForm) {
        installForm.onsubmit = async (e) => {
            e.preventDefault();
            await submitInstallPlugin();
        };
    }
}

/**
 * Load plugins list and metrics from backend
 */
async function loadPluginsList() {
    try {
        const res = await fetch('/api/plugins');
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
            ALL_PLUGINS = data.data;

            // Update top metrics
            const totalEl = document.getElementById('metricTotalPlugins');
            const activeEl = document.getElementById('metricActivePlugins');
            const dbEngineEl = document.getElementById('metricDbEngine');
            const aiNodesEl = document.getElementById('metricAiNodes');

            const activeCount = ALL_PLUGINS.filter(p => p.enabled).length;

            if (totalEl) totalEl.innerText = ALL_PLUGINS.length;
            if (activeEl) activeEl.innerText = activeCount;
            if (dbEngineEl) dbEngineEl.innerText = data.database_type === 'PostgreSQL' ? 'PostgreSQL' : 'SQLite 3 (WAL)';
            if (aiNodesEl) aiNodesEl.innerText = '3,725 Nodes';

            renderPluginsGrid();
        } else {
            showToast('Error', data.message || 'Could not load plugins', 'error');
        }
    } catch (err) {
        console.error('Failed to load plugins:', err);
        showToast('Connection Error', 'Could not connect to SQLite plugins API: ' + err.message, 'error');
    }
}

/**
 * Render plugins grid with active search and category filters
 */
function renderPluginsGrid() {
    const grid = document.getElementById('pluginsGrid');
    if (!grid) return;

    const searchTerm = (document.getElementById('pluginSearchInput')?.value || '').toLowerCase().trim();

    const filtered = ALL_PLUGINS.filter(p => {
        // Category filter
        const matchesCategory = ACTIVE_CATEGORY_FILTER === 'ALL' ||
            p.category.toLowerCase().includes(ACTIVE_CATEGORY_FILTER.toLowerCase()) ||
            (ACTIVE_CATEGORY_FILTER === 'Media Processing' && (p.category.includes('Media') || p.category.includes('Integration')));

        // Search filter
        const matchesSearch = !searchTerm ||
            p.name.toLowerCase().includes(searchTerm) ||
            p.description.toLowerCase().includes(searchTerm) ||
            p.category.toLowerCase().includes(searchTerm) ||
            p.id.toLowerCase().includes(searchTerm);

        return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
                <i class="fa-solid fa-puzzle-piece" style="font-size: 38px; color: var(--text-muted); margin-bottom: 12px; opacity: 0.5;"></i>
                <h3 style="font-size: 16px; color: var(--text-primary); margin-bottom: 6px;">No plugins found</h3>
                <p style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 16px;">Try adjusting your search terms or filters.</p>
                <button class="btn btn-secondary" onclick="document.getElementById('pluginSearchInput').value=''; ACTIVE_CATEGORY_FILTER='ALL'; renderPluginsGrid();">
                    Clear Filters
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        // Category aesthetic styling
        let iconBg = 'rgba(99, 102, 241, 0.12)';
        let iconColor = 'var(--primary)';
        let catBadge = 'badge-blue';

        if (p.category.includes('Core') || p.category.includes('Database')) {
            iconBg = 'rgba(59, 130, 246, 0.12)';
            iconColor = '#3b82f6';
            catBadge = 'badge-blue';
        } else if (p.category.includes('Security') || p.category.includes('Auth')) {
            iconBg = 'rgba(16, 185, 129, 0.12)';
            iconColor = '#10b981';
            catBadge = 'badge-green';
        } else if (p.category.includes('AI') || p.category.includes('Intelligence')) {
            iconBg = 'rgba(168, 85, 247, 0.12)';
            iconColor = '#a855f7';
            catBadge = 'badge-purple';
        } else if (p.category.includes('Storage')) {
            iconBg = 'rgba(6, 182, 212, 0.12)';
            iconColor = '#06b6d4';
            catBadge = 'badge-blue';
        } else if (p.category.includes('Media')) {
            iconBg = 'rgba(245, 158, 11, 0.12)';
            iconColor = '#f59e0b';
            catBadge = 'badge-orange';
        }

        const isCore = ['sqlite_core', 'storage_connector', 'twilio_sms', 'digilocker_dpi', 'ai_copilot'].includes(p.id);

        return `
            <div class="plugin-card" id="card-${p.id}" style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); padding: 22px; box-shadow: var(--shadow-card); display: flex; flex-direction: column; justify-content: space-between; gap: 16px; transition: transform 0.2s, box-shadow 0.2s; position: relative;">
                <div>
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                        <div style="display: flex; align-items: center; gap: 14px;">
                            <div style="width: 48px; height: 48px; border-radius: 14px; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
                                <i class="fa-solid ${p.icon || 'fa-puzzle-piece'}"></i>
                            </div>
                            <div>
                                <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.25;">
                                    ${escapeHtml(p.name)}
                                </h3>
                                <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                                    <span style="font-size: 11px; font-weight: 600; color: var(--text-muted);">v${escapeHtml(p.version || '1.0.0')}</span>
                                    <span style="font-size: 11px; color: var(--text-muted);">&bull;</span>
                                    <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(p.author || 'DAM Studio')}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Toggle Switch -->
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="position: relative; display: inline-block; width: 44px; height: 24px; margin: 0; cursor: pointer;">
                                <input type="checkbox" id="toggle-${p.id}" ${p.enabled ? 'checked' : ''} onchange="togglePlugin('${p.id}')" style="opacity: 0; width: 0; height: 0;">
                                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${p.enabled ? 'var(--primary)' : 'var(--border-strong)'}; transition: .25s; border-radius: 24px;">
                                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${p.enabled ? '23px' : '3px'}; bottom: 3px; background-color: white; transition: .25s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <!-- Description -->
                    <p style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.5; margin: 0 0 14px 0; min-height: 42px;">
                        ${escapeHtml(p.description)}
                    </p>

                    <!-- Runtime Indicator -->
                    <div style="background: var(--bg-body); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-circle" style="font-size: 8px; color: ${p.enabled ? '#10b981' : '#94a3b8'};"></i>
                            ${escapeHtml(p.category)}
                        </span>
                        <span class="badge-pill ${p.enabled ? 'badge-green' : 'badge-gray'}" style="font-size: 11px;">
                            ${p.enabled ? (p.runtime?.detail || 'Active') : 'Disabled'}
                        </span>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 14px; gap: 8px;">
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary" onclick="testPluginDiagnostic('${p.id}', '${escapeHtml(p.name)}')" title="Run live ping diagnostic" style="padding: 6px 12px; font-size: 12.5px;">
                            <i class="fa-solid fa-heart-pulse" style="color: var(--danger);"></i> Test
                        </button>
                        <button class="btn btn-secondary" onclick="openPluginConfigModal('${p.id}')" title="Configure parameters" style="padding: 6px 12px; font-size: 12.5px;">
                            <i class="fa-solid fa-gear"></i> Configure
                        </button>
                    </div>

                    ${!isCore ? `
                        <button class="btn" onclick="uninstallPlugin('${p.id}', '${escapeHtml(p.name)}')" title="Uninstall plugin" style="padding: 6px 10px; font-size: 12.5px; color: var(--danger); background: transparent; border: 1px solid transparent;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : `
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Core Module</span>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Toggle plugin status (Enable / Disable)
 */
async function togglePlugin(pluginId) {
    const checkbox = document.getElementById(`toggle-${pluginId}`);
    try {
        const res = await fetch(`/api/plugins/${pluginId}/toggle`, {
            method: 'PUT'
        });
        const data = await res.json();

        if (data.success) {
            showToast('Plugin Updated', data.message, data.enabled ? 'success' : 'info');
            await loadPluginsList();
        } else {
            showToast('Action Failed', data.message || 'Could not update plugin status', 'error');
            if (checkbox) checkbox.checked = !checkbox.checked;
        }
    } catch (err) {
        showToast('Network Error', err.message, 'error');
        if (checkbox) checkbox.checked = !checkbox.checked;
    }
}

/**
 * Run live diagnostic test on a plugin
 */
async function testPluginDiagnostic(pluginId, pluginName) {
    const modal = document.getElementById('pluginTestModal');
    const titleEl = document.getElementById('testModalTitle');
    const bodyEl = document.getElementById('testModalBody');

    if (titleEl) titleEl.innerText = `Testing: ${pluginName}`;
    if (bodyEl) {
        bodyEl.innerHTML = `
            <div style="text-align: center; padding: 24px 10px;">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 32px; color: var(--primary); margin-bottom: 12px;"></i>
                <p style="color: var(--text-secondary); font-size: 13.5px;">Pinging plugin endpoint and validating SQLite schemas...</p>
            </div>
        `;
    }
    if (modal) modal.classList.add('show');

    try {
        const res = await fetch(`/api/plugins/${pluginId}/test`, { method: 'POST' });
        const data = await res.json();

        if (data.success && data.result) {
            const r = data.result;
            let detailsHtml = '';

            if (r.details) {
                detailsHtml = Object.entries(r.details).map(([key, val]) => `
                    <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-body); border-radius: var(--radius-sm); font-size: 12.5px;">
                        <b style="color: var(--text-secondary); text-transform: capitalize;">${key.replace(/_/g, ' ')}</b>
                        <span style="color: var(--text-primary); font-family: monospace;">${escapeHtml(String(val))}</span>
                    </div>
                `).join('');
            }

            bodyEl.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: var(--radius-md);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-circle-check" style="color: var(--success); font-size: 20px;"></i>
                        <div>
                            <b style="color: var(--text-primary); font-size: 14px;">${r.status}</b>
                            <div style="color: var(--text-secondary); font-size: 12px;">Response Time: <b>${r.latency_ms} ms</b></div>
                        </div>
                    </div>
                    <span class="badge-pill badge-green">Healthy</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                    <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Diagnostic Metrics:</div>
                    ${detailsHtml}
                </div>
            `;
        } else {
            bodyEl.innerHTML = `
                <div style="padding: 14px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md); color: var(--danger);">
                    <b>Test Failed</b>
                    <p style="margin-top: 4px; font-size: 13px;">${escapeHtml(data.message || 'Unknown diagnostic error')}</p>
                </div>
            `;
        }
    } catch (err) {
        bodyEl.innerHTML = `
            <div style="padding: 14px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md); color: var(--danger);">
                <b>Network Ping Failed</b>
                <p style="margin-top: 4px; font-size: 13px;">${escapeHtml(err.message)}</p>
            </div>
        `;
    }
}

/**
 * Run test across all installed plugins sequentially
 */
async function runTestAllPlugins() {
    showToast('Health Ping Started', 'Testing all installed ecosystem plugins...', 'info');

    let passed = 0;
    for (const p of ALL_PLUGINS) {
        try {
            const res = await fetch(`/api/plugins/${p.id}/test`, { method: 'POST' });
            const data = await res.json();
            if (data.success) passed++;
        } catch (_) {}
    }

    showToast(
        'Health Check Completed',
        `${passed} of ${ALL_PLUGINS.length} ecosystem plugins responsive and online.`,
        passed === ALL_PLUGINS.length ? 'success' : 'warning'
    );
}

/**
 * Open configuration modal for a plugin
 */
function openPluginConfigModal(pluginId) {
    const plugin = ALL_PLUGINS.find(p => p.id === pluginId);
    if (!plugin) return;

    const modal = document.getElementById('pluginConfigModal');
    const title = document.getElementById('configModalTitle');
    const subtitle = document.getElementById('configModalSubtitle');
    const idInput = document.getElementById('configPluginId');
    const jsonArea = document.getElementById('configJsonRaw');
    const fieldsContainer = document.getElementById('configFieldsContainer');

    if (idInput) idInput.value = plugin.id;
    if (title) title.innerText = `Configure: ${plugin.name}`;
    if (subtitle) subtitle.innerText = `Plugin Category: ${plugin.category} (v${plugin.version})`;

    const cfg = plugin.config || {};
    if (jsonArea) {
        jsonArea.value = JSON.stringify(cfg, null, 2);
    }

    // Dynamic field inputs for key settings
    if (fieldsContainer) {
        fieldsContainer.innerHTML = Object.entries(cfg).map(([key, val]) => {
            const isBool = typeof val === 'boolean';
            return `
                <div class="form-group">
                    <label style="font-size: 12.5px; font-weight: 600; color: var(--text-secondary); text-transform: capitalize; display: block; margin-bottom: 4px;">
                        ${key.replace(/_/g, ' ')}
                    </label>
                    ${isBool ? `
                        <select class="cfg-field" data-key="${key}" style="width: 100%; padding: 8px 12px; background: var(--bg-body); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); color: var(--text-primary);">
                            <option value="true" ${val ? 'selected' : ''}>Enabled (true)</option>
                            <option value="false" ${!val ? 'selected' : ''}>Disabled (false)</option>
                        </select>
                    ` : `
                        <input type="text" class="cfg-field" data-key="${key}" value="${escapeHtml(String(val))}" style="width: 100%; padding: 8px 12px; background: var(--bg-body); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); color: var(--text-primary);">
                    `}
                </div>
            `;
        }).join('');

        // Wire field inputs to sync with the JSON editor
        document.querySelectorAll('.cfg-field').forEach(input => {
            input.oninput = syncFieldsToJson;
            input.onchange = syncFieldsToJson;
        });
    }

    if (modal) modal.classList.add('show');
}

function syncFieldsToJson() {
    const jsonArea = document.getElementById('configJsonRaw');
    if (!jsonArea) return;

    let cfg = {};
    try {
        cfg = JSON.parse(jsonArea.value || '{}');
    } catch (_) {}

    document.querySelectorAll('.cfg-field').forEach(input => {
        const k = input.dataset.key;
        let v = input.value;
        if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (!isNaN(v) && v !== '') v = Number(v);
        cfg[k] = v;
    });

    jsonArea.value = JSON.stringify(cfg, null, 2);
}

/**
 * Save configuration to backend SQLite
 */
async function savePluginConfig() {
    const idInput = document.getElementById('configPluginId');
    const jsonArea = document.getElementById('configJsonRaw');
    const saveBtn = document.getElementById('savePluginConfigBtn');

    if (!idInput || !jsonArea) return;
    const pluginId = idInput.value;

    let parsedConfig = {};
    try {
        parsedConfig = JSON.parse(jsonArea.value);
    } catch (err) {
        showToast('JSON Syntax Error', 'Please check your configuration JSON syntax: ' + err.message, 'warning');
        return;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
        const res = await fetch(`/api/plugins/${pluginId}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: parsedConfig })
        });
        const data = await res.json();

        if (data.success) {
            showToast('Configuration Saved', data.message, 'success');
            closeModal('pluginConfigModal');
            await loadPluginsList();
        } else {
            showToast('Save Failed', data.message || 'Could not update configuration', 'error');
        }
    } catch (err) {
        showToast('Network Error', err.message, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Configuration';
        }
    }
}

/**
 * Submit Custom Plugin Installation
 */
async function submitInstallPlugin() {
    const id = document.getElementById('installPluginId')?.value.trim();
    const name = document.getElementById('installPluginName')?.value.trim();
    const category = document.getElementById('installPluginCategory')?.value;
    const icon = document.getElementById('installPluginIcon')?.value.trim();
    const description = document.getElementById('installPluginDesc')?.value.trim();
    const configRaw = document.getElementById('installPluginConfig')?.value.trim();
    const submitBtn = document.getElementById('submitInstallPluginBtn');

    if (!id || !name || !category) {
        showToast('Validation Error', 'ID, Name, and Category are required.', 'warning');
        return;
    }

    let configObj = {};
    try {
        if (configRaw) configObj = JSON.parse(configRaw);
    } catch (e) {
        showToast('Config Error', 'Invalid JSON in configuration field: ' + e.message, 'warning');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';
    }

    try {
        const res = await fetch('/api/plugins/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id,
                name,
                category,
                icon,
                description,
                config: configObj,
                version: '1.0.0',
                author: 'Custom'
            })
        });

        const data = await res.json();
        if (data.success) {
            showToast('Plugin Installed', data.message, 'success');
            document.getElementById('installPluginForm').reset();
            closeModal('pluginInstallModal');
            await loadPluginsList();
        } else {
            showToast('Installation Failed', data.message || 'Could not register plugin', 'error');
        }
    } catch (err) {
        showToast('Network Error', err.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-download"></i> Install & Activate';
        }
    }
}

/**
 * Uninstall custom plugin
 */
async function uninstallPlugin(pluginId, pluginName) {
    if (!confirm(`Are you sure you want to uninstall the plugin "${pluginName}"?`)) return;

    try {
        const res = await fetch(`/api/plugins/${pluginId}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            showToast('Plugin Uninstalled', data.message, 'info');
            await loadPluginsList();
        } else {
            showToast('Uninstall Failed', data.message || 'Could not uninstall plugin', 'error');
        }
    } catch (err) {
        showToast('Error', err.message, 'error');
    }
}

/**
 * Helper to escape HTML characters
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
