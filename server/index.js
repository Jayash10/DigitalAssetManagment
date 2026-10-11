require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Ensure db initializes and seeds
require('./db');

const assetsRouter = require('./routes/assets');
const categoriesRouter = require('./routes/categories');
const statsRouter = require('./routes/stats');
const profileRouter = require('./routes/profile');
const settingsRouter = require('./routes/settings');
const aiRouter = require('./routes/ai');
const authRouter = require('./routes/auth');
const digilockerRouter = require('./routes/digilocker');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Uploads statically
const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Serve Frontend Static Assets
const rootDir = path.join(__dirname, '..');
app.use('/assets', express.static(path.join(rootDir, 'assets')));
app.use('/pages', express.static(path.join(rootDir, 'pages')));

// API Routes
app.use('/api/assets', assetsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/auth', authRouter);
app.use('/api/digilocker', digilockerRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Serve login.html
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(rootDir, 'login.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log('========================================================');
  console.log(`  🚀 DAM System Backend Running!`);
  console.log(`  🔗 Local URL: http://localhost:${PORT}`);
  console.log(`  📁 Storage:   ${uploadsDir}`);
  console.log('========================================================');
});
