const express = require('express');
const router = express.Router();
const { db, logActivity } = require('../db');

// Helper to map color to icon class
function getColorClass(icon) {
  if (!icon) return 'other-icon';
  if (icon.includes('image')) return 'image-icon';
  if (icon.includes('video')) return 'video-icon';
  if (icon.includes('file')) return 'document-icon';
  if (icon.includes('project') || icon.includes('diagram')) return 'project-icon';
  if (icon.includes('certificate') || icon.includes('award')) return 'certificate-icon';
  return 'other-icon';
}

// GET /api/categories - All categories with asset stats
router.get('/', async (req, res) => {
  try {
    const cats = await db.all('SELECT * FROM categories ORDER BY id ASC');

    // Calculate asset counts and size for each category
    const result = await Promise.all(cats.map(async (cat) => {
      const stats = await db.get(
        'SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total_size FROM assets WHERE LOWER(category) = LOWER(?)',
        [cat.name]
      );

      return {
        ...cat,
        asset_count: parseInt(stats?.count || 0, 10),
        total_size_bytes: parseInt(stats?.total_size || 0, 10)
      };
    }));

    res.json({ success: true, count: result.length, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories: ' + err.message });
  }
});

// POST /api/categories - Create new category
router.post('/', async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const cleanName = name.trim();
    const existing = await db.get('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [cleanName]);
    if (existing) {
      return res.status(400).json({ success: false, message: `Category "${cleanName}" already exists.` });
    }

    const catIcon = icon && icon.trim() !== '' ? icon.trim() : 'fa-folder';
    const colorClass = getColorClass(catIcon);
    const createdAt = new Date().toISOString();

    const result = await db.run(
      'INSERT INTO categories (name, description, icon, color_class, created_at) VALUES (?, ?, ?, ?, ?)',
      [cleanName, description ? description.trim() : '', catIcon, colorClass, createdAt]
    );

    await logActivity('Category Created', cleanName, `Created category "${cleanName}"`);

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: {
        id: Number(result.lastInsertRowid || 0),
        name: cleanName,
        description: description || '',
        icon: catIcon,
        color_class: colorClass,
        created_at: createdAt,
        asset_count: 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create category: ' + err.message });
  }
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cat = await db.get('SELECT * FROM categories WHERE id = ?', [id]);

    if (!cat) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    // Default categories protection or reassign
    if (cat.name.toLowerCase() === 'others') {
      return res.status(400).json({ success: false, message: 'Default category "Others" cannot be deleted.' });
    }

    // Reassign assets under this category to "Others"
    await db.run("UPDATE assets SET category = 'Others' WHERE LOWER(category) = LOWER(?)", [cat.name]);

    // Delete category
    await db.run('DELETE FROM categories WHERE id = ?', [id]);

    await logActivity('Category Deleted', cat.name, `Deleted category "${cat.name}". Reassigned assets to "Others".`);

    res.json({ success: true, message: `Category "${cat.name}" deleted successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete category: ' + err.message });
  }
});

module.exports = router;
