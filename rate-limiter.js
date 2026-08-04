/**
 * HARZ Cloud — Rate Limiter
 * Prevents abuse by limiting API requests per user/IP
 */
const crypto = require('crypto');

const limits = {
  free: { requests: 100, window: 3600000 },      // 100/hour
  pro: { requests: 1000, window: 3600000 },       // 1000/hour
  owner: { requests: 10000, window: 3600000 },    // 10000/hour
  auth: { requests: 10, window: 900000 },         // 10/15min (login attempts)
  upload: { requests: 20, window: 3600000 },      // 20/hour
  cdn: { requests: 500, window: 3600000 }         // 500/hour
};

const store = new Map();

function getKey(identifier, type) {
  return crypto.createHash('md5').update(identifier + type).digest('hex');
}

function checkLimit(identifier, type = 'free') {
  const config = limits[type] || limits.free;
  const key = getKey(identifier, type);
  const now = Date.now();
  
  if (!store.has(key)) {
    store.set(key, { count: 1, resetAt: now + config.window });
    return { allowed: true, remaining: config.requests - 1, limit: config.requests };
  }
  
  const record = store.get(key);
  
  if (now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.window });
    return { allowed: true, remaining: config.requests - 1, limit: config.requests };
  }
  
  if (record.count >= config.requests) {
    return { 
      allowed: false, 
      remaining: 0, 
      limit: config.requests,
      reset_at: new Date(record.resetAt).toISOString()
    };
  }
  
  record.count++;
  return { 
    allowed: true, 
    remaining: config.requests - record.count, 
    limit: config.requests 
  };
}

function middleware(type = 'free') {
  return (req, res, next) => {
    const identifier = req.headers['x-auth-token'] ? req.user?.email || req.ip : req.ip;
    const result = checkLimit(identifier, type);
    
    res.set('X-RateLimit-Limit', result.limit.toString());
    res.set('X-RateLimit-Remaining', result.remaining.toString());
    if (result.reset_at) res.set('X-RateLimit-Reset', result.reset_at);
    
    if (!result.allowed) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        limit: result.limit,
        reset_at: result.reset_at,
        message: 'Too many requests. Try again later.'
      });
    }
    
    next();
  };
}

module.exports = { checkLimit, middleware, limits };
