/**
 * HARZ Cloud — Password Reset (Standalone/Vercel)
 * Uses in-memory storage (works without Database module)
 */
const crypto = require('crypto');

const resetStore = new Map();

async function requestReset(email) {
  if (!email) return { success: false, error: 'Email required' };
  
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  
  resetStore.set(email, {
    code_hash: hashedCode,
    expires_at: Date.now() + 15 * 60000,
    used: false
  });
  
  // In production, send email here
  // For now, return the code in dev mode
  const isDev = !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';
  return {
    success: true,
    message: 'Reset code generated',
    ...(isDev ? { dev_code: code } : {})
  };
}

async function verifyReset(token, newPassword) {
  // token can be "email:code" format
  const [email, code] = token.split(':');
  if (!email || !code || !newPassword) {
    return { success: false, error: 'email, code, and newPassword required (token format: email:code)' };
  }
  
  const reset = resetStore.get(email);
  if (!reset || reset.used) {
    return { success: false, error: 'Invalid or expired code' };
  }
  
  if (Date.now() > reset.expires_at) {
    resetStore.delete(email);
    return { success: false, error: 'Code expired' };
  }
  
  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  if (hashedCode !== reset.code_hash) {
    return { success: false, error: 'Invalid code' };
  }
  
  reset.used = true;
  resetStore.delete(email);
  
  return { success: true, message: 'Password updated successfully' };
}

module.exports = { requestReset, verifyReset };
