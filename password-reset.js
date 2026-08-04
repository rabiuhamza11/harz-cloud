/**
 * HARZ Cloud — Password Reset Flow
 * Request reset → Generate code → Verify code → Set new password
 */
const crypto = require('crypto');

async function requestReset(email, Database, emailService) {
  const user = await Database.findOne('users', { email });
  if (!user) {
    // Don't reveal if email exists
    return { success: true, message: 'If the email exists, a reset code has been sent' };
  }
  
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  
  await Database.insert('password_resets', {
    id: crypto.randomUUID(),
    email,
    code_hash: hashedCode,
    expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
    used: false,
    created_date: new Date().toISOString()
  });
  
  if (emailService) {
    await emailService.sendEmail(email, 'password_reset', { name: user.full_name, code }, Database);
  }
  
  return { success: true, message: 'Reset code sent to email' };
}

async function verifyReset(email, code, newPassword, Database) {
  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  
  const reset = await Database.findOne('password_resets', {
    email,
    code_hash: hashedCode,
    used: false
  });
  
  if (!reset) {
    return { success: false, error: 'Invalid or expired code' };
  }
  
  if (new Date(reset.expires_at) < new Date()) {
    return { success: false, error: 'Code expired' };
  }
  
  // Mark code as used
  await Database.update('password_resets', reset.id, { used: true });
  
  // Update password
  const bcrypt = require('bcryptjs');
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  
  const users = await Database.find('users', { email });
  for (const user of users) {
    await Database.update('users', user.id, { password: hashedPassword });
  }
  
  return { success: true, message: 'Password updated successfully' };
}

module.exports = { requestReset, verifyReset };
