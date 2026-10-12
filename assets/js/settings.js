/**
 * System Settings & AI Configuration Controller
 */

async function initSettings() {
    setupThemeSettings();
    setupAiSettingsForm();
    setupSystemSettingsForm();
    await loadSettingsAndDiagnostics();
    await loadAiConfig();
}

/**
 * 1. Appearance & Theme Setup
 */
function setupThemeSettings() {
    const darkRadio = document.getElementById('themeRadioDark');
    const lightRadio = document.getElementById('themeRadioLight');
    const applyBtn = document.getElementById('applyThemeBtn');

    const currentTheme = localStorage.getItem('dam_theme') || 'dark';
    if (currentTheme === 'dark' && darkRadio) darkRadio.checked = true;
    if (currentTheme === 'light' && lightRadio) lightRadio.checked = true;

    if (applyBtn) {
        applyBtn.onclick = () => {
            const selected = document.querySelector('input[name="themeSelection"]:checked')?.value || 'dark';
            document.documentElement.setAttribute('data-theme', selected);
            localStorage.setItem('dam_theme', selected);

            // Sync topbar button icon
            const themeBtn = document.getElementById('themeToggleBtn');
            if (themeBtn) {
                const icon = themeBtn.querySelector('i');
                if (icon) icon.className = selected === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }

            showToast('Theme Updated', `Switched to ${selected === 'dark' ? 'Midnight Dark' : 'Studio Light'} mode.`, 'success');
        };
    }
}

/**
 * 2. AI Engine Preferences Form
 */
function setupAiSettingsForm() {
    const aiForm = document.getElementById('aiConfigForm');
    if (!aiForm) return;

    aiForm.onsubmit = async (e) => {
        e.preventDefault();
        const provider = document.getElementById('aiProviderSelect')?.value;
        const apiKey = document.getElementById('aiApiKeyInput')?.value;
        const smartTagging = document.getElementById('aiSmartTaggingToggle')?.checked;

        try {
            const res = await fetch('/api/ai/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    apiKey,
                    smartTaggingEnabled: smartTagging
                })
            });

            const json = await res.json();
            if (json.success) {
                showToast('AI Settings Saved', 'AI Engine configurations updated successfully.', 'success');
            } else {
                showToast('Save Failed', json.message || 'Error saving AI settings', 'error');
            }
        } catch (err) {
            showToast('Error', 'Could not reach server: ' + err.message, 'error');
        }
    };
}

async function loadAiConfig() {
    try {
        const res = await fetch('/api/ai/config');
        const json = await res.json();
        if (json.success && json.data) {
            const select = document.getElementById('aiProviderSelect');
            const toggle = document.getElementById('aiSmartTaggingToggle');
            if (select) select.value = json.data.provider || 'built-in';
            if (toggle) toggle.checked = json.data.smartTaggingEnabled !== false;
        }
    } catch (err) {
        console.warn('Could not load AI configuration:', err);
    }
}

/**
 * 3. System Storage & Quota Settings
 */
function setupSystemSettingsForm() {
    const form = document.getElementById('settingsForm');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const storageQuota = document.getElementById('settingStorageQuota').value;
        const maxUpload = document.getElementById('settingMaxUpload').value;
        const allowedExts = document.getElementById('settingAllowedExts').value.trim();
        const defaultCat = document.getElementById('settingDefaultCat').value;

        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storage_quota_gb: storageQuota,
                    max_upload_size_mb: maxUpload,
                    allowed_extensions: allowedExts,
                    default_category: defaultCat
                })
            });

            const json = await res.json();
            if (json.success) {
                showToast('Settings Saved', 'System storage configurations updated.', 'success');
            } else {
                showToast('Error', json.message || 'Could not save settings', 'error');
            }
        } catch (err) {
            showToast('Error', 'Server connection error: ' + err.message, 'error');
        }
    };
}

/**
 * 4. Fetch and render server diagnostics
 */
async function loadSettingsAndDiagnostics() {
    try {
        const [settingsRes, categoriesRes] = await Promise.all([
            fetch('/api/settings').then(r => r.json()),
            fetch('/api/categories').then(r => r.json())
        ]);

        if (settingsRes.success && settingsRes.data) {
            const { settings, diagnostics } = settingsRes.data;

            // Diagnostics values
            const nodeEl = document.getElementById('diagNodeVer');
            const platEl = document.getElementById('diagPlatform');
            const dbEl = document.getElementById('diagDbSize');
            const upEl = document.getElementById('diagUptime');
            const memEl = document.getElementById('diagMemory');

            if (nodeEl) nodeEl.innerText = diagnostics.node_version || '-';
            if (platEl) {
                platEl.innerText = diagnostics.platform || '-';
                platEl.title = diagnostics.platform || '';
            }
            if (dbEl) dbEl.innerText = diagnostics.database_size || '0 Bytes';
            if (upEl) {
                const mins = Math.floor((diagnostics.uptime_seconds || 0) / 60);
                const secs = (diagnostics.uptime_seconds || 0) % 60;
                upEl.innerText = `${mins}m ${secs}s`;
            }
            if (memEl) memEl.innerText = diagnostics.memory_heap_used || '-';

            // Populate Plugins Status
            if (settingsRes.data.plugins) {
                const p = settingsRes.data.plugins;
                const pDb = document.getElementById('pluginDbEngine');
                const pStorage = document.getElementById('pluginStorageEngine');
                const pSms = document.getElementById('pluginSmsEngine');
                const pDigi = document.getElementById('pluginDigiEngine');
                const pAi = document.getElementById('pluginAiEngine');

                if (pDb && p.database) pDb.innerText = `${p.database.engine} — ${p.database.detail}`;
                if (pStorage && p.storage) pStorage.innerText = `${p.storage.engine} — ${p.storage.detail}`;
                if (pSms && p.sms_auth) pSms.innerText = `${p.sms_auth.engine} — ${p.sms_auth.detail}`;
                if (pDigi && p.digilocker) pDigi.innerText = `${p.digilocker.engine} — ${p.digilocker.detail}`;
                if (pAi && p.ai_copilot) pAi.innerText = `${p.ai_copilot.engine} — ${p.ai_copilot.detail}`;
            }

            // Populate Form inputs
            const quotaInput = document.getElementById('settingStorageQuota');
            const maxInput = document.getElementById('settingMaxUpload');
            const extsInput = document.getElementById('settingAllowedExts');
            const catSelect = document.getElementById('settingDefaultCat');

            if (quotaInput) quotaInput.value = settings.storage_quota_gb || '20';
            if (maxInput) maxInput.value = settings.max_upload_size_mb || '100';
            if (extsInput) extsInput.value = settings.allowed_extensions || '';

            // Populate default category select
            if (catSelect && categoriesRes.success && categoriesRes.data) {
                const defCat = settings.default_category || 'Images';
                catSelect.innerHTML = categoriesRes.data.map(c => `
                    <option value="${escapeHtml(c.name)}" ${c.name.toLowerCase() === defCat.toLowerCase() ? 'selected' : ''}>
                        ${escapeHtml(c.name)}
                    </option>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }
}
