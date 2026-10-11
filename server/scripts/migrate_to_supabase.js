/**
 * DAM Studio - Supabase Automated Migration Tool
 * 
 * Migrates local SQLite data & files into Supabase PostgreSQL & Storage.
 * Run with: node server/scripts/migrate_to_supabase.js
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const { DatabaseSync } = require('node:sqlite');

async function migrate() {
  console.log('\n========================================================');
  console.log('🚀 DAM Studio — Supabase Cloud Migration Tool');
  console.log('========================================================\n');

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL || !DATABASE_URL.startsWith('postgres')) {
    console.error('❌ Error: DATABASE_URL is not configured in your .env file.');
    console.error('Please configure DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres in .env');
    process.exit(1);
  }

  // 1. Connect to SQLite
  const sqlitePath = path.join(__dirname, '..', '..', 'data', 'dam.sqlite');
  if (!fs.existsSync(sqlitePath)) {
    console.error('❌ SQLite database file not found at:', sqlitePath);
    process.exit(1);
  }

  console.log('📦 Reading source SQLite database:', sqlitePath);
  const sqliteDb = new DatabaseSync(sqlitePath);

  // 2. Connect to Supabase PostgreSQL
  console.log('🐘 Connecting to Supabase PostgreSQL...');
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  console.log('✅ Connected to Supabase PostgreSQL successfully!\n');

  // 3. Apply Schema
  const schemaPath = path.join(__dirname, '..', '..', 'supabase', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    console.log('📜 Applying database schema from supabase/schema.sql...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    try {
      await client.query(schemaSql);
      console.log('✅ Schema applied successfully!\n');
    } catch (schemaErr) {
      console.warn('⚠️  Notice while applying schema (may already exist):', schemaErr.message);
    }
  }

  // 4. Migrate Categories
  console.log('📁 Migrating categories...');
  const categories = sqliteDb.prepare('SELECT * FROM categories').all();
  let catCount = 0;
  for (const cat of categories) {
    try {
      await client.query(
        `INSERT INTO categories (name, description, icon, color_class, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (LOWER(name)) DO NOTHING`,
        [cat.name, cat.description || '', cat.icon || 'fa-folder', cat.color_class || 'other-icon', cat.created_at || new Date().toISOString()]
      );
      catCount++;
    } catch (err) {
      console.warn(`  - Skipped category "${cat.name}":`, err.message);
    }
  }
  console.log(`✅ Migrated ${catCount}/${categories.length} categories.`);

  // 5. Migrate User Profile
  console.log('\n👤 Migrating user profile...');
  const profile = sqliteDb.prepare('SELECT * FROM user_profile WHERE id = 1').get();
  if (profile) {
    await client.query(
      `INSERT INTO user_profile (id, name, email, role, avatar_url, bio, storage_limit_mb)
       VALUES (1, $1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         avatar_url = EXCLUDED.avatar_url,
         bio = EXCLUDED.bio,
         storage_limit_mb = EXCLUDED.storage_limit_mb`,
      [profile.name, profile.email, profile.role, profile.avatar_url, profile.bio || '', profile.storage_limit_mb || 20480]
    );
    console.log(`✅ User profile (${profile.name}) migrated.`);
  }

  // 6. Migrate System Settings
  console.log('\n⚙️  Migrating system settings...');
  const settings = sqliteDb.prepare('SELECT * FROM system_settings').all();
  for (const s of settings) {
    await client.query(
      `INSERT INTO system_settings (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [s.key, s.value]
    );
  }
  console.log(`✅ Migrated ${settings.length} system settings.`);

  // 7. Migrate Assets
  console.log('\n🖼️  Migrating assets...');
  const assets = sqliteDb.prepare('SELECT * FROM assets').all();
  let assetCount = 0;
  for (const a of assets) {
    try {
      await client.query(
        `INSERT INTO assets (
          title, filename, original_name, file_path, mime_type, file_type,
          category, size_bytes, tags, description, created_at, downloads_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          a.title,
          a.filename,
          a.original_name,
          a.file_path,
          a.mime_type,
          a.file_type,
          a.category,
          a.size_bytes,
          a.tags || '',
          a.description || '',
          a.created_at,
          a.downloads_count || 0
        ]
      );
      assetCount++;
    } catch (err) {
      console.warn(`  - Skipped asset "${a.title}":`, err.message);
    }
  }
  console.log(`✅ Migrated ${assetCount}/${assets.length} assets.`);

  // 8. Migrate Activity Log
  console.log('\n📋 Migrating activity logs...');
  const logs = sqliteDb.prepare('SELECT * FROM activity_log ORDER BY id ASC LIMIT 50').all();
  for (const log of logs) {
    await client.query(
      `INSERT INTO activity_log (action, asset_name, details, timestamp)
       VALUES ($1, $2, $3, $4)`,
      [log.action, log.asset_name, log.details || '', log.timestamp]
    );
  }
  console.log(`✅ Migrated ${logs.length} activity records.`);

  // 9. Upload Files to Supabase Storage (if configured)
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'dam-assets';

  if (SUPABASE_URL && SUPABASE_KEY) {
    console.log(`\n☁️  Uploading files to Supabase Storage bucket "${bucketName}"...`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

    // Ensure bucket exists
    try {
      await supabase.storage.createBucket(bucketName, { public: true });
    } catch (_) {}

    for (const a of assets) {
      const diskPath = path.join(uploadsDir, a.filename);
      if (fs.existsSync(diskPath)) {
        try {
          const buffer = fs.readFileSync(diskPath);
          const { error } = await supabase.storage.from(bucketName).upload(a.filename, buffer, {
            contentType: a.mime_type,
            upsert: true
          });

          if (!error) {
            const { data: pub } = supabase.storage.from(bucketName).getPublicUrl(a.filename);
            await client.query(
              'UPDATE assets SET file_path = $1 WHERE filename = $2',
              [pub.publicUrl, a.filename]
            );
            console.log(`  ✓ Uploaded to cloud: ${a.filename}`);
          } else {
            console.warn(`  ⚠ Upload error for ${a.filename}:`, error.message);
          }
        } catch (e) {
          console.warn(`  ⚠ Error processing ${a.filename}:`, e.message);
        }
      }
    }
    console.log('✅ Cloud file upload sync complete!');
  } else {
    console.log('\nℹ️  SUPABASE_URL / SUPABASE_KEY not specified: File paths in DB will reference local URLs.');
  }

  // 10. Verification
  console.log('\n========================================================');
  console.log('📊 Migration Verification Summary:');
  const catCheck = await client.query('SELECT COUNT(*) as count FROM categories');
  const assetCheck = await client.query('SELECT COUNT(*) as count FROM assets');
  const logCheck = await client.query('SELECT COUNT(*) as count FROM activity_log');
  console.log(`- Categories in Supabase:    ${catCheck.rows[0].count}`);
  console.log(`- Assets in Supabase:        ${assetCheck.rows[0].count}`);
  console.log(`- Activity logs in Supabase: ${logCheck.rows[0].count}`);
  console.log('========================================================\n');

  client.release();
  await pool.end();
  console.log('🎉 Supabase migration finished successfully!\n');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed with error:', err);
  process.exit(1);
});
