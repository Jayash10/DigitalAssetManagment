/**
 * Administrator Profile Page Controller
 */

async function initProfile() {
    const form = document.getElementById('profileEditForm');

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('profInputName').value.trim();
            const email = document.getElementById('profInputEmail').value.trim();
            const role = document.getElementById('profInputRole').value.trim();
            const bio = document.getElementById('profInputBio').value.trim();

            try {
                const res = await fetch('/api/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, role, bio })
                });

                const json = await res.json();
                if (json.success) {
                    showToast('Profile Updated', 'Your profile details have been saved!', 'success');
                    // Reload profile details
                    await loadProfileDetails();
                    // Update global topbar details
                    loadGlobalProfile();
                } else {
                    showToast('Update Failed', json.message || 'Error updating profile', 'error');
                }
            } catch (err) {
                showToast('Error', 'Server connection error: ' + err.message, 'error');
            }
        };
    }

    await loadProfileDetails();
    checkDigiLockerCallbackState();
}

/**
 * Checks for DigiLocker redirect return params in the URL
 */
function checkDigiLockerCallbackState() {
    const urlParams = new URLSearchParams(window.location.search);
    const digiStatus = urlParams.get('digilocker');
    const reason = urlParams.get('reason');
    const code = urlParams.get('code');

    const badgeEl = document.getElementById('digilockerStatusBadge');
    const alertEl = document.getElementById('digilockerSuccessAlert');
    const errEl = document.getElementById('digilockerProfileError');

    if (digiStatus === 'success') {
        if (badgeEl) {
            badgeEl.innerHTML = `<span class="badge-pill badge-green" style="font-size: 12px; background: rgba(16, 185, 129, 0.15); color: #10b981;"><i class="fa-solid fa-circle-check"></i> DigiLocker Verified</span>`;
        }
        if (alertEl) {
            alertEl.innerHTML = `<strong>Verification Successful!</strong> Your government credentials have been authenticated. (Auth Code: ${code || 'Validated'})`;
            alertEl.style.display = 'block';
        }
        if (typeof showToast === 'function') {
            showToast('DigiLocker Verified', 'Government identity authenticated successfully.', 'success');
        }
    } else if (digiStatus === 'error') {
        if (errEl) {
            errEl.innerHTML = `<strong>Verification Incomplete:</strong> ${reason || 'User consent not granted or session expired.'}`;
            errEl.style.display = 'block';
        }
        if (typeof showToast === 'function') {
            showToast('DigiLocker Incomplete', reason || 'Verification was not completed.', 'error');
        }
    }
}

/**
 * Fetch and populate profile information and activity feed
 */
async function loadProfileDetails() {
    try {
        const [profileRes, statsRes] = await Promise.all([
            fetch('/api/profile').then(r => r.json()),
            fetch('/api/stats').then(r => r.json())
        ]);

        if (profileRes.success && profileRes.data) {
            const p = profileRes.data;

            // Overview card
            const nameEl = document.getElementById('profileCardName');
            const emailEl = document.getElementById('profileCardEmail');
            const roleEl = document.getElementById('profileCardRole');
            const bioEl = document.getElementById('profileCardBio');
            const totalAssetsEl = document.getElementById('profileTotalAssets');
            const storageUsedEl = document.getElementById('profileStorageUsed');

            if (nameEl) nameEl.innerText = p.name;
            if (emailEl) emailEl.innerText = p.email;
            if (roleEl) roleEl.innerText = p.role;
            if (bioEl) bioEl.innerText = p.bio || 'Lead Digital Asset Administrator & Manager';
            if (totalAssetsEl) totalAssetsEl.innerText = p.total_assets || 0;
            if (storageUsedEl) storageUsedEl.innerText = p.storage_used_formatted || '0 MB';

            // Form inputs
            const inName = document.getElementById('profInputName');
            const inEmail = document.getElementById('profInputEmail');
            const inRole = document.getElementById('profInputRole');
            const inBio = document.getElementById('profInputBio');

            if (inName) inName.value = p.name || '';
            if (inEmail) inEmail.value = p.email || '';
            if (inRole) inRole.value = p.role || '';
            if (inBio) inBio.value = p.bio || '';
        }

        // Activity Timeline
        const activityList = document.getElementById('profileActivityList');
        if (activityList && statsRes.success && statsRes.data.recent_activities) {
            const acts = statsRes.data.recent_activities;
            if (acts.length === 0) {
                activityList.innerHTML = `<li style="color: #94a3b8; font-size: 13px; text-align: center; padding: 20px;">No recorded activities yet.</li>`;
                return;
            }

            activityList.innerHTML = acts.map(act => {
                let badgeClass = 'badge-blue';
                let icon = 'fa-upload';
                if (act.action === 'Deleted') { badgeClass = 'badge-orange'; icon = 'fa-trash'; }
                if (act.action === 'Edited') { badgeClass = 'badge-purple'; icon = 'fa-pen'; }
                if (act.action === 'Downloaded') { badgeClass = 'badge-green'; icon = 'fa-download'; }

                const time = formatTimeAgo(act.timestamp);

                return `
                    <li style="padding: 12px 14px; background: #f8fafc; border-radius: 10px; border: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="badge-pill ${badgeClass}" style="width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
                                <i class="fa-solid ${icon}" style="font-size: 12px;"></i>
                            </span>
                            <div>
                                <b style="font-size: 13.5px; color: #1e293b; display: block;">${escapeHtml(act.action)}: ${escapeHtml(act.asset_name)}</b>
                                ${act.details ? `<small style="color: #64748b; font-size: 11.5px;">${escapeHtml(act.details)}</small>` : ''}
                            </div>
                        </div>
                        <span style="font-size: 12px; color: #94a3b8; white-space: nowrap;">${time}</span>
                    </li>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Error loading profile details:', err);
    }
}
