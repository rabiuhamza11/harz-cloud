/**
 * HARZ Cloud — Two-Factor Authentication (TOTP)
 * Time-based One-Time Password using HMAC-SHA1
 */
const crypto = require('crypto');

function generateSecret() {
  return crypto.randomBytes(20).toString('base64');
}

function generateTOTP(secret, window = 0) {
  const time = Math.floor(Date.now() / 30000) + window;
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(time));
  
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base64')).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  
  return code.toString().padStart(6, '0');
}

function verifyTOTP(secret, token) {
  // Check current and adjacent windows (±1)
  for (let i = -1; i <= 1; i++) {
    if (generateTOTP(secret, i) === token) {
      return true;
    }
  }
  return false;
}

function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

async function enable2FA(userEmail, Database) {
  const secret = generateSecret();
  const backupCodes = generateBackupCodes();
  
  await Database.updateWhere('users', { email: userEmail }, {
    two_factor_secret: secret,
    two_factor_enabled: true,
    two_factor_backup_codes: JSON.stringify(backupCodes)
  });
  
  return {
    success: true,
    secret,
    backup_codes: backupCodes,
    otpauth_url: `otpauth://totp/HARZ:${userEmail}?secret=${secret.replace(/=/g, '')}&issuer=HARZ+Cloud`
  };
}

async function verify2FA(userEmail, token, Database) {
  const user = await Database.findOne('users', { email: userEmail, two_factor_enabled: true });
  if (!user) {
    return { valid: false, error: '2FA not enabled' };
  }
  
  // Check TOTP
  if (verifyTOTP(user.two_factor_secret, token)) {
    return { valid: true, method: 'totp' };
  }
  
  // Check backup codes
  try {
    const codes = JSON.parse(user.two_factor_backup_codes || '[]');
    if (codes.includes(token.toUpperCase())) {
      // Remove used code
      const remaining = codes.filter(c => c !== token.toUpperCase());
      await Database.update('users', user.id, {
        two_factor_backup_codes: JSON.stringify(remaining)
      });
      return { valid: true, method: 'backup_code', remaining_codes: remaining.length };
    }
  } catch (e) {}
  
  return { valid: false, error: 'Invalid token' };
}

module.exports = { generateSecret, generateTOTP, verifyTOTP, enable2FA, verify2FA, generateBackupCodes };
