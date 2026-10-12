const express = require('express');
const router = express.Router();
const path = require('path');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// GET /api/stats - Dashboard analytics (scoped to current user)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const uid = req.userId;

    const totalRow = await db.get('SELECT COUNT(*) as count FROM assets WHERE user_id = ?', [uid]);
    const imagesRow = await db.get("SELECT COUNT(*) as count FROM assets WHERE file_type = 'image' AND user_id = ?", [uid]);
    const videosRow = await db.get("SELECT COUNT(*) as count FROM assets WHERE file_type = 'video' AND user_id = ?", [uid]);
    const docsRow = await db.get("SELECT COUNT(*) as count FROM assets WHERE file_type = 'document' AND user_id = ?", [uid]);
    const othersRow = await db.get("SELECT COUNT(*) as count FROM assets WHERE file_type NOT IN ('image', 'video', 'document') AND user_id = ?", [uid]);

    const totalAssets = parseInt(totalRow?.count || 0, 10);
    const imagesCount = parseInt(imagesRow?.count || 0, 10);
    const videosCount = parseInt(videosRow?.count || 0, 10);
    const documentsCount = parseInt(docsRow?.count || 0, 10);
    const othersCount = parseInt(othersRow?.count || 0, 10);

    const storageRow = await db.get('SELECT COALESCE(SUM(size_bytes), 0) as total FROM assets WHERE user_id = ?', [uid]);
    const storageUsed = parseInt(storageRow?.total || 0, 10);

    // Get storage limit from settings
    const quotaSetting = await db.get("SELECT value FROM system_settings WHERE key = 'storage_quota_gb'");
    const storageQuotaGb = quotaSetting ? parseFloat(quotaSetting.value) : 20;
    const storageQuotaBytes = storageQuotaGb * 1024 * 1024 * 1024;

    const percentUsed = storageQuotaBytes > 0 ? ((storageUsed / storageQuotaBytes) * 100).toFixed(2) : 0;

    // Recent 5 uploads for this user
    const recentRows = await db.all('SELECT * FROM assets WHERE user_id = ? ORDER BY id DESC LIMIT 5', [uid]);
    const recentUploads = recentRows.map(a => ({
      ...a,
      size_formatted: formatBytes(a.size_bytes),
      download_url: `/api/assets/${a.id}/download`,
      preview_url: a.file_path && a.file_path.startsWith('http') ? a.file_path : `/uploads/${a.filename}`
    }));

    // Recent 8 activities for this user
    const recentActivities = await db.all('SELECT * FROM activity_log WHERE user_id = ? ORDER BY id DESC LIMIT 8', [uid]);

    res.json({
      success: true,
      data: {
        total_assets: totalAssets,
        images_count: imagesCount,
        videos_count: videosCount,
        documents_count: documentsCount,
        others_count: othersCount,
        storage_used_bytes: storageUsed,
        storage_used_formatted: formatBytes(storageUsed),
        storage_quota_gb: storageQuotaGb,
        storage_percent: parseFloat(percentUsed),
        recent_uploads: recentUploads,
        recent_activities: recentActivities
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to compute stats: ' + err.message });
  }
});

module.exports = router;
