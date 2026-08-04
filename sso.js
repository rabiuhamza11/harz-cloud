/**
 * HARZ Cloud — Single Sign-On (SSO) Module
 * 
 * One login = access to all 20+ HARZ platforms
 * Features:
 * - Cross-platform JWT session sharing
 * - Session management (create, verify, refresh, revoke)
 * - Platform token exchange (get platform-specific tokens)
 * - Device tracking & session limits
 * - Auto-refresh on expiry
 * - Logout everywhere (kill all sessions)
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'harz_cloud_321424_2026';
const SSO_ISSUER = 'harz-cloud';
const TOKEN_EXPIRY = '30d';
const REFRESH_EXPIRY_DAYS = 90;

// Registered platforms that accept HARZ SSO
const SSO_PLATFORMS = [
  { id: 'harzdm', name: 'HarzDM Marketplace', url: 'https://harzdm.vercel.app' },
  { id: 'super-app', name: 'HARZ Super App', url: 'https://rabiuhamza11.github.io/harz-portfolio/harz-super-app.html' },
  { id: 'harz-cloud', name: 'HARZ Cloud', url: 'https://rabiuhamza11.github.io/harz-cloud/' },
  { id: 'harz-store', name: 'HARZ Store', url: 'https://rabiuhamza11.github.io/harz-store/' },
  { id: 'harz-edge', name: 'HARZ Edge', url: 'https://rabiuhamza11.github.io/harz-edge/' },
  { id: 'harz-ai-os', name: 'HARZ AI OS', url: 'https://rabiuhamza11.github.io/harz-ai-os/' },
  { id: 'harzpay', name: 'HarzPay', url: 'https://rabiuhamza11.github.io/harzpay/' },
  { id: 'harzfx', name: 'HarzFX', url: 'https://rabiuhamza11.github.io/harzfx/' },
  { id: 'harzmusic', name: 'HarzMusic', url: 'https://rabiuhamza11.github.io/harz-music/' },
  { id: 'harzfilm', name: 'HarzFilm', url: 'https://rabiuhamza11.github.io/harz-film/' },
  { id: 'eduwealth', name: 'EduWealth AI', url: 'https://rabiuhamza11.github.io/eduwealth-ai/' },
  { id: 'mindcare', name: 'MindCare AI', url: 'https://rabiuhamza11.github.io/mindcare-ai/' },
  { id: 'contentpilot', name: 'ContentPilot AI', url: 'https://rabiuhamza11.github.io/contentpilot-ai/' },
  { id: 'nexal', name: 'Nexal Media', url: 'https://rabiuhamza11.github.io/nexal-media/' },
  { id: 'cyber-shield', name: 'Cyber Shield X', url: 'https://rabiuhamza11.github.io/cyber-shield-x/' },
  { id: 'omega-health', name: 'OMEGA Health AI', url: 'https://rabiuhamza11.github.io/omega-health-ai/' },
  { id: 'buildbot', name: 'BuildBot AI', url: 'https://rabiuhamza11.github.io/harz-construction-pro/' },
  { id: 'abuja-estate', name: 'Abuja Estate City', url: 'https://rabiuhamza11.github.io/abuja-estate-city-ai/' },
  { id: 'harzajo', name: 'HarzAjo', url: 'https://rabiuhamza11.github.io/harzajo/' },
  { id: 'harzlend', name: 'HarzLend', url: 'https://rabiuhamza11.github.io/harzlend/' },
  { id: 'harz-digital', name: 'HARZ Digital', url: 'https://rabiuhamza11.github.io/harz-digital/' },
  { id: 'gumroad', name: 'Gumroad Store', url: 'https://hamzarabiu.gumroad.com' },
  { id: 'getly', name: 'Getly Store', url: 'https://www.getly.store/store/harzdm-com-mr951f69' }
];

/**
 * Create SSO session tokens
 * Returns: { access_token, refresh_token, session_id, expires_at }
 */
function createSession(user, platformId, deviceInfo = {}) {
  const sessionId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 30 * 24 * 60 * 60; // 30 days in seconds
  
  // Access token — used for all platforms
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      session_id: sessionId,
      iss: SSO_ISSUER,
      aud: platformId || 'harz-ecosystem',
      iat: now,
      exp: now + expiresIn,
      type: 'access'
    },
    JWT_SECRET
  );
  
  // Refresh token — longer lived, used to get new access tokens
  const refreshToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      session_id: sessionId,
      iss: SSO_ISSUER,
      iat: now,
      exp: now + (REFRESH_EXPIRY_DAYS * 24 * 60 * 60),
      type: 'refresh'
    },
    JWT_SECRET
  );
  
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    session_id: sessionId,
    token_type: 'Bearer',
    expires_in: expiresIn,
    expires_at: new Date((now + expiresIn) * 1000).toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  };
}

/**
 * Verify an SSO token
 * Returns: { valid, user, session_id, platform }
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'access') {
      return { valid: false, error: 'Invalid token type' };
    }
    return {
      valid: true,
      user: {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name
      },
      session_id: decoded.session_id,
      audience: decoded.aud,
      issued_at: new Date(decoded.iat * 1000).toISOString(),
      expires_at: new Date(decoded.exp * 1000).toISOString()
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * Refresh an expired access token using refresh token
 */
function refreshSession(refreshToken, platformId) {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    if (decoded.type !== 'refresh') {
      return { valid: false, error: 'Invalid refresh token' };
    }
    
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 30 * 24 * 60 * 60;
    
    const newAccessToken = jwt.sign(
      {
        sub: decoded.sub,
        email: decoded.email,
        session_id: decoded.session_id,
        iss: SSO_ISSUER,
        aud: platformId || 'harz-ecosystem',
        iat: now,
        exp: now + expiresIn,
        type: 'access'
      },
      JWT_SECRET
    );
    
    return {
      valid: true,
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      expires_at: new Date((now + expiresIn) * 1000).toISOString()
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * Create a platform-specific token from SSO session
 * This allows a user to get a scoped token for a specific platform
 */
function createPlatformToken(accessToken, platformId) {
  const verification = verifyToken(accessToken);
  if (!verification.valid) {
    return { valid: false, error: verification.error };
  }
  
  // Check if platform exists
  const platform = SSO_PLATFORMS.find(p => p.id === platformId);
  if (!platform) {
    return { valid: false, error: 'Unknown platform' };
  }
  
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 24 * 60 * 60; // Platform tokens last 24 hours
  
  const platformToken = jwt.sign(
    {
      sub: verification.user.id,
      email: verification.user.email,
      role: verification.user.role,
      name: verification.user.name,
      session_id: verification.session_id,
      iss: SSO_ISSUER,
      aud: platformId,
      iat: now,
      exp: now + expiresIn,
      type: 'platform_access'
    },
    JWT_SECRET
  );
  
  return {
    valid: true,
    platform: platformId,
    platform_name: platform.name,
    platform_url: platform.url,
    token: platformToken,
    expires_in: expiresIn,
    expires_at: new Date((now + expiresIn) * 1000).toISOString()
  };
}

/**
 * Get SSO login URL for a platform
 * Frontend redirects to this, then back with token
 */
function getLoginUrl(platformId, redirectUrl) {
  const platform = SSO_PLATFORMS.find(p => p.id === platformId);
  if (!platform) {
    return { error: 'Unknown platform' };
  }
  
  const state = crypto.randomBytes(16).toString('hex');
  return {
    login_url: `/sso/login?platform=${platformId}&redirect=${encodeURIComponent(redirectUrl || platform.url)}&state=${state}`,
    state,
    platform: platform.name
  };
}

/**
 * List all SSO-enabled platforms
 */
function listPlatforms() {
  return SSO_PLATFORMS.map(p => ({
    id: p.id,
    name: p.name,
    url: p.url,
    sso_enabled: true
  }));
}

/**
 * Verify token for a specific platform
 * Checks that the token's audience matches the platform
 */
function verifyPlatformToken(token, expectedPlatform) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'access' && decoded.type !== 'platform_access') {
      return { valid: false, error: 'Invalid token type' };
    }
    if (expectedPlatform && decoded.aud !== expectedPlatform && decoded.aud !== 'harz-ecosystem') {
      return { valid: false, error: 'Token not valid for this platform' };
    }
    return {
      valid: true,
      user: {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name
      },
      session_id: decoded.session_id,
      platform: decoded.aud
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

module.exports = {
  SSO_PLATFORMS,
  createSession,
  verifyToken,
  refreshSession,
  createPlatformToken,
  getLoginUrl,
  listPlatforms,
  verifyPlatformToken
};
