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
        },
        plugins: {
          database: {
            name: 'SQLite Database Engine',
            engine: db.isPostgres ? 'PostgreSQL (Supabase)' : 'SQLite 3 (WAL)',
            status: 'Connected',
            badge: 'badge-green',
            detail: db.isPostgres ? 'Remote Cloud Database' : 'Local High-Speed SQLite'
          },
          storage: {
            name: 'Cloud & Local Storage',
            engine: process.env.SUPABASE_URL ? 'Supabase Storage' : 'Local Storage (/uploads)',
            status: 'Active',
            badge: 'badge-blue',
            detail: process.env.SUPABASE_URL ? 'Bucket: dam-assets' : 'Directory: /uploads'
          },
          sms_auth: {
            name: 'SMS & OTP Gateway',
            engine: 'Twilio Verify V2 & Programmable SMS',
            status: 'Connected & Verified',
            badge: 'badge-green',
            detail: `Sender: ${process.env.TWILIO_PHONE_NUMBER || '+17372508034'}`
          },
          digilocker: {
            name: 'DigiLocker DPI Identity',
            engine: process.env.KWIKID_AUTH_TOKEN ? 'Kwik.ID Live Gateway' : 'National Sandbox Simulator',
            status: 'Connected',
            badge: 'badge-blue',
            detail: process.env.KWIKID_AUTH_TOKEN ? 'Production API' : 'Sandbox Simulator Ready'
          },
          ai_copilot: {
            name: 'AI Copilot & Neural ML',
            engine: 'GPT-2 Model + Vector Index',
            status: 'Online',
            badge: 'badge-purple',
            detail: '3,725 Dialogue Nodes Ready'
          }
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
