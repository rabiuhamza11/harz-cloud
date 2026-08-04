/**
 * HARZ Cloud — Full-Text Search
 * Search across all entities and content
 */
const crypto = require('crypto');

async function search(query, options, Database) {
  const { entities = [], limit = 20, fuzzy = true } = options;
  const term = query.toLowerCase().trim();
  
  if (!term) return { results: [], count: 0 };
  
  // Entities to search (default: all common ones)
  const searchEntities = entities.length > 0 ? entities : [
    'products', 'orders', 'users', 'crm', 'courses',
    'music_tracks', 'films', 'estate_properties', 'freelance_services'
  ];
  
  const allResults = [];
  
  for (const entityName of searchEntities) {
    try {
      const records = await Database.find(entityName, {}, { limit: 500 });
      
      for (const record of records) {
        const searchText = JSON.stringify(record).toLowerCase();
        let score = 0;
        let matchedFields = [];
        
        // Exact match = highest score
        if (searchText.includes(term)) {
          score += 100;
          matchedFields.push('exact');
        }
        
        // Fuzzy match (individual words)
        if (fuzzy) {
          const words = term.split(/\s+/);
          for (const word of words) {
            if (word.length > 2 && searchText.includes(word)) {
              score += 10;
              matchedFields.push(word);
            }
          }
        }
        
        // Title/name match = bonus
        const titleField = record.title || record.name || record.product_name || record.full_name;
        if (titleField && titleField.toLowerCase().includes(term)) {
          score += 50;
          matchedFields.push('title');
        }
        
        if (score > 0) {
          allResults.push({
            entity: entityName,
            id: record.id,
            title: titleField || record.email || record.id,
            score,
            matched_fields: matchedFields,
            preview: searchText.substring(0, 200)
          });
        }
      }
    } catch (e) {
      // Entity might not exist, skip
    }
  }
  
  // Sort by score, limit results
  allResults.sort((a, b) => b.score - a.score);
  const limited = allResults.slice(0, limit);
  
  return {
    query,
    count: limited.length,
    total_matches: allResults.length,
    results: limited
  };
}

module.exports = { search };
