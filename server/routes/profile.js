const express = require('express');
const router = express.Router();
const { db, logActivity } = require('../db');
const { optionalAuth } = require('../middleware/auth');

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// GET /api/profile
router.get('/', optionalAuth, async (req, res) => {
  try {
    const uid = req.userId || 1;
    let user = null;
    if (req.userId) {
      user = await db.get('SELECT * FROM users WHERE id = ?', [uid]);
    }
    const baseProfile = await db.get('SELECT * FROM user_profile WHERE id = 1');
    const assetStats = await db.get(
      'SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total_size FROM assets WHERE user_id = ?',
      [uid]
    );

    const count = parseInt(assetStats?.count || 0, 10);
    const totalSize = parseInt(assetStats?.total_size || 0, 10);

    const displayName = user ? (user.name || user.phone) : (baseProfile?.name || 'Administrator');
    const displayRole = user ? (user.role || 'user') : (baseProfile?.role || 'Administrator');
    const displayEmail = user?.email || (user?.phone ? `${user.phone}@dam.system` : (baseProfile?.email || 'admin@dam.system'));
    const displayBio = user?.bio || (baseProfile?.bio || 'Digital Asset Management User');

    res.json({
      success: true,
      data: {
        id: uid,
        name: displayName,
        email: displayEmail,
        role: displayRole,
        avatar_url: user?.avatar_url || baseProfile?.avatar_url || 'assets/images/user.png',
        bio: displayBio,
        storage_limit_mb: baseProfile?.storage_limit_mb || 20480,
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
router.put('/', optionalAuth, async (req, res) => {
  try {
    const uid = req.userId || 1;
    const { name, email, role, bio } = req.body;

    if (req.userId) {
      await db.run(
        'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), role = COALESCE(?, role), bio = COALESCE(?, bio) WHERE id = ?',
        [name, email, role, bio, uid]
      );
    }

    if (uid === 1) {
      const current = await db.get('SELECT * FROM user_profile WHERE id = 1');
      const newName = name && name.trim() !== '' ? name.trim() : (current?.name || 'Jayash');
      const newEmail = email && email.trim() !== '' ? email.trim() : (current?.email || 'jayash@dam.system');
      const newRole = role && role.trim() !== '' ? role.trim() : (current?.role || 'Administrator');
      const newBio = bio !== undefined ? bio.trim() : (current?.bio || '');

      await db.run(
        'UPDATE user_profile SET name = ?, email = ?, role = ?, bio = ? WHERE id = 1',
        [newName, newEmail, newRole, newBio]
      );
    }

    await logActivity('Profile Updated', name || 'User', 'Profile details updated', uid);

    res.json({ success: true, message: 'Profile updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile: ' + err.message });
  }
});

module.exports = router;
