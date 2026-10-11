/**
 * Asset Upload Controller
 */

let queuedFiles = [];

async function initUpload() {
    queuedFiles = [];

    // Load available categories into dropdown
    loadUploadCategories();

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const clearBtn = document.getElementById('clearFilesBtn');
    const uploadForm = document.getElementById('mainUploadForm');

    if (browseBtn && fileInput) {
        browseBtn.onclick = () => fileInput.click();
    }

    if (fileInput) {
        fileInput.onchange = (e) => {
            handleNewFiles(Array.from(e.target.files));
            fileInput.value = '';
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            queuedFiles = [];
            renderFilePreviews();
        };
    }

    if (dropZone) {
        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        };

        dropZone.ondragleave = () => {
            dropZone.classList.remove('dragover');
        };

        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files) {
                handleNewFiles(Array.from(e.dataTransfer.files));
            }
        };
    }

    if (uploadForm) {
        uploadForm.onsubmit = async (e) => {
            e.preventDefault();
            await executeUpload();
        };
    }

    renderFilePreviews();
}

/**
 * Fetch and populate categories dropdown in upload form
 */
async function loadUploadCategories() {
    try {
        const res = await fetch('/api/categories');
        const json = await res.json();
        const select = document.getElementById('uploadCategory');
        if (select && json.success && json.data) {
            select.innerHTML = json.data.map(cat => `
                <option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>
            `).join('');
        }
    } catch (err) {
        console.warn('Could not load categories for upload:', err);
    }
}

/**
 * Handle new files added to queue
 */
function handleNewFiles(files) {
    if (!files || files.length === 0) return;

    // Filter duplicate filenames
    files.forEach(newFile => {
        const exists = queuedFiles.some(f => f.name === newFile.name && f.size === newFile.size);
        if (!exists) {
            queuedFiles.push(newFile);
        }
    });

    // Auto-detect category from first file if category not changed
    if (queuedFiles.length > 0) {
        const first = queuedFiles[0];
        const select = document.getElementById('uploadCategory');
        if (select) {
            if (first.type.startsWith('image/')) select.value = 'Images';
            else if (first.type.startsWith('video/')) select.value = 'Videos';
            else if (first.type.includes('pdf') || first.type.includes('document')) select.value = 'Documents';
        }
    }

    renderFilePreviews();
}

/**
 * Render visual preview cards for queued files
 */
function renderFilePreviews() {
    const previewList = document.getElementById('previewList');
    const countEl = document.getElementById('selectedFilesCount');
    const clearBtn = document.getElementById('clearFilesBtn');
    if (!previewList) return;

    if (countEl) countEl.innerText = queuedFiles.length;
    if (clearBtn) clearBtn.style.display = queuedFiles.length > 0 ? 'inline-block' : 'none';

    if (queuedFiles.length === 0) {
        previewList.innerHTML = `
            <div class="empty" id="emptyPreviewNotice" style="grid-column: 1 / -1; width: 100%;">
                <i class="fa-solid fa-file-arrow-up" style="font-size: 24px; color: #cbd5e1; margin-bottom: 8px; display: block;"></i>
                No files queued yet. Drag files into the box above or click Browse.
            </div>
        `;
        return;
    }

    previewList.innerHTML = '';

    queuedFiles.forEach((file, index) => {
        const card = document.createElement('div');
        card.className = 'preview-card';
        card.style.position = 'relative';

        const ext = file.name.split('.').pop().toLowerCase();
        let icon = 'fa-file';
        let isImg = file.type.startsWith('image/');

        if (isImg) icon = 'fa-image';
        else if (file.type.startsWith('video/')) icon = 'fa-video';
        else if (file.type.startsWith('audio/')) icon = 'fa-headphones';
        else if (ext === 'pdf') icon = 'fa-file-pdf';
        else if (['zip', 'rar', 'tar'].includes(ext)) icon = 'fa-file-zipper';

        const sizeFormatted = (file.size / 1024 / 1024) >= 1
            ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
            : `${(file.size / 1024).toFixed(1)} KB`;

        let mediaThumb = `<i class="fa-solid ${icon}"></i>`;
        if (isImg) {
            const objectUrl = URL.createObjectURL(file);
            mediaThumb = `<img src="${objectUrl}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px;" alt="thumb">`;
        }

        card.innerHTML = `
            ${mediaThumb}
            <div style="flex: 1; min-width: 0;">
                <b style="display: block; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(file.name)}">
                    ${escapeHtml(file.name)}
                </b>
                <small style="color: #64748b;">${sizeFormatted}</small>
            </div>
            <button type="button" class="btn btn-secondary" style="padding: 4px 8px; border-radius: 50%; color: #ef4444; width: 28px; height: 28px;" title="Remove">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        card.querySelector('button').onclick = () => {
            queuedFiles.splice(index, 1);
            renderFilePreviews();
        };

        previewList.appendChild(card);
    });
}

/**
 * Execute Multipart Asset Upload
 */
async function executeUpload() {
    if (queuedFiles.length === 0) {
        showToast('No Files', 'Please select at least one file to upload.', 'warning');
        return;
    }

    const title = document.getElementById('uploadTitle').value.trim();
    const category = document.getElementById('uploadCategory').value;
    const tags = document.getElementById('uploadTags').value.trim();
    const description = document.getElementById('uploadDesc').value.trim();

    const submitBtn = document.getElementById('uploadSubmitBtn');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressFill = document.getElementById('uploadProgressFill');

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading Files...`;

    if (progressBar && progressFill) {
        progressBar.style.display = 'block';
        progressFill.style.width = '20%';
    }

    const formData = new FormData();
    queuedFiles.forEach(file => {
        formData.append('files', file);
    });

    if (title) formData.append('title', title);
    if (category) formData.append('category', category);
    if (tags) formData.append('tags', tags);
    if (description) formData.append('description', description);

    try {
        if (progressFill) progressFill.style.width = '60%';

        const response = await fetch('/api/assets/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (progressFill) progressFill.style.width = '100%';

        if (result.success) {
            showToast('Upload Successful!', `${result.data.length} asset(s) stored securely.`, 'success');
            queuedFiles = [];

            // Redirect to Assets gallery
            setTimeout(() => {
                navigateToPage('pages/assets.html');
            }, 600);
        } else {
            showToast('Upload Failed', result.message || 'Error occurred during upload.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Upload &amp; Store Assets`;
            if (progressBar) progressBar.style.display = 'none';
        }
    } catch (err) {
        showToast('Error', 'Server or connection error: ' + err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Upload &amp; Store Assets`;
        if (progressBar) progressBar.style.display = 'none';
    }
}