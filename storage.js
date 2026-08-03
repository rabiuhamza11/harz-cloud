/**
 * HARZ Cloud Storage — File Management
 * Local file storage (development) → Cloud storage (production)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Storage {
  constructor() {
    this.basePath = path.join(__dirname, 'storage');
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async save(file, metadata = {}) {
    const id = crypto.randomUUID();
    const ext = path.extname(file.originalname || file.name || '');
    const filename = `${id}${ext}`;
    const filepath = path.join(this.basePath, filename);
    
    // Write file
    if (file.buffer) {
      fs.writeFileSync(filepath, file.buffer);
    } else if (file.path) {
      fs.copyFileSync(file.path, filepath);
    }
    
    return {
      id,
      filename,
      url: `/storage/${filename}`,
      size: fs.statSync(filepath).size,
      mimetype: file.mimetype || 'application/octet-stream',
      ...metadata,
      uploaded_date: new Date().toISOString()
    };
  }

  get(filename) {
    const filepath = path.join(this.basePath, filename);
    if (!fs.existsSync(filepath)) {
      return null;
    }
    return filepath;
  }

  delete(filename) {
    const filepath = path.join(this.basePath, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  }

  list() {
    return fs.readdirSync(this.basePath).map(filename => {
      const filepath = path.join(this.basePath, filename);
      const stat = fs.statSync(filepath);
      return {
        filename,
        size: stat.size,
        created_date: stat.birthtime.toISOString()
      };
    });
  }
}

module.exports = { Storage: new Storage() };
