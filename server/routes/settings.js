const express = require('express');
const router = express.Router();
const os = require('os');
const path = require('path');
const fs = require('fs');
const { db, logActivity } = require('../db');

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT key, value FROM system_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });

    const dbPath = path.join(__dirname, '..', '..', 'data', 'dam.sqlite');
    let dbSize = 0;
    if (fs.existsSync(dbPath)) {
      dbSize = fs.statSync(dbPath).size;
    }

    const memoryUsage = process.memoryUsage();

    res.json({
      success: true,
      data: {
        settings,
        diagnostics: {
          node_version: process.version,
          platform: `${os.type()} ${os.release()} (${os.arch()})`,
          uptime_seconds: Math.floor(process.uptime()),
          memory_rss: formatBytes(memoryUsage.rss),
          memory_heap_used: formatBytes(memoryUsage.heapUsed),
          database_type: db.isPostgres ? 'PostgreSQL (Supabase)' : 'SQLite',
          database_size: db.isPostgres ? 'Cloud Database' : formatBytes(dbSize),
          server_time: new Date().toISOString()
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch settings: ' + err.message });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const updates = req.body;

    for (const [key, val] of Object.entries(updates)) {
      await db.run(
        'INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [key, String(val)]
      );
    }

    await logActivity('Settings Updated', 'System', `System configurations updated`);

    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save settings: ' + err.message });
  }
});

// GET /api/settings/export - Export assets metadata as JSON backup
router.get('/export', async (req, res) => {
  try {
    const assets = await db.all('SELECT * FROM assets');
    const categories = await db.all('SELECT * FROM categories');
    const profile = await db.get('SELECT * FROM user_profile WHERE id = 1');

    const backup = {
      system: 'Digital Asset Management System',
      export_date: new Date().toISOString(),
      user: profile,
      categories,
      assets_count: assets.length,
      assets
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=dam_backup_${Date.now()}.json`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to export backup: ' + err.message });
  }
});

module.exports = router;
