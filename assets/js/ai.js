/**
 * AI Suite Controller - DAM AI Copilot, Auto-Tagger & Text-to-Asset Studio
 */

// Initialize AI Suite when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupAiCopilot();
    setupAiStudio();
});

/**
 * 1. Setup AI Copilot Slide Drawer
 */
function setupAiCopilot() {
    const triggerBtn = document.getElementById('openAiCopilotBtn');
    const drawer = document.getElementById('aiCopilotDrawer');
    const overlay = document.getElementById('aiDrawerOverlay');
    const closeBtn = document.getElementById('closeAiCopilotBtn');
    const sendBtn = document.getElementById('aiSendBtn');
    const input = document.getElementById('aiChatInput');

    if (triggerBtn) {
        triggerBtn.addEventListener('click', openAiCopilot);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeAiCopilot);
    }

    if (overlay) {
        overlay.addEventListener('click', closeAiCopilot);
    }

    if (sendBtn && input) {
        sendBtn.addEventListener('click', () => sendAiMessage());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendAiMessage();
        });
    }

    // Setup initial chips
    setupAiChips();
}

function openAiCopilot(initialPrompt = '') {
    const drawer = document.getElementById('aiCopilotDrawer');
    const overlay = document.getElementById('aiDrawerOverlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('show');

    if (initialPrompt && typeof initialPrompt === 'string') {
        const input = document.getElementById('aiChatInput');
        if (input) {
            input.value = initialPrompt;
            sendAiMessage();
        }
    }
}

function closeAiCopilot() {
    const drawer = document.getElementById('aiCopilotDrawer');
    const overlay = document.getElementById('aiDrawerOverlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
}

/**
 * Handle sending a message to AI Copilot
 */
async function sendAiMessage(customPrompt = null) {
    const input = document.getElementById('aiChatInput');
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    const prompt = customPrompt || (input ? input.value.trim() : '');
    if (!prompt) return;

    // Clear input
    if (input) input.value = '';

    // Append User message
    appendChatBubble('user', prompt);

    // Append Thinking indicator
    const thinkingId = 'ai-thinking-' + Date.now();
    const thinkingEl = document.createElement('div');
    thinkingEl.className = 'ai-msg bot';
    thinkingEl.id = thinkingId;
    thinkingEl.innerHTML = `
        <div class="ai-msg-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
        <div class="ai-msg-bubble">
            <i class="fa-solid fa-circle-notch fa-spin" style="margin-right: 8px;"></i> Analyzing digital asset records...
        </div>
    `;
    container.appendChild(thinkingEl);
    container.scrollTop = container.scrollHeight;

    try {
        const res = await fetch('/api/ai/copilot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        const json = await res.json();
        const thinkingNode = document.getElementById(thinkingId);
        if (thinkingNode) thinkingNode.remove();

        if (json.success && json.data) {
            appendChatBubble('bot', json.data.reply);
            updateAiChips(json.data.suggestions);
        } else {
            appendChatBubble('bot', 'Sorry, I could not process that request: ' + (json.message || 'Server error'));
        }
    } catch (err) {
        const thinkingNode = document.getElementById(thinkingId);
        if (thinkingNode) thinkingNode.remove();
        appendChatBubble('bot', 'Network error connecting to AI Copilot: ' + err.message);
    }
}

/**
 * Append chat bubble to Copilot drawer
 */
function appendChatBubble(role, text) {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    const msg = document.createElement('div');
    msg.className = `ai-msg ${role}`;

    const icon = role === 'user' ? 'fa-user' : 'fa-wand-magic-sparkles';
    const formattedHtml = role === 'bot' ? formatAiMarkdown(text) : escapeHtml(text);

    msg.innerHTML = `
        <div class="ai-msg-avatar"><i class="fa-solid ${icon}"></i></div>
        <div class="ai-msg-bubble">${formattedHtml}</div>
    `;

    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

/**
 * Enhanced Markdown parser for Help Center & AI Copilot
 */
function formatAiMarkdown(text) {
    if (!text) return '';
    
    // Process fenced code blocks first
    let codeBlocks = [];
    let processed = text.replace(/```([a-zA-Z0-9]*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push({ lang: lang || 'code', code: escapeHtml(code.trim()) });
        return placeholder;
    });

    let html = escapeHtml(processed);
    
    // Headers
    html = html.replace(/^#### (.*$)/gim, '<h4 style="font-size:14px;font-weight:700;margin:10px 0 4px 0;color:var(--text-primary);">$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3 style="font-size:16px;font-weight:800;margin:12px 0 6px 0;color:var(--text-primary);">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="font-size:17px;font-weight:800;margin:14px 0 8px 0;color:var(--text-primary);">$1</h3>');
    
    // Bold & Italics
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,82,204,0.1);color:#0052cc;padding:2px 5px;border-radius:4px;font-size:12px;font-family:monospace;">$1</code>');

    // Bullet points
    html = html.replace(/^\• (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^[*-] (.*$)/gim, '<li>$1</li>');
    
    // Wrap lists
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul style="padding-left:18px;margin:6px 0;">$1</ul>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--primary);text-decoration:underline;">$1</a>');
    
    // Restore Code blocks
    codeBlocks.forEach((cb, idx) => {
        const blockHtml = `
            <div style="background:#0f172a;color:#e2e8f0;padding:12px 14px;border-radius:8px;font-family:Consolas,Monaco,monospace;font-size:12.5px;overflow-x:auto;margin:10px 0;border:1px solid #334155;line-height:1.45;">
                <div style="font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:700;margin-bottom:6px;letter-spacing:0.5px;">${cb.lang}</div>
                <pre style="margin:0;white-space:pre-wrap;word-break:break-word;"><code>${cb.code}</code></pre>
            </div>
        `;
        html = html.replace(`__CODE_BLOCK_${idx}__`, blockHtml);
    });

    // Newlines
    html = html.replace(/\n\n/g, '<br><br>');
    return html;
}

/**
 * Setup and update interactive AI chips
 */
function setupAiChips() {
    document.querySelectorAll('.ai-chip').forEach(chip => {
        chip.addEventListener('click', function () {
            const prompt = this.innerText.trim();
            if (prompt.includes('Open AI Studio')) {
                openAiStudio();
            } else {
                sendAiMessage(prompt);
            }
        });
    });
}

function updateAiChips(suggestions) {
    const container = document.getElementById('aiChipsContainer');
    if (!container || !suggestions || suggestions.length === 0) return;

    container.innerHTML = suggestions.map(s => `
        <button class="ai-chip" type="button">
            <i class="fa-solid fa-sparkles"></i> ${escapeHtml(s)}
        </button>
    `).join('');

    setupAiChips();
}

/**
 * 2. AI Auto-Tagger & Metadata Suggester for Upload Page
 */
window.aiAutoFillUpload = async function () {
    // Check if files exist in queue
    if (typeof queuedFiles === 'undefined' || queuedFiles.length === 0) {
        showToast('No Files Queued', 'Please drag & drop or browse files first so AI can analyze them.', 'warning');
        return;
    }

    const firstFile = queuedFiles[0];
    const button = document.getElementById('aiAutoFillBtn');
    const originalText = button ? button.innerHTML : '';

    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI Analyzing Asset...';
    }

    try {
        let base64Data = '';
        if (firstFile.type.startsWith('image/')) {
            // Read file as base64
            const reader = new FileReader();
            base64Data = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(firstFile);
            });
        }

        const res = await fetch('/api/ai/auto-tag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: firstFile.name,
                originalName: firstFile.name,
                mimeType: firstFile.type,
                fileData: base64Data
            })
        });

        const json = await res.json();
        if (json.success && json.data) {
            const { suggestedTitle, suggestedCategory, suggestedTags, suggestedDescription } = json.data;

            // Fill inputs
            const titleInput = document.getElementById('uploadTitle');
            const catSelect = document.getElementById('uploadCategory');
            const tagsInput = document.getElementById('uploadTags');
            const descInput = document.getElementById('uploadDesc');

            if (titleInput) titleInput.value = suggestedTitle;
            if (tagsInput) tagsInput.value = suggestedTags;
            if (descInput) descInput.value = suggestedDescription;

            if (catSelect) {
                for (let i = 0; i < catSelect.options.length; i++) {
                    if (catSelect.options[i].value.toLowerCase() === suggestedCategory.toLowerCase()) {
                        catSelect.selectedIndex = i;
                        break;
                    }
                }
            }

            showToast('✨ AI Auto-Filled!', 'Generated title, category, tags, and summary successfully.', 'success');
        } else {
            showToast('AI Suggestion Failed', json.message || 'Could not analyze file', 'error');
        }
    } catch (err) {
        showToast('Error', 'Failed to reach AI service: ' + err.message, 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
};

/**
 * 3. AI Metadata Enhancer for Edit Modal
 */
window.aiEnhanceEditModal = async function () {
    const titleInput = document.getElementById('editAssetTitle');
    const tagsInput = document.getElementById('editAssetTags');
    const descInput = document.getElementById('editAssetDesc');
    const catSelect = document.getElementById('editAssetCategory');

    const currentTitle = titleInput ? titleInput.value.trim() : '';
    if (!currentTitle) {
        showToast('Title Required', 'Enter an asset title for AI to enhance.', 'warning');
        return;
    }

    const btn = document.getElementById('aiEnhanceModalBtn');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enhancing...';

    try {
        const res = await fetch('/api/ai/auto-tag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentTitle })
        });

        const json = await res.json();
        if (json.success && json.data) {
            if (tagsInput && !tagsInput.value) tagsInput.value = json.data.suggestedTags;
            if (descInput) descInput.value = json.data.suggestedDescription;
            showToast('✨ Metadata Enhanced!', 'AI enriched asset tags and description.', 'success');
        }
    } catch (err) {
        showToast('Error', 'Could not enhance metadata: ' + err.message, 'error');
    } finally {
        if (btn) btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI Enhance';
    }
};

/**
 * 4. AI Text-to-Asset Studio
 */
function setupAiStudio() {
    const form = document.getElementById('aiStudioForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await executeAiAssetGenerate();
        });
    }

    // Preset chips
    document.querySelectorAll('.ai-studio-preset').forEach(preset => {
        preset.addEventListener('click', function () {
            const promptInput = document.getElementById('aiStudioPrompt');
            if (promptInput) {
                promptInput.value = this.innerText.trim();
            }
        });
    });
}

window.openAiStudio = function () {
    openModal('aiStudioModal');
};

async function executeAiAssetGenerate() {
    const promptInput = document.getElementById('aiStudioPrompt');
    const categorySelect = document.getElementById('aiStudioCategory');
    const submitBtn = document.getElementById('aiStudioSubmitBtn');
    const previewContainer = document.getElementById('aiStudioPreviewBox');

    const prompt = promptInput ? promptInput.value.trim() : '';
    if (!prompt) {
        showToast('Prompt Required', 'Please describe the asset you want the AI to generate.', 'warning');
        return;
    }

    const category = categorySelect ? categorySelect.value : 'Projects';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synthesizing Asset...';
    }

    if (previewContainer) {
        previewContainer.innerHTML = `
            <div style="text-align:center;padding:50px 20px;color:var(--text-secondary);">
                <i class="fa-solid fa-wand-magic-sparkles fa-spin" style="font-size:38px;color:var(--primary);margin-bottom:15px;display:block;"></i>
                <h4 style="color:var(--text-primary);margin-bottom:6px;">Synthesizing Scalable Digital Asset...</h4>
                <p style="font-size:13px;color:var(--text-muted);">Generating geometry, vibrant gradients, and metadata taxonomy...</p>
            </div>
        `;
    }

    try {
        const res = await fetch('/api/ai/generate-asset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, category })
        });

        const json = await res.json();
        if (json.success && json.data) {
            showToast('✨ Asset Generated!', json.message, 'success');

            if (previewContainer) {
                previewContainer.innerHTML = `
                    <div style="text-align:center;width:100%;">
                        <img src="${json.data.preview_url}?t=${Date.now()}" style="max-height:260px;width:100%;border-radius:var(--radius-md);object-fit:contain;background:#060911;border:1px solid var(--border-subtle);margin-bottom:15px;" alt="${escapeHtml(json.data.title)}">
                        <div style="display:flex;justify-content:center;gap:12px;">
                            <button class="btn btn-secondary" onclick="closeModal('aiStudioModal');navigateToPage('pages/assets.html');">
                                <i class="fa-solid fa-folder-open"></i> View in Library
                            </button>
                            <a class="btn btn-success" href="${json.data.preview_url}" download="${escapeHtml(json.data.title)}.svg">
                                <i class="fa-solid fa-download"></i> Download SVG
                            </a>
                        </div>
                    </div>
                `;
            }

            // Refresh current page if in assets or dashboard
            if (window.DAM_STATE && (window.DAM_STATE.currentPage.includes('assets') || window.DAM_STATE.currentPage.includes('dashboard'))) {
                dispatchPageInit(window.DAM_STATE.currentPage, window.DAM_STATE.currentRouteParams);
            }
        } else {
            showToast('Generation Failed', json.message || 'Could not generate asset', 'error');
        }
    } catch (err) {
        showToast('Error', 'Connection error: ' + err.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Asset';
        }
    }
}
