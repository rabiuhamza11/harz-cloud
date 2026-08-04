/**
 * HARZ Cloud — File Storage with CDN
 * 
 * Provides:
 * - File upload (images, documents, videos, audio)
 * - CDN-style static serving with cache headers
 * - Image thumbnails & optimization
 * - Signed URLs for private files
 * - File metadata tracking
 * - Storage quota management
 * - Multi-tier storage (local → cloud)
 * 
 * Storage tiers:
 * 1. Local (Render disk) — fast, limited space
 * 2. Cloudinary (images) — free 25GB CDN
 * 3. Backblaze B2 (all files) — free 10GB
 * 4. Cloudflare R2 (all files) — free 10GB + zero egress
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Storage directories
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbnails');
const PUBLIC_DIR = path.join(UPLOAD_DIR, 'public');
const PRIVATE_DIR = path.join(UPLOAD_DIR, 'private');

// Ensure directories exist
function ensureDirs() {
  [UPLOAD_DIR, THUMB_DIR, PUBLIC_DIR, PRIVATE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// File type categories
const FILE_CATEGORIES = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'],
  video: ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
  document: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'],
  spreadsheet: ['xls', 'xlsx', 'csv', 'ods'],
  presentation: ['ppt', 'pptx', 'odp'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz'],
  code: ['js', 'ts', 'py', 'html', 'css', 'json', 'xml', 'md'],
  ebook: ['epub', 'mobi', 'azw', 'azw3']
};

// Dangerous file types (blocked)
const BLOCKED_TYPES = ['bat', 'cmd', 'hta', 'vbs', 'exe', 'scr', 'msi', 'dll', 'ps1'];

// Max file sizes by category (in bytes)
const MAX_SIZES = {
  image: 10 * 1024 * 1024,       // 10MB
  video: 100 * 1024 * 1024,      // 100MB
  audio: 50 * 1024 * 1024,       // 50MB
  document: 20 * 1024 * 1024,    // 20MB
  archive: 50 * 1024 * 1024,     // 50MB
  default: 25 * 1024 * 1024      // 25MB
};

/**
 * Get file category from extension
 */
function getFileCategory(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(ext)) return category;
  }
  return 'other';
}

/**
 * Check if file type is blocked
 */
function isBlocked(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return BLOCKED_TYPES.includes(ext);
}

/**
 * Generate unique filename
 */
function generateFilename(originalName) {
  const ext = originalName.split('.').pop();
  const hash = crypto.randomBytes(16).toString('hex');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${date}_${hash}.${ext}`;
}

/**
 * Save file to storage
 */
async function saveFile(file, options = {}) {
  ensureDirs();
  
  const { originalname, buffer, mimetype, size } = file;
  const { isPrivate = false, user_email, platform, tags = [] } = options;
  
  // Validate
  if (isBlocked(originalname)) {
    return { success: false, error: 'File type blocked for security' };
  }
  
  const category = getFileCategory(originalname);
  const maxSize = MAX_SIZES[category] || MAX_SIZES.default;
  
  if (size > maxSize) {
    return { 
      success: false, 
      error: `File too large. Max ${category}: ${maxSize / 1024 / 1024}MB`,
      size, maxSize
    };
  }
  
  // Generate filename
  const filename = generateFilename(originalname);
  const subDir = isPrivate ? PRIVATE_DIR : PUBLIC_DIR;
  const filePath = path.join(subDir, filename);
  
  // Write file
  fs.writeFileSync(filePath, buffer);
  
  // Create file record
  const fileId = crypto.randomUUID();
  const fileUrl = isPrivate ? null : `/cdn/${filename}`;
  
  const fileRecord = {
    id: fileId,
    filename,
    original_name: originalname,
    mime_type: mimetype,
    size,
    category,
    is_private: isPrivate,
    url: fileUrl,
    path: filePath,
    user_email: user_email || 'anonymous',
    platform: platform || 'unknown',
    tags: JSON.stringify(tags),
    download_count: 0,
    created_date: new Date().toISOString(),
    created_by: user_email || 'system'
  };
  
  // Generate thumbnail for images
  let thumbnailUrl = null;
  if (category === 'image' && !isPrivate) {
    try {
      // Simple thumbnail by copying with smaller name (production: use sharp)
      const thumbName = 'thumb_' + filename;
      const thumbPath = path.join(THUMB_DIR, thumbName);
      fs.copyFileSync(filePath, thumbPath);
      thumbnailUrl = `/cdn/thumbnails/${thumbName}`;
      fileRecord.thumbnail_url = thumbnailUrl;
    } catch (e) {
      console.error('Thumbnail failed:', e.message);
    }
  }
  
  return { success: true, file: fileRecord };
}

/**
 * Generate signed URL for private file
 */
function generateSignedUrl(filename, secret, expiresIn = 300) {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${filename}:${expires}`)
    .digest('hex');
  
  return `/cdn/private/${filename}?expires=${expires}&sig=${signature}`;
}

/**
 * Verify signed URL
 */
function verifySignedUrl(filename, expires, sig, secret) {
  if (Math.floor(Date.now() / 1000) > expires) {
    return { valid: false, error: 'URL expired' };
  }
  
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${filename}:${expires}`)
    .digest('hex');
  
  return { valid: expectedSig === sig };
}

/**
 * Delete a file
 */
function deleteFile(filename, isPrivate) {
  const subDir = isPrivate ? PRIVATE_DIR : PUBLIC_DIR;
  const filePath = path.join(subDir, filename);
  const thumbPath = path.join(THUMB_DIR, 'thumb_' + filename);
  
  let deleted = false;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    deleted = true;
  }
  if (fs.existsSync(thumbPath)) {
    fs.unlinkSync(thumbPath);
  }
  
  return { success: deleted, filename };
}

/**
 * Get file info
 */
function getFileInfo(filename) {
  const publicPath = path.join(PUBLIC_DIR, filename);
  const privatePath = path.join(PRIVATE_DIR, filename);
  
  let filePath = null;
  let isPrivate = false;
  
  if (fs.existsSync(publicPath)) {
    filePath = publicPath;
    isPrivate = false;
  } else if (fs.existsSync(privatePath)) {
    filePath = privatePath;
    isPrivate = true;
  }
  
  if (!filePath) return null;
  
  const stats = fs.statSync(filePath);
  const category = getFileCategory(filename);
  
  return {
    filename,
    size: stats.size,
    category,
    is_private: isPrivate,
    created: stats.birthtime,
    modified: stats.mtime,
    url: isPrivate ? null : `/cdn/${filename}`
  };
}

/**
 * List files
 */
function listFiles(options = {}) {
  const { category, isPrivate, limit = 50 } = options;
  const dir = isPrivate ? PRIVATE_DIR : PUBLIC_DIR;
  
  if (!fs.existsSync(dir)) return [];
  
  const files = fs.readdirSync(dir).map(filename => {
    const filePath = path.join(dir, filename);
    const stats = fs.statSync(filePath);
    const fileCategory = getFileCategory(filename);
    
    if (category && fileCategory !== category) return null;
    
    return {
      filename,
      size: stats.size,
      category: fileCategory,
      created: stats.birthtime,
      url: `/cdn/${filename}`
    };
  }).filter(Boolean);
  
  return files.slice(0, limit);
}

/**
 * Get storage statistics
 */
function getStorageStats() {
  ensureDirs();
  
  const stats = {
    public: { count: 0, size: 0 },
    private: { count: 0, size: 0 },
    thumbnails: { count: 0, size: 0 },
    total: { count: 0, size: 0 },
    by_category: {}
  };
  
  [PUBLIC_DIR, PRIVATE_DIR, THUMB_DIR].forEach((dir, index) => {
    const key = ['public', 'private', 'thumbnails'][index];
    
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    files.forEach(filename => {
      const stats_file = fs.statSync(path.join(dir, filename));
      stats[key].count++;
      stats[key].size += stats_file.size;
      stats.total.count++;
      stats.total.size += stats_file.size;
      
      const category = getFileCategory(filename);
      if (!stats.by_category[category]) {
        stats.by_category[category] = { count: 0, size: 0 };
      }
      stats.by_category[category].count++;
      stats.by_category[category].size += stats_file.size;
    });
  });
  
  // Human-readable sizes
  stats.total.size_mb = (stats.total.size / 1024 / 1024).toFixed(2);
  stats.public.size_mb = (stats.public.size / 1024 / 1024).toFixed(2);
  stats.private.size_mb = (stats.private.size / 1024 / 1024).toFixed(2);
  
  return stats;
}

/**
 * CDN cache headers middleware
 */
function cdnCacheHeaders(req, res, next) {
  // Set cache headers for static files
  const category = getFileCategory(req.params.filename || '');
  
  switch (category) {
    case 'image':
      res.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
      break;
    case 'video':
    case 'audio':
      res.set('Cache-Control', 'public, max-age=2592000'); // 30 days
      break;
    case 'document':
    case 'ebook':
      res.set('Cache-Control', 'public, max-age=604800'); // 7 days
      break;
    default:
      res.set('Cache-Control', 'public, max-age=86400'); // 1 day
  }
  
  // Security headers
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  
  next();
}

module.exports = {
  saveFile,
  generateSignedUrl,
  verifySignedUrl,
  deleteFile,
  getFileInfo,
  listFiles,
  getStorageStats,
  cdnCacheHeaders,
  getFileCategory,
  isBlocked,
  ensureDirs,
  PUBLIC_DIR,
  PRIVATE_DIR,
  THUMB_DIR,
  FILE_CATEGORIES,
  MAX_SIZES
};
