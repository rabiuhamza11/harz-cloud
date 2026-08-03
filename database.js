/**
 * HARZ Cloud Database Layer
 * Supports: SQLite (development) → PostgreSQL/Supabase (production)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, 'data', 'harz_cloud.db');
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) return reject(err);
        console.log('SQLite database connected:', this.dbPath);
        
        // Create meta table for tracking
        this.db.run(`CREATE TABLE IF NOT EXISTS _meta (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at TEXT
        )`);
        
        resolve();
      });
    });
  }

  // Ensure table exists
  ensureTable(name) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `CREATE TABLE IF NOT EXISTS ${name} (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          created_date TEXT,
          updated_date TEXT,
          created_by TEXT
        )`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Insert
  async insert(table, data) {
    await this.ensureTable(table);
    return new Promise((resolve, reject) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      const record = {
        ...data,
        id,
        created_date: data.created_date || now,
        updated_date: data.updated_date || now
      };
      
      this.db.run(
        `INSERT INTO ${table} (id, data, created_date, updated_date, created_by) VALUES (?, ?, ?, ?, ?)`,
        [id, JSON.stringify(record), record.created_date, record.updated_date, record.created_by || 'system'],
        (err) => {
          if (err) reject(err);
          else resolve(record);
        }
      );
    });
  }

  // Find with query
  async find(table, query = {}, options = {}) {
    await this.ensureTable(table);
    return new Promise((resolve, reject) => {
      let sql = `SELECT data FROM ${table}`;
      const params = [];
      const conditions = [];
      
      // Build WHERE from query
      for (const [key, value] of Object.entries(query)) {
        if (key === 'id') {
          conditions.push(`id = ?`);
          params.push(value);
        } else {
          conditions.push(`json_extract(data, '$.${key}') = ?`);
          params.push(String(value));
        }
      }
      
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      // Sort
      if (options.sort) {
        const dir = options.sort.startsWith('-') ? 'DESC' : 'ASC';
        const field = options.sort.replace('-', '');
        if (field === 'created_date' || field === 'updated_date') {
          sql += ` ORDER BY ${field} ${dir}`;
        } else {
          sql += ` ORDER BY json_extract(data, '$.${field}') ${dir}`;
        }
      }
      
      // Limit & Skip
      if (options.limit) sql += ` LIMIT ${parseInt(options.limit)}`;
      if (options.skip) sql += ` OFFSET ${parseInt(options.skip)}`;
      
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(r => JSON.parse(r.data)));
      });
    });
  }

  // Find one
  async findOne(table, query) {
    const records = await this.find(table, query, { limit: 1 });
    return records[0] || null;
  }

  // Update
  async update(table, id, data) {
    await this.ensureTable(table);
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      
      this.db.get(`SELECT data FROM ${table} WHERE id = ?`, [id], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        
        const existing = JSON.parse(row.data);
        const updated = { ...existing, ...data, id, updated_date: now };
        
        this.db.run(
          `UPDATE ${table} SET data = ?, updated_date = ? WHERE id = ?`,
          [JSON.stringify(updated), now, id],
          (err) => {
            if (err) reject(err);
            else resolve(updated);
          }
        );
      });
    });
  }

  // Update by condition
  async updateWhere(table, condition, data) {
    const records = await this.find(table, condition);
    for (const record of records) {
      await this.update(table, record.id, data);
    }
    return records.length;
  }

  // Delete
  async delete(table, id) {
    await this.ensureTable(table);
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM ${table} WHERE id = ?`, [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  // Count
  async count(table, query = {}) {
    await this.ensureTable(table);
    const records = await this.find(table, query, { limit: 100000 });
    return records.length;
  }

  // List all tables
  async listTables() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_%' AND name NOT LIKE 'sqlite_%'`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(r => r.name));
        }
      );
    });
  }

  // Export table as JSON
  async exportTable(table) {
    await this.ensureTable(table);
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT data FROM ${table}`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => JSON.parse(r.data)));
      });
    });
  }
}

// Singleton
const instance = new Database();
instance.init().catch(console.error);

module.exports = { Database: instance };
