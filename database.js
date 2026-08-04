/**
 * HARZ Cloud Database Layer v2.0
 * Pure JSON file-based storage — no native dependencies needed
 * Works perfectly on Render free tier
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Database {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'harz-cloud.json');
    this.data = {};
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Load existing data or create fresh
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        this.data = JSON.parse(raw);
      } else {
        this.data = { _meta: { created: new Date().toISOString() } };
        this._save();
      }
    } catch (e) {
      this.data = { _meta: { created: new Date().toISOString(), error: e.message } };
      this._save();
    }
    
    this.initialized = true;
    console.log('HARZ Cloud database initialized:', this.dbPath);
  }

  _save() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('Database save error:', e.message);
    }
  }

  _ensureTable(name) {
    if (!this.data[name]) {
      this.data[name] = [];
    }
  }

  async insert(table, recordData) {
    await this.init();
    this._ensureTable(table);
    
    const id = recordData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const record = {
      ...recordData,
      id,
      created_date: recordData.created_date || now,
      updated_date: recordData.updated_date || now,
      created_by: recordData.created_by || 'system'
    };
    
    this.data[table].push(record);
    this._save();
    return record;
  }

  async find(table, query = {}, options = {}) {
    await this.init();
    this._ensureTable(table);
    
    let records = [...this.data[table]];
    
    // Apply query filters
    for (const [key, value] of Object.entries(query)) {
      if (key === 'id') {
        records = records.filter(r => r.id === value);
      } else if (Array.isArray(value)) {
        records = records.filter(r => value.includes(r[key]));
      } else {
        records = records.filter(r => r[key] === value);
      }
    }
    
    // Sort
    if (options.sort) {
      const dir = options.sort.startsWith('-') ? -1 : 1;
      const field = options.sort.replace('-', '');
      records.sort((a, b) => {
        const aVal = a[field] || '';
        const bVal = b[field] || '';
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    }
    
    // Limit & Skip
    if (options.skip) records = records.slice(parseInt(options.skip));
    if (options.limit) records = records.slice(0, parseInt(options.limit));
    
    return records;
  }

  async findOne(table, query) {
    const records = await this.find(table, query, { limit: 1 });
    return records[0] || null;
  }

  async update(table, id, updateData) {
    await this.init();
    this._ensureTable(table);
    
    const idx = this.data[table].findIndex(r => r.id === id);
    if (idx === -1) return null;
    
    const now = new Date().toISOString();
    this.data[table][idx] = {
      ...this.data[table][idx],
      ...updateData,
      id,
      updated_date: now
    };
    
    this._save();
    return this.data[table][idx];
  }

  async updateWhere(table, condition, updateData) {
    await this.init();
    this._ensureTable(table);
    
    let count = 0;
    const now = new Date().toISOString();
    
    for (let i = 0; i < this.data[table].length; i++) {
      let match = true;
      for (const [key, value] of Object.entries(condition)) {
        if (this.data[table][i][key] !== value) {
          match = false;
          break;
        }
      }
      if (match) {
        this.data[table][i] = {
          ...this.data[table][i],
          ...updateData,
          updated_date: now
        };
        count++;
      }
    }
    
    if (count > 0) this._save();
    return count;
  }

  async delete(table, id) {
    await this.init();
    this._ensureTable(table);
    
    const idx = this.data[table].findIndex(r => r.id === id);
    if (idx === -1) return false;
    
    this.data[table].splice(idx, 1);
    this._save();
    return true;
  }

  async count(table, query = {}) {
    const records = await this.find(table, query);
    return records.length;
  }

  async listTables() {
    await this.init();
    return Object.keys(this.data).filter(k => k !== '_meta');
  }

  async exportTable(table) {
    const records = await this.find(table);
    return records;
  }

  async importTable(table, records) {
    await this.init();
    this.data[table] = records;
    this._save();
    return records.length;
  }
}

// Singleton
const instance = new Database();

module.exports = { Database: instance };
