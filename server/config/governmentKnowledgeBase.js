/**
 * Indian Government APIs, Open Data Platforms & Digital Public Infrastructure (DPI)
 * Knowledge Base & Diagnostics Engine for AI Chatbot
 */

const GOVERNMENT_KNOWLEDGE_BASE = [
  // 0. GREETINGS & SELF-INTRODUCTION (HELP CENTER PERSONA)
  {
    id: 'help_center_greeting',
    keywords: ['hello', 'hi', 'hey', 'namaste', 'greetings', 'who are you', 'what is help center', 'help center', 'what can you do', 'good morning', 'good afternoon', 'good evening', 'help'],
    intent: 'Help Center Introduction & Capabilities',
    matchScore: 100,
    response: `hi how can i help you`,
    suggestions: ['DigiLocker OAuth 2.0 initiation', 'Query data.gov.in for Maharashtra', 'Troubleshoot 400 Bad Request', 'Fetch Aadhaar XML']
  },

  // 1. DIGILOCKER OAUTH 2.0 INITIATION
  {
    id: 'digilocker_initiate',
    keywords: ['digilocker initiate', 'digilocker oauth', 'digilocker login', 'digilocker connect', 'digilocker url', 'kwikid initiate', 'consent url', 'how to connect digilocker', 'initiate digilocker'],
    intent: 'DigiLocker OAuth 2.0 Authorization Initiation',
    matchScore: 90,
    response: `### 🔐 DigiLocker OAuth 2.0 Initiation Workflow

To initiate a DigiLocker verification session, send a \`POST\` request to generate the secure citizen consent redirection URL.

#### Endpoint & Headers:
\`\`\`http
POST https://verify.getkwikid.com/verification/v2/digilocker/initiate
Accept: application/json
Content-Type: application/json
Authorization: Bearer <KWIKID_AUTH_TOKEN>
\`\`\`

#### Request Payload:
\`\`\`json
{
  "redirect_url": "https://myapp.com/api/digilocker/callback"
}
\`\`\`

#### Success Response (200 OK):
\`\`\`json
{
  "redirection_url": "https://verify.getkwikid.com/verification/v2/digilocker/consent?session=..."
}
\`\`\`

#### Node.js / Express Example:
\`\`\`javascript
const response = await fetch('https://verify.getkwikid.com/verification/v2/digilocker/initiate', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${process.env.KWIKID_AUTH_TOKEN}\`
  },
  body: JSON.stringify({ redirect_url: process.env.CLIENT_CALLBACK_URL })
});
const data = await response.json();
if (response.ok) {
  // Redirect user to DigiLocker consent screen
  window.location.href = data.redirection_url;
}
\`\`\``,
    suggestions: ['How to fetch Aadhaar from DigiLocker?', 'Troubleshoot DigiLocker 400 Bad Request', 'Handle user consent declined']
  },

  // 2. DIGILOCKER DOCUMENT FETCH (AADHAAR, PAN, DL)
  {
    id: 'digilocker_fetch_docs',
    keywords: ['fetch aadhaar', 'fetch pan', 'digilocker documents', 'pull document', 'digilocker xml', 'aadhaar xml', 'driving license fetch', 'get aadhaar', 'get pan', 'download certificate'],
    intent: 'DigiLocker Document Retrieval',
    matchScore: 90,
    response: `### 📄 DigiLocker Document Fetch Workflow

Once the citizen completes authentication and grants consent, you can exchange the authorization token or transaction ID to pull digitally signed documents.

#### Supported Document Types:
• \`AADHAAR\`: e-KYC XML containing name, DOB, gender, photo, and masked Aadhaar.
• \`PAN\`: Digitally signed PAN verification record from NSDL / Income Tax.
• \`DRIVING_LICENSE\`: MoRTH driving license certificate.
• \`CLASS_X_MARKSHEET\` / \`CLASS_XII_MARKSHEET\`: CBSE / State board credentials.

#### cURL Request:
\`\`\`bash
curl -X POST https://verify.getkwikid.com/verification/v2/digilocker/fetch \\
  -H "Accept: application/json" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <KWIKID_AUTH_TOKEN>" \\
  -d '{
    "transaction_id": "txn_1728552000000",
    "document_type": "AADHAAR"
  }'
\`\`\`

#### Python Example:
\`\`\`python
import requests

url = "https://verify.getkwikid.com/verification/v2/digilocker/fetch"
headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_TOKEN}"
}
payload = {
    "transaction_id": "txn_1728552000000",
    "document_type": "AADHAAR"
}

res = requests.post(url, json=payload, headers=headers)
data = res.json()
print("Citizen Name:", data.get("name"))
print("Aadhaar Verified:", data.get("is_verified"))
\`\`\``,
    suggestions: ['DigiLocker OAuth 2.0 initiation', 'Troubleshoot aadhaar_not_linked', 'API Setu public services']
  },

  // 3. OPEN GOVERNMENT DATA (DATA.GOV.IN) API
  {
    id: 'datagov_api',
    keywords: ['data.gov.in', 'open data', 'ogd', 'government data api', 'resource api', 'filter maharashtra', 'nif data', 'national indicator', 'query data.gov.in', 'how to query data.gov.in'],
    intent: 'data.gov.in Open Data Query & Specifications',
    matchScore: 90,
    response: `### 🏛️ Open Government Data (data.gov.in) API Specifications

\`data.gov.in\` provides programmatic REST API access to public datasets published by Indian Ministries and Departments.

#### Base Query Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| \`api-key\` | String | Yes | Your registered API Key (Default test key: \`579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b\`) |
| \`format\` | String | No | Output format: \`json\`, \`xml\`, \`csv\` (Default: \`json\`) |
| \`limit\` | Integer | No | Records to return (Default: \`10\`, Max: \`100\`) |
| \`offset\` | Integer | No | Number of records to skip for pagination (Default: \`0\`) |
| \`filters[field]\` | String | No | Column filter criteria (e.g. \`filters[stateNameEnglish]=Maharashtra\`) |

#### cURL Query Example:
\`\`\`bash
curl -X GET "https://api.data.gov.in/resource/<RESOURCE_ID>?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b&format=json&limit=10&offset=0&filters[stateNameEnglish]=Maharashtra" \\
  -H "Accept: application/json"
\`\`\`

#### Node.js Fetch Query:
\`\`\`javascript
const resourceId = '9ef84268-d588-465a-a308-a864a43d0070';
const apiKey = process.env.DATAGOV_API_KEY || '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';

const url = new URL(\`https://api.data.gov.in/resource/\${resourceId}\`);
url.searchParams.append('api-key', apiKey);
url.searchParams.append('format', 'json');
url.searchParams.append('limit', '25');
url.searchParams.append('filters[stateNameEnglish]', 'Maharashtra');

const response = await fetch(url.toString(), {
  headers: { 'Accept': 'application/json' }
});
const data = await response.json();
console.log(\`Fetched \${data.records.length} records. Total available: \${data.total}\`);
\`\`\``,
    suggestions: ['Troubleshoot data.gov.in 403 error', 'How to paginate data.gov.in', 'API Setu Integration']
  },

  // 4. API SETU INTEGRATION
  {
    id: 'api_setu',
    keywords: ['api setu', 'apisetu', 'apisetu.gov.in', 'consent artefact', 'pki signature', 'public api setu', 'what is api setu'],
    intent: 'API Setu National Digital Architecture',
    matchScore: 90,
    response: `### 🌐 API Setu Integration Guide

**API Setu** (\`apisetu.gov.in\`) enables standardized, secure data exchange between Government entities and verified consumers.

#### Key Architectural Components:
1. **API Gateway**: Central gateway authenticating requests via API Keys and JWT tokens.
2. **Consent Manager**: Captures explicit user consent artefacts before sensitive personal records are shared.
3. **PKI Verification**: Verifies digital signatures on issued documents against official Government trust stores.

#### Standard Header Schema:
\`\`\`http
GET /api/v1/certificates/fetch HTTP/1.1
Host: apisetu.gov.in
Accept: application/json
X-APISETU-APIKEY: <CONSUMER_KEY>
X-APISETU-CLIENTID: <CONSUMER_CLIENT_ID>
Authorization: Bearer <SIGNED_JWT_CONSENT>
\`\`\``,
    suggestions: ['DigiLocker OAuth 2.0 initiation', 'data.gov.in API parameters', 'Error 403 troubleshooting']
  },

  // 5. DIAGNOSTICS: 400 BAD REQUEST
  {
    id: 'error_400_diagnostics',
    keywords: ['400 bad request', '400 error', 'bad request', 'invalid payload', 'invalid redirect_url', 'fix 400', 'why 400'],
    intent: 'HTTP 400 Bad Request Diagnostics',
    matchScore: 95,
    response: `### 🛠️ Troubleshooting: HTTP 400 Bad Request

#### 1. Cause of the Issue:
• **Missing Mandatory Field**: The request body is missing \`redirect_url\` or required filter parameters.
• **Redirect URI Mismatch**: The \`redirect_url\` supplied in the request body does not match the pre-registered callback whitelist in your API provider dashboard.
• **Invalid Content-Type**: Omitting \`Content-Type: application/json\` header or passing malformed JSON.

#### 2. Step-by-Step Fix:
1. Ensure the \`Content-Type\` and \`Accept\` headers are explicitly set to \`application/json\`.
2. Verify that your \`redirect_url\` exactly matches the domain registered in your developer portal.
3. Ensure the JSON payload is properly stringified.

#### 3. Corrected JSON Payload & Request:
\`\`\`bash
curl -X POST https://verify.getkwikid.com/verification/v2/digilocker/initiate \\
  -H "Accept: application/json" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -d '{
    "redirect_url": "https://myapp.com/api/digilocker/callback"
  }'
\`\`\``,
    suggestions: ['Troubleshoot 403 Forbidden', 'Troubleshoot 500 Server Error', 'DigiLocker initiation workflow']
  },

  // 6. DIAGNOSTICS: 403 FORBIDDEN & QUOTA
  {
    id: 'error_403_diagnostics',
    keywords: ['403 forbidden', '403 error', 'forbidden', 'invalid api key', 'quota exceeded', 'unauthorized access', 'fix 403', 'why 403'],
    intent: 'HTTP 403 Forbidden Diagnostics',
    matchScore: 95,
    response: `### 🛠️ Troubleshooting: HTTP 403 Forbidden

#### 1. Cause of the Issue:
• **Invalid / Expired API Key**: The Bearer token or \`api-key\` query parameter is incorrect, expired, or revoked.
• **Daily Query Quota Exceeded**: On \`data.gov.in\`, individual API keys have a daily rate limit.
• **IP Whitelisting Violation**: Production government APIs often enforce IP restriction for server-to-server calls.

#### 2. Step-by-Step Fix:
1. Check your \`.env\` file to verify that \`KWIKID_AUTH_TOKEN\` or \`DATAGOV_API_KEY\` is loaded without extra whitespace or quotes.
2. For \`data.gov.in\`, use the testing key \`579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b\` to verify if your primary key exceeded its quota.
3. Confirm that your outbound server IP is whitelisted in your provider security settings.

#### 3. Corrected cURL Example:
\`\`\`bash
# Test data.gov.in with valid testing key
curl -X GET "https://api.data.gov.in/resource/<RESOURCE_ID>?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b&format=json&limit=5"
\`\`\``,
    suggestions: ['Troubleshoot 400 Bad Request', 'Troubleshoot 504 Timeout', 'data.gov.in API parameters']
  },

  // 7. DIAGNOSTICS: 500 / 504 UPSTREAM GATEWAY TIMEOUT
  {
    id: 'error_500_504_diagnostics',
    keywords: ['500 internal server error', '500 error', '504 gateway timeout', '504 error', 'upstream timeout', 'gateway error', 'fix 500', 'fix 504'],
    intent: 'HTTP 500 / 504 Gateway Error Diagnostics',
    matchScore: 95,
    response: `### 🛠️ Troubleshooting: HTTP 500 / 504 Gateway Timeout

#### 1. Cause of the Issue:
• **Upstream UIDAI / Government Node Delay**: Peak traffic on central authentication nodes can cause response latency exceeding 10–15 seconds.
• **Server Network Timeout**: Your client application terminates the connection prematurely before the third-party provider responds.

#### 2. Step-by-Step Fix:
1. Implement a **15–30 second request timeout** with \`AbortController\` in Node.js.
2. Use an exponential backoff retry mechanism (max 2 retries) for transient 504 errors.
3. Display a graceful fallback notification to the user rather than crashing the interface.

#### 3. Corrected Node.js Implementation with Timeout:
\`\`\`javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

try {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
    body: JSON.stringify(payload),
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  return await response.json();
} catch (err) {
  clearTimeout(timeoutId);
  if (err.name === 'AbortError') {
    throw new Error('Upstream Government Gateway timed out. Please retry.');
  }
  throw err;
}
\`\`\``,
    suggestions: ['DigiLocker initiation workflow', 'Troubleshoot user_consent_not_given', 'API Setu architecture']
  },

  // 8. DIAGNOSTICS: USER_CONSENT_NOT_GIVEN & AADHAAR_NOT_LINKED
  {
    id: 'consent_and_aadhaar_errors',
    keywords: ['user_consent_not_given', 'aadhaar_not_linked', 'consent denied', 'aadhaar missing', 'consent error', 'consent issue'],
    intent: 'DigiLocker Consent & Aadhaar Diagnostics',
    matchScore: 95,
    response: `### 🛠️ Troubleshooting: DigiLocker Specific Consent Errors

#### 1. \`user_consent_not_given\`
• **Cause**: The citizen clicked "Deny" or closed the DigiLocker verification window before entering the OTP.
• **Fix**: Catch the \`error=user_consent_not_given\` parameter in your callback handler and inform the user that verification is required to access credentialed services.

#### 2. \`aadhaar_not_linked\`
• **Cause**: The user authenticated their DigiLocker account with username/password or mobile number, but has not linked their 12-digit Aadhaar UID.
• **Fix**: Instruct the user to log in at [digilocker.gov.in](https://digilocker.gov.in), navigate to *Profile > Link Aadhaar*, and complete OTP validation before attempting verification again.

#### Callback Handler Logic:
\`\`\`javascript
if (req.query.error === 'user_consent_not_given') {
  return res.redirect('/profile?status=denied&msg=Consent+was+declined.');
}
if (req.query.error === 'aadhaar_not_linked') {
  return res.redirect('/profile?status=error&msg=Please+link+Aadhaar+in+DigiLocker.');
}
\`\`\``,
    suggestions: ['DigiLocker OAuth 2.0 initiation', 'Fetch Aadhaar XML', 'Troubleshoot 400 Bad Request']
  },

  // 9. PROJECT RUN & LOGIN ASSISTANCE
  {
    id: 'login_and_run_project',
    keywords: ['how to login', 'otp login', 'login page', 'how to run', 'run project', 'start project', 'npm start', 'twilio sms'],
    intent: 'Project Execution & OTP Login Guide',
    matchScore: 90,
    response: `### 🚀 Login & Project Execution Guide

#### 1. Mobile + OTP Login Flow:
• Access the login interface at **[/login.html](http://localhost:3000/login.html)**.
• Enter any 10-digit Indian mobile number (e.g. \`9876543210\`).
• The OTP will be delivered via **Twilio SMS** (if configured in \`.env\`) or printed directly in your server terminal (\`🔑 OTP: 123456\`).

#### 2. Commands to Run:
\`\`\`bash
# Start server
npm start

# Development mode with live auto-reload
npm run dev
\`\`\``,
    suggestions: ['How do I upload an asset?', 'What categories are available?', 'How does AI auto-tagging work?']
  },

  // 10. UPLOAD AN ASSET
  {
    id: 'dam_upload_asset',
    keywords: ['upload', 'upload file', 'add file', 'add asset', 'how to upload', 'upload document', 'upload image', 'upload video', 'new asset', 'add new'],
    intent: 'Upload a Digital Asset to DAM',
    matchScore: 90,
    response: `### 📤 How to Upload an Asset

Uploading files to your Digital Asset Management system is simple:

#### Steps:
1. Click the **"Upload Asset"** button on the Dashboard or Assets Library page.
2. Drag & drop your file onto the upload zone, or click **Browse** to select a file.
3. Fill in the asset details:
   - **Title**: Give your asset a clear, descriptive name.
   - **Category**: Select from Images, Videos, Documents, Projects, Certificates, or Others.
   - **Tags**: Add relevant keywords (e.g. \`branding, logo, 2026\`).
   - **Description**: Optionally add a short description.
4. Click **✨ AI Auto-Tag** to let the AI automatically suggest a title, category, and tags.
5. Click **Upload** to save the asset to your library.

#### Supported File Types:
| Type | Extensions |
| :--- | :--- |
| Images | PNG, JPG, JPEG, SVG, WebP, GIF |
| Videos | MP4, MOV, AVI, WebM, MKV |
| Documents | PDF, DOCX, XLSX, PPTX, TXT, CSV, MD |
| Certificates | PNG, PDF (with "cert" or "diploma" in filename) |

> **Max file size**: Configurable in \`.env\` via \`MAX_FILE_SIZE_MB\` (default: 100MB).`,
    suggestions: ['How does AI auto-tagging work?', 'What categories are available?', 'How to search for an asset?']
  },

  // 11. CATEGORIES EXPLAINED
  {
    id: 'dam_categories',
    keywords: ['categories', 'category', 'what categories', 'list categories', 'images category', 'videos category', 'documents', 'projects', 'certificates', 'others'],
    intent: 'DAM Asset Categories Explained',
    matchScore: 90,
    response: `### 📂 Asset Categories in Your DAM

Your Digital Asset Management system organizes all assets into **6 smart categories**:

| Category | What it stores |
| :--- | :--- |
| 🖼️ **Images** | Photos, illustrations, graphics, logos, banners, icons |
| 🎥 **Videos** | MP4, MOV, AVI recordings, demos, tutorials |
| 📄 **Documents** | PDFs, Word docs, Excel sheets, reports, specs |
| 🗂️ **Projects** | Mockups, pitch decks, presentations, UI/UX designs |
| 🏆 **Certificates** | Diplomas, accreditations, course completions, badges |
| 📦 **Others** | Any file that doesn't fit the above categories |

#### How are categories assigned?
- **Automatically** by the AI Auto-Tag engine based on file extension and filename patterns.
- **Manually** by you during the upload or edit workflow.

You can filter and browse assets by category from the **Asset Library** or **Categories** page.`,
    suggestions: ['How to upload an asset?', 'How to search assets?', 'Show storage breakdown']
  },

  // 12. SEARCH & FIND ASSETS
  {
    id: 'dam_search',
    keywords: ['search', 'find asset', 'find file', 'search asset', 'look for', 'locate file', 'how to search', 'semantic search', 'find document', 'find image'],
    intent: 'Search & Find Assets in DAM',
    matchScore: 90,
    response: `### 🔍 How to Search for Assets

Your DAM has **3 powerful ways** to find any asset:

#### 1. Quick Search Bar (Top Navigation)
Type any keyword in the search bar at the top of the page. The system searches across:
- Asset **title** and **original filename**
- **Tags** and **description**
- **Category** and **file type**

#### 2. AI Semantic Search
Ask me in natural language! For example:
- *"Find my AWS certification"*
- *"Show me all presentation decks"*
- *"Find UI mockup files"*

The AI semantic engine understands synonyms and context — not just exact words.

#### 3. Category & Filter Browse
Navigate to the **Asset Library** and use the **Category filter** buttons to narrow down results. Sort by **newest**, **largest**, or **most downloaded**.`,
    suggestions: ['Show recent uploads', 'What categories exist?', 'How to download an asset?']
  },

  // 13. DOWNLOAD AN ASSET
  {
    id: 'dam_download',
    keywords: ['download', 'download asset', 'download file', 'how to download', 'get file', 'export asset'],
    intent: 'Download Assets from DAM',
    matchScore: 85,
    response: `### ⬇️ How to Download an Asset

#### From the Asset Library:
1. Find the asset using **Search** or **Category filters**.
2. Hover over the asset card — a **Download** button (⬇️) will appear.
3. Click **Download** — the file saves to your local Downloads folder.

#### From the Asset Detail View:
1. Click on any asset card to open its full detail panel.
2. Click the **"Download"** button in the action bar.

#### Via Direct URL:
\`\`\`
GET /api/assets/:id/download
\`\`\`

> Download counts are tracked automatically and visible in the asset's metadata panel.`,
    suggestions: ['How to upload an asset?', 'How to search assets?', 'Show recent uploads']
  },

  // 14. DELETE AN ASSET
  {
    id: 'dam_delete',
    keywords: ['delete', 'remove asset', 'delete file', 'how to delete', 'trash', 'remove file', 'delete image', 'delete document'],
    intent: 'Delete an Asset from DAM',
    matchScore: 85,
    response: `### 🗑️ How to Delete an Asset

#### Steps:
1. Open the **Asset Library** and locate the asset.
2. Hover over the asset card and click the **⋮ (More options)** menu, or open the asset detail view.
3. Click **"Delete Asset"** and confirm.

> ⚠️ **Warning**: Deletion is **permanent**. Both the database record and the physical file in \`/uploads/\` are removed. There is no recycle bin.

#### Via API:
\`\`\`bash
DELETE /api/assets/:id
Authorization: Required (must be logged in)
\`\`\``,
    suggestions: ['How to upload a new asset?', 'How to edit asset metadata?', 'Show storage breakdown']
  },

  // 15. EDIT METADATA
  {
    id: 'dam_edit_metadata',
    keywords: ['edit', 'edit asset', 'edit metadata', 'update title', 'change category', 'update tags', 'rename asset', 'modify', 'update description'],
    intent: 'Edit Asset Metadata in DAM',
    matchScore: 85,
    response: `### ✏️ How to Edit Asset Metadata

Update an asset's title, category, tags, and description at any time without re-uploading.

#### Steps:
1. Click on any asset card in the **Asset Library** to open its detail view.
2. Click the **"Edit Metadata"** button (pencil icon ✏️).
3. Modify: **Title**, **Category**, **Tags**, or **Description**.
4. Click **✨ AI Auto-Tag** to let the AI re-suggest better metadata.
5. Click **"Save Changes"** to apply.

> Changes are saved instantly to the database and reflected across all views.`,
    suggestions: ['How does AI auto-tagging work?', 'How to delete an asset?', 'How to search assets?']
  },

  // 16. AI AUTO-TAGGING
  {
    id: 'dam_auto_tagging',
    keywords: ['auto tag', 'auto tagging', 'ai tag', 'smart tag', 'generate tags', 'suggest tags', 'auto categorize', 'ai metadata', 'ai suggest'],
    intent: 'AI Auto-Tagging & Smart Metadata Generation',
    matchScore: 90,
    response: `### ✨ AI Auto-Tagging — How It Works

The **AI Smart Tagging Engine** automatically analyzes your file and generates professional metadata.

#### What it generates:
| Field | Example Output |
| :--- | :--- |
| **Title** | "Brand Identity Style Guide 2026" |
| **Category** | Projects |
| **Tags** | "Branding, Style Guide, Logo, Identity, Marketing, 2026" |
| **Description** | "Structured enterprise documentation detailing..." |

#### How to use it:
1. During **upload** or **metadata edit**, click the **✨ AI Auto-Tag** button.
2. The AI analyzes the **filename, extension, and content patterns**.
3. Review the suggestions and click **Accept** or manually adjust.

#### Powered by:
- **Built-in engine** (default): Pattern-matching — no API key needed.
- **Google Gemini** (optional): Vision-based analysis that reads actual file content.

> Enable Gemini in ⚙️ **AI Settings** → Set Provider to "Gemini" → Enter your API key.`,
    suggestions: ['How to upload an asset?', 'How to edit metadata?', 'What categories are available?']
  },

  // 17. STORAGE & QUOTA
  {
    id: 'dam_storage',
    keywords: ['storage', 'storage usage', 'disk space', 'quota', 'how much space', 'file size', 'total size', 'storage breakdown', 'space used'],
    intent: 'Storage Usage & Quota in DAM',
    matchScore: 90,
    response: `### 📊 Storage & Capacity Overview

Your DAM tracks total disk usage of all uploaded assets in real time.

#### Where to check:
- **Dashboard**: Top stats panel shows total assets and total storage used.
- **Ask me**: Type *"storage breakdown"* and I'll pull live data from your repository.

#### Storage tips:
• **Compress large videos** — MP4 H.264 at 1080p is optimal.
• **Convert PNGs** to WebP or SVG (up to 80% size reduction).
• **Delete unused assets** regularly.
• **Tag old assets** with \`archived\` for easy filtering.

> Upload directory path is configured in \`server/index.js\` and \`.env\` → \`UPLOADS_DIR\`.`,
    suggestions: ['How to delete an asset?', 'Show recent uploads', 'What categories exist?']
  },

  // 18. DASHBOARD OVERVIEW
  {
    id: 'dam_dashboard',
    keywords: ['dashboard', 'home page', 'overview', 'stats', 'statistics', 'how many assets', 'total assets', 'recent activity', 'activity log'],
    intent: 'DAM Dashboard Overview',
    matchScore: 85,
    response: `### 🏠 Dashboard Overview

The **Dashboard** is your command center for the entire DAM system.

#### Key Sections:

**📊 Stats Panel** — Total assets, storage used, downloads, active categories.

**🕒 Recent Activity Feed** — Chronological log of all uploads, downloads, edits, deletions, and AI generations.

**⚡ Quick Actions** — Upload asset, open AI Studio, browse library, open AI Copilot.

**📂 Category Breakdown** — Visual summary of assets per category.

> Navigate to **[Dashboard](http://localhost:3000)** to see all live data.`,
    suggestions: ['How to upload an asset?', 'Show storage usage', 'How to search assets?']
  },

  // 19. AI ASSET GENERATOR
  {
    id: 'dam_ai_generator',
    keywords: ['generate asset', 'create asset', 'ai studio', 'ai generate', 'make logo', 'generate svg', 'create image', 'text to asset', 'generate banner', 'generate vector'],
    intent: 'AI Asset Generator (Text-to-Asset Studio)',
    matchScore: 90,
    response: `### 🎨 AI Asset Generator — Text-to-Asset Studio

Generate professional **SVG vector assets** directly into your library using natural language prompts!

#### How to use:
1. Go to the **AI Studio** section (Dashboard or sidebar).
2. Enter a descriptive prompt:
   - *"Modern Cyber Security Shield"*
   - *"Cloud Infrastructure Architecture Badge"*
   - *"Executive Analytics Dashboard Gradient"*
3. Choose a **style** and **category**.
4. Click **"Generate Asset"**.

#### What gets created:
- A high-quality **SVG file** saved to \`/uploads/\`.
- Automatically cataloged with AI-generated title, tags, and description.
- Immediately visible in your **Asset Library**.`,
    suggestions: ['How to download a generated asset?', 'How to edit generated asset metadata?', 'What is AI auto-tagging?']
  }
];

/**
 * High-Accuracy Semantic Intent Matcher for Help Center
 * @param {string} userQuery 
 * @returns {{ match: Object|null, score: number }}
 */
function findBestKnowledgeMatch(userQuery) {
  if (!userQuery || typeof userQuery !== 'string') {
    return { match: null, score: 0 };
  }

  const query = userQuery.toLowerCase().trim();

  // 1. Direct regex match for conversational greetings
  if (/^(hi|hello|hey|heyy|namaste|greetings|help|who are you|what can you do|help center|good morning|good afternoon|good evening)[!.,? ]*$/.test(query)) {
    const greetingItem = GOVERNMENT_KNOWLEDGE_BASE.find(k => k.id === 'help_center_greeting');
    if (greetingItem) {
      return { match: greetingItem, score: 100 };
    }
  }

  const queryTokens = query.split(/[\s,?.!-]+/).filter(t => t.length > 1);

  let bestMatch = null;
  let highestScore = 0;

  for (const item of GOVERNMENT_KNOWLEDGE_BASE) {
    let score = 0;

    // Check exact keyword / phrase matches
    for (const kw of item.keywords) {
      if (query === kw) {
        score += 80;
      } else if (query.includes(kw)) {
        score += 45;
      }
      const kwTokens = kw.split(/\s+/);
      const matchedTokens = kwTokens.filter(t => queryTokens.includes(t));
      score += matchedTokens.length * 12;
    }

    // === Indian Gov API domain boosters ===
    if (query.includes('400') && item.id.includes('400')) score += 70;
    if (query.includes('403') && item.id.includes('403')) score += 70;
    if ((query.includes('500') || query.includes('504')) && item.id.includes('500')) score += 70;
    if (query.includes('aadhaar') && (item.id.includes('fetch') || item.id.includes('aadhaar') || item.id.includes('consent'))) score += 50;
    if (query.includes('pan') && item.id.includes('fetch')) score += 40;
    if (query.includes('digilocker') && item.id.includes('digilocker')) score += 35;
    if (query.includes('data.gov.in') && item.id.includes('datagov')) score += 60;
    if ((query.includes('login') || query.includes('otp')) && item.id.includes('login')) score += 50;
    if (query.includes('api setu') && item.id.includes('api_setu')) score += 60;
    if (query.includes('consent') && item.id.includes('consent')) score += 55;

    // === DAM-specific domain boosters ===
    if ((query.includes('upload') || query.includes('add file') || query.includes('add asset')) && item.id.includes('upload')) score += 70;
    if ((query.includes('categor') || query.includes('images') || query.includes('videos') || query.includes('documents')) && item.id.includes('categor')) score += 65;
    if ((query.includes('search') || query.includes('find') || query.includes('locate')) && item.id.includes('search')) score += 70;
    if ((query.includes('download') || query.includes('get file') || query.includes('export')) && item.id.includes('download')) score += 70;
    if ((query.includes('delete') || query.includes('remove') || query.includes('trash')) && item.id.includes('delete')) score += 70;
    if ((query.includes('edit') || query.includes('update') || query.includes('rename') || query.includes('metadata')) && item.id.includes('edit_metadata')) score += 65;
    if ((query.includes('auto tag') || query.includes('autotag') || query.includes('ai tag') || query.includes('smart tag')) && item.id.includes('tagging')) score += 70;
    if ((query.includes('storage') || query.includes('space') || query.includes('quota') || query.includes('disk')) && item.id.includes('storage')) score += 70;
    if ((query.includes('dashboard') || query.includes('overview') || query.includes('stats') || query.includes('activity')) && item.id.includes('dashboard')) score += 65;
    if ((query.includes('generate') || query.includes('create') || query.includes('ai studio') || query.includes('svg') || query.includes('vector')) && item.id.includes('generator')) score += 65;
    if (query.includes('run') && item.id.includes('login')) score += 50;

    if (score > highestScore && score >= 35) {
      highestScore = score;
      bestMatch = item;
    }
  }

  return { match: bestMatch, score: highestScore };
}

module.exports = {
  GOVERNMENT_KNOWLEDGE_BASE,
  findBestKnowledgeMatch
};
