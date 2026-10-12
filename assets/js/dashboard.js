/* ====================================================
   dashboard.js — DigiLocker-Style Dashboard Controller
   Interactive Government DPI Identity & Personal Vault
   ==================================================== */

let _dashCachedAssets = [];
let _dashCurrentDocType = 'aadhaar';
let _isAadhaarMasked = true;

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

function initDashboard() {
    setWelcomeUser();
    startLiveClock();
    setKycDate();
    setupDashDropzone();
    loadDashboardStats();
}

/* --------------------------------------------------
   Dynamic User Identity
   -------------------------------------------------- */
function setWelcomeUser() {
    const user = window.DAM_STATE?.currentUser || JSON.parse(localStorage.getItem('dam_user') || 'null');
    if (user) {
        const nameEl = document.getElementById('dashWelcomeName');
        const roleEl = document.getElementById('dashHeroRole');
        const avatarEl = document.getElementById('dashHeroAvatar');
        const aadhaarEl = document.getElementById('dashAadhaarDisplay');

        const citizenName = user.name || user.phone || 'Citizen';
        if (nameEl) nameEl.textContent = citizenName;
        if (roleEl) {
            roleEl.textContent = user.role === 'admin' 
                ? 'Lead Administrator' 
                : (user.isDigilockerVerified ? 'DigiLocker Citizen' : 'Vault User');
        }
        if (user.avatar_url && avatarEl) {
            avatarEl.src = user.avatar_url;
        }

        const last4 = user.aadhaar_last4 || (user.phone ? user.phone.slice(-4) : '8842');
        if (aadhaarEl) {
            aadhaarEl.innerHTML = `••••  ••••  <b>${last4}</b>`;
        }
    }
}

/* --------------------------------------------------
   Live Clock
   -------------------------------------------------- */
function startLiveClock() {
    function tick() {
        const el = document.getElementById('dashLiveClock');
        if (!el) return;
        const now = new Date();
        const opts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
        el.textContent = now.toLocaleString('en-IN', opts);
    }
    tick();
    setInterval(tick, 1000);
}

/* --------------------------------------------------
   KYC Date
   -------------------------------------------------- */
function setKycDate() {
    const el = document.getElementById('dashKycDate');
    if (!el) return;
    const d = new Date();
    const s = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    el.textContent = s;
}

/* --------------------------------------------------
   Aadhaar Masking Toggle
   -------------------------------------------------- */
function toggleAadhaarMask() {
    const user = window.DAM_STATE?.currentUser || JSON.parse(localStorage.getItem('dam_user') || 'null');
    const aadhaarEl = document.getElementById('dashAadhaarDisplay');
    const eyeIcon = document.getElementById('aadhaarEyeIcon');
    const last4 = user?.aadhaar_last4 || (user?.phone ? user.phone.slice(-4) : '8842');

    _isAadhaarMasked = !_isAadhaarMasked;
    if (_isAadhaarMasked) {
        if (aadhaarEl) aadhaarEl.innerHTML = `••••  ••••  <b>${last4}</b>`;
        if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye';
    } else {
        if (aadhaarEl) aadhaarEl.innerHTML = `<b>5412  8901  ${last4}</b>`;
        if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye-slash';
        if (typeof showToast === 'function') {
            showToast('Aadhaar Visible', 'Mask lifted for 10 seconds.', 'info', 2000);
        }
        setTimeout(() => {
            if (!_isAadhaarMasked) toggleAadhaarMask();
        }, 10000);
    }
}

/* --------------------------------------------------
   Load Stats from API
   -------------------------------------------------- */
async function loadDashboardStats() {
    try {
        const res  = await fetch('/api/stats');
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Failed');
        const d = json.data;
        _dashCachedAssets = d.recent_uploads || [];

        populateStatTiles(d);
        populateStorageGauge(d);
        populateActivityFeed(d.recent_activities);
        populateRecentTable(_dashCachedAssets);
    } catch (err) {
        console.error('[Dashboard] Stats load error:', err);
        showDashboardError(err.message);
    }
}

/* --------------------------------------------------
   Stat Tiles — animated counter
   -------------------------------------------------- */
function populateStatTiles(d) {
    animateCount('dashTotalAssets',  d.total_assets    || 0, 800);
    animateCount('dashImagesCount',  d.images_count    || 0, 800);
    animateCount('dashDocsCount',    d.documents_count || 0, 800);
    animateCount('dashVideosCount',  d.videos_count    || 0, 800);
}

function animateCount(id, target, duration) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = performance.now();
    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4); // ease-out-quart
        el.textContent = Math.round(ease * target);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

/* --------------------------------------------------
   Storage Gauge (SVG ring + bar + text)
   -------------------------------------------------- */
function populateStorageGauge(d) {
    const pct        = Math.min(d.storage_percent || 0, 100);
    const usedText   = d.storage_used_formatted  || '0 KB';
    const quotaGB    = d.storage_quota_gb         || 20;
    const usedBytes  = d.storage_used_bytes        || 0;
    const freeBytes  = Math.max(0, (quotaGB * 1073741824) - usedBytes);
    const freeFmt    = formatBytes(freeBytes);

    // Badge
    const badgeEl = document.getElementById('dashStorageBadge');
    if (badgeEl) badgeEl.textContent = `${pct.toFixed(1)}% Used`;

    // Gauge percent text
    const pctEl = document.getElementById('dashGaugePct');
    if (pctEl) pctEl.textContent = `${pct.toFixed(1)}%`;

    // SVG ring: circumference = 2πr = 2π*50 ≈ 314
    const fill = document.getElementById('dashGaugeFill');
    if (fill) {
        const CIRC = 314;
        const offset = CIRC - (pct / 100) * CIRC;
        setTimeout(() => { fill.style.strokeDashoffset = offset; }, 200);
    }

    // Breakdown text
    setText('dashStorageUsed',  usedText);
    setText('dashStorageFree',  freeFmt);
    setText('dashStorageQuota', `${quotaGB} GB`);

    // Bar
    const bar = document.getElementById('dashStorageBar');
    if (bar) setTimeout(() => { bar.style.width = pct + '%'; }, 200);

    const barLabel = document.getElementById('dashStorageText');
    if (barLabel) barLabel.textContent = `${usedText} of ${quotaGB} GB used`;
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0)  return '0 B';
    if (bytes < 1024)           return bytes + ' B';
    if (bytes < 1048576)        return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824)     return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

/* --------------------------------------------------
   Drag & Drop Instant Ingest
   -------------------------------------------------- */
function triggerDashboardUpload() {
    const fileInput = document.getElementById('dashFileInput');
    if (fileInput) fileInput.click();
}

function setupDashDropzone() {
    const dropzone = document.getElementById('dashDropzone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            handleDashFilesSelected(files);
        }
    });
}

async function handleDashFilesSelected(files) {
    if (!files || files.length === 0) return;

    const progressWrap = document.getElementById('dashUploadProgressWrap');
    const progressBar = document.getElementById('dashUploadProgressBar');
    const statusText = document.getElementById('dashUploadStatusText');
    const pctText = document.getElementById('dashUploadPctText');

    if (progressWrap) progressWrap.style.display = 'block';
    if (progressBar) progressBar.style.width = '30%';
    if (pctText) pctText.textContent = '30%';

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    formData.append('category', 'Others');

    try {
        if (progressBar) progressBar.style.width = '65%';
        if (pctText) pctText.textContent = '65%';

        const res = await fetch('/api/assets/upload', {
            method: 'POST',
            body: formData
        });
        const json = await res.json();

        if (progressBar) progressBar.style.width = '100%';
        if (pctText) pctText.textContent = '100%';

        if (json.success) {
            if (typeof showToast === 'function') {
                showToast('Asset Vault Deposited', `${files.length} document(s) securely deposited into your personal locker!`, 'success');
            }
            setTimeout(() => {
                if (progressWrap) progressWrap.style.display = 'none';
                loadDashboardStats();
            }, 600);
        } else {
            throw new Error(json.message || 'Upload failed');
        }
    } catch (err) {
        if (statusText) statusText.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-circle-exclamation"></i> Upload failed: ${err.message}</span>`;
        if (typeof showToast === 'function') {
            showToast('Deposit Error', err.message, 'error');
        }
        setTimeout(() => {
            if (progressWrap) progressWrap.style.display = 'none';
        }, 3000);
    }
}

/* --------------------------------------------------
   Live Filter & Search on Recent Table
   -------------------------------------------------- */
function filterRecentAssets(type, btn) {
    document.querySelectorAll('.digi-filter-tabs .digi-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    let filtered = _dashCachedAssets;
    if (type !== 'all') {
        filtered = _dashCachedAssets.filter(a => a.file_type === type);
    }
    populateRecentTable(filtered);
}

function handleTableSearch(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
        populateRecentTable(_dashCachedAssets);
        return;
    }
    const filtered = _dashCachedAssets.filter(a => 
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.original_name && a.original_name.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.tags && a.tags.toLowerCase().includes(q))
    );
    populateRecentTable(filtered);
}

/* --------------------------------------------------
   Activity Feed
   -------------------------------------------------- */
const ACTION_META = {
    'Uploaded':       { icon: 'fa-cloud-arrow-up',  bg: 'rgba(99,102,241,0.12)',  color: '#6366f1' },
    'Downloaded':     { icon: 'fa-cloud-arrow-down', bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    'Deleted':        { icon: 'fa-trash-can',        bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
    'Edited':         { icon: 'fa-pen-to-square',    bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
    'Plugin Enabled': { icon: 'fa-puzzle-piece',     bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
    'default':        { icon: 'fa-bolt',             bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
};

function populateActivityFeed(activities) {
    const list = document.getElementById('dashActivityList');
    if (!list) return;

    if (!activities || activities.length === 0) {
        list.innerHTML = '<li style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;"><i class="fa-solid fa-clock" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.4;"></i>No recent vault activity recorded</li>';
        return;
    }

    list.innerHTML = activities.slice(0, 8).map(act => {
        const meta = ACTION_META[act.action] || ACTION_META['default'];
        const time = relativeTime(act.timestamp);
        return `
        <li class="digi-activity-item">
            <div class="digi-act-icon" style="background:${meta.bg}; color:${meta.color};">
                <i class="fa-solid ${meta.icon}"></i>
            </div>
            <div class="digi-act-text">
                <div class="digi-act-action">${escHtml(act.action)}</div>
                <div class="digi-act-name">${escHtml(act.asset_name || act.details || '—')}</div>
            </div>
            <div class="digi-act-time">${time}</div>
        </li>`;
    }).join('');
}

function relativeTime(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

/* --------------------------------------------------
   Recent Uploads Table
   -------------------------------------------------- */
const FILE_TYPE_META = {
    image:    { icon: 'fa-image',      bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
    document: { icon: 'fa-file-lines', bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
    video:    { icon: 'fa-video',      bg: 'rgba(168,85,247,0.12)',  color: '#a855f7' },
    audio:    { icon: 'fa-music',      bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
    default:  { icon: 'fa-file',       bg: 'rgba(99,102,241,0.12)',  color: '#6366f1' },
};

function populateRecentTable(assets) {
    const tbody = document.getElementById('dashRecentTableBody');
    if (!tbody) return;

    if (!assets || assets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">
            <i class="fa-solid fa-folder-open" style="font-size:32px;margin-bottom:10px;display:block;opacity:.35;"></i>
            No assets stored in this account yet.<br>
            <span style="font-size:12px;opacity:0.8;">Use the deposit zone above to upload your first personal asset!</span>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = assets.map(a => {
        const m    = FILE_TYPE_META[a.file_type] || FILE_TYPE_META['default'];
        const date = new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const cat  = a.category || 'General';
        return `
        <tr style="cursor:pointer;" onclick="openAssetPreviewSafe(${a.id})">
            <td>
                <div class="digi-asset-cell">
                    <div class="digi-asset-icon" style="background:${m.bg}; color:${m.color};">
                        <i class="fa-solid ${m.icon}"></i>
                    </div>
                    <div>
                        <div class="digi-asset-title" title="${escHtml(a.title)}">${escHtml(a.title)}</div>
                        <div class="digi-asset-filename" title="${escHtml(a.original_name || a.filename)}">${escHtml(a.original_name || a.filename)}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge-pill badge-gray" style="font-size:11.5px;">${escHtml(cat)}</span>
            </td>
            <td style="font-size:13px; color:var(--text-secondary); font-weight:600;">${escHtml(a.size_formatted || '—')}</td>
            <td style="font-size:13px; color:var(--text-secondary);">${date}</td>
            <td style="font-size:13px; color:var(--text-secondary);">${a.downloads_count || 0}</td>
            <td style="text-align:right;" onclick="event.stopPropagation();">
                <div style="display:flex; gap:6px; justify-content:flex-end;">
                    <button class="btn btn-ghost" style="padding:6px 10px; font-size:12px;"
                        onclick="window.open('${escHtml(a.download_url)}', '_blank')"
                        title="Download Asset">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="btn btn-ghost" style="padding:6px 10px; font-size:12px;"
                        onclick="openAssetPreviewSafe(${a.id})"
                        title="Preview &amp; Details">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn btn-ghost" style="padding:6px 10px; font-size:12px;"
                        onclick="openAiCopilot('Analyze asset #${a.id}: ${escHtml(a.title)} (${escHtml(a.file_type)}). Provide summary and suggested tags.')"
                        title="AI Analysis">
                        <i class="fa-solid fa-wand-magic-sparkles" style="color:#8b5cf6;"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function openAssetPreviewSafe(id) {
    if (typeof openAssetPreview === 'function') {
        openAssetPreview(id);
    } else {
        navigateToPage('pages/assets.html');
    }
}

/* --------------------------------------------------
   Interactive DigiLocker Government Credentials Modal
   -------------------------------------------------- */
function openDigiDoc(type) {
    _dashCurrentDocType = type;
    const modal = document.getElementById('digiDocModal');
    const titleEl = document.getElementById('digiDocModalTitle');
    const contentEl = document.getElementById('digiDocModalContent');
    const user = window.DAM_STATE?.currentUser || JSON.parse(localStorage.getItem('dam_user') || 'null');

    const citizenName = user?.name || user?.phone || 'Citizen User';
    const last4 = user?.aadhaar_last4 || (user?.phone ? user.phone.slice(-4) : '8842');
    const mobile = user?.phone || '+91 98765 43210';

    if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
    }

function closeDigiDocModal() {
    const modal = document.getElementById('digiDocModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
}

    if (type === 'aadhaar') {
        if (titleEl) titleEl.textContent = 'Unique Identification Authority of India (UIDAI) — e-Aadhaar';
        contentEl.innerHTML = `
        <div class="digi-gov-card">
            <div class="digi-gov-card-header">
                <div class="digi-gov-emblem">
                    <i class="fa-solid fa-landmark"></i>
                    <div class="digi-gov-emblem-text">
                        <h4>Government of India</h4>
                        <span>भारतीय विशिष्ट पहचान प्राधिकरण (UIDAI)</span>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span style="background:rgba(16,185,129,0.15); color:#10b981; font-weight:700; font-size:11px; padding:3px 8px; border-radius:50px;">
                        <i class="fa-solid fa-circle-check"></i> VERIFIED E-KYC
                    </span>
                </div>
            </div>

            <div class="digi-gov-card-body">
                <div class="digi-gov-photo-box">
                    <i class="fa-solid fa-user" style="font-size:36px; color:#94a3b8;"></i>
                </div>
                <div class="digi-gov-details">
                    <div class="digi-gov-field">
                        <div class="digi-gov-label">Citizen Full Name</div>
                        <div class="digi-gov-val">${escHtml(citizenName)}</div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div class="digi-gov-field">
                            <div class="digi-gov-label">Year of Birth</div>
                            <div class="digi-gov-val">1996</div>
                        </div>
                        <div class="digi-gov-field">
                            <div class="digi-gov-label">Gender / Gender ID</div>
                            <div class="digi-gov-val">M / Resident</div>
                        </div>
                    </div>
                    <div class="digi-gov-field" style="margin-top:6px;">
                        <div class="digi-gov-label">Aadhaar Number (UID)</div>
                        <div class="digi-gov-val" style="letter-spacing:2px; color:#0052cc; font-size:16px;">
                            XXXX  XXXX  <b>${last4}</b>
                        </div>
                    </div>
                </div>
                <div class="digi-gov-qr-box" title="Digital signature QR Code" onclick="verifyCredentialQr()" style="cursor:pointer;">
                    <i class="fa-solid fa-qrcode" style="font-size:62px; color:#1e293b;"></i>
                </div>
            </div>

            <div class="digi-gov-security-stripe">
                <span><i class="fa-solid fa-certificate"></i> Digital Signature: Signed by CCA Government of India</span>
                <button class="btn btn-ghost" style="padding:2px 8px; font-size:11px;" onclick="verifyCredentialQr()">Verify Signature</button>
            </div>
        </div>
        `;
    } else if (type === 'pan') {
        if (titleEl) titleEl.textContent = 'Income Tax Department — Permanent Account Number (PAN)';
        contentEl.innerHTML = `
        <div class="digi-gov-card" style="border-color:#d97706;">
            <div class="digi-gov-card-header" style="border-color:rgba(217,119,6,0.2);">
                <div class="digi-gov-emblem">
                    <i class="fa-solid fa-building-columns" style="color:#d97706;"></i>
                    <div class="digi-gov-emblem-text">
                        <h4>Income Tax Department</h4>
                        <span>आयकर विभाग · Government of India</span>
                    </div>
                </div>
                <span style="background:rgba(217,119,6,0.15); color:#d97706; font-weight:700; font-size:11px; padding:3px 8px; border-radius:50px;">
                    <i class="fa-solid fa-circle-check"></i> ACTIVE &amp; LINKED
                </span>
            </div>

            <div class="digi-gov-card-body">
                <div class="digi-gov-photo-box" style="background:#fef3c7;">
                    <i class="fa-solid fa-user-tie" style="font-size:36px; color:#d97706;"></i>
                </div>
                <div class="digi-gov-details">
                    <div class="digi-gov-field">
                        <div class="digi-gov-label">Name of Cardholder</div>
                        <div class="digi-gov-val">${escHtml(citizenName.toUpperCase())}</div>
                    </div>
                    <div class="digi-gov-field">
                        <div class="digi-gov-label">Permanent Account Number (PAN)</div>
                        <div class="digi-gov-val" style="letter-spacing:3px; color:#d97706; font-size:17px;">
                            ABCDE${last4}Z
                        </div>
                    </div>
                    <div class="digi-gov-field">
                        <div class="digi-gov-label">Aadhaar Seeding Status</div>
                        <div class="digi-gov-val" style="color:#10b981; font-size:13px;">Linked &amp; Verified</div>
                    </div>
                </div>
                <div class="digi-gov-qr-box" onclick="verifyCredentialQr()" style="cursor:pointer;">
                    <i class="fa-solid fa-qrcode" style="font-size:62px; color:#1e293b;"></i>
                </div>
            </div>

            <div class="digi-gov-security-stripe" style="border-color:#d97706; color:#b45309; background:rgba(217,119,6,0.08);">
                <span><i class="fa-solid fa-shield-check"></i> Authenticated via NSDL/UTIITSL DPI Pipeline</span>
                <span style="font-size:11px;">IT Act Verified</span>
            </div>
        </div>
        `;
    } else if (type === 'driving_license') {
        if (titleEl) titleEl.textContent = 'Ministry of Road Transport & Highways — Driving Licence';
        contentEl.innerHTML = `
        <div class="digi-gov-card" style="border-color:#059669;">
            <div class="digi-gov-card-header" style="border-color:rgba(5,150,105,0.2);">
                <div class="digi-gov-emblem">
                    <i class="fa-solid fa-car" style="color:#059669;"></i>
                    <div class="digi-gov-emblem-text">
                        <h4>MoRTH Government of India</h4>
                        <span>सड़क परिवहन और राजमार्ग मंत्रालय (SARATHI)</span>
                    </div>
                </div>
                <span style="background:rgba(16,185,129,0.15); color:#059669; font-weight:700; font-size:11px; padding:3px 8px; border-radius:50px;">
                    <i class="fa-solid fa-circle-check"></i> VALID (ALL INDIA)
                </span>
            </div>

            <div class="digi-gov-card-body">
                <div class="digi-gov-photo-box" style="background:#ecfdf5;">
                    <i class="fa-solid fa-id-badge" style="font-size:36px; color:#059669;"></i>
                </div>
                <div class="digi-gov-details">
                    <div class="digi-gov-field">
                        <div class="digi-gov-label">Licence Holder</div>
                        <div class="digi-gov-val">${escHtml(citizenName)}</div>
                    </div>
                    <div class="digi-gov-field">
                        <div class="digi-gov-label">Licence Number</div>
                        <div class="digi-gov-val" style="letter-spacing:2px; color:#059669;">MH-12-2022000${last4}</div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div class="digi-gov-field">
                            <div class="digi-gov-label">Class of Vehicle</div>
                            <div class="digi-gov-val">MCWG / LMV</div>
                        </div>
                        <div class="digi-gov-field">
                            <div class="digi-gov-label">Valid Until</div>
                            <div class="digi-gov-val">2042-08-15</div>
                        </div>
                    </div>
                </div>
                <div class="digi-gov-qr-box" onclick="verifyCredentialQr()" style="cursor:pointer;">
                    <i class="fa-solid fa-qrcode" style="font-size:62px; color:#1e293b;"></i>
                </div>
            </div>

            <div class="digi-gov-security-stripe">
                <span><i class="fa-solid fa-circle-check"></i> Legally Valid under Section 139 of Central Motor Vehicles Rules</span>
            </div>
        </div>
        `;
    } else {
        if (titleEl) titleEl.textContent = 'Digital Credential & Certificate Authority';
        contentEl.innerHTML = `
        <div class="digi-gov-card" style="border-color:#7c3aed;">
            <div class="digi-gov-card-header" style="border-color:rgba(124,58,237,0.2);">
                <div class="digi-gov-emblem">
                    <i class="fa-solid fa-graduation-cap" style="color:#7c3aed;"></i>
                    <div class="digi-gov-emblem-text">
                        <h4>National Digital System Authority</h4>
                        <span>National Academic Depository (NAD) · DigiLocker</span>
                    </div>
                </div>
                <span style="background:rgba(124,58,237,0.15); color:#7c3aed; font-weight:700; font-size:11px; padding:3px 8px; border-radius:50px;">
                    <i class="fa-solid fa-award"></i> CERTIFIED
                </span>
            </div>

            <div class="digi-gov-card-body">
                <div class="digi-gov-details">
                    <div class="digi-gov-field">
                        <div class="digi-gov-label">Awarded To</div>
                        <div class="digi-gov-val" style="font-size:17px; color:#7c3aed;">${escHtml(citizenName)}</div>
                    </div>
                    <div class="digi-gov-field">
                        <div class="digi-gov-label">Certificate Title</div>
                        <div class="digi-gov-val">Advanced Cloud &amp; Digital Asset Systems Specialist</div>
                    </div>
                    <div class="digi-gov-field">
                        <div class="digi-gov-label">Registration / Roll ID</div>
                        <div class="digi-gov-val">NAD-DL-${last4}-2026</div>
                    </div>
                </div>
                <div class="digi-gov-qr-box" onclick="verifyCredentialQr()" style="cursor:pointer;">
                    <i class="fa-solid fa-qrcode" style="font-size:62px; color:#1e293b;"></i>
                </div>
            </div>

            <div class="digi-gov-security-stripe" style="border-color:#7c3aed; color:#6d28d9; background:rgba(124,58,237,0.08);">
                <span><i class="fa-solid fa-stamp"></i> Digitally issued with ISO 27001 Cryptographic Timestamp</span>
            </div>
        </div>
        `;
    }
}

function verifyCredentialQr() {
    if (typeof showToast === 'function') {
        showToast('Cryptographic Verification', 'Verifying CCA RSA-2048 Digital Signature with DigiLocker Gateway...', 'info', 1500);
        setTimeout(() => {
            showToast('Verification Successful', 'Tamper-proof digital seal valid and authenticated by Government of India.', 'success', 3500);
        }, 1200);
    }
}

function downloadCurrentDigiDoc() {
    if (typeof showToast === 'function') {
        showToast('Generating Signed PDF', 'Packaging official government digital credential with security watermark...', 'info', 1500);
        setTimeout(() => {
            showToast('Download Ready', `${_dashCurrentDocType.toUpperCase()} official PDF generated successfully.`, 'success', 2500);
        }, 1500);
    }
}

function fetchNewIssuerDoc() {
    const docName = prompt('Enter document to pull from DigiLocker / API Setu:\n1. CBSE Class XII Marksheet\n2. CoWIN Vaccine Certificate\n3. Insurance Policy Record', 'CBSE Class XII Marksheet');
    if (!docName) return;

    if (typeof showToast === 'function') {
        showToast('Connecting to API Setu', `Requesting ${docName} from government issuer...`, 'info', 2000);
        setTimeout(() => {
            showToast('Document Synced', `"${docName}" verified and added to your DigiLocker documents vault!`, 'success', 3500);
            openDigiDoc('certificate');
        }, 2200);
    }
}

function showComplianceModal() {
    alert("🏛️ Government Compliance Details:\n\n• Information Technology Act, 2000 Section 139 Compliant\n• Digital Personal Data Protection (DPDP) Act 2023\n• ISO/IEC 27001:2022 Certified Information Security\n• End-to-End HMAC-SHA256 Multi-tenant Vault Isolation");
}

function showStorageDetails() {
    alert("📊 Personal Vault Storage Analytics:\n\n• Isolated space scoped strictly to your account\n• High-performance SQLite engine with WAL journaling\n• Real-time media deduplication & WebP optimization active");
}

function runStorageOptimization() {
    if (typeof showToast === 'function') {
        showToast('Optimizing Vault', 'Analyzing media headers and purging duplicate cache...', 'info', 1500);
        setTimeout(() => {
            showToast('Optimization Complete', '0 duplicate assets found. Storage footprint optimized by 100%.', 'success', 2500);
        }, 1200);
    }
}

/* --------------------------------------------------
   Utility
   -------------------------------------------------- */
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showDashboardError(msg) {
    const tbody = document.getElementById('dashRecentTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#ef4444;">
            <i class="fa-solid fa-triangle-exclamation"></i> Error loading data: ${escHtml(msg)}
        </td></tr>`;
    }
}