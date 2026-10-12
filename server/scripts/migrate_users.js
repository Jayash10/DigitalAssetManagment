/**
 * Migration: Add users table + user_id column to assets & activity_log
 * Uses the same node:sqlite that db.js uses
 * Safe to run multiple times (idempotent)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { DatabaseSync } = require('node:sqlite');
const dataDir = path.join(__dirname, '..', '..', 'data');
const dbPath = process.env.SQLITE_DB_PATH ? path.resolve(process.env.SQLITE_DB_PATH) : path.join(dataDir, 'dam.sqlite');

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');

console.log('🔧 Running user isolation migration...');
console.log(`📂 DB path: ${dbPath}`);

// 1. Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT 'User',
    role TEXT DEFAULT 'user',
    avatar_url TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('✅ users table ready');

// 2. Add user_id to assets (catch if already exists)
try {
    db.exec(`ALTER TABLE assets ADD COLUMN user_id INTEGER DEFAULT 1;`);
    console.log('✅ assets.user_id column added');
} catch (e) {
    if (e.message && (e.message.includes('duplicate column') || e.message.includes('already exists'))) {
        console.log('ℹ️  assets.user_id already exists, skipping');
    } else {
        throw e;
    }
}

// 3. Add user_id to activity_log
try {
    db.exec(`ALTER TABLE activity_log ADD COLUMN user_id INTEGER DEFAULT 1;`);
    console.log('✅ activity_log.user_id column added');
} catch (e) {
    if (e.message && (e.message.includes('duplicate column') || e.message.includes('already exists'))) {
        console.log('ℹ️  activity_log.user_id already exists, skipping');
    } else {
        throw e;
    }
}

// 4. Create a default admin user so existing assets (user_id=1) still work
db.prepare(`INSERT OR IGNORE INTO users (id, phone, name, role) VALUES (1, 'admin', 'Administrator', 'admin')`).run();
console.log('✅ Default admin user (id=1) ensured');

db.close();
console.log('\n🎉 Migration complete!');
console.log('   All existing assets are assigned to user_id=1 (admin).');
console.log('   New users who register will get their own isolated library.');
