const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', '..', 'data');
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'dam.sqlite');
const db = new DatabaseSync(dbPath);

console.log('========================================================');
console.log('📦 Initializing & Verifying Digital Asset Management DB');
console.log(`📁 Database Location: ${dbPath}`);
console.log('========================================================\n');

// 1. Enable Foreign Keys & Performance PRAGMAs
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// 2. Create All Database Tables
db.exec(`
  -- Categories Table
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT 'fa-folder',
    color_class TEXT DEFAULT 'other-icon',
    created_at TEXT NOT NULL
  );

  -- Digital Assets Table
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Others',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    tags TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    downloads_count INTEGER DEFAULT 0
  );

  -- Activity Log Table
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    asset_id INTEGER DEFAULT NULL,
    details TEXT DEFAULT '',
    timestamp TEXT NOT NULL
  );

  -- User Profile Table
  CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    avatar_url TEXT NOT NULL,
    bio TEXT DEFAULT '',
    storage_limit_mb INTEGER DEFAULT 20480
  );

  -- System Configuration Table
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Mobile OTP Sessions Table
  CREATE TABLE IF NOT EXISTS otp_sessions (
    phone TEXT PRIMARY KEY,
    otp TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  -- DigiLocker Credentials & Issued Documents Table
  CREATE TABLE IF NOT EXISTS digilocker_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id TEXT UNIQUE,
    doc_type TEXT NOT NULL,
    doc_name TEXT NOT NULL,
    issuer TEXT NOT NULL,
    issue_date TEXT,
    uri TEXT,
    raw_data TEXT,
    verified INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );

  -- Trained Conversational Dataset Table
  CREATE TABLE IF NOT EXISTS chatbot_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_index INTEGER,
    question TEXT NOT NULL,
    question_clean TEXT NOT NULL,
    answer TEXT NOT NULL,
    tokens TEXT DEFAULT ''
  );
`);

// 3. Create Optimization Indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
  CREATE INDEX IF NOT EXISTS idx_assets_created ON assets(created_at);
  CREATE INDEX IF NOT EXISTS idx_assets_title ON assets(title);
  CREATE INDEX IF NOT EXISTS idx_activity_time ON activity_log(timestamp);
  CREATE INDEX IF NOT EXISTS idx_chat_qclean ON chatbot_conversations(question_clean);
  CREATE INDEX IF NOT EXISTS idx_chat_qorig ON chatbot_conversations(question);
`);

// 4. Seed Default Categories if empty
const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
if (catCount === 0) {
  const insertCat = db.prepare(`
    INSERT INTO categories (name, description, icon, color_class, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const defaultCats = [
    { name: 'Images', description: 'Photos, illustrations, banners and vector graphics', icon: 'fa-image', color_class: 'image-icon' },
    { name: 'Videos', description: 'Product teasers, demos, clips and HD recordings', icon: 'fa-video', color_class: 'video-icon' },
    { name: 'Documents', description: 'Reports, PDF presentations, spreadsheets and contracts', icon: 'fa-file-lines', color_class: 'document-icon' },
    { name: 'Projects', description: 'Design prototypes, UI kits, pitch decks and source bundles', icon: 'fa-diagram-project', color_class: 'project-icon' },
    { name: 'Certificates', description: 'Course completions, degrees, credentials and awards', icon: 'fa-certificate', color_class: 'certificate-icon' },
    { name: 'Others', description: 'Miscellaneous archives, logs, datasets and configs', icon: 'fa-folder', color_class: 'other-icon' }
  ];

  for (const cat of defaultCats) {
    insertCat.run(cat.name, cat.description, cat.icon, cat.color_class, new Date().toISOString());
  }
  console.log('✅ Seeded 6 Core Categories.');
}

// 5. Seed Default User Profile if empty
const profileCount = db.prepare('SELECT COUNT(*) as count FROM user_profile WHERE id = 1').get().count;
if (profileCount === 0) {
  db.prepare(`
    INSERT INTO user_profile (id, name, email, role, avatar_url, bio, storage_limit_mb)
    VALUES (1, 'Jayash', 'jayash@dam.system', 'Administrator', 'assets/images/user.png', 'Lead Digital Asset Administrator & Manager', 20480)
  `).run();
  console.log('✅ Seeded Default Administrator Profile (Jayash).');
}

// 6. Seed System Settings if empty
const settingsCount = db.prepare('SELECT COUNT(*) as count FROM system_settings').get().count;
if (settingsCount === 0) {
  const insertSetting = db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)');
  insertSetting.run('allowed_extensions', '.png,.jpg,.jpeg,.gif,.svg,.webp,.mp4,.webm,.mp3,.pdf,.docx,.xlsx,.pptx,.txt,.zip');
  insertSetting.run('max_upload_size_mb', '100');
  insertSetting.run('default_category', 'Images');
  insertSetting.run('system_name', 'Digital Asset Management');
  console.log('✅ Seeded System Settings.');
}

// 7. Seed Sample Digital Assets if library is empty
const assetCount = db.prepare('SELECT COUNT(*) as count FROM assets').get().count;
if (assetCount === 0) {
  const insertAsset = db.prepare(`
    INSERT INTO assets (title, filename, original_name, file_path, mime_type, file_type, category, size_bytes, tags, description, created_at, downloads_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sampleAssets = [
    {
      title: 'Enterprise Brand Identity Guide',
      filename: 'sample_brand_guide.pdf',
      original_name: 'Brand_Identity_2026.pdf',
      file_path: '/uploads/sample_brand_guide.pdf',
      mime_type: 'application/pdf',
      file_type: 'document',
      category: 'Projects',
      size_bytes: 4194304,
      tags: 'Branding, Guidelines, Identity, 2026',
      description: 'Official corporate branding guidelines and asset usage specifications.',
      downloads: 14
    },
    {
      title: 'Cloud Architecture Diagram',
      filename: 'sample_cloud_arch.svg',
      original_name: 'AWS_MultiRegion_Cloud.svg',
      file_path: '/uploads/sample_cloud_arch.svg',
      mime_type: 'image/svg+xml',
      file_type: 'image',
      category: 'Images',
      size_bytes: 524288,
      tags: 'Cloud, AWS, Architecture, Infrastructure',
      description: 'High-resolution scalable diagram of multi-region cloud deployment.',
      downloads: 28
    },
    {
      title: 'Q4 Performance & Revenue Report',
      filename: 'sample_financial_report.xlsx',
      original_name: 'Q4_Financial_Audit_2026.xlsx',
      file_path: '/uploads/sample_financial_report.xlsx',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      file_type: 'document',
      category: 'Documents',
      size_bytes: 2097152,
      tags: 'Finance, Report, Q4, Revenue, Audit',
      description: 'Quarterly financial performance, operational expenses, and forecast.',
      downloads: 9
    },
    {
      title: 'Advanced AI & Machine Learning Specialization',
      filename: 'sample_ai_certificate.png',
      original_name: 'AI_ML_Professional_Cert.png',
      file_path: '/uploads/sample_ai_certificate.png',
      mime_type: 'image/png',
      file_type: 'image',
      category: 'Certificates',
      size_bytes: 1572864,
      tags: 'Certificate, AI, Machine Learning, Verified, 2026',
      description: 'Professional accreditation in Machine Learning and Deep Neural Systems.',
      downloads: 5
    }
  ];

  for (const a of sampleAssets) {
    insertAsset.run(
      a.title, a.filename, a.original_name, a.file_path, a.mime_type,
      a.file_type, a.category, a.size_bytes, a.tags, a.description,
      new Date().toISOString(), a.downloads
    );
  }
  console.log(`✅ Seeded ${sampleAssets.length} Sample Digital Assets.`);
}

// 8. Trigger Chatbot Training & Verification
const { trainAndIndexChatbot, getDatasetStats } = require('../config/trainedChatbotEngine');
trainAndIndexChatbot();

// 9. Display Complete Database Summary
console.log('\n📊 DATABASE SUMMARY & HEALTH REPORT:');
console.log('--------------------------------------------------------');
const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();

for (const t of allTables) {
  const count = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get().c;
  console.log(` • Table: ${t.name.padEnd(25)} ➡️  ${count.toLocaleString()} rows`);
}

const stats = getDatasetStats();
console.log('--------------------------------------------------------');
console.log(`🤖 Chatbot Engine: ${stats.totalPairs.toLocaleString()} Dialogue Pairs active with ${stats.vocabularySize.toLocaleString()} Vocab Tokens.`);
console.log('🎉 Database is fully configured, indexed, and ready!\n');
