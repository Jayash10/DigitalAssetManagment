const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, getFileType, logActivity, uploadToStorage, deleteFromStorage, uploadsDir } = require('../db');

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e4);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Helper to format human-readable size
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Helper to determine icon class for font-awesome
function getAssetIcon(fileType, mimeType, ext) {
  if (fileType === 'image') return 'fa-image';
  if (fileType === 'video') return 'fa-video';
  if (fileType === 'audio') return 'fa-headphones';
  if (ext === '.pdf' || mimeType.includes('pdf')) return 'fa-file-pdf';
  if (['.doc', '.docx'].includes(ext) || mimeType.includes('word')) return 'fa-file-word';
  if (['.xls', '.xlsx', '.csv'].includes(ext) || mimeType.includes('sheet') || mimeType.includes('csv')) return 'fa-file-excel';
  if (['.ppt', '.pptx'].includes(ext) || mimeType.includes('presentation')) return 'fa-file-powerpoint';
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext) || mimeType.includes('zip')) return 'fa-file-zipper';
  if (['.html', '.js', '.css', '.json', '.py', '.java', '.cpp'].includes(ext)) return 'fa-file-code';
  return 'fa-file';
}

// GET /api/assets - List & Filter
router.get('/', async (req, res) => {
  try {
    const { search, category, type, sort } = req.query;

    let query = 'SELECT * FROM assets WHERE 1=1';
    const params = [];

    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      query += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ? OR original_name LIKE ?)';
      params.push(s, s, s, s);
    }

    if (category && category !== 'all' && category.trim() !== '') {
      query += ' AND LOWER(category) = LOWER(?)';
      params.push(category.trim());
    }

    if (type && type !== 'all' && type.trim() !== '') {
      query += ' AND LOWER(file_type) = LOWER(?)';
      params.push(type.trim());
    }

    // Sorting
    switch (sort) {
      case 'date_asc':
        query += ' ORDER BY id ASC';
        break;
      case 'name_asc':
        query += ' ORDER BY LOWER(title) ASC';
        break;
      case 'name_desc':
        query += ' ORDER BY LOWER(title) DESC';
        break;
      case 'size_asc':
        query += ' ORDER BY size_bytes ASC';
        break;
      case 'size_desc':
        query += ' ORDER BY size_bytes DESC';
        break;
      case 'downloads_desc':
        query += ' ORDER BY downloads_count DESC';
        break;
      case 'date_desc':
      default:
        query += ' ORDER BY id DESC';
        break;
    }

    const rows = await db.all(query, params);

    const assets = rows.map(row => {
      const ext = path.extname(row.filename).toLowerCase();
      const previewUrl = row.file_path && row.file_path.startsWith('http')
        ? row.file_path
        : `/uploads/${row.filename}`;

      return {
        ...row,
        size_bytes: parseInt(row.size_bytes || 0, 10),
        downloads_count: parseInt(row.downloads_count || 0, 10),
        size_formatted: formatBytes(row.size_bytes),
        icon: getAssetIcon(row.file_type, row.mime_type, ext),
        download_url: `/api/assets/${row.id}/download`,
        preview_url: previewUrl
      };
    });

    res.json({ success: true, count: assets.length, data: assets });
  } catch (err) {
    console.error('Error fetching assets:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch assets: ' + err.message });
  }
});

// GET /api/assets/:id - Single asset
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await db.get('SELECT * FROM assets WHERE id = ?', [id]);

    if (!row) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const ext = path.extname(row.filename).toLowerCase();
    const previewUrl = row.file_path && row.file_path.startsWith('http')
      ? row.file_path
      : `/uploads/${row.filename}`;

    res.json({
      success: true,
      data: {
        ...row,
        size_bytes: parseInt(row.size_bytes || 0, 10),
        downloads_count: parseInt(row.downloads_count || 0, 10),
        size_formatted: formatBytes(row.size_bytes),
        icon: getAssetIcon(row.file_type, row.mime_type, ext),
        download_url: `/api/assets/${row.id}/download`,
        preview_url: previewUrl
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch asset: ' + err.message });
  }
});

// POST /api/assets/upload - Upload single or multiple files
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { title, category, tags, description } = req.body;
    const insertedAssets = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const mime = file.mimetype || 'application/octet-stream';
      const fileType = getFileType(mime, ext);
      const assetTitle = title && title.trim() !== '' ? title.trim() : path.basename(file.originalname, ext);
      const assetCategory = category && category.trim() !== '' ? category.trim() : 'Others';
      const assetTags = tags ? tags.trim() : '';
      const assetDesc = description ? description.trim() : '';
      const createdAt = new Date().toISOString();

      // Upload to Supabase Storage if configured (falls back to disk)
      let storedFilePath = `/uploads/${file.filename}`;
      try {
        const fileBuffer = fs.readFileSync(file.path);
        const storageResult = await uploadToStorage(fileBuffer, file.filename, mime);
        storedFilePath = storageResult.path;
      } catch (uploadErr) {
        console.warn('Storage upload error, using local path:', uploadErr.message);
      }

      const result = await db.run(
        `INSERT INTO assets (
          title, filename, original_name, file_path, mime_type, file_type,
          category, size_bytes, tags, description, created_at, downloads_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          assetTitle,
          file.filename,
          file.originalname,
          storedFilePath,
          mime,
          fileType,
          assetCategory,
          file.size,
          assetTags,
          assetDesc,
          createdAt,
          0
        ]
      );

      await logActivity('Uploaded', assetTitle, `Uploaded file ${file.originalname} (${formatBytes(file.size)})`);

      insertedAssets.push({
        id: Number(result.lastInsertRowid || 0),
        title: assetTitle,
        filename: file.filename,
        original_name: file.originalname,
        file_path: storedFilePath,
        mime_type: mime,
        file_type: fileType,
        category: assetCategory,
        size_bytes: file.size,
        size_formatted: formatBytes(file.size),
        icon: getAssetIcon(fileType, mime, ext),
        tags: assetTags,
        description: assetDesc,
        created_at: createdAt,
        downloads_count: 0
      });
    }

    res.status(201).json({
      success: true,
      message: `${insertedAssets.length} asset(s) uploaded successfully!`,
      data: insertedAssets
    });
  } catch (err) {
    console.error('Error during asset upload:', err);
    res.status(500).json({ success: false, message: 'Upload failed: ' + err.message });
  }
});

// PUT /api/assets/:id - Update metadata
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await db.get('SELECT * FROM assets WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    const { title, category, tags, description } = req.body;
    const newTitle = title !== undefined && title.trim() !== '' ? title.trim() : existing.title;
    const newCategory = category !== undefined && category.trim() !== '' ? category.trim() : existing.category;
    const newTags = tags !== undefined ? tags.trim() : existing.tags;
    const newDesc = description !== undefined ? description.trim() : existing.description;

    await db.run(
      'UPDATE assets SET title = ?, category = ?, tags = ?, description = ? WHERE id = ?',
      [newTitle, newCategory, newTags, newDesc, id]
    );

    await logActivity('Edited', newTitle, `Updated metadata for asset #${id}`);

    const updated = await db.get('SELECT * FROM assets WHERE id = ?', [id]);
    const ext = path.extname(updated.filename).toLowerCase();
    const previewUrl = updated.file_path && updated.file_path.startsWith('http')
      ? updated.file_path
      : `/uploads/${updated.filename}`;

    res.json({
      success: true,
      message: 'Asset updated successfully.',
      data: {
        ...updated,
        size_formatted: formatBytes(updated.size_bytes),
        icon: getAssetIcon(updated.file_type, updated.mime_type, ext),
        preview_url: previewUrl
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed: ' + err.message });
  }
});

// DELETE /api/assets/:id - Delete asset and remove file
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const asset = await db.get('SELECT * FROM assets WHERE id = ?', [id]);

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    // Delete DB record
    await db.run('DELETE FROM assets WHERE id = ?', [id]);

    // Delete file from Supabase Storage / disk
    await deleteFromStorage(asset.filename);

    await logActivity('Deleted', asset.title, `Deleted asset #${id} (${asset.original_name})`);

    res.json({ success: true, message: `Asset "${asset.title}" deleted successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delete failed: ' + err.message });
  }
});

// GET /api/assets/:id/download - Trigger download & increment counter
router.get('/:id/download', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const asset = await db.get('SELECT * FROM assets WHERE id = ?', [id]);

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    // Increment downloads count
    await db.run('UPDATE assets SET downloads_count = downloads_count + 1 WHERE id = ?', [id]);
    await logActivity('Downloaded', asset.title, `Downloaded file: ${asset.original_name}`);

    // If cloud stored, redirect to cloud file
    if (asset.file_path && asset.file_path.startsWith('http')) {
      return res.redirect(asset.file_path);
    }

    const diskPath = path.join(uploadsDir, asset.filename);
    if (!fs.existsSync(diskPath)) {
      return res.status(404).json({ success: false, message: 'Physical file not found on server.' });
    }

    res.download(diskPath, asset.original_name);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Download failed: ' + err.message });
  }
});

module.exports = router;
