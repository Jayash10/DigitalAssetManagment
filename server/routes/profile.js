const express = require('express');
const router = express.Router();
const { db, logActivity } = require('../db');

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// GET /api/profile
router.get('/', async (req, res) => {
  try {
    const profile = await db.get('SELECT * FROM user_profile WHERE id = 1');
    const assetStats = await db.get('SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total_size FROM assets');

    const count = parseInt(assetStats?.count || 0, 10);
    const totalSize = parseInt(assetStats?.total_size || 0, 10);

    res.json({
      success: true,
      data: {
        ...(profile || {
          id: 1,
          name: 'Jayash',
          email: 'jayash@dam.system',
          role: 'Administrator',
          avatar_url: 'assets/images/user.png',
          bio: 'Lead Digital Asset Administrator & Manager',
          storage_limit_mb: 20480
        }),
        total_assets: count,
        storage_used_bytes: totalSize,
        storage_used_formatted: formatBytes(totalSize)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile: ' + err.message });
  }
});

// PUT /api/profile
router.put('/', async (req, res) => {
  try {
    const { name, email, role, bio } = req.body;
    const current = await db.get('SELECT * FROM user_profile WHERE id = 1');

    const newName = name && name.trim() !== '' ? name.trim() : (current?.name || 'Jayash');
    const newEmail = email && email.trim() !== '' ? email.trim() : (current?.email || 'jayash@dam.system');
    const newRole = role && role.trim() !== '' ? role.trim() : (current?.role || 'Administrator');
    const newBio = bio !== undefined ? bio.trim() : (current?.bio || '');

    await db.run(
      'UPDATE user_profile SET name = ?, email = ?, role = ?, bio = ? WHERE id = 1',
      [newName, newEmail, newRole, newBio]
    );

    await logActivity('Profile Updated', newName, `Administrator profile updated`);

    const updated = await db.get('SELECT * FROM user_profile WHERE id = 1');
    res.json({ success: true, message: 'Profile updated successfully!', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile: ' + err.message });
  }
});

module.exports = router;
