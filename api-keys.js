/**
 * HARZ Cloud — API Key Management
 * Generate, validate, and manage API keys for external access
 */
const crypto = require('crypto');

async function generateKey(params, Database) {
  const { user_email, name, scopes = ['read'], tier = 'free', expires_days = 365 } = params;
  
  const rawKey = 'hz_' + crypto.randomBytes(24).toString('hex');
  const hashed = crypto.createHash('sha256').update(rawKey).digest('hex');
  
  const apiKey = {
    id: crypto.randomUUID(),
    key_hash: hashed,
    key_prefix: rawKey.substring(0, 10) + '...',
    name,
    user_email,
    scopes: JSON.stringify(scopes),
    tier,
    requests_today: 0,
    requests_total: 0,
    monthly_limit: tier === 'pro' ? 10000 : tier === 'enterprise' ? 100000 : 1000,
    status: 'active',
    expires_at: new Date(Date.now() + expires_days * 86400000).toISOString(),
    created_date: new Date().toISOString(),
    last_used: null
  };
  
  await Database.insert('api_keys', apiKey);
  
  return {
    success: true,
    key: rawKey,
    name,
    tier,
    scopes,
    expires_at: apiKey.expires_at,
    message: 'Save this key securely. It will not be shown again.'
  };
}

async function validateKey(rawKey, Database) {
  if (!rawKey || !rawKey.startsWith('hz_')) {
    return { valid: false, error: 'Invalid key format' };
  }
  
  const hashed = crypto.createHash('sha256').update(rawKey).digest('hex');
  const apiKey = await Database.findOne('api_keys', { key_hash: hashed, status: 'active' });
  
  if (!apiKey) {
    return { valid: false, error: 'Key not found or revoked' };
  }
  
  if (new Date(apiKey.expires_at) < new Date()) {
    return { valid: false, error: 'Key expired' };
  }
  
  // Update usage
  await Database.update('api_keys', apiKey.id, {
    requests_today: (apiKey.requests_today || 0) + 1,
    requests_total: (apiKey.requests_total || 0) + 1,
    last_used: new Date().toISOString()
  });
  
  if (apiKey.requests_today >= apiKey.monthly_limit) {
    return { valid: false, error: 'Monthly limit exceeded' };
  }
  
  return {
    valid: true,
    user_email: apiKey.user_email,
    scopes: JSON.parse(apiKey.scopes || '[]'),
    tier: apiKey.tier,
    name: apiKey.name
  };
}

async function revokeKey(keyId, Database) {
  await Database.update('api_keys', keyId, { status: 'revoked' });
  return { success: true, revoked: keyId };
}

async function listKeys(userEmail, Database) {
  const keys = await Database.find('api_keys', { user_email: userEmail }, { sort: '-created_date' });
  return keys.map(k => ({
    id: k.id,
    name: k.name,
    prefix: k.key_prefix,
    tier: k.tier,
    scopes: JSON.parse(k.scopes || '[]'),
    requests_total: k.requests_total,
    requests_today: k.requests_today,
    monthly_limit: k.monthly_limit,
    status: k.status,
    expires_at: k.expires_at,
    last_used: k.last_used
  }));
}

module.exports = { generateKey, validateKey, revokeKey, listKeys };
