# Digital Asset Management — Cloud Deployment Guide

## ✅ Implementation Status

The codebase is now fully **cloud-ready** and supports dual-engine deployment:

| Component | Status | Details |
| :--- | :--- | :--- |
| **Database Engine** | ✅ Ready | SQLite 3 (WAL mode) primary embedded engine in `server/db.js` with sub-millisecond query latency; dual-engine connects to PostgreSQL (Supabase) if `DATABASE_URL` is set without `DATABASE_TYPE=sqlite`. |
| **Plugins Ecosystem** | ✅ Ready | Full SQLite-backed plugin registry (`plugins` table, `server/routes/plugins.js`, `pages/plugins.html`, `assets/js/plugins.js`) with live health diagnostics, toggles, and config management. |
| **All Routes** | ✅ Migrated | `stats.js`, `categories.js`, `profile.js`, `settings.js`, `auth.js`, `assets.js`, `plugins.js`, and `ai.js` converted to async queries (`await db.get`, `await db.all`, `await db.run`). |
| **AI Route DB sharing** | ✅ Fixed | `server/routes/ai.js` now uses the shared `db` module instead of opening a separate SQLite connection. |
| **Cloud Storage** | ✅ Ready | `server/db.js` & `server/routes/assets.js` support Supabase Storage (`dam-assets` bucket) with public URLs, with fallback to local disk. |
| **Data Migration Tool** | ✅ Ready | `npm run migrate:supabase` (`server/scripts/migrate_to_supabase.js`) migrates tables and files to Supabase. |
| **Render Blueprint** | ✅ Ready | `render.yaml` configured for one-click deployment on Render. |
| **Git Safety** | ✅ Enforced | `.gitignore` excludes `.env`, `data/*.sqlite`, local `uploads/*`, credentials, and heavy AI weights (`*.pkl`). |

---

## 🚀 How to Complete Deployment

### Step 1: Add Credentials to Your Local `.env`
In your local [`.env`](file:///d:/Project/DigitalAssetManagment/.env) file (never share or commit this file), set:
```env
# From Supabase Dashboard -> Project Settings -> Database -> Connection String (URI / Session Mode)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# From Supabase Dashboard -> Project Settings -> API
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_KEY=[YOUR-SUPABASE-SERVICE-ROLE-KEY-OR-ANON-KEY]
SUPABASE_STORAGE_BUCKET=dam-assets
```

---

### Step 2: Migrate Your SQLite Data to Supabase
Run the automated migration script in your terminal:
```bash
npm run migrate:supabase
```
This script will:
1. Connect to Supabase PostgreSQL using your `DATABASE_URL`.
2. Apply `supabase/schema.sql` (creates tables and storage bucket policies).
3. Transfer all categories, user profiles, system settings, and assets.
4. Upload all existing files from `uploads/` to the Supabase Storage bucket.
5. Print a verification summary with total record counts.

---

### Step 3: Push Code to GitHub
Ensure you are in the project root:
```bash
git add .
git commit -m "feat: migrate backend to PostgreSQL, Supabase Storage, and Render config"
git push origin main
```
*(Heavy `.pkl` files and `.env` are automatically excluded by `.gitignore`)*

---

### Step 4: Deploy to Render
1. Open [dashboard.render.com](https://dashboard.render.com/).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Render will auto-detect settings from `render.yaml`, or use:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
5. Under **Environment Variables**, add:
   - `DATABASE_URL`: Your Supabase connection string
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Your Supabase API key
   - `SUPABASE_STORAGE_BUCKET`: `dam-assets`
   - `NODE_ENV`: `production`
6. Click **Deploy Web Service**!
