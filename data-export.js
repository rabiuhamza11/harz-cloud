/**
 * HARZ Cloud — Data Export/Import
 * Export entities to JSON/CSV, import from JSON
 */
const crypto = require('crypto');

async function exportEntity(entityName, format, Database) {
  const records = await Database.find(entityName, {}, { limit: 10000 });
  
  if (format === 'csv') {
    if (records.length === 0) return { format: 'csv', data: '' };
    
    const headers = Object.keys(records[0]).filter(k => 
      typeof records[0][k] !== 'object'
    );
    
    const csvLines = [headers.join(',')];
    
    for (const record of records) {
      const row = headers.map(h => {
        const val = record[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') ? `"${str}"` : str;
      });
      csvLines.push(row.join(','));
    }
    
    return { format: 'csv', entity: entityName, count: records.length, data: csvLines.join('\n') };
  }
  
  // JSON (default)
  return { format: 'json', entity: entityName, count: records.length, data: JSON.stringify(records, null, 2) };
}

async function exportAll(format, Database) {
  const entities = ['users', 'products', 'orders', 'crm', 'courses', 'music_tracks', 'films', 
                    'estate_properties', 'freelance_services', 'file_store'];
  const exports = {};
  
  for (const entity of entities) {
    try {
      const result = await exportEntity(entity, format, Database);
      exports[entity] = { count: result.count, data: result.data };
    } catch (e) {
      exports[entity] = { count: 0, error: e.message };
    }
  }
  
  return {
    format,
    exported_at: new Date().toISOString(),
    entities: Object.keys(exports).length,
    total_records: Object.values(exports).reduce((sum, e) => sum + (e.count || 0), 0),
    data: exports
  };
}

async function importEntity(entityName, data, Database) {
  const records = typeof data === 'string' ? JSON.parse(data) : data;
  
  if (!Array.isArray(records)) {
    return { success: false, error: 'Data must be an array of records' };
  }
  
  let imported = 0;
  let failed = 0;
  
  for (const record of records) {
    try {
      if (!record.id) record.id = crypto.randomUUID();
      record.imported_date = new Date().toISOString();
      await Database.insert(entityName, record);
      imported++;
    } catch (e) {
      failed++;
    }
  }
  
  return { success: true, entity: entityName, imported, failed, total: records.length };
}

module.exports = { exportEntity, exportAll, importEntity };
