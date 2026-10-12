const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

// Ensure data and uploads directories exist locally
const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// -----------------------------------------------------------------------------
// Database Connection Layer (SQLite Primary Engine with PostgreSQL fallback)
// -----------------------------------------------------------------------------
const forceSqlite = process.env.DATABASE_TYPE === 'sqlite' || process.env.DB_ENGINE === 'sqlite';
const DATABASE_URL = process.env.DATABASE_URL;
const isPostgres = !forceSqlite && Boolean(DATABASE_URL && DATABASE_URL.startsWith('postgres'));

let pgPool = null;
let sqliteDb = null;

// Initialize Supabase Storage Client (if configured)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'dam-assets';

let supabaseClient = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log(`☁️  [Supabase Storage] Client initialized with bucket: "${SUPABASE_STORAGE_BUCKET}"`);
  } catch (err) {
    console.warn(`⚠️  [Supabase Storage] Initialization failed: ${err.message}`);
  }
}

// Helper to translate SQLite '?' placeholders to PostgreSQL '$1, $2, ...'
function convertPlaceholdersToPg(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

// Normalized async DB wrapper
const db = {
  isPostgres,

  async query(sql, params = []) {
    if (isPostgres) {
      const pgSql = convertPlaceholdersToPg(sql);
      const res = await pgPool.query(pgSql, params);
      return res;
    } else {
      // SQLite synchronous execution wrapped in promise
      const stmt = sqliteDb.prepare(sql);
      const rows = stmt.all(...params);
      return { rows, rowCount: rows.length };
    }
  },

  async get(sql, params = []) {
    if (isPostgres) {
      const pgSql = convertPlaceholdersToPg(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows[0] || null;
    } else {
      const stmt = sqliteDb.prepare(sql);
      const row = stmt.get(...params);
      return row || null;
    }
  },

  async all(sql, params = []) {
    if (isPostgres) {
      const pgSql = convertPlaceholdersToPg(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows;
    } else {
      const stmt = sqliteDb.prepare(sql);
      return stmt.all(...params);
    }
  },

  async run(sql, params = []) {
    if (isPostgres) {
      // In Postgres, append RETURNING id for INSERTs if not already present
      let pgSql = sql;
      if (/^\s*INSERT\s+INTO/i.test(sql) && !/RETURNING/i.test(sql)) {
        pgSql += ' RETURNING id';
      }
      pgSql = convertPlaceholdersToPg(pgSql);
      const res = await pgPool.query(pgSql, params);
      const lastId = res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : null;
      return {
        changes: res.rowCount,
        lastInsertRowid: lastId,
        rowCount: res.rowCount
      };
    } else {
      const stmt = sqliteDb.prepare(sql);
      const res = stmt.run(...params);
      return {
        changes: res.changes,
        lastInsertRowid: res.lastInsertRowid,
        rowCount: res.changes
      };
    }
  },

  async exec(sql) {
    if (isPostgres) {
      return await pgPool.query(sql);
    } else {
      return sqliteDb.exec(sql);
    }
  },

  // Backwards-compatible prepare method for routes migrating to async
  prepare(sql) {
    return {
      get: (...params) => db.get(sql, params),
      all: (...params) => db.all(sql, params),
      run: (...params) => db.run(sql, params)
    };
  }
};

// Initialize the active database driver
if (isPostgres) {
  console.log('🐘 [Database] Connecting to PostgreSQL (Supabase)...');
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pgPool.on('error', (err) => {
    console.error('❌ [PostgreSQL Pool Error]:', err.message);
  });
} else {
  console.log('📦 [Database] Running on local SQLite engine.');
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = process.env.SQLITE_DB_PATH ? path.resolve(process.env.SQLITE_DB_PATH) : path.join(dataDir, 'dam.sqlite');
  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
}

// Initialize tables across both engines
async function initTables() {
  if (isPostgres) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        name TEXT DEFAULT 'User',
        role TEXT DEFAULT 'user',
        avatar_url TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        icon TEXT DEFAULT 'fa-folder',
        color_class TEXT DEFAULT 'other-icon',
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_unique ON categories (LOWER(name));

      CREATE TABLE IF NOT EXISTS assets (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        title TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_type TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Others',
        size_bytes BIGINT NOT NULL DEFAULT 0,
        tags TEXT DEFAULT '',
        description TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        downloads_count BIGINT DEFAULT 0,
        user_id BIGINT DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        action TEXT NOT NULL,
        asset_name TEXT NOT NULL,
        details TEXT DEFAULT '',
        timestamp TEXT NOT NULL,
        user_id BIGINT DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        avatar_url TEXT NOT NULL,
        bio TEXT DEFAULT '',
        storage_limit_mb INTEGER DEFAULT 20480
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS otp_sessions (
        phone TEXT PRIMARY KEY,
        otp TEXT NOT NULL,
        expires_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plugins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT NOT NULL,
        icon TEXT DEFAULT 'fa-puzzle-piece',
        version TEXT DEFAULT '1.0.0',
        author TEXT DEFAULT 'DAM Studio',
        enabled INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'Active',
        config TEXT DEFAULT '{}',
        installed_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  } else {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        name TEXT DEFAULT 'User',
        role TEXT DEFAULT 'user',
        avatar_url TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        description TEXT DEFAULT '',
        icon TEXT DEFAULT 'fa-folder',
        color_class TEXT DEFAULT 'other-icon',
        created_at TEXT NOT NULL
      );

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
        downloads_count INTEGER DEFAULT 0,
        user_id INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        asset_name TEXT NOT NULL,
        details TEXT DEFAULT '',
        timestamp TEXT NOT NULL,
        user_id INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        avatar_url TEXT NOT NULL,
        bio TEXT DEFAULT '',
        storage_limit_mb INTEGER DEFAULT 20480
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS otp_sessions (
        phone TEXT PRIMARY KEY,
        otp TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plugins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT NOT NULL,
        icon TEXT DEFAULT 'fa-puzzle-piece',
        version TEXT DEFAULT '1.0.0',
        author TEXT DEFAULT 'DAM Studio',
        enabled INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'Active',
        config TEXT DEFAULT '{}',
        installed_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Safe ALTER TABLE migrations for existing databases
    const alterMigrations = [
      `ALTER TABLE assets ADD COLUMN user_id INTEGER DEFAULT 1`,
      `ALTER TABLE activity_log ADD COLUMN user_id INTEGER DEFAULT 1`,
      `ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN is_digilocker INTEGER DEFAULT 0`
    ];
    for (const sql of alterMigrations) {
      try { sqliteDb.exec(sql); } catch (e) { /* column already exists — ignore */ }
    }

    // Ensure default admin user exists so existing assets (user_id=1) still resolve
    sqliteDb.prepare(`INSERT OR IGNORE INTO users (id, phone, name, role) VALUES (1, 'admin', 'Administrator', 'admin')`).run();
  }

  await seedDefaults();
}

// Helper to determine file_type from mime_type or extension
function getFileType(mimeType, ext) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType.includes('sheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('text') ||
    ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt', '.md', '.csv'].includes(ext)
  ) {
    return 'document';
  }
  return 'other';
}

// Helper to log activities asynchronously
async function logActivity(action, assetName, details = '', userId = 1) {
  try {
    await db.run(
      'INSERT INTO activity_log (action, asset_name, details, timestamp, user_id) VALUES (?, ?, ?, ?, ?)',
      [action, assetName, details, new Date().toISOString(), userId || 1]
    );
  } catch (err) {
    console.error('Error logging activity:', err.message);
  }
}

// -----------------------------------------------------------------------------
// Cloud Storage Helper (Supabase Storage with local fallback)
// -----------------------------------------------------------------------------
async function uploadToStorage(buffer, filename, mimeType) {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(filename, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (error) {
        throw error;
      }

      const { data: publicData } = supabaseClient.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(filename);

      return {
        path: publicData.publicUrl,
        isCloud: true
      };
    } catch (err) {
      console.warn(`⚠️  [Supabase Storage] Cloud upload failed, falling back to disk: ${err.message}`);
    }
  }

  // Fallback: Local disk storage
  const diskPath = path.join(uploadsDir, filename);
  fs.writeFileSync(diskPath, buffer);
  return {
    path: `/uploads/${filename}`,
    isCloud: false
  };
}

async function deleteFromStorage(filename) {
  if (supabaseClient) {
    try {
      await supabaseClient.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .remove([filename]);
    } catch (err) {
      console.warn(`⚠️  [Supabase Storage] Cloud deletion warning: ${err.message}`);
    }
  }

  const diskPath = path.join(uploadsDir, filename);
  if (fs.existsSync(diskPath)) {
    try {
      fs.unlinkSync(diskPath);
    } catch (_) {}
  }
}

// Seed default data if empty
async function seedDefaults() {
  try {
    // Check categories count
    const catCount = await db.get('SELECT COUNT(*) as count FROM categories');
    if (parseInt(catCount?.count || 0, 10) === 0) {
      const defaultCats = [
        { name: 'Images', description: 'Photos, illustrations, banners and graphics', icon: 'fa-image', color_class: 'image-icon' },
        { name: 'Videos', description: 'Product teasers, demos, clips and tutorials', icon: 'fa-video', color_class: 'video-icon' },
        { name: 'Documents', description: 'Reports, PDF presentations and spreadsheets', icon: 'fa-file-lines', color_class: 'document-icon' },
        { name: 'Projects', description: 'Design prototypes, UI kits and source bundles', icon: 'fa-diagram-project', color_class: 'project-icon' },
        { name: 'Certificates', description: 'Course completions, awards and credentials', icon: 'fa-certificate', color_class: 'certificate-icon' },
        { name: 'Others', description: 'Miscellaneous archives, logs and configs', icon: 'fa-folder', color_class: 'other-icon' }
      ];

      for (const cat of defaultCats) {
        await db.run(
          'INSERT INTO categories (name, description, icon, color_class, created_at) VALUES (?, ?, ?, ?, ?)',
          [cat.name, cat.description, cat.icon, cat.color_class, new Date().toISOString()]
        );
      }
    }

    // Check user profile
    const profileCount = await db.get('SELECT COUNT(*) as count FROM user_profile WHERE id = 1');
    if (parseInt(profileCount?.count || 0, 10) === 0) {
      await db.run(
        'INSERT INTO user_profile (id, name, email, role, avatar_url, bio, storage_limit_mb) VALUES (1, ?, ?, ?, ?, ?, ?)',
        ['Jayash', 'jayash@dam.system', 'Administrator', 'assets/images/user.png', 'Lead Digital Asset Administrator & Manager', 20480]
      );
    }

    // Check settings
    const settingsCount = await db.get('SELECT COUNT(*) as count FROM system_settings');
    if (parseInt(settingsCount?.count || 0, 10) === 0) {
      const defaults = [
        ['allowed_extensions', '.png,.jpg,.jpeg,.gif,.svg,.webp,.mp4,.webm,.mp3,.pdf,.docx,.xlsx,.pptx,.txt,.zip'],
        ['max_upload_size_mb', '100'],
        ['default_category', 'Images'],
        ['auto_tagging', 'true'],
        ['storage_quota_gb', '20']
      ];
      for (const [key, val] of defaults) {
        await db.run(
          'INSERT INTO system_settings (key, value) VALUES (?, ?)',
          [key, val]
        );
      }
    }

    // Check plugins table
    const pluginCount = await db.get('SELECT COUNT(*) as count FROM plugins');
    if (parseInt(pluginCount?.count || 0, 10) === 0) {
      const defaultPlugins = [
        {
          id: 'sqlite_core',
          name: 'SQLite Core Engine',
          description: 'ACID-compliant relational database engine with Write-Ahead Logging (WAL), high-speed in-memory indexing, and zero-latency local caching.',
          category: 'Core Database',
          icon: 'fa-database',
          version: '3.45.0',
          author: 'SQLite Development Team',
          enabled: 1,
          status: 'Active',
          config: JSON.stringify({
            storage_file: 'data/dam.sqlite',
            journal_mode: 'WAL',
            cache_size: 4096,
            auto_vacuum: 'INCREMENTAL',
            synchronous: 'NORMAL'
          })
        },
        {
          id: 'storage_connector',
          name: 'Cloud & Local Storage Adapter',
          description: 'Hybrid storage engine seamlessly streaming media between local filesystem and cloud object storage buckets with automatic fallbacks.',
          category: 'Storage',
          icon: 'fa-cloud-arrow-up',
          version: '2.1.0',
          author: 'DAM Studio Cloud',
          enabled: 1,
          status: 'Active',
          config: JSON.stringify({
            mode: 'hybrid_local_cloud',
            upload_dir: 'uploads',
            bucket: 'dam-assets',
            max_file_size_mb: 100,
            mime_validation: true
          })
        },
        {
          id: 'twilio_sms',
          name: 'Twilio SMS & OTP Gateway',
          description: 'Enterprise 2FA authentication layer providing mobile OTP generation, instant delivery verification, and developer simulation mode.',
          category: 'Security & Auth',
          icon: 'fa-comment-sms',
          version: '1.4.2',
          author: 'Twilio Integration',
          enabled: 1,
          status: 'Active',
          config: JSON.stringify({
            provider: 'twilio',
            otp_expiry_minutes: 5,
            allow_sandbox_otp: true,
            sender_phone: '+17372508034'
          })
        },
        {
          id: 'digilocker_dpi',
          name: 'DigiLocker DPI Citizen Identity',
          description: 'National Digital Public Infrastructure connector for paperless citizen KYC verification and government credential authentication.',
          category: 'Government & Identity',
          icon: 'fa-shield-halved',
          version: '2.0.1',
          author: 'National Informatics / Kwik.ID',
          enabled: 1,
          status: 'Active',
          config: JSON.stringify({
            mode: 'sandbox_simulator',
            compliance: 'ISO_27001',
            auto_import_docs: true,
            auth_timeout_sec: 120
          })
        },
        {
          id: 'ai_copilot',
          name: 'Neural AI Copilot & Semantic Search',
          description: 'On-device semantic knowledge base, natural language query parser, and auto-tagging assistant with 3,725 trained nodes.',
          category: 'AI & Intelligence',
          icon: 'fa-brain',
          version: '2.5.0',
          author: 'DAM AI Labs',
          enabled: 1,
          status: 'Active',
          config: JSON.stringify({
            model_type: 'gpt2_dialogue_transformer',
            dataset_path: 'data/chatbot_dataset.csv',
            temperature: 0.7,
            max_tokens: 150,
            auto_tagging_confidence: 0.82
          })
        },
        {
          id: 'media_optimizer',
          name: 'Asset Optimizer & WebP Engine',
          description: 'Real-time media pipeline generating high-resolution responsive thumbnails and optimizing preview footprints on ingest.',
          category: 'Media Processing',
          icon: 'fa-wand-magic-sparkles',
          version: '1.2.0',
          author: 'DAM Media Pipeline',
          enabled: 1,
          status: 'Active',
          config: JSON.stringify({
            enable_webp_conversion: true,
            quality: 85,
            generate_thumbnails: true,
            thumbnail_size: 320
          })
        },
        {
          id: 'watermark_security',
          name: 'Digital Watermark & Rights Guard',
          description: 'Applies dynamic copyright watermarks, license metadata, and asset tracking stamps to confidential assets.',
          category: 'Security & Auth',
          icon: 'fa-stamp',
          version: '1.1.0',
          author: 'DAM Security Suite',
          enabled: 1,
          status: 'Active',
          config: JSON.stringify({
            watermark_text: 'DAM Studio Confidential',
            opacity: 0.35,
            position: 'bottom-right',
            apply_on_download: false
          })
        },
        {
          id: 'webhook_broadcaster',
          name: 'Event Webhooks & Audit Dispatcher',
          description: 'Emits webhook events (asset uploaded, downloaded, deleted, tagged) to Slack, Discord, or enterprise endpoints.',
          category: 'Integrations',
          icon: 'fa-bolt',
          version: '1.0.5',
          author: 'DAM Studio Connect',
          enabled: 1,
          status: 'Active',
          config: JSON.stringify({
            endpoints: [],
            retry_attempts: 3,
            events: ['asset.upload', 'asset.download', 'asset.delete', 'user.login']
          })
        }
      ];

      for (const p of defaultPlugins) {
        await db.run(
          'INSERT INTO plugins (id, name, description, category, icon, version, author, enabled, status, config, installed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [p.id, p.name, p.description, p.category, p.icon, p.version, p.author, p.enabled, p.status, p.config, new Date().toISOString(), new Date().toISOString()]
        );
      }
    }
  } catch (err) {
    console.error('Error seeding defaults:', err.message);
  }
}

// Start database initialization
initTables().catch(err => {
  console.error('❌ Database initialization error:', err.message);
});

module.exports = {
  db,
  isPostgres,
  getFileType,
  logActivity,
  uploadToStorage,
  deleteFromStorage,
  supabaseClient,
  uploadsDir
};
